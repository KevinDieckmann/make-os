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
//   · Strahl v3 (04.10.): Fäden wachsen von links nach rechts ein (`front`, die Spitze leuchtet), Partikel wandern entlang
//     der Fäden nach rechts (`punkte`, ein Path2D je Deckkraft-Stufe, ein `fill`), rechts von HEUTE fransen sie aus
//     (`Probe.frans`), an Spitzen der Dichte fächern sie auf (`Probe.hub`). Glühen dichter Stellen über einen kleinen,
//     weichgezeichneten Schein-Puffer (`glanzPuffer`, ein drawImage hin und zurück); ein leises Netz-Motiv (`zeichneNetz`).
// Kein Text, keine Namen, kein Speichern, kein Senden (die Website-Prüfung liest die übersetzte Fassung mit).

import { LICHTFAEDEN, TAU, fransen, versatz, zufall, type FadenSaat } from './band';

/** Eine Stelle der Leitkurve, fertig zum Zeichnen. */
export interface Probe {
  x: number;
  y: number;
  /** Normale (Einheitsvektor) — quer dazu liegen die Fäden. */
  nx: number;
  ny: number;
  /** Weg entlang der Kurve (Pixel) — treibt die Wellen der Fäden; wächst entlang der Kurve. */
  s: number;
  /** Spreizung des Bündels an dieser Stelle (Pixel). */
  spreizung: number;
  /** Helligkeit an dieser Stelle (0 = unsichtbar, 1 = normal, > 1 = leuchtet). */
  hell: number;
  /** Ausfransen 0 … 1 (v3: rechts von HEUTE) — Fäden lösen sich aus dem Bündel und werden blasser. */
  frans?: number;
  /** Ausschlag an einer Spitze (Pixel, schon in `y` enthalten) — die Fäden fächern um ihn auf. */
  hub?: number;
}

/** Partikel entlang der Fäden (Standard: LICHTFAEDEN.punkte); `jeder` = nur jeder n-te Faden trägt welche. */
export interface PunkteStil { abstand: number; tempo: number; groesse: number; hell: number; jeder?: number }

export interface BuendelStil {
  /** Farbe als #RRGGBB. */
  farbe: string;
  saaten: readonly FadenSaat[];
  /** Deckkraft eines Fadens bei Helligkeit 1 (Standard LICHTFAEDEN.deckkraft). */
  deckkraft?: number;
  /** Strichbreite (Standard LICHTFAEDEN.strich). */
  strich?: number;
  /** Aufbau (v3): bis zu diesem Weg `s` ist das Bündel gewachsen; jeder Faden läuft etwas hinterher, seine Spitze leuchtet. */
  front?: number;
  /** Partikel entlang der Fäden (v3). */
  punkte?: PunkteStil | null;
}

/** #RRGGBB → [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!h) return [255, 255, 255];
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Ein Bündel zeichnen: je Faden die Probe um `versatz × spreizung` (+ Ausfransen, + Fächer an Spitzen) entlang der Normalen
 * verschoben; Abschnitte gleicher Deckkraft-Stufe landen im selben Pfad, Partikel im selben Punkt-Pfad. Gibt die Zahl der
 * Striche und Füllungen zurück (für Messungen).
 */
export function zeichneBuendel(ctx: CanvasRenderingContext2D, proben: readonly Probe[], stil: BuendelStil, t: number): number {
  if (proben.length < 2) return 0;
  const stufen = LICHTFAEDEN.stufen;
  const basis = stil.deckkraft ?? LICHTFAEDEN.deckkraft;
  const F = LICHTFAEDEN.frans;
  // Ohne Front (oder unendlich) ist das Bündel ganz da.
  const front = stil.front != null && isFinite(stil.front) ? stil.front : null;
  const spitze = LICHTFAEDEN.aufbauSpitze;
  const pk = stil.punkte ?? null;
  const g = pk ? pk.groesse : 0, gh = g / 2;
  const eimer = new Map<number, Path2D>();
  const punktEimer = new Map<number, Path2D>();
  const saaten = stil.saaten;
  for (let fi = 0; fi < saaten.length; fi++) {
    const f = saaten[fi];
    const reicht = front == null ? null : front - (f.phase / TAU) * LICHTFAEDEN.aufbauVerzug;
    const mitPunkten = !!pk && fi % Math.max(1, pk.jeder ?? 1) === 0;
    const verschub = pk && mitPunkten ? t * pk.tempo + (f.phase / TAU) * pk.abstand : 0;
    const faecher = (f.welle - 0.65) * 0.8;
    let pfad: Path2D | null = null, stufe = -1, vx = 0, vy = 0, vs = 0, vq = 0;
    for (let k = 0; k < proben.length; k++) {
      const p = proben[k];
      if (reicht != null && p.s > reicht) break;
      let o = versatz(f, p.s, t) * p.spreizung;
      const fr = p.frans ?? 0;
      if (fr > 0) o += fr * F.weite * Math.max(p.spreizung, F.min) * fransen(f, p.s, t);
      if (p.hub) o += p.hub * faecher;
      const x = p.x + p.nx * o, y = p.y + p.ny * o;
      const q = pk && mitPunkten ? Math.floor((p.s - verschub) / pk.abstand) : 0;
      if (k > 0) {
        let a = basis * f.hell * p.hell;
        if (fr > 0) a *= 1 - fr * F.blass * (0.4 + 0.6 * Math.min(1, Math.abs(f.lage)));
        if (reicht != null) { const r = reicht - p.s; if (r < spitze) a *= 1 + 1.8 * (1 - r / spitze); }
        a = Math.min(1, a);
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
        if (pk && mitPunkten && q > vq && st > 0) {
          // Ein Partikel an der Stelle q · abstand + verschub zwischen der vorigen und dieser Probe — wandert mit der Zeit nach rechts.
          const u = (q * pk.abstand + verschub - vs) / ((p.s - vs) || 1);
          const ps = Math.round(Math.min(1, a * pk.hell) * stufen);
          let pp = punktEimer.get(ps);
          if (!pp) { pp = new Path2D(); punktEimer.set(ps, pp); }
          pp.rect(vx + (x - vx) * u - gh, vy + (y - vy) * u - gh, g, g);
        }
      }
      vx = x; vy = y; vs = p.s; vq = q;
    }
  }
  const [r, gr, b] = rgb(stil.farbe);
  ctx.lineWidth = stil.strich ?? LICHTFAEDEN.strich;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [st, pfad] of eimer) {
    ctx.strokeStyle = `rgba(${r},${gr},${b},${(st / stufen).toFixed(3)})`;
    ctx.stroke(pfad);
  }
  for (const [st, pp] of punktEimer) {
    ctx.fillStyle = `rgba(${r},${gr},${b},${(st / stufen).toFixed(3)})`;
    ctx.fill(pp);
  }
  return eimer.size + punktEimer.size;
}

/** Der Schein-Puffer: zeichnet das bisher Gezeichnete verkleinert und weichgezeichnet additiv darüber (Glühen dichter Stellen). */
export interface GlanzPuffer { auf(ctx: CanvasRenderingContext2D, quelle: HTMLCanvasElement, breite: number, hoehe: number, staerke?: number): void }
/** Ein Schein-Puffer (eine kleine Leinwand) — null ohne DOM. */
export function glanzPuffer(): GlanzPuffer | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  const g = c.getContext ? c.getContext('2d') : null;
  if (!g) return null;
  return {
    auf(ctx, quelle, breite, hoehe, staerke = LICHTFAEDEN.glanz.staerke) {
      const T = LICHTFAEDEN.glanz.teiler;
      const w = Math.max(1, Math.round(breite / T)), h = Math.max(1, Math.round(hoehe / T));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'copy';
      g.filter = `blur(${LICHTFAEDEN.glanz.weich}px)`;
      g.drawImage(quelle, 0, 0, w, h);
      g.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = staerke;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(c, 0, 0, breite, hoehe);
      ctx.restore();
    },
  };
}

/** Ein leises Netz aus Knoten und Linien (Motiv aus dem Vorbild) in einem Rechteck; die Knoten treiben sehr langsam. */
export function zeichneNetz(ctx: CanvasRenderingContext2D, o: { x: number; y: number; breite: number; hoehe: number; t: number; farbe: string; saat?: number; knoten?: number; deckkraft?: number }): void {
  const r = zufall(o.saat ?? 7);
  const n = Math.max(3, o.knoten ?? 11);
  const pk: { x: number; y: number; g: number }[] = [];
  for (let i = 0; i < n; i++) {
    const bx = r(), by = r(), ph = r() * TAU, amp = 4 + r() * 7;
    pk.push({ x: o.x + bx * o.breite + Math.sin(o.t * 0.00011 + ph) * amp, y: o.y + by * o.hoehe + Math.cos(o.t * 0.00009 + ph * 1.3) * amp * 0.7, g: 1.3 + r() * 1.5 });
  }
  const max = Math.max(o.breite, o.hoehe) * 0.5;
  const a0 = o.deckkraft ?? 0.16;
  const [cr, cg, cb] = rgb(o.farbe);
  const linien = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.hypot(pk[i].x - pk[j].x, pk[i].y - pk[j].y);
    if (d >= max) continue;
    const l = linien[d < max * 0.45 ? 0 : d < max * 0.75 ? 1 : 2];
    l.moveTo(pk[i].x, pk[i].y); l.lineTo(pk[j].x, pk[j].y);
  }
  ctx.lineWidth = 0.6;
  linien.forEach((l, i) => { ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(a0 * [1, 0.6, 0.3][i]).toFixed(3)})`; ctx.stroke(l); });
  const knoten = new Path2D();
  for (const p of pk) { knoten.moveTo(p.x + p.g, p.y); knoten.arc(p.x, p.y, p.g, 0, TAU); }
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${(a0 * 0.7).toFixed(3)})`;
  ctx.fill(knoten);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, a0 * 2.4).toFixed(3)})`;
  ctx.stroke(knoten);
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
export function starteLauf(o: { beobachte: Element | null; zeichne: (t: number) => void; ruhig: boolean; /** Mindestabstand der Bilder (ms) — kleine, ruhige Leinwände brauchen keine 60 Bilder. */ intervall?: number }): Lauf {
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
  let sichtbar = true, laeuft = false, id = 0, zuletzt = -1e9;
  const abstand = Math.max(0, o.intervall ?? 0);
  const schritt = (j: number) => {
    if (!laeuft) return;
    if (!abstand || j - zuletzt >= abstand - 1) { zuletzt = j; messen(zeit(j)); }
    id = raf(schritt);
  };
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
