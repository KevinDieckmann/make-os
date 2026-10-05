#!/usr/bin/env node
// ─── MAKE OS · Business-Zahlen auf 0 (05.10.2026, Kevin: „nur die Zahlen in dem Business-Bereich auf 0 setzen“) ─────────────
// Einmal-Werkzeug für den 0-Punkt im Business: Die Business-Gesellschaften (KD Ventures, MAKE Innovation GmbH, Register-
// Gesellschaften `g-…`) bekommen Kontostand 0; ihre Rechnungen, Zahlungen, Merkposten (Bestand `finanzplan`), Liquiditäts-
// Planposten (`liquiplan`) und Buchungen (`buchungen`) werden ENDGÜLTIG entfernt (Kevins Wahl — es bleibt nur die normale
// nächtliche Sicherung). Privat und die Selbstständigkeit (kdc) bleiben unberührt, ebenso Finanzplanung, Monatsabschlüsse,
// Index-Verlauf und alles andere. Unbekannte Firmen-Kennungen werden NIE angefasst, nur gemeldet.
//
//   node scripts/business-auf-null.mjs               Trockenlauf (Vorgabe): zeigt je Bestand, was weg/auf 0 ginge
//   node scripts/business-auf-null.mjs --ausfuehren  schreibt
//
// NIE bei laufender App (Lockfile `<daten>/.schreiber`, wie daten-verschluesselung.mjs). Auf dem Server:
//   cd /srv/make-os/app && docker compose stop app arbeiter
//   docker compose run --rm -T --no-deps app node scripts/business-auf-null.mjs </dev/null
//   docker compose run --rm -T --no-deps app node scripts/business-auf-null.mjs --ausfuehren </dev/null
//   docker compose up -d
// Die Einordnung spiegelt `bereichVonFirma` (lib/einheiten.ts) für unsere Instanz; tests/business-auf-null.test.ts wacht darüber.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomarSchreiben } from '../lib/store/atomar.mjs';
import { schluesselRing, huellenVersion, huelleImModus, huelleOeffnen } from '../lib/store/huelle.mjs';
import { skriptSperreOderAbbruch } from '../lib/store/schreiber.mjs';

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const BUSINESS = new Set(['kdv', 'ug', 'kemaris', 'make', 'kd ventures', 'kd ventures ug', 'kd ventures ug (haftungsbeschränkt)', 'kd management', 'kd management ug', 'kdm',
  'make innovation', 'make innovation gmbh', 'kemaris innovation', 'kemaris innovation gmbh', 'neue ug']);
const PRIVAT = new Set(['privat', 'kdc', 'selbst', 'selbststaendigkeit', 'selbstständigkeit', 'selbstständig', 'consulting', 'kd consulting', 'kdc consulting', 'kevin dieckmann consulting']);

/** 'business' | 'privat' | 'unbekannt' — leer/fehlend ist unbekannt (nie raten). */
export function einordnen(id) {
  const n = norm(id);
  if (!n) return 'unbekannt';
  if (/^g-[a-z0-9-]+$/.test(n)) return 'business';
  if (BUSINESS.has(n)) return 'business';
  if (PRIVAT.has(n)) return 'privat';
  return 'unbekannt';
}

/** Rein: was mit den drei Beständen passiert. Gibt die neuen Bestände und einen Bericht zurück. */
export function aufNull({ finanzplan, liquiplan, buchungen }, heute) {
  const bericht = { firmenAufNull: [], entfernt: {}, summe: {}, unbekannt: {} };
  const merke = (feld, liste, idVon) => {
    const behalten = [];
    bericht.entfernt[feld] = 0; bericht.summe[feld] = 0;
    for (const x of Array.isArray(liste) ? liste : []) {
      const k = einordnen(idVon(x));
      if (k === 'business') { bericht.entfernt[feld]++; bericht.summe[feld] += Number(x?.betrag) || 0; continue; }
      if (k === 'unbekannt') { const id = String(idVon(x) ?? '(leer)'); bericht.unbekannt[`${feld}:${id}`] = (bericht.unbekannt[`${feld}:${id}`] ?? 0) + 1; }
      behalten.push(x);
    }
    return behalten;
  };
  let fp = finanzplan;
  if (fp && typeof fp === 'object') {
    fp = { ...fp };
    fp.firmen = (Array.isArray(fp.firmen) ? fp.firmen : []).map(f => {
      if (einordnen(f?.id) !== 'business') return f;
      bericht.firmenAufNull.push(`${f.id} (vorher ${f.kontostand ?? '—'})`);
      return { ...f, kontostand: 0, stand: heute };
    });
    for (const feld of ['rechnungen', 'zahlungen', 'merkposten']) if (feld in fp) fp[feld] = merke(feld, fp[feld], x => x?.firmaId);
  }
  let lp = liquiplan;
  if (lp && typeof lp === 'object' && Array.isArray(lp.posten)) lp = { ...lp, posten: merke('planposten', lp.posten, x => x?.firmaId) };
  let bu = buchungen;
  if (bu && typeof bu === 'object' && Array.isArray(bu.buchungen)) bu = { ...bu, buchungen: merke('buchungen', bu.buchungen, x => x?.ort ?? 'privat') };
  return { neu: { finanzplan: fp, liquiplan: lp, buchungen: bu }, bericht };
}

async function lesen(ordner, name, ring) {
  const p = path.join(ordner, `${name}.json`);
  let roh;
  try { roh = await fs.readFile(p, 'utf8'); } catch (e) { if (e?.code === 'ENOENT') return { daten: null, p }; throw e; }
  const o = JSON.parse(roh);
  const text = huellenVersion(o) ? huelleOeffnen(o, ring, name).text : roh;
  return { daten: JSON.parse(text), p };
}

async function haupt() {
  const schreiben = process.argv.includes('--ausfuehren');
  const ring = schluesselRing();
  const DATEN = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');
  await skriptSperreOderAbbruch(DATEN, 'business-auf-null');
  const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  const namen = ['finanzplan', 'liquiplan', 'buchungen'];
  const gelesen = {};
  for (const n of namen) gelesen[n] = await lesen(DATEN, n, ring);
  const { neu, bericht } = aufNull({ finanzplan: gelesen.finanzplan.daten, liquiplan: gelesen.liquiplan.daten, buchungen: gelesen.buchungen.daten }, heute);
  console.log(schreiben ? 'AUSFÜHREN' : 'TROCKENLAUF (nichts geschrieben — mit --ausfuehren schreiben)');
  console.log('Firmen auf Kontostand 0:', bericht.firmenAufNull.length ? bericht.firmenAufNull.join(', ') : '—');
  for (const [feld, anz] of Object.entries(bericht.entfernt)) console.log(`${feld}: ${anz} entfernt (Summe ${bericht.summe[feld].toFixed(2)} €)`);
  const unb = Object.entries(bericht.unbekannt);
  console.log('unbekannte Kennungen (NICHT angefasst):', unb.length ? unb.map(([k, v]) => `${k} ×${v}`).join(', ') : '—');
  if (!schreiben) return;
  for (const n of namen) {
    if (gelesen[n].daten === null) continue;
    const text = JSON.stringify(neu[n], null, 2);
    await atomarSchreiben(gelesen[n].p, ring.aktiv ? huelleImModus(text, ring.aktiv, n) : text);
    console.log(`geschrieben: ${n}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await haupt();
