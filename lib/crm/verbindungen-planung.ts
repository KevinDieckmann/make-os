// ─── Markttraktion · Verbindungsprüfung: Mandat an Zielen und Zeit (rein, 28.09.) ─
// Kevin: „Mandat an Zielen und Zeit.“ Ziele, Meilensteine und Fokus-Blöcke tragen
// im Business optional `mandatId`/`firmaId` (lib/planung/mandat.ts). Der Schreibweg
// prüft nur die Form der Kennungen — ob Mandat und Firma (noch) existieren, prüft
// hier die Verbindungsprüfung (eingehängt in lib/crm/verbindungen.ts):
//   ziel-mandat-tot · meilenstein-mandat-tot · zeit-mandat-tot
// Reparieren = den toten Bezug entfernen (nur die Kennung, die ins Leere zeigt);
// Ziel, Meilenstein, Block, Sekunden und Einheit bleiben. Zweimal angewandt ändert
// sich nichts mehr.
//
// Löschen eines Mandats oder einer Firma: bewusst KEINE Löschsperre in
// lib/crm/crm-stand.ts `loeschSperren` — das hieße, im CRM-Schreibweg Ziele,
// Meilensteine und die Zeit aller Personen zu lesen, und Zeit soll ein Mandat
// nicht festhalten. Stattdessen meldet diese Prüfung die Reste; die Zeit zählt in
// der Auswertung als „Mandat (gelöscht)“ weiter (lib/zeitmessung/mandate.ts).

import { ZIEL_HORIZONTE } from '@/lib/planung/typen';
import type { FokusBlock, ZeitDatei } from '@/lib/zeitmessung/modell';

/** Ein Eintrag, soweit die Prüfung ihn braucht: Kennung und Bezug — nie Titel oder Inhalte. */
export interface PlanungBezug { id: string; mandatId?: string; firmaId?: string }
export interface PlanungBestand {
  /** Ziele je Speicher (`ziele` = gemeinsam, `ziele-eigen…` je Person). */
  ziele: { speicher: string; ziele: PlanungBezug[] }[];
  meilensteine: PlanungBezug[];
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

/** Die drei Prüfungen — werden in `PRUEFUNGEN` (lib/crm/verbindungen.ts) eingemischt. */
export const PRUEFUNGEN_PLANUNG = {
  'ziel-mandat-tot': { schwere: 'warnung', bereich: 'planung', reparierbar: true, art: 'kennung', knopf: 'Bezug entfernen', text: (n: number) => `${n} ${e(n, 'Ziel zeigt', 'Ziele zeigen')} auf ein Mandat oder eine Firma, die es nicht mehr gibt — „Bezug entfernen“ nimmt den toten Verweis weg (Ziel und Einheit bleiben).` },
  'meilenstein-mandat-tot': { schwere: 'warnung', bereich: 'planung', reparierbar: true, art: 'kennung', knopf: 'Bezug entfernen', text: (n: number) => `${n} ${e(n, 'Meilenstein zeigt', 'Meilensteine zeigen')} auf ein Mandat oder eine Firma, die es nicht mehr gibt — „Bezug entfernen“ nimmt den toten Verweis weg.` },
  'zeit-mandat-tot': { schwere: 'warnung', bereich: 'zeit', reparierbar: true, art: 'kennung', knopf: 'Bezug entfernen', text: (n: number) => `${n} gelöschte ${e(n, 'Mandat oder Firma hängt', 'Mandate oder Firmen hängen')} noch an Fokus-Blöcken — die Zeit zählt als „Mandat (gelöscht)“; „Bezug entfernen“ macht daraus Zeit ohne Mandat (Einheit bleibt).` },
} as const;
export type PlanungPruefungId = keyof typeof PRUEFUNGEN_PLANUNG;

interface Lebend { mandate: ReadonlySet<string>; firmen: ReadonlySet<string> }

/** Zeigt der Bezug ins Leere? */
export const bezugTot = (x: { mandatId?: string; firmaId?: string }, l: Lebend): boolean =>
  (!!x.mandatId && !l.mandate.has(x.mandatId)) || (!!x.firmaId && !l.firmen.has(x.firmaId));

/** Die toten Kennungen eines Bezugs (Mandat, Firma). */
const toteKennungen = (x: { mandatId?: string; firmaId?: string }, l: Lebend): string[] =>
  [x.mandatId && !l.mandate.has(x.mandatId) ? x.mandatId : '', x.firmaId && !l.firmen.has(x.firmaId) ? x.firmaId : ''].filter(Boolean);

/** Nur die toten Kennungen entfernen — ist nichts tot, kommt derselbe Eintrag zurück. */
export function bezugBereinigen<T extends { mandatId?: string; firmaId?: string }>(x: T, l: Lebend): T {
  if (!bezugTot(x, l)) return x;
  const aus = { ...x };
  if (aus.mandatId && !l.mandate.has(aus.mandatId)) delete aus.mandatId;
  if (aus.firmaId && !l.firmen.has(aus.firmaId)) delete aus.firmaId;
  return aus;
}

/**
 * Die Prüfung: Beispiele sind Kennungen der Ziele/Meilensteine bzw. (bei Fokus-Blöcken, die keine eigene Kennung
 * haben) die toten Mandats-/Firmen-Kennungen — wie bei `fokus-aufgabe-tot`.
 */
export function planungPruefen(
  b: { planung?: PlanungBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null },
  l: Lebend,
  melde: (id: PlanungPruefungId, kennung: string) => void,
): void {
  if (b.planung) {
    for (const s of b.planung.ziele ?? []) for (const z of s.ziele ?? []) if (bezugTot(z, l)) melde('ziel-mandat-tot', z.id);
    for (const m of b.planung.meilensteine ?? []) if (bezugTot(m, l)) melde('meilenstein-mandat-tot', m.id);
  }
  for (const p of b.fokus ?? []) for (const bl of p.bloecke ?? []) for (const k of toteKennungen(bl, l)) melde('zeit-mandat-tot', k);
}

export interface PlanungAenderung { befundId: PlanungPruefungId; speicher: 'ziele' | 'meilensteine' | 'zeit'; anzahl: number; text: string }

/** Reparieren (rein): tote Bezüge entfernen — in den gewählten Befunden, sonst unverändert. */
export function planungReparieren<P extends { planung?: PlanungBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null }>(
  b: P, will: ReadonlySet<string>, l: Lebend,
): { aenderungen: PlanungAenderung[]; planung: P['planung']; fokus: P['fokus'] } {
  const aenderungen: PlanungAenderung[] = [];
  let planung = b.planung;
  if (planung && will.has('ziel-mandat-tot')) {
    let n = 0;
    const ziele = planung.ziele.map(s => ({ ...s, ziele: s.ziele.map(z => { const x = bezugBereinigen(z, l); if (x !== z) n++; return x; }) }));
    if (n) { planung = { ...planung, ziele }; aenderungen.push({ befundId: 'ziel-mandat-tot', speicher: 'ziele', anzahl: n, text: `${n} ${e(n, 'Ziel', 'Ziele')}: toten Mandats-/Firmen-Bezug entfernt` }); }
  }
  if (planung && will.has('meilenstein-mandat-tot')) {
    let n = 0;
    const meilensteine = planung.meilensteine.map(m => { const x = bezugBereinigen(m, l); if (x !== m) n++; return x; });
    if (n) { planung = { ...planung, meilensteine }; aenderungen.push({ befundId: 'meilenstein-mandat-tot', speicher: 'meilensteine', anzahl: n, text: `${n} ${e(n, 'Meilenstein', 'Meilensteine')}: toten Mandats-/Firmen-Bezug entfernt` }); }
  }
  let fokus = b.fokus;
  if (fokus && will.has('zeit-mandat-tot')) {
    let n = 0;
    const neu = fokus.map(p => ({ ...p, bloecke: p.bloecke.map(bl => { const x = bezugBereinigen(bl, l); if (x !== bl) n++; return x; }) }));
    if (n) { fokus = neu; aenderungen.push({ befundId: 'zeit-mandat-tot', speicher: 'zeit', anzahl: n, text: `${n} Fokus-${e(n, 'Block', 'Blöcke')}: toten Mandats-/Firmen-Bezug entfernt (Zeit und Einheit bleiben)` }); }
  }
  return { aenderungen, planung, fokus };
}

// ── Für den Schreibweg der Route (ganze Dateien) ────────────────────────────

/** Eine Ziele-Datei ({ tag, woche, …, fokus }) bereinigen — andere Felder bleiben unberührt. */
export function zieleDateiBereinigen<T extends Record<string, unknown>>(d: T, l: Lebend): { datei: T; anzahl: number } {
  let anzahl = 0;
  const aus: Record<string, unknown> = { ...d };
  for (const h of ZIEL_HORIZONTE) {
    const liste = d[h];
    if (!Array.isArray(liste)) continue;
    aus[h] = liste.map(z => { if (!z || typeof z !== 'object') return z; const x = bezugBereinigen(z as PlanungBezug, l); if (x !== z) anzahl++; return x; });
  }
  return { datei: (anzahl ? aus : d) as T, anzahl };
}

/** Eine Meilenstein-Datei ({ meilensteine }) bereinigen. */
export function meilensteinDateiBereinigen<T extends { meilensteine?: unknown }>(d: T, l: Lebend): { datei: T; anzahl: number } {
  if (!Array.isArray(d.meilensteine)) return { datei: d, anzahl: 0 };
  let anzahl = 0;
  const meilensteine = d.meilensteine.map(m => { if (!m || typeof m !== 'object') return m; const x = bezugBereinigen(m as PlanungBezug, l); if (x !== m) anzahl++; return x; });
  return { datei: anzahl ? { ...d, meilensteine } : d, anzahl };
}

/** Die Zeit-Datei einer Person bereinigen — Sekunden und Summen bleiben unverändert. */
export function zeitDateiBereinigen(d: ZeitDatei, l: Lebend): { datei: ZeitDatei; anzahl: number } {
  let anzahl = 0;
  const tage: ZeitDatei['tage'] = {};
  for (const [tag, t] of Object.entries(d.tage ?? {})) {
    const bloecke = (t.bloecke ?? []).map(bl => { const x = bezugBereinigen(bl, l); if (x !== bl) anzahl++; return x; });
    tage[tag] = anzahl && bloecke.some((x, i) => x !== t.bloecke[i]) ? { ...t, bloecke } : t;
  }
  return { datei: anzahl ? { ...d, tage } : d, anzahl };
}
