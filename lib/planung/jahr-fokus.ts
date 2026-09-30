// ─── MAKE OS — Planung: „Fokus des Jahres“ je Jahr (30.09.) ─────────────────
// Der Fokus-Satz liegt seit 26.09. unter `jahr`, `privat:jahr`, `business:jahr`
// (lib/make-one/space-regeln.ts `fokusSchluessel`). Wer das nächste Jahr plant,
// braucht dafür einen eigenen Satz — ohne dass die vielen Leser ohne Jahr
// (Wochenplaner, Tagesplanung, Kompass, ZOE) umgebaut werden müssen:
//   · Je Jahr ein Schlüssel `<basis>:<jahr>` (z. B. `business:jahr:2027`).
//   · Das LAUFENDE Jahr wird doppelt geschrieben: `<basis>` und `<basis>:<jahr>` —
//     alte Leser (und der alte Online-Stand, der nur `<basis>` kennt) sehen es wie bisher.
//   · Ausgeliefert wird `fokusFuerLaufendesJahr()`: im neuen Jahr steht unter `<basis>`
//     der vorgeplante Satz (`<basis>:<neues Jahr>`), und der Satz des Vorjahres wandert
//     nicht still ins neue Jahr. Gespeichert wird nur, was geschrieben wurde.
// Client-safe, rein. Tests: tests/planung-zeitstrahl.test.ts.

const PREFIXE = ['', 'privat:', 'business:'] as const;
/** Jahres-Schlüssel mit oder ohne Jahr: `jahr`, `business:jahr`, `privat:jahr:2027` … */
const JAHR_SCHLUESSEL = /^((?:(?:privat|business):)?jahr)(?::(\d{4}))?$/;

/** Der Schlüssel des Fokus für ein bestimmtes Jahr (`basis` wie aus `fokusSchluessel('jahr', space)`). */
export const fokusJahrSchluessel = (basis: string, jahr: number): string => `${basis}:${jahr}`;

/** Den Fokus eines Jahres lesen: eigener Satz, im laufenden Jahr sonst der Satz ohne Jahr. */
export function fokusImJahr(alle: Record<string, string> | null | undefined, basis: string, jahr: number, laufend: number): string {
  const a = alle ?? {};
  const eigen = a[fokusJahrSchluessel(basis, jahr)];
  if (typeof eigen === 'string') return eigen;
  return jahr === laufend ? (a[basis] ?? '') : '';
}

/** Welche Schlüssel ein Schreiben setzt — das laufende Jahr doppelt (mit und ohne Jahr), andere Jahre nur mit. */
export function fokusSchreibSchluessel(schluessel: string, laufend: number): string[] {
  const m = JAHR_SCHLUESSEL.exec(schluessel);
  if (!m) return [schluessel];
  const basis = m[1];
  const jahr = m[2] ? Number(m[2]) : laufend;
  return jahr === laufend ? [basis, fokusJahrSchluessel(basis, jahr)] : [fokusJahrSchluessel(basis, jahr)];
}

/** Ist das ein gültiger Jahres-Schlüssel mit Jahr (für die Prüfung im Schreibweg)? Jahr ±10 um das laufende. */
export function istJahrFokusSchluessel(schluessel: string, laufend: number): boolean {
  const m = JAHR_SCHLUESSEL.exec(schluessel);
  return !!m && (!m[2] || Math.abs(Number(m[2]) - laufend) <= 10);
}

/**
 * Für alle Leser ohne Jahr: unter `<basis>` steht der Fokus des laufenden Jahres. Gibt es `<basis>:<laufend>`,
 * gilt der; ist `<basis>` nur noch der Satz des Vorjahres, bleibt er leer statt still weiterzugelten.
 */
export function fokusFuerLaufendesJahr(alle: Record<string, string> | null | undefined, laufend: number): Record<string, string> {
  const aus: Record<string, string> = { ...(alle ?? {}) };
  for (const p of PREFIXE) {
    const basis = `${p}jahr`;
    const eigen = aus[fokusJahrSchluessel(basis, laufend)];
    if (typeof eigen === 'string') aus[basis] = eigen;
    else if (typeof aus[basis] === 'string' && aus[basis] && aus[fokusJahrSchluessel(basis, laufend - 1)] === aus[basis]) aus[basis] = '';
  }
  return aus;
}
