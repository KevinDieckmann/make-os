// ─── Absichtsprotokoll für Vorgänge über mehrere Bestände (29.09., Paket D-C #17/#21) ─
// Problem (DATENARCHITEKTUR_FEHLER_PRUEFLISTE #17): Art. 17, Dubletten-Zusammenführen, Import, Kennungs-Umzug und ein paar
// CRM-Wege schreiben NACHEINANDER in mehrere Bestände (je eine Sperre). Bricht der Vorgang in der Mitte ab (Absturz,
// Deploy nach 60 s, ein beschädigter Bestand wirft), bleibt ein halber Zustand: die Person ist aus der Kartei weg, ihr
// Name aber verloren — ein zweiter Lauf könnte Deal-Titel und Aufgaben nicht mehr tilgen; Verweise zeigen ins Leere.
//
// Lösung (Saga mit Journal): VOR dem ersten Schritt liegt eine Absicht im Bestand `absichten--<haushalt>`
// (verschlüsselt wie jeder Bestand, über local-db): Art, fachlicher Schlüssel, die Daten, die jeder Schritt braucht
// (z. B. Name + Adressen der zu löschenden Person), und die Schrittliste. Jeder Schritt ist idempotent und wird nach
// getaner Arbeit abgehakt. Beim Start (instrumentation.ts → lib/store/betrieb.ts), im Takt und in der nächtlichen
// Durchsicht stellt `offeneFertigstellen` (lib/store/absichten-fortsetzen.ts) jede offene Absicht fertig — Schritt für
// Schritt ab dem ersten nicht abgehakten. Nach `GRENZE_VERSUCHE` gescheiterten Wiederaufnahmen: Status „gescheitert“,
// der Head of IT zeigt sie rot (und meldet sie im Stundenblick) — ab dann nur noch von Hand.
//
// Datenschutz: `daten` hält Personendaten nur, solange der Vorgang offen ist — beim Abschluss bleiben nur Art, Schritte,
// Zeiten und Zahlen (`behalten` nennt ausdrücklich erlaubte Felder, nie Namen/Adressen). Fertige Absichten fallen nach
// 30 Tagen weg (beim nächsten Schreiben). Register: lib/crm/speicher-register.ts (`absichten--*`).
//
// Rein bis auf die Speicherfunktionen; Tests: tests/absichten.test.ts (Abbruch nach JEDEM Schritt → Wiederaufnahme
// ergibt denselben Endzustand).

import { promises as fs } from 'fs';
import { neueKennung } from '@/lib/kennung';
import { datenOrdner, loadJson, updateJson } from './local-db';

export const ABSICHTEN_PRAEFIX = 'absichten--';
const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const absichtenName = (haushalt: string): string => {
  if (!HAUSHALT.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `${ABSICHTEN_PRAEFIX}${haushalt}`;
};

/** Nach so vielen gescheiterten Wiederaufnahmen bleibt die Absicht stehen (rot im Head of IT). */
export const GRENZE_VERSUCHE = 3;
/** Abgeschlossene Absichten bleiben so lange (Nachvollziehbarkeit), dann fallen sie beim nächsten Schreiben weg. */
export const HALTEN_TAGE = 30;

/** `buchung` (29.09., K4): Terminbuchung als EIN CRM-Vorgang — Anfrage bzw. Freigabe (lib/kalender/buchung-ablauf.ts).
 *  `firma-umhaengen` (03.10., Qualifizierung): Lead und Deals zur neuen Firma bzw. Firmen zusammenführen (lib/crm/firma-umhaengen-server.ts).
 *  `wochenplan-uebernahme` (29.09., K5): alte Wochenplan-Blöcke → iCloud-Termine (lib/planung/wochenplan-uebernahme-server.ts). */
export type AbsichtArt = 'art17' | 'zusammenfuehren' | 'import' | 'kennungen-umzug' | 'kennungen-rueckweg' | 'crm-folgen' | 'angebot-stellen' | 'buchung' | 'wochenplan-uebernahme' | 'firma-umhaengen';
export const ABSICHT_ARTEN: readonly AbsichtArt[] = ['art17', 'zusammenfuehren', 'import', 'kennungen-umzug', 'kennungen-rueckweg', 'crm-folgen', 'angebot-stellen', 'buchung', 'wochenplan-uebernahme', 'firma-umhaengen'];
/**
 * offen          läuft oder wartet auf Wiederaufnahme
 * fertig         alle Schritte abgehakt
 * unvollstaendig abgeschlossen, aber einzelne Bestände meldeten Fehler (Art. 17: Löschprotokoll „unvollständig“) — wird
 *                wie „offen“ wieder aufgenommen, bis alles da ist oder die Grenze erreicht ist
 * gescheitert    Grenze erreicht — nur noch von Hand (HOI rot)
 * verworfen      fachlich gegenstandslos (z. B. der Vorgang fand nie statt: Angebot blieb Entwurf)
 */
export type AbsichtStatus = 'offen' | 'fertig' | 'unvollstaendig' | 'gescheitert' | 'verworfen';
export interface AbsichtSchritt { name: string; erledigt?: string }
export interface Absicht {
  id: string;
  art: AbsichtArt;
  /** Fachlicher Schlüssel (Kontakt-Kennung, Lauf-ID, Angebots-ID …) — je Art + Schlüssel höchstens eine offene Absicht. */
  schluessel: string;
  person?: string;
  angelegt: string;
  status: AbsichtStatus;
  schritte: AbsichtSchritt[];
  /** Was die Schritte brauchen (bei Art. 17: Name, Adressen). Wird beim Abschluss geleert (bis auf `behalten`). */
  daten: Record<string, unknown>;
  /** Wiederaufnahmen, die scheiterten. */
  versuche: number;
  letzterVersuch?: string;
  /** Nur ein kurzer technischer Grund (Fehlerklasse/Bestand), nie Inhalte. */
  letzterFehler?: string;
  abgeschlossen?: string;
}
export interface AbsichtenDatei { absichten: Absicht[] }

// ── Rein ─────────────────────────────────────────────────────────────────────

export const istOffen = (a: Pick<Absicht, 'status'>) => a.status === 'offen' || a.status === 'unvollstaendig';
export const schrittErledigt = (a: Pick<Absicht, 'schritte'>, name: string) => !!a.schritte.find(s => s.name === name)?.erledigt;
/** Der erste nicht abgehakte Schritt (oder null). */
export const naechsterSchritt = (a: Pick<Absicht, 'schritte'>) => a.schritte.find(s => !s.erledigt)?.name ?? null;

/** Kurzer technischer Grund aus einem Fehler — Klasse + erste Zeile, gekürzt, ohne Werte aus Beständen. */
export function fehlerGrund(e: unknown): string {
  const n = e instanceof Error ? e.name : 'Fehler';
  const m = e instanceof Error ? e.message : String(e);
  return `${n}: ${m.split('\n')[0]}`.replace(/\s+/g, ' ').slice(0, 160);
}

/** Abgeschlossene Absichten älter als `HALTEN_TAGE` fallen weg; offene und gescheiterte bleiben immer. */
export function aufraeumen(l: readonly Absicht[], jetztIso: string): Absicht[] {
  const grenze = Date.parse(jetztIso) - HALTEN_TAGE * 864e5;
  return l.filter(a => istOffen(a) || a.status === 'gescheitert' || !a.abgeschlossen || Date.parse(a.abgeschlossen) >= grenze);
}

const nurErlaubt = (daten: Record<string, unknown>, behalten: readonly string[]) => Object.fromEntries(Object.entries(daten).filter(([k]) => behalten.includes(k)));

// ── Speicher ─────────────────────────────────────────────────────────────────

const liste = (cur: AbsichtenDatei | null) => (Array.isArray(cur?.absichten) ? cur!.absichten : []);

async function aendern(haushalt: string, f: (l: Absicht[]) => Absicht[]): Promise<Absicht[]> {
  const jetzt = new Date().toISOString();
  const r = await updateJson<AbsichtenDatei>(absichtenName(haushalt), cur => {
    const alt = liste(cur);
    const neu = aufraeumen(f(alt.map(a => ({ ...a, schritte: a.schritte.map(s => ({ ...s })) }))), jetzt);
    return JSON.stringify(neu) === JSON.stringify(alt) ? (cur ?? { absichten: [] }) : { absichten: neu };
  });
  return r.absichten ?? [];
}

export async function absichtenLaden(haushalt: string): Promise<Absicht[]> {
  return liste(await loadJson<AbsichtenDatei>(absichtenName(haushalt)));
}

/** Alle Haushalte mit Absichten (aus den Dateinamen, ohne Inhalte zu lesen). */
export async function absichtenHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => /^absichten--([a-z0-9][a-z0-9-]{0,39})\.json$/.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}

export interface NeueAbsicht { art: AbsichtArt; schluessel: string; schritte: readonly string[]; daten?: Record<string, unknown>; person?: string }

/**
 * Eine Absicht festhalten — VOR dem ersten Schritt. Gibt es für Art + Schlüssel schon eine offene, wird DIESE
 * zurückgegeben (`neu: false`): der Aufrufer setzt sie fort, statt einen zweiten Vorgang zu beginnen.
 */
export async function absichtBeginnen(haushalt: string, n: NeueAbsicht): Promise<{ absicht: Absicht; neu: boolean }> {
  let raus: { absicht: Absicht; neu: boolean } | null = null;
  await aendern(haushalt, l => {
    const offen = l.find(a => a.art === n.art && a.schluessel === n.schluessel && istOffen(a));
    if (offen) { raus = { absicht: offen, neu: false }; return l; }
    const a: Absicht = {
      id: neueKennung('ab'), art: n.art, schluessel: n.schluessel, ...(n.person ? { person: n.person } : {}),
      angelegt: new Date().toISOString(), status: 'offen', schritte: n.schritte.map(name => ({ name })), daten: n.daten ?? {}, versuche: 0,
    };
    raus = { absicht: a, neu: true };
    return [...l, a];
  });
  return raus!;
}

/** Einen Schritt abhaken (idempotent). `daten` wird eingemischt (z. B. Zwischenergebnisse, die spätere Schritte brauchen). */
export async function schrittAbhaken(haushalt: string, id: string, name: string, daten?: Record<string, unknown>): Promise<void> {
  const jetzt = new Date().toISOString();
  await aendern(haushalt, l => l.map(a => (a.id !== id ? a : {
    ...a,
    schritte: a.schritte.map(s => (s.name === name && !s.erledigt ? { ...s, erledigt: jetzt } : s)),
    ...(daten ? { daten: { ...a.daten, ...daten } } : {}),
  })));
}

/** Daten einer offenen Absicht ergänzen (ohne Schritt). */
export async function absichtDatenSetzen(haushalt: string, id: string, daten: Record<string, unknown>): Promise<void> {
  await aendern(haushalt, l => l.map(a => (a.id === id ? { ...a, daten: { ...a.daten, ...daten } } : a)));
}

/**
 * Abschließen: Status setzen und die Daten leeren — nur Felder aus `behalten` (Zahlen, Kennungen ohne Personenbezug)
 * bleiben. „unvollstaendig“ behält alle Daten (die Wiederaufnahme braucht sie noch).
 */
export async function absichtAbschliessen(haushalt: string, id: string, status: Exclude<AbsichtStatus, 'offen'> = 'fertig', behalten: readonly string[] = []): Promise<void> {
  const jetzt = new Date().toISOString();
  await aendern(haushalt, l => l.map(a => {
    if (a.id !== id) return a;
    // Unvollständig: bleibt offen für die Wiederaufnahme — alle Daten, kein Abschluss-Zeitpunkt.
    if (status === 'unvollstaendig') return { ...a, status };
    // Abgeschlossen: der fachliche Schlüssel (kann eine alte Kontakt-Kennung mit E-Mail sein) und die Daten gehen.
    const { letzterFehler: _f, ...rest } = a;
    return { ...(status === 'gescheitert' ? a : rest), status, abgeschlossen: jetzt, schluessel: status === 'gescheitert' ? a.schluessel : '—', daten: status === 'gescheitert' ? a.daten : nurErlaubt(a.daten, behalten) };
  }));
}

/** Eine Wiederaufnahme scheiterte: zählen, ab der Grenze „gescheitert“ (Daten bleiben — sie werden von Hand gebraucht). */
export async function fehlschlagVermerken(haushalt: string, id: string, e: unknown): Promise<Absicht | null> {
  const jetzt = new Date().toISOString();
  let raus: Absicht | null = null;
  await aendern(haushalt, l => l.map(a => {
    if (a.id !== id) return a;
    const versuche = a.versuche + 1;
    raus = { ...a, versuche, letzterVersuch: jetzt, letzterFehler: fehlerGrund(e), ...(versuche >= GRENZE_VERSUCHE ? { status: 'gescheitert' as const } : {}) };
    return raus;
  }));
  return raus;
}

/** Eine gescheiterte Absicht von Hand wieder aufnehmen lassen (Zähler zurück) — für den Head of IT. */
export async function absichtErneutVersuchen(haushalt: string, id: string): Promise<boolean> {
  let gab = false;
  await aendern(haushalt, l => l.map(a => (a.id === id && a.status === 'gescheitert' ? (gab = true, { ...a, status: 'offen' as const, versuche: 0 }) : a)));
  return gab;
}

// ── Ablauf: Schritte ausführen, abhaken, Wiederaufnahme ─────────────────────

/**
 * Nur für Tests: Abbruch simulieren (`vorAbhaken`: Wirkung geschehen, aber nicht abgehakt · `nachAbhaken`: abgehakt,
 * danach Absturz) bzw. einen Bestand scheitern lassen (`vorSchritt`: wirft, bevor der Schritt wirkt).
 */
type Haken = ((art: AbsichtArt, schritt: string) => void) | null;
export const absichtTest: { vorSchritt: Haken; vorAbhaken: Haken; nachAbhaken: Haken } = { vorSchritt: null, vorAbhaken: null, nachAbhaken: null };
export class TestAbbruch extends Error { constructor(schritt: string) { super(`Testabbruch nach ${schritt}`); this.name = 'TestAbbruch'; } }

/** Absichten, die dieser Prozess gerade ausführt — die Wiederaufnahme lässt sie in Ruhe. */
const G = globalThis as unknown as { __makeosAbsichtenLaufend?: Set<string> };
const LAUFEND: Set<string> = (G.__makeosAbsichtenLaufend ??= new Set());
export const laeuftGerade = (id: string) => LAUFEND.has(id);

export interface Vorgang {
  readonly haushalt: string;
  readonly absicht: Absicht;
  /** Ist der Schritt schon abgehakt? */
  erledigt(name: string): boolean;
  /**
   * Einen Schritt ausführen, wenn er noch nicht abgehakt ist, und danach abhaken. `fn` MUSS idempotent sein — ein
   * Abbruch zwischen Wirkung und Abhaken lässt ihn bei der Wiederaufnahme erneut laufen. Liefert `fn`s Ergebnis
   * (bzw. undefined, wenn der Schritt schon erledigt war). `daten` (aus dem Ergebnis) wird beim Abhaken gespeichert.
   */
  schritt<T>(name: string, fn: () => Promise<T>, daten?: (r: T) => Record<string, unknown>): Promise<T | undefined>;
  /** Daten der Absicht (inkl. der beim Abhaken gespeicherten). */
  daten<T = unknown>(feld: string): T | undefined;
}

/**
 * Eine flüchtige Absicht (nicht gespeichert) — für Läufe ohne schützenswerte Daten, z. B. ein zweiter Art.-17-Lauf,
 * der nur noch nach der Kennung räumt: er soll keinen Eintrag hinterlassen (idempotent ohne Spur).
 */
export function fluechtigeAbsicht(n: NeueAbsicht): Absicht {
  return { id: neueKennung('ab'), art: n.art, schluessel: n.schluessel, angelegt: new Date().toISOString(), status: 'offen', schritte: n.schritte.map(name => ({ name })), daten: n.daten ?? {}, versuche: 0 };
}

/**
 * Einen Vorgang für eine (neue oder wieder aufgenommene) Absicht ausführen. Die Absicht gilt währenddessen als laufend.
 * `speichern: false` (flüchtig): Schritte werden nur im Speicher abgehakt.
 */
export async function mitVorgang<T>(haushalt: string, absicht: Absicht, f: (v: Vorgang) => Promise<T>, opt: { speichern?: boolean } = {}): Promise<T> {
  const speichern = opt.speichern !== false;
  const a: Absicht = { ...absicht, schritte: absicht.schritte.map(s => ({ ...s })), daten: { ...absicht.daten } };
  const v: Vorgang = {
    haushalt, absicht: a,
    erledigt: name => schrittErledigt(a, name),
    daten: <X>(feld: string) => a.daten[feld] as X | undefined,
    async schritt<R>(name: string, fn: () => Promise<R>, daten?: (r: R) => Record<string, unknown>) {
      if (!a.schritte.some(s => s.name === name)) throw new Error(`[absichten] ${a.art}: unbekannter Schritt ${name}`);
      if (schrittErledigt(a, name)) return undefined;
      absichtTest.vorSchritt?.(a.art, name);
      const r = await fn();
      absichtTest.vorAbhaken?.(a.art, name);
      const d = daten ? daten(r) : undefined;
      if (speichern) await schrittAbhaken(haushalt, a.id, name, d);
      const s = a.schritte.find(x => x.name === name)!;
      s.erledigt = new Date().toISOString();
      if (d) Object.assign(a.daten, d);
      absichtTest.nachAbhaken?.(a.art, name);
      return r;
    },
  };
  LAUFEND.add(a.id);
  try { return await f(v); }
  finally { LAUFEND.delete(a.id); }
}
