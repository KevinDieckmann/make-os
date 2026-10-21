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

// ── Wege der Landkarte (21.10. abends, „Linien-Durcheinander“): kurze Übergaben als weiche Kurven, keine Kreuzungen ────────────────────────────

export type Pt = [number, number];

/**
 * Eine weiche Kurve von `a` nach `b` (kubisch, Tangenten in Richtung der Achse — quer: waagerecht, hoch: senkrecht), als Polylinie mit `n` Abschnitten
 * (der Faden der Flow-Ebene zeichnet Polylinien). Rein, gerundet auf 0,1 px.
 */
export function kurve(a: Pt, b: Pt, achse: 'quer' | 'hoch' = 'quer', n = 16): Pt[] {
  const [ax, ay] = a, [bx, by] = b;
  const c1: Pt = achse === 'quer' ? [ax + (bx - ax) / 2, ay] : [ax, ay + (by - ay) / 2];
  const c2: Pt = achse === 'quer' ? [bx - (bx - ax) / 2, by] : [bx, by - (by - ay) / 2];
  const raus: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * ax + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * bx;
    const y = u * u * u * ay + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * by;
    raus.push([r1(x), r1(y)]);
  }
  return raus;
}

/** Der Punkt bei einem Anteil der Weglänge (0 … 1) — für die Beschriftung einer Kurve. */
export function wegPunkt(p: readonly Pt[], anteil = 0.5): Pt {
  if (!p.length) return [0, 0];
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  let rest = Math.max(0, Math.min(1, anteil)) * L;
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (rest <= l && l > 0) { const u = rest / l; return [Math.round(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u), Math.round(p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u)]; }
    rest -= l;
  }
  return [Math.round(p[p.length - 1][0]), Math.round(p[p.length - 1][1])];
}

const seite = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** Schneiden sich zwei Strecken echt (Berühren an einem Ende zählt nicht)? */
export function streckenKreuzen(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const s1 = seite(a, b, c), s2 = seite(a, b, d), s3 = seite(c, d, a), s4 = seite(c, d, b);
  return s1 * s2 < 0 && s3 * s4 < 0;
}
/** Kreuzen sich zwei Wege (Polylinien)? Mit Vorprüfung über die umgebenden Rechtecke. */
export function wegeKreuzen(p: readonly Pt[], q: readonly Pt[]): boolean {
  const kasten = (w: readonly Pt[]) => w.reduce((k, [x, y]) => [Math.min(k[0], x), Math.min(k[1], y), Math.max(k[2], x), Math.max(k[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const a = kasten(p), b = kasten(q);
  if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) return false;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) if (streckenKreuzen(p[i - 1], p[i], q[j - 1], q[j])) return true;
  return false;
}
