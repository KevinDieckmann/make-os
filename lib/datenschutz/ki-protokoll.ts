// ─── KI-Protokoll nach Kategorien (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────────────────────────────────
// Je Modell-Aufruf eine Zeile NUR mit Metadaten — wann, welcher Lauf/Zweck, für welche Person, welche Datenkategorien
// (crm, gesundheit, kalender …), wie viele Datensätze, ob pseudonymisiert, ob gesperrt. NIE Inhalte: kein Prompt, keine
// Antwort, keine Namen, keine Kennungen Dritter (Wächter tests/ki-datenschutz.test.ts „KI-Protokoll ohne Inhalte“).
//
// Wozu: Rechenschaft (Art. 5 Abs. 2), Art. 15 Abs. 1 lit. c („an welche Empfänger gingen meine Daten“ — hier: Anthropic
// PBC, USA), Art. 30 (Verzeichnis), Prüfung der Schalter. Einsehbar unter System › Datenschutz (je Person die eigenen
// Zeilen; der Inhaber zusätzlich die Systemläufe ohne Person).
//
// Ablage: Monatsdateien `ki-protokoll--JJJJ-MM` (verschlüsselt wie alle Bestände). Aufbewahrung 12 Monate: beim ersten
// Schreiben eines Tages werden ältere Monate geleert (Marke `bereinigt`, wie das Änderungsprotokoll).
// Geschrieben wird an EINER Stelle: `askText` in lib/anthropic.ts. Ein Fehler beim Protokollieren verhindert nie eine Antwort.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { KI_KATEGORIEN, type KiKategorie } from './ki-einstellungen';
import type { KiLauf } from './ki-lauf';

export const KI_PROTOKOLL_PRAEFIX = 'ki-protokoll';
export const KI_PROTOKOLL_MONATE = 12;
/** Höchstens so viele Zeilen je Monat — darüber zählt nur noch `ueberlauf` (nie still). */
export const KI_PROTOKOLL_MAX = 60_000;
/** Empfänger der Modell-Aufrufe (Art. 15 Abs. 1 lit. c, Art. 13 Abs. 1 lit. e/f). */
export const KI_EMPFAENGER = 'Anthropic PBC, San Francisco (USA) — KI-Modell (Drittland; EU-US Data Privacy Framework bzw. Standardvertragsklauseln)';

export interface KiProtokollEintrag {
  /** Zeitpunkt (ISO). */
  at: string;
  /** Zweck/Funktion („zoe-gespraech“, „tageslauf“, „heads-sales“ …) — Kennwort, kein Text. */
  zweck: string;
  lauf: KiLauf;
  person: string | null;
  kategorien: KiKategorie[];
  /** Anzahl Datensätze (wenn der Aufrufer sie kennt). */
  anzahl?: number;
  /** Ersetzte Namen (Pseudonymisierung) — nur die Zahl. */
  pseudonym?: number;
  websuche?: boolean;
  modell: string;
  ergebnis: 'ok' | 'fehler' | 'gesperrt';
  /** Grund einer Sperre (Kennwort, z. B. `hintergrund-aus`, `einwilligung-gesundheit`, `bereich-crm`). */
  grund?: string;
}
export interface KiProtokollDatei { eintraege: KiProtokollEintrag[]; ueberlauf?: number; bereinigt?: { am: string; eintraege: number; grund: string } }

const PERSON = /^[a-z0-9-]{1,40}$/;
const KENNWORT = /^[a-z0-9][a-z0-9:_.-]{0,59}$/i;

/** Monat (Berlin) als JJJJ-MM. */
export function monatVon(d = new Date()): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return `${t.find(x => x.type === 'year')!.value}-${t.find(x => x.type === 'month')!.value}`;
}
export function protokollMonatName(monat: string): string {
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error(`[ki-protokoll] Monat ungültig: ${monat}`);
  return `ki-protokoll--${monat}`;
}
/** Die letzten n Monate (neuester zuerst). */
export function letzteMonate(n: number, d = new Date()): string[] {
  const [j, m] = monatVon(d).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const x = new Date(Date.UTC(j, m - 1 - i, 15)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`; });
}

/**
 * Eine Zeile säubern (rein): nur bekannte Felder, Kennwörter statt Text — was wie Inhalt aussieht, fällt weg.
 * Damit kann auch ein Aufrufer, der versehentlich Text als „zweck“ übergibt, nichts Inhaltliches hineinschreiben.
 */
export function eintragSaeubern(e: Omit<KiProtokollEintrag, 'at'> & { at?: string }): KiProtokollEintrag {
  const zweck = typeof e.zweck === 'string' && KENNWORT.test(e.zweck) ? e.zweck : 'unbenannt';
  const kategorien = Array.from(new Set((e.kategorien ?? []).filter(k => (KI_KATEGORIEN as readonly string[]).includes(k)))) as KiKategorie[];
  const zahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 1_000_000) : undefined);
  const anzahl = zahl(e.anzahl), pseudonym = zahl(e.pseudonym);
  return {
    at: typeof e.at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(e.at) ? e.at : new Date().toISOString(),
    zweck,
    lauf: e.lauf === 'gespraech' || e.lauf === 'hintergrund' ? e.lauf : 'aufruf',
    person: typeof e.person === 'string' && PERSON.test(e.person) ? e.person : null,
    kategorien: kategorien.length ? kategorien : ['allgemein'],
    ...(anzahl !== undefined ? { anzahl } : {}),
    ...(pseudonym ? { pseudonym } : {}),
    ...(e.websuche ? { websuche: true } : {}),
    modell: typeof e.modell === 'string' && KENNWORT.test(e.modell) ? e.modell : 'unbekannt',
    ergebnis: e.ergebnis === 'gesperrt' || e.ergebnis === 'fehler' ? e.ergebnis : 'ok',
    ...(typeof e.grund === 'string' && KENNWORT.test(e.grund) ? { grund: e.grund } : {}),
  };
}

let bereinigtAm = '';

/** Ältere Monate als die Aufbewahrung leeren (einmal je Tag und Prozess). Prüft die 24 Monate davor. */
export async function kiProtokollBereinigen(jetzt = new Date()): Promise<number> {
  const tag = jetzt.toISOString().slice(0, 10);
  if (bereinigtAm === tag) return 0;
  bereinigtAm = tag;
  const alt = letzteMonate(KI_PROTOKOLL_MONATE + 24, jetzt).slice(KI_PROTOKOLL_MONATE);
  let n = 0;
  for (const m of alt) {
    const d = await loadJson<KiProtokollDatei>(protokollMonatName(m)).catch(() => null);
    if (!d?.eintraege?.length) continue;
    n += d.eintraege.length;
    await updateJson<KiProtokollDatei>(protokollMonatName(m), cur => ({ eintraege: [], bereinigt: { am: jetzt.toISOString(), eintraege: cur?.eintraege?.length ?? 0, grund: `Aufbewahrung ${KI_PROTOKOLL_MONATE} Monate` } }));
  }
  return n;
}

/** Eine Zeile schreiben. Wirft nie. */
export async function kiProtokollieren(e: Omit<KiProtokollEintrag, 'at'> & { at?: string }): Promise<void> {
  try {
    const z = eintragSaeubern(e);
    await updateJson<KiProtokollDatei>(protokollMonatName(monatVon(new Date(z.at))), cur => {
      const liste = Array.isArray(cur?.eintraege) ? cur.eintraege : [];
      if (liste.length >= KI_PROTOKOLL_MAX) return { ...(cur ?? { eintraege: liste }), eintraege: liste, ueberlauf: (cur?.ueberlauf ?? 0) + 1 };
      return { ...(cur ?? {}), eintraege: [...liste, z] };
    });
    void kiProtokollBereinigen().catch(() => undefined);
  } catch { /* das Protokoll darf nie eine Antwort verhindern */ }
}

/** Lesen: je Person nur die eigenen Zeilen; `mitSystem` (Inhaber) zusätzlich die Systemläufe ohne Person. */
export async function kiProtokollLesen(opt: { person: string; mitSystem?: boolean; monate?: number; jetzt?: Date }): Promise<KiProtokollEintrag[]> {
  const monate = letzteMonate(Math.min(Math.max(opt.monate ?? 3, 1), KI_PROTOKOLL_MONATE), opt.jetzt);
  const raus: KiProtokollEintrag[] = [];
  for (const m of monate) {
    const d = await loadJson<KiProtokollDatei>(protokollMonatName(m)).catch(() => null);
    for (const e of d?.eintraege ?? []) if (e.person === opt.person || (opt.mitSystem && e.person === null)) raus.push(e);
  }
  return raus.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Art.-15-Zusammenfassung (Empfänger): für eine Konto-Person je Kategorie Zahl der Aufrufe, erster/letzter Zeitpunkt,
 * ob pseudonymisiert. Für Kontakte (CRM) die Aufrufe der Kategorie `crm` aller Personen — Kontakte stehen nie einzeln
 * im Protokoll (keine Kennungen), deshalb nur als Kategorie mit Zeitraum.
 */
export interface KiEmpfaengerAuskunft {
  empfaenger: string;
  zeitraumMonate: number;
  kategorien: { kategorie: KiKategorie; aufrufe: number; pseudonymisiert: number; erster: string | null; letzter: string | null }[];
  gesperrt: number;
  hinweis: string;
}
export function empfaengerAuskunft(zeilen: readonly KiProtokollEintrag[], nurKategorie?: KiKategorie): KiEmpfaengerAuskunft {
  const je = new Map<KiKategorie, { aufrufe: number; pseudonymisiert: number; erster: string | null; letzter: string | null }>();
  let gesperrt = 0;
  for (const z of zeilen) {
    if (z.ergebnis === 'gesperrt') { gesperrt++; continue; }
    for (const k of z.kategorien) {
      if (nurKategorie && k !== nurKategorie) continue;
      const x = je.get(k) ?? { aufrufe: 0, pseudonymisiert: 0, erster: null, letzter: null };
      x.aufrufe++; if (z.pseudonym) x.pseudonymisiert++;
      if (!x.erster || z.at < x.erster) x.erster = z.at;
      if (!x.letzter || z.at > x.letzter) x.letzter = z.at;
      je.set(k, x);
    }
  }
  return {
    empfaenger: KI_EMPFAENGER,
    zeitraumMonate: KI_PROTOKOLL_MONATE,
    kategorien: Array.from(je.entries()).map(([kategorie, x]) => ({ kategorie, ...x })).sort((a, b) => b.aufrufe - a.aufrufe),
    gesperrt,
    hinweis: 'Aus dem KI-Protokoll (nur Metadaten, keine Inhalte; Aufbewahrung 12 Monate). Gesperrte Aufrufe haben nichts übermittelt.',
  };
}

/** Für die Kontakt-Auskunft (Art. 15, CRM): Aufrufe mit Kategorie „crm“ in der Aufbewahrung — ohne Personenbezug je Zeile. */
export async function kiEmpfaengerFuerKontakte(jetzt = new Date()): Promise<KiEmpfaengerAuskunft> {
  const zeilen: KiProtokollEintrag[] = [];
  for (const m of letzteMonate(KI_PROTOKOLL_MONATE, jetzt)) {
    const d = await loadJson<KiProtokollDatei>(protokollMonatName(m)).catch(() => null);
    zeilen.push(...(d?.eintraege ?? []));
  }
  return empfaengerAuskunft(zeilen, 'crm');
}
