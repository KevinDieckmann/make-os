// ─── MAKE OS — Kugel: der Motor (WebGL 1, 05.10.2026 · Überarbeitung „Solaris“) ─
// Eine Leinwand, drei kleine Programme (Punkte, Weichzeichner, Mischen), ein Punkt-Puffer. Bild je Durchlauf:
//   1. Punkte in einen kleinen Glüh-Puffer (¼ Kantenlänge; im Brain nur die Sterne) → 2 × trennbarer Gauß (zweite Runde
//      weiter) — das Glühen (Bloom) kostet so ~1/16 der Pixel.
//   2. Punkte scharf auf die Leinwand, additiv.
//   3. Glühen additiv darüber.
// Leistung (UMBAU_ABEND_0410.md 1/3, Auftrag 05.10.):
//   · Puffergröße nach der Layout-Box (ResizeObserver), dpr ≤ 2.
//   · Bildrate gedeckelt (`fps`) mit Sollzeit; die Schleife PAUSIERT außerhalb des Bildes (IntersectionObserver) und im
//     verborgenen Tab (visibilitychange).
//   · Glühen schaltet sich auf schwachen Geräten selbst ab (`bloomAuto`: Mittel der Bildabstände deutlich über dem Soll)
//     und ist über `bloom: 0` ganz aus.
//   · „Bewegung reduzieren“: keine Schleife, kein Einstieg — ein ruhiges Standbild, neu gezeichnet nur bei Änderung.
//   · Kontextverlust wird abgefangen; beim Abbauen wird der Kontext erst freigegeben, wenn die Leinwand wirklich weg ist.
// Kamera: Lauf um die Hochachse + Neigung + Abstand — `fliegeZu` fährt weich auf eine Richtung (Brain: Cluster), `zurueck`
// wieder in die Gesamtsicht. Messpunkt (nur außerhalb der Produktion oder mit `data-messen`): data-bilder, data-mittel-ms
// (CPU je Bild), data-fps, data-punkte, data-puffer, data-gluehen an der Leinwand.

import {
  drehung, perspektive, kameraAbstand, zeigerAufKugel, aufBildschirm, nachziehen, einstieg, klemme, norm, sub, laenge, blickAuf, winkelNah,
  type KugelZustand, type Mat4, type Vec3,
} from './geometrie';
import { ECKEN_SHADER, FLAECHEN_SHADER, FLAECHE_ECKEN, WEICH_SHADER, MISCH_SHADER, UNIFORMS, type UniformName } from './shader';

/** Die Wolke: Positionen, optional Farben (rgb 0…1), Werte (Größe, Helligkeit, Saat, Verlauf bzw. Stern). */
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
  /** Zeiger-Ausbruch: Reichweite (Abstand auf der Einheitskugel) und Stärke. */
  zeigerRadius: number;
  flare: number;
  /** Dunkelheit der hohlen Mitte (0 = schwarz, 1 = nicht hohl). */
  grund: number;
  /** Wie stark die Rückseite gedämpft wird (0 = gar nicht, 1 = ganz). */
  tiefe: number;
  /** Stärke des Glühens (0 = aus) und ob es sich auf schwachen Geräten selbst abschaltet. */
  bloom: number;
  bloomAuto: boolean;
  /** Glühen nur aus den Sternen (Brain) statt aus allen Punkten (ZOE). */
  bloomNurSterne: boolean;
  /** Nach jedem Bild (z. B. Beschriftungen und Bögen neu setzen) — läuft im selben Takt, kein eigener Lauf. */
  nachBild?: () => void;
}

export interface Messung { bilder: number; mittelMs: number; fps: number; punkte: number; puffer: string; gluehen: boolean }

export interface Motor {
  setzeZustand(z: KugelZustand): void;
  setzeDaten(d: KugelDaten): void;
  /** Zeiger in CSS-Pixeln relativ zur Leinwand (null = weg). Liefert, ob er die Kugel trifft. */
  zeiger(x: number | null, y?: number): boolean;
  /** Ausbruch an einem Datenpunkt (Hervorheben, Tastatur) statt am Zeiger; null = Zeiger wieder frei. */
  hebeHervor(index: number | null): void;
  /** Nächster zeigbarer Punkt unter (x, y) in CSS-Pixeln (nur vorne, höchstens `radius` Pixel entfernt). */
  treffer(x: number, y: number, radius?: number): number | null;
  /** Wo ein Punkt (Index) bzw. ein beliebiger Ort auf/über der Kugel gerade auf dem Bildschirm steht (CSS-Pixel). */
  bildschirm(index: number): { x: number; y: number; vorne: boolean } | null;
  ort(p: Vec3): { x: number; y: number; vorne: boolean };
  /** Radius der Kugel (Radius 1) auf dem Bildschirm in CSS-Pixeln — Umriss für Beschriftungen. */
  schirmRadius(): number;
  /** Drehung anhalten (z. B. solange ein Punkt gezeigt wird — Titel und Bögen bleiben dann stehen). */
  halte(an: boolean): void;
  /** Kamera fährt weich auf die Richtung `c` (näher: Anteil des Abstands, z. B. 0,6) — null = zurück in die Gesamtsicht. */
  fliegeZu(c: Vec3 | null, naeher?: number): void;
  messung(): Messung;
  zerstoere(): void;
}

const FOV = (34 * Math.PI) / 180;
const MESS_FENSTER = 120;
/** Kantenlänge des Glüh-Puffers relativ zur Leinwand. */
const GLUEH_ANTEIL = 0.25;

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

function baueProgramm(gl: WebGLRenderingContext, ecken: string, flaechen: string): WebGLProgram | null {
  const shader = (art: number, quelle: string) => {
    const s = gl.createShader(art);
    if (!s) return null;
    gl.shaderSource(s, quelle); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('Kugel: Shader', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; }
    return s;
  };
  const v = shader(gl.VERTEX_SHADER, ecken), f = shader(gl.FRAGMENT_SHADER, flaechen);
  if (!v || !f) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('Kugel: Programm', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
  return p;
}

interface Ziel { tex: WebGLTexture | null; fb: WebGLFramebuffer | null; w: number; h: number }

/**
 * Startet die Kugel auf `leinwand`. Liefert null, wenn es kein WebGL gibt (dann zeigt die Komponente ihren Rückfall).
 */
export function starteMotor(leinwand: HTMLCanvasElement, startDaten: KugelDaten, opt: MotorOptionen, startZustand: KugelZustand): Motor | null {
  const attribute: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  let gl = leinwand.getContext('webgl', attribute) as WebGLRenderingContext | null;
  if (!gl) return null;

  let daten = startDaten;
  let punkte: WebGLProgram | null = null, weich: WebGLProgram | null = null, misch: WebGLProgram | null = null;
  let puffer: { pos: WebGLBuffer | null; farbe: WebGLBuffer | null; wert: WebGLBuffer | null; ecken: WebGLBuffer | null } = { pos: null, farbe: null, wert: null, ecken: null };
  let ort: Partial<Record<UniformName, WebGLUniformLocation | null>> = {};
  let attr = { pos: -1, farbe: -1, wert: -1 };
  let wOrt = { bild: null as WebGLUniformLocation | null, schritt: null as WebGLUniformLocation | null, ecke: -1 };
  let mOrt = { bild: null as WebGLUniformLocation | null, staerke: null as WebGLUniformLocation | null, ecke: -1 };
  let anzahl = 0;
  let gluehen = opt.bloom > 0;
  const ziele: [Ziel, Ziel] = [{ tex: null, fb: null, w: 0, h: 0 }, { tex: null, fb: null, w: 0, h: 0 }];

  const messen = process.env.NODE_ENV !== 'production' || leinwand.hasAttribute('data-messen');
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  function aufbauen(): boolean {
    const g = gl;
    if (!g) return false;
    punkte = baueProgramm(g, ECKEN_SHADER, FLAECHEN_SHADER);
    if (!punkte) return false;
    ort = Object.fromEntries(UNIFORMS.map(n => [n, g.getUniformLocation(punkte!, n)]));
    attr = { pos: g.getAttribLocation(punkte, 'aPos'), farbe: g.getAttribLocation(punkte, 'aFarbe'), wert: g.getAttribLocation(punkte, 'aWert') };
    puffer = { pos: g.createBuffer(), farbe: g.createBuffer(), wert: g.createBuffer(), ecken: g.createBuffer() };
    g.bindBuffer(g.ARRAY_BUFFER, puffer.ecken);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    if (gluehen) {
      weich = baueProgramm(g, FLAECHE_ECKEN, WEICH_SHADER);
      misch = baueProgramm(g, FLAECHE_ECKEN, MISCH_SHADER);
      if (!weich || !misch) gluehen = false;
      else {
        wOrt = { bild: g.getUniformLocation(weich, 'uBild'), schritt: g.getUniformLocation(weich, 'uSchritt'), ecke: g.getAttribLocation(weich, 'aEcke') };
        mOrt = { bild: g.getUniformLocation(misch, 'uBild'), staerke: g.getUniformLocation(misch, 'uStaerke'), ecke: g.getAttribLocation(misch, 'aEcke') };
      }
    }
    g.disable(g.DEPTH_TEST);
    g.enable(g.BLEND);
    g.clearColor(0, 0, 0, 0);
    laden(daten);
    return true;
  }

  function laden(d: KugelDaten) {
    const g = gl;
    if (!g || !punkte) return;
    daten = d;
    anzahl = Math.floor(d.pos.length / 3);
    g.bindBuffer(g.ARRAY_BUFFER, puffer.pos); g.bufferData(g.ARRAY_BUFFER, d.pos, g.STATIC_DRAW);
    g.bindBuffer(g.ARRAY_BUFFER, puffer.wert); g.bufferData(g.ARRAY_BUFFER, d.wert, g.STATIC_DRAW);
    if (d.farbe) { g.bindBuffer(g.ARRAY_BUFFER, puffer.farbe); g.bufferData(g.ARRAY_BUFFER, d.farbe, g.STATIC_DRAW); }
  }

  /** Attribute der Punkte binden (nach jedem Flächen-Durchgang nötig — die Flächen nutzen Platz 0). */
  function punkteBinden(g: WebGLRenderingContext) {
    g.useProgram(punkte);
    const binde = (b: WebGLBuffer | null, a: number, n: number) => {
      if (a < 0) return;
      g.bindBuffer(g.ARRAY_BUFFER, b); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, n, g.FLOAT, false, 0, 0);
    };
    binde(puffer.pos, attr.pos, 3);
    binde(puffer.wert, attr.wert, 4);
    if (daten.farbe) binde(puffer.farbe, attr.farbe, 3);
    else if (attr.farbe >= 0) { g.disableVertexAttribArray(attr.farbe); g.vertexAttrib3f(attr.farbe, 1, 1, 1); }
  }
  function flaecheBinden(g: WebGLRenderingContext, p: WebGLProgram, ecke: number) {
    for (const a of [attr.pos, attr.farbe, attr.wert]) if (a >= 0 && a !== ecke) g.disableVertexAttribArray(a);
    g.useProgram(p);
    g.bindBuffer(g.ARRAY_BUFFER, puffer.ecken); g.enableVertexAttribArray(ecke); g.vertexAttribPointer(ecke, 2, g.FLOAT, false, 0, 0);
  }

  function zielBauen(g: WebGLRenderingContext, z: Ziel, w: number, h: number) {
    if (z.w === w && z.h === h && z.tex) return;
    if (z.tex) g.deleteTexture(z.tex);
    if (!z.fb) z.fb = g.createFramebuffer();
    z.tex = g.createTexture(); z.w = w; z.h = h;
    g.bindTexture(g.TEXTURE_2D, z.tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.bindFramebuffer(g.FRAMEBUFFER, z.fb);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, z.tex, 0);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) gluehen = false;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
  }

  if (!aufbauen()) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return null; }

  // ── Zustand der Szene ──
  let ziel = startZustand, ist = startZustand;
  let phase = Math.random() * 40; // zufälliger Startpunkt: jedes Öffnen steht an einer anderen Stelle der Bewegung
  let gier = Math.random() * Math.PI * 2, neigung = opt.neigung;
  let fahrt: { gier: number; neigung: number; naeher: number } | null = null;
  let zoom = 1;
  let halten = false;
  let zeigerZiel: Vec3 | null = null, zeigerIst: Vec3 = [0, 0, 1], kraft = 0;
  let hervor: number | null = null;
  const startZeit = performance.now();
  let einstiegFertig = !opt.einstieg || opt.ruhig;
  let letztes = 0, bild = 0, laeuft = false, imBild = true;
  let breiteCss = 1, hoeheCss = 1;
  let dreh: Mat4 = drehung(gier, neigung);
  let proj: Mat4 = perspektive(FOV, 1, 0.1, 50);
  let grundAbstand = kameraAbstand(FOV, 1, opt.fuellung);
  let abstand = grundAbstand;
  const dauer: number[] = []; const abstaende: number[] = []; let bilder = 0, schlecht = 0;

  function groesse() {
    const r = leinwand.getBoundingClientRect();
    breiteCss = Math.max(1, r.width); hoeheCss = Math.max(1, r.height);
    const w = Math.max(1, Math.round(breiteCss * dpr())), h = Math.max(1, Math.round(hoeheCss * dpr()));
    if (leinwand.width !== w || leinwand.height !== h) { leinwand.width = w; leinwand.height = h; }
    const aspekt = breiteCss / hoeheCss;
    proj = perspektive(FOV, aspekt, 0.05, 50);
    grundAbstand = kameraAbstand(FOV, aspekt, opt.fuellung);
    if (gl && gluehen) {
      const gw = Math.max(8, Math.round(w * GLUEH_ANTEIL)), gh = Math.max(8, Math.round(h * GLUEH_ANTEIL));
      zielBauen(gl, ziele[0], gw, gh); zielBauen(gl, ziele[1], gw, gh);
    }
    if (messen) leinwand.dataset.puffer = `${w}x${h}`;
  }

  function punkteZeichnen(g: WebGLRenderingContext, pxFaktor: number, maske: boolean, ms: number, e: { sicht: number; hohl: number }) {
    punkteBinden(g);
    const u = ort;
    g.uniformMatrix4fv(u.uProj!, false, proj);
    g.uniformMatrix4fv(u.uDreh!, false, dreh);
    g.uniform1f(u.uAbstand!, abstand);
    g.uniform1f(u.uBezug!, grundAbstand);
    g.uniform1f(u.uPhase!, phase);
    g.uniform1f(u.uUhr!, opt.ruhig ? 0 : ms / 1000);
    g.uniform1f(u.uAtem!, opt.ruhig ? 0 : ist.atem);
    g.uniform1f(u.uWeite!, ist.weite);
    g.uniform1f(u.uVerschiebung!, ist.verschiebung);
    g.uniform1f(u.uHell!, ist.hell);
    g.uniform1f(u.uWirbel!, ist.wirbel);
    g.uniform1f(u.uPuls!, opt.ruhig ? 0 : ist.puls);
    g.uniform1f(u.uVerlauf!, opt.verlauf ? 1 : 0);
    g.uniform3fv(u.uFarbeA!, opt.farben.a);
    g.uniform3fv(u.uFarbeB!, opt.farben.b);
    g.uniform3fv(u.uGlut!, opt.farben.glut);
    g.uniform3fv(u.uZeiger!, zeigerIst);
    g.uniform1f(u.uZeigerKraft!, kraft);
    g.uniform1f(u.uZeigerRadius!, opt.zeigerRadius);
    g.uniform1f(u.uFlare!, opt.flare);
    g.uniform1f(u.uSicht!, e.sicht);
    g.uniform1f(u.uHohl!, e.hohl);
    g.uniform1f(u.uPunktPx!, opt.punktPx * dpr() * pxFaktor);
    g.uniform1f(u.uGrund!, opt.grund);
    g.uniform1f(u.uTiefe!, opt.tiefe);
    g.uniform1f(u.uMaske!, maske ? 1 : 0);
    g.blendFunc(g.ONE, g.ONE); // additiv — das Leuchten entsteht aus der Dichte
    g.drawArrays(g.POINTS, 0, anzahl);
  }

  function zeichne(jetzt: number) {
    const g = gl;
    if (!g || !punkte || g.isContextLost()) return;
    const t0 = performance.now();
    const dt = letztes ? Math.min(0.1, (jetzt - letztes) / 1000) : 1 / 60;
    if (letztes) abstaende.push(jetzt - letztes);
    letztes = jetzt;
    const bewegt = !opt.ruhig;
    const f = (k: number) => (bewegt ? 1 - (1 - k) ** (dt * 60) : 1);
    if (bewegt) {
      ist = nachziehen(ist, ziel, dt);
      phase += dt * ist.tempo;
    } else ist = ziel;
    // Kamera: Fahrt zum Ziel (weich, ohne Überschwingen) bzw. der ruhige Lauf.
    if (fahrt) {
      gier += (winkelNah(gier, fahrt.gier) - gier) * f(0.06);
      neigung += (fahrt.neigung - neigung) * f(0.06);
      zoom += (fahrt.naeher - zoom) * f(0.06);
    } else {
      if (bewegt && !halten) gier += dt * opt.drehTempo;
      neigung += (opt.neigung - neigung) * f(0.05);
      zoom += (1 - zoom) * f(0.06);
    }
    dreh = drehung(gier, neigung);

    // Zeiger bzw. hervorgehobener Punkt: Ort und Stärke folgen weich (0,18 / 0,09 je Bild wie in der Vorlage).
    let zielOrt: Vec3 | null = zeigerZiel;
    if (hervor !== null && hervor < anzahl) zielOrt = norm([daten.pos[hervor * 3], daten.pos[hervor * 3 + 1], daten.pos[hervor * 3 + 2]]);
    if (zielOrt) {
      // Springt der Zeiger auf die andere Seite, nicht quer durch die Kugel ziehen — direkt umsetzen.
      zeigerIst = laenge(sub(zielOrt, zeigerIst)) > 1.2 ? zielOrt : norm([zeigerIst[0] + (zielOrt[0] - zeigerIst[0]) * f(0.18), zeigerIst[1] + (zielOrt[1] - zeigerIst[1]) * f(0.18), zeigerIst[2] + (zielOrt[2] - zeigerIst[2]) * f(0.18)]);
    }
    kraft += ((zielOrt ? 1 : 0) - kraft) * f(0.09);

    const ms = jetzt - startZeit;
    const e = einstiegFertig ? { sicht: 1, hohl: 1, naeher: 0 } : einstieg(ms);
    if (!einstiegFertig && ms > 2400) einstiegFertig = true;
    // Einstieg: die Kamera beginnt nah (gefüllte Kugel füllt das Bild) und fährt zurück.
    abstand = grundAbstand * zoom * (1 - 0.42 * e.naeher);

    // 1. Glühen: Punkte klein in den Glüh-Puffer, zweimal weichzeichnen.
    if (gluehen && misch && weich && ziele[0].fb && ziele[1].fb) {
      const [a, b] = ziele;
      g.bindFramebuffer(g.FRAMEBUFFER, a.fb); g.viewport(0, 0, a.w, a.h); g.clear(g.COLOR_BUFFER_BIT);
      punkteZeichnen(g, GLUEH_ANTEIL * 1.6, opt.bloomNurSterne, ms, e);
      flaecheBinden(g, weich, wOrt.ecke);
      g.disable(g.BLEND);
      g.uniform1i(wOrt.bild, 0); g.activeTexture(g.TEXTURE0);
      const lauf = (von: Ziel, nach: Ziel, dx: number, dy: number) => {
        g.bindFramebuffer(g.FRAMEBUFFER, nach.fb); g.viewport(0, 0, nach.w, nach.h);
        g.bindTexture(g.TEXTURE_2D, von.tex);
        g.uniform2f(wOrt.schritt, dx / von.w, dy / von.h);
        g.drawArrays(g.TRIANGLES, 0, 3);
      };
      lauf(a, b, 1, 0); lauf(b, a, 0, 1); lauf(a, b, 2.2, 0); lauf(b, a, 0, 2.2);
      g.enable(g.BLEND);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    }
    // 2. Punkte scharf.
    g.viewport(0, 0, leinwand.width, leinwand.height);
    g.clear(g.COLOR_BUFFER_BIT);
    punkteZeichnen(g, 1, false, ms, e);
    // 3. Glühen additiv darüber.
    if (gluehen && misch && ziele[0].tex) {
      flaecheBinden(g, misch, mOrt.ecke);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, ziele[0].tex);
      g.uniform1i(mOrt.bild, 0); g.uniform1f(mOrt.staerke, opt.bloom * e.sicht);
      g.blendFunc(g.ONE, g.ONE);
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.disableVertexAttribArray(mOrt.ecke);
    }

    bilder++;
    opt.nachBild?.();
    dauer.push(performance.now() - t0);
    if (dauer.length > MESS_FENSTER) dauer.shift();
    if (abstaende.length > MESS_FENSTER) abstaende.shift();
    // Schwaches Gerät: hält es das Soll über zwei Sekunden deutlich nicht, fällt das Glühen weg (der Rest bleibt).
    // Gemessen wird der MEDIAN (einzelne Ruckler beim Laden zählen nicht), erst nach 4 s und erst nach drei schlechten Prüfungen in Folge.
    if (opt.bloomAuto && gluehen && bewegt && ms > 4000 && bilder % 60 === 0) {
      const sortiert = abstaende.slice().sort((x, y) => x - y);
      const median = sortiert[Math.floor(sortiert.length / 2)] ?? 0;
      schlecht = median > (1000 / opt.fps) * 1.6 ? schlecht + 1 : 0;
      if (schlecht >= 3) { gluehen = false; abstaende.length = 0; }
    }
    if (messen && (bilder % 30 === 0 || opt.ruhig)) {
      const m = messung();
      leinwand.dataset.bilder = String(m.bilder); leinwand.dataset.mittelMs = m.mittelMs.toFixed(3);
      leinwand.dataset.fps = m.fps.toFixed(1); leinwand.dataset.punkte = String(m.punkte); leinwand.dataset.gluehen = m.gluehen ? 'an' : 'aus';
    }
  }

  function messung(): Messung {
    const mittel = dauer.length ? dauer.reduce((a, v) => a + v, 0) / dauer.length : 0;
    const ab = abstaende.length ? abstaende.reduce((a, v) => a + v, 0) / abstaende.length : 0;
    return { bilder, mittelMs: mittel, fps: ab ? 1000 / ab : 0, punkte: anzahl, puffer: `${leinwand.width}x${leinwand.height}`, gluehen };
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
  const zurueck = () => {
    gl = leinwand.getContext('webgl', attribute) as WebGLRenderingContext | null;
    ziele[0] = { tex: null, fb: null, w: 0, h: 0 }; ziele[1] = { tex: null, fb: null, w: 0, h: 0 };
    if (gl && aufbauen()) { groesse(); anwerfen(); }
  };
  leinwand.addEventListener('webglcontextlost', verloren);
  leinwand.addEventListener('webglcontextrestored', zurueck);

  groesse();
  anwerfen();

  const amSchirm = (p: Vec3) => aufBildschirm(p, dreh, proj, abstand, breiteCss, hoeheCss);

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
        const s = amSchirm([daten.pos[i * 3], daten.pos[i * 3 + 1], daten.pos[i * 3 + 2]]);
        if (!s.vorne) continue;
        const d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    },
    bildschirm(i) {
      if (i < 0 || i >= anzahl) return null;
      return amSchirm([daten.pos[i * 3], daten.pos[i * 3 + 1], daten.pos[i * 3 + 2]]);
    },
    ort: amSchirm,
    schirmRadius() { const a = aufBildschirm([0, 0, 0], drehung(0, 0), proj, abstand, breiteCss, hoeheCss), b = aufBildschirm([1, 0, 0], drehung(0, 0), proj, abstand, breiteCss, hoeheCss); return Math.abs(b.x - a.x); },
    halte(an) { halten = an; },
    fliegeZu(c, naeher = 0.62) {
      if (!c) { fahrt = null; neuZeichnen(); return; }
      const b = blickAuf(c);
      // Die feste Neigung zeigt die Kugel leicht von oben — beim Ziel genau auf den Cluster schauen.
      fahrt = { gier: b.gier, neigung: b.neigung, naeher };
      neuZeichnen();
    },
    messung,
    zerstoere() {
      anhalten();
      ro?.disconnect(); io?.disconnect();
      document.removeEventListener('visibilitychange', sichtbarkeit);
      leinwand.removeEventListener('webglcontextlost', verloren);
      leinwand.removeEventListener('webglcontextrestored', zurueck);
      const g = gl;
      if (g && !g.isContextLost()) {
        g.deleteBuffer(puffer.pos); g.deleteBuffer(puffer.farbe); g.deleteBuffer(puffer.wert); g.deleteBuffer(puffer.ecken);
        for (const p of [punkte, weich, misch]) if (p) g.deleteProgram(p);
        for (const z of ziele) { if (z.tex) g.deleteTexture(z.tex); if (z.fb) g.deleteFramebuffer(z.fb); }
        // Kontext erst freigeben, wenn die Leinwand wirklich weg ist: React (Strict Mode, schneller Neuaufbau) startet auf
        // DERSELBEN Leinwand neu — ein schon verlorener Kontext ließe sich dort nicht mehr nutzen (Shader schlägt fehl).
        setTimeout(() => { if (!leinwand.isConnected && !g.isContextLost()) g.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
      }
      gl = null;
    },
  };
}
