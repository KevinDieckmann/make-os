#!/usr/bin/env node
// ─── MAKE OS · Einzel-Restore aus einer Tageskopie (29.09., Paket D-A #63) ────────
// Dünner Aufruf der Route /api/intern/wiederherstellen über den Dienstweg — die Logik (Vorschau, Stand-Prüfung,
// Schreibsperre, Protokoll) liegt EINMAL in lib/store/wiederherstellen.ts; die App läuft dabei weiter.
//
//   node scripts/einzel-wiederherstellen.mjs <bestand>                        → vorhandene Tageskopien
//   node scripts/einzel-wiederherstellen.mjs <bestand> <tag>                  → Vorschau (Kennungen, Stände, Feldnamen)
//   node scripts/einzel-wiederherstellen.mjs <bestand> <tag> <liste> <id>…    → diese Datensätze übernehmen
//     (der Stand je Kennung kommt aus der Vorschau; hat sich der Eintrag seitdem geändert → 409, nichts geschrieben)
// Auf dem Server:  docker compose exec -T app node scripts/einzel-wiederherstellen.mjs crm 2026-09-28
// Lokal: MAKE_OS_URL (Vorgabe http://localhost:3001), Schlüssel aus MAKE_OS_KEY bzw. .env.local (nie ausgegeben).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (process.env.MAKE_OS_URL ?? (process.env.NODE_ENV === 'production' ? 'http://localhost:3000' : 'http://localhost:3001')).replace(/\/$/, '');
function schluessel() {
  if (process.env.MAKE_OS_KEY) return process.env.MAKE_OS_KEY;
  const datei = path.join(wurzel, '.env.local');
  if (!existsSync(datei)) return null;
  const zeile = readFileSync(datei, 'utf8').split('\n').find(z => /^\s*MAKE_OS_KEY\s*=/.test(z));
  return zeile ? zeile.replace(/^\s*MAKE_OS_KEY\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') : null;
}
const key = schluessel();
if (!key) { console.error('MAKE_OS_KEY fehlt (Umgebung oder .env.local).'); process.exit(1); }
const [bestand, tag, liste, ...ids] = process.argv.slice(2);
if (!bestand) { console.error('Aufruf: <bestand> [tag] [liste id…]'); process.exit(1); }
const kopf = { 'x-make-key': key, 'content-type': 'application/json' };
const holen = async (q) => (await fetch(`${url}/api/intern/wiederherstellen?${new URLSearchParams(q)}`, { headers: kopf })).json();

if (!tag) {
  const r = await holen({ bestand });
  console.log(r.ok ? `Tageskopien von ${bestand}: ${r.tage.join(', ') || '— keine —'}` : r.fehler);
  process.exit(r.ok ? 0 : 1);
}
const v = await holen({ bestand, tag });
if (!v.ok) { console.error(v.fehler); process.exit(1); }
if (liste === undefined) {
  for (const l of v.listen) {
    console.log(`\n${l.liste || '(Wurzel)'}: ${l.gleich} gleich · ${l.geaendert.length} geändert · ${l.nurInKopie.length} seitdem gelöscht${l.wiederbelebenErlaubt ? '' : ' (nicht wiederherstellbar)'} · ${l.neuSeitdem} seitdem neu`);
    for (const g of l.geaendert) console.log(`  geändert  ${g.id}  [${g.felder.join(', ')}]`);
    for (const g of l.nurInKopie) console.log(`  gelöscht  ${g.id}`);
  }
  process.exit(0);
}
const l = v.listen.find(x => x.liste === liste);
if (!l) { console.error(`Liste „${liste}“ gibt es in der Kopie nicht.`); process.exit(1); }
const auswahl = {};
for (const id of ids) {
  const g = l.geaendert.find(x => x.id === id);
  if (g) auswahl[id] = g.stand; else if (l.nurInKopie.some(x => x.id === id)) auswahl[id] = null;
  else { console.error(`${id}: unverändert oder nicht in der Kopie — übersprungen.`); }
}
if (!Object.keys(auswahl).length) process.exit(1);
const r = await (await fetch(`${url}/api/intern/wiederherstellen`, { method: 'POST', headers: kopf, body: JSON.stringify({ bestand, tag, liste, auswahl }) })).json();
console.log(r.ok ? `${r.uebernommen} Datensätze übernommen (protokolliert).` : `Nicht übernommen: ${r.fehler}${r.konflikte ? ` (${r.konflikte.join(', ')})` : ''}`);
process.exit(r.ok ? 0 : 1);
