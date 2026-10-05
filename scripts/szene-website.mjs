#!/usr/bin/env node
// ─── Szene → weitere statische Seiten (04.10.2026; „Klar“ 05.10.2026) ──────────────────────────────────────────────
// Die WebGL-Szene und der Showreel-Baukasten von makeinnovation.de (website/js/szene/: kern · formationen · motor · spur ·
// verlauf) sind das ORIGINAL — sie kennen keine Inhalte, jede Seite bringt nur ihr eigenes Drehbuch (js/drehbuch.js), ihre
// Blöcke und ihre Standbilder mit. Damit keine zweite Fassung entsteht, kopiert dieses Skript die Dateien Byte für Byte in
// jede Seite aus `ZIELE`
// (heute fokus/ = fokusinnovation.de). Neue Fähigkeiten (z. B. eine Formation) kommen immer nach website/js/szene/ und
// werden von hier verteilt — nie in einer Kopie ändern.
//
//   node scripts/szene-website.mjs           → schreibt fokus/js/szene/*.js
//   node scripts/szene-website.mjs --pruefen → Ausgang 1, wenn eine Kopie vom Original abweicht
// Wächter: tests/szene-website.test.ts (Byte-Vergleich); fokus/pruefen.mjs vergleicht ohne Abhängigkeiten dieselben Dateien
// (GLEICH_WIE_WEBSITE). scripts/fokus-seite.mjs schreibt die Kopien mit (eine Liste: `kopien()`).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Das Original. */
export const QUELLE = 'website/js/szene';
/** Die wiederverwendbaren Dateien der Szene (ohne Drehbuch — das gehört der Seite). */
export const DATEIEN = ['kern.js', 'formationen.js', 'motor.js', 'spur.js', 'verlauf.js'];
/** Seiten, die die Szene nutzen — eine Zeile je Seite. */
export const ZIELE = ['fokus/js/szene'];

/** Paare [Quelle, Ziel] (relativ zum Repo). */
export function kopien() {
  return ZIELE.flatMap(ziel => DATEIEN.map(d => [`${QUELLE}/${d}`, `${ziel}/${d}`]));
}

/** Abweichungen (leer = alle Kopien gleich dem Original). */
export function pruefen(wurzel = WURZEL) {
  const fehler = [];
  for (const [q, z] of kopien()) {
    if (!existsSync(join(wurzel, z))) { fehler.push(`${z}: fehlt`); continue; }
    if (!readFileSync(join(wurzel, z)).equals(readFileSync(join(wurzel, q)))) fehler.push(`${z}: weicht von ${q} ab`);
  }
  return fehler;
}

/** Schreibt alle Kopien. */
export function schreiben(wurzel = WURZEL) {
  for (const [q, z] of kopien()) {
    mkdirSync(dirname(join(wurzel, z)), { recursive: true });
    writeFileSync(join(wurzel, z), readFileSync(join(wurzel, q)));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--pruefen')) {
    const fehler = pruefen();
    for (const f of fehler) console.error(`✗ ${f} — node scripts/szene-website.mjs`);
    if (fehler.length) process.exit(1);
    console.log(`Szene: ${kopien().length} Kopien gleich dem Original (${QUELLE}).`);
  } else {
    schreiben();
    for (const [, z] of kopien()) console.log(`geschrieben: ${z}`);
  }
}
