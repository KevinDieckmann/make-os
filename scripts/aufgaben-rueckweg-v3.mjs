#!/usr/bin/env node
// ─── MAKE OS · Rückweg Aufgaben-Umbau v3 (07.10.2026) ────────────────────────────────────────────────────────────────────────
// Der Umbau v3 (Malins Bauplan-Karte: Gruppen → Listen, Listen → Aufgaben, lib/aufgaben/umbau-gruppen.ts) legt vor dem ersten
// Schreiben EINMAL die Archiv-Kopie `archiv/tasks-vor-umbau-v3-<zeit>.json` ab. Dieses Werkzeug spielt sie als Bestand `tasks`
// zurück — NUR zusammen mit dem Zurückrollen des Programms auf den Stand VOR dem Umbau (altes Image), sonst baut der neue Stand
// die Gruppen beim nächsten Lesen sofort wieder um. Änderungen nach dem Upload gehen dabei verloren (vorher Aufgaben › Export).
//
//   node scripts/aufgaben-rueckweg-v3.mjs                      Trockenlauf (Vorgabe): zeigt Kopie und heutigen Stand (nur Zahlen)
//   node scripts/aufgaben-rueckweg-v3.mjs --datei <name>       eine bestimmte Kopie statt der jüngsten
//   node scripts/aufgaben-rueckweg-v3.mjs --ausfuehren         sichert den heutigen Stand ins Archiv, schreibt dann die Kopie
//
// NIE bei laufender App (Lockfile `<daten>/.schreiber`). Auf dem Server (Reihenfolge):
//   cd /srv/make-os/app && docker compose stop app arbeiter
//   docker compose run --rm -T --no-deps app node scripts/aufgaben-rueckweg-v3.mjs </dev/null
//   docker compose run --rm -T --no-deps app node scripts/aufgaben-rueckweg-v3.mjs --ausfuehren </dev/null
//   altes Image starten (deploy/ausrollen.sh mit dem Stand vor dem Umbau) — erst dann ist die Gruppen-Ordnung zurück.
// Die Kopie wird mit AAD `archiv/<datei>` geöffnet und als `tasks` (AAD `tasks`) neu verschlüsselt — nie die Datei kopieren.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomarSchreiben } from '../lib/store/atomar.mjs';
import { schluesselRing, huellenVersion, huelleImModus, huelleOeffnen } from '../lib/store/huelle.mjs';
import { skriptSperreOderAbbruch } from '../lib/store/schreiber.mjs';

export const KOPIE = /^tasks-vor-umbau-v3-[\w-]+\.json$/;

/** Rein: die jüngste passende Kopie (Zeitstempel im Namen sortiert lexikalisch) oder die genannte, wenn sie passt. */
export function kopieWaehlen(dateien, gewuenscht) {
  if (gewuenscht) return KOPIE.test(gewuenscht) && dateien.includes(gewuenscht) ? gewuenscht : null;
  return dateien.filter(d => KOPIE.test(d)).sort().at(-1) ?? null;
}

/** Rein: Zahlen eines Aufgaben-Bestands — nur Längen der Listen-Felder und der Umbau-Merker, nie Titel. */
export function zahlen(bestand) {
  if (!bestand || typeof bestand !== 'object') return { leer: true };
  const z = {};
  for (const [k, v] of Object.entries(bestand)) if (Array.isArray(v)) z[k] = v.length;
  z.umbauVersion = bestand.umbauVersion ?? 0;
  return z;
}

function oeffnen(roh, ring, aad) {
  const o = JSON.parse(roh);
  return JSON.parse(huellenVersion(o) ? huelleOeffnen(o, ring, aad).text : roh);
}

async function haupt() {
  const args = process.argv.slice(2);
  const schreiben = args.includes('--ausfuehren');
  const i = args.indexOf('--datei');
  const gewuenscht = i >= 0 ? args[i + 1] : undefined;
  const ring = schluesselRing();
  const DATEN = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');
  const ARCHIV = path.join(DATEN, 'archiv');
  await skriptSperreOderAbbruch(DATEN, 'aufgaben-rueckweg-v3');
  const dateien = await fs.readdir(ARCHIV).catch(() => []);
  const datei = kopieWaehlen(dateien, gewuenscht);
  if (!datei) { console.log(gewuenscht ? `Kopie „${gewuenscht}“ gibt es nicht (erwartet: tasks-vor-umbau-v3-<zeit>.json).` : 'Keine Archiv-Kopie tasks-vor-umbau-v3-*.json gefunden — der Umbau lief hier noch nie.'); process.exitCode = 1; return; }
  const kopie = oeffnen(await fs.readFile(path.join(ARCHIV, datei), 'utf8'), ring, `archiv/${datei}`);
  const tasksPfad = path.join(DATEN, 'tasks.json');
  const heuteRoh = await fs.readFile(tasksPfad, 'utf8').catch(e => { if (e?.code === 'ENOENT') return null; throw e; });
  const heute = heuteRoh === null ? null : oeffnen(heuteRoh, ring, 'tasks');
  console.log(schreiben ? 'AUSFÜHREN' : 'TROCKENLAUF (nichts geschrieben — mit --ausfuehren schreiben)');
  console.log(`Kopie: ${datei}`, JSON.stringify(zahlen(kopie)));
  console.log('Heute:', JSON.stringify(zahlen(heute)));
  console.log('Hinweis: wirkt nur zusammen mit dem Programmstand VOR dem Umbau — sonst baut der neue Stand sofort wieder um.');
  if (!schreiben) return;
  if (heuteRoh !== null) {
    const zeit = new Date().toISOString().replace(/[:.]/g, '-');
    const sicher = `tasks-vor-rueckweg-v3-${zeit}.json`;
    const text = JSON.stringify(heute);
    await atomarSchreiben(path.join(ARCHIV, sicher), ring.aktiv ? huelleImModus(text, ring.aktiv, `archiv/${sicher}`) : text);
    console.log(`heutiger Stand gesichert: archiv/${sicher}`);
  }
  const text = JSON.stringify(kopie, null, 2);
  await atomarSchreiben(tasksPfad, ring.aktiv ? huelleImModus(text, ring.aktiv, 'tasks') : text);
  console.log('geschrieben: tasks (aus der Archiv-Kopie)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await haupt();
