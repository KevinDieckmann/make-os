/* MAKE Innovation · „Das Haus“: die Fahrt durch 15 Szenen (QUELLE; bauen.mjs macht daraus js/haus.js und setzt Szenen und Linkziele ein).
   Das Produkt des Kunden fährt im Aufzug von der Straße bis zur Bühne auf dem Dach. Die Zeichnung (Canvas) folgt der Scroll-Position.
   Das Scrollen gehört dem Besucher: Rad und Trackpad scrollen ganz normal, die Seite fängt nichts ab. Erst im Stillstand gleitet sie auf die
   nächste Szene (weiches Einrasten, jede Eingabe bricht es ab); mit dem Finger rastet der Browser selbst (CSS Scroll-Snap).
   Der Text jeder Szene ist echtes HTML und steht ganz da. Alles von Hand, keine Fremdbibliothek.
   Sicherheitsregeln der Website: keine style-Attribute in eingesetztem HTML, nur Klassen und einzelne el.style-Zuweisungen. */
if (!document.documentElement.classList.contains('fahrt-aus')) { // Rückkehrer sehen die Fahrt nicht (haus-frueh.js)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const QUERY = new URLSearchParams(location.search);
/* Prüfmodus: ?p=0.35 zeichnet die Stelle p der Zeitachse (0 bis 1) als Standbild, ohne Scrollen und ohne Rasten. Szenen ansteuern: ?szene=7 oder ?szene=e2 (springt dorthin). */
const STILL = QUERY.has('p') ? { p: +QUERY.get('p') } : null;
if (STILL) root.classList.add('still-s');
/* „Weniger Bewegung“ und Standbild: keine Animation. Bei „weniger Bewegung“ stehen die Szenen als normale Abschnitte untereinander (html.statisch, setzt haus-frueh.js bzw. hier). */
const WENIGER = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (WENIGER && !STILL) root.classList.add('statisch');
const STATISCH = root.classList.contains('statisch');
/* Fehlerzähler: im Standbild-Modus steht jeder Skriptfehler als roter Balken im Bild und in <html data-fehler> */
let FEHLER = 0;
function fehler(m) { FEHLER++; root.dataset.fehler = String(FEHLER); if (!STILL) return; let b = document.querySelector('.fail'); if (!b) { b = document.createElement('div'); b.className = 'fail'; document.body.append(b); } b.textContent = `${FEHLER} Fehler · ${m}`; }
addEventListener('error', (e) => fehler(e.message || 'Fehler'));
addEventListener('unhandledrejection', (e) => fehler(String(e.reason)));
root.dataset.fehler = '0';
const reduce = WENIGER || STILL !== null;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (p, [a, b]) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutSine = (t) => (1 - Math.cos(t * Math.PI)) / 2;
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/* ── Feder (für die Kamera und den Einflug) ── */
const live = new Set();
class Spring {
  constructor(v, cfg, on = null, precision = 0.0005) { this.v = v; this.to = v; this.from = v; this.vel = 0; this.cfg = cfg; this.on = on; this.pr = precision; this.t = 0; }
  set(to, o = {}) {
    if (o.immediate || reduce) { this.to = to; this.v = to; this.vel = 0; live.delete(this); if (this.on) this.on(to); return; }
    if (to === this.to) return;
    this.to = to; this.from = this.v; this.t = 0; live.add(this);
  }
  step(dt, real = dt) {
    const c = this.cfg;
    if (c.duration) {
      this.t += real; const k = Math.min(1, this.t / c.duration);
      this.v = this.from + (this.to - this.from) * c.easing(k);
      if (k >= 1) { this.v = this.to; live.delete(this); }
    } else {
      const n = Math.max(1, Math.round(dt)), kt = c.tension * 1e-6, kf = c.friction * 1e-3;
      let v = this.v, vel = this.vel;
      for (let i = 0; i < n; i++) { vel += -kt * (v - this.to) - kf * vel; v += vel; }
      this.v = v; this.vel = vel;
      if (Math.abs(vel) < this.pr / 10 && Math.abs(v - this.to) <= this.pr) { this.v = this.to; this.vel = 0; live.delete(this); }
    }
    if (this.on) this.on(this.v);
  }
}
const FOLGE = { tension: 700, friction: 53 };      // die Kamera folgt der Scroll-Position straff (kritisch gedämpft, rund 75 ms Nachlauf): glättet einzelne Rad-Rasten, hängt aber nicht hinterher
const EINFLUG = { duration: 3200, easing: easeOutQuint };

/* ── Taktgeber: Leser, Federn, Zeichner ── */
const readers = [], painters = [];
let lastT = performance.now();
function frame(now) {
  const real = Math.min(1000, Math.max(0, now - lastT)), dt = Math.min(64, real); lastT = now;
  for (const f of readers) { try { f(now, dt); } catch (e) { console.error(e); fehler(e.message); } }
  for (const s of [...live]) { try { s.step(dt, real); } catch (e) { console.error(e); fehler(e.message); live.delete(s); } }
  for (const f of painters) { try { f(now, dt); } catch (e) { console.error(e); fehler(e.message); } }
  requestAnimationFrame(frame);
}

/* ── Zeitachse der Zeichnung: eine Stelle p (0 → 1) bestimmt Kamera, Aufzug, Kern und Licht. Jede Szene steht auf einer Stelle (szenen.json › bild). ── */
const HALTS = 7, FLOOR_LEN = 0.077, TOUR_START = 0.27, TRAVEL_PART = 0.38; // sieben Räume, der Aufzug fährt in den ersten 38 % jedes Raums
const DACH_HALT = 6;                                       // das Dach: kein Raum zum Hineingehen
const MARKEN_HALTE = [0, 1, 2, 3, 4, 5];                  // Räume zum Hineingehen
const HERO = [0, 0.19], TURN_END = 0.235;                 // Eingang: von außen auf die Dachbühne zu, dann zurück auf die Straße
const THREAD = [0.832, 0.864], FADEN_OUT = [0.892, 0.906], SPOTS = [0.897, 0.93]; // das ganze Haus, dann die Lichtkegel auf dem Dach
const floorRange = (i) => [TOUR_START + i * FLOOR_LEN, TOUR_START + (i + 1) * FLOOR_LEN];
const wide = matchMedia('(min-width: 768px)');

/* ═══════════════ Das Haus (2D-Canvas, von der Scroll-Position gescrubbt) ═══════════════
   Ein Turm mit 40 Etagen, oben die Dachbühne. Alles ist in Metern gebaut und wird mit einer Zentralperspektive
   projiziert; die Stadt dahinter rechnet ihre Höhe aus der Höhe der Kamera. Durch alle Etagen läuft ein gläserner
   Schacht: darin fährt der Kern, das Produkt des Kunden, von der Straße bis aufs Dach und wird von Halt zu Halt heller. */
const cv = $('#seq'), ctx = cv.getContext('2d');
const S = { w: 0, h: 0, f: 0, cx: 0, cy: 0, narrow: false };
const cam = { x: 0, y: 1.75, z: -46 };
const NEAR = 0.22;
const FH = 3.6, TOP = 40, GROUND = -TOP * FH, TXL = -6.4, TXR = 10.4, RD = 16; // Dach: y = 0, Tiefe RD
const baseOf = (n) => (n - TOP) * FH;
const SHAFT = { x0: 2.3, x1: 3.7, x: 3.0, z: 0.9 };      // der gläserne Schacht hinter der Fassade
const PED = { x: 0.2, z: 4.4, h: 1.05 };                 // der Sockel im Erdgeschoss
const STOOL = { x: -4.01, z: 6.9, h: 0.74 };              // der Hocker bei MAKE Studios: dort wird der Kern gefilmt
const TABLE = { x: 0.3, z: 6.4, h: 0.78 };               // der runde Tisch im Podcast: der Kern liegt zwischen den beiden
const STAGE = { x0: -4.6, x1: 4.6, y: 0.5, z0: 6.4, z1: 11, zc: 8.6 }, TRUSS = { x: 4.9, z: 10.2, h: 5.4 };
const DT = [[-4.1, 2.5], [-5.5, 5.3]];                     // die zwei Thementische auf dem Dach
const AKZ = { studios: '#FF5A1F', revenue: '#7DB7FF', lav: '#A78BFA' }; // Akzent je Etage; der Kern des Kunden bleibt violett
/* Die sieben Räume des Hauses, von unten nach oben. Die Etagenzahlen der Szenen (Erdgeschoss, Eingangshalle, Etage 1 bis 5, Dach) stehen in szenen.json;
   n ist hier nur die Höhe im Turm (40 Stockwerke). key wählt die Zeichnung des Raums. */
const FLOORS = [
  { n: 0, id: 'eg', key: 'strasse', base: GROUND, y1: 6.9, eye: 2.7, z1: 10, solid: true, innen: true },
  { n: 8, id: 'e1', key: 'innovation', innen: true, base: baseOf(8), y1: 3.6, eye: 1.6 },
  { n: 15, id: 'e2', key: 'studios', akz: AKZ.studios, innen: true, base: baseOf(15), y1: 3.6, eye: 1.6, solid: true, dark: true },
  { n: 21, id: 'e3', key: 'pr', innen: true, base: baseOf(21), y1: 3.6, eye: 1.6 },
  { n: 28, id: 'e4', key: 'revenue', akz: AKZ.revenue, innen: true, base: baseOf(28), y1: 3.6, eye: 1.6 },
  { n: 35, id: 'e5', key: 'podcast', innen: true, base: baseOf(35), y1: 3.6, eye: 1.6, solid: true, dark: true },
  { n: 40, id: 'dach', key: 'dach', roof: true, base: 0, y1: 6, eye: 3.0 },
];

const OPEN = new Set([0, 1, 8, 15, 21, 28, 35]);
const LEVELS = [0.12, 0.28, 0.42, 0.56, 0.7, 0.86, 1];   // Helligkeit des Kerns je Halt
const LAV = '167,139,250', LAVH = '205,192,255', WARM = '255,236,214';
let sceneDirty = true;
const STUFE = { fundament: '167,139,250', wachstum: '125,183,255', skalieren: '255,90,31' }; // die drei Stufen, farbig am Haus (Szene 14)
/* Räume von innen: rgb = Licht des Raums, tief = Tönung, zx = Mitte der Ecken (Blickrichtung je Szene), kern = Platz des Kerns dort, breite = so viele Meter zeigt die Ansicht,
   z0 = Ecke, wenn eine Szene keine nennt. Die Figuren stehen immer im Licht. */
const MARKE = {
  strasse: { i: 0, rgb: WARM, tief: '120,100,80', licht: 0.001, breite: 6.6, zx: [1.3, 2.9], z0: 1, kern: [[PED.x, PED.h, PED.z], [PED.x, PED.h, PED.z]] },
  innovation: { i: 1, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, zx: [-3.5, -0.2, 3.45], z0: 1, kern: [[0.4, 0.78, 7.75], [0.4, 0.78, 7.75], [0.4, 0.78, 7.75]] },
  studios: { i: 2, rgb: '255,90,31', tief: '255,90,31', zx: [3.4, 0.0, -3.6], z0: 1, kern: [[2.88, 0.74, 6.4], [-0.515, 0.9, 6.2], [STOOL.x, STOOL.h, STOOL.z]] },
  pr: { i: 3, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, breite: 5.4, zx: [-4.35, -1.25, 0.35, 2.9, 4.2], z0: 1, kern: [[-3.05, 1.0, 6.3], [-1.3, 1.0, 6.3], [1.6, 1.0, 7.0], [3.5, 1.0, 6.9], [3.5, 1.0, 6.9]] },
  revenue: { i: 4, rgb: '125,183,255', tief: '23,70,158', zx: [-3.6, -0.95, 3.4], breite: 5.2, z0: 1, kern: [[-3.31, 1.0, 6.6], [-0.85, 1.0, 6.4], [2.84, 1.0, 6.8]] },
  podcast: { i: 5, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, breite: 6.2, zx: [TABLE.x, 3.5], z0: 0, kern: [[TABLE.x, TABLE.h, TABLE.z], [2.45, 0.62, 7.3]] },
  dach: { i: 6, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, aussen: true, zx: [-0.7, -0.5], z0: 0, zz: [-14.4, -13.2], kern: [[0, 0, 0]] },
};
/* Die Menschen der Räume (je Gruppe eine Liste: x, z, Haltung). Ihre Plätze sind so gesetzt, dass in der Ansicht von innen keine Figur eine andere verdeckt. */
const FIG = {
  studios: [
    [[-1.45, 7.2, { seat: true }], [0.95, 8.2, { walk: 0, steh: true, prop: 'zeig' }], [1.65, 6.9, { bob: true, s: 0.98 }]],
    [],
    [],
  ],
  pr: [
    [[-3.7, 7.5, { walk: 0, steh: true, prop: 'schreib' }], [-0.1, 7.6, { walk: 0, steh: true, prop: 'halte' }],
      [1.15, 7.05, { walk: 0, steh: true, prop: 'zeig' }], [2.05, 7.1, { walk: 0, steh: true, flip: true }],
      [3.0, 6.85, { walk: 0, steh: true }], [4.05, 6.9, { walk: 0, steh: true, flip: true, prop: 'halte' }], [3.45, 7.7, { s: 0.96, bob: true }]],
    [],
    [],
    [],
    [],
  ],
  podcast: [[[TABLE.x - 1.3, TABLE.z, { profil: true }], [TABLE.x + 1.3, TABLE.z, { profil: true, flip: true, s: 0.97 }], [-2.3, 7.4, { seat: true }]]],
  innovation: [[[-1.3, 6.8, { seat: true }], [-0.25, 6.7, { seat: true, bob: true, s: 0.97 }], [0.85, 6.85, { seat: true }], [2.0, 7.75, { profil: true, flip: true, ohneKH: true }], [-2.4, 8.3, { walk: 0, steh: true, prop: 'zeig' }]]],
  dach: [[[DT[0][0], DT[0][1], {}], [DT[1][0], DT[1][1], {}]], [[2.5, 9.6, {}], [-2.4, 8.25, {}]]],
  revenue: [[[-3.45, 7.75, { profil: true }], [-1.55, 7.75, { profil: true, flip: true, s: 0.97 }], [1.15, 8.0, { walk: 0, steh: true, prop: 'zeig' }]]],
};
for (const key in MARKE) { // alles im Licht: keine Auswahl, kein Schalter
  const MK = MARKE[key], fig = FIG[key] || [[]]; MK.key = key;
  MK.rolle = fig.map(() => Array.from({ length: 12 }, () => ({ v: 1 })));
  MK.linieK = fig.map(() => ({ v: 1 }));
  MK.zone = { v: MK.z0 };
}
const zwischen = (arr, v) => { if (arr.length < 2) return [arr[0], arr[0], 0]; const i = Math.max(0, Math.min(arr.length - 2, Math.floor(v))); return [arr[i], arr[i + 1], clamp01(v - i)]; };
const zoneX = (key) => { const [a, b, t] = zwischen(MARKE[key].zx, MARKE[key].zone.v); return lerp(a, b, t); };
const kernplatz = (key, R) => { const [A, B, t] = zwischen(MARKE[key].kern, MARKE[key].zone.v); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t) + R + Math.sin(t * Math.PI) * 0.45, lerp(A[2], B[2], t)]; };
/* Linkziele aus ziele.json (das Bauskript setzt sie ein); im Skript stehen keine festen Adressen */
const ZIELE = /*ZIELE*/{}/*ZIELE-ENDE*/;
/* Anfragen (Einladung, Gast im Podcast) führen auf das Formular der Anwendung. Die Tabelle Weg → vorbereitete Mail steht im HTML (data-anfrage-mails am Abschnitt #top): im Skript steht keine Adresse. */
const MAILS = (() => { try { return JSON.parse(document.querySelector('[data-anfrage-mails]')?.dataset.anfrageMails || '{}'); } catch { return {}; } })();

let sky = null, skyHy = 0, CITY = null, TEX = {}, oy = 0, beacon = 0, spots = 0, marks = 0, coreAt = null;
const FONT = (w, s) => `${w} ${s}px "Schibsted Grotesk", system-ui, sans-serif`;
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (a, b) => { let t = (Math.imul(a + 77, 374761393) + Math.imul(b + 13, 668265263)) | 0; t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
const winCol = (r, a) => (r < 0.55 ? `rgba(255,${(228 + r * 30) | 0},${(196 + r * 70) | 0},${a})` : `rgba(${(186 + r * 40) | 0},${(172 + r * 40) | 0},255,${a})`); // Fensterlicht: warmweiß bis lavendel

/* Himmel: Nacht, am Horizont ein tiefes Violett (für den Fuß mit fester Stadt, für die Szene ohne; dort rechnet die Stadt mit) */
const CITY_COLS = ['#4a379f', '#3a2c80', '#2b2262', '#1f1a48', '#161432', '#0f0e22', '#0a0a16'];
function buildBackdrop(w, h, hy, seed = 7, sunAt = 0.3, city = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), R = mulberry(seed), u = w / 1920;
  const sk = g.createLinearGradient(0, 0, 0, hy);
  [[0, '#050609'], [0.3, '#0B0E10'], [0.55, '#110f22'], [0.74, '#1c154a'], [0.87, '#35228a'], [0.95, '#5a3ed0'], [1, '#8566ec']].forEach(([o, k]) => sk.addColorStop(o, k));
  g.fillStyle = sk; g.fillRect(0, 0, w, hy + 2);
  for (let i = 0; i < 130; i++) { const x = R() * w, y = R() * hy * 0.6; g.fillStyle = `rgba(232,228,255,${(0.12 + R() * 0.5) * (1 - y / (hy * 0.6))})`; const s = (1 + R() * 1.2) * u; g.fillRect(x, y, s, s); }
  const sx = w * sunAt, rg = g.createRadialGradient(sx, hy, 0, sx, hy, w * 0.6);
  rg.addColorStop(0, 'rgba(221,214,254,.6)'); rg.addColorStop(0.07, 'rgba(167,139,250,.4)'); rg.addColorStop(0.3, 'rgba(95,75,182,.16)'); rg.addColorStop(1, 'rgba(95,75,182,0)');
  g.globalCompositeOperation = 'screen'; g.fillStyle = rg; g.fillRect(0, 0, w, hy); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 8; i++) {
    const y = hy * (0.6 + R() * 0.32), x = R() * w, rw = (260 + R() * 560) * u, rh = (5 + R() * 11) * u;
    const cg = g.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, `rgba(196,181,253,${0.06 + R() * 0.1})`); cg.addColorStop(1, 'rgba(196,181,253,0)');
    g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = cg; g.beginPath(); g.arc(x, y, rw, 0, 7); g.fill(); g.restore();
  }
  const gr = g.createLinearGradient(0, hy, 0, h);
  gr.addColorStop(0, '#3c2a86'); gr.addColorStop(0.035, '#241b55'); gr.addColorStop(0.13, '#14122c'); gr.addColorStop(0.4, '#0c0c16'); gr.addColorStop(1, '#07080b');
  g.fillStyle = gr; g.fillRect(0, hy, w, h - hy);
  for (let L = 0; city && L < 7; L++) {
    const base = hy + (L * L * 5.5 + L * 3) * u, sc = (1 + L * 0.45) * u;
    let x = -40 * u;
    while (x < w) {
      const bw = (10 + R() * 34) * sc; let bh = (6 + R() * 30) * sc * (L < 2 ? 0.7 : 1); if (R() < 0.07) bh *= 2.2 + R() * 1.5;
      g.fillStyle = CITY_COLS[L]; g.fillRect(x, base - bh, bw + 1, bh + 500 * u);
      if (L >= 3 && R() < 0.55) { const n = (1 + R() * 6) | 0; for (let k = 0; k < n; k++) { g.fillStyle = winCol(R(), 0.2 + R() * 0.45); const s = 1.1 * sc; g.fillRect(x + R() * bw * 0.85, base - bh + 2 + R() * bh * 0.9, s, s); } }
      x += bw + R() * 6 * sc;
    }
    const hz = g.createLinearGradient(0, base - 40 * u, 0, base + 70 * u);
    hz.addColorStop(0, 'rgba(120,92,220,0)'); hz.addColorStop(1, `rgba(${L < 3 ? '110,84,205' : '20,16,44'},${0.2 - L * 0.02})`);
    g.fillStyle = hz; g.fillRect(0, base - 40 * u, w, 110 * u);
  }
  for (let i = 0; city && i < 420; i++) { const y = hy + (230 + R() * R() * 900) * u, x = R() * w, s = (0.8 + (y - hy) / (900 * u) * 2.2) * u; g.fillStyle = winCol(R(), 0.1 + R() * 0.35); g.fillRect(x, y, s, s); }
  return c;
}

/* Die Stadt: sieben Tiefenstaffeln mit echten Höhen */
function buildCity() {
  const R = mulberry(11);
  const defs = [[6000, 30, 120, 30, 120], [3600, 26, 105, 26, 90], [2100, 22, 95, 22, 70], [1250, 22, 90, 20, 60], [760, 24, 95, 18, 50], [430, 26, 100, 18, 46], [240, 28, 110, 18, 40]];
  return defs.map(([D, h0, h1, w0, w1], L) => {
    const b = []; let x = -(0.8 * D + 40);
    while (x < 0.8 * D + 40) {
      const w = w0 + R() * (w1 - w0); let h = h0 + R() * R() * (h1 - h0);
      if (R() < 0.08) h *= 1.7 + R() * 1.2; if (L >= 4) h = Math.min(h, 128);
      const win = []; if (L >= 3) { const n = (R() * (L >= 5 ? 30 : 12)) | 0; for (let i = 0; i < n; i++) win.push([0.04 + R() * 0.9, 0.03 + R() * 0.94, R()]); }
      b.push({ x, w, h, win }); x += w + R() * w * 0.22;
    }
    return { D, col: CITY_COLS[L], b, L };
  });
}
function drawCity() {
  const H = cam.y - GROUND, u = S.w / 1920;
  for (const L of CITY) {
    const k = S.f / L.D, baseY = S.cy + H * k;
    for (const b of L.b) {
      const x = S.cx + (b.x - cam.x) * k, w = b.w * k; if (x + w < 0 || x > S.w) continue;
      const top = S.cy - (b.h - H) * k, bot = Math.min(S.h, baseY); if (top > S.h || bot <= top) continue;
      ctx.fillStyle = L.col; ctx.fillRect(x, top, w + 0.7, bot - top);
      if (b.win.length && w > 6) { const s = Math.max(1, Math.min(3.2, w * 0.035)); for (const [wu, wv, r] of b.win) { const wy = top + wv * b.h * k; if (wy < 0 || wy > bot) continue; ctx.fillStyle = winCol(r, 0.18 + r * 0.45); ctx.fillRect(x + wu * w, wy, s, s); } }
    }
    const hz = ctx.createLinearGradient(0, S.cy - 40 * u, 0, S.cy + 90 * u);
    hz.addColorStop(0, 'rgba(120,92,220,0)'); hz.addColorStop(1, `rgba(${L.L < 3 ? '110,84,205' : '20,16,44'},${0.2 - L.L * 0.02})`);
    ctx.fillStyle = hz; ctx.fillRect(0, S.cy - 40 * u, S.w, 130 * u);
  }
}

/* Wände und Bildschirme der Etagen: nur Balken, Linien und Formen, keine Schrift, keine Zahlen */
const pale = (a) => `rgba(246,244,240,${a})`;
function tex(w, h, seed, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, mulberry(seed), (x, y, bw, bh, col, r = bh / 2) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill(); }); return c; }
function pfeil(g, x0, y0, x1, y1, s = 12) { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.moveTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s); g.lineTo(x1, y1); g.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s); g.stroke(); }
function buildTextures() {
  // PR: Wand voller Karten, drei markiert und verbunden
  TEX.pr = tex(1500, 560, 34, (g, R, bar) => {
    const cols = 10, cw = 116, ch = 92, pick = [3, 16, 28], at = [], draw = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < cols; i++) { const x = 68 + i * 138 + (R() - 0.5) * 16 + cw / 2, y = 52 + j * 124 + (R() - 0.5) * 16 + ch / 2; draw.push([x, y, (R() - 0.5) * 0.07, pick.includes(j * cols + i)]); if (pick.includes(j * cols + i)) at.push([x, y]); }
    const card = ([x, y, rot, on]) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      if (on) { g.shadowColor = 'rgba(167,139,250,.9)'; g.shadowBlur = 30; }
      g.fillStyle = on ? '#5F4BB6' : pale(0.1); g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 6); g.fill(); g.shadowBlur = 0;
      if (on) { g.strokeStyle = '#C4B5FD'; g.lineWidth = 3; g.stroke(); }
      bar(-cw / 2 + 12, -ch / 2 + 16, cw * 0.46, 9, on ? 'rgba(255,255,255,.92)' : pale(0.2)); bar(-cw / 2 + 12, -ch / 2 + 38, cw * 0.72, 6, on ? 'rgba(255,255,255,.6)' : pale(0.12)); bar(-cw / 2 + 12, -ch / 2 + 54, cw * 0.56, 6, on ? 'rgba(255,255,255,.6)' : pale(0.12));
      g.fillStyle = on ? '#EFEAFB' : pale(0.32); g.beginPath(); g.arc(0, -ch / 2 + 5, 4, 0, 7); g.fill();
      g.restore();
    };
    draw.filter((d) => !d[3]).forEach(card);
    g.strokeStyle = 'rgba(196,181,253,.7)'; g.lineWidth = 3; g.setLineDash([10, 9]); g.beginPath(); at.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
    draw.filter((d) => d[3]).forEach(card);
  });
  // MAKE Studios: eine Website als Drahtmodell
  TEX.web = tex(900, 540, 5, (g, R, bar) => {
    g.fillStyle = '#0d0d14'; g.fillRect(0, 0, 900, 540); g.fillStyle = '#191822'; g.fillRect(0, 0, 900, 46);
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.3); g.beginPath(); g.arc(26 + i * 24, 23, 7, 0, 7); g.fill(); }
    bar(40, 78, 96, 16, pale(0.55)); for (let i = 0; i < 4; i++) bar(540 + i * 84, 81, 60, 10, pale(0.24));
    bar(40, 150, 400, 38, pale(0.88), 7); bar(40, 202, 310, 38, pale(0.88), 7); bar(40, 262, 350, 12, pale(0.3)); bar(40, 286, 290, 12, pale(0.3));
    bar(40, 326, 160, 44, AKZ.studios, 7);
    g.fillStyle = pale(0.07); g.beginPath(); g.roundRect(500, 132, 360, 240, 12); g.fill(); g.fillStyle = '#8B5CF6'; g.beginPath(); g.arc(680, 252, 56, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.07); g.beginPath(); g.roundRect(40 + i * 280, 412, 260, 104, 9); g.fill(); bar(58 + i * 280, 432, 120, 12, pale(0.42)); bar(58 + i * 280, 458, 200, 8, pale(0.18)); bar(58 + i * 280, 476, 170, 8, pale(0.18)); }
  });
  // Podcast: Akustikplatten
  TEX.akustik = tex(1200, 360, 7, (g) => {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) {
      const v = (i + j) % 2, x = i * 100, y = j * 120; g.fillStyle = v ? '#1b1a25' : '#24232f'; g.fillRect(x + 3, y + 3, 94, 114);
      g.strokeStyle = 'rgba(0,0,0,.36)'; g.lineWidth = 3;
      for (let q = 1; q < 5; q++) { g.beginPath(); if (v) { g.moveTo(x + 3 + q * 19, y + 6); g.lineTo(x + 3 + q * 19, y + 114); } else { g.moveTo(x + 6, y + 3 + q * 23); g.lineTo(x + 94, y + 3 + q * 23); } g.stroke(); }
    }
  });
  // MAKE Revenue: Wandbildschirm mit Kennzahlen (Kacheln, Linien, Balken)
  TEX.kpi = tex(1400, 740, 12, (g, R, bar) => {
    const B = AKZ.revenue; g.fillStyle = '#0b0c12'; g.fillRect(0, 0, 1400, 740);
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 272; g.fillStyle = pale(0.06); g.beginPath(); g.roundRect(x, 30, 252, 190, 12); g.fill();
      bar(x + 20, 52, 110 + ((i * 23) % 60), 12, pale(0.4)); bar(x + 20, 84, 96, 36, i === 1 ? B : pale(0.86), 7);
      g.strokeStyle = i % 2 ? pale(0.5) : B; g.lineWidth = 5; g.lineJoin = 'round'; g.beginPath();
      for (let k = 0; k < 8; k++) { const yy = 200 - (16 + R() * 34 + k * (i === 2 ? -3 : 4.5)) - (i === 2 ? 30 : 0); if (k) g.lineTo(x + 20 + k * 30, yy); else g.moveTo(x + 20 + k * 30, yy); } g.stroke();
    }
    g.fillStyle = pale(0.05); g.beginPath(); g.roundRect(30, 250, 830, 460, 12); g.fill(); bar(54, 276, 200, 14, pale(0.4));
    g.strokeStyle = pale(0.08); g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(54, 360 + k * 96); g.lineTo(836, 360 + k * 96); g.stroke(); }
    g.setLineDash([14, 12]); g.strokeStyle = pale(0.42); g.lineWidth = 5; g.beginPath(); g.moveTo(60, 648); g.lineTo(826, 350); g.stroke(); g.setLineDash([]);
    g.lineWidth = 8; g.strokeStyle = B; g.lineJoin = 'round'; g.beginPath(); [0.2, 0.26, 0.24, 0.36, 0.42, 0.4, 0.52, 0.6, 0.66, 0.8].forEach((v, k) => { const x = 60 + k * 85, y = 690 - v * 400; if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    g.fillStyle = pale(0.05); g.beginPath(); g.roundRect(890, 250, 480, 460, 12); g.fill(); bar(914, 276, 160, 14, pale(0.4));
    [0.92, 0.64, 0.46, 0.3, 0.2].forEach((v, k) => bar(914, 326 + k * 74, 430 * v, 42, k === 4 ? B : pale(0.2 + 0.05 * k), 7));
  });
  // MAKE Innovation: Whiteboard mit einem Ablauf aus Kästchen und Pfeilen
  TEX.board = tex(1300, 680, 3, (g, R, bar) => {
    const bg = g.createLinearGradient(0, 0, 0, 680); bg.addColorStop(0, '#bdb9c9'); bg.addColorStop(1, '#a5a1b3'); g.fillStyle = bg; g.fillRect(0, 0, 1300, 680);
    const ink = '#262433'; g.strokeStyle = ink; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
    const box = (x, y, w, h2, on) => { if (on) { g.fillStyle = '#5F4BB6'; g.beginPath(); g.roundRect(x, y, w, h2, 10); g.fill(); } g.strokeStyle = on ? '#4c1d95' : ink; g.beginPath(); g.roundRect(x, y, w, h2, 10); g.stroke(); g.strokeStyle = ink; bar(x + 22, y + 26, w * 0.5, 10, on ? 'rgba(255,255,255,.9)' : 'rgba(38,36,51,.55)'); bar(x + 22, y + 50, w * 0.68, 8, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.32)'); };
    box(70, 90, 230, 120); box(400, 90, 230, 120); box(730, 90, 230, 120, true); box(1030, 90, 200, 120);
    pfeil(g, 310, 150, 390, 150, 18); pfeil(g, 640, 150, 720, 150, 18); pfeil(g, 970, 150, 1020, 150, 18);
    box(400, 330, 230, 120); box(730, 330, 230, 120); pfeil(g, 515, 220, 515, 320, 18); pfeil(g, 845, 220, 845, 320, 18); pfeil(g, 640, 390, 720, 390, 18);
    box(560, 520, 240, 110); pfeil(g, 845, 460, 760, 512, 18); pfeil(g, 515, 460, 600, 512, 18);
    g.lineWidth = 5; g.beginPath(); g.moveTo(80, 330); g.lineTo(300, 330); g.moveTo(80, 372); g.lineTo(260, 372); g.moveTo(80, 414); g.lineTo(290, 414); g.moveTo(1010, 380); g.lineTo(1230, 380); g.moveTo(1010, 422); g.lineTo(1180, 422); g.stroke();
  });
  // Etage 1: Auswertung als Netz mit Balken (Radar), Ablaufplan als Stufen mit Pfeilen
  TEX.radar = tex(900, 760, 21, (g, R, bar) => {
    g.fillStyle = '#0c0c13'; g.fillRect(0, 0, 900, 760); g.fillStyle = '#191822'; g.fillRect(0, 0, 900, 40); bar(26, 14, 130, 12, pale(0.45));
    const cx = 290, cy = 380, rr = 240, pt = (i, f) => [cx + Math.sin((i * 2 * Math.PI) / 5) * rr * f, cy - Math.cos((i * 2 * Math.PI) / 5) * rr * f];
    const weg = (fs) => { g.beginPath(); fs.forEach((f, i) => { const q = pt(i, f); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); };
    g.strokeStyle = pale(0.32); g.lineWidth = 3; g.lineJoin = 'round';
    for (const f of [0.34, 0.67, 1]) { weg([f, f, f, f, f]); g.stroke(); }
    for (let i = 0; i < 5; i++) { const q = pt(i, 1); g.beginPath(); g.moveTo(cx, cy); g.lineTo(q[0], q[1]); g.stroke(); }
    weg([0.84, 0.5, 0.7, 0.36, 0.78]); g.fillStyle = 'rgba(139,92,246,.5)'; g.fill(); g.strokeStyle = '#CDC0FF'; g.lineWidth = 6; g.stroke();
    weg([0.5, 0.62, 0.45, 0.7, 0.4]); g.strokeStyle = pale(0.5); g.lineWidth = 3; g.setLineDash([12, 9]); g.stroke(); g.setLineDash([]);
    [0.88, 0.62, 0.78, 0.4, 0.54].forEach((v, k) => { bar(580, 150 + k * 96, 280, 18, pale(0.12)); bar(580, 150 + k * 96, 280 * v, 18, k === 0 ? '#A78BFA' : pale(0.5)); });
    bar(580, 120, 110, 10, pale(0.4));
  });
  TEX.plan = tex(900, 620, 22, (g, R, bar) => {
    g.fillStyle = '#d9d5e4'; g.fillRect(0, 0, 900, 620); g.fillStyle = '#5F4BB6'; g.fillRect(0, 0, 900, 70); bar(34, 26, 240, 16, 'rgba(255,255,255,.9)');
    const ink = '#262433'; g.lineJoin = 'round';
    [0, 1, 2, 3].forEach((i) => { const x = 40 + i * 205, on = i === 1; g.fillStyle = on ? '#5F4BB6' : 'rgba(38,36,51,.16)'; g.beginPath(); g.moveTo(x, 130); g.lineTo(x + 170, 130); g.lineTo(x + 205, 200); g.lineTo(x + 170, 270); g.lineTo(x, 270); g.lineTo(x + 35, 200); g.closePath(); g.fill(); bar(x + 56, 184, 90, 12, on ? 'rgba(255,255,255,.9)' : 'rgba(38,36,51,.5)'); bar(x + 56, 210, 60, 9, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.3)'); });
    [[0.2, 0.52], [0.34, 0.72], [0.18, 0.4], [0.26, 0.64]].forEach(([a, b], j) => { const y = 330 + j * 66; bar(40, y, 90, 12, 'rgba(38,36,51,.4)'); bar(160 + a * 640, y - 2, (b - a) * 640 * 0.9, 24, j === 1 ? '#5F4BB6' : 'rgba(38,36,51,.28)', 5); });
    g.strokeStyle = ink; g.lineWidth = 6; g.lineCap = 'round'; pfeil(g, 760, 560, 840, 560, 16);
  });
  // Etage 3: Themenplan der Redaktion, vier Spalten (Quartale) mit Karten, eine Karte pro Spalte hervorgehoben
  TEX.themen = tex(900, 760, 31, (g, R, bar) => {
    g.fillStyle = '#d9d5e4'; g.fillRect(0, 0, 900, 760); g.fillStyle = '#5F4BB6'; g.fillRect(0, 0, 900, 78); bar(36, 30, 260, 16, 'rgba(255,255,255,.9)');
    const n = [4, 3, 4, 3];
    for (let i = 0; i < 4; i++) {
      const x = 28 + i * 215; g.fillStyle = 'rgba(38,36,51,.1)'; g.fillRect(x, 100, 200, 640); bar(x + 14, 114, 90, 12, 'rgba(38,36,51,.5)');
      for (let j = 0; j < n[i]; j++) { const y = 152 + j * 146, on = j === (i * 2) % n[i]; g.fillStyle = on ? '#5F4BB6' : 'rgba(255,255,255,.7)'; g.beginPath(); g.roundRect(x + 12, y, 176, 122, 8); g.fill(); bar(x + 26, y + 20, 100, 11, on ? 'rgba(255,255,255,.9)' : 'rgba(38,36,51,.5)'); bar(x + 26, y + 46, 140, 8, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.28)'); bar(x + 26, y + 66, 110, 8, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.28)'); g.fillStyle = on ? '#EFEAFB' : 'rgba(95,75,182,.55)'; g.beginPath(); g.arc(x + 160, y + 100, 9, 0, 7); g.fill(); }
    }
  });
  // Etage 3: große Stempelkarte, Raster aus Kreisen, einige gefüllt, ein Geschenk-Feld am Ende
  TEX.stempel = tex(800, 700, 41, (g, R, bar) => {
    g.fillStyle = '#ece8f5'; g.fillRect(0, 0, 800, 700); g.fillStyle = '#5F4BB6'; g.fillRect(0, 0, 800, 120); bar(44, 44, 300, 18, 'rgba(255,255,255,.92)'); bar(44, 76, 190, 10, 'rgba(255,255,255,.55)');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const n = j * 4 + i, on = n < 7, x = 120 + i * 190, y = 230 + j * 150; g.beginPath(); g.arc(x, y, 58, 0, 7); if (on) { g.fillStyle = '#5F4BB6'; g.fill(); g.fillStyle = '#EFEAFB'; g.beginPath(); g.moveTo(x - 22, y + 2); g.lineTo(x - 6, y + 18); g.lineTo(x + 24, y - 16); g.lineWidth = 9; g.strokeStyle = '#EFEAFB'; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); } else { g.lineWidth = 6; g.strokeStyle = 'rgba(38,36,51,.4)'; g.setLineDash([12, 10]); g.stroke(); g.setLineDash([]); } }
    bar(44, 660, 220, 14, 'rgba(38,36,51,.3)');
  });
  // MAKE Innovation: Bildschirm mit einem einfachen Ablaufdiagramm
  TEX.flow = tex(800, 480, 4, (g, R, bar) => {
    g.fillStyle = '#0c0c13'; g.fillRect(0, 0, 800, 480); g.strokeStyle = pale(0.45); g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
    const node = (x, y, on) => { g.fillStyle = on ? '#8B5CF6' : pale(0.13); g.beginPath(); g.roundRect(x, y, 170, 76, 10); g.fill(); bar(x + 18, y + 22, 90, 9, on ? 'rgba(255,255,255,.9)' : pale(0.4)); bar(x + 18, y + 44, 120, 7, on ? 'rgba(255,255,255,.55)' : pale(0.2)); };
    node(50, 60); node(315, 60, true); node(580, 60); pfeil(g, 228, 98, 305, 98); pfeil(g, 493, 98, 570, 98);
    g.fillStyle = pale(0.13); g.beginPath(); g.moveTo(400, 200); g.lineTo(470, 250); g.lineTo(400, 300); g.lineTo(330, 250); g.closePath(); g.fill(); pfeil(g, 400, 142, 400, 192);
    node(50, 350); node(580, 350); pfeil(g, 322, 250, 140, 342); pfeil(g, 478, 250, 660, 342);
  });
}

function sizeScene() {
  const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const lr = $('#seqLayer').getBoundingClientRect();
  let w = (lr.width || innerWidth) * dpr, h = (lr.height || innerHeight) * dpr;
  const cap = innerWidth < 1024 || coarse ? 1280 : 1920, k = Math.min(1, cap / Math.max(w, h));
  w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
  cv.width = w; cv.height = h; S.w = w; S.h = h; S.narrow = w < h * 0.9; S.cx = w / 2;
  S.f = S.f0 = S.narrow ? h * 0.6 : Math.max(w * 0.85, h * 1.05);
  skyHy = Math.round(h * 0.95); sky = buildBackdrop(w, Math.round(h * 1.95), skyHy, 7, 0.3, false);
  if (!CITY) CITY = buildCity();
  buildKeys(); sceneDirty = true;
}

const P = (x, y, z) => { const k = S.f / Math.max(NEAR, z - cam.z); return [S.cx + (x - cam.x) * k, S.cy - (y + oy - cam.y) * k]; };
function clipNear(pts) {
  const out = [], n = pts.length, zc = cam.z + NEAR;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], da = a[2] - zc, db = b[2] - zc;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, zc]); }
  }
  return out;
}
function poly(pts, fill) {
  const c = clipNear(pts); if (c.length < 3) return false;
  ctx.beginPath();
  for (let i = 0; i < c.length; i++) { const q = P(c[i][0], c[i][1], c[i][2]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } return true;
}
function seg(a, b, style, lw = 1) {
  const zc = cam.z + NEAR; let A = a, B = b; const da = a[2] - zc, db = b[2] - zc;
  if (da < 0 && db < 0) return;
  if (da < 0) { const t = da / (da - db); A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, zc]; }
  if (db < 0) { const t = db / (db - da); B = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, zc]; }
  const p = P(A[0], A[1], A[2]), q = P(B[0], B[1], B[2]);
  ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
}
const lg = (a, b, stops) => { const A = P(a[0], a[1], a[2]), B = P(b[0], b[1], b[2]); const g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const sgr = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
function rectZ(x0, x1, y0, y1, z) { if (z - cam.z < NEAR) return null; const a = P(x0, y1, z), b = P(x1, y0, z); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; }
function fillZ(x0, x1, y0, y1, z, fill) { const r = rectZ(x0, x1, y0, y1, z); if (!r) return null; ctx.fillStyle = fill; ctx.fillRect(r[0], r[1], r[2], r[3]); return r; }
function glow(x, y, z, radM, stops) {
  if (z - cam.z < NEAR) return; const p = P(x, y, z), r = (radM * S.f) / (z - cam.z); if (r < 1) return;
  const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
}
function box(x0, x1, y0, y1, z0, z1, cTop, cFront, cSide) {
  if (cam.x < x0) poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], cSide);
  if (cam.x > x1) poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], cSide);
  if (cam.y > y1 + oy) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cTop);
  if (cam.z < z0) poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], cFront);
}
const lwAt = (z, m) => Math.max(1, (m * S.f) / Math.max(1, z - cam.z)); // Strichstärke in Metern

/* Kamera: der Auftakt ist eine eigene Fahrt, danach Stützpunkte je Halt */
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
let introK = reduce ? 1 : 0; // 0 → 1 nach dem Vorlader: die Kamera gleitet heran, statt zu stehen
const HERO_END = () => ({ x: S.narrow ? 0 : -3.5, y: 1.75, d: S.narrow ? 19 : 16, cy: S.narrow ? 0.4 : 0.58 });
function heroCam(s) {
  const n = S.narrow, E = HERO_END(), START = n ? 70 : 58;
  const t = 1 - Math.pow(1 - s, 1.7);                                    // gleichmäßig heran, weich ausrollen
  const d = Math.exp(lerp(Math.log(START), Math.log(E.d), t)) * (1 + 0.42 * (1 - introK));
  cam.z = STAGE.zc - d;
  cam.x = lerp(n ? -1.5 : -12, E.x, smooth(s / 0.8));
  cam.y = lerp(5.2, E.y, smooth(s / 0.6)) + 2.2 * (1 - introK);
  S.cy = S.h * lerp(n ? 0.36 : 0.62, E.cy, smooth(s / 0.5));
}
let KF = [];
function buildKeys() {
  const n = S.narrow, E = HERO_END(), cyT = n ? 0.19 : 0.5;
  const zA = n ? -17 : -15, zB = n ? -13 : -12, xA = n ? 0 : -2.6, xB = n ? 0 : -1.4;
  KF = [{ p: HERO[1], x: E.x, y: E.y, z: STAGE.zc - E.d, cy: E.cy }, { p: TURN_END, x: n ? 0 : -8, y: 1.6, z: zA - 3, cy: cyT }];
  FLOORS.forEach((F, i) => { const [a, b] = floorRange(i), y = F.base + F.eye; KF.push({ p: a + (b - a) * TRAVEL_PART, x: xA, y, z: zA, cy: cyT }, { p: b, x: xB, y, z: zB, cy: cyT }); });
  KF.push({ p: THREAD[1], x: n ? -22 : -23, y: n ? -64 : -66, z: n ? -128 : -215, cy: 0.5 });   // das ganze Haus
  KF.push({ p: SPOTS[1], x: n ? 2 : -10.5, y: n ? -2 : 4, z: n ? -56 : -40, cy: n ? 0.4 : 0.7 });   // das Dach
  KF.push({ p: 1, x: n ? 2 : -10, y: n ? -2 : 4.3, z: n ? -52 : -37, cy: n ? 0.4 : 0.7 });
}
const insideK = (p, i) => { const [a, b] = floorRange(i), d = ((p - a) / (b - a) - TRAVEL_PART) / (1 - TRAVEL_PART); return d <= 0 || d >= 1 ? 0 : smooth((d - 0.08) / 0.22) * (1 - smooth((d - 0.78) / 0.18)); };
let INS = { k: 0, i: -1, F: null }, AKT = { k: 0, F: null }; // INS: der Raum, in dem die Kamera gerade steht · AKT: dasselbe oder das Dach
let NCY = 0.235, NDZ = 2.5, NCYD = 0.19, NZF = 1; // nur Handy (schmal): Höhe der Bildmitte im Raum, Abstand der Kamera auf dem Dach und Höhe der Bildmitte auf dem Dach, je Szene (szenen.json › bild.cyn, dz, cyd, fzd)
let ZOOM = 1; // 1 = so viele Meter, wie der Raum vorgibt; kleiner = näher heran (je Szene, szenen.json › bild.zoom)
/* Die freie Fläche neben dem Text: breit rechts von der Spalte, am Handy das Bild über dem Text */
const freiFlaeche = () => (wide.matches && !S.narrow ? [innerWidth <= 1100 ? 0.57 : 0.47, 0.93] : [0, 1]);
const dachK = (p) => { const [a, b] = floorRange(DACH_HALT), q = (p - a) / (b - a); return q <= 0 || q > 1 ? 0 : smooth((q - 0.48) / 0.17) * (1 - smooth((q - 0.9) / 0.085)); };
function innenCam() {
  const F = INS.F, k = INS.k, MK = MARKE[F.key], [L, R] = freiFlaeche();
  const dRef = 6.6, zIn = 0.5, fIn = Math.min(S.w * 1.5, ((R - L) * S.w * dRef) / ((MK.breite || 4.6) * ZOOM)), mitte = (L + R) / 2; // die Breite des Raums passt in die freie Fläche
  const xIn = zoneX(F.key) - ((mitte - 0.5) * S.w * dRef) / fIn;
  cam.x = lerp(cam.x, xIn, k); cam.y = lerp(cam.y, F.base + 1.5, k); cam.z = lerp(cam.z, zIn, k);
  S.f = lerp(S.f0, fIn, k); S.cy = lerp(S.cy, S.h * (S.narrow ? NCY : 0.53), k);
}
function dachCam(k) { // auf dem Dach bleibt die Ansicht draußen und schwenkt zur Bühne
  const [L, R] = freiFlaeche(), [za, zb, zt] = zwischen(MARKE.dach.zz, MARKE.dach.zone.v), z = lerp(za, zb, zt) - (S.narrow ? NDZ : 0), d = 5.6 - z;
  cam.x = lerp(cam.x, zoneX('dach') - (((L + R) / 2 - 0.5) * S.w * d) / S.f, k); cam.z = lerp(cam.z, z, k);
  if (S.narrow) { S.cy = lerp(S.cy, S.h * NCYD, k); S.f = lerp(S.f, S.f * NZF, k); }
}
function camera(p) {
  S.f = S.f0; INS.k = 0;
  if (p <= HERO[1]) { heroCam(span(p, HERO)); INS = { k: 0, i: -1, F: null }; AKT = { k: 0, F: null }; return; }
  let i = 0; while (i < KF.length - 2 && p > KF[i + 1].p) i++;
  const A = KF[i], B = KF[i + 1], t = easeInOutSine(clamp01((p - A.p) / (B.p - A.p)));
  cam.x = lerp(A.x, B.x, t); cam.y = lerp(A.y, B.y, t);
  cam.z = A.z < 0 && B.z < 0 ? -Math.exp(lerp(Math.log(-A.z), Math.log(-B.z), t)) : lerp(A.z, B.z, t);
  S.cy = S.h * lerp(A.cy, B.cy, t);
  INS = { k: 0, i: -1, F: null };
  for (const j of MARKEN_HALTE) { const k = insideK(p, j); if (k > 0) INS = { k, i: j, F: FLOORS[j] }; }
  if (INS.k > 0) innenCam();
  AKT = INS.k > 0 ? INS : { k: dachK(p), F: FLOORS[DACH_HALT] };
  if (AKT.k > 0 && AKT.F.roof) dachCam(AKT.k);
}
/* Die Kamera für eine Ansicht: entweder auf der Zeitachse (der Aufzug fährt) oder als Flug von einer Stelle zur anderen (blende). Eine Stelle ist eine Zahl der Zeitachse oder eine eigene Lage { x, y, z, cy }. */
function stelle(o) {
  if (typeof o === 'number') camera(o);
  else { S.f = S.f0; cam.x = o.x; cam.y = o.y; cam.z = o.z; S.cy = S.h * o.cy; INS = { k: 0, i: -1, F: null }; AKT = { k: 0, F: FLOORS[DACH_HALT] }; }
  return { x: cam.x, y: cam.y, z: cam.z, cy: S.cy, f: S.f };
}
function kamera(v) {
  if (!v.blende) { camera(v.p); return; }
  const a = stelle(v.blende.pa), b = stelle(v.blende.pb), t = v.blende.t;
  cam.x = lerp(a.x, b.x, t); cam.y = lerp(a.y, b.y, t); cam.z = a.z < 0 && b.z < 0 ? -Math.exp(lerp(Math.log(-a.z), Math.log(-b.z), t)) : lerp(a.z, b.z, t);
  S.cy = lerp(a.cy, b.cy, t); S.f = lerp(a.f, b.f, t);
  INS = { k: 0, i: -1, F: null }; AKT = { k: 0, F: FLOORS[DACH_HALT] };
}

/* Wo der Kern gerade ist: erst auf dem Sockel im Erdgeschoss, dann in der Kabine, auf zwei Etagen steigt er aus
   (in den Räumen zum Hineingehen: Hocker bei MAKE Studios, Tisch im Podcast, sonst ein Stehtisch), am Ende steht er auf der Bühne. door: 1 = Tür offen, 0 = zu */
function coreState(p) {
  const q0 = (p - TOUR_START) / FLOOR_LEN;
  if (q0 < 0.8) return { x: PED.x, y: GROUND + PED.h + 0.27, z: PED.z, level: LEVELS[0], cab: GROUND, door: 1 };
  if (q0 < 1) { const t = smooth((q0 - 0.8) / 0.2); return { x: lerp(PED.x, SHAFT.x, t), y: GROUND + lerp(PED.h + 0.27, 1.25, t) + Math.sin(t * Math.PI) * 0.4, z: lerp(PED.z, SHAFT.z, t), level: LEVELS[0], cab: GROUND, door: 1 }; }
  const doorOf = (tr) => (tr >= 1 || tr <= 0 ? 1 : 1 - clamp01(Math.min(tr, 1 - tr) / 0.1));
  for (let i = 1; i < HALTS; i++) {
    const [a, b] = floorRange(i); if (p >= b && i < HALTS - 1) continue;
    const F = FLOORS[i], tr = clamp01((p - a) / (FLOOR_LEN * TRAVEL_PART)), t = easeInOutSine(tr), base = lerp(FLOORS[i - 1].base, F.base, t);
    const c = { x: SHAFT.x, y: base + 1.25, z: SHAFT.z, level: lerp(LEVELS[i - 1], LEVELS[i], t), cab: base, door: doorOf(tr) };
    if (tr < 1) return c;
    const d = (p - a - FLOOR_LEN * TRAVEL_PART) / (FLOOR_LEN * (1 - TRAVEL_PART)), R = 0.25 + 0.13 * c.level;
    const out = MARKE[F.key] && !F.roof ? kernplatz(F.key, R) : null;
    if (out) { // der Kern steigt aus, liegt im Licht und steigt wieder ein
      const s = smooth(d / 0.16) * (1 - smooth((d - 0.84) / 0.16));
      c.x = lerp(SHAFT.x, out[0], s); c.z = lerp(SHAFT.z, out[2], s); c.y = base + lerp(1.25, out[1], s) + Math.sin(s * Math.PI) * 0.35; c.im = s > 0.5 ? F.key : null;
    } else if (F.roof) { // auf dem Dach schwebt er auf die Bühne und bleibt dort
      const s = smooth(d / 0.2);
      c.x = lerp(SHAFT.x, 0, s); c.z = lerp(SHAFT.z, STAGE.zc, s); c.y = lerp(1.25, STAGE.y + 0.75, s) + Math.sin(s * Math.PI) * 0.8; c.level = 1 + 0.3 * span(p, SPOTS);
    }
    return c;
  }
}
function drawCore(c) {
  oy = 0; coreAt = null;
  const dz = c.z - cam.z; if (dz < 1) return;
  const k = S.f / dz, q = P(c.x, c.y, c.z), L = clamp01(c.level), R = Math.max(1.6, (0.25 + 0.13 * L + 0.4 * clamp01((c.level - 1) / 0.3)) * k); // auf der Bühne, im Licht, wird er groß
  coreAt = [q[0] / S.w, q[1] / S.h];
  if (q[0] < -300 || q[0] > S.w + 300 || q[1] < -300 || q[1] > S.h + 300) return;
  // die Kabine: Rückwand, Decke mit Licht, Boden, Tragseil (ausgeblendet, sobald die Kamera an ihr vorbei in den Raum fährt)
  const kab = clamp01((SHAFT.z - cam.z - 1.3) / 4);
  const ks = S.f / Math.max(1, SHAFT.z - cam.z), X = (x) => S.cx + (x - cam.x) * ks, Y = (y) => S.cy - (y - cam.y) * ks;
  const cx0 = X(SHAFT.x0 + 0.08), cx1 = X(SHAFT.x1 - 0.08), cw = cx1 - cx0, cT = Y(c.cab + 2.5), cB = Y(c.cab + 0.03), top = Math.max(2, 0.15 * ks), bot = Math.max(2, 0.1 * ks), A = 0.3 + 0.24 * L;
  if (kab > 0) { ctx.globalAlpha = kab;
  ctx.strokeStyle = `rgba(${LAVH},.42)`; ctx.lineWidth = Math.max(1, 0.024 * ks);
  for (const dx of [-0.07, 0.07]) { ctx.beginPath(); ctx.moveTo((cx0 + cx1) / 2 + dx * ks, cT); ctx.lineTo((cx0 + cx1) / 2 + dx * ks, Math.min(cT, Y(2.66))); ctx.stroke(); }
  ctx.fillStyle = 'rgba(12,11,24,.5)'; ctx.fillRect(cx0, cT, cw, cB - cT);
  ctx.fillStyle = `rgba(${LAV},${0.05 + 0.05 * L})`; ctx.fillRect(cx0, cT, cw, cB - cT);
  ctx.fillStyle = `rgba(${LAV},${A})`; ctx.fillRect(cx0, cT, cw, top); ctx.fillRect(cx0, cB - bot, cw, bot);
  ctx.fillStyle = `rgba(${WARM},${0.45 + 0.3 * L})`; ctx.fillRect(cx0 + cw * 0.14, cT + top, cw * 0.72, Math.max(1, 0.035 * ks));
  ctx.strokeStyle = `rgba(${LAVH},${A + 0.12})`; ctx.lineWidth = Math.max(1, 0.03 * ks); ctx.strokeRect(cx0, cT, cw, cB - cT);
  ctx.globalAlpha = 1; }
  // der Schein
  const gr = Math.max(R * 1.7, (0.5 + 3.4 * L * L) * k * (1 + Math.max(0, c.level - 1) * 3.5));
  const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], gr); g.addColorStop(0, `rgba(${LAV},${0.08 + 0.52 * L})`); g.addColorStop(0.3, `rgba(139,92,246,${0.02 + 0.2 * L})`); g.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(q[0] - gr, q[1] - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over';
  // der Kern: matt und grauviolett auf der Straße, oben das Violett des Zeichens mit hellem Licht
  const mix = (m, n) => m.map((v, i) => Math.round(lerp(v, n[i], L)));
  const bg = ctx.createRadialGradient(q[0] - R * 0.25, q[1] - R * 0.3, R * 0.05, q[0], q[1], R);
  bg.addColorStop(0, `rgb(${mix([96, 86, 138], [226, 216, 255])})`); bg.addColorStop(1, `rgb(${mix([72, 62, 116], [139, 92, 246])})`);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 7); ctx.fill();
  // die zweiflügelige Glastür: am Halt offen, in der Fahrt zu
  if (kab <= 0) return; ctx.globalAlpha = kab;
  const open = clamp01(c.door), dT = cT + top, dB = cB - bot, leaf = (cw / 2) * (1 - 0.8 * open);
  ctx.fillStyle = `rgba(${LAVH},${0.09 + 0.07 * (1 - open)})`; ctx.strokeStyle = `rgba(${LAVH},${0.4 + 0.25 * (1 - open)})`; ctx.lineWidth = Math.max(1, 0.022 * ks);
  for (const x of [cx0, cx1 - leaf]) { ctx.fillRect(x, dT, leaf, dB - dT); ctx.strokeRect(x, dT, leaf, dB - dT); }
  ctx.globalAlpha = 1;
}

/* Menschen als Umrisse (stehend oder sitzend), mit einer schmalen Lichtkante */
const FIGP = {
  body: new Path2D('M-5.5 161C-9 157-17 154.5-22 151.5C-26.5 148.5-28 141-28.5 133C-29 123-28.5 114-27 106C-26 101-24.5 97-22.5 94L-17.5 95L-17 98L17 98L17.5 95L22.5 94C24.5 97 26 101 27 106C28.5 114 29 123 28.5 133C28 141 26.5 148.5 22 151.5C17 154.5 9 157 5.5 161Z'),
  legs: new Path2D('M-17.5 100C-19.5 80-17 60-15.5 48C-14.5 34-13.5 18-12.5 5L-4.5 5C-4 25-2.5 50-1 80L1 80C2.5 50 4 25 4.5 5L12.5 5C13.5 18 14.5 34 15.5 48C17 60 19.5 80 17.5 100Z'),
  bob: new Path2D('M-10.4 177C-10.8 188.5 10.8 188.5 10.4 177L10.9 161.5C7 158.6-7 158.6-10.9 161.5Z'),
  head: (() => { const h = new Path2D(); h.ellipse(0, 174, 9.3, 11.2, 0, 0, 7); return h; })(),
};
function sil(px, pz, o = {}) {
  const dz = pz - cam.z; if (dz < 0.55) return;
  const k = (S.f / dz / 100) * (o.s || 1), [sx, sy] = P(px, o.seat ? 0.46 : 0, pz);
  if (sx + 60 * k < 0 || sx - 60 * k > S.w) return;
  if (!o.seat && !o.profil) {
    ctx.save(); const sh = ctx.createRadialGradient(sx, sy + 2 * k, 0, sx, sy + 2 * k, 44 * k); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.translate(sx, sy + 2 * k); ctx.scale(1, 0.16); ctx.translate(-sx, -(sy + 2 * k)); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(sx, sy + 2 * k, 44 * k, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(sx, sy); ctx.scale((o.flip ? -1 : 1) * k, -k); if (o.seat) { ctx.translate(0, -94); if (!o.profil) ctx.scale(0.8, 1); } // Sitzende von hinten: schlankere Schultern
  ctx.fillStyle = o.col || '#0b0b11';
  if (o.profil) { // sitzend, von der Seite, mit Kopfhörern: Stuhl, Bein, Rumpf, ein Arm zum Tisch
    if (o.umriss) ctx.fillStyle = `rgba(${o.umriss},.3)`;
    ctx.fillRect(-27, 42, 6, 54); ctx.fillRect(-27, 40, 48, 6); ctx.fillRect(-25, 0, 4, 42); ctx.fillRect(15, 0, 4, 42);
    ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(-6, 53); ctx.lineTo(34, 53); ctx.lineTo(36, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(41, 4, 8, 3.6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(0, -48); ctx.scale(0.62, 1); ctx.fill(FIGP.body); ctx.restore();
    ctx.lineWidth = 8.5; ctx.beginPath(); ctx.moveTo(2, 100); ctx.lineTo(18, 80); ctx.lineTo(42, 84); ctx.stroke();
    ctx.fillRect(-4, 107, 9, 10); ctx.beginPath(); ctx.ellipse(3, 126, 9.6, 11.2, 0, 0, 7); ctx.fill();
    if (!o.ohneKH) { ctx.strokeStyle = `rgba(${LAVH},.9)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(3, 126, 12.6, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    ctx.fillStyle = `rgba(${LAVH},.95)`; ctx.beginPath(); ctx.ellipse(3.5, 125, 4.4, 6.4, 0, 0, 7); ctx.fill(); }
    ctx.restore(); return;
  }
  if (o.walk !== undefined) { // von der Seite, im Gehen: Beine mit Knie, Arme gegenläufig, auf Wunsch Tasche oder Telefon
    const ph = o.walk, col = ctx.fillStyle; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const legAt = o.steh ? () => [0, 54, 0, 8] : (f) => { const a = 0.42 * Math.sin(f), bend = 0.1 + 0.6 * Math.max(0, Math.cos(f)), kx = Math.sin(a) * 47, ky = 101 - Math.cos(a) * 47; return [kx, ky, kx + Math.sin(a - bend) * 46, ky - Math.cos(a - bend) * 46]; };
    const near = legAt(ph), far = legAt(ph + Math.PI);
    ctx.translate(0, 5.5 - Math.min(near[3], far[3]));                       // der tiefere Fuß steht auf dem Boden
    const leg = ([kx, ky, fx, fy]) => { ctx.lineWidth = 12.5; ctx.beginPath(); ctx.moveTo(0, 101); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke(); ctx.beginPath(); ctx.ellipse(fx + 4.5, fy - 2, 8, 3.6, 0, 0, 7); ctx.fill(); };
    const arm = (f, prop) => {
      let a = -0.36 * Math.sin(f), fore = a + 0.28;
      if (prop === 'tasche') { a *= 0.3; fore = a + 0.05; } else if (prop === 'telefon') { a = 0.3; fore = 2.05; }
      else if (prop === 'zeig') { a = 1.45; fore = 1.75; } else if (prop === 'schreib') { a = 1.05; fore = 1.65; } else if (prop === 'halte') { a = 0.75; fore = 1.9; } else if (o.steh) { a = 0.1; fore = 0.35; }
      const ex = 1 + Math.sin(a) * 30, ey = 150 - Math.cos(a) * 30, hx = ex + Math.sin(fore) * 27, hy = ey - Math.cos(fore) * 27;
      ctx.lineWidth = 8.5; ctx.beginPath(); ctx.moveTo(1, 150); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
      if (prop === 'tasche') { ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - 7); ctx.stroke(); ctx.beginPath(); ctx.roundRect(hx - 12, hy - 28, 24, 21, 3); ctx.fill(); }
      if (prop === 'telefon') { ctx.fillStyle = 'rgba(232,226,255,.95)'; ctx.fillRect(hx + 1.5, hy - 2, 3.4, 11); ctx.fillStyle = col; }
    };
    arm(ph + Math.PI, null); leg(far);
    ctx.save(); ctx.scale(0.6, 1); ctx.fill(FIGP.body); ctx.restore();
    leg(near); arm(ph, o.prop);
    const tel = o.prop === 'telefon';
    ctx.fillRect(-4, 155, 9, 11); ctx.beginPath(); ctx.ellipse(tel ? 4.5 : 2, tel ? 172.5 : 174, 9.6, 11.2, 0, 0, 7); ctx.fill();
    ctx.restore(); return;
  }
  if (o.umriss) { // nur die Kontur, gestrichelt: diese Rolle kommt erst mit dem größeren Paket dazu
    ctx.strokeStyle = `rgba(${o.umriss},.95)`; ctx.lineWidth = 2.6; ctx.setLineDash([7, 5]); ctx.fillStyle = 'rgba(11,11,17,.3)';
    for (const pth of o.seat ? [FIGP.body, FIGP.head] : [FIGP.legs, FIGP.body, FIGP.head]) { ctx.fill(pth); ctx.stroke(pth); }
    ctx.setLineDash([]); ctx.restore(); return;
  }
  if (!o.seat) { ctx.fill(FIGP.legs); for (const x of [-8.6, 8.6]) { ctx.beginPath(); ctx.ellipse(x, 3.2, 6.4, 3.4, 0, 0, 7); ctx.fill(); } }
  ctx.fill(FIGP.body); ctx.fillRect(-5.3, 155, 10.6, 11); ctx.fill(FIGP.head); if (o.bob) ctx.fill(FIGP.bob);
  if (o.rim) {
    const rim = ctx.createLinearGradient(44, 0, 6, 0); rim.addColorStop(0, `rgba(${o.rimCol || LAVH},${o.rim})`); rim.addColorStop(1, `rgba(${o.rimCol || LAVH},0)`);
    for (const [path, lw] of [[FIGP.body, 4.2], [FIGP.head, 2.6], ...(o.seat || o.walk !== undefined ? [] : [[FIGP.legs, 3]])]) { ctx.save(); ctx.clip(path); ctx.lineWidth = lw; ctx.strokeStyle = rim; ctx.stroke(path); ctx.restore(); }
  }
  if (o.kante) { // Kantenlicht von vorn: Scheitel und Schultern leuchten
    const kc = o.kanteCol || WARM, grad = (y0, y1) => { const kg = ctx.createLinearGradient(0, y0, 0, y1); kg.addColorStop(0, `rgba(${kc},${o.kante})`); kg.addColorStop(1, `rgba(${kc},0)`); return kg; };
    for (const [path, lw, kg] of [[FIGP.body, 6.5, grad(162, 140)], [o.bob ? FIGP.bob : FIGP.head, 5.5, grad(187, 171)]]) { ctx.save(); ctx.clip(path); ctx.lineWidth = lw; ctx.strokeStyle = kg; ctx.stroke(path); ctx.restore(); }
  }
  ctx.restore();
}

/* Möbel und Gerät */
const M = { top: '#5a586e', front: '#1c1b26', side: '#262532' };
function desk(x, z, w = 1.8) {
  poly([[x - w / 2 - 0.1, 0.008, z - 0.1], [x + w / 2 + 0.1, 0.008, z - 0.1], [x + w / 2 + 0.1, 0.008, z + 0.9], [x - w / 2 - 0.1, 0.008, z + 0.9]], 'rgba(0,0,0,.35)');
  box(x - w / 2 + 0.05, x - w / 2 + 0.11, 0, 1.02, z + 0.1, z + 0.7, '#111', '#101016', '#16151e'); box(x + w / 2 - 0.11, x + w / 2 - 0.05, 0, 1.02, z + 0.1, z + 0.7, '#111', '#101016', '#16151e');
  box(x - w / 2, x + w / 2, 1.02, 1.08, z, z + 0.8, M.top, M.front, M.side);
  const m = fillZ(x - 0.5, x + 0.5, 1.22, 1.82, z + 0.62, '#06060b');
  if (m) { ctx.fillStyle = sgr(0, m[1], 0, m[1] + m[3], [[0, '#2a2350'], [1, '#17142c']]); ctx.fillRect(m[0] + m[2] * 0.04, m[1] + m[3] * 0.06, m[2] * 0.92, m[3] * 0.88); ctx.fillStyle = `rgba(${LAVH},.8)`; ctx.fillRect(m[0] + m[2] * 0.12, m[1] + m[3] * 0.6, m[2] * 0.5, Math.max(1, m[3] * 0.06)); ctx.fillRect(m[0] + m[2] * 0.12, m[1] + m[3] * 0.4, m[2] * 0.32, Math.max(1, m[3] * 0.06)); ctx.fillRect(m[0] + m[2] * 0.12, m[1] + m[3] * 0.2, m[2] * 0.62, Math.max(1, m[3] * 0.06)); }
  glow(x, 1.5, z + 0.6, 1.1, [[0, `rgba(${LAV},.12)`], [1, `rgba(${LAV},0)`]]);
}
function softbox(x, z, h) { // Leuchte auf Stativ, von hinten gesehen: das Licht fällt in den Raum
  const lw = lwAt(z, 0.04);
  for (const [dx, dz] of [[-0.32, -0.22], [0.32, -0.22], [0, 0.38]]) seg([x, h, z], [x + dx, 0, z + dz], '#07070c', lw);
  box(x - 0.3, x + 0.3, h, h + 0.6, z - 0.06, z + 0.1, '#3a3849', '#16151e', '#1b1a25');
  fillZ(x - 0.3, x - 0.27, h, h + 0.6, z - 0.07, `rgba(${WARM},.8)`); fillZ(x + 0.27, x + 0.3, h, h + 0.6, z - 0.07, `rgba(${WARM},.8)`);
  glow(x, h + 0.3, z + 0.4, 2.4, [[0, `rgba(${WARM},.3)`], [1, `rgba(${WARM},0)`]]);
}
function tripod(x, z, h) { // Kamera auf Stativ, von hinten gesehen: sie zeigt in den Raum
  const lw = lwAt(z, 0.05);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [0, 0.5]]) seg([x, h, z], [x + dx, 0, z + dz], '#07070c', lw);
  box(x - 0.09, x + 0.09, h + 0.06, h + 0.22, z + 0.3, z + 0.56, '#2b2a38', '#0b0b10', '#15141c');
  box(x - 0.18, x + 0.18, h, h + 0.28, z - 0.16, z + 0.3, '#3a3849', '#101016', '#1b1a25');
  fillZ(x - 0.11, x + 0.11, h + 0.07, h + 0.21, z - 0.165, `rgba(${LAVH},.85)`);
  glow(x, h + 0.14, z - 0.17, 0.5, [[0, `rgba(${LAV},.35)`], [1, `rgba(${LAV},0)`]]);
}

const schatten = (xa, xb, za, zb) => poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');
function hocker(x, h, z) { // darauf liegt der Kern
  schatten(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) seg([x + dx * 0.16, h - 0.05, z + dz * 0.16], [x + dx * 0.25, 0, z + dz * 0.25], '#1a1922', lwAt(z, 0.04));
  box(x - 0.23, x + 0.23, h - 0.07, h, z - 0.23, z + 0.23, '#ddd7ea', '#77728f', '#6d6884');
}
function stehtisch(x, h, z) {
  schatten(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
  fillZ(x - 0.045, x + 0.045, 0, h, z, '#101016'); fillZ(x - 0.3, x + 0.3, 0, 0.045, z, '#101016');
  box(x - 0.36, x + 0.36, h - 0.05, h, z - 0.36, z + 0.36, '#8a88a0', '#262532', '#2b2a38');
}
/* Gemeinsame Möbel und Geräte der Etagenräume */
function tisch(x0, x1, z0, z1, h, col) { // langer Tisch mit vier Beinen; col = Platte
  schatten(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.2);
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.14, z0 + 0.08], [x0 + 0.08, z1 - 0.14], [x1 - 0.14, z1 - 0.14]]) box(x, x + 0.06, 0, h, z, z + 0.06, '#111', '#101016', '#16151e');
  box(x0, x1, h - 0.05, h, z0, z1, col || M.top, M.front, M.side);
}
function laptop(x, y, z, w = 0.46) { // aufgeklappt, der Bildschirm zeigt in den Raum
  box(x - w / 2, x + w / 2, y, y + 0.02, z - 0.15, z + 0.15, '#3a3849', '#16151e', '#1b1a25');
  const q = [[x - w / 2, y + 0.02, z + 0.14], [x + w / 2, y + 0.02, z + 0.14], [x + w / 2, y + 0.3, z + 0.2], [x - w / 2, y + 0.3, z + 0.2]];
  poly(q, '#1a1736');
  const r = rectZ(x - w / 2 + 0.03, x + w / 2 - 0.03, y + 0.06, y + 0.27, z + 0.17);
  if (r) { ctx.fillStyle = `rgba(${LAVH},.55)`; ctx.fillRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.18, r[2] * 0.5, Math.max(1, r[3] * 0.1)); ctx.fillStyle = `rgba(${LAV},.85)`; ctx.fillRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.5, r[2] * 0.8, Math.max(1, r[3] * 0.28)); }
  glow(x, y + 0.2, z + 0.1, 0.8, [[0, `rgba(${LAV},.22)`], [1, `rgba(${LAV},0)`]]);
}
function flach(x0, x1, z0, z1, y, fill) { return poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill); } // Rechteck auf einer Tischplatte
function tafel(x0, x1, y0, y1, z, tx, rahmen, a = 1) { // Wandfläche mit vorgerenderter Textur (nur Formen, keine Schrift)
  const d = rectZ(x0, x1, y0, y1, z); if (!d || !tx) return null;
  const b = Math.max(1.5, d[2] * 0.01); ctx.fillStyle = rahmen || '#07070c'; ctx.fillRect(d[0] - b, d[1] - b, d[2] + 2 * b, d[3] + 2 * b);
  ctx.globalAlpha = a; ctx.drawImage(tx, d[0], d[1], d[2], d[3]); ctx.globalAlpha = 1; return d;
}
function platz(x, z, k, rgb, a = 1) {
  if (a < 0.02) return; ctx.globalAlpha = a; // kleiner Arbeitsplatz mit Bildschirm; leuchtet nur, wenn die Rolle im Paket ist
  schatten(x - 0.6, x + 0.6, z + 0.3, z + 1.25);
  for (const dx of [-0.46, 0.4]) box(x + dx, x + dx + 0.06, 0, 0.74, z + 0.5, z + 1.05, '#111', '#101016', '#16151e');
  box(x - 0.5, x + 0.5, 0.74, 0.79, z + 0.4, z + 1.15, M.top, M.front, M.side);
  fillZ(x - 0.04, x + 0.04, 0.79, 0.98, z + 1.0, '#0a0a10');
  const m = fillZ(x - 0.4, x + 0.4, 0.95, 1.48, z + 1.0, '#06060b');
  if (m) {
    ctx.fillStyle = sgr(0, m[1], 0, m[1] + m[3], [[0, `rgba(${rgb},${0.1 + 0.3 * k})`], [1, `rgba(${rgb},${0.04 + 0.12 * k})`]]); ctx.fillRect(m[0] + m[2] * 0.04, m[1] + m[3] * 0.06, m[2] * 0.92, m[3] * 0.88);
    ctx.fillStyle = pale(0.12 + 0.5 * k); for (const [u, v, w] of [[0.1, 0.18, 0.5], [0.1, 0.36, 0.34]]) ctx.fillRect(m[0] + m[2] * u, m[1] + m[3] * v, m[2] * w, Math.max(1, m[3] * 0.06));
    ctx.fillStyle = `rgba(${rgb},${0.25 + 0.7 * k})`; ctx.fillRect(m[0] + m[2] * 0.1, m[1] + m[3] * 0.62, m[2] * 0.8, Math.max(1, m[3] * 0.16));
  }
  if (k > 0.02) glow(x, 1.25, z + 0.95, 1.2, [[0, `rgba(${rgb},${0.2 * k * a})`], [1, `rgba(${rgb},0)`]]);
  ctx.globalAlpha = 1;
}
/* Die Menschen eines Markenraums. Wer zum gewählten Paket gehört, steht im Licht der Marke; die anderen treten zurück. */
function figuren(key) {
  const MK = MARKE[key], BR = MK.rgb, list = [], drin = INS.F && INS.F.key === key ? INS.k : 0;
  const weg = key === 'podcast' ? 1 - MARKE.podcast.zone.v : 1; // bei „Deine Bühne“ stehen nur Stuhl und Technik im Bild, die Gäste am Tisch treten zurück
  FIG[key].forEach((L, l) => { const a = lerp(1, MK.linieK[l].v, drin) * weg; if (a > 0.02) L.forEach(([x, z, o], r) => list.push([x, z, o, MK.rolle[l][r].v, a])); });
  if (KERN && KERN.im === key) list.push([0, KERN.z, null, 0, 1]); // der Kern steht im Raum und wird nach seiner Tiefe einsortiert
  list.sort((a, b) => b[1] - a[1]);
  for (const [x, z, o, k, a] of list) {
    if (!o) { const b = oy; drawCore(KERN); KERN.fertig = true; oy = b; continue; }
    if (k > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      poly([[x - 0.8, 0.006, z - 0.65], [x + 0.8, 0.006, z - 0.65], [x + 0.62, 0.006, z + 0.6], [x - 0.62, 0.006, z + 0.6]], `rgba(${BR},${0.075 * k * a})`);
      ctx.globalCompositeOperation = 'source-over';
      glow(x, 1.3, z, 1.3, [[0, `rgba(${BR},${0.15 * k * a})`], [1, `rgba(${BR},0)`]]);
      ctx.globalAlpha = k * a;
      sil(x, z, { ...o, col: '#0b0b11', rim: 0.8, rimCol: BR, kante: 0.75, kanteCol: BR });
      if (o.seat) { // Stuhl von hinten: schmale Lehne auf zwei dünnen Hinterbeinen, dazu ein Stück Sitz zu beiden Seiten
        box(x - 0.15, x + 0.15, 0.5, 0.86, z - 0.3, z - 0.27, '#4a4860', '#262433', '#1c1b25');
        box(x - 0.13, x - 0.1, 0, 0.5, z - 0.3, z - 0.27, '#111', '#17161f', '#17161f'); box(x + 0.1, x + 0.13, 0, 0.5, z - 0.3, z - 0.27, '#111', '#17161f', '#17161f');
      }
    }
    if (k < 0.98) { ctx.globalAlpha = (1 - k) * a; sil(x, z, { ...o, umriss: BR }); } // nicht im Paket: gestrichelter Umriss am Platz
    ctx.globalAlpha = 1;
  }
}
let KERN = null;

/* Ein Etagenraum, von außen durch die Glasfront gesehen; in den Markenräumen auch von innen */
function room(F, t) {
  oy = F.base;
  const key = F.key, y1 = F.y1, z1 = F.z1 || 9, x0 = -6, x1 = 6, MX = 3.6, solid = !!F.solid;
  const farF = P(0, 0, z1)[1], farC = P(0, y1, z1)[1], nearF = P(0, 0, 0)[1], nearC = P(0, y1, 0)[1];
  const o0 = P(-6.02, y1 + 0.03, 0), o1 = P(6.02, -0.03, 0);
  const innen = cam.z > -0.4;
  ctx.save(); if (!innen) { ctx.beginPath(); ctx.rect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); ctx.clip(); } // von außen: nur, was durch die Glasfront zu sehen ist
  if (!innen && o1[1] - o0[1] < 34) { // aus der Ferne ist der Raum ein erleuchtetes Fenster
    ctx.fillStyle = sgr(o0[0], 0, o1[0], 0, [[0, `rgba(${WARM},.8)`], [0.6, `rgba(${LAVH},.65)`], [1, `rgba(${LAV},.5)`]]); ctx.fillRect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]);
    ctx.restore(); oy = 0; return;
  }
  if (!solid) { fillZ(x0, -MX, 0, y1, z1, 'rgba(18,14,40,.22)'); fillZ(MX, x1, 0, y1, z1, 'rgba(18,14,40,.22)'); }
  poly([[x0, 0, 0], [x0, 0, z1], [x0, y1, z1], [x0, y1, 0]], 'rgba(18,14,40,.18)');
  // Decke mit zwei Lichtfugen
  poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, z1], [x0, y1, z1]], sgr(0, farC, 0, nearC, [[0, '#282734'], [0.4, '#15151d'], [1, '#09090d']]));
  for (const cx of [-3, 3]) {
    ctx.globalCompositeOperation = 'lighter';
    poly([[cx - 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, z1 - 0.3], [cx - 0.55, y1 - 0.005, z1 - 0.3]], `rgba(${WARM},.06)`);
    ctx.globalCompositeOperation = 'source-over';
    poly([[cx - 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, z1 - 0.3], [cx - 0.05, y1 - 0.01, z1 - 0.3]], F.dark ? '#8f8aa3' : '#fff2e2');
  }
  // Boden
  poly([[x0, 0, 0], [x1, 0, 0], [x1, 0, z1], [x0, 0, z1]], sgr(0, farF, 0, nearF, F.dark ? [[0, '#2f2e3b'], [0.4, '#1b1a24'], [1, '#0d0d12']] : key === 'strasse' ? [[0, '#46464b'], [0.4, '#28282c'], [1, '#121214']] : [[0, '#4d4b5d'], [0.3, '#2d2c3a'], [1, '#14141b']]));
  if (key !== 'strasse') for (let x = x0 + 0.6; x < x1; x += 0.6) seg([x, 0, 0], [x, 0, z1], 'rgba(0,0,0,.2)', 1);
  if (!solid) { // der violette Horizont spiegelt sich vor den Fenstern im Boden
    poly([[x0, 0, z1], [-MX, 0, z1], [-MX, 0, 4], [x0, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, 'rgba(150,120,245,.36)'], [1, 'rgba(150,120,245,0)']]));
    poly([[MX, 0, z1], [x1, 0, z1], [x1, 0, 4], [MX, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, 'rgba(150,120,245,.36)'], [1, 'rgba(150,120,245,0)']]));
  }
  // rechte Wand
  const wxF = P(x1, 0, z1)[0], wxN = P(x1, 0, 0)[0];
  poly([[x1, 0, 0], [x1, 0, z1], [x1, y1, z1], [x1, y1, 0]], sgr(wxF, 0, wxN, 0, F.dark ? [[0, '#1f1e29'], [1, '#0b0b10']] : key === 'strasse' ? [[0, '#3a3a3f'], [0.3, '#252528'], [1, '#0e0e10']] : [[0, '#383644'], [0.3, '#24232e'], [1, '#0e0e13']]));
  for (let z = 0.5; z < z1; z += 0.5) seg([x1, 0, z], [x1, y1, z], 'rgba(0,0,0,.22)', 1);
  // Rückwand
  const bx0 = solid ? x0 : -MX, bx1 = solid ? x1 : MX, mw = rectZ(bx0, bx1, 0, y1, z1 - 0.02);
  if (mw) {
    ctx.fillStyle = sgr(0, mw[1], 0, mw[1] + mw[3], F.dark ? [[0, '#0d0d14'], [1, '#17161f']] : key === 'strasse' ? [[0, '#1e1e22'], [0.7, '#242428'], [1, '#2c2c31']] : [[0, '#1c1b27'], [0.7, '#23212f'], [1, '#2a2838']]); ctx.fillRect(mw[0], mw[1], mw[2], mw[3]);
    if (!solid) { const e = Math.max(1, (0.035 * S.f) / (z1 - cam.z)); ctx.fillStyle = `rgba(${WARM},.8)`; ctx.fillRect(mw[0], mw[1], e, mw[3]); ctx.fillRect(mw[0] + mw[2] - e, mw[1], e, mw[3]); }
  }
  if (!solid) {
    for (const x of [x0, -4.8, 4.74, x1 - 0.06]) fillZ(x, x + 0.06, 0, y1, z1 - 0.03, '#07070c');
    fillZ(x0, -MX, y1 - 0.1, y1, z1 - 0.03, '#07070c'); fillZ(MX, x1, y1 - 0.1, y1, z1 - 0.03, '#07070c');
  }
  for (let z = 0; z <= z1; z += 2) poly([[x0, 0, z], [x0, 0, z + 0.07], [x0, y1, z + 0.07], [x0, y1, z]], '#07070c');
  poly([[x0, y1 - 0.1, 0], [x0, y1 - 0.1, z1], [x0, y1, z1], [x0, y1, 0]], '#07070c');
  const wall = (tex) => { const d = rectZ(-3.2, 3.2, 0.72, 3.11, z1 - 0.06); if (d && tex) ctx.drawImage(tex, d[0], d[1], d[2], d[3]); };
  const shade = (xa, xb, za, zb) => poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');

  if (key === 'strasse') { // Eingangshalle: Empfang, Sitzgruppe, der Kern klein und matt auf einem Sockel
    const N = { top: '#5c5c62', front: '#222226', side: '#2b2b30' };
    const w = rectZ(x0, x1, 0, y1, z1 - 0.03);
    if (w) { ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 1; i < 30; i++) ctx.fillRect(w[0] + (w[2] * i) / 30, w[1], Math.max(1, w[2] * 0.004), w[3]); }
    fillZ(x0, x1, 3.3, 3.36, z1 - 0.04, `rgba(${WARM},.75)`); glow(0, 3.33, z1 - 0.04, 5.5, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
    // schwache Spiegelung im Boden: das Wandlicht und die Pendel
    ctx.globalCompositeOperation = 'lighter';
    poly([[x0, 0.004, z1], [x1, 0.004, z1], [x1, 0.004, z1 - 4.4], [x0, 0.004, z1 - 4.4]], lg([0, 0, z1], [0, 0, z1 - 4.4], [[0, `rgba(${WARM},.11)`], [1, `rgba(${WARM},0)`]]));
    ctx.globalCompositeOperation = 'source-over';
    const lamps = [[-1.7, 6.9, 0.3], [3.2, 8.1, 0.3], [PED.x, PED.z, 0.5]];
    for (const [x, z, on] of lamps) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 0.9, 0.005, z - 0.8], [x + 0.9, 0.005, z - 0.8], [x + 0.7, 0.005, z + 0.8], [x - 0.7, 0.005, z + 0.8]], `rgba(${WARM},${on * 0.11})`); ctx.globalCompositeOperation = 'source-over'; }
    // Empfang hinten rechts, dahinter eine Person
    // der Tresen: dahinter Kevin und Malin (nur als Umriss), an der Wand ein leerer Rahmen, hier kommt das Foto hin
    const ra = rectZ(1.75, 4.65, 1.15, 3.05, z1 - 0.05);
    if (ra) {
      ctx.fillStyle = 'rgba(246,244,240,.07)'; ctx.fillRect(ra[0], ra[1], ra[2], ra[3]);
      ctx.strokeStyle = `rgba(${WARM},.7)`; ctx.lineWidth = Math.max(1.5, ra[2] * 0.008); ctx.setLineDash([ra[2] * 0.03, ra[2] * 0.02]); ctx.strokeRect(ra[0] + ra[2] * 0.03, ra[1] + ra[3] * 0.04, ra[2] * 0.94, ra[3] * 0.92); ctx.setLineDash([]);
      ctx.strokeStyle = '#07070c'; ctx.lineWidth = Math.max(2, ra[2] * 0.018); ctx.strokeRect(ra[0], ra[1], ra[2], ra[3]);
    }
    glow(3.2, 3.2, z1 - 0.1, 3.4, [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]]);
    sil(2.65, 9.1, { rim: 0.32, rimCol: WARM }); sil(3.85, 9.1, { rim: 0.32, rimCol: WARM, flip: true });
    shade(1.6, 4.8, 7.5, 8.7);
    box(1.7, 4.7, 0, 1.12, 7.7, 8.6, '#66666c', lg([0, 1.12, 7.7], [0, 0, 7.7], [[0, '#303035'], [1, '#18181b']]), N.side);
    fillZ(1.7, 4.7, 0.99, 1.05, 7.69, `rgba(${WARM},.75)`); fillZ(1.7, 4.7, 0.02, 0.07, 7.69, `rgba(${WARM},.3)`);
    // Sitzgruppe: zwei Sessel und ein niedriger Tisch
    for (const x of [-2.6, -0.9]) {
      shade(x - 0.52, x + 0.52, 6.4, 7.45);
      box(x - 0.42, x + 0.42, 0.44, 0.9, 7.18, 7.32, N.top, '#2e2e33', N.side);
      box(x - 0.42, x + 0.42, 0.12, 0.44, 6.5, 7.3, N.top, N.front, N.side);
      box(x - 0.44, x - 0.32, 0.12, 0.62, 6.5, 7.2, '#6a6a70', '#28282d', N.side); box(x + 0.32, x + 0.44, 0.12, 0.62, 6.5, 7.2, '#6a6a70', '#28282d', N.side);
    }
    box(-2.0, -1.5, 0, 0.4, 6.55, 7.05, '#77777d', '#1c1c20', '#232327');
    for (const [x, z, on] of lamps) { fillZ(x - 0.015, x + 0.015, 4.75, y1, z, '#0a0a10'); fillZ(x - 0.26, x + 0.26, 4.45, 4.75, z, '#fff2e2'); glow(x, 4.5, z, 1.9, [[0, `rgba(${WARM},${on})`], [1, `rgba(${WARM},0)`]]); }
    // der Sockel im Licht, davor eine schwache Spiegelung des Kerns
    ctx.globalCompositeOperation = 'lighter';
    poly([[PED.x - 0.2, 4.45, PED.z], [PED.x + 0.2, 4.45, PED.z], [PED.x + 1.0, 0, PED.z], [PED.x - 1.0, 0, PED.z]], lg([0, 4.45, PED.z], [0, 0, PED.z], [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},.02)`]]));
    poly([[PED.x - 0.3, 0.006, PED.z - 0.34], [PED.x + 0.3, 0.006, PED.z - 0.34], [PED.x + 0.36, 0.006, PED.z - 1.9], [PED.x - 0.36, 0.006, PED.z - 1.9]], lg([0, 0, PED.z - 0.34], [0, 0, PED.z - 1.9], [[0, `rgba(${LAV},.16)`], [1, `rgba(${LAV},0)`]]));
    ctx.globalCompositeOperation = 'source-over';
    shade(PED.x - 0.5, PED.x + 0.5, PED.z - 0.5, PED.z + 0.5);
    box(PED.x - 0.32, PED.x + 0.32, 0, PED.h, PED.z - 0.32, PED.z + 0.32, '#77777d', lg([0, PED.h, 0], [0, 0, 0], [[0, '#3c3c41'], [1, '#1d1d20']]), N.side);
  } else if (key === 'studios') { // drei Ecken an der Rückwand: rechts Social Media, in der Mitte Website, links das Videostudio
    const MK = MARKE.studios, BR = MK ? MK.rgb : '255,90,31', dark = '#07070c', zw = z1 - 0.06, rk = (l, r) => (MK ? MK.rolle[l][r].v : 1), an = (l) => (MK ? 0.25 + 0.75 * Math.max(...MK.rolle[l].map((s) => s.v)) : 1);
    // Hochkant-Bildschirm auf einem Fuß: ein Kurzvideo mit Abspiel-Dreieck, darunter drei Clips (Social Media)
    {
      const hx = 1.65, hz = 8.3;
      seg([hx, 0, hz], [hx, 0.8, hz], dark, lwAt(hz, 0.05)); fillZ(hx - 0.4, hx + 0.4, 0, 0.05, hz, dark);
      const ph = rectZ(hx - 0.42, hx + 0.42, 0.78, 2.55, hz);
      if (ph) {
        const [rx, ry, rw, rh] = ph;
        ctx.fillStyle = '#050509'; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, rw * 0.07); ctx.fill();
        ctx.fillStyle = sgr(0, ry, 0, ry + rh, [[0, '#2a1a14'], [1, '#17111c']]); ctx.fillRect(rx + rw * 0.05, ry + rh * 0.03, rw * 0.9, rh * 0.94);
        ctx.fillStyle = 'rgba(255,90,31,.5)'; ctx.fillRect(rx + rw * 0.05, ry + rh * 0.03, rw * 0.9, rh * 0.5);
        const cx = rx + rw / 2, cy = ry + rh * 0.28, r = rw * 0.2;
        ctx.fillStyle = 'rgba(246,244,240,.92)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
        ctx.fillStyle = AKZ.studios; ctx.beginPath(); ctx.moveTo(cx - r * 0.32, cy - r * 0.48); ctx.lineTo(cx + r * 0.55, cy); ctx.lineTo(cx - r * 0.32, cy + r * 0.48); ctx.closePath(); ctx.fill();
        ctx.fillStyle = pale(0.28); ctx.fillRect(rx + rw * 0.12, ry + rh * 0.47, rw * 0.76, Math.max(1, rh * 0.012)); ctx.fillStyle = '#fff'; ctx.fillRect(rx + rw * 0.12, ry + rh * 0.47, rw * 0.34, Math.max(1, rh * 0.012));
        for (let j = 0; j < 3; j++) { const y = ry + rh * (0.55 + j * 0.14); ctx.fillStyle = pale(0.14); ctx.fillRect(rx + rw * 0.1, y, rw * 0.3, rh * 0.11); ctx.fillStyle = pale(0.34); ctx.fillRect(rx + rw * 0.46, y + rh * 0.015, rw * 0.4, Math.max(1, rh * 0.016)); ctx.fillStyle = pale(0.16); ctx.fillRect(rx + rw * 0.46, y + rh * 0.055, rw * 0.28, Math.max(1, rh * 0.014)); }
      }
      glow(hx, 1.7, hz - 0.05, 2.0, [[0, `rgba(${BR},${0.2 * an(0)})`], [1, `rgba(${BR},0)`]]);
    }
    // Website: großer Bildschirm mit einer Website als Drahtmodell, darunter der Tisch
    const wx = -1.45;
    shade(wx - 1.4, wx + 1.4, 7.6, 8.65);
    for (const x of [wx - 1.25, wx + 1.15]) box(x, x + 0.1, 0, 0.74, 7.85, 8.45, '#111', '#101016', '#16151e');
    box(wx - 1.3, wx + 1.3, 0.74, 0.8, 7.75, 8.55, M.top, M.front, M.side);
    fillZ(wx - 0.1, wx + 0.1, 0.8, 1.0, 8.5, '#0a0a10');
    const m = fillZ(wx - 1.05, wx + 1.05, 0.98, 2.4, 8.5, '#05050a'); if (m && TEX.web) ctx.drawImage(TEX.web, m[0] + m[2] * 0.02, m[1] + m[3] * 0.035, m[2] * 0.96, m[3] * 0.93);
    glow(wx, 1.7, 8.45, 2.8, [[0, `rgba(${LAV},${0.15 * an(1)})`], [1, `rgba(${LAV},0)`]]);
    laptop(wx + 0.55, 0.8, 7.85, 0.42);
    // Videostudio: Hohlkehle (Gestell, Papier von der Rolle, läuft in den Boden aus), Softbox, Hocker
    const bz = z1 - 0.45, bx0 = -5.6, bx1 = -3.3;
    for (const x of [bx0 - 0.16, bx1 + 0.16]) { seg([x, 0, bz + 0.12], [x, 3.22, bz + 0.12], dark, lwAt(bz, 0.05)); seg([x - 0.35, 0, bz + 0.12], [x + 0.35, 0, bz + 0.12], dark, lwAt(bz, 0.05)); }
    const paper = (pts, a, b, c0, c1) => poly(pts, lg(a, b, [[0, c0], [1, c1]]));
    paper([[bx0, 0.55, bz], [bx1, 0.55, bz], [bx1, 3.05, bz], [bx0, 3.05, bz]], [0, 0.55, bz], [0, 3.05, bz], '#7f7a95', '#514d66');
    paper([[bx0, 0.55, bz], [bx1, 0.55, bz], [bx1, 0.2, bz - 0.24], [bx0, 0.2, bz - 0.24]], [0, 0.55, bz], [0, 0.2, bz - 0.24], '#7f7a95', '#8b86a2');
    paper([[bx0, 0.2, bz - 0.24], [bx1, 0.2, bz - 0.24], [bx1, 0.006, bz - 0.75], [bx0, 0.006, bz - 0.75]], [0, 0.2, bz - 0.24], [0, 0, bz - 0.75], '#8b86a2', '#928da9');
    paper([[bx0, 0.006, bz - 0.75], [bx1, 0.006, bz - 0.75], [bx1 + 0.1, 0.006, 5.7], [bx0 - 0.1, 0.006, 5.7]], [0, 0, bz - 0.75], [0, 0, 5.7], '#928da9', '#6c6883');
    fillZ(bx0 - 0.24, bx1 + 0.24, 3.02, 3.17, bz + 0.06, '#2f2d3c');
    const sx = -5.5, sz = 7.6, A = [sx - 0.42, 7.23], B = [sx + 0.5, 7.97], K = [sx - 0.36, 2.05, 8.16], sy0 = 1.4, sy1 = 2.7;
    seg([sx, 0, sz + 0.3], [sx, 1.6, sz + 0.3], dark, lwAt(sz, 0.05)); for (const [dx, dz] of [[-0.42, 0.25], [0.42, 0.2], [0, -0.5]]) seg([sx, 0.45, sz + 0.3], [sx + dx, 0, sz + 0.3 + dz], dark, lwAt(sz, 0.035));
    const f0 = [A[0], sy0, A[1]], f1 = [B[0], sy0, B[1]], f2 = [B[0], sy1, B[1]], f3 = [A[0], sy1, A[1]];
    for (const [u, v] of [[f0, f1], [f1, f2], [f2, f3], [f3, f0]]) poly([u, v, K], '#0e0e14');
    glow(STOOL.x, 1.35, STOOL.z + 0.4, 3.1, [[0, `rgba(${WARM},${0.36 * an(2)})`], [0.5, `rgba(${WARM},${0.1 * an(2)})`], [1, `rgba(${WARM},0)`]]);
    const fc = P(sx, 2.05, sz), fr = (0.86 * S.f) / Math.max(NEAR, sz - cam.z), fg = ctx.createRadialGradient(fc[0], fc[1], 0, fc[0], fc[1], fr);
    fg.addColorStop(0, '#fff8ec'); fg.addColorStop(0.45, '#e9dfd6'); fg.addColorStop(0.8, '#b3a9c0'); fg.addColorStop(1, '#8f869f');
    if (poly([f0, f1, f2, f3], fg)) { ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(sz, 0.06); ctx.stroke(); }
    glow(sx + 0.3, 2.05, sz - 0.3, 1.6, [[0, `rgba(${WARM},.28)`], [1, `rgba(${WARM},0)`]]);
    // Arbeitsplätze für Schnitt, die Plätze des Kerns, dann die Menschen
    hocker(STOOL.x, STOOL.h, STOOL.z);
    schatten(-0.9, -0.13, 5.8, 6.6); box(-0.8, -0.23, 0, 0.9, 5.9, 6.5, '#8a88a0', lg([0, 0.9, 0], [0, 0, 0], [[0, '#3c3a4c'], [1, '#1d1c26']]), '#262532');
    if (MK) figuren('studios');
    // vorn: die Kameras, von hinten gesehen
    ctx.globalAlpha = 1; tripod(-5.33, 5.3, 1.45); ctx.globalAlpha = 1;
    softbox(2.75, 7.0, 1.2); tripod(2.15, 7.3, 1.2); // Kamera auf Stativ und Licht vor dem Hochkant-Bildschirm
  } else if (key === 'pr') { // fünf Ecken, je Baustein eine: Mappe und Themenplan · Kartenwand und Magazine · Rednerpult · Kalender · Telefon und Notfallordner
    const MK = MARKE.pr, zw = z1 - 0.06, an = (l) => (MK ? 0.3 + 0.7 * MK.linieK[l].v : 1), VI = '#5F4BB6', dunkel = '#0a0a10';
    const matt = (r, l) => { if (r && an(l) < 0.98) { ctx.fillStyle = `rgba(8,8,14,${0.62 * (1 - an(l))})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } };
    // Redaktion: der Themenplan an der Wand (vier Spalten), davor ein Tisch mit aufgeschlagenem Magazin und Zeitung
    tafel(-3.5, -1.65, 1.0, 2.85, zw, TEX.themen, '#3a3849', 0.55 + 0.45 * an(1));
    glow(-2.6, 1.9, z1 - 0.05, 3.2, [[0, `rgba(${LAV},${0.14 * an(1)})`], [1, `rgba(${LAV},0)`]]);
    tisch(-3.5, -1.65, 7.0, 7.95, 0.86);
    { // das Magazin (aufgeschlagen, aufgestellt) und die Zeitung: groß genug, dass man beides auf den ersten Blick erkennt
      const mx = (x) => -3.4 + (x + 3.15) * 1.45, my = (y) => 0.87 + (y - 0.87) * 1.5;
      poly([[mx(-3.15), 0.87, 7.45], [mx(-2.7), 0.87, 7.58], [mx(-2.7), my(1.42), 7.7], [mx(-3.15), my(1.42), 7.57]], '#f4f0fb'); poly([[mx(-2.7), 0.87, 7.58], [mx(-2.25), 0.87, 7.45], [mx(-2.25), my(1.42), 7.57], [mx(-2.7), my(1.42), 7.7]], '#d6cfe9');
      seg([mx(-2.7), 0.87, 7.58], [mx(-2.7), my(1.42), 7.7], 'rgba(38,30,80,.85)', lwAt(7.6, 0.025)); // Rücken
      for (const [a, b, c, d] of [[[mx(-3.15), 0.87, 7.45], [mx(-2.7), 0.87, 7.58]], [[mx(-2.7), 0.87, 7.58], [mx(-2.25), 0.87, 7.45]], [[mx(-3.15), my(1.42), 7.57], [mx(-2.7), my(1.42), 7.7]], [[mx(-2.7), my(1.42), 7.7], [mx(-2.25), my(1.42), 7.57]]]) seg(a, b, 'rgba(38,30,80,.7)', lwAt(7.6, 0.014));
      fillZ(mx(-3.08), mx(-2.78), my(1.12), my(1.36), 7.6, '#5F4BB6'); fillZ(mx(-3.08), mx(-2.84), my(1.0), my(1.05), 7.6, 'rgba(38,36,51,.55)'); fillZ(mx(-3.08), mx(-2.9), my(0.92), my(0.96), 7.6, 'rgba(38,36,51,.4)');
      fillZ(mx(-2.6), mx(-2.34), my(1.28), my(1.33), 7.6, 'rgba(38,36,51,.6)'); fillZ(mx(-2.6), mx(-2.4), my(1.16), my(1.2), 7.6, 'rgba(38,36,51,.4)'); fillZ(mx(-2.6), mx(-2.36), my(1.06), my(1.1), 7.6, 'rgba(38,36,51,.4)'); fillZ(mx(-2.6), mx(-2.45), my(0.96), my(1.0), 7.6, 'rgba(38,36,51,.4)');
      flach(-2.08, -1.7, 7.05, 7.95, 0.878, '#f6f3ea'); flach(-2.04, -1.74, 7.12, 7.34, 0.88, 'rgba(20,20,30,.85)'); // die Zeitung daneben: breit, mit Kopfzeile und Spalten
      for (const z of [7.42, 7.55, 7.68, 7.81]) flach(-2.04, -1.74, z, z + 0.07, 0.88, 'rgba(20,20,30,.4)');
    }
    // Fundament: der Themenplan auf einer Staffelei (vier Spalten: die Quartale), davor ein Tisch mit der Pressemappe
    const tx = -5.2, tz = 8.3, lwE = lwAt(tz, 0.04);
    seg([tx - 0.45, 2.45, tz], [tx - 0.62, 0, tz - 0.1], dunkel, lwE); seg([tx + 0.45, 2.45, tz], [tx + 0.62, 0, tz - 0.1], dunkel, lwE); seg([tx, 2.45, tz + 0.04], [tx, 0, tz + 0.6], dunkel, lwE);
    const tp = fillZ(tx - 0.62, tx + 0.62, 1.0, 2.52, tz, '#cfcbd9');
    if (tp) {
      const [rx, ry, rw, rh] = tp; ctx.fillStyle = 'rgba(38,36,51,.75)'; ctx.fillRect(rx + rw * 0.08, ry + rh * 0.07, rw * 0.5, Math.max(1, rh * 0.035));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i * 3 + j) % 5 === 1 ? VI : 'rgba(38,36,51,.22)'; ctx.fillRect(rx + rw * (0.08 + i * 0.215), ry + rh * (0.17 + j * 0.19), rw * 0.18, rh * 0.14); }
      matt(tp, 0);
    }
    fillZ(tx - 0.64, tx + 0.64, 2.5, 2.59, tz - 0.01, '#2b2a38');
    shade(-5.25, -3.9, 7.3, 8.1); box(-5.15, -4.0, 0, 0.86, 7.4, 8.0, M.top, M.front, M.side);
    fillZ(-4.8, -4.44, 0.87, 1.36, 7.65, '#3b2a78'); fillZ(-4.8, -4.44, 1.06, 1.13, 7.64, `rgba(${LAVH},.85)`); // die Pressemappe, aufgestellt
    poly([[-4.32, 0.868, 7.5], [-4.08, 0.868, 7.5], [-4.08, 0.868, 7.86], [-4.32, 0.868, 7.86]], 'rgba(246,244,240,.72)');
    // Bühnen und Auftritte: ein kleines Podest mit Rednerpult und Mikrofon im warmen Licht
    box(-0.5, 1.3, 0, 0.16, 7.25, 8.7, '#34323f', '#191822', '#201f2c'); fillZ(-0.5, 1.3, 0.1, 0.14, 7.24, `rgba(${LAVH},${0.15 + 0.6 * (an(2) - 0.3)})`);
    ctx.globalCompositeOperation = 'lighter'; poly([[-0.4, 0.165, 7.3], [1.2, 0.165, 7.3], [1.2, 0.165, 8.6], [-0.4, 0.165, 8.6]], `rgba(${WARM},${0.09 * an(2)})`); ctx.globalCompositeOperation = 'source-over';
    oy += 0.16;
    box(0.1, 0.74, 0, 1.12, 7.65, 8.05, '#8f8da6', lg([0, 1.12, 7.65], [0, 0, 7.65], [[0, '#55536a'], [1, '#262532']]), '#34323f');
    seg([0.42, 1.12, 7.75], [0.42, 1.38, 7.75], dunkel, lwAt(7.75, 0.03)); fillZ(0.36, 0.48, 1.36, 1.54, 7.75, '#2b2a38'); fillZ(0.36, 0.48, 1.46, 1.54, 7.74, `rgba(${LAVH},.8)`);
    oy -= 0.16;
    glow(0.4, 1.9, 7.8, 2.4, [[0, `rgba(${WARM},${0.24 * an(2)})`], [1, `rgba(${WARM},0)`]]);
    ctx.globalCompositeOperation = 'lighter'; // der Lichtkegel über dem Pult
    poly([[0.2, y1 - 0.02, 7.7], [0.6, y1 - 0.02, 7.7], [1.25, 0.17, 8.0], [-0.45, 0.17, 8.0]], lg([0, y1, 7.8], [0, 0, 7.8], [[0, `rgba(${WARM},.0)`], [0.3, `rgba(${WARM},${0.12 * an(2)})`], [1, `rgba(${WARM},${0.2 * an(2)})`]]));
    ctx.globalCompositeOperation = 'source-over';
    // Anlässe und Markteintritt: der Wandkalender, ein Tag ist markiert
    const kal = MK && MK.zone.v < 1.6 ? null : rectZ(2.4, 3.9, 1.05, 2.8, zw);
    if (kal) {
      const [rx, ry, rw, rh] = kal; ctx.fillStyle = '#d8d4e3'; ctx.fillRect(rx, ry, rw, rh); ctx.fillStyle = '#3b2a78'; ctx.fillRect(rx, ry, rw, rh * 0.13);
      ctx.fillStyle = 'rgba(246,244,240,.85)'; ctx.fillRect(rx + rw * 0.07, ry + rh * 0.045, rw * 0.3, Math.max(1, rh * 0.04));
      for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
        const on = i === 3 && j === 2, x = rx + rw * (0.06 + i * 0.128), y = ry + rh * (0.19 + j * 0.155), w = rw * 0.105, hh = rh * 0.12;
        ctx.fillStyle = on ? VI : i > 4 ? 'rgba(38,36,51,.1)' : 'rgba(38,36,51,.2)'; ctx.fillRect(x, y, w, hh);
        if (on) { ctx.strokeStyle = VI; ctx.lineWidth = Math.max(1, rw * 0.014); ctx.strokeRect(x - w * 0.2, y - hh * 0.2, w * 1.4, hh * 1.4); }
      }
      matt(kal, 3);
    }
    glow(3.15, 1.9, z1 - 0.1, 2.4, [[0, `rgba(${LAV},${0.14 * an(3)})`], [1, `rgba(${LAV},0)`]]);
    // Community und Kundenbindung: der Aushang einer Laufgruppe, davor ein Sideboard mit einer Stempelkarte
    const au = rectZ(4.15, 5.65, 1.0, 2.75, zw);
    if (au) {
      const [rx, ry, rw, rh] = au; ctx.fillStyle = '#e4e0ef'; ctx.fillRect(rx, ry, rw, rh); ctx.fillStyle = VI; ctx.fillRect(rx, ry, rw, rh * 0.2);
      ctx.fillStyle = 'rgba(246,244,240,.9)'; ctx.fillRect(rx + rw * 0.08, ry + rh * 0.065, rw * 0.5, Math.max(1, rh * 0.05));
      const cx = rx + rw * 0.5, cy = ry + rh * 0.55, u = rh * 0.011; // ein Läufer: Kopf, Rumpf, Arme, Beine
      ctx.strokeStyle = '#2b2a38'; ctx.fillStyle = '#2b2a38'; ctx.lineWidth = Math.max(1.5, rw * 0.03); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx + 6 * u, cy - 17 * u, 5 * u, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 5 * u, cy - 11 * u); ctx.lineTo(cx, cy + 2 * u); ctx.moveTo(cx + 4 * u, cy - 8 * u); ctx.lineTo(cx + 15 * u, cy - 2 * u); ctx.moveTo(cx + 4 * u, cy - 8 * u); ctx.lineTo(cx - 9 * u, cy - 4 * u);
      ctx.moveTo(cx, cy + 2 * u); ctx.lineTo(cx + 11 * u, cy + 12 * u); ctx.lineTo(cx + 7 * u, cy + 24 * u); ctx.moveTo(cx, cy + 2 * u); ctx.lineTo(cx - 10 * u, cy + 10 * u); ctx.lineTo(cx - 17 * u, cy + 20 * u); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = 'rgba(38,36,51,.3)'; ctx.fillRect(rx + rw * 0.1, ry + rh * 0.88, rw * 0.62, Math.max(1, rh * 0.035));
    }
    glow(4.9, 1.9, z1 - 0.1, 2.2, [[0, `rgba(${LAV},.16)`], [1, `rgba(${LAV},0)`]]);
    tafel(0.65, 2.15, 0.95, 2.6, zw, TEX.stempel, '#3a3849'); // Kundenbindung: die große Stempelkarte (Kreise, einige gefüllt)
    glow(1.4, 1.8, z1 - 0.1, 2.4, [[0, `rgba(${LAV},.2)`], [1, `rgba(${LAV},0)`]]);
    if (MK) { MK.kern.forEach(([x, hh, z], l) => { const a = MK.linieK[l].v; if (a > 0.02) { ctx.globalAlpha = a; stehtisch(x, hh, z); ctx.globalAlpha = 1; } }); figuren('pr'); } // nur der Stehtisch des gewählten Bausteins steht da
  } else if (key === 'podcast') { // Aufnahmeraum von „Fokus Innovation“: Akustikplatten, Leuchtschrift, runder Tisch mit zwei Mikrofonen, hinten der Platz für Aufnahme und Schnitt
    const MK = MARKE.podcast, zw = z1 - 0.06;
    const d = rectZ(-4.4, 5.95, 0.55, 3.15, zw); if (d && TEX.akustik) ctx.drawImage(TEX.akustik, d[0], d[1], d[2], d[3]);
    // die Leuchtschrift an der Wand: eine Leuchtröhre als Kontur, mit Schein und kleinen Halterungen (einmal vorgerendert)
    if (!TEX.neon && document.fonts && document.fonts.check('600 40px "Schibsted Grotesk"')) {
      TEX.neon = tex(1300, 520, 9, (g) => {
        g.font = FONT(600, 150); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '22px'; g.lineJoin = 'round';
        const zeilen = [['FOKUS', 650, 150], ['INNOVATION', 650, 360]];
        g.strokeStyle = '#2a2838'; g.lineWidth = 3; // Halterungen: kleine Klemmen hinter der Röhre
        for (const [x, y] of [[170, 150], [650, 105], [1110, 150], [150, 360], [650, 315], [1140, 360]]) { g.beginPath(); g.moveTo(x, y - 44); g.lineTo(x, y - 8); g.stroke(); g.fillStyle = '#2f2d3c'; g.fillRect(x - 7, y - 10, 14, 14); }
        for (const [w, a, bl] of [[26, 0.1, 50], [14, 0.28, 26]]) { g.save(); g.shadowColor = 'rgba(167,139,250,1)'; g.shadowBlur = bl; g.strokeStyle = `rgba(167,139,250,${a})`; g.lineWidth = w; for (const [t, x, y] of zeilen) g.strokeText(t, x, y); g.restore(); }
        g.save(); g.shadowColor = 'rgba(205,192,255,1)'; g.shadowBlur = 14; g.strokeStyle = '#f6f1ff'; g.lineWidth = 5; for (const [t, x, y] of zeilen) g.strokeText(t, x, y); g.restore();
      });
    }
    glow(2.5, 2.45, z1 - 0.1, 3.0, [[0, `rgba(${LAV},.26)`], [1, `rgba(${LAV},0)`]]);
    if (TEX.neon) { const nr = rectZ(1.5, 3.5, 1.95, 3.0, z1 - 0.1); if (nr) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TEX.neon, nr[0], nr[1], nr[2], nr[3]); ctx.globalCompositeOperation = 'source-over'; } }
    // Aufnahme-Licht: es leuchtet, die Aufnahme läuft
    fillZ(3.72, 4.48, 2.6, 2.92, z1 - 0.08, '#08080d'); fillZ(3.8, 4.4, 2.67, 2.85, z1 - 0.09, `rgba(${LAVH},.95)`);
    glow(4.1, 2.76, z1 - 0.1, 1.7, [[0, `rgba(${LAV},.5)`], [1, `rgba(${LAV},0)`]]);
    poly([[TABLE.x - 3, 0.006, TABLE.z - 1.5], [TABLE.x + 3, 0.006, TABLE.z - 1.5], [TABLE.x + 2.7, 0.006, TABLE.z + 1.5], [TABLE.x - 2.7, 0.006, TABLE.z + 1.5]], 'rgba(58,54,88,.5)');
    glow(TABLE.x, 1.6, TABLE.z + 0.6, 3.2, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
    platz(-2.3, 7.4, 1, MK ? MK.rgb : LAV);
    // runder Tisch
    const tc = P(TABLE.x, TABLE.h, TABLE.z), trx = (0.82 * S.f) / (TABLE.z - cam.z), tryy = Math.max(2, Math.abs(P(TABLE.x, TABLE.h, TABLE.z - 0.82)[1] - P(TABLE.x, TABLE.h, TABLE.z + 0.82)[1]) / 2), th = (0.06 * S.f) / (TABLE.z - cam.z);
    fillZ(TABLE.x - 0.06, TABLE.x + 0.06, 0, TABLE.h, TABLE.z, '#101016'); fillZ(TABLE.x - 0.34, TABLE.x + 0.34, 0, 0.05, TABLE.z, '#101016');
    ctx.fillStyle = '#1c1b26'; ctx.beginPath(); ctx.ellipse(tc[0], tc[1] + th, trx, tryy, 0, 0, 7); ctx.fill(); ctx.fillRect(tc[0] - trx, tc[1], trx * 2, th);
    ctx.fillStyle = '#5f5d74'; ctx.beginPath(); ctx.ellipse(tc[0], tc[1], trx, tryy, 0, 0, 7); ctx.fill();
    // zwei Menschen im Profil, einander zugewandt, dazu Aufnahme und Schnitt; der Kern liegt zwischen den beiden
    if (MK) figuren('podcast');
    hocker(2.45, 0.62, 7.3); // dort liegt der Kern, wenn du auf die Bühne trittst
    softbox(-3.6, 5.9, 1.0); tripod(-3.0, 5.1, 1.15);
    { // Deine Bühne: ein Stuhl im Licht, die Kamera davor, zwei Leuchten, daneben ein Hochkant-Bildschirm mit drei Clips
      const cx = 3.45, cz = 7.7;
      ctx.globalCompositeOperation = 'lighter';
      poly([[cx - 0.2, y1 - 0.02, cz - 0.1], [cx + 0.2, y1 - 0.02, cz - 0.1], [cx + 1.15, 0.01, cz + 0.2], [cx - 1.15, 0.01, cz + 0.2]], lg([0, y1, cz], [0, 0, cz], [[0, `rgba(${WARM},0)`], [0.35, `rgba(${WARM},.1)`], [1, `rgba(${WARM},.22)`]]));
      poly([[cx - 1.0, 0.007, cz - 0.9], [cx + 1.0, 0.007, cz - 0.9], [cx + 0.85, 0.007, cz + 0.75], [cx - 0.85, 0.007, cz + 0.75]], `rgba(${LAV},.16)`);
      ctx.globalCompositeOperation = 'source-over';
      schatten(cx - 0.4, cx + 0.4, cz - 0.4, cz + 0.4);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + dx * 0.27 - 0.025, cx + dx * 0.27 + 0.025, 0, 0.44, cz + dz * 0.25 - 0.025, cz + dz * 0.25 + 0.025, '#111', '#101016', '#16151e');
      box(cx - 0.32, cx + 0.32, 0.44, 0.52, cz - 0.3, cz + 0.3, '#8b86c0', '#4a4680', '#3d396b'); // Sitz
      box(cx - 0.32, cx + 0.32, 0.52, 1.18, cz + 0.26, cz + 0.34, '#8b86c0', '#5b57a0', '#3d396b'); // Lehne
      box(cx - 0.38, cx - 0.32, 0.52, 0.78, cz - 0.3, cz + 0.3, '#8b86c0', '#4a4680', '#3d396b'); box(cx + 0.32, cx + 0.38, 0.52, 0.78, cz - 0.3, cz + 0.3, '#8b86c0', '#4a4680', '#3d396b'); // Armlehnen
      glow(cx, 1.0, cz, 1.5, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
      ctx.globalAlpha = clamp01(MARKE.podcast.zone.v * 1.6); softbox(1.8, 8.0, 1.2); ctx.globalAlpha = 1; softbox(5.0, 6.2, 1.1); tripod(4.3, 5.2, 1.2);
      const hx = 5.35, hz = 8.4; // der Hochkant-Bildschirm mit drei kurzen Clips untereinander
      seg([hx, 0, hz], [hx, 0.7, hz], '#07070c', lwAt(hz, 0.05)); fillZ(hx - 0.4, hx + 0.4, 0, 0.05, hz, '#07070c');
      const ph = rectZ(hx - 0.46, hx + 0.46, 0.68, 2.6, hz);
      if (ph) {
        const [rx, ry, rw, rh] = ph; ctx.fillStyle = '#050509'; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, rw * 0.06); ctx.fill();
        for (let j = 0; j < 3; j++) {
          const y = ry + rh * (0.04 + j * 0.318), hh = rh * 0.29; ctx.fillStyle = sgr(0, y, 0, y + hh, [[0, j === 1 ? '#5F4BB6' : '#2a2650'], [1, '#17142c']]); ctx.fillRect(rx + rw * 0.05, y, rw * 0.9, hh);
          ctx.fillStyle = 'rgba(246,244,240,.9)'; const px = rx + rw * 0.5, py = y + hh * 0.46, r = hh * 0.2; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.fillStyle = '#5F4BB6'; ctx.beginPath(); ctx.moveTo(px - r * 0.3, py - r * 0.5); ctx.lineTo(px + r * 0.55, py); ctx.lineTo(px - r * 0.3, py + r * 0.5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = pale(0.3); ctx.fillRect(rx + rw * 0.1, y + hh * 0.86, rw * 0.8, Math.max(1, hh * 0.03)); ctx.fillStyle = '#fff'; ctx.fillRect(rx + rw * 0.1, y + hh * 0.86, rw * (0.2 + 0.2 * j), Math.max(1, hh * 0.03));
        }
      }
      glow(hx, 1.7, hz - 0.05, 2.0, [[0, `rgba(${LAV},.2)`], [1, `rgba(${LAV},0)`]]);
    }
    // Mikrofone an Schwenkarmen
    for (const s of [-1, 1]) {
      const bx = TABLE.x + s * 0.5, lw = lwAt(TABLE.z, 0.035);
      seg([bx, TABLE.h, TABLE.z], [bx + s * 0.08, 1.62, TABLE.z], '#0a0a10', lw); seg([bx + s * 0.08, 1.62, TABLE.z], [bx + s * 0.3, 1.34, TABLE.z], '#0a0a10', lw);
      fillZ(bx + s * 0.3 - 0.055, bx + s * 0.3 + 0.055, 1.18, 1.4, TABLE.z, '#2b2a38'); fillZ(bx + s * 0.3 - 0.055, bx + s * 0.3 + 0.055, 1.31, 1.4, TABLE.z, `rgba(${LAVH},.75)`);
    }
  } else if (key === 'revenue') { // drei Ecken: links der Tagesworkshop am Flipchart, in der Mitte Kennzahlen, Training und Pipeline, rechts Strategie, Recruiting und Partner
    const MK = MARKE.revenue, BL = '125,183,255', TB = '23,70,158', zw = z1 - 0.07, rk = (r) => (MK ? MK.rolle[0][r].v : 1);
    // Rückwand in Tiefblau
    const bw = rectZ(-MX, MX, 0, y1, z1 - 0.025);
    if (bw) { ctx.fillStyle = sgr(0, bw[1], 0, bw[1] + bw[3], [[0, `rgba(${TB},.62)`], [1, `rgba(${TB},.24)`]]); ctx.fillRect(bw[0], bw[1], bw[2], bw[3]); }
    // Wandbildschirm mit Kennzahlen
    const d = rectZ(-3.45, -1.45, 1.2, 2.35, zw), kK = 0.35 + 0.65 * rk(1);
    if (d) { const b = Math.max(1.5, d[2] * 0.008); ctx.fillStyle = '#030306'; ctx.fillRect(d[0] - b, d[1] - b, d[2] + 2 * b, d[3] + 2 * b); if (TEX.kpi) { ctx.globalAlpha = kK; ctx.drawImage(TEX.kpi, d[0], d[1], d[2], d[3]); ctx.globalAlpha = 1; } }
    glow(-2.2, 1.75, z1 - 0.1, 4.2, [[0, `rgba(${BL},${0.14 * kK})`], [1, `rgba(${BL},0)`]]);
    poly([[-3.3, 0, z1 - 0.4], [-1.1, 0, z1 - 0.4], [-0.7, 0, z1 - 3.0], [-3.7, 0, z1 - 3.0]], lg([0, 0, z1 - 0.4], [0, 0, z1 - 3.0], [[0, `rgba(${BL},${0.18 * kK})`], [1, `rgba(${BL},0)`]]));
    // Pipeline an der Wand: Spalten mit Karten, die letzte Spalte in der Farbe der Marke
    const pb = rectZ(0.15, 1.65, 1.0, 2.6, zw), kP = 0.35 + 0.65 * rk(3);
    if (pb) {
      ctx.fillStyle = 'rgba(6,8,14,.78)'; ctx.fillRect(pb[0], pb[1], pb[2], pb[3]); ctx.globalAlpha = kP;
      [5, 4, 3, 2, 2].forEach((n, i) => { const last = i === 4, x = pb[0] + pb[2] * (0.04 + i * 0.192), w = pb[2] * 0.165; ctx.fillStyle = last ? AKZ.revenue : pale(0.4); ctx.fillRect(x, pb[1] + pb[3] * 0.06, w * 0.6, Math.max(1, pb[3] * 0.025)); for (let q = 0; q < n; q++) { const y = pb[1] + pb[3] * (0.14 + q * 0.165); ctx.fillStyle = last ? AKZ.revenue : pale(0.15); ctx.fillRect(x, y, w, pb[3] * 0.13); ctx.fillStyle = last ? 'rgba(255,255,255,.9)' : pale(0.28); ctx.fillRect(x + w * 0.12, y + pb[3] * 0.035, w * 0.5, Math.max(1, pb[3] * 0.018)); } });
      ctx.globalAlpha = 1;
    }
    // Flipchart auf Staffelei mit handgezeichneten Kästchen und Pfeilen
    const fx = -5.2, fz = 7.7, lwE = lwAt(fz, 0.04);
    seg([fx - 0.4, 2.3, fz], [fx - 0.62, 0, fz - 0.12], '#0a0a10', lwE); seg([fx + 0.4, 2.3, fz], [fx + 0.62, 0, fz - 0.12], '#0a0a10', lwE); seg([fx, 2.3, fz + 0.04], [fx, 0, fz + 0.75], '#0a0a10', lwE);
    const fcR = fillZ(fx - 0.5, fx + 0.5, 0.95, 2.36, fz, '#cfcbd9');
    if (fcR) {
      const [rx, ry, rw, rh] = fcR, bx = (u, v, w, h2, on) => { if (on) { ctx.fillStyle = AKZ.revenue; ctx.fillRect(rx + u * rw, ry + v * rh, w * rw, h2 * rh); } ctx.strokeRect(rx + u * rw, ry + v * rh, w * rw, h2 * rh); }, ln = (u0, v0, u1, v1) => { ctx.beginPath(); ctx.moveTo(rx + u0 * rw, ry + v0 * rh); ctx.lineTo(rx + u1 * rw, ry + v1 * rh); ctx.stroke(); };
      ctx.strokeStyle = '#262433'; ctx.lineWidth = Math.max(1, rw * 0.018); ctx.lineJoin = 'round';
      bx(0.1, 0.09, 0.32, 0.13); bx(0.58, 0.09, 0.32, 0.13); ln(0.42, 0.155, 0.58, 0.155); ln(0.53, 0.13, 0.58, 0.155); ln(0.53, 0.18, 0.58, 0.155);
      bx(0.34, 0.36, 0.32, 0.13, true); ln(0.74, 0.22, 0.56, 0.36); ln(0.26, 0.22, 0.44, 0.36);
      bx(0.1, 0.64, 0.32, 0.13); bx(0.58, 0.64, 0.32, 0.13); ln(0.44, 0.49, 0.28, 0.64); ln(0.56, 0.49, 0.72, 0.64); ln(0.14, 0.86, 0.6, 0.86); ln(0.14, 0.91, 0.46, 0.91);
      if (rk(0) < 0.98) { ctx.fillStyle = `rgba(8,10,16,${0.55 * (1 - rk(0))})`; ctx.fillRect(rx, ry, rw, rh); }
    }
    fillZ(fx - 0.52, fx + 0.52, 2.34, 2.43, fz - 0.01, '#2b2a38');
    // Strategiewand: Tafel auf Rollen mit Feldern, einer Preistreppe und einem Pfeil
    const sw = fillZ(1.65, 2.95, 0.95, 2.4, 8.3, '#c9c5d6'), kS = rk(4);
    for (const x of [1.75, 2.85]) { seg([x, 0.95, 8.3], [x, 0, 8.3], '#0a0a10', lwAt(8.3, 0.04)); seg([x - 0.25, 0, 8.3], [x + 0.25, 0, 8.3], '#0a0a10', lwAt(8.3, 0.04)); }
    if (sw) {
      const [rx, ry, rw, rh] = sw; ctx.strokeStyle = '#262433'; ctx.lineWidth = Math.max(1, rw * 0.012);
      ctx.strokeRect(rx + rw * 0.07, ry + rh * 0.1, rw * 0.4, rh * 0.42); ctx.beginPath(); ctx.moveTo(rx + rw * 0.27, ry + rh * 0.1); ctx.lineTo(rx + rw * 0.27, ry + rh * 0.52); ctx.moveTo(rx + rw * 0.07, ry + rh * 0.31); ctx.lineTo(rx + rw * 0.47, ry + rh * 0.31); ctx.stroke();
      ctx.fillStyle = '#17469E'; ctx.fillRect(rx + rw * 0.29, ry + rh * 0.12, rw * 0.16, rh * 0.17);
      [0.22, 0.34, 0.5].forEach((v, i) => { ctx.fillStyle = i === 2 ? '#17469E' : 'rgba(38,36,51,.5)'; ctx.fillRect(rx + rw * (0.58 + i * 0.12), ry + rh * (0.52 - v), rw * 0.09, rh * v); });
      ctx.beginPath(); ctx.moveTo(rx + rw * 0.08, ry + rh * 0.88); ctx.lineTo(rx + rw * 0.9, ry + rh * 0.66); ctx.moveTo(rx + rw * 0.82, ry + rh * 0.64); ctx.lineTo(rx + rw * 0.9, ry + rh * 0.66); ctx.lineTo(rx + rw * 0.85, ry + rh * 0.74); ctx.stroke();
      if (kS < 0.98) { ctx.fillStyle = `rgba(8,10,16,${0.6 * (1 - kS)})`; ctx.fillRect(rx, ry, rw, rh); }
    }
    // Recruiting: ein Tisch, an dem ein Bewerbungsgespräch läuft; gegenüber sitzt der Gast als Umriss in Blau
    stehtisch(-0.85, 1.0, 6.4);
    tisch(-3.2, -1.85, 7.25, 8.0, 0.76); // Telefonat: zwei sitzen einander gegenüber, Headset, Telefon und Notizblock auf dem Tisch
    box(-2.7, -2.55, 0.76, 0.785, 7.45, 7.75, '#1d1c26', '#101016', '#16151e'); fillZ(-2.68, -2.57, 0.765, 0.78, 7.44, `rgba(${LAV},.7)`); glow(-2.62, 0.85, 7.6, 0.6, [[0, `rgba(${BL},.3)`], [1, `rgba(${BL},0)`]]);
    box(-2.3, -2.05, 0.76, 0.775, 7.4, 7.75, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    if (MK) {
      figuren('revenue');
      ctx.globalAlpha = 0.25 + 0.6 * rk(5); sil(4.7, 6.4, { profil: true, flip: true, ohneKH: true, col: '#161a26' }); ctx.globalAlpha = 1; // der Gast im Bewerbungsgespräch
    }
    schatten(3.8, 4.4, 6.05, 6.75); fillZ(4.06, 4.14, 0, 0.72, 6.4, '#101016'); box(3.9, 4.3, 0.72, 0.77, 6.1, 6.7, M.top, M.front, M.side);
  } else { // MAKE Innovation, drei Ecken: links der Innovations-Check, in der Mitte das Whiteboard des Workshops, rechts das Projekt
    const MK = MARKE.innovation, zw = z1 - 0.07, rk = (r) => (MK ? MK.rolle[0][r].v : 1), dunkel = '#0a0a10';
    // Innovations-Check: ein Bildschirm auf Rollen, darauf ein Netz mit fünf Achsen (Strategie, KI, Automatisierung, Daten, Team; nur als Form)
    for (const x of [-4.55, -3.25]) { seg([x, 1.0, 8.3], [x, 0, 8.3], dunkel, lwAt(8.3, 0.04)); seg([x - 0.25, 0, 8.3], [x + 0.25, 0, 8.3], dunkel, lwAt(8.3, 0.04)); }
    const cs = fillZ(-4.7, -3.1, 1.0, 2.45, 8.3, '#05050a');
    if (cs) {
      const [rx, ry, rw, rh] = cs, cx = rx + rw / 2, cy = ry + rh * 0.53, rr = rh * 0.37, pt = (i, f) => [cx + Math.sin((i * 2 * Math.PI) / 5) * rr * f, cy - Math.cos((i * 2 * Math.PI) / 5) * rr * f];
      const weg = (fs) => { ctx.beginPath(); fs.forEach((f, i) => { const q = pt(i, f); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); };
      ctx.fillStyle = sgr(0, ry, 0, ry + rh, [[0, '#2a2350'], [1, '#17142c']]); ctx.fillRect(rx + rw * 0.03, ry + rh * 0.04, rw * 0.94, rh * 0.92);
      ctx.strokeStyle = pale(0.3); ctx.lineWidth = Math.max(1, rw * 0.006); ctx.lineJoin = 'round';
      weg([0.5, 0.5, 0.5, 0.5, 0.5]); ctx.stroke(); weg([1, 1, 1, 1, 1]); ctx.stroke();
      for (let i = 0; i < 5; i++) { const q = pt(i, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      weg([0.84, 0.5, 0.68, 0.36, 0.74]); ctx.fillStyle = 'rgba(139,92,246,.55)'; ctx.fill(); ctx.strokeStyle = `rgba(${LAVH},.95)`; ctx.lineWidth = Math.max(1, rw * 0.014); ctx.stroke();
    }
    glow(-3.9, 1.7, 8.25, 2.7, [[0, `rgba(${LAV},.22)`], [1, `rgba(${LAV},0)`]]);
    // Auswertung (Netz und Balken) und Ablaufplan an der Wand; davor ein großer Tisch, an dem gearbeitet wird
    tafel(-2.05, 0.0, 0.95, 2.75, zw, TEX.radar, '#3a3849');
    glow(-1.0, 1.85, z1 - 0.1, 3.0, [[0, `rgba(${LAV},.2)`], [1, `rgba(${LAV},0)`]]);
    tafel(0.3, 2.4, 1.2, 2.62, zw, TEX.plan, '#3a3849');
    glow(1.35, 1.9, z1 - 0.1, 2.4, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
    const m = fillZ(2.75, 4.2, 1.38, 2.7, z1 - 0.08, '#05050a');
    if (m && TEX.flow) ctx.drawImage(TEX.flow, m[0] + m[2] * 0.02, m[1] + m[3] * 0.035, m[2] * 0.96, m[3] * 0.93);
    tisch(-1.75, 1.65, 7.35, 8.15, 0.76);
    laptop(-0.85, 0.76, 7.55); laptop(1.05, 0.76, 7.6);
    box(-0.1, 0.22, 0.76, 0.78, 7.55, 7.85, '#e9e4f3', '#bdb7cf', '#a8a2bc'); // ein aufgeschlagener Block
    platz(4.75, 7.2, rk(3), MK ? MK.rgb : LAV);
    if (MK) figuren('innovation');
  }
  // der Schacht läuft durch
  for (const x of [SHAFT.x0, SHAFT.x1]) seg([x, 0, SHAFT.z], [x, y1, SHAFT.z], `rgba(${LAV},.3)`, 1);
  ctx.restore(); oy = 0;
}

/* Die Straße vor dem Haus: Gehweg mit Fugen, Bordsteinkante, Fahrbahn */
function street() {
  oy = 0; if (cam.z > -NEAR) return;
  const k = S.f / -cam.z, gy = S.cy - (GROUND - cam.y) * k; if (gy > S.h) return;
  ctx.fillStyle = sgr(0, gy, 0, Math.max(gy + 40, S.h), [[0, '#1b1a27'], [0.35, '#101018'], [1, '#07080b']]); ctx.fillRect(0, gy, S.w, S.h - gy + 2);
  if (k < 14) return;
  const G = GROUND, CZ = -3.5, RY = G - 0.17;
  poly([[-60, RY, CZ], [60, RY, CZ], [60, RY, cam.z], [-60, RY, cam.z]], lg([0, RY, CZ], [0, RY, CZ - 7], [[0, '#131319'], [1, '#09090d']]));               // Fahrbahn
  for (let x = -42; x < 42; x += 5) poly([[x, RY + 0.004, -5.5], [x + 2.2, RY + 0.004, -5.5], [x + 2.2, RY + 0.004, -5.68], [x, RY + 0.004, -5.68]], 'rgba(246,244,240,.14)');
  poly([[-60, G, 0], [60, G, 0], [60, G, CZ], [-60, G, CZ]], lg([0, G, 0], [0, G, CZ], [[0, '#2a2933'], [1, '#201f29']]));                                  // Gehweg
  for (const z of [-1.1, -2.2]) seg([-60, G, z], [60, G, z], 'rgba(0,0,0,.24)', 1);
  for (let x = -30; x <= 30; x += 1.5) seg([x, G, 0], [x, G, CZ + 0.32], 'rgba(0,0,0,.16)', 1);
  poly([[-1.95, G + 0.004, -0.06], [-0.05, G + 0.004, -0.06], [-0.05, G + 0.004, -0.9], [-1.95, G + 0.004, -0.9]], '#15141b');                               // Fußmatte vor der Tür
  ctx.globalCompositeOperation = 'lighter';
  poly([[-6, G + 0.01, 0], [6, G + 0.01, 0], [7.5, G + 0.01, CZ], [-7.5, G + 0.01, CZ]], lg([0, G, 0], [0, G, CZ], [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]])); // Licht aus der Halle
  ctx.globalCompositeOperation = 'source-over';
  poly([[-60, G, CZ + 0.32], [60, G, CZ + 0.32], [60, G, CZ], [-60, G, CZ]], '#43414f');                                                                     // Bordstein von oben
  poly([[-60, G, CZ], [60, G, CZ], [60, RY, CZ], [-60, RY, CZ]], '#575565');                                                                                 // Bordsteinkante
}
/* Vordergrund: Straßenlaterne am Rand des Gehwegs und Menschen, die am Produkt vorbeigehen, ohne hinzusehen */
const LAMP = { x: 3.4, z: -3.05 };
function lamp() {
  const { x, z } = LAMP, lw = lwAt(z, 0.11), col = '#07070b', hx = x - 1.0, hy = 5.28;
  ctx.globalCompositeOperation = 'lighter';
  poly([[hx - 0.22, hy, z], [hx + 0.22, hy, z], [hx + 1.9, 0, z], [hx - 1.9, 0, z]], lg([0, hy, z], [0, 0, z], [[0, `rgba(${WARM},.06)`], [1, `rgba(${WARM},0)`]]));
  poly([[hx - 1.9, 0.006, z - 0.5], [hx + 1.9, 0.006, z - 0.5], [hx + 1.9, 0.006, z + 2.2], [hx - 1.9, 0.006, z + 2.2]], `rgba(${WARM},.05)`);
  ctx.globalCompositeOperation = 'source-over';
  fillZ(x - 0.13, x + 0.13, 0, 0.55, z, col); seg([x, 0.5, z], [x, 5.35, z], col, lw); seg([x, 5.35, z], [hx - 0.1, 5.5, z], col, lw * 0.75);
  fillZ(hx - 0.32, hx + 0.32, hy + 0.06, hy + 0.2, z, col); fillZ(hx - 0.26, hx + 0.26, hy, hy + 0.07, z, '#fff2e2');
  glow(hx, hy, z, 1.7, [[0, `rgba(${WARM},.6)`], [0.25, `rgba(${WARM},.18)`], [1, `rgba(${WARM},0)`]]);
}
const WALKERS = [[1.0, 0.8, -1.0, 0.95, 'telefon', false], [-3.3, -0.7, -1.6, 0.98, null, true], [3.0, 1.05, -2.3, 1.02, 'tasche', false], [-2.3, -0.9, -3.0, 1.06, null, false]]; // fern zuerst
function walkers(t) {
  if (-cam.z > 40 || cam.y - GROUND > 9) return;
  oy = GROUND; const T = STILL ? 0 : t * 0.001;
  WALKERS.forEach(([x0, v, z, s, prop, bob], i) => {
    const x = ((((x0 + v * T + 18) % 36) + 36) % 36) - 18;
    sil(x, z, { s, flip: v < 0, bob, prop, col: '#07070b', walk: T * Math.abs(v) * 5.4 + i * 2.1 + 1.25 });
  });
  sil(-1.05, -0.7, { s: 1.0, col: '#07070b', rim: 0.55, rimCol: WARM, kante: 0.35, kanteCol: WARM }); // ein Passant bleibt stehen und schaut ins Schaufenster
  lamp();
  oy = 0;
}

/* Der Turm von außen: geschlossene Etagen, Etagenlichter, Schacht, Rahmen der offenen Räume, Dachkante */
function tower() {
  if (cam.z > -NEAR) return;
  oy = 0;
  const d = -cam.z, k = S.f / d, yOf = (Y) => S.cy - (Y - cam.y) * k, xOf = (X) => S.cx + (X - cam.x) * k;
  const X0 = xOf(TXL), X1 = xOf(TXR), W = X1 - X0, fh = FH * k, bw = 1.4 * k, gy = yOf(GROUND), xr = xOf(6.15);
  if (X1 < 0 || X0 > S.w) return;
  const nTop = Math.min(TOP - 1, Math.ceil((cam.y + S.cy / k) / FH) + TOP), nBot = Math.max(0, Math.floor((cam.y - (S.h - S.cy) / k) / FH) + TOP - 1);
  const ksh = S.f / (SHAFT.z - cam.z), sx0 = S.cx + (SHAFT.x0 - cam.x) * ksh, sx1 = S.cx + (SHAFT.x1 - cam.x) * ksh; // der Schacht liegt hinter dem Glas, in der Tiefe der Kabine
  for (let n = nBot; n <= nTop; n++) {
    const yt = yOf(baseOf(n) + FH), open = OPEN.has(n);
    if (open) { ctx.fillStyle = '#0c0c14'; ctx.fillRect(xr, yt, X1 - xr, fh + 1); }
    else {
      ctx.fillStyle = n & 1 ? '#12121c' : '#0f0f18'; ctx.fillRect(X0, yt, W, fh + 1);
      if (bw > 2.5) for (let b = 0; b < 12; b++) { const r = hash(n, b); if (r < 0.17) { ctx.fillStyle = winCol(r * 5.8, (0.05 + r * 0.95) * (fh > 120 ? 0.5 : 1)); ctx.fillRect(X0 + b * bw + bw * 0.1, yt + fh * 0.2, bw * 0.8, fh * 0.66); } }
      if (bw > 5) { ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let b = 1; b < 12; b++) ctx.fillRect(X0 + b * bw, yt, Math.max(1, bw * 0.05), fh); }
      // der Schacht hinter Glas
      ctx.fillStyle = '#08080e'; ctx.fillRect(sx0, yt, sx1 - sx0, fh + 1);
      ctx.fillStyle = `rgba(${LAV},${0.2 + 0.3 * beacon})`; ctx.fillRect(sx0, yt, Math.max(1, 0.04 * k), fh + 1); ctx.fillRect(sx1 - Math.max(1, 0.04 * k), yt, Math.max(1, 0.04 * k), fh + 1);
    }
    if (n === 0) continue;
    const sh = Math.max(1, (0.13 + 0.3 * beacon) * k), a = 0.12 + 0.5 * beacon * (0.5 + 0.5 * hash(n, 99));
    ctx.fillStyle = '#1a1928'; ctx.fillRect(X0, yt - sh, W, sh * 2);
    ctx.fillStyle = `rgba(${LAV},${a})`; ctx.fillRect(X0, yt - sh * 0.5, W, sh);
  }
  const ya = Math.max(0, yOf(0)), yb = Math.min(S.h, gy);
  if (yb > ya) {
    ctx.fillStyle = sgr(X0, 0, X1, 0, [[0, `rgba(${LAV},.16)`], [0.16, `rgba(${LAV},.02)`], [1, 'rgba(0,0,0,.24)']]); ctx.fillRect(X0, ya, W, yb - ya);
    ctx.fillStyle = `rgba(${LAVH},.42)`; ctx.fillRect(X0, ya, Math.max(1, 0.05 * k), yb - ya);
  }
  // Rahmen der offenen Räume
  for (const F of FLOORS) {
    if (F.roof) continue;
    const hgt = F.n === 0 ? 7.2 : FH, yT = yOf(F.base + hgt), yB = yOf(F.base); if (yB < 0 || yT > S.h) continue;
    ctx.fillStyle = '#07070c'; ctx.fillRect(xOf(-6.15), yT, 0.15 * k, yB - yT); ctx.fillRect(xOf(6), yT, 0.15 * k, yB - yT);
    if (F.n === 0) ctx.fillRect(xOf(-6.15), yT, 12.3 * k, Math.max(1, 0.32 * k));
    for (let x = -4; x <= 4; x += 2) ctx.fillRect(xOf(x - 0.03), yT, Math.max(1, 0.06 * k), yB - yT);
    ctx.fillStyle = '#1a1928'; ctx.fillRect(xOf(-6.15), yB - 0.02 * k, 12.3 * k, Math.max(1, 0.2 * k));
    const ga = clamp01((d - 6) / 22) * 0.34, gx = xOf(-6), gw = 12 * k;
    if (ga > 0.01) { ctx.fillStyle = sgr(gx, yT, gx + gw, yB, [[0, `rgba(214,200,255,${ga * 0.5})`], [0.35, `rgba(160,150,225,${ga * 0.13})`], [1, 'rgba(160,150,225,0)']]); ctx.fillRect(gx, yT, gw, yB - yT); }
    if (F.n === 0 && k > 26) { // Glasfront zur Straße: schräge Spiegelungen, Eingangstür mit Griffen
      ctx.save(); ctx.beginPath(); ctx.rect(gx, yT, gw, yB - yT); ctx.clip(); ctx.fillStyle = 'rgba(226,218,255,.032)'; const sl = 0.16 * gw;
      for (const [u, w] of [[0.5, 0.07], [0.6, 0.025]]) { ctx.beginPath(); ctx.moveTo(gx + u * gw + sl, yT); ctx.lineTo(gx + (u + w) * gw + sl, yT); ctx.lineTo(gx + (u + w) * gw, yB); ctx.lineTo(gx + u * gw, yB); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const dx0 = xOf(-2), dx1 = xOf(0), dT = yOf(F.base + 2.6), mid = (dx0 + dx1) / 2, fr = Math.max(1.5, 0.08 * k);
      ctx.fillStyle = 'rgba(214,200,255,.07)'; ctx.fillRect(dx0, dT, dx1 - dx0, yB - dT);
      ctx.fillStyle = '#5a5870'; ctx.fillRect(dx0 - fr / 2, dT - fr, dx1 - dx0 + fr, fr); ctx.fillRect(dx0 - fr / 2, dT, fr, yB - dT); ctx.fillRect(dx1 - fr / 2, dT, fr, yB - dT); ctx.fillRect(mid - fr * 0.3, dT, fr * 0.6, yB - dT);
      ctx.fillStyle = '#55536a'; ctx.fillRect(dx0, yB - Math.max(1, 0.05 * k), dx1 - dx0, Math.max(1, 0.05 * k));
      ctx.fillStyle = 'rgba(246,244,240,.85)'; for (const hx of [mid - 0.2 * k, mid + 0.14 * k]) ctx.fillRect(hx, yOf(F.base + 1.55), Math.max(1.5, 0.055 * k), 0.65 * k);
    }
  }
  // Dachkante
  if (yOf(0.6) < S.h && yOf(-0.4) > -10) {
    ctx.fillStyle = '#07070c'; ctx.fillRect(xOf(TXL - 0.15), yOf(0.28), (TXR - TXL + 0.3) * k, 0.62 * k);
    ctx.fillStyle = `rgba(${LAVH},${0.55 + 0.4 * spots})`; ctx.fillRect(X0, yOf(-0.04), W, Math.max(1, 0.06 * k));
  }
  // Der rote Faden: der Schacht leuchtet durch alle Etagen, jeder Halt ein Punkt
  if (beacon > 0.01) {
    const cxm = (sx0 + sx1) / 2, top = yOf(0), bot = Math.min(S.h, gy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sgr(cxm - 3.2 * k, 0, cxm + 3.2 * k, 0, [[0, `rgba(${LAV},0)`], [0.5, `rgba(${LAV},${0.3 * beacon})`], [1, `rgba(${LAV},0)`]]); ctx.fillRect(cxm - 3.2 * k, top, 6.4 * k, bot - top);
    ctx.fillStyle = `rgba(226,216,255,${0.8 * beacon})`; ctx.fillRect(cxm - Math.max(0.6, 0.14 * k), top, Math.max(1.2, 0.28 * k), bot - top);
    ctx.globalCompositeOperation = 'source-over';
    if (marks > 0.01) for (const F of FLOORS) { ctx.fillStyle = `rgba(239,234,251,${marks})`; ctx.beginPath(); ctx.arc(cxm, yOf(F.base + 1.25), Math.max(2.5, 0.5 * k), 0, 7); ctx.fill(); }
  }
  // drei Stufen, farbig markiert (Szene 14): Fundament unten, Wachstum in der Mitte, Skalieren oben
  if (marks > 0.01) {
    const bandX0 = X0 - 1.6 * k, bandW = W + 3.2 * k;
    for (const [y0, y1, rgb] of [[GROUND, baseOf(11.5), STUFE.fundament], [baseOf(11.5), baseOf(31.5), STUFE.wachstum], [baseOf(31.5), 0.6, STUFE.skalieren]]) {
      const top = yOf(y1), bot = yOf(y0); if (bot < 0 || top > S.h) continue;
      ctx.fillStyle = sgr(bandX0, 0, bandX0 + bandW, 0, [[0, `rgba(${rgb},${0.5 * marks})`], [0.5, `rgba(${rgb},${0.2 * marks})`], [1, `rgba(${rgb},${0.5 * marks})`]]);
      ctx.fillRect(bandX0, top, bandW, bot - top);
      ctx.fillStyle = `rgba(${rgb},${0.95 * marks})`; const eb = Math.max(2, 0.3 * k); ctx.fillRect(bandX0, top, bandW, eb); ctx.fillRect(bandX0, bot - eb, bandW, eb);
    }
  }
}

/* Das Dach: Bühne, Traverse, drei Scheinwerfer. Im Auftakt dunkel, im Finale stehen die Lichtkegel über der Stadt */
function truss(a, b, off, n) {
  const lw = lwAt((a[2] + b[2]) / 2, 0.055), A2 = [a[0] + off[0], a[1] + off[1], a[2]], B2 = [b[0] + off[0], b[1] + off[1], b[2]], col = '#0a0a11';
  seg(a, b, col, lw); seg(A2, B2, col, lw);
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p = (q, t) => [lerp(q === 0 ? a[0] : A2[0], q === 0 ? b[0] : B2[0], t), lerp(q === 0 ? a[1] : A2[1], q === 0 ? b[1] : B2[1], t), a[2]]; seg(p(i % 2, t0), p((i + 1) % 2, t1), col, lw * 0.7); }
}
/* Der Abend auf dem Dach: Lichterketten, Gäste an Stehtischen, Stuhlreihen, eine Person am Pult, eine Kamera */
function terrace() {
  if (S.f / Math.max(1, 4 - cam.z) < 6.5) return; // aus der Ferne (roter Faden) bleibt das Dach leer
  const rail = 'rgba(205,192,255,.28)', dark = '#07070c';
  seg([TXL, 1.05, RD], [TXR, 1.05, RD], rail, 1.5); for (let x = TXL; x <= TXR + 0.01; x += 1.4) seg([x, 0, RD], [x, 1.05, RD], rail, 1);
  for (const x of [TXL + 0.05, TXR - 0.05]) { seg([x, 1.05, 0.3], [x, 1.05, RD], rail, 1.5); for (let z = 0.3; z < RD; z += 1.4) seg([x, 0, z], [x, 1.05, z], rail, 1); }
  // Lichterketten von zwei Masten zur Traverse
  const chain = (A, B, sag, n) => {
    const at = (u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u) - sag * Math.sin(Math.PI * u), lerp(A[2], B[2], u)];
    for (let i = 0; i < n; i++) seg(at(i / n), at((i + 1) / n), 'rgba(10,10,16,.9)', 1);
    for (let i = 1; i < n; i++) { const q = at(i / n), s = P(q[0], q[1], q[2]), r = Math.max(1.3, (0.075 * S.f) / (q[2] - cam.z)); ctx.fillStyle = `rgba(${WARM},.13)`; ctx.beginPath(); ctx.arc(s[0], s[1], r * 2.4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.fill(); }
  };
  for (const [x, z] of [[-6.1, 0.8], [10.1, 0.8]]) { seg([x, 0, z], [x, 3.6, z], dark, lwAt(z, 0.07)); }
  chain([-6.1, 3.6, 0.8], [-TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 0.9, 15); chain([10.1, 3.6, 0.8], [TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 1.1, 18);
  // Gäste des Abends: g[0] Tische mit Gästen im Licht, g[1] (Abendpartner) gehört nicht in die Fahrt
  const gk = AKT.F && AKT.F.roof ? AKT.k : 0, g = [gk, 0];
  // auf der Bühne: Pult und eine Person im warmen Licht
  oy = STAGE.y;
  if (g[1] > 0.02) { // Abendpartner: eine leere Tafel für das Logo an der Bühne
    ctx.globalAlpha = g[1];
    for (const x of [2.02, 2.98]) seg([x, 0, 9.6], [x, 0.32, 9.6], dark, lwAt(9.6, 0.05));
    const tf = fillZ(1.9, 3.1, 0.3, 2.35, 9.6, '#e9e5f2');
    if (tf) {
      const [rx, ry, rw, rh] = tf; ctx.strokeStyle = 'rgba(59,42,120,.75)'; ctx.lineWidth = Math.max(1, rw * 0.018); ctx.setLineDash([rw * 0.07, rw * 0.05]);
      ctx.strokeRect(rx + rw * 0.14, ry + rh * 0.14, rw * 0.72, rh * 0.4); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(59,42,120,.16)'; ctx.fillRect(rx + rw * 0.14, ry + rh * 0.66, rw * 0.72, rh * 0.05); ctx.fillRect(rx + rw * 0.14, ry + rh * 0.76, rw * 0.46, rh * 0.05);
    }
    glow(2.5, 1.4, 9.55, 2.2, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'lighter';
  poly([[-3.4, 0.004, 6.9], [-0.6, 0.004, 6.9], [-0.6, 0.004, 9], [-3.4, 0.004, 9]], `rgba(${WARM},${0.1 + 0.08 * g[1]})`);
  ctx.globalCompositeOperation = 'source-over';
  if (g[1] > 0.02) { ctx.globalAlpha = g[1]; sil(-2.4, 8.25, { col: '#191822', rim: 0.95, rimCol: WARM, kante: 0.9, bob: true }); ctx.globalAlpha = 1; } // der Abendpartner begrüßt
  sil(-1.45, 8.0, { col: '#191822', rim: 0.8, rimCol: WARM, kante: 0.55, s: 1.03 });
  box(-2.75, -2.05, 0, 1.15, 7.35, 7.8, '#8f8da6', lg([0, 1.15, 7.35], [0, 0, 7.35], [[0, '#55536a'], [1, '#262532']]), '#34323f');
  glow(-2.2, 1.5, 7.6, 2.6, [[0, `rgba(${WARM},.22)`], [1, `rgba(${WARM},0)`]]);
  oy = 0;
  const tisch = (x, z) => { seg([x, 0, z], [x, 1.08, z], dark, lwAt(z, 0.07)); fillZ(x - 0.28, x + 0.28, 0, 0.04, z, dark); box(x - 0.34, x + 0.34, 1.08, 1.13, z - 0.34, z + 0.34, '#8a88a0', '#262532', '#2b2a38'); fillZ(x - 0.03, x + 0.03, 1.13, 1.22, z, '#fff3e0'); glow(x, 1.2, z, 0.75, [[0, `rgba(${WARM},.5)`], [1, `rgba(${WARM},0)`]]); };
  const G = { rim: 0.45, rimCol: WARM, kante: 0.4 }, GT = { rim: 0.45 + 0.45 * g[0], rimCol: WARM, kante: 0.4 + 0.45 * g[0] };
  // Thementisch: als Gast stehen die Tische im Licht, mit einem Aufsteller für das Thema
  const thementisch = (x, z) => {
    if (g[0] > 0.02) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 1.5, 0.005, z - 1.2], [x + 1.5, 0.005, z - 1.2], [x + 1.25, 0.005, z + 1.3], [x - 1.25, 0.005, z + 1.3]], `rgba(${WARM},${0.1 * g[0]})`); ctx.globalCompositeOperation = 'source-over'; glow(x, 1.3, z, 2.1, [[0, `rgba(${WARM},${0.2 * g[0]})`], [1, `rgba(${WARM},0)`]]); }
    tisch(x, z);
    if (g[0] > 0.02) { ctx.globalAlpha = g[0]; fillZ(x + 0.08, x + 0.3, 1.13, 1.42, z - 0.05, '#efeaf8'); fillZ(x + 0.11, x + 0.27, 1.33, 1.37, z - 0.06, '#5F4BB6'); fillZ(x + 0.11, x + 0.24, 1.24, 1.27, z - 0.06, 'rgba(38,36,51,.4)'); ctx.globalAlpha = 1; }
  };
  // Gäste am hinteren Thementisch und links neben der Bühne
  thementisch(DT[1][0], DT[1][1]); sil(DT[1][0] - 0.7, DT[1][1] - 0.1, { ...GT, walk: 0, steh: true, prop: 'zeig' }); sil(DT[1][0] + 0.7, DT[1][1], { ...GT, walk: 0, steh: true, flip: true, s: 0.96 });
  // drei Stuhlreihen mit Mittelgang
  [5.3, 4.2, 3.1].forEach((z, r) => {
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = side * (0.95 + i * 1.04), id = r * 6 + i * 2 + (side > 0 ? 1 : 0);
      if (r === 2 && side > 0 && i === 0) continue;                               // hier steht die Kamera
      if (hash(id, 41) > 0.12) sil(x + (hash(id, 5) - 0.5) * 0.14, z, { seat: true, s: 0.9 + r * 0.06 + hash(id, 9) * 0.05, bob: hash(id, 12) > 0.6, col: hash(id, 3) > 0.5 ? '#0e0e15' : '#14131c', kante: 0.8, kanteCol: WARM });
      box(x - 0.26, x + 0.26, 0.44, 0.84, z - 0.28, z - 0.22, '#4a4860', '#22212c', '#262532'); fillZ(x - 0.26, x + 0.26, 0.815, 0.84, z - 0.281, `rgba(${WARM},.22)`);
    }
  });
  if (g[0] > 0.02) { ctx.globalAlpha = g[0]; sil(DT[0][0] + 0.1, DT[0][1] + 0.75, { ...GT, s: 0.97, bob: true }); ctx.globalAlpha = 1; } // am Thementisch steht ein Dritter dabei
  thementisch(DT[0][0], DT[0][1]); sil(DT[0][0] - 0.7, DT[0][1], { ...GT, walk: 0, steh: true }); sil(DT[0][0] + 0.7, DT[0][1] - 0.1, { ...GT, walk: 0, steh: true, flip: true, prop: 'halte', s: 0.97 });
  // die Kamera läuft mit
  tripod(1.2, 1.9, 1.6);
}
function roof(p) {
  oy = 0;
  const yEdge = cam.z < -NEAR ? P(0, 0, 0)[1] : S.h; if (yEdge < 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.w, yEdge + 1); ctx.clip(); // was hinter der Dachkante liegt, verdeckt das Haus
  if (cam.y > 0.02) {
    poly([[TXL, 0, 0], [TXR, 0, 0], [TXR, 0, RD], [TXL, 0, RD]], lg([0, 0, 0], [0, 0, RD], [[0, '#14141d'], [1, '#1d1c29']]));
    for (let z = 2; z < RD; z += 2) seg([TXL, 0, z], [TXR, 0, z], 'rgba(0,0,0,.25)', 1);
    poly([[TXL, 0.004, 0], [TXR, 0.004, 0], [TXR, 0.004, 0.35], [TXL, 0.004, 0.35]], '#0b0b12');
  }
  // Kopf des Schachts
  const hh = rectZ(SHAFT.x0, SHAFT.x1, 0, 2.7, SHAFT.z);
  if (hh) { ctx.fillStyle = `rgba(${LAV},.05)`; ctx.fillRect(hh[0], hh[1], hh[2], hh[3]); ctx.strokeStyle = `rgba(${LAV},.4)`; ctx.lineWidth = lwAt(SHAFT.z, 0.04); ctx.strokeRect(hh[0], hh[1], hh[2], hh[3]); }
  // Lichtkegel in den Himmel
  const lamps = [-2.9, 0, 2.9], LY = TRUSS.h - 0.28;
  if (spots > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    lamps.forEach((lx, i) => {
      const on = clamp01(spots * 3 - i * 0.7), A = P(lx, LY, TRUSS.z), ang = (i - 1) * 0.5, len = S.h * 1.3;
      const B = [A[0] + Math.sin(ang) * len, A[1] - Math.cos(ang) * len], nx = Math.cos(ang), ny = Math.sin(ang);
      if (on <= 0) return;
      for (const [wEnd, a] of [[len * 0.13, 0.3], [len * 0.085, 0.3], [len * 0.04, 0.34]]) { // drei Lagen: außen weich, innen hell
        const g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]); g.addColorStop(0, `rgba(${LAVH},${a * on})`); g.addColorStop(0.3, `rgba(${LAV},${a * 0.5 * on})`); g.addColorStop(1, `rgba(${LAV},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(A[0] - nx * 2, A[1] - ny * 2); ctx.lineTo(B[0] - nx * wEnd, B[1] - ny * wEnd); ctx.lineTo(B[0] + nx * wEnd, B[1] + ny * wEnd); ctx.lineTo(A[0] + nx * 2, A[1] + ny * 2); ctx.closePath(); ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    glow(0, STAGE.y + 1.2, STAGE.zc, 9, [[0, `rgba(${LAV},${0.22 * spots})`], [1, `rgba(${LAV},0)`]]);
  }
  // Traverse hinten
  truss([-TRUSS.x, 0, TRUSS.z], [-TRUSS.x, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9); truss([TRUSS.x - 0.38, 0, TRUSS.z], [TRUSS.x - 0.38, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9);
  truss([-TRUSS.x, TRUSS.h, TRUSS.z], [TRUSS.x, TRUSS.h, TRUSS.z], [0, 0.45, 0], 16);
  // Bühne
  box(STAGE.x0, STAGE.x1, 0, STAGE.y, STAGE.z0, STAGE.z1, lg([0, STAGE.y, STAGE.z0], [0, STAGE.y, STAGE.z1], [[0, '#2c2a3a'], [1, '#201f2c']]), '#12121a', '#191822');
  fillZ(STAGE.x0, STAGE.x1, STAGE.y - 0.1, STAGE.y - 0.04, STAGE.z0 - 0.01, `rgba(${LAVH},${0.3 + 0.65 * spots})`);
  if (spots > 0.01) { ctx.globalCompositeOperation = 'lighter'; poly([[STAGE.x0, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z1], [STAGE.x0, STAGE.y + 0.004, STAGE.z1]], `rgba(${LAV},${0.16 * spots})`); ctx.globalCompositeOperation = 'source-over'; }
  // der Platz des Kerns: ein Ring auf dem Bühnenboden
  if (cam.y > STAGE.y) { const c = P(0, STAGE.y + 0.006, STAGE.zc), rx = (0.75 * S.f) / (STAGE.zc - cam.z), ry = Math.abs(P(0, STAGE.y, STAGE.zc - 0.75)[1] - P(0, STAGE.y, STAGE.zc + 0.75)[1]) / 2; ctx.strokeStyle = `rgba(${LAVH},${0.45 + 0.4 * spots})`; ctx.lineWidth = lwAt(STAGE.zc, 0.03); ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, Math.max(0.5, ry), 0, 0, 7); ctx.stroke(); }
  if (p >= floorRange(HALTS - 2)[1] - 0.03) terrace();
  // Scheinwerfer
  lamps.forEach((lx, i) => {
    const on = clamp01(spots * 3 - i * 0.7), q = P(lx, LY, TRUSS.z), r = (0.3 * S.f) / (TRUSS.z - cam.z);
    seg([lx, TRUSS.h, TRUSS.z], [lx, LY, TRUSS.z], '#0a0a11', lwAt(TRUSS.z, 0.05));
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.5, r), 0, 7); ctx.fill();
    ctx.fillStyle = on > 0 ? `rgba(246,240,255,${0.3 + 0.7 * on})` : '#252432'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, r * 0.62), 0, 7); ctx.fill();
    if (on > 0) glow(lx, LY, TRUSS.z, 1.8, [[0, `rgba(${LAVH},${0.8 * on})`], [0.3, `rgba(${LAV},${0.3 * on})`], [1, `rgba(${LAV},0)`]]);
  });
  ctx.restore();
}

/* Das Licht der Marke: MAKE Studios warm in Signal, MAKE Revenue kühl in Tiefblau und Hellblau. Der Kern bleibt violett (er wird danach gezeichnet). */
function markenLicht() {
  const k = INS.k; if (k <= 0.01 || !INS.F) return; const MK = MARKE[INS.F.key], w = S.w, hh = S.h;
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(${MK.tief},${(MK.licht || 0.42) * k})`; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w * 0.58, hh * 0.18, 0, w * 0.58, hh * 0.18, Math.max(w, hh) * 0.85);
  g.addColorStop(0, `rgba(${MK.rgb},${0.11 * k})`); g.addColorStop(1, `rgba(${MK.rgb},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'source-over';
}
function drawScene(v, t) {
  const p = v.pz; // Stelle für Kern und Licht (bei einem Flug weicht sie von der Stelle der Kamera ab)
  kamera(v); oy = 0; spots = span(p, SPOTS); marks = span(p, [THREAD[0] + 0.018, THREAD[1]]) * (1 - span(p, FADEN_OUT)); beacon = span(p, THREAD) * (1 - 0.55 * span(p, [FADEN_OUT[0], SPOTS[1]]));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(sky, 0, Math.round(S.cy - skyHy));
  drawCity();
  street();
  KERN = coreState(p); KERN.fertig = false;
  const innen = cam.z > -1 && INS.k > 0 && INS.F;
  if (innen) room(INS.F, t); // im Markenraum: nur dieser Raum
  else { const half = (Math.max(S.cy, S.h - S.cy) * -cam.z) / S.f; for (const F of FLOORS) if (!F.roof && Math.abs(F.base + F.y1 / 2 - cam.y) < half + F.y1) room(F, t); }
  tower();
  markenLicht();
  if (!innen) roof(p);
  if (!KERN.fertig) drawCore(KERN);
  walkers(t);
}

/* Prüfmodus: Canvas als Bild ausgeben (ein verstecktes Vorschaufenster zeigt Canvas-Änderungen nicht) */
function snap(c) { if (!STILL) return; c.style.visibility = 'hidden'; c.parentElement.style.background = `url(${c.toDataURL('image/jpeg', 0.9)}) center / cover no-repeat`; }

/* ═══════════════ Aufbau der Seite: die 15 Szenen ═══════════════ */
const SZ = /*SZENEN*/[]/*SZENEN-ENDE*/;   // je Szene: id, art, stufe und bild (p, pz, ue, zone, zoom)
const N = SZ.length, KREIS = 0.5;          // nach der letzten Szene wächst der Kreis noch eine halbe Szenenlänge lang (Übergang in die Kurz-Startseite); dieselbe Zahl steht in haus.css (Höhe der Spur: 14,5 Szenen)
const kopf = $('.kopf');
const track = $('#top'), star = $('#star'), starTint = $('#starTint'), skip = $('#ueberspringen');
const panels = SZ.map((s) => $('#szene-' + s.id));
const etagenNav = $('#etagen'), stufenNav = $('#stufen'), wahl = $('#etagenwahl'), gast = $('#gastwunsch');
const KURZ = () => document.getElementById('kurz') || document.getElementById('einstieg');
const spurTop = () => track.getBoundingClientRect().top + scrollY;
/* Länge einer Szene auf der Spur in px. Sie steht in haus.css (--szene) und wird gemessen, nie aus der Fensterhöhe gerechnet:
   Am Handy ändert sich die Fensterhöhe mit der Adressleiste, die Spur (vh) nicht. So springt beim Ein- und Ausblenden der Leiste nichts. */
const rastEls = $$('.snap', track);
let SZL = innerHeight;
function messen() { const l = rastEls.length > 1 ? rastEls[1].getBoundingClientRect().top - rastEls[0].getBoundingClientRect().top : 0; SZL = l > 50 ? l : innerHeight; } // genau, nicht auf ganze Pixel gerundet (Zoom)
messen();
const szeneY = (i) => (STATISCH ? Math.round(panels[i].getBoundingClientRect().top + scrollY - 8) : Math.round(spurTop() + i * SZL));
const kurzY = () => { const k = KURZ(); return Math.round(k ? k.getBoundingClientRect().top + scrollY : spurTop() + track.offsetHeight); };

/* ── Eigene Fahrten der Seite: Tasten, Knöpfe, Leisten und das weiche Einrasten. Rad, Trackpad und Finger scrollen ganz normal (nichts wird abgefangen);
      jede Eingabe des Besuchers bricht eine laufende Fahrt sofort ab, die Seite bleibt, wo sie gerade ist. ── */
let fahrt = null;                    // { von, y, t0, dauer, kurve, ziel } · ziel = Nummer der Szene (N = Kurz-Startseite)
let eigenY = -1, eigenOffen = false; // die Lage, die wir zuletzt selbst gesetzt haben (so erkennen wir im scroll-Ereignis fremde Bewegung)
let geste = false, gesteY = 0, basis = 0; // die laufende Geste des Besuchers (siehe weiches Einrasten)
let cssAn = false;                   // html.rast-fest: der Browser rastet selbst (nur bei Berührung, nur im Stillstand umgeschaltet)
function cssRasten(an) { if (an === cssAn) return; cssAn = an; root.classList.toggle('rast-fest', an); }
function fahrtAus() { fahrt = null; }
function fahre(y, dauer, kurve, ziel = null) {
  y = Math.max(0, Math.min(y, root.scrollHeight - innerHeight));
  if (Math.abs(y - scrollY) < 1) { fahrt = null; return; }
  cssRasten(false); // eigene Fahrten laufen ohne das Rasten des Browsers (er würde jeden Schritt auf eine Raststelle ziehen); umgeschaltet wird im Stand
  fahrt = { von: scrollY, y, t0: performance.now(), dauer, kurve, ziel }; geste = false;
}
readers.push((now) => {
  if (!fahrt) return;
  const k = Math.min(1, Math.max(0, (now - fahrt.t0) / fahrt.dauer));
  eigenY = k < 1 ? fahrt.von + (fahrt.y - fahrt.von) * fahrt.kurve(k) : fahrt.y; eigenOffen = true;
  scrollTo(0, eigenY);
  if (k >= 1) fahrt = null;
});
/* Eine Szene anfahren (i = N: die Kurz-Startseite): Knöpfe, Leisten, Tasten, Direkteinstiege. */
function szeneZu(i, sofort, dauer, kurve) {
  const kurz = i >= N, y = kurz ? kurzY() : szeneY(Math.max(0, Math.min(N - 1, i)));
  if (sofort || STATISCH || reduce) { fahrtAus(); if (Math.abs(y - scrollY) >= 2) { cssRasten(false); scrollTo(0, y); } return; }
  fahre(y, dauer ?? (kurz ? 1200 : Math.min(1500, 520 + 120 * Math.abs((y - scrollY) / SZL))), kurve ?? easeInOutSine, Math.max(0, Math.min(N, i)));
}
const szeneNr = (w) => { const n = /^\d+$/.test(w) ? +w - 1 : SZ.findIndex((s) => s.id === w); return n >= 0 && n < N ? n : -1; };
const sceneDirty0 = () => { sceneDirty = true; };

/* ── Ansicht: aus der Scroll-Position (s = 0 … 14, Szene für Szene) wird eine Stelle der Zeitachse ── */
const keyVon = (z) => { const i = Math.floor((z.p - TOUR_START) / FLOOR_LEN); return i >= 0 && i < HALTS ? FLOORS[i].key : null; };
function ansicht(s) {
  if (STILL) return { p: STILL.p, pz: STILL.p, blende: null };
  const k = Math.min(N - 2, Math.max(0, Math.floor(s))), t = clamp01(s - k), A = SZ[k], B = SZ[k + 1];
  const v = { p: lerp(A.p, B.p, t), pz: lerp(A.pz ?? A.p, B.pz ?? B.p, t), blende: null };
  if (B.ue === 'blende') v.blende = { pa: A.kam || A.p, pb: B.kam || B.p, t: easeInOutSine(t) }; // die Kamera fliegt, statt dass der Aufzug fährt
  for (const key in MARKE) MARKE[key].zone.v = MARKE[key].z0;
  const ka = keyVon(A), kb = keyVon(B), za = A.zone ?? (ka ? MARKE[ka].z0 : 0), zb = B.zone ?? (kb ? MARKE[kb].z0 : 0);
  if (ka && ka === kb) MARKE[ka].zone.v = lerp(za, zb, t); else { if (ka) MARKE[ka].zone.v = za; if (kb) MARKE[kb].zone.v = zb; }
  ZOOM = lerp((S.narrow ? A.zoomn ?? A.zoom : A.zoom) ?? 1, (S.narrow ? B.zoomn ?? B.zoom : B.zoom) ?? 1, t);
  NCY = lerp(A.cyn ?? 0.235, B.cyn ?? 0.235, t); NDZ = lerp(A.dz ?? 2.5, B.dz ?? 2.5, t); NCYD = lerp(A.cyd ?? 0.19, B.cyd ?? 0.19, t); NZF = lerp(A.fzd ?? 1, B.fzd ?? 1, t);
  MARKE.podcast.zone.v = clamp01((1 - ZOOM) / 0.3); // Deine Bühne (näher heran): die Ansicht wandert vom Tisch zum Interview-Platz
  return v;
}
const sS = new Spring(0, FOLGE, sceneDirty0, 0.0004);

/* Filmkorn über der Szene */
(() => { const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160), R = mulberry(3); for (let i = 0; i < d.data.length; i += 4) { const v = (R() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = `url(${c.toDataURL()})`; })();

/* ── Lesen: wo steht die Seite? Danach Text, Leisten, Kreis und Kopf ── */
let roh = 0, aktiv = -1, canvasAn = true, kopfLage = '', marke = false;
const stufenFolge = [...new Set(SZ.map((s) => s.stufe).filter(Boolean))];
const stufeVon = (i) => SZ[i].stufe;
const etagenLinks = $$('a', etagenNav), stufenLinks = $$('a', stufenNav);
const schmal = matchMedia('(max-width: 767.98px), (max-width: 1100px) and (max-aspect-ratio: 9/10)'); // Handy und Tablet hochkant: das Bild über dem Text
function zeigeSzene(a) {
  aktiv = a;
  panels.forEach((el, i) => {
    el.classList.toggle('an', i === a);
    if (STATISCH) return; // bei „weniger Bewegung“ stehen alle Szenen untereinander und sind alle bedienbar
    el.inert = i !== a; if (i === a) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true'); // nur die Szene im Bild ist bedienbar und vorlesbar
  });
  const st = stufeVon(a), sichtbar = a >= 3 && a <= 13;
  etagenNav.classList.toggle('an', sichtbar); stufenNav.classList.toggle('an', sichtbar || a === 13);
  etagenLinks.forEach((l) => { const jetzt = l.dataset.szenen.split(' ').includes(SZ[a].id); l.classList.toggle('jetzt', jetzt); if (jetzt) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current'); l.parentElement.hidden = schmal.matches && !!st && l.dataset.stufe !== st; if (schmal.matches && !st) l.parentElement.hidden = true; });
  stufenLinks.forEach((l) => {
    const idx = SZ.map((s, i) => (s.stufe === l.dataset.stufe ? i : -1)).filter((i) => i >= 0), von = idx[0], n = idx.length, jetzt = l.dataset.stufe === st;
    l.classList.toggle('jetzt', jetzt); l.style.setProperty('--fuell', `${Math.round(clamp01((a - von + 1) / n) * 100)}%`);
    if (jetzt) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current');
  });
}
/* Die Tafeln blenden nach der Lage: Tafel i steht voll da, solange die (straff nachgeführte) Lage näher als 0,3 Szenen an i ist, und blendet bis 0,5 weich aus;
   erst danach kommt die nächste. Nie zwei Tafeln zugleich, nie Buchstabe für Buchstabe: Der Text steht ganz da, er wandert nur wenige Pixel mit. */
const tafelO = new Array(N).fill(-1);
function tafeln(lage) {
  for (let i = 0; i < N; i++) {
    const d = lage - i, a = Math.abs(d), t = a <= 0.3 ? 0 : a >= 0.5 ? 1 : (a - 0.3) / 0.2;
    const o = Math.round((1 - t * t * (3 - 2 * t)) * 200) / 200;
    if (o === tafelO[i]) continue; tafelO[i] = o;
    const el = panels[i];
    el.style.setProperty('--tafel', String(o)); el.style.transform = o < 1 && o > 0 ? `translate3d(0,${(-Math.sign(d) * (1 - o) * 14).toFixed(1)}px,0)` : '';
    el.classList.toggle('zeigt', o > 0);
  }
}
painters.push(() => { if (!STATISCH && !STILL) tafeln(sS.v); });

let inFahrt = true;
readers.push((now) => {
  const bb = track.getBoundingClientRect(), h = innerHeight;
  if (STATISCH) { kopfSetzen(bb.bottom <= (kopf ? kopf.offsetHeight : 0) * 0.6 ? 'hell' : 'glas'); return; }
  roh = STILL ? 0 : Math.min(N - 1 + KREIS, Math.max(0, -bb.top / SZL));
  const a = Math.min(N - 1, Math.max(0, Math.round(Math.min(roh, N - 1))));
  if (a !== aktiv) zeigeSzene(a);
  inFahrt = !STILL && bb.bottom > 2; // danach scrollt die Seite ganz normal
  if (!marke && roh >= N - 1 - 0.02) { marke = true; try { localStorage.setItem('make-fahrt', '1'); } catch (_) { /* ohne localStorage: die Fahrt startet beim nächsten Mal wieder */ } }
  if (!STILL) sS.set(Math.min(roh, N - 1));
  // der Kreis nach der letzten Szene
  const c = clamp01((roh - (N - 1)) / KREIS);
  star.style.visibility = c > 0 ? 'visible' : 'hidden'; star.style.opacity = c > 0 ? 1 : 0;
  star.style.transform = `scale(${0.012 + Math.pow(c, 4) * 3.2})`; starTint.setAttribute('opacity', easeInOutSine(span(c, [0.2, 1])));
  canvasAn = c < 0.98 && bb.bottom > 0 && bb.top < h;
  kopfSetzen(bb.bottom <= (kopf ? kopf.offsetHeight : 0) * 0.6 || c > 0.97 ? 'hell' : roh < 0.5 ? 'szene' : 'glas');
  if (!STILL) rasten(now);
});

/* ── Weiches Einrasten: Kommt eine kurze Zeit lang keine Eingabe und steht die Seite nicht auf einer Szene, gleitet sie auf die nächste.
      Es zwingt niemanden: Rad, Taste, Zeiger oder Finger brechen es sofort ab. Hinter der letzten Szene zieht nichts zurück, nach der Fahrt rastet nichts mehr. ── */
const RUHE = 140, RUHE_UNKLAR = 700;         // ms ohne Eingabe und ohne Bewegung; „unklar“ = Bewegung ohne erkennbare Eingabe (z. B. gezogene Bildlaufleiste)
const SCHWELLE = 0.12, SCHWELLE_PX = 90;     // ab diesem Weg (in Szenen, höchstens 90 px: eine Raste des Mausrads genügt) geht es in Scrollrichtung zur nächsten Szene statt zurück
const SCHWELLE_DURCH = 0.35;                 // nach einer überfahrenen Szene: erst ab hier weiter zur übernächsten, sonst zurück auf die eben erreichte
const grob = matchMedia('(pointer: coarse)');
let tast = grob.matches;                     // Berührung: dort rastet der Browser selbst (html.rast-fest), das weiche Einrasten springt nur ein, solange die Klasse ruht
let letzteRegung = performance.now() + 600, letzteEingabe = 0, letzterScroll = 0, letztY = scrollY, dir = 0, unklar = false;
let zeigerUnten = false, fingerUnten = false, haltSzene = -1;
const feldAktiv = () => { const el = document.activeElement; return !!el && el !== document.body && el.matches('input, textarea, select, [contenteditable]'); };
const gesperrt = () => root.classList.contains('menue-offen') || !!document.querySelector('dialog[open]');
function regung(eingabe) { const t = performance.now(); letzteRegung = t; if (eingabe) letzteEingabe = t; }
/* Eine Geste beginnt mit der ersten Eingabe nach einer Ruhe. Wir merken uns, wo die Seite da stand (gesteY) und auf welcher Szene sie stand bzw. wohin sie
   gerade glitt (basis). Wer ein Zurückgleiten unterbricht, setzt seine Geste fort: Kleine, zögernde Schritte zählen zusammen. */
function gesteBeginn(y0) {
  if (geste) return; geste = true;
  if (fahrt && fahrt.zurueck) return;
  gesteY = y0; basis = fahrt && fahrt.ziel != null ? Math.min(N - 1, fahrt.ziel) : Math.max(0, Math.min(N - 1, Math.round((y0 - spurTop()) / SZL)));
}
function rastZiel(y, oben, ende) {
  const s = (y - oben) / SZL, letzte = N - 1, px = Math.min(SCHWELLE * SZL, SCHWELLE_PX), weg = y - gesteY;
  if (s > letzte) { // Übergang hinter der letzten Szene (der Kreis): vorwärts zur Kurz-Startseite, von unten kommend hinauf in die letzte Szene. Zurück zieht hier nichts.
    const yL = szeneY(letzte);
    if (dir < 0) return ende - y <= px ? ende : yL;
    return y - yL <= px ? yL : ende;
  }
  const b = Math.max(0, Math.min(letzte, basis)), sz = (i) => szeneY(Math.max(0, Math.min(letzte, i)));
  if (!dir) return sz(Math.round(s));
  if (weg * dir <= px) return Math.abs(weg) <= px ? sz(b) : sz(dir > 0 ? Math.ceil(s - 1e-4) : Math.floor(s + 1e-4)); // kaum bewegt: zurück bzw. weiter zur Szene, zu der es schon ging · umgekehrt: die nächste Szene in der neuen Richtung
  const o = dir > 0 ? Math.floor(s + 1e-4) : Math.ceil(s - 1e-4);  // die Szene, die in Scrollrichtung hinter uns liegt
  if (dir * (o - b) <= 0) return sz(b + dir);                       // deutlicher Weg, noch im ersten Schritt: eine Szene weiter, nie zurück
  return sz(dir * (s - o) > SCHWELLE_DURCH ? o + dir : o);          // eine Szene oder mehr überfahren: auf die nächstgelegene, mit leichtem Zug nach vorn
}
function rasten(now) {
  if (STATISCH || reduce || fahrt || zeigerUnten || fingerUnten) return;
  const y = scrollY, oben = spurTop(), ende = kurzY(), still = now - letzteRegung;
  const drin = y >= oben - 1 && y < ende - 1, s = (y - oben) / SZL, n = Math.round(s), aufSzene = drin && n <= N - 1 && Math.abs(y - szeneY(n)) <= 1;
  if ((aufSzene || !drin) && still > 60) { haltSzene = aufSzene ? n : -1; dir = 0; geste = false; }
  if (tast) { // Berührung: die Klasse wird nur im Stillstand auf einer Raststelle gesetzt bzw. nach der Fahrt gelöst, nie mitten im Scrollen
    if (still > 120) { if (!cssAn && aufSzene) cssRasten(true); else if (cssAn && !drin) cssRasten(false); }
    if (cssAn) return;
  }
  if (!drin || aufSzene || still < (unklar ? RUHE_UNKLAR : RUHE) || document.hidden) return; // vor und nach der Fahrt scrollt die Seite ganz normal
  if (gesperrt() || feldAktiv()) return;
  if (!geste) { gesteY = y; basis = Math.max(0, Math.min(N - 1, n)); dir = 0; } // ohne Geste (z. B. neu geladen mitten in der Fahrt): auf die nächstgelegene Szene
  const ziel = rastZiel(y, oben, ende), weg = Math.abs(ziel - y);
  if (weg < 1) return;
  const amEnde = ziel >= ende - 1 || s > N - 1, nr = ziel >= ende - 1 ? N : Math.round((ziel - oben) / SZL), zurueck = !amEnde && nr === basis && Math.abs(y - gesteY) <= Math.min(SCHWELLE * SZL, SCHWELLE_PX);
  fahre(ziel, amEnde ? 420 + 260 * Math.min(1, weg / (1.4 * SZL)) : 280 + 180 * Math.min(1, weg / (0.8 * SZL)), easeOutCubic, nr);
  if (fahrt) fahrt.zurueck = zurueck;
}
addEventListener('scroll', () => {
  const y = scrollY, t = performance.now();
  if (eigenOffen && Math.abs(y - eigenY) <= 2) { eigenOffen = !!fahrt; letztY = y; return; } // unsere eigene Fahrt
  gesteBeginn(letztY);
  if (y !== letztY) dir = y > letztY ? 1 : -1;
  letztY = y; haltSzene = -1;
  if (fahrt) fahrtAus();                                                      // jemand anderes bewegt die Seite (Bildlaufleiste, Sprungmarke): wir lassen los
  if (t - letzterScroll > 200) unklar = !fingerUnten && t - letzteEingabe > 300; // eine Bewegung ohne Rad, Taste oder Finger davor: länger warten
  letzterScroll = letzteRegung = t;
}, { passive: true });
/* Das Rad hört nur zu (passiv, nichts wird abgefangen): Es bricht eine laufende Fahrt ab und merkt sich den Zeitpunkt. */
addEventListener('wheel', (e) => {
  if (e.ctrlKey) return; // Zoomen
  gesteBeginn(letztY); regung(true); fahrtAus(); // letztY, nicht scrollY: Der Browser hat die Seite oft schon bewegt, wenn das Rad-Ereignis ankommt
  if (tast) { tast = false; cssRasten(false); } // Gerät mit Berührung, das gerade mit Maus oder Trackpad bedient wird: frei scrollen, weich einrasten (die nächste Berührung stellt zurück)
}, { passive: true });
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; zeigerUnten = true; gesteBeginn(letztY); regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['pointerup', 'pointercancel']) addEventListener(typ, (e) => { if (e.pointerType === 'touch') return; zeigerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('pointermove', (e) => { if (zeigerUnten && e.buttons === 0) { zeigerUnten = false; regung(true); } }, { passive: true, capture: true }); // losgelassen über der Bildlaufleiste
addEventListener('touchstart', () => { fingerUnten = true; tast = true; gesteBeginn(letztY); regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['touchend', 'touchcancel']) addEventListener(typ, (e) => { if (!e.touches.length) fingerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('blur', () => { zeigerUnten = false; fingerUnten = false; });
document.addEventListener('click', (e) => { // eine Sprungmarke anderswo auf der Seite (Kopf, Fuß): der Browser springt frei, ohne auf eine Szene gezogen zu werden
  if (!cssAn) return; const a = e.target.closest?.('a[href*="#"]'); if (a && !a.getAttribute('href').startsWith('#szene-')) cssRasten(false);
}, true);
function kopfSetzen(lage) { // Kopf der Website: über Szene 1 durchsichtig, über der Fahrt dunkles Glas, im hellen Teil wie überall
  if (!kopf || lage === kopfLage) return; kopfLage = lage;
  kopf.classList.toggle('ueber-film', lage !== 'hell'); kopf.classList.toggle('film-geht', lage === 'glas');
}
let lastAmbient = 0;
function place() { if (coreAt) { star.style.left = `${clamp01(coreAt[0]) * 100}%`; star.style.top = `${clamp01(coreAt[1]) * 100}%`; } } // der Kreis wächst aus dem Kern
painters.push((now) => {
  if (STATISCH || !canvasAn || document.hidden || !sky) return;
  if (STILL) { if (sceneDirty) { drawScene(ansicht(0), 0); sceneDirty = false; snap(cv); place(); } return; }
  if (sceneDirty || now - lastAmbient > 32) { drawScene(ansicht(sS.v), now); sceneDirty = false; lastAmbient = now; place(); }
});

/* ── Wege: Überspringen, Etagenwahl, Szenen anfahren, Gastwunsch, Newsletter ── */
function markeSetzen() { try { localStorage.setItem('make-fahrt', '1'); } catch (_) { /* siehe oben */ } }
function ueberspringen(e) {
  if (e) e.preventDefault();
  markeSetzen(); fahrtAus(); cssRasten(false);
  scrollTo({ top: kurzY(), behavior: 'auto' });
}
skip.addEventListener('click', ueberspringen);
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return; // ein offener Dialog schließt zuerst
  if (inFahrt && !STATISCH && !STILL) ueberspringen(e);
});
function zu(dlg) { if (dlg.open) dlg.close(); }
for (const dlg of [wahl, gast]) { // Klick auf den dunklen Rand schließt
  dlg.addEventListener('click', (e) => { if (e.target === dlg) zu(dlg); });
}
$('#wahlZu').addEventListener('click', () => zu(wahl));
$('#gastZu').addEventListener('click', () => zu(gast));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#szene-"]'); if (a) {
    const i = szeneNr(a.getAttribute('href').slice(7)); if (i < 0) return;
    e.preventDefault(); if (a.closest('dialog')) zu(a.closest('dialog')); szeneZu(i); return;
  }
  const b = e.target.closest('[data-aktion]'); if (!b) return;
  const w = b.dataset.aktion;
  if (w === 'etagenwahl') { if (!wahl.open) wahl.showModal(); }
  else if (w === 'weiter') szeneZu(Math.max(0, aktiv) + 1);
  else if (w === 'gast') { if (!gast.open) gast.showModal(); }
});
/* Tasten bleiben Schritte: Pfeil runter/hoch, Bild ab/auf und die Leertaste (mit Umschalt zurück) fahren genau eine Szene, Pos1 an den Anfang, Ende ans Seitenende.
   Nicht in einem Formularfeld, nicht bei offenem Dialog oder Menü. Nach der Fahrt gehören die Tasten wieder dem Browser. */
addEventListener('keydown', (e) => {
  if (STATISCH || STILL || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, vor = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey), zurueck = k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey);
  if (!vor && !zurueck && k !== 'Home' && k !== 'End') return;
  if (gesperrt() || e.target.closest?.('input, textarea, select, [contenteditable]') || (k === ' ' && e.target.closest?.('button, a, summary'))) return;
  const y = scrollY, oben = spurTop(), ende = kurzY();
  if (k === 'End') { e.preventDefault(); fahrtAus(); cssRasten(false); regung(true); scrollTo(0, root.scrollHeight); return; } // ans Ende der Seite, nicht nur ans Ende der Fahrt
  if (y > ende + 1 || (y >= ende - 1 && !zurueck) || y < oben - 1) return; // außerhalb der Fahrt: ganz normal
  e.preventDefault(); regung(true);
  if (k === 'Home') { szeneZu(0, false, 450, easeOutCubic); return; }
  if (e.repeat && fahrt && (performance.now() - fahrt.t0) / fahrt.dauer < 0.7) return; // gehaltene Taste: Szene für Szene, nicht im Flug durch alle
  const s = (y - oben) / SZL;
  const ziel = fahrt && fahrt.ziel != null ? fahrt.ziel + (vor ? 1 : -1) : s > N - 1 + 0.02 ? (vor ? N : N - 1) : vor ? Math.floor(s + 0.02) + 1 : Math.ceil(s - 0.02) - 1;
  szeneZu(Math.max(0, Math.min(N, ziel)), false, 450, easeOutCubic);
});
/* Formulare der Fahrt senden direkt an die Anwendung (gleiche Herkunft, fetch). Die Anwendung nimmt ein Formular nur mit einem signierten Stempel an
   (mindestens 3 Sekunden alt, höchstens 2 Stunden): Der Stempel kommt per GET, beim ersten Fokus bzw. beim Öffnen. Antwortet die Anwendung nicht
   (offline, lokal ohne Anwendung, Weg ausgeschaltet), bleibt der bisherige Weg als Rückfall. Keine Eingaben werden im Browser gespeichert. */
const MAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const STEMPEL_MIN_MS = 3500, STEMPEL_MAX_MS = 90 * 60 * 1000;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Holt (bei Bedarf neu) die Angaben einer Schnittstelle; liefert die Antwort oder null, wenn sie nicht antwortet bzw. aus ist. */
function stempelHolen(url) {
  let stand = null, laufend = null;
  const holen = () => (laufend ||= fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => { stand = j && j.ok && j.aktiv && j.stempel ? { ...j, seit: Date.now() } : null; return stand; })
    .catch(() => { stand = null; return null; }).finally(() => { laufend = null; }));
  return {
    /** Gültigen Stand liefern (frisch holen, wenn keiner da oder zu alt). */
    async bereit() { if (!stand || Date.now() - stand.seit > STEMPEL_MAX_MS) await holen(); return stand; },
    /** Wartet, bis der Stempel alt genug ist. */
    async reif() { const d = STEMPEL_MIN_MS - (Date.now() - (stand ? stand.seit : 0)); if (d > 0) await pause(d); },
  };
}
async function jsonSenden(url, body) {
  const r = await fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  return { r, j: await r.json().catch(() => null) };
}

/* Gast vorschlagen (Etage 5): senden an /api/anfrage mit dem Anlass „podcast-gast“. Keine Kontaktdaten der vorgeschlagenen Person.
   Rückfall ohne Antwort der Anwendung: die vorbereitete Mail mit den Angaben im Text. */
const gastForm = $('#gastForm'), kennt = () => gastForm.elements.namedItem('kennt').value;
const gastApi = stempelHolen('/api/anfrage');
gast.addEventListener('toggle', () => { if (gast.open) gastApi.bereit(); });
gastForm.addEventListener('focusin', () => { gastApi.bereit(); }, { once: true });
for (const r of gastForm.elements.namedItem('kennt')) r.addEventListener('change', () => { $('#gastHinweis').hidden = kennt() !== 'ja'; });
gastForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = (n) => gastForm.elements.namedItem(n).value.trim(), meldung = $('.gast-meldung', gastForm), knopf = $('button[type="submit"]', gastForm);
  for (const n of ['name', 'email', 'gast', 'warum']) gastForm.elements.namedItem(n).removeAttribute('aria-invalid');
  const fehlt = ['name', 'gast', 'warum'].find((n) => !f(n)) || (MAIL_OK.test(f('email')) ? null : 'email');
  if (fehlt) { const el = gastForm.elements.namedItem(fehlt); el.setAttribute('aria-invalid', 'true'); el.focus(); meldung.textContent = 'Bitte fülle alle Felder aus (mit gültiger E-Mail-Adresse).'; return; }
  const text = `Gast: ${f('gast')}\nWarum er oder sie passt: ${f('warum')}\nIch kenne die Person persönlich: ${kennt() === 'ja' ? 'ja' : 'nein'}`;
  const mailFallback = () => {
    const basis = MAILS[ZIELE['gast-vorschlagen']];
    if (!basis) { meldung.textContent = 'Das Formular ist gerade nicht erreichbar. Bitte versuche es später noch einmal.'; return; }
    meldung.textContent = 'Dein Mailprogramm öffnet sich mit dem Vorschlag. Dort schickst du ihn ab.';
    location.href = `${basis}${basis.includes('?') ? '&' : '?'}body=${encodeURIComponent(`Mein Name: ${f('name')}\nMeine E-Mail: ${f('email')}\n${text}`)}`;
  };
  if (knopf.disabled) return;
  knopf.disabled = true; knopf.setAttribute('aria-busy', 'true'); meldung.textContent = 'Einen Moment …';
  try {
    const st = await gastApi.bereit();
    if (!st) return mailFallback();
    await gastApi.reif();
    const teile = f('name').split(/\s+/), nachname = teile.length > 1 ? teile.pop() : '';
    const { r, j } = await jsonSenden('/api/anfrage', { vorname: teile.join(' '), ...(nachname ? { nachname } : {}), email: f('email'), nachricht: text, anlass: 'podcast-gast', stempel: st.stempel, webseite: '' });
    if (r.ok && j && j.ok) {
      meldung.textContent = 'Danke für deinen Vorschlag. Wir melden uns bei dir.';
      for (const n of ['gast', 'warum']) gastForm.elements.namedItem(n).value = '';
      return;
    }
    if (r.status === 404) return mailFallback();
    meldung.textContent = (j && j.fehler) || 'Das hat leider nicht geklappt. Bitte versuche es gleich noch einmal.';
  } catch (_) { meldung.textContent = 'Keine Verbindung. Bitte prüfe dein Netz und versuche es noch einmal.'; }
  finally { knopf.disabled = false; knopf.removeAttribute('aria-busy'); }
});
/* Newsletter (Etage 5): beim ersten Fokus holt das Formular Stempel, Fassung und Wortlaut der Einwilligung aus der Anwendung und zeigt den Wortlaut samt
   Häkchen. Gesendet wird mit E-Mail, Einwilligung, Fassung, Stempel und der Themenwahl; die Anwendung schickt die Bestätigungsmail (Double-Opt-in).
   Rückfall: die Anmeldeseite der Anwendung (/newsletter). */
const nl = $('#newsletter');
if (nl) {
  const nlApi = stempelHolen('/api/newsletter'), meldung = $('.nl-meldung', nl), einw = $('[data-einw]', nl), knopf = $('button[type="submit"]', nl);
  const zeige = async () => {
    const st = await nlApi.bereit();
    if (st && st.wortlaut && einw.hidden) { $('[data-wortlaut]', einw).textContent = st.wortlaut; einw.hidden = false; }
    return st;
  };
  nl.addEventListener('focusin', zeige, { once: true });
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); zeige(); } }, { rootMargin: '40% 0px' }); io.observe(nl); }
  nl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feld = nl.elements.namedItem('email'), mail = feld.value.trim(), haken = nl.elements.namedItem('einwilligung');
    feld.removeAttribute('aria-invalid'); haken.removeAttribute('aria-invalid');
    if (!MAIL_OK.test(mail)) { feld.setAttribute('aria-invalid', 'true'); feld.focus(); meldung.textContent = 'Bitte gib eine gültige E-Mail-Adresse an.'; return; }
    if (knopf.disabled) return;
    knopf.disabled = true; knopf.setAttribute('aria-busy', 'true'); meldung.textContent = 'Einen Moment …';
    try {
      const st = await zeige();
      if (!st) { meldung.textContent = 'Die Anmeldung läuft gerade über die Seite unseres Newsletters. Du wirst weitergeleitet.'; await pause(1200); location.assign(ZIELE.newsletter); return; }
      if (!haken.checked) { haken.setAttribute('aria-invalid', 'true'); haken.focus(); meldung.textContent = 'Bitte setze das Häkchen: Ohne deine Einwilligung können wir dir den Newsletter nicht schicken.'; return; }
      await nlApi.reif();
      const themen = [...nl.querySelectorAll('input[name="wahl"]:checked')].map((x) => x.value);
      const { r, j } = await jsonSenden('/api/newsletter', { aktion: 'anmelden', email: mail, themen, einwilligung: true, fassung: st.fassung, stempel: st.stempel, webseite: nl.elements.namedItem('webseite').value });
      if (r.ok && j && j.ok) { meldung.textContent = j.text || 'Fast geschafft: Bitte bestätige deine Anmeldung über den Link in der E-Mail, die wir dir geschickt haben.'; feld.value = ''; haken.checked = false; return; }
      if (r.status === 404) { meldung.textContent = 'Die Anmeldung ist gerade nicht erreichbar. Du kannst es später noch einmal versuchen.'; return; }
      if (r.status === 409) { await nlApi.bereit(); }
      meldung.textContent = (j && j.fehler) || 'Das hat leider nicht geklappt. Bitte versuche es gleich noch einmal.';
    } catch (_) { meldung.textContent = 'Keine Verbindung. Bitte prüfe dein Netz und versuche es noch einmal.'; }
    finally { knopf.disabled = false; knopf.removeAttribute('aria-busy'); }
  });
}

/* ── „Weniger Bewegung“: jede Szene bekommt ihr ruhiges Bild, wenn sie ins Bild kommt (ein Standbild der Zeichnung) ── */
function bilderMalen() {
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); malen(panels.indexOf(en.target)); } }), { rootMargin: '60% 0px' });
  const ruhig = []; let laeuft = false;
  function malen(i) { ruhig.push(i); if (!laeuft) { laeuft = true; setTimeout(abarbeiten, 0); } }
  function abarbeiten() {
    const i = ruhig.shift(); if (i === undefined) { laeuft = false; return; }
    const v = ansicht(i); drawScene(v, 0); panels[i].style.backgroundImage = `url(${cv.toDataURL('image/jpeg', 0.8)})`; setTimeout(abarbeiten, 20);
  }
  panels.forEach((el) => io.observe(el));
}

/* ── Start ── */
if (!STILL && !STATISCH) { /* die Höhe der Spur steht in haus.css */ }
sizeScene(); zeigeSzene(0); sceneDirty = true;
if (!STATISCH && !STILL) { // Einflug: die Kamera gleitet heran, statt zu stehen
  new Spring(0, EINFLUG, (v) => { introK = v; sceneDirty = true; }).set(1);
}
let rz = 0;
let rzHalt = -1;
addEventListener('resize', () => {
  if (!rz) rzHalt = fahrt ? -1 : haltSzene; // welche Szene stand im Bild, bevor sich die Größe geändert hat
  cancelAnimationFrame(rz); rz = requestAnimationFrame(() => {
    rz = 0; messen(); sizeScene(); zeigeSzene(aktiv); if (STATISCH) panels.forEach((el) => { el.style.backgroundImage = ''; });
    if (STATISCH || STILL) return;
    if (fahrt && fahrt.ziel != null) fahrt.y = fahrt.ziel >= N ? kurzY() : szeneY(fahrt.ziel);            // eine laufende Fahrt behält ihr Ziel
    else if (rzHalt >= 0 && !cssAn && Math.abs(scrollY - szeneY(rzHalt)) >= 1) { eigenY = szeneY(rzHalt); eigenOffen = true; scrollTo(0, eigenY); } // die Szene bleibt stehen (ohne Fahrt)
  });
});
requestAnimationFrame(frame);

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
(async () => {
  await withTimeout(Promise.all(['400 20px', '500 40px', '600 20px'].map((f) => document.fonts.load(`${f} "Schibsted Grotesk"`))).catch(() => {}), 4000);
  buildTextures(); sceneDirty = true;
  // Sprung an eine Szene: ?szene=7, ?szene=e2 oder ?etage=eg|tresen|1|2|3|4|5|dach (Adresse) bzw. #szene-e2
  const ETAGE = { eg: 'eg', tresen: 'tresen', 1: 'e1', 2: 'e2', 3: 'e3a', 4: 'e4', 5: 'e5a', dach: 'dach' };
  const ziel = QUERY.get('szene') || ETAGE[(QUERY.get('etage') || '').toLowerCase()] || (location.hash.startsWith('#szene-') ? location.hash.slice(7) : '');
  if (ziel && !STILL && !STATISCH) { const i = szeneNr(ziel); if (i >= 0) { messen(); fahrtAus(); scrollTo(0, szeneY(i)); sS.set(i, { immediate: true }); } }
  if (STATISCH) bilderMalen();
  root.dataset.bereit = '1';
})();
} // Ende: nur ohne Rückkehrer-Marke
