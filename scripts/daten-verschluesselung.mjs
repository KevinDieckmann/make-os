#!/usr/bin/env node
// ─── MAKE OS · Bestände auf einmal ver- oder entschlüsseln (26.09.) ─────────
// Der Store verschlüsselt beim SCHREIBEN. Damit nach dem Einschalten nichts im
// Klartext liegen bleibt (auch die Tagessicherungen), läuft dieses Skript einmal:
//   node scripts/daten-verschluesselung.mjs --verschluesseln   (Schlüssel aus MAKE_OS_DATEN_SCHLUESSEL)
//   node scripts/daten-verschluesselung.mjs --entschluesseln   (Notfall/Umzug: alles zurück in Klartext)
// Auf dem Server: docker compose exec app node scripts/daten-verschluesselung.mjs --verschluesseln
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const modus = process.argv[2];
if (!['--verschluesseln', '--entschluesseln'].includes(modus ?? '')) { console.error('Aufruf: --verschluesseln | --entschluesseln'); process.exit(1); }
const geheim = (process.env.MAKE_OS_DATEN_SCHLUESSEL ?? '').trim();
if (!geheim) { console.error('MAKE_OS_DATEN_SCHLUESSEL fehlt in der Umgebung.'); process.exit(1); }
const key = createHash('sha256').update(`make-os-daten:${geheim}`).digest();
const H = '__verschluesselt';
const DATEN = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');

const ver = t => { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); const e = Buffer.concat([c.update(t, 'utf8'), c.final()]); return JSON.stringify({ [H]: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), daten: e.toString('base64') }); };
const ent = o => { const d = createDecipheriv('aes-256-gcm', key, Buffer.from(o.iv, 'base64')); d.setAuthTag(Buffer.from(o.tag, 'base64')); return Buffer.concat([d.update(Buffer.from(o.daten, 'base64')), d.final()]).toString('utf8'); };

let getan = 0, gelassen = 0, fehler = 0;
async function datei(p) {
  const roh = await fs.readFile(p, 'utf8');
  let o; try { o = JSON.parse(roh); } catch { fehler++; console.error('kein JSON:', p); return; }
  const istHuelle = o && typeof o === 'object' && o[H] === 1;
  let neu = null;
  if (modus === '--verschluesseln' && !istHuelle) neu = ver(roh);
  if (modus === '--entschluesseln' && istHuelle) { try { neu = ent(o); } catch { fehler++; console.error('Schlüssel passt nicht:', p); return; } }
  if (neu === null) { gelassen++; return; }
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, neu, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, p); getan++;
}
for (const ordner of [DATEN, path.join(DATEN, 'backup')]) {
  const namen = await fs.readdir(ordner).catch(() => []);
  for (const n of namen) if (n.endsWith('.json')) await datei(path.join(ordner, n));
}

// Dateiablage (28.09., lib/dateien/ablage.ts): dateien/<haushalt>/<id>.bin — Hülle = „MKOSDAT1“ + IV (12) + Tag (16) + Chiffrat.
const MAGIE = Buffer.from('MKOSDAT1', 'ascii');
const binHuelle = b => b.length >= MAGIE.length + 28 && b.subarray(0, MAGIE.length).equals(MAGIE);
async function ablageDatei(p) {
  const roh = await fs.readFile(p);
  let neu = null;
  if (modus === '--verschluesseln' && !binHuelle(roh)) { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); const e = Buffer.concat([c.update(roh), c.final()]); neu = Buffer.concat([MAGIE, iv, c.getAuthTag(), e]); }
  if (modus === '--entschluesseln' && binHuelle(roh)) {
    try { const d = createDecipheriv('aes-256-gcm', key, roh.subarray(8, 20)); d.setAuthTag(roh.subarray(20, 36)); neu = Buffer.concat([d.update(roh.subarray(36)), d.final()]); }
    catch { fehler++; console.error('Schlüssel passt nicht:', p); return; }
  }
  if (neu === null) { gelassen++; return; }
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, neu, { mode: 0o600 });
  await fs.rename(tmp, p); getan++;
}
for (const h of await fs.readdir(path.join(DATEN, 'dateien')).catch(() => [])) {
  const ordner = path.join(DATEN, 'dateien', h);
  for (const n of await fs.readdir(ordner).catch(() => [])) if (/^d-[a-z0-9-]+\.bin$/.test(n)) await ablageDatei(path.join(ordner, n));
}
console.log(`${modus.slice(2)}: ${getan} Dateien umgestellt, ${gelassen} schon passend, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
