#!/usr/bin/env node
// ─── MAKE Innovation · Landingpage v5: Standbilder der Szene (04.10.2026) ─────────────────────────────
// Ohne WebGL, ohne Skript oder bei „Bewegung reduzieren“ steht in jedem Kapitel ein gestaltetes Standbild — gerechnet aus
// DERSELBEN Geometrie wie die Szene im Browser (js/szene/kern.js + formationen.js nach js/drehbuch.js), mit derselben
// Kamera, nur ruhig: Netz, Lichtfäden, Linien und Teilchen der Formation als SVG (Punkte = runde Striche, gruppiert nach
// Farbe und Helligkeit; dazu ein weicher Schein über eine Filter-Kopie der hellen Teile). Ohne Stil-Attribute (CSP).
// Arbeitsdatei (wird nie ausgeliefert: Caddy versteckt *.mjs).
//   node website/standbild.mjs   → website/assets/szene/<zustand>.svg (je Zustand des Drehbuchs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const hier = new URL('./', import.meta.url);
const kontext = {}; vm.createContext(kontext);
for (const d of ['js/szene/kern.js', 'js/szene/formationen.js', 'js/drehbuch.js']) vm.runInContext(readFileSync(new URL(d, hier), 'utf8'), kontext);
const S = kontext.MakeSzene, K = S.kern, FM = S.formationen;
const wortmarke = readFileSync(new URL('assets/logo/wortmarke.svg', hier), 'utf8');
const logo = FM.logoAusSvg(wortmarke);
const welt = FM.bauen(S.drehbuch, { handy: false, logo, anzahl: 2600 });
const Z = welt.Z, W = 800, H = 800;
const hex = c => '#' + c.map(v => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0')).join('');
const FARBEN = FM.PALETTE.map(hex);
const r1 = n => Math.round(n * 10) / 10;
/** Beschriftungen je Zustand (wie die Marken in index.html). */
const MARKEN = { umsetzung: ['Analyse', 'Aufbau', 'Skalierung'], fokus: (S.formationen.STAEDTE).map(s => s.name), wirkung: ['Umsetzung', 'Sichtbarkeit', 'Netzwerk'] };

mkdirSync(new URL('assets/szene/', hier), { recursive: true });
let summe = 0;
Z.forEach((zst, k) => {
  const kam = K.kamera(Z, k, 0, 0, W / H, { mittig: true });
  const M = K.mal(K.perspektive(kam.fov, W / H, .1, 600, 0, 0), K.blick(kam.auge, kam.ziel, kam.oben));
  const px = H / 2 / Math.tan(kam.fov / 2) * .075, nebel = [kam.D * .9 + 6, kam.D + 80];
  const sicht = d => 1 - K.sanft((d - nebel[0]) / (nebel[1] - nebel[0]));
  const proj = p => { const q = K.projiziere(M, p); return q[2] > .5 && Math.abs(q[0]) < 1.15 && Math.abs(q[1]) < 1.15 ? [(q[0] * .5 + .5) * W, (.5 - q[1] * .5) * H, q[2]] : null; };
  const punkte = new Map(), linien = new Map(), schein = [];
  const stufe = a => Math.max(1, Math.min(8, Math.round(a * 8)));
  function punkt(p, w, groesse) {
    const q = proj(p); if (!q) return;
    const d = K.len(K.sub(p, kam.auge)), a = (w % 1) * sicht(d) * K.sanft((d - .6) / 2.9); if (a < .04) return;
    const r = Math.min(9, Math.max(.6, px * groesse / d * .55)), key = `${Math.floor(w)}|${stufe(a)}|${r1(Math.max(.6, Math.round(r * 2) / 2))}`;
    (punkte.get(key) || punkte.set(key, []).get(key)).push(`M${r1(q[0])} ${r1(q[1])}h0`);
    if (a > .55 && r > 1.2) schein.push([q, Math.floor(w), r]);
  }
  function linie(a, b, w, grund) {
    const qa = proj(a), qb = proj(b); if (!qa || !qb) return;
    const d = K.len(K.sub(a, kam.auge)), al = (w % 1) * grund * sicht(d) * K.sanft((d - .8) / 3.2); if (al < .03) return;
    const key = `${Math.floor(w)}|${stufe(al)}`, liste = linien.get(key) || linien.set(key, { d: [], ende: '' }).get(key);
    const start = `${r1(qa[0])} ${r1(qa[1])}`;
    liste.d.push(liste.ende === start ? `L${r1(qb[0])} ${r1(qb[1])}` : `M${start}L${r1(qb[0])} ${r1(qb[1])}`);
    liste.ende = `${r1(qb[0])} ${r1(qb[1])}`;
  }
  // Netz (Kanten, Knoten)
  const kn = welt.netz.kanten;
  for (let i = 0; i < kn.length; i += 12) linie([kn[i], kn[i + 1], kn[i + 2]], [kn[i + 6], kn[i + 7], kn[i + 8]], kn[i + 4], .3);
  const np = welt.netz.punkte, ns = welt.netz.saat;
  for (let i = 0; i < np.length / 4; i++) punkt([np[i * 4], np[i * 4 + 1], np[i * 4 + 2]], np[i * 4 + 3], ns[i * 4 + 2]);
  // Lichtfäden des Pfads (Zeit 0), wie im Shader — vor der Kamera bis 110 Einheiten.
  const sKam = zst.s - kam.D, nah = zst.nah * kam.D;
  for (let f = 0; f < 18; f++) {
    const saat = (f * .618) % 1, strang = f % 9 === 8 ? 2 : f % 2;
    let vor = null;
    for (let s = sKam; s < sKam + 120; s += .8) {
      const r = K.rahmen(s), o = K.faden(s, saat, strang, 0, welt.ziele), p = K.lokal(r, o[0], o[1], 0);
      const d = K.len(K.sub(p, kam.auge)), w = (strang === 2 ? 0 : strang + 1) + Math.min(.99, .55 * zst.faeden * o[2] * K.sanft((d - nah * .7 - 1.5) / 5.5));
      if (vor) linie(vor, p, w, 1);
      vor = p;
    }
  }
  // Formation: Linien (ganz aufgebaut), Teilchen
  const F = welt.formationen[k];
  if (F.linien) for (let i = 0; i < F.linien.length; i += 12) linie([F.linien[i], F.linien[i + 1], F.linien[i + 2]], [F.linien[i + 6], F.linien[i + 7], F.linien[i + 8]], F.linien[i + 4], .75);
  for (let i = 0; i < welt.N; i++) punkt([F.punkte[i * 4], F.punkte[i * 4 + 1], F.punkte[i * 4 + 2]], F.punkte[i * 4 + 3], welt.saat[i * 4 + 2]);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += '<defs><filter id="schein" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>';
  svg += '<g fill="none" stroke-width=".8">';
  for (const [key, l] of linien) { const [f, a] = key.split('|').map(Number); svg += `<path d="${l.d.join('')}" stroke="${FARBEN[f]}" stroke-opacity="${(a / 8).toFixed(2)}"/>`; }
  svg += '</g><g filter="url(#schein)" stroke-linecap="round" fill="none">';
  for (const [q, f, r] of schein.slice(0, 400)) svg += `<path d="M${r1(q[0])} ${r1(q[1])}h0" stroke="${FARBEN[f]}" stroke-opacity=".5" stroke-width="${r1(r * 4)}"/>`;
  svg += '</g><g stroke-linecap="round" fill="none">';
  for (const [key, d] of punkte) { const [f, a, r] = key.split('|').map(Number); svg += `<path d="${d.join('')}" stroke="${FARBEN[f]}" stroke-opacity="${(a / 8).toFixed(2)}" stroke-width="${r1(r * 2)}"/>`; }
  svg += '</g>';
  // Beschriftungen (Städte, Phasen, Ströme) und das Logo am Ende.
  const namen = MARKEN[zst.name];
  if (namen) F.marken.forEach((p, i) => {
    const q = proj(p); if (!q || !namen[i]) return;
    const stadt = zst.name === 'fokus';
    svg += `<text x="${r1(q[0] + (stadt ? 8 : 0))}" y="${r1(q[1] + (stadt ? 4 : -6))}" fill="#EEF1F0" fill-opacity=".85" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" letter-spacing="1.6"${stadt ? '' : ' text-anchor="middle"'}>${namen[i].toUpperCase()}</text>`;
  });
  if (zst.formation === 'zeichen' && F.marken.length === 2) {
    const a = proj(F.marken[0]), c = proj(F.marken[1]);
    if (a && c) {
      const innen = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(wortmarke)[1], sk = (c[0] - a[0]) / logo.breite;
      svg += `<g transform="translate(${r1(a[0])} ${r1(a[1])}) scale(${sk.toFixed(4)})">${innen}</g>`;
    }
  }
  svg += '</svg>\n';
  writeFileSync(new URL(`assets/szene/${zst.name}.svg`, hier), svg);
  summe += svg.length;
  console.log(`✓ assets/szene/${zst.name}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
});
console.log(`  zusammen ${(summe / 1024).toFixed(0)} KB (werden nur ohne Szene geladen)`);
