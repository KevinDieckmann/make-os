// ─── Prozesse · Kundengewinnung — Welle 3: neue Quellen (V11, V04, V17, V18, V06, V16) ────────────────────────────────────────────────────────────────
// research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 2: diese Vorlagen hören auf neue Ereignisse — Termin vorbei (E1, Lauf-Motor), Netzwerken-Erfassung (E2),
// Buchung (E5), Event-Status (E7), Kampagne (E11), Einwilligung (E6) — gespeist in lib/ereignisse/quellen-kundengewinnung.ts bzw. vom Lauf-Motor.
// Rein und client-sicher.

import {
  S, B, V, prozess, abfrageListe, STANDARD_ABBRUCH, EIGNER, ZUSTAENDIG, C1_EREIGNIS, type KgVorlage, type KgTeil,
} from './bau';

// ── V11 · Termin-Nachbereitung 24 h ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V11: KgVorlage = {
  id: 'kg-v11', nr: 'V11', welle: 3, titel: 'Termin-Nachbereitung 24 h', bereich: 'sales', fallArt: 'deal', eignerRolle: 'sales',
  zweck: 'Nach jedem Termin mit CRM-Bezug ist binnen 24 Stunden festgehalten, wie es lief, und ein nächster Schritt angelegt — ZOE entwirft Zusammenfassung und Follow-up, ein Mensch gibt frei.',
  ausloeserText: 'Termin mit CRM-Bezug vorbei', braucht: ['kalender', 'ki', 'postfach'], uebergabeAn: [],
  recht: ['Termin-Titel können Text Dritter tragen — danach nur Vorschläge.', 'Private Termine der anderen Person sind maskiert und nie Auslöser.', 'Die Zusammenfassung an den Kunden ist KI-Text nach außen und trägt die KI-Kennzeichnung (Art. 50).'],
  kennzahlen: ['Anteil nachbereitet in 24 Std. (Leitkennzahl)', 'traktion:gespraeche', 'traktion:erstgespraeche'],
  einstellbar: [
    { id: 'fristStunden', label: '„Wie lief’s?“ in (Werktagen)', vorgabe: 1, knoten: 'a2', feld: 'fristTage' }, { id: 'mailVorschlag', label: 'Mail an den Kontakt vorschlagen', vorgabe: true },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 10, knoten: 'a4', feld: 'budgetCent' },
  ],
  offen: [{ punkt: 'Fall Termin', text: 'Ein Termin ohne Deal (nur Firma bzw. Lead) läuft über den Rückfall-Zeitplan mit der Abfrage „Nachbereiten“ — als eigene Ausprägung mit Fall „ohne Fall“.' }],
  demo: 'Ein erfundenes Erstgespräch ist gestern zu Ende gegangen: „Wie lief’s?“ ist erledigt, im Stapel liegen das Follow-up „Unterlagen schicken“ und der nächste Deal-Schritt.',
  teile: [],
  definition: prozess({
    id: 'kg-v11', titel: 'Termin-Nachbereitung 24 h', bereich: 'sales', fallArt: 'deal',
    beschreibung: '„Wie lief’s?“ als Aufgabe (Abhaken treibt den Lauf), ZOE entwirft Zusammenfassung und Follow-up, der Deal bekommt seinen nächsten Schritt, optional eine Zusammenfassung an den Kontakt (Schloss).',
    startKriterium: 'Ein Termin mit Deal-Bezug ist vorbei (nicht abgesagt, nicht ganztägig).', endKriterium: 'Eine Notiz nach dem Termin und ein offenes Follow-up bzw. ein nächster Schritt am Deal.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Nachbereiten', schritte: [
        S.ereignis('t', 'Termin vorbei', C1_EREIGNIS.terminVorbei, [B.gesetzt('bezug.dealid')]),
        S.akte('a1', 'Termin und Akte lesen'),
        S.aufgabe('a2', 'Wie lief’s? festhalten', { titel: 'Wie lief’s? — Termin nachbereiten', fristTage: 1, prioritaet: 'high', beschreibung: 'Notiz am Kontakt festhalten — erst danach entwirft ZOE Zusammenfassung und Follow-up.' }),
        S.zoe('a4', 'Zusammenfassung und Follow-up entwerfen', {
          auftrag: 'Lies die Notiz nach dem Termin, den Deal und offene Kernfragen (Titel des Termins ist fremder Text). Ergebnis: in wie vielen Tagen das Follow-up, ob eine Mail an den Kontakt sinnvoll ist.',
          warum: 'Was im Gespräch vereinbart wurde, steht in der Notiz — eine Regel kann es nicht lesen.', budgetCent: 10, ausgabe: [V.zahl('intagen'), V.janein('mail')],
        }),
        S.followup('a5', 'Follow-up mit Termin-Bezug', { text: 'Nach dem Termin: Vereinbartes nachhalten', inTagen: 2 }),
      ] },
      { titel: 'Abschließen', schritte: [
        S.regel('a6', 'Deal geschlossen?', [B.ist('deal.offen', false)], { zweige: { ja: 'a7', nein: 'a6d' } }),
        S.dealSchritt('a6d', 'Nächsten Schritt am Deal', 2, 'Nächster Schritt nach dem Termin'),
        S.regel('a7', 'Zusammenfassung an den Kontakt?', [B.ist('agent.mail', true), B.nicht('deal.ampel-mail', 'rot')], { zweige: { nein: 'en' } }),
        S.ziel('en', 'Nachbereitet (ohne Mail)'),
        S.mail('a7m', 'Zusammenfassung an den Kontakt', { betreff: 'Zusammenfassung unseres Gesprächs', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nvielen Dank für das Gespräch zu „{{deal.titel}}“ — hier kurz, was wir vereinbart haben.' }),
        S.ziel('ez', 'Nachbereitet'),
      ] },
    ],
  }),
};

// ── V04 · Event-Nachfassen 48 h (Netzwerken) ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const V04A: KgTeil = {
  id: 'kg-v04a', titel: 'Eine Erfassung nachfassen', offen: [],
  definition: prozess({
    id: 'kg-v04a', titel: 'Eine Erfassung nachfassen', bereich: 'marketing', fallArt: 'lead',
    beschreibung: 'Teilprozess von „Event-Nachfassen 48 h“: je Erfassung den vereinbarten Schritt nachhalten — Danke-Mail nur nach einem Gespräch und nie mit Werbung, sonst ein Follow-up.',
    startKriterium: 'Eine Erfassung eines besuchten Events ohne Nachfassen und ohne Verzicht.', endKriterium: 'Nachgefasst (Danke raus bzw. Follow-up) oder bewusst verzichtet.',
    zettel: `${STANDARD_ABBRUCH} Eine Visitenkarte ist keine Einwilligung — kein Danke ohne Gespräch, nach 14 Tagen keins mehr, nie Angebot oder Einladung im Danke (§ 7 UWG).`,
    phasen: [
      { titel: 'Prüfen', schritte: [
        S.hand('t', 'Je Erfassung (aus der Schleife)'),
        S.regel('b1', 'Nachfassen vereinbart?', [B.nicht('lead.netzwerken-schritt', 'nur-kontakt')], { zweige: { nein: 'e0' } }),
        S.ziel('e0', 'Nur Kontakt — zählt nicht'),
        S.regel('b1b', 'Kein Termin vereinbart?', [B.nicht('lead.netzwerken-schritt', 'termin')], { zweige: { nein: 'e1' } }),
        S.ziel('e1', 'Termin — zählt nach dem Kalender-Schritt'),
      ] },
      { titel: 'Nachfassen', schritte: [
        S.regel('b2', 'Danke möglich?', [B.ist('lead.danke-moeglich', true)], { zweige: { nein: 'b5' } }),
        S.followup('b5', 'Follow-up sichern', { text: 'Nachfassen nach der Begegnung', inTagen: 2 }, { zweige: { ja: 'b6' } }),
        S.mail('b3', 'Danke-Mail entwerfen', { betreff: 'Danke für das Gespräch', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\ndanke für das gute Gespräch — wie besprochen melde ich mich.' }, { schloss: { nein: 'b3v' } }),
        S.ziel('b3v', 'Bewusst verzichtet'),
        S.wartenEreignis('b6', 'Bis zur Frist', C1_EREIGNIS.followupErledigt, 2, { arbeitszeit: true, zweige: { abgelaufen: 'b7' } }),
        S.glocke('b7', 'Frist abgelaufen', 'Eine Erfassung ist nicht rechtzeitig nachgefasst.', ZUSTAENDIG),
        S.ziel('ez', 'Nachgefasst'),
      ] },
    ],
  }),
};
const V04: KgVorlage = {
  id: 'kg-v04', nr: 'V04', welle: 3, titel: 'Event-Nachfassen 48 h (Netzwerken)', bereich: 'marketing', fallArt: 'event', eignerRolle: 'event',
  zweck: 'Jede auf einem besuchten Event erfasste Person ist binnen 48 Stunden (zwei Werktagen) nachgefasst — Danke-Entwurf, Follow-up oder Termin —, sichtbar mit „offen · rechtzeitig“.',
  ausloeserText: 'am Tag des Events, 19:00', braucht: ['events', 'postfach'], uebergabeAn: [],
  recht: ['Eine Visitenkarte ist keine Einwilligung — kein Danke ohne Gespräch.', 'Im Danke stehen kein Angebot und keine Einladung (§ 7 UWG); Art. 13 bei Neuanlage.', 'Nach 14 Tagen gibt es kein Danke mehr; Art. 18 bricht die Schleife je Person ab.'],
  kennzahlen: ['besuche_followup (Leitkennzahl, zwei Werktage — E-V7)', 'besuche_kontakte', 'besuche_deals'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '19:00', knoten: 't', feld: 'uhrzeit' }, { id: 'fristTage', label: 'Frist (Werktage)', vorgabe: 2, knoten: 'a5', feld: 'tage' },
    { id: 'zielQuote', label: 'Ziel (%)', vorgabe: 80 }, { id: 'hoechstens', label: 'Höchstens je Lauf', vorgabe: 60, knoten: 'a2', feld: 'hoechstens' },
  ],
  offen: [{ punkt: 'E2', text: 'Je Erfassung meldet sich zusätzlich das Ereignis „Begegnung erfasst“ (E2) — die Schleife des Abends und ein Lauf je Erfassung teilen sich „ein Lauf je Fall“ (nichts doppelt).' }],
  demo: 'Ein erfundener „Beispiel-Unternehmertag“ mit drei Erfassungen (Qualifizieren, nur Kontakt, Follow-up): am Morgen 1 Danke im Stapel, 1 Follow-up, Quote 2/2.',
  teile: [V04A],
  definition: prozess({
    id: 'kg-v04', titel: 'Event-Nachfassen 48 h (Netzwerken)', bereich: 'marketing', fallArt: 'event',
    beschreibung: 'Am Abend des Events: offene Erfassungen finden, je Erfassung nachfassen (Teilprozess), Abendbericht, nach zwei Werktagen die Quote prüfen.',
    startKriterium: 'Ein besuchtes Event (Marke Netzwerken) — am Tag des Events um 19:00.', endKriterium: 'Jede Erfassung ist nachgefasst oder bewusst verzichtet.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Nachfassen', schritte: [
      S.datum('t', 'Am Tag des Events, 19:00', 'event.datum', 0, '19:00'),
      S.abfrage('a1', 'Offene Erfassungen finden', { art: 'netzwerken-offen', hoechstens: 60 }),
      S.schleife('a2', 'Jede Erfassung nachfassen', abfrageListe('kg-v04', 'a1'), 'kg-v04a', 60),
      S.head('a3', 'Abendbericht', 'event', {
        auftrag: 'Regelwerk zuerst (Abendbericht der Erfassungen) — ordne nur und nenne, wie viele noch offen sind.',
        warum: 'Die Reihenfolge des Nachfassens hängt von den Gesprächen des Abends ab.', budgetCent: 5, modell: 'schnell', ausgabe: [V.zahl('offen')],
      }),
      S.glocke('a4', 'Bericht melden', 'Der Abendbericht des Events liegt bereit.', EIGNER),
      S.wartenDauer('a5', '48 Stunden (zwei Werktage)', 2, { arbeitszeit: true }),
      // Ohne Erfassung, die schon fällig war, gibt es nichts zu messen (Feld leer) — dann ist nichts überfällig.
      S.regel('a6', 'Quote erreicht?', [B.groesser('event.quote-48h', 79), B.leer('event.quote-48h')], { oder: true, zweige: { nein: 'a6g' } }),
      S.glocke('a6g', 'Quote unter dem Ziel', 'Beim Nachfassen eines Events ist die Quote unter dem Ziel.', EIGNER),
      S.ziel('ez', 'Event nachgefasst'),
    ] }],
  }),
};

// ── V17 · Buchungsanfrage → Vorbereitung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V17: KgVorlage = {
  id: 'kg-v17', nr: 'V17', welle: 3, titel: 'Buchungsanfrage → Vorbereitung', bereich: 'sales', fallArt: 'lead', eignerRolle: 'sales',
  zweck: 'Eine Buchungsanfrage wird binnen einer Uhr freigegeben oder abgelehnt; bestätigte Termine werden vorbereitet (Leitfaden, offene Kernfragen, Deal- oder Qualifizierungs-Vorschlag) und danach nachbereitet (V11).',
  ausloeserText: 'Buchung angefragt', braucht: ['buchungsseite', 'kalender', 'ki'], uebergabeAn: ['kg-v11'],
  recht: ['Für die Buchung gilt Art. 6 Abs. 1 lit. b — das Häkchen ist eine Kenntnisnahme, keine Einwilligung; Werbung ist daraus nicht erlaubt.', 'Antworten der Gäste sind fremder Text — danach nur Vorschläge.', 'Ein CRM-Eintrag entsteht erst bei der Freigabe; Einladung an eine unbestätigte Adresse nur mit Warnhinweis.'],
  kennzahlen: ['Stunden bis zur Freigabe (Leitkennzahl)', 'angefragt → bestätigt → Deal/Qualifizierung', 'traktion:erstgespraeche (über V11)'],
  einstellbar: [
    { id: 'freigabeStunden', label: 'Freigabe binnen (Stunden)', vorgabe: 4 }, { id: 'eskalationStunden', label: 'Eskalation nach (Stunden)', vorgabe: 24, knoten: 'a2', feld: 'hoechstensStunden' },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 8, knoten: 'a5', feld: 'budgetCent' },
  ],
  offen: [{ punkt: 'Fall', text: 'Vor der Freigabe gibt es noch keinen Lead — der Lauf hängt erst ab „Buchung bestätigt“ an der Person (der Motor liest den Fall aus dem Ereignis).' }],
  demo: 'Eine erfundene Buchungsseite „Erstgespräch (Beispiel)“ bekommt eine Anfrage: Freigabe nach 2 Std., im Stapel „Qualifizierung starten“ und der Leitfaden für den Vortag.',
  teile: [],
  definition: prozess({
    id: 'kg-v17', titel: 'Buchungsanfrage → Vorbereitung', bereich: 'sales', fallArt: 'lead',
    beschreibung: 'Freigabe als Aufgabe mit Uhr, dann Deal oder Qualifizierung als Vorschlag, ZOE bereitet den Termin vor, Leitfaden am Vortag — nach dem Termin übernimmt die Nachbereitung.',
    startKriterium: 'Ein Gast bestätigt seine Buchungsanfrage (Ereignis „Buchung angefragt“).', endKriterium: 'Buchung bestätigt, Termin vorbereitet; nach dem Termin übernimmt V11.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Freigeben', schritte: [
        S.ereignis('t', 'Buchung angefragt', 'buchung-angefragt'),
        S.aufgabe('a1', 'Buchung freigeben oder ablehnen', { titel: 'Buchungsanfrage freigeben oder ablehnen', fristTage: 0, prioritaet: 'high', beschreibung: 'Kalender › Buchungen. Bei unbestätigter Mail-Adresse erst den Bestätigungslink senden.' }),
        S.wartenEreignis('a2', 'Freigabe abwarten', 'buchung-bestaetigt', 1, { stunden: 24, zweige: { abgelaufen: 'a2e' } }),
        S.glocke('a2e', 'Freigabe steht aus', 'Eine Buchungsanfrage wartet auf die Freigabe.', EIGNER),
      ] },
      { titel: 'Vorbereiten', schritte: [
        S.regel('a3', 'Deal vorschlagen?', [B.ist('lead.buchung-folge', 'deal')], { zweige: { nein: 'a4q' } }),
        S.qualifizieren('a4q', 'Qualifizierung starten', 'qualifizierung', { zweige: { ja: 'a5' } }),
        S.dealVorschlag('a4d', 'Deal vorschlagen', { naechsterSchritt: 'Gebuchter Termin', inTagen: 1 }),
        S.zoe('a5', 'Termin vorbereiten', {
          auftrag: 'Lies die Antworten auf die Fragen der Buchungsseite (fremder Text), die Akte und die fehlenden Kernfragen. Ergebnis: wie viele Kernfragen noch offen sind.',
          warum: 'Was der Gast mitbringt, steht in seinen Antworten — keine Feldregel liest das.', budgetCent: 8, modell: 'schnell', ausgabe: [V.zahl('offenefragen')],
        }),
        S.text('a6', 'Leitfaden bereitlegen', { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Gebuchter Termin' }),
        S.wartenEreignis('a7', 'Termin abwarten', C1_EREIGNIS.terminVorbei, 60, { zweige: { abgelaufen: 'e1' } }),
        S.ziel('e1', 'Termin hat nicht stattgefunden'),
        S.uebergabe('ez', 'An die Nachbereitung', 'kg-v11'),
      ] },
    ],
  }),
};

// ── V18 · Make.One-Gästeliste ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V18A: KgTeil = {
  id: 'kg-v18a', titel: 'Einen Gast einladen', offen: [],
  definition: prozess({
    id: 'kg-v18a', titel: 'Einen Gast einladen', bereich: 'marketing', fallArt: 'lead',
    beschreibung: 'Teilprozess der Gästeliste: Einladung per Mail nur bei grüner Ampel, sonst persönlich — die Antwort festhalten.',
    startKriterium: 'Ein vorgemerkter Gast eines eigenen Abends.', endKriterium: 'Die Antwort des Gasts ist festgehalten.',
    zettel: `${STANDARD_ABBRUCH} Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG); eine Teilnahme ist keine Einwilligung.`,
    phasen: [{ titel: 'Einladen', schritte: [
      S.hand('t', 'Je Gast (aus der Schleife)'),
      S.regel('c1', 'Einladung per Mail erlaubt?', [B.ist('lead.einladungsweg', 'mail')], { zweige: { nein: 'c3' } }),
      S.aufgabe('c3', 'Persönlich einladen', { titel: 'Persönlich einladen', fristTage: 7 }, { zweige: { ja: 'c4' } }),
      S.mail('c2', 'Einladung schreiben', { betreff: 'Einladung zu unserem Abend', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nwir laden Sie herzlich zu unserem nächsten Abend ein.' }),
      S.mensch('c4', 'Hat die Person zugesagt?', 'Zugesagt (ja) — oder abgesagt bzw. keine Antwort (nein)?', ZUSTAENDIG, { zweige: { nein: 'e1' } }),
      S.ziel('e1', 'Abgesagt bzw. keine Antwort'),
      S.ziel('ez', 'Zugesagt'),
    ] }],
  }),
};
const V18: KgVorlage = {
  id: 'kg-v18', nr: 'V18', welle: 3, titel: 'Make.One-Gästeliste', bereich: 'marketing', fallArt: 'event', eignerRolle: 'event',
  zweck: 'Für jeden eigenen Abend die Gästeliste in der richtigen Mischung aufbauen, einladen, erinnern und binnen 48 Stunden nachfassen — die Einladungs-Wege folgen der Ampel.',
  ausloeserText: '28 Tage vor dem Event', braucht: ['events', 'postfach', 'ki'], uebergabeAn: [],
  recht: ['Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG); eine Teilnahme ist keine Einwilligung.', 'Die Personen-Schranke prüft jede neue Teilnahme; bei Werbesperre wird niemand vorgemerkt.', 'Danke-Mails danach enthalten nur Dank und Verabredetes.'],
  kennzahlen: ['traktion:nachfassen_48h (zwei Werktage — E-V7)', 'traktion:erscheinen', 'traktion:folgegespraeche'],
  einstellbar: [
    { id: 'vorlaufTage', label: 'Vorlauf (Tage)', vorgabe: 28, knoten: 't', feld: 'versatzTage' }, { id: 'n', label: 'Gäste', vorgabe: 12, knoten: 'a1', feld: 'n' },
    { id: 'mixZielkunden', label: 'Zielkunden (%)', vorgabe: 40, knoten: 'a1', feld: 'mixZielkunden' }, { id: 'mixKunden', label: 'Kunden (%)', vorgabe: 20, knoten: 'a1', feld: 'mixKunden' },
    { id: 'ziel48h', label: 'Ziel Nachfassen (%)', vorgabe: 90 }, { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 10, knoten: 'a8', feld: 'budgetCent' },
  ],
  offen: [],
  demo: 'Ein erfundener „Beispiel-Stammtisch“ in 28 Tagen: 12 Gäste in der Mischung als Vorschlag (ein Klick merkt sie vor), dann 4 Mails im Stapel und 8 persönliche Einladungen — nach dem Abend 6 Nachfass-Entwürfe.',
  teile: [V18A],
  definition: prozess({
    id: 'kg-v18', titel: 'Make.One-Gästeliste', bereich: 'marketing', fallArt: 'event',
    beschreibung: 'Gäste in der Mischung vorschlagen, Checkliste, jeden Gast einladen (Teilprozess), eine Woche vorher die Mischung prüfen, am Vortag erinnern, am Tag danach nachfassen.',
    startKriterium: 'Ein eigener Abend (nie ein besuchtes Event) — 28 Tage vor dem Datum.', endKriterium: 'Das Event ist durchgeführt und alle Teilnehmenden sind binnen 48 Stunden nachgefasst.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Einladen', schritte: [
        S.datum('t', '28 Tage vor dem Event', 'event.datum', -28, '09:00'),
        S.gaeste('a1', 'Gäste vorschlagen', 12, 40, 20),
        S.aufgabe('a2', 'Checkliste als Aufgaben', { titel: 'Checkliste des Abends abarbeiten', wer: EIGNER, fristTage: 21 }),
        S.schleife('a3', 'Jeden Gast einladen', 'event.gaeste', 'kg-v18a', 24),
      ] },
      { titel: 'Vorher', schritte: [
        S.wartenDatum('a4', 'Eine Woche vorher', 'event.datum', -7, 30),
        S.regel('a5', 'Mischung erreicht?', [B.ist('event.mix-erreicht', true)], { zweige: { nein: 'a5h' } }),
        S.head('a5h', 'Weitere Gäste vorschlagen', 'event', {
          auftrag: 'Die Mischung ist noch nicht erreicht: schlage weitere Gäste vor (nur zulässige Einladungswege, Werbesperre nie).',
          warum: 'Wer zur Runde passt, ergibt sich aus Beziehung und Verlauf — nicht aus einem Feld.', budgetCent: 10, ausgabe: [V.zahl('weitere')],
        }),
        S.wartenDatum('a6', 'Bis zum Vortag', 'event.datum', -1, 30),
        S.aufgabe('a6e', 'Zugesagte erinnern', { titel: 'Zugesagte erinnern (Mail nur bei grüner Ampel)', wer: EIGNER, fristTage: 0 }),
      ] },
      { titel: 'Nachfassen', schritte: [
        S.wartenDatum('a7', 'Tag nach dem Event', 'event.datum', 1, 30),
        S.head('a8', 'Nachfassen 48 h vorbereiten', 'event', {
          auftrag: 'Je einladende Person eine Liste: Danke- und Folge-Entwürfe nur für Gäste mit Status „da“ — nur Dank und Verabredetes.',
          warum: 'Was mit wem verabredet wurde, steht in Notizen des Abends.', budgetCent: 10, modell: 'schnell', ausgabe: [V.zahl('entwuerfe')],
        }),
        // Gemessen wird erst nach der Frist (zwei Werktage nach dem Abend — dieselbe Regel wie die Kennzahl); ohne fälligen Gast ist das Feld leer.
        S.wartenDauer('a8w', 'Frist des Nachfassens (zwei Werktage)', 2, { arbeitszeit: true }),
        S.regel('a9', '48-Stunden-Ziel erreicht?', [B.groesser('event.quote-48h', 89), B.leer('event.quote-48h')], { oder: true, zweige: { nein: 'a9g' } }),
        S.glocke('a9g', 'Ziel nicht erreicht', 'Beim Nachfassen eines Abends ist das 48-Stunden-Ziel nicht erreicht.', EIGNER),
        S.ziel('ez', 'Abend nachgefasst'),
      ] },
    ],
  }),
};

// ── V06 · Kampagnen-Playbooks als Prozesse ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V06A: KgTeil = {
  id: 'kg-v06a', titel: 'Eine Person der Kampagne', offen: [],
  definition: prozess({
    id: 'kg-v06a', titel: 'Eine Person der Kampagne', bereich: 'marketing', fallArt: 'lead',
    beschreibung: 'Teilprozess der Kampagnen-Playbooks: Ampel prüfen, Schritte des Playbooks als Aufgaben, Text zum Schritt, Reaktion abwarten, Ergebnis setzen — „Chance“ geht an den Lead-Eingang.',
    startKriterium: 'Eine Person der Zielgruppe einer aktiven Kampagne.', endKriterium: 'Die Person hat ein Ergebnis in der Kampagne.',
    zettel: `${STANDARD_ABBRUCH} Je Playbook gilt sein Rechtshinweis; bei werblichem Kanal lehnt die Personen-Schranke rote Ampeln ab; bei gelbem Telefon ist ein Anlass Pflicht.`,
    phasen: [
      { titel: 'Ansprechen', schritte: [
        S.hand('t', 'Je Person (aus der Schleife)'),
        S.regel('d1', 'Gibt es einen zulässigen Kanal?', [B.nicht('lead.bester-kanal', 'keiner')], { zweige: { nein: 'e0' } }),
        S.ziel('e0', 'Kanal rot — fällt heraus'),
        S.aufgabe('d2', 'Schritt 1 des Playbooks', { titel: 'Kampagne: erster Schritt des Playbooks', fristTage: 0 }),
        S.text('d3', 'Text zum Schritt', { art: 'nachricht_entwurf', kanal: 'mail' }),
      ] },
      { titel: 'Ergebnis', schritte: [
        S.wartenEreignis('d4', 'Reaktion abwarten', 'neue-mail', 7, { zweige: { abgelaufen: 'd5' } }),
        S.aufgabe('d5', 'Nächster Playbook-Schritt', { titel: 'Kampagne: nächster Schritt des Playbooks', fristTage: 2 }),
        S.kampagnenErgebnis('d6', 'Ergebnis setzen'),
        S.regel('d7', 'Chance?', [B.ist('lead.kampagnen-ergebnis', 'chance')], { zweige: { nein: 'e1' } }),
        S.ziel('e1', 'Ergebnis festgehalten'),
        S.uebergabe('ez', 'An den Lead-Eingang', 'kg-v02'),
      ] },
    ],
  }),
};
const V06: KgVorlage = {
  id: 'kg-v06', nr: 'V06', welle: 3, titel: 'Kampagnen-Playbooks als Prozesse', bereich: 'marketing', fallArt: 'kampagne', eignerRolle: 'marketing',
  zweck: 'Jede aktive Kampagne läuft als Prozess: Zielgruppe prüfen, je Person die Playbook-Schritte anstoßen, Ergebnis je Person einsammeln, Interesse wird Lead.',
  ausloeserText: 'Kampagne wird aktiv · von Hand', braucht: ['kampagne', 'ki'], uebergabeAn: ['kg-v02'],
  recht: ['Je Playbook gilt sein Rechtshinweis (z. B. keine Empfehlungs-Mails an Dritte, BGH I ZR 208/12).', 'Bei werblichem Kanal lehnt die Personen-Schranke neue Personen mit roter Ampel ab.', 'Wer bei gelbem Telefon anruft, braucht einen Anlass.'],
  kennzahlen: ['Kennzahl des Playbooks (Leitkennzahl)', 'traktion:marketing_anteil', 'Prozesse: Anteil der Personen mit Ergebnis in der Frist'],
  einstellbar: [
    { id: 'jeTag', label: 'Personen je Tag', vorgabe: 10, knoten: 'a3', feld: 'hoechstens' }, { id: 'nachlaufTage', label: 'Nachlauf (Tage)', vorgabe: 7 },
    { id: 'ergebnisTage', label: 'Ergebnis in (Werktagen)', vorgabe: 2 },
  ],
  offen: [{ punkt: 'Playbooks', text: 'Fünf der neun Playbooks laufen über eigene Vorlagen (V14, V15, V05, V18, V16).' }],
  demo: 'Eine erfundene Kampagne „Reaktivierung Kreis A/B“ mit drei Saat-Personen: zwei Anlass-Aufgaben, ein Ergebnis „Chance“ → Lead in Qualifizierung.',
  teile: [V06A],
  definition: prozess({
    id: 'kg-v06', titel: 'Kampagnen-Playbooks als Prozesse', bereich: 'marketing', fallArt: 'kampagne',
    beschreibung: 'Zielgruppe der Kampagne lesen, je Person das Playbook (Teilprozess), bis alle ein Ergebnis haben — dann wertet der Head of Marketing aus.',
    startKriterium: 'Eine Kampagne wechselt auf „aktiv“ bzw. von Hand „Kampagne als Prozess starten“.', endKriterium: 'Jede Person der Zielgruppe hat ein Ergebnis.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Kampagne', schritte: [
      S.ereignis('t1', 'Kampagne aktiv', 'kampagne-aktiv'),
      S.hand('t2', 'Kampagne als Prozess starten'),
      S.abfrage('a1', 'Zielgruppe lesen', { art: 'kampagne-personen', hoechstens: 100 }),
      S.schleife('a3', 'Personen bearbeiten', abfrageListe('kg-v06', 'a1'), 'kg-v06a', 10),
      S.wartenEreignis('a4', 'Bis alle ein Ergebnis haben', 'kampagnen-ergebnis', 30),
      S.head('a5', 'Kampagne auswerten', 'marketing', {
        auftrag: 'Werte die Kampagne nach der Kennzahl ihres Playbooks aus und schlage vor, ob sie abgeschlossen werden kann.',
        warum: 'Ob eine Kampagne gewirkt hat, ist eine Einschätzung über Ergebnisse und Gespräche.', budgetCent: 15, ausgabe: [V.janein('abschliessen')],
      }),
      S.ziel('ez', 'Kampagne ausgewertet'),
    ] }],
  }),
};

// ── V16 · Newsletter-Anmeldung (Double-Opt-in) → Begleitung ───────────────────────────────────────────────────────────────────────────────────────────
const V16: KgVorlage = {
  id: 'kg-v16', nr: 'V16', welle: 3, titel: 'Newsletter-Anmeldung (Double-Opt-in) → Begleitung', bereich: 'marketing', fallArt: 'lead', eignerRolle: 'marketing',
  zweck: 'Eine neue Newsletter-Einwilligung mit vollem Nachweis wird begleitet: Willkommen, Marketing-Lead-Prüfung, nach 30 Tagen ein Blick auf echte Signale — ohne Öffnungs- oder Klick-Tracking.',
  ausloeserText: 'Einwilligung „Newsletter“ erteilt', braucht: ['postfach'], uebergabeAn: ['kg-v02'],
  recht: ['Double-Opt-in ist Pflicht — der Nachweis enthält Zeitpunkt und Wortlaut; eine Visitenkarte ist keine Einwilligung.', 'Jede Mail hat einen Abmeldelink.', 'Kein Öffnungs- und Klick-Tracking — es zählen nur eigene Signale; eine Einwilligung wird nie automatisch gesetzt.'],
  kennzahlen: ['traktion:newsletter_netto', 'Abonnent → MQL → SQL', 'Prozesse: Anteil begrüßter Abonnenten in 1 Werktag'],
  einstellbar: [
    { id: 'willkommenTage', label: 'Willkommen in (Werktagen)', vorgabe: 1 }, { id: 'begleitTage', label: 'Begleiten (Tage)', vorgabe: 30, knoten: 'a5', feld: 'tage' },
    { id: 'mqlUebergabe', label: 'MQL an Sales übergeben', vorgabe: true },
  ],
  offen: [{ punkt: 'E-V2', text: 'Vorerst entsteht die Einwilligung im Gespräch (Playbook „Newsletter“); später meldet das Versandwerkzeug „DOI bestätigt“ per Webhook.' }],
  demo: 'Für eine Saat-Person eine erfundene Newsletter-Einwilligung mit vollem Nachweis: Willkommen im Stapel, 30 Tage später eine Event-Anmeldung → „persönlich nachfassen“.',
  teile: [],
  definition: prozess({
    id: 'kg-v16', titel: 'Newsletter-Anmeldung (Double-Opt-in) → Begleitung', bereich: 'marketing', fallArt: 'lead',
    beschreibung: 'Nachweis prüfen, MQL prüfen, Willkommen (Schloss), 30 Tage begleiten — echte Signale führen zum persönlichen Nachfassen.',
    startKriterium: 'Eine neue, nicht widerrufene Einwilligung „Newsletter“ mit vollem Nachweis.', endKriterium: 'Abonnent begrüßt; bei Signal Übergabe an die Qualifizierung.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Nachweis & Willkommen', schritte: [
        S.ereignis('t', 'Newsletter-Einwilligung erteilt', 'einwilligung-erteilt', [B.ist('ereignis.stufe', 'newsletter')]),
        S.regel('a1', 'Nachweis vollständig?', [B.ist('lead.nachweis-vollstaendig', true)], { zweige: { ja: 'a3', nein: 'a2' } }),
        S.aufgabe('a2', 'Nachweis ergänzen', { titel: 'Newsletter-Einwilligung: Nachweis ergänzen', fristTage: 5 }, { zweige: { ja: 'e0' } }),
        S.abbruch('e0', 'Ohne Nachweis kein Newsletter'),
        S.regel('a3', 'Noch kein MQL?', [B.ist('lead.mql', false)], { zweige: { nein: 'a3q' } }),
        S.aufgabe('a3q', 'MQL prüfen', { titel: 'Marketing-Lead prüfen (Übergabe an Sales)', wer: ZUSTAENDIG, fristTage: 2 }),
        S.mail('a4', 'Willkommen', { betreff: 'Willkommen beim Newsletter', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nschön, dass Sie dabei sind — ein Satz dazu, was Sie erwartet. Abmelden geht jederzeit über den Link in jeder Ausgabe.' }),
      ] },
      { titel: 'Begleiten', schritte: [
        S.wartenDauer('a5', 'Begleiten', 30),
        S.regel('a6', 'Echte Signale?', [B.ist('lead.neue-signale', true)], { zweige: { nein: 'e1' } }),
        S.ziel('e1', 'Bleibt Abonnent'),
        S.aufgabe('a7', 'Persönlich nachfassen', { titel: 'Persönlich nachfassen (Kanal nach Ampel)', fristTage: 5 }),
        S.uebergabe('ez', 'An den Lead-Eingang', 'kg-v02'),
      ] },
    ],
  }),
};

export const WELLE_3: readonly KgVorlage[] = [V11, V04, V17, V18, V06, V16];
