#!/usr/bin/env node
// ─── MAKE Innovation · Logo-Bau (01.10.2026) ────────────────────────────────────────────────────────
// Eine Quelle für das Logo der Landingpage: Bildmarke, Wortmarke „MAKE“, Zusatz „INNOVATION“ — alles als
// Linien auf einem Raster gebaut (keine Schrift im SVG, damit es überall gleich aussieht und keine
// Schriftdatei nachgeladen werden muss). Schreibt:
//   website/assets/logo/*.svg + favicon-32.png, apple-touch-icon.png, icon-512.png
//   website/favicon.svg                    (= Kachel)
//   website/logo-entwuerfe.html            (drei Entwürfe zur Auswahl — wird nie ausgeliefert)
// Konstruktion, Farben, Schutzzone, Mindestgröße: website/assets/logo/LOGO.md.
//
//   node scripts/website-logo.mjs          (braucht `sharp` aus node_modules für die PNGs)
//
// Die Bühne der Startseite trägt die Bildmarke inline (für die Zeichen-Animation). tests/website-landingpage.test.ts
// prüft, dass deren Pfade mit assets/logo/bildmarke.svg übereinstimmen — nach einer Änderung hier also auch
// den Block in website/index.html aus `node scripts/website-logo.mjs --buehne` übernehmen.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEITE = join(WURZEL, 'website');
const LOGO = join(SEITE, 'assets', 'logo');

// ── Farben (CI wie website/css/seite.css und lib/make-one/design.ts) ──
export const FARBEN = {
  dunkel: { grund: '#0B0E10', ink: '#E8ECEA', zusatz: '#A2ADB0', ma: '#D13A55', ke: '#22B577', funke: '#58D9CD' },
  hell: { grund: '#FFFFFF', ink: '#0B0E10', zusatz: '#4F5A5D', ma: '#B12E46', ke: '#1A8F5E', funke: '#168C82' },
};

// ── Raster ──
// Bildmarke im Feld 240 × 240, Modul 24 = Strichstärke. Stämme bei x 48 / 192, oben y 64, unten y 184,
// Diagonalen exakt 45° bis zur Fuge (120 | 136). Sichtbare Fläche 168 × 144 (x 36–204, y 52–196): um 4 nach
// unten gesetzt, weil das M oben schwerer ist (optische Mitte statt geometrischer).
const S = 24;
const MARKE_BOX = { x: 36, y: 52, b: 168, h: 144 };

/** Entwürfe. A ist auf der Seite im Einsatz. */
export const ENTWUERFE = {
  A: { name: 'Fuge', kappe: 'round', fuge: 'naht', text: 'Weiterentwicklung von Logo F: runde Enden, Diagonalen exakt 45°, die beiden Hälften treffen sich in der Fuge — die Naht liegt genau auf der Mittelachse. Ruhig, freundlich, in 16 px noch lesbar.' },
  B: { name: 'Funke', kappe: 'round', fuge: 'spalt', text: 'Gleiche Geometrie, aber die Hälften berühren sich nicht: zwischen MA und KE bleibt ein Spalt, darunter der türkise Funke — das, was zwischen beiden entsteht. Erzählt mehr, ist kleiner aber unruhiger.' },
  C: { name: 'Kante', kappe: 'butt', fuge: 'naht', text: 'Gerade Enden, gefaste Ecken, Wortmarke oben und unten bündig beschnitten. Sachlicher, technischer — die Fuge läuft unten spitz aus.' },
};

const r = n => Math.round(n * 100) / 100;
const pfad = pts => 'M' + pts.map(([x, y], i) => `${i ? 'L' : ''}${r(x)} ${r(y)}`).join('');

/** Linien-Attribute je Entwurf. */
function linie(e, s, farbe) {
  const rund = ENTWUERFE[e].kappe === 'round';
  return `fill="none" stroke="${farbe}" stroke-width="${s}" stroke-linecap="${rund ? 'round' : 'butt'}" stroke-linejoin="${rund ? 'round' : 'bevel'}"`;
}

// ── Bildmarke ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Die zwei Züge der Bildmarke (Koordinaten im 240er-Feld). Beide beginnen am Fuß ihres Stamms und laufen zur
 * Fuge — so zeichnet die Bühne sie von außen nach innen. `clip` = halbe Fläche, damit die Naht exakt auf x 120 liegt.
 */
export function zuege(e) {
  const f = ENTWUERFE[e].fuge;
  if (f === 'spalt') {
    // Enden 16 Einheiten (diagonal) vor der Fuge: zwischen den runden Enden bleibt ein Spalt von 8.
    return { ma: [[48, 184], [48, 64], [104, 120]], ke: [[192, 184], [192, 64], [136, 120]], clip: false, funke: { cx: 120, cy: 147, r: 10 } };
  }
  // Naht: rund endet genau in der Fuge (die runde Kappe wird halbiert), gerade läuft 12 darüber hinaus (spitzer Fuß).
  const ueber = ENTWUERFE[e].kappe === 'round' ? 0 : 12;
  // Gerade Enden stehen bis 196 (Unterkante der runden Fassung), damit alle Entwürfe dieselbe Fläche füllen.
  const fuss = ENTWUERFE[e].kappe === 'round' ? 184 : 196;
  return { ma: [[48, fuss], [48, 64], [120 + ueber, 136 + ueber]], ke: [[192, fuss], [192, 64], [120 - ueber, 136 + ueber]], clip: true };
}

/** Bildmarke als SVG-Innenleben im 240er-Feld. `id` macht die Clip-Kennungen je Einsatz eindeutig. */
export function bildmarkeInnen(e, farben, id, { klassen = false } = {}) {
  const z = zuege(e);
  const k = n => (klassen ? ` class="zug zug-${n}" pathLength="1"` : '');
  const defs = z.clip
    ? `<defs><clipPath id="${id}-ma"><rect width="120" height="240"/></clipPath><clipPath id="${id}-ke"><rect x="120" width="120" height="240"/></clipPath></defs>`
    : '';
  const cma = z.clip ? ` clip-path="url(#${id}-ma)"` : '';
  const cke = z.clip ? ` clip-path="url(#${id}-ke)"` : '';
  const funke = z.funke ? `<circle${klassen ? ' class="funke-punkt"' : ''} cx="${z.funke.cx}" cy="${z.funke.cy}" r="${z.funke.r}" fill="${farben.funke}"/>` : '';
  return `${defs}<path${k('ma')}${cma} d="${pfad(z.ma)}" ${linie(e, S, farben.ma)}/><path${k('ke')}${cke} d="${pfad(z.ke)}" ${linie(e, S, farben.ke)}/>${funke}`;
}

// ── Wortmarke „MAKE“ ──────────────────────────────────────────────────────────────────────────────────
// Versalhöhe 72, Strich 12 (= halbe Bildmarke). Mittellinien von y 6 bis 66, Außenkante 0–72.
// M wie die Bildmarke: V-Tiefe 60 % der Stammhöhe, 45°. A mit Querstrich auf 7/10, E-Mittelstrich leicht über
// der Mitte (35 statt 36) und kürzer als die Außenstriche — optische Korrekturen.
const WORT = { s: 12, h: 72, breite: 332 };
const BUCHSTABEN = {
  M: { b: 72, z: [[[0, 66], [0, 6], [36, 42], [72, 6], [72, 66]]] },
  A: { b: 64, z: [[[0, 66], [32, 6], [64, 66]], [[10, 48], [54, 48]]] },
  K: { b: 52, z: [[[0, 6], [0, 66]], [[50, 6], [0, 46]], [[16, 33.2], [52, 66]]] },
  E: { b: 46, z: [[[46, 6], [0, 6], [0, 66], [46, 66]], [[0, 35], [40, 35]]] },
};
/** x der Mittellinie je Buchstabe (Abstände der Außenkanten: M–A 16, A–K 18, K–E 16). */
const WORT_X = { M: 6, A: 106, K: 200, E: 280 };
/** Die zwei Personenstriche unter der Wortmarke: MA in Rot, KE in Grün (wie die Bildmarke). */
const BALKEN = { ma: [0, 176], ke: [194, 332], dicke: 4 };

/** Gerade Enden laufen auf Grund- und Versallinie über und werden bündig beschnitten. */
function verlaengern(z, e, s, h) {
  if (ENTWUERFE[e].kappe === 'round') return z;
  // Nur Enden, die auf Grund- oder Versallinie stehen und nicht waagrecht laufen: entlang ihrer Richtung verlängern.
  const raus = (p, q) => {
    const [x, y] = p; const [qx, qy] = q; const dy = y - qy;
    const anLinie = y <= s / 2 + 0.01 || y >= h - s / 2 - 0.01;
    if (!anLinie || Math.abs(dy) < 0.01) return p;
    const f = s / Math.abs(dy);
    return [x + (x - qx) * f, y + dy * f];
  };
  return z.map(p => p.map((pt, i) => (i === 0 ? raus(pt, p[1]) : i === p.length - 1 ? raus(pt, p[i - 1]) : pt)));
}

function wortmarkeInnen(e, farben, id) {
  const { s, h } = WORT;
  const rund = ENTWUERFE[e].kappe === 'round';
  const teile = Object.entries(BUCHSTABEN).map(([bst, { z }]) =>
    verlaengern(z, e, s, h).map(p => pfad(p.map(([x, y]) => [x + WORT_X[bst], y]))).join(''));
  const clip = rund ? '' : ` clip-path="url(#${id}-wort)"`;
  const defs = rund ? '' : `<defs><clipPath id="${id}-wort"><rect width="${WORT.breite}" height="${h}"/></clipPath></defs>`;
  return `${defs}<path${clip} d="${teile.join('')}" ${linie(e, s, farben.ink)}/>`;
}

function balkenInnen(farben, y, e) {
  const rx = ENTWUERFE[e].kappe === 'round' ? BALKEN.dicke / 2 : 0;
  const [a, b] = BALKEN.ma; const [c, d] = BALKEN.ke;
  return `<rect x="${a}" y="${y}" width="${b - a}" height="${BALKEN.dicke}" rx="${rx}" fill="${farben.ma}"/><rect x="${c}" y="${y}" width="${d - c}" height="${BALKEN.dicke}" rx="${rx}" fill="${farben.ke}"/>`;
}

// ── Zusatz „INNOVATION“ ───────────────────────────────────────────────────────────────────────────────
// Versalhöhe 20, Strich 4 (Grundmaß; skaliert mit k). O mit 0,5 Überhang (Rundes wirkt sonst kleiner).
const ZUSATZ = {
  I: { b: 0, z: [[[0, 2], [0, 18]]] },
  N: { b: 14, z: [[[0, 18], [0, 2], [14, 18], [14, 2]]] },
  O: { b: 16, kreis: { cx: 8, cy: 10, r: 8.5 } },
  V: { b: 16, z: [[[0, 2], [8, 18], [16, 2]]] },
  A: { b: 16, z: [[[0, 18], [8, 2], [16, 18]], [[3, 13], [13, 13]]] },
  T: { b: 14, z: [[[0, 2], [14, 2]], [[7, 2], [7, 18]]] },
};
const ZUSATZ_WORT = 'INNOVATION';

/** Breite des Zusatzes bei Sperrung `sperr` (Abstand der Außenkanten) und Faktor k. */
function zusatzBreite(k, sperr) {
  const s = 4 * k;
  return ZUSATZ_WORT.split('').reduce((summe, b) => summe + ZUSATZ[b].b * k + s, 0) + sperr * (ZUSATZ_WORT.length - 1);
}

/** Zusatz bei Faktor k; mit `breite` auf genau diese Breite ausgeglichen (Blocksatz unter der Wortmarke). */
function zusatzInnen(e, farben, id, k, { breite, sperr = 9 } = {}) {
  const s = 4 * k; const h = 20 * k;
  const ohneSperr = zusatzBreite(k, 0);
  const abstand = breite ? (breite - ohneSperr) / (ZUSATZ_WORT.length - 1) : sperr;
  let x = s / 2; const pfade = []; const kreise = [];
  for (const b of ZUSATZ_WORT) {
    const g = ZUSATZ[b];
    if (g.kreis) kreise.push(`<circle cx="${r(x + g.kreis.cx * k)}" cy="${r(g.kreis.cy * k)}" r="${r(g.kreis.r * k)}" fill="none" stroke="${farben.zusatz}" stroke-width="${r(s)}"/>`);
    else pfade.push(verlaengern(g.z.map(p => p.map(([px, py]) => [px * k, py * k])), e, s, h).map(p => pfad(p.map(([px, py]) => [px + x, py]))).join(''));
    x += g.b * k + s + abstand;
  }
  const rund = ENTWUERFE[e].kappe === 'round';
  const clip = rund ? '' : ` clip-path="url(#${id}-zusatz)"`;
  const defs = rund ? '' : `<defs><clipPath id="${id}-zusatz"><rect x="-2" width="${r(x)}" height="${r(h)}"/></clipPath></defs>`;
  return { innen: `${defs}<path${clip} d="${pfade.join('')}" ${linie(e, r(s), farben.zusatz)}/>${kreise.join('')}`, breite: r(x - abstand), hoehe: h };
}

// ── Anordnungen ───────────────────────────────────────────────────────────────────────────────────────
const svg = (b, h, innen, titel, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(b)} ${r(h)}" width="${r(b)}" height="${r(h)}" role="img" aria-label="${titel}"${extra}>${innen}</svg>`;

/** Bildmarke allein, sichtbare Fläche ohne Rand (168 × 144). */
export function bildmarke(e, ton, id = `bm${e}${ton}`) {
  const f = FARBEN[ton];
  return svg(MARKE_BOX.b, MARKE_BOX.h, `<g transform="translate(${-MARKE_BOX.x} ${-MARKE_BOX.y})">${bildmarkeInnen(e, f, id)}</g>`, 'MAKE');
}

/** App-Kachel / Favicon: Bildmarke auf dunklem, abgerundetem Quadrat (Schutzzone eingebaut). */
export function kachel(e, { rund = true, id = `ka${e}` } = {}) {
  const f = FARBEN.dunkel;
  const grund = rund ? `<rect width="240" height="240" rx="52" fill="${f.grund}"/>` : `<rect width="240" height="240" fill="${f.grund}"/>`;
  // Mitte der sichtbaren Bildmarke (120 | 124) auf die Kachelmitte, 82 %.
  return svg(240, 240, `${grund}<g transform="translate(120 120) scale(.82) translate(-120 -124)">${bildmarkeInnen(e, f, id)}</g>`, 'MAKE Innovation');
}

/** Quer (Kopf): Bildmarke · MAKE mit Personenstrichen · INNOVATION auf derselben Grundlinie. */
export function quer(e, ton, { kompakt = false, id = `qu${e}${ton}${kompakt ? 'k' : ''}` } = {}) {
  const f = FARBEN[ton];
  const textX = MARKE_BOX.b + 40;
  const wortY = 28; // MAKE + Abstand 12 + Strich 4 = 88, mittig zu 144
  const marke = `<g transform="translate(${-MARKE_BOX.x} ${-MARKE_BOX.y})">${bildmarkeInnen(e, f, id)}</g>`;
  const wort = `<g transform="translate(${textX} ${wortY})">${wortmarkeInnen(e, f, id)}${balkenInnen(f, WORT.h + 12, e)}</g>`;
  if (kompakt) return svg(textX + WORT.breite, MARKE_BOX.h, marke + wort, 'MAKE Innovation');
  const z = zusatzInnen(e, f, id, 1.5, { sperr: 9 });
  const zx = textX + WORT.breite + 28;
  const zusatz = `<g transform="translate(${zx} ${wortY + WORT.h - z.hoehe})">${z.innen}</g>`;
  return svg(zx + z.breite, MARKE_BOX.h, marke + wort + zusatz, 'MAKE Innovation');
}

/** Groß (Bühne, Titelseiten): Bildmarke über Wortmarke, INNOVATION im Blocksatz darunter. */
export function gross(e, ton, id = `gr${e}${ton}`) {
  const f = FARBEN[ton];
  const b = WORT.breite;
  const markeX = (b - MARKE_BOX.b) / 2;
  const wortY = MARKE_BOX.h + 40;
  const z = zusatzInnen(e, f, id, 1, { breite: b });
  const zy = wortY + WORT.h + 12 + BALKEN.dicke + 12;
  return svg(b, zy + z.hoehe,
    `<g transform="translate(${markeX - MARKE_BOX.x} ${-MARKE_BOX.y})">${bildmarkeInnen(e, f, id)}</g>` +
    `<g transform="translate(0 ${wortY})">${wortmarkeInnen(e, f, id)}${balkenInnen(f, WORT.h + 12, e)}</g>` +
    `<g transform="translate(0 ${zy})">${z.innen}</g>`, 'MAKE Innovation');
}

/** Inline-Fassung für die Bühne (Klassen für die Zeichen-Animation, kein role/aria — dekorativ). */
export function buehne(e = 'A') {
  const f = FARBEN.dunkel;
  return `<svg class="zeichen" viewBox="${MARKE_BOX.x - 24} ${MARKE_BOX.y - 24} ${MARKE_BOX.b + 48} ${MARKE_BOX.h + 48}" aria-hidden="true" focusable="false">${bildmarkeInnen(e, f, 'buehne', { klassen: true })}<circle class="funke" cx="120" cy="136" r="12" fill="${f.funke}"/></svg>`;
}

// ── Schreiben ─────────────────────────────────────────────────────────────────────────────────────────
const KOPF = '<?xml version="1.0" encoding="UTF-8"?>\n';

function entwuerfeSeite() {
  const zeile = (titel, inhalt) => `<div class="ent-zeile"><span class="mikro">${titel}</span><div class="ent-flaeche">${inhalt}</div></div>`;
  const karten = Object.entries(ENTWUERFE).map(([e, d]) => `
  <section class="ent" id="entwurf-${e.toLowerCase()}" aria-labelledby="ent-${e}">
    <div class="ent-kopf">
      <h2 id="ent-${e}">Entwurf ${e} · ${d.name}</h2>${e === 'A' ? '\n      <span class="abzeichen aktiv">Auf der Seite im Einsatz</span>' : ''}
    </div>
    <p class="ent-text">${d.text}</p>
    ${zeile('Bildmarke · dunkel und hell', `<div class="ent-dunkel ent-gross">${bildmarke(e, 'dunkel', `e${e}1`)}</div><div class="ent-hell ent-gross">${bildmarke(e, 'hell', `e${e}2`)}</div>`)}
    ${zeile('Favicon · 64 / 32 / 16 px', `<div class="ent-dunkel ent-icons"><span class="i64">${kachel(e, { id: `e${e}3` })}</span><span class="i32">${kachel(e, { id: `e${e}4` })}</span><span class="i16">${kachel(e, { id: `e${e}5` })}</span></div>`)}
    ${zeile('Quer (Kopf) · dunkel und hell', `<div class="ent-dunkel ent-quer">${quer(e, 'dunkel', { id: `e${e}6` })}</div><div class="ent-hell ent-quer">${quer(e, 'hell', { id: `e${e}7` })}</div>`)}
    ${zeile('Groß (Bühne)', `<div class="ent-dunkel ent-gestapelt">${gross(e, 'dunkel', `e${e}8`)}</div><div class="ent-hell ent-gestapelt">${gross(e, 'hell', `e${e}9`)}</div>`)}
  </section>`).join('\n');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logo-Entwürfe — MAKE Innovation GmbH</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0B0E10">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/seite.css">
</head>
<body>
<!-- Erzeugt von scripts/website-logo.mjs — nicht von Hand ändern. Wird nie ausgeliefert (Caddy: @intern). -->
<main id="inhalt" class="recht entwuerfe">
  <div class="wrap">
    <span class="mikro">Arbeitsdatei · nur lokal</span>
    <h1>MAKE-Logo: drei Entwürfe</h1>
    <p>Alle drei auf demselben Raster: Bildmarke im Feld 240, Strich 24, Diagonalen 45°, Wortmarke mit halber Strichstärke (12), Zusatz mit einem Sechstel (4). MA in Rot, KE in Grün — wie in der Software. Konstruktion, Schutzzone und Mindestgrößen: <code>assets/logo/LOGO.md</code>. Auswahl an Claude/Kevin melden; die Seite nutzt heute Entwurf A.</p>
${karten}
  </div>
</main>
</body>
</html>
`;
}

async function schreiben() {
  mkdirSync(LOGO, { recursive: true });
  const e = 'A';
  const dateien = {
    'bildmarke.svg': bildmarke(e, 'dunkel'),
    'bildmarke-hell.svg': bildmarke(e, 'hell'),
    'kachel.svg': kachel(e),
    'quer.svg': quer(e, 'dunkel'),
    'quer-hell.svg': quer(e, 'hell'),
    'kompakt.svg': quer(e, 'dunkel', { kompakt: true }),
    'kompakt-hell.svg': quer(e, 'hell', { kompakt: true }),
    'gross.svg': gross(e, 'dunkel'),
    'gross-hell.svg': gross(e, 'hell'),
  };
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(LOGO, name), KOPF + inhalt + '\n');
  writeFileSync(join(SEITE, 'favicon.svg'), KOPF + kachel(e) + '\n');
  writeFileSync(join(SEITE, 'logo-entwuerfe.html'), entwuerfeSeite());

  const { default: sharp } = await import('sharp');
  const png = async (inhalt, groesse, name) =>
    sharp(Buffer.from(inhalt), { density: Math.ceil(72 * groesse / 240) * 4 }).resize(groesse, groesse).png({ compressionLevel: 9 }).toFile(join(LOGO, name));
  await png(kachel(e), 32, 'favicon-32.png');
  await png(kachel(e, { rund: false }), 180, 'apple-touch-icon.png'); // iOS rundet selbst ab
  await png(kachel(e), 512, 'icon-512.png');
  console.log(`✓ ${Object.keys(dateien).length} SVG, 3 PNG, favicon.svg, logo-entwuerfe.html geschrieben.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--buehne')) console.log(buehne());
  else await schreiben();
}
