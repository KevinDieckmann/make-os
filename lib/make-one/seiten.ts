// ─── MAKE OS — Alle Seiten für die Schnellsuche (⌘K) ────────────────────────
// Aufräumen Etappe 1 (08.10.): die Leiste zeigt nur noch zehn Punkte je Space — die Schnellsuche findet weiterhin JEDE Seite,
// auch die, die nicht mehr im Menü stehen (Wächter tests/aufraeumen-etappe1.test.ts: jede Seite unter app/os steht hier).
// Namen wie in Leiste und Einstellungen: „Finanzen“ (nicht mehr „Zahlen“), „Brain“ (Adresse /os/wissen), „Heute“ (/os).
// Rein (kein React), damit Schnellsuche und Wächter dieselbe Liste lesen. `space` = zuerst im passenden Space vorgeschlagen.

import { WEG } from '@/lib/wege';

export interface SeitenTreffer { art: 'seite'; id: string; titel: string; href: string; space?: 'privat' | 'business' }

const s = (id: string, titel: string, href: string, space?: 'privat' | 'business'): SeitenTreffer => ({ art: 'seite', id, titel, href, ...(space ? { space } : {}) });

export const SEITEN_SUCHE: SeitenTreffer[] = [
  // Start und Tag
  s('heute', 'Heute · Privat und Business', WEG.heute()),
  s('heute-privat', 'Heute · Privat', WEG.heute('privat'), 'privat'),
  s('heute-business', 'Heute · Business', WEG.heute('business'), 'business'),
  s('wachstum', 'Wachstum · Score und Säulen', WEG.wachstum()),
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
  s('fokus', 'Planung · Fokus', '/os/fokus'),
  s('kompass', 'Planung · Kompass', '/os/kompass'),
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
  s('sport', 'Gesundheit · Sport — Hyrox, Running, Gym, Erholung', WEG.sport(), 'privat'),
  s('journal', 'Gesundheit · Journal', WEG.journal(), 'privat'),
  s('familie', 'Familie & Partnerschaft', WEG.familie(), 'privat'),
  s('menschen', 'Kontakte · Privat (unsere Menschen)', WEG.menschen(), 'privat'),
  // Business
  s('markttraktion', 'Markttraktion · Überblick', WEG.markttraktion(), 'business'),
  s('kontakte', 'Kontakte · Business (Markttraktion)', WEG.kontakt(), 'business'),
  s('firmen', 'Markttraktion · Firmen', WEG.firma(), 'business'),
  s('leads', 'Markttraktion · Leads qualifizieren', WEG.leads(), 'business'),
  s('pipeline', 'Markttraktion · Deals', WEG.deals(), 'business'),
  s('deals-auswertung', 'Markttraktion · Deals, Auswertung', '/os/markttraktion?s=deals&a=auswertung', 'business'),
  s('followup', 'Markttraktion · Follow-up', WEG.followup(), 'business'),
  s('powerhour', 'Markttraktion · Power Hour', WEG.powerHour(), 'business'),
  s('qualifizierung', 'Markttraktion · Qualifizierung & Scoring', WEG.qualifizierung(), 'business'),
  s('angebot', 'Markttraktion · Angebot', WEG.angebot(), 'business'),
  s('marketing', 'Markttraktion · Marketing', WEG.marketing(), 'business'),
  s('kampagnen', 'Markttraktion · Kampagnen', '/os/markttraktion?s=marketing&a=kampagnen', 'business'),
  s('events', 'Markttraktion · Events (besuchte Veranstaltungen)', WEG.besuch(), 'business'),
  s('makeone', 'Markttraktion · Make.One (eigene Abende)', WEG.event(), 'business'),
  s('mt-stammdaten', 'Markttraktion · Stammdaten', WEG.stammdaten(), 'business'),
  s('mandate', 'Mandate & Unternehmen · Mandate', WEG.mandat(), 'business'),
  s('produkte', 'Mandate & Unternehmen · Produkte (Leistungskatalog)', WEG.produkt(), 'business'),
  s('unternehmen', 'Mandate & Unternehmen · Gesellschaften, Anteile, Verträge', WEG.unternehmen(), 'business'),
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
  s('research', 'ZOE › Agenten · Research', '/os/research', 'business'),
  s('content', 'ZOE › Agenten · Content', '/os/content', 'business'),
  s('meeting', 'ZOE › Agenten · Meeting → Aufgaben', '/os/meeting', 'business'),
  s('board', 'ZOE › Agenten · Reporting & Board', '/os/board', 'business'),
  s('prospecting', 'ZOE › Agenten · Prospecting', '/os/prospecting', 'business'),
  // Einstellungen
  s('einstellungen', 'Einstellungen', '/os/system'),
  s('konto', 'Einstellungen · Konto', WEG.konto()),
  s('verbindungen', 'Einstellungen · Verbindungen (WhatsApp, ZOE auf WhatsApp, Telegram …)', WEG.verbindungen()),
  s('datenschutz', 'Einstellungen · Datenschutz', WEG.datenschutz()),
  s('stammdaten', 'Einstellungen · Stammdaten', '/os/stammdaten'),
  s('datenbasis', 'Einstellungen · Datenbasis', '/os/datenbasis'),
  s('hoi', 'Einstellungen · Head of IT', '/os/hoi'),
  s('bauplan', 'Einstellungen · Bauplan', '/os/bauplan'),
  s('roadmap', 'Bauplan · Phasen (Roadmap)', '/os/bauplan?s=phasen'),
  s('onboarding', 'Einstellungen · Onboarding (Einrichtung)', '/os/onboarding'),
  s('onboarding-ich', 'Einstellungen · Onboarding, Meine Einrichtung', '/os/onboarding/ich'),
  s('onboarding-gemeinsam', 'Einstellungen · Onboarding, Gemeinsam', '/os/onboarding/gemeinsam'),
  s('onboarding-instanz', 'Einstellungen · Onboarding, Instanz (Inhaber)', '/os/onboarding/instanz'),
  s('zusammenarbeit', 'Einstellungen · Zusammenarbeit', '/os/onboarding/zusammenarbeit'),
];
