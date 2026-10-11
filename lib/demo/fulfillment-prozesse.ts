// ─── MAKE OS — Demo-Instanz: Fulfillment · Prozesse (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 12.7) ────────────────────────────────────
// Landkarte und drei Paket-Vorlagen aus dem Muster, rund 25 erfundene Bausteine über den Import (zwei „rechtlich prüfen“, einer „nur intern“,
// einer „vor Verkauf prüfen“, ein Huddle mit Zahlenrunde), drei erfundene Abläufe (Trichter, Fluss mit Weichen, Zeitachse — mit Rückweg und
// gestrichelter Ergänzung), Zuordnung der Demo-Produkte, zwei Fälle: Lumen im Onboarding (Willkommensmail überfällig), Nordwerk in der
// Umsetzung (Wert-Konto mit drei Messungen, Stakeholder, Entscheidungen, Mitschrift, Kick-off). Alles über die Routen (`k.rufe`), erfunden
// und neutral (Wächter tests/demo.test.ts).

import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';
import { MUSTER_P1, MUSTER_P2, MUSTER_P3 } from '@/lib/fulfillment/muster';
import { WILLKOMMEN_GERUEST, OB_PRAEFIX } from '@/lib/fulfillment/prozesse/onboarding';
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

/** Drei erfundene Abläufe im Format der Ablauf-Dateien (je Ablauf `stufen`, `uebergaenge`). */
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
    await k.rufe(k.routen.fall(), 'POST', '/api/fulfillment/fall', L, { aktion: 'starten', mandatId: nordwerk.id, vorlageId: pakete['hos-cso'], start: tagPlus(k.heute, -60), anfrageId: 'ff-demo-start-nordwerk' });
    faelle++;
    // Ziele am Mandat (die Wahrheit für „was ist das Ziel“) — fehlen sie, legt der Fall sie über `ziel-neu` an.
    let f0 = await fallLesen(nordwerk.id);
    if (!(((f0.mandat as J | undefined)?.ziele ?? []) as unknown[]).length) {
      await fallOps(nordwerk.id, [{ op: 'ziel-neu', text: 'Qualifizierte Termine je Monat' }, { op: 'ziel-neu', text: 'Planung über zwölf Monate' }]);
      f0 = await fallLesen(nordwerk.id);
    }
    const ziele = ((f0.mandat as J | undefined)?.ziele ?? []) as { id: string }[];
    const ops: J[] = [
      { op: 'willkommen-gesendet' },
      ...(nordwerk.kontaktIds[0] ? [{ op: 'stakeholder', eintrag: { kontaktId: nordwerk.kontaktIds[0], rolle: 'entscheider', einfluss: 3, haltung: 'positiv' } }] : []),
      { op: 'vereinbarung', felder: {
        rollen: 'Geschäftsführung entscheidet, Vertriebsleitung führt den Alltag.', reaktionszeiten: 'Antwort binnen zwei Werktagen.',
        wirBrauchen: 'Die Zahlen der Woche bis Montag 12 Uhr.', eskalation: 'Im Steering, sonst direkt an die Geschäftsführung.',
        scopeDrin: 'Vertrieb und Kennzahlen.', scopeDraussen: 'Marketing-Kampagnen und Website.', entscheidungsrechte: 'Preise entscheidet der Kunde.',
        bestaetigtAm: tagPlus(k.heute, -55), bestaetigtWie: 'kickoff',
      } },
      { op: 'entscheidung', eintrag: { titel: 'Zielgruppe zuerst: Maschinenbau im Umkreis', status: 'entschieden', wer: 'beide', geteilt: true } },
      { op: 'entscheidung', eintrag: { titel: 'Neues Angebot für Bestandskunden', status: 'offen', wer: 'kunde', geteilt: true, frist: tagPlus(k.heute, 5) } },
      ...(kickoff ? [{ op: 'ritual-merken', ritualId: kickoff, terminUid: 'makeos-demo-kickoff-nordwerk' }] : []),
      { op: 'knoten-status', id: `${OB_PRAEFIX}playbook`, status: 'entfaellt', grund: 'Im Kick-off gemeinsam besprochen.' },
      ...ziele.slice(0, 2).map((z, i) => ({ op: 'wert-ziel', zielId: z.id, felder: i === 0
        ? { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine/Monat', zielBis: tagPlus(k.heute, 60), richtung: 'hoch', festlegen: true }
        : { ausgang: 'Planung nur für drei Monate', ausgangZahl: 3, zielZahl: 12, einheit: 'Monate', zielBis: tagPlus(k.heute, 90), richtung: 'hoch', festlegen: true } })),
      ...(ziele[0] ? [[-50, 5], [-30, 7], [-10, 9]].map(([t, wert]) => ({ op: 'wert-messung', zielId: ziele[0].id, wert, am: tagPlus(k.heute, t) })) : []),
      { op: 'freigabe', id: 'F0', kunde: { wie: 'kickoff', am: tagPlus(k.heute, -55) } },
      { op: 'quickwins-setzen', quickWins: [{ text: 'Nachfass-Liste der offenen Angebote', bis: tagPlus(k.heute, 3) }, { text: 'Wochen-Zahlen auf einer Seite', bis: tagPlus(k.heute, 10) }] },
      { op: 'mitschrift', eintrag: { anlass: 'Wochen-Check', ergebnis: 'Zwei neue Termine aus der Nachfass-Liste.', naechster: 'Angebot für den Bestandskunden vorbereiten', frist: tagPlus(k.heute, 4), am: tagPlus(k.heute, -3), ...(wochencheck ? { ritualId: wochencheck } : {}) } },
      { op: 'befaehigung', id: 'bf-1', erfuellt: true },
    ];
    await fallOps(nordwerk.id, ops);
    // Fortschritt bis in die Umsetzung: die ersten beiden Phasen erledigt (Freigaben vermerkt), die dritte läuft.
    const f1 = await fallLesen(nordwerk.id);
    const knoten = (((f1.fall as J | undefined)?.knoten ?? []) as KnotenJ[]);
    const wurzel = knoten.find(x => !x.elternId);
    const phasen = knoten.filter(x => x.elternId === wurzel?.id).sort((a, b) => a.rang - b.rang);
    const unter = (id: string): KnotenJ[] => knoten.filter(x => x.elternId === id).flatMap(x => [x, ...unter(x.id)]);
    const weiter: J[] = [];
    const freigaben = new Set<string>();
    for (const p of phasen.slice(0, 2)) {
      for (const x of [p, ...unter(p.id)]) {
        if (x.id.startsWith(OB_PRAEFIX)) continue;
        if (x.freigabe) freigaben.add(x.freigabe);
        else if (x.status !== 'erledigt') weiter.push({ op: 'knoten-status', id: x.id, status: 'erledigt' });
      }
    }
    for (const id of freigaben) if (id !== 'F0') weiter.push({ op: 'freigabe', id, kunde: { wie: 'termin', am: tagPlus(k.heute, -20) } });
    if (phasen[2] && !phasen[2].id.startsWith(OB_PRAEFIX)) weiter.push({ op: 'knoten-status', id: phasen[2].id, status: 'in_arbeit' });
    if (weiter.length) await fallOps(nordwerk.id, weiter);
  }
  if (lumen && pakete['sales-systematik']) {
    await k.rufe(k.routen.fall(), 'POST', '/api/fulfillment/fall', L, { aktion: 'starten', mandatId: lumen.id, vorlageId: pakete['sales-systematik'], start: tagPlus(k.heute, -2), anfrageId: 'ff-demo-start-lumen' });
    faelle++;
    if (lumen.kontaktIds[0]) await fallOps(lumen.id, [{ op: 'stakeholder', eintrag: { kontaktId: lumen.kontaktIds[0], rolle: 'sponsor', einfluss: 2 } }]);
  }
  return [
    { name: 'Fulfillment: Vorlagen aus dem Muster', anzahl: Object.keys(pakete).length },
    { name: 'Fulfillment: Bausteine', anzahl: bausteine + 1 },
    { name: 'Fulfillment: Abläufe', anzahl: ablaeufe },
    { name: 'Fulfillment: Fälle', anzahl: faelle },
  ];
}
