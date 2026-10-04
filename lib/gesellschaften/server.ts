// ─── MAKE OS — Gesellschafts-Register: Lesen und Schreiben (Server, 04.10.) ──────────────────────────────────────
// EINE Schreibstelle für den Speicher `gesellschaften--<haushalt>` — die Register-Route (/api/gesellschaften) und die
// Absender-Route (/api/crm/gesellschaften) schreiben beide hierüber: eine Sperre, ein Stand (Fingerabdruck des ganzen
// Eintrags), ein Protokoll. Regeln rein in ./modell.ts.
// Zugang entscheidet die Route (Haushalt des Inhabers + Person mit Haushalt); hier wird nur noch je Haushalt gelesen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { gesellschaftenName } from '@/lib/crm/gesellschaften';
import { istGesellschaft, type GesellschaftId } from '@/lib/einheiten';
import { inPapierkorb, ausPapierkorb, imPapierkorb } from '@/lib/eintraege/sicher';
import {
  alleGesellschaften, gesellschaftVon, steckbriefAnwenden, gesellschafterSaeubern, beteiligungSaeubern, vertragSaeubern,
  eintragAktion, gesellschaftArchiv, gesellschaftVerweise, verweiseAnzahl, verweiseSatz, registerAufraeumen, GRENZEN, PRAEFIX,
  type RegisterDatei, type RegisterGesellschaft, type RegisterFehler, type RegisterListe, type EintragAktion, type CrmVerweisTeil,
  type Gesellschafter, type FremdBeteiligung, type Vertrag,
} from './modell';

export const registerName = gesellschaftenName;
export const standVon = (g: RegisterGesellschaft) => fingerabdruck(g as unknown as Record<string, unknown>);

export async function ladeRegister(haushalt: string): Promise<RegisterDatei | null> {
  return loadJson<RegisterDatei>(registerName(haushalt));
}

/** Nur die Felder, die Deals/Mandate/Produkte für die Verweis-Prüfung brauchen (ohne Personendaten). */
export async function crmVerweisTeil(): Promise<CrmVerweisTeil> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const c = await ladeCrm().catch(() => null);
  return { chancen: c?.chancen ?? [], mandate: c?.mandate ?? [], leistungen: c?.leistungen ?? [] };
}

export interface Ergebnis { g?: RegisterGesellschaft; konflikt?: RegisterGesellschaft; fehler?: RegisterFehler[]; status?: number; weg?: true }
/** Was eine Änderung tun will: neuer Eintrag, `null` = endgültig entfernen, oder Fehler (mit Status, Standard 400). */
export type Aenderung = (alt: RegisterGesellschaft, alle: RegisterGesellschaft[]) => { g?: RegisterGesellschaft | null; fehler?: RegisterFehler[]; status?: number };

/**
 * Einen Eintrag ändern — in EINER Sperre, mit Stand (409 + aktueller Eintrag bei veraltetem Stand). Unbekannte Kennung → 404.
 * Andere Einträge und unbekannte Felder bleiben, wie sie sind (Rückweg zum Online-Stand).
 */
export async function registerAendern(haushalt: string, person: string, id: string, stand: unknown, wer: Wer, mut: Aenderung): Promise<Ergebnis> {
  let vorher: RegisterDatei | null = null;
  let ergebnis: Ergebnis = {};
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    const alt = gesellschaftVon(cur, id);
    if (!alt) { ergebnis = { fehler: [{ feld: 'id', text: 'Gesellschaft nicht gefunden.' }], status: 404 }; return cur ?? { gesellschaften: [] }; }
    if (typeof stand !== 'string' || standVon(alt) !== stand) { ergebnis = { konflikt: alt }; return cur ?? { gesellschaften: [] }; }
    const r = mut(alt, alleGesellschaften(cur, { mitPapierkorb: true }));
    if (r.fehler?.length) { ergebnis = { fehler: r.fehler, status: r.status ?? 400 }; return cur ?? { gesellschaften: [] }; }
    if (r.g === null) { ergebnis = { weg: true }; return { ...(cur ?? {}), gesellschaften: l.filter(g => g.id !== id) }; }
    const neu: RegisterGesellschaft = { ...r.g!, geaendert: new Date().toISOString(), geaendertVon: person };
    ergebnis = { g: neu };
    const i = l.findIndex(g => g.id === id);
    return { ...(cur ?? {}), gesellschaften: i >= 0 ? l.map(g => (g.id === id ? neu : g)) : [...l, neu] };
  });
  if (ergebnis.g || ergebnis.weg) await protokolliereBestand(registerName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

/** Eine neue Gesellschaft (`g-…`) anlegen — Name Pflicht, weitere Steckbrief-Felder optional. */
export async function registerAnlegen(haushalt: string, person: string, felder: Record<string, unknown>, wer: Wer): Promise<Ergebnis> {
  let vorher: RegisterDatei | null = null;
  let ergebnis: Ergebnis = {};
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    if (l.filter(g => !istGesellschaft(g.id)).length >= GRENZEN.gesellschaften) { ergebnis = { fehler: [{ feld: 'id', text: `Höchstens ${GRENZEN.gesellschaften} weitere Gesellschaften.` }], status: 413 }; return cur ?? { gesellschaften: [] }; }
    const jetzt = new Date().toISOString();
    const leer: RegisterGesellschaft = { id: neueKennung('g') as GesellschaftId, angelegt: jetzt };
    const r = steckbriefAnwenden(leer, { status: 'geplant', ...felder, name: felder.name ?? '' }, alleGesellschaften(cur, { mitPapierkorb: true }));
    if (r.fehler.length) { ergebnis = { fehler: r.fehler, status: 400 }; return cur ?? { gesellschaften: [] }; }
    const neu = { ...r.g, geaendert: jetzt, geaendertVon: person };
    ergebnis = { g: neu };
    return { ...(cur ?? {}), gesellschaften: [...l, neu] };
  });
  if (ergebnis.g) await protokolliereBestand(registerName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

// ── Änderungen als reine Bausteine (die Route setzt sie zusammen) ────────────────────────────────────────────────

export const steckbrief = (felder: Record<string, unknown>): Aenderung => (alt, alle) => {
  const r = steckbriefAnwenden(alt, felder, alle);
  return r.fehler.length ? { fehler: r.fehler } : { g: r.g };
};

type Eintrag = Gesellschafter | FremdBeteiligung | Vertrag;

/** Einen Listeneintrag anlegen (ohne `eintragId`, Kennung vom Server) oder ändern. */
export const eintragSchreiben = (liste: RegisterListe, roh: unknown, eintragId?: string): Aenderung => alt => {
  const l = (alt[liste] ?? []) as Eintrag[];
  const vorhanden = eintragId ? l.find(e => e.id === eintragId) : undefined;
  if (eintragId && !vorhanden) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  if (!vorhanden && l.length >= GRENZEN[liste]) return { fehler: [{ feld: liste, text: `Höchstens ${GRENZEN[liste]} Einträge.` }], status: 413 };
  const mitId = vorhanden ? roh : { ...((roh && typeof roh === 'object' ? roh : {}) as object), id: neueKennung(PRAEFIX[liste]) };
  const r = liste === 'gesellschafter' ? gesellschafterSaeubern(mitId, alt.id, vorhanden as Gesellschafter | undefined)
    : liste === 'beteiligungen' ? beteiligungSaeubern(mitId, vorhanden as FremdBeteiligung | undefined)
      : vertragSaeubern(mitId, vorhanden as Vertrag | undefined);
  if (r.fehler.length || !r.e) return { fehler: r.fehler };
  const neu = vorhanden ? l.map(e => (e.id === vorhanden.id ? r.e! : e)) : [...l, r.e];
  return { g: { ...alt, [liste]: neu } };
};

/** Archivieren/Zurückholen/Papierkorb/Wiederherstellen eines Listeneintrags; `endgueltig` nur aus dem Papierkorb. */
export const eintragHandeln = (liste: RegisterListe, eintragId: string, aktion: EintragAktion | 'endgueltig'): Aenderung => alt => {
  const l = (alt[liste] ?? []) as Eintrag[];
  const e = l.find(x => x.id === eintragId);
  if (!e) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  if (aktion === 'endgueltig') {
    if (!imPapierkorb(e)) return { fehler: [{ feld: 'aktion', text: 'Endgültig löschen geht nur aus dem Papierkorb.' }], status: 409 };
    return { g: { ...alt, [liste]: l.filter(x => x.id !== eintragId) } };
  }
  const neu = eintragAktion(liste, e, aktion, localDay(), new Date().toISOString());
  return { g: { ...alt, [liste]: l.map(x => (x.id === eintragId ? neu : x)) } };
};

/**
 * Die Gesellschaft selbst: archivieren (ruhend/aufgelöst), zurückholen, in den Papierkorb, wiederherstellen, endgültig.
 * Die drei festen Gesellschaften lassen sich nur archivieren (sie kommen aus lib/einheiten.ts). Endgültig nur aus dem
 * Papierkorb und nur ohne Verweise (Deals, Mandate, Produkte, Gesellschafter-/Vertrags-Verweise, Nachfolger) → sonst 409.
 */
export const gesellschaftHandeln = (aktion: EintragAktion | 'endgueltig', crm: CrmVerweisTeil, ziel?: 'ruhend' | 'aufgeloest'): Aenderung => (alt, alle) => {
  if (aktion === 'archivieren' || aktion === 'zurueckholen') return { g: gesellschaftArchiv(alt, aktion, ziel) };
  if (istGesellschaft(alt.id)) return { fehler: [{ feld: 'aktion', text: 'Die drei festen Gesellschaften lassen sich nicht löschen — „ruhend“ oder „aufgelöst“ stellen.' }], status: 409 };
  if (aktion === 'loeschen') return { g: inPapierkorb(alt, new Date().toISOString()) };
  if (aktion === 'wiederherstellen') return { g: ausPapierkorb(alt) };
  if (!imPapierkorb(alt)) return { fehler: [{ feld: 'aktion', text: 'Endgültig löschen geht nur aus dem Papierkorb.' }], status: 409 };
  const v = gesellschaftVerweise(alt.id, alle, crm);
  if (verweiseAnzahl(v)) return { fehler: [{ feld: 'aktion', text: `${verweiseSatz(v)} Erst die Verweise lösen — so lange bleibt sie im Papierkorb.` }], status: 409 };
  return { g: null };
};

/** Morgenlauf-Schritt „Gesellschaften-Papierkorb“: liest erst ohne Sperre, schreibt nur, wenn etwas fällig ist. */
export async function registerPapierkorbAufraeumen(haushalt: string, jetzt = new Date()): Promise<{ eintraege: number }> {
  const iso = jetzt.toISOString();
  const crm = await crmVerweisTeil();
  if (!registerAufraeumen(await ladeRegister(haushalt), crm, iso).n) return { eintraege: 0 };
  let n = 0;
  let vorher: RegisterDatei | null = null;
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const r = registerAufraeumen(cur, crm, iso);
    n = r.n;
    return (r.d ?? cur) as RegisterDatei;
  });
  if (n) await protokolliereBestand(registerName(haushalt), vorher, nachher, { art: 'system' } as Wer);
  return { eintraege: n };
}
