#!/usr/bin/env node
// ─── MAKE OS · Neustart-Umzug: neue leere Instanz, Kartei + Markttraktion + eigene Aufgaben kommen mit (09.10.2026) ──────────
// Kevin 09.10.: neu anfangen „wie ein komplett neuer Kunde“ — aber die Kundendaten, Datensätze und Infos kommen mit.
// Liest NUR aus dem alten Datenordner, schreibt NUR in einen LEEREN neuen. Standard = Probelauf (schreibt nichts, auch keinen Ordner).
// Regeln: lib/neustart/umzug.mjs (was mitkommt und warum), Ablauf: lib/neustart/umzug-lauf.mjs. Anleitung: UPDATES.md › 09.10.2026 — Neustart-Umzug.
//
//   node scripts/neustart-umzug.mjs --von <alter Ordner> --nach <neuer, leerer Ordner>               → Probelauf mit Bericht
//   node scripts/neustart-umzug.mjs --von … --nach … --ausfuehren                                     → schreiben, zurücklesen, Marke
//   Optionen: --mit-bauplan (Bauplan-Karten samt Fotos) · --mit-head-aufgaben (Aufgaben der Heads `hd-…`)
//             --auch <bestand>[,<bestand>…] (weitere Bestände unverändert, Muster mit *; nie Konten/Zugänge)
//             --person alt=neu · --haushalt alt=neu (nur, wenn die neuen Konten ANDERE Namen tragen sollen — Standard: dieselben)
//             --grabsteine <ordner> (sonst MAKE_OS_GRABSTEINE_DIR) · --absichten-ignorieren (nur nach Prüfung im Head of IT)
//             --bericht <datei.json> (ganzer Bericht als JSON, nur Namen und Zahlen — nicht in einen der beiden Datenordner)
// Auf dem Server (App angehalten; beide Ordner zusätzlich eingebunden — nie unter einem Pfad mit „.data“):
//   cd /srv/make-os/app && docker compose run --rm --no-deps -T \
//     -v /srv/make-os/<alter Ordner>:/umzug/alt:ro -v /srv/make-os/<neuer Ordner>:/umzug/neu \
//     app node scripts/neustart-umzug.mjs --von /umzug/alt --nach /umzug/neu [--ausfuehren]
// Schlüssel, Pepper und Format kommen aus derselben .env wie die App (MAKE_OS_DATEN_SCHLUESSEL(_DATEI), MAKE_OS_PEPPER(_DATEI),
// MAKE_OS_FORMAT, MAKE_OS_GRABSTEINE_DIR). Ausgegeben werden nie Inhalte — nur Bestandsnamen, Speicher-/Haushaltsnamen und Zahlen.
// Ausgang: 0 gut · 2 abgebrochen vor dem Schreiben (nichts geschrieben) · 3 eine App hält einen Ordner · 1 Fehler beim Schreiben.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { umzugLaufen, UmzugAbbruch } from '../lib/neustart/umzug-lauf.mjs';
import { abbildungAus, LISTEN_NAMEN } from '../lib/neustart/umzug.mjs';

const argv = process.argv.slice(2);
const hat = n => argv.includes(`--${n}`);
const werte = n => argv.flatMap((a, i) => (a === `--${n}` && argv[i + 1] && !argv[i + 1].startsWith('--') ? [argv[i + 1]] : []));
const wert = n => werte(n)[0];
if (hat('hilfe') || !argv.length) {
  console.log('Aufruf: node scripts/neustart-umzug.mjs --von <alter Datenordner> --nach <neuer, leerer Ordner> [--ausfuehren] [--mit-bauplan] [--mit-head-aufgaben] [--auch a,b] [--person alt=neu] [--haushalt alt=neu] [--grabsteine <ordner>] [--bericht <datei.json>]');
  process.exit(argv.length ? 0 : 2);
}

let personen, haushalte;
try { personen = abbildungAus(werte('person'), 'Person'); haushalte = abbildungAus(werte('haushalt'), 'Haushalt'); }
catch (e) { console.error(`Abgebrochen: ${e instanceof Error ? e.message : e}`); process.exit(2); }
const berichtDatei = wert('bericht');

const zahl = n => n.toLocaleString('de-DE');
const zeile = (links, rechts = '') => console.log(`  ${links.padEnd(44)} ${rechts}`);
const listen = a => Object.entries(a ?? {}).map(([k, v]) => `${LISTEN_NAMEN[k] ?? k} ${zahl(v)}`).join(' · ');

try {
  const b = await umzugLaufen({
    von: wert('von'), nach: wert('nach'), ausfuehren: hat('ausfuehren'),
    auch: werte('auch').flatMap(x => x.split(',')).map(x => x.trim()).filter(Boolean),
    mitBauplan: hat('mit-bauplan'), mitHeadAufgaben: hat('mit-head-aufgaben'), absichtenIgnorieren: hat('absichten-ignorieren'),
    personen, haushalte, grabsteinOrdner: wert('grabsteine'),
  });
  if (berichtDatei) {
    const ziel = path.resolve(berichtDatei);
    if ([b.von, b.nach].some(o => ziel === o || ziel.startsWith(o + path.sep))) console.error('--bericht: nicht in einen der Datenordner — übersprungen.');
    else writeFileSync(ziel, `${JSON.stringify(b, null, 2)}\n`, { mode: 0o600 });
  }
  console.log('');
  console.log(b.probelauf ? '═══ Neustart-Umzug · PROBELAUF (nichts geschrieben) ═══' : '═══ Neustart-Umzug · AUSGEFÜHRT ═══');
  console.log(`  von ${b.von}  →  nach ${b.nach}`);
  console.log(`  Format ${b.format} · ${b.verschluesselt ? 'verschlüsselt' : 'OHNE Datenschlüssel (Klartext)'} · Pepper ${b.pepper}`);
  console.log('');
  console.log('Konten im alten Ordner (kommen NICHT mit — nur zur Orientierung):');
  for (const p of b.konten.personen) zeile(`${p.speicher}${p.hauptInhaber ? ' (Haupt-Inhaber)' : ''}`, `${p.rolle}${p.haushalt ? ` · Haushalt ${p.haushalt}` : ' · ohne Haushalt'}${p.finanzRecht ? ' · nur Business' : ''}`);
  if (!b.konten.personen.length) zeile('— keine lesbaren Konten —');
  console.log('');
  console.log('Mit (alt → neu, Kennungen-Fingerabdruck):');
  for (const s of b.bestaende) {
    zeile(`${s.name}${s.neuName ? ` → ${s.neuName}` : ''}`, `${s.inhalt} · Kennungen ${s.kennungenAlt === s.kennungenNeu ? `${s.kennungenAlt} (gleich)` : `${s.kennungenAlt} → ${s.kennungenNeu}`}`);
    const a = listen(s.alt), n = listen(s.neu);
    if (a || n) console.log(`      alt: ${a || '—'}${a === n ? '' : `\n      neu: ${n || '—'}`}`);
  }
  if (b.aufgaben) {
    const x = b.aufgaben;
    console.log('');
    console.log(`Aufgaben: ${zahl(x.alt.aufgaben)} → ${zahl(x.neu.aufgaben)} · Projekte ${zahl(x.alt.projekte)} → ${zahl(x.neu.projekte)} · Listen ${zahl(x.alt.listen)} → ${zahl(x.neu.listen)}`);
    zeile('nicht: Papierkorb / „Neu anfangen“-Archiv', `${zahl(x.nicht.papierkorb)} / ${zahl(x.nicht.archiv)} Aufgaben (samt Unteraufgaben)`);
    for (const [g, n] of Object.entries(x.nicht.modul)) zeile(`nicht: ${g}`, `${zahl(n)}`);
    if (x.uebernommenProjekte.length) zeile('Meilenstein-Listen → Projekt „Übernommen“', `${zahl(x.umgehaengt.listen)} Listen, ${zahl(x.umgehaengt.aufgaben)} Aufgaben (${x.uebernommenProjekte.map(p => p.space).join(', ')})${x.umgehaengt.nurDateien ? ` — davon ${zahl(x.umgehaengt.nurDateien)} Liste(n) nur mit Dateien` : ''}`);
    if (x.nicht.meilensteinListenLeer) zeile('leere Meilenstein-Listen (fallen weg)', zahl(x.nicht.meilensteinListenLeer));
    zeile('gelöst: Ziel · ZOE-Auftrag · Abhängigkeit · Liste', `${x.geloest.ziel} · ${x.geloest.zoe} · ${x.geloest.abhaengig} · ${x.geloest.liste}`);
  }
  if (b.dateien) {
    const d = b.dateien;
    console.log('');
    console.log(`Dateien: CRM ${zahl(d.crm.mitDatei)} (fehlen schon im alten Ordner: ${d.crm.fehlen}) · Aufgaben ${zahl(d.aufgaben.mitDatei)} (fehlen: ${d.aufgaben.fehlen}) · Bilder ${d.bilder} · ${(d.bytes / 1048576).toFixed(1)} MB`);
    zeile('Dateien nicht übernommener Aufgaben / ohne Eintrag', `${d.nichtUebernommen} / ${d.ohneEintrag}`);
    if (d.crm.groesseAbweichend || d.aufgaben.groesseAbweichend) zeile('Größe weicht vom Eintrag ab (nur Hinweis)', `${d.crm.groesseAbweichend + d.aufgaben.groesseAbweichend}`);
  }
  if (b.verweise) {
    console.log('');
    console.log('Verweise (alt → neu; „tot“ = zeigt ins Leere):');
    // Erklärt, also kein Befund: CRM → Aufgaben, die bewusst nicht mitkamen; Einwilligungs-Belege, deren Aufgabe nicht mitkam (Nachweis bleibt).
    const erklaert = { crmAufgabeNichtUebernommen: Infinity, aufgabenDateiBezugTot: b.aufgabenDateien.reduce((s, x) => s + x.beleg, 0) };
    const zeilen = Object.keys(b.verweise.neu).filter(k => b.verweise.alt[k] || b.verweise.neu[k]);
    for (const k of zeilen) {
      const a = b.verweise.alt[k], n = b.verweise.neu[k];
      zeile(k, `${a} → ${n}${n > a + (erklaert[k] ?? 0) ? '  ← NEU' : ''}`);
    }
    if (!zeilen.length) zeile('keine toten Verweise — vorher wie nachher');
  }
  if (b.grabsteine) console.log(`\nGrabsteine: ${!b.grabsteine.gefunden ? `keine gefunden in ${b.grabsteine.ordner} — Ordner prüfen` : `${b.grabsteine.anzahl} · ${b.grabsteine.angewendetAufDemStand ? 'die Kartei ist danach bereinigt (Marke kommt mit); nach dem Start trotzdem einmal anwenden' : 'nach dem Start anwenden (Pflicht)'}`}`);
  console.log('');
  const gruppen = new Map();
  for (const x of b.nicht) { const g = gruppen.get(x.bereich) ?? []; g.push(x.name); gruppen.set(x.bereich, g); }
  console.log(`Bleibt im Archiv (${b.nicht.length} Bestände) — Gründe je Bestand im --bericht:`);
  for (const [g, n] of gruppen) zeile(g, `${n.length}: ${n.slice(0, 6).join(', ')}${n.length > 6 ? ' …' : ''}`);
  if (b.hinweise.length) {
    console.log('');
    console.log('Hinweise:');
    for (const h of b.hinweise) console.log(`  · ${h}`);
  }
  if (b.geschrieben) console.log(`\nGeschrieben: ${b.geschrieben.bestaende} Bestände, ${b.geschrieben.dateien} Dateien (${(b.geschrieben.bytes / 1048576).toFixed(1)} MB) — alles zurückgelesen und gleich. Marke system/neustart.json gesetzt.`);
  else console.log('\nProbelauf: nichts geschrieben. Wenn alles stimmt: denselben Aufruf mit --ausfuehren.');
  process.exit(0);
} catch (e) {
  if (e instanceof UmzugAbbruch) {
    console.error('Abgebrochen:');
    for (const g of e.gruende) console.error(`  · ${g}`);
    process.exit(e.code);
  }
  console.error(`Fehler: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
