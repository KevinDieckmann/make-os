// ─── Register ALLER Bestände: Personenbezug und Art.-17-Behandlung (29.09., Paket D-B #69/#74) ─
// Jeder Bestandsname, den der Code liest oder schreibt (`loadJson/updateJson/saveJson/updateJsonAsync/updateGeschuetzt`
// mit Literal), MUSS hier stehen — der Wächtertest `tests/datenschutz-register.test.ts` scannt den Code und wird rot bei
// jedem unbekannten Namen. Damit kann kein neuer Speicher mit Personenbezug still an Art. 15/17 vorbeiwachsen.
//
//   bezug        'dritte'   Personen außerhalb des Haushalts (CRM-Kontakte, Absender, Teilnehmende) — Art. 15/17 gilt
//                'haushalt' Kevin/Malin selbst (Konto, Gesundheit, Finanzen) — Art. 17 über das Konto, nicht über das CRM
//                'kein'     keine Personendaten (Einstellungen, Riegel, Zahlen)
//   behandlung   'entfernen'  Einträge der Person fallen weg (person-bestaende.ts / person-weitere.ts)
//                'tilgen'     Eintrag bleibt, Kennung/Adresse/Name/Fingerabdruck → „[gelöscht]“
//                'pseudonym'  nur Fingerabdrücke (HMAC v2), keine Klartexte — bewusst so (Sperrliste, Löschprotokoll)
//                'ausgenommen' mit Grund (Aufbewahrungspflicht, eigene Daten des Haushalts, kein Personenbezug)
//   muster       Name oder Muster mit `*` (z. B. `heads-replay-*`).
// Rein, ohne Abhängigkeiten — der Test und die Doku lesen es direkt.

export type Bezug = 'dritte' | 'haushalt' | 'kein';
export type Behandlung = 'entfernen' | 'tilgen' | 'pseudonym' | 'ausgenommen';
export interface SpeicherEintrag { muster: string; bezug: Bezug; behandlung: Behandlung; grund: string; frist?: string }

const E = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'entfernen', grund, ...(frist ? { frist } : {}) });
const T = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'tilgen', grund, ...(frist ? { frist } : {}) });
const H = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'haushalt', behandlung: 'ausgenommen', grund });
const K = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'kein', behandlung: 'ausgenommen', grund });
/** Spiegel einer Apple-Quelle mit Dritten: ausgenommen — Löschung nur in Apple (der Löschlauf meldet, wo). */
const A = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'ausgenommen', grund, ...(frist ? { frist } : {}) });

export const SPEICHER_REGISTER: readonly SpeicherEintrag[] = [
  // ── CRM-Kern (lib/crm/person-bestaende.ts) ──
  E('kontakte', 'Die Kartei — Eintrag raus (personEntfernen), mit allen Feldern inkl. Geburtstag (K2, 29.09.).', 'kontakte'),
  E('crm', 'Kennung raus (person-verweise.ts), voller Name in Deal-Titeln/Kundennamen → „[gelöscht]“.'),
  E('crm-dateien--*', 'Dateiablage: nur Personen-Bezug → Eintrag + Datei weg; mit Geschäftsbezug nur der Personen-Bezug.'),
  E('crm-import-konflikte', 'Konflikte und mögliche Dubletten der Person raus.', 'import-konflikte'),
  E('crm-import-laeufe--*', 'Vorher-Stände der Person raus (laufOhne), auch Zusammenführ-Läufe; Namen getilgt.', 'import-laeufe'),
  E('head-*', 'Head-Vorschläge der Person raus, Berichte, die sie nennen, raus.'),
  E('heads-replay-*', 'Replay-Fälle mit der Person raus.', 'heads-replay'),
  // F3 (29.09.): `kommend` ist abgelöst (der nächste Termin kommt aus dem Kalender über den Bezug) — der Signal-Lauf schreibt
  // nur noch Zeitpunkt + Zahl; ein alter `kommend` bleibt bis zum nächsten Lauf und fällt bis dahin hier mit.
  E('crm-signale', 'Altbestand: kommender Termin der Person raus (seit F3 nicht mehr geschrieben, der Lauf überschreibt ohne).', 'signale'),
  E('tasks', 'Nur eindeutig zugeordnete Aufgaben: Name → „[gelöscht]“, Link und bezug.kontaktId raus — die Aufgabe bleibt.'),
  { muster: 'crm-sperrliste--*', bezug: 'dritte', behandlung: 'pseudonym', grund: 'Person KOMMT HINZU (Grund „loeschung“) — nur HMAC-Fingerabdrücke, damit ein Import sie nie neu anlegt.' },
  { muster: 'crm-loeschprotokoll', bezug: 'dritte', behandlung: 'pseudonym', grund: 'Nur Protokoll-ID `lp-…`, Tag, Grund, wer — nie die Kennung (lib/crm/loeschprotokoll.ts).' },
  // ── Weitere Speicher (lib/crm/person-weitere.ts, 29.09.) ──
  E('netzwerk', 'Altbestand vor der Kartei — Datensätze der Person (Adresse/Name) samt Chancen raus; wird stillgelegt.', 'netzwerk'),
  E('kunden', 'Altbestand Kunden — Privatkunde mit dem Namen der Person raus, Rest getilgt.'),
  E('stammdaten', 'Alte Stammdaten-Listen (Personen/Partner) — Datensätze der Person raus, Rest getilgt.'),
  T('prospects', 'Zielliste (Firmen) — Nennungen in Begründung/Aufhänger getilgt.'),
  E('inbox-absender', 'Screener: Entscheidung zur Adresse der Person fällt weg.'),
  E('inbox-triage', 'Einstufungen von Mails, die die Person nennen, raus.', 'postfach-caches'),
  E('apple-mail-cache', 'Mail-Zwischenspeicher — Mails der Person raus (Postfach selbst beim Anbieter).', 'postfach-caches'),
  E('m365-postfach', 'Mail-Zwischenspeicher (Microsoft 365) — Mails der Person raus.', 'postfach-caches'),
  E('microsoft-inbox', 'Mail-Zwischenspeicher (Anzeige) — Mails der Person raus.', 'postfach-caches'),
  // Apple-Spiegel (29.09., K2 — Verbindungskarte Befund 3): Tilgen im Zwischenspeicher wäre Schein, der Abgleich baut
  // ihn alle 5 Min. aus Apple neu. Deshalb „ausgenommen: Löschung nur in Apple“ — der Löschlauf zählt die Einträge, die
  // die Person nennen, und meldet „n Einträge in Apple nennen die Person — dort löschen“ (person-weitere.ts `nurInApple`).
  A('calendar-cache', 'Kalender-Spiegel aus Apple (Mac-Zulieferung/iCloud) — Löschung nur in Apple; der Löschlauf meldet die Termine, die die Person nennen.', 'kalender-caches'),
  A('apple-reminders-cache', 'Erinnerungen-Spiegel vom Mac — Löschung nur in Apple; der Löschlauf meldet die Einträge, die die Person nennen.'),
  A('apple-contacts-cache', 'Kontakte-Spiegel vom Mac (Adressbuch) — Löschung nur in Apple; der Löschlauf meldet die Einträge, die die Person nennen.'),
  T('kemaris-calendar', 'Kalender-Zwischenspeicher (KEMARIS) — Termin bleibt, Name/Adresse getilgt.', 'kalender-caches'),
  // Kalender K1 (29.09., KALENDER_VERBINDUNGEN.md 4a/4f):
  E('kalender-bezug', 'Bezüge der Termine zu MAKE OS (nur Kennungen: Kontakt, Firma, Mandat, Deal, Aufgabe, Event) — die Kontakt-Kennung der Person fällt weg, der Eintrag bleibt (lib/crm/person-weitere.ts kalenderBezugOhne).'),
  { muster: 'kalender-icloud', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Spiegel der iCloud-Objekte (auch Teilnehmer-Adressen Dritter) — Wahrheit ist iCloud, Löschung nur in Apple; der Abgleich holt den Spiegel alle 5 Minuten neu.' },
  // Kalender R-K1 #K5 (29.09.): tägliche Sicherung je Kalender. Der Bestand selbst trägt nur Dateinamen, Zeitpunkte,
  // Anzahlen und Fehlertexte; die .ics-Inhalte (Termine im Fenster −400 … +800 Tage, auch Teilnehmer-Adressen Dritter)
  // liegen VERSCHLÜSSELT im Archiv (`kalender-export-<kalender>-<tag>.json`, lib/store/archiv.ts) und fallen nach 14 Tagen
  // von selbst weg. Seit U1 H2 gehen sie NICHT ins Nachtarchiv (deploy/sicherung.sh schließt `archiv/kalender-export-*`
  // aus) — Art. 17 wirkt in Apple und ist spätestens nach 14 Tagen auch aus den Kalender-Sicherungen verschwunden
  // (die Hetzner-Abbilder des ganzen Servers halten 7 Tage).
  { muster: 'kalender-sicherung', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Stand der täglichen Kalender-Sicherung (nur Dateinamen/Zahlen); die verschlüsselten Tagesdateien im Archiv enthalten Termine (−400 … +800 Tage) samt Teilnehmern, gehen nicht ins Nachtarchiv und laufen nach 14 Tagen ab — Löschung in Apple, danach spätestens nach 14 Tagen auch in der Kalender-Sicherung (Hetzner-Abbilder: 7 Tage).' },
  T('meetings', 'Meeting-Protokolle — bleiben, Name/Adresse getilgt.'),
  T('zoe-verlauf', 'Gespräche mit ZOE — bleiben, die Person getilgt.', 'zoe-verlauf'),
  E('zoe-gedaechtnis', 'Fakten, die die Person nennen, raus.', 'zoe-gedaechtnis'),
  E('zoe-protokoll', 'Einträge, die die Person nennen, raus (seit 29.09. ohnehin nur Kennungen + Feldnamen).', 'zoe-arbeitslisten'),
  E('zoe-stapel', 'Vorschläge, die die Person nennen, raus (offene und entschiedene).', 'zoe-arbeitslisten'),
  T('zoe-entscheidungen--*', 'Dauerhafte Entscheidungen — bleiben (Rechenschaft), Fingerabdruck → c#geloescht, Name getilgt.', 'zoe-entscheidungen'),
  T('zoe-auftraege', 'Warteschlange der Läufe — Aufträge/Ergebnisse getilgt.'),
  T('zoe-empfang', 'Begrüßungstext der Stunde — getilgt.'),
  T('aenderungsprotokoll--*', 'Änderungsprotokoll — bleibt (nur Feldnamen), Fingerabdruck der Person → c#geloescht.', 'aenderungsprotokoll'),
  T('agent-log', 'Agenten-Log — Titel/Texte getilgt.'),
  T('client-fehler', 'Fehlermeldungen der Oberfläche — getilgt, falls sie die Person nennen.'),
  T('meldungen--*', 'Glocke je Person — Texte getilgt.'),
  // ── Paket D-C (29.09.) ──
  T('absichten--*', 'Absichtsprotokoll (lib/store/absichten.ts) — andere Absichten getilgt; die eigene Art.-17-Absicht behält Name/Adressen bis zum letzten Schritt, beim Abschluss werden die Daten geleert (fertige nach 30 Tagen weg).'),
  // ── Kalender (29.09., K4) ──
  E('buchung--*', 'Buchungsseiten + Terminbuchungen (Name, E-Mail, Firma, Anliegen, Einwilligungs-Nachweis): Buchungen der Person raus (person-weitere.ts); nicht bestätigte/abgelehnte/abgesagte/abgelaufene nach der Frist, bestätigte die Frist nach dem Termin (Löschfristen-Lauf). Im CRM bleiben Anfrage und Aktivität.', 'buchungen'),
  E('kennung-alias--*', 'Weiterleitung alter Kontakt-Kennungen (Kennungs-Umzug, lib/crm/kennung-alias.ts) — Zeilen der Person raus (aliasOhnePerson); ihre alten Kennungen bekommen vorher einen eigenen Grabstein.'),
  // ── Haushalt / Geschäft: bewusst ausgenommen ──
  { muster: 'finanzplan', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Rechnungen/Buchungen — Aufbewahrungspflicht § 147 AO / § 257 HGB (Kundenname auf der Rechnung bleibt).' },
  { muster: 'finanzen-plan--*', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Finanzplan des Haushalts — Rechnungen: Aufbewahrungspflicht § 147 AO / § 257 HGB.' },
  { muster: 'liquiplan', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Planposten/Zahlungen — Geschäftsunterlage, Aufbewahrungspflicht § 147 AO.' },
  { muster: 'buchungen', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Buchungen — Aufbewahrungspflicht § 147 AO / § 257 HGB.' },
  { muster: 'finance', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Controlling-Zahlen, Rechnungen — Aufbewahrungspflicht § 147 AO.' },
  { muster: 'grundlage', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Finanz-Export aus Malins Dashboard (Original, nur gelesen) — Buchführung, Aufbewahrungspflicht.' },
  K('business-abschluesse', 'Monatszahlen der Gesellschaften — keine Personen.'),
  // Familie & Partnerschaft (29.09., K2 — Name dynamisch `familie--<haushalt>`, der Scanner sieht ihn nicht; hier trotzdem
  // eingetragen): „Unsere Menschen“ tragen Name und Geburtstag Dritter — persönlich-familiär (Art. 2 Abs. 2 lit. c DSGVO),
  // gepflegt nur vom Haushalt, nie im CRM, nie in einem Agentenpaket außer dem eigenen ZOE-Kontext. Eine verknüpfte
  // CRM-Person (`kontaktId`) verliert bei Art. 17 nur die Verknüpfung (Kennung zeigt ins Leere, der Kalender zeigt dann
  // allein den Familien-Eintrag).
  H('familie--*', 'Familie des Haushalts (Paar, Rituale, Menschen mit Geburtstag) — eigene Daten des Haushalts.'),
  H('ernaehrung', 'Eigene Daten des Haushalts (Essen, Einkauf).'),
  H('ernaehrung-vorschlag', 'Essens-Vorschlag des Haushalts.'),
  // Seit 29.09. (K2) findet der Wächter auch Namen aus Konstanten, Namens-Funktionen und speicherFuer() — diese
  // Bestände standen schon im Code, fehlten aber hier:
  H('zeit', 'Zeit & Fokus (Kevin) — eigene Messung des Haushalts.'),
  H('zeit--*', 'Zeit & Fokus je Person — eigene Messung des Haushalts.'),
  H('fokus-laufend--*', 'Laufender Fokus-Block je Person.'),
  H('wochenplan--*', 'Alter Wochenplan je Person (bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('wochenplan-uebernahme', 'Stand der Übernahme alter Wochenplan-Blöcke in den Kalender (K5): nur Block-Kennung → Termin-UID, keine Titel.'),
  H('sport', 'Sport (Kevin) — eigene Gesundheitsdaten.'),
  H('sport--*', 'Sport je Person — eigene Gesundheitsdaten.'),
  H('vitals', 'Körperwerte (Kevin, Whoop) — eigene Gesundheitsdaten.'),
  H('vitals--*', 'Körperwerte je Person — eigene Gesundheitsdaten.'),
  H('haut', 'Haut-Tagebuch (Kevin) — eigene Gesundheitsdaten.'),
  H('haut--*', 'Haut-Tagebuch je Person — eigene Gesundheitsdaten.'),
  H('streak', 'Serien (Kevin) — eigene Daten.'),
  H('streak--*', 'Serien je Person — eigene Daten.'),
  H('health-log--*', 'Gesundheits-Log je Person — eigene Gesundheitsdaten.'),
  H('journal--*', 'Journal je Person — eigene Daten.'),
  H('steuern', 'Eigene Steuern des Haushalts (Einstellungen, Vorauszahlungen).'),
  H('haushalt-*--*', 'Haushaltsfinanzen (Konten, Buchungen, Rechnungen) — eigene Daten des Haushalts.'),
  H('haushalt-umzug--*', 'Umzugs-Kopie der Haushaltsfinanzen — eigene Daten des Haushalts.'),
  H('telegram', 'Telegram-Verknüpfung der Personen des Haushalts (Chat-Kennungen).'),
  H('anmeldungen', 'Anmeldungen der Konten des Haushalts (Zeit, Gerät) — Art. 17 über das Konto.'),
  H('content-entwuerfe', 'Eigene Marketing-Entwürfe (ZOE) — Themen und Texte des Haushalts, keine Kartei-Daten.'),
  H('delegation-runde', 'Delegations-Vorschläge an Personen des Haushalts (Aufgaben-Titel).'),
  { muster: 'anfragen-ergebnis', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Idempotenz-Ablage (lib/store/anfragen.ts): Antworten höchstens 24 h, danach automatisch weg — kein eigener Löschlauf nötig.' },
  H('gesundheit-takt', 'Eigene Gesundheitsdaten des Haushalts.'),
  H('gesundheitszeit', 'Eigene Gesundheitsdaten des Haushalts.'),
  H('health-log', 'Eigene Gesundheitsdaten des Haushalts.'),
  H('journal', 'Eigenes Journal des Haushalts.'),
  H('routinen', 'Eigene Routinen des Haushalts.'),
  H('ziele', 'Eigene Ziele/Fokus des Haushalts.'),
  H('meilensteine', 'Eigene Meilensteine des Haushalts.'),
  H('kompass', 'Eigener Kompass des Haushalts.'),
  H('wochenplan', 'Alter Wochenplan (Kevin, bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('anwesenheit', 'Wer vom Haushalt gerade online ist.'),
  H('nutzung', 'Nutzung der Oberfläche durch den Haushalt (Zähler).'),
  H('aenderungen', 'Altes Browser-Änderungsprotokoll (nur Person des Haushalts, Bestand, Seite) — nur gelesen.'),
  H('arbeitsmodus', 'Arbeitsmodus des Haushalts.'),
  H('arbeitsplatz', 'Arbeitsplatz-Einstellungen des Haushalts.'),
  H('konten', 'Konten der Nutzer — Art. 17 über das Konto.'),
  H('team--*', 'Team des Haushalts (Rollen/Namen der Mitglieder).'),
  H('oauth-tokens', 'Zugangsschlüssel des Haushalts (Whoop/Microsoft) — keine Dritten.'),
  H('oauth-states', 'Kurzlebige OAuth-Zustände — keine Dritten.'),
  H('ki-verbrauch', 'Kosten der Modellaufrufe je Person des Haushalts.'),
  K('backlog', 'Bauplan der Software (Ideen/Etappen) — keine Kontakte.'),
  K('bauzeit', 'Bauzeiten der Software.'),
  K('agents-config', 'Agenten-Schalter.'),
  K('brain-konsolidierung', 'Riegel der Brain-Konsolidierung.'),
  K('crm-loeschfristen', 'Fristen und Tagesmarke — keine Kennungen.'),
  K('dashboard', 'Anordnung der Startfläche.'),
  K('filter', 'Gespeicherte Filter.'),
  K('fokus-regler', 'Regler-Stand.'),
  K('hoi-meldung', 'Riegel des Head of IT.'),
  K('hoi-durchsicht', 'Nächtliche Durchsicht der Bestände (lib/store/durchsicht.ts) — nur Zähler je Bestand.'),
  K('inbox-status', 'Gelesen/erledigt je Mail-Kennung — keine Inhalte, keine Adressen.'),
  K('kalender-einstellungen', 'Kalender-Einstellungen.'),
  K('labels', 'Beschriftungen.'),
  K('onboarding', 'Einrichtungs-Haken.'),
  K('ordnung', 'Sortierung/Ordnung von Listen.'),
  K('performance', 'Wachstums-Score (Zahlen).'),
  K('planung-einheiten--*', 'Einheiten der Planung je Haushalt.'),
  K('spaces', 'Space-Einstellungen.'),
  K('tageslauf', 'Riegel des Tageslaufs.'),
  K('tagesstart', 'Riegel des Morgenlaufs.'),
  K('willkommen', 'Willkommens-Hinweise.'),
  K('gesellschaften--*', 'Die eigenen Gesellschaften des Haushalts (Firmendaten, Nummernkreise).'),
  K('traktion-verlauf', 'Markttraktion-Kennzahlen je Tag (nur Zahlen).'),
  K('finanzchef-einstellung', 'Einstellungen des Finanzchefs.'),
  K('performance--*', 'Wachstums-Score je Person (Zahlen).'),
  K('flaeche', 'Anordnung der Flächen (Kevin).'),
  K('flaeche--*', 'Anordnung der Flächen je Person.'),
  K('hoi-aussen', 'Außenprüfung des Head of IT (Zeiten, Status).'),
  K('hoi-csp', 'CSP-Meldungen des Browsers (Adressen der App, keine Personen).'),
  K('ki-stand', 'Stand der Modell-Anbindung (Guthaben, Fehlerzeit).'),
  K('brain-bruecke--*', 'Einstellung der App → Brain-Brücke je Haushalt.'),
  K('brain-app-spiegel', 'Riegel des _App-Spiegels (Tag + Stände).'),
  K('business-einstellungen', 'Einstellungen des Business-Index.'),
  K('business-verlauf', 'Verlauf des Business-Index (Zahlen).'),
  K('zoe-chargen--*', 'ZOE-Chargen: nur Kennungen von Aufgaben/Vorschlägen und Feldstände, keine Texte.'),
  K('aufgaben-dateien--*', 'Aufgaben-Ablage (Dateien zu Aufgaben, lib/dateien/aufgaben-ablage.ts) — Kontakt-Dateien liegen in crm-dateien--*.'),
  K('datenschutz-grabsteine', 'Marke „Grabsteine zuletzt angewendet“ (Fingerabdruck der Grabstein-Datei, Zahl).'),
  K('datenschutz-migration', 'Marke der Umrechnung v1 → v2 je Pepper (nur Zahlen).'),
];

/** Dynamische Namen im Code, deren Präfix aus einer Konstante kommt (`${KONSTANTE}${…}` → „**“) — mit ihrem Muster. */
export const DYNAMISCHE_NAMEN: Readonly<Record<string, { datei: string; muster: string }>> = {
  '**': { datei: 'lib/crm/verbindungen-laden.ts', muster: 'aufgaben-dateien--*' },
};

const alsRegex = (muster: string) => new RegExp(`^${muster.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

/** Der Register-Eintrag für einen Bestandsnamen (auch ein Code-Muster wie `heads-replay-*`) — oder null. */
export function registerEintrag(name: string): SpeicherEintrag | null {
  return SPEICHER_REGISTER.find(e => e.muster === name || alsRegex(e.muster).test(name)) ?? null;
}
