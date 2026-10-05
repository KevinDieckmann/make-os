#!/usr/bin/env node
// ─── Instanz löschen bei Vertragsende (05.10., Paket „Betroffenenrechte v2“; AVV § 11, LOESCHKONZEPT.md › 6) ─────────────
// NIE automatisch, nie aus der App. Zuerst der Instanz-Export (System › Datenschutz, nur Inhaber), dann dieses Skript:
//
//   1) Trockenlauf (Vorgabe):  node scripts/instanz-loeschen.mjs --ordner /srv/make-os/<kunde>/daten
//        → zeigt, was gelöscht würde (Datenordner, Grabstein-Ordner), nennt die Sicherungen samt dem Tag, an dem sie spätestens
//          überschrieben sind, und gibt einen BESTÄTIGUNGS-CODE aus (gilt nur heute und nur für genau diesen Stand des Ordners).
//   2) Ausführen:              node scripts/instanz-loeschen.mjs --ordner … --ausfuehren --code <CODE> [--bericht <datei>]
//        → löscht Datenordner und Grabstein-Ordner, schreibt eine Löschbestätigung (Text) für den Kunden.
//
// Weitere Schalter: --grabsteine <ordner> (sonst MAKE_OS_GRABSTEINE_DIR bzw. „<ordner>-grabsteine“), --sicherungen <ordner> (Nachtarchive;
// sonst /srv/make-os/sicherungen, wenn vorhanden). Sicherungen löscht das Skript NIE einzeln (sie enthalten mehrere Instanzen bzw. werden
// nach Frist überschrieben) — es nennt sie. Schlüssel (Datenschlüssel, Pepper, age-Identität) danach im Passwort-Manager löschen: dann
// sind auch Restkopien unlesbar („crypto-shredding“). Bricht ab, wenn eine App den Ordner hält (Lockfile), und fasst den lokalen
// Datenordner dieses Rechners (`.data` im Arbeitsordner) nie an.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { skriptSperreOderAbbruch } from '../lib/store/schreiber.mjs';

const GEN = { taeglich: 14, woechentlich: 8, monatlich: 12 }; // wie deploy/generationen.sh (Wächter: tests/datenschutz-sicherungsfrist.test.ts)

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}
const hat = name => process.argv.includes(name);
const tag = (d = new Date()) => d.toISOString().slice(0, 10);
const plusMonate = (t, n) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return tag(d); };
function abbruch(text, code = 2) { console.error(`ABBRUCH: ${text}`); process.exit(code); }

async function zaehlen(ordner) {
  let dateien = 0, bytes = 0;
  const lauf = async d => {
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await lauf(p);
      else if (e.isFile()) { dateien++; bytes += (await fs.stat(p).catch(() => ({ size: 0 }))).size; }
    }
  };
  await lauf(ordner);
  return { dateien, bytes };
}
const mb = b => `${(b / 1_048_576).toFixed(1)} MB`;

/** Bestätigungs-Code: hängt am Pfad, am Tag und am Stand (Zahl/Größe der Dateien) — ändert sich der Ordner, gilt er nicht mehr. */
function bestaetigungsCode(real, stand, heute = tag()) {
  return createHash('sha256').update(`make-os-instanz-loeschen|${real}|${heute}|${stand.dateien}|${stand.bytes}`).digest('hex').slice(0, 8).toUpperCase();
}

const roh = arg('--ordner');
if (!roh) abbruch('--ordner <Datenordner der Instanz> fehlt (bewusst ohne Vorgabe).');
const ordner = path.resolve(roh);
let real;
try { real = await fs.realpath(ordner); } catch { abbruch(`Ordner nicht gefunden: ${ordner}`); }
const st = await fs.stat(real);
if (!st.isDirectory()) abbruch(`Kein Ordner: ${real}`);
const lokal = await fs.realpath(path.join(process.cwd(), '.data')).catch(() => null);
if (real === lokal || path.basename(real) === '.data') abbruch('Den lokalen Datenordner (.data) löscht dieses Skript nie.');
if (real === path.parse(real).root || real === process.env.HOME || real === process.cwd()) abbruch(`Unsicherer Pfad: ${real}`);
// Nur ein MAKE-OS-Datenordner: Konten-Bestand oder System-Ordner muss da sein.
const merkmal = (await fs.access(path.join(real, 'konten.json')).then(() => true, () => false)) || (await fs.access(path.join(real, 'system')).then(() => true, () => false));
if (!merkmal) abbruch(`${real} sieht nicht wie ein MAKE-OS-Datenordner aus (keine konten.json, kein system/).`);

await skriptSperreOderAbbruch(real, 'instanz-loeschen');

const grabRoh = arg('--grabsteine') || process.env.MAKE_OS_GRABSTEINE_DIR || `${real.replace(/[\\/]+$/, '')}-grabsteine`;
const grab = path.resolve(grabRoh);
const grabDa = await fs.stat(grab).then(s => s.isDirectory(), () => false);
const sichRoh = arg('--sicherungen') || '/srv/make-os/sicherungen';
const sich = path.resolve(sichRoh);
const archive = (await fs.readdir(sich).catch(() => [])).filter(n => /^make-os-\d{4}-\d{2}-\d{2}\.tar\.gz(\.age|\.enc)?$/.test(n)).sort();

const stand = await zaehlen(real);
const gStand = grabDa ? await zaehlen(grab) : { dateien: 0, bytes: 0 };
const code = bestaetigungsCode(real, stand);
const heute = tag();
const juengste = archive.length ? archive[archive.length - 1].slice(8, 18) : null;

const sicherungsText = [
  `Nachtarchive (${sich}): ${archive.length ? `${archive.length} Archive (${archive[0].slice(8, 18)} … ${juengste})` : 'keine gefunden bzw. nicht auf diesem Rechner'} — Generationen ${GEN.taeglich} täglich · ${GEN.woechentlich} wöchentlich · ${GEN.monatlich} monatlich;`,
  `   spätestens überschrieben am ${plusMonate(juengste ?? heute, GEN.monatlich)} (jüngstes Archiv + ${GEN.monatlich} Monate). Enthalten die Instanz verschlüsselt.`,
  '   Mac-Abholung (~/MAKE-OS-Sicherungen): dieselben Archive, dieselben Generationen (generationen.sh).',
  '   Hoster-Abbilder des Servers: 7 Tage (beim Hoster), dann weg — oder dort von Hand löschen.',
  '   Tagessicherungen je Bestand (backup/ IM Datenordner) und Archiv-Kopien (archiv/) gehen mit dem Datenordner.',
  '   Danach: Datenschlüssel, Pepper und age-Identität dieser Instanz im Passwort-Manager löschen → Restkopien unlesbar.',
].join('\n');

if (!hat('--ausfuehren')) {
  console.log('TROCKENLAUF — es wird NICHTS gelöscht.\n');
  console.log(`Datenordner:     ${real} — ${stand.dateien} Dateien, ${mb(stand.bytes)}`);
  console.log(`Grabstein-Ordner: ${grab} — ${grabDa ? `${gStand.dateien} Dateien` : 'nicht vorhanden'}`);
  console.log(`\nSicherungen (werden NICHT einzeln gelöscht):\n   ${sicherungsText}`);
  console.log(`\nVorher erledigt? Instanz-Export (System › Datenschutz) an den Kunden übergeben, App angehalten.`);
  console.log(`\nZum Ausführen (gilt nur heute, nur für diesen Stand):\n   node scripts/instanz-loeschen.mjs --ordner ${roh} --ausfuehren --code ${code}`);
  process.exit(0);
}

const eingabe = (arg('--code') ?? '').trim().toUpperCase();
if (eingabe !== code) abbruch('Bestätigungs-Code fehlt oder stimmt nicht — erst den Trockenlauf ansehen (der Code gilt nur heute und nur für diesen Stand).', 4);

await fs.rm(real, { recursive: true, force: true });
if (grabDa) await fs.rm(grab, { recursive: true, force: true });
const bericht = [
  'Löschbestätigung (Art. 28 Abs. 3 lit. g DSGVO, AVV § 11) — Entwurf, vor dem Versand prüfen',
  `Datum: ${heute}`,
  `Gelöscht: Datenordner der Instanz (${stand.dateien} Dateien, ${mb(stand.bytes)}) einschließlich Tagessicherungen und Archiv-Kopien${grabDa ? `; Grabstein-Ordner (${gStand.dateien} Dateien)` : ''}.`,
  'Restbestände mit Frist:',
  `   ${sicherungsText}`,
  'Ausgenommen (eigene Aufbewahrungspflicht): Rechnungen und Vertragsunterlagen zur Instanz beim Betreiber (§ 147 AO, § 257 HGB).',
].join('\n');
console.log(`GELÖSCHT: ${real}${grabDa ? ` und ${grab}` : ''}\n\n${bericht}`);
const ziel = arg('--bericht');
if (ziel) { await fs.writeFile(path.resolve(ziel), `${bericht}\n`, { mode: 0o600 }); console.log(`\nBericht gespeichert: ${path.resolve(ziel)}`); }
