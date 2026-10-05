// ─── MAKE OS — Kugel: reine Mathematik (05.10.2026) ─────────────────────────
// Ohne DOM, ohne WebGL: fester Zufall, Punkte auf der Kugel, Matrizen, Zeiger-Strahl, Projektion, Zustände. Läuft im
// Browser (motor.ts) und in den Tests (tests/kugeln.test.ts) — eine Quelle für Bild und Prüfung.
// Vorlage „Solaris“ (UMBAU_ABEND_0410.md): Punktwolke auf der Kugel, Atmen entlang der Normale, Verlauf Smaragd → Granat,
// hohle dunkle Mitte + heller Rand, Einstieg 2,4 s, Zeiger-Ausbruch. Hier steht nur die Rechnung; Farben kommen als
// Token herein (lib/make-one/design.ts › KUGEL), nie als Literal.

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export const TAU = Math.PI * 2;
export const klemme = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const sanft = (u: number) => { const x = klemme(u, 0, 1); return x * x * (3 - 2 * x); };
/** easeOutCubic — der Einstieg der Vorlage. */
export const auslaufen = (u: number) => { const x = klemme(u, 0, 1); return 1 - (1 - x) ** 3; };

/** Fester Zufall (LCG): gleiche Wolke bei jedem Laden — sonst „springt“ die Kugel zwischen zwei Besuchen. */
export function zufall(saat: number): () => number {
  let s = saat >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Kennung → Zahl (FNV-1a), damit ein Datenpunkt immer an derselben Stelle seines Clusters sitzt. */
export function hashZahl(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── Vektoren ──
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const kreuz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const laenge = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => { const l = laenge(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Fibonacci-Kugel: n gleichmäßig verteilte Einheitsvektoren (+ etwas festem Zittern, damit kein Muster sichtbar wird). */
export function fibonacciKugel(n: number, saat = 7, zittern = 0.35): Float32Array {
  const z = zufall(saat);
  const aus = new Float32Array(n * 3);
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const w = i * gold + (z() - 0.5) * zittern * (TAU / Math.max(8, Math.sqrt(n)));
    const p = norm([Math.cos(w) * r, y + (z() - 0.5) * zittern * (2 / n), Math.sin(w) * r]);
    aus[i * 3] = p[0]; aus[i * 3 + 1] = p[1]; aus[i * 3 + 2] = p[2];
  }
  return aus;
}

/** Verlaufskoordinate 0 … 1 über die Kugel (schräg von unten links nach oben rechts) — Smaragd unten, Granat oben. */
export const verlaufT = (p: Vec3) => klemme((p[1] * 0.75 + p[0] * 0.45) * 0.5 + 0.5, 0, 1);

/** #RRGGBB → [r, g, b] 0 … 1. Nur Token-Farben gehen hier hinein. */
export function alsRgb(hex: string): Vec3 {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? '000000';
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

// ── Matrizen (4 × 4, Spalten zuerst wie WebGL) ──
export function perspektive(fov: number, aspekt: number, nah: number, fern: number): Mat4 {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (nah - fern);
  return new Float32Array([f / aspekt, 0, 0, 0, 0, f, 0, 0, 0, 0, (fern + nah) * nf, -1, 0, 0, 2 * fern * nah * nf, 0]);
}
/** Drehung um y (Lauf) und dann x (feste Neigung). */
export function drehung(y: number, x: number): Mat4 {
  const cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
  // R = Rx · Ry
  return new Float32Array([
    cy, sx * sy, -cx * sy, 0,
    0, cx, sx, 0,
    sy, -sx * cy, cx * cy, 0,
    0, 0, 0, 1,
  ]);
}
/** Punkt mit einer 4×4-Matrix (w = 1) multiplizieren. */
export function mal(m: Mat4, p: Vec3): [number, number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
  ];
}
/** Transponierte Drehung (= Umkehrung) auf einen Richtungsvektor. */
export function zurueckGedreht(m: Mat4, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[4] * v[0] + m[5] * v[1] + m[6] * v[2], m[8] * v[0] + m[9] * v[1] + m[10] * v[2]];
}

/** Abstand der Kamera, damit die Kugel (Radius 1 · Rand) mit `fuellung` (Anteil der kurzen Seite) ins Bild passt. */
export function kameraAbstand(fov: number, aspekt: number, fuellung = 0.8, rand = 1.08): number {
  const halb = Math.tan(fov / 2) * Math.min(1, aspekt);
  // Kugelradius r erscheint bei Abstand D unter dem Winkel asin(r/D) — für kleine Winkel ≈ r/D.
  return (rand / fuellung) / halb;
}

/**
 * Zeiger → Treffer auf der Kugel (Objektraum). Kamera auf der z-Achse bei `abstand`, Blick zur Mitte. `ndc` = Zeiger in
 * −1 … 1 (y nach oben). Liefert den Einheitsvektor des vorderen Schnittpunkts oder null (daneben).
 */
export function zeigerAufKugel(ndc: [number, number], fov: number, aspekt: number, abstand: number, dreh: Mat4, radius = 1): Vec3 | null {
  const t = Math.tan(fov / 2);
  const richtung = norm([ndc[0] * t * aspekt, ndc[1] * t, -1]);
  const auge: Vec3 = [0, 0, abstand];
  // |auge + s·richtung|² = r²
  const b = dot(auge, richtung), c = dot(auge, auge) - radius * radius;
  const d = b * b - c;
  if (d < 0) return null;
  const s = -b - Math.sqrt(d);
  if (s <= 0) return null;
  const welt: Vec3 = [auge[0] + richtung[0] * s, auge[1] + richtung[1] * s, auge[2] + richtung[2] * s];
  return norm(zurueckGedreht(dreh, welt));
}

/**
 * Einheitsvektor (Objektraum) → Bildschirm in CSS-Pixeln + ob er vorne liegt. Dieselbe Kamera wie der Shader (Atmen
 * ausgenommen — es ist klein genug für Zeigen und Linien).
 */
export function aufBildschirm(p: Vec3, dreh: Mat4, proj: Mat4, abstand: number, breite: number, hoehe: number): { x: number; y: number; vorne: boolean } {
  const w = mal(dreh, p);
  const sicht: Vec3 = [w[0], w[1], w[2] - abstand];
  const c = mal(proj, sicht);
  const x = c[0] / c[3], y = c[1] / c[3];
  return { x: (x * 0.5 + 0.5) * breite, y: (0.5 - y * 0.5) * hoehe, vorne: w[2] > -0.05 };
}

// ── Zustände ─────────────────────────────────────────────────────────────────
/**
 * Was die Kugel ausdrückt — über Atem-Tempo und Farbgewicht, nicht über Effekte (UMBAU_ABEND_0410.md 1).
 *   tempo        Faktor auf die Zeit des Rauschens (1 = Ruheatmung ~5 s)
 *   atem         Ausschlag entlang der Normale (Anteil des Radius)
 *   weite        Grundgröße: < 0 zieht sich zusammen (zuhören), > 0 dehnt sich (sprechen)
 *   verschiebung Farbgewicht: < 0 mehr Smaragd (kühl, zuhören), > 0 mehr Granat (warm, denken)
 *   hell         Helligkeit
 *   pegel        0 … 1 Lautstärke — verstärkt atem/weite in Richtung des Zustands
 */
export interface KugelZustand { tempo: number; atem: number; weite: number; verschiebung: number; hell: number; pegel: number }

export type ZoeZustand = 'ruht' | 'hoert' | 'denkt' | 'spricht';

/** Dieselben vier Zustände und Takte wie das ZoeHirn (TON: 5,4 · 4,2 · 4,8 · 3,2 s) — nur ruhiger ausgedrückt. */
export const ZOE_ZUSTAND: Record<ZoeZustand, Omit<KugelZustand, 'pegel'>> = {
  ruht: { tempo: 1, atem: 0.045, weite: 0, verschiebung: 0, hell: 0.92 },
  hoert: { tempo: 5.4 / 4.2, atem: 0.05, weite: -0.035, verschiebung: -0.22, hell: 1 },
  denkt: { tempo: 5.4 / 4.8, atem: 0.06, weite: 0, verschiebung: 0.24, hell: 0.96 },
  spricht: { tempo: 5.4 / 3.2, atem: 0.055, weite: 0.03, verschiebung: 0.04, hell: 1.08 },
};

/** Zustand + Pegel + laufende Aufträge → Ziel-Parameter (laufende Aufträge machen den Atem etwas schneller, nie hektisch). */
export function zoeParameter(z: ZoeZustand, pegel = 0, aktiv = 0): KugelZustand {
  const b = ZOE_ZUSTAND[z];
  const p = klemme(pegel, 0, 1);
  const richtung = z === 'hoert' ? -1 : z === 'spricht' ? 1 : 0;
  return {
    tempo: Math.min(b.tempo * (1 + Math.min(8, aktiv) * 0.035), 2),
    atem: b.atem + p * 0.05,
    weite: b.weite + richtung * p * 0.06,
    verschiebung: b.verschiebung,
    hell: b.hell + p * 0.12,
    pegel: p,
  };
}

/** Weiches Nachziehen eines Zustands (je Bild, unabhängig von der Bildrate): k ≈ Anteil je 1/60 s. */
export function nachziehen(ist: KugelZustand, ziel: KugelZustand, dtSek: number, k = 0.06): KugelZustand {
  const a = 1 - (1 - k) ** (dtSek * 60);
  const m = (x: number, y: number) => x + (y - x) * a;
  return { tempo: m(ist.tempo, ziel.tempo), atem: m(ist.atem, ziel.atem), weite: m(ist.weite, ziel.weite), verschiebung: m(ist.verschiebung, ziel.verschiebung), hell: m(ist.hell, ziel.hell), pegel: m(ist.pegel, ziel.pegel) };
}

/** Einstieg 2,4 s (Vorlage): gefüllt und nah → Kamera fährt zurück, die Mitte höhlt sich zum Ring, die Wolke blüht auf. */
export const EINSTIEG_MS = 2400;
export function einstieg(ms: number): { sicht: number; hohl: number; naeher: number } {
  const e = auslaufen(ms / EINSTIEG_MS);
  return { sicht: sanft(ms / (EINSTIEG_MS * 0.45)), hohl: sanft((e - 0.2) / 0.8), naeher: 1 - e };
}
