#!/usr/bin/env node
// ─── Lichtfäden → Website (03.10.2026) ──────────────────────────────────────
// Die Landingpage (website/) ist statisch und hat keinen Bau-Schritt. Damit dort DIESELBEN Lichtfäden laufen wie in der
// Planung, übersetzt dieses Skript lib/lichtfaeden/band.ts + zeichnen.ts (reine Mathematik + Zeichner, ohne Framework)
// in EINE Datei website/js/lichtfaeden.js (IIFE, `globalThis.Lichtfaeden`). Keine Abhängigkeit zur Laufzeit.
//
//   node scripts/lichtfaeden-website.mjs           → schreibt website/js/lichtfaeden.js
//   node scripts/lichtfaeden-website.mjs --pruefen → Ausgang 1, wenn die Datei nicht zum Quelltext passt
// Wächter: tests/lichtfaeden.test.ts vergleicht die Datei mit `erzeugen()` — wer band.ts/zeichnen.ts ändert, ruft das Skript.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const QUELLEN = ['lib/lichtfaeden/band.ts', 'lib/lichtfaeden/zeichnen.ts'];
export const ZIEL = 'website/js/lichtfaeden.js';

/** Den Inhalt von website/js/lichtfaeden.js aus dem Quelltext erzeugen (rein, deterministisch). */
export function erzeugen(wurzel = WURZEL) {
  const namen = [];
  const teile = QUELLEN.map(q => {
    const quelle = readFileSync(join(wurzel, q), 'utf8');
    const js = ts.transpileModule(quelle, {
      compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.ESNext, removeComments: true, importsNotUsedAsValues: undefined, verbatimModuleSyntax: false },
      fileName: q,
    }).outputText;
    return js
      .split('\n')
      .filter(z => !/^\s*import\s/.test(z) && !/^\s*export\s*\{\s*\};?\s*$/.test(z))
      .map(z => z.replace(/^export\s+(const|function|let|class)\s+([A-Za-z0-9_]+)/, (_, art, name) => { namen.push(name); return `${art} ${name}`; }))
      .join('\n')
      .trim();
  });
  return [
    '// Lichtfäden — feine, leuchtende Fäden auf Canvas 2D (übersetzt, nicht von Hand ändern).',
    '// Erzeugt mit: node scripts/lichtfaeden-website.mjs — liest nichts, speichert nichts, sendet nichts.',
    '(() => {',
    "  'use strict';",
    ...teile.join('\n\n').split('\n').map(z => (z ? `  ${z}` : z)),
    `  globalThis.Lichtfaeden = Object.freeze({ ${namen.join(', ')} });`,
    '})();',
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const soll = erzeugen();
  const pfad = join(WURZEL, ZIEL);
  if (process.argv.includes('--pruefen')) {
    let ist = '';
    try { ist = readFileSync(pfad, 'utf8'); } catch { /* fehlt */ }
    if (ist !== soll) { console.error(`${ZIEL} passt nicht zu ${QUELLEN.join(' + ')} — node scripts/lichtfaeden-website.mjs`); process.exit(1); }
    console.log(`${ZIEL} aktuell (${soll.length} Zeichen).`);
  } else {
    writeFileSync(pfad, soll);
    console.log(`${ZIEL} geschrieben (${soll.length} Zeichen).`);
  }
}
