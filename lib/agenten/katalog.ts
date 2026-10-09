// ─── Agenten-Bereich: der Katalog der Heads und Mitarbeiter-Vorlagen (08.10. spät, Paket 0 „Vertrag“) ────────
// Die Auswahl (ENTSCHEIDUNGEN_FRAGEBOGEN.md › Agenten-Bereich, Antworten 2–5):
//   Business: Sales · Marketing · Event · Finance · IT/Betrieb · Operations · Kundenerfolg/Mandate · Strategie/CEO-Office ·
//             Produkt · Recht & Datenschutz · Research
//   Privat (je Person getrennt; Familie gemeinsam für beide vollen Mitglieder): Gesundheit & Sport · Ernährung & Einkauf ·
//             Familie & Partnerschaft · Finanzen privat · Persönliche Assistenz
//   Zuerst ausgestattet: Marketing (Design, Kampagnen, Social Media/LinkedIn) · Sales (Recherche/Prospecting, Qualifizierung,
//             Angebote, Nachfassen & Power Hour, CRM-Pflege) · Finance (Rechnungen & Mahnungen, Liquidität & Planung).
//
// Reine Daten (client-sicher): keine Namen, keine Firmen, kein fester Speichername, keine Farbwerte (nur Token-Namen aus
// `LEUCHT`). Werkzeuge = Namen aus lib/zoe/register.ts — die Stufe (frei/freigabe) kommt IMMER aus dem Register, nie von hier.
// Wächter: tests/agenten-vertrag.test.ts (Werkzeuge ⊆ Register und ≤ 20, KI-Kategorien passen, Business nie Gesundheit,
// Vorlagen ⊆ Head, `auchFuer` nur im selben Bereich, Kennzahlen gibt es, Modi gibt es, keine Namen/Firmen).
// Neuer Head / neue Vorlage = Eintrag hier (additiv) — Kennungen nie ändern (Threads, Skills und Einstellungen hängen daran).

import type { Bereich, HeadDef, MitarbeiterVorlage } from './typen';

/** Die Modi der vorhandenen Heads (lib/heads/prompt.ts `MODI`) ohne „frage“ — die Frage ist jetzt der Chat. */
const HEADS_MODI = {
  sales: ['power_hour', 'lead_review', 'deal_review', 'kundenreview', 'kampagne', 'wochenreview'],
  marketing: ['wochenplan', 'netzwerk', 'kampagne', 'monatsreview'],
  event: ['planung', 'einladung', 'nachfassen', 'wirkung'],
} as const;
/** Die Modi des Finanzchefs (lib/finanzen/chef/prompt.ts `MODI`) ohne „frage“. */
const FINANZCHEF_MODI = ['tagescheck', 'wochenreview', 'monatsabschluss', 'steuercheck'] as const;

export const KATALOG: readonly HeadDef[] = [
  // ── Business ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'sales', name: 'Head of Sales', kurz: 'Sales', bereich: 'business', ebene: 'haushalt', ton: 'knapp', farbe: 'business',
    auftrag: 'Führt Vertrieb und Kundenbetreuung: Leads, Deals, Power Hour und Angebote — alles nach außen nur als Vorschlag.',
    kategorien: ['crm', 'kalender', 'aufgaben'],
    werkzeugGruppen: ['markttraktion', 'crm', 'kontakte', 'kalender', 'aufgaben'],
    werkzeuge: ['crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'sales_lage', 'qualifizierung_lage', 'kennzahlen', 'datenqualitaet', 'crm_datei_lesen', 'crm_vorschlag', 'entwurf_ansprache', 'freie_zeit', 'create_task'],
    kontext: 'heads', eingebaut: { quelle: 'heads', modi: HEADS_MODI.sales }, voraussetzung: 'modul:markttraktion',
    kennzahlen: [{ index: 'traktion', id: 'gespraeche' }, { index: 'traktion', id: 'win_rate' }, { index: 'traktion', id: 'ueberfaellig' }],
    stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'sales-recherche', name: 'Recherche & Prospecting', rolle: 'Sucht und bewertet passende Firmen und Ansprechpartner nach dem eigenen Zielkunden-Profil.',
        werkzeuge: ['crm_suche', 'firma_akte', 'kontakt_akte', 'qualifizierung_lage', 'crm_vorschlag'], agentId: 'prospect', stufe: 'schnell', auchFuer: ['marketing'] },
      { id: 'sales-qualifizierung', name: 'Qualifizierung', rolle: 'Bereitet Qualifizierungsrunden vor: Kernfragen, fehlende Angaben, Vorschlag für MQL oder SQL — entschieden wird per Klick.',
        werkzeuge: ['qualifizierung_lage', 'kontakt_akte', 'firma_akte', 'crm_suche', 'crm_vorschlag'], stufe: 'ausgewogen' },
      { id: 'sales-angebote', name: 'Angebote', rolle: 'Entwirft Angebote aus Deal, Produkt und Gesprächen — nur als Entwurf, gestellt wird per Klick.',
        werkzeuge: ['angebote_lage', 'pipeline', 'mandate_lage', 'firma_akte', 'kontakt_akte', 'crm_datei_lesen', 'crm_vorschlag'], stufe: 'ausgewogen' },
      { id: 'sales-nachfassen', name: 'Nachfassen & Power Hour', rolle: 'Stellt die Power-Hour-Liste zusammen und schlägt Reihenfolge, Anlass und Gesprächsleitfaden vor.',
        werkzeuge: ['sales_lage', 'pipeline', 'kontakt_akte', 'entwurf_ansprache', 'crm_vorschlag', 'freie_zeit'], agentId: 'crm', stufe: 'ausgewogen' },
      { id: 'sales-crm-pflege', name: 'CRM-Pflege', rolle: 'Findet Dubletten, tote Verweise und Lücken in der Kartei und schlägt Reparaturen vor.',
        werkzeuge: ['datenqualitaet', 'crm_suche', 'kontakt_akte', 'firma_akte', 'crm_vorschlag'], stufe: 'schnell' },
    ],
  },
  {
    id: 'marketing', name: 'Head of Marketing', kurz: 'Marketing', bereich: 'business', ebene: 'haushalt', ton: 'warm', farbe: 'beziehung',
    auftrag: 'Macht das Business sichtbar: Kampagnen, Beiträge, Newsletter und Netzwerk — mit Einwilligungen und Rechts-Ampel.',
    kategorien: ['crm', 'brain', 'aufgaben', 'web'],
    werkzeugGruppen: ['markttraktion', 'crm', 'kontakte', 'wissen', 'aufgaben'],
    werkzeuge: ['crm_suche', 'kontakt_akte', 'firma_akte', 'kampagnen_lage', 'marketing_lage', 'events_lage', 'kennzahlen', 'qualifizierung_lage', 'crm_datei_lesen', 'crm_vorschlag', 'entwurf_ansprache', 'suche_wissen', 'lies_notiz', 'create_task'],
    kontext: 'heads', eingebaut: { quelle: 'heads', modi: HEADS_MODI.marketing }, voraussetzung: 'modul:markttraktion',
    kennzahlen: [{ index: 'traktion', id: 'veroeffentlichungen' }, { index: 'traktion', id: 'content_gespraeche' }, { index: 'traktion', id: 'newsletter_netto' }],
    stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'marketing-design', name: 'Design', rolle: 'Schreibt Briefings, pflegt Vorlagen und prüft Beiträge, Einladungen und Kampagnen gegen das eigene Erscheinungsbild.',
        werkzeuge: ['marketing_lage', 'kampagnen_lage', 'suche_wissen', 'lies_notiz', 'crm_vorschlag'], stufe: 'ausgewogen', auchFuer: ['event'] },
      // Paket 4c (09.10.): Bilder und Videos erzeugt bzw. bearbeitet „Bild & Video“ über das Anbieter-Tor — seine Medien-Werkzeuge sind Agenten-
      // Werkzeuge (nicht im ZOE-Register): lib/agenten/medien-werkzeuge.ts `MEDIEN_AGENTEN`. Hier stehen nur seine Register-Werkzeuge.
      { id: 'marketing-bild-video', name: 'Bild & Video', rolle: 'Wählt aus gegebenen Fotos und Videos aus, schlägt Zuschnitte und Texte vor, erzeugt und bearbeitet Bilder mit der Bild-KI und schlägt kurze Videos vor — mit Kostenschätzung, KI-Kennzeichnung und nur als Vorschlag; ein Video startet erst ein Klick.',
        werkzeuge: ['marketing_lage', 'kampagnen_lage', 'events_lage', 'crm_suche', 'suche_wissen', 'lies_notiz'], stufe: 'schnell', auchFuer: ['event', 'sales'] },
      { id: 'marketing-kampagnen', name: 'Kampagnen', rolle: 'Plant Kampagnen nach den Playbooks: Segment, Kanal mit Rechts-Ampel, Texte und Nachfassen.',
        werkzeuge: ['kampagnen_lage', 'marketing_lage', 'crm_suche', 'kontakt_akte', 'qualifizierung_lage', 'kennzahlen', 'crm_vorschlag'], stufe: 'ausgewogen' },
      { id: 'marketing-social', name: 'Social Media & LinkedIn', rolle: 'Entwirft Beiträge und Netzwerk-Nachrichten in der eigenen Sprache — veröffentlicht und verschickt wird von Hand.',
        werkzeuge: ['marketing_lage', 'kampagnen_lage', 'kontakt_akte', 'suche_wissen', 'lies_notiz', 'entwurf_ansprache', 'crm_vorschlag'], agentId: 'content', stufe: 'ausgewogen', auchFuer: ['event'] },
    ],
  },
  {
    id: 'event', name: 'Head of Event', kurz: 'Event', bereich: 'business', ebene: 'haushalt', ton: 'warm', farbe: 'achtung',
    auftrag: 'Plant eigene Abende und begleitet besuchte Events: Ziel, Gästemischung, Nachfassen in 48 Stunden, Wirkung.',
    kategorien: ['crm', 'kalender', 'aufgaben'],
    werkzeugGruppen: ['markttraktion', 'crm', 'kontakte', 'kalender', 'aufgaben'],
    werkzeuge: ['events_lage', 'besuche_lage', 'crm_suche', 'kontakt_akte', 'firma_akte', 'kennzahlen', 'marketing_lage', 'crm_vorschlag', 'entwurf_ansprache', 'freie_zeit', 'create_task'],
    kontext: 'heads', eingebaut: { quelle: 'heads', modi: HEADS_MODI.event }, voraussetzung: 'modul:markttraktion',
    kennzahlen: [{ index: 'traktion', id: 'folgegespraeche' }, { index: 'traktion', id: 'erscheinen' }],
    stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'event-gaeste', name: 'Gäste & Einladung', rolle: 'Stellt Gästelisten mit guter Mischung zusammen und entwirft Einladungen — nur über zulässige Kanäle.',
        werkzeuge: ['events_lage', 'crm_suche', 'kontakt_akte', 'firma_akte', 'crm_vorschlag', 'entwurf_ansprache'], stufe: 'ausgewogen' },
      { id: 'event-nachfassen', name: 'Nachfassen 48 h', rolle: 'Bereitet Danke-Nachrichten und nächste Schritte nach einem Event vor — binnen 48 Stunden.',
        werkzeuge: ['events_lage', 'besuche_lage', 'kontakt_akte', 'crm_vorschlag', 'entwurf_ansprache'], stufe: 'schnell', auchFuer: ['sales'] },
      { id: 'event-abendbericht', name: 'Netzwerken-Abendbericht', rolle: 'Fasst die erfassten Begegnungen eines Abends zusammen und schlägt das Nachfassen vor.',
        werkzeuge: ['besuche_lage', 'kontakt_akte', 'crm_vorschlag'], stufe: 'schnell' },
    ],
  },
  {
    id: 'finanzen', name: 'Head of Finance', kurz: 'Finanzen', bereich: 'business', ebene: 'haushalt', ton: 'sorgfaeltig', farbe: 'geld',
    auftrag: 'Führt die Finanzen der Business-Gesellschaften: Liquidität, Rechnungen, Monatsabschluss, Fristen — bewegt nie Geld.',
    kategorien: ['finanzen', 'crm', 'aufgaben'],
    werkzeugGruppen: ['business', 'finanzen', 'markttraktion', 'aufgaben'],
    werkzeuge: ['business_index', 'gesellschaften_lesen', 'monatsabschluss_erfassen', 'setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten', 'setze_ziele', 'mandate_lage', 'angebote_lage', 'create_task'],
    kontext: 'finanzchef', eingebaut: { quelle: 'finanzchef', modi: FINANZCHEF_MODI },
    kennzahlen: [{ index: 'business', id: 'liquiditaet' }, { index: 'business', id: 'runway' }, { index: 'business', id: 'ueberfaellig' }],
    stufe: 'ausgewogen', aufwand: 'medium', hinweis: 'Hinweis, keine Steuer- oder Rechtsberatung.',
    offen: 'Nur der Business-Teil des Finanzbilds (Business-Gesellschaften, `BUSINESS_GESELLSCHAFTEN`); eine Einheit, die zu Privat gehört, nie hier.',
    mitarbeiter: [
      { id: 'finanzen-rechnungen', name: 'Rechnungen & Mahnungen', rolle: 'Behält offene Rechnungen im Blick und entwirft Zahlungserinnerungen — gestellt und verschickt wird von Hand.',
        werkzeuge: ['erfasse_rechnung', 'erfasse_zahlung', 'mandate_lage', 'angebote_lage', 'create_task'], stufe: 'ausgewogen' },
      { id: 'finanzen-liquiditaet', name: 'Liquidität & Planung', rolle: 'Rechnet Kontostände, Planposten und Monatsabschlüsse gegen den Plan und meldet Engpässe früh.',
        werkzeuge: ['business_index', 'setze_kontostand', 'erfasse_planposten', 'erfasse_zahlung', 'monatsabschluss_erfassen'], agentId: 'controlling', stufe: 'ausgewogen' },
    ],
  },
  {
    id: 'it', name: 'Head of IT', kurz: 'IT', bereich: 'business', ebene: 'haushalt', ton: 'sachlich', farbe: 'puls',
    auftrag: 'Hält den Betrieb im Blick — Lagebild aus Server, App, Sicherheit und Außenblick — und erklärt Befunde.',
    kategorien: ['allgemein', 'aufgaben', 'brain'],
    werkzeugGruppen: ['bauplan', 'aufgaben', 'wissen'],
    werkzeuge: ['bauplan_notieren', 'create_task', 'suche_wissen', 'lies_notiz'],
    kontext: 'hoi', kennzahlen: [], stufe: 'schnell', aufwand: 'low',
    offen: 'Das Lagebild bleibt ohne KI (lib/hoi); der Chat ist nur eine Schicht über die Zähler — nie Personen, Adressen oder Inhalte.',
    mitarbeiter: [
      { id: 'it-betrieb', name: 'Betrieb & Sicherheit', rolle: 'Erklärt Befunde des Lagebilds und schlägt nächste Schritte vor.',
        werkzeuge: ['create_task', 'suche_wissen'], stufe: 'schnell' },
      { id: 'it-bauplan', name: 'Bauplan & Wünsche', rolle: 'Nimmt Fehler und Ideen als Karte im Bauplan auf.',
        werkzeuge: ['bauplan_notieren', 'suche_wissen'], stufe: 'schnell', auchFuer: ['produkt'] },
    ],
  },
  {
    id: 'operations', name: 'Head of Operations', kurz: 'Operations', bereich: 'business', ebene: 'haushalt', ton: 'knapp', farbe: 'planung',
    auftrag: 'Hält Projekte, Aufgaben, Business-Postfächer und Termine am Laufen.',
    kategorien: ['postfach', 'aufgaben', 'kalender'],
    werkzeugGruppen: ['inbox', 'aufgaben', 'aufgaben-dateien', 'kalender', 'meilensteine'],
    werkzeuge: ['lies_postfach', 'create_task', 'meine_aufgaben', 'aufgabe_an_zoe', 'suche_arbeit', 'projekt_unterlagen', 'datei_lesen', 'freie_zeit', 'plan_block', 'setze_meilenstein'],
    kontext: 'brain',
    kennzahlen: [{ index: 'business', id: 'fokuszeit' }, { index: 'business', id: 'meetinglast' }, { index: 'business', id: 'delegation' }],
    stufe: 'ausgewogen', aufwand: 'low',
    offen: '`lies_postfach`, `create_task`, `suche_arbeit` kennen heute keinen Bereich — im Head-Lauf nur Business-Postfächer und Business-Spaces (Paket 1).',
    mitarbeiter: [
      { id: 'operations-inbox', name: 'Inbox-Triage', rolle: 'Ordnet die Business-Postfächer: was wartet, was zu tun ist, was weg kann — alles nur Vorschlag.',
        werkzeuge: ['lies_postfach', 'create_task'], agentId: 'inbox', stufe: 'schnell' },
      { id: 'operations-aufgaben', name: 'Aufgaben & Delegation', rolle: 'Sieht offene Aufgaben durch und schlägt Delegation, Termine und nächste Schritte vor.',
        werkzeuge: ['meine_aufgaben', 'suche_arbeit', 'create_task', 'aufgabe_an_zoe', 'setze_meilenstein'], agentId: 'task', stufe: 'schnell' },
      { id: 'operations-meeting', name: 'Meeting-Protokoll', rolle: 'Macht aus Mitschriften ein Protokoll mit Aufgaben.',
        werkzeuge: ['create_task', 'projekt_unterlagen', 'datei_lesen'], agentId: 'meeting', stufe: 'ausgewogen' },
    ],
  },
  {
    id: 'kundenerfolg', name: 'Head of Kundenerfolg', kurz: 'Kundenerfolg', bereich: 'business', ebene: 'haushalt', ton: 'warm', farbe: 'gut',
    auftrag: 'Sorgt dafür, dass laufende Mandate gelingen: Reviews, Fristen, offene Zusagen und Ausbau.',
    kategorien: ['crm', 'aufgaben', 'kalender'],
    werkzeugGruppen: ['markttraktion', 'crm', 'kontakte', 'kunden', 'aufgaben', 'kalender', 'aufgaben-dateien'],
    werkzeuge: ['mandate_lage', 'kontakt_akte', 'firma_akte', 'angebote_lage', 'crm_suche', 'crm_datei_lesen', 'crm_vorschlag', 'entwurf_ansprache', 'setze_kunde', 'create_task', 'freie_zeit', 'projekt_unterlagen'],
    kontext: 'brain', voraussetzung: 'modul:markttraktion',
    kennzahlen: [{ index: 'business', id: 'nrr' }, { index: 'business', id: 'churn' }, { index: 'business', id: 'recurring' }],
    stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'kundenerfolg-betreuung', name: 'Mandatsbetreuung & Reviews', rolle: 'Bereitet Reviews vor und behält Kündigungsfristen und offene Zusagen im Blick.',
        werkzeuge: ['mandate_lage', 'kontakt_akte', 'firma_akte', 'crm_vorschlag', 'create_task', 'freie_zeit'], stufe: 'ausgewogen' },
      { id: 'kundenerfolg-ausbau', name: 'Ausbau & Empfehlungen', rolle: 'Findet Anlässe für Folgeangebote und Empfehlungen — als Vorschlag.',
        werkzeuge: ['mandate_lage', 'angebote_lage', 'firma_akte', 'crm_vorschlag', 'entwurf_ansprache'], stufe: 'ausgewogen', auchFuer: ['sales'] },
    ],
  },
  {
    id: 'strategie', name: 'CEO-Office', kurz: 'Strategie', bereich: 'business', ebene: 'haushalt', ton: 'sachlich', farbe: 'agenten',
    auftrag: 'Hält Ziele, Board-Bericht und OKR zusammen und zeigt, wo der Kurs zum Jahresziel wackelt.',
    kategorien: ['finanzen', 'crm', 'aufgaben', 'brain'],
    werkzeugGruppen: ['business', 'markttraktion', 'meilensteine', 'fokus', 'finanzen', 'wissen', 'aufgaben'],
    werkzeuge: ['business_index', 'gesellschaften_lesen', 'kennzahlen', 'setze_meilenstein', 'setze_fokus', 'setze_ziele', 'suche_wissen', 'lies_notiz', 'suche_arbeit', 'create_task'],
    kontext: 'brain',
    kennzahlen: [{ index: 'business', id: 'run_rate' }, { index: 'business', id: 'meilensteine' }, { index: 'business', id: 'break_even' }],
    stufe: 'ausgewogen', aufwand: 'high',
    mitarbeiter: [
      { id: 'strategie-board', name: 'Board-Bericht', rolle: 'Fasst Zahlen, Pipeline und Aufgaben der Woche zu einem Board-Bericht zusammen.',
        werkzeuge: ['business_index', 'kennzahlen', 'suche_arbeit'], agentId: 'board', stufe: 'stark' },
      { id: 'strategie-ziele', name: 'Ziele & OKR', rolle: 'Prüft den Zielbaum gegen das Jahresziel und schlägt Meilensteine vor.',
        werkzeuge: ['business_index', 'setze_meilenstein', 'setze_fokus', 'suche_arbeit'], agentId: 'okr', stufe: 'stark' },
      { id: 'strategie-gesellschaften', name: 'Gesellschaften & Verträge', rolle: 'Behält Gesellschaften, Verträge und Fristen im Blick.',
        werkzeuge: ['gesellschaften_lesen', 'create_task'], stufe: 'schnell', auchFuer: ['recht'] },
    ],
  },
  {
    id: 'produkt', name: 'Head of Product', kurz: 'Produkt', bereich: 'business', ebene: 'haushalt', ton: 'sachlich', farbe: 'schlaf',
    auftrag: 'Entwickelt die eigene Software als Produkt weiter: Bauplan, Rückmeldungen und Fahrplan.',
    kategorien: ['allgemein', 'brain', 'aufgaben'],
    werkzeugGruppen: ['bauplan', 'wissen', 'aufgaben'],
    werkzeuge: ['bauplan_notieren', 'suche_wissen', 'lies_notiz', 'notiz_anlegen', 'suche_arbeit', 'meine_aufgaben', 'create_task'],
    kontext: 'brain', kennzahlen: [], stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'produkt-fahrplan', name: 'Fahrplan & Spezifikation', rolle: 'Schreibt aus Karten im Bauplan kurze Spezifikationen und ordnet sie in den Fahrplan.',
        werkzeuge: ['bauplan_notieren', 'suche_wissen', 'lies_notiz', 'suche_arbeit'], stufe: 'ausgewogen' },
      { id: 'produkt-rueckmeldungen', name: 'Rückmeldungen & Ideen', rolle: 'Sammelt Rückmeldungen und Ideen und macht daraus Karten im Bauplan.',
        werkzeuge: ['bauplan_notieren', 'suche_wissen'], stufe: 'schnell' },
    ],
  },
  {
    id: 'recht', name: 'Recht & Datenschutz', kurz: 'Recht', bereich: 'business', ebene: 'haushalt', ton: 'sorgfaeltig', farbe: 'puls',
    auftrag: 'Gibt Hinweise zu Datenschutz, Verträgen und Fristen — keine Rechtsberatung.',
    kategorien: ['allgemein', 'finanzen', 'brain', 'aufgaben'],
    werkzeugGruppen: ['business', 'wissen', 'aufgaben'],
    werkzeuge: ['gesellschaften_lesen', 'suche_wissen', 'lies_notiz', 'suche_arbeit', 'create_task'],
    kontext: 'brain', kennzahlen: [], stufe: 'ausgewogen', aufwand: 'high', hinweis: 'Hinweis, keine Rechtsberatung.',
    offen: 'Die Datenschutz-Selbstprüfung (lib/datenschutz) hat kein ZOE-Werkzeug — der Kontext des Heads liest sie (Paket 1).',
    mitarbeiter: [
      { id: 'recht-datenschutz', name: 'Datenschutz-Prüfung', rolle: 'Erklärt offene Punkte der Datenschutz-Selbstprüfung und ihre Fristen — als Hinweis.',
        werkzeuge: ['suche_wissen', 'create_task'], stufe: 'ausgewogen' },
      { id: 'recht-vertraege', name: 'Verträge & Fristen', rolle: 'Behält Vertragsfristen und Kündigungstermine im Blick.',
        werkzeuge: ['gesellschaften_lesen', 'create_task'], stufe: 'schnell' },
    ],
  },
  {
    id: 'research', name: 'Head of Research', kurz: 'Research', bereich: 'business', ebene: 'haushalt', ton: 'sachlich', farbe: 'planung',
    auftrag: 'Recherchiert Markt, Wettbewerb und Themen mit Quellen und legt Ergebnisse im Brain ab.',
    kategorien: ['web', 'brain', 'aufgaben'],
    werkzeugGruppen: ['wissen', 'aufgaben'],
    werkzeuge: ['suche_wissen', 'lies_notiz', 'notiz_anlegen', 'suche_arbeit', 'create_task'],
    kontext: 'brain', kennzahlen: [], stufe: 'ausgewogen', aufwand: 'medium',
    mitarbeiter: [
      { id: 'research-markt', name: 'Markt & Wettbewerb', rolle: 'Recherchiert Markt und Wettbewerb mit Web-Suche und belegt jede Aussage mit Quelle.',
        werkzeuge: ['suche_wissen', 'notiz_anlegen'], agentId: 'research', stufe: 'schnell', auchFuer: ['strategie', 'marketing'] },
      { id: 'research-themen', name: 'Themen & Trends', rolle: 'Beobachtet Themen der Zielgruppe und fasst sie für Marketing und Strategie zusammen.',
        werkzeuge: ['suche_wissen', 'lies_notiz'], agentId: 'research', stufe: 'schnell', auchFuer: ['marketing'] },
    ],
  },

  // ── Privat ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'gesundheit', name: 'Gesundheit & Sport', kurz: 'Gesundheit', bereich: 'privat', ebene: 'person', ton: 'ermutigend', farbe: 'gut',
    auftrag: 'Begleitet Training, Erholung und Routinen mit den eigenen Werten der Person.',
    kategorien: ['gesundheit'],
    werkzeugGruppen: ['gesundheit'],
    werkzeuge: ['gesundheits_index', 'setze_vitalwerte', 'hake_routine', 'journal_eintrag'],
    kontext: 'brain', voraussetzung: 'gesundheit-ki',
    kennzahlen: [{ index: 'gesundheit', id: 'recovery' }, { index: 'gesundheit', id: 'schlaf' }, { index: 'gesundheit', id: 'routinen' }],
    stufe: 'ausgewogen', aufwand: 'medium', hinweis: 'Vorschläge, keine medizinische oder Trainingsberatung.',
    offen: 'Zuständige Person je Instanz über `HeadEinstellung.zustaendig` (C10 Frage 10), nie fest im Code. Nur eigene Werte; Partnersicht nur mit Einwilligung (c).',
    mitarbeiter: [
      { id: 'gesundheit-training', name: 'Training & Sport', rolle: 'Plant Trainingswochen aus Zielen und Erholung — als Vorschlag.',
        werkzeuge: ['gesundheits_index', 'hake_routine'], stufe: 'ausgewogen' },
      { id: 'gesundheit-erholung', name: 'Erholung & Schlaf', rolle: 'Liest Erholung, Schlaf und Routinen und schlägt den Tagesrahmen vor.',
        werkzeuge: ['gesundheits_index', 'setze_vitalwerte', 'journal_eintrag'], stufe: 'schnell' },
    ],
  },
  {
    id: 'ernaehrung', name: 'Ernährung & Einkauf', kurz: 'Ernährung', bereich: 'privat', ebene: 'person', ton: 'warm', farbe: 'achtung',
    auftrag: 'Plant Essen und Einkauf für den Haushalt — personenneutral; Profile fließen nur mit Einwilligung ein.',
    kategorien: ['allgemein', 'aufgaben'], kategorienMitEinwilligung: ['gesundheit'],
    werkzeugGruppen: ['gesundheit', 'aufgaben'],
    werkzeuge: ['einkauf_setzen', 'create_task'],
    kontext: 'brain', kennzahlen: [], stufe: 'schnell', aufwand: 'low',
    mitarbeiter: [
      { id: 'ernaehrung-plan', name: 'Essensplan', rolle: 'Schlägt den Wochenplan mit Rezepten vor — gespeicherte Gerichte zuerst.',
        werkzeuge: ['einkauf_setzen'], agentId: 'ernaehrung', stufe: 'ausgewogen' },
      { id: 'ernaehrung-einkauf', name: 'Einkaufsliste', rolle: 'Führt die Einkaufsliste aus Plan und Vorrat.',
        werkzeuge: ['einkauf_setzen'], stufe: 'schnell' },
    ],
  },
  {
    id: 'familie', name: 'Familie & Partnerschaft', kurz: 'Familie', bereich: 'privat', ebene: 'haushalt', ton: 'warm', farbe: 'beziehung',
    auftrag: 'Hält Dates, wichtige Tage, Urlaube und Gesprächsthemen im Blick — „nur ich“ bleibt „nur ich“.',
    kategorien: ['familie', 'kalender', 'aufgaben'],
    werkzeugGruppen: ['kalender', 'aufgaben'],
    werkzeuge: ['freie_zeit', 'create_task'],
    kontext: 'brain', kennzahlen: [], stufe: 'schnell', aufwand: 'low',
    offen: 'KI-Kategorie `familie` (Anbieter-Tor 09.10.: Mindeststufe EU) — ohne eingerichteten EU-Weg bleibt der Familien-Kontext aus dem Prompt.',
    mitarbeiter: [
      { id: 'familie-anlaesse', name: 'Dates & Anlässe', rolle: 'Erinnert an Dates, Geburtstage und wichtige Tage und schlägt Zeitfenster vor.',
        werkzeuge: ['freie_zeit', 'create_task'], stufe: 'schnell' },
      { id: 'familie-urlaub', name: 'Urlaub & Reisen', rolle: 'Sammelt Ideen und Zeitfenster für Urlaube und Ausflüge.',
        werkzeuge: ['freie_zeit'], stufe: 'schnell' },
      { id: 'familie-gespraeche', name: 'Gesprächsthemen', rolle: 'Bereitet ruhige Gesprächsthemen aus den gemeinsamen Einträgen vor.',
        werkzeuge: [], stufe: 'schnell' },
    ],
  },
  {
    id: 'finanzen-privat', name: 'Finanzen privat', kurz: 'Finanzen privat', bereich: 'privat', ebene: 'person', ton: 'sorgfaeltig', farbe: 'geld',
    auftrag: 'Hält Budget, Fixkosten, offene Rechnungen und private Steuerfristen im Blick — auch eine Einheit, die zu Privat gehört.',
    kategorien: ['finanzen-privat', 'finanzen', 'aufgaben'],  // Werkzeuge wie haushalt_stand tragen heute noch `finanzen` (lib/datenschutz/ki-werkzeuge.ts) — Paket 4 ordnet sie `finanzen-privat` zu.
    werkzeugGruppen: ['haushalt', 'aufgaben'],
    werkzeuge: ['haushalt_stand', 'haushalt_buchungen', 'haushalt_zuordnen', 'haushalt_rechnung_bezahlt', 'haushalt_rechnung_erfassen', 'create_task'],
    kontext: 'finanzchef', eingebaut: { quelle: 'finanzchef', modi: FINANZCHEF_MODI }, voraussetzung: 'privat-finanzen',
    kennzahlen: [{ index: 'privat', id: 'luft' }, { index: 'privat', id: 'budget' }, { index: 'privat', id: 'rechnungen' }],
    stufe: 'ausgewogen', aufwand: 'medium', hinweis: 'Hinweis, keine Steuer- oder Anlageberatung.',
    offen: 'Die Finanzplanung einer Privat-Einheit (`bereichVon`) hat keine eigenen ZOE-Werkzeuge — der Kontext des Heads liest sie (Paket 1).',
    mitarbeiter: [
      { id: 'finanzen-privat-budget', name: 'Budget & Fixkosten', rolle: 'Ordnet Buchungen zu, prüft Budget und Fixkosten und meldet Auffälliges.',
        werkzeuge: ['haushalt_stand', 'haushalt_buchungen', 'haushalt_zuordnen'], stufe: 'schnell' },
      { id: 'finanzen-privat-rechnungen', name: 'Rechnungen & Fristen', rolle: 'Behält private Rechnungen und Steuerfristen im Blick.',
        werkzeuge: ['haushalt_stand', 'haushalt_rechnung_erfassen', 'haushalt_rechnung_bezahlt', 'create_task'], stufe: 'schnell' },
    ],
  },
  {
    id: 'assistenz', name: 'Persönliche Assistenz', kurz: 'Assistenz', bereich: 'privat', ebene: 'person', ton: 'knapp', farbe: 'planung',
    auftrag: 'Kümmert sich um Termine, Erinnerungen und die Wochenplanung der Person.',
    kategorien: ['kalender', 'aufgaben'],
    werkzeugGruppen: ['kalender', 'aufgaben', 'fokus'],
    werkzeuge: ['freie_zeit', 'plan_block', 'create_task', 'meine_aufgaben', 'aufgabe_an_zoe', 'suche_arbeit', 'setze_fokus'],
    kontext: 'brain', kennzahlen: [], stufe: 'schnell', aufwand: 'low',
    mitarbeiter: [
      { id: 'assistenz-termine', name: 'Termine', rolle: 'Findet freie Zeiten und schlägt Termine und Blöcke vor — eingetragen wird per Klick.',
        werkzeuge: ['freie_zeit', 'plan_block'], agentId: 'kalender', stufe: 'schnell', auchFuer: ['familie'] },
      { id: 'assistenz-erinnerungen', name: 'Erinnerungen & Aufgaben', rolle: 'Hält Erinnerungen und eigene Aufgaben nach.',
        werkzeuge: ['meine_aufgaben', 'create_task', 'aufgabe_an_zoe'], stufe: 'schnell' },
      { id: 'assistenz-woche', name: 'Wochenplanung', rolle: 'Baut aus Kalender, Aufgaben und Routinen einen Vorschlag für die Woche.',
        werkzeuge: ['freie_zeit', 'plan_block', 'meine_aufgaben', 'suche_arbeit'], agentId: 'planung', stufe: 'ausgewogen' },
    ],
  },
];

export const HEAD_IDS: readonly string[] = KATALOG.map(h => h.id);

/** Der Head zu einer Kennung — oder null. */
export const headDef = (id: string): HeadDef | null => KATALOG.find(h => h.id === id) ?? null;

/** Heads eines Bereichs (Reihenfolge wie im Katalog). Wer sie SEHEN darf, entscheidet allein der Server (Paket 1, lib/agenten/sicht.ts). */
export const headsIm = (b: Bereich): readonly HeadDef[] => KATALOG.filter(h => h.bereich === b);

/** Eine Mitarbeiter-Vorlage samt Heimat-Head — oder null. */
export function vorlageVon(id: string): { head: HeadDef; vorlage: MitarbeiterVorlage } | null {
  for (const head of KATALOG) {
    const vorlage = head.mitarbeiter.find(m => m.id === id);
    if (vorlage) return { head, vorlage };
  }
  return null;
}

/** Vorlagen, die einem Head helfen: die eigenen und die mit `auchFuer` (Aushilfe). */
export function vorlagenFuer(headId: string): { vorlage: MitarbeiterVorlage; heimat: string; aushilfe: boolean }[] {
  const eigen = (headDef(headId)?.mitarbeiter ?? []).map(vorlage => ({ vorlage, heimat: headId, aushilfe: false }));
  const fremd = KATALOG.filter(h => h.id !== headId)
    .flatMap(h => h.mitarbeiter.filter(m => m.auchFuer?.includes(headId)).map(vorlage => ({ vorlage, heimat: h.id, aushilfe: true })));
  return [...eigen, ...fremd];
}
