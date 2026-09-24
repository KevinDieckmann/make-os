// ─── Schulden: Laufzeit, Zinsen, Sondertilgung (aus Malins ansicht-schulden.js) ─

import { heuteBerlin, monatVon, monatPlus, monatName } from './monat';

/** Monate bis zur Null, mit Zinsen. Meldet ehrlich, wenn die Rate die Zinsen nicht deckt. Cent. */
export function laufzeit(rest: number, rate: number | null, zinsProzent: number | null): { monate: number | null; zinsen: number | null; grund?: string } {
  const r0 = Number(rest) || 0, ra = Number(rate) || 0;
  const zMon = (Number(zinsProzent) || 0) / 100 / 12;
  if (r0 <= 0) return { monate: 0, zinsen: 0 };
  if (ra <= 0) return { monate: null, zinsen: null, grund: 'Keine Rate hinterlegt' };
  if (r0 * zMon >= ra) return { monate: null, zinsen: null, grund: 'Die Rate deckt nicht einmal die Zinsen' };
  let m = 0, r = r0, zinsen = 0;
  while (r > 0 && m < 1200) { const z = r * zMon; zinsen += z; r = r + z - ra; m++; }
  return { monate: m, zinsen };
}

export function schuldenfreiAm(monate: number | null, heute: string = heuteBerlin()): string {
  if (monate === null || monate === undefined) return '–';
  return monatName(monatPlus(monatVon(heute), monate));
}

/** Was bringt eine Sondertilgung? Monate und Zinsen gegeneinander. */
export function sondertilgung(rest: number, rate: number | null, zins: number | null, betrag: number) {
  const vorher = laufzeit(rest, rate, zins);
  const nachher = laufzeit(Math.max(0, rest - betrag), rate, zins);
  if (vorher.monate === null || nachher.monate === null) return null;
  return { neuRest: Math.max(0, rest - betrag), monateFrueher: vorher.monate - nachher.monate, zinsenGespart: (vorher.zinsen ?? 0) - (nachher.zinsen ?? 0), nachher };
}
