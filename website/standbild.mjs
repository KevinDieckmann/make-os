#!/usr/bin/env node
// ─── MAKE Innovation · Landingpage: Standbild der Neuronen-Bühne (03.10.2026) ─────────────────────────
// Ohne Skript oder Canvas steht auf der Bühne das Logo (SVG) — dahinter dieses Standbild: der ruhige Ring aus
// Neuronen (aus js/formationen.js, Formation „fokus“, nur der Ring), Rot und Grün im Wechsel. Gleiche Geometrie wie im
// Browser. Arbeitsdatei (wird nie ausgeliefert: Caddy versteckt *.mjs).
//   node website/standbild.mjs   → website/assets/buehne/standbild.svg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const hier = new URL('./', import.meta.url);
const kontext = {}; vm.createContext(kontext);
vm.runInContext(readFileSync(new URL('js/formationen.js', hier), 'utf8'), kontext);
const MF = kontext.MakeFormationen;
const hex = c => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');

const N = 380, fm = MF.bauen('fokus', N, 3102026 + 5 * 11), W = 600, H = 600, cx = 300, cy = 300, R = 270;
const ring = new Set(); for (let i = 0; i < N; i++) if (fm.farbe[i] === MF.GRAU) ring.add(i);
const X = i => cx + fm.pos[i * 2] * R, Y = i => cy + fm.pos[i * 2 + 1] * R;
const farbe = i => MF.FARBEN[fm.fam[i] === 2 ? MF.GRAU : fm.fam[i]];
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
s += '<g stroke-width="1" stroke-linecap="round">';
const K = fm.kanten, dm = R * .3;
for (let e = 0; e < K.length; e += 2) {
  const a = K[e], b = K[e + 1]; if (!ring.has(a) || !ring.has(b)) continue;
  const d = Math.hypot(X(a) - X(b), Y(a) - Y(b)); if (d > dm) continue;
  s += `<line x1="${X(a).toFixed(1)}" y1="${Y(a).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(b).toFixed(1)}" stroke="${hex(farbe(a))}" stroke-opacity="${(.4 * (1 - d / dm)).toFixed(2)}"/>`;
}
s += '</g><g>';
for (const i of ring) s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(i).toFixed(1)}" r="1.3" fill="${hex(farbe(i))}" fill-opacity=".8"/>`;
s += '</g></svg>\n';
mkdirSync(new URL('assets/buehne/', hier), { recursive: true });
writeFileSync(new URL('assets/buehne/standbild.svg', hier), s);
console.log(`✓ assets/buehne/standbild.svg (${(s.length / 1024).toFixed(1)} KB)`);
