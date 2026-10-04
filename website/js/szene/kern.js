// MAKE Innovation · Szene v5 — Kern (04.10.2026)
// Reine Mathematik ohne DOM: fester Zufall, Vektoren, Matrizen, der Pfad der Kamerafahrt, die Lichtfäden entlang des
// Pfads, die Kamera aus dem Scroll-Stand und das Abtasten von SVG-Formen (Logo, Karte). Dieselbe Datei läuft im Browser
// (js/szene/motor.js) und in Node (website/standbild.mjs, Standbilder je Kapitel) — eine Quelle für Bild und Standbild.
// Wiederverwendbar: die Seite legt ihr Drehbuch fest (js/drehbuch.js), der Kern kennt keine Inhalte.
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sanft = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const sanfter = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };

  /** Fester Zufall: gleiche Geometrie bei jedem Laden (Standbilder passen zum Bild im Browser). */
  function zufall(saat) {
    let s = saat >>> 0;
    const z = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    z.g = () => (z() + z() + z() + z() - 2) * 1.2247;
    return z;
  }

  // ── Vektoren (Arrays [x, y, z]) ──
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ── Matrizen (4 × 4, Spalten zuerst wie WebGL) ──
  /** Perspektive mit Objektiv-Verschiebung (schubX/Y in NDC): die Szene steht rechts neben dem Text, ohne zu kippen. */
  function perspektive(fov, aspekt, nah, fern, schubX, schubY) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (nah - fern);
    return new Float32Array([f / aspekt, 0, 0, 0, 0, f, 0, 0, -schubX, -schubY, (fern + nah) * nf, -1, 0, 0, 2 * fern * nah * nf, 0]);
  }
  function blick(auge, ziel, oben) {
    const z = norm(sub(auge, ziel)), x = norm(cross(oben, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, auge), -dot(y, auge), -dot(z, auge), 1]);
  }
  function mal(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  /** Weltpunkt → [x, y] in NDC (−1…1) und w (> 0 = vor der Kamera). */
  function projiziere(m, p) {
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [x / w, y / w, w];
  }

  // ── Der Pfad: eine ruhige, analytische Kurve in die Tiefe (−z). Dieselbe Formel steht als GLSL im Shader. ──
  const PFAD = { ax: 7, fx: .021, bx: 3, gx: .047, pb: 1.3, ay: 2.4, fy: .033, py: .7 };
  function pfad(s) {
    return [PFAD.ax * Math.sin(s * PFAD.fx) + PFAD.bx * Math.sin(s * PFAD.gx + PFAD.pb), PFAD.ay * Math.sin(s * PFAD.fy + PFAD.py), -s];
  }
  /** Begleitendes Dreibein am Pfad: p (Punkt), t (vorwärts), r (rechts), u (oben). */
  function rahmen(s) {
    const p = pfad(s), t = norm(sub(pfad(s + .5), pfad(s - .5)));
    const r = norm(cross(t, [0, 1, 0])), u = cross(r, t);
    return { p, t, r, u };
  }
  /** Lokale Koordinaten am Rahmen → Welt. x rechts, y oben, z zur Kamera (gegen die Fahrtrichtung). */
  function lokal(f, x, y, z) {
    return [f.p[0] + f.r[0] * x + f.u[0] * y - f.t[0] * z, f.p[1] + f.r[1] * x + f.u[1] * y - f.t[1] * z, f.p[2] + f.r[2] * x + f.u[2] * y - f.t[2] * z];
  }
  const zahl = n => (Math.round(n * 10000) / 10000).toFixed(4);
  function pfadGlsl() {
    const P = PFAD;
    return `vec3 pfad(float s){return vec3(${zahl(P.ax)}*sin(s*${zahl(P.fx)})+${zahl(P.bx)}*sin(s*${zahl(P.gx)}+${zahl(P.pb)}),${zahl(P.ay)}*sin(s*${zahl(P.fy)}+${zahl(P.py)}),-s);}
void rahmen(float s,out vec3 p,out vec3 r,out vec3 u){p=pfad(s);vec3 t=normalize(pfad(s+.5)-pfad(s-.5));r=normalize(cross(t,vec3(0.,1.,0.)));u=cross(r,t);}
`;
  }

  // ── Lichtfäden entlang des Pfads (Granat und Smaragd gegenläufig verflochten, dazu wenige helle Fäden). ──
  // ziele: Knoten, in die alle Fäden münden ({ s, x, y, vor, nach }: ab s − vor ziehen sie sich auf (x, y) zusammen,
  // danach sind sie bis s + nach unsichtbar) — so fließt der Weg in Berlin auf der Karte und am Ende in den Logo-Knoten.
  function faden(s, saat, strang, zeit, ziele) {
    const welle = .5 + .5 * Math.sin(s * .19 + saat * 11 - zeit * .9);
    const huelle = .6 + .4 * Math.sin(s * .043 + saat * 3);
    const rad = (.1 + .6 * welle * huelle) * (strang > 1.5 ? 1.7 : 1);
    const dreh = strang > .5 && strang < 1.5 ? -1 : 1;
    const ang = saat * TAU + dreh * (s * .31 + zeit * .22);
    let x = Math.cos(ang) * rad, y = Math.sin(ang) * rad * .8 - .25, sicht = 1;
    for (const z of ziele || []) {
      if (s <= z.s) { const m = sanft((s - z.s + z.vor) / z.vor); x += (z.x - x) * m; y += (z.y - y) * m; }
      else sicht *= clamp((s - z.s - z.nach) / 6, 0, 1);
    }
    return [x, y, sicht];
  }
  function fadenGlsl(ziele) {
    let z = '';
    for (const q of ziele || []) z += `if(s<=${zahl(q.s)}){float m=smoothstep(0.,1.,(s-${zahl(q.s - q.vor)})/${zahl(q.vor)});o=mix(o,vec2(${zahl(q.x)},${zahl(q.y)}),m);}else sicht*=clamp((s-${zahl(q.s + q.nach)})/6.,0.,1.);\n`;
    return `vec3 faden(float s,float saat,float strang,float zeit){
float welle=.5+.5*sin(s*.19+saat*11.-zeit*.9);float huelle=.6+.4*sin(s*.043+saat*3.);
float rad=(.1+.6*welle*huelle)*(strang>1.5?1.7:1.);float dreh=(strang>.5&&strang<1.5)?-1.:1.;
float ang=saat*6.28318+dreh*(s*.31+zeit*.22);vec2 o=vec2(cos(ang)*rad,sin(ang)*rad*.8-.25);float sicht=1.;
${z}return vec3(o,sicht);}
`;
  }

  // ── Kamera aus dem Scroll-Stand ──
  // T: 0 … n−1 (ganze Zahl = Kapitel steht, Bruch = Übergang), dolly: −.5 … .5 (Lesefortschritt im Kapitel, für die
  // leise Fahrt beim Lesen). Je Zustand: s (Anker am Pfad), abstand, hebung, seite, blick (Höhe des Blickziels),
  // breite/hoehe (halbe Größe der Formation → Mindestabstand, damit sie ins Bild passt), schub (Rechner: Szene rechts
  // neben dem Text, NDC). Am Handy steht die Szene ohne Seitenschub im oberen Teil (hoch).
  function kamera(Z, T, dolly, zeit, aspekt, opt) {
    const o = opt || {}, n = Z.length;
    T = clamp(T, 0, n - 1);
    const k = Math.min(Math.floor(T), Math.max(0, n - 2)), e = sanfter(T - k);
    const a = Z[k], b = Z[k + 1] || a;
    const mix = key => a[key] + (b[key] - a[key]) * e;
    const fov = (o.handy ? 50 : 40) * Math.PI / 180, tan = Math.tan(fov / 2);
    const schubX = o.handy || o.mittig ? 0 : mix('schub');
    const schubY = o.mittig ? 0 : o.handy ? mix('hoch') : 0;
    // Platz für die Formation: rechts bis zum Rand, links bis zur Textkante (o.kante in NDC, vom Motor gemessen).
    const freiX = schubX > 0 ? Math.max(.25, Math.min(1 - schubX, schubX - (o.kante ?? 0) * .5 + .06)) : 1 - Math.abs(schubX), freiY = 1 - Math.abs(schubY);
    let D = Math.max(mix('abstand'), mix('breite') * 1.12 / (tan * aspekt * freiX), mix('hoehe') * 1.15 / (tan * freiY));
    D *= 1 - .12 * (dolly || 0);
    if (o.naeher) D *= 1 - o.naeher; // Einstieg: die Kamera beginnt etwas näher und fährt zurück (klingt ab, kämpft nicht mit dem Scroll)
    const sA = mix('s');
    const fz = rahmen(sA), fa = rahmen(sA - D);
    const auge = lokal(fa, mix('seite') + Math.sin(zeit * .05) * .4, mix('hebung') + .5 * (dolly || 0), 0);
    const ziel = lokal(fz, 0, mix('blick'), 0);
    return { auge, ziel, oben: fz.u, fov, schubX, schubY, D, k, e, wert: mix };
  }
  /** Drehbuch-Zustände mit Vorgaben füllen. */
  function zustaende(liste) {
    return liste.map(z => Object.assign({ abstand: 18, hebung: 1, seite: 0, blick: 0, breite: 8, schub: 0, funkeln: .15, faeden: .5, nah: .6, aurora: 1 }, z,
      { hoehe: z.hoehe ?? (z.breite ?? 8) * .72, hoch: z.hoch ?? ((z.schub ?? 0) > 0 ? .4 : 0) }));
  }

  // ── Weiches Folgen, Einstieg, Optionen ──
  /** Kritisch gedämpfte Feder (wie SmoothDamp): z = { wert, v } folgt dem Ziel weich an- und auslaufend, ohne Überschwingen,
   *  unabhängig von der Bildrate. zeit ≈ Zeit bis zum Ziel (s). Das native Scrollen bleibt unberührt — nur die Szene folgt so. */
  function feder(z, ziel, dt, zeit) {
    const w = 2 / Math.max(.001, zeit), x = w * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    const d = z.wert - ziel, t = (z.v + w * d) * dt;
    z.v = (z.v - w * t) * e; z.wert = ziel + (d + t) * e;
    if (Math.abs(z.wert - ziel) < 1e-5 && Math.abs(z.v) < 1e-4) { z.wert = ziel; z.v = 0; }
    return z.wert;
  }
  const ausLaufen = u => { u = clamp(u, 0, 1); return 1 - (1 - u) * (1 - u) * (1 - u); }; // easeOutCubic
  /** Einstieg (Wanduhr): Fortschritt 0…1 → wie weit die Kamera noch näher steht (klingt mit easeOutCubic ab). */
  function einstieg(fortschritt, cfg) { return cfg ? cfg.naeher * (1 - ausLaufen(fortschritt)) : 0; }
  /** Optionen der Szene aus dem Drehbuch (alles abschaltbar: fehlt ein Eintrag oder steht false, gibt es ihn nicht).
   *  einstieg: { dauer (ms), naeher }  ·  aurora: { staerke, aufloesung (Anteil der Leinwand), oktaven, handy: {…} }
   *  text: { kaskade, auftritt } (Überschriften Buchstabe für Buchstabe, Ein-/Ausblenden je Kapitel)  ·  folgen: Federzeit (s). */
  function optionen(drehbuch, handy) {
    const d = drehbuch || {}, mit = (wert, vorgabe) => wert ? Object.assign({}, vorgabe, wert === true ? {} : wert) : null;
    const einst = mit(d.einstieg, { dauer: 2600, naeher: .18 });
    let aurora = mit(d.aurora, { staerke: .24, aufloesung: .25, oktaven: 4, bewegung: true });
    if (aurora && handy) aurora = Object.assign(aurora, { aufloesung: .16, oktaven: 3 }, aurora.handy || {});
    if (aurora) delete aurora.handy;
    const text = d.text === false ? null : Object.assign({ kaskade: true, auftritt: true }, d.text || {});
    return { einstieg: einst, aurora, text, folgen: d.folgen ?? .32 };
  }

  // ── SVG-Formen (Pfade aus M, L, A, Z) → Polygone, Innen-Test (nonzero), Abtasten ──
  function bogen(x1, y1, r, fa, fs, x2, y2, aus) {
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, d2 = dx * dx + dy * dy;
    if (d2 === 0) return;
    if (d2 > r * r) r = Math.sqrt(d2);
    let co = Math.sqrt(Math.max(0, (r * r - d2) / d2)); if (fa === fs) co = -co;
    const cxp = co * dy, cyp = -co * dx, cx = cxp + (x1 + x2) / 2, cy = cyp + (y1 + y2) / 2;
    const t1 = Math.atan2((dy - cyp) / r, (dx - cxp) / r), t2 = Math.atan2((-dy - cyp) / r, (-dx - cxp) / r);
    let dt = t2 - t1;
    if (fs && dt < 0) dt += TAU; if (!fs && dt > 0) dt -= TAU;
    for (let i = 1; i <= 24; i++) { const t = t1 + dt * i / 24; aus.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  }
  function form(d) {
    const polys = []; let cur = null, x = 0, y = 0;
    for (const m of d.matchAll(/([MLAZmlaz])([^MLAZmlaz]*)/g)) {
      const c = m[1].toUpperCase(), n = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
      if (c === 'M') { cur = [[n[0], n[1]]]; polys.push(cur); x = n[0]; y = n[1]; for (let i = 2; i + 1 < n.length; i += 2) { cur.push([n[i], n[i + 1]]); x = n[i]; y = n[i + 1]; } }
      else if (c === 'L') for (let i = 0; i + 1 < n.length; i += 2) { cur.push([n[i], n[i + 1]]); x = n[i]; y = n[i + 1]; }
      else if (c === 'A') for (let i = 0; i + 6 < n.length; i += 7) { bogen(x, y, n[i], n[i + 3], n[i + 4], n[i + 5], n[i + 6], cur); x = n[i + 5]; y = n[i + 6]; }
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) for (const [px, py] of p) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    return { polys, x0, y0, x1, y1 };
  }
  function rechteck(x, y, w, h) { return { polys: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]], x0: x, y0: y, x1: x + w, y1: y + h }; }
  function innen(f, px, py) {
    let w = 0;
    for (const p of f.polys) for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const l = (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]);
      if (a[1] <= py) { if (b[1] > py && l > 0) w++; } else if (b[1] <= py && l < 0) w--;
    }
    return w !== 0;
  }
  /** n Punkte gleichmäßig zufällig in der Form (Verwerfungsverfahren). */
  function abtasten(f, n, z) {
    const aus = []; let versuche = 0;
    while (aus.length < n && versuche++ < n * 400) {
      const x = f.x0 + z() * (f.x1 - f.x0), y = f.y0 + z() * (f.y1 - f.y0);
      if (innen(f, x, y)) aus.push([x, y]);
    }
    return aus;
  }
  /** Fläche (Schätzung über ein Gitter) — verteilt Teilchen gerecht auf mehrere Formen. */
  function flaeche(f) {
    let t = 0; const n = 60;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (innen(f, f.x0 + (i + .5) / n * (f.x1 - f.x0), f.y0 + (j + .5) / n * (f.y1 - f.y0))) t++;
    return t / (n * n) * (f.x1 - f.x0) * (f.y1 - f.y0);
  }

  S.kern = {
    TAU, clamp, sanft, sanfter, zufall, add, sub, mul, dot, cross, len, norm,
    perspektive, blick, mal, projiziere, PFAD, pfad, rahmen, lokal, pfadGlsl, faden, fadenGlsl,
    kamera, zustaende, form, rechteck, innen, abtasten, flaeche, feder, ausLaufen, einstieg, optionen,
  };
})(typeof window !== 'undefined' ? window : globalThis);
