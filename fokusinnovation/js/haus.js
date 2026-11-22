if (!document.documentElement.classList.contains('fahrt-aus')) {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const QUERY = new URLSearchParams(location.search);
const STILL = QUERY.has('p') ? { p: +QUERY.get('p') } : null;
if (STILL) root.classList.add('still-s');
const WENIGER = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (WENIGER && !STILL) root.classList.add('statisch');
const STATISCH = root.classList.contains('statisch');
let FEHLER = 0;
function fehler(m) { FEHLER++; root.dataset.fehler = String(FEHLER); if (!STILL) return; let b = document.querySelector('.fail'); if (!b) { b = document.createElement('div'); b.className = 'fail'; document.body.append(b); } b.textContent = `${FEHLER} Fehler · ${m}`; }
addEventListener('error', (e) => fehler(e.message || 'Fehler'));
addEventListener('unhandledrejection', (e) => fehler(String(e.reason)));
root.dataset.fehler = '0';
const reduce = WENIGER || STILL !== null;
const DPR_HOECHSTENS = [1.5, 1], KANTE_HOECHSTENS = [1920, 1600], SCHUTZ_MS = 34, SCHUTZ_BILDER = 20, SCHUTZ_FENSTER = 90, TAKT_RUHE = [32, 50];
let STUFE = (() => { try { const q = QUERY.get('stufe'); if (q === '0' || q === '1') { sessionStorage.setItem('make-haus-stufe', q); return +q; } return sessionStorage.getItem('make-haus-stufe') === '1' ? 1 : 0; } catch (e) { return 0; } })();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (p, [a, b]) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutSine = (t) => (1 - Math.cos(t * Math.PI)) / 2;
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
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
const FOLGE = { tension: 700, friction: 53 };
const EINFLUG = { duration: 3200, easing: easeOutQuint };
const readers = [], painters = [];
let lastT = performance.now();
function frame(now) {
  const real = Math.min(1000, Math.max(0, now - lastT)), dt = Math.min(64, real); lastT = now;
  for (const f of readers) { try { f(now, dt); } catch (e) { console.error(e); fehler(e.message); } }
  for (const s of [...live]) { try { s.step(dt, real); } catch (e) { console.error(e); fehler(e.message); live.delete(s); } }
  for (const f of painters) { try { f(now, dt); } catch (e) { console.error(e); fehler(e.message); } }
  requestAnimationFrame(frame);
}
const HALTS = 7, FLOOR_LEN = 0.077, TOUR_START = 0.27, TRAVEL_PART = 0.38;
const DACH_HALT = 6;
const MARKEN_HALTE = [0, 1, 2, 3, 4];
const HERO = [0, 0.19], TURN_END = 0.235;
const THREAD = [0.832, 0.864], FADEN_OUT = [0.892, 0.906], SPOTS = [0.897, 0.93];
const floorRange = (i) => [TOUR_START + i * FLOOR_LEN, TOUR_START + (i + 1) * FLOOR_LEN];
const wide = matchMedia('(min-width: 768px)');
const cv = $('#seq'), ctxBild = cv.getContext('2d');
let ctx = ctxBild;
const S = { w: 0, h: 0, f: 0, cx: 0, cy: 0, narrow: false, css: 1 };
const cam = { x: 0, y: 1.75, z: -46 };
const NEAR = 0.22;
const FH = 3.6, TOP = 40, GROUND = -TOP * FH, TXL = -6.4, TXR = 10.4, RD = 16;
const baseOf = (n) => (n - TOP) * FH;
const SHAFT = { x0: 2.3, x1: 3.7, x: 3.0, z: 0.9 };
const PED = { x: 0.2, z: 4.4, h: 1.05 };
const STOOL = { x: -2.45, z: 7.55, h: 0.74 };
const INN_SOCKEL = [1.42, 1.78, 8.5, 8.88], PR_SOCKEL = [-0.42, -0.06, 8.5, 8.88];
const STAGE = { x0: -4.6, x1: 4.6, y: 0.5, z0: 6.4, z1: 11, zc: 8.6 }, TRUSS = { x: 4.9, z: 10.2, h: 5.4 };
const DT = [[-3.5, 1.9], [-4.3, 5.5]];
const AKZ = { studios: '#FF5A1F', revenue: '#7DB7FF', lav: '#A78BFA' };
const FLOORS = [
  { n: 0, id: 'eg', key: 'strasse', base: GROUND, y1: 6.9, eye: 2.7, z1: 10, solid: true, innen: true },
  { n: 8, id: 'e1', key: 'studios', akz: AKZ.studios, innen: true, base: baseOf(8), y1: 3.6, eye: 1.6, solid: true, dark: true, glas: true },
  { n: 15, id: 'e2', key: 'revenue', akz: AKZ.revenue, innen: true, base: baseOf(15), y1: 3.6, eye: 1.6 },
  { n: 21, id: 'e3', key: 'innovation', innen: true, base: baseOf(21), y1: 3.6, eye: 1.6 },
  { n: 28, id: 'e4', key: 'pr', innen: true, base: baseOf(28), y1: 3.6, eye: 1.6 },
  { n: 35, id: 'e5', key: 'podcast', zu: true, base: baseOf(35), y1: 3.6, eye: 1.6, solid: true, dark: true },
  { n: 40, id: 'dach', key: 'dach', roof: true, base: 0, y1: 6, eye: 3.0 },
];
const OPEN = new Set([0, 1, 8, 15, 21, 28, 35]);
const LEVELS = [0.12, 0.28, 0.42, 0.56, 0.7, 0.86, 1];
const LAV = '167,139,250', LAVH = '205,192,255', WARM = '255,236,214';
let sceneDirty = true;
const MARKE = {
  strasse: { i: 0, rgb: WARM, tief: '120,100,80', licht: 0.001, breite: 7.4, breiteN: 6.6, zx: [1.3, 1.45], z0: 1, kern: [[PED.x, PED.h, PED.z], [PED.x, PED.h, PED.z]], kernG: 0.72 },
  studios: { i: 1, rgb: '255,90,31', tief: '255,116,54', licht: 0.1, schein: 0.03, breite: 7.0, breiteN: 6.3, zx: [0.3], z0: 0, kern: [[STOOL.x, STOOL.h, STOOL.z]], kernG: 0.76 },
  revenue: { i: 2, rgb: '125,183,255', tief: '23,70,158', breite: 7.9, breiteN: 7.0, zx: [0.05], z0: 0, kern: [[0.45, 1.0, 8.6]], kernG: 0.8 },
  innovation: { i: 3, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, breite: 7.9, breiteN: 7.8, zx: [0.05], z0: 0, kern: [[INN_SOCKEL[0] / 2 + INN_SOCKEL[1] / 2, 1.0, INN_SOCKEL[2] / 2 + INN_SOCKEL[3] / 2]], kernG: 0.62 },
  pr: { i: 4, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, breite: 7.9, breiteN: 7.0, zx: [0.05], z0: 0, kern: [[PR_SOCKEL[0] / 2 + PR_SOCKEL[1] / 2, 1.0, PR_SOCKEL[2] / 2 + PR_SOCKEL[3] / 2]], kernG: 0.6 },
  dach: { i: 6, rgb: '167,139,250', tief: '95,75,182', licht: 0.3, aussen: true, zx: [-0.6, -0.6], z0: 0, zz: [-8.9, -8.6], kern: [[0, 0, 0]] },
};
for (const key in MARKE) { MARKE[key].key = key; MARKE[key].zone = { v: MARKE[key].z0 }; }
const zwischen = (arr, v) => { if (arr.length < 2) return [arr[0], arr[0], 0]; const i = Math.max(0, Math.min(arr.length - 2, Math.floor(v))); return [arr[i], arr[i + 1], clamp01(v - i)]; };
const zoneX = (key) => { const [a, b, t] = zwischen(MARKE[key].zx, MARKE[key].zone.v); return lerp(a, b, t); };
const kernplatz = (key, R) => { const [A, B, t] = zwischen(MARKE[key].kern, MARKE[key].zone.v); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t) + R + Math.sin(t * Math.PI) * 0.45, lerp(A[2], B[2], t)]; };
const ZIELE = {"erstgespraech":"/erstgespraech","check":"/check?thema=sichtbarkeit-vertrieb&q=haus","innovations-check":"/check?q=haus","workshops":"/innovation/#angebote","sichtbarkeit":"/sichtbarkeit/","pr":"/sichtbarkeit/pr-kommunikation/","events":"/events/","vertrieb":"/vertrieb/","einladung":"/anfrage?anlass=events","gast-vorschlagen":"/anfrage?anlass=podcast-gast","studios-seite":"https://makestudios.de/","podcast":"/podcast/","newsletter":"/newsletter","innovation":"/innovation/"};
let sky = null, skyHy = 0, CITY = null, TEX = {}, oy = 0, beacon = 0, spots = 0, marks = 0, coreAt = null;
const FONT = (w, s) => `${w} ${s}px "Schibsted Grotesk", system-ui, sans-serif`;
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (a, b) => { let t = (Math.imul(a + 77, 374761393) + Math.imul(b + 13, 668265263)) | 0; t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
const winCol = (r, a) => (r < 0.55 ? `rgba(255,${(228 + r * 30) | 0},${(196 + r * 70) | 0},${a})` : `rgba(${(186 + r * 40) | 0},${(172 + r * 40) | 0},255,${a})`);
let TZ = 1;
const TAG = {
  sonneX: 0.86,
  himmel: [
    { tz: 0, v: [[0, '#2a69c2'], [0.45, '#5592da'], [0.75, '#8fbdea'], [0.92, '#c3dcf2'], [1, '#e6ebec']], sonne: 0.4, schein: ['255,250,236', 0.5, 0.34], wolken: ['255,255,255', 0.5], boden: ['#cddbea', '#9fb2c8', '#74869b'] },
    { tz: 0.34, v: [[0, '#2166c6'], [0.5, '#4c92de'], [0.8, '#90c1ef'], [1, '#d2e5f6']], sonne: 0.78, schein: ['255,255,250', 0.45, 0.3], wolken: ['255,255,255', 0.56], boden: ['#c6d8ea', '#98adc6', '#6f8298'] },
    { tz: 0.6, v: [[0, '#3565b4'], [0.42, '#7c9bd0'], [0.68, '#d9c6b6'], [0.86, '#f4cc98'], [1, '#ffd79c']], sonne: 0.21, schein: ['255,216,150', 0.72, 0.5], wolken: ['255,232,204', 0.5], boden: ['#e6c4a0', '#a9937f', '#74685f'] },
    { tz: 0.8, v: [[0, '#1b2759'], [0.34, '#463c82'], [0.56, '#a2547c'], [0.74, '#e5704e'], [0.89, '#ffa248'], [1, '#ffcc78']], sonne: 0.045, schein: ['255,170,92', 0.85, 0.6], wolken: ['255,150,112', 0.5], boden: ['#c5745a', '#6b4254', '#2c2238'] },
    { tz: 0.9, v: [[0, '#090d26'], [0.4, '#1b1d52'], [0.68, '#47307c'], [0.87, '#86478a'], [1, '#c4667a']], sonne: -0.07, schein: ['255,124,118', 0.4, 0.5], wolken: ['168,120,180', 0.26], boden: ['#5a3a72', '#2a2148', '#100f20'] },
    { tz: 1, v: [[0, '#050609'], [0.3, '#0B0E10'], [0.55, '#110f22'], [0.74, '#1c154a'], [0.87, '#35228a'], [0.95, '#5a3ed0'], [1, '#8566ec']], sonne: -0.2, schein: ['167,139,250', 0.42, 0.6], wolken: ['196,181,253', 0.13], boden: ['#3c2a86', '#14122c', '#07080b'] },
  ],
  stadt: [
    { tz: 0, c: ['#a9bcd3', '#97abc4', '#8499b4', '#7288a4', '#617893', '#536a84', '#475c74'], fern: ['226,236,247', 0.34], nah: ['176,196,218', 0.2] },
    { tz: 0.5, c: ['#a6b9d1', '#93a8c2', '#8095b1', '#6e84a0', '#5d738f', '#4f657e', '#43576e'], fern: ['224,234,246', 0.32], nah: ['170,190,214', 0.2] },
    { tz: 0.64, c: ['#d7b79c', '#bc9c8a', '#a08477', '#856e69', '#6d5b5c', '#584a50', '#473c45'], fern: ['255,214,160', 0.36], nah: ['214,160,120', 0.2] },
    { tz: 0.8, c: ['#c7805e', '#a26152', '#7f4a49', '#5f3840', '#462a38', '#32202f', '#231726'], fern: ['255,160,96', 0.36], nah: ['150,70,70', 0.18] },
    { tz: 0.9, c: ['#6c4f98', '#523f82', '#3d3068', '#2c2450', '#201b3c', '#17142b', '#100f1f'], fern: ['160,96,170', 0.24], nah: ['40,26,70', 0.18] },
    { tz: 1, c: ['#4a379f', '#3a2c80', '#2b2262', '#1f1a48', '#161432', '#0f0e22', '#0a0a16'], fern: ['110,84,205', 0.2], nah: ['20,16,44', 0.16] },
  ],
  licht: [
    { tz: 0, innen: 1, aussen: 1, ton: [1, 1, 1] },
    { tz: 0.45, innen: 1, aussen: 1, ton: [1, 1, 1] },
    { tz: 0.52, innen: 0.92, aussen: 0.9, ton: [1, 0.94, 0.85] },
    { tz: 0.64, innen: 0.66, aussen: 0.7, ton: [1, 0.85, 0.68] },
    { tz: 0.74, innen: 0.2, aussen: 0.36, ton: [0.84, 0.86, 1] },
    { tz: 0.8, innen: 0.14, aussen: 0.3, ton: [1, 0.8, 0.66] },
    { tz: 0.9, innen: 0.03, aussen: 0.1, ton: [0.9, 0.8, 1] },
    { tz: 1, innen: 0, aussen: 0, ton: [1, 1, 1] },
  ],
};
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const stuetze = (liste, tz) => { let i = 0; while (i < liste.length - 2 && tz > liste[i + 1].tz) i++; return [i, clamp01((tz - liste[i].tz) / (liste[i + 1].tz - liste[i].tz))]; };
const mischZ = (a, b, t) => a + (b - a) * t;
const TAG_WERTE = new Map();
function tagWerte(tz = TZ) {
  const q = Math.round(clamp01(tz) * 100); let w = TAG_WERTE.get(q); if (w) return w;
  const z = q / 100, [i, t] = stuetze(TAG.stadt, z), A = TAG.stadt[i], B = TAG.stadt[i + 1], [j, u] = stuetze(TAG.licht, z), LA = TAG.licht[j], LB = TAG.licht[j + 1], [k, s] = stuetze(TAG.himmel, z), HA = TAG.himmel[k], HB = TAG.himmel[k + 1];
  const rgb = (x, y, m) => { const p = hexRgb(x), r = hexRgb(y); return `rgb(${Math.round(mischZ(p[0], r[0], m))},${Math.round(mischZ(p[1], r[1], m))},${Math.round(mischZ(p[2], r[2], m))})`; };
  const tri = (x, y, m) => { const p = x.split(',').map(Number), r = y.split(',').map(Number); return `${Math.round(mischZ(p[0], r[0], m))},${Math.round(mischZ(p[1], r[1], m))},${Math.round(mischZ(p[2], r[2], m))}`; };
  w = {
    stadt: A.c.map((c, n) => rgb(c, B.c[n], t)), fern: [tri(A.fern[0], B.fern[0], t), mischZ(A.fern[1], B.fern[1], t)], nah: [tri(A.nah[0], B.nah[0], t), mischZ(A.nah[1], B.nah[1], t)],
    innen: mischZ(LA.innen, LB.innen, u), aussen: mischZ(LA.aussen, LB.aussen, u), ton: [0, 1, 2].map((n) => mischZ(LA.ton[n], LB.ton[n], u)),
    sonne: mischZ(HA.sonne, HB.sonne, s), horizont: tri(hexRgb(HA.v[HA.v.length - 1][1]).join(','), hexRgb(HB.v[HB.v.length - 1][1]).join(','), s),
    nacht: smooth((z - 0.7) / 0.24),
    sterne: smooth((z - 0.86) / 0.12),
  };
  TAG_WERTE.set(q, w); return w;
}
let SKY = [], STERNE = null, SONNE = null, MOND = null, skyH = 0;
function buildSky(w, h, hy, H) {
  const c = document.createElement('canvas'), q = 3; c.width = Math.ceil(w / q); c.height = Math.ceil(h / q);
  const g = c.getContext('2d'), R = mulberry(7), cw = c.width, chy = hy / q, u = cw / 640;
  const sk = g.createLinearGradient(0, 0, 0, chy); for (const [o, k] of H.v) sk.addColorStop(o, k);
  g.fillStyle = sk; g.fillRect(0, 0, cw, chy + 1);
  const sx = cw * TAG.sonneX, sy = chy * (1 - Math.max(-0.02, H.sonne)), rr = cw * H.schein[2], rg = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
  rg.addColorStop(0, `rgba(${H.schein[0]},${H.schein[1]})`); rg.addColorStop(0.12, `rgba(${H.schein[0]},${H.schein[1] * 0.6})`); rg.addColorStop(0.4, `rgba(${H.schein[0]},${H.schein[1] * 0.2})`); rg.addColorStop(1, `rgba(${H.schein[0]},0)`);
  g.globalCompositeOperation = 'screen'; g.fillStyle = rg; g.fillRect(0, 0, cw, chy); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) {
    const y = chy * (0.5 + R() * 0.42), x = R() * cw, rw = (90 + R() * 190) * u, rh = (2 + R() * 4.5) * u, a = H.wolken[1] * (0.45 + R() * 0.55);
    const cg = g.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, `rgba(${H.wolken[0]},${a})`); cg.addColorStop(0.6, `rgba(${H.wolken[0]},${a * 0.45})`); cg.addColorStop(1, `rgba(${H.wolken[0]},0)`);
    g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = cg; g.beginPath(); g.arc(x, y, rw, 0, 7); g.fill(); g.restore();
  }
  for (const [wx, wy, wb] of [[0.67, 0.63, 92], [0.3, 0.3, 70], [0.8, 0.8, 58], [0.08, 0.44, 60]]) {
    const x = cw * wx, y = chy * wy, b = wb * u, a = H.wolken[1] * 1.25;
    g.save(); g.beginPath(); g.rect(x - b * 1.6, y - b, b * 3.2, b); g.clip();
    for (const [px, pr] of [[-0.95, 0.2], [-0.55, 0.32], [-0.08, 0.44], [0.42, 0.34], [0.86, 0.22], [0.15, 0.24]]) { const cx = x + px * b, r = pr * b, cg = g.createRadialGradient(cx, y - r * 0.2, r * 0.2, cx, y, r); cg.addColorStop(0, `rgba(${H.wolken[0]},${a})`); cg.addColorStop(0.72, `rgba(${H.wolken[0]},${a * 0.8})`); cg.addColorStop(1, `rgba(${H.wolken[0]},0)`); g.fillStyle = cg; g.beginPath(); g.arc(cx, y, r, 0, 7); g.fill(); }
    g.restore();
    const sg = g.createLinearGradient(0, y - 2 * u, 0, y + 5 * u); sg.addColorStop(0, `rgba(${H.wolken[0]},${a * 0.5})`); sg.addColorStop(1, `rgba(${H.wolken[0]},0)`); g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, b * 1.1, 5 * u, 0, 0, 7); g.fill();
  }
  const gr = g.createLinearGradient(0, chy, 0, c.height); gr.addColorStop(0, H.boden[0]); gr.addColorStop(0.05, H.boden[1]); gr.addColorStop(0.4, H.boden[2]); gr.addColorStop(1, H.boden[2]);
  g.fillStyle = gr; g.fillRect(0, chy, cw, c.height - chy);
  return c;
}
function buildHimmel(w, h, hy) {
  skyH = h; SKY = TAG.himmel.map((H) => buildSky(w, h, hy, H));
  { const c = document.createElement('canvas'); c.width = w; c.height = Math.ceil(hy * 0.66); const g = c.getContext('2d'), R = mulberry(7), u = w / 1920;
    for (let i = 0; i < 150; i++) { const x = R() * w, y = R() * hy * 0.62; g.fillStyle = `rgba(232,228,255,${(0.14 + R() * 0.55) * (1 - y / (hy * 0.62))})`; const s = (1 + R() * 1.3) * u; g.fillRect(x, y, s, s); } STERNE = c; }
  const scheibe = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, k] of stops) r.addColorStop(o, k); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c; };
  SONNE = [scheibe([[0, 'rgba(255,255,248,1)'], [0.3, 'rgba(255,253,236,1)'], [0.36, 'rgba(255,246,214,.55)'], [0.6, 'rgba(255,240,200,.16)'], [1, 'rgba(255,240,200,0)']]),
    scheibe([[0, 'rgba(255,236,170,1)'], [0.3, 'rgba(255,196,96,1)'], [0.36, 'rgba(255,150,70,.6)'], [0.62, 'rgba(255,120,60,.18)'], [1, 'rgba(255,110,60,0)']])];
  MOND = scheibe([[0, 'rgba(244,240,255,1)'], [0.2, 'rgba(236,230,255,1)'], [0.24, 'rgba(214,204,255,.3)'], [0.6, 'rgba(190,176,255,.07)'], [1, 'rgba(190,176,255,0)']]);
}
function himmel() {
  const y = Math.round(S.cy - skyHy), [i, t] = stuetze(TAG.himmel, TZ), W = tagWerte();
  ctx.drawImage(SKY[i], 0, y, S.w, skyH);
  if (t > 0.004) { ctx.globalAlpha = t; ctx.drawImage(SKY[i + 1], 0, y, S.w, skyH); ctx.globalAlpha = 1; }
  if (W.sterne > 0.01) { ctx.globalAlpha = W.sterne; ctx.drawImage(STERNE, 0, y); ctx.globalAlpha = 1; }
  if (W.sonne > -0.09) {
    const tief = smooth((0.3 - W.sonne) / 0.24), r = S.w * (0.05 + 0.035 * tief), sx = S.w * TAG.sonneX, sy = S.cy - W.sonne * skyHy;
    if (tief < 0.99) { ctx.globalAlpha = 1 - tief; ctx.drawImage(SONNE[0], sx - r, sy - r, 2 * r, 2 * r); }
    if (tief > 0.01) { ctx.globalAlpha = tief; ctx.drawImage(SONNE[1], sx - r, sy - r, 2 * r, 2 * r); }
    ctx.globalAlpha = 1;
  }
  if (W.sterne > 0.05) { const r = S.w * 0.026; ctx.globalAlpha = W.sterne; ctx.drawImage(MOND, S.w * 0.905 - r, S.cy - 0.6 * skyHy - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
}
const TON_KLASSEN = {
  schale: { a: 0.6, b: 0.95, satt: 0.38, aus: 'innen', t: [1, 1, 1] },
  ding: { a: 0.22, b: 1.05, satt: 0.8, aus: 'innen', t: [1, 1, 1] },
  turm: { a: 0.4, b: 1.0, satt: 0.55, aus: 'aussen', t: [0.9, 0.97, 1.08] },
  strasse: { a: 0.36, b: 0.9, satt: 0.4, aus: 'aussen', t: [1, 1, 1] },
  dach: { a: 0.34, b: 1.0, satt: 0.6, aus: 'aussen', t: [1, 1, 1] },
};
const TON = { kl: null, h: 0, w: null, map: null, alle: new Map() };
function tonAn(name) {
  const W = tagWerte(), K = TON_KLASSEN[name], h = W[K.aus]; if (h <= 0.004) { TON.kl = null; return; }
  const key = `${name}|${Math.round(clamp01(TZ) * 100)}`; let m = TON.alle.get(key);
  if (!m) { if (TON.alle.size > 90) TON.alle.clear(); m = new Map(); TON.alle.set(key, m); }
  TON.kl = K; TON.h = h; TON.w = [W.ton[0] * K.t[0], W.ton[1] * K.t[1], W.ton[2] * K.t[2]]; TON.map = m;
}
const tonAus = () => { TON.kl = null; };
const FARBE_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
function tonRechne(v) {
  let r, g, b, a = 1;
  if (v[0] === '#') { if (v.length === 7) { r = parseInt(v.slice(1, 3), 16); g = parseInt(v.slice(3, 5), 16); b = parseInt(v.slice(5, 7), 16); } else if (v.length === 4) { r = parseInt(v[1] + v[1], 16); g = parseInt(v[2] + v[2], 16); b = parseInt(v[3] + v[3], 16); } else return [v, v]; }
  else { const m = FARBE_RE.exec(v); if (!m) return [v, v]; r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] === undefined ? 1 : +m[4]; }
  const K = TON.kl, h = TON.h, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (a < 1) {
    if (mx <= 3) return [v, v];
    if (mx <= 70) { const s = `rgba(${r},${g},${b},${+(a * (1 - 0.72 * h)).toFixed(3)})`; return [s, s]; }
    return [v, `rgba(${r},${g},${b},${+(a * (1 - 0.78 * h)).toFixed(3)})`];
  }
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255, sat = mx ? (mx - mn) / mx : 0;
  const gew = h * (1 - smooth((sat - 0.5) / 0.3) * smooth((L - 0.22) / 0.25)) * (1 - smooth((L - 0.72) / 0.2));
  if (gew <= 0.004) return [v, v];
  const Lz = Math.min(0.96, L + (K.a + K.b * L - L) * (1 - smooth((L - 0.34) / 0.5))), f = Lz / Math.max(L, 0.012), grau = Lz * 255, sa = K.satt * (0.3 + 0.7 * smooth(L / 0.22));
  const aus = [r, g, b].map((c, n) => { const z = Math.min(255, (grau + (c * f - grau) * sa) * TON.w[n]); return Math.round(c + (z - c) * gew); });
  const s = `rgb(${aus[0]},${aus[1]},${aus[2]})`; return [s, s];
}
function tonFarbe(v, g) {
  let c = TON.map.get(v);
  if (c === undefined) { if (TON.map.size > 2500) TON.map.clear(); c = tonRechne(v); TON.map.set(v, c); }
  return c[0] === c[1] ? c[0] : g.globalCompositeOperation === 'lighter' ? c[1] : c[0];
}
function tonHaken(g) {
  if (g._ton) return g; g._ton = true;
  const Pt = CanvasRenderingContext2D.prototype;
  for (const name of ['fillStyle', 'strokeStyle']) { const d = Object.getOwnPropertyDescriptor(Pt, name); Object.defineProperty(g, name, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, TON.kl && typeof v === 'string' ? tonFarbe(v, this) : v); } }); }
  for (const name of ['createLinearGradient', 'createRadialGradient']) g[name] = function (...a) { const gr = Pt[name].apply(this, a); if (TON.kl) { const add = gr.addColorStop, ziel = this; gr.addColorStop = (o, c) => add.call(gr, o, typeof c === 'string' ? tonFarbe(c, ziel) : c); } return gr; };
  return g;
}
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
    if (L >= 3) b.forEach((q, i) => { q.t = (hash(i, L * 31 + 5) * 4) | 0; const r = hash(i, L * 17 + 3); if (r < 0.5) q.auf = [0.1 + hash(i, L + 61) * 0.4, 0.28 + hash(i, L + 67) * 0.24, 3 + r * 9]; if (r > 0.86) q.mast = [0.2 + hash(i, L + 71) * 0.6, 6 + hash(i, L + 73) * 9]; });
    return { D, b, L };
  });
}
const CITY_PXM = 2.5, CITY_KM = [128, 140], CITY_GESCHOSS = 3.5; let CITY_TEX = null, FEIN_STADT = false;
function buildCityTex() {
  const m = CITY_PXM, tw = Math.round(CITY_KM[0] * m), th = Math.round(CITY_KM[1] * m), c = document.createElement('canvas'); c.width = tw * 4; c.height = th; const g = c.getContext('2d'), G = CITY_GESCHOSS * m;
  const dunkel = (a) => `rgba(10,18,40,${a})`, hell = (a) => `rgba(255,255,255,${a})`, y0 = 2.2 * m;
  for (let v = 0; v < 4; v++) {
    g.save(); g.beginPath(); g.rect(v * tw, 0, tw, th); g.clip(); g.translate(v * tw, 0);
    g.fillStyle = hell(0.2); g.fillRect(0, 0, tw, 1.0 * m); g.fillStyle = dunkel(0.24); g.fillRect(0, 1.0 * m, tw, 0.6 * m);
    if (v === 0) {
      for (let y = y0; y < th; y += G) { g.fillStyle = dunkel(0.3); g.fillRect(0, y, tw, 1.9 * m); g.fillStyle = hell(0.13); g.fillRect(0, y + 1.9 * m, tw, 0.5 * m); }
      g.fillStyle = hell(0.09); for (let x = 0; x < tw; x += 6 * m) g.fillRect(x, y0, 0.6 * m, th);
    } else if (v === 1) {
      for (let y = y0; y < th; y += G) for (let x = 1.0 * m; x < tw; x += 3 * m) { g.fillStyle = dunkel(0.34); g.fillRect(x, y, 1.6 * m, 2.0 * m); g.fillStyle = hell(0.14); g.fillRect(x, y + 2.0 * m, 1.6 * m, 0.4 * m); }
    } else if (v === 2) {
      g.fillStyle = dunkel(0.22); g.fillRect(0, y0, tw, th); g.fillStyle = hell(0.15); for (let x = 0; x < tw; x += 3 * m) g.fillRect(x, y0 - 0.6 * m, 0.8 * m, th);
      g.fillStyle = dunkel(0.2); for (let y = y0 + G; y < th; y += G) g.fillRect(0, y, tw, 0.5 * m);
    } else {
      for (let y = y0, i = 0; y < th; y += G, i++) for (let x = 0, j = 0; x < tw; x += 6 * m, j++) { const r = hash(i, j); g.fillStyle = r < 0.22 ? hell(0.07) : dunkel(0.12 + r * 0.1); g.fillRect(x + 0.4 * m, y, 5.2 * m, 2.9 * m); }
    }
    g.fillStyle = hell(0.1); g.fillRect(0, 0, 0.8 * m, th);
    g.restore();
  }
  return c;
}
function drawCity() {
  const H = cam.y - GROUND, u = S.w / 1920, W = tagWerte(), fn = W.nacht;
  for (const L of CITY) {
    const k = S.f / L.D, baseY = S.cy + H * k, col = W.stadt[L.L], fas = L.L >= 4 && (FEIN_STADT || !(cam.z > -1 && INS.k > 0)), ftw = CITY_TEX.width / 4, fa = 0.45 + 0.55 * (1 - fn);
    for (const b of L.b) {
      const x = S.cx + (b.x - cam.x) * k, w = b.w * k; if (x + w < 0 || x > S.w) continue;
      const top = S.cy - (b.h - H) * k, bot = Math.min(S.h, baseY); if (top > S.h || bot <= top) continue;
      ctx.fillStyle = col; ctx.fillRect(x, top, w + 0.7, bot - top);
      if (fas && w > 12) {
        if (b.auf && top > 0) ctx.fillRect(x + w * b.auf[0], top - b.auf[2] * k, w * b.auf[1], b.auf[2] * k + 1);
        if (b.mast && top > 0 && k > 0.9) ctx.fillRect(x + w * b.mast[0], top - b.mast[1] * k, Math.max(1, 0.5 * k), b.mast[1] * k + 1);
        ctx.globalAlpha = fa; ctx.drawImage(CITY_TEX, b.t * ftw, 0, Math.min(ftw, b.w * CITY_PXM), Math.max(1, Math.min(CITY_TEX.height, ((bot - top) / k) * CITY_PXM)), x, top, w + 0.7, bot - top); ctx.globalAlpha = 1;
      }
      if (fn > 0.02 && b.win.length && w > 6) {
        const s = Math.max(1, Math.min(3.2, w * 0.035));
        for (const [wu, wv, r] of b.win) { const an = (fn - ((r * 7.31) % 1) * 0.82) * 7; if (an <= 0) continue; const wy = top + (L.L >= 3 ? Math.floor((wv * b.h) / CITY_GESCHOSS) * CITY_GESCHOSS + 2.7 : wv * b.h) * k;  if (wy < 0 || wy > bot) continue; ctx.fillStyle = winCol(r, (0.18 + r * 0.45) * Math.min(1, an)); ctx.fillRect(x + wu * w, wy, s, s); }
      }
    }
    const [rgb, a] = L.L < 3 ? W.fern : W.nah, hz = ctx.createLinearGradient(0, S.cy - 40 * u, 0, S.cy + 90 * u);
    hz.addColorStop(0, `rgba(${rgb},0)`); hz.addColorStop(1, `rgba(${rgb},${Math.max(0, a - L.L * 0.02)})`);
    ctx.fillStyle = hz; ctx.fillRect(0, S.cy - 40 * u, S.w, 130 * u);
  }
}
const pale = (a) => `rgba(246,244,240,${a})`;
const TEX_Q = 0.6;
function tex(w, h, seed, draw) { const c = document.createElement('canvas'); c.width = Math.round(w * TEX_Q); c.height = Math.round(h * TEX_Q); const g = c.getContext('2d'); g.scale(TEX_Q, TEX_Q); draw(g, mulberry(seed), (x, y, bw, bh, col, r = bh / 2) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill(); }); return c; }
function pfeil(g, x0, y0, x1, y1, s = 12) { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.moveTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s); g.lineTo(x1, y1); g.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s); g.stroke(); }
function buildTextures() {
  TEX.web = tex(900, 540, 5, (g, R, bar) => {
    g.fillStyle = '#0d0d14'; g.fillRect(0, 0, 900, 540); g.fillStyle = '#191822'; g.fillRect(0, 0, 900, 46);
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.3); g.beginPath(); g.arc(26 + i * 24, 23, 7, 0, 7); g.fill(); }
    bar(40, 78, 96, 16, pale(0.55)); for (let i = 0; i < 4; i++) bar(540 + i * 84, 81, 60, 10, pale(0.24));
    bar(40, 150, 400, 38, pale(0.88), 7); bar(40, 202, 310, 38, pale(0.88), 7); bar(40, 262, 350, 12, pale(0.3)); bar(40, 286, 290, 12, pale(0.3));
    bar(40, 326, 160, 44, AKZ.studios, 7);
    g.fillStyle = pale(0.07); g.beginPath(); g.roundRect(500, 132, 360, 240, 12); g.fill(); g.fillStyle = '#8B5CF6'; g.beginPath(); g.arc(680, 252, 56, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.07); g.beginPath(); g.roundRect(40 + i * 280, 412, 260, 104, 9); g.fill(); bar(58 + i * 280, 432, 120, 12, pale(0.42)); bar(58 + i * 280, 458, 200, 8, pale(0.18)); bar(58 + i * 280, 476, 170, 8, pale(0.18)); }
  });
  TEX.web1 = TEX.web;
  TEX.web0 = tex(900, 540, 5, (g, R, bar) => {
    g.fillStyle = '#0d0d14'; g.fillRect(0, 0, 900, 540); g.fillStyle = '#191822'; g.fillRect(0, 0, 900, 46);
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.3); g.beginPath(); g.arc(26 + i * 24, 23, 7, 0, 7); g.fill(); }
    bar(40, 78, 96, 16, pale(0.55)); bar(760, 81, 100, 10, pale(0.24));
    bar(200, 170, 500, 44, pale(0.88), 8); bar(260, 232, 380, 44, pale(0.88), 8); bar(280, 300, 340, 12, pale(0.3)); bar(320, 324, 260, 12, pale(0.3));
    bar(360, 372, 180, 50, AKZ.studios, 8);
    bar(120, 470, 660, 2, pale(0.14)); bar(120, 492, 200, 10, pale(0.2)); bar(580, 492, 200, 10, pale(0.2));
  });
  TEX.web2 = tex(900, 540, 5, (g, R, bar) => {
    const v = g.createLinearGradient(0, 0, 900, 540); v.addColorStop(0, '#1a0f1c'); v.addColorStop(0.5, '#2a1410'); v.addColorStop(1, '#0b0a12'); g.fillStyle = v; g.fillRect(0, 0, 900, 540);
    const k = g.createRadialGradient(620, 250, 10, 620, 250, 330); k.addColorStop(0, 'rgba(255,120,60,.95)'); k.addColorStop(0.35, 'rgba(255,90,31,.45)'); k.addColorStop(1, 'rgba(255,90,31,0)'); g.fillStyle = k; g.fillRect(0, 0, 900, 540);
    g.fillStyle = '#0b0a12'; g.beginPath(); g.moveTo(0, 540); g.lineTo(0, 400); g.lineTo(180, 330); g.lineTo(330, 410); g.lineTo(470, 300); g.lineTo(640, 420); g.lineTo(790, 350); g.lineTo(900, 400); g.lineTo(900, 540); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,228,.95)'; g.beginPath(); g.arc(620, 250, 62, 0, 7); g.fill();
    g.fillStyle = AKZ.studios; g.beginPath(); g.moveTo(602, 220); g.lineTo(654, 250); g.lineTo(602, 280); g.closePath(); g.fill();
    for (let i = 0; i < 46; i++) { g.fillStyle = pale(0.12 + R() * 0.4); g.beginPath(); g.arc(R() * 900, R() * 330, 1 + R() * 2.2, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(11,10,18,.55)'; g.fillRect(0, 0, 900, 46); bar(40, 18, 96, 12, pale(0.7)); for (let i = 0; i < 4; i++) bar(560 + i * 80, 20, 56, 8, pale(0.4));
    bar(56, 170, 330, 46, pale(0.95), 8); bar(56, 232, 250, 46, pale(0.95), 8); bar(56, 300, 300, 12, pale(0.45)); bar(56, 348, 150, 46, AKZ.studios, 8);
    for (let i = 0; i < 4; i++) bar(56 + i * 96, 470, 80, 46, pale(i === 1 ? 0.5 : 0.16), 6);
  });
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
  TEX.pipe = tex(1000, 600, 61, (g, R, bar) => {
    const B = AKZ.revenue; g.fillStyle = '#0b0d14'; g.fillRect(0, 0, 1000, 600); g.fillStyle = '#141824'; g.fillRect(0, 0, 1000, 50); bar(28, 19, 120, 12, pale(0.5)); bar(820, 20, 150, 10, pale(0.22));
    [5, 4, 4, 3, 2].forEach((n, i) => { const x = 22 + i * 193, last = i === 4;
      g.fillStyle = pale(0.045); g.beginPath(); g.roundRect(x, 72, 180, 506, 10); g.fill(); bar(x + 14, 90, 72, 10, last ? B : pale(0.45)); bar(x + 130, 90, 36, 10, pale(0.2));
      for (let q = 0; q < n; q++) { const y = 122 + q * 92; g.fillStyle = last ? B : q === 1 && i === 2 ? 'rgba(125,183,255,.4)' : pale(0.1); g.beginPath(); g.roundRect(x + 12, y, 156, 78, 8); g.fill(); bar(x + 26, y + 16, 90, 9, last ? 'rgba(8,16,40,.75)' : pale(0.42)); bar(x + 26, y + 36, 120, 7, last ? 'rgba(8,16,40,.45)' : pale(0.2)); bar(x + 26, y + 54, 60, 7, last ? 'rgba(8,16,40,.45)' : pale(0.2)); } });
  });
  TEX.anrufe = tex(500, 400, 62, (g, R, bar) => {
    const B = AKZ.revenue; g.fillStyle = '#0b0d14'; g.fillRect(0, 0, 500, 400); g.fillStyle = '#141824'; g.fillRect(0, 0, 500, 40); bar(20, 14, 90, 10, pale(0.5));
    for (let i = 0; i < 6; i++) { const y = 60 + i * 54, on = i === 2; g.fillStyle = on ? 'rgba(125,183,255,.25)' : pale(0.05); g.beginPath(); g.roundRect(16, y, 468, 44, 8); g.fill(); g.fillStyle = on ? B : pale(0.3); g.beginPath(); g.arc(44, y + 22, 11, 0, 7); g.fill(); bar(70, y + 12, 150 + ((i * 37) % 80), 9, pale(on ? 0.8 : 0.4)); bar(70, y + 28, 100, 7, pale(0.2)); bar(400, y + 16, 60, 12, on ? B : pale(0.18)); }
  });
  TEX.bau = tex(800, 520, 71, (g, R, bar) => {
    g.fillStyle = '#0b0b12'; g.fillRect(0, 0, 800, 520); g.fillStyle = '#151422'; g.fillRect(0, 0, 800, 42); bar(22, 15, 100, 11, pale(0.45));
    for (let i = 0; i < 12; i++) { const ind = [0, 1, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0][i]; bar(26 + ind * 28, 66 + i * 36, 60 + ((i * 53) % 160), 11, i === 5 ? 'rgba(167,139,250,.85)' : pale(0.3 + (i % 3) * 0.08)); }
    g.strokeStyle = 'rgba(205,192,255,.7)'; g.lineWidth = 3; g.lineJoin = 'round'; const c = [540, 270], s = 110;
    const P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => [c[0] + (x + z * 0.5) * s, c[1] + (y - z * 0.4) * s * 0.8]);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { g.beginPath(); g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); }
    g.fillStyle = 'rgba(139,92,246,.35)'; g.beginPath(); g.moveTo(P[4][0], P[4][1]); g.lineTo(P[5][0], P[5][1]); g.lineTo(P[6][0], P[6][1]); g.lineTo(P[7][0], P[7][1]); g.closePath(); g.fill();
  });
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
  TEX.themen = tex(900, 760, 31, (g, R, bar) => {
    g.fillStyle = '#d9d5e4'; g.fillRect(0, 0, 900, 760); g.fillStyle = '#5F4BB6'; g.fillRect(0, 0, 900, 78); bar(36, 30, 260, 16, 'rgba(255,255,255,.9)');
    const n = [4, 3, 4, 3];
    for (let i = 0; i < 4; i++) {
      const x = 28 + i * 215; g.fillStyle = 'rgba(38,36,51,.1)'; g.fillRect(x, 100, 200, 640); bar(x + 14, 114, 90, 12, 'rgba(38,36,51,.5)');
      for (let j = 0; j < n[i]; j++) { const y = 152 + j * 146, on = j === (i * 2) % n[i]; g.fillStyle = on ? '#5F4BB6' : 'rgba(255,255,255,.7)'; g.beginPath(); g.roundRect(x + 12, y, 176, 122, 8); g.fill(); bar(x + 26, y + 20, 100, 11, on ? 'rgba(255,255,255,.9)' : 'rgba(38,36,51,.5)'); bar(x + 26, y + 46, 140, 8, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.28)'); bar(x + 26, y + 66, 110, 8, on ? 'rgba(255,255,255,.6)' : 'rgba(38,36,51,.28)'); g.fillStyle = on ? '#EFEAFB' : 'rgba(95,75,182,.55)'; g.beginPath(); g.arc(x + 160, y + 100, 9, 0, 7); g.fill(); }
    }
  });
  TEX.stempel = tex(800, 700, 41, (g, R, bar) => {
    g.fillStyle = '#ece8f5'; g.fillRect(0, 0, 800, 700); g.fillStyle = '#5F4BB6'; g.fillRect(0, 0, 800, 120); bar(44, 44, 300, 18, 'rgba(255,255,255,.92)'); bar(44, 76, 190, 10, 'rgba(255,255,255,.55)');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const n = j * 4 + i, on = n < 7, x = 120 + i * 190, y = 230 + j * 150; g.beginPath(); g.arc(x, y, 58, 0, 7); if (on) { g.fillStyle = '#5F4BB6'; g.fill(); g.fillStyle = '#EFEAFB'; g.beginPath(); g.moveTo(x - 22, y + 2); g.lineTo(x - 6, y + 18); g.lineTo(x + 24, y - 16); g.lineWidth = 9; g.strokeStyle = '#EFEAFB'; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); } else { g.lineWidth = 6; g.strokeStyle = 'rgba(38,36,51,.4)'; g.setLineDash([12, 10]); g.stroke(); g.setLineDash([]); } }
    bar(44, 660, 220, 14, 'rgba(38,36,51,.3)');
  });
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
  const dpr = Math.min(devicePixelRatio || 1, DPR_HOECHSTENS[STUFE]);
  const lr = $('#seqLayer').getBoundingClientRect();
  let w = (lr.width || innerWidth) * dpr, h = (lr.height || innerHeight) * dpr;
  const cap = innerWidth < 1024 || coarse ? 1280 : KANTE_HOECHSTENS[STUFE], k = Math.min(1, cap / Math.max(w, h));
  w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
  cv.width = w; cv.height = h; S.w = w; S.h = h; S.narrow = w < h * 0.9; S.cx = w / 2; S.css = (lr.width || innerWidth) / w;
  S.f = S.f0 = S.narrow ? h * 0.6 : Math.max(w * 0.85, h * 1.05);
  skyHy = Math.round(h * 0.95); buildHimmel(w, Math.round(h * 1.95), skyHy); sky = SKY[0];
  if (!CITY) CITY = buildCity();
  if (!CITY_TEX) CITY_TEX = buildCityTex();
  buildKeys(); sceneDirty = true; BILD_GEN++; RUHEBILD.key = ''; root.dataset.stufe = String(STUFE);
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
  if (NACHZUG || z - cam.z < NEAR) return; const p = P(x, y, z), r = (radM * S.f) / (z - cam.z); if (r < 1) return;
  const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
}
function box(x0, x1, y0, y1, z0, z1, cTop, cFront, cSide) {
  if (cam.x < x0) poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], cSide);
  if (cam.x > x1) poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], cSide);
  if (cam.y > y1 + oy) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cTop);
  if (cam.z < z0) poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], cFront);
}
const lwAt = (z, m) => Math.max(1, (m * S.f) / Math.max(1, z - cam.z));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
let introK = reduce ? 1 : 0;
const HERO_END = () => ({ x: S.narrow ? 0 : -3.5, y: 1.75, d: S.narrow ? 19 : 16, cy: S.narrow ? 0.4 : 0.58 });
function heroCam(s) {
  const n = S.narrow, E = HERO_END(), START = n ? 70 : 58;
  const t = 1 - Math.pow(1 - s, 1.7);
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
  FLOORS.forEach((F, i) => { const [a, b] = floorRange(i), y = F.base + F.eye, zu = !!F.zu; KF.push({ p: a + (b - a) * TRAVEL_PART, x: zu ? xB : xA, y, z: zu ? zB : zA, cy: cyT }, { p: b, x: xB, y, z: zB, cy: cyT }); });
  KF.push({ p: THREAD[1], x: n ? -22 : -23, y: n ? -64 : -66, z: n ? -128 : -215, cy: 0.5 });
  KF.push({ p: SPOTS[1], x: n ? 2 : -10.5, y: n ? -2 : 4, z: n ? -56 : -40, cy: n ? 0.4 : 0.7 });
  KF.push({ p: 1, x: n ? 2 : -10, y: n ? -2 : 4.3, z: n ? -52 : -37, cy: n ? 0.4 : 0.7 });
}
const insideK = (p, i) => { const [a, b] = floorRange(i), d = ((p - a) / (b - a) - TRAVEL_PART) / (1 - TRAVEL_PART); return d <= 0 || d >= 1 ? 0 : smooth((d - 0.08) / 0.22) * (1 - smooth((d - 0.78) / 0.18)); };
let INS = { k: 0, i: -1, F: null }, AKT = { k: 0, F: null };
let NCY = 0.235, NDZ = 2.5, NCYD = 0.19, NZF = 1;
let ZOOM = 1;
let FZ = 1, DX = 0, DY = 0;
const SCHWELLE = 0.3, DRIN = 1.5, TRITT_ANTEIL = 0.22;
let TRITT = 1;
const freiFlaeche = () => (wide.matches && !S.narrow ? [innerWidth <= 1100 ? 0.5 : 0.42, 1] : [0, 1]);
const dachK = (p) => { const [a, b] = floorRange(DACH_HALT), q = (p - a) / (b - a); return q <= 0 || q > 1 ? 0 : smooth((q - 0.48) / 0.17) * (1 - smooth((q - 0.9) / 0.085)); };
const MITTE = {};
function mitteN(key) { const m = MITTE[key]; if (!m) return NCY; const f = FOK.st && FOK.st.key === key ? FOK.k.v : 0; return f > 0 && m.karte != null ? lerp(m.blatt, m.karte, f) : m.blatt; }
function innenCam() {
  const F = INS.F, k = INS.k, MK = MARKE[F.key], [L, R] = freiFlaeche();
  const dRef = 6.6, br = ((S.narrow && MK.breiteN) || MK.breite || 4.6) * ZOOM, fIn = Math.min(S.w * 1.5, ((R - L) * S.w * dRef) / br);
  cam.x = lerp(cam.x, zoneX(F.key), k); cam.y = lerp(cam.y, F.base + 1.5, k); cam.z = lerp(cam.z, lerp(SCHWELLE, DRIN, S.narrow ? 1 : TRITT), k);
  S.f = lerp(S.f, fIn, k); S.cy = lerp(S.cy, S.h * (S.narrow ? mitteN(F.key) : 0.53), k); S.cx = lerp(S.cx, S.w * (L + R) / 2, k);
}
function dachCam(k) {
  const [L, R] = freiFlaeche(), [za, zb, zt] = zwischen(MARKE.dach.zz, MARKE.dach.zone.v), z = lerp(za, zb, zt) - (S.narrow ? NDZ : 0);
  cam.x = lerp(cam.x, zoneX('dach'), k); cam.z = lerp(cam.z, z, k); S.cx = lerp(S.cx, (S.w * (L + R)) / 2, k);
  if (S.narrow) { S.cy = lerp(S.cy, S.h * NCYD, k); S.f = lerp(S.f, S.f * NZF, k); }
}
function camera(p) {
  S.f = S.f0; S.cx = S.w / 2; INS.k = 0;
  if (p <= HERO[1]) { heroCam(span(p, HERO)); INS = { k: 0, i: -1, F: null }; AKT = { k: 0, F: null }; return; }
  let i = 0; while (i < KF.length - 2 && p > KF[i + 1].p) i++;
  const A = KF[i], B = KF[i + 1], t = easeInOutSine(clamp01((p - A.p) / (B.p - A.p)));
  cam.x = lerp(A.x, B.x, t); cam.y = lerp(A.y, B.y, t);
  cam.z = A.z < 0 && B.z < 0 ? -Math.exp(lerp(Math.log(-A.z), Math.log(-B.z), t)) : lerp(A.z, B.z, t);
  S.cy = S.h * lerp(A.cy, B.cy, t);
  if (FZ !== 1) S.f *= FZ; cam.x += DX; cam.y += DY;
  INS = { k: 0, i: -1, F: null };
  for (const j of MARKEN_HALTE) { const k = insideK(p, j); if (k > 0) INS = { k, i: j, F: FLOORS[j] }; }
  if (INS.k > 0) innenCam();
  AKT = INS.k > 0 ? INS : { k: dachK(p), F: FLOORS[DACH_HALT] };
  if (AKT.k > 0 && AKT.F.roof) dachCam(AKT.k);
}
function stelle(o) {
  if (typeof o === 'number') camera(o);
  else { S.f = S.f0; S.cx = S.w / 2; cam.x = o.x; cam.y = o.y; cam.z = o.z; S.cy = S.h * o.cy; INS = { k: 0, i: -1, F: null }; AKT = { k: 0, F: FLOORS[DACH_HALT] }; }
  return { x: cam.x, y: cam.y, z: cam.z, cy: S.cy, f: S.f, cx: S.cx, ins: { ...INS }, akt: { ...AKT } };
}
function kamera(v) {
  if (!v.blende) { camera(v.p); return; }
  const a = stelle(v.blende.pa), b = stelle(v.blende.pb), t = v.blende.t;
  cam.x = lerp(a.x, b.x, t); cam.y = lerp(a.y, b.y, t); cam.z = a.z < 0 && b.z < 0 ? -Math.exp(lerp(Math.log(-a.z), Math.log(-b.z), t)) : lerp(a.z, b.z, t);
  S.cy = lerp(a.cy, b.cy, t); S.f = lerp(a.f, b.f, t); S.cx = lerp(a.cx, b.cx, t);
  const ka = 1 - smooth(t / 0.45), kb = smooth((t - 0.55) / 0.45), von = (q, k) => ({ k: q.k * k, i: q.i ?? -1, F: q.F });
  INS = a.ins.k * ka > 0 ? von(a.ins, ka) : b.ins.k * kb > 0 ? von(b.ins, kb) : { k: 0, i: -1, F: null };
  AKT = INS.k > 0 ? INS : a.akt.k * ka > 0 ? von(a.akt, ka) : b.akt.k * kb > 0 ? von(b.akt, kb) : { k: 0, F: FLOORS[DACH_HALT] };
}
function coreState(p) {
  const q0 = (p - TOUR_START) / FLOOR_LEN;
  const G0 = MARKE.strasse.kernG || 1;
  if (q0 < 0.8) return { x: PED.x, y: GROUND + PED.h + 0.27 * G0, z: PED.z, level: LEVELS[0], cab: GROUND, door: 1, g: G0 };
  if (q0 < 1) { const t = smooth((q0 - 0.8) / 0.2); return { x: lerp(PED.x, SHAFT.x, t), y: GROUND + lerp(PED.h + 0.27 * G0, 1.25, t) + Math.sin(t * Math.PI) * 0.4, z: lerp(PED.z, SHAFT.z, t), level: LEVELS[0], cab: GROUND, door: 1, g: lerp(G0, 1, t) }; }
  const doorOf = (tr) => (tr >= 1 || tr <= 0 ? 1 : 1 - clamp01(Math.min(tr, 1 - tr) / 0.1));
  for (let i = 1; i < HALTS; i++) {
    const [a, b] = floorRange(i); if (p >= b && i < HALTS - 1) continue;
    const F = FLOORS[i], tr = clamp01((p - a) / (FLOOR_LEN * TRAVEL_PART)), t = easeInOutSine(tr), base = lerp(FLOORS[i - 1].base, F.base, t);
    const c = { x: SHAFT.x, y: base + 1.25, z: SHAFT.z, level: lerp(LEVELS[i - 1], LEVELS[i], t), cab: base, door: doorOf(tr) };
    if (tr < 1) return c;
    const d = (p - a - FLOOR_LEN * TRAVEL_PART) / (FLOOR_LEN * (1 - TRAVEL_PART)), G = (MARKE[F.key] && MARKE[F.key].kernG) || 1, R = (0.25 + 0.13 * c.level) * G;
    const out = MARKE[F.key] && !F.roof ? kernplatz(F.key, R) : null;
    if (out) {
      const s = smooth(d / 0.16) * (1 - smooth((d - 0.84) / 0.16));
      c.x = lerp(SHAFT.x, out[0], s); c.z = lerp(SHAFT.z, out[2], s); c.y = base + lerp(1.25, out[1], s) + Math.sin(s * Math.PI) * 0.35; c.im = s > 0.5 ? F.key : null; c.g = lerp(1, G, s);
    } else if (F.roof) {
      const s = smooth(d / 0.2);
      c.x = lerp(SHAFT.x, 0, s); c.z = lerp(SHAFT.z, STAGE.zc, s); c.y = lerp(1.25, STAGE.y + 0.75, s) + Math.sin(s * Math.PI) * 0.8; c.level = 1 + 0.3 * span(p, SPOTS);
    }
    return c;
  }
}
function drawCore(c) {
  oy = 0; coreAt = null;
  const dz = c.z - cam.z; if (dz < 1) return;
  const k = S.f / dz, q = P(c.x, c.y, c.z), L = clamp01(c.level), R = Math.max(1.6, (0.25 + 0.13 * L + 0.4 * clamp01((c.level - 1) / 0.3)) * k * (c.g || 1));
  coreAt = [q[0] / S.w, q[1] / S.h];
  if (q[0] < -300 || q[0] > S.w + 300 || q[1] < -300 || q[1] > S.h + 300) return;
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
  const gr = Math.max(R * 1.7, (0.5 + 3.4 * L * L) * k * (1 + Math.max(0, c.level - 1) * 3.5));
  const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], gr); g.addColorStop(0, `rgba(${LAV},${0.08 + 0.52 * L})`); g.addColorStop(0.3, `rgba(139,92,246,${0.02 + 0.2 * L})`); g.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(q[0] - gr, q[1] - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over';
  const mix = (m, n) => m.map((v, i) => Math.round(lerp(v, n[i], L)));
  const bg = ctx.createRadialGradient(q[0] - R * 0.25, q[1] - R * 0.3, R * 0.05, q[0], q[1], R);
  bg.addColorStop(0, `rgb(${mix([96, 86, 138], [226, 216, 255])})`); bg.addColorStop(1, `rgb(${mix([72, 62, 116], [139, 92, 246])})`);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 7); ctx.fill();
  if (kab <= 0) return; ctx.globalAlpha = kab;
  const open = clamp01(c.door), dT = cT + top, dB = cB - bot, leaf = (cw / 2) * (1 - 0.8 * open);
  ctx.fillStyle = `rgba(${LAVH},${0.09 + 0.07 * (1 - open)})`; ctx.strokeStyle = `rgba(${LAVH},${0.4 + 0.25 * (1 - open)})`; ctx.lineWidth = Math.max(1, 0.022 * ks);
  for (const x of [cx0, cx1 - leaf]) { ctx.fillRect(x, dT, leaf, dB - dT); ctx.strokeRect(x, dT, leaf, dB - dT); }
  ctx.globalAlpha = 1;
}
const M = { top: '#5a586e', front: '#1c1b26', side: '#262532' };
function tripod(x, z, h) {
  const lw = lwAt(z, 0.05);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [0, 0.5]]) seg([x, h, z], [x + dx, 0, z + dz], '#07070c', lw);
  box(x - 0.09, x + 0.09, h + 0.06, h + 0.22, z + 0.3, z + 0.56, '#2b2a38', '#0b0b10', '#15141c');
  box(x - 0.18, x + 0.18, h, h + 0.28, z - 0.16, z + 0.3, '#3a3849', '#101016', '#1b1a25');
  fillZ(x - 0.11, x + 0.11, h + 0.07, h + 0.21, z - 0.165, `rgba(${LAVH},.85)`);
  glow(x, h + 0.14, z - 0.17, 0.5, [[0, `rgba(${LAV},.35)`], [1, `rgba(${LAV},0)`]]);
}
function bodenlicht(x, z, r, rgb, a) {
  const dz = z - cam.z; if (NACHZUG || dz < 0.6 || a < 0.004) return; const q = P(x, 0.005, z), rx = (r * S.f) / dz, sq = Math.min(0.9, Math.max(0.08, (cam.y - oy) / dz));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q[0], q[1]); ctx.scale(1, sq);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.6, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore();
}
const schatten = (xa, xb, za, zb) => !NACHZUG && poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');
function hocker(x, h, z) {
  if (FEIN) fleck(x, z, 0.34, 0.3, 0.2, h); else schatten(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  const B = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz]) => [[x + dx * 0.16, h - 0.05, z + dz * 0.16], [x + dx * 0.25, 0, z + dz * 0.25]]);
  linien(B, '#1a1922', lwAt(z, 0.04));
  if (FEIN) { const r = B.map(([a, b]) => [lerp(a[0], b[0], 0.62), lerp(a[1], b[1], 0.62), lerp(a[2], b[2], 0.62)]); linien([[r[0], r[1]], [r[1], r[3]], [r[3], r[2]], [r[2], r[0]]], '#1a1922', lwAt(z, 0.022)); }
  box(x - 0.23, x + 0.23, h - 0.07, h, z - 0.23, z + 0.23, '#ddd7ea', '#77728f', '#6d6884');
  if (FEIN) fillZ(x - 0.23, x + 0.23, h - 0.012, h, z - 0.231, 'rgba(255,255,255,.5)');
}
function tisch(x0, x1, z0, z1, h, col) {
  schatten(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.2);
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.14, z0 + 0.08], [x0 + 0.08, z1 - 0.14], [x1 - 0.14, z1 - 0.14]]) box(x, x + 0.06, 0, h, z, z + 0.06, '#111', '#101016', '#16151e');
  box(x0, x1, h - 0.05, h, z0, z1, col || M.top, M.front, M.side);
}
function laptop(x, y, z, w = 0.46) {
  box(x - w / 2, x + w / 2, y, y + 0.02, z - 0.15, z + 0.15, '#3a3849', '#16151e', '#1b1a25');
  const q = [[x - w / 2, y + 0.02, z + 0.14], [x + w / 2, y + 0.02, z + 0.14], [x + w / 2, y + 0.3, z + 0.2], [x - w / 2, y + 0.3, z + 0.2]];
  poly(q, '#1a1736');
  const r = rectZ(x - w / 2 + 0.03, x + w / 2 - 0.03, y + 0.06, y + 0.27, z + 0.17);
  if (r) { ctx.fillStyle = `rgba(${LAVH},.55)`; ctx.fillRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.18, r[2] * 0.5, Math.max(1, r[3] * 0.1)); ctx.fillStyle = `rgba(${LAV},.85)`; ctx.fillRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.5, r[2] * 0.8, Math.max(1, r[3] * 0.28)); }
  if (FEIN) glow(x, y + 0.2, z + 0.1, 0.8, [[0, `rgba(${LAV},.22)`], [1, `rgba(${LAV},0)`]]);
}
function flach(x0, x1, z0, z1, y, fill) { return poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill); }
function tafel(x0, x1, y0, y1, z, tx, rahmen, a = 1) {
  const d = rectZ(x0, x1, y0, y1, z); if (!d || !tx) return null;
  const b = Math.max(1.5, d[2] * 0.01); ctx.fillStyle = rahmen || '#07070c'; ctx.fillRect(d[0] - b, d[1] - b, d[2] + 2 * b, d[3] + 2 * b);
  ctx.globalAlpha = a; ctx.drawImage(tx, d[0], d[1], d[2], d[3]); ctx.globalAlpha = 1; return d;
}
const FIG = (() => {
  const PI = Math.PI;
  const lerp = (a, b, t) => a + (b - a) * t;
  const grenze = (v, a, b) => Math.min(b, Math.max(a, v));
  const weich = (t) => { t = grenze(t, 0, 1); return t * t * (3 - 2 * t); };
  const KOPF = 1.05;
  const STUFEN = [52, 150];
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const misch = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a) => (a == null ? `rgb(${Math.round(grenze(c[0], 0, 255))},${Math.round(grenze(c[1], 0, 255))},${Math.round(grenze(c[2], 0, 255))})` : `rgba(${Math.round(grenze(c[0], 0, 255))},${Math.round(grenze(c[1], 0, 255))},${Math.round(grenze(c[2], 0, 255))},${a})`);
  function tonwerte(farbe, licht) {
    const hb = licht.heb ?? 16, m = [farbe[0] * licht.amb[0] + hb, farbe[1] * licht.amb[1] + hb * 0.9, farbe[2] * licht.amb[2] + hb];
    const hell = (m[0] + m[1] + m[2]) / 765, l = misch(m, licht.licht, 0.1 + 0.16 * hell).map((v) => v * 1.1 + 5), d = misch(m.map((v) => v * 0.78), licht.schatten, 0.2), t = misch(m.map((v) => v * 0.56), licht.schatten, 0.3);
    return { l: css(l), m: css(m), d: css(d), t: css(t), roh: m };
  }
  function toene(m, licht) {
    const c = m._ton || (m._ton = {}); if (c[licht.id]) return c[licht.id];
    const t = { haut: tonwerte(m.haut, licht), haar: tonwerte(m.haar, licht), ober: tonwerte(m.ober.farbe, licht), unter: tonwerte(m.unter.farbe, licht), schuh: tonwerte(m.schuhe.farbe, licht),
      zwei: tonwerte(m.ober.zwei || [236, 232, 226], licht), sohle: tonwerte(m.schuhe.sohle || [232, 228, 220], licht), ding: tonwerte([36, 35, 46], licht), tasche: tonwerte(m.tasche || [58, 50, 46], licht),
      lippe: tonwerte(misch(m.haut, [168, 70, 72], 0.42), licht), weiss: tonwerte([246, 242, 236], licht), auge: tonwerte(m.augen, licht), gold: tonwerte([226, 190, 110], licht), guertel: tonwerte([46, 36, 32], licht) };
    c[licht.id] = t; return t;
  }
  const STATUR = { schmal: 0.92, mittel: 1, kraeftig: 1.1 };
  function mensch(id, d, akzent) {
    const f = (x, ers) => hex(x === 'akzent' ? akzent : x || ers), b = d.form === 'b', w = STATUR[d.statur] || 1, sohle = d.schuhe && d.schuhe.sohle ? f(d.schuhe.sohle) : null, ba = d.bauch || 0, sf = d.schulter || 1;
    const Q = RUMPF[b ? 'b' : 'a'].map((r, i) => (i === 1 ? [r[0], r[1] + 0.012 * ba, r[2] + 0.03 * ba, r[3] + 0.02 * ba] : i === 2 ? [r[0], r[1] + 0.036 * ba, r[2] + 0.055 * ba, r[3] + 0.034 * ba] : i === 3 ? [r[0], r[1] + 0.008 * ba, r[2] + 0.014 * ba, r[3] + 0.006 * ba] : i === 4 || i === 5 ? [r[0], r[1] * sf, r[2], r[3]] : r));
    return { id, gr: d.gr || 1, w, b, Q, kg: d.kopfgr || 1, alt: d.alter === 'alt' ? 1 : 0, ansatz: d.ansatz === 'hoch' ? 1 : 0, sb: (b ? 0.176 : 0.198) * (0.5 + 0.5 * w) * sf, hb: 0.09, haut: f(d.haut, '#c99676'), haar: f(d.haar, '#2a1d17'), frisur: d.frisur || 'kurz', bart: !!d.bart, pony: !!d.pony,
      scheitel: d.scheitel === 'rechts' ? 1 : d.scheitel === 'mitte' ? 0 : -1, ohrring: !!d.ohrring, uhr: !!d.uhr, augen: f(d.augen, '#3b2a22'),
      ober: { art: (d.ober && d.ober.art) || 'pulli', farbe: f(d.ober && d.ober.farbe, '#4a4a58'), zwei: d.ober && d.ober.zwei ? f(d.ober.zwei) : null, hoch: !!(d.ober && d.ober.aermel === 'hoch'), rolli: !!(d.ober && d.ober.kragen === 'rolli'), offen: !!(d.ober && d.ober.offen) },
      unter: { art: (d.unter && d.unter.art) || 'hose', farbe: f(d.unter && d.unter.farbe, '#2b2d3a'), schnitt: (d.unter && d.unter.schnitt) || 'gerade', kurz: !!(d.unter && d.unter.laenge === 'kurz') },
      schuhe: { farbe: f(d.schuhe && d.schuhe.farbe, '#e6e1d8'), sohle, leder: d.schuhe && d.schuhe.art ? d.schuhe.art === 'leder' : !!sohle && sohle[0] + sohle[1] + sohle[2] < 300 }, tasche: d.tasche ? f(d.tasche) : null, kopfhoerer: !!d.kopfhoerer, brille: !!d.brille, nase: d.nase || 1, _ton: null,
      eig: (() => { const e = d.stand || {}, hoodie = d.ober && d.ober.art === 'hoodie', arm = (x) => (x === 'tasche' && hoodie ? 'bauchtasche' : EIGEN[x] ? x : 'haengt');
        return { l: arm(e.l), r: arm(e.r), breit: e.breit || 0, vor: e.vor ?? 0.045, aus: e.aus ?? 0.2, spitze: e.spitze ? 0.45 : 0, ks: e.kopf || 0, rund: d.rund || 0, sitz: SITZART[d.sitzt] ? d.sitzt : 'gerade' }; })() };
  }
  const neutral = () => ({ px: 0, py: 0, pf: 0, neig: 0.02, seit: 0, dreh: 0, kd: 0, kn: 0, ks: 0, bl: [0.02, 0.045, 0.04, 0], br: [0.02, 0.045, 0.04, 0], al: [0.03, 0.07, 0.2, 0.12], ar: [0.03, 0.07, 0.2, 0.12], hebL: 0, hebR: 0, boden: true, hl: 'locker', hr: 'locker', mund: 0, blinz: 0, schau: 0, atem: 0,
    bk: 0, sk: 0, aus: 0.13, st: 0, si: 0, ei: 0, fl: 0, fr: 0, w: 0 });
  const ARME = {
    haengt: [0.03, 0.07, 0.2, 0.12], tippt: [0.42, 0.14, 1.22, 0.36], maus: [0.5, 0.2, 1.1, 0.1], kamera: [0.55, 0.12, 1.55, 0.3], griff: [0.34, 0.16, 1.4, 0.16], filmt: [0.78, 0.2, 1.42, 0.52],
    zeigt: [1.02, 0.2, 0.42, 0.0], schreibt: [1.12, 0.06, 0.82, 0.12], haelt: [0.2, 0.12, 1.5, 0.5], spricht: [0.24, 0.16, 1.5, 0.18], offen: [0.42, 0.42, 0.9, -0.1], telefon: [0.42, 0.34, 2.5, 0.55],
    traegt: [0.0, 0.07, 0.1, 0.0], greift: [0.5, 0.1, 0.25, 0.0], schoss: [0.3, 0.1, 1.0, 0.3], huefte: [-0.3, 0.62, 0.84, 1.34], becher: [0.08, 0.1, 1.62, 0.34],
    hosentasche: [-0.2, 0.2, 0.62, 0.48], bauchtasche: [-0.15, 0.14, 1.15, 0.75], kreuz: [0.1, 0.08, 1.94, 1.13], quer: [0.0, 0.06, 1.5, 1.12], kinn: [0.3, 0.0, 2.6, 0.62], mappe: [0.05, 0.08, 1.75, 0.75], ruecken: [-0.5, 0.1, 0.3, 1.0], gefasst: [0.1, 0.1, 0.32, 0.78], lehne: [0.1, 0.42, 0.5, 0.1], auflage: [0.22, 0.3, 0.95, -0.05],
  };
  const EIGEN = { haengt: { a: null }, tasche: { a: 'hosentasche', h: 'weg' }, bauchtasche: { a: 'bauchtasche', h: 'weg' }, huefte: { a: 'huefte', h: 'greift' }, kreuz: { a: 'kreuz', h: 'greift', paar: 1 }, kreuzu: { a: 'kreuz', h: 'weg', paar: 1 }, quer: { a: 'quer', h: 'locker', paar: 1 }, kinn: { a: 'kinn', h: 'locker', paar: 1 },
    becher: { a: 'becher', h: 'greift', d: 'becher' }, mappe: { a: 'mappe', h: 'greift', d: 'mappe' }, ruecken: { a: 'ruecken', h: 'locker', paar: 1 }, gefasst: { a: 'gefasst', h: 'locker', paar: 1 } };
  const SITZART = { gerade: null, versetzt: [[-0.045, 0.02, -0.345, 0.08], [0, 0.02, 0.38, -0.3]], weit: [[0, 0.16, 0, 0], [0, 0.16, 0, 0]], zurueck: [[0, 0.03, 0.42, -0.24], [0, 0.02, 0.34, -0.2]], ueber: [[0.2, -0.52, -0.1, -0.35], [0, -0.04, -0.12, 0.04]] };
  const HAND = { haengt: 'locker', tippt: 'tippt', maus: 'greift', kamera: 'greift', griff: 'greift', filmt: 'greift', zeigt: 'zeigt', schreibt: 'greift', haelt: 'greift', spricht: 'offen', offen: 'offen', telefon: 'greift', traegt: 'greift', greift: 'offen', schoss: 'locker', huefte: 'greift', becher: 'greift', lehne: 'greift', auflage: 'locker' };
  const KNICK = { huefte: [0.08, -0.72, 0.68, 0.8], kinn: [-0.35, 0.25, 0.9, 0.75] };
  const arme = (p, l, r) => { p.al = ARME[l].slice(); p.ar = ARME[r].slice(); p.hl = HAND[l] || 'locker'; p.hr = HAND[r] || 'locker'; p.kl = KNICK[l] ? l : ''; p.kr = KNICK[r] ? r : ''; return p; };
  function steh(w = 0, armL = 'haengt', armR = 'haengt') {
    const p = neutral(), a = Math.abs(w);
    p.w = w; p.st = 1; p.ei = w === 0 ? 0 : 1; p.fl = armL === 'haengt' ? 1 : 0; p.fr = armR === 'haengt' ? 1 : 0;
    p.px = 0.046 * w; p.seit = -0.05 * w; p.bk = 0.1 * w; p.sk = -0.14 * w; p.ks = 0.035 * w; p.dreh = 0.05 * w; p.py = -0.006 * a;
    const stand = [0.0, 0.045 - 0.04 * a, 0.02, 0], frei = [0.12 * a + 0.02, 0.05 + 0.05 * a, 0.24 * a + 0.04, 0.06 * a];
    p.br = w >= 0 ? stand : frei; p.bl = w >= 0 ? frei : stand;
    arme(p, armL, armR);
    for (const [A, frei2, s2] of [[p.ar, p.fr, w], [p.al, p.fl, -w]]) if (frei2) { const st = Math.max(0, s2), sp = Math.max(0, -s2); A[0] += 0.07 * sp - 0.04 * st; A[1] += 0.03 * st; A[2] += 0.1 * sp; }
    return p;
  }
  const AM_TISCH = { tippt: 1, maus: 1, schreibt: 1 }, IM_GESPRAECH = { spricht: 1, offen: 1, zeigt: 1 };
  function sitz(hoehe = 0.46, gr = 1, armL = 'schoss', armR = 'schoss', art = '') {
    const p = neutral(), hy = (hoehe + 0.088) / gr, t = Math.acos(grenze((hy - 0.5) / 0.43, 0, 0.98));
    p.py = hy - 0.93; p.boden = false; p.si = 1;
    const fuss = 0.085 / 1, k2 = Math.acos(grenze((hy - 0.43 * Math.cos(t) - fuss) / 0.415, 0, 1));
    p.bl = [t, 0.1, t + k2, 0]; p.br = [t, 0.1, t + k2, 0];
    if (hoehe > 0.55) { p.bl = [t, 0.12, t + 0.25, -0.3]; p.br = [t + 0.12, 0.1, t - 0.2, 0.05]; p.si = 0; p.neig = 0.06; return arme(p, armL, armR); }
    const a = art || (AM_TISCH[armL] || AM_TISCH[armR] ? 'tisch' : IM_GESPRAECH[armL] || IM_GESPRAECH[armR] ? 'gespraech' : 'zuhoeren');
    if (a === 'tisch') { p.neig = 0.17; p.pf = -0.06; p.kn = 0.07; }
    else if (a === 'gespraech') { p.neig = 0.09; p.pf = -0.05; }
    else if (a === 'sessel') { p.neig = -0.15; p.pf = -0.09; }
    else { p.neig = -0.09; p.pf = -0.045; }
    return arme(p, armL, armR);
  }
  const SCHRITT_M = 0.7, STAND = 0.6, VORN = 0.34, ABROLL = 0.72;
  function geh(ph, tr = '', weit = 1, wR = weit, wL = weit, wN = weit) {
    const p = neutral(), hub = Math.min(1, weit / 0.7);
    p.py = -(0.012 + 0.034 * hub) - 0.022 * hub * Math.cos(2 * ph + 0.3 * 4 * PI) - 0.02 * Math.max(0, weit - 1); p.neig = 0.02 + 0.03 * hub + 0.08 * Math.max(0, weit - 1);
    const hoch = B.hy + p.py - 0.01, max = B.os + B.us - 0.004;
    const bein = (f, w) => {
      const weg = 2 * SCHRITT_M * w * STAND, vorn = VORN * w, hb = Math.min(1, w / 0.6), hn = Math.min(1, wN / 0.6), roll = ABROLL * hb;
      const u = (((f / (2 * PI) + 0.3) % 1) + 1) % 1; let x, y = 0.085, fuss = 0;
      if (u < STAND) {
        const xl = vorn - weg * (u / STAND), ab = weich((u - STAND * 0.66) / (STAND * 0.34)) * roll;
        x = xl + 0.14 * (1 - Math.cos(ab)); y = 0.085 + 0.14 * Math.sin(ab); fuss = u < 0.07 ? 0.3 * hb * (1 - u / 0.07) : -ab;
      } else {
        const s = (u - STAND) / (1 - STAND), x0 = vorn - weg + 0.14 * (1 - Math.cos(roll)), e = s * s * (3 - 2 * s);
        x = lerp(x0, VORN * wN, e); y = 0.085 + 0.14 * Math.sin(roll) * (1 - s) * (1 - s) + 0.075 * lerp(hb, hn, s) * Math.sin(PI * s); fuss = lerp(-roll, 0.3 * hn, weich(s * 1.15));
      }
      const Y = hoch - y, D = Math.min(max, Math.hypot(x, Y)), phi = Math.atan2(x, Y), A = Math.acos(grenze((B.os * B.os + D * D - B.us * B.us) / (2 * B.os * D), -1, 1)), K = Math.acos(grenze((B.os * B.os + B.us * B.us - D * D) / (2 * B.os * B.us), -1, 1));
      return [phi + A, 0.03, PI - K, fuss];
    };
    const arm = (f, traegt) => { const c = Math.cos(f + 0.3 * 2 * PI - 0.25 - (traegt ? 0.45 : 0)), k = traegt ? 0.22 : 1; return [(0.36 * c * hub + 0.03) * k, 0.07, traegt ? 0.12 : 0.2 + 0.08 * hub + 0.24 * hub * Math.max(0, c), 0.12]; };
    p.br = bein(ph, wR); p.bl = bein(ph + PI, wL); p.ar = arm(ph + PI, tr === 'r'); p.al = arm(ph, tr === 'l'); if (tr === 'r') p.hr = 'greift'; if (tr === 'l') p.hl = 'greift';
    const w = ph + 0.3 * 2 * PI; p.dreh = 0.12 * hub * Math.cos(w); p.px = 0.014 * hub * Math.sin(w - 0.5); p.seit = 0.02 * hub * Math.sin(w - 0.5); p.kn = 0.02; p.kd = -0.06 * hub * Math.cos(w);
    return p;
  }
  function hocke(t, armL = 'schoss', armR = 'schoss') {
    const p = neutral(); p.py = -(B.os + B.us) * (1 - Math.cos(t)) * 0.98; p.bl = [t, 0.07, 2 * t, 0]; p.br = [t, 0.07, 2 * t, 0]; return arme(p, armL, armR);
  }
  function zwischen(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    const p = {}; for (const k in a) { const x = a[k], y = b[k]; p[k] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], t)) : typeof x === 'number' || typeof x === 'boolean' ? lerp(+x, +(y ?? x), t) : t < 0.5 ? x : y; }
    return p;
  }
  const rausch = (t, saat, tempo = 1) => 0.6 * Math.sin(t * 0.00071 * tempo + saat * 12.9) + 0.4 * Math.sin(t * 0.00123 * tempo + saat * 4.7 + 1.3);
  const zufall = (n, saat) => { const x = Math.sin(n * 127.1 + saat * 311.7) * 43758.5453; return x - Math.floor(x); };
  const stufe = (t, saat, takt, weichMs = 160) => { const u = (t + saat * 977) / takt, n = Math.floor(u), a = zufall(n - 1, saat), b = zufall(n, saat); return lerp(a, b, weich(((u - n) * takt) / weichMs)); };
  const sanft = (u) => { u = grenze(u, 0, 1); return u * u * u * (u * (6 * u - 15) + 10); };
  const bogen = (ms, an, halt, ab) => (ms <= 0 ? 0 : ms < an ? sanft(ms / an) : ms < an + halt ? 1 : 1 - sanft((ms - an - halt) / ab));
  function sig(p) { let h = 7; for (const k in p) { const v = p[k]; if (typeof v === 'number') h = (h * 31 + Math.round(v * 500)) | 0; else if (Array.isArray(v)) for (const x of v) h = (h * 31 + Math.round(x * 500)) | 0; else if (typeof v === 'string') h = (h * 31 + v.length * 7 + (v.charCodeAt(0) || 0)) | 0; } return h; }
  function leben(p, t, saat) {
    if (!t) return p;
    const sa = ((saat % 1) + 1) % 1, takt = 3200 + sa * 2600, bl = (t + saat * 1700) % takt; p.blinz = bl < 150 || (bl > 420 && bl < 540 && saat % 2 > 1.4) ? 1 : 0;
    p.schau = (zufall(Math.floor((t + saat * 3224) / (2300 + sa * 2100)), saat + 3.3) * 2 - 1) * 0.8;
    return p;
  }
  function gespraech(t, paar = 0, teil = 0) {
    const u = t * 0.00023 + paar * 7.13 + 0.35 * rausch(t, paar + 2.2, 0.22), n = Math.floor(u), f = u - n, dran = (((n % 2) + 2) % 2) === (teil ? 1 : 0), an = weich(f / 0.07) * (1 - weich((f - 0.86) / 0.1));
    return { rede: dran ? an : 0, nick: dran ? 0 : Math.max(0, Math.sin((f - 0.38) * PI * 5)) * (f > 0.38 && f < 0.78 ? 1 : 0) };
  }
  function reden(p, t, saat, paar = 0, teil = 0) {
    if (!t) return p;
    const g = gespraech(t, paar, teil), n1 = rausch(t, saat + 1.7, 1.5), n2 = rausch(t, saat + 2.9, 1.1);
    p.mund = g.rede > 0.05 ? g.rede * (0.3 + 0.5 * Math.abs(Math.sin(t * 0.011 + saat * 3))) : 0; p.kn += 0.075 * g.nick + 0.03 * g.rede * n1;
    for (const [A, h] of [[p.ar, p.hr], [p.al, p.hl]]) if (h === 'offen') { A[0] += g.rede * (0.14 * n1 + 0.05); A[2] += g.rede * 0.22 * n2 - (1 - g.rede) * 0.35; A[1] += g.rede * 0.06 * n2; }
    p.rede = g.rede; return p;
  }
  const B = { hy: 0.93, ob: 0.285, ub: 0.255, hand: 0.165, os: 0.43, us: 0.415 };
  const HB = 0.09, TRINKT = [0.75, 0.12, 2.3, 0.5];
  function skelett(p, m, knick = true) {
    const E = m.eig, ei = p.ei || 0, stw = p.st || 0, si = p.si || 0, sbk = Math.sin(p.bk || 0), neig = p.neig + 0.05 * E.rund;
    let al = p.al, ar = p.ar, hl = p.hl, hr = p.hr, dl = null, dr = null, bl = p.bl, br = p.br, py = p.py, ks = p.ks, kn = p.kn, ausR = p.aus ?? 0.13, ausL = ausR, knL = p.kl ? [p.kl, 1] : null, knR = p.kr ? [p.kr, 1] : null;
    if (ei > 0.01) {
      const gl = EIGEN[E.l], gr = EIGEN[E.r], wl = ei * (p.fl || 0) * (gl.paar ? p.fr || 0 : 1), wr = ei * (p.fr || 0) * (gr.paar ? p.fl || 0 : 1);
      if (wl > 0.01 && gl.a) { const z = ARME[gl.a], t = weich(wl); al = al.map((v, i) => lerp(v, z[i], t)); if (KNICK[gl.a]) knL = [gl.a, t]; if (wl > 0.5) { hl = gl.h; dl = gl.d || null; } }
      if (wr > 0.01 && gr.a) { const z = ARME[gr.a], t = weich(wr); ar = ar.map((v, i) => lerp(v, z[i], t)); if (KNICK[gr.a]) knR = [gr.a, t]; if (wr > 0.5) { hr = gr.h; dr = gr.d || null; } }
      ks += E.ks * ei;
      const zug = (p.zug || 0) * ei;
      if (zug > 0.01) for (const [g2, w2, li] of [[gl, wl, 1], [gr, wr, 0]]) if (w2 > 0.5) { let A = li ? al : ar;
        if (g2.a === 'becher') { A = A.map((v, i) => lerp(v, TRINKT[i], zug)); kn -= 0.1 * zug; } else if (g2.a === 'mappe') { A = A.map((v, i) => v + [0.12, 0, -0.3, -0.25][i] * zug); kn += 0.24 * zug; } else if (g2.a === 'kinn') { A = A.map((v, i) => v + [0, 0, -0.16, 0][i] * zug); kn += 0.06 * zug; }
        if (li) al = A; else ar = A; }
    }
    if (stw > 0.001) {
      const w = p.w || 0;
      const ziel = (s) => { const frei = Math.max(0, -s * w), roll = ei * E.spitze * weich((frei - 0.25) / 0.5); return { x: s * (0.105 + ei * E.breit), z: ei * s * E.vor * 0.5 + 0.14 * (1 - Math.cos(roll)), y: 0.085 + 0.14 * Math.sin(roll), fuss: -roll, frei }; };
      const lage = (s, Z) => { const dx = s * (Z.x - (p.px + s * HB)); let ab = dx / 0.596; ab -= (B.os * Math.sin(ab) + B.us * Math.sin(0.4 * ab) - dx) / (B.os * Math.cos(ab) + 0.4 * B.us * Math.cos(0.4 * ab));
        const l1 = B.os * Math.cos(ab), l2 = B.us / Math.hypot(Math.sin(0.4 * ab), 1); return { ab, l1, l2, x: Z.z - p.pf, max: l1 + l2 - 0.0015 }; };
      const ZR = ziel(1), ZL = ziel(-1), GR = lage(1, ZR), GL = lage(-1, ZL);
      const hoch = (s, Z, G) => Math.sqrt(Math.max(0.01, G.max * G.max - G.x * G.x)) + Z.y - s * HB * sbk + 0.01;
      const hy = Math.min(hoch(1, ZR, GR), hoch(-1, ZL, GL));
      const loes = (s, Z, G) => { const Y = hy - 0.01 + s * HB * sbk - Z.y, D = Math.min(G.max, Math.hypot(G.x, Y)), phi = Math.atan2(G.x, Y), A = Math.acos(grenze((G.l1 * G.l1 + D * D - G.l2 * G.l2) / (2 * G.l1 * D), -1, 1)), K = Math.acos(grenze((G.l1 * G.l1 + G.l2 * G.l2 - D * D) / (2 * G.l1 * G.l2), -1, 1)); return [phi + A, G.ab, PI - K, Z.fuss]; };
      const nR = loes(1, ZR, GR), nL = loes(-1, ZL, GL);
      py = lerp(p.py, hy - B.hy, stw); br = br.map((v, i) => lerp(v, nR[i], stw)); bl = bl.map((v, i) => lerp(v, nL[i], stw));
      ausR = lerp(ausR, E.aus + 0.1 * ZR.frei, ei * stw); ausL = lerp(ausL, E.aus + 0.1 * ZL.frei, ei * stw);
    }
    if (si > 0.001) { const Z = SITZART[E.sitz]; if (Z) { br = br.map((v, i) => v + si * Z[0][i]); bl = bl.map((v, i) => v + si * Z[1][i]); } if (E.sitz === 'weit') ausR = ausL = lerp(ausR, 0.3, si); }
    const hip = [p.px, B.hy + py, p.pf];
    const sn = Math.sin(neig), cn = Math.cos(neig), ss = Math.sin(p.seit), cs = Math.cos(p.seit), T = [ss, cn * cs, sn * cs];
    const sp = (y, v = 0) => [hip[0] + T[0] * y, hip[1] + T[1] * y - sn * v, hip[2] + T[2] * y + cn * v];
    const st = Math.sin(p.dreh), ct = Math.cos(p.dreh), sc = sp(0.475), sb = m.sb, hb = m.hb, ssk = Math.sin(p.sk || 0);
    const schulter = (s, heb) => [sc[0] + s * cs * ct * sb, sc[1] - s * ss * sb + s * ssk * sb + heb, sc[2] + s * st * sb];
    const arm = (S, A, s, kq) => {
      const a = A[0] + neig * 0.5, U = [s * Math.sin(A[1]), -Math.cos(a) * Math.cos(A[1]), Math.sin(a) * Math.cos(A[1])], el = [S[0] + U[0] * B.ob, S[1] + U[1] * B.ob, S[2] + U[2] * B.ob];
      const a2 = a + A[2], b2 = A[1] - A[3], F = [s * Math.sin(b2), -Math.cos(a2) * Math.cos(b2), Math.sin(a2) * Math.cos(b2)], hg = [el[0] + F[0] * B.ub, el[1] + F[1] * B.ub, el[2] + F[2] * B.ub];
      let G = F; if (kq && knick) { const K = KNICK[kq[0]], u = K[3] * kq[1], g = [lerp(F[0], s * K[0], u), lerp(F[1], K[1], u), lerp(F[2], K[2], u)], n = Math.hypot(g[0], g[1], g[2]) || 1; G = [g[0] / n, g[1] / n, g[2] / n]; }
      return { s: S, e: el, h: hg, f: [hg[0] + G[0] * B.hand, hg[1] + G[1] * B.hand, hg[2] + G[2] * B.hand], F };
    };
    const bein = (L, s, aus) => {
      const H = [hip[0] + s * hb, hip[1] - 0.01 + s * hb * sbk, hip[2] - s * st * 0.4 * hb], U = [s * Math.sin(L[1]), -Math.cos(L[0]) * Math.cos(L[1]), Math.sin(L[0]) * Math.cos(L[1])], kn = [H[0] + U[0] * B.os, H[1] + U[1] * B.os, H[2] + U[2] * B.os];
      const a2 = L[0] - L[2], V = [s * Math.sin(L[1] * 0.4), -Math.cos(a2), Math.sin(a2)], kc = Math.hypot(V[0], V[1], V[2]), an = [kn[0] + (V[0] / kc) * B.us, kn[1] + (V[1] / kc) * B.us, kn[2] + (V[2] / kc) * B.us];
      const fp = L[3], D = [s * aus, Math.sin(fp), Math.cos(fp)];
      const ferse = [an[0] - D[0] * 0.045, an[1] - 0.045 - D[1] * 0.045, an[2] - D[2] * 0.045], spitze = [an[0] + D[0] * 0.165, an[1] - 0.054 + D[1] * 0.165, an[2] + D[2] * 0.165];
      return { h: H, k: kn, a: an, ferse, spitze, tief: Math.min(ferse[1] - 0.04, spitze[1] - 0.031) };
    };
    const hals = sp(0.555, 0.008), kopf = [hals[0] + Math.sin(ks) * 0.13, hals[1] + 0.128 * Math.cos(kn * 0.7), hals[2] + 0.128 * Math.sin(kn * 0.7) + 0.024 + 0.024 * E.rund];
    const R = arm(schulter(1, p.hebR), ar, 1, knR), L = arm(schulter(-1, p.hebL), al, -1, knL), bR = bein(br, 1, ausR), bL = bein(bl, -1, ausL);
    return { hip, sp, T, R, L, bR, bL, hals, kopf, hl, hr, dl, dr, grund: (+p.boden || 0) * Math.min(bR.tief, bL.tief) };
  }
  function kapsel(g, ax, ay, ra, bx, by, rb) { const w = Math.atan2(by - ay, bx - ax); g.moveTo(ax + ra * Math.cos(w + PI / 2), ay + ra * Math.sin(w + PI / 2)); g.arc(ax, ay, ra, w + PI / 2, w + PI * 1.5); g.arc(bx, by, rb, w - PI / 2, w + PI / 2); g.closePath(); }
  const kap = (g, s, zu = 0) => kapsel(g, s.a[0], s.a[1], s.ra + zu, s.b[0], s.b[1], s.rb + zu);
  function zug(q, P0, dx = 0, dy = 0) {
    const n = P0.length; let fl = 0; for (let i = 0; i < n; i++) { const a = P0[i], b = P0[(i + 1) % n]; fl += a[0] * b[1] - b[0] * a[1]; }
    const P = fl < 0 ? P0.slice().reverse() : P0; q.moveTo(P[0][0] + dx, P[0][1] + dy);
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n]; q.bezierCurveTo(b[0] + (c[0] - a[0]) / 6 + dx, b[1] + (c[1] - a[1]) / 6 + dy, c[0] - (d[0] - b[0]) / 6 + dx, c[1] - (d[1] - b[1]) / 6 + dy, c[0] + dx, c[1] + dy); }
    q.closePath();
  }
  const eck = (g, P) => { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); };
  const fuell = (g, farbe, fn) => { g.beginPath(); fn(g); g.fillStyle = farbe; g.fill(); };
  const strich = (g, farbe, breite, fn, a = 1) => { g.beginPath(); fn(g); g.strokeStyle = farbe; g.lineWidth = breite; g.lineCap = 'round'; g.lineJoin = 'round'; if (a < 1) g.globalAlpha = a; g.stroke(); if (a < 1) g.globalAlpha = 1; };
  const RUMPF = {
    a: [[-0.07, 0.15, 0.1, -0.012], [0.02, 0.17, 0.114, -0.016], [0.17, 0.152, 0.104, 0.004], [0.35, 0.182, 0.12, 0.018], [0.47, 0.212, 0.104, 0.004], [0.528, 0.14, 0.078, 0], [0.572, 0.056, 0.058, 0.012]],
    b: [[-0.07, 0.158, 0.106, -0.014], [0.02, 0.184, 0.12, -0.02], [0.17, 0.134, 0.096, 0.004], [0.345, 0.166, 0.126, 0.03], [0.47, 0.19, 0.098, 0.004], [0.528, 0.124, 0.072, 0], [0.572, 0.05, 0.054, 0.012]],
  };
  function sichtVon(m, sk, o, x0, y0, k) {
    const dreh = o.dreh || 0, cd = Math.cos(dreh), sd = Math.sin(dreh), auge = (o.auge ?? 1.5) / m.gr, dz = Math.max(1.2, (o.dz ?? 6) / m.gr);
    return (q) => { const vx = -q[0] * cd + q[2] * sd, vy = q[1] - sk.grund, vz = q[0] * sd + q[2] * cd, nah = 1 + grenze(vz / dz, -0.25, 0.25); return [x0 + vx * k * nah, y0 - vy * k + vz * k * grenze((auge - vy) / dz, -0.14, 0.45), nah, vz]; };
  }
  function rahmen(m, p, o) {
    const sk = skelett(p, m), pt = sichtVon(m, sk, o, 0, 0, m.gr), R = { l: 0.2, r: 0.2, o: 0, u: 0 };
    for (const q of [sk.hip, sk.kopf, sk.hals, sk.R.s, sk.R.e, sk.R.h, sk.R.f, sk.L.s, sk.L.e, sk.L.h, sk.L.f, sk.bR.h, sk.bR.k, sk.bR.a, sk.bR.ferse, sk.bR.spitze, sk.bL.h, sk.bL.k, sk.bL.a, sk.bL.ferse, sk.bL.spitze]) { const b = pt(q); R.l = Math.max(R.l, -b[0]); R.r = Math.max(R.r, b[0]); R.o = Math.max(R.o, -b[1]); R.u = Math.max(R.u, b[1]); }
    R.o += 0.15 * m.gr; return R;
  }
  function malen(g, m, p, x0, y0, k0, o) {
    const k = k0 * m.gr, sk = skelett(p, m, !(o.fein === false || k < STUFEN[0])), dreh = o.dreh || 0, cd = Math.cos(dreh), sd = Math.sin(dreh), pt = sichtVon(m, sk, o, x0, y0, k);
    const D = o.fein === false || k < STUFEN[0] ? 0 : k < STUFEN[1] ? 1 : 2, T = toene(m, o.licht), L = o.L || [-0.5, -0.86], lx = L[0], ly = L[1];
    const kante = D && o.saum && o.saum.a > 0.02 ? `rgba(${o.saum.farbe},${Math.min(1, o.saum.a * 1.9)})` : null, gegen = D && o.licht.gegen ? `rgba(${o.licht.gegen},${o.licht.gegenA ?? 0.3})` : null;
    const leicht = !!o.leicht;
    const teile = [];
    const seg = (a, b, ra, rb, ton, oa) => ({ a, b, ra: ra * k * a[2], rb: rb * k * b[2], ton, oa });
    const mitte = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    const gliedMal = (gg, S, os, falten) => {
      const N = S.map((s) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], len = Math.hypot(dx, dy), nx = len > 0.5 ? -dy / len : -lx, ny = len > 0.5 ? dx / len : -ly, nl = nx * lx + ny * ly; return [nx, ny, nl >= 0 ? -1 : 1, Math.abs(nl), len]; });
      for (const s of S) fuell(gg, s.ton.d, (q) => kap(q, s));
      S.forEach((s, i) => { const [nx, ny, sch, , ] = N[i], e = 0.23, ea = s.oa ? 0 : e; fuell(gg, s.ton.m, (q) => kapsel(q, s.a[0] - sch * nx * s.ra * ea, s.a[1] - sch * ny * s.ra * ea, s.ra * (1 - ea), s.b[0] - sch * nx * s.rb * e, s.b[1] - sch * ny * s.rb * e, s.rb * (1 - e))); });
      if (D && !leicht) S.forEach((s, i) => { const [nx, ny, sch, quer, len] = N[i]; if (s.ra < 2.5 || len < s.ra) return;
        if (!os) strich(gg, kante || s.ton.l, Math.max(1, s.ra * 0.1), (q) => { q.moveTo(s.a[0] - sch * nx * s.ra * 0.88, s.a[1] - sch * ny * s.ra * 0.88); q.lineTo(s.b[0] - sch * nx * s.rb * 0.88, s.b[1] - sch * ny * s.rb * 0.88); }, 0.22 + 0.55 * quer);
        if (gegen && !os) strich(gg, gegen, Math.max(1, s.ra * 0.09), (q) => { q.moveTo(s.a[0] + sch * nx * s.ra * 0.92, s.a[1] + sch * ny * s.ra * 0.92); q.lineTo(s.b[0] + sch * nx * s.rb * 0.92, s.b[1] + sch * ny * s.rb * 0.92); });
      });
      if (D && falten && !leicht) for (const J of falten) {
        const st = S.find((q) => q.b === J), nb = S.find((q) => q.a === J); if (!st || !nb || st.rb < 3) continue;
        const r = st.rb, w1 = Math.atan2(J[1] - st.a[1], J[0] - st.a[0]), w2 = Math.atan2(nb.b[1] - J[1], nb.b[0] - J[0]); let kn = w2 - w1; while (kn > PI) kn -= 2 * PI; while (kn < -PI) kn += 2 * PI;
        const seite = kn > 0 ? 1 : -1, wm = (w1 + w2) / 2 + (seite * PI) / 2, staerke = Math.min(1, 0.3 + Math.abs(kn)), ax = Math.cos((w1 + w2) / 2), ay = Math.sin((w1 + w2) / 2);
        for (const [ab, l2] of D > 1 && Math.abs(kn) > 0.3 ? [[-0.34, 0.5], [0.02, 0.72], [0.36, 0.44]] : [[0, 0.6]]) { const cx = J[0] + ax * r * ab, cy = J[1] + ay * r * ab;
          strich(gg, st.ton.t, Math.max(1, r * 0.09), (q) => { q.moveTo(cx + Math.cos(wm) * r * 0.92, cy + Math.sin(wm) * r * 0.92); q.quadraticCurveTo(cx + Math.cos(wm) * r * 0.4 + ax * r * 0.12, cy + Math.sin(wm) * r * 0.4 + ay * r * 0.12, cx + Math.cos(wm) * r * (0.92 - l2 * 1.5), cy + Math.sin(wm) * r * (0.92 - l2 * 1.5)); }, (Math.abs(kn) > 0.3 ? 0.55 : 0.4) * staerke); }
      }
    };
    const glied = (S, d, os, falten, extra) => teile.push({ d, pfad: () => { const q = new Path2D(); for (const s of S) kap(q, s); return q; }, mal: (gg) => { gliedMal(gg, S, os, falten); if (extra) extra(gg); } });
    const rock = m.unter.art === 'rock', schn = m.unter.schnitt === 'schmal' ? 0.9 : m.unter.schnitt === 'weit' ? 1.14 : 1, hf = m.b ? 1.04 : 1, vorn = cd, seitlich = sd;
    for (const bn of [sk.bR, sk.bL]) {
      const H = pt(bn.h), Kn = pt(bn.k), A = pt(bn.a), F = pt(bn.ferse), Z = pt(bn.spitze), bt = rock ? T.haut : T.unter, d0 = (H[3] + 2 * Kn[3] + A[3]) / 4, dB = Kn[3] - H[3] < 0.2 ? Math.min(d0, pt(sk.hip)[3] + 0.003) : d0;
      const kr = 0.066 * schn, wr = 0.067 * schn, sr = m.unter.schnitt === 'schmal' ? 0.047 : m.unter.schnitt === 'weit' ? 0.072 : 0.057, fein = D && !leicht && !rock;
      const As = m.unter.kurz && !rock && !leicht ? mitte(Kn, A, 0.86) : A, ul = Math.hypot(As[0] - Kn[0], As[1] - Kn[1]), se = sr * k * As[2], Ae = fein ? mitte(Kn, As, 1 - Math.min(0.3, (0.8 * se) / (ul || 1))) : As, Wd = mitte(Kn, A, 0.3);
      const S = rock ? [seg(H, Kn, 0.074, 0.05, bt, 1), seg(Kn, mitte(Kn, A, 0.34), 0.05, 0.054, bt), seg(mitte(Kn, A, 0.34), A, 0.054, 0.034, bt)] : fein ? [seg(H, Kn, 0.098 * hf, kr, bt, 1), seg(Kn, Wd, kr, wr, bt), seg(Wd, Ae, wr, sr, bt)] : [seg(H, Kn, 0.098 * hf, kr, bt, 1), seg(Kn, As, kr, sr, bt)];
      if (As !== A) glied([seg(As, A, 0.04, 0.034, T.haut)], dB - 0.001, true, null, null);
      glied(S, dB, true, rock ? null : [Kn], fein && ul > se ? (gg) => {
        const ux = (As[0] - Kn[0]) / ul, uy = (As[1] - Kn[1]) / ul, qx = -uy, qy = ux, sch = qx * lx + qy * ly >= 0 ? -1 : 1, C = [As[0] + ux * se * 0.3, As[1] + uy * se * 0.3], b2 = se;
        fuell(gg, bt.m, (q) => eck(q, [[Ae[0] - qx * se, Ae[1] - qy * se], [Ae[0] + qx * se, Ae[1] + qy * se], [C[0] + qx * b2, C[1] + qy * b2], [C[0] - qx * b2, C[1] - qy * b2]]));
        fuell(gg, bt.d, (q) => eck(q, [[Ae[0] + sch * qx * se, Ae[1] + sch * qy * se], [C[0] + sch * qx * b2, C[1] + sch * qy * b2], [C[0] + sch * qx * b2 * 0.56, C[1] + sch * qy * b2 * 0.56], [Ae[0] + sch * qx * se * 0.54, Ae[1] + sch * qy * se * 0.54]]));
        strich(gg, bt.t, Math.max(1, 0.011 * k), (q) => { q.moveTo(C[0] - qx * b2 * 0.86, C[1] - qy * b2 * 0.86 - uy * 0.006 * k); q.lineTo(C[0] + qx * b2 * 0.86, C[1] + qy * b2 * 0.86 - uy * 0.006 * k); }, 0.6);
        const fx2 = As[0] - ux * se * 1.5, fy2 = As[1] - uy * se * 1.5, vs = Z[0] - F[0] >= 0 ? 1 : -1;
        strich(gg, bt.t, Math.max(1, 0.007 * k), (q) => { q.moveTo(fx2 + vs * qx * se * 0.95, fy2 + vs * qy * se * 0.95 - uy * se * 0.1); q.quadraticCurveTo(fx2 + ux * se * 0.5, fy2 + uy * se * 0.5, fx2 - vs * qx * se * 0.5, fy2 - vs * qy * se * 0.5 + uy * se * 0.25); }, 0.42);
        if (D > 1 && vorn > 0.3) { const r = kr * k * Kn[2]; strich(gg, bt.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(Kn[0] - r * 0.5, Kn[1] + r * 0.25); q.quadraticCurveTo(Kn[0], Kn[1] + r * 0.7, Kn[0] + r * 0.5, Kn[1] + r * 0.25); }, 0.3); }
      } : null);
      teile.push({ d: rock ? (F[3] + Z[3]) / 2 + 0.004 : dB - 0.002, pfad: () => { const q = new Path2D(); kapsel(q, F[0], F[1], 0.046 * k * F[2], Z[0], Z[1], 0.036 * k * Z[2]); return q; }, mal: (gg) => schuh(gg, m, T, A, F, Z, k, lx, ly, D, rock) });
    }
    const Q = m.Q, atem = 1 + 0.012 * (p.atem || 0), ebene = (i) => {
      const [y, a, b, v] = Q[i], gew = grenze((y - 0.02) / 0.44, 0, 1), w = dreh - p.dreh * gew, c = pt(sk.sp(y, v));
      return { c, w: Math.hypot(a * m.w * Math.cos(w), b * (0.6 + 0.4 * m.w) * (i === 3 ? atem : 1) * Math.sin(w)) * k * c[2] };
    };
    const E = Q.map((_, i) => ebene(i)), unten = E[0].c, oben = E[E.length - 1].c, al = Math.hypot(oben[0] - unten[0], oben[1] - unten[1]) || 1, nx = -(oben[1] - unten[1]) / al, ny = (oben[0] - unten[0]) / al;
    const kipp = [p.bk + p.seit, p.bk + p.seit, 0.4 * (p.bk + p.seit), 0.5 * p.sk, p.sk, p.sk, 0.3 * p.sk], ax = (oben[0] - unten[0]) / al, ay = (oben[1] - unten[1]) / al;
    const rand2 = (i, s, f = 1) => { const e = E[i], sh = -s * cd * kipp[i] * Q[i][1] * m.w * k * e.c[2] * f; return [e.c[0] + s * nx * e.w * f + ax * sh, e.c[1] + s * ny * e.w * f + ay * sh]; };
    const kontur = (von, bis, kappeU = 0) => { const li = [], re = []; for (let i = von; i <= bis; i++) { li.push(rand2(i, -1)); re.push(rand2(i, 1)); } if (kappeU) { const e = E[von]; li.unshift([e.c[0] - nx * e.w * 0.62, e.c[1] - ny * e.w * 0.62 + kappeU * k]); re.unshift([e.c[0] + nx * e.w * 0.62, e.c[1] + ny * e.w * 0.62 + kappeU * k]); } return [...li, ...re.reverse()]; };
    const rumpfTiefe = pt(sk.sp(0.25))[3], art = m.ober.art, rein = art === 'hemd' || art === 'bluse', lang = art === 'blazer' || art === 'hoodie', von = rein ? 2 : 1;
    const sSch = nx * lx + ny * ly >= 0 ? -1 : 1;
    const band = (gg, vonI, bisI, s, f0, f1, farbe) => fuell(gg, farbe, (q) => { const P = []; for (let i = vonI; i <= bisI; i++) P.push(rand2(i, s, f0)); for (let i = bisI; i >= vonI; i--) P.push(rand2(i, s, f1)); zug(q, P); });
    { const pk = kontur(0, 2, 0.03), dP = pt(sk.hip)[3] + 0.006;
      teile.push({ d: dP, pfad: () => { const q = new Path2D(); zug(q, pk); return q; }, mal: (gg) => { fuell(gg, T.unter.m, (q) => zug(q, pk)); band(gg, 0, 2, sSch, 0.96, 0.62, T.unter.d);
        if (D && rein) { const a = rand2(2, -1), b = rand2(2, 1), h = 0.03 * k; strich(gg, T.guertel.m, h, (q) => { q.moveTo(a[0] + nx * h * 0.4, a[1] + h * 0.6); q.lineTo(b[0] - nx * h * 0.4, b[1] + h * 0.6); });
          if (vorn > 0.25) { const mx = E[2].c[0] + Q[2][2] * seitlich * k * 0.9, my = E[2].c[1] + h * 0.6; fuell(gg, T.gold.m, (q) => q.rect(mx - h * 0.62, my - h * 0.6, h * 1.24, h * 1.2)); fuell(gg, T.guertel.m, (q) => q.rect(mx - h * 0.32, my - h * 0.3, h * 0.64, h * 0.6)); } }
        if (D > 1 && !leicht && !rock && vorn > 0.3) { const u = E[0].c, w0 = E[0].w, vx = Q[0][2] * seitlich * k * 0.9, ut = T.unter.t, lw2 = Math.max(1, 0.006 * k);
          for (const s2 of [-1, 1]) { strich(gg, ut, lw2, (q) => { q.moveTo(u[0] + vx + s2 * 0.012 * k, u[1] + 0.02 * k); q.quadraticCurveTo(u[0] + vx + s2 * w0 * 0.3, u[1] + 0.004 * k, u[0] + vx + s2 * w0 * 0.62, u[1] - 0.03 * k); }, 0.4);
            if (rein) strich(gg, ut, lw2, (q) => { const a = rand2(2, s2, 0.62), b = rand2(1, s2, 0.97); q.moveTo(a[0] + vx, a[1] + 0.04 * k); q.quadraticCurveTo(lerp(a[0], b[0], 0.75) + vx, lerp(a[1], b[1], 0.35), b[0], b[1] - 0.02 * k); }, 0.45); } } } }); }
    if (rock) {
      const kR = pt(sk.bR.k), kL = pt(sk.bL.k), li = kR[0] < kL[0] ? kR : kL, re = kR[0] < kL[0] ? kL : kR, sa = 0.088 * k;
      const P = [rand2(2, -1), rand2(1, -1, 1.04), [li[0] - sa, li[1] - 0.02 * k], [li[0] - sa * 0.6, li[1] + 0.05 * k], [re[0] + sa * 0.6, re[1] + 0.05 * k], [re[0] + sa, re[1] - 0.02 * k], rand2(1, 1, 1.04), rand2(2, 1)];
      teile.push({ d: Math.max(kR[3], kL[3], pt(sk.hip)[3]) + 0.012, pfad: () => { const q = new Path2D(); zug(q, P); return q; }, mal: (gg) => { fuell(gg, T.unter.m, (q) => zug(q, P));
        const s = sSch, a = s < 0 ? P[2] : P[5], b = s < 0 ? P[3] : P[4], c = s < 0 ? P[1] : P[6], w = (re[0] - li[0] + 2 * sa) * 0.24; fuell(gg, T.unter.d, (q) => zug(q, [c, a, b, [b[0] - s * w, b[1]], [a[0] - s * w * 0.9, a[1]], [c[0] - s * w * 0.6, c[1]]]));
        if (D) { strich(gg, T.unter.t, Math.max(1, 0.009 * k), (q) => { q.moveTo(P[3][0], P[3][1] - 0.022 * k); q.lineTo(P[4][0], P[4][1] - 0.022 * k); }, 0.6); if (D > 1) for (const t of [0.3, 0.52, 0.74]) strich(gg, T.unter.t, Math.max(1, 0.006 * k), (q) => { const x = lerp(P[3][0], P[4][0], t); q.moveTo(x, P[3][1] - 0.03 * k); q.lineTo(lerp(P[1][0], P[6][0], t), lerp(P[1][1], P[6][1], t) + 0.07 * k); }, 0.35); } } });
    }
    const ok = kontur(von, 6, lang ? 0.06 : rein ? 0.012 : 0.035), dO = Math.max(rumpfTiefe + 0.01, pt(sk.hip)[3] + 0.008), armPfade = [];
    teile.push({ d: dO, pfad: () => { const q = new Path2D(); zug(q, ok); return q; }, mal: (gg) => {
      const q = new Path2D(); zug(q, ok); gg.fillStyle = T.ober.m; gg.fill(q);
      if (!D) { band(gg, von, 5, sSch, 0.95, 0.6, T.ober.d); if (vorn > 0.2 && (art === 'blazer' || rein)) fuell(gg, art === 'blazer' ? T.zwei.m : T.haut.m, (h) => { const c = E[6].c, u = E[art === 'blazer' ? 2 : 4].c, b = E[6].w * 1.1 * vorn, v = Q[5][2] * seitlich * k * 0.9; eck(h, [[c[0] + v - b, c[1]], [c[0] + v + b, c[1]], [u[0] + v, u[1]]]); }); return; }
      if (leicht) { band(gg, von, 4, sSch, 0.96, 0.6, T.ober.d); kleid(gg); return; }
      gg.save(); gg.clip(q);
      band(gg, von, 4, sSch, 1.08, 0.6, T.ober.d); band(gg, von, 4, -sSch, 1.08, 0.95, kante || T.ober.l);
      if (D > 1) for (const [ap, ad] of armPfade) if (ad > dO) { gg.translate(-lx * 0.03 * k, -ly * 0.03 * k + 0.012 * k); gg.fillStyle = T.ober.d; gg.fill(ap); gg.translate(lx * 0.03 * k, ly * 0.03 * k - 0.012 * k); }
      kleid(gg);
      gg.restore();
    } });
    function kleid(gg) {
      const mi = (i, dy = 0) => { const e = E[i], v = Q[i][2] * seitlich * k * 0.9; return [e.c[0] + v, e.c[1] + dy * k]; }, lw = (f) => Math.max(1, f * k), hw = E[6].w;
      const c6 = mi(6), c5 = mi(5), c4 = mi(4), c3 = mi(3), c2 = mi(2), c1 = mi(1), br = hw * 1.22 * Math.max(0, vorn), zw = T.zwei, ob = T.ober;
      const quer = (i, dy, farbe, breit, a = 1) => strich(gg, farbe, breit, (h) => { const A = rand2(i, -1, 1.1), Z = rand2(i, 1, 1.1); h.moveTo(A[0], A[1] + dy * k); h.quadraticCurveTo(E[i].c[0], E[i].c[1] + (dy + 0.012) * k, Z[0], Z[1] + dy * k); }, a);
      if (vorn > 0.18) {
        if (art === 'blazer' && m.ober.offen) {
          const hy = c1[1] + 0.13 * k, g2 = [c2[0], c2[1] + 0.035 * k];
          fuell(gg, zw.m, (h) => eck(h, [[c6[0] - br, c6[1] - 0.01 * k], [c6[0] + br, c6[1] - 0.01 * k], [c3[0] + br * 0.8, c3[1]], [g2[0] + br * 0.74, g2[1]], [g2[0] - br * 0.74, g2[1]], [c3[0] - br * 0.8, c3[1]]]));
          fuell(gg, zw.d, (h) => eck(h, [[c6[0] + sSch * br, c6[1] - 0.01 * k], [c6[0] + sSch * br * 0.3, c6[1]], [g2[0] + sSch * br * 0.2, g2[1]], [g2[0] + sSch * br * 0.74, g2[1]], [c3[0] + sSch * br * 0.8, c3[1]]]));
          fuell(gg, T.unter.m, (h) => eck(h, [[g2[0] - br * 0.74, g2[1]], [g2[0] + br * 0.74, g2[1]], [c1[0] + br * 1.05, c1[1]], [c1[0] + br * 1.3, hy], [c1[0] - br * 1.3, hy], [c1[0] - br * 1.05, c1[1]]]));
          strich(gg, T.guertel.m, lw(0.024), (h) => { h.moveTo(g2[0] - br * 0.74, g2[1] + 0.012 * k); h.lineTo(g2[0] + br * 0.74, g2[1] + 0.012 * k); }); if (!leicht) fuell(gg, T.gold.m, (h) => h.rect(g2[0] - 0.014 * k, g2[1], 0.028 * k, 0.024 * k));
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.8, c6[1] - 0.012 * k], [c6[0] + br * 0.8, c6[1] - 0.012 * k], [c5[0], c5[1] + 0.05 * k]]));
          if (D > 1) { strich(gg, zw.t, lw(0.005), (h) => { h.moveTo(c5[0], c5[1] + 0.05 * k); h.lineTo(g2[0], g2[1]); }, 0.4); for (const t of [0.3, 0.55, 0.8]) fuell(gg, zw.t, (h) => h.arc(lerp(c5[0], g2[0], t), lerp(c5[1] + 0.05 * k, g2[1], t), lw(0.005), 0, PI * 2)); }
          for (const s of [-1, 1]) { const u = [c3[0] + s * br * 0.8, c3[1] + 0.03 * k], P = [[c6[0] + s * br * 1.02, c6[1] - 0.012 * k], [c4[0] + s * br * 1.9, c4[1] + 0.03 * k], [c3[0] + s * br * 1.4, c3[1] - 0.01 * k], u, [c3[0] + s * br * 0.8, c3[1] - 0.02 * k]];
            fuell(gg, s === sSch ? ob.d : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(P[1][0], P[1][1]); h.lineTo(P[2][0], P[2][1]); h.lineTo(u[0], u[1]); }, 0.55);
            if (!leicht) fuell(gg, s === sSch ? ob.t : ob.d, (h) => eck(h, [u, [g2[0] + s * br * 0.74, g2[1]], [c1[0] + s * br * 1.05, c1[1]], [c1[0] + s * br * 1.3, hy], [c1[0] + s * br * 1.62, hy], [c1[0] + s * br * 1.34, c1[1]], [g2[0] + s * br * 1.0, g2[1]], [u[0] + s * br * 0.2, u[1]]]));
            if (D > 1) strich(gg, ob.t, lw(0.006), (h) => { const x = c1[0] + s * E[1].w * 0.6; h.moveTo(x - 0.035 * k * vorn, c1[1] - 0.04 * k); h.lineTo(x + 0.035 * k * vorn, c1[1] - 0.035 * k); }, 0.5); }
        } else if (art === 'blazer') {
          const kn = [c2[0], c2[1] + 0.03 * k];
          fuell(gg, zw.m, (h) => eck(h, [[c6[0] - br, c6[1] - 0.01 * k], [c6[0] + br, c6[1] - 0.01 * k], [c3[0] + br * 0.72, c3[1]], kn, [c3[0] - br * 0.72, c3[1]]]));
          fuell(gg, zw.d, (h) => eck(h, [[c6[0] + sSch * br, c6[1] - 0.01 * k], [c6[0] + sSch * br * 0.3, c6[1]], kn, [c3[0] + sSch * br * 0.72, c3[1]]]));
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.8, c6[1] - 0.012 * k], [c6[0] + br * 0.8, c6[1] - 0.012 * k], [c5[0], c5[1] + 0.05 * k]]));
          if (D > 1) { strich(gg, zw.t, lw(0.005), (h) => { h.moveTo(c5[0], c5[1] + 0.05 * k); h.lineTo(kn[0], kn[1]); }, 0.4); for (const s of [-1, 1]) fuell(gg, zw.l, (h) => eck(h, [[c6[0] + s * br * 0.84, c6[1] - 0.016 * k], [c6[0] + s * br * 0.2, c5[1] + 0.012 * k], [c6[0] + s * br * 0.62, c5[1] + 0.05 * k]])); }
          for (const s of [-1, 1]) { const P = [[c6[0] + s * br * 1.02, c6[1] - 0.012 * k], [c4[0] + s * br * 1.9, c4[1] + 0.03 * k], [c3[0] + s * br * 1.28, c3[1] - 0.02 * k], kn, [c3[0] + s * br * 0.72, c3[1]]]; fuell(gg, s === sSch ? ob.d : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(P[1][0], P[1][1]); h.lineTo(P[2][0], P[2][1]); h.lineTo(P[3][0], P[3][1]); }, 0.55); }
          strich(gg, ob.t, lw(0.007), (h) => { h.moveTo(kn[0], kn[1]); h.quadraticCurveTo(kn[0] - sSch * 0.01 * k, lerp(kn[1], c1[1], 0.6), c1[0] + br * 0.3, c1[1] + 0.1 * k); }, 0.6);
          if (D > 1) { fuell(gg, ob.t, (h) => h.arc(kn[0] - br * 0.14, kn[1] + 0.018 * k, lw(0.008), 0, PI * 2)); for (const s of [-1, 1]) strich(gg, ob.t, lw(0.006), (h) => { const x = c1[0] + s * E[1].w * 0.56; h.moveTo(x - 0.035 * k * vorn, c1[1] - 0.04 * k); h.lineTo(x + 0.035 * k * vorn, c1[1] - 0.035 * k); }, 0.5); }
        } else if (rein) {
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.86, c6[1] - 0.012 * k], [c6[0] + br * 0.86, c6[1] - 0.012 * k], [c5[0], c5[1] + (art === 'bluse' ? 0.085 : 0.06) * k]]));
          strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(c5[0], c5[1] + 0.06 * k); h.lineTo(c2[0], c2[1]); }, 0.5);
          if (D > 1) { strich(gg, ob.l, lw(0.004), (h) => { h.moveTo(c5[0] + lw(0.012), c5[1] + 0.07 * k); h.lineTo(c2[0] + lw(0.012), c2[1]); }, 0.7); for (const t of [0.22, 0.5, 0.78]) fuell(gg, ob.t, (h) => h.arc(lerp(c5[0], c2[0], t), lerp(c5[1] + 0.06 * k, c2[1], t), lw(0.006), 0, PI * 2));
            if (art === 'hemd') strich(gg, ob.t, lw(0.005), (h) => { const x = c3[0] - 0.085 * k * vorn, y = c3[1] - 0.03 * k; h.rect(x - 0.03 * k * vorn, y, 0.06 * k * vorn, 0.065 * k); }, 0.4); }
          for (const s of [-1, 1]) { const P = [[c6[0] + s * br * 0.9, c6[1] - 0.022 * k], [c6[0] + s * br * 1.75, c6[1] + 0.02 * k], [c5[0] + s * br * 0.9, c5[1] + 0.07 * k], [c5[0] + s * br * 0.08, c5[1] + 0.045 * k]]; fuell(gg, m.ober.zwei ? zw.m : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.005), (h) => eck(h, P), 0.5); }
        } else if (art === 'hoodie') {
          for (const s of [-1, 1]) fuell(gg, s === sSch ? ob.t : ob.d, (h) => eck(h, [[c6[0] + s * br * 0.5, c6[1] - 0.02 * k], [c6[0] + s * br * 2.1, c6[1] + 0.005 * k], [c4[0] + s * br * 1.5, c4[1] + 0.05 * k], [c5[0] + s * br * 0.1, c5[1] + 0.085 * k]]));
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.006 * k, br * 0.8, 0.03 * k, 0, 0, PI));
          for (const s of [-1, 1]) { strich(gg, zw.m, lw(0.007), (h) => { h.moveTo(c5[0] + s * br * 0.3, c5[1] + 0.075 * k); h.lineTo(c5[0] + s * br * 0.36, c3[1] + 0.03 * k); }); if (D > 1) fuell(gg, zw.d, (h) => h.rect(c5[0] + s * br * 0.36 - lw(0.006), c3[1] + 0.02 * k, lw(0.012), lw(0.024))); }
          strich(gg, ob.t, lw(0.007), (h) => { const y = lerp(c2[1], c1[1], 0.25), w = E[1].w * 0.62 * vorn; h.moveTo(c1[0] - w, c1[1] + 0.035 * k); h.lineTo(c2[0] - w * 0.62, y); h.lineTo(c2[0] + w * 0.62, y); h.lineTo(c1[0] + w, c1[1] + 0.035 * k); }, 0.55);
        } else if (art === 'pulli') {
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 0.9, 0.026 * k, 0, 0, PI));
          strich(gg, ob.l, lw(0.018), (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 1.02, 0.036 * k, 0, 0.08, PI - 0.08)); strich(gg, ob.t, lw(0.005), (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 1.2, 0.05 * k, 0, 0.1, PI - 0.1), 0.45);
        } else {
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.002 * k, br * 1.0, 0.038 * k, 0, 0, PI));
          strich(gg, ob.d, lw(0.009), (h) => h.ellipse(c6[0], c6[1] - 0.002 * k, br * 1.06, 0.044 * k, 0, 0.05, PI - 0.05));
        }
      } else if (vorn < -0.1) {
        const hint = Math.min(1, (-0.1 - vorn) / 0.5), bh = hw * (1.3 - 0.4 * Math.abs(seitlich)), mx = c6[0] - 2 * Q[6][2] * seitlich * k * 0.9;
        if (art === 'hoodie') { const P = [[mx - bh * 1.5, c6[1] - 0.012 * k], [mx + bh * 1.5, c6[1] - 0.012 * k], [mx + bh * 1.75, c4[1] + 0.05 * k], [mx, c4[1] + 0.17 * k], [mx - bh * 1.75, c4[1] + 0.05 * k]]; fuell(gg, ob.d, (h) => zug(h, P)); fuell(gg, ob.m, (h) => zug(h, P.map((q) => [q[0] + lx * 0.012 * k - (q[0] - mx) * 0.1, q[1] - 0.016 * k]))); }
        else strich(gg, art === 'blazer' || rein ? (m.ober.zwei ? zw.m : ob.l) : ob.l, lw(art === 'shirt' ? 0.012 : 0.022), (h) => h.ellipse(mx, c6[1] + 0.012 * k, bh, 0.024 * k, 0, 0.1, PI - 0.1), 0.9 * hint);
        if (Math.abs(seitlich) < 0.7 && art !== 'hoodie') strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(E[5].c[0], E[5].c[1] + 0.04 * k); h.quadraticCurveTo(E[3].c[0] - seitlich * 0.03 * k, E[3].c[1], E[von].c[0], E[von].c[1] + 0.03 * k); }, 0.4 * hint);
        if (rein && D > 1) quer(4, 0.055, ob.t, lw(0.005), 0.4 * hint);
      }
      if (leicht) return;
      if (Math.abs(seitlich) < 0.85) for (const s2 of [-1, 1]) { const A4 = rand2(4, s2, 0.93), w3 = E[3].w; strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(A4[0], A4[1] + 0.09 * k); h.quadraticCurveTo(A4[0] - s2 * w3 * 0.2, A4[1] + 0.118 * k, A4[0] - s2 * w3 * 0.4, A4[1] + 0.1 * k); }, 0.36);
        if (D > 1) strich(gg, ob.t, lw(0.005), (h) => { h.moveTo(A4[0] - s2 * w3 * 0.04, A4[1] + 0.125 * k); h.quadraticCurveTo(A4[0] - s2 * w3 * 0.16, A4[1] + 0.15 * k, A4[0] - s2 * w3 * 0.3, A4[1] + 0.14 * k); }, 0.26); }
      for (const s2 of [-1, 1]) { const e2 = E[2], x2 = e2.c[0] + s2 * e2.w * 0.64; strich(gg, ob.t, lw(0.007), (h) => { h.moveTo(x2 + s2 * 0.012 * k, e2.c[1] - 0.075 * k); h.quadraticCurveTo(x2 - s2 * 0.028 * k, e2.c[1] + 0.005 * k, x2 + s2 * 0.014 * k, e2.c[1] + 0.075 * k); }, 0.42); }
      if (D > 1) { const e4 = E[4], sx = e4.c[0] + sSch * e4.w * 0.5; strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(sx, e4.c[1] + 0.05 * k); h.quadraticCurveTo(sx - sSch * 0.03 * k, lerp(e4.c[1], E[3].c[1], 0.5), sx - sSch * 0.012 * k, E[3].c[1] + 0.02 * k); }, 0.3); }
      if (!rein && art !== 'blazer') { quer(1, lang ? 0.045 : 0.024, ob.t, lw(0.007), 0.5); if (D > 1 && art !== 'shirt') quer(1, lang ? 0.07 : 0.05, ob.l, lw(0.005), 0.5); }
    }
    const kurzArm = art === 'shirt', weite = art === 'blazer' ? 1.08 : art === 'hoodie' ? 1.1 : art === 'pulli' ? 1.04 : 0.97, hochA = m.ober.hoch && rein;
    for (const [ar, s, ding, hp] of [[sk.R, 1, o.r || sk.dr, sk.hr], [sk.L, -1, o.l || sk.dl, sk.hl]]) {
      const S0 = pt(ar.s), El = pt(ar.e), S = mitte(S0, El, 0.13), Hg = pt(ar.h), Fi = pt(ar.f), neben = 0.03 * (s * sd > 0 ? 1 : s * sd < -0.2 ? -1 : 0) + 0.012, dU = (El[3] + Hg[3]) / 2 + neben, ob = T.ober, ht = T.haut;
      let St, extra = null;
      if (kurzArm) { const mi = mitte(S, El, 0.6); St = [seg(mi, El, 0.044, 0.038, ht), seg(El, Hg, 0.039, 0.029, ht), seg(S, mi, 0.052, 0.05, ob, 1)]; extra = D ? (gg) => { const u = St[2], w = Math.atan2(u.b[1] - u.a[1], u.b[0] - u.a[0]); strich(gg, ob.t, Math.max(1, 0.01 * k), (q) => q.arc(u.b[0], u.b[1], u.rb * 0.97, w - 1.3, w + 1.3), 0.6); } : null; }
      else if (hochA) { const mi = mitte(El, Hg, 0.3); St = [seg(mi, Hg, 0.04, 0.029, ht), seg(S, El, 0.052 * weite, 0.05 * weite, ob, 1), seg(El, mi, 0.05 * weite, 0.05 * weite, ob)]; extra = D ? (gg) => { const u = St[2], w = Math.atan2(u.b[1] - u.a[1], u.b[0] - u.a[0]); strich(gg, ob.l, Math.max(1.5, 0.026 * k), (q) => q.arc(u.b[0], u.b[1], u.rb * 0.9, w - 1.2, w + 1.2)); strich(gg, ob.t, Math.max(1, 0.006 * k), (q) => q.arc(u.b[0] - Math.cos(w) * 0.02 * k, u.b[1] - Math.sin(w) * 0.02 * k, u.rb * 0.97, w - 1.2, w + 1.2), 0.5); } : null; }
      else { const bu = mitte(El, Hg, 0.86); St = [seg(S, El, 0.053 * weite, 0.05 * weite, ob, 1), seg(El, Hg, 0.05 * weite, (art === 'hoodie' ? 0.044 : 0.04) * weite, ob)];
        extra = D ? (gg) => { const w = Math.atan2(Hg[1] - El[1], Hg[0] - El[0]), r = St[1].rb, cx = Math.cos(w), sy = Math.sin(w);
          if (art === 'blazer') strich(gg, T.zwei.m, Math.max(1.5, 0.02 * k), (q) => q.arc(Hg[0] + cx * 0.012 * k, Hg[1] + sy * 0.012 * k, r * 0.86, w - 1.25, w + 1.25));
          else if (rein) { strich(gg, ob.l, Math.max(1.5, 0.03 * k), (q) => q.arc(bu[0], bu[1], r * 0.84, w - 1.2, w + 1.2)); strich(gg, ob.t, Math.max(1, 0.005 * k), (q) => q.arc(bu[0] - cx * 0.016 * k, bu[1] - sy * 0.016 * k, r, w - 1.2, w + 1.2), 0.5); }
          else { strich(gg, ob.d, Math.max(1.5, 0.028 * k), (q) => q.arc(bu[0] + cx * 0.012 * k, bu[1] + sy * 0.012 * k, r * 0.86, w - 1.2, w + 1.2)); if (D > 1) strich(gg, ob.t, Math.max(1, 0.005 * k), (q) => q.arc(bu[0] - cx * 0.004 * k, bu[1] - sy * 0.004 * k, r, w - 1.2, w + 1.2), 0.5); }
          strich(gg, ob.t, Math.max(1, 0.006 * k), (q) => q.arc(Hg[0], Hg[1], r * 0.98, w - 1.3, w + 1.3), 0.55); } : null; }
      if (m.uhr && s < 0 && D > 1) { const e0 = extra; extra = (gg) => { if (e0) e0(gg); const w = Math.atan2(Hg[1] - El[1], Hg[0] - El[0]), r = 0.031 * k * Hg[2]; strich(gg, T.ding.m, Math.max(1.5, 0.016 * k), (q) => q.arc(Hg[0] + Math.cos(w) * 0.02 * k, Hg[1] + Math.sin(w) * 0.02 * k, r, w - 1.3, w + 1.3)); }; }
      if (D > 1) { const q0 = new Path2D(); for (const x of St) kap(q0, x); armPfade.push([q0, dU]); }
      glied(St, dU, false, kurzArm ? null : [El], extra);
      const hand = handBau(Hg, Fi, k, -s * (cd >= 0 ? 1 : -1), hp, !!ding);
      if (hp !== 'weg') teile.push({ d: dU + 0.0015, pfad: () => { const q = new Path2D(); for (const x of hand.S) kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5]); return q; }, mal: (gg) => handMal(gg, hand, T.haut, lx, ly, D, leicht) });
      if (ding) teile.push({ d: dU + (ding === 'tasche' ? -0.002 : ding === 'mappe' ? -0.006 : 0.008), pfad: () => { const q = new Path2D(); if (ding === 'tasche') { const w = 0.38 * k, hh = 0.28 * k, hx = (Hg[0] + Fi[0]) / 2, hy = (Hg[1] + Fi[1]) / 2; q.roundRect(hx - w / 2, hy + 0.1 * k, w, hh, 0.03 * k); } return q; }, mal: (gg) => halten(gg, ding, Hg, Fi, k, T, s, o, D) });
    }
    const Hl = pt(sk.hals), Ko = pt(sk.kopf), kw = dreh - p.kd, kk = k * Ko[2] * KOPF * m.kg, kt = Ko[3] + 0.04, K = kopfBau(m, Ko[0], Ko[1], kk, kw, p);
    { const hr = 0.052 + 0.006 * m.w, hx = Ko[0] - Math.sin(kw) * 0.016 * kk, Sh = [seg(Hl, [hx, Ko[1] + 0.035 * k, 1, 0], hr, 0.046, T.haut, 1)];
      teile.push({ d: kt - 0.012, pfad: () => { const q = new Path2D(); kap(q, Sh[0]); return q; }, mal: (gg) => { gliedMal(gg, Sh, true);
        if (D) { const u = Sh[0], a = mitte(u.a, u.b, 0.5), b = mitte(u.a, u.b, 0.92), vx = Math.sin(kw) * 0.012 * kk; fuell(gg, T.haut.d, (q) => kapsel(q, a[0] + vx, a[1], u.ra * 0.66, b[0] + vx, b[1], u.rb * 0.84));
          if (!leicht) kragen(gg, Sh[0]); } } }); }
    function kragen(gg, u) {
      const hinten = vorn < -0.1, offen = !hinten && (rein || art === 'blazer'), r = u.ra, cx0 = u.a[0], cy0 = u.a[1] + 0.006 * k, ob = T.ober, lw = (f) => Math.max(1, f * k);
      if (offen) { if (D > 1 && vorn > 0.45) for (const s2 of [-1, 1]) strich(gg, T.haut.d, lw(0.004), (q) => { q.moveTo(cx0 + s2 * r * 0.78, cy0 - 0.045 * k); q.quadraticCurveTo(cx0 + s2 * r * 0.5, cy0 + 0.012 * k, cx0 + s2 * r * 0.1, cy0 + 0.034 * k); }, 0.32); return; }
      const ry = (hinten ? 0.016 : art === 'shirt' ? 0.03 : 0.022) * k, t = art === 'hoodie' ? 0.07 : 0.05, hoch = m.ober.rolli && art === 'pulli' ? 0.05 * k : 0;
      fuell(gg, hinten && art !== 'shirt' && art !== 'pulli' && art !== 'hoodie' ? (m.ober.zwei ? T.zwei.m : ob.l) : art === 'hoodie' ? ob.d : ob.m, (q) => { q.ellipse(cx0, cy0 - hoch, r * 1.1, ry, 0, 0, PI); q.ellipse(cx0, cy0, r * 1.34, ry + t * k, 0, PI, 0, true); if (hoch) q.rect(cx0 - r * 1.1, cy0 - hoch, r * 2.2, hoch); });
      if (hoch) { strich(gg, ob.l, lw(0.006), (q) => q.ellipse(cx0, cy0 - hoch, r * 1.1, ry, 0, 0.1, PI - 0.1), 0.8); strich(gg, ob.t, lw(0.005), (q) => q.ellipse(cx0, cy0 - hoch * 0.45, r * 1.12, ry, 0, 0.2, PI - 0.2), 0.4); }
      else if (art === 'pulli' || art === 'hoodie') { strich(gg, art === 'hoodie' ? ob.m : ob.l, lw(0.016), (q) => q.ellipse(cx0, cy0, r * 1.14, ry + 0.006 * k, 0, 0.12, PI - 0.12)); strich(gg, ob.t, lw(0.005), (q) => q.ellipse(cx0, cy0, r * 1.28, ry + 0.018 * k, 0, 0.2, PI - 0.2), 0.4); }
      else strich(gg, hinten ? ob.t : ob.d, lw(hinten ? 0.006 : 0.009), (q) => q.ellipse(cx0, cy0, r * 1.1, ry, 0, 0.08, PI - 0.08), hinten ? 0.5 : 1);
    }
    teile.push({ d: kt, pfad: () => K.pfad(), mal: (gg) => kopfMal(gg, m, T, K, D, lx, ly, o, kante, gegen) });
    if (m.frisur === 'lang' || m.frisur === 'zopf') { const hh = haarBau(m, K, k); teile.push({ d: K.fd > 0.1 ? rumpfTiefe - 0.02 : kt + 0.01, pfad: () => { const q = new Path2D(); zug(q, hh.P); return q; }, mal: (gg) => { fuell(gg, T.haar.d, (q) => zug(q, hh.P)); fuell(gg, T.haar.m, (q) => zug(q, hh.P.map((v) => [hh.cx + (v[0] - hh.cx) * 0.74 + lx * 0.012 * k, v[1] - 0.01 * k])));
      if (D > 1) for (const t of [0.3, 0.64]) strich(gg, T.haar.l, Math.max(1, 0.006 * k), (q) => { const x = lerp(hh.P[0][0], hh.P[1][0], t); q.moveTo(x, hh.P[0][1] + 0.05 * k); q.quadraticCurveTo(x + lx * 0.01 * k, lerp(hh.P[0][1], hh.yu, 0.5), x - hh.fx * 0.02 * k, hh.yu - 0.05 * k); }, 0.5); } }); }
    teile.sort((a, b) => a.d - b.d);
    const aus = { kopf: [Ko[0], Ko[1] - 0.125 * kk], handR: pt(sk.R.h), handL: pt(sk.L.h) };
    const umrissPfad = () => { const U = new Path2D(); for (const t of teile) U.addPath(t.pfad()); return U; };
    if (o.modus === 'umriss') {
      const farbe = o.farbe || '255,255,255', U = umrissPfad();
      g.lineJoin = 'round'; g.lineCap = 'butt'; g.setLineDash([Math.max(4, 0.045 * k0), Math.max(3, 0.032 * k0)]); g.lineWidth = Math.max(2.2, 0.016 * k0) * 2; g.strokeStyle = `rgba(${farbe},.95)`;
      g.stroke(U);
      g.setLineDash([]); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(U);
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(14,13,20,.42)'; g.fill(U);
      g.globalCompositeOperation = 'source-over';
      return aus;
    }
    if (o.rand && o.rand.px > 0.2) {
      const U = umrissPfad(); g.lineJoin = 'round';
      for (const [zu, al] of [[o.rand.px * 2.4, 0.22], [o.rand.px, 0.95]]) { g.fillStyle = g.strokeStyle = `rgba(${o.rand.farbe},${al * (o.rand.a ?? 1)})`; g.lineWidth = zu * 2; g.fill(U); g.stroke(U); }
    }
    if (o.modus === 'rand') return aus;
    { const n = teile.length, a = o.teil ? Math.floor(n * o.teil[0]) : 0, b = o.teil ? Math.floor(n * o.teil[1]) : n; for (let i = a; i < b; i++) teile[i].mal(g); }
    return aus;
  }
  function schuh(g, m, T, A, F, Z, k, lx, ly, D, schaft) {
    const dx = Z[0] - F[0], dy = Z[1] - F[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, leder = m.schuhe.leder, so = (leder ? 0.012 : 0.022) * k;
    const zu = Z[3] > F[3] ? grenze(1.25 - len / (0.13 * k), 0, 1) : 0, ra = lerp(0.046, 0.037, zu) * k * F[2], rb = lerp(0.036, 0.05, zu) * k * Z[2], fl = 1 - 0.3 * zu;
    const form = (q, x, y, f) => { if (zu < 0.3) return kapsel(q, F[0] + x, F[1] + y, ra * f, Z[0] + x, Z[1] + y, rb * f); q.ellipse(F[0] + x, F[1] + y, ra * f, ra * f, 0, 0, PI * 2); q.ellipse(Z[0] + x, Z[1] + y, rb * f, rb * f * fl, 0, 0, PI * 2); eck(q, [[F[0] + x - ra * f, F[1] + y], [F[0] + x + ra * f, F[1] + y], [Z[0] + x + rb * f, Z[1] + y], [Z[0] + x - rb * f, Z[1] + y]]); };
    fuell(g, T.sohle.m, (q) => form(q, 0, so, 1));
    if (leder && D && len > ra) fuell(g, T.sohle.d, (q) => q.rect(Math.min(F[0] - ra * 0.9, F[0] + ra * 0.6), F[1] + ra * 0.3, ra * 1.5, ra * 0.7 + so));
    fuell(g, T.schuh.d, (q) => form(q, 0, 0, 1));
    fuell(g, T.schuh.m, (q) => form(q, lx * ra * 0.16, -ra * 0.22, 0.78));
    if (schaft && !leder) fuell(g, T.schuh.m, (q) => kapsel(q, A[0], A[1] + 0.02 * k, 0.04 * k * A[2], lerp(F[0], Z[0], 0.3), lerp(F[1], Z[1], 0.3), ra * 0.8));
    if (!D) return;
    if (D > 1 && zu > 0.5) { strich(g, T.schuh.t, Math.max(1, 0.006 * k), (q) => q.ellipse(Z[0], Z[1] - rb * 0.1, rb * 0.72, rb * 0.5, 0, PI * 1.08, PI * 1.92), 0.45); if (!leder) for (const t of [0.3, 0.52]) strich(g, T.sohle.l, Math.max(1, 0.007 * k), (q) => { const y = lerp(F[1], Z[1], t) - rb * 0.3; q.moveTo(lerp(F[0], Z[0], t) - rb * 0.3, y); q.lineTo(lerp(F[0], Z[0], t) + rb * 0.3, y); }, 0.8); }
    if (D > 1 && len > ra * 1.6) {
      strich(g, T.schuh.t, Math.max(1, 0.006 * k), (q) => q.arc(Z[0], Z[1], rb * 0.9, Math.atan2(uy, ux) + PI * 0.62, Math.atan2(uy, ux) + PI * 1.38), 0.5);
      if (!leder) for (const t of [0.36, 0.5, 0.64]) strich(g, T.sohle.l, Math.max(1, 0.007 * k), (q) => { const x = lerp(F[0], Z[0], t), y = lerp(F[1], Z[1], t) - lerp(ra, rb, t) * 0.66; q.moveTo(x - ux * 0.012 * k, y - 0.006 * k); q.lineTo(x + ux * 0.016 * k, y + 0.012 * k); }, 0.85);
    }
  }
  function handBau(Hg, Fi, k, seite, pose, haelt) {
    const gr = ((Hg[2] + Fi[2]) / 2) * k, dx = Fi[0] - Hg[0], dy = Fi[1] - Hg[1], roh = Math.hypot(dx, dy) || 1, len = Math.max(roh, 0.1 * gr), ux = dx / roh, uy = dy / roh, nx = -uy * seite, ny = ux * seite;
    const zu = haelt || pose === 'greift', br = (pose === 'offen' || pose === 'tippt' ? 0.043 : zu ? 0.04 : 0.035) * gr, S = [], F = [], kx = Hg[0] + ux * len * 0.5, ky = Hg[1] + uy * len * 0.5, fl = len * 0.5;
    const ri = (w) => [ux * Math.cos(w) - nx * Math.sin(w), uy * Math.cos(w) - ny * Math.sin(w)];
    S.push([Hg[0], Hg[1], 0.031 * gr, kx, ky, br, 0]);
    if (pose === 'zeigt' && !haelt) {
      const d = ri(0), c = ri(1.0); S.push([kx + nx * br * 0.5, ky + ny * br * 0.5, 0.012 * gr, kx + nx * br * 0.5 + d[0] * fl * 1.02, ky + ny * br * 0.5 + d[1] * fl * 1.02, 0.0098 * gr, 1]);
      S.push([kx - nx * br * 0.2, ky - ny * br * 0.2, br * 0.72, kx - nx * br * 0.2 + c[0] * fl * 0.22, ky - ny * br * 0.2 + c[1] * fl * 0.22, br * 0.62, 1]);
    } else if (zu) { const c = ri(-0.7); S.push([kx, ky, br * 0.98, kx + c[0] * fl * 0.45, ky + c[1] * fl * 0.45, br * 0.8, 1]);
      for (let i = 0; i < 4; i++) { const ab = lerp(0.66, -0.7, i / 3), r = 0.0118 * gr * (i === 3 ? 0.88 : 1), x = kx + nx * br * ab + ux * fl * 0.1, y = ky + ny * br * ab + uy * fl * 0.1; F.push([x, y, r, x + c[0] * fl * 0.5, y + c[1] * fl * 0.5, r * 0.92, 1]); } }
    else { const kr = pose === 'locker' ? -0.3 : 0, lg = pose === 'locker' ? 0.78 : pose === 'tippt' ? 0.84 : 1, sp = pose === 'offen' ? [-0.1, 0.13] : pose === 'tippt' ? [-0.14, 0.16] : [-0.04, 0.06];
      for (let i = 0; i < 4; i++) { const t = i / 3, ab = lerp(0.62, -0.72, t), d = ri(kr + lerp(sp[0], sp[1], t)), l = fl * lg * [0.92, 1, 0.94, 0.76][i], r = 0.0112 * gr * (i === 3 ? 0.88 : 1);
        F.push([kx + nx * br * ab, ky + ny * br * ab, r * 1.06, kx + nx * br * ab + d[0] * l, ky + ny * br * ab + d[1] * l, r * 0.88, 1]); }
      const d = ri(kr); S.push([kx, ky, br * 0.96, kx + d[0] * fl * lg * 0.86, ky + d[1] * fl * lg * 0.86, br * (pose === 'locker' ? 0.66 : 0.82), 1]); }
    const dd = ri(zu ? -0.3 : pose === 'offen' ? -0.95 : -0.6), d0x = Hg[0] + ux * len * 0.22 + nx * br * 0.72, d0y = Hg[1] + uy * len * 0.22 + ny * br * 0.72;
    S.push([d0x, d0y, 0.0142 * gr, d0x + dd[0] * 0.052 * gr, d0y + dd[1] * 0.052 * gr, 0.0112 * gr, 2]);
    return { S, F, gr, nx, ny, ux, uy, kx, ky, br, zu, pose };
  }
  function handMal(g, H, ton, lx, ly, D, leicht) {
    const einzeln = D > 1 && H.F.length > 0;
    for (const x of H.S) { if ((einzeln && x[6] === 1 && H.pose !== 'zeigt') || (x[6] === 2 && !D)) continue; fuell(g, ton.m, (q) => kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5])); }
    if (einzeln) for (const x of H.F) fuell(g, ton.m, (q) => kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5]));
    if (!D) return;
    const nl = H.nx * lx + H.ny * ly, sch = nl >= 0 ? -1 : 1, a = H.S[0];
    fuell(g, ton.d, (q) => kapsel(q, a[0] + sch * H.nx * a[2] * 0.62, a[1] + sch * H.ny * a[2] * 0.62, a[2] * 0.36, a[3] + sch * H.nx * a[5] * 0.62, a[4] + sch * H.ny * a[5] * 0.62, a[5] * 0.36));
    if (einzeln) {
      for (const x of H.F) strich(g, ton.d, Math.max(0.8, x[2] * 0.32), (q) => { q.moveTo(x[0] + sch * H.nx * x[2] * 0.7, x[1] + sch * H.ny * x[2] * 0.7); q.lineTo(x[3] + sch * H.nx * x[5] * 0.7, x[4] + sch * H.ny * x[5] * 0.7); }, 0.8);
      g.globalAlpha = 0.5; fuell(g, ton.d, (q) => { for (const x of H.F) { q.moveTo(x[0] + x[2] * 0.6, x[1]); q.arc(x[0], x[1], x[2] * 0.6, 0, PI * 2); } }); g.globalAlpha = 1;
      strich(g, ton.l, Math.max(1, a[5] * 0.3), (q) => { q.moveTo(lerp(a[0], a[3], 0.25) - sch * H.nx * a[5] * 0.5, lerp(a[1], a[4], 0.25) - sch * H.ny * a[5] * 0.5); q.lineTo(a[3] - sch * H.nx * a[5] * 0.5 - H.ux * a[5] * 0.5, a[4] - sch * H.ny * a[5] * 0.5 - H.uy * a[5] * 0.5); }, 0.55);
      const d = H.S.find((x) => x[6] === 2); if (d) strich(g, ton.d, Math.max(0.8, d[2] * 0.3), (q) => { q.moveTo(d[0] - H.nx * d[2] * 0.75 - H.ux * d[2], d[1] - H.ny * d[2] * 0.75 - H.uy * d[2]); q.lineTo(d[3] - H.nx * d[5] * 0.75, d[4] - H.ny * d[5] * 0.75); }, 0.7);
    } else if (!leicht) { const f = H.S.find((x) => x[6] === 1); if (f && H.pose !== 'zeigt' && f[2] > 2.2) for (const v of H.zu ? [-0.45, 0, 0.45] : [-0.3, 0.32]) strich(g, ton.d, Math.max(0.8, H.gr * 0.004), (q) => { q.moveTo(lerp(f[0], f[3], 0.25) + H.nx * f[2] * v, lerp(f[1], f[4], 0.25) + H.ny * f[2] * v); q.lineTo(f[3] + H.nx * f[5] * v * 1.1, f[4] + H.ny * f[5] * v * 1.1); }, 0.7); }
  }
  const GES = [[-0.076, 0.048, 0.078, 0.2, 0], [-0.052, 0.066, 0.088, 0.14, 0], [-0.024, 0.0715, 0.092, 0.1, 0.002], [0, 0.072, 0.086, 0.09, 0], [0.026, 0.072, 0.09, 0.09, 0.022], [0.04, 0.0705, 0.09, 0.09, 0.002], [0.058, 0.067, 0.092, 0.12, 0.003], [0.074, 0.061, 0.086, 0.1, 0], [0.094, 0.047, 0.088, 0.3, 0.002], [0.111, 0.026, 0.078, 0.66, 0]];
  const PROFIL = [[-0.076, 0], [-0.058, 0.001], [-0.04, 0.003], [-0.024, 0.0055], [-0.008, 0.0005], [0.006, 0.007], [0.018, 0.017], [0.029, 0.027], [0.0365, 0.013], [0.043, 0.004], [0.05, 0.0078], [0.0575, 0.002], [0.065, 0.0066], [0.076, 0.0005], [0.09, 0.0062], [0.102, 0.002], [0.111, 0]];
  const gesAn = (y) => { let i = 0; while (i < GES.length - 2 && GES[i + 1][0] < y) i++; const a = GES[i], b = GES[i + 1], t = grenze((y - a[0]) / (b[0] - a[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  function kopfBau(m, cx, cy, kk, kw, p) {
    const fx = Math.sin(kw), fd = Math.cos(kw), s = fx >= 0 ? 1 : -1, sa = Math.abs(fx), nick = (p.kn || 0) * 0.05 * kk, fr = m.frisur;
    const fern = [], nahe = [];
    for (const [y, wf, rp, hk, nase] of GES) { const xf = Math.max(Math.hypot(wf * fd, rp * sa), (rp + nase) * sa), xn = Math.min(xf, -wf * fd + rp * hk * sa); fern.push([cx + s * xf * kk, cy + y * kk + nick]); nahe.push([cx + s * xn * kk, cy + y * kk + nick]); }
    const kante = (y, v = 0) => { const [wf, rp] = gesAn(y); return cx + s * Math.max(Math.hypot(wf * fd, rp * sa), (rp + v) * sa) * kk; };
    const fein = sa > 0.2 ? PROFIL.map(([y, v]) => [kante(y, v * (v > 0.01 ? m.nase : 1)), cy + y * kk + nick]) : fern;
    const breit = (fern[3][0] - nahe[3][0]) * s, maske = breit > 0.01 * kk ? [[(fern[0][0] + nahe[0][0]) / 2, fern[0][1] - 0.004 * kk], ...fein, [(fern[9][0] + nahe[9][0]) / 2 + s * sa * 0.006 * kk, cy + 0.119 * kk + nick], ...nahe.slice().reverse()] : null;
    const vol = fr === 'locken' ? 1.14 : fr === 'bob' ? 1.08 : fr === 'lang' ? 1.07 : fr === 'kurz' ? 1.045 : 1.03, srx = Math.hypot(0.079 * fd, 0.1 * sa) * vol * kk, sx = cx - s * sa * 0.012 * kk, sy = cy - 0.008 * kk, sot = 0.112 * vol * kk, sub = (fr === 'bob' ? 0.1 : 0.078) * kk;
    const ohr = (e) => ({ x: cx + e * fd * 0.079 * kk, y: cy + 0.014 * kk + nick, t: -e * fx });
    const merk = (phi, r) => ({ x: cx + r * Math.sin(kw + phi) * kk, t: Math.cos(kw + phi) });
    const auge = (e, r = 0.073) => { const A = merk(e * 0.42, r), fernes = e * s > 0 && sa > 0.12; if (fernes && fd < 0.42) return null;
      const t = Math.max(A.t, fd * 0.92); if (t < 0.16) return null; return { x: fernes ? s * Math.min(s * A.x, s * kante(-0.001) - (0.0128 * t + 0.0018) * 1.2 * kk - 0.003 * kk) : A.x, t, fernes }; };
    const pfad = () => { const q = new Path2D(), lo = fr === 'locken' ? 0.02 * kk : 0; q.ellipse(sx, sy - lo * 0.5, srx + lo, Math.max(sot, sub) + lo, 0, 0, PI * 2); if (maske) zug(q, maske); if (fr === 'bob' || fr === 'lang') q.ellipse(sx, cy + 0.04 * kk, srx * 1.04, 0.1 * kk, 0, 0, PI * 2); if (fr === 'dutt') q.arc(cx - fx * 0.07 * kk, cy - 0.128 * kk, 0.042 * kk, 0, PI * 2); return q; };
    return { cx, cy, kk, kw, fx, fd, s, sa, nick, fern, nahe, maske, kante, auge, breit, vol, srx, sx, sy, sot, sub, ohr, merk, pfad, mund: p.mund || 0, blinz: p.blinz || 0, schau: p.schau || 0, fr };
  }
  function kopfMal(g, m, T, K, D, lx, ly, o, kante, gegen) {
    const { cx, cy, kk, fx, fd, s, sa, nick, fern, nahe, maske, srx, sx, sy, sot, sub, fr } = K, H = T.haar, S = T.haut, lw = (f) => Math.max(1, f * kk), wl = Math.atan2(ly, lx);
    const schale = (q, dx = 0, dy = 0, f = 1) => { q.ellipse(sx + dx, sy + dy, srx * f, sot * f, 0, PI, PI * 2); q.ellipse(sx + dx, sy + dy, srx * f, sub * f, 0, 0, PI); };
    const ohrMal = (e) => { const O = K.ohr(e), rx = (0.01 + 0.014 * Math.max(0, O.t)) * kk, ry = 0.029 * kk; fuell(g, S.m, (q) => q.ellipse(O.x, O.y, rx, ry, 0, 0, PI * 2)); if (D) { fuell(g, S.d, (q) => q.ellipse(O.x + (O.t > 0.4 ? s * 0.002 * kk : 0), O.y + 0.002 * kk, rx * 0.5, ry * 0.58, 0, 0, PI * 2)); if (m.ohrring) fuell(g, T.gold.l, (q) => q.arc(O.x, O.y + ry * 1.05, lw(0.0075), 0, PI * 2)); } };
    const ohrFrei = fr !== 'bob' && fr !== 'lang';
    if (fr === 'dutt') { const bx = cx - fx * 0.07 * kk, by = cy - (0.128 - 0.02 * Math.max(0, -fd)) * kk, br = 0.042 * kk; fuell(g, H.d, (q) => q.arc(bx, by, br, 0, PI * 2)); fuell(g, H.m, (q) => q.arc(bx + lx * br * 0.2, by + ly * br * 0.2, br * 0.78, 0, PI * 2)); if (D > 1) strich(g, H.l, lw(0.005), (q) => q.arc(bx, by, br * 0.55, wl - 0.9, wl + 0.9), 0.7); }
    if (fr === 'locken') for (let i = 0; i <= 10; i++) { const w = PI * (0.98 + (i / 10) * 1.04), r = 0.03 * kk * (0.9 + (0.2 * ((i * 7) % 3)) / 2); fuell(g, i % 2 ? H.m : H.d, (q) => q.arc(sx + Math.cos(w) * srx * 0.96, sy + Math.sin(w) * sot * 0.94, r, 0, PI * 2)); }
    if (ohrFrei) for (const e of [-1, 1]) { const t = K.ohr(e).t; if (t > -0.3 && t <= 0.35) ohrMal(e); }
    fuell(g, H.d, (q) => schale(q)); fuell(g, H.m, (q) => schale(q, lx * srx * 0.11, ly * sot * 0.1, 0.89));
    if (D > 1 && fr !== 'locken') for (const [f, a, b] of [[0.82, -0.9, -0.2], [0.5, -0.3, 0.6]]) strich(g, H.d, lw(0.004), (q) => q.ellipse(sx, sy, srx * f, sot * f, 0, wl + PI + a, wl + PI + b), 0.5);
    if (maske) {
      fuell(g, S.m, (q) => zug(q, maske));
      const rechts = s > 0 ? fern : nahe, links = s > 0 ? nahe : fern, kanteS = lx < 0 ? rechts : links, gegenS = lx < 0 ? links : rechts, zs = lx < 0 ? 1 : -1;
      const streif = (R, G2, a, b, f) => { const P = []; for (let i = a; i <= b; i++) P.push(R[i]); for (let i = b; i >= a; i--) P.push([lerp(R[i][0], G2[i][0], f * (i === b || i === a ? 0.4 : 1)), R[i][1]]); return P; };
      { const t = weich((sa - 0.3) / 0.4), vorn = kanteS === fern, f = vorn ? lerp(0.2, 0, t) : lerp(0.2, 0.36, t);
        if (f > 0.03 && (vorn || t < 0.15)) fuell(g, S.d, (q) => zug(q, streif(kanteS, gegenS, 1, 9, f)));
        else if (f > 0.03) { const a = 2, b = 9, P = [], x0 = lerp(nahe[a][0], fern[a][0], 0.12 + 0.1 * t), x1 = lerp(nahe[b][0], fern[b][0], 0.25 + 0.5 * t);
          for (let i = a; i <= b; i++) P.push(nahe[i]); for (let i = b; i >= a; i--) P.push([lerp(x0, x1, Math.pow((i - a) / (b - a), 1.6)), nahe[i][1]]); fuell(g, S.d, (q) => zug(q, P)); }
        if (vorn && t > 0.5 && D && !o.leicht) fuell(g, S.d, (q) => zug(q, streif(nahe, fern, 7, 9, 0.5 * t))); }
      if (D) { fuell(g, S.l, (q) => zug(q, streif(gegenS, kanteS, 1, 4, 0.1)));
        if (D > 1) { const wx = lerp(gegenS[4][0], kanteS[4][0], 0.26), wy = cy + 0.034 * kk + nick; g.globalAlpha = 0.22; fuell(g, T.lippe.m, (q) => q.ellipse(wx, wy, 0.017 * kk * Math.max(0.4, fd), 0.011 * kk, 0, 0, PI * 2)); g.globalAlpha = 1; } }
      if (m.bart) { const P = [...fern.slice(5), [(fern[9][0] + nahe[9][0]) / 2, cy + 0.121 * kk + nick], ...nahe.slice(4).reverse()], mu = K.merk(0, 0.085);
        fuell(g, H.m, (q) => zug(q, P)); fuell(g, H.d, (q) => zug(q, streif(kanteS, gegenS, 5, 9, 0.3)));
        fuell(g, H.m, (q) => eck(q, [nahe[2], [nahe[2][0] + s * 0.014 * kk, nahe[2][1]], [nahe[5][0] + s * 0.02 * kk, nahe[5][1]], nahe[5]]));
        fuell(g, S.m, (q) => q.ellipse(grenze(mu.x, Math.min(nahe[6][0], fern[6][0]) + 0.014 * kk, Math.max(nahe[6][0], fern[6][0]) - 0.014 * kk), cy + 0.06 * kk + nick, 0.017 * kk * Math.max(0.45, fd), 0.008 * kk, 0, 0, PI * 2)); }
      if (D && fd > -0.25) gesicht(g, m, T, K, D, lx, ly, zs);
      else if (!D && fd > 0.2) for (const e of [-1, 1]) { const A = K.merk(e * 0.42, 0.074); if (A.t > 0.3) fuell(g, 'rgba(34,24,28,.7)', (q) => q.ellipse(A.x, cy - 0.002 * kk, Math.max(0.7, 0.007 * kk), Math.max(0.8, 0.009 * kk), 0, 0, PI * 2)); }
    }
    if (maske && fd > -0.3) {
      const stirnA = nahe[1], stirnB = fern[1], mi = [lerp(nahe[0][0], fern[0][0], 0.5 + 0.28 * m.scheitel * s * Math.max(0, fd)), nahe[0][1]], tief = m.pony ? 0.05 : fr === 'locken' ? 0.03 : m.ansatz ? -0.006 : 0.012, oben = cy - 0.1 * kk, ecke = m.ansatz ? 0.016 * kk : 0;
      const P = [[stirnA[0] - s * 0.006 * kk, stirnA[1] + 0.012 * kk], [lerp(stirnA[0], mi[0], 0.55), stirnA[1] - (0.014 - tief) * kk - ecke], [mi[0], mi[1] + (m.pony ? tief : 0.004) * kk - ecke * 0.3], [lerp(stirnB[0], mi[0], 0.5), stirnB[1] - (0.02 - tief) * kk - ecke], [stirnB[0] + s * 0.004 * kk, stirnB[1] + 0.006 * kk], [stirnB[0] - s * 0.01 * kk, oben], [stirnA[0] + s * 0.012 * kk, oben]];
      fuell(g, H.m, (q) => zug(q, P));
      if (D) strich(g, H.d, lw(0.005), (q) => { q.moveTo(P[0][0], P[0][1]); q.quadraticCurveTo(P[1][0], P[1][1], P[2][0], P[2][1]); q.quadraticCurveTo(P[3][0], P[3][1], P[4][0], P[4][1]); }, 0.45);
      if (D > 1 && fr !== 'locken') strich(g, H.l, lw(0.006), (q) => { q.moveTo(mi[0], mi[1] - 0.004 * kk); q.quadraticCurveTo(lerp(mi[0], stirnB[0], 0.5), oben + 0.012 * kk, stirnB[0] - s * 0.014 * kk, stirnB[1] - 0.02 * kk); }, 0.6);
      if (fr === 'locken') for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; fuell(g, i % 2 ? H.d : H.m, (q) => q.arc(lerp(stirnA[0], stirnB[0], t), stirnA[1] + 0.004 * kk, 0.021 * kk, 0, PI * 2)); }
      if (fr === 'bob' || fr === 'lang') for (const R of sa < 0.55 ? [nahe, fern] : [nahe]) { const au = R === nahe ? -s : s, lg = fr === 'bob' ? 8 : 9, P2 = [], yv = (i) => cy + GES[i][0] * kk + (i > 7 ? (i - 7) * 0.02 * kk : 0) + nick;
        for (let i = 1; i <= lg; i++) P2.push([R[Math.min(i, 7)][0] + au * 0.02 * kk, yv(i)]);
        for (let i = lg; i >= 1; i--) P2.push([R[Math.min(i, 7)][0] - au * (i < 3 ? 0.016 : 0.004) * kk, yv(i)]);
        fuell(g, au * lx > 0 ? H.m : H.d, (q) => zug(q, P2)); }
    }
    if (ohrFrei) for (const e of [-1, 1]) if (K.ohr(e).t > 0.35) { ohrMal(e); if (D > 1 && fr === 'kurz') { const O = K.ohr(e); fuell(g, H.m, (q) => eck(q, [[O.x + s * 0.012 * kk, O.y - 0.045 * kk], [O.x + s * 0.03 * kk, O.y - 0.04 * kk], [O.x + s * 0.022 * kk, O.y - 0.005 * kk], [O.x + s * 0.012 * kk, O.y - 0.012 * kk]])); } }
    if (D && fd < -0.2 && ohrFrei && fr !== 'zopf') strich(g, H.d, lw(0.005), (q) => { q.moveTo(sx - srx * 0.5, sy + sub * 0.86); q.quadraticCurveTo(sx, sy + sub * 1.2, sx + srx * 0.5, sy + sub * 0.86); }, 0.5);
    if (m.brille && D && fd > -0.1) brille(g, K, D);
    if (m.kopfhoerer || o.kopfhoerer) {
      strich(g, T.ding.m, lw(0.017), (q) => q.ellipse(sx, sy + 0.012 * kk, Math.abs(fd) * 0.084 * kk + 0.01 * kk, sot + 0.012 * kk, 0, PI * 1.04, PI * 1.96));
      for (const e of [-1, 1]) { const O = K.ohr(e); if (O.t < -0.3) continue; const rx = (0.014 + 0.02 * Math.max(0, O.t)) * kk; fuell(g, T.ding.m, (q) => q.roundRect(O.x - rx, O.y - 0.036 * kk, rx * 2, 0.07 * kk, rx * 0.7)); if (D) fuell(g, T.ding.l, (q) => q.roundRect(O.x - rx * 0.5, O.y - 0.026 * kk, rx, 0.05 * kk, rx * 0.4)); }
    }
    if (kante && D && !o.leicht) strich(g, H.l, lw(0.007), (q) => q.ellipse(sx, sy, srx - lw(0.0035), sot - lw(0.0035), 0, wl - 0.5, wl + 0.5), 0.8);
    if (gegen && D && !o.leicht && ly > 0.2) strich(g, gegen, lw(0.008), (q) => q.ellipse(sx, sy, srx - lw(0.004), sot - lw(0.004), 0, wl + PI - 0.6, wl + PI + 0.6));
  }
  function gesicht(g, m, T, K, D, lx, ly, zs) {
    const { cy, kk, fx, fd, s, sa, nick, fern, nahe } = K, S = T.haut, lw = (f) => Math.max(0.8, f * kk), dunkel = 'rgba(30,22,26,.9)', ay = cy - 0.001 * kk + nick, zu = K.blinz > 0.5;
    for (const e of [-1, 1]) {
      const A = K.auge(e); if (!A) continue;
      const bw = (0.0128 * A.t + 0.0018) * kk, bh = 0.0066 * kk, bx = A.x, innen = -e * (fd >= 0 ? 1 : -1);
      if (D > 1 && !zu) { fuell(g, T.weiss.m, (q) => q.ellipse(bx, ay, bw, bh, 0, 0, PI * 2));
        const ix = bx + grenze(K.schau * 0.0034 * kk + fx * 0.002 * kk, -bw * 0.4, bw * 0.4), ir = Math.min(bw * 0.72, 0.0058 * kk); fuell(g, T.auge.m, (q) => q.ellipse(ix, ay + 0.0004 * kk, ir, 0.0061 * kk, 0, 0, PI * 2)); fuell(g, '#17110f', (q) => q.ellipse(ix, ay + 0.0004 * kk, ir * 0.5, 0.003 * kk, 0, 0, PI * 2));
        fuell(g, 'rgba(255,255,255,.85)', (q) => q.arc(ix + lx * 0.002 * kk, ay - 0.0022 * kk, Math.max(0.6, 0.0013 * kk), 0, PI * 2));
        strich(g, dunkel, lw(0.0032), (q) => { q.moveTo(bx - bw * 1.08, ay + 0.001 * kk); q.quadraticCurveTo(bx, ay - bh * 1.75, bx + bw * 1.08, ay + 0.001 * kk); });
        strich(g, S.d, lw(0.002), (q) => { q.moveTo(bx - bw, ay - bh * 1.5); q.quadraticCurveTo(bx, ay - bh * 2.5, bx + bw, ay - bh * 1.5); }, 0.7);
      } else if (zu) strich(g, dunkel, lw(0.003), (q) => { q.moveTo(bx - bw * 1.05, ay); q.quadraticCurveTo(bx, ay + bh * 0.9, bx + bw * 1.05, ay); });
      else fuell(g, dunkel, (q) => q.ellipse(bx, ay, Math.max(0.8, bw * 0.55), Math.max(0.9, 0.0072 * kk), 0, 0, PI * 2));
      const by = ay - (0.0205 + (K.mund > 0.15 ? 0.002 : 0)) * kk, bb = bw * 1.5;
      strich(g, T.haar.roh[0] + T.haar.roh[1] + T.haar.roh[2] > 420 ? T.haar.d : T.haar.t, lw(D > 1 ? 0.0052 : 0.006), (q) => { q.moveTo(bx + innen * bb * 0.8, by + (K.mund < 0 ? 0.0035 : 0.0012) * kk); q.quadraticCurveTo(bx - innen * bb * 0.1, by - 0.0045 * kk, bx - innen * bb * 0.95, by + 0.0012 * kk); }, 0.92);
    }
    const N = K.merk(0, 0.088), nx0 = grenze(N.x, Math.min(nahe[4][0], fern[4][0]) + 0.004 * kk, Math.max(nahe[4][0], fern[4][0]) - 0.002 * kk), ny0 = cy + 0.026 * kk + nick;
    if (sa < 0.5) { fuell(g, S.d, (q) => eck(q, [[nx0 + fx * 0.004 * kk, ay + 0.004 * kk], [nx0 + zs * 0.0125 * kk + fx * 0.006 * kk, ny0 + 0.006 * kk], [nx0 + fx * 0.008 * kk, ny0 + 0.01 * kk], [nx0 - zs * 0.004 * kk, ny0 + 0.004 * kk]]));
      if (D > 1) { strich(g, S.t, lw(0.0026), (q) => { q.moveTo(nx0 - 0.0085 * kk, ny0 + 0.006 * kk); q.quadraticCurveTo(nx0 + fx * 0.006 * kk, ny0 + 0.013 * kk, nx0 + 0.0085 * kk, ny0 + 0.006 * kk); }, 0.55); fuell(g, S.l, (q) => q.ellipse(nx0 - zs * 0.003 * kk + fx * 0.006 * kk, ny0 - 0.004 * kk, 0.0035 * kk, 0.008 * kk, 0, 0, PI * 2)); } }
    else if (D > 1) { const tip = K.kante(0.029, 0.027 * m.nase), un = K.kante(0.043, 0.004);
      strich(g, S.t, lw(0.0026), (q) => q.arc(tip - s * 0.021 * kk, ny0 + 0.0065 * kk, 0.0062 * kk, s > 0 ? PI * 0.55 : -0.4, s > 0 ? PI * 1.4 : PI * 0.45), 0.5);
      fuell(g, S.d, (q) => eck(q, [[tip - s * 0.003 * kk, ny0 + 0.0085 * kk], [un - s * 0.001 * kk, cy + 0.043 * kk + nick], [un - s * 0.019 * kk, cy + 0.041 * kk + nick], [tip - s * 0.016 * kk, ny0 + 0.011 * kk]]));
      if (sa < 0.9) strich(g, S.d, lw(0.0028), (q) => { const nw = K.merk(0, 0.088).x, sp = K.merk(0, 0.113).x; q.moveTo(nw + s * 0.004 * kk, ay + 0.003 * kk); q.quadraticCurveTo(lerp(nw, sp, 0.6) + s * 0.004 * kk, ny0 - 0.012 * kk, Math.min(s * sp, s * tip - 0.002 * kk) * s, ny0 + 0.003 * kk); }, 0.45 * (1 - weich((sa - 0.75) / 0.15))); }
    const M = K.merk(0, 0.084), my = cy + 0.0585 * kk + nick, auf = Math.max(0, K.mund), mw = 0.0215 * kk * (0.34 + 0.66 * Math.max(0, fd)), wF = mw * (1 - 0.6 * sa), wN = mw * (1 + 0.35 * sa);
    const xf = s * Math.min(s * (M.x + s * wF), s * K.kante(0.0575, 0.002) - 0.0022 * kk), xn = s * Math.max(s * (xf - s * (wF + wN)), s * nahe[6][0] + 0.006 * kk), mx = (xf + xn) / 2, hw = Math.abs(xf - xn) / 2, li = Math.min(xf, xn), re = Math.max(xf, xn), nahL = xn < xf;
    if (auf > 0.15) { const h = (0.0034 + 0.0068 * auf) * kk;
      fuell(g, 'rgba(78,32,36,.95)', (q) => { q.moveTo(li + hw * 0.08, my - 0.0006 * kk); q.lineTo(re - hw * 0.08, my - 0.0006 * kk); q.quadraticCurveTo(re - hw * 0.1, my + h * 1.5, mx, my + h * 1.55); q.quadraticCurveTo(li + hw * 0.1, my + h * 1.5, li + hw * 0.08, my - 0.0006 * kk); });
      if (D > 1) { fuell(g, T.weiss.m, (q) => q.rect(li + hw * 0.34, my - 0.0002 * kk, hw * 1.32, Math.min(0.0027 * kk, h * 0.5)));
        strich(g, T.lippe.m, lw(0.0034), (q) => { q.moveTo(li + hw * 0.2, my + h * 1.28); q.quadraticCurveTo(mx, my + h * 1.9, re - hw * 0.2, my + h * 1.28); }); }
      strich(g, T.lippe.d, lw(0.0036), (q) => { q.moveTo(li, my - 0.0012 * kk); q.quadraticCurveTo(mx, my - 0.003 * kk, re, my - 0.0012 * kk); });
    } else { const bog = K.mund < 0 ? 0.0006 : 0.0052, yF = my - bog * 0.5 * kk * (1 - 0.8 * sa), yN = my - bog * 0.5 * kk * (1 + 0.7 * sa);
      strich(g, T.lippe.d, lw(0.0042), (q) => { q.moveTo(xn, yN); q.quadraticCurveTo(mx, my + bog * kk, xf, yF); });
      if (D > 1) { strich(g, T.lippe.m, lw(0.0035), (q) => { q.moveTo(mx - hw * 0.62, my + 0.0048 * kk); q.quadraticCurveTo(mx, my + 0.0085 * kk, mx + hw * 0.62, my + 0.0048 * kk); }, 0.75);
        if (K.mund >= 0) { fuell(g, S.d, (q) => q.arc(xn - (nahL ? 1 : -1) * hw * 0.1, yN - 0.0012 * kk, lw(0.0018), 0, PI * 2)); if (sa < 0.5) fuell(g, S.d, (q) => q.arc(xf + (nahL ? 1 : -1) * hw * 0.1, yF - 0.0012 * kk, lw(0.0018), 0, PI * 2)); } } }
    if (D > 1 && m.alt && sa < 0.75) {
      for (const e of sa < 0.35 ? [-1, 1] : [nahL ? -1 : 1]) strich(g, S.d, lw(0.0026), (q) => { q.moveTo(nx0 + e * 0.014 * kk, ny0 + 0.006 * kk); q.quadraticCurveTo(mx + e * (hw + 0.012 * kk), my - 0.012 * kk, mx + e * (hw + 0.008 * kk), my + 0.004 * kk); }, 0.5);
      strich(g, S.d, lw(0.0024), (q) => { q.moveTo(nx0 - 0.026 * kk * fd, cy - 0.046 * kk + nick); q.quadraticCurveTo(nx0, cy - 0.05 * kk + nick, nx0 + 0.026 * kk * fd, cy - 0.046 * kk + nick); }, 0.4); }
    if (D > 1 && sa < 0.9) strich(g, S.d, lw(0.003), (q) => { q.moveTo(mx - hw * 0.5, my + 0.018 * kk); q.quadraticCurveTo(mx, my + 0.0215 * kk, mx + hw * 0.5, my + 0.018 * kk); }, 0.5);
  }
  function brille(g, K, D) {
    const { cy, kk, nick } = K, ay = cy + 0.001 * kk + nick, lw = Math.max(1, 0.0042 * kk), R = [];
    for (const e of [-1, 1]) { const A = K.auge(e, 0.079); if (!A) continue; const w = (0.019 * A.t + 0.003) * kk, h = 0.0145 * kk; R.push([A.x, w]);
      if (D > 1) { g.globalAlpha = 0.16; fuell(g, '#dfe9ff', (q) => q.roundRect(A.x - w, ay - h, 2 * w, 2 * h, h * 0.55)); g.globalAlpha = 1; }
      strich(g, 'rgba(24,20,26,.92)', lw, (q) => q.roundRect(A.x - w, ay - h, 2 * w, 2 * h, h * 0.55));
      const O = K.ohr(e); if (O.t > 0.1) strich(g, 'rgba(24,20,26,.85)', lw * 0.8, (q) => { q.moveTo(A.x + (O.x > A.x ? w : -w), ay - h * 0.4); q.lineTo(O.x, O.y - 0.012 * kk); }); }
    if (R.length === 2) strich(g, 'rgba(24,20,26,.92)', lw, (q) => { const a = R[0][0] < R[1][0] ? R[0] : R[1], b = a === R[0] ? R[1] : R[0]; q.moveTo(a[0] + a[1], ay - 0.003 * kk); q.quadraticCurveTo((a[0] + b[0]) / 2, ay - 0.008 * kk, b[0] - b[1], ay - 0.003 * kk); });
  }
  function haarBau(m, K, k) {
    const { cx, cy, kk, fx, fd, srx, sx } = K;
    if (m.frisur === 'zopf') { const bx = cx - fx * 0.085 * kk, by = cy - 0.02 * kk, yu = by + 0.3 * k, b = 0.03 * kk; return { P: [[bx - b, by], [bx + b, by], [bx + b * 1.1 - fx * 0.03 * kk, lerp(by, yu, 0.5)], [bx + b * 0.5 - fx * 0.05 * kk, yu], [bx - b * 0.5 - fx * 0.05 * kk, yu], [bx - b * 1.1 - fx * 0.03 * kk, lerp(by, yu, 0.5)]], cx: bx - fx * 0.02 * kk, yu, fx }; }
    const sa2 = fx * fx, b = srx * (0.98 + 0.06 * Math.abs(fd)) * (1 - 0.42 * sa2), hx = sx - fx * (0.02 + 0.028 * sa2) * kk, y0 = cy - 0.02 * kk, yu = cy + 0.31 * kk;
    return { P: [[hx - b, y0], [hx + b, y0], [hx + b * 1.08, lerp(y0, yu, 0.5)], [hx + b * 0.94, yu - 0.01 * kk], [hx + b * 0.4, yu + 0.012 * kk], [hx - b * 0.4, yu + 0.012 * kk], [hx - b * 0.94, yu - 0.01 * kk], [hx - b * 1.08, lerp(y0, yu, 0.5)]], cx: hx, yu, fx };
  }
  function halten(g, ding, Hg, Fi, k, T, s, o, D) {
    const hx = (Hg[0] + Fi[0]) / 2, hy = (Hg[1] + Fi[1]) / 2;
    if (ding === 'tasche') {
      const w = 0.38 * k, h = 0.28 * k, x = hx - w / 2, y = hy + 0.1 * k, t = T.tasche;
      strich(g, t.d, Math.max(1.2, 0.016 * k), (q) => { q.moveTo(x + w * 0.24, y + 2); q.quadraticCurveTo(hx - w * 0.06, hy - 0.01 * k, hx, hy); q.quadraticCurveTo(hx + w * 0.06, hy - 0.01 * k, x + w * 0.76, y + 2); });
      fuell(g, t.m, (q) => q.roundRect(x, y, w, h, 0.03 * k)); fuell(g, t.d, (q) => q.roundRect(x + (o.L && o.L[0] < 0 ? w * 0.72 : 0), y, w * 0.28, h, 0.03 * k));
      fuell(g, t.l, (q) => q.roundRect(x + w * 0.04, y + h * 0.04, w * 0.92, h * 0.4, 0.024 * k)); strich(g, t.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(x + w * 0.04, y + h * 0.44); q.lineTo(x + w * 0.96, y + h * 0.44); }, 0.6);
      if (D) fuell(g, T.gold.m, (q) => q.rect(x + w * 0.46, y + h * 0.38, w * 0.08, h * 0.13));
      return;
    }
    if (ding === 'handy' || ding === 'handyhoch') {
      const hoch = ding === 'handyhoch', w = (hoch ? 0.078 : 0.074) * k, h = (hoch ? 0.158 : 0.15) * k, bild = Math.cos(o.dreh || 0) < 0.15;
      g.save(); g.translate(lerp(Hg[0], Fi[0], 0.62), lerp(Hg[1], Fi[1], 0.62) - h * 0.3); g.rotate(hoch ? 0 : 0.12 * s);
      fuell(g, '#0b0b12', (q) => q.roundRect(-w / 2, -h / 2, w, h, w * 0.18));
      if (bild) { fuell(g, o.schirm || 'rgba(232,226,255,.92)', (q) => q.rect(-w * 0.4, -h * 0.43, w * 0.8, h * 0.86)); fuell(g, 'rgba(20,18,30,.5)', (q) => q.rect(-w * 0.4, -h * 0.05, w * 0.8, h * 0.12)); }
      else { fuell(g, 'rgba(255,255,255,.16)', (q) => q.arc(-w * 0.2, -h * 0.32, w * 0.13, 0, PI * 2)); if (D > 1) strich(g, 'rgba(255,255,255,.2)', 1, (q) => q.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, w * 0.16)); }
      g.restore(); return;
    }
    if (ding === 'tablet') { const w = 0.27 * k, h = 0.2 * k; g.save(); g.translate(hx - s * w * 0.3 * Math.sin(o.dreh || 0), hy - h * 0.35); fuell(g, '#0d0d15', (q) => q.roundRect(-w / 2, -h / 2, w, h, w * 0.06)); fuell(g, 'rgba(226,220,250,.86)', (q) => q.rect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.8));
      if (D > 1) { fuell(g, 'rgba(60,52,96,.5)', (q) => { q.rect(-w * 0.38, -h * 0.3, w * 0.4, h * 0.07); q.rect(-w * 0.38, -h * 0.14, w * 0.62, h * 0.05); q.rect(-w * 0.38, -h * 0.02, w * 0.5, h * 0.05); }); fuell(g, 'rgba(124,58,237,.6)', (q) => q.rect(-w * 0.38, h * 0.14, w * 0.22, h * 0.12)); } g.restore(); return; }
    if (ding === 'mappe') {
      const cd = Math.cos(o.dreh || 0), w = 0.2 * k * Math.abs(cd) + 0.024 * k, h = 0.27 * k, t = T.ding; g.save(); g.translate(Hg[0] + (Hg[0] - Fi[0]) * 0.42, Hg[1] + (Hg[1] - Fi[1]) * 0.42 - 0.07 * k); g.rotate(-0.1 * s * cd);
      fuell(g, t.d, (q) => q.roundRect(-w / 2, -h / 2, w, h, 0.016 * k)); fuell(g, t.m, (q) => q.roundRect(-w / 2 + (o.L && o.L[0] < 0 ? 0 : w * 0.16), -h / 2, w * 0.84, h, 0.016 * k));
      if (D > 1) { strich(g, t.l, Math.max(1, 0.005 * k), (q) => q.roundRect(-w / 2 + 0.012 * k, -h / 2 + 0.012 * k, w - 0.024 * k, h - 0.024 * k, 0.01 * k), 0.35); strich(g, t.t, Math.max(1, 0.008 * k), (q) => { q.moveTo(w * 0.28, -h / 2); q.lineTo(w * 0.28, h / 2); }, 0.7); }
      g.restore(); return; }
    if (ding === 'stift') { strich(g, '#17161f', Math.max(1.5, 0.014 * k), (q) => { const mx = lerp(Hg[0], Fi[0], 0.6), my = lerp(Hg[1], Fi[1], 0.6); q.moveTo(mx, my); q.lineTo(mx + (Fi[0] - Hg[0]) * 0.75, my + (Fi[1] - Hg[1]) * 0.75 - 0.03 * k); }); return; }
    if (ding === 'becher') { const w = 0.07 * k, h = 0.1 * k, bx = lerp(Hg[0], Fi[0], 0.6), by = lerp(Hg[1], Fi[1], 0.6); fuell(g, 'rgb(230,224,216)', (q) => q.roundRect(bx - w / 2, by - h * 0.8, w, h, w * 0.15)); if (D) fuell(g, 'rgb(196,188,180)', (q) => q.rect(bx + w * 0.2, by - h * 0.8, w * 0.3, h)); }
  }
  function tasche(g, m, licht, x, y, k) {
    const T = toene(m, licht).tasche, w = 0.38 * k, h = 0.28 * k;
    schatten(g, x, y, k, 0.26, 0.2, 0.4);
    strich(g, T.d, Math.max(1.2, 0.016 * k), (q) => q.ellipse(x, y - h, w * 0.26, h * 0.34, 0, PI, PI * 2));
    fuell(g, T.m, (q) => q.roundRect(x - w / 2, y - h, w, h, 0.03 * k)); fuell(g, T.d, (q) => q.roundRect(x - w / 2 + w * 0.72, y - h, w * 0.28, h, 0.03 * k));
    fuell(g, T.l, (q) => q.roundRect(x - w / 2 + w * 0.04, y - h + h * 0.04, w * 0.92, h * 0.4, 0.024 * k)); strich(g, T.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(x - w * 0.46, y - h * 0.56); q.lineTo(x + w * 0.46, y - h * 0.56); }, 0.6);
  }
  function schatten(g, x, y, k, breit = 0.46, flach = 0.2, a = 0.5) {
    const r = breit * k; g.save(); g.translate(x, y); g.scale(1, flach);
    const s = g.createRadialGradient(0, 0, 0, 0, 0, r); s.addColorStop(0, `rgba(0,0,0,${a})`); s.addColorStop(0.55, `rgba(0,0,0,${a * 0.45})`); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.beginPath(); g.arc(0, 0, r, 0, PI * 2); g.fill(); g.restore();
  }
  const FLAECHEN = new Map();
  function stempel(ziel, name, schluessel, x0, y0, k0, male, a = 1, halten = false, kBild = 0) {
    let f = FLAECHEN.get(name); const kb = kBild || k0, neu = !f || (!(halten && f.key) && (f.key !== schluessel || f.k !== kb));
    if (!f) { const c = document.createElement('canvas'); f = { c, g: c.getContext('2d'), key: '' }; FLAECHEN.set(name, f); }
    if (neu) { const w = Math.ceil(kb * 2.4) + 8, h = Math.ceil(kb * 2.5) + 8; if (f.c.width !== w || f.c.height !== h) { f.c.width = w; f.c.height = h; } else f.g.clearRect(0, 0, w, h);  f.key = schluessel; f.k = kb; f.ay = h - Math.ceil(kb * 0.3) - 4; f.aus = male(f.g, w / 2, f.ay, kb) || null; stempel.neu = (stempel.neu || 0) + 1; }
    const w = f.c.width, h = f.c.height, s = k0 / f.k;
    if (a < 1) ziel.globalAlpha *= a;
    if (s === 1) ziel.drawImage(f.c, Math.round(x0 - w / 2), Math.round(y0 - f.ay)); else ziel.drawImage(f.c, x0 - (w / 2) * s, y0 - f.ay * s, w * s, h * s);
    if (a < 1) ziel.globalAlpha /= a;
    return f.aus ? { kopf: [(f.aus.kopf[0] - w / 2) * s + x0, (f.aus.kopf[1] - f.ay) * s + y0] } : null;
  }
  function punkte(m, p, x0, y0, k0, o) { const sk = skelett(p, m), pt = sichtVon(m, sk, o, x0, y0, k0 * m.gr), b = (q) => pt(q).slice(0, 2); return { kopf: b(sk.kopf), hip: b(sk.hip), fr: b(sk.bR.a), fl: b(sk.bL.a), hr: b(sk.R.h), hl: b(sk.L.h), ar: sk.bR.a, al: sk.bL.a, grund: sk.grund }; }
  stempel.mp = () => { let n = 0; for (const x of FLAECHEN.values()) n += (x.c.width * x.c.height) / 1e6; return n; };
  return { mensch, malen, rahmen, steh, sitz, geh, hocke, zwischen, leben, gespraech, reden, rausch, ARME, schatten, tasche, stempel, weich, SCHRITT_M, STUFEN, punkte, sanft, bogen, sig, zufall };
})();
const RAEUME = [{"id":"studios","szene":"e1","name":"MAKE Studios","zeichnung":"studios","plan":{"tuer":[3.2,4.1]},"L":[{"id":"website","name":"Website","x":0.75,"z":7.5,"fig":{"mensch":"jana","haltung":"tippt","blick":0,"licht":[0.75,1.9,8.4],"weg":[[1.5,7.15],[2.55,7.3],[3.45,8]],"fokus":{"x":-0.6,"d":3.9},"schild":[0,0.66]},"V":[{"n":"Landing","k":"homepage-landing","p":2990,"r":"e","ab":"ab 2.990 €","lz":""},{"n":"Story","k":"homepage-story","p":4990,"r":"e","ab":"ab 4.990 €","lz":""},{"n":"Cinematic","k":"homepage-cinematic","p":9990,"r":"e","ab":"ab 9.990 €","lz":""}]},{"id":"video","name":"Video","x":-0.38,"z":6.15,"fig":{"mensch":"tom","gespraech":1,"teil":1,"haltung":"kamera","blick":-48,"licht":[-2.85,2,7.9],"weg":[[0.35,6.45],[1.6,6.7],[2.95,7.4]],"mit":[{"mensch":"lea","gespraech":1,"teil":0,"haltung":"vor-kamera","platz":[-1.85,7.85],"blick":140,"tasche":false,"licht":[-2.85,2,7.9],"weg":[[-1.35,7.3],[-0.35,6.85],[0.5,6.55],[1.7,6.75],[2.95,7.4]]}],"fokus":{"x":-0.62,"d":4.3}},"V":[{"n":"Erklärvideo","k":"erklaervideo","p":1490,"r":"e","ab":"ab 1.490 €","lz":""},{"n":"Videostory","k":"videostory","p":1990,"r":"e","ab":"ab 1.990 €","lz":""},{"n":"Video Serie","k":"video-serie","p":1990,"r":"m","ab":"ab 1.990 €","lz":"mindestens 3 Monate"}]},{"id":"social","name":"Social Media","x":1.52,"z":5.3,"fig":{"mensch":"mika","haltung":"aufnahme","blick":-52,"licht":[1.02,1.5,5.65],"weg":[[1.75,6.05],[2.6,6.5],[3.25,7.3]],"schild":[0,0.3],"fokus":{"x":-0.25,"d":3.5}},"V":[{"n":"S","k":"social-media-s","p":990,"r":"m","ab":"ab 990 €","lz":"mindestens 3 Monate"},{"n":"M","k":"social-media-m","p":1490,"r":"m","ab":"ab 1.490 €","lz":"mindestens 3 Monate"},{"n":"L","k":"social-media-l","p":2490,"r":"m","ab":"ab 2.490 €","lz":"mindestens 3 Monate"}]}]},{"id":"revenue","szene":"e2","name":"MAKE Revenue","zeichnung":"revenue","plan":{"tuer":[-1.1,-0.2]},"L":[{"id":"tagesworkshop","name":"Tagesworkshop","x":3.1,"z":7.9,"fig":{"mensch":"paul","gespraech":7,"teil":0,"haltung":"zeigt","blick":-90,"weg":[[3,7.75],[1.3,7.75],[0.1,8]],"fokus":{"x":-0.8,"d":4.4},"mit":[{"mensch":"ida","gespraech":7,"teil":1,"haltung":"sitzt","platz":[1.2,6],"blick":0,"weg":[[0.5,6],[0.3,7.2],[-0.1,8]]},{"mensch":"karl","haltung":"tippt","platz":[2.1,6],"blick":0,"weg":[[2.1,5.3],[0.5,5.35],[0.3,7.2],[-0.1,8]]},{"mensch":"mia","gespraech":7,"teil":1,"haltung":"schreibt","platz":[2.8,6.75],"blick":-90,"tasche":false,"weg":[[3.1,7.1],[2.95,7.7],[1.3,7.75],[0.1,8]]}]},"V":[{"n":"","k":"tagesworkshop","p":1900,"r":"e","ab":"ab 1.900 €","lz":""}]},{"id":"vertriebsleitung","name":"Vertriebsleitung auf Zeit","x":-2.85,"z":7.35,"fig":{"mensch":"emil","gespraech":2,"teil":1,"haltung":"tippt","blick":0,"weg":[[-2.85,6.3],[-1.6,6.4],[-0.8,7.7]],"fokus":{"x":0.9,"d":4.5},"mit":[{"mensch":"nora","gespraech":2,"teil":0,"haltung":"sitzt-spricht","platz":[-1.85,7.3],"blick":-50,"weg":[[-1.95,6.3],[-1.6,6.4],[-0.8,7.7]],"licht":[-1.8,1.2,8.4]}],"schild":[0.5,0.08],"licht":[-2.85,1.3,8.4]},"V":[{"n":"Head of Sales","k":"head-of-sales","p":2990,"r":"m","ab":"ab 2.990 €","lz":"6 oder 12 Monate"},{"n":"Chief Sales Officer","k":"cso","p":4990,"r":"m","ab":"ab 4.990 €","lz":"6 oder 12 Monate"}]}]},{"id":"innovation","szene":"e3","name":"MAKE Innovation","zeichnung":"innovation","plan":{"tuer":[-1.5,-0.6]},"L":[{"id":"check","name":"Innovations-Check","x":-3,"z":7.3,"fig":{"mensch":"aylin","gespraech":3,"teil":1,"haltung":"schreibt","blick":90,"weg":[[-3,6.4],[-1.5,6.3],[-0.9,7.7]],"fokus":{"x":0.9,"d":4.2},"mit":[{"mensch":"lina","gespraech":3,"teil":0,"haltung":"steht","platz":[-2,7.3],"blick":-90,"tasche":false,"weg":[[-2,6.4],[-1.5,6.3],[-0.9,7.7]]}],"schild":[0.5,0.55]},"V":[{"n":"","p":0,"r":"f","ab":"kostenlos","lz":""}]},{"id":"scoping","name":"Scoping-Workshop","x":-0.1,"z":7.85,"fig":{"mensch":"david","gespraech":5,"teil":0,"haltung":"zeigt","blick":180,"weg":[[-0.1,8.35],[-0.6,8.4]],"fokus":{"x":-0.3,"d":4.4},"mit":[{"mensch":"noah","gespraech":5,"teil":1,"haltung":"schreibt","platz":[0.9,7.85],"blick":180,"tasche":false,"weg":[[0.9,8.35],[-0.6,8.4]]}],"schild":[0.5,0.53]},"V":[{"n":"","k":"scoping-workshop","p":1900,"r":"e","ab":"ab 1.900 €","lz":""}]},{"id":"projekt","name":"Umsetzungsprojekt","x":2.35,"z":7.4,"fig":{"mensch":"sven","gespraech":4,"teil":1,"haltung":"tippt","blick":0,"weg":[[1.8,7.5],[1.25,8.1],[-0.6,8.3]],"fokus":{"x":-1,"d":4.4},"mit":[{"mensch":"ben","gespraech":4,"teil":0,"haltung":"steht","platz":[3.25,7.15],"blick":-90,"tasche":false,"weg":[[3,6.6],[1.8,6.95],[1.28,8.05],[-0.6,8.3]]}],"schild":[0.35,0.84]},"V":[{"n":"","k":"umsetzungsprojekte","p":9990,"r":"e","ab":"ab 9.990 €","lz":""}]}]},{"id":"pr","szene":"e4","name":"PR & Kommunikation","zeichnung":"pr","plan":{"tuer":[-1.5,-0.6]},"L":[{"id":"pr-kommunikation","name":"PR und Kommunikation","x":0.65,"z":7.1,"fig":{"mensch":"clara","gespraech":6,"teil":0,"haltung":"sessel-spricht","blick":90,"weg":[[0.3,7.75],[-0.45,8.05]],"fokus":{"x":-0.6,"d":4.3},"mit":[{"mensch":"finn","gespraech":6,"teil":1,"haltung":"sitzt-sessel","platz":[2.4,7.1],"blick":-90,"tasche":false,"weg":[[2.4,6.2],[0.4,6.3],[-0.3,7.5],[-0.6,8.1]],"sessel":true},{"mensch":"tara","haltung":"kamera","platz":[3.05,7.92],"blick":-105,"tasche":false,"weg":[[2.8,8.3],[0.5,8.2],[-0.35,8.05]]}],"schild":[0.85,0.3],"sessel":true},"V":[{"n":"","k":"pr-kommunikation","p":2990,"r":"m","ab":"ab 2.990 €","lz":"6 oder 12 Monate"}]},{"id":"positionierung","name":"Positionierung","x":-2.65,"z":7.65,"fig":{"mensch":"jonas","haltung":"schreibt","blick":15,"weg":[[-2.2,8],[-1.8,8.3]],"fokus":{"x":0.9,"d":4.2},"schild":[0,0.57]},"V":[{"n":"S","k":"positionierung-s","p":1990,"r":"e","ab":"ab 1.990 €","lz":""},{"n":"M","k":"positionierung-m","p":2990,"r":"e","ab":"ab 2.990 €","lz":""},{"n":"L","k":"positionierung-l","p":4990,"r":"e","ab":"ab 4.990 €","lz":""}]}]},{"id":"buehne","szene":"dach","name":"Die Bühne","zeichnung":"dach","L":[{"id":"abend","name":"Fokus Abend","x":-3.5,"z":1.9,"hoch":2.25,"fig":{"art":"gruppe","fokus":{"x":1.7,"d":7.4}},"V":[{"n":"","p":0,"r":"f","ab":"für Gäste kostenlos","lz":""}]},{"id":"abendpartner","name":"Abendpartner","x":2.2,"z":8.5,"hoch":2.75,"fig":{"art":"buehne","fokus":{"x":-1,"d":9.2}},"V":[{"n":"","k":"abendpartner","p":1990,"r":"a","ab":"ab 1.990 €","lz":""}]}]}];
const MENSCHEN = {"jana":{"gr":0.96,"form":"b","statur":"schmal","haut":"#d9a784","haar":"#3a2418","frisur":"dutt","ober":{"art":"pulli","farbe":"akzent"},"unter":{"art":"hose","farbe":"#3a3f5c"},"schuhe":{"farbe":"#ece7de"},"tasche":"#5a4a3c","ohrring":true,"stand":{"r":"tasche","vor":0.06,"aus":0.24},"sitzt":"versetzt"},"tom":{"gr":1.05,"form":"a","statur":"kraeftig","haut":"#7d4f38","haar":"#17120f","frisur":"kurz","bart":true,"ober":{"art":"hoodie","farbe":"#4b5868"},"unter":{"art":"hose","farbe":"#2e3038"},"schuhe":{"farbe":"akzent","sohle":"#f0ebe2"},"tasche":"#2c2b33","uhr":true,"stand":{"l":"tasche","r":"tasche","breit":0.04,"aus":0.3},"sitzt":"weit","bauch":0.4,"schulter":1.06,"nase":1.1},"lea":{"gr":0.98,"form":"b","statur":"mittel","haut":"#e6b998","haar":"#8a4a2a","frisur":"lang","ober":{"art":"blazer","farbe":"#e9dfcf","zwei":"akzent","offen":true},"unter":{"art":"hose","farbe":"#4a4250"},"schuhe":{"farbe":"#3a3034","sohle":"#2a2226"},"scheitel":"mitte","ohrring":true,"stand":{"l":"kreuz","r":"kreuzu","vor":-0.05,"spitze":true},"sitzt":"ueber"},"mika":{"gr":1,"form":"a","statur":"schmal","haut":"#b98058","haar":"#1c1512","frisur":"locken","ober":{"art":"shirt","farbe":"#ede6da"},"unter":{"art":"hose","farbe":"#667048","laenge":"kurz"},"schuhe":{"farbe":"#f0ebe2"},"tasche":"akzent","uhr":true,"stand":{"l":"tasche","spitze":true,"kopf":0.05},"sitzt":"zurueck","rund":0.2},"paul":{"gr":1.03,"form":"a","statur":"mittel","haut":"#e0b090","haar":"#9a9690","frisur":"kurz","brille":true,"ober":{"art":"hemd","farbe":"akzent","aermel":"hoch"},"unter":{"art":"hose","farbe":"#4a4640"},"schuhe":{"farbe":"#5a4030","sohle":"#2a2018"},"tasche":"#3c3430","uhr":true,"stand":{"l":"quer","r":"kinn","breit":0.01},"sitzt":"gerade","rund":0.4,"bauch":0.3,"nase":1.2,"alter":"alt","ansatz":"hoch"},"nora":{"gr":0.97,"form":"b","statur":"mittel","haut":"#a9714f","haar":"#201612","frisur":"bob","kopfhoerer":true,"ober":{"art":"blazer","farbe":"#2f3f6a","zwei":"#e6ecf6"},"unter":{"art":"hose","farbe":"#d9d2c4"},"schuhe":{"farbe":"akzent","sohle":"#eef2f8"},"tasche":"#27304a","pony":true,"ohrring":true,"stand":{"l":"mappe","vor":0.05},"sitzt":"versetzt"},"aylin":{"gr":0.97,"form":"b","statur":"schmal","haut":"#c68e68","haar":"#161214","frisur":"zopf","ober":{"art":"pulli","farbe":"akzent"},"unter":{"art":"hose","farbe":"#e4ddd0"},"schuhe":{"farbe":"#f0ebe2"},"tasche":"#4a4458","scheitel":"mitte","stand":{"l":"gefasst","r":"gefasst","aus":0.12,"breit":-0.02},"sitzt":"gerade"},"david":{"gr":1.02,"form":"a","statur":"mittel","haut":"#c99676","haar":"#4a3626","frisur":"kurz","bart":true,"ober":{"art":"shirt","farbe":"#d8d4e6"},"unter":{"art":"hose","farbe":"#3d3a52","schnitt":"schmal"},"schuhe":{"farbe":"akzent","sohle":"#f0ebe2"},"tasche":"#33303e","stand":{"l":"huefte","breit":0.03},"sitzt":"weit","schulter":1.03},"sven":{"gr":1.06,"form":"a","statur":"schmal","haut":"#ecc4a4","haar":"#b08a4c","frisur":"kurz","kopfhoerer":true,"ober":{"art":"hoodie","farbe":"#57507a"},"unter":{"art":"hose","farbe":"#2f2e3a"},"schuhe":{"farbe":"#e9e4dc"},"tasche":"akzent","scheitel":"rechts","augen":"#4a6a8a","stand":{"r":"tasche","aus":0.16},"sitzt":"zurueck","rund":0.8,"schulter":0.94,"kopfgr":0.97},"clara":{"gr":0.99,"form":"b","statur":"mittel","haut":"#8a5a40","haar":"#17110f","frisur":"locken","ober":{"art":"blazer","farbe":"akzent","zwei":"#f0ece4","offen":true},"unter":{"art":"hose","farbe":"#34304a","schnitt":"weit"},"schuhe":{"farbe":"#2a2630","sohle":"#1c1a22"},"tasche":"#3a3450","ohrring":true,"stand":{"r":"huefte","spitze":true,"vor":0.07},"sitzt":"ueber","nase":0.95},"jonas":{"gr":1.04,"form":"a","statur":"kraeftig","haut":"#dca886","haar":"#5a3a22","frisur":"kurz","brille":true,"ober":{"art":"hemd","farbe":"#e8e2d6","aermel":"hoch"},"unter":{"art":"hose","farbe":"#4c4860"},"schuhe":{"farbe":"#6a4a34","sohle":"#2a2018"},"tasche":"akzent","uhr":true,"stand":{"l":"kreuz","r":"kreuzu","breit":0.05,"aus":0.3},"sitzt":"weit","rund":0.2,"bauch":0.7,"ansatz":"hoch"},"rosa":{"gr":0.94,"form":"b","statur":"kraeftig","haut":"#e8bfa2","haar":"#c9c2ba","frisur":"bob","brille":true,"ober":{"art":"bluse","farbe":"#d9c7e8"},"unter":{"art":"rock","farbe":"#3a3558"},"schuhe":{"farbe":"#2a2630","sohle":"#1c1a22"},"pony":true,"ohrring":true,"stand":{"l":"gefasst","r":"gefasst","aus":0.14},"sitzt":"gerade","rund":0.3,"bauch":0.5,"kopfgr":1.03,"alter":"alt"},"emil":{"gr":1.01,"form":"a","statur":"mittel","haut":"#9c6a4a","haar":"#1a1412","frisur":"kurz","ober":{"art":"blazer","farbe":"#3a3a48","zwei":"#e8e4dc"},"unter":{"art":"hose","farbe":"#3a3a48"},"schuhe":{"farbe":"#2a2420","sohle":"#1a1614"},"uhr":true,"scheitel":"rechts","stand":{"l":"tasche","breit":0.02},"sitzt":"ueber","schulter":1.02},"hanna":{"gr":0.98,"form":"b","statur":"schmal","haut":"#f0cdb0","haar":"#d8b070","frisur":"lang","ober":{"art":"pulli","farbe":"#e6dcc8","kragen":"rolli"},"unter":{"art":"hose","farbe":"#5a4a6a"},"schuhe":{"farbe":"#f0ebe2"},"scheitel":"mitte","augen":"#4a6a8a","stand":{"r":"becher","vor":-0.06,"spitze":true},"sitzt":"versetzt","nase":0.9},"omar":{"gr":1.03,"form":"a","statur":"mittel","haut":"#b07a56","haar":"#141010","frisur":"kurz","bart":true,"ober":{"art":"pulli","farbe":"#7a4a3a"},"unter":{"art":"hose","farbe":"#35384a"},"schuhe":{"farbe":"#e6e1d8"},"uhr":true,"stand":{"l":"ruecken","r":"ruecken","breit":0.04},"sitzt":"gerade","bauch":0.2,"nase":1.2},"yuki":{"gr":0.93,"form":"b","statur":"schmal","haut":"#e8c4a0","haar":"#141216","frisur":"bob","ober":{"art":"shirt","farbe":"#3f6a6a"},"unter":{"art":"hose","farbe":"#d8d0c0","laenge":"kurz"},"schuhe":{"farbe":"#2a2a30","sohle":"#e8e4dc"},"pony":true,"stand":{"kopf":0.07,"vor":0.05,"spitze":true},"sitzt":"zurueck","schulter":0.95,"kopfgr":1.04,"nase":0.8},"ben":{"gr":1.02,"form":"a","statur":"mittel","haut":"#c08a64","haar":"#2a1d14","frisur":"kurz","tasche":"#3a3a4a","ober":{"art":"shirt","farbe":"#8aa0c8"},"unter":{"art":"hose","farbe":"#2f3444"},"schuhe":{"farbe":"#ece7de"},"scheitel":"rechts","stand":{"l":"tasche","r":"tasche","breit":0.03},"sitzt":"weit","rund":0.2,"bauch":0.15},"ida":{"gr":0.95,"form":"b","statur":"schmal","haut":"#f1d3b8","haar":"#a6552e","frisur":"bob","tasche":"#6a4a3a","ober":{"art":"bluse","farbe":"#e8d6a8"},"unter":{"art":"hose","farbe":"#3a3a58"},"schuhe":{"farbe":"#8a6a52","sohle":"#2a2018"},"pony":true,"augen":"#5a7a4a","stand":{"l":"kinn","r":"quer"},"sitzt":"versetzt"},"karl":{"gr":1.07,"form":"a","statur":"kraeftig","haut":"#e8c0a0","haar":"#8d8d8d","frisur":"kurz","bart":true,"brille":true,"tasche":"#2c2b33","ober":{"art":"pulli","farbe":"#3d4f5e"},"unter":{"art":"hose","farbe":"#2c2c34"},"schuhe":{"farbe":"#2a2420","sohle":"#e8e4dc"},"uhr":true,"stand":{"l":"ruecken","r":"ruecken","breit":0.05,"aus":0.28},"sitzt":"weit","rund":0.6,"bauch":0.9,"schulter":1.04,"kopfgr":0.98,"nase":1.25,"alter":"alt","ansatz":"hoch"},"mia":{"gr":0.96,"form":"b","statur":"mittel","haut":"#7a4a34","haar":"#120d0c","frisur":"dutt","tasche":"#5a4466","ober":{"art":"hemd","farbe":"#c9d4ea","aermel":"hoch"},"unter":{"art":"hose","farbe":"#3a3248"},"schuhe":{"farbe":"#f0ebe2"},"ohrring":true,"stand":{"l":"huefte","r":"huefte","breit":0.03},"sitzt":"gerade"},"noah":{"gr":1,"form":"a","statur":"schmal","haut":"#e3b894","haar":"#3b2a1a","frisur":"locken","kopfhoerer":true,"tasche":"#2c3a58","ober":{"art":"hoodie","farbe":"#3a4a6a"},"unter":{"art":"hose","farbe":"#34343e","schnitt":"schmal"},"schuhe":{"farbe":"#ece7de"},"stand":{"l":"tasche","spitze":true},"sitzt":"zurueck","rund":0.6,"schulter":0.95},"lina":{"gr":0.97,"form":"b","statur":"schmal","haut":"#d4a07c","haar":"#5b3a22","frisur":"zopf","ober":{"art":"shirt","farbe":"#f0e6d6"},"unter":{"art":"rock","farbe":"#44406a"},"schuhe":{"farbe":"#2a2630","sohle":"#1c1a22"},"pony":true,"ohrring":true,"stand":{"l":"mappe","aus":0.12,"vor":0.04},"sitzt":"gerade","kopfgr":1.03,"nase":0.85},"tara":{"gr":0.98,"form":"b","statur":"mittel","haut":"#b98a68","haar":"#2a1a14","frisur":"lang","ober":{"art":"blazer","farbe":"#6a5aa8","zwei":"#efe9df"},"unter":{"art":"hose","farbe":"#2f2c3e"},"schuhe":{"farbe":"#2a2630","sohle":"#1c1a22"},"tasche":"#3a3050","scheitel":"mitte","ohrring":true,"stand":{"r":"becher","vor":-0.04},"sitzt":"ueber"},"finn":{"gr":1.04,"form":"a","statur":"mittel","haut":"#e6bc9a","haar":"#6a4a2a","frisur":"locken","bart":true,"brille":true,"ober":{"art":"hemd","farbe":"#cfd6e6","aermel":"hoch"},"unter":{"art":"hose","farbe":"#4a4a58"},"schuhe":{"farbe":"#6a5040","sohle":"#2a2018"},"tasche":"#44403a","stand":{"l":"tasche","breit":0.03,"kopf":-0.05},"sitzt":"versetzt","rund":0.3,"nase":1.15},"tess":{"gr":1,"form":"a","statur":"mittel","haut":"#d8a888","haar":"#3a2a20","frisur":"kurz","ober":{"art":"hemd","farbe":"akzent"},"unter":{"art":"hose","farbe":"#3a3850","laenge":"kurz"},"schuhe":{"farbe":"#e9e4dc"},"scheitel":"rechts","ohrring":true,"stand":{"r":"tasche","spitze":true},"sitzt":"versetzt"}};
const RAUM = {};
const rad = (g) => (g * Math.PI) / 180;
const SCHALE = {
  revenue: { decke: [[0, '#292826'], [0.4, '#1a1918'], [1, '#0b0b0a']], boden: [[0, '#484643'], [0.3, '#2d2b29'], [1, '#111010']], wandR: [[0, '#3b3936'], [0.3, '#252321'], [1, '#0e0d0c']], rueck: [[0, '#22201e'], [0.7, '#2c2a27'], [1, '#363330']], fliesen: true },
  innovation: { decke: [[0, '#2a2932'], [0.4, '#18171e'], [1, '#0a0a0f']], boden: [[0, '#4a4850'], [0.3, '#2c2b31'], [1, '#101013']], wandR: [[0, '#3a3942'], [0.3, '#24232b'], [1, '#0c0c11']], rueck: [[0, '#211f29'], [0.7, '#2b2a34'], [1, '#35333f']], fliesen: true },
  pr: { decke: [[0, '#2a2634'], [0.4, '#17151f'], [1, '#09080e']], boden: [[0, '#5a4c50'], [0.3, '#362e32'], [1, '#120f12']], wandR: [[0, '#40383f'], [0.3, '#27222a'], [1, '#0d0b10']], rueck: [[0, '#262130'], [0.7, '#312b3c'], [1, '#3c3548']] },
};
const LICHT = {
  studios: { id: 'studios', amb: [0.98, 0.95, 0.92], licht: [255, 246, 232], schatten: [92, 74, 80], saum: '255,244,226', L: [-0.5, -0.86], gegen: '255,255,255', gegenA: 0.18, heb: 6 },
  revenue: { id: 'revenue', amb: [0.94, 0.97, 1], licht: [236, 244, 255], schatten: [66, 80, 108], saum: '226,238,255', L: [-0.45, -0.89], gegen: '200,226,255', gegenA: 0.3, heb: 6 },
  innovation: { id: 'innovation', amb: [0.98, 0.92, 0.84], licht: [255, 232, 198], schatten: [88, 64, 70], saum: '255,222,176', L: [0.5, -0.86], heb: 6 },
  pr: { id: 'pr', amb: [0.86, 0.74, 0.64], licht: [255, 204, 150], schatten: [58, 36, 52], saum: '255,192,124', L: [0.62, -0.78], gegen: '170,160,255', gegenA: 0.2, heb: 8 },
  lav: { id: 'lav', amb: [0.84, 0.8, 0.94], licht: [236, 226, 255], schatten: [30, 22, 58], saum: '214,200,255', L: [-0.4, -0.92] },
  halle: { id: 'halle', amb: [0.98, 0.96, 0.92], licht: [255, 248, 236], schatten: [84, 76, 76], saum: '255,246,230', L: [0, -1], heb: 6 },
  strasse: { id: 'strasse', amb: [1, 0.99, 0.97], licht: [255, 250, 240], schatten: [72, 78, 98], saum: '255,250,236', L: [0.5, -0.86], heb: 4 },
  abend: { id: 'abend', amb: [0.56, 0.52, 0.6], licht: [255, 232, 204], schatten: [16, 12, 30], saum: '255,236,214', L: [0.25, -0.97], heb: 10 },
  nacht: { id: 'nacht', amb: [0.24, 0.23, 0.3], licht: [255, 226, 196], schatten: [6, 6, 12], saum: '255,236,214', L: [0.5, -0.86], heb: 5 },
};
const HALT = {
  tippt: { sitz: 0.46, l: 'tippt', r: 'maus', leben: 'tippt' },
  sitzt: { sitz: 0.46, l: 'schoss', r: 'schoss' },
  'sitzt-spricht': { sitz: 0.46, l: 'tippt', r: 'spricht', leben: 'spricht' },
  'sitzt-sessel': { sitz: 0.46, l: 'auflage', r: 'auflage' },
  'sessel-spricht': { sitz: 0.46, l: 'auflage', r: 'spricht', leben: 'spricht' },
  kamera: { l: 'griff', r: 'kamera', w: 0.35, leben: 'kamera' },
  'vor-kamera': { l: 'spricht', r: 'offen', w: -0.5, leben: 'spricht' },
  aufnahme: { l: 'spricht', r: 'zeigt', w: 0.3, leben: 'spricht' },
  filmt: { l: 'filmt', r: 'filmt', dr: 'handyhoch', w: 0.3, leben: 'kamera' },
  zeigt: { l: 'haengt', r: 'zeigt', w: 0.5, leben: 'zeigt' },
  schreibt: { l: 'haelt', r: 'schreibt', dl: 'tablet', dr: 'stift', w: -0.4, leben: 'schreibt' },
  haelt: { l: 'haelt', r: 'haelt', dr: 'tablet', w: 0.2 },
  spricht: { l: 'spricht', r: 'offen', w: 0.4, leben: 'spricht' },
  steht: { l: 'haengt', r: 'haengt', w: 0.6 },
  telefon: { l: 'huefte', r: 'telefon', dr: 'handy', w: 0.5 },
};
const GEH_TEMPO = 1.4 / 1000, SCHRITT = FIG.SCHRITT_M, TUER_H = 2.12;
const AUF_ZEIT = { sitz: 1800, steh: 1100 };
const TUER_ABSTAND = 520;
const WENDE_MS = 520;
const DREH_TEMPO = 0.011;
const personen = new Map();
const menschVon = (id, akzent) => { const k = id + akzent; let m = personen.get(k); if (!m) { m = FIG.mensch(id, MENSCHEN[id] || {}, akzent); personen.set(k, m); } return m; };
function wegBauen(start, punkte, tuer) {
  const roh = tuer ? [start, ...punkte, [tuer.x, tuer.z - 0.6], [tuer.x, tuer.z + 0.95]] : [start, ...punkte], pts = [], n = roh.length;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) {
    const a = roh[Math.max(0, i - 1)], b = roh[i], c = roh[i + 1], d = roh[Math.min(n - 1, i + 2)], m = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 0.12));
    for (let j = 0; j < m; j++) pts.push([cr(a[0], b[0], c[0], d[0], j / m), cr(a[1], b[1], c[1], d[1], j / m)]);
  }
  pts.push(roh[n - 1]);
  const cum = [0]; let sT = 0;
  for (let i = 1; i < pts.length; i++) { const dd = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(cum[i - 1] + dd); if (tuer && !sT && pts[i][1] >= tuer.z) sT = cum[i - 1] + (dd * (tuer.z - pts[i - 1][1])) / Math.max(1e-6, pts[i][1] - pts[i - 1][1]); }
  const len = cum[cum.length - 1];
  return { pts, cum, len, sT: sT || len, hd0: Math.atan2(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]) };
}
function ortAufWeg(w, s) {
  s = Math.min(w.len, Math.max(0, s)); let lo = 0, hi = w.cum.length - 2;
  while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (w.cum[mi] <= s) lo = mi; else hi = mi - 1; }
  const a = w.pts[lo], b = w.pts[lo + 1], t = (s - w.cum[lo]) / Math.max(1e-6, w.cum[lo + 1] - w.cum[lo]);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[0] - a[0], b[1] - a[1])];
}
function personBauen(st, l, d, n, wegFrei = null) {
  const x = d.platz ? d.platz[0] : l.x, z = d.platz ? d.platz[1] : l.z, halt = HALT[d.haltung] || HALT.steht, m = menschVon(d.mensch, st.akzent), w = wegFrei ? wegBauen([x, z], wegFrei, null) : wegBauen([x, z], d.weg || [], st.tuer), blick = rad(d.blick || 0), boden = d.boden || 0;
  return { l, st, n, m, halt, x, z, blick, boden, schild: d.schild || null, sessel: !!d.sessel, paar: d.gespraech ?? null, teil: d.teil ? 1 : 0, licht: d.licht || null, tasche: d.tasche !== false, w, verz: 0, tA: halt.sitz ? AUF_ZEIT.sitz : AUF_ZEIT.steh, tW: w.len / GEH_TEMPO, saat: 1 + hash(l.n * 7 + n, st.L.length) * 9, hd: blick, schritt: 0, sAlt: 0,
    hoch: (halt.sitz ? halt.sitz + 0.09 + 0.82 * m.gr : 1.78 * m.gr) + boden };
}
function staffeln(l, abstand = TUER_ABSTAND) {
  const r = l.leute.slice().sort((a, b) => a.tA + a.tW - (b.tA + b.tW)); let an = -1e9;
  for (const f of r) { an = Math.max(f.tA + f.tW, an + abstand); f.verz = an - f.tA - f.tW; }
  l.dauer = Math.max(...l.leute.map((f) => f.verz + f.tA + f.tW));
}
for (const R of RAEUME) {
  const st = { def: R, key: R.zeichnung, akzent: AKZ[R.zeichnung] || AKZ.lav, LI: R.zeichnung === 'dach' ? LICHT.abend : LICHT[R.zeichnung] || LICHT.lav, BR: MARKE[R.zeichnung] ? MARKE[R.zeichnung].rgb : LAV, lz: 1000 + R.L.length * 3700, L: R.L.map((l, n) => ({ ...l, n, drin: true, v: 0, u: 0, hov: 0, hovZiel: 0, leute: [], dauer: 1500 })) };
  st.nach = Object.fromEntries(st.L.map((l) => [l.id, l])); RAUM[R.zeichnung] = st;
  if (R.plan && R.plan.tuer) st.tuer = { x0: R.plan.tuer[0], x1: R.plan.tuer[1], x: (R.plan.tuer[0] + R.plan.tuer[1]) / 2, z: 8.98, auf: 0 };
  for (const l of st.L) if (l.fig && l.fig.mensch && st.tuer) { [l.fig, ...(l.fig.mit || [])].forEach((d, n) => l.leute.push(personBauen(st, l, d, n))); staffeln(l); }
}
const da = (key, id) => { const l = RAUM[key] && RAUM[key].nach[id]; return l ? 1 - smooth(l.u / 0.5) : 1; };
let raumLebt = 0;
const GESTE_TAKT = 6400, GESTE_DAUER = 1500;
function geste(l, t) {
  if (reduce || !t) return 0;
  const g = (t + l.n * 2300) % GESTE_TAKT; if (g > GESTE_DAUER) return 0;
  return Math.sin((g / GESTE_DAUER) * Math.PI);
}
const TAKT_H = 1700, TAKT_WEIT = 64, redeDauer = (z) => 1700 + 700 * z;
function taktGruppe(grp, leute, sperr = []) {
  const N = Math.max(leute.length, 3);
  leute.forEach((G, i) => { G.grp = grp; G.N = N; G.i = i; G.gruppe = leute; G.merk = {}; G.sperr = sperr; const pa = G.paar != null ? leute.map((x, j) => (j !== i && x.paar === G.paar ? j : -1)).filter((j) => j >= 0) : []; G.partner = pa.length ? pa : null; });
  return leute;
}
const taktGesperrt = (G, k) => { const ts = k * TAKT_H - G.grp * 731; for (const x of G.sperr) if (ts >= x[0] && ts <= x[1]) return true; return false; };
const taktWer = (G, k) => { if ((k & 1) && G.sperr.length && taktGesperrt(G, k)) return -1; const i = Math.floor(FIG.zufall(k, G.grp + 0.37) * G.N); return i === Math.floor(FIG.zufall(k - 1, G.grp + 0.37) * G.N) ? -1 : i; };
function taktArt(G, k) {
  let z = FIG.zufall(k, G.grp + 1.91 + G.i * 0.618);
  if (G.redet && !(k & 1)) { if (z < 0.78) return 'rede'; z = (z - 0.78) / 0.22; }
  if (G.arbeit) return z < 0.6 ? G.arbeit : z < 0.85 ? 'kopf' : 'nick';
  if (G.sitz) return z < 0.62 ? 'kopf' : 'nick';
  return z < 0.36 ? 'gewicht' : z < 0.62 ? 'kopf' : z < 0.88 ? (G.zug ? 'zug' : 'still') : 'nick';
}
function taktJetzt(G, t) {
  const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H);
  for (const k of [k0, k0 - 1]) if (taktWer(G, k) === G.i) return [taktArt(G, k), tt - k * TAKT_H, FIG.zufall(k, G.grp + 2.77)];
  return null;
}
function taktStand(G, art, t, dauer) {
  const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H); let m = G.merk[art];
  if (!m || m.k !== k0) { m = G.merk[art] = { k: k0, a: null, b: null }; for (let k = k0, n = 0; k > k0 - TAKT_WEIT && n < 2; k--) if (taktWer(G, k) === G.i && taktArt(G, k) === art) { if (n++ === 0) m.b = k; else m.a = k; } }
  const z = (k) => (k == null ? null : FIG.zufall(k, G.grp + 2.77));
  return [z(m.a), z(m.b), m.b == null ? 1 : FIG.sanft((tt - m.b * TAKT_H) / dauer)];
}
function taktHoert(G, t) {
  if (!G.partner || !G.hoert) return null; const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H);
  for (const k of [k0, k0 - 1]) if (!(k & 1)) { const i = taktWer(G, k); if (i >= 0 && i !== G.i && G.partner.includes(i) && taktArt(G.gruppe[i], k) === 'rede' && FIG.zufall(k, G.grp + G.i * 0.31) < 1.4 / G.partner.length) return [tt - k * TAKT_H, redeDauer(FIG.zufall(k, G.grp + 2.77))]; }
  return null;
}
function gewichtVon(G, t, grund) {
  const S0 = taktStand(G, 'gewicht', t, 950), w = (z) => (z == null ? grund : (z < 0.5 ? -1 : 1) * (0.32 + 0.5 * Math.abs(2 * z - 1)));
  return lerp(w(S0[0]), w(S0[1]), S0[2]);
}
function regen(p, t, G) {
  FIG.leben(p, t, G.saat);
  const B = FIG.bogen, K = taktStand(G, 'kopf', t, 800), kw = (z) => (z == null ? 0 : (z * 2 - 1) * (G.arbeit ? 0.14 : 0.3)); p.kd += lerp(kw(K[0]), kw(K[1]), K[2]);
  const offen = [[p.ar, p.hr], [p.al, p.hl]].filter((x) => x[1] === 'offen').map((x) => x[0]);
  if (G.redet || G.partner) for (const A of offen) A[2] -= 0.35;
  if (G.arbeit === 'schwenk') { const V = taktStand(G, 'schwenk', t, 1250), vw = (z) => (z == null ? 0 : z * 2 - 1), v = lerp(vw(V[0]), vw(V[1]), V[2]); p.ar[0] += 0.04 * v; p.al[0] += 0.05 * v; p.al[2] += 0.07 * v; p.dreh += 0.05 * v; }
  const J = taktJetzt(G, t);
  if (J) { const [art, ms, z] = J;
    if (art === 'nick') p.kn += 0.09 * B(ms, 260, 60, 380);
    else if (art === 'zug') p.zug = B(ms, 560, 800, 660);
    else if (art === 'rede') { const D = redeDauer(z), an = B(ms, 140, D - 420, 280), g = B(ms - 180, 480, D - 1300, 620);
      p.rede = an; if (an > 0.05) p.mund = an * (0.3 + 0.5 * Math.abs(Math.sin(ms * 0.011 + G.saat * 3))); p.kn += 0.03 * g; for (const A of offen) { A[0] += 0.17 * g * (0.7 + 0.6 * z); A[2] += 0.57 * g; A[1] += 0.05 * g; } }
    else if (art === 'tipp') { const an = B(ms, 180, 1250, 240); p.al[2] += 0.035 * Math.sin(ms * 0.031) * an; p.ar[2] += 0.02 * Math.sin(ms * 0.023 + 1) * an; p.ar[1] += 0.045 * an * Math.sin(ms * 0.0034); p.kn += 0.03 * an; }
    else if (art === 'schrieb') { const an = B(ms, 200, 1400, 260); p.ar[0] += 0.05 * an * (ms / 1860 - 0.4); p.ar[2] += 0.014 * Math.sin(ms * 0.027) * an; }
    else if (art === 'zeig') { const ab = B(ms, 600, 900, 700); p.ar = p.ar.map((v, i) => lerp(v, FIG.ARME.spricht[i], ab * 0.75)); }
  }
  const Ho = taktHoert(G, t); if (Ho) p.kn += 0.075 * B(Ho[0] - (Ho[1] - 760), 240, 80, 380);
  return p;
}
const ARBEIT = { tippt: 'tipp', schreibt: 'schrieb', kamera: 'schwenk', zeigt: 'zeig' }, ZUG = { becher: true, mappe: true, kinn: true };
function taktVon(f) {
  if (f.G) return f.G;
  const st = f.st, alle = st.L.flatMap((l) => l.leute).filter((x) => !x.stempel);
  taktGruppe(1 + Object.keys(RAUM).indexOf(st.key), alle.map((x) => { const a = x.halt.leben; return (x.G = { saat: x.saat, redet: a === 'spricht' || (x.paar != null && (!a || a === 'zeigt')), arbeit: ARBEIT[a] || null, sitz: !!x.halt.sitz, hoert: a !== 'tippt' && a !== 'kamera', paar: x.paar, zug: ZUG[x.m.eig.l] || ZUG[x.m.eig.r] || false }); }), st.sperr || (st.sperr = []));
  return f.G || (f.G = taktGruppe(99, [{ saat: f.saat, sitz: !!f.halt.sitz }])[0]);
}
function platzHaltung(f, t) {
  const h = f.halt, G = t ? taktVon(f) : null;
  const p = h.sitz ? FIG.sitz(h.sitz, f.m.gr, h.l, h.r, f.sessel ? 'sessel' : '') : FIG.steh(Math.max(-1, Math.min(1, t ? gewichtVon(G, t, h.w || 0) : h.w || 0)), h.l, h.r);
  const a = h.leben; if (a === 'tippt' || a === 'schreibt' || a === 'kamera') p.mund = -1;
  if (a === 'tippt') p.kn += 0.05; else if (a === 'kamera') { p.kn += 0.08; p.neig += 0.04; }
  return t ? regen(p, t, G) : p;
}
const lebSig = (f, t) => (f.sgT === t ? f.sg : ((f.sgT = t), (f.sg = FIG.sig(platzHaltung(f, t)))));
function wo(f) {
  const l = f.l, tau = l.u * l.dauer - f.verz;
  if (tau <= 1e-6) return { q: 0, s: 0, x: f.x, z: f.z, ziel: f.blick };
  if (tau < f.tA) return { q: tau / f.tA, s: 0, x: f.x, z: f.z, ziel: tau > f.tA * 0.6 && !l.drin ? f.w.hd0 : f.blick };
  const q = (tau - f.tA) / f.tW; if (q >= 1 - 1e-7) return { q: 1, s: f.w.len, fort: true };
  const a = 0.14, s = f.w.len * (q < a ? (q * q) / (a * (2 - a)) : (2 * q - a) / (2 - a)), o = ortAufWeg(f.w, s);
  return { q: 1, s, x: o[0], z: o[1], ziel: o[2] + (l.drin ? Math.PI : 0) };
}
const dreheZu = (von, zu, max) => { let d = (zu - von) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) <= max ? zu : von + Math.sign(d) * max; };
const tuerBedarf = (f, s) => (s <= 0 ? 0 : s < f.w.sT ? smooth((s - (f.w.sT - 1.7)) / 1.0) : 1 - smooth((s - f.w.sT - 0.35) / 0.5));
const HOT = [];
function merke(l, x, z, hoch, halb = 0.42, neben = false, y0 = 0, sch = null) {
  const dz = z - cam.z; if (dz < 0.8) return;
  const a = P(x - halb, hoch, z), b = P(x + halb, y0, z), c = S.css, kopf = P(x, hoch + 0.12, z), s = sch ? P(x + sch[0], hoch + 0.12 + sch[1], z) : kopf;
  HOT.push({ l, neben, x0: a[0] * c, y0: a[1] * c, x1: b[0] * c, y1: b[1] * c, sx: s[0] * c, sy: s[1] * c, stiel: (kopf[1] - s[1]) * c });
}
function stuhlDinge(list, f, rueck) {
  if (f.sessel) rueck = 0;
  const hd = Math.round(f.blick / (Math.PI / 2)) * (Math.PI / 2), fx = Math.sin(hd), fz = Math.cos(hd), cx = f.x - fx * rueck, cz = f.z - fz * rueck, b = f.boden;
  const kiste = (a0, a1, y0, y1, v0, v1, cT, cF, cS) => { const xa = cx + a0 * fz + v0 * fx, xb = cx + a1 * fz + v1 * fx, za = cz - a0 * fx + v0 * fz, zb = cz - a1 * fx + v1 * fz; box(Math.min(xa, xb), Math.max(xa, xb), y0 + b, y1 + b, Math.min(za, zb), Math.max(za, zb), cT, cF, cS); };
  if (f.sessel) {
    const C = f.sessel === true ? { top: '#8f7fc8', front: '#4a3c86', seite: '#3a2e6c', kante: '#b9aaf0' } : f.sessel;
    const lehneVorn = Math.hypot(cx - 0.3 * fx - cam.x, cz - 0.3 * fz - cam.z) < Math.hypot(f.x - cam.x, f.z - cam.z);
    const lehne = () => { kiste(-0.36, 0.36, 0.42, 1.02, -0.4, -0.24, C.kante, C.front, C.seite); kiste(-0.36, 0.36, 0.98, 1.02, -0.4, -0.24, C.kante, C.kante, C.kante); };
    list.push({ z: f.z + 0.3, fn: () => { schatten(cx - 0.46, cx + 0.46, cz - 0.46, cz + 0.46); for (const [a, v] of [[-0.3, -0.34], [0.26, -0.34], [-0.3, 0.26], [0.26, 0.26]]) kiste(a, a + 0.05, 0, 0.14, v, v + 0.05, '#0c0a16', '#0c0a16', '#0c0a16'); if (!lehneVorn) lehne(); kiste(-0.36, 0.36, 0.14, 0.44, -0.26, 0.34, C.top, C.front, C.seite); } });
    const arm = (s) => () => { kiste(s > 0 ? 0.26 : -0.38, s > 0 ? 0.38 : -0.26, 0.14, 0.64, -0.3, 0.34, C.kante, C.front, C.seite); };
    for (const s of [-1, 1]) { const ax = cx + s * 0.32 * fz, az = cz - s * 0.32 * fx, nah = Math.hypot(ax - cam.x, az - cam.z) < Math.hypot(f.x - cam.x, f.z - cam.z); list.push({ z: f.z + (nah ? -0.05 : 0.2), fn: arm(s) }); }
    if (lehneVorn) list.push({ z: f.z - 0.06, fn: lehne });
    return;
  }
  list.push({ z: f.z + 0.03, fn: () => {
    schatten(cx - 0.3, cx + 0.3, cz - 0.3, cz + 0.3);
    for (const [a, v] of [[-0.19, 0.18], [0.16, 0.18], [-0.19, -0.2], [0.16, -0.2]]) kiste(a, a + 0.03, 0, 0.43, v, v + 0.03, '#111', '#15141b', '#15141b');
    kiste(-0.22, 0.22, 0.43, 0.47, -0.22, 0.22, '#55525f', '#26242e', '#2c2a35');
  } });
  const lx = cx - 0.215 * fx, lz = cz - 0.215 * fz, vorn = Math.hypot(lx - cam.x, lz - cam.z) < Math.hypot(f.x - cam.x, f.z - cam.z);
  list.push({ z: f.z + (vorn ? -0.04 : 0.025), fn: () => {
    for (const a of [-0.19, 0.16]) kiste(a, a + 0.03, 0.47, 0.6, -0.23, -0.2, '#111', '#15141b', '#15141b');
    kiste(-0.21, 0.21, 0.58, 0.93, -0.235, -0.195, '#5a5766', '#2a2833', '#302e3a');
  } });
}
function umrissMalen(f, a, farbe) {
  const dz = f.z - cam.z; if (dz < 0.7) return;
  const q = P(f.x, f.boden, f.z), k = Math.round((S.f / dz) * 2) / 2, dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz), dk = Math.round(dreh * 40) / 40;
  FIG.stempel(ctx, `u${f.st.key}${f.l.id}${f.n}`, `${k}|${dk}|${farbe}`, q[0], q[1], k, (g, x, y, kk) => FIG.malen(g, f.m, platzHaltung(f, 0), x, y, kk, { dreh: dk, auge: cam.y - oy - f.boden, dz, licht: LICHT.lav, modus: 'umriss', farbe }), a, raumBewegt(f.st));
}
const BILD = {
  PH: 12,
  DIR: 8,
  AUF: 6,
  K_BEW: [200, 90],
  BEW_JE_BILD: [2, 1],
  DREH_AB: 0.3,
  BLENDE_MS: 150,
  AUF_ANTEIL: 0.68,
  K_DACH: 64,
  K_PUB: 45,
  K_MAX: [90, 70],
  K_RUHE: [220, 150],
  K_FEIN: [900, 0],
  FEIN_MP: [4.5, 0],
  MP: [10, 6],
  JE_BILD: [2, 1],
  WARM_MS: [2.5, 2],
  WARM_ZELLEN: [2, 1],
  RAND: 2.6,
};
if (QUERY.get('gang') === 'grob') BILD.PH = 8; else if (QUERY.get('gang') === 'fein') BILD.K_MAX = [130, 70];
if (QUERY.get('fein') === '0') BILD.K_FEIN = [0, 0];
let BILD_GEN = 1, bildMP = 0;
const ATLANTEN = new Set();
let SCHATTEN_BILD = null;
function schattenSetzen(x, y, k, flach, a = 1) {
  if (!SCHATTEN_BILD) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), s = g.createRadialGradient(64, 64, 0, 64, 64, 64); s.addColorStop(0, 'rgba(0,0,0,.5)'); s.addColorStop(0.55, 'rgba(0,0,0,.225)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(0, 0, 128, 128); SCHATTEN_BILD = c; }
  const r = 0.44 * k; if (a < 1) ctx.globalAlpha *= a; ctx.drawImage(SCHATTEN_BILD, x - r, y - r * flach, 2 * r, 2 * r * flach); if (a < 1) ctx.globalAlpha /= a;
}
function atlasNeu(k, halb, hoch, tief) {
  const pad = 5, cw = Math.ceil(2 * halb * k) + 2 * pad, ch = Math.ceil((hoch + tief) * k) + 2 * pad, cols = Math.max(1, Math.min(8, Math.floor(2040 / cw))), rows = 1;
  const a = { k, cw, ch, ax: cw / 2, ay: pad + Math.ceil(hoch * k), cols, je: cols * rows, rows, seiten: [], map: new Map(), n: 0, mp: 0, zuletzt: performance.now() };
  ATLANTEN.add(a); return a;
}
function atlasFrei(a) { for (const s of a.seiten) { s.c.width = s.c.height = 0; } bildMP -= a.mp; a.mp = 0; a.seiten.length = 0; a.map.clear(); a.n = 0; ATLANTEN.delete(a); a.tot = true; }
function atlasOrt(a, i) { const s = a.seiten[Math.floor(i / a.je)], j = i % a.je; return [s.c, (j % a.cols) * a.cw, Math.floor(j / a.cols) * a.ch]; }
function atlasZelle(a, key, male) {
  let i = a.map.get(key);
  if (i === undefined) {
    i = a.n++; a.map.set(key, i);
    const si = Math.floor(i / a.je);
    if (!a.seiten[si]) { const c = document.createElement('canvas'); c.width = a.cols * a.cw; c.height = a.rows * a.ch; a.seiten[si] = { c, g: c.getContext('2d') }; const mp = (c.width * c.height) / 1e6; a.mp += mp; bildMP += mp; }
    const [c, x, y] = atlasOrt(a, i), g = a.seiten[si].g;
    g.save(); g.beginPath(); g.rect(x, y, a.cw, a.ch); g.clip(); male(g, x + a.ax, y + a.ay, a.k); g.restore();
    MESS.vorgezeichnet = (MESS.vorgezeichnet || 0) + 1; if (MESS.z && a.st && raumBewegt(a.st)) (MESS.fehl = MESS.fehl || []).push(`${a.st.key} ${key} ${a.cw}`);
  }
  return i;
}
function atlasSetzen(a, i, X, Y, k) { const [c, x, y] = atlasOrt(a, i), s = k / a.k; a.zuletzt = lastT; ctx.drawImage(c, x, y, a.cw, a.ch, X - a.ax * s, Y - a.ay * s, a.cw * s, a.ch * s); }
function bilderSparen() {
  for (const sp of [...BEWEGTE]) if (lastT - sp.bew.zuletzt > 4000) bewFrei(sp);
  if (bildMP <= BILD.MP[STUFE]) return;
  const hier = AKT.F && RAUM[AKT.F.key], alt = [...ATLANTEN].filter((a) => a.st !== hier).sort((p, q) => p.zuletzt - q.zuletzt);
  if (hier && AKT.k >= 1) for (const key in RAUM) { const st = RAUM[key]; if (st === hier) continue; for (const l of st.L) for (const f of l.leute) { const R = f.sp && f.sp.ruhe; if (R && R.mp) { bauFrei(R); bildMP -= R.mp; R.c.width = R.c.height = 0; f.sp.ruhe = null; } } }
  for (const a of alt) { if (bildMP <= BILD.MP[STUFE] * 0.8) break; atlasFrei(a); }
  if (bildMP > BILD.MP[STUFE]) for (const a of [...ATLANTEN].filter((x) => x.st === hier && lastT - x.zuletzt > 1500).sort((p, q) => p.zuletzt - q.zuletzt)) { if (bildMP <= BILD.MP[STUFE] * 0.8) break; atlasFrei(a); }
}
let RAUM_HIER = '';
function raeumen(hier) {
  for (const a of [...ATLANTEN]) if (a.st && a.st !== hier) atlasFrei(a);
  for (const key in RAUM) { const st = RAUM[key]; if (st === hier) continue; for (const l of st.L) for (const x of l.leute) { const R = x.sp && x.sp.ruhe; if (R) { bauFrei(R); bildMP -= R.mp || 0; R.c.width = R.c.height = 0; x.sp.ruhe = null; } taschenFrei(x.sp); bewFrei(x.sp); } }
}
function spVon(f) {
  let sp = f.sp; if (sp && sp.gen === BILD_GEN) return sp;
  if (sp) { bewFrei(sp); if (sp.auf && !sp.auf.tot) atlasFrei(sp.auf); if (sp.ruhe) { bauFrei(sp.ruhe); bildMP -= sp.ruhe.mp; sp.ruhe.c.width = sp.ruhe.c.height = 0; } taschenFrei(sp); }
  return (f.sp = { gen: BILD_GEN, auf: null, ruhe: null });
}
const kStufe = (k, max) => Math.min(max, Math.max(24, Math.ceil(k / 10) * 10));
const ruheStufe = (k) => { const max = BILD.K_RUHE[STUFE]; let st = 24; while (st < k && st < max) st = Math.min(max, Math.ceil(st * 1.2)); return st; };
const RUHE_VORAUS = 3;
let RUHE_FREI = 0, RUHE_N = 0;
const kMaxVon = (st) => Math.min(BILD.K_MAX[STUFE], st.key === 'dach' ? BILD.K_DACH : 999);
function wegAtlas(f, k, neu = false) {
  const st = f.st, name = `${f.m.id}|${f.tasche ? 1 : 0}`, max = f.stempel ? Math.min(kMaxVon(st), BILD.K_PUB) : kMaxVon(st);
  if (st.atlGen !== BILD_GEN) { if (st.atl) for (const a of st.atl.values()) if (!a.tot) atlasFrei(a); st.atl = new Map(); st.atlGen = BILD_GEN; }
  let a = st.atl.get(name);
  if (a && (a.tot || (neu && k > a.k * 1.12 && a.k < max))) { if (!a.tot) atlasFrei(a); a = null; }
  if (!a) { a = atlasNeu(kStufe(k, max), 0.5 * f.m.gr, 1.9 * f.m.gr, 0.2 * f.m.gr); a.st = st; st.atl.set(name, a); bilderSparen(); }
  return a;
}
function aufAtlas(f, k, neu = false) {
  if (f.stempel) {
    const st = f.st; if (st.aufGen !== BILD_GEN) { if (st.aufAtl) for (const x of st.aufAtl.values()) if (!x.tot) atlasFrei(x); st.aufAtl = new Map(); st.aufGen = BILD_GEN; }
    let g = st.aufAtl.get(f.m.id); if (g && g.tot) g = null;
    if (!g) { g = atlasNeu(kStufe(k, Math.min(kMaxVon(st), BILD.K_PUB)), 0.9 * f.m.gr, 1.9 * f.m.gr, 0.2 * f.m.gr); g.st = st; st.aufAtl.set(f.m.id, g); bilderSparen(); }
    return g;
  }
  const sp = spVon(f), max = kMaxVon(f.st); let a = sp.auf;
  if (a && (a.tot || (neu && k > a.k * 1.12 && a.k < max))) { if (!a.tot) atlasFrei(a); a = null; }
  if (!a) { a = sp.auf = atlasNeu(kStufe(k, max), 0.9 * f.m.gr, 1.9 * f.m.gr, 0.2 * f.m.gr); a.st = f.st; bilderSparen(); }
  return a;
}
const TAU = Math.PI * 2;
const richtungNr = (dreh) => ((Math.round((dreh / TAU) * BILD.DIR) % BILD.DIR) + BILD.DIR) % BILD.DIR;
const phaseNr = (schritt) => ((Math.round((schritt / TAU) * BILD.PH) % BILD.PH) + BILD.PH) % BILD.PH;
const winkelZu = (von, zu) => { let d = (zu - von) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const stehPose = (f) => FIG.steh(0, 'haengt', f.tasche ? 'traegt' : 'haengt');
const gehPose = (f, ph) => FIG.geh(ph, f.tasche ? 'r' : '');
const TASCHE_AB = 0.6;
function aufPose(f, e) {
  const steh = stehPose(f), R0 = f.sp && f.sp.ruhe, platz = platzHaltung(f, f.l.drin && f.st.tLeb !== undefined ? f.st.tLeb : R0 && R0.t ? R0.t : 0), zw = FIG.zwischen;  let p, r = f.halt.dr || null, li = f.halt.dl || null;
  const kurve = (K, u) => { const n = K.length - 2, x = Math.min(n - 1e-6, Math.max(0, u) * n), i = Math.floor(x), t = x - i, b0 = ((1 - t) * (1 - t)) / 2, b2 = (t * t) / 2, b1 = 1 - b0 - b2; return zw(zw(K[i], K[i + 1], b1 / (b0 + b1)), K[i + 2], b2); };
  if (f.halt.sitz) {
    const vor = FIG.sitz(f.halt.sitz, f.m.gr, 'schoss', 'schoss', f.sessel ? 'sessel' : ''); vor.neig = 0.52; vor.kn = 0.2; vor.bl = [vor.bl[0], 0.1, vor.bl[2] + 0.5, 0.25]; vor.br = [vor.br[0], 0.1, vor.br[2] + 0.5, 0.25]; vor.pf = 0.05;
    const halb = FIG.hocke(0.95, 'schoss', 'haengt'); halb.neig = 0.58; halb.kn = 0.12; halb.pf = 0.1;
    const fast = FIG.hocke(0.3, 'haengt', 'haengt'); fast.neig = 0.2;
    p = kurve([platz, platz, vor, halb, fast, steh, steh], e);
  } else {
    const los = FIG.steh(-0.3, 'haengt', 'haengt'); los.neig = 0.06;
    p = kurve([platz, platz, los, steh, steh], e);
  }
  if (f.tasche) { const bog = Math.sin(Math.PI * Math.min(1, Math.max(0, (e - 0.32) / 0.56))); p.ar = p.ar.map((v, i) => lerp(v, FIG.ARME.greift[i], bog * 0.9)); if (!f.halt.sitz) { p.neig += 0.26 * bog; p.seit += 0.08 * bog; p.kn += 0.2 * bog; } r = e > TASCHE_AB ? 'tasche' : e > 0.25 ? null : r; } else if (e > 0.35) r = null;
  if (e > 0.25) li = null;
  return [p, r, li];
}
function platzLicht(f, LI) {
  if (!f.licht || f.licht[2] - cam.z <= 0.5) return LI.L;
  const a = P(f.x, f.boden + 1.25, f.z), b = P(f.licht[0], f.licht[1], f.licht[2]), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return d > 12 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : LI.L;
}
function ruheZeichnen(f, t, mitRand, fein = false) {
  const sp = spVon(f), LI = f.st.LI, dz = Math.max(0.7, f.z - cam.z), kx = S.f / dz, pad = 6;
  let R = sp.ruhe;
  if (!R) { const c = document.createElement('canvas'); R = sp.ruhe = { c, g: c.getContext('2d'), mp: 0 }; }
  bauFrei(R);
  const halten = !fein && R.fein && R.k !== undefined && R.k * 1.15 >= ruheStufe(kx), k = fein ? Math.min(BILD.K_FEIN[STUFE], kx) : halten ? R.k : ruheStufe(kx * (KAM_STEHT ? 1 : RUHE_VORAUS));
  const dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz), o = { dreh, auge: cam.y - oy - f.boden, dz, licht: LI, L: platzLicht(f, LI), saum: { farbe: LI.saum, a: 0.32 }, r: f.halt.dr || null, l: f.halt.dl || null };
  const rk = `${k}|${Math.round(dreh * 6)}`;
  if (R.rk !== rk) { const B = FIG.rahmen(f.m, platzHaltung(f, 0), o); R.rk = rk; R.bl = B.l + 0.2; R.br = B.r + 0.2; R.bo = B.o + 0.1; R.bu = B.u + 0.12; }
  const w = Math.ceil((R.bl + R.br) * k) + 2 * pad, h = Math.ceil((R.bo + R.bu) * k) + 2 * pad;
  let ax = pad + Math.round(R.bl * k), ay = pad + Math.round(R.bo * k);
  if (fein) { const q = P(f.x, f.boden, f.z); ax = q[0] - Math.round(q[0] - ax); ay = q[1] - Math.round(q[1] - ay); }
  const bleibt = !mitRand && R.rand && R.c.width === 2 * w && R.c.height === h && Math.abs(dreh - R.randDreh) < 0.12;
  const breit = mitRand || bleibt ? 2 * w : w;
  if (R.c.width !== breit || R.c.height !== h) { bildMP -= R.mp; R.c.width = breit; R.c.height = h; R.mp = (breit * h) / 1e6; bildMP += R.mp; } else R.g.clearRect(0, 0, bleibt ? w : breit, h);
  const p = platzHaltung(f, t), leicht = !fein && !halten && !KAM_STEHT && !reduce && !STATISCH; if (leicht) o.leicht = true;
  FIG.malen(R.g, f.m, p, ax, ay, k, o);
  if (mitRand) FIG.malen(R.g, f.m, p, w + ax, ay, k, { ...o, modus: 'rand', rand: { farbe: f.st.BR, px: BILD.RAND / S.css, a: 1 } });
  R.k = k; R.w = w; R.h = h; R.ax = ax; R.ay = ay; R.dreh = dreh; R.rand = !!mitRand || bleibt; if (mitRand) R.randDreh = dreh; R.t = t; R.sig = t ? lebSig(f, t) : 0; R.fein = fein || halten; R.genau = fein; R.leicht = leicht;
  RUHE_N++; MESS.ruhebilder = (MESS.ruhebilder || 0) + 1; if (fein) MESS.fein = (MESS.fein || 0) + 1; if (MESS.z && raumBewegt(f.st)) (MESS.fehl = MESS.fehl || []).push(`${f.st.key} ruhebild ${f.m.id}`);
}
function feinSchritt(f, t) {
  const sp = spVon(f), R = sp.ruhe, LI = f.st.LI, dz = Math.max(0.7, f.z - cam.z), kx = S.f / dz, k = Math.min(BILD.K_FEIN[STUFE], kx), pad = 6; let N = R.bau;
  if (!N || N.k !== k || N.sig !== KAM_SIG) {
    if (N) { bildMP -= N.mp; N.c.width = N.c.height = 0; }
    const dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz), o = { dreh, auge: cam.y - oy - f.boden, dz, licht: LI, L: platzLicht(f, LI), saum: { farbe: LI.saum, a: 0.32 }, r: f.halt.dr || null, l: f.halt.dl || null };
    const B = FIG.rahmen(f.m, platzHaltung(f, 0), o), bl = B.l + 0.2, br = B.r + 0.2, bo = B.o + 0.1, bu = B.u + 0.12, w = Math.ceil((bl + br) * k) + 2 * pad, h = Math.ceil((bo + bu) * k) + 2 * pad, q = P(f.x, f.boden, f.z);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.clearRect(0, 0, 2, 2);
    R.bau = { c, g, k, sig: KAM_SIG, w, h, mp: (w * h) / 1e6, ax: q[0] - Math.round(q[0] - (pad + Math.round(bl * k))), ay: q[1] - Math.round(q[1] - (pad + Math.round(bo * k))), dreh, o, t, i: 0, n: k * f.m.gr > 300 ? 4 : k * f.m.gr > 150 ? 3 : 2, bl, br, bo, bu, rk: `${k}|${Math.round(dreh * 6)}` };
    bildMP += R.bau.mp; return false;
  }
  FIG.malen(N.g, f.m, platzHaltung(f, N.t), N.ax, N.ay, k, { ...N.o, teil: [N.i / N.n, (N.i + 1) / N.n] }); N.i++; RUHE_N++;
  if (N.i < N.n) return false;
  bildMP -= R.mp; R.c.width = R.c.height = 0; R.c = N.c; R.g = N.g; R.mp = N.mp; R.k = k; R.w = N.w; R.h = N.h; R.ax = N.ax; R.ay = N.ay; R.dreh = N.dreh; R.rand = false; R.t = N.t; R.sig = N.t ? lebSig(f, N.t) : 0; R.fein = R.genau = true; R.leicht = false; R.rk = N.rk; R.bl = N.bl; R.br = N.br; R.bo = N.bo; R.bu = N.bu; R.bau = null;
  MESS.ruhebilder = (MESS.ruhebilder || 0) + 1; MESS.fein = (MESS.fein || 0) + 1; return true;
}
const bauFrei = (R) => { if (R && R.bau) { bildMP -= R.bau.mp; R.bau.c.width = R.bau.c.height = 0; R.bau = null; } };
const raumBewegt = (st) => st.L.some((l) => l.fest == null && ((l.u > 0 && l.u < 1) || l.wende > 0 || (l.warte > 0 && l.u !== (l.drin ? 0 : 1))));
const bleibt = () => reduce || STATISCH || (KAM_STEHT && lastT - SCROLL_T >= WARM_NACH);
function ruhePflegen(st, leute, lebt) {
  const t = lebt && !reduce && !STUFE ? st.lz : 0, ruhig = !raumBewegt(st); st.tLeb = t; let frei = BILD.JE_BILD[STUFE];
  const kMax = BILD.K_FEIN[STUFE], feinOk = lebt && kMax > 0 && bleibt() && ruhig;
  let feinMP = 0; if (feinOk) for (const f of leute) { const R = f.sp && f.sp.ruhe; if (R && R.fein) feinMP += R.mp; }
  const braucht = [];
  for (const f of leute) {
    const sp = spVon(f), R = sp.ruhe, hov = f.l.hovZiel > 0 || f.l.hov > 0.02;
    if (!R || R.k === undefined) { if (RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, t, hov, feinOk && (reduce || STATISCH)); } else NOCHMAL = true; continue; }
    if (hov && !R.rand) { ruheZeichnen(f, t, hov, feinOk && R.genau); continue; }
    const dz = Math.max(0.7, f.z - cam.z), kx = S.f / dz, soll = ruheStufe(kx), dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz);
    const dw = Math.abs(dreh - R.dreh), alt = (R.fein ? kx > R.k * 1.15 : soll > R.k) || dw > (kx < 80 ? 1.3 : 0.3);
    const kf = Math.min(kMax, kx), sichtbar = feinOk && kx >= 30 && (() => { const q = P(f.x, f.boden, f.z); return q[0] > -0.4 * kx && q[0] < S.w + 0.4 * kx; })();
    if (alt) braucht.push([f, 0, kx]);
    else if (sichtbar && (!R.genau || Math.abs(R.k - kf) > 0.01)) braucht.push([f, 0.5, kx, R.fein ? R.mp : 0]);
    else if ((t && R.sig !== lebSig(f, t)) || (KAM_STEHT && (R.leicht || (dw > 0.05 && kx >= 80)))) braucht.push([f, 1, kx]);
  }
  if (!braucht.length) return;
  const takt = !HIMMEL_LEBT || lastT - (st.pflegeT || 0) >= TAKT_RUHE[STUFE] * 2.2 - 4; if (HIMMEL_LEBT) frei = 1; let lebFrei = 1, lebt2 = false;
  braucht.sort((a, b) => a[1] - b[1] || (a[1] === 0.5 ? b[2] - a[2] : (a[0].sp.ruhe.t || 0) - (b[0].sp.ruhe.t || 0)));
  let offen = false;
  for (const [f, art, kx, mpAlt] of braucht) {
    if (!ruhig && art === 0) continue;
    if (art === 0.5) {
      const R = f.sp.ruhe, kf = Math.min(kMax, kx), mp = (R.mp * (kf / R.k) * (kf / R.k)) / (R.rand ? 2 : 1);
      if (feinMP - mpAlt + mp <= BILD.FEIN_MP[STUFE]) { if (frei <= 0 || RUHE_FREI <= 0) { offen = true; break; } frei = 0; RUHE_FREI--; feinSchritt(f, t); offen = true; break; }
      if (!t || R.sig === lebSig(f, t)) continue;
    }
    if (art !== 0) { const Rz = f.sp.ruhe; if (!takt || lastT - (Rz.zt || 0) < TAKT_RUHE[STUFE] - 4) continue; if (lebFrei <= 0) { lebt2 = true; continue; } lebFrei--; Rz.zt = lastT; }
    if (frei <= 0 || RUHE_FREI <= 0) break; frei--; RUHE_FREI--; ruheZeichnen(f, t, f.l.hovZiel > 0 || f.l.hov > 0.02, art !== 0 && feinOk && f.sp.ruhe.genau); st.pflegeT = lastT;
  }
  if (lebt2 && !HIMMEL_LEBT) NOCHMAL = true;
  if (KAM_STEHT && (offen || braucht[0][1] === 0)) NOCHMAL = true;
}
function aufRichtung(f, e) {
  const d = direkt(f), a = d ? BILD.DREH_AB : BILD.AUF_ANTEIL; if (e <= a) return f.blick;
  const ziel = f.l.drin ? f.w.hd0 + Math.PI : f.w.hd0;
  return f.blick + winkelZu(f.blick, ziel) * (d ? FIG.sanft : smooth)((e - a) / (1 - a));
}
function gehZelle(f, a, ph, dir, probe) {
  return atlasZelle(a, ph * 64 + dir, (g, x, y, kk) => FIG.malen(g, f.m, gehPose(f, (ph / BILD.PH) * TAU), x, y, kk, { dreh: (dir / BILD.DIR) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r: f.tasche ? 'tasche' : null, leicht: true }));
}
function stehZelle(f, a, dir, probe) {
  return atlasZelle(a, 4000 + dir, (g, x, y, kk) => FIG.malen(g, f.m, stehPose(f), x, y, kk, { dreh: (dir / BILD.DIR) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r: f.tasche ? 'tasche' : null, leicht: true }));
}
function gehNr(f, a, ph, dir, probe) {
  if (!a.map.has(ph * 64 + dir)) {
    for (const d of [1, -1]) { const i = a.map.get(ph * 64 + ((dir + d + BILD.DIR) % BILD.DIR)); if (i !== undefined) return i; }
    for (const d of [1, -1]) { const i = a.map.get(((ph + d + BILD.PH) % BILD.PH) * 64 + dir); if (i !== undefined) return i; }
  }
  return gehZelle(f, a, ph, dir, probe);
}
function stehNr(f, a, dir, probe) {
  if (!a.map.has(4000 + dir)) for (const d of [1, -1]) { const i = a.map.get(4000 + ((dir + d + BILD.DIR) % BILD.DIR)); if (i !== undefined) return i; }
  return stehZelle(f, a, dir, probe);
}
function aufNr(f, a, i, dz, probe) {
  const w0 = aufWinkelNr(f, dz);
  if (!a.map.has(w0 * 64 + i)) for (const d of [1, -1, 2, -2]) { const j = a.map.get(((w0 + d + AUF_WINKEL) % AUF_WINKEL) * 64 + i); if (j !== undefined) return j; }
  if (!a.map.has(w0 * 64 + i) && a.n > 0 && ZELLEN_FREI-- <= 0) return a.n - 1;
  return aufZelle(f, a, i, w0, probe);
}
let ZELLEN_FREI = 1;
function taschenSetzen(f, x, y, k) {
  const sp = spVon(f), fein = bleibt() && BILD.K_FEIN[STUFE] > 0, soll = fein ? Math.min(BILD.K_FEIN[STUFE], k) : ruheStufe(k); let B = sp.tasche;
  if (!B || (fein ? Math.abs(B.k - soll) > 0.01 : B.k < soll * 0.8)) {
    if (!B) { const c = document.createElement('canvas'); B = sp.tasche = { c, g: c.getContext('2d'), mp: 0, k: 0 }; }
    const w = Math.ceil(0.64 * soll) + 8, h = Math.ceil(0.54 * soll) + 8; bildMP -= B.mp; B.c.width = w; B.c.height = h; B.mp = (w * h) / 1e6; bildMP += B.mp;
    B.k = soll; B.ax = w / 2; B.ay = h - 4 - Math.ceil(0.07 * soll); FIG.tasche(B.g, f.m, f.st.LI, B.ax, B.ay, soll);
  }
  const s = Math.abs(k / B.k - 1) < 1e-4 ? 1 : k / B.k;
  if (s === 1 && KAM_STEHT) ctx.drawImage(B.c, Math.round(x - B.ax), Math.round(y - B.ay)); else ctx.drawImage(B.c, x - B.ax * s, y - B.ay * s, B.c.width * s, B.c.height * s);
}
const taschenFrei = (sp) => { const B = sp && sp.tasche; if (B) { bildMP -= B.mp; B.c.width = B.c.height = 0; sp.tasche = null; } };
function taschenZelle(f, a) { return atlasZelle(a, 9000, (g, x, y, kk) => FIG.tasche(g, f.m, f.st.LI, x, y, kk)); }
const AUF_WINKEL = 18;
function aufZelle(f, a, i, wNr, probe) {
  return atlasZelle(a, wNr * 64 + i, (g, x, y, kk) => { const [p, r, li] = aufPose(f, i / (BILD.AUF - 1)); FIG.malen(g, f.m, p, x, y, kk, { dreh: (wNr / AUF_WINKEL) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: probe.L || f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r, l: li, leicht: true }); });
}
const aufWinkelNr = (f, dz) => ((Math.round(((Math.PI - f.blick + Math.atan2(f.x - cam.x, dz)) / TAU) * AUF_WINKEL) % AUF_WINKEL) + AUF_WINKEL) % AUF_WINKEL;
const DIREKT = QUERY.get('gang') !== 'atlas', direkt = (f) => DIREKT && !f.stempel;
const BEWEGTE = new Set(), W0 = 0.3, frac = (x) => x - Math.floor(x);
let BEW_TAKT = 0, BEW_I = 0, BEW_ZAHL = 0;
function bewFlaeche(f, k) {
  const sp = spVon(f), soll = Math.min(BILD.K_BEW[STUFE], ruheStufe(Math.max(k, S.f / Math.max(0.8, f.z - cam.z)))); let B = sp.bew;
  if (!B || B.k < soll * 0.8) { bewFrei(sp); const g = f.m.gr, pad = 5, cw = Math.ceil(1.8 * g * soll) + 2 * pad, ch = Math.ceil(2.1 * g * soll) + 2 * pad, c = document.createElement('canvas'); c.width = cw; c.height = ch;
    B = sp.bew = { c, g: c.getContext('2d'), k: soll, cw, ch, ax: cw / 2, ay: pad + Math.ceil(1.9 * g * soll), mp: (cw * ch) / 1e6, sig: '', zuletzt: lastT }; bildMP += B.mp; BEWEGTE.add(sp); }
  return B;
}
function bewFrei(sp) { const B = sp && sp.bew; if (B) { bildMP -= B.mp; B.c.width = B.c.height = 0; sp.bew = null; BEWEGTE.delete(sp); } }
const losPose = (f) => { const p = FIG.steh(0.4, 'haengt', f.tasche ? 'traegt' : 'haengt'); p.ei = 0; return p; };
function bewPose(f, zs) {
  const a = BILD.AUF_ANTEIL;
  if (zs.s <= 0) {
    if (zs.q <= a) { const [p, r, li] = aufPose(f, zs.q / a); return { p, r, li, lm: FIG.sanft((zs.q / a - 0.3) / 0.7) }; }
    return { p: FIG.zwischen(stehPose(f), losPose(f), FIG.sanft((zs.q - a) / (1 - a))), r: f.tasche ? 'tasche' : null, li: null, lm: 1 };
  }
  const g = FIG.sanft(f.gang ?? 1), wN = f.wN ?? 1, p = FIG.zwischen(losPose(f), FIG.geh(f.schritt, f.tasche ? 'r' : '', wN, f.wR ?? 1, f.wL ?? 1, wN), g);
  p.kd += Math.max(-0.35, Math.min(0.35, winkelZu(f.hd, zs.ziel) * 0.7)) * g;
  const T = f.st.tuer; if (T && !f.l.drin) { const d = f.w.sT - zs.s, gr = FIG.sanft((1.2 - d) / 0.45) * (1 - FIG.sanft((0.5 - d) / 0.45)); if (gr > 0.01) { p.al = p.al.map((v, i) => lerp(v, FIG.ARME.greift[i], 0.85 * gr)); if (gr > 0.5) p.hl = 'greift'; } }
  return { p, r: f.tasche ? 'tasche' : null, li: null, lm: 1 };
}
function bewSetzen(f, zs, q, k, auge, dz, LI) {
  const B = bewFlaeche(f, k), dreh = Math.PI - f.hd + Math.atan2(zs.x - cam.x, dz), Hl = bewPose(f, zs), sg = `${FIG.sig(Hl.p)}|${Math.round(dreh * 300)}|${Hl.r}|${Hl.li}|${Math.round(Hl.lm * 20)}`;
  if (B.takt !== BEW_TAKT) { B.takt = BEW_TAKT; B.nr = BEW_I++; }
  const JE = BILD.BEW_JE_BILD[STUFE], n = Math.max(1, BEW_ZAHL), dran = n <= JE || (((B.nr - BEW_TAKT * JE) % n) + n) % n < JE;
  if (B.sig !== sg && dran) {
    let L = LI.L; if (Hl.lm < 1) { const P0 = platzLicht(f, LI), mx = lerp(P0[0], L[0], Hl.lm), my = lerp(P0[1], L[1], Hl.lm), n = Math.hypot(mx, my) || 1; L = [mx / n, my / n]; }
    B.g.clearRect(0, 0, B.cw, B.ch); FIG.malen(B.g, f.m, Hl.p, B.ax, B.ay, B.k, { dreh, auge, dz, licht: LI, L, saum: { farbe: LI.saum, a: 0.32 }, r: Hl.r, l: Hl.li, leicht: true });
    B.sig = sg; B.dreh = dreh; B.p = Hl.p; MESS.bewegt = (MESS.bewegt || 0) + 1;
  } else if (B.sig !== sg) NOCHMAL = true;
  B.zuletzt = lastT; if (!B.sig) return B;
  const s = k / B.k; ctx.drawImage(B.c, 0, 0, B.cw, B.ch, q[0] - B.ax * s, q[1] - B.ay * s, B.cw * s, B.ch * s);
  return B;
}
const FUSS_TAU = 900, FUSSHALT = QUERY.get('fusshalt') !== '0';
function fussHalt(f, zs, dt, l) {
  const pk = FIG.punkte(f.m, bewPose(f, zs).p, 0, 0, 1, { dreh: 0 }), re = frac(f.schritt / TAU + 0.3) < frac(f.schritt / TAU + 0.8), a = re ? pk.ar : pk.al, g = f.m.gr, c = Math.cos(f.hd), s = Math.sin(f.hd);
  const wx = zs.x + g * (a[0] * c + a[2] * s), wz = zs.z + g * (-a[0] * s + a[2] * c), nah = smooth(Math.min(1, (l.drin ? zs.s : f.w.len - zs.s) / 1.5));
  if (f.fuss !== re || !f.halt2) { f.fuss = re; f.halt2 = [wx + (f.ox || 0), wz + (f.oz || 0)]; }
  const ab = 1 - Math.exp(-dt / FUSS_TAU), ox = (f.halt2[0] - wx) * (1 - ab), oz = (f.halt2[1] - wz) * (1 - ab), m = Math.hypot(ox, oz), k = Math.min(1, 0.4 / Math.max(m, 1e-6)) * (nah < 1 ? Math.pow(nah, dt / 300) : 1);
  f.ox = ox * k; f.oz = oz * k; f.halt2 = [wx + f.ox, wz + f.oz];
}
function gangSchritt(f, zs, dt, l) {
  const ds = Math.abs(zs.s - f.sAlt), v = dt > 0 ? ds / dt : 0; f.sAlt = zs.s;
  if (l.fest != null) { f.hd = zs.ziel; f.gang = 1; f.wR = f.wL = f.wN = 1; f.schritt = (zs.s / SCHRITT) * Math.PI; return; }
  { const d = winkelZu(f.hd, zs.ziel), m = dt * DREH_TEMPO; f.hd += Math.max(-m, Math.min(m, d * (1 - Math.exp(-dt / 130)))); }
  f.wN = Math.min(lerp(W0, 1, smooth(v / GEH_TEMPO)), l.drin ? lerp(W0, 1, smooth(zs.s / 1.0)) : 1);
  const uR = frac(f.schritt / TAU + 0.3), uL = frac(f.schritt / TAU + 0.8); f.schritt += (ds / (SCHRITT * (uR < uL ? f.wR : f.wL))) * Math.PI;
  if (frac(f.schritt / TAU + 0.3) < uR) f.wR = f.wN; if (frac(f.schritt / TAU + 0.8) < uL) f.wL = f.wN;
  f.gang = Math.min((f.gang ?? 0) + dt / 240, 1, l.drin ? zs.s / 0.08 : 1);
  if (FUSSHALT) fussHalt(f, zs, dt, l);
}
function maleMensch(f, zs0, t, LI, BR, h) {
  const zs = zs0.s > 0 && (f.ox || f.oz) && direkt(f) ? { ...zs0, x: zs0.x + f.ox, z: zs0.z + f.oz } : zs0;
  const x = zs.x, z = zs.z, dz = z - cam.z; if (dz < 0.7) return;
  const st = f.st, T = st.tuer, hinten = T && z > T.z, yb = f.boden * (1 - smooth(f.stufe ? (zs.s - f.stufe[0]) / f.stufe[1] : zs.s / 0.5)), q = P(x, yb, z), k = S.f / dz;
  if (q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return;
  if (hinten) { const o = rectZ(T.x0, T.x1, 0, TUER_H, T.z); if (!o) return; ctx.save(); ctx.beginPath(); ctx.rect(o[0], o[1], o[2], o[3]); ctx.clip(); }
  const auge = cam.y - oy - yb;
  { const fl = Math.max(0.1, Math.min(0.5, auge / dz)); if (st.key === 'dach') schattenSetzen(q[0], q[1], k, fl); else { schattenSetzen(q[0], q[1], k * 0.86, fl); schattenSetzen(q[0] - LI.L[0] * 0.2 * k, q[1] + 0.02 * k * fl, k * 1.12, fl * 0.9, 0.55); } }
  if (zs.q <= 0) {
    let R = spVon(f).ruhe; if (!R || R.k === undefined) { if (RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, 0, false, (reduce || STATISCH) && BILD.K_FEIN[STUFE] > 0 && !!AKT.F && AKT.F.key === st.key); R = f.sp.ruhe; } else { NOCHMAL = true; R = null; } }
    if (R) {
      const s = Math.abs(k / R.k - 1) < 1e-4 ? 1 : k / R.k, eins = s === 1 && R.genau && KAM_STEHT, X = eins ? Math.round(q[0] - R.ax) : q[0] - R.ax * s, Y = eins ? Math.round(q[1] - R.ay) : q[1] - R.ay * s;
      if (h > 0.02 && R.rand) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * Math.min(1, h * 1.4); ctx.drawImage(R.c, R.w, 0, R.w, R.h, X, Y, R.w * s, R.h * s); ctx.globalAlpha = a0; }
      ctx.drawImage(R.c, 0, 0, R.w, R.h, X, Y, R.w * s, R.h * s);
      if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'ruhe', platzHaltung(f, R.t), R.dreh, R.k, k, [X + R.ax * s, Y + R.ay * s], auge, dz);
    }
  } else if (direkt(f)) {
    const B = bewSetzen(f, zs, q, k, auge, dz, LI), tau = f.l.u * f.l.dauer - f.verz, R = f.sp.ruhe, tL = st.tLeb;
    if (f.l.drin && zs.s <= 0 && tau < 900 && tL && R && R.k !== undefined && R.sig !== lebSig(f, tL) && RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, tL, false, !!R.genau); }
    if (tau < BILD.BLENDE_MS && zs.s <= 0 && R && R.k !== undefined) { const s = Math.abs(k / R.k - 1) < 1e-4 ? 1 : k / R.k, eins = s === 1 && R.genau && KAM_STEHT, X = eins ? Math.round(q[0] - R.ax) : q[0] - R.ax * s, Y = eins ? Math.round(q[1] - R.ay) : q[1] - R.ay * s, a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (B.sig ? 1 - FIG.sanft(tau / BILD.BLENDE_MS) : 1); ctx.drawImage(R.c, 0, 0, R.w, R.h, X, Y, R.w * s, R.h * s); ctx.globalAlpha = a0; }
    if (MESS.spur && MESS.spur.f === f && B.sig) spurMerk(f, zs, zs.s <= 0 ? (zs.q <= BILD.AUF_ANTEIL ? 'auf' : 'steh') : f.dreht && !(f.gang > 0.02) ? 'steh' : 'geh', B.p, B.dreh, B.k, k, q, auge, dz);
  } else if (zs.s <= 0) {
    const a = BILD.AUF_ANTEIL, probe = { auge, dz };
    if (zs.q <= a) { const A = aufAtlas(f, k); probe.L = platzLicht(f, LI); atlasSetzen(A, aufNr(f, A, Math.round((zs.q / a) * (BILD.AUF - 1)), dz, probe), q[0], q[1], k); if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'auf', aufPose(f, Math.round((zs.q / a) * (BILD.AUF - 1)) / (BILD.AUF - 1))[0], (aufWinkelNr(f, dz) / AUF_WINKEL) * TAU, A.k, k, q, auge, dz); }
    else { const A = wegAtlas(f, k); atlasSetzen(A, stehNr(f, A, richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)), probe), q[0], q[1], k); if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'steh', stehPose(f), (richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)) / BILD.DIR) * TAU, A.k, k, q, auge, dz); }
  } else {
    const A = wegAtlas(f, k), dir = richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)), probe = { auge, dz };
    atlasSetzen(A, f.dreht ? stehNr(f, A, dir, probe) : gehNr(f, A, phaseNr(f.schritt), dir, probe), q[0], q[1], k);
    if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, f.dreht ? 'steh' : 'geh', f.dreht ? stehPose(f) : gehPose(f, (phaseNr(f.schritt) / BILD.PH) * TAU), (dir / BILD.DIR) * TAU, A.k, k, q, auge, dz);
  }
  if (hinten) ctx.restore();
}
const VOR = [];
let warmFuer = '', SCROLL_T = 0, SCROLL_ALT = -1, HIMMEL_LEBT = false;
const WARM_NACH = 400;
const LEER = [];
let LEER_AN = false;
const TROCKEN = { an: false, liste: [], takt: 0, danach: null, MS: 26 };
function aufwaermen(now) {
  const T = TROCKEN; if (!T.liste.length) return;
  if (T.takt++ < 1) return;
  const t0 = performance.now(); T.an = true;
  try { while (T.liste.length && performance.now() - t0 < T.MS) drawScene(ansicht(T.liste.shift()), now); } catch (e) { console.error(e); T.liste.length = 0; } finally { T.an = false; }
  KAM_SIG = ''; sceneDirty = true;
  if (!T.liste.length && T.danach) { const f = T.danach; T.danach = null; f(); }
}
function vorarbeit() {
  LEER.push(() => { for (const R of [RUHEBILD, RUHE2]) { flaeche(R); R.g.clearRect(0, 0, 2, 2); } });
  if (ORT.lage < 1.6) for (const db of [0]) for (let ph = 0; ph < WALK.PH; ph++) WALKERS.forEach(([, v, , , prop, wer], i) => LEER.push(() => { if (ORT.lage > 2.4) return; WALK_FREI = 1; walkerZelle(i, menschVon(wer, AKZ.lav), prop, ph, db, v > 0 ? Math.PI / 2 : -Math.PI / 2); }));
}
function leerSchritt() { if (!LEER.length) return false; const c0 = ctx, o0 = oy; try { LEER.shift()(); } catch (e) { console.error(e); LEER.length = 0; } ctx = c0; oy = o0; return true; }
function wegProben(f, hin, base) {
  const out = [], seen = new Set(), w = f.w, ds = 0.03, n = Math.ceil(w.len / ds);
  let hd = hin ? w.hd0 : ortAufWeg(w, w.len)[2] + Math.PI;
  for (let i = 0; i <= n; i++) {
    const s = hin ? Math.min(w.len, i * ds) : Math.max(0, w.len - i * ds), o = ortAufWeg(w, s), dz = o[1] - cam.z; if (dz < 0.7) continue;
    hd = dreheZu(hd, o[2] + (hin ? 0 : Math.PI), (ds / GEH_TEMPO) * DREH_TEMPO);
    const yb = f.boden * (1 - smooth(f.stufe ? (s - f.stufe[0]) / f.stufe[1] : s / 0.5)), ph = phaseNr(((i * ds) / SCHRITT) * Math.PI), wkl = Math.PI - hd + Math.atan2(o[0] - cam.x, dz);
    const dir = richtungNr(wkl), key = ph * 64 + dir; if (seen.has(key)) continue; seen.add(key);
    out.push([ph, dir, { auge: cam.y - base - yb, dz }]);
  }
  return out;
}
let VOR_G = null;
function umrissVor(f) {
  if (f.z - cam.z < 0.8) return; if (!VOR_G) { const c = document.createElement('canvas'); c.width = c.height = 8; VOR_G = c.getContext('2d'); }
  const c0 = ctx; ctx = VOR_G; try { umrissMalen(f, 0.5, f.st.BR); } finally { ctx = c0; }
}
let warmFertig = '';
function vorwaermen(st, zuerst = null) {
  if (STILL || STATISCH || !st) return;
  const lage = `${st.key}|${BILD_GEN}|${Math.round(cam.x * 12)}|${Math.round(cam.z * 12)}|${Math.round(S.f / 8)}`, schluessel = `${lage}|${zuerst ? zuerst.id : ''}|${st.L.map((l) => (l.drin ? 1 : 0)).join('')}`;
  if (warmFuer === schluessel || warmFertig === lage) return; warmFuer = schluessel; VOR.length = 0; MESS.warmFertig = '';
  const base = st.key === 'dach' ? 0 : (INS.F ? INS.F.base : 0), reihe = zuerst ? [zuerst] : [], zwei = [];
  {
    const alle = []; for (const l of reihe) for (const f of l.leute) { if (f.z - cam.z < 0.8) continue; let zMin = f.z; for (let i = 0; i < f.w.pts.length; i += 4) zMin = Math.min(zMin, f.w.pts[i][1]); f.kWeg = S.f / Math.max(0.8, zMin - cam.z); alle.push(f); }
    alle.sort((a, b) => b.kWeg - a.kWeg); for (const f of alle) { if (direkt(f)) continue; wegAtlas(f, f.kWeg, true); aufAtlas(f, S.f / (f.z - cam.z), true); }
  }
  for (const l of reihe) for (const f of l.leute) {
    const dz = f.z - cam.z; if (dz < 0.8) continue;
    const k = S.f / dz, probe = { auge: cam.y - base - f.boden, dz }, wNr = aufWinkelNr(f, dz), LP = platzLicht(f, st.LI);
    if (!f.stempel) VOR.push(() => umrissVor(f));
    if (direkt(f)) { VOR.push(() => bewFlaeche(f, k)); continue; }
    for (let i = 0; i < BILD.AUF; i++) VOR.push(() => aufZelle(f, aufAtlas(f, k), i, wNr, { ...probe, L: LP }));
    if (f.tasche) VOR.push(() => taschenZelle(f, wegAtlas(f, k)));
    for (const hin of [l.drin, !l.drin]) {
      const liste = hin === l.drin ? VOR : zwei;
      liste.push(() => {
        const von = hin ? f.blick : f.w.hd0 + Math.PI, zu = hin ? f.w.hd0 : f.blick, d = winkelZu(von, zu), dirs = new Set(), neu = [];
        for (let j = 0; j <= 8; j++) dirs.add(richtungNr(Math.PI - (von + (d * j) / 8) + Math.atan2(f.x - cam.x, dz)));
        for (const dir of dirs) neu.push(() => stehZelle(f, wegAtlas(f, k), dir, probe));
        for (const [ph, dir, pr] of wegProben(f, hin, base)) neu.push(() => gehZelle(f, wegAtlas(f, k), ph, dir, pr));
        VOR.unshift(...neu);
      });
    }
    zwei.push(() => { const A = wegAtlas(f, k); for (let dir = 0; dir < BILD.DIR; dir++) stehZelle(f, A, dir, probe); });
  }
  VOR.push(() => { warmFertig = lage; MESS.warmFertig = lage; });
  MESS.warmOffen = VOR.length;
}
function warmSchritt(hoechstens = 99) {
  if (!VOR.length) return false;
  const st = AKT.F && RAUM[AKT.F.key]; if (!st || AKT.k < 1 || raumBewegt(st)) return false;
  if (lastT - SCROLL_T < WARM_NACH || (DAEMM_WARTET && !DST.fertig)) return false;
  if (bildMP > BILD.MP[STUFE]) { bilderSparen(); if (bildMP > BILD.MP[STUFE]) return false; }
  const t0 = performance.now(), ende = t0 + BILD.WARM_MS[STUFE], o0 = oy, c0 = ctx; oy = st.key === 'dach' ? 0 : AKT.F.base;
  const gez = () => (MESS.vorgezeichnet || 0) + (MESS.ruhebilder || 0) + (FIG.stempel.neu || 0), g0 = gez(), zellen = Math.min(hoechstens, HIMMEL_LEBT ? 1 : BILD.WARM_ZELLEN[STUFE]);
  try { while (VOR.length && performance.now() < ende && gez() - g0 < zellen) VOR.shift()(); } catch (e) { console.error(e); VOR.length = 0; }
  oy = o0; ctx = c0; MESS.warmOffen = VOR.length;
  return true;
}
function stelleMensch(m, p, x, y, z, hd, LI, extra) {
  const dz = z - cam.z; if (dz < 0.7) return null;
  const q = P(x, y, z), k = S.f / dz; if (k < 3 || q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return null;
  FIG.schatten(ctx, q[0], q[1], k, 0.44, Math.max(0.1, Math.min(0.5, (cam.y - oy - y) / dz)), 0.45);
  const kl = TON.kl; TON.kl = null;
  try { return FIG.malen(ctx, m, p, q[0], q[1], k, { dreh: Math.PI - hd + Math.atan2(x - cam.x, dz), auge: cam.y - oy - y, dz, licht: LI, L: LI.L, saum: { farbe: LI.saum, a: 0.3 }, ...extra }); } finally { TON.kl = kl; }
}
const EG_TAKT = taktGruppe(41, [{ saat: 2.2, paar: 9, hoert: true }, { saat: 4.6, paar: 9, redet: true, hoert: true }]), SCHAU_TAKT = taktGruppe(43, [{ saat: 6.4 }]);
function stelleRuhig(name, t, m, p, x, y, z, hd, LI, extra) {
  const dz = z - cam.z; if (dz < 0.7) return null;
  const q = P(x, y, z), k = S.f / dz; if (k < 3 || q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return null;
  FIG.schatten(ctx, q[0], q[1], k, 0.44, Math.max(0.1, Math.min(0.5, (cam.y - oy - y) / dz)), 0.45);
  const dreh = Math.round((Math.PI - hd + Math.atan2(x - cam.x, dz)) * 12) / 12, kb = bleibt() && BILD.K_FEIN[STUFE] ? Math.min(BILD.K_FEIN[STUFE], k) : ruheStufe(k * 1.8), auge = cam.y - oy - y;
  return stempelRuhig(name, `${dreh}|${t ? FIG.sig(p) : 0}`, q[0], q[1], k, (g, sx, sy, kk) => FIG.malen(g, m, p, sx, sy, kk, { dreh, auge, dz, licht: LI, L: LI.L, saum: { farbe: LI.saum, a: 0.3 }, ...extra }), kb);
}
const WALK = { PH: 8, W: 0.5, atl: [], gen: 0 };
let WALK_FREI = 0;
function walkerZelle(i, m, prop, ph, db, hd) {
  if (WALK.gen !== BILD_GEN) { for (const a of WALK.atl) if (a && !a.tot) atlasFrei(a); WALK.atl = []; WALK.gen = BILD_GEN; }
  let a = WALK.atl[i]; if (!a || a.tot) a = WALK.atl[i] = atlasNeu(Math.min(BILD.K_MAX[STUFE], 90), 0.55 * m.gr, 1.9 * m.gr, 0.2 * m.gr);
  const key = (db + 2) * 64 + ph, LI = LICHT.strasse;
  if (!a.map.has(key)) {
    if (WALK_FREI <= 0) { for (const d of [1, -1, 2, -2, 3, -3]) { const j = a.map.get((db + 2) * 64 + ((ph + d + WALK.PH) % WALK.PH)); if (j !== undefined) return [a, j]; } for (const d of [1, -1]) { const j = a.map.get((db + d + 2) * 64 + ph); if (j !== undefined) return [a, j]; } NOCHMAL = true; return null; }
    WALK_FREI--;
  }
  return [a, atlasZelle(a, key, (g, x, y, kk) => { const p = FIG.geh((ph / WALK.PH) * TAU, prop === 'tasche' ? 'r' : '', 1.1); if (prop === 'telefon') p.ar = FIG.ARME.telefon.slice(); FIG.malen(g, m, p, x, y, kk, { dreh: Math.PI - hd + db * WALK.W, auge: 1.7, dz: 14, licht: LI, L: LI.L, saum: { farbe: WARM, a: 0.22 }, r: prop === 'tasche' ? 'tasche' : prop === 'telefon' ? 'handy' : null, leicht: true }); })];
}
function walkerSetzen(i, m, prop, phase, x, z, hd) {
  const dz = z - cam.z; if (dz < 0.7) return;
  const q = P(x, 0, z), k = S.f / dz; if (k < 3 || q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return;
  FIG.schatten(ctx, q[0], q[1], k, 0.44, Math.max(0.1, Math.min(0.5, (cam.y - oy) / dz)), 0.45);
  const ph = ((Math.round((phase / TAU) * WALK.PH) % WALK.PH) + WALK.PH) % WALK.PH, db = 0;
  const z0 = walkerZelle(i, m, prop, ph, db, hd); if (z0) atlasSetzen(z0[0], z0[1], q[0], q[1], k);
}
function menschImBild(f, zs) {
  const R = zs.q <= 0 && f.sp && f.sp.ruhe, dz = zs.z - cam.z; if (!R || R.k === undefined || dz < 0.7) return undefined;
  const q = P(zs.x, f.boden, zs.z), k = S.f / dz, s = k / R.k, x = q[0] - R.ax * s, y = q[1] - R.ay * s, luft = 0.11 * k, sx = -0.2 * f.st.LI.L[0];
  return [[x + luft, y, x + R.w * s - luft, y + R.h * s], [q[0] + Math.min(-0.4, sx - 0.5) * k, q[1] - 0.2 * k, q[0] + Math.max(0.4, sx + 0.5) * k, q[1] + 0.22 * k]];
}
function menschenDinge(key, t, list) {
  const st = RAUM[key]; if (!st || !st.tuer) return;
  const BR = st.BR, LI = st.LI, amPlatz = []; let auf = 0;
  for (const l of st.L) {
    const h = l.hov, kDa = da(key, l.id), leer = smooth((l.u * l.dauer - 250) / 500);
    for (const f of l.leute) {
      const zs = wo(f), tau = l.u * l.dauer - f.verz, n0 = list.length; if ((zs.q <= 0 || zs.fort) && f.sp && f.sp.bew && lastT - f.sp.bew.zuletzt > 4000) bewFrei(f.sp);
      const hdS = Math.round(f.blick / (Math.PI / 2)) * (Math.PI / 2), sxS = f.x - 0.36 * Math.sin(hdS), szS = f.z - 0.36 * Math.cos(hdS), brS = f.sessel ? 0.5 : 0.32;
      const kS = [Math.min(f.x, sxS) - brS, Math.max(f.x, sxS) + brS, f.boden, f.boden + 1.04, Math.min(f.z, szS) - brS, Math.max(f.z, szS) + brS], kP = [f.x - 0.66, f.x + 0.66, 0, f.boden + 2.02, f.z - 0.6, f.z + 0.5];
      if (kDa > 0.02 || h > 0.02) list.push({ z: f.z + 0.6, licht: true, fn: () => bodenlicht(f.x, f.z, 1.0 + 0.2 * h, BR, (0.1 + 0.16 * h) * Math.max(kDa, h * 0.6)) });
      if (f.halt.sitz) stuhlDinge(list, f, 0.36 * FIG.weich(zs.q / 0.5) * (1 - FIG.weich((zs.s - 0.9) / 1.2)));
      for (let i = n0; i < list.length; i++) if (!list[i].licht) list[i].k = kS;
      if (f.tasche && tau < f.tA * BILD.AUF_ANTEIL * TASCHE_AB) { const hd = f.blick, bx = f.x + 0.4 * Math.cos(hd) - 0.12 * Math.sin(hd), bz = f.z - 0.4 * Math.sin(hd) - 0.12 * Math.cos(hd); list.push({ z: bz, k: [bx - 0.35, bx + 0.35, f.boden, f.boden + 0.6, bz - 0.3, bz + 0.3], fn: () => { const dz = bz - cam.z; if (dz < 0.7 || f.z - cam.z < 0.7 || TROCKEN.an) return; const q = P(bx, f.boden, bz); taschenSetzen(f, q[0], q[1], S.f / dz); } }); }
      if (leer > 0.02) list.push({ z: f.z + 0.002, k: kP, fn: () => umrissMalen(f, leer * (0.7 + 0.3 * h), BR) });
      if (!zs.fort) { if (zs.q <= 0) amPlatz.push(f); list.push({ z: zs.z, k: [zs.x - 0.66, zs.x + 0.66, 0, f.boden + 2.02, zs.z - 0.6, zs.z + 0.5], fn: () => { maleMensch(f, zs, t, LI, BR, h); return RUHT ? menschImBild(f, zs) : undefined; } }); auf = Math.max(auf, tuerBedarf(f, zs.s)); }
      list.push({ z: f.z - 0.001, licht: true, fn: () => merke(l, f.x, f.z, f.hoch, 0.42, f.n > 0, f.boden, f.schild) });
    }
  }
  st.tuer.auf = auf;
  ruhePflegen(st, amPlatz, !!AKT.F && AKT.F.key === key && AKT.k > 0.9);
}
function tuerDinge(key, farben) {
  const st = RAUM[key], T = st && st.tuer; if (!T) return;
  const C = { zarge: '#0b090a', blatt: ['#3b302c', '#2a2220'], griff: `rgba(${WARM},.85)`, ...farben };
  const offen = () => T.auf > 0.01;
  fest(T.z + 3, [T.x0 - 0.1, T.x1 + 0.1, 0, TUER_H + 0.1, T.z - 0.02, T.z], () => {
    const o = rectZ(T.x0 - 0.08, T.x1 + 0.08, 0, TUER_H + 0.08, T.z - 0.006), i = rectZ(T.x0, T.x1, 0, TUER_H, T.z - 0.005); if (!o || !i) return;
    ctx.fillStyle = C.zarge; ctx.fillRect(o[0], o[1], o[2], o[3]);
    if (FEIN) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(o[0], o[1], Math.max(1, o[2] * 0.012), o[3]); ctx.fillRect(o[0], o[1], o[2], Math.max(1, o[3] * 0.006)); }
    if (!BACKT && T.auf > 0.01) {
      ctx.fillStyle = sgr(0, i[1], 0, i[1] + i[3], [[0, '#f6e2c6'], [0.55, '#d9ae86'], [0.84, '#a67c62'], [0.86, '#5a4238'], [1, '#3a2a26']]); ctx.fillRect(i[0], i[1], i[2], i[3]);
      ctx.fillStyle = 'rgba(40,24,20,.35)'; ctx.fillRect(i[0], i[1], i[2] * 0.12, i[3]);
    }
  }, offen);
  fest(T.z - 0.03, [T.x0 - 0.05, T.x1 + 0.05, 0, TUER_H, T.z - 1.0, T.z], () => {
    const auf = BACKT ? 0 : T.auf, a = auf * 1.38, w = T.x1 - T.x0, xe = T.x1 - w * Math.cos(a), ze = T.z - 0.012 - w * Math.sin(a), z0 = T.z - 0.012;
    if (auf > 0.01) { ctx.globalCompositeOperation = 'lighter'; poly([[T.x0, 0.006, z0], [T.x1, 0.006, z0], [T.x1 + 0.7, 0.006, z0 - 2.6], [T.x0 - 0.7, 0.006, z0 - 2.6]], lg([0, 0, z0], [0, 0, z0 - 2.6], [[0, `rgba(${WARM},${0.2 * auf})`], [1, `rgba(${WARM},0)`]])); ctx.globalCompositeOperation = 'source-over'; }
    const pa = P(T.x1, TUER_H, z0), pb = P(xe, 0.01, ze);
    if (poly([[T.x1, 0.01, z0], [xe, 0.01, ze], [xe, TUER_H, ze], [T.x1, TUER_H, z0]], sgr(0, pa[1], 0, pb[1], [[0, C.blatt[0]], [1, C.blatt[1]]]))) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = lwAt(T.z, 0.02); ctx.stroke(); }
    const in_ = (u, y) => [lerp(T.x1, xe, u), y, lerp(z0, ze, u)];
    ctx.lineWidth = lwAt(T.z, 0.012); if (poly([in_(0.14, 0.2), in_(0.86, 0.2), in_(0.86, TUER_H - 0.2), in_(0.14, TUER_H - 0.2)], null)) { ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(); }
    seg(in_(0.9, 0.98), in_(0.9, 1.12), C.griff, lwAt(T.z, 0.03));
    if (FEIN) {
      linien([[in_(0.9, 1.05), in_(0.76, 1.05)]], C.griff, lwAt(T.z, 0.022)); flaechen([[in_(0.87, 0.9), in_(0.93, 0.9), in_(0.93, 1.2), in_(0.87, 1.2)]], 'rgba(0,0,0,.3)');
      linien([[in_(0.9, 0.98), in_(0.9, 1.12)], [in_(0.01, 0.3), in_(0.01, 0.46)], [in_(0.01, 1.62), in_(0.01, 1.78)]], C.griff, lwAt(T.z, 0.02));
      flaechen([[in_(0.02, 0.02), in_(0.98, 0.02), in_(0.98, 0.16), in_(0.02, 0.16)]], 'rgba(0,0,0,.2)');
      const m = []; for (let j = 0; j < 7; j++) { const u = 0.2 + j * 0.095 + 0.03 * hash(j, 31), y0 = 0.3 + 0.8 * hash(j, 32); m.push([in_(u, y0), in_(u, Math.min(TUER_H - 0.3, y0 + 0.4 + 0.7 * hash(j, 33)))]); } linien(m, 'rgba(0,0,0,.12)', 1);
    }
  }, offen);
}
const SCHICHTEN = new Map();
function schicht(name, schluessel, r, male) {
  const x = Math.max(0, Math.floor(r[0])), y = Math.max(0, Math.floor(r[1])), w = Math.min(S.w, Math.ceil(r[0] + r[2])) - x, h = Math.min(S.h, Math.ceil(r[1] + r[3])) - y; if (w < 1 || h < 1) return;
  let s = SCHICHTEN.get(name); if (!KAM_STEHT && !s) { male(); return; } if (!s) { const c = document.createElement('canvas'); s = { c, g: c.getContext('2d'), key: '' }; SCHICHTEN.set(name, s); }
  if (!KAM_STEHT) { male(); return; }
  if (s.key !== schluessel || s.x !== x || s.y !== y || s.c.width !== w || s.c.height !== h) {
    if (s.c.width !== w || s.c.height !== h) { s.c.width = w; s.c.height = h; } else s.g.clearRect(0, 0, w, h);
    const c0 = ctx; ctx = s.g; ctx.setTransform(1, 0, 0, 1, -x, -y);
    try { male(); } finally { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx = c0; }
    s.key = schluessel; s.x = x; s.y = y;
  }
  ctx.drawImage(s.c, x, y);
}
let DINGE = [];
let FEIN = false, BACKT = false, NACHZUG = false, RUHT = false;
const FEST_MS = 2.5, FEST_JE = 6;
const ding = (z, fn, k) => DINGE.push({ z, fn, k });
const lichtDing = (z, fn) => DINGE.push({ z, fn, licht: true });
const fest = (z, k, fn, lebt) => DINGE.push({ z, fn, k, fest: true, lebt });
function imBild(k) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) { const q = P(k[i & 1], k[2 + ((i >> 1) & 1)], Math.max(cam.z + NEAR, k[4 + (i >> 2)])); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
}
function vornMalen(key, t, ruht = false) {
  const list = DINGE.slice(); menschenDinge(key, t, list);
  if (KERN && KERN.im === key) list.push({ z: KERN.z, k: [KERN.x - 0.45, KERN.x + 0.45, KERN.y - oy - 0.45, KERN.y - oy + 0.45, KERN.z - 0.3, KERN.z + 0.3], fn: () => { const b = oy, kl = TON.kl; TON.kl = null; drawCore(KERN); KERN.fertig = true; oy = b; TON.kl = kl; } });
  list.sort((a, b) => b.z - a.z);
  tonAn('ding');
  if (!ruht) { for (const it of list) it.fn(t); tonAus(); return; }
  RUHT = true; const voll = [];
  try {
    for (const it of list) {
      if (it.fest && !(it.lebt && it.lebt())) {
        if (!voll.length || !it.k) continue;
        const r = imBild(it.k); let c = null;
        for (const v of voll) if (v[0] < r[2] && v[2] > r[0] && v[1] < r[3] && v[3] > r[1]) { const a = Math.max(v[0], r[0]), b = Math.max(v[1], r[1]), d = Math.min(v[2], r[2]), e = Math.min(v[3], r[3]); c = c ? [Math.min(c[0], a), Math.min(c[1], b), Math.max(c[2], d), Math.max(c[3], e)] : [a, b, d, e]; }
        if (!c) continue;
        c = [Math.floor(c[0]), Math.floor(c[1]), Math.ceil(c[2]), Math.ceil(c[3])];
        ctx.save(); ctx.beginPath(); ctx.rect(c[0], c[1], c[2] - c[0], c[3] - c[1]); ctx.clip(); FEIN = NACHZUG = true;
        try { it.fn(t); } finally { FEIN = NACHZUG = false; ctx.restore(); }
        voll.push(c); if (MESS.z) (MESS.z.akt.nach || (MESS.z.akt.nach = [])).push(it.z);
      } else {
        if (it.fest) FEIN = true;
        const r = it.fn(t); FEIN = false;
        if (r === false || it.licht) continue;
        if (Array.isArray(r)) { if (Array.isArray(r[0])) voll.push(...r); else voll.push(r); } else voll.push(it.k ? imBild(it.k) : [0, 0, S.w, S.h]);
      }
    }
  } finally { RUHT = FEIN = NACHZUG = false; tonAus(); }
}
let KERN = null;
const mischRgb = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
let WURF = { dx: 0, dz: 0.14, a: 0.1 };
function wurfSetzen() { const W = tagWerte(), e = W.sonne, tag = Math.min(1, W.innen); if (e > 0.02 && tag > 0.1) { const lang = Math.min(0.85, 0.5 / Math.max(0.12, e)); WURF = { dx: 0.42 * lang, dz: lang, a: (0.05 + 0.11 * tag) * (1 - 0.5 * Math.max(0, lang - 0.6) / 0.25) }; } else WURF = { dx: 0, dz: 0.14, a: 0.1 }; }
function linien(segs, style, lw = 1) {
  const zc = cam.z + NEAR; ctx.beginPath();
  for (const [a, b] of segs) {
    let A = a, B = b; const da = a[2] - zc, db = b[2] - zc; if (da < 0 && db < 0) continue;
    if (da < 0) { const t = da / (da - db); A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, zc]; }
    if (db < 0) { const t = db / (db - da); B = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, zc]; }
    const p = P(A[0], A[1], A[2]), q = P(B[0], B[1], B[2]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
}
function flaechen(polys, fill) {
  ctx.beginPath();
  for (const pts of polys) { const c = clipNear(pts); if (c.length < 3) continue; for (let i = 0; i < c.length; i++) { const q = P(c[i][0], c[i][1], c[i][2]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.closePath(); }
  ctx.fillStyle = fill; ctx.fill();
}
function strang(pts, style, m = 0.022, y = 0.004) {
  const n = pts.length; let zs = 0, nn = 0, an = false; ctx.beginPath();
  for (let i = 0; i < n - 1; i++) { const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(n - 1, i + 2)];
    for (let j = i ? 1 : 0; j <= 8; j++) { const u = j / 8, f = (q0, q1, q2, q3) => 0.5 * (2 * q1 + (q2 - q0) * u + (2 * q0 - 5 * q1 + 4 * q2 - q3) * u * u + (3 * q1 - q0 - 3 * q2 + q3) * u * u * u), x = f(a[0], b[0], c[0], d[0]), z = f(a[1], b[1], c[1], d[1]);
      zs += z; nn++; if (z - cam.z < NEAR) { an = false; continue; } const q = P(x, y, z); if (an) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); an = true; } } }
  ctx.strokeStyle = style; ctx.lineWidth = lwAt(zs / Math.max(1, nn), m); ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter';
}
function wurf(x0, x1, z0, z1, h = 0.8, kern = 0.3) {
  if (NACHZUG) return; const y = 0.007, dx = WURF.dx * h, dz = WURF.dz * h;
  if (dz > 0.04) {
    poly([[x1, y, z1], [x1, y, z0], [x1 - dx, y, z0 - dz], [x0 - dx, y, z0 - dz], [x0 - dx, y, z1 - dz], [x0, y, z1]], `rgba(0,0,0,${WURF.a})`);
    if (FEIN) { const m = 0.05 + 0.1 * dz; poly([[x1 + m * 0.5, y, z1], [x1 + m * 0.5, y, z0 - m], [x1 - dx + m, y, z0 - dz - m * 1.6], [x0 - dx - m * 1.6, y, z0 - dz - m * 1.6], [x0 - dx - m * 1.6, y, z1 - dz], [x0 - m, y, z1]], `rgba(0,0,0,${WURF.a * 0.45})`); }
  }
  if (kern > 0) poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], `rgba(0,0,0,${kern})`);
}
function fleck(x, z, rx, rz, a = 0.26, h = 0) {
  if (NACHZUG) return; const y = 0.007, n = 14, e = (cx, cz, sx, sz) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * sx, y, cz + Math.sin((i / n) * 6.2832) * sz]);
  const dx = WURF.dx * h * 0.5, dz = WURF.dz * h * 0.5;
  if (dz > 0.03) poly(e(x - dx, z - dz, rx + dx * 0.8, rz + dz * 0.8), `rgba(0,0,0,${WURF.a})`);
  poly(e(x, z, rx, rz), `rgba(0,0,0,${a})`);
}
function dielen(x0, x1, z0, z1, br = 0.6, saat = 7, mitLang = true, kraft = 1) {
  const lang = [], quer = [], hell = [], dunkel = [], maser = [], y = 0.002;
  for (let i = 0, x = x0; x < x1 - 0.01; x += br, i++) {
    if (i) lang.push([[x, y, z0], [x, y, z1]]);
    let za = z0;
    for (let z = z0 + 0.4 + hash(i, saat) * 2.2, j = 0; za < z1; z += 2.1 + hash(i, 3) * 0.9, j++) {
      const zb = Math.min(z, z1); if (zb < z1) quer.push([[x, y, zb], [x + br, y, zb]]);
      if (FEIN) { const h = hash(i * 7 + j, saat + 2), fl = [[x, y, za], [x + br, y, za], [x + br, y, zb], [x, y, zb]]; if (h < 0.3) hell.push(fl); else if (h > 0.72) dunkel.push(fl);
        for (let m = 0; m < 2; m++) { const u = 0.2 + 0.6 * hash(i * 5 + j, m + 11), a = za + (zb - za) * (0.05 + 0.4 * hash(i + j * 3, m + 5)), b = Math.min(zb, a + 0.5 + 0.9 * hash(i * 3 + j, m + 9)); maser.push([[x + br * u, y, a], [x + br * u, y, b]]); } }
      za = zb;
    }
  }
  if (FEIN) { if (hell.length) flaechen(hell, `rgba(255,255,255,${0.045 * kraft})`); if (dunkel.length) flaechen(dunkel, `rgba(0,0,0,${0.06 * kraft})`); linien(maser, `rgba(0,0,0,${0.1 * kraft})`, 1); }
  if (mitLang) linien(lang, `rgba(0,0,0,${Math.min(0.4, 0.22 * kraft)})`, 1); linien(quer, `rgba(0,0,0,${Math.min(0.36, 0.2 * kraft)})`, 1);
}
function glanzBoden(felder, z1, yo, rgb, a) {
  if (NACHZUG) return; const t = Math.min(0.8, yo / (yo + cam.y - oy)), fx = cam.x, fz = Math.max(cam.z, 0.2), y = 0.003, ze = z1 + (fz - z1) * t;
  ctx.globalCompositeOperation = 'lighter';
  for (const [xa, xb] of felder) poly([[xa, y, z1], [xb, y, z1], [xb + (fx - xb) * t, y, ze], [xa + (fx - xa) * t, y, ze]], lg([0, 0, z1], [0, 0, ze], [[0, `rgba(${rgb},${a})`], [0.45, `rgba(${rgb},${a * 0.42})`], [1, `rgba(${rgb},0)`]]));
  ctx.globalCompositeOperation = 'source-over';
}
function schirm(x0, x1, y0, y1, z, rand = 0.025) { const o = fillZ(x0, x1, y0, y1, z, '#07070c'); if (!o) return null; const b = Math.max(1, (rand * S.f) / (z - cam.z)); return [o[0] + b, o[1] + b, o[2] - 2 * b, o[3] - 2 * b]; }
const roh = (fn) => { const kl = TON.kl; TON.kl = null; try { fn(); } finally { TON.kl = kl; } };
const ui = (r) => (u, v, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(r[0] + u * r[2], r[1] + v * r[3], w * r[2], h * r[3]); };
function spiegelung(r) { if (!FEIN || NACHZUG) return; roh(() => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(r[0] + r[2] * 0.52, r[1]); ctx.lineTo(r[0] + r[2] * 0.78, r[1]); ctx.lineTo(r[0] + r[2] * 0.44, r[1] + r[3]); ctx.lineTo(r[0] + r[2] * 0.18, r[1] + r[3]); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }); }
function flachAn(x, y, z) {
  const dz = z - cam.z; if (dz < 0.6) return null; const q = P(x, y, z), k = S.f / dz, X = (dx) => q[0] + dx * k, Y = (dy) => q[1] - dy * k;
  return { k, X, Y,
    R: (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(X(dx), Y(dy + h), w * k, h * k); },
    E: (dx, dy, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(X(dx), Y(dy), Math.max(0.5, rx * k), Math.max(0.5, ry * k), 0, 0, 7); ctx.fill(); },
    V: (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); ctx.fill(); },
    S: (pts, col, m) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, m * k); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); } };
}
const ausDing = (z, a, k, fn) => ding(z, () => { const v = 1 - a(); if (v < 0.02) return false; roh(() => fn(v)); }, k);
function tischN(x0, x1, z0, z1, h, col, vorn = M.front, seite = M.side) {
  wurf(x0 + 0.04, x1 - 0.04, z0 + 0.04, z1 - 0.04, h, 0.1);
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.14, z0 + 0.08], [x0 + 0.08, z1 - 0.14], [x1 - 0.14, z1 - 0.14]]) box(x, x + 0.06, 0, h, z, z + 0.06, '#111', '#101016', '#16151e');
  box(x0, x1, h - 0.05, h, z0, z1, col || M.top, vorn, seite);
  if (FEIN) { fillZ(x0, x1, h - 0.012, h, z0 - 0.001, 'rgba(255,255,255,.3)'); linien([[[x0 + 0.095, 0.02, z0 + 0.079], [x0 + 0.095, h - 0.06, z0 + 0.079]], [[x1 - 0.125, 0.02, z0 + 0.079], [x1 - 0.125, h - 0.06, z0 + 0.079]]], 'rgba(255,255,255,.14)', 1); }
}
function stativ(x, z, h, fuesse, m = 0.04, col = '#07070c') {
  const top = [x, h, z], F = fuesse.map(([dx, dz]) => [x + dx, 0, z + dz]);
  linien(F.map((f) => [top, f]), col, lwAt(z, m));
  if (!FEIN) return;
  const M = F.map((f) => [lerp(x, f[0], 0.62), h * 0.38, lerp(z, f[2], 0.62)]);
  linien([[M[0], M[1]], [M[1], M[2]], [M[2], M[0]], ...F.map((f) => [f, [f[0], 0.03, f[2]]])], col, lwAt(z, m * 0.55));
  linien(F.map((f) => [top, [lerp(x, f[0], 0.5), h * 0.5, lerp(z, f[2], 0.5)]]), col, lwAt(z, m * 1.5));
}
function kameraSet(x, z, h) {
  stativ(x, z, h - 0.1, [[-0.42, -0.25], [0.42, -0.2], [0.05, 0.44]], 0.045);
  const B = flachAn(x, h, z); if (!B) return; const { R, E, V, S: L } = B, C = { geh: '#1b1a25', tief: '#0b0b10', hell: '#3a3849', mitte: '#262532' };
  R(-0.03, -0.12, 0.06, 0.12, '#07070c'); R(-0.08, -0.01, 0.16, 0.07, C.tief); R(-0.1, 0.06, 0.34, 0.03, C.mitte);
  L([[0.06, 0.02], [0.4, -0.16], [0.52, -0.2]], '#07070c', 0.028);
  R(-0.12, 0.09, 0.44, 0.25, C.geh); R(-0.36, 0.13, 0.24, 0.17, C.tief);
  V([[-0.36, 0.115], [-0.36, 0.315], [-0.47, 0.35], [-0.47, 0.08]], '#2f2d3c');
  R(0.08, 0.43, 0.22, 0.15, C.mitte); roh(() => { R(0.095, 0.445, 0.19, 0.12, '#c4683f'); });
  if (!FEIN) return;
  roh(() => { R(0.185, 0.445, 0.035, 0.085, '#efe6d6'); E(0.202, 0.545, 0.016, 0.016, '#d9a784'); E(0.14, 0.48, 0.02, 0.02, '#8B5CF6'); });
  R(0.17, 0.34, 0.03, 0.09, C.tief);
  R(-0.12, 0.325, 0.44, 0.015, C.hell); R(0.32, 0.11, 0.09, 0.21, C.mitte); R(0.335, 0.27, 0.06, 0.012, '#5a586e');
  R(-0.02, 0.34, 0.025, 0.05, C.tief); R(0.1, 0.34, 0.025, 0.05, C.tief); R(-0.06, 0.385, 0.22, 0.03, C.mitte);
  R(-0.32, 0.13, 0.022, 0.17, C.hell); R(-0.24, 0.13, 0.03, 0.17, '#2b2a38'); R(-0.165, 0.13, 0.012, 0.17, AKZ.studios);
  V([[-0.47, 0.35], [-0.36, 0.315], [-0.34, 0.33], [-0.5, 0.385]], C.tief);
  R(-0.36, 0.43, 0.3, 0.03, C.tief); E(-0.36, 0.445, 0.085, 0.036, '#4a4858'); R(-0.1, 0.415, 0.02, 0.03, C.tief);
  R(-0.07, 0.13, 0.16, 0.012, '#2f2d3c'); R(-0.07, 0.16, 0.16, 0.012, '#2f2d3c'); R(0.15, 0.13, 0.1, 0.09, '#14131b');
  L([[0.52, -0.2], [0.44, -0.17]], '#3a3849', 0.045);
}
function pflanze(x, z, gruen = false, gr = 1) {
  const dz = z - cam.z; if (dz < 0.45) return;
  if (FEIN) fleck(x, z, 0.3, 0.26, 0.24, 0.9 * gr); else schatten(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  box(x - 0.2, x + 0.2, 0, 0.46, z - 0.2, z + 0.2, gruen ? '#6a4a3c' : '#241c1a', gruen ? '#3a2822' : '#120e0d', gruen ? '#46302a' : '#18110f');
  if (FEIN) { fillZ(x - 0.22, x + 0.22, 0.42, 0.47, z - 0.202, gruen ? '#5a3e33' : '#1c1513'); fillZ(x - 0.2, x - 0.15, 0, 0.42, z - 0.203, 'rgba(255,255,255,.06)'); }
  const k = S.f / dz, o = P(x, 0.46, z), ad = [];
  [[-0.02, 0.86, -0.42], [0.05, 1.0, 0.1], [0.1, 0.84, 0.5], [-0.08, 0.62, -0.85], [0.12, 0.64, 0.9], [0, 0.76, -0.14], [0.02, 0.5, 0.3]].forEach(([dx, len0, ang], i) => {
    const len = len0 * gr;
    ctx.save(); ctx.translate(o[0] + dx * k, o[1]); ctx.rotate(ang);
    ctx.fillStyle = gruen ? (i % 2 ? '#2f4a35' : '#3d5c40') : '#0a100d'; ctx.beginPath(); ctx.ellipse(0, (-len * k) / 2, len * k * 0.15, (len * k) / 2, 0, 0, 7); ctx.fill();
    if (gruen) { ctx.fillStyle = 'rgba(214,226,170,.22)'; ctx.beginPath(); ctx.ellipse(-len * k * 0.04, (-len * k) / 2, len * k * 0.06, (len * k) * 0.42, 0, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,150,96,.3)'; ctx.lineWidth = Math.max(1, 0.012 * k); ctx.beginPath(); ctx.ellipse(0, (-len * k) / 2, len * k * 0.15, (len * k) / 2, 0, -1.4, 0.6); ctx.stroke(); }
    if (FEIN) { ctx.strokeStyle = gruen ? 'rgba(20,40,26,.5)' : 'rgba(255,150,96,.14)'; ctx.lineWidth = Math.max(1, 0.008 * k); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * k * 0.94); ctx.stroke(); }
    ctx.restore();
  });
}
function strahler(x, z, y1, an) {
  seg([x, y1 - 0.06, z], [x, y1 - 0.2, z], '#050506', lwAt(z, 0.03));
  const b = rectZ(x - 0.075, x + 0.075, y1 - 0.42, y1 - 0.2, z); if (!b) return;
  if (FEIN) { ctx.fillStyle = sgr(b[0], 0, b[0] + b[2], 0, [[0, '#2a2526'], [0.5, '#151213'], [1, '#0a0809']]); ctx.fillRect(b[0], b[1], b[2], b[3]); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(b[0] + b[2] * 0.14, b[1], Math.max(1, b[2] * 0.1), b[3]); }
  else { ctx.fillStyle = '#151213'; ctx.fillRect(b[0], b[1], b[2], b[3]); }
  ctx.fillStyle = mischRgb([70, 60, 56], [255, 240, 214], an); ctx.beginPath(); ctx.ellipse(b[0] + b[2] / 2, b[1] + b[3], b[2] * 0.46, Math.max(1, b[3] * 0.16), 0, 0, 7); ctx.fill();
  if (an > 0.1 && FEIN) glow(x, y1 - 0.44, z, 0.3, [[0, `rgba(${WARM},${0.4 * an})`], [1, `rgba(${WARM},0)`]]);
}
const WEB_RAHMEN = [[[0.2, 0.27, 0.6, 0.22], [0.37, 0.66, 0.26, 0.17]], [[0.04, 0.26, 0.46, 0.2], [0.54, 0.22, 0.42, 0.48], [0.04, 0.75, 0.3, 0.2]], [[0.06, 0.3, 0.52, 0.3], [0.62, 0.16, 0.32, 0.6], [0.06, 0.72, 0.5, 0.12]]];
const webFlaeche = (m) => [m[0] + m[2] * 0.015, m[1] + m[3] * 0.025, m[2] * 0.97, m[3] * 0.95];
function webBild(m, l, a, t) {
  const v = l ? l.v : 0, [x, y, w, h] = webFlaeche(m), blendet = !!(l && l.vAlt != null && l.vZeit && t && t - l.vZeit < 380);
  if (v === 0 && !blendet && a > 0.99) return false;
  const neu = TEX['web' + v] || TEX.web, alt = blendet ? TEX['web' + l.vAlt] : null;
  ctx.fillStyle = '#05050a'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 0.3 + 0.7 * a;
  if (alt) { ctx.drawImage(alt, x, y, w, h); ctx.globalAlpha *= smooth((t - l.vZeit) / 380); }
  if (neu) ctx.drawImage(neu, x, y, w, h);
  ctx.globalAlpha = 1;
}
function webRahmen(m, l, g, t) {
  const F0 = WEB_RAHMEN[l ? l.v : 0] || [], [x, y, w, h] = webFlaeche(m); if (!F0.length) return null;
  const [u0, v0, uw, vh] = F0[Math.floor((t || 0) / GESTE_TAKT) % F0.length], rx = x + u0 * w, ry = y + v0 * h, rw = uw * w, rh = vh * h, s = Math.max(2, w * 0.012);
  ctx.strokeStyle = AKZ.studios; ctx.lineWidth = Math.max(1, w * 0.004); ctx.setLineDash([w * 0.014, w * 0.01]); ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.beginPath(); for (const [cx2, cy2] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) ctx.rect(cx2 - s / 2, cy2 - s / 2, s, s);
  const px = rx + rw + w * (0.03 - 0.05 * g), py = ry + rh + h * (0.05 - 0.07 * g);
  ctx.moveTo(px, py); ctx.lineTo(px + w * 0.028, py + w * 0.012); ctx.lineTo(px + w * 0.012, py + w * 0.028); ctx.closePath(); ctx.fill();
  return [rx - s, ry - s, rx + rw + w * 0.07, ry + rh + h * 0.07 + w * 0.03];
}
const STUDIO = { wand: 2.45, web: [0.75, 8.5], ring: [1.02, 5.65, 1.5], kamera: [-0.78, 6.55, 1.38], leuchte: [-2.85, 7.9], wagen: [-0.04, 7.22], koffer: [-1.25, 5.9], pflanze: [2.62, 8.4], regal: [[2.5, 1], [4.3, 2]], beistell: [2.12, 5.5], rolle: [-3.15, -1.35, 8.45], angel: [-1.26, 8.38],
  felder: [[-5.95, -4.05], [-3.95, -2.05], [-1.95, -0.05], [0.05, 1.95], [2.05, 2.39]] };
function studio(F, t, y1, z1) {
  const BR = MARKE.studios.rgb, dark = '#07070c', st = RAUM.studios, lW = st && st.nach.website, Q = STUDIO, TW = tagWerte(), tag = Math.min(1, TW.innen);
  const aW = () => da('studios', 'website'), aV = () => da('studios', 'video'), aS = () => da('studios', 'social');
  const aus = (z, a, k, fn) => ding(z, () => { const v = 1 - a(); if (v < 0.02) return false; roh(() => fn(v)); }, k);
  const [bx0, bx1, bz] = Q.rolle, [wx, wz] = Q.web, [sx, sz] = Q.leuchte, [cx, cz] = Q.wagen, [kx, kz] = Q.koffer, [rx, rz, ry] = Q.ring, [ax, az] = Q.angel;
  { const s = []; for (let z = 1.5; z < z1; z += 1.5) s.push([[-6, y1 - 0.004, z], [6, y1 - 0.004, z], [6, y1 - 0.004, z + 0.16], [-6, y1 - 0.004, z + 0.16]]); flaechen(s, 'rgba(0,0,0,.34)'); }
  for (let z = 1.5; z < z1; z += 1.5) fillZ(-6, 6, y1 - 0.14, y1, z, '#0c0909');
  flaechen([-1.5, 1.7].map((x) => [[x - 0.035, y1 - 0.06, 0.6], [x + 0.035, y1 - 0.06, 0.6], [x + 0.035, y1 - 0.06, z1 - 0.4], [x - 0.035, y1 - 0.06, z1 - 0.4]]), '#050506');
  if (FEIN) { const k = []; for (let z = 1.5; z < z1; z += 1.5) k.push([[-6, y1 - 0.14, z], [6, y1 - 0.14, z]]); linien(k, 'rgba(255,224,200,.12)', 1); }
  if (tag > 0.05) roh(() => poly([[-6, 0.001, 0.4], [6, 0.001, 0.4], [6, 0.001, z1], [-6, 0.001, z1]], `rgba(146,92,50,${0.3 * tag})`));
  dielen(-6, 6, 0.4, z1, 0.3, 7, true, 1.7);
  if (tag > 0.05) roh(() => (FEIN ? glanzBoden(Q.felder.map(([a, b]) => [a + 0.22, b - 0.22]), z1, 2.98, '240,246,255', 0.22 * tag) : glanzBoden([[-6, Q.wand]], z1, 2.98, '240,246,255', 0.13 * tag)));
  glanzBoden([[-6, Q.wand]], z1, 2.2, '255,170,130', 0.16);
  ctx.globalCompositeOperation = 'lighter';
  poly([[wx - 1.0, 0.003, 8.3], [wx + 1.0, 0.003, 8.3], [wx + 1.25, 0.003, 5.6], [wx - 1.25, 0.003, 5.6]], lg([0, 0, 8.3], [0, 0, 5.6], [[0, 'rgba(255,224,200,.13)'], [1, 'rgba(255,224,200,0)']]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN) { bodenlicht(-1.9, 7.2, 1.7, WARM, 0.16); bodenlicht(wx, 7.35, 1.5, WARM, 0.12); bodenlicht(1.35, 5.45, 1.5, WARM, 0.1); bodenlicht(0.2, 3.6, 2.2, WARM, 0.07); }
  strang([[sx - 0.22, sz + 0.08], [-3.3, 7.0], [-2.5, 6.45], [-1.4, 6.5], [-0.6, 7.0], [cx, cz]], '#0a0808'); strang([[Q.kamera[0], Q.kamera[1]], [-0.5, 6.95], [-0.15, 7.05], [cx, cz]], '#0a0808'); strang([[rx, rz], [1.6, 6.3], [2.2, 7.6], [2.44, 8.9]], '#0a0808');
  { const tep = (r, dx = 0, dz = 0) => Array.from({ length: 30 }, (_, i) => [1.35 + dx + Math.cos((i / 30) * 6.2832) * 1.15 * r, 0.004, 5.45 + dz + Math.sin((i / 30) * 6.2832) * 0.85 * r]);
    if (FEIN) poly(tep(1.02, -0.035, -0.045), 'rgba(0,0,0,.2)');
    poly(tep(1), '#6a3220');
    if (FEIN) { poly(tep(0.86), '#743a26'); if (poly(tep(0.86), null)) { ctx.strokeStyle = 'rgba(255,214,180,.22)'; ctx.lineWidth = lwAt(5.45, 0.018); ctx.stroke(); } if (poly(tep(0.5), null)) { ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = lwAt(5.45, 0.012); ctx.stroke(); } bodenlicht(1.35, 5.45, 1.4, BR, 0.14); } }
  if (FEIN) { const T = (x, z, w, d, dr = 0) => { const c = Math.cos(dr), s = Math.sin(dr), p = (a, b) => [x + a * c - b * s, 0.0075, z + a * s + b * c]; return [p(-w, -d), p(w, -d), p(w, d), p(-w, d)]; };
    flaechen([T(bx0 + 0.02, 6.8, 0.15, 0.035, 0.6), T(bx1 - 0.02, 6.8, 0.15, 0.035, -0.6), T(-1.85, 7.5, 0.17, 0.028), T(-1.85, 7.5, 0.028, 0.17), ...[[-0.42, -0.25], [0.42, -0.2], [0.05, 0.44]].map(([dx, dz]) => T(Q.kamera[0] + dx, Q.kamera[1] + dz - 0.09, 0.07, 0.022))], '#e4ddd0'); }
  for (const [x0, felder] of Q.regal) { const B = 0.6, x1 = x0 + felder * B, zf = z1 - 0.3, H = 2.9, bo = [0.08, 0.62, 1.16, 1.7, 2.24, 2.9];
    fillZ(x0, x1, 0, H, z1 - 0.004, '#181213');
    { const v = []; for (let i = 0; i <= felder; i++) { const x = x0 + i * B; v.push([[x - 0.02, 0, zf], [x + 0.02, 0, zf], [x + 0.02, H, zf], [x - 0.02, H, zf]]); const xs = cam.x < x ? x - 0.02 : x + 0.02; v.push([[xs, 0, zf], [xs, 0, z1], [xs, H, z1], [xs, H, zf]]); }
      for (const y of bo) for (let i = 0; i < felder; i++) v.push([[x0 + i * B + 0.02, y - 0.035, zf], [x0 + (i + 1) * B - 0.02, y - 0.035, zf], [x0 + (i + 1) * B - 0.02, y, zf], [x0 + i * B + 0.02, y, zf]]);
      flaechen(v, '#4a3830'); }
    if (!FEIN) continue;
    { const o = [], sch = []; for (const y of bo.slice(0, 3)) o.push([[x0, y, zf], [x1, y, zf], [x1, y, z1], [x0, y, z1]]); flaechen(o, '#8a6c5c'); flaechen(bo.slice(3).map((y) => [[x0, y - 0.035, zf], [x1, y - 0.035, zf], [x1, y - 0.035, z1], [x0, y - 0.035, z1]]), '#2c2220');
      { const w = []; for (let i = 1; i <= felder; i++) { const x = x0 + i * B - 0.02; if (cam.x < x) w.push([[x, 0, zf], [x, 0, z1], [x, H, z1], [x, H, zf]]); } if (w.length) flaechen(w, 'rgba(0,0,0,.3)'); }
      for (const y of bo.slice(1)) sch.push([[x0, y - 0.035, z1 - 0.003], [x1, y - 0.035, z1 - 0.003], [x1, y - 0.15, z1 - 0.003], [x0, y - 0.15, z1 - 0.003]]); flaechen(sch, 'rgba(0,0,0,.34)');
      linien(bo.map((y) => [[x0, y, zf - 0.001], [x1, y, zf - 0.001]]), 'rgba(255,226,200,.26)', 1); }
    for (let i = 0; i < felder; i++) { const A = flachAn(x0 + i * B + 0.04, 0, zf + 0.05); if (!A) continue; const w = i % 2, f = (n) => bo[(n + w * 2) % 5];
      { const b = f(4); [[0.1, 0.085, '#b85c36'], [0.27, 0.085, '#cfc6b8'], [0.185, 0.228, '#4a4658']].forEach(([dx, dy, c]) => { A.E(dx, b + dy, 0.082, 0.082, c); A.E(dx, b + dy, 0.03, 0.03, '#120e10'); A.E(dx - 0.03, b + dy + 0.035, 0.02, 0.012, 'rgba(255,255,255,.2)'); });
        A.R(0.38, b, 0.13, 0.05, '#17151b'); A.R(0.385, b + 0.05, 0.12, 0.05, '#d9d2c4'); A.R(0.38, b + 0.1, 0.13, 0.05, `rgb(${BR})`); }
      { const b = f(3); [[0.2, 0.12, 0.21, '#e9e4f2'], [0.335, 0.1, 0.15, `rgb(${BR})`], [0.44, 0.08, 0.12, '#e9e4f2']].forEach(([dx, br, h, ring]) => {
          A.R(dx, b, br, h, '#17151c'); A.R(dx - 0.006, b + h * 0.18, br + 0.012, h * 0.26, '#2c2a36'); A.R(dx, b + h * 0.7, br, 0.014, ring); A.E(dx + br / 2, b + h, br / 2, 0.016, '#3f4c66'); A.R(dx + 0.014, b + 0.012, 0.012, h - 0.03, 'rgba(255,255,255,.2)'); });
        A.R(0.025, b, 0.115, 0.03, '#2c2a36'); [0, 1, 2].forEach((n) => { A.R(0.03 + n * 0.037, b + 0.03, 0.03, 0.1, '#3a3849'); A.R(0.03 + n * 0.037, b + 0.118, 0.03, 0.012, '#8a88a0'); });
        roh(() => [0, 1, 2].forEach((n) => A.E(0.045 + n * 0.037, b + 0.015, 0.006, 0.006, n === 2 ? '#ffb24a' : '#62e08c'))); }
      { const b = f(2); A.R(0.03, b, 0.17, 0.17, '#d9a23f'); A.R(0.03, b + 0.15, 0.17, 0.02, 'rgba(255,255,255,.22)'); A.E(0.3, b + 0.1, 0.075, 0.1, '#e9dfcf'); A.R(0.27, b + 0.19, 0.06, 0.05, '#e9dfcf');
        A.R(0.4, b, 0.12, 0.035, '#3f6a6a'); A.R(0.41, b + 0.035, 0.1, 0.03, '#f3e6c4'); A.R(0.4, b + 0.065, 0.11, 0.035, '#7a4a3a'); }
      { const b = f(1); A.R(0.02, b, 0.3, 0.3, '#2b2a38'); A.R(0.02, b + 0.19, 0.3, 0.012, '#6a6880'); A.R(0.13, b + 0.3, 0.08, 0.02, '#17151b'); A.R(0.36, b, 0.15, 0.2, '#8a6648'); A.R(0.36, b + 0.13, 0.15, 0.01, 'rgba(0,0,0,.25)'); }
      { const b = f(0); A.R(0.03, b, 0.48, 0.36, '#3a3436'); A.R(0.03, b + 0.3, 0.48, 0.012, 'rgba(255,255,255,.12)'); A.R(0.2, b + 0.14, 0.14, 0.05, '#17141a'); } }
  }
  lichtDing(8.96, () => { const w = 1 - aW(), v = 1 - aV(), s = 1 - aS(), y = 0.008;
    if (w > 0.02) poly([[wx - 1.25, y, 8.6], [wx + 1.25, y, 8.6], [wx + 1.4, y, 6.6], [wx - 1.4, y, 6.6]], `rgba(0,0,0,${0.16 * w})`);
    if (v > 0.02) poly([[bx0 - 0.2, y, 8.4], [0.3, y, 8.4], [0.5, y, 5.6], [bx0 - 0.4, y, 5.6]], `rgba(0,0,0,${0.16 * v})`);
    if (s > 0.02) poly([[0.2, y, 6.3], [2.5, y, 6.3], [2.6, y, 4.6], [0.1, y, 4.6]], `rgba(0,0,0,${0.16 * s})`); });
  const papier = [[[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 2.86, bz], [bx0, 2.86, bz]], [[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 0.18, bz - 0.26], [bx0, 0.18, bz - 0.26]], [[bx0, 0.18, bz - 0.26], [bx1, 0.18, bz - 0.26], [bx1, 0.006, bz - 0.8], [bx0, 0.006, bz - 0.8]], [[bx0, 0.006, bz - 0.8], [bx1, 0.006, bz - 0.8], [bx1 + 0.12, 0.006, 6.75], [bx0 - 0.12, 0.006, 6.75]]];
  fest(8.5, [bx0 - 0.95, bx1 + 0.4, 0, 3.05, 6.7, bz + 0.5], () => {
    const st2 = []; for (const x of [bx0 - 0.14, bx1 + 0.14]) st2.push([[x, 0, bz + 0.1], [x, 3.0, bz + 0.1]], [[x - 0.3, 0, bz + 0.1], [x + 0.3, 0, bz + 0.1]], [[x, 0.5, bz + 0.1], [x - 0.24, 0, bz + 0.1]], [[x, 0.5, bz + 0.1], [x + 0.24, 0, bz + 0.1]]);
    linien(st2, dark, lwAt(bz, 0.045));
    if (FEIN && !NACHZUG) poly([[bx1, 0.007, bz - 0.1], [bx1 + 0.12, 0.007, 6.75], [bx1 - 0.25, 0.007, 6.6], [bx0 - 0.45, 0.007, 6.6], [bx0 - 0.45, 0.007, bz - 0.1]], 'rgba(0,0,0,.13)');
    poly(papier[0], lg([0, 0.5, bz], [0, 2.86, bz], [[0, 'rgb(214,118,82)'], [1, 'rgb(150,74,52)']]));
    poly(papier[1], 'rgb(218,124,87)'); poly(papier[2], 'rgb(225,134,96)');
    poly(papier[3], lg([0, 0, bz - 0.8], [0, 0, 6.75], [[0, 'rgb(228,138,100)'], [1, 'rgb(168,92,66)']]));
    fillZ(bx0 - 0.2, bx1 + 0.2, 2.82, 2.98, bz + 0.05, '#3a3238');
    linien([bx0 - 0.5, bx0 - 0.72].map((x) => [[x, 0, bz + 0.3], [x + 0.08, 2.3, bz + 0.42]]), '#1a1416', lwAt(bz, 0.1));
    if (!FEIN) return;
    linien([bx0 - 0.5, bx0 - 0.72].map((x) => [[x - 0.012, 0.02, bz + 0.3], [x + 0.068, 2.28, bz + 0.42]]), 'rgba(214,150,120,.4)', lwAt(bz, 0.03));
    fillZ(bx0 - 0.2, bx1 + 0.2, 2.93, 2.96, bz + 0.049, 'rgba(255,255,255,.14)'); fillZ(bx0, bx1, 2.82, 2.86, bz + 0.049, 'rgb(170,90,64)');
    for (const x of [bx0 - 0.2, bx1 + 0.13]) fillZ(x, x + 0.07, 2.79, 3.01, bz + 0.048, '#15131a');
    linien([[[bx1 + 0.16, 2.9, bz + 0.05], [bx1 + 0.16, 1.5, bz + 0.05]], [[bx1 + 0.19, 2.9, bz + 0.05], [bx1 + 0.19, 1.62, bz + 0.05]]], 'rgba(214,208,220,.5)', 1);
    ctx.globalCompositeOperation = 'lighter'; roh(() => { poly([[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 0.3, bz - 0.14], [bx0, 0.3, bz - 0.14]], 'rgba(255,236,214,.1)'); }); ctx.globalCompositeOperation = 'source-over';
    linien([[[bx1, 0.5, bz], [bx1, 2.86, bz]], [[bx1, 0.5, bz], [bx1, 0.18, bz - 0.26]], [[bx1, 0.18, bz - 0.26], [bx1, 0.006, bz - 0.8]], [[bx1, 0.006, bz - 0.8], [bx1 + 0.12, 0.006, 6.75]], [[bx1 + 0.12, 0.006, 6.75], [bx0 - 0.12, 0.006, 6.75]]], 'rgba(255,214,190,.5)', 1);
    linien([[[bx0, 0.5, bz], [bx0, 2.86, bz]], [[bx0, 0.5, bz], [bx0, 0.18, bz - 0.26]], [[bx0, 0.18, bz - 0.26], [bx0, 0.006, bz - 0.8]], [[bx0, 0.006, bz - 0.8], [bx0 - 0.12, 0.006, 6.75]]], 'rgba(60,24,16,.35)', 1);
    linien([[[bx0 + 0.5, 0.9, bz - 0.001], [bx0 + 0.55, 2.7, bz - 0.001]], [[bx1 - 0.6, 0.7, bz - 0.001], [bx1 - 0.56, 2.5, bz - 0.001]]], 'rgba(120,50,30,.14)', lwAt(bz, 0.05));
  });
  aus(8.49, aV, [bx0 - 0.15, bx1 + 0.15, 0, 2.9, 6.7, bz], (v) => { flaechen(papier, `rgba(24,18,22,${0.42 * v})`); });
  fest(az, [ax - 0.95, ax + 0.5, 0, 2.7, 7.75, az + 0.3], () => {
    stativ(ax, az, 0.6, [[-0.36, 0.1], [0.36, 0.12], [0, -0.4]], 0.035);
    const top = [ax, 2.36, az], spitze = [ax - 0.74, 2.56, az - 0.42], ende = [ax + 0.34, 2.27, az + 0.2];
    linien([[[ax, 0.5, az], top]], dark, lwAt(az, 0.04)); linien([[ende, spitze]], '#15131a', lwAt(az, 0.03));
    const m0 = [spitze[0] - 0.01, spitze[1] - 0.05, spitze[2]], m1 = [spitze[0] + 0.07, spitze[1] - 0.36, spitze[2] + 0.02];
    ctx.lineCap = 'round'; seg(m0, m1, '#4a4858', lwAt(az, 0.085)); ctx.lineCap = 'butt';
    if (!FEIN) return;
    fleck(ax, az, 0.36, 0.26, 0.14);
    ctx.lineCap = 'round'; seg([m0[0] - 0.012, m0[1] - 0.02, m0[2]], [m1[0] - 0.012, m1[1] + 0.03, m1[2]], 'rgba(255,255,255,.16)', lwAt(az, 0.02)); ctx.lineCap = 'butt';
    linien([[spitze, m0], [[ax, 1.3, az], [ax, 1.36, az]], [[ax, 2.3, az], top]], '#3a3849', lwAt(az, 0.06));
    box(ende[0] - 0.09, ende[0] + 0.09, ende[1] - 0.3, ende[1] - 0.06, ende[2] - 0.05, ende[2] + 0.05, '#3a3436', '#211c20', '#17141a');
    linien([[spitze, [ax - 0.2, 2.44, az - 0.1]], [[ax - 0.2, 2.44, az - 0.1], [ax + 0.02, 2.2, az]], [[ax + 0.02, 2.2, az], [ax + 0.03, 0.55, az]]], '#0a0808', lwAt(az, 0.014));
  });
  tuerDinge('studios', { zarge: '#0a0809', blatt: ['#4a3a34', '#33272a'] });
  const schirmW = () => rectZ(wx - 1.08, wx + 1.08, 1.0, 2.38, wz);
  fest(8.64, [wx - 1.4, wx + 1.32, 0, 2.44, 7.8, 8.66], () => {
    wurf(wx - 1.22, wx + 1.22, 7.85, 8.62, 0.8, 0.12);
    for (const x of [wx - 1.15, wx + 1.05]) box(x, x + 0.1, 0, 0.74, 7.95, 8.5, '#111', '#101016', '#16151e');
    if (FEIN) {
      box(wx + 0.42, wx + 0.9, 0.05, 0.6, 8.0, 8.5, '#4a4858', '#22212c', '#2b2a38');
      linien([[[wx + 0.42, 0.24, 7.999], [wx + 0.9, 0.24, 7.999]], [[wx + 0.42, 0.42, 7.999], [wx + 0.9, 0.42, 7.999]]], 'rgba(0,0,0,.5)', 1);
      flaechen([0.15, 0.33, 0.51].map((y) => [[wx + 0.58, y, 7.998], [wx + 0.74, y, 7.998], [wx + 0.74, y + 0.02, 7.998], [wx + 0.58, y + 0.02, 7.998]]), '#8a88a0');
      box(wx - 0.92, wx - 0.66, 0, 0.34, 8.15, 8.41, '#2b2a38', '#15141c', '#1b1a25');
      fillZ(wx - 1.05, wx + 1.05, 0.62, 0.7, 8.45, '#16151e');
    }
    box(wx - 1.22, wx + 1.22, 0.74, 0.8, 7.85, 8.62, '#8a6c5c', '#2c2220', '#362a27');
    if (FEIN) {
      const m = []; for (let i = 0; i < 9; i++) { const z = 7.9 + i * 0.08, a = wx - 1.2 + hash(i, 21) * 0.5; m.push([[a, 0.8005, z], [a + 0.7 + hash(i, 22) * 1.1, 0.8005, z]]); } linien(m, 'rgba(50,24,14,.2)', 1);
      fillZ(wx - 1.22, wx + 1.22, 0.785, 0.8, 7.849, 'rgba(255,226,200,.3)'); fillZ(wx - 1.22, wx + 1.22, 0.74, 0.748, 7.849, 'rgba(0,0,0,.3)');
    }
    fillZ(wx - 0.09, wx + 0.09, 0.8, 1.06, wz, '#0a0a10'); fillZ(wx - 0.32, wx + 0.32, 0.8, 0.83, wz, '#0a0a10');
    const m = fillZ(wx - 1.08, wx + 1.08, 1.0, 2.38, wz, '#05050a');
    if (m) { const [x, y, w, h] = webFlaeche(m), tx = TEX.web0 || TEX.web; if (tx) ctx.drawImage(tx, x, y, w, h);
      if (FEIN) { spiegelung([x, y, w, h]); roh(() => { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(m[0], m[1], m[2], Math.max(1, m[3] * 0.006)); const n = m[2] * 0.035; [['#FF8A4C', 0.07], ['#f3e6c4', 0.115], ['#A78BFA', 0.86]].forEach(([c, u]) => { ctx.fillStyle = c; ctx.fillRect(m[0] + m[2] * u, m[1] + m[3] - n * 0.35, n, n); }); }); } }
    const lx = wx - 1.02, lz = 8.3;
    linien([[[lx, 0.8, lz], [lx - 0.06, 1.12, lz]], [[lx - 0.06, 1.12, lz], [lx + 0.16, 1.3, lz - 0.08]]], '#15131a', lwAt(lz, 0.022));
    poly([[lx + 0.1, 1.31, lz - 0.08], [lx + 0.3, 1.27, lz - 0.14], [lx + 0.3, 1.19, lz - 0.14], [lx + 0.12, 1.25, lz - 0.08]], '#3a3849');
    box(wx - 0.22, wx + 0.22, 0.8, 0.82, 7.93, 8.1, '#3a3849', '#16151e', '#1b1a25');
    box(wx - 0.74, wx - 0.64, 0.8, 0.92, 8.0, 8.1, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    poly([[wx + 0.56, 0.802, 8.2], [wx + 0.92, 0.802, 8.2], [wx + 0.92, 1.06, 8.34], [wx + 0.56, 1.06, 8.34]], '#15131a');
    if (!FEIN) return;
    fillZ(lx - 0.08, lx + 0.08, 0.8, 0.82, lz, '#15131a'); roh(() => { ctx.globalCompositeOperation = 'lighter'; poly([[lx + 0.12, 1.2, lz - 0.1], [lx + 0.3, 1.2, lz - 0.14], [lx + 0.62, 0.803, lz - 0.2], [lx - 0.1, 0.803, lz - 0.14]], 'rgba(255,224,170,.1)'); ctx.globalCompositeOperation = 'source-over'; });
    box(wx + 0.3, wx + 0.4, 0.8, 0.825, 7.95, 8.1, '#d8d2e0', '#8a8496', '#9a94a8'); fillZ(wx - 0.5, wx - 0.3, 0.8, 0.812, 7.96, '#2b2a38');
    linien([[[wx - 0.71, 0.92, 8.05], [wx - 0.73, 1.06, 8.05]], [[wx - 0.68, 0.92, 8.05], [wx - 0.65, 1.04, 8.05]]], '#FF8A4C', lwAt(8.05, 0.012));
    roh(() => { const pal = ['#FF5A1F', '#f3e6c4', '#8B5CF6', '#1b1530', '#7DB7FF']; pal.forEach((c, i) => poly([[wx + 0.585 + i * 0.064, 0.84, 8.22], [wx + 0.64 + i * 0.064, 0.84, 8.22], [wx + 0.64 + i * 0.064, 1.03, 8.325], [wx + 0.585 + i * 0.064, 1.03, 8.325]], c)); });
    box(wx + 0.98, wx + 1.18, 0.8, 0.84, 8.0, 8.28, '#d9c9b4', '#8a7a68', '#9a8a78'); box(wx + 0.99, wx + 1.17, 0.84, 0.875, 8.02, 8.28, '#6a5a90', '#3a3058', '#463a6a'); box(wx + 1.0, wx + 1.16, 0.875, 0.905, 8.03, 8.27, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    { const B = flachAn(wx + 0.3, 0.8, 8.42); if (B) { B.R(-0.06, 0, 0.12, 0.1, '#6a4a3c'); B.E(-0.05, 0.2, 0.05, 0.11, '#2f4a35'); B.E(0.04, 0.22, 0.05, 0.13, '#3d5c40'); B.E(0, 0.26, 0.04, 0.12, '#35523a'); } }
  });
  ding(8.635, (tt) => { const m = schirmW(); if (!m || webBild(m, lW, aW(), tt) === false) return false; return [m[0], m[1], m[0] + m[2], m[1] + m[3]]; });
  ding(8.63, (tt) => { const m = schirmW(); if (!m || !lW || aW() < 0.9) return false; return webRahmen(m, lW, lW.u <= 0 ? geste(lW, tt) : 0, tt) || false; });
  fest(Q.pflanze[1], [Q.pflanze[0] - 0.6, Q.pflanze[0] + 0.6, 0, 1.7, Q.pflanze[1] - 0.4, Q.pflanze[1] + 0.3], () => pflanze(Q.pflanze[0], Q.pflanze[1], true, 1.12));
  const lw0 = [sx - 0.17, 1.35, sz - 0.47], lw1 = [sx + 0.17, 1.35, sz + 0.47], lw2 = [sx + 0.17, 2.6, sz + 0.47], lw3 = [sx - 0.17, 2.6, sz - 0.47], lwK = [sx - 0.47, 2.0, sz + 0.17], px = sx - 0.22, pz = sz + 0.08;
  fest(sz + 0.1, [sx - 0.75, sx + 0.3, 0, 2.7, sz - 0.55, sz + 0.55], () => {
    fleck(px, pz, 0.4, 0.3, 0.16, 1.2);
    linien([[[px, 0.4, pz], [px, 1.55, pz]], [[px, 1.55, pz], [sx - 0.4, 1.98, sz + 0.14]]], dark, lwAt(sz, 0.05));
    stativ(px, pz, 0.42, [[-0.38, 0.12], [0.36, 0.18], [0.02, -0.42]], 0.035);
    flaechen([[lw0, lw1, lwK], [lw2, lw3, lwK]], '#0e0e14'); flaechen([[lw1, lw2, lwK], [lw3, lw0, lwK]], '#15151d');
    const mi = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], auf = (u, v) => mi(mi(lw0, lw1, u), mi(lw3, lw2, u), v);
    if (!FEIN) { poly([lw0, lw1, lw2, lw3], 'rgb(242,226,206)'); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(sz, 0.05); ctx.stroke(); return; }
    poly([lw0, lw1, lw2, lw3], '#0c0b10'); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(sz, 0.05); ctx.stroke();
    { const fc = P(sx, 2.02, sz), fr = (0.8 * S.f) / Math.max(NEAR, sz - cam.z), fg = ctx.createRadialGradient(fc[0], fc[1], 0, fc[0], fc[1], fr); fg.addColorStop(0, 'rgb(253,242,224)'); fg.addColorStop(0.42, 'rgb(240,216,188)'); fg.addColorStop(1, 'rgb(170,134,114)');
      roh(() => poly([auf(0.09, 0.045), auf(0.91, 0.045), auf(0.91, 0.955), auf(0.09, 0.955)], fg)); }
    { const g = []; for (let i = 1; i < 5; i++) g.push([auf(0.09 + (0.82 * i) / 5, 0.045), auf(0.09 + (0.82 * i) / 5, 0.955)]); for (let j = 1; j < 9; j++) g.push([auf(0.09, 0.045 + (0.91 * j) / 9), auf(0.91, 0.045 + (0.91 * j) / 9)]);
      linien(g, 'rgba(34,24,20,.42)', lwAt(sz, 0.014)); }
    linien([[lw1, lw2]], 'rgba(255,238,216,.55)', 1); linien([[auf(0.09, 0.045), auf(0.09, 0.955)]], 'rgba(0,0,0,.3)', lwAt(sz, 0.02));
    glow(sx + 0.1, 2.0, sz, 0.8, [[0, 'rgba(255,238,214,.15)'], [1, 'rgba(255,238,214,0)']]);
    box(px - 0.13, px + 0.17, 0, 0.09, pz - 0.4, pz - 0.2, '#3a3436', '#17141a', '#211c20');
    linien([[[px, 1.0, pz], [px, 1.08, pz]], [[px, 1.5, pz], [px, 1.58, pz]]], '#3a3849', lwAt(sz, 0.075));
    linien([[lwK, [px + 0.04, 1.5, pz]], [[px + 0.04, 1.5, pz], [px + 0.04, 0.3, pz]], [[px + 0.04, 0.3, pz], [px, 0.01, pz]]], '#0a0808', lwAt(sz, 0.014));
    glow(sx + 0.45, 1.9, sz - 0.1, 1.5, [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},0)`]]);
  });
  aus(sz + 0.09, aV, [sx - 0.2, sx + 0.2, 1.3, 2.65, sz - 0.5, sz + 0.5], (v) => { poly([lw0, lw1, lw2, lw3], `rgba(96,88,92,${0.82 * v})`); });
  fest(STOOL.z + 0.01, [STOOL.x - 0.45, STOOL.x + 0.45, 0, STOOL.h + 0.02, STOOL.z - 0.5, STOOL.z + 0.4], () => hocker(STOOL.x, STOOL.h, STOOL.z));
  const monW = () => rectZ(cx - 0.35 + 0.02, cx + 0.35 - 0.02, 1.08, 1.48, cz), lapW = () => rectZ(cx - 0.19, cx + 0.19, 0.835, 1.03, cz + 0.13);
  fest(cz, [cx - 0.37, cx + 0.37, 0, 1.505, cz - 0.24, cz + 0.24], () => {
    fleck(cx, cz, 0.34, 0.26, 0.2, 0.5);
    linien([[[cx - 0.3, 0.05, cz - 0.2], [cx + 0.3, 0.05, cz + 0.2]], [[cx - 0.3, 0.05, cz + 0.2], [cx + 0.3, 0.05, cz - 0.2]]], dark, lwAt(cz, 0.05));
    linien([[[cx, 0.05, cz], [cx, 1.2, cz]]], '#141216', lwAt(cz, 0.05));
    box(cx - 0.27, cx + 0.27, 0.77, 0.8, cz - 0.2, cz + 0.18, '#5a586e', '#1c1b26', '#262532');
    box(cx - 0.2, cx + 0.2, 0.8, 0.818, cz - 0.16, cz + 0.12, '#4a4858', '#22212c', '#1b1a25');
    poly([[cx - 0.2, 0.818, cz + 0.11], [cx + 0.2, 0.818, cz + 0.11], [cx + 0.2, 1.04, cz + 0.16], [cx - 0.2, 1.04, cz + 0.16]], '#15131a');
    fillZ(cx - 0.35, cx + 0.35, 1.06, 1.5, cz, '#08080c');
    const r = monW(), l = lapW();
    roh(() => {
      if (r) { const U = ui(r); U(0, 0, 1, 1, '#12121a'); U(0.4, 0.05, 0.58, 0.5, '#c4683f');
        if (FEIN) { U(0.4, 0.4, 0.58, 0.15, '#b55c36'); U(0.71, 0.2, 0.09, 0.35, '#efe6d6'); ctx.fillStyle = '#d9a784'; ctx.beginPath(); ctx.arc(r[0] + r[2] * 0.755, r[1] + r[3] * 0.15, r[3] * 0.055, 0, 7); ctx.fill(); ctx.fillStyle = '#8B5CF6'; ctx.beginPath(); ctx.arc(r[0] + r[2] * 0.56, r[1] + r[3] * 0.36, r[3] * 0.075, 0, 7); ctx.fill();
          [['#c4683f', 0], ['#8a5fd0', 1], ['#e9dfcf', 2], ['#7a4630', 3], ['#3a3849', 4], ['#d98a5c', 5]].forEach(([c, i]) => U(0.025 + (i % 2) * 0.18, 0.05 + ((i / 2) | 0) * 0.17, 0.16, 0.14, c));
          U(0.02, 0.6, 0.96, 0.012, 'rgba(246,244,240,.3)'); for (const v of [0.66, 0.75, 0.85, 0.92]) U(0.02, v, 0.96, 0.07, 'rgba(246,244,240,.05)');
          ctx.fillStyle = '#e0763f'; ctx.beginPath(); for (const [a, b] of [[0.03, 0.2], [0.24, 0.14], [0.39, 0.25], [0.65, 0.12], [0.78, 0.19]]) ctx.rect(r[0] + a * r[2], r[1] + 0.75 * r[3], b * r[2] - 1, 0.07 * r[3]); ctx.fill();
          ctx.fillStyle = '#9b7cf2'; ctx.beginPath(); for (const [a, b] of [[0.24, 0.1], [0.5, 0.14], [0.8, 0.08]]) ctx.rect(r[0] + a * r[2], r[1] + 0.66 * r[3], b * r[2] - 1, 0.07 * r[3]); ctx.fill();
          ctx.fillStyle = '#3fae8a'; ctx.beginPath(); for (const [a, b] of [[0.03, 0.35], [0.39, 0.37], [0.78, 0.19]]) ctx.rect(r[0] + a * r[2], r[1] + 0.85 * r[3], b * r[2] - 1, 0.055 * r[3]); for (const [a, b] of [[0.1, 0.5], [0.65, 0.3]]) ctx.rect(r[0] + a * r[2], r[1] + 0.92 * r[3], b * r[2] - 1, 0.055 * r[3]); ctx.fill();
          spiegelung(r); }
        else { U(0.03, 0.75, 0.94, 0.07, '#e0763f'); U(0.03, 0.85, 0.94, 0.055, '#3fae8a'); } }
      if (l) { const U = ui(l); U(0, 0, 1, 1, '#161420'); if (FEIN) { U(0.05, 0.1, 0.4, 0.5, '#c4683f'); for (let i = 0; i < 4; i++) U(0.52, 0.1 + i * 0.13, 0.4 - (i % 2) * 0.12, 0.07, 'rgba(246,244,240,.4)'); U(0.05, 0.7, 0.9, 0.2, 'rgba(246,244,240,.1)'); U(0.05, 0.76, 0.5, 0.08, '#3fae8a'); } else U(0.05, 0.1, 0.4, 0.5, '#c4683f'); }
    });
    if (!FEIN) return;
    flaechen([[-0.3, -0.2], [0.3, 0.2], [-0.3, 0.2], [0.3, -0.2]].map(([dx, dz]) => { const x = cx + dx, z = cz + dz; return [[x - 0.035, 0, z], [x + 0.035, 0, z], [x + 0.035, 0.07, z], [x - 0.035, 0.07, z]]; }), '#2b2a38');
    fillZ(cx - 0.35, cx + 0.35, 1.495, 1.5, cz - 0.001, 'rgba(255,255,255,.16)');
    fillZ(cx - 0.27, cx + 0.27, 0.793, 0.8, cz - 0.201, 'rgba(255,255,255,.14)');
  });
  aus(cz - 0.005, aV, [cx - 0.36, cx + 0.36, 0.82, 1.5, cz - 0.02, cz + 0.2], (v) => { const r = monW(), l = lapW(); ctx.fillStyle = `rgba(8,8,12,${0.85 * v})`; if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); if (l) ctx.fillRect(l[0], l[1], l[2], l[3]); });
  ding(cz - 0.006, (tt) => {
    const r = monW(); if (!r || aV() < 0.6) return false; const u = 0.06 + 0.86 * (((tt || 0) % 14000) / 14000), b = Math.max(1, r[2] * 0.008), an = !tt || tt % 1500 < 900;
    roh(() => { ctx.fillStyle = '#fff'; ctx.fillRect(r[0] + u * r[2], r[1] + 0.6 * r[3], b, 0.38 * r[3]); if (an) { ctx.fillStyle = '#ff4a32'; ctx.fillRect(r[0] + 0.93 * r[2], r[1] + 0.075 * r[3], r[3] * 0.045, r[3] * 0.045); } });
    return [r[0] + u * r[2] - 1, r[1], r[0] + r[2], r[1] + r[3]];
  });
  fest(Q.kamera[1], [Q.kamera[0] - 0.7, Q.kamera[0] + 0.6, 0, Q.kamera[2] + 0.62, Q.kamera[1] - 0.3, Q.kamera[1] + 0.46], () => { if (FEIN) fleck(Q.kamera[0], Q.kamera[1] + 0.05, 0.4, 0.3, 0.14, 1.2); kameraSet(Q.kamera[0], Q.kamera[1], Q.kamera[2]); });
  ding(Q.kamera[1] - 0.004, (tt) => {
    if (aV() < 0.6 || (tt && tt % 1500 >= 900)) return false; const B = flachAn(Q.kamera[0], Q.kamera[2], Q.kamera[1]); if (!B) return false;
    roh(() => B.R(0.235, 0.225, 0.035, 0.035, '#ff4a32')); return [B.X(0.23), B.Y(0.27), B.X(0.28), B.Y(0.22)];
  });
  fest(kz + 0.18, [kx - 0.42, kx + 0.42, 0, 0.62, kz - 0.24, kz + 0.2], () => {
    wurf(kx - 0.36, kx + 0.36, kz - 0.18, kz + 0.18, 0.34, 0.3);
    box(kx - 0.36, kx + 0.36, 0, 0.34, kz - 0.18, kz + 0.18, '#3a3436', '#17141a', '#211c20');
    fillZ(kx - 0.36, kx + 0.36, 0.215, 0.245, kz - 0.181, `rgba(${BR},.8)`);
    box(kx - 0.32, kx + 0.02, 0.34, 0.5, kz - 0.13, kz + 0.11, '#4a4858', '#1b1a25', '#262532');
    const kl = [[kx + 0.08, 0.34, kz - 0.06], [kx + 0.34, 0.34, kz - 0.06], [kx + 0.34, 0.56, kz + 0.04], [kx + 0.08, 0.56, kz + 0.04]];
    poly(kl, '#101016');
    if (!FEIN) return;
    const f = kz - 0.182, e = 'rgba(206,200,214,.55)';
    linien([[[kx - 0.36, 0, f], [kx - 0.36, 0.34, f]], [[kx + 0.36, 0, f], [kx + 0.36, 0.34, f]], [[kx - 0.36, 0.34, f], [kx + 0.36, 0.34, f]], [[kx - 0.36, 0.34, kz + 0.18], [kx + 0.36, 0.34, kz + 0.18]], [[kx - 0.36, 0.005, f], [kx + 0.36, 0.005, f]]], e, lwAt(kz, 0.014));
    flaechen([[-0.36, 0], [0.31, 0], [-0.36, 0.29], [0.31, 0.29]].map(([dx, y]) => [[kx + dx, y, f], [kx + dx + 0.05, y, f], [kx + dx + 0.05, y + 0.05, f], [kx + dx, y + 0.05, f]]), '#8a8088');
    flaechen([-0.2, 0.2].map((dx) => [[kx + dx - 0.03, 0.16, f], [kx + dx + 0.03, 0.16, f], [kx + dx + 0.03, 0.27, f], [kx + dx - 0.03, 0.27, f]]), '#a8a2b0');
    linien([[[kx - 0.09, 0.1, f], [kx + 0.09, 0.1, f]]], '#0a0809', lwAt(kz, 0.03));
    linien([[[kx - 0.32, 0.5, kz - 0.131], [kx + 0.02, 0.5, kz - 0.131]], [[kx - 0.32, 0.34, kz - 0.131], [kx - 0.32, 0.5, kz - 0.131]], [[kx + 0.02, 0.34, kz - 0.131], [kx + 0.02, 0.5, kz - 0.131]]], e, 1);
    fillZ(kx - 0.19, kx - 0.11, 0.4, 0.44, kz - 0.132, '#a8a2b0');
    const u = (a, b) => [lerp(kl[0][0], kl[1][0], a), lerp(kl[0][1], kl[3][1], b), lerp(kl[0][2], kl[3][2], b)];
    flaechen([0, 1, 2, 3].map((i) => [u(i * 0.25, 0.8), u(i * 0.25 + 0.12, 0.8), u(i * 0.25 + 0.2, 1), u(i * 0.25 + 0.08, 1)]), '#e9e4f3');
    linien([[u(0, 0.78), u(1, 0.78)], [u(0.08, 0.5), u(0.92, 0.5)], [u(0.08, 0.26), u(0.6, 0.26)]], 'rgba(233,228,243,.6)', 1);
    { const B = flachAn(kx - 0.15, 0.5, kz - 0.02); if (B) { ctx.strokeStyle = '#d8d2c8'; ctx.lineWidth = Math.max(1.5, 0.035 * B.k); ctx.beginPath(); ctx.ellipse(B.X(0), B.Y(0.03), 0.075 * B.k, 0.03 * B.k, 0, 0, 7); ctx.stroke(); } }
  });
  fest(rz, [rx - 0.36, rx + 0.36, 0, ry + 0.32, rz - 0.22, rz + 0.36], () => {
    fleck(rx, rz + 0.04, 0.3, 0.22, 0.15, 0.9);
    stativ(rx, rz, 0.5, [[-0.3, -0.18], [0.3, -0.18], [0, 0.34]], 0.035);
    linien([[[rx, 0.5, rz], [rx, ry - 0.27, rz]]], dark, lwAt(rz, 0.04));
    if (rz - cam.z < 0.8) return;
    { const tb = fillZ(rx - 0.16, rx + 0.16, 0.84, 1.08, rz - 0.01, '#0a0a10');
      if (tb) roh(() => { const U = ui([tb[0] + tb[2] * 0.05, tb[1] + tb[3] * 0.07, tb[2] * 0.9, tb[3] * 0.86]); U(0, 0, 1, 1, '#1b1a25'); if (!FEIN) { U(0.04, 0.06, 0.92, 0.88, '#d98a5c'); return; }
        ['#FF5A1F', '#f3e6c4', '#c4683f', '#8B5CF6', '#e0763f', '#3a3849', '#f6dcc4', '#FF8A4C', '#7a4630'].forEach((c, i) => U(0.04 + (i % 3) * 0.32, 0.06 + ((i / 3) | 0) * 0.31, 0.28, 0.26, c)); }); }
    const c = P(rx, ry, rz), k = S.f / (rz - cam.z), rr = 0.27 * k, pw = 0.075 * k, ph = 0.165 * k;
    if (FEIN) glow(rx, ry, rz, 0.9, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
    ctx.lineWidth = Math.max(2, 0.06 * k); ctx.strokeStyle = '#17151b'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 0.62, rr, 0, 0, 7); ctx.stroke();
    roh(() => { ctx.lineWidth = Math.max(1.5, 0.04 * k); ctx.strokeStyle = 'rgb(255,246,232)'; ctx.beginPath(); ctx.ellipse(c[0] + 0.012 * k, c[1], rr * 0.62, rr, 0, -1.9, 1.9); ctx.stroke(); });
    ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.roundRect(c[0] - pw / 2, c[1] - ph / 2, pw, ph, pw * 0.2); ctx.fill();
    roh(() => { const px = c[0] - pw / 2 + pw * 0.1, py = c[1] - ph / 2 + ph * 0.05, w = pw * 0.8, h = ph * 0.9; ctx.fillStyle = `rgb(${BR})`; ctx.fillRect(px, py, w, h);
      if (!FEIN) return;
      ctx.fillStyle = '#f6dcc4'; ctx.fillRect(px, py + h * 0.52, w, h * 0.48); ctx.fillStyle = '#3d2a24'; ctx.beginPath(); ctx.arc(px + w / 2, py + h * 0.36, w * 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(px + w / 2, py + h * 0.66, w * 0.34, h * 0.16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(px + w * 0.08, py + h * 0.04, w * 0.38, Math.max(1, h * 0.012)); ctx.fillRect(px + w * 0.54, py + h * 0.04, w * 0.38, Math.max(1, h * 0.012));
      ctx.beginPath(); ctx.arc(px + w / 2, py + h * 0.9, w * 0.13, 0, 7); ctx.fill(); });
    if (!FEIN) return;
    ctx.lineWidth = Math.max(1, 0.008 * k); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 0.62 + 0.03 * k, rr + 0.03 * k, 0, 3.4, 4.9); ctx.stroke();
    ctx.fillStyle = '#17151b'; ctx.fillRect(c[0] - 0.02 * k, c[1] + ph / 2, 0.04 * k, rr - ph / 2); ctx.fillRect(c[0] - 0.05 * k, c[1] + rr - 0.01 * k, 0.1 * k, 0.07 * k);
    linien([[[rx, 0.62, rz], [rx, 0.68, rz]]], '#3a3849', lwAt(rz, 0.07));
  });
  aus(rz - 0.004, aS, [rx - 0.2, rx + 0.22, ry - 0.3, ry + 0.3, rz - 0.01, rz + 0.01], (v) => {
    const c = P(rx, ry, rz), k = S.f / (rz - cam.z), rr = 0.27 * k, pw = 0.075 * k, ph = 0.165 * k;
    ctx.lineWidth = Math.max(1.5, 0.042 * k); ctx.strokeStyle = `rgba(70,64,72,${v})`; ctx.beginPath(); ctx.ellipse(c[0] + 0.012 * k, c[1], rr * 0.62, rr, 0, -1.9, 1.9); ctx.stroke();
    ctx.fillStyle = `rgba(10,10,16,${0.8 * v})`; ctx.fillRect(c[0] - pw * 0.4, c[1] - ph * 0.45, pw * 0.8, ph * 0.9);
  });
  const [tx, tz] = Q.beistell, tischH = 0.66;
  fest(tz + 0.22, [tx - 0.3, tx + 0.3, 0, 1.06, tz - 0.26, tz + 0.26], () => {
    const A = flachAn(tx, 0, tz); if (!A) return; const ry = 0.24 * Math.min(0.9, Math.max(0.08, (cam.y - oy - tischH) / (tz - cam.z)));
    if (FEIN) fleck(tx, tz, 0.28, 0.22, 0.2, 0.6);
    A.S([[0, 0.02], [0, tischH - 0.02]], '#15131a', 0.045);
    if (FEIN) { A.E(0, 0.02, 0.17, ry * 0.7, '#15131a'); A.E(0, tischH - 0.03, 0.24, ry, '#2c2220'); }
    A.E(0, tischH, 0.24, ry, '#8a6c5c');
    if (!FEIN) return;
    A.E(-0.05, tischH + 0.004, 0.15, ry * 0.55, 'rgba(255,226,200,.16)');
    const y = tischH + 0.004;
    A.R(-0.19, y, 0.058, 0.075, '#e9dfcf'); A.R(-0.19, y + 0.066, 0.058, 0.009, '#5a3a2c');
    A.R(-0.1, y, 0.11, 0.13, `rgb(${BR})`); A.R(-0.1, y + 0.112, 0.11, 0.018, 'rgba(255,255,255,.25)'); A.R(-0.09, y + 0.13, 0.075, 0.05, '#f3e6c4');
    A.S([[0.06, y], [0.11, y + 0.07], [0.16, y]], '#17151b', 0.014); A.S([[0.11, y + 0.07], [0.11, y + 0.17]], '#17151b', 0.018);
    A.V([[0.03, y + 0.17], [0.17, y + 0.16], [0.17, y + 0.29], [0.03, y + 0.28]], '#17151b');
    roh(() => A.V([[0.042, y + 0.182], [0.158, y + 0.172], [0.158, y + 0.278], [0.042, y + 0.268]], 'rgb(255,238,212)'));
    glow(tx + 0.1, y + 0.225, tz, 0.5, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
  });
  aus(tz + 0.215, aS, [tx, tx + 0.2, tischH + 0.15, tischH + 0.31, tz - 0.01, tz + 0.01], (v) => { const A = flachAn(tx, 0, tz), y = tischH + 0.004; if (A) A.V([[0.042, y + 0.182], [0.158, y + 0.172], [0.158, y + 0.278], [0.042, y + 0.268]], `rgba(60,54,60,${0.9 * v})`); });
  fest(7.3, [-1.6, 1.8, y1 - 0.5, y1, 7.25, 7.35], () => { strahler(-1.5, 7.3, y1, 1); strahler(1.7, 7.3, y1, 1); });
  fest(5.5, [-1.6, 1.8, y1 - 0.5, y1, 5.15, 5.55], () => { strahler(1.7, 5.5, y1, 1); strahler(-1.5, 5.2, y1, 0.6); });
  fest(3.4, [-1.6, 1.8, y1 - 0.5, y1, 3.15, 3.45], () => { strahler(1.7, 3.4, y1, 0.5); strahler(-1.5, 3.2, y1, 0.5); });
  fest(4.4, [2.2, 3.2, 0, 1.6, 4.15, 4.65], () => pflanze(2.72, 4.4, false, 1.2));
  fest(3.2, [1.45, 3.35, 0, 0.84, 2.5, 3.25], () => { box(1.5, 3.3, 0, 0.4, 2.55, 3.2, '#3a2a25', '#1a1311', '#221815'); box(1.5, 3.3, 0.4, 0.82, 2.55, 2.72, '#46302a', '#1f1512', '#281b17'); fillZ(1.5, 3.3, 0.795, 0.82, 2.54, `rgba(${BR},.5)`); });
}
const REV = { bild: [-1.74, -1.26, 1.34, 2.04], side: [-0.42, 0.2, 4.25, 4.6], insel: [-3.5, -1.35, 7.95, 8.75], tisch: [0.8, 2.6, 6.45, 7.15], board: [0.8, 2.8], sockel: [0.1, 0.8, 8.3, 8.9] };
function revenue(F, t, y1, z1) {
  const BL = '125,183,255', zw = z1 - 0.07, MX = 3.6, Q = REV, BRD = '#04060c';
  const aV = () => da('revenue', 'vertriebsleitung'), aT = () => da('revenue', 'tagesworkshop');
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.13, y1, z, '#0d0f16');
  const baender = [[-3.4, -1.5, 7.3], [0.8, 2.7, 6.8]];
  linien(baender.flatMap(([x0, x1, z]) => [x0 + 0.2, x1 - 0.2].map((x) => [[x, y1, z + 0.07], [x, y1 - 0.7, z + 0.07]])), 'rgba(0,0,0,.6)', lwAt(7, 0.012));
  for (const [x0, x1, z] of baender) { box(x0, x1, y1 - 0.76, y1 - 0.7, z, z + 0.14, '#eef4ff', '#a9bde6', '#8fa4d2'); if (FEIN) glow((x0 + x1) / 2, y1 - 0.78, z, 1.8, [[0, `rgba(${BL},.22)`], [1, `rgba(${BL},0)`]]); }
  { const L = [], R = [], hell = [], dunkel = [];
    for (let x = -6; x <= 6.01; x += 0.6) L.push([[x, 0, 0], [x, 0, z1]]); for (let z = 0.6; z < z1; z += 0.6) R.push([[-6, 0, z], [6, 0, z]]);
    if (FEIN) { for (let i = 0; i < 18; i++) for (let j = 4; j < 15; j++) { const h = hash(i, j * 3 + 1), x = -5.4 + i * 0.6, z = j * 0.6, f = [[x, 0.001, z], [x + 0.6, 0.001, z], [x + 0.6, 0.001, z + 0.6], [x, 0.001, z + 0.6]]; if (h < 0.24) hell.push(f); else if (h > 0.76) dunkel.push(f); } flaechen(hell, 'rgba(255,255,255,.05)'); flaechen(dunkel, 'rgba(0,0,0,.06)'); }
    linien(L, 'rgba(0,0,0,.2)', 1); linien(R, 'rgba(0,0,0,.16)', 1); }
  const teppiche = [[-3.9, -1.1, 6.4, 8.95, '#14224a', '#1a2c5e'], [0.55, 3.6, 5.3, 8.95, '#182a58', '#233a74']];
  for (const [xa, xb, za, zb, c0, c1] of teppiche) {
    if (FEIN) poly([[xa - 0.05, 0.003, za - 0.06], [xb, 0.003, za - 0.06], [xb, 0.003, zb], [xa - 0.05, 0.003, zb]], 'rgba(0,0,0,.2)');
    poly([[xa, 0.004, za], [xb, 0.004, za], [xb, 0.004, zb], [xa, 0.004, zb]], c0); poly([[xa + 0.12, 0.005, za + 0.1], [xb - 0.12, 0.005, za + 0.1], [xb - 0.12, 0.005, zb - 0.05], [xa + 0.12, 0.005, zb - 0.05]], c1);
    if (FEIN) linien([[[xa + 0.12, 0.006, za + 0.1], [xb - 0.12, 0.006, za + 0.1]], [[xa + 0.12, 0.006, za + 0.1], [xa + 0.12, 0.006, zb - 0.05]], [[xb - 0.12, 0.006, za + 0.1], [xb - 0.12, 0.006, zb - 0.05]]], 'rgba(190,214,255,.3)', 1);
  }
  poly([[-1.5, 0.004, 3.2], [-0.2, 0.004, 3.2], [-0.2, 0.004, 4.6], [-1.5, 0.004, 4.6]], 'rgba(18,34,76,.9)');
  if (FEIN) { bodenlicht(-2.4, 7.0, 1.9, BL, 0.1); bodenlicht(1.8, 6.3, 1.9, BL, 0.1); bodenlicht(0.45, 7.9, 0.9, '230,240,255', 0.12); }
  lichtDing(8.96, () => { const v = 1 - aV(), w = 1 - aT(), y = 0.008;
    if (v > 0.02) poly([[-3.9, y, 8.95], [-1.1, y, 8.95], [-1.1, y, 6.4], [-3.9, y, 6.4]], `rgba(0,0,0,${0.16 * v})`);
    if (w > 0.02) poly([[0.55, y, 8.95], [3.6, y, 8.95], [3.6, y, 5.3], [0.55, y, 5.3]], `rgba(0,0,0,${0.16 * w})`); });
  fillZ(-MX, MX, 0, 0.95, zw, 'rgba(3,6,16,.4)'); fillZ(-MX, MX, 0.95, 0.985, zw, `rgba(${BL},.55)`); fillZ(-MX, MX, 2.92, 2.96, zw, `rgba(${BL},.35)`); fillZ(-MX, MX, 0, 0.1, zw - 0.01, '#0a0b10');
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#0a0b10');
  if (FEIN) { const f = []; for (let x = -MX + 1.2; x < MX - 0.1; x += 1.2) f.push([[x, 0.1, zw - 0.001], [x, 0.95, zw - 0.001]], [[x, 0.985, zw - 0.001], [x, 2.92, zw - 0.001]]); linien(f, 'rgba(0,0,0,.14)', 1); linien([[[-MX, 0.1, zw - 0.011], [MX, 0.1, zw - 0.011]]], 'rgba(255,255,255,.14)', 1);
    const U = flachAn(-0.65, 2.55, zw - 0.02); if (U) { U.E(0, 0, 0.19, 0.19, '#0a0b10'); roh(() => U.E(0, 0, 0.165, 0.165, '#f4f6fb')); U.S([[0, 0], [0.07, 0.07]], '#10131c', 0.022); U.S([[0, 0], [-0.02, 0.13]], '#10131c', 0.014); U.E(0, 0, 0.018, 0.018, AKZ.revenue); } }
  tafel(-3.5, -1.85, 2.12, 2.9, zw, TEX.kpi, BRD, 1);
  if (FEIN) { glow(-2.7, 2.3, z1 - 0.1, 3.4, [[0, `rgba(${BL},.16)`], [1, `rgba(${BL},0)`]]); glow(2.08, 1.9, z1 - 0.1, 3.0, [[0, `rgba(${BL},.12)`], [1, `rgba(${BL},0)`]]); }
  const wb = fillZ(Q.board[0], Q.board[1], 0.95, 2.5, zw - 0.01, '#dfe7f4');
  if (wb) { const [rx, ry, rw, rh] = wb, b = Math.max(2, rw * 0.012), karten = [[0.05, 0.12, 0.17, 0.2, 0], [0.31, 0.12, 0.17, 0.2, 0], [0.57, 0.12, 0.17, 0.2, 1], [0.72, 0.38, 0.22, 0.22, 2], [0.05, 0.52, 0.17, 0.2, 1], [0.31, 0.52, 0.17, 0.2, 0]];
    ctx.fillStyle = '#9aa6c0'; ctx.beginPath(); ctx.rect(rx - b, ry - b, rw + 2 * b, b); ctx.rect(rx - b, ry + rh, rw + 2 * b, b * 2); ctx.rect(rx - b, ry - b, b, rh + 2 * b); ctx.rect(rx + rw, ry - b, b, rh + 2 * b); ctx.fill();
    ctx.strokeStyle = '#26365e'; ctx.lineWidth = Math.max(1.5, rw * 0.008); ctx.beginPath();
    for (const [u0, v0, u1, v1] of [[0.22, 0.22, 0.31, 0.22], [0.48, 0.22, 0.57, 0.22], [0.74, 0.22, 0.8, 0.22], [0.8, 0.22, 0.8, 0.36], [0.66, 0.5, 0.72, 0.5], [0.4, 0.34, 0.4, 0.5], [0.22, 0.62, 0.31, 0.62], [0.48, 0.62, 0.58, 0.62]]) { ctx.moveTo(rx + u0 * rw, ry + v0 * rh); ctx.lineTo(rx + u1 * rw, ry + v1 * rh); } ctx.stroke();
    ['#ffe08a', '#bfd4ff', AKZ.revenue].forEach((c, n) => { ctx.fillStyle = c; ctx.beginPath(); for (const [u, v, w, h2, f] of karten) if (f === n) ctx.rect(rx + u * rw, ry + v * rh, w * rw, h2 * rh); ctx.fill(); });
    if (FEIN) { ctx.fillStyle = 'rgba(30,40,70,.35)'; ctx.beginPath(); for (const [u, v, w] of karten) { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.07) * rh, w * rw * 0.6, Math.max(1, rh * 0.025)); ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.13) * rh, w * rw * 0.42, Math.max(1, rh * 0.025)); } ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); for (const [u, v, w, h2] of karten) ctx.rect(rx + (u + 0.006) * rw, ry + (v + h2) * rh, w * rw, Math.max(1, rh * 0.012)); ctx.fill();
      ctx.beginPath(); ctx.setLineDash([rw * 0.02, rw * 0.015]); ctx.rect(rx + rw * 0.03, ry + rh * 0.8, rw * 0.94, rh * 0.14); ctx.stroke(); ctx.setLineDash([]);
      roh(() => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(rx + rw * 0.6, ry); ctx.lineTo(rx + rw * 0.74, ry); ctx.lineTo(rx + rw * 0.5, ry + rh); ctx.lineTo(rx + rw * 0.36, ry + rh); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }); } }
  fillZ(Q.board[0] + 0.3, Q.board[1] - 0.3, 0.9, 0.95, zw - 0.02, '#7c88a8'); if (FEIN) for (let i = 0; i < 4; i++) fillZ(Q.board[0] + 0.5 + i * 0.24, Q.board[0] + 0.62 + i * 0.24, 0.95, 0.99, zw - 0.03, ['#2a4a9a', '#c0342c', '#222', '#3a8a5a'][i]);
  ausDing(8.99, aV, [-3.5, -1.85, 2.12, 2.9, zw - 0.02, zw], (v) => { const r = rectZ(-3.5, -1.85, 2.12, 2.9, zw); if (r) { ctx.fillStyle = `rgba(4,6,12,${0.72 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  ausDing(8.985, aT, [Q.board[0], Q.board[1], 0.95, 2.5, zw - 0.03, zw], (v) => { const r = rectZ(Q.board[0] + 0.03, Q.board[1] - 0.03, 0.98, 2.47, zw - 0.01); if (r) { ctx.fillStyle = `rgba(223,231,244,${0.8 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  { const [gx0, gx1, gy0, gy1] = Q.bild, r = fillZ(gx0, gx1, gy0, gy1, zw - 0.012, '#0a0b10');
    if (r) roh(() => { const b = Math.max(1.5, r[2] * 0.07), U = ui([r[0] + b, r[1] + b, r[2] - 2 * b, r[3] - 2 * b]); U(0, 0, 1, 1, '#eef2fa');
      if (!FEIN) { U(0.14, 0.45, 0.72, 0.41, '#7da4ee'); return; }
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(r[0] + b * 0.5, r[1] + r[3], r[2], Math.max(1, b * 0.6));
      [[0.13, 0.2, '#bfd4ff'], [0.29, 0.31, '#9dbcf6'], [0.45, 0.27, '#7da4ee'], [0.61, 0.44, '#4f7fd8'], [0.77, 0.58, '#27406e']].forEach(([u, h, c]) => U(u, 0.86 - h, 0.11, h, c));
      U(0.09, 0.86, 0.83, 0.012, '#27406e');
      const pt = [[0.185, 0.56], [0.345, 0.44], [0.505, 0.47], [0.665, 0.3], [0.825, 0.16]].map(([u, v]) => [r[0] + b + u * (r[2] - 2 * b), r[1] + b + v * (r[3] - 2 * b)]);
      ctx.strokeStyle = '#ff9d5c'; ctx.lineWidth = Math.max(1.2, r[2] * 0.022); ctx.lineJoin = 'round'; ctx.beginPath(); pt.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.lineJoin = 'miter';
      ctx.fillStyle = '#ff9d5c'; ctx.beginPath(); for (const q of pt) { ctx.moveTo(q[0], q[1]); ctx.arc(q[0], q[1], Math.max(1.2, r[2] * 0.03), 0, 7); } ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(r[0], r[1], r[2], Math.max(1, b * 0.25)); }); }
  ctx.globalCompositeOperation = 'lighter';
  poly([[0.12, 0.99, 8.9], [0.78, 0.99, 8.9], [1.15, 0.99, 8.2], [-0.25, 0.99, 8.2]], lg([0, 1, 8.9], [0, 1, 8.2], [[0, `rgba(${BL},.2)`], [1, `rgba(${BL},0)`]]));
  poly([[0.28, y1 - 0.02, 8.7], [0.62, y1 - 0.02, 8.7], [1.2, 1.0, 8.4], [-0.3, 1.0, 8.4]], lg([0, y1, 8.7], [0, 1, 8.4], [[0, 'rgba(230,240,255,.0)'], [0.4, 'rgba(230,240,255,.1)'], [1, 'rgba(230,240,255,.22)']]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN) wurf(Q.sockel[0], Q.sockel[1], Q.sockel[2], Q.sockel[3], 0.5, 0.16);
  box(Q.sockel[0], Q.sockel[1], 0, 1.0, Q.sockel[2], Q.sockel[3], '#c8d2ea', lg([0, 1, 8.3], [0, 0, 8.3], [[0, '#7d8cb4'], [1, '#2c3658']]), '#3c4870'); fillZ(Q.sockel[0], Q.sockel[1], 0.9, 0.94, Q.sockel[2] - 0.005, `rgba(${BL},.8)`);
  strahler(0.45, 8.1, y1, 0.9);
  const zz = 8.4, monP = () => rectZ(-3.45, -2.25, 0.95, 1.6, zz), monA = () => rectZ(-2.2, -1.4, 0.92, 1.42, zz);
  fest(8.75, [Q.insel[0] - 0.4, Q.insel[1] + 0.1, 0, 1.64, Q.insel[2] - 0.1, Q.insel[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.insel; tischN(x0, x1, z0, z1b, 0.74, '#3a4c7c');
    if (FEIN) { box(x1 - 0.55, x1 - 0.12, 0.05, 0.6, z0 + 0.12, z1b - 0.12, '#4a5270', '#1c2238', '#252c48'); linien([[[x1 - 0.55, 0.24, z0 + 0.119], [x1 - 0.12, 0.24, z0 + 0.119]], [[x1 - 0.55, 0.42, z0 + 0.119], [x1 - 0.12, 0.42, z0 + 0.119]]], 'rgba(0,0,0,.5)', 1); }
    linien([[[-2.85, 0.78, zz], [-2.85, 0.95, zz]]], '#10131c', lwAt(zz, 0.05)); linien([[[-1.8, 0.78, zz], [-1.8, 0.92, zz]]], '#10131c', lwAt(zz, 0.04));
    fillZ(-3.05, -2.65, 0.74, 0.78, zz, '#10131c'); fillZ(-1.98, -1.62, 0.74, 0.78, zz, '#10131c');
    const m = fillZ(-3.45, -2.25, 0.95, 1.6, zz, BRD), m2 = fillZ(-2.2, -1.4, 0.92, 1.42, zz, BRD);
    if (m && TEX.pipe) { ctx.drawImage(TEX.pipe, m[0] + m[2] * 0.015, m[1] + m[3] * 0.025, m[2] * 0.97, m[3] * 0.95); spiegelung(m); }
    if (m2 && TEX.anrufe) { ctx.drawImage(TEX.anrufe, m2[0] + m2[2] * 0.02, m2[1] + m2[3] * 0.03, m2[2] * 0.96, m2[3] * 0.94); spiegelung(m2); }
    box(-3.2, -2.5, 0.74, 0.76, 7.98, 8.14, '#2a2d3a', '#14161e', '#1b1d28'); box(-2.1, -1.65, 0.74, 0.76, 8.0, 8.14, '#2a2d3a', '#14161e', '#1b1d28');
    box(-3.85 + 0.42, -3.65 + 0.42, 0.74, 0.84, 8.2, 8.4, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    if (!FEIN) return;
    glow(-2.85, 1.4, zz - 0.05, 1.9, [[0, `rgba(${BL},.18)`], [1, `rgba(${BL},0)`]]);
    box(-2.65, -2.55, 0.74, 0.76, 8.0, 8.1, '#d8d2e0', '#8a8496', '#9a94a8'); box(-1.52, -1.42, 0.74, 0.76, 8.35, 8.55, '#d8d2e0', '#6a6a7a', '#7a7a8a');
    poly([[-1.62, 0.74, 8.02], [-1.42, 0.74, 8.02], [-1.42, 0.82, 8.2], [-1.62, 0.82, 8.2]], '#2a2d3a'); box(-1.62, -1.42, 0.74, 0.745, 8.02, 8.2, '#2a2d3a', '#14161e', '#1b1d28');
    linien([[[-1.6, 0.8, 8.08], [-1.6, 0.86, 8.2]]], '#10131c', lwAt(zz, 0.035)); roh(() => fillZ(-1.55, -1.45, 0.775, 0.8, 8.14, `rgb(${BL})`));
    { const H = flachAn(-2.32, 0.74, 8.32); if (H) { H.R(-0.05, 0, 0.1, 0.012, '#10131c'); H.S([[0, 0], [0, 0.2]], '#10131c', 0.016); ctx.strokeStyle = '#2a2d3a'; ctx.lineWidth = Math.max(1.5, 0.018 * H.k); ctx.beginPath(); ctx.arc(H.X(0), H.Y(0.2), 0.075 * H.k, Math.PI, 0); ctx.stroke(); H.R(-0.095, 0.13, 0.04, 0.08, '#10131c'); H.R(0.055, 0.13, 0.04, 0.08, '#10131c'); H.S([[-0.075, 0.14], [-0.03, 0.08]], '#10131c', 0.01); } }
    box(-3.44, -3.26, 0.74, 0.755, 8.0, 8.2, '#1a2c5e', '#101830', '#16203e'); linien([[[-3.3, 0.757, 8.02], [-3.38, 0.757, 8.16]]], '#eef4ff', lwAt(zz, 0.012));
    fillZ(Q.insel[0], Q.insel[1], 0.6, 0.68, 8.6, '#141826');
  });
  ausDing(8.74, aV, [-3.46, -1.39, 0.9, 1.62, zz - 0.02, zz + 0.02], (v) => { ctx.fillStyle = `rgba(4,6,12,${0.85 * v})`; for (const r of [monP(), monA()]) if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); });
  ding(8.739, (tt) => {
    const r = monA(); if (!r || aV() < 0.6) return false; const n = Math.floor((tt || 0) / 2600) % 4, y = r[1] + r[3] * (0.3 + n * 0.15), b = Math.max(1, r[2] * 0.012);
    roh(() => { ctx.fillStyle = `rgb(${BL})`; ctx.fillRect(r[0] + r[2] * 0.045, y, b, r[3] * 0.1); }); return [r[0] + r[2] * 0.03, y - 1, r[0] + r[2] * 0.08, y + r[3] * 0.1 + 1];
  });
  fest(7.17, [Q.tisch[0] - 0.25, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.74, '#c2ad92', '#4a3f34', '#55493c');
    flaechen([[0.95, 1.35, 6.6, 7.0], [1.45, 1.7, 6.55, 6.95]].map(([a, b, c, d]) => [[a, 0.752, c], [b, 0.752, c], [b, 0.752, d], [a, 0.752, d]]), '#f6f3ea'); flach(2.4, 2.5, 6.6, 6.8, 0.752, '#ffe08a');
    laptop(2.1, 0.75, 6.62, 0.44); laptop(1.15, 0.75, 6.72, 0.4);
    box(1.75, 1.83, 0.75, 0.83, 6.9, 6.98, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(2.45, 2.53, 0.75, 0.83, 6.9, 6.98, '#17469E', '#10357a', '#0d2c66');
    if (!FEIN) return;
    const m = []; for (let i = 0; i < 7; i++) { const z = z0 + 0.06 + i * 0.09, a = x0 + 0.05 + hash(i, 41) * 0.5; m.push([[a, 0.7405, z], [a + 0.5 + hash(i, 42) * 0.8, 0.7405, z]]); } linien(m, 'rgba(70,46,24,.18)', 1);
    flaechen([[1.0, 6.68, 0.05, 0.12], [1.08, 6.68, 0.05, 0.2], [1.16, 6.68, 0.05, 0.09], [1.24, 6.68, 0.05, 0.16]].map(([x, z, w, h]) => [[x, 0.753, z], [x + w, 0.753, z], [x + w, 0.753, z + h], [x, 0.753, z + h]]), AKZ.revenue);
    linien([[[1.48, 0.753, 6.62], [1.67, 0.753, 6.62]], [[1.48, 0.753, 6.7], [1.67, 0.753, 6.7]], [[1.48, 0.753, 6.78], [1.6, 0.753, 6.78]]], 'rgba(30,40,70,.4)', 1);
    flaechen([[2.52, 6.62], [1.9, 6.98]].map(([x, z]) => [[x, 0.753, z], [x + 0.1, 0.753, z], [x + 0.1, 0.753, z + 0.1], [x, 0.753, z + 0.1]]), '#bfd4ff');
    linien([[[2.25, 0.756, 6.95], [2.38, 0.756, 7.02]], [[1.52, 0.756, 7.02], [1.66, 0.756, 7.0]]], '#c0342c', lwAt(6.9, 0.014)); linien([[[2.28, 0.756, 7.04], [2.41, 0.756, 6.98]]], '#2a4a9a', lwAt(6.9, 0.014));
    { const W = flachAn(0.98, 0.74, 7.02); if (W) { roh(() => { W.V([[-0.05, 0], [0.05, 0], [0.04, 0.2], [0.02, 0.24], [-0.02, 0.24], [-0.04, 0.2]], 'rgba(214,232,255,.55)'); W.R(-0.04, 0, 0.08, 0.11, 'rgba(150,196,255,.5)'); W.R(0.1, 0, 0.055, 0.09, 'rgba(214,232,255,.5)'); W.R(0.18, 0, 0.055, 0.09, 'rgba(214,232,255,.5)'); }); } }
  });
  ausDing(7.16, aT, [1.0, 2.35, 0.76, 1.08, 6.7, 6.95], (v) => { ctx.fillStyle = `rgba(4,6,12,${0.8 * v})`; for (const r of [rectZ(2.1 - 0.19, 2.1 + 0.19, 0.81, 1.02, 6.79), rectZ(1.15 - 0.17, 1.15 + 0.17, 0.81, 1.02, 6.89)]) if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); });
  fest(8.7, [2.95, 4.05, 0, 1.5, 8.3, 8.85], () => pflanze(3.5, 8.6, true));
  fest(3.7, [1.55, 2.65, 0, 1.5, 3.45, 3.95], () => pflanze(2.1, 3.7, false));
  fest(Q.side[3], [Q.side[0] - 0.03, Q.side[1] + 0.03, 0, 1.05, Q.side[2] - 0.02, Q.side[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.side, h = 0.72;
    if (FEIN) wurf(x0, x1, z0, z1b, 0.1, 0.12);
    box(x0, x1, 0.06, h, z0, z1b, '#c2ad92', '#1b2748', '#22305a');
    if (!FEIN) return;
    box(x0 + 0.04, x1 - 0.04, 0, 0.06, z0 + 0.04, z1b, '#111', '#101016', '#16151e');
    fillZ(x0, x1, h - 0.035, h, z0 - 0.001, '#8f7c66'); fillZ(x0, x1, h - 0.008, h, z0 - 0.0015, 'rgba(255,240,220,.4)');
    linien([[[(x0 + x1) / 2, 0.1, z0 - 0.001], [(x0 + x1) / 2, h - 0.05, z0 - 0.001]]], 'rgba(0,0,0,.5)', 1);
    flaechen([0, 1].map((i) => { const x = x0 + ((x1 - x0) * (i + 0.5)) / 2; return [[x - 0.07, h - 0.15, z0 - 0.002], [x + 0.07, h - 0.15, z0 - 0.002], [x + 0.07, h - 0.13, z0 - 0.002], [x - 0.07, h - 0.13, z0 - 0.002]]; }), `rgba(${BL},.8)`);
    const A = flachAn(x0, h, z0 + 0.16); if (!A) return;
    [['#27406e', 0.3], ['#dfe7f4', 0.31], [`rgb(${BL})`, 0.3]].forEach(([c, hh], i) => { const dx = 0.27 + i * 0.078; A.R(dx, 0, 0.07, hh, c); A.R(dx + 0.014, hh * 0.52, 0.042, 0.085, 'rgba(255,255,255,.78)'); A.E(dx + 0.035, 0.05, 0.012, 0.012, 'rgba(0,0,0,.45)'); });
    A.V([[0.51, 0], [0.58, 0], [0.61, 0.29], [0.54, 0.3]], '#182a52');
    A.R(0.07, 0, 0.16, 0.14, '#dfe7f4'); A.R(0.07, 0.115, 0.16, 0.025, 'rgba(0,0,0,.14)');
    [[-0.09, 0.12], [-0.04, 0.17], [0.02, 0.19], [0.08, 0.16], [0.12, 0.11]].forEach(([dx, hh], i) => { const bx = 0.15, tx = bx + dx * 1.3, mx = (bx + tx) / 2; A.V([[bx - 0.02, 0.13], [mx - 0.05, 0.13 + hh * 0.5], [tx, 0.13 + hh], [mx + 0.05, 0.13 + hh * 0.45], [bx + 0.02, 0.13]], i % 2 ? '#2f4a35' : '#3d5c40'); });
  });
  fest(4.0, [-2.25, -0.85, 0, 0.82, 3.45, 4.05], () => {
    box(-2.2, -0.9, 0, 0.4, 3.5, 4.0, '#27365e', '#101830', '#16203e'); box(-2.2, -0.9, 0.4, 0.8, 3.5, 3.66, '#33457a', '#121b36', '#1a2548'); fillZ(-2.2, -0.9, 0.775, 0.8, 3.49, `rgba(${BL},.45)`);
    if (FEIN) linien([[[-1.55, 0.42, 3.499], [-1.55, 0.77, 3.499]], [[-2.2, 0.4, 3.499], [-0.9, 0.4, 3.499]]], 'rgba(0,0,0,.3)', 1);
  });
  tuerDinge('revenue', { zarge: '#05070e', blatt: ['#27406e', '#182a52'], griff: `rgba(${BL},.95)` });
}
const INN = { check: [-2.5, 7.3], tisch: [-0.45, 1.5, 6.55, 7.3], bank: [1.85, 3.3, 7.95, 8.75] };
function innovation(F, t, y1, z1) {
  const LV = '167,139,250', LVH = '205,192,255', zw = z1 - 0.07, MX = 3.6, Q = INN, BRD = '#06060c';
  const aC = () => da('innovation', 'check'), aS = () => da('innovation', 'scoping'), aP = () => da('innovation', 'projekt');
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.12, y1, z, '#0d0c18');
  poly([[-0.12, y1 - 0.02, 0.4], [0.12, y1 - 0.02, 0.4], [0.12, y1 - 0.02, z1 - 0.3], [-0.12, y1 - 0.02, z1 - 0.3]], '#14121f');
  const lampen = [[-2.5, 7.1], [0.5, 7.0], [2.6, 7.6]];
  linien(lampen.map(([x, z]) => [[x, y1, z], [x, y1 - 0.85, z]]), 'rgba(0,0,0,.7)', lwAt(7.2, 0.012));
  flaechen(lampen.map(([x, z]) => [[x - 0.1, y1 - 0.85, z], [x + 0.1, y1 - 0.85, z], [x + 0.34, y1 - 1.12, z], [x - 0.34, y1 - 1.12, z]]), '#1d1b2e');
  for (const [x, z] of lampen) { fillZ(x - 0.3, x + 0.3, y1 - 1.14, y1 - 1.11, z - 0.01, `rgba(${LVH},.95)`); if (FEIN) glow(x, y1 - 1.16, z, 1.5, [[0, `rgba(${LV},.26)`], [1, `rgba(${LV},0)`]]); }
  if (FEIN) linien([[[0, y1 - 0.03, 0.4], [0, y1 - 0.03, z1 - 0.3]], ...lampen.map(([x, z]) => [[x - 0.34, y1 - 1.12, z - 0.011], [x - 0.1, y1 - 0.85, z - 0.011]])], 'rgba(205,192,255,.16)', 1);
  { const L = [], R = [], hell = [], dunkel = [];
    for (let x = -6; x <= 6.01; x += 1.2) L.push([[x, 0, 0], [x, 0, z1]]); for (let z = 1.2; z < z1; z += 1.2) R.push([[-6, 0, z], [6, 0, z]]);
    if (FEIN) { for (let i = 0; i < 10; i++) for (let j = 2; j < 8; j++) { const h = hash(i + 3, j * 5 + 2), x = -6 + i * 1.2, z = j * 1.2, f = [[x, 0.001, z], [x + 1.2, 0.001, z], [x + 1.2, 0.001, Math.min(z1, z + 1.2)], [x, 0.001, Math.min(z1, z + 1.2)]]; if (h < 0.3) hell.push(f); else if (h > 0.7) dunkel.push(f); } flaechen(hell, 'rgba(255,255,255,.045)'); flaechen(dunkel, 'rgba(0,0,0,.055)'); }
    linien(L, 'rgba(0,0,0,.2)', 1); linien(R, 'rgba(0,0,0,.17)', 1);
    const w = 0.07, rm = []; for (const [x0, x1, z0, z1b] of [[-3.6, -1.6, 6.2, 8.3], [-0.6, 1.75, 6.0, 8.6], [1.7, 3.5, 6.4, 8.85]]) for (const [a, b, c2, d] of [[x0, x1, z0, z0 + w], [x0, x1, z1b - w, z1b], [x0, x0 + w, z0 + w, z1b - w], [x1 - w, x1, z0 + w, z1b - w]]) rm.push([[a, 0.004, c2], [b, 0.004, c2], [b, 0.004, d], [a, 0.004, d]]);
    flaechen(rm, `rgba(${LV},.55)`); }
  if (FEIN) { bodenlicht(-2.5, 7.2, 1.7, LV, 0.12); bodenlicht(0.5, 7.0, 1.9, WARM, 0.1); bodenlicht(2.6, 7.6, 1.6, LV, 0.12); }
  lichtDing(8.96, () => { const y = 0.008; [[aC, -3.6, -1.6, 6.2, 8.3], [aS, -0.6, 1.75, 6.0, 8.6], [aP, 1.7, 3.5, 6.4, 8.85]].forEach(([a, x0, x1, z0, z1b]) => { const v = 1 - a(); if (v > 0.02) poly([[x0, y, z0], [x1, y, z0], [x1, y, z1b], [x0, y, z1b]], `rgba(0,0,0,${0.16 * v})`); }); });
  fillZ(-MX, MX, 0, 0.9, zw, 'rgba(8,8,18,.4)'); fillZ(-MX, MX, 0.9, 0.93, zw, `rgba(${LV},.45)`); fillZ(-MX, MX, 2.95, 2.99, zw, `rgba(${LV},.3)`);
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#07070e');
  if (FEIN) { const f = []; for (let x = -MX + 1.2; x < MX - 0.1; x += 1.2) f.push([[x, 0, zw - 0.001], [x, 0.9, zw - 0.001]]); linien(f, 'rgba(0,0,0,.2)', 1); linien([[[-MX, 0.1, zw - 0.001], [MX, 0.1, zw - 0.001]]], 'rgba(0,0,0,.3)', 1); }
  { const lw = rectZ(1.75, 3.55, 1.0, 2.9, zw - 0.005); if (lw) { ctx.fillStyle = 'rgba(8,8,18,.45)'; ctx.fillRect(lw[0], lw[1], lw[2], lw[3]);
    if (FEIN) { ctx.fillStyle = 'rgba(205,192,255,.22)'; const n = 16, m = 10, r = Math.max(0.8, lw[2] * 0.0045); ctx.beginPath(); for (let a = 0; a < n; a++) for (let b = 0; b < m; b++) { const px = lw[0] + (lw[2] * (a + 0.5)) / n, py = lw[1] + (lw[3] * (b + 0.5)) / m; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 7); } ctx.fill(); } }
    if (FEIN) { const W = flachAn(1.92, 2.3, zw - 0.02); if (W) { W.S([[0, 0.3], [0, -0.05]], '#8a88a0', 0.03); W.E(0, 0.33, 0.05, 0.05, '#8a88a0'); W.R(-0.06, -0.2, 0.12, 0.1, '#5F4BB6'); W.S([[0, -0.2], [0, -0.48]], '#cfcbd9', 0.02); W.S([[-0.06, -0.62], [0.02, -0.92]], '#e8c84a', 0.035); W.S([[0.02, -0.92], [0.02, -1.02]], '#8a88a0', 0.02); ctx.strokeStyle = '#d8d2c8'; ctx.lineWidth = Math.max(1, 0.025 * W.k); ctx.beginPath(); ctx.arc(W.X(1.58), W.Y(-0.75), 0.06 * W.k, 0, 7); ctx.stroke(); } } }
  { const [sx0, sx1, sz0, sz1] = INN_SOCKEL, mx = (sx0 + sx1) / 2, pz = sz1 + 0.02;
    ctx.globalCompositeOperation = 'lighter';
    poly([[mx - 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.62, 1.0, sz0 - 0.1], [mx - 0.62, 1.0, sz0 - 0.1]], lg([0, y1, sz1], [0, 1, sz0], [[0, 'rgba(236,226,255,0)'], [0.4, 'rgba(236,226,255,.08)'], [1, 'rgba(236,226,255,.2)']]));
    ctx.globalCompositeOperation = 'source-over';
    if (FEIN) wurf(sx0, sx1, sz0, sz1, 0.5, 0.16);
    else schatten(sx0 - 0.12, sx1 + 0.12, sz0 - 0.16, sz1);
    box(sx0, sx1, 0, 1.0, sz0, sz1, '#d9d2f0', lg([0, 1, sz0], [0, 0, sz0], [[0, '#8f86b8'], [1, '#2e2a48']]), '#463f6c'); fillZ(sx0, sx1, 0.9, 0.94, sz0 - 0.005, `rgba(${LVH},.85)`);
    if (FEIN) bodenlicht(mx, sz0 - 0.2, 0.8, '236,226,255', 0.1); strahler(mx, sz0 - 0.3, y1, 0.9); }
  tafel(-3.45, -2.1, 1.05, 2.55, zw, TEX.radar, '#3a3849', 1); tafel(-0.4, 1.55, 1.2, 2.65, zw, TEX.plan, '#3a3849', 1);
  { const m = fillZ(2.1, 3.45, 1.42, 2.62, zw - 0.02, BRD); if (m && TEX.flow) { ctx.drawImage(TEX.flow, m[0] + m[2] * 0.02, m[1] + m[3] * 0.035, m[2] * 0.96, m[3] * 0.93); spiegelung(m); } }
  if (FEIN) { glow(-2.75, 1.8, z1 - 0.1, 2.6, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]); glow(0.55, 1.9, z1 - 0.1, 2.6, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]); glow(2.78, 2.0, z1 - 0.1, 2.2, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]); }
  { const [sx0, sx1, sz0, sz1] = INN_SOCKEL, mx = (sx0 + sx1) / 2, pz = sz1 + 0.02, B = 0.28, H = 2.06, R = ([a, b, c, d], z = pz) => [[mx + a, c, z], [mx + b, c, z], [mx + b, d, z], [mx + a, d, z]];
    flaechen([[-B - 0.05, -B + 0.05, 0, H], [B - 0.05, B + 0.05, 0, H], [-B - 0.1, B + 0.1, H - 0.05, H + 0.07], [-0.11, 0.11, 1.68, H]].map((q) => R(q)), '#0d0c18');
    fillZ(mx - 0.05, mx + 0.05, 1.6, 1.68, pz - 0.012, '#cfcbd9');
    if (FEIN) {
      flaechen([[-B - 0.2, -B + 0.07, 0, 0.07], [B - 0.07, B + 0.2, 0, 0.07], [-B - 0.07, -B + 0.07, 0.5, 0.58], [B - 0.07, B + 0.07, 0.5, 0.58], [-B - 0.07, -B + 0.07, 1.5, 1.58], [B - 0.07, B + 0.07, 1.5, 1.58]].map((q) => R(q, pz - 0.001)), '#3a3849');
      linien([[[mx - B - 0.035, 0.08, pz - 0.002], [mx - B - 0.035, H - 0.06, pz - 0.002]], [[mx + B - 0.035, 0.08, pz - 0.002], [mx + B - 0.035, H - 0.06, pz - 0.002]], [[mx - B - 0.1, H + 0.062, pz - 0.002], [mx + B + 0.1, H + 0.062, pz - 0.002]], [[mx - 0.11, 1.99, pz - 0.002], [mx + 0.11, 1.99, pz - 0.002]]], 'rgba(214,202,255,.5)', 1);
      linien([[[mx - B + 0.05, H - 0.05, pz - 0.001], [mx - 0.11, 1.9, pz - 0.001]], [[mx + B - 0.05, H - 0.05, pz - 0.001], [mx + 0.11, 1.9, pz - 0.001]]], '#0d0c18', lwAt(pz, 0.035));
      const sk = []; for (let i = 0; i <= 10; i++) sk.push([[mx + B + 0.05, 0.66 + i * 0.08, pz - 0.002], [mx + B + 0.05 - (i % 5 ? 0.035 : 0.07), 0.66 + i * 0.08, pz - 0.002]]); linien(sk, 'rgba(236,226,255,.85)', 1);
      roh(() => { ctx.globalCompositeOperation = 'lighter'; poly([[mx - 0.02, 1.6, pz - 0.013], [mx + 0.02, 1.6, pz - 0.013], [mx + 0.1, 1.05, sz0 + 0.19], [mx - 0.1, 1.05, sz0 + 0.19]], 'rgba(205,192,255,.2)'); ctx.globalCompositeOperation = 'source-over'; });
      const g = fillZ(mx - 0.06, mx + 0.46, H + 0.12, H + 0.48, pz - 0.01, BRD); if (g) roh(() => { const U = ui(g); U(0.04, 0.07, 0.92, 0.86, '#12101e'); U(0.08, 0.5, 0.84, 0.012, 'rgba(205,192,255,.25)'); ctx.strokeStyle = '#7fe0a8'; ctx.lineWidth = Math.max(1.2, g[3] * 0.05); ctx.beginPath(); for (let i = 0; i <= 12; i++) { const x = g[0] + g[2] * (0.1 + 0.066 * i), y = g[1] + g[3] * (0.5 - 0.28 * Math.sin(i * 0.9) * Math.exp(-i * 0.09)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); });
      fillZ(mx + 0.17, mx + 0.23, H + 0.07, H + 0.12, pz - 0.009, '#0d0c18');
    } }
  [[aC, -3.45, -2.1, 1.05, 2.55, 0], [aS, -0.4, 1.55, 1.2, 2.65, 0], [aP, 2.1, 3.45, 1.42, 2.62, 0.02]].forEach(([a, x0, x1, y0, yo, dz], i) => ausDing(8.99 - i * 0.001, a, [x0, x1, y0, yo, zw - 0.03, zw], (v) => { const r = rectZ(x0, x1, y0, yo, zw - dz); if (r) { ctx.fillStyle = `rgba(6,6,12,${0.7 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } }));
  const [kx, kz] = Q.check, ex = kx + 0.95, ez = 8.1;
  fest(8.12, [ex - 0.6, ex + 0.6, 0, 2.26, ez - 0.14, ez + 0.62], () => {
    if (FEIN) fleck(ex, ez + 0.2, 0.5, 0.3, 0.14);
    linien([[[ex - 0.4, 2.2, ez], [ex - 0.55, 0, ez - 0.1]], [[ex + 0.4, 2.2, ez], [ex + 0.55, 0, ez - 0.1]], [[ex, 2.2, ez + 0.04], [ex, 0, ez + 0.6]]], '#0a0a10', lwAt(ez, 0.04));
    const cl = fillZ(ex - 0.42, ex + 0.42, 0.95, 2.22, ez, '#e9e5f2'); if (!cl) return;
    const [rx, ry, rw, rh] = cl; ctx.fillStyle = '#5F4BB6'; ctx.fillRect(rx, ry, rw, rh * 0.1);
    ctx.fillStyle = 'rgba(38,36,51,.45)'; ctx.beginPath(); for (let q = 0; q < 6; q++) { const yy = ry + rh * (0.18 + q * 0.13); ctx.rect(rx + rw * 0.3, yy + rw * 0.02, rw * (0.5 - (q % 3) * 0.08), Math.max(1, rh * 0.03)); if (FEIN) ctx.rect(rx + rw * 0.3, yy + rw * 0.065, rw * 0.3, Math.max(1, rh * 0.02)); } ctx.fill();
    ctx.strokeStyle = 'rgba(38,36,51,.7)'; ctx.lineWidth = Math.max(1, rw * 0.018); ctx.beginPath(); for (let q = 0; q < 6; q++) ctx.rect(rx + rw * 0.1, ry + rh * (0.18 + q * 0.13), rw * 0.1, rw * 0.1); ctx.stroke();
    ctx.strokeStyle = '#5F4BB6'; ctx.beginPath(); for (let q = 0; q < 4; q++) { const yy = ry + rh * (0.18 + q * 0.13); ctx.moveTo(rx + rw * 0.12, yy + rw * 0.05); ctx.lineTo(rx + rw * 0.15, yy + rw * 0.085); ctx.lineTo(rx + rw * 0.2, yy + rw * 0.01); } ctx.stroke();
    if (FEIN) { fillZ(ex - 0.42, ex + 0.42, 0.9, 0.95, ez - 0.02, '#2b2842'); fillZ(ex - 0.1, ex + 0.1, 2.2, 2.26, ez - 0.01, '#8a88a0'); }
  });
  ausDing(8.11, aC, [ex - 0.42, ex + 0.42, 0.95, 2.22, ez - 0.01, ez + 0.01], (v) => { const r = rectZ(ex - 0.42, ex + 0.42, 0.95, 2.22, ez); if (r) { ctx.fillStyle = `rgba(8,8,14,${0.55 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  fest(7.32, [kx - 0.45, kx + 0.45, 0, 1.12, kz - 0.5, kz + 0.42], () => {
    if (FEIN) fleck(kx, kz, 0.38, 0.32, 0.22, 1.0); else schatten(kx - 0.42, kx + 0.42, kz - 0.42, kz + 0.42);
    fillZ(kx - 0.045, kx + 0.045, 0, 1.05, kz, '#101016'); fillZ(kx - 0.3, kx + 0.3, 0, 0.045, kz, '#101016'); box(kx - 0.36, kx + 0.36, 1.0, 1.05, kz - 0.36, kz + 0.36, '#8a88a0', '#262532', '#2b2a38');
    box(kx - 0.2, kx + 0.2, 1.05, 1.065, kz - 0.16, kz + 0.16, '#1b1a28', '#0e0d17', '#14131e'); roh(() => flach(kx - 0.17, kx + 0.17, kz - 0.13, kz + 0.13, 1.067, `rgb(${LVH})`));
    flach(kx + 0.22, kx + 0.34, kz - 0.12, kz + 0.14, 1.066, '#f2eff8');
    if (!FEIN) return;
    flaechen([0, 1, 2, 3].map((q) => [[kx + 0.24, 1.068, kz - 0.09 + q * 0.06], [kx + 0.32, 1.068, kz - 0.09 + q * 0.06], [kx + 0.32, 1.068, kz - 0.06 + q * 0.06], [kx + 0.24, 1.068, kz - 0.06 + q * 0.06]]), 'rgba(38,36,51,.5)');
    fillZ(kx - 0.36, kx + 0.36, 1.04, 1.05, kz - 0.361, 'rgba(255,255,255,.35)'); fillZ(kx - 0.02, kx - 0.005, 0.05, 1.0, kz - 0.001, 'rgba(255,255,255,.16)');
    box(kx - 0.32, kx - 0.24, 1.05, 1.15, kz + 0.1, kz + 0.18, '#e9e4f3', '#bdb7cf', '#a8a2bc'); glow(kx, 1.1, kz, 0.9, [[0, `rgba(${LV},.3)`], [1, `rgba(${LV},0)`]]);
  });
  fest(7.33, [Q.tisch[0] - 0.3, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.95, '#bfb9d6');
    flaechen([[-0.3, 0.3, 6.65, 7.2], [0.45, 1.05, 6.7, 7.15]].map(([a, b, c, d]) => [[a, 0.951, c], [b, 0.951, c], [b, 0.951, d], [a, 0.951, d]]), '#efeaf8');
    const kt = (x, z) => [[x, 0.953, z], [x + 0.14, 0.953, z], [x + 0.14, 0.953, z + 0.18], [x, 0.953, z + 0.18]];
    flaechen([kt(-0.2, 6.8), kt(0.7, 6.95)], '#ffe08a'); flaechen([kt(0.02, 6.95), kt(0.9, 6.78)], '#a78bfa'); flaechen([kt(0.5, 6.78)], '#cdc0ff');
    linien([[[-0.13, 0.955, 6.89], [0.09, 0.955, 7.04]], [[0.09, 0.955, 7.04], [0.57, 0.955, 6.87]], [[0.57, 0.955, 6.87], [0.77, 0.955, 7.04]]], '#5F4BB6', lwAt(7, 0.012));
    box(1.15, 1.4, 0.95, 1.0, 6.75, 7.05, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(-0.4, -0.3, 0.95, 1.05, 6.95, 7.05, '#17469E', '#10357a', '#0d2c66');
    box(0.3, 0.7, 0.95, 0.975, 6.8, 7.1, '#2b2a38', '#1c1b26', '#212030'); roh(() => flach(0.34, 0.66, 6.84, 7.06, 0.977, 'rgb(190,176,246)'));
    if (!FEIN) return;
    linien([[[-0.24, 0.9525, 6.72], [0.2, 0.9525, 6.72]], [[-0.24, 0.9525, 7.12], [0.1, 0.9525, 7.12]], [[0.5, 0.9525, 7.08], [0.98, 0.9525, 7.08]], [[0.36, 0.978, 6.9], [0.6, 0.978, 6.9]], [[0.36, 0.978, 6.98], [0.52, 0.978, 6.98]]], 'rgba(38,36,51,.4)', 1);
    linien([[[1.0, 0.956, 6.62], [1.42, 0.956, 6.68]]], '#e8c84a', lwAt(6.7, 0.03)); linien([[[-0.38, 0.956, 6.7], [-0.3, 0.956, 6.86]]], '#c0342c', lwAt(6.8, 0.014)); linien([[[1.2, 1.03, 6.9], [1.36, 1.03, 6.9]]], '#f6f3ea', lwAt(6.9, 0.06));
    glow(0.5, 1.0, 6.95, 1.0, [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},0)`]]);
  });
  const zz = 8.5, schirme = [[2.0, 2.65], [2.75, 3.2]];
  fest(8.78, [Q.bank[0] - 0.3, Q.bank[1] + 0.1, 0, 1.56, Q.bank[2] - 0.1, Q.bank[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.bank; tischN(x0, x1, z0, z1b, 0.92, '#4a4660');
    if (FEIN) { fillZ(x0 + 0.1, x1 - 0.1, 0.3, 0.34, z0 + 0.3, '#2b2842'); box(x0 + 0.2, x0 + 0.7, 0.34, 0.6, z0 + 0.15, z0 + 0.5, '#4a4670', '#2b2842', '#3c3858'); box(x0 + 0.8, x0 + 1.15, 0.34, 0.52, z0 + 0.15, z0 + 0.5, '#8a88a0', '#3a3849', '#4a4858'); }
    linien(schirme.map(([a, b]) => [[(a + b) / 2, 0.95, zz], [(a + b) / 2, 1.1, zz]]), '#10101a', lwAt(zz, 0.04));
    for (const [a, b] of schirme) { fillZ((a + b) / 2 - 0.13, (a + b) / 2 + 0.13, 0.92, 0.96, zz, '#10101a'); const m = fillZ(a, b, 1.1, 1.1 + (b - a) * 0.66, zz, BRD); if (m && TEX.bau) { ctx.drawImage(TEX.bau, m[0] + m[2] * 0.03, m[1] + m[3] * 0.04, m[2] * 0.94, m[3] * 0.92); spiegelung(m); } }
    box(3.05, 3.25, 0.92, 0.97, 8.05, 8.3, '#2b2a38', '#1c1b26', '#212030'); roh(() => { for (let q = 0; q < 3; q++) fillZ(3.08 + q * 0.06, 3.11 + q * 0.06, 0.97, 1.02, 8.04, ['#c0342c', '#e8c84a', '#4ab87a'][q]); });
    box(1.95, 2.3, 0.92, 0.95, 8.1, 8.3, '#e9e4f3', '#bdb7cf', '#a8a2bc'); linien([[[2.0, 0.95, 8.3], [2.2, 1.1, 8.38]], [[2.2, 1.1, 8.38], [2.4, 0.98, 8.28]]], '#2b2a38', lwAt(8.3, 0.014));
    if (!FEIN) return;
    glow(2.55, 1.35, zz - 0.05, 1.6, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]);
    box(2.72, 2.98, 0.92, 1.0, 8.02, 8.2, '#8a88a0', '#3a3849', '#4a4858'); linien([[[2.78, 0.921, 8.019], [2.78, 1.0, 8.019]], [[2.85, 0.921, 8.019], [2.85, 1.0, 8.019]], [[2.92, 0.921, 8.019], [2.92, 1.0, 8.019]]], 'rgba(0,0,0,.4)', 1);
    { const L = flachAn(1.9, 0.92, 8.2); if (L) { L.R(-0.04, 0, 0.1, 0.05, '#2b2a38'); L.S([[0, 0.05], [0.1, 0.22]], '#8a88a0', 0.014); L.S([[0.1, 0.22], [0.12, 0.26]], '#e8c84a', 0.02); ctx.strokeStyle = '#8a88a0'; ctx.lineWidth = Math.max(1, 0.01 * L.k); ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(L.X(-0.09), L.Y(0.02 + i * 0.03)); ctx.lineTo(L.X(-0.05), L.Y(0.035 + i * 0.03)); } ctx.stroke(); } }
  });
  ausDing(8.77, aP, [2.0, 3.2, 1.1, 1.54, zz - 0.02, zz + 0.02], (v) => { ctx.fillStyle = `rgba(6,6,12,${0.85 * v})`; for (const [a, b] of schirme) { const r = rectZ(a, b, 1.1, 1.1 + (b - a) * 0.66, zz); if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  fest(5.05, [1.85, 2.9, 0, 1.05, 4.45, 5.2], () => {
    const x0 = 2.0, x1 = 2.75, z0 = 4.6, z1b = 5.05; if (FEIN) wurf(x0, x1, z0, z1b, 0.9, 0.3); else schatten(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1b + 0.1);
    for (const x of [x0 + 0.06, x1 - 0.1]) fillZ(x, x + 0.04, 0, 0.1, z0, '#0a0a10');
    box(x0, x1, 0.1, 0.95, z0, z1b, '#4a4670', '#3c3858', '#2b2842'); for (let q = 0; q < 3; q++) { fillZ(x0 + 0.04, x1 - 0.04, 0.16 + q * 0.26, 0.36 + q * 0.26, z0 - 0.005, q === 1 ? '#5F4BB6' : '#4a4670'); fillZ(x0 + 0.4, x1 - 0.4, 0.26 + q * 0.26, 0.29 + q * 0.26, z0 - 0.01, '#cfcbd9'); }
    box(x0 + 0.1, x0 + 0.4, 0.95, 1.02, z0 + 0.1, z0 + 0.4, '#5F4BB6', '#3b2a78', '#2e2060');
  });
  tuerDinge('innovation', { zarge: '#08080f', blatt: ['#3d3856', '#2a2640'], griff: `rgba(${LVH},.9)` });
}
const PRR = { karten: [-3.5, -1.75], presse: [0.3, 3.3], tisch: [-3.2, -0.8, 5.9, 6.6], kamera: [2.92, 7.42, 1.16], licht: [0.42, 8.55] };
function pr(F, t, y1, z1) {
  const LV = '167,139,250', LVH = '205,192,255', zw = z1 - 0.07, MX = 3.6, Q = PRR, T = RAUM.pr && RAUM.pr.tuer;
  const aP = () => da('pr', 'pr-kommunikation'), aK = () => da('pr', 'positionierung');
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.13, y1, z, '#0e0a1c');
  dielen(-6, 6, 0.4, z1, 0.6, 5, false);
  { const rund = (r, d = 0) => Array.from({ length: 30 }, (_, i) => [1.5 - d + Math.cos((i / 30) * 6.2832) * 2.1 * r, 0.004, 7.05 - d + Math.sin((i / 30) * 6.2832) * 1.15 * r]);
    if (FEIN) poly(rund(1.015, 0.04), 'rgba(0,0,0,.2)');
    poly(rund(1), '#352a60'); poly(rund(0.87), '#44367a');
    if (FEIN && poly(rund(0.87), null)) { ctx.strokeStyle = 'rgba(205,192,255,.25)'; ctx.lineWidth = lwAt(7, 0.016); ctx.stroke(); }
    if (FEIN) poly([[-3.85, 0.003, 6.85], [-1.5, 0.003, 6.85], [-1.5, 0.003, 8.7], [-3.85, 0.003, 8.7]], 'rgba(0,0,0,.2)');
    poly([[-3.8, 0.004, 6.9], [-1.5, 0.004, 6.9], [-1.5, 0.004, 8.7], [-3.8, 0.004, 8.7]], '#2a2250');
    if (FEIN) { linien([[[-3.7, 0.005, 7.0], [-1.6, 0.005, 7.0]], [[-1.6, 0.005, 7.0], [-1.6, 0.005, 8.7]]], 'rgba(205,192,255,.22)', 1); bodenlicht(1.5, 7.05, 2.0, WARM, 0.12); bodenlicht(-2.7, 7.4, 1.6, LV, 0.12);
      ctx.globalCompositeOperation = 'lighter'; poly([[1.0, y1 - 0.03, 6.6], [2.0, y1 - 0.03, 6.6], [2.7, 0.01, 7.6], [0.3, 0.01, 7.6]], lg([0, y1, 6.8], [0, 0, 7.4], [[0, 'rgba(255,236,214,0)'], [0.3, 'rgba(255,236,214,.1)'], [1, 'rgba(255,236,214,.2)']])); ctx.globalCompositeOperation = 'source-over'; } }
  lichtDing(8.96, () => { const p = 1 - aP(), k = 1 - aK(), y = 0.008; if (p > 0.02) poly(Array.from({ length: 24 }, (_, i) => [1.5 + Math.cos((i / 24) * 6.2832) * 2.1, y, 7.05 + Math.sin((i / 24) * 6.2832) * 1.15]), `rgba(0,0,0,${0.16 * p})`); if (k > 0.02) poly([[-3.8, y, 6.9], [-1.5, y, 6.9], [-1.5, y, 8.7], [-3.8, y, 8.7]], `rgba(0,0,0,${0.16 * k})`); });
  fillZ(-MX, MX, 0, 0.95, zw, 'rgba(8,6,20,.42)'); fillZ(-MX, MX, 0.95, 0.985, zw, `rgba(${LV},.5)`); fillZ(-MX, MX, 2.95, 2.99, zw, `rgba(${LV},.3)`);
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#07060e');
  { const pw = rectZ(Q.presse[0], Q.presse[1], 0.06, 2.62, zw - 0.01); if (pw) { const [rx, ry, rw, rh] = pw; ctx.fillStyle = '#231c48'; ctx.fillRect(rx, ry, rw, rh);
      const nx = 12, ny = 8, dx = rw / nx, dy = rh / ny;
      ['rgba(167,139,250,.75)', 'rgba(205,192,255,.55)', 'rgba(95,75,182,.55)'].forEach((c, n) => { ctx.fillStyle = c; ctx.beginPath();
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) { const cx = rx + (a + 0.5 + (b % 2) * 0.5) * dx, cy = ry + (b + 0.5) * dy; if (cx > rx + rw - dx * 0.2 || ((a + b) % 4 === 0 ? 0 : (a * 3 + b) % 5 === 0 ? 1 : 2) !== n) continue; ctx.moveTo(cx, cy - dy * 0.42); ctx.lineTo(cx + dx * 0.38, cy); ctx.lineTo(cx, cy + dy * 0.42); ctx.lineTo(cx - dx * 0.38, cy); ctx.closePath(); } ctx.fill(); });
      ctx.strokeStyle = '#0c0a1a'; ctx.lineWidth = Math.max(2, rw * 0.012); ctx.strokeRect(rx, ry, rw, rh);
      if (FEIN) { fillZ(Q.presse[0] - 0.06, Q.presse[0], 0, 2.68, zw - 0.02, '#15131f'); fillZ(Q.presse[1], Q.presse[1] + 0.06, 0, 2.68, zw - 0.02, '#15131f'); fillZ(Q.presse[0] - 0.06, Q.presse[1] + 0.06, 2.62, 2.68, zw - 0.02, '#15131f'); } } }
  const kw = fillZ(Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.01, '#2b2548');
  if (kw) { const [rx, ry, rw, rh] = kw, farben = ['#ffe08a', '#cdc0ff', '#f0ece4', '#a78bfa', '#cdc0ff'], pos = [];
    ctx.fillStyle = '#4a3f7a'; ctx.fillRect(rx - 3, ry - 3, rw + 6, 3);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { const j = hash(a * 3 + b, 17); pos.push([0.07 + a * 0.23 + (j - 0.5) * 0.04, 0.1 + b * 0.28 + (hash(b, a + 9) - 0.5) * 0.05, (a + b * 2) % 5]); }
    ctx.strokeStyle = 'rgba(255,120,120,.85)'; ctx.lineWidth = Math.max(1, rw * 0.006); ctx.beginPath(); for (const [a, b] of [[0, 5], [5, 2], [2, 7], [7, 10], [10, 11], [1, 4], [4, 9], [9, 6], [3, 8], [8, 11]]) { ctx.moveTo(rx + (pos[a][0] + 0.08) * rw, ry + (pos[a][1] + 0.03) * rh); ctx.lineTo(rx + (pos[b][0] + 0.08) * rw, ry + (pos[b][1] + 0.03) * rh); } ctx.stroke();
    if (FEIN) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); for (const [u, v] of pos) ctx.rect(rx + (u + 0.008) * rw, ry + (v + 0.012) * rh, rw * 0.16, rh * 0.2); ctx.fill(); }
    [0, 1, 2, 3].forEach((n) => { ctx.fillStyle = farben[n]; ctx.beginPath(); for (const [u, v, f] of pos) if (f % 4 === n) ctx.rect(rx + u * rw, ry + v * rh, rw * 0.16, rh * 0.2); ctx.fill(); });
    ctx.fillStyle = 'rgba(30,24,60,.4)'; ctx.beginPath(); pos.forEach(([u, v, f], i) => { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.05) * rh, rw * 0.1, Math.max(1, rh * 0.02)); ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.1) * rh, rw * 0.07, Math.max(1, rh * 0.02));
      if (FEIN && f === 2) { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.125) * rh, rw * 0.055, rh * 0.06); for (let q = 0; q < 3; q++) ctx.rect(rx + (u + 0.085) * rw, ry + (v + 0.13 + q * 0.02) * rh, rw * 0.06, Math.max(1, rh * 0.008)); } else if (FEIN && i % 3 === 0) ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.14) * rh, rw * 0.11, Math.max(1, rh * 0.014)); }); ctx.fill();
    ctx.fillStyle = '#c0342c'; ctx.beginPath(); for (const [u, v] of pos) { const px = rx + (u + 0.08) * rw, py = ry + (v + 0.03) * rh, r = Math.max(1.2, rw * 0.007); ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 7); } ctx.fill(); }
  if (FEIN) { glow(-2.6, 1.9, z1 - 0.1, 2.8, [[0, `rgba(${LV},.16)`], [1, `rgba(${LV},0)`]]); glow(1.8, 1.9, z1 - 0.1, 3.2, [[0, `rgba(${LV},.16)`], [1, `rgba(${LV},0)`]]); }
  ausDing(8.99, aK, [Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.03, zw], (v) => { const r = rectZ(Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.01); if (r) { ctx.fillStyle = `rgba(20,16,38,${0.62 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  if (T) { fillZ(T.x0 + 0.2, T.x1 - 0.2, 2.5, 2.58, z1 - 0.06, '#1a1230'); roh(() => fillZ(T.x0 + 0.25, T.x1 - 0.25, 2.52, 2.56, z1 - 0.07, 'rgb(255,96,90)')); if (FEIN) glow((T.x0 + T.x1) / 2, 2.54, z1 - 0.1, 0.9, [[0, 'rgba(255,90,90,.4)'], [1, 'rgba(255,90,90,0)']]);
    ausDing(8.985, aP, [T.x0 + 0.2, T.x1 - 0.2, 2.5, 2.58, z1 - 0.08, z1 - 0.05], (v) => { const r = rectZ(T.x0 + 0.25, T.x1 - 0.25, 2.52, 2.56, z1 - 0.07); if (r) { ctx.fillStyle = `rgba(60,24,30,${0.85 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } }); }
  { const [sx0, sx1, sz0, sz1] = PR_SOCKEL, mx = (sx0 + sx1) / 2;
    ctx.globalCompositeOperation = 'lighter';
    poly([[mx - 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.6, 1.0, sz0 - 0.1], [mx - 0.6, 1.0, sz0 - 0.1]], lg([0, y1, sz1], [0, 1, sz0], [[0, 'rgba(236,226,255,0)'], [0.4, 'rgba(236,226,255,.08)'], [1, 'rgba(236,226,255,.2)']]));
    ctx.globalCompositeOperation = 'source-over';
    if (FEIN) wurf(sx0, sx1, sz0, sz1, 0.5, 0.16); else schatten(sx0 - 0.12, sx1 + 0.12, sz0 - 0.16, sz1);
    box(sx0, sx1, 0, 1.0, sz0, sz1, '#d9d2f0', lg([0, 1, sz0], [0, 0, sz0], [[0, '#8f86b8'], [1, '#2e2a48']]), '#463f6c'); fillZ(sx0, sx1, 0.9, 0.94, sz0 - 0.005, `rgba(${LVH},.85)`);
    if (FEIN) bodenlicht(mx, sz0 - 0.2, 0.8, '236,226,255', 0.1); strahler(mx, sz0 - 0.3, y1, 0.9); }
  const [lx, lz] = Q.licht, lf = [[lx - 0.36, 1.98, lz], [lx + 0.36, 1.98, lz], [lx + 0.36, 2.4, lz + 0.12], [lx - 0.36, 2.4, lz + 0.12]];
  fest(lz, [lx - 0.45, lx + 0.45, 0, 2.46, lz - 0.35, lz + 0.4], () => {
    stativ(lx, lz + 0.1, 0.5, [[-0.34, 0.12], [0.34, 0.12], [0, -0.32]], 0.03); linien([[[lx, 0.45, lz + 0.1], [lx, 2.1, lz + 0.1]]], '#0a0a10', lwAt(lz, 0.035));
    roh(() => poly(lf, 'rgb(255,244,226)')); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(lz, 0.045); ctx.stroke();
    if (!FEIN) return;
    linien([[[lx - 0.12, 1.98, lz], [lx - 0.12, 2.4, lz + 0.12]], [[lx + 0.12, 1.98, lz], [lx + 0.12, 2.4, lz + 0.12]]], 'rgba(170,130,100,.25)', 1); linien([[[lx, 1.2, lz + 0.1], [lx, 1.27, lz + 0.1]]], '#3a3849', lwAt(lz, 0.06));
    glow(lx, 2.15, lz - 0.1, 1.3, [[0, `rgba(${WARM},.16)`], [1, `rgba(${WARM},0)`]]);
  });
  ausDing(lz - 0.01, aP, [lx - 0.36, lx + 0.36, 1.98, 2.4, lz, lz + 0.12], (v) => poly(lf, `rgba(96,88,92,${0.82 * v})`));
  const stapel = (x, z, n, c, d = 0.4) => { box(x, x + 0.3, 0.75, 0.75 + n * 0.025, z, z + d, c[(n - 1) % c.length], '#2a2442', '#2a2442'); roh(() => { c.forEach((f, i) => { const q = []; for (let m = i; m < n; m += c.length) q.push([[x, 0.75 + m * 0.025, z - 0.001], [x + 0.3, 0.75 + m * 0.025, z - 0.001], [x + 0.3, 0.772 + m * 0.025, z - 0.001], [x, 0.772 + m * 0.025, z - 0.001]]); if (q.length) flaechen(q, f); }); }); };
  fest(6.62, [Q.tisch[0] - 0.3, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.75, '#6a5a9a');
    stapel(-3.1, 6.05, 7, ['#cdc0ff', '#f0ece4', '#a78bfa']); stapel(-2.72, 6.1, 5, ['#ffe08a', '#e6e0f2', '#cdc0ff']);
    laptop(-2.55, 0.75, 6.2, 0.36);
    if (!FEIN) return;
    flaechen([[-1.9, -1.45, 6.05, 6.4], [-1.38, -1.0, 6.1, 6.5]].map(([a, b, c, d]) => [[a, 0.752, c], [b, 0.752, c], [b, 0.752, d], [a, 0.752, d]]), '#f0ece4');
    linien([[[-1.86, 0.753, 6.1], [-1.5, 0.753, 6.1]], [[-1.86, 0.753, 6.2], [-1.5, 0.753, 6.2]], [[-1.86, 0.753, 6.3], [-1.6, 0.753, 6.3]], [[-1.34, 0.753, 6.18], [-1.05, 0.753, 6.18]], [[-1.34, 0.753, 6.3], [-1.05, 0.753, 6.3]]], 'rgba(30,24,60,.4)', 1);
    box(-1.0, -0.92, 0.75, 0.84, 6.05, 6.13, '#e9e4f3', '#bdb7cf', '#a8a2bc'); linien([[[-1.42, 0.756, 6.44], [-1.25, 0.756, 6.52]]], '#c0342c', lwAt(6.4, 0.014));
  });
  fest(7.3, [1.2, 1.8, 0, 1.95, 6.45, 7.25], () => {
    if (FEIN) { fleck(1.5, 7.05, 0.26, 0.22, 0.2, 0.5); fleck(1.5, 6.5, 0.24, 0.1, 0.16); }
    linien([[[1.5, 0, 6.5], [1.5, 1.9, 6.5]]], '#0a0a10', lwAt(6.5, 0.03)); fillZ(1.3, 1.7, 0, 0.04, 6.5, '#0a0a10'); linien([[[1.5, 1.9, 6.5], [1.5, 1.55, 7.05]]], '#0a0a10', lwAt(6.8, 0.025));
    const q = P(1.5, 1.5, 7.05), k = S.f / Math.max(NEAR, 7.05 - cam.z); ctx.fillStyle = '#1b1a28'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.05 * k, 0.07 * k, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(205,192,255,.6)'; ctx.lineWidth = Math.max(1, 0.012 * k); ctx.stroke();
    box(1.35, 1.65, 0, 0.5, 6.9, 7.2, '#8a7ac0', '#3c3270', '#2e2658'); box(1.4, 1.46, 0.5, 0.6, 7.0, 7.06, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(1.52, 1.58, 0.5, 0.58, 7.05, 7.11, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    if (FEIN) { fillZ(1.35, 1.65, 0.488, 0.5, 6.899, 'rgba(255,255,255,.3)'); linien([[[1.5, 1.9, 6.5], [1.5, 1.96, 6.42]], [[1.5, 0.9, 6.5], [1.5, 0.96, 6.5]]], '#3a3849', lwAt(6.5, 0.05)); }
  });
  fest(6.9, [1.0, 2.05, y1 - 0.5, y1, 6.85, 6.95], () => { strahler(1.1, 6.9, y1, 1); strahler(1.95, 6.9, y1, 1); });
  fest(Q.kamera[1], [Q.kamera[0] - 0.55, Q.kamera[0] + 0.6, 0, Q.kamera[2] + 0.62, Q.kamera[1] - 0.3, Q.kamera[1] + 0.46], () => { if (FEIN) fleck(Q.kamera[0], Q.kamera[1] + 0.05, 0.4, 0.3, 0.14, 1.0); kameraSet(Q.kamera[0], Q.kamera[1], Q.kamera[2]); });
  ding(Q.kamera[1] - 0.004, (tt) => { if (aP() < 0.6 || (tt && tt % 1500 >= 900)) return false; const B = flachAn(Q.kamera[0], Q.kamera[2], Q.kamera[1]); if (!B) return false; roh(() => B.R(0.235, 0.225, 0.035, 0.035, '#ff4a32')); return [B.X(0.23), B.Y(0.27), B.X(0.28), B.Y(0.22)]; });
  fest(4.05, [-2.5, -0.5, 0.68, 0.94, 3.35, 4.1], () => {
    box(-2.45, -0.55, 0.7, 0.76, 3.4, 4.05, '#6a5a9a', '#2a2250', '#342a62'); fillZ(-2.45, -0.55, 0.735, 0.76, 3.395, `rgba(${LVH},.4)`);
    const c = ['#cdc0ff', '#f0ece4', '#a78bfa', '#ffe08a', '#e6e0f2']; box(-1.3, -0.95, 0.76, 0.9, 3.5, 3.92, c[4], '#2a2442', '#2a2442'); roh(() => c.forEach((f, q) => fillZ(-1.3, -0.95, 0.76 + q * 0.028, 0.786 + q * 0.028, 3.499, f)));
  });
  tuerDinge('pr', { zarge: '#08080f', blatt: ['#3d3856', '#2a2640'], griff: `rgba(${LVH},.9)` });
}
function tuerZu(F, y1) {
  const z = 0.75, w = rectZ(-6, 6, 0, y1, z); if (!w) return;
  ctx.fillStyle = sgr(0, w[1], 0, w[1] + w[3], [[0, '#0f0f17'], [1, '#191826']]); ctx.fillRect(w[0], w[1], w[2], w[3]);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 1; i < 40; i++) ctx.fillRect(w[0] + (w[2] * i) / 40, w[1], Math.max(1, w[2] * 0.0022), w[3]);
  const tx0 = 0.05, tx1 = 1.95, th = 2.45, d = rectZ(tx0, tx1, 0, th, z - 0.02), r = Math.max(2, d[2] * 0.035);
  {
    const TW = tagWerte(), hz = TW.horizont;
    poly([[-6, 0, 0], [6, 0, 0], [6, 0, z], [-6, 0, z]], '#2a221f'); { const dl = []; for (let x = -5.4; x < 6; x += 0.6) dl.push([[x, 0.002, 0], [x, 0.002, z]]); linien(dl, 'rgba(0,0,0,.3)', 1); }
    fillZ(-6, 6, 0, 1.1, z - 0.004, 'rgba(120,84,58,.16)'); fillZ(-6, 6, 1.1, 1.14, z - 0.006, '#0c0b10'); fillZ(-6, 6, 0, 0.11, z - 0.008, '#0b0a0e');
    const f = rectZ(4.6, 5.85, 0.55, 3.0, z - 0.01);
    if (f) roh(() => { ctx.fillStyle = '#08080d'; ctx.fillRect(f[0] - r * 0.6, f[1] - r * 0.6, f[2] + r * 1.2, f[3] + r * 1.2); ctx.fillStyle = sgr(0, f[1], 0, f[1] + f[3], [[0, '#1a2250'], [0.6, '#4a3c86'], [1, `rgb(${hz})`]]); ctx.fillRect(f[0], f[1], f[2], f[3]);
      ctx.fillStyle = '#08080d'; ctx.fillRect(f[0] + f[2] / 2 - r * 0.2, f[1], r * 0.4, f[3]); ctx.fillRect(f[0], f[1] + f[3] * 0.36, f[2], r * 0.4); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(f[0], f[1], f[2] * 0.12, f[3]); });
    ctx.globalCompositeOperation = 'lighter'; poly([[4.6, 0.004, z - 0.02], [5.85, 0.004, z - 0.02], [4.9, 0.004, 0.02], [3.2, 0.004, 0.02]], 'rgba(150,140,255,.2)'); ctx.globalCompositeOperation = 'source-over';
    glow(5.2, 1.8, z - 0.1, 2.6, [[0, 'rgba(140,130,255,.14)'], [1, 'rgba(140,130,255,0)']]);
    { const gx = 4.12, zg = z - 0.3, lw = lwAt(zg, 0.045); fillZ(gx - 0.24, gx + 0.24, 0, 0.04, zg, '#08080d'); linien([[[gx, 0, zg], [gx, 1.85, zg]], [[gx - 0.2, 1.72, zg], [gx + 0.2, 1.72, zg]], [[gx - 0.2, 1.72, zg], [gx - 0.26, 1.8, zg]], [[gx + 0.2, 1.72, zg], [gx + 0.26, 1.8, zg]]], '#08080d', lw);
      poly([[gx + 0.06, 1.72, zg - 0.01], [gx + 0.34, 1.6, zg - 0.01], [gx + 0.38, 0.72, zg - 0.01], [gx + 0.02, 0.7, zg - 0.01], [gx - 0.02, 1.5, zg - 0.01]], '#3a3460'); poly([[gx + 0.2, 1.6, zg - 0.012], [gx + 0.34, 1.6, zg - 0.012], [gx + 0.38, 0.72, zg - 0.012], [gx + 0.22, 0.71, zg - 0.012]], '#2c2750');
      const sx = -0.72, zs = z - 0.28; fillZ(sx - 0.24, sx + 0.24, 0.44, 0.5, zs, '#4a3628'); fillZ(sx - 0.24, sx + 0.24, 0.62, 1.0, zs + 0.2, '#3a2a20'); linien([[[sx - 0.21, 0, zs], [sx - 0.21, 0.44, zs]], [[sx + 0.21, 0, zs], [sx + 0.21, 0.44, zs]], [[sx - 0.21, 0.5, zs + 0.2], [sx - 0.21, 1.0, zs + 0.2]], [[sx + 0.21, 0.5, zs + 0.2], [sx + 0.21, 1.0, zs + 0.2]]], '#08080d', lwAt(zs, 0.035)); }
  }
  ctx.fillStyle = '#08080d'; ctx.fillRect(d[0] - r, d[1] - r, d[2] + 2 * r, d[3] + r);
  ctx.fillStyle = sgr(0, d[1], 0, d[1] + d[3], [[0, '#2a2838'], [1, '#1b1a26']]); ctx.fillRect(d[0], d[1], d[2], d[3]);
  ctx.fillStyle = '#08080d'; ctx.fillRect(d[0] + d[2] / 2 - Math.max(1, d[2] * 0.006), d[1], Math.max(2, d[2] * 0.012), d[3]);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, d[2] * 0.008); for (const s of [0, 1]) ctx.strokeRect(d[0] + d[2] * (0.06 + s * 0.5), d[1] + d[3] * 0.06, d[2] * 0.38, d[3] * 0.86);
  ctx.fillStyle = `rgba(${LAVH},.8)`; for (const s of [-1, 1]) ctx.fillRect(d[0] + d[2] / 2 + s * d[2] * 0.07 - d[2] * 0.011, d[1] + d[3] * 0.42, d[2] * 0.022, d[3] * 0.17);
  ctx.fillStyle = `rgba(${WARM},.4)`; ctx.fillRect(d[0], d[1] + d[3] - Math.max(1, d[3] * 0.008), d[2], Math.max(1, d[3] * 0.008));
  { const rr = d[2] * 0.085;
    for (const s of [0.25, 0.75]) { const cx = d[0] + d[2] * s, cy = d[1] + d[3] * 0.3; ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.arc(cx, cy, rr * 1.18, 0, 7); ctx.fill(); ctx.fillStyle = '#12101c'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(205,192,255,.14)'; ctx.beginPath(); ctx.arc(cx - rr * 0.3, cy - rr * 0.3, rr * 0.42, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d3b4e'; ctx.fillRect(d[0] + d[2] * (s - 0.2), d[1] + d[3] * 0.9, d[2] * 0.4, d[3] * 0.07); }
    ctx.fillStyle = '#08080d'; ctx.fillRect(d[0] + d[2] * 0.56, d[1] + d[3] * 0.015, d[2] * 0.3, d[3] * 0.03);
    const a = rectZ(tx0 - 0.62, tx0 - 0.22, th + 0.3, th + 0.62, z - 0.03);
    if (a) { ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.roundRect(a[0], a[1], a[2], a[3], a[3] * 0.2); ctx.fill(); ctx.fillStyle = '#4a1620'; ctx.beginPath(); ctx.arc(a[0] + a[2] / 2, a[1] + a[3] / 2, a[3] * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(a[0] + a[2] * 0.44, a[1] + a[3] * 0.42, a[3] * 0.1, 0, 7); ctx.fill(); } }
  const s = rectZ(tx0 + 0.1, tx1 - 0.1, th + 0.2, th + 0.84, z - 0.06);
  glow((tx0 + tx1) / 2, th + 0.56, z - 0.1, 3.4, [[0, 'rgba(255,236,214,.3)'], [0.4, `rgba(${LAV},.14)`], [1, `rgba(${LAV},0)`]]);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sgr(0, d[1], 0, d[1] + d[3] * 0.7, [[0, 'rgba(255,236,214,.2)'], [1, 'rgba(255,236,214,0)']]); ctx.fillRect(d[0], d[1], d[2], d[3] * 0.7); ctx.globalCompositeOperation = 'source-over';
  if (s) {
    const r2 = Math.max(2, s[3] * 0.1);
    ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.roundRect(s[0] - r2 * 0.6, s[1] - r2 * 0.6, s[2] + r2 * 1.2, s[3] + r2 * 1.2, r2 * 1.4); ctx.fill();
    ctx.fillStyle = sgr(0, s[1], 0, s[1] + s[3], [[0, '#fffaf0'], [1, '#f1e4ff']]); ctx.beginPath(); ctx.roundRect(s[0], s[1], s[2], s[3], r2); ctx.fill();
    if (s[3] > 8) { ctx.fillStyle = '#1b1530'; ctx.font = FONT(700, s[3] * 0.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ERÖFFNET BALD', s[0] + s[2] / 2, s[1] + s[3] * 0.54, s[2] * 0.88); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; }
  }
  ctx.globalCompositeOperation = 'lighter'; poly([[tx0 - 0.4, 0.004, z - 0.02], [tx1 + 0.4, 0.004, z - 0.02], [tx1 + 0.9, 0.004, 0], [tx0 - 0.9, 0.004, 0]], `rgba(${LAV},.07)`); ctx.globalCompositeOperation = 'source-over';
}
function sonnenflecken(F, x0, x1, y1, z1, solid) {
  const W = tagWerte(), e = W.sonne; if (e <= 0.02 || W.innen < 0.1) return;
  const off = F.glas ? [[x0, STUDIO.wand, 0.34, 2.98]] : solid ? [] : [[x0, -3.6, 0.1, y1 - 0.1], [3.6, x1, 0.1, y1 - 0.1]]; if (!off.length) return;
  const gold = goldAnteil(TZ), lang = Math.min(3.4, 0.5 / Math.max(0.12, e)), schub = 0.42, st = Math.min(1, W.innen) * (0.3 + 0.34 * smooth((0.5 - e) / 0.4)) * (1 - 0.62 * gold), kl = TON.kl,
    rgb = `${Math.round(lerp(255 * W.ton[0], 255, gold))},${Math.round(lerp(250 * W.ton[1], 186, gold))},${Math.round(lerp(238 * W.ton[2], 112, gold))}`, rand = 0.07 + 0.3 * gold;
  TON.kl = null; ctx.globalCompositeOperation = 'lighter';
  for (const [xa, xb, yu, yo] of off) {
    const za = z1 - yu * lang, zb = Math.max(0.4, z1 - yo * lang);
    for (let x = xa; x < xb - 0.3; x += 2) { const xe = Math.min(xb, x + 2) - 0.1, xs = x + 0.1;
      const fl = (m, k) => poly([[xs - m - (z1 - za) * schub, 0.006, za + m], [xe + m - (z1 - za) * schub, 0.006, za + m], [xe + m - (z1 - zb) * schub, 0.006, zb - m], [xs - m - (z1 - zb) * schub, 0.006, zb - m]], lg([0, 0, za], [0, 0, zb], [[0, `rgba(${rgb},${st * k})`], [1, `rgba(${rgb},${st * 0.35 * k})`]]));
      if (FEIN) { fl(rand, 0.42); if (gold > 0.3) fl(rand * 0.45, 0.3); fl(-0.05, gold > 0.3 ? 0.36 : 0.6); } else fl(0, 1); }
  }
  ctx.globalCompositeOperation = 'source-over'; TON.kl = kl;
}
const SCHATTENRISS = {
  strasse: [['r', 1.7, 4.7, 0, 1.12], ['m', 2.65, 0], ['m', 3.85, 0], ['r', -0.12, 0.52, 0, 1.05], ['k', 0.2, 1.4, 0.32], ['k', 5.25, 1.25, 0.5], ['k', 0.95, 1.2, 0.45], ['r', -2.75, -0.95, 1.42, 3.18], ['r', 0.38, 0.98, 0, 0.42]],
  studios: [['r', -3.35, -2.35, 1.55, 2.5], ['r', -2.89, -2.81, 0, 1.55], ['m', -1.85, 0], ['r', -0.98, -0.58, 1.22, 1.5], ['r', -0.8, -0.76, 0, 1.22], ['m', -0.38, 0], ['r', 0.1, 1.5, 0.7, 0.78], ['r', 0.45, 1.05, 0.92, 1.42], ['m', 0.75, 1], ['k', 1.02, 1.5, 0.24], ['m', 1.6, 0]],
  revenue: [['r', -3.5, -1.35, 0.7, 0.78], ['m', -2.85, 1], ['m', -1.85, 1], ['r', 0.8, 2.6, 0.7, 0.78], ['m', 1.2, 1], ['m', 2.1, 1], ['m', 3.1, 0], ['r', 0.9, 2.7, 1.5, 2.5], ['k', 0.45, 1.25, 0.2], ['r', 0.3, 0.6, 0, 1.0]],
  innovation: [['m', -3.0, 0], ['m', -2.0, 0], ['r', -2.75, -2.25, 0.98, 1.06], ['r', -2.52, -2.48, 0, 1.0], ['r', -0.45, 1.5, 0.86, 0.94], ['m', -0.1, 0], ['m', 0.9, 0], ['r', 1.85, 3.3, 0, 0.9], ['m', 2.35, 1], ['m', 3.3, 0], ['k', 1.6, 1.22, 0.2]],
  pr: [['r', -3.5, -1.75, 1.0, 2.4], ['m', -2.65, 0], ['r', 0.2, 1.1, 0.1, 0.95], ['m', 0.65, 1], ['r', 1.95, 2.85, 0.1, 0.95], ['m', 2.4, 1], ['r', 2.86, 3.24, 1.0, 1.28], ['r', 3.03, 3.07, 0, 1.0], ['k', -0.24, 1.2, 0.2], ['r', -3.2, -0.8, 0.7, 0.78]],
};
function room(F, t, getrennt = false) {
  oy = F.base; DINGE = [];
  const key = F.key, y1 = F.y1, z1 = F.z1 || 9, x0 = -6, x1 = 6, MX = 3.6, solid = !!F.solid;
  const farF = P(0, 0, z1)[1], farC = P(0, y1, z1)[1], nearF = P(0, 0, 0)[1], nearC = P(0, y1, 0)[1];
  const o0 = P(-6.02, y1 + 0.03, 0), o1 = P(6.02, -0.03, 0);
  const innen = cam.z > -0.4, SC = SCHALE[key] || {}, TW = tagWerte();
  wurfSetzen();
  ctx.save(); tonAn('schale'); if (!innen) { ctx.beginPath(); ctx.rect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); ctx.clip(); }
  if (!innen && o1[1] - o0[1] < 34) {
    tonAus(); if (TW.nacht < 0.98) { ctx.fillStyle = `rgb(${TW.horizont})`; ctx.fillRect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); ctx.fillStyle = 'rgba(40,60,90,.35)'; ctx.fillRect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); }
    if (TW.nacht > 0.02) {
      const x = o0[0], y = o0[1], w = o1[0] - o0[0], h = o1[1] - o0[1], MK = MARKE[key], rgb = MK ? MK.rgb : LAV; ctx.globalAlpha = TW.nacht;
      if (F.zu) { ctx.fillStyle = 'rgba(46,38,84,.9)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = `rgba(${WARM},.85)`; ctx.fillRect(x + w * 0.51, y + h * 0.16, w * 0.14, h * 0.16); }
      else { ctx.fillStyle = sgr(x, 0, x + w, 0, [[0, `rgba(${WARM},.86)`], [0.45, `rgba(${rgb},.74)`], [1, `rgba(${rgb},.5)`]]); ctx.fillRect(x, y, w, h);
        if (h > 7) { const px = (m) => x + ((m + 6) / 12) * w, py = (m) => y + h - (m / y1) * h, k = w / 12; ctx.fillStyle = 'rgba(16,10,30,.6)'; ctx.beginPath();
          for (const [art, a, b, c, d] of SCHATTENRISS[key] || SCHATTENRISS.innovation) {
            if (art === 'r') ctx.rect(px(a), py(d), (b - a) * k, py(c) - py(d));
            else if (art === 'k') { ctx.moveTo(px(a) + c * k, py(b)); ctx.arc(px(a), py(b), c * k, 0, 7); }
            else { const s = b ? 0.45 : 0, o = b ? 1.22 : 1.45; ctx.rect(px(a - 0.2), py(o), 0.4 * k, py(s) - py(o)); ctx.moveTo(px(a) + 0.14 * k, py(o + 0.17)); ctx.arc(px(a), py(o + 0.17), 0.14 * k, 0, 7); if (b) ctx.rect(px(a - 0.26), py(0.5), 0.52 * k, py(0) - py(0.5)); }
          }
          ctx.fill(); } }
      ctx.globalAlpha = 1; }
    ctx.restore(); oy = 0; return;
  }
  if (F.zu) { tuerZu(F, y1); tonAus(); ctx.restore(); oy = 0; return; }
  if (!solid) { fillZ(x0, -MX, 0, y1, z1, 'rgba(18,14,40,.22)'); fillZ(MX, x1, 0, y1, z1, 'rgba(18,14,40,.22)'); }
  poly([[x0, 0, 0], [x0, 0, z1], [x0, y1, z1], [x0, y1, 0]], 'rgba(18,14,40,.18)');
  poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, z1], [x0, y1, z1]], sgr(0, farC, 0, nearC, F.glas ? [[0, '#231a1b'], [0.4, '#130e0f'], [1, '#080606']] : SC.decke || [[0, '#282734'], [0.4, '#15151d'], [1, '#09090d']]));
  for (const cx of [-3, 3]) {
    ctx.globalCompositeOperation = 'lighter';
    poly([[cx - 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, z1 - 0.3], [cx - 0.55, y1 - 0.005, z1 - 0.3]], `rgba(${WARM},.06)`);
    ctx.globalCompositeOperation = 'source-over';
    poly([[cx - 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, z1 - 0.3], [cx - 0.05, y1 - 0.01, z1 - 0.3]], F.glas ? '#c9a48a' : F.dark ? '#8f8aa3' : '#fff2e2');
  }
  poly([[x0, 0, 0], [x1, 0, 0], [x1, 0, z1], [x0, 0, z1]], sgr(0, farF, 0, nearF, F.glas ? [[0, '#4a3a36'], [0.35, '#2a201e'], [1, '#110c0c']] : F.dark ? [[0, '#2f2e3b'], [0.4, '#1b1a24'], [1, '#0d0d12']] : key === 'strasse' ? [[0, '#54483f'], [0.4, '#2e2622'], [1, '#130f0d']] : SC.boden || [[0, '#4d4b5d'], [0.3, '#2d2c3a'], [1, '#14141b']]));
  if (key !== 'strasse' && !SC.fliesen && !F.glas) { const d = []; for (let x = x0 + 0.6; x < x1; x += 0.6) d.push([[x, 0, 0], [x, 0, z1]]); linien(d, 'rgba(0,0,0,.2)', 1); }
  if (!solid) {
    const hz = TW.nacht > 0.98 ? '150,120,245' : TW.horizont;
    poly([[x0, 0, z1], [-MX, 0, z1], [-MX, 0, 4], [x0, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, `rgba(${hz},.36)`], [1, `rgba(${hz},0)`]]));
    poly([[MX, 0, z1], [x1, 0, z1], [x1, 0, 4], [MX, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, `rgba(${hz},.36)`], [1, `rgba(${hz},0)`]]));
  }
  const wxF = P(x1, 0, z1)[0], wxN = P(x1, 0, 0)[0];
  poly([[x1, 0, 0], [x1, 0, z1], [x1, y1, z1], [x1, y1, 0]], sgr(wxF, 0, wxN, 0, F.glas ? [[0, '#2a1d1c'], [1, '#0e0a0a']] : F.dark ? [[0, '#1f1e29'], [1, '#0b0b10']] : key === 'strasse' ? [[0, '#43372f'], [0.3, '#2a221e'], [1, '#100c0b']] : SC.wandR || [[0, '#383644'], [0.3, '#24232e'], [1, '#0e0e13']]));
  { const d = []; for (let z = 0.5; z < z1; z += 0.5) d.push([[x1, 0, z], [x1, y1, z]]); linien(d, 'rgba(0,0,0,.22)', 1); }
  if (key !== 'strasse') { poly([[x1, 0, 0], [x1, 0, z1], [x1, 0.1, z1], [x1, 0.1, 0]], F.glas ? '#4a3a3a' : '#4a4858'); seg([x1, 0.1, 0], [x1, 0.1, z1], 'rgba(0,0,0,.35)', 1); seg([x1, 0, 0], [x1, 0, z1], 'rgba(0,0,0,.4)', 1.5); }
  const bx0 = solid ? x0 : -MX, bx1 = solid ? x1 : MX, mw = F.glas ? null : rectZ(bx0, bx1, 0, y1, z1 - 0.02);
  if (F.glas) {
    const gx = STUDIO.wand, zw = z1 - 0.02;
    fillZ(x0, gx, 2.98, y1, zw, '#0b090c');
    const gl = rectZ(x0, gx, 0.34, 2.98, zw);
    if (gl) { ctx.fillStyle = sgr(0, gl[1], 0, gl[1] + gl[3], [[0, 'rgba(10,7,16,.5)'], [0.6, 'rgba(18,9,18,.34)'], [1, 'rgba(60,24,20,.4)']]); ctx.fillRect(gl[0], gl[1], gl[2], gl[3]); }
    if (FEIN && innen) {
      const b = []; for (const [xa, xb] of STUDIO.felder) { const w = xb - xa; if (w < 1) continue; b.push([[xa + w * 0.12, 0.34, zw], [xa + w * 0.3, 0.34, zw], [xa + w * 0.62, 2.98, zw], [xa + w * 0.44, 2.98, zw]], [[xa + w * 0.38, 0.34, zw], [xa + w * 0.44, 0.34, zw], [xa + w * 0.76, 2.98, zw], [xa + w * 0.7, 2.98, zw]]); }
      const kl = TON.kl; TON.kl = null; ctx.globalCompositeOperation = 'lighter'; flaechen(b, `rgba(255,255,255,${0.05 + 0.05 * Math.min(1, TW.innen)})`); ctx.globalCompositeOperation = 'source-over'; TON.kl = kl;
    }
    fillZ(x0, gx, 0, 0.34, zw - 0.2, '#1b1316'); poly([[x0, 0.34, zw], [gx, 0.34, zw], [gx, 0.34, zw - 0.2], [x0, 0.34, zw - 0.2]], '#5a4644');
    for (let x = x0; x < gx - 0.3; x += 2) fillZ(x - 0.045, x + 0.045, 0.34, 2.98, z1 - 0.03, '#07070c');
    fillZ(x0, gx, 2.2, 2.25, z1 - 0.03, '#07070c');
    fillZ(x0, gx, 2.94, 2.98, z1 - 0.04, `rgba(${MARKE[key].rgb},.9)`);
    if (FEIN) {
      glow(-1, 2.96, z1 - 0.1, 2.6, [[0, `rgba(${MARKE[key].rgb},.09)`], [1, `rgba(${MARKE[key].rgb},0)`]]);
      const k = [], f = []; for (let x = x0; x < gx - 0.3; x += 2) { k.push([[x - 0.045, 0.34, z1 - 0.031], [x - 0.045, 2.98, z1 - 0.031]]); f.push([[x + 0.6, 0, zw - 0.201], [x + 0.6, 0.33, zw - 0.201]], [[x + 1.4, 0, zw - 0.201], [x + 1.4, 0.33, zw - 0.201]]); }
      linien(k, 'rgba(255,236,214,.2)', 1); linien([[[x0, 2.25, z1 - 0.031], [gx, 2.25, z1 - 0.031]], [[x0, 0.34, zw - 0.2], [gx, 0.34, zw - 0.2]]], 'rgba(255,236,214,.22)', 1);
      linien(f, 'rgba(0,0,0,.3)', 1); linien([[[x0, 0.1, zw - 0.201], [gx, 0.1, zw - 0.201]]], 'rgba(0,0,0,.35)', 1);
    }
    const kw = rectZ(gx, x1, 0, y1, zw);
    if (kw) { ctx.fillStyle = sgr(0, kw[1], 0, kw[1] + kw[3], [[0, '#1c1414'], [0.5, '#35282a'], [1, '#2a1f20']]); ctx.fillRect(kw[0], kw[1], kw[2], kw[3]);
      const d = []; for (let x = gx + 0.375; x < x1; x += 0.375) d.push([[x, 0, z1 - 0.025], [x, y1, z1 - 0.025]]); linien(d, 'rgba(0,0,0,.22)', Math.max(1, (0.02 * S.f) / Math.max(1, z1 - cam.z)));
      if (FEIN) { fillZ(gx, x1, 0, 0.1, z1 - 0.026, '#4a3a3a'); linien([[[gx, 0.1, z1 - 0.027], [x1, 0.1, z1 - 0.027]], [[gx, 2.4, z1 - 0.027], [x1, 2.4, z1 - 0.027]]], 'rgba(0,0,0,.3)', 1);
        fillZ(4.32, 4.42, 1.05, 1.2, z1 - 0.027, '#8a8088'); }
    }
    fillZ(gx - 0.06, gx + 0.06, 0, y1, z1 - 0.03, '#0a0809');
  }
  if (mw) {
    ctx.fillStyle = sgr(0, mw[1], 0, mw[1] + mw[3], F.dark ? [[0, '#0d0d14'], [1, '#17161f']] : key === 'strasse' ? [[0, '#1d1716'], [0.55, '#2b211d'], [1, '#3a2c25']] : SC.rueck || [[0, '#1c1b27'], [0.7, '#23212f'], [1, '#2a2838']]); ctx.fillRect(mw[0], mw[1], mw[2], mw[3]);
    if (key !== 'strasse' && key !== 'revenue' && !F.dark) { fillZ(bx0, bx1, 0, 0.1, z1 - 0.025, '#4a4858'); fillZ(bx0, bx1, 0.1, 0.112, z1 - 0.025, 'rgba(0,0,0,.3)'); }
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
  tonAn('ding');
  if (key === 'strasse') { empfang(F, t, y1, z1);
  } else if (key === 'studios') { studio(F, t, y1, z1);
  } else if (key === 'pr') { pr(F, t, y1, z1);
  } else if (key === 'revenue') { revenue(F, t, y1, z1);
  } else { innovation(F, t, y1, z1);
  }
  for (const x of [SHAFT.x0, SHAFT.x1]) seg([x, 0, SHAFT.z], [x, y1, SHAFT.z], `rgba(${LAV},.3)`, 1);
  tonAus(); sonnenflecken(F, x0, x1, y1, z1, solid);
  if (!getrennt) vornMalen(key, t);
  ctx.restore(); oy = 0;
}
const EG = { leuchte: [-2.4, 4.5, 4.48, 8.6], tresen: [1.7, 4.7, 7.7, 8.6, 1.12], schild: [1.75, 4.65, 1.15, 3.05], weg: [-2.75, -0.95, 1.42, 3.18], sessel: [[-0.15, 1], [1.5, -1]], tisch: [0.68, 6.95], schirm: [1.84, 2.22], blumen: 4.46, leute: [['emil', 2.65, 168], ['hanna', 3.85, 196]] };
const ETAGEN_TAFEL = () => FLOORS.slice().reverse().map((F) => { const R = RAEUME.find((r) => r.zeichnung === F.key); return { kurz: F.roof ? 'Dach' : F.n === 0 ? 'EG' : F.id.slice(1), name: R ? R.name : '', farbe: F.akz || AKZ.lav, hier: F.n === 0 }; });
function empfang(F, t, y1, z1) {
  const N = { top: '#6a5d54', front: '#261f1c', side: '#302723' }, x0 = -6, x1 = 6, zw = z1 - 0.03, TW = tagWerte(), [tx0, tx1, tz0, tz1, th] = EG.tresen;
  const shade = (xa, xb, za, zb) => poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');
  for (let x = -6; x < 6; x += 1.5) { const r = rectZ(x, x + 0.03, 0, y1, z1 - 0.025); if (r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(r[0], r[1], Math.max(1, r[2]), r[3]); } }
  { const w = rectZ(x0, x1, 0, y1, zw); if (w) { ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 1; i < 30; i++) ctx.fillRect(w[0] + (w[2] * i) / 30, w[1], Math.max(1, w[2] * 0.004), w[3]);
    if (FEIN) { for (let i = 0; i < 60; i++) { const r = hash(i, 7); if (r > 0.4) continue; ctx.fillStyle = r < 0.18 ? 'rgba(255,236,214,.045)' : 'rgba(0,0,0,.075)'; ctx.fillRect(w[0] + (w[2] * i) / 60, w[1], w[2] / 60 + 0.5, w[3]); }
      ctx.fillStyle = sgr(0, w[1], 0, w[1] + w[3], [[0, 'rgba(0,0,0,.2)'], [0.4, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(w[0], w[1], w[2], w[3]); } } }
  fillZ(-6, 6, 3.9, 3.96, zw, `rgba(${LAVH},.55)`); glow(1.5, 3.93, z1 - 0.1, 4.2, [[0, `rgba(${LAV},.1)`], [1, `rgba(${LAV},0)`]]);
  fillZ(-6, 6, 0, 0.14, zw, '#120e0c');
  fillZ(x0, x1, 3.3, 3.36, z1 - 0.04, `rgba(${WARM},.75)`); glow(0, 3.33, z1 - 0.04, 5.5, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
  { const [la, lb, ly, lz] = EG.leuchte;
    linien([0.06, 0.36, 0.64, 0.94].map((u) => [[la + (lb - la) * u, ly + 0.05, lz], [la + (lb - la) * u, y1, lz]]), '#0a0a10', 1);
    if (FEIN && !NACHZUG) roh(() => { const r = rectZ(la - 0.9, lb + 0.9, ly - 1.25, ly + 1.0, zw - 0.002); if (r) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sgr(0, r[1], 0, r[1] + r[3], [[0, `rgba(${WARM},0)`], [0.42, `rgba(${WARM},.13)`], [0.5, `rgba(${WARM},.16)`], [1, `rgba(${WARM},0)`]]); ctx.fillRect(r[0], r[1], r[2], r[3]); ctx.globalCompositeOperation = 'source-over'; } });
    fillZ(la, lb, ly, ly + 0.07, lz, '#2a2622'); roh(() => fillZ(la + 0.02, lb - 0.02, ly - 0.022, ly + 0.012, lz - 0.001, '#fff2e2'));
    if (FEIN) { fillZ(la, lb, ly + 0.06, ly + 0.07, lz - 0.001, 'rgba(255,236,214,.25)'); glow((la + lb) / 2, ly - 0.05, lz, 1.5, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]); } }
  { const q = [], l = []; for (let z = 2; z < z1; z += 2) q.push([[-6, 0.002, z], [6, 0.002, z]]); for (let x = -6; x <= 6; x += 2) l.push([[x, 0.002, 0], [x, 0.002, z1]]); linien(q, 'rgba(0,0,0,.2)', 1); linien(l, 'rgba(0,0,0,.16)', 1);
    if (FEIN) { const hell = [], dunkel = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { const r = hash(i * 7 + j, 31); if (r > 0.36) continue; const xa = -6 + i * 2 + 0.02, za = j * 2 + 0.02; (r < 0.16 ? hell : dunkel).push([[xa, 0.003, za], [xa + 1.96, 0.003, za], [xa + 1.96, 0.003, za + 1.96], [xa, 0.003, za + 1.96]]); }
      flaechen(dunkel, 'rgba(0,0,0,.05)'); flaechen(hell, 'rgba(255,240,222,.035)'); } }
  bodenlicht(3.2, 6.6, 3.2, WARM, 0.14); bodenlicht(PED.x, PED.z, 1.6, LAVH, 0.12); bodenlicht(0.7, 6.9, 2.2, WARM, 0.1);
  ctx.globalCompositeOperation = 'lighter';
  poly([[x0, 0.004, z1], [x1, 0.004, z1], [x1, 0.004, z1 - 4.4], [x0, 0.004, z1 - 4.4]], lg([0, 0, z1], [0, 0, z1 - 4.4], [[0, `rgba(${WARM},.11)`], [1, `rgba(${WARM},0)`]]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN && !NACHZUG) {
    const b = []; for (let i = 0; i < 30; i += 2) { const x = -6 + (12 * i) / 30; b.push([[x, 0.004, z1], [x + 0.2, 0.004, z1], [x + 0.2, 0.004, z1 - 1.6], [x, 0.004, z1 - 1.6]]); }
    roh(() => { ctx.globalCompositeOperation = 'lighter'; flaechen(b, 'rgba(255,236,214,.03)'); poly([[EG.schild[0], 0.004, z1], [EG.schild[1], 0.004, z1], [EG.schild[1], 0.004, tz1 + 0.1], [EG.schild[0], 0.004, tz1 + 0.1]], lg([0, 0, z1], [0, 0, tz1], [[0, 'rgba(236,230,255,.1)'], [1, 'rgba(236,230,255,0)']])); ctx.globalCompositeOperation = 'source-over'; });
  }
  if (TW.innen > 0.1 && TW.sonne > 0.02 && !NACHZUG) {
    const lang = Math.min(6.4, 2.9 / Math.max(0.2, TW.sonne)), st = Math.min(1, TW.innen) * 0.3, rgb = `${Math.round(255 * TW.ton[0])},${Math.round(226 * TW.ton[1])},${Math.round(186 * TW.ton[2])}`, s = 0.26;
    const stufe = (e) => { const a = [], L = lang + e * 2; for (let x = -6; x < 6; x += 2) { const xa = x + 0.14 - e, xb = x + 1.86 + e; a.push([[xa, 0.006, 0.05], [xb, 0.006, 0.05], [xb - L * s, 0.006, L], [xa - L * s, 0.006, L]]); } return a; };
    const aus = (a) => lg([0, 0.006, cam.z + 0.7], [-lang * s, 0.006, Math.max(cam.z + 1.5, lang + 0.4)], [[0, `rgba(${rgb},${a})`], [0.5, `rgba(${rgb},${a * 0.62})`], [1, `rgba(${rgb},0)`]]);
    roh(() => { ctx.globalCompositeOperation = 'lighter'; if (FEIN) { flaechen(stufe(0.34), aus(st * 0.09)); flaechen(stufe(0.15), aus(st * 0.11)); flaechen(stufe(-0.06), aus(st * 0.14)); } else flaechen(stufe(0.1), `rgba(${rgb},${st * 0.22})`); ctx.globalCompositeOperation = 'source-over'; });
  }
  const lamps = [[0.7, 6.9, 0.3], [3.2, 8.1, 0.3], [PED.x, PED.z, 0.5]];
  for (const [x, z, on] of lamps) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 0.9, 0.005, z - 0.8], [x + 0.9, 0.005, z - 0.8], [x + 0.7, 0.005, z + 0.8], [x - 0.7, 0.005, z + 0.8]], `rgba(${WARM},${on * 0.11})`); ctx.globalCompositeOperation = 'source-over'; }
  const ra = rectZ(EG.schild[0], EG.schild[1], EG.schild[2], EG.schild[3], z1 - 0.05);
  if (ra) {
    if (FEIN && !NACHZUG) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(ra[0] + ra[2] * 0.012, ra[1] + ra[3] * 0.03, ra[2], ra[3]); }
    ctx.fillStyle = 'rgba(246,244,240,.07)'; ctx.fillRect(ra[0], ra[1], ra[2], ra[3]);
    if (FEIN) roh(() => { ctx.fillStyle = sgr(0, ra[1], 0, ra[1] + ra[3], [[0, 'rgba(255,255,255,.1)'], [0.5, 'rgba(255,255,255,.02)'], [1, 'rgba(120,90,220,.08)']]); ctx.fillRect(ra[0], ra[1], ra[2], ra[3]); });
    ctx.fillStyle = '#8B5CF6'; ctx.beginPath(); ctx.arc(ra[0] + ra[2] * 0.3, ra[1] + ra[3] * 0.5, ra[3] * 0.2, 0, 7); ctx.fill();
    if (FEIN) roh(() => { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(ra[0] + ra[2] * 0.3 - ra[3] * 0.06, ra[1] + ra[3] * 0.5 - ra[3] * 0.07, ra[3] * 0.085, 0, 7); ctx.fill(); });
    ctx.fillStyle = pale(0.7); ctx.fillRect(ra[0] + ra[2] * 0.48, ra[1] + ra[3] * 0.4, ra[2] * 0.36, ra[3] * 0.07); ctx.fillStyle = pale(0.35); ctx.fillRect(ra[0] + ra[2] * 0.48, ra[1] + ra[3] * 0.55, ra[2] * 0.24, ra[3] * 0.05);
    ctx.strokeStyle = '#07070c'; ctx.lineWidth = Math.max(2, ra[2] * 0.018); ctx.strokeRect(ra[0], ra[1], ra[2], ra[3]);
    if (FEIN) { ctx.strokeStyle = `rgba(${WARM},.35)`; ctx.lineWidth = 1; ctx.strokeRect(ra[0] + ra[2] * 0.012, ra[1] + ra[2] * 0.012, ra[2] * 0.976, ra[3] - ra[2] * 0.024); }
  }
  glow(3.2, 3.2, z1 - 0.1, 3.4, [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]]);
  { const g = rectZ(EG.weg[0], EG.weg[1], EG.weg[2], EG.weg[3], z1 - 0.05);
    if (g) roh(() => {
      const zeilen = ETAGEN_TAFEL(), zh = g[3] / (zeilen.length + 0.6), u = g[2];
      if (FEIN && !NACHZUG) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(g[0] + u * 0.015, g[1] + u * 0.03, g[2], g[3]); }
      ctx.fillStyle = '#1a1620'; ctx.fillRect(g[0], g[1], g[2], g[3]); ctx.fillStyle = `rgba(${LAVH},.7)`; ctx.fillRect(g[0], g[1], g[2], Math.max(1, g[3] * 0.012));
      const schrift = FEIN && zh > 13; if (schrift) { ctx.font = FONT(600, zh * 0.5); ctx.textBaseline = 'middle'; }
      zeilen.forEach((z, i) => { const y = g[1] + zh * (i + 0.8);
        if (z.hier) { ctx.fillStyle = 'rgba(167,139,250,.2)'; ctx.fillRect(g[0], y - zh * 0.46, g[2], zh * 0.92); }
        ctx.fillStyle = z.farbe; ctx.fillRect(g[0] + u * 0.07, y - zh * 0.2, Math.max(2, zh * 0.14), zh * 0.4);
        if (schrift) { ctx.fillStyle = 'rgba(205,192,255,.95)'; ctx.fillText(z.kurz, g[0] + u * 0.14, y + zh * 0.03, u * 0.2); ctx.fillStyle = 'rgba(246,244,240,.92)'; if (z.name) ctx.fillText(z.name, g[0] + u * 0.36, y + zh * 0.03, u * 0.6); }
        else { ctx.fillStyle = 'rgba(205,192,255,.8)'; ctx.fillRect(g[0] + u * 0.14, y - zh * 0.1, u * 0.12, zh * 0.2); if (z.name) { ctx.fillStyle = pale(0.55); ctx.fillRect(g[0] + u * 0.36, y - zh * 0.1, u * (0.3 + 0.03 * z.name.length), zh * 0.2); } }
        if (i) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(g[0] + u * 0.06, y - zh * 0.5, u * 0.88, 1); }
      });
      if (schrift) ctx.textBaseline = 'alphabetic';
    }); }
  for (const [x, z, on] of lamps) { fillZ(x - 0.015, x + 0.015, 4.75, y1, z, '#0a0a10'); fillZ(x - 0.26, x + 0.26, 4.45, 4.75, z, '#fff2e2'); glow(x, 4.5, z, 1.9, [[0, `rgba(${WARM},${on})`], [1, `rgba(${WARM},0)`]]);
    if (FEIN) { poly([[x - 0.26, 4.5, z], [x + 0.26, 4.5, z], [x + 0.12, 4.78, z], [x - 0.12, 4.78, z]], '#2a2622'); fillZ(x - 0.26, x + 0.26, 4.45, 4.5, z - 0.001, '#fff6e8'); } }
  ding(9.1, () => {
    const tt = reduce ? 0 : t, a = FIG.steh(tt ? gewichtVon(EG_TAKT[0], tt, 0.4) : 0.4, 'haengt', 'haelt'), b = FIG.steh(tt ? gewichtVon(EG_TAKT[1], tt, -0.4) : -0.4, 'spricht', 'haengt'); if (tt) { regen(a, tt, EG_TAKT[0]); regen(b, tt, EG_TAKT[1]); }
    const yk = P(0, th, tz1)[1], l = P(EG.leute[0][1] - 0.6, 2.0, 9.1), r = P(EG.leute[1][1] + 0.6, 2.0, 9.1);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.w, yk); ctx.clip();
    stelleRuhig('emil', tt, menschVon('emil', AKZ.lav), a, EG.leute[0][1], 0, 9.1, rad(EG.leute[0][2]), LICHT.halle, { r: 'tablet' }); stelleRuhig('hanna', tt, menschVon('hanna', AKZ.lav), b, EG.leute[1][1], 0, 9.1, rad(EG.leute[1][2]), LICHT.halle);
    ctx.restore(); return [l[0], l[1], r[0], yk];
  });
  fest(8.9, null, () => { pflanze(5.25, 8.7, true, 1.25); pflanze(0.95, 8.75, true, 1.1); });
  fest(tz1, null, () => {
    shade(tx0 - 0.1, tx1 + 0.1, tz0 - 0.2, tz1 + 0.1);
    box(tx0, tx1, 0, th, tz0, tz1, '#66666c', lg([0, th, tz0], [0, 0, tz0], [[0, '#303035'], [1, '#18181b']]), N.side);
    fillZ(tx0, tx1, 0.99, 1.05, tz0 - 0.01, `rgba(${WARM},.75)`); fillZ(tx0, tx1, 0.02, 0.07, tz0 - 0.01, `rgba(${WARM},.3)`);
    if (!FEIN) return;
    const zf = tz0 - 0.012, f = [];
    fillZ(tx0, tx1, 0.07, 0.99, zf, lg([0, 0.99, zf], [0, 0.07, zf], [[0, '#4a3628'], [1, '#2c1f17']]));
    for (let x = tx0 + 0.1; x < tx1; x += 0.1) f.push([[x, 0.07, zf - 0.001], [x, 0.99, zf - 0.001]]); linien(f, 'rgba(0,0,0,.26)', 1);
    { const hl = []; for (let x = tx0 + 0.05; x < tx1; x += 0.3) hl.push([[x, 0.07, zf - 0.001], [x, 0.99, zf - 0.001]]); linien(hl, 'rgba(255,226,196,.07)', 1); }
    fillZ(tx0 - 0.05, tx1 + 0.05, 1.05, th, tz0 - 0.07, '#8a8580'); poly([[tx0 - 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz1], [tx0 - 0.05, th, tz1]], lg([0, th, tz0], [0, th, tz1], [[0, '#77736f'], [1, '#8f8a84']]));
    seg([tx0 - 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz0 - 0.07], 'rgba(255,246,230,.4)', 1);
    if (!NACHZUG) glow((tx0 + tx1) / 2, 1.02, tz0 - 0.05, 1.9, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
    { const [sa, sb] = EG.schirm, zs = 8.22;
      fillZ((sa + sb) / 2 - 0.04, (sa + sb) / 2 + 0.04, th, th + 0.14, zs + 0.02, '#0c0c12'); fillZ((sa + sb) / 2 - 0.11, (sa + sb) / 2 + 0.11, th, th + 0.02, zs - 0.05, '#0c0c12');
      fillZ(sa, sb, th + 0.12, th + 0.38, zs, '#15151c'); fillZ(sa, sb, th + 0.365, th + 0.38, zs - 0.001, 'rgba(255,246,230,.3)'); fillZ(sa + 0.14, sb - 0.14, th + 0.2, th + 0.3, zs - 0.001, '#1f1f28'); }
    { const bx = EG.blumen, zb = 8.12, o = P(bx, th + 0.3, zb), k = S.f / (zb - cam.z);
      fillZ(bx - 0.07, bx + 0.07, th, th + 0.24, zb, '#3b3945'); fillZ(bx - 0.07, bx - 0.04, th, th + 0.24, zb - 0.001, 'rgba(255,255,255,.12)');
      roh(() => { const h = Math.min(1, TW.innen); ctx.strokeStyle = zweiTon('#14261a', '#4c7a4a', h); ctx.lineWidth = Math.max(1, 0.012 * k); ctx.beginPath(); for (const [dx, dy] of [[-0.12, 0.3], [0, 0.4], [0.13, 0.28], [-0.05, 0.2], [0.07, 0.34]]) { ctx.moveTo(o[0], o[1] + 0.06 * k); ctx.lineTo(o[0] + dx * k, o[1] - dy * k); } ctx.stroke();
        ctx.fillStyle = zweiTon('#3a2a70', '#a78bfa', h); ctx.beginPath(); for (const [dx, dy, rr] of [[-0.12, 0.3, 0.05], [0.13, 0.28, 0.045], [0.07, 0.34, 0.04]]) { ctx.moveTo(o[0] + dx * k + rr * k, o[1] - dy * k); ctx.arc(o[0] + dx * k, o[1] - dy * k, rr * k, 0, 7); } ctx.fill();
        ctx.fillStyle = zweiTon('#57503c', '#f3ead8', h); ctx.beginPath(); for (const [dx, dy, rr] of [[0, 0.4, 0.05], [-0.05, 0.2, 0.04]]) { ctx.moveTo(o[0] + dx * k + rr * k, o[1] - dy * k); ctx.arc(o[0] + dx * k, o[1] - dy * k, rr * k, 0, 7); } ctx.fill(); }); }
  });
  fest(7.4, null, () => {
    const C = FEIN ? { top: '#8a6a54', front: '#3a2a20', side: '#4a362a' } : { top: N.top, front: N.front, side: N.side };
    for (const [x, zu] of EG.sessel) {
      shade(x - 0.52, x + 0.52, 6.4, 7.45);
      box(x - 0.42, x + 0.42, 0.12, 0.44, 6.5, 7.3, C.top, C.front, C.side);
      box(x - zu * 0.42 - 0.07, x - zu * 0.42 + 0.07, 0.12, 0.92, 6.5, 7.3, C.top, FEIN ? '#46332a' : '#2e2e33', C.side);
      box(x - 0.42, x + 0.42, 0.12, 0.62, 7.2, 7.32, C.top, C.front, C.side);
      if (!FEIN) box(x - 0.42, x + 0.42, 0.12, 0.62, 6.5, 6.6, C.top, C.front, C.side);
      else {
        const K = flachAn(x - zu * 0.2, 0, 6.95); if (K) { K.E(0, 0.6, 0.2, 0.19, '#9a7a62'); K.E(-zu * 0.03, 0.64, 0.14, 0.12, 'rgba(255,236,214,.1)'); }
        const L = flachAn(x - zu * 0.42, 0, 6.5); if (L) { L.E(0, 0.915, 0.07, 0.035, '#5a4234'); }
        const r = rectZ(x - 0.42, x + 0.42, 0.12, 0.64, 6.5); if (r) { const rd = r[3] * 0.3;
          ctx.fillStyle = C.front; ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], [rd, rd, rd * 0.25, rd * 0.25]); ctx.fill();
          ctx.fillStyle = '#6e5240'; ctx.beginPath(); ctx.roundRect(r[0] + r[2] * 0.015, r[1], r[2] * 0.97, r[3] * 0.3, rd * 0.85); ctx.fill();
          ctx.fillStyle = 'rgba(255,236,214,.16)'; ctx.beginPath(); ctx.roundRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.035, r[2] * 0.84, r[3] * 0.07, r[3] * 0.035); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(r[0] + r[2] * 0.04, r[1] + r[3] * 0.3, r[2] * 0.92, Math.max(1, r[3] * 0.025)); } }
      if (FEIN) { fillZ(x - 0.36, x - 0.32, 0, 0.13, 6.52, '#0c0b0d'); fillZ(x + 0.32, x + 0.36, 0, 0.13, 6.52, '#0c0b0d'); }
    }
    const [tx, tz] = EG.tisch; shade(tx - 0.36, tx + 0.36, tz - 0.36, tz + 0.36);
    box(tx - 0.3, tx + 0.3, 0, 0.4, tz - 0.3, tz + 0.3, '#77777d', '#1c1c20', '#232327');
    if (FEIN) { poly([[tx - 0.34, 0.4, tz - 0.34], [tx + 0.34, 0.4, tz - 0.34], [tx + 0.34, 0.4, tz + 0.34], [tx - 0.34, 0.4, tz + 0.34]], '#8f8a84'); fillZ(tx - 0.34, tx + 0.34, 0.37, 0.4, tz - 0.34, '#55524f');
      poly([[tx - 0.22, 0.402, tz - 0.2], [tx + 0.02, 0.402, tz - 0.22], [tx + 0.04, 0.402, tz + 0.04], [tx - 0.2, 0.402, tz + 0.06]], '#d8d2c8'); poly([[tx - 0.16, 0.404, tz - 0.14], [tx - 0.02, 0.404, tz - 0.15], [tx - 0.01, 0.404, tz - 0.06], [tx - 0.15, 0.404, tz - 0.05]], `rgba(${LAV},.8)`);
      fillZ(tx + 0.12, tx + 0.2, 0.4, 0.5, tz - 0.05, '#e8e2d8'); }
  });
  fest(PED.z + 0.32, null, () => {
    if (!NACHZUG) { ctx.globalCompositeOperation = 'lighter';
      poly([[PED.x - 0.2, 4.45, PED.z], [PED.x + 0.2, 4.45, PED.z], [PED.x + 1.0, 0, PED.z], [PED.x - 1.0, 0, PED.z]], lg([0, 4.45, PED.z], [0, 0, PED.z], [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},.02)`]]));
      poly([[PED.x - 0.3, 0.006, PED.z - 0.34], [PED.x + 0.3, 0.006, PED.z - 0.34], [PED.x + 0.36, 0.006, PED.z - 1.9], [PED.x - 0.36, 0.006, PED.z - 1.9]], lg([0, 0, PED.z - 0.34], [0, 0, PED.z - 1.9], [[0, `rgba(${LAV},.16)`], [1, `rgba(${LAV},0)`]]));
      ctx.globalCompositeOperation = 'source-over'; }
    shade(PED.x - 0.5, PED.x + 0.5, PED.z - 0.5, PED.z + 0.5);
    box(PED.x - 0.32, PED.x + 0.32, 0, PED.h, PED.z - 0.32, PED.z + 0.32, '#77777d', lg([0, PED.h, 0], [0, 0, 0], [[0, '#3c3c41'], [1, '#1d1d20']]), N.side);
    if (FEIN) { fillZ(PED.x - 0.32, PED.x + 0.32, PED.h - 0.03, PED.h, PED.z - 0.321, 'rgba(255,246,230,.25)'); fillZ(PED.x - 0.32, PED.x + 0.32, 0, 0.06, PED.z - 0.321, 'rgba(0,0,0,.35)'); fillZ(PED.x - 0.32, PED.x - 0.29, 0.06, PED.h - 0.03, PED.z - 0.321, 'rgba(255,255,255,.06)'); }
  });
}
const STR = { cz: -3.5, fz: -13.2, zebra: [-2.9, 0.9], baum: [[-9.4, -3.0, 4.5], [8.3, -3.0, 5.0]], kuebel: [[-2.75, -0.55], [0.75, -0.55]], buegel: [6.9, 7.8, 8.7] };
const STR_FEST = (() => {
  const G = GROUND, RY = G - 0.17, { cz: CZ, fz: FZ } = STR, y = RY + 0.004, mitte = (CZ + FZ) / 2, striche = [], zebra = [], fugen = [], fugenVorn = [], flick = [];
  for (let x = -42; x < 42; x += 5) if (x + 2.2 < STR.zebra[0] - 1 || x > STR.zebra[1] + 1) striche.push([[x, y, mitte + 0.09], [x + 2.2, y, mitte + 0.09], [x + 2.2, y, mitte - 0.09], [x, y, mitte - 0.09]]);
  for (let z = CZ - 0.75; z > FZ + 0.9; z -= 1.0) zebra.push([[STR.zebra[0], y, z], [STR.zebra[1], y, z], [STR.zebra[1], y, z - 0.5], [STR.zebra[0], y, z - 0.5]]);
  for (const z of [-1.1, -2.2]) fugen.push([[-60, G, z], [60, G, z]]);
  for (let x = -30; x <= 30; x += 1.5) fugen.push([[x, G, 0], [x, G, CZ + 0.32]]);
  for (const z of [FZ - 1.6, FZ - 3.1, FZ - 4.9, FZ - 7.2, FZ - 10.4, FZ - 15]) fugenVorn.push([[-60, G, z], [60, G, z]]);
  for (let x = -27; x <= 27; x += 1.5) fugenVorn.push([[x, G, FZ - 0.32], [x, G, FZ - 40]]);
  for (const [x0, x1, z0, z1] of [[-17, -11.5, CZ - 1.2, CZ - 3.4], [6.5, 13, mitte - 0.8, mitte - 3.6], [-7.2, -4.4, FZ + 2.6, FZ + 0.7]]) flick.push([[x0, y - 0.002, z0], [x1, y - 0.002, z0], [x1 - 0.4, y - 0.002, z1], [x0 + 0.3, y - 0.002, z1]]);
  return { G, RY, mitte, striche, zebra, fugen, fugenVorn, flick };
})();
let EG_ZONE = null;
function egZone() {
  if (EG_ZONE) return EG_ZONE;
  const H = 4.2, Z = 0.02, wand = [[], []], glas = [], licht = [], sockel = [], blende = [], kante = [], R = (x0, x1, y0, y1) => [[x0, GROUND + y0, Z], [x1, GROUND + y0, Z], [x1, GROUND + y1, Z], [x0, GROUND + y1, Z]];
  for (const s of [-1, 1]) { let x = s < 0 ? TXL - 0.05 : TXR + 0.05, n = 0;
    for (const w of [10.5, 8, 13, 9, 12, 10]) { const a = s < 0 ? x - w : x, b = a + w, f = Math.round(w / 3.3), bw = w / f, tuer = (n * 2 + (s > 0 ? 1 : 0)) % f;
      wand[(n + (s > 0 ? 1 : 0)) % 2].push(R(a, b, 0, H)); sockel.push(R(a, b, 0, 0.42)); blende.push(R(a + 0.3, b - 0.3, 3.3, 3.82)); kante.push([[a, GROUND, Z - 0.001], [a, GROUND + H, Z - 0.001]], [[b, GROUND, Z - 0.001], [b, GROUND + H, Z - 0.001]]);
      for (let i = 0; i < f; i++) { const m = a + i * bw + bw / 2, g = i === tuer ? R(m - 0.72, m + 0.72, 0.08, 2.75) : R(a + i * bw + 0.42, a + (i + 1) * bw - 0.42, 0.56, 3.05); glas.push(g); if ((i + n) % 3 === 0) licht.push(g); }
      x += s * w; n++; } }
  return (EG_ZONE = { H, wand, glas, licht, sockel, blende, kante });
}
function erdgeschosse() {
  roh(() => { const Z = egZone(), W = tagWerte(), n = W.nacht || 0, G = GROUND;
    flaechen(Z.wand[0], W.stadt[6]); flaechen(Z.wand[1], W.stadt[5]); flaechen(Z.glas, `rgba(14,20,38,${0.52 - 0.12 * n})`);
    if (!AUSSEN_FEIN) return;
    flaechen(Z.sockel, 'rgba(0,0,0,.26)'); flaechen(Z.blende, 'rgba(255,255,255,.1)');
    if (n > 0.05) flaechen(Z.licht, `rgba(255,208,150,${0.3 * n})`);
    linien(Z.kante, 'rgba(0,0,0,.28)', 1);
    linien([[[-60, G + Z.H, 0.018], [TXL - 0.05, G + Z.H, 0.018]], [[TXR + 0.05, G + Z.H, 0.018], [60, G + Z.H, 0.018]]], 'rgba(255,255,255,.26)', 1.5);
    flaechen([[[-60, G + 0.003, 0], [TXL - 0.05, G + 0.003, 0], [TXL - 0.05, G + 0.003, -0.6], [-60, G + 0.003, -0.6]], [[TXR + 0.05, G + 0.003, 0], [60, G + 0.003, 0], [60, G + 0.003, -0.6], [TXR + 0.05, G + 0.003, -0.6]]], 'rgba(0,0,0,.2)');
  });
}
function street() {
  oy = 0; if (cam.z > -NEAR) return;
  const k = S.f / -cam.z, gy = S.cy - (GROUND - cam.y) * k; if (gy > S.h) return;
  tonAn('strasse');
  ctx.fillStyle = sgr(0, gy, 0, Math.max(gy + 40, S.h), [[0, '#1b1a27'], [0.35, '#101018'], [1, '#07080b']]); ctx.fillRect(0, gy, S.w, S.h - gy + 2);
  if (k < 14) { tonAus(); return; }
  const { G, RY, mitte, striche, zebra, fugen, fugenVorn, flick } = STR_FEST, CZ = STR.cz, FZ = STR.fz, nah = k > 20;
  poly([[-60, RY, CZ], [60, RY, CZ], [60, RY, FZ], [-60, RY, FZ]], lg([0, RY, CZ], [0, RY, FZ], [[0, '#14141b'], [1, '#0b0b10']]));
  if (nah) flaechen(flick, 'rgba(0,0,0,.2)');
  flaechen(striche, 'rgba(246,244,240,.2)');
  if (nah) { flaechen(zebra, 'rgba(246,244,240,.3)'); poly([[-60, RY + 0.003, CZ - 0.12], [60, RY + 0.003, CZ - 0.12], [60, RY + 0.003, CZ - 0.42], [-60, RY + 0.003, CZ - 0.42]], 'rgba(0,0,0,.2)'); }
  poly([[-60, G, 0], [60, G, 0], [60, G, CZ], [-60, G, CZ]], lg([0, G, 0], [0, G, CZ], [[0, '#2a2933'], [1, '#201f29']]));
  poly([[-60, G + 0.002, CZ + 0.95], [60, G + 0.002, CZ + 0.95], [60, G + 0.002, CZ + 0.6], [-60, G + 0.002, CZ + 0.6]], 'rgba(246,244,240,.07)');
  linien(fugen, 'rgba(0,0,0,.2)', 1);
  poly([[-1.95, G + 0.004, -0.06], [-0.05, G + 0.004, -0.06], [-0.05, G + 0.004, -0.9], [-1.95, G + 0.004, -0.9]], '#15141b');
  erdgeschosse();
  ctx.globalCompositeOperation = 'lighter';
  poly([[-6, G + 0.01, 0], [6, G + 0.01, 0], [7.5, G + 0.01, CZ], [-7.5, G + 0.01, CZ]], lg([0, G, 0], [0, G, CZ], [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]]));
  ctx.globalCompositeOperation = 'source-over';
  poly([[-60, G, CZ + 0.32], [60, G, CZ + 0.32], [60, G, CZ], [-60, G, CZ]], '#43414f');
  poly([[-60, G, CZ], [60, G, CZ], [60, RY, CZ], [-60, RY, CZ]], '#575565');
  poly([[-60, G, FZ], [60, G, FZ], [60, G, cam.z], [-60, G, cam.z]], lg([0, G, FZ], [0, G, FZ - 16], [[0, '#25242e'], [1, '#17161d']]));
  poly([[-60, G, FZ], [60, G, FZ], [60, G, FZ - 0.32], [-60, G, FZ - 0.32]], '#3c3a48');
  if (nah) linien(fugenVorn, 'rgba(0,0,0,.2)', 1);
  tonAus();
}
const zweiTon = (nacht, tag, h) => { const a = hexRgb(nacht), b = hexRgb(tag); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * h)},${Math.round(a[1] + (b[1] - a[1]) * h)},${Math.round(a[2] + (b[2] - a[2]) * h)})`; };
function blattwerk(x, y, z, r, blasen, h) {
  const dz = z - cam.z; if (dz < NEAR) return; const k = S.f / dz, o = P(x, y, z), kl = TON.kl; TON.kl = null;
  for (const [dx, dy, f, farbe, nur] of [[-0.06, -0.08, 1, zweiTon('#0c1711', '#35603f', h), 0], [0.05, 0.06, 0.9, zweiTon('#12241a', '#4f8450', h), 0], [0.2, 0.26, 0.42, zweiTon('#183022', '#6fa35f', h), 1]]) {
    ctx.beginPath(); for (const [bx, by, br, licht] of blasen) { if (nur && !licht) continue; const rr = br * r * f * k; ctx.moveTo(o[0] + (bx + dx * br) * r * k + rr, o[1] - (by + dy * br) * r * k); ctx.arc(o[0] + (bx + dx * br) * r * k, o[1] - (by + dy * br) * r * k, rr, 0, 7); }
    ctx.fillStyle = farbe; ctx.fill();
  }
  TON.kl = kl;
}
const KRONE = [[0, 0.05, 1, 0], [-0.9, -0.3, 0.62, 0], [0.86, -0.22, 0.66, 1], [-0.55, 0.55, 0.7, 0], [0.42, 0.7, 0.68, 1], [-0.05, 0.95, 0.5, 1], [0.1, -0.6, 0.6, 0], [-1.2, 0.1, 0.42, 0], [1.22, 0.2, 0.4, 0]], BUSCH = [[0, 0, 1, 1], [-0.7, -0.3, 0.62, 0], [0.72, -0.26, 0.66, 1]];
function strassenDinge(teil) {
  if (cam.z > -4.5) return;
  const W = tagWerte(), h = Math.min(1, W.aussen); tonAn('strasse');
  if (teil === 0) {
    for (const [x, z] of STR.kuebel) {
      poly([[x - 0.5, 0.004, z + 0.3], [x + 0.75, 0.004, z + 0.3], [x + 0.6, 0.004, z - 0.42], [x - 0.5, 0.004, z - 0.42]], 'rgba(0,0,0,.2)');
      box(x - 0.42, x + 0.42, 0, 0.62, z - 0.3, z + 0.3, '#3a3946', '#22212b', '#2b2a35'); fillZ(x - 0.42, x + 0.42, 0.56, 0.62, z - 0.301, '#4a4958');
      blattwerk(x, 0.95, z, 0.42, BUSCH, h);
    }
    { const z = -0.95, lw = lwAt(z, 0.05), b = STR.buegel;
      poly([[b[0] - 0.7, 0.004, z + 0.25], [b[2] + 0.9, 0.004, z + 0.25], [b[2] + 0.75, 0.004, z - 0.3], [b[0] - 0.7, 0.004, z - 0.3]], 'rgba(0,0,0,.14)');
      ctx.beginPath(); for (const x of b) { const p0 = P(x - 0.36, 0, z), p1 = P(x - 0.36, 0.62, z), p2 = P(x + 0.36, 0.62, z), p3 = P(x + 0.36, 0, z), r = (p2[0] - p1[0]) * 0.3; ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1] + r); ctx.quadraticCurveTo(p1[0], p1[1], p1[0] + r, p1[1]); ctx.lineTo(p2[0] - r, p2[1]); ctx.quadraticCurveTo(p2[0], p2[1], p2[0], p2[1] + r); ctx.lineTo(p3[0], p3[1]); }
      ctx.strokeStyle = '#4a4958'; ctx.lineWidth = lw; ctx.stroke();
      const kl = TON.kl; TON.kl = null; const x = b[1] + 0.05, zr = z - 0.14, q = (dx, y) => P(x + dx, y, zr), kk = S.f / (zr - cam.z);
      ctx.beginPath(); for (const dx of [-0.52, 0.52]) { const c = q(dx, 0.34); ctx.moveTo(c[0] + 0.34 * kk, c[1]); ctx.arc(c[0], c[1], 0.34 * kk, 0, 7); } ctx.strokeStyle = zweiTon('#0a0a10', '#23232c', h); ctx.lineWidth = Math.max(1, 0.035 * kk); ctx.stroke();
      ctx.beginPath(); const mv = (pt, an) => { const c = q(pt[0], pt[1]); if (an) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]); };
      mv([-0.52, 0.34], 1); mv([-0.14, 0.34]); mv([-0.3, 0.86]); mv([-0.52, 0.34]); mv([-0.14, 0.34], 1); mv([0.36, 0.84]); mv([-0.3, 0.86]); mv([0.52, 0.34], 1); mv([0.34, 0.98]); mv([0.2, 1.0]); mv([-0.3, 0.86], 1); mv([-0.33, 0.97]); mv([-0.44, 0.97], 1); mv([-0.2, 0.97]);
      ctx.strokeStyle = zweiTon('#3a2f6a', '#7C6BD9', h); ctx.lineWidth = Math.max(1, 0.04 * kk); ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter'; TON.kl = kl;
    }
  } else {
    for (const [x, z, hoch] of STR.baum) {
      const kr = hoch * 0.3;
      poly([[x - 0.75, 0.004, z + 0.6], [x + 0.75, 0.004, z + 0.6], [x + 0.75, 0.004, z - 0.42], [x - 0.75, 0.004, z - 0.42]], '#1a1920');
      if (h > 0.3) { const sx = x - 2.6, n = 12; poly(Array.from({ length: n }, (_, i) => [sx + Math.cos((i / n) * 6.2832) * kr * 1.5, 0.006, z + 0.3 + Math.sin((i / n) * 6.2832) * 0.5]), `rgba(0,0,0,${0.16 * h})`); }
      { const a = P(x - 0.11, 0, z), c = P(x + 0.11, hoch * 0.62, z), kl = TON.kl; TON.kl = null; ctx.fillStyle = zweiTon('#0b0a0c', '#5a4a40', h); ctx.fillRect(a[0], c[1], c[0] - a[0], a[1] - c[1]); ctx.fillStyle = zweiTon('#08080a', '#3d322c', h); ctx.fillRect(a[0], c[1], (c[0] - a[0]) * 0.4, a[1] - c[1]); TON.kl = kl; }
      blattwerk(x, hoch * 0.7, z, kr, KRONE, h);
    }
  }
  tonAus();
}
const LAMP = { x: 3.4, z: -3.05 };
function lamp() {
  const { x, z } = LAMP, lw = lwAt(z, 0.11), col = '#07070b', hx = x - 1.0, hy = 5.28;
  tonAn('strasse'); ctx.globalCompositeOperation = 'lighter';
  poly([[hx - 0.22, hy, z], [hx + 0.22, hy, z], [hx + 1.9, 0, z], [hx - 1.9, 0, z]], lg([0, hy, z], [0, 0, z], [[0, `rgba(${WARM},.06)`], [1, `rgba(${WARM},0)`]]));
  poly([[hx - 1.9, 0.006, z - 0.5], [hx + 1.9, 0.006, z - 0.5], [hx + 1.9, 0.006, z + 2.2], [hx - 1.9, 0.006, z + 2.2]], `rgba(${WARM},.05)`);
  ctx.globalCompositeOperation = 'source-over';
  fillZ(x - 0.13, x + 0.13, 0, 0.55, z, col); seg([x, 0.5, z], [x, 5.35, z], col, lw); seg([x, 5.35, z], [hx - 0.1, 5.5, z], col, lw * 0.75);
  fillZ(hx - 0.32, hx + 0.32, hy + 0.06, hy + 0.2, z, col); fillZ(hx - 0.26, hx + 0.26, hy, hy + 0.07, z, '#fff2e2');
  glow(hx, hy, z, 1.7, [[0, `rgba(${WARM},.6)`], [0.25, `rgba(${WARM},.18)`], [1, `rgba(${WARM},0)`]]);
  tonAus();
}
const WALKERS = [[1.0, 0.8, -1.0, 0.95, 'telefon', 'omar'], [-3.3, -0.7, -1.6, 0.98, null, 'rosa'], [3.0, 1.05, -2.3, 1.02, 'tasche', 'david'], [-2.3, -0.9, -3.0, 1.06, null, 'lea']];
function walkers(t) {
  if (-cam.z > 40 || cam.y - GROUND > 9) return;
  oy = GROUND; const T = STILL ? 0 : t * 0.001;
  const sk = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${Math.round(tagWerte().aussen * 40)}`;
  if (cam.z < -4.5) schicht('strasse0', sk, (() => { const r = imBild([-3.4, 9.9, 0, 1.75, -1.5, -0.2]); return [r[0], r[1], r[2] - r[0], r[3] - r[1]]; })(), () => strassenDinge(0));
  WALKERS.forEach(([x0, v, z, s, prop, wer], i) => {
    const x = ((((x0 + v * T + 18) % 36) + 36) % 36) - 18;
    walkerSetzen(i, menschVon(wer, AKZ.lav), prop, ((x0 + v * T) * Math.sign(v) * Math.PI) / (FIG.SCHRITT_M * 1.1) + i * 2.1 + 1.25, x, z, v > 0 ? Math.PI / 2 : -Math.PI / 2);
  });
  { const p = FIG.steh(T ? gewichtVon(SCHAU_TAKT[0], t, 0.6) : 0.6, 'haengt', 'haengt'); if (T) regen(p, t, SCHAU_TAKT[0]); stelleRuhig('yuki', T ? t : 0, menschVon('yuki', AKZ.lav), p, -1.05, 0, -0.7, 0.12, LICHT.halle, { saum: { farbe: WARM, a: 0.7 } }); }
  if (cam.z < -4.5) schicht('strasse1', sk, (() => { const r = imBild([-13, 11.2, 0, 7.2, -3.8, -2.3]); return [r[0], r[1], r[2] - r[0], r[3] - r[1]]; })(), () => strassenDinge(1));
  lamp();
  oy = 0;
}
function tower() {
  if (cam.z > -NEAR) return;
  oy = 0;
  const d = -cam.z, k = S.f / d, yOf = (Y) => S.cy - (Y - cam.y) * k, xOf = (X) => S.cx + (X - cam.x) * k;
  const X0 = xOf(TXL), X1 = xOf(TXR), W = X1 - X0, fh = FH * k, bw = 1.4 * k, gy = yOf(GROUND), xr = xOf(6.15);
  if (X1 < 0 || X0 > S.w) return;
  const TW = tagWerte(); tonAn('turm');
  const nTop = Math.min(TOP - 1, Math.ceil((cam.y + S.cy / k) / FH) + TOP), nBot = Math.max(0, Math.floor((cam.y - (S.h - S.cy) / k) / FH) + TOP - 1);
  const ksh = S.f / (SHAFT.z - cam.z), sx0 = S.cx + (SHAFT.x0 - cam.x) * ksh, sx1 = S.cx + (SHAFT.x1 - cam.x) * ksh;
  for (let n = nBot; n <= nTop; n++) {
    const yt = yOf(baseOf(n) + FH), open = OPEN.has(n);
    if (open) { ctx.fillStyle = '#0c0c14'; ctx.fillRect(xr, yt, X1 - xr, fh + 1); }
    else {
      ctx.fillStyle = n & 1 ? '#12121c' : '#0f0f18'; ctx.fillRect(X0, yt, W, fh + 1);
      if (fh > 9) {
        ctx.fillStyle = '#1b1b2b'; ctx.fillRect(X0, yt, W, fh * 0.2);
        if (TW.nacht < 0.5) { ctx.fillStyle = `rgba(255,255,255,${0.085 * (1 - TW.nacht * 2)})`; ctx.fillRect(X0, yt + fh * 0.2, W, fh * 0.24); }
        ctx.fillStyle = '#0a0a11'; ctx.fillRect(X0, yt + fh * 0.86, W, Math.max(1, fh * 0.035));
      }
      if (bw > 2.5) for (let b = 0; b < 12; b++) { const r = hash(n, b); if (r < 0.17) { ctx.fillStyle = TW.nacht > 0.5 ? winCol(r * 5.8, (0.05 + r * 0.95) * (fh > 120 ? 0.5 : 1) * TW.nacht) : `rgba(255,255,255,${(0.05 + r * 0.6) * (1 - TW.nacht * 2)})`; ctx.fillRect(X0 + b * bw + bw * 0.1, yt + fh * 0.2, bw * 0.8, fh * 0.66); } }
      if (bw > 5) { ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let b = 1; b < 12; b++) ctx.fillRect(X0 + b * bw, yt, Math.max(1, bw * 0.05), fh); }
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
  for (const F of FLOORS) {
    if (F.roof) continue;
    const hgt = F.n === 0 ? 7.2 : FH, yT = yOf(F.base + hgt), yB = yOf(F.base); if (yB < 0 || yT > S.h) continue;
    ctx.fillStyle = '#07070c'; ctx.fillRect(xOf(-6.15), yT, 0.15 * k, yB - yT); ctx.fillRect(xOf(6), yT, 0.15 * k, yB - yT);
    if (F.n === 0) ctx.fillRect(xOf(-6.15), yT, 12.3 * k, Math.max(1, 0.32 * k));
    for (let x = -4; x <= 4; x += 2) ctx.fillRect(xOf(x - 0.03), yT, Math.max(1, 0.06 * k), yB - yT);
    ctx.fillStyle = '#1a1928'; ctx.fillRect(xOf(-6.15), yB - 0.02 * k, 12.3 * k, Math.max(1, 0.2 * k));
    const ga = clamp01((d - 6) / 22) * 0.34, gx = xOf(-6), gw = 12 * k;
    if (ga > 0.01) { ctx.fillStyle = sgr(gx, yT, gx + gw, yB, [[0, `rgba(214,200,255,${ga * 0.5})`], [0.35, `rgba(160,150,225,${ga * 0.13})`], [1, 'rgba(160,150,225,0)']]); ctx.fillRect(gx, yT, gw, yB - yT); }
    if (F.n === 0 && k > 26) {
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
  if (k > 12 && gy > 0 && gy < S.h + 9 * k) {
    const g0 = xOf(6.15), g1 = X1, yS = yOf(GROUND + 7.2), u = Math.max(1, 0.035 * k);
    ctx.fillStyle = '#16161f'; ctx.fillRect(g0, yS, g1 - g0, gy - yS); ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (let y = 1.2; y < 7.2; y += 1.2) ctx.fillRect(g0, yOf(GROUND + y), g1 - g0, u);
    ctx.fillRect(xOf(8.3), yS, u, gy - yS);
    ctx.fillStyle = '#23222d'; ctx.fillRect(g0, yOf(GROUND + 0.45), g1 - g0, gy - yOf(GROUND + 0.45));
    ctx.fillStyle = '#0a0a11'; ctx.fillRect(xOf(8.7), yOf(GROUND + 5.6), 0.7 * k, 3.6 * k); ctx.fillStyle = TW.nacht > 0.5 ? winCol(0.2, 0.5 * TW.nacht) : `rgba(255,255,255,${0.16 * (1 - TW.nacht * 2)})`; ctx.fillRect(xOf(8.76), yOf(GROUND + 5.54), 0.58 * k, 1.5 * k);
    oy = 0; const vy = GROUND + 3.05, v0 = -2.75, v1 = 0.75, vt = 1.5;
    if (cam.y < vy) { poly([[v0, vy, 0], [v1, vy, 0], [v1, vy, -vt], [v0, vy, -vt]], '#0b0b12'); const a = P(v0 + 0.5, vy, -0.5), b = P(v1 - 0.5, vy, -1.1); ctx.fillStyle = `rgba(${WARM},${0.2 + 0.6 * TW.nacht})`; ctx.fillRect(a[0], Math.min(a[1], b[1]), b[0] - a[0], Math.max(1, Math.abs(b[1] - a[1]))); }
    else poly([[v0, vy + 0.14, 0], [v1, vy + 0.14, 0], [v1, vy + 0.14, -vt], [v0, vy + 0.14, -vt]], '#2c2b39');
    poly([[v0, vy, -vt], [v1, vy, -vt], [v1, vy + 0.14, -vt], [v0, vy + 0.14, -vt]], '#3d3c4e');
    linien([[[v0 + 0.3, vy + 0.14, -vt + 0.1], [v0 + 0.3, vy + 1.25, 0]], [[v1 - 0.3, vy + 0.14, -vt + 0.1], [v1 - 0.3, vy + 1.25, 0]]], '#3d3c4e', Math.max(1, 0.03 * k));
  }
  if (yOf(0.6) < S.h && yOf(-0.4) > -10) {
    ctx.fillStyle = '#07070c'; ctx.fillRect(xOf(TXL - 0.15), yOf(0.28), (TXR - TXL + 0.3) * k, 0.62 * k);
    ctx.fillStyle = `rgba(${LAVH},${0.55 + 0.4 * spots})`; ctx.fillRect(X0, yOf(-0.04), W, Math.max(1, 0.06 * k));
  }
  if (beacon > 0.01) {
    const cxm = (sx0 + sx1) / 2, top = yOf(0), bot = Math.min(S.h, gy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sgr(cxm - 3.2 * k, 0, cxm + 3.2 * k, 0, [[0, `rgba(${LAV},0)`], [0.5, `rgba(${LAV},${0.3 * beacon})`], [1, `rgba(${LAV},0)`]]); ctx.fillRect(cxm - 3.2 * k, top, 6.4 * k, bot - top);
    ctx.fillStyle = `rgba(226,216,255,${0.8 * beacon})`; ctx.fillRect(cxm - Math.max(0.6, 0.14 * k), top, Math.max(1.2, 0.28 * k), bot - top);
    ctx.globalCompositeOperation = 'source-over';
    if (marks > 0.01) for (const F of FLOORS) { ctx.fillStyle = `rgba(239,234,251,${marks})`; ctx.beginPath(); ctx.arc(cxm, yOf(F.base + 1.25), Math.max(2.5, 0.5 * k), 0, 7); ctx.fill(); }
  }
  tonAus();
}
function truss(a, b, off, n) {
  const lw = lwAt((a[2] + b[2]) / 2, 0.055), A2 = [a[0] + off[0], a[1] + off[1], a[2]], B2 = [b[0] + off[0], b[1] + off[1], b[2]], col = '#0a0a11';
  linien([[a, b], [A2, B2]], col, lw); const d = [];
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p = (q, t) => [lerp(q === 0 ? a[0] : A2[0], q === 0 ? b[0] : B2[0], t), lerp(q === 0 ? a[1] : A2[1], q === 0 ? b[1] : B2[1], t), a[2]]; d.push([p(i % 2, t0), p((i + 1) % 2, t1)]); }
  linien(d, col, lw * 0.7);
}
const DACH_GAST = [
  ['hanna', -4.75, 5.4, 90, 'zeigt', [[-4.95, 4.4], [-4.7, 1.2], [-2.4, 0.9]], 31, 0], ['omar', -3.85, 5.6, -90, 'steht', [[-4.45, 4.6], [-4.55, 1.3], [-2.2, 0.95]], 31, 1],
  ['emil', -3.93, 1.95, 90, 'spricht', [[-3.9, 1.2], [-2.2, 0.9]], 32, 0], ['rosa', -3.05, 1.85, -90, 'steht', [[-2.9, 1.2], [-1.8, 0.95]], 32, 1], ['yuki', -3.45, 2.6, 180, 'steht', [[-2.75, 2.5], [-2.5, 1.4], [-1.7, 1.0]]],
];
const DACH_TEAM = [
  ['nora', 1.15, 8.55, 188, 'spricht', [[1.05, 7.4], [0.7, 6.2], [0, 5.9], [0, 2.4], [0.4, 1.5]], 33, 0],
  ['jonas', 3.2, 8.45, 168, 'zeigt', [[3.0, 7.3], [1.4, 6.2], [0.2, 5.9], [0, 2.4], [0.4, 1.5]], 33, 1],
];
const DACH_HOST = ['finn', -1.45, 8.0, 172, 'spricht', [[-1.5, 6.9], [-0.7, 6.1], [0, 5.9], [0, 2.4], [0.4, 1.5]]];
const DACH_PUBLIKUM = ['tom', 'lea', 'ben', 'ida', 'mia', 'karl', 'lina', 'noah', 'david', 'sven', 'mika', 'tara'];
const REIHEN_Z = [5.3, 4.2, 3.1];
function publikumSetzen(sz, z, vor) {
  const id = sz.id, px = sz.px, dz = z - cam.z; if (dz <= 1) return;
  const k = S.f / dz; if (k <= 4) return;
  const LI = LICHT.abend, m = menschVon(pubMensch(id), AKZ.lav), dreh = Math.round((Math.PI + Math.atan2(px - cam.x, dz) + (hash(id, 9) - 0.5) * 0.5) * 4) / 4, auge = cam.y;
  const male = (gg, sx, sy, kk) => FIG.malen(gg, m, FIG.sitz(0.46, m.gr, hash(id, 2) > 0.6 ? 'haelt' : 'schoss', 'schoss'), sx, sy, kk, { dreh, auge, dz, licht: LI, L: LI.L, saum: { farbe: WARM, a: 0.5 } });
  const key = `${dreh}`, kb = Math.min(110, ruheStufe(k * (KAM_STEHT || vor ? 1 : 1.8)));
  if (vor) { if (!VOR_G) { const c = document.createElement('canvas'); c.width = c.height = 8; VOR_G = c.getContext('2d'); } FIG.stempel(VOR_G, 'dach' + id, key, 4, 4, k, male, 1, false, kb); STEMPEL_STAND.set('dach' + id, { key, k: Math.max(kb, k) }); return; }
  const q = P(px, 0, z); stempelRuhig('dach' + id, key, q[0], q[1], k, male, kb);
}
const PUB_FIGUREN = 8;
const pubMensch = (id) => DACH_PUBLIKUM[(id * 5 + Math.floor(id / 6) * 3) % PUB_FIGUREN];
let PUB_VOR = 0, DACH_VOR = 0;
function dachVorab() {
  const lauf = (fn) => { kamera(ansicht(DACH_SZ)); KAM_STEHT = true; const o0 = oy; oy = 0; try { fn(); } catch (e) { console.error(e); } finally { oy = o0; const v = ansicht(sS.v); kamera(v); if (NAH) S.f *= 1 + NAH; raumBlick(); KAM_SIG = ''; } };
  const gez = () => (MESS.vorgezeichnet || 0) + (MESS.ruhebilder || 0) + (FIG.stempel.neu || 0);
  const weiter = () => {
    if (!VOR.length || !warmFuer.startsWith('dach|') || ORT.lage >= DACH_SZ - 0.02 || ORT.lage < 6 || bildMP > BILD.MP[STUFE]) return;
    lauf(() => { const g0 = gez(), t0 = performance.now(); while (VOR.length && gez() === g0 && performance.now() - t0 < 2.5) VOR.shift()(); });
    LEER.push(weiter);
  };
  LEER.push(() => { if (ORT.lage >= DACH_SZ - 0.02 || ORT.lage < 6) return; lauf(() => vorwaermen(RAUM.dach, null)); LEER.push(weiter); });
}
function publikumVor() {
  for (const sz of DACH_SITZE) if (sz.da) LEER.push(() => {
    kamera(ansicht(DACH_SZ)); KAM_STEHT = true;
    try { publikumSetzen(sz, REIHEN_Z[sz.row], true); } finally { const v = ansicht(sS.v); kamera(v); if (NAH) S.f *= 1 + NAH; raumBlick(); KAM_SIG = ''; }
  });
}
const SITZ_F = new Map();
const DACH_SITZE = (() => { const r = []; [5.3, 4.2, 3.1].forEach((z, row) => { for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const x = side * (0.95 + i * 1.04), id = row * 6 + i * 2 + (side > 0 ? 1 : 0); if (row === 2 && side > 0 && i === 0) continue; r.push({ x, z, id, row, side, px: x + (hash(id, 5) - 0.5) * 0.14, da: hash(id, 41) > 0.12 }); } }); return r; })();
(() => {
  const st = RAUM.dach; if (!st) return;
  const bau = (l, d, n, boden, verz) => { const f = personBauen(st, l, { mensch: d[0], platz: [d[1], d[2]], blick: d[3], haltung: d[4], boden, tasche: false, gespraech: d[6], teil: d[7] }, n, d[5]); f.blende = 2.4; f.stufe = boden ? [2.0, 0.7] : null; f.verz = verz; return f; };
  const a = st.nach.abend, b = st.nach.abendpartner;
  if (a) {
    DACH_GAST.forEach((d, n) => a.leute.push(bau(a, d, n, 0, 30 + n * 50)));
    a.leute.push(bau(a, DACH_HOST, 5, STAGE.y, 90)); a.leute[a.leute.length - 1].pult = true;
    for (const sz of DACH_SITZE) {
      if (!sz.da) continue; const gang = sz.side * 0.3, w = [[sz.px, sz.z - 0.62], [gang, sz.z - 0.62], [gang, 2.6], [gang * 0.6, 1.9]];
      const f = personBauen(st, a, { mensch: pubMensch(sz.id), platz: [sz.px, sz.z], blick: 0, haltung: 'sitzt', boden: 0, tasche: false }, 6 + sz.id, w);
      f.blende = 1.5; f.verz = (2 - sz.row) * 70 + hash(sz.id, 3) * 260; f.tA = 420; f.sitz = sz; f.stempel = true; a.leute.push(f); SITZ_F.set(sz.id, f);
    }
    a.dauer = Math.max(...a.leute.map((f) => f.verz + f.tA + f.tW));
  }
  if (b) { DACH_TEAM.forEach((d, n) => b.leute.push(bau(b, d, n, STAGE.y, 40 + n * 160))); b.dauer = Math.max(...b.leute.map((f) => f.verz + f.tA + f.tW)); }
})();
function terrace(t, teil = 0) {
  if (S.f / Math.max(1, 4 - cam.z) < 6.5) return;
  const rail = 'rgba(205,192,255,.28)', dark = '#07070c', LI = LICHT.abend, list = [], dazu = (z, fn) => list.push({ z, fn });
  const kette = smooth((TZ - 0.82) / 0.1), strahl = smooth((TZ - 0.88) / 0.09);
  if (teil !== 2) {
  const chain = (A, B, sag, n) => {
    const at = (u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u) - sag * Math.sin(Math.PI * u), lerp(A[2], B[2], u)];
    { const s = []; for (let i = 0; i < n; i++) s.push([at(i / n), at((i + 1) / n)]); linien(s, 'rgba(10,10,16,.9)', 1); }
    if (kette < 0.01) { ctx.fillStyle = 'rgba(40,36,48,.9)'; ctx.beginPath(); for (let i = 1; i < n; i++) { const q = at(i / n), s = P(q[0], q[1], q[2]), r = Math.max(1.3, (0.075 * S.f) / (q[2] - cam.z)); ctx.moveTo(s[0] + r, s[1]); ctx.arc(s[0], s[1], r, 0, 7); } ctx.fill(); return; }
    for (let i = 1; i < n; i++) { const q = at(i / n), s = P(q[0], q[1], q[2]), r = Math.max(1.3, (0.075 * S.f) / (q[2] - cam.z)), an = clamp01((kette - i / n * 0.5) * 2);
      if (an > 0.02) { ctx.fillStyle = `rgba(${WARM},${0.13 * an})`; ctx.beginPath(); ctx.arc(s[0], s[1], r * 2.4, 0, 7); ctx.fill(); } ctx.fillStyle = an > 0.02 ? `rgba(255,243,224,${0.25 + 0.75 * an})` : 'rgba(40,36,48,.9)'; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.fill(); }
  };
  for (const [x, z] of [[-6.1, 0.8], [10.1, 0.8]]) { seg([x, 0, z], [x, 3.6, z], dark, lwAt(z, 0.07)); }
  chain([-6.1, 3.6, 0.8], [-TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 0.9, 15); chain([10.1, 3.6, 0.8], [TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 1.1, 18);
  dachFest(2);
  }
  if (teil === 1) return;
  const gk = AKT.F && AKT.F.roof ? AKT.k : 0, stD = RAUM.dach, g = [gk * da('dach', 'abend') * strahl, gk * da('dach', 'abendpartner') * strahl], tt = reduce ? 0 : t;
  const steht = (m, x, y, z, grad, p, extra) => stelleMensch(menschVon(m, AKZ.lav), p, x, y, z, rad(grad), LI, extra);
  dazu(9.6, () => {
    const a = g[1]; oy = STAGE.y;
    for (const x of [2.32, 3.28]) seg([x, 0, 9.6], [x, 0.32, 9.6], dark, lwAt(9.6, 0.05));
    const tf = fillZ(2.2, 3.4, 0.3, 2.35, 9.6, mischRgb([44, 40, 62], [233, 229, 242], a));
    if (tf) {
      const [rx, ry, rw, rh] = tf; ctx.strokeStyle = `rgba(59,42,120,${0.25 + 0.5 * a})`; ctx.lineWidth = Math.max(1, rw * 0.018); ctx.setLineDash([rw * 0.07, rw * 0.05]);
      ctx.strokeRect(rx + rw * 0.14, ry + rh * 0.14, rw * 0.72, rh * 0.4); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(59,42,120,${0.1 + 0.08 * a})`; ctx.fillRect(rx + rw * 0.14, ry + rh * 0.66, rw * 0.72, rh * 0.05); ctx.fillRect(rx + rw * 0.14, ry + rh * 0.76, rw * 0.46, rh * 0.05);
      if (a < 0.95) { ctx.strokeStyle = `rgba(205,192,255,${0.85 * (1 - a)})`; ctx.lineWidth = Math.max(1.5, rw * 0.012); ctx.setLineDash([rw * 0.05, rw * 0.035]); ctx.strokeRect(rx - rw * 0.03, ry - rw * 0.03, rw * 1.06, rh + rw * 0.06); ctx.setLineDash([]); }
    }
    glow(2.8, 1.4, 9.55, 2.4, [[0, `rgba(${WARM},${0.22 * a})`], [1, `rgba(${WARM},0)`]]);
    oy = 0;
  });
  dazu(8.9, () => {
    const a = g[1], x = 2.0, z = 8.9; oy = STAGE.y;
    seg([x, 0, z], [x, 1.05, z], dark, lwAt(z, 0.06)); fillZ(x - 0.26, x + 0.26, 0, 0.04, z, dark);
    box(x - 0.4, x + 0.4, 1.05, 1.1, z - 0.32, z + 0.32, mischRgb([60, 56, 80], [138, 136, 160], a), '#262532', '#2b2a38');
    fillZ(x - 0.3, x - 0.12, 1.1, 1.34, z - 0.04, mischRgb([50, 46, 70], [239, 234, 248], a)); fillZ(x + 0.05, x + 0.34, 1.1, 1.18, z - 0.2, mischRgb([60, 50, 100], [95, 75, 182], a));
    glow(x, 1.25, z, 1.1, [[0, `rgba(${WARM},${0.4 * a})`], [1, `rgba(${WARM},0)`]]);
    if (a < 0.95) { const o = rectZ(x - 0.45, x + 0.45, 0, 1.12, z - 0.34); if (o) { ctx.strokeStyle = `rgba(205,192,255,${0.8 * (1 - a)})`; ctx.lineWidth = 1.8; ctx.setLineDash([7, 5]); ctx.strokeRect(o[0], o[1], o[2], o[3]); ctx.setLineDash([]); } }
    oy = 0;
  });
  dazu(9.9, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, k, tx] of [[-2.9, g[0], -3.0], [0, g[0], -0.5], [2.9, g[1], 2.6]]) { if (k < 0.02) continue; poly([[lx - 0.06, TRUSS.h - 0.3, TRUSS.z], [lx + 0.06, TRUSS.h - 0.3, TRUSS.z], [tx + 1.2, STAGE.y, 8.2], [tx - 1.2, STAGE.y, 8.2]], lg([lx, TRUSS.h, TRUSS.z], [tx, STAGE.y, 8.2], [[0, `rgba(${WARM},${0.28 * k})`], [1, `rgba(${WARM},${0.05 * k})`]])); }
    ctx.globalCompositeOperation = 'source-over';
  });
  dazu(9, () => { oy = STAGE.y; ctx.globalCompositeOperation = 'lighter'; poly([[-4.2, 0.004, 6.6], [0.6, 0.004, 6.6], [0.6, 0.004, 9.4], [-4.2, 0.004, 9.4]], `rgba(${WARM},${0.03 + 0.1 * g[0]})`); poly([[1.0, 0.004, 7.6], [3.9, 0.004, 7.6], [3.9, 0.004, 9.4], [1.0, 0.004, 9.4]], `rgba(${WARM},${0.02 + 0.14 * g[1]})`); ctx.globalCompositeOperation = 'source-over'; oy = 0; });
  dazu(7.8, () => { oy = STAGE.y; box(-2.75, -2.05, 0, 1.15, 7.35, 7.8, '#8f8da6', lg([0, 1.15, 7.35], [0, 0, 7.35], [[0, '#55536a'], [1, '#262532']]), '#34323f');
    linien([[[-2.2, 1.15, 7.5], [-2.2, 1.4, 7.5]], [[-2.2, 1.4, 7.5], [-2.08, 1.52, 7.5]]], '#0a0a11', lwAt(7.5, 0.022)); fillZ(-2.1, -2.02, 1.5, 1.57, 7.5, '#0a0a11');
 glow(-2.2, 1.5, 7.6, 2.6, [[0, `rgba(${WARM},${0.04 + 0.18 * g[0]})`], [1, `rgba(${WARM},0)`]]); oy = 0; });
  const tisch = (x, z) => { seg([x, 0, z], [x, 1.08, z], dark, lwAt(z, 0.07)); fillZ(x - 0.28, x + 0.28, 0, 0.04, z, dark); box(x - 0.34, x + 0.34, 1.08, 1.13, z - 0.34, z + 0.34, '#8a88a0', '#262532', '#2b2a38'); fillZ(x - 0.03, x + 0.03, 1.13, 1.22, z, '#fff3e0'); glow(x, 1.2, z, 0.75, [[0, `rgba(${WARM},${0.5 * kette})`], [1, `rgba(${WARM},0)`]]); };
  const thementisch = (x, z) => {
    if (g[0] > 0.02) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 1.5, 0.005, z - 1.2], [x + 1.5, 0.005, z - 1.2], [x + 1.25, 0.005, z + 1.3], [x - 1.25, 0.005, z + 1.3]], `rgba(${WARM},${0.1 * g[0]})`); ctx.globalCompositeOperation = 'source-over'; glow(x, 1.3, z, 2.1, [[0, `rgba(${WARM},${0.2 * g[0]})`], [1, `rgba(${WARM},0)`]]); }
    tisch(x, z);
    if (g[0] > 0.02) { ctx.globalAlpha = g[0]; fillZ(x + 0.08, x + 0.3, 1.13, 1.42, z - 0.05, '#efeaf8'); fillZ(x + 0.11, x + 0.27, 1.33, 1.37, z - 0.06, '#5F4BB6'); fillZ(x + 0.11, x + 0.24, 1.24, 1.27, z - 0.06, 'rgba(38,36,51,.4)'); ctx.globalAlpha = 1; }
  };
  for (const d of DT) dazu(d[1] + 0.02, () => thementisch(d[0], d[1]));
  const kamKey = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}`;
  [5.3, 4.2, 3.1].forEach((z, r) => dazu(z, () => {
    const sitze = DACH_SITZE.filter((sz) => sz.row === r), sitzt = sitze.map((sz) => { const fs = SITZ_F.get(sz.id); return sz.da && !(fs && wo(fs).q > 0); });
    const a = P(-3.5, 1.5, z + 0.25), b = P(3.5, 0, z - 0.32), c = P(-3.5, 0, z - 0.32), d = P(3.5, 1.5, z + 0.25), x0 = Math.min(a[0], c[0]) - 6, x1 = Math.max(b[0], d[0]) + 6;
    const rect = [x0, a[1] - 6, x1 - x0, b[1] - a[1] + 12];
    schicht('reiheA' + r, kamKey, rect, () => { for (const sz of sitze) box(sz.x - 0.24, sz.x + 0.24, 0.43, 0.47, z - 0.24, z + 0.2, '#4a4860', '#22212c', '#262532'); });
    sitze.forEach((sz, n) => {
      if (!sitzt[n]) return;
      publikumSetzen(sz, z, false);
    });
    schicht('reiheB' + r, kamKey, rect, () => { for (const sz of sitze) { box(sz.x - 0.24, sz.x + 0.24, 0.5, 0.88, z - 0.27, z - 0.22, '#4a4860', '#22212c', '#262532'); fillZ(sz.x - 0.24, sz.x + 0.24, 0.855, 0.88, z - 0.271, `rgba(${WARM},.22)`); } });
  }));
  dazu(1.9, () => tripod(1.2, 1.9, 1.6));
  const amPlatz = [];
  if (stD) for (const l of stD.L) {
    const leer = smooth((l.u * l.dauer - 250) / 500);
    for (const f of l.leute) {
      const zs = wo(f); if (!zs.fort && zs.q <= 0 && !f.stempel) amPlatz.push(f);
      if (leer > 0.02 && !f.stempel) dazu(f.z + 0.002, () => umrissMalen(f, leer * 0.75, "167,139,250"));
      if (zs.fort || (f.stempel && zs.q <= 0)) continue;
      dazu(zs.z + (f.stempel ? 0.3 : 0), () => { const fern = f.w.len - zs.s; if (fern < f.blende) ctx.globalAlpha = smooth(fern / f.blende); maleMensch(f, zs, t, LI, WARM, 0); ctx.globalAlpha = 1; });
    }
  }
  if (stD) ruhePflegen(stD, amPlatz, gk > 0.9);
  list.sort((a, b) => b.z - a.z); for (const it of list) it.fn();
  if (stD && gk > 0) { const a = stD.nach.abend, b = stD.nach.abendpartner; if (a) { merke(a, a.x, a.z, a.hoch || 2.2, 1.3); merke(a, 0, 4.2, 1.5, 2.6, true); merke(a, -1.45, 8.0, 2.35 + STAGE.y, 0.6, true); } if (b) { oy = STAGE.y; merke(b, b.x, b.z, (b.hoch || 2.7) - STAGE.y, 0.7); oy = 0; } }
}
let AUSSEN_FEIN = false;
const DACHD = { wand: [-2.3, 2.3, 4.05, 10.45], boxen: [-4.2, 4.2], kuebel: [[-5.7, 11.9, 1.1], [5.7, 11.9, 1.1], [-5.35, 6.0, 0.9]], bar: [-4.45, -2.7, 12.2, 12.8], steh: [[4.45, 12.4], [-5.3, 3.7]] };
function dachFest(schritt) {
  const dark = '#07070c', h = Math.min(1, tagWerte().aussen), F = AUSSEN_FEIN, kette = smooth((TZ - 0.82) / 0.1);
  const stehtisch = ([x, z]) => {
    seg([x, 0, z], [x, 1.08, z], dark, lwAt(z, 0.07)); fillZ(x - 0.28, x + 0.28, 0, 0.04, z, dark); box(x - 0.34, x + 0.34, 1.08, 1.13, z - 0.34, z + 0.34, '#8a88a0', '#262532', '#2b2a38'); fillZ(x - 0.03, x + 0.03, 1.13, 1.22, z, '#fff3e0');
    if (kette > 0.01) glow(x, 1.2, z, 0.75, [[0, `rgba(${WARM},${0.5 * kette})`], [1, `rgba(${WARM},0)`]]);
    if (F) { fillZ(x + 0.12, x + 0.19, 1.13, 1.26, z - 0.1, 'rgba(236,230,255,.45)'); fillZ(x - 0.22, x - 0.15, 1.13, 1.26, z + 0.05, 'rgba(236,230,255,.4)'); }
  };
  const kuebel = ([x, z, gr]) => { poly([[x - 0.5, 0.004, z + 0.3], [x + 0.6, 0.004, z + 0.3], [x + 0.5, 0.004, z - 0.4], [x - 0.5, 0.004, z - 0.4]], 'rgba(0,0,0,.22)'); box(x - 0.36, x + 0.36, 0, 0.7, z - 0.3, z + 0.3, '#3a3946', '#1d1c26', '#262531'); if (F) fillZ(x - 0.36, x + 0.36, 0.64, 0.7, z - 0.301, '#4a4958'); blattwerk(x, 1.0 + 0.1 * gr, z, 0.44 * gr, BUSCH, h); };
  if (schritt === 0) {
    const pf = [], hl = [[[TXL, 1.05, RD], [TXR, 1.05, RD]], [[TXL + 0.05, 1.05, 0.3], [TXL + 0.05, 1.05, RD]], [[TXR - 0.05, 1.05, 0.3], [TXR - 0.05, 1.05, RD]]];
    for (let x = TXL; x <= TXR + 0.01; x += 1.4) pf.push([[x, 0, RD], [x, 1.05, RD]]); for (const x of [TXL + 0.05, TXR - 0.05]) for (let z = 0.3; z < RD; z += 1.4) pf.push([[x, 0, z], [x, 1.05, z]]);
    flaechen([[[TXL, 0.08, RD], [TXR, 0.08, RD], [TXR, 1.0, RD], [TXL, 1.0, RD]], [[TXL + 0.05, 0.08, 0.3], [TXL + 0.05, 0.08, RD], [TXL + 0.05, 1.0, RD], [TXL + 0.05, 1.0, 0.3]], [[TXR - 0.05, 0.08, 0.3], [TXR - 0.05, 0.08, RD], [TXR - 0.05, 1.0, RD], [TXR - 0.05, 1.0, 0.3]]], 'rgba(205,192,255,.07)');
    linien(pf, 'rgba(205,192,255,.28)', 1); linien(hl, 'rgba(226,218,255,.6)', 1.5);
    kuebel(DACHD.kuebel[0]); kuebel(DACHD.kuebel[1]);
    { const [x0, x1, z0, z1] = DACHD.bar;
      box(x0, x1, 0, 1.06, z0, z1, '#8a88a0', lg([0, 1.06, z0], [0, 0, z0], [[0, '#3a3848'], [1, '#1f1e2a']]), '#262531');
      box(x0 - 0.06, x1 + 0.06, 1.06, 1.13, z0 - 0.06, z1 + 0.05, '#b9b6c8', '#6a6880', '#55536a');
      fillZ(x0, x1, 0.98, 1.04, z0 - 0.01, `rgba(${WARM},${0.3 + 0.6 * kette})`);
      const fl = [], gl = []; for (let i = 0; i < 7; i++) { const x = x0 + 0.16 + i * 0.235, z = z0 + 0.22 + (i % 2) * 0.16, hh = i % 3 === 0 ? 0.36 : 0.3; fl.push([[x - 0.045, 1.13, z], [x + 0.045, 1.13, z], [x + 0.045, 1.13 + hh * 0.7, z], [x + 0.016, 1.13 + hh, z], [x - 0.016, 1.13 + hh, z], [x - 0.045, 1.13 + hh * 0.7, z]]); if (i < 6) gl.push([[x + 0.08, 1.13, z - 0.1], [x + 0.15, 1.13, z - 0.1], [x + 0.16, 1.26, z - 0.1], [x + 0.07, 1.26, z - 0.1]]); }
      roh(() => { flaechen(fl, zweiTon('#16241e', '#2f5a48', h)); flaechen(gl, `rgba(236,230,255,${0.3 + 0.25 * h})`); });
      if (F) { const s = []; for (let x = x0 + 0.25; x < x1; x += 0.25) s.push([[x, 0.06, z0 - 0.002], [x, 0.98, z0 - 0.002]]); linien(s, 'rgba(0,0,0,.25)', 1); glow((x0 + x1) / 2, 1.3, z0, 1.7, [[0, `rgba(${WARM},${0.2 * kette})`], [1, `rgba(${WARM},0)`]]); }
    }
    stehtisch(DACHD.steh[0]);
    { const [x0, x1, y1, z] = DACHD.wand, y0 = STAGE.y + 0.12; oy = 0;
      linien([[[x0, STAGE.y, z], [x0, y1 + 0.1, z]], [[x1, STAGE.y, z], [x1, y1 + 0.1, z]], [[x0, y1 + 0.1, z], [x1, y1 + 0.1, z]]], '#0a0a11', lwAt(z, 0.06));
      const r = fillZ(x0 + 0.06, x1 - 0.06, y0, y1, z - 0.01, '#15141f');
      if (r) roh(() => { const u = r[2]; ctx.fillStyle = zweiTon('#3b2a78', '#8B5CF6', 0.35 + 0.65 * h); ctx.beginPath(); ctx.arc(r[0] + u * 0.3, r[1] + r[3] * 0.24, u * 0.07, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(246,244,240,${0.55 + 0.2 * h})`; ctx.fillRect(r[0] + u * 0.42, r[1] + r[3] * 0.2, u * 0.3, r[3] * 0.035); ctx.fillStyle = `rgba(246,244,240,${0.3 + 0.1 * h})`; ctx.fillRect(r[0] + u * 0.42, r[1] + r[3] * 0.27, u * 0.2, r[3] * 0.026);
        if (F) { ctx.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 1; i < 6; i++) ctx.fillRect(r[0] + (u * i) / 6, r[1], Math.max(1, u * 0.004), r[3]); } }); }
    return;
  }
  if (schritt === 1) {
    oy = STAGE.y;
    { const d = []; for (let x = STAGE.x0 + 0.46; x < STAGE.x1; x += 0.46) d.push([[x, 0.004, STAGE.z0], [x, 0.004, STAGE.z1]]); linien(d, 'rgba(0,0,0,.22)', 1); }
    for (const x of DACHD.boxen) { box(x - 0.27, x + 0.27, 0, 1.2, 6.6, 7.0, '#33323f', '#111118', '#1a1922'); const a = P(x, 0.82, 6.6), b = P(x, 0.32, 6.6), k = S.f / (6.6 - cam.z); ctx.fillStyle = '#26252f'; ctx.beginPath(); ctx.arc(a[0], a[1], 0.12 * k, 0, 7); ctx.moveTo(b[0] + 0.19 * k, b[1]); ctx.arc(b[0], b[1], 0.19 * k, 0, 7); ctx.fill();
      if (F) { ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(a[0], a[1], 0.05 * k, 0, 7); ctx.moveTo(b[0] + 0.09 * k, b[1]); ctx.arc(b[0], b[1], 0.09 * k, 0, 7); ctx.fill(); fillZ(x - 0.27, x - 0.24, 0, 1.2, 6.599, 'rgba(255,255,255,.08)'); } }
    oy = 0;
    box(-0.75, 0.75, 0, STAGE.y / 2, STAGE.z0 - 0.42, STAGE.z0, '#2c2a3a', '#12121a', '#191822');
    kuebel(DACHD.kuebel[2]);
    return;
  }
  stehtisch(DACHD.steh[1]);
}
let roofT = 0;
function roof(p, t = 0, teil = 0) {
  oy = 0; roofT = t;
  const yEdge = cam.z < -NEAR ? P(0, 0, 0)[1] : S.h; if (yEdge < 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.w, yEdge + 1); ctx.clip();
  tonAn('dach');
  const lamps = [-2.9, 0, 2.9], LY = TRUSS.h - 0.28;
  if (teil !== 2) {
  if (cam.y > 0.02) {
    poly([[TXL, 0, 0], [TXR, 0, 0], [TXR, 0, RD], [TXL, 0, RD]], lg([0, 0, 0], [0, 0, RD], [[0, '#14141d'], [1, '#1d1c29']]));
    { const f = []; for (let z = 2; z < RD; z += 2) f.push([[TXL, 0, z], [TXR, 0, z]]); if (AUSSEN_FEIN) for (let x = TXL + 1.2; x < TXR; x += 1.2) f.push([[x, 0, 0.35], [x, 0, RD]]); linien(f, 'rgba(0,0,0,.25)', 1); }
    poly([[TXL, 0.004, 0], [TXR, 0.004, 0], [TXR, 0.004, 0.35], [TXL, 0.004, 0.35]], '#0b0b12');
  }
  const hh = rectZ(SHAFT.x0, SHAFT.x1, 0, 2.7, SHAFT.z);
  if (hh) { ctx.fillStyle = `rgba(${LAV},.05)`; ctx.fillRect(hh[0], hh[1], hh[2], hh[3]); ctx.strokeStyle = `rgba(${LAV},.4)`; ctx.lineWidth = lwAt(SHAFT.z, 0.04); ctx.strokeRect(hh[0], hh[1], hh[2], hh[3]); }
  if (spots > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    lamps.forEach((lx, i) => {
      const on = clamp01(spots * 3 - i * 0.7), A = P(lx, LY, TRUSS.z), ang = (i - 1) * 0.5, len = S.h * 1.3;
      const B = [A[0] + Math.sin(ang) * len, A[1] - Math.cos(ang) * len], nx = Math.cos(ang), ny = Math.sin(ang);
      if (on <= 0) return;
      for (const [wEnd, a] of [[len * 0.13, 0.3], [len * 0.085, 0.3], [len * 0.04, 0.34]]) {
        const g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]); g.addColorStop(0, `rgba(${LAVH},${a * on})`); g.addColorStop(0.3, `rgba(${LAV},${a * 0.5 * on})`); g.addColorStop(1, `rgba(${LAV},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(A[0] - nx * 2, A[1] - ny * 2); ctx.lineTo(B[0] - nx * wEnd, B[1] - ny * wEnd); ctx.lineTo(B[0] + nx * wEnd, B[1] + ny * wEnd); ctx.lineTo(A[0] + nx * 2, A[1] + ny * 2); ctx.closePath(); ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    glow(0, STAGE.y + 1.2, STAGE.zc, 9, [[0, `rgba(${LAV},${0.22 * spots})`], [1, `rgba(${LAV},0)`]]);
  }
  dachFest(0);
  truss([-TRUSS.x, 0, TRUSS.z], [-TRUSS.x, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9); truss([TRUSS.x - 0.38, 0, TRUSS.z], [TRUSS.x - 0.38, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9);
  truss([-TRUSS.x, TRUSS.h, TRUSS.z], [TRUSS.x, TRUSS.h, TRUSS.z], [0, 0.45, 0], 16);
  box(STAGE.x0, STAGE.x1, 0, STAGE.y, STAGE.z0, STAGE.z1, lg([0, STAGE.y, STAGE.z0], [0, STAGE.y, STAGE.z1], [[0, '#2c2a3a'], [1, '#201f2c']]), '#12121a', '#191822');
  fillZ(STAGE.x0, STAGE.x1, STAGE.y - 0.1, STAGE.y - 0.04, STAGE.z0 - 0.01, `rgba(${LAVH},${0.3 + 0.65 * spots})`);
  if (spots > 0.01) { ctx.globalCompositeOperation = 'lighter'; poly([[STAGE.x0, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z1], [STAGE.x0, STAGE.y + 0.004, STAGE.z1]], `rgba(${LAV},${0.16 * spots})`); ctx.globalCompositeOperation = 'source-over'; }
  dachFest(1);
  if (cam.y > STAGE.y) { const c = P(0, STAGE.y + 0.006, STAGE.zc), rx = (0.75 * S.f) / (STAGE.zc - cam.z), ry = Math.abs(P(0, STAGE.y, STAGE.zc - 0.75)[1] - P(0, STAGE.y, STAGE.zc + 0.75)[1]) / 2; ctx.strokeStyle = `rgba(${LAVH},${0.45 + 0.4 * spots})`; ctx.lineWidth = lwAt(STAGE.zc, 0.03); ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, Math.max(0.5, ry), 0, 0, 7); ctx.stroke(); }
  }
  if (p >= floorRange(HALTS - 2)[1] - 0.03) terrace(roofT, teil);
  if (teil !== 2) lamps.forEach((lx, i) => {
    const on = clamp01(spots * 3 - i * 0.7), q = P(lx, LY, TRUSS.z), r = (0.3 * S.f) / (TRUSS.z - cam.z);
    seg([lx, TRUSS.h, TRUSS.z], [lx, LY, TRUSS.z], '#0a0a11', lwAt(TRUSS.z, 0.05));
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.5, r), 0, 7); ctx.fill();
    ctx.fillStyle = on > 0 ? `rgba(246,240,255,${0.3 + 0.7 * on})` : '#252432'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, r * 0.62), 0, 7); ctx.fill();
    if (on > 0) glow(lx, LY, TRUSS.z, 1.8, [[0, `rgba(${LAVH},${0.8 * on})`], [0.3, `rgba(${LAV},${0.3 * on})`], [1, `rgba(${LAV},0)`]]);
  });
  tonAus(); ctx.restore();
}
const goldAnteil = (tz) => smooth((tz - 0.44) / 0.16) * (1 - smooth((tz - 0.7) / 0.1));
function markenLicht() {
  { const gold = INS.k * goldAnteil(TZ); if (gold > 0.01 && INS.F) { const w = S.w, hh = S.h; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,214,168,${0.4 * gold})`; ctx.fillRect(0, 0, w, hh);
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(w, hh * 0.2, w * 0.3, hh * 0.8); g.addColorStop(0, `rgba(255,170,90,${0.26 * gold * (0.4 + 0.6 * smooth((gold - 0.5) / 0.4))})`);  g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); ctx.globalCompositeOperation = 'source-over'; } }
  const k = INS.k * (1 - 0.88 * tagWerte().innen); if (k <= 0.01 || !INS.F) return; const MK = MARKE[INS.F.key], w = S.w, hh = S.h;
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(${MK.tief},${(MK.licht || 0.42) * k})`; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w * 0.58, hh * 0.18, 0, w * 0.58, hh * 0.18, Math.max(w, hh) * 0.85);
  g.addColorStop(0, `rgba(${MK.rgb},${(MK.schein ?? 0.11) * k})`); g.addColorStop(1, `rgba(${MK.rgb},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'source-over';
}
const RUHEBILD = { c: null, g: null, key: '', dinge: null, zuvor: '', seit: 0, tz: 1, f: 0, p: 0, t: 0 };
const RUHE2 = { c: null, g: null, key: '', tz: 1, schritt: -1, schritte: 3, art: '', innen: false, dinge: null, eng: 0, p: 0, t: 0 };
const TAG_STUFEN = [1];
const TAG_RUHIG = 0.93;
const DAEMM_VOR = 900, DAEMM_DAUER = 9500;
const FINALE_AB = 0.9;
const BLENDE_MS = 280;
const RUHE_AB = 260;
const TZ_FEST = QUERY.has('tz') ? clamp01(+QUERY.get('tz')) : null;
let DAEMM = 0, DAEMM_T = 0, DAEMM_WARTET = false;
function ruheSchluessel(F) {
  if (F.key === 'strasse') return STILL ? '' : `strasse|${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}`;
  const st = RAUM[F.key]; if (!st || STILL || (!st.tuer && !F.roof)) return '';
  return `${F.key}|${cam.x}|${cam.y}|${cam.z}|${F.roof ? 0 : S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}|${TEX.web0 ? 1 : 0}`;
}
function ruheSetzen(c, f) { const k = f > 0 ? S.f / f : 1; if (Math.abs(k - 1) < 1e-5) ctx.drawImage(c, 0, 0); else ctx.drawImage(c, S.cx * (1 - k), S.cy * (1 - k), S.w * k, S.h * k); }
const DST = { key: '', fertig: false, c: null, g: null, schritt: 0, p: 0, t: 0, f: 0, eng: 0 };
function daemmBau() {
  const D = DST, R = RUHEBILD, B = RUHE2; if (!D.key || D.fertig || D.key !== R.key || !KAM_STEHT || (B.schritt >= 0 && B.schritt < B.schritte)) return false;
  if (D.schritt >= 3) {
    if (!D.c) { D.c = document.createElement('canvas'); D.g = D.c.getContext('2d'); }
    const w = Math.ceil(S.w / 2), h = Math.ceil(S.h / 2); if (D.c.width !== w || D.c.height !== h) { D.c.width = w; D.c.height = h; } else D.g.clearRect(0, 0, w, h);
    D.g.drawImage(B.c, 0, 0, w, h);
    ctxBild.save(); ctxBild.setTransform(1, 0, 0, 1, 0, 0); ctxBild.globalCompositeOperation = 'source-over'; ctxBild.globalAlpha = 0.004; ctxBild.drawImage(D.c, 0, 0, 32, 32, 0, 0, 32, 32); ctxBild.restore();
    D.fertig = true; sceneDirty = true; return true;
  }
  const frisch = flaeche(B), c0 = ctx, tz0 = TZ, n = HOT.length, d0 = DINGE, f0 = S.f;
  ctx = B.g; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; if (D.schritt === 0 && !frisch) ctx.clearRect(0, 0, S.w, S.h);
  TZ = 1; S.f = D.f;
  try { AUSSEN_FEIN = true; aussenMalen(D.p, D.t, 1, D.schritt); } finally { AUSSEN_FEIN = false; ctx = c0; TZ = tz0; S.f = f0; TON.kl = null; oy = 0; HOT.length = n; DINGE = d0; }
  D.schritt++; return true;
}
const SHADE = document.querySelector('.seq-shade'); let SHADE_O = -1;
let PFAD = '', NOCHMAL = false, KAM_SIG = '', KAM_STEHT = false, STEMPEL_FREI = 0;
let TEIL_T = 0; const teil = (n) => { const z = MESS.z; if (!z) return; const t = performance.now(); if (n) z.akt.teile = (z.akt.teile || '') + n + (t - TEIL_T).toFixed(1) + ' '; TEIL_T = t; };
const STEMPEL_STAND = new Map();
function stempelRuhig(name, schluessel, x, y, k, male, kb = 0) {
  const alt = STEMPEL_STAND.get(name), grob = !!alt && !!kb && k > alt.k * (KAM_STEHT ? 1.02 : 1.35);
  if (!alt || alt.key !== schluessel || grob) {
    if (STEMPEL_FREI > 0 && (!alt || grob || (kb ? KAM_STEHT && alt.key !== schluessel : KAM_STEHT || k > alt.k * 1.35 || k < alt.k * 0.5))) { STEMPEL_FREI--; STEMPEL_STAND.set(name, { key: schluessel, k: Math.max(kb || k, k) }); return FIG.stempel(ctx, name, schluessel, x, y, k, male, 1, false, kb); }
    if (!alt) { NOCHMAL = true; return null; }
    if (KAM_STEHT) NOCHMAL = true;
  }
  return FIG.stempel(ctx, name, schluessel, x, y, k, male, 1, true);
}
function aussenMalen(p, t, teil, nur = -1) {
  if (nur < 0 || nur === 0) { drawCity(); street(); }
  if (nur < 0 || nur === 1) { const half = (Math.max(S.cy, S.h - S.cy) * -cam.z) / S.f; for (const F of FLOORS) if (!F.roof && Math.abs(F.base + F.y1 / 2 - cam.y) < half + F.y1) room(F, t); tower(); }
  if (nur < 0 || nur === 2) roof(p, t, teil);
}
const flaeche = (R) => { if (!R.c) { R.c = document.createElement('canvas'); R.g = tonHaken(R.c.getContext('2d')); } if (R.c.width !== S.w || R.c.height !== S.h) { R.c.width = S.w; R.c.height = S.h; return true; } return false; };
const naechsteStufe = (tz) => { for (const s of TAG_STUFEN) if (s > tz + 0.001) return s; return null; };
function bauStarten(key, innen, p, t) { const B = RUHE2; if (B.art === 'A' && B.key === key && B.schritt >= 0) return; B.art = 'A'; B.key = key; B.innen = !!innen; B.schritte = innen ? 2 : 3; B.schritt = 0; B.tz = TZ; B.p = p; B.t = t; B.eng = 0; B.f = innen ? S.f : S.f / (1 + NAH); }
function ruheBau() {
  const B = RUHE2, R = RUHEBILD; if (B.schritt < 0 || B.schritt >= B.schritte || !B.key || !KAM_STEHT) return false;
  if (B.art === 'A' ? B.key !== R.zuvor : B.key !== R.key) { if (B.art === 'A') { B.schritt = -1; B.key = ''; } return false; }
  const frisch = flaeche(B), c0 = ctx, tz0 = TZ, n = HOT.length, d0 = DINGE, f0 = S.f, tS = performance.now(), nS = MESS.z ? MESS.z.akt.neben : 0; if (!B.innen && B.f) S.f = B.f;
  ctx = B.g; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; if (B.schritt === 0 && !frisch && !B.innen) ctx.clearRect(0, 0, S.w, S.h);
  TZ = B.tz; B.eng = 0;
  try {
    if (!B.innen) { if (B.key.startsWith('aussen-strasse') && B.schritt === 1) FEIN = BACKT = true; AUSSEN_FEIN = true; aussenMalen(B.p, B.t, 1, B.schritt); }
    else if (B.schritt === 0) { himmel(); FEIN_STADT = true; drawCity(); FEIN_STADT = false; street(); }
    else if (B.schritt === 1) { FEIN = BACKT = true; room(INS.F, B.t, true); B.dinge = DINGE; B.feste = DINGE.filter((d) => d.fest).sort((a, b) => b.z - a.z); B.fi = 0; }
    else {
      FEIN = BACKT = true; oy = INS.F.base; tonAn('ding'); const t1 = performance.now();
      for (let n = 0; B.fi < B.feste.length && n < FEST_JE && performance.now() - t1 < FEST_MS; n++) B.feste[B.fi++].fn(B.t);
    }
  } finally { ctx = c0; TZ = tz0; S.f = f0; TON.kl = null; oy = 0; HOT.length = n; DINGE = d0; FEIN = BACKT = AUSSEN_FEIN = false; }
  if (MESS.z) { if (MESS.flush) B.g.getImageData(0, 0, 1, 1); (MESS.scheiben || (MESS.scheiben = [])).push([B.innen ? 'raum' : 'aussen', B.schritt, +(performance.now() - tS).toFixed(2), MESS.z.akt.neben - nS]); }
  B.schritt++;
  if (B.innen && B.schritt >= 2) B.schritte = B.feste && B.fi < B.feste.length ? B.schritt + 1 : B.schritt;
  if (B.art === 'A' && B.schritt >= B.schritte) { [R.c, B.c] = [B.c, R.c]; [R.g, B.g] = [B.g, R.g]; R.key = B.key; R.tz = B.tz; R.dinge = B.dinge; R.f = B.f; R.p = B.p; R.t = B.t; DST.key = ''; DST.fertig = false; B.key = ''; B.art = ''; B.schritt = -1; sceneDirty = true;
    R.blende = 0; if (B.innen && !reduce && !STATISCH && B.c.width === cv.width && B.c.height === cv.height) { B.g.setTransform(1, 0, 0, 1, 0, 0); B.g.globalAlpha = 1; B.g.globalCompositeOperation = 'source-over'; B.g.drawImage(cv, 0, 0); R.blende = -1; } }
  return true;
}
function drawScene(v, t) {
  const p = v.pz;
  kamera(v); if (NAH) S.f *= 1 + NAH; raumBlick(); HOT.length = 0; oy = 0; spots = span(p, SPOTS); marks = span(p, [THREAD[0] + 0.018, THREAD[1]]) * (1 - span(p, FADEN_OUT)); beacon = span(p, THREAD) * (1 - 0.55 * span(p, [FADEN_OUT[0], SPOTS[1]]));
  TZ = TZ_FEST != null ? TZ_FEST : mischZ(v.tz ?? 1, 1, DAEMM); DAEMM_WARTET = false;
  { const o0 = S.narrow ? 0.6 : 0.3, o = Math.round((o0 + (1 - o0) * tagWerte().nacht) * 50) / 50; if (o !== SHADE_O && SHADE) { SHADE_O = o; SHADE.style.opacity = String(o); } }
  ctx = tonHaken(ctxBild); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; TON.kl = null;
  KERN = coreState(p); KERN.fertig = false;
  const sig = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}`; KAM_STEHT = sig === KAM_SIG; KAM_SIG = sig; STEMPEL_FREI = 1; RUHE_FREI = 1; WALK_FREI = 1; RUHE_N = 0; BEW_ZAHL = BEW_I; BEW_I = 0; BEW_TAKT++;
  ZELLEN_FREI = 1;
  { const hk = !TROCKEN.an && AKT.F && AKT.k >= 1 ? AKT.F.key : ''; if (hk && hk !== RAUM_HIER) { RAUM_HIER = hk; raeumen(RAUM[hk]); } }
  if (reduce || STATISCH) STEMPEL_FREI = RUHE_FREI = WALK_FREI = 999;
  if (TROCKEN.an) STEMPEL_FREI = RUHE_FREI = WALK_FREI = 0;
  const innen = cam.z > -1 && INS.k > 0 && INS.F, oben = !innen && AKT.F && AKT.F.roof && (AKT.k >= 1 || p >= FINALE_AB);
  const unten = !innen && !oben && !STILL && !reduce && !STATISCH && !TROCKEN.an && cam.z < -4.5 && -cam.z <= 40 && cam.y - GROUND < 9 && cam.y > GROUND + 0.3;
  let key = innen && INS.k >= 1 ? ruheSchluessel(INS.F) : oben ? ruheSchluessel(AKT.F) : unten ? `aussen-strasse|${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}|${Math.round(TZ * 100)}` : '';
  if (key) key += innen ? `|${Math.round(TZ * 100)}` : `|${p}`;
  const R = RUHEBILD;
  if (key && oben && key === R.key) { const ziel = naechsteStufe(R.tz); if (TZ < R.tz - 0.003 || (ziel == null && TZ > R.tz + 0.003) || S.f < R.f * 0.9995 || S.f > R.f * 1.12) R.key = ''; }
  if (key && key !== R.key) { if (key !== R.zuvor) { R.zuvor = key; R.seit = t; } if (t - R.seit >= RUHE_AB) bauStarten(key, innen, p, t); else if (innen) raumLebt = Math.max(raumLebt, t + RUHE_AB + 80); key = ''; }
  else if (!key) R.zuvor = '';
  if (MESS.z) MESS.z.neu(key);
  teil();
  if (key) {
    PFAD = 'ruhe';
    if (innen) {
      ruheSetzen(R.c, R.f);
      teil('R'); DINGE = R.dinge; oy = INS.F.base; vornMalen(INS.F.key, t, true); oy = 0; teil('v'); tower(); teil('t'); markenLicht(); teil('m');
      if (R.blende) { if (R.blende < 0) R.blende = t; const kb = (t - R.blende) / BLENDE_MS; if (kb >= 1 || !RUHE2.c || RUHE2.schritt >= 0) R.blende = 0; else { ctx.globalAlpha = 1 - smooth(kb); ctx.drawImage(RUHE2.c, 0, 0); ctx.globalAlpha = 1; NOCHMAL = true; } }
      if (PFAD === 'ruhe' && RAUM[INS.F.key]) vorwaermen(RAUM[INS.F.key], FOK.st === RAUM[INS.F.key] && FOK.st.offen ? FOK.st.offen : RAUM[INS.F.key].L.find((l) => l.hovZiel > 0) || null);
    } else if (unten) {
      himmel(); teil('h'); ruheSetzen(R.c, R.f); teil('R');
    } else {
      himmel(); teil('h'); feuerHinten(); teil('f');
      const D = DST; let a = 0;
      if (R.tz < 1 && TZ_FEST == null && !reduce) {
        if (D.key !== key) { D.key = key; D.fertig = false; D.schritt = 0; D.p = R.p; D.t = R.t; D.f = R.f; D.eng = 0; }
        if (!D.fertig) DAEMM_WARTET = true; else a = clamp01((TZ - R.tz) / (1 - R.tz));
      }
      if (a < 1) ruheSetzen(R.c, R.f);
      teil('R');
      if (a > 0.004) { const k = S.f / R.f; ctx.globalAlpha = a; ctx.drawImage(D.c, S.cx * (1 - k), S.cy * (1 - k), S.w * k, S.h * k); ctx.globalAlpha = 1;
        if (a >= 1) { R.zuvor = key; bauStarten(key, false, p, t); } }
      teil('B'); roof(p, t, 2); teil('d'); feuerSchein(); teil('F');
      if (PFAD === 'ruhe' && AKT.k >= 1) vorwaermen(RAUM.dach, null);
    }
  } else {
    RUHEBILD.key = ''; RUHEBILD.blende = 0; PFAD = innen ? 'direkt' : 'aussen';
    himmel(); teil('h'); if (!innen) feuerHinten();
    drawCity(); teil('c');
    street(); teil('s');
    if (innen) { if (STATISCH) FEIN = true; try { room(INS.F, t); } finally { FEIN = false; } }
    else { const half = (Math.max(S.cy, S.h - S.cy) * -cam.z) / S.f; for (const F of FLOORS) if (!F.roof && Math.abs(F.base + F.y1 / 2 - cam.y) < half + F.y1) room(F, t); }
    teil('r'); tower(); teil('t');
    markenLicht(); teil('m');
    if (!innen) { roof(p, t); teil('d'); feuerSchein(); }
  }
  if (!KERN.fertig) drawCore(KERN);
  teil('k'); walkers(t); teil('w');
}
const FEUER_WERTE = {
  pause: [2000, 4000],
  spaeter: [6000, 11000],
  ruhigAb: 60000,
  gleichzeitig: [3, 1],
  sparPause: [8000, 13000],
  finale: 4,
  finalePause: [2200, 3800],
  teilchen: { kugel: 108, weide: 72, ring: 56 },
  farben: [['255,214,130', '255,246,226'], ['167,139,250', '236,228,255'], ['255,120,60', '255,214,130'], ['125,183,255', '236,244,255'], ['139,92,246', '205,192,255'], ['255,246,226', '255,214,130']],
};
const FEUER = { raketen: [], figuren: [], naechste: 0, seit: 0, finale: 0, bild: new Map(), wo: '' };
function feuerBild(rgb) { let c = FEUER.bild.get(rgb); if (!c) { c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, `rgba(${rgb},1)`); r.addColorStop(0.25, `rgba(${rgb},.45)`); r.addColorStop(0.6, `rgba(${rgb},.12)`); r.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = r; g.fillRect(0, 0, 128, 128); FEUER.bild.set(rgb, c); } return c; }
function feuerStart() {
  const W = FEUER_WERTE, [L, R] = FEUER.wo === 'finale' ? [0.4, 0.98] : freiFlaeche(), himmelH = Math.max(S.h * 0.12, S.cy), arten = ['kugel', 'kugel', 'weide', 'ring'], art = arten[(Math.random() * arten.length) | 0];
  const x = S.w * (L + 0.07 + Math.random() * (R - L - 0.14)), yz = Math.max(S.h * 0.12, S.cy - himmelH * (0.3 + Math.random() * 0.24)), y0 = S.cy - S.h * 0.01, dauer = 950 + Math.random() * 350;
  FEUER.raketen.push({ x, y: y0, y0, yz, x0: x, dx: (Math.random() - 0.5) * S.w * 0.03, t: 0, dauer, art, farbe: W.farben[(Math.random() * W.farben.length) | 0], rad: Math.min(S.h * 0.2, himmelH * 0.36) * (0.8 + Math.random() * 0.4) });
}
function feuerPlatzen(r) {
  const W = FEUER_WERTE, klein = S.narrow || STUFE ? 0.55 : 1, n = Math.round(W.teilchen[r.art] * klein), T = new Float32Array(n * 5), R = r.rad;
  const kipp = 0.3 + Math.random() * 0.4, dreh = Math.random() * Math.PI;
  for (let i = 0; i < n; i++) {
    let vx, vy, f = 0;
    if (r.art === 'ring') { const a = (i / n) * TAU, cx = Math.cos(a), cy = Math.sin(a) * kipp, v = R * 2.5; vx = (cx * Math.cos(dreh) - cy * Math.sin(dreh)) * v; vy = (cx * Math.sin(dreh) + cy * Math.cos(dreh)) * v; if (i % 5 === 0) { vx *= 0.25; vy *= 0.25; f = 1; } }
    else { const a = Math.random() * TAU, innen = r.art === 'kugel' && i % 3 === 0, v = R * (r.art === 'weide' ? 1.9 : 3.1) * (innen ? 0.52 : 0.82 + Math.random() * 0.22) * Math.sqrt(0.25 + 0.75 * Math.random()); vx = Math.cos(a) * v; vy = Math.sin(a) * v * 0.94 - (r.art === 'weide' ? R * 0.5 : 0); f = innen ? 1 : 0; }
    T[i * 5] = r.x; T[i * 5 + 1] = r.y; T[i * 5 + 2] = vx; T[i * 5 + 3] = vy; T[i * 5 + 4] = f;
  }
  FEUER.figuren.push({ x: r.x, y: r.y, t: 0, dauer: r.art === 'weide' ? 3000 : r.art === 'ring' ? 1700 : 2000, art: r.art, farbe: r.farbe, T, n, rad: R, zug: r.art === 'weide' ? 1.5 : 2.3, fall: R * (r.art === 'weide' ? 1.15 : 0.42) });
}
function feuerSchritt(dt, lage) {
  const W = FEUER_WERTE, F = FEUER, aufDach = Math.abs(lage - DACH_SZ) < 0.03 && DAEMM >= 0.995, imFinale = lage >= N - 1 - 0.03 && ORT.kreis < 0.4;
  F.wo = imFinale ? 'finale' : 'dach';
  if (lage < N - 1.5) F.finale = 0;
  if (!aufDach) F.seit = 0;
  if ((aufDach || imFinale) && !document.hidden && canvasAn) {
    F.naechste -= dt; if (aufDach) F.seit += dt;
    if (F.naechste <= 0 && F.raketen.length + F.figuren.length < W.gleichzeitig[STUFE] && (aufDach || F.finale < W.finale)) {
      feuerStart(); if (imFinale) F.finale++;
      const [a, b] = STUFE ? W.sparPause : imFinale ? W.finalePause : F.seit > W.ruhigAb ? W.spaeter : W.pause; F.naechste = a + Math.random() * (b - a);
    }
  } else if (F.naechste < 600) F.naechste = 600;
  const s = dt / 1000;
  for (let i = F.raketen.length - 1; i >= 0; i--) { const r = F.raketen[i]; r.t += dt; const k = Math.min(1, r.t / r.dauer), e = 1 - (1 - k) * (1 - k); r.y = r.y0 + (r.yz - r.y0) * e; r.x = r.x0 + r.dx * k; if (k >= 1) { F.raketen.splice(i, 1); feuerPlatzen(r); } }
  for (let i = F.figuren.length - 1; i >= 0; i--) {
    const f = F.figuren[i], T = f.T, zug = Math.exp(-f.zug * s); f.t += dt; if (f.t >= f.dauer) { F.figuren.splice(i, 1); continue; }
    for (let j = 0; j < f.n * 5; j += 5) { T[j + 2] *= zug; T[j + 3] = T[j + 3] * zug + f.fall * s; T[j] += T[j + 2] * s; T[j + 1] += T[j + 3] * s; }
  }
  return F.raketen.length + F.figuren.length > 0;
}
let feuerBildNr = 0;
function feuerHinten() {
  const F = FEUER; if (!F.raketen.length && !F.figuren.length) return;
  const u = Math.max(1, S.h / 900); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; feuerBildNr++;
  for (const r of F.raketen) { const k = r.t / r.dauer, l = S.h * 0.07 * (1 - k * 0.5), nx = r.dx / (r.y0 - r.yz); ctx.strokeStyle = `rgba(255,214,150,${0.3 * (1 - k * 0.3)})`; ctx.lineWidth = 3.6 * u; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + nx * l, r.y + l); ctx.stroke(); ctx.strokeStyle = `rgba(255,240,214,${0.9 * (1 - k * 0.3)})`; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + nx * l * 0.5, r.y + l * 0.5); ctx.stroke(); }
  for (const f of F.figuren) {
    const k = f.t / f.dauer, weide = f.art === 'weide', aus = 1 - smooth((k - 0.42) / 0.58), T = f.T, sp = weide ? 0.32 : 0.14, zurueck = (weide ? 0.34 : 0.2) * (1 - k), funkelt = k > 0.5, m = feuerBildNr % 3;
    if (k < 0.2) { const a = 1 - k / 0.2, r = f.rad * (0.5 + 2 * k); ctx.globalAlpha = a * 0.95; ctx.drawImage(feuerBild(f.farbe[1]), f.x - r, f.y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
    const zug = (farbe) => { ctx.beginPath(); for (let j = 0, i = 0; j < f.n * 5; j += 5, i++) { if ((farbe >= 0 && T[j + 4] !== farbe) || (funkelt && i % 3 === m)) continue; const x = T[j], y = T[j + 1]; ctx.moveTo(x - T[j + 2] * sp - (x - f.x) * zurueck, y - T[j + 3] * sp - (y - f.y) * zurueck); ctx.lineTo(x, y); } ctx.stroke(); };
    ctx.strokeStyle = `rgba(${f.farbe[0]},${0.2 * aus})`; ctx.lineWidth = (weide ? 4 : 5) * u; zug(-1);
    for (let farbe = 0; farbe < 2; farbe++) { ctx.strokeStyle = `rgba(${f.farbe[farbe]},${0.95 * aus})`; ctx.lineWidth = (weide ? 1.2 : 1.6) * u; zug(farbe); }
    const kopf = (weide ? 1.1 : 1.5) * u * (0.7 + 0.3 * aus); ctx.fillStyle = `rgba(255,250,240,${0.95 * aus})`; ctx.beginPath();
    for (let j = 0, i = 0; j < f.n * 5; j += 5, i++) { if (funkelt && i % 3 === m) continue; ctx.rect(T[j] - kopf, T[j + 1] - kopf, 2 * kopf, 2 * kopf); }
    ctx.fill();
  }
  ctx.restore();
}
function feuerSchein() {
  const F = FEUER; if (!F.figuren.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const f of F.figuren) { const k = f.t / f.dauer, a = (1 - smooth(k / 0.5)) * 0.26; if (a < 0.01) continue; const r = Math.max(S.w, S.h) * 0.5; ctx.globalAlpha = a; ctx.drawImage(feuerBild(f.farbe[0]), f.x - r, f.y - r, 2 * r, 2 * r); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
let tagZuvor = 0;
function tagSchritt(now) {
  const dt = Math.min(100, tagZuvor ? now - tagZuvor : 16); tagZuvor = now;
  if (reduce || STATISCH || DACH_SZ < 0) return false;
  const lage = sS.v, d0 = DAEMM, ganz = DAEMM_VOR + DAEMM_DAUER;
  if (lage > DACH_SZ + 0.3) DAEMM_T = ganz;
  else if (lage >= DACH_SZ - 0.004) { if (!DAEMM_WARTET || DAEMM_T < DAEMM_VOR) DAEMM_T = Math.min(DAEMM_WARTET ? DAEMM_VOR : ganz, DAEMM_T + dt * (lage > DACH_SZ + 0.004 ? 3 : 1)); }
  else DAEMM_T = Math.max(0, DAEMM_T - dt * 6);
  DAEMM = clamp01((DAEMM_T - DAEMM_VOR) / DAEMM_DAUER);
  const feuer = feuerSchritt(dt, lage); if (feuer || DAEMM !== d0) sceneDirty = sceneDirty || feuer;
  return feuer || DAEMM !== d0;
}
function snap(c) { if (!STILL) return; c.style.visibility = 'hidden'; c.parentElement.style.background = `url(${c.toDataURL('image/jpeg', 0.9)}) center / cover no-repeat`; }
const SZ = [{"id":"eingang","art":"eingang","p":0.03,"tz":0.05},{"id":"problem","art":"problem","p":0.25,"kam":{"x":-3,"y":-142.2,"z":-36,"cy":0.62},"ue":"blende","tz":0.1},{"id":"eg","art":"empfang","alt":["fahrt","tresen"],"p":0.3231,"zone":1,"cyn":0.37,"ue":"blende","tz":0.18},{"id":"e1","art":"raum","raum":"studios","p":0.40013,"cyn":0.27,"tz":0.3},{"id":"e2","art":"raum","raum":"revenue","p":0.47713,"cyn":0.27,"tz":0.4},{"id":"e3","art":"raum","raum":"innovation","alt":["e3a","e3b"],"p":0.55413,"cyn":0.27,"tz":0.52},{"id":"e4","art":"raum","raum":"pr","p":0.63113,"cyn":0.27,"tz":0.64},{"id":"e5","art":"tuer","alt":["e5a","e5b"],"p":0.6843,"fz":1.3,"dx":1.2,"fzn":1.68,"dxn":2.2,"cyn":0.3,"dyn":0.8,"pab":0.732,"tz":0.74},{"id":"dach","art":"raum","raum":"buehne","p":0.7874,"dz":4.4,"cyd":0.26,"fzd":1.8,"tz":0.8},{"id":"finale","art":"finale","alt":["pakete"],"p":0.93,"ue":"blende","tz":1}];
const N = SZ.length; const DACH_SZ = SZ.findIndex((x) => x.id === 'dach');
function tzVonP(p) { let i = 0; while (i < N - 2 && p > SZ[i + 1].p) i++; return lerp(SZ[i].tz ?? 1, SZ[i + 1].tz ?? 1, clamp01((p - SZ[i].p) / (SZ[i + 1].p - SZ[i].p))); }
const kopf = $('.kopf');
const track = $('#top'), star = $('#star'), starTint = $('#starTint'), skip = $('#ueberspringen');
const panels = SZ.map((s) => $('#szene-' + s.id));
const etagenNav = $('#etagen'), wahl = $('#etagenwahl');
const KURZ = () => document.getElementById('kurz') || document.getElementById('einstieg');
const spurTop = () => track.getBoundingClientRect().top + scrollY;
const LENIS = { lerp: 0.09, wheelMultiplier: 0.75 };
const ANLAUF = 0.2;
const TAFEL_BLENDE = 0.2;
const NAEHER = 0.03;
const RUHE = 350, RUHE_UNKLAR = 700;
const RAST_AB = 0.15;
const RAST_DAUER = [700, 1300];
const RAST_TIEFE = 0.04;
const TASTE_DAUER = [900, 1400];
const TASTE_JE_HOEHE = 400;
const rastEls = $$('.snap', track), snapsEl = $('.snaps', track);
let WEG = rastEls.map(() => ({ y: 0, halt: 0, fahrt: 1 })), U = innerHeight, HALTE = false;
function messen() {
  const o = track.getBoundingClientRect().top;
  WEG = rastEls.map((el) => { const r = el.getBoundingClientRect(), halt = Math.min(r.height, parseFloat(getComputedStyle(el).paddingTop) || 0); return { y: r.top - o, halt, fahrt: Math.max(1, r.height - halt) }; });
  U = (snapsEl && parseFloat(getComputedStyle(snapsEl).paddingBottom)) || innerHeight;
  HALTE = WEG.some((w) => w.halt > 1);
}
messen();
function schwung(t) {
  if (!HALTE || ANLAUF <= 0) return t;
  const a = Math.min(0.5, ANLAUF), v = 1 / (1 - a);
  return t < a ? (v * t * t) / (2 * a) : t > 1 - a ? 1 - (v * (1 - t) * (1 - t)) / (2 * a) : v * (t - a / 2);
}
function schwungZurueck(f) {
  if (!HALTE || ANLAUF <= 0) return f;
  const a = Math.min(0.5, ANLAUF), v = 1 / (1 - a), g = (v * a) / 2;
  return f < g ? Math.sqrt((2 * a * f) / v) : f > 1 - g ? 1 - Math.sqrt((2 * a * (1 - f)) / v) : f / v + a / 2;
}
function ortVon(yAbs) {
  const r = yAbs - spurTop(); let i = 0; while (i < N - 1 && r >= WEG[i + 1].y) i++;
  const w = WEG[i], d = r - w.y;
  if (d <= w.halt) return { i, h: w.halt > 0 ? clamp01(d / w.halt) : 1, t: 0, lage: i, kreis: 0 };
  const t = clamp01((d - w.halt) / w.fahrt);
  return i < N - 1 ? { i, h: 1, t, lage: i + schwung(t), kreis: 0 } : { i, h: 1, t, lage: i, kreis: t };
}
function yVonLage(v) {
  const i = Math.max(0, Math.min(N - 1, Math.floor(v))), f = Math.min(1, Math.max(0, v - i)), w = WEG[i];
  return spurTop() + w.y + w.halt + (i < N - 1 ? schwungZurueck(f) * w.fahrt : 0);
}
const istRaum = (i) => SZ[i].art === 'raum' || SZ[i].art === 'empfang';
const trittVon = (o) => (!HALTE ? 1 : o.t > 0 || !istRaum(o.i) ? 0 : smooth(o.h / TRITT_ANTEIL) * (1 - smooth((o.h - (1 - TRITT_ANTEIL)) / TRITT_ANTEIL)));
const nahVon = (o) => (HALTE && NAEHER && !istRaum(o.i) ? NAEHER * (o.t > 0 && o.i < N - 1 ? 1 - schwung(o.t) : smooth(o.h)) : 0);
const szeneY = (i) => (STATISCH ? Math.round(panels[i].getBoundingClientRect().top + scrollY - 8) : Math.round(spurTop() + WEG[i].y + (i > 0 ? WEG[i].halt / 2 : 0)));
const kurzY = () => { const k = KURZ(); return Math.round(k ? k.getBoundingClientRect().top + scrollY : spurTop() + track.offsetHeight); };
const aufBuehne = () => { const bb = track.getBoundingClientRect(); return bb.top <= 1 && bb.bottom >= innerHeight - 1; };
const MESS = { n: 0, ms: 0, max: 0, t0: performance.now(), lang: [], z: null, takt: 0, mpMax: 0 };
function spurMerk(f, zs, art, p, dreh, kq, k, q, auge, dz) {
  const U = MESS.spur, pk = FIG.punkte(f.m, p, q[0], q[1], k, { dreh, auge, dz }), hd = Math.PI + Math.atan2(zs.x - cam.x, dz) - dreh, c = Math.cos(hd), s = Math.sin(hd), g = f.m.gr, r3 = (v) => +v.toFixed(3);
  const welt = (a) => [r3(zs.x + g * (a[0] * c + a[2] * s)), r3(zs.z + g * (-a[0] * s + a[2] * c)), r3(g * (a[1] - pk.grund))], r1 = (a) => [+a[0].toFixed(2), +a[1].toFixed(2)];
  U.q = q; if (U.d.length < 6000) U.d.push({ t: +lastT.toFixed(1), a: art, x: r3(zs.x), z: r3(zs.z), s: r3(zs.s || 0), q: r3(zs.q), dreh: r3(dreh), hd: r3(hd), kq: +kq.toFixed(1), k: +k.toFixed(1), g: r1(q), kopf: r1(pk.kopf), hip: r1(pk.hip), fr: r1(pk.fr), fl: r1(pk.fl), hr: r1(pk.hr), hl: r1(pk.hl), wr: welt(pk.ar), wl: welt(pk.al), lz: Math.round(f.st.lz), m: +(p.mund > 0.05 || p.rede > 0.05 || p.zug > 0.05), sg: FIG.sig(p) });
}
function filmBild() {
  const F = MESS.film, U = MESS.spur; if (!F || F.i >= F.n || !U || !U.q) return;
  if (F.fest ? !F.q : true) F.q = U.q.slice();
  const sp = F.i % F.sp, ze = Math.floor(F.i / F.sp); F.g.drawImage(cv, Math.round(F.q[0] - F.b / 2 + F.dx), Math.round(F.q[1] - F.h * 0.9), F.b, F.h, sp * F.b, ze * F.h, F.b, F.h); F.i++;
}
function zaehlenAn() {
  if (MESS.z) return; const Pt = CanvasRenderingContext2D.prototype, z = (MESS.z = { akt: { fill: 0, stroke: 0, rect: 0, bild: 0, verlauf: 0, clip: 0, neben: 0, t: 0, pfad: '', bew: 0 }, bilder: [], abst: [] });
  const haenge = (n, k) => { const o = Pt[n]; Pt[n] = function (...a) { if (this === ctxBild || this === RUHEBILD.g) z.akt[k]++; else z.akt.neben++; return o.apply(this, a); }; };
  haenge('fill', 'fill'); haenge('stroke', 'stroke'); haenge('fillRect', 'rect'); haenge('strokeRect', 'rect'); haenge('drawImage', 'bild'); haenge('createLinearGradient', 'verlauf'); haenge('createRadialGradient', 'verlauf'); haenge('clip', 'clip');
  z.takt = () => { z.akt = { fill: 0, stroke: 0, rect: 0, bild: 0, verlauf: 0, clip: 0, neben: 0, t: +performance.now().toFixed(1), pfad: 'leer', bew: 0, lage: +ORT.lage.toFixed(3) }; if (z.bilder.length < 9000) z.bilder.push(z.akt); };
  z.neu = (key) => { const st = AKT.F && RAUM[AKT.F.key]; z.akt.pfad = key ? (key === RUHEBILD.key ? 'ruhe' : 'anlegen') : 'direkt'; z.akt.bew = st && raumBewegt(st) ? 1 : 0; };
}
const mpVon = (c) => (c && c.width ? (c.width * c.height) / 1e6 : 0);
function flaechenMP() {
  const t = { bild: mpVon(cv), ruhend: mpVon(RUHEBILD.c) + mpVon(RUHE2.c), nacht: mpVon(DST.c), himmel: SKY.reduce((n, c) => n + mpVon(c), 0) + mpVon(STERNE), bildschirme: Object.values(TEX).reduce((n, c) => n + (c && c.getContext ? mpVon(c) : 0), 0),
    menschen: bildMP, stempel: FIG.stempel.mp(), schichten: [...SCHICHTEN.values()].reduce((n, x) => n + mpVon(x.c), 0) };
  let g = 0; for (const k in t) { g += t[k]; t[k] = +t[k].toFixed(1); } t.gesamt = +g.toFixed(1); return t;
}
function messBericht() {
  const z = MESS.z; if (!z) return 'erst __haus.zaehlen(true)';
  const alle = z.bilder.splice(0), b = alle.filter((f) => f.pfad !== 'leer' && f.pfad !== 'warm' && f.pfad !== 'bau'), ab = z.abst.splice(0), med = (a) => { const s2 = a.slice().sort((x, y) => x - y); return s2.length ? s2[s2.length >> 1] : 0; }, sp = (k) => `${med(b.map((f) => f[k]))} / ${Math.max(0, ...b.map((f) => f[k]))}`;
  return { bilder: b.length, 'davon in Bewegung': b.filter((f) => f.bew).length, 'Pfade gefüllt (Mitte / höchstens je Bild)': sp('fill'), 'Pfade gezogen': sp('stroke'), Rechtecke: sp('rect'), 'Verläufe angelegt': sp('verlauf'), Ausschnitte: sp('clip'), 'Bilder eingesetzt': sp('bild'),
    'nebenher auf kleine Flächen (Befehle)': sp('neben'), 'nebenher während Bewegung (Summe)': b.filter((f) => f.bew).reduce((n, f) => n + f.neben, 0), 'Abstände des Browsers über 25 ms': ab.filter((v) => v > 25).map((v) => Math.round(v)).join(', ') || 'keine', 'längster Abstand ms': Math.round(Math.max(0, ...ab)), 'Abstand Mitte ms': med(ab),
    Stufe: STUFE, Gerätepixel: devicePixelRatio, Zeichenfläche: `${S.w}×${S.h}`, 'vorgezeichnet MP': +bildMP.toFixed(1), 'Vorzeichnen offen': VOR.length };
}
window.__haus = { mess: MESS, dbg: () => ({ steht: KAM_STEHT, sig: KAM_SIG, seitScroll: Math.round(lastT - SCROLL_T), bleibt: bleibt(), y: scrollY, hov: Object.values(RAUM).flatMap((st) => st.L.filter((l) => l.hovZiel > 0 || l.hov > 0.02).map((l) => l.id)), bewegt: Object.values(RAUM).filter((st) => raumBewegt(st)).map((st) => st.key) }), geh: (key, id, drin) => { const st = RAUM[key]; paketSetzen(st, st.nach[id], !!drin); return st.nach[id].dauer; }, spur: (key, id, n = 0) => { if (!key) { const d = MESS.spur ? MESS.spur.d : []; MESS.spur = null; return d; } MESS.spur = { f: RAUM[key].nach[id].leute[n], d: [], q: null }; return MESS.spur.f.m.id; }, spurHolen: () => (MESS.spur ? MESS.spur.d.splice(0) : []),
  film: (n, b, h, fest = false, dx = 0) => { if (!n) { const F = MESS.film; MESS.film = null; return F ? F.c.toDataURL('image/png') : ''; } const sp = Math.min(n, 15), c = document.createElement('canvas'); c.width = sp * b; c.height = Math.ceil(n / sp) * h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); MESS.film = { c, g, n, b, h, sp, i: 0, fest, dx, q: null }; return 'läuft'; }, filmStand: () => (MESS.film ? MESS.film.i : -1), tag: () => ({ tz: +TZ.toFixed(3), daemmerung: +DAEMM.toFixed(3), raketen: FEUER.raketen.length, figuren: FEUER.figuren.length, wartet: DAEMM_WARTET, flaeche: RUHEBILD.tz, naechste: RUHE2.schritt }), rakete: () => { feuerStart(); sceneDirty = true; }, zaehlen: (an) => { if (an === true) { zaehlenAn(); MESS.z.bilder.length = 0; MESS.z.abst.length = 0; return 'zählt'; } return MESS.z ? MESS.z.bilder.splice(0) : []; }, messen: messBericht, stufe: (n) => { if (n === 1) herunterschalten('von Hand'); return STUFE; }, takt: () => ({ ms: +TAKT_MS.toFixed(1), schutzAb: Math.round(SCHUTZ_AB), lange: langeBilder, grund: MESS.stufeGrund || '' }), bilder: () => ({ flaechen: flaechenMP(), mpMax: MESS.mpMax, mp: +bildMP.toFixed(1), atlanten: ATLANTEN.size, offen: VOR.length, fertig: !!MESS.warmFertig, vorgezeichnet: MESS.vorgezeichnet || 0, ruhebilder: MESS.ruhebilder || 0, liste: [...ATLANTEN].map((a) => `${a.st ? a.st.key : ''} ${a.cw}×${a.ch} k${a.k} Zellen ${a.n} Seiten ${a.seiten.length} MP ${a.mp.toFixed(1)}`) }), ort: ortVon, weg: () => WEG, raeume: () => RAUM, neu: () => { sceneDirty = true; }, kameraBei: (lage) => { const v = ansicht(lage); kamera(v); const r = { p: +v.p.toFixed(4), x: +cam.x.toFixed(2), y: +cam.y.toFixed(2), z: +cam.z.toFixed(2), f: Math.round(S.f * FZ) }; sceneDirty = true; return r; }, lang: () => { const r = MESS.lang.slice(); MESS.lang.length = 0; return r; }, zeiten: () => { const t = performance.now(), r = { bilder: MESS.n, jeSekunde: +((MESS.n * 1000) / (t - MESS.t0)).toFixed(1), msMittel: +(MESS.ms / Math.max(1, MESS.n)).toFixed(2), msMax: +MESS.max.toFixed(1) }; MESS.n = 0; MESS.ms = 0; MESS.max = 0; MESS.t0 = t; return r; } };
let lenis = null;
if (window.Lenis && matchMedia('(pointer: fine)').matches && !reduce && !STATISCH) {
  try {
    lenis = new window.Lenis({ lerp: LENIS.lerp, wheelMultiplier: LENIS.wheelMultiplier, smoothWheel: true, syncTouch: false, autoRaf: false, allowNestedScroll: true });
    window.lenis = lenis;
  } catch (e) { console.error(e); lenis = null; }
}
let fahrt = null;
let eigenY = -1, eigenOffen = false;
let ORT = { i: 0, h: 0, t: 0, lage: 0, kreis: 0 }, NAH = 0;
let cssAn = false;
function cssRasten(an) { if (an === cssAn) return; cssAn = an; root.classList.toggle('rast-fest', an); }
function setze(y) { if (lenis) { lenis.reset(); lenis.scrollTo(y, { immediate: true, force: true }); } else scrollTo(0, y); }
function sperreAbgleichen() {
  if (!lenis) return; const g = gesperrt(); if (g === lenis.isStopped) return;
  fahrtAus(); if (g) lenis.stop(); else lenis.start();
}
function fahrtAus() {
  const f = fahrt; if (!f) return; fahrt = null;
  if (f.fuehrt && ORT.gefuehrt && ORT.lage !== f.fuehrt.lage0) setze(yVonLage(ORT.lage));
  else if (lenis) lenis.reset();
}
function fahre(y, dauer, kurve, ziel = null, gefuehrt = false) {
  y = Math.max(0, Math.min(y, root.scrollHeight - innerHeight));
  const von = ORT, nah0 = NAH;
  fahrtAus(); sperreAbgleichen();
  if (Math.abs(y - scrollY) < 1) return;
  cssRasten(false);
  const fuehrt = gefuehrt && ziel != null && ziel < N && aufBuehne() ? { lage0: von.lage, lage1: ziel, nah0, nah1: nahVon(ortVon(y)), tr0: TRITT, tr1: trittVon(ortVon(y)), kreis0: von.kreis, nur: [Math.round(von.lage), ziel] } : null;
  const f = fahrt = { von: scrollY, y, t0: performance.now(), dauer, kurve, ziel, fuehrt };
  if (lenis) lenis.scrollTo(y, { duration: dauer / 1000, easing: kurve, force: true, onComplete: () => { if (fahrt === f) fahrt = null; } });
}
function fahrtOrt(now) {
  const g = fahrt.fuehrt, k = clamp01((now - fahrt.t0) / fahrt.dauer), e = fahrt.kurve(k), v = k >= 1 ? g.lage1 : lerp(g.lage0, g.lage1, e);
  const i = Math.max(0, Math.min(N - 1, Math.floor(v))), fr = Math.min(1, Math.max(0, v - i));
  return { i, h: 1, t: i < N - 1 ? schwungZurueck(fr) : 0, lage: v, kreis: g.kreis0 * (1 - e), nah: lerp(g.nah0, g.nah1, e), tritt: lerp(g.tr0, g.tr1, e), nur: g.nur, gefuehrt: true };
}
readers.push((now) => {
  if (lenis) {
    sperreAbgleichen(); lenis.raf(now);
    if (fahrt && lenis.isScrolling !== 'smooth' && now - fahrt.t0 > 80) fahrtAus();
    return;
  }
  if (!fahrt) return;
  const k = Math.min(1, Math.max(0, (now - fahrt.t0) / fahrt.dauer));
  eigenY = k < 1 ? fahrt.von + (fahrt.y - fahrt.von) * fahrt.kurve(k) : fahrt.y; eigenOffen = true;
  scrollTo(0, eigenY);
  if (k >= 1) fahrt = null;
});
function szeneZu(i, sofort) {
  const kurz = i >= N, n = Math.max(0, Math.min(N - 1, i)), y = kurz ? kurzY() : szeneY(n);
  if (sofort || STATISCH || reduce || (!kurz && !aufBuehne())) { fahrtAus(); if (Math.abs(y - scrollY) >= 2) { cssRasten(false); setze(y); } return; }
  fahre(y, Math.min(TASTE_DAUER[1], Math.max(TASTE_DAUER[0], (TASTE_JE_HOEHE * Math.abs(y - scrollY)) / U)), easeInOutSine, kurz ? N : n, !kurz);
}
const szeneNr = (w) => { let n = /^\d+$/.test(w) ? Math.min(N, +w) - 1 : SZ.findIndex((s) => s.id === w); if (n < 0) n = SZ.findIndex((s) => (s.alt || []).includes(w)); return n >= 0 && n < N ? n : -1; };
const sceneDirty0 = () => { sceneDirty = true; };
const keyVon = (z) => { const i = Math.floor((z.p - TOUR_START) / FLOOR_LEN), key = i >= 0 && i < HALTS ? FLOORS[i].key : null; return key && MARKE[key] ? key : null; };
function ansicht(s) {
  if (STILL) return { p: STILL.p, pz: STILL.p, blende: null, tz: tzVonP(STILL.p) };
  const k = Math.min(N - 2, Math.max(0, Math.floor(s))), t = clamp01(s - k), A = SZ[k], B = SZ[k + 1];
  const pa = t > 0 ? A.pab ?? A.p : A.p;
  const v = { p: lerp(pa, B.p, t), pz: lerp(t > 0 && A.pab != null ? A.pab : A.pz ?? A.p, B.pz ?? B.p, t), blende: null, tz: lerp(A.tz ?? 1, B.tz ?? 1, t) };
  if (B.ue === 'blende') v.blende = { pa: A.kam || A.p, pb: B.kam || B.p, t: easeInOutSine(t) };
  for (const key in MARKE) MARKE[key].zone.v = MARKE[key].z0;
  const ka = keyVon(A), kb = keyVon(B), za = A.zone ?? (ka ? MARKE[ka].z0 : 0), zb = B.zone ?? (kb ? MARKE[kb].z0 : 0);
  if (ka && ka === kb) MARKE[ka].zone.v = lerp(za, zb, t); else { if (ka) MARKE[ka].zone.v = za; if (kb) MARKE[kb].zone.v = zb; }
  ZOOM = lerp((S.narrow ? A.zoomn ?? A.zoom : A.zoom) ?? 1, (S.narrow ? B.zoomn ?? B.zoom : B.zoom) ?? 1, t);
  NCY = lerp(A.cyn ?? 0.235, B.cyn ?? 0.235, t); NDZ = lerp(A.dz ?? 2.5, B.dz ?? 2.5, t); NCYD = lerp(A.cyd ?? 0.19, B.cyd ?? 0.19, t); NZF = lerp(A.fzd ?? 1, B.fzd ?? 1, t);
  const n = S.narrow, w = (Z, a, d) => (n ? Z[a + 'n'] ?? Z[a] : Z[a]) ?? d;
  FZ = lerp(w(A, 'fz', 1), w(B, 'fz', 1), t); DX = lerp(w(A, 'dx', 0), w(B, 'dx', 0), t); DY = lerp(w(A, 'dy', 0), w(B, 'dy', 0), t);
  return v;
}
const sS = new Spring(0, FOLGE, sceneDirty0, 0.0004);
(() => { const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160), R = mulberry(3); for (let i = 0; i < d.data.length; i += 4) { const v = (R() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = `url(${c.toDataURL()})`; })();
let aktiv = -1, canvasAn = true, kopfLage = '', marke = false;
const etagenLinks = $$('a', etagenNav);
const schmal = matchMedia('(max-width: 767.98px), (max-width: 1100px) and (max-aspect-ratio: 9/10)');
function zeigeSzene(a) {
  if (a !== aktiv && FOK.st && FOK.st.offen) karteZu(false);
  aktiv = a;
  panels.forEach((el, i) => {
    el.classList.toggle('an', i === a);
    if (STATISCH) return;
    el.inert = i !== a; if (i === a) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
  });
  etagenNav.classList.toggle('an', ['empfang', 'raum', 'tuer'].includes(SZ[a].art));
  etagenLinks.forEach((l) => { const jetzt = l.dataset.szenen === SZ[a].id; l.classList.toggle('jetzt', jetzt); if (jetzt) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current'); });
  for (const key in RAUM) RAUM[key].grenze = null;
}
const tafelO = new Array(N).fill(-1);
const tafelInnen = panels.map((el) => el.querySelector(':scope > .sz-innen') || el);
function tafeln(o) {
  const aus = HALTE ? [0, TAFEL_BLENDE] : [0.3, 0.5], ein = HALTE ? [1 - TAFEL_BLENDE, 1] : [0.5, 0.7];
  for (let j = 0; j < N; j++) {
    let op = 0, ri = 0;
    if (j === o.i) { op = 1 - smooth(j === N - 1 ? span(o.kreis, [0.6, 1]) : span(o.t, aus)); ri = -1; }
    else if (j === o.i + 1) { op = smooth(span(o.t, ein)); ri = 1; }
    if (o.nur && !o.nur.includes(j)) op = 0;
    op = Math.round(op * 200) / 200;
    const vor = op === 0 && j === o.i + 1 && !(o.nur && !o.nur.includes(j)), merk = vor ? -2 : op;
    if (merk === tafelO[j]) continue; tafelO[j] = merk;
    const el = panels[j], in_ = tafelInnen[j];
    el.classList.toggle('vor', vor); el.inert = vor;
    in_.style.opacity = vor ? '0.003' : String(op);
    el.classList.toggle('zeigt', op > 0);
  }
}
painters.push(() => { if (!STATISCH && !STILL) tafeln(ORT); });
let inFahrt = true;
readers.push((now) => {
  const bb = track.getBoundingClientRect(), h = innerHeight;
  if (STATISCH) { kopfSetzen(bb.bottom <= (kopf ? kopf.offsetHeight : 0) * 0.6 ? 'hell' : 'glas'); return; }
  const o = STILL ? ORT : fahrt && fahrt.fuehrt ? fahrtOrt(now) : ortVon(scrollY); ORT = o;
  const a = o.i < N - 1 && o.t >= 0.5 ? o.i + 1 : o.i;
  if (a !== aktiv) zeigeSzene(a);
  inFahrt = !STILL && bb.bottom > 2;
  if (!marke && o.lage >= N - 1 - 0.02) { marke = true; try { localStorage.setItem('make-fahrt', '1'); } catch (_) {  } }
  if (!STILL) {
    const nah = o.nah ?? nahVon(o); if (nah !== NAH) { NAH = nah; sceneDirty = true; }
    const tr = o.tritt ?? trittVon(o); if (tr !== TRITT) { TRITT = tr; sceneDirty = true; }
    if (!lenis) sS.set(o.lage);
    else if (o.lage !== sS.v) sS.set(o.lage, { immediate: true });
  }
  const c = o.kreis;
  star.style.visibility = c > 0 ? 'visible' : 'hidden'; star.style.opacity = c > 0 ? 1 : 0;
  star.style.transform = `scale(${0.012 + Math.pow(c, 4) * 3.2})`; starTint.setAttribute('opacity', easeInOutSine(span(c, [0.2, 1])));
  canvasAn = c < 0.98 && bb.bottom > 0 && bb.top < h;
  kopfSetzen(bb.bottom <= (kopf ? kopf.offsetHeight : 0) * 0.6 || c > 0.97 ? 'hell' : o.lage < 0.5 ? 'szene' : 'glas');
  if (!STILL) rasten(now);
});
const grob = matchMedia('(pointer: coarse)');
let tast = grob.matches;
let letzteRegung = performance.now() + 600, letzteEingabe = 0, letzterScroll = 0, letztY = scrollY, dir = 0, unklar = false;
let zeigerUnten = false, fingerUnten = false;
const feldAktiv = () => { const el = document.activeElement; return !!el && el !== document.body && el.matches('input, textarea, select, [contenteditable]'); };
const gesperrt = () => root.classList.contains('menue-offen') || !!document.querySelector('dialog[open]');
function regung(eingabe) { const t = performance.now(); letzteRegung = t; if (eingabe) letzteEingabe = t; }
function rasten(now) {
  if (STATISCH || reduce || fahrt || zeigerUnten || fingerUnten) return;
  if (lenis && lenis.isScrolling === 'smooth') { letzteRegung = now; return; }
  const y = scrollY, oben = spurTop(), ende = kurzY(), still = now - letzteRegung;
  const drin = y >= oben - 1 && y < ende - 1, o = drin ? ortVon(y) : null, w = o ? WEG[o.i] : null;
  const a = o ? oben + w.y + w.halt : 0, b = o ? (o.i < N - 1 ? oben + WEG[o.i + 1].y : ende) : 0;
  const imHalt = !!o && (y <= a + 1 || y >= b - 1);
  if (!HALTE && tast) {
    if (still > 120) { if (!cssAn && imHalt) cssRasten(true); else if (cssAn && !drin) cssRasten(false); }
    if (cssAn) return;
  }
  if (!drin || imHalt || still < (unklar ? RUHE_UNKLAR : RUHE) || document.hidden) return;
  if (gesperrt() || feldAktiv()) return;
  const anteil = (y - a) / (b - a), vor = dir < 0 ? 1 - anteil <= RAST_AB : anteil > RAST_AB, letzte = o.i === N - 1;
  const ziel = vor ? (letzte ? ende : b + Math.min(RAST_TIEFE * U, WEG[o.i + 1].halt / 2)) : a - Math.min(RAST_TIEFE * U, w.halt / 2);
  if (Math.abs(ziel - y) < 1) return;
  fahre(ziel, RAST_DAUER[0] + (RAST_DAUER[1] - RAST_DAUER[0]) * Math.min(1, Math.abs(ziel - y) / (1.0 * U)), easeInOutSine, vor ? (letzte ? N : o.i + 1) : o.i);
}
addEventListener('scroll', () => {
  const y = scrollY, t = performance.now();
  if (lenis ? !!fahrt && Math.abs(y - lenis.animatedScroll) <= 3 : eigenOffen && Math.abs(y - eigenY) <= 2) { if (!lenis) eigenOffen = !!fahrt; letztY = y; return; }
  if (y !== letztY) dir = y > letztY ? 1 : -1;
  letztY = y;
  if (fahrt) fahrtAus();
  if (t - letzterScroll > 200) unklar = !fingerUnten && t - letzteEingabe > 300;
  letzterScroll = letzteRegung = t;
}, { passive: true });
addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  regung(true); fahrtAus();
  if (tast) { tast = false; cssRasten(false); }
}, { passive: true, capture: true });
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; zeigerUnten = true; regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['pointerup', 'pointercancel']) addEventListener(typ, (e) => { if (e.pointerType === 'touch') return; zeigerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('pointermove', (e) => { if (zeigerUnten && e.buttons === 0) { zeigerUnten = false; regung(true); } }, { passive: true, capture: true });
addEventListener('touchstart', () => { fingerUnten = true; tast = true; regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['touchend', 'touchcancel']) addEventListener(typ, (e) => { if (!e.touches.length) fingerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('blur', () => { zeigerUnten = false; fingerUnten = false; });
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href*="#"]'); if (!a || a.getAttribute('href').startsWith('#szene-')) return;
  cssRasten(false); fahrtAus(); if (lenis) lenis.reset();
}, true);
function kopfSetzen(lage) {
  if (!kopf || lage === kopfLage) return; kopfLage = lage;
  kopf.classList.toggle('ueber-film', lage !== 'hell'); kopf.classList.toggle('film-geht', lage === 'glas');
}
let lastAmbient = 0;
function place() { if (coreAt) { star.style.left = `${clamp01(coreAt[0]) * 100}%`; star.style.top = `${clamp01(coreAt[1]) * 100}%`; } }
const passanten = () => -cam.z <= 40 && cam.y - GROUND <= 9;
let rafAlt = 0, warVoll = false, langeBilder = 0, schutzN = 0; const schutzRing = new Uint8Array(SCHUTZ_FENSTER);
const TAKT_N = 60, taktRing = new Float32Array(TAKT_N), taktSort = new Float32Array(TAKT_N); let taktI = 0, TAKT_MS = 0, SCHUTZ_AB = SCHUTZ_MS;
function taktMessen(abstand) {
  if (!(abstand > 2 && abstand < 200)) return;
  taktRing[taktI++ % TAKT_N] = abstand; if (taktI < TAKT_N || taktI % 30) return;
  taktSort.set(taktRing); taktSort.sort(); TAKT_MS = taktSort[6]; SCHUTZ_AB = Math.max(SCHUTZ_MS, TAKT_MS * 1.6); MESS.taktMs = +TAKT_MS.toFixed(1);
}
let PROBE = null;
function grafikAbwarten() {
  if (MESS.flush !== 'gpu') { ctxBild.getImageData(0, 0, 1, 1); return; }
  if (!PROBE) { const c = document.createElement('canvas'); c.width = c.height = 320; PROBE = c.getContext('2d'); }
  PROBE.drawImage(cv, 0, 0, 320, 320); PROBE.getImageData(0, 0, 1, 1);
}
function herunterschalten(grund) {
  if (STUFE) return; STUFE = 1; MESS.stufeGrund = grund || '';
  try { sessionStorage.setItem('make-haus-stufe', '1'); } catch (e) {  }
  sizeScene(); buildTextures();
}
painters.push((now) => {
  if (STATISCH || !canvasAn || document.hidden || !sky) { rafAlt = 0; warVoll = false; return; }
  if (STILL) { if (sceneDirty) { drawScene(ansicht(0), 0); sceneDirty = false; snap(cv); place(); } return; }
  const abstand = rafAlt ? now - rafAlt : 0; rafAlt = now;
  if (scrollY !== SCROLL_ALT) { SCROLL_ALT = scrollY; SCROLL_T = now; }
  if (!LEER_AN) { LEER_AN = true; vorarbeit(); }
  aufwaermen(now);
  if (WALK.atl.length && ORT.lage > 2.7) { for (const a of WALK.atl) if (a && !a.tot) atlasFrei(a); WALK.atl = []; }
  if (MESS.z && ++MESS.takt % 20 === 0) { const g = flaechenMP().gesamt; if (g > MESS.mpMax) MESS.mpMax = g; }
  if (PUB_VOR !== BILD_GEN && ORT.lage >= 5.2 && ORT.lage < DACH_SZ - 0.15) { PUB_VOR = BILD_GEN; publikumVor(); }
  if (DACH_VOR !== BILD_GEN && ORT.lage > 6.05 && ORT.lage < DACH_SZ - 0.15) { DACH_VOR = BILD_GEN; dachVorab(); }
  if (MESS.z) { MESS.z.takt(); if (abstand) MESS.z.abst.push(+abstand.toFixed(1)); }
  taktMessen(abstand);
  if (warVoll && TAKT_MS && abstand > 0 && abstand < 1500 && now > 3000 && !TROCKEN.liste.length) {
    const i = schutzN++ % SCHUTZ_FENSTER; langeBilder += (abstand > SCHUTZ_AB ? 1 : 0) - schutzRing[i]; schutzRing[i] = abstand > SCHUTZ_AB ? 1 : 0;
    if (langeBilder >= SCHUTZ_BILDER && !QUERY.has('stufe')) herunterschalten(`${langeBilder} von ${SCHUTZ_FENSTER} Bildern über ${Math.round(SCHUTZ_AB)} ms (Takt ${TAKT_MS.toFixed(1)} ms)`);
  }
  const tagLebt = tagSchritt(now); HIMMEL_LEBT = tagLebt;
  const lebt = now < raumLebt || passanten() || raumLebendig() || tagLebt;
  warVoll = sceneDirty;
  if (sceneDirty || (lebt && now - lastAmbient > TAKT_RUHE[STUFE])) { const t0 = performance.now(); drawScene(ansicht(sS.v), now); sceneDirty = NOCHMAL; NOCHMAL = false; lastAmbient = now; if (RUHE2.schritt >= 0 && RUHE2.schritt < RUHE2.schritte && (RUHE2.art === 'A' ? ++RUHE2.eng > 5 : DAEMM_WARTET && PFAD === 'ruhe')) ruheBau(); else if (DAEMM_WARTET && PFAD === 'ruhe' && !DST.fertig && ++DST.eng > 2) { DST.eng = 0; daemmBau(); }  place(); schilderSetzen(); teil('p'); if (performance.now() - t0 < 5) { if (LEER.length) leerSchritt(); else if (VOR.length && !RUHE_N && (PFAD === 'ruhe' || PFAD === 'direkt') && !HIMMEL_LEBT) warmSchritt(1); teil('L'); } if (MESS.flush) grafikAbwarten(); const d = performance.now() - t0; MESS.n++; MESS.ms += d; if (d > MESS.max) MESS.max = d; if (MESS.z) MESS.z.akt.ms = +d.toFixed(2); if (d > 12 && MESS.lang.length < 400) MESS.lang.push([Math.round(now), +d.toFixed(1), PFAD, INS.F && RAUM[INS.F.key] ? RAUM[INS.F.key].L.map((l) => +l.u.toFixed(2)).join('/') : '']); }
  else { const t0 = performance.now(), bau = ruheBau() || daemmBau(); if ((bau || warmSchritt() || leerSchritt()) && MESS.z) { MESS.z.akt.pfad = bau ? 'bau' : 'warm'; if (MESS.flush) grafikAbwarten(); MESS.z.akt.ms = +(performance.now() - t0).toFixed(2); } }
  if (MESS.film) filmBild();
});
const RH = { e: 'einmalig', m: 'im Monat', a: 'je Abend' };
const geld = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
const wahlVon = (st) => st.L.filter((l) => l.drin).map((l) => [l, l.V[l.v]]);
function summenText(wahl) {
  const s = { e: 0, m: 0, a: 0 }; for (const [, v] of wahl) if (v.r !== 'f') s[v.r] += v.p;
  const teile = ['e', 'm', 'a'].filter((r) => s[r] > 0).map((r) => `${RH[r]} ab ${geld(s[r])}`.replace(/ /g, '\u00a0'));
  return teile.length ? teile.join('\u00a0· ') : wahl.length ? 'kostenlos' : 'noch nichts gewählt';
}
const laufzeitText = (wahl) => wahl.filter(([, v]) => v.lz).map(([l, v]) => `${l.name}: ${v.lz}`).join(' · ');
const wasText = (wahl) => (wahl.length ? wahl.map(([l, v]) => `${l.name}${v.n ? ` ${v.n}` : ''}`).join(' · ') : 'nichts gewählt');
const RAUM_NACH_ID = {};
for (const key in RAUM) {
  const st = RAUM[key], el = $('#szene-' + st.def.szene); RAUM_NACH_ID[st.def.id] = st; st.el = el; st.nr = SZ.findIndex((s) => s.id === st.def.szene);
  st.rt = $('.rt', el); st.rp = $('.rp', el); st.blatt = $('.rblatt', el); st.alle = $('.raum-alle', el); st.summe = $('[data-summe]', st.rp); st.laufzeit = $('[data-laufzeit]', st.rp); st.offen = null;
  for (const l of st.L) {
    const z = $(`.rl-z[data-l="${l.id}"]`, el), k = $(`.rk[data-l="${l.id}"]`, el), sch = $(`.schild[data-l="${l.id}"]`, el);
    l.dom = { z, an: $('.rl-an', z), vr: $('[data-var]', z), ab: $('[data-ab]', z), stand: $('[data-stand]', z), k, wahl: $$('.rk-wahl button', k), bl: $$('.rk-v', k), schalter: $('.rk-schalter', k), schalterText: $('[data-schalter]', k), sch, schAb: $('[data-ab]', sch) };
  }
}
const finaleEl = $('[data-auswahl]');
function raumZeigen(st) {
  for (const l of st.L) {
    const v = l.V[l.v], d = l.dom;
    d.an.setAttribute('aria-pressed', String(l.drin)); d.vr.textContent = v.n; d.ab.textContent = v.ab; d.stand.textContent = l.drin ? 'in deinem Paket' : 'nicht in deinem Paket';
    d.wahl.forEach((b, i) => b.setAttribute('aria-pressed', String(i === l.v))); d.bl.forEach((b, i) => { b.hidden = i !== l.v; });
    d.schalter.setAttribute('aria-pressed', String(l.drin)); d.schalterText.textContent = l.drin ? 'In meinem Paket' : 'Nicht in meinem Paket';
    d.schAb.textContent = v.ab; d.sch.classList.toggle('leer', !l.drin); d.sch._w = 0;
  }
  const wahl = wahlVon(st); st.summe.textContent = summenText(wahl); st.laufzeit.textContent = laufzeitText(wahl);
  if (st.alle) { const leer = st.L.every((l) => l.drin); if (st.alle.hidden !== leer) { if (leer && document.activeElement === st.alle) { const z = st.L[0].dom.an; if (z) z.focus({ preventScroll: true }); } st.alle.hidden = leer; } alleSetzen(st); }
}
function alleSetzen(st) {
  if (!st.alle || st.alle.hidden || !st.grenze) return; const G = st.grenze, hh = st.alle.offsetHeight || 34;
  st.alle.style.transform = `translate3d(${Math.round(G.links + 10)}px,${Math.round(G.unten - hh - 10)}px,0)`;
}
function finaleZeigen() {
  if (!finaleEl) return;
  for (const id in RAUM_NACH_ID) { const st = RAUM_NACH_ID[id], wahl = wahlVon(st), li = $(`[data-raum="${id}"]`, finaleEl); if (!li) continue; $('[data-was]', li).textContent = wasText(wahl); $('[data-ab]', li).textContent = wahl.length ? summenText(wahl) : ''; }
}
function auswahlMerken() {
  const o = {};
  for (const id in RAUM_NACH_ID) { const st = RAUM_NACH_ID[id], aus = st.L.filter((l) => !l.drin).map((l) => l.id), v = {}; for (const l of st.L) if (l.v > 0) v[l.id] = l.V[l.v].k; if (aus.length || Object.keys(v).length) o[id] = { aus, v }; }
  try { if (Object.keys(o).length) localStorage.setItem('make-auswahl', JSON.stringify(o)); else localStorage.removeItem('make-auswahl'); } catch (_) {  }
}
(() => {
  let o = null; try { o = JSON.parse(localStorage.getItem('make-auswahl') || 'null'); } catch (_) { o = null; }
  if (o && typeof o === 'object') for (const id in RAUM_NACH_ID) {
    const e = o[id], st = RAUM_NACH_ID[id]; if (!e || typeof e !== 'object') continue;
    for (const l of st.L) { if (Array.isArray(e.aus) && e.aus.includes(l.id)) { l.drin = false; l.u = 1; } const k = e.v && e.v[l.id], i = l.V.findIndex((x) => x.k === k); if (i > 0) l.v = i; }
  }
  for (const id in RAUM_NACH_ID) raumZeigen(RAUM_NACH_ID[id]);
  finaleZeigen();
})();
const UM_WEG = [0.24, 0.07];
const UM = { x: new Spring(0, { tension: 60, friction: 16 }, sceneDirty0, 0.002), y: new Spring(0, { tension: 60, friction: 16 }, sceneDirty0, 0.002) };
const FOK = { st: null, l: null, k: new Spring(0, { duration: 750, easing: easeInOutSine }, sceneDirty0) };
function raumBlick() {
  const k = AKT.k, F = AKT.F; if (k <= 0 || !F || !RAUM[F.key]) return;
  const f = FOK.k.v * k;
  if (f > 0.001 && FOK.l && FOK.st === RAUM[F.key]) {
    const l = FOK.l, fk = (l.fig && l.fig.fokus) || {}, D = fk.d || (F.roof ? 9.5 : 3.9), b = oy; oy = 0;
    cam.x = lerp(cam.x, l.x + (fk.x || 0), f);
    cam.z = lerp(cam.z, l.z - D, f); oy = b;
  }
  if (!F.roof) { cam.x += UM.x.v * UM_WEG[0] * k; cam.y -= UM.y.v * UM_WEG[1] * k; }
}
function karteZu(fokusZurueck = true) {
  const st = FOK.st; if (!st || !st.offen) return;
  const l = st.offen; st.offen = null; l.dom.k.hidden = true; l.dom.sch.classList.remove('hebt'); st.el.classList.remove('karte-offen'); st.blatt.inert = false; st.rt.inert = false;
  FOK.k.set(0); sceneDirty = true; grenzenMessen(st); mitteMessen();
  if (fokusZurueck && st.oeffner && st.oeffner.isConnected && st.el.classList.contains('an')) st.oeffner.focus({ preventScroll: true });
}
function karteAuf(st, l, oeffner) {
  if (st.offen === l) return; if (FOK.st && FOK.st.offen) karteZu(false);
  st.offen = l; st.oeffner = oeffner && oeffner.matches('.rl-mehr, .rl-an') ? oeffner : l.dom.z.querySelector('.rl-mehr');
  l.dom.k.hidden = false; l.dom.sch.classList.add('hebt'); st.el.classList.add('karte-offen'); if (!STATISCH) { st.rt.inert = true; if (schmal.matches) st.blatt.inert = true; }
  FOK.st = st; FOK.l = l; FOK.k.set(1); sceneDirty = true; grenzenMessen(st); mitteMessen();
  if (!STATISCH) l.dom.k.querySelector('.rk-zurueck').focus({ preventScroll: true });
}
function paketSetzen(st, l, drin) {
  if (l.drin === drin) return; l.drin = drin;
  if (reduce || STATISCH) l.u = drin ? 0 : 1;
  else if ((l.u <= 0 || l.u >= 1) && st.tuer && l.leute.length) {
    const jetzt = performance.now(), plan = (st.tuerPlan = (st.tuerPlan || []).filter((t) => t > jetzt - 400)), an = l.leute.map((f) => (drin ? l.dauer - (f.verz + f.tA + f.tW) + f.tW * (1 - f.w.sT / f.w.len) : f.verz + f.tA + f.tW * (f.w.sT / f.w.len)));
    let warte = 0; while (warte < 2400 && an.some((a) => plan.some((t) => Math.abs(jetzt + warte + a - t) < TUER_ABSTAND))) warte += 120;
    l.warte = warte; for (const a of an) plan.push(jetzt + warte + a);
  } else if (l.u > 0 && l.u < 1 && l.fest == null) { l.warte = 0; let einer = false; for (const f of l.leute) { const zs = wo(f); if (!zs.fort && zs.s > 0.05) { f.dreht = true; einer = true; } } if (einer) l.wende = WENDE_MS; }
  raumZeigen(st); finaleZeigen(); auswahlMerken(); sceneDirty = true;
  if (STATISCH && typeof neuMalen === 'function') neuMalen(st.nr);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-raum-aktion]'); if (!b) return;
  const el = b.closest('.sz-raum'), st = el && RAUM_NACH_ID[el.dataset.raum]; if (!st) return;
  const karte = b.closest('.rk'), l = st.nach[b.dataset.l || (karte && karte.dataset.l)], w = b.dataset.raumAktion;
  if (w === 'zurueck') karteZu();
  else if (w === 'alle') { for (const x of st.L) paketSetzen(st, x, true); }
  else if (!l) return;
  else if (w === 'paket') paketSetzen(st, l, !l.drin);
  else if (w === 'oeffnen') karteAuf(st, l, b);
  else if (w === 'variante') { const i = +b.dataset.v; if (i !== l.v && l.V[i]) { l.vAlt = l.v; l.v = i; l.vZeit = performance.now(); raumLebt = l.vZeit + 480; raumZeigen(st); finaleZeigen(); auswahlMerken(); sceneDirty = true; if (STATISCH && typeof neuMalen === 'function') neuMalen(st.nr); } }
});
const stageEl = cv.parentElement, aktRaum = () => (AKT.F && AKT.k > 0.85 && !STATISCH ? RAUM[AKT.F.key] || null : null);
function trifft(e) {
  const st = aktRaum(); if (!st) return null; const r = stageEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = HOT.length - 1; i >= 0; i--) { const h = HOT[i]; if (st.L.includes(h.l) && x >= h.x0 && x <= h.x1 && y >= h.y0 - 14 && y <= h.y1) return h.l; }
  return null;
}
function hebe(st, l) {
  if (!st) return;
  for (const x of st.L) { const an = x === l; if (x.hovZiel !== (an ? 1 : 0)) { x.hovZiel = an ? 1 : 0; sceneDirty = true; } x.dom.z.classList.toggle('hebt', an); if (st.offen !== x) x.dom.sch.classList.toggle('hebt', an); }
}
stageEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const st = aktRaum(), l = trifft(e); hebe(st, l); cv.style.cursor = l ? 'pointer' : ''; });
stageEl.addEventListener('pointerleave', () => { hebe(aktRaum(), null); cv.style.cursor = ''; });
stageEl.addEventListener('click', (e) => {
  const st = aktRaum(); if (!st) return; const l = trifft(e);
  if (l) karteAuf(st, l, null); else if (st.offen) karteZu();
});
document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return; const z = e.target.closest?.('.rl-z, .schild'); const st = aktRaum(); if (!st) return;
  if (z && st.el.contains(z)) hebe(st, st.nach[z.dataset.l]); else if (e.target.closest?.('.rt, .rp, .rk')) hebe(st, null);
});
document.addEventListener('focusin', (e) => {
  const st = aktRaum(); if (!st || !e.target.matches?.(':focus-visible')) return; const z = e.target.closest?.('.rl-z');
  hebe(st, z && st.el.contains(z) ? st.nach[z.dataset.l] : null);
});
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || reduce || STATISCH) return;
  if (!aktRaum() || AKT.F.roof) { UM.x.set(0); UM.y.set(0); return; }
  const [L, R] = freiFlaeche(), m = (L + R) / 2, hw = Math.max(0.2, (R - L) / 2);
  if (e.clientX < L * innerWidth - 4) return;
  UM.x.set(Math.max(-1, Math.min(1, (e.clientX / innerWidth - m) / hw))); UM.y.set(Math.max(-1, Math.min(1, (e.clientY / innerHeight - 0.5) * 2)));
}, { passive: true });
let schildRaum = null;
function mitteMessen() {
  const r = stageEl.getBoundingClientRect(); if (!r.height) return; const oben = (kopf ? kopf.offsetHeight : 0) + 6;
  for (const key in RAUM) { const st = RAUM[key]; if (!st.blatt) continue; const anteil = (el) => { const u = el.getBoundingClientRect().top - r.top; return u > oben + 60 ? (oben + (u - oben) * 0.46) / r.height : null; };
    const m = MITTE[key] || (MITTE[key] = { blatt: 0.27, karte: null }), b = anteil(st.blatt); if (b != null) m.blatt = b; if (st.offen) { const kk = anteil(st.offen.dom.k); if (kk != null) m.karte = kk; } }
}
function grenzenMessen(st) {
  const r = stageEl.getBoundingClientRect(), eng = schmal.matches, unten = st.offen && eng ? st.offen.dom.k : eng ? st.blatt : st.rp, u = unten.getBoundingClientRect();
  st.grenze = { links: eng ? 58 : st.rt.getBoundingClientRect().right - r.left + 6, rechts: r.width - 4, oben: (kopf ? kopf.offsetHeight : 0) + (eng ? 52 : 8), unten: u.top - r.top - 4 };
  alleSetzen(st);
}
function schilderSetzen() {
  const st = AKT.F && AKT.k > 0 && !STATISCH ? RAUM[AKT.F.key] || null : null;
  if (schildRaum && schildRaum !== st) { for (const l of schildRaum.L) { l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); l.dom.sch._o = '0'; } }
  schildRaum = st; if (!st) return;
  const sicht = clamp01((AKT.k - 0.82) / 0.18), fest = [];
  if (sicht <= 0) { for (const l of st.L) if (l.dom.sch._o !== '0') { l.dom.sch._o = '0'; l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); } return; }
  if (!st.grenze) grenzenMessen(st);
  const G = st.grenze;
  const liste = HOT.filter((h) => h.l.dom && !h.neben && st.L.includes(h.l)).sort((a, b) => b.sy - a.sy);
  const gesehen = new Set();
  for (const h of liste) {
    const el = h.l.dom.sch; gesehen.add(h.l);
    if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; }
    const w = el._w, hh = el._h + 10; let x = Math.max(G.links + w / 2, Math.min(G.rechts - w / 2, h.sx)), y = h.sy, n = 0;
    const frei = (yy) => !fest.some((d) => Math.abs(d.x - x) < (d.w + w) / 2 + 6 && Math.abs(d.y - yy) < hh + 2);
    if (y - hh < G.oben) y = G.oben + hh;
    for (const dy of [0, -1, -2, 1, 2, -3, 3]) { const yy = y + dy * (hh + 4); if (yy - hh >= G.oben && frei(yy)) { y = yy; n = 9; break; } }
    fest.push({ x, y, w });
    const aus = sicht < 0.03 || Math.abs(x - h.sx) > w * 0.9 || y > G.unten, tr = `translate3d(${Math.round(x - w / 2)}px,${Math.round(y - hh)}px,0)`, op = aus ? '0' : sicht.toFixed(2);
    if (el._t !== tr) { el._t = tr; el.style.transform = tr; }
    { const stiel = Math.round(Math.max(0, h.stiel || 0) + (y - h.sy)); if (el._s !== stiel) { el._s = stiel; if (stiel > 2) el.style.setProperty('--stiel', `${stiel + 11}px`); else el.style.removeProperty('--stiel'); } }
    if (el._o !== op) { el._o = op; el.style.opacity = op; el.classList.toggle('da', !aus); }
  }
  for (const l of st.L) if (!gesehen.has(l) && l.dom.sch._o !== '0') { l.dom.sch._o = '0'; l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); }
}
const raumLebendig = () => !reduce && !!AKT.F && AKT.k > 0.9 && !!RAUM[AKT.F.key];
readers.push((now, dt) => {
  for (const key in RAUM) {
    const st = RAUM[key]; let bewegt = false;
    for (const l of st.L) {
      if (l.fest != null) { if (l.u !== l.fest) { l.u = l.fest; sceneDirty = true; } }
      else if (l.wende > 0) {
        l.wende -= dt; sceneDirty = true; bewegt = true;
        if (l.wende <= 0) { l.wende = 0; for (const f of l.leute) if (f.dreht) { const zs = wo(f); f.dreht = false; if (!zs.fort && zs.s > 0) { f.hd = zs.ziel; f.schritt = direkt(f) ? 0 : ((l.drin ? f.w.len - zs.s : zs.s) / SCHRITT) * Math.PI; f.sAlt = zs.s; f.gang = 0; f.wR = f.wL = f.wN = W0; } } }
      } else if (l.warte > 0 && l.u !== (l.drin ? 0 : 1)) { l.warte -= dt; bewegt = true;
      } else { const ziel = l.drin ? 0 : 1; if (l.u !== ziel) { l.u = ziel > l.u ? Math.min(1, l.u + dt / l.dauer) : Math.max(0, l.u - dt / l.dauer); sceneDirty = true; bewegt = true; } }
      for (const f of l.leute) {
        if (l.u <= 0) { f.hd = f.blick; f.sAlt = 0; f.schritt = 0; f.dreht = false; f.gang = 0; f.ox = f.oz = 0; f.halt2 = null; continue; }
        const zs = wo(f); if (zs.fort) { f.sAlt = f.w.len; f.schritt = 0; f.dreht = false; f.gang = 1; f.wR = f.wL = f.wN = 1; f.ox = f.oz = 0; f.halt2 = null; f.hd = ortAufWeg(f.w, f.w.len)[2] + Math.PI; continue; }
        if (zs.s <= 0) { f.hd = zs.q > 0 ? aufRichtung(f, zs.q) : f.blick; f.sAlt = 0; f.schritt = 0; f.dreht = false; f.gang = 0; f.wR = f.wL = f.wN = W0; f.ox = f.oz = 0; f.halt2 = null; continue; }
        if (f.dreht) { if (direkt(f)) { f.gang = Math.max(0, (f.gang ?? 1) - dt / 170); if (f.gang < 0.4) f.hd = dreheZu(f.hd, zs.ziel, (dt * Math.PI) / (WENDE_MS * 0.6)); } else f.hd = dreheZu(f.hd, zs.ziel, (dt * Math.PI) / (WENDE_MS * 0.85)); continue; }
        if (direkt(f)) { gangSchritt(f, zs, dt, l); continue; }
        f.hd = l.fest != null ? zs.ziel : dreheZu(f.hd, zs.ziel, dt * DREH_TEMPO); f.schritt += (Math.abs(zs.s - f.sAlt) / SCHRITT) * Math.PI; f.sAlt = zs.s;
      }
      if (l.hov !== l.hovZiel) { const d = l.hovZiel - l.hov; l.hov = Math.abs(d) < 0.02 ? l.hovZiel : l.hov + d * Math.min(1, dt / 110); sceneDirty = true; }
    }
    if (AKT.F && AKT.F.key === key) {
      const sp = st.sperr || (st.sperr = []); if (bewegt && !st.sperrAuf) { sp.push([st.lz, Infinity]); st.sperrAuf = true; if (sp.length > 40) sp.shift(); } else if (!bewegt && st.sperrAuf) { sp[sp.length - 1][1] = st.lz; st.sperrAuf = false; }
      st.lz += dt;
    }
  }
});
function markeSetzen() { try { localStorage.setItem('make-fahrt', '1'); } catch (_) {  } }
function ueberspringen(e) {
  if (e) e.preventDefault();
  markeSetzen(); fahrtAus(); cssRasten(false);
  setze(kurzY());
}
skip.addEventListener('click', ueberspringen);
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return;
  if (FOK.st && FOK.st.offen) { e.preventDefault(); karteZu(); return; }
  if (inFahrt && !STATISCH && !STILL) ueberspringen(e);
});
function zu(dlg) { if (dlg.open) dlg.close(); }
for (const dlg of [wahl]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) zu(dlg); });
}
$('#wahlZu').addEventListener('click', () => zu(wahl));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#szene-"]'); if (a) {
    const i = szeneNr(a.getAttribute('href').slice(7)); if (i < 0) return;
    e.preventDefault(); if (a.closest('dialog')) zu(a.closest('dialog')); szeneZu(i); return;
  }
  const b = e.target.closest('[data-aktion]'); if (!b) return;
  const w = b.dataset.aktion;
  if (w === 'etagenwahl') { if (!wahl.open) wahl.showModal(); }
  else if (w === 'weiter') szeneZu(Math.max(0, aktiv) + 1);
});
addEventListener('keydown', (e) => {
  if (STATISCH || STILL || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, vor = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey), zurueck = k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey);
  if (!vor && !zurueck && k !== 'Home' && k !== 'End') return;
  if (gesperrt() || e.target.closest?.('input, textarea, select, [contenteditable]') || (k === ' ' && e.target.closest?.('button, a, summary'))) return;
  const y = scrollY, oben = spurTop(), ende = kurzY();
  if (k === 'End') { e.preventDefault(); fahrtAus(); cssRasten(false); regung(true); setze(root.scrollHeight); return; }
  if (y > ende + 1 || (y >= ende - 1 && !zurueck) || y < oben - 1) return;
  e.preventDefault(); regung(true);
  if (k === 'Home') { szeneZu(0); return; }
  if (e.repeat && fahrt && (performance.now() - fahrt.t0) / fahrt.dauer < 0.7) return;
  const o = ortVon(y), letzte = o.i === N - 1;
  const ziel = fahrt && fahrt.ziel != null ? fahrt.ziel + (vor ? 1 : -1) : letzte && o.t > 0.02 ? (vor ? N : N - 1) : vor ? o.i + 1 : o.t > 0.02 ? o.i : o.i - 1;
  szeneZu(Math.max(0, Math.min(N, ziel)));
});
const MAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const STEMPEL_MIN_MS = 3500, STEMPEL_MAX_MS = 90 * 60 * 1000;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
function stempelHolen(url) {
  let stand = null, laufend = null;
  const holen = () => (laufend ||= fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => { stand = j && j.ok && j.aktiv && j.stempel ? { ...j, seit: Date.now() } : null; return stand; })
    .catch(() => { stand = null; return null; }).finally(() => { laufend = null; }));
  return {
    async bereit() { if (!stand || Date.now() - stand.seit > STEMPEL_MAX_MS) await holen(); return stand; },
    async reif() { const d = STEMPEL_MIN_MS - (Date.now() - (stand ? stand.seit : 0)); if (d > 0) await pause(d); },
  };
}
async function jsonSenden(url, body) {
  const r = await fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  return { r, j: await r.json().catch(() => null) };
}
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
let neuMalen = null;
function bilderMalen() {
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); malen(panels.indexOf(en.target)); } }), { rootMargin: '60% 0px' });
  const ruhig = []; let laeuft = false;
  function malen(i) { ruhig.push(i); if (!laeuft) { laeuft = true; setTimeout(abarbeiten, 0); } }
  function abarbeiten() {
    const i = ruhig.shift(); if (i === undefined) { laeuft = false; return; }
    const v = ansicht(i); if (i === DACH_SZ) v.tz = TAG_RUHIG; drawScene(v, 0); panels[i].style.backgroundImage = `url(${cv.toDataURL('image/jpeg', 0.8)})`; setTimeout(abarbeiten, 20);
  }
  panels.forEach((el) => io.observe(el));
  neuMalen = (i) => { if (panels[i].style.backgroundImage) malen(i); };
}
if (!STILL && !STATISCH) {  }
sizeScene(); zeigeSzene(0); mitteMessen(); sceneDirty = true;
if (!STATISCH && !STILL) {
  const einflug = () => new Spring(0, EINFLUG, (v) => { introK = v; sceneDirty = true; }).set(1);
  if (reduce) einflug(); else { TROCKEN.liste = [0.3, 0.6, 0.85, 1, 1.4, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]; TROCKEN.danach = einflug; }
}
let rz = 0;
let rzAnteil = null;
addEventListener('resize', () => {
  for (const key in RAUM) { RAUM[key].grenze = null; for (const l of RAUM[key].L) if (l.dom) l.dom.sch._w = 0; }
  if (!rz) rzAnteil = !fahrt && inFahrt && !STATISCH && !STILL ? (scrollY - spurTop()) / U : null;
  cancelAnimationFrame(rz); rz = requestAnimationFrame(() => {
    rz = 0; messen(); sizeScene(); zeigeSzene(aktiv); mitteMessen(); if (STATISCH) panels.forEach((el) => { el.style.backgroundImage = ''; });
    if (STATISCH || STILL) return;
    if (lenis) lenis.resize();
    if (fahrt && fahrt.ziel != null) { const z = fahrt.ziel; fahrt.fuehrt = null; fahrtAus(); if (z <= N) szeneZu(z, true); }
    else if (rzAnteil != null && !cssAn) { const y = Math.round(spurTop() + rzAnteil * U); if (Math.abs(scrollY - y) >= 1) setze(y); }
  });
});
requestAnimationFrame(frame);
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
(async () => {
  await withTimeout(Promise.all(['400 20px', '500 40px', '600 20px'].map((f) => document.fonts.load(`${f} "Schibsted Grotesk"`))).catch(() => {}), 4000);
  buildTextures(); sceneDirty = true;
  const ETAGE = { eg: 'eg', tresen: 'eg', empfang: 'eg', 1: 'e1', 2: 'e2', 3: 'e3', 4: 'e4', 5: 'e5', dach: 'dach' };
  const TUER = SZ.find((x) => x.art === 'tuer');
  const ziel = QUERY.get('szene') || ETAGE[(QUERY.get('etage') || '').toLowerCase()] || (location.hash.startsWith('#szene-') ? location.hash.slice(7) : location.hash === '#newsletter' && TUER ? TUER.id : '');
  if (ziel && !STILL && !STATISCH) { const i = szeneNr(ziel); if (i >= 0) { messen(); fahrtAus(); setze(szeneY(i)); sS.set(i, { immediate: true });
    const nach = () => { if (!letzteEingabe && !fahrt && Math.abs(scrollY - szeneY(i)) > 2) setze(szeneY(i)); };
    if (location.hash) { setTimeout(nach, 400); if (document.readyState !== 'complete') addEventListener('load', () => setTimeout(nach, 60), { once: true }); } } }
  if (STATISCH) bilderMalen();
  root.dataset.bereit = '1';
})();
}
