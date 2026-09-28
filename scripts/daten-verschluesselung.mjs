#!/usr/bin/env node
// ─── MAKE OS · Bestände auf einmal ver- oder entschlüsseln (26.09., seit 29.09. v2-Hülle) ─
// Der Store verschlüsselt beim SCHREIBEN. Damit nach dem Einschalten nichts im Klartext liegen
// bleibt (auch Tagessicherungen, Archiv, Dateiablage), läuft dieses Skript einmal:
//   node scripts/daten-verschluesselung.mjs --verschluesseln   (alles in die v2-Hülle mit dem aktiven Schlüssel;
//                                                                v1-Hüllen und alte Schlüssel werden mit umgestellt)
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
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import net from 'node:net';
import { atomarSchreiben } from '../lib/store/atomar.mjs';
import { schluesselRing, huellenVersion, huelleSchreiben, huelleOeffnen } from '../lib/store/huelle.mjs';
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

let getan = 0, gelassen = 0, fehler = 0;
/** AAD je Datei: Bestandsname (Tagessicherung ohne Datum), im Archiv `archiv/<datei>` — wie lib/store/local-db.ts und archiv.ts. */
const aadVon = (ordner, n) => {
  if (path.basename(ordner) === 'archiv') return `archiv/${n}`;
  const name = n.replace(/\.json$/, '');
  return path.basename(ordner) === 'backup' ? name.replace(/-\d{4}-\d{2}-\d{2}$/, '') : name;
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
      if (v === 2 && o.kid === ring.aktiv.kid) { gelassen++; return; }
      const klar = v ? huelleOeffnen(o, ring, aad).text : roh;
      neu = huelleSchreiben(klar, ring.aktiv, aad);
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

// Dateiablage (28.09., lib/dateien/ablage.ts): dateien/<haushalt>/<id>.bin — Hülle = „MKOSDAT1“ + IV (12) + Tag (16) + Chiffrat.
// Das Format kennt keine Schlüssel-ID: beim Lesen werden alle Schlüssel des Rings probiert (aktiv zuerst).
const MAGIE = Buffer.from('MKOSDAT1', 'ascii');
const binHuelle = b => b.length >= MAGIE.length + 28 && b.subarray(0, MAGIE.length).equals(MAGIE);
function binOeffnen(roh) {
  for (const s of ring.alle) {
    try { const d = createDecipheriv('aes-256-gcm', s.key, roh.subarray(8, 20)); d.setAuthTag(roh.subarray(20, 36)); return { klar: Buffer.concat([d.update(roh.subarray(36)), d.final()]), kid: s.kid }; }
    catch { /* nächster Schlüssel */ }
  }
  return null;
}
const binSchreiben = klar => { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', ring.aktiv.key, iv); const e = Buffer.concat([c.update(klar), c.final()]); return Buffer.concat([MAGIE, iv, c.getAuthTag(), e]); };
async function ablageDatei(p) {
  const roh = await fs.readFile(p);
  let neu = null;
  if (binHuelle(roh)) {
    const o = binOeffnen(roh);
    if (!o) { fehler++; console.error('Schlüssel passt nicht:', p); return; }
    if (modus === '--entschluesseln') neu = o.klar;
    else if (o.kid !== ring.aktiv.kid) neu = binSchreiben(o.klar);
  } else if (modus === '--verschluesseln') neu = binSchreiben(roh);
  if (neu === null) { gelassen++; return; }
  await atomarSchreiben(p, neu);
  getan++;
}
for (const h of await fs.readdir(path.join(DATEN, 'dateien')).catch(() => [])) {
  const ordner = path.join(DATEN, 'dateien', h);
  for (const n of await fs.readdir(ordner).catch(() => [])) if (/^d-[a-z0-9-]+\.bin$/.test(n)) await ablageDatei(path.join(ordner, n));
}
console.log(`${modus.slice(2)}: ${getan} Dateien umgestellt, ${gelassen} schon passend, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
