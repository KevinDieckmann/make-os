// ─── Kontakt-Kennungen und ihre Fingerabdrücke massenhaft ersetzen (29.09., Paket D-C #35) — rein ─
// Für den Kennungs-Umzug (lib/crm/kennungen-umzug.ts) und seinen Rückweg: EIN Durchgang je Bestand statt einer
// Regex je Kennung (500 Kontakte × 30 Bestände wären sonst 15.000 Durchläufe über ganze Bestände).
// Eine Kontakt-Kennung besteht nur aus [a-z0-9-] und beginnt mit `c-`; als ganzes Wort gilt sie, wenn davor und danach
// kein [A-Za-z0-9_-] steht (wie `kennungMuster` in person-bestaende.ts) — so trifft `c-anna-1` nie `c-anna-12`.
// Ersetzt wird überall: Werte, Texte (Links `?k=c-…`), Schlüssel von Objekten (Signale, Rollen je Person).

// Im JSON-Text steht ein Zeilenumbruch als `\n` — eine Kennung am Zeilenanfang folgt also auf „n“; das zählt als Wortgrenze.
const KENNUNG = /(?:(?<=\\[nrtbf])|(?<![A-Za-z0-9_-]))c-[a-z0-9-]+(?![A-Za-z0-9_-])/g;
const FINGERABDRUCK = /c2#[0-9a-f]{16}(?![0-9a-f])|c#[0-9a-f]{12}(?![0-9a-f])/g;

/** Alle Kontakt-Kennungen (als ganze Wörter), die in einem Wert vorkommen, mit Anzahl. */
export function kennungenZaehlen(wert: unknown): Map<string, number> {
  const raus = new Map<string, number>();
  for (const m of JSON.stringify(wert ?? null).matchAll(KENNUNG)) raus.set(m[0], (raus.get(m[0]) ?? 0) + 1);
  return raus;
}

/** Alle Kennungen aus `paare` (alt → neu) überall ersetzen. Liefert denselben Wert (===), wenn nichts vorkam. */
export function kennungenErsetzen<T>(wert: T, paare: ReadonlyMap<string, string>): { wert: T; n: number } {
  if (!paare.size) return { wert, n: 0 };
  const text = JSON.stringify(wert ?? null);
  let n = 0;
  const neu = text.replace(KENNUNG, m => { const x = paare.get(m); if (x === undefined) return m; n++; return x; });
  return n ? { wert: JSON.parse(neu) as T, n } : { wert, n: 0 };
}

/** Protokoll-Fingerabdrücke (`c2#…` v2, `c#…` v1) über eine Tabelle alt → neu ersetzen (Änderungsprotokoll, ZOE-Entscheidungen). */
export function fingerabdrueckeErsetzen<T>(wert: T, tabelle: ReadonlyMap<string, string>): { wert: T; n: number } {
  if (!tabelle.size) return { wert, n: 0 };
  const text = JSON.stringify(wert ?? null);
  let n = 0;
  const neu = text.replace(FINGERABDRUCK, m => { const x = tabelle.get(m); if (x === undefined) return m; n++; return x; });
  return n ? { wert: JSON.parse(neu) as T, n } : { wert, n: 0 };
}

/** alt → neu umgedreht (für den Rückweg). */
export const umkehren = (paare: ReadonlyMap<string, string>): Map<string, string> => new Map(Array.from(paare, ([a, n]) => [n, a]));

/** Die Paare, deren alte Kennung in diesem Wert vorkommt (für die strukturierten Umbiege-Funktionen). */
export function vorkommendePaare(wert: unknown, paare: ReadonlyMap<string, string>): [string, string][] {
  const da = kennungenZaehlen(wert);
  return Array.from(paare).filter(([alt]) => da.has(alt));
}
