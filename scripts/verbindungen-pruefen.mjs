#!/usr/bin/env node
// ─── Verbindungsprüfung — nur lesen, nur Zahlen (28.09.) ─────────────────────
// Fragt GET /api/crm/verbindungen am laufenden MAKE OS (Standard: http://localhost:3001)
// und gibt je Prüfung NUR Kennung, Schwere und Anzahl aus — keine Namen, keine
// Beispiel-Kennungen, keine Inhalte. Repariert nichts.
//
//   node scripts/verbindungen-pruefen.mjs [--url http://localhost:3001] [--person kevin] [--alle]
//
// Der Dienstschlüssel kommt aus .env.local (MAKE_OS_KEY) bzw. der Umgebung und wird nie ausgegeben.
// --alle zeigt auch Prüfungen ohne Befund (Anzahl 0).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, standard) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : standard; };
const url = arg('url', 'http://localhost:3001').replace(/\/$/, '');
const person = arg('person', 'kevin');
const alle = process.argv.includes('--alle');

function schluessel() {
  if (process.env.MAKE_OS_KEY) return process.env.MAKE_OS_KEY;
  const datei = path.join(wurzel, '.env.local');
  if (!existsSync(datei)) return null;
  const zeile = readFileSync(datei, 'utf8').split('\n').find(z => /^\s*MAKE_OS_KEY\s*=/.test(z));
  return zeile ? zeile.replace(/^\s*MAKE_OS_KEY\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') : null;
}

const key = schluessel();
if (!key) { console.error('MAKE_OS_KEY fehlt (.env.local oder Umgebung).'); process.exit(2); }
if (!/^[a-z0-9-]{1,40}$/.test(person)) { console.error('--person: nur Speichername (a-z, 0-9, -).'); process.exit(2); }

let antwort;
try {
  const r = await fetch(`${url}/api/crm/verbindungen`, { headers: { 'x-make-key': key, 'x-make-person': person } });
  if (!r.ok) { console.error(`Antwort ${r.status} — läuft MAKE OS unter ${url}?`); process.exit(1); }
  antwort = await r.json();
} catch {
  console.error(`Keine Verbindung zu ${url}.`);
  process.exit(1);
}

const befunde = Array.isArray(antwort.befunde) ? antwort.befunde : [];
const nachId = new Map(befunde.map(b => [b.id, b]));
const ids = alle && Array.isArray(antwort.pruefungen) ? antwort.pruefungen : befunde.map(b => b.id);
const zeilen = ids.map(id => { const b = nachId.get(id); return { id, schwere: b?.schwere ?? '-', anzahl: b?.anzahl ?? 0, reparierbar: b ? (b.reparierbar ? 'ja' : 'nein') : '-' }; });

console.log(`Verbindungsprüfung ${antwort.heute ?? ''} · Ampel ${antwort.ampel ?? '?'} · ${antwort.geprueft ?? '?'} Prüfungen · ${befunde.length} mit Befund`);
const breite = Math.max(10, ...zeilen.map(z => z.id.length));
console.log(`${'Prüfung'.padEnd(breite)}  ${'Schwere'.padEnd(8)}  ${'Anzahl'.padStart(6)}  reparierbar`);
for (const z of zeilen) console.log(`${z.id.padEnd(breite)}  ${String(z.schwere).padEnd(8)}  ${String(z.anzahl).padStart(6)}  ${z.reparierbar}`);
const summe = s => befunde.filter(b => b.schwere === s).reduce((a, b) => a + (b.anzahl ?? 0), 0);
console.log(`Summe: Fehler ${summe('fehler')} · Warnungen ${summe('warnung')} · Hinweise ${summe('hinweis')}`);
