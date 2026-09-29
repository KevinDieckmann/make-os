// ─── Kalender-Kern: EINE Stelle für Kalenderrechnung (29.09., Paket K2, rein, client-sicher) ─
// Verbindungskarte 29.09. (KALENDER_VERBINDUNGEN.md, Befunde 12/13): die Kalenderwoche wurde an 7 Stellen eigens
// gerechnet, Feiertage an 3 Stellen (Steuertermine nur bundesweit, Angebote ohne). Ab jetzt importieren alle von hier:
//   Tag        heute als Berliner Tag (`berlinerTag`, = lib/zeit.ts `localDay`), ± Tage (`tagPlus`)
//   Wandzeit   Berliner Wandzeit ↔ Zeitpunkt (`wandzeit`, `ausWandzeit`, `wandAus`, `tagVon`) — Kern in lib/kalender/zeit.ts
//   Woche      ISO-Kalenderwoche (`kalenderwoche` Zahl, `isoWoche` mit Jahr), Montag der Woche (`montagVon`), Wochentag 1–7
//   Feiertage  NRW (Gauß, bewegliche + feste inkl. Fronleichnam/Allerheiligen) — Rechnung in lib/aufgaben/feiertage.ts,
//              hier die Tür; `feiertageIm`, `feiertagsHinweis` für Kalender, freie Zeit, Buchung, Heute
//   Werktag    Mo–Fr ohne Feiertag NRW (`istWerktag`, `werktagAbOder`, `werktagePlus`)
// Alles über UTC-Mittag bzw. Europe/Berlin — nie über die Zone der Maschine. Tests: tests/kalender-kern.test.ts.

import { feiertageNRW, feiertag, type Feiertag } from '@/lib/aufgaben/feiertage';

export { ZONE, wandzeit, ausWandzeit, wandAus, tagVon, tagPlus, minutenVon } from '@/lib/kalender/zeit';
export { localDay as berlinerTag } from '@/lib/zeit';
export { ostersonntag, feiertageNRW, feiertag, istFeiertag, istWochenende, istWerktag, werktagAbOder, werktagePlus, type Feiertag, type FeiertagLand } from '@/lib/aufgaben/feiertage';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const mittag = (tag: string) => new Date(`${tag}T12:00:00Z`);
const plus = (tag: string, n: number) => { const d = mittag(tag); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Wochentag nach ISO: 1 = Montag … 7 = Sonntag. */
export function wochentag(tag: string): number {
  const w = mittag(tag).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Montag der (Mo–So-)Woche eines Tages. */
export const montagVon = (tag: string): string => plus(tag, 1 - wochentag(tag));

/** ISO-8601-Kalenderwoche mit Wochenjahr: die Woche gehört dem Jahr ihres Donnerstags (29.12.2025 → KW 1/2026). */
export function isoWoche(tag: string): { kw: number; jahr: number } {
  const donnerstag = mittag(plus(montagVon(tag), 3));
  const jahr = donnerstag.getUTCFullYear();
  const tageSeitNeujahr = Math.round((donnerstag.getTime() - Date.UTC(jahr, 0, 1, 12)) / 864e5);
  return { kw: 1 + Math.floor(tageSeitNeujahr / 7), jahr };
}

/** ISO-8601-Kalenderwoche (nur die Nummer). */
export const kalenderwoche = (tag: string): number => isoWoche(tag).kw;

/** Alle Feiertage NRW im Zeitraum [von, bis) — Berliner Tage, nach Datum; höchstens über 5 Jahre. */
export function feiertageIm(von: string, bis: string): Feiertag[] {
  if (!TAG.test(von) || !TAG.test(bis) || bis <= von) return [];
  const j0 = Number(von.slice(0, 4)), j1 = Math.min(Number(bis.slice(0, 4)), j0 + 5);
  const raus: Feiertag[] = [];
  for (let j = j0; j <= j1; j++) for (const f of feiertageNRW(j)) if (f.tag >= von && f.tag < bis) raus.push(f);
  return raus;
}

/**
 * Hinweis für freie-Zeit-Suche, Buchungsseite (K4) und Heute: „Feiertag in NRW: Tag der Deutschen Einheit“ — oder
 * undefined. Bewusst ein Hinweis, keine Sperre: ob an einem Feiertag gearbeitet wird, entscheidet der Mensch.
 */
export function feiertagsHinweis(tag: string): string | undefined {
  const name = TAG.test(tag) ? feiertag(tag) : undefined;
  return name ? `Feiertag in NRW: ${name}` : undefined;
}
