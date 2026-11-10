// MAKE Innovation · die Szene der Startseite: vom Lärm zum Durchbruch (vierte Fassung 10.11.2026, Zeichen „Durchbruch“).
// 1 Lärm: feine Punkte und Striche treiben ziellos · 2 Fokus: sie sammeln sich zum Kern · 3 Lücke: eine Wand wächst vor ihm ·
// 4 Momentum: der Kern nimmt Fahrt auf, hinter ihm die Spur · 5 Durchbruch: er geht durch die Wand, dann steht das Logo.
// Eigenes WebGL, keine Bibliothek, keine Bilder. Ruhig heißt: wenige, kleine Punkte, ein flacher Grund, das Zeichen klar und scharf.
// Farben aus den CSS-Variablen; Maße aus dem Logo (Raster 48, Mitte des Zeichens bei 21,7 | 24 = Nullpunkt der Szene).

const FLAECHE_VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

// Grund, Wand, Spur und Kern. Gerechnet wird in Zeichen-Einheiten (1 = ein Kästchen des Logo-Rasters, y nach oben):
// Kern r 10,2 · Wand x −3,7 … 3,3, y ±18, Ecken 0,8, Öffnung r 12,8 um den Kern · Spur drei Striche (Stärke 2,6, runde Enden)
// bei y +5,5 | 0 | −5,5, Länge 8,5 | 10,5 | 6,5, Ende 16 hinter der Mitte des Kerns. Im Ziel (Kern bei 8,8) ist das genau das Logo.
const FLAECHE_FS = `
precision highp float;
uniform vec2 uRes, uC;
uniform float uZeit, uR, uKern, uKX, uCam, uWand, uSpurA, uStreck, uBlitz, uPuls, uWeite, uBluete, uImpuls;
uniform vec3 uAkzent, uKernF, uHell, uNacht;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kasten(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float strich(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = vec2((uv.x - 0.5) * uRes.x / uRes.y, uv.y);
  float k = uR / 16.0;
  float px = 1.25 / uRes.y;
  float pw = px / k;
  vec2 w = (q - uC) / k + vec2(uCam, 0.0);
  vec2 kp = vec2(uKX, 0.0);
  vec2 ks = uC + (kp - vec2(uCam, 0.0)) * k;
  vec2 r = q - ks;
  float lr = length(r);

  vec3 col = uNacht;
  col += uKernF * 0.035 * exp(-lr / (uR * 3.0)) * uKern;

  // Puls des Kerns (wie der Kern von ZOE): ein kurzer Schlag, langsames Ausatmen, dazu läuft eine leise Welle nach außen.
  // Ein Schlag alle 2,8 s; uPuls = 0 im Standbild (Bewegung reduzieren) → ruhender Kern wie im Logo.
  float takt = fract(uZeit / 2.8);
  // Dazu ein kurzes Aufatmen bei jedem Bildwechsel (uImpuls): ein neuer Bewegungsbeginn holt den Blick zur Mitte zurück (Abrams & Christ 2003)
  float schlag = max(smoothstep(0.0, 0.1, takt) * (1.0 - smoothstep(0.1, 0.75, takt)) * uPuls, uImpuls);
  float kernW = 10.2 * uKern * (1.0 + 0.05 * schlag);
  float kernR = kernW * k;

  // Der Raum (Vorbild Gemini, 30.10.): ein großer, sehr weicher Farbschein hinter dem Kern, dunkle Ränder, eine dunklere Masse
  // oben links. Im Lärm kühl, breit und unruhig verschoben, mit dem Fokus zieht er sich violett auf den Kern zusammen und atmet
  // mit dem Schlag, beim Durchbruch wird er weit (uWeite).
  vec2 drift = vec2(sin(uZeit * 0.071), cos(uZeit * 0.053)) * uR * 0.55 * (1.0 - 0.8 * uKern);
  vec2 ra = (r - drift) * vec2(0.74, 1.0);
  float weite = uR * 3.1 * uWeite * (1.0 + 0.04 * schlag) * mix(0.3, 1.0, uBluete);
  float raum = exp(-dot(ra, ra) / (weite * weite));
  vec3 kuehl = vec3(0.075, 0.09, 0.27);
  vec3 violett = mix(kuehl, uKernF * 0.36, 0.6);
  col += mix(kuehl, violett, uKern) * raum * (0.62 + 0.18 * uKern) * uBluete * (1.0 + 0.22 * uImpuls);
  vec2 masse = q - (uC + vec2(-uR * 2.3, uR * 1.3));
  col *= 1.0 - 0.3 * exp(-dot(masse, masse) / (uR * uR * 2.0));
  col += uKernF * (0.05 + 0.09 * schlag) * exp(-max(lr - kernR, 0.0) / (uR * 0.32)) * uKern;
  float welleT = clamp((takt - 0.04) / 0.9, 0.0, 1.0);
  float welleR = mix(kernR, uR * 1.15, 1.0 - (1.0 - welleT) * (1.0 - welleT));
  float welle = smoothstep(uR * 0.03, 0.0, abs(lr - welleR)) * (1.0 - welleT) * (1.0 - welleT) * step(0.001, welleT) * uKern * uPuls;
  col = mix(col, uAkzent, welle * 0.4);

  // Durchbruch: ein kurzer, weicher Schein an der Öffnung, solange der Kern durch die Wand geht
  vec2 oeff = (q - (uC + (vec2(-0.2, 0.0) - vec2(uCam, 0.0)) * k)) * vec2(1.0, 0.7);
  col += uKernF * 0.32 * uBlitz * exp(-length(oeff) / (uR * 0.55));

  // Die Wand: wächst aus der Mitte, und wo der Kern ihr nahe kommt, öffnet sie sich um ihn (immer 2,6 Abstand wie im Logo)
  float hoehe = 18.0 * uWand;
  float wd = kasten(w - vec2(-0.2, 0.0), vec2(3.5, hoehe), min(0.8, hoehe));
  wd = max(wd, -(length(w - kp) - 12.8));
  col = mix(col, uHell, smoothstep(pw, -pw, wd) * step(0.001, uWand));

  // Die Spur: drei Striche hinter dem Kern; in Fahrt länger (uStreck), im Ziel genau die Spur des Logos
  float ende = uKX - 16.0;
  float sd = min(strich(w, vec2(ende - 8.5 * uStreck, 5.5), vec2(ende, 5.5), 1.3),
             min(strich(w, vec2(ende - 10.5 * uStreck, 0.0), vec2(ende, 0.0), 1.3), strich(w, vec2(ende - 6.5 * uStreck, -5.5), vec2(ende, -5.5), 1.3)));
  col = mix(col, uAkzent, smoothstep(pw, -pw, sd) * uSpurA);

  // Kern: der Punkt, auf den alles zeigt
  col = mix(col, uKernF, smoothstep(pw, -pw, length(w - kp) - kernW) * step(0.001, uKern));

  float vig = smoothstep(1.35, 0.2, length((uv - vec2(0.5, 0.56)) * vec2(1.1, 1.0)));
  col *= 0.62 + 0.38 * vig;
  col += (hash(gl_FragCoord.xy + fract(uZeit) * 100.0) - 0.5) * 0.008;
  gl_FragColor = vec4(col, 1.0);
}`;

// Die vielen Punkte: aus dem Lärm in den Kern, auf einer leichten Spirale
const PUNKTE_VS = `
attribute vec4 aZufall;
uniform vec2 uRes, uC;
uniform float uZeit, uR, uSammeln, uDpr, uSichtbar;
varying float vA, vMisch, vE;
void main() {
  vec4 s = aZufall;
  float a = uRes.x / uRes.y;
  vec2 p0 = vec2((s.x - 0.5) * a * 1.1, s.y * 1.08 - 0.04);
  p0 += vec2(sin(uZeit * (0.05 + s.z * 0.08) + s.w * 40.0), cos(uZeit * (0.04 + s.w * 0.07) + s.z * 30.0)) * (0.03 + 0.05 * s.z);
  float start = s.z * 0.45;
  float e = smoothstep(start, start + 0.55, uSammeln);
  vec2 ziel = uC + uR * 0.55 * sqrt(s.w) * vec2(cos(s.y * 6.2832), sin(s.y * 6.2832));
  vec2 pos = mix(p0, ziel, e * e * (3.0 - 2.0 * e));
  float dreh = (1.0 - e) * e * 2.2;
  vec2 d = pos - uC;
  pos = uC + vec2(d.x * cos(dreh) - d.y * sin(dreh), d.x * sin(dreh) + d.y * cos(dreh));
  // Hinter den Worten unten leiser, damit sie ruhig lesbar bleiben
  float unten = mix(0.28, 1.0, smoothstep(0.08, 0.46, p0.y));
  vA = (0.22 + 0.32 * s.w) * mix(unten, 1.0, e) * (1.0 - smoothstep(0.75, 1.0, e)) * uSichtbar;
  vMisch = s.z;
  vE = e;
  gl_Position = vec4(pos.x * 2.0 / a, pos.y * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = mix(6.0 + 10.0 * s.w * s.w, 3.0, e) * uDpr;
}`;
const PUNKTE_FS = `
precision mediump float;
uniform vec3 uAkzent, uKernF, uHell;
varying float vA, vMisch, vE;
void main() {
  // Wie im Logo: meist ein kleiner Punkt, manche ein kurzer Strich der Spur; beim Sammeln wird jeder zum Punkt
  vec2 c = gl_PointCoord - 0.5;
  float punkt = smoothstep(0.34, 0.26, length(c));
  float strich = smoothstep(0.11, 0.05, length(vec2(max(abs(c.x) - 0.32, 0.0), c.y)));
  float form = mix(vMisch < 0.28 ? strich : punkt, smoothstep(0.5, 0.4, length(c)), smoothstep(0.2, 0.7, vE));
  float a = form * vA;
  vec3 f = vMisch < 0.28 ? uAkzent : (vMisch > 0.93 ? uKernF : uHell);
  gl_FragColor = vec4(f * a, a);
}`;

function shader(gl, art, quelle) {
  const s = gl.createShader(art);
  gl.shaderSource(s, quelle);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'Shader');
  return s;
}
function programm(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Programm');
  return p;
}
const orte = (gl, p, namen) => Object.fromEntries(namen.map((n) => [n, gl.getUniformLocation(p, n)]));
/** CSS-Farbe (#rrggbb) → [r, g, b] in 0..1 */
function farbe(hex) {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

/** Lage des Zeichens: Mitte bei 44 % von oben; R (= 16 Zeichen-Einheiten) höchstens 15 % der Höhe oder 24 % der Breite (wie --r in film.css). */
export const LAGE = { mitteY: 0.56, rHoehe: 0.15, rBreite: 0.24 };

/** Startet die Szene. null, wenn es kein WebGL gibt (dann zeigt die Seite das Zeichen als Bild). */
export function szeneStarten(canvas, { handy = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'default' });
  if (!gl) return null;
  let flaeche, punkte;
  try {
    flaeche = programm(gl, FLAECHE_VS, FLAECHE_FS);
    punkte = programm(gl, PUNKTE_VS, PUNKTE_FS);
  } catch (fehler) {
    console.warn('Szene aus:', fehler.message);
    return null;
  }
  const uF = orte(gl, flaeche, ['uRes', 'uC', 'uZeit', 'uR', 'uKern', 'uKX', 'uCam', 'uWand', 'uSpurA', 'uStreck', 'uBlitz', 'uPuls', 'uWeite', 'uBluete', 'uImpuls', 'uAkzent', 'uKernF', 'uHell', 'uNacht']);
  const uP = orte(gl, punkte, ['uRes', 'uC', 'uZeit', 'uR', 'uSammeln', 'uDpr', 'uSichtbar', 'uAkzent', 'uKernF', 'uHell']);

  const dreieck = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dreieck);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const anzahl = handy ? 45 : 85;
  const zufall = new Float32Array(anzahl * 4);
  for (let i = 0; i < zufall.length; i++) zufall[i] = Math.random();
  const punktPuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, punktPuffer);
  gl.bufferData(gl.ARRAY_BUFFER, zufall, gl.STATIC_DRAW);
  const aF = gl.getAttribLocation(flaeche, 'a');
  const aZ = gl.getAttribLocation(punkte, 'aZufall');

  const stil = getComputedStyle(document.documentElement);
  const FARBEN = {
    akzent: farbe(stil.getPropertyValue('--akzent')), kern: farbe(stil.getPropertyValue('--kern-nacht')),
    hell: farbe(stil.getPropertyValue('--hell')), nacht: farbe(stil.getPropertyValue('--nacht')),
  };

  // Zustand, den der Film setzt (Weg in Zeichen-Einheiten, siehe geschichte)
  const z = { sammeln: 0, kern: 0, kx: KERN_START, cam: KERN_START, wand: 0, spurA: 0, streck: 1, blitz: 0, punkteSichtbar: 1, puls: 1, weite: 1.5, bluete: 1, impuls: 0, geom: null };
  let dpr = 1;

  function groesse() {
    // Der Schein ist weich: mehr als 1,25 (Rechner) bzw. 1,5 (Handy) Pixeldichte kostet nur Grafikleistung.
    dpr = Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.25);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const aspekt = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    z.geom = { R: Math.min(LAGE.rHoehe, aspekt * LAGE.rBreite), C: [0, LAGE.mitteY] };
  }

  function malen(zeit) {
    const g = z.geom;
    gl.disable(gl.BLEND);
    gl.useProgram(flaeche);
    gl.bindBuffer(gl.ARRAY_BUFFER, dreieck);
    gl.enableVertexAttribArray(aF);
    gl.vertexAttribPointer(aF, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uF.uRes, canvas.width, canvas.height);
    gl.uniform2f(uF.uC, g.C[0], g.C[1]);
    gl.uniform1f(uF.uZeit, zeit);
    gl.uniform1f(uF.uR, g.R);
    gl.uniform1f(uF.uKern, z.kern);
    gl.uniform1f(uF.uKX, z.kx);
    gl.uniform1f(uF.uCam, z.cam);
    gl.uniform1f(uF.uWand, z.wand);
    gl.uniform1f(uF.uSpurA, z.spurA);
    gl.uniform1f(uF.uStreck, z.streck);
    gl.uniform1f(uF.uBlitz, z.blitz);
    gl.uniform1f(uF.uPuls, z.puls);
    gl.uniform1f(uF.uWeite, z.weite);
    gl.uniform1f(uF.uBluete, z.bluete);
    gl.uniform1f(uF.uImpuls, z.impuls);
    gl.uniform3fv(uF.uAkzent, FARBEN.akzent);
    gl.uniform3fv(uF.uKernF, FARBEN.kern);
    gl.uniform3fv(uF.uHell, FARBEN.hell);
    gl.uniform3fv(uF.uNacht, FARBEN.nacht);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aF);

    if (z.punkteSichtbar <= 0.001) return;
    // Die Punkte sammeln sich dort, wo der Kern auf dem Bildschirm steht
    const kern = [g.C[0] + (z.kx - z.cam) * (g.R / 16), g.C[1]];
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(punkte);
    gl.bindBuffer(gl.ARRAY_BUFFER, punktPuffer);
    gl.enableVertexAttribArray(aZ);
    gl.vertexAttribPointer(aZ, 4, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uP.uRes, canvas.width, canvas.height);
    gl.uniform2f(uP.uC, kern[0], kern[1]);
    gl.uniform1f(uP.uZeit, zeit);
    gl.uniform1f(uP.uR, g.R);
    gl.uniform1f(uP.uSammeln, z.sammeln);
    gl.uniform1f(uP.uDpr, dpr);
    gl.uniform1f(uP.uSichtbar, z.punkteSichtbar);
    gl.uniform3fv(uP.uAkzent, FARBEN.akzent);
    gl.uniform3fv(uP.uKernF, FARBEN.kern);
    gl.uniform3fv(uP.uHell, FARBEN.hell);
    gl.drawArrays(gl.POINTS, 0, anzahl);
    gl.disableVertexAttribArray(aZ);
  }

  groesse();
  return { zustand: z, groesse, malen };
}

// Die Geschichte als reine Rechnung: Fortschritt der vier Schritte → Zustand der Szene (auch für das Standbild).
// Weg des Kerns in Zeichen-Einheiten (Mitte des Zeichens = 0): er entsteht in der Bildmitte (Blick folgt ihm, uCam), die Wand
// wächst rechts von ihm, er nimmt Anlauf und geht hindurch bis an seinen Platz im Logo.
const KERN_START = -22;
const KERN_ANLAUF = -16;
const KERN_ZIEL = 8.8;
const BLICK_LUECKE = -10;
const BLICK_ANLAUF = -7;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const glatt = (t) => t * t * (3 - 2 * t);

/** fokus, luecke, momentum, durchbruch je 0..1 → Kern, Wand, Spur und Blick */
export function geschichte(z, { fokus, luecke = 1, momentum, durchbruch }) {
  z.sammeln = fokus;
  z.kern = glatt(clamp01((fokus - 0.4) / 0.6));
  // Raum: breit im Lärm (1,5), eng im Fokus (0,85), weiter beim Durchbruch (1,2)
  z.weite = 1.5 - 0.65 * glatt(fokus) + 0.35 * glatt(clamp01(durchbruch));
  const w = glatt(clamp01(luecke));
  const m = glatt(clamp01(momentum));
  const db = clamp01(durchbruch);
  const d = 1 - Math.pow(1 - db, 3);
  z.wand = w;
  if (db > 0) {
    z.kx = KERN_ANLAUF + (KERN_ZIEL - KERN_ANLAUF) * d;
    z.cam = BLICK_ANLAUF * (1 - d);
  } else if (momentum > 0) {
    z.kx = KERN_START + (KERN_ANLAUF - KERN_START) * m;
    z.cam = BLICK_LUECKE + (BLICK_ANLAUF - BLICK_LUECKE) * m;
  } else {
    z.kx = KERN_START;
    z.cam = KERN_START + (BLICK_LUECKE - KERN_START) * w;
  }
  // Spur: erscheint mit dem Anlauf, wird in Fahrt länger und steht am Ende in Logo-Länge
  z.spurA = glatt(clamp01(momentum / 0.35));
  z.streck = db > 0 ? 1 + 0.8 * (1 - d) : 1 + 0.8 * m;
  // Ein kurzer Schein, während der Kern durch die Wand geht
  z.blitz = db > 0 && db < 1 ? Math.exp(-(((z.kx + 0.2) / 7) ** 2)) : 0;
}
