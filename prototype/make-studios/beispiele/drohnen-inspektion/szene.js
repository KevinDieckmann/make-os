// Havelblick Luftservice · die Szene "Der Flug".
// Alles hier ist Illustration: eine gezeichnete Gewerbeanlage von oben (Halle mit Photovoltaik, Bürotrakt, Parkplatz, Fluss).
// Vier Ebenen werden einmal vorgerendert (Karte, Luftbild, Wärmebild, Höhenmodell); pro Bild wird nur gezeigt, was die Drohne
// schon überflogen hat. Gerechnet wird in einer festen Welt von 1600 × 1000 Einheiten, gedreht wird nur der Blick (Handy hochkant).

export const LW = 1600, LH = 1000;

/* ─── Zufall mit festem Startwert: dieselbe Szene bei jedem Aufruf ─── */
function zufall(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));

/* ─── Welt ─── */
const HALLE = { x: 110, y: 300, w: 720, h: 430 };
const BUERO = { x: 830, y: 360, w: 170, h: 310 };
const PV = { x: 340, y: 332, mw: 46, mh: 26, gx: 6, gy: 6, spalten: 9, zeilen: 12 };
const HEISS = { s: 6, z: 4 };                 // Spalte und Zeile des auffälligen Moduls
const WARM = [[2, 9], [4, 10]];               // zwei leicht erwärmte Module
const PARK = { x: 1060, y: 380, w: 440, h: 440 };
const STR = { y: 905, h: 60 };
const HOF = { x: 60, y: 740, w: 960, h: 150 };
const LICHT = [340, 420, 500, 580].map((y) => ({ x: 140, y, w: 170, h: 34 }));
const LUEFTER = [[200, 665], [262, 665], [190, 705]];
const BUERO_TEILE = [[850, 385, 28, 28], [900, 385, 28, 28], [860, 560, 40, 30], [930, 600, 50, 50], [850, 625, 24, 24]];
export const HEISS_PUNKT = { x: PV.x + HEISS.s * (PV.mw + PV.gx) + PV.mw / 2, y: PV.y + HEISS.z * (PV.mh + PV.gy) + PV.mh / 2 };
const flussY = (x) => 84 + 30 * Math.sin(x / 260) + 14 * Math.sin(x / 90 + 1);
const FLUSS_BREITE = 78;

const innen = (px, py, r, m = 0) => px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m;

const BAEUME = (() => {
  const z = zufall(11), liste = [];
  const sperre = [HALLE, BUERO, PARK, HOF, { x: 0, y: STR.y, w: LW, h: STR.h }];
  for (let v = 0; v < 900 && liste.length < 52; v++) {
    const x = 20 + z() * (LW - 40), y = 185 + z() * 705, r = 16 + z() * 18;
    if (sperre.some((s) => innen(x, y, s, r + 16))) continue;
    if (liste.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.9)) continue;
    liste.push({ x, y, r, d: z() });
  }
  return liste;
})();

const AUTOS = (() => {
  const z = zufall(23), liste = [];
  const farben = ['#C9C9C2', '#2D3035', '#8B2E2E', '#3B4F70', '#B7B8B3', '#55606A', '#D8D0B8'];
  for (let g = 0; g < 3; g++) for (let i = 0; i < 12; i++) {
    const belegt = z() < 0.56, f = farben[Math.floor(z() * farben.length)], w = z();
    liste.push({ x: PARK.x + 4 + i * 36, y: PARK.y + 20 + g * 140, belegt, f, w });
  }
  return liste;
})();

/* ─── Farbrampen ─── */
const RAMPE_WAERME = [[0, [14, 6, 48]], [0.22, [70, 16, 120]], [0.42, [168, 32, 120]], [0.62, [240, 80, 30]], [0.82, [255, 184, 32]], [1, [255, 250, 224]]];
const RAMPE_HOEHE = [[0, [8, 30, 44]], [0.15, [14, 78, 98]], [0.35, [30, 150, 142]], [0.55, [126, 210, 106]], [0.75, [226, 236, 108]], [1, [255, 243, 194]]];
function rampe(r, t) {
  t = klemme(t);
  for (let i = 1; i < r.length; i++) {
    if (t <= r[i][0]) { const [t0, c0] = r[i - 1], [t1, c1] = r[i], u = (t - t0) / (t1 - t0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * u)); }
  }
  return r[r.length - 1][1];
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const waerme = (t, a = 1) => rgb(rampe(RAMPE_WAERME, t), a);
const hoehe = (t, a = 1) => rgb(rampe(RAMPE_HOEHE, t), a);

/* ─── Zeichenhelfer ─── */
function flussPfad(c, versatz = 0) {
  c.beginPath();
  c.moveTo(-10, flussY(-10) + versatz);
  for (let x = 0; x <= LW + 10; x += 20) c.lineTo(x, flussY(x) + versatz);
  for (let x = LW + 10; x >= -10; x -= 20) c.lineTo(x, flussY(x) + versatz + FLUSS_BREITE);
  c.closePath();
}
function koernung(c, z, rect, anzahl, farben, groesse = 2) {
  for (let i = 0; i < anzahl; i++) {
    c.fillStyle = farben[Math.floor(z() * farben.length)];
    c.fillRect(rect.x + z() * rect.w, rect.y + z() * rect.h, groesse * (0.5 + z()), groesse * (0.5 + z()));
  }
}
const rechteck = (c, r, fuell) => { c.fillStyle = fuell; c.fillRect(r.x, r.y, r.w, r.h); };
const module = (fn) => {
  for (let s = 0; s < PV.spalten; s++) for (let r = 0; r < PV.zeilen; r++) fn(PV.x + s * (PV.mw + PV.gx), PV.y + r * (PV.mh + PV.gy), s, r);
};
const istWarm = (s, r) => WARM.some(([a, b]) => a === s && b === r);

/* ─── Ebene: Karte (noch nicht überflogen) ─── */
function karteZeichnen(c) {
  c.fillStyle = '#0A0F13'; c.fillRect(0, 0, LW, LH);
  c.lineWidth = 1; c.strokeStyle = 'rgba(141,170,190,.07)';
  c.beginPath();
  for (let x = 0; x <= LW; x += 100) { c.moveTo(x, 0); c.lineTo(x, LH); }
  for (let y = 0; y <= LH; y += 100) { c.moveTo(0, y); c.lineTo(LW, y); }
  c.stroke();
  c.strokeStyle = 'rgba(141,170,190,.28)'; c.lineWidth = 1.6;
  const kante = (r) => c.strokeRect(r.x, r.y, r.w, r.h);
  kante(HALLE); kante(BUERO); kante(PARK); kante(HOF);
  c.strokeStyle = 'rgba(141,170,190,.16)';
  module((x, y) => c.strokeRect(x, y, PV.mw, PV.mh));
  LICHT.forEach((l) => c.strokeRect(l.x, l.y, l.w, l.h));
  c.strokeStyle = 'rgba(141,170,190,.22)';
  flussPfad(c); c.stroke();
  c.strokeRect(-4, STR.y, LW + 8, STR.h);
  BAEUME.forEach((b) => { c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.stroke(); });
  AUTOS.forEach((a) => { if (a.belegt) c.strokeRect(a.x + 5, a.y + 6, 26, 56); });
}

/* ─── Ebene: Luftbild ─── */
function fotoZeichnen(c) {
  const z = zufall(5);
  rechteck(c, { x: 0, y: 0, w: LW, h: LH }, '#3A4B35');
  for (let y = 0; y < LH; y += 46) { c.fillStyle = (y / 46) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; c.fillRect(0, y, LW, 46); }
  koernung(c, z, { x: 0, y: 0, w: LW, h: LH }, 9000, ['rgba(20,40,20,.22)', 'rgba(150,170,110,.14)', 'rgba(10,25,10,.18)'], 2.2);
  // Wiesenflecken, Mahdstreifen, Trampelpfade
  for (let i = 0; i < 190; i++) {
    const x = z() * LW, y = z() * LH, r = 30 + z() * 90, hell = z() > 0.5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hell ? 'rgba(150,168,96,.17)' : 'rgba(18,42,24,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  c.fillStyle = 'rgba(190,205,130,.07)'; c.fillRect(1030, 200, 30, 720);
  c.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 200; y < 880; y += 38) c.fillRect(1500, y, 100, 19);
  // Kiesweg und Fußweg, Brücke über den Fluss
  c.fillStyle = '#A99F86'; c.fillRect(1024, 380, 26, 526);
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.strokeRect(1024, 380, 26, 526);
  c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 20; c.beginPath(); c.moveTo(1170, 150); c.quadraticCurveTo(1150, 275, 1037, 392); c.stroke();
  c.strokeStyle = '#B7AE96'; c.lineWidth = 15; c.stroke(); c.lineCap = 'butt';
  // Fluss
  flussPfad(c, -9); c.fillStyle = '#4C5C3E'; c.fill();
  flussPfad(c, -3); c.fillStyle = '#6F7658'; c.fill();
  flussPfad(c); c.fillStyle = '#2D5562'; c.fill();
  c.save(); flussPfad(c); c.clip();
  const spiegel = c.createLinearGradient(0, 40, 0, 190); spiegel.addColorStop(0, 'rgba(120,170,190,.28)'); spiegel.addColorStop(0.5, 'rgba(30,70,86,.1)'); spiegel.addColorStop(1, 'rgba(10,30,40,.34)');
  c.fillStyle = spiegel; c.fillRect(0, 0, LW, 220);
  c.restore();
  c.save(); flussPfad(c); c.clip();
  c.strokeStyle = 'rgba(190,225,235,.14)'; c.lineWidth = 1.4;
  for (let i = 0; i < 90; i++) { const x = z() * LW, y = flussY(x) + 8 + z() * (FLUSS_BREITE - 16); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 14, y - 4, x + 28, y); c.stroke(); }
  c.restore();
  // Brücke
  c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(1156, 62, 40, 100);
  c.fillStyle = '#8C8B84'; c.fillRect(1150, 56, 40, 98);
  c.strokeStyle = '#5F5E58'; c.lineWidth = 3; c.strokeRect(1150, 56, 40, 98);
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.2; c.beginPath(); for (let y = 62; y < 150; y += 8) { c.moveTo(1152, y); c.lineTo(1188, y); } c.stroke();
  // Schilf an den Ufern
  c.strokeStyle = 'rgba(86,104,52,.8)'; c.lineWidth = 1.6; c.beginPath();
  for (let i = 0; i < 260; i++) { const x = z() * LW, o = z() > 0.5, y = flussY(x) + (o ? FLUSS_BREITE : 0) + (o ? 2 : -2); c.moveTo(x, y); c.lineTo(x + (z() - 0.5) * 6, y + (o ? 9 : -9) * (0.5 + z())); }
  c.stroke();
  // Straße
  rechteck(c, { x: 0, y: STR.y, w: LW, h: STR.h }, '#30353A');
  koernung(c, z, { x: 0, y: STR.y, w: LW, h: STR.h }, 1400, ['rgba(255,255,255,.06)', 'rgba(0,0,0,.18)'], 1.6);
  c.fillStyle = 'rgba(230,230,220,.5)'; c.fillRect(0, STR.y + 5, LW, 2); c.fillRect(0, STR.y + STR.h - 7, LW, 2);
  c.fillStyle = 'rgba(232,224,176,.8)'; for (let x = 10; x < LW; x += 70) c.fillRect(x, STR.y + STR.h / 2 - 1.5, 38, 3);
  c.fillStyle = 'rgba(236,236,226,.55)'; for (let i = 0; i < 6; i++) c.fillRect(1040 + i * 9, STR.y + 4, 5, STR.h - 8);
  [[300, STR.y + 8, '#B03A3A'], [640, STR.y + 33, '#D6D8D6'], [1240, STR.y + 8, '#2F5B82']].forEach(([x, y, f]) => {
    c.fillStyle = 'rgba(0,0,0,.34)'; c.fillRect(x + 4, y + 5, 62, 24);
    c.fillStyle = f; c.fillRect(x, y, 62, 24);
    c.fillStyle = 'rgba(20,28,36,.78)'; c.fillRect(x + 14, y + 3, 11, 18); c.fillRect(x + 42, y + 3, 9, 18);
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y, 62, 4);
  });
  // Hof
  rechteck(c, HOF, '#8A8D8B');
  koernung(c, z, HOF, 2600, ['rgba(255,255,255,.08)', 'rgba(0,0,0,.1)'], 1.8);
  c.strokeStyle = 'rgba(40,44,46,.22)'; c.lineWidth = 1.2; c.beginPath();
  for (let x = HOF.x; x <= HOF.x + HOF.w; x += 80) { c.moveTo(x, HOF.y); c.lineTo(x, HOF.y + HOF.h); }
  for (let y = HOF.y; y <= HOF.y + HOF.h; y += 50) { c.moveTo(HOF.x, y); c.lineTo(HOF.x + HOF.w, y); }
  c.stroke();
  c.fillStyle = 'rgba(232,206,86,.7)'; for (let x = HOF.x + 20; x < HOF.x + HOF.w - 40; x += 60) c.fillRect(x, HOF.y + HOF.h - 12, 34, 4);
  const kasten3 = (x, y, w, h, f) => { c.fillStyle = 'rgba(0,0,0,.34)'; c.fillRect(x + 6, y + 7, w, h); c.fillStyle = f; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y, w, 4); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2; c.strokeRect(x, y, w, h); };
  kasten3(120, 772, 150, 34, '#E4E5E1'); kasten3(274, 774, 34, 30, '#8E3430'); c.fillStyle = 'rgba(20,28,36,.75)'; c.fillRect(298, 777, 8, 24);
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.beginPath(); for (let x = 140; x < 268; x += 26) { c.moveTo(x, 774); c.lineTo(x, 804); } c.stroke();
  kasten3(470, 820, 64, 30, '#CFD3D2'); c.fillStyle = 'rgba(20,28,36,.75)'; c.fillRect(516, 823, 10, 24);
  kasten3(700, 770, 62, 28, '#3E6C93'); kasten3(770, 770, 62, 28, '#B8643A'); kasten3(700, 804, 62, 28, '#C9A24A'); kasten3(840, 790, 42, 38, '#9AA39C');
  for (let i = 0; i < 4; i++) kasten3(900 + (i % 2) * 36, 770 + Math.floor(i / 2) * 30, 32, 26, '#A98558');
  // Parkplatz
  rechteck(c, PARK, '#353A3E');
  koernung(c, z, PARK, 3200, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.2)'], 1.8);
  c.strokeStyle = 'rgba(232,232,224,.55)'; c.lineWidth = 2; c.beginPath();
  for (let g = 0; g < 3; g++) for (let i = 0; i <= 12; i++) { const x = PARK.x + 4 + i * 36, y = PARK.y + 20 + g * 140; c.moveTo(x, y); c.lineTo(x, y + 68); }
  c.stroke();
  AUTOS.forEach((a) => {
    if (!a.belegt) return;
    c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(a.x + 9, a.y + 10, 26, 56);
    c.fillStyle = a.f; c.fillRect(a.x + 5, a.y + 6, 26, 56);
    c.fillStyle = 'rgba(20,28,36,.78)'; c.fillRect(a.x + 8, a.y + 20, 20, 12); c.fillRect(a.x + 8, a.y + 44, 20, 9);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(a.x + 5, a.y + 6, 26, 5);
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(a.x + 8, a.y + 33, 20, 10);
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(a.x + 7, a.y + 34, 8, 8);
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.strokeRect(a.x + 5, a.y + 6, 26, 56);
  });
  c.fillStyle = 'rgba(70,74,78,.5)'; c.fillRect(PARK.x, PARK.y + 120, PARK.w, 2);
  // Schatten der Gebäude (Licht von links oben)
  c.fillStyle = 'rgba(0,0,0,.34)';
  c.fillRect(HALLE.x + 16, HALLE.y + 16, HALLE.w, HALLE.h); c.fillRect(BUERO.x + 14, BUERO.y + 14, BUERO.w, BUERO.h);
  // Halle
  rechteck(c, HALLE, '#7B7E82');
  koernung(c, z, HALLE, 5200, ['rgba(255,255,255,.1)', 'rgba(0,0,0,.12)', 'rgba(210,205,190,.1)'], 1.8);
  c.strokeStyle = '#5A5E62'; c.lineWidth = 9; c.strokeRect(HALLE.x + 4, HALLE.y + 4, HALLE.w - 8, HALLE.h - 8);
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.strokeRect(HALLE.x + 9, HALLE.y + 9, HALLE.w - 18, HALLE.h - 18);
  // Dachhaut: Trapezblech, Firstlinie, Regenrinne, Wartungsweg
  for (let x = HALLE.x + 14; x < HALLE.x + HALLE.w - 14; x += 18) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, HALLE.y + 14, 5, HALLE.h - 28); c.fillStyle = 'rgba(0,0,0,.09)'; c.fillRect(x + 7, HALLE.y + 14, 4, HALLE.h - 28); }
  const hy = HALLE.y + HALLE.h / 2; c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(HALLE.x + 10, hy - 3, HALLE.w - 20, 6); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(HALLE.x + 10, hy - 5, HALLE.w - 20, 2);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(HALLE.x + 10, HALLE.y + HALLE.h - 26, HALLE.w - 20, 5);
  for (let i = 0; i < 24; i++) { const x = HALLE.x + 20 + z() * (HALLE.w - 40), y = HALLE.y + 20 + z() * (HALLE.h - 40), r = 8 + z() * 26; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(40,36,30,.14)'); g.addColorStop(1, 'rgba(40,36,30,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  LICHT.forEach((l) => {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(l.x + 4, l.y + 4, l.w, l.h);
    c.fillStyle = '#A9C3CE'; c.fillRect(l.x, l.y, l.w, l.h);
    c.strokeStyle = 'rgba(60,80,90,.7)'; c.lineWidth = 2; c.strokeRect(l.x, l.y, l.w, l.h);
    c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(l.x + (l.w / 5) * i, l.y); c.lineTo(l.x + (l.w / 5) * i, l.y + l.h); } c.stroke();
    const g = c.createLinearGradient(l.x, l.y, l.x + l.w, l.y + l.h); g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(l.x, l.y, l.w, l.h);
  });
  LUEFTER.forEach(([x, y]) => {
    c.fillStyle = 'rgba(0,0,0,.34)'; c.beginPath(); c.arc(x + 4, y + 5, 12, 0, 7); c.fill();
    c.fillStyle = '#B9BCBF'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill();
    c.fillStyle = '#6F7377'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill();
  });
  // Photovoltaik
  module((x, y, s, r) => {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 3, y + 3, PV.mw, PV.mh);
    const v = (z() - 0.5) * 12;
    c.fillStyle = `rgb(${28 + v},${45 + v},${78 + v})`; c.fillRect(x, y, PV.mw, PV.mh);
    c.strokeStyle = 'rgba(120,150,200,.4)'; c.lineWidth = 0.8; c.beginPath();
    for (let i = 1; i < 6; i++) { c.moveTo(x + (PV.mw / 6) * i, y); c.lineTo(x + (PV.mw / 6) * i, y + PV.mh); }
    c.moveTo(x, y + PV.mh / 2); c.lineTo(x + PV.mw, y + PV.mh / 2); c.stroke();
    c.strokeStyle = 'rgba(190,200,212,.75)'; c.lineWidth = 1.2; c.strokeRect(x, y, PV.mw, PV.mh);
  });
  const sheen = c.createLinearGradient(PV.x, PV.y, PV.x + 470, PV.y + 380);
  sheen.addColorStop(0, 'rgba(255,255,255,.16)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.07)');
  c.fillStyle = sheen; c.fillRect(PV.x - 4, PV.y - 4, PV.spalten * (PV.mw + PV.gx) + 2, PV.zeilen * (PV.mh + PV.gy));
  // Bürotrakt
  rechteck(c, BUERO, '#9B9DA0');
  koernung(c, z, BUERO, 1800, ['rgba(255,255,255,.12)', 'rgba(0,0,0,.1)'], 1.8);
  c.strokeStyle = '#6E7175'; c.lineWidth = 8; c.strokeRect(BUERO.x + 4, BUERO.y + 4, BUERO.w - 8, BUERO.h - 8);
  BUERO_TEILE.forEach(([x, y, w, h]) => {
    c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(x + 5, y + 5, w, h);
    c.fillStyle = '#C7C9CB'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x, y, w, 4);
    c.strokeStyle = 'rgba(70,74,78,.6)'; c.lineWidth = 1.4; c.strokeRect(x, y, w, h);
  });
  // Bäume
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 14; c.shadowOffsetX = 12; c.shadowOffsetY = 13;
  BAEUME.forEach((b) => { c.fillStyle = '#1F3319'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.92, 0, 7); c.fill(); });
  c.restore();
  BAEUME.forEach((b, i) => {
    const t = zufall(100 + i), dunkel = b.d > 0.5 ? ['#2F4D27', '#3A5C2D', '#456B33'] : ['#2A4423', '#355429', '#40612F'], hell = b.d > 0.5 ? ['#7FA24E', '#93B05A'] : ['#6A9348', '#7BA054'];
    c.fillStyle = '#1F3319'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
    for (let k = 0; k < 9; k++) {
      const w = t() * 6.283, d = b.r * (0.25 + t() * 0.5), rr = b.r * (0.34 + t() * 0.22), x = b.x + Math.cos(w) * d, y = b.y + Math.sin(w) * d;
      c.fillStyle = dunkel[k % 3]; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
    }
    for (let k = 0; k < 7; k++) {
      const w = (3.9 + (t() - 0.5) * 1.8), d = b.r * (0.12 + t() * 0.42), rr = b.r * (0.14 + t() * 0.14), x = b.x + Math.cos(w) * d, y = b.y + Math.sin(w) * d;
      c.fillStyle = hell[k % 2]; c.globalAlpha = 0.55 + t() * 0.35; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(10,22,10,.2)'; c.beginPath(); c.arc(b.x + b.r * 0.35, b.y + b.r * 0.38, b.r * 0.55, 0, 7); c.fill();
  });
  // Licht und Körnung über dem ganzen Bild: Sonne von links oben, Dunst, Sensorrauschen
  const licht = c.createLinearGradient(0, 0, LW, LH); licht.addColorStop(0, 'rgba(255,240,205,.1)'); licht.addColorStop(0.5, 'rgba(255,255,255,0)'); licht.addColorStop(1, 'rgba(10,20,40,.16)');
  c.fillStyle = licht; c.fillRect(0, 0, LW, LH);
  koernung(c, z, { x: 0, y: 0, w: LW, h: LH }, 14000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.07)'], 1.4);
}

/* ─── Ebene: Wärmebild (Falschfarben, bewusst weich) ─── */
function waermeZeichnen(c, ebenen) {
  const z = zufall(9);
  rechteck(c, { x: 0, y: 0, w: LW, h: LH }, waerme(0.15));
  for (let i = 0; i < 700; i++) { c.fillStyle = waerme(0.1 + z() * 0.1, 0.35); c.beginPath(); c.arc(z() * LW, z() * LH, 8 + z() * 30, 0, 7); c.fill(); }
  flussPfad(c); c.fillStyle = waerme(0.02); c.fill();
  rechteck(c, { x: 0, y: STR.y, w: LW, h: STR.h }, waerme(0.5));
  rechteck(c, HOF, waerme(0.38));
  rechteck(c, PARK, waerme(0.47));
  AUTOS.forEach((a) => { if (a.belegt) { c.fillStyle = waerme(0.3 + a.w * 0.16); c.fillRect(a.x + 5, a.y + 6, 26, 56); } });
  BAEUME.forEach((b) => { c.fillStyle = waerme(0.2 + b.d * 0.06); c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); });
  // Schatten sind kühler
  c.fillStyle = waerme(0.1, 0.45); c.fillRect(HALLE.x + HALLE.w, HALLE.y + 16, 16, HALLE.h);
  rechteck(c, HALLE, waerme(0.41));
  const lauf = c.createLinearGradient(HALLE.x, HALLE.y, HALLE.x + HALLE.w, HALLE.y + HALLE.h);
  lauf.addColorStop(0, waerme(0.36, 0.5)); lauf.addColorStop(1, waerme(0.46, 0.5)); c.fillStyle = lauf; c.fillRect(HALLE.x, HALLE.y, HALLE.w, HALLE.h);
  LICHT.forEach((l) => { c.fillStyle = waerme(0.3); c.fillRect(l.x, l.y, l.w, l.h); });
  LUEFTER.forEach(([x, y]) => { c.fillStyle = waerme(0.68); c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); });
  module((x, y, s, r) => {
    const t = 0.6 + (z() - 0.5) * 0.06 + (r / PV.zeilen) * 0.02;
    c.fillStyle = waerme(istWarm(s, r) ? 0.76 : t); c.fillRect(x, y, PV.mw, PV.mh);
  });
  // Wärmequellen der Fahrzeuge: Motor, Kühlung, frisch geparkt
  AUTOS.forEach((a, i) => { if (a.belegt && i % 5 === 1) { const g = c.createRadialGradient(a.x + 18, a.y + 14, 1, a.x + 18, a.y + 14, 18); g.addColorStop(0, waerme(0.9, 0.9)); g.addColorStop(1, waerme(0.5, 0)); c.fillStyle = g; c.fillRect(a.x - 2, a.y - 4, 40, 40); } });
  c.fillStyle = waerme(0.8); c.fillRect(274, 774, 34, 30); c.fillStyle = waerme(0.56); c.fillRect(120, 772, 150, 34);
  // die Struktur des Luftbilds (Kanten, Fugen, Kronen, Schatten) legt sich über die Falschfarben: dieselbe Zeichnung
  if (ebenen && ebenen.foto) { c.save(); c.globalCompositeOperation = 'luminosity'; c.globalAlpha = 0.42; c.drawImage(ebenen.foto, 0, 0, LW, LH); c.restore(); }
  module((x, y, s, r) => { if (istWarm(s, r)) { c.fillStyle = waerme(0.76); c.fillRect(x, y, PV.mw, PV.mh); } });
  // das auffällige Modul: eine Zellgruppe läuft heiß, die Wärme zieht in die Nachbarn
  const h = HEISS_PUNKT;
  const halo = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, 46);
  halo.addColorStop(0, waerme(1, 0.95)); halo.addColorStop(0.35, waerme(0.9, 0.7)); halo.addColorStop(1, waerme(0.6, 0));
  c.fillStyle = halo; c.fillRect(h.x - 50, h.y - 50, 100, 100);
  c.fillStyle = waerme(0.94); c.fillRect(h.x - PV.mw / 2, h.y - PV.mh / 2, PV.mw, PV.mh);
  c.fillStyle = waerme(1); c.fillRect(h.x - 9, h.y - 7, 18, 14);
  rechteck(c, BUERO, waerme(0.45));
  BUERO_TEILE.forEach(([x, y, w, hh]) => { c.fillStyle = waerme(0.62); c.fillRect(x, y, w, hh); });
}

/* ─── Ebene: Höhenmodell mit Messpunkten ─── */
function hoeheZeichnen(c) {
  rechteck(c, { x: 0, y: 0, w: LW, h: LH }, hoehe(0.07));
  flussPfad(c); c.fillStyle = hoehe(0); c.fill();
  rechteck(c, { x: 0, y: STR.y, w: LW, h: STR.h }, hoehe(0.05));
  rechteck(c, PARK, hoehe(0.06));
  rechteck(c, HOF, hoehe(0.06));
  AUTOS.forEach((a) => { if (a.belegt) { c.fillStyle = hoehe(0.2); c.fillRect(a.x + 5, a.y + 6, 26, 56); } });
  BAEUME.forEach((b) => {
    const g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 4);
    g.addColorStop(0, hoehe(0.62 + b.d * 0.12)); g.addColorStop(0.7, hoehe(0.34)); g.addColorStop(1, hoehe(0.1, 0));
    c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r + 4, 0, 7); c.fill();
  });
  const kasten = (r, t) => { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(r.x + 12, r.y + 12, r.w, r.h); c.fillStyle = hoehe(t); c.fillRect(r.x, r.y, r.w, r.h); };
  kasten(HALLE, 0.46); kasten(BUERO, 0.68);
  module((x, y) => { c.fillStyle = hoehe(0.56); c.fillRect(x, y, PV.mw, PV.mh); c.strokeStyle = hoehe(0.4); c.lineWidth = 1; c.strokeRect(x, y, PV.mw, PV.mh); });
  BUERO_TEILE.forEach(([x, y, w, h]) => { c.fillStyle = hoehe(0.92); c.fillRect(x, y, w, h); });
  LICHT.forEach((l) => { c.fillStyle = hoehe(0.62); c.fillRect(l.x, l.y, l.w, l.h); });
  // Höhenlinien: Kanten, die eine Stufe anzeigen
  c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = 1.3;
  [HALLE, BUERO].forEach((r) => { for (let i = 0; i < 3; i++) c.strokeRect(r.x - i * 6, r.y - i * 6, r.w + i * 12, r.h + i * 12); });
  BAEUME.forEach((b) => { c.beginPath(); c.arc(b.x, b.y, b.r * 0.62, 0, 7); c.stroke(); });
  // Messpunkte im Raster
  c.fillStyle = 'rgba(255,255,255,.78)';
  for (let x = 20; x < LW; x += 34) for (let y = 20; y < LH; y += 34) { c.beginPath(); c.arc(x, y, 2.1, 0, 7); c.fill(); }
}

/* ─── Ebenen vorrendern ─── */
const ZEICHNER = { karte: karteZeichnen, foto: fotoZeichnen, waerme: waermeZeichnen, hoehe: hoeheZeichnen };
const AUFLOESUNG = { karte: 1, foto: 1, waerme: 0.5, hoehe: 1 };

function ebenenBauen(k) {
  const aus = {};
  for (const name of Object.keys(ZEICHNER)) {
    const f = k * AUFLOESUNG[name];
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(LW * f)); cv.height = Math.max(2, Math.round(LH * f));
    const c = cv.getContext('2d');
    c.scale(cv.width / LW, cv.height / LH);
    ZEICHNER[name](c, aus);
    aus[name] = cv;
  }
  return aus;
}

/* ─── Flugbahn: Streifen mit Wendebögen ─── */
const BAHN_X0 = 90, BAHN_X1 = 1020, STREIFEN = 7, BAHN_Y0 = 330, BAHN_Y1 = 710, BAND_H = 84, FUSS_B = 126;
const BILD_ABSTAND = 90;

function bahnBauen() {
  const pts = [], streifen = [];
  const dy = (BAHN_Y1 - BAHN_Y0) / (STREIFEN - 1), r = dy / 2;
  let s = 0;
  const puts = (x, y) => { const n = pts.length; if (n) { const p = pts[n - 1]; s += Math.hypot(x - p.x, y - p.y); } pts.push({ x, y, s }); };
  for (let i = 0; i < STREIFEN; i++) {
    const y = BAHN_Y0 + i * dy, rechts = i % 2 === 0;
    const xa = rechts ? BAHN_X0 : BAHN_X1, xb = rechts ? BAHN_X1 : BAHN_X0;
    puts(xa, y); const a = s; puts(xb, y); const b = s;
    streifen.push({ y, xa, xb, a, b });
    if (i < STREIFEN - 1) {
      const vz = rechts ? 1 : -1, cy = y + r;
      for (let q = 1; q <= 16; q++) { const w = Math.PI * q / 16; puts(xb + vz * r * Math.sin(w), cy - r * Math.cos(w)); }
    }
  }
  return { pts, streifen, laenge: s };
}
const BAHN = bahnBauen();

function ortBei(s) {
  const p = BAHN.pts;
  let lo = 0, hi = p.length - 1;
  s = klemme(s, 0, BAHN.laenge);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s <= s) lo = m; else hi = m; }
  const a = p[lo], b = p[hi], u = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/* ─── Die Szene ─── */
export function szeneBauen(canvas, opts = {}) {
  const c = canvas.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, hochkant = false, m = null, ebenen = null, ebenenK = 0;

  function lage() {
    const s = (hochkant ? Math.max(cw / LH, ch / LW) : Math.max(cw / LW, ch / LH)) * (opts.zoom || 1);
    const fx = 560, fy = 520;
    if (hochkant) return { s, a: 0, b: s, c: -s, d: 0, e: cw / 2 + s * fy, f: ch / 2 - s * fx };
    return { s, a: s, b: 0, c: 0, d: s, e: cw / 2 - s * fx, f: ch / 2 - s * fy };
  }

  function groesse() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(2, Math.round(r.width)), nh = Math.max(2, Math.round(r.height));
    const nd = Math.min(2, window.devicePixelRatio || 1);
    if (nw === cw && nh === ch && nd === dpr && ebenen) return false;
    cw = nw; ch = nh; dpr = nd; hochkant = ch > cw * 1.05;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    m = lage();
    const k = Math.min(m.s * dpr * 1.05, 2600 / LW);
    if (!ebenen || Math.abs(k - ebenenK) / ebenenK > 0.25) { ebenen = ebenenBauen(Math.max(0.3, k)); ebenenK = k; }
    return true;
  }

  const bildschirm = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

  /**
   * @param {{p:number, plan:number, modus:string, davor:string, mix:number, t:number}} z
   *   p = Flug 0–1, plan = geplante Bahn 0–1, modus = foto | waerme | hoehe, davor/mix = Überblendung
   */
  function zeichnen(z) {
    if (!m) groesse();
    const s = m.s, s_ = z.p * BAHN.laenge;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0A0F13'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(m.a * dpr, m.b * dpr, m.c * dpr, m.d * dpr, m.e * dpr, m.f * dpr);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(ebenen.karte, 0, 0, LW, LH);

    // überflogene Fläche
    const flaechen = BAHN.streifen.map((st) => {
      const f = klemme((s_ - st.a) / (st.b - st.a));
      const cur = st.xa + f * (st.xb - st.xa), von = Math.min(st.xa, cur), bis = Math.max(st.xa, cur);
      const gestartet = s_ >= st.a - 1 || f > 0;
      return gestartet ? { x: von - FUSS_B / 2, y: st.y - BAND_H / 2, w: bis - von + FUSS_B, h: BAND_H } : null;
    }).filter(Boolean);

    if (flaechen.length) {
      c.save();
      c.beginPath(); flaechen.forEach((r) => c.rect(r.x, r.y, r.w, r.h)); c.clip();
      if (z.mix < 1 && z.davor && ebenen[z.davor]) c.drawImage(ebenen[z.davor], 0, 0, LW, LH);
      c.globalAlpha = z.mix >= 1 ? 1 : z.mix;
      c.drawImage(ebenen[z.modus], 0, 0, LW, LH);
      c.globalAlpha = 1;
      c.restore();
      // Ränder der Streifen, damit die Überlappung sichtbar bleibt
      c.lineWidth = 1 / s; c.strokeStyle = 'rgba(255,176,32,.22)';
      flaechen.forEach((r) => c.strokeRect(r.x, r.y, r.w, r.h));
    }

    // geplante Bahn (gepunktet) und geflogene Bahn (durchgezogen)
    const strecke = (bis, strich) => {
      c.beginPath(); c.setLineDash(strich || []);
      const p = BAHN.pts; c.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length && p[i].s <= bis; i++) c.lineTo(p[i].x, p[i].y);
      const e = ortBei(bis); c.lineTo(e.x, e.y); c.stroke(); c.setLineDash([]);
    };
    if (z.plan > 0) { c.lineWidth = 1.6 / s; c.strokeStyle = 'rgba(255,106,43,.55)'; strecke(z.plan * BAHN.laenge, [6 / s, 9 / s]); }
    if (z.p > 0) { c.lineWidth = 2.4 / s; c.strokeStyle = 'rgba(255,176,32,.95)'; strecke(s_); }

    // Aufnahmepunkte
    const anzahl = z.p > 0 ? Math.floor(s_ / BILD_ABSTAND) + 1 : 0;
    c.strokeStyle = 'rgba(255,240,220,.8)'; c.lineWidth = 1.3 / s;
    for (let i = 0; i < anzahl; i++) { const o = ortBei(i * BILD_ABSTAND), q = 4.5 / s; c.beginPath(); c.moveTo(o.x - q, o.y); c.lineTo(o.x + q, o.y); c.moveTo(o.x, o.y - q); c.lineTo(o.x, o.y + q); c.stroke(); }

    // Hotspot-Ring (nur im Wärmebild, nur wenn überflogen)
    const abgedeckt = flaechen.some((r) => HEISS_PUNKT.x > r.x && HEISS_PUNKT.x < r.x + r.w && HEISS_PUNKT.y > r.y && HEISS_PUNKT.y < r.y + r.h);
    const sichtbar = abgedeckt && z.modus === 'waerme' && z.mix > 0.6;
    if (sichtbar) {
      const puls = (z.t * 0.9) % 1;
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2 / s; c.beginPath(); c.arc(HEISS_PUNKT.x, HEISS_PUNKT.y, 30, 0, 7); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - puls)})`; c.lineWidth = 1.6 / s; c.beginPath(); c.arc(HEISS_PUNKT.x, HEISS_PUNKT.y, 30 + puls * 38, 0, 7); c.stroke();
    }

    // Drohne mit Bildfeld
    const d = ortBei(s_);
    const fl = FUSS_B, hh = BAND_H;
    c.fillStyle = 'rgba(255,106,43,.07)'; c.fillRect(d.x - fl / 2, d.y - hh / 2, fl, hh);
    c.strokeStyle = 'rgba(255,176,32,.95)'; c.lineWidth = 1.8 / s;
    const e = 12;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      const x = d.x + sx * fl / 2, y = d.y + sy * hh / 2;
      c.beginPath(); c.moveTo(x - sx * e, y); c.lineTo(x, y); c.lineTo(x, y - sy * e); c.stroke();
    });
    // Schatten
    const sg = c.createRadialGradient(d.x + 26, d.y + 32, 2, d.x + 26, d.y + 32, 28);
    sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(d.x - 10, d.y - 10, 80, 80);
    drohneZeichnen(c, d.x, d.y, z.t, s);

    const info = { streifen: Math.min(STREIFEN, flaechen.length || 0), aufnahmen: anzahl, heissSichtbar: sichtbar, heiss: bildschirm(HEISS_PUNKT.x, HEISS_PUNKT.y), drohne: bildschirm(d.x, d.y) };
    return info;
  }

  return { groesse, zeichnen, ebenen: () => ebenen, bildschirm, pfade: BAHN };
}

function drohneZeichnen(c, x, y, t, s) {
  c.save(); c.translate(x, y);
  const arm = 21, rr = 12;
  c.strokeStyle = '#1B232A'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-arm, -arm); c.lineTo(arm, arm); c.moveTo(arm, -arm); c.lineTo(-arm, arm); c.stroke();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => {
    const px = sx * arm, py = sy * arm;
    c.fillStyle = 'rgba(210,225,235,.17)'; c.beginPath(); c.arc(px, py, rr, 0, 7); c.fill();
    c.strokeStyle = 'rgba(230,240,246,.55)'; c.lineWidth = 1.1; c.beginPath(); c.arc(px, py, rr, 0, 7); c.stroke();
    const w = t * 34 * (i % 2 ? -1 : 1);
    c.strokeStyle = 'rgba(240,246,250,.8)'; c.lineWidth = 2; c.beginPath();
    c.moveTo(px + Math.cos(w) * rr, py + Math.sin(w) * rr); c.lineTo(px - Math.cos(w) * rr, py - Math.sin(w) * rr); c.stroke();
    c.fillStyle = '#12181D'; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill();
  });
  c.fillStyle = '#EDF2F5'; c.beginPath(); c.roundRect(-11, -13, 22, 26, 7); c.fill();
  c.fillStyle = '#1B232A'; c.beginPath(); c.roundRect(-7, -9, 14, 14, 4); c.fill();
  c.fillStyle = '#FF6A2B'; c.beginPath(); c.arc(0, 9, 2.6, 0, 7); c.fill();
  c.fillStyle = 'rgba(120,200,235,.9)'; c.beginPath(); c.arc(0, -2, 3.2, 0, 7); c.fill();
  c.restore();
}

/* ─── Ausschnitte der Ebenen für die Ergebnis-Ansicht ─── */
export function ausschnittZeichnen(ziel, szene, ebene, rahmen, marke) {
  const e = szene.ebenen(); if (!e || !e[ebene]) return;
  const c = ziel.getContext('2d'), f = e[ebene].width / LW;
  c.clearRect(0, 0, ziel.width, ziel.height);
  c.imageSmoothingQuality = 'high';
  c.drawImage(e[ebene], rahmen.x * f, rahmen.y * f, rahmen.w * f, rahmen.h * f, 0, 0, ziel.width, ziel.height);
  if (marke) {
    const px = ((HEISS_PUNKT.x - rahmen.x) / rahmen.w) * ziel.width, py = ((HEISS_PUNKT.y - rahmen.y) / rahmen.h) * ziel.height;
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, ziel.width * 0.028, 0, 7); c.stroke();
  }
}

/* ─── Nahaufnahme der Module für den Vorher-nachher-Regler ─── */
export function moduleDetail(canvas, modus) {
  const W = canvas.width, H = canvas.height, z = zufall(modus === 'waerme' ? 41 : 43);
  const c = canvas.getContext('2d');
  const spalten = 5, zeilen = 2, mw = 190, mh = 300, lueck = 16;
  const ox = (W - (spalten * mw + (spalten - 1) * lueck)) / 2, oy = (H - (zeilen * mh + (zeilen - 1) * lueck)) / 2;
  const heissS = 3, heissZ = 0;
  const zelle = { s: 6, z: 10 };
  if (modus === 'foto') {
    c.fillStyle = '#6F7377'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) { c.fillStyle = z() > 0.5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'; c.fillRect(z() * W, z() * H, 2 + z() * 2, 2 + z() * 2); }
    for (let r = 0; r < zeilen; r++) for (let s = 0; s < spalten; s++) {
      const x = ox + s * (mw + lueck), y = oy + r * (mh + lueck);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 8, y + 8, mw, mh);
      c.fillStyle = '#B7C0CA'; c.fillRect(x, y, mw, mh);
      const cw2 = (mw - 14) / zelle.s, ch2 = (mh - 14) / zelle.z;
      for (let i = 0; i < zelle.s; i++) for (let j = 0; j < zelle.z; j++) {
        const v = (z() - 0.5) * 12;
        c.fillStyle = `rgb(${26 + v},${44 + v},${84 + v})`; c.fillRect(x + 7 + i * cw2 + 1.5, y + 7 + j * ch2 + 1.5, cw2 - 3, ch2 - 3);
        c.fillStyle = 'rgba(150,175,215,.3)'; c.fillRect(x + 7 + i * cw2 + cw2 / 3, y + 7 + j * ch2 + 1.5, 1.4, ch2 - 3); c.fillRect(x + 7 + i * cw2 + (2 * cw2) / 3, y + 7 + j * ch2 + 1.5, 1.4, ch2 - 3);
      }
    }
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.08)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    return;
  }
  // Wärmebild: erst klein, dann hochgezogen (weich)
  const k = 0.34, klein = document.createElement('canvas'); klein.width = Math.round(W * k); klein.height = Math.round(H * k);
  const q = klein.getContext('2d'); q.scale(k, k);
  q.fillStyle = waerme(0.38); q.fillRect(0, 0, W, H);
  for (let r = 0; r < zeilen; r++) for (let s = 0; s < spalten; s++) {
    const x = ox + s * (mw + lueck), y = oy + r * (mh + lueck);
    q.fillStyle = waerme(0.5); q.fillRect(x, y, mw, mh);
    const cw2 = (mw - 14) / zelle.s, ch2 = (mh - 14) / zelle.z;
    for (let i = 0; i < zelle.s; i++) for (let j = 0; j < zelle.z; j++) {
      let t = 0.6 + (z() - 0.5) * 0.05 + (j / zelle.z) * 0.02;
      if (s === 1 && r === 1 && i === 2 && j === 6) t = 0.8;
      q.fillStyle = waerme(t); q.fillRect(x + 7 + i * cw2 + 1, y + 7 + j * ch2 + 1, cw2 - 2, ch2 - 2);
    }
  }
  const hx = ox + heissS * (mw + lueck) + 7 + 3 * ((mw - 14) / zelle.s) + 8, hy = oy + heissZ * (mh + lueck) + 7 + 4 * ((mh - 14) / zelle.z) + 10;
  const halo = q.createRadialGradient(hx, hy, 4, hx, hy, 150);
  halo.addColorStop(0, waerme(1, 0.95)); halo.addColorStop(0.3, waerme(0.9, 0.75)); halo.addColorStop(1, waerme(0.62, 0));
  q.fillStyle = halo; q.fillRect(hx - 160, hy - 160, 320, 320);
  q.fillStyle = waerme(0.97); const cw3 = (mw - 14) / zelle.s, ch3 = (mh - 14) / zelle.z;
  q.fillRect(ox + heissS * (mw + lueck) + 7 + 3 * cw3 + 1, oy + 7 + 4 * ch3 + 1, cw3 - 2, ch3 - 2);
  q.fillRect(ox + heissS * (mw + lueck) + 7 + 3 * cw3 + 1, oy + 7 + 5 * ch3 + 1, cw3 - 2, ch3 - 2);
  q.fillStyle = waerme(1); q.fillRect(ox + heissS * (mw + lueck) + 7 + 3 * cw3 + 6, oy + 7 + 4 * ch3 + 6, cw3 - 12, ch3 * 1.4);
  c.imageSmoothingQuality = 'high'; c.drawImage(klein, 0, 0, W, H);
  return { x: hx / W, y: hy / H };
}
