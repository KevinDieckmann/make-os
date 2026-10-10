#!/usr/bin/env node
// ─── MAKE OS · Neustart: einzelne Bestände aus dem Archiv nachholen (09.10.2026 spät) ──────────────────────────────────────────────
// Kevin 09.10.: „Pack bitte schon die vorgefertigten Bots bei ZOE ein … da hatten wir ja schon welche.“ — und „Firma und Privat liegen
// getrennt — auch in der Datenhaltung.“ Holt NUR ausdrücklich genannte Bestände der BUSINESS-Heads (head-sales, head-marketing, head-event:
// Merksätze, entschiedene Vorschläge = Lernstand, Autonomie) aus dem Archiv-Ordner des Neustarts in den LAUFENDEN Datenordner. Regeln:
// lib/neustart/nachholen.mjs, Ablauf: lib/neustart/nachholen-lauf.mjs. Anleitung: UPDATES.md › 09.10.2026 — Agenten-Grundausstattung.
//
//   node scripts/neustart-nachholen.mjs --archiv <alter Ordner> --daten <laufender Ordner> --bestand head-sales,head-marketing,head-event
//        → Probelauf mit Bericht (schreibt nichts)
//   … --ausfuehren → schreiben (vorhandene Ziele zusammenführen, das Ziel gewinnt; Sicherung der bisherigen Datei unter <daten>/archiv/),
//        zurücklesen, vergleichen
// Auf dem Server (App UND Arbeiter angehalten; beide Ordner eingebunden — nie unter einem Pfad mit „.data“):
//   cd /srv/make-os/app && docker compose stop app arbeiter && docker compose run --rm --no-deps -T \
//     -v /srv/make-os/<Archiv-Ordner>:/nachholen/archiv:ro -v /srv/make-os/daten:/nachholen/daten \
//     app node scripts/neustart-nachholen.mjs --archiv /nachholen/archiv --daten /nachholen/daten --bestand head-sales,head-marketing,head-event [--ausfuehren]
// Schlüssel und Format aus derselben .env wie die App. Ausgegeben werden nie Inhalte — nur Bestandsnamen und Zahlen.
// Ausgang: 0 gut · 2 abgebrochen vor dem Schreiben (nichts geschrieben) · 3 eine App hält einen Ordner · 1 Fehler beim Schreiben.

import { nachholenLaufen, NachholenAbbruch } from '../lib/neustart/nachholen-lauf.mjs';
import { NACHHOLBAR } from '../lib/neustart/nachholen.mjs';

const argv = process.argv.slice(2);
const hat = n => argv.includes(`--${n}`);
const wert = n => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined; };
if (hat('hilfe') || !argv.length) {
  console.log('Aufruf: node scripts/neustart-nachholen.mjs --archiv <alter Datenordner> --daten <laufender Datenordner> --bestand a,b [--ausfuehren]');
  console.log(`Nachholbar: ${NACHHOLBAR.map(e => e.name).join(', ')}`);
  process.exit(argv.length ? 0 : 2);
}

const z = x => (x ? `${x.merksaetze} Merksätze · ${x.entschieden} entschiedene Vorschläge · ${x.offen} offene · ${x.berichte} Berichte${x.autonomie ? ` · Autonomie ${x.autonomie}` : ''}` : '—');
try {
  const b = await nachholenLaufen({
    archiv: wert('archiv'), daten: wert('daten'), ausfuehren: hat('ausfuehren'),
    bestaende: (wert('bestand') ?? '').split(',').map(x => x.trim()).filter(Boolean),
  });
  console.log('');
  console.log(b.probelauf ? '═══ Nachholen · PROBELAUF (nichts geschrieben) ═══' : '═══ Nachholen · AUSGEFÜHRT ═══');
  console.log(`  aus ${b.archiv}  →  in ${b.daten}`);
  console.log(`  Format ${b.format} · ${b.verschluesselt ? 'verschlüsselt' : 'OHNE Datenschlüssel (Klartext)'}`);
  for (const s of b.bestaende) {
    console.log('');
    console.log(`  ${s.name}: ${{ neu: 'neu angelegt (gefiltert)', zusammengefuehrt: 'zusammengeführt (laufender Stand gewinnt)', unveraendert: 'nichts zu tun', 'fehlt-im-archiv': 'fehlt im Archiv' }[s.aktion]}`);
    console.log(`      Archiv:  ${z(s.archiv)}`);
    console.log(`      vorher:  ${z(s.vorher)}`);
    console.log(`      nachher: ${z(s.nachher)}`);
  }
  if (b.geschrieben) {
    console.log(`\nGeschrieben: ${b.geschrieben.bestaende} Bestände — zurückgelesen und gleich.`);
    for (const g of b.geschrieben.gesichert) console.log(`  bisherige Datei gesichert: ${g}`);
    console.log('Danach: docker compose up -d — und die Grabsteine anwenden (UPDATES.md, Schritt „Grabsteine“).');
  } else console.log('\nProbelauf: nichts geschrieben. Wenn alles stimmt: denselben Aufruf mit --ausfuehren.');
  process.exit(0);
} catch (e) {
  if (e instanceof NachholenAbbruch) {
    console.error('Abgebrochen:');
    for (const g of e.gruende) console.error(`  · ${g}`);
    process.exit(e.code);
  }
  console.error(`Fehler: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
