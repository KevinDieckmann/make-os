// ─── MAKE OS — „Neu anfangen“: Ziele und Meilensteine herausnehmen und zurückholen (rein, 29.09.) ─────
// Kevin 29.09.: „Morgen alle Ziele und Aufgaben rausnehmen und neu planen.“ Ziele und Meilensteine lesen viele Stellen
// (Wachstum, Indizes, Kalender, Brain, ZOE) — deshalb wandern sie beim Neustart aus ihren Beständen in das Archiv des
// Laufs (lib/aufgaben/neustart-server.ts, Bestand `planung-neustart--<haushalt>`), statt nur markiert zu werden: kein
// Leser muss etwas lernen. Zurückholen legt sie unverändert wieder hinein (ganz oder einzeln, eine schon vorhandene
// Kennung wird nie überschrieben). Routinen und Wochen-Blöcke bleiben (Kevin: „nur Ziele, keine Routinen“).
// Zum Ziele-Bestand gehört der Fokus-Satz je Horizont/Space — er geht mit und kommt nur in LEERE Plätze zurück.

import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZielHorizont, type ZieleDatei } from './typen';

/** Ein herausgenommenes Ziel: aus welchem Bestand (geteilt `ziele` oder persönlich) und welchem Horizont. */
export interface ArchivZiel { speicher: string; horizont: ZielHorizont; ziel: Ziel; zurueckAm?: string }
export interface ArchivMeilenstein { meilenstein: Meilenstein; zurueckAm?: string }
export interface ArchivFokus { speicher: string; fokus: Record<string, string>; zurueckAm?: string }

const LEER = (): ZieleDatei => ({ tag: [], woche: [], monat: [], quartal: [], jahr: [], fokus: {} });

/** Einen Ziele-Bestand lesen, wie ihn die Route liest (fehlende Horizonte = leer). Andere Felder bleiben erhalten. */
export function zieleDatei(roh: unknown): ZieleDatei & Record<string, unknown> {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const aus = { ...r, ...LEER() } as ZieleDatei & Record<string, unknown>;
  for (const h of ZIEL_HORIZONTE) aus[h] = Array.isArray(r[h]) ? (r[h] as Ziel[]) : [];
  aus.fokus = r.fokus && typeof r.fokus === 'object' ? { ...(r.fokus as Record<string, string>) } : {};
  return aus;
}

/** Wie viele Ziele liegen im Bestand? */
export const zieleZahl = (roh: unknown): number => { const d = zieleDatei(roh); return ZIEL_HORIZONTE.reduce((n, h) => n + d[h].length, 0); };
const fokusGesetzt = (f: Record<string, string> | undefined) => Object.entries(f ?? {}).filter(([, v]) => typeof v === 'string' && v.trim());

/** Alle Ziele (und den Fokus) herausnehmen. Liefert den leeren Rest und was ins Archiv geht. */
export function zieleHerausnehmen(roh: unknown, speicher: string): { rest: ZieleDatei & Record<string, unknown>; ziele: ArchivZiel[]; fokus: ArchivFokus | null } {
  const d = zieleDatei(roh);
  const ziele: ArchivZiel[] = [];
  for (const h of ZIEL_HORIZONTE) for (const z of d[h]) ziele.push({ speicher, horizont: h, ziel: z });
  const f = fokusGesetzt(d.fokus);
  const rest = { ...d };
  for (const h of ZIEL_HORIZONTE) rest[h] = [];
  rest.fokus = {};
  return { rest, ziele, fokus: f.length ? { speicher, fokus: Object.fromEntries(f) } : null };
}

/**
 * Ziele zurücklegen (nur die dieses Bestands). Eine Kennung, die es inzwischen gibt, bleibt unangetastet (`schon`).
 * Reihenfolge: hinter das, was inzwischen neu angelegt wurde. Fokus nur in leere Plätze.
 */
export function zieleZurueck(roh: unknown, eintraege: readonly ArchivZiel[], fokus?: ArchivFokus | null): { datei: ZieleDatei & Record<string, unknown>; zurueck: string[]; schon: string[]; fokusZurueck: boolean } {
  const d = zieleDatei(roh);
  const zurueck: string[] = [], schon: string[] = [];
  for (const h of ZIEL_HORIZONTE) {
    const da = new Set(d[h].map(z => z.id));
    const neu = eintraege.filter(e => e.horizont === h);
    for (const e of neu) {
      if (da.has(e.ziel.id)) { schon.push(e.ziel.id); continue; }
      d[h] = [...d[h], e.ziel];
      da.add(e.ziel.id);
      zurueck.push(e.ziel.id);
    }
  }
  let fokusZurueck = false;
  if (fokus) {
    const f = { ...(d.fokus ?? {}) };
    for (const [k, v] of Object.entries(fokus.fokus)) if (!f[k]?.trim()) { f[k] = v; fokusZurueck = true; }
    d.fokus = f;
  }
  return { datei: d, zurueck, schon, fokusZurueck };
}

/** Meilenstein-Bestand `{ meilensteine: [] }` — andere Felder bleiben. */
export function meilensteineDatei(roh: unknown): { meilensteine: Meilenstein[] } & Record<string, unknown> {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  return { ...r, meilensteine: Array.isArray(r.meilensteine) ? (r.meilensteine as Meilenstein[]) : [] };
}

export function meilensteineHerausnehmen(roh: unknown): { rest: { meilensteine: Meilenstein[] } & Record<string, unknown>; raus: ArchivMeilenstein[] } {
  const d = meilensteineDatei(roh);
  return { rest: { ...d, meilensteine: [] }, raus: d.meilensteine.map(m => ({ meilenstein: m })) };
}

export function meilensteineZurueck(roh: unknown, eintraege: readonly ArchivMeilenstein[]): { datei: { meilensteine: Meilenstein[] } & Record<string, unknown>; zurueck: string[]; schon: string[] } {
  const d = meilensteineDatei(roh);
  const da = new Set(d.meilensteine.map(m => m.id));
  const zurueck: string[] = [], schon: string[] = [];
  const liste = [...d.meilensteine];
  for (const e of eintraege) {
    if (da.has(e.meilenstein.id)) { schon.push(e.meilenstein.id); continue; }
    liste.push(e.meilenstein); da.add(e.meilenstein.id); zurueck.push(e.meilenstein.id);
  }
  return { datei: { ...d, meilensteine: liste }, zurueck, schon };
}
