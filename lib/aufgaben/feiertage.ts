// ─── MAKE OS — Gesetzliche Feiertage NRW + Werktage (rein, 29.09.) ──────────
// Kevin 29.09.: „Feiertage NRW für Werktage/Fristen.“ Reine Kalenderrechnung ohne Netz und ohne Uhr der Maschine:
//   · Ostersonntag nach Gauß (gregorianisch, mit den Ausnahmen für den 26. und 25. April).
//   · NRW: Neujahr, Karfreitag, Ostermontag, Tag der Arbeit, Christi Himmelfahrt, Pfingstmontag, Fronleichnam,
//     Tag der Deutschen Einheit, Allerheiligen, 1. und 2. Weihnachtstag. (Heiligabend/Silvester sind keine gesetzlichen.)
//   · Werktag = Montag bis Freitag und kein gesetzlicher Feiertag in NRW.
// Tage als „YYYY-MM-DD“, gerechnet über UTC-Mittag (wie lib/aufgaben/wiederholung.ts). Tests: tests/aufgaben-feiertage.test.ts.

export type FeiertagLand = 'NRW';
export interface Feiertag { tag: string; name: string }

const zwei = (n: number) => String(n).padStart(2, '0');
const tagAus = (j: number, m: number, t: number) => `${String(j).padStart(4, '0')}-${zwei(m)}-${zwei(t)}`;
const plus = (tag: string, n: number): string => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Ostersonntag eines Jahres (Gaußsche Osterformel, gregorianisch). */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19;
  const k = Math.floor(jahr / 100);
  const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25);
  const s = 2 - Math.floor((3 * k + 3) / 4);
  const d = (19 * a + m) % 30;
  const r = Math.floor((d + Math.floor(a / 11)) / 29);
  const og = 21 + d - r;
  const sz = 7 - ((jahr + Math.floor(jahr / 4) + s) % 7);
  const oe = 7 - ((og - sz) % 7);
  const os = og + oe; // Tag im März (32 = 1. April)
  return os <= 31 ? tagAus(jahr, 3, os) : tagAus(jahr, 4, os - 31);
}

const zwischenspeicher = new Map<number, Feiertag[]>();

/** Die gesetzlichen Feiertage in NRW eines Jahres, nach Datum. */
export function feiertageNRW(jahr: number): Feiertag[] {
  const da = zwischenspeicher.get(jahr);
  if (da) return da;
  const o = ostersonntag(jahr);
  const liste: Feiertag[] = [
    { tag: tagAus(jahr, 1, 1), name: 'Neujahr' },
    { tag: plus(o, -2), name: 'Karfreitag' },
    { tag: plus(o, 1), name: 'Ostermontag' },
    { tag: tagAus(jahr, 5, 1), name: 'Tag der Arbeit' },
    { tag: plus(o, 39), name: 'Christi Himmelfahrt' },
    { tag: plus(o, 50), name: 'Pfingstmontag' },
    { tag: plus(o, 60), name: 'Fronleichnam' },
    { tag: tagAus(jahr, 10, 3), name: 'Tag der Deutschen Einheit' },
    { tag: tagAus(jahr, 11, 1), name: 'Allerheiligen' },
    { tag: tagAus(jahr, 12, 25), name: '1. Weihnachtstag' },
    { tag: tagAus(jahr, 12, 26), name: '2. Weihnachtstag' },
  ].sort((a, b) => a.tag.localeCompare(b.tag));
  zwischenspeicher.set(jahr, liste);
  return liste;
}

/** Name des Feiertags an diesem Tag (NRW) — oder undefined. */
export function feiertag(tag: string, _land: FeiertagLand = 'NRW'): string | undefined {
  const j = Number(tag.slice(0, 4));
  if (!Number.isInteger(j) || j < 1583) return undefined;
  return feiertageNRW(j).find(f => f.tag === tag)?.name;
}

export const istFeiertag = (tag: string, land: FeiertagLand = 'NRW'): boolean => feiertag(tag, land) !== undefined;

const wochentag = (tag: string): number => new Date(`${tag}T12:00:00Z`).getUTCDay();
/** Wochenende (Samstag/Sonntag)? */
export const istWochenende = (tag: string): boolean => { const w = wochentag(tag); return w === 0 || w === 6; };

/** Werktag: Montag bis Freitag und (mit Land) kein gesetzlicher Feiertag. */
export function istWerktag(tag: string, land: FeiertagLand | null = 'NRW'): boolean {
  if (istWochenende(tag)) return false;
  return !land || !istFeiertag(tag, land);
}

/** Der Tag selbst, wenn er ein Werktag ist — sonst der nächste Werktag danach. */
export function werktagAbOder(tag: string, land: FeiertagLand | null = 'NRW'): string {
  let d = tag;
  for (let i = 0; i < 30 && !istWerktag(d, land); i++) d = plus(d, 1);
  return d;
}

/** `n` Werktage weiter (n < 0: zurück); 0 = der Tag selbst (auch wenn er keiner ist). */
export function werktagePlus(tag: string, n: number, land: FeiertagLand | null = 'NRW'): string {
  let d = tag;
  const r = n < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(n); i++) { do { d = plus(d, r); } while (!istWerktag(d, land)); }
  return d;
}
