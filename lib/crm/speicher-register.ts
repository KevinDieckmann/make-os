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
  rechtsgrundlage: 'Art. 9 Abs. 2 lit. a DSGVO — ausdrückliche Einwilligung der Person durch eigenes Erfassen bzw. Verbinden (Whoop); an andere Konten nur über „Teilen“ (Konto › teilt.gesundheit), an ZOE nur die eigenen Werte',
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
  // Google Kalender (03.10.2026): ein Spiegel je Person — Wahrheit ist Google, Löschung nur dort (wie die Apple-Spiegel; der Löschlauf zählt die Termine, die die Person nennen).
  A('kalender-google--*', 'Spiegel des Google Kalenders je Person (Termine, Teilnehmer-Adressen Dritter) — Wahrheit ist Google, Löschung nur dort; der Abgleich holt ihn neu, der Löschlauf meldet die Termine, die die Person nennen (person-weitere.ts).', 'kalender-caches'),
  // Gmail in der Inbox (03.10.2026): Spiegel je Person — Nachrichten, die die Person nennen, raus (Art. 17), das Original bleibt in Gmail (der Löschlauf zählt es als „dort löschen“).
  E('gmail-stand--*', 'Gmail-Spiegel je Person (Köpfe: Absender, Empfänger, Betreff, Ausschnitt, Labels, Anhang-Metadaten) — Nachrichten, die die Person nennen, raus (person-weitere.ts); das Original bleibt in Gmail (Hinweis „dort löschen“); Aufbewahrung: Frist Mail-Spiegel (180 Tage).', 'mail-spiegel'),
  E('gmail-text--*', 'Gmail-Spiegel je Person (Textkörper, nur Text) — Texte, die die Person nennen (Adresse oder Name), raus; Aufbewahrung wie der Spiegel.', 'mail-spiegel'),
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
  T('aenderungsprotokoll--*', 'Änderungsprotokoll — bleibt (nur Feldnamen), Fingerabdruck der Person → c#geloescht.', 'aenderungsprotokoll'),
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
  mit(T('gesellschaften--*', 'Gesellschafts-Register des Haushalts (lib/gesellschaften): Firmendaten, Nummernkreise, Steckbrief, Gesellschafter, Organe, Beschlüsse, Beteiligungen, Verträge — Dritte nur als Kontakt-/Firmen-Kennung; deren Kennung wird getilgt (auch in Papierkorb/Archiv), der Eintrag bleibt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Gesellschafterliste § 40 GmbHG, Aufbewahrung § 257 HGB / § 147 AO), lit. b (Verträge mit der Person), lit. f (Führung der eigenen Gesellschaften)',
    art15: 'Auskunft der Kontaktakte (GET /api/crm/datenschutz › gesellschaften: Gesellschafter, Organ, Vertragspartei — auch Papierkorb/Archiv, lib/gesellschaften/auskunft.ts)',
    loeschfrist: 'Papierkorb 30 Tage (Morgenlauf); sonst bis zur Löschung durch den Haushalt — Verträge/Beschlüsse als Geschäftsunterlagen 6 bzw. 10 Jahre (§ 257 HGB); Unterlagen in crm-dateien--*',
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
  H('ernaehrung', 'Eigene Daten des Haushalts (Essen, Einkauf).'),
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
  H('anmeldungen', 'Anmeldungen der Konten des Haushalts (Zeit, Gerät; bei Änderungen der Anmelde-Adressen die betroffene Adresse nur maskiert) — Art. 15/17 über das Konto.'),
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
  H('konten', 'Konten der Nutzer (Name, Hauptadresse und bis zu drei weitere Anmelde-Adressen, Passwort-Hash, zweiter Faktor) — Art. 15: die Person sieht ihre Adressen unter System › Konto › Anmelde-Adressen, Art. 16/17 über das Konto (Adressen selbst ändern bzw. entfernen).'),
  H('team--*', 'Team des Haushalts (Rollen/Namen der Mitglieder; `deaktiviertAm` = Beginn der 30-Tage-Frist für die Kapazitätsdaten, setzt nur der Server).'),
  mit(H('kapazitaet--*', 'Kapazität je Haushalt (04.10.): Grundwert und Ausnahmen (Urlaub, feste Blöcke) je Team-Person, Zuweisungen Person × Mandat/Kunde (nur CRM-Kennungen, keine Namen Dritter) — eigene Planung des Haushalts. Gespeichert wird KEIN Gesundheitswert (die Erholung wird beim Rechnen aus vitals--* gelesen, nur mit Einwilligung + Teilen, nur als Team-Faktor); `erholungAm` = Zeitpunkt der Einwilligung (Nachweis).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Planung der Arbeitszeit im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (realistische Planung); Erholung: Art. 9 Abs. 2 lit. a — eigene Einwilligung der Person (`erholungAm`, Schalter in der Kapazität, Vorgabe aus) UND Teilen mit allen Konten (siehe vitals--*)',
    art15: 'GET /api/kapazitaet zeigt der Person ihre Werte samt eigener Ausnahme-Titel; als Datei GET /api/kapazitaet?auskunft=<person> (Konto: nur die Person selbst; Team-Person ohne Konto: der Inhaber, auch deaktiviert) und in der Kontakt-Auskunft (`personAufzaehlen.kapazitaet`, Zuordnung über die E-Mail der Team-Person) — lib/kapazitaet/aufraeumen.ts',
    loeschfrist: 'Ausnahmen/Zuweisungen bis zur Löschung durch Person bzw. Inhaber (Planung › Kapazität); Team-Person ohne Konto: 30 Tage nach dem Deaktivieren automatisch (Morgenlauf `kapaDeaktivierteAufraeumen`, Zeitpunkt `deaktiviertAm` am Team-Eintrag, Reaktivieren davor erhält alles). Offen: Einträge eines entfernten Kontos (Konten werden nicht deaktiviert)',
    kategorie: ['beschaeftigte'],
  }),
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
  K('inbox-status', 'Gelesen/erledigt je Mail-Kennung — keine Inhalte, keine Adressen. Eine Karte, aber je Postfach getrennt ausgeliefert/geschrieben (lib/inbox/status-sicht.ts: eigenes Gmail, Apple/M365 nur Inhaber; Haushalt des Inhabers).'),
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
