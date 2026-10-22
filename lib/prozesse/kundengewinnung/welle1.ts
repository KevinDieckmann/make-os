// ─── Prozesse · Kundengewinnung — Welle 1: vorhandene Quellen, reine Regeln (V09, V07, V13, V12, V08, V15) ─────────────────────────────────────────────
// research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 2 „Bau-Reihenfolge“: diese Vorlagen brauchen nur Zeitplan, Datum am Fall und `deal-stufe` — Quellen, die angebunden
// sind; kein Agent ist Pflicht. Jede Vorlage ist eine gültige Definition (lib/prozesse/definition-pruefen.ts), Personen sind Rollen, nichts geht ohne Schloss
// nach außen. Rein und client-sicher.

import { S, B, V, prozess, abfrageListe, STANDARD_ABBRUCH, EIGNER, ZUSTAENDIG, AN_ANSPRECHPARTNER, type KgVorlage, type KgTeil } from './bau';

// ── V09 · Deal ohne nächsten Schritt / hängender Deal ─────────────────────────────────────────────────────────────────────────────────────────────────
const V09A: KgTeil = {
  id: 'kg-v09a', titel: 'Einen hängenden Deal klären', offen: [],
  definition: prozess({
    id: 'kg-v09a', titel: 'Einen hängenden Deal klären', bereich: 'sales', fallArt: 'deal',
    beschreibung: 'Teilprozess von „Deal ohne nächsten Schritt“: je Deal einen nächsten Schritt vorschlagen — bei Dauer-Verschiebung entscheidet ein Mensch.',
    startKriterium: 'Ein offener Deal mit Ampel rot oder gelb bzw. ohne nächsten Schritt (aus der Schleife).',
    endKriterium: 'Der Deal hat einen nächsten Schritt mit Datum, oder er ist geschlossen bzw. geparkt.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Klären', schritte: [
        S.hand('t', 'Je Deal (aus der Schleife)'),
        S.regel('a1', 'Weniger als zweimal verschoben?', [B.kleiner('deal.verschoben', 2)], { zweige: { ja: 'a2', nein: 'a5' }, pfeil: { ja: 'ja', nein: 'zweimal und öfter' } }),
        S.mensch('a5', 'Weiterführen — oder parken bzw. verlieren?', 'Weiterführen (ja) — oder parken bzw. verlieren (nein)? Parken braucht die Wiedervorlage, verlieren den Grund.', ZUSTAENDIG, { zweige: { ja: 'a2', nein: 'a6' }, frist: 3 }),
        S.aufgabe('a6', 'Deal parken oder verlieren', { titel: 'Deal parken (mit Wiedervorlage) oder verlieren (mit Grund)', fristTage: 3, beschreibung: 'In der Deal-Akte die Stufe setzen — die Regel verlangt Grund bzw. Wiedervorlage. Ein gewonnener Deal mit Mandat wird nie verloren.' }, { zweige: { ja: 'e1' } }),
        S.ziel('e1', 'Geparkt bzw. verloren'),
        S.head('a2', 'Nächsten Schritt vorschlagen', 'sales', {
          auftrag: 'Lies die Deal-Akte, die letzten Aktivitäten und offene Angebote. Schlage EINEN nächsten Schritt vor: Kanal und in wie vielen Tagen. Nur Kennungen und Zahlen im Ergebnis.',
          warum: 'Der passende Schritt hängt vom Gesprächsstand ab — das steht in Notizen, nicht in Feldern.', budgetCent: 5, modell: 'schnell',
          ausgabe: [V.zahl('intagen'), V.wahl('kanal', ['telefon', 'mail', 'termin'])],
        }),
      ] },
      { titel: 'Nachhalten', schritte: [
        S.dealSchritt('a3', 'Nächsten Schritt setzen', 2, 'Nächster Schritt (aus dem Vorschlag)'),
        S.wartenEreignis('a4', 'Bewegung abwarten', 'deal-stufe', 5, { zweige: { abgelaufen: 'a7' } }),
        S.glocke('a7', 'Eskalieren', 'Ein Deal bewegt sich nicht — bitte ansehen.', EIGNER),
        S.ziel('ez', 'Deal hat einen nächsten Schritt'),
      ] },
    ],
  }),
};
const V09: KgVorlage = {
  id: 'kg-v09', nr: 'V09', welle: 1, titel: 'Deal ohne nächsten Schritt / hängender Deal', bereich: 'sales', fallArt: 'keiner', eignerRolle: 'sales',
  zweck: 'Jeden Werktag werden Deals ohne nächsten Schritt, mit überfälligem Schritt, lange still oder mehrfach verschoben aufgegriffen — ein nächster Schritt wird vorgeschlagen, bei Dauer-Verschiebung wird entschieden.',
  ausloeserText: 'werktags 08:30', braucht: ['ki'], uebergabeAn: [],
  recht: ['Keine Außenwirkung.', 'Gewonnen → verloren ist gesperrt, solange ein Mandat oder ein angenommenes Angebot da ist — der Prozess schlägt es nie vor.'],
  kennzahlen: ['traktion:ohne_schritt', 'traktion:haengt_wert', 'Prozesse: Anteil hängender Deals, die in 5 Werktagen wieder grün sind'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '08:30', knoten: 't', feld: 'uhrzeit' }, { id: 'hoechstens', label: 'Höchstens je Lauf', vorgabe: 30, knoten: 'l', feld: 'hoechstens' },
    { id: 'verschobenAb', label: 'Entscheidung ab … verschoben', vorgabe: 2 }, { id: 'vorschlagTage', label: 'Vorschlag gilt (Tage)', vorgabe: 2 },
    { id: 'bewegungTage', label: 'Bewegung abwarten (Tage)', vorgabe: 5 }, { id: 'budgetCent', label: 'Budget je Agenten-Schritt (Cent)', vorgabe: 5 },
  ],
  offen: [{ punkt: 'Ampel-Schwellen', text: 'Die Schwellen der Ampel stehen fest in lib/crm/pipeline.ts `gesundheit` — die Vorlage liest sie dort ab (nie doppelt).' }],
  demo: 'Zwei Saat-Deals: einer mit überfälligem Schritt, einer mit zweimal verschobener Entscheidung — ein Schritt-Vorschlag und eine Entscheidung.',
  teile: [V09A],
  definition: prozess({
    id: 'kg-v09', titel: 'Deal ohne nächsten Schritt / hängender Deal', bereich: 'sales', fallArt: 'keiner',
    beschreibung: 'Jeden Werktag hängende Deals aufgreifen: nächster Schritt als Vorschlag, bei Dauer-Verschiebung eine Entscheidung. Je Deal läuft der Teilprozess „Einen hängenden Deal klären“.',
    startKriterium: 'Werktags um 08:30 — alle offenen Deals mit Ampel rot/gelb oder ohne nächsten Schritt.',
    endKriterium: 'Jeder gefundene Deal ist geklärt (Teilprozess) und die Lage gemeldet.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Hängende Deals', schritte: [
      S.zeitplan('t', 'Werktags 08:30', 'werktags', '08:30'),
      S.abfrage('q', 'Hängende Deals finden', { art: 'deals-haengen', hoechstens: 30 }),
      S.regel('r', 'Hängt etwas?', [B.groesser('abfrage.anzahl', 0)], { zweige: { nein: 'e0' } }),
      S.ziel('e0', 'Heute hängt nichts'),
      S.schleife('l', 'Jeden Deal klären', abfrageListe('kg-v09', 'q'), 'kg-v09a', 30),
      S.glocke('g', 'Lage melden', 'Hängende Deals sind aufgegriffen — Details in der Werkstatt (ohne Beträge).', EIGNER),
      S.ziel('ez'),
    ] }],
  }),
};

// ── V07 · Power-Hour-Vorbereitung jeden Morgen ────────────────────────────────────────────────────────────────────────────────────────────────────────
const V07: KgVorlage = {
  id: 'kg-v07', nr: 'V07', welle: 1, titel: 'Power-Hour-Vorbereitung jeden Morgen', bereich: 'sales', fallArt: 'keiner', eignerRolle: 'sales',
  zweck: 'Jeden Werktag liegt für jede Person die Power-Hour-Liste bereit: wer heute dran ist, mit Grund, Aufhänger, Kanal und Leitfaden — wer gerade geschrieben hat, steht oben.',
  ausloeserText: 'werktags 07:00 je Person', braucht: ['kalender'], uebergabeAn: [],
  recht: ['Die Karten kommen aus `werIstDran` — ausgenommene Personen fehlen dort schon.', 'Bei gelbem Telefon ist der Anlass Pflicht (die Aktivitäts-Route verlangt ihn ohnehin).'],
  kennzahlen: ['traktion:power_hours (Ziel 4 je Woche)', 'traktion:gespraeche', 'Prozesse: Anteil der Werktage mit gehaltener Power Hour'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '07:00', knoten: 't', feld: 'uhrzeit' }, { id: 'n', label: 'Karten', vorgabe: 12, knoten: 'q', feld: 'hoechstens' },
    { id: 'geradeStunden', label: '„Gerade geschrieben“ (Stunden)', vorgabe: 72 }, { id: 'block', label: 'Block einplanen', vorgabe: true },
    { id: 'blockDauer', label: 'Dauer des Blocks (Minuten)', vorgabe: 60, knoten: 'b', feld: 'dauerMin' }, { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 15 },
  ],
  offen: [{ punkt: 'E3 (Landkarte)', text: 'Läuft heute schon im Head-Takt (`power_hour`). Die Landkarte zeigt ihn zuerst als System-Kachel; in den Motor wandert er erst mit Gold-Test (keine zweite Wahrheit).' }],
  demo: 'Für eine erfundene Person der Demo stehen 6 Karten bereit, wer gestern geschrieben hat, steht oben; ein Block 10:00–11:00 liegt im Stapel.',
  teile: [],
  definition: prozess({
    id: 'kg-v07', titel: 'Power-Hour-Vorbereitung jeden Morgen', bereich: 'sales', fallArt: 'keiner',
    beschreibung: 'Die Liste der Power Hour liegt vor 08:00 bereit — Grundlauf zuerst (Regelwerk), das Modell ordnet nur. Ein Block im Kalender wird vorgeschlagen.',
    startKriterium: 'Werktags um 07:00, je Person mit Konto im Team.', endKriterium: 'Die Liste ist da; am Abend zählt eine Power Hour als gehalten.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Vorbereiten', schritte: [
      S.zeitplan('t', 'Werktags 07:00', 'werktags', '07:00'),
      S.abfrage('q', 'Wer ist heute dran?', { art: 'powerhour-karten', hoechstens: 12 }),
      S.regel('r', 'Karten da?', [B.groesser('abfrage.anzahl', 0)], { zweige: { nein: 'e0' } }),
      S.ziel('e0', 'Heute keine Karten'),
      S.head('h', 'Liste begründen', 'sales', {
        auftrag: 'Modus Power Hour: der Grundlauf (Regelwerk) steht zuerst — ordne nur und begründe die ersten fünf Karten mit Aufhänger und Kanal. Wer in den letzten 72 Stunden geschrieben hat, steht oben.',
        warum: 'Aufhänger und Reihenfolge hängen vom Verlauf der Gespräche ab, nicht nur von Feldern.', budgetCent: 15, ausgabe: [V.zahl('mitbegruendung')],
      }),
      S.block('b', 'Power Hour einplanen', { titel: 'Power Hour', dauerMin: 60 }),
      S.ziel('ez', 'Liste liegt bereit'),
    ] }],
  }),
};

// ── V13 · Verloren / keine Entscheidung → Auswertung + Wiedervorlage ──────────────────────────────────────────────────────────────────────────────────
const V13: KgVorlage = {
  id: 'kg-v13', nr: 'V13', welle: 1, titel: 'Verloren / keine Entscheidung → Auswertung + Wiedervorlage', bereich: 'sales', fallArt: 'deal', eignerRolle: 'sales',
  zweck: 'Jeder verlorene oder geparkte Deal wird kurz ausgewertet, damit Gründe in Zielkundenprofil, Scoring und Angebote zurückfließen — wo der Grund es erlaubt, mit echter Wiedervorlage.',
  ausloeserText: 'Deal in Stufe „verloren“ oder „geparkt“', braucht: ['ki'], uebergabeAn: ['kg-v08'],
  recht: ['Ein kurzes Gespräch über den Grund ist zulässig (Anlass aus der Beziehung), eine werbliche Mail nicht.', 'Die Auswertung bleibt intern — keine Personennamen in Deal-Titeln (Art. 17).'],
  kennzahlen: ['traktion:win_rate', 'Anteil „Keine Entscheidung“ (fester Grund seit 22.10.)', 'Prozesse: Anteil ausgewerteter Abschlüsse'],
  einstellbar: [
    { id: 'auswertenTage', label: 'Auswerten in (Tagen)', vorgabe: 5, knoten: 'a2', feld: 'fristTage' }, { id: 'wiederTageW', label: 'Wiedervorlage bei Zeitpunkt & Co. (Tage)', vorgabe: 90, knoten: 'w', feld: 'parkTage' },
    { id: 'wiederTageP', label: 'Wiedervorlage bei Preis/Wettbewerb (Tage)', vorgabe: 180, knoten: 'p', feld: 'parkTage' }, { id: 'auchGewonnen', label: 'Auch nach einem Gewinn auswerten', vorgabe: false },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 8, knoten: 'a3', feld: 'budgetCent' },
  ],
  offen: [{ punkt: 'Rückfluss', text: 'Ein Weg „Hinweis an Scoring/ICP“ fehlt — bis dahin entsteht über die Auswertung eine Aufgabe für den Eigner.' }],
  demo: 'Ein erfundener Deal an einer Beispiel-Kanzlei, verloren mit „Zeitpunkt“: Auswertungs-Aufgabe, Kurzfassung im Stapel, Wiedervorlage in 90 Tagen.',
  teile: [],
  definition: prozess({
    id: 'kg-v13', titel: 'Verloren / keine Entscheidung → Auswertung + Wiedervorlage', bereich: 'sales', fallArt: 'deal',
    beschreibung: 'Kurz auswerten (drei Fragen), ZOE fasst zusammen, die Erkenntnis steht am Deal — und je nach Grund kommt der Lead in 90 bzw. 180 Tagen wieder (V08).',
    startKriterium: 'Ein Deal wechselt auf „verloren“ oder „geparkt“ (Grund ist Pflicht).', endKriterium: 'Die Auswertung ist notiert und die Wiedervorlage gesetzt oder bewusst „keine“.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Auswerten', schritte: [
        S.ereignis('t', 'Deal verloren oder geparkt', 'deal-stufe', [B.einer('ereignis.stufe', ['verloren', 'geparkt'])]),
        S.aufgabe('a2', 'Abschluss auswerten (10 Min.)', { titel: 'Abschluss auswerten (10 Min.)', fristTage: 5, beschreibung: 'Drei Fragen: Was gab den Ausschlag? Wer hat entschieden? Was hätte geholfen?' }),
        S.zoe('a3', 'Auswertung zusammenfassen', {
          auftrag: 'Fasse Deal-Historie, Aktivitäten und die Auswertungsnotiz zusammen. Ergebnis: wohin der Hinweis gehört (Zielkundenprofil, Scoring, Angebot oder keiner).',
          warum: 'Muster aus Verlauf und Notizen erkennt keine Feldregel.', budgetCent: 8, ausgabe: [V.wahl('hinweis', ['icp', 'scoring', 'angebot', 'keiner'])],
        }),
        S.notiz('a4', 'Erkenntnis am Deal festhalten', 'Auswertung zum Abschluss von „{{deal.titel}}“ (Kurzfassung aus der Auswertung).'),
      ] },
      { titel: 'Wiedervorlage', schritte: [
        S.regel('r1', 'Grund erlaubt eine Wiedervorlage?', [B.einer('deal.grund', ['Zeitpunkt', 'Keine Rückmeldung', 'Kein Entscheider', 'Keine Entscheidung']), B.ist('deal.stufe', 'geparkt')], { oder: true, zweige: { nein: 'r2' } }),
        S.regel('r2', 'Preis oder Wettbewerb?', [B.einer('deal.grund', ['Preis', 'Wettbewerb'])], { zweige: { ja: 'p', nein: 'k' } }),
        S.ziel('k', 'Keine Wiedervorlage'),
        S.parken('w', 'Wiedervorlage in 90 Tagen', 90, 'spaeter'),
        S.uebergabe('ew', 'Wiedervorlage gesetzt', 'kg-v08'),
        S.parken('p', 'Wiedervorlage später', 180, 'budget_spaeter'),
        S.uebergabe('ep', 'Wiedervorlage gesetzt (später)', 'kg-v08'),
      ] },
    ],
  }),
};

// ── V12 · Gewonnen → Übergabe mit Uhr → Fulfillment ───────────────────────────────────────────────────────────────────────────────────────────────────
const V12: KgVorlage = {
  id: 'kg-v12', nr: 'V12', welle: 1, titel: 'Gewonnen → Übergabe mit Uhr → Fulfillment', bereich: 'uebergabe', fallArt: 'deal', eignerRolle: 'sales',
  zweck: 'Sobald ein Deal gewonnen ist, startet die Übergabe sofort mit Frist: Mandat, Übergabe-Checkliste, Fall-Start, Willkommen in 24 Stunden und Kickoff ohne Lücke.',
  ausloeserText: 'Deal in Stufe „gewonnen“', braucht: ['postfach', 'kalender', 'mandate', 'fulfillment'], uebergabeAn: [],
  recht: ['Kommunikation im neuen Mandat ist frei; werbliche Mail an Bestandskunden nur mit Hinweis bei Erhebung.', 'Das Mandat trägt Honorar (MRR, Index) — Klasse Geld, angelegt nur per Klick (E-V3).', 'Die Einladung mit Gästen geht nur nach Rückfrage.'],
  kennzahlen: ['Tage von „gewonnen“ bis Kickoff (Leitkennzahl)', 'Stunden bis Willkommen', 'Prozesse: Anteil der Übergaben mit allen acht Blöcken in 2 Werktagen'],
  einstellbar: [
    { id: 'mandatStunden', label: 'Mandat in (Stunden)', vorgabe: 24 }, { id: 'uebergabeTage', label: 'Übergabe in (Werktagen)', vorgabe: 2, knoten: 'a3', feld: 'fristTage' },
    { id: 'vertragTage', label: 'Vertrag in (Werktagen)', vorgabe: 5, knoten: 'a4v', feld: 'fristTage' }, { id: 'willkommenStunden', label: 'Willkommen in (Stunden)', vorgabe: 24 },
    { id: 'kickoffTage', label: 'Kickoff spätestens nach (Tagen)', vorgabe: 14 },
  ],
  offen: [
    { punkt: 'Parallele Uhr', text: 'Die Uhr der ganzen Übergabe (2 Werktage, parallel zu den Schritten) kennt das Modell nicht — es gelten die Fristen der Schritte; das Ereignis „Mandat angelegt“ (E4) ist da.' },
  ],
  demo: 'Der Saat-Deal wird über das angenommene Angebot gewonnen: Mandat-Vorschlag und Übergabe-Aufgabe sofort, Willkommen am Folgetag, Kickoff in 9 Tagen.',
  teile: [],
  definition: prozess({
    id: 'kg-v12', titel: 'Gewonnen → Übergabe mit Uhr → Fulfillment', bereich: 'uebergabe', fallArt: 'deal',
    beschreibung: 'Ohne Lücke von „gewonnen“ zum Kickoff: Mandat (ein Klick), acht Übergabe-Blöcke, Vertrag, Fall-Start, Willkommen, Kickoff — danach führt der Fulfillment-Prozess.',
    startKriterium: 'Ein Business-Deal wechselt auf „gewonnen“ (auch über ein angenommenes Angebot).', endKriterium: 'Fall gestartet, Willkommen gesendet, Kickoff terminiert.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Mandat & Übergabe', schritte: [
        S.ereignis('t', 'Deal gewonnen', 'deal-stufe', [B.ist('ereignis.stufe', 'gewonnen')]),
        S.regel('a1', 'Mandat schon da?', [B.ist('deal.mandat-da', true)], { zweige: { nein: 'a2' } }),
        S.mandat('a2', 'Mandat anlegen', { schloss: { nein: 'a2g' } }),
        S.glocke('a2g', 'Mandat abgelehnt', 'Das Mandat zum gewonnenen Deal wurde nicht angelegt — bitte ansehen.', EIGNER, { zweige: { ja: 'e0' } }),
        S.aufgabe('a3', 'Übergabe vervollständigen', { titel: 'Übergabe vervollständigen (acht Blöcke)', fristTage: 2, prioritaet: 'high', beschreibung: 'Kunde · Umfang · Zeit · Geld · Personal · Risiken · Erwartungen · Kickoff.' }),
        S.regel('a4', 'Vertrag unterschrieben?', [B.ist('deal.vertrag-unterschrieben', true)], { zweige: { nein: 'a4v' } }),
        S.aufgabe('a4v', 'Vertrag unterschreiben lassen', { titel: 'Vertrag unterschreiben lassen', fristTage: 5, prioritaet: 'high' }),
        S.abbruch('e0', 'Ohne Mandat beendet'),
      ] },
      { titel: 'Start', schritte: [
        S.fallStarten('a5', 'Fall starten'),
        S.regel('a6', 'Darf die Willkommens-Mail raus?', [B.ist('deal.ampel-mail', 'gruen')], { zweige: { nein: 'a6p' } }),
        S.aufgabe('a6p', 'Persönlich begrüßen', { titel: 'Persönlich begrüßen (Mail nicht frei)', fristTage: 1 }, { zweige: { ja: 'a8' } }),
        S.mail('a7', 'Willkommen in 24 Stunden', { betreff: 'Willkommen — so starten wir', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nschön, dass wir mit „{{deal.titel}}“ starten. In den nächsten Tagen melden wir uns mit dem Termin für den Auftakt.' }),
        S.einladung('a8', 'Kickoff terminieren', { titel: 'Auftakt', dauerMin: 60, gaeste: AN_ANSPRECHPARTNER }),
        S.ziel('ez', 'Startklar — weiter im Fulfillment'),
      ] },
    ],
  }),
};

// ── V08 · Geparkte Leads wiederbeleben ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V08: KgVorlage = {
  id: 'kg-v08', nr: 'V08', welle: 1, titel: 'Geparkte Leads wiederbeleben', bereich: 'sales', fallArt: 'lead', eignerRolle: 'sales',
  zweck: 'Am Tag der Wiedervorlage wird ein geparkter Lead geprüft: neue Signale → Reaktivierung mit Anlass; sonst bewusst neu parken oder ausscheiden. Kein Lead verschwindet still.',
  ausloeserText: 'am Tag der Wiedervorlage des Leads, 08:00', braucht: [], uebergabeAn: ['kg-v03'],
  recht: ['Reaktivierung per Mail nur mit Grundlage (Kanal-Ampel).', 'Am Telefon braucht es einen Anlass aus der Beziehung.', 'Ein ausgeschiedener Lead bleibt in der Kartei — die Löschfristen gelten unverändert.'],
  kennzahlen: ['Rückkehrquote aus der Pflege zu SQL', 'Tage von der Wiedervorlage bis zur Entscheidung', 'Prozesse: Anteil der Wiedervorlagen, die in 5 Tagen entschieden wurden'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '08:00', knoten: 't', feld: 'uhrzeit' }, { id: 'recherche', label: 'Recherche bei fehlenden Signalen', vorgabe: false },
    { id: 'entscheidTage', label: 'Entscheiden in (Tagen)', vorgabe: 5, knoten: 'a6', feld: 'frist' }, { id: 'parkTage', label: 'Neu parken für (Tage)', vorgabe: 90, knoten: 'a6p', feld: 'parkTage' },
    { id: 'reaktionTage', label: 'Reaktion abwarten (Tage)', vorgabe: 14, knoten: 'a8', feld: 'hoechstensTage' },
  ],
  // M2 (Wiedereintritt nach neuer Wiedervorlage) ist seit dem Datums-Start gebaut (22.10.: je Fall und Stichtag ein Lauf — lib/prozesse/datum-start.ts).
  offen: [{ punkt: 'M6', text: 'Die optionale Recherche (Research mit Ausgabe-Vertrag, Felder nur als Vorschlag mit Häkchen je Feld) läuft im Motor — in dieser Vorlage ist sie aus (Einstellung „Recherche“); einschalten heißt: einen Research-Schritt vor „Wie weiter?“ einsetzen.' }],
  demo: 'Eine erfundene Druckerei, geparkt mit „Budget kommt später“, Wiedervorlage heute; ein neues Signal (Event-Anmeldung) → Aufgabe „Reaktivieren“.',
  teile: [],
  definition: prozess({
    id: 'kg-v08', titel: 'Geparkte Leads wiederbeleben', bereich: 'sales', fallArt: 'lead',
    beschreibung: 'Am Tag der Wiedervorlage: neue Signale → Reaktivieren mit Anlass; sonst entscheidet ein Mensch: reaktivieren, neu parken oder kein Fit.',
    startKriterium: 'Ein Lead „ruht“ und seine Wiedervorlage ist heute.', endKriterium: 'Der Lead steht wieder auf „kontaktiert“ oder höher, ist neu geparkt oder auf „kein Fit“.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Prüfen', schritte: [
        S.datum('t', 'Am Tag der Wiedervorlage', 'lead.wiedervorlage', 0, '08:00', false, [B.ist('lead.status', 'ruht')]),
        S.regel('a2', 'Ohne neue Signale seit dem Parken?', [B.ist('lead.neue-signale', false)], { zweige: { nein: 'a4' }, pfeil: { ja: 'keine Signale', nein: 'neue Signale' } }),
        S.aufgabe('a4', 'Reaktivieren mit Anlass', { titel: 'Reaktivieren mit Anlass', fristTage: 3, beschreibung: 'Anlass, bester Kanal (Ampel) und Grund des Parkens stehen in der Akte. „Nicht erreicht“: einen anderen Kanal wählen.' }),
      ] },
      { titel: 'Entscheiden', schritte: [
        S.mensch('a6', 'Wie weiter?', 'Reaktivieren (ja) — oder neu parken bzw. kein Fit (nein)?', ZUSTAENDIG, { zweige: { nein: 'a6p' }, frist: 5 }),
        S.parken('a6p', 'Neu parken', 90, 'spaeter', { zweige: { ja: 'ep' } }),
        S.qualifizieren('a7', 'Lead aktivieren', 'kontaktiert'),
        S.wartenEreignis('a8', 'Reaktion abwarten', 'neue-mail', 14, { zweige: { abgelaufen: 'a8e' } }),
        { id: 'a8e', titel: 'Noch einmal entscheiden', baustein: 'lauf.erneut-ab', feld: { erneut: { ab: 'kg-v08:a6', hoechstens: 1 } } },
        S.uebergabe('ez', 'Reaktion da — weiter in „Mail eines Leads“', 'kg-v03'),
        S.ziel('ep', 'Neu geparkt'),
      ] },
    ],
  }),
};

// ── V15 · Bestandskunden-Ausbau & Verlängerung ────────────────────────────────────────────────────────────────────────────────────────────────────────
const V15: KgVorlage = {
  id: 'kg-v15', nr: 'V15', welle: 1, titel: 'Bestandskunden-Ausbau & Verlängerung', bereich: 'ausbau', fallArt: 'mandat', eignerRolle: 'kundenerfolg',
  zweck: '90 Tage vor Laufzeitende über Ergebnisse sprechen statt auf die Kündigungsfrist zu warten — daraus ein Verlängerungsangebot oder ein Ausbau-Deal; die Kündigungsfrist ist nie eine Überraschung.',
  ausloeserText: '90 Tage vor dem Ende des Mandats', braucht: ['kalender', 'mandate', 'ki'], uebergabeAn: ['kg-v14'],
  recht: ['Kommunikation im laufenden Mandat ist frei; ein werbliches Angebot per Mail verlangt bei Bestandskunden den Hinweis bei Erhebung.', 'Das Verlängerungsangebot wird nur per Klick gestellt.'],
  kennzahlen: ['traktion:mrr', 'Verlängerungsquote (fehlt noch)', 'Prozesse: Anteil der Mandate mit Review ≥ 60 Tage vor Ende'],
  einstellbar: [
    { id: 'vorEndeTage', label: 'Vor dem Ende (Tage)', vorgabe: 90, knoten: 't', feld: 'versatzTage' }, { id: 'healthGelb', label: 'Risiko ab Health unter', vorgabe: 60 },
    { id: 'reviewTage', label: 'Review in (Tagen)', vorgabe: 14 }, { id: 'kuendigungVorlaufTage', label: 'Vorlauf vor der Kündigungsfrist (Tage)', vorgabe: 14, knoten: 'a8', feld: 'versatzTage' },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 15, knoten: 'a3', feld: 'budgetCent' },
  ],
  // M2 (Wiedereintritt je Periode: Prozess + Mandat + Ende) ist seit dem Datums-Start gebaut (22.10., lib/prozesse/datum-start.ts).
  offen: [{ punkt: 'E9', text: 'Ausbau-Auslöser mitten in der Laufzeit (Ziel erreicht, Report erstellt) kommt mit dem Lauf-Motor.' }],
  demo: 'Das Saat-Mandat bekommt Mindestlaufzeit und Kündigungsfrist (Ende in 85 Tagen): Review-Einladung im Stapel, danach ein Ausbau-Deal-Vorschlag.',
  teile: [],
  definition: prozess({
    id: 'kg-v15', titel: 'Bestandskunden-Ausbau & Verlängerung', bereich: 'ausbau', fallArt: 'mandat',
    beschreibung: 'Lage lesen, Risiko klären, Ergebnisse gegen Ziele aufbereiten, Review mit dem Entscheider — dann Verlängerungsangebot bzw. Ausbau-Deal und ein Blick auf die Kündigungsfrist.',
    startKriterium: 'Ein aktives Mandat erreicht 90 Tage vor seinem Ende.', endKriterium: 'Verlängert, Ausbau-Deal angelegt oder bewusster Abschied (dann Empfehlung, V14).',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Lage & Review', schritte: [
        S.datum('t', '90 Tage vor dem Ende', 'mandat.ende', -90, '09:00', false, [B.ist('mandat.status', 'aktiv')]),
        S.akte('a1', 'Lage lesen'),
        S.regel('a2', 'Ohne Risiko?', [B.nicht('mandat.ampel', 'rot'), B.groesser('mandat.health', 59)], { zweige: { nein: 'a2r' } }),
        S.aufgabe('a2r', 'Risiko-Gespräch', { titel: 'Risiko-Gespräch führen', fristTage: 5, prioritaet: 'high' }),
        S.head('a3', 'Ergebnisse gegen Ziele aufbereiten', 'kundenerfolg', {
          auftrag: 'Bereite die Ergebnisse des Mandats gegen seine Ziele auf (Wirkung, Reports) und nenne, ob es einen Ausbau-Anlass oder ein Risiko gibt.',
          warum: 'Wirkung und Anlass stehen in Reports und Gesprächen, nicht in einem Feld.', budgetCent: 15, ausgabe: [V.janein('ausbauanlass'), V.janein('risiko')],
        }),
        S.einladung('a4', 'Review-Termin mit dem Entscheider', { titel: 'Review', dauerMin: 60, gaeste: AN_ANSPRECHPARTNER }),
      ] },
      { titel: 'Verlängern & Ausbau', schritte: [
        S.regel('a5', 'Verlängert es sich von selbst?', [B.ist('mandat.verlaengerung', 'auto')], { zweige: { nein: 'a6' } }),
        S.angebotEntwurf('a6', 'Verlängerungsangebot entwerfen'),
        S.mensch('a7', 'Ausbau-Signal im Review?', 'Gab es im Review ein Ausbau-Signal (nächster Engpass)?', ZUSTAENDIG, { zweige: { nein: 'a8' }, frist: 3 }),
        S.dealVorschlag('a7d', 'Ausbau-Deal vorschlagen', { naechsterSchritt: 'Ausbau-Optionen besprechen', inTagen: 5, titel: 'Ausbau' }, { zweige: { ja: 'a8' } }),
        S.wartenDatum('a8', 'Bis zur Kündigungsfrist', 'mandat.kuendigungsfrist', -14, 90, { zweige: { ja: 'a9' } }),
        S.regel('a9', 'Verlängerung gesichert?', [B.ist('mandat.verlaengert', true)], { zweige: { nein: 'a9g' } }),
        S.glocke('a9g', 'Kündigungsfrist naht', 'Kündigungsfrist eines Mandats in 14 Tagen — Verlängerung noch offen.', EIGNER, { zweige: { ja: 'eu' } }),
        S.ziel('ez', 'Verlängert'),
        S.uebergabe('eu', 'Abschied — weiter mit „Empfehlung anfragen“', 'kg-v14'),
      ] },
    ],
  }),
};

export const WELLE_1: readonly KgVorlage[] = [V09, V07, V13, V12, V08, V15];
