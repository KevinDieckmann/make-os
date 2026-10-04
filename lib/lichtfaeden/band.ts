// ─── Lichtfäden — die reine Mathematik (03.10.2026) ─────────────────────────
// Kevin (03.10.): „Bei der Planung wäre geil, wenn das so reinkommt mit mehreren Elektro-Fäden … das kann sich auch mit
// durch die Homepage ziehen.“ Hunderte feine, halbtransparente Fäden bilden ein Band, das an aktiven Stellen auffächert
// und leuchtet und an ruhigen eng liegt.
//
// Diese Datei ist REIN (kein DOM, keine Importe, deterministisch): gleiche Saat = gleiche Fäden, gleiche Zeit = gleiches
// Bild. Sie wird zusammen mit `zeichnen.ts` per `node scripts/lichtfaeden-website.mjs` nach website/js/lichtfaeden.js
// übersetzt (Wächter: tests/lichtfaeden.test.ts) — deshalb hier keine Importe und keine Namen.
//
// Bauprinzip eines Bündels: Eine Leitkurve (Mitte des Bündels) mit Normalen; jeder Faden liegt um `versatz × spreizung`
// neben ihr. `versatz` mischt eine feste Lage im Bündel mit zwei langsamen Sinuswellen eigener Frequenz — so kreuzen sich
// die Fäden (Geflecht), und mit wachsender Zeit fließen sie (Phasenverschiebung), ohne dass sich das Bild je wiederholt.
//
// Strahl v3 (04.10., Kevin: „Der Strahl läuft im Grunde genommen immer von links nach rechts — guck dir den Verlauf an.“):
//   · Fließrichtung: jede Welle wandert in Richtung wachsender Weglänge `s` (links → rechts, in Zeitrichtung) — vorher hatte
//     jeder Faden eine zufällige Richtung.
//   · `fransen`: rechts von HEUTE lösen sich Fäden aus dem Bündel (Zukunft = unsicher) — der Zeichner mischt es je Stelle zu.
//   · Weitere Parameter für Aufbau (Fäden wachsen von links ein), Partikel entlang der Fäden und das Glühen.

/** Die Parameter — eine Stelle für App und Website (DESIGN_STANDARD.md › Lichtfäden). */
export const LICHTFAEDEN = {
  /** Fäden je Bündel: Rechner · Handy. */
  faeden: { rechner: 22, handy: 11 },
  /** Abstand der Stützpunkte entlang eines Fadens (CSS-Pixel): Rechner · Handy. */
  schritt: { rechner: 6, handy: 8 },
  /** Fließen: Phase je Millisekunde — sehr ruhig (eine Welle braucht gut 20 s). */
  tempo: 0.00028,
  /** Strichbreite eines Fadens (CSS-Pixel) — v3 feiner (vorher 0,8), dafür mehr Fäden. */
  strich: 0.6,
  /** Grund-Deckkraft eines Fadens; additiv gemischt leuchten Kreuzungen von selbst. */
  deckkraft: 0.2,
  /** Feinheit der Deckkraft-Eimer (gleiche Farbe + gleiche Stufe = EIN Pfad, ein Strich). */
  stufen: 40,
  /** Spreizung in ruhigen Abschnitten (Anteil der vollen) — dort liegt das Band eng. */
  ruhe: 0.12,
  /** Höchste Pixeldichte — darüber kostet es nur Rechenzeit. */
  dprMax: 2,
  /** Aufbau: so lange (ms) wachsen die Fäden von links nach rechts ein; jeder Faden läuft bis `aufbauVerzug` px hinterher. */
  aufbau: 1900,
  aufbauVerzug: 150,
  /** Die Spitze eines wachsenden Fadens leuchtet auf dieser Länge (px). */
  aufbauSpitze: 46,
  /** Partikel entlang der Fäden (Punkt-Textur wie im Vorbild): Abstand (px), Tempo nach rechts (px/ms), Größe (px), Helligkeit. */
  punkte: { abstand: 10, tempo: 0.011, groesse: 1.1, hell: 2.4 },
  /** Ausfransen rechts von HEUTE: Weite (Anteil der Spreizung, mindestens `fransMin` px) und Abschlag der Deckkraft. */
  frans: { weite: 0.95, min: 7, blass: 0.6 },
  /** Glühen dichter Stellen: Teiler des Schein-Puffers, Weichzeichner (px im Puffer), Stärke. */
  glanz: { teiler: 4, weich: 3, staerke: 0.7 },
} as const;

export const TAU = Math.PI * 2;

/** Zufall mit Saat (mulberry32) — deterministisch, schnell, ohne Abhängigkeit. */
export function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eine Saat aus einem Text (FNV-1a, 32 Bit) — z. B. aus der Kennung eines Ziels. */
export function textSaat(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Ein Faden im Bündel: feste Lage, eigene Welle, eigene Helligkeit. */
export interface FadenSaat {
  /** Lage im Bündel, −1 … 1 (gleichmäßig verteilt, leicht verrauscht). */
  lage: number;
  phase: number;
  /** Wellenzahl je Pixel entlang der Leitkurve. */
  frequenz: number;
  /** Fließtempo (Vielfaches von LICHTFAEDEN.tempo); seit v3 immer positiv = in Zeitrichtung (links → rechts). */
  tempo: number;
  /** Anteil der Welle an der Lage, 0 … 1 (hoch = der Faden wandert quer durchs Bündel). */
  welle: number;
  /** Helligkeit 0,5 … 1. */
  hell: number;
}

/** Die Fäden eines Bündels — gleiche Saat und Anzahl = dieselben Fäden. */
export function fadenSaaten(anzahl: number, saat: number): FadenSaat[] {
  const r = zufall(saat);
  const n = Math.max(1, Math.floor(anzahl));
  const aus: FadenSaat[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const lage = u * 0.86 + (r() - 0.5) * 0.18, phase = r() * TAU, frequenz = 0.0045 + r() * 0.0125;
    // v3: immer in Zeitrichtung (links → rechts). Der Zufallswert für das frühere Vorzeichen wird weiter gezogen, damit
    // Welle und Helligkeit aller Fäden dieselben bleiben wie vorher.
    const tempo = 0.55 + r() * 0.9;
    r();
    aus.push({ lage, phase, frequenz, tempo, welle: 0.3 + r() * 0.7, hell: 0.5 + r() * 0.5 });
  }
  return aus;
}

/** Ein Faden ohne Breite: die Leitkurve selbst (für den Schein unter dem Bündel). */
export const MITTE: FadenSaat = { lage: 0, phase: 0, frequenz: 0, tempo: 0, welle: 0, hell: 1 };

/**
 * Wo liegt ein Faden quer zur Leitkurve? Ergebnis etwa −1,2 … 1,2 (mal `spreizung` = Pixel).
 * `s` = Weg entlang der Leitkurve in Pixeln, `t` = Zeit in Millisekunden (0 = Standbild).
 */
export function versatz(f: FadenSaat, s: number, t: number): number {
  const ph = t * LICHTFAEDEN.tempo * Math.abs(f.tempo);
  // sin(k·s − ω·t): beide Wellen wandern zu wachsendem s — das Geflecht fließt in Zeitrichtung.
  return f.lage * (1 - 0.45 * f.welle)
    + f.welle * 0.62 * Math.sin(s * f.frequenz + f.phase - ph)
    + 0.16 * f.welle * Math.sin(s * f.frequenz * 2.3 + f.phase * 1.7 - ph * 1.6);
}

/**
 * Ausfransen (v3): Wo `frans` > 0 (rechts von HEUTE), löst sich ein Faden um diesen Anteil aus dem Bündel — außen liegende
 * weiter als innere, mit einer eigenen, schnelleren Welle (auch sie wandert nach rechts). Ergebnis etwa −1,4 … 1,4.
 */
export function fransen(f: FadenSaat, s: number, t: number): number {
  const ph = t * LICHTFAEDEN.tempo * Math.abs(f.tempo);
  return f.lage * 0.8 + 0.6 * Math.sin(s * f.frequenz * 3.1 + f.phase * 2.3 - ph * 1.8);
}

/**
 * Die Mitte eines Bündels im waagerechten Band (Planung), in halben Bandhöhen (−1 … 1): Die Bündel schwingen
 * phasenversetzt um die Mittellinie und verflechten sich; je dichter die Stelle, desto weiter schwingt das Bündel aus.
 */
export function buendelMitte(index: number, anzahl: number, s: number, t: number, dichte: number): number {
  const phi = (index / Math.max(1, anzahl)) * TAU + index * 0.9;
  const ph = t * LICHTFAEDEN.tempo * 0.55;
  const amp = 0.06 + 0.44 * dichte;
  // v3: beide Wellen wandern nach rechts (−ph).
  return amp * Math.sin(s * 0.0098 + phi - ph) + 0.05 * Math.sin(s * 0.0031 - phi * 1.3 - ph * 0.4);
}

/** Spreizung eines Bündels (Pixel) bei gegebener Dichte 0 … 1 und halber Bandhöhe. */
export function spreizung(dichte: number, halb: number): number {
  const d = Math.max(0, Math.min(1, dichte));
  return halb * (LICHTFAEDEN.ruhe + (1 - LICHTFAEDEN.ruhe) * d) * 0.85;
}

/** Gauß-Glättung (σ in Feldern); außerhalb gilt 0 — wer saubere Ränder braucht, rechnet mit Rand und schneidet ab. */
export function gauss(werte: readonly number[], sigma: number): number[] {
  if (!(sigma > 0)) return werte.slice();
  const r = Math.ceil(sigma * 3);
  const kern: number[] = [];
  let summe = 0;
  for (let k = -r; k <= r; k++) { const w = Math.exp(-(k * k) / (2 * sigma * sigma)); kern.push(w); summe += w; }
  const aus = new Array<number>(werte.length).fill(0);
  for (let i = 0; i < werte.length; i++) {
    let v = 0;
    for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < werte.length) v += werte[j] * kern[k + r]; }
    aus[i] = v / summe;
  }
  return aus;
}

/** Weiche Sättigung: 0 → 0, `halb` → 0,5, viel → gegen 1 (eine einzelne Frist leuchtet, zehn sprengen nichts). */
export function saettigen(v: number, halb: number): number {
  if (!(v > 0)) return 0;
  return 1 - Math.pow(2, -v / Math.max(1e-9, halb));
}

/** Wert an einer Stelle f ∈ [0, 1] einer Reihe, deren Felder gleich breit sind (Feldmitten, linear, Ränder gehalten). */
export function wertBei(werte: readonly number[], f: number): number {
  const n = werte.length;
  if (!n) return 0;
  const p = Math.max(0, Math.min(n - 1, f * n - 0.5));
  const i = Math.floor(p), j = Math.min(n - 1, i + 1), a = p - i;
  return werte[i] * (1 - a) + werte[j] * a;
}

/** Glatte Stufe 0 → 1 zwischen a und b. */
export function glatt(v: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

/** Ein Stützpunkt einer frei geführten Leitkurve (Website): Lage plus Werte, die entlang der Kurve gleiten. */
export interface Anker { x: number; y: number; werte: readonly number[] }
/** Eine abgetastete Stelle der Leitkurve: Lage, Normale (Einheitsvektor), Weg `s` und die geglittenen Werte. */
export interface KurvenPunkt { x: number; y: number; nx: number; ny: number; s: number; werte: number[] }

/**
 * Catmull-Rom-Kurve durch die Anker, abgetastet etwa alle `schritt` Pixel. Die Werte der Anker gleiten glatt mit
 * (Smoothstep zwischen zwei Ankern). Rein und deterministisch — gleiche Anker, gleiche Punkte.
 */
export function kurve(anker: readonly Anker[], schritt: number): KurvenPunkt[] {
  const aus: KurvenPunkt[] = [];
  if (anker.length < 2) return aus;
  const n = anker.length, st = Math.max(1, schritt);
  const p = (i: number) => anker[Math.max(0, Math.min(n - 1, i))];
  let s = 0, vx = anker[0].x, vy = anker[0].y;
  for (let i = 0; i < n - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const laenge = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const teile = Math.max(1, Math.ceil(laenge / st));
    for (let k = i === 0 ? 0 : 1; k <= teile; k++) {
      const t = k / teile, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const dx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2);
      const dy = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2);
      const d = Math.hypot(dx, dy) || 1;
      s += Math.hypot(x - vx, y - vy); vx = x; vy = y;
      const g = t * t * (3 - 2 * t);
      const werte = p1.werte.map((w, j) => w + ((p2.werte[j] ?? w) - w) * g);
      aus.push({ x, y, nx: -dy / d, ny: dx / d, s, werte });
    }
  }
  return aus;
}
