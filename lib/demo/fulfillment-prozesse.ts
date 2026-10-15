// ─── MAKE OS — Demo-Instanz: Fulfillment · Prozesse (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 12.7) ────────────────────────────────────
// Landkarte und drei Paket-Vorlagen aus dem Muster, rund 25 erfundene Bausteine über den Import (zwei „rechtlich prüfen“, einer „nur intern“,
// einer „vor Verkauf prüfen“, ein Huddle mit Zahlenrunde), vier erfundene Abläufe (Trichter, Fluss mit Weichen, Kreis mit Empfehlungsring,
// Zeitachse — mit Rückweg und gestrichelter Ergänzung), Zuordnung der Demo-Produkte, zwei Fälle: Lumen im Onboarding (Willkommensmail überfällig), Nordwerk in der
// Diagnose — seit 12.10. eine durchgehende Geschichte ohne Widersprüche (Unterschrift → Kick-off → Analyse → F2 → Diagnose mit Quick Wins aus der
// Analyse, Wert-Konto mit drei Messungen, zwei Reports, Puls 7 → 8, Wochen-Check im Kalender; das Kunden-Playbook hängt als Formular im Fall —
// die Antworten sät lib/demo/fulfillment-kunde.ts). Alles über die Routen (`k.rufe`), erfunden und neutral (Wächter tests/demo.test.ts);
// die wenigen direkten Wege (Kalender-Bezug, Report und Puls mit Datum in der Vergangenheit) stehen begründet an ihrer Stelle.

import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';
import { MUSTER_P1, MUSTER_P2, MUSTER_P3 } from '@/lib/fulfillment/muster';
import { WILLKOMMEN_GERUEST, OB_PRAEFIX } from '@/lib/fulfillment/prozesse/onboarding';
import { WEITERE_BAUSTEINE, SAMMEL_SCHRITT, SAMMEL_ALLGEMEIN } from '@/lib/fulfillment/prozesse/phasen';
import { tagPlus } from '@/lib/kalender/zeit';

type J = Record<string, unknown>;
interface KnotenJ { id: string; elternId?: string; rang: number; titel: string; freigabe?: string; status: string }

/** Erfundene Bausteine im Format der Bausteine-Dateien (`vorlagen: […]`). */
function demoBausteine(): J {
  const b = (id: string, art: string, titel: string, zweck: string, x: J = {}): J => ({ id, art, titel, zweck, ...x });
  return {
    vorlagen: [
      b('demo-ziele-workshop', 'aufgabe', 'Ziel-Workshop vorbereiten', 'Zahlen, Engpass und Ziel des Kunden auf einer Seite.', { phase: 'analyse', pakete: ['hos-cso', 'sales-systematik'], gliederung: ['Zahlen der letzten 12 Monate', 'Engpass benennen', 'Ein Ziel für 90 Tage'] }),
      b('demo-trichter-zahlen', 'kennzahl', 'Trichter-Zahlen je Woche', 'Kontakte, Gespräche, Angebote und Abschlüsse je Woche zählen.', { phase: 'analyse', pakete: ['sales-systematik'], kennzahl: 'Abschlüsse je Woche' }),
      b('demo-ist-aufnahme', 'checkliste', 'Ist-Aufnahme Vertrieb', 'Wie arbeitet der Vertrieb heute? Wer macht was, mit welchen Werkzeugen?', { phase: 'analyse', pakete: ['hos-cso', 'sales-systematik'], gliederung: ['Rollen', 'Werkzeuge', 'Ablauf vom Erstkontakt bis zum Abschluss', 'Engpässe'] }),
      b('demo-zielkunden', 'dokument', 'Zielkunden-Profil', 'Welche Kunden passen am besten — Branche, Größe, Anlass.', { phase: 'strategie', pakete: ['hos-cso', 'sales-systematik', 'netzwerk-vertrieb'], gliederung: ['Branche', 'Größe', 'Anlass zum Kauf', 'Ausschluss'] }),
      b('demo-angebotsleiter', 'dokument', 'Angebotsleiter', 'Einstieg, Kern und Premium als klare Stufen.', { phase: 'strategie', pakete: ['hos-cso'], gliederung: ['Einstieg', 'Kern', 'Premium'] }),
      b('demo-wochenplan', 'aufgabe', 'Wochenplan Vertrieb', 'Feste Zeiten für Ansprache, Nachfassen und Angebote.', { phase: 'umsetzung', pakete: ['sales-systematik'] }),
      b('demo-gespraechsleitfaden', 'skript', 'Leitfaden Erstgespräch', 'Bedarf verstehen, bevor ein Angebot entsteht.', { phase: 'umsetzung', pakete: ['sales-systematik', 'hos-cso'], gliederung: ['Anlass', 'Lage heute', 'Ziel', 'Nächster Schritt'] }),
      b('demo-anrufskript', 'skript', 'Anruf-Skript Bestandskunden', 'Bestandskunden mit konkretem Anlass anrufen.', { phase: 'umsetzung', unterphase: 'skripte', pakete: ['sales-systematik'], hinweis: 'Nur mit konkretem Anlass anrufen.' }),
      b('demo-messe-danke', 'mail', 'Danke nach der Messe', 'Kurze Mail am Tag nach dem Gespräch auf der Messe.', { phase: 'umsetzung', pakete: ['netzwerk-vertrieb'], text: 'Betreff: Danke für das Gespräch\n\n{{anrede}},\n\ndanke für das Gespräch am Stand. Wie besprochen melde ich mich mit dem nächsten Schritt.\n' }),
      b('demo-nachfass-plan', 'checkliste', 'Nachfassen nach der Messe', 'Tag 1, 3, 7, 14 und 30 — wer meldet sich wann mit welchem Anlass.', { phase: 'umsetzung', pakete: ['netzwerk-vertrieb'], gliederung: ['Tag 1: Danke', 'Tag 3: Unterlage', 'Tag 7: Termin', 'Tag 14: Erinnerung', 'Tag 30: Wiedervorlage'] }),
      b('demo-netzwerk-karte', 'dokument', 'Netzwerk-Karte', 'Wer kennt wen? Die zehn wichtigsten Verbindungen zu Zielkunden.', { phase: 'strategie', pakete: ['netzwerk-vertrieb'] }),
      b('demo-partner-gespraech', 'aufgabe', 'Partner-Gespräch führen', 'Mit einem Partner klären, wie beide Seiten voneinander profitieren.', { phase: 'umsetzung', pakete: ['netzwerk-vertrieb'] }),
      b('demo-crm-pflege', 'checkliste', 'Kartei-Pflege je Woche', 'Jeder Kontakt hat einen nächsten Schritt mit Datum.', { phase: 'umsetzung', pakete: ['sales-systematik', 'hos-cso'] }),
      b('demo-pipeline-review', 'ritual', 'Pipeline-Review', 'Jeden Deal einmal im Monat ehrlich bewerten.', { phase: 'steuerung', pakete: ['hos-cso'] }),
      b('demo-huddle', 'ritual', 'Huddle mit Zahlenrunde', 'Täglich 15 Minuten: Zahlen von gestern, Plan für heute, wer hilft wem.', { phase: 'steuerung', pakete: ['hos-cso', 'sales-systematik', 'netzwerk-vertrieb'], gliederung: ['Zahlenrunde: gestern · heute · Abweichung', 'Hindernisse', 'Wer hilft wem'] }),
      b('demo-kennzahlen-board', 'kennzahl', 'Kennzahlen-Board', 'Fünf Zahlen, die jede Woche gleich aussehen.', { phase: 'steuerung', pakete: ['hos-cso', 'sales-systematik'], kennzahl: 'Gespräche je Woche' }),
      b('demo-uebergabe', 'checkliste', 'Übergabe an das Team', 'Was das Team ab jetzt selbst führt.', { phase: 'uebergabe', pakete: ['hos-cso', 'sales-systematik'], gliederung: ['Rituale', 'Kennzahlen', 'Ansprechpartner', 'Offene Punkte'] }),
      b('demo-befaehigung', 'workbook', 'Workbook Selbstständigkeit', 'Das Team prüft selbst, was es schon allein kann.', { phase: 'uebergabe', pakete: ['sales-systematik'] }),
      b('demo-kickoff-agenda', 'dokument', 'Kick-off-Agenda', 'Ziel, Rollen, Takt und erste Schritte in 90 Minuten.', { phase: 'onboarding', pakete: ['hos-cso', 'sales-systematik', 'netzwerk-vertrieb'], gliederung: ['Ziel und Wert-Konto', 'Rollen und Erreichbarkeit', 'Takt', 'Erste schnelle Erfolge'] }),
      b('demo-stakeholder', 'analyse', 'Stakeholder-Gespräch', 'Wer entscheidet, wer unterstützt, wer zweifelt?', { phase: 'onboarding', pakete: ['hos-cso'] }),
      b('demo-gespraechsvorbereitung', 'dokument', 'Interne Gesprächsvorbereitung', 'Unsere Notizen vor einem Termin — bleibt im Team.', { phase: 'umsetzung', pakete: ['hos-cso'], nur_intern: true }),
      b('demo-seminar-raster', 'workbook', 'Raster aus einem Seminar', 'Ein gekauftes Raster zur Wochenplanung.', { phase: 'umsetzung', pakete: ['sales-systematik'], herkunft: 'Gekauftes Seminar-Material', pruefen_vor_verkauf: true }),
      b('demo-abschluss-review', 'analyse', 'Abschluss-Review', 'Was hat gewirkt, was nicht — als Grundlage für den Wirkungsbericht.', { phase: 'uebergabe', pakete: ['hos-cso', 'sales-systematik', 'netzwerk-vertrieb'] }),
      b('demo-freigabe-konzept', 'freigabe', 'Freigabe Konzept', 'Der Kunde bestätigt das Konzept, bevor die Umsetzung beginnt.', { phase: 'strategie', pakete: ['hos-cso', 'sales-systematik'] }),
    ],
  };
}

/** Vier erfundene Abläufe im Format der Ablauf-Dateien (je Ablauf `stufen`, `uebergaenge`) — Trichter, Fluss, Kreis, Zeitachse. */
function demoAblaeufe(): J {
  return {
    erstgespraech: {
      titel: 'Vom Erstkontakt zum Abschluss', form: 'trichter',
      stufen: [
        { id: 'kontakt', name: 'Erstkontakt', art: 'einstieg', zweck: 'Anlass und Ansprechperson klären.' },
        { id: 'gespraech', name: 'Erstgespräch', zweck: 'Bedarf verstehen.', kennzahl: 'Gespräche je Woche' },
        { id: 'bedarf', name: 'Bedarf geklärt', zweck: 'Ziel und Engpass schriftlich.' },
        { id: 'angebot', name: 'Angebot', zweck: 'Ein Angebot je Stufe der Angebotsleiter.' },
        { id: 'nachfassen', name: 'Nachfassen', zweck: 'Zwei Tage nach dem Angebot melden.', herkunft: 'ergaenzung' },
        { id: 'abschluss', name: 'Abschluss', art: 'ausstieg' },
        { id: 'kein-fit', name: 'Kein Fit', art: 'ausstieg' },
      ],
      uebergaenge: [
        { von: 'kontakt', nach: 'gespraech', art: 'vorwaerts' }, { von: 'gespraech', nach: 'bedarf', art: 'vorwaerts' },
        { von: 'bedarf', nach: 'angebot', art: 'vorwaerts' }, { von: 'angebot', nach: 'nachfassen', art: 'vorwaerts', herkunft: 'ergaenzung' },
        { von: 'nachfassen', nach: 'abschluss', art: 'vorwaerts' }, { von: 'angebot', nach: 'bedarf', art: 'rueckweg', bedingung: 'Einwand: Umfang' },
        { von: 'gespraech', nach: 'kein-fit', art: 'ausstieg', bedingung: 'passt nicht zur Zielgruppe' },
      ],
    },
    anfrage: {
      titel: 'Anfrage-Weiche', form: 'drei Spalten mit Weichen',
      stufen: [
        { id: 'eingang', name: 'Anfrage geht ein', art: 'einstieg' },
        { id: 'pruefen', name: 'Passt die Anfrage?', zweck: 'Zielgruppe, Anlass, Zeitpunkt.' },
        { id: 'termin', name: 'Termin vereinbaren' },
        { id: 'unterlage', name: 'Unterlage senden', zweck: 'Wenn noch kein Termin passt.', herkunft: 'ergaenzung' },
        { id: 'angebot', name: 'Angebot' },
        { id: 'absage', name: 'Freundlich absagen', art: 'ausstieg' },
      ],
      uebergaenge: [
        { von: 'eingang', nach: 'pruefen', art: 'vorwaerts' }, { von: 'pruefen', nach: 'termin', art: 'vorwaerts', bedingung: 'passt' },
        { von: 'pruefen', nach: 'unterlage', art: 'vorwaerts', bedingung: 'später', herkunft: 'ergaenzung' }, { von: 'pruefen', nach: 'absage', art: 'ausstieg', bedingung: 'passt nicht' },
        { von: 'termin', nach: 'angebot', art: 'vorwaerts' }, { von: 'termin', nach: 'pruefen', art: 'rueckweg', bedingung: 'Angaben fehlen' },
        { von: 'unterlage', nach: 'termin', art: 'vorwaerts' },
      ],
    },
    kreis: {
      titel: 'Vertriebs-Kreislauf', form: 'Kreis im Uhrzeigersinn',
      stufen: [
        { id: 'kontakt', name: 'Kontakt', art: 'einstieg', zweck: 'Ein Anlass, eine Ansprechperson.' },
        { id: 'gespraech', name: 'Gespräch', zweck: 'Bedarf verstehen.' },
        { id: 'angebot', name: 'Angebot', zweck: 'Eine klare Stufe der Angebotsleiter.' },
        { id: 'abschluss', name: 'Abschluss' },
        { id: 'betreuung', name: 'Betreuung', zweck: 'Regelmäßig nachfragen, wie es läuft.' },
        { id: 'empfehlung', name: 'Empfehlung', zweck: 'Zufriedene Kunden nach passenden Kontakten fragen.', herkunft: 'ergaenzung' },
      ],
      uebergaenge: [
        { von: 'kontakt', nach: 'gespraech', art: 'vorwaerts' }, { von: 'gespraech', nach: 'angebot', art: 'vorwaerts' },
        { von: 'angebot', nach: 'abschluss', art: 'vorwaerts' }, { von: 'abschluss', nach: 'betreuung', art: 'vorwaerts' },
        { von: 'betreuung', nach: 'kontakt', art: 'kreislauf' }, { von: 'angebot', nach: 'gespraech', art: 'rueckweg', bedingung: 'Einwand' },
        { von: 'betreuung', nach: 'empfehlung', art: 'vorwaerts', herkunft: 'ergaenzung' }, { von: 'empfehlung', nach: 'kontakt', art: 'vorwaerts', herkunft: 'ergaenzung' },
      ],
    },
    messe: {
      titel: 'Nachfassen nach der Messe', form: 'zeitachse',
      stufen: [
        { id: 't1', name: 'Tag 1 · Danke', art: 'einstieg' }, { id: 't3', name: 'Tag 3 · Unterlage' }, { id: 't7', name: 'Tag 7 · Termin anbieten' },
        { id: 't14', name: 'Tag 14 · Erinnerung' }, { id: 't30', name: 'Tag 30 · Wiedervorlage' },
        { id: 't60', name: 'Tag 60 · Letzter Versuch', optional: true, herkunft: 'ergaenzung' },
      ],
      uebergaenge: [
        { von: 't1', nach: 't3', art: 'vorwaerts' }, { von: 't3', nach: 't7', art: 'vorwaerts' }, { von: 't7', nach: 't14', art: 'vorwaerts' },
        { von: 't14', nach: 't30', art: 'vorwaerts' }, { von: 't30', nach: 't60', art: 'vorwaerts', herkunft: 'ergaenzung' },
      ],
    },
  };
}

/** Vorschau → übernehmen, genau wie in der Oberfläche. */
async function importieren(k: FulfillmentSaatKontext, datei: string, roh: J, wahl: J = {}): Promise<number> {
  const inhalt = JSON.stringify(roh);
  const v = await k.rufe(k.routen.import(), 'POST', '/api/fulfillment/import', k.inhaber, { aktion: 'vorschau', datei, inhalt });
  const r = await k.rufe(k.routen.import(), 'POST', '/api/fulfillment/import', k.inhaber, { aktion: 'uebernehmen', datei, inhalt, vorschauId: v.vorschauId, wahl });
  return Number(r.neu ?? 0) + Number(r.geaendert ?? 0);
}

export async function prozesseSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const L = k.inhaber;
  const fulfillment = (methode: 'GET' | 'PATCH', pfad: string, body?: unknown) => k.rufe(k.routen.fulfillment(), methode, pfad, L, body);
  const fallOps = async (mandatId: string, ops: J[]) => { for (let i = 0; i < ops.length; i += 30) await k.rufe(k.routen.fall(), 'PATCH', '/api/fulfillment/fall', L, { mandatId, ops: ops.slice(i, i + 30) }); };
  const fallLesen = async (mandatId: string) => k.rufe(k.routen.fall(), 'GET', `/api/fulfillment/fall?m=${encodeURIComponent(mandatId)}`, L);

  // 1) Landkarte, Paket-Vorlagen, Rituale und Playbook aus dem Muster; eine Willkommensmail-Vorlage (Sie).
  await fulfillment('PATCH', '/api/fulfillment', { ops: [{ op: 'aus-muster' }] });
  await fulfillment('PATCH', '/api/fulfillment', { ops: [{ op: 'baustein', eintrag: { art: 'mail', titel: 'Willkommensmail (Sie)', zweck: 'Die erste Mail nach der Unterschrift — Kick-off-Termine und Playbook.', text: WILLKOMMEN_GERUEST.Sie, tags: ['willkommen', 'sie'] } }] });
  let ue = await fulfillment('GET', '/api/fulfillment');
  const prozesse = (ue.prozesse ?? []) as { id: string; art: string; titel: string }[];
  const paket = (titel: string) => prozesse.find(p => p.art === 'paket' && p.titel === titel)?.id;
  const pakete: Record<string, string> = {};
  for (const [schluessel, m] of [['hos-cso', MUSTER_P1], ['sales-systematik', MUSTER_P2], ['netzwerk-vertrieb', MUSTER_P3]] as const) { const id = paket(m.titel); if (id) pakete[schluessel] = id; }

  // 2) Bausteine und Abläufe über den Import (Vorschau → übernehmen).
  const bausteine = await importieren(k, 'demo-bausteine.json', demoBausteine(), { pakete });
  const ablaeufe = await importieren(k, 'demo-ablaeufe.json', demoAblaeufe());

  // 2b) 14.10. (Abnahme B20: „Strategie-Begleitung läuft nach Vertriebsleitung auf Zeit“): die Pakete heißen wie das, was sie in der Demo liefern —
  //     Vorlage UND ihr Kasten auf der Landkarte. 15.10. (Abnahme B4): Produkt, Mandat und Paket heißen „Vertriebsaufbau“ — der Inhalt (Recruiting,
  //     Ansprache, Huddle) ist ein Vertriebsaufbau; so sieht der Kunde nur, was zu seinem Auftrag passt. Das dritte Muster (Netzwerk-Vertrieb) passt zu keinem Demo-Produkt und fällt weg (seine Bausteine
  //     bleiben in der Bibliothek). Nur über die Vorlagen-Route (Ops `vorlage`, `knoten`, `knoten-weg`, `vorlage-weg`).
  ue = await fulfillment('GET', '/api/fulfillment');
  type VorlageJ = { id: string; art: string; knoten: { id: string; elternId?: string; titel: string; verweis?: string; kundeSichtbar?: boolean }[] };
  const alle = (ue.prozesse ?? []) as VorlageJ[];
  const lk = alle.find(p => p.art === 'landkarte');
  const umbenennen: J[] = [];
  for (const [schluessel, titel] of [['hos-cso', 'Vertriebsaufbau'], ['sales-systematik', 'Cockpit-Einführung']] as const) {
    const id = pakete[schluessel];
    if (!id) continue;
    umbenennen.push({ op: 'vorlage', eintrag: { id, titel } });
    const kasten = lk?.knoten.find(x => x.verweis === id);
    if (lk && kasten) umbenennen.push({ op: 'knoten', vorlageId: lk.id, eintrag: { id: kasten.id, titel } });
    // Die Phasen, die der Import angelegt hat (Vorlauf, Analyse, Diagnose …), sind — wie die Phasen des Musters — für den Kunden sichtbar: so zeigt die
    // Kunden-Seite dieselbe Reise (Phase 1 von 11) wie der Fall. Der Sammelknoten „Weitere Bausteine“ bleibt intern.
    const v = alle.find(p => p.id === id);
    const w = v?.knoten.find(x => !x.elternId);
    for (const ph of v && w ? v.knoten.filter(x => x.elternId === w.id && !x.kundeSichtbar && x.titel !== WEITERE_BAUSTEINE) : []) umbenennen.push({ op: 'knoten', vorlageId: id, eintrag: { id: ph.id, kundeSichtbar: true } });
    // 15.10. (Abnahme B1): auch die Schritte direkt unter den Phasen (Diagnosebericht, Quick Wins …) sind Lieferungen an den Kunden — so nennt die
    // Kunden-Seite denselben nächsten Schritt wie der Fall. Sammel-Knoten des Imports bleiben intern.
    const sammel = new Set([WEITERE_BAUSTEINE, SAMMEL_SCHRITT, SAMMEL_ALLGEMEIN]);
    const phasenIds = new Set(v && w ? v.knoten.filter(x => x.elternId === w.id && x.titel !== WEITERE_BAUSTEINE).map(x => x.id) : []);
    for (const st of v ? v.knoten.filter(x => x.elternId && phasenIds.has(x.elternId) && !x.kundeSichtbar && !sammel.has(x.titel)) : []) umbenennen.push({ op: 'knoten', vorlageId: id, eintrag: { id: st.id, kundeSichtbar: true } });
  }
  if (pakete['netzwerk-vertrieb']) {
    const kasten = lk?.knoten.find(x => x.verweis === pakete['netzwerk-vertrieb']);
    if (lk && kasten) umbenennen.push({ op: 'knoten-weg', vorlageId: lk.id, id: kasten.id });
    umbenennen.push({ op: 'vorlage-weg', id: pakete['netzwerk-vertrieb'] });
  }
  // In Paketen zu höchstens 60 Änderungen (Grenze der Route) — die Vorlage-Löschung zuletzt, nach den Änderungen an der Landkarte.
  for (let i = 0; i < umbenennen.length; i += 50) await fulfillment('PATCH', '/api/fulfillment', { ops: umbenennen.slice(i, i + 50) });

  // 3) Produkte ↔ Paket-Vorlage.
  const zuordnung: J[] = [];
  if (pakete['hos-cso'] && k.leistungen.includes('l-demo-retainer')) zuordnung.push({ op: 'zuordnung', leistungId: 'l-demo-retainer', vorlageId: pakete['hos-cso'] });
  if (pakete['sales-systematik'] && k.leistungen.includes('l-demo-software')) zuordnung.push({ op: 'zuordnung', leistungId: 'l-demo-software', vorlageId: pakete['sales-systematik'] });
  if (zuordnung.length) await fulfillment('PATCH', '/api/fulfillment', { ops: zuordnung });

  // 4) Zwei Fälle.
  ue = await fulfillment('GET', '/api/fulfillment');
  const rituale = (ue.rituale ?? []) as { id: string; titel: string; rhythmus: string }[];
  const kickoff = rituale.find(r => r.rhythmus === 'einmal')?.id;
  const wochencheck = rituale.find(r => r.rhythmus === 'woche')?.id;
  const nordwerk = k.mandate.find(m => m.id === 'm-demo-nordwerk');
  const lumen = k.mandate.find(m => m.id === 'm-demo-lumen');
  let faelle = 0;
  if (nordwerk && pakete['hos-cso']) {
    // Die Geschichte (12.10., „kundenreif“ — ein Musterfall von Anfang bis zur Mitte, ohne Widersprüche): Unterschrift vor 46 Tagen, Start vor 45,
    // Kick-off vor 42 (Vereinbarung, F0, F1), Analyse bis vor 26 Tagen (Dossier geprüft, F2), seitdem Diagnose. Quick Wins, Fragen und Maßnahmen
    // kommen aus der geprüften Diagnose (`geschichteSaeen`, nach der Analyse-Saat); Reports vor 28 und 14 Tagen, Puls vor 16 Tagen 7, heute 8.
    await k.rufe(k.routen.fall(), 'POST', '/api/fulfillment/fall', L, { aktion: 'starten', mandatId: nordwerk.id, vorlageId: pakete['hos-cso'], start: tagPlus(k.heute, -45), anfrageId: 'ff-demo-start-nordwerk' });
    faelle++;
    // Ziele am Mandat (die Wahrheit für „was ist das Ziel“) — fehlen sie, legt der Fall sie über `ziel-neu` an.
    let f0 = await fallLesen(nordwerk.id);
    if (!(((f0.mandat as J | undefined)?.ziele ?? []) as unknown[]).length) {
      await fallOps(nordwerk.id, [{ op: 'ziel-neu', text: 'Monatliches Kennzahlen-Review etabliert' }, { op: 'ziel-neu', text: 'Qualifizierte Erstgespräche je Monat' }]);
      f0 = await fallLesen(nordwerk.id);
    }
    const ziele = ((f0.mandat as J | undefined)?.ziele ?? []) as { id: string }[];
    // Der Wochen-Check steht im Kalender (Termin-Stand der Saat, „Wochen-Check Nordwerk“): Bezug zum Mandat + am Fall vermerkt — ALLE Termine, auch die
    // schon gelaufenen dieser Woche (15.10., Abnahme B3: „Diese Woche“ war leer). Die Mitschrift steht am Tag des letzten gelaufenen Wochen-Checks.
    const wochenTermine = await kundenTermineVerknuepfen('Wochen-Check Nordwerk', nordwerk.id, L);
    const letzterCheck = wochenTermine.map(t => t.tag).filter(t => t <= k.heute).sort().at(-1) ?? tagPlus(k.heute, -3);
    const ops: J[] = [
      // Am Tag der Unterschrift gesendet (vor 46 Tagen) — sonst zählte das Erfolgsmaß „Willkommen in 24 Stunden“ den Musterfall als verspätet (Abnahme B6).
      { op: 'willkommen-gesendet', am: tagPlus(k.heute, -46) },
      ...(nordwerk.kontaktIds[0] ? [{ op: 'stakeholder', eintrag: { kontaktId: nordwerk.kontaktIds[0], rolle: 'entscheider', einfluss: 3, haltung: 'positiv', notiz: 'Trägt das Projekt, will die Zahlen jede Woche sehen.' } }] : []),
      { op: 'vereinbarung', felder: {
        rollen: 'Geschäftsführung entscheidet, Vertriebsleitung führt den Alltag.', reaktionszeiten: 'Antwort binnen zwei Werktagen.',
        wirBrauchen: 'Die Zahlen der Woche bis Montag 12 Uhr.', eskalation: 'Im Steering, sonst direkt an die Geschäftsführung.',
        scopeDrin: 'Vertrieb und Kennzahlen.', scopeDraussen: 'Marketing-Kampagnen und Website.', entscheidungsrechte: 'Preise entscheidet der Kunde.',
        bestaetigtAm: tagPlus(k.heute, -42), bestaetigtWie: 'kickoff',
      } },
      { op: 'entscheidung', eintrag: { titel: 'Zielgruppe zuerst: Maschinenbau im Umkreis', status: 'entschieden', wer: 'beide', geteilt: true, am: tagPlus(k.heute, -40) } },
      { op: 'entscheidung', eintrag: { titel: 'Erstgespräche nach fester Agenda', inhalt: 'Bedarf, Engpass, Ziel, nächster Schritt — für alle im Vertrieb.', status: 'entschieden', wer: 'beide', geteilt: true, am: tagPlus(k.heute, -21) } },
      { op: 'entscheidung', eintrag: { titel: 'Neues Angebot für Bestandskunden', status: 'offen', wer: 'kunde', geteilt: true, frist: tagPlus(k.heute, 5), am: tagPlus(k.heute, -4) } },
      ...(kickoff ? [{ op: 'ritual-merken', ritualId: kickoff, terminUid: 'makeos-demo-kickoff-nordwerk' }] : []),
      ...(wochencheck ? wochenTermine.map(t => ({ op: 'ritual-merken', ritualId: wochencheck, terminUid: t.id })) : []),
      // Die Ziele stehen am Mandat (auch in der alten Text-Form — lib/crm/mandat-ziele.ts erhält sie); je Ziel Ausgang, Zielwert, Datum, festgelegt im Kick-off.
      ...ziele.slice(0, 2).map((z, i) => ({ op: 'wert-ziel', zielId: z.id, felder: i === 0
        // Festgelegt im Kick-off (vor 42 Tagen) — vor der ersten Messung (15.10., Abnahme B6: vorher „festgelegt heute“ über Messungen seit Wochen).
        ? { ausgang: 'Kennzahlen nur einmal im Quartal angesehen', ausgangZahl: 4, zielZahl: 12, einheit: 'Reviews/Jahr', zielBis: tagPlus(k.heute, 60), richtung: 'hoch', festlegen: true, festgelegtAm: tagPlus(k.heute, -42) }
        : { ausgang: 'Drei Erstgespräche im Monat, ohne festen Ablauf', ausgangZahl: 3, zielZahl: 8, einheit: 'Gespräche/Monat', zielBis: tagPlus(k.heute, 90), richtung: 'hoch', festlegen: true, festgelegtAm: tagPlus(k.heute, -42) } })),
      ...(ziele[0] ? [[-35, 5], [-21, 7], [-7, 9]].map(([t, wert]) => ({ op: 'wert-messung', zielId: ziele[0].id, wert, am: tagPlus(k.heute, t) })) : []),
      ...(ziele[1] ? [[-21, 4], [-7, 5]].map(([t, wert]) => ({ op: 'wert-messung', zielId: ziele[1].id, wert, am: tagPlus(k.heute, t) })) : []),
      { op: 'freigabe', id: 'F0', kunde: { wie: 'kickoff', am: tagPlus(k.heute, -42) }, am: tagPlus(k.heute, -42) },
      { op: 'mitschrift', eintrag: { anlass: 'Kick-off', ergebnis: 'Ziele, Rollen und Takt vereinbart; Analyse-Umfang bestätigt.', naechster: 'Analyse starten und Unterlagen anfordern', frist: tagPlus(k.heute, -35), am: tagPlus(k.heute, -42), ...(kickoff ? { ritualId: kickoff } : {}) } },
      { op: 'mitschrift', eintrag: { anlass: 'Wochen-Check', ergebnis: 'Zwei neue Termine aus der Nachfass-Liste.', naechster: 'Angebot für den Bestandskunden vorbereiten', frist: tagPlus(letzterCheck, 7), am: letzterCheck, ...(wochencheck ? { ritualId: wochencheck } : {}) } },
      { op: 'befaehigung', id: 'bf-1', erfuellt: true, am: tagPlus(k.heute, -8) },
    ];
    await fallOps(nordwerk.id, ops);
    // Fortschritt bis in die Diagnose: Vorlauf erledigt (Kick-off vor 42 Tagen), Analyse erledigt (F2 vor 26 Tagen), die Diagnose läuft.
    const f1 = await fallLesen(nordwerk.id);
    const knoten = (((f1.fall as J | undefined)?.knoten ?? []) as KnotenJ[]);
    const wurzel = knoten.find(x => !x.elternId);
    const phasen = knoten.filter(x => x.elternId === wurzel?.id).sort((a, b) => a.rang - b.rang);
    const unter = (id: string): KnotenJ[] => knoten.filter(x => x.elternId === id).flatMap(x => [x, ...unter(x.id)]);
    const weiter: J[] = [];
    const freigaben = new Map<string, string>();
    phasen.slice(0, 2).forEach((p, i) => {
      const am = tagPlus(k.heute, i === 0 ? -42 : -26);
      for (const x of [p, ...unter(p.id)]) {
        if (x.id.startsWith('fk-ob')) continue; // Onboarding-Schritte (abgeleitet) samt Playbook-Formular bleiben, wie sie sind
        if (x.freigabe) freigaben.set(x.freigabe, am);
        else if (x.status !== 'erledigt') weiter.push({ op: 'knoten-status', id: x.id, status: 'erledigt', am });
      }
    });
    for (const [id, am] of freigaben) if (id !== 'F0') weiter.push({ op: 'freigabe', id, am });
    if (phasen[2] && !phasen[2].id.startsWith(OB_PRAEFIX)) {
      weiter.push({ op: 'knoten-status', id: phasen[2].id, status: 'in_arbeit', am: tagPlus(k.heute, -26) });
      const bericht = unter(phasen[2].id).find(x => /diagnosebericht/i.test(x.titel));
      if (bericht) weiter.push({ op: 'knoten-status', id: bericht.id, status: 'in_arbeit', am: tagPlus(k.heute, -10) });
    }
    if (weiter.length) await fallOps(nordwerk.id, weiter);
  }
  if (lumen && pakete['sales-systematik']) {
    await k.rufe(k.routen.fall(), 'POST', '/api/fulfillment/fall', L, { aktion: 'starten', mandatId: lumen.id, vorlageId: pakete['sales-systematik'], start: tagPlus(k.heute, -2), anfrageId: 'ff-demo-start-lumen' });
    faelle++;
    if (lumen.kontaktIds[0]) await fallOps(lumen.id, [{ op: 'stakeholder', eintrag: { kontaktId: lumen.kontaktIds[0], rolle: 'sponsor', einfluss: 2 } }]);
    // Die „Cockpit-Abstimmung Lumen“ (donnerstags im Kalender) gehört zum Mandat — ab dem Start des Falls (15.10., Abnahme B3: der Fall kannte sie nicht).
    // Kein Ritual: sie steht im Takt unter „Weitere Termine“, ist der nächste Termin und macht „Kick-off terminiert“ wahr.
    await kundenTermineVerknuepfen('Cockpit-Abstimmung Lumen', lumen.id, L, tagPlus(k.heute, -2));
  }
  return [
    { name: 'Fulfillment: Vorlagen aus dem Muster', anzahl: Object.keys(pakete).length },
    { name: 'Fulfillment: Bausteine', anzahl: bausteine + 1 },
    { name: 'Fulfillment: Abläufe', anzahl: ablaeufe },
    { name: 'Fulfillment: Fälle', anzahl: faelle },
  ];
}

/**
 * Termine aus dem Termin-Stand der Saat (`calendar-cache`, lib/demo/saat.ts) bekommen ihren Bezug zum Mandat (`kalender-bezug`, wie ihn der Kalender-Dialog
 * beim Anlegen schreibt) — Ausnahme (hier begründet, wie der Termin-Stand selbst): die Demo hat keinen iCloud-Kalender, also auch keinen Anlege- oder
 * Änderungsweg (die Termin-Route findet Mac-Termine nicht). Schlüssel = die Kennung des Termins (so finden ihn Kalender, Takt und Kunden-Seite).
 * `ab` = erst ab diesem Tag (z. B. dem Start des Falls). Liefert Kennung und Tag (sortiert).
 */
async function kundenTermineVerknuepfen(titel: string, mandatId: string, von: string, ab?: string): Promise<{ id: string; tag: string }[]> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { bezugSetzen } = await import('@/lib/kalender/bezug-server');
  const stand = await loadJson<{ events?: { id: string; title: string; startDate: string; calendarName: string }[] }>('calendar-cache');
  const termine = (stand?.events ?? []).filter(e => e.title === titel && (!ab || e.startDate.slice(0, 10) >= ab)).map(e => ({ id: e.id, tag: e.startDate.slice(0, 10) })).sort((a, b) => a.tag.localeCompare(b.tag));
  for (const t of termine) await bezugSetzen(t.id, { mandatId, tag: t.tag, art: 'termin', von });
  return termine;
}

/**
 * Der zweite Teil der Geschichte — NACH der Analyse-Saat (das Dossier ist dann geprüft): Quick Wins, Fragen und Maßnahmen der Diagnose gehen per
 * „in den Fall“ über (dieselben zwei Schritte wie im Browser: die Dossier-Route liefert die Ops, die Fall-Route schreibt), ein Quick Win ist erledigt,
 * die Fragen wurden im Wochen-Check gestellt. Dazu zwei Fortschritts-Reports (vor 28 und 14 Tagen, gesendet) und der frühere Puls (vor 16 Tagen: 7) —
 * Ausnahme (begründet): die Routen kennen nur „jetzt“, darum über die EINE Schreibstelle mit `jetzt` in der Vergangenheit.
 */
export async function geschichteSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const L = k.inhaber;
  const m = k.mandate.find(x => x.id === 'm-demo-nordwerk');
  if (!m) return [];
  let n = 0;
  for (const was of ['quickwins', 'fragen', 'massnahmen'] as const) {
    try {
      const r = await k.rufe(k.routen.dossier(), 'POST', '/api/fulfillment/dossier', L, { aktion: 'nach-fall', mandatId: m.id, was });
      const body = r.body as { mandatId: string; ops: J[] } | undefined;
      if (body?.ops?.length) { await k.rufe(k.routen.fall(), 'PATCH', '/api/fulfillment/fall', L, body); n += body.ops.length; }
    } catch { /* ohne Diagnose (z. B. Analyse ausgelassen) bleibt der Fall, wie er ist */ }
  }
  const f = (await k.rufe(k.routen.fall(), 'GET', `/api/fulfillment/fall?m=${encodeURIComponent(m.id)}`, L)).fall as { quickWins: { id: string; text: string }[]; kickoffFragen: { id: string }[]; knoten: { id: string; titel: string; status: string }[] } | null;
  const ops: J[] = [];
  // Quick Wins (30 Tage) im Fenster des Falls (15.10., Abnahme B6: „bis 14.11. · erledigt 27.09.“ bei Start 31.08.): fällig bis Start + 30, alle drei
  // erreicht — der erste (Agenda) zuerst, die anderen kurz danach. Der Schritt „Quick Wins“ der Diagnose ist damit erledigt.
  const fensterEnde = tagPlus(k.heute, -15);
  const qw = [...(f?.quickWins ?? [])].sort((a, b) => (/agenda/i.test(a.text) ? -1 : /agenda/i.test(b.text) ? 1 : 0));
  qw.forEach((q, i) => ops.push({ op: 'quickwin', id: q.id, bis: fensterEnde, erledigt: true, am: tagPlus(k.heute, [-18, -16, -15][i] ?? -15) }));
  const qwSchritt = f?.knoten.find(x => /^quick wins$/i.test(x.titel.trim()) && x.status !== 'erledigt');
  if (qw.length && qwSchritt) ops.push({ op: 'knoten-status', id: qwSchritt.id, status: 'erledigt', am: fensterEnde });
  for (const q of f?.kickoffFragen ?? []) ops.push({ op: 'kickoff-frage', id: q.id, erledigt: true });
  if (ops.length) await k.rufe(k.routen.fall(), 'PATCH', '/api/fulfillment/fall', L, { mandatId: m.id, ops });
  // Reports (Leistungstreppe): erstellt und gesendet vor 28 und vor 14 Tagen — heute ist der dritte fällig.
  let reports = 0;
  try {
    const { reportErstellen, treppeSchreiben } = await import('@/lib/crm/treppe-server');
    for (const t of [-28, -14]) {
      const jetzt = new Date(`${tagPlus(k.heute, t)}T10:00:00Z`);
      await reportErstellen(m.id, L, jetzt);
      await treppeSchreiben([{ op: 'report-gesendet', mandatId: m.id }], L, { art: 'person', person: L }, jetzt);
      reports++;
    }
  } catch { /* ohne Leistungstreppe kein Report — der Fall zeigt dann „noch kein Report“ */ }
  // Der frühere Puls (vor 16 Tagen 7 — damals in die Health übernommen: Stimmung 70 am Mandat); der heutige (8) kommt aus lib/demo/fulfillment-kunde.ts.
  const { pulsHandEintragen } = await import('@/lib/fulfillment/kunde/server');
  await pulsHandEintragen(m.id, 7, 'Gute Struktur, die Zahlen kommen noch zu spät.', L, new Date(`${tagPlus(k.heute, -16)}T09:00:00Z`));
  return [{ name: 'Fulfillment · Aus der Diagnose in den Fall', anzahl: n }, { name: 'Fulfillment · Reports', anzahl: reports }];
}
