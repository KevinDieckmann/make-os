#!/usr/bin/env node
// ─── Fokus Innovation · Event-Seite: gemeinsame und erzeugte Dateien (03.10.2026; „Klar 2“ 07.10.2026) ────────────────
// Die Seite fokusinnovation.de (Ordner fokus/) ist statisch wie website/ und steht auf derselben Gestaltungsgrundlage. Nichts
// davon wird von Hand kopiert — dieses Skript erzeugt es aus EINER Quelle:
//   · Gestaltungsgrundlage (css/seite.css: Tokens, Kopf, Knöpfe, Abschnitte, dunkler Schlussakt, Fuß, Rechtstexte), Schriften
//     (Archivo, Public Sans), das MAKE-Logo (quer), das Handy-Menü (js/menue.js) und die einmal gezeichnete Linie (js/weg.js):
//     Byte für Byte aus website/.
//   · Die Wortmarke „FOKUS INNOVATION“ (fokus/assets/logo/fokus-wortmarke.svg, Fuß) — gebaut in scripts/website-logo.mjs aus
//     derselben Schrift wie MAKE — und das Favicon (fokus/favicon.svg, der Knoten).
//   · Die ruhige Karte der Städte aus EINER Liste (`STAEDTE`, echte Koordinaten) in fokus/index.html (KARTE_ANFANG/KARTE_ENDE).
//   · Am Ende die Stempel: jeder Verweis auf css/ und js/ in den Seiten bekommt ?v=<Prüfsumme> (stempeln() aus website/pruefen.mjs).
// (Bis 06.10. kopierte es auch die WebGL-Szene und schrieb Städte ins Drehbuch — „Klar 2“ hat keine Szene mehr, Kevin 07.10.:
// „keine Spielereien“.)
//
//   node scripts/fokus-seite.mjs            → schreibt alles
//   node scripts/fokus-seite.mjs --pruefen  → Ausgang 1, wenn eine Datei nicht zur Quelle passt
// Wächter: tests/fokus-seite.test.ts (ruft `pruefen()`) und tests/szene-website.test.ts (eine Grundlage für beide Seiten);
// fokus/pruefen.mjs vergleicht zusätzlich ohne Abhängigkeiten die Grundlage, die Schriften, das Logo und das Menü mit website/.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fokusWortmarke } from './website-logo.mjs';
import { stempeln, alleDateien } from '../website/pruefen.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Logo-Farben (assets/logo/LOGO.md, „Synapse“): Rot links, Grün rechts — nie tauschen. */
export const GRANAT = '#C9465C';
export const SMARAGD = '#2FA878';

/** Byte-gleiche Kopien aus website/ (Quelle → Ziel). */
export const KOPIEN = [
  // Die Gestaltungsgrundlage (Tokens und Bausteine) — EINE Datei für beide Seiten.
  ['website/css/seite.css', 'fokus/css/seite.css'],
  ['website/assets/fonts/archivo-latin.woff2', 'fokus/assets/fonts/archivo-latin.woff2'],
  ['website/assets/fonts/public-sans-latin.woff2', 'fokus/assets/fonts/public-sans-latin.woff2'],
  // Absender im Fuß: das MAKE-Logo (quer) aus scripts/website-logo.mjs — nie eine eigene Fassung.
  ['website/assets/logo/quer.svg', 'fokus/assets/logo/make-quer.svg'],
  // Handy-Menü (<details>, geht ohne Skript; das Skript schließt es nur nach einem Klick).
  ['website/js/menue.js', 'fokus/js/menue.js'],
  // Der Weg: die Linie zeichnet sich einmal, wenn sie zum ersten Mal ins Bild kommt (Strecke „Der Abend“).
  ['website/js/weg.js', 'fokus/js/weg.js'],
];
export const FAVICON = 'fokus/favicon.svg';
export const WORTMARKE = 'fokus/assets/logo/fokus-wortmarke.svg';
export const SEITE = 'fokus/index.html';
export const KARTE_ANFANG = '<!-- KARTE_ANFANG: erzeugt mit node scripts/fokus-seite.mjs — nicht von Hand ändern -->';
export const KARTE_ENDE = '<!-- KARTE_ENDE -->';

/**
 * Die Städte der Reihe (Kevin 03.10., Dresden 04.10.) mit echten Koordinaten (WGS84, Stadtmitte). Berlin ist der
 * Ausgangspunkt — von dort gehen die Fäden der ruhigen Karte aus. `anker` = wohin der Name in der Karte rückt (links · rechts · unten).
 */
export const STAEDTE = [
  { id: 'berlin', name: 'Berlin', breite: 52.520, laenge: 13.405, anker: 'rechts' },
  { id: 'hamburg', name: 'Hamburg', breite: 53.551, laenge: 9.993, anker: 'links' },
  { id: 'bielefeld', name: 'Bielefeld', breite: 52.030, laenge: 8.532, anker: 'links' },
  { id: 'koeln', name: 'Köln', breite: 50.938, laenge: 6.960, anker: 'rechts' },
  { id: 'muenchen', name: 'München', breite: 48.137, laenge: 11.575, anker: 'rechts' },
  // Dresden (Kevin 04.10.): liegt dicht südöstlich von Berlin — der Name steht darunter, damit er weder die Fäden nach München
  // noch den Rand der Karte trifft.
  { id: 'dresden', name: 'Dresden', breite: 51.0504, laenge: 13.7373, anker: 'unten' },
];

/** Zahlwort für die Zahl der Städte (Kartentitel; die Überschrift der Seite nennt dasselbe Wort — fokus/pruefen.mjs vergleicht). */
export const ZAHLWORT = ['keine', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'];

/**
 * Umriss Deutschlands, vereinfacht (Festland, Rügen und Usedom angedeutet, ohne die übrigen Inseln) — [Breite, Länge] im
 * Uhrzeigersinn ab der dänischen Grenze. Genau genug für eine ruhige Übersicht; keine Grenzkarte.
 */
export const UMRISS = [
  [54.91, 8.65], [54.83, 9.43], [54.80, 9.82], [54.68, 10.03], [54.43, 10.20], [54.36, 10.85], [54.48, 11.10], [54.03, 10.88],
  [53.96, 11.10], [53.99, 11.46], [54.15, 11.80], [54.18, 12.10], [54.45, 12.50], [54.38, 12.90], [54.62, 13.20], [54.68, 13.42],
  [54.45, 13.72], [54.25, 13.70], [54.10, 13.82], [54.05, 14.20], [53.93, 14.22], [53.75, 14.27], [53.45, 14.40], [53.25, 14.43],
  [52.85, 14.15], [52.58, 14.62], [52.35, 14.55], [52.07, 14.75], [51.80, 14.65], [51.55, 14.73], [51.25, 15.00], [50.87, 14.82],
  [51.00, 14.45], [50.85, 14.05], [50.70, 13.55], [50.50, 13.20], [50.40, 12.90], [50.25, 12.35], [50.32, 12.10], [50.15, 12.20],
  [49.95, 12.45], [49.70, 12.50], [49.45, 12.70], [49.30, 12.95], [49.15, 13.35], [48.95, 13.55], [48.77, 13.82], [48.57, 13.50],
  [48.30, 13.43], [48.15, 12.85], [47.95, 12.93], [47.70, 13.05], [47.53, 13.00], [47.68, 12.75], [47.67, 12.20], [47.58, 11.70],
  [47.45, 11.40], [47.40, 10.98], [47.55, 10.45], [47.28, 10.20], [47.55, 9.97], [47.55, 9.70], [47.65, 9.48], [47.70, 9.20],
  [47.68, 8.88], [47.75, 8.60], [47.60, 8.45], [47.58, 8.10], [47.56, 7.60], [47.80, 7.55], [48.10, 7.58], [48.50, 7.80],
  [48.80, 8.10], [48.97, 8.23], [49.05, 7.90], [49.18, 7.40], [49.12, 7.05], [49.20, 6.80], [49.47, 6.36], [49.75, 6.50],
  [50.00, 6.13], [50.13, 6.13], [50.32, 6.40], [50.50, 6.25], [50.75, 6.05], [51.05, 5.87], [51.20, 6.10], [51.50, 6.20],
  [51.85, 5.95], [51.90, 6.40], [52.05, 6.70], [52.20, 7.05], [52.45, 7.00], [52.65, 6.75], [52.85, 7.08], [53.20, 7.20],
  [53.35, 7.05], [53.55, 7.10], [53.68, 7.50], [53.70, 8.00], [53.52, 8.12], [53.40, 8.25], [53.55, 8.55], [53.87, 8.70],
  [53.90, 9.10], [54.05, 8.85], [54.30, 8.62], [54.48, 9.00], [54.70, 8.70],
];

// Projektion: abstandstreu in Breite, Länge mit cos(51,2°) gestaucht (für Deutschland genau genug, kein Verzerrungs-Eindruck).
const LAENGE_0 = 5.6, BREITE_0 = 55.25, PX = 60, COS = Math.cos((51.2 * Math.PI) / 180);
export const projiziere = ([b, l]) => [(l - LAENGE_0) * COS * PX, (BREITE_0 - b) * PX];
const r1 = v => Math.round(v * 10) / 10;
export const KARTE_BREITE = r1((15.25 - LAENGE_0) * COS * PX), KARTE_HOEHE = r1((BREITE_0 - 47.1) * PX);

function umrissPfad() {
  return UMRISS.map((p, i) => { const [x, y] = projiziere(p); return `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`; }).join('') + 'Z';
}

/** Ein Faden von a nach b: leicht gebogene Kurve (quadratisch), Bogen nach links der Laufrichtung; `versatz` trennt Rot und Grün. */
function faden([x1, y1], [x2, y2], bogen, versatz) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const cx = (x1 + x2) / 2 + nx * (d * bogen + versatz), cy = (y1 + y2) / 2 + ny * (d * bogen + versatz);
  return `M${r1(x1)} ${r1(y1)}Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}`;
}

/** Die Karte als SVG-Block für index.html: Umriss, Fäden von Berlin, Städte mit Namen (Text in der Schrift der Seite). */
export function karteSvg() {
  const pos = Object.fromEntries(STAEDTE.map(s => [s.id, projiziere([s.breite, s.laenge])]));
  const berlin = pos.berlin;
  const z = [];
  z.push(`<svg class="karte" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" role="img" aria-labelledby="karte-titel karte-text" focusable="false">`);
  z.push(`<title id="karte-titel">Deutschlandkarte: Fokus Innovation in ${ZAHLWORT[STAEDTE.length] ?? STAEDTE.length} Städten</title>`);
  z.push(`<desc id="karte-text">Von Berlin gehen feine Fäden in Rot und Grün nach ${STAEDTE.filter(s => s.id !== 'berlin').map(s => s.name).join(', ').replace(/, ([^,]*)$/, ' und $1')}.</desc>`);
  z.push(`<path class="land" d="${umrissPfad()}"/>`);
  for (const s of STAEDTE.filter(x => x.id !== 'berlin')) {
    z.push(`<path class="faden faden-rot" d="${faden(berlin, pos[s.id], 0.14, -2.6)}" stroke="${GRANAT}"/>`);
    z.push(`<path class="faden faden-gruen" d="${faden(berlin, pos[s.id], 0.14, 2.6)}" stroke="${SMARAGD}"/>`);
  }
  for (const s of STAEDTE) {
    const [x, y] = pos[s.id];
    const links = s.anker === 'links', unten = s.anker === 'unten';
    if (s.id === 'berlin') {
      z.push(`<g class="stadt knoten" data-stadt="${s.id}"><path d="M${r1(x)} ${r1(y - 5)}A5 5 0 0 0 ${r1(x)} ${r1(y + 5)}Z" fill="${GRANAT}"/><path d="M${r1(x)} ${r1(y - 5)}A5 5 0 0 1 ${r1(x)} ${r1(y + 5)}Z" fill="${SMARAGD}"/>`);
    } else {
      z.push(`<g class="stadt" data-stadt="${s.id}"><circle cx="${r1(x)}" cy="${r1(y)}" r="3.2"/>`);
    }
    const tx = unten ? x : links ? x - 10 : x + 10, ty = unten ? y + 18 : y + 4.5;
    z.push(`<text x="${r1(tx)}" y="${r1(ty)}"${links ? ' text-anchor="end"' : unten ? ' text-anchor="middle"' : ''}>${s.name}</text></g>`);
  }
  z.push('</svg>');
  return z.join('\n');
}

/** Favicon: der Knoten (links Granat, rechts Smaragd) mit den zwei Strichen auf dunkler, abgerundeter Fläche. */
export function faviconSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
    '<rect width="64" height="64" rx="14" fill="#0B0E10"/>',
    `<rect x="8" y="30.5" width="15" height="3" fill="${GRANAT}"/><rect x="41" y="30.5" width="15" height="3" fill="${SMARAGD}"/>`,
    `<path d="M32 23A9 9 0 0 0 32 41Z" fill="${GRANAT}"/><path d="M32 23A9 9 0 0 1 32 41Z" fill="${SMARAGD}"/>`,
    '</svg>', '',
  ].join('\n');
}

/** Soll-Inhalt jeder erzeugten Datei (Pfad → Buffer|String). */
export async function sollDateien(wurzel = WURZEL) {
  const soll = new Map();
  for (const [q, z] of KOPIEN) soll.set(z, readFileSync(join(wurzel, q)));
  soll.set(FAVICON, faviconSvg());
  soll.set(WORTMARKE, `<?xml version="1.0" encoding="UTF-8"?>\n${fokusWortmarke()}\n`);
  return soll;
}

/** Ersetzt den Block zwischen zwei Markierungen (die Markierungen bleiben stehen). */
export function mitBlock(text, anfang, ende, inhalt, datei = '') {
  const a = text.indexOf(anfang), e = text.indexOf(ende);
  if (a < 0 || e < a) throw new Error(`${datei}: Markierungen ${anfang.slice(0, 24)}… fehlen`);
  const einzug = /[ \t]*$/.exec(text.slice(0, e))[0];
  return `${text.slice(0, a + anfang.length)}\n${einzug}${inhalt.split('\n').join(`\n${einzug}`)}\n${einzug}${text.slice(e)}`;
}
/** Erzeugte Blöcke: [Datei, Anfang, Ende, Inhalt]. */
export const BLOECKE = () => [
  [SEITE, KARTE_ANFANG, KARTE_ENDE, karteSvg()],
];

/** Abweichungen (leer = alles aktuell). */
export async function pruefen(wurzel = WURZEL) {
  const fehler = [];
  for (const [pfad, inhalt] of await sollDateien(wurzel)) {
    const ziel = join(wurzel, pfad);
    if (!existsSync(ziel)) { fehler.push(`${pfad}: fehlt`); continue; }
    const ist = readFileSync(ziel);
    if (!ist.equals(Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(inhalt))) fehler.push(`${pfad}: passt nicht zur Quelle`);
  }
  for (const [datei, anfang, ende, inhalt] of BLOECKE()) {
    const text = readFileSync(join(wurzel, datei), 'utf8');
    try { if (mitBlock(text, anfang, ende, inhalt, datei) !== text) fehler.push(`${datei}: erzeugter Block ${anfang.slice(5, 18).trim()} passt nicht zur Quelle`); } catch (x) { fehler.push(String(x.message)); }
  }
  const ordner = join(wurzel, 'fokus');
  for (const d of alleDateien(ordner).filter(d => d.endsWith('.html'))) {
    const text = readFileSync(join(ordner, d), 'utf8');
    if (stempeln(ordner, text) !== text) fehler.push(`fokus/${d}: Stempel (?v=…) nicht aktuell`);
  }
  return fehler;
}

/** Stempelt alle Seiten von fokus/ (nach jeder Änderung an css/ oder js/). */
export function allesStempeln(wurzel = WURZEL) {
  const ordner = join(wurzel, 'fokus'), geaendert = [];
  for (const d of alleDateien(ordner).filter(d => d.endsWith('.html'))) {
    const vorher = readFileSync(join(ordner, d), 'utf8'), nachher = stempeln(ordner, vorher);
    if (nachher !== vorher) { writeFileSync(join(ordner, d), nachher); geaendert.push(`fokus/${d}`); }
  }
  return geaendert;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--pruefen')) {
    const fehler = await pruefen();
    for (const f of fehler) console.error(`✗ ${f}`);
    if (fehler.length) { console.error('→ node scripts/fokus-seite.mjs'); process.exit(1); }
    console.log('fokus/: gemeinsame und erzeugte Dateien aktuell.');
  } else {
    for (const [pfad, inhalt] of await sollDateien()) {
      mkdirSync(dirname(join(WURZEL, pfad)), { recursive: true });
      writeFileSync(join(WURZEL, pfad), inhalt);
      console.log(`geschrieben: ${pfad}`);
    }
    for (const [datei, anfang, ende, inhalt] of BLOECKE()) {
      const p = join(WURZEL, datei);
      writeFileSync(p, mitBlock(readFileSync(p, 'utf8'), anfang, ende, inhalt, datei));
      console.log(`Block erneuert: ${datei}`);
    }
    for (const d of allesStempeln()) console.log(`gestempelt: ${d}`);
  }
}
