// ─── Business-Index — Punkte, Säulen, Gesamt ────────────────────────────────
// Rechnet über den gemeinsamen Kern (lib/kennzahlen/kern.ts, auch für den
// Privat-Index): Kennzahl → 0–100 über ihre Schwellen (rot 20 · grün 100 ·
// linear), Säule ab 40 % Abdeckung, Gesamt 50/30/20 arithmetisch — wie der
// KSI (Briefing A.1). Eigene Schwellen der Sicht gehen vor.

import { SAEULEN, kennzahlenFuer } from './register';
import { MESSEN, type Bestand } from './messen';
import { berechneModell, type IndexErgebnis } from '@/lib/kennzahlen/kern';

export { punkte, ampel, indexLabel, MIN_ABDECKUNG } from '@/lib/kennzahlen/kern';
export type { Ampel, KennzahlStand, SaeulenStand, Detail } from '@/lib/kennzahlen/kern';
export type BusinessIndex = IndexErgebnis;

export function berechne(b: Bestand): BusinessIndex {
  return berechneModell({ saeulen: SAEULEN, kennzahlen: kennzahlenFuer(b.scope), messen: MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.scope });
}
