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
// Seit der DSGVO-Prüfung 04.10. (Teil 2) zusätzlich — für JEDEN neuen Speicher mit Personenbezug Pflicht (Wächter: die Zahl der
// Altbestände ohne diese Angaben darf nur sinken, tests/datenschutz-register.test.ts):
//   rechtsgrundlage  Art. 6 (und Art. 9 Abs. 2 bei besonderen Kategorien), ggf. BDSG/HGB
//   art15            wo die Person ihre Daten bekommt (Auskunft/Export)
//   loeschfrist      Frist als Satz (zusätzlich zu `frist` = Kennung einer einstellbaren Löschfrist)
//   kategorie        'art9' (Gesundheit), 'beschaeftigte' (Arbeitszeit/Urlaub, § 26 BDSG), 'vertraulich' (Geschäftsgeheimnisse, Cap-Table)
// Der Zweck steht wie bisher in `grund`.
// Rein, ohne Abhängigkeiten — der Test und die Doku lesen es direkt.

export type Bezug = 'dritte' | 'haushalt' | 'kein';
export type Behandlung = 'entfernen' | 'tilgen' | 'pseudonym' | 'ausgenommen';
export type Kategorie = 'art9' | 'beschaeftigte' | 'vertraulich';
export interface Angaben { rechtsgrundlage: string; art15: string; loeschfrist: string; kategorie?: Kategorie[] }
export interface SpeicherEintrag extends Partial<Angaben> { muster: string; bezug: Bezug; behandlung: Behandlung; grund: string; frist?: string }
/** Einen Eintrag um die Pflicht-Angaben ergänzen (neue Speicher, besondere Kategorien). */
const mit = (e: SpeicherEintrag, a: Angaben): SpeicherEintrag => ({ ...e, ...a });
/** Gesundheitsdaten der Person selbst (Art. 9): Grundlage und Wege — eine Formulierung für alle Gesundheits-Bestände. */
const GESUNDHEIT: Angaben = {
  rechtsgrundlage: 'Art. 9 Abs. 2 lit. a DSGVO — ausdrückliche Einwilligung der Person, getrennt je Zweck (05.10., `gesundheit-einwilligungen`): (a) verarbeiten, (b) an die KI, (c) mit dem Partner teilen inkl. dessen ZOE; an andere Konten nur über „Teilen“ (Konto › teilt.gesundheit), an ZOE/KI-Läufe nur mit (b), an die ZOE des Partners nur mit (b)+(c)',
  art15: 'die Person sieht und exportiert ihre Werte selbst (Gesundheit); andere Konten sehen sie nur bei „Teilen“',
  loeschfrist: 'bis die Person sie löscht bzw. ihr Konto entfernt wird',
  kategorie: ['art9'],
};

const E = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'entfernen', grund, ...(frist ? { frist } : {}) });
const T = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'tilgen', grund, ...(frist ? { frist } : {}) });
const H = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'haushalt', behandlung: 'ausgenommen', grund });
const K = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'kein', behandlung: 'ausgenommen', grund });
/** Spiegel einer Apple-Quelle mit Dritten: ausgenommen — Löschung nur in Apple (der Löschlauf meldet, wo). */
const A = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'ausgenommen', grund, ...(frist ? { frist } : {}) });

export const SPEICHER_REGISTER: readonly SpeicherEintrag[] = [
  // ── CRM-Kern (lib/crm/person-bestaende.ts) ──
  E('kontakte', 'Die Kartei — Eintrag raus (personEntfernen), mit allen Feldern inkl. Geburtstag (K2, 29.09.).', 'kontakte'),
  E('crm', 'Kennung raus (person-verweise.ts) — auch aus den Zielpersonen besuchter Events (Event.zielpersonen, 03.10.) und aus dem Übergabe-Protokoll (Event.uebergaben[].kontaktIds, netz-recht); voller Name in Deal-Titeln/Kundennamen → „[gelöscht]“.'),
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
  { muster: 'crm-loeschprotokoll', bezug: 'dritte', behandlung: 'pseudonym', frist: 'loeschprotokoll', grund: 'Nur Protokoll-ID `lp-…`, Tag, Grund, wer — nie die Kennung (lib/crm/loeschprotokoll.ts); abgeschlossene Einträge nach 36 Monaten weg (Frist „loeschprotokoll“, 05.10.).' },
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
  // Google Kalender (03.10.2026): ein Spiegel je Person — Wahrheit ist Google, Löschung nur dort (wie die Apple-Spiegel; der Löschlauf zählt die Termine, die die Person nennen).
  A('kalender-google--*', 'Spiegel des Google Kalenders je Person (Termine, Teilnehmer-Adressen Dritter) — Wahrheit ist Google, Löschung nur dort; der Abgleich holt ihn neu, der Löschlauf meldet die Termine, die die Person nennen (person-weitere.ts).', 'kalender-caches'),
  // Gmail in der Inbox (03.10.2026): Spiegel je Person — Nachrichten, die die Person nennen, raus (Art. 17), das Original bleibt in Gmail (der Löschlauf zählt es als „dort löschen“).
  E('gmail-stand--*', 'Gmail-Spiegel je Person (Köpfe: Absender, Empfänger, Betreff, Ausschnitt, Labels, Anhang-Metadaten) — Nachrichten, die die Person nennen, raus (person-weitere.ts); das Original bleibt in Gmail (Hinweis „dort löschen“); Aufbewahrung: Frist Mail-Spiegel (180 Tage).', 'mail-spiegel'),
  E('gmail-text--*', 'Gmail-Spiegel je Person (Textkörper, nur Text) — Texte, die die Person nennen (Adresse oder Name), raus; Aufbewahrung wie der Spiegel.', 'mail-spiegel'),
  // Inbox 2 (06.10.2026): Postfächer je Person über IMAP/SMTP (iCloud, IONOS, beliebige Anbieter) — Register, Zugang, Spiegel, Inbox-Zustand.
  mit(E('imap-stand--*', 'IMAP-Spiegel je Person × Postfach (Köpfe: Absender, Empfänger, Betreff, Ausschnitt, Anhang-Metadaten, Ordner/UID) — Nachrichten, die die Person nennen, raus (person-weitere.ts); das Original bleibt beim Anbieter (Hinweis „dort löschen“).', 'mail-spiegel'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Korrespondenz lesen, ordnen und beantworten (Geschäftspostfächer zusätzlich lit. b: Anbahnung/Vertrag)',
    art15: 'Kontakt: Auskunft nennt die gespiegelten Nachrichten (Kopf, Betreff); Konto: Konto › Meine Daten exportiert den eigenen Spiegel',
    loeschfrist: 'Frist „Mail-Spiegel“ (Standard 180 Tage) und höchstens 1.500 Nachrichten je Postfach; „Trennen“ löscht sofort',
  }),
  mit(E('imap-text--*', 'IMAP-Spiegel je Person (Textkörper, nur Text, nie HTML/Anhänge) — Texte, die die Person nennen, raus; Aufbewahrung wie der Spiegel.', 'mail-spiegel'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Korrespondenz lesen und beantworten',
    art15: 'wie imap-stand (Kontakt-Auskunft bzw. Konto-Export)',
    loeschfrist: 'wie imap-stand',
  }),
  mit(H('postfaecher--*', 'Postfach-Register je Person (Anbieter, Server, Anmeldename, Adresse, Bereich, Absendername, Signatur) — keine Dritten, keine Passwörter.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Nutzung der Software durch die Kontoperson',
    art15: 'die Person sieht und ändert es unter Inbox › Postfächer; Konto › Meine Daten exportiert es',
    loeschfrist: 'bis die Person das Postfach trennt bzw. ihr Konto löscht',
  }),
  mit(H('postfach-zugang--*', 'Zugangsdaten der Postfächer je Person (App-/Postfach-Passwörter) — verschlüsselt, nur serverseitig, nie in einer Antwort, nie im Export, nie im Protokoll.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — von der Person selbst hinterlegt, um ihr Postfach abzuholen',
    art15: 'nur der Hinweis, DASS ein Zugang hinterlegt ist (Inbox › Postfächer) — das Passwort selbst wird nie ausgegeben',
    loeschfrist: '„Trennen“ bzw. Konto löschen entfernt es sofort',
    kategorie: ['vertraulich'],
  }),
  mit(T('inbox-zustand--*', 'Inbox-Zustand je Person: Wiedervorlagen und „erledigt bis“ je Gespräch (nur Kennungen), bestätigte Zuordnung (Kontakt-Kennung), Screener-Entscheidungen je Absender-Adresse — Adresse der Person fällt weg, Kennungen werden getilgt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Post ordnen (Screener, Wiedervorlage)',
    art15: 'Kontakt: Auskunft nennt Screener-Entscheidung und Zuordnung; Konto: Konto › Meine Daten',
    loeschfrist: 'mit dem Konto bzw. „Trennen“ (Gespräche dieses Postfachs); Absender-Entscheidungen bis die Person sie zurücknimmt',
  }),
  A('kalender-umzug-sicherung--*', 'Sicherung der iCloud-Texte beim Umzug Business → Google (Notizen können Dritte nennen) — verschlüsselt, 30 Tage, dann räumt der Takt sie weg (lib/kalender/google/umzug.ts); Wahrheit ist der Termin in Google.', 'kalender-caches'),
  // Verbindung zu Google (03.10.): Token-Bestand und Anmelde-Zustand — gehören der Person des Haushalts, keine Dritten.
  H('google-verbindung--*', 'Google-Verbindung je Person (Adresse des Google-Kontos, verschlüsselte Token) — nur serverseitig, Trennen widerruft bei Google und löscht den Inhalt; Art. 17 über das Konto.'),
  K('google-oauth-zustand', 'Kurzlebiger Anmelde-Zustand der Google-Verbindung (state-Hash, PKCE-Verifier, 15 Minuten) — keine Personendaten.'),
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
  // Archivkopien vor Umzügen (03.10.): `archiv/crm-vor-*.json` — auch die Sicherung vor „Firmen zusammenführen“
  // (`crm-vor-firmen-zusammenfuehren-<zeit>.json`, lib/crm/firma-umhaengen-server.ts) — liegen VERSCHLÜSSELT im Archiv, sind keine
  // Bestände im Sinne dieses Registers (eigener Archiv-Ordner), fallen nach 30 Tagen von selbst weg (Löschfrist „archiv-umzug“,
  // lib/crm/loeschfristen-lauf.ts) und Art. 17 nimmt die Person auch daraus heraus (lib/crm/person-weitere.ts `archivTilgen`).
  // Getestet: tests/firma-archiv.test.ts (Sicherung vor dem ersten Schritt, 30 Tage, Art. 17), tests/datenschutz-art17-weitere.test.ts.
  { muster: 'kalender-sicherung', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Stand der täglichen Kalender-Sicherung (nur Dateinamen/Zahlen); die verschlüsselten Tagesdateien im Archiv enthalten Termine (−400 … +800 Tage) samt Teilnehmern, gehen nicht ins Nachtarchiv und laufen nach 14 Tagen ab — Löschung in Apple, danach spätestens nach 14 Tagen auch in der Kalender-Sicherung (Hetzner-Abbilder: 7 Tage).' },
  T('meetings', 'Meeting-Protokolle — bleiben, Name/Adresse getilgt.'),
  T('zoe-verlauf', 'Gespräche mit ZOE — bleiben, die Person getilgt.', 'zoe-verlauf'),
  E('zoe-gedaechtnis', 'Fakten, die die Person nennen, raus.', 'zoe-gedaechtnis'),
  E('zoe-protokoll', 'Einträge, die die Person nennen, raus (seit 29.09. ohnehin nur Kennungen + Feldnamen).', 'zoe-arbeitslisten'),
  E('zoe-stapel', 'Vorschläge, die die Person nennen, raus (offene und entschiedene).', 'zoe-arbeitslisten'),
  T('zoe-entscheidungen--*', 'Dauerhafte Entscheidungen — bleiben (Rechenschaft), Fingerabdruck → c#geloescht, Name getilgt.', 'zoe-entscheidungen'),
  T('zoe-auftraege', 'Warteschlange der Läufe — Aufträge/Ergebnisse getilgt.'),
  T('zoe-empfang', 'Begrüßungstext der Stunde — getilgt.'),
  T('aenderungsprotokoll--*', 'Änderungsprotokoll — bleibt (nur Feldnamen), Fingerabdruck der Person → c#geloescht. Seit 05.10. mit Hash-Kette und Siegel (lib/store/protokoll-kette.ts).', 'aenderungsprotokoll'),
  // Lese-Protokoll (05.10., lib/store/leseprotokoll.ts): wer Gesundheit/Erholung, Finanzen, Kontakt-/Firmenakten und das
  // Gesellschafts-Register gelesen hat — nur Metadaten, Kennungen als Fingerabdruck, mit Hash-Kette.
  mit(T('leseprotokoll--*', 'Lese-Protokoll je Haushalt und Monat — wer (Konto/ZOE/System), wann, welcher Bereich, wessen Daten (Konto), Umfang und Kennungen nur als Fingerabdruck; nie Inhalte. Art. 17: Fingerabdruck der Person → c#geloescht, der Zugriff bleibt belegt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c i. V. m. Art. 5 Abs. 2 und Art. 32 Abs. 1 lit. b/d DSGVO (Nachweis- und Sicherheitspflicht: Zugriffe auf besonders schutzwürdige Daten nachvollziehbar)',
    art15: 'Konten: System › Nachweise (Inhaber) bzw. auf Anfrage beim Inhaber; Kontakte: Fingerabdrücke über die Auskunft auflösbar',
    loeschfrist: '12 Monate (ältere Monate leert die nächtliche Durchsicht, Vermerk mit Anzahl bleibt), in Sicherungen bis zu 12 Monate länger',
  }),
  T('agent-log', 'Agenten-Log — Titel/Texte getilgt.'),
  T('client-fehler', 'Fehlermeldungen der Oberfläche — getilgt, falls sie die Person nennen.'),
  T('meldungen--*', 'Glocke je Person — Texte getilgt.'),
  // ── Paket D-C (29.09.) ──
  T('absichten--*', 'Absichtsprotokoll (lib/store/absichten.ts) — andere Absichten getilgt; die eigene Art.-17-Absicht behält Name/Adressen bis zum letzten Schritt, beim Abschluss werden die Daten geleert (fertige nach 30 Tagen weg).'),
  // ── Kalender (29.09., K4) ──
  E('buchung--*', 'Buchungsseiten + Terminbuchungen (Name, E-Mail, Firma, Anliegen, Einwilligungs-Nachweis): Buchungen der Person raus (person-weitere.ts); nicht bestätigte/abgelehnte/abgesagte/abgelaufene nach der Frist, bestätigte die Frist nach dem Termin (Löschfristen-Lauf). Im CRM bleiben Anfrage und Aktivität.', 'buchungen'),
  E('kennung-alias--*', 'Weiterleitung alter Kontakt-Kennungen (Kennungs-Umzug, lib/crm/kennung-alias.ts) — Zeilen der Person raus (aliasOhnePerson); ihre alten Kennungen bekommen vorher einen eigenen Grabstein.'),
  // ── Netzwerken (02.10., Erfassen) ──
  K('netzwerken-erfassungen--*', 'Journal der Netzwerken-Erfassungen (lib/crm/netzwerken-server.ts): nur Zufalls-Kennung, abgehakte Schrittnamen, Zeiten — bis zum Abschluss dazu die Kennung der Person bzw. des Termins, beim Abschluss geleert (nie fertig gewordene nach 60 Tagen weg); keine Namen, Adressen oder Texte. Fotos/Sprachnotizen liegen in `crm-dateien--*`, Teilnahme und Info in `crm`, Verlauf in `kontakte` — dort greift Art. 17.'),
  // Übergabe-Journal (03.10., netz-recht): Nachweis der Übermittlungen an Kunden nach dem Löschen eines Events (Art. 5 Abs. 2, 15, 19).
  // Gesellschafts-Register (04.10.): eigene Gesellschaften; Gesellschafter, Vertragsparteien und Beteiligungen können CRM-Kontakte/-Firmen
  // NUR per Kennung nennen — Art. 17 tilgt die Kennung der Person („[gelöscht]“), Cap-Table und Vertrag bleiben (eigene Geschäftsunterlagen).
  mit(T('gesellschaften--*', 'Gesellschafts-Register des Haushalts (lib/gesellschaften): Firmendaten, Nummernkreise, Steckbrief, Gesellschafter, Organe, Beschlüsse, Beteiligungen, Verträge, Vermerke endgültig gelöschter Gesellschaften/Verträge (`geloescht`: Kennung, Name/Titel, Tag, Datei-Kennungen — damit der Bezug der aufbewahrten Unterlagen lesbar bleibt) — Dritte nur als Kontakt-/Firmen-Kennung; deren Kennung wird getilgt (auch in Papierkorb/Archiv/Vermerken), der Eintrag bleibt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Gesellschafterliste § 40 GmbHG, Aufbewahrung § 257 HGB / § 147 AO), lit. b (Verträge mit der Person), lit. f (Führung der eigenen Gesellschaften)',
    art15: 'Auskunft der Kontaktakte (GET /api/crm/datenschutz › gesellschaften: Gesellschafter, Organ, Vertragspartei — auch Papierkorb/Archiv, lib/gesellschaften/auskunft.ts)',
    loeschfrist: 'Papierkorb 30 Tage (Morgenlauf); sonst bis zur Löschung durch den Haushalt — Verträge/Beschlüsse als Geschäftsunterlagen 6 bzw. 10 Jahre (§ 257 HGB); Unterlagen in crm-dateien--* bleiben auch nach dem endgültigen Löschen einer Gesellschaft bzw. eines Vertrags (Aufbewahrungspflicht, Rückfrage mit Link „ansehen“)',
    kategorie: ['vertraulich'],
  }),
  T('uebergabe-journal--*', 'Übergaben an Kunden (lib/crm/uebergabe-journal.ts): Event, Empfänger, Tag, Anzahl, Dateiname, Kennungen der Personen — keine Namen/Mails/Inhalte. Die Kennung der gelöschten Person wird getilgt, der Nachweis bleibt; 36 Monate, dann weg (Löschfristen-Lauf).', 'uebergabe-protokolle'),
  K('events-geloescht', 'Kennungen gelöschter Events + Tag der Löschung, 90 Tage (lib/crm/events-geloescht.ts, Praxis-Prüfung M2): verhindert, dass eine wartende Erfassung ein bewusst gelöschtes Event neu anlegt. Nur Kennung und Tag — kein Titel, keine Personen; räumt sich beim Schreiben selbst auf.'),
  // Netzwerken — BROWSER-Speicher (kein Bestand, vom Wächter nicht gescannt, hier der Vollständigkeit halber, 03.10.):
  //   IndexedDB `make-os-netzwerken` (Speicher `warteschlange`) = die Offline-Warteschlange der Erfassungen (lib/netzwerken/warteschlange.ts).
  //   Sie trägt bis zum erfolgreichen Senden den GANZEN Körper der Erfassung — Daten Dritter (Name, Firma, Mail, Telefon, Foto der
  //   Visitenkarte als Base64, Sprachnotiz). Seit dem 03.10. (netz-recht) liegt dieser Körper dort NUR VERSCHLÜSSELT: AES-GCM mit einem NICHT
  //   exportierbaren WebCrypto-Schlüssel, der selbst in IndexedDB (Speicher `schluessel`) steckt — wer die Datenbank kopiert, hat ohne den Browser
  //   nichts; ohne WebCrypto (kein sicherer Kontext) geht die Erfassung in den Arbeitsspeicher, nie unverschlüsselt auf die Platte. Je Erfassung
  //   wird sie gelöscht, sobald der Server sie gespeichert hat (Art. 5 Abs. 1 lit. e: kein Vorrat); ab 14 Tagen warnt die Oberfläche („senden oder
  //   verwerfen“), nach 30 Tagen wird sie AUTOMATISCH verworfen (mit Anzeige); der Server nimmt Zeitpunkte nur bis 14 Tage zurück
  //   (`ERFASSUNG_ALTER_TAGE`). ABMELDEN räumt: warten noch Erfassungen, fragt es zuerst, ob gesendet werden soll; „trotzdem abmelden“ LÖSCHT
  //   sie samt Datenbank und Schlüssel vom Gerät (klare Warnung) — nur die Erfassung einer anderen Person auf demselben Gerät bleibt für sie
  //   liegen. Fällt IndexedDB aus (privates Fenster, Speicher voll), liegt die Erfassung nur im Arbeitsspeicher der Seite (`ausfallsicher`) und
  //   verschwindet beim Schließen — die Oberfläche sagt dann „Bitte Seite offen lassen, bis gesendet“. Auf der Server-Seite gilt für das, was
  //   ankommt, `crm`/`crm-dateien--*` (oben) und Art. 17 wie für jede Person der Kartei.
  //   localStorage `make-os-netzwerken-*` hält nur Merker (Event-Wahl, „wer bin ich“, Zähler, Hinweis „nach 30 Tagen verworfen“ mit Name/Datum der
  //   verworfenen Erfassung) — die Merker räumt das Abmelden; `make-karten-cache` ist das Offline-Abbild der EIGENEN Visitenkarten.
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
  // Netzwerken (02.10., Paket B): die EIGENEN Visitenkarten je Person — Name, Rolle, Firma, Erreichbarkeit, die die Person
  // selbst eintippt und freiwillig weitergibt (QR/vCard). Keine Daten Dritter. Art. 15: Auskunft über das Konto, die Person
  // sieht und exportiert alles selbst (Netzwerken › Meine Visitenkarte, „vCard teilen“). Art. 17: jedes Profil einzeln
  // löschbar (löscht im Bestand, kein Zweitspeicher); beim Entfernen des Kontos fällt der ganze Bestand `visitenkarten--<person>`
  // mit. Im Browser liegt nur ein Offline-Abbild (localStorage `make-karten-cache`) — das Abmelden räumt es weg. Das
  // Änderungsprotokoll nennt Kennung + Feldnamen, nie Werte.
  H('visitenkarten--*', 'Eigene Visitenkarten je Person (Netzwerken) — eigene Daten der Person, nie Dritte; Art. 17 = Profil löschen bzw. Konto entfernen.'),
  H('ernaehrung', 'Eigene Daten des Haushalts (Essen, Einkauf); Fotos zu Gerichten liegen seit 05.10. verschlüsselt unter bilder-gerichte/ (lib/store/bild-ablage.ts).'),
  H('ernaehrung-vorschlag', 'Essens-Vorschlag des Haushalts.'),
  // Seit 29.09. (K2) findet der Wächter auch Namen aus Konstanten, Namens-Funktionen und speicherFuer() — diese
  // Bestände standen schon im Code, fehlten aber hier:
  H('zeit', 'Zeit & Fokus (Kevin) — eigene Messung des Haushalts.'),
  H('zeit--*', 'Zeit & Fokus je Person — eigene Messung des Haushalts.'),
  H('fokus-laufend--*', 'Laufender Fokus-Block je Person.'),
  H('wochenplan--*', 'Alter Wochenplan je Person (bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('wochenplan-uebernahme', 'Stand der Übernahme alter Wochenplan-Blöcke in den Kalender (K5): nur Block-Kennung → Termin-UID, keine Titel.'),
  mit(H('sport', 'Sport (Kevin) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('sport--*', 'Sport je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('vitals', 'Körperwerte (Kevin, Whoop) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  // Kapazität (04.10.) liest daraus NUR den Ø-Recovery-Wert, NUR mit eigener Einwilligung der Person und wenn sie mit allen Konten teilt, und nur als
  // Team-Faktor (lib/kapazitaet/server.ts); nie in Business-Index, ZOE oder Protokolle (`ohneGesundheit`, Test kapazitaet-route).
  mit(H('vitals--*', 'Körperwerte je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('haut', 'Haut-Tagebuch (Kevin) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('haut--*', 'Haut-Tagebuch je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  H('streak', 'Serien (Kevin) — eigene Daten.'),
  H('streak--*', 'Serien je Person — eigene Daten.'),
  mit(H('health-log--*', 'Gesundheits-Log je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  H('journal--*', 'Journal je Person — eigene Daten.'),
  H('steuern', 'Eigene Steuern des Haushalts (Einstellungen, Vorauszahlungen).'),
  H('haushalt-*--*', 'Haushaltsfinanzen (Konten, Buchungen, Rechnungen) — eigene Daten des Haushalts.'),
  H('haushalt-umzug--*', 'Umzugs-Kopie der Haushaltsfinanzen — eigene Daten des Haushalts.'),
  H('telegram', 'Telegram-Verknüpfung der Personen des Haushalts (Chat-Kennungen).'),
  // Betroffenenrechte v2 (05.10.): mit Frist und Angaben — 12 Monate (FRIST_MONATE, lib/zugang/anmeldungen.ts), nicht mehr „300 Einträge“.
  mit(H('anmeldungen', 'Anmeldungen der Konten (Zeit, Art, ok, gekürzte Netzadresse; bei Änderungen der Anmelde-Adressen die betroffene Adresse nur maskiert; seit 05.10. auch Datenexport, Konto löschen, Instanz-Export) — mit Hash-Kette (rollend).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Schutz der Konten vor Missbrauch) i. V. m. Art. 32 Abs. 1 lit. b, Art. 5 Abs. 2',
    art15: 'Konto › Meine Daten (Export `protokolle.anmeldungen`, GET /api/konto/daten); die letzten Anmeldungen zeigt Konto › Name & Passwort',
    loeschfrist: '12 Monate (rollend bei jedem neuen Eintrag, Notbremse 50 000); Konto gelöscht: die Einträge bleiben als Nachweis, die Kennung der Person wird „[gelöscht]“',
  }),
  H('content-entwuerfe', 'Eigene Marketing-Entwürfe (ZOE) — Themen und Texte des Haushalts, keine Kartei-Daten.'),
  H('delegation-runde', 'Delegations-Vorschläge an Personen des Haushalts (Aufgaben-Titel).'),
  { muster: 'anfragen-ergebnis', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Idempotenz-Ablage (lib/store/anfragen.ts): Antworten höchstens 24 h, danach automatisch weg — kein eigener Löschlauf nötig.' },
  mit(H('gesundheit-takt', 'Eigene Gesundheitsdaten des Haushalts.'), GESUNDHEIT),
  mit(H('gesundheitszeit', 'Eigene Gesundheitsdaten des Haushalts.'), GESUNDHEIT),
  mit(H('health-log', 'Eigene Gesundheitsdaten des Haushalts.'), GESUNDHEIT),
  H('journal', 'Eigenes Journal des Haushalts.'),
  H('routinen', 'Eigene Routinen des Haushalts.'),
  H('ziele', 'Eigene Ziele/Fokus des Haushalts.'),
  H('ziele-eigen', 'Persönliche Ziele der ersten Person (Altname ohne Suffix) — eigene Planung, keine Dritten (gelesen u. a. von den Lichtfäden).'),
  H('ziele-eigen--*', 'Persönliche Ziele je Person — eigene Planung, keine Dritten.'),
  H('meilensteine', 'Eigene Meilensteine des Haushalts.'),
  // Austausch am Meilenstein (30.09.): Verlauf, Notiz, Links — Texte können Dritte nennen (Kunden, Partner) → getilgt.
  T('meilenstein-raum--*', 'Verlauf/Notiz/Links je Meilenstein — bleiben, Namen/Adressen der Person getilgt (lib/crm/person-weitere.ts).'),
  H('kompass', 'Eigener Kompass des Haushalts.'),
  H('wochenplan', 'Alter Wochenplan (Kevin, bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('anwesenheit', 'Wer vom Haushalt gerade online ist.'),
  H('nutzung', 'Nutzung der Oberfläche durch den Haushalt (Zähler).'),
  H('aenderungen', 'Altes Browser-Änderungsprotokoll (nur Person des Haushalts, Bestand, Seite) — nur gelesen.'),
  H('arbeitsmodus', 'Arbeitsmodus des Haushalts.'),
  H('arbeitsplatz', 'Arbeitsplatz-Einstellungen des Haushalts.'),
  mit(H('konten', 'Konten der Nutzer (Name, Hauptadresse und bis zu drei weitere Anmelde-Adressen, Passwort-Hash, zweiter Faktor) — Art. 15: die Person sieht ihre Adressen unter System › Konto › Anmelde-Adressen, Art. 16/17 über das Konto (Adressen selbst ändern bzw. entfernen).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der Anwendung) bzw. § 26 BDSG für Beschäftigte; lit. f (Sicherheit)',
    art15: 'Konto › Meine Daten: Auskunft (HTML), „Meine Daten herunterladen“ (JSON, alle Bestände laut Register — lib/datenschutz/konto-daten.ts); nie Hash, Salz, zweiter Faktor',
    loeschfrist: 'bis die Person „Mein Konto löschen“ wählt (Konto › Meine Daten; Inhaber erst ohne andere Konten) bzw. die Instanz endet (scripts/instanz-loeschen.mjs); Grabstein (nur Fingerabdruck der Konto-Kennung) 13 Monate',
  }),
  H('team--*', 'Team des Haushalts (Rollen/Namen der Mitglieder; `deaktiviertAm` = Beginn der 30-Tage-Frist für die Kapazitätsdaten, setzt nur der Server).'),
  mit(H('kapazitaet--*', 'Kapazität je Haushalt (04.10.): Grundwert und Ausnahmen (Urlaub, feste Blöcke) je Team-Person, Zuweisungen Person × Mandat/Kunde (nur CRM-Kennungen, keine Namen Dritter) — eigene Planung des Haushalts. Gespeichert wird KEIN Gesundheitswert (die Erholung wird beim Rechnen aus vitals--* gelesen, nur mit Einwilligung + Teilen, nur als Team-Faktor); `erholungAm` = Zeitpunkt der Einwilligung (Nachweis).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Planung der Arbeitszeit im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (realistische Planung); Erholung: Art. 9 Abs. 2 lit. a — eigene Einwilligung der Person (`erholungAm`, Schalter in der Kapazität, Vorgabe aus) UND Teilen mit allen Konten (siehe vitals--*)',
    art15: 'GET /api/kapazitaet zeigt der Person ihre Werte samt eigener Ausnahme-Titel; als Datei GET /api/kapazitaet?auskunft=<person> (Konto: nur die Person selbst; Team-Person ohne Konto: der Inhaber, auch deaktiviert) und in der Kontakt-Auskunft (`personAufzaehlen.kapazitaet`, Zuordnung über die E-Mail der Team-Person) — lib/kapazitaet/aufraeumen.ts',
    loeschfrist: 'Ausnahmen/Zuweisungen bis zur Löschung durch Person bzw. Inhaber (Planung › Kapazität); Team-Person ohne Konto: 30 Tage nach dem Deaktivieren automatisch (Morgenlauf `kapaDeaktivierteAufraeumen`, Zeitpunkt `deaktiviertAm` am Team-Eintrag, Reaktivieren davor erhält alles); Konto entfernt: beim nächsten Morgenlauf (`kapaEntfernteKontenAufraeumen`, 05.10.)',
    kategorie: ['beschaeftigte'],
  }),
  mit(H('kapazitaet-plan--*', 'Festgehaltene Wochenpläne je Haushalt (Kevin 05.10.): montags je Person verfügbare Zeit (Netto, OHNE Erholungs-Faktor), geplante Stunden und gebundene Stunden, je Meilenstein/Ziel und Zuweisung nur als Kennung — Grundlage der Plan-Treue „geplant vs. Ist“ (lib/kapazitaet/plan.ts). Kein Gesundheitswert, keine Namen.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Arbeitszeitplanung im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (Vergleich Plan gegen Umsetzung)',
    art15: 'in der Kapazitäts-Auskunft `wochenplaene` (GET /api/kapazitaet?auskunft=<person>, Rechte wie dort; Kontakt-Auskunft für Team-Personen ohne Konto) — lib/kapazitaet/aufraeumen.ts',
    loeschfrist: '24 Monate je Woche (Morgenlauf „Wochenplan festhalten“, `PLAN_LOESCHEN_NACH_MONATEN`); Team-Person ohne Konto: ihre Zeilen 30 Tage nach dem Deaktivieren mit den übrigen Kapazitätsdaten (`kapaDeaktivierteAufraeumen`). Konto entfernt: beim nächsten Morgenlauf (`kapaEntfernteKontenAufraeumen`, 05.10.)',
    kategorie: ['beschaeftigte'],
  }),
  H('oauth-tokens', 'Zugangsschlüssel des Haushalts (Whoop/Microsoft) — keine Dritten.'),
  H('oauth-states', 'Kurzlebige OAuth-Zustände — keine Dritten.'),
  H('ki-verbrauch', 'Kosten der Modellaufrufe je Person des Haushalts.'),
  // ── KI, Gesundheit, Telegram (05.10., DSGVO-Paket; lib/datenschutz/) ──
  mit(H('gesundheit-einwilligungen', 'Nachweis der Art.-9-Einwilligungen Gesundheit je Person (Zweck a/b/c, an/aus, Zeitpunkt, Fassung, Fingerabdruck des Wortlauts, wer) — nur anhängend, nie geändert (lib/datenschutz/gesundheit-einwilligung.ts). Keine Gesundheitswerte.'), {
    rechtsgrundlage: 'Art. 7 Abs. 1 DSGVO (Nachweis der Einwilligung) i. V. m. Art. 6 Abs. 1 lit. c',
    art15: 'GET /api/datenschutz/gesundheit (eigener Nachweis), System › Datenschutz',
    loeschfrist: 'solange das Konto besteht; danach 3 Jahre (Nachweis, Verjährung § 195 BGB) — automatisches Löschen nach Kontoende noch offen',
  }),
  mit(H('ki-einstellungen', 'KI-Schalter der Instanz (Inhaber) und je Person (Hintergrund-KI, Web-Suche, Bereiche) und die Telegram-Ausnahme je Person (Zeitpunkt, Fassung des Hinweises) — keine Inhalte (lib/datenschutz/ki-einstellungen.ts).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c/f DSGVO (Datenschutz durch Technikgestaltung, Art. 25); Telegram-Ausnahme: Art. 6 Abs. 1 lit. a',
    art15: 'GET /api/datenschutz/ki (eigene Schalter), System › Datenschutz',
    loeschfrist: 'solange das Konto bzw. die Instanz besteht',
  }),
  mit(H('ki-protokoll--*', 'KI-Protokoll je Monat: je Modell-Aufruf NUR Metadaten — Zeit, Zweck, Lauf-Art, Person (Konto), Datenkategorien, Anzahl, pseudonymisiert ja/nein, gesperrt mit Grund. Nie Inhalte, nie Kennungen oder Namen Dritter (lib/datenschutz/ki-protokoll.ts).'), {
    rechtsgrundlage: 'Art. 5 Abs. 2, Art. 30 DSGVO (Rechenschaft), Art. 6 Abs. 1 lit. c/f',
    art15: 'GET /api/datenschutz/ki-protokoll?auskunft=1 (Empfänger, Kategorien, Zeitraum, eigene Zeilen); Kontakte: Kategorie „crm“ in der Kontakt-Auskunft',
    loeschfrist: '12 Monate (ältere Monate leert das Protokoll beim Schreiben, Marke „bereinigt“)',
  }),
  K('demo-instanz', 'Demo-Marke (05.10., lib/demo/schutz.ts): Saat-Version, Zeitpunkt, Haushalt-Kennung und Zählungen — nur in einer Demo-Instanz, keine Personendaten.'),
  // Bauplan (05.10., DSGVO-Grundlagen): vorher „kein Personenbezug“ — falsch: Karten nennen, wer sie schrieb, und die Bildschirmfotos
  // (Dateien in <daten>/bauplan-bilder, kein Bestand — hier der Vollständigkeit halber) können Personendaten Dritter zeigen.
  mit(H('backlog', 'Bauplan der Software (Karten: Titel, Beschreibung, Kommentare, wer; Etappen) — Personen des Haushalts; Namen Dritter höchstens im Freitext.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Weiterentwicklung und Fehlerbehebung der eigenen Software)',
    art15: 'die Karten sieht der Haushalt im Bauplan (/os/bauplan); Art. 15/17 einer Person über das Konto',
    loeschfrist: 'bis zur Löschung durch den Haushalt; angehängte Bildschirmfotos nach der Frist „bauplan-bilder“ (siehe bauplan-bilder)',
  }),
  mit({ muster: 'bauplan-bilder', bezug: 'dritte', behandlung: 'ausgenommen', frist: 'bauplan-bilder', grund: 'Bildschirmfotos an Bauplan-Karten (Dateien <daten>/bauplan-bilder, verschlüsselt wie die Dateiablage): können Personendaten Dritter zeigen (Listen, Mails) — eine Suche nach der Person in Bildern ist nicht möglich, deshalb kurze Frist statt Art.-17-Suche: fertige/verworfene Karten 90 Tage, verwaiste 7 Tage (lib/bauplan/bilder-frist.ts).' }, {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Fehlerbehebung; Bildschirmfoto von Hand angehängt — vor dem Anhängen Personendaten möglichst schwärzen)',
    art15: 'nur über den Bauplan (Karte öffnen, Bild ansehen); in der Kontakt-Auskunft nicht auffindbar (Bildinhalt ist nicht durchsuchbar) — deshalb die kurze Frist',
    loeschfrist: '90 Tage nach Abschluss der Karte (fertig/verworfen, Frist einstellbar 7–365), nicht zugeordnete nach 7 Tagen; offene Karten: solange offen',
  }),
  K('protokoll-siegel', 'Siegel der Protokoll-Kette (05.10., lib/store/protokoll-kette.ts): je Protokolldatei Anzahl der Einträge und letzter Hash — keine Inhalte, keine Personen.'),
  K('protokoll-pruefung', 'Ergebnis der letzten Kettenprüfung (Zahlen, Dateinamen, Befunde) — keine Inhalte.'),
  K('bauzeit', 'Bauzeiten der Software.'),
  K('agents-config', 'Agenten-Schalter.'),
  K('brain-konsolidierung', 'Riegel der Brain-Konsolidierung.'),
  K('crm-loeschfristen', 'Fristen und Tagesmarke — keine Kennungen.'),
  K('dashboard', 'Anordnung der Startfläche.'),
  K('filter', 'Gespeicherte Filter.'),
  K('fokus-regler', 'Regler-Stand.'),
  K('hoi-meldung', 'Riegel des Head of IT.'),
  K('hoi-durchsicht', 'Nächtliche Durchsicht der Bestände (lib/store/durchsicht.ts) — nur Zähler je Bestand.'),
  K('inbox-status', 'Altbestand der alten Inbox (bis 06.10.): Gelesen/erledigt je Mail-Kennung — keine Inhalte, keine Adressen. Wird nicht mehr geschrieben; Gmail-Wiedervorlagen übernimmt `inbox-zustand--<person>` beim ersten Schreiben (lib/inbox/zustand.ts).'),
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
  K('crm-scoring', 'Scoring-Einstellungen des CRM (Kriterien, Stufen, Schwellen MQL/SQL) samt früheren Fassungen und Vermerk wer/wann — keine Personendaten (Leads tragen ihre Antworten selbst, in crm/kontakte).'),
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
  // Datenschutz-Einrichtung der Instanz (05.10., lib/datenschutz/einrichtung.ts): Verantwortlicher (Name/Firma, Anschrift, Kontakt, ggf.
  // Datenschutzbeauftragter — Pflichtangabe nach Art. 13/30) und das Empfänger-/AVV-Register (Firmen, keine Personen Dritter).
  mit(H('datenschutz-einrichtung', 'Datenschutz-Einrichtung: Verantwortlicher (Name/Firma, Anschrift, Kontakt-Mail, optional Telefon, Vertretung, Datenschutzbeauftragter) und Empfänger/Auftragsverarbeiter mit AVV-Nachweis — schreibt nur der Inhaber (System › Datenschutz), Protokoll nur mit Feldnamen.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Pflichtangaben Art. 13 Abs. 1 lit. a/b, Art. 30 Abs. 1 lit. a, Nachweis Art. 5 Abs. 2, Art. 28)',
    art15: 'System › Datenschutz zeigt dem Haushalt des Inhabers alles; die Angaben stehen in jeder Auskunft (GET /api/crm/datenschutz › verantwortlich) und im Verzeichnis-Export',
    loeschfrist: 'solange die Instanz betrieben wird; der Inhaber ändert bzw. leert die Angaben jederzeit (frühere Fassungen nur in den Sicherungen, bis zu 12 Monate)',
  }),
  // Pannen-Register (05.10., Zusatz; Art. 33 Abs. 5): nur Kategorien/Anzahl Betroffener, keine Namen; nur der Inhaber.
  mit(H('datenschutz-pannen', 'Pannen-Register (lib/datenschutz/pannen.ts): Kenntnis, Beschreibung, Art, Betroffene nur als Kategorien/Anzahl, Datenkategorien, Risiko, Meldung an die Behörde, Benachrichtigung, Maßnahmen, Abschluss, wer — liest und schreibt nur der Inhaber.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO i. V. m. Art. 33 Abs. 5 (Dokumentationspflicht)',
    art15: 'System › Datenschutz › Pannen-Register (nur Inhaber); Betroffene sind dort nicht namentlich geführt',
    loeschfrist: 'abgeschlossene Pannen 36 Monate ab Abschluss (Frist „pannen“, einstellbar 12–120 Monate); offene bleiben',
  }),
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
