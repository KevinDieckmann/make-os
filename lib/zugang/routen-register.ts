// ─── MAKE OS — Routen-Register (05.10., Paket „Routen-Register + Zugangs-Wächter“) ─────────────────────
// JEDE Schnittstelle `app/api/**/route.ts` steht hier — mit ihren Methoden, der Zugangsklasse je Methode und einem
// Satz, warum. Der Wächter tests/routen-register.test.ts findet alle route.ts und prüft:
//   (a) jede Route und jede exportierte Methode steht im Register (und nichts steht hier, was es nicht mehr gibt),
//   (b) der Rumpf der Methode ruft die zur Klasse passende Tor-Funktion (`TORE`, statisch über lib/zugang/routen-analyse.ts;
//       eine eigene Prüfung nur ausdrücklich über `tor`), dazu Laufzeit-Stichproben je Klasse,
//   (c) eine neue Route ohne Eintrag lässt den Wächter rot werden.
// Kevin (04.10.): „alle Standards der DSGVO, damit wir Kundendaten aufnehmen können“ — Trennung serverseitig, nie nur
// versteckt (Plattform-Regel in CLAUDE.md). Neue Route → Eintrag hier + Tor-Zeile am Anfang (Vorlagen: lib/zugang/tor.ts).
//
// Klassen:
//   offen            öffentlich bzw. ohne eigene Prüfung, weil die Route nichts liest/schreibt oder sich selbst schützt
//                    (Anmeldung, Buchung, Webhooks mit eigener Signatur, 308-Weiterleitung, fester Leerstand, 405)
//   dienst           nur der interne Dienstweg (Arbeiter, Bote, Takt, Zulieferer, HOI-Schlüssel)
//   person           nur die eigenen Daten der angemeldeten (ausdrücklich benannten) Person — kein Rückfall auf „kevin“
//   haushalt         Haushalt des Inhabers (Kalender, Kartei, Aufgaben, Planung, Brain …); Dienstweg nur mit Person
//                    aus dem Haushalt bzw. als Systemlauf, wo die Route das trägt
//   inhaber          nur der Inhaber (oder der Systemlauf ohne Person, wo `nurInhaber` das zulässt)
//   finanz-privat    private Haushaltsfinanzen: Haushaltsmitglied OHNE `finanzRecht: 'business'`
//   finanz-business  Finanzplanung mit serverseitiger Sicht (privat/business aus dem Konto, `planZugangFuer`)
//   modul:<name>     gehört zu einem einzeln verkaufbaren Modul (z. B. markttraktion). Bis es Modul-Lizenzen gibt, gilt
//                    das Tor der Klasse `haushalt`; später kommt hier die Lizenz-Prüfung je Instanz dazu.

import type { Methode } from './routen-analyse';

export type BasisKlasse = 'offen' | 'dienst' | 'person' | 'haushalt' | 'inhaber' | 'finanz-privat' | 'finanz-business';
export type RoutenKlasse = BasisKlasse | `modul:${string}`;

export interface RoutenEintrag {
  /** Jede exportierte Methode mit ihrer Klasse. */
  methoden: Partial<Record<Methode, RoutenKlasse>>;
  /** Ein Satz: was die Route hütet und warum diese Klasse. */
  warum: string;
  /**
   * Eine eigene Prüfung statt (zusätzlich zu) den Standard-Toren — Name der Funktion, die der Rumpf aufruft. Nur mit
   * Begründung im `warum` (z. B. Bestand je Haushalt über `haushaltVon`, Konto-Wege über `personDerSitzung`).
   */
  tor?: string;
  /**
   * Schreibt der lesende GET (Cache, idempotenter Tagespunkt, Erststart)? Dann hier begründen — der Wächter verlangt
   * es für jeden GET, der selbst `updateJson`/`saveJson`/… ruft (Regel: Lesen schreibt nicht, sonst begründet).
   */
  getSchreibt?: string;
}

/** Welche Tor-Funktionen eine Klasse erfüllen (mindestens eine muss im Rumpf der Methode aufgerufen werden). */
export const TORE: Record<Exclude<BasisKlasse, 'offen'>, readonly string[]> = {
  dienst: ['istDienst', 'istZulieferer'],
  person: ['personStreng', 'personDerSitzung', 'eigenePerson', 'darfGesundheitSehen'],
  haushalt: ['imHaushaltDesInhabers', 'imHaushaltOderSystemlauf', 'karteiZugang', 'kalenderZugang', 'kalenderLesen', 'personImHaushaltDesInhabers'],
  inhaber: ['nurInhaber', 'istInhaber'],
  'finanz-privat': ['haushaltVon', 'haushaltFuer', 'privatFinanzZugang'],
  'finanz-business': ['planZugangVon', 'planZugangFuer'],
};

/** Die Basis einer Klasse — Module laufen bis zur Lizenz-Prüfung über das Haushalts-Tor. */
export function basisVon(k: RoutenKlasse): BasisKlasse {
  return k.startsWith('modul:') ? 'haushalt' : k as BasisKlasse;
}

const ALLE: Methode[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
/** Eintrag mit EINER Klasse für die genannten Methoden („GET,POST“). */
function r(methoden: string, klasse: RoutenKlasse, warum: string, tor?: string, getSchreibt?: string): RoutenEintrag {
  const m: Partial<Record<Methode, RoutenKlasse>> = {};
  for (const x of methoden.split(',').map(s => s.trim())) {
    if (!ALLE.includes(x as Methode)) throw new Error(`Routen-Register: unbekannte Methode ${x}`);
    m[x as Methode] = klasse;
  }
  return { methoden: m, warum, ...(tor ? { tor } : {}), ...(getSchreibt ? { getSchreibt } : {}) };
}
/** Eintrag mit Klassen je Methode. */
function rm(methoden: Partial<Record<Methode, RoutenKlasse>>, warum: string, tor?: string, getSchreibt?: string): RoutenEintrag {
  return { methoden, warum, ...(tor ? { tor } : {}), ...(getSchreibt ? { getSchreibt } : {}) };
}

const MT = 'modul:markttraktion' as const;

/** Schlüssel = Pfad unter app/api ohne `/route.ts` (z. B. `state/kompass`, `buchung/[slug]`). */
export const ROUTEN_REGISTER: Record<string, RoutenEintrag> = {
  // ── Kalender, Mail, Mac-Zulieferer ──────────────────────────────────────────────────────────────────────────
  'apple-calendar': r('GET', 'haushalt', 'Kalender des Inhabers: Personen bekommen ihn maskiert, roh nur der Systemlauf (Mac-Zulieferer) — kalenderLesen.', undefined, 'Zwischenspeicher: `?refresh=1` legt den frisch gelesenen Kalender als Cache ab.'),
  'apple-contacts': r('GET', 'inhaber', 'Adressbuch des Inhabers (Mac).'),
  'apple-reminders': r('GET', 'haushalt', 'Erinnerungen des Inhaber-Kalenders; Systemlauf (Zulieferer) erlaubt.'),
  'kalender': r('GET,POST', 'haushalt', 'Kalender des Haushalts; Apple-Erinnerungen nur für den Inhaber, private Fristen nur mit Haushalt (S1).'),
  'kalender/analyse': r('POST', 'haushalt', 'Kalender-Agent über den Kalender des Haushalts.'),
  'kalender/auswertung': r('GET', 'haushalt', 'Auswertung des Haushalts-Kalenders.'),
  'kalender/bezug': r('GET', 'haushalt', 'Termin-Bezüge (CRM/Aufgaben) des Haushalts-Kalenders.'),
  'kalender/buchung': r('GET,POST', 'haushalt', 'Buchungsseiten verwalten — Haushalt; Seiten/Freigaben nur von Hand (Dienstweg 403, S1).'),
  'kalender/frei': r('GET', 'haushalt', 'Freie Zeiten einer Person im Haushalt.'),
  'kalender/gaeste': r('GET', 'haushalt', 'Gäste-Vorschläge aus dem Haushalts-Kalender.'),
  'kalender/google': r('GET,POST', 'person', 'Eigene Google-Verbindung (Kalender) — nur die Person selbst im Haushalt (eigenePerson).'),
  'abmelden/[token]': r('GET,POST', 'offen', 'Newsletter-Abmeldung ohne Login: signiertes Token (Fingerabdruck, keine Adresse/Kennung), wirkt nur als Werbesperre, Antwort verrät nie, ob die Adresse existiert.'),
  'kalender/icloud': r('GET,POST', 'person', 'Eigene iCloud-Verbindung (Apple-ID + App-Passwort, Kalender zeigen/ausblenden, trennen) — nur die Person selbst im Haushalt (eigenePerson); nie Zugangsdaten in der Antwort.'),
  'kalender/google/meldung': r('POST', 'offen', 'Google-Push (events.watch): ohne Sitzung, prüft Kanal-Kennung + Token + Ressourcen-ID selbst, liefert nie Daten.'),
  'kalender/google/umzug': r('GET,POST', 'person', 'Umzug der eigenen Google-Termine — nur die Person selbst (eigenePerson).'),
  'kalender/jahr': r('GET', 'haushalt', 'Jahresansicht des Haushalts-Kalenders.'),
  'kalender/quellen': r('GET', 'haushalt', 'Kalenderquellen des Haushalts.'),
  'kalender/sicherung': r('GET,POST', 'haushalt', 'Sicherung/Wiederherstellung des Haushalts-Kalenders (Grabsteine, S1).'),
  'kalender/spiegel': r('GET,POST', 'haushalt', 'Spiegel-Termine des Haushalts; Löschen nur von Hand (S1).'),
  'kalender/termin': r('POST,PATCH,DELETE', 'haushalt', 'Termine im Haushalts-Kalender schreiben (der einzige Schreibweg).'),
  'kemaris-calendar': r('GET', 'offen', 'Liefert seit K5 nur einen festen Leerstand („nicht angebunden“), liest und schreibt nichts.'),
  'planung/bloecke': r('GET', 'haushalt', 'Planungsblöcke = Termine im Haushalts-Kalender.'),
  'planung/uebernahme': r('GET,POST', 'haushalt', 'Übernahme des alten Wochenplans in den Kalender; Ausführen nur von Hand (S1).'),
  'state/kalender-einstellungen': r('GET,PUT', 'haushalt', 'Kalender-Zuordnung des Haushalts.'),
  'zulieferung': rm({ POST: 'dienst', GET: 'haushalt' }, 'POST: nur der Mac-Zulieferer (eigener Schlüssel) bzw. Dienstweg; GET: Stand der Zulieferungen für den Haushalt.'),
  'gmail': r('GET,POST', 'person', 'Eigenes Gmail — nur die Person selbst (eigenePerson).'),
  // Inbox 2 (06.10.): EIN Strom aller eigenen Postfächer (Gmail + IMAP; WhatsApp vorbereitet) — nur die Person selbst, nie der Dienstweg.
  'inbox': r('GET,POST', 'person', 'Strom der EIGENEN Postfächer, serverseitig nach Bereich gefiltert; Aktionen gehen an die eigenen Postfächer zurück (eigenePerson).'),
  'inbox/gespraech': r('GET', 'person', 'Ein Gespräch aus den eigenen Spiegeln (eigenePerson).'),
  'inbox/senden': r('POST', 'person', 'Senden NUR per Einzelklick der Person über das Postfach des Gesprächs (eigenePerson; Dienstweg 403).'),
  'inbox/entwurf': r('POST', 'person', 'ZOE-Entwurf (Vorschlag) zu einem eigenen Gespräch (eigenePerson).'),
  'inbox/postfaecher': r('GET,POST', 'person', 'Eigene Postfächer verbinden/einstellen/erneuern/trennen; Passwörter nie in der Antwort (eigenePerson).'),
  'inbox/anhang': r('GET', 'person', 'Anhang aus dem eigenen IMAP-Postfach bzw. einem sichtbaren Team-Postfach (Zugang des Besitzers), nur als Download (eigenePerson).'),
  'inbox/uebergaben': r('GET,POST', 'person', 'Übergaben (freigegebene Kopien) an bzw. von der Person — Sicht serverseitig (uebergabeSichtbar, Privat nie an finanzRecht business), Schreiben nur Beteiligte (eigenePerson; Dienstweg 403).'),
  'inbox/suche': r('GET', 'person', 'Suche nur in dem, was die Person sieht (eigene Spiegel, sichtbare Team-Postfächer, eigene Übergaben); Suchbegriff nie im Protokoll (eigenePerson).'),
  'gmail/anhang': r('GET', 'person', 'Anhang aus dem eigenen Gmail (eigenePerson).'),
  'google/gmail/meldung': r('POST', 'offen', 'Gmail-Pub/Sub-Push: ohne Sitzung, prüft das OIDC-Token von Google selbst, liefert nie Daten.'),
  // WhatsApp Business (07.10., lib/whatsapp/*): die Business-Nummer der Instanz.
  'whatsapp/webhook': r('GET,POST', 'offen', 'Webhook der WhatsApp Cloud API — offen, aber selbst geprüft: GET nur mit dem Verify-Token (zeitkonstant, gedrosselt), POST nur mit gültiger X-Hub-Signature-256 über den Rohkörper (App-Geheimnis), Körper ≤ 512 KB, idempotent; ohne Einrichtung 404; liefert nie Daten.'),
  'whatsapp/senden': r('POST', 'person', 'Senden NUR per Einzelklick der Person mit Zugang zur Business-Nummer, an EIN Gespräch (eigenePerson; Dienstweg 403).'),
  'whatsapp/vorlagen': r('GET', 'person', 'Vorlagen des Business-Kontos lesen (Cache) — nur die Person mit Zugang (eigenePerson).'),
  'whatsapp/status': r('GET,POST', 'person', 'Zustand der WhatsApp-Verbindung (nie Schlüssel) — angemeldete Person im Haushalt (eigenePerson), Einzelheiten nur mit Zugang.'),
  'whatsapp/medien': r('GET', 'person', 'Medium einer WhatsApp-Nachricht als Download — nur die Person mit Zugang (eigenePerson).'),
  'google/rueckruf': r('GET', 'person', 'Rückruf der eigenen Google-Anmeldung (eigenePerson).'),
  'google/status': r('GET', 'person', 'Stand der eigenen Google-Verbindung (eigenePerson).'),
  'google/trennen': r('POST', 'person', 'Eigene Google-Verbindung trennen (eigenePerson).'),
  'google/verbinden': r('POST', 'person', 'Eigene Google-Verbindung herstellen (eigenePerson).'),
  'oauth/callback': r('GET', 'inhaber', 'M365-Anmeldung des Inhabers (WHOOP seit 08.10. je Person unter whoop/*).'),
  'oauth/start': r('GET', 'inhaber', 'M365-Anmeldung des Inhabers.'),
  'oauth/status': r('GET,POST', 'inhaber', 'M365-Verbindung des Inhabers.'),

  // ── Aufgaben, Planung, Ziele ────────────────────────────────────────────────────────────────────────────────
  'aufgaben/crm': r('GET', 'haushalt', 'Aufgaben mit CRM-Bezug des Haushalts; Systemlauf erlaubt.'),
  'aufgaben/dateien': r('GET,POST,PATCH,DELETE', 'haushalt', 'Dateiablage der Aufgaben des Haushalts.'),
  'aufgaben/export': r('GET', 'haushalt', 'Export der Aufgaben des Haushalts.'),
  'aufgaben/zeit': r('GET', 'haushalt', 'Zeiten an Aufgaben des Haushalts.'),
  'aufgaben/zoe': r('GET,POST', 'haushalt', 'ZOE an Aufgaben des Haushalts.'),
  'state/tasks': r('GET,PUT,PATCH', 'haushalt', 'Aufgaben-Bestand des Haushalts; lesen auch als Systemlauf.'),
  'tasks/create': r('POST', 'haushalt', 'Aufgabe anlegen; Systemlauf nur mit owner (S1).'),
  'state/ziele': r('GET,PUT,PATCH', 'haushalt', 'Gemeinsame Ziele („wir“) und persönliche Ziele des Haushalts — fremde eigene nur, wenn geteilt (teilt.ziele, 08.10.), nie schreiben.'),
  'state/meilensteine': r('GET,PUT,PATCH', 'haushalt', 'Gemeinsamer Meilenstein-Bestand des Haushalts.'),
  // 08.10. abends (Fragebogen Teil 3): keine Startroutinen mehr (das waren die Routinen einer echten Person) — eine leere Instanz
  // startet ohne Routinen, der GET liest nur noch.
  'state/routinen': r('GET,PUT,PATCH', 'haushalt', 'Gemeinsamer Routinen-Bestand des Haushalts (Blöcke je Person); lesen auch als Systemlauf.'),
  'planung/nordstern': r('GET,PUT', 'haushalt', 'Nordstern je Haushalt (`nordstern--<haushalt>`, 08.10. abends): jedes Konto mit Haushalt liest den SEINES Haushalts — auch Business-Konten, der Nordstern ist das gemeinsame Business-Ziel (planZugangVon entscheidet aus dem Konto); schreiben nur volle Mitglieder per Sitzung mit Stand/409, Dienstweg 403. Ein anderer Haushalt bekommt nie etwas.', 'planZugangVon'),
  'planung/einheiten': r('GET,POST', 'haushalt', 'Planungs-Einheiten je Haushalt (`planung-einheiten--<haushalt>`, ohne Haushalt je Person).', 'haushaltFuer'),
  'planung/meilenstein': r('GET,POST', 'haushalt', 'Meilenstein-Detail und Austausch des Haushalts.'),
  'planung/bezuege': r('POST', 'haushalt', 'Seil (07.10.): Bezüge auf ein zurückgeholtes Ziel wieder setzen (Unterziele, Meilensteine, Aufgaben, Projekte) — nur Sitzung, nur wo das Feld leer ist, dieselben Prüfungen.'),
  'planung/vorschlag': r('POST', 'haushalt', 'Wochenvorschlag (KI) aus Kalender und Aufgaben des Haushalts.'),
  'neustart': r('GET,POST', 'haushalt', '„Neu anfangen“ für Ziele und Aufgaben des Haushalts.'),
  'lichtfaeden': r('GET', 'haushalt', 'Lichtfäden aus allen Beständen des Haushalts (Privat der anderen nur „Belegt“).'),
  'seil': r('GET', 'haushalt', 'Seil (07.10.): Stränge → Ziele, Abhängigkeiten, kritischer Pfad — Aufgaben in der Sicht der Person, Bereich serverseitig (finanzRecht „business“ nur Business), Dienstweg 403.'),
  'fluss': r('GET', 'haushalt', 'Überblick „Für dich“ aus den Beständen des Haushalts.'),
  'state/zeit': r('GET,POST', 'person', 'Eigene Zeitmessung der Person.'),
  'state/zeit/einheiten': r('GET', 'person', 'Einheiten für die eigene Zeitmessung.'),
  'state/zeit/mandate': r('GET', 'haushalt', 'Mandate (aus dem CRM des Haushalts) für die Zeitmessung.'),
  'state/fokus': r('GET,POST', 'person', 'Laufender Fokus der Person.'),
  'state/fokus-regler': r('GET,PUT', 'haushalt', 'Fokus-Regler des Haushalts (gewichten Vorschläge).'),
  'state/backlog': r('GET,PUT,POST', 'haushalt', 'Alter Bauplan-Bestand des Haushalts; POST auch als Systemlauf (Eingang). Startbestand nur beim Schreiben.'),
  'bauplan': r('GET,POST', 'haushalt', 'Bauplan-Board der Instanz (Kevin, Malin, Claude).'),
  'bauplan/bild': r('GET,POST', 'haushalt', 'Bildschirmfotos am Bauplan — können Personenbezug tragen.'),
  'state/bauzeit': r('GET,PUT', 'haushalt', 'Bauzeit-Schalter des Haushalts.'),
  'state/arbeitsmodus': r('GET,POST', 'haushalt', 'Arbeits- und Gesundheits-Schalter je Person (seit 08.10. spät): nur die eigenen Zähler, Altbestand nur beim Inhaber.'),
  'state/arbeitsplatz': r('GET,PUT', 'haushalt', 'Arbeitsplatz-Wahl des Haushalts.'),
  'state/anwesenheit': r('GET,POST', 'haushalt', 'Wer gerade wo arbeitet — nur im Haushalt sichtbar.'),
  'state/nutzung': r('GET,POST,PUT', 'haushalt', 'Nutzungs-Loop des Haushalts.'),
  'state/ordnung': r('GET,PUT', 'haushalt', 'Themen-Reihenfolge und Zuordnungen des Haushalts.'),
  'state/filter': r('GET,PUT', 'haushalt', 'Gespeicherte Filter und Stichworte des Haushalts.'),
  'state/labels': r('GET,PUT', 'haushalt', 'Eigene Bezeichnungen des Haushalts.'),
  'state/dashboard': r('GET,PUT', 'haushalt', 'Widget-Board des Haushalts.'),
  'state/willkommen': r('GET,POST,DELETE', 'haushalt', 'Willkommens-Haken des Haushalts.'),
  'state/meetings': r('GET,POST,DELETE', 'haushalt', 'Meeting-Verlauf (Wortlaut Dritter) des Haushalts.'),
  'onboarding': r('GET,POST', 'haushalt', 'Einrichtung (Onboarding): gemeinsame Häkchen und Befunde für den Haushalt, persönliche nur für die Person der Sitzung; abhaken nur die Person selbst (Dienstweg 403, ohne Person 401), Inhaber-Schritte nur der Inhaber.'),
  'startflaeche': r('GET', 'haushalt', 'Kennzahlen aus den Beständen des Haushalts; Score der anderen Person nur mit Freigabe.'),
  'risk': r('GET', 'haushalt', 'Warnungen aus Finanz-, Aufgaben- und Kalenderbeständen des Haushalts.'),
  'performance': r('GET,POST', 'haushalt', 'MAKE Score je Person aus Beständen des Haushalts; POST auch als Systemlauf (Tagesstart).', undefined, 'Idempotenter Tagespunkt im EIGENEN Verlauf der Person (erster Aufruf des Tages) — der Systemlauf kennt nur den Inhaber.'),
  'state/flaeche': r('GET,PUT', 'person', 'Flächen-Layout je Person (speicherFuer).'),
  'state/rituale': r('GET,PUT', 'person', 'Rituale-Log je Person.'),
  'heute/anstehend': r('GET', 'haushalt', '„Heute“ aus Kalender, Fristen, Follow-ups des Haushalts.'),
  'meldungen': r('GET,POST', 'haushalt', 'Glocke je Person im Haushalt.'),

  // ── ZOE, Agenten, Brain ────────────────────────────────────────────────────────────────────────────────────
  'kimmi': r('POST', 'haushalt', 'ZOE-Gespräch: liest Brain und Bestände des Haushalts — nur Personen im Haushalt (400 ohne Person, S1).'),
  'zoe/stapel': r('GET,POST', 'haushalt', 'Vorschlags-Stapel des Haushalts (S1).'),
  'zoe/takt': r('GET,POST', 'haushalt', 'Takt: Dienstweg oder Haushalt (S1).'),
  'zoe/auftraege': r('GET,POST', 'haushalt', 'Auftrags-Warteschlange des Haushalts; lesen und einreihen auch als Systemlauf.'),
  'zoe/auftraege/lauf': r('POST', 'dienst', 'Arbeiter führt Aufträge aus.'),
  'zoe/auftraege/nimm': r('POST', 'dienst', 'Arbeiter holt Aufträge.'),
  'zoe/empfang': r('GET', 'haushalt', 'Begrüßung aus Brain und Lage des Haushalts.', undefined, 'Zwischenspeicher der Begrüßung je Stunde und Person (spart Modell-Aufrufe), nur aktueller und vorheriger Schlüssel.'),
  'zoe/morgen': r('POST', 'haushalt', 'Morgen-/Abendbericht aus der Lage des Haushalts; auch als Systemlauf.'),
  'zoe/gedaechtnis': r('GET,DELETE', 'haushalt', 'ZOE-Gedächtnis (eigener und gemeinsamer Raum) des Haushalts.'),
  'zoe/wissen': r('GET,POST', 'haushalt', 'Vault/Brain des Haushalts lesen und fragen.'),
  'zoe/protokoll': r('GET,POST', 'haushalt', 'ZOE-Protokoll des Haushalts; zurücknehmen nur eigene bzw. Systemeinträge.'),
  'zoe/selbstbild': rm({ GET: 'haushalt', POST: 'inhaber' }, 'Selbstbild-Blätter: ansehen im Haushalt; in den Vault schreiben nur Inhaber bzw. Systemlauf.'),
  'zoe/verbrauch': r('GET', 'haushalt', 'KI-Kosten der Instanz.'),
  // ZOE auf WhatsApp (08.10., lib/zoe-whatsapp/*): die eigene ZOE-Nummer der Instanz — Kanal JE PERSON.
  'zoe/whatsapp': r('GET,POST', 'person', 'Der eigene ZOE-Kanal auf WhatsApp: verbinden (Code), Einwilligung/Ausnahme, Test, trennen — NUR die Person selbst (eigenePerson; Dienstweg 403, keine Personen-Parameter); Nummer nur maskiert, Code nur einmal in der Antwort.'),
  'zoe/whatsapp/webhook': r('GET,POST', 'offen', 'Webhook der ZOE-Nummer — offen, aber selbst geprüft: GET nur mit dem Verify-Token der ZOE-Nummer (zeitkonstant, gedrosselt), POST nur mit gültiger X-Hub-Signature-256 über den Rohkörper (App-Geheimnis der ZOE-Nummer), ≤ 512 KB, idempotent; fremde Nummern nur gezählt; ohne Einrichtung 404; liefert nie Daten.'),
  'zoe/whatsapp/sprachnachricht': r('GET', 'person', 'Eigene Sprachnachricht an ZOE anhören (Download aus der verschlüsselten Ablage) — nur die Person selbst (eigenePerson), gesucht nur in ihrem Kanal.'),
  'delegation': r('GET,POST', 'haushalt', 'Delegations-Runde über Aufgaben des Haushalts; POST auch als Systemlauf.'),
  'okr': r('POST', 'haushalt', 'OKR-Agent über Finanzen und Aufgaben des Haushalts; auch als Systemlauf.'),
  'board': r('POST', 'haushalt', 'Board-Pack aus Controlling, Prospecting, Aufgaben des Haushalts; auch als Systemlauf.'),
  'research': r('POST', 'haushalt', 'Recherche-Agent (kostet Modell-Zeit) — nur der Haushalt bzw. Systemlauf.'),
  'meeting': r('POST', 'haushalt', 'Meeting-Agent → Aufgaben im Haushalt; auch als Systemlauf.'),
  'fokus': r('POST', 'haushalt', 'Tagesform-Agent aus Brain des Haushalts und eigenen Werten.'),
  'loop': r('POST', 'haushalt', 'Loops des Haushalts (S1).'),
  'loop/verbesserung': r('POST', 'inhaber', 'Verbesserungs-Loop (Software) — Inhaber bzw. Systemlauf.'),
  'tageslauf': r('GET,POST', 'haushalt', 'Tageslauf: Auslösen im Haushalt bzw. als Systemlauf (rechnet dann als Inhaber); Läufe je Person (seit 08.10. spät) — GET nur die eigenen; Post liest der Lauf nur für die eigene Person (Inbox 2).'),
  'tagesstart': r('GET,POST', 'haushalt', 'Tagesstart des Haushalts; Systemlauf erlaubt.'),
  'heads/[head]': r('GET,POST', 'haushalt', 'Heads (Agenten-Leitungen) des Haushalts. POST trägt den Systemlauf des Takts (Dienstweg ohne Person, `imHaushaltOderSystemlauf`) — nur `lauf` mit `ausgeloest: takt` und einem Modus ohne Person (08.10., Sofort-Paket 6.1); alles andere braucht eine Person im Haushalt.'),
  'heads/eval': rm({ GET: 'haushalt', POST: 'inhaber' }, 'Bewertung der Heads: ansehen im Haushalt, auslösen nur Inhaber.'),
  'state/agent-log': rm({ GET: 'haushalt', POST: 'inhaber' }, 'Agenten-Läufe (Ergebnisse mit Inhalten) — lesen im Haushalt nur eigene + Systemläufe (08.10.), schreiben Inhaber/Systemlauf.'),
  'state/agents': rm({ GET: 'haushalt', PUT: 'inhaber' }, 'Agenten-Schalter: ansehen im Haushalt, ändern nur Inhaber.'),
  'state/zoe-verlauf': r('GET,PUT,DELETE', 'person', 'Eigene ZOE-Gespräche der Person.'),
  'state/kompass': r('GET,PUT', 'haushalt', 'Kompass (System-Einstellung) des Haushalts; lesen auch als Systemlauf.'),
  'brain/app': r('GET,POST', 'haushalt', 'Brücke App → Brain des Haushalts.'),
  'brain/inbox': r('GET,POST', 'haushalt', 'Brain-Eingang des Haushalts.'),
  'brain/index': r('GET,POST', 'haushalt', 'Brain-Index des Haushalts.'),
  'brain/konsolidierung': r('GET,POST', 'haushalt', 'Nächtliche Konsolidierung des Brain.'),
  'brain/punkte': r('GET', 'haushalt', 'Brain-Kugel; Privates nur mit Privatzugang (planZugangFuer).'),
  'brain/regeln': r('GET,POST', 'haushalt', 'Regelregister des Brain.'),
  'telegram/eingang': r('GET,POST', 'dienst', 'Bote (Telegram) — nur der Dienstweg.'),
  'telegram/koppeln': r('GET,POST,DELETE', 'person', 'Eigene Telegram-Kopplung der Person.'),
  'jarvis/[...pfad]': r('GET,POST,PUT,PATCH,DELETE', 'offen', 'Nur 308-Weiterleitung von /api/jarvis/* nach /api/zoe/* — das Ziel prüft selbst; liest/schreibt nichts.'),

  // ── Gesundheit, Familie, Persönliches ──────────────────────────────────────────────────────────────────────
  'gesundheit/index': r('GET,POST', 'person', 'Gesundheits-Index je Person; fremde nur mit Freigabe (darfGesundheitSehen).'),
  'gesundheit/stand': r('GET', 'person', 'Gesundheits-Stand je Person; fremde nur mit Freigabe.'),
  'gesundheit/koerper': r('GET,PATCH', 'person', 'Körper-Profil (Art. 9) NUR der Person selbst (personStreng, kein ?fuer, Dienstweg 403) — auch bei geteilter Gesundheit nie für andere; Schreiben nur mit Einwilligung (a), Stand/409 (08.10., Fragebogen Teil 3).'),
  'state/haut': r('GET,PUT', 'person', 'Haut-Log je Person (Art. 9); fremde nur mit Freigabe.'),
  'state/health': r('GET,PUT', 'person', 'Gesundheits-Log je Person (Art. 9); fremde nur mit Freigabe.'),
  'state/journal': r('GET,PUT,PATCH', 'person', 'Journal je Person (Art. 9); fremde nur mit Freigabe.'),
  'state/streak': r('GET,PUT', 'person', 'Serien je Person; fremde nur mit Freigabe.'),
  'state/vitals': r('GET,PUT', 'person', 'Vitalwerte je Person (Art. 9); fremde nur mit Freigabe.'),
  'sport': r('GET,PUT', 'person', 'Sport je Person (personStreng, 401).'),
  'import/whoop': r('GET,POST', 'inhaber', 'Whoop-Export des Inhabers.'),
  // WHOOP je Person (08.10., lib/whoop/*): Verbindung verwaltet nur die Person selbst (eigenePerson; Dienstweg 403), nie Tokens in Antworten.
  'whoop/status': r('GET', 'person', 'Stand der EIGENEN WHOOP-Verbindung (maskiert, nie Token/Kennung) + eigene letzte Werte mit Lese-Protokoll (eigenePerson).'),
  'whoop/verbinden': r('POST', 'person', 'Eigene WHOOP-Anmeldung starten (state je Person) — nur mit Einwilligung (a) Gesundheit (eigenePerson).'),
  'whoop/rueckruf': r('GET', 'person', 'Rückruf der eigenen WHOOP-Anmeldung — state gehört der Person der Sitzung (eigenePerson).'),
  'whoop/trennen': r('POST', 'person', 'Eigene WHOOP-Verbindung trennen: Widerruf bei WHOOP, Bestand + Spiegel weg (eigenePerson).'),
  'whoop/abgleich': r('POST', 'person', 'Eigene Werte jetzt abgleichen — nur mit Einwilligung (a) (eigenePerson).'),
  'whoop/webhook': r('POST', 'offen', 'Webhook von WHOOP — offen, aber selbst geprüft: nur mit gültiger X-WHOOP-Signature (HMAC-SHA256 über Zeitstempel + Rohkörper, Client Secret, zeitkonstant), Körper ≤ 64 KB, gedrosselt, idempotent (trace_id), nur bekannte WHOOP-Kennungen; ohne Einrichtung 404; liefert nie Daten.'),
  'ernaehrung/bild': r('GET,POST,DELETE', 'haushalt', 'Gerichte-Fotos des Haushalts.'),
  'ernaehrung/rezept': r('POST', 'haushalt', 'Rezept-Agent für den Haushalt.'),
  'ernaehrung/vorschlag': r('GET,POST', 'haushalt', 'Wochen-Essensvorschlag des Haushalts.'),
  'state/ernaehrung': r('GET,PUT,PATCH', 'haushalt', 'Ernährungs-Bestand des Haushalts.'),
  'familie': r('GET,PATCH', 'haushalt', 'Familie & Partnerschaft — Bestand je Haushalt (`familie--<haushalt>`), streng über haushaltVon.', 'haushaltVon'),
  'kapazitaet': r('GET,PATCH', 'haushalt', 'Kapazität des Haushalts; Gesundheit nur mit Einwilligung (S2).'),
  // Business-frei (08.10., Lücke 7): eigener Arbeitsrahmen — nur die Person selbst; über andere nur ja/nein (volle Mitglieder „bis“).
  'arbeitsrahmen': r('GET,PUT', 'person', 'Eigene Business-freie Zeiten (Familie + eigene Ergänzung `arbeitsrahmen--<person>`) — nur die Person selbst im Haushalt (eigenePerson, Dienstweg 403), keine Personen-Parameter; über andere Konten nur ja/nein, Konten mit finanzRecht „business“ nie Zeiten.'),

  // ── Finanzen ────────────────────────────────────────────────────────────────────────────────────────────────
  'beleg': r('POST', 'finanz-privat', 'Beleg lesen (KI) mit Kategorien aus den Buchungen der Instanz — Privatzugang im Inhaber-Haushalt.'),
  'beleg/uebernehmen': r('POST', 'finanz-privat', 'Schreibt Buchung bzw. Rechnung in die gemeinsamen Finanzbestände — Privatzugang im Inhaber-Haushalt.'),
  'state/buchungen': r('GET,PUT,PATCH', 'finanz-privat', 'Bank-Buchungen inkl. Privatkonto — nur Haushaltsmitglieder ohne finanzRecht business.'),
  'state/liquiplan': r('GET,PUT,PATCH', 'finanz-privat', 'Liquiditätsplan inkl. privater Posten — nur Haushaltsmitglieder ohne finanzRecht business.'),
  'state/finanzplan': r('GET,PUT,PATCH', 'finanz-privat', 'Finanzplan-Altweg (Firmen inkl. Privatkonto, Rechnungen) — Business-Sicht gibt es über /api/finanzplan.', undefined, 'Erststart (leerer Bestand → Startgerüst) und einmaliger Nachzug neuer Abschnitte (Produkte, Uhrwerk) — idempotent.'),
  'state/finance': r('GET,PUT,PATCH', 'haushalt', 'Controlling (Business-Ist) des Haushalts.'),
  'state/grundlage': r('GET,PUT', 'haushalt', 'Finanz-Grundlage — Privates wird beim Lesen herausgenommen.'),
  // Rechnungen schreiben mit PDF (08.10.): Konto mit Haushalt des Inhabers; `finanzRecht: 'business'` sieht/schreibt nur Business-Gesellschaften.
  'rechnung': r('GET,POST', 'finanz-business', 'Rechnungen mit Positionen und PDF (Entwurf, Stellen mit lückenloser Nummer, Stornorechnung, Mahnvorschläge, PDF-Download) im Finanzplan des Haushalts des Inhabers; Sicht aus dem Konto (planZugangVon) — Business-Konten nur Business-Gesellschaften (serverseitig gefiltert, fremde → 403/404); Stellen/Storno/Mahnung nie über den Dienstweg (403).'),
  'finanzplan': r('GET,PATCH', 'finanz-business', 'Finanzplanung je Haushalt mit Sicht aus dem Konto (Privat für business-Konten serverseitig gefiltert); Business-Sicht schreibt nur Business-Pfade und nie den privaten Teil (403, lib/finanzen/plan/business-schreiben.ts), Kennzahlen je Bereich mit dessen Arbeitsplan.'),
  'finanzplan/import': r('POST', 'finanz-privat', 'Import in die Finanzplanung des eigenen Haushalts — nur voller Zugang.'),
  'finanzplan/vorschlaege': r('GET', 'finanz-privat', 'Vorschläge aus CRM für die Finanzplanung des eigenen Haushalts.'),
  // Konten-Register (08.10.): EIN Ort für Konten und Kontostände. Sicht aus dem Konto wie die Finanzplanung (`wirksameSicht`): „nur Business“ und der
  // Business-Bereich bekommen nur Konten der Business-Gesellschaften, schreiben auf andere → 403; Dienstweg → 403 (ein Mensch trägt ein).
  'finanzen/konten': r('GET,POST', 'finanz-business', 'Konten-Register je Haushalt (Konto → Gesellschaft/privat/gemeinsam, Stände mit Datum, IBAN nur maskiert) mit Sicht aus dem Konto; Privat/gemeinsam nur volle Mitglieder, Schreiben außerhalb der Sicht 403, Dienstweg 403, Stand je Konto (409), Übernahme nur mit Vorschau-Kennung.'),
  'finanzchef': r('GET,POST', 'haushalt', 'Head of Finance: Business der Instanz für den Haushalt; Haushaltsteil zusätzlich über haushaltVon.'),
  'haushalt': r('GET,PATCH', 'finanz-privat', 'Haushaltsfinanzen je Haushalt.'),
  'haushalt/aktion': r('POST', 'finanz-privat', 'Aktionen in den Haushaltsfinanzen je Haushalt.'),
  'haushalt/pruefliste': r('GET,POST', 'finanz-privat', 'Entflechtung Business ↔ Haushalt — vergleicht mit den gemeinsamen Beständen, darum nur der Inhaber-Haushalt.'),
  'haushalt/sicherung': r('GET', 'finanz-privat', 'Sicherung der Haushaltsfinanzen je Haushalt.'),
  'haushalt/umzug': r('GET,POST', 'finanz-privat', 'Umzug der Haushaltsfinanzen je Haushalt.'),
  'privat': r('GET,POST', 'finanz-privat', 'Privat-Finanzen je Haushalt.'),
  'privat/abschluss': r('GET,POST', 'finanz-privat', 'Monatsabschluss der Privat-Einheiten (Selbstständigkeit) im gemeinsamen Bestand business-abschluesse — Privatzugang im Inhaber-Haushalt; nur Firmen des Privat-Bereichs (Business-Gesellschaft → 400), der Business-Index umgekehrt.'),
  'steuern': r('GET,POST', 'haushalt', 'Steuerfristen der Firmen des Haushalts; seit 05.10. mit Bereichs-Sicht: ?space=business oder finanzRecht business → nur die Business-Gesellschaften (Selbstständigkeit und Privat serverseitig gefiltert, Schreiben darauf 403).'),
  'business/eroeffnung': r('GET,POST', 'haushalt', '0-Punkt (Eröffnung) je Business-Gesellschaft (Bestand business-eroeffnung, Historie) — Haushalt des Inhabers wie der Business-Index; schreiben nur Personen mit Finanzrecht (Inhaber/Konto mit Haushalt), nie Dienstweg/ZOE; Privat-Einheit → 400.'),
  'business': r('GET,POST', 'haushalt', 'Business-Index des Haushalts — Monatsabschlüsse/Einstellungen nur der Business-Gesellschaften (eine Privat-Einheit → 400; deren Abschluss: /api/privat/abschluss).'),
  'controlling/analyse': r('POST', 'haushalt', 'Controlling-Agent über das Business des Haushalts.'),
  'gesellschaften': r('GET,POST,PATCH', 'haushalt', 'Gesellschafts-Register des Haushalts.'),
  'gesellschaften/unterlagen': r('GET,POST', 'haushalt', 'Unterlagen im Gesellschafts-Register.'),
  'crm/gesellschaften': r('GET,POST,PATCH,DELETE', 'haushalt', 'Gesellschaften-Register (CRM-Sicht) des Haushalts.'),

  // ── Kartei, Netzwerk, Markttraktion ────────────────────────────────────────────────────────────────────────
  'state/kontakte': r('GET,PATCH', 'haushalt', 'Kartei des Haushalts (K1).'),
  'state/netzwerk': r('GET,PUT,PATCH', 'haushalt', 'Netzwerk-Bestand des Haushalts (K1).'),
  'state/stammdaten': r('GET,PATCH', 'haushalt', 'Stammdaten der Kartei (K1); seit 08.10. spät Steuer-ID/SV-Nummer/IBAN nur für die Person selbst (Server), Schreiben nur als Einzeländerung mit Stand (PATCH, Person nötig).'),
  'state/aenderungen': rm({ GET: 'haushalt', POST: 'offen' }, 'Änderungsprotokoll der Kartei; POST antwortet nur noch 405 (schreibt nichts).'),
  'team': r('GET,PATCH', 'haushalt', 'Team aus den Daten des Haushalts.'),
  'netzwerken': r('GET,POST', 'haushalt', 'Netzwerken (Events, Karten) des Haushalts.'),
  'netzwerken/karten': r('GET,PATCH', 'haushalt', 'Visitenkarten je Haushalt (streng über haushaltVon; für andere nur der Inhaber).', 'haushaltVon'),
  'state/kunden': r('GET,PUT,PATCH', MT, 'Kunden der Markttraktion (Kartei-Tor).'),
  'state/prospects': r('GET,PUT', MT, 'Prospects der Markttraktion (Kartei-Tor).'),
  'prospecting/score': r('POST', MT, 'KI-Qualifizierung eines Prospects; auch als Systemlauf (ZOE-Agent).'),
  'outreach': r('POST', MT, 'Erstansprache-Entwurf (KI); auch als Systemlauf.'),
  'content': r('GET,POST,DELETE', MT, 'Content-Entwürfe (Marketing); POST auch als Systemlauf.'),
  'crm/aktivitaet': r('POST', MT, 'Aktivität an einem Kontakt.'),
  'crm/anfrage': r('GET,POST', MT, 'Anfragen.'),
  'crm/angebot': r('GET,POST', MT, 'Angebote.'),
  'crm/ansprechen': r('GET', MT, 'Wen heute ansprechen.'),
  'crm/bestand': r('GET,PATCH', MT, 'CRM-Bestand.'),
  'crm/dateien': r('GET,POST,PATCH,DELETE', MT, 'Dateien an Kontakten/Firmen.'),
  'crm/datenschutz': r('GET,POST', MT, 'Art. 15/17 für CRM-Personen.'),
  'crm/deal': r('POST', MT, 'Deals.'),
  'crm/dubletten': r('GET,POST', MT, 'Dubletten.'),
  'crm/entwurf': r('POST', MT, 'Entwurf (KI) für einen Kontakt.'),
  'crm/events': r('GET,POST', MT, 'Events.'),
  'crm/export': r('GET', MT, 'Export.'),
  'crm/firma-archiv': r('POST', MT, 'Firma archivieren (Inhaber).'),
  'crm/followup': r('GET,POST', MT, 'Follow-ups.'),
  'crm/heute': r('GET', MT, 'CRM heute.'),
  'crm/import': r('GET,POST', MT, 'Import.'),
  'crm/kampagnen': r('GET,POST', MT, 'Kampagnen.'),
  'crm/kennungen-umzug': r('POST', MT, 'Kennungen umziehen (Inhaber).'),
  'crm/kontakt-frage': r('GET,POST', MT, 'Frage an einen Kontakt (KI).'),
  'crm/lead': r('GET,POST', MT, 'Leads.'),
  'crm/liquiplan': r('GET,POST', MT, 'Mandat → Liquiditätsplan (Schnittstelle Markttraktion ↔ Finanzen).'),
  'crm/mandat-wahl': r('GET', MT, 'Mandatswahl.'),
  'crm/marketing': r('GET,POST', MT, 'Marketing.'),
  'crm/netzwerk': r('GET,POST', MT, 'Netzwerk im CRM.'),
  'crm/scoring': r('GET,PATCH', MT, 'Lead-Scoring.'),
  'crm/signale': r('GET,POST', MT, 'Signale.'),
  'crm/stammdaten': r('GET,POST', MT, 'CRM-Stammdaten.', undefined, 'Idempotenter Nachtrag fehlender Verarbeitungen ins Verzeichnis (Art. 30) — schreibt nur, wenn ein Eintrag fehlt, nie Personendaten.'),
  'crm/suche': r('GET', MT, 'Suche.'),
  'crm/traktion': r('GET,POST', MT, 'Kennzahlen der Traktion.', undefined, 'Idempotenter Tages-Schnappschuss der Kennzahlen (nur bei geändertem Stand).'),
  'crm/uebergabe': r('POST', MT, 'Übergabe.'),
  'crm/umzug': r('POST', MT, 'Umzug.'),
  'crm/verbindungen': r('GET,POST', MT, 'Verbindungsprüfung.'),
  'crm/visitenkarte': r('POST', MT, 'Visitenkarte lesen (KI).'),

  // ── Buchung (öffentlich) ───────────────────────────────────────────────────────────────────────────────────
  'buchung/[slug]': r('GET,POST', 'offen', 'Öffentliche Buchungsseite (K4): enge Regex in der Middleware, Drossel, Honigtopf, Stempel, Größe — handelt nie als Person.'),
  'buchung/[slug]/status': r('POST', 'offen', 'Status einer Buchung (K4) — wie oben, mit Token.'),

  // ── Konto, Anmeldung, System ───────────────────────────────────────────────────────────────────────────────
  // ── Datenschutz (05.10., DSGVO-Pakete) ────────────────────────────────────────────────────────────────────
  'datenschutz/einrichtung': rm({ GET: 'haushalt', POST: 'inhaber' }, 'Verantwortlicher, Empfänger/AVV der Instanz: ansehen im Haushalt, pflegen nur der Inhaber von Hand.'),
  'datenschutz/gesundheit': r('GET,POST', 'person', 'Art.-9-Einwilligung — nur die Person selbst per Sitzung (Dienstweg und Inhaber → 403).'),
  'datenschutz/ki': r('GET,PUT', 'person', 'KI-Schalter: eigene Schalter nur selbst; Instanz-Schalter prüft die Route zusätzlich auf den Inhaber.'),
  'datenschutz/ki-protokoll': r('GET', 'person', 'Eigene Zeilen des KI-Protokolls (Art. 15); Systemläufe zusätzlich nur für den Inhaber.'),
  'datenschutz/instanz-export': r('GET,POST', 'inhaber', 'Instanz-Export bei Vertragsende — nur Inhaber mit eigener Sitzung + Passwort/zweitem Faktor, Eintrag im Lese- und Anmeldeprotokoll.'),
  'datenschutz/nachweise': r('GET,POST', 'inhaber', 'Lese-Protokoll und Kettenprüfung — nur der Inhaber selbst.'),
  'datenschutz/pannen': r('GET,POST', 'inhaber', 'Pannen-Register (Art. 33 Abs. 5) — nur der Inhaber, nur von Hand.'),
  'datenschutz/pruefung': r('GET', 'haushalt', 'Datenschutz-Selbstprüfung der Instanz.'),
  'datenschutz/verzeichnis': r('GET', 'haushalt', 'Verzeichnis der Verarbeitungstätigkeiten (Art. 30) als Dokument.', undefined, 'Vervollständigt das Verzeichnis vorher idempotent (in der Sperre des CRM, nie Personendaten).'),

  'konto/status': r('GET', 'offen', 'Ob es schon Konten gibt (für /anmelden) — nur ein Ja/Nein.'),
  'konto/anmelden': r('POST', 'offen', 'Anmeldung: eigene Drossel, Passwort, 2FA, Protokoll.'),
  'konto/einrichten': r('POST', 'offen', 'Erstes Konto nur mit Einmal-Code (S3).'),
  'konto/beitreten': r('POST', 'offen', 'Beitritt mit Einladungscode (48 h, einmalig).'),
  'konto/abmelden': r('POST', 'person', 'Abmelden: widerruft den Zettel der eigenen Sitzung (prüft das Cookie selbst).', 'sitzungPruefen'),
  'konto/adressen': r('POST', 'person', 'Eigene Anmelde-Adressen — nur die Person der Sitzung, nie der Dienstweg.'),
  'konto/daten': r('GET,POST', 'person', 'Eigene Daten herunterladen (Art. 15/20) und eigenes Konto löschen (Art. 17) — nur die Person der Sitzung, nie Dienstweg; Löschen mit Passwort + zweitem Faktor.'),
  'konto/ich': r('GET,PUT', 'person', 'Eigenes Konto (Name, Passwort).'),
  'konto/teilen': r('PUT', 'person', 'Wem ich meine Gesundheitsdaten bzw. meine eigenen Ziele (08.10.) zeige — nur die eigene Einstellung.'),
  'konto/zwei-faktor': r('POST', 'person', 'Eigener zweiter Faktor.'),
  'konto/einladen': r('POST', 'inhaber', 'Einladungscode — nur der Inhaber per Sitzung (Person der Sitzung, Rolle wird in der Route geprüft; Dienstweg → 401).', 'personDerSitzung'),
  'konto/einstellungen': r('GET,PUT', 'inhaber', 'Zugangs-Einstellungen der Instanz — nur der Inhaber per Sitzung (Rolle wird in der Route geprüft).', 'personDerSitzung'),
  'konto/haushalt': r('GET,PUT', 'inhaber', 'Haushalt und finanzRecht der Konten — nur der Inhaber.'),
  'konto/stand': r('GET,POST', 'dienst', 'Passwort-Stand für die Middleware — nur Dienstweg.'),
  'client-fehler': rm({ GET: 'inhaber', POST: 'person', DELETE: 'inhaber' }, 'Browser-Fehler: melden jede angemeldete Person, lesen/leeren nur der Inhaber (Meldungen können Inhalte tragen).'),
  'demo': r('GET,POST', 'inhaber', 'Demo-Instanz zurücksetzen — nur der Inhaber.'),
  'hoi/aussen': rm({ GET: 'haushalt', POST: 'dienst' }, 'Außenblick des Head of IT: melden nur mit HOI-Schlüssel bzw. Dienstweg, ansehen im Haushalt.'),
  'hoi/csp': rm({ POST: 'offen', GET: 'haushalt' }, 'CSP-Meldungen: der Browser meldet ohne Sitzung (nur Zähler, eigene Rate); ansehen im Haushalt.'),
  'hoi/lage': r('GET', 'haushalt', 'Lage des Systems (Head of IT) für den Haushalt.'),
  'system/update': r('GET', 'person', 'Update-Hinweis im Kopf (08.10.): jede angemeldete Person per Sitzung — nur { laeuft, seit, bau }, keine Inhalte, keine Personen (Dienstweg braucht ihn nicht).'),
  'intern/absichten': r('GET,POST', 'inhaber', 'Interne Absichten — Inhaber bzw. Systemlauf.'),
  'intern/schreibpause': r('POST', 'dienst', 'Schreibpause (Sicherung) — nur Dienstweg.'),
  'intern/umschluesseln': r('POST', 'dienst', 'Datenschlüssel rotieren — nur Dienstweg.'),
  'intern/wiederherstellen': r('GET,POST', 'inhaber', 'Einzel-Wiederherstellung — Inhaber bzw. Systemlauf.'),
};

/** Entfernte Routen (05.10.): alte 410-Wege, auf die nichts mehr zeigt — dürfen nicht wiederkommen. */
export const ENTFERNTE_ROUTEN = ['apple-calendar/create', 'apple-calendar/termin', 'state/wochenplan',
  // Inbox 2 (06.10.): Apple-Mail per osascript, Microsoft-365-Bestand, iCloud-Eingangsdatei, alte Inbox-Status/-Triage/-Entwurf und die
  // Gmail-Einzelwege für Nachricht/Senden/Entwurf (jetzt /api/inbox/*).
  'apple-mail', 'apple-mail/body', 'apple-mail/draft', 'apple-mail/inhalt', 'microsoft', 'eingang', 'inbox/draft', 'inbox/triage', 'state/inbox', 'state/inbox-absender',
  'gmail/nachricht', 'gmail/senden', 'gmail/entwurf',
  // Kontakt-Vorschläge aus dem M365-Bestand (ohne Aufrufer; die Inbox schlägt „Kontakt anlegen“ je Gespräch vor).
  'netzwerk/vorschlaege',
  // Postfach → Space-Zuordnung der alten Inbox (jetzt: Bereich je Postfach im Register `postfaecher--<person>`).
  'state/spaces',
  // WHOOP (08.10.): der gemeinsame Abgleich des Inhabers (API v1) — ersetzt durch whoop/* je Person.
  'whoop/sync'] as const;
