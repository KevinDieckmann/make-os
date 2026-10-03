// ─── Lichtfäden — der Zeichner (Canvas 2D, ohne Framework, 03.10.2026) ──────
// Zeichnet Bündel feiner Fäden entlang einer abgetasteten Leitkurve (band.ts) — für das Fädenband aller Ebenen
// (lib/lichtfaeden/faedenband.ts) und für den Faden der Website (website/js/faden.js, über die übersetzte Fassung
// website/js/lichtfaeden.js). Kein WebGL, keine Bibliothek.
//   · Leistung wie die Neuronen-Bühne: gleiche Farbe + gleiche Deckkraft-Stufe = EIN Path2D und EIN Strich („Eimer“).
//     Ein Bündel mit 22 Fäden kostet so eine Handvoll Striche statt tausender.
//   · Leuchten ohne Weichzeichner: additive Mischung („lighter“) — wo Fäden sich kreuzen oder dicht liegen, wird es
//     von selbst hell; darunter ein breiter, sehr leiser Schein entlang der Leitkurve.
//   · Der Lauf (`starteLauf`) pausiert außerhalb des Bildes und im verborgenen Tab; bei „Bewegung reduzieren“ zeichnet er
//     nur auf Zuruf ein Standbild (t = 0).
// Kein Text, keine Namen, kein Speichern, kein Senden (die Website-Prüfung liest die übersetzte Fassung mit).

import { LICHTFAEDEN, versatz, type FadenSaat } from './band';

/** Eine Stelle der Leitkurve, fertig zum Zeichnen. */
export interface Probe {
  x: number;
  y: number;
  /** Normale (Einheitsvektor) — quer dazu liegen die Fäden. */
  nx: number;
  ny: number;
  /** Weg entlang der Kurve (Pixel) — treibt die Wellen der Fäden. */
  s: number;
  /** Spreizung des Bündels an dieser Stelle (Pixel). */
  spreizung: number;
  /** Helligkeit an dieser Stelle (0 = unsichtbar, 1 = normal, > 1 = leuchtet). */
  hell: number;
}

export interface BuendelStil {
  /** Farbe als #RRGGBB. */
  farbe: string;
  saaten: readonly FadenSaat[];
  /** Deckkraft eines Fadens bei Helligkeit 1 (Standard LICHTFAEDEN.deckkraft). */
  deckkraft?: number;
  /** Strichbreite (Standard LICHTFAEDEN.strich). */
  strich?: number;
}

/** #RRGGBB → [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!h) return [255, 255, 255];
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Ein Bündel zeichnen: je Faden die Probe um `versatz × spreizung` entlang der Normalen verschoben; Abschnitte gleicher
 * Deckkraft-Stufe landen im selben Pfad. Gibt die Zahl der Striche zurück (für Messungen).
 */
export function zeichneBuendel(ctx: CanvasRenderingContext2D, proben: readonly Probe[], stil: BuendelStil, t: number): number {
  if (proben.length < 2) return 0;
  const stufen = LICHTFAEDEN.stufen;
  const basis = stil.deckkraft ?? LICHTFAEDEN.deckkraft;
  const eimer = new Map<number, Path2D>();
  for (const f of stil.saaten) {
    let pfad: Path2D | null = null, stufe = -1, vx = 0, vy = 0;
    for (let k = 0; k < proben.length; k++) {
      const p = proben[k];
      const o = versatz(f, p.s, t) * p.spreizung;
      const x = p.x + p.nx * o, y = p.y + p.ny * o;
      if (k > 0) {
        const a = Math.min(1, basis * f.hell * p.hell);
        const st = Math.round(a * stufen);
        if (st <= 0) { pfad = null; stufe = -1; }
        else {
          if (st !== stufe || !pfad) {
            stufe = st;
            pfad = eimer.get(st) ?? null;
            if (!pfad) { pfad = new Path2D(); eimer.set(st, pfad); }
            pfad.moveTo(vx, vy);
          }
          pfad.lineTo(x, y);
        }
      }
      vx = x; vy = y;
    }
  }
  const [r, g, b] = rgb(stil.farbe);
  ctx.lineWidth = stil.strich ?? LICHTFAEDEN.strich;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [st, pfad] of eimer) {
    ctx.strokeStyle = `rgba(${r},${g},${b},${(st / stufen).toFixed(3)})`;
    ctx.stroke(pfad);
  }
  return eimer.size;
}

/** Leinwand auf CSS-Größe × Pixeldichte bringen (nur wenn nötig). Gibt die Pixeldichte zurück. */
export function leinwand(canvas: HTMLCanvasElement, breite: number, hoehe: number, dprMax: number = LICHTFAEDEN.dprMax): number {
  const dpr = Math.max(1, Math.min(dprMax, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
  const bw = Math.max(1, Math.round(breite * dpr)), bh = Math.max(1, Math.round(hoehe * dpr));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  return dpr;
}

/** Hat das Gerät Bewegung abbestellt? */
export function bewegungReduziert(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface LaufMessung { bilder: number; mittelMs: number; laengstesMs: number }
export interface Lauf {
  /** Ein Bild auf Zuruf (Daten/Größe geändert; bei reduzierter Bewegung der einzige Weg). */
  einmal(): void;
  stop(): void;
  /** Zeichenzeit je Bild (nur das Zeichnen, ohne den Rest der Seite). */
  messung(): LaufMessung;
}

/**
 * Der Lauf: ruft `zeichne(t)` je Bild (t = Millisekunden seit Start), solange `beobachte` im Bild und der Tab sichtbar
 * ist. `ruhig` (prefers-reduced-motion): keine Eigenbewegung — `zeichne(0)` nur über `einmal()`.
 */
export function starteLauf(o: { beobachte: Element | null; zeichne: (t: number) => void; ruhig: boolean }): Lauf {
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(Date.now()), 16) as unknown as number;
  const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id: number) => clearTimeout(id);
  let bilder = 0, summe = 0, laengstes = 0, beendet = false;
  const messen = (t: number) => {
    const a = typeof performance !== 'undefined' ? performance.now() : Date.now();
    o.zeichne(t);
    const d = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - a;
    bilder++; summe += d; if (d > laengstes) laengstes = d;
  };
  let start = -1, wartet = 0;
  const zeit = (jetzt: number) => { if (start < 0) start = jetzt; return o.ruhig ? 0 : jetzt - start; };
  const einmal = () => { if (beendet || wartet) return; wartet = raf(j => { wartet = 0; messen(zeit(j)); }); };
  const messung = () => ({ bilder, mittelMs: bilder ? summe / bilder : 0, laengstesMs: laengstes });
  if (o.ruhig) {
    einmal();
    return { einmal, stop: () => { beendet = true; if (wartet) caf(wartet); }, messung };
  }
  let sichtbar = true, laeuft = false, id = 0;
  const schritt = (j: number) => { if (!laeuft) return; messen(zeit(j)); id = raf(schritt); };
  const pruefe = () => {
    const soll = !beendet && sichtbar && !(typeof document !== 'undefined' && document.hidden);
    if (soll && !laeuft) { laeuft = true; id = raf(schritt); }
    else if (!soll && laeuft) { laeuft = false; caf(id); }
  };
  let io: IntersectionObserver | null = null;
  if (o.beobachte && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(es => { sichtbar = es.some(e => e.isIntersecting); pruefe(); }, { rootMargin: '120px 0px' });
    io.observe(o.beobachte);
  }
  const sicht = () => pruefe();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', sicht);
  pruefe();
  return {
    einmal: () => { if (!laeuft) einmal(); },
    stop: () => {
      beendet = true; laeuft = false; caf(id); if (wartet) caf(wartet);
      if (io) io.disconnect();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', sicht);
    },
    messung,
  };
}
