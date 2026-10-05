#!/usr/bin/env node
// ─── MAKE OS · Einrichtungs-Code für das erste Konto (05.10.) ────────────────
// Eine neue Instanz hat noch kein Konto. Das erste (der Inhaber) entsteht auf /anmelden mit einem Einmal-Code, den nur
// bekommt, wer hier ein Terminal hat — nie mehr mit dem Generalschlüssel MAKE_OS_KEY (lib/zugang/einrichtung.mjs).
//
//   am Server:  docker compose exec app node scripts/einrichtung-token.mjs
//   am Mac:     node scripts/einrichtung-token.mjs            (Datenordner .data bzw. MAKE_OS_DATEN_DIR)
//   Optionen:   --stunden 4   (Gültigkeit, Standard 24, höchstens 72)
//
// Der Code erscheint nur hier im Terminal — nicht im Log, nicht im Chat weitergeben. Gibt es schon ein Konto, tut das
// Skript nichts (Einladungen erzeugt der Inhaber in MAKE OS unter Konto › Einladen).

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { codeAblegen } from '../lib/zugang/einrichtung.mjs';

const ordner = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');
const konten = path.join(ordner, 'konten.json');
if (existsSync(konten) && statSync(konten).size > 2) {
  console.error('Es gibt schon Konten — ein Einrichtungs-Code wird nicht gebraucht. Neue Personen lädt der Inhaber ein (Konto › Einladen).');
  process.exit(1);
}
const i = process.argv.indexOf('--stunden');
const stunden = i > 0 ? Number(process.argv[i + 1]) || 24 : 24;
const { code, bis } = await codeAblegen(ordner, stunden);
console.log('');
console.log('  Einrichtungs-Code für das erste Konto (einmal gültig):');
console.log('');
console.log(`      ${code}`);
console.log('');
console.log(`  gültig bis ${new Date(bis).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} — auf /anmelden unter „Erstes Konto einrichten“ eingeben.`);
console.log('');
