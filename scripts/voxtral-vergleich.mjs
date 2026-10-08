#!/usr/bin/env node
// ─── Deutscher Vergleichstest der Transkription (Mistral Voxtral, EU) — 09.10.2026, Paket 6a ─────────────────────────────────
// Kevin 08.10. (Antwort 25): „Voxtral nach deutschem Test.“ Eine unabhängige Deutsch-Bewertung ist nicht belegt (MODELLE.md 2.5) — darum eigene
// Aufnahmen gegen eigene Abschriften. NUR eigene Aufnahmen mit Einwilligung ALLER Sprechenden; keine Kundengespräche, keine Daten Dritter.
//
// Ordner mit Paaren:  <name>.(mp3|m4a|wav|webm|ogg|flac)  +  <name>.txt   (die von Hand geprüfte Abschrift = Referenz)
// Optional zum Vergleich:  <name>.<anbieter>.txt  (Abschrift eines anderen Dienstes, z. B. aufnahme1.speechmatics.txt) — wird mit gemessen.
//
//   node scripts/voxtral-vergleich.mjs --ordner ~/voxtral-test            → Trockenlauf: zeigt die Paare, sendet nichts
//   MISTRAL_API_KEY=… node scripts/voxtral-vergleich.mjs --ordner ~/voxtral-test --ja [--zeigen]
//
// Sendet an den EU-Endpunkt von Mistral (lib/ki/adapter/mistral.ts). Vorher im Mistral-Admin-Panel das Training ABSCHALTEN (Opt-out).
// Ausgabe: je Datei Wörter und Wortfehlerrate (lib/ki/wer.ts), gesamt gewichtet; Texte nur mit --zeigen. Der Schalter TRANSKRIPTION_AN der App
// bleibt davon unberührt (aus).

import { createRequire } from 'node:module';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const jiti = require('jiti')(fileURLToPath(import.meta.url), { alias: { '@': wurzel }, interopDefault: true, cache: false });
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null; };

const ordnerRoh = arg('ordner');
if (!ordnerRoh) { console.error('Aufruf: node scripts/voxtral-vergleich.mjs --ordner <ordner> [--ja] [--zeigen]'); process.exit(1); }
const ordner = path.resolve(ordnerRoh.replace(/^~(?=\/)/, process.env.HOME ?? '~'));
if (!existsSync(ordner) || !statSync(ordner).isDirectory()) { console.error(`Kein Ordner: ${ordner}`); process.exit(1); }
if (/[\\/]\.data([\\/]|$)/.test(ordner)) { console.error('Nie aus dem Datenordner der App (.data) — nur eigene Testaufnahmen.'); process.exit(1); }

const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac' };
const dateien = readdirSync(ordner);
const paare = dateien.map(d => /^(.+)\.(mp3|m4a|wav|webm|ogg|flac)$/i.exec(d)).filter(Boolean)
  .map(m => ({ name: m[1], audio: m[0], mime: MIME[m[2].toLowerCase()], referenz: `${m[1]}.txt` }))
  .filter(p => dateien.includes(p.referenz));
if (!paare.length) { console.error('Keine Paare <name>.<audio> + <name>.txt gefunden.'); process.exit(1); }

const { wortfehlerrate, werGesamt, woerter } = jiti('../lib/ki/wer.ts');
console.log(`Hinweis: nur eigene Aufnahmen mit Einwilligung aller Sprechenden. ${paare.length} Paare in ${ordner}.`);
if (!process.argv.includes('--ja')) {
  for (const p of paare) console.log(`  ${p.audio}  (${woerter(readFileSync(path.join(ordner, p.referenz), 'utf8')).length} Wörter Referenz)`);
  console.log('Trockenlauf — mit --ja (und MISTRAL_API_KEY) an Voxtral senden.');
  process.exit(0);
}
if (!process.env.MISTRAL_API_KEY) { console.error('MISTRAL_API_KEY fehlt.'); process.exit(1); }

const { voxtralTranskribieren } = jiti('../lib/ki/adapter/mistral.ts');
const ergebnisse = { voxtral: [] };
for (const p of paare) {
  const referenz = readFileSync(path.join(ordner, p.referenz), 'utf8');
  try {
    const t = await voxtralTranskribieren({ bytes: readFileSync(path.join(ordner, p.audio)), mime: p.mime, dateiname: p.audio, sprache: 'de' });
    const w = wortfehlerrate(referenz, t.text);
    ergebnisse.voxtral.push(w);
    console.log(`  ${p.audio.padEnd(32)} Wörter ${String(w.woerter).padStart(5)}  Voxtral WER ${(w.wer * 100).toFixed(1)} %${t.sekunden ? ` · ${Math.round(t.sekunden)} s` : ''}`);
    if (process.argv.includes('--zeigen')) console.log(`    → ${t.text}`);
  } catch (e) {
    console.log(`  ${p.audio.padEnd(32)} Voxtral: Fehler (${e instanceof Error ? e.message.slice(0, 160) : 'unbekannt'})`);
  }
  for (const d of dateien.filter(x => x.startsWith(`${p.name}.`) && x.endsWith('.txt') && x !== p.referenz)) {
    const anbieter = d.slice(p.name.length + 1, -4);
    const w = wortfehlerrate(referenz, readFileSync(path.join(ordner, d), 'utf8'));
    (ergebnisse[anbieter] ??= []).push(w);
    console.log(`    ${anbieter.padEnd(30)} WER ${(w.wer * 100).toFixed(1)} %`);
  }
}
console.log('\nGesamt (gewichtet nach Wörtern):');
for (const [anbieter, liste] of Object.entries(ergebnisse)) if (liste.length) console.log(`  ${anbieter.padEnd(16)} WER ${(werGesamt(liste) * 100).toFixed(1)} % über ${liste.length} Aufnahmen`);
