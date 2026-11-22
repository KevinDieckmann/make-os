/* MAKE Innovation · „Das Haus“: die Fahrt durch das Haus (QUELLE; bauen.mjs macht daraus js/haus.js und setzt Szenen, Räume und Linkziele ein).
   Das Produkt des Kunden fährt im Aufzug von der Straße bis zur Bühne auf dem Dach. Die Zeichnung (Canvas) folgt der Scroll-Position.
   Jede Szene hat auf dem Scrollweg einen HALT (der Raum steht, die Tafel ist voll da) und eine FAHRT zur nächsten Szene. Am Rechner scrollt die Seite
   weich und etwas gebremst (Lenis, js/lenis.min.js, die einzige Fremdbibliothek); im Halt rastet nichts, nur wer mitten in einer Fahrt stehen bleibt,
   gleitet zum näheren Halt. Mit dem Finger scrollt der Browser selbst und rastet Szene für Szene (CSS Scroll-Snap).
   Alle Stellwerte: Längen in haus.css ganz oben, das Gefühl hier unter „STELLWERTE DES SCROLLENS“. Der Text jeder Szene ist echtes HTML und steht ganz da.
   Seit dem Umbau vom 21.11. sind die Etagen Räume zum Hineingehen (Abschnitt „RÄUME“): Die Leistungen sind Menschen im Raum, man kann sie ansehen, in Varianten
   umschalten und aus dem Paket nehmen. Was in welchem Raum steht, kommt aus haus/raeume.json; hier stehen nur Zeichnung und Ablauf.
   Die Menschen zeichnet das Figuren-System (haus/figuren.js, Daten in haus/figuren.json): farbig, in jeder Haltung und Blickrichtung, mit Aufstehen, Gehen und Wegen zur Tür.
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
/* ── Auflösung und Selbstschutz ──
   DPR_HOECHSTENS: Mit so vielen Gerätepixeln je CSS-Pixel rechnet die Zeichenfläche höchstens (die Schrift liegt als HTML darüber und bleibt scharf).
   STUFE 0 = volle Güte · 1 = schwaches Gerät: Gerätepixel 1, gröbere vorgezeichnete Menschen, das Leben im Raum bewegt sich seltener.
   Das Haus schaltet selbst auf Stufe 1, wenn von den letzten SCHUTZ_FENSTER gezeichneten Bildern SCHUTZ_BILDER länger als SCHUTZ_MS brauchen, mindestens aber das 1,6-Fache des gemessenen Bildschirmtakts (Stromsparmodus: 30 Bilder je Sekunde sind kein schwaches Gerät; einzelne Hänger zählen nicht), und bleibt für diesen Besuch dabei (sessionStorage „make-haus-stufe“). Prüfen: ?stufe=0 bzw. ?stufe=1 */
const DPR_HOECHSTENS = [1.5, 1], KANTE_HOECHSTENS = [1920, 1600], SCHUTZ_MS = 34, SCHUTZ_BILDER = 20, SCHUTZ_FENSTER = 90, TAKT_RUHE = [32, 50];
let STUFE = (() => { try { const q = QUERY.get('stufe'); if (q === '0' || q === '1') { sessionStorage.setItem('make-haus-stufe', q); return +q; } return sessionStorage.getItem('make-haus-stufe') === '1' ? 1 : 0; } catch (e) { return 0; } })();
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
const FOLGE = { tension: 700, friction: 53 };      // ohne Lenis (Finger): die Kamera folgt der Scroll-Position straff (kritisch gedämpft, rund 75 ms Nachlauf); mit Lenis folgt sie ohne Feder
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
const HALTS = 7, FLOOR_LEN = 0.077, TOUR_START = 0.27, TRAVEL_PART = 0.38; // sieben Halte, der Aufzug fährt in den ersten 38 % jedes Halts
const DACH_HALT = 6;                                       // das Dach: kein Raum zum Hineingehen, die Ansicht bleibt draußen
const MARKEN_HALTE = [0, 1, 2, 3, 4];                     // Räume zum Hineingehen (Etage 5, der Podcast, hat die Tür zu)
const HERO = [0, 0.19], TURN_END = 0.235;                 // Eingang: von außen auf die Dachbühne zu, dann zurück auf die Straße
const THREAD = [0.832, 0.864], FADEN_OUT = [0.892, 0.906], SPOTS = [0.897, 0.93]; // das ganze Haus, dann die Lichtkegel auf dem Dach
const floorRange = (i) => [TOUR_START + i * FLOOR_LEN, TOUR_START + (i + 1) * FLOOR_LEN];
const wide = matchMedia('(min-width: 768px)');

/* ═══════════════ Das Haus (2D-Canvas, von der Scroll-Position gescrubbt) ═══════════════
   Ein Turm mit 40 Etagen, oben die Dachbühne. Alles ist in Metern gebaut und wird mit einer Zentralperspektive
   projiziert; die Stadt dahinter rechnet ihre Höhe aus der Höhe der Kamera. Durch alle Etagen läuft ein gläserner
   Schacht: darin fährt der Kern, das Produkt des Kunden, von der Straße bis aufs Dach und wird von Halt zu Halt heller. */
const cv = $('#seq'), ctxBild = cv.getContext('2d');
let ctx = ctxBild; // worauf gerade gezeichnet wird: das Bild selbst oder die Fläche für alles, was im Raum steht (RUHEBILD)
const S = { w: 0, h: 0, f: 0, cx: 0, cy: 0, narrow: false, css: 1 };
const cam = { x: 0, y: 1.75, z: -46 };
const NEAR = 0.22;
const FH = 3.6, TOP = 40, GROUND = -TOP * FH, TXL = -6.4, TXR = 10.4, RD = 16; // Dach: y = 0, Tiefe RD
const baseOf = (n) => (n - TOP) * FH;
const SHAFT = { x0: 2.3, x1: 3.7, x: 3.0, z: 0.9 };      // der gläserne Schacht hinter der Fassade
const PED = { x: 0.2, z: 4.4, h: 1.05 };                 // der Sockel im Erdgeschoss
const STOOL = { x: -2.45, z: 7.55, h: 0.74 };             // der Hocker bei MAKE Studios: dort wird der Kern gefilmt
const INN_SOCKEL = [1.42, 1.78, 8.5, 8.88], PR_SOCKEL = [-0.42, -0.06, 8.5, 8.88]; // [x0, x1, z0, z1] der Sockel für das Produkt des Kunden bei MAKE Innovation und in PR und Kommunikation (an der Rückwand, wo er nichts verdeckt)
const STAGE = { x0: -4.6, x1: 4.6, y: 0.5, z0: 6.4, z1: 11, zc: 8.6 }, TRUSS = { x: 4.9, z: 10.2, h: 5.4 };
const DT = [[-3.5, 1.9], [-4.3, 5.5]];                     // die zwei Thementische auf dem Dach
const AKZ = { studios: '#FF5A1F', revenue: '#7DB7FF', lav: '#A78BFA' }; // Akzent je Etage; der Kern des Kunden bleibt violett
/* Die sieben Halte des Hauses, von unten nach oben. Etagenzahl und Name stehen in raeume.json bzw. szenen.json;
   n ist hier nur die Höhe im Turm (40 Stockwerke). key wählt die Zeichnung des Raums. zu = die Tür ist zu (kein Raum zum Hineingehen). */
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
const LEVELS = [0.12, 0.28, 0.42, 0.56, 0.7, 0.86, 1];   // Helligkeit des Kerns je Halt
const LAV = '167,139,250', LAVH = '205,192,255', WARM = '255,236,214';
let sceneDirty = true;
/* Räume von innen: rgb = Licht des Raums, tief = Tönung, zx = Mitte des Blicks (je Zone), kern = Platz des Kerns dort, kernG = so groß liegt er dort (1 = wie im Aufzug; im Raum kleiner, damit er zum Sockel passt), breite = so viele Meter zeigt die Ansicht in 6,6 m
   Abstand (breiteN am Handy), z0 = Zone, wenn eine Szene keine nennt. Die Tür, durch die jemand den Raum verlässt, steht in raeume.json › plan.tuer. */
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
/* Linkziele aus ziele.json (das Bauskript setzt sie ein); im Skript stehen keine festen Adressen */
const ZIELE = /*ZIELE*/{}/*ZIELE-ENDE*/;

let sky = null, skyHy = 0, CITY = null, TEX = {}, oy = 0, beacon = 0, spots = 0, marks = 0, coreAt = null;
const FONT = (w, s) => `${w} ${s}px "Schibsted Grotesk", system-ui, sans-serif`;
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (a, b) => { let t = (Math.imul(a + 77, 374761393) + Math.imul(b + 13, 668265263)) | 0; t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
const winCol = (r, a) => (r < 0.55 ? `rgba(255,${(228 + r * 30) | 0},${(196 + r * 70) | 0},${a})` : `rgba(${(186 + r * 40) | 0},${(172 + r * 40) | 0},255,${a})`); // Fensterlicht: warmweiß bis lavendel

/* ═══════════════ TAGESZEIT ═══════════════
   Eine Größe TZ von 0 (Vormittag) bis 1 (Nacht). Jede Szene nennt ihren Wert (szenen.json › bild.tz), während der Fahrt wird überblendet; auf dem Dach läuft nach der
   Ankunft die Dämmerung von selbst (DAEMM, Abschnitt „DÄMMERUNG UND FEUERWERK“). Alles Licht leitet sich davon ab:
   · Himmel: sechs kleine vorgezeichnete Fassungen (TAG.himmel), je Bild werden zwei davon überblendet. Sonne, Mond und Sterne sind eingesetzte Bilder.
   · Stadt: Farbe je Staffel und Dunst aus TAG.stadt, die Fenster gehen ab der Dämmerung nach und nach an (stadtFenster).
   · Haus, Straße, Räume, Dach: Jede Farbe der Zeichnung läuft durch eine Lichtrechnung (TON), solange eine Klasse eingeschaltet ist (tonAn). Am Tag werden dunkle Flächen hell,
     Schatten bleiben Schatten, satte Farben (die Raumfarbe) bleiben; nachts kommt genau die Zeichnung heraus, wie sie im Skript steht. Es wird dafür nichts zusätzlich gezeichnet.
   · Menschen: je Raum ein fester Lichtsatz (LICHT), passend zur Tageszeit der Szene.
   Heller oder später stellen: szenen.json › bild.tz der Szene ändern (0 = Vormittag · 0.34 = Mittag · 0.6 = goldene Stunde · 0.8 = Sonnenuntergang · 0.9 = Dämmerung · 1 = Nacht). */
let TZ = 1;                                                   // die Tageszeit, mit der gerade gezeichnet wird
const TAG = {
  sonneX: 0.86,                                               // die Sonne steht rechts im Bild (Anteil der Breite): neben der Bühne, nie hinter der Tafel
  /* Himmel je Stützstelle: tz · Verlauf von oben (0) bis zum Horizont (1) · sonne = Höhe der Sonne über dem Horizont (Anteil der Himmelshöhe) · schein = [Farbe, Deckkraft, Radius als Anteil der Breite] ·
     wolken = [Farbe, Deckkraft] · boden = Dunst unter dem Horizont (oben, Mitte, unten) */
  himmel: [
    { tz: 0, v: [[0, '#2a69c2'], [0.45, '#5592da'], [0.75, '#8fbdea'], [0.92, '#c3dcf2'], [1, '#e6ebec']], sonne: 0.4, schein: ['255,250,236', 0.5, 0.34], wolken: ['255,255,255', 0.5], boden: ['#cddbea', '#9fb2c8', '#74869b'] },
    { tz: 0.34, v: [[0, '#2166c6'], [0.5, '#4c92de'], [0.8, '#90c1ef'], [1, '#d2e5f6']], sonne: 0.78, schein: ['255,255,250', 0.45, 0.3], wolken: ['255,255,255', 0.56], boden: ['#c6d8ea', '#98adc6', '#6f8298'] },
    { tz: 0.6, v: [[0, '#3565b4'], [0.42, '#7c9bd0'], [0.68, '#d9c6b6'], [0.86, '#f4cc98'], [1, '#ffd79c']], sonne: 0.21, schein: ['255,216,150', 0.72, 0.5], wolken: ['255,232,204', 0.5], boden: ['#e6c4a0', '#a9937f', '#74685f'] },
    { tz: 0.8, v: [[0, '#1b2759'], [0.34, '#463c82'], [0.56, '#a2547c'], [0.74, '#e5704e'], [0.89, '#ffa248'], [1, '#ffcc78']], sonne: 0.045, schein: ['255,170,92', 0.85, 0.6], wolken: ['255,150,112', 0.5], boden: ['#c5745a', '#6b4254', '#2c2238'] },
    { tz: 0.9, v: [[0, '#090d26'], [0.4, '#1b1d52'], [0.68, '#47307c'], [0.87, '#86478a'], [1, '#c4667a']], sonne: -0.07, schein: ['255,124,118', 0.4, 0.5], wolken: ['168,120,180', 0.26], boden: ['#5a3a72', '#2a2148', '#100f20'] },
    { tz: 1, v: [[0, '#050609'], [0.3, '#0B0E10'], [0.55, '#110f22'], [0.74, '#1c154a'], [0.87, '#35228a'], [0.95, '#5a3ed0'], [1, '#8566ec']], sonne: -0.2, schein: ['167,139,250', 0.42, 0.6], wolken: ['196,181,253', 0.13], boden: ['#3c2a86', '#14122c', '#07080b'] },
  ],
  /* Stadt je Stützstelle: sieben Staffeln von fern nach nah, Dunst fern und nah ('r,g,b', Deckkraft) */
  stadt: [
    { tz: 0, c: ['#a9bcd3', '#97abc4', '#8499b4', '#7288a4', '#617893', '#536a84', '#475c74'], fern: ['226,236,247', 0.34], nah: ['176,196,218', 0.2] },
    { tz: 0.5, c: ['#a6b9d1', '#93a8c2', '#8095b1', '#6e84a0', '#5d738f', '#4f657e', '#43576e'], fern: ['224,234,246', 0.32], nah: ['170,190,214', 0.2] },
    { tz: 0.64, c: ['#d7b79c', '#bc9c8a', '#a08477', '#856e69', '#6d5b5c', '#584a50', '#473c45'], fern: ['255,214,160', 0.36], nah: ['214,160,120', 0.2] },
    { tz: 0.8, c: ['#c7805e', '#a26152', '#7f4a49', '#5f3840', '#462a38', '#32202f', '#231726'], fern: ['255,160,96', 0.36], nah: ['150,70,70', 0.18] },
    { tz: 0.9, c: ['#6c4f98', '#523f82', '#3d3068', '#2c2450', '#201b3c', '#17142b', '#100f1f'], fern: ['160,96,170', 0.24], nah: ['40,26,70', 0.18] },
    { tz: 1, c: ['#4a379f', '#3a2c80', '#2b2262', '#1f1a48', '#161432', '#0f0e22', '#0a0a16'], fern: ['110,84,205', 0.2], nah: ['20,16,44', 0.16] },
  ],
  /* Wie hell die Zeichnung am Tag wird (0 = wie im Skript, also Nacht · 1 = voller Tag) und wie das Licht getönt ist, je Stützstelle: innen (Räume), aussen (Haus, Straße, Dach) */
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
/* Abgeleitete Werte der Tageszeit, je Hundertstel einmal gerechnet */
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
    nacht: smooth((z - 0.7) / 0.24),                         // so weit sind die Lichter der Stadt und des Hauses an (0 = Tag, 1 = Nacht)
    sterne: smooth((z - 0.86) / 0.12),
  };
  TAG_WERTE.set(q, w); return w;
}
/* Der Himmel: je Stützstelle eine kleine Fläche (ein Drittel der Auflösung: Verläufe und weiche Wolken vertragen das), dazu Sterne in voller Auflösung, Sonne und Mond als kleine Bilder */
let SKY = [], STERNE = null, SONNE = null, MOND = null, skyH = 0;
function buildSky(w, h, hy, H) {
  const c = document.createElement('canvas'), q = 3; c.width = Math.ceil(w / q); c.height = Math.ceil(h / q);
  const g = c.getContext('2d'), R = mulberry(7), cw = c.width, chy = hy / q, u = cw / 640;
  const sk = g.createLinearGradient(0, 0, 0, chy); for (const [o, k] of H.v) sk.addColorStop(o, k);
  g.fillStyle = sk; g.fillRect(0, 0, cw, chy + 1);
  const sx = cw * TAG.sonneX, sy = chy * (1 - Math.max(-0.02, H.sonne)), rr = cw * H.schein[2], rg = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
  rg.addColorStop(0, `rgba(${H.schein[0]},${H.schein[1]})`); rg.addColorStop(0.12, `rgba(${H.schein[0]},${H.schein[1] * 0.6})`); rg.addColorStop(0.4, `rgba(${H.schein[0]},${H.schein[1] * 0.2})`); rg.addColorStop(1, `rgba(${H.schein[0]},0)`);
  g.globalCompositeOperation = 'screen'; g.fillStyle = rg; g.fillRect(0, 0, cw, chy); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) { // Wolkenbänder: flach und weich, zum Horizont hin dichter
    const y = chy * (0.5 + R() * 0.42), x = R() * cw, rw = (90 + R() * 190) * u, rh = (2 + R() * 4.5) * u, a = H.wolken[1] * (0.45 + R() * 0.55);
    const cg = g.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, `rgba(${H.wolken[0]},${a})`); cg.addColorStop(0.6, `rgba(${H.wolken[0]},${a * 0.45})`); cg.addColorStop(1, `rgba(${H.wolken[0]},0)`);
    g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = cg; g.beginPath(); g.arc(x, y, rw, 0, 7); g.fill(); g.restore();
  }
  for (const [wx, wy, wb] of [[0.67, 0.63, 92], [0.3, 0.3, 70], [0.8, 0.8, 58], [0.08, 0.44, 60]]) { // (links stehen die Wolken hoch: darunter liegt die Überschrift) // ruhige Haufenwolken: runde Kuppen über einer flachen Unterseite (Auftrag Y); nachts fast unsichtbar
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
  { const c = document.createElement('canvas'); c.width = w; c.height = Math.ceil(hy * 0.66); const g = c.getContext('2d'), R = mulberry(7), u = w / 1920; // Sterne: scharf, nur im oberen Himmel
    for (let i = 0; i < 150; i++) { const x = R() * w, y = R() * hy * 0.62; g.fillStyle = `rgba(232,228,255,${(0.14 + R() * 0.55) * (1 - y / (hy * 0.62))})`; const s = (1 + R() * 1.3) * u; g.fillRect(x, y, s, s); } STERNE = c; }
  const scheibe = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, k] of stops) r.addColorStop(o, k); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c; };
  SONNE = [scheibe([[0, 'rgba(255,255,248,1)'], [0.3, 'rgba(255,253,236,1)'], [0.36, 'rgba(255,246,214,.55)'], [0.6, 'rgba(255,240,200,.16)'], [1, 'rgba(255,240,200,0)']]),      // am Tag: weiß
    scheibe([[0, 'rgba(255,236,170,1)'], [0.3, 'rgba(255,196,96,1)'], [0.36, 'rgba(255,150,70,.6)'], [0.62, 'rgba(255,120,60,.18)'], [1, 'rgba(255,110,60,0)']])];                  // tief: gold bis rot
  MOND = scheibe([[0, 'rgba(244,240,255,1)'], [0.2, 'rgba(236,230,255,1)'], [0.24, 'rgba(214,204,255,.3)'], [0.6, 'rgba(190,176,255,.07)'], [1, 'rgba(190,176,255,0)']]);
}
function himmel() {
  const y = Math.round(S.cy - skyHy), [i, t] = stuetze(TAG.himmel, TZ), W = tagWerte();
  ctx.drawImage(SKY[i], 0, y, S.w, skyH);
  if (t > 0.004) { ctx.globalAlpha = t; ctx.drawImage(SKY[i + 1], 0, y, S.w, skyH); ctx.globalAlpha = 1; }
  if (W.sterne > 0.01) { ctx.globalAlpha = W.sterne; ctx.drawImage(STERNE, 0, y); ctx.globalAlpha = 1; }
  if (W.sonne > -0.09) { // die Sonne: am Tag weiß und klein, zum Abend größer und golden; sie sinkt hinter die Stadt (die danach gezeichnet wird)
    const tief = smooth((0.3 - W.sonne) / 0.24), r = S.w * (0.05 + 0.035 * tief), sx = S.w * TAG.sonneX, sy = S.cy - W.sonne * skyHy;
    if (tief < 0.99) { ctx.globalAlpha = 1 - tief; ctx.drawImage(SONNE[0], sx - r, sy - r, 2 * r, 2 * r); }
    if (tief > 0.01) { ctx.globalAlpha = tief; ctx.drawImage(SONNE[1], sx - r, sy - r, 2 * r, 2 * r); }
    ctx.globalAlpha = 1;
  }
  if (W.sterne > 0.05) { const r = S.w * 0.026; ctx.globalAlpha = W.sterne; ctx.drawImage(MOND, S.w * 0.905 - r, S.cy - 0.6 * skyHy - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
}
/* ── TON: die Lichtrechnung für alles Gezeichnete. Eine Klasse sagt, wie eine dunkle Fläche am Tag aussieht: hell = a + b · Helligkeit, satt = wie viel Farbe bleibt, t = Tönung dazu.
      aus = 'innen' | 'aussen' (welche Stärke aus TAG.licht gilt). Farben mit Deckkraft: Schwarz bleibt Schatten bzw. Fuge, dunkle Schleier werden dünner,
      Lichter (im Modus „lighter“) werden am Tag schwach. Satte, helle Farben (Raumfarbe, Leuchten) bleiben. ── */
const TON_KLASSEN = {
  schale: { a: 0.6, b: 0.95, satt: 0.38, aus: 'innen', t: [1, 1, 1] },          // Decke, Boden, Wände eines Raums
  ding: { a: 0.22, b: 1.05, satt: 0.8, aus: 'innen', t: [1, 1, 1] },           // Möbel, Geräte, alles an der Wand
  turm: { a: 0.4, b: 1.0, satt: 0.55, aus: 'aussen', t: [0.9, 0.97, 1.08] },    // die Fassade: Glas, in dem sich der Himmel spiegelt
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
function tonRechne(v) { // → [Farbe, Farbe im Modus „lighter“]
  let r, g, b, a = 1;
  if (v[0] === '#') { if (v.length === 7) { r = parseInt(v.slice(1, 3), 16); g = parseInt(v.slice(3, 5), 16); b = parseInt(v.slice(5, 7), 16); } else if (v.length === 4) { r = parseInt(v[1] + v[1], 16); g = parseInt(v[2] + v[2], 16); b = parseInt(v[3] + v[3], 16); } else return [v, v]; }
  else { const m = FARBE_RE.exec(v); if (!m) return [v, v]; r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] === undefined ? 1 : +m[4]; }
  const K = TON.kl, h = TON.h, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (a < 1) {
    if (mx <= 3) return [v, v];                                                                             // Schatten, Fugen
    if (mx <= 70) { const s = `rgba(${r},${g},${b},${+(a * (1 - 0.72 * h)).toFixed(3)})`; return [s, s]; }  // dunkle Schleier (Glas, Dunkel im Raum) werden am Tag dünn
    return [v, `rgba(${r},${g},${b},${+(a * (1 - 0.78 * h)).toFixed(3)})`];                                 // Lichter: am Tag schwach
  }
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255, sat = mx ? (mx - mn) / mx : 0;
  const gew = h * (1 - smooth((sat - 0.5) / 0.3) * smooth((L - 0.22) / 0.25)) * (1 - smooth((L - 0.72) / 0.2)); // satte, helle Farben und alles Helle bleiben
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
/* Eine Zeichenfläche an die Lichtrechnung hängen: Füll- und Strichfarbe und die Farben der Verläufe laufen durch tonFarbe, solange eine Klasse eingeschaltet ist */
function tonHaken(g) {
  if (g._ton) return g; g._ton = true;
  const Pt = CanvasRenderingContext2D.prototype;
  for (const name of ['fillStyle', 'strokeStyle']) { const d = Object.getOwnPropertyDescriptor(Pt, name); Object.defineProperty(g, name, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, TON.kl && typeof v === 'string' ? tonFarbe(v, this) : v); } }); }
  for (const name of ['createLinearGradient', 'createRadialGradient']) g[name] = function (...a) { const gr = Pt[name].apply(this, a); if (TON.kl) { const add = gr.addColorStop, ziel = this; gr.addColorStop = (o, c) => add.call(gr, o, typeof c === 'string' ? tonFarbe(c, ziel) : c); } return gr; };
  return g;
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
    if (L >= 3) b.forEach((q, i) => { q.t = (hash(i, L * 31 + 5) * 4) | 0; const r = hash(i, L * 17 + 3); if (r < 0.5) q.auf = [0.1 + hash(i, L + 61) * 0.4, 0.28 + hash(i, L + 67) * 0.24, 3 + r * 9]; if (r > 0.86) q.mast = [0.2 + hash(i, L + 71) * 0.6, 6 + hash(i, L + 73) * 9]; }); // Fassadenraster, Dachaufbau [Stelle, Breite, Höhe], Antenne [Stelle, Höhe]: aus der Nummer des Hauses (die Stadt selbst bleibt, wie sie war)
    return { D, b, L };
  });
}
/* Fassaden der Stadt (Auftrag Y): ein kleiner Atlas aus vier Rastern, nur Deckkraft (dunkle Fensterbänder und Fenster, helle Brüstungen, Pfeiler, Attika). Er liegt auf der Farbe der Staffel
   und stimmt so zu jeder Tageszeit. Je nahem Haus EIN eingesetztes Bild (alle aus derselben Fläche), die fernen Staffeln bleiben Flächen im Dunst. Ein Raster deckt CITY_KM Meter, CITY_PXM Pixel je Meter. */
const CITY_PXM = 2.5, CITY_KM = [128, 140], CITY_GESCHOSS = 3.5; let CITY_TEX = null, FEIN_STADT = false; // FEIN_STADT: die ruhende Fläche eines Raums entsteht (im Raum trägt die Stadt ihre Fassaden nur dort: Fährt die Kamera, bleibt sie Fläche und kostet je Bild nicht mehr als vorher)
function buildCityTex() {
  const m = CITY_PXM, tw = Math.round(CITY_KM[0] * m), th = Math.round(CITY_KM[1] * m), c = document.createElement('canvas'); c.width = tw * 4; c.height = th; const g = c.getContext('2d'), G = CITY_GESCHOSS * m;
  const dunkel = (a) => `rgba(10,18,40,${a})`, hell = (a) => `rgba(255,255,255,${a})`, y0 = 2.2 * m;
  for (let v = 0; v < 4; v++) {
    g.save(); g.beginPath(); g.rect(v * tw, 0, tw, th); g.clip(); g.translate(v * tw, 0);
    g.fillStyle = hell(0.2); g.fillRect(0, 0, tw, 1.0 * m); g.fillStyle = dunkel(0.24); g.fillRect(0, 1.0 * m, tw, 0.6 * m); // Attika mit Schattenfuge
    if (v === 0) { // Bandfassade: Fensterbänder, darunter die helle Brüstung, alle sechs Meter ein Pfeiler
      for (let y = y0; y < th; y += G) { g.fillStyle = dunkel(0.3); g.fillRect(0, y, tw, 1.9 * m); g.fillStyle = hell(0.13); g.fillRect(0, y + 1.9 * m, tw, 0.5 * m); }
      g.fillStyle = hell(0.09); for (let x = 0; x < tw; x += 6 * m) g.fillRect(x, y0, 0.6 * m, th);
    } else if (v === 1) { // Lochfassade: einzelne Fenster mit Fensterbank
      for (let y = y0; y < th; y += G) for (let x = 1.0 * m; x < tw; x += 3 * m) { g.fillStyle = dunkel(0.34); g.fillRect(x, y, 1.6 * m, 2.0 * m); g.fillStyle = hell(0.14); g.fillRect(x, y + 2.0 * m, 1.6 * m, 0.4 * m); }
    } else if (v === 2) { // Lisenen: schmale senkrechte Rippen vor dunklem Glas, Geschossfugen
      g.fillStyle = dunkel(0.22); g.fillRect(0, y0, tw, th); g.fillStyle = hell(0.15); for (let x = 0; x < tw; x += 3 * m) g.fillRect(x, y0 - 0.6 * m, 0.8 * m, th);
      g.fillStyle = dunkel(0.2); for (let y = y0 + G; y < th; y += G) g.fillRect(0, y, tw, 0.5 * m);
    } else { // Glas im Raster: Felder, in denen sich der Himmel verschieden spiegelt
      for (let y = y0, i = 0; y < th; y += G, i++) for (let x = 0, j = 0; x < tw; x += 6 * m, j++) { const r = hash(i, j); g.fillStyle = r < 0.22 ? hell(0.07) : dunkel(0.12 + r * 0.1); g.fillRect(x + 0.4 * m, y, 5.2 * m, 2.9 * m); }
    }
    g.fillStyle = hell(0.1); g.fillRect(0, 0, 0.8 * m, th); // die Kante zum Licht
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
      if (fas && w > 12) { // Dachaufbau und Antenne über der Dachkante, dann das Fassadenraster
        if (b.auf && top > 0) ctx.fillRect(x + w * b.auf[0], top - b.auf[2] * k, w * b.auf[1], b.auf[2] * k + 1);
        if (b.mast && top > 0 && k > 0.9) ctx.fillRect(x + w * b.mast[0], top - b.mast[1] * k, Math.max(1, 0.5 * k), b.mast[1] * k + 1);
        ctx.globalAlpha = fa; ctx.drawImage(CITY_TEX, b.t * ftw, 0, Math.min(ftw, b.w * CITY_PXM), Math.max(1, Math.min(CITY_TEX.height, ((bot - top) / k) * CITY_PXM)), x, top, w + 0.7, bot - top); ctx.globalAlpha = 1;
      }
      if (fn > 0.02 && b.win.length && w > 6) { // die Fenster gehen ab der Dämmerung nach und nach an (jedes hat seinen Moment)
        const s = Math.max(1, Math.min(3.2, w * 0.035));
        for (const [wu, wv, r] of b.win) { const an = (fn - ((r * 7.31) % 1) * 0.82) * 7; if (an <= 0) continue; const wy = top + (L.L >= 3 ? Math.floor((wv * b.h) / CITY_GESCHOSS) * CITY_GESCHOSS + 2.7 : wv * b.h) * k; /* in der Reihe der Geschosse */ if (wy < 0 || wy > bot) continue; ctx.fillStyle = winCol(r, (0.18 + r * 0.45) * Math.min(1, an)); ctx.fillRect(x + wu * w, wy, s, s); }
      }
    }
    const [rgb, a] = L.L < 3 ? W.fern : W.nah, hz = ctx.createLinearGradient(0, S.cy - 40 * u, 0, S.cy + 90 * u);
    hz.addColorStop(0, `rgba(${rgb},0)`); hz.addColorStop(1, `rgba(${rgb},${Math.max(0, a - L.L * 0.02)})`);
    ctx.fillStyle = hz; ctx.fillRect(0, S.cy - 40 * u, S.w, 130 * u);
  }
}

/* Wände und Bildschirme der Etagen: nur Balken, Linien und Formen, keine Schrift, keine Zahlen */
const pale = (a) => `rgba(246,244,240,${a})`;
const TEX_Q = 0.6; // die Bildschirme und Wandtafeln stehen klein im Bild: Ihre Flächen brauchen nicht die volle Größe (Speicher)
function tex(w, h, seed, draw) { const c = document.createElement('canvas'); c.width = Math.round(w * TEX_Q); c.height = Math.round(h * TEX_Q); const g = c.getContext('2d'); g.scale(TEX_Q, TEX_Q); draw(g, mulberry(seed), (x, y, bw, bh, col, r = bh / 2) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill(); }); return c; }
function pfeil(g, x0, y0, x1, y1, s = 12) { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.moveTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s); g.lineTo(x1, y1); g.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s); g.stroke(); }
function buildTextures() {
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
  TEX.web1 = TEX.web; // Story: die Fassung mit Bild, Text und drei Abschnitten
  TEX.web0 = tex(900, 540, 5, (g, R, bar) => { // Landing: eine Seite, ein Satz, ein Knopf
    g.fillStyle = '#0d0d14'; g.fillRect(0, 0, 900, 540); g.fillStyle = '#191822'; g.fillRect(0, 0, 900, 46);
    for (let i = 0; i < 3; i++) { g.fillStyle = pale(0.3); g.beginPath(); g.arc(26 + i * 24, 23, 7, 0, 7); g.fill(); }
    bar(40, 78, 96, 16, pale(0.55)); bar(760, 81, 100, 10, pale(0.24));
    bar(200, 170, 500, 44, pale(0.88), 8); bar(260, 232, 380, 44, pale(0.88), 8); bar(280, 300, 340, 12, pale(0.3)); bar(320, 324, 260, 12, pale(0.3));
    bar(360, 372, 180, 50, AKZ.studios, 8);
    bar(120, 470, 660, 2, pale(0.14)); bar(120, 492, 200, 10, pale(0.2)); bar(580, 492, 200, 10, pale(0.2));
  });
  TEX.web2 = tex(900, 540, 5, (g, R, bar) => { // Cinematic: großes Bild über die ganze Fläche, Licht, Tiefe, ein Film
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
  // MAKE Revenue: die Pipeline in Spalten (Lead bis Abschluss), die Anrufliste
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
  // MAKE Innovation: Bildschirm an der Werkbank: links Zeilen eines Aufbaus, rechts ein Drahtmodell
  TEX.bau = tex(800, 520, 71, (g, R, bar) => {
    g.fillStyle = '#0b0b12'; g.fillRect(0, 0, 800, 520); g.fillStyle = '#151422'; g.fillRect(0, 0, 800, 42); bar(22, 15, 100, 11, pale(0.45));
    for (let i = 0; i < 12; i++) { const ind = [0, 1, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0][i]; bar(26 + ind * 28, 66 + i * 36, 60 + ((i * 53) % 160), 11, i === 5 ? 'rgba(167,139,250,.85)' : pale(0.3 + (i % 3) * 0.08)); }
    g.strokeStyle = 'rgba(205,192,255,.7)'; g.lineWidth = 3; g.lineJoin = 'round'; const c = [540, 270], s = 110;
    const P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => [c[0] + (x + z * 0.5) * s, c[1] + (y - z * 0.4) * s * 0.8]);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { g.beginPath(); g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); }
    g.fillStyle = 'rgba(139,92,246,.35)'; g.beginPath(); g.moveTo(P[4][0], P[4][1]); g.lineTo(P[5][0], P[5][1]); g.lineTo(P[6][0], P[6][1]); g.lineTo(P[7][0], P[7][1]); g.closePath(); g.fill();
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
  FLOORS.forEach((F, i) => { const [a, b] = floorRange(i), y = F.base + F.eye, zu = !!F.zu; KF.push({ p: a + (b - a) * TRAVEL_PART, x: zu ? xB : xA, y, z: zu ? zB : zA, cy: cyT }, { p: b, x: xB, y, z: zB, cy: cyT }); }); // vor der geschlossenen Tür (zu) steht die Kamera gleich nach der Fahrt an ihrem Platz: kein Heranschieben
  KF.push({ p: THREAD[1], x: n ? -22 : -23, y: n ? -64 : -66, z: n ? -128 : -215, cy: 0.5 });   // das ganze Haus
  KF.push({ p: SPOTS[1], x: n ? 2 : -10.5, y: n ? -2 : 4, z: n ? -56 : -40, cy: n ? 0.4 : 0.7 });   // das Dach
  KF.push({ p: 1, x: n ? 2 : -10, y: n ? -2 : 4.3, z: n ? -52 : -37, cy: n ? 0.4 : 0.7 });
}
const insideK = (p, i) => { const [a, b] = floorRange(i), d = ((p - a) / (b - a) - TRAVEL_PART) / (1 - TRAVEL_PART); return d <= 0 || d >= 1 ? 0 : smooth((d - 0.08) / 0.22) * (1 - smooth((d - 0.78) / 0.18)); };
let INS = { k: 0, i: -1, F: null }, AKT = { k: 0, F: null }; // INS: der Raum, in dem die Kamera gerade steht · AKT: dasselbe oder das Dach
let NCY = 0.235, NDZ = 2.5, NCYD = 0.19, NZF = 1; // nur Handy (schmal): Höhe der Bildmitte im Raum, Abstand der Kamera auf dem Dach und Höhe der Bildmitte auf dem Dach, je Szene (szenen.json › bild.cyn, dz, cyd, fzd)
let ZOOM = 1; // 1 = so viele Meter, wie der Raum vorgibt; kleiner = näher heran (je Szene, szenen.json › bild.zoom)
let FZ = 1, DX = 0, DY = 0; // vor dem Haus: näher heran und seitlich bzw. in der Höhe versetzt (szenen.json › bild.fz, dx, dy; am Handy fzn, dxn, dyn), z. B. vor der geschlossenen Tür
/* Im Raum: SCHWELLE = so weit steht die Kamera im Raum, wenn der Aufzug gerade gehalten hat · DRIN = so weit ist sie hineingegangen (Meter hinter der Glasfront).
   TRITT (0 … 1) läuft am Anfang des Halts von der Schwelle hinein und am Ende wieder heraus (trittVon); mit dem Finger gibt es keinen Halt, dort steht die Kamera gleich drin. */
const SCHWELLE = 0.3, DRIN = 1.5, TRITT_ANTEIL = 0.22;
let TRITT = 1;
/* Die freie Fläche neben der Tafel: breit rechts von ihr (haus.css: Tafel 42 %, schmal 50 %), am Handy das Bild über dem Blatt */
const freiFlaeche = () => (wide.matches && !S.narrow ? [innerWidth <= 1100 ? 0.5 : 0.42, 1] : [0, 1]);
const dachK = (p) => { const [a, b] = floorRange(DACH_HALT), q = (p - a) / (b - a); return q <= 0 || q > 1 ? 0 : smooth((q - 0.48) / 0.17) * (1 - smooth((q - 0.9) / 0.085)); };
/* Am Handy liegt die Bildmitte des Raums in der freien Fläche zwischen Kopf und Blatt (gemessen, nicht geschätzt: mitteMessen); ist eine Karte offen, in der Fläche über der Karte.
   Vor dem ersten Messen und im Empfang gilt der Wert der Szene (szenen.json › bild.cyn). */
const MITTE = {};
function mitteN(key) { const m = MITTE[key]; if (!m) return NCY; const f = FOK.st && FOK.st.key === key ? FOK.k.v : 0; return f > 0 && m.karte != null ? lerp(m.blatt, m.karte, f) : m.blatt; }
function innenCam() {
  const F = INS.F, k = INS.k, MK = MARKE[F.key], [L, R] = freiFlaeche();
  const dRef = 6.6, br = ((S.narrow && MK.breiteN) || MK.breite || 4.6) * ZOOM, fIn = Math.min(S.w * 1.5, ((R - L) * S.w * dRef) / br); // die Breite des Raums passt in die freie Fläche
  // Der Fluchtpunkt liegt in der Mitte der freien Fläche: Der Raum steht gerade vor dir, am Rechner wie am Handy (die Tafel verdeckt nur seinen linken Rand)
  cam.x = lerp(cam.x, zoneX(F.key), k); cam.y = lerp(cam.y, F.base + 1.5, k); cam.z = lerp(cam.z, lerp(SCHWELLE, DRIN, S.narrow ? 1 : TRITT), k);
  S.f = lerp(S.f, fIn, k); S.cy = lerp(S.cy, S.h * (S.narrow ? mitteN(F.key) : 0.53), k); S.cx = lerp(S.cx, S.w * (L + R) / 2, k);
}
function dachCam(k) { // auf dem Dach steht die Kamera vor der Terrasse, nah genug, dass Moderator, Publikum und der Stand des Abendpartners zu lesen sind; die Bühne steht gerade vor dem Besucher in der freien Fläche neben der Tafel (wie in den Räumen)
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
/* Die Kamera für eine Ansicht: entweder auf der Zeitachse (der Aufzug fährt) oder als Flug von einer Stelle zur anderen (blende). Eine Stelle ist eine Zahl der Zeitachse oder eine eigene Lage { x, y, z, cy }. */
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
  // Der Raum am Anfang bzw. am Ende des Flugs bleibt ein Raum: Er blendet in der ersten bzw. letzten knappen Hälfte aus und ein (sonst spränge sein Licht beim Ankommen)
  const ka = 1 - smooth(t / 0.45), kb = smooth((t - 0.55) / 0.45), von = (q, k) => ({ k: q.k * k, i: q.i ?? -1, F: q.F });
  INS = a.ins.k * ka > 0 ? von(a.ins, ka) : b.ins.k * kb > 0 ? von(b.ins, kb) : { k: 0, i: -1, F: null };
  AKT = INS.k > 0 ? INS : a.akt.k * ka > 0 ? von(a.akt, ka) : b.akt.k * kb > 0 ? von(b.akt, kb) : { k: 0, F: FLOORS[DACH_HALT] };
}

/* Wo der Kern gerade ist: erst auf dem Sockel im Erdgeschoss, dann in der Kabine, auf zwei Etagen steigt er aus
   (in den Räumen zum Hineingehen: Hocker bei MAKE Studios, Tisch im Podcast, sonst ein Stehtisch), am Ende steht er auf der Bühne. door: 1 = Tür offen, 0 = zu */
function coreState(p) {
  const q0 = (p - TOUR_START) / FLOOR_LEN;
  const G0 = MARKE.strasse.kernG || 1; // im Empfang liegt der Kern klein auf seinem Sockel
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
    if (out) { // der Kern steigt aus, liegt im Licht und steigt wieder ein
      const s = smooth(d / 0.16) * (1 - smooth((d - 0.84) / 0.16));
      c.x = lerp(SHAFT.x, out[0], s); c.z = lerp(SHAFT.z, out[2], s); c.y = base + lerp(1.25, out[1], s) + Math.sin(s * Math.PI) * 0.35; c.im = s > 0.5 ? F.key : null; c.g = lerp(1, G, s);
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
  const k = S.f / dz, q = P(c.x, c.y, c.z), L = clamp01(c.level), R = Math.max(1.6, (0.25 + 0.13 * L + 0.4 * clamp01((c.level - 1) / 0.3)) * k * (c.g || 1)); // auf der Bühne, im Licht, wird er groß
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

/* Möbel und Gerät */
const M = { top: '#5a586e', front: '#1c1b26', side: '#262532' };
function tripod(x, z, h) { // Kamera auf Stativ, von hinten gesehen: sie zeigt in den Raum
  const lw = lwAt(z, 0.05);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [0, 0.5]]) seg([x, h, z], [x + dx, 0, z + dz], '#07070c', lw);
  box(x - 0.09, x + 0.09, h + 0.06, h + 0.22, z + 0.3, z + 0.56, '#2b2a38', '#0b0b10', '#15141c');
  box(x - 0.18, x + 0.18, h, h + 0.28, z - 0.16, z + 0.3, '#3a3849', '#101016', '#1b1a25');
  fillZ(x - 0.11, x + 0.11, h + 0.07, h + 0.21, z - 0.165, `rgba(${LAVH},.85)`);
  glow(x, h + 0.14, z - 0.17, 0.5, [[0, `rgba(${LAV},.35)`], [1, `rgba(${LAV},0)`]]);
}

/* Ein weicher Lichtfleck auf dem Boden (rund, in der Perspektive flach gedrückt) */
function bodenlicht(x, z, r, rgb, a) {
  const dz = z - cam.z; if (NACHZUG || dz < 0.6 || a < 0.004) return; const q = P(x, 0.005, z), rx = (r * S.f) / dz, sq = Math.min(0.9, Math.max(0.08, (cam.y - oy) / dz));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q[0], q[1]); ctx.scale(1, sq);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.6, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore();
}
const schatten = (xa, xb, za, zb) => !NACHZUG && poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');
function hocker(x, h, z) { // darauf liegt der Kern
  if (FEIN) fleck(x, z, 0.34, 0.3, 0.2, h); else schatten(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  const B = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz]) => [[x + dx * 0.16, h - 0.05, z + dz * 0.16], [x + dx * 0.25, 0, z + dz * 0.25]]);
  linien(B, '#1a1922', lwAt(z, 0.04));
  if (FEIN) { const r = B.map(([a, b]) => [lerp(a[0], b[0], 0.62), lerp(a[1], b[1], 0.62), lerp(a[2], b[2], 0.62)]); linien([[r[0], r[1]], [r[1], r[3]], [r[3], r[2]], [r[2], r[0]]], '#1a1922', lwAt(z, 0.022)); } // die Fußstreben
  box(x - 0.23, x + 0.23, h - 0.07, h, z - 0.23, z + 0.23, '#ddd7ea', '#77728f', '#6d6884');
  if (FEIN) fillZ(x - 0.23, x + 0.23, h - 0.012, h, z - 0.231, 'rgba(255,255,255,.5)');
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
  if (FEIN) glow(x, y + 0.2, z + 0.1, 0.8, [[0, `rgba(${LAV},.22)`], [1, `rgba(${LAV},0)`]]); // (das Leuchten nur ausgearbeitet: Ein Verlauf je Bild kostet)
}
function flach(x0, x1, z0, z1, y, fill) { return poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill); } // Rechteck auf einer Tischplatte
function tafel(x0, x1, y0, y1, z, tx, rahmen, a = 1) { // Wandfläche mit vorgerenderter Textur (nur Formen, keine Schrift)
  const d = rectZ(x0, x1, y0, y1, z); if (!d || !tx) return null;
  const b = Math.max(1.5, d[2] * 0.01); ctx.fillStyle = rahmen || '#07070c'; ctx.fillRect(d[0] - b, d[1] - b, d[2] + 2 * b, d[3] + 2 * b);
  ctx.globalAlpha = a; ctx.drawImage(tx, d[0], d[1], d[2], d[3]); ctx.globalAlpha = 1; return d;
}
/* ═══════════════ RÄUME: die Leistungen sind Menschen im Raum ═══════════════
   RAEUME kommt aus haus/raeume.json (der Bau setzt es ein): je Raum die Leistungen mit Platz (x, z), Figur, Weg und Varianten (Preis als Zahl, Rhythmus e | m | a | f),
   MENSCHEN aus haus/figuren.json. Der Zustand je Leistung: drin (im Paket), v (gewählte Variante), u (0 = am Platz … 1 = hat den Raum verlassen), hov (Zeiger darüber).
   Liste, Karten, Schilder (HTML) und die Zeichnung zeigen denselben Zustand; gemerkt wird er im localStorage (nur Kennungen).
   Gezeichnet werden die Menschen vom Figuren-System (FIG, haus/figuren.js). Hier steht, was der Raum dazu weiß: wo jemand steht, wie er dort arbeitet,
   wie er aufsteht, auf welchem Weg er um die Möbel zur Tür geht, und in welcher Reihenfolge Menschen und Möbel einander verdecken (DINGE). */
/*FIGUREN-SYSTEM*/
const RAEUME = /*RAEUME*/[]/*RAEUME-ENDE*/;
const MENSCHEN = /*MENSCHEN*/{}/*MENSCHEN-ENDE*/;
const RAUM = {};                                           // nach der Zeichnung (FLOORS › key)
const rad = (g) => (g * Math.PI) / 180;
/* Die Schale der Arbeitsräume (Decke, Boden, rechte Wand, Rückwand) je Raum: Farben als Verläufe; fliesen = der Boden hat Fliesen statt Dielen (die zeichnet dann der Raum selbst) */
const SCHALE = {
  revenue: { decke: [[0, '#292826'], [0.4, '#1a1918'], [1, '#0b0b0a']], boden: [[0, '#484643'], [0.3, '#2d2b29'], [1, '#111010']], wandR: [[0, '#3b3936'], [0.3, '#252321'], [1, '#0e0d0c']], rueck: [[0, '#22201e'], [0.7, '#2c2a27'], [1, '#363330']], fliesen: true }, // neutral und hell am Tag: Das Blau der Marke bleibt Akzent (Teppich, Möbel, Leuchten, Kleidung), nicht die Farbe des ganzen Raums
  innovation: { decke: [[0, '#2a2932'], [0.4, '#18171e'], [1, '#0a0a0f']], boden: [[0, '#4a4850'], [0.3, '#2c2b31'], [1, '#101013']], wandR: [[0, '#3a3942'], [0.3, '#24232b'], [1, '#0c0c11']], rueck: [[0, '#211f29'], [0.7, '#2b2a34'], [1, '#35333f']], fliesen: true }, // neutral mit einem Hauch Lavendel: Das Violett bleibt Akzent (Markierungen, Tafeln, Leuchten, Kleidung)
  pr: { decke: [[0, '#2a2634'], [0.4, '#17151f'], [1, '#09080e']], boden: [[0, '#5a4c50'], [0.3, '#362e32'], [1, '#120f12']], wandR: [[0, '#40383f'], [0.3, '#27222a'], [1, '#0d0b10']], rueck: [[0, '#262130'], [0.7, '#312b3c'], [1, '#3c3548']] }, // Wände neutral mit einem Hauch Violett, der Boden warmes Holz: Farbe geben Pinnwand, Presse-Wand, Teppich und das Licht der goldenen Stunde
};
/* Licht je Raum für die Menschen: amb = so hell und so getönt liegen die Eigenfarben im Raum · licht = Farbe der Lichtquelle · schatten = Farbe der Schatten · saum = Farbe des Lichtsaums · L = Richtung zum Licht im Bild */
/* gegen, gegenA = schwaches zweites Licht von der Gegenseite (Farbe, Deckkraft) */
const LICHT = {
  studios: { id: 'studios', amb: [0.98, 0.95, 0.92], licht: [255, 246, 232], schatten: [92, 74, 80], saum: '255,244,226', L: [-0.5, -0.86], gegen: '255,255,255', gegenA: 0.18, heb: 6 },     // Mittag: helles Tageslicht, die Studioleuchten als warmer Akzent
  revenue: { id: 'revenue', amb: [0.94, 0.97, 1], licht: [236, 244, 255], schatten: [66, 80, 108], saum: '226,238,255', L: [-0.45, -0.89], gegen: '200,226,255', gegenA: 0.3, heb: 6 },       // früher Nachmittag: hell und kühl
  innovation: { id: 'innovation', amb: [0.98, 0.92, 0.84], licht: [255, 232, 198], schatten: [88, 64, 70], saum: '255,222,176', L: [0.5, -0.86], heb: 6 },                                     // später Nachmittag: die Sonne steht tiefer und rechts, erstes warmes Licht
  pr: { id: 'pr', amb: [0.86, 0.74, 0.64], licht: [255, 204, 150], schatten: [58, 36, 52], saum: '255,192,124', L: [0.62, -0.78], gegen: '170,160,255', gegenA: 0.2, heb: 8 },                 // goldene Stunde: warmes Seitenlicht von rechts
  lav: { id: 'lav', amb: [0.84, 0.8, 0.94], licht: [236, 226, 255], schatten: [30, 22, 58], saum: '214,200,255', L: [-0.4, -0.92] },
  halle: { id: 'halle', amb: [0.98, 0.96, 0.92], licht: [255, 248, 236], schatten: [84, 76, 76], saum: '255,246,230', L: [0, -1], heb: 6 },                                                    // später Vormittag: Tageslicht fällt herein
  strasse: { id: 'strasse', amb: [1, 0.99, 0.97], licht: [255, 250, 240], schatten: [72, 78, 98], saum: '255,250,236', L: [0.5, -0.86], heb: 4 },                                              // Vormittag auf der Straße
  abend: { id: 'abend', amb: [0.56, 0.52, 0.6], licht: [255, 232, 204], schatten: [16, 12, 30], saum: '255,236,214', L: [0.25, -0.97], heb: 10 },
  nacht: { id: 'nacht', amb: [0.24, 0.23, 0.3], licht: [255, 226, 196], schatten: [6, 6, 12], saum: '255,236,214', L: [0.5, -0.86], heb: 5 },
};
/* Haltungen am Platz: sitz = Höhe der Sitzfläche (sonst steht der Mensch) · l, r = Arme (FIG.ARME) · dl, dr = was die Hände halten · w = Gewicht auf dem rechten (+) oder linken (−) Bein · leben = was die Hände tun.
   Dieselben Namen prüft der Bau (haus-bau.mjs › HALTUNGEN). */
const HALT = {
  tippt: { sitz: 0.46, l: 'tippt', r: 'maus', leben: 'tippt' },
  sitzt: { sitz: 0.46, l: 'schoss', r: 'schoss' },
  'sitzt-spricht': { sitz: 0.46, l: 'tippt', r: 'spricht', leben: 'spricht' },
  'sitzt-sessel': { sitz: 0.46, l: 'auflage', r: 'auflage' },                       // im Sessel, beide Arme auf den Lehnen
  'sessel-spricht': { sitz: 0.46, l: 'auflage', r: 'spricht', leben: 'spricht' },   // im Sessel, eine Hand spricht mit
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
const GEH_TEMPO = 1.4 / 1000, SCHRITT = FIG.SCHRITT_M, TUER_H = 2.12; // gelassener Schritt in Metern je ms · Länge eines Schritts in Metern (daran hängt die Schrittphase: kein Rutschen) · Höhe der Tür
const AUF_ZEIT = { sitz: 1800, steh: 1100 };               // ms am Platz, bevor jemand losgeht: aufstehen bzw. zusammenpacken, dann in die Gehrichtung drehen
const TUER_ABSTAND = 520;                                  // ms zwischen zwei Menschen in der Tür
const WENDE_MS = 520;                                      // so lange dreht sich im Stand um, wer mitten im Gehen zurückgeholt wird
const DREH_TEMPO = 0.011;                                  // so schnell dreht sich ein Mensch in die neue Richtung (Bogenmaß je ms)
const personen = new Map();
const menschVon = (id, akzent) => { const k = id + akzent; let m = personen.get(k); if (!m) { m = FIG.mensch(id, MENSCHEN[id] || {}, akzent); personen.set(k, m); } return m; };
/* Der Weg eines Menschen vom Platz zur Tür: Wegpunkte um die Möbel herum (raeume.json › figur.weg), als weiche Kurve; das letzte Stück führt gerade durch die Tür in den Flur. */
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
function ortAufWeg(w, s) { // die Stelle nach s Metern: [x, z, Richtung]
  s = Math.min(w.len, Math.max(0, s)); let lo = 0, hi = w.cum.length - 2;
  while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (w.cum[mi] <= s) lo = mi; else hi = mi - 1; }
  const a = w.pts[lo], b = w.pts[lo + 1], t = (s - w.cum[lo]) / Math.max(1e-6, w.cum[lo + 1] - w.cum[lo]);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[0] - a[0], b[1] - a[1])];
}
function personBauen(st, l, d, n, wegFrei = null) { // wegFrei: der ganze Weg (ohne Tür in der Rückwand)
  const x = d.platz ? d.platz[0] : l.x, z = d.platz ? d.platz[1] : l.z, halt = HALT[d.haltung] || HALT.steht, m = menschVon(d.mensch, st.akzent), w = wegFrei ? wegBauen([x, z], wegFrei, null) : wegBauen([x, z], d.weg || [], st.tuer), blick = rad(d.blick || 0), boden = d.boden || 0;
  return { l, st, n, m, halt, x, z, blick, boden, schild: d.schild || null, sessel: !!d.sessel, paar: d.gespraech ?? null, teil: d.teil ? 1 : 0, licht: d.licht || null, tasche: d.tasche !== false, w, verz: 0, tA: halt.sitz ? AUF_ZEIT.sitz : AUF_ZEIT.steh, tW: w.len / GEH_TEMPO, saat: 1 + hash(l.n * 7 + n, st.L.length) * 9, hd: blick, schritt: 0, sAlt: 0,
    hoch: (halt.sitz ? halt.sitz + 0.09 + 0.82 * m.gr : 1.78 * m.gr) + boden };
}
/* Wer wann losgeht: Alle brechen zusammen auf (ein langer Weg wird also früh begonnen, nicht schneller gegangen). Damit sie nacheinander durch die Tür gehen,
   wartet am Platz einen Moment, wer sonst gleichzeitig mit einem anderen an der Tür wäre. */
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
/* Wie sehr eine Leistung im Raum da ist (1 = am Platz, 0 = gegangen): danach richten sich Licht und Bildschirme ihres Platzes */
const da = (key, id) => { const l = RAUM[key] && RAUM[key].nach[id]; return l ? 1 - smooth(l.u / 0.5) : 1; };
let raumLebt = 0;                                          // bis zu diesem Zeitpunkt bewegt sich im Raum etwas von selbst (Überblenden einer Variante): so lange wird in vollem Takt gezeichnet
/* Eine Geste der Geräte: alle paar Sekunden regt sich etwas für gut eine Sekunde (0 → 1 → 0), reihum und ruhig (die Kamera schwenkt, der Zeiger auf dem Bildschirm greift). Bei „weniger Bewegung“ und im Standbild nie. */
const GESTE_TAKT = 6400, GESTE_DAUER = 1500;
function geste(l, t) {
  if (reduce || !t) return 0;
  const g = (t + l.n * 2300) % GESTE_TAKT; if (g > GESTE_DAUER) return 0;
  return Math.sin((g / GESTE_DAUER) * Math.PI);
}
/* ═══════════════ TAKTGEBER DER MENSCHEN (Auftrag AB, 22.11.) ═══════════════
   In Ruhe steht ein Mensch still. Bewegung gibt es nur als einzelne, weiche Bewegung mit Anlauf und Ausklang, und der Raum vergibt, wer sich als Nächstes bewegt:
   Alle TAKT_H ms beginnt ein Takt, der zwei Längen dauert (eine Bewegung selbst dauert 0,6 bis 2,4 s; danach ist wieder Ruhe); in jedem ist höchstens ein Mensch der Gruppe dran (taktWer; wer im Takt davor dran war, nie gleich wieder).
   Also bewegen sich im Raum nie mehr als zwei zugleich (dazu höchstens ein Zuhörer, der nickt). Gesprochen wird nur in den geraden Takten: nie zwei Reden zugleich.
   Was jemand tut, folgt aus seiner Rolle (taktArt): rede (ein Satz mit einer Geste, die beginnt, hält und zurückkehrt; der Partner nickt am Ende) · die Arbeit seiner Hände (tipp: eine kurze Folge von Anschlägen,
   schrieb: eine Zeile, zeig: der Arm sinkt und zeigt wieder, schwenk: die Kamera wandert ruhig in eine neue Lage) · gewicht (aufs andere Bein, bleibt dort) · kopf (wendet sich, bleibt dort) · nick · zug (Gewohnheit: ein Schluck, ein Blick aufs Tablet).
   Alles hängt nur an der Uhr des Raums (st.lz) und an Zufallszahlen aus der Nummer des Takts: Dieselbe Zeit gibt immer dieselbe Haltung (kein Zustand, der verloren gehen kann).
   Eine Gruppe (taktGruppe) sind die Menschen eines Raums bzw. die zwei am Empfang; je Mensch G = { grp, N, i, saat, redet, arbeit, sitz, hoert, paar, partner, gruppe }. */
const TAKT_H = 1700, TAKT_WEIT = 64, redeDauer = (z) => 1700 + 700 * z;
function taktGruppe(grp, leute, sperr = []) { // sperr = Zeiten [von, bis] auf der Uhr der Gruppe, in denen jemand ging (siehe taktGesperrt)
  const N = Math.max(leute.length, 3); // (bei ein oder zwei Menschen bleibt ein Teil der Takte leer: auch dort ist meistens Ruhe)
  leute.forEach((G, i) => { G.grp = grp; G.N = N; G.i = i; G.gruppe = leute; G.merk = {}; G.sperr = sperr; const pa = G.paar != null ? leute.map((x, j) => (j !== i && x.paar === G.paar ? j : -1)).filter((j) => j >= 0) : []; G.partner = pa.length ? pa : null; });
  return leute;
}
/* Solange im Raum jemand geht oder kommt, läuft die Uhr weiter (niemand friert mitten in einer Geste ein: Wer gerade spricht oder trinkt, führt es zu Ende), aber es beginnt nur noch jeder zweite Takt:
   Neben den Gehenden macht höchstens EIN anderer Mensch eine Bewegung, dazwischen ist Ruhe. Ein Takt, dessen Beginn in eine solche Zeit fiel, bleibt für immer still (so ändert sich keine Haltung im Nachhinein). */
const taktGesperrt = (G, k) => { const ts = k * TAKT_H - G.grp * 731; for (const x of G.sperr) if (ts >= x[0] && ts <= x[1]) return true; return false; };
const taktWer = (G, k) => { if ((k & 1) && G.sperr.length && taktGesperrt(G, k)) return -1; const i = Math.floor(FIG.zufall(k, G.grp + 0.37) * G.N); return i === Math.floor(FIG.zufall(k - 1, G.grp + 0.37) * G.N) ? -1 : i; };
function taktArt(G, k) {
  let z = FIG.zufall(k, G.grp + 1.91 + G.i * 0.618);
  if (G.redet && !(k & 1)) { if (z < 0.78) return 'rede'; z = (z - 0.78) / 0.22; }
  if (G.arbeit) return z < 0.6 ? G.arbeit : z < 0.85 ? 'kopf' : 'nick';
  if (G.sitz) return z < 0.62 ? 'kopf' : 'nick';
  return z < 0.36 ? 'gewicht' : z < 0.62 ? 'kopf' : z < 0.88 ? (G.zug ? 'zug' : 'still') : 'nick'; // (ohne Gewohnheit, die man sieht, bleibt der Takt still)
}
/* Die laufende Bewegung dieses Menschen: [Art, ms seit Beginn, Zufallszahl des Takts] oder null */
function taktJetzt(G, t) {
  const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H);
  for (const k of [k0, k0 - 1]) if (taktWer(G, k) === G.i) return [taktArt(G, k), tt - k * TAKT_H, FIG.zufall(k, G.grp + 2.77)];
  return null;
}
/* Bewegungen, die bleiben (Gewicht, Kopf, Kamera): die Zufallszahlen der letzten zwei Takte dieser Art (null = noch keiner) und wie weit der Übergang ist (0 … 1, weich über dauer ms) */
function taktStand(G, art, t, dauer) {
  const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H); let m = G.merk[art];
  if (!m || m.k !== k0) { m = G.merk[art] = { k: k0, a: null, b: null }; for (let k = k0, n = 0; k > k0 - TAKT_WEIT && n < 2; k--) if (taktWer(G, k) === G.i && taktArt(G, k) === art) { if (n++ === 0) m.b = k; else m.a = k; } }
  const z = (k) => (k == null ? null : FIG.zufall(k, G.grp + 2.77));
  return [z(m.a), z(m.b), m.b == null ? 1 : FIG.sanft((tt - m.b * TAKT_H) / dauer)];
}
/* Spricht gerade jemand aus meinem Gespräch? → [ms seit Beginn seiner Rede, deren Dauer] */
function taktHoert(G, t) {
  if (!G.partner || !G.hoert) return null; const tt = t + G.grp * 731, k0 = Math.floor(tt / TAKT_H);
  for (const k of [k0, k0 - 1]) if (!(k & 1)) { const i = taktWer(G, k); if (i >= 0 && i !== G.i && G.partner.includes(i) && taktArt(G.gruppe[i], k) === 'rede' && FIG.zufall(k, G.grp + G.i * 0.31) < 1.4 / G.partner.length) return [tt - k * TAKT_H, redeDauer(FIG.zufall(k, G.grp + 2.77))]; }
  return null;
}
/* Auf welchem Bein jemand steht (−1 links … 1 rechts): bleibt, bis er das Gewicht in einer Bewegung aufs andere Bein nimmt (0,95 s). grund = die Haltung des Platzes, solange noch nichts geschah */
function gewichtVon(G, t, grund) {
  const S0 = taktStand(G, 'gewicht', t, 950), w = (z) => (z == null ? grund : (z < 0.5 ? -1 : 1) * (0.32 + 0.5 * Math.abs(2 * z - 1)));
  return lerp(w(S0[0]), w(S0[1]), S0[2]);
}
/* Das Leben auf eine Haltung legen (p wird verändert): Lidschlag und Blick, die Lage des Kopfs, die laufende Bewegung, das Nicken des Zuhörers */
function regen(p, t, G) {
  FIG.leben(p, t, G.saat);
  const B = FIG.bogen, K = taktStand(G, 'kopf', t, 800), kw = (z) => (z == null ? 0 : (z * 2 - 1) * (G.arbeit ? 0.14 : 0.3)); p.kd += lerp(kw(K[0]), kw(K[1]), K[2]);
  const offen = [[p.ar, p.hr], [p.al, p.hl]].filter((x) => x[1] === 'offen').map((x) => x[0]);
  if (G.redet || G.partner) for (const A of offen) A[2] -= 0.35; // wer gerade nicht spricht, lässt die Hände sinken
  if (G.arbeit === 'schwenk') { const V = taktStand(G, 'schwenk', t, 1250), vw = (z) => (z == null ? 0 : z * 2 - 1), v = lerp(vw(V[0]), vw(V[1]), V[2]); p.ar[0] += 0.04 * v; p.al[0] += 0.05 * v; p.al[2] += 0.07 * v; p.dreh += 0.05 * v; } // die Kamera wandert ruhig in eine neue Lage und bleibt dort
  const J = taktJetzt(G, t);
  if (J) { const [art, ms, z] = J;
    if (art === 'nick') p.kn += 0.09 * B(ms, 260, 60, 380);
    else if (art === 'zug') p.zug = B(ms, 560, 800, 660);
    else if (art === 'rede') { const D = redeDauer(z), an = B(ms, 140, D - 420, 280), g = B(ms - 180, 480, D - 1300, 620); // ein Satz: Der Mund bewegt sich in Silben; die offenen Hände heben sich zu einer Geste, halten, sinken zurück
      p.rede = an; if (an > 0.05) p.mund = an * (0.3 + 0.5 * Math.abs(Math.sin(ms * 0.011 + G.saat * 3))); p.kn += 0.03 * g; for (const A of offen) { A[0] += 0.17 * g * (0.7 + 0.6 * z); A[2] += 0.57 * g; A[1] += 0.05 * g; } }
    else if (art === 'tipp') { const an = B(ms, 180, 1250, 240); p.al[2] += 0.035 * Math.sin(ms * 0.031) * an; p.ar[2] += 0.02 * Math.sin(ms * 0.023 + 1) * an; p.ar[1] += 0.045 * an * Math.sin(ms * 0.0034); p.kn += 0.03 * an; } // eine kurze Folge von Anschlägen, die Maushand schiebt einmal hin und her
    else if (art === 'schrieb') { const an = B(ms, 200, 1400, 260); p.ar[0] += 0.05 * an * (ms / 1860 - 0.4); p.ar[2] += 0.014 * Math.sin(ms * 0.027) * an; } // eine Zeile
    else if (art === 'zeig') { const ab = B(ms, 600, 900, 700); p.ar = p.ar.map((v, i) => lerp(v, FIG.ARME.spricht[i], ab * 0.75)); } // der zeigende Arm sinkt zur offenen Hand und zeigt wieder
  }
  const Ho = taktHoert(G, t); if (Ho) p.kn += 0.075 * B(Ho[0] - (Ho[1] - 760), 240, 80, 380); // wer zuhört, nickt am Ende des Satzes
  return p;
}
/* Der Eintrag eines Menschen im Taktgeber seines Raums (einmal für alle des Raums angelegt; das Publikum auf dem Dach sitzt als Fläche im Bild und gehört nicht dazu) */
const ARBEIT = { tippt: 'tipp', schreibt: 'schrieb', kamera: 'schwenk', zeigt: 'zeig' }, ZUG = { becher: true, mappe: true, kinn: true };
function taktVon(f) {
  if (f.G) return f.G;
  const st = f.st, alle = st.L.flatMap((l) => l.leute).filter((x) => !x.stempel);
  taktGruppe(1 + Object.keys(RAUM).indexOf(st.key), alle.map((x) => { const a = x.halt.leben; return (x.G = { saat: x.saat, redet: a === 'spricht' || (x.paar != null && (!a || a === 'zeigt')), arbeit: ARBEIT[a] || null, sitz: !!x.halt.sitz, hoert: a !== 'tippt' && a !== 'kamera', paar: x.paar, zug: ZUG[x.m.eig.l] || ZUG[x.m.eig.r] || false }); }), st.sperr || (st.sperr = []));
  return f.G || (f.G = taktGruppe(99, [{ saat: f.saat, sitz: !!f.halt.sitz }])[0]);
}
/* Die Haltung eines Menschen an seinem Platz. t = 0: ohne Leben (Standbild, „weniger Bewegung“, Umriss des leeren Platzes). t = Uhr des Raums: mit Leben (regen).
   Zwei, die miteinander sprechen (raeume.json › figur.gespraech, teil), sprechen abwechselnd; ohne Paar spricht ein Mensch in Sätzen mit Pausen. Wer schreibt, nickt nur; wer tippt oder die Kamera führt, bleibt bei der Arbeit. */
function platzHaltung(f, t) {
  const h = f.halt, G = t ? taktVon(f) : null;
  const p = h.sitz ? FIG.sitz(h.sitz, f.m.gr, h.l, h.r, f.sessel ? 'sessel' : '') : FIG.steh(Math.max(-1, Math.min(1, t ? gewichtVon(G, t, h.w || 0) : h.w || 0)), h.l, h.r);
  const a = h.leben; if (a === 'tippt' || a === 'schreibt' || a === 'kamera') p.mund = -1; // wer arbeitet, sieht konzentriert aus
  if (a === 'tippt') p.kn += 0.05; else if (a === 'kamera') { p.kn += 0.08; p.neig += 0.04; }
  return t ? regen(p, t, G) : p;
}
/* Die Kennzahl der Haltung am Platz zur Zeit t (gemerkt je Bild): Das Ruhebild wird nur neu gezeichnet, wenn sie sich ändert */
const lebSig = (f, t) => (f.sgT === t ? f.sg : ((f.sgT = t), (f.sg = FIG.sig(platzHaltung(f, t)))));
/* Wo ein Mensch gerade ist, aus dem Zustand u seiner Leistung: am Platz (q = 0), beim Aufstehen bzw. Hinsetzen (0 < q < 1, s = 0), unterwegs (s = Meter auf dem Weg), fort (durch die Tür). */
function wo(f) {
  const l = f.l, tau = l.u * l.dauer - f.verz;
  if (tau <= 1e-6) return { q: 0, s: 0, x: f.x, z: f.z, ziel: f.blick }; // (nicht „<= 0“: verz ist eine Differenz von Kommazahlen und kann um 1e-13 unter null liegen; der Mensch stünde dann für immer im ersten Bild des Aufstehens, in der groben Auflösung der Geh-Bilder)
  if (tau < f.tA) return { q: tau / f.tA, s: 0, x: f.x, z: f.z, ziel: tau > f.tA * 0.6 && !l.drin ? f.w.hd0 : f.blick };
  const q = (tau - f.tA) / f.tW; if (q >= 1 - 1e-7) return { q: 1, s: f.w.len, fort: true }; // (nicht „>= 1“: Aus u = 1 wird durch die Rechnung 0,99999999; der Mensch stünde dann am Ende des Wegs im Flur, statt fort zu sein, und drehte sich beim Zurückkommen dort erst um)
  const a = 0.14, s = f.w.len * (q < a ? (q * q) / (a * (2 - a)) : (2 * q - a) / (2 - a)), o = ortAufWeg(f.w, s); // kurz anlaufen, dann gleichmäßig
  return { q: 1, s, x: o[0], z: o[1], ziel: o[2] + (l.drin ? Math.PI : 0) }; // wer zurückkommt, geht den Weg in der anderen Richtung
}
const dreheZu = (von, zu, max) => { let d = (zu - von) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) <= max ? zu : von + Math.sign(d) * max; };
/* Wie weit die Tür für diesen Menschen offen stehen muss (0 … 1): Sie geht auf, wenn er kommt, und hinter ihm wieder zu. */
const tuerBedarf = (f, s) => (s <= 0 ? 0 : s < f.w.sT ? smooth((s - (f.w.sT - 1.7)) / 1.0) : 1 - smooth((s - f.w.sT - 0.35) / 0.5));
const HOT = [];                                            // was im Bild angetippt werden kann: { l, x0, y0, x1, y1, sx, sy, neben } in CSS-Pixeln (bei jedem Zeichnen neu)
function merke(l, x, z, hoch, halb = 0.42, neben = false, y0 = 0, sch = null) { // sch = [dx, dy]: das Schild steht um so viele Meter versetzt (zwischen zwei Menschen, über einer Wandtafel statt davor); der Stiel reicht bis zum Kopf
  const dz = z - cam.z; if (dz < 0.8) return;
  const a = P(x - halb, hoch, z), b = P(x + halb, y0, z), c = S.css, kopf = P(x, hoch + 0.12, z), s = sch ? P(x + sch[0], hoch + 0.12 + sch[1], z) : kopf;
  HOT.push({ l, neben, x0: a[0] * c, y0: a[1] * c, x1: b[0] * c, y1: b[1] * c, sx: s[0] * c, sy: s[1] * c, stiel: (kopf[1] - s[1]) * c });
}
/* Ein Stuhl, in eine der vier Richtungen gedreht (hd), um rueck Meter vom Tisch zurückgeschoben. Sitz und Beine liegen hinter dem Menschen, die Lehne je nach Blick davor oder dahinter. */
function stuhlDinge(list, f, rueck) {
  if (f.sessel) rueck = 0; // ein Sessel bleibt stehen
  const hd = Math.round(f.blick / (Math.PI / 2)) * (Math.PI / 2), fx = Math.sin(hd), fz = Math.cos(hd), cx = f.x - fx * rueck, cz = f.z - fz * rueck, b = f.boden;
  const kiste = (a0, a1, y0, y1, v0, v1, cT, cF, cS) => { const xa = cx + a0 * fz + v0 * fx, xb = cx + a1 * fz + v1 * fx, za = cz - a0 * fx + v0 * fz, zb = cz - a1 * fx + v1 * fz; box(Math.min(xa, xb), Math.max(xa, xb), y0 + b, y1 + b, Math.min(za, zb), Math.max(za, zb), cT, cF, cS); };
  if (f.sessel) { // Sessel: gepolsterter Sitz auf kurzen Füßen, hohe Lehne, zwei Armlehnen (a = quer, v = nach vorn; die Lehne liegt hinter dem Menschen, der Sitz unter ihm, die Armlehne zu uns davor)
    const C = f.sessel === true ? { top: '#8f7fc8', front: '#4a3c86', seite: '#3a2e6c', kante: '#b9aaf0' } : f.sessel;
    const lehneVorn = Math.hypot(cx - 0.3 * fx - cam.x, cz - 0.3 * fz - cam.z) < Math.hypot(f.x - cam.x, f.z - cam.z);
    const lehne = () => { kiste(-0.36, 0.36, 0.42, 1.02, -0.4, -0.24, C.kante, C.front, C.seite); kiste(-0.36, 0.36, 0.98, 1.02, -0.4, -0.24, C.kante, C.kante, C.kante); };
    list.push({ z: f.z + 0.3, fn: () => { schatten(cx - 0.46, cx + 0.46, cz - 0.46, cz + 0.46); for (const [a, v] of [[-0.3, -0.34], [0.26, -0.34], [-0.3, 0.26], [0.26, 0.26]]) kiste(a, a + 0.05, 0, 0.14, v, v + 0.05, '#0c0a16', '#0c0a16', '#0c0a16'); if (!lehneVorn) lehne(); kiste(-0.36, 0.36, 0.14, 0.44, -0.26, 0.34, C.top, C.front, C.seite); } });
    // die Armlehnen: die fernere hinter dem Menschen, die nähere davor
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
/* Der gestrichelte Umriss am leeren Platz: die Haltung des Menschen, der hier arbeitet, einmal auf eine eigene Fläche gezeichnet und danach nur an ihre Stelle gesetzt */
function umrissMalen(f, a, farbe) {
  const dz = f.z - cam.z; if (dz < 0.7) return;
  const q = P(f.x, f.boden, f.z), k = Math.round((S.f / dz) * 2) / 2, dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz), dk = Math.round(dreh * 40) / 40;
  FIG.stempel(ctx, `u${f.st.key}${f.l.id}${f.n}`, `${k}|${dk}|${farbe}`, q[0], q[1], k, (g, x, y, kk) => FIG.malen(g, f.m, platzHaltung(f, 0), x, y, kk, { dreh: dk, auge: cam.y - oy - f.boden, dz, licht: LICHT.lav, modus: 'umriss', farbe }), a, raumBewegt(f.st)); // unterwegs bleibt der vorgezeichnete Umriss (auch wenn sich jemand inzwischen umgesehen hat)
}

/* ═══════════════ VORGEZEICHNETE MENSCHEN ═══════════════
   Ein Mensch aus Pfaden kostet die Grafikkarte viel (Dutzende Flächen mit Ausschnitten, in hoher Auflösung). Darum wird kein Mensch mehr im Bild selbst gezeichnet:
   Jeder liegt als fertiges kleines Bild bereit und wird nur noch an seine Stelle gesetzt (drawImage), verkleinert oder vergrößert nach Tiefe.
   · Am Platz: EIN Ruhebild je Mensch. Sein Leben (Atmen, Hände, Blicke) entsteht, indem reihum je gezeichnetem Bild höchstens BILD.JE_BILD Menschen ihr Ruhebild neu bekommen;
     solange im Raum jemand geht oder kommt, keines (die Uhr des Lebens steht so lange: nichts springt danach).
   · Aufstehen und Hinsetzen: BILD.AUF Phasen je Mensch (rückwärts abgespielt = Hinsetzen), danach dreht er sich über Zwischenansichten (stehend, BILD.DIR Richtungen) in die Gehrichtung.
   · Gehen: BILD.PH Phasen eines Doppelschritts je Blickrichtung, die der Weg braucht (hin und zurück). Der Schritt hängt am zurückgelegten Weg, nicht an der Zeit.
   · Hervorheben: der Lichtsaum ist ein eigenes Bild neben dem Ruhebild. Der Schatten am Boden ist ein Bild für alle.
   Angelegt werden die Bilder im Leerlauf, nachdem der Raum betreten ist (vorwaermen: wenige Millisekunden je Bild). Fehlt doch eines (früher Klick, anderer Blickwinkel),
   wird genau dieses eine nachgezeichnet und bleibt liegen. Stellwerte: BILD. */
const BILD = {
  PH: 12,               // Phasen eines Doppelschritts
  DIR: 8,               // Blickrichtungen rund um die Figur
  AUF: 6,               // Phasen des Aufstehens
  K_BEW: [200, 90],     // Auflösung der eigenen kleinen Fläche eines Menschen in Bewegung (Aufstehen, Drehen, Gehen): Pixel je Meter, höchstens (Stufe 0, Stufe 1)
  BEW_JE_BILD: [2, 1],  // so viele Menschen in Bewegung werden je Bild neu gezeichnet (leichte Fassung); bewegen sich mehr, kommen sie reihum dran
  DREH_AB: 0.3,         // ab diesem Anteil der Zeit am Platz dreht sich, wer aufsteht, in die Gehrichtung (rückwärts: Wer ankommt, dreht sich bis dahin zum Platz)
  BLENDE_MS: 150,       // so lange blendet das scharfe Ruhebild in das Bild der Bewegung über (und beim Ankommen zurück)
  AUF_ANTEIL: 0.68,      // dieser Anteil der Zeit am Platz ist Aufstehen bzw. Zusammenpacken, der Rest das Drehen in die Gehrichtung
  K_DACH: 64,           // … auf dem Dach (dort gehen viele zugleich)
  K_PUB: 45,            // … und das Publikum auf dem Dach: acht verschiedene Menschen statt vier, dafür kleinere Bilder (45² · 8 = 64² · 4: dieselben Megapixel; das Publikum ist klein im Bild und geht ins Dunkel)
  K_MAX: [90, 70],      // (feiner gehen, 130, riss im echten Chrome die Grenze: bis zu 28 lange Bilder, wenn der erste Mensch aufbricht; 12 Phasen bei 90 bleiben flüssig)
                        // feinste Auflösung der Geh- und Aufstehbilder in Pixeln je Meter (Stufe 0, Stufe 1)
  K_RUHE: [220, 150],   // feinste Auflösung des Ruhebilds, solange die Kamera fährt
  K_FEIN: [900, 0],     // steht die Kamera, entsteht jedes Ruhebild in genau der Größe, in der es gezeigt wird (Pixel je Meter, höchstens so viel; 0 = nie: Sparstufe)
  FEIN_MP: [4.5, 0],    // so viele Megapixel dürfen die feinen Ruhebilder eines Raums zusammen belegen (die vordersten zuerst; wer nicht mehr hineinpasst, bleibt beim gröberen Bild)
  MP: [10, 6],          // so viele Megapixel dürfen alle vorgezeichneten Bilder zusammen belegen (darüber fallen die Sätze und Ruhebilder anderer Räume weg, und das Vorzeichnen hört auf); ein voll besetzter Raum braucht rund 45 bis 60
  JE_BILD: [2, 1],      // so viele Ruhebilder werden je gezeichnetem Bild erneuert
  WARM_MS: [2.5, 2],    // Vorzeichnen im Leerlauf: Millisekunden je Bild …
  WARM_ZELLEN: [2, 1],  // … und höchstens so viele Bilder von Menschen je Takt (die Zeit misst nur das Skript, die Grafikkarte rechnet danach); läuft am Himmel etwas (Dämmerung, Feuerwerk), nur eines
  RAND: 2.6,            // Breite des Lichtsaums beim Hervorheben in CSS-Pixeln
};
if (QUERY.get('gang') === 'grob') BILD.PH = 8; else if (QUERY.get('gang') === 'fein') BILD.K_MAX = [130, 70]; // nur zum Vergleichen: ?gang=grob = 8 Phasen wie vor dem 22.11. · ?gang=fein = 130 Pixel je Meter (verworfen)
if (QUERY.get('fein') === '0') BILD.K_FEIN = [0, 0]; // nur zum Prüfen und Vergleichen: ?fein=0 lässt die Ruhebilder in den festen, gröberen Stufen
let BILD_GEN = 1, bildMP = 0;                       // BILD_GEN: zählt hoch, wenn sich die Größe der Zeichenfläche oder die Stufe ändert (dann gelten alle Bilder nicht mehr)
const ATLANTEN = new Set();
let SCHATTEN_BILD = null;
function schattenSetzen(x, y, k, flach, a = 1) { // der weiche Schatten am Boden: ein Bild für alle
  if (!SCHATTEN_BILD) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), s = g.createRadialGradient(64, 64, 0, 64, 64, 64); s.addColorStop(0, 'rgba(0,0,0,.5)'); s.addColorStop(0.55, 'rgba(0,0,0,.225)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(0, 0, 128, 128); SCHATTEN_BILD = c; }
  const r = 0.44 * k; if (a < 1) ctx.globalAlpha *= a; ctx.drawImage(SCHATTEN_BILD, x - r, y - r * flach, 2 * r, 2 * r * flach); if (a < 1) ctx.globalAlpha /= a;
}
/* Ein Atlas: viele gleich große Bilder eines Menschen auf wenigen Flächen. k = Pixel je Meter, halb = halbe Breite, hoch = Höhe über dem Boden, tief = unter dem Boden (Meter) */
function atlasNeu(k, halb, hoch, tief) {
  const pad = 5, cw = Math.ceil(2 * halb * k) + 2 * pad, ch = Math.ceil((hoch + tief) * k) + 2 * pad, cols = Math.max(1, Math.min(8, Math.floor(2040 / cw))), rows = 1; // je Fläche eine Reihe: so liegt kaum etwas brach
  const a = { k, cw, ch, ax: cw / 2, ay: pad + Math.ceil(hoch * k), cols, je: cols * rows, rows, seiten: [], map: new Map(), n: 0, mp: 0, zuletzt: performance.now() };
  ATLANTEN.add(a); return a;
}
function atlasFrei(a) { for (const s of a.seiten) { s.c.width = s.c.height = 0; } bildMP -= a.mp; a.mp = 0; a.seiten.length = 0; a.map.clear(); a.n = 0; ATLANTEN.delete(a); a.tot = true; }
function atlasOrt(a, i) { const s = a.seiten[Math.floor(i / a.je)], j = i % a.je; return [s.c, (j % a.cols) * a.cw, Math.floor(j / a.cols) * a.ch]; }
/* Die Zelle zu einem Schlüssel; fehlt sie, wird sie jetzt gezeichnet: male(g, x, y, k) zeichnet an die Bodenstelle (x, y) */
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
/* Zu viel belegt: die am längsten nicht gebrauchten Sätze fallen weg (nie die des Raums, in dem die Kamera steht) */
function bilderSparen() {
  for (const sp of [...BEWEGTE]) if (lastT - sp.bew.zuletzt > 4000) bewFrei(sp); // die Fläche eines Menschen, der sich seit vier Sekunden nicht mehr bewegt
  if (bildMP <= BILD.MP[STUFE]) return;
  const hier = AKT.F && RAUM[AKT.F.key], alt = [...ATLANTEN].filter((a) => a.st !== hier).sort((p, q) => p.zuletzt - q.zuletzt);
  if (hier && AKT.k >= 1) for (const key in RAUM) { const st = RAUM[key]; if (st === hier) continue; for (const l of st.L) for (const f of l.leute) { const R = f.sp && f.sp.ruhe; if (R && R.mp) { bauFrei(R); bildMP -= R.mp; R.c.width = R.c.height = 0; f.sp.ruhe = null; } } } // die Ruhebilder der anderen Räume (sie entstehen neu, wenn ihr Raum wieder ins Bild kommt)
  for (const a of alt) { if (bildMP <= BILD.MP[STUFE] * 0.8) break; atlasFrei(a); }
  if (bildMP > BILD.MP[STUFE]) for (const a of [...ATLANTEN].filter((x) => x.st === hier && lastT - x.zuletzt > 1500).sort((p, q) => p.zuletzt - q.zuletzt)) { if (bildMP <= BILD.MP[STUFE] * 0.8) break; atlasFrei(a); } // auch im eigenen Raum: Sätze, die seit anderthalb Sekunden niemand braucht
}
let RAUM_HIER = '';
function raeumen(hier) { // beim Betreten eines Raums (oder des Dachs): die Bilder aller anderen Räume freigeben (Flächen auf 0 × 0: Der Speicher wird wirklich frei)
  for (const a of [...ATLANTEN]) if (a.st && a.st !== hier) atlasFrei(a);
  for (const key in RAUM) { const st = RAUM[key]; if (st === hier) continue; for (const l of st.L) for (const x of l.leute) { const R = x.sp && x.sp.ruhe; if (R) { bauFrei(R); bildMP -= R.mp || 0; R.c.width = R.c.height = 0; x.sp.ruhe = null; } taschenFrei(x.sp); bewFrei(x.sp); } }
}
/* Die Bilder eines Menschen (gelten bis zur nächsten Größenänderung) */
function spVon(f) {
  let sp = f.sp; if (sp && sp.gen === BILD_GEN) return sp;
  if (sp) { bewFrei(sp); if (sp.auf && !sp.auf.tot) atlasFrei(sp.auf); if (sp.ruhe) { bauFrei(sp.ruhe); bildMP -= sp.ruhe.mp; sp.ruhe.c.width = sp.ruhe.c.height = 0; } taschenFrei(sp); }
  return (f.sp = { gen: BILD_GEN, auf: null, ruhe: null });
}
const kStufe = (k, max) => Math.min(max, Math.max(24, Math.ceil(k / 10) * 10));
/* Ruhebilder gibt es nur in festen Auflösungen (Stufen im Faktor 1,2): Eine Fläche, die bei jeder kleinen Größenänderung neu angelegt wird, kostet die Grafikkarte mehr als alles Zeichnen.
   Fährt die Kamera, entsteht je Bild höchstens ein Ruhebild (RUHE_FREI), gleich deutlich größer als nötig (RUHE_VORAUS: die Kamera kommt meist näher); bis dahin wird das vorhandene passend eingesetzt. */
const ruheStufe = (k) => { const max = BILD.K_RUHE[STUFE]; let st = 24; while (st < k && st < max) st = Math.min(max, Math.ceil(st * 1.2)); return st; };
const RUHE_VORAUS = 3; // unterwegs: so viel größer als gerade nötig entsteht ein Ruhebild (die Kamera kommt meist näher; im Raum gilt ohnehin die feinste Stufe)
let RUHE_FREI = 0, RUHE_N = 0; // RUHE_N: so viele Ruhebilder sind in diesem Bild neu entstanden
/* Feinste Auflösung der Geh- und Aufstehbilder eines Raums: Auf dem Dach gehen viele zugleich (das ganze Publikum), dort bleibt es bei der gröberen Stufe (sonst lägen kurz über 35 Megapixel) */
const kMaxVon = (st) => Math.min(BILD.K_MAX[STUFE], st.key === 'dach' ? BILD.K_DACH : 999);
function wegAtlas(f, k, neu = false) { // Gehen, Stehen in jeder Richtung, die Tasche am Boden. Derselbe Mensch an mehreren Stellen eines Raums (Publikum auf dem Dach) teilt sich einen Atlas. neu = er darf feiner neu angelegt werden (nur beim Vorzeichnen, nie unterwegs)
  const st = f.st, name = `${f.m.id}|${f.tasche ? 1 : 0}`, max = f.stempel ? Math.min(kMaxVon(st), BILD.K_PUB) : kMaxVon(st);
  if (st.atlGen !== BILD_GEN) { if (st.atl) for (const a of st.atl.values()) if (!a.tot) atlasFrei(a); st.atl = new Map(); st.atlGen = BILD_GEN; }
  let a = st.atl.get(name);
  if (a && (a.tot || (neu && k > a.k * 1.12 && a.k < max))) { if (!a.tot) atlasFrei(a); a = null; }
  if (!a) { a = atlasNeu(kStufe(k, max), 0.5 * f.m.gr, 1.9 * f.m.gr, 0.2 * f.m.gr); a.st = st; st.atl.set(name, a); bilderSparen(); }
  return a;
}
function aufAtlas(f, k, neu = false) { // Aufstehen und Hinsetzen am Platz (breiter: die Arme arbeiten noch)
  if (f.stempel) { // das Publikum: Alle mit derselben Figur teilen sich einen Atlas
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
/* Haltungen unterwegs: stehend (mit der Tasche in der Hand) und im Schritt */
const stehPose = (f) => FIG.steh(0, 'haengt', f.tasche ? 'traegt' : 'haengt');
const gehPose = (f, ph) => FIG.geh(ph, f.tasche ? 'r' : '');
const TASCHE_AB = 0.6; // ab diesem Anteil des Aufstehens hat der Mensch die Tasche in der Hand (vorher steht sie neben dem Platz)
/* Aufstehen und Zusammenpacken: e = 0 (am Platz, wie er arbeitet) … 1 (steht, die Tasche in der Hand). Rückwärts gelesen: abstellen und hinsetzen. → [Haltung, rechte Hand, linke Hand] */
function aufPose(f, e) {
  const steh = stehPose(f), R0 = f.sp && f.sp.ruhe, platz = platzHaltung(f, f.l.drin && f.st.tLeb !== undefined ? f.st.tLeb : R0 && R0.t ? R0.t : 0), zw = FIG.zwischen; /* wer geht: die Haltung seines Ruhebilds · wer kommt: die Haltung, die er am Platz gleich haben wird (die Uhr des Raums steht, solange er unterwegs ist) */ let p, r = f.halt.dr || null, li = f.halt.dl || null; // (am Platz: genau die Haltung, die sein Ruhebild zeigt, samt Leben: kein Sprung beim Aufbrechen und beim Ankommen)
  const kurve = (K, u) => { const n = K.length - 2, x = Math.min(n - 1e-6, Math.max(0, u) * n), i = Math.floor(x), t = x - i, b0 = ((1 - t) * (1 - t)) / 2, b2 = (t * t) / 2, b1 = 1 - b0 - b2; return zw(zw(K[i], K[i + 1], b1 / (b0 + b1)), K[i + 2], b2); }; // eine durchgehende Bewegung durch die Haltungen (weiche Kurve statt Halt an jeder Haltung)
  if (f.halt.sitz) { // vom Stuhl: (1) Hände lösen, vorbeugen, Füße unter den Körper · (2) das Gewicht kommt über die Füße, die Hüfte hebt sich · (3) aufrichten · (4) die Tasche greifen
    const vor = FIG.sitz(f.halt.sitz, f.m.gr, 'schoss', 'schoss', f.sessel ? 'sessel' : ''); vor.neig = 0.52; vor.kn = 0.2; vor.bl = [vor.bl[0], 0.1, vor.bl[2] + 0.5, 0.25]; vor.br = [vor.br[0], 0.1, vor.br[2] + 0.5, 0.25]; vor.pf = 0.05;
    const halb = FIG.hocke(0.95, 'schoss', 'haengt'); halb.neig = 0.58; halb.kn = 0.12; halb.pf = 0.1;
    const fast = FIG.hocke(0.3, 'haengt', 'haengt'); fast.neig = 0.2;
    p = kurve([platz, platz, vor, halb, fast, steh, steh], e);
  } else { // aus dem Stand: Arme sinken, ein Schritt Gewicht aufs andere Bein, zur Tasche beugen, aufrichten
    const los = FIG.steh(-0.3, 'haengt', 'haengt'); los.neig = 0.06;
    p = kurve([platz, platz, los, steh, steh], e);
  }
  if (f.tasche) { const bog = Math.sin(Math.PI * Math.min(1, Math.max(0, (e - 0.32) / 0.56))); p.ar = p.ar.map((v, i) => lerp(v, FIG.ARME.greift[i], bog * 0.9)); if (!f.halt.sitz) { p.neig += 0.26 * bog; p.seit += 0.08 * bog; p.kn += 0.2 * bog; } r = e > TASCHE_AB ? 'tasche' : e > 0.25 ? null : r; } else if (e > 0.35) r = null;
  if (e > 0.25) li = null;
  return [p, r, li];
}
/* Die Richtung zum Licht im Bild für einen Menschen an seinem Platz (Bildschirm, Leuchte, Ringlicht), sonst das Licht des Raums */
function platzLicht(f, LI) {
  if (!f.licht || f.licht[2] - cam.z <= 0.5) return LI.L;
  const a = P(f.x, f.boden + 1.25, f.z), b = P(f.licht[0], f.licht[1], f.licht[2]), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return d > 12 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : LI.L;
}
/* Das Ruhebild eines Menschen neu zeichnen (links die Figur, rechts daneben der Lichtsaum des Hervorhebens, wenn er gebraucht wird) */
function ruheZeichnen(f, t, mitRand, fein = false) { // fein = in genau der Größe, in der der Mensch im Bild steht (nur wenn die Kamera steht und der Besucher bleibt); ein feines Bild bleibt liegen, bis der nächste Raum betreten ist (raeumen)
  const sp = spVon(f), LI = f.st.LI, dz = Math.max(0.7, f.z - cam.z), kx = S.f / dz, pad = 6;
  let R = sp.ruhe;
  if (!R) { const c = document.createElement('canvas'); R = sp.ruhe = { c, g: c.getContext('2d'), mp: 0 }; }
  bauFrei(R);
  const halten = !fein && R.fein && R.k !== undefined && R.k * 1.15 >= ruheStufe(kx), k = fein ? Math.min(BILD.K_FEIN[STUFE], kx) : halten ? R.k : ruheStufe(kx * (KAM_STEHT ? 1 : RUHE_VORAUS)); // unterwegs (Umsehen) behält ein feines Bild seine Größe: keine neue Fläche
  const dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz), o = { dreh, auge: cam.y - oy - f.boden, dz, licht: LI, L: platzLicht(f, LI), saum: { farbe: LI.saum, a: 0.32 }, r: f.halt.dr || null, l: f.halt.dl || null };
  const rk = `${k}|${Math.round(dreh * 6)}`; // der Rahmen: so groß wie die Haltung am Platz (ohne Leben) plus Luft; er gilt, solange Auflösung und Blickwinkel bleiben (das Leben legt keine neue Fläche an)
  if (R.rk !== rk) { const B = FIG.rahmen(f.m, platzHaltung(f, 0), o); R.rk = rk; R.bl = B.l + 0.2; R.br = B.r + 0.2; R.bo = B.o + 0.1; R.bu = B.u + 0.12; }
  const w = Math.ceil((R.bl + R.br) * k) + 2 * pad, h = Math.ceil((R.bo + R.bu) * k) + 2 * pad;
  let ax = pad + Math.round(R.bl * k), ay = pad + Math.round(R.bo * k);
  if (fein) { const q = P(f.x, f.boden, f.z); ax = q[0] - Math.round(q[0] - ax); ay = q[1] - Math.round(q[1] - ay); } // deckungsgleich: Das Bild liegt später auf ganzen Pixeln, die Figur steht darin an genau ihrer Stelle
  const bleibt = !mitRand && R.rand && R.c.width === 2 * w && R.c.height === h && Math.abs(dreh - R.randDreh) < 0.12; // der Lichtsaum bleibt liegen, solange er passt: beim nächsten Hervorheben ist er sofort da
  const breit = mitRand || bleibt ? 2 * w : w; // die rechte Hälfte (Lichtsaum) gibt es nur, solange jemand hervorgehoben ist (Speicher)
  if (R.c.width !== breit || R.c.height !== h) { bildMP -= R.mp; R.c.width = breit; R.c.height = h; R.mp = (breit * h) / 1e6; bildMP += R.mp; } else R.g.clearRect(0, 0, bleibt ? w : breit, h);
  const p = platzHaltung(f, t), leicht = !fein && !halten && !KAM_STEHT && !reduce && !STATISCH; if (leicht) o.leicht = true; // fährt die Kamera, entsteht das Bild in der leichten Fassung (ohne Striche und Ausschnitt): kein langes Bild auf der Fahrt; steht sie, wird es im ruhigen Takt voll gezeichnet
  FIG.malen(R.g, f.m, p, ax, ay, k, o);
  if (mitRand) FIG.malen(R.g, f.m, p, w + ax, ay, k, { ...o, modus: 'rand', rand: { farbe: f.st.BR, px: BILD.RAND / S.css, a: 1 } });
  R.k = k; R.w = w; R.h = h; R.ax = ax; R.ay = ay; R.dreh = dreh; R.rand = !!mitRand || bleibt; if (mitRand) R.randDreh = dreh; R.t = t; R.sig = t ? lebSig(f, t) : 0; R.fein = fein || halten; R.genau = fein; R.leicht = leicht;
  RUHE_N++; MESS.ruhebilder = (MESS.ruhebilder || 0) + 1; if (fein) MESS.fein = (MESS.fein || 0) + 1; if (MESS.z && raumBewegt(f.st)) (MESS.fehl = MESS.fehl || []).push(`${f.st.key} ruhebild ${f.m.id}`);
}
/* Das feine Ruhebild in Scheiben anlegen: Eine neue Fläche in voller Größe und rund 200 Pfade darauf kosten die Grafikkarte zusammen mehr als einen Takt. Darum entsteht es neben dem alten Bild:
   erst die Fläche (leer), dann je Takt eine Scheibe der Figur (von hinten nach vorn), dann wird getauscht. Bewegt sich die Kamera dazwischen, beginnt es neu. → true, wenn getauscht ist */
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
/* Wer im Raum gerade geht, kommt, aufsteht oder sich setzt */
const raumBewegt = (st) => st.L.some((l) => l.fest == null && ((l.u > 0 && l.u < 1) || l.wende > 0 || (l.warte > 0 && l.u !== (l.drin ? 0 : 1))));
/* Die Ruhebilder eines Raums pflegen: Wer noch keines hat, bekommt es sofort. Sonst reihum: zuerst, wessen Bild nicht mehr zur Kamera passt, dann das Leben.
   leute = alle, die gerade am Platz sind · lebt = der Raum, in dem die Kamera steht (nur dort bewegt sich das Leben) */
/* Der Besucher bleibt: Die Kamera steht, und seit WARM_NACH wurde nicht gescrollt (wer nur durchfährt, löst keine feinen Bilder aus: Neue Flächen kosten Bilder der Fahrt). Bei „weniger Bewegung“ und im Standbild immer. */
const bleibt = () => reduce || STATISCH || (KAM_STEHT && lastT - SCROLL_T >= WARM_NACH);
function ruhePflegen(st, leute, lebt) {
  const t = lebt && !reduce && !STUFE ? st.lz : 0, ruhig = !raumBewegt(st); st.tLeb = t; let frei = BILD.JE_BILD[STUFE];
  const kMax = BILD.K_FEIN[STUFE], feinOk = lebt && kMax > 0 && bleibt() && ruhig; // fein wird nur, wer im Raum der Kamera am Platz ist, und nur, wenn die Kamera steht
  let feinMP = 0; if (feinOk) for (const f of leute) { const R = f.sp && f.sp.ruhe; if (R && R.fein) feinMP += R.mp; }
  const braucht = [];
  for (const f of leute) {
    const sp = spVon(f), R = sp.ruhe, hov = f.l.hovZiel > 0 || f.l.hov > 0.02;
    if (!R || R.k === undefined) { if (RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, t, hov, feinOk && (reduce || STATISCH)); } else NOCHMAL = true; continue; } // wer noch keines hat, bekommt es: je Bild nur wenige (der Rest im nächsten Bild)
    if (hov && !R.rand) { ruheZeichnen(f, t, hov, feinOk && R.genau); continue; }
    const dz = Math.max(0.7, f.z - cam.z), kx = S.f / dz, soll = ruheStufe(kx), dreh = Math.PI - f.blick + Math.atan2(f.x - cam.x, dz);
    const dw = Math.abs(dreh - R.dreh), alt = (R.fein ? kx > R.k * 1.15 : soll > R.k) || dw > (kx < 80 ? 1.3 : 0.3); // (ein feines Bild misst sich an der gezeigten Größe, nicht an der nächsten festen Stufe: Sonst entstand es reihum grob und wieder fein, und niemand im Raum kam mehr zum Leben) // sofort neu: zu grob oder deutlich verdreht (kleine Figuren in der Ferne vertragen mehr). Ein zu feines Bild bleibt: Verkleinern kostet nur.
    const kf = Math.min(kMax, kx), sichtbar = feinOk && kx >= 30 && (() => { const q = P(f.x, f.boden, f.z); return q[0] > -0.4 * kx && q[0] < S.w + 0.4 * kx; })();
    if (alt) braucht.push([f, 0, kx]);
    else if (sichtbar && (!R.genau || Math.abs(R.k - kf) > 0.01)) braucht.push([f, 0.5, kx, R.fein ? R.mp : 0]); // steht noch nicht in genau der gezeigten Größe: die vordersten zuerst, einer je Bild
    else if ((t && R.sig !== lebSig(f, t)) || (KAM_STEHT && (R.leicht || (dw > 0.05 && kx >= 80)))) braucht.push([f, 1, kx]); // das Leben, und wer nur leicht verdreht steht: im ruhigen Takt (kein Schwall neuer Bilder beim Ankommen)
  }
  if (!braucht.length) return; // (auch während jemand geht: Das Leben der anderen läuft ruhig weiter, siehe taktGesperrt; nur neue Flächen und Bilder für eine neue Kameralage entstehen dann nicht)
  const takt = !HIMMEL_LEBT || lastT - (st.pflegeT || 0) >= TAKT_RUHE[STUFE] * 2.2 - 4; if (HIMMEL_LEBT) frei = 1; let lebFrei = 1, lebt2 = false; // unter Dämmerung und Feuerwerk lebt das Dach langsamer: Die Grafikkarte hat mit dem Himmel zu tun // das Leben läuft im ruhigen Takt, auch wenn gerade jedes Bild gezeichnet wird (Umsehen, Kamerafahrt)
  braucht.sort((a, b) => a[1] - b[1] || (a[1] === 0.5 ? b[2] - a[2] : (a[0].sp.ruhe.t || 0) - (b[0].sp.ruhe.t || 0))); // erst, wessen Bild nicht mehr zur Kamera passt, dann die feinen Bilder (vorn zuerst), dann das älteste Bild: so kommt jeder reihum dran
  let offen = false;
  for (const [f, art, kx, mpAlt] of braucht) {
    if (!ruhig && art === 0) continue;
    if (art === 0.5) { // passt das feine Bild noch ins Budget? (grobe Schätzung aus dem Rahmen des vorhandenen Bilds)
      const R = f.sp.ruhe, kf = Math.min(kMax, kx), mp = (R.mp * (kf / R.k) * (kf / R.k)) / (R.rand ? 2 : 1);
      if (feinMP - mpAlt + mp <= BILD.FEIN_MP[STUFE]) { if (frei <= 0 || RUHE_FREI <= 0) { offen = true; break; } frei = 0; RUHE_FREI--; feinSchritt(f, t); offen = true; break; } // je Bild ein Schritt an einem feinen Bild (Fläche anlegen bzw. eine Scheibe zeichnen), sonst nichts
      if (!t || R.sig === lebSig(f, t)) continue; // passt nicht mehr ins Budget der feinen Bilder: Er lebt mit dem gröberen Bild weiter
    }
    if (art !== 0) { const Rz = f.sp.ruhe; if (!takt || lastT - (Rz.zt || 0) < TAKT_RUHE[STUFE] - 4) continue; if (lebFrei <= 0) { lebt2 = true; continue; } lebFrei--; Rz.zt = lastT; } // je Mensch höchstens ein neues Bild im ruhigen Takt (rund 30 je Sekunde: eine weiche Bewegung zeigt so keine Stufen), je Bild höchstens einer
    if (frei <= 0 || RUHE_FREI <= 0) break; frei--; RUHE_FREI--; ruheZeichnen(f, t, f.l.hovZiel > 0 || f.l.hov > 0.02, art !== 0 && feinOk && f.sp.ruhe.genau); st.pflegeT = lastT;
  }
  if (lebt2 && !HIMMEL_LEBT) NOCHMAL = true; // zwei bewegen sich zugleich: Der zweite kommt gleich im nächsten Takt des Bildschirms dran (sonst genügt der ruhige Takt)
  if (KAM_STEHT && (offen || braucht[0][1] === 0)) NOCHMAL = true; // es passt noch nicht jedes Bild zur Kamera: weiterzeichnen, bis alle stimmen
}
/* Aus dem Stand am Platz in die Gehrichtung (bzw. beim Ankommen aus der Gehrichtung in den Blick am Platz): e = Anteil der Zeit am Platz (0 = arbeitet, 1 = geht los) */
function aufRichtung(f, e) {
  const d = direkt(f), a = d ? BILD.DREH_AB : BILD.AUF_ANTEIL; if (e <= a) return f.blick; // (in jedem Bild neu gezeichnet: Er dreht sich schon im Aufstehen, über gut zwei Drittel der Zeit am Platz: auch eine halbe Drehung bleibt ruhig)
  const ziel = f.l.drin ? f.w.hd0 + Math.PI : f.w.hd0; // wer zurückkommt, steht noch so, wie er gekommen ist
  return f.blick + winkelZu(f.blick, ziel) * (d ? FIG.sanft : smooth)((e - a) / (1 - a));
}
/* Die Bilder unterwegs: Gehen (Phase, Richtung), Stehen (Richtung), die Tasche. probe = { auge, dz }: aus dieser Sicht wird gezeichnet, wenn das Bild fehlt */
function gehZelle(f, a, ph, dir, probe) {
  return atlasZelle(a, ph * 64 + dir, (g, x, y, kk) => FIG.malen(g, f.m, gehPose(f, (ph / BILD.PH) * TAU), x, y, kk, { dreh: (dir / BILD.DIR) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r: f.tasche ? 'tasche' : null, leicht: true }));
}
function stehZelle(f, a, dir, probe) {
  return atlasZelle(a, 4000 + dir, (g, x, y, kk) => FIG.malen(g, f.m, stehPose(f), x, y, kk, { dreh: (dir / BILD.DIR) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r: f.tasche ? 'tasche' : null, leicht: true }));
}
/* Fehlt ein Bild, während jemand unterwegs ist, tut es das eines Nachbarn (eine Richtung daneben, sonst eine Phase daneben): so wird unterwegs nichts gezeichnet. Erst wenn auch das fehlt, entsteht das Bild jetzt. */
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
  if (!a.map.has(w0 * 64 + i) && a.n > 0 && ZELLEN_FREI-- <= 0) return a.n - 1; // je Bild entsteht höchstens ein neues Bild fürs Aufstehen: bis dahin das zuletzt gezeichnete
  return aufZelle(f, a, i, w0, probe);
}
let ZELLEN_FREI = 1;
/* Die Tasche neben dem Platz als eigenes kleines Bild (nicht aus dem groben Atlas der Geh-Bilder): steht die Kamera, in genau der gezeigten Größe und auf ganzen Pixeln */
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
const AUF_WINKEL = 18; // das Aufstehen wird je Blickwinkel der Kamera vorgezeichnet (in Schritten von 10 Grad)
function aufZelle(f, a, i, wNr, probe) {
  return atlasZelle(a, wNr * 64 + i, (g, x, y, kk) => { const [p, r, li] = aufPose(f, i / (BILD.AUF - 1)); FIG.malen(g, f.m, p, x, y, kk, { dreh: (wNr / AUF_WINKEL) * TAU, auge: probe.auge, dz: probe.dz, licht: f.st.LI, L: probe.L || f.st.LI.L, saum: { farbe: f.st.LI.saum, a: 0.32 }, r, l: li, leicht: true }); });
}
const aufWinkelNr = (f, dz) => ((Math.round(((Math.PI - f.blick + Math.atan2(f.x - cam.x, dz)) / TAU) * AUF_WINKEL) % AUF_WINKEL) + AUF_WINKEL) % AUF_WINKEL;
/* ═══════════════ MENSCHEN IN BEWEGUNG (Auftrag AB, 22.11.) ═══════════════
   Wer aufsteht, sich dreht, geht, ankommt oder sich setzt, hat eine eigene kleine Fläche (bewFlaeche, höchstens BILD.K_BEW Pixel je Meter). Sie wird in jedem Bild neu gezeichnet, in der leichten Fassung
   (ohne Lichtkanten, Falten, Ausschnitt): mit der Haltung genau dieses Augenblicks und in genau seiner Richtung. Keine Phasen, keine Richtungen in Stufen, keine vorgezeichneten Sätze.
   Je Bild werden höchstens BILD.BEW_JE_BILD Menschen neu gezeichnet; bewegen sich mehr, kommen sie reihum dran (ihr Bild wandert trotzdem in jedem Bild weiter).
   Das Publikum auf dem Dach (f.stempel: viele zugleich, klein, im Dunkeln) bleibt bei vorgezeichneten Bildern. ?gang=atlas schaltet für alle auf die vorgezeichneten Bilder zurück (zum Vergleichen und als Rückweg). */
const DIREKT = QUERY.get('gang') !== 'atlas', direkt = (f) => DIREKT && !f.stempel;
const BEWEGTE = new Set(), W0 = 0.3, frac = (x) => x - Math.floor(x); // W0 = Schrittlänge, mit der ein Gang aus dem Stand beginnt und im Stand endet (Anteil des vollen Schritts)
let BEW_TAKT = 0, BEW_I = 0, BEW_ZAHL = 0;
function bewFlaeche(f, k) {
  const sp = spVon(f), soll = Math.min(BILD.K_BEW[STUFE], ruheStufe(Math.max(k, S.f / Math.max(0.8, f.z - cam.z)))); let B = sp.bew;
  if (!B || B.k < soll * 0.8) { bewFrei(sp); const g = f.m.gr, pad = 5, cw = Math.ceil(1.8 * g * soll) + 2 * pad, ch = Math.ceil(2.1 * g * soll) + 2 * pad, c = document.createElement('canvas'); c.width = cw; c.height = ch;
    B = sp.bew = { c, g: c.getContext('2d'), k: soll, cw, ch, ax: cw / 2, ay: pad + Math.ceil(1.9 * g * soll), mp: (cw * ch) / 1e6, sig: '', zuletzt: lastT }; bildMP += B.mp; BEWEGTE.add(sp); }
  return B;
}
function bewFrei(sp) { const B = sp && sp.bew; if (B) { bildMP -= B.mp; B.c.width = B.c.height = 0; sp.bew = null; BEWEGTE.delete(sp); } }
/* Der Stand, aus dem ein Schritt beginnt und in dem einer endet: das Gewicht auf dem rechten Bein (der linke Fuß ist frei für den ersten Schritt), die Füße in der Grundstellung */
const losPose = (f) => { const p = FIG.steh(0.4, 'haengt', f.tasche ? 'traegt' : 'haengt'); p.ei = 0; return p; };
/* Die Haltung eines Menschen in Bewegung → { p, r, li (was die Hände halten), lm (0 = Licht des Platzes … 1 = Licht des Raums) } */
function bewPose(f, zs) {
  const a = BILD.AUF_ANTEIL;
  if (zs.s <= 0) {
    if (zs.q <= a) { const [p, r, li] = aufPose(f, zs.q / a); return { p, r, li, lm: FIG.sanft((zs.q / a - 0.3) / 0.7) }; }
    return { p: FIG.zwischen(stehPose(f), losPose(f), FIG.sanft((zs.q - a) / (1 - a))), r: f.tasche ? 'tasche' : null, li: null, lm: 1 }; // dreht sich in die Gehrichtung und nimmt dabei das Gewicht aufs Standbein
  }
  const g = FIG.sanft(f.gang ?? 1), wN = f.wN ?? 1, p = FIG.zwischen(losPose(f), FIG.geh(f.schritt, f.tasche ? 'r' : '', wN, f.wR ?? 1, f.wL ?? 1, wN), g);
  p.kd += Math.max(-0.35, Math.min(0.35, winkelZu(f.hd, zs.ziel) * 0.7)) * g; // der Blick geht voraus in die Kurve
  const T = f.st.tuer; if (T && !f.l.drin) { const d = f.w.sT - zs.s, gr = FIG.sanft((1.2 - d) / 0.45) * (1 - FIG.sanft((0.5 - d) / 0.45)); if (gr > 0.01) { p.al = p.al.map((v, i) => lerp(v, FIG.ARME.greift[i], 0.85 * gr)); if (gr > 0.5) p.hl = 'greift'; } } // an der Tür: Die freie Hand geht zum Griff
  return { p, r: f.tasche ? 'tasche' : null, li: null, lm: 1 };
}
function bewSetzen(f, zs, q, k, auge, dz, LI) {
  const B = bewFlaeche(f, k), dreh = Math.PI - f.hd + Math.atan2(zs.x - cam.x, dz), Hl = bewPose(f, zs), sg = `${FIG.sig(Hl.p)}|${Math.round(dreh * 300)}|${Hl.r}|${Hl.li}|${Math.round(Hl.lm * 20)}`;
  if (B.takt !== BEW_TAKT) { B.takt = BEW_TAKT; B.nr = BEW_I++; } // (derselbe Mensch kann in einem Bild mehrmals eingesetzt werden: gezählt wird er einmal)
  const JE = BILD.BEW_JE_BILD[STUFE], n = Math.max(1, BEW_ZAHL), dran = n <= JE || (((B.nr - BEW_TAKT * JE) % n) + n) % n < JE; // reihum, wenn sich mehr bewegen, als je Bild neu gezeichnet werden (bei dreien kommt jeder in zwei von drei Bildern dran)
  if (B.sig !== sg && dran) {
    let L = LI.L; if (Hl.lm < 1) { const P0 = platzLicht(f, LI), mx = lerp(P0[0], L[0], Hl.lm), my = lerp(P0[1], L[1], Hl.lm), n = Math.hypot(mx, my) || 1; L = [mx / n, my / n]; } // das Licht des Platzes (Bildschirm, Leuchte) geht beim Aufstehen stetig in das Licht des Raums über
    B.g.clearRect(0, 0, B.cw, B.ch); FIG.malen(B.g, f.m, Hl.p, B.ax, B.ay, B.k, { dreh, auge, dz, licht: LI, L, saum: { farbe: LI.saum, a: 0.32 }, r: Hl.r, l: Hl.li, leicht: true });
    B.sig = sg; B.dreh = dreh; B.p = Hl.p; MESS.bewegt = (MESS.bewegt || 0) + 1;
  } else if (B.sig !== sg) NOCHMAL = true;
  B.zuletzt = lastT; if (!B.sig) return B; // noch kein Bild (brechen viele zugleich auf, entstehen ihre ersten Bilder reihum): so lange zeigt maleMensch das Ruhebild
  const s = k / B.k; ctx.drawImage(B.c, 0, 0, B.cw, B.ch, q[0] - B.ax * s, q[1] - B.ay * s, B.cw * s, B.ch * s);
  return B;
}
/* Der Standfuß hält: Dreht sich der Mensch in einer Kurve, dreht er sich um den Fuß, der gerade steht (nicht um seine Mitte: Der Fuß wischte sonst über den Boden).
   Dazu wird der Mensch um f.ox, f.oz neben seinen Weg gesetzt, genau so weit, dass der Knöchel des Standfußes im Raum stehen bleibt; die Abweichung klingt weich ab (FUSS_TAU) und ist am Platz null. */
const FUSS_TAU = 900, FUSSHALT = QUERY.get('fusshalt') !== '0'; // ?fusshalt=0: ohne (zum Vergleichen: Der Mensch bleibt genau auf seinem Weg, in engen Kurven wischt dann der Standfuß)
function fussHalt(f, zs, dt, l) {
  const pk = FIG.punkte(f.m, bewPose(f, zs).p, 0, 0, 1, { dreh: 0 }), re = frac(f.schritt / TAU + 0.3) < frac(f.schritt / TAU + 0.8), a = re ? pk.ar : pk.al, g = f.m.gr, c = Math.cos(f.hd), s = Math.sin(f.hd);
  const wx = zs.x + g * (a[0] * c + a[2] * s), wz = zs.z + g * (-a[0] * s + a[2] * c), nah = smooth(Math.min(1, (l.drin ? zs.s : f.w.len - zs.s) / 1.5)); // am Platz und am Ende des Wegs gilt der Weg selbst
  if (f.fuss !== re || !f.halt2) { f.fuss = re; f.halt2 = [wx + (f.ox || 0), wz + (f.oz || 0)]; } // ein neuer Standfuß: Er steht, wo er jetzt ist
  const ab = 1 - Math.exp(-dt / FUSS_TAU), ox = (f.halt2[0] - wx) * (1 - ab), oz = (f.halt2[1] - wz) * (1 - ab), m = Math.hypot(ox, oz), k = Math.min(1, 0.4 / Math.max(m, 1e-6)) * (nah < 1 ? Math.pow(nah, dt / 300) : 1); // nie weiter als 40 cm neben dem Weg; zum Platz und zum Ende des Wegs hin klingt die Abweichung schneller ab
  f.ox = ox * k; f.oz = oz * k; f.halt2 = [wx + f.ox, wz + f.oz];
}
/* Ein Schritt weiter (je Bild, aus dem Takt der Räume): Richtung, Schrittphase, Schrittlängen. Die Phase hängt am zurückgelegten Weg und an der Schrittlänge des Fußes, der gerade steht: Er rutscht nicht.
   Die Schrittlänge folgt dem Tempo (kurz beim Anlaufen und Auslaufen); sie gilt für einen Fuß ab dem Augenblick, in dem er aufsetzt. Die Richtung folgt dem Weg weich (kein Knick), nie schneller als DREH_TEMPO. */
function gangSchritt(f, zs, dt, l) {
  const ds = Math.abs(zs.s - f.sAlt), v = dt > 0 ? ds / dt : 0; f.sAlt = zs.s;
  if (l.fest != null) { f.hd = zs.ziel; f.gang = 1; f.wR = f.wL = f.wN = 1; f.schritt = (zs.s / SCHRITT) * Math.PI; return; }
  { const d = winkelZu(f.hd, zs.ziel), m = dt * DREH_TEMPO; f.hd += Math.max(-m, Math.min(m, d * (1 - Math.exp(-dt / 130)))); }
  f.wN = Math.min(lerp(W0, 1, smooth(v / GEH_TEMPO)), l.drin ? lerp(W0, 1, smooth(zs.s / 1.0)) : 1);
  const uR = frac(f.schritt / TAU + 0.3), uL = frac(f.schritt / TAU + 0.8); f.schritt += (ds / (SCHRITT * (uR < uL ? f.wR : f.wL))) * Math.PI;
  if (frac(f.schritt / TAU + 0.3) < uR) f.wR = f.wN; if (frac(f.schritt / TAU + 0.8) < uL) f.wL = f.wN; // der Fuß setzt auf: Ab jetzt gilt seine neue Schrittlänge
  f.gang = Math.min((f.gang ?? 0) + dt / 240, 1, l.drin ? zs.s / 0.08 : 1);
  if (FUSSHALT) fussHalt(f, zs, dt, l); // aus dem Stand in den Gang (0,24 s) und am Platz zurück in den Stand (auf den letzten Zentimetern: Die Schritte sind dort schon kurz, die Füße stehen fast)
}
/* Ein Mensch im Bild: nur noch fertige Bilder (Schatten, Lichtsaum, Figur). zs = wo er ist (wo), h = wie sehr er hervorgehoben ist */
function maleMensch(f, zs0, t, LI, BR, h) {
  const zs = zs0.s > 0 && (f.ox || f.oz) && direkt(f) ? { ...zs0, x: zs0.x + f.ox, z: zs0.z + f.oz } : zs0; // unterwegs: um den Fußhalt neben dem Weg (fussHalt)
  const x = zs.x, z = zs.z, dz = z - cam.z; if (dz < 0.7) return;
  const st = f.st, T = st.tuer, hinten = T && z > T.z, yb = f.boden * (1 - smooth(f.stufe ? (zs.s - f.stufe[0]) / f.stufe[1] : zs.s / 0.5)), q = P(x, yb, z), k = S.f / dz; // vom Podest bzw. von der Bühne herunter
  if (q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return;
  if (hinten) { const o = rectZ(T.x0, T.x1, 0, TUER_H, T.z); if (!o) return; ctx.save(); ctx.beginPath(); ctx.rect(o[0], o[1], o[2], o[3]); ctx.clip(); } // im Flur: nur durch die offene Tür zu sehen
  const auge = cam.y - oy - yb;
  { const fl = Math.max(0.1, Math.min(0.5, auge / dz)); if (st.key === 'dach') schattenSetzen(q[0], q[1], k, fl); else { schattenSetzen(q[0], q[1], k * 0.86, fl); schattenSetzen(q[0] - LI.L[0] * 0.2 * k, q[1] + 0.02 * k * fl, k * 1.12, fl * 0.9, 0.55); } } // (auf dem Dach ein Schatten je Mensch: dort stehen viele, und das Licht kommt von überall) // Kontaktschatten unter den Füßen, dazu ein weicher Schatten vom Licht weg: Der Mensch steht im Raum
  if (zs.q <= 0) { // am Platz: das Ruhebild, darunter der Lichtsaum
    let R = spVon(f).ruhe; if (!R || R.k === undefined) { if (RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, 0, false, (reduce || STATISCH) && BILD.K_FEIN[STUFE] > 0 && !!AKT.F && AKT.F.key === st.key); R = f.sp.ruhe; } else { NOCHMAL = true; R = null; } }
    if (R) {
      const s = Math.abs(k / R.k - 1) < 1e-4 ? 1 : k / R.k, eins = s === 1 && R.genau && KAM_STEHT, X = eins ? Math.round(q[0] - R.ax) : q[0] - R.ax * s, Y = eins ? Math.round(q[1] - R.ay) : q[1] - R.ay * s; // ein feines Bild liegt auf ganzen Pixeln, in voller Schärfe
      if (h > 0.02 && R.rand) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * Math.min(1, h * 1.4); ctx.drawImage(R.c, R.w, 0, R.w, R.h, X, Y, R.w * s, R.h * s); ctx.globalAlpha = a0; }
      ctx.drawImage(R.c, 0, 0, R.w, R.h, X, Y, R.w * s, R.h * s);
      if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'ruhe', platzHaltung(f, R.t), R.dreh, R.k, k, [X + R.ax * s, Y + R.ay * s], auge, dz);
    }
  } else if (direkt(f)) { // in Bewegung (aufstehen, drehen, gehen, ankommen, hinsetzen): die eigene kleine Fläche, in jedem Bild neu gezeichnet; am Anfang und am Ende blendet das Ruhebild über
    const B = bewSetzen(f, zs, q, k, auge, dz, LI), tau = f.l.u * f.l.dauer - f.verz, R = f.sp.ruhe, tL = st.tLeb;
    if (f.l.drin && zs.s <= 0 && tau < 900 && tL && R && R.k !== undefined && R.sig !== lebSig(f, tL) && RUHE_FREI > 0) { RUHE_FREI--; ruheZeichnen(f, tL, false, !!R.genau); } // wer ankommt: Sein Ruhebild zeigt noch die Haltung von vorhin; es entsteht einmal neu, bevor es einblendet
    if (tau < BILD.BLENDE_MS && zs.s <= 0 && R && R.k !== undefined) { const s = Math.abs(k / R.k - 1) < 1e-4 ? 1 : k / R.k, eins = s === 1 && R.genau && KAM_STEHT, X = eins ? Math.round(q[0] - R.ax) : q[0] - R.ax * s, Y = eins ? Math.round(q[1] - R.ay) : q[1] - R.ay * s, a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (B.sig ? 1 - FIG.sanft(tau / BILD.BLENDE_MS) : 1); ctx.drawImage(R.c, 0, 0, R.w, R.h, X, Y, R.w * s, R.h * s); ctx.globalAlpha = a0; }
    if (MESS.spur && MESS.spur.f === f && B.sig) spurMerk(f, zs, zs.s <= 0 ? (zs.q <= BILD.AUF_ANTEIL ? 'auf' : 'steh') : f.dreht && !(f.gang > 0.02) ? 'steh' : 'geh', B.p, B.dreh, B.k, k, q, auge, dz);
  } else if (zs.s <= 0) { // (das Publikum auf dem Dach und ?gang=atlas: vorgezeichnete Bilder) aufstehen und zusammenpacken, dann in die Gehrichtung drehen (rückwärts: ankommen, zum Platz drehen, abstellen, hinsetzen)
    const a = BILD.AUF_ANTEIL, probe = { auge, dz };
    if (zs.q <= a) { const A = aufAtlas(f, k); probe.L = platzLicht(f, LI); atlasSetzen(A, aufNr(f, A, Math.round((zs.q / a) * (BILD.AUF - 1)), dz, probe), q[0], q[1], k); if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'auf', aufPose(f, Math.round((zs.q / a) * (BILD.AUF - 1)) / (BILD.AUF - 1))[0], (aufWinkelNr(f, dz) / AUF_WINKEL) * TAU, A.k, k, q, auge, dz); }
    else { const A = wegAtlas(f, k); atlasSetzen(A, stehNr(f, A, richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)), probe), q[0], q[1], k); if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, 'steh', stehPose(f), (richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)) / BILD.DIR) * TAU, A.k, k, q, auge, dz); }
  } else { // unterwegs: ein Bild des Schritts in der Blickrichtung; wer gerade umkehrt, dreht sich im Stand
    const A = wegAtlas(f, k), dir = richtungNr(Math.PI - f.hd + Math.atan2(x - cam.x, dz)), probe = { auge, dz };
    atlasSetzen(A, f.dreht ? stehNr(f, A, dir, probe) : gehNr(f, A, phaseNr(f.schritt), dir, probe), q[0], q[1], k);
    if (MESS.spur && MESS.spur.f === f) spurMerk(f, zs, f.dreht ? 'steh' : 'geh', f.dreht ? stehPose(f) : gehPose(f, (phaseNr(f.schritt) / BILD.PH) * TAU), (dir / BILD.DIR) * TAU, A.k, k, q, auge, dz);
  }
  if (hinten) ctx.restore();
}
/* Vorzeichnen im Leerlauf: Nach dem Betreten eines Raums entstehen je Mensch der Umriss des leeren Platzes, das Aufstehen, das Stehen in allen Richtungen und der Gang zur Tür
   (wer fort ist: der Gang zurück), danach die Gegenrichtung. Die Arbeit liegt als Liste kleiner Aufträge bereit (VOR); je Bild wird nur wenige Millisekunden lang daran gearbeitet,
   nie während jemand geht. Eine Leistung, deren Karte offen ist oder die gerade hervorgehoben wird, kommt zuerst dran. */
const VOR = [];
let warmFuer = '', SCROLL_T = 0, SCROLL_ALT = -1, HIMMEL_LEBT = false;
const WARM_NACH = 400; // ms ohne Scrollen, bevor im Raum vorgezeichnet wird
/* Vorarbeit: kleine Aufträge, die etwas anlegen, bevor es gebraucht wird (Flächen, Bilder der Passanten). Je Takt höchstens einer, nur wenn das Bild selbst schnell war. */
const LEER = [];
let LEER_AN = false;
/* Aufwärmen: Bevor sich etwas bewegt (vor dem Einflug), wird jede Ansicht der Fahrt einmal gezeichnet, je Takt ein paar, und im selben Takt wieder mit dem richtigen Bild überzeichnet (zu sehen ist davon nichts).
   Was der Browser beim ersten Mal braucht (das Skript übersetzen, Farben der Tageszeit rechnen, Verläufe, die Zeichenwege der Grafikkarte), kostet so kein Bild der Fahrt. Danach beginnt der Einflug. */
const TROCKEN = { an: false, liste: [], takt: 0, danach: null, MS: 26 };
function aufwaermen(now) {
  const T = TROCKEN; if (!T.liste.length) return;
  if (T.takt++ < 1) return; // das erste Bild steht zuerst
  const t0 = performance.now(); T.an = true;
  try { while (T.liste.length && performance.now() - t0 < T.MS) drawScene(ansicht(T.liste.shift()), now); } catch (e) { console.error(e); T.liste.length = 0; } finally { T.an = false; }
  KAM_SIG = ''; sceneDirty = true;
  if (!T.liste.length && T.danach) { const f = T.danach; T.danach = null; f(); }
}
function vorarbeit() { // einmal nach dem Start: die zwei großen Flächen der ruhenden Zeichnung und die Bilder der Passanten
  LEER.push(() => { for (const R of [RUHEBILD, RUHE2]) { flaeche(R); R.g.clearRect(0, 0, 2, 2); } });
  if (ORT.lage < 1.6) for (const db of [0]) for (let ph = 0; ph < WALK.PH; ph++) WALKERS.forEach(([, v, , , prop, wer], i) => LEER.push(() => { if (ORT.lage > 2.4) return; WALK_FREI = 1; walkerZelle(i, menschVon(wer, AKZ.lav), prop, ph, db, v > 0 ? Math.PI / 2 : -Math.PI / 2); }));
}
function leerSchritt() { if (!LEER.length) return false; const c0 = ctx, o0 = oy; try { LEER.shift()(); } catch (e) { console.error(e); LEER.length = 0; } ctx = c0; oy = o0; return true; }
function wegProben(f, hin, base) { // die Bilder, die der Gang braucht, in der Reihenfolge des Wegs: [Phase, Richtung, Probe]
  const out = [], seen = new Set(), w = f.w, ds = 0.03, n = Math.ceil(w.len / ds);
  let hd = hin ? w.hd0 : ortAufWeg(w, w.len)[2] + Math.PI;
  for (let i = 0; i <= n; i++) {
    const s = hin ? Math.min(w.len, i * ds) : Math.max(0, w.len - i * ds), o = ortAufWeg(w, s), dz = o[1] - cam.z; if (dz < 0.7) continue;
    hd = dreheZu(hd, o[2] + (hin ? 0 : Math.PI), (ds / GEH_TEMPO) * DREH_TEMPO);
    const yb = f.boden * (1 - smooth(f.stufe ? (s - f.stufe[0]) / f.stufe[1] : s / 0.5)), ph = phaseNr(((i * ds) / SCHRITT) * Math.PI), wkl = Math.PI - hd + Math.atan2(o[0] - cam.x, dz);
    const dir = richtungNr(wkl), key = ph * 64 + dir; if (seen.has(key)) continue; seen.add(key); // (weicht der Blickwinkel später leicht ab, weil sich jemand umsieht, nimmt gehNr das Bild des Nachbarn)
    out.push([ph, dir, { auge: cam.y - base - yb, dz }]);
  }
  return out;
}
let VOR_G = null;
function umrissVor(f) { // der Umriss des leeren Platzes, auf eine unsichtbare Fläche gestempelt (dabei entsteht sein Bild)
  if (f.z - cam.z < 0.8) return; if (!VOR_G) { const c = document.createElement('canvas'); c.width = c.height = 8; VOR_G = c.getContext('2d'); }
  const c0 = ctx; ctx = VOR_G; try { umrissMalen(f, 0.5, f.st.BR); } finally { ctx = c0; }
}
let warmFertig = '';
function vorwaermen(st, zuerst = null) {
  if (STILL || STATISCH || !st) return;
  const lage = `${st.key}|${BILD_GEN}|${Math.round(cam.x * 12)}|${Math.round(cam.z * 12)}|${Math.round(S.f / 8)}`, schluessel = `${lage}|${zuerst ? zuerst.id : ''}|${st.L.map((l) => (l.drin ? 1 : 0)).join('')}`;
  if (warmFuer === schluessel || warmFertig === lage) return; warmFuer = schluessel; VOR.length = 0; MESS.warmFertig = '';
  const base = st.key === 'dach' ? 0 : (INS.F ? INS.F.base : 0), reihe = zuerst ? [zuerst] : [], zwei = []; // nur die Leistung unter dem Zeiger bzw. mit offener Karte (Speicher): Alles andere entsteht erst, wenn es gebraucht wird
  { // die Auflösung je Atlas: so groß, wie der Mensch auf seinem ganzen Weg höchstens zu sehen ist (teilen sich mehrere einen Atlas, zählt der Nächste). Nur hier darf ein Atlas feiner neu entstehen.
    const alle = []; for (const l of reihe) for (const f of l.leute) { if (f.z - cam.z < 0.8) continue; let zMin = f.z; for (let i = 0; i < f.w.pts.length; i += 4) zMin = Math.min(zMin, f.w.pts[i][1]); f.kWeg = S.f / Math.max(0.8, zMin - cam.z); alle.push(f); }
    alle.sort((a, b) => b.kWeg - a.kWeg); for (const f of alle) { if (direkt(f)) continue; wegAtlas(f, f.kWeg, true); aufAtlas(f, S.f / (f.z - cam.z), true); }
  }
  for (const l of reihe) for (const f of l.leute) {
    const dz = f.z - cam.z; if (dz < 0.8) continue;
    const k = S.f / dz, probe = { auge: cam.y - base - f.boden, dz }, wNr = aufWinkelNr(f, dz), LP = platzLicht(f, st.LI);
    if (!f.stempel) VOR.push(() => umrissVor(f));
    if (direkt(f)) { VOR.push(() => bewFlaeche(f, k)); continue; } // wer sich in jedem Bild neu zeichnet, braucht nur seine Fläche (sie liegt bereit, bevor er aufbricht)
    // der Lichtsaum des Hervorhebens liegt bereit, bevor der Zeiger kommt
    for (let i = 0; i < BILD.AUF; i++) VOR.push(() => aufZelle(f, aufAtlas(f, k), i, wNr, { ...probe, L: LP }));
    if (f.tasche) VOR.push(() => taschenZelle(f, wegAtlas(f, k)));
    for (const hin of [l.drin, !l.drin]) {
      const liste = hin === l.drin ? VOR : zwei;
      liste.push(() => { // der Gang in dieser Richtung: erst jetzt ausrechnen, welche Bilder er braucht, und sie vorn in die Liste legen
        const von = hin ? f.blick : f.w.hd0 + Math.PI, zu = hin ? f.w.hd0 : f.blick, d = winkelZu(von, zu), dirs = new Set(), neu = [];
        for (let j = 0; j <= 8; j++) dirs.add(richtungNr(Math.PI - (von + (d * j) / 8) + Math.atan2(f.x - cam.x, dz)));
        for (const dir of dirs) neu.push(() => stehZelle(f, wegAtlas(f, k), dir, probe));
        for (const [ph, dir, pr] of wegProben(f, hin, base)) neu.push(() => gehZelle(f, wegAtlas(f, k), ph, dir, pr));
        VOR.unshift(...neu);
      });
    }
    zwei.push(() => { const A = wegAtlas(f, k); for (let dir = 0; dir < BILD.DIR; dir++) stehZelle(f, A, dir, probe); }); // Umkehren mitten im Weg: Stehen in jeder Richtung
  }
  VOR.push(() => { warmFertig = lage; MESS.warmFertig = lage; });
  MESS.warmOffen = VOR.length;
}
/* Ein Häppchen Vorzeichnen (aus der Bildschleife, nur wenn sonst nichts zu zeichnen ist) */
function warmSchritt(hoechstens = 99) { // hoechstens = so viele Bilder (nach einem gezeichneten Bild nur eines: so geht das Vorzeichnen auch weiter, während sich der Besucher umsieht)
  if (!VOR.length) return false;
  const st = AKT.F && RAUM[AKT.F.key]; if (!st || AKT.k < 1 || raumBewegt(st)) return false;
  if (lastT - SCROLL_T < WARM_NACH || (DAEMM_WARTET && !DST.fertig)) return false; // (und nie, solange die Fassungen der Dämmerung entstehen)
  if (bildMP > BILD.MP[STUFE]) { bilderSparen(); if (bildMP > BILD.MP[STUFE]) return false; } // die Grenze gilt auch für das Vorzeichnen: Was dann noch fehlt, entsteht erst, wenn es gebraucht wird (bis dahin tut es das Bild eines Nachbarn) // erst, wenn der Besucher im Raum bleibt: Wer nur durchfährt, soll nicht Hunderte Bilder anlegen lassen
  const t0 = performance.now(), ende = t0 + BILD.WARM_MS[STUFE], o0 = oy, c0 = ctx; oy = st.key === 'dach' ? 0 : AKT.F.base;
  const gez = () => (MESS.vorgezeichnet || 0) + (MESS.ruhebilder || 0) + (FIG.stempel.neu || 0), g0 = gez(), zellen = Math.min(hoechstens, HIMMEL_LEBT ? 1 : BILD.WARM_ZELLEN[STUFE]);
  try { while (VOR.length && performance.now() < ende && gez() - g0 < zellen) VOR.shift()(); } catch (e) { console.error(e); VOR.length = 0; }
  oy = o0; ctx = c0; MESS.warmOffen = VOR.length;
  return true;
}
/* Ein Mensch an einer Stelle der Welt, ohne Leistung dahinter (Empfang, Straße, Bühne). hd = Blickrichtung (0 = von uns weg, π/2 = nach rechts). */
function stelleMensch(m, p, x, y, z, hd, LI, extra) {
  const dz = z - cam.z; if (dz < 0.7) return null;
  const q = P(x, y, z), k = S.f / dz; if (k < 3 || q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return null;
  FIG.schatten(ctx, q[0], q[1], k, 0.44, Math.max(0.1, Math.min(0.5, (cam.y - oy - y) / dz)), 0.45);
  const kl = TON.kl; TON.kl = null; // die Farben eines Menschen rechnet sein eigenes Licht (LICHT)
  try { return FIG.malen(ctx, m, p, q[0], q[1], k, { dreh: Math.PI - hd + Math.atan2(x - cam.x, dz), auge: cam.y - oy - y, dz, licht: LI, L: LI.L, saum: { farbe: LI.saum, a: 0.3 }, ...extra }); } finally { TON.kl = kl; }
}
/* Derselbe Mensch als fertiges Bild (kein Pfad im Bild selbst): Es entsteht in einer festen Stufe der Auflösung und wird eingesetzt; sein Leben (takt = Zeit in Schritten) erneuert es nur, solange die Kamera steht. */
/* (das Bild eines Menschen ohne Leistung entsteht neu, wenn sich seine Haltung ändert: Kennzahl FIG.sig; in Ruhe bleibt es stehen) */
const EG_TAKT = taktGruppe(41, [{ saat: 2.2, paar: 9, hoert: true }, { saat: 4.6, paar: 9, redet: true, hoert: true }]), SCHAU_TAKT = taktGruppe(43, [{ saat: 6.4 }]); // die zwei am Empfang · der Passant am Schaufenster
function stelleRuhig(name, t, m, p, x, y, z, hd, LI, extra) {
  const dz = z - cam.z; if (dz < 0.7) return null;
  const q = P(x, y, z), k = S.f / dz; if (k < 3 || q[0] + 1.2 * k < 0 || q[0] - 1.2 * k > S.w) return null;
  FIG.schatten(ctx, q[0], q[1], k, 0.44, Math.max(0.1, Math.min(0.5, (cam.y - oy - y) / dz)), 0.45);
  const dreh = Math.round((Math.PI - hd + Math.atan2(x - cam.x, dz)) * 12) / 12, kb = bleibt() && BILD.K_FEIN[STUFE] ? Math.min(BILD.K_FEIN[STUFE], k) : ruheStufe(k * 1.8), auge = cam.y - oy - y; // steht die Kamera: in genau der gezeigten Größe (scharf), sonst eine feste Stufe
  return stempelRuhig(name, `${dreh}|${t ? FIG.sig(p) : 0}`, q[0], q[1], k, (g, sx, sy, kk) => FIG.malen(g, m, p, sx, sy, kk, { dreh, auge, dz, licht: LI, L: LI.L, saum: { farbe: LI.saum, a: 0.3 }, ...extra }), kb);
}
/* Die Passanten auf der Straße: je Mensch ein Atlas mit WALK.PH Phasen des Doppelschritts (je grober Blickrichtung), wie die Menschen in den Räumen. Im Bild wird nur eingesetzt;
   je Bild entsteht höchstens ein neues (WALK_FREI), fehlt eines, tut es das der Nachbarphase. */
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
/* Die Menschen eines Raums als Dinge mit Tiefe (sie werden mit den Möbeln sortiert): Licht am Platz, Stuhl, Tasche, der Mensch selbst bzw. der Umriss des leeren Platzes. */
/* Wo ein Mensch am Platz im Bild liegt: das Rechteck seines Ruhebilds und das seiner Schatten am Boden (nur fürs Nachziehen fester Dinge davor: So wird nur nachgezogen, was er wirklich trifft) */
function menschImBild(f, zs) {
  const R = zs.q <= 0 && f.sp && f.sp.ruhe, dz = zs.z - cam.z; if (!R || R.k === undefined || dz < 0.7) return undefined;
  const q = P(zs.x, f.boden, zs.z), k = S.f / dz, s = k / R.k, x = q[0] - R.ax * s, y = q[1] - R.ay * s, luft = 0.11 * k, sx = -0.2 * f.st.LI.L[0]; // (der Rahmen des Ruhebilds hat rundum Luft für das Leben in Ruhe: gut die Hälfte davon zählt nicht mit)
  return [[x + luft, y, x + R.w * s - luft, y + R.h * s], [q[0] + Math.min(-0.4, sx - 0.5) * k, q[1] - 0.2 * k, q[0] + Math.max(0.4, sx + 0.5) * k, q[1] + 0.22 * k]];
}
function menschenDinge(key, t, list) {
  const st = RAUM[key]; if (!st || !st.tuer) return;
  const BR = st.BR, LI = st.LI, amPlatz = []; let auf = 0;
  for (const l of st.L) {
    const h = l.hov, kDa = da(key, l.id), leer = smooth((l.u * l.dauer - 250) / 500);
    for (const f of l.leute) {
      const zs = wo(f), tau = l.u * l.dauer - f.verz, n0 = list.length; if ((zs.q <= 0 || zs.fort) && f.sp && f.sp.bew && lastT - f.sp.bew.zuletzt > 4000) bewFrei(f.sp); // die Fläche der Bewegung wird frei, wenn er wieder ruht oder fort ist
      const hdS = Math.round(f.blick / (Math.PI / 2)) * (Math.PI / 2), sxS = f.x - 0.36 * Math.sin(hdS), szS = f.z - 0.36 * Math.cos(hdS), brS = f.sessel ? 0.5 : 0.32;
      const kS = [Math.min(f.x, sxS) - brS, Math.max(f.x, sxS) + brS, f.boden, f.boden + 1.04, Math.min(f.z, szS) - brS, Math.max(f.z, szS) + brS], kP = [f.x - 0.66, f.x + 0.66, 0, f.boden + 2.02, f.z - 0.6, f.z + 0.5]; // kS, kP: die Kästen im Raum, in denen der Stuhl bzw. der Mensch am Platz gezeichnet wird (nur fürs Nachziehen fester Dinge davor, siehe vornMalen)
      if (kDa > 0.02 || h > 0.02) list.push({ z: f.z + 0.6, licht: true, fn: () => bodenlicht(f.x, f.z, 1.0 + 0.2 * h, BR, (0.1 + 0.16 * h) * Math.max(kDa, h * 0.6)) });
      if (f.halt.sitz) stuhlDinge(list, f, 0.36 * FIG.weich(zs.q / 0.5) * (1 - FIG.weich((zs.s - 0.9) / 1.2)));
      for (let i = n0; i < list.length; i++) if (!list[i].licht) list[i].k = kS;
      if (f.tasche && tau < f.tA * BILD.AUF_ANTEIL * TASCHE_AB) { const hd = f.blick, bx = f.x + 0.4 * Math.cos(hd) - 0.12 * Math.sin(hd), bz = f.z - 0.4 * Math.sin(hd) - 0.12 * Math.cos(hd); list.push({ z: bz, k: [bx - 0.35, bx + 0.35, f.boden, f.boden + 0.6, bz - 0.3, bz + 0.3], fn: () => { const dz = bz - cam.z; if (dz < 0.7 || f.z - cam.z < 0.7 || TROCKEN.an) return; const q = P(bx, f.boden, bz); taschenSetzen(f, q[0], q[1], S.f / dz); } }); } // die Tasche steht neben dem Platz, bis ihr Mensch sie nimmt
      if (leer > 0.02) list.push({ z: f.z + 0.002, k: kP, fn: () => umrissMalen(f, leer * (0.7 + 0.3 * h), BR) });
      if (!zs.fort) { if (zs.q <= 0) amPlatz.push(f); list.push({ z: zs.z, k: [zs.x - 0.66, zs.x + 0.66, 0, f.boden + 2.02, zs.z - 0.6, zs.z + 0.5], fn: () => { maleMensch(f, zs, t, LI, BR, h); return RUHT ? menschImBild(f, zs) : undefined; } }); auf = Math.max(auf, tuerBedarf(f, zs.s)); }
      list.push({ z: f.z - 0.001, licht: true, fn: () => merke(l, f.x, f.z, f.hoch, 0.42, f.n > 0, f.boden, f.schild) });
    }
  }
  st.tuer.auf = auf;
  ruhePflegen(st, amPlatz, !!AKT.F && AKT.F.key === key && AKT.k > 0.9);
}
/* Die Tür in der Rückwand: dahinter der erleuchtete Flur (nur zu sehen, solange das Blatt offen steht), Zarge, Blatt. Das Blatt dreht um die rechte Kante in den Raum.
   farben = { zarge, blatt: [oben, unten], griff } */
function tuerDinge(key, farben) {
  const st = RAUM[key], T = st && st.tuer; if (!T) return;
  const C = { zarge: '#0b090a', blatt: ['#3b302c', '#2a2220'], griff: `rgba(${WARM},.85)`, ...farben };
  const offen = () => T.auf > 0.01; // (auf der ruhenden Fläche liegt die Tür geschlossen; steht sie offen, wird sie je Bild gezeichnet)
  fest(T.z + 3, [T.x0 - 0.1, T.x1 + 0.1, 0, TUER_H + 0.1, T.z - 0.02, T.z], () => {
    const o = rectZ(T.x0 - 0.08, T.x1 + 0.08, 0, TUER_H + 0.08, T.z - 0.006), i = rectZ(T.x0, T.x1, 0, TUER_H, T.z - 0.005); if (!o || !i) return;
    ctx.fillStyle = C.zarge; ctx.fillRect(o[0], o[1], o[2], o[3]);
    if (FEIN) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(o[0], o[1], Math.max(1, o[2] * 0.012), o[3]); ctx.fillRect(o[0], o[1], o[2], Math.max(1, o[3] * 0.006)); } // Lichtkante an der Zarge
    if (!BACKT && T.auf > 0.01) { // der Flur: warmes Licht von oben, hinten eine Wand, unten der Boden
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
    ctx.lineWidth = lwAt(T.z, 0.012); if (poly([in_(0.14, 0.2), in_(0.86, 0.2), in_(0.86, TUER_H - 0.2), in_(0.14, TUER_H - 0.2)], null)) { ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(); } // Füllung
    seg(in_(0.9, 0.98), in_(0.9, 1.12), C.griff, lwAt(T.z, 0.03));
    if (FEIN) { // ausgearbeitet: Drücker mit Schild, zwei Bänder, Trittblech, Maserung im Blatt
      linien([[in_(0.9, 1.05), in_(0.76, 1.05)]], C.griff, lwAt(T.z, 0.022)); flaechen([[in_(0.87, 0.9), in_(0.93, 0.9), in_(0.93, 1.2), in_(0.87, 1.2)]], 'rgba(0,0,0,.3)');
      linien([[in_(0.9, 0.98), in_(0.9, 1.12)], [in_(0.01, 0.3), in_(0.01, 0.46)], [in_(0.01, 1.62), in_(0.01, 1.78)]], C.griff, lwAt(T.z, 0.02));
      flaechen([[in_(0.02, 0.02), in_(0.98, 0.02), in_(0.98, 0.16), in_(0.02, 0.16)]], 'rgba(0,0,0,.2)');
      const m = []; for (let j = 0; j < 7; j++) { const u = 0.2 + j * 0.095 + 0.03 * hash(j, 31), y0 = 0.3 + 0.8 * hash(j, 32); m.push([in_(u, y0), in_(u, Math.min(TUER_H - 0.3, y0 + 0.4 + 0.7 * hash(j, 33)))]); } linien(m, 'rgba(0,0,0,.12)', 1);
    }
  }, offen);
}
/* Eine Schicht: etwas, das steht, einmal auf eine eigene kleine Fläche gezeichnet und danach nur eingesetzt. r = [x, y, w, h] der Ausschnitt im Bild,
   schluessel = alles, wovon das Bild abhängt (ändert er sich, wird neu gezeichnet); male() zeichnet wie sonst auch (ctx zeigt so lange auf die Fläche). */
const SCHICHTEN = new Map();
function schicht(name, schluessel, r, male) {
  const x = Math.max(0, Math.floor(r[0])), y = Math.max(0, Math.floor(r[1])), w = Math.min(S.w, Math.ceil(r[0] + r[2])) - x, h = Math.min(S.h, Math.ceil(r[1] + r[3])) - y; if (w < 1 || h < 1) return;
  let s = SCHICHTEN.get(name); if (!KAM_STEHT && !s) { male(); return; } if (!s) { const c = document.createElement('canvas'); s = { c, g: c.getContext('2d'), key: '' }; SCHICHTEN.set(name, s); }
  if (!KAM_STEHT) { male(); return; } // die Kamera fährt: direkt zeichnen (eine Fläche, die jedes Bild neu entsteht, kostet nur)
  if (s.key !== schluessel || s.x !== x || s.y !== y || s.c.width !== w || s.c.height !== h) {
    if (s.c.width !== w || s.c.height !== h) { s.c.width = w; s.c.height = h; } else s.g.clearRect(0, 0, w, h);
    const c0 = ctx; ctx = s.g; ctx.setTransform(1, 0, 0, 1, -x, -y);
    try { male(); } finally { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx = c0; }
    s.key = schluessel; s.x = x; s.y = y;
  }
  ctx.drawImage(s.c, x, y);
}
/* Was in einem Raum vor der Rückwand steht, nach Tiefe sortiert: Möbel und Geräte (ding), die Menschen und der Kern des Kunden. Das Fernste zuerst, also verdeckt das Nähere das Fernere. */
let DINGE = [];
/* Vier Zustände der Raumzeichnung (siehe LIESMICH › Raum ausarbeiten):
   FEIN    = es wird ausgearbeitet gezeichnet (Maserung, Fugen, Glanz, Kleinteile). Nur auf die ruhende Fläche und beim Nachziehen darüber; fährt die Kamera, bleibt es bei der einfachen Fassung (sie kostet je Bild).
   BACKT   = die ruhende Fläche entsteht: Alles steht im Grundzustand (alle Leistungen da, Tür zu, Licht an).
   NACHZUG = ein festes Ding wird über seine eigene Zeichnung auf der ruhenden Fläche nachgezogen, weil dahinter jemand steht oder geht: Schatten und Lichter fallen dann weg (sie lägen sonst doppelt).
   RUHT    = dieses Bild setzt die ruhende Fläche ein und zeichnet davor nur, was lebt. */
let FEIN = false, BACKT = false, NACHZUG = false, RUHT = false;
const FEST_MS = 2.5, FEST_JE = 6;                          // eine Scheibe der ruhenden Fläche zeichnet höchstens so lange (Skriptzeit; die Grafikkarte rechnet danach) und höchstens so viele feste Dinge
const ding = (z, fn, k) => DINGE.push({ z, fn, k });       // etwas, das sich ändert. k = [x0, x1, y0, y1, z0, z1]: der Kasten im Raum, in dem es zeichnet (ohne Angabe: das ganze Bild). Gibt fn false zurück, hat es nichts gezeichnet.
const lichtDing = (z, fn) => DINGE.push({ z, fn, licht: true }); // Licht oder Schatten auf Boden und Wand, das sich ändert (deckt nichts zu, zieht also nichts nach)
/* Ein festes Ding: Es steht, hängt an keiner Leistung und an keiner Zeit. Auf der ruhenden Fläche liegt es fertig (ausgearbeitet), in Ruhe kostet es nichts. Nachgezogen wird es nur in dem Ausschnitt,
   in dem etwas Lebendiges dahinter liegt (ein Mensch, ein Stuhl, ein Ding, das sich ändert). lebt() = true: in diesem Bild ist es nicht im Grundzustand (die Tür steht offen) und wird gezeichnet wie ein Ding. */
const fest = (z, k, fn, lebt) => DINGE.push({ z, fn, k, fest: true, lebt });
function imBild(k) { // der Kasten im Raum als Rechteck im Bild
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) { const q = P(k[i & 1], k[2 + ((i >> 1) & 1)], Math.max(cam.z + NEAR, k[4 + (i >> 2)])); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
}
function vornMalen(key, t, ruht = false) {
  const list = DINGE.slice(); menschenDinge(key, t, list);
  if (KERN && KERN.im === key) list.push({ z: KERN.z, k: [KERN.x - 0.45, KERN.x + 0.45, KERN.y - oy - 0.45, KERN.y - oy + 0.45, KERN.z - 0.3, KERN.z + 0.3], fn: () => { const b = oy, kl = TON.kl; TON.kl = null; drawCore(KERN); KERN.fertig = true; oy = b; TON.kl = kl; } }); // der Kern steht im Raum und wird nach seiner Tiefe einsortiert
  list.sort((a, b) => b.z - a.z);
  tonAn('ding');
  if (!ruht) { for (const it of list) it.fn(t); tonAus(); return; }
  // In Ruhe liegen die festen Dinge schon auf der ruhenden Fläche. Gezeichnet wird, was lebt; ein festes Ding davor wird nur in dem Ausschnitt nachgezogen, den das Lebendige getroffen hat (voll).
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
        voll.push(c); if (MESS.z) (MESS.z.akt.nach || (MESS.z.akt.nach = [])).push(it.z); // nur zum Messen: welche festen Dinge (Tiefe) dieses Bild nachgezogen hat
      } else {
        if (it.fest) FEIN = true;
        const r = it.fn(t); FEIN = false;
        if (r === false || it.licht) continue;
        if (Array.isArray(r)) { if (Array.isArray(r[0])) voll.push(...r); else voll.push(r); } else voll.push(it.k ? imBild(it.k) : [0, 0, S.w, S.h]); // (ein Ding kann das Rechteck im Bild zurückgeben, in dem es gezeichnet hat, oder mehrere)
      }
    }
  } finally { RUHT = FEIN = NACHZUG = false; tonAus(); }
}
let KERN = null;

/* ═══════════════ BAUSTEINE FÜR AUSGEARBEITETE RÄUME (Material, Licht, Schatten) ═══════════════
   Jeder Baustein zeichnet eine einfache Fassung (sie gilt, solange die Kamera fährt, und kostet je Bild) und, wenn FEIN gilt, die Ausarbeitung dazu (nur auf die ruhende Fläche).
   Viele kleine Teile sind EIN Pfad (linien, flaechen): ein Zeichenbefehl statt hunderter. Schatten und Lichter fallen beim Nachziehen weg (NACHZUG). */
const mischRgb = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
let WURF = { dx: 0, dz: 0.14, a: 0.1 };                    // Schattenwurf je Meter Höhe eines Möbels: am Tag vom Fenster der Rückwand zu uns und nach links (wie die Lichtfelder am Boden), abends kurz unter den Leuchten
function wurfSetzen() { const W = tagWerte(), e = W.sonne, tag = Math.min(1, W.innen); if (e > 0.02 && tag > 0.1) { const lang = Math.min(0.85, 0.5 / Math.max(0.12, e)); WURF = { dx: 0.42 * lang, dz: lang, a: (0.05 + 0.11 * tag) * (1 - 0.5 * Math.max(0, lang - 0.6) / 0.25) }; } else WURF = { dx: 0, dz: 0.14, a: 0.1 }; }
function linien(segs, style, lw = 1) { // Strecken im Raum [[a, b], …] als ein Strich
  const zc = cam.z + NEAR; ctx.beginPath();
  for (const [a, b] of segs) {
    let A = a, B = b; const da = a[2] - zc, db = b[2] - zc; if (da < 0 && db < 0) continue;
    if (da < 0) { const t = da / (da - db); A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, zc]; }
    if (db < 0) { const t = db / (db - da); B = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, zc]; }
    const p = P(A[0], A[1], A[2]), q = P(B[0], B[1], B[2]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
}
function flaechen(polys, fill) { // Flächen im Raum in einer Farbe als ein Pfad (sie sollen sich nicht überlappen)
  ctx.beginPath();
  for (const pts of polys) { const c = clipNear(pts); if (c.length < 3) continue; for (let i = 0; i < c.length; i++) { const q = P(c[i][0], c[i][1], c[i][2]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.closePath(); }
  ctx.fillStyle = fill; ctx.fill();
}
function strang(pts, style, m = 0.022, y = 0.004) { // ein Kabel am Boden: weiche Kurve durch die Punkte [x, z], ein Strich
  const n = pts.length; let zs = 0, nn = 0, an = false; ctx.beginPath();
  for (let i = 0; i < n - 1; i++) { const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(n - 1, i + 2)];
    for (let j = i ? 1 : 0; j <= 8; j++) { const u = j / 8, f = (q0, q1, q2, q3) => 0.5 * (2 * q1 + (q2 - q0) * u + (2 * q0 - 5 * q1 + 4 * q2 - q3) * u * u + (3 * q1 - q0 - 3 * q2 + q3) * u * u * u), x = f(a[0], b[0], c[0], d[0]), z = f(a[1], b[1], c[1], d[1]);
      zs += z; nn++; if (z - cam.z < NEAR) { an = false; continue; } const q = P(x, y, z); if (an) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); an = true; } } }
  ctx.strokeStyle = style; ctx.lineWidth = lwAt(zs / Math.max(1, nn), m); ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter';
}
/* Schatten eines Möbels am Boden: der Wurf vom Licht weg (h = Höhe des Möbels), darunter der dunkle Kern. Ausgearbeitet mit weichem Rand. */
function wurf(x0, x1, z0, z1, h = 0.8, kern = 0.3) {
  if (NACHZUG) return; const y = 0.007, dx = WURF.dx * h, dz = WURF.dz * h;
  if (dz > 0.04) {
    poly([[x1, y, z1], [x1, y, z0], [x1 - dx, y, z0 - dz], [x0 - dx, y, z0 - dz], [x0 - dx, y, z1 - dz], [x0, y, z1]], `rgba(0,0,0,${WURF.a})`);
    if (FEIN) { const m = 0.05 + 0.1 * dz; poly([[x1 + m * 0.5, y, z1], [x1 + m * 0.5, y, z0 - m], [x1 - dx + m, y, z0 - dz - m * 1.6], [x0 - dx - m * 1.6, y, z0 - dz - m * 1.6], [x0 - dx - m * 1.6, y, z1 - dz], [x0 - m, y, z1]], `rgba(0,0,0,${WURF.a * 0.45})`); }
  }
  if (kern > 0) poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], `rgba(0,0,0,${kern})`);
}
function fleck(x, z, rx, rz, a = 0.26, h = 0) { // runder Schatten (Stativ, Hocker, Topf); h = Höhe: dann fällt er vom Licht weg
  if (NACHZUG) return; const y = 0.007, n = 14, e = (cx, cz, sx, sz) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * sx, y, cz + Math.sin((i / n) * 6.2832) * sz]);
  const dx = WURF.dx * h * 0.5, dz = WURF.dz * h * 0.5;
  if (dz > 0.03) poly(e(x - dx, z - dz, rx + dx * 0.8, rz + dz * 0.8), `rgba(0,0,0,${WURF.a})`);
  poly(e(x, z, rx, rz), `rgba(0,0,0,${a})`);
}
/* Dielenboden: lange Fugen und Stöße je als ein Strich; ausgearbeitet dazu einzelne Dielen etwas heller oder dunkler und die Maserung */
function dielen(x0, x1, z0, z1, br = 0.6, saat = 7, mitLang = true, kraft = 1) { // kraft: wie deutlich Tonfelder, Maserung und Fugen sind // mitLang = false: Die langen Fugen zeichnet schon die Schale des Raums
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
/* Die Fenster spiegeln sich im Boden: je Feld [xa, xb] ein Streifen Glanz, der auf den Betrachter zuläuft und ausläuft (yo = Oberkante der Fenster) */
function glanzBoden(felder, z1, yo, rgb, a) {
  if (NACHZUG) return; const t = Math.min(0.8, yo / (yo + cam.y - oy)), fx = cam.x, fz = Math.max(cam.z, 0.2), y = 0.003, ze = z1 + (fz - z1) * t;
  ctx.globalCompositeOperation = 'lighter';
  for (const [xa, xb] of felder) poly([[xa, y, z1], [xb, y, z1], [xb + (fx - xb) * t, y, ze], [xa + (fx - xa) * t, y, ze]], lg([0, 0, z1], [0, 0, ze], [[0, `rgba(${rgb},${a})`], [0.45, `rgba(${rgb},${a * 0.42})`], [1, `rgba(${rgb},0)`]]));
  ctx.globalCompositeOperation = 'source-over';
}
/* Bildschirm in einer Tiefe: Gehäuse; zurück kommt [x, y, w, h] der Bildfläche im Bild. roh(): Farben, die am Tag bleiben, wie sie sind (Bildflächen, Leuchtflächen). ui(r): Rechtecke in Anteilen der Bildfläche. */
function schirm(x0, x1, y0, y1, z, rand = 0.025) { const o = fillZ(x0, x1, y0, y1, z, '#07070c'); if (!o) return null; const b = Math.max(1, (rand * S.f) / (z - cam.z)); return [o[0] + b, o[1] + b, o[2] - 2 * b, o[3] - 2 * b]; }
const roh = (fn) => { const kl = TON.kl; TON.kl = null; try { fn(); } finally { TON.kl = kl; } };
const ui = (r) => (u, v, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(r[0] + u * r[2], r[1] + v * r[3], w * r[2], h * r[3]); };
function spiegelung(r) { if (!FEIN || NACHZUG) return; roh(() => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(r[0] + r[2] * 0.52, r[1]); ctx.lineTo(r[0] + r[2] * 0.78, r[1]); ctx.lineTo(r[0] + r[2] * 0.44, r[1] + r[3]); ctx.lineTo(r[0] + r[2] * 0.18, r[1] + r[3]); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }); }
/* Ein Stück Flachzeichnung in einer Tiefe: Maße in Metern um den Punkt (x, y, z), dy nach oben. R = Rechteck, E = Ellipse, V = Vieleck, S = Strich */
function flachAn(x, y, z) {
  const dz = z - cam.z; if (dz < 0.6) return null; const q = P(x, y, z), k = S.f / dz, X = (dx) => q[0] + dx * k, Y = (dy) => q[1] - dy * k;
  return { k, X, Y,
    R: (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(X(dx), Y(dy + h), w * k, h * k); },
    E: (dx, dy, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(X(dx), Y(dy), Math.max(0.5, rx * k), Math.max(0.5, ry * k), 0, 0, 7); ctx.fill(); },
    V: (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); ctx.fill(); },
    S: (pts, col, m) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, m * k); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); } };
}
/* Etwas wird dunkel, wenn seine Leistung den Raum verlässt: a() = wie sehr sie da ist (1 … 0), k = der Kasten im Raum, fn(v) zeichnet die Abdunklung (v = 0 … 1). Ist sie da, wird nichts gezeichnet. */
const ausDing = (z, a, k, fn) => ding(z, () => { const v = 1 - a(); if (v < 0.02) return false; roh(() => fn(v)); }, k);
/* Tisch mit vier Beinen und Schattenwurf; ausgearbeitet mit Lichtkante an der Platte und Glanzlinie an den Beinen. col = Platte, vorn, seite */
function tischN(x0, x1, z0, z1, h, col, vorn = M.front, seite = M.side) {
  wurf(x0 + 0.04, x1 - 0.04, z0 + 0.04, z1 - 0.04, h, 0.1);
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.14, z0 + 0.08], [x0 + 0.08, z1 - 0.14], [x1 - 0.14, z1 - 0.14]]) box(x, x + 0.06, 0, h, z, z + 0.06, '#111', '#101016', '#16151e');
  box(x0, x1, h - 0.05, h, z0, z1, col || M.top, vorn, seite);
  if (FEIN) { fillZ(x0, x1, h - 0.012, h, z0 - 0.001, 'rgba(255,255,255,.3)'); linien([[[x0 + 0.095, 0.02, z0 + 0.079], [x0 + 0.095, h - 0.06, z0 + 0.079]], [[x1 - 0.125, 0.02, z0 + 0.079], [x1 - 0.125, h - 0.06, z0 + 0.079]]], 'rgba(255,255,255,.14)', 1); }
}
/* Stativ: drei Beine von der Spitze (x, h, z) zu den Füßen [[dx, dz], …] als ein Strich; ausgearbeitet mit Spreizen und Füßen */
function stativ(x, z, h, fuesse, m = 0.04, col = '#07070c') {
  const top = [x, h, z], F = fuesse.map(([dx, dz]) => [x + dx, 0, z + dz]);
  linien(F.map((f) => [top, f]), col, lwAt(z, m));
  if (!FEIN) return;
  const M = F.map((f) => [lerp(x, f[0], 0.62), h * 0.38, lerp(z, f[2], 0.62)]);
  linien([[M[0], M[1]], [M[1], M[2]], [M[2], M[0]], ...F.map((f) => [f, [f[0], 0.03, f[2]]])], col, lwAt(z, m * 0.55));
  linien(F.map((f) => [top, [lerp(x, f[0], 0.5), h * 0.5, lerp(z, f[2], 0.5)]]), col, lwAt(z, m * 1.5));
}
/* Filmkamera auf Stativ, von der Seite: Sie zeigt nach links auf das Set. Steht fest (wer sie führt, lebt). h = Oberkante des Stativkopfs */
function kameraSet(x, z, h) {
  stativ(x, z, h - 0.1, [[-0.42, -0.25], [0.42, -0.2], [0.05, 0.44]], 0.045);
  const B = flachAn(x, h, z); if (!B) return; const { R, E, V, S: L } = B, C = { geh: '#1b1a25', tief: '#0b0b10', hell: '#3a3849', mitte: '#262532' };
  R(-0.03, -0.12, 0.06, 0.12, '#07070c'); R(-0.08, -0.01, 0.16, 0.07, C.tief); R(-0.1, 0.06, 0.34, 0.03, C.mitte);             // Säule, Kopf, Platte
  L([[0.06, 0.02], [0.4, -0.16], [0.52, -0.2]], '#07070c', 0.028);                                                             // Schwenkarm
  R(-0.12, 0.09, 0.44, 0.25, C.geh); R(-0.36, 0.13, 0.24, 0.17, C.tief);                                                      // Gehäuse, Objektiv
  V([[-0.36, 0.115], [-0.36, 0.315], [-0.47, 0.35], [-0.47, 0.08]], '#2f2d3c');                                                // Kompendium
  R(0.08, 0.43, 0.22, 0.15, C.mitte); roh(() => { R(0.095, 0.445, 0.19, 0.12, '#c4683f'); });                                  // Kontrollmonitor
  if (!FEIN) return;
  roh(() => { R(0.185, 0.445, 0.035, 0.085, '#efe6d6'); E(0.202, 0.545, 0.016, 0.016, '#d9a784'); E(0.14, 0.48, 0.02, 0.02, '#8B5CF6'); });
  R(0.17, 0.34, 0.03, 0.09, C.tief);                                                                                           // Arm des Monitors
  R(-0.12, 0.325, 0.44, 0.015, C.hell); R(0.32, 0.11, 0.09, 0.21, C.mitte); R(0.335, 0.27, 0.06, 0.012, '#5a586e');            // Lichtkante oben, Akku
  R(-0.02, 0.34, 0.025, 0.05, C.tief); R(0.1, 0.34, 0.025, 0.05, C.tief); R(-0.06, 0.385, 0.22, 0.03, C.mitte);               // Tragegriff
  R(-0.32, 0.13, 0.022, 0.17, C.hell); R(-0.24, 0.13, 0.03, 0.17, '#2b2a38'); R(-0.165, 0.13, 0.012, 0.17, AKZ.studios);       // Ringe am Objektiv
  V([[-0.47, 0.35], [-0.36, 0.315], [-0.34, 0.33], [-0.5, 0.385]], C.tief);                                                    // Lichtklappe
  R(-0.36, 0.43, 0.3, 0.03, C.tief); E(-0.36, 0.445, 0.085, 0.036, '#4a4858'); R(-0.1, 0.415, 0.02, 0.03, C.tief);            // Richtmikrofon mit Windschutz
  R(-0.07, 0.13, 0.16, 0.012, '#2f2d3c'); R(-0.07, 0.16, 0.16, 0.012, '#2f2d3c'); R(0.15, 0.13, 0.1, 0.09, '#14131b');        // Lüftung, Klappe
  L([[0.52, -0.2], [0.44, -0.17]], '#3a3849', 0.045);                                                                          // Griff am Schwenkarm
}
function pflanze(x, z, gruen = false, gr = 1) { // ein Topf, daraus große Blätter; gruen = im Licht (hinten im Raum), sonst dunkel mit warmer Lichtkante (Vordergrund)
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
/* Strahler an der Deckenschiene: ein kurzer Zylinder, unten die Linse; an = wie hell er brennt */
function strahler(x, z, y1, an) {
  seg([x, y1 - 0.06, z], [x, y1 - 0.2, z], '#050506', lwAt(z, 0.03));
  const b = rectZ(x - 0.075, x + 0.075, y1 - 0.42, y1 - 0.2, z); if (!b) return;
  if (FEIN) { ctx.fillStyle = sgr(b[0], 0, b[0] + b[2], 0, [[0, '#2a2526'], [0.5, '#151213'], [1, '#0a0809']]); ctx.fillRect(b[0], b[1], b[2], b[3]); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(b[0] + b[2] * 0.14, b[1], Math.max(1, b[2] * 0.1), b[3]); }
  else { ctx.fillStyle = '#151213'; ctx.fillRect(b[0], b[1], b[2], b[3]); }
  ctx.fillStyle = mischRgb([70, 60, 56], [255, 240, 214], an); ctx.beginPath(); ctx.ellipse(b[0] + b[2] / 2, b[1] + b[3], b[2] * 0.46, Math.max(1, b[3] * 0.16), 0, 0, 7); ctx.fill();
  if (an > 0.1 && FEIN) glow(x, y1 - 0.44, z, 0.3, [[0, `rgba(${WARM},${0.4 * an})`], [1, `rgba(${WARM},0)`]]);
}
/* Die Website auf dem großen Bildschirm, je Variante eine andere (einfach, mittel, aufwendig); beim Umschalten blendet sie über. Auf der ruhenden Fläche liegt die erste Fassung;
   gezeichnet wird je Bild nur, was davon abweicht (andere Variante, Überblenden, niemand da). Darüber ein Auswahlrahmen: Sie ist im Aufbau. */
const WEB_RAHMEN = [[[0.2, 0.27, 0.6, 0.22], [0.37, 0.66, 0.26, 0.17]], [[0.04, 0.26, 0.46, 0.2], [0.54, 0.22, 0.42, 0.48], [0.04, 0.75, 0.3, 0.2]], [[0.06, 0.3, 0.52, 0.3], [0.62, 0.16, 0.32, 0.6], [0.06, 0.72, 0.5, 0.12]]];
const webFlaeche = (m) => [m[0] + m[2] * 0.015, m[1] + m[3] * 0.025, m[2] * 0.97, m[3] * 0.95];
function webBild(m, l, a, t) { // gibt false zurück, wenn nichts zu zeichnen war
  const v = l ? l.v : 0, [x, y, w, h] = webFlaeche(m), blendet = !!(l && l.vAlt != null && l.vZeit && t && t - l.vZeit < 380);
  if (v === 0 && !blendet && a > 0.99) return false;
  const neu = TEX['web' + v] || TEX.web, alt = blendet ? TEX['web' + l.vAlt] : null;
  ctx.fillStyle = '#05050a'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 0.3 + 0.7 * a;
  if (alt) { ctx.drawImage(alt, x, y, w, h); ctx.globalAlpha *= smooth((t - l.vZeit) / 380); }
  if (neu) ctx.drawImage(neu, x, y, w, h);
  ctx.globalAlpha = 1;
}
function webRahmen(m, l, g, t) { // der Auswahlrahmen mit Zeiger (lebt); zurück kommt das Rechteck im Bild, in dem gezeichnet wurde
  const F0 = WEB_RAHMEN[l ? l.v : 0] || [], [x, y, w, h] = webFlaeche(m); if (!F0.length) return null;
  const [u0, v0, uw, vh] = F0[Math.floor((t || 0) / GESTE_TAKT) % F0.length], rx = x + u0 * w, ry = y + v0 * h, rw = uw * w, rh = vh * h, s = Math.max(2, w * 0.012);
  ctx.strokeStyle = AKZ.studios; ctx.lineWidth = Math.max(1, w * 0.004); ctx.setLineDash([w * 0.014, w * 0.01]); ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.beginPath(); for (const [cx2, cy2] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) ctx.rect(cx2 - s / 2, cy2 - s / 2, s, s);
  const px = rx + rw + w * (0.03 - 0.05 * g), py = ry + rh + h * (0.05 - 0.07 * g); // der Zeiger greift nach der Ecke
  ctx.moveTo(px, py); ctx.lineTo(px + w * 0.028, py + w * 0.012); ctx.lineTo(px + w * 0.012, py + w * 0.028); ctx.closePath(); ctx.fill();
  return [rx - s, ry - s, rx + rw + w * 0.07, ry + rh + h * 0.07 + w * 0.03];
}
/* MAKE Studios: ein Studio-Loft am späten Vormittag. Die Rückwand ist aus Glas (dahinter die Stadt), rechts daneben der Kern des Hauses mit der Tür zum Flur. Drei Plätze in verschiedener Tiefe:
   links hinten das Videoset (Hintergrund von der Rolle, Lichtwanne, Tonangel, Kamera, Schnittwagen mit Monitor und Rechner, Koffer mit Klappe), in der Mitte hinten der Arbeitstisch mit dem großen Bildschirm
   (die Website im Aufbau), rechts vorn das Ringlicht mit dem Handy für Social Media.
   So ist ein ausgearbeiteter Raum gebaut (siehe LIESMICH › Raum ausarbeiten): Boden, Decke und alles an der Wand zeichnet die Funktion sofort; jedes Möbel und Gerät ist ein festes Ding (fest: liegt ausgearbeitet
   auf der ruhenden Fläche); was an einer Leistung oder an der Zeit hängt, ist ein kleines Ding davor (aus: wird dunkel, wenn die Leistung geht · Aufnahmelicht, Abspielmarke, Auswahlrahmen). */
const STUDIO = { wand: 2.45, web: [0.75, 8.5], ring: [1.02, 5.65, 1.5], kamera: [-0.78, 6.55, 1.38], leuchte: [-2.85, 7.9], wagen: [-0.04, 7.22], koffer: [-1.25, 5.9], pflanze: [2.62, 8.4], regal: [[2.5, 1], [4.3, 2]], beistell: [2.12, 5.5], rolle: [-3.15, -1.35, 8.45], angel: [-1.26, 8.38],
  felder: [[-5.95, -4.05], [-3.95, -2.05], [-1.95, -0.05], [0.05, 1.95], [2.05, 2.39]] };
function studio(F, t, y1, z1) {
  const BR = MARKE.studios.rgb, dark = '#07070c', st = RAUM.studios, lW = st && st.nach.website, Q = STUDIO, TW = tagWerte(), tag = Math.min(1, TW.innen);
  const aW = () => da('studios', 'website'), aV = () => da('studios', 'video'), aS = () => da('studios', 'social');
  const aus = (z, a, k, fn) => ding(z, () => { const v = 1 - a(); if (v < 0.02) return false; roh(() => fn(v)); }, k); // etwas wird dunkel, wenn seine Leistung den Raum verlässt (roh: Die Rechnung des Tageslichts machte dunkle Schleier sonst dünn)
  const [bx0, bx1, bz] = Q.rolle, [wx, wz] = Q.web, [sx, sz] = Q.leuchte, [cx, cz] = Q.wagen, [kx, kz] = Q.koffer, [rx, rz, ry] = Q.ring, [ax, az] = Q.angel;
  // ── Decke: Balken, zwei Schienen für die Strahler ──
  { const s = []; for (let z = 1.5; z < z1; z += 1.5) s.push([[-6, y1 - 0.004, z], [6, y1 - 0.004, z], [6, y1 - 0.004, z + 0.16], [-6, y1 - 0.004, z + 0.16]]); flaechen(s, 'rgba(0,0,0,.34)'); }
  for (let z = 1.5; z < z1; z += 1.5) fillZ(-6, 6, y1 - 0.14, y1, z, '#0c0909');
  flaechen([-1.5, 1.7].map((x) => [[x - 0.035, y1 - 0.06, 0.6], [x + 0.035, y1 - 0.06, 0.6], [x + 0.035, y1 - 0.06, z1 - 0.4], [x - 0.035, y1 - 0.06, z1 - 0.4]]), '#050506');
  if (FEIN) { const k = []; for (let z = 1.5; z < z1; z += 1.5) k.push([[-6, y1 - 0.14, z], [6, y1 - 0.14, z]]); linien(k, 'rgba(255,224,200,.12)', 1); } // Lichtkante unter den Balken
  // ── Boden: Dielen, die Fenster spiegeln sich darin (am Tag der Himmel, abends das warme Licht des Raums) ──
  if (tag > 0.05) roh(() => poly([[-6, 0.001, 0.4], [6, 0.001, 0.4], [6, 0.001, z1], [-6, 0.001, z1]], `rgba(146,92,50,${0.3 * tag})`)); // warmer Holzton (Auftrag Y: Dielen, keine blassen Fliesen); in beiden Fassungen, damit nichts springt
  dielen(-6, 6, 0.4, z1, 0.3, 7, true, 1.7); // schmale Dielen (0,3 m): lange Bahnen mit versetzten Stößen lesen sich als Holz, breite Felder als Fliesen
  if (tag > 0.05) roh(() => (FEIN ? glanzBoden(Q.felder.map(([a, b]) => [a + 0.22, b - 0.22]), z1, 2.98, '240,246,255', 0.22 * tag) : glanzBoden([[-6, Q.wand]], z1, 2.98, '240,246,255', 0.13 * tag)));
  glanzBoden([[-6, Q.wand]], z1, 2.2, '255,170,130', 0.16);
  // das Licht am Boden vor den Plätzen (Grundzustand: an) und die Kabel
  ctx.globalCompositeOperation = 'lighter';
  poly([[wx - 1.0, 0.003, 8.3], [wx + 1.0, 0.003, 8.3], [wx + 1.25, 0.003, 5.6], [wx - 1.25, 0.003, 5.6]], lg([0, 0, 8.3], [0, 0, 5.6], [[0, 'rgba(255,224,200,.13)'], [1, 'rgba(255,224,200,0)']]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN) { bodenlicht(-1.9, 7.2, 1.7, WARM, 0.16); bodenlicht(wx, 7.35, 1.5, WARM, 0.12); bodenlicht(1.35, 5.45, 1.5, WARM, 0.1); bodenlicht(0.2, 3.6, 2.2, WARM, 0.07); }
  strang([[sx - 0.22, sz + 0.08], [-3.3, 7.0], [-2.5, 6.45], [-1.4, 6.5], [-0.6, 7.0], [cx, cz]], '#0a0808'); strang([[Q.kamera[0], Q.kamera[1]], [-0.5, 6.95], [-0.15, 7.05], [cx, cz]], '#0a0808'); strang([[rx, rz], [1.6, 6.3], [2.2, 7.6], [2.44, 8.9]], '#0a0808');
  // ── Teppich unter dem Platz für Social Media ──
  { const tep = (r, dx = 0, dz = 0) => Array.from({ length: 30 }, (_, i) => [1.35 + dx + Math.cos((i / 30) * 6.2832) * 1.15 * r, 0.004, 5.45 + dz + Math.sin((i / 30) * 6.2832) * 0.85 * r]);
    if (FEIN) poly(tep(1.02, -0.035, -0.045), 'rgba(0,0,0,.2)');
    poly(tep(1), '#6a3220');
    if (FEIN) { poly(tep(0.86), '#743a26'); if (poly(tep(0.86), null)) { ctx.strokeStyle = 'rgba(255,214,180,.22)'; ctx.lineWidth = lwAt(5.45, 0.018); ctx.stroke(); } if (poly(tep(0.5), null)) { ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = lwAt(5.45, 0.012); ctx.stroke(); } bodenlicht(1.35, 5.45, 1.4, BR, 0.14); } }
  // ── Klebeband am Boden: die Ecken des Hintergrundpapiers, das Kreuz für die Person vor der Kamera, Marken an den Füßen des Stativs ──
  if (FEIN) { const T = (x, z, w, d, dr = 0) => { const c = Math.cos(dr), s = Math.sin(dr), p = (a, b) => [x + a * c - b * s, 0.0075, z + a * s + b * c]; return [p(-w, -d), p(w, -d), p(w, d), p(-w, d)]; };
    flaechen([T(bx0 + 0.02, 6.8, 0.15, 0.035, 0.6), T(bx1 - 0.02, 6.8, 0.15, 0.035, -0.6), T(-1.85, 7.5, 0.17, 0.028), T(-1.85, 7.5, 0.028, 0.17), ...[[-0.42, -0.25], [0.42, -0.2], [0.05, 0.44]].map(([dx, dz]) => T(Q.kamera[0] + dx, Q.kamera[1] + dz - 0.09, 0.07, 0.022))], '#e4ddd0'); }
  // ── Kernwand rechts: offene Regale links und rechts der Tür (Objektive, Rollen, Requisiten, Akkus in der Ladeschale). Sie stehen an der Rückwand, niemand geht dahinter vorbei: sofort gezeichnet ──
  for (const [x0, felder] of Q.regal) { const B = 0.6, x1 = x0 + felder * B, zf = z1 - 0.3, H = 2.9, bo = [0.08, 0.62, 1.16, 1.7, 2.24, 2.9];
    fillZ(x0, x1, 0, H, z1 - 0.004, '#181213');                                                                                    // die Rückwand des Regals im Schatten
    { const v = []; for (let i = 0; i <= felder; i++) { const x = x0 + i * B; v.push([[x - 0.02, 0, zf], [x + 0.02, 0, zf], [x + 0.02, H, zf], [x - 0.02, H, zf]]); const xs = cam.x < x ? x - 0.02 : x + 0.02; v.push([[xs, 0, zf], [xs, 0, z1], [xs, H, z1], [xs, H, zf]]); } // jede Wange von vorn und von der Seite, die man sieht
      for (const y of bo) for (let i = 0; i < felder; i++) v.push([[x0 + i * B + 0.02, y - 0.035, zf], [x0 + (i + 1) * B - 0.02, y - 0.035, zf], [x0 + (i + 1) * B - 0.02, y, zf], [x0 + i * B + 0.02, y, zf]]);
      flaechen(v, '#4a3830'); }                                                                                                    // Wangen und Böden von vorn: ein Pfad
    if (!FEIN) continue;
    { const o = [], sch = []; for (const y of bo.slice(0, 3)) o.push([[x0, y, zf], [x1, y, zf], [x1, y, z1], [x0, y, z1]]); flaechen(o, '#8a6c5c'); flaechen(bo.slice(3).map((y) => [[x0, y - 0.035, zf], [x1, y - 0.035, zf], [x1, y - 0.035, z1], [x0, y - 0.035, z1]]), '#2c2220'); // über Augenhöhe sieht man die Böden von unten
      { const w = []; for (let i = 1; i <= felder; i++) { const x = x0 + i * B - 0.02; if (cam.x < x) w.push([[x, 0, zf], [x, 0, z1], [x, H, z1], [x, H, zf]]); } if (w.length) flaechen(w, 'rgba(0,0,0,.3)'); } // die Innenseiten der Wangen liegen im Schatten
                          // die Böden unter Augenhöhe von oben
      for (const y of bo.slice(1)) sch.push([[x0, y - 0.035, z1 - 0.003], [x1, y - 0.035, z1 - 0.003], [x1, y - 0.15, z1 - 0.003], [x0, y - 0.15, z1 - 0.003]]); flaechen(sch, 'rgba(0,0,0,.34)'); // Schatten unter jedem Boden
      linien(bo.map((y) => [[x0, y, zf - 0.001], [x1, y, zf - 0.001]]), 'rgba(255,226,200,.26)', 1); }                              // Lichtkante an den Böden
    for (let i = 0; i < felder; i++) { const A = flachAn(x0 + i * B + 0.04, 0, zf + 0.05); if (!A) continue; const w = i % 2, f = (n) => bo[(n + w * 2) % 5];
      { const b = f(4); [[0.1, 0.085, '#b85c36'], [0.27, 0.085, '#cfc6b8'], [0.185, 0.228, '#4a4658']].forEach(([dx, dy, c]) => { A.E(dx, b + dy, 0.082, 0.082, c); A.E(dx, b + dy, 0.03, 0.03, '#120e10'); A.E(dx - 0.03, b + dy + 0.035, 0.02, 0.012, 'rgba(255,255,255,.2)'); }); // Rollen, von der Stirnseite
        A.R(0.38, b, 0.13, 0.05, '#17151b'); A.R(0.385, b + 0.05, 0.12, 0.05, '#d9d2c4'); A.R(0.38, b + 0.1, 0.13, 0.05, `rgb(${BR})`); }                           // drei Rollen Klebeband, gestapelt
      { const b = f(3); [[0.2, 0.12, 0.21, '#e9e4f2'], [0.335, 0.1, 0.15, `rgb(${BR})`], [0.44, 0.08, 0.12, '#e9e4f2']].forEach(([dx, br, h, ring]) => {                // Objektive, stehend
          A.R(dx, b, br, h, '#17151c'); A.R(dx - 0.006, b + h * 0.18, br + 0.012, h * 0.26, '#2c2a36'); A.R(dx, b + h * 0.7, br, 0.014, ring); A.E(dx + br / 2, b + h, br / 2, 0.016, '#3f4c66'); A.R(dx + 0.014, b + 0.012, 0.012, h - 0.03, 'rgba(255,255,255,.2)'); });
        A.R(0.025, b, 0.115, 0.03, '#2c2a36'); [0, 1, 2].forEach((n) => { A.R(0.03 + n * 0.037, b + 0.03, 0.03, 0.1, '#3a3849'); A.R(0.03 + n * 0.037, b + 0.118, 0.03, 0.012, '#8a88a0'); });      // Akkus in der Ladeschale
        roh(() => [0, 1, 2].forEach((n) => A.E(0.045 + n * 0.037, b + 0.015, 0.006, 0.006, n === 2 ? '#ffb24a' : '#62e08c'))); }                                  // zwei sind voll, einer lädt
      { const b = f(2); A.R(0.03, b, 0.17, 0.17, '#d9a23f'); A.R(0.03, b + 0.15, 0.17, 0.02, 'rgba(255,255,255,.22)'); A.E(0.3, b + 0.1, 0.075, 0.1, '#e9dfcf'); A.R(0.27, b + 0.19, 0.06, 0.05, '#e9dfcf'); // Requisiten: Würfel, Vase
        A.R(0.4, b, 0.12, 0.035, '#3f6a6a'); A.R(0.41, b + 0.035, 0.1, 0.03, '#f3e6c4'); A.R(0.4, b + 0.065, 0.11, 0.035, '#7a4a3a'); }                              // ein Stapel Bücher
      { const b = f(1); A.R(0.02, b, 0.3, 0.3, '#2b2a38'); A.R(0.02, b + 0.19, 0.3, 0.012, '#6a6880'); A.R(0.13, b + 0.3, 0.08, 0.02, '#17151b'); A.R(0.36, b, 0.15, 0.2, '#8a6648'); A.R(0.36, b + 0.13, 0.15, 0.01, 'rgba(0,0,0,.25)'); } // Koffer, Karton
      { const b = f(0); A.R(0.03, b, 0.48, 0.36, '#3a3436'); A.R(0.03, b + 0.3, 0.48, 0.012, 'rgba(255,255,255,.12)'); A.R(0.2, b + 0.14, 0.14, 0.05, '#17141a'); } }                        // unten eine Kiste
  }
  // was dunkel wird, wenn eine Leistung geht: das Licht am Boden vor ihrem Platz
  lichtDing(8.96, () => { const w = 1 - aW(), v = 1 - aV(), s = 1 - aS(), y = 0.008;
    if (w > 0.02) poly([[wx - 1.25, y, 8.6], [wx + 1.25, y, 8.6], [wx + 1.4, y, 6.6], [wx - 1.4, y, 6.6]], `rgba(0,0,0,${0.16 * w})`);
    if (v > 0.02) poly([[bx0 - 0.2, y, 8.4], [0.3, y, 8.4], [0.5, y, 5.6], [bx0 - 0.4, y, 5.6]], `rgba(0,0,0,${0.16 * v})`);
    if (s > 0.02) poly([[0.2, y, 6.3], [2.5, y, 6.3], [2.6, y, 4.6], [0.1, y, 4.6]], `rgba(0,0,0,${0.16 * s})`); });
  // ── Video: der Hintergrund von der Rolle, auf zwei Ständern; das Papier läuft in einer Kehle auf den Boden ──
  const papier = [[[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 2.86, bz], [bx0, 2.86, bz]], [[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 0.18, bz - 0.26], [bx0, 0.18, bz - 0.26]], [[bx0, 0.18, bz - 0.26], [bx1, 0.18, bz - 0.26], [bx1, 0.006, bz - 0.8], [bx0, 0.006, bz - 0.8]], [[bx0, 0.006, bz - 0.8], [bx1, 0.006, bz - 0.8], [bx1 + 0.12, 0.006, 6.75], [bx0 - 0.12, 0.006, 6.75]]];
  fest(8.5, [bx0 - 0.95, bx1 + 0.4, 0, 3.05, 6.7, bz + 0.5], () => {
    const st2 = []; for (const x of [bx0 - 0.14, bx1 + 0.14]) st2.push([[x, 0, bz + 0.1], [x, 3.0, bz + 0.1]], [[x - 0.3, 0, bz + 0.1], [x + 0.3, 0, bz + 0.1]], [[x, 0.5, bz + 0.1], [x - 0.24, 0, bz + 0.1]], [[x, 0.5, bz + 0.1], [x + 0.24, 0, bz + 0.1]]);
    linien(st2, dark, lwAt(bz, 0.045));
    if (FEIN && !NACHZUG) poly([[bx1, 0.007, bz - 0.1], [bx1 + 0.12, 0.007, 6.75], [bx1 - 0.25, 0.007, 6.6], [bx0 - 0.45, 0.007, 6.6], [bx0 - 0.45, 0.007, bz - 0.1]], 'rgba(0,0,0,.13)'); // Schatten unter der Papierkante
    poly(papier[0], lg([0, 0.5, bz], [0, 2.86, bz], [[0, 'rgb(214,118,82)'], [1, 'rgb(150,74,52)']]));
    poly(papier[1], 'rgb(218,124,87)'); poly(papier[2], 'rgb(225,134,96)');
    poly(papier[3], lg([0, 0, bz - 0.8], [0, 0, 6.75], [[0, 'rgb(228,138,100)'], [1, 'rgb(168,92,66)']]));
    fillZ(bx0 - 0.2, bx1 + 0.2, 2.82, 2.98, bz + 0.05, '#3a3238');                                                   // die Rolle auf der Querstange
    linien([bx0 - 0.5, bx0 - 0.72].map((x) => [[x, 0, bz + 0.3], [x + 0.08, 2.3, bz + 0.42]]), '#1a1416', lwAt(bz, 0.1)); // zwei weitere Rollen lehnen an der Wand
    if (!FEIN) return;
    linien([bx0 - 0.5, bx0 - 0.72].map((x) => [[x - 0.012, 0.02, bz + 0.3], [x + 0.068, 2.28, bz + 0.42]]), 'rgba(214,150,120,.4)', lwAt(bz, 0.03));
    fillZ(bx0 - 0.2, bx1 + 0.2, 2.93, 2.96, bz + 0.049, 'rgba(255,255,255,.14)'); fillZ(bx0, bx1, 2.82, 2.86, bz + 0.049, 'rgb(170,90,64)');   // Glanz auf der Rolle, das Papier läuft von ihr ab
    for (const x of [bx0 - 0.2, bx1 + 0.13]) fillZ(x, x + 0.07, 2.79, 3.01, bz + 0.048, '#15131a');                 // Halter der Rolle
    linien([[[bx1 + 0.16, 2.9, bz + 0.05], [bx1 + 0.16, 1.5, bz + 0.05]], [[bx1 + 0.19, 2.9, bz + 0.05], [bx1 + 0.19, 1.62, bz + 0.05]]], 'rgba(214,208,220,.5)', 1); // Kette zum Abrollen
    ctx.globalCompositeOperation = 'lighter'; roh(() => { poly([[bx0, 0.5, bz], [bx1, 0.5, bz], [bx1, 0.3, bz - 0.14], [bx0, 0.3, bz - 0.14]], 'rgba(255,236,214,.1)'); }); ctx.globalCompositeOperation = 'source-over'; // Licht in der Kehle
    linien([[[bx1, 0.5, bz], [bx1, 2.86, bz]], [[bx1, 0.5, bz], [bx1, 0.18, bz - 0.26]], [[bx1, 0.18, bz - 0.26], [bx1, 0.006, bz - 0.8]], [[bx1, 0.006, bz - 0.8], [bx1 + 0.12, 0.006, 6.75]], [[bx1 + 0.12, 0.006, 6.75], [bx0 - 0.12, 0.006, 6.75]]], 'rgba(255,214,190,.5)', 1); // die Papierkante im Licht
    linien([[[bx0, 0.5, bz], [bx0, 2.86, bz]], [[bx0, 0.5, bz], [bx0, 0.18, bz - 0.26]], [[bx0, 0.18, bz - 0.26], [bx0, 0.006, bz - 0.8]], [[bx0, 0.006, bz - 0.8], [bx0 - 0.12, 0.006, 6.75]]], 'rgba(60,24,16,.35)', 1);
    linien([[[bx0 + 0.5, 0.9, bz - 0.001], [bx0 + 0.55, 2.7, bz - 0.001]], [[bx1 - 0.6, 0.7, bz - 0.001], [bx1 - 0.56, 2.5, bz - 0.001]]], 'rgba(120,50,30,.14)', lwAt(bz, 0.05)); // zwei weiche Wellen im Papier
  });
  aus(8.49, aV, [bx0 - 0.15, bx1 + 0.15, 0, 2.9, 6.7, bz], (v) => { flaechen(papier, `rgba(24,18,22,${0.42 * v})`); });
  // ── Video: die Tonangel auf einem Stativ, das Mikrofon hängt über der Person vor der Kamera ──
  fest(az, [ax - 0.95, ax + 0.5, 0, 2.7, 7.75, az + 0.3], () => {
    stativ(ax, az, 0.6, [[-0.36, 0.1], [0.36, 0.12], [0, -0.4]], 0.035);
    const top = [ax, 2.36, az], spitze = [ax - 0.74, 2.56, az - 0.42], ende = [ax + 0.34, 2.27, az + 0.2];
    linien([[[ax, 0.5, az], top]], dark, lwAt(az, 0.04)); linien([[ende, spitze]], '#15131a', lwAt(az, 0.03));
    const m0 = [spitze[0] - 0.01, spitze[1] - 0.05, spitze[2]], m1 = [spitze[0] + 0.07, spitze[1] - 0.36, spitze[2] + 0.02];
    ctx.lineCap = 'round'; seg(m0, m1, '#4a4858', lwAt(az, 0.085)); ctx.lineCap = 'butt';                            // das Mikrofon im Windkorb
    if (!FEIN) return;
    fleck(ax, az, 0.36, 0.26, 0.14);
    ctx.lineCap = 'round'; seg([m0[0] - 0.012, m0[1] - 0.02, m0[2]], [m1[0] - 0.012, m1[1] + 0.03, m1[2]], 'rgba(255,255,255,.16)', lwAt(az, 0.02)); ctx.lineCap = 'butt';
    linien([[spitze, m0], [[ax, 1.3, az], [ax, 1.36, az]], [[ax, 2.3, az], top]], '#3a3849', lwAt(az, 0.06));        // Gelenk, Klemmen
    box(ende[0] - 0.09, ende[0] + 0.09, ende[1] - 0.3, ende[1] - 0.06, ende[2] - 0.05, ende[2] + 0.05, '#3a3436', '#211c20', '#17141a'); // Gegengewicht
    linien([[spitze, [ax - 0.2, 2.44, az - 0.1]], [[ax - 0.2, 2.44, az - 0.1], [ax + 0.02, 2.2, az]], [[ax + 0.02, 2.2, az], [ax + 0.03, 0.55, az]]], '#0a0808', lwAt(az, 0.014)); // das Kabel an der Angel entlang
  });
  tuerDinge('studios', { zarge: '#0a0809', blatt: ['#4a3a34', '#33272a'] });
  // ── Website: der Arbeitstisch mit dem großen Bildschirm ──
  const schirmW = () => rectZ(wx - 1.08, wx + 1.08, 1.0, 2.38, wz);
  fest(8.64, [wx - 1.4, wx + 1.32, 0, 2.44, 7.8, 8.66], () => {
    wurf(wx - 1.22, wx + 1.22, 7.85, 8.62, 0.8, 0.12);
    for (const x of [wx - 1.15, wx + 1.05]) box(x, x + 0.1, 0, 0.74, 7.95, 8.5, '#111', '#101016', '#16151e');
    if (FEIN) { // unter der Platte: Rollcontainer mit drei Schubladen, Papierkorb, Kabelwanne
      box(wx + 0.42, wx + 0.9, 0.05, 0.6, 8.0, 8.5, '#4a4858', '#22212c', '#2b2a38');
      linien([[[wx + 0.42, 0.24, 7.999], [wx + 0.9, 0.24, 7.999]], [[wx + 0.42, 0.42, 7.999], [wx + 0.9, 0.42, 7.999]]], 'rgba(0,0,0,.5)', 1);
      flaechen([0.15, 0.33, 0.51].map((y) => [[wx + 0.58, y, 7.998], [wx + 0.74, y, 7.998], [wx + 0.74, y + 0.02, 7.998], [wx + 0.58, y + 0.02, 7.998]]), '#8a88a0');
      box(wx - 0.92, wx - 0.66, 0, 0.34, 8.15, 8.41, '#2b2a38', '#15141c', '#1b1a25');
      fillZ(wx - 1.05, wx + 1.05, 0.62, 0.7, 8.45, '#16151e');
    }
    box(wx - 1.22, wx + 1.22, 0.74, 0.8, 7.85, 8.62, '#8a6c5c', '#2c2220', '#362a27');
    if (FEIN) { // Holz: Maserung auf der Platte, Lichtkante vorn
      const m = []; for (let i = 0; i < 9; i++) { const z = 7.9 + i * 0.08, a = wx - 1.2 + hash(i, 21) * 0.5; m.push([[a, 0.8005, z], [a + 0.7 + hash(i, 22) * 1.1, 0.8005, z]]); } linien(m, 'rgba(50,24,14,.2)', 1);
      fillZ(wx - 1.22, wx + 1.22, 0.785, 0.8, 7.849, 'rgba(255,226,200,.3)'); fillZ(wx - 1.22, wx + 1.22, 0.74, 0.748, 7.849, 'rgba(0,0,0,.3)');
    }
    fillZ(wx - 0.09, wx + 0.09, 0.8, 1.06, wz, '#0a0a10'); fillZ(wx - 0.32, wx + 0.32, 0.8, 0.83, wz, '#0a0a10');
    const m = fillZ(wx - 1.08, wx + 1.08, 1.0, 2.38, wz, '#05050a');
    if (m) { const [x, y, w, h] = webFlaeche(m), tx = TEX.web0 || TEX.web; if (tx) ctx.drawImage(tx, x, y, w, h);
      if (FEIN) { spiegelung([x, y, w, h]); roh(() => { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(m[0], m[1], m[2], Math.max(1, m[3] * 0.006)); const n = m[2] * 0.035; [['#FF8A4C', 0.07], ['#f3e6c4', 0.115], ['#A78BFA', 0.86]].forEach(([c, u]) => { ctx.fillStyle = c; ctx.fillRect(m[0] + m[2] * u, m[1] + m[3] - n * 0.35, n, n); }); }); } } // Glanz im Glas, Lichtkante, Klebezettel am Rand
    // auf dem Tisch: Schreibtischleuchte, Becher, Tastatur und Maus; rechts ein Tablet mit der Farbpalette, Bücher, eine kleine Pflanze
    const lx = wx - 1.02, lz = 8.3;
    linien([[[lx, 0.8, lz], [lx - 0.06, 1.12, lz]], [[lx - 0.06, 1.12, lz], [lx + 0.16, 1.3, lz - 0.08]]], '#15131a', lwAt(lz, 0.022));
    poly([[lx + 0.1, 1.31, lz - 0.08], [lx + 0.3, 1.27, lz - 0.14], [lx + 0.3, 1.19, lz - 0.14], [lx + 0.12, 1.25, lz - 0.08]], '#3a3849');
    box(wx - 0.22, wx + 0.22, 0.8, 0.82, 7.93, 8.1, '#3a3849', '#16151e', '#1b1a25');
    box(wx - 0.74, wx - 0.64, 0.8, 0.92, 8.0, 8.1, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    poly([[wx + 0.56, 0.802, 8.2], [wx + 0.92, 0.802, 8.2], [wx + 0.92, 1.06, 8.34], [wx + 0.56, 1.06, 8.34]], '#15131a');
    if (!FEIN) return;
    fillZ(lx - 0.08, lx + 0.08, 0.8, 0.82, lz, '#15131a'); roh(() => { ctx.globalCompositeOperation = 'lighter'; poly([[lx + 0.12, 1.2, lz - 0.1], [lx + 0.3, 1.2, lz - 0.14], [lx + 0.62, 0.803, lz - 0.2], [lx - 0.1, 0.803, lz - 0.14]], 'rgba(255,224,170,.1)'); ctx.globalCompositeOperation = 'source-over'; });
    box(wx + 0.3, wx + 0.4, 0.8, 0.825, 7.95, 8.1, '#d8d2e0', '#8a8496', '#9a94a8'); fillZ(wx - 0.5, wx - 0.3, 0.8, 0.812, 7.96, '#2b2a38');          // Maus, Zeichentablett
    linien([[[wx - 0.71, 0.92, 8.05], [wx - 0.73, 1.06, 8.05]], [[wx - 0.68, 0.92, 8.05], [wx - 0.65, 1.04, 8.05]]], '#FF8A4C', lwAt(8.05, 0.012));        // Stifte im Becher
    roh(() => { const pal = ['#FF5A1F', '#f3e6c4', '#8B5CF6', '#1b1530', '#7DB7FF']; pal.forEach((c, i) => poly([[wx + 0.585 + i * 0.064, 0.84, 8.22], [wx + 0.64 + i * 0.064, 0.84, 8.22], [wx + 0.64 + i * 0.064, 1.03, 8.325], [wx + 0.585 + i * 0.064, 1.03, 8.325]], c)); }); // die Farbpalette
    box(wx + 0.98, wx + 1.18, 0.8, 0.84, 8.0, 8.28, '#d9c9b4', '#8a7a68', '#9a8a78'); box(wx + 0.99, wx + 1.17, 0.84, 0.875, 8.02, 8.28, '#6a5a90', '#3a3058', '#463a6a'); box(wx + 1.0, wx + 1.16, 0.875, 0.905, 8.03, 8.27, '#e9e4f3', '#bdb7cf', '#a8a2bc'); // Bücher
    { const B = flachAn(wx + 0.3, 0.8, 8.42); if (B) { B.R(-0.06, 0, 0.12, 0.1, '#6a4a3c'); B.E(-0.05, 0.2, 0.05, 0.11, '#2f4a35'); B.E(0.04, 0.22, 0.05, 0.13, '#3d5c40'); B.E(0, 0.26, 0.04, 0.12, '#35523a'); } }
  });
  ding(8.635, (tt) => { const m = schirmW(); if (!m || webBild(m, lW, aW(), tt) === false) return false; return [m[0], m[1], m[0] + m[2], m[1] + m[3]]; });
  ding(8.63, (tt) => { const m = schirmW(); if (!m || !lW || aW() < 0.9) return false; return webRahmen(m, lW, lW.u <= 0 ? geste(lW, tt) : 0, tt) || false; });
  fest(Q.pflanze[1], [Q.pflanze[0] - 0.6, Q.pflanze[0] + 0.6, 0, 1.7, Q.pflanze[1] - 0.4, Q.pflanze[1] + 0.3], () => pflanze(Q.pflanze[0], Q.pflanze[1], true, 1.12));
  // ── Video: die Lichtwanne links vor dem Hintergrund (helle Fläche, schräg zu uns), auf einem Stativ mit Sandsack. Sie leuchtet die Person vor der Kamera von links an ──
  const lw0 = [sx - 0.17, 1.35, sz - 0.47], lw1 = [sx + 0.17, 1.35, sz + 0.47], lw2 = [sx + 0.17, 2.6, sz + 0.47], lw3 = [sx - 0.17, 2.6, sz - 0.47], lwK = [sx - 0.47, 2.0, sz + 0.17], px = sx - 0.22, pz = sz + 0.08;
  fest(sz + 0.1, [sx - 0.75, sx + 0.3, 0, 2.7, sz - 0.55, sz + 0.55], () => {
    fleck(px, pz, 0.4, 0.3, 0.16, 1.2);
    linien([[[px, 0.4, pz], [px, 1.55, pz]], [[px, 1.55, pz], [sx - 0.4, 1.98, sz + 0.14]]], dark, lwAt(sz, 0.05));
    stativ(px, pz, 0.42, [[-0.38, 0.12], [0.36, 0.18], [0.02, -0.42]], 0.035);
    flaechen([[lw0, lw1, lwK], [lw2, lw3, lwK]], '#0e0e14'); flaechen([[lw1, lw2, lwK], [lw3, lw0, lwK]], '#15151d');
    const mi = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], auf = (u, v) => mi(mi(lw0, lw1, u), mi(lw3, lw2, u), v); // Punkt auf der Leuchtfläche
    if (!FEIN) { poly([lw0, lw1, lw2, lw3], 'rgb(242,226,206)'); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(sz, 0.05); ctx.stroke(); return; }
    poly([lw0, lw1, lw2, lw3], '#0c0b10'); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(sz, 0.05); ctx.stroke();                 // der Rahmen: schwarzer Stoffrand um die Bespannung
    { const fc = P(sx, 2.02, sz), fr = (0.8 * S.f) / Math.max(NEAR, sz - cam.z), fg = ctx.createRadialGradient(fc[0], fc[1], 0, fc[0], fc[1], fr); fg.addColorStop(0, 'rgb(253,242,224)'); fg.addColorStop(0.42, 'rgb(240,216,188)'); fg.addColorStop(1, 'rgb(170,134,114)');
      roh(() => poly([auf(0.09, 0.045), auf(0.91, 0.045), auf(0.91, 0.955), auf(0.09, 0.955)], fg)); }                               // die Bespannung: in der Mitte hell, zum Rand dunkler
    { const g = []; for (let i = 1; i < 5; i++) g.push([auf(0.09 + (0.82 * i) / 5, 0.045), auf(0.09 + (0.82 * i) / 5, 0.955)]); for (let j = 1; j < 9; j++) g.push([auf(0.09, 0.045 + (0.91 * j) / 9), auf(0.91, 0.045 + (0.91 * j) / 9)]);
      linien(g, 'rgba(34,24,20,.42)', lwAt(sz, 0.014)); }                                                                              // die Wabe vor dem Tuch
    linien([[lw1, lw2]], 'rgba(255,238,216,.55)', 1); linien([[auf(0.09, 0.045), auf(0.09, 0.955)]], 'rgba(0,0,0,.3)', lwAt(sz, 0.02)); // Lichtkante am Rahmen, Schatten der Rahmentiefe
    glow(sx + 0.1, 2.0, sz, 0.8, [[0, 'rgba(255,238,214,.15)'], [1, 'rgba(255,238,214,0)']]);                                        // der weiche Schein um die Fläche
    box(px - 0.13, px + 0.17, 0, 0.09, pz - 0.4, pz - 0.2, '#3a3436', '#17141a', '#211c20');                                        // Sandsack auf dem Fuß
    linien([[[px, 1.0, pz], [px, 1.08, pz]], [[px, 1.5, pz], [px, 1.58, pz]]], '#3a3849', lwAt(sz, 0.075));                         // Klemmen
    linien([[lwK, [px + 0.04, 1.5, pz]], [[px + 0.04, 1.5, pz], [px + 0.04, 0.3, pz]], [[px + 0.04, 0.3, pz], [px, 0.01, pz]]], '#0a0808', lwAt(sz, 0.014));
    glow(sx + 0.45, 1.9, sz - 0.1, 1.5, [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},0)`]]);
  });
  aus(sz + 0.09, aV, [sx - 0.2, sx + 0.2, 1.3, 2.65, sz - 0.5, sz + 0.5], (v) => { poly([lw0, lw1, lw2, lw3], `rgba(96,88,92,${0.82 * v})`); });
  fest(STOOL.z + 0.01, [STOOL.x - 0.45, STOOL.x + 0.45, 0, STOOL.h + 0.02, STOOL.z - 0.5, STOOL.z + 0.4], () => hocker(STOOL.x, STOOL.h, STOOL.z));
  // ── Video: der Schnittwagen. Oben der Monitor mit dem Schnitt (Bild der Kamera, Ablage, Spuren), darunter der Rechner ──
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
          [['#c4683f', 0], ['#8a5fd0', 1], ['#e9dfcf', 2], ['#7a4630', 3], ['#3a3849', 4], ['#d98a5c', 5]].forEach(([c, i]) => U(0.025 + (i % 2) * 0.18, 0.05 + ((i / 2) | 0) * 0.17, 0.16, 0.14, c));                       // Ablage: sechs Aufnahmen
          U(0.02, 0.6, 0.96, 0.012, 'rgba(246,244,240,.3)'); for (const v of [0.66, 0.75, 0.85, 0.92]) U(0.02, v, 0.96, 0.07, 'rgba(246,244,240,.05)');                                                              // Zeitleiste, vier Spuren
          ctx.fillStyle = '#e0763f'; ctx.beginPath(); for (const [a, b] of [[0.03, 0.2], [0.24, 0.14], [0.39, 0.25], [0.65, 0.12], [0.78, 0.19]]) ctx.rect(r[0] + a * r[2], r[1] + 0.75 * r[3], b * r[2] - 1, 0.07 * r[3]); ctx.fill();
          ctx.fillStyle = '#9b7cf2'; ctx.beginPath(); for (const [a, b] of [[0.24, 0.1], [0.5, 0.14], [0.8, 0.08]]) ctx.rect(r[0] + a * r[2], r[1] + 0.66 * r[3], b * r[2] - 1, 0.07 * r[3]); ctx.fill();
          ctx.fillStyle = '#3fae8a'; ctx.beginPath(); for (const [a, b] of [[0.03, 0.35], [0.39, 0.37], [0.78, 0.19]]) ctx.rect(r[0] + a * r[2], r[1] + 0.85 * r[3], b * r[2] - 1, 0.055 * r[3]); for (const [a, b] of [[0.1, 0.5], [0.65, 0.3]]) ctx.rect(r[0] + a * r[2], r[1] + 0.92 * r[3], b * r[2] - 1, 0.055 * r[3]); ctx.fill();
          spiegelung(r); }
        else { U(0.03, 0.75, 0.94, 0.07, '#e0763f'); U(0.03, 0.85, 0.94, 0.055, '#3fae8a'); } }
      if (l) { const U = ui(l); U(0, 0, 1, 1, '#161420'); if (FEIN) { U(0.05, 0.1, 0.4, 0.5, '#c4683f'); for (let i = 0; i < 4; i++) U(0.52, 0.1 + i * 0.13, 0.4 - (i % 2) * 0.12, 0.07, 'rgba(246,244,240,.4)'); U(0.05, 0.7, 0.9, 0.2, 'rgba(246,244,240,.1)'); U(0.05, 0.76, 0.5, 0.08, '#3fae8a'); } else U(0.05, 0.1, 0.4, 0.5, '#c4683f'); }
    });
    if (!FEIN) return;
    flaechen([[-0.3, -0.2], [0.3, 0.2], [-0.3, 0.2], [0.3, -0.2]].map(([dx, dz]) => { const x = cx + dx, z = cz + dz; return [[x - 0.035, 0, z], [x + 0.035, 0, z], [x + 0.035, 0.07, z], [x - 0.035, 0.07, z]]; }), '#2b2a38'); // Rollen
    fillZ(cx - 0.35, cx + 0.35, 1.495, 1.5, cz - 0.001, 'rgba(255,255,255,.16)');
    fillZ(cx - 0.27, cx + 0.27, 0.793, 0.8, cz - 0.201, 'rgba(255,255,255,.14)');
  });
  aus(cz - 0.005, aV, [cx - 0.36, cx + 0.36, 0.82, 1.5, cz - 0.02, cz + 0.2], (v) => { const r = monW(), l = lapW(); ctx.fillStyle = `rgba(8,8,12,${0.85 * v})`; if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); if (l) ctx.fillRect(l[0], l[1], l[2], l[3]); });
  ding(cz - 0.006, (tt) => { // was auf dem Monitor lebt: die Abspielmarke läuft über die Spuren, das Aufnahmelicht blinkt
    const r = monW(); if (!r || aV() < 0.6) return false; const u = 0.06 + 0.86 * (((tt || 0) % 14000) / 14000), b = Math.max(1, r[2] * 0.008), an = !tt || tt % 1500 < 900;
    roh(() => { ctx.fillStyle = '#fff'; ctx.fillRect(r[0] + u * r[2], r[1] + 0.6 * r[3], b, 0.38 * r[3]); if (an) { ctx.fillStyle = '#ff4a32'; ctx.fillRect(r[0] + 0.93 * r[2], r[1] + 0.075 * r[3], r[3] * 0.045, r[3] * 0.045); } });
    return [r[0] + u * r[2] - 1, r[1], r[0] + r[2], r[1] + r[3]];
  });
  // ── Video: die Kamera auf dem Stativ ──
  fest(Q.kamera[1], [Q.kamera[0] - 0.7, Q.kamera[0] + 0.6, 0, Q.kamera[2] + 0.62, Q.kamera[1] - 0.3, Q.kamera[1] + 0.46], () => { if (FEIN) fleck(Q.kamera[0], Q.kamera[1] + 0.05, 0.4, 0.3, 0.14, 1.2); kameraSet(Q.kamera[0], Q.kamera[1], Q.kamera[2]); });
  ding(Q.kamera[1] - 0.004, (tt) => { // das Aufnahmelicht an der Kamera
    if (aV() < 0.6 || (tt && tt % 1500 >= 900)) return false; const B = flachAn(Q.kamera[0], Q.kamera[2], Q.kamera[1]); if (!B) return false;
    roh(() => B.R(0.235, 0.225, 0.035, 0.035, '#ff4a32')); return [B.X(0.23), B.Y(0.27), B.X(0.28), B.Y(0.22)];
  });
  // ── Video: die Koffer. Auf dem großen liegt ein kleiner, daran lehnt die Klappe, daneben eine Rolle Klebeband ──
  fest(kz + 0.18, [kx - 0.42, kx + 0.42, 0, 0.62, kz - 0.24, kz + 0.2], () => {
    wurf(kx - 0.36, kx + 0.36, kz - 0.18, kz + 0.18, 0.34, 0.3);
    box(kx - 0.36, kx + 0.36, 0, 0.34, kz - 0.18, kz + 0.18, '#3a3436', '#17141a', '#211c20');
    fillZ(kx - 0.36, kx + 0.36, 0.215, 0.245, kz - 0.181, `rgba(${BR},.8)`);
    box(kx - 0.32, kx + 0.02, 0.34, 0.5, kz - 0.13, kz + 0.11, '#4a4858', '#1b1a25', '#262532');
    const kl = [[kx + 0.08, 0.34, kz - 0.06], [kx + 0.34, 0.34, kz - 0.06], [kx + 0.34, 0.56, kz + 0.04], [kx + 0.08, 0.56, kz + 0.04]];
    poly(kl, '#101016');
    if (!FEIN) return;
    const f = kz - 0.182, e = 'rgba(206,200,214,.55)';
    linien([[[kx - 0.36, 0, f], [kx - 0.36, 0.34, f]], [[kx + 0.36, 0, f], [kx + 0.36, 0.34, f]], [[kx - 0.36, 0.34, f], [kx + 0.36, 0.34, f]], [[kx - 0.36, 0.34, kz + 0.18], [kx + 0.36, 0.34, kz + 0.18]], [[kx - 0.36, 0.005, f], [kx + 0.36, 0.005, f]]], e, lwAt(kz, 0.014)); // Kanten aus Aluminium
    flaechen([[-0.36, 0], [0.31, 0], [-0.36, 0.29], [0.31, 0.29]].map(([dx, y]) => [[kx + dx, y, f], [kx + dx + 0.05, y, f], [kx + dx + 0.05, y + 0.05, f], [kx + dx, y + 0.05, f]]), '#8a8088'); // Eckbeschläge
    flaechen([-0.2, 0.2].map((dx) => [[kx + dx - 0.03, 0.16, f], [kx + dx + 0.03, 0.16, f], [kx + dx + 0.03, 0.27, f], [kx + dx - 0.03, 0.27, f]]), '#a8a2b0');                               // Schnallen
    linien([[[kx - 0.09, 0.1, f], [kx + 0.09, 0.1, f]]], '#0a0809', lwAt(kz, 0.03));                                                                                                             // Griff
    linien([[[kx - 0.32, 0.5, kz - 0.131], [kx + 0.02, 0.5, kz - 0.131]], [[kx - 0.32, 0.34, kz - 0.131], [kx - 0.32, 0.5, kz - 0.131]], [[kx + 0.02, 0.34, kz - 0.131], [kx + 0.02, 0.5, kz - 0.131]]], e, 1);
    fillZ(kx - 0.19, kx - 0.11, 0.4, 0.44, kz - 0.132, '#a8a2b0');
    // die Klappe: weiße Schrägstreifen am Schlagarm, zwei Linien auf der Tafel
    const u = (a, b) => [lerp(kl[0][0], kl[1][0], a), lerp(kl[0][1], kl[3][1], b), lerp(kl[0][2], kl[3][2], b)];
    flaechen([0, 1, 2, 3].map((i) => [u(i * 0.25, 0.8), u(i * 0.25 + 0.12, 0.8), u(i * 0.25 + 0.2, 1), u(i * 0.25 + 0.08, 1)]), '#e9e4f3');
    linien([[u(0, 0.78), u(1, 0.78)], [u(0.08, 0.5), u(0.92, 0.5)], [u(0.08, 0.26), u(0.6, 0.26)]], 'rgba(233,228,243,.6)', 1);
    { const B = flachAn(kx - 0.15, 0.5, kz - 0.02); if (B) { ctx.strokeStyle = '#d8d2c8'; ctx.lineWidth = Math.max(1.5, 0.035 * B.k); ctx.beginPath(); ctx.ellipse(B.X(0), B.Y(0.03), 0.075 * B.k, 0.03 * B.k, 0, 0, 7); ctx.stroke(); } } // eine Rolle Klebeband
  });
  // ── Social Media: Ringlicht auf Stativ, darin das Handy im Hochformat (es nimmt auf) ──
  fest(rz, [rx - 0.36, rx + 0.36, 0, ry + 0.32, rz - 0.22, rz + 0.36], () => {
    fleck(rx, rz + 0.04, 0.3, 0.22, 0.15, 0.9);
    stativ(rx, rz, 0.5, [[-0.3, -0.18], [0.3, -0.18], [0, 0.34]], 0.035);
    linien([[[rx, 0.5, rz], [rx, ry - 0.27, rz]]], dark, lwAt(rz, 0.04));
    if (rz - cam.z < 0.8) return;
    { const tb = fillZ(rx - 0.16, rx + 0.16, 0.84, 1.08, rz - 0.01, '#0a0a10'); // am Stativ: ein Tablet mit dem Redaktionsplan (neun Kacheln, nur Formen)
      if (tb) roh(() => { const U = ui([tb[0] + tb[2] * 0.05, tb[1] + tb[3] * 0.07, tb[2] * 0.9, tb[3] * 0.86]); U(0, 0, 1, 1, '#1b1a25'); if (!FEIN) { U(0.04, 0.06, 0.92, 0.88, '#d98a5c'); return; }
        ['#FF5A1F', '#f3e6c4', '#c4683f', '#8B5CF6', '#e0763f', '#3a3849', '#f6dcc4', '#FF8A4C', '#7a4630'].forEach((c, i) => U(0.04 + (i % 3) * 0.32, 0.06 + ((i / 3) | 0) * 0.31, 0.28, 0.26, c)); }); }
    const c = P(rx, ry, rz), k = S.f / (rz - cam.z), rr = 0.27 * k, pw = 0.075 * k, ph = 0.165 * k;
    if (FEIN) glow(rx, ry, rz, 0.9, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
    ctx.lineWidth = Math.max(2, 0.06 * k); ctx.strokeStyle = '#17151b'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 0.62, rr, 0, 0, 7); ctx.stroke();
    roh(() => { ctx.lineWidth = Math.max(1.5, 0.04 * k); ctx.strokeStyle = 'rgb(255,246,232)'; ctx.beginPath(); ctx.ellipse(c[0] + 0.012 * k, c[1], rr * 0.62, rr, 0, -1.9, 1.9); ctx.stroke(); });
    ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.roundRect(c[0] - pw / 2, c[1] - ph / 2, pw, ph, pw * 0.2); ctx.fill();
    roh(() => { const px = c[0] - pw / 2 + pw * 0.1, py = c[1] - ph / 2 + ph * 0.05, w = pw * 0.8, h = ph * 0.9; ctx.fillStyle = `rgb(${BR})`; ctx.fillRect(px, py, w, h);
      if (!FEIN) return;
      ctx.fillStyle = '#f6dcc4'; ctx.fillRect(px, py + h * 0.52, w, h * 0.48); ctx.fillStyle = '#3d2a24'; ctx.beginPath(); ctx.arc(px + w / 2, py + h * 0.36, w * 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(px + w / 2, py + h * 0.66, w * 0.34, h * 0.16, 0, 0, 7); ctx.fill();   // im Bild: eine Person vor Orange
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(px + w * 0.08, py + h * 0.04, w * 0.38, Math.max(1, h * 0.012)); ctx.fillRect(px + w * 0.54, py + h * 0.04, w * 0.38, Math.max(1, h * 0.012));
      ctx.beginPath(); ctx.arc(px + w / 2, py + h * 0.9, w * 0.13, 0, 7); ctx.fill(); });
    if (!FEIN) return;
    ctx.lineWidth = Math.max(1, 0.008 * k); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 0.62 + 0.03 * k, rr + 0.03 * k, 0, 3.4, 4.9); ctx.stroke();
    ctx.fillStyle = '#17151b'; ctx.fillRect(c[0] - 0.02 * k, c[1] + ph / 2, 0.04 * k, rr - ph / 2); ctx.fillRect(c[0] - 0.05 * k, c[1] + rr - 0.01 * k, 0.1 * k, 0.07 * k);        // Halter des Handys, Kugelkopf
    linien([[[rx, 0.62, rz], [rx, 0.68, rz]]], '#3a3849', lwAt(rz, 0.07));
  });
  aus(rz - 0.004, aS, [rx - 0.2, rx + 0.22, ry - 0.3, ry + 0.3, rz - 0.01, rz + 0.01], (v) => { // niemand nimmt auf: der Ring und das Handy werden dunkel
    const c = P(rx, ry, rz), k = S.f / (rz - cam.z), rr = 0.27 * k, pw = 0.075 * k, ph = 0.165 * k;
    ctx.lineWidth = Math.max(1.5, 0.042 * k); ctx.strokeStyle = `rgba(70,64,72,${v})`; ctx.beginPath(); ctx.ellipse(c[0] + 0.012 * k, c[1], rr * 0.62, rr, 0, -1.9, 1.9); ctx.stroke();
    ctx.fillStyle = `rgba(10,10,16,${0.8 * v})`; ctx.fillRect(c[0] - pw * 0.4, c[1] - ph * 0.45, pw * 0.8, ph * 0.9);
  });
  // ── Social Media: ein kleiner Beistelltisch mit Requisiten und einem zweiten, kleinen Licht (hinter dem Platz, neben dem Weg zur Tür) ──
  const [tx, tz] = Q.beistell, tischH = 0.66;
  fest(tz + 0.22, [tx - 0.3, tx + 0.3, 0, 1.06, tz - 0.26, tz + 0.26], () => {
    const A = flachAn(tx, 0, tz); if (!A) return; const ry = 0.24 * Math.min(0.9, Math.max(0.08, (cam.y - oy - tischH) / (tz - cam.z)));
    if (FEIN) fleck(tx, tz, 0.28, 0.22, 0.2, 0.6);
    A.S([[0, 0.02], [0, tischH - 0.02]], '#15131a', 0.045);                                                                          // die Säule
    if (FEIN) { A.E(0, 0.02, 0.17, ry * 0.7, '#15131a'); A.E(0, tischH - 0.03, 0.24, ry, '#2c2220'); }                              // Fuß, Kante der Platte
    A.E(0, tischH, 0.24, ry, '#8a6c5c');                                                                                              // die Platte aus Holz
    if (!FEIN) return;
    A.E(-0.05, tischH + 0.004, 0.15, ry * 0.55, 'rgba(255,226,200,.16)');
    const y = tischH + 0.004;
    A.R(-0.19, y, 0.058, 0.075, '#e9dfcf'); A.R(-0.19, y + 0.066, 0.058, 0.009, '#5a3a2c');                                         // ein Becher
    A.R(-0.1, y, 0.11, 0.13, `rgb(${BR})`); A.R(-0.1, y + 0.112, 0.11, 0.018, 'rgba(255,255,255,.25)'); A.R(-0.09, y + 0.13, 0.075, 0.05, '#f3e6c4'); // zwei Schachteln: das Produkt für den nächsten Dreh
    A.S([[0.06, y], [0.11, y + 0.07], [0.16, y]], '#17151b', 0.014); A.S([[0.11, y + 0.07], [0.11, y + 0.17]], '#17151b', 0.018);   // ein kleines Licht auf Tischstativ
    A.V([[0.03, y + 0.17], [0.17, y + 0.16], [0.17, y + 0.29], [0.03, y + 0.28]], '#17151b');
    roh(() => A.V([[0.042, y + 0.182], [0.158, y + 0.172], [0.158, y + 0.278], [0.042, y + 0.268]], 'rgb(255,238,212)'));
    glow(tx + 0.1, y + 0.225, tz, 0.5, [[0, `rgba(${WARM},.2)`], [1, `rgba(${WARM},0)`]]);
  });
  aus(tz + 0.215, aS, [tx, tx + 0.2, tischH + 0.15, tischH + 0.31, tz - 0.01, tz + 0.01], (v) => { const A = flachAn(tx, 0, tz), y = tischH + 0.004; if (A) A.V([[0.042, y + 0.182], [0.158, y + 0.172], [0.158, y + 0.278], [0.042, y + 0.268]], `rgba(60,54,60,${0.9 * v})`); });
  // ── Strahler an den Schienen (hängen vor allem, was darunter steht) ──
  fest(7.3, [-1.6, 1.8, y1 - 0.5, y1, 7.25, 7.35], () => { strahler(-1.5, 7.3, y1, 1); strahler(1.7, 7.3, y1, 1); });
  fest(5.5, [-1.6, 1.8, y1 - 0.5, y1, 5.15, 5.55], () => { strahler(1.7, 5.5, y1, 1); strahler(-1.5, 5.2, y1, 0.6); });
  fest(3.4, [-1.6, 1.8, y1 - 0.5, y1, 3.15, 3.45], () => { strahler(1.7, 3.4, y1, 0.5); strahler(-1.5, 3.2, y1, 0.5); });
  fest(4.4, [2.2, 3.2, 0, 1.6, 4.15, 4.65], () => pflanze(2.72, 4.4, false, 1.2)); // weiter rechts als früher: Sie verdeckte sonst den Beistelltisch
  // ── ganz vorn: die Lehne des Sofas ──
  fest(3.2, [1.45, 3.35, 0, 0.84, 2.5, 3.25], () => { box(1.5, 3.3, 0, 0.4, 2.55, 3.2, '#3a2a25', '#1a1311', '#221815'); box(1.5, 3.3, 0.4, 0.82, 2.55, 2.72, '#46302a', '#1f1512', '#281b17'); fillZ(1.5, 3.3, 0.795, 0.82, 2.54, `rgba(${BR},.5)`); });
}
/* MAKE Revenue: ein Vertriebsraum. Links die Vertriebsleitung auf Zeit an ihrem Platz (ein Bildschirm voller Pipeline-Spalten, eine Kennzahlenwand darüber, daneben jemand mit Headset am Telefon),
   rechts der Tagesworkshop (Whiteboard mit Karten und Pfeilen, ein Tisch mit drei Teilnehmenden), in der Mitte die Tür und das Produkt des Kunden auf einem Sockel an der Wand.
   Gebaut wie MAKE Studios: Boden, Decke und Wand sofort, Möbel als feste Dinge im Grundzustand (alles an), davor nur, was dunkel wird, wenn eine Leistung geht (ausDing), und was lebt. */
const REV = { bild: [-1.74, -1.26, 1.34, 2.04], side: [-0.42, 0.2, 4.25, 4.6], insel: [-3.5, -1.35, 7.95, 8.75], tisch: [0.8, 2.6, 6.45, 7.15], board: [0.8, 2.8], sockel: [0.1, 0.8, 8.3, 8.9] };
function revenue(F, t, y1, z1) {
  const BL = '125,183,255', zw = z1 - 0.07, MX = 3.6, Q = REV, BRD = '#04060c';
  const aV = () => da('revenue', 'vertriebsleitung'), aT = () => da('revenue', 'tagesworkshop');
  // ── Decke: Querträger, zwei lange Leuchtbänder über den beiden Plätzen ──
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.13, y1, z, '#0d0f16');
  const baender = [[-3.4, -1.5, 7.3], [0.8, 2.7, 6.8]];
  linien(baender.flatMap(([x0, x1, z]) => [x0 + 0.2, x1 - 0.2].map((x) => [[x, y1, z + 0.07], [x, y1 - 0.7, z + 0.07]])), 'rgba(0,0,0,.6)', lwAt(7, 0.012));
  for (const [x0, x1, z] of baender) { box(x0, x1, y1 - 0.76, y1 - 0.7, z, z + 0.14, '#eef4ff', '#a9bde6', '#8fa4d2'); if (FEIN) glow((x0 + x1) / 2, y1 - 0.78, z, 1.8, [[0, `rgba(${BL},.22)`], [1, `rgba(${BL},0)`]]); }
  // ── Boden: Teppichfliesen (Fugen als zwei Striche, ausgearbeitet einzelne Fliesen etwas heller oder dunkler), darauf drei Teppiche in der Farbe der Marke ──
  { const L = [], R = [], hell = [], dunkel = [];
    for (let x = -6; x <= 6.01; x += 0.6) L.push([[x, 0, 0], [x, 0, z1]]); for (let z = 0.6; z < z1; z += 0.6) R.push([[-6, 0, z], [6, 0, z]]);
    if (FEIN) { for (let i = 0; i < 18; i++) for (let j = 4; j < 15; j++) { const h = hash(i, j * 3 + 1), x = -5.4 + i * 0.6, z = j * 0.6, f = [[x, 0.001, z], [x + 0.6, 0.001, z], [x + 0.6, 0.001, z + 0.6], [x, 0.001, z + 0.6]]; if (h < 0.24) hell.push(f); else if (h > 0.76) dunkel.push(f); } flaechen(hell, 'rgba(255,255,255,.05)'); flaechen(dunkel, 'rgba(0,0,0,.06)'); }
    linien(L, 'rgba(0,0,0,.2)', 1); linien(R, 'rgba(0,0,0,.16)', 1); }
  const teppiche = [[-3.9, -1.1, 6.4, 8.95, '#14224a', '#1a2c5e'], [0.55, 3.6, 5.3, 8.95, '#182a58', '#233a74']];
  for (const [xa, xb, za, zb, c0, c1] of teppiche) {
    if (FEIN) poly([[xa - 0.05, 0.003, za - 0.06], [xb, 0.003, za - 0.06], [xb, 0.003, zb], [xa - 0.05, 0.003, zb]], 'rgba(0,0,0,.2)');
    poly([[xa, 0.004, za], [xb, 0.004, za], [xb, 0.004, zb], [xa, 0.004, zb]], c0); poly([[xa + 0.12, 0.005, za + 0.1], [xb - 0.12, 0.005, za + 0.1], [xb - 0.12, 0.005, zb - 0.05], [xa + 0.12, 0.005, zb - 0.05]], c1);
    if (FEIN) linien([[[xa + 0.12, 0.006, za + 0.1], [xb - 0.12, 0.006, za + 0.1]], [[xa + 0.12, 0.006, za + 0.1], [xa + 0.12, 0.006, zb - 0.05]], [[xb - 0.12, 0.006, za + 0.1], [xb - 0.12, 0.006, zb - 0.05]]], 'rgba(190,214,255,.3)', 1); // Ziernaht
  }
  poly([[-1.5, 0.004, 3.2], [-0.2, 0.004, 3.2], [-0.2, 0.004, 4.6], [-1.5, 0.004, 4.6]], 'rgba(18,34,76,.9)');
  if (FEIN) { bodenlicht(-2.4, 7.0, 1.9, BL, 0.1); bodenlicht(1.8, 6.3, 1.9, BL, 0.1); bodenlicht(0.45, 7.9, 0.9, '230,240,255', 0.12); }
  lichtDing(8.96, () => { const v = 1 - aV(), w = 1 - aT(), y = 0.008; // das Licht am Boden geht aus, wenn dort niemand mehr arbeitet
    if (v > 0.02) poly([[-3.9, y, 8.95], [-1.1, y, 8.95], [-1.1, y, 6.4], [-3.9, y, 6.4]], `rgba(0,0,0,${0.16 * v})`);
    if (w > 0.02) poly([[0.55, y, 8.95], [3.6, y, 8.95], [3.6, y, 5.3], [0.55, y, 5.3]], `rgba(0,0,0,${0.16 * w})`); });
  // ── Rückwand: Sockelband, Leuchtlinie, Fries; ausgearbeitet Paneelfugen und eine Uhr über der Tür ──
  fillZ(-MX, MX, 0, 0.95, zw, 'rgba(3,6,16,.4)'); fillZ(-MX, MX, 0.95, 0.985, zw, `rgba(${BL},.55)`); fillZ(-MX, MX, 2.92, 2.96, zw, `rgba(${BL},.35)`); fillZ(-MX, MX, 0, 0.1, zw - 0.01, '#0a0b10');
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#0a0b10');
  if (FEIN) { const f = []; for (let x = -MX + 1.2; x < MX - 0.1; x += 1.2) f.push([[x, 0.1, zw - 0.001], [x, 0.95, zw - 0.001]], [[x, 0.985, zw - 0.001], [x, 2.92, zw - 0.001]]); linien(f, 'rgba(0,0,0,.14)', 1); linien([[[-MX, 0.1, zw - 0.011], [MX, 0.1, zw - 0.011]]], 'rgba(255,255,255,.14)', 1);
    const U = flachAn(-0.65, 2.55, zw - 0.02); if (U) { U.E(0, 0, 0.19, 0.19, '#0a0b10'); roh(() => U.E(0, 0, 0.165, 0.165, '#f4f6fb')); U.S([[0, 0], [0.07, 0.07]], '#10131c', 0.022); U.S([[0, 0], [-0.02, 0.13]], '#10131c', 0.014); U.E(0, 0, 0.018, 0.018, AKZ.revenue); } }
  // ── die Wand: Kennzahlen mit Verlauf über dem Platz der Vertriebsleitung, die Ablauftafel des Workshops (Grundzustand: an und beschrieben) ──
  tafel(-3.5, -1.85, 2.12, 2.9, zw, TEX.kpi, BRD, 1);
  if (FEIN) { glow(-2.7, 2.3, z1 - 0.1, 3.4, [[0, `rgba(${BL},.16)`], [1, `rgba(${BL},0)`]]); glow(2.08, 1.9, z1 - 0.1, 3.0, [[0, `rgba(${BL},.12)`], [1, `rgba(${BL},0)`]]); }
  const wb = fillZ(Q.board[0], Q.board[1], 0.95, 2.5, zw - 0.01, '#dfe7f4');
  if (wb) { const [rx, ry, rw, rh] = wb, b = Math.max(2, rw * 0.012), karten = [[0.05, 0.12, 0.17, 0.2, 0], [0.31, 0.12, 0.17, 0.2, 0], [0.57, 0.12, 0.17, 0.2, 1], [0.72, 0.38, 0.22, 0.22, 2], [0.05, 0.52, 0.17, 0.2, 1], [0.31, 0.52, 0.17, 0.2, 0]];
    ctx.fillStyle = '#9aa6c0'; ctx.beginPath(); ctx.rect(rx - b, ry - b, rw + 2 * b, b); ctx.rect(rx - b, ry + rh, rw + 2 * b, b * 2); ctx.rect(rx - b, ry - b, b, rh + 2 * b); ctx.rect(rx + rw, ry - b, b, rh + 2 * b); ctx.fill();
    // die Karten eines Ablaufs: von links nach rechts, eine Entscheidung, zwei Zweige, der Abschluss in der Farbe der Marke
    ctx.strokeStyle = '#26365e'; ctx.lineWidth = Math.max(1.5, rw * 0.008); ctx.beginPath();
    for (const [u0, v0, u1, v1] of [[0.22, 0.22, 0.31, 0.22], [0.48, 0.22, 0.57, 0.22], [0.74, 0.22, 0.8, 0.22], [0.8, 0.22, 0.8, 0.36], [0.66, 0.5, 0.72, 0.5], [0.4, 0.34, 0.4, 0.5], [0.22, 0.62, 0.31, 0.62], [0.48, 0.62, 0.58, 0.62]]) { ctx.moveTo(rx + u0 * rw, ry + v0 * rh); ctx.lineTo(rx + u1 * rw, ry + v1 * rh); } ctx.stroke();
    ['#ffe08a', '#bfd4ff', AKZ.revenue].forEach((c, n) => { ctx.fillStyle = c; ctx.beginPath(); for (const [u, v, w, h2, f] of karten) if (f === n) ctx.rect(rx + u * rw, ry + v * rh, w * rw, h2 * rh); ctx.fill(); });
    if (FEIN) { ctx.fillStyle = 'rgba(30,40,70,.35)'; ctx.beginPath(); for (const [u, v, w] of karten) { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.07) * rh, w * rw * 0.6, Math.max(1, rh * 0.025)); ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.13) * rh, w * rw * 0.42, Math.max(1, rh * 0.025)); } ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); for (const [u, v, w, h2] of karten) ctx.rect(rx + (u + 0.006) * rw, ry + (v + h2) * rh, w * rw, Math.max(1, rh * 0.012)); ctx.fill();                  // die Karten werfen einen schmalen Schatten
      ctx.beginPath(); ctx.setLineDash([rw * 0.02, rw * 0.015]); ctx.rect(rx + rw * 0.03, ry + rh * 0.8, rw * 0.94, rh * 0.14); ctx.stroke(); ctx.setLineDash([]);
      roh(() => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(rx + rw * 0.6, ry); ctx.lineTo(rx + rw * 0.74, ry); ctx.lineTo(rx + rw * 0.5, ry + rh); ctx.lineTo(rx + rw * 0.36, ry + rh); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }); } }
  fillZ(Q.board[0] + 0.3, Q.board[1] - 0.3, 0.9, 0.95, zw - 0.02, '#7c88a8'); if (FEIN) for (let i = 0; i < 4; i++) fillZ(Q.board[0] + 0.5 + i * 0.24, Q.board[0] + 0.62 + i * 0.24, 0.95, 0.99, zw - 0.03, ['#2a4a9a', '#c0342c', '#222', '#3a8a5a'][i]);
  ausDing(8.99, aV, [-3.5, -1.85, 2.12, 2.9, zw - 0.02, zw], (v) => { const r = rectZ(-3.5, -1.85, 2.12, 2.9, zw); if (r) { ctx.fillStyle = `rgba(4,6,12,${0.72 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  ausDing(8.985, aT, [Q.board[0], Q.board[1], 0.95, 2.5, zw - 0.03, zw], (v) => { const r = rectZ(Q.board[0] + 0.03, Q.board[1] - 0.03, 0.98, 2.47, zw - 0.01); if (r) { ctx.fillStyle = `rgba(223,231,244,${0.8 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } }); // der Workshop ist fort: die Tafel ist gewischt
  // ── Wandmitte: ein gerahmtes Diagramm zwischen Kennzahlenwand und Tür (Säulen und eine Linie; keine Zahlen, keine Worte) ──
  { const [gx0, gx1, gy0, gy1] = Q.bild, r = fillZ(gx0, gx1, gy0, gy1, zw - 0.012, '#0a0b10');
    if (r) roh(() => { const b = Math.max(1.5, r[2] * 0.07), U = ui([r[0] + b, r[1] + b, r[2] - 2 * b, r[3] - 2 * b]); U(0, 0, 1, 1, '#eef2fa');
      if (!FEIN) { U(0.14, 0.45, 0.72, 0.41, '#7da4ee'); return; }
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(r[0] + b * 0.5, r[1] + r[3], r[2], Math.max(1, b * 0.6));                 // Schatten unter dem Rahmen
      [[0.13, 0.2, '#bfd4ff'], [0.29, 0.31, '#9dbcf6'], [0.45, 0.27, '#7da4ee'], [0.61, 0.44, '#4f7fd8'], [0.77, 0.58, '#27406e']].forEach(([u, h, c]) => U(u, 0.86 - h, 0.11, h, c));
      U(0.09, 0.86, 0.83, 0.012, '#27406e');
      const pt = [[0.185, 0.56], [0.345, 0.44], [0.505, 0.47], [0.665, 0.3], [0.825, 0.16]].map(([u, v]) => [r[0] + b + u * (r[2] - 2 * b), r[1] + b + v * (r[3] - 2 * b)]);
      ctx.strokeStyle = '#ff9d5c'; ctx.lineWidth = Math.max(1.2, r[2] * 0.022); ctx.lineJoin = 'round'; ctx.beginPath(); pt.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.lineJoin = 'miter';
      ctx.fillStyle = '#ff9d5c'; ctx.beginPath(); for (const q of pt) { ctx.moveTo(q[0], q[1]); ctx.arc(q[0], q[1], Math.max(1.2, r[2] * 0.03), 0, 7); } ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(r[0], r[1], r[2], Math.max(1, b * 0.25)); }); }
  // ── der Sockel mit dem Produkt des Kunden: im eigenen Licht an der Wand zwischen Tür und Tafel ──
  ctx.globalCompositeOperation = 'lighter';
  poly([[0.12, 0.99, 8.9], [0.78, 0.99, 8.9], [1.15, 0.99, 8.2], [-0.25, 0.99, 8.2]], lg([0, 1, 8.9], [0, 1, 8.2], [[0, `rgba(${BL},.2)`], [1, `rgba(${BL},0)`]]));
  poly([[0.28, y1 - 0.02, 8.7], [0.62, y1 - 0.02, 8.7], [1.2, 1.0, 8.4], [-0.3, 1.0, 8.4]], lg([0, y1, 8.7], [0, 1, 8.4], [[0, 'rgba(230,240,255,.0)'], [0.4, 'rgba(230,240,255,.1)'], [1, 'rgba(230,240,255,.22)']]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN) wurf(Q.sockel[0], Q.sockel[1], Q.sockel[2], Q.sockel[3], 0.5, 0.16);
  box(Q.sockel[0], Q.sockel[1], 0, 1.0, Q.sockel[2], Q.sockel[3], '#c8d2ea', lg([0, 1, 8.3], [0, 0, 8.3], [[0, '#7d8cb4'], [1, '#2c3658']]), '#3c4870'); fillZ(Q.sockel[0], Q.sockel[1], 0.9, 0.94, Q.sockel[2] - 0.005, `rgba(${BL},.8)`);
  strahler(0.45, 8.1, y1, 0.9);
  // ── der Platz der Vertriebsleitung: ein Tisch mit zwei Arbeitsplätzen. Links die Pipeline, rechts die Anrufliste; Telefon, Headset auf dem Ständer, Notizbuch ──
  const zz = 8.4, monP = () => rectZ(-3.45, -2.25, 0.95, 1.6, zz), monA = () => rectZ(-2.2, -1.4, 0.92, 1.42, zz);
  fest(8.75, [Q.insel[0] - 0.4, Q.insel[1] + 0.1, 0, 1.64, Q.insel[2] - 0.1, Q.insel[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.insel; tischN(x0, x1, z0, z1b, 0.74, '#3a4c7c');
    if (FEIN) { box(x1 - 0.55, x1 - 0.12, 0.05, 0.6, z0 + 0.12, z1b - 0.12, '#4a5270', '#1c2238', '#252c48'); linien([[[x1 - 0.55, 0.24, z0 + 0.119], [x1 - 0.12, 0.24, z0 + 0.119]], [[x1 - 0.55, 0.42, z0 + 0.119], [x1 - 0.12, 0.42, z0 + 0.119]]], 'rgba(0,0,0,.5)', 1); } // Rollcontainer
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
    // Telefon mit Hörer, Headset auf dem Ständer, Notizbuch mit Stift
    poly([[-1.62, 0.74, 8.02], [-1.42, 0.74, 8.02], [-1.42, 0.82, 8.2], [-1.62, 0.82, 8.2]], '#2a2d3a'); box(-1.62, -1.42, 0.74, 0.745, 8.02, 8.2, '#2a2d3a', '#14161e', '#1b1d28');
    linien([[[-1.6, 0.8, 8.08], [-1.6, 0.86, 8.2]]], '#10131c', lwAt(zz, 0.035)); roh(() => fillZ(-1.55, -1.45, 0.775, 0.8, 8.14, `rgb(${BL})`));
    { const H = flachAn(-2.32, 0.74, 8.32); if (H) { H.R(-0.05, 0, 0.1, 0.012, '#10131c'); H.S([[0, 0], [0, 0.2]], '#10131c', 0.016); ctx.strokeStyle = '#2a2d3a'; ctx.lineWidth = Math.max(1.5, 0.018 * H.k); ctx.beginPath(); ctx.arc(H.X(0), H.Y(0.2), 0.075 * H.k, Math.PI, 0); ctx.stroke(); H.R(-0.095, 0.13, 0.04, 0.08, '#10131c'); H.R(0.055, 0.13, 0.04, 0.08, '#10131c'); H.S([[-0.075, 0.14], [-0.03, 0.08]], '#10131c', 0.01); } }
    box(-3.44, -3.26, 0.74, 0.755, 8.0, 8.2, '#1a2c5e', '#101830', '#16203e'); linien([[[-3.3, 0.757, 8.02], [-3.38, 0.757, 8.16]]], '#eef4ff', lwAt(zz, 0.012));
    fillZ(Q.insel[0], Q.insel[1], 0.6, 0.68, 8.6, '#141826');                                                                             // Kabelwanne unter der Platte
  });
  ausDing(8.74, aV, [-3.46, -1.39, 0.9, 1.62, zz - 0.02, zz + 0.02], (v) => { ctx.fillStyle = `rgba(4,6,12,${0.85 * v})`; for (const r of [monP(), monA()]) if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); });
  ding(8.739, (tt) => { // was lebt: Auf der Anrufliste wandert die Markierung von Zeile zu Zeile
    const r = monA(); if (!r || aV() < 0.6) return false; const n = Math.floor((tt || 0) / 2600) % 4, y = r[1] + r[3] * (0.3 + n * 0.15), b = Math.max(1, r[2] * 0.012);
    roh(() => { ctx.fillStyle = `rgb(${BL})`; ctx.fillRect(r[0] + r[2] * 0.045, y, b, r[3] * 0.1); }); return [r[0] + r[2] * 0.03, y - 1, r[0] + r[2] * 0.08, y + r[3] * 0.1 + 1];
  });
  // ── der Workshop-Tisch: helles Holz. Unterlagen, Haftzettel, Stifte, zwei Rechner, Wasser ──
  fest(7.17, [Q.tisch[0] - 0.25, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.74, '#c2ad92', '#4a3f34', '#55493c');
    flaechen([[0.95, 1.35, 6.6, 7.0], [1.45, 1.7, 6.55, 6.95]].map(([a, b, c, d]) => [[a, 0.752, c], [b, 0.752, c], [b, 0.752, d], [a, 0.752, d]]), '#f6f3ea'); flach(2.4, 2.5, 6.6, 6.8, 0.752, '#ffe08a');
    laptop(2.1, 0.75, 6.62, 0.44); laptop(1.15, 0.75, 6.72, 0.4);
    box(1.75, 1.83, 0.75, 0.83, 6.9, 6.98, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(2.45, 2.53, 0.75, 0.83, 6.9, 6.98, '#17469E', '#10357a', '#0d2c66');
    if (!FEIN) return;
    const m = []; for (let i = 0; i < 7; i++) { const z = z0 + 0.06 + i * 0.09, a = x0 + 0.05 + hash(i, 41) * 0.5; m.push([[a, 0.7405, z], [a + 0.5 + hash(i, 42) * 0.8, 0.7405, z]]); } linien(m, 'rgba(70,46,24,.18)', 1); // Maserung
    flaechen([[1.0, 6.68, 0.05, 0.12], [1.08, 6.68, 0.05, 0.2], [1.16, 6.68, 0.05, 0.09], [1.24, 6.68, 0.05, 0.16]].map(([x, z, w, h]) => [[x, 0.753, z], [x + w, 0.753, z], [x + w, 0.753, z + h], [x, 0.753, z + h]]), AKZ.revenue); // auf dem Blatt: ein Balkenbild
    linien([[[1.48, 0.753, 6.62], [1.67, 0.753, 6.62]], [[1.48, 0.753, 6.7], [1.67, 0.753, 6.7]], [[1.48, 0.753, 6.78], [1.6, 0.753, 6.78]]], 'rgba(30,40,70,.4)', 1);
    flaechen([[2.52, 6.62], [1.9, 6.98]].map(([x, z]) => [[x, 0.753, z], [x + 0.1, 0.753, z], [x + 0.1, 0.753, z + 0.1], [x, 0.753, z + 0.1]]), '#bfd4ff');                                             // Haftzettel
    linien([[[2.25, 0.756, 6.95], [2.38, 0.756, 7.02]], [[1.52, 0.756, 7.02], [1.66, 0.756, 7.0]]], '#c0342c', lwAt(6.9, 0.014)); linien([[[2.28, 0.756, 7.04], [2.41, 0.756, 6.98]]], '#2a4a9a', lwAt(6.9, 0.014)); // Stifte
    { const W = flachAn(0.98, 0.74, 7.02); if (W) { roh(() => { W.V([[-0.05, 0], [0.05, 0], [0.04, 0.2], [0.02, 0.24], [-0.02, 0.24], [-0.04, 0.2]], 'rgba(214,232,255,.55)'); W.R(-0.04, 0, 0.08, 0.11, 'rgba(150,196,255,.5)'); W.R(0.1, 0, 0.055, 0.09, 'rgba(214,232,255,.5)'); W.R(0.18, 0, 0.055, 0.09, 'rgba(214,232,255,.5)'); }); } } // Karaffe und zwei Gläser
  });
  ausDing(7.16, aT, [1.0, 2.35, 0.76, 1.08, 6.7, 6.95], (v) => { ctx.fillStyle = `rgba(4,6,12,${0.8 * v})`; for (const r of [rectZ(2.1 - 0.19, 2.1 + 0.19, 0.81, 1.02, 6.79), rectZ(1.15 - 0.17, 1.15 + 0.17, 0.81, 1.02, 6.89)]) if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); });
  fest(8.7, [2.95, 4.05, 0, 1.5, 8.3, 8.85], () => pflanze(3.5, 8.6, true));
  fest(3.7, [1.55, 2.65, 0, 1.5, 3.45, 3.95], () => pflanze(2.1, 3.7, false));
  // ── Raummitte: ein niedriges Sideboard vorn in der Mitte (wie die Sitzbank links ein Stück Vordergrund), darauf Ordner und eine Pflanze. Es steht vor allen Wegen und im Bild neben allen Plätzen: So wird es nie nachgezogen ──
  fest(Q.side[3], [Q.side[0] - 0.03, Q.side[1] + 0.03, 0, 1.05, Q.side[2] - 0.02, Q.side[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.side, h = 0.72;
    if (FEIN) wurf(x0, x1, z0, z1b, 0.1, 0.12);
    box(x0, x1, 0.06, h, z0, z1b, '#c2ad92', '#1b2748', '#22305a'); // Korpus im Blau des Raums, die Platte aus hellem Holz wie der Workshop-Tisch
    if (!FEIN) return;
    box(x0 + 0.04, x1 - 0.04, 0, 0.06, z0 + 0.04, z1b, '#111', '#101016', '#16151e');                                               // der Sockel, zurückgesetzt
    fillZ(x0, x1, h - 0.035, h, z0 - 0.001, '#8f7c66'); fillZ(x0, x1, h - 0.008, h, z0 - 0.0015, 'rgba(255,240,220,.4)');                 // die Kante der Holzplatte, darauf die Lichtkante
    linien([[[(x0 + x1) / 2, 0.1, z0 - 0.001], [(x0 + x1) / 2, h - 0.05, z0 - 0.001]]], 'rgba(0,0,0,.5)', 1); // zwei Türen
    flaechen([0, 1].map((i) => { const x = x0 + ((x1 - x0) * (i + 0.5)) / 2; return [[x - 0.07, h - 0.15, z0 - 0.002], [x + 0.07, h - 0.15, z0 - 0.002], [x + 0.07, h - 0.13, z0 - 0.002], [x - 0.07, h - 0.13, z0 - 0.002]]; }), `rgba(${BL},.8)`); // Griffleisten
    const A = flachAn(x0, h, z0 + 0.16); if (!A) return;
    [['#27406e', 0.3], ['#dfe7f4', 0.31], [`rgb(${BL})`, 0.3]].forEach(([c, hh], i) => { const dx = 0.27 + i * 0.078; A.R(dx, 0, 0.07, hh, c); A.R(dx + 0.014, hh * 0.52, 0.042, 0.085, 'rgba(255,255,255,.78)'); A.E(dx + 0.035, 0.05, 0.012, 0.012, 'rgba(0,0,0,.45)'); }); // Ordner: Rücken mit leerem Schild und Griffloch
    A.V([[0.51, 0], [0.58, 0], [0.61, 0.29], [0.54, 0.3]], '#182a52');                                                                 // einer lehnt an
                                                         // eine Ablage mit Papier
    A.R(0.07, 0, 0.16, 0.14, '#dfe7f4'); A.R(0.07, 0.115, 0.16, 0.025, 'rgba(0,0,0,.14)');                                           // die Pflanze im hellen Topf
    [[-0.09, 0.12], [-0.04, 0.17], [0.02, 0.19], [0.08, 0.16], [0.12, 0.11]].forEach(([dx, hh], i) => { const bx = 0.15, tx = bx + dx * 1.3, mx = (bx + tx) / 2; A.V([[bx - 0.02, 0.13], [mx - 0.05, 0.13 + hh * 0.5], [tx, 0.13 + hh], [mx + 0.05, 0.13 + hh * 0.45], [bx + 0.02, 0.13]], i % 2 ? '#2f4a35' : '#3d5c40'); });
  });
  fest(4.0, [-2.25, -0.85, 0, 0.82, 3.45, 4.05], () => { // ganz vorn: die niedrige Lehne einer Sitzbank, ein Stück Raum davor
    box(-2.2, -0.9, 0, 0.4, 3.5, 4.0, '#27365e', '#101830', '#16203e'); box(-2.2, -0.9, 0.4, 0.8, 3.5, 3.66, '#33457a', '#121b36', '#1a2548'); fillZ(-2.2, -0.9, 0.775, 0.8, 3.49, `rgba(${BL},.45)`);
    if (FEIN) linien([[[-1.55, 0.42, 3.499], [-1.55, 0.77, 3.499]], [[-2.2, 0.4, 3.499], [-0.9, 0.4, 3.499]]], 'rgba(0,0,0,.3)', 1);
  });
  tuerDinge('revenue', { zarge: '#05070e', blatt: ['#27406e', '#182a52'], griff: `rgba(${BL},.95)` });
}
/* MAKE Innovation: Labor und Werkstatt. Links der Innovations-Check (ein Stehtisch mit Tablet, daneben die Auswertung als Netz und eine Checkliste), in der Mitte der Scoping-Workshop
   (ein Tisch mit Karten und Skizzen, zwei Menschen stecken den Umfang ab, an der Wand der Ablaufplan), rechts die Werkbank des Umsetzungsprojekts (Bildschirme mit Ablauf und Aufbau, ein Prototyp, an dem gebaut wird).
   Gebaut wie MAKE Studios: Boden, Decke und Wand sofort, Möbel als feste Dinge im Grundzustand, davor nur, was dunkel wird, wenn eine Leistung geht (ausDing). Das Produkt des Kunden steht im Prüfstand. */
const INN = { check: [-2.5, 7.3], tisch: [-0.45, 1.5, 6.55, 7.3], bank: [1.85, 3.3, 7.95, 8.75] };
function innovation(F, t, y1, z1) {
  const LV = '167,139,250', LVH = '205,192,255', zw = z1 - 0.07, MX = 3.6, Q = INN, BRD = '#06060c';
  const aC = () => da('innovation', 'check'), aS = () => da('innovation', 'scoping'), aP = () => da('innovation', 'projekt');
  // ── Decke: Kabelrinne, drei Pendelleuchten über den drei Plätzen ──
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.12, y1, z, '#0d0c18');
  poly([[-0.12, y1 - 0.02, 0.4], [0.12, y1 - 0.02, 0.4], [0.12, y1 - 0.02, z1 - 0.3], [-0.12, y1 - 0.02, z1 - 0.3]], '#14121f');
  const lampen = [[-2.5, 7.1], [0.5, 7.0], [2.6, 7.6]];
  linien(lampen.map(([x, z]) => [[x, y1, z], [x, y1 - 0.85, z]]), 'rgba(0,0,0,.7)', lwAt(7.2, 0.012));
  flaechen(lampen.map(([x, z]) => [[x - 0.1, y1 - 0.85, z], [x + 0.1, y1 - 0.85, z], [x + 0.34, y1 - 1.12, z], [x - 0.34, y1 - 1.12, z]]), '#1d1b2e');
  for (const [x, z] of lampen) { fillZ(x - 0.3, x + 0.3, y1 - 1.14, y1 - 1.11, z - 0.01, `rgba(${LVH},.95)`); if (FEIN) glow(x, y1 - 1.16, z, 1.5, [[0, `rgba(${LV},.26)`], [1, `rgba(${LV},0)`]]); }
  if (FEIN) linien([[[0, y1 - 0.03, 0.4], [0, y1 - 0.03, z1 - 0.3]], ...lampen.map(([x, z]) => [[x - 0.34, y1 - 1.12, z - 0.011], [x - 0.1, y1 - 0.85, z - 0.011]])], 'rgba(205,192,255,.16)', 1);
  // ── Boden: geschliffener Beton mit Fugen (zwei Striche, ausgearbeitet einzelne Felder etwas heller oder dunkler), Markierungen um die drei Plätze ──
  { const L = [], R = [], hell = [], dunkel = [];
    for (let x = -6; x <= 6.01; x += 1.2) L.push([[x, 0, 0], [x, 0, z1]]); for (let z = 1.2; z < z1; z += 1.2) R.push([[-6, 0, z], [6, 0, z]]);
    if (FEIN) { for (let i = 0; i < 10; i++) for (let j = 2; j < 8; j++) { const h = hash(i + 3, j * 5 + 2), x = -6 + i * 1.2, z = j * 1.2, f = [[x, 0.001, z], [x + 1.2, 0.001, z], [x + 1.2, 0.001, Math.min(z1, z + 1.2)], [x, 0.001, Math.min(z1, z + 1.2)]]; if (h < 0.3) hell.push(f); else if (h > 0.7) dunkel.push(f); } flaechen(hell, 'rgba(255,255,255,.045)'); flaechen(dunkel, 'rgba(0,0,0,.055)'); }
    linien(L, 'rgba(0,0,0,.2)', 1); linien(R, 'rgba(0,0,0,.17)', 1);
    const w = 0.07, rm = []; for (const [x0, x1, z0, z1b] of [[-3.6, -1.6, 6.2, 8.3], [-0.6, 1.75, 6.0, 8.6], [1.7, 3.5, 6.4, 8.85]]) for (const [a, b, c2, d] of [[x0, x1, z0, z0 + w], [x0, x1, z1b - w, z1b], [x0, x0 + w, z0 + w, z1b - w], [x1 - w, x1, z0 + w, z1b - w]]) rm.push([[a, 0.004, c2], [b, 0.004, c2], [b, 0.004, d], [a, 0.004, d]]);
    flaechen(rm, `rgba(${LV},.55)`); }
  if (FEIN) { bodenlicht(-2.5, 7.2, 1.7, LV, 0.12); bodenlicht(0.5, 7.0, 1.9, WARM, 0.1); bodenlicht(2.6, 7.6, 1.6, LV, 0.12); }
  lichtDing(8.96, () => { const y = 0.008; [[aC, -3.6, -1.6, 6.2, 8.3], [aS, -0.6, 1.75, 6.0, 8.6], [aP, 1.7, 3.5, 6.4, 8.85]].forEach(([a, x0, x1, z0, z1b]) => { const v = 1 - a(); if (v > 0.02) poly([[x0, y, z0], [x1, y, z0], [x1, y, z1b], [x0, y, z1b]], `rgba(0,0,0,${0.16 * v})`); }); });
  // ── Rückwand: Sockel aus Beton, Leuchtlinie, rechts die Lochwand mit Werkzeug ──
  fillZ(-MX, MX, 0, 0.9, zw, 'rgba(8,8,18,.4)'); fillZ(-MX, MX, 0.9, 0.93, zw, `rgba(${LV},.45)`); fillZ(-MX, MX, 2.95, 2.99, zw, `rgba(${LV},.3)`);
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#07070e');
  if (FEIN) { const f = []; for (let x = -MX + 1.2; x < MX - 0.1; x += 1.2) f.push([[x, 0, zw - 0.001], [x, 0.9, zw - 0.001]]); linien(f, 'rgba(0,0,0,.2)', 1); linien([[[-MX, 0.1, zw - 0.001], [MX, 0.1, zw - 0.001]]], 'rgba(0,0,0,.3)', 1); }
  { const lw = rectZ(1.75, 3.55, 1.0, 2.9, zw - 0.005); if (lw) { ctx.fillStyle = 'rgba(8,8,18,.45)'; ctx.fillRect(lw[0], lw[1], lw[2], lw[3]);
    if (FEIN) { ctx.fillStyle = 'rgba(205,192,255,.22)'; const n = 16, m = 10, r = Math.max(0.8, lw[2] * 0.0045); ctx.beginPath(); for (let a = 0; a < n; a++) for (let b = 0; b < m; b++) { const px = lw[0] + (lw[2] * (a + 0.5)) / n, py = lw[1] + (lw[3] * (b + 0.5)) / m; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 7); } ctx.fill(); } } // die Löcher als ein Pfad
    if (FEIN) { const W = flachAn(1.92, 2.3, zw - 0.02); if (W) { W.S([[0, 0.3], [0, -0.05]], '#8a88a0', 0.03); W.E(0, 0.33, 0.05, 0.05, '#8a88a0'); W.R(-0.06, -0.2, 0.12, 0.1, '#5F4BB6'); W.S([[0, -0.2], [0, -0.48]], '#cfcbd9', 0.02); W.S([[-0.06, -0.62], [0.02, -0.92]], '#e8c84a', 0.035); W.S([[0.02, -0.92], [0.02, -1.02]], '#8a88a0', 0.02); ctx.strokeStyle = '#d8d2c8'; ctx.lineWidth = Math.max(1, 0.025 * W.k); ctx.beginPath(); ctx.arc(W.X(1.58), W.Y(-0.75), 0.06 * W.k, 0, 7); ctx.stroke(); } } } // Werkzeug an der Lochwand: Schlüssel, Hammer, Schraubendreher, eine Rolle Band
  // ── der Sockel mit dem Produkt des Kunden steht im Prüfstand: ein Portal mit Messkopf, daneben das Messgerät mit der Kurve ──
  { const [sx0, sx1, sz0, sz1] = INN_SOCKEL, mx = (sx0 + sx1) / 2, pz = sz1 + 0.02;
    ctx.globalCompositeOperation = 'lighter';
    poly([[mx - 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.62, 1.0, sz0 - 0.1], [mx - 0.62, 1.0, sz0 - 0.1]], lg([0, y1, sz1], [0, 1, sz0], [[0, 'rgba(236,226,255,0)'], [0.4, 'rgba(236,226,255,.08)'], [1, 'rgba(236,226,255,.2)']]));
    ctx.globalCompositeOperation = 'source-over';
    if (FEIN) wurf(sx0, sx1, sz0, sz1, 0.5, 0.16);
    else schatten(sx0 - 0.12, sx1 + 0.12, sz0 - 0.16, sz1);
    box(sx0, sx1, 0, 1.0, sz0, sz1, '#d9d2f0', lg([0, 1, sz0], [0, 0, sz0], [[0, '#8f86b8'], [1, '#2e2a48']]), '#463f6c'); fillZ(sx0, sx1, 0.9, 0.94, sz0 - 0.005, `rgba(${LVH},.85)`);
    if (FEIN) bodenlicht(mx, sz0 - 0.2, 0.8, '236,226,255', 0.1); strahler(mx, sz0 - 0.3, y1, 0.9); }
  // ── Wandtafeln (Grundzustand: an): die Auswertung des Checks als Netz, der Ablaufplan des Scopings, der Ablauf des Projekts ──
  tafel(-3.45, -2.1, 1.05, 2.55, zw, TEX.radar, '#3a3849', 1); tafel(-0.4, 1.55, 1.2, 2.65, zw, TEX.plan, '#3a3849', 1);
  { const m = fillZ(2.1, 3.45, 1.42, 2.62, zw - 0.02, BRD); if (m && TEX.flow) { ctx.drawImage(TEX.flow, m[0] + m[2] * 0.02, m[1] + m[3] * 0.035, m[2] * 0.96, m[3] * 0.93); spiegelung(m); } }
  if (FEIN) { glow(-2.75, 1.8, z1 - 0.1, 2.6, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]); glow(0.55, 1.9, z1 - 0.1, 2.6, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]); glow(2.78, 2.0, z1 - 0.1, 2.2, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]); }
  // ── der Prüfstand um den Sockel (Auftrag AA: kräftig und frei sichtbar). Gezeichnet NACH den Tafeln und ihrem Schein: vorher lag die Ablauftafel über dem linken Pfosten, und der Schein wusch das Portal aus.
  //    Portal aus zwei Profilen und Querträger, Messkopf mit Optik, Maßskala, Messgerät mit der Kurve ──
  { const [sx0, sx1, sz0, sz1] = INN_SOCKEL, mx = (sx0 + sx1) / 2, pz = sz1 + 0.02, B = 0.28, H = 2.06, R = ([a, b, c, d], z = pz) => [[mx + a, c, z], [mx + b, c, z], [mx + b, d, z], [mx + a, d, z]];
    flaechen([[-B - 0.05, -B + 0.05, 0, H], [B - 0.05, B + 0.05, 0, H], [-B - 0.1, B + 0.1, H - 0.05, H + 0.07], [-0.11, 0.11, 1.68, H]].map((q) => R(q)), '#0d0c18');  // zwei Pfosten, Querträger, Messkopf: ein Pfad
    fillZ(mx - 0.05, mx + 0.05, 1.6, 1.68, pz - 0.012, '#cfcbd9');                                                                    // die Optik
    if (FEIN) {
      flaechen([[-B - 0.2, -B + 0.07, 0, 0.07], [B - 0.07, B + 0.2, 0, 0.07], [-B - 0.07, -B + 0.07, 0.5, 0.58], [B - 0.07, B + 0.07, 0.5, 0.58], [-B - 0.07, -B + 0.07, 1.5, 1.58], [B - 0.07, B + 0.07, 1.5, 1.58]].map((q) => R(q, pz - 0.001)), '#3a3849'); // Füße und Klemmen
      linien([[[mx - B - 0.035, 0.08, pz - 0.002], [mx - B - 0.035, H - 0.06, pz - 0.002]], [[mx + B - 0.035, 0.08, pz - 0.002], [mx + B - 0.035, H - 0.06, pz - 0.002]], [[mx - B - 0.1, H + 0.062, pz - 0.002], [mx + B + 0.1, H + 0.062, pz - 0.002]], [[mx - 0.11, 1.99, pz - 0.002], [mx + 0.11, 1.99, pz - 0.002]]], 'rgba(214,202,255,.5)', 1); // Lichtkanten an den Profilen
      linien([[[mx - B + 0.05, H - 0.05, pz - 0.001], [mx - 0.11, 1.9, pz - 0.001]], [[mx + B - 0.05, H - 0.05, pz - 0.001], [mx + 0.11, 1.9, pz - 0.001]]], '#0d0c18', lwAt(pz, 0.035)); // zwei Streben zum Messkopf
      const sk = []; for (let i = 0; i <= 10; i++) sk.push([[mx + B + 0.05, 0.66 + i * 0.08, pz - 0.002], [mx + B + 0.05 - (i % 5 ? 0.035 : 0.07), 0.66 + i * 0.08, pz - 0.002]]); linien(sk, 'rgba(236,226,255,.85)', 1); // Maßskala am rechten Pfosten
      roh(() => { ctx.globalCompositeOperation = 'lighter'; poly([[mx - 0.02, 1.6, pz - 0.013], [mx + 0.02, 1.6, pz - 0.013], [mx + 0.1, 1.05, sz0 + 0.19], [mx - 0.1, 1.05, sz0 + 0.19]], 'rgba(205,192,255,.2)'); ctx.globalCompositeOperation = 'source-over'; }); // der Messstrahl
      const g = fillZ(mx - 0.06, mx + 0.46, H + 0.12, H + 0.48, pz - 0.01, BRD); if (g) roh(() => { const U = ui(g); U(0.04, 0.07, 0.92, 0.86, '#12101e'); U(0.08, 0.5, 0.84, 0.012, 'rgba(205,192,255,.25)'); ctx.strokeStyle = '#7fe0a8'; ctx.lineWidth = Math.max(1.2, g[3] * 0.05); ctx.beginPath(); for (let i = 0; i <= 12; i++) { const x = g[0] + g[2] * (0.1 + 0.066 * i), y = g[1] + g[3] * (0.5 - 0.28 * Math.sin(i * 0.9) * Math.exp(-i * 0.09)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); });
      fillZ(mx + 0.17, mx + 0.23, H + 0.07, H + 0.12, pz - 0.009, '#0d0c18');                                                          // das Messgerät sitzt auf dem Querträger
    } }
  [[aC, -3.45, -2.1, 1.05, 2.55, 0], [aS, -0.4, 1.55, 1.2, 2.65, 0], [aP, 2.1, 3.45, 1.42, 2.62, 0.02]].forEach(([a, x0, x1, y0, yo, dz], i) => ausDing(8.99 - i * 0.001, a, [x0, x1, y0, yo, zw - 0.03, zw], (v) => { const r = rectZ(x0, x1, y0, yo, zw - dz); if (r) { ctx.fillStyle = `rgba(6,6,12,${0.7 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } }));
  // ── der Stehtisch des Checks: Tablet, Klemmbrett mit Checkliste; dahinter die Checkliste auf einer Staffelei ──
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
  // ── der Tisch des Scoping-Workshops: Karten, Skizzen, Fäden zwischen den Karten, ein Tablet; ausgearbeitet Stifte, Lineal, eine Planrolle ──
  fest(7.33, [Q.tisch[0] - 0.3, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.95, '#bfb9d6');
    flaechen([[-0.3, 0.3, 6.65, 7.2], [0.45, 1.05, 6.7, 7.15]].map(([a, b, c, d]) => [[a, 0.951, c], [b, 0.951, c], [b, 0.951, d], [a, 0.951, d]]), '#efeaf8');
    const kt = (x, z) => [[x, 0.953, z], [x + 0.14, 0.953, z], [x + 0.14, 0.953, z + 0.18], [x, 0.953, z + 0.18]];
    flaechen([kt(-0.2, 6.8), kt(0.7, 6.95)], '#ffe08a'); flaechen([kt(0.02, 6.95), kt(0.9, 6.78)], '#a78bfa'); flaechen([kt(0.5, 6.78)], '#cdc0ff');
    linien([[[-0.13, 0.955, 6.89], [0.09, 0.955, 7.04]], [[0.09, 0.955, 7.04], [0.57, 0.955, 6.87]], [[0.57, 0.955, 6.87], [0.77, 0.955, 7.04]]], '#5F4BB6', lwAt(7, 0.012));
    box(1.15, 1.4, 0.95, 1.0, 6.75, 7.05, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(-0.4, -0.3, 0.95, 1.05, 6.95, 7.05, '#17469E', '#10357a', '#0d2c66');
    box(0.3, 0.7, 0.95, 0.975, 6.8, 7.1, '#2b2a38', '#1c1b26', '#212030'); roh(() => flach(0.34, 0.66, 6.84, 7.06, 0.977, 'rgb(190,176,246)'));
    if (!FEIN) return;
    linien([[[-0.24, 0.9525, 6.72], [0.2, 0.9525, 6.72]], [[-0.24, 0.9525, 7.12], [0.1, 0.9525, 7.12]], [[0.5, 0.9525, 7.08], [0.98, 0.9525, 7.08]], [[0.36, 0.978, 6.9], [0.6, 0.978, 6.9]], [[0.36, 0.978, 6.98], [0.52, 0.978, 6.98]]], 'rgba(38,36,51,.4)', 1); // Skizzenlinien
    linien([[[1.0, 0.956, 6.62], [1.42, 0.956, 6.68]]], '#e8c84a', lwAt(6.7, 0.03)); linien([[[-0.38, 0.956, 6.7], [-0.3, 0.956, 6.86]]], '#c0342c', lwAt(6.8, 0.014)); linien([[[1.2, 1.03, 6.9], [1.36, 1.03, 6.9]]], '#f6f3ea', lwAt(6.9, 0.06)); // Lineal, Stift, Planrolle
    glow(0.5, 1.0, 6.95, 1.0, [[0, `rgba(${WARM},.14)`], [1, `rgba(${WARM},0)`]]);
  });
  // ── die Werkbank: zwei Bildschirme mit dem Aufbau, ein Gerät im Bau mit drei Lichtern, Lötstation, Sortimentskasten ──
  const zz = 8.5, schirme = [[2.0, 2.65], [2.75, 3.2]];
  fest(8.78, [Q.bank[0] - 0.3, Q.bank[1] + 0.1, 0, 1.56, Q.bank[2] - 0.1, Q.bank[3] + 0.02], () => {
    const [x0, x1, z0, z1b] = Q.bank; tischN(x0, x1, z0, z1b, 0.92, '#4a4660');
    if (FEIN) { fillZ(x0 + 0.1, x1 - 0.1, 0.3, 0.34, z0 + 0.3, '#2b2842'); box(x0 + 0.2, x0 + 0.7, 0.34, 0.6, z0 + 0.15, z0 + 0.5, '#4a4670', '#2b2842', '#3c3858'); box(x0 + 0.8, x0 + 1.15, 0.34, 0.52, z0 + 0.15, z0 + 0.5, '#8a88a0', '#3a3849', '#4a4858'); } // Ablage unter der Platte mit zwei Kisten
    linien(schirme.map(([a, b]) => [[(a + b) / 2, 0.95, zz], [(a + b) / 2, 1.1, zz]]), '#10101a', lwAt(zz, 0.04));
    for (const [a, b] of schirme) { fillZ((a + b) / 2 - 0.13, (a + b) / 2 + 0.13, 0.92, 0.96, zz, '#10101a'); const m = fillZ(a, b, 1.1, 1.1 + (b - a) * 0.66, zz, BRD); if (m && TEX.bau) { ctx.drawImage(TEX.bau, m[0] + m[2] * 0.03, m[1] + m[3] * 0.04, m[2] * 0.94, m[3] * 0.92); spiegelung(m); } }
    box(3.05, 3.25, 0.92, 0.97, 8.05, 8.3, '#2b2a38', '#1c1b26', '#212030'); roh(() => { for (let q = 0; q < 3; q++) fillZ(3.08 + q * 0.06, 3.11 + q * 0.06, 0.97, 1.02, 8.04, ['#c0342c', '#e8c84a', '#4ab87a'][q]); });
    box(1.95, 2.3, 0.92, 0.95, 8.1, 8.3, '#e9e4f3', '#bdb7cf', '#a8a2bc'); linien([[[2.0, 0.95, 8.3], [2.2, 1.1, 8.38]], [[2.2, 1.1, 8.38], [2.4, 0.98, 8.28]]], '#2b2a38', lwAt(8.3, 0.014));
    if (!FEIN) return;
    glow(2.55, 1.35, zz - 0.05, 1.6, [[0, `rgba(${LV},.2)`], [1, `rgba(${LV},0)`]]);
    box(2.72, 2.98, 0.92, 1.0, 8.02, 8.2, '#8a88a0', '#3a3849', '#4a4858'); linien([[[2.78, 0.921, 8.019], [2.78, 1.0, 8.019]], [[2.85, 0.921, 8.019], [2.85, 1.0, 8.019]], [[2.92, 0.921, 8.019], [2.92, 1.0, 8.019]]], 'rgba(0,0,0,.4)', 1); // Sortimentskasten
    { const L = flachAn(1.9, 0.92, 8.2); if (L) { L.R(-0.04, 0, 0.1, 0.05, '#2b2a38'); L.S([[0, 0.05], [0.1, 0.22]], '#8a88a0', 0.014); L.S([[0.1, 0.22], [0.12, 0.26]], '#e8c84a', 0.02); ctx.strokeStyle = '#8a88a0'; ctx.lineWidth = Math.max(1, 0.01 * L.k); ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(L.X(-0.09), L.Y(0.02 + i * 0.03)); ctx.lineTo(L.X(-0.05), L.Y(0.035 + i * 0.03)); } ctx.stroke(); } } // Lötkolben in der Ablage
  });
  ausDing(8.77, aP, [2.0, 3.2, 1.1, 1.54, zz - 0.02, zz + 0.02], (v) => { ctx.fillStyle = `rgba(6,6,12,${0.85 * v})`; for (const [a, b] of schirme) { const r = rectZ(a, b, 1.1, 1.1 + (b - a) * 0.66, zz); if (r) ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  fest(5.05, [1.85, 2.9, 0, 1.05, 4.45, 5.2], () => { // vorn rechts: ein Werkstattwagen mit drei Schubladen
    const x0 = 2.0, x1 = 2.75, z0 = 4.6, z1b = 5.05; if (FEIN) wurf(x0, x1, z0, z1b, 0.9, 0.3); else schatten(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1b + 0.1);
    for (const x of [x0 + 0.06, x1 - 0.1]) fillZ(x, x + 0.04, 0, 0.1, z0, '#0a0a10');
    box(x0, x1, 0.1, 0.95, z0, z1b, '#4a4670', '#3c3858', '#2b2842'); for (let q = 0; q < 3; q++) { fillZ(x0 + 0.04, x1 - 0.04, 0.16 + q * 0.26, 0.36 + q * 0.26, z0 - 0.005, q === 1 ? '#5F4BB6' : '#4a4670'); fillZ(x0 + 0.4, x1 - 0.4, 0.26 + q * 0.26, 0.29 + q * 0.26, z0 - 0.01, '#cfcbd9'); }
    box(x0 + 0.1, x0 + 0.4, 0.95, 1.02, z0 + 0.1, z0 + 0.4, '#5F4BB6', '#3b2a78', '#2e2060');
  });
  tuerDinge('innovation', { zarge: '#08080f', blatt: ['#3d3856', '#2a2640'], griff: `rgba(${LVH},.9)` });
}
/* PR und Kommunikation: eine Redaktion mit Interview-Platz. In der Mitte rechts das Interview (zwei Sessel, ein Mikrofon an einem Galgen, Licht von der Seite, hinten die Presse-Wand, davor eine Kamera auf einem Stativ),
   links die Kartenwand der Positionierung (Karten, Fäden, jemand ordnet die Botschaften), dazwischen die Tür mit dem Aufnahme-Licht. Zeitungen und Magazine liegen als Stapel auf dem Tisch und im Regal, ohne lesbare Titel.
   Gebaut wie MAKE Studios: Boden, Decke und Wand sofort, Möbel und Geräte als feste Dinge im Grundzustand, davor nur, was dunkel wird, wenn eine Leistung geht (ausDing), und das blinkende Aufnahmelicht. */
const PRR = { karten: [-3.5, -1.75], presse: [0.3, 3.3], tisch: [-3.2, -0.8, 5.9, 6.6], kamera: [2.92, 7.42, 1.16], licht: [0.42, 8.55] }; // (das Licht stand bei x = 1,5 genau hinter dem Schild der Leistung)
function pr(F, t, y1, z1) {
  const LV = '167,139,250', LVH = '205,192,255', zw = z1 - 0.07, MX = 3.6, Q = PRR, T = RAUM.pr && RAUM.pr.tuer;
  const aP = () => da('pr', 'pr-kommunikation'), aK = () => da('pr', 'positionierung');
  // ── Decke: Balken ──
  for (let z = 1.8; z < z1; z += 1.8) fillZ(-6, 6, y1 - 0.13, y1, z, '#0e0a1c');
  // ── Boden: Parkett (die langen Fugen zeichnet die Schale, hier die Stöße als ein Strich; ausgearbeitet einzelne Dielen heller oder dunkler, Maserung), ein runder Teppich unter den Sesseln, ein Läufer vor der Kartenwand ──
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
  // ── Rückwand: Sockel, Leuchtlinie ──
  fillZ(-MX, MX, 0, 0.95, zw, 'rgba(8,6,20,.42)'); fillZ(-MX, MX, 0.95, 0.985, zw, `rgba(${LV},.5)`); fillZ(-MX, MX, 2.95, 2.99, zw, `rgba(${LV},.3)`);
  for (const x of [-MX, MX]) fillZ(x - 0.04, x + 0.04, 0, y1, zw - 0.01, '#07060e');
  // die Presse-Wand hinter dem Interview: ein Muster aus Rauten, ohne Schrift (drei Farben, je ein Pfad)
  { const pw = rectZ(Q.presse[0], Q.presse[1], 0.06, 2.62, zw - 0.01); if (pw) { const [rx, ry, rw, rh] = pw; ctx.fillStyle = '#231c48'; ctx.fillRect(rx, ry, rw, rh);
      const nx = 12, ny = 8, dx = rw / nx, dy = rh / ny;
      ['rgba(167,139,250,.75)', 'rgba(205,192,255,.55)', 'rgba(95,75,182,.55)'].forEach((c, n) => { ctx.fillStyle = c; ctx.beginPath();
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) { const cx = rx + (a + 0.5 + (b % 2) * 0.5) * dx, cy = ry + (b + 0.5) * dy; if (cx > rx + rw - dx * 0.2 || ((a + b) % 4 === 0 ? 0 : (a * 3 + b) % 5 === 0 ? 1 : 2) !== n) continue; ctx.moveTo(cx, cy - dy * 0.42); ctx.lineTo(cx + dx * 0.38, cy); ctx.lineTo(cx, cy + dy * 0.42); ctx.lineTo(cx - dx * 0.38, cy); ctx.closePath(); } ctx.fill(); });
      ctx.strokeStyle = '#0c0a1a'; ctx.lineWidth = Math.max(2, rw * 0.012); ctx.strokeRect(rx, ry, rw, rh);
      if (FEIN) { fillZ(Q.presse[0] - 0.06, Q.presse[0], 0, 2.68, zw - 0.02, '#15131f'); fillZ(Q.presse[1], Q.presse[1] + 0.06, 0, 2.68, zw - 0.02, '#15131f'); fillZ(Q.presse[0] - 0.06, Q.presse[1] + 0.06, 2.62, 2.68, zw - 0.02, '#15131f'); } } } // das Gestell der Wand
  // ── die Pinnwand der Positionierung (Grundzustand: voll): Karten und Ausschnitte, mit Nadeln, rote Fäden dazwischen ──
  const kw = fillZ(Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.01, '#2b2548');
  if (kw) { const [rx, ry, rw, rh] = kw, farben = ['#ffe08a', '#cdc0ff', '#f0ece4', '#a78bfa', '#cdc0ff'], pos = [];
    ctx.fillStyle = '#4a3f7a'; ctx.fillRect(rx - 3, ry - 3, rw + 6, 3);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { const j = hash(a * 3 + b, 17); pos.push([0.07 + a * 0.23 + (j - 0.5) * 0.04, 0.1 + b * 0.28 + (hash(b, a + 9) - 0.5) * 0.05, (a + b * 2) % 5]); }
    ctx.strokeStyle = 'rgba(255,120,120,.85)'; ctx.lineWidth = Math.max(1, rw * 0.006); ctx.beginPath(); for (const [a, b] of [[0, 5], [5, 2], [2, 7], [7, 10], [10, 11], [1, 4], [4, 9], [9, 6], [3, 8], [8, 11]]) { ctx.moveTo(rx + (pos[a][0] + 0.08) * rw, ry + (pos[a][1] + 0.03) * rh); ctx.lineTo(rx + (pos[b][0] + 0.08) * rw, ry + (pos[b][1] + 0.03) * rh); } ctx.stroke();
    if (FEIN) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); for (const [u, v] of pos) ctx.rect(rx + (u + 0.008) * rw, ry + (v + 0.012) * rh, rw * 0.16, rh * 0.2); ctx.fill(); } // die Karten heben sich ab
    [0, 1, 2, 3].forEach((n) => { ctx.fillStyle = farben[n]; ctx.beginPath(); for (const [u, v, f] of pos) if (f % 4 === n) ctx.rect(rx + u * rw, ry + v * rh, rw * 0.16, rh * 0.2); ctx.fill(); });
    ctx.fillStyle = 'rgba(30,24,60,.4)'; ctx.beginPath(); pos.forEach(([u, v, f], i) => { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.05) * rh, rw * 0.1, Math.max(1, rh * 0.02)); ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.1) * rh, rw * 0.07, Math.max(1, rh * 0.02));
      if (FEIN && f === 2) { ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.125) * rh, rw * 0.055, rh * 0.06); for (let q = 0; q < 3; q++) ctx.rect(rx + (u + 0.085) * rw, ry + (v + 0.13 + q * 0.02) * rh, rw * 0.06, Math.max(1, rh * 0.008)); } else if (FEIN && i % 3 === 0) ctx.rect(rx + (u + 0.02) * rw, ry + (v + 0.14) * rh, rw * 0.11, Math.max(1, rh * 0.014)); }); ctx.fill(); // Zeilen; die hellen Zettel sind Ausschnitte mit Bild und Spalten
    ctx.fillStyle = '#c0342c'; ctx.beginPath(); for (const [u, v] of pos) { const px = rx + (u + 0.08) * rw, py = ry + (v + 0.03) * rh, r = Math.max(1.2, rw * 0.007); ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 7); } ctx.fill(); }
  if (FEIN) { glow(-2.6, 1.9, z1 - 0.1, 2.8, [[0, `rgba(${LV},.16)`], [1, `rgba(${LV},0)`]]); glow(1.8, 1.9, z1 - 0.1, 3.2, [[0, `rgba(${LV},.16)`], [1, `rgba(${LV},0)`]]); }
  ausDing(8.99, aK, [Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.03, zw], (v) => { const r = rectZ(Q.karten[0], Q.karten[1], 0.95, 2.75, zw - 0.01); if (r) { ctx.fillStyle = `rgba(20,16,38,${0.62 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } });
  // das Aufnahme-Licht über der Tür (Grundzustand: an)
  if (T) { fillZ(T.x0 + 0.2, T.x1 - 0.2, 2.5, 2.58, z1 - 0.06, '#1a1230'); roh(() => fillZ(T.x0 + 0.25, T.x1 - 0.25, 2.52, 2.56, z1 - 0.07, 'rgb(255,96,90)')); if (FEIN) glow((T.x0 + T.x1) / 2, 2.54, z1 - 0.1, 0.9, [[0, 'rgba(255,90,90,.4)'], [1, 'rgba(255,90,90,0)']]);
    ausDing(8.985, aP, [T.x0 + 0.2, T.x1 - 0.2, 2.5, 2.58, z1 - 0.08, z1 - 0.05], (v) => { const r = rectZ(T.x0 + 0.25, T.x1 - 0.25, 2.52, 2.56, z1 - 0.07); if (r) { ctx.fillStyle = `rgba(60,24,30,${0.85 * v})`; ctx.fillRect(r[0], r[1], r[2], r[3]); } }); }
  // ── der Sockel mit dem Produkt des Kunden: im eigenen Licht an der Wand zwischen Tür und Presse-Wand ──
  { const [sx0, sx1, sz0, sz1] = PR_SOCKEL, mx = (sx0 + sx1) / 2;
    ctx.globalCompositeOperation = 'lighter';
    poly([[mx - 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.14, y1 - 0.02, sz1 - 0.1], [mx + 0.6, 1.0, sz0 - 0.1], [mx - 0.6, 1.0, sz0 - 0.1]], lg([0, y1, sz1], [0, 1, sz0], [[0, 'rgba(236,226,255,0)'], [0.4, 'rgba(236,226,255,.08)'], [1, 'rgba(236,226,255,.2)']]));
    ctx.globalCompositeOperation = 'source-over';
    if (FEIN) wurf(sx0, sx1, sz0, sz1, 0.5, 0.16); else schatten(sx0 - 0.12, sx1 + 0.12, sz0 - 0.16, sz1);
    box(sx0, sx1, 0, 1.0, sz0, sz1, '#d9d2f0', lg([0, 1, sz0], [0, 0, sz0], [[0, '#8f86b8'], [1, '#2e2a48']]), '#463f6c'); fillZ(sx0, sx1, 0.9, 0.94, sz0 - 0.005, `rgba(${LVH},.85)`);
    if (FEIN) bodenlicht(mx, sz0 - 0.2, 0.8, '236,226,255', 0.1); strahler(mx, sz0 - 0.3, y1, 0.9); }
  // ── das Licht des Interviews: eine Leuchtfläche auf einem Stativ vor der Presse-Wand ──
  const [lx, lz] = Q.licht, lf = [[lx - 0.36, 1.98, lz], [lx + 0.36, 1.98, lz], [lx + 0.36, 2.4, lz + 0.12], [lx - 0.36, 2.4, lz + 0.12]];
  fest(lz, [lx - 0.45, lx + 0.45, 0, 2.46, lz - 0.35, lz + 0.4], () => {
    stativ(lx, lz + 0.1, 0.5, [[-0.34, 0.12], [0.34, 0.12], [0, -0.32]], 0.03); linien([[[lx, 0.45, lz + 0.1], [lx, 2.1, lz + 0.1]]], '#0a0a10', lwAt(lz, 0.035));
    roh(() => poly(lf, 'rgb(255,244,226)')); ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = lwAt(lz, 0.045); ctx.stroke();
    if (!FEIN) return;
    linien([[[lx - 0.12, 1.98, lz], [lx - 0.12, 2.4, lz + 0.12]], [[lx + 0.12, 1.98, lz], [lx + 0.12, 2.4, lz + 0.12]]], 'rgba(170,130,100,.25)', 1); linien([[[lx, 1.2, lz + 0.1], [lx, 1.27, lz + 0.1]]], '#3a3849', lwAt(lz, 0.06));
    glow(lx, 2.15, lz - 0.1, 1.3, [[0, `rgba(${WARM},.16)`], [1, `rgba(${WARM},0)`]]);
  });
  ausDing(lz - 0.01, aP, [lx - 0.36, lx + 0.36, 1.98, 2.4, lz, lz + 0.12], (v) => poly(lf, `rgba(96,88,92,${0.82 * v})`));
  // ── der Redaktionstisch links: Stapel von Magazinen und Zeitungen, ein Rechner ──
  const stapel = (x, z, n, c, d = 0.4) => { box(x, x + 0.3, 0.75, 0.75 + n * 0.025, z, z + d, c[(n - 1) % c.length], '#2a2442', '#2a2442'); roh(() => { c.forEach((f, i) => { const q = []; for (let m = i; m < n; m += c.length) q.push([[x, 0.75 + m * 0.025, z - 0.001], [x + 0.3, 0.75 + m * 0.025, z - 0.001], [x + 0.3, 0.772 + m * 0.025, z - 0.001], [x, 0.772 + m * 0.025, z - 0.001]]); if (q.length) flaechen(q, f); }); }); }; // die Rücken der Hefte: je Farbe ein Pfad
  fest(6.62, [Q.tisch[0] - 0.3, Q.tisch[1] + 0.12, 0, 1.12, Q.tisch[2] - 0.1, Q.tisch[3] + 0.2], () => {
    const [x0, x1, z0, z1b] = Q.tisch; tischN(x0, x1, z0, z1b, 0.75, '#6a5a9a');
    stapel(-3.1, 6.05, 7, ['#cdc0ff', '#f0ece4', '#a78bfa']); stapel(-2.72, 6.1, 5, ['#ffe08a', '#e6e0f2', '#cdc0ff']);
    laptop(-2.55, 0.75, 6.2, 0.36);
    if (!FEIN) return;
    flaechen([[-1.9, -1.45, 6.05, 6.4], [-1.38, -1.0, 6.1, 6.5]].map(([a, b, c, d]) => [[a, 0.752, c], [b, 0.752, c], [b, 0.752, d], [a, 0.752, d]]), '#f0ece4'); // aufgeschlagene Zeitung
    linien([[[-1.86, 0.753, 6.1], [-1.5, 0.753, 6.1]], [[-1.86, 0.753, 6.2], [-1.5, 0.753, 6.2]], [[-1.86, 0.753, 6.3], [-1.6, 0.753, 6.3]], [[-1.34, 0.753, 6.18], [-1.05, 0.753, 6.18]], [[-1.34, 0.753, 6.3], [-1.05, 0.753, 6.3]]], 'rgba(30,24,60,.4)', 1);
    box(-1.0, -0.92, 0.75, 0.84, 6.05, 6.13, '#e9e4f3', '#bdb7cf', '#a8a2bc'); linien([[[-1.42, 0.756, 6.44], [-1.25, 0.756, 6.52]]], '#c0342c', lwAt(6.4, 0.014));
  });
  // ── das Interview: das Mikrofon an einem Galgen zwischen den Sesseln, ein kleiner Tisch mit Gläsern ──
  fest(7.3, [1.2, 1.8, 0, 1.95, 6.45, 7.25], () => {
    if (FEIN) { fleck(1.5, 7.05, 0.26, 0.22, 0.2, 0.5); fleck(1.5, 6.5, 0.24, 0.1, 0.16); }
    linien([[[1.5, 0, 6.5], [1.5, 1.9, 6.5]]], '#0a0a10', lwAt(6.5, 0.03)); fillZ(1.3, 1.7, 0, 0.04, 6.5, '#0a0a10'); linien([[[1.5, 1.9, 6.5], [1.5, 1.55, 7.05]]], '#0a0a10', lwAt(6.8, 0.025));
    const q = P(1.5, 1.5, 7.05), k = S.f / Math.max(NEAR, 7.05 - cam.z); ctx.fillStyle = '#1b1a28'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.05 * k, 0.07 * k, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(205,192,255,.6)'; ctx.lineWidth = Math.max(1, 0.012 * k); ctx.stroke();
    box(1.35, 1.65, 0, 0.5, 6.9, 7.2, '#8a7ac0', '#3c3270', '#2e2658'); box(1.4, 1.46, 0.5, 0.6, 7.0, 7.06, '#e9e4f3', '#bdb7cf', '#a8a2bc'); box(1.52, 1.58, 0.5, 0.58, 7.05, 7.11, '#e9e4f3', '#bdb7cf', '#a8a2bc');
    if (FEIN) { fillZ(1.35, 1.65, 0.488, 0.5, 6.899, 'rgba(255,255,255,.3)'); linien([[[1.5, 1.9, 6.5], [1.5, 1.96, 6.42]], [[1.5, 0.9, 6.5], [1.5, 0.96, 6.5]]], '#3a3849', lwAt(6.5, 0.05)); }
  });
  fest(6.9, [1.0, 2.05, y1 - 0.5, y1, 6.85, 6.95], () => { strahler(1.1, 6.9, y1, 1); strahler(1.95, 6.9, y1, 1); });
  // ── die Kamera des Interviews: von der Seite, sie zeigt auf das Gespräch ──
  fest(Q.kamera[1], [Q.kamera[0] - 0.55, Q.kamera[0] + 0.6, 0, Q.kamera[2] + 0.62, Q.kamera[1] - 0.3, Q.kamera[1] + 0.46], () => { if (FEIN) fleck(Q.kamera[0], Q.kamera[1] + 0.05, 0.4, 0.3, 0.14, 1.0); kameraSet(Q.kamera[0], Q.kamera[1], Q.kamera[2]); });
  ding(Q.kamera[1] - 0.004, (tt) => { if (aP() < 0.6 || (tt && tt % 1500 >= 900)) return false; const B = flachAn(Q.kamera[0], Q.kamera[2], Q.kamera[1]); if (!B) return false; roh(() => B.R(0.235, 0.225, 0.035, 0.035, '#ff4a32')); return [B.X(0.23), B.Y(0.27), B.X(0.28), B.Y(0.22)]; }); // das Aufnahmelicht blinkt
  fest(4.05, [-2.5, -0.5, 0.68, 0.94, 3.35, 4.1], () => { // ganz vorn: die Kante des Regietischs mit einem Stapel Magazine (bewusster Vordergrund, er steht vor niemandem)
    box(-2.45, -0.55, 0.7, 0.76, 3.4, 4.05, '#6a5a9a', '#2a2250', '#342a62'); fillZ(-2.45, -0.55, 0.735, 0.76, 3.395, `rgba(${LVH},.4)`);
    const c = ['#cdc0ff', '#f0ece4', '#a78bfa', '#ffe08a', '#e6e0f2']; box(-1.3, -0.95, 0.76, 0.9, 3.5, 3.92, c[4], '#2a2442', '#2a2442'); roh(() => c.forEach((f, q) => fillZ(-1.3, -0.95, 0.76 + q * 0.028, 0.786 + q * 0.028, 3.499, f)));
  });
  tuerDinge('pr', { zarge: '#08080f', blatt: ['#3d3856', '#2a2640'], griff: `rgba(${LVH},.9)` });
}
/* Etage mit geschlossener Tür (Podcast): Hinter dem Glas steht eine dunkle Wand, darin eine zweiflügelige Tür, darüber leuchtet das Schild. Der Aufzug hält daneben. */
function tuerZu(F, y1) {
  const z = 0.75, w = rectZ(-6, 6, 0, y1, z); if (!w) return;
  ctx.fillStyle = sgr(0, w[1], 0, w[1] + w[3], [[0, '#0f0f17'], [1, '#191826']]); ctx.fillRect(w[0], w[1], w[2], w[3]);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 1; i < 40; i++) ctx.fillRect(w[0] + (w[2] * i) / 40, w[1], Math.max(1, w[2] * 0.0022), w[3]);
  const tx0 = 0.05, tx1 = 1.95, th = 2.45, d = rectZ(tx0, tx1, 0, th, z - 0.02), r = Math.max(2, d[2] * 0.035);
  { // der Flur (Auftrag Y): Dielenboden, Sockelleiste, Holz bis auf Brüstungshöhe, rechts ein Fenster in die blaue Stunde, dessen Licht über Boden und Wand fällt (links läge es hinter der Tafel)
    const TW = tagWerte(), hz = TW.horizont;
    poly([[-6, 0, 0], [6, 0, 0], [6, 0, z], [-6, 0, z]], '#2a221f'); { const dl = []; for (let x = -5.4; x < 6; x += 0.6) dl.push([[x, 0.002, 0], [x, 0.002, z]]); linien(dl, 'rgba(0,0,0,.3)', 1); }
    fillZ(-6, 6, 0, 1.1, z - 0.004, 'rgba(120,84,58,.16)'); fillZ(-6, 6, 1.1, 1.14, z - 0.006, '#0c0b10'); fillZ(-6, 6, 0, 0.11, z - 0.008, '#0b0a0e');
    const f = rectZ(4.6, 5.85, 0.55, 3.0, z - 0.01);
    if (f) roh(() => { ctx.fillStyle = '#08080d'; ctx.fillRect(f[0] - r * 0.6, f[1] - r * 0.6, f[2] + r * 1.2, f[3] + r * 1.2); ctx.fillStyle = sgr(0, f[1], 0, f[1] + f[3], [[0, '#1a2250'], [0.6, '#4a3c86'], [1, `rgb(${hz})`]]); ctx.fillRect(f[0], f[1], f[2], f[3]);
      ctx.fillStyle = '#08080d'; ctx.fillRect(f[0] + f[2] / 2 - r * 0.2, f[1], r * 0.4, f[3]); ctx.fillRect(f[0], f[1] + f[3] * 0.36, f[2], r * 0.4); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(f[0], f[1], f[2] * 0.12, f[3]); });
    ctx.globalCompositeOperation = 'lighter'; poly([[4.6, 0.004, z - 0.02], [5.85, 0.004, z - 0.02], [4.9, 0.004, 0.02], [3.2, 0.004, 0.02]], 'rgba(150,140,255,.2)'); ctx.globalCompositeOperation = 'source-over';
    glow(5.2, 1.8, z - 0.1, 2.6, [[0, 'rgba(140,130,255,.14)'], [1, 'rgba(140,130,255,0)']]);
    // Garderobenständer mit einem Mantel, daneben ein Stuhl
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
  { const rr = d[2] * 0.085; // Studiotür: je Flügel ein rundes Sichtfenster (dahinter ist es dunkel), unten ein Trittblech, oben der Türschließer
    for (const s of [0.25, 0.75]) { const cx = d[0] + d[2] * s, cy = d[1] + d[3] * 0.3; ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.arc(cx, cy, rr * 1.18, 0, 7); ctx.fill(); ctx.fillStyle = '#12101c'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(205,192,255,.14)'; ctx.beginPath(); ctx.arc(cx - rr * 0.3, cy - rr * 0.3, rr * 0.42, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d3b4e'; ctx.fillRect(d[0] + d[2] * (s - 0.2), d[1] + d[3] * 0.9, d[2] * 0.4, d[3] * 0.07); }
    ctx.fillStyle = '#08080d'; ctx.fillRect(d[0] + d[2] * 0.56, d[1] + d[3] * 0.015, d[2] * 0.3, d[3] * 0.03);
    const a = rectZ(tx0 - 0.62, tx0 - 0.22, th + 0.3, th + 0.62, z - 0.03); // die Aufnahme-Leuchte neben dem Schild: aus (dunkles Rot), solange die Tür zu ist
    if (a) { ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.roundRect(a[0], a[1], a[2], a[3], a[3] * 0.2); ctx.fill(); ctx.fillStyle = '#4a1620'; ctx.beginPath(); ctx.arc(a[0] + a[2] / 2, a[1] + a[3] / 2, a[3] * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(a[0] + a[2] * 0.44, a[1] + a[3] * 0.42, a[3] * 0.1, 0, 7); ctx.fill(); } }
  // das Leuchtschild über der Tür: ein heller Kasten mit dunkler Schrift, sein Licht fällt auf Wand und Tür
  const s = rectZ(tx0 + 0.1, tx1 - 0.1, th + 0.2, th + 0.84, z - 0.06); // zwischen den Pfosten der Fassade, damit nichts die Schrift schneidet
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

/* Tageslicht im Raum: Die Sonne steht rechts hinter der Rückwand, ihr Licht fällt durch deren Fenster auf den Boden, zu uns hin und nach links. Mittags kurz und weiß,
   am Nachmittag lang und warm. Liegt auf der ruhenden Fläche und kostet in Ruhe nichts. */
function sonnenflecken(F, x0, x1, y1, z1, solid) {
  const W = tagWerte(), e = W.sonne; if (e <= 0.02 || W.innen < 0.1) return;
  const off = F.glas ? [[x0, STUDIO.wand, 0.34, 2.98]] : solid ? [] : [[x0, -3.6, 0.1, y1 - 0.1], [3.6, x1, 0.1, y1 - 0.1]]; if (!off.length) return;
  const gold = goldAnteil(TZ), lang = Math.min(3.4, 0.5 / Math.max(0.12, e)), schub = 0.42, st = Math.min(1, W.innen) * (0.3 + 0.34 * smooth((0.5 - e) / 0.4)) * (1 - 0.62 * gold), kl = TON.kl, // in der goldenen Stunde deutlich schwächer (Auftrag Y: kein greller Block)
    rgb = `${Math.round(lerp(255 * W.ton[0], 255, gold))},${Math.round(lerp(250 * W.ton[1], 186, gold))},${Math.round(lerp(238 * W.ton[2], 112, gold))}`, rand = 0.07 + 0.3 * gold; // … und warm: Gold statt Gelbgrün auf dem violetten Boden
  TON.kl = null; ctx.globalCompositeOperation = 'lighter';
  for (const [xa, xb, yu, yo] of off) {
    const za = z1 - yu * lang, zb = Math.max(0.4, z1 - yo * lang);
    for (let x = xa; x < xb - 0.3; x += 2) { const xe = Math.min(xb, x + 2) - 0.1, xs = x + 0.1; // je Feld zwischen zwei Pfosten ein Fleck
      const fl = (m, k) => poly([[xs - m - (z1 - za) * schub, 0.006, za + m], [xe + m - (z1 - za) * schub, 0.006, za + m], [xe + m - (z1 - zb) * schub, 0.006, zb - m], [xs - m - (z1 - zb) * schub, 0.006, zb - m]], lg([0, 0, za], [0, 0, zb], [[0, `rgba(${rgb},${st * k})`], [1, `rgba(${rgb},${st * 0.35 * k})`]]));
      if (FEIN) { fl(rand, 0.42); if (gold > 0.3) fl(rand * 0.45, 0.3); fl(-0.05, gold > 0.3 ? 0.36 : 0.6); } else fl(0, 1); } // ausgearbeitet: weicher Rand aus zwei Lagen (in der goldenen Stunde drei, breiter)
  }
  ctx.globalCompositeOperation = 'source-over'; TON.kl = kl;
}

/* Schattenrisse der Einrichtung je Raum, für den Blick aus der Ferne bei Nacht (Finale). In Metern wie der Raum: ['r', x0, x1, y0, y1] Rechteck · ['k', x, y, Radius] Kreis · ['m', x, sitzt] Mensch.
   Die Stellen folgen den Plätzen in raeume.json und den Möbeln der Raumzeichnungen. */
const SCHATTENRISS = {
  strasse: [['r', 1.7, 4.7, 0, 1.12], ['m', 2.65, 0], ['m', 3.85, 0], ['r', -0.12, 0.52, 0, 1.05], ['k', 0.2, 1.4, 0.32], ['k', 5.25, 1.25, 0.5], ['k', 0.95, 1.2, 0.45], ['r', -2.75, -0.95, 1.42, 3.18], ['r', 0.38, 0.98, 0, 0.42]],
  studios: [['r', -3.35, -2.35, 1.55, 2.5], ['r', -2.89, -2.81, 0, 1.55], ['m', -1.85, 0], ['r', -0.98, -0.58, 1.22, 1.5], ['r', -0.8, -0.76, 0, 1.22], ['m', -0.38, 0], ['r', 0.1, 1.5, 0.7, 0.78], ['r', 0.45, 1.05, 0.92, 1.42], ['m', 0.75, 1], ['k', 1.02, 1.5, 0.24], ['m', 1.6, 0]],
  revenue: [['r', -3.5, -1.35, 0.7, 0.78], ['m', -2.85, 1], ['m', -1.85, 1], ['r', 0.8, 2.6, 0.7, 0.78], ['m', 1.2, 1], ['m', 2.1, 1], ['m', 3.1, 0], ['r', 0.9, 2.7, 1.5, 2.5], ['k', 0.45, 1.25, 0.2], ['r', 0.3, 0.6, 0, 1.0]],
  innovation: [['m', -3.0, 0], ['m', -2.0, 0], ['r', -2.75, -2.25, 0.98, 1.06], ['r', -2.52, -2.48, 0, 1.0], ['r', -0.45, 1.5, 0.86, 0.94], ['m', -0.1, 0], ['m', 0.9, 0], ['r', 1.85, 3.3, 0, 0.9], ['m', 2.35, 1], ['m', 3.3, 0], ['k', 1.6, 1.22, 0.2]],
  pr: [['r', -3.5, -1.75, 1.0, 2.4], ['m', -2.65, 0], ['r', 0.2, 1.1, 0.1, 0.95], ['m', 0.65, 1], ['r', 1.95, 2.85, 0.1, 0.95], ['m', 2.4, 1], ['r', 2.86, 3.24, 1.0, 1.28], ['r', 3.03, 3.07, 0, 1.0], ['k', -0.24, 1.2, 0.2], ['r', -3.2, -0.8, 0.7, 0.78]],
};
/* Ein Etagenraum, von außen durch die Glasfront gesehen; in den Räumen zum Hineingehen auch von innen */
function room(F, t, getrennt = false) {
  oy = F.base; DINGE = [];
  const key = F.key, y1 = F.y1, z1 = F.z1 || 9, x0 = -6, x1 = 6, MX = 3.6, solid = !!F.solid;
  const farF = P(0, 0, z1)[1], farC = P(0, y1, z1)[1], nearF = P(0, 0, 0)[1], nearC = P(0, y1, 0)[1];
  const o0 = P(-6.02, y1 + 0.03, 0), o1 = P(6.02, -0.03, 0);
  const innen = cam.z > -0.4, SC = SCHALE[key] || {}, TW = tagWerte();
  wurfSetzen();
  ctx.save(); tonAn('schale'); if (!innen) { ctx.beginPath(); ctx.rect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); ctx.clip(); } // von außen: nur, was durch die Glasfront zu sehen ist
  if (!innen && o1[1] - o0[1] < 34) { // aus der Ferne ist der Raum ein erleuchtetes Fenster
    tonAus(); if (TW.nacht < 0.98) { ctx.fillStyle = `rgb(${TW.horizont})`; ctx.fillRect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); ctx.fillStyle = 'rgba(40,60,90,.35)'; ctx.fillRect(o0[0], o0[1], o1[0] - o0[0], o1[1] - o0[1]); } // am Tag spiegelt das Glas den Himmel
    if (TW.nacht > 0.02) { // nachts leuchtet jede Etage in ihrer Farbe (Auftrag Y); davor steht die Einrichtung als Schattenriss: ein Pfad je Raum
      const x = o0[0], y = o0[1], w = o1[0] - o0[0], h = o1[1] - o0[1], MK = MARKE[key], rgb = MK ? MK.rgb : LAV; ctx.globalAlpha = TW.nacht;
      if (F.zu) { ctx.fillStyle = 'rgba(46,38,84,.9)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = `rgba(${WARM},.85)`; ctx.fillRect(x + w * 0.51, y + h * 0.16, w * 0.14, h * 0.16); } // die Tür ist zu: nur das Leuchtschild
      else { ctx.fillStyle = sgr(x, 0, x + w, 0, [[0, `rgba(${WARM},.86)`], [0.45, `rgba(${rgb},.74)`], [1, `rgba(${rgb},.5)`]]); ctx.fillRect(x, y, w, h);
        if (h > 7) { const px = (m) => x + ((m + 6) / 12) * w, py = (m) => y + h - (m / y1) * h, k = w / 12; ctx.fillStyle = 'rgba(16,10,30,.6)'; ctx.beginPath();
          for (const [art, a, b, c, d] of SCHATTENRISS[key] || SCHATTENRISS.innovation) {
            if (art === 'r') ctx.rect(px(a), py(d), (b - a) * k, py(c) - py(d));
            else if (art === 'k') { ctx.moveTo(px(a) + c * k, py(b)); ctx.arc(px(a), py(b), c * k, 0, 7); }
            else { const s = b ? 0.45 : 0, o = b ? 1.22 : 1.45; ctx.rect(px(a - 0.2), py(o), 0.4 * k, py(s) - py(o)); ctx.moveTo(px(a) + 0.14 * k, py(o + 0.17)); ctx.arc(px(a), py(o + 0.17), 0.14 * k, 0, 7); if (b) ctx.rect(px(a - 0.26), py(0.5), 0.52 * k, py(0) - py(0.5)); } // ein Mensch: steht (b = 0) oder sitzt (b = 1)
          }
          ctx.fill(); } }
      ctx.globalAlpha = 1; }
    ctx.restore(); oy = 0; return;
  }
  if (F.zu) { tuerZu(F, y1); tonAus(); ctx.restore(); oy = 0; return; } // die Tür ist zu: kein Raum dahinter
  if (!solid) { fillZ(x0, -MX, 0, y1, z1, 'rgba(18,14,40,.22)'); fillZ(MX, x1, 0, y1, z1, 'rgba(18,14,40,.22)'); }
  poly([[x0, 0, 0], [x0, 0, z1], [x0, y1, z1], [x0, y1, 0]], 'rgba(18,14,40,.18)');
  // Decke mit zwei Lichtfugen
  poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, z1], [x0, y1, z1]], sgr(0, farC, 0, nearC, F.glas ? [[0, '#231a1b'], [0.4, '#130e0f'], [1, '#080606']] : SC.decke || [[0, '#282734'], [0.4, '#15151d'], [1, '#09090d']]));
  for (const cx of [-3, 3]) {
    ctx.globalCompositeOperation = 'lighter';
    poly([[cx - 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, 0.3], [cx + 0.55, y1 - 0.005, z1 - 0.3], [cx - 0.55, y1 - 0.005, z1 - 0.3]], `rgba(${WARM},.06)`);
    ctx.globalCompositeOperation = 'source-over';
    poly([[cx - 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, 0.3], [cx + 0.05, y1 - 0.01, z1 - 0.3], [cx - 0.05, y1 - 0.01, z1 - 0.3]], F.glas ? '#c9a48a' : F.dark ? '#8f8aa3' : '#fff2e2');
  }
  // Boden
  poly([[x0, 0, 0], [x1, 0, 0], [x1, 0, z1], [x0, 0, z1]], sgr(0, farF, 0, nearF, F.glas ? [[0, '#4a3a36'], [0.35, '#2a201e'], [1, '#110c0c']] : F.dark ? [[0, '#2f2e3b'], [0.4, '#1b1a24'], [1, '#0d0d12']] : key === 'strasse' ? [[0, '#54483f'], [0.4, '#2e2622'], [1, '#130f0d']] : SC.boden || [[0, '#4d4b5d'], [0.3, '#2d2c3a'], [1, '#14141b']]));
  if (key !== 'strasse' && !SC.fliesen && !F.glas) { const d = []; for (let x = x0 + 0.6; x < x1; x += 0.6) d.push([[x, 0, 0], [x, 0, z1]]); linien(d, 'rgba(0,0,0,.2)', 1); } // Dielenfugen als ein Strich (das Studio zeichnet seinen Boden selbst: dielen)
  if (!solid) { // der violette Horizont spiegelt sich vor den Fenstern im Boden
    const hz = TW.nacht > 0.98 ? '150,120,245' : TW.horizont; // der Horizont spiegelt sich vor den Fenstern im Boden: nachts violett, am Tag die Farbe des Himmels
    poly([[x0, 0, z1], [-MX, 0, z1], [-MX, 0, 4], [x0, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, `rgba(${hz},.36)`], [1, `rgba(${hz},0)`]]));
    poly([[MX, 0, z1], [x1, 0, z1], [x1, 0, 4], [MX, 0, 4]], lg([0, 0, z1], [0, 0, 4], [[0, `rgba(${hz},.36)`], [1, `rgba(${hz},0)`]]));
  }
  // rechte Wand
  const wxF = P(x1, 0, z1)[0], wxN = P(x1, 0, 0)[0];
  poly([[x1, 0, 0], [x1, 0, z1], [x1, y1, z1], [x1, y1, 0]], sgr(wxF, 0, wxN, 0, F.glas ? [[0, '#2a1d1c'], [1, '#0e0a0a']] : F.dark ? [[0, '#1f1e29'], [1, '#0b0b10']] : key === 'strasse' ? [[0, '#43372f'], [0.3, '#2a221e'], [1, '#100c0b']] : SC.wandR || [[0, '#383644'], [0.3, '#24232e'], [1, '#0e0e13']]));
  { const d = []; for (let z = 0.5; z < z1; z += 0.5) d.push([[x1, 0, z], [x1, y1, z]]); linien(d, 'rgba(0,0,0,.22)', 1); }
  if (key !== 'strasse') { poly([[x1, 0, 0], [x1, 0, z1], [x1, 0.1, z1], [x1, 0.1, 0]], F.glas ? '#4a3a3a' : '#4a4858'); seg([x1, 0.1, 0], [x1, 0.1, z1], 'rgba(0,0,0,.35)', 1); seg([x1, 0, 0], [x1, 0, z1], 'rgba(0,0,0,.4)', 1.5); } // Sockelleiste an der rechten Wand, darunter die Schattenfuge zum Boden
  // Rückwand
  const bx0 = solid ? x0 : -MX, bx1 = solid ? x1 : MX, mw = F.glas ? null : rectZ(bx0, bx1, 0, y1, z1 - 0.02);
  if (F.glas) { // Rückwand aus Glas: Sockel, Sturz mit Lichtband, Pfosten; dahinter steht die Stadt (sie ist schon gezeichnet), im Glas liegt ein wenig warmes Licht des Raums
    const gx = STUDIO.wand, zw = z1 - 0.02; // bis hier Glas, rechts davon der Kern des Hauses mit der Tür zum Flur
    fillZ(x0, gx, 2.98, y1, zw, '#0b090c');
    const gl = rectZ(x0, gx, 0.34, 2.98, zw);
    if (gl) { ctx.fillStyle = sgr(0, gl[1], 0, gl[1] + gl[3], [[0, 'rgba(10,7,16,.5)'], [0.6, 'rgba(18,9,18,.34)'], [1, 'rgba(60,24,20,.4)']]); ctx.fillRect(gl[0], gl[1], gl[2], gl[3]); }
    if (FEIN && innen) { // ausgearbeitet: das Glas spiegelt (zwei schräge Lichtbahnen je Feld), am Tag liegt Dunst vor der Stadt
      const b = []; for (const [xa, xb] of STUDIO.felder) { const w = xb - xa; if (w < 1) continue; b.push([[xa + w * 0.12, 0.34, zw], [xa + w * 0.3, 0.34, zw], [xa + w * 0.62, 2.98, zw], [xa + w * 0.44, 2.98, zw]], [[xa + w * 0.38, 0.34, zw], [xa + w * 0.44, 0.34, zw], [xa + w * 0.76, 2.98, zw], [xa + w * 0.7, 2.98, zw]]); }
      const kl = TON.kl; TON.kl = null; ctx.globalCompositeOperation = 'lighter'; flaechen(b, `rgba(255,255,255,${0.05 + 0.05 * Math.min(1, TW.innen)})`); ctx.globalCompositeOperation = 'source-over'; TON.kl = kl;
    }
    // Brüstung mit Fensterbank: die Deckfläche liegt im Licht des Fensters
    fillZ(x0, gx, 0, 0.34, zw - 0.2, '#1b1316'); poly([[x0, 0.34, zw], [gx, 0.34, zw], [gx, 0.34, zw - 0.2], [x0, 0.34, zw - 0.2]], '#5a4644');
    for (let x = x0; x < gx - 0.3; x += 2) fillZ(x - 0.045, x + 0.045, 0.34, 2.98, z1 - 0.03, '#07070c');
    fillZ(x0, gx, 2.2, 2.25, z1 - 0.03, '#07070c'); // Kämpfer: darüber die Oberlichter
    fillZ(x0, gx, 2.94, 2.98, z1 - 0.04, `rgba(${MARKE[key].rgb},.9)`);
    if (FEIN) {
      glow(-1, 2.96, z1 - 0.1, 2.6, [[0, `rgba(${MARKE[key].rgb},.09)`], [1, `rgba(${MARKE[key].rgb},0)`]]);
      const k = [], f = []; for (let x = x0; x < gx - 0.3; x += 2) { k.push([[x - 0.045, 0.34, z1 - 0.031], [x - 0.045, 2.98, z1 - 0.031]]); f.push([[x + 0.6, 0, zw - 0.201], [x + 0.6, 0.33, zw - 0.201]], [[x + 1.4, 0, zw - 0.201], [x + 1.4, 0.33, zw - 0.201]]); }
      linien(k, 'rgba(255,236,214,.2)', 1); linien([[[x0, 2.25, z1 - 0.031], [gx, 2.25, z1 - 0.031]], [[x0, 0.34, zw - 0.2], [gx, 0.34, zw - 0.2]]], 'rgba(255,236,214,.22)', 1); // Lichtkanten an Pfosten, Kämpfer und Fensterbank
      linien(f, 'rgba(0,0,0,.3)', 1); linien([[[x0, 0.1, zw - 0.201], [gx, 0.1, zw - 0.201]]], 'rgba(0,0,0,.35)', 1);  // Fugen der Brüstung, Sockel
    }
    const kw = rectZ(gx, x1, 0, y1, zw);
    if (kw) { ctx.fillStyle = sgr(0, kw[1], 0, kw[1] + kw[3], [[0, '#1c1414'], [0.5, '#35282a'], [1, '#2a1f20']]); ctx.fillRect(kw[0], kw[1], kw[2], kw[3]);
      const d = []; for (let x = gx + 0.375; x < x1; x += 0.375) d.push([[x, 0, z1 - 0.025], [x, y1, z1 - 0.025]]); linien(d, 'rgba(0,0,0,.22)', Math.max(1, (0.02 * S.f) / Math.max(1, z1 - cam.z))); // Paneelfugen als ein Strich
      if (FEIN) { fillZ(gx, x1, 0, 0.1, z1 - 0.026, '#4a3a3a'); linien([[[gx, 0.1, z1 - 0.027], [x1, 0.1, z1 - 0.027]], [[gx, 2.4, z1 - 0.027], [x1, 2.4, z1 - 0.027]]], 'rgba(0,0,0,.3)', 1);
        fillZ(4.32, 4.42, 1.05, 1.2, z1 - 0.027, '#8a8088'); } // Sockelleiste, Querfuge, Lichtschalter neben der Tür
    }
    fillZ(gx - 0.06, gx + 0.06, 0, y1, z1 - 0.03, '#0a0809');
  }
  if (mw) {
    ctx.fillStyle = sgr(0, mw[1], 0, mw[1] + mw[3], F.dark ? [[0, '#0d0d14'], [1, '#17161f']] : key === 'strasse' ? [[0, '#1d1716'], [0.55, '#2b211d'], [1, '#3a2c25']] : SC.rueck || [[0, '#1c1b27'], [0.7, '#23212f'], [1, '#2a2838']]); ctx.fillRect(mw[0], mw[1], mw[2], mw[3]);
    if (key !== 'strasse' && key !== 'revenue' && !F.dark) { fillZ(bx0, bx1, 0, 0.1, z1 - 0.025, '#4a4858'); fillZ(bx0, bx1, 0.1, 0.112, z1 - 0.025, 'rgba(0,0,0,.3)'); } // Sockelleiste an der Rückwand
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
  // der Schacht läuft durch
  for (const x of [SHAFT.x0, SHAFT.x1]) seg([x, 0, SHAFT.z], [x, y1, SHAFT.z], `rgba(${LAV},.3)`, 1);
  tonAus(); sonnenflecken(F, x0, x1, y1, z1, solid);
  if (!getrennt) vornMalen(key, t); // Möbel, Menschen und Kern nach Tiefe (getrennt: das macht drawScene, vor der fertigen Fläche)
  ctx.restore(); oy = 0;
}

/* Der Empfang (Erdgeschoss, später Vormittag; Auftrag Y: ausgearbeitet wie die Räume). Die Halle ruht wie ein Raum (ruheSchluessel): Alles, was steht, liegt auf der ruhenden Fläche,
   die Möbel als feste Dinge OHNE Kasten (sie werden nie nachgezogen); lebendig sind nur die zwei am Tresen. Damit sie nichts übermalen, werden sie über der hinteren Kante der Tresenplatte
   abgeschnitten, und was auf dem Tresen steht, steht neben ihnen (EG). Von der Straße aus zeichnet dieselbe Funktion die Halle hinter Glas. */
const EG = { leuchte: [-2.4, 4.5, 4.48, 8.6], tresen: [1.7, 4.7, 7.7, 8.6, 1.12], schild: [1.75, 4.65, 1.15, 3.05], weg: [-2.75, -0.95, 1.42, 3.18], sessel: [[-0.15, 1], [1.5, -1]], tisch: [0.68, 6.95], schirm: [1.84, 2.22], blumen: 4.46, leute: [['emil', 2.65, 168], ['hanna', 3.85, 196]] };
const ETAGEN_TAFEL = () => FLOORS.slice().reverse().map((F) => { const R = RAEUME.find((r) => r.zeichnung === F.key); return { kurz: F.roof ? 'Dach' : F.n === 0 ? 'EG' : F.id.slice(1), name: R ? R.name : '', farbe: F.akz || AKZ.lav, hier: F.n === 0 }; }); // die Etagen wie in der Leiste, die Namen aus raeume.json (nichts Erfundenes)
function empfang(F, t, y1, z1) {
  const N = { top: '#6a5d54', front: '#261f1c', side: '#302723' }, x0 = -6, x1 = 6, zw = z1 - 0.03, TW = tagWerte(), [tx0, tx1, tz0, tz1, th] = EG.tresen;
  const shade = (xa, xb, za, zb) => poly([[xa, 0.008, za], [xb, 0.008, za], [xb, 0.008, zb], [xa, 0.008, zb]], 'rgba(0,0,0,.36)');
  // ── Rückwand: Holz in breiten Feldern mit Lamellen, eine Lichtfuge in der Farbe des Hauses, eine warme Fuge darunter ──
  for (let x = -6; x < 6; x += 1.5) { const r = rectZ(x, x + 0.03, 0, y1, z1 - 0.025); if (r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(r[0], r[1], Math.max(1, r[2]), r[3]); } }
  { const w = rectZ(x0, x1, 0, y1, zw); if (w) { ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 1; i < 30; i++) ctx.fillRect(w[0] + (w[2] * i) / 30, w[1], Math.max(1, w[2] * 0.004), w[3]);
    if (FEIN) { for (let i = 0; i < 60; i++) { const r = hash(i, 7); if (r > 0.4) continue; ctx.fillStyle = r < 0.18 ? 'rgba(255,236,214,.045)' : 'rgba(0,0,0,.075)'; ctx.fillRect(w[0] + (w[2] * i) / 60, w[1], w[2] / 60 + 0.5, w[3]); } // einzelne Lamellen heller oder dunkler
      ctx.fillStyle = sgr(0, w[1], 0, w[1] + w[3], [[0, 'rgba(0,0,0,.2)'], [0.4, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(w[0], w[1], w[2], w[3]); } } } // oben wird die Wand ruhiger
  fillZ(-6, 6, 3.9, 3.96, zw, `rgba(${LAVH},.55)`); glow(1.5, 3.93, z1 - 0.1, 4.2, [[0, `rgba(${LAV},.1)`], [1, `rgba(${LAV},0)`]]);
  fillZ(-6, 6, 0, 0.14, zw, '#120e0c');
  fillZ(x0, x1, 3.3, 3.36, z1 - 0.04, `rgba(${WARM},.75)`); glow(0, 3.33, z1 - 0.04, 5.5, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
  // ── die obere Wandhälfte: eine lange Leuchte hängt an vier Seilen vor den Lamellen, ihr Licht liegt weich auf der Wand (Auftrag AA: keine leere Wand, keine neuen Worte) ──
  { const [la, lb, ly, lz] = EG.leuchte;
    linien([0.06, 0.36, 0.64, 0.94].map((u) => [[la + (lb - la) * u, ly + 0.05, lz], [la + (lb - la) * u, y1, lz]]), '#0a0a10', 1);
    if (FEIN && !NACHZUG) roh(() => { const r = rectZ(la - 0.9, lb + 0.9, ly - 1.25, ly + 1.0, zw - 0.002); if (r) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sgr(0, r[1], 0, r[1] + r[3], [[0, `rgba(${WARM},0)`], [0.42, `rgba(${WARM},.13)`], [0.5, `rgba(${WARM},.16)`], [1, `rgba(${WARM},0)`]]); ctx.fillRect(r[0], r[1], r[2], r[3]); ctx.globalCompositeOperation = 'source-over'; } }); // der Schein auf der Wand
    fillZ(la, lb, ly, ly + 0.07, lz, '#2a2622'); roh(() => fillZ(la + 0.02, lb - 0.02, ly - 0.022, ly + 0.012, lz - 0.001, '#fff2e2'));                                                      // das Profil, darunter die leuchtende Fläche
    if (FEIN) { fillZ(la, lb, ly + 0.06, ly + 0.07, lz - 0.001, 'rgba(255,236,214,.25)'); glow((la + lb) / 2, ly - 0.05, lz, 1.5, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]); } }
  // ── Boden: große Steinplatten, Fugen als zwei Striche; ausgearbeitet einzelne Platten heller oder dunkler ──
  { const q = [], l = []; for (let z = 2; z < z1; z += 2) q.push([[-6, 0.002, z], [6, 0.002, z]]); for (let x = -6; x <= 6; x += 2) l.push([[x, 0.002, 0], [x, 0.002, z1]]); linien(q, 'rgba(0,0,0,.2)', 1); linien(l, 'rgba(0,0,0,.16)', 1);
    if (FEIN) { const hell = [], dunkel = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { const r = hash(i * 7 + j, 31); if (r > 0.36) continue; const xa = -6 + i * 2 + 0.02, za = j * 2 + 0.02; (r < 0.16 ? hell : dunkel).push([[xa, 0.003, za], [xa + 1.96, 0.003, za], [xa + 1.96, 0.003, za + 1.96], [xa, 0.003, za + 1.96]]); }
      flaechen(dunkel, 'rgba(0,0,0,.05)'); flaechen(hell, 'rgba(255,240,222,.035)'); } }
  bodenlicht(3.2, 6.6, 3.2, WARM, 0.14); bodenlicht(PED.x, PED.z, 1.6, LAVH, 0.12); bodenlicht(0.7, 6.9, 2.2, WARM, 0.1);
  ctx.globalCompositeOperation = 'lighter'; // schwache Spiegelung im Boden: das Wandlicht
  poly([[x0, 0.004, z1], [x1, 0.004, z1], [x1, 0.004, z1 - 4.4], [x0, 0.004, z1 - 4.4]], lg([0, 0, z1], [0, 0, z1 - 4.4], [[0, `rgba(${WARM},.11)`], [1, `rgba(${WARM},0)`]]));
  ctx.globalCompositeOperation = 'source-over';
  if (FEIN && !NACHZUG) { // die Lamellen und das Schild spiegeln sich matt im Stein
    const b = []; for (let i = 0; i < 30; i += 2) { const x = -6 + (12 * i) / 30; b.push([[x, 0.004, z1], [x + 0.2, 0.004, z1], [x + 0.2, 0.004, z1 - 1.6], [x, 0.004, z1 - 1.6]]); }
    roh(() => { ctx.globalCompositeOperation = 'lighter'; flaechen(b, 'rgba(255,236,214,.03)'); poly([[EG.schild[0], 0.004, z1], [EG.schild[1], 0.004, z1], [EG.schild[1], 0.004, tz1 + 0.1], [EG.schild[0], 0.004, tz1 + 0.1]], lg([0, 0, z1], [0, 0, tz1], [[0, 'rgba(236,230,255,.1)'], [1, 'rgba(236,230,255,0)']])); ctx.globalCompositeOperation = 'source-over'; });
  }
  // ── Lichtfelder vom Eingang: Das Tageslicht fällt durch die Glasfront hinter uns in die Halle, je Feld zwischen zwei Pfosten ein Feld am Boden; es wandert nach links hinten (die Sonne steht rechts) ──
  if (TW.innen > 0.1 && TW.sonne > 0.02 && !NACHZUG) {
    // (Auftrag AA: keine harten weißen Trapeze mehr. Warm, rund ein Drittel so stark, der Rand in drei Stufen weich, zum Ende hin laufen die Felder aus)
    const lang = Math.min(6.4, 2.9 / Math.max(0.2, TW.sonne)), st = Math.min(1, TW.innen) * 0.3, rgb = `${Math.round(255 * TW.ton[0])},${Math.round(226 * TW.ton[1])},${Math.round(186 * TW.ton[2])}`, s = 0.26;
    const stufe = (e) => { const a = [], L = lang + e * 2; for (let x = -6; x < 6; x += 2) { const xa = x + 0.14 - e, xb = x + 1.86 + e; a.push([[xa, 0.006, 0.05], [xb, 0.006, 0.05], [xb - L * s, 0.006, L], [xa - L * s, 0.006, L]]); } return a; };
    const aus = (a) => lg([0, 0.006, cam.z + 0.7], [-lang * s, 0.006, Math.max(cam.z + 1.5, lang + 0.4)], [[0, `rgba(${rgb},${a})`], [0.5, `rgba(${rgb},${a * 0.62})`], [1, `rgba(${rgb},0)`]]);
    roh(() => { ctx.globalCompositeOperation = 'lighter'; if (FEIN) { flaechen(stufe(0.34), aus(st * 0.09)); flaechen(stufe(0.15), aus(st * 0.11)); flaechen(stufe(-0.06), aus(st * 0.14)); } else flaechen(stufe(0.1), `rgba(${rgb},${st * 0.22})`); ctx.globalCompositeOperation = 'source-over'; });
  }
  const lamps = [[0.7, 6.9, 0.3], [3.2, 8.1, 0.3], [PED.x, PED.z, 0.5]];
  for (const [x, z, on] of lamps) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 0.9, 0.005, z - 0.8], [x + 0.9, 0.005, z - 0.8], [x + 0.7, 0.005, z + 0.8], [x - 0.7, 0.005, z + 0.8]], `rgba(${WARM},${on * 0.11})`); ctx.globalCompositeOperation = 'source-over'; }
  // ── an der Wand hinter dem Tresen: die leuchtende Tafel mit dem Zeichen des Hauses (nur Formen, wie bisher) ──
  const ra = rectZ(EG.schild[0], EG.schild[1], EG.schild[2], EG.schild[3], z1 - 0.05);
  if (ra) {
    if (FEIN && !NACHZUG) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(ra[0] + ra[2] * 0.012, ra[1] + ra[3] * 0.03, ra[2], ra[3]); } // die Tafel steht vor der Wand ab
    ctx.fillStyle = 'rgba(246,244,240,.07)'; ctx.fillRect(ra[0], ra[1], ra[2], ra[3]);
    if (FEIN) roh(() => { ctx.fillStyle = sgr(0, ra[1], 0, ra[1] + ra[3], [[0, 'rgba(255,255,255,.1)'], [0.5, 'rgba(255,255,255,.02)'], [1, 'rgba(120,90,220,.08)']]); ctx.fillRect(ra[0], ra[1], ra[2], ra[3]); });
    ctx.fillStyle = '#8B5CF6'; ctx.beginPath(); ctx.arc(ra[0] + ra[2] * 0.3, ra[1] + ra[3] * 0.5, ra[3] * 0.2, 0, 7); ctx.fill();
    if (FEIN) roh(() => { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(ra[0] + ra[2] * 0.3 - ra[3] * 0.06, ra[1] + ra[3] * 0.5 - ra[3] * 0.07, ra[3] * 0.085, 0, 7); ctx.fill(); });
    ctx.fillStyle = pale(0.7); ctx.fillRect(ra[0] + ra[2] * 0.48, ra[1] + ra[3] * 0.4, ra[2] * 0.36, ra[3] * 0.07); ctx.fillStyle = pale(0.35); ctx.fillRect(ra[0] + ra[2] * 0.48, ra[1] + ra[3] * 0.55, ra[2] * 0.24, ra[3] * 0.05);
    ctx.strokeStyle = '#07070c'; ctx.lineWidth = Math.max(2, ra[2] * 0.018); ctx.strokeRect(ra[0], ra[1], ra[2], ra[3]);
    if (FEIN) { ctx.strokeStyle = `rgba(${WARM},.35)`; ctx.lineWidth = 1; ctx.strokeRect(ra[0] + ra[2] * 0.012, ra[1] + ra[2] * 0.012, ra[2] * 0.976, ra[3] - ra[2] * 0.024); }
  }
  glow(3.2, 3.2, z1 - 0.1, 3.4, [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]]);
  // ── der Wegweiser: eine dunkle Tafel mit den Etagen des Hauses (Namen aus den Daten); einfach nur Balken, ausgearbeitet mit Schrift ──
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
  // ── die Pendelleuchten ──
  for (const [x, z, on] of lamps) { fillZ(x - 0.015, x + 0.015, 4.75, y1, z, '#0a0a10'); fillZ(x - 0.26, x + 0.26, 4.45, 4.75, z, '#fff2e2'); glow(x, 4.5, z, 1.9, [[0, `rgba(${WARM},${on})`], [1, `rgba(${WARM},0)`]]);
    if (FEIN) { poly([[x - 0.26, 4.5, z], [x + 0.26, 4.5, z], [x + 0.12, 4.78, z], [x - 0.12, 4.78, z]], '#2a2622'); fillZ(x - 0.26, x + 0.26, 4.45, 4.5, z - 0.001, '#fff6e8'); } }
  // ── die zwei am Empfang (erfunden, wie alle im Haus): Sie reden abwechselnd. Gezeichnet nur über der hinteren Kante der Tresenplatte: So übermalen sie den Tresen nicht ──
  ding(9.1, () => {
    const tt = reduce ? 0 : t, a = FIG.steh(tt ? gewichtVon(EG_TAKT[0], tt, 0.4) : 0.4, 'haengt', 'haelt'), b = FIG.steh(tt ? gewichtVon(EG_TAKT[1], tt, -0.4) : -0.4, 'spricht', 'haengt'); if (tt) { regen(a, tt, EG_TAKT[0]); regen(b, tt, EG_TAKT[1]); }
    const yk = P(0, th, tz1)[1], l = P(EG.leute[0][1] - 0.6, 2.0, 9.1), r = P(EG.leute[1][1] + 0.6, 2.0, 9.1);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.w, yk); ctx.clip();
    stelleRuhig('emil', tt, menschVon('emil', AKZ.lav), a, EG.leute[0][1], 0, 9.1, rad(EG.leute[0][2]), LICHT.halle, { r: 'tablet' }); stelleRuhig('hanna', tt, menschVon('hanna', AKZ.lav), b, EG.leute[1][1], 0, 9.1, rad(EG.leute[1][2]), LICHT.halle);
    ctx.restore(); return [l[0], l[1], r[0], yk];
  });
  fest(8.9, null, () => { pflanze(5.25, 8.7, true, 1.25); pflanze(0.95, 8.75, true, 1.1); });
  // ── der Tresen: Front aus Holzlamellen auf einem zurückgesetzten Sockel, Platte aus hellem Stein mit Lichtfuge darunter; darauf ein Bildschirm (von hinten) und Blumen, neben den beiden ──
  fest(tz1, null, () => {
    shade(tx0 - 0.1, tx1 + 0.1, tz0 - 0.2, tz1 + 0.1);
    box(tx0, tx1, 0, th, tz0, tz1, '#66666c', lg([0, th, tz0], [0, 0, tz0], [[0, '#303035'], [1, '#18181b']]), N.side);
    fillZ(tx0, tx1, 0.99, 1.05, tz0 - 0.01, `rgba(${WARM},.75)`); fillZ(tx0, tx1, 0.02, 0.07, tz0 - 0.01, `rgba(${WARM},.3)`);
    if (!FEIN) return;
    const zf = tz0 - 0.012, f = [];
    fillZ(tx0, tx1, 0.07, 0.99, zf, lg([0, 0.99, zf], [0, 0.07, zf], [[0, '#4a3628'], [1, '#2c1f17']])); // Holzfront
    for (let x = tx0 + 0.1; x < tx1; x += 0.1) f.push([[x, 0.07, zf - 0.001], [x, 0.99, zf - 0.001]]); linien(f, 'rgba(0,0,0,.26)', 1);
    { const hl = []; for (let x = tx0 + 0.05; x < tx1; x += 0.3) hl.push([[x, 0.07, zf - 0.001], [x, 0.99, zf - 0.001]]); linien(hl, 'rgba(255,226,196,.07)', 1); }
    fillZ(tx0 - 0.05, tx1 + 0.05, 1.05, th, tz0 - 0.07, '#8a8580'); poly([[tx0 - 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz1], [tx0 - 0.05, th, tz1]], lg([0, th, tz0], [0, th, tz1], [[0, '#77736f'], [1, '#8f8a84']])); // die Platte aus Stein steht vorn über
    seg([tx0 - 0.05, th, tz0 - 0.07], [tx1 + 0.05, th, tz0 - 0.07], 'rgba(255,246,230,.4)', 1);
    if (!NACHZUG) glow((tx0 + tx1) / 2, 1.02, tz0 - 0.05, 1.9, [[0, `rgba(${WARM},.1)`], [1, `rgba(${WARM},0)`]]);
    { const [sa, sb] = EG.schirm, zs = 8.22; // Bildschirm von hinten: schmaler Rahmen, Fuß, eine Lichtkante
      fillZ((sa + sb) / 2 - 0.04, (sa + sb) / 2 + 0.04, th, th + 0.14, zs + 0.02, '#0c0c12'); fillZ((sa + sb) / 2 - 0.11, (sa + sb) / 2 + 0.11, th, th + 0.02, zs - 0.05, '#0c0c12');
      fillZ(sa, sb, th + 0.12, th + 0.38, zs, '#15151c'); fillZ(sa, sb, th + 0.365, th + 0.38, zs - 0.001, 'rgba(255,246,230,.3)'); fillZ(sa + 0.14, sb - 0.14, th + 0.2, th + 0.3, zs - 0.001, '#1f1f28'); }
    { const bx = EG.blumen, zb = 8.12, o = P(bx, th + 0.3, zb), k = S.f / (zb - cam.z); // Blumen in einer Vase: Stiele, Blätter, Blüten in der Farbe des Hauses
      fillZ(bx - 0.07, bx + 0.07, th, th + 0.24, zb, '#3b3945'); fillZ(bx - 0.07, bx - 0.04, th, th + 0.24, zb - 0.001, 'rgba(255,255,255,.12)');
      roh(() => { const h = Math.min(1, TW.innen); ctx.strokeStyle = zweiTon('#14261a', '#4c7a4a', h); ctx.lineWidth = Math.max(1, 0.012 * k); ctx.beginPath(); for (const [dx, dy] of [[-0.12, 0.3], [0, 0.4], [0.13, 0.28], [-0.05, 0.2], [0.07, 0.34]]) { ctx.moveTo(o[0], o[1] + 0.06 * k); ctx.lineTo(o[0] + dx * k, o[1] - dy * k); } ctx.stroke();
        ctx.fillStyle = zweiTon('#3a2a70', '#a78bfa', h); ctx.beginPath(); for (const [dx, dy, rr] of [[-0.12, 0.3, 0.05], [0.13, 0.28, 0.045], [0.07, 0.34, 0.04]]) { ctx.moveTo(o[0] + dx * k + rr * k, o[1] - dy * k); ctx.arc(o[0] + dx * k, o[1] - dy * k, rr * k, 0, 7); } ctx.fill();
        ctx.fillStyle = zweiTon('#57503c', '#f3ead8', h); ctx.beginPath(); for (const [dx, dy, rr] of [[0, 0.4, 0.05], [-0.05, 0.2, 0.04]]) { ctx.moveTo(o[0] + dx * k + rr * k, o[1] - dy * k); ctx.arc(o[0] + dx * k, o[1] - dy * k, rr * k, 0, 7); } ctx.fill(); }); }
  });
  // ── Sitzgruppe: zwei Sessel einander zugewandt, dazwischen ein niedriger Tisch (es wartet niemand: Dafür ist im Haus kein Mensch vorgesehen) ──
  fest(7.4, null, () => {
    const C = FEIN ? { top: '#8a6a54', front: '#3a2a20', side: '#4a362a' } : { top: N.top, front: N.front, side: N.side };
    for (const [x, zu] of EG.sessel) {
      shade(x - 0.52, x + 0.52, 6.4, 7.45);
      box(x - 0.42, x + 0.42, 0.12, 0.44, 6.5, 7.3, C.top, C.front, C.side);                                    // Sitz
      box(x - zu * 0.42 - 0.07, x - zu * 0.42 + 0.07, 0.12, 0.92, 6.5, 7.3, C.top, FEIN ? '#46332a' : '#2e2e33', C.side); // Rückenlehne (sie stehen quer zu uns)
      box(x - 0.42, x + 0.42, 0.12, 0.62, 7.2, 7.32, C.top, C.front, C.side);                                  // Armlehne hinten
      if (!FEIN) box(x - 0.42, x + 0.42, 0.12, 0.62, 6.5, 6.6, C.top, C.front, C.side);                        // Armlehne vorn (einfach: ein Kasten)
      else { // ausgearbeitet (Auftrag AA: weniger kantig): Rückenkissen, die Lehne oben gerundet, die Armlehne vorn als Polster mit runden Schultern und einer Rolle obenauf
        const K = flachAn(x - zu * 0.2, 0, 6.95); if (K) { K.E(0, 0.6, 0.2, 0.19, '#9a7a62'); K.E(-zu * 0.03, 0.64, 0.14, 0.12, 'rgba(255,236,214,.1)'); }
        const L = flachAn(x - zu * 0.42, 0, 6.5); if (L) { L.E(0, 0.915, 0.07, 0.035, '#5a4234'); }
        const r = rectZ(x - 0.42, x + 0.42, 0.12, 0.64, 6.5); if (r) { const rd = r[3] * 0.3;
          ctx.fillStyle = C.front; ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], [rd, rd, rd * 0.25, rd * 0.25]); ctx.fill();
          ctx.fillStyle = '#6e5240'; ctx.beginPath(); ctx.roundRect(r[0] + r[2] * 0.015, r[1], r[2] * 0.97, r[3] * 0.3, rd * 0.85); ctx.fill();                       // die Rolle obenauf fängt das Licht
          ctx.fillStyle = 'rgba(255,236,214,.16)'; ctx.beginPath(); ctx.roundRect(r[0] + r[2] * 0.08, r[1] + r[3] * 0.035, r[2] * 0.84, r[3] * 0.07, r[3] * 0.035); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(r[0] + r[2] * 0.04, r[1] + r[3] * 0.3, r[2] * 0.92, Math.max(1, r[3] * 0.025)); } }                              // die Naht unter der Rolle
      if (FEIN) { fillZ(x - 0.36, x - 0.32, 0, 0.13, 6.52, '#0c0b0d'); fillZ(x + 0.32, x + 0.36, 0, 0.13, 6.52, '#0c0b0d'); }
    }
    const [tx, tz] = EG.tisch; shade(tx - 0.36, tx + 0.36, tz - 0.36, tz + 0.36);
    box(tx - 0.3, tx + 0.3, 0, 0.4, tz - 0.3, tz + 0.3, '#77777d', '#1c1c20', '#232327');
    if (FEIN) { poly([[tx - 0.34, 0.4, tz - 0.34], [tx + 0.34, 0.4, tz - 0.34], [tx + 0.34, 0.4, tz + 0.34], [tx - 0.34, 0.4, tz + 0.34]], '#8f8a84'); fillZ(tx - 0.34, tx + 0.34, 0.37, 0.4, tz - 0.34, '#55524f');
      poly([[tx - 0.22, 0.402, tz - 0.2], [tx + 0.02, 0.402, tz - 0.22], [tx + 0.04, 0.402, tz + 0.04], [tx - 0.2, 0.402, tz + 0.06]], '#d8d2c8'); poly([[tx - 0.16, 0.404, tz - 0.14], [tx - 0.02, 0.404, tz - 0.15], [tx - 0.01, 0.404, tz - 0.06], [tx - 0.15, 0.404, tz - 0.05]], `rgba(${LAV},.8)`); // eine Mappe mit Formen, keine Schrift
      fillZ(tx + 0.12, tx + 0.2, 0.4, 0.5, tz - 0.05, '#e8e2d8'); }
  });
  // ── der Sockel im Licht, davor eine schwache Spiegelung des Kerns ──
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

/* Die Straße vor dem Haus (Auftrag Y): Gehweg mit Platten, Leitstreifen und Bordstein, Fahrbahn mit Mittellinie, Zebrastreifen und Flickstellen, gegenüber der zweite Gehweg (Vordergrund).
   Wird je Bild direkt gezeichnet: Fugen, Markierungen und Platten sind darum je EIN Pfad (linien, flaechen), nichts einzeln. */
const STR = { cz: -3.5, fz: -13.2, zebra: [-2.9, 0.9], baum: [[-9.4, -3.0, 4.5], [8.3, -3.0, 5.0]], kuebel: [[-2.75, -0.55], [0.75, -0.55]], buegel: [6.9, 7.8, 8.7] };
const STR_FEST = (() => { // was sich nie ändert, einmal gerechnet (Meter)
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
/* Die Erdgeschosse der Nachbarhäuser (Auftrag AA): links und rechts des Turms an der Bauflucht (z = 0) eine Zone aus Sockel, Schaufenstern, Türen und Blende, darüber ein Gesims; am Gehweg ein schmaler Schatten.
   Vorher endeten die Häuser der Stadt über dem Gehweg in einem hellen Dunstband. Ruhige Flächen, keine Worte. Einfache Fassung: Wand und Glas (drei Befehle); ausgearbeitet (AUSSEN_FEIN): Sockel, Blende, Gesims, Hauskanten, Schatten. */
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
    if (n > 0.05) flaechen(Z.licht, `rgba(255,208,150,${0.3 * n})`);                                                                 // abends brennt in jedem dritten Schaufenster Licht
    linien(Z.kante, 'rgba(0,0,0,.28)', 1);
    linien([[[-60, G + Z.H, 0.018], [TXL - 0.05, G + Z.H, 0.018]], [[TXR + 0.05, G + Z.H, 0.018], [60, G + Z.H, 0.018]]], 'rgba(255,255,255,.26)', 1.5); // das Gesims über dem Erdgeschoss
    flaechen([[[-60, G + 0.003, 0], [TXL - 0.05, G + 0.003, 0], [TXL - 0.05, G + 0.003, -0.6], [-60, G + 0.003, -0.6]], [[TXR + 0.05, G + 0.003, 0], [60, G + 0.003, 0], [60, G + 0.003, -0.6], [TXR + 0.05, G + 0.003, -0.6]]], 'rgba(0,0,0,.2)'); // der Anschluss an den Gehweg: Schatten am Fuß der Fassade
  });
}
function street() {
  oy = 0; if (cam.z > -NEAR) return;
  const k = S.f / -cam.z, gy = S.cy - (GROUND - cam.y) * k; if (gy > S.h) return;
  tonAn('strasse');
  ctx.fillStyle = sgr(0, gy, 0, Math.max(gy + 40, S.h), [[0, '#1b1a27'], [0.35, '#101018'], [1, '#07080b']]); ctx.fillRect(0, gy, S.w, S.h - gy + 2);
  if (k < 14) { tonAus(); return; }
  const { G, RY, mitte, striche, zebra, fugen, fugenVorn, flick } = STR_FEST, CZ = STR.cz, FZ = STR.fz, nah = k > 20;
  poly([[-60, RY, CZ], [60, RY, CZ], [60, RY, FZ], [-60, RY, FZ]], lg([0, RY, CZ], [0, RY, FZ], [[0, '#14141b'], [1, '#0b0b10']]));                           // Fahrbahn
  if (nah) flaechen(flick, 'rgba(0,0,0,.2)');                                                                                                                // geflickter Asphalt
  flaechen(striche, 'rgba(246,244,240,.2)');                                                                                                                 // Mittellinie
  if (nah) { flaechen(zebra, 'rgba(246,244,240,.3)'); poly([[-60, RY + 0.003, CZ - 0.12], [60, RY + 0.003, CZ - 0.12], [60, RY + 0.003, CZ - 0.42], [-60, RY + 0.003, CZ - 0.42]], 'rgba(0,0,0,.2)'); } // Zebrastreifen vor dem Eingang, Rinne am Bordstein
  poly([[-60, G, 0], [60, G, 0], [60, G, CZ], [-60, G, CZ]], lg([0, G, 0], [0, G, CZ], [[0, '#2a2933'], [1, '#201f29']]));                                  // Gehweg
  poly([[-60, G + 0.002, CZ + 0.95], [60, G + 0.002, CZ + 0.95], [60, G + 0.002, CZ + 0.6], [-60, G + 0.002, CZ + 0.6]], 'rgba(246,244,240,.07)');          // heller Leitstreifen
  linien(fugen, 'rgba(0,0,0,.2)', 1);
  poly([[-1.95, G + 0.004, -0.06], [-0.05, G + 0.004, -0.06], [-0.05, G + 0.004, -0.9], [-1.95, G + 0.004, -0.9]], '#15141b');                               // Fußmatte vor der Tür
  erdgeschosse();                                                                                                                                              // die Erdgeschosse der Nachbarhäuser an der Bauflucht
  ctx.globalCompositeOperation = 'lighter';
  poly([[-6, G + 0.01, 0], [6, G + 0.01, 0], [7.5, G + 0.01, CZ], [-7.5, G + 0.01, CZ]], lg([0, G, 0], [0, G, CZ], [[0, `rgba(${WARM},.13)`], [1, `rgba(${WARM},0)`]])); // Licht aus der Halle
  ctx.globalCompositeOperation = 'source-over';
  poly([[-60, G, CZ + 0.32], [60, G, CZ + 0.32], [60, G, CZ], [-60, G, CZ]], '#43414f');                                                                     // Bordstein von oben
  poly([[-60, G, CZ], [60, G, CZ], [60, RY, CZ], [-60, RY, CZ]], '#575565');                                                                                 // Bordsteinkante
  // gegenüber: der zweite Gehweg, auf dem der Betrachter steht (Vordergrund)
  poly([[-60, G, FZ], [60, G, FZ], [60, G, cam.z], [-60, G, cam.z]], lg([0, G, FZ], [0, G, FZ - 16], [[0, '#25242e'], [1, '#17161d']]));
  poly([[-60, G, FZ], [60, G, FZ], [60, G, FZ - 0.32], [-60, G, FZ - 0.32]], '#3c3a48');
  if (nah) linien(fugenVorn, 'rgba(0,0,0,.2)', 1);
  tonAus();
}
/* Was auf dem Gehweg steht. teil 0 = an der Fassade, hinter den Passanten (Pflanzkübel am Eingang, Fahrradbügel mit einem Rad) · 1 = am Bordstein, vor ihnen (Bäume in ihrer Scheibe). oy = GROUND.
   Blattgrün und Fahrrad behalten ihre Farbe (die Lichtrechnung TON nimmt Farbe heraus): gemischt wird hier selbst zwischen Nacht und Tag. */
const zweiTon = (nacht, tag, h) => { const a = hexRgb(nacht), b = hexRgb(tag); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * h)},${Math.round(a[1] + (b[1] - a[1]) * h)},${Math.round(a[2] + (b[2] - a[2]) * h)})`; };
function blattwerk(x, y, z, r, blasen, h) { // eine Krone aus runden Formen: Schattenseite, Eigenfarbe, Lichtseite (das Licht kommt von rechts oben), je Ton ein Pfad
  const dz = z - cam.z; if (dz < NEAR) return; const k = S.f / dz, o = P(x, y, z), kl = TON.kl; TON.kl = null;
  for (const [dx, dy, f, farbe, nur] of [[-0.06, -0.08, 1, zweiTon('#0c1711', '#35603f', h), 0], [0.05, 0.06, 0.9, zweiTon('#12241a', '#4f8450', h), 0], [0.2, 0.26, 0.42, zweiTon('#183022', '#6fa35f', h), 1]]) {
    ctx.beginPath(); for (const [bx, by, br, licht] of blasen) { if (nur && !licht) continue; const rr = br * r * f * k; ctx.moveTo(o[0] + (bx + dx * br) * r * k + rr, o[1] - (by + dy * br) * r * k); ctx.arc(o[0] + (bx + dx * br) * r * k, o[1] - (by + dy * br) * r * k, rr, 0, 7); }
    ctx.fillStyle = farbe; ctx.fill();
  }
  TON.kl = kl;
}
const KRONE = [[0, 0.05, 1, 0], [-0.9, -0.3, 0.62, 0], [0.86, -0.22, 0.66, 1], [-0.55, 0.55, 0.7, 0], [0.42, 0.7, 0.68, 1], [-0.05, 0.95, 0.5, 1], [0.1, -0.6, 0.6, 0], [-1.2, 0.1, 0.42, 0], [1.22, 0.2, 0.4, 0]], BUSCH = [[0, 0, 1, 1], [-0.7, -0.3, 0.62, 0], [0.72, -0.26, 0.66, 1]]; // [x, y, Radius, bekommt ein Licht] in Anteilen des Kronenradius
function strassenDinge(teil) {
  if (cam.z > -4.5) return; // nur von der Straße aus gesehen
  const W = tagWerte(), h = Math.min(1, W.aussen); tonAn('strasse');
  if (teil === 0) {
    for (const [x, z] of STR.kuebel) { // Pflanzkübel links und rechts der Tür
      poly([[x - 0.5, 0.004, z + 0.3], [x + 0.75, 0.004, z + 0.3], [x + 0.6, 0.004, z - 0.42], [x - 0.5, 0.004, z - 0.42]], 'rgba(0,0,0,.2)');
      box(x - 0.42, x + 0.42, 0, 0.62, z - 0.3, z + 0.3, '#3a3946', '#22212b', '#2b2a35'); fillZ(x - 0.42, x + 0.42, 0.56, 0.62, z - 0.301, '#4a4958');
      blattwerk(x, 0.95, z, 0.42, BUSCH, h);
    }
    { const z = -0.95, lw = lwAt(z, 0.05), b = STR.buegel; // Fahrradbügel vor der geschlossenen Wand, an einem lehnt ein Rad
      poly([[b[0] - 0.7, 0.004, z + 0.25], [b[2] + 0.9, 0.004, z + 0.25], [b[2] + 0.75, 0.004, z - 0.3], [b[0] - 0.7, 0.004, z - 0.3]], 'rgba(0,0,0,.14)');
      ctx.beginPath(); for (const x of b) { const p0 = P(x - 0.36, 0, z), p1 = P(x - 0.36, 0.62, z), p2 = P(x + 0.36, 0.62, z), p3 = P(x + 0.36, 0, z), r = (p2[0] - p1[0]) * 0.3; ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1] + r); ctx.quadraticCurveTo(p1[0], p1[1], p1[0] + r, p1[1]); ctx.lineTo(p2[0] - r, p2[1]); ctx.quadraticCurveTo(p2[0], p2[1], p2[0], p2[1] + r); ctx.lineTo(p3[0], p3[1]); }
      ctx.strokeStyle = '#4a4958'; ctx.lineWidth = lw; ctx.stroke();
      const kl = TON.kl; TON.kl = null; const x = b[1] + 0.05, zr = z - 0.14, q = (dx, y) => P(x + dx, y, zr), kk = S.f / (zr - cam.z); // das Rad: zwei Reifen, Rahmen, Lenker, Sattel
      ctx.beginPath(); for (const dx of [-0.52, 0.52]) { const c = q(dx, 0.34); ctx.moveTo(c[0] + 0.34 * kk, c[1]); ctx.arc(c[0], c[1], 0.34 * kk, 0, 7); } ctx.strokeStyle = zweiTon('#0a0a10', '#23232c', h); ctx.lineWidth = Math.max(1, 0.035 * kk); ctx.stroke();
      ctx.beginPath(); const mv = (pt, an) => { const c = q(pt[0], pt[1]); if (an) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]); };
      mv([-0.52, 0.34], 1); mv([-0.14, 0.34]); mv([-0.3, 0.86]); mv([-0.52, 0.34]); mv([-0.14, 0.34], 1); mv([0.36, 0.84]); mv([-0.3, 0.86]); mv([0.52, 0.34], 1); mv([0.34, 0.98]); mv([0.2, 1.0]); mv([-0.3, 0.86], 1); mv([-0.33, 0.97]); mv([-0.44, 0.97], 1); mv([-0.2, 0.97]);
      ctx.strokeStyle = zweiTon('#3a2f6a', '#7C6BD9', h); ctx.lineWidth = Math.max(1, 0.04 * kk); ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter'; TON.kl = kl;
    }
  } else {
    for (const [x, z, hoch] of STR.baum) { // Bäume am Bordstein: Baumscheibe mit Rost, Stamm, Krone; der Schatten fällt nach links vorn
      const kr = hoch * 0.3;
      poly([[x - 0.75, 0.004, z + 0.6], [x + 0.75, 0.004, z + 0.6], [x + 0.75, 0.004, z - 0.42], [x - 0.75, 0.004, z - 0.42]], '#1a1920');
      if (h > 0.3) { const sx = x - 2.6, n = 12; poly(Array.from({ length: n }, (_, i) => [sx + Math.cos((i / n) * 6.2832) * kr * 1.5, 0.006, z + 0.3 + Math.sin((i / n) * 6.2832) * 0.5]), `rgba(0,0,0,${0.16 * h})`); }
      { const a = P(x - 0.11, 0, z), c = P(x + 0.11, hoch * 0.62, z), kl = TON.kl; TON.kl = null; ctx.fillStyle = zweiTon('#0b0a0c', '#5a4a40', h); ctx.fillRect(a[0], c[1], c[0] - a[0], a[1] - c[1]); ctx.fillStyle = zweiTon('#08080a', '#3d322c', h); ctx.fillRect(a[0], c[1], (c[0] - a[0]) * 0.4, a[1] - c[1]); TON.kl = kl; }
      blattwerk(x, hoch * 0.7, z, kr, KRONE, h);
    }
  }
  tonAus();
}
/* Vordergrund: Straßenlaterne am Rand des Gehwegs und Menschen, die am Produkt vorbeigehen, ohne hinzusehen */
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
const WALKERS = [[1.0, 0.8, -1.0, 0.95, 'telefon', 'omar'], [-3.3, -0.7, -1.6, 0.98, null, 'rosa'], [3.0, 1.05, -2.3, 1.02, 'tasche', 'david'], [-2.3, -0.9, -3.0, 1.06, null, 'lea']]; // [x, Tempo, z, (frei), was er trägt, Mensch] · fern zuerst
function walkers(t) {
  if (-cam.z > 40 || cam.y - GROUND > 9) return;
  oy = GROUND; const T = STILL ? 0 : t * 0.001;
  const sk = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${Math.round(tagWerte().aussen * 40)}`; // was auf dem Gehweg steht, liegt als Schicht bereit, solange die Kamera steht (zwei eingesetzte Bilder statt rund 40 Befehlen je Bild)
  if (cam.z < -4.5) schicht('strasse0', sk, (() => { const r = imBild([-3.4, 9.9, 0, 1.75, -1.5, -0.2]); return [r[0], r[1], r[2] - r[0], r[3] - r[1]]; })(), () => strassenDinge(0));
  WALKERS.forEach(([x0, v, z, s, prop, wer], i) => {
    const x = ((((x0 + v * T + 18) % 36) + 36) % 36) - 18; // die Phase hängt am Weg: der Fuß steht
    walkerSetzen(i, menschVon(wer, AKZ.lav), prop, ((x0 + v * T) * Math.sign(v) * Math.PI) / (FIG.SCHRITT_M * 1.1) + i * 2.1 + 1.25, x, z, v > 0 ? Math.PI / 2 : -Math.PI / 2);
  });
  { const p = FIG.steh(T ? gewichtVon(SCHAU_TAKT[0], t, 0.6) : 0.6, 'haengt', 'haengt'); if (T) regen(p, t, SCHAU_TAKT[0]); stelleRuhig('yuki', T ? t : 0, menschVon('yuki', AKZ.lav), p, -1.05, 0, -0.7, 0.12, LICHT.halle, { saum: { farbe: WARM, a: 0.7 } }); } // ein Passant bleibt stehen und schaut ins Schaufenster
  if (cam.z < -4.5) schicht('strasse1', sk, (() => { const r = imBild([-13, 11.2, 0, 7.2, -3.8, -2.3]); return [r[0], r[1], r[2] - r[0], r[3] - r[1]]; })(), () => strassenDinge(1));
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
  const TW = tagWerte(); tonAn('turm');
  const nTop = Math.min(TOP - 1, Math.ceil((cam.y + S.cy / k) / FH) + TOP), nBot = Math.max(0, Math.floor((cam.y - (S.h - S.cy) / k) / FH) + TOP - 1);
  const ksh = S.f / (SHAFT.z - cam.z), sx0 = S.cx + (SHAFT.x0 - cam.x) * ksh, sx1 = S.cx + (SHAFT.x1 - cam.x) * ksh; // der Schacht liegt hinter dem Glas, in der Tiefe der Kabine
  for (let n = nBot; n <= nTop; n++) {
    const yt = yOf(baseOf(n) + FH), open = OPEN.has(n);
    if (open) { ctx.fillStyle = '#0c0c14'; ctx.fillRect(xr, yt, X1 - xr, fh + 1); }
    else {
      ctx.fillStyle = n & 1 ? '#12121c' : '#0f0f18'; ctx.fillRect(X0, yt, W, fh + 1);
      if (fh > 9) { // Gliederung: oben das Brüstungsband, im Fensterband spiegelt sich am Tag der Himmel (oben heller), unten die Fensterbank
        ctx.fillStyle = '#1b1b2b'; ctx.fillRect(X0, yt, W, fh * 0.2);
        if (TW.nacht < 0.5) { ctx.fillStyle = `rgba(255,255,255,${0.085 * (1 - TW.nacht * 2)})`; ctx.fillRect(X0, yt + fh * 0.2, W, fh * 0.24); }
        ctx.fillStyle = '#0a0a11'; ctx.fillRect(X0, yt + fh * 0.86, W, Math.max(1, fh * 0.035));
      }
      if (bw > 2.5) for (let b = 0; b < 12; b++) { const r = hash(n, b); if (r < 0.17) { ctx.fillStyle = TW.nacht > 0.5 ? winCol(r * 5.8, (0.05 + r * 0.95) * (fh > 120 ? 0.5 : 1) * TW.nacht) : `rgba(255,255,255,${(0.05 + r * 0.6) * (1 - TW.nacht * 2)})`; ctx.fillRect(X0 + b * bw + bw * 0.1, yt + fh * 0.2, bw * 0.8, fh * 0.66); } } // nachts brennt Licht, am Tag spiegelt die Scheibe
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
  if (k > 12 && gy > 0 && gy < S.h + 9 * k) { // Erdgeschoss: Sockel aus Stein rechts neben der Glasfront (Platten mit Fugen, Sockelleiste, ein schmales Fenster), Vordach über dem Eingang
    const g0 = xOf(6.15), g1 = X1, yS = yOf(GROUND + 7.2), u = Math.max(1, 0.035 * k);
    ctx.fillStyle = '#16161f'; ctx.fillRect(g0, yS, g1 - g0, gy - yS); ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (let y = 1.2; y < 7.2; y += 1.2) ctx.fillRect(g0, yOf(GROUND + y), g1 - g0, u);
    ctx.fillRect(xOf(8.3), yS, u, gy - yS);
    ctx.fillStyle = '#23222d'; ctx.fillRect(g0, yOf(GROUND + 0.45), g1 - g0, gy - yOf(GROUND + 0.45));
    ctx.fillStyle = '#0a0a11'; ctx.fillRect(xOf(8.7), yOf(GROUND + 5.6), 0.7 * k, 3.6 * k); ctx.fillStyle = TW.nacht > 0.5 ? winCol(0.2, 0.5 * TW.nacht) : `rgba(255,255,255,${0.16 * (1 - TW.nacht * 2)})`; ctx.fillRect(xOf(8.76), yOf(GROUND + 5.54), 0.58 * k, 1.5 * k);
    oy = 0; const vy = GROUND + 3.05, v0 = -2.75, v1 = 0.75, vt = 1.5; // Vordach: eine schlanke Platte an zwei Zugstäben
    if (cam.y < vy) { poly([[v0, vy, 0], [v1, vy, 0], [v1, vy, -vt], [v0, vy, -vt]], '#0b0b12'); const a = P(v0 + 0.5, vy, -0.5), b = P(v1 - 0.5, vy, -1.1); ctx.fillStyle = `rgba(${WARM},${0.2 + 0.6 * TW.nacht})`; ctx.fillRect(a[0], Math.min(a[1], b[1]), b[0] - a[0], Math.max(1, Math.abs(b[1] - a[1]))); }
    else poly([[v0, vy + 0.14, 0], [v1, vy + 0.14, 0], [v1, vy + 0.14, -vt], [v0, vy + 0.14, -vt]], '#2c2b39');
    poly([[v0, vy, -vt], [v1, vy, -vt], [v1, vy + 0.14, -vt], [v0, vy + 0.14, -vt]], '#3d3c4e');
    linien([[[v0 + 0.3, vy + 0.14, -vt + 0.1], [v0 + 0.3, vy + 1.25, 0]], [[v1 - 0.3, vy + 0.14, -vt + 0.1], [v1 - 0.3, vy + 1.25, 0]]], '#3d3c4e', Math.max(1, 0.03 * k));
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
  tonAus();

}

/* Das Dach: Bühne, Traverse, drei Scheinwerfer. Im Auftakt dunkel, im Finale stehen die Lichtkegel über der Stadt */
function truss(a, b, off, n) {
  const lw = lwAt((a[2] + b[2]) / 2, 0.055), A2 = [a[0] + off[0], a[1] + off[1], a[2]], B2 = [b[0] + off[0], b[1] + off[1], b[2]], col = '#0a0a11';
  linien([[a, b], [A2, B2]], col, lw); const d = [];
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p = (q, t) => [lerp(q === 0 ? a[0] : A2[0], q === 0 ? b[0] : B2[0], t), lerp(q === 0 ? a[1] : A2[1], q === 0 ? b[1] : B2[1], t), a[2]]; d.push([p(i % 2, t0), p((i + 1) % 2, t1)]); }
  linien(d, col, lw * 0.7); // die Streben als ein Strich
}
/* Der Abend auf dem Dach: Lichterketten, Gäste an Stehtischen, Stuhlreihen, eine Person am Pult, eine Kamera.
   Die Gäste an den Thementischen gehören zur Leistung „Fokus Abend“, der Mensch neben dem Pult ist der Abendpartner: Wer abgewählt wird, geht über das Dach zum Aufzug (DACH_WEGE).
   Das Publikum sitzt und wird je Stuhl einmal auf eine eigene Fläche gezeichnet. Alles wird nach Tiefe sortiert, damit, wer geht, hinter Tischen und Stühlen vorbeikommt. */
const DACH_GAST = [ // [Mensch, x, z, Blick in Grad, Haltung, Weg bis in die vordere Gasse, Gespräch (Kennzahl des Paars), Teil 0 | 1]
  ['hanna', -4.75, 5.4, 90, 'zeigt', [[-4.95, 4.4], [-4.7, 1.2], [-2.4, 0.9]], 31, 0], ['omar', -3.85, 5.6, -90, 'steht', [[-4.45, 4.6], [-4.55, 1.3], [-2.2, 0.95]], 31, 1],
  ['emil', -3.93, 1.95, 90, 'spricht', [[-3.9, 1.2], [-2.2, 0.9]], 32, 0], ['rosa', -3.05, 1.85, -90, 'steht', [[-2.9, 1.2], [-1.8, 0.95]], 32, 1], ['yuki', -3.45, 2.6, 180, 'steht', [[-2.75, 2.5], [-2.5, 1.4], [-1.7, 1.0]]],
];
const DACH_TEAM = [ // der Abendpartner: zwei Menschen an seinem Stand auf der Bühne rechts
  ['nora', 1.15, 8.55, 188, 'spricht', [[1.05, 7.4], [0.7, 6.2], [0, 5.9], [0, 2.4], [0.4, 1.5]], 33, 0],
  ['jonas', 3.2, 8.45, 168, 'zeigt', [[3.0, 7.3], [1.4, 6.2], [0.2, 5.9], [0, 2.4], [0.4, 1.5]], 33, 1],
];
const DACH_HOST = ['finn', -1.45, 8.0, 172, 'spricht', [[-1.5, 6.9], [-0.7, 6.1], [0, 5.9], [0, 2.4], [0.4, 1.5]]]; // wer den Abend moderiert, geht mit dem Abend
const DACH_PUBLIKUM = ['tom', 'lea', 'ben', 'ida', 'mia', 'karl', 'lina', 'noah', 'david', 'sven', 'mika', 'tara']; // die ersten PUB_FIGUREN sitzen im Publikum: acht Menschen in eigener Kleidung, von hinten verschieden (Haare kurz, lang, Bob, Dutt, Zopf, Locken; schmal bis kräftig), keiner in der Akzentfarbe und keiner, der schon als Gast oder auf der Bühne steht. Auf der Bühne stehen ebenfalls Menschen in eigener Kleidung (DACH_TEAM, DACH_HOST): Das Bühnenlicht färbt nur als Lichtkante.
/* Ein Mensch im Publikum: ein fertiges Bild in einer festen Stufe der Auflösung (ruheStufe), das eingesetzt wird. vor = nur anlegen (publikumVor): Die Bilder entstehen, solange der Aufzug noch
   unterwegs zum Dach ist, einer je Takt, in der Größe der Ansicht vom Dach; kommt das Dach ins Bild, wird nichts mehr gezeichnet. */
const REIHEN_Z = [5.3, 4.2, 3.1];
function publikumSetzen(sz, z, vor) {
  const id = sz.id, px = sz.px, dz = z - cam.z; if (dz <= 1) return;
  const k = S.f / dz; if (k <= 4) return;
  const LI = LICHT.abend, m = menschVon(pubMensch(id), AKZ.lav), dreh = Math.round((Math.PI + Math.atan2(px - cam.x, dz) + (hash(id, 9) - 0.5) * 0.5) * 4) / 4, auge = cam.y; // Blickwinkel in groben Schritten: Vom Dach und vom Finale aus gilt meist dasselbe Bild
  const male = (gg, sx, sy, kk) => FIG.malen(gg, m, FIG.sitz(0.46, m.gr, hash(id, 2) > 0.6 ? 'haelt' : 'schoss', 'schoss'), sx, sy, kk, { dreh, auge, dz, licht: LI, L: LI.L, saum: { farbe: WARM, a: 0.5 } });
  const key = `${dreh}`, kb = Math.min(110, ruheStufe(k * (KAM_STEHT || vor ? 1 : 1.8)));
  if (vor) { if (!VOR_G) { const c = document.createElement('canvas'); c.width = c.height = 8; VOR_G = c.getContext('2d'); } FIG.stempel(VOR_G, 'dach' + id, key, 4, 4, k, male, 1, false, kb); STEMPEL_STAND.set('dach' + id, { key, k: Math.max(kb, k) }); return; }
  const q = P(px, 0, z); stempelRuhig('dach' + id, key, q[0], q[1], k, male, kb);
}
const PUB_FIGUREN = 8; // das Publikum besteht aus so vielen verschiedenen Figuren (auf alle Stühle verteilt): So teilen sich alle einen kleinen Satz Bilder fürs Aufstehen und Gehen (BILD.K_PUB)
const pubMensch = (id) => DACH_PUBLIKUM[(id * 5 + Math.floor(id / 6) * 3) % PUB_FIGUREN]; // in keiner Reihe und in keiner Spalte sitzt derselbe Mensch zweimal nebeneinander
let PUB_VOR = 0, DACH_VOR = 0;
/* Die Bilder des Dachs (Aufstehen, Gehen, Lichtsaum) entstehen schon, während der Aufzug die letzten Etagen fährt: die Liste des Vorzeichnens (vorwaermen) mit der Kamera des Dachs, ein Bild je Takt.
   Kommt das Dach ins Bild, liegt alles bereit; ein Klick auf „Fokus Abend“ zeichnet dann nichts mehr neu. */
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
function publikumVor() { // aus der Bildschleife, sobald die Fahrt die oberen Etagen erreicht
  for (const sz of DACH_SITZE) if (sz.da) LEER.push(() => {
    kamera(ansicht(DACH_SZ)); KAM_STEHT = true;
    try { publikumSetzen(sz, REIHEN_Z[sz.row], true); } finally { const v = ansicht(sS.v); kamera(v); if (NAH) S.f *= 1 + NAH; raumBlick(); KAM_SIG = ''; } // die Kamera steht wieder, wo sie war
  });
}
/* Die Stühle des Publikums: drei Reihen mit Mittelgang. Wer sitzt, steht hier (gleiche Zufallswerte wie beim Zeichnen), damit die Gäste beim Herausnehmen des Abends aufstehen und gehen können. */
const SITZ_F = new Map(); // Stuhl → Mensch (nur wer sitzt und mit dem Abend geht)
const DACH_SITZE = (() => { const r = []; [5.3, 4.2, 3.1].forEach((z, row) => { for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const x = side * (0.95 + i * 1.04), id = row * 6 + i * 2 + (side > 0 ? 1 : 0); if (row === 2 && side > 0 && i === 0) continue; r.push({ x, z, id, row, side, px: x + (hash(id, 5) - 0.5) * 0.14, da: hash(id, 41) > 0.12 }); } }); return r; })();
(() => { // die Menschen des Dachs anlegen: Sie gehen nicht durch eine Tür in der Rückwand, sondern vorn zum Kopf des Aufzugs und verschwinden dort
  const st = RAUM.dach; if (!st) return;
  const bau = (l, d, n, boden, verz) => { const f = personBauen(st, l, { mensch: d[0], platz: [d[1], d[2]], blick: d[3], haltung: d[4], boden, tasche: false, gespraech: d[6], teil: d[7] }, n, d[5]); f.blende = 2.4; f.stufe = boden ? [2.0, 0.7] : null; f.verz = verz; return f; };
  const a = st.nach.abend, b = st.nach.abendpartner;
  if (a) {
    DACH_GAST.forEach((d, n) => a.leute.push(bau(a, d, n, 0, 30 + n * 50)));
    a.leute.push(bau(a, DACH_HOST, 5, STAGE.y, 90)); a.leute[a.leute.length - 1].pult = true;
    for (const sz of DACH_SITZE) { // das Publikum steht auf, geht zwischen den Reihen zum Mittelgang, nach vorn und verliert sich im Dunkel
      if (!sz.da) continue; const gang = sz.side * 0.3, w = [[sz.px, sz.z - 0.62], [gang, sz.z - 0.62], [gang, 2.6], [gang * 0.6, 1.9]];
      const f = personBauen(st, a, { mensch: pubMensch(sz.id), platz: [sz.px, sz.z], blick: 0, haltung: 'sitzt', boden: 0, tasche: false }, 6 + sz.id, w);
      f.blende = 1.5; f.verz = (2 - sz.row) * 70 + hash(sz.id, 3) * 260; f.tA = 420; f.sitz = sz; f.stempel = true; a.leute.push(f); SITZ_F.set(sz.id, f);
    }
    a.dauer = Math.max(...a.leute.map((f) => f.verz + f.tA + f.tW));
  }
  if (b) { DACH_TEAM.forEach((d, n) => b.leute.push(bau(b, d, n, STAGE.y, 40 + n * 160))); b.dauer = Math.max(...b.leute.map((f) => f.verz + f.tA + f.tW)); }
})();
function terrace(t, teil = 0) { // teil: 0 = alles · 1 = nur, was steht (für die ruhende Fläche) · 2 = nur, was sich mit dem Abend ändert, und die Menschen
  if (S.f / Math.max(1, 4 - cam.z) < 6.5) return; // aus der Ferne (roter Faden) bleibt das Dach leer
  const rail = 'rgba(205,192,255,.28)', dark = '#07070c', LI = LICHT.abend, list = [], dazu = (z, fn) => list.push({ z, fn });
  const kette = smooth((TZ - 0.82) / 0.1), strahl = smooth((TZ - 0.88) / 0.09); // Lichterketten und Tischlichter ab dem Sonnenuntergang, die Strahler der Bühne, wenn es dämmert
  if (teil !== 2) {
  // Lichterketten von zwei Masten zur Traverse
  const chain = (A, B, sag, n) => {
    const at = (u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u) - sag * Math.sin(Math.PI * u), lerp(A[2], B[2], u)];
    { const s = []; for (let i = 0; i < n; i++) s.push([at(i / n), at((i + 1) / n)]); linien(s, 'rgba(10,10,16,.9)', 1); } // das Kabel: ein Strich
    if (kette < 0.01) { ctx.fillStyle = 'rgba(40,36,48,.9)'; ctx.beginPath(); for (let i = 1; i < n; i++) { const q = at(i / n), s = P(q[0], q[1], q[2]), r = Math.max(1.3, (0.075 * S.f) / (q[2] - cam.z)); ctx.moveTo(s[0] + r, s[1]); ctx.arc(s[0], s[1], r, 0, 7); } ctx.fill(); return; } // am Tag: alle Birnen aus, eine Fläche
    for (let i = 1; i < n; i++) { const q = at(i / n), s = P(q[0], q[1], q[2]), r = Math.max(1.3, (0.075 * S.f) / (q[2] - cam.z)), an = clamp01((kette - i / n * 0.5) * 2); // die Lichter gehen der Reihe nach an
      if (an > 0.02) { ctx.fillStyle = `rgba(${WARM},${0.13 * an})`; ctx.beginPath(); ctx.arc(s[0], s[1], r * 2.4, 0, 7); ctx.fill(); } ctx.fillStyle = an > 0.02 ? `rgba(255,243,224,${0.25 + 0.75 * an})` : 'rgba(40,36,48,.9)'; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.fill(); }
  };
  for (const [x, z] of [[-6.1, 0.8], [10.1, 0.8]]) { seg([x, 0, z], [x, 3.6, z], dark, lwAt(z, 0.07)); }
  chain([-6.1, 3.6, 0.8], [-TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 0.9, 15); chain([10.1, 3.6, 0.8], [TRUSS.x, TRUSS.h + 0.45, TRUSS.z], 1.1, 18);
  dachFest(2); // der Stehtisch links vorn
  }
  if (teil === 1) return;
  const gk = AKT.F && AKT.F.roof ? AKT.k : 0, stD = RAUM.dach, g = [gk * da('dach', 'abend') * strahl, gk * da('dach', 'abendpartner') * strahl], tt = reduce ? 0 : t;
  const steht = (m, x, y, z, grad, p, extra) => stelleMensch(menschVon(m, AKZ.lav), p, x, y, z, rad(grad), LI, extra);
  // der Stand des Abendpartners auf der Bühne rechts: ein Banner (nur Flächen und Linien, keine Schrift), davor ein Stehtisch mit Auslage, ein Strahler von der Traverse.
  // Ohne Partner steht er dunkel da, mit gestricheltem Umriss.
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
  dazu(8.9, () => { // der Stehtisch des Partners: Auslage (Aufsteller, Karten), ein Licht
    const a = g[1], x = 2.0, z = 8.9; oy = STAGE.y;
    seg([x, 0, z], [x, 1.05, z], dark, lwAt(z, 0.06)); fillZ(x - 0.26, x + 0.26, 0, 0.04, z, dark);
    box(x - 0.4, x + 0.4, 1.05, 1.1, z - 0.32, z + 0.32, mischRgb([60, 56, 80], [138, 136, 160], a), '#262532', '#2b2a38');
    fillZ(x - 0.3, x - 0.12, 1.1, 1.34, z - 0.04, mischRgb([50, 46, 70], [239, 234, 248], a)); fillZ(x + 0.05, x + 0.34, 1.1, 1.18, z - 0.2, mischRgb([60, 50, 100], [95, 75, 182], a));
    glow(x, 1.25, z, 1.1, [[0, `rgba(${WARM},${0.4 * a})`], [1, `rgba(${WARM},0)`]]);
    if (a < 0.95) { const o = rectZ(x - 0.45, x + 0.45, 0, 1.12, z - 0.34); if (o) { ctx.strokeStyle = `rgba(205,192,255,${0.8 * (1 - a)})`; ctx.lineWidth = 1.8; ctx.setLineDash([7, 5]); ctx.strokeRect(o[0], o[1], o[2], o[3]); ctx.setLineDash([]); } }
    oy = 0;
  });
  dazu(9.9, () => { // die Strahler der Traverse: Sie brennen, solange der Abend da ist (links und Mitte) bzw. der Partner (rechts)
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, k, tx] of [[-2.9, g[0], -3.0], [0, g[0], -0.5], [2.9, g[1], 2.6]]) { if (k < 0.02) continue; poly([[lx - 0.06, TRUSS.h - 0.3, TRUSS.z], [lx + 0.06, TRUSS.h - 0.3, TRUSS.z], [tx + 1.2, STAGE.y, 8.2], [tx - 1.2, STAGE.y, 8.2]], lg([lx, TRUSS.h, TRUSS.z], [tx, STAGE.y, 8.2], [[0, `rgba(${WARM},${0.28 * k})`], [1, `rgba(${WARM},${0.05 * k})`]])); }
    ctx.globalCompositeOperation = 'source-over';
  });
  dazu(9, () => { oy = STAGE.y; ctx.globalCompositeOperation = 'lighter'; poly([[-4.2, 0.004, 6.6], [0.6, 0.004, 6.6], [0.6, 0.004, 9.4], [-4.2, 0.004, 9.4]], `rgba(${WARM},${0.03 + 0.1 * g[0]})`); poly([[1.0, 0.004, 7.6], [3.9, 0.004, 7.6], [3.9, 0.004, 9.4], [1.0, 0.004, 9.4]], `rgba(${WARM},${0.02 + 0.14 * g[1]})`); ctx.globalCompositeOperation = 'source-over'; oy = 0; });
  dazu(7.8, () => { oy = STAGE.y; box(-2.75, -2.05, 0, 1.15, 7.35, 7.8, '#8f8da6', lg([0, 1.15, 7.35], [0, 0, 7.35], [[0, '#55536a'], [1, '#262532']]), '#34323f');
    linien([[[-2.2, 1.15, 7.5], [-2.2, 1.4, 7.5]], [[-2.2, 1.4, 7.5], [-2.08, 1.52, 7.5]]], '#0a0a11', lwAt(7.5, 0.022)); fillZ(-2.1, -2.02, 1.5, 1.57, 7.5, '#0a0a11'); // das Mikrofon am Pult: ein Schwanenhals
 glow(-2.2, 1.5, 7.6, 2.6, [[0, `rgba(${WARM},${0.04 + 0.18 * g[0]})`], [1, `rgba(${WARM},0)`]]); oy = 0; });
  const tisch = (x, z) => { seg([x, 0, z], [x, 1.08, z], dark, lwAt(z, 0.07)); fillZ(x - 0.28, x + 0.28, 0, 0.04, z, dark); box(x - 0.34, x + 0.34, 1.08, 1.13, z - 0.34, z + 0.34, '#8a88a0', '#262532', '#2b2a38'); fillZ(x - 0.03, x + 0.03, 1.13, 1.22, z, '#fff3e0'); glow(x, 1.2, z, 0.75, [[0, `rgba(${WARM},${0.5 * kette})`], [1, `rgba(${WARM},0)`]]); };
  // Thementisch: als Gast stehen die Tische im Licht, mit einem Aufsteller für das Thema
  const thementisch = (x, z) => {
    if (g[0] > 0.02) { ctx.globalCompositeOperation = 'lighter'; poly([[x - 1.5, 0.005, z - 1.2], [x + 1.5, 0.005, z - 1.2], [x + 1.25, 0.005, z + 1.3], [x - 1.25, 0.005, z + 1.3]], `rgba(${WARM},${0.1 * g[0]})`); ctx.globalCompositeOperation = 'source-over'; glow(x, 1.3, z, 2.1, [[0, `rgba(${WARM},${0.2 * g[0]})`], [1, `rgba(${WARM},0)`]]); }
    tisch(x, z);
    if (g[0] > 0.02) { ctx.globalAlpha = g[0]; fillZ(x + 0.08, x + 0.3, 1.13, 1.42, z - 0.05, '#efeaf8'); fillZ(x + 0.11, x + 0.27, 1.33, 1.37, z - 0.06, '#5F4BB6'); fillZ(x + 0.11, x + 0.24, 1.24, 1.27, z - 0.06, 'rgba(38,36,51,.4)'); ctx.globalAlpha = 1; }
  };
  for (const d of DT) dazu(d[1] + 0.02, () => thementisch(d[0], d[1]));
  // drei Stuhlreihen mit Mittelgang: Das Publikum sitzt und sieht zur Bühne. Jede Reihe (Stühle, wer sitzt, Lehnen) ist EIN vorgezeichnetes Bild; es entsteht neu, wenn jemand aufsteht oder sich setzt.
  const kamKey = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}`;
  [5.3, 4.2, 3.1].forEach((z, r) => dazu(z, () => {
    const sitze = DACH_SITZE.filter((sz) => sz.row === r), sitzt = sitze.map((sz) => { const fs = SITZ_F.get(sz.id); return sz.da && !(fs && wo(fs).q > 0); });
    const a = P(-3.5, 1.5, z + 0.25), b = P(3.5, 0, z - 0.32), c = P(-3.5, 0, z - 0.32), d = P(3.5, 1.5, z + 0.25), x0 = Math.min(a[0], c[0]) - 6, x1 = Math.max(b[0], d[0]) + 6;
    const rect = [x0, a[1] - 6, x1 - x0, b[1] - a[1] + 12];
    schicht('reiheA' + r, kamKey, rect, () => { for (const sz of sitze) box(sz.x - 0.24, sz.x + 0.24, 0.43, 0.47, z - 0.24, z + 0.2, '#4a4860', '#22212c', '#262532'); });
    sitze.forEach((sz, n) => {
      if (!sitzt[n]) return; // wer aufgestanden ist, wird als Mensch gezeichnet (unten)
      publikumSetzen(sz, z, false);
    });
    schicht('reiheB' + r, kamKey, rect, () => { for (const sz of sitze) { box(sz.x - 0.24, sz.x + 0.24, 0.5, 0.88, z - 0.27, z - 0.22, '#4a4860', '#22212c', '#262532'); fillZ(sz.x - 0.24, sz.x + 0.24, 0.855, 0.88, z - 0.271, `rgba(${WARM},.22)`); } });
  }));
  // die Kamera läuft mit
  dazu(1.9, () => tripod(1.2, 1.9, 1.6));
  // die Gäste an den Thementischen und der Abendpartner: am Platz, unterwegs zum Aufzug oder fort
  const amPlatz = [];
  if (stD) for (const l of stD.L) {
    const leer = smooth((l.u * l.dauer - 250) / 500);
    for (const f of l.leute) {
      const zs = wo(f); if (!zs.fort && zs.q <= 0 && !f.stempel) amPlatz.push(f);
      if (leer > 0.02 && !f.stempel) dazu(f.z + 0.002, () => umrissMalen(f, leer * 0.75, "167,139,250")); // der leere Platz: Umriss
      if (zs.fort || (f.stempel && zs.q <= 0)) continue; // das Publikum auf den Stühlen steht als Fläche im Bild
      dazu(zs.z + (f.stempel ? 0.3 : 0), () => { const fern = f.w.len - zs.s; if (fern < f.blende) ctx.globalAlpha = smooth(fern / f.blende); maleMensch(f, zs, t, LI, WARM, 0); ctx.globalAlpha = 1; });
    }
  }
  if (stD) ruhePflegen(stD, amPlatz, gk > 0.9);
  list.sort((a, b) => b.z - a.z); for (const it of list) it.fn();
  if (stD && gk > 0) { const a = stD.nach.abend, b = stD.nach.abendpartner; if (a) { merke(a, a.x, a.z, a.hoch || 2.2, 1.3); merke(a, 0, 4.2, 1.5, 2.6, true); merke(a, -1.45, 8.0, 2.35 + STAGE.y, 0.6, true); } if (b) { oy = STAGE.y; merke(b, b.x, b.z, (b.hoch || 2.7) - STAGE.y, 0.7); oy = 0; } } // was auf dem Dach angetippt werden kann: die Gäste am Thementisch, der Abendpartner auf der Bühne
}
/* Was auf dem Dach steht (Auftrag Y). schritt 0 = hinter der Traverse und an der Kante (Brüstung aus Glas mit Pfosten und Handlauf, Rückwand der Bühne, Pflanzkübel hinten) ·
   1 = auf und vor der Bühne (Dielen, Stufe, Lautsprecher, Pflanzkübel vorn) · 2 = auf der Terrasse (ein Stehtisch links vorn). Der Getränketisch und ein zweiter Stehtisch stehen hinter der Bühne (Schritt 0): Nur dort sind sie neben Tafel, Publikum und Bühne zu sehen. Alles steht: Auf dem Dach und im Finale liegt es auf der
   ruhenden Fläche (dort ausgearbeitet: AUSSEN_FEIN); von außen (erstes Bild der Seite) wird die einfache Fassung je Bild gezeichnet, dafür sind Brüstung, Traverse und Lichterketten jetzt je ein Strich. */
let AUSSEN_FEIN = false;
const DACHD = { wand: [-2.3, 2.3, 4.05, 10.45], boxen: [-4.2, 4.2], kuebel: [[-5.7, 11.9, 1.1], [5.7, 11.9, 1.1], [-5.35, 6.0, 0.9]], bar: [-4.45, -2.7, 12.2, 12.8], steh: [[4.45, 12.4], [-5.3, 3.7]] };
function dachFest(schritt) {
  const dark = '#07070c', h = Math.min(1, tagWerte().aussen), F = AUSSEN_FEIN, kette = smooth((TZ - 0.82) / 0.1);
  const stehtisch = ([x, z]) => { // Stehtisch mit Tischlicht
    seg([x, 0, z], [x, 1.08, z], dark, lwAt(z, 0.07)); fillZ(x - 0.28, x + 0.28, 0, 0.04, z, dark); box(x - 0.34, x + 0.34, 1.08, 1.13, z - 0.34, z + 0.34, '#8a88a0', '#262532', '#2b2a38'); fillZ(x - 0.03, x + 0.03, 1.13, 1.22, z, '#fff3e0');
    if (kette > 0.01) glow(x, 1.2, z, 0.75, [[0, `rgba(${WARM},${0.5 * kette})`], [1, `rgba(${WARM},0)`]]);
    if (F) { fillZ(x + 0.12, x + 0.19, 1.13, 1.26, z - 0.1, 'rgba(236,230,255,.45)'); fillZ(x - 0.22, x - 0.15, 1.13, 1.26, z + 0.05, 'rgba(236,230,255,.4)'); }
  };
  const kuebel = ([x, z, gr]) => { poly([[x - 0.5, 0.004, z + 0.3], [x + 0.6, 0.004, z + 0.3], [x + 0.5, 0.004, z - 0.4], [x - 0.5, 0.004, z - 0.4]], 'rgba(0,0,0,.22)'); box(x - 0.36, x + 0.36, 0, 0.7, z - 0.3, z + 0.3, '#3a3946', '#1d1c26', '#262531'); if (F) fillZ(x - 0.36, x + 0.36, 0.64, 0.7, z - 0.301, '#4a4958'); blattwerk(x, 1.0 + 0.1 * gr, z, 0.44 * gr, BUSCH, h); };
  if (schritt === 0) {
    const pf = [], hl = [[[TXL, 1.05, RD], [TXR, 1.05, RD]], [[TXL + 0.05, 1.05, 0.3], [TXL + 0.05, 1.05, RD]], [[TXR - 0.05, 1.05, 0.3], [TXR - 0.05, 1.05, RD]]];
    for (let x = TXL; x <= TXR + 0.01; x += 1.4) pf.push([[x, 0, RD], [x, 1.05, RD]]); for (const x of [TXL + 0.05, TXR - 0.05]) for (let z = 0.3; z < RD; z += 1.4) pf.push([[x, 0, z], [x, 1.05, z]]);
    flaechen([[[TXL, 0.08, RD], [TXR, 0.08, RD], [TXR, 1.0, RD], [TXL, 1.0, RD]], [[TXL + 0.05, 0.08, 0.3], [TXL + 0.05, 0.08, RD], [TXL + 0.05, 1.0, RD], [TXL + 0.05, 1.0, 0.3]], [[TXR - 0.05, 0.08, 0.3], [TXR - 0.05, 0.08, RD], [TXR - 0.05, 1.0, RD], [TXR - 0.05, 1.0, 0.3]]], 'rgba(205,192,255,.07)'); // Glas
    linien(pf, 'rgba(205,192,255,.28)', 1); linien(hl, 'rgba(226,218,255,.6)', 1.5); // Pfosten, Handlauf
    kuebel(DACHD.kuebel[0]); kuebel(DACHD.kuebel[1]);
    { const [x0, x1, z0, z1] = DACHD.bar; // der Getränketisch hinter der Bühne links: Tresen mit heller Platte und warmer Lichtfuge, darauf Flaschen und Gläser (vor dem Abendhimmel)
      box(x0, x1, 0, 1.06, z0, z1, '#8a88a0', lg([0, 1.06, z0], [0, 0, z0], [[0, '#3a3848'], [1, '#1f1e2a']]), '#262531');
      box(x0 - 0.06, x1 + 0.06, 1.06, 1.13, z0 - 0.06, z1 + 0.05, '#b9b6c8', '#6a6880', '#55536a');
      fillZ(x0, x1, 0.98, 1.04, z0 - 0.01, `rgba(${WARM},${0.3 + 0.6 * kette})`);
      const fl = [], gl = []; for (let i = 0; i < 7; i++) { const x = x0 + 0.16 + i * 0.235, z = z0 + 0.22 + (i % 2) * 0.16, hh = i % 3 === 0 ? 0.36 : 0.3; fl.push([[x - 0.045, 1.13, z], [x + 0.045, 1.13, z], [x + 0.045, 1.13 + hh * 0.7, z], [x + 0.016, 1.13 + hh, z], [x - 0.016, 1.13 + hh, z], [x - 0.045, 1.13 + hh * 0.7, z]]); if (i < 6) gl.push([[x + 0.08, 1.13, z - 0.1], [x + 0.15, 1.13, z - 0.1], [x + 0.16, 1.26, z - 0.1], [x + 0.07, 1.26, z - 0.1]]); }
      roh(() => { flaechen(fl, zweiTon('#16241e', '#2f5a48', h)); flaechen(gl, `rgba(236,230,255,${0.3 + 0.25 * h})`); });
      if (F) { const s = []; for (let x = x0 + 0.25; x < x1; x += 0.25) s.push([[x, 0.06, z0 - 0.002], [x, 0.98, z0 - 0.002]]); linien(s, 'rgba(0,0,0,.25)', 1); glow((x0 + x1) / 2, 1.3, z0, 1.7, [[0, `rgba(${WARM},${0.2 * kette})`], [1, `rgba(${WARM},0)`]]); }
    }
    stehtisch(DACHD.steh[0]);
    { const [x0, x1, y1, z] = DACHD.wand, y0 = STAGE.y + 0.12; oy = 0; // die Rückwand der Bühne: ein dunkles Tuch im Rahmen, darauf das Zeichen des Hauses (nur Formen, wie am Empfang)
      linien([[[x0, STAGE.y, z], [x0, y1 + 0.1, z]], [[x1, STAGE.y, z], [x1, y1 + 0.1, z]], [[x0, y1 + 0.1, z], [x1, y1 + 0.1, z]]], '#0a0a11', lwAt(z, 0.06));
      const r = fillZ(x0 + 0.06, x1 - 0.06, y0, y1, z - 0.01, '#15141f');
      if (r) roh(() => { const u = r[2]; ctx.fillStyle = zweiTon('#3b2a78', '#8B5CF6', 0.35 + 0.65 * h); ctx.beginPath(); ctx.arc(r[0] + u * 0.3, r[1] + r[3] * 0.24, u * 0.07, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(246,244,240,${0.55 + 0.2 * h})`; ctx.fillRect(r[0] + u * 0.42, r[1] + r[3] * 0.2, u * 0.3, r[3] * 0.035); ctx.fillStyle = `rgba(246,244,240,${0.3 + 0.1 * h})`; ctx.fillRect(r[0] + u * 0.42, r[1] + r[3] * 0.27, u * 0.2, r[3] * 0.026);
        if (F) { ctx.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 1; i < 6; i++) ctx.fillRect(r[0] + (u * i) / 6, r[1], Math.max(1, u * 0.004), r[3]); } }); } // Falten im Tuch
    return;
  }
  if (schritt === 1) {
    oy = STAGE.y;
    { const d = []; for (let x = STAGE.x0 + 0.46; x < STAGE.x1; x += 0.46) d.push([[x, 0.004, STAGE.z0], [x, 0.004, STAGE.z1]]); linien(d, 'rgba(0,0,0,.22)', 1); } // Dielen des Bühnenbodens
    for (const x of DACHD.boxen) { box(x - 0.27, x + 0.27, 0, 1.2, 6.6, 7.0, '#33323f', '#111118', '#1a1922'); const a = P(x, 0.82, 6.6), b = P(x, 0.32, 6.6), k = S.f / (6.6 - cam.z); ctx.fillStyle = '#26252f'; ctx.beginPath(); ctx.arc(a[0], a[1], 0.12 * k, 0, 7); ctx.moveTo(b[0] + 0.19 * k, b[1]); ctx.arc(b[0], b[1], 0.19 * k, 0, 7); ctx.fill();
      if (F) { ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(a[0], a[1], 0.05 * k, 0, 7); ctx.moveTo(b[0] + 0.09 * k, b[1]); ctx.arc(b[0], b[1], 0.09 * k, 0, 7); ctx.fill(); fillZ(x - 0.27, x - 0.24, 0, 1.2, 6.599, 'rgba(255,255,255,.08)'); } }
    oy = 0;
    box(-0.75, 0.75, 0, STAGE.y / 2, STAGE.z0 - 0.42, STAGE.z0, '#2c2a3a', '#12121a', '#191822'); // die Stufe zur Bühne
    kuebel(DACHD.kuebel[2]);
    return;
  }
  stehtisch(DACHD.steh[1]);
}
let roofT = 0;
function roof(p, t = 0, teil = 0) { // teil wie bei terrace(): 1 = nur, was steht · 2 = nur, was sich ändert
  oy = 0; roofT = t;
  const yEdge = cam.z < -NEAR ? P(0, 0, 0)[1] : S.h; if (yEdge < 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.w, yEdge + 1); ctx.clip(); // was hinter der Dachkante liegt, verdeckt das Haus
  tonAn('dach');
  const lamps = [-2.9, 0, 2.9], LY = TRUSS.h - 0.28;
  if (teil !== 2) {
  if (cam.y > 0.02) {
    poly([[TXL, 0, 0], [TXR, 0, 0], [TXR, 0, RD], [TXL, 0, RD]], lg([0, 0, 0], [0, 0, RD], [[0, '#14141d'], [1, '#1d1c29']]));
    { const f = []; for (let z = 2; z < RD; z += 2) f.push([[TXL, 0, z], [TXR, 0, z]]); if (AUSSEN_FEIN) for (let x = TXL + 1.2; x < TXR; x += 1.2) f.push([[x, 0, 0.35], [x, 0, RD]]); linien(f, 'rgba(0,0,0,.25)', 1); } // Platten des Dachbelags (ausgearbeitet auch die Längsfugen)
    poly([[TXL, 0.004, 0], [TXR, 0.004, 0], [TXR, 0.004, 0.35], [TXL, 0.004, 0.35]], '#0b0b12');
  }
  // Kopf des Schachts
  const hh = rectZ(SHAFT.x0, SHAFT.x1, 0, 2.7, SHAFT.z);
  if (hh) { ctx.fillStyle = `rgba(${LAV},.05)`; ctx.fillRect(hh[0], hh[1], hh[2], hh[3]); ctx.strokeStyle = `rgba(${LAV},.4)`; ctx.lineWidth = lwAt(SHAFT.z, 0.04); ctx.strokeRect(hh[0], hh[1], hh[2], hh[3]); }
  // Lichtkegel in den Himmel
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
  dachFest(0); // Brüstung aus Glas, Rückwand der Bühne, Pflanzkübel hinter der Bühne
  // Traverse hinten
  truss([-TRUSS.x, 0, TRUSS.z], [-TRUSS.x, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9); truss([TRUSS.x - 0.38, 0, TRUSS.z], [TRUSS.x - 0.38, TRUSS.h, TRUSS.z], [0.38, 0, 0], 9);
  truss([-TRUSS.x, TRUSS.h, TRUSS.z], [TRUSS.x, TRUSS.h, TRUSS.z], [0, 0.45, 0], 16);
  // Bühne
  box(STAGE.x0, STAGE.x1, 0, STAGE.y, STAGE.z0, STAGE.z1, lg([0, STAGE.y, STAGE.z0], [0, STAGE.y, STAGE.z1], [[0, '#2c2a3a'], [1, '#201f2c']]), '#12121a', '#191822');
  fillZ(STAGE.x0, STAGE.x1, STAGE.y - 0.1, STAGE.y - 0.04, STAGE.z0 - 0.01, `rgba(${LAVH},${0.3 + 0.65 * spots})`);
  if (spots > 0.01) { ctx.globalCompositeOperation = 'lighter'; poly([[STAGE.x0, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z0], [STAGE.x1, STAGE.y + 0.004, STAGE.z1], [STAGE.x0, STAGE.y + 0.004, STAGE.z1]], `rgba(${LAV},${0.16 * spots})`); ctx.globalCompositeOperation = 'source-over'; }
  dachFest(1); // Bühnenboden mit Dielen, Stufe, Lautsprecher, Pflanzkübel vorn
  // der Platz des Kerns: ein Ring auf dem Bühnenboden
  if (cam.y > STAGE.y) { const c = P(0, STAGE.y + 0.006, STAGE.zc), rx = (0.75 * S.f) / (STAGE.zc - cam.z), ry = Math.abs(P(0, STAGE.y, STAGE.zc - 0.75)[1] - P(0, STAGE.y, STAGE.zc + 0.75)[1]) / 2; ctx.strokeStyle = `rgba(${LAVH},${0.45 + 0.4 * spots})`; ctx.lineWidth = lwAt(STAGE.zc, 0.03); ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, Math.max(0.5, ry), 0, 0, 7); ctx.stroke(); }
  }
  if (p >= floorRange(HALTS - 2)[1] - 0.03) terrace(roofT, teil);
  // Scheinwerfer
  if (teil !== 2) lamps.forEach((lx, i) => {
    const on = clamp01(spots * 3 - i * 0.7), q = P(lx, LY, TRUSS.z), r = (0.3 * S.f) / (TRUSS.z - cam.z);
    seg([lx, TRUSS.h, TRUSS.z], [lx, LY, TRUSS.z], '#0a0a11', lwAt(TRUSS.z, 0.05));
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.5, r), 0, 7); ctx.fill();
    ctx.fillStyle = on > 0 ? `rgba(246,240,255,${0.3 + 0.7 * on})` : '#252432'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, r * 0.62), 0, 7); ctx.fill();
    if (on > 0) glow(lx, LY, TRUSS.z, 1.8, [[0, `rgba(${LAVH},${0.8 * on})`], [0.3, `rgba(${LAV},${0.3 * on})`], [1, `rgba(${LAV},0)`]]);
  });
  tonAus(); ctx.restore();
}

/* Das Licht der Marke: MAKE Studios warm in Signal, MAKE Revenue kühl in Tiefblau und Hellblau. Der Kern bleibt violett (er wird danach gezeichnet). */
const goldAnteil = (tz) => smooth((tz - 0.44) / 0.16) * (1 - smooth((tz - 0.7) / 0.1));
function markenLicht() {
  { const gold = INS.k * goldAnteil(TZ); if (gold > 0.01 && INS.F) { const w = S.w, hh = S.h; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,214,168,${0.4 * gold})`; ctx.fillRect(0, 0, w, hh);
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(w, hh * 0.2, w * 0.3, hh * 0.8); g.addColorStop(0, `rgba(255,170,90,${0.26 * gold * (0.4 + 0.6 * smooth((gold - 0.5) / 0.4))})`); /* bei halber goldener Stunde schwächer: Es färbte die helle Decke von MAKE Innovation rosa */ g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); ctx.globalCompositeOperation = 'source-over'; } }
  const k = INS.k * (1 - 0.88 * tagWerte().innen); if (k <= 0.01 || !INS.F) return; const MK = MARKE[INS.F.key], w = S.w, hh = S.h; // am Tag ist die Raumfarbe ein Akzent, kein Nachtlicht
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(${MK.tief},${(MK.licht || 0.42) * k})`; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w * 0.58, hh * 0.18, 0, w * 0.58, hh * 0.18, Math.max(w, hh) * 0.85);
  g.addColorStop(0, `rgba(${MK.rgb},${(MK.schein ?? 0.11) * k})`); g.addColorStop(1, `rgba(${MK.rgb},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
  ctx.globalCompositeOperation = 'source-over';
}
/* Was im Raum steht, wird einmal auf eine eigene Fläche gezeichnet (Himmel, Stadt, Wände, Decke, Boden, alles an der Wand). Solange die Kamera steht und niemand kommt oder geht,
   setzt jedes Bild nur diese Fläche ein und zeichnet davor die Dinge mit Tiefe und die Menschen. So kostet das Leben in Ruhe (Atmen, Hände, Blicke) fast nichts. */
/* RUHEBILD: im Raum die ganze ruhende Fläche (Himmel, Stadt, Wände, Decke, Boden, alles an der Wand); auf dem Dach und im Finale nur, was VOR dem Himmel steht (Stadt, Haus, Dach):
   Dort wird der Himmel je Bild eingesetzt (er ändert sich mit der Dämmerung), dahinter steigt das Feuerwerk, davor liegt diese Fläche.
   Angelegt wird sie erst, wenn die Kamera eine Weile steht (RUHE_AB): Solange sie fährt (Hineingehen, Umsehen, Karte), wird direkt gezeichnet.
   Und nie in einem Bild: Die Fläche entsteht auf einer zweiten (RUHE2) in zwei bis drei Scheiben, in den Takten, in denen sonst nichts gezeichnet wird (ruheBau);
   so lange wird weiter direkt gezeichnet, dann werden die Flächen getauscht. Kein Takt zeichnet so mehr als ein Bild der Fahrt.
   Auf dem Dach entsteht auf dieselbe Weise die nächste Fassung der Dämmerung (TAG_STUFEN, art 'B') und wird eingeblendet. */
const RUHEBILD = { c: null, g: null, key: '', dinge: null, zuvor: '', seit: 0, tz: 1, f: 0, p: 0, t: 0 };
const RUHE2 = { c: null, g: null, key: '', tz: 1, schritt: -1, schritte: 3, art: '', innen: false, dinge: null, eng: 0, p: 0, t: 0 };
const TAG_STUFEN = [1];                   // die Fassungen der Dämmerung auf dem Dach (Tageszeit): Sonnenuntergang ist die Ankunft, danach in vier Schritten zur Nacht
const TAG_RUHIG = 0.93;                                    // „weniger Bewegung“: das Dach steht in der Abendstimmung, die Lichter sind an
const DAEMM_VOR = 900, DAEMM_DAUER = 9500;                 // ms: so lange steht der Sonnenuntergang nach der Ankunft, so lange dauert die Dämmerung danach
const FINALE_AB = 0.9;                                     // ab dieser Stelle der Zeitachse (das Finale) ruht auch die Ansicht des ganzen Hauses auf einer Fläche
const BLENDE_MS = 280;                                      // so lange blendet im Raum die ausgearbeitete ruhende Fläche über das einfache Bild ein (kein Sprung, wenn die Kamera zur Ruhe kommt)
const RUHE_AB = 260;                                        // ms: so lange muss die Kamera stehen, bevor die ruhende Fläche angelegt wird (bis dahin wird direkt gezeichnet; ein langsames Stück einer Fahrt löst so nichts aus)
const TZ_FEST = QUERY.has('tz') ? clamp01(+QUERY.get('tz')) : null; // nur zum Prüfen: ?tz=0.9 hält die Tageszeit fest
let DAEMM = 0, DAEMM_T = 0, DAEMM_WARTET = false;          // DAEMM: 0 = Sonnenuntergang wie bei der Ankunft … 1 = Nacht
function ruheSchluessel(F) { // nichts hier hängt an einer Leistung: Gehen, Kommen und Varianten ändern die ruhende Fläche nicht (was davon abhängt, ist ein Ding)
  if (F.key === 'strasse') return STILL ? '' : `strasse|${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}`; // der Empfang ruht wie ein Raum (Auftrag Y), auch ohne Leistungen und Tür
  const st = RAUM[F.key]; if (!st || STILL || (!st.tuer && !F.roof)) return '';
  return `${F.key}|${cam.x}|${cam.y}|${cam.z}|${F.roof ? 0 : S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}|${TEX.web0 ? 1 : 0}`; // auf dem Dach ohne Brennweite: Das Näherkommen im Halt (NAH) vergrößert die Fläche nur (ruheSetzen), sie entsteht dabei nicht neu
}
/* Die ruhende Fläche einsetzen. f = Brennweite, mit der sie gezeichnet wurde: Steht die Zeichnung inzwischen etwas näher, wird die Fläche um den Fluchtpunkt vergrößert. */
function ruheSetzen(c, f) { const k = f > 0 ? S.f / f : 1; if (Math.abs(k - 1) < 1e-5) ctx.drawImage(c, 0, 0); else ctx.drawImage(c, S.cx * (1 - k), S.cy * (1 - k), S.w * k, S.h * k); }
/* Die Fassungen der Dämmerung (TAG_STUFEN) liegen fertig bereit, bevor die Dämmerung beginnt: Sie entstehen gleich nach der ruhenden Fläche des Dachs in Scheiben (daemmBau), jede wird einmal fast unsichtbar
   eingesetzt (so liegt sie auf der Grafikkarte). Bis dahin wartet die Dämmerung (DAEMM_WARTET). Während der Dämmerung wird nur noch überblendet. */
const DST = { key: '', fertig: false, c: null, g: null, schritt: 0, p: 0, t: 0, f: 0, eng: 0 };
function daemmBau() { // die Nacht entsteht in voller Größe auf der zweiten Fläche (RUHE2, sie ist gerade frei) und wird in halber Größe abgelegt
  const D = DST, R = RUHEBILD, B = RUHE2; if (!D.key || D.fertig || D.key !== R.key || !KAM_STEHT || (B.schritt >= 0 && B.schritt < B.schritte)) return false;
  if (D.schritt >= 3) {
    if (!D.c) { D.c = document.createElement('canvas'); D.g = D.c.getContext('2d'); }
    const w = Math.ceil(S.w / 2), h = Math.ceil(S.h / 2); if (D.c.width !== w || D.c.height !== h) { D.c.width = w; D.c.height = h; } else D.g.clearRect(0, 0, w, h);
    D.g.drawImage(B.c, 0, 0, w, h);
    ctxBild.save(); ctxBild.setTransform(1, 0, 0, 1, 0, 0); ctxBild.globalCompositeOperation = 'source-over'; ctxBild.globalAlpha = 0.004; ctxBild.drawImage(D.c, 0, 0, 32, 32, 0, 0, 32, 32); ctxBild.restore(); // einmal fast unsichtbar einsetzen: So liegt sie auf der Grafikkarte
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
let TEIL_T = 0; const teil = (n) => { const z = MESS.z; if (!z) return; const t = performance.now(); if (n) z.akt.teile = (z.akt.teile || '') + n + (t - TEIL_T).toFixed(1) + ' '; TEIL_T = t; }; // nur zum Messen: Zeit je Teil des Bildes (h Himmel · c Stadt · s Straße · r Räume · t Turm · m Licht · d Dach · k Kern · w Passanten · v vorn · p Schilder)
/* Ein Bild, das steht (Publikum auf dem Dach): Fährt die Kamera, bleibt das vorhandene liegen und wird passend eingesetzt; je Bild entsteht höchstens eines neu (steht die Kamera: zwei), bis alle stimmen. */
const STEMPEL_STAND = new Map();
function stempelRuhig(name, schluessel, x, y, k, male, kb = 0) { // kb = Auflösung des Bilds, wenn sie nicht die Größe im Bild sein soll (feste Stufen)
  const alt = STEMPEL_STAND.get(name), grob = !!alt && !!kb && k > alt.k * (KAM_STEHT ? 1.02 : 1.35); // mit fester Stufe (kb): neu nur, wenn das Bild zu grob ist oder der Schlüssel (Blickwinkel, Takt des Lebens) nicht mehr stimmt; ein zu feines Bild bleibt
  if (!alt || alt.key !== schluessel || grob) {
    if (STEMPEL_FREI > 0 && (!alt || grob || (kb ? KAM_STEHT && alt.key !== schluessel : KAM_STEHT || k > alt.k * 1.35 || k < alt.k * 0.5))) { STEMPEL_FREI--; STEMPEL_STAND.set(name, { key: schluessel, k: Math.max(kb || k, k) }); return FIG.stempel(ctx, name, schluessel, x, y, k, male, 1, false, kb); } // (ist die Auflösung gedeckelt, gilt die Größe im Bild: sonst gälte das Bild immer als zu grob)
    if (!alt) { NOCHMAL = true; return null; } // noch kein Bild: im nächsten Bild
    if (KAM_STEHT) NOCHMAL = true;
  }
  return FIG.stempel(ctx, name, schluessel, x, y, k, male, 1, true);
}
/* Alles, was von außen vor dem Himmel steht: Stadt und Straße (0), die Räume hinter Glas und das Haus (1), das Dach (2). nur = nur dieser Schritt (zum Anlegen in Scheiben) */
function aussenMalen(p, t, teil, nur = -1) {
  if (nur < 0 || nur === 0) { drawCity(); street(); }
  if (nur < 0 || nur === 1) { const half = (Math.max(S.cy, S.h - S.cy) * -cam.z) / S.f; for (const F of FLOORS) if (!F.roof && Math.abs(F.base + F.y1 / 2 - cam.y) < half + F.y1) room(F, t); tower(); }
  if (nur < 0 || nur === 2) roof(p, t, teil);
}
const flaeche = (R) => { if (!R.c) { R.c = document.createElement('canvas'); R.g = tonHaken(R.c.getContext('2d')); } if (R.c.width !== S.w || R.c.height !== S.h) { R.c.width = S.w; R.c.height = S.h; return true; } return false; };
const naechsteStufe = (tz) => { for (const s of TAG_STUFEN) if (s > tz + 0.001) return s; return null; };
/* Eine Scheibe der nächsten Fläche anlegen (aus der Bildschleife, in einem Takt, in dem sonst nichts gezeichnet wird). art 'A' = die ruhende Fläche selbst (danach wird getauscht), 'B' = die nächste Fassung der Dämmerung */
function bauStarten(key, innen, p, t) { const B = RUHE2; if (B.art === 'A' && B.key === key && B.schritt >= 0) return; B.art = 'A'; B.key = key; B.innen = !!innen; B.schritte = innen ? 2 : 3; B.schritt = 0; B.tz = TZ; B.p = p; B.t = t; B.eng = 0; B.f = innen ? S.f : S.f / (1 + NAH); }
function ruheBau() {
  const B = RUHE2, R = RUHEBILD; if (B.schritt < 0 || B.schritt >= B.schritte || !B.key || !KAM_STEHT) return false;
  if (B.art === 'A' ? B.key !== R.zuvor : B.key !== R.key) { if (B.art === 'A') { B.schritt = -1; B.key = ''; } return false; } // die Kamera steht inzwischen woanders
  const frisch = flaeche(B), c0 = ctx, tz0 = TZ, n = HOT.length, d0 = DINGE, f0 = S.f, tS = performance.now(), nS = MESS.z ? MESS.z.akt.neben : 0; if (!B.innen && B.f) S.f = B.f;
  ctx = B.g; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; if (B.schritt === 0 && !frisch && !B.innen) ctx.clearRect(0, 0, S.w, S.h);
  TZ = B.tz; B.eng = 0;
  try {
    if (!B.innen) { if (B.key.startsWith('aussen-strasse') && B.schritt === 1) FEIN = BACKT = true; AUSSEN_FEIN = true; aussenMalen(B.p, B.t, 1, B.schritt); } // von der Straße aus: die Halle hinter Glas ausgearbeitet
    else if (B.schritt === 0) { himmel(); FEIN_STADT = true; drawCity(); FEIN_STADT = false; street(); }
    else if (B.schritt === 1) { FEIN = BACKT = true; room(INS.F, B.t, true); B.dinge = DINGE; B.feste = DINGE.filter((d) => d.fest).sort((a, b) => b.z - a.z); B.fi = 0; }
    else { // die festen Dinge des Raums, das Fernste zuerst; je Scheibe so viele, wie in FEST_MS passen
      FEIN = BACKT = true; oy = INS.F.base; tonAn('ding'); const t1 = performance.now();
      for (let n = 0; B.fi < B.feste.length && n < FEST_JE && performance.now() - t1 < FEST_MS; n++) B.feste[B.fi++].fn(B.t);
    }
  } finally { ctx = c0; TZ = tz0; S.f = f0; TON.kl = null; oy = 0; HOT.length = n; DINGE = d0; FEIN = BACKT = AUSSEN_FEIN = false; }
  if (MESS.z) { if (MESS.flush) B.g.getImageData(0, 0, 1, 1); (MESS.scheiben || (MESS.scheiben = [])).push([B.innen ? 'raum' : 'aussen', B.schritt, +(performance.now() - tS).toFixed(2), MESS.z.akt.neben - nS]); } // nur zum Messen: Zeit und Befehle je Scheibe
  B.schritt++;
  if (B.innen && B.schritt >= 2) B.schritte = B.feste && B.fi < B.feste.length ? B.schritt + 1 : B.schritt; // so viele Scheiben, bis alle festen Dinge liegen
  if (B.art === 'A' && B.schritt >= B.schritte) { [R.c, B.c] = [B.c, R.c]; [R.g, B.g] = [B.g, R.g]; R.key = B.key; R.tz = B.tz; R.dinge = B.dinge; R.f = B.f; R.p = B.p; R.t = B.t; DST.key = ''; DST.fertig = false; B.key = ''; B.art = ''; B.schritt = -1; sceneDirty = true;
    R.blende = 0; if (B.innen && !reduce && !STATISCH && B.c.width === cv.width && B.c.height === cv.height) { B.g.setTransform(1, 0, 0, 1, 0, 0); B.g.globalAlpha = 1; B.g.globalCompositeOperation = 'source-over'; B.g.drawImage(cv, 0, 0); R.blende = -1; } } // im Raum: Das einfache Bild, das gerade steht, wandert auf die freie zweite Fläche und blendet danach aus (BLENDE_MS) // fertig: Das nächste Bild setzt die Fläche ein
  return true;
}
function drawScene(v, t) {
  const p = v.pz; // Stelle für Kern und Licht (bei einem Flug weicht sie von der Stelle der Kamera ab)
  kamera(v); if (NAH) S.f *= 1 + NAH; raumBlick(); HOT.length = 0; oy = 0; spots = span(p, SPOTS); marks = span(p, [THREAD[0] + 0.018, THREAD[1]]) * (1 - span(p, FADEN_OUT)); beacon = span(p, THREAD) * (1 - 0.55 * span(p, [FADEN_OUT[0], SPOTS[1]]));
  TZ = TZ_FEST != null ? TZ_FEST : mischZ(v.tz ?? 1, 1, DAEMM); DAEMM_WARTET = false;
  { const o0 = S.narrow ? 0.6 : 0.3, o = Math.round((o0 + (1 - o0) * tagWerte().nacht) * 50) / 50; if (o !== SHADE_O && SHADE) { SHADE_O = o; SHADE.style.opacity = String(o); } } // der dunkle Rand über der Zeichnung (haus.css › .seq-shade) gehört zur Nacht
  ctx = tonHaken(ctxBild); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; TON.kl = null;
  KERN = coreState(p); KERN.fertig = false;
  const sig = `${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}`; KAM_STEHT = sig === KAM_SIG; KAM_SIG = sig; STEMPEL_FREI = 1; RUHE_FREI = 1; WALK_FREI = 1; RUHE_N = 0; BEW_ZAHL = BEW_I; BEW_I = 0; BEW_TAKT++;
  ZELLEN_FREI = 1;
  { const hk = !TROCKEN.an && AKT.F && AKT.k >= 1 ? AKT.F.key : ''; if (hk && hk !== RAUM_HIER) { RAUM_HIER = hk; raeumen(RAUM[hk]); } }
  if (reduce || STATISCH) STEMPEL_FREI = RUHE_FREI = WALK_FREI = 999; // Standbild und „weniger Bewegung“: Jede Szene wird nur einmal gezeichnet, also entsteht sofort jedes Bild
  if (TROCKEN.an) STEMPEL_FREI = RUHE_FREI = WALK_FREI = 0; // beim Aufwärmen entsteht kein Bild eines Menschen (die kommen, wenn ihr Raum wirklich ins Bild kommt)
  const innen = cam.z > -1 && INS.k > 0 && INS.F, oben = !innen && AKT.F && AKT.F.roof && (AKT.k >= 1 || p >= FINALE_AB);
  /* Auch die Straße ruht (Auftrag Y): Steht die Kamera vor dem Haus auf der Straße, liegen Stadt, Straße, Halle hinter Glas und Fassade auf der ruhenden Fläche (in Scheiben angelegt wie auf dem Dach,
     die Halle dabei ausgearbeitet); je Bild werden nur Himmel, Fläche, Kern und Passanten gezeichnet. Die zwei am Empfang stehen so lange still (sie sind von dort winzig). */
  const unten = !innen && !oben && !STILL && !reduce && !STATISCH && !TROCKEN.an && cam.z < -4.5 && -cam.z <= 40 && cam.y - GROUND < 9 && cam.y > GROUND + 0.3;
  let key = innen && INS.k >= 1 ? ruheSchluessel(INS.F) : oben ? ruheSchluessel(AKT.F) : unten ? `aussen-strasse|${cam.x}|${cam.y}|${cam.z}|${S.f}|${S.cx}|${S.cy}|${S.w}|${S.h}|${Math.round(TZ * 100)}` : '';
  if (key) key += innen ? `|${Math.round(TZ * 100)}` : `|${p}`; // (der Empfang hat keine ruhende Fläche: ohne Schlüssel wird direkt gezeichnet)
  const R = RUHEBILD;
  if (key && oben && key === R.key) { const ziel = naechsteStufe(R.tz); if (TZ < R.tz - 0.003 || (ziel == null && TZ > R.tz + 0.003) || S.f < R.f * 0.9995 || S.f > R.f * 1.12) R.key = ''; } // die Tageszeit ist der Fläche davongelaufen (zurück vom Finale, zurück in den Tag): neu anlegen
  if (key && key !== R.key) { if (key !== R.zuvor) { R.zuvor = key; R.seit = t; } if (t - R.seit >= RUHE_AB) bauStarten(key, innen, p, t); else if (innen) raumLebt = Math.max(raumLebt, t + RUHE_AB + 80); key = ''; } // (im Raum wird weitergezeichnet, bis die ruhende Fläche angelegt werden kann: Auch bei „weniger Bewegung“ und in der Sparstufe, wo sonst nur ein Bild entsteht, kommt so die Ausarbeitung) // die Kamera bewegt sich oder die Fläche entsteht noch: direkt zeichnen
  else if (!key) R.zuvor = '';
  if (MESS.z) MESS.z.neu(key);
  teil();
  if (key) {
    PFAD = 'ruhe';
    if (innen) {
      ruheSetzen(R.c, R.f);
      teil('R'); DINGE = R.dinge; oy = INS.F.base; vornMalen(INS.F.key, t, true); oy = 0; teil('v'); tower(); teil('t'); markenLicht(); teil('m');
      if (R.blende) { if (R.blende < 0) R.blende = t; const kb = (t - R.blende) / BLENDE_MS; if (kb >= 1 || !RUHE2.c || RUHE2.schritt >= 0) R.blende = 0; else { ctx.globalAlpha = 1 - smooth(kb); ctx.drawImage(RUHE2.c, 0, 0); ctx.globalAlpha = 1; NOCHMAL = true; } } // die Ausarbeitung blendet ein
      if (PFAD === 'ruhe' && RAUM[INS.F.key]) vorwaermen(RAUM[INS.F.key], FOK.st === RAUM[INS.F.key] && FOK.st.offen ? FOK.st.offen : RAUM[INS.F.key].L.find((l) => l.hovZiel > 0) || null);
    } else if (unten) {
      himmel(); teil('h'); ruheSetzen(R.c, R.f); teil('R');
    } else {
      himmel(); teil('h'); feuerHinten(); teil('f');
      const D = DST; let a = 0;
      if (R.tz < 1 && TZ_FEST == null && !reduce) { // die Dämmerung: Die Nacht liegt bereit (sonst wartet sie), dann wird vom Sonnenuntergang in die Nacht überblendet
        if (D.key !== key) { D.key = key; D.fertig = false; D.schritt = 0; D.p = R.p; D.t = R.t; D.f = R.f; D.eng = 0; }
        if (!D.fertig) DAEMM_WARTET = true; else a = clamp01((TZ - R.tz) / (1 - R.tz));
      }
      if (a < 1) ruheSetzen(R.c, R.f);
      teil('R');
      if (a > 0.004) { const k = S.f / R.f; ctx.globalAlpha = a; ctx.drawImage(D.c, S.cx * (1 - k), S.cy * (1 - k), S.w * k, S.h * k); ctx.globalAlpha = 1;
        if (a >= 1) { R.zuvor = key; bauStarten(key, false, p, t); } } // es ist Nacht: Die ruhende Fläche entsteht in voller Größe neu, so lange steht die halbe
      teil('B'); roof(p, t, 2); teil('d'); feuerSchein(); teil('F');
      if (PFAD === 'ruhe' && AKT.k >= 1) vorwaermen(RAUM.dach, null);
    }
  } else {
    RUHEBILD.key = ''; RUHEBILD.blende = 0; PFAD = innen ? 'direkt' : 'aussen';
    himmel(); teil('h'); if (!innen) feuerHinten();
    drawCity(); teil('c');
    street(); teil('s');
    if (innen) { if (STATISCH) FEIN = true; try { room(INS.F, t); } finally { FEIN = false; } } // im Markenraum: nur dieser Raum (als Standbild bei „weniger Bewegung“ gleich ausgearbeitet: Dort entsteht jedes Bild nur einmal)
    else { const half = (Math.max(S.cy, S.h - S.cy) * -cam.z) / S.f; for (const F of FLOORS) if (!F.roof && Math.abs(F.base + F.y1 / 2 - cam.y) < half + F.y1) room(F, t); }
    teil('r'); tower(); teil('t');
    markenLicht(); teil('m');
    if (!innen) { roof(p, t); teil('d'); feuerSchein(); }
  }
  if (!KERN.fertig) drawCore(KERN);
  teil('k'); walkers(t); teil('w');
}

/* ═══════════════ DÄMMERUNG UND FEUERWERK ═══════════════
   Auf dem Dach kommt der Aufzug bei Sonnenuntergang an (Tageszeit der Szene). Danach läuft die Dämmerung von selbst (DAEMM_VOR, DAEMM_DAUER): Die Sonne sinkt hinter die Stadt,
   der Himmel wird Nacht, Lichterketten, Strahler und die Fenster der Stadt gehen nacheinander an, Sterne erscheinen. Wer wieder nach unten fährt, fährt zurück in den Tag.
   Ist es dunkel, steigt hinter der Stadt ein Feuerwerk auf: einzelne Raketen, ruhige Figuren (Kugel, Weide, Ring) in den Farben der Marke, in Gold und Weiß.
   Gezeichnet wird es als kurze Striche in wenigen Zügen je Farbe (kein Verlauf, kein Schatten je Teilchen), hinter der Fläche mit Stadt und Haus; sein Schein ist ein eingesetztes Bild.
   Es läuft nur, wenn Dach oder Finale zu sehen sind und der Reiter im Vordergrund ist. Stellwerte: FEUER_WERTE. */
const FEUER_WERTE = {
  pause: [2000, 4000],        // ms zwischen zwei Raketen auf dem Dach …
  spaeter: [6000, 11000],     // … und nach „ruhigAb“ ms
  ruhigAb: 60000,
  gleichzeitig: [3, 1],       // höchstens so viele Raketen und Figuren zugleich (Stufe 0, Stufe 1)
  sparPause: [8000, 13000],   // Sparstufe: seltene Einzelraketen
  finale: 4,                  // so viele letzte Raketen steigen im Finale
  finalePause: [2200, 3800],
  teilchen: { kugel: 108, weide: 72, ring: 56 }, // am Handy und in der Sparstufe gut die Hälfte
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
  const W = FEUER_WERTE, klein = S.narrow || STUFE ? 0.55 : 1, n = Math.round(W.teilchen[r.art] * klein), T = new Float32Array(n * 5), R = r.rad; // je Teilchen: x, y, vx, vy, Farbe (0 | 1)
  const kipp = 0.3 + Math.random() * 0.4, dreh = Math.random() * Math.PI;
  for (let i = 0; i < n; i++) {
    let vx, vy, f = 0;
    if (r.art === 'ring') { const a = (i / n) * TAU, cx = Math.cos(a), cy = Math.sin(a) * kipp, v = R * 2.5; vx = (cx * Math.cos(dreh) - cy * Math.sin(dreh)) * v; vy = (cx * Math.sin(dreh) + cy * Math.cos(dreh)) * v; if (i % 5 === 0) { vx *= 0.25; vy *= 0.25; f = 1; } }
    else { const a = Math.random() * TAU, innen = r.art === 'kugel' && i % 3 === 0, v = R * (r.art === 'weide' ? 1.9 : 3.1) * (innen ? 0.52 : 0.82 + Math.random() * 0.22) * Math.sqrt(0.25 + 0.75 * Math.random()); vx = Math.cos(a) * v; vy = Math.sin(a) * v * 0.94 - (r.art === 'weide' ? R * 0.5 : 0); f = innen ? 1 : 0; }
    T[i * 5] = r.x; T[i * 5 + 1] = r.y; T[i * 5 + 2] = vx; T[i * 5 + 3] = vy; T[i * 5 + 4] = f;
  }
  FEUER.figuren.push({ x: r.x, y: r.y, t: 0, dauer: r.art === 'weide' ? 3000 : r.art === 'ring' ? 1700 : 2000, art: r.art, farbe: r.farbe, T, n, rad: R, zug: r.art === 'weide' ? 1.5 : 2.3, fall: R * (r.art === 'weide' ? 1.15 : 0.42) });
}
/* Ein Takt: Raketen steigen, Figuren fallen. → es bewegt sich etwas (dann wird jedes Bild gezeichnet) */
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
  } else if (F.naechste < 600) F.naechste = 600; // beim Ankommen nicht sofort
  const s = dt / 1000;
  for (let i = F.raketen.length - 1; i >= 0; i--) { const r = F.raketen[i]; r.t += dt; const k = Math.min(1, r.t / r.dauer), e = 1 - (1 - k) * (1 - k); r.y = r.y0 + (r.yz - r.y0) * e; r.x = r.x0 + r.dx * k; if (k >= 1) { F.raketen.splice(i, 1); feuerPlatzen(r); } }
  for (let i = F.figuren.length - 1; i >= 0; i--) {
    const f = F.figuren[i], T = f.T, zug = Math.exp(-f.zug * s); f.t += dt; if (f.t >= f.dauer) { F.figuren.splice(i, 1); continue; }
    for (let j = 0; j < f.n * 5; j += 5) { T[j + 2] *= zug; T[j + 3] = T[j + 3] * zug + f.fall * s; T[j] += T[j + 2] * s; T[j + 1] += T[j + 3] * s; }
  }
  return F.raketen.length + F.figuren.length > 0;
}
/* Hinter Stadt und Haus: Raketen als heller Strich, die Figuren als Strahlen mit hellem Kopf. Je Figur vier Züge: ein breiter, schwacher Zug als Schein, je Farbe ein schmaler heller,
   dazu alle Köpfe als kleine Rechtecke in einem Zug. Zum Ende funkeln die Teilchen (jedes Bild fehlt ein anderes Drittel). */
let feuerBildNr = 0;
function feuerHinten() {
  const F = FEUER; if (!F.raketen.length && !F.figuren.length) return;
  const u = Math.max(1, S.h / 900); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; feuerBildNr++;
  for (const r of F.raketen) { const k = r.t / r.dauer, l = S.h * 0.07 * (1 - k * 0.5), nx = r.dx / (r.y0 - r.yz); ctx.strokeStyle = `rgba(255,214,150,${0.3 * (1 - k * 0.3)})`; ctx.lineWidth = 3.6 * u; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + nx * l, r.y + l); ctx.stroke(); ctx.strokeStyle = `rgba(255,240,214,${0.9 * (1 - k * 0.3)})`; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + nx * l * 0.5, r.y + l * 0.5); ctx.stroke(); }
  for (const f of F.figuren) {
    const k = f.t / f.dauer, weide = f.art === 'weide', aus = 1 - smooth((k - 0.42) / 0.58), T = f.T, sp = weide ? 0.32 : 0.14, zurueck = (weide ? 0.34 : 0.2) * (1 - k), funkelt = k > 0.5, m = feuerBildNr % 3;
    if (k < 0.2) { const a = 1 - k / 0.2, r = f.rad * (0.5 + 2 * k); ctx.globalAlpha = a * 0.95; ctx.drawImage(feuerBild(f.farbe[1]), f.x - r, f.y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; } // der Blitz beim Platzen
    const zug = (farbe) => { ctx.beginPath(); for (let j = 0, i = 0; j < f.n * 5; j += 5, i++) { if ((farbe >= 0 && T[j + 4] !== farbe) || (funkelt && i % 3 === m)) continue; const x = T[j], y = T[j + 1]; ctx.moveTo(x - T[j + 2] * sp - (x - f.x) * zurueck, y - T[j + 3] * sp - (y - f.y) * zurueck); ctx.lineTo(x, y); } ctx.stroke(); };
    ctx.strokeStyle = `rgba(${f.farbe[0]},${0.2 * aus})`; ctx.lineWidth = (weide ? 4 : 5) * u; zug(-1);
    for (let farbe = 0; farbe < 2; farbe++) { ctx.strokeStyle = `rgba(${f.farbe[farbe]},${0.95 * aus})`; ctx.lineWidth = (weide ? 1.2 : 1.6) * u; zug(farbe); }
    const kopf = (weide ? 1.1 : 1.5) * u * (0.7 + 0.3 * aus); ctx.fillStyle = `rgba(255,250,240,${0.95 * aus})`; ctx.beginPath();
    for (let j = 0, i = 0; j < f.n * 5; j += 5, i++) { if (funkelt && i % 3 === m) continue; ctx.rect(T[j] - kopf, T[j + 1] - kopf, 2 * kopf, 2 * kopf); }
    ctx.fill();
  }
  ctx.restore();
}
/* Vor allem anderen: der Schein einer Figur färbt kurz Himmel, Haus und Terrasse */
function feuerSchein() {
  const F = FEUER; if (!F.figuren.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const f of F.figuren) { const k = f.t / f.dauer, a = (1 - smooth(k / 0.5)) * 0.26; if (a < 0.01) continue; const r = Math.max(S.w, S.h) * 0.5; ctx.globalAlpha = a; ctx.drawImage(feuerBild(f.farbe[0]), f.x - r, f.y - r, 2 * r, 2 * r); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
let tagZuvor = 0;
function tagSchritt(now) { // die Zeit der Dämmerung und des Feuerwerks, einmal je Takt. → es bewegt sich etwas von selbst
  const dt = Math.min(100, tagZuvor ? now - tagZuvor : 16); tagZuvor = now;
  if (reduce || STATISCH || DACH_SZ < 0) return false;
  const lage = sS.v, d0 = DAEMM, ganz = DAEMM_VOR + DAEMM_DAUER;
  if (lage > DACH_SZ + 0.3) DAEMM_T = ganz;                                                                  // auf dem Weg ins Finale ist es Nacht
  else if (lage >= DACH_SZ - 0.004) { if (!DAEMM_WARTET || DAEMM_T < DAEMM_VOR) DAEMM_T = Math.min(DAEMM_WARTET ? DAEMM_VOR : ganz, DAEMM_T + dt * (lage > DACH_SZ + 0.004 ? 3 : 1)); } // angekommen: die Dämmerung läuft
  else DAEMM_T = Math.max(0, DAEMM_T - dt * 6);                                                              // wieder nach unten: zurück in den Tag
  DAEMM = clamp01((DAEMM_T - DAEMM_VOR) / DAEMM_DAUER);
  const feuer = feuerSchritt(dt, lage); if (feuer || DAEMM !== d0) sceneDirty = sceneDirty || feuer;
  return feuer || DAEMM !== d0;
}

/* Prüfmodus: Canvas als Bild ausgeben (ein verstecktes Vorschaufenster zeigt Canvas-Änderungen nicht) */
function snap(c) { if (!STILL) return; c.style.visibility = 'hidden'; c.parentElement.style.background = `url(${c.toDataURL('image/jpeg', 0.9)}) center / cover no-repeat`; }

/* ═══════════════ Aufbau der Seite: die Szenen ═══════════════ */
const SZ = /*SZENEN*/[]/*SZENEN-ENDE*/;   // je Szene: id, art, raum, alt und bild (p, pz, ue, zone, zoom …)
const N = SZ.length; const DACH_SZ = SZ.findIndex((x) => x.id === 'dach');
function tzVonP(p) { let i = 0; while (i < N - 2 && p > SZ[i + 1].p) i++; return lerp(SZ[i].tz ?? 1, SZ[i + 1].tz ?? 1, clamp01((p - SZ[i].p) / (SZ[i + 1].p - SZ[i].p))); } // im Standbild (?p=): die Tageszeit der Stelle
                       // nach der letzten Szene wächst der Kreis (Übergang in die Kurz-Startseite); seine Länge steht in haus.css (--kreis)
const kopf = $('.kopf');
const track = $('#top'), star = $('#star'), starTint = $('#starTint'), skip = $('#ueberspringen');
const panels = SZ.map((s) => $('#szene-' + s.id));
const etagenNav = $('#etagen'), wahl = $('#etagenwahl');
const KURZ = () => document.getElementById('kurz') || document.getElementById('einstieg');
const spurTop = () => track.getBoundingClientRect().top + scrollY;

/* ═══════════════ STELLWERTE DES SCROLLENS (eine Zahl ändern genügt) ═══════════════
   Die LÄNGEN von Halt und Fahrt je Szene stehen in haus.css ganz oben (--halt-…, --fahrt-…, --kreis). Hier steht, wie sich das Scrollen anfühlt. */
const LENIS = { lerp: 0.09, wheelMultiplier: 0.75 }; // weiches Scrollen am Rechner (Rad, Trackpad): lerp kleiner = weicher und träger · wheelMultiplier kleiner = langsamer (1 = so schnell wie der Browser)
const ANLAUF = 0.2;              // Anteil der Fahrt, in dem Aufzug bzw. Kamera anfahren und am Ende wieder ausrollen (0 = gleichmäßig, 0.5 = durchgehend weich)
const TAFEL_BLENDE = 0.2;        // die Tafel blendet im ersten Fünftel der Fahrt aus, die nächste im letzten Fünftel ein; dazwischen fährt nur die Zeichnung
const NAEHER = 0.03;             // im Halt kommt die Zeichnung beim Scrollen ganz langsam näher (0.03 = 3 %), damit der Raum lebt; 0 = sie steht still
const RUHE = 350, RUHE_UNKLAR = 700; // ms ohne Eingabe und ohne Bewegung, bevor die Seite aus einer FAHRT zum näheren Halt gleitet; „unklar“ = Bewegung ohne erkennbare Eingabe (z. B. gezogene Bildlaufleiste)
const RAST_AB = 0.15;            // ab diesem Anteil der Fahrt (in Scrollrichtung gezählt) gleitet sie weiter zum Halt, auf den man zufährt, davor zurück zum letzten. 0.5 = immer zum näheren Halt · kleiner (z. B. 0.25) = ein angefangener Schritt wird eher zu Ende gefahren
const RAST_DAUER = [700, 1300];  // ms für dieses Gleiten (kurzer bis langer Weg)
const RAST_TIEFE = 0.04;         // so weit (in Fensterhöhen) gleitet sie in den Halt hinein, damit ein Zittern am Rand nicht gleich wieder losfährt
const TASTE_DAUER = [900, 1400]; // ms für eine Fahrt per Taste, Knopf oder Leiste (kürzeste, längste) …
const TASTE_JE_HOEHE = 400;      // … dazwischen so viele ms je Fensterhöhe Weg

/* ── Der Weg der Fahrt: EINE Stelle für Zeichnung, Tafeln, Leisten, Tasten und Einrasten ──
   Jede Szene hat auf der Spur erst einen HALT (der Raum steht, die Tafel ist voll da) und dann eine FAHRT zur nächsten Szene (Aufzug bzw. Kamera fährt).
   Die Längen stehen in haus.css und werden an den Raststellen (.snap) gemessen (Höhe = Halt + Fahrt, padding-top = Halt), nie aus der Fensterhöhe gerechnet:
   Am Handy ändert sich die Fensterhöhe mit der Adressleiste, die Spur (vh) nicht. So springt beim Ein- und Ausblenden der Leiste nichts.
   ortVon(y) macht aus einer Scroll-Lage den Ort: i = Szene · h = Anteil im Halt (0 … 1) · t = Anteil der Fahrt (0 = im Halt) · lage = Stelle für die Zeichnung
   (im Halt genau i, in der Fahrt mit Anfahren und Ausrollen von i nach i + 1) · kreis = Anteil des Übergangs nach der letzten Szene. */
const rastEls = $$('.snap', track), snapsEl = $('.snaps', track);
let WEG = rastEls.map(() => ({ y: 0, halt: 0, fahrt: 1 })), U = innerHeight, HALTE = false; // WEG[i] = { y, halt, fahrt } in px ab Anfang der Spur · U = eine Fensterhöhe der Spur (100vh) · HALTE = es gibt Halte (am Rechner)
function messen() {
  const o = track.getBoundingClientRect().top;
  WEG = rastEls.map((el) => { const r = el.getBoundingClientRect(), halt = Math.min(r.height, parseFloat(getComputedStyle(el).paddingTop) || 0); return { y: r.top - o, halt, fahrt: Math.max(1, r.height - halt) }; }); // genau, nicht auf ganze Pixel gerundet (Zoom)
  U = (snapsEl && parseFloat(getComputedStyle(snapsEl).paddingBottom)) || innerHeight;
  HALTE = WEG.some((w) => w.halt > 1);
}
messen();
function schwung(t) { // Anfahren und Ausrollen: die Geschwindigkeit steigt im ersten Stück an, bleibt gleich und fällt im letzten Stück ab. Ohne Halte (Finger) läuft die Lage gleichmäßig mit.
  if (!HALTE || ANLAUF <= 0) return t;
  const a = Math.min(0.5, ANLAUF), v = 1 / (1 - a);
  return t < a ? (v * t * t) / (2 * a) : t > 1 - a ? 1 - (v * (1 - t) * (1 - t)) / (2 * a) : v * (t - a / 2);
}
function schwungZurueck(f) { // die Umkehrung: aus dem Anteil der Lage der Anteil der Fahrt
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
function yVonLage(v) { // die Scroll-Lage, an der die Zeichnung an der Stelle v steht
  const i = Math.max(0, Math.min(N - 1, Math.floor(v))), f = Math.min(1, Math.max(0, v - i)), w = WEG[i];
  return spurTop() + w.y + w.halt + (i < N - 1 ? schwungZurueck(f) * w.fahrt : 0);
}
const istRaum = (i) => SZ[i].art === 'raum' || SZ[i].art === 'empfang';
/* Im Raum bewegt das Scrollen nur das Hinein und Heraus der Kamera: am Anfang des Halts von der Schwelle in den Raum, am Ende wieder zurück (TRITT_ANTEIL), dazwischen steht alles. */
const trittVon = (o) => (!HALTE ? 1 : o.t > 0 || !istRaum(o.i) ? 0 : smooth(o.h / TRITT_ANTEIL) * (1 - smooth((o.h - (1 - TRITT_ANTEIL)) / TRITT_ANTEIL)));
const nahVon = (o) => (HALTE && NAEHER && !istRaum(o.i) ? NAEHER * (o.t > 0 && o.i < N - 1 ? 1 - schwung(o.t) : smooth(o.h)) : 0); // im Halt kommt die Zeichnung näher, in der Fahrt geht sie auf die Grundstellung der nächsten Szene zurück
/* Wohin Tasten, Leisten und Direkteinstiege zielen: die Mitte des Halts (Szene 1: der Anfang der Seite). */
const szeneY = (i) => (STATISCH ? Math.round(panels[i].getBoundingClientRect().top + scrollY - 8) : Math.round(spurTop() + WEG[i].y + (i > 0 ? WEG[i].halt / 2 : 0)));
const kurzY = () => { const k = KURZ(); return Math.round(k ? k.getBoundingClientRect().top + scrollY : spurTop() + track.offsetHeight); };
const aufBuehne = () => { const bb = track.getBoundingClientRect(); return bb.top <= 1 && bb.bottom >= innerHeight - 1; }; // die Bühne steht im Bild (nicht davor, nicht beim Hinausschieben danach)
const MESS = { n: 0, ms: 0, max: 0, t0: performance.now(), lang: [], z: null, takt: 0, mpMax: 0 }; // nur zum Messen: wie viele Bilder gezeichnet wurden und wie lange eines dauert
/* Zählen (nur zum Messen): __haus.zaehlen(true) hängt sich an die Zeichenbefehle und zählt je gezeichnetem Bild nach Art, getrennt nach dem Bild selbst (samt ruhender Fläche)
   und allem, was nebenher auf kleine unsichtbare Flächen gezeichnet wird (Ruhebilder, Vorzeichnen). __haus.zaehlen() gibt die Bilder seit dem letzten Aufruf zurück,
   __haus.messen() eine Zusammenfassung (Mitte und Höchstwert je Bild, Abstände zwischen den Bildern des Browsers). Kostet nichts, solange es nicht eingeschaltet ist. */
/* Spur und Film (nur zum Messen, werkzeug/haus-bewegung.mjs): __haus.spur(raum, leistung, n) verfolgt einen Menschen: je gezeichnetem Bild, was von ihm im Bild liegt (Art des Bilds, Stelle im Raum, gezeichnete Richtung,
   Auflösung des Bilds, Kopf, Becken, Knöchel und Hände im Bild, die Knöchel im Raum). __haus.film(n, b, h) legt die nächsten n Bilder des Browsers als Ausschnitt um diesen Menschen nebeneinander auf eine Fläche. */
function spurMerk(f, zs, art, p, dreh, kq, k, q, auge, dz) {
  const U = MESS.spur, pk = FIG.punkte(f.m, p, q[0], q[1], k, { dreh, auge, dz }), hd = Math.PI + Math.atan2(zs.x - cam.x, dz) - dreh, c = Math.cos(hd), s = Math.sin(hd), g = f.m.gr, r3 = (v) => +v.toFixed(3);
  const welt = (a) => [r3(zs.x + g * (a[0] * c + a[2] * s)), r3(zs.z + g * (-a[0] * s + a[2] * c)), r3(g * (a[1] - pk.grund))], r1 = (a) => [+a[0].toFixed(2), +a[1].toFixed(2)];
  U.q = q; if (U.d.length < 6000) U.d.push({ t: +lastT.toFixed(1), a: art, x: r3(zs.x), z: r3(zs.z), s: r3(zs.s || 0), q: r3(zs.q), dreh: r3(dreh), hd: r3(hd), kq: +kq.toFixed(1), k: +k.toFixed(1), g: r1(q), kopf: r1(pk.kopf), hip: r1(pk.hip), fr: r1(pk.fr), fl: r1(pk.fl), hr: r1(pk.hr), hl: r1(pk.hl), wr: welt(pk.ar), wl: welt(pk.al), lz: Math.round(f.st.lz), m: +(p.mund > 0.05 || p.rede > 0.05 || p.zug > 0.05), sg: FIG.sig(p) }); // m = eine Geste ist offen (Mund, Hände, Gewohnheit)
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
function flaechenMP() { // alle lebenden Zeichenflächen in Megapixeln (nur zum Messen): __haus.bilder().flaechen
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
  film: (n, b, h, fest = false, dx = 0) => { if (!n) { const F = MESS.film; MESS.film = null; return F ? F.c.toDataURL('image/png') : ''; } const sp = Math.min(n, 15), c = document.createElement('canvas'); c.width = sp * b; c.height = Math.ceil(n / sp) * h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); MESS.film = { c, g, n, b, h, sp, i: 0, fest, dx, q: null }; return 'läuft'; }, filmStand: () => (MESS.film ? MESS.film.i : -1), tag: () => ({ tz: +TZ.toFixed(3), daemmerung: +DAEMM.toFixed(3), raketen: FEUER.raketen.length, figuren: FEUER.figuren.length, wartet: DAEMM_WARTET, flaeche: RUHEBILD.tz, naechste: RUHE2.schritt }), rakete: () => { feuerStart(); sceneDirty = true; }, zaehlen: (an) => { if (an === true) { zaehlenAn(); MESS.z.bilder.length = 0; MESS.z.abst.length = 0; return 'zählt'; } return MESS.z ? MESS.z.bilder.splice(0) : []; }, messen: messBericht, stufe: (n) => { if (n === 1) herunterschalten('von Hand'); return STUFE; }, takt: () => ({ ms: +TAKT_MS.toFixed(1), schutzAb: Math.round(SCHUTZ_AB), lange: langeBilder, grund: MESS.stufeGrund || '' }), bilder: () => ({ flaechen: flaechenMP(), mpMax: MESS.mpMax, mp: +bildMP.toFixed(1), atlanten: ATLANTEN.size, offen: VOR.length, fertig: !!MESS.warmFertig, vorgezeichnet: MESS.vorgezeichnet || 0, ruhebilder: MESS.ruhebilder || 0, liste: [...ATLANTEN].map((a) => `${a.st ? a.st.key : ''} ${a.cw}×${a.ch} k${a.k} Zellen ${a.n} Seiten ${a.seiten.length} MP ${a.mp.toFixed(1)}`) }), ort: ortVon, weg: () => WEG, raeume: () => RAUM, neu: () => { sceneDirty = true; }, kameraBei: (lage) => { const v = ansicht(lage); kamera(v); const r = { p: +v.p.toFixed(4), x: +cam.x.toFixed(2), y: +cam.y.toFixed(2), z: +cam.z.toFixed(2), f: Math.round(S.f * FZ) }; sceneDirty = true; return r; }, lang: () => { const r = MESS.lang.slice(); MESS.lang.length = 0; return r; }, zeiten: () => { const t = performance.now(), r = { bilder: MESS.n, jeSekunde: +((MESS.n * 1000) / (t - MESS.t0)).toFixed(1), msMittel: +(MESS.ms / Math.max(1, MESS.n)).toFixed(2), msMax: +MESS.max.toFixed(1) }; MESS.n = 0; MESS.ms = 0; MESS.max = 0; MESS.t0 = t; return r; } }; // nur zum Messen (werkzeug/haus-echtlauf.mjs)

/* ── Weiches Scrollen am Rechner (Lenis, js/lenis.min.js): Rad und Trackpad werden geglättet und etwas gebremst. Nur bei feinem Zeiger; mit dem Finger und bei
      „weniger Bewegung“ scrollt der Browser selbst. Lenis gilt für die ganze Seite, also auch für die Kurz-Startseite nach der Fahrt (kein Bruch am Ende).
      Solange ein Dialog oder das Menü offen ist, steht Lenis: Die Seite dahinter bewegt sich nicht, der Dialog selbst scrollt wie gewohnt. ── */
let lenis = null;
if (window.Lenis && matchMedia('(pointer: fine)').matches && !reduce && !STATISCH) {
  try {
    lenis = new window.Lenis({ lerp: LENIS.lerp, wheelMultiplier: LENIS.wheelMultiplier, smoothWheel: true, syncTouch: false, autoRaf: false, allowNestedScroll: true }); // allowNestedScroll: was selbst scrollen kann (Dialog, Menü), scrollt der Browser
    window.lenis = lenis;
  } catch (e) { console.error(e); lenis = null; }
}

/* ── Eigene Fahrten der Seite: Tasten, Knöpfe, Leisten und das weiche Einrasten. Jede Eingabe des Besuchers bricht eine laufende Fahrt sofort ab,
      die Seite bleibt, wo sie gerade ist. Mit Lenis fährt Lenis (scrollTo), sonst setzen wir die Lage Bild für Bild selbst.
      GEFÜHRTE Fahrt (Tasten, Leisten, Knöpfe): Die Zeichnung fährt in der Zeit gleichmäßig weich von ihrer Stelle zur Zielszene, statt an jedem Halt zu warten;
      die Scroll-Lage läuft nur mit und steht am Ende in der Mitte des Halts. Wird die Fahrt abgebrochen, steht die Seite dort, wo die Zeichnung gerade ist. ── */
let fahrt = null;                    // { von, y, t0, dauer, kurve, ziel, fuehrt } · ziel = Nummer der Szene (N = Kurz-Startseite) · fuehrt = { lage0, lage1, nah0, nah1, kreis0 } oder null
let eigenY = -1, eigenOffen = false; // ohne Lenis: die Lage, die wir zuletzt selbst gesetzt haben (so erkennen wir im scroll-Ereignis fremde Bewegung)
let ORT = { i: 0, h: 0, t: 0, lage: 0, kreis: 0 }, NAH = 0; // der Ort, der gerade gezeigt wird, und wie nah die Zeichnung steht
let cssAn = false;                   // html.rast-fest: der Browser rastet selbst (nur mit dem Finger und ohne Halte, nur im Stillstand umgeschaltet)
function cssRasten(an) { if (an === cssAn) return; cssAn = an; root.classList.toggle('rast-fest', an); }
function setze(y) { if (lenis) { lenis.reset(); lenis.scrollTo(y, { immediate: true, force: true }); } else scrollTo(0, y); } // ohne Fahrt dorthin (reset: Lenis nimmt erst die wirkliche Lage, sonst hielte es einen Sprung des Browsers für schon erledigt)
function sperreAbgleichen() { // offener Dialog, offenes Menü: Lenis steht (der Browser scrollt dort selbst)
  if (!lenis) return; const g = gesperrt(); if (g === lenis.isStopped) return;
  fahrtAus(); if (g) lenis.stop(); else lenis.start();
}
function fahrtAus() {
  const f = fahrt; if (!f) return; fahrt = null;
  if (f.fuehrt && ORT.gefuehrt && ORT.lage !== f.fuehrt.lage0) setze(yVonLage(ORT.lage)); // geführte Fahrt: Die Seite steht ab jetzt dort, wo die Zeichnung gerade ist
  else if (lenis) lenis.reset();
}
function fahre(y, dauer, kurve, ziel = null, gefuehrt = false) {
  y = Math.max(0, Math.min(y, root.scrollHeight - innerHeight));
  const von = ORT, nah0 = NAH;
  fahrtAus(); sperreAbgleichen();
  if (Math.abs(y - scrollY) < 1) return;
  cssRasten(false); // eigene Fahrten laufen ohne das Rasten des Browsers (er würde jeden Schritt auf eine Raststelle ziehen); umgeschaltet wird im Stand
  const fuehrt = gefuehrt && ziel != null && ziel < N && aufBuehne() ? { lage0: von.lage, lage1: ziel, nah0, nah1: nahVon(ortVon(y)), tr0: TRITT, tr1: trittVon(ortVon(y)), kreis0: von.kreis, nur: [Math.round(von.lage), ziel] } : null;
  const f = fahrt = { von: scrollY, y, t0: performance.now(), dauer, kurve, ziel, fuehrt };
  if (lenis) lenis.scrollTo(y, { duration: dauer / 1000, easing: kurve, force: true, onComplete: () => { if (fahrt === f) fahrt = null; } });
}
function fahrtOrt(now) { // der Ort einer geführten Fahrt zum Zeitpunkt now
  const g = fahrt.fuehrt, k = clamp01((now - fahrt.t0) / fahrt.dauer), e = fahrt.kurve(k), v = k >= 1 ? g.lage1 : lerp(g.lage0, g.lage1, e);
  const i = Math.max(0, Math.min(N - 1, Math.floor(v))), fr = Math.min(1, Math.max(0, v - i));
  return { i, h: 1, t: i < N - 1 ? schwungZurueck(fr) : 0, lage: v, kreis: g.kreis0 * (1 - e), nah: lerp(g.nah0, g.nah1, e), tritt: lerp(g.tr0, g.tr1, e), nur: g.nur, gefuehrt: true };
}
readers.push((now) => {
  if (lenis) { // Lenis läuft in unserem Takt, vor dem Lesen der Lage
    sperreAbgleichen(); lenis.raf(now);
    if (fahrt && lenis.isScrolling !== 'smooth' && now - fahrt.t0 > 80) fahrtAus(); // die Fahrt ist von außen beendet worden
    return;
  }
  if (!fahrt) return;
  const k = Math.min(1, Math.max(0, (now - fahrt.t0) / fahrt.dauer));
  eigenY = k < 1 ? fahrt.von + (fahrt.y - fahrt.von) * fahrt.kurve(k) : fahrt.y; eigenOffen = true;
  scrollTo(0, eigenY);
  if (k >= 1) fahrt = null;
});
/* Eine Szene anfahren (i = N: die Kurz-Startseite): Knöpfe, Leisten, Tasten, Direkteinstiege. Ziel ist die Mitte des Halts. Die Dauer richtet sich nach dem Weg. */
function szeneZu(i, sofort) {
  const kurz = i >= N, n = Math.max(0, Math.min(N - 1, i)), y = kurz ? kurzY() : szeneY(n);
  if (sofort || STATISCH || reduce || (!kurz && !aufBuehne())) { fahrtAus(); if (Math.abs(y - scrollY) >= 2) { cssRasten(false); setze(y); } return; }
  fahre(y, Math.min(TASTE_DAUER[1], Math.max(TASTE_DAUER[0], (TASTE_JE_HOEHE * Math.abs(y - scrollY)) / U)), easeInOutSine, kurz ? N : n, !kurz);
}
/* Eine Szene finden: Nummer (1 bis N; größere Nummern aus alten Adressen führen zur letzten), Kennung oder eine frühere Kennung (szenen.json › alt). */
const szeneNr = (w) => { let n = /^\d+$/.test(w) ? Math.min(N, +w) - 1 : SZ.findIndex((s) => s.id === w); if (n < 0) n = SZ.findIndex((s) => (s.alt || []).includes(w)); return n >= 0 && n < N ? n : -1; };
const sceneDirty0 = () => { sceneDirty = true; };

/* ── Ansicht: aus der Scroll-Position (s = 0 … 14, Szene für Szene) wird eine Stelle der Zeitachse ── */
const keyVon = (z) => { const i = Math.floor((z.p - TOUR_START) / FLOOR_LEN), key = i >= 0 && i < HALTS ? FLOORS[i].key : null; return key && MARKE[key] ? key : null; };
function ansicht(s) {
  if (STILL) return { p: STILL.p, pz: STILL.p, blende: null, tz: tzVonP(STILL.p) };
  const k = Math.min(N - 2, Math.max(0, Math.floor(s))), t = clamp01(s - k), A = SZ[k], B = SZ[k + 1];
  const pa = t > 0 ? A.pab ?? A.p : A.p; // pab = die Stelle, von der aus es weitergeht (vor der geschlossenen Tür: das Ende der Etage; das Bild ist dort dasselbe, so entfällt die tote Strecke)
  const v = { p: lerp(pa, B.p, t), pz: lerp(t > 0 && A.pab != null ? A.pab : A.pz ?? A.p, B.pz ?? B.p, t), blende: null, tz: lerp(A.tz ?? 1, B.tz ?? 1, t) };
  if (B.ue === 'blende') v.blende = { pa: A.kam || A.p, pb: B.kam || B.p, t: easeInOutSine(t) }; // die Kamera fliegt, statt dass der Aufzug fährt
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

/* Filmkorn über der Szene */
(() => { const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160), R = mulberry(3); for (let i = 0; i < d.data.length; i += 4) { const v = (R() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = `url(${c.toDataURL()})`; })();

/* ── Lesen: wo steht die Seite? Danach Text, Leisten, Kreis und Kopf ── */
let aktiv = -1, canvasAn = true, kopfLage = '', marke = false;
const etagenLinks = $$('a', etagenNav);
const schmal = matchMedia('(max-width: 767.98px), (max-width: 1100px) and (max-aspect-ratio: 9/10)'); // Handy und Tablet hochkant: das Bild über dem Text
function zeigeSzene(a) {
  if (a !== aktiv && FOK.st && FOK.st.offen) karteZu(false); // die Karte gehört zu ihrem Raum
  aktiv = a;
  panels.forEach((el, i) => {
    el.classList.toggle('an', i === a);
    if (STATISCH) return; // bei „weniger Bewegung“ stehen alle Szenen untereinander und sind alle bedienbar
    el.inert = i !== a; if (i === a) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true'); // nur die Szene im Bild ist bedienbar und vorlesbar
  });
  etagenNav.classList.toggle('an', ['empfang', 'raum', 'tuer'].includes(SZ[a].art));
  etagenLinks.forEach((l) => { const jetzt = l.dataset.szenen === SZ[a].id; l.classList.toggle('jetzt', jetzt); if (jetzt) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current'); });
  for (const key in RAUM) RAUM[key].grenze = null; // die Schilder messen ihre Fläche neu
}
/* Die Tafeln blenden nach dem Ort: Im ganzen Halt steht die Tafel voll da. Sie blendet im ersten Stück der Fahrt aus (TAFEL_BLENDE), die nächste im letzten Stück ein;
   dazwischen fährt nur die Zeichnung. Ohne Halte (Finger) wie bisher: voll bis 0,3 Szenen Abstand, weg bei 0,5. Nie zwei Tafeln zugleich, nie Buchstabe für Buchstabe:
   Der Text steht ganz da, er wandert nur wenige Pixel mit. Nach der letzten Szene blendet die Tafel mit dem Kreis aus. */
const tafelO = new Array(N).fill(-1);
/* Deckkraft und Versatz liegen direkt auf der Tafel (eigene Ebene, solange sie zu sehen ist): Der Wechsel läuft dann im Zusammensetzer und zeichnet nichts neu. */
const tafelInnen = panels.map((el) => el.querySelector(':scope > .sz-innen') || el);
function tafeln(o) {
  const aus = HALTE ? [0, TAFEL_BLENDE] : [0.3, 0.5], ein = HALTE ? [1 - TAFEL_BLENDE, 1] : [0.5, 0.7];
  for (let j = 0; j < N; j++) {
    let op = 0, ri = 0;
    if (j === o.i) { op = 1 - smooth(j === N - 1 ? span(o.kreis, [0.6, 1]) : span(o.t, aus)); ri = -1; }
    else if (j === o.i + 1) { op = smooth(span(o.t, ein)); ri = 1; }
    if (o.nur && !o.nur.includes(j)) op = 0; // geführte Fahrt über mehrere Szenen: die Tafeln dazwischen blitzen nicht auf
    op = Math.round(op * 200) / 200;
    const vor = op === 0 && j === o.i + 1 && !(o.nur && !o.nur.includes(j)), merk = vor ? -2 : op; // die nächste Tafel liegt schon fast unsichtbar im Bild: So ist sie gerastert, wenn sie sichtbar wird (kein Hänger bei der Ankunft); sie nimmt nichts an (inert)
    if (merk === tafelO[j]) continue; tafelO[j] = merk;
    const el = panels[j], in_ = tafelInnen[j];
    el.classList.toggle('vor', vor); el.inert = vor;
    in_.style.opacity = vor ? '0.003' : String(op); // (weniger als eine Helligkeitsstufe: nicht zu sehen, aber gezeichnet) in_.style.transform = op < 1 && op > 0 ? `translate3d(0,${(ri * (1 - op) * 14).toFixed(1)}px,0)` : '';
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
  inFahrt = !STILL && bb.bottom > 2; // danach scrollt die Seite ganz normal
  if (!marke && o.lage >= N - 1 - 0.02) { marke = true; try { localStorage.setItem('make-fahrt', '1'); } catch (_) { /* ohne localStorage: die Fahrt startet beim nächsten Mal wieder */ } }
  if (!STILL) {
    const nah = o.nah ?? nahVon(o); if (nah !== NAH) { NAH = nah; sceneDirty = true; }
    const tr = o.tritt ?? trittVon(o); if (tr !== TRITT) { TRITT = tr; sceneDirty = true; }
    if (!lenis) sS.set(o.lage);                                        // ohne Lenis folgt die Zeichnung über die straffe Feder (glättet einzelne Rad-Rasten)
    else if (o.lage !== sS.v) sS.set(o.lage, { immediate: true });     // mit Lenis ist die Lage schon geglättet: nicht doppelt nachfedern
  }
  // der Kreis nach der letzten Szene
  const c = o.kreis;
  star.style.visibility = c > 0 ? 'visible' : 'hidden'; star.style.opacity = c > 0 ? 1 : 0;
  star.style.transform = `scale(${0.012 + Math.pow(c, 4) * 3.2})`; starTint.setAttribute('opacity', easeInOutSine(span(c, [0.2, 1])));
  canvasAn = c < 0.98 && bb.bottom > 0 && bb.top < h;
  kopfSetzen(bb.bottom <= (kopf ? kopf.offsetHeight : 0) * 0.6 || c > 0.97 ? 'hell' : o.lage < 0.5 ? 'szene' : 'glas');
  if (!STILL) rasten(now);
});

/* ── Weiches Einrasten: Im HALT passiert nichts. Dort kann man beliebig stehen und ein Stück vor und zurück scrollen. Nur wer mitten in einer FAHRT stehen bleibt,
      wird nach kurzer Ruhe (RUHE) langsam zum näheren Halt gebracht: weiter zum nächsten erst, wenn schon mehr als die Hälfte der Fahrt zurückgelegt ist (RAST_AB),
      sonst zurück. Es zwingt niemanden: Rad, Taste, Zeiger oder Finger brechen es sofort ab. Nach der Fahrt rastet nichts mehr.
      Ohne Halte (Finger) rastet der Browser selbst, Szene für Szene (html.rast-fest). ── */
const grob = matchMedia('(pointer: coarse)');
let tast = grob.matches;                     // Berührung: dort rastet der Browser selbst (html.rast-fest), das weiche Einrasten springt nur ein, solange die Klasse ruht
let letzteRegung = performance.now() + 600, letzteEingabe = 0, letzterScroll = 0, letztY = scrollY, dir = 0, unklar = false; // dir = Richtung der letzten Bewegung (1 = nach unten)
let zeigerUnten = false, fingerUnten = false;
const feldAktiv = () => { const el = document.activeElement; return !!el && el !== document.body && el.matches('input, textarea, select, [contenteditable]'); };
const gesperrt = () => root.classList.contains('menue-offen') || !!document.querySelector('dialog[open]');
function regung(eingabe) { const t = performance.now(); letzteRegung = t; if (eingabe) letzteEingabe = t; }
function rasten(now) {
  if (STATISCH || reduce || fahrt || zeigerUnten || fingerUnten) return;
  if (lenis && lenis.isScrolling === 'smooth') { letzteRegung = now; return; } // das weiche Scrollen läuft noch aus
  const y = scrollY, oben = spurTop(), ende = kurzY(), still = now - letzteRegung;
  const drin = y >= oben - 1 && y < ende - 1, o = drin ? ortVon(y) : null, w = o ? WEG[o.i] : null;
  const a = o ? oben + w.y + w.halt : 0, b = o ? (o.i < N - 1 ? oben + WEG[o.i + 1].y : ende) : 0; // die Fahrt reicht von a (Ende des Halts) bis b (Beginn des nächsten Halts bzw. die Kurz-Startseite)
  const imHalt = !!o && (y <= a + 1 || y >= b - 1);
  if (!HALTE && tast) { // Berührung: die Klasse wird nur im Stillstand auf einer Raststelle gesetzt bzw. nach der Fahrt gelöst, nie mitten im Scrollen
    if (still > 120) { if (!cssAn && imHalt) cssRasten(true); else if (cssAn && !drin) cssRasten(false); }
    if (cssAn) return;
  }
  if (!drin || imHalt || still < (unklar ? RUHE_UNKLAR : RUHE) || document.hidden) return; // vor und nach der Fahrt scrollt die Seite ganz normal
  if (gesperrt() || feldAktiv()) return;
  const anteil = (y - a) / (b - a), vor = dir < 0 ? 1 - anteil <= RAST_AB : anteil > RAST_AB, letzte = o.i === N - 1; // in Scrollrichtung gezählt; ohne bekannte Richtung wie nach unten
  const ziel = vor ? (letzte ? ende : b + Math.min(RAST_TIEFE * U, WEG[o.i + 1].halt / 2)) : a - Math.min(RAST_TIEFE * U, w.halt / 2);
  if (Math.abs(ziel - y) < 1) return;
  fahre(ziel, RAST_DAUER[0] + (RAST_DAUER[1] - RAST_DAUER[0]) * Math.min(1, Math.abs(ziel - y) / (1.0 * U)), easeInOutSine, vor ? (letzte ? N : o.i + 1) : o.i);
}
addEventListener('scroll', () => {
  const y = scrollY, t = performance.now();
  if (lenis ? !!fahrt && Math.abs(y - lenis.animatedScroll) <= 3 : eigenOffen && Math.abs(y - eigenY) <= 2) { if (!lenis) eigenOffen = !!fahrt; letztY = y; return; } // unsere eigene Fahrt
  if (y !== letztY) dir = y > letztY ? 1 : -1;
  letztY = y;
  if (fahrt) fahrtAus();                                                      // jemand anderes bewegt die Seite (Bildlaufleiste, Sprungmarke): wir lassen los
  if (t - letzterScroll > 200) unklar = !fingerUnten && t - letzteEingabe > 300; // eine Bewegung ohne Rad, Taste oder Finger davor: länger warten
  letzterScroll = letzteRegung = t;
}, { passive: true });
/* Das Rad hört nur zu (passiv): Es bricht eine laufende Fahrt ab und merkt sich den Zeitpunkt. In der Einfangphase, damit es vor Lenis an der Reihe ist. */
addEventListener('wheel', (e) => {
  if (e.ctrlKey) return; // Zoomen
  regung(true); fahrtAus();
  if (tast) { tast = false; cssRasten(false); } // Gerät mit Berührung, das gerade mit Maus oder Trackpad bedient wird: frei scrollen, weich einrasten (die nächste Berührung stellt zurück)
}, { passive: true, capture: true });
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; zeigerUnten = true; regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['pointerup', 'pointercancel']) addEventListener(typ, (e) => { if (e.pointerType === 'touch') return; zeigerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('pointermove', (e) => { if (zeigerUnten && e.buttons === 0) { zeigerUnten = false; regung(true); } }, { passive: true, capture: true }); // losgelassen über der Bildlaufleiste
addEventListener('touchstart', () => { fingerUnten = true; tast = true; regung(true); fahrtAus(); }, { passive: true, capture: true });
for (const typ of ['touchend', 'touchcancel']) addEventListener(typ, (e) => { if (!e.touches.length) fingerUnten = false; regung(true); }, { passive: true, capture: true });
addEventListener('blur', () => { zeigerUnten = false; fingerUnten = false; });
document.addEventListener('click', (e) => { // eine Sprungmarke anderswo auf der Seite (Kopf, Fuß): der Browser springt frei, ohne auf eine Szene gezogen zu werden
  const a = e.target.closest?.('a[href*="#"]'); if (!a || a.getAttribute('href').startsWith('#szene-')) return;
  cssRasten(false); fahrtAus(); if (lenis) lenis.reset(); // ein auslaufendes weiches Scrollen würde den Sprung sonst überschreiben
}, true);
function kopfSetzen(lage) { // Kopf der Website: über Szene 1 durchsichtig, über der Fahrt dunkles Glas, im hellen Teil wie überall
  if (!kopf || lage === kopfLage) return; kopfLage = lage;
  kopf.classList.toggle('ueber-film', lage !== 'hell'); kopf.classList.toggle('film-geht', lage === 'glas');
}
let lastAmbient = 0;
function place() { if (coreAt) { star.style.left = `${clamp01(coreAt[0]) * 100}%`; star.style.top = `${clamp01(coreAt[1]) * 100}%`; } } // der Kreis wächst aus dem Kern
const passanten = () => -cam.z <= 40 && cam.y - GROUND <= 9; // auf der Straße gehen Menschen vorbei: dort lebt das Bild von selbst
let rafAlt = 0, warVoll = false, langeBilder = 0, schutzN = 0; const schutzRing = new Uint8Array(SCHUTZ_FENSTER);
/* Der Takt des Bildschirms: Im Stromsparmodus zeigt der Browser nur 30 Bilder je Sekunde, dann liegt JEDES Bild bei 33 ms, ohne dass der Rechner zu langsam wäre. Der Selbstschutz misst deshalb gegen den gemessenen Takt
   (das untere Zehntel der letzten TAKT_N Abstände, gezeichnet oder nicht) und zählt erst Bilder, die deutlich länger dauern als ein Takt. Solange der Takt nicht bekannt ist, zählt er nicht. */
const TAKT_N = 60, taktRing = new Float32Array(TAKT_N), taktSort = new Float32Array(TAKT_N); let taktI = 0, TAKT_MS = 0, SCHUTZ_AB = SCHUTZ_MS;
function taktMessen(abstand) {
  if (!(abstand > 2 && abstand < 200)) return;
  taktRing[taktI++ % TAKT_N] = abstand; if (taktI < TAKT_N || taktI % 30) return;
  taktSort.set(taktRing); taktSort.sort(); TAKT_MS = taktSort[6]; SCHUTZ_AB = Math.max(SCHUTZ_MS, TAKT_MS * 1.6); MESS.taktMs = +TAKT_MS.toFixed(1);
}
/* Nur zum Messen: auf die Grafik warten. MESS.flush = true liest die Zeichenfläche selbst aus (Chrome rechnet sie danach auf dem Prozessor: Vergleichszahl),
   MESS.flush = 'gpu' setzt sie in eine kleine zweite Fläche ein und liest nur diese aus: Die Zeichenfläche bleibt auf der Grafikkarte, die Zahl ist die Zeit, die die Grafikkarte für dieses Bild braucht (plus ein fester Betrag fürs Auslesen). */
let PROBE = null;
function grafikAbwarten() {
  if (MESS.flush !== 'gpu') { ctxBild.getImageData(0, 0, 1, 1); return; }
  if (!PROBE) { const c = document.createElement('canvas'); c.width = c.height = 320; PROBE = c.getContext('2d'); }
  PROBE.drawImage(cv, 0, 0, 320, 320); PROBE.getImageData(0, 0, 1, 1);
}
function herunterschalten(grund) { // Selbstschutz: eine Stufe herunter (Gerätepixel 1, gröbere Bilder der Menschen, das Leben seltener) und dabei bleiben
  if (STUFE) return; STUFE = 1; MESS.stufeGrund = grund || '';
  try { sessionStorage.setItem('make-haus-stufe', '1'); } catch (e) { /* ohne Speicher gilt die Stufe für diese Seite */ }
  sizeScene(); buildTextures();
}
painters.push((now) => {
  if (STATISCH || !canvasAn || document.hidden || !sky) { rafAlt = 0; warVoll = false; return; }
  if (STILL) { if (sceneDirty) { drawScene(ansicht(0), 0); sceneDirty = false; snap(cv); place(); } return; }
  const abstand = rafAlt ? now - rafAlt : 0; rafAlt = now;
  if (scrollY !== SCROLL_ALT) { SCROLL_ALT = scrollY; SCROLL_T = now; }
  if (!LEER_AN) { LEER_AN = true; vorarbeit(); }
  aufwaermen(now);
  if (WALK.atl.length && ORT.lage > 2.7) { for (const a of WALK.atl) if (a && !a.tot) atlasFrei(a); WALK.atl = []; } // die Straße ist verlassen: die Bilder der Passanten freigeben
  if (MESS.z && ++MESS.takt % 20 === 0) { const g = flaechenMP().gesamt; if (g > MESS.mpMax) MESS.mpMax = g; }
  if (PUB_VOR !== BILD_GEN && ORT.lage >= 5.2 && ORT.lage < DACH_SZ - 0.15) { PUB_VOR = BILD_GEN; publikumVor(); }
  if (DACH_VOR !== BILD_GEN && ORT.lage > 6.05 && ORT.lage < DACH_SZ - 0.15) { DACH_VOR = BILD_GEN; dachVorab(); }
  if (MESS.z) { MESS.z.takt(); if (abstand) MESS.z.abst.push(+abstand.toFixed(1)); }
  taktMessen(abstand);
  if (warVoll && TAKT_MS && abstand > 0 && abstand < 1500 && now > 3000 && !TROCKEN.liste.length) { // Selbstschutz: Gezählt wird über die letzten SCHUTZ_FENSTER gezeichneten Bilder. Erst wenn davon SCHUTZ_BILDER länger als SCHUTZ_MS brauchten, ist der Rechner zu langsam; einzelne Hänger (ein anderes Programm, der Browser selbst) lösen nichts aus.
    const i = schutzN++ % SCHUTZ_FENSTER; langeBilder += (abstand > SCHUTZ_AB ? 1 : 0) - schutzRing[i]; schutzRing[i] = abstand > SCHUTZ_AB ? 1 : 0;
    if (langeBilder >= SCHUTZ_BILDER && !QUERY.has('stufe')) herunterschalten(`${langeBilder} von ${SCHUTZ_FENSTER} Bildern über ${Math.round(SCHUTZ_AB)} ms (Takt ${TAKT_MS.toFixed(1)} ms)`);
  }
  // Gezeichnet wird nur, wenn sich etwas bewegt: Scrollen, Zeiger, eine laufende Bewegung im Raum (Gehen, Geste, Überblenden) oder die Passanten auf der Straße. Sonst ruht die Zeichnung.
  const tagLebt = tagSchritt(now); HIMMEL_LEBT = tagLebt;
  const lebt = now < raumLebt || passanten() || raumLebendig() || tagLebt;
  warVoll = sceneDirty;
  if (sceneDirty || (lebt && now - lastAmbient > TAKT_RUHE[STUFE])) { const t0 = performance.now(); drawScene(ansicht(sS.v), now); sceneDirty = NOCHMAL; NOCHMAL = false; lastAmbient = now; if (RUHE2.schritt >= 0 && RUHE2.schritt < RUHE2.schritte && (RUHE2.art === 'A' ? ++RUHE2.eng > 5 : DAEMM_WARTET && PFAD === 'ruhe')) ruheBau(); else if (DAEMM_WARTET && PFAD === 'ruhe' && !DST.fertig && ++DST.eng > 2) { DST.eng = 0; daemmBau(); } /* es entsteht eine Fläche und kein Takt ist frei (es wird jedes Bild gezeichnet): dann eine Scheibe gleich nach diesem Bild */ place(); schilderSetzen(); teil('p'); if (performance.now() - t0 < 5) { if (LEER.length) leerSchritt(); else if (VOR.length && !RUHE_N && (PFAD === 'ruhe' || PFAD === 'direkt') && !HIMMEL_LEBT) warmSchritt(1); teil('L'); } if (MESS.flush) grafikAbwarten(); const d = performance.now() - t0; MESS.n++; MESS.ms += d; if (d > MESS.max) MESS.max = d; if (MESS.z) MESS.z.akt.ms = +d.toFixed(2); if (d > 12 && MESS.lang.length < 400) MESS.lang.push([Math.round(now), +d.toFixed(1), PFAD, INS.F && RAUM[INS.F.key] ? RAUM[INS.F.key].L.map((l) => +l.u.toFixed(2)).join('/') : '']); }
  else { const t0 = performance.now(), bau = ruheBau() || daemmBau(); if ((bau || warmSchritt() || leerSchritt()) && MESS.z) { MESS.z.akt.pfad = bau ? 'bau' : 'warm'; if (MESS.flush) grafikAbwarten(); MESS.z.akt.ms = +(performance.now() - t0).toFixed(2); } } // sonst: ein Häppchen Vorzeichnen
  if (MESS.film) filmBild();
});

/* ═══════════════ RÄUME: Bedienung ═══════════════
   Zwei Ansichten desselben Zustands: die Liste in der Tafel (echte Knöpfe, aria-pressed) und der Raum (Figuren, Schilder). Die Karte einer Leistung ist HTML und steht schon
   im Dokument (der Bau schreibt sie); hier wird nur gezeigt, verborgen und umgeschaltet. Gemerkt wird die Auswahl im localStorage unter „make-auswahl“ (nur Kennungen). */
const RH = { e: 'einmalig', m: 'im Monat', a: 'je Abend' };
const geld = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
const wahlVon = (st) => st.L.filter((l) => l.drin).map((l) => [l, l.V[l.v]]);
function summenText(wahl) { // dieselbe Regel wie im Bau (haus-bau.mjs): Summen der Ab-Preise je Rhythmus, Kostenloses zählt nicht mit
  const s = { e: 0, m: 0, a: 0 }; for (const [, v] of wahl) if (v.r !== 'f') s[v.r] += v.p;
  const teile = ['e', 'm', 'a'].filter((r) => s[r] > 0).map((r) => `${RH[r]} ab ${geld(s[r])}`.replace(/ /g, '\u00a0'));
  return teile.length ? teile.join('\u00a0· ') : wahl.length ? 'kostenlos' : 'noch nichts gewählt'; // geschütztes Leerzeichen: Der Punkt bleibt am Ende der Zeile
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
  if (st.alle) { const leer = st.L.every((l) => l.drin); if (st.alle.hidden !== leer) { if (leer && document.activeElement === st.alle) { const z = st.L[0].dom.an; if (z) z.focus({ preventScroll: true }); } st.alle.hidden = leer; } alleSetzen(st); } // wer wiederkommt und leere Plätze sieht, holt mit einem Knopf alle zurück
}
function alleSetzen(st) { // der Knopf steht unten links in der freien Fläche des Raums (über der Paket-Leiste bzw. über dem Blatt)
  if (!st.alle || st.alle.hidden || !st.grenze) return; const G = st.grenze, hh = st.alle.offsetHeight || 34;
  st.alle.style.transform = `translate3d(${Math.round(G.links + 10)}px,${Math.round(G.unten - hh - 10)}px,0)`;
}
function finaleZeigen() {
  if (!finaleEl) return; // je Raum: was gewählt ist und die Summen der Ab-Preise dieses Raums (keine Gesamtsumme über alle Räume)
  for (const id in RAUM_NACH_ID) { const st = RAUM_NACH_ID[id], wahl = wahlVon(st), li = $(`[data-raum="${id}"]`, finaleEl); if (!li) continue; $('[data-was]', li).textContent = wasText(wahl); $('[data-ab]', li).textContent = wahl.length ? summenText(wahl) : ''; }
}
function auswahlMerken() {
  const o = {};
  for (const id in RAUM_NACH_ID) { const st = RAUM_NACH_ID[id], aus = st.L.filter((l) => !l.drin).map((l) => l.id), v = {}; for (const l of st.L) if (l.v > 0) v[l.id] = l.V[l.v].k; if (aus.length || Object.keys(v).length) o[id] = { aus, v }; }
  try { if (Object.keys(o).length) localStorage.setItem('make-auswahl', JSON.stringify(o)); else localStorage.removeItem('make-auswahl'); } catch (_) { /* ohne localStorage gilt die Auswahl nur für diesen Besuch */ }
}
(() => { // gemerkte Auswahl holen: unbekannte Kennungen (geänderte Daten) fallen still weg
  let o = null; try { o = JSON.parse(localStorage.getItem('make-auswahl') || 'null'); } catch (_) { o = null; }
  if (o && typeof o === 'object') for (const id in RAUM_NACH_ID) {
    const e = o[id], st = RAUM_NACH_ID[id]; if (!e || typeof e !== 'object') continue;
    for (const l of st.L) { if (Array.isArray(e.aus) && e.aus.includes(l.id)) { l.drin = false; l.u = 1; } const k = e.v && e.v[l.id], i = l.V.findIndex((x) => x.k === k); if (i > 0) l.v = i; }
  }
  for (const id in RAUM_NACH_ID) raumZeigen(RAUM_NACH_ID[id]);
  finaleZeigen();
})();
/* Der Blick im Raum: UM = Umsehen mit dem Zeiger (weich nachgeführt; die Kamera rückt ein wenig zur Seite, vorn verschiebt sich mehr als hinten) ·
   FOK = die Kamera fährt an den Platz einer Leistung, solange ihre Karte offen ist. */
const UM_WEG = [0.24, 0.07];                             // Meter, die die Kamera beim Umsehen höchstens zur Seite bzw. in der Höhe rückt
const UM = { x: new Spring(0, { tension: 60, friction: 16 }, sceneDirty0, 0.002), y: new Spring(0, { tension: 60, friction: 16 }, sceneDirty0, 0.002) };
const FOK = { st: null, l: null, k: new Spring(0, { duration: 750, easing: easeInOutSine }, sceneDirty0) };
function raumBlick() {
  const k = AKT.k, F = AKT.F; if (k <= 0 || !F || !RAUM[F.key]) return;
  const f = FOK.k.v * k;
  if (f > 0.001 && FOK.l && FOK.st === RAUM[F.key]) {
    const l = FOK.l, fk = (l.fig && l.fig.fokus) || {}, D = fk.d || (F.roof ? 9.5 : 3.9), b = oy; oy = 0; // fokus (raeume.json): die Kamera steht seitlich neben dem Platz, wenn sonst etwas davor stünde
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
  l.dom.k.hidden = false; l.dom.sch.classList.add('hebt'); st.el.classList.add('karte-offen'); if (!STATISCH) { st.rt.inert = true; if (schmal.matches) st.blatt.inert = true; } // die Karte liegt über der Tafel: Die Liste darunter ist so lange nicht bedienbar
  FOK.st = st; FOK.l = l; FOK.k.set(1); sceneDirty = true; grenzenMessen(st); mitteMessen();
  if (!STATISCH) l.dom.k.querySelector('.rk-zurueck').focus({ preventScroll: true });
}
function paketSetzen(st, l, drin) {
  if (l.drin === drin) return; l.drin = drin;
  if (reduce || STATISCH) l.u = drin ? 0 : 1; // „weniger Bewegung“: kein Gehen, nur der Wechsel
  else if ((l.u <= 0 || l.u >= 1) && st.tuer && l.leute.length) { // aus der Ruhe: einen freien Moment an der Tür suchen, damit sich Menschen verschiedener Leistungen dort nicht begegnen (höchstens gut zwei Sekunden warten)
    const jetzt = performance.now(), plan = (st.tuerPlan = (st.tuerPlan || []).filter((t) => t > jetzt - 400)), an = l.leute.map((f) => (drin ? l.dauer - (f.verz + f.tA + f.tW) + f.tW * (1 - f.w.sT / f.w.len) : f.verz + f.tA + f.tW * (f.w.sT / f.w.len)));
    let warte = 0; while (warte < 2400 && an.some((a) => plan.some((t) => Math.abs(jetzt + warte + a - t) < TUER_ABSTAND))) warte += 120;
    l.warte = warte; for (const a of an) plan.push(jetzt + warte + a);
  } else if (l.u > 0 && l.u < 1 && l.fest == null) { l.warte = 0; let einer = false; for (const f of l.leute) { const zs = wo(f); if (!zs.fort && zs.s > 0.05) { f.dreht = true; einer = true; } } if (einer) l.wende = WENDE_MS; } // mitten im Gehen: erst umdrehen
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
/* Zeigen und Tippen im Bild: Was unter dem Zeiger liegt, steht in HOT (bei jedem Zeichnen neu). Die nächste Figur gewinnt. */
const stageEl = cv.parentElement, aktRaum = () => (AKT.F && AKT.k > 0.85 && !STATISCH ? RAUM[AKT.F.key] || null : null);
function trifft(e) {
  const st = aktRaum(); if (!st) return null; const r = stageEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = HOT.length - 1; i >= 0; i--) { const h = HOT[i]; if (st.L.includes(h.l) && x >= h.x0 && x <= h.x1 && y >= h.y0 - 14 && y <= h.y1) return h.l; } // nur die Menschen dieses Raums (auf dem Dach sind tiefere Etagen mit im Bild)
  return null;
}
function hebe(st, l) { // eine Leistung hervorheben (Figur, Schild und Zeile der Liste) bzw. nichts
  if (!st) return;
  for (const x of st.L) { const an = x === l; if (x.hovZiel !== (an ? 1 : 0)) { x.hovZiel = an ? 1 : 0; sceneDirty = true; } x.dom.z.classList.toggle('hebt', an); if (st.offen !== x) x.dom.sch.classList.toggle('hebt', an); }
}
stageEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const st = aktRaum(), l = trifft(e); hebe(st, l); cv.style.cursor = l ? 'pointer' : ''; });
stageEl.addEventListener('pointerleave', () => { hebe(aktRaum(), null); cv.style.cursor = ''; });
stageEl.addEventListener('click', (e) => {
  const st = aktRaum(); if (!st) return; const l = trifft(e);
  if (l) karteAuf(st, l, null); else if (st.offen) karteZu(); // Klick neben die Figuren: zurück in den Raum
});
document.addEventListener('pointerover', (e) => { // Zeiger auf der Zeile der Liste oder auf dem Schild: die Figur im Raum hebt sich hervor
  if (e.pointerType === 'touch') return; const z = e.target.closest?.('.rl-z, .schild'); const st = aktRaum(); if (!st) return;
  if (z && st.el.contains(z)) hebe(st, st.nach[z.dataset.l]); else if (e.target.closest?.('.rt, .rp, .rk')) hebe(st, null);
});
document.addEventListener('focusin', (e) => { // Tastatur: Der Fokus auf einer Zeile der Liste hebt die Figur im Raum hervor wie der Zeiger
  const st = aktRaum(); if (!st || !e.target.matches?.(':focus-visible')) return; const z = e.target.closest?.('.rl-z');
  hebe(st, z && st.el.contains(z) ? st.nach[z.dataset.l] : null);
});
addEventListener('pointermove', (e) => { // Umsehen: nur mit der Maus, nur im Raum
  if (e.pointerType !== 'mouse' || reduce || STATISCH) return;
  if (!aktRaum() || AKT.F.roof) { UM.x.set(0); UM.y.set(0); return; }
  const [L, R] = freiFlaeche(), m = (L + R) / 2, hw = Math.max(0.2, (R - L) / 2);
  if (e.clientX < L * innerWidth - 4) return; // über der Tafel bleibt der Blick, wie er ist: Wer die Liste liest, soll keinen wandernden Raum daneben haben
  UM.x.set(Math.max(-1, Math.min(1, (e.clientX / innerWidth - m) / hw))); UM.y.set(Math.max(-1, Math.min(1, (e.clientY / innerHeight - 0.5) * 2)));
}, { passive: true });
/* Schilder: stehen über den Köpfen (Stelle aus HOT), bleiben in der freien Fläche und weichen einander nach oben aus. Nur transform und opacity am Schild selbst. */
let schildRaum = null;
function mitteMessen() { // je Raum: die Mitte der freien Fläche über dem Blatt bzw. über der offenen Karte, als Anteil der Bühnenhöhe (nur am Handy gebraucht)
  const r = stageEl.getBoundingClientRect(); if (!r.height) return; const oben = (kopf ? kopf.offsetHeight : 0) + 6;
  for (const key in RAUM) { const st = RAUM[key]; if (!st.blatt) continue; const anteil = (el) => { const u = el.getBoundingClientRect().top - r.top; return u > oben + 60 ? (oben + (u - oben) * 0.46) / r.height : null; };
    const m = MITTE[key] || (MITTE[key] = { blatt: 0.27, karte: null }), b = anteil(st.blatt); if (b != null) m.blatt = b; if (st.offen) { const kk = anteil(st.offen.dom.k); if (kk != null) m.karte = kk; } }
}
function grenzenMessen(st) { // wo die Schilder stehen dürfen: rechts von der Tafel, über der Paket-Leiste bzw. über dem Blatt (nur bei Wechsel der Szene, Größe oder Karte gemessen)
  const r = stageEl.getBoundingClientRect(), eng = schmal.matches, unten = st.offen && eng ? st.offen.dom.k : eng ? st.blatt : st.rp, u = unten.getBoundingClientRect();
  st.grenze = { links: eng ? 58 : st.rt.getBoundingClientRect().right - r.left + 6, rechts: r.width - 4, oben: (kopf ? kopf.offsetHeight : 0) + (eng ? 52 : 8), unten: u.top - r.top - 4 };
  alleSetzen(st);
}
function schilderSetzen() {
  const st = AKT.F && AKT.k > 0 && !STATISCH ? RAUM[AKT.F.key] || null : null;
  if (schildRaum && schildRaum !== st) { for (const l of schildRaum.L) { l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); l.dom.sch._o = '0'; } }
  schildRaum = st; if (!st) return;
  const sicht = clamp01((AKT.k - 0.82) / 0.18), fest = [];
  if (sicht <= 0) { for (const l of st.L) if (l.dom.sch._o !== '0') { l.dom.sch._o = '0'; l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); } return; } // noch auf dem Weg in den Raum: keine Schilder, nichts messen
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
    for (const dy of [0, -1, -2, 1, 2, -3, 3]) { const yy = y + dy * (hh + 4); if (yy - hh >= G.oben && frei(yy)) { y = yy; n = 9; break; } } // weicht aus: erst nach oben, sonst nach unten
    fest.push({ x, y, w });
    const aus = sicht < 0.03 || Math.abs(x - h.sx) > w * 0.9 || y > G.unten, tr = `translate3d(${Math.round(x - w / 2)}px,${Math.round(y - hh)}px,0)`, op = aus ? '0' : sicht.toFixed(2);
    if (el._t !== tr) { el._t = tr; el.style.transform = tr; }
    { const stiel = Math.round(Math.max(0, h.stiel || 0) + (y - h.sy)); if (el._s !== stiel) { el._s = stiel; if (stiel > 2) el.style.setProperty('--stiel', `${stiel + 11}px`); else el.style.removeProperty('--stiel'); } } // der Stiel reicht vom Schild bis zum Kopf
    if (el._o !== op) { el._o = op; el.style.opacity = op; el.classList.toggle('da', !aus); }
  }
  for (const l of st.L) if (!gesehen.has(l) && l.dom.sch._o !== '0') { l.dom.sch._o = '0'; l.dom.sch.style.opacity = '0'; l.dom.sch.classList.remove('da'); }
}
/* Takt der Räume: Gehen und Kommen (u), Hervorheben (hov). Gezeichnet wird nur, solange sich etwas davon bewegt. */
const raumLebendig = () => !reduce && !!AKT.F && AKT.k > 0.9 && !!RAUM[AKT.F.key]; // im Raum und auf dem Dach leben die Menschen auch in Ruhe (Atmen, Hände, Blicke)
readers.push((now, dt) => {
  for (const key in RAUM) {
    const st = RAUM[key]; let bewegt = false;
    for (const l of st.L) {
      if (l.fest != null) { if (l.u !== l.fest) { l.u = l.fest; sceneDirty = true; } } // nur zum Prüfen: einen Zustand des Gehens festhalten (werkzeug/haus-raeume.json)
      else if (l.wende > 0) { // jemand wurde mitten im Gehen zurückgeholt (oder doch wieder fortgeschickt): Wer unterwegs ist, bleibt stehen und dreht sich um, dann geht es weiter
        l.wende -= dt; sceneDirty = true; bewegt = true;
        if (l.wende <= 0) { l.wende = 0; for (const f of l.leute) if (f.dreht) { const zs = wo(f); f.dreht = false; if (!zs.fort && zs.s > 0) { f.hd = zs.ziel; f.schritt = direkt(f) ? 0 : ((l.drin ? f.w.len - zs.s : zs.s) / SCHRITT) * Math.PI; f.sAlt = zs.s; f.gang = 0; f.wR = f.wL = f.wN = W0; } } }
      } else if (l.warte > 0 && l.u !== (l.drin ? 0 : 1)) { l.warte -= dt; bewegt = true; // wartet einen Moment, bis die Tür frei ist
      } else { const ziel = l.drin ? 0 : 1; if (l.u !== ziel) { l.u = ziel > l.u ? Math.min(1, l.u + dt / l.dauer) : Math.max(0, l.u - dt / l.dauer); sceneDirty = true; bewegt = true; } }
      for (const f of l.leute) { // Richtung und Schritt: Wer unterwegs ist, dreht sich in seine Richtung; die Schrittphase hängt am zurückgelegten Weg (auch auf dem Rückweg vorwärts)
        if (l.u <= 0) { f.hd = f.blick; f.sAlt = 0; f.schritt = 0; f.dreht = false; f.gang = 0; f.ox = f.oz = 0; f.halt2 = null; continue; }
        const zs = wo(f); if (zs.fort) { f.sAlt = f.w.len; f.schritt = 0; f.dreht = false; f.gang = 1; f.wR = f.wL = f.wN = 1; f.ox = f.oz = 0; f.halt2 = null; f.hd = ortAufWeg(f.w, f.w.len)[2] + Math.PI; continue; }
        if (zs.s <= 0) { f.hd = zs.q > 0 ? aufRichtung(f, zs.q) : f.blick; f.sAlt = 0; f.schritt = 0; f.dreht = false; f.gang = 0; f.wR = f.wL = f.wN = W0; f.ox = f.oz = 0; f.halt2 = null; continue; }
        if (f.dreht) { if (direkt(f)) { f.gang = Math.max(0, (f.gang ?? 1) - dt / 170); if (f.gang < 0.4) f.hd = dreheZu(f.hd, zs.ziel, (dt * Math.PI) / (WENDE_MS * 0.6)); } else f.hd = dreheZu(f.hd, zs.ziel, (dt * Math.PI) / (WENDE_MS * 0.85)); continue; } // erst auslaufen, dann im Stand umdrehen
        if (direkt(f)) { gangSchritt(f, zs, dt, l); continue; }
        f.hd = l.fest != null ? zs.ziel : dreheZu(f.hd, zs.ziel, dt * DREH_TEMPO); f.schritt += (Math.abs(zs.s - f.sAlt) / SCHRITT) * Math.PI; f.sAlt = zs.s;
      }
      if (l.hov !== l.hovZiel) { const d = l.hovZiel - l.hov; l.hov = Math.abs(d) < 0.02 ? l.hovZiel : l.hov + d * Math.min(1, dt / 110); sceneDirty = true; }
    }
    if (AKT.F && AKT.F.key === key) { // die Uhr des Lebens im Raum läuft auch, während jemand geht oder kommt; diese Zeiten werden gemerkt (taktGesperrt: dann beginnt nur jeder zweite Takt)
      const sp = st.sperr || (st.sperr = []); if (bewegt && !st.sperrAuf) { sp.push([st.lz, Infinity]); st.sperrAuf = true; if (sp.length > 40) sp.shift(); } else if (!bewegt && st.sperrAuf) { sp[sp.length - 1][1] = st.lz; st.sperrAuf = false; }
      st.lz += dt;
    }
  }
});

/* ── Wege: Überspringen, Etagenwahl, Szenen anfahren, Gastwunsch, Newsletter ── */
function markeSetzen() { try { localStorage.setItem('make-fahrt', '1'); } catch (_) { /* siehe oben */ } }
function ueberspringen(e) {
  if (e) e.preventDefault();
  markeSetzen(); fahrtAus(); cssRasten(false);
  setze(kurzY());
}
skip.addEventListener('click', ueberspringen);
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return; // ein offener Dialog schließt zuerst
  if (FOK.st && FOK.st.offen) { e.preventDefault(); karteZu(); return; } // eine offene Karte schließt zuerst: zurück in den Raum
  if (inFahrt && !STATISCH && !STILL) ueberspringen(e);
});
function zu(dlg) { if (dlg.open) dlg.close(); }
for (const dlg of [wahl]) { // Klick auf den dunklen Rand schließt
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
/* Tasten bleiben Schritte: Pfeil runter/hoch, Bild ab/auf und die Leertaste (mit Umschalt zurück) fahren zum nächsten bzw. vorigen Halt (in dessen Mitte), Pos1 an den Anfang,
   Ende ans Seitenende. Die Dauer richtet sich nach dem Weg (TASTE_DAUER); jede Eingabe bricht die Fahrt ab. Nicht in einem Formularfeld, nicht bei offenem Dialog oder Menü.
   Nach der Fahrt gehören die Tasten wieder dem Browser. */
addEventListener('keydown', (e) => {
  if (STATISCH || STILL || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, vor = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey), zurueck = k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey);
  if (!vor && !zurueck && k !== 'Home' && k !== 'End') return;
  if (gesperrt() || e.target.closest?.('input, textarea, select, [contenteditable]') || (k === ' ' && e.target.closest?.('button, a, summary'))) return;
  const y = scrollY, oben = spurTop(), ende = kurzY();
  if (k === 'End') { e.preventDefault(); fahrtAus(); cssRasten(false); regung(true); setze(root.scrollHeight); return; } // ans Ende der Seite, nicht nur ans Ende der Fahrt
  if (y > ende + 1 || (y >= ende - 1 && !zurueck) || y < oben - 1) return; // außerhalb der Fahrt: ganz normal
  e.preventDefault(); regung(true);
  if (k === 'Home') { szeneZu(0); return; }
  if (e.repeat && fahrt && (performance.now() - fahrt.t0) / fahrt.dauer < 0.7) return; // gehaltene Taste: Szene für Szene, nicht im Flug durch alle
  const o = ortVon(y), letzte = o.i === N - 1;
  const ziel = fahrt && fahrt.ziel != null ? fahrt.ziel + (vor ? 1 : -1) : letzte && o.t > 0.02 ? (vor ? N : N - 1) : vor ? o.i + 1 : o.t > 0.02 ? o.i : o.i - 1;
  szeneZu(Math.max(0, Math.min(N, ziel)));
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
let neuMalen = null; // „weniger Bewegung“: das Bild einer Szene neu malen (nach einer Wahl im Raum)
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

/* ── Start ── */
if (!STILL && !STATISCH) { /* die Höhe der Spur steht in haus.css */ }
sizeScene(); zeigeSzene(0); mitteMessen(); sceneDirty = true;
if (!STATISCH && !STILL) { // Einflug: die Kamera gleitet heran, statt zu stehen. Vorher wird aufgewärmt (aufwaermen), solange das Bild noch steht.
  const einflug = () => new Spring(0, EINFLUG, (v) => { introK = v; sceneDirty = true; }).set(1);
  if (reduce) einflug(); else { TROCKEN.liste = [0.3, 0.6, 0.85, 1, 1.4, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]; TROCKEN.danach = einflug; }
}
let rz = 0;
let rzAnteil = null;
addEventListener('resize', () => {
  for (const key in RAUM) { RAUM[key].grenze = null; for (const l of RAUM[key].L) if (l.dom) l.dom.sch._w = 0; }
  if (!rz) rzAnteil = !fahrt && inFahrt && !STATISCH && !STILL ? (scrollY - spurTop()) / U : null; // wo die Seite stand, bevor sich die Größe geändert hat (in Fensterhöhen der Spur)
  cancelAnimationFrame(rz); rz = requestAnimationFrame(() => {
    rz = 0; messen(); sizeScene(); zeigeSzene(aktiv); mitteMessen(); if (STATISCH) panels.forEach((el) => { el.style.backgroundImage = ''; });
    if (STATISCH || STILL) return;
    if (lenis) lenis.resize();
    if (fahrt && fahrt.ziel != null) { const z = fahrt.ziel; fahrt.fuehrt = null; fahrtAus(); if (z <= N) szeneZu(z, true); } // eine laufende Fahrt kommt gleich an ihrem Ziel an
    else if (rzAnteil != null && !cssAn) { const y = Math.round(spurTop() + rzAnteil * U); if (Math.abs(scrollY - y) >= 1) setze(y); } // derselbe Ort bleibt stehen (alle Längen laufen mit der Fensterhöhe)
  });
});
requestAnimationFrame(frame);

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
(async () => {
  await withTimeout(Promise.all(['400 20px', '500 40px', '600 20px'].map((f) => document.fonts.load(`${f} "Schibsted Grotesk"`))).catch(() => {}), 4000);
  buildTextures(); sceneDirty = true;
  // Sprung an eine Szene: ?szene=7, ?szene=e2 oder ?etage=eg|tresen|1|2|3|4|5|dach (Adresse) bzw. #szene-e2
  const ETAGE = { eg: 'eg', tresen: 'eg', empfang: 'eg', 1: 'e1', 2: 'e2', 3: 'e3', 4: 'e4', 5: 'e5', dach: 'dach' };
  const TUER = SZ.find((x) => x.art === 'tuer'); // dort steht das Newsletter-Formular (#newsletter)
  const ziel = QUERY.get('szene') || ETAGE[(QUERY.get('etage') || '').toLowerCase()] || (location.hash.startsWith('#szene-') ? location.hash.slice(7) : location.hash === '#newsletter' && TUER ? TUER.id : '');
  if (ziel && !STILL && !STATISCH) { const i = szeneNr(ziel); if (i >= 0) { messen(); fahrtAus(); setze(szeneY(i)); sS.set(i, { immediate: true });
    // Bei #szene-… springt der Browser beim Laden selbst noch einmal zur Sprungmarke: danach steht die Seite wieder in der Mitte des Halts (solange niemand etwas getan hat)
    const nach = () => { if (!letzteEingabe && !fahrt && Math.abs(scrollY - szeneY(i)) > 2) setze(szeneY(i)); };
    if (location.hash) { setTimeout(nach, 400); if (document.readyState !== 'complete') addEventListener('load', () => setTimeout(nach, 60), { once: true }); } } }
  if (STATISCH) bilderMalen();
  root.dataset.bereit = '1';
})();
} // Ende: nur ohne Rückkehrer-Marke
