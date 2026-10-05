// ─── MAKE OS — Kugel: der Motor (WebGL 1, 05.10.2026) ───────────────────────
// Eine Leinwand, ein Programm, ein Puffer. Leistung (UMBAU_ABEND_0410.md 1/3):
//   · Puffergröße nach der Layout-Box (ResizeObserver), dpr ≤ 2.
//   · Bildrate gedeckelt (`fps`: groß 60, Symbol 24–30); die Schleife PAUSIERT außerhalb des Bildes (IntersectionObserver)
//     und im verborgenen Tab (visibilitychange) — dann wird nichts gerechnet.
//   · „Bewegung reduzieren“: keine Schleife, kein Einstieg — ein ruhiges Standbild, neu gezeichnet nur bei Änderung.
//   · Kontextverlust wird abgefangen und beim Zurückkommen neu aufgebaut; beim Abbauen wird der Kontext freigegeben
//     (WEBGL_lose_context), damit das Symbol beim Auf-/Zuklappen keine Kontexte ansammelt.
// Messpunkt (nur außerhalb der Produktion oder mit `data-messen`): data-bilder, data-mittel-ms (CPU je Bild), data-fps,
// data-punkte, data-puffer an der Leinwand — wie beim Lichtfäden-Band.

import {
  drehung, perspektive, kameraAbstand, zeigerAufKugel, aufBildschirm, nachziehen, einstieg, klemme, norm, sub, laenge,
  type KugelZustand, type Mat4, type Vec3,
} from './geometrie';
import { ECKEN_SHADER, FLAECHEN_SHADER, UNIFORMS, type UniformName } from './shader';

/** Die Wolke: Positionen (Einheitsvektoren), optional Farben (rgb 0…1), Werte (Größe, Helligkeit, Saat, Verlauf). */
export interface KugelDaten {
  pos: Float32Array;
  farbe?: Float32Array;
  wert: Float32Array;
  /** Die ersten `pickbar` Punkte sind zeigbar (Datensätze) — der Rest ist Form (Hülle). */
  pickbar?: number;
}

export interface MotorOptionen {
  /** Höchstens so viele Bilder je Sekunde. */
  fps: number;
  /** „Bewegung reduzieren“: Standbild. */
  ruhig: boolean;
  /** Punktgröße in CSS-Pixeln bei Grundabstand (wird mit dpr multipliziert). */
  punktPx: number;
  /** Farbverlauf über die Kugel (ZOE) statt Farbe je Punkt (Brain). */
  verlauf: boolean;
  /** Verlauf und Glut als rgb 0…1 — aus den Token (KUGEL), nie Literale. */
  farben: { a: Vec3; b: Vec3; glut: Vec3 };
  /** Drehung in rad/s (Lauf um die Hochachse) und feste Neigung. */
  drehTempo: number;
  neigung: number;
  /** Anteil der kurzen Seite, den die Kugel füllt. */
  fuellung: number;
  /** Einstieg 2,4 s abspielen. */
  einstieg: boolean;
  /** Zeiger-Ausbruch: Reichweite (Bogenmaß-Abstand auf der Einheitskugel) und Stärke. */
  zeigerRadius: number;
  flare: number;
  /** Dunkelheit der hohlen Mitte (0 = schwarz, 1 = nicht hohl). */
  grund: number;
}

export interface Messung { bilder: number; mittelMs: number; fps: number; punkte: number; puffer: string }

export interface Motor {
  setzeZustand(z: KugelZustand): void;
  setzeDaten(d: KugelDaten): void;
  /** Zeiger in CSS-Pixeln relativ zur Leinwand (null = weg). Liefert, ob er die Kugel trifft. */
  zeiger(x: number | null, y?: number): boolean;
  /** Ausbruch an einem Datenpunkt (Hervorheben, Tastatur) statt am Zeiger; null = Zeiger wieder frei. */
  hebeHervor(index: number | null): void;
  /** Nächster zeigbarer Punkt unter (x, y) in CSS-Pixeln (nur vorne, höchstens `radius` Pixel entfernt). */
  treffer(x: number, y: number, radius?: number): number | null;
  /** Wo ein Punkt gerade auf dem Bildschirm steht (CSS-Pixel). */
  bildschirm(index: number): { x: number; y: number; vorne: boolean } | null;
  /** Drehung anhalten (z. B. solange ein Punkt gezeigt wird — Titel und Linien bleiben dann stehen). */
  halte(an: boolean): void;
  messung(): Messung;
  zerstoere(): void;
}

const FOV = (34 * Math.PI) / 180;
const MESS_FENSTER = 120;

/** Ist WebGL 1 überhaupt da? (ohne eine Leinwand zu verbrauchen, die die Seite braucht) */
export function webglMoeglich(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function baueProgramm(gl: WebGLRenderingContext): WebGLProgram | null {
  const shader = (art: number, quelle: string) => {
    const s = gl.createShader(art);
    if (!s) return null;
    gl.shaderSource(s, quelle); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('Kugel: Shader', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; }
    return s;
  };
  const v = shader(gl.VERTEX_SHADER, ECKEN_SHADER), f = shader(gl.FRAGMENT_SHADER, FLAECHEN_SHADER);
  if (!v || !f) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('Kugel: Programm', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
  return p;
}

/**
 * Startet die Kugel auf `leinwand`. Liefert null, wenn es kein WebGL gibt (dann zeigt die Komponente ihren Rückfall).
 */
export function starteMotor(leinwand: HTMLCanvasElement, startDaten: KugelDaten, opt: MotorOptionen, startZustand: KugelZustand): Motor | null {
  const attribute: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  let gl = leinwand.getContext('webgl', attribute) as WebGLRenderingContext | null;
  if (!gl) return null;

  let daten = startDaten;
  let programm: WebGLProgram | null = null;
  let puffer: { pos: WebGLBuffer | null; farbe: WebGLBuffer | null; wert: WebGLBuffer | null } = { pos: null, farbe: null, wert: null };
  let ort: Partial<Record<UniformName, WebGLUniformLocation | null>> = {};
  let attr = { pos: -1, farbe: -1, wert: -1 };
  let anzahl = 0;

  const messen = process.env.NODE_ENV !== 'production' || leinwand.hasAttribute('data-messen');
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  function aufbauen(): boolean {
    if (!gl) return false;
    programm = baueProgramm(gl);
    if (!programm) return false;
    gl.useProgram(programm);
    ort = Object.fromEntries(UNIFORMS.map(n => [n, gl!.getUniformLocation(programm!, n)]));
    attr = { pos: gl.getAttribLocation(programm, 'aPos'), farbe: gl.getAttribLocation(programm, 'aFarbe'), wert: gl.getAttribLocation(programm, 'aWert') };
    puffer = { pos: gl.createBuffer(), farbe: gl.createBuffer(), wert: gl.createBuffer() };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additiv — das Leuchten entsteht aus der Dichte, nicht aus einem Weichzeichner
    gl.clearColor(0, 0, 0, 0);
    laden(daten);
    return true;
  }

  function laden(d: KugelDaten) {
    if (!gl || !programm) return;
    daten = d;
    anzahl = Math.floor(d.pos.length / 3);
    const binde = (b: WebGLBuffer | null, werte: Float32Array, a: number, groesse: number) => {
      if (a < 0) return;
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, werte, gl!.STATIC_DRAW);
      gl!.enableVertexAttribArray(a);
      gl!.vertexAttribPointer(a, groesse, gl!.FLOAT, false, 0, 0);
    };
    binde(puffer.pos, d.pos, attr.pos, 3);
    binde(puffer.wert, d.wert, attr.wert, 4);
    if (d.farbe && attr.farbe >= 0) binde(puffer.farbe, d.farbe, attr.farbe, 3);
    else if (attr.farbe >= 0) { gl.disableVertexAttribArray(attr.farbe); gl.vertexAttrib3f(attr.farbe, 1, 1, 1); }
  }

  if (!aufbauen()) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return null; }

  // ── Zustand der Szene ──
  let ziel = startZustand, ist = startZustand;
  let phase = Math.random() * 40; // zufälliger Startpunkt: jedes Öffnen steht an einer anderen Stelle der Bewegung
  let winkel = Math.random() * Math.PI * 2;
  let halten = false;
  let zeigerZiel: Vec3 | null = null, zeigerIst: Vec3 = [0, 0, 1], kraft = 0;
  let hervor: number | null = null;
  const startZeit = performance.now();
  let einstiegFertig = !opt.einstieg || opt.ruhig;
  let letztes = 0, bild = 0, laeuft = false, imBild = true;
  let breiteCss = 1, hoeheCss = 1;
  let dreh: Mat4 = drehung(winkel, opt.neigung);
  let proj: Mat4 = perspektive(FOV, 1, 0.1, 50);
  let abstand = kameraAbstand(FOV, 1, opt.fuellung);
  const dauer: number[] = []; const abstaende: number[] = []; let bilder = 0;

  function groesse() {
    const r = leinwand.getBoundingClientRect();
    breiteCss = Math.max(1, r.width); hoeheCss = Math.max(1, r.height);
    const w = Math.max(1, Math.round(breiteCss * dpr())), h = Math.max(1, Math.round(hoeheCss * dpr()));
    if (leinwand.width !== w || leinwand.height !== h) { leinwand.width = w; leinwand.height = h; }
    const aspekt = breiteCss / hoeheCss;
    proj = perspektive(FOV, aspekt, 0.1, 50);
    abstand = kameraAbstand(FOV, aspekt, opt.fuellung);
    if (messen) leinwand.dataset.puffer = `${w}x${h}`;
  }

  function zeichne(jetzt: number) {
    if (!gl || !programm || gl.isContextLost()) return;
    const t0 = performance.now();
    const dt = letztes ? Math.min(0.1, (jetzt - letztes) / 1000) : 1 / 60;
    if (letztes) abstaende.push(jetzt - letztes);
    letztes = jetzt;
    const bewegt = !opt.ruhig;
    if (bewegt) {
      ist = nachziehen(ist, ziel, dt);
      phase += dt * ist.tempo;
      if (!halten) winkel += dt * opt.drehTempo;
    } else ist = ziel;
    dreh = drehung(winkel, opt.neigung);

    // Zeiger bzw. hervorgehobener Punkt: Ort und Stärke folgen weich (0,18 / 0,09 je Bild wie in der Vorlage).
    let zielOrt: Vec3 | null = zeigerZiel;
    if (hervor !== null && hervor < anzahl) zielOrt = [daten.pos[hervor * 3], daten.pos[hervor * 3 + 1], daten.pos[hervor * 3 + 2]];
    const f = (k: number) => (bewegt ? 1 - (1 - k) ** (dt * 60) : 1);
    if (zielOrt) {
      // Springt der Zeiger auf die andere Seite, nicht quer durch die Kugel ziehen — direkt umsetzen.
      zeigerIst = laenge(sub(zielOrt, zeigerIst)) > 1.2 ? zielOrt : norm([zeigerIst[0] + (zielOrt[0] - zeigerIst[0]) * f(0.18), zeigerIst[1] + (zielOrt[1] - zeigerIst[1]) * f(0.18), zeigerIst[2] + (zielOrt[2] - zeigerIst[2]) * f(0.18)]);
    }
    kraft += ((zielOrt ? 1 : 0) - kraft) * f(0.09);

    const ms = jetzt - startZeit;
    const e = einstiegFertig ? { sicht: 1, hohl: 1, naeher: 0 } : einstieg(ms);
    if (!einstiegFertig && ms > 2400) einstiegFertig = true;

    gl.viewport(0, 0, leinwand.width, leinwand.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const u = ort;
    gl.uniformMatrix4fv(u.uProj!, false, proj);
    gl.uniformMatrix4fv(u.uDreh!, false, dreh);
    gl.uniform1f(u.uAbstand!, abstand);
    gl.uniform1f(u.uPhase!, phase);
    gl.uniform1f(u.uUhr!, bewegt ? ms / 1000 : 0);
    gl.uniform1f(u.uAtem!, bewegt ? ist.atem : 0);
    gl.uniform1f(u.uWeite!, ist.weite);
    gl.uniform1f(u.uVerschiebung!, ist.verschiebung);
    gl.uniform1f(u.uHell!, ist.hell);
    gl.uniform1f(u.uVerlauf!, opt.verlauf ? 1 : 0);
    gl.uniform3fv(u.uFarbeA!, opt.farben.a);
    gl.uniform3fv(u.uFarbeB!, opt.farben.b);
    gl.uniform3fv(u.uGlut!, opt.farben.glut);
    gl.uniform3fv(u.uZeiger!, zeigerIst);
    gl.uniform1f(u.uZeigerKraft!, kraft);
    gl.uniform1f(u.uZeigerRadius!, opt.zeigerRadius);
    gl.uniform1f(u.uFlare!, opt.flare);
    gl.uniform1f(u.uSicht!, e.sicht);
    gl.uniform1f(u.uHohl!, e.hohl);
    gl.uniform1f(u.uNaeher!, e.naeher);
    gl.uniform1f(u.uPunktPx!, opt.punktPx * dpr());
    gl.uniform1f(u.uGrund!, opt.grund);
    gl.drawArrays(gl.POINTS, 0, anzahl);

    bilder++;
    if (messen) {
      dauer.push(performance.now() - t0);
      if (dauer.length > MESS_FENSTER) dauer.shift();
      if (abstaende.length > MESS_FENSTER) abstaende.shift();
      if (bilder % 30 === 0 || opt.ruhig) {
        const m = messung();
        leinwand.dataset.bilder = String(m.bilder); leinwand.dataset.mittelMs = m.mittelMs.toFixed(3);
        leinwand.dataset.fps = m.fps.toFixed(1); leinwand.dataset.punkte = String(m.punkte);
      }
    }
  }

  function messung(): Messung {
    const mittel = dauer.length ? dauer.reduce((a, v) => a + v, 0) / dauer.length : 0;
    const ab = abstaende.length ? abstaende.reduce((a, v) => a + v, 0) / abstaende.length : 0;
    return { bilder, mittelMs: mittel, fps: ab ? 1000 / ab : 0, punkte: anzahl, puffer: `${leinwand.width}x${leinwand.height}` };
  }

  // ── Schleife: läuft nur, wenn sichtbar; Bildrate gedeckelt ──
  const mindestAbstand = 1000 / Math.max(1, opt.fps);
  // Takt mit Sollzeit statt „seit dem letzten Bild“: bei 60 Hz und Deckel 24 wechseln sich 2 und 3 Bildschirmbilder ab
  // (im Mittel 24) — mit „seit dem letzten Bild“ würden es immer 3, also nur 20 je Sekunde.
  let naechstes = 0;
  function schritt(jetzt: number) {
    bild = 0;
    if (!laeuft) return;
    if (jetzt >= naechstes - 1) { zeichne(jetzt); naechstes = Math.max(naechstes + mindestAbstand, jetzt); }
    bild = requestAnimationFrame(schritt);
  }
  function anwerfen() {
    if (opt.ruhig) { zeichne(performance.now()); return; }
    if (laeuft || !imBild || document.hidden || (gl && gl.isContextLost())) return;
    laeuft = true; letztes = 0; naechstes = 0;
    bild = requestAnimationFrame(schritt);
  }
  function anhalten() { laeuft = false; if (bild) cancelAnimationFrame(bild); bild = 0; }
  /** Im Standbild nach einer Änderung einmal neu zeichnen. */
  const neuZeichnen = () => { if (opt.ruhig) zeichne(performance.now()); };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { groesse(); neuZeichnen(); }) : null;
  ro?.observe(leinwand);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(e => {
    imBild = e.some(x => x.isIntersecting);
    if (imBild) anwerfen(); else anhalten();
  }) : null;
  io?.observe(leinwand);
  const sichtbarkeit = () => { if (document.hidden) anhalten(); else anwerfen(); };
  document.addEventListener('visibilitychange', sichtbarkeit);
  const verloren = (e: Event) => { e.preventDefault(); anhalten(); };
  const zurueck = () => { gl = leinwand.getContext('webgl', attribute) as WebGLRenderingContext | null; if (gl && aufbauen()) { groesse(); anwerfen(); } };
  leinwand.addEventListener('webglcontextlost', verloren);
  leinwand.addEventListener('webglcontextrestored', zurueck);

  groesse();
  anwerfen();

  return {
    setzeZustand(z) { ziel = z; neuZeichnen(); },
    setzeDaten(d) { laden(d); neuZeichnen(); },
    zeiger(x, y) {
      if (x === null || y === undefined) { zeigerZiel = null; neuZeichnen(); return false; }
      const ndc: [number, number] = [(x / breiteCss) * 2 - 1, 1 - (y / hoeheCss) * 2];
      zeigerZiel = zeigerAufKugel(ndc, FOV, breiteCss / hoeheCss, abstand, dreh, 1);
      neuZeichnen();
      return !!zeigerZiel;
    },
    hebeHervor(i) { hervor = i; neuZeichnen(); },
    treffer(x, y, radius = 14) {
      const n = klemme(daten.pickbar ?? anzahl, 0, anzahl);
      let best: number | null = null, bestD = radius * radius;
      for (let i = 0; i < n; i++) {
        const s = aufBildschirm([daten.pos[i * 3], daten.pos[i * 3 + 1], daten.pos[i * 3 + 2]], dreh, proj, abstand, breiteCss, hoeheCss);
        if (!s.vorne) continue;
        const d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    },
    bildschirm(i) {
      if (i < 0 || i >= anzahl) return null;
      return aufBildschirm([daten.pos[i * 3], daten.pos[i * 3 + 1], daten.pos[i * 3 + 2]], dreh, proj, abstand, breiteCss, hoeheCss);
    },
    halte(an) { halten = an; },
    messung,
    zerstoere() {
      anhalten();
      ro?.disconnect(); io?.disconnect();
      document.removeEventListener('visibilitychange', sichtbarkeit);
      leinwand.removeEventListener('webglcontextlost', verloren);
      leinwand.removeEventListener('webglcontextrestored', zurueck);
      const g = gl;
      if (g && !g.isContextLost()) {
        g.deleteBuffer(puffer.pos); g.deleteBuffer(puffer.farbe); g.deleteBuffer(puffer.wert);
        if (programm) g.deleteProgram(programm);
        // Kontext erst freigeben, wenn die Leinwand wirklich weg ist: React (Strict Mode, schneller Neuaufbau) startet auf
        // DERSELBEN Leinwand neu — ein schon verlorener Kontext ließe sich dort nicht mehr nutzen (Shader schlägt fehl).
        setTimeout(() => { if (!leinwand.isConnected && !g.isContextLost()) g.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
      }
      gl = null;
    },
  };
}
