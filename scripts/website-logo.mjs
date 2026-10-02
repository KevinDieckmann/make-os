#!/usr/bin/env node
// ─── MAKE Innovation · Logo-Bau (v4, 02.10.2026) ────────────────────────────────────────────────────
// Eine Quelle für das Logo der Landingpage. Kevin 02.10.: „Mach bei uns nur MAKE und darunter Innovation — mit dem
// roten Strich unter MA und dem grünen unter KE. Wir haben noch kein gutes Logo, da müssen wir später nochmal ran.“
//   (a) Wortmarke: „MAKE“ (Linien-Buchstaben), darunter zwei Personenstriche — Rot unter MA, Grün unter KE, mit
//       kleiner Lücke zwischen A und K —, darunter „INNOVATION“ im Blocksatz auf Breite der Wortmarke.
//   (b) Bildmarke (das M mit geteiltem Punkt): VORLÄUFIG nur noch für Favicon und App-Kachel (zu klein für eine Wortmarke).
// Alles ist Linie bzw. Fläche auf einem Raster (keine Schrift im SVG — sieht überall gleich aus, lädt nichts nach).
// Schreibt:
//   website/assets/logo/*.svg + favicon-32.png, apple-touch-icon.png, icon-512.png
//   website/favicon.svg                    (= Kachel)
//   website/logo-entwuerfe.html            (Logo-Übersicht, wird nie ausgeliefert)
// Konstruktion, Farben, Schutzzone, Mindestgröße: website/assets/logo/LOGO.md.
//
//   node scripts/website-logo.mjs          (braucht `sharp` aus node_modules für die PNGs)
//   node scripts/website-logo.mjs --buehne (gibt den Inline-Block für die Bühne von website/index.html aus)
//
// website/pruefen.mjs prüft, dass das Bühnen-Zeichen in website/index.html dieselben Formen trägt wie
// assets/logo/wortmarke.svg — nach einer Änderung hier also auch den Bühnen-Block übernehmen.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEITE = join(WURZEL, 'website');
const LOGO = join(SEITE, 'assets', 'logo');

// ── Farben (CI wie website/css/seite.css) ──
export const FARBEN = {
  dunkel: { grund: '#0B0E10', ink: '#E8ECEA', zusatz: '#A2ADB0', rot: '#D13A55', gruen: '#22B577' },
  hell: { grund: '#FFFFFF', ink: '#0B0E10', zusatz: '#4F5A5D', rot: '#B12E46', gruen: '#1A8F5E' },
};

const r = n => Math.round(n * 100) / 100;
const pfad = pts => 'M' + pts.map(([x, y], i) => `${i ? 'L' : ''}${r(x)} ${r(y)}`).join('');
const linie = (s, farbe) => `fill="none" stroke="${farbe}" stroke-width="${r(s)}" stroke-linecap="round" stroke-linejoin="round"`;

// ── Bildmarke ─────────────────────────────────────────────────────────────────────────────────────────
// Feld 240 × 240, Modul 24 = Strichstärke. Stämme x 48 / 192, oben y 64, unten y 184, Diagonalen exakt 45° bis
// zur Fuge (120 | 136). Jeder Zug ist auf seine Hälfte beschnitten (clipPath bei x 120) — die Naht liegt genau auf
// der Mittelachse. Sichtbare Fläche 168 × 144 (x 36–204, y 52–196).
const S = 24;
const MARKE_BOX = { x: 36, y: 52, b: 168, h: 144 };
/** Die zwei Züge — beide beginnen am Fuß ihres Stamms und laufen zur Fuge (so zeichnet die Bühne sie). */
export const ZUEGE = { ma: [[48, 184], [48, 64], [120, 136]], ke: [[192, 184], [192, 64], [120, 136]] };
/**
 * Der Punkt in der Mitte: frei im V, Durchmesser = Strichstärke. Abstand zur Innenkante der Diagonalen und zur
 * Kerbe der Fuge je ≈ 15 (gut eine halbe Strichstärke) — bleibt auch in 16 px als eigener Punkt lesbar.
 */
export const PUNKT = { cx: 120, cy: 92, r: 12 };

/** Halbkreis rechts (Bogen im Uhrzeigersinn von oben nach unten). */
const halbRechts = ({ cx, cy, r: rr }) => `M${cx} ${cy - rr}A${rr} ${rr} 0 0 1 ${cx} ${cy + rr}Z`;

/** Der geteilte Punkt: voller Kreis grün, darüber die rechte Hälfte rot (keine Haarlinie in der Mitte). */
function punktInnen(f, { klassen = false } = {}) {
  const k = klassen ? ' class="punkt"' : '';
  return `<g${k}><circle cx="${PUNKT.cx}" cy="${PUNKT.cy}" r="${PUNKT.r}" fill="${f.gruen}"/><path d="${halbRechts(PUNKT)}" fill="${f.rot}"/></g>`;
}

/** Bildmarke als SVG-Innenleben im 240er-Feld. `id` macht die Clip-Kennungen je Einsatz eindeutig. */
export function bildmarkeInnen(f, id, { klassen = false } = {}) {
  const k = n => (klassen ? ` class="zug zug-${n}" pathLength="1"` : '');
  const defs = `<defs><clipPath id="${id}-ma"><rect width="120" height="240"/></clipPath><clipPath id="${id}-ke"><rect x="120" width="120" height="240"/></clipPath></defs>`;
  return `${defs}<path${k('ma')} clip-path="url(#${id}-ma)" d="${pfad(ZUEGE.ma)}" ${linie(S, f.rot)}/>` +
    `<path${k('ke')} clip-path="url(#${id}-ke)" d="${pfad(ZUEGE.ke)}" ${linie(S, f.gruen)}/>${punktInnen(f, { klassen })}`;
}

// ── Wortmarke „MAKE“ ──────────────────────────────────────────────────────────────────────────────────
// Versalhöhe 72, Strich 12 (= halbe Bildmarke). Mittellinien von y 6 bis 66, Außenkante 0–72.
// M wie die Bildmarke (45°, V-Tiefe 60 %). A-Querstrich auf 7/10, E-Mittelstrich leicht über der Mitte und kürzer.
const WORT = { s: 12, h: 72, breite: 332 };
const BUCHSTABEN = {
  M: [[[0, 66], [0, 6], [36, 42], [72, 6], [72, 66]]],
  A: [[[0, 66], [32, 6], [64, 66]], [[10, 48], [54, 48]]],
  K: [[[0, 6], [0, 66]], [[50, 6], [0, 46]], [[16, 33.2], [52, 66]]],
  E: [[[46, 6], [0, 6], [0, 66], [46, 66]], [[0, 35], [40, 35]]],
};
/** x der Mittellinie je Buchstabe (Abstände der Außenkanten: M–A 16, A–K 18, K–E 16). */
const WORT_X = { M: 6, A: 106, K: 200, E: 280 };

function makeInnen(f) {
  const d = Object.entries(BUCHSTABEN).map(([b, z]) => z.map(p => pfad(p.map(([x, y]) => [x + WORT_X[b], y]))).join('')).join('');
  return `<path d="${d}" ${linie(WORT.s, f.ink)}/>`;
}

// ── Die zwei Personenstriche unter MAKE ──────────────────────────────────────────────────────────────
// 4 hoch, 12 unter der Grundlinie (wie v2). Rot (Malin) unter „MA“ (Außenkanten M 0 bis A 176), Grün (Kevin) unter „KE“
// (K 194 bis E 332) — die Lücke von 18 liegt genau zwischen A und K.
const STRICHE = { ma: [0, 176], ke: [194, 332], dicke: 4, abstand: 12 };
function strichInnen(f, { klassen = false } = {}) {
  const y = WORT.h + STRICHE.abstand;
  const rect = (n, [a, b], farbe) => `<rect${klassen ? ` class="strich strich-${n}"` : ''} x="${a}" y="${y}" width="${b - a}" height="${STRICHE.dicke}" rx="${STRICHE.dicke / 2}" fill="${farbe}"/>`;
  return rect('ma', STRICHE.ma, f.rot) + rect('ke', STRICHE.ke, f.gruen);
}

// ── Zusatz „INNOVATION“ ───────────────────────────────────────────────────────────────────────────────
// Grundmaß Versalhöhe 20, Strich 4; skaliert mit k. O mit 0,5 Überhang (Rundes wirkt sonst kleiner).
const ZUSATZ = {
  I: { b: 0, z: [[[0, 2], [0, 18]]] },
  N: { b: 14, z: [[[0, 18], [0, 2], [14, 18], [14, 2]]] },
  O: { b: 16, kreis: { cx: 8, cy: 10, r: 8.5 } },
  V: { b: 16, z: [[[0, 2], [8, 18], [16, 2]]] },
  A: { b: 16, z: [[[0, 18], [8, 2], [16, 18]], [[3, 13], [13, 13]]] },
  T: { b: 14, z: [[[0, 2], [14, 2]], [[7, 2], [7, 18]]] },
};
const ZUSATZ_WORT = 'INNOVATION';

/** INNOVATION bei Faktor k, im Blocksatz auf genau `breite` (Außenkante bis Außenkante). */
function zusatzInnen(f, k, breite) {
  const s = 4 * k;
  const ohneSperr = ZUSATZ_WORT.split('').reduce((summe, b) => summe + ZUSATZ[b].b * k + s, 0);
  const abstand = (breite - ohneSperr) / (ZUSATZ_WORT.length - 1);
  let x = s / 2; const pfade = []; const kreise = [];
  for (const b of ZUSATZ_WORT) {
    const g = ZUSATZ[b];
    if (g.kreis) kreise.push(`<circle cx="${r(x + g.kreis.cx * k)}" cy="${r(g.kreis.cy * k)}" r="${r(g.kreis.r * k)}" fill="none" stroke="${f.zusatz}" stroke-width="${r(s)}"/>`);
    else pfade.push(g.z.map(p => pfad(p.map(([px, py]) => [px * k + x, py * k]))).join(''));
    x += g.b * k + s + abstand;
  }
  return { innen: `<path d="${pfade.join('')}" ${linie(s, f.zusatz)}/>${kreise.join('')}`, hoehe: 20 * k };
}

// ── Wortmarke gestapelt: MAKE · Personenstriche · INNOVATION (Block 332 × 130) ───────────────────────────
// MAKE 0–72 · Striche 84–88 · INNOVATION 100–130 (Faktor 1,5: Versalhöhe 30, Strich 6). Lücke je 12.
const BLOCK = { h: 130, zusatzY: 100, k: 1.5 };
function wortmarkeBlock(f, { mitZusatz = true, klassen = false } = {}) {
  const z = zusatzInnen(f, BLOCK.k, WORT.breite);
  return makeInnen(f) + strichInnen(f, { klassen }) + (mitZusatz ? `<g transform="translate(0 ${BLOCK.zusatzY})">${z.innen}</g>` : '');
}

// ── Anordnungen ───────────────────────────────────────────────────────────────────────────────────────
const svg = (b, h, innen, titel) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(b)} ${r(h)}" width="${r(b)}" height="${r(h)}" role="img" aria-label="${titel}">${innen}</svg>`;
const marke = (f, id, dx = 0, dy = 0) => `<g transform="translate(${dx - MARKE_BOX.x} ${dy - MARKE_BOX.y})">${bildmarkeInnen(f, id)}</g>`;

/** Bildmarke allein, sichtbare Fläche ohne Rand (168 × 144). */
export function bildmarke(ton, id = `bm${ton}`) {
  return svg(MARKE_BOX.b, MARKE_BOX.h, marke(FARBEN[ton], id), 'MAKE Innovation');
}

/** Wortmarke allein: MAKE · Personenstriche · INNOVATION (332 × 130). */
export function wortmarke(ton) {
  return svg(WORT.breite, BLOCK.h, wortmarkeBlock(FARBEN[ton]), 'MAKE Innovation');
}

/** App-Kachel / Favicon: Bildmarke auf dunklem Quadrat (Schutzzone eingebaut). */
export function kachel({ rund = true, id = 'ka' } = {}) {
  const f = FARBEN.dunkel;
  const grund = `<rect width="240" height="240"${rund ? ' rx="52"' : ''} fill="${f.grund}"/>`;
  // Mitte der sichtbaren Bildmarke (120 | 124) auf die Kachelmitte, 82 %.
  return svg(240, 240, `${grund}<g transform="translate(120 120) scale(.82) translate(-120 -124)">${bildmarkeInnen(f, id)}</g>`, 'MAKE Innovation');
}

/** Quer (Kopf, Fuß): die Wortmarke. `kompakt` = ohne INNOVATION (Handy). */
export function quer(ton, { kompakt = false } = {}) {
  const f = FARBEN[ton];
  const h = kompakt ? WORT.h + STRICHE.abstand + STRICHE.dicke : BLOCK.h;
  return svg(WORT.breite, h, wortmarkeBlock(f, { mitZusatz: !kompakt }), 'MAKE Innovation');
}

/** Groß (Titel, Druck): die Wortmarke mit Schutzzone (rundum 40, transparent). */
export function gross(ton) {
  const rand = 40;
  return svg(WORT.breite + 2 * rand, BLOCK.h + 2 * rand, `<g transform="translate(${rand} ${rand})">${wortmarkeBlock(FARBEN[ton])}</g>`, 'MAKE Innovation');
}

/**
 * Visitenkarten-Profil (Logo zum Hochladen): Wortmarke + Striche + INNOVATION mit eigenem Grund und Rand (rundum 48),
 * damit es auf jedem Profil-Hintergrund gleich aussieht. Reines SVG: kein Skript, kein Stil, keine externen Verweise.
 */
export function visitenkarte(ton) {
  const f = FARBEN[ton]; const rand = 48;
  const b = WORT.breite + 2 * rand; const h = BLOCK.h + 2 * rand;
  return svg(b, h, `<rect width="${b}" height="${h}" fill="${f.grund}"/><g transform="translate(${rand} ${rand})">${wortmarkeBlock(f)}</g>`, 'MAKE Innovation');
}

/** Inline-Fassung für die Bühne (Klassen für die Einzeichnen-Animation der Striche, dekorativ: aria-hidden). */
export function buehne() {
  return `<svg class="zeichen" viewBox="0 0 ${WORT.breite} ${BLOCK.h}" aria-hidden="true" focusable="false">${wortmarkeBlock(FARBEN.dunkel, { klassen: true })}</svg>`;
}

// ── Schreiben ─────────────────────────────────────────────────────────────────────────────────────────
const KOPF = '<?xml version="1.0" encoding="UTF-8"?>\n';

function uebersicht() {
  const zeile = (titel, inhalt) => `<div class="ent-zeile"><span class="mikro">${titel}</span><div class="ent-flaeche">${inhalt}</div></div>`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logo — MAKE Innovation GmbH</title>
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
    <h1>MAKE-Logo (v4)</h1>
    <p>Wortmarke: MAKE, darunter ein roter Strich unter MA und ein grüner unter KE, darunter INNOVATION im Blocksatz. Die M-Bildmarke dient vorläufig nur als Favicon und App-Kachel — das Logo wird später überarbeitet. Konstruktion, Schutzzone und Mindestgrößen: <code>assets/logo/LOGO.md</code>.</p>
  <section class="ent" aria-labelledby="ent-logo">
    <div class="ent-kopf"><h2 id="ent-logo">Im Einsatz</h2></div>
    ${zeile('Wortmarke · dunkel und hell', `<div class="ent-dunkel ent-gestapelt">${wortmarke('dunkel')}</div><div class="ent-hell ent-gestapelt">${wortmarke('hell')}</div>`)}
    ${zeile('Bildmarke (vorläufig, nur Favicon/Kachel)', `<div class="ent-dunkel ent-gross">${bildmarke('dunkel', 'u1')}</div><div class="ent-hell ent-gross">${bildmarke('hell', 'u2')}</div>`)}
    ${zeile('Favicon · 64 / 32 / 16 px', `<div class="ent-dunkel ent-icons"><span class="i64">${kachel({ id: 'u3' })}</span><span class="i32">${kachel({ id: 'u4' })}</span><span class="i16">${kachel({ id: 'u5' })}</span></div>`)}
    ${zeile('Quer (Kopf, Fuß)', `<div class="ent-dunkel ent-quer">${quer('dunkel')}</div><div class="ent-hell ent-quer">${quer('hell')}</div>`)}
    ${zeile('Kompakt (Kopf am Handy)', `<div class="ent-dunkel ent-quer">${quer('dunkel', { kompakt: true })}</div><div class="ent-hell ent-quer">${quer('hell', { kompakt: true })}</div>`)}
    ${zeile('Groß (Bühne, Titel, Druck)', `<div class="ent-dunkel ent-quer">${gross('dunkel')}</div><div class="ent-hell ent-quer">${gross('hell')}</div>`)}
    ${zeile('Visitenkarten-Profil (zum Hochladen)', `<div class="ent-dunkel ent-quer">${visitenkarte('dunkel')}</div><div class="ent-hell ent-quer">${visitenkarte('hell')}</div>`)}
  </section>
  </div>
</main>
</body>
</html>
`;
}

async function schreiben() {
  mkdirSync(LOGO, { recursive: true });
  const dateien = {
    'bildmarke.svg': bildmarke('dunkel'),
    'bildmarke-hell.svg': bildmarke('hell'),
    'wortmarke.svg': wortmarke('dunkel'),
    'wortmarke-hell.svg': wortmarke('hell'),
    'kachel.svg': kachel(),
    'quer.svg': quer('dunkel'),
    'quer-hell.svg': quer('hell'),
    'kompakt.svg': quer('dunkel', { kompakt: true }),
    'kompakt-hell.svg': quer('hell', { kompakt: true }),
    'gross.svg': gross('dunkel'),
    'gross-hell.svg': gross('hell'),
    'visitenkarte-make.svg': visitenkarte('dunkel'),
    'visitenkarte-make-hell.svg': visitenkarte('hell'),
  };
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(LOGO, name), KOPF + inhalt + '\n');
  writeFileSync(join(SEITE, 'favicon.svg'), KOPF + kachel() + '\n');
  writeFileSync(join(SEITE, 'logo-entwuerfe.html'), uebersicht());

  const { default: sharp } = await import('sharp');
  const png = async (inhalt, groesse, name) =>
    sharp(Buffer.from(inhalt), { density: Math.ceil(72 * groesse / 240) * 4 }).resize(groesse, groesse).png({ compressionLevel: 9 }).toFile(join(LOGO, name));
  await png(kachel(), 32, 'favicon-32.png');
  await png(kachel({ rund: false }), 180, 'apple-touch-icon.png'); // iOS rundet selbst ab
  await png(kachel(), 512, 'icon-512.png');
  console.log(`✓ ${Object.keys(dateien).length} SVG, 3 PNG, favicon.svg, logo-entwuerfe.html geschrieben.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--buehne')) console.log(buehne());
  else await schreiben();
}
