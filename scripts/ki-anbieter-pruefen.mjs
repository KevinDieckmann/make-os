#!/usr/bin/env node
// ─── MAKE OS — KI-Anbieter prüfen (09.10.2026, Paket 6a) ────────────────────────────────────────────────────────────────────
// Im Container des Servers (die Umgebung kommt aus der .env, gesetzt mit deploy/ki-anbieter-verbinden.sh):
//   docker compose exec app node scripts/ki-anbieter-pruefen.mjs                 → Zugänge (nur ja/nein, Stufe, Region), Tor, Budget, Stufen
//   docker compose exec app node scripts/ki-anbieter-pruefen.mjs --token         → holt EIN Zugriffstoken bei Google (prüft das Dienstkonto; kostet nichts)
//   docker compose exec app node scripts/ki-anbieter-pruefen.mjs --bild "Beschreibung" --person <speichername> --ja
//                                                                                → EIN Bild über das Anbieter-Tor (ca. 3 Cent; Register/AVV/Budget gelten)
// Gibt nie Schlüssel, Projekt oder Konto aus. Ohne --ja wird nichts Kostenpflichtiges ausgelöst.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(wurzel);
process.env.TZ ??= 'Europe/Berlin';
const require = createRequire(import.meta.url);
const jiti = require('jiti')(fileURLToPath(import.meta.url), { alias: { '@': wurzel }, interopDefault: true, cache: false });
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null; };
const hat = (name) => process.argv.includes(`--${name}`);

const { konfigUebersicht, vertexKonfig } = jiti('../lib/ki/konfig.ts');
const { budgetStand, budgetLage, anbieterZustaende } = jiti('../lib/ki/tor.ts');
const { stufenSatzWirksam, stufenModelle } = jiti('../lib/ki/modelle.ts');

const k = konfigUebersicht();
console.log(`Anbieter-Tor: ${k.tor}`);
const zustand = await anbieterZustaende().catch(() => ({}));
for (const a of k.anbieter) console.log(`  ${a.id.padEnd(22)} eingerichtet: ${a.eingerichtet ? 'ja ' : 'nein'}  Stufe: ${a.stufe.padEnd(7)} Register: ${zustand[a.id]?.register ?? '?'}  (${a.region})`);
const b = await budgetStand().catch(() => null);
if (b) console.log(`Budget: ${budgetLage(b).text} · Grenze je Auftrag ${(b.auftragGrenzeCent / 100).toFixed(2)} € · Quelle ${b.quelle ?? 'keine'}`);
const s = stufenSatzWirksam(process.env, null);
console.log(`Modellstufen (Umgebung/Vorgabe): ${s.satz} → ${JSON.stringify(stufenModelle(process.env, null))}`);

if (hat('token')) {
  const v = vertexKonfig();
  if (!v) { console.log('Vertex: nicht eingerichtet.'); process.exit(1); }
  const { vertexToken } = jiti('../lib/ki/adapter/google-auth.ts');
  try { await vertexToken('google-vertex', v.konto); console.log('Vertex: Zugriffstoken erhalten — das Dienstkonto funktioniert.'); }
  catch (e) { console.log(`Vertex: kein Token (${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}).`); process.exit(1); }
}

const bild = arg('bild');
if (bild) {
  if (!hat('ja')) { console.log('Ein Bild kostet Geld (ca. 3 Cent) — mit --ja bestätigen.'); process.exit(1); }
  const person = arg('person');
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) { console.log('--person <speichername> fehlt.'); process.exit(1); }
  const { ladeKonten } = jiti('../lib/zugang/konten.ts');
  const konto = (await ladeKonten()).konten.find(x => x.speicher === person);
  if (!konto?.haushalt) { console.log('Konto ohne Haushalt.'); process.exit(1); }
  const { kiBild } = jiti('../lib/ki/aufruf.ts');
  const r = await kiBild({ ki: { lauf: 'aufruf', person, kategorien: ['allgemein'] }, haushalt: konto.haushalt, prompt: bild, zweck: 'ki-probe' });
  if (!r.ok) { const { kiSperrText } = jiti('../lib/anthropic.ts'); console.log(`Bild: nicht erzeugt (${r.error.startsWith('ki-gesperrt:') ? kiSperrText(r) : r.error}).`); process.exit(1); }
  console.log(`Bild: ${r.medien.length} abgelegt (${r.medien.map(m => `${m.mime}, ${m.bytes} Bytes, SynthID ${m.kennzeichnung.synthid ? 'ja' : 'nein'}, C2PA ${m.kennzeichnung.c2pa ? 'ja' : 'nein'}`).join('; ')}) · ${r.schaetzung.text}`);
}
