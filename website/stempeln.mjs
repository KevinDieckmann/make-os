#!/usr/bin/env node
// ─── MAKE Innovation · Stempel für Stile und Skripte (04.10.2026) ──────────────────────────────────────────────────────
// Caddy liefert Seiten immer frisch, Stile/Skripte dürfen einen Tag im Browser bleiben. Damit nach einem Upload nie die neue
// Seite mit alten Skripten läuft, trägt jeder Verweis auf css/ und js/ die Prüfsumme der Datei (?v=…). Nach jeder Änderung an
// css/ oder js/ einmal laufen lassen; website/pruefen.mjs meldet fehlende oder veraltete Stempel.
// Aufruf: node website/stempeln.mjs [ordner …]   (ohne Angabe: dieser Ordner)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stempeln, alleDateien } from './pruefen.mjs';

const ordnerListe = process.argv.length > 2 ? process.argv.slice(2).map(o => resolve(o)) : [dirname(fileURLToPath(import.meta.url))];
for (const ordner of ordnerListe) {
  for (const d of alleDateien(ordner).filter(d => d.endsWith('.html'))) {
    const vorher = readFileSync(join(ordner, d), 'utf8');
    const nachher = stempeln(ordner, vorher);
    if (nachher !== vorher) { writeFileSync(join(ordner, d), nachher); console.log(`gestempelt: ${d}`); }
  }
}
