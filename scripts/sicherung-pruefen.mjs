#!/usr/bin/env node
// ─── MAKE OS · Einen Datenordner prüfen: entschlüsseln, parsen, zählen (29.09., Paket D-A #61/#88/#59) ─
// Aufruf: node scripts/sicherung-pruefen.mjs <ordner> [--json]
//   <ordner> = ein Datenordner (…/daten), z. B. der Schnappschuss der nächtlichen Sicherung
//   (deploy/sicherung.sh) oder ein entpacktes Archiv (deploy/sicherung-probe.sh).
// Prüft jeden Bestand (<name>.json: Hülle v1/v2 mit dem Schlüsselring, AAD = Name, JSON parsen,
// Datensätze zählen), das Archiv (archiv/*.json, AAD archiv/<datei>) und die Dateiablage
// (dateien/<haushalt>/*.bin, Hülle MKOSDAT1). Gibt NUR Zahlen und Bestandsnamen aus, nie Inhalte
// und nie Schlüssel. Exit 0 = alles lesbar, 2 = Fehler (falscher Schlüssel, defekte Datei).
// Seit 29.09. (Go-Live-Prüfung) nennt das Ergebnis bei Fehlern die DATEINAMEN (Bestand, archiv/<datei>,
// dateien/<haushalt>/<id>.bin — nie Inhalte): die Nachtsicherung behält das Archiv dann trotzdem und meldet
// „teilweise“ (deploy/sicherung.sh). Im JSON höchstens 25 Namen je Liste (`namenGekuerzt`), ohne Zählung je Bestand.
// Schlüssel wie die App: MAKE_OS_DATEN_SCHLUESSEL(_DATEI) und …_ALT(_DATEI) — ohne Schlüssel werden
// verschlüsselte Bestände als Fehler gezählt (Klartext-Ordner, z. B. lokal, gehen ohne).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { schluesselRing, huellenVersion, huelleOeffnen } from '../lib/store/huelle.mjs';
import { binVersion, binOeffnen, BILD_ORDNER, BILD_NAME } from '../lib/store/datei-huelle.mjs';

const ordner = process.argv[2];
const alsJson = process.argv.includes('--json');
if (!ordner) { console.error('Aufruf: node scripts/sicherung-pruefen.mjs <datenordner> [--json]'); process.exit(1); }
const ring = schluesselRing();
const t0 = Date.now();

/** Datensätze: Liste → Länge; Objekt → Summe seiner Listen (sonst 1). `_v` zählt nicht. */
const zaehle = x => Array.isArray(x) ? x.length : (x && typeof x === 'object' ? (Object.entries(x).filter(([k, v]) => k !== '_v' && Array.isArray(v)).reduce((s, [, l]) => s + l.length, 0) || 1) : 1);

function oeffne(roh, aad) {
  const o = JSON.parse(roh);
  const v = huellenVersion(o);
  if (!v) return { daten: o, version: 0 };
  return { daten: JSON.parse(huelleOeffnen(o, ring, aad).text), version: v };
}

const ergebnis = { zeit: new Date().toISOString(), bestaende: 0, datensaetze: 0, v2: 0, v1: 0, klartext: 0, fehler: 0, fehlerNamen: [], archiv: 0, archivFehler: 0, archivFehlerNamen: [], ablage: 0, ablageFehler: 0, ablageFehlerNamen: [], je: {} };

for (const n of (await fs.readdir(ordner).catch(() => [])).filter(n => n.endsWith('.json')).sort()) {
  const name = n.replace(/\.json$/, '');
  try {
    const r = oeffne(await fs.readFile(path.join(ordner, n), 'utf8'), name);
    const z = zaehle(r.daten);
    ergebnis.bestaende++; ergebnis.datensaetze += z; ergebnis.je[name] = z;
    if (r.version === 2) ergebnis.v2++; else if (r.version === 1) ergebnis.v1++; else ergebnis.klartext++;
  } catch { ergebnis.fehler++; ergebnis.fehlerNamen.push(name); }
}
for (const n of (await fs.readdir(path.join(ordner, 'archiv')).catch(() => [])).filter(n => n.endsWith('.json'))) {
  try { oeffne(await fs.readFile(path.join(ordner, 'archiv', n), 'utf8'), `archiv/${n}`); ergebnis.archiv++; }
  catch { ergebnis.archivFehler++; ergebnis.archivFehlerNamen.push(`archiv/${n}`); }
}
// Dateiablage: v1 „MKOSDAT1“ oder v2 „MKOSDAT2“ (Schlüssel-ID + AAD) — gemeinsamer Code lib/store/datei-huelle.mjs.
for (const h of await fs.readdir(path.join(ordner, 'dateien')).catch(() => [])) {
  for (const n of await fs.readdir(path.join(ordner, 'dateien', h)).catch(() => [])) {
    if (!n.endsWith('.bin')) continue;
    ergebnis.ablage++;
    const b = await fs.readFile(path.join(ordner, 'dateien', h, n));
    if (!binVersion(b)) continue;
    try { binOeffnen(b, ring, h, n.slice(0, -4)); } catch { ergebnis.ablageFehler++; ergebnis.ablageFehlerNamen.push(`dateien/${h}/${n}`); }
  }
}
// Bilder (05.10.): <ordner>/<name> mit derselben Hülle — zählen wie die Ablage (Klartext-Altbestand wird nur gezählt).
for (const o of BILD_ORDNER) {
  for (const n of await fs.readdir(path.join(ordner, o)).catch(() => [])) {
    if (!BILD_NAME.test(n)) continue;
    ergebnis.ablage++;
    const b = await fs.readFile(path.join(ordner, o, n));
    if (!binVersion(b)) continue;
    try { binOeffnen(b, ring, o, n); } catch { ergebnis.ablageFehler++; ergebnis.ablageFehlerNamen.push(`${o}/${n}`); }
  }
}
ergebnis.dauerMs = Date.now() - t0;
const gut = !ergebnis.fehler && !ergebnis.archivFehler && !ergebnis.ablageFehler;

if (alsJson) {
  const rest = { ...ergebnis }; delete rest.je; // Zählung je Bestand gehört nicht in den Status (die Durchsicht der App zählt je Bestand)
  const kurz = l => l.slice(0, 25);
  const gekuerzt = [ergebnis.fehlerNamen, ergebnis.archivFehlerNamen, ergebnis.ablageFehlerNamen].some(l => l.length > 25);
  console.log(JSON.stringify({ ...rest, fehlerNamen: kurz(rest.fehlerNamen), archivFehlerNamen: kurz(rest.archivFehlerNamen), ablageFehlerNamen: kurz(rest.ablageFehlerNamen), ...(gekuerzt ? { namenGekuerzt: true } : {}), ok: gut }));
}
else {
  for (const [name, z] of Object.entries(ergebnis.je)) console.log(`  ${name.padEnd(48)} ${String(z).padStart(7)}`);
  for (const name of [...ergebnis.fehlerNamen, ...ergebnis.archivFehlerNamen, ...ergebnis.ablageFehlerNamen]) console.log(`  ${name.padEnd(48)}  FEHLER (Schlüssel passt nicht oder Datei defekt)`);
  console.log(`\n  Bestände: ${ergebnis.bestaende + ergebnis.fehler} (v2 ${ergebnis.v2}, v1 ${ergebnis.v1}, Klartext ${ergebnis.klartext}, Fehler ${ergebnis.fehler}) · Datensätze gesamt: ${ergebnis.datensaetze}`);
  console.log(`  Archiv: ${ergebnis.archiv} lesbar, ${ergebnis.archivFehler} Fehler · Dateiablage: ${ergebnis.ablage} Dateien, ${ergebnis.ablageFehler} nicht entschlüsselbar`);
  console.log(gut ? '\n  ✓ Probe bestanden — alles lesbar.' : '\n  ✗ Probe NICHT bestanden — falscher Schlüssel (Archiv von vor einer Rotation? dann …_ALT setzen) oder defekte Dateien.');
}
process.exit(gut ? 0 : 2);
