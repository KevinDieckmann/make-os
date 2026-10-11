// ─── Update-Probe: Schnappschuss eines Datenordners (10.10.) ─────────────────────────────────────────────────────────────
// Liest JEDEN Bestand (`<ordner>/<name>.json`) entschlüsselt (Hülle v1/v2 über lib/store/huelle.mjs — dieselbe Funktion wie die App),
// dazu jede Datei darunter (Ablage `dateien/`, Bilder-Ordner, `archiv/`, Wissen) mit dem Fingerabdruck ihres Klartexts. Die Bilder je Bestand
// (Einträge, Fingerabdrücke) rechnet die reine Logik lib/betrieb/update-probe.ts (`bestandBild`). Nur lesen — schreibt nie in den Ordner.
// Nie auf echte Daten: der Aufrufer (scripts/update-probe.mjs) lehnt `.data` ab.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);
/** Nie verglichen: Lockfile, Index, Temp-Dateien; Tageskopien (backup/) rotieren und werden nur gezählt. */
const UEBERSPRINGEN = /(^|\/)(\.schreiber|\.DS_Store)$|(^|\/)brain-index[^/]*$|\.tmp[^/]*$|(^|\/)\.[^/]*-tmp/;

async function alleDateien(dir, basis = dir) {
  const aus = [];
  let eintraege = [];
  try { eintraege = await fs.readdir(dir, { withFileTypes: true }); } catch { return aus; }
  for (const e of eintraege) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) aus.push(...await alleDateien(p, basis));
    else if (e.isFile()) aus.push(path.relative(basis, p).split(path.sep).join('/'));
  }
  return aus;
}

/**
 * Schnappschuss des Ordners. `wurzel` = Repo, aus dem huelle.mjs/datei-huelle.mjs kommen (die neue Version liest v1 und v2);
 * `bestandBild` = die reine Funktion aus lib/betrieb/update-probe.ts.
 */
export async function schnappschuss(ordner, { wurzel, bestandBild }) {
  const huelle = await import(pathToFileURL(path.join(wurzel, 'lib/store/huelle.mjs')).href);
  const datei = await import(pathToFileURL(path.join(wurzel, 'lib/store/datei-huelle.mjs')).href);
  const ring = huelle.schluesselRing(process.env);
  const s = { ordner, zeit: new Date().toISOString(), bestaende: {}, dateien: {}, beschaedigt: [], tageskopien: 0 };
  for (const rel of (await alleDateien(ordner)).sort()) {
    if (UEBERSPRINGEN.test(rel)) continue;
    if (rel.startsWith('backup/')) { s.tageskopien++; continue; }
    const voll = path.join(ordner, rel);
    if (!rel.includes('/') && /\.json\.corrupt-/.test(rel)) { s.beschaedigt.push(rel); continue; }
    if (!rel.includes('/') && rel.endsWith('.json')) {
      const name = rel.slice(0, -5);
      try {
        const roh = await fs.readFile(voll, 'utf8');
        let o;
        try { o = JSON.parse(roh); } catch { s.bestaende[name] = { name, huelle: 0, mitV: false, lesbar: false, fehler: 'kein gültiges JSON', anzahl: 0, eintraege: {} }; continue; }
        const v = huelle.huellenVersion(o);
        const text = v ? huelle.huelleOeffnen(o, ring, name).text : roh;
        s.bestaende[name] = bestandBild(name, JSON.parse(text), v);
      } catch (e) {
        s.bestaende[name] = { name, huelle: 0, mitV: false, lesbar: false, fehler: e instanceof Error ? e.message.slice(0, 200) : String(e), anzahl: 0, eintraege: {} };
      }
      continue;
    }
    // Übrige Dateien: Form + Fingerabdruck des Klartexts (Hülle geöffnet, wenn möglich).
    const b = await fs.readFile(voll);
    let form = 'klar', klar = b, offen = true;
    const bv = datei.binVersion(b);
    if (bv) {
      form = bv === 2 ? 'MKOSDAT2' : 'MKOSDAT1';
      const ordnerName = path.basename(path.dirname(voll));
      const name = path.basename(voll);
      const kandidaten = [[ordnerName, name.replace(/\.[a-z0-9]+$/, '')], [ordnerName, name]];
      offen = false;
      for (const [h, id] of kandidaten) {
        try { klar = datei.binOeffnen(b, ring, h, id).klar; offen = true; break; } catch { /* nächste AAD */ }
      }
      if (!offen) klar = b;
    } else if (rel.endsWith('.json') && b.subarray(0, 64).toString('utf8').includes('"__verschluesselt"')) {
      try {
        const o = JSON.parse(b.toString('utf8'));
        const v = huelle.huellenVersion(o);
        if (v) {
          form = v === 2 ? 'huelle2' : 'huelle1';
          try { klar = Buffer.from(huelle.huelleOeffnen(o, ring, rel.replace(/\.json$/, '')).text, 'utf8'); }
          catch {
            try { klar = Buffer.from(huelle.huelleOeffnen(o, ring, path.basename(rel, '.json')).text, 'utf8'); } catch { offen = false; }
          }
        }
      } catch { /* bleibt klar */ }
    }
    if (form === 'klar' && rel.endsWith('.mkm')) form = 'medien'; // eigene Hülle der Fotos & Videos (Schlüssel je Medium) — Rohbytes verglichen
    s.dateien[rel] = { pfad: rel, groesse: b.length, form, inhalt: sha(klar), offen };
  }
  return s;
}
