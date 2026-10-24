// ─── MAKE OS — Alle Seiten für die Schnellsuche (⌘K) ────────────────────────
// Aufräumen Etappe 1 (08.10.): die Leiste zeigt nur noch höchstens zwölf Punkte je Space — die Schnellsuche findet weiterhin JEDE Seite,
// auch die, die nicht mehr im Menü stehen (Wächter tests/aufraeumen-etappe1.test.ts: jede Seite unter app/os steht hier).
// Namen wie in Leiste und Einstellungen: „Finanzen“ (nicht mehr „Zahlen“), „Brain“ (Adresse /os/wissen), „Heute“ (/os).
// Rein (kein React), damit Schnellsuche und Wächter dieselbe Liste lesen. `space` = zuerst im passenden Space vorgeschlagen.

import { WEG } from '@/lib/wege';
import { MARKE_EVENTS } from '@/lib/crm/marke';
import { automationenLink, mandateLink } from '@/lib/crm/adresse';

export interface SeitenTreffer {
  art: 'seite'; id: string; titel: string; href: string; space?: 'privat' | 'business';
  /**
   * Wer die Seite überhaupt öffnen darf (15.10., Abnahme 2 B8 — die Routen lehnen die anderen ohnehin ab): `volle` = volle Mitglieder (Head of IT;
   * Unternehmen — die Firmen-Akte sagt einem Konto „nur Business“ „nicht freigegeben“).
   */
  nur?: 'volle';
}

const s = (id: string, titel: string, href: string, space?: 'privat' | 'business', nur?: SeitenTreffer['nur']): SeitenTreffer => ({ art: 'seite', id, titel, href, ...(space ? { space } : {}), ...(nur ? { nur } : {}) });

export const SEITEN_SUCHE: SeitenTreffer[] = [
  // Start und Tag
  s('heute', 'Heute · Privat und Business', WEG.heute()),
  s('heute-privat', 'Heute · Privat', WEG.heute('privat'), 'privat'),
  s('heute-business', 'Heute · Business', WEG.heute('business'), 'business'),
  // Die zwei Scores (21.10.): Privat-Score (nur die eigene Person) und Business-Score (= Business-Index) — alle Säulen, Kennzahlen, größter Hebel.
  s('score-privat', 'Privat-Score · alles Private in einer Zahl', WEG.score('privat'), 'privat', 'volle'),
  s('score-business', 'Business-Score · Business-Index mit allen Säulen', WEG.score('business'), 'business'),
  // Fokus (10.10.): EINE Steuerungsseite oben rechts — Fokus, Prioritäten (früher Kompass), Zeit, Wirkung (früher Wachstum).
  s('fokus', 'Fokus · Fokus, Prioritäten, Zeit und Wirkung', WEG.fokus()),
  s('fokus-prioritaeten', 'Fokus · Prioritäten und Kompass', WEG.fokus('prioritaeten')),
  s('fokus-zeit', 'Fokus · Zeit je Thema (Soll und Ist)', WEG.fokus('zeit')),
  s('fokus-wirkung', 'Fokus · Wirkung (Score des Bereichs)', WEG.fokus('wirkung')),
  s('ritual', 'Tagesstart & Tagesende', '/os/ritual'),
  s('tageslauf', 'Tageslauf', '/os/tageslauf', 'privat'),
  s('inbox', 'Inbox', WEG.inbox()),
  s('kalender', 'Kalender', '/os/kalender'),
  s('wochenplan', 'Kalender · Woche planen', WEG.woche()),
  // Aufgaben
  s('aufgaben', 'Aufgaben', '/os/aufgaben'),
  s('aufgaben-zeitstrahl', 'Aufgaben · Zeitstrahl', '/os/aufgaben?ansicht=zeitstrahl'),
  // Planung
  s('planung-tag', 'Planung · Tag', '/os/planung'),
  s('ziele', 'Planung · Jahr, Ziele, Meilensteine', WEG.jahr()),
  s('planung-monat', 'Planung · Monat', '/os/planung/monat'),
  s('planung-quartal', 'Planung · Quartal', '/os/planung/quartal'),
  s('routinen', 'Planung · Routinen', WEG.routinen()),
  s('kapazitaet', 'Planung · Kapazität, Zeit und Machbarkeit je Person', WEG.kapazitaet(), 'business'),
  // Werkzeug Planung (22.10. abends): „Automationen & Head“ — ein Parameter an der Seite des Jahres (Business: Ziele & Meilensteine, Privat: Assistenz).
  s('planung-automationen', 'Planung · Automationen & Head (Ziele & Meilensteine, CEO-Office, Assistenz)', `${WEG.jahr()}?s=automationen`),
  // Finanzen (08.10., Aufräumen Etappe 2: höchstens zwei Ebenen — Aufbau in lib/finanzen/navigation.ts)
  s('finanzen', 'Finanzen · Privat', WEG.privat(), 'privat'),
  s('finanzen-konten', 'Finanzen · Privat · Konten & Buchungen', WEG.privat('buchungen'), 'privat'),
  s('finanzen-business', 'Finanzen · Business', WEG.zahlen('business'), 'business'),
  s('finanzen-steuern', 'Finanzen · Steuern', WEG.steuern()),
  s('finanzen-gesamt', 'Finanzen · Gesamt (Privat → Business)', WEG.gesamt(), 'privat'),
  s('finanzen-chef', 'Finanzen · Head of Finance', WEG.chef()),
  s('finanzplanung-business', 'Finanzen · Planung Business (Gesellschaften)', WEG.finanzplanung('business'), 'business'),
  s('finanzplanung-privat', 'Finanzen · Planung Privat (alles)', WEG.finanzplanung('privat'), 'privat'),
  s('rechnungen', 'Finanzen · Rechnungen & Zahlungen', WEG.rechnungen(), 'business'),
  s('liquiditaet', 'Finanzen · Liquidität', WEG.liquiditaet(), 'business'),
  // Konten-Register (08.10.): keine eigene Seite — die Karte „Konten“ steht unter Privat › Konten & Buchungen bzw. Business › Liquidität.
  s('konten-privat', 'Finanzen · Konten & Kontostände (Privat, gemeinsam, Selbstständigkeit)', WEG.kontenRegister('privat'), 'privat'),
  s('konten-business', 'Finanzen · Konten & Kontostände der Gesellschaften', WEG.kontenRegister('business'), 'business'),
  s('buchungen', 'Finanzen · Buchungen der Gesellschaften', WEG.buchungen(), 'business'),
  s('controlling', 'Finanzen · Controlling & Ziele', WEG.controlling(), 'business'),
  s('grundlage', 'Finanzen · Altbestand · Grundlage (Kassenbuch)', WEG.grundlage(), 'privat'),
  // Privat
  s('gesundheit', 'Gesundheit', '/os/gesundheit', 'privat'),
  s('ernaehrung', 'Gesundheit · Ernährung & Einkauf', WEG.ernaehrung(), 'privat'),
  s('erholung', 'Gesundheit · Erholung — Reha, Programme, Behandlungen, Regeneration', WEG.erholung(), 'privat'),
  s('sport', 'Gesundheit · Sport — Training, Hyrox, Running, Gym, Erholung', WEG.sport(), 'privat'),
  s('journal', 'Gesundheit · Journal', WEG.journal(), 'privat'),
  s('familie', 'Familie & Partnerschaft', WEG.familie(), 'privat'),
  s('menschen', 'Familie · Kontakte privat (unsere Menschen)', WEG.menschen(), 'privat'),
  // Business
  s('markttraktion', 'Markttraktion · Überblick', WEG.markttraktion(), 'business'),
  s('kontakte', 'Kontakte · Business (Markttraktion)', WEG.kontakt(), 'business'),
  s('firmen', 'Markttraktion · Firmen', WEG.firma(), 'business'),
  s('leads', 'Markttraktion · Leads & Qualifizierung · Leads', WEG.leads(), 'business'),
  s('pipeline', 'Markttraktion · Deals', WEG.deals(), 'business'),
  // Auswertung (22.10., eigener Hub-Punkt; vorher Deals › Auswertung — die alte Adresse zeigt dieselbe Ansicht, die Kennung bleibt).
  s('deals-auswertung', 'Markttraktion · Auswertung — Weg zum Kunden, Traktions-Index, Scoreboard, Kanäle, Pipeline', WEG.auswertung(), 'business'),
  s('followup', 'Markttraktion · Follow-up & Power Hour', WEG.followup(), 'business'),
  s('powerhour', 'Markttraktion · Power Hour', WEG.powerHour(), 'business'),
  s('qualifizierung', 'Markttraktion · Leads & Qualifizierung (Runde, Scoring)', WEG.qualifizierung(), 'business'),
  s('angebot', 'Markttraktion · Angebote', WEG.angebot(), 'business'),
  s('mt-planung', 'Markttraktion · Planung — Kreislauf, Umsatzziele, Leadkanäle, Challenges', WEG.vertriebsplanung(), 'business'),
  s('mt-automationen', 'Markttraktion · Automationen & Head', automationenLink(), 'business'),
  s('marketing', 'Markttraktion · Marketing', WEG.marketing(), 'business'),
  s('kampagnen', 'Markttraktion · Kampagnen', '/os/markttraktion?s=marketing&a=kampagnen', 'business'),
  s('events', 'Markttraktion · Events (besuchte Veranstaltungen)', WEG.besuch(), 'business'),
  s('makeone', `Markttraktion · ${MARKE_EVENTS} (eigene Abende)`, WEG.event(), 'business'),
  s('mt-stammdaten', 'Markttraktion · Stammdaten', WEG.stammdaten(), 'business'),
  s('mandate', 'Produkte & Mandate · Mandate', WEG.mandat(), 'business'),
  s('produkte', 'Produkte & Mandate · Produkte (Leistungskatalog)', WEG.produkt(), 'business'),
  // Fulfillment (10.10.): eigene Seite unter Produkte & Mandate — die Unterpunkte einzeln auffindbar (seit 17.10. fünf: Visualisierung steckt in der Landkarte).
  s('fulfillment', 'Produkte & Mandate · Fulfillment (heute zu tun, Kunden in Lieferung, Abläufe)', WEG.fulfillment(), 'business'),
  s('fulfillment-bausteine', 'Produkte & Mandate · Fulfillment · Bausteine', WEG.fulfillment('bausteine'), 'business'),
  s('fulfillment-onboarding', 'Produkte & Mandate · Fulfillment · Onboarding', WEG.fulfillment('onboarding'), 'business'),
  s('fulfillment-analysen', 'Produkte & Mandate · Fulfillment · Analysen', WEG.fulfillment('analysen'), 'business'),
  s('fulfillment-kreislauf', 'Produkte & Mandate · Fulfillment · Kreislauf', WEG.fulfillment('kreislauf'), 'business'),
  s('mandate-automationen', 'Produkte & Mandate · Automationen & Head (Übergabe, Fulfillment, Ausbau)', mandateLink('automationen'), 'business'),
  // Prozesse (21.10.): die Landkarte als Fliege — Marketing, Sales, Übergabe, Fulfillment, Ausbau; Liste und Vollbild über die Adresse.
  s('prozesse', 'Prozesse · Landkarte der Abläufe (Marketing, Sales, Übergabe, Fulfillment, Ausbau)', WEG.prozesse(), 'business'),
  s('prozesse-liste', 'Prozesse · als Liste', WEG.prozesse({ ansicht: 'liste' }), 'business'),
  s('unternehmen', 'Unternehmen · Überblick (Schild in einem Blick, Compliance-Ampel)', WEG.unternehmen(), 'business', 'volle'),
  s('unternehmen-ereignis', 'Unternehmen · Was ist passiert? (Ereignis-Assistent: Geschäftsführung, Gesellschafterwechsel, Sitz …)', WEG.ereignisAssistent(), 'business', 'volle'),
  // Unternehmen › Schild (10.10.): die Reiter einzeln auffindbar.
  s('unternehmen-gesellschaften', 'Unternehmen · Gesellschaften, Anteile, Verträge', WEG.schild('gesellschaften'), 'business', 'volle'),
  s('unternehmen-pflichten', 'Unternehmen · Pflichten-Kalender (Jahresabschluss, Register, Fristen)', WEG.schild('pflichten'), 'business', 'volle'),
  s('unternehmen-dokumente', 'Unternehmen · Pflichtdokumente und Vorlagen', WEG.schild('dokumente'), 'business', 'volle'),
  s('unternehmen-risiken', 'Unternehmen · Risiko-Register', WEG.schild('risiken'), 'business', 'volle'),
  s('unternehmen-struktur', 'Unternehmen · Struktur und Cap-Table', WEG.schild('struktur'), 'business', 'volle'),
  s('unternehmen-vertraege', 'Unternehmen · Verträge und Organe', WEG.schild('vertraege'), 'business', 'volle'),
  s('unternehmen-schutz', 'Unternehmen · Marken & Versicherungen (Marken, Domains, Versicherungen)', WEG.schild('schutz'), 'business', 'volle'),
  s('unternehmen-beschluesse', 'Unternehmen · Beschlüsse & Satzung (Beschluss-Buch, Gegenstand, Fassungen)', WEG.beschluss(), 'business', 'volle'),
  s('unternehmen-automationen', 'Unternehmen · Automationen & Head (Betroffenenrechte, Head of Recht)', WEG.schild('automationen'), 'business', 'volle'),
  // Netzwerken (03.10.): unterwegs erfassen und die eigenen Visitenkarten (QR) — in jedem Space auffindbar.
  s('netzwerken', 'Netzwerken · Person erfassen, Abendbericht', WEG.netzwerken()),
  s('netzwerken-karte', 'Netzwerken · Meine Visitenkarten', WEG.netzwerkenKarte()),
  s('medien', 'Fotos & Videos · aufnehmen, ordnen, freigeben', WEG.medien()),
  // ZOE
  s('zoe', 'ZOE · Empfang', '/zoe'),
  s('stapel', 'ZOE · Freigaben (Aufträge & Freigaben)', WEG.freigaben()),
  s('stapel-protokoll', 'ZOE · Freigaben › Protokoll, Rückgängig und Gedächtnis', WEG.freigaben('protokoll')),
  s('agenten', 'ZOE · Agenten', WEG.agenten()),
  s('loop', 'ZOE · Loops', '/os/loop'),
  s('wissen', 'Brain · Notizen und Wissen', WEG.wissen()),
  s('research', 'ZOE › Agenten · Research', '/os/research'),
  s('content', 'ZOE › Agenten · Content', '/os/content'),
  s('meeting', 'ZOE › Agenten · Meeting → Aufgaben', '/os/meeting'),
  s('board', 'ZOE › Agenten · Reporting & Board', '/os/board'),
  s('prospecting', 'ZOE › Agenten · Prospecting', '/os/prospecting'),
  // Einstellungen
  s('einstellungen', 'Einstellungen', '/os/system'),
  s('konto', 'Einstellungen · Konto', WEG.konto()),
  s('bedienung', 'Einstellungen · Bedienung (Wischen, Menü ⋯, Löschen, Dichte)', WEG.bedienung()),
  s('verbindungen', 'Einstellungen · Verbindungen (WhatsApp, ZOE auf WhatsApp, Telegram …)', WEG.verbindungen()),
  s('datenschutz', 'Einstellungen · Datenschutz', WEG.datenschutz()),
  s('stammdaten', 'Einstellungen · Stammdaten', '/os/stammdaten'),
  s('datenbasis', 'Einstellungen · Datenbasis', '/os/datenbasis'),
  s('hoi', 'Einstellungen · Head of IT', '/os/hoi', undefined, 'volle'),
  s('neuigkeiten', 'Einstellungen · Was ist neu (Updates)', '/os/neuigkeiten'),
  s('bauplan', 'Einstellungen · Bauplan', '/os/bauplan'),
  s('roadmap', 'Bauplan · Phasen (Roadmap)', '/os/bauplan?s=phasen'),
  s('onboarding', 'Einstellungen · Onboarding (Einrichtung)', '/os/onboarding'),
  s('onboarding-ich', 'Einstellungen · Onboarding, Meine Einrichtung', '/os/onboarding/ich'),
  s('onboarding-gemeinsam', 'Einstellungen · Onboarding, Gemeinsam', '/os/onboarding/gemeinsam'),
  s('onboarding-instanz', 'Einstellungen · Onboarding, Instanz (Inhaber)', '/os/onboarding/instanz'),
  s('zusammenarbeit', 'Einstellungen · Zusammenarbeit', '/os/onboarding/zusammenarbeit'),
];

/**
 * Die Seiten für ein Konto (rein): für ein Konto „nur Business“ keine Seiten nur für volle Mitglieder (Head of IT, Unternehmen). `null` = noch
 * unbekannt → wie „nur Business“.
 */
export function seitenFuer<T extends Pick<SeitenTreffer, 'nur'>>(liste: readonly T[], k: { nurBusiness: boolean | null }): T[] {
  return liste.filter(x => x.nur !== 'volle' || k.nurBusiness === false);
}
