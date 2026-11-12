// MAKE Innovation · gebaute Seite in den Auslieferungsordner bringen (12.11.2026).
// Aufruf:  node ausliefern.mjs <zielordner>      z. B. …/website-upload/fokusinnovation
//          node ausliefern.mjs <zielordner> --pruefen   (ändert nichts, meldet nur Kommentare im Ziel)
//
// Was das Skript macht:
//   1) kopiert wie bisher mit rsync, ohne Generatoren, Inhalte, Notizen und OHNE die Kauf-Unterlagen (dateien/);
//   2) nimmt aus den ausgelieferten Stil- und Skriptdateien alle Kommentare heraus.
// Warum 2): Die Quelldateien tragen Arbeitsnotizen (wer wann was gewünscht hat). Die gehören nicht ins Netz, sollen in der
// Quelle aber stehen bleiben. HTML trägt keine Kommentare (prüft das Skript mit).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const QUELLE = dirname(fileURLToPath(import.meta.url));
const ziel = process.argv[2];
const nurPruefen = process.argv.includes('--pruefen');
if (!ziel || !existsSync(ziel)) { console.error('Aufruf: node ausliefern.mjs <zielordner> [--pruefen]'); process.exit(2); }

if (!nurPruefen) {
  execFileSync('rsync', ['-a', '--delete', '--exclude', '*.mjs', '--exclude', 'inhalt/', '--exclude', '*.md', '--exclude', 'dateien/',
    '--exclude', 'werkzeug/', '--exclude', 'assets/logo-vorschlaege/', QUELLE + '/', ziel.replace(/\/+$/, '') + '/'], { stdio: 'inherit' });
}

const dateien = (ordner, endung, liste = []) => {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) dateien(pfad, endung, liste); else if (name.endsWith(endung)) liste.push(pfad);
  }
  return liste;
};

/** CSS: alle Kommentare weg. Zeichenketten ("…", '…') bleiben unberührt. */
export function cssOhneKommentare(text) {
  let aus = '', i = 0;
  while (i < text.length) {
    const z = text[i];
    if (z === '"' || z === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== z) { if (text[j] === '\\') j++; j++; }
      aus += text.slice(i, j + 1); i = j + 1;
    } else if (z === '/' && text[i + 1] === '*') {
      const ende = text.indexOf('*/', i + 2);
      i = ende < 0 ? text.length : ende + 2;
    } else { aus += z; i++; }
  }
  return aus.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

/** Skripte: nur Kommentare, die ganze Zeilen einnehmen (Zeilenkommentare und Blockkommentare ab Zeilenanfang). Code-Zeilen bleiben,
 *  wie sie sind; ein Kommentar hinter Code am Zeilenende fällt nur weg, wenn davor sicher kein Zeichenketten- oder Musterzeichen steht. */
export function jsOhneKommentare(text) {
  const zeilen = text.split('\n'); const aus = []; let imBlock = false;
  for (const zeile of zeilen) {
    const t = zeile.trim();
    if (imBlock) { if (t.includes('*/')) imBlock = false; continue; }
    if (t.startsWith('//')) continue;
    if (t.startsWith('/*')) { if (!t.includes('*/')) imBlock = true; else if (!t.endsWith('*/')) aus.push(zeile.slice(zeile.indexOf('*/') + 2)); continue; }
    // Kommentar am Zeilenende: nur, wenn der Teil davor weder Anführungszeichen noch Schrägstrich noch Backtick enthält
    const k = zeile.indexOf(' // ');
    if (k > 0 && !/["'`/]/.test(zeile.slice(0, k))) { aus.push(zeile.slice(0, k).replace(/\s+$/, '')); continue; }
    aus.push(zeile);
  }
  return aus.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

const VERRAETER = /Kevin|Malin:|\b[0-3]\d\.[01]\d\.(20\d\d)?\b.*„|Prüfung [A-Z0-9]|Prüfbericht/;
let geaendert = 0; const funde = [];
for (const pfad of dateien(join(ziel, 'css'), '.css')) {
  const alt = readFileSync(pfad, 'utf8'); const neu = cssOhneKommentare(alt);
  if (/\/\*/.test(neu)) funde.push(pfad + ': noch ein Kommentar');
  if (nurPruefen) { if (/\/\*/.test(alt)) funde.push(pfad + ': Kommentare im Ziel'); } else if (neu !== alt) { writeFileSync(pfad, neu); geaendert++; }
}
for (const pfad of dateien(join(ziel, 'js'), '.js')) {
  const alt = readFileSync(pfad, 'utf8'); const neu = jsOhneKommentare(alt);
  if (VERRAETER.test(nurPruefen ? alt : neu)) funde.push(pfad + ': Arbeitsnotiz mit Namen oder Zitat');
  if (!nurPruefen && neu !== alt) { writeFileSync(pfad, neu); geaendert++; }
}
for (const pfad of dateien(ziel, '.html')) if (/<!--/.test(readFileSync(pfad, 'utf8'))) funde.push(pfad + ': HTML-Kommentar');

console.log(nurPruefen ? 'geprüft' : `ausgeliefert nach ${ziel}, ${geaendert} Stil- und Skriptdateien ohne Kommentare`);
if (funde.length) { console.error(funde.join('\n')); process.exit(1); }
