// ─── Sport · Hyrox: Stationen, Splits aus der Zielzeit, Schwächen ───────────
// Die 8 Stationen und 8 × 1 km Lauf. Anteile je Station an der Gesamtzeit sind
// Erfahrungswerte für ambitionierte Breitensportler (Roxzone = Wege zwischen den
// Stationen) — ein Vorschlag als Startpunkt, den die eigenen Zeiten dann ablösen.

import type { HyroxEinheit, StationId } from './modell';
import { STATION_IDS } from './modell';

export interface Station { id: StationId; name: string; umfang: string; anteil: number }

export const STATIONEN: Station[] = [
  { id: 'skierg', name: 'SkiErg', umfang: '1000 m', anteil: 0.054 },
  { id: 'sledPush', name: 'Sled Push', umfang: '50 m', anteil: 0.042 },
  { id: 'sledPull', name: 'Sled Pull', umfang: '50 m', anteil: 0.054 },
  { id: 'bbj', name: 'Burpee Broad Jumps', umfang: '80 m', anteil: 0.062 },
  { id: 'rudern', name: 'Rudern', umfang: '1000 m', anteil: 0.058 },
  { id: 'farmers', name: 'Farmers Carry', umfang: '200 m', anteil: 0.026 },
  { id: 'lunges', name: 'Sandbag Lunges', umfang: '100 m', anteil: 0.054 },
  { id: 'wallballs', name: 'Wall Balls', umfang: '100 Wdh', anteil: 0.070 },
];
/** Anteil der 8 Läufe zusammen (je 1 km) und der Roxzone an der Gesamtzeit. */
export const LAUF_ANTEIL = 0.52;
export const ROXZONE_ANTEIL = 0.06;
export const LAEUFE = 8;

export interface Splits { stationen: Record<StationId, number>; laufJeKm: number; laeufeGesamt: number; roxzone: number; gesamt: number }

/** Zielzeit → Zeit je Station, je Lauf-Kilometer und Roxzone (alles in Sekunden). */
export function splitsAusZielzeit(zielSek: number): Splits {
  const stationen = {} as Record<StationId, number>;
  for (const s of STATIONEN) stationen[s.id] = Math.round(zielSek * s.anteil);
  const laeufeGesamt = Math.round(zielSek * LAUF_ANTEIL);
  return { stationen, laufJeKm: Math.round(laeufeGesamt / LAEUFE), laeufeGesamt, roxzone: Math.round(zielSek * ROXZONE_ANTEIL), gesamt: zielSek };
}

/** Summe der gemessenen Teile einer Einheit — `gesamtSek` gewinnt, wenn eingetragen. */
export function gesamtAus(e: HyroxEinheit): number | null {
  if (e.gesamtSek) return e.gesamtSek;
  const st = STATION_IDS.reduce((s, id) => s + (e.stationen[id] ?? 0), 0);
  const la = e.laeufe.reduce((s, v) => s + v, 0);
  const summe = st + la;
  return summe > 0 ? summe : null;
}

/** Ist die Einheit komplett (alle 8 Stationen und 8 Läufe gemessen)? */
export function vollstaendig(e: HyroxEinheit): boolean {
  return STATION_IDS.every(id => e.stationen[id]) && e.laeufe.length === LAEUFE;
}

export interface Schwaeche { id: StationId | 'lauf'; name: string; ist: number; soll: number; deltaSek: number; deltaProzent: number }

/**
 * Schwächen: welche Station kostet am meisten gegen die Ziel-Splits. Nur gemessene
 * Stationen; Läufe als Mittel je Kilometer. Sortiert: teuerste zuerst.
 */
export function schwaechen(e: HyroxEinheit, ziel: Splits): Schwaeche[] {
  const r: Schwaeche[] = [];
  for (const s of STATIONEN) {
    const ist = e.stationen[s.id];
    if (!ist) continue;
    const soll = ziel.stationen[s.id];
    r.push({ id: s.id, name: s.name, ist, soll, deltaSek: ist - soll, deltaProzent: Math.round(((ist - soll) / soll) * 100) });
  }
  if (e.laeufe.length) {
    const mittel = Math.round(e.laeufe.reduce((a, b) => a + b, 0) / e.laeufe.length);
    r.push({ id: 'lauf', name: 'Lauf je km', ist: mittel, soll: ziel.laufJeKm, deltaSek: mittel - ziel.laufJeKm, deltaProzent: Math.round(((mittel - ziel.laufJeKm) / ziel.laufJeKm) * 100) });
  }
  return r.sort((a, b) => b.deltaSek - a.deltaSek);
}

/** Beste Zeit je Station über alle Einheiten (Wettkampf, Simulation, Training). */
export function bestesJeStation(einheiten: HyroxEinheit[]): Partial<Record<StationId | 'lauf', { sek: number; datum: string }>> {
  const r: Partial<Record<StationId | 'lauf', { sek: number; datum: string }>> = {};
  for (const e of einheiten) {
    for (const id of STATION_IDS) { const v = e.stationen[id]; if (v && (!r[id] || v < r[id]!.sek)) r[id] = { sek: v, datum: e.datum }; }
    for (const v of e.laeufe) if (v && (!r.lauf || v < r.lauf.sek)) r.lauf = { sek: v, datum: e.datum };
  }
  return r;
}

/**
 * „Wettkampf aus Bestzeiten“: Summe der besten Stationen + 8 × bester Lauf + Roxzone laut Anteil.
 * Null, solange nicht alle Stationen und ein Lauf gemessen sind.
 */
export function bestzeitPrognose(einheiten: HyroxEinheit[]): number | null {
  const b = bestesJeStation(einheiten);
  if (!STATION_IDS.every(id => b[id]) || !b.lauf) return null;
  const kern = STATION_IDS.reduce((s, id) => s + b[id]!.sek, 0) + b.lauf.sek * LAEUFE;
  return Math.round(kern / (1 - ROXZONE_ANTEIL));
}
