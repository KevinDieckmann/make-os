// ─── Prozesse — die gemeinsame Lage-Regel für Landkarten (21.10.; verallgemeinert aus dem Hochhaus, lib/fulfillment/prozesse/landkarte.ts) ────────
// Eine Reihe von Kästen in einer Breite verteilen — EINE Regel für das Hochhaus (Dach und Fundament füllen die ganze Breite) und die Fliege (Bänder
// „Führung“ und „Unterstützung“ mit Kacheln fester Breite, mittig, bei Bedarf in mehreren Zeilen). Rein, deterministisch, gerundet auf 0,1 px.

export const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Lage von `anzahl` Kästen in einer Reihe ab `x` über `breite`: ohne `kachel` füllen sie die Breite (Hochhaus), mit `kachel` haben sie diese feste Breite
 * und stehen mittig — passt die Reihe nicht, bricht sie in Zeilen um (`zeile` = Index der Zeile). Leer bei 0.
 */
export function reiheVerteilen(o: { anzahl: number; x: number; breite: number; luecke: number; kachel?: number }): { x: number; b: number; zeile: number }[] {
  const n = Math.max(0, Math.floor(o.anzahl));
  if (!n) return [];
  if (o.kachel === undefined) {
    const b = (o.breite - o.luecke * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x: o.x + i * (b + o.luecke), b, zeile: 0 }));
  }
  const k = o.kachel;
  const jeZeile = Math.max(1, Math.floor((o.breite + o.luecke) / (k + o.luecke)));
  const raus: { x: number; b: number; zeile: number }[] = [];
  for (let i = 0; i < n; i++) {
    const zeile = Math.floor(i / jeZeile);
    const inZeile = Math.min(jeZeile, n - zeile * jeZeile);
    const breit = inZeile * k + (inZeile - 1) * o.luecke;
    const start = o.x + (o.breite - breit) / 2;
    raus.push({ x: r1(start + (i % jeZeile) * (k + o.luecke)), b: k, zeile });
  }
  return raus;
}
