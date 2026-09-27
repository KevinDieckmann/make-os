// ─── Standbilder der Neuronen-Bühne (27.09., siebter Durchgang) ───────────────────
// Erzeugt aus js/formationen.js (dieselbe Geometrie wie im Browser) je Seite ein SVG,
// das ohne JavaScript, ohne Canvas oder bei prefers-reduced-motion unter dem Canvas
// steht: assets/standbild-<formation>.svg. Aufruf: node homepage/standbild.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const hier = new URL('./', import.meta.url);
const kontext = {}; vm.createContext(kontext);
vm.runInContext(readFileSync(new URL('js/formationen.js', hier), 'utf8'), kontext);
const MF = kontext.MakeFormationen, F = MF.FARBEN;
const hex = rgb => '#' + rgb.split(',').map(n => (+n).toString(16).padStart(2, '0')).join('');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const SICHT = { privat: F.tuerkis };
const farbe = k => k === 'sicht' ? SICHT.privat : F[k] || F.teal;

function bild(name, beschriftung) {
  const N = 350, fm = MF.bauen(name, N, 27092026), W = 600, H = 600, cx = 300, cy = 300, R = 240;
  const X = new Float32Array(N), Y = new Float32Array(N), SC = new Float32Array(N).fill(.8);
  if (fm.dreiD) { const w = -.35, cA = Math.cos(w), sA = Math.sin(w); for (let i = 0; i < N; i++) { const px = fm.pos[i * 3], py = fm.pos[i * 3 + 1], pz = fm.pos[i * 3 + 2], x1 = px * cA + pz * sA, z1 = -px * sA + pz * cA, persp = 1 / (1 + z1 * .28); X[i] = cx + x1 * R * persp; Y[i] = cy + py * R * persp; SC[i] = clamp(.35 + .65 * (1 - (z1 + 1) / 2), .2, 1); } }
  else for (let i = 0; i < N; i++) { X[i] = cx + fm.pos[i * 2] * R; Y[i] = cy + fm.pos[i * 2 + 1] * R; }
  const schein = fm.dreiD ? F.tuerkis : fm.fuellen ? SICHT.privat : farbe(fm.farben[fm.farben.length - 1]);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${beschriftung}">`;
  if (fm.name !== 'chaos' && fm.name !== 'trichter') s += `<defs><radialGradient id="k" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${hex(schein)}" stop-opacity=".22"/><stop offset=".5" stop-color="${hex(schein)}" stop-opacity=".06"/><stop offset="1" stop-color="${hex(schein)}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${R * .9}" fill="url(#k)"/>`;
  s += '<g stroke-width="1" stroke-linecap="round">';
  const dm = R * fm.reichweite, l0 = dm * .5, K = fm.kanten;
  for (let e = 0; e < K.length; e += 2) {
    const a = K[e], b = K[e + 1], d = Math.hypot(X[a] - X[b], Y[a] - Y[b]); if (d > dm) continue;
    let col = farbe(fm.farben[fm.gruppe[a]]), al = .36 * (1 - clamp((d - l0) / (dm - l0), 0, 1));
    if (fm.dreiD) { const quer = fm.gruppe[a] !== fm.gruppe[b] || fm.gruppe[a] === 2; col = quer ? F.tuerkis : F.teal; al *= Math.min(SC[a], SC[b]) * (quer ? 1.1 : .8); }
    else if (fm.fuellen) { const voll = fm.extra.ang[a] < Math.PI * 2 * .78 && fm.extra.ang[b] < Math.PI * 2 * .78; col = voll ? SICHT.privat : F.grau; al = voll ? .7 : .3; }
    else if (fm.bruecken && fm.gruppe[a] !== fm.gruppe[b]) { col = F.tuerkis; al = .22; }
    if (al < .02) continue;
    s += `<line x1="${X[a].toFixed(1)}" y1="${Y[a].toFixed(1)}" x2="${X[b].toFixed(1)}" y2="${Y[b].toFixed(1)}" stroke="${hex(col)}" stroke-opacity="${al.toFixed(2)}"/>`;
  }
  s += '</g><g>';
  for (let i = 0; i < N; i++) {
    let col = farbe(fm.farben[fm.gruppe[i]]), al = .75, r = 1.4;
    if (fm.dreiD) { const kern = fm.gruppe[i] === 2; col = kern ? F.tuerkis : F.teal; al = (.32 + .68 * SC[i]) * (kern ? .9 : .7); r = kern ? 1.9 : 1.25 + 1.4 * SC[i]; }
    else if (fm.fuellen) { const voll = fm.extra.ang[i] < Math.PI * 2 * .78; col = fm.gruppe[i] === 1 || voll ? SICHT.privat : F.grau; al = voll ? .95 : .35; r = voll ? 1.7 : 1.2; }
    s += `<circle cx="${X[i].toFixed(1)}" cy="${Y[i].toFixed(1)}" r="${r.toFixed(1)}" fill="${hex(col)}" fill-opacity="${al.toFixed(2)}"/>`;
  }
  s += '</g></svg>';
  writeFileSync(new URL(`assets/standbild-${name}.svg`, hier), s);
  return (s.length / 1024).toFixed(0);
}
const BILDER = [['brain', 'MAKE OS — ZOE, das Brain im Hintergrund'], ['herz', 'MAKE OS — der Körper, das Herz'], ['trichter', 'MAKE OS — die Pipeline'], ['cluster3', 'MAKE OS — drei Wege'], ['m', 'MAKE OS — Granat und Smaragd formen das M']];
console.log('✓ Standbilder: ' + BILDER.map(([n, b]) => `${n} (${bild(n, b)} KB)`).join(' · '));
