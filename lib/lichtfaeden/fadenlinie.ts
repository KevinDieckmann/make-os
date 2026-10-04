// ─── Lichtfäden · FadenLinie — der Mini-Strahl (Canvas 2D, 04.10.2026) ──────
// Kevin (04.10.): „Diese Akzente will ich überall drauf haben, wo Fokus ist … Der Strahl läuft im Grunde genommen immer von
// links nach rechts.“ Die FadenLinie ist eine Sparkline aus Fäden: EINE Zeitreihe (fällige Follow-ups der nächsten 14 Tage,
// qualifizierte Leads je Woche, Liquidität …) als Leitkurve, darum ein dünnes Bündel feiner Fäden aus DEMSELBEN Zeichner wie
// das große Band (band.ts + zeichnen.ts): hohe Werte = breiter und heller, Fäden wachsen von links ein, fließen nach rechts,
// rechts von HEUTE fransen sie aus. Spitzen bleiben spitz (linear zwischen den Werten, keine Glättung).
//   · Rein bis auf `fadenlinie()`: `fadenLinienProben` ist deterministisch (getestet).
//   · Ruhig: höchstens ~30 Bilder je Sekunde (`intervall`), pausiert außerhalb des Bildes, reduzierte Bewegung = Standbild.
//   · Daten rechnet der Zeichner nie — er bekommt normalisierte Werte (lib/lichtfaeden/reihen.ts `normalisiere`).

import { LICHTFAEDEN, MITTE, fadenSaaten, glatt, textSaat } from './band';
import { leinwand, rgb, starteLauf, zeichneBuendel, type Lauf, type Probe } from './zeichnen';

/** Parameter der FadenLinie — eine Stelle (DESIGN_STANDARD.md › Fokus-Signatur). */
export const FADENLINIE = {
  /** Fäden im Bündel: Rechner · Handy. */
  faeden: { rechner: 12, handy: 8 },
  /** Innenrand der Leinwand (px) — Platz für Spreizung und Ausfransen. */
  rand: 6,
  /** Spreizung bei Wert 0 und 1 (px). */
  spreizMin: 1.1,
  spreizMax: 5.5,
  /** Stützpunkte alle n px. */
  schritt: 3,
  /** Mindestabstand der Bilder (ms) — ~30 Bilder je Sekunde reichen für das ruhige Fließen. */
  intervall: 33,
  /** Aufbau von links nach rechts (ms). */
  aufbau: 1400,
} as const;

export interface FadenLinieBild {
  breite: number;
  hoehe: number;
  /** Werte 0 … 1 (0 = unten), gleich verteilt von links nach rechts. */
  werte: readonly number[];
  /** Lage der Nulllinie 0 … 1 von unten, wenn die Reihe negative Werte hat — sonst null (Boden = 0). */
  null0: number | null;
  /** #RRGGBB */
  farbe: string;
  /** Feld von HEUTE (rechts davon: Zukunft, Fäden fransen aus) — null = keine Heute-Marke. */
  heute: number | null;
  handy: boolean;
  /** Saat der Fäden (z. B. der Titel) — gleiche Saat, gleiche Fäden. */
  saat: string;
}

/** x-Lage eines Feldes (gleich verteilt zwischen den Innenrändern). */
export function feldX(d: Pick<FadenLinieBild, 'breite' | 'werte'>, i: number): number {
  const R = FADENLINIE.rand, n = d.werte.length;
  return n <= 1 ? d.breite / 2 : R + (i / (n - 1)) * (d.breite - 2 * R);
}

/** Wert der Reihe an der Stelle x — linear zwischen den Feldern (Spitzen bleiben spitz). */
export function wertAn(d: Pick<FadenLinieBild, 'breite' | 'werte'>, x: number): number {
  const R = FADENLINIE.rand, n = d.werte.length;
  if (!n) return 0;
  if (n === 1) return d.werte[0];
  const p = Math.max(0, Math.min(n - 1, ((x - R) / Math.max(1, d.breite - 2 * R)) * (n - 1)));
  const i = Math.floor(p), j = Math.min(n - 1, i + 1), a = p - i;
  return d.werte[i] * (1 - a) + d.werte[j] * a;
}

/** y einer Stelle der Leitkurve. */
export function yAn(d: Pick<FadenLinieBild, 'breite' | 'hoehe' | 'werte'>, x: number): number {
  const R = FADENLINIE.rand;
  return R + (1 - wertAn(d, x)) * (d.hoehe - 2 * R);
}

/** Die Stützpunkte der Leitkurve (rein): Normale aus der Steigung, Spreizung und Helligkeit aus dem Wert, Ausfransen ab HEUTE. */
export function fadenLinienProben(d: FadenLinieBild): Probe[] {
  const aus: Probe[] = [];
  if (d.werte.length < 2 || d.breite < 4) return aus;
  const R = FADENLINIE.rand, st = FADENLINIE.schritt;
  const hx = d.heute == null ? null : feldX(d, Math.max(0, Math.min(d.werte.length - 1, d.heute)));
  const faktor = d.handy ? 0.85 : 1;
  for (let x = R; x <= d.breite - R + 0.01; x += st) {
    const v = wertAn(d, x);
    const y = yAn(d, x);
    const dy = (yAn(d, x + 1.5) - yAn(d, x - 1.5)) / 3;
    const l = Math.hypot(1, dy) || 1;
    let hell = 0.6 + 0.85 * v;
    let frans = 0;
    if (hx != null) {
      hell *= x < hx ? 0.62 + 0.38 * glatt(x, R, hx) : 1;
      frans = glatt(x, hx + 2, hx + Math.max(40, (d.breite - hx) * 0.8)) * 0.9;
    }
    aus.push({ x, y, nx: -dy / l, ny: 1 / l, s: x, spreizung: (FADENLINIE.spreizMin + (FADENLINIE.spreizMax - FADENLINIE.spreizMin) * v) * faktor, hell, frans });
  }
  return aus;
}

export interface FadenLinieZeichner {
  setze(bild: FadenLinieBild): void;
  /** Läuft gerade der Aufbau? 0 … 1, null = fertig bzw. reduzierte Bewegung. */
  aufbau(): number | null;
  stop(): void;
  lauf: Lauf;
}

/** Der Mini-Zeichner einer Leinwand. `ruhig` (prefers-reduced-motion): ein Standbild ohne Aufbau, neu nur bei `setze`. */
export function fadenlinie(canvas: HTMLCanvasElement, beobachte: Element | null, ruhig: boolean): FadenLinieZeichner {
  const ctx = canvas.getContext('2d');
  let bild: FadenLinieBild | null = null;
  let proben: Probe[] = [];
  let start = -1, aufbauP: number | null = ruhig ? null : 0;
  let saatKey = '', saaten = fadenSaaten(1, 1);

  function zeichne(t: number) {
    const d = bild;
    if (!ctx || !d || d.breite < 4) return;
    const dpr = leinwand(canvas, d.breite, d.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, d.breite, d.hoehe);
    let front = Infinity;
    if (!ruhig && aufbauP != null) {
      if (start < 0) start = t;
      const p = (t - start) / FADENLINIE.aufbau;
      if (p >= 1) aufbauP = null;
      else { aufbauP = Math.max(0, p); front = (1 - (1 - aufbauP) ** 3) * (d.breite + LICHTFAEDEN.aufbauVerzug * 0.4) - 10; }
    }
    // Grundlinie (bzw. Nulllinie bei negativen Werten), gestrichelt und leise.
    const R = FADENLINIE.rand;
    const y0 = d.null0 != null ? R + (1 - d.null0) * (d.hoehe - 2 * R) : d.hoehe - R;
    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(R, Math.round(y0) + 0.5); ctx.lineTo(d.breite - R, Math.round(y0) + 0.5); ctx.stroke();
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    // Für den Aufbau braucht der Zeichner den Weg `s` — hier ist s = x.
    zeichneBuendel(ctx, proben, { farbe: d.farbe, saaten: [MITTE], deckkraft: 0.07, strich: d.handy ? 4 : 5, front }, t);
    zeichneBuendel(ctx, proben, {
      farbe: d.farbe, saaten, deckkraft: 0.3, strich: 0.7, front,
      punkte: { ...LICHTFAEDEN.punkte, abstand: 8, groesse: 1, hell: 2.2, jeder: 2 },
    }, t);
    ctx.globalCompositeOperation = 'source-over';

    // HEUTE: ein leuchtender Punkt auf der Leitkurve.
    if (d.heute != null && (front === Infinity || front > feldX(d, d.heute))) {
      const x = feldX(d, Math.max(0, Math.min(d.werte.length - 1, d.heute))), y = yAn(d, x);
      const [r, g, b] = rgb(d.farbe);
      ctx.fillStyle = `rgba(${r},${g},${b},.22)`;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${b},.95)`;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  const lauf = starteLauf({ beobachte, zeichne, ruhig, intervall: FADENLINIE.intervall });
  return {
    setze(neu) {
      bild = neu;
      const n = neu.handy ? FADENLINIE.faeden.handy : FADENLINIE.faeden.rechner;
      const key = `${neu.saat}|${n}`;
      if (key !== saatKey) { saatKey = key; saaten = fadenSaaten(n, textSaat(neu.saat)); }
      proben = fadenLinienProben(neu);
      lauf.einmal();
    },
    aufbau: () => aufbauP,
    stop() { lauf.stop(); },
    lauf,
  };
}
