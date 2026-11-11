// Bewegungskern der Beispielseite Hellgrund: Federn, Verläufe, Kurven und EIN gemeinsamer Takt.
// Federn rechnen wie das Vorbild in Schritten von 1 ms, ein Bild höchstens 64 ms.

export const clamp01 = (w) => Math.min(1, Math.max(0, w));
/** Anteil von p innerhalb von [a, b]: 0 davor, 1 danach. */
export const span = (p, [a, b]) => clamp01((p - a) / (b - a));

export const kurve = {
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inOutSine: (t) => (1 - Math.cos(t * Math.PI)) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
};

/** Feder mit Spannung und Reibung (Masse 1). `schritt` liefert true, solange sie sich bewegt. */
export class Feder {
  constructor(wert = 0, { spannung = 170, reibung = 26, genau = 0.01 } = {}) {
    this.wert = wert; this.ziel = wert; this.v = 0; this.ruht = true;
    this.k = spannung; this.c = reibung; this.genau = genau;
  }
  setze(ziel) {
    if (ziel === this.ziel && this.ruht) return;
    this.ziel = ziel; this.ruht = false;
  }
  sofort(wert) { this.wert = this.ziel = wert; this.v = 0; this.ruht = true; }
  schritt(dtMs) {
    if (this.ruht) return false;
    const n = Math.max(1, Math.round(Math.min(64, dtMs)));
    const { k, c, genau } = this;
    let x = this.wert, v = this.v; const z = this.ziel;
    for (let i = 0; i < n; i++) {
      v += -k * 0.000001 * (x - z) - c * 0.001 * v;
      x += v;
      if (Math.abs(v) < genau / 10 && Math.abs(x - z) <= genau) { x = z; v = 0; this.ruht = true; break; }
    }
    this.wert = x; this.v = v;
    return true;
  }
}

/** Verlauf über eine feste Dauer mit Kurve und optionaler Verzögerung. */
export class Verlauf {
  constructor(wert = 0) { this.wert = wert; this.ruht = true; }
  starte(nach, dauer, kurveFn, jetzt, verzoegerung = 0) {
    this.von = this.wert; this.nach = nach; this.dauer = dauer; this.kurve = kurveFn;
    this.t0 = jetzt + verzoegerung; this.ruht = false;
  }
  sofort(wert) { this.wert = wert; this.ruht = true; }
  schritt(jetzt) {
    if (this.ruht) return false;
    const t = (jetzt - this.t0) / this.dauer;
    if (t <= 0) return true;
    if (t >= 1) { this.wert = this.nach; this.ruht = true; return true; }
    this.wert = this.von + (this.nach - this.von) * this.kurve(t);
    return true;
  }
}

/** Ein einziger requestAnimationFrame-Takt. Lenis läuft zuerst, dann die Leser, dann die Zeichner. */
const teilnehmer = [];
let laeuft = false, zuletzt = 0;
export function imTakt(fn) {
  teilnehmer.push(fn);
  if (!laeuft) { laeuft = true; zuletzt = performance.now(); requestAnimationFrame(bild); }
}
function bild(jetzt) {
  const dt = Math.min(64, Math.max(0, jetzt - zuletzt));
  zuletzt = jetzt;
  for (const fn of teilnehmer) {
    try { fn(jetzt, dt); } catch (fehler) { console.error(fehler); }
  }
  requestAnimationFrame(bild);
}
