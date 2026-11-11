// Prüft alle Beispielseiten unter beispiele/<name>/index.html auf die Regeln aus LIESMICH.md.
// Aufruf (aus prototype/make-studios): node beispiele/pruefen.mjs   → Ausgabe je Seite, Exit 1 bei Fehlern.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
let fehlerGesamt = 0;

// Ordner ohne eigene Seite (gemeinsame Bibliotheken) werden nicht als Beispielseite geprüft.
const KEINE_SEITE = new Set(['vendor']);
for (const name of readdirSync(hier).sort()) {
  const ordner = join(hier, name);
  if (!statSync(ordner).isDirectory() || KEINE_SEITE.has(name)) continue;
  const datei = join(ordner, 'index.html');
  const fehler = [];
  if (!existsSync(datei)) { fehler.push('index.html fehlt'); melde(name, fehler); continue; }
  const roh = readFileSync(datei, 'utf8');
  const ohneKommentare = roh.replace(/<!--[\s\S]*?-->/g, '');

  if (!/<meta name="robots" content="noindex, nofollow">/.test(roh)) fehler.push('noindex fehlt');
  if (!/<title>Beispiel · [^<]+ · MAKE Studios<\/title>/.test(roh)) fehler.push('Titel nicht „Beispiel · … · MAKE Studios“');
  if (!roh.includes('href="../leiste.css"')) fehler.push('leiste.css nicht eingebunden');
  if (!roh.includes('class="ms-leiste"') || !roh.includes('class="ms-platz"')) fehler.push('Leiste oder Platzhalter fehlt');
  if (!/href="\.\.\/\.\.\/#erstgespraech(?:-(?:gastro|agentur|immobilien|andere))?"/.test(roh)) fehler.push('Knopf „Erstgespräch“ fehlt');
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(ohneKommentare)) fehler.push('Inline-Skript');
  if (/<style[\s>]/i.test(ohneKommentare)) fehler.push('<style>-Block');
  if (/\sstyle\s*=/i.test(ohneKommentare)) fehler.push('style-Attribut');
  if (/\son[a-z]+\s*=/i.test(ohneKommentare)) fehler.push('Event-Attribut (on…=)');
  if (ohneKommentare.includes('—')) fehler.push('Gedankenstrich „—“ im Text');

  // Lokale Verweise müssen existieren; fremde nur über https.
  for (const [, wert] of ohneKommentare.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(https:|mailto:|tel:|#)/.test(wert)) continue;
    if (/^[a-z]+:/i.test(wert)) { fehler.push('unsicherer Verweis: ' + wert); continue; }
    const pfad = wert.split('#')[0].split('?')[0];
    if (!pfad) continue;
    const ziel = resolve(ordner, pfad);
    if (!existsSync(ziel) || (statSync(ziel).isDirectory() && !existsSync(join(ziel, 'index.html')))) fehler.push('Verweis ins Leere: ' + wert);
  }
  melde(name, fehler);
}

function melde(name, fehler) {
  fehlerGesamt += fehler.length;
  console.log((fehler.length ? '✗ ' : '✓ ') + name + (fehler.length ? '\n  · ' + fehler.join('\n  · ') : ''));
}
process.exit(fehlerGesamt ? 1 : 0);
