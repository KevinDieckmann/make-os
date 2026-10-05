#!/usr/bin/env node
// ─── MAKE OS — Demo-Instanz säen (05.10.) ───────────────────────────────────────────────────────────────────────────────
// Legt in einem LEEREN, eigenen Datenordner eine vollständig erfundene Demo an (lib/demo/saat.ts — über die bestehenden
// Schreibwege). Bricht ab, wenn MAKE_OS_DATEN_DIR fehlt, nach unserem echten Datenordner aussieht (`.data`) oder nicht leer ist.
// Anleitung: DEMO.md.
//
//   MAKE_OS_DATEN_DIR=/pfad/demo/daten MAKE_VAULT_DIR=/pfad/demo/daten/wissen MAKE_OS_KEY=… \
//   MAKE_OS_DATEN_SCHLUESSEL=… NEXT_PUBLIC_MAKE_OS_EINHEITEN='{…}' node scripts/demo-saat.mjs
//
// Passwort beider Demo-Konten: MAKE_OS_DEMO_PASSWORT (≥ 10 Zeichen) — fehlt es, wird eines erzeugt und NUR in die Datei
// `<datenordner>.zugang.txt` (neben dem Datenordner, Rechte 600) geschrieben, nie auf die Konsole.

import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(wurzel);
process.env.TZ ??= 'Europe/Berlin';
process.env.MAKE_OS_OHNE_APPLE ??= '1';

const require = createRequire(import.meta.url);
const jiti = require('jiti')(fileURLToPath(import.meta.url), { alias: { '@': wurzel }, interopDefault: true, cache: false });

const dir = process.env.MAKE_OS_DATEN_DIR?.trim();
const passwort = process.env.MAKE_OS_DEMO_PASSWORT?.trim() || randomBytes(12).toString('base64url');
if (passwort.length < 10) { console.error('MAKE_OS_DEMO_PASSWORT: mindestens 10 Zeichen.'); process.exit(1); }

const { demoSaenInLeerenOrdner, DemoGesperrt } = jiti('../lib/demo/server.ts');
try {
  const b = await demoSaenInLeerenOrdner({ passwort });
  if (!process.env.MAKE_OS_DEMO_PASSWORT) {
    const datei = `${path.resolve(dir)}.zugang.txt`;
    writeFileSync(datei, `${b.personen.map(p => `${p.name}\t${p.email}`).join('\n')}\nPasswort (beide Konten)\t${passwort}\n`, { mode: 0o600 });
    console.log(`Zugang: ${datei}`);
  }
  console.log(`Demo gesät (${b.heute}) in ${dir}`);
  for (const s of b.schritte) console.log(`  ${s.name}: ${s.anzahl}`);
  console.log(`Konten: ${b.personen.map(p => p.email).join(', ')}`);
  if (b.hinweise.length) {
    console.log('\nVor dem Start der Demo-Instanz beachten:');
    for (const h of b.hinweise) console.log(`  · ${h}`);
  }
  process.exit(0);
} catch (e) {
  if (e instanceof DemoGesperrt) { console.error('Abgebrochen:'); for (const g of e.gruende) console.error(`  · ${g}`); process.exit(2); }
  console.error('Fehler:', e instanceof Error ? e.message : e);
  process.exit(1);
}
