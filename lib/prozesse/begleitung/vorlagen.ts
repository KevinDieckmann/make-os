// ─── Prozesse · Fulfillment · Kunden-Begleitung — die neun Begleit-Vorlagen (22.10., B2; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › B2) ─────────────
// Kevin 22.10.: „die ganzen vorgefertigten Nachrichten für den Kunden, Follow-ups, wenn sie die Sachen nicht schicken etc. — das kann auch alles aufgebaut werden.“
// Begleit-Prozesse laufen NEBEN dem Fulfillment-Fall (Lauf-Motor der Werkstatt) und starten auf Ereignisse des Falls (B1: `fall-haengt`, `fall-phase`,
// `kunde-geliefert`, `abstimmung-bestaetigt`, `ziel-erreicht`) bzw. auf den nächsten Termin (`fall.termin`). Sie schreiben NIE in den Fall: Willkommensmail und
// Report bleiben im Fall (sonst stimmen „Willkommen gesendet“ und „letzter Report“ nicht — Entscheidung 22.10. „Willkommen-Vorlage nur erinnern, Mail bleibt im Fall“,
// der Report genauso); Erinnerungen „mit Link“ verweisen auf den Kunden-Link aus der Willkommensmail, ein NEUER Link ist ein eigener Schritt mit Entscheidung
// (Entscheidung 22.10.). Gebaut wie die 18 Vorlagen der Kundengewinnung (`prozess(...)`, `S.*`, Schlösser nach der EINEN Regel), dieselbe Galerie, dieselbe
// Übernahme. Texte mit Platzhaltern: `{{kunde.gruss}}` nach Du/Sie aus der Akte, der Rest neutral (ohne Sie/ihr). Keine Namen, keine Firmen, keine Beträge.
// Rein und client-sicher.

import { S, B, prozess, STANDARD_ABBRUCH, EIGNER, ZUSTAENDIG, AN_ANSPRECHPARTNER, type KgVorlage } from '../kundengewinnung/bau';

const LINK = 'Der Link aus der Willkommensmail führt direkt zu den offenen Punkten.';
const RECHT_MANDAT = 'Nachrichten im laufenden Mandat dienen der Vertragsdurchführung (Art. 6 Abs. 1 lit. b DSGVO) — keine Werbung.';
const RECHT_SCHLOSS = 'Jede Nachricht und jede Einladung geht erst nach der Freigabe im Stapel raus; Art. 18 und Werbesperre beenden den Lauf.';
const KENNZAHL_LAEUFE = 'Prozesse: Anteil der Läufe mit „Ziel erreicht“';

/** Gemeinsame Eckdaten jeder Begleit-Vorlage. */
const basis = { welle: 0 as const, bereich: 'fulfillment' as const, fallArt: 'mandat' as const, eignerRolle: 'kundenerfolg' as const, gruppe: 'begleitung' as const, teile: [] };

const FB1: KgVorlage = {
  ...basis, id: 'fb-01', nr: 'FB1', titel: 'Unterlagen fehlen — freundlich nachfassen',
  zweck: 'Wartet der Fall seit über einer Woche auf den Kunden, erinnern zwei vorgefertigte Mails an die offenen Punkte; kommt nichts, ruft die zuständige Person an — liefert der Kunde, endet die Kette sofort.',
  ausloeserText: 'Ein Fall wartet seit über 7 Tagen auf den Kunden', braucht: ['fulfillment', 'postfach'], uebergabeAn: [],
  recht: [RECHT_MANDAT, RECHT_SCHLOSS, 'Die Erinnerung nennt nur den vorhandenen Kunden-Link — einen neuen Link legt nur der Fall an.'],
  kennzahlen: ['Fulfillment: Tage „wartet auf den Kunden“', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'warten1', label: 'Warten nach der ersten Erinnerung (Werktage)', vorgabe: 3, knoten: 'w1', feld: 'hoechstensTage' }, { id: 'warten2', label: 'Warten nach der zweiten Erinnerung (Werktage)', vorgabe: 3, knoten: 'w2', feld: 'hoechstensTage' }],
  offen: [], demo: 'Ein Saat-Fall wartet seit zehn Tagen auf eine Unterlage: die erste Erinnerung liegt im Stapel; nach dem Hochladen über den Kunden-Link endet der Lauf.',
  definition: prozess({
    id: 'fb-01', titel: 'Unterlagen fehlen — freundlich nachfassen', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Zwei Erinnerungen mit dem Kunden-Link, dazwischen Warten auf die Lieferung; danach ein Anruf und — wenn es weiter hängt — die Glocke an den Eigner.',
    startKriterium: 'Der Fall wartet seit über 7 Tagen auf den Kunden (Hänger „wartet“).', endKriterium: 'Der Kunde hat geliefert, oder der Eigner entscheidet im Fall.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Erste Erinnerung', schritte: [
        S.ereignis('t', 'Wartet auf den Kunden', 'fall-haengt', [B.ist('ereignis.stufe', 'wartet')]),
        S.mail('e1', 'Erste Erinnerung', { betreff: 'Kurze Erinnerung zu „{{mandat.titel}}“', text: `{{kunde.gruss}},\n\nfür den nächsten Schritt in „{{mandat.titel}}“ fehlen noch Unterlagen. ${LINK}\n\nDanke und viele Grüße` }),
        S.wartenEreignis('w1', 'Auf die Lieferung warten', 'kunde-geliefert', 3, { arbeitszeit: true }),
        S.regel('r1', 'Wartet noch etwas?', [B.groesser('fall.wartet-kunde', 0)], { zweige: { nein: 'z1' } }),
        S.ziel('z1', 'Geliefert'),
      ] },
      { titel: 'Zweite Erinnerung', schritte: [
        S.mail('e2', 'Zweite Erinnerung', { betreff: 'Noch offen: Unterlagen zu „{{mandat.titel}}“', text: `{{kunde.gruss}},\n\nnoch fehlen Unterlagen für „{{mandat.titel}}“ — ohne sie verschiebt sich der nächste Schritt. ${LINK} Bei Fragen hilft eine kurze Rückmeldung.\n\nViele Grüße` }),
        S.wartenEreignis('w2', 'Auf die Lieferung warten', 'kunde-geliefert', 3, { arbeitszeit: true }),
        S.regel('r2', 'Wartet noch etwas?', [B.groesser('fall.wartet-kunde', 0)], { zweige: { nein: 'z2' } }),
        S.ziel('z2', 'Geliefert'),
      ] },
      { titel: 'Anrufen', schritte: [
        S.aufgabe('a1', 'Kunden anrufen', { titel: 'Kunden anrufen: Unterlagen fehlen', wer: ZUSTAENDIG, fristTage: 2, prioritaet: 'high', beschreibung: 'Zwei Erinnerungen ohne Lieferung — kurz anrufen und klären, was fehlt oder im Weg steht.' }),
        S.regel('r3', 'Wartet noch etwas?', [B.groesser('fall.wartet-kunde', 0)], { zweige: { nein: 'z3' } }),
        S.glocke('g1', 'Eigner informieren', 'Unterlagen fehlen trotz zwei Erinnerungen und Anruf — bitte im Fall entscheiden.', EIGNER),
        S.abbruch('ab', 'Hängt weiter — im Fall entscheiden'),
        S.ziel('z3', 'Geliefert'),
      ] },
    ],
  }),
};

const FB2: KgVorlage = {
  ...basis, id: 'fb-02', nr: 'FB2', titel: 'Bestätigung offen',
  zweck: 'Ist eine Bestätigung des Kunden überfällig, erinnert eine Mail an den Kunden-Link; bleibt sie offen, entscheidet die zuständige Person: kurzer Termin zum Abstimmen oder — nur wenn nötig — ein neuer Link aus dem Fall.',
  ausloeserText: 'Eine Bestätigung des Kunden ist überfällig', braucht: ['fulfillment', 'postfach', 'kalender'], uebergabeAn: [],
  recht: [RECHT_MANDAT, RECHT_SCHLOSS, 'Ein neuer Kunden-Link ersetzt den alten (höchstens einer je Mandat) — darum nur nach eigener Entscheidung und aus dem Fall.'],
  kennzahlen: ['Fulfillment: überfällige Bestätigungen', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'warten', label: 'Warten nach der Erinnerung (Werktage)', vorgabe: 3, knoten: 'w1', feld: 'hoechstensTage' }],
  offen: [], demo: 'Eine Bestätigung im Saat-Fall ist seit gestern überfällig: die Erinnerung liegt im Stapel; nach der Bestätigung über den Link endet der Lauf.',
  definition: prozess({
    id: 'fb-02', titel: 'Bestätigung offen', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Erinnerung mit dem Kunden-Link, Warten auf die Bestätigung; danach Termin zum Abstimmen oder ein neuer Link — beides nur nach Entscheidung.',
    startKriterium: 'Eine Bestätigung des Kunden ist überfällig (Hänger „Bestätigung“).', endKriterium: 'Bestätigt, Termin angeboten oder bewusst ohne neuen Link.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Erinnern', schritte: [
        S.ereignis('t', 'Bestätigung überfällig', 'fall-haengt', [B.ist('ereignis.stufe', 'freigabe')]),
        S.mail('e1', 'Erinnerung an die Bestätigung', { betreff: 'Eine Bestätigung zu „{{mandat.titel}}“ ist noch offen', text: `{{kunde.gruss}},\n\nfür „{{mandat.titel}}“ ist noch eine Bestätigung offen — danach geht es direkt weiter. ${LINK}\n\nViele Grüße` }),
        S.wartenEreignis('w1', 'Auf die Bestätigung warten', 'abstimmung-bestaetigt', 3, { arbeitszeit: true }),
        S.regel('r1', 'Noch offen?', [B.ist('fall.bestaetigung-offen', true)], { zweige: { nein: 'z1' } }),
        S.ziel('z1', 'Bestätigt'),
      ] },
      { titel: 'Klären', schritte: [
        S.mensch('m1', 'Kurzen Termin anbieten?', 'Die Bestätigung bleibt offen — einen kurzen Termin zum gemeinsamen Abstimmen anbieten?', ZUSTAENDIG, { zweige: { nein: 'n1' }, frist: 3 }),
        S.einladung('k1', 'Termin zum Abstimmen', { titel: 'Kurz abstimmen', dauerMin: 30, gaeste: AN_ANSPRECHPARTNER }),
        S.ziel('z2', 'Termin angeboten'),
        S.mensch('n1', 'Neuen Kunden-Link senden?', 'Ein neuer Link ersetzt den aus der Willkommensmail — nur, wenn der alte nicht mehr geht. Neuen Link aus dem Fall senden?', ZUSTAENDIG, { zweige: { ja: 'l1', nein: 'z3' }, frist: 3 }),
        S.aufgabe('l1', 'Neuen Link im Fall senden', { titel: 'Neuen Kunden-Link im Fall senden', wer: ZUSTAENDIG, fristTage: 1, beschreibung: 'Im Fall unter „Kunde“ einen neuen Link anlegen — der Fall fragt vor dem Senden noch einmal nach.' }),
        S.ziel('z4', 'Neuer Link gesendet'),
        S.ziel('z3', 'Ohne neuen Link'),
      ] },
    ],
  }),
};

const FB3: KgVorlage = {
  ...basis, id: 'fb-03', nr: 'FB3', titel: 'Willkommen in 24 Stunden',
  zweck: 'Ist die Willkommensmail 24 Stunden nach der Unterschrift noch nicht raus, erinnert der Prozess die zuständige Person — gesendet wird sie im Fall (dort zählt sie); bleibt sie offen, erfährt es der Eigner.',
  ausloeserText: 'Die Willkommensmail ist überfällig', braucht: ['fulfillment'], uebergabeAn: [],
  recht: ['Nur intern: Glocke und Aufgabe — die Willkommensmail selbst sendet der Fall (Entscheidung 22.10.).'],
  kennzahlen: ['Fulfillment: Willkommensmail in 24 Stunden', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'frist', label: 'Aufgabe fällig in (Tagen)', vorgabe: 0, knoten: 'a1', feld: 'fristTage' }],
  offen: [], demo: 'Ein Saat-Mandat ist seit zwei Tagen unterschrieben: Glocke und Aufgabe „Willkommensmail im Fall senden“; nach dem Senden endet der Lauf.',
  definition: prozess({
    id: 'fb-03', titel: 'Willkommen in 24 Stunden', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Glocke und Aufgabe an die zuständige Person; danach prüfen, ob die Willkommensmail raus ist — sonst Glocke an den Eigner.',
    startKriterium: 'Die Willkommensmail ist 24 Stunden nach der Unterschrift überfällig (Hänger „Willkommen“).', endKriterium: 'Die Willkommensmail ist im Fall gesendet, oder der Eigner weiß Bescheid.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Erinnern', schritte: [
        S.ereignis('t', 'Willkommensmail überfällig', 'fall-haengt', [B.ist('ereignis.stufe', 'willkommen')]),
        S.glocke('g1', 'Zuständige Person erinnern', 'Willkommensmail überfällig — bitte im Fall senden.', ZUSTAENDIG),
        S.aufgabe('a1', 'Willkommensmail im Fall senden', { titel: 'Willkommensmail im Fall senden', wer: ZUSTAENDIG, fristTage: 0, prioritaet: 'high', beschreibung: 'Im Fall unter „Reise“ › Willkommen senden — dort zählt sie für die 24-Stunden-Uhr.' }),
        S.regel('r1', 'Noch offen?', [B.ist('fall.willkommen-offen', true)], { zweige: { nein: 'z1' } }),
        S.glocke('g2', 'Eigner informieren', 'Willkommensmail weiter offen — bitte im Fall klären.', EIGNER),
        S.abbruch('ab', 'Weiter offen — im Fall klären'),
        S.ziel('z1', 'Gesendet'),
      ] },
    ],
  }),
};

const FB4: KgVorlage = {
  ...basis, id: 'fb-04', nr: 'FB4', titel: 'Etappe geschafft',
  zweck: 'Ist eine Etappe abgeschlossen, liegt eine kurze Nachricht an den Kunden bereit: was geschafft ist und was als Nächstes ansteht — vor dem Senden im Stapel anpassbar.',
  ausloeserText: 'Eine Etappe des Falls ist abgeschlossen', braucht: ['fulfillment', 'postfach'], uebergabeAn: [],
  recht: [RECHT_MANDAT, RECHT_SCHLOSS],
  kennzahlen: ['Fulfillment: Kunden-Lage', KENNZAHL_LAEUFE],
  einstellbar: [],
  offen: [], demo: 'Im Saat-Fall wird die Etappe „Analyse“ abgeschlossen: die Nachricht mit der nächsten Etappe liegt im Stapel.',
  definition: prozess({
    id: 'fb-04', titel: 'Etappe geschafft', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Nach jeder abgeschlossenen Etappe eine kurze Nachricht mit der nächsten Etappe — nach der letzten übernimmt „Abschluss & Verlängerung“.',
    startKriterium: 'Eine Etappe des Falls ist abgeschlossen.', endKriterium: 'Die Nachricht ist gesendet bzw. abgelehnt, oder es gibt keine Etappe mehr.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Mitteilen', schritte: [
        S.ereignis('t', 'Etappe abgeschlossen', 'fall-phase', [B.ist('ereignis.stufe', 'abgeschlossen')]),
        S.regel('r1', 'Geht es weiter?', [B.gesetzt('fall.phase')], { zweige: { nein: 'z0' } }),
        S.mail('e1', 'Nachricht „Etappe geschafft“', { betreff: 'Etappe geschafft: „{{mandat.titel}}“', text: '{{kunde.gruss}},\n\neine Etappe in „{{mandat.titel}}“ ist geschafft — danke für die gute Zusammenarbeit. Als Nächstes steht „{{fall.phase}}“ an. Den aktuellen Stand zeigt jederzeit die Seite aus der Willkommensmail.\n\nViele Grüße' }),
        S.ziel('z1', 'Mitgeteilt'),
        S.ziel('z0', 'Letzte Etappe — Abschluss übernimmt'),
      ] },
    ],
  }),
};

const FB5: KgVorlage = {
  ...basis, id: 'fb-05', nr: 'FB5', titel: 'Termin vorbereiten',
  zweck: 'Zwei Werktage vor dem nächsten Termin mit dem Kunden: Agenda vorbereiten, dann eine kurze Nachricht mit Termin und Themen — vor dem Senden im Stapel anpassbar.',
  ausloeserText: '2 Werktage vor dem nächsten Termin mit dem Kunden', braucht: ['fulfillment', 'postfach'], uebergabeAn: [],
  recht: [RECHT_MANDAT, RECHT_SCHLOSS],
  kennzahlen: ['Fulfillment: Rituale im Takt', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'vorlauf', label: 'Vorlauf vor dem Termin (Werktage)', vorgabe: 2, knoten: 't', feld: 'versatzTage' }],
  offen: [], demo: 'Der Saat-Fall hat in drei Tagen einen Termin: zuerst die Aufgabe „Agenda vorbereiten“, danach liegt die Nachricht im Stapel.',
  definition: prozess({
    id: 'fb-05', titel: 'Termin vorbereiten', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Aufgabe „Agenda vorbereiten“, dann eine Nachricht mit Termin und Etappe an den Kunden.',
    startKriterium: 'Zwei Werktage vor dem nächsten Termin mit dem Kunden (Fulfillment-Fall).', endKriterium: 'Die Agenda ist vorbereitet und die Nachricht gesendet bzw. abgelehnt.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Vorbereiten', schritte: [
        S.datum('t', '2 Werktage vor dem Termin', 'fall.termin', -2, '09:00', true, [B.einer('fall.status', ['onboarding', 'laeuft'])]),
        S.aufgabe('a1', 'Agenda vorbereiten', { titel: 'Agenda für den Termin vorbereiten', wer: ZUSTAENDIG, fristTage: 1, beschreibung: 'Stand, offene Punkte und Entscheidungen für den Termin — danach liegt die Nachricht an den Kunden im Stapel.' }),
        S.mail('e1', 'Nachricht zum Termin', { betreff: 'Unser Termin am {{fall.termin|datum}}', text: '{{kunde.gruss}},\n\nzur Vorbereitung auf den Termin am {{fall.termin|datum}}: im Mittelpunkt stehen der Stand von „{{fall.phase}}“ und die nächsten Schritte. Ist vorab etwas wichtig, hilft eine kurze Rückmeldung.\n\nViele Grüße' }),
        S.ziel('z1', 'Vorbereitet'),
      ] },
    ],
  }),
};

const FB6: KgVorlage = {
  ...basis, id: 'fb-06', nr: 'FB6', titel: 'Report fällig',
  zweck: 'Ist der Report fällig, erinnert der Prozess die zuständige Person — gesendet wird er im Fall (dort zählt er als letzter Report); bleibt er offen, erfährt es der Eigner.',
  ausloeserText: 'Der Report des Falls ist fällig', braucht: ['fulfillment'], uebergabeAn: [],
  recht: ['Nur intern: Aufgabe und Glocke — der Report selbst geht aus dem Fall (wie die Willkommensmail, Entscheidung 22.10.).'],
  kennzahlen: ['Fulfillment: Report im Takt', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'frist', label: 'Aufgabe fällig in (Tagen)', vorgabe: 2, knoten: 'a1', feld: 'fristTage' }],
  offen: [], demo: 'Im Saat-Fall liegt der letzte Report über zwei Wochen zurück: Aufgabe „Report im Fall senden“; nach dem Senden endet der Lauf.',
  definition: prozess({
    id: 'fb-06', titel: 'Report fällig', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Aufgabe an die zuständige Person; danach prüfen, ob der Report raus ist — sonst Glocke an den Eigner.',
    startKriterium: 'Der Report des Falls ist fällig (Hänger „Report“).', endKriterium: 'Der Report ist im Fall gesendet, oder der Eigner weiß Bescheid.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Erinnern', schritte: [
        S.ereignis('t', 'Report fällig', 'fall-haengt', [B.ist('ereignis.stufe', 'report')]),
        S.aufgabe('a1', 'Report im Fall senden', { titel: 'Report im Fall senden', wer: ZUSTAENDIG, fristTage: 2, beschreibung: 'Im Fall unter „Kunde“ den Report erstellen und senden — dort zählt er als letzter Report.' }),
        S.regel('r1', 'Noch fällig?', [B.ist('fall.report-faellig', true)], { zweige: { nein: 'z1' } }),
        S.glocke('g1', 'Eigner informieren', 'Report weiter offen — bitte im Fall klären.', EIGNER),
        S.abbruch('ab', 'Weiter offen — im Fall klären'),
        S.ziel('z1', 'Gesendet'),
      ] },
    ],
  }),
};

const FB7: KgVorlage = {
  ...basis, id: 'fb-07', nr: 'FB7', titel: 'Ziel erreicht — gratulieren',
  zweck: 'Erreicht ein Ziel des Wert-Kontos 100 %, liegt ein kurzer Glückwunsch an den Kunden bereit. Die Bitte um eine Empfehlung bleibt bei „Empfehlung anfragen“ (V14) — die hört selbst auf „Ziel erreicht“, nichts doppelt.',
  ausloeserText: 'Ein Ziel des Mandats ist erreicht', braucht: ['fulfillment', 'postfach'], uebergabeAn: [],
  recht: [RECHT_MANDAT, RECHT_SCHLOSS],
  kennzahlen: ['Fulfillment: Ø Zielerreichung (Wert-Konto)', KENNZAHL_LAEUFE],
  einstellbar: [],
  offen: [], demo: 'Im Saat-Fall erreicht ein Ziel 100 %: der Glückwunsch liegt im Stapel.',
  definition: prozess({
    id: 'fb-07', titel: 'Ziel erreicht — gratulieren', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Ein kurzer Glückwunsch mit dem Hinweis auf die Seite aus der Willkommensmail — nach der Freigabe gesendet.',
    startKriterium: 'Ein Ziel des Wert-Kontos erreicht 100 %.', endKriterium: 'Der Glückwunsch ist gesendet bzw. abgelehnt.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Gratulieren', schritte: [
        S.ereignis('t', 'Ziel erreicht', 'ziel-erreicht'),
        S.mail('e1', 'Glückwunsch', { betreff: 'Ziel erreicht: „{{mandat.titel}}“', text: '{{kunde.gruss}},\n\nein gemeinsames Ziel in „{{mandat.titel}}“ ist erreicht — herzlichen Glückwunsch und danke für die gute Zusammenarbeit. Die Wirkung zeigt die Seite aus der Willkommensmail.\n\nViele Grüße' }),
        S.ziel('z1', 'Gratuliert'),
      ] },
    ],
  }),
};

const FB8: KgVorlage = {
  ...basis, id: 'fb-08', nr: 'FB8', titel: 'Puls niedrig — Check-in',
  zweck: 'Fällt der Kunden-Puls unter die Schwelle, plant der Prozess einen persönlichen Check-in — nur, wenn das Puls-Gespräch des Fulfillments nicht schon im Stapel liegt (nichts doppelt).',
  ausloeserText: 'Der Kunden-Puls ist kritisch', braucht: ['fulfillment'], uebergabeAn: [],
  recht: ['Nur intern: eine Aufgabe — der Puls-Wert erscheint nirgends in Texten.'],
  kennzahlen: ['Fulfillment: Kunden-Puls', KENNZAHL_LAEUFE],
  einstellbar: [{ id: 'frist', label: 'Check-in fällig in (Tagen)', vorgabe: 2, knoten: 'a1', feld: 'fristTage' }],
  offen: [], demo: 'Ein Saat-Kunde gibt einen niedrigen Puls: liegt das Puls-Gespräch schon im Stapel, endet der Lauf; sonst steht die Aufgabe „Check-in“ an.',
  definition: prozess({
    id: 'fb-08', titel: 'Puls niedrig — Check-in', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Prüft, ob das Puls-Gespräch des Fulfillments offen ist — sonst eine Aufgabe „Check-in“ an die zuständige Person.',
    startKriterium: 'Der letzte Kunden-Puls liegt unter der Schwelle (Hänger „Puls“).', endKriterium: 'Check-in gemacht, oder das Puls-Gespräch läuft schon im Fall.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Check-in', schritte: [
        S.ereignis('t', 'Puls kritisch', 'fall-haengt', [B.ist('ereignis.stufe', 'puls')]),
        S.regel('r1', 'Noch kein Puls-Gespräch im Stapel?', [B.ist('fall.puls-gespraech-offen', false)], { zweige: { nein: 'z0' } }),
        S.aufgabe('a1', 'Check-in mit dem Kunden', { titel: 'Check-in mit dem Kunden', wer: ZUSTAENDIG, fristTage: 2, prioritaet: 'high', beschreibung: 'Der Kunden-Puls ist niedrig — kurz anrufen und zuhören, was gerade nicht passt.' }),
        S.ziel('z1', 'Check-in gemacht'),
        S.ziel('z0', 'Läuft schon im Fall'),
      ] },
    ],
  }),
};

const FB9: KgVorlage = {
  ...basis, id: 'fb-09', nr: 'FB9', titel: 'Abschluss & Verlängerung',
  zweck: 'Ist die letzte Etappe geschafft und das Mandat läuft weiter, übergibt der Prozess an „Bestandskunden-Ausbau & Verlängerung“ (V15) — dort laufen Review, Verlängerung und Kündigungsfrist; nichts davon hier doppelt.',
  ausloeserText: 'Die letzte Etappe des Falls ist abgeschlossen', braucht: ['fulfillment', 'mandate'], uebergabeAn: ['kg-v15'],
  recht: ['Nur intern: die Übergabe startet V15 — Nachrichten und Angebote entstehen dort, jeweils erst nach der Freigabe.'],
  kennzahlen: ['traktion:mrr', KENNZAHL_LAEUFE],
  einstellbar: [],
  offen: [], demo: 'Im Saat-Fall wird die letzte Etappe abgeschlossen: der Lauf übergibt an V15 (ist V15 noch nicht übernommen, endet er mit Hinweis).',
  definition: prozess({
    id: 'fb-09', titel: 'Abschluss & Verlängerung', bereich: 'fulfillment', fallArt: 'mandat',
    beschreibung: 'Nach der letzten Etappe: läuft das Mandat weiter, geht es mit V15 weiter (Review, Verlängerung, Kündigungsfrist).',
    startKriterium: 'Die letzte Etappe des Falls ist abgeschlossen.', endKriterium: 'An V15 übergeben, oder das Mandat endet ohnehin.',
    zettel: STANDARD_ABBRUCH,
    phasen: [
      { titel: 'Übergeben', schritte: [
        S.ereignis('t', 'Etappe abgeschlossen', 'fall-phase', [B.ist('ereignis.stufe', 'abgeschlossen')]),
        S.regel('r1', 'Keine Etappe mehr offen?', [B.leer('fall.phase')], { zweige: { nein: 'z0' } }),
        S.regel('r2', 'Mandat läuft weiter?', [B.ist('mandat.status', 'aktiv')], { zweige: { nein: 'z1' } }),
        S.uebergabe('u1', 'Weiter mit „Bestandskunden-Ausbau & Verlängerung“', 'kg-v15'),
        S.ziel('z0', 'Es geht noch weiter'),
        S.ziel('z1', 'Mandat endet'),
      ] },
    ],
  }),
};

/** Die neun Begleit-Vorlagen „Fulfillment · Kunden-Begleitung“ (FB1 … FB9). */
export const BEGLEIT_VORLAGEN: readonly KgVorlage[] = [FB1, FB2, FB3, FB4, FB5, FB6, FB7, FB8, FB9];
