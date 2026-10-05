#!/usr/bin/env node
// ─── MAKE OS · Bestände auf einmal ver- oder entschlüsseln (26.09., seit 29.09. v2-Hülle) ─
// Der Store verschlüsselt beim SCHREIBEN. Damit nach dem Einschalten nichts im Klartext liegen
// bleibt (auch Tagessicherungen, Archiv, Dateiablage, seit 05.10. Bilder), läuft dieses Skript einmal:
//   node scripts/daten-verschluesselung.mjs --verschluesseln   (alles in die Hülle des Schreibformats MAKE_OS_FORMAT mit
//                                                                dem aktiven Schlüssel: kompatibel (Standard) = v1 wie der
//                                                                alte Online-Stand aeb4964, v2 = Schlüssel-ID + AAD; Hüllen
//                                                                im anderen Format und alte Schlüssel werden mit umgestellt)
//   node scripts/daten-verschluesselung.mjs --entschluesseln   (Notfall/Umzug: alles zurück in Klartext)
// Schlüssel: MAKE_OS_DATEN_SCHLUESSEL bzw. MAKE_OS_DATEN_SCHLUESSEL_DATEI (aktiv), zum Lesen alter
// Hüllen zusätzlich MAKE_OS_DATEN_SCHLUESSEL_ALT / …_ALT_DATEI (lib/store/huelle.mjs).
//
// NIE bei laufender App (Paket D-A #9): das Skript liest einen Bestand, die App schreibt eine neue
// Fassung, das Skript benennt seine ältere darüber — die Änderung wäre still verloren. Deshalb bricht
// es ab, solange eine lebende App den Datenordner hält (Lockfile `<daten>/.schreiber`).
// Auf dem Server:
//   cd /srv/make-os/app && docker compose stop app arbeiter
//   docker compose run --rm -T --no-deps app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null
//   docker compose up -d
// (Für eine Rotation OHNE Unterbrechung: scripts/datenschluessel-rotieren-live.mjs.)
import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { atomarSchreiben } from '../lib/store/atomar.mjs';
import { schluesselRing, huellenVersion, huelleImModus, huelleOeffnen, huelleAktuell, formatModus } from '../lib/store/huelle.mjs';
import { binVersion, binOeffnen, binImModus, binAktuell, BILD_ORDNER, BILD_NAME } from '../lib/store/datei-huelle.mjs';
import { skriptSperreOderAbbruch } from '../lib/store/schreiber.mjs';

const modus = process.argv[2];
if (!['--verschluesseln', '--entschluesseln'].includes(modus ?? '')) { console.error('Aufruf: --verschluesseln | --entschluesseln'); process.exit(1); }
const ring = schluesselRing();
if (!ring.aktiv) { console.error('MAKE_OS_DATEN_SCHLUESSEL (bzw. …_DATEI) fehlt in der Umgebung.'); process.exit(1); }
const DATEN = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');

// Lebende App auf demselben Datenordner → Abbruch (Lockfile, Paket D-A #9).
await skriptSperreOderAbbruch(DATEN, 'daten-verschluesselung');

// Zusätzlich (28.09., K1 #40) eine Warnung für Apps ohne Lockfile (ältere Stände): Dev-Server (3001), Prüfbau (3011)
// und ein lokaler Start (3000) teilen sich `.data`. MAKE_OS_PRUEF_PORTE (Komma-Liste) biegt die Ports für Tests um.
const PORTE = (process.env.MAKE_OS_PRUEF_PORTE ?? '3000,3001,3011').split(',').map(Number).filter(p => Number.isInteger(p) && p > 0);
const belegt = p => new Promise(ok => {
  const s = net.connect({ port: p, host: '127.0.0.1' });
  const fertig = x => { s.destroy(); ok(x); };
  s.setTimeout(400, () => fertig(false));
  s.once('connect', () => fertig(true));
  s.once('error', () => fertig(false));
});
const laufend = (await Promise.all(PORTE.map(async p => ((await belegt(p)) ? p : null)))).filter(Boolean);
if (laufend.length) console.warn(`WARNUNG: Auf Port ${laufend.join(', ')} läuft eine App — Dev-Server/Prüfbau teilen denselben Datenordner. Erst anhalten, sonst kann sie mitten in der Umstellung schreiben.`);
if (modus === '--verschluesseln') console.log(`Schreibformat: ${formatModus() === 'v2' ? 'v2 (Schlüssel-ID + AAD, „MKOSDAT2“)' : 'kompatibel (v1, „MKOSDAT1“ — alter Stand aeb4964 kann lesen)'} — MAKE_OS_FORMAT`);

let getan = 0, gelassen = 0, fehler = 0;
// ZOE hieß bis 27.09. Jarvis (Go-Live-Prüfung 29.09.): die App übernimmt `jarvis-X.json` beim ersten Lesen als `zoe-X.json`.
// Die v2-Hülle bindet den Bestandsnamen als AAD — darum hier VOR dem Verschlüsseln umbenennen (wenn noch kein `zoe-X`
// liegt) und sonst als AAD immer den Zielnamen `zoe-…` nehmen. Lesen bleibt tolerant (huelle.mjs `aadAlternativen`).
const zielName = name => name.replace(/^jarvis(?=-|$)/, 'zoe');
for (const n of await fs.readdir(DATEN).catch(() => [])) {
  if (!/^jarvis(-[a-z0-9-]*)?\.json$/.test(n)) continue;
  const ziel = path.join(DATEN, `${zielName(n.replace(/\.json$/, ''))}.json`);
  try { await fs.link(path.join(DATEN, n), ziel); await fs.unlink(path.join(DATEN, n)); console.log(`umbenannt: ${n} → ${path.basename(ziel)}`); }
  catch (e) { if (e?.code !== 'EEXIST') { fehler++; console.error('nicht umbenannt:', n); } }
}
/** AAD je Datei: Bestandsname (Tagessicherung ohne Datum), im Archiv `archiv/<datei>` — wie lib/store/local-db.ts und archiv.ts. */
const aadVon = (ordner, n) => {
  if (path.basename(ordner) === 'archiv') return `archiv/${n}`;
  const name = n.replace(/\.json$/, '');
  return zielName(path.basename(ordner) === 'backup' ? name.replace(/-\d{4}-\d{2}-\d{2}$/, '') : name);
};
async function datei(ordner, n) {
  const p = path.join(ordner, n);
  const roh = await fs.readFile(p, 'utf8');
  let o; try { o = JSON.parse(roh); } catch { fehler++; console.error('kein JSON:', p); return; }
  const v = huellenVersion(o);
  const aad = aadVon(ordner, n);
  let neu = null;
  try {
    if (modus === '--verschluesseln') {
      // Format des Modus, aktueller Schlüssel und (v2) richtige AAD (unter dem Altnamen jarvis-… verschlüsselt → neu schreiben).
      if (huelleAktuell(o, ring, aad)) { gelassen++; return; }
      const klar = v ? huelleOeffnen(o, ring, aad).text : roh;
      neu = huelleImModus(klar, ring.aktiv, aad);
    } else if (v) neu = huelleOeffnen(o, ring, aad).text;
  } catch { fehler++; console.error('Schlüssel passt nicht:', p); return; }
  if (neu === null) { gelassen++; return; }
  await atomarSchreiben(p, neu);
  getan++;
}
// Archiv-Kopien (28.09., lib/store/archiv.ts) liegen wie die Bestände als Hülle — alte Klartext-Kopien hier einmal umstellen.
for (const ordner of [DATEN, path.join(DATEN, 'backup'), path.join(DATEN, 'archiv')]) {
  const namen = await fs.readdir(ordner).catch(() => []);
  for (const n of namen) if (n.endsWith('.json')) await datei(ordner, n);
}

// Dateiablage (lib/dateien/ablage.ts): dateien/<haushalt>/<id>.bin — Hülle v1 „MKOSDAT1“ (ohne Schlüssel-ID) oder seit
// 29.09. v2 „MKOSDAT2“ (Schlüssel-ID + AAD Haushalt/Kennung), gemeinsamer Code in lib/store/datei-huelle.mjs.
// Beim Lesen: v2 nach Schlüssel-ID, v1 mit allen Schlüsseln des Rings (aktiv zuerst). Geschrieben wird im Format des Modus.
async function ablageDatei(p, haushalt, id) {
  const roh = await fs.readFile(p);
  let neu = null;
  if (binVersion(roh)) {
    let o;
    try { o = binOeffnen(roh, ring, haushalt, id); } catch { fehler++; console.error('Schlüssel passt nicht:', p); return; }
    if (modus === '--entschluesseln') neu = o.klar;
    else if (!binAktuell(o, ring.aktiv)) neu = binImModus(o.klar, ring.aktiv, haushalt, id);
  } else if (modus === '--verschluesseln') neu = binImModus(roh, ring.aktiv, haushalt, id);
  if (neu === null) { gelassen++; return; }
  await atomarSchreiben(p, neu);
  getan++;
}
for (const h of await fs.readdir(path.join(DATEN, 'dateien')).catch(() => [])) {
  const ordner = path.join(DATEN, 'dateien', h);
  for (const n of await fs.readdir(ordner).catch(() => [])) if (/^d-[a-z0-9-]+\.bin$/.test(n)) await ablageDatei(path.join(ordner, n), h, n.slice(0, -4));
}
// Bilder (05.10., lib/store/bild-ablage.ts): <ordner>/<name> — dieselbe Hülle, AAD <ordner>/<name>. Alte Klartext-Fotos werden
// hier auf einmal verschlüsselt (die App täte es beim ersten Lesen); --entschluesseln vor einem Rückweg auf den alten Stand.
for (const o of BILD_ORDNER) {
  for (const n of await fs.readdir(path.join(DATEN, o)).catch(() => [])) if (BILD_NAME.test(n)) await ablageDatei(path.join(DATEN, o, n), o, n);
}
console.log(`${modus.slice(2)}: ${getan} Dateien umgestellt, ${gelassen} schon passend, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
