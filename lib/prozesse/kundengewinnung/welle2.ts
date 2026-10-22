// ─── Prozesse · Kundengewinnung — Welle 2: vorhandene Quellen + Agenten (V03, V02, V10, V01, V05, V14) ─────────────────────────────────────────────────
// research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 2: hier kommen ZOE, die Heads und Research als Schritte hinzu (Vorschlag, Budget je Schritt, Pflichtsatz
// „Warum reicht keine Regel?“). Fremder Text (Mail, Web, Webhook) führt nur in harmlose Äste oder in eine Freigabe (R5). Rein und client-sicher.

import {
  S, B, V, prozess, abfrageListe, STANDARD_ABBRUCH, EIGNER, ZUSTAENDIG, POSTFACH_NACHRICHT, C1_EREIGNIS, type KgVorlage, type KgTeil,
} from './bau';

// ── V03 · Mail eines Leads in der Inbox ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V03: KgVorlage = {
  id: 'kg-v03', nr: 'V03', welle: 2, titel: 'Mail eines Leads in der Inbox', bereich: 'sales', fallArt: 'lead', eignerRolle: 'sales',
  zweck: 'Kommt eine Mail von einem Lead oder aus einem offenen Deal, wird sie zugeordnet, die Wärme neu gelesen und ein nächster Schritt vorgeschlagen — mit Uhr bis zur Antwort.',
  ausloeserText: 'neue Mail mit Kontakt (Lead aktiv oder offener Deal)', braucht: ['postfach', 'ki'], uebergabeAn: [],
  recht: ['Antworten im laufenden Gespräch sind keine Werbung.', 'Zuordnen nur per Klick: keine Werbesperre, kein Art. 18, keine Sammeladresse.', 'Mailtext geht an die KI nur mit der Kategorie „Postfach“ — im Hintergrund pseudonymisiert, nie im Protokoll.'],
  kennzahlen: ['Median bis zur Antwort (M5)', 'traktion:followup_puenktlich', 'Prozesse: Anteil beantwortet in 24 Std.'],
  einstellbar: [
    { id: 'antwortStunden', label: 'Antwort binnen (Stunden)', vorgabe: 24, knoten: 'a8', feld: 'hoechstensStunden' }, { id: 'waermeHinweis', label: 'Hinweis bei gestiegener Wärme', vorgabe: true },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 10, knoten: 'a5', feld: 'budgetCent' },
  ],
  offen: [{ punkt: 'N12', text: 'Zuordnen als Inbox-Aktion mit der Sitzung der freigebenden Person — bis dahin eine Aufgabe „Gespräch zuordnen“.' }],
  demo: 'Eine erfundene Mail aus einem offenen Deal: „Können wir nächste Woche sprechen?“ — Fach „Termine“, Entwurf mit zwei freien Zeiten, Einladung im Stapel.',
  teile: [],
  definition: prozess({
    id: 'kg-v03', titel: 'Mail eines Leads in der Inbox', bereich: 'sales', fallArt: 'lead',
    beschreibung: 'Zuordnen, Wärme lesen, Antwort und nächsten Schritt entwerfen (ZOE), Antwort bereitlegen (Schloss) — dann Termin oder Follow-up, mit Uhr bis zur Antwort.',
    startKriterium: 'Eine neue eingehende Mail eines Kontakts mit aktivem Lead bzw. offenem Deal (Business-Postfach).', endKriterium: 'Die Antwort ist gesendet, oder ein Follow-up bzw. Termin ist angelegt.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Lesen & antworten', schritte: [
        S.ereignis('t', 'Neue Mail eines Leads', 'neue-mail', [B.gesetzt('bezug.kontaktid'), B.einer('lead.status', ['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung', 'sql'])]),
        S.regel('a1', 'Antworten oder Termin?', [B.einer('lead.mail-fach', ['antworten', 'termine'])], { zweige: { nein: 'e0' } }),
        S.ziel('e0', 'Info bzw. wartet — andere Wege decken es ab'),
        S.regel('a2', 'Gespräch schon zugeordnet?', [B.ist('lead.gespraech-zugeordnet', true)], { zweige: { nein: 'a3' } }),
        S.aufgabe('a3', 'Gespräch zuordnen', { titel: 'Gespräch in der Inbox zuordnen', fristTage: 1, beschreibung: 'Zuordnen schreibt den Verlauf (Betreff + Link, nie Text).' }),
        S.regel('a4', 'Wärme unverändert?', [B.ist('lead.waerme-gestiegen', false)], { zweige: { nein: 'a4b' }, pfeil: { ja: 'unverändert', nein: 'gestiegen' } }),
        S.glocke('a4b', 'Wärme gestiegen', 'Ein Lead ist wärmer geworden — Details in der Inbox.', ZUSTAENDIG),
        S.zoe('a5', 'Antwort und nächsten Schritt entwerfen', {
          auftrag: 'Lies die Mail (fremder Text), die Akte und den Deal. Schlage den nächsten Schritt vor (Termin, Follow-up oder Deal-Stufe) und in wie vielen Tagen. Die Antwort entwirft der nächste Schritt.',
          warum: 'Was die Person in der Mail will, steht im Text — keine Feldregel liest das.', budgetCent: 10, ausgabe: [V.wahl('vorschlag', ['termin', 'followup', 'deal_stufe']), V.zahl('intagen')],
        }),
        S.mail('a6', 'Antwort bereitlegen', { betreff: 'Re: Ihre Nachricht', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nvielen Dank für Ihre Nachricht.', postfach: POSTFACH_NACHRICHT }),
      ] },
      { titel: 'Nächster Schritt', schritte: [
        S.regel('a7', 'Termin vorgeschlagen?', [B.ist('agent.vorschlag', 'termin')], { zweige: { nein: 'a7f' } }),
        S.followup('a7f', 'Follow-up vorschlagen', { text: 'Nachfassen zur Mail', inTagen: 3 }, { zweige: { ja: 'a8' } }),
        S.einladung('a7t', 'Termin vorschlagen', { titel: 'Gespräch', dauerMin: 30 }),
        S.wartenEreignis('a8', 'Uhr: Antwort gesendet', C1_EREIGNIS.antwortGesendet, 1, { stunden: 24, arbeitszeit: true, zweige: { abgelaufen: 'a9' } }),
        S.glocke('a9', 'Antwort steht aus', 'Eine Antwort an einen Lead steht aus — nach drei Tagen übernimmt das Fach „Warten“.', ZUSTAENDIG),
        S.ziel('ez', 'Beantwortet'),
      ] },
    ],
  }),
};

// ── V02 · Lead-Eingang mit Uhr ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V02: KgVorlage = {
  id: 'kg-v02', nr: 'V02', welle: 2, titel: 'Lead-Eingang mit Uhr', bereich: 'sales', fallArt: 'lead', eignerRolle: 'sales',
  zweck: 'Jede neue Anfrage bekommt binnen einer Uhr eine erste Reaktion, eine zuständige Person und ein Pflicht-Ergebnis mit Grund — kein Lead bleibt ohne Status.',
  ausloeserText: 'neuer Lead (Anfrage) · Webhook „Website-Formular“', braucht: ['postfach', 'ki'], uebergabeAn: ['kg-v09'],
  recht: ['Eine Anfrage begründet die Einwilligung „Anfrage“ nur für ihren Kanal.', 'Die erste Antwort ist eine Antwort, keine Werbung — Folgemails mit Angebot brauchen die Ampel.', 'Webhook-Felder sind fremder Text: nur als Vorschlag, der Empfänger kommt aus der Kartei (E-V1).', 'Art. 13: die Antwort verweist auf den Datenschutzhinweis der Instanz.'],
  kennzahlen: ['traktion:anfragen_90', 'Zeit bis zur ersten Reaktion (Leitkennzahl, M5)', 'Prozesse: Anteil in der Uhr'],
  einstellbar: [
    { id: 'uhrStunden', label: 'Uhr (Stunden, Arbeitszeit)', vorgabe: 4, knoten: 'a5', feld: 'hoechstensStunden' }, { id: 'ergebnisTage', label: 'Ergebnis in (Werktagen)', vorgabe: 2, knoten: 'a7', feld: 'frist' },
    { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 10 },
  ],
  offen: [{ punkt: 'Website-Formular', text: 'Ein offenes Formular gibt es nicht — der Webhook nimmt seine Felder an (Schlüssel je Prozess), übernommen wird nur per Klick (E-V1).' }],
  demo: 'Eine erfundene Anfrage über die Website: nach 3 Stunden ist die Uhr gelb, die Antwort liegt im Stapel, das Ergebnis lautet „Termin“.',
  teile: [],
  definition: prozess({
    id: 'kg-v02', titel: 'Lead-Eingang mit Uhr', bereich: 'sales', fallArt: 'lead',
    beschreibung: 'Anfrage übernehmen (Formular nur als Vorschlag), Zuständige klären, erste Antwort nach Kanal entwerfen, Uhr bis zur Reaktion, Pflicht-Ergebnis mit Grund, bei SQL ein Deal-Vorschlag.',
    startKriterium: 'Eine neue Anfrage (Kanal Website, Mail, LinkedIn, Telefon, Empfehlung, Event, WhatsApp) bzw. ein Eingang des Website-Formulars.',
    endKriterium: 'Ein Ergebnis ist gesetzt: Qualifizierung, Termin, Deal oder „kein Fit“ mit Grund.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Eingang bis Ergebnis', schritte: [
      S.ereignis('te', 'Neuer Lead', 'neuer-lead', [B.ist('ereignis.quelle', 'anfrage'), B.gesetzt('bezug.kontaktid')]),
      S.webhook('tw', 'Website-Formular', [
        { id: 'name', art: 'text', pflicht: true, max: 160 }, { id: 'email', art: 'email' }, { id: 'firma', art: 'text', max: 160 }, { id: 'nachricht', art: 'text', pflicht: true, max: 2000 },
      ]),
      S.regel('s0', 'Lead schon in der Kartei?', [B.leer('webhook.name')], { zweige: { nein: 's0a' }, pfeil: { ja: 'ja', nein: 'Formular' } }),
      S.anfrage('s0a', 'Anfrage aus dem Formular übernehmen', 'website', { zweige: { ja: 's0e' } }),
      S.akte('a1', 'Akte und Lead lesen'),
      S.regel('a2', 'Zuständig gesetzt?', [B.gesetzt('lead.zustaendig')], { zweige: { nein: 'a2b' } }),
      S.aufgabe('a2b', 'Zuständige festlegen', { titel: 'Zuständige für die Anfrage festlegen', wer: EIGNER, fristTage: 1, prioritaet: 'high' }),
      S.regel('a3', 'Kam die Anfrage per Mail oder Website?', [B.einer('lead.anfrage-kanal', ['mail', 'website'])], { zweige: { nein: 'a3w' } }),
      S.regel('a3w', 'Per WhatsApp?', [B.ist('lead.anfrage-kanal', 'whatsapp')], { zweige: { ja: 'a4w', nein: 'a4t' } }),
      S.text('a4t', 'Rückruf-Leitfaden', { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Antwort auf die Anfrage' }, { zweige: { ja: 'a5' } }),
      S.mail('a4m', 'Erste Antwort entwerfen', { betreff: 'Ihre Anfrage', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nvielen Dank für Ihre Anfrage — wir melden uns mit einem Vorschlag für die nächsten Schritte.' }),
      S.wartenEreignis('a5', 'Uhr: erste Reaktion', C1_EREIGNIS.antwortGesendet, 1, { stunden: 4, arbeitszeit: true, zweige: { abgelaufen: 'a6' } }),
      S.glocke('a6', 'Uhr abgelaufen: eskalieren', 'Eine Anfrage wartet über die Uhr hinaus auf die erste Reaktion.', ZUSTAENDIG),
      S.mensch('a7', 'Ergebnis der Anfrage', 'Qualifizieren bzw. Termin (ja) — oder kein Fit bzw. nur Info (nein)? Mit Grund.', ZUSTAENDIG, { zweige: { nein: 'a7n' }, frist: 2 }),
      S.aufgabe('a7n', 'Ergebnis mit Grund festhalten', { titel: 'Anfrage abschließen: kein Fit bzw. Info — mit Grund', fristTage: 1 }, { zweige: { ja: 'ek' } }),
      S.score('a8', 'SQL-bereit?', 'sql-bereit', { zweige: { nein: 'a8q' } }),
      S.qualifizieren('a8q', 'In die Qualifizierung', 'qualifizierung', { zweige: { ja: 'eq' } }),
      S.dealVorschlag('a9', 'Deal vorschlagen', { naechsterSchritt: 'Bedarfsgespräch vereinbaren', inTagen: 3 }),
      S.uebergabe('ez', 'An „Deal führen“', 'kg-v09'),
      S.whatsapp('a4w', 'Antwort per WhatsApp entwerfen', 'Danke für Ihre Nachricht — wir melden uns gleich mit einem Vorschlag.', { zweige: { ja: 'a5' } }),
      S.ziel('s0e', 'Anfrage übernommen — der neue Lead startet den Eingang'),
      S.ziel('ek', 'Abgeschlossen (kein Fit bzw. Info)'),
      S.ziel('eq', 'In der Qualifizierung'),
    ] }],
  }),
};

// ── V10 · Angebot nachfassen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V10: KgVorlage = {
  id: 'kg-v10', nr: 'V10', welle: 2, titel: 'Angebot nachfassen', bereich: 'sales', fallArt: 'deal', eignerRolle: 'sales',
  zweck: 'Ein gestelltes Angebot wird nach fünf Werktagen nachgefasst, vor Ablauf der Gültigkeit erinnert und bei Ablauf bewusst entschieden — nie still liegen gelassen.',
  ausloeserText: 'Angebot gestellt (auch Version 2)', braucht: ['postfach'], uebergabeAn: [],
  recht: ['Nachfassen eines Angebots ist Kommunikation in der Anbahnung mit Anlass, keine Werbung.', 'Neue Leistungen im Text wären Werbung — nur Rückfragen zum gestellten Angebot.', 'Gestellt wird nur per Klick; das PDF ist festgeschrieben.'],
  kennzahlen: ['Angebots-Abschlussquote', 'Tage bis zur Antwort, Anteil abgelaufen ohne Entscheidung', 'Prozesse: Anteil vor Ablauf entschieden'],
  einstellbar: [
    { id: 'nachfassenWerktage', label: 'Nachfassen nach (Werktagen)', vorgabe: 5, knoten: 'a2', feld: 'hoechstensTage' }, { id: 'erinnerungVorAblaufTage', label: 'Erinnern vor Ablauf (Tage)', vorgabe: 3, knoten: 'a5', feld: 'versatzTage' },
    { id: 'einordnenTage', label: 'Antwort einordnen in (Werktagen)', vorgabe: 2, knoten: 'a3', feld: 'frist' }, { id: 'ablaufEntscheidTage', label: 'Bei Ablauf entscheiden in (Werktagen)', vorgabe: 3, knoten: 'a6', feld: 'frist' },
  ],
  offen: [],
  demo: 'Das Saat-Angebot ist seit 6 Werktagen gestellt, ohne Antwort: ein Anruf-Leitfaden liegt im Stapel, die Erinnerung ist 3 Tage vor Ablauf geplant.',
  teile: [],
  definition: prozess({
    id: 'kg-v10', titel: 'Angebot nachfassen', bereich: 'sales', fallArt: 'deal',
    beschreibung: 'Nachfassen nach fünf Werktagen, Erinnerung kurz vor Ablauf, bei Ablauf oder Rückfrage bewusst entscheiden: neue Version oder verloren.',
    startKriterium: 'Ein Angebot wird gestellt (Ereignis „Angebot gestellt“, auch eine neue Version).', endKriterium: 'Angenommen oder abgelehnt (mit Grund), oder eine neue Version ist entworfen.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Nachfassen', schritte: [
      S.ereignis('t', 'Angebot gestellt', 'angebot-gestellt'),
      S.regel('a1', 'Nachfass-Follow-up da?', [B.ist('deal.nachfass-followup', true)], { zweige: { nein: 'a1f' } }),
      S.followup('a1f', 'Nachfass-Follow-up sichern', { text: 'Angebot nachfassen', inTagen: 5 }),
      S.wartenEreignis('a2', 'Reaktion abwarten', 'neue-mail', 5, { arbeitszeit: true, zweige: { abgelaufen: 'a4' } }),
      S.text('a4', 'Nachfassen am Telefon', { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Gestelltes Angebot' }, { zweige: { ja: 'a5' } }),
      S.mensch('a3', 'Frage oder Änderungswunsch?', 'Ist die Antwort eine Frage bzw. ein Änderungswunsch (ja) — oder schon Zusage bzw. Absage (nein, dann in der Angebots-Ansicht setzen)?', ZUSTAENDIG, { zweige: { ja: 'a6', nein: 'ea' }, frist: 2 }),
      S.ziel('ea', 'Entschieden — weiter über „Gewonnen“ bzw. „Verloren“'),
      S.wartenDatum('a5', 'Bis kurz vor Ablauf', 'angebot.gueltig-bis', -3, 30),
      S.mail('a5b', 'Erinnerung: Angebot läuft ab', { betreff: 'Unser Angebot zu {{deal.titel}}', text: 'Guten Tag {{kontakt.anrede}} {{kontakt.nachname}},\n\nunser Angebot gilt noch wenige Tage — gibt es Fragen dazu?' }),
      S.mensch('a6', 'Wie weiter?', 'Neue Version (ja) — oder verloren mit Grund (nein)?', ZUSTAENDIG, { zweige: { nein: 'a6v' }, frist: 3 }),
      S.aufgabe('a6v', 'Deal als verloren schließen', { titel: 'Deal schließen: verloren (Grund aus der Liste)', fristTage: 2 }, { zweige: { ja: 'ev' } }),
      S.angebotEntwurf('a7', 'Neue Version entwerfen'),
      S.ziel('ez', 'Neue Version entworfen'),
      S.ziel('ev', 'Verloren'),
    ] }],
  }),
};

// ── V01 · Nächtlicher Prospecting-Lauf ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V01A: KgTeil = {
  // Seit 22.10. spät (Motor-Rest, M6): Research mit Ausgabe-Vertrag je Firma — Fit an die Raute, Felder nur als Vorschlag mit Häkchen je Feld, Frische 90 Tage.
  id: 'kg-v01a', titel: 'Account anreichern und bewerten', offen: [{ punkt: 'Schloss', text: 'Hinter der Recherche steht das Freigabe-Schloss (tödliches Dreieck: Akte, Web, Weg nach außen) — je Firma ein Klick „weiter“, dazu die Felder im Stapel.' }],
  definition: prozess({
    id: 'kg-v01a', titel: 'Account anreichern und bewerten', bereich: 'sales', fallArt: 'firma',
    beschreibung: 'Teilprozess des nächtlichen Prospecting-Laufs: fehlende Angaben recherchieren (nur öffentlich, mit Quelle — als Vorschlag), Score lesen, gute Fälle als Outreach und Deal-Vorschlag.',
    startKriterium: 'Eine Firma aus der Abfrage des Nachtlaufs.', endKriterium: 'Der Account ist bewertet, und es liegt ein Outreach oder die Entscheidung „bleibt in der Pflege“ vor.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Bewerten', schritte: [
      S.hand('t', 'Je Account (aus der Schleife)'),
      S.regel('a1', 'Daten vollständig?', [B.ist('firma.daten-fehlen', false)], { zweige: { ja: 'a4', nein: 'a2' } }),
      S.research('a2', 'Firma recherchieren', {
        auftrag: 'Öffentliche Angaben zur Firma mit Quelle: Branche, Mitarbeitende, Webseite, LinkedIn-Seite, Beschreibung; dazu Signale und eine Einschätzung des Fit (0–100).',
        warum: 'Öffentliche Angaben stehen nicht im CRM — eine Regel kann sie nicht kennen.', budgetCent: 20, ausgabe: [V.zahl('fit')],
        vorschlagFelder: ['firma.branche', 'firma.mitarbeiter', 'firma.website', 'firma.linkedin', 'firma.beschreibung'],
      }),
      S.karte('a3', 'Ergebnis in die Karte eintragen', 'firma', ['branche', 'mitarbeiter', 'webseite', 'linkedin'], 'je-feld'),
      S.score('a4', 'Lead-Score warm?', 'temperatur', { temperatur: ['warm', 'heiss'], zweige: { nein: 'a5' } }),
      S.regel('a5', 'Fit aus der Recherche stark?', [B.groesser('agent.fit', 69)], { zweige: { ja: 'a6', nein: 'e1' } }),
      S.ziel('e1', 'Bleibt in der Pflege'),
      S.aufgabe('a6', 'Outreach vorbereiten', { titel: 'Outreach vorbereiten: {{firma.name}}', fristTage: 2, beschreibung: 'Aufhänger, bester Kanal (Ampel) und Score stehen in der Akte.' }),
      S.regel('a7', 'Bester Kanal Mail?', [B.ist('firma.bester-kanal', 'mail')], { zweige: { nein: 'a8t' } }),
      S.text('a8t', 'Anruf-Leitfaden', { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Aufhänger aus der Recherche' }, { zweige: { ja: 'a9' } }),
      S.mail('a8', 'Erstansprache entwerfen', { betreff: 'Kurze Frage zu {{firma.name}}', text: 'Guten Tag,\n\nbeim Blick auf {{firma.name}} ist uns etwas aufgefallen — darf ich kurz erzählen, woran wir arbeiten?' }),
      S.score('a9', 'SQL-bereit?', 'sql-bereit', { zweige: { nein: 'e2' } }),
      S.ziel('e2', 'Outreach vorbereitet'),
      S.dealVorschlag('a10', 'Deal vorschlagen', { naechsterSchritt: 'Erstgespräch vereinbaren', inTagen: 3 }),
      S.uebergabe('ez', 'An „Deal führen“', 'kg-v09'),
    ] }],
  }),
};
const V01: KgVorlage = {
  id: 'kg-v01', nr: 'V01', welle: 2, titel: 'Nächtlicher Prospecting-Lauf', bereich: 'sales', fallArt: 'keiner', eignerRolle: 'sales',
  zweck: 'Jede Nacht ruhende Accounts und neue Leads anreichern, Scores zusammenziehen, das Ergebnis in die Karte bringen und gute Fälle als Outreach-Aufgabe und Deal-Vorschlag bereitstellen.',
  ausloeserText: 'werktags 02:00 (Agenten-Schritte ab 07:00)', braucht: ['ki', 'web-recherche'], uebergabeAn: ['kg-v09'],
  recht: ['Die Recherche nutzt nur öffentliche Angaben (Art. 14); Herkunft bei Neuanlage „Recherche“.', 'Die Erstansprache folgt der Kanal-Ampel — kalte Mail ohne Einwilligung bleibt rot (dann Telefon mit Anlass oder Vernetzen, V05).', 'Kein Versand; Web-Inhalte sind fremder Text und gehen nur per Häkchen in die Karte.'],
  kennzahlen: ['Bewertete Accounts je Nacht', 'traktion:sql_30', 'Prozesse: Anteil der Outreach-Aufgaben in der Frist'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '02:00', knoten: 't', feld: 'uhrzeit' }, { id: 'ohneKontaktTage', label: 'Ruhend ohne Kontakt seit (Tagen)', vorgabe: 90, knoten: 'q1', feld: 'tage' },
    { id: 'neueLeadsTage', label: 'Neue Leads seit (Tagen)', vorgabe: 7, knoten: 'q2', feld: 'tage' }, { id: 'hoechstens', label: 'Höchstens je Liste', vorgabe: 25 },
    { id: 'budgetCent', label: 'Budget je Recherche (Cent)', vorgabe: 20 }, { id: 'fitSchwelle', label: 'Fit-Schwelle (0–100)', vorgabe: 70 }, { id: 'erneutNachTagen', label: 'Erneut je Firma nach (Tagen)', vorgabe: 90 },
  ],
  offen: [
    { punkt: 'E-V5', text: 'Regeln, Abfragen und Schleifen laufen nachts; die Agenten-Schritte warten bis 07:00 und starten dann gedrosselt (Fenster 7–22 Uhr, Tageshöchstzahl E-V6) — der Batch-Weg für die Nacht kommt später (M4).' },
  ],
  demo: 'Eine Zielfirma bekommt in der Nacht eine Recherche „Signale: neue Vertriebsleitung“ → Outreach-Aufgabe mit Telefon-Leitfaden; eine seit 120 Tagen stille Firma „bleibt in der Pflege“.',
  teile: [V01A],
  definition: prozess({
    id: 'kg-v01', titel: 'Nächtlicher Prospecting-Lauf', bereich: 'sales', fallArt: 'keiner',
    beschreibung: 'Nachts ruhende Accounts und neue Leads finden; je Account läuft der Teilprozess „Account anreichern und bewerten“. Danach meldet die Glocke das Nachtergebnis.',
    startKriterium: 'Werktags um 02:00.', endKriterium: 'Alle gefundenen Accounts sind bewertet (Teilprozess) und das Ergebnis ist gemeldet.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Nachtlauf', schritte: [
      S.zeitplan('t', 'Werktags 02:00', 'werktags', '02:00'),
      S.abfrage('q1', 'Ruhende Accounts finden', { art: 'firmen-ruhend', tage: 90, hoechstens: 25 }),
      S.abfrage('q2', 'Neue Leads finden', { art: 'neue-leads', status: ['neu'], tage: 7, hoechstens: 25 }),
      S.schleife('l1', 'Ruhende Accounts prüfen', abfrageListe('kg-v01', 'q1'), 'kg-v01a', 25),
      S.schleife('l2', 'Neue Leads prüfen', abfrageListe('kg-v01', 'q2'), 'kg-v01a', 25),
      // Die Schleife wartet nicht auf die Teil-Läufe — die Glocke meldet, was aufgegriffen ist; Recherche und Outreach folgen ab 07:00 im Stapel bzw. als Aufgabe.
      S.glocke('g', 'Nachtergebnis melden', 'Der Prospecting-Lauf hat ruhende Accounts und neue Leads aufgegriffen — die Recherche läuft ab 07:00, Ergebnisse kommen in den Stapel.', EIGNER),
      S.ziel('ez'),
    ] }],
  }),
};

// ── V05 · Vernetzen-Runde LinkedIn ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V05A: KgTeil = {
  id: 'kg-v05a', titel: 'Eine Person in der Vernetzen-Runde', offen: [],
  definition: prozess({
    id: 'kg-v05a', titel: 'Eine Person in der Vernetzen-Runde', bereich: 'marketing', fallArt: 'lead',
    beschreibung: 'Teilprozess der Vernetzen-Runde: Text zum Schreiben (nur ohne Werbebotschaft, solange keine Einwilligung da ist), Antwort abwarten, bei Ja bzw. Gespräch in die Qualifizierung.',
    startKriterium: 'Eine Person der Runde mit Stand „schreiben“.', endKriterium: 'Antwort da (Ja/Gespräch → Lead-Eingang) bzw. die nächste Runde fasst nach.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Schreiben & warten', schritte: [
      S.hand('t', 'Je Person (aus der Schleife)'),
      S.text('b1', 'Text zum Schreiben', { art: 'nachricht_entwurf', kanal: 'linkedin', text: 'Danke fürs Vernetzen, {{kontakt.vorname}}.' }),
      S.wartenEreignis('b2', 'Auf Antwort warten', 'linkedin-antwort', 7, { zweige: { abgelaufen: 'e1' } }),
      S.ziel('e1', 'Die nächste Runde fasst nach'),
      S.mensch('b3', 'Ja oder Gespräch?', 'Hat die Person mit Ja geantwortet bzw. ein Gespräch vereinbart (ja) — oder kein Interesse (nein)?', ZUSTAENDIG, { zweige: { nein: 'e2' } }),
      S.ziel('e2', 'Kein Interesse'),
      S.qualifizieren('b4', 'Lead aufnehmen', 'im_gespraech'),
      S.uebergabe('ez', 'An den Lead-Eingang', 'kg-v02'),
    ] }],
  }),
};
const V05: KgVorlage = {
  id: 'kg-v05', nr: 'V05', welle: 2, titel: 'Vernetzen-Runde LinkedIn', bereich: 'marketing', fallArt: 'keiner', eignerRolle: 'marketing',
  zweck: 'Jeden Werktag die Vernetzen-Runde je Profil vorbereiten (schreiben, nachfassen, anfragen, anreichern, zurückziehen) — der Mensch klickt in LinkedIn, MAKE OS versendet nichts.',
  ausloeserText: 'werktags 08:00 je Profil-Person', braucht: ['linkedin-profil', 'kampagne'], uebergabeAn: ['kg-v02'],
  recht: ['Vernetzen ist keine Werbung; die Nachricht danach ist elektronische Post (§ 7 UWG).', 'Ein „Ja“ ist eine Einwilligung mit Wortlaut — gesetzt nur per Klick in der Runde.', 'Keine Automatik gegenüber LinkedIn.'],
  kennzahlen: ['Annahmen ÷ Anfragen', 'Ja ÷ geschrieben', 'Prozesse: Runde an n von m Werktagen erledigt'],
  einstellbar: [
    { id: 'uhrzeit', label: 'Uhrzeit', vorgabe: '08:00', knoten: 't', feld: 'uhrzeit' }, { id: 'proTag', label: 'Je Tag (1–40)', vorgabe: 15, knoten: 'q', feld: 'hoechstens' },
    { id: 'folgeTage', label: 'Nachfassen nach (Tagen)', vorgabe: 7 }, { id: 'zurueckziehenTage', label: 'Zurückziehen nach (Tagen)', vorgabe: 21 },
  ],
  offen: [],
  demo: 'Eine erfundene Kampagne „Vernetzen Beispiel-Region“ mit sechs Personen: 2 anfragen, 1 schreiben, 1 zurückziehen.',
  teile: [V05A],
  definition: prozess({
    id: 'kg-v05', titel: 'Vernetzen-Runde LinkedIn', bereich: 'marketing', fallArt: 'keiner',
    beschreibung: 'Die Runde des Tages berechnen, als Aufgabe für die Profil-Person anlegen und für „schreiben“ je Person einen Text bereitlegen (Teilprozess).',
    startKriterium: 'Werktags um 08:00, nur mit aktiver Kampagne mit Playbook „Vernetzen“.', endKriterium: 'Die Runde des Tages ist abgearbeitet.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Runde', schritte: [
      S.zeitplan('t', 'Werktags 08:00', 'werktags', '08:00'),
      S.abfrage('q', 'Runde berechnen', { art: 'vernetzen-runde', hoechstens: 15 }),
      S.regel('r', 'Etwas zu tun?', [B.groesser('abfrage.anzahl', 0)], { zweige: { nein: 'e0' } }),
      S.ziel('e0', 'Heute nichts zu tun'),
      S.aufgabe('a3', 'Vernetzen-Runde heute', { titel: 'Vernetzen-Runde heute', fristTage: 0, beschreibung: 'Markttraktion › Kontakte › Vernetzen-Runde: anfragen, schreiben, nachfassen.' }),
      S.schleife('l', 'Texte für „schreiben“', abfrageListe('kg-v05', 'q'), 'kg-v05a', 15),
      S.ziel('ez', 'Runde bereit'),
    ] }],
  }),
};

// ── V14 · Empfehlung anfragen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const V14: KgVorlage = {
  id: 'kg-v14', nr: 'V14', welle: 2, titel: 'Empfehlung anfragen', bereich: 'ausbau', fallArt: 'mandat', eignerRolle: 'kundenerfolg',
  zweck: 'Im Moment sichtbarer Wirkung um ein Intro bitten — doppelte Zustimmung, kein Versand an Dritte aus dem System — und jede Empfehlung als Lead mit Herkunft und Dank verbuchen.',
  ausloeserText: '45 Tage nach Mandatsende · Ziel eines Mandats erreicht', braucht: ['mandate', 'ki'], uebergabeAn: ['kg-v02'],
  recht: ['Kein Versand an die empfohlene Person aus dem System (BGH I ZR 208/12) — doppelte Zustimmung; der Kunde leitet selbst weiter.', 'Die Bitte an den eigenen Kunden ist Kommunikation im Mandat.', 'Die empfohlene Person wird mit Herkunft „Empfehlung“ angelegt (Hinweis nach Art. 14); eine Empfehlung ist kein Marketing.'],
  kennzahlen: ['Intros je angesprochener Person', 'Empfehlung → SQL', 'Prozesse: Anteil der fälligen Empfehlungsfragen, die gestellt wurden'],
  einstellbar: [
    { id: 'nachMandatsendeTage', label: 'Nach Mandatsende (Tage)', vorgabe: 45, knoten: 't1', feld: 'versatzTage' }, { id: 'healthMin', label: 'Health mindestens', vorgabe: 75 },
    { id: 'abstandTage', label: 'Abstand zwischen zwei Fragen (Tage)', vorgabe: 120 }, { id: 'terminFristTage', label: 'Intro erbitten in (Tagen)', vorgabe: 14, knoten: 'a4', feld: 'fristTage' },
    { id: 'wartenTage', label: 'Empfehlung abwarten (Tage)', vorgabe: 30, knoten: 'a6', feld: 'hoechstensTage' }, { id: 'budgetCent', label: 'Budget (Cent)', vorgabe: 10, knoten: 'a3', feld: 'budgetCent' },
  ],
  offen: [
    { punkt: 'Morgenlauf', text: 'Die Nachsorge-Stufe „Empfehlung“ im Fulfillment-Morgenlauf wird beim Umzug in den Motor durch diese Vorlage ersetzt (erst „System“, dann Motor).' },
    { punkt: 'Empfehlung abwarten', text: 'Das Ereignis „neuer Lead“ trägt (noch) keinen Bezug zum empfehlenden Mandat — der Lauf wacht erst an der Obergrenze auf („Gefragt, offen“); „Vorgestellt durch“ setzt deshalb ein Mensch an der Akte der empfohlenen Person.' },
  ],
  demo: 'Ein Saat-Mandat erreicht sein Ziel zu 100 % → Aufgabe „Intro erbitten“; 20 Tage später kommt eine erfundene Anfrage über „Empfehlung“, Danke-Aufgabe und Übergabe an V02.',
  teile: [],
  definition: prozess({
    id: 'kg-v14', titel: 'Empfehlung anfragen', bereich: 'ausbau', fallArt: 'mandat',
    beschreibung: 'Steht das Mandat gut und wurde länger nicht gefragt: wen könnte die Person kennen (nur eigenes CRM), um ein Intro bitten, Text für den Kunden, Empfehlung abwarten, „vorgestellt durch“ eintragen, Danke.',
    startKriterium: '45 Tage nach Mandatsende bzw. ein Ziel des Mandats ist erreicht.', endKriterium: 'Ein Intro ist erbeten, und eine Empfehlung kam als Lead an — oder die Frage ist bewusst verschoben.',
    zettel: STANDARD_ABBRUCH,
    phasen: [{ titel: 'Fragen', schritte: [
      S.datum('t1', '45 Tage nach Mandatsende', 'mandat.ende', 45, '09:00'),
      S.ereignis('t2', 'Ziel des Mandats erreicht', C1_EREIGNIS.zielErreicht),
      S.regel('a1', 'Steht das Mandat gut?', [B.ist('mandat.ampel', 'gruen'), B.groesser('mandat.health', 74)], { zweige: { nein: 'e0' } }),
      S.ziel('e0', 'Nicht jetzt'),
      S.regel('a2', 'Länger nicht gefragt?', [B.groesser('mandat.tage-seit-empfehlung', 119), B.leer('mandat.tage-seit-empfehlung')], { oder: true, zweige: { nein: 'e1' } }),
      S.ziel('e1', 'Schon gefragt'),
      S.head('a3', 'Wen könnte die Person kennen?', 'kundenerfolg', {
        auftrag: 'Nur aus dem eigenen CRM (keine Web-Suche): welche Firmen ähneln dem Kunden (Kreis, Branche)? Nenne bis zu drei Kennungen.',
        warum: 'Ähnlichkeit nach Kreis, Branche und Verlauf ist eine Einschätzung — keine Feldregel.', budgetCent: 10, ausgabe: [V.kennung('firmen', 'firma', true)],
      }),
      S.aufgabe('a4', 'Im nächsten Termin um ein Intro bitten', { titel: 'Im nächsten Termin um ein Intro bitten', fristTage: 14, beschreibung: 'Wirkung in einem Satz, dazu bis zu drei passende Firmen. Doppelte Zustimmung — der Kunde fragt selbst.' }),
      S.text('a5', 'Intro-Text zum Weiterleiten', { art: 'nachricht_entwurf', kanal: 'mail', text: 'Text für den Kunden zum Weiterleiten — erst nach Zusage der Zielperson.' }),
      S.wartenEreignis('a6', 'Empfehlung abwarten', 'neuer-lead', 30, { zweige: { abgelaufen: 'e2' } }),
      S.ziel('e2', 'Gefragt, offen'),
      // Die empfohlene Person kennt der Lauf nicht (Fall ist das Mandat) — darum trägt ein Mensch „Vorgestellt durch“ an IHRER Akte ein, mit dem Namen aus dem Fall.
      S.aufgabe('a7', '„Vorgestellt durch“ eintragen', { titel: '„Vorgestellt durch“ am neuen Kontakt eintragen', fristTage: 2, beschreibung: 'Empfehlungsgeber: {{kontakt.vorname}} {{kontakt.nachname}} ({{firma.name}}) — in der Akte der empfohlenen Person unter „Vorgestellt durch“.' }),
      S.aufgabe('a8', 'Danke an den Empfehlungsgeber', { titel: 'Danke an den Empfehlungsgeber (persönlich)', fristTage: 2 }),
      S.uebergabe('ez', 'An den Lead-Eingang', 'kg-v02'),
    ] }],
  }),
};

export const WELLE_2: readonly KgVorlage[] = [V03, V02, V10, V01, V05, V14];
