// ─── Prozesse — das Register der Prozesse, die schon im Code laufen (Etappe A, 21.10.; ANALYSE_100.md Punkt 4, Entscheidung E3) ──────────────────
// Sehen, was schon läuft — EINE Wahrheit statt eines zweiten Bildes: jeder Eintrag beschreibt einen Ablauf, den MAKE OS heute schon ausführt
// (Quelle im Kommentar), mit Steckbrief (Punkt 7), Phasen (Ebene 2) und Schritten in den festen Formen (Ebene 3). Die Kacheln heißen „System“ und sind NUR
// lesbar (E3) — gebaut bzw. umgebaut wird erst in Etappe B (ein Prozess nach dem anderen, je mit Gold-Test).
// Plattform-Regel: nur Daten, keine Namen, keine Firmen, keine Beträge — Eigner sind Rollen; Links nur über WEG. Die Zahl je Kachel rechnet der Server
// aus den vorhandenen Lesewegen (`zaehler`, lib/prozesse/server.ts). Neuer Prozess = ein Eintrag hier (+ Fall in tests/prozesse-register.test.ts).

import { WEG } from '@/lib/wege';
import { MARKE_EVENTS } from '@/lib/crm/marke';
import type { ProzessDef, ProzessPhase, ProzessSchritt } from './typen';

type S = ProzessSchritt;
const schritt = (id: string, titel: string, was?: string, x: Partial<S> = {}): S => ({ id, titel, form: 'schritt', ...(was ? { was } : {}), ...x });
const nachricht = (id: string, titel: string, was?: string, x: Partial<S> = {}): S => ({ id, titel, form: 'nachricht', ...(was ? { was } : {}), ...x });
const frage = (id: string, titel: string, nein: string | null, was?: string, x: Partial<S> = {}): S => ({ id, titel, form: 'entscheidung', ...(nein ? { nein } : {}), ...(was ? { was } : {}), ...x });
const erinnerung = (id: string, titel: string, was?: string, x: Partial<S> = {}): S => ({ id, titel, form: 'erinnerung', ...(was ? { was } : {}), ...x });
const termin = (id: string, titel: string, was?: string, x: Partial<S> = {}): S => ({ id, titel, form: 'termin', ...(was ? { was } : {}), ...x });
const phase = (id: string, titel: string, schritte: S[]): ProzessPhase => ({ id, titel, schritte });

export const SYSTEM_PROZESSE: readonly ProzessDef[] = [
  // ── Führung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/crm/planung.ts, lib/crm/planung-server.ts (Markttraktion › Planung)
    id: 'sp-vertriebsplanung', titel: 'Vertriebsplanung & Kreislauf', quelle: 'system', band: 'fuehrung',
    steckbrief: { ausloeser: 'Wochenbeginn bzw. von Hand in der Vertriebsplanung', eingang: 'Umsatzziele, Leadkanäle und ihre Quoten', ergebnis: 'Wochenziele je Welt und Person', empfaenger: 'Marketing und Sales', eigner: 'Head of Sales' },
    phasen: [
      phase('ziel', 'Ziel setzen', [schritt('ziel-1', 'Umsatzziel je Gesellschaft', 'Ein Jahresziel je Business-Gesellschaft — Vorschlag aus den Zahlenzielen der Planung.'), schritt('ziel-2', 'Kanäle mit Quoten planen', 'Je Leadkanal Plan-Quoten (Lead → Gespräch → SQL → Angebot → gewonnen); ohne eigene gilt die Annahme.')]),
      phase('woche', 'Woche planen', [
        schritt('woche-1', 'Wochenziele rechnen', 'Aus Ziel und Quoten folgen die Aktivitäten je Woche.'),
        frage('woche-2', 'Mit der freien Zeit machbar?', 'woche-3', 'Bedarf je Person gegen die freien Stunden der Kapazität (ohne Kopf & Energie).'),
        erinnerung('woche-3', 'Ziel oder Kanäle anpassen', 'Mehr verplant als frei — die Planung zeigt, wo es eng wird.', { zurueck: true }),
      ]),
      phase('kreislauf', 'Kreislauf lesen', [schritt('kreis-1', 'Kreislauf von Kanälen bis Wiederkauf', 'Dieselben Zahlen wie Leads, Deals, Follow-ups und Mandate — nichts neu gezählt.'), schritt('kreis-2', 'Challenges der Woche', 'Vorschläge aus Wochenzielen und Vorwoche; erst ein Klick legt sie an.')]),
    ],
    link: { href: WEG.vertriebsplanung('kreislauf'), text: 'Markttraktion › Planung' },
    uebergaben: [{ nach: 'sp-kampagnen', text: 'Wochenziele' }],
  },
  {
    // lib/business/* (Monatsabschluss), lib/finanzen/chef/* (Head of Finance)
    id: 'sp-monatsabschluss', titel: 'Monatsabschluss & Head of Finance', quelle: 'system', band: 'fuehrung',
    steckbrief: { ausloeser: 'Monatsende bzw. der Takt des Head of Finance', eingang: 'Konten, Rechnungen, Zahlungen und Planposten der Business-Gesellschaften', ergebnis: 'Abgeschlossener Monat, Business-Index, Hinweise', empfaenger: 'Inhaber', eigner: 'Head of Finance' },
    phasen: [
      phase('abschluss', 'Abschluss erfassen', [schritt('ab-1', 'Ist-Zahlen je Gesellschaft', 'Der Monatsabschluss im Business-Cockpit — ab dem 0-Punkt.'), schritt('ab-2', 'Business-Index rechnen', 'Finanzielle Gesundheit, Personal, Markttraktion, Fokus, Kapazität — ein Kern für alle Indizes.')]),
      phase('pruefen', 'Prüfen', [
        schritt('pr-1', 'Finanzbild rechnen', 'Deterministisch: Kasse, Liquidität, Fristen, Brücke — das Modell ordnet nur ein.'),
        frage('pr-2', 'Rot oder Abschluss fehlt?', 'pr-3', 'Der Prüfer kontrolliert jede Zahl, Quelle und Frist.'),
        schritt('pr-3', 'Alles im grünen Bereich', undefined, { ende: true }),
        nachricht('pr-4', 'Hinweis in die Freigaben', 'Vorschlag mit Beleg — angenommen wird er eine Aufgabe; Geld bewegt der Agent nie.'),
      ]),
    ],
    link: { href: WEG.abschluss(), text: 'Finanzen › Business › Monatsabschluss' },
  },
  {
    // lib/heads/lauf.ts, lib/heads/takt.ts, lib/heads/autonomie.ts
    id: 'sp-head-takt', titel: 'Head-Takt (Vorschläge der Heads)', quelle: 'system', band: 'fuehrung',
    steckbrief: { ausloeser: 'Takt werktags 7–22 Uhr, höchstens 12 Läufe je Head und Tag', eingang: 'Datenpaket des Bereichs, Lernstand, Gedächtnis', ergebnis: 'Geprüfte Vorschläge im Freigabe-Stapel', empfaenger: 'Die zuständige Person', eigner: 'ZOE (Agenten)' },
    phasen: [
      phase('paket', 'Datenpaket', [schritt('pa-1', 'Fachdaten zusammentragen', 'Nie private Notizen, nie gesperrte Personen im Paket.'), schritt('pa-2', 'Grundlauf (Regelwerk)', 'Ohne Modell — bei leerem Guthaben IST er das Ergebnis.')]),
      phase('modell', 'Modell & Prüfer', [
        schritt('mo-1', 'Modell übernimmt, verwirft, ergänzt'),
        frage('mo-2', 'Prüfer einverstanden?', 'mo-3', 'Kennungen, Kanal-Ampel, Vollzug, Zahlen, Qualitätsrubrik.'),
        erinnerung('mo-3', 'Eine Korrekturrunde', undefined, { zurueck: true }),
      ]),
      phase('freigabe', 'Freigabe', [
        nachricht('fr-1', 'Vorschlag in den Stapel', 'Mit Belegen und an die zuständige Person.'),
        frage('fr-2', 'Angenommen?', 'fr-3', 'Annehmen oder ablehnen mit Grund — beides lernt der Head.'),
        schritt('fr-3', 'Ablehnung mit Grund — der Head lernt', undefined, { ende: true }),
        schritt('fr-4', 'Aufgabe bzw. nächster Schritt'),
      ]),
    ],
    link: { href: WEG.agenten(), text: 'ZOE › Agenten' },
  },
  {
    // lib/planung/kaskade.ts, lib/planung/meilenstein-kette.ts, lib/kapazitaet/modell.ts
    id: 'sp-meilensteine', titel: 'Ziele & Meilenstein-Kette', quelle: 'system', band: 'fuehrung',
    steckbrief: { ausloeser: 'Jahresplanung bzw. ein neues Ziel', eingang: 'Jahresziele, Aufwand und Termine', ergebnis: 'Meilensteine mit Aufgaben, Machbarkeit und Fortschritt', empfaenger: 'Alle, die daran arbeiten', eigner: 'Head of Strategie' },
    phasen: [
      phase('ziel', 'Ziel', [schritt('zi-1', 'Jahresziel setzen'), schritt('zi-2', 'Kaskade bis zum Tag', 'Quartal, Monat, Woche und Tag werden abgeleitet.')]),
      phase('kette', 'Kette', [schritt('ke-1', 'Meilensteine mit „wartet auf“', 'Höchstens zehn Abhängigkeiten, keine Kreise.'), schritt('ke-2', 'Aufgaben-Liste je Meilenstein')]),
      phase('machbar', 'Machbarkeit', [
        frage('ma-1', 'Zum Termin machbar?', 'ma-2', 'Rest-Aufwand gegen freie Stunden bis zum Termin (≤ 70 % machbar, ≤ 90 % eng).'),
        erinnerung('ma-2', 'Termin oder Aufwand anpassen', undefined, { zurueck: true }),
        schritt('ma-3', 'Fortschritt aus den Aufgaben'),
      ]),
    ],
    link: { href: WEG.jahr(), text: 'Planung › Jahr' },
  },

  // ── Kern · Marketing ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/crm/kampagnen.ts (Playbooks), lib/crm/recht.ts (Kanal-Ampel)
    id: 'sp-kampagnen', titel: 'Kampagnen (Playbooks)', quelle: 'system', band: 'kern', stufe: 'marketing',
    steckbrief: { ausloeser: 'Wochenziele bzw. Vorschlag des Head of Marketing', eingang: 'Segment und Playbook', ergebnis: 'Antworten und Interesse an der Person', empfaenger: 'Sales (Qualifizierung)', eigner: 'Head of Marketing' },
    phasen: [
      phase('planen', 'Planen', [
        schritt('pl-1', 'Segment wählen'),
        schritt('pl-2', 'Playbook wählen', 'Begründung und Rechtshinweis je Playbook.'),
        frage('pl-3', 'Kanal-Ampel grün oder gelb?', 'pl-4', 'Werbesperre, Einschränkung (Art. 18) und rote Ampel nehmen eine Person nie auf.'),
        schritt('pl-4', 'Person bleibt draußen', undefined, { ende: true }),
      ]),
      phase('ansprechen', 'Ansprechen', [nachricht('an-1', 'Entwurf je Person', 'MAKE OS versendet nichts — Text zum Kopieren bzw. per Klick.'), schritt('an-2', 'In der Power Hour anrufen bzw. schreiben')]),
      phase('ergebnis', 'Ergebnis', [
        schritt('er-1', 'Antwort erfassen'),
        frage('er-2', 'Interesse?', 'er-3'),
        schritt('er-3', 'Kein Interesse vermerken', undefined, { ende: true }),
        schritt('er-4', 'Lead in die Qualifizierung'),
      ]),
    ],
    link: { href: WEG.marketing('kampagnen'), text: 'Markttraktion › Marketing › Kampagnen' },
    uebergaben: [{ nach: 'sp-lead-sql', text: 'Interesse' }],
  },
  {
    // lib/inbox/*, app/api/crm/anfrage (Kontakt aus Mail, WhatsApp, Buchung)
    id: 'sp-anfrage', titel: 'Anfrage-Eingang', quelle: 'system', band: 'kern', stufe: 'marketing',
    steckbrief: { ausloeser: 'Mail, WhatsApp-Nachricht oder Formular einer unbekannten Person', eingang: 'Nachricht in der Inbox', ergebnis: 'Kontakt mit Herkunft und Lead', empfaenger: 'Sales (Qualifizierung)', eigner: 'Head of Marketing' },
    phasen: [
      phase('eingang', 'Eingang', [
        nachricht('ei-1', 'Nachricht in der Inbox'),
        frage('ei-2', 'Absender bekannt?', 'ei-3', 'Abgleich über alle Adressen bzw. die Nummer — Sammeladressen nie.'),
        schritt('ei-3', 'Kontakt anlegen', 'Herkunft „Anfrage über …“, Dublette über die Adresse bzw. Nummer.'),
        schritt('ei-4', 'Zuordnen per Klick', 'Erst „Zuordnen“ schreibt den Verlauf der Akte — nie automatisch.'),
      ]),
      phase('antwort', 'Antwort', [nachricht('aw-1', 'Antwort als Entwurf', 'ZOE schlägt vor, gesendet wird nur per Klick.')]),
      // 30.10. (Kreislauf sehen): die übrigen Vorschläge, die die Inbox im Gespräch macht (lib/inbox/gespraech-server.ts `vorschlaegeFuer`) — nichts davon
      // passiert von selbst; je Gespräch höchstens drei, jeder erst per Klick.
      phase('vorschlaege', 'Vorschläge im Gespräch', [
        erinnerung('vs-1', 'Nachfassen vorschlagen', 'Fach „Warten“: die jüngste echte Nachricht ist von uns und seit drei Tagen ohne Antwort (nach 30 Tagen verjährt).'),
        schritt('vs-2', 'Aufgabe aus einer Frist', 'Eine Frist im Text der letzten fremden Nachricht wird eine Aufgabe mit Datum — angelegt per Klick.'),
        termin('vs-3', 'Termin vorschlagen', 'Fach „Termine“ — die freie Zeit der Person, angelegt per Klick.'),
        schritt('vs-4', 'Beleg ablegen', 'Fach „Geld & Papier“ mit PDF bzw. Bild — übernommen in die Gesellschaft des Bereichs per Klick.'),
        schritt('vs-5', 'Deal nachfassen planen', 'Zugeordneter Kontakt mit offenem Deal — das Nachfassen am Deal per Klick.'),
      ]),
    ],
    link: { href: WEG.marketing('anfragen'), text: 'Markttraktion › Marketing › Anfragen' },
    uebergaben: [{ nach: 'sp-lead-sql', text: 'neuer Lead' }],
  },
  {
    // lib/crm/netzwerken.ts, lib/crm/netzwerken-server.ts (acht Schritte, idempotent)
    id: 'sp-netzwerken', titel: 'Netzwerken (Erfassen auf Veranstaltungen)', quelle: 'system', band: 'kern', stufe: 'marketing',
    steckbrief: { ausloeser: 'Eine Person auf einer Veranstaltung kennengelernt', eingang: 'Visitenkarte, Foto oder Sprachnotiz', ergebnis: 'Kontakt mit nächstem Schritt', empfaenger: 'Zuständige Person im Team', eigner: 'Head of Event' },
    phasen: [
      phase('erfassen', 'Erfassen', [
        schritt('nw-1', 'Event wählen bzw. anlegen'),
        schritt('nw-2', 'Person erfassen', 'Auch ohne Netz — die Warteschlange sendet, sobald es wieder geht.'),
        frage('nw-3', 'Schon bekannt?', null, 'Ja → an die vorhandene Akte hängen, nein → neu anlegen. EINE Regel für Firma und Person; Art. 18 → nichts wird angelegt.'),
      ]),
      phase('schritt', 'Nächster Schritt', [schritt('ns-1', `Termin, Qualifizieren, Follow-up, Vermitteln, Angebot, ${MARKE_EVENTS} oder nur Kontakt`, 'Die Visitenkarte ist KEINE Einwilligung.')]),
      phase('abschluss', 'Abschluss', [schritt('ab-1', 'Follow-up, Termin oder Deal anlegen'), nachricht('ab-2', 'Danke-Mail als Entwurf', 'Nur nach einem echten Gespräch, nur per Einzelklick.')]),
    ],
    link: { href: WEG.netzwerken(), text: 'Netzwerken' },
    uebergaben: [{ nach: 'sp-event-nachfassen', text: 'erfasst' }, { nach: 'sp-lead-sql', text: 'Qualifizieren' }],
  },
  {
    // lib/crm/besuche.ts (`besuchWirkung`, `BESUCH_FOLLOWUP_TAGE`, `FOLLOWUP_QUOTE_DEFINITION`) — Punkt 74
    id: 'sp-event-nachfassen', titel: 'Event-Nachfassen in 48 Stunden', quelle: 'system', band: 'kern', stufe: 'marketing',
    steckbrief: { ausloeser: 'Personen auf einem besuchten Event erfasst', eingang: 'Erfasste Personen des Events', ergebnis: 'Rechtzeitig nachgefasst (Follow-up, Termin, Gespräch oder Danke-Mail raus)', empfaenger: 'Sales (Follow-up)', eigner: 'Head of Event' },
    phasen: [
      phase('danach', 'Nach dem Event', [
        schritt('da-1', 'Erfasste Personen'),
        frage('da-2', 'Nachfassen?', 'da-3', 'Wer bewusst nicht nachgefasst wird („Nur Kontakt“), zählt nicht mit.'),
        schritt('da-3', 'Verzicht vermerken', undefined, { ende: true }),
      ]),
      phase('nachfassen', 'Nachfassen', [nachricht('nf-1', 'Danke-Mail als Entwurf', 'Senden nur per Klick; nach 14 Tagen nicht mehr vorgeschlagen.'), schritt('nf-2', 'Follow-up, Termin oder Gespräch')]),
      phase('frist', 'Frist', [
        frage('fr-1', 'Binnen zwei Tagen?', 'fr-2', 'Zählt in die Follow-up-Quote der besuchten Events.'),
        erinnerung('fr-2', 'Zu spät — zählt nicht als rechtzeitig', 'Offenes Nachfassen steht in „Steht an“ und der Glocke.', { ende: true }),
        schritt('fr-3', 'Rechtzeitig nachgefasst'),
      ]),
    ],
    link: { href: WEG.besuch(undefined, 'wirkung'), text: 'Markttraktion › Events › Wirkung' },
    uebergaben: [{ nach: 'sp-followup', text: 'Follow-up' }],
    zaehler: 'event-nachfassen',
  },
  {
    // lib/crm/eventplanung.ts, lib/crm/marke.ts (eigene Abende unter der Veranstaltungsmarke)
    id: 'sp-makeone', titel: `Eigenes Event (${MARKE_EVENTS})`, quelle: 'system', band: 'kern', stufe: 'marketing',
    steckbrief: { ausloeser: 'Ein eigener Abend wird geplant', eingang: 'Vorlage, Format, Reihe und Ziel', ergebnis: 'Gäste da, Nachfassen erledigt, Anmeldungen als Marketing-Leads', empfaenger: 'Sales (Qualifizierung)', eigner: 'Head of Event' },
    phasen: [
      phase('planen', 'Planen', [schritt('pl-1', 'Vorlage und Format'), schritt('pl-2', 'Ziel und Budget'), schritt('pl-3', 'Checkliste wird zu Aufgaben')]),
      phase('gaeste', 'Gäste', [schritt('ga-1', 'Gästemischung'), nachricht('ga-2', 'Einladung als Entwurf', 'Nur über zulässige Kanäle; Werbesperre → niemand wird vorgemerkt.')]),
      phase('abend', 'Abend', [termin('ab-1', 'Termin im Kalender', 'Der Spiegel zieht den Termin nach, wenn sich das Event ändert.'), schritt('ab-2', 'Check-in')]),
      phase('nachher', 'Danach', [schritt('na-1', 'Nachfassen binnen 48 Stunden'), schritt('na-2', 'Anmeldungen zählen als Marketing-Lead')]),
    ],
    link: { href: WEG.event(), text: `Markttraktion › Events › ${MARKE_EVENTS}` },
    uebergaben: [{ nach: 'sp-lead-sql', text: 'Anmeldung' }],
  },

  // ── Kern · Sales ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/crm/leads.ts (`LEAD_STATUS`), lib/crm/scoring.ts (Muss-Kriterien, Sales-Schwelle)
    id: 'sp-lead-sql', titel: 'Lead → SQL (Qualifizierung)', quelle: 'system', band: 'kern', stufe: 'sales',
    steckbrief: { ausloeser: 'Neuer Lead aus Kampagne, Anfrage, Netzwerken oder Event', eingang: 'Lead (Firma bzw. Person)', ergebnis: 'SQL mit Deal und nächstem Schritt', empfaenger: 'Sales (Pipeline)', eigner: 'Head of Sales' },
    phasen: [
      phase('ansprechen', 'Ansprechen', [nachricht('an-1', 'Erste Ansprache über einen zulässigen Kanal'), schritt('an-2', 'Kontaktiert bzw. im Gespräch')]),
      phase('qualifizieren', 'Qualifizieren', [
        schritt('qu-1', 'Kernfragen und Scoring', 'Dieselbe Rechnung wie die Runde „Qualifizierung & Scoring“.'),
        frage('qu-2', 'Muss-Kriterien und Sales-Schwelle erreicht?', 'qu-3', 'Die Regel steht in den Scoring-Einstellungen — nie fest im Code.'),
        erinnerung('qu-3', 'Parken: ruht oder kein Fit', 'Mit Wiedervorlage bzw. Grund.', { ende: true }),
      ]),
      phase('sql', 'SQL', [schritt('sq-1', 'Deal anlegen mit nächstem Schritt', 'Der nächste Schritt mit Datum ist Pflicht.')]),
    ],
    link: { href: WEG.qualifizierung(), text: 'Markttraktion › Qualifizierung' },
    uebergaben: [{ nach: 'sp-deal', text: 'SQL' }],
    zaehler: 'leads',
  },
  {
    // lib/crm/pipeline.ts (`STUFEN`), lib/crm/angebot-server.ts, lib/crm/mandat-anlegen.ts
    id: 'sp-deal', titel: 'Deal → Angebot → Mandat', quelle: 'system', band: 'kern', stufe: 'sales',
    steckbrief: { ausloeser: 'Lead ist SQL', eingang: 'Deal mit Kernfragen aus der Qualifizierung', ergebnis: 'Gewonnener Deal bzw. Verlust mit Grund', empfaenger: 'Übergabe an die Lieferung', eigner: 'Head of Sales' },
    phasen: [
      phase('bedarf', 'Bedarf', [termin('be-1', 'Bedarfsgespräch mit dem Entscheider'), schritt('be-2', 'Drei bis fünf Prioritäten')]),
      phase('diagnose', 'Diagnose', [schritt('di-1', 'Diagnose gehalten', 'Wirkung, Budgetrahmen und Zeitpunkt bestätigt.')]),
      phase('angebot', 'Angebot', [
        schritt('ag-1', 'Angebot stellen', 'Nummer, PDF und Fingerabdruck in EINER Sperre — danach nur als neue Version.'),
        termin('ag-2', 'Optionen besprechen'),
        frage('ag-3', 'Entscheidungsdatum genannt?', 'ag-4'),
        erinnerung('ag-4', 'Wiedervorlage', 'Ein Follow-up hält den Deal warm.', { zurueck: true }),
      ]),
      phase('abschluss', 'Abschluss', [
        frage('as-1', 'Angenommen?', 'as-2', 'Angenommen → Deal gewonnen; abgelehnt → Grund ist Pflicht.'),
        schritt('as-2', 'Verloren mit Grund', undefined, { ende: true }),
        schritt('as-3', 'Deal gewonnen'),
      ]),
    ],
    link: { href: WEG.deals(), text: 'Markttraktion › Deals' },
    uebergaben: [{ nach: 'sp-uebergabe', text: 'gewonnen' }],
    zaehler: 'deals',
  },
  {
    // lib/crm/followup.ts (`faellige` — DIE Fälligkeitsliste), Power Hour je Person (lib/crm/team.ts). Überführbar (Paket Ü 2): die Vorbereitung der Power Hour —
    // Weiche in lib/heads/takt.ts `headsFaellig`, Kern `powerHourKern` (lib/prozesse/ueberfuehrung.ts `UEBERFUEHRBAR`).
    id: 'sp-followup', titel: 'Follow-up & Power Hour', quelle: 'system', band: 'kern', stufe: 'sales',
    steckbrief: { ausloeser: 'Fälligkeit: nächster Schritt, Wiedervorlage, Kadenz je Kreis', eingang: 'Fälligkeitsliste', ergebnis: 'Erledigt mit Ergebnis bzw. neu verschoben', empfaenger: 'Die zuständige Person', eigner: 'Head of Sales' },
    phasen: [
      phase('faellig', 'Fällig', [schritt('fa-1', 'Fälligkeitsliste', 'Echte Follow-ups und abgeleitete aus Kontakt, Deal, Event und Mandat.')]),
      phase('powerhour', 'Power Hour', [schritt('ph-1', 'Karten je Person', 'Nie rufen zwei dieselbe Person an.'), nachricht('ph-2', 'Anruf oder Mail', 'Kanal-Ampel; ein gelber Anruf braucht einen Anlass.')]),
      phase('ergebnis', 'Ergebnis', [
        schritt('eg-1', 'Ergebnis erfassen'),
        frage('eg-2', 'Erledigt?', 'eg-3'),
        erinnerung('eg-3', 'Verschieben mit neuer Frist', undefined, { zurueck: true }),
      ]),
    ],
    link: { href: WEG.followup(), text: 'Markttraktion › Follow-up' },
    zaehler: 'followup',
  },
  {
    // lib/kalender/buchung*.ts (vorläufig → bestätigt → angefragt → Freigabe), Absichtsprotokoll Art „buchung“
    id: 'sp-buchung', titel: 'Terminbuchung (Buchungsseite)', quelle: 'system', band: 'kern', stufe: 'sales',
    steckbrief: { ausloeser: 'Ein Gast wählt einen freien Platz auf einer Buchungsseite', eingang: 'Platz, Name, Adresse und Antworten des Gasts', ergebnis: 'Termin im Kalender mit Aktivität und Follow-up', empfaenger: 'Die Person der Buchungsseite', eigner: 'Person der Buchungsseite' },
    phasen: [
      phase('anfrage', 'Anfrage', [
        schritt('an-1', 'Platz 30 Minuten gehalten'),
        frage('an-2', 'Gast bestätigt per Link?', 'an-3'),
        schritt('an-3', 'Platz verfällt', undefined, { ende: true }),
      ]),
      phase('freigabe', 'Freigabe', [frage('fg-1', 'Freigeben?', 'fg-2', 'Nur mit frischem Kalenderstand; belegt → Rückfrage.'), schritt('fg-2', 'Ablehnen', undefined, { ende: true })]),
      phase('termin', 'Termin', [termin('te-1', 'Termin im Kalender'), schritt('te-2', 'Aktivität und Kontakt im CRM'), schritt('te-3', 'Follow-up „Termin vorbereiten“')]),
    ],
    link: { href: WEG.kalender(), text: 'Kalender › Buchungsseiten' },
    uebergaben: [{ nach: 'sp-followup', text: 'Termin vorbereiten' }],
  },

  // ── Kern · Übergabe ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/crm/mandat-anlegen.ts, lib/fulfillment/prozesse/onboarding.ts
    id: 'sp-uebergabe', titel: 'Übergabe & Onboarding', quelle: 'system', band: 'kern', stufe: 'uebergabe',
    steckbrief: { ausloeser: 'Deal gewonnen', eingang: 'Deal und angenommenes Angebot', ergebnis: 'Fall startklar, Kick-off vermerkt', empfaenger: 'Fulfillment (Lieferung)', eigner: 'Head of Kundenerfolg' },
    phasen: [
      phase('mandat', 'Mandat', [schritt('ma-1', 'Mandat anlegen', 'Produkt und Ziele aus dem angenommenen Angebot vorbelegt.'), schritt('ma-2', 'Fall aus der Vorlage starten')]),
      phase('onboarding', 'Onboarding', [
        nachricht('on-1', 'Willkommen binnen 24 Stunden', 'Als Entwurf — gesendet wird per Klick.'),
        termin('on-2', 'Kick-off'),
        frage('on-3', 'Startklar?', 'on-4'),
        erinnerung('on-4', 'Offene Onboarding-Schritte', undefined, { zurueck: true }),
      ]),
    ],
    link: { href: WEG.fulfillment('onboarding'), text: 'Fulfillment › Onboarding' },
    uebergaben: [{ nach: 'sp-lieferung', text: 'startklar' }, { nach: 'sp-rechnung', text: 'Mandat aktiv' }],
    zaehler: 'onboarding',
  },

  // ── Kern · Fulfillment ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/fulfillment/prozesse/ausfuehrung*.ts (Schritt → Aufgabe, Nachricht → Stapel, Entscheidung → Glocke, Erinnerung → Runden)
    id: 'sp-lieferung', titel: 'Lieferung (Ausführung der Abläufe)', quelle: 'system', band: 'kern', stufe: 'fulfillment',
    steckbrief: { ausloeser: 'Ein Fall läuft', eingang: 'Fall mit seinem Ablauf aus der Vorlage', ergebnis: 'Phasen erledigt, Abstimmungspunkte bestätigt', empfaenger: 'Kunde', eigner: 'Head of Kundenerfolg' },
    phasen: [
      phase('ausfuehren', 'Ausführen', [
        schritt('au-1', 'Schritt wird Aufgabe'),
        nachricht('au-2', 'Nachricht wird Vorschlag in den Freigaben'),
        frage('au-3', 'Entscheidung beantwortet?', 'au-4', 'Die Glocke fragt die zuständige Person.'),
        erinnerung('au-4', 'Erinnern — höchstens fünf Runden', 'Danach „eskaliert“.', { zurueck: true }),
      ]),
      phase('abstimmen', 'Abstimmen', [frage('ab-1', 'Abstimmungspunkt bestätigt?', 'ab-2', 'Vom Kunden per Kick-off, Mail, Link oder Termin.'), erinnerung('ab-2', 'Wartet auf den Kunden', undefined, { zurueck: true })]),
      phase('takt', 'Takt', [termin('ta-1', 'Rituale als Termine'), schritt('ta-2', 'Fortschritts-Report alle zwei Wochen')]),
    ],
    link: { href: WEG.fulfillment(), text: 'Produkte & Mandate › Fulfillment' },
    uebergaben: [{ nach: 'sp-wirkung', text: 'Ziel erreicht' }],
    zaehler: 'faelle',
  },
  {
    // lib/fulfillment/analyse* (Dossier, Läufe nur per Klick mit bestätigtem Betrag)
    id: 'sp-analyse', titel: 'Analyse & Dossier', quelle: 'system', band: 'kern', stufe: 'fulfillment',
    steckbrief: { ausloeser: 'Klick auf einen Analyse-Lauf mit bestätigtem Betrag', eingang: 'Eingaben zum Mandat, Interessenabwägung', ergebnis: 'Dossier mit geprüften Ergebnissen', empfaenger: 'Lieferung (Kick-off-Fragen, Quick Wins)', eigner: 'Head of Kundenerfolg' },
    phasen: [
      phase('anlegen', 'Dossier anlegen', [schritt('dl-1', 'Eingaben'), frage('dl-2', 'Interessenabwägung erfüllt?', 'dl-3'), schritt('dl-3', 'Ohne Personenteil')]),
      phase('laeufe', 'Läufe', [schritt('la-1', 'Agenten in Wellen', 'Kein Autostart — je Lauf ein Klick mit Kostenschätzung.'), schritt('la-2', 'Tiefenbericht')]),
      phase('uebernehmen', 'Übernehmen', [frage('ue-1', 'Ergebnis übernehmen?', 'ue-2'), schritt('ue-2', 'Verwerfen', undefined, { ende: true }), schritt('ue-3', 'Im Dossier')]),
    ],
    link: { href: WEG.fulfillment('analysen'), text: 'Fulfillment › Analysen' },
  },

  // ── Kern · Ausbau ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/fulfillment/prozesse/wirkung.ts (Wert-Konto, Wirkungsbericht), Nachsorge 14 · 45 · 90 Tage
    id: 'sp-wirkung', titel: 'Wirkung & Nachsorge', quelle: 'system', band: 'kern', stufe: 'ausbau',
    steckbrief: { ausloeser: 'Ziel erreicht bzw. Ende der Lieferung', eingang: 'Wert-Konto des Falls (vorher → jetzt → Ziel)', ergebnis: 'Wirkungsbericht und Nachsorge-Termine', empfaenger: 'Kunde', eigner: 'Head of Kundenerfolg' },
    phasen: [
      phase('messen', 'Messen', [schritt('me-1', 'Wert-Konto auswerten')]),
      phase('bericht', 'Bericht', [schritt('be-1', 'Wirkungsbericht als PDF'), nachricht('be-2', 'Versand per Klick in der Inbox')]),
      phase('nachsorge', 'Nachsorge', [erinnerung('ns-1', 'Nachsorge nach 14, 45 und 90 Tagen')]),
    ],
    link: { href: WEG.fulfillment('kreislauf'), text: 'Fulfillment › Kreislauf' },
    uebergaben: [{ nach: 'sp-wiederkauf', text: 'Empfehlung' }],
  },
  {
    // lib/crm/treppe-server.ts (Leistungstreppe, Report alle zwei Wochen)
    id: 'sp-treppe', titel: 'Leistungstreppe & Report', quelle: 'system', band: 'kern', stufe: 'ausbau',
    steckbrief: { ausloeser: 'Mandat in einem Paket der Leistungstreppe', eingang: 'Lieferungen des Pakets', ergebnis: 'Report und Angebot für die nächste Stufe', empfaenger: 'Kunde bzw. Sales', eigner: 'Head of Sales' },
    phasen: [
      phase('liefern', 'Liefern', [schritt('li-1', 'Lieferungen n von m'), nachricht('li-2', 'Report alle zwei Wochen')]),
      phase('stufe', 'Nächste Stufe', [frage('st-1', 'Reif für die nächste Stufe?', 'st-2'), schritt('st-2', 'Im Paket bleiben', undefined, { ende: true }), schritt('st-3', 'Angebot für die nächste Stufe')]),
    ],
    link: { href: WEG.produkt(), text: 'Produkte & Mandate › Produkte' },
    uebergaben: [{ nach: 'sp-deal', text: 'nächste Stufe' }],
  },
  {
    // lib/crm/planung.ts (`nachLeistungSchritte`, Wiederkauf)
    id: 'sp-wiederkauf', titel: 'Nach der Leistung & Wiederkauf', quelle: 'system', band: 'kern', stufe: 'ausbau',
    steckbrief: { ausloeser: 'Leistung erbracht bzw. Mandat beendet', eingang: 'Bestandskunde', ergebnis: 'Bewertung, Empfehlung bzw. neuer Deal', empfaenger: 'Sales', eigner: 'Head of Sales' },
    phasen: [
      phase('nachher', 'Nach der Leistung', [nachricht('nl-1', 'Bewertung und Testimonial'), schritt('nl-2', 'Upselling und Cross-Selling'), nachricht('nl-3', 'Newsletter mit Einwilligung')]),
      phase('wiederkauf', 'Wiederkauf', [frage('wk-1', 'Neuer Bedarf?', 'wk-2'), erinnerung('wk-2', 'Später wieder fragen', undefined, { zurueck: true }), schritt('wk-3', 'Neuer Deal mit Bestandskunde')]),
    ],
    link: { href: WEG.vertriebsplanung('kreislauf'), text: 'Markttraktion › Planung › Kreislauf' },
    uebergaben: [{ nach: 'sp-deal', text: 'neuer Bedarf' }],
    zaehler: 'nachher',
  },

  // ── Unterstützung ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // lib/finanzen/finanzplan-bestand.ts (`rechnungSchutz`, Storno), Buchung `bu-re-<id>`
    id: 'sp-rechnung', titel: 'Rechnung & Zahlung', quelle: 'system', band: 'unterstuetzung',
    steckbrief: { ausloeser: 'Mandat aktiv bzw. Leistung erbracht', eingang: 'Mandat und Produkte des Angebots', ergebnis: 'Bezahlte Rechnung mit Buchung', empfaenger: 'Monatsabschluss', eigner: 'Head of Finance' },
    phasen: [
      phase('rechnung', 'Rechnung', [schritt('re-1', 'Entwurf'), schritt('re-2', 'Stellen — danach festgeschrieben', 'Betrag, Nummer und Datum ändern sich nie mehr; nur Storno mit Grund.')]),
      phase('zahlung', 'Zahlung', [frage('za-1', 'Bezahlt?', 'za-2'), erinnerung('za-2', 'Fälligkeit — Zahlungserinnerung', undefined, { zurueck: true }), schritt('za-3', 'Buchung zur Rechnung')]),
    ],
    link: { href: WEG.rechnungen(), text: 'Finanzen › Rechnungen & Zahlungen' },
    uebergaben: [{ nach: 'sp-monatsabschluss', text: 'bezahlt' }],
  },
  {
    // lib/zoe/takt.ts, app/api/tagesstart (Morgenlauf: Serien, Fristen, Fulfillment-Ausführung, Wochenplan, Aufräumen)
    id: 'sp-morgenlauf', titel: 'Morgenlauf & System-Takt', quelle: 'system', band: 'unterstuetzung',
    steckbrief: { ausloeser: 'Takt alle fünf Minuten, Morgenlauf einmal am Tag', eingang: 'Bestände der Instanz', ergebnis: 'Abgeglichen, fällige Läufe erledigt, aufgeräumt', empfaenger: 'Alle Bereiche', eigner: 'Head of IT' },
    phasen: [
      phase('takt', 'Takt', [schritt('ta-1', 'Kalender und Postfächer abgleichen'), schritt('ta-2', 'Fehlgeschlagenes pausiert mit Backoff')]),
      phase('morgen', 'Morgenlauf', [schritt('mo-1', 'Serien und Wiederkehrendes'), erinnerung('mo-2', 'Fristen und Erinnerungen'), schritt('mo-3', 'Fulfillment-Ausführung'), schritt('mo-4', 'Wochenplan festhalten')]),
      phase('aufraeumen', 'Aufräumen', [schritt('au-1', 'Löschfristen und Papierkorb', 'Personen nie automatisch — nur Prüf-Aufgaben.')]),
    ],
    link: { href: WEG.system(), text: 'Einstellungen' },
  },
  {
    // lib/crm/person-bestaende.ts (Art. 15/17), lib/crm/einschraenkung.ts (Art. 18), Grabsteine
    id: 'sp-betroffenenrechte', titel: 'Betroffenenrechte (Auskunft & Löschen)', quelle: 'system', band: 'unterstuetzung',
    steckbrief: { ausloeser: 'Antrag einer betroffenen Person', eingang: 'Antrag mit Frist', ergebnis: 'Auskunft erteilt bzw. gelöscht, mit Nachweis', empfaenger: 'Betroffene Person', eigner: 'Head of Recht' },
    phasen: [
      phase('antrag', 'Antrag', [schritt('an-1', 'Antrag mit Frist erfassen'), frage('an-2', 'Person eindeutig?', 'an-3'), nachricht('an-3', 'Rückfrage an die Person', undefined, { zurueck: true })]),
      phase('erledigen', 'Erledigen', [schritt('er-1', 'Auskunft (Art. 15)'), schritt('er-2', 'Löschen mit Grabstein (Art. 17)'), schritt('er-3', 'Einschränken (Art. 18)')]),
      phase('nachweis', 'Nachweis', [schritt('nw-1', 'Protokoll ohne Inhalte')]),
    ],
    link: { href: WEG.stammdaten('datenschutz'), text: 'Markttraktion › Stammdaten › Datenschutz' },
  },
  {
    // lib/make-one/onboarding-data.ts (Etappen 0–8), lib/onboarding-status.ts
    id: 'sp-einrichtung', titel: 'Einrichtung der Instanz', quelle: 'system', band: 'unterstuetzung',
    steckbrief: { ausloeser: 'Neue Instanz bzw. neue Person', eingang: 'Konten, Verbindungen, Startbestand', ergebnis: 'Instanz eingerichtet', empfaenger: 'Alle Personen der Instanz', eigner: 'Inhaber' },
    phasen: [
      phase('zugang', 'Zugang & Sicherheit', [schritt('zu-1', 'Konto und zweiter Faktor')]),
      phase('verbinden', 'Verbindungen', [schritt('ve-1', 'Kalender und Postfächer')]),
      phase('daten', 'Daten', [schritt('da-1', 'Startbestand und 0-Punkt'), frage('da-2', 'Kern steht?', 'da-3'), erinnerung('da-3', 'Nächster Schritt der Einrichtung', undefined, { zurueck: true })]),
    ],
    link: { href: WEG.einrichtung(), text: 'Einstellungen › Einrichtung' },
  },
  {
    // lib/bauplan/board.ts (Ideen → Bereit → In Arbeit → Zum Testen → Fertig)
    id: 'sp-bauplan', titel: 'Bauplan (von der Idee bis zur Abnahme)', quelle: 'system', band: 'unterstuetzung',
    steckbrief: { ausloeser: '„Problem oder Idee melden“', eingang: 'Karte mit Seite und Bildschirmfoto', ergebnis: 'Abgenommene Änderung', empfaenger: 'Alle Personen der Instanz', eigner: 'Head of IT' },
    phasen: [
      phase('ideen', 'Ideen', [schritt('id-1', 'Melden')]),
      phase('bauen', 'Bauen', [schritt('ba-1', 'Bereit → In Arbeit'), schritt('ba-2', 'Zum Testen mit „So testet ihr“')]),
      phase('abnahme', 'Abnahme', [frage('ab-1', 'Passt?', 'ab-2'), erinnerung('ab-2', 'Zurück nach „Bereit“ mit Kommentar', undefined, { ende: true }), schritt('ab-3', 'Fertig')]),
    ],
    link: { href: WEG.bauplan(), text: 'Bauplan' },
  },
];
