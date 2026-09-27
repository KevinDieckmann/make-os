// ─── MAKE OS Homepage — Formationen der Neuronen-Bühne (27.09., siebter Durchgang) ─
// Reine Geometrie, ohne DOM: jede Formation liefert für N Knoten Zielpunkte im
// Einheitsraum (−1…1, y nach unten), eine Gruppe je Knoten (für Farbe und Kanten)
// und die Kanten als k-nächste Nachbarn innerhalb der Gruppe. Dieselbe Datei läuft
// im Browser (brain.js) und in Node (standbild.mjs) — deshalb kein window, kein DOM.
//
// Formationen und wo sie spielen:
//   welten · chaos · ring · brain        Startseite (Zwei Welten → Sieben Apps → Messbar → ZOE)
//   herz · familie · score               privat.html (Körper → Familie → Privat-Index)
//   trichter · netzwerk · index          business.html (Pipeline → Firmen → Business-Index)
//   brain · stapel · heads               zoe.html (Brain → Stapel → Team der Heads)
//   cluster3                             preise.html (drei ruhige Wege)
//   m                                    ueber.html (Granat + Smaragd → M)
(function (wurzel) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Fester Zufall: gleiche Geometrie bei jedem Laden — die Standbilder passen zum Netz.
  function zufallsquelle(saat) { let s = saat >>> 0; const z = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; z.gauss = () => (z() + z() + z() - 1.5) * 1.15; return z; }

  // k nächste Nachbarn (einmalig), nur innerhalb derselben Gruppe (oder wenn erlaubt(i,j)).
  function nachbarn(pos, dim, k, erlaubt) {
    const n = pos.length / dim, kanten = [], seen = new Set();
    for (let i = 0; i < n; i++) {
      const best = [];
      for (let j = 0; j < n; j++) {
        if (i === j || (erlaubt && !erlaubt(i, j))) continue;
        let d = 0; for (let q = 0; q < dim; q++) { const t = pos[i * dim + q] - pos[j * dim + q]; d += t * t; }
        if (best.length < k) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); }
        else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
      }
      for (const [, j] of best) { const key = i < j ? i * n + j : j * n + i; if (!seen.has(key)) { seen.add(key); kanten.push(i, j); } }
    }
    return kanten;
  }

  // Farben als "r,g,b" — aus der Software (ci.css) und der MAKE-CI.
  const F = { tuerkis: '88,217,205', orange: '255,159,67', grau: '110,122,125', teal: '124,142,146', gelb: '255,201,60', gruen: '61,226,139', granat: '209,58,85', smaragd: '34,181,119', rose: '255,126,182', lavendel: '143,134,255', agenten: '199,125,255', puls: '79,195,247' };

  // ── Hirnform: Fibonacci-Kugel mit Streuung, breiter als hoch, Furche, Windungen + Kern (3D) ──
  function hirn(N, z) {
    const nKern = Math.round(N * .14), nOber = N - nKern, P = new Float32Array(N * 3), seite = new Uint8Array(N), kern = new Uint8Array(N), GOLD = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nOber; i++) {
      const y0 = 1 - 2 * (i + .5) / nOber, r0 = Math.sqrt(1 - y0 * y0), phi = i * GOLD + (z() - .5) * .18;
      let x = r0 * Math.cos(phi), y = y0 + (z() - .5) * .04, zz = r0 * Math.sin(phi);
      const theta = Math.acos(clamp(y, -1, 1));
      let rad = 1 + .04 * Math.sin(7 * phi) * Math.sin(6 * theta) + .022 * Math.sin(11 * phi + 1.3) * Math.cos(4 * theta);
      if (Math.abs(x) < .11 && y > -.35) rad *= .9;
      x *= rad * 1.02; y *= rad * .84; zz *= rad * .92;
      if (y < -.55) y = -.55 - (y + .55) * .35;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = zz; seite[i] = x < 0 ? 0 : 1;
    }
    for (let i = nOber; i < N; i++) {
      const u = z() * 2 - 1, phi = z() * TAU, r0 = Math.sqrt(1 - u * u), rr = .18 + .3 * Math.cbrt(z());
      P[i * 3] = r0 * Math.cos(phi) * rr; P[i * 3 + 1] = u * rr * .8; P[i * 3 + 2] = r0 * Math.sin(phi) * rr; seite[i] = P[i * 3] < 0 ? 0 : 1; kern[i] = 1;
    }
    return { P, seite, kern };
  }

  // Punkte gleichmäßig entlang einer Polylinie (mit Querstreuung) — für M und Herz.
  function entlang(strich, u, quer) {
    const seg = []; let L = 0; for (let i = 1; i < strich.length; i++) { const l = Math.hypot(strich[i][0] - strich[i - 1][0], strich[i][1] - strich[i - 1][1]); seg.push(l); L += l; }
    let rest = u * L; for (let i = 1; i < strich.length; i++) { const l = seg[i - 1]; if (rest <= l || i === strich.length - 1) { const t = clamp(rest / l, 0, 1), tx = (strich[i][0] - strich[i - 1][0]) / l, ty = (strich[i][1] - strich[i - 1][1]) / l; return [strich[i - 1][0] + (strich[i][0] - strich[i - 1][0]) * t - ty * quer, strich[i - 1][1] + (strich[i][1] - strich[i - 1][1]) * t + tx * quer]; } rest -= l; }
    return strich[strich.length - 1];
  }

  // Jede Formation: bauen(N, z) → { pos: Float32Array(N*2), gruppe: Uint8Array, kanten: [i,j,…], farben: gruppe → Farbschlüssel, dreiD?, extra }
  const FORM = {};

  // Zwei sich überlappende Ringe: Privat (Türkis) links, Business (Orange) rechts.
  FORM.welten = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), ang = new Float32Array(N), rad = new Float32Array(N);
    for (let i = 0; i < N; i++) { gruppe[i] = i & 1; ang[i] = z() * TAU; rad[i] = z() < .78 ? 1 + z.gauss() * .045 : .25 + z() * .6; const mx = gruppe[i] ? .5 : -.5; pos[i * 2] = mx + Math.cos(ang[i]) * .72 * rad[i]; pos[i * 2 + 1] = Math.sin(ang[i]) * .66 * rad[i]; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['tuerkis', 'orange'], reichweite: .3, extra: { ang, rad } };
  };
  // Neun graue Haufen (die Apps).
  const HAUFEN = [[-.92, -.78], [.02, -.98], [.94, -.7], [-1, .04], [.04, .08], [1, .02], [-.86, .86], [.04, .98], [.9, .8]];
  FORM.chaos = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), hf = HAUFEN.map(([x, y]) => [x + (z() - .5) * .14, y + (z() - .5) * .14]);
    for (let i = 0; i < N; i++) { gruppe[i] = (i * 7) % 9; pos[i * 2] = hf[gruppe[i]][0] * 1.22 + z.gauss() * .15; pos[i * 2 + 1] = hf[gruppe[i]][1] * 1.12 + z.gauss() * .135; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: Array(9).fill('grau'), reichweite: .6, extra: { haufen: hf } };
  };
  // Ein Ring, der sich füllt (Anteil = Score der Sicht); Kern locker innen. gruppe 0 = Ring, 1 = Kern.
  const ringBau = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), ang = new Float32Array(N), nKern = Math.round(N * .14);
    const reihe = Array.from({ length: N }, (_, i) => i).sort(() => z() - .5);
    reihe.forEach((i, k) => { const a = k / N * TAU; ang[i] = a; const kern = i >= N - nKern; gruppe[i] = kern ? 1 : 0; const r = kern ? .2 + z() * .45 : 1 + z.gauss() * .03; pos[i * 2] = Math.cos(a - Math.PI / 2) * .8 * r; pos[i * 2 + 1] = Math.sin(a - Math.PI / 2) * .8 * r; });
    const ringIdx = Array.from({ length: N }, (_, i) => i).filter(i => !gruppe[i]).sort((a, b) => ang[a] - ang[b]); const kanten = [];
    for (let k = 0; k < ringIdx.length; k++) kanten.push(ringIdx[k], ringIdx[(k + 1) % ringIdx.length]);
    return { pos, gruppe, kanten, farben: ['sicht', 'sicht'], reichweite: .35, fuellen: true, extra: { ang } };
  };
  FORM.ring = ringBau; FORM.score = ringBau; FORM.index = ringBau;
  // Das Brain (3D, dreht sich): gruppe 0/1 = Hälften (Teal), 2 = Kern (Türkis); Synapsen über die Furche türkis.
  FORM.brain = (N, z) => {
    const { P, seite, kern } = hirn(N, z), gruppe = new Uint8Array(N); for (let i = 0; i < N; i++) gruppe[i] = kern[i] ? 2 : seite[i];
    return { pos: P, gruppe, kanten: nachbarn(P, 3, 2), farben: ['teal', 'teal', 'tuerkis'], reichweite: 1.05, dreiD: true, extra: { seite, kern } };
  };
  // Herz: Körper und Puls — Kurve außen (Grün = Gesundheit), Puls-Ring innen (Türkis).
  FORM.herz = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), nInnen = Math.round(N * .22);
    for (let i = 0; i < N; i++) {
      if (i < N - nInnen) { const t = (i + .5) / (N - nInnen) * TAU, q = z.gauss() * .03; const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pos[i * 2] = x / 17 * .92 + q; pos[i * 2 + 1] = -y / 17 * .92 + .08 + q; gruppe[i] = 0; }
      else { const a = z() * TAU, r = .22 + z() * .12; pos[i * 2] = Math.cos(a) * r; pos[i * 2 + 1] = Math.sin(a) * r * .9 + .02; gruppe[i] = 1; }
    }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['gruen', 'tuerkis'], reichweite: .28 };
  };
  // Familie: drei Kreise — Malin (Granat), Kevin (Smaragd), gemeinsam (Türkis) darunter, überlappend.
  FORM.familie = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), M = [[-.42, -.22], [.42, -.22], [0, .38]];
    for (let i = 0; i < N; i++) { const g = i % 3, a = z() * TAU, r = z() < .7 ? .52 + z.gauss() * .035 : z() * .45; gruppe[i] = g; pos[i * 2] = M[g][0] + Math.cos(a) * r; pos[i * 2 + 1] = M[g][1] + Math.sin(a) * r * .95; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['granat', 'smaragd', 'tuerkis'], reichweite: .3 };
  };
  // Trichter: fünf Stufen von Lead bis Abschluss — oben breit und grau, unten schmal und orange.
  FORM.trichter = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), anteile = [.36, .26, .18, .12, .08]; let k = 0;
    for (let s = 0; s < 5; s++) { const n = s === 4 ? N - k : Math.round(N * anteile[s]); const breite = 1 - s * .2, y = -.82 + s * .41; for (let j = 0; j < n && k < N; j++, k++) { pos[k * 2] = (z() * 2 - 1) * breite * .95; pos[k * 2 + 1] = y + z.gauss() * .07; gruppe[k] = s; } }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['grau', 'grau', 'teal', 'orange', 'orange'], reichweite: .26 };
  };
  // Netzwerk: sieben Firmen als Knotenwolken um ein Zentrum (du), mit Brücken.
  FORM.netzwerk = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), Z = [[0, 0]]; for (let f = 0; f < 7; f++) Z.push([Math.cos(f / 7 * TAU) * .78, Math.sin(f / 7 * TAU) * .72]);
    for (let i = 0; i < N; i++) { const g = i % 8; gruppe[i] = g; const r = (g === 0 ? .16 : .17) * Math.sqrt(z()); const a = z() * TAU; pos[i * 2] = Z[g][0] + Math.cos(a) * r; pos[i * 2 + 1] = Z[g][1] + Math.sin(a) * r; }
    const kanten = nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]);
    for (let f = 1; f < 8; f++) { const a = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === f), b = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === 0); for (let k = 0; k < 3; k++) kanten.push(a[k * 5 % a.length], b[(k * 7 + f) % b.length]); }
    return { pos, gruppe, kanten, farben: ['orange', 'teal', 'teal', 'teal', 'teal', 'teal', 'teal', 'teal'], reichweite: 1.2, bruecken: true };
  };
  // Stapel: Vorschläge als Zeilen — vier waagerechte Bänder, das zweite wartet (gelb).
  FORM.stapel = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const g = i % 4; gruppe[i] = g; pos[i * 2] = (z() * 2 - 1) * .86; pos[i * 2 + 1] = -.6 + g * .4 + z.gauss() * .045; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['teal', 'gelb', 'teal', 'teal'], reichweite: .2 };
  };
  // Team der Heads: fünf Kreise auf einem Ring (Sales, Marketing, Event, Finance, IT), ZOE in der Mitte.
  FORM.heads = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), nMitte = Math.round(N * .2), Z = []; for (let h = 0; h < 5; h++) Z.push([Math.cos(h / 5 * TAU - Math.PI / 2) * .7, Math.sin(h / 5 * TAU - Math.PI / 2) * .7]);
    for (let i = 0; i < N; i++) { if (i < nMitte) { const a = z() * TAU, r = .24 * Math.sqrt(z()); gruppe[i] = 5; pos[i * 2] = Math.cos(a) * r; pos[i * 2 + 1] = Math.sin(a) * r; } else { const g = i % 5; gruppe[i] = g; const a = z() * TAU, r = .19 * Math.sqrt(z()); pos[i * 2] = Z[g][0] + Math.cos(a) * r; pos[i * 2 + 1] = Z[g][1] + Math.sin(a) * r; } }
    const kanten = nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]);
    for (let h = 0; h < 5; h++) { const a = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === h), m = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === 5); for (let k = 0; k < 2; k++) kanten.push(a[k * 3 % a.length], m[(k * 11 + h * 3) % m.length]); }
    return { pos, gruppe, kanten, farben: ['agenten', 'agenten', 'agenten', 'agenten', 'agenten', 'tuerkis'], reichweite: 1.1, bruecken: true, extra: { zentren: Z } };
  };
  // Drei ruhige Cluster: Software · Begleitung (Türkis, größer) · Consulting.
  FORM.cluster3 = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), Z = [[-.7, .1], [0, -.08], [.7, .1]], R = [.22, .3, .22];
    for (let i = 0; i < N; i++) { const g = i % 5 === 1 || i % 5 === 3 ? 1 : (i % 5 < 2 ? 0 : 2); gruppe[i] = g; const a = z() * TAU, r = R[g] * Math.sqrt(z()); pos[i * 2] = Z[g][0] + Math.cos(a) * r; pos[i * 2 + 1] = Z[g][1] + Math.sin(a) * r; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j]), farben: ['teal', 'tuerkis', 'teal'], reichweite: .24 };
  };
  // Das M aus Logo F: linker Strich Granat (MA = Malin), rechter Smaragd (KE = Kevin), in der Fuge Türkis.
  FORM.m = (N, z) => {
    const pos = new Float32Array(N * 2), gruppe = new Uint8Array(N), S = [[[50, 176], [50, 72], [119, 141]], [[121, 141], [190, 72], [190, 176]]];
    for (let i = 0; i < N; i++) { const s = i % 2; gruppe[i] = s; const [px, py] = entlang(S[s], (Math.floor(i / 2) + .5) / (N / 2) + (z() - .5) * .02, z.gauss() * 7.5); pos[i * 2] = (px - 120) / 120 * .92; pos[i * 2 + 1] = (py - 124) / 120 * .92; if (Math.hypot(px - 120, py - 141) < 16) gruppe[i] = 2; }
    return { pos, gruppe, kanten: nachbarn(pos, 2, 2, (i, j) => gruppe[i] === gruppe[j] || (gruppe[i] === 2 || gruppe[j] === 2)), farben: ['granat', 'smaragd', 'tuerkis'], reichweite: .16 };
  };

  function bauen(name, N, saat) { const f = FORM[name] || FORM.brain; return Object.assign({ name }, f(N, zufallsquelle(saat || 27092026))); }

  wurzel.MakeFormationen = { FARBEN: F, FORM, bauen, nachbarn, zufallsquelle, hirn };
})(typeof globalThis !== 'undefined' ? globalThis : this);
