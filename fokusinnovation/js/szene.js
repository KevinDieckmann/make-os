// Fokus Innovation · die Szene der Startseite: vom Lärm zum Durchbruch (Prototyp 25.10.2026, dritte Fassung — ruhiger).
// 1 Lärm: viele feine Punkte treiben ziellos · 2 Fokus: sie sammeln sich zum Kern · 3 Momentum: ein Punkt löst sich und zieht die
// Bahn · 4 Durchbruch: er geht durch die Lücke nach außen, dann steht das Logo. Eigenes WebGL, keine Bibliothek, keine Bilder.
// Ruhig heißt: wenige, kleine Punkte ohne Leuchten, ein flacher Grund, das Zeichen klar und scharf. Farben aus den CSS-Variablen.

const FLAECHE_VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

// Grund, Ring, Spur, Kern und Punkt — Maße aus dem Logo: Ring r 16, Strich 2,6, Kern r 7, Punkt r 2,8.
const FLAECHE_FS = `
precision highp float;
uniform vec2 uRes, uC, uPunkt;
uniform float uZeit, uR, uRing, uKern, uPunktA, uSpur, uWinkel;
uniform vec3 uAkzent, uHell, uNacht;
const float PI = 3.14159265;
const float G0 = 0.5236;
const float G1 = 1.3963;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = vec2((uv.x - 0.5) * uRes.x / uRes.y, uv.y);
  float px = 1.25 / uRes.y;
  vec2 r = q - uC;
  float lr = length(r);

  vec3 col = uNacht;
  col += uAkzent * 0.035 * exp(-lr / (uR * 3.0)) * uKern;

  // Ring: offener Bogen, im Uhrzeigersinn ab 30 Grad bis 80 Grad
  float ang = atan(r.y, r.x);
  float bogen = mod(G0 - ang + 2.0 * PI, 2.0 * PI);
  float gesamt = 2.0 * PI - (G1 - G0);
  float zeig = smoothstep(uRing * gesamt + 0.015, uRing * gesamt - 0.015, bogen) * step(0.001, uRing);
  if (uRing > 0.999) zeig = 1.0;
  float dr = abs(lr - uR);
  if (ang > G0 && ang < G1) {
    vec2 e0 = uC + uR * vec2(cos(G0), sin(G0));
    vec2 e1 = uC + uR * vec2(cos(G1), sin(G1));
    float d0 = length(q - e0), d1 = length(q - e1);
    dr = min(d0, d1);
    zeig = d0 < d1 ? step(0.001, uRing) : smoothstep(0.97, 1.0, uRing);
  }
  float ringD = dr - uR * 0.081;
  col = mix(col, uHell, smoothstep(px, -px, ringD) * zeig);

  // Spur hinter dem Punkt: kurz und leise, nur solange er läuft
  float hinter = mod(ang - uWinkel + 2.0 * PI, 2.0 * PI);
  float spur = exp(-hinter / (0.1 + uSpur * 0.9)) * smoothstep(uR * 0.06, 0.0, abs(lr - uR)) * uSpur * uPunktA;
  col = mix(col, mix(uHell, uAkzent, 0.35), spur * 0.55);

  // Kern: der Punkt, auf den alles zeigt
  float kernR = uR * 0.4375 * uKern;
  col = mix(col, uAkzent, smoothstep(px, -px, lr - kernR) * step(0.001, uKern));

  // Der kleine Punkt
  float pd = length(q - uPunkt);
  col = mix(col, uHell, smoothstep(px, -px, pd - uR * 0.175) * uPunktA);

  float vig = smoothstep(1.4, 0.25, length((uv - vec2(0.5, 0.56)) * vec2(1.1, 1.0)));
  col *= 0.78 + 0.22 * vig;
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
  vec2 ziel = uC + uR * 0.38 * sqrt(s.w) * vec2(cos(s.y * 6.2832), sin(s.y * 6.2832));
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
uniform vec3 uAkzent, uHell;
varying float vA, vMisch, vE;
void main() {
  // Wie im Logo: meist ein offener Ring, selten ein Punkt; beim Sammeln wird jeder Ring zum Punkt
  float d = length(gl_PointCoord - 0.5);
  float voll = smoothstep(0.5, 0.4, d);
  float ring = voll - smoothstep(0.36, 0.26, d);
  float form = mix(step(0.8, vMisch) > 0.5 ? voll : ring, voll, smoothstep(0.2, 0.7, vE));
  float a = form * vA;
  gl_FragColor = vec4(mix(uHell, uAkzent, step(0.93, vMisch)) * a, a);
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

/** Lage des Zeichens: Mitte bei 44 % von oben, Halbmesser höchstens 15 % der Höhe oder 24 % der Breite (wie --r in film.css). */
export const LAGE = { mitteY: 0.56, rHoehe: 0.15, rBreite: 0.24 };

/** Startet die Szene. null, wenn es kein WebGL gibt (dann zeigt die Seite das Zeichen als Bild). */
export function szeneStarten(canvas, { handy = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  let flaeche, punkte;
  try {
    flaeche = programm(gl, FLAECHE_VS, FLAECHE_FS);
    punkte = programm(gl, PUNKTE_VS, PUNKTE_FS);
  } catch (fehler) {
    console.warn('Szene aus:', fehler.message);
    return null;
  }
  const uF = orte(gl, flaeche, ['uRes', 'uC', 'uPunkt', 'uZeit', 'uR', 'uRing', 'uKern', 'uPunktA', 'uSpur', 'uWinkel', 'uAkzent', 'uHell', 'uNacht']);
  const uP = orte(gl, punkte, ['uRes', 'uC', 'uZeit', 'uR', 'uSammeln', 'uDpr', 'uSichtbar', 'uAkzent', 'uHell']);

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
  const FARBEN = { akzent: farbe(stil.getPropertyValue('--akzent')), hell: farbe(stil.getPropertyValue('--hell')), nacht: farbe(stil.getPropertyValue('--nacht')) };

  // Zustand, den der Film setzt
  const z = { sammeln: 0, ring: 0, kern: 0, punkt: [0, LAGE.mitteY], punktA: 0, spur: 0, winkel: 0, punkteSichtbar: 1, geom: null };
  let dpr = 1;

  function groesse() {
    dpr = Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 2);
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
    gl.uniform2f(uF.uPunkt, z.punkt[0], z.punkt[1]);
    gl.uniform1f(uF.uZeit, zeit);
    gl.uniform1f(uF.uR, g.R);
    gl.uniform1f(uF.uRing, z.ring);
    gl.uniform1f(uF.uKern, z.kern);
    gl.uniform1f(uF.uPunktA, z.punktA);
    gl.uniform1f(uF.uSpur, z.spur);
    gl.uniform1f(uF.uWinkel, z.winkel);
    gl.uniform3fv(uF.uAkzent, FARBEN.akzent);
    gl.uniform3fv(uF.uHell, FARBEN.hell);
    gl.uniform3fv(uF.uNacht, FARBEN.nacht);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aF);

    if (z.punkteSichtbar <= 0.001) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(punkte);
    gl.bindBuffer(gl.ARRAY_BUFFER, punktPuffer);
    gl.enableVertexAttribArray(aZ);
    gl.vertexAttribPointer(aZ, 4, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uP.uRes, canvas.width, canvas.height);
    gl.uniform2f(uP.uC, g.C[0], g.C[1]);
    gl.uniform1f(uP.uZeit, zeit);
    gl.uniform1f(uP.uR, g.R);
    gl.uniform1f(uP.uSammeln, z.sammeln);
    gl.uniform1f(uP.uDpr, dpr);
    gl.uniform1f(uP.uSichtbar, z.punkteSichtbar);
    gl.uniform3fv(uP.uAkzent, FARBEN.akzent);
    gl.uniform3fv(uP.uHell, FARBEN.hell);
    gl.drawArrays(gl.POINTS, 0, anzahl);
    gl.disableVertexAttribArray(aZ);
  }

  groesse();
  return { zustand: z, groesse, malen };
}

// Die Geschichte als reine Rechnung: Fortschritt der drei Schritte → Zustand der Szene (auch für das Standbild)
const G0 = Math.PI / 6;              // 30 Grad: Anfang des Bogens
const G1 = (80 / 180) * Math.PI;     // 80 Grad: Ende des Bogens
const GESAMT = 2 * Math.PI - (G1 - G0);
const ZIEL_WINKEL = (48.1 / 180) * Math.PI;
const ZIEL_ABSTAND = 1.235;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const glatt = (t) => t * t * (3 - 2 * t);

/** fokus, momentum, durchbruch je 0..1 → Kern, Ring, Punkt und Spur */
export function geschichte(z, { fokus, momentum, durchbruch }) {
  const { R, C } = z.geom;
  z.sammeln = fokus;
  z.kern = glatt(clamp01((fokus - 0.4) / 0.6));
  if (momentum <= 0) {
    z.ring = 0; z.punktA = 0; z.spur = 0;
    return;
  }
  const sprung = clamp01(momentum / 0.12);          // der Punkt löst sich aus dem Kern
  const lauf = clamp01((momentum - 0.12) / 0.88);    // und zieht die Bahn, gleichmäßig schneller
  const e = glatt(lauf);
  let winkel = G0 - e * GESAMT;
  let abstand = R;
  z.ring = e;
  z.spur = lauf > 0 && lauf < 1 ? 0.25 + 0.75 * Math.sin(lauf * Math.PI) : 0;
  if (durchbruch > 0) {
    const d = 1 - Math.pow(1 - clamp01(durchbruch), 3);
    winkel = G1 - (G1 - ZIEL_WINKEL) * d;
    abstand = R * (1 + (ZIEL_ABSTAND - 1) * d);
    z.ring = 1;
    z.spur = 0;
  }
  const aufBahn = [C[0] + abstand * Math.cos(winkel), C[1] + abstand * Math.sin(winkel)];
  const anfang = [C[0] + R * Math.cos(G0), C[1] + R * Math.sin(G0)];
  const s = glatt(sprung);
  z.punkt = lauf > 0 || durchbruch > 0 ? aufBahn : [C[0] + (anfang[0] - C[0]) * s, C[1] + (anfang[1] - C[1]) * s];
  z.punktA = Math.min(1, sprung * 1.5);
  z.winkel = winkel;
}
