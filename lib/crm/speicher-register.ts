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
// Seit 09.10. spät (Kevin: „Firma und Privat müssen immer getrennt liegen, auch von den Daten“; Plan TRENNUNG_PRIVAT_BUSINESS.md)
// trägt JEDER Eintrag seinen Bereich — gesetzt nicht im Eintrag selbst, sondern in der Tabelle `BEREICH_JE_MUSTER` unten:
//   bereich      'privat'   nur Privat-Bereich des Haushalts (Familie, Ernährung, Kompass, Nordstern) — nie in eine Firmen-Instanz
//                'business' nur Business (Kartei-Pflichtbestände, Heads, Business-Medien, Gmail/Google, WhatsApp Business …)
//                'person'   gehört EINER Kontoperson und ist ihre eigene Sache (Gesundheit, Zugänge, eigene Einstellungen) — wandert
//                           mit dem Konto, nie mit einem Bereich
//                'instanz'  Betrieb/Einstellungen der Instanz (Konten, Riegel, Protokoll-Siegel, Schalter) — keine Bereichsdaten
//                'gemischt' enthält Privat UND Business, getrennt nur über ein Feld (space, bereich, einheit, ort, Gesellschaft …)
//                           oder gar nicht — `trennung` sagt, was heute trennt. Die Liste darf nur KÜRZER werden, ein NEUER Bestand
//                           ist nie gemischt (Wächter tests/trennung-bereiche.test.ts): je Bereich ein eigener Bestand.
// Rein, ohne Abhängigkeiten — der Test und die Doku lesen es direkt.

export type Bezug = 'dritte' | 'haushalt' | 'kein';
export type Behandlung = 'entfernen' | 'tilgen' | 'pseudonym' | 'ausgenommen';
export type Kategorie = 'art9' | 'beschaeftigte' | 'vertraulich';
/** Wohin ein Bestand gehört (TRENNUNG_PRIVAT_BUSINESS.md) — Werte siehe Kopf. */
export type SpeicherBereich = 'privat' | 'business' | 'person' | 'instanz' | 'gemischt';
export const SPEICHER_BEREICHE: readonly SpeicherBereich[] = ['privat', 'business', 'person', 'instanz', 'gemischt'];
export interface Angaben { rechtsgrundlage: string; art15: string; loeschfrist: string; kategorie?: Kategorie[] }
export interface SpeicherEintrag extends Partial<Angaben> {
  muster: string; bezug: Bezug; behandlung: Behandlung; grund: string; frist?: string;
  /** Bereich des Bestands (aus `BEREICH_JE_MUSTER`, 09.10. spät). */
  bereich?: SpeicherBereich;
  /** Nur bei `gemischt`: welches Feld heute Privat und Business trennt (bzw. dass keins trennt). */
  trennung?: string;
}
/** Einen Eintrag um die Pflicht-Angaben ergänzen (neue Speicher, besondere Kategorien). */
const mit = (e: SpeicherEintrag, a: Angaben): SpeicherEintrag => ({ ...e, ...a });
/** Gesundheitsdaten der Person selbst (Art. 9): Grundlage und Wege — eine Formulierung für alle Gesundheits-Bestände. */
const GESUNDHEIT: Angaben = {
  rechtsgrundlage: 'Art. 9 Abs. 2 lit. a DSGVO — ausdrückliche Einwilligung der Person, getrennt je Zweck (05.10., `gesundheit-einwilligungen`): (a) verarbeiten, (b) an die KI, (c) mit dem Partner teilen inkl. dessen ZOE; an andere Konten nur über „Teilen“ (Konto › teilt.gesundheit), an ZOE/KI-Läufe nur mit (b), an die ZOE des Partners nur mit (b)+(c)',
  art15: 'die Person sieht und exportiert ihre Werte selbst (Gesundheit); andere Konten sehen sie nur bei „Teilen“',
  loeschfrist: 'bis die Person sie löscht bzw. ihr Konto entfernt wird',
  kategorie: ['art9'],
};
/** Körper-Profil (08.10. abends): wie GESUNDHEIT, aber auch bei „Teilen“ nie für andere Konten. */
const KOERPER: Angaben = {
  ...GESUNDHEIT,
  art15: 'nur die Person selbst sieht, pflegt und exportiert ihr Körper-Profil (Gesundheit › Körper, Konto-Export) — auch bei „Teilen“ nie andere Konten',
};

/** Tageslauf je Person (08.10. spät): Ausrichtung mit Tagesform (Art. 9 nur mit Einwilligung) — nur die Person selbst. */
const TAGESLAUF: Angaben = {
  rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson); soweit die Tagesform einfließt Art. 9 Abs. 2 lit. a — nur mit Einwilligung (b) „An die KI geben“',
  art15: 'die Person sieht ihre Läufe unter Tageslauf/Ritual (GET /api/tageslauf liefert nur die eigenen); Konto › Meine Daten exportiert sie',
  loeschfrist: 'rollend: nur die letzten Läufe (MAX_LAEUFE); Konto löschen entfernt den Bestand',
  kategorie: ['art9'],
};
/** Arbeits-Schalter je Person (08.10. spät): nur Uhrzeiten an/aus — Arbeitszeit. */
const ARBEITSZEIT: Angaben = {
  rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG — die Person misst ihre eigene Arbeitszeit selbst',
  art15: 'die Person sieht ihre Zeiten unter Ritual (GET /api/state/arbeitsmodus liefert nur die eigenen); Konto › Meine Daten exportiert sie',
  loeschfrist: 'rollend 60 Tage; Konto löschen entfernt den Bestand',
  kategorie: ['beschaeftigte'],
};

const E = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'entfernen', grund, ...(frist ? { frist } : {}) });
const T = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'tilgen', grund, ...(frist ? { frist } : {}) });
const H = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'haushalt', behandlung: 'ausgenommen', grund });
const K = (muster: string, grund: string): SpeicherEintrag => ({ muster, bezug: 'kein', behandlung: 'ausgenommen', grund });
/** Spiegel einer Apple-Quelle mit Dritten: ausgenommen — Löschung nur in Apple (der Löschlauf meldet, wo). */
const A = (muster: string, grund: string, frist?: string): SpeicherEintrag => ({ muster, bezug: 'dritte', behandlung: 'ausgenommen', grund, ...(frist ? { frist } : {}) });

const REGISTER_EINTRAEGE: readonly SpeicherEintrag[] = [
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
  // Mac-Zulieferer abschaltbar (08.10., Lücke 10): solange er läuft, wie oben (Löschung nur in Apple). Ist er aus, liest niemand
  // mehr den Spiegel (lib/mac.ts `vomMac`, Kalender), Art. 17 entfernt die Einträge der Person darin wirklich (`macSpiegelRaus` —
  // eingefroren ist er die einzige Kopie), und der Inhaber löscht ihn ganz über Einstellungen › Verbindungen › Mac-Zulieferer.
  A('apple-reminders-cache', 'Erinnerungen-Spiegel vom Mac — Löschung nur in Apple, solange der Zulieferer läuft; danach eingefroren: Art. 17 entfernt die Einträge, die die Person nennen, und „Spiegel löschen“ (Inhaber) entfernt ihn ganz (lib/zulieferer/server.ts).'),
  A('apple-contacts-cache', 'Kontakte-Spiegel vom Mac (Adressbuch) — Löschung nur in Apple, solange der Zulieferer läuft; danach eingefroren und von niemandem mehr gelesen: Art. 17 entfernt die Einträge der Person, „Spiegel löschen“ (Inhaber) entfernt ihn ganz.'),
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
  mit(T('inbox-zustand--*', 'Inbox-Zustand je Person: Wiedervorlagen und „erledigt bis“ je Gespräch (nur Kennungen — bei WhatsApp trägt die Kennung die Nummer der Gegenseite), bestätigte Zuordnung (Kontakt-Kennung), Screener-Entscheidungen je Absender-Adresse bzw. WhatsApp-Nummer („+<Ziffern>“) — Adresse und Nummer der Person fallen weg (samt Zustand ihrer WhatsApp-Gespräche), Kennungen werden getilgt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Post ordnen (Screener, Wiedervorlage)',
    art15: 'Kontakt: Auskunft nennt Screener-Entscheidung und Zuordnung; Konto: Konto › Meine Daten',
    loeschfrist: 'mit dem Konto bzw. „Trennen“ (Gespräche dieses Postfachs); Absender-Entscheidungen bis die Person sie zurücknimmt',
  }),
  // Inbox teilen (08.10.2026, Lücke 6): Übergaben (freigegebene Kopien) und der gemeinsame Zustand der Team-Postfächer — je Haushalt.
  mit(E('inbox-uebergaben--*', 'Übergaben je Haushalt: freigegebene KOPIE eines Gesprächs (Köpfe: Absender, Empfänger, Betreff; Texte; Anhänge als Liste — als Datei nur die ausdrücklich angehakten, verschlüsselt in der Ablage `inbox-uebergaben/ua-<uuid>.bin`, seit 10.10.) von einer Person des Haushalts an eine andere, mit Notiz, „wer kümmert sich“, Kennzeichen Werbesperre/Art. 18 und Verlauf (nur Schritte, nie Text). Art. 17: Übergaben, die die Person nennen, fallen ganz weg (person-weitere.ts), ihre Dateien mit dem nächsten Löschfristen-Lauf; das Original bleibt im Postfach (dort löschen).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Korrespondenz im Haushalt/Team weitergeben, damit sich jemand kümmert (Geschäftspostfächer zusätzlich lit. b: Anbahnung/Vertrag); geteilt nur ausdrücklich per Klick, Privat nur an volle Mitglieder',
    art15: 'Kontakt: Auskunft zählt die Übergaben, die die Person nennen; Konto: Konto › Meine Daten (eigene gegebene und erhaltene Übergaben)',
    loeschfrist: 'erledigte Übergaben 90 Tage nach „Erledigt“ (täglicher Löschfristen-Lauf und jeder Schreibvorgang räumen sie weg); jede Kopie höchstens so lange wie der Mail-Spiegel (Frist „mail-spiegel“, gemessen an der jüngsten kopierten Nachricht); „Zurückziehen“ entfernt die Kopie sofort; Konto löschen entfernt alle Übergaben der Person; mitgegebene Dateien fallen mit ihrer Übergabe weg (verwaiste räumt der tägliche Lauf)',
  }),
  // Datei-Ordner der Übergaben (Prüf-Fund 11.10., Muster `fulfillment-unterlagen`): kein Bestand, die Dateien folgen ihrer Übergabe.
  mit({ muster: 'inbox-uebergaben', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Dateien der Übergaben (<daten>/inbox-uebergaben, verschlüsselt über die Bild-Ablage, Name ua-<uuid>.bin) — kein Bestand; Verweis, Art. 15/17 und Frist über die Übergabe in inbox-uebergaben--*: fällt sie weg (Zurückziehen, Aufbewahrung, Mail-Frist, Art. 17, Konto löschen), geht die Datei mit (verwaiste räumt der tägliche Lauf).' }, {
    rechtsgrundlage: 'wie die Übergabe (inbox-uebergaben--*): Art. 6 Abs. 1 lit. f DSGVO, bei Geschäftspostfächern zusätzlich lit. b',
    art15: 'über die Übergabe (Anhänge als Liste in der Kopie); die Datei selbst nur als Download für die beiden beteiligten Personen',
    loeschfrist: 'so lange wie ihre Übergabe — erledigt 90 Tage, höchstens wie der Mail-Spiegel; Konto löschen entfernt sie mit der Übergabe',
  }),
  mit(T('inbox-geteilt--*', 'Gemeinsamer Zustand der Team-Postfächer je Haushalt: Wiedervorlage und „erledigt bis“ je Gespräch (nur Kennungen — bei WhatsApp trägt die Kennung die Nummer der Gegenseite), bestätigte Zuordnung (Kontakt-Kennung), „wer kümmert sich“ (Person des Haushalts) — Kennungen und Nummer der Person fallen weg bzw. werden getilgt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — gemeinsame Post des Teams ordnen (wer kümmert sich, Wiedervorlage)',
    art15: 'Kontakt: Auskunft nennt die Zuordnung; Konto: Konto › Meine Daten (Gespräche, um die sich die Person kümmert)',
    loeschfrist: 'mit dem Postfach („Trennen“, „Teilen aus“ gibt ihn dem Besitzer zurück) bzw. dem Konto des Besitzers; „wer kümmert sich“ einer gelöschten Person fällt weg',
  }),
  // Inbox (10.10., Roadmap Phase 1): Merker der Aufgaben-Vorschläge je Person — nur Fingerabdrücke geprüfter Nachrichten, keine Dritten.
  mit(H('inbox-vorschlaege--*', 'Aufgaben-Vorschläge aus der Inbox je Person: Fingerabdrücke (SHA-256, gekürzt) der schon geprüften Nachrichten mit Tag, Schalter „automatisch“, letzter Lauf — kein Text, keine Adresse, keine Nummer, keine Kennung. Die Vorschläge selbst liegen im Freigabe-Stapel (zoe-stapel).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — die eigene Post ordnen (Vorschläge nur für die Person selbst, angelegt erst per Klick)',
    art15: 'Konto › Meine Daten (nur Merker, keine Inhalte)',
    loeschfrist: 'Merker nach 60 Tagen; der Bestand mit dem Konto',
  }),
  A('kalender-umzug-sicherung--*', 'Sicherung der iCloud-Texte beim Umzug Business → Google (Notizen können Dritte nennen) — verschlüsselt, 30 Tage, dann räumt der Takt sie weg (lib/kalender/google/umzug.ts); Wahrheit ist der Termin in Google.', 'kalender-caches'),
  // Verbindung zu Google (03.10.): Token-Bestand und Anmelde-Zustand — gehören der Person des Haushalts, keine Dritten.
  H('google-verbindung--*', 'Google-Verbindung je Person (Adresse des Google-Kontos, verschlüsselte Token) — nur serverseitig, Trennen widerruft bei Google und löscht den Inhalt; Art. 17 über das Konto.'),
  // iCloud je Person (06.10.2026, lib/kalender/icloud-person.ts): Zugang und Spiegel je Person — wie Google, Wahrheit ist Apple.
  mit(A('kalender-icloud--*', 'Spiegel der EIGENEN iCloud-Kalender einer Person (Termine, Teilnehmer-Adressen Dritter) — Wahrheit ist iCloud, Löschung nur in Apple; der Abgleich holt ihn alle 5 Minuten neu, der Löschlauf meldet die Termine, die die Person nennen (person-weitere.ts). Andere Konten sehen nur „Belegt“.', 'kalender-caches'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (die Person selbst: eigener Kalender) bzw. lit. f für Gäste und Organisatoren in ihren Terminen (Termine abstimmen)',
    art15: 'die Person sieht ihre Termine im Kalender; Dritte erfahren über die Auskunft, dass Termine sie in Apple nennen (Zählung im Löschlauf)',
    loeschfrist: 'Spiegel −90 … +400 Tage; „Trennen“ oder Konto löschen entfernt ihn sofort (samt Tageskopien)',
  }),
  mit(H('icloud-verbindung--*', 'iCloud-Verbindung je Person (Apple-ID, app-spezifisches Passwort, gezeigte Kalender) — nur serverseitig im verschlüsselten Bestand, nie an den Browser oder ins Log; „Trennen“ löscht ihn samt Tageskopien.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (die Person verbindet ihren eigenen Kalender selbst)',
    art15: 'Kalender › Einstellungen › iCloud zeigt die verbundene Apple-ID (maskiert); das Passwort geht nie heraus (auch nicht im Export)',
    loeschfrist: 'bis die Person trennt bzw. ihr Konto entfernt wird',
  }),
  // WHOOP je Person (08.10., lib/whoop/*): Zugang und Spiegel je Person — Gesundheitsdaten der Person selbst (Art. 9), keine Dritten.
  mit(H('whoop-verbindung--*', 'WHOOP-Verbindung je Person (WHOOP-Kennung, Adresse des WHOOP-Kontos, verschlüsselte Token) — nur serverseitig, nie an den Browser/ins Log; „Trennen“ widerruft bei WHOOP und löscht ihn samt Tageskopien (Grabstein `v: 0`).'), {
    rechtsgrundlage: 'Art. 9 Abs. 2 lit. a DSGVO — die Person verbindet ihr eigenes WHOOP-Konto selbst, nur mit Einwilligung (a) in die Verarbeitung ihrer Gesundheitsdaten',
    art15: 'Gesundheit › WHOOP zeigt Verbindung (Adresse maskiert), seit wann und den letzten Abgleich; Token gehen nie heraus (auch nicht im Export)',
    loeschfrist: 'bis die Person trennt bzw. ihr Konto entfernt wird (dann Widerruf bei WHOOP)',
    kategorie: ['art9'],
  }),
  mit(H('whoop-stand--*', 'WHOOP-Spiegel je Person: Recovery (inkl. SpO2, Hauttemperatur), Schlaf (Phasen, Bedarf, Atemfrequenz, Konsistenz, Störungen), Zyklen (Strain, Energie, Puls, Schritte), Workouts (inkl. Herzfrequenz-Zonen, Höhenmeter) — Zahlen und Zeiten, keine Namen; dazu Abgleich-Zustand und die trace_id der letzten Webhooks. Abgebildet in vitals--*/sport--* (Handwert gewinnt).'), {
    ...GESUNDHEIT,
    loeschfrist: 'Einträge älter als 400 Tage fallen beim nächsten Abgleich heraus; „Trennen“ oder Konto löschen entfernt den Spiegel sofort (samt Tageskopien). Übernommene Werte in vitals/sport bleiben bei der Person',
  }),
  K('whoop-oauth-zustand', 'Kurzlebiger Anmelde-Zustand der WHOOP-Verbindung (state → Person, 15 Minuten) — keine Gesundheitsdaten.'),
  K('google-oauth-zustand', 'Kurzlebiger Anmelde-Zustand der Google-Verbindung (state-Hash, PKCE-Verifier, 15 Minuten) — keine Personendaten.'),
  // WhatsApp Business (07.10., lib/whatsapp/*): die Business-Nummer der Instanz über die Cloud API von Meta (Auftragsverarbeiter).
  mit(E('whatsapp-spiegel', 'WhatsApp-Spiegel der Business-Nummer (je Instanz): Nachrichten (WAMID, wa_id der Gegenseite, Zeit, Art, Text/Bildunterschrift, Standort, geteilte Kontakte, Medien-Metadaten, Zustellstand, wer gesendet hat) und Gesprächspartner (wa_id, Profilname, letzte eingehende Nachricht, gelesen bis). Art. 17: Nachrichten mit einer Nummer der Person bzw. die sie nennen raus (lib/whatsapp/art17.ts), ihre Medien löscht der nächste Takt. Anders als Mail die EINZIGE dauerhafte Kopie (Meta hält Nachrichten höchstens 30 Tage).', 'whatsapp-spiegel'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Anfragen und Verträge über WhatsApp) bzw. lit. f (Geschäftsbetrieb); Antworten nur 1:1 auf Klick, außerhalb des 24-h-Fensters nur genehmigte Vorlagen; Werbe-Vorlagen nie bei Werbesperre; Art. 18 → nichts senden',
    art15: 'Kontakt-Auskunft (Art. 15) zählt die Einträge über die Telefonnummer der Akte; die Nachrichten selbst sieht der Haushalt in der Inbox (Business-Bereich); Konto-Export: selbst gesendete Nachrichten',
    loeschfrist: 'Frist „WhatsApp-Spiegel“ (Vorgabe 180 Tage, einstellbar 30–3650 — Aufbewahrung von Handelsbriefen nach § 257 HGB prüfen); Art. 17 sofort; Konto gelöscht → „wer gesendet hat“ wird „[gelöscht]“',
  }),
  K('whatsapp-zustand', 'Zustand der WhatsApp-Verbindung (je Instanz): Webhook zuletzt/Zähler, Angaben der eigenen Business-Nummer (Cache), Vorlagen-Liste des Kontos (Cache), Zustand des Zugriffsschlüssels (nur Zeitpunkte) — keine Personendaten Dritter, nie der Schlüssel selbst.'),
  mit({ muster: 'whatsapp-medien', bezug: 'dritte', behandlung: 'ausgenommen', frist: 'whatsapp-medien', grund: 'Medien der WhatsApp-Nachrichten (Dateien <daten>/whatsapp-medien, verschlüsselt wie die Dateiablage, Name = Fingerabdruck der WAMID): Bilder, Dokumente, Audio/Sprachnachrichten Dritter. Kein Bestand und nicht durchsuchbar — Art. 17 wirkt über die Nachricht (whatsapp-spiegel): fällt sie weg, löscht der nächste Takt die Datei ohne Nachricht (lib/whatsapp/medien.ts `medienWaisenEntfernen`).' }, {
    rechtsgrundlage: 'wie whatsapp-spiegel (Art. 6 Abs. 1 lit. b/f DSGVO)',
    art15: 'über die Nachricht in der Inbox (Download auf Klick); in der Kontakt-Auskunft über die Nachricht gezählt',
    loeschfrist: 'Frist „WhatsApp-Medien“ (Vorgabe 90 Tage, einstellbar 7–365) — danach nur noch der Hinweis an der Nachricht; größer als 25 MB wird nie abgelegt',
  }),
  // ZOE auf WhatsApp (08.10., lib/zoe-whatsapp/*): die eigene ZOE-Nummer der Instanz (Meta, Auftragsverarbeiter) — Kanal JE PERSON, nur die
  // Personen des Haushalts selbst; fremde Nummern werden nur gezählt (`zoe-whatsapp-zustand`), nie gespeichert.
  mit(H('zoe-kanal--*', 'ZOE-Kanal auf WhatsApp je Person: eigene Handynummer (nur solange verbunden), Nachweis der Einwilligung und der Ausnahme „Inhalte senden“ (Ereignisse, nur anhängend, ohne Nummer), 24-h-Fenster, was die Vorlage „Briefing bereit“ angekündigt hat, kurzlebiger Eingang (Nachrichten bis zur Verarbeitung), Verweise auf eigene Vorschläge, Sprachnachrichten (Metadaten; Dateien in zoe-whatsapp-medien).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. a DSGVO — Einwilligung der Person (Wortlaut + Fassung als Nachweis), jederzeit widerrufbar mit „STOP“ oder „Trennen“; Inhalte (Gesundheit, Finanzen, Kontakte) nur mit der gesonderten Ausnahme „Inhalte senden“, Gesundheitswerte zusätzlich nur über die Art.-9-Wege',
    art15: 'Konto › ZOE auf WhatsApp zeigt Verbindung (Nummer maskiert), Nachweise und Sprachnachrichten; Konto › Meine Daten exportiert den Bestand',
    loeschfrist: '„Trennen“/„STOP“ entfernt Nummer, Eingang, Ausstehendes und Sprachnachrichten sofort (der Nachweis der Einwilligung bleibt); Sprachnachrichten nach 30 Tagen; Konto löschen entfernt alles',
  }),
  K('zoe-whatsapp-zustand', 'Zustand der ZOE-Nummer (je Instanz): Webhook zuletzt/Zähler, Nachrichten fremder Nummern NUR als Zahl, verworfene Nachrichten (Zahl), Zustand des Zugriffsschlüssels, Vorlagen- und Telefon-Cache der eigenen Nummer, Zeitpunkte „nicht zugestellt“ — keine Personendaten, nie der Schlüssel.'),
  mit({ muster: 'zoe-whatsapp-medien', bezug: 'haushalt', behandlung: 'ausgenommen', grund: 'Sprachnachrichten der Personen des Haushalts an die ZOE-Nummer (Dateien <daten>/zoe-whatsapp-medien, verschlüsselt wie die Dateiablage, Name = Fingerabdruck der WAMID). Kein Bestand — der Verweis steht im Kanal der Person (zoe-kanal--*); Dateien ohne Verweis entfernt der Takt (lib/zoe-whatsapp/medien.ts).' }, {
    rechtsgrundlage: 'wie zoe-kanal--* (Art. 6 Abs. 1 lit. a DSGVO, Einwilligung der Person)',
    art15: 'Konto › ZOE auf WhatsApp: nur die Person selbst hört ihre Sprachnachrichten (Download auf Klick)',
    loeschfrist: '30 Tage; „Trennen“/„STOP“ und Konto löschen sofort; ohne Verweis entfernt der nächste Takt die Datei',
  }),
  T('kemaris-calendar', 'Alter Kalender-Zwischenspeicher (M365-Snapshot, seit 09.10. ohne Leser) — Termin bleibt, Name/Adresse getilgt.', 'kalender-caches'),
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
    art15: 'Konten: Einstellungen › Datenschutz › Nachweise (Inhaber) bzw. auf Anfrage beim Inhaber; Kontakte: Fingerabdrücke über die Auskunft auflösbar',
    loeschfrist: '12 Monate (ältere Monate leert die nächtliche Durchsicht, Vermerk mit Anzahl bleibt), in Sicherungen bis zu 12 Monate länger',
  }),
  T('agent-log', 'Agenten-Log — Titel/Texte getilgt (Art. 17 Kontakt); je Lauf optional `person` (wer ihn ausgelöst hat, 08.10.): gelesen nur eigene + Systemläufe, Konto löschen nimmt die Läufe der Person heraus.'),
  T('client-fehler', 'Fehlermeldungen der Oberfläche — getilgt, falls sie die Person nennen.'),
  T('meldungen--*', 'Glocke je Person — Texte getilgt.'),
  // ── Agenten-Bereich (08.10. spät, Paket 0 „Vertrag“; Namen: lib/agenten/typen.ts, AGENTEN_KONZEPT.md C4/C11) ──
  // Threads, Skills, Hintergrundaufgaben können Text Dritter tragen (Kontaktnamen, Mails, Web) → Art. 17 tilgt Nennungen (person-weitere.ts),
  // der Eintrag bleibt. Bestände je Person gehören zu Konto-Export/-Löschen (lib/datenschutz/konto-daten.ts PERSON_BESTAENDE).
  mit(T('agenten-faeden--*', 'Index der Threads je Person mit ZOE, Heads und Mitarbeitern (seit E3, 09.10.: je Thread nur der Kopf — Titel, Agent, Status, Lauf-Fortschritt, Kosten, Zähler — und das Gedächtnis „Persönlich“; seit 10.10. die eigene Wahl des Chats unten „passender Head“/„immer ZOE“, keine Inhalte; Altbestand: alle Threads ganz) — auch Business-Threads gehören der Person (Antwort 13); Nennungen Dritter getilgt, der Thread bleibt.', 'zoe-verlauf'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson); Daten Dritter darin Art. 6 Abs. 1 lit. f (eigene Arbeit organisieren); Gesundheitswerte nur über die Art.-9-Wege mit Einwilligung (b)',
    art15: 'die Person sieht ihre Threads im Agenten-Bereich; Konto › Meine Daten exportiert den Bestand; Kontakte: die Auskunft nennt Threads, die sie nennen',
    loeschfrist: 'Frist „zoe-verlauf“ (Vorgabe 12 Monate nach der letzten Nachricht, Stammdaten › Datenschutz): der tägliche Löschfristen-Lauf entfernt abgelaufene Threads und persönliche Merksätze je Person (laufende Threads bleiben bis zum Ende des Laufs; 09.10., Agenten-Datenschicht); vorher löscht die Person den Thread bzw. ihr Konto',
  }),
  // E3 (09.10., „Gesprächs-Ablage teilen“): je Thread eine Datei — der Index (oben) trägt nur Köpfe. Geschrieben nur in der Sperre des Index
  // (lib/agenten/faeden-ablage.ts); Art. 17 tilgt hier in derselben Sperre (person-weitere.ts `aussen`).
  mit(T('agenten-faden--*', 'EIN Thread je Datei (agenten-faden--<person>--<id>): Nachrichten, Berichte, Arbeitsstand (Bretter), Plan-Freigaben, Lauf-Fortschritt, Kosten — gehört der Person (auch Business-Threads, Antwort 13); Nennungen Dritter getilgt, der Thread bleibt.', 'zoe-verlauf'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson); Daten Dritter darin Art. 6 Abs. 1 lit. f (eigene Arbeit organisieren); Gesundheitswerte nur über die Art.-9-Wege mit Einwilligung (b)',
    art15: 'die Person sieht ihre Threads im Agenten-Bereich; Konto › Meine Daten exportiert jeden Thread; Kontakte: die Auskunft nennt Threads, die sie nennen',
    loeschfrist: 'Frist „zoe-verlauf“ wie der Index: fällt der Kopf aus dem Index (Löschfrist, Löschen, Konto löschen), geht die Datei samt Tagessicherungen; Dateien ohne Kopf räumt der Löschfristen-Lauf (09.10., E3)',
  }),
  mit(T('agenten-skills--*', 'Werkstatt der Heads je Haushalt (Business-Heads, Familie): Skills (Anleitung, Beispiele, Tests, Erfolgsquote), eigene Mitarbeiter, Gedächtnis (Merksätze) — wer angelegt/freigegeben hat (Speichername); Anleitungen können Dritte nennen → getilgt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — die Arbeitsweise der Agenten des Haushalts festhalten',
    art15: 'jedes Mitglied sieht die Skills der Heads, die es sehen darf (Agenten-Bereich); Konto › Meine Daten exportiert die eigenen Einträge (angelegt/freigegeben)',
    loeschfrist: 'solange der Skill bzw. Mitarbeiter besteht; beim Konto-Löschen wird der Speichername „[gelöscht]“ (Paket 3)',
  }),
  mit(T('agenten-skills-privat--*', 'Werkstatt der Privat-Heads je Person: Skills, eigene Mitarbeiter, Gedächtnis — nur die Person selbst sieht sie.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson); Gesundheitsbezug nur mit Einwilligung (b)',
    art15: 'die Person sieht und exportiert sie (Agenten-Bereich, Konto › Meine Daten)',
    loeschfrist: 'bis die Person sie bzw. ihr Konto löscht (Konto löschen entfernt den Bestand)',
  }),
  mit(T('agenten-plan--*', 'Geplante und wiederkehrende Hintergrundaufgaben je Person (Auftragstext, Zeitplan, Kostengrenze) — Nennungen Dritter getilgt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson)',
    art15: 'die Person sieht ihre Aufgaben unter „Hintergrund“ im Agenten-Bereich; Konto › Meine Daten exportiert den Bestand',
    loeschfrist: 'bis die Person die Aufgabe bzw. ihr Konto löscht',
  }),
  mit(H('agenten-einstellung--*', 'Einstellungen der Heads je Haushalt: an/aus, Modell, Aufwand, Budget, Autonomie-Stufe, Not-Aus, zuständige Person (Speichername), Foto (Kennung eines Mediums), eigener Auftrag an den Head (Freitext, 09.10.) — dazu je Person der Abschnitt ihrer Privat-Heads (nur sie selbst liest ihn; der Auftrag an den Gesundheits-Head kann Gesundheitsangaben tragen: gespeichert nur mit Einwilligung (a), an die KI nur mit (b)).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Betrieb der Software im Haushalt; der Auftrag an einen Head mit Gesundheitsbezug Art. 9 Abs. 2 lit. a (Einwilligung (a) zum Speichern, (b) an die KI)',
    art15: 'jedes Mitglied sieht die Einstellungen der Heads, die es sehen darf (Privat-Heads nur die eigenen); der eigene Abschnitt (mit Aufträgen), selbst geschriebene Aufträge an Heads des Haushalts und der eigene Speichername (zuständig, Not-Aus) stehen im Konto-Export',
    loeschfrist: 'solange die Instanz läuft bzw. bis der Auftrag geleert wird; beim Konto-Löschen fällt der eigene Abschnitt weg (samt Aufträgen an Privat-Heads) und der Speichername wird „[gelöscht]“ (Paket 4b)',
    kategorie: ['art9'],
  }),
  // Wissen der Business-Heads im Brain (09.10., „Aus dem Brain übernehmen“; Kevin: „Firma und Privat liegen getrennt — auch in der Datenhaltung“):
  // NUR Business — je Business-Head Ordner/Notizen des Vaults (Pfade, keine Inhalte) und der Agenten-Ordner des Firmen-Brains.
  mit(H('agenten-wissen--*', 'Wissen der Business-Heads je Haushalt: Pfade von Ordnern/Notizen im Brain (keine Inhalte), Modus, wer zuletzt geändert hat (Speichername); dazu der Agenten-Ordner des Brains für „Aus dem Brain übernehmen“. Nur Business — Privat-Heads haben hier nie einen Eintrag.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Betrieb der Software im Haushalt (Arbeitsweise der Business-Agenten)',
    art15: 'jedes Mitglied sieht das Wissen der Business-Heads, die es sehen darf; selbst gesetzte Einträge (mit Zeit) stehen im Konto-Export',
    loeschfrist: 'solange die Instanz läuft bzw. bis das Wissen entfernt wird; beim Konto-Löschen wird der Speichername „[gelöscht]“',
  }),
  // Medien unterwegs (09.10., Paket 5 V1; Kevins Antworten Fragerunde Teil 2): Kataloge (Metadaten, Personen im Bild, Freigaben, Einwilligungen) —
  // die Dateien liegen NIE im Datenordner-Bestand, sondern verschlüsselt je Segment im Medienspeicher (Hetzner Object Storage, ohne Einrichtung
  // `<daten>/medien`, von der Nachtsicherung ausgenommen). Bilder können Personen zeigen (Recht am Bild); Gesichtserkennung gibt es nicht.
  mit(T('medien--*', 'Medien des Business je Haushalt: Alben, Bild/Video-Metadaten (wer, wann, Album, Personen im Bild als Kennung, Freigabe fürs Marketing mit Kanälen/bis-Datum, an welche Heads mit Auftrag) und Einwilligungen abgebildeter Personen (Wortlaut, Fassung, Unterschrift verschlüsselt im Medienspeicher, Widerruf nur anhängend). Art. 17: Kennung „[gelöscht]“ → Medium sofort gesperrt + Prüf-Aufgabe (lib/medien/pflege.ts); die Dateien selbst liegen verschlüsselt im Medienspeicher.', 'medien-papierkorb'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Dokumentation und Öffentlichkeitsarbeit des Business, KUG-Wertungen § 23); Porträts, nicht öffentliche Veranstaltungen, Minderjährige (Sorgeberechtigte) und Beschäftigte nur mit Einwilligung (Art. 6 Abs. 1 lit. a, Art. 7) — Freigabe nur per Klick eines Menschen, Vier-Augen bei erkennbaren Personen',
    art15: 'Mitglieder sehen die Business-Medien (Fotos & Videos); Konto › Meine Daten: die selbst aufgenommenen, abgebildeten und bewerteten Medien als Metadaten mit Download-Weg und die eigenen Einwilligungen (lib/medien/export.ts); Kontakte: die Auskunft nennt Medien, auf denen sie markiert sind, und ihre Einwilligungen (lib/medien/datenschutz.ts `medienAuskunft`)',
    loeschfrist: 'Papierkorb 30 Tage (Frist „medien-papierkorb“), dann samt Dateien endgültig; Rohmaterial mit erkennbaren Personen, das 12 Monate nicht freigegeben wurde → Prüf-Aufgabe (Frist „medien-roh“, nie automatisch gelöscht); Freigaben enden am bis-Datum (gesperrt + Aufgabe); Konto löschen: Medien bleiben, Stempel der Person „[gelöscht]“',
  }),
  mit(T('medien-privat--*', 'Private Medien je Person (Alben „nur ich“ oder „Haushalt“, Bild/Video-Metadaten) — „nur ich“ sieht nur die Person, „Haushalt“ nur volle Mitglieder; Bezüge auf Dritte getilgt.', 'medien-papierkorb'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson); Familienfotos im Haushalt überwiegend persönlich-familiär (Art. 2 Abs. 2 lit. c) — nie ins Marketing ohne Umzug nach Business mit neuer Prüfung',
    art15: 'die Person sieht und exportiert sie (Fotos & Videos, Konto › Meine Daten)',
    loeschfrist: 'Papierkorb 30 Tage; sonst bis die Person sie bzw. ihr Konto löscht (Konto löschen entfernt Bestand und Dateien — lib/medien/datenschutz.ts)',
  }),
  mit(K('medien-uploads', 'Offene Upload-Sitzungen der Instanz (lib/medien/upload-server.ts): Speichername, Kennung, Größe, Prüfsummen und Salze der Stücke, gewickelter Schlüssel, Angaben zum Medium (Name, Aufnahmezeit, Album) bis zum Abschluss — keine Inhalte (die Stücke liegen verschlüsselt im Medienspeicher).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Hochladen auf Wunsch der Person)',
    art15: 'die Person sieht ihre laufenden Uploads in Fotos & Videos (Warteschlange)',
    loeschfrist: '7 Tage (Frist „medien-upload“) bzw. mit dem Abschluss; Konto löschen entfernt die Sitzungen der Person',
  }),
  mit({ muster: 'medien', bezug: 'dritte', behandlung: 'ausgenommen', frist: 'medien-papierkorb', grund: 'Dateien der Medien (Ordner <daten>/medien bzw. Hetzner Object Storage): nur Chiffrat je Segment unter zufälligen Namen, Schlüssel je Medium im Katalog — kein Bestand, nicht durchsuchbar. Art. 17 wirkt über den Katalog (medien--*): Medium gesperrt + Prüfung; endgültig gelöscht werden Dateien nur zusammen mit dem Eintrag (Papierkorb, Konto löschen). Von der Nachtsicherung ausgenommen.' }, {
    rechtsgrundlage: 'wie medien--* bzw. medien-privat--*',
    art15: 'über den Katalog (Fotos & Videos; Auskunft nennt die Medien, auf denen eine Person markiert ist)',
    loeschfrist: 'mit dem Eintrag im Katalog (Papierkorb 30 Tage); Zuschnitte sind eigene Medien „abgeleitet von“; Ende der Instanz: das Löschen der Instanz nimmt die Objekte im Speicher bzw. den Ordner mit (der Probelauf zeigt Anzahl und Größe)',
  }),
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
  mit(T('gesellschaften--*', 'Gesellschafts-Register des Haushalts (lib/gesellschaften): Firmendaten, Nummernkreise, Steckbrief, Gesellschafter, Organe, Beschluss-Buch (seit 10.10.: Nummer, Gremium, Beteiligte und Abstimmung NUR als Kennung eines Gesellschafter-/Organ-Eintrags mit festgehaltenem Gewicht, Wirkung, Verweise, Änderungen), Fassungen von Gegenstand & Satzung (Historie, `von` = Speichername eines Kontos), Beteiligungen, Verträge, Vermerke endgültig gelöschter Gesellschaften/Verträge (`geloescht`: Kennung, Name/Titel, Tag, Datei-Kennungen — damit der Bezug der aufbewahrten Unterlagen lesbar bleibt) — Dritte nur als Kontakt-/Firmen-Kennung; deren Kennung wird getilgt (auch in Papierkorb/Archiv/Vermerken), der Eintrag bleibt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Gesellschafterliste § 40 GmbHG, Aufbewahrung § 257 HGB / § 147 AO), lit. b (Verträge mit der Person), lit. f (Führung der eigenen Gesellschaften)',
    art15: 'Auskunft der Kontaktakte (GET /api/crm/datenschutz › gesellschaften: Gesellschafter, Organ, Vertragspartei, Beschluss-Beteiligung mit eigener Stimme — auch Papierkorb/Archiv, lib/gesellschaften/auskunft.ts)',
    loeschfrist: 'Papierkorb 30 Tage (Morgenlauf); sonst bis zur Löschung durch den Haushalt — Verträge/Beschlüsse als Geschäftsunterlagen 6 bzw. 10 Jahre (§ 257 HGB); Unterlagen in crm-dateien--* bleiben auch nach dem endgültigen Löschen einer Gesellschaft bzw. eines Vertrags (Aufbewahrungspflicht, Rückfrage mit Link „ansehen“)',
    kategorie: ['vertraulich'],
  }),
  // Unternehmen › Schild (10.10.): eigener Business-Bestand neben dem (gemischten) Register — nur Business-Gesellschaften, Personen nur als
  // Speichername eines Kontos des Haushalts (`von`, `verantwortlich`), keine Dritten, keine Passwörter.
  mit(H('unternehmen-schild--*', 'Unternehmen › Schild je Haushalt (lib/gesellschaften/schild): Profil der Business-Gesellschaften (Beschäftigte, Umsatz, Größenklasse, Tragfähigkeit), Pflichtdokumente (Status, Fassung, Ablauf, Datei-Kennungen der verschlüsselten Ablage), Vermerke „erledigt am“, Ereignisse, Risiko-Register mit Bewertungs-Verlauf, Marken, Domains (nie Zugangsdaten), Versicherungen, Entwürfe aus Vorlagen. Personen nur als Speichername eines Kontos des Haushalts.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Organisations- und Aufbewahrungspflichten der Gesellschaft, § 257 HGB / § 147 AO), lit. f (Führung und Risikofrüherkennung der eigenen Gesellschaften, § 1 StaRUG)',
    art15: 'die Personen des Haushalts sehen alles unter Unternehmen; „wer“ (Vermerk, Bewertung, Entwurf, verantwortlich) steht dort mit Namen',
    loeschfrist: 'Papierkorb 30 Tage (Morgenlauf); sonst bis zur Löschung durch den Haushalt — Belege in crm-dateien--* nach § 257 HGB; Konto löschen tilgt „wer“ („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  // Head of Recht (10.10., lib/recht): letzter Wochen-Check (Fristen, Ampeln, „was fehlt“ — aus Schild/Register gerechnet), vorbereitete Risikorunden,
  // Marken gegen Wiederholung, Checklisten-Riegel je Datei-Kennung, Kennungen erstellter Anwalts-Mappen. Keine Personen, keine Vertragstexte.
  mit(H('recht-check--*', 'Head of Recht je Haushalt (lib/recht): letzter Wochen-Check (Fristen, Pflichten-Ampel, was fehlt, Datenschutz-Zähler — nur Business-Gesellschaften), vorbereitete Risikorunden, Marken der Vorschläge, Riegel je Datei-Kennung der Vertrags-Checklisten, Datei-Kennungen erstellter Anwalts-Mappen. Keine Personen-Felder und keine Vertragstexte (die liegen verschlüsselt in der Ablage bzw. als Entwurf im Schild); Titel aus dem Schild (Risiken, Dokumente, Marken) stehen im Bericht, wie sie dort eingetragen sind.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Organisations- und Aufbewahrungspflichten der Gesellschaft), lit. f (Risikofrüherkennung der eigenen Gesellschaften, § 1 StaRUG) — keine Personen-Felder',
    art15: 'keine Personen-Felder — die Personen des Haushalts sehen den Check unter Unternehmen › Überblick (Titel wie im Schild)',
    loeschfrist: 'der Wochen-Check wird jede Woche ersetzt, Risikorunden je Quartal; Marken und Riegel rollend (höchstens 500); mit der Instanz gelöscht',
  }),
  // Gesundheits-Verlauf des Schilds (11.10., lib/gesellschaften/schild/verlauf.ts): je Tag Ton + vier Dimensionen je Business-Gesellschaft — nur Zahlen.
  K('unternehmen-verlauf--*', 'Gesundheits-Verlauf des Schilds je Haushalt (lib/gesellschaften/schild/verlauf.ts, Morgenlauf): je Tag Ton und vier ganze Prozentzahlen (Dokumente, Pflichten, Risiken, Schutz) je Business-Gesellschaft, nur deren Kennung — keine Personen, keine Titel; rollend 400 Tage, mit der Instanz gelöscht.'),
  // Formulare „Angebot anfordern“ (25.10., lib/crm/formulare-speicher.ts): Einstellungen, externe Links (Name/Adresse des Vertrieblers, Token nur als
  // Fingerabdruck), Eingänge (nur Kennungen von Kontakt/Firma/Deal/Angebot, Empfänger als Fingerabdruck + maskiert, Status, Gründe ohne Kundendaten).
  mit(T('angebot-formular--*', 'Formular „Angebot anfordern“: Einstellungen (Absender-Postfach als Kennung, Mail-Vorlage), externe Links (Name und optional Adresse des Vertrieblers, freigegebene Produkte, Ablauf, Fingerabdruck des Tokens), Eingänge (Kennungen von Kontakt/Firma/Deal/Angebot, Empfänger nur als Fingerabdruck und maskiert, Status, Leitplanken-Gründe, Versand-Vermerk). Art. 17 eines Kontakts tilgt seine Kennung am Eingang (person-weitere.ts), der Nachweis der Sendung bleibt.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags auf Anfrage des Kunden über den Vertrieb); für die Vertriebler-Angaben Art. 6 Abs. 1 lit. b/f (Zusammenarbeit im Vertrieb)',
    art15: 'Kontakte: die Eingänge der Person zählen in der Auskunft nach Art. 15 (weitere Speicher, person-weitere.ts); Vertriebler: unter Markttraktion › Formulare (Inhaber) — auf Anfrage über den Inhaber',
    loeschfrist: 'Eingänge 24 Monate (rollend beim Schreiben, `EINGANG_FRIST_MONATE`); Links bis der Inhaber sie entfernt; die Angebote selbst als Geschäftsunterlage im CRM (§ 257 HGB)',
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
  mit({ muster: 'finanzplan', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Rechnungen/Buchungen — Aufbewahrungspflicht § 147 AO / § 257 HGB (Kundenname auf der Rechnung bleibt). Seit 08.10. tragen Rechnungen mit PDF eine Momentaufnahme des Empfängers (Name, Anschrift, USt-IdNr., Referenz) und optional die Kontakt-Kennung; das PDF liegt als Beleg in crm-dateien--* (fester Bezug, nicht löschbar).' }, {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag mit dem Kunden) und lit. c i. V. m. § 14 UStG, § 147 AO, § 257 HGB (Rechnungspflicht, Aufbewahrung)',
    art15: 'Rechnungen an eine Person (Kontakt-Kennung) nennt die Auskunft (`personAufzaehlen` › rechnungen); sonst Finanzen › Rechnungen & Zahlungen bzw. Kontakt › Umsatz',
    loeschfrist: '10 Jahre ab Ende des Jahres der Rechnung (§ 147 AO); Art. 17 löscht in dieser Zeit nicht (Art. 17 Abs. 3 lit. b) — Entwürfe ohne Nummer löscht der Haushalt selbst',
  }),
  mit(K('rechnungswesen', 'Nummernkreise der Rechnungen (je Gesellschaft und Jahr die zuletzt vergebene laufende Nummer) und die Mahnstufen-Tage — keine Personen.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 14 Abs. 4 Nr. 4 UStG (fortlaufende Nummer) — enthält keine personenbezogenen Daten',
    art15: 'keine Personendaten',
    loeschfrist: 'solange Rechnungen gestellt werden (Zähler je Jahr)',
  }),
  { muster: 'finanzen-plan--*', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Finanzplan des Haushalts — Rechnungen: Aufbewahrungspflicht § 147 AO / § 257 HGB.' },
  { muster: 'liquiplan', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Planposten/Zahlungen — Geschäftsunterlage, Aufbewahrungspflicht § 147 AO.' },
  { muster: 'buchungen', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Buchungen — Aufbewahrungspflicht § 147 AO / § 257 HGB.' },
  { muster: 'finance', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Controlling-Zahlen, Rechnungen — Aufbewahrungspflicht § 147 AO.' },
  { muster: 'grundlage', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Finanz-Export aus dem früheren Finanz-Dashboard (Original, nur gelesen) — Buchführung, Aufbewahrungspflicht.' },
  K('business-abschluesse', 'Monatszahlen der Gesellschaften — keine Personen.'),
  // Daten-Assistenten (09.10., B9 a/c): Lauf-Protokolle für „Rückgängig“ — nur Kennungen, Fingerabdrücke, Gesellschaft, Monate und Zahlen der
  // Gesellschaften (alte/neue Werte der eingefügten Felder); keine Namen, keine Personen (wer eingefügt hat, steht im Abschluss bzw. Änderungsprotokoll).
  K('abschluss-laeufe', 'Lauf-Protokoll der aus Excel/BWA eingefügten Monatsabschlüsse (Rückgängig): Gesellschaft, Monate, alte/neue Zahlen — keine Personen.'),
  K('mandate-tabelle-laeufe', 'Lauf-Protokoll der aus einer Tabelle eingefügten Mandate (Rückgängig): Kennungen, Fingerabdrücke, alte Zahlenwerte — keine Namen, keine Personen.'),
  // 0-Punkt (05.10.): Eröffnung je Gesellschaft — offene Posten tragen Namen von Kunden/Gläubigern (wie Rechnungen im Finanzplan).
  mit({ muster: 'business-eroeffnung', bezug: 'dritte', behandlung: 'ausgenommen', grund: 'Eröffnung (0-Punkt) der Gesellschaften: Stichtag, Kontostand, offene Forderungen/Verbindlichkeiten mit Namen von Kunden/Gläubigern — Buchführung, Aufbewahrungspflicht § 147 AO / § 257 HGB; Historie bleibt (Rückgängig markiert nur).' }, {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 147 AO / § 257 HGB (Buchführung); Art. 6 Abs. 1 lit. b für Kunden/Lieferanten',
    art15: 'Auskunft über den Inhaber (Finanzen › Business › Überblick › 0-Punkt zeigt jede Zeile mit Namen)',
    loeschfrist: 'Ablauf der Aufbewahrungsfrist (10 Jahre nach Ende des Geschäftsjahres)',
  }),
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
  H('zeit', 'Zeit & Fokus (Erstkonto) — eigene Messung des Haushalts.'),
  H('zeit--*', 'Zeit & Fokus je Person — eigene Messung des Haushalts.'),
  H('fokus-laufend--*', 'Laufender Fokus-Block je Person.'),
  H('wochenplan--*', 'Alter Wochenplan je Person (bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('wochenplan-uebernahme', 'Stand der Übernahme alter Wochenplan-Blöcke in den Kalender (K5): nur Block-Kennung → Termin-UID, keine Titel.'),
  K('zulieferer-uebernahme', 'Stand der einmaligen Übernahme der Apple-Erinnerungen als Aufgaben (08.10., Lücke 10, lib/zulieferer/server.ts): nur Zeitpunkte und Zahlen (wann bestätigt, wie viele neu/schon da, wann der Spiegel gelöscht wurde) — keine Titel, keine Namen, keine Person; die Aufgaben selbst liegen in `tasks`.'),
  mit(H('sport', 'Sport (Erstkonto) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('sport--*', 'Sport je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('vitals', 'Körperwerte (Erstkonto, Whoop) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  // Kapazität (04.10.) liest daraus NUR den Ø-Recovery-Wert, NUR mit eigener Einwilligung der Person und wenn sie mit allen Konten teilt, und nur als
  // Team-Faktor (lib/kapazitaet/server.ts); nie in Business-Index, ZOE oder Protokolle (`ohneGesundheit`, Test kapazitaet-route).
  mit(H('vitals--*', 'Körperwerte je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  // 10.10. (Inventur Trennung): der Name entsteht über speicherFuer('gesundheit-index', person) — der Scanner sah ihn nicht.
  mit(H('gesundheit-index', 'Gesundheits-Index (Erstkonto) — Verlauf und Schwellen aus eigenen Gesundheitswerten.'), GESUNDHEIT),
  mit(H('gesundheit-index--*', 'Gesundheits-Index je Person — Verlauf und Schwellen aus eigenen Gesundheitswerten.'), GESUNDHEIT),
  // Die zwei Scores (21.10.): der Privat-Score je Person — ein Schnappschuss am Tag (Index, Säulen, Kennzahl-Werte, Ampeln) und eigene Schwellen.
  // Er trägt den eigenen Gesundheits-Index als Säule (Art. 9) — darum wie die Gesundheit; nur die Person selbst sieht ihn (GET /api/scores).
  mit(H('privat-score--*', 'Privat-Score je Person (Zahlen je Tag: Gesundheits-Index, Privat-Index, Planung, Pflege-Rhythmus) — nur die Person selbst, auch bei „Teilen“ nie andere Konten.'), {
    ...GESUNDHEIT,
    art15: 'nur die Person selbst sieht ihren Privat-Score (Heute, /os/score); Konto › Meine Daten exportiert den Bestand — auch bei „Teilen“ nie andere Konten',
    loeschfrist: 'rollend 400 Tage (ältere Tage fallen beim Schreiben heraus); Konto löschen entfernt den Bestand samt Tageskopien',
  }),
  mit(H('haut', 'Symptom-Tagebuch (Erstkonto; Modul je Person, 09.10.) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('haut--*', 'Symptom-Tagebuch je Person (Modul) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  // Körper-Profil (08.10. abends, Fragebogen Teil 3): Leitsatz, Beschwerden, Hebel, Stufenplan, Zusammenhänge, Anzeige-Einstellungen —
  // NUR die Person selbst (auch bei „Teilen“ nicht), an die KI nur über eigenerGesundheitsKontext mit Einwilligung (b).
  mit(H('gesundheit-koerper', 'Körper-Profil (Erstkonto) — eigene Gesundheitsdaten, nur die Person selbst.'), KOERPER),
  mit(H('gesundheit-koerper--*', 'Körper-Profil je Person — eigene Gesundheitsdaten, nur die Person selbst.'), KOERPER),
  // Erholung je Person (10.10., lib/gesundheit/erholung*.ts): eigene Programme, erledigte Einheiten, Behandlungsserien (Termin-Verweise nur als
  // Kennung, Unterlagen nur als `gu-…`), Erholungs-Ziele, Fokus-Satz, Pausen-Einstellung — IMMER mit Suffix. Andere Konten nur bei „Teilen“ (lesen,
  // ohne Unterlagen-/Termin-Verweise), an die KI nur mit Einwilligung (b) über gatherBrain.
  mit(H('erholung--*', 'Erholung je Person (Programme, Einheiten, Behandlungsserien, Erholungs-Ziele, Fokus-Satz, Pausen) — eigene Gesundheitsdaten (Art. 9).'), {
    ...GESUNDHEIT,
    art15: 'die Person sieht, pflegt und exportiert ihre Erholung selbst (Gesundheit › Erholung, Konto › Meine Daten); andere Konten nur lesend bei „Teilen“ (ohne Unterlagen- und Kalender-Verweise)',
  }),
  // Gesundheits-Unterlagen (09.10., lib/gesundheit/unterlagen*.ts): Metadaten je Person, Dateien verschlüsselt im Ordner `gesundheit-unterlagen`.
  mit(H('gesundheit-unterlagen--*', 'Gesundheits-Unterlagen je Person (Metadaten: Name, Art, Größe, Zeitpunkt, Prüfsumme, eigene Notiz) — die Dateien (Arztbrief, Laborwerte, Trainingsplan; können Ärztinnen/Ärzte nennen) liegen verschlüsselt in <daten>/gesundheit-unterlagen. Nur die Person selbst, auch bei „Teilen“ nie andere Konten; der Text geht nur an IHREN Gesundheits-Head und nur mit Einwilligung (b).'), {
    ...KOERPER,
    art15: 'nur die Person selbst sieht, lädt herunter und löscht ihre Unterlagen (Gesundheit › Unterlagen, Agenten › Gesundheit › Info); Konto › Meine Daten exportiert die Liste, die Dateien einzeln über den Download',
    loeschfrist: 'bis die Person sie löscht bzw. ihr Konto entfernt wird (dann samt Dateien); nach Widerruf von (a) kommt nichts Neues hinzu, nach Widerruf von (b) liest kein Agent sie mehr',
  }),
  mit({ muster: 'gesundheit-unterlagen', bezug: 'haushalt', behandlung: 'ausgenommen', grund: 'Dateien der Gesundheits-Unterlagen (<daten>/gesundheit-unterlagen, verschlüsselt wie die Dateiablage, Name gu-<uuid>.bin) — kein Bestand; Verweis und Art. 15/17 über gesundheit-unterlagen--<person>.' }, {
    ...KOERPER,
    art15: 'über die Metadaten (gesundheit-unterlagen--<person>) — Download nur durch die Person selbst',
    loeschfrist: 'mit dem Eintrag (Löschen der Unterlage bzw. Konto löschen entfernt die Datei)',
  }),
  // Zähler „Sauber geblieben“ (Modul `serie`, 09.10.): Gesundheitsdaten wie das Symptom-Tagebuch (Schreiben nur mit Einwilligung (a)).
  mit(H('streak', 'Zähler „Sauber geblieben“ (Erstkonto; Modul je Person) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('streak--*', 'Zähler „Sauber geblieben“ je Person (Modul) — eigene Gesundheitsdaten.'), GESUNDHEIT),
  mit(H('health-log--*', 'Gesundheits-Log je Person — eigene Gesundheitsdaten.'), GESUNDHEIT),
  // Routinen 2 (10.10., lib/planung/routinen-person.ts): je Person Zähler je Tag und Routine („5 von 8 Gläsern“), die eigene Einstellung
  // „Erinnerungen aufs Handy“, der Riegel gesendeter Erinnerungen (nur die letzten Tage) und die Kennungen der Kalender-Blöcke, die MAKE OS für
  // ihre Routinen angelegt hat — IMMER mit Suffix. Zähler von Gesundheits-Routinen sind Gesundheitsdaten (wie der Gesundheits-Log).
  mit(H('routinen-person--*', 'Routinen je Person: Zähler je Tag (z. B. Gläser Wasser), Einstellung „Erinnerung aufs Handy“, Riegel der Erinnerungen, Kennungen eigener Routinen-Blöcke im Kalender — eigene Gesundheitsdaten (Art. 9).'), {
    ...GESUNDHEIT,
    art15: 'die Person sieht ihre Zähler in Gesundheit › Heute, Planung › Routinen und auf Heute; Konto › Meine Daten exportiert den Bestand; andere Konten sehen die Zähler nur bei „Teilen“',
  }),
  // Journal (09.10.): trägt jetzt auch den Tages-Check „wie im WHOOP-Journal“ (Alkohol, Koffein spät … — Gesundheitsdaten) — seitdem mit den
  // Angaben für Gesundheitsdaten (die Route nahm schon vorher Einwilligung (a) und das Teilen-Tor).
  mit(H('journal--*', 'Journal je Person — Abendfragen, Stimmung/Energie/Anspannung und Tages-Check (Frage → ja/nein); eigene Gesundheitsdaten.'), GESUNDHEIT),
  // Gesundheit im Alltag (09.10., lib/gesundheit/alltag.ts): Einstellungen der Schlaf-Hilfe (Aufstehzeit heute/Ziel, Schrittweite, Schlafziel,
  // Erinnerung), gewählte Check-Fragen, Orientierung an/aus, welche eigenen Routinen aus einer Ergänzungs-Vorlage stammen; Riegel der
  // Abend-Erinnerung. NUR die Person selbst (auch bei „Teilen“ nie andere Konten).
  mit(H('gesundheit-alltag', 'Gesundheit im Alltag (Erstkonto): Einstellungen der Schlaf-Hilfe, des Tages-Checks und der Essens-Orientierung — nur die Person selbst.'), {
    ...KOERPER,
    art15: 'nur die Person selbst sieht und ändert ihre Einstellungen (Gesundheit › Schlaf-Hilfe, Tages-Check, Essen & Trinken); Konto › Meine Daten exportiert sie',
  }),
  mit(H('gesundheit-alltag--*', 'Gesundheit im Alltag je Person: Einstellungen der Schlaf-Hilfe, des Tages-Checks und der Essens-Orientierung — nur die Person selbst.'), {
    ...KOERPER,
    art15: 'nur die Person selbst sieht und ändert ihre Einstellungen (Gesundheit › Schlaf-Hilfe, Tages-Check, Essen & Trinken); Konto › Meine Daten exportiert sie',
  }),
  H('steuern', 'Eigene Steuern des Haushalts (Einstellungen, Vorauszahlungen).'),
  H('haushalt-*--*', 'Haushaltsfinanzen (Konten, Buchungen, Rechnungen) — eigene Daten des Haushalts.'),
  // Konten-Register (08.10.): EIN Ort für Konten und Kontostände (Gesellschaften, privat, gemeinsam) — Name, Art, Bank, IBAN (nur maskiert ausgeliefert),
  // Stände mit Datum und „erfasst von“. Keine Dritten. Konto löschen: Konten bleiben (Daten des Haushalts), die Personen-Kennung wird „[gelöscht]“.
  mit(H('konten--*', 'Konten-Register je Haushalt (Konten der Gesellschaften, private und gemeinsame Konten, Kontostände mit Datum) — eigene Daten des Haushalts; IBAN verschlüsselt im Bestand, nach außen nur maskiert.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — die eigenen Finanzen des Haushalts führen; für die Konten der Gesellschaften zusätzlich lit. c i. V. m. § 147 AO / § 257 HGB (Buchführung)',
    art15: 'jede berechtigte Person sieht die Konten unter Finanzen › Privat › Konten & Buchungen bzw. Business › Liquidität; Konto › Meine Daten exportiert die eigenen Konten (IBAN maskiert)',
    loeschfrist: 'solange der Haushalt das Konto führt; Stände werden nie gelöscht, nur zurückgenommen (Nachweis); Konto löschen tilgt die Personen-Kennung',
    kategorie: ['vertraulich'],
  }),
  // Kontoauszug einlesen (09.10., B9 d): je Lauf NUR Kennungen der angelegten Buchungen + Fingerabdrücke, Zahlen, Zeitraum und wer eingelesen hat —
  // nie Namen der Gegenseite, Verwendungszwecke oder IBANs (die stehen in den Buchungen selbst; die Datei wird nie gespeichert).
  mit(H('kontoauszug-laeufe--*', 'Lauf-Protokoll der eingelesenen Kontoauszüge je Haushalt (für „Rückgängig“): Kennungen, Fingerabdrücke, Zahlen, Zeitraum, Speichername der Person — keine Daten Dritter.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — die eigenen Finanzen des Haushalts führen und Übernahmen nachvollziehbar zurücknehmen können; für Gesellschafts-Konten zusätzlich lit. c i. V. m. § 147 AO (Buchführung)',
    art15: 'die Person sieht die Läufe am Konto (Konten › Kontoauszug einlesen › Verlauf); Konto › Meine Daten exportiert die selbst ausgelösten',
    loeschfrist: 'abgeschlossene Läufe 400 Tage (danach kein Rückgängig mehr, die Buchungen bleiben); Konto löschen tilgt den Speichernamen („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
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
  // Je Person seit 08.10. spät (Datenschutz vor dem Upload): Altbestand ohne Suffix nur beim Inhaber (lib/zoe/raum.ts `eigenerSpeicher`).
  mit(H('gesundheitszeit', 'Gesundheits-Zeit (Schalter an/aus, nur Uhrzeiten) — Altbestand ohne Suffix, gehört dem Inhaber.'), GESUNDHEIT),
  mit(H('gesundheitszeit--*', 'Gesundheits-Zeit je Person (Schalter an/aus, nur Uhrzeiten) — liest und schaltet nur die Person selbst.'), GESUNDHEIT),
  mit(H('health-log', 'Eigene Gesundheitsdaten des Haushalts.'), GESUNDHEIT),
  mit(H('journal', 'Journal (Erstkonto) — Abendfragen, Stimmung/Energie/Anspannung und Tages-Check; eigene Gesundheitsdaten.'), GESUNDHEIT),
  H('routinen', 'Eigene Routinen des Haushalts.'),
  H('ziele', 'Eigene Ziele/Fokus des Haushalts.'),
  H('ziele-eigen', 'Persönliche Ziele der ersten Person (Altname ohne Suffix) — eigene Planung, keine Dritten (gelesen u. a. von den Lichtfäden).'),
  H('ziele-eigen--*', 'Persönliche Ziele je Person — eigene Planung, keine Dritten.'),
  // Nordstern je Haushalt (08.10. abends, Fragebogen Teil 3): ein Freitext, den die Mitglieder selbst pflegen (Planung › Jahr) — kein
  // Personen-FELD (wer geändert hat, steht nur im Änderungsprotokoll), keine Dritten; der Text selbst kann aber Vornamen der Mitglieder
  // nennen (auch der übernommene Altbestand tut das). Konto löschen tilgt im Freitext nicht automatisch. Dazu die Marken der einmaligen
  // Übernahme des Altbestands (nur Tage, lib/altbestand/nordstern-uebernahme.ts).
  mit(H('nordstern--*', 'Nordstern des Haushalts — gemeinsames Ziel, von den Mitgliedern selbst gepflegt; Freitext ohne Personen-Feld (kann Vornamen der Mitglieder nennen), keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Nutzung der Planung durch die Mitglieder des Haushalts',
    art15: 'alle Konten des Haushalts sehen ihn unter Planung › Jahr (Business-Konten lesend); als Freitext kann er Vornamen der Mitglieder nennen',
    loeschfrist: 'bis der Haushalt ihn leert bzw. die Instanz gelöscht wird; Art. 17 (Konto löschen) tilgt im Freitext nicht automatisch — einen Namen darin entfernen die übrigen Mitglieder unter Planung › Jahr (Text bearbeiten)',
  }),
  // Fokus je Bereich (09.10., Kevin: „Firma und Privat müssen immer getrennt liegen — auch von den Daten“): Unser Fokus je Haushalt getrennt
  // nach Privat und Business, Mein Fokus je Person (Privat und Business getrennt) — Freitext der Mitglieder, keine Dritten (lib/planung/fokus.ts).
  mit(H('fokus-privat--*', 'Unser Fokus · Privat je Haushalt — ein Satz je Horizont, von den Mitgliedern selbst gepflegt; Freitext ohne Personen-Feld, keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Nutzung der Planung durch die Mitglieder des Haushalts',
    art15: 'die vollen Mitglieder des Haushalts sehen ihn auf der Fokus-Seite (Knopf oben rechts) und auf Heute (Privat)',
    loeschfrist: 'bis der Haushalt ihn leert bzw. die Instanz gelöscht wird; Konto löschen tilgt im Freitext nicht automatisch — die übrigen Mitglieder ändern ihn auf der Fokus-Seite (Knopf oben rechts)',
  }),
  mit(H('fokus-business--*', 'Unser Fokus · Business je Haushalt und Gesellschaft — ein Satz je Horizont; Freitext ohne Personen-Feld, keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung der Gesellschaften durch die Mitglieder des Haushalts',
    art15: 'alle Konten des Haushalts sehen ihn auf der Fokus-Seite (Business) und auf Heute (Business-Konten lesend)',
    loeschfrist: 'bis der Haushalt ihn leert bzw. die Instanz gelöscht wird',
  }),
  mit(H('fokus-eigen--*', 'Mein Fokus · Privat je Person — eigene Sätze je Horizont, einzelne mit den anderen Mitgliedern geteilt (`geteilt`); keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — die Person plant für sich selbst',
    art15: 'Konto-Export (PERSON_BESTAENDE); sichtbar nur der Person selbst und, je Satz geteilt, den anderen vollen Mitgliedern des Haushalts',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand)',
  }),
  mit(H('fokus-eigen-business--*', 'Mein Fokus · Business je Person — eigene Sätze je Horizont, einzelne geteilt (`geteilt`); keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG — die Person plant ihre Arbeit selbst',
    art15: 'Konto-Export (PERSON_BESTAENDE); sichtbar nur der Person selbst und, je Satz geteilt, den anderen vollen Mitgliedern des Haushalts',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand)',
  }),
  // Fokus-Steuerung (10.10., Entscheidung: „Prio und Fokus geben wir im Fokus-Bereich … Zeit — Privat wie Business einzeln“): Themen je Haushalt
  // getrennt nach Privat und Business, Soll-Zeit je Person getrennt nach Privat und Business — nur Themen-Namen, Gewichte, Stunden (lib/fokus/steuerung.ts).
  mit(H('fokus-steuerung-privat--*', 'Prioritäten · Privat je Haushalt — Themen (Name, Rang, Gewicht, Zeit-Quellen), von den Mitgliedern gepflegt; keine Dritten, kein Personen-Feld.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung des Haushalts durch seine Mitglieder',
    art15: 'die vollen Mitglieder des Haushalts sehen sie unter Fokus › Prioritäten (Privat)',
    loeschfrist: 'bis der Haushalt sie ändert bzw. die Instanz gelöscht wird',
  }),
  mit(H('fokus-steuerung-business--*', 'Prioritäten · Business je Haushalt — Themen (Name, Rang, Gewicht, Zeit-Quellen, je Business-Gesellschaft); keine Dritten, kein Personen-Feld.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung der Gesellschaften durch die Mitglieder des Haushalts',
    art15: 'alle Konten des Haushalts sehen sie unter Fokus › Prioritäten (Business), Konten „nur Business“ lesend',
    loeschfrist: 'bis der Haushalt sie ändert bzw. die Instanz gelöscht wird',
  }),
  mit(H('fokus-soll-privat--*', 'Soll-Zeit · Privat je Person — Stunden je Woche und Thema (nur Zahlen, Kennung des Themas); sieht nur die Person selbst.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — die Person plant ihre Zeit selbst',
    art15: 'Konto-Export (PERSON_BESTAENDE); sichtbar nur der Person selbst (Fokus › Zeit)',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand)',
  }),
  mit(H('fokus-soll-business--*', 'Soll-Zeit · Business je Person — Stunden je Woche und Thema (nur Zahlen, Kennung des Themas); sieht nur die Person selbst.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG — die Person plant ihre Arbeitszeit selbst',
    art15: 'Konto-Export (PERSON_BESTAENDE); sichtbar nur der Person selbst (Fokus › Zeit)',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand)',
  }),
  H('meilensteine', 'Eigene Meilensteine des Haushalts.'),
  // Eigene Meilensteine an eigenen Zielen (10.10., Kevin: „Ja, eigene Meilensteine“ — lib/planung/eigene-meilensteine.ts): je Person, immer
  // Privat, Titel/Datum/Fortschritt der eigenen Planung; keine Dritten, kein Personen-Feld.
  mit(H('meilensteine-eigen--*', 'Eigene Meilensteine je Person an ihren eigenen Zielen (Titel, Datum, Fortschritt) — immer Privat; sichtbar nur der Person selbst und, je Ziel geteilt, den anderen vollen Mitgliedern des Haushalts; keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — die Person plant für sich selbst',
    art15: 'Konto-Export (PERSON_BESTAENDE); sichtbar nur der Person selbst und, je eigenem Ziel geteilt, den anderen vollen Mitgliedern des Haushalts (Planung › Ziele)',
    loeschfrist: 'bis die Person sie löscht bzw. mit dem Konto (Konto löschen entfernt den Bestand)',
  }),
  // Austausch am Meilenstein (30.09.): Verlauf, Notiz, Links — Texte können Dritte nennen (Kunden, Partner) → getilgt.
  T('meilenstein-raum--*', 'Verlauf/Notiz/Links je Meilenstein — bleiben, Namen/Adressen der Person getilgt (lib/crm/person-weitere.ts).'),
  H('kompass', 'Eigener Kompass des Haushalts.'),
  H('wochenplan', 'Alter Wochenplan (bis 29.09., K5) — nur noch Archiv; liest allein die Übernahme in den Kalender.'),
  H('anwesenheit', 'Wer vom Haushalt gerade online ist.'),
  H('nutzung', 'Nutzung der Oberfläche durch den Haushalt (Zähler).'),
  H('aenderungen', 'Altes Browser-Änderungsprotokoll (nur Person des Haushalts, Bestand, Seite) — nur gelesen.'),
  // Arbeits-Schalter je Person seit 08.10. spät — Altbestand ohne Suffix nur beim Inhaber.
  mit(H('arbeitsmodus', 'Arbeits-Schalter (an/aus, nur Uhrzeiten) — Altbestand ohne Suffix, gehört dem Inhaber.'), ARBEITSZEIT),
  mit(H('arbeitsmodus--*', 'Arbeits-Schalter je Person (an/aus, nur Uhrzeiten) — liest und schaltet nur die Person selbst.'), ARBEITSZEIT),
  // Business-frei (08.10., Lücke 7): eigene Ergänzung des Arbeitsrahmens — nur Wochentage und Uhrzeiten, keine Inhalte, keine Dritten.
  mit(H('arbeitsrahmen--*', 'Eigene Business-freie Zeitfenster je Person (Wochentage + Uhrzeiten, Zeitpunkt der letzten Änderung) — ergänzen die gemeinsamen Zeiten der Familie, nur die Person selbst liest und schreibt sie.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG — die Person legt ihren eigenen Arbeitsrahmen selbst fest',
    art15: 'die Person sieht und ändert ihre Zeiten unter Familie › Rahmen (GET /api/arbeitsrahmen liefert nur die eigenen); Konto › Meine Daten exportiert sie',
    loeschfrist: 'bis die Person sie leert; Konto löschen entfernt den Bestand',
    kategorie: ['beschaeftigte'],
  }),
  H('arbeitsplatz', 'Arbeitsplatz-Einstellungen des Haushalts.'),
  mit(H('konten', 'Konten der Nutzer (Name, Hauptadresse und bis zu drei weitere Anmelde-Adressen, Passwort-Hash, zweiter Faktor samt gemerkter Geräte — je Gerät nur Hash des Tokens, grobe Beschreibung aus dem Browser, angelegt/zuletzt/Ablauf, höchstens 10, je 90 Tage, nie die IP) — Art. 15: die Person sieht ihre Adressen unter Einstellungen › Konto › Anmelde-Adressen und ihre gemerkten Geräte unter Konto › Zweiter Faktor, Art. 16/17 über das Konto (Adressen selbst ändern bzw. entfernen, Geräte vergessen; Konto löschen nimmt beides mit).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der Anwendung) bzw. § 26 BDSG für Beschäftigte; lit. f (Sicherheit)',
    art15: 'Konto › Meine Daten: Auskunft (HTML), „Meine Daten herunterladen“ (JSON, alle Bestände laut Register — lib/datenschutz/konto-daten.ts); nie Hash, Salz, zweiter Faktor',
    loeschfrist: 'bis die Person „Mein Konto löschen“ wählt (Konto › Meine Daten; Inhaber erst ohne andere Konten) bzw. die Instanz endet (Löschen der Instanz); Grabstein (nur Fingerabdruck der Konto-Kennung) 13 Monate',
  }),
  H('team--*', 'Team des Haushalts (Rollen/Namen der Mitglieder; `deaktiviertAm` = Beginn der 30-Tage-Frist für die Kapazitätsdaten, setzt nur der Server).'),
  mit(H('kapazitaet--*', 'Kapazität je Haushalt (04.10.): Grundwert und Ausnahmen (Urlaub, feste Blöcke) je Team-Person, Zuweisungen Person × Mandat/Kunde (nur CRM-Kennungen, keine Namen Dritter) — eigene Planung des Haushalts. Gespeichert wird KEIN Gesundheitswert (die Erholung wird beim Rechnen aus vitals--* gelesen, nur mit Einwilligung + Teilen, nur als Team-Faktor); `erholungAm` = Zeitpunkt der Einwilligung (Nachweis).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Planung der Arbeitszeit im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (realistische Planung); Erholung: Art. 9 Abs. 2 lit. a — eigene Einwilligung der Person (`erholungAm`, Schalter in der Kapazität, Vorgabe aus) UND Teilen mit allen Konten (siehe vitals--*)',
    art15: 'GET /api/kapazitaet zeigt der Person ihre Werte samt eigener Ausnahme-Titel; als Datei GET /api/kapazitaet?auskunft=<person> (Konto: nur die Person selbst; Team-Person ohne Konto: der Inhaber, auch deaktiviert) und in der Kontakt-Auskunft (`personAufzaehlen.kapazitaet`, Zuordnung über die E-Mail der Team-Person) — lib/kapazitaet/aufraeumen.ts',
    loeschfrist: 'Ausnahmen/Zuweisungen bis zur Löschung durch Person bzw. Inhaber (Planung › Kapazität); Team-Person ohne Konto: 30 Tage nach dem Deaktivieren automatisch (Morgenlauf `kapaDeaktivierteAufraeumen`, Zeitpunkt `deaktiviertAm` am Team-Eintrag, Reaktivieren davor erhält alles); Konto entfernt: beim nächsten Morgenlauf (`kapaEntfernteKontenAufraeumen`, 05.10.)',
    kategorie: ['beschaeftigte'],
  }),
  mit(H('kapazitaet-plan--*', 'Festgehaltene Wochenpläne je Haushalt (seit 05.10.): montags je Person verfügbare Zeit (Netto, OHNE Erholungs-Faktor), geplante Stunden und gebundene Stunden, je Meilenstein/Ziel und Zuweisung nur als Kennung — Grundlage der Plan-Treue „geplant vs. Ist“ (lib/kapazitaet/plan.ts). Kein Gesundheitswert, keine Namen.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Arbeitszeitplanung im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (Vergleich Plan gegen Umsetzung)',
    art15: 'in der Kapazitäts-Auskunft `wochenplaene` (GET /api/kapazitaet?auskunft=<person>, Rechte wie dort; Kontakt-Auskunft für Team-Personen ohne Konto) — lib/kapazitaet/aufraeumen.ts',
    loeschfrist: '24 Monate je Woche (Morgenlauf „Wochenplan festhalten“, `PLAN_LOESCHEN_NACH_MONATEN`); Team-Person ohne Konto: ihre Zeilen 30 Tage nach dem Deaktivieren mit den übrigen Kapazitätsdaten (`kapaDeaktivierteAufraeumen`). Konto entfernt: beim nächsten Morgenlauf (`kapaEntfernteKontenAufraeumen`, 05.10.)',
    kategorie: ['beschaeftigte'],
  }),
  H('oauth-tokens', 'Zugangsschlüssel des Inhabers (Microsoft 365; ein alter WHOOP-Eintrag wird seit 08.10. einmal in whoop-verbindung--<inhaber> übernommen und hier gelöscht) — keine Dritten.'),
  H('oauth-states', 'Kurzlebige OAuth-Zustände — keine Dritten.'),
  H('ki-verbrauch', 'Kosten der Modellaufrufe je Person des Haushalts.'),
  // ── KI, Gesundheit, Telegram (05.10., DSGVO-Paket; lib/datenschutz/) ──
  mit(H('gesundheit-einwilligungen', 'Nachweis der Art.-9-Einwilligungen Gesundheit je Person (Zweck a/b/c, an/aus, Zeitpunkt, Fassung, Fingerabdruck des Wortlauts, wer) — nur anhängend, nie geändert (lib/datenschutz/gesundheit-einwilligung.ts). Keine Gesundheitswerte.'), {
    rechtsgrundlage: 'Art. 7 Abs. 1 DSGVO (Nachweis der Einwilligung) i. V. m. Art. 6 Abs. 1 lit. c',
    art15: 'GET /api/datenschutz/gesundheit (eigener Nachweis), Einstellungen › Datenschutz',
    loeschfrist: 'solange das Konto besteht; danach 3 Jahre (Nachweis, Verjährung § 195 BGB) — automatisches Löschen nach Kontoende noch offen',
  }),
  mit(H('ki-einstellungen', 'KI-Schalter der Instanz (Inhaber) und je Person (Hintergrund-KI, Web-Suche, Bereiche) und die Telegram-Ausnahme je Person (Zeitpunkt, Fassung des Hinweises) — keine Inhalte (lib/datenschutz/ki-einstellungen.ts).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c/f DSGVO (Datenschutz durch Technikgestaltung, Art. 25); Telegram-Ausnahme: Art. 6 Abs. 1 lit. a',
    art15: 'GET /api/datenschutz/ki (eigene Schalter), Einstellungen › Datenschutz',
    loeschfrist: 'solange das Konto bzw. die Instanz besteht',
  }),
  mit(H('ki-protokoll--*', 'KI-Protokoll je Tag (seit E3, 09.10.: ki-protokoll--JJJJ-MM-TT; Altbestand je Monat ki-protokoll--JJJJ-MM, weiter gelesen): je Modell-Aufruf NUR Metadaten — Zeit, Zweck, Lauf-Art, Person (Konto), Datenkategorien, Anzahl, pseudonymisiert ja/nein, gesperrt mit Grund. Nie Inhalte, nie Kennungen oder Namen Dritter (lib/datenschutz/ki-protokoll.ts).'), {
    rechtsgrundlage: 'Art. 5 Abs. 2, Art. 30 DSGVO (Rechenschaft), Art. 6 Abs. 1 lit. c/f',
    art15: 'GET /api/datenschutz/ki-protokoll?auskunft=1 (Empfänger, Kategorien, Zeitraum, eigene Zeilen); Kontakte: Kategorie „crm“ in der Kontakt-Auskunft',
    loeschfrist: '12 Monate (Tagesdateien älter als die Aufbewahrung entfernt das Protokoll einmal am Tag samt Tagessicherungen; alte Monatsdateien werden geleert, Marke „bereinigt“)',
  }),
  // Lauf-Spur (10.10., Paket V1 „Messen & sparen“, Entscheidung 10.10.: eigene Spur im Server, nur Metadaten, Hash-Kette): je Abschnitt einer
  // Agenten-Kette (ZOE-Zug, Head-/Mitarbeiter-Lauf, Modellaufruf über einen Sprung) EIN Eintrag — getrennt je Bereich (lib/agenten/spur.ts).
  mit(H('lauf-spur--privat--*', 'Lauf-Spur des Privat-Bereichs je Berliner Monat: je Abschnitt Kette/Lauf-Kennung, Art, Agent (Kennwort), Person (Speichername), Start/Dauer, Zeit bis zum ersten Wort, Modell, Token inkl. Cache, geschätzte Kosten, Zahl der Werkzeug- und Modellaufrufe, Ergebnis-Klasse — NIE Inhalte, Prompts, Antworten, Titel oder Namen (lib/agenten/spur-server.ts, Hash-Kette).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Betrieb, Kostenkontrolle und Fehlersuche der Agenten), Art. 5 Abs. 2 und Art. 32 (Nachvollziehbarkeit)',
    art15: 'GET /api/agenten/kosten (eigene Abschnitte, Agenten › ⋯ › Kosten je Auftrag); Konto-Export (eigene Einträge unter „protokolle“)',
    loeschfrist: '12 Monate (ältere Monate leert die nächtliche Durchsicht, Vermerk mit Anzahl bleibt); Konto löschen: Speichername → „[gelöscht]“',
  }),
  mit(H('lauf-spur--business--*', 'Lauf-Spur des Business-Bereichs je Berliner Monat — dieselben Felder wie im Privat-Bereich, nur Metadaten (lib/agenten/spur-server.ts, Hash-Kette).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Betrieb, Kostenkontrolle und Fehlersuche der Agenten), Art. 5 Abs. 2 und Art. 32 (Nachvollziehbarkeit)',
    art15: 'GET /api/agenten/kosten (eigene Abschnitte, Agenten › ⋯ › Kosten je Auftrag); Konto-Export (eigene Einträge unter „protokolle“)',
    loeschfrist: '12 Monate (ältere Monate leert die nächtliche Durchsicht, Vermerk mit Anzahl bleibt); Konto löschen: Speichername → „[gelöscht]“',
  }),
  // Anbieter-Tor (09.10., Paket 6a, lib/ki/): erzeugte Medien je Haushalt, Tiefenberichte je Person, Zähler laufender Aufträge.
  mit(T('ki-medien--*', 'Von der KI erzeugte Bilder und Videos je Haushalt (Metadaten): Art, Anbieter, Modell, eigener Auftragstext der auslösenden Person (keine Daten Dritter — die Medien-Zugänge nehmen nur die Kategorien „allgemein“/„web“), Kennzeichnung (SynthID/C2PA), Kosten, wer ausgelöst hat, Sichtbarkeit (Haushalt oder nur ich), Papierkorb. Dateien in <daten>/ki-medien (lib/ki/medien.ts). Seit Paket 4c (09.10.) nur noch Auftragsbuch laufender Video-Aufträge und Altbestand: fertige KI-Medien liegen als Medien (urheber „ki“) in medien--*/medien-privat--* (lib/medien/ki-ablage.ts, Marke uebernommenAls).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO (eigene Arbeitsmittel des Haushalts, Marketing-Material)',
    art15: 'die Medien sieht der Haushalt (bzw. bei „nur ich“ die Person selbst) unter den KI-Medien; Konto-Export über NICHT_PERSOENLICH (Bestand je Haushalt)',
    loeschfrist: 'bis zur Löschung durch den Haushalt; Papierkorb 30 Tage, danach Datei und Eintrag endgültig',
  }),
  mit({ muster: 'ki-medien', bezug: 'haushalt', behandlung: 'ausgenommen', grund: 'Dateien der KI-Medien (<daten>/ki-medien, verschlüsselt wie die Dateiablage, Name km-<uuid>.bin) — kein Bestand; Bytes unverändert vom Anbieter (Kennzeichnung bleibt). Wirkt über ki-medien--<haushalt>: Papierkorb nach 30 Tagen löscht Datei und Eintrag.' }, {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO',
    art15: 'über die Metadaten (ki-medien--<haushalt>)',
    loeschfrist: 'mit dem Eintrag (Papierkorb 30 Tage)',
  }),
  mit(T('ki-tiefenbericht--*', 'Tiefenberichte zum Lesen (Gemini Deep Research über Vertex) je Person: eigene Frage, Bericht, Quellen, Suchvorschläge. NUR die fragende Person liest ihn — nie Brain, nie ZOE/Agenten, nie Suche (Google-Bedingungen, lib/ki/tiefenbericht.ts).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung durch die Kontoperson)',
    art15: 'die Person sieht ihre Berichte selbst; Konto › Meine Daten exportiert sie (PERSON_BESTAENDE)',
    loeschfrist: '30 Tage nach Fertigstellung (eng gefasster „Verlauf“ nach den Bedingungen des Anbieters); Konto löschen entfernt den Bestand',
  }),
  K('ki-auftraege-offen', 'Zähler laufender KI-Aufträge (Video, Tiefenbericht) für den Takt — nur eine Zahl und ein Zeitpunkt (lib/ki/aufruf.ts).'),
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
  // Onboarding „Einrichtung“ (08.10. spät, Paket B0/B2): gemeinsame Häkchen mit dem Speichernamen, wer abgehakt hat; persönliche je Person.
  mit(H('onboarding', 'Gemeinsame Häkchen der Einrichtung (Schritt-Kennung, Zeitpunkt, Speichername der Person, die abgehakt hat) — keine Inhalte, keine Dritten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Einrichtung und Nutzung der Software durch die Kontopersonen',
    art15: 'Konto › Meine Daten exportiert die eigenen Häkchen; die Einrichtung (Einstellungen › Onboarding) zeigt sie',
    loeschfrist: 'solange die Instanz läuft; beim Löschen eines Kontos wird der Speichername zu „[gelöscht]“',
  }),
  mit(H('onboarding--*', 'Persönliche Häkchen der Einrichtung je Person (Schritt-Kennung, Zeitpunkt) — nur die Person selbst liest und schreibt sie.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — die eigene Einrichtung der Software',
    art15: 'Konto › Meine Daten exportiert den Bestand; die eigene Spur der Einrichtung zeigt ihn',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand samt Tageskopien)',
  }),
  // Was ist neu (18.10.): je Person nur die Kennung des zuletzt gesehenen Updates und der Zeitpunkt — keine Inhalte, keine Dritten.
  mit(H('neuigkeiten--*', 'Was ist neu je Person (Kennung des zuletzt gesehenen Updates, Zeitpunkt) — nur die Person selbst liest und schreibt sie.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — Nutzung der Software (Hinweis auf neue Funktionen)',
    art15: 'Konto › Meine Daten exportiert den Bestand',
    loeschfrist: 'mit dem Konto (Konto löschen entfernt den Bestand samt Tageskopien)',
  }),
  // Heute › Top 3 (10.10., Branch `heute-top3`): die eigene Auswahl der drei wichtigsten Aufgaben je Tag und Bereich — nur Aufgaben-Kennungen und der
  // Zeitpunkt, keine Titel, keine Dritten. Immer mit Suffix, nur die Person selbst (GET/PUT /api/heute/top3 liefern nur die eigenen).
  mit(H('heute-top3--*', 'Top 3 des Tages je Person (Aufgaben-Kennungen je Tag und Bereich, Zeitpunkt, ob von ZOE vorgeschlagen oder von Hand) — nur die Person selbst liest und schreibt sie.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO — die eigene Tagesplanung in der Software',
    art15: 'Konto › Meine Daten exportiert den Bestand; Heute › Top 3 zeigt die Festlegung des Tages',
    loeschfrist: 'rollend 45 Tage (ältere Tage fallen beim Schreiben heraus); Konto löschen entfernt den Bestand samt Tageskopien',
  }),
  K('ordnung', 'Sortierung/Ordnung von Listen.'),
  K('performance', 'Wachstums-Score (Zahlen) — Altbestand, wird seit 21.10. nicht mehr geschrieben (nur noch zwei Scores, lib/scores).'),
  K('planung-einheiten--*', 'Einheiten der Planung je Haushalt.'),
  K('spaces', 'Space-Einstellungen.'),
  // Tageslauf je Person seit 08.10. spät (Datenschutz vor dem Upload): die Ausrichtung entsteht mit dem Gesundheitskontext der Person
  // (nur mit Einwilligung (b)) — vorher lag sie in einem Bestand, den jedes Konto lesen konnte. Altbestand ohne Suffix nur beim Inhaber.
  mit(H('tageslauf', 'Tagesläufe (Kurzfassung je Schritt, Ausrichtung mit Tagesform und Prioritäten) — Altbestand ohne Suffix, gehört dem Inhaber.'), TAGESLAUF),
  mit(H('tageslauf--*', 'Tagesläufe je Person (Kurzfassung je Schritt, Ausrichtung mit Tagesform und Prioritäten) — nur die Person selbst liest sie.'), TAGESLAUF),
  K('tagesstart', 'Riegel des Morgenlaufs.'),
  K('willkommen', 'Willkommens-Hinweise.'),
  // Markttraktion-Planung (10.10., Schnellknopf „Planung“, lib/crm/planung-daten.ts): Leadkanäle, Umsatzziele, Wochen-Challenges, Zeiten je Aktivität,
  // abgehakte Schritte „nach der Leistung“ je Mandat (nur Kennung + Tag + Team-Kürzel) — keine Daten Dritter, Personen nur als Team-Kürzel.
  // Social (26.10., Markttraktion › Social, lib/social/): Kanäle mit Markenprofil und Leitplanken, Serienformate, Folgen (Skript, Hooks, Quellen),
  // Veröffentlichungen und Messungen aus den Plattform-Insights — Zahlen je Video, keine Personendaten Dritter (Kommentare/DMs kommen erst mit den
  // Plattform-Anbindungen in einen eigenen Bestand). Personen nur als Speichername (geändert/freigegeben von, seit 27.10. auch die Person einer
  // Personenmarke). Ein Kanal „nur die Person der Marke“ geht nur an sie (Server-Filter `socialFuerPerson`).
  mit(H('social--*', 'Social des Haushalts: Kanäle (Art Faceless/Personenmarke/Firmenaccount, Name, Handle, Markenprofil, Persona, Absender-Gesellschaft, Person der Marke als Speichername, Sichtbarkeit, Leitplanken, Ziele, Follower-Stände), Serienformate, Folgen (Skript, Hooks, Quellen, Personen im Bild ja/nein, Werbung ja/nein), Veröffentlichungen und Messungen (Aufrufe, Haltequote, Shares …); wer zuletzt geändert bzw. freigegeben hat (Speichername).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — eigene Marketingarbeit des Haushalts; Personenmarke: Art. 6 Abs. 1 lit. a/b (die Person führt ihre Marke selbst)',
    art15: 'die Konten des Haushalts sehen sie unter Markttraktion › Social (GET /api/social) — einen Kanal „nur die Person der Marke“ nur diese Person; Dritte stehen hier nicht (gezeigte Personen nur als „Einwilligung liegt vor/fehlt“, ohne Namen)',
    loeschfrist: 'bis der Haushalt Kanäle und Folgen entfernt bzw. die Instanz gelöscht wird; Konto löschen setzt den Speichernamen auf „[gelöscht]“ und löst die Personenmarke von der Person',
  }),
  // Social-Automatik (27.10.): Verbindungen je Kanal und Plattform (Token verschlüsselt, nie an den Browser), Stand der Läufe, offene LinkedIn-Anmeldungen.
  mit(H('social-verbindungen--*', 'Verbindungen der Social-Kanäle: Kanal, Plattform, Anbieter, Zustand, Anzeige-Name des Plattform-Kontos, Zugangstoken (verschlüsselt, nur Server), wer verbunden hat (Speichername), wann.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — die Person verbindet ihr eigenes Plattform-Konto für die eigene Marketingarbeit',
    art15: 'Status ohne Zugangsdaten unter Markttraktion › Social › Automatik (GET /api/social); das Token selbst wird nie herausgegeben',
    loeschfrist: 'bis zum Trennen (dann ohne Token als „getrennt“) bzw. Konto löschen (Verbindungen der Person fallen weg)',
  }),
  K('social-lauf--*', 'Stand der automatischen Social-Läufe (Zeit, Zahlen, Grund) — keine Inhalte.'),
  K('social-linkedin-zustand', 'Offene LinkedIn-Anmeldungen (state, Speichername, Kanal, 15 Minuten) — wird beim Rückruf eingelöst.'),
  mit(H('markttraktion-planung--*', 'Vertriebsplanung des Haushalts: Leadkanäle (Name, Herkunft, Bezug Kampagne/Eventreihe als Kennung, Plan-Leads, Sales Cycle, Plan-Quoten, Kosten/Zeit je Lead, verantwortlich = Team-Kürzel), Umsatzziele je Business-Gesellschaft, Wochen-Challenges (Team-Kürzel, Ziel, Rückblick), Minuten je Aktivität, Schritte nach der Leistung je Mandat-Kennung; wer zuletzt geändert hat (Speichername).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung der eigenen Vertriebsarbeit durch die Mitglieder des Haushalts (§ 26 BDSG, soweit Wochenziele je Person)',
    art15: 'alle Konten des Haushalts sehen sie unter Markttraktion › Planung (GET /api/crm/planung); Kontakte Dritter stehen hier nicht — Mandate nur als Kennung',
    loeschfrist: 'bis der Haushalt Kanäle, Ziele und Challenges entfernt bzw. die Instanz gelöscht wird; Konto löschen tilgt den Speichernamen nicht automatisch — die übrigen Mitglieder ändern die Einträge',
    kategorie: ['beschaeftigte'],
  }),
  // Produkte · Leistungstreppe (10.10., lib/crm/treppe-daten.ts): Stufen, Kundenreise, Roadmap, Positionierung des Haushalts; je Mandat (nur Kennung)
  // Stufe, erledigte Lieferobjekte, nächster Schritt, Report-Vermerk — keine Kontaktdaten Dritter, Personen nur als Speichername.
  mit(H('produkt-treppe--*', 'Leistungstreppe des Haushalts: Stufen (Name, Ebene, Aufgabe, Ergebnis, Lieferobjekte, Kennzahl, Dauer, Aufwand, Preis, Regeln, verknüpfte Leistungen, Ziel), Kundenreise (Stationen, Messgröße, Ziel), Roadmap (Pakete, Zeitplan), Positionierung (Claim, Zielgruppe, Problem, Versprechen, Story); je Mandat-Kennung Stufe, erledigte Lieferobjekte, nächster Schritt (Freitext + Datum), Report-Vermerk (Tag, Datei-Kennung); Marken der Vorschläge; wer zuletzt geändert hat (Speichername).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung und Erbringung der eigenen Leistungen durch die Mitglieder des Haushalts; Mandate nur als Kennung',
    art15: 'alle Konten des Haushalts sehen sie unter Produkte & Mandate (GET /api/crm/treppe); Kontakte Dritter stehen hier nicht — Mandate nur als Kennung, Report-PDFs in der Dateiablage am Mandat',
    loeschfrist: 'bis der Haushalt Stufen, Stationen und Pakete entfernt bzw. die Instanz gelöscht wird; der Fortschritt je Mandat bleibt so lange wie das Mandat; Konto löschen tilgt den Speichernamen nicht automatisch',
    kategorie: ['beschaeftigte'],
  }),
  // Fulfillment (10.10., FULFILLMENT_KONZEPT.md 8.1, lib/fulfillment/speicher.ts): fünf Einträge, alle Bereich Business, Haushalt des Inhabers.
  mit(H('fulfillment--*', 'Fulfillment des Haushalts: Prozess-Vorlagen (Landkarte, Pakete, Abläufe), Bibliothek der Bausteine (Skripte, Workbooks, Checklisten, Mail-Vorlagen, Kennzahl-Definitionen), Rituale, Zuordnung Produkt → Vorlage, Zusatz-Aufträge der Analyse-Agenten, Einstellungen (Kunden-Link-Schalter, Puls-Schwelle), Import-Läufe (Vorher-Stände), Marken. Geschäftswissen, keine Daten Dritter; Personen nur als Speichername eines Kontos.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Planung und Erbringung der eigenen Leistungen durch die Mitglieder des Haushalts; Personen nur als Speichername',
    art15: 'alle Konten des Haushalts sehen den Bestand unter Produkte & Mandate › Fulfillment (GET /api/fulfillment); Daten Dritter stehen hier nicht',
    loeschfrist: 'bis der Haushalt Vorlagen und Bausteine entfernt bzw. die Instanz gelöscht wird; Import-Läufe 30 Tage (Rückgängig); Konto löschen tilgt den Speichernamen („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  mit(T('fulfillment-faelle--*', 'Je Mandat der laufende Fall: Kopie der Prozess-Struktur mit Status, Freigaben, Onboarding, Zusammenarbeits-Vereinbarung, Stakeholder-Karte (nur Kontakt-Kennung + Rolle, Einfluss, Haltung, Notiz), Entscheidungs-Log, Rituale (Termin-Kennungen), Mitschriften im 4-Zeilen-Standard, Quick Wins, Kick-off-Fragen, Wert-Konto, Befähigung, Wirkungsbericht, Marken. Art. 17: Kennung der Person → „[gelöscht]“, ihre Notiz leer, der Fall bleibt (person-weitere.ts).', 'fulfillment-mandatsdaten'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag mit dem Kunden) und lit. f (Führung des Mandats: wer entscheidet, wer unterstützt)',
    art15: 'Kontakt: die Auskunft nennt die Stakeholder-Einträge der Person (Rolle, Einfluss, Haltung, Notiz — lib/fulfillment/auskunft.ts); Konten des Haushalts sehen den Fall unter Fulfillment',
    loeschfrist: 'Haltung und Notiz der Stakeholder 12 Monate nach Mandatsende (Frist „fulfillment-mandatsdaten“, einstellbar); sonst so lange wie das Mandat — wird es endgültig gelöscht, fällt der Fall im Fristen-Lauf weg',
  }),
  mit(E('fulfillment-kunde--*', 'Kunden-Links (nur Hash des Tokens), Formular-Antworten (Playbook, Workbooks), Puls-Anfragen (nur Hash) und Puls-Antworten (Wert, Satz), Metadaten der Unterlagen (Name, Typ, Größe, Status). Art. 17: Einträge, die die Person nennen, fallen weg (person-weitere.ts).', 'fulfillment-mandatsdaten'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Mandats); Information nach Art. 13 durch den Hinweis auf der Kunden-Seite',
    art15: 'Kontakt: die Auskunft nennt Antworten, Puls-Sätze und Unterlagen-Metadaten, die die Person nennen (lib/fulfillment/auskunft.ts); der Kunde sieht seine eigenen Antworten über seinen Link',
    loeschfrist: 'Antworten und Puls-Sätze 12 Monate nach Mandatsende (Frist „fulfillment-mandatsdaten“); Unterlagen 90 Tage nach Mandatsende (Frist „fulfillment-unterlagen“), außer sie wurden als Beleg übernommen',
  }),
  mit(T('fulfillment-dossiers--*', 'Je Mandat das Dossier der Analyse: Eingaben (Firma, Domains, Register), Abschnitte mit Aussagen (Quelle + Datum je Aussage), Quellen, Läufe der Analyse-Agenten mit Kosten und Entwürfen, Freigaben F1/F2, Interessenabwägung, Prüfbericht, Diagnose-Entwurf. Personen nur als Verweis auf eine Personenkarte (`pp-…`); Art. 17: Nennungen getilgt (person-weitere.ts).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Analyse im Mandat) und lit. f (öffentlich zugängliche Firmenangaben, Interessenabwägung je Dossier)',
    art15: 'Kontakt: Nennungen der Person stehen in den Personenkarten (fulfillment-personen--*, Auskunft dort); Konten des Haushalts sehen das Dossier unter Fall › Analyse',
    loeschfrist: 'Entwürfe von Läufen 90 Tage nach dem Lauf; sonst so lange wie das Mandat — wird es endgültig gelöscht, fällt das Dossier im Fristen-Lauf weg',
    kategorie: ['vertraulich'],
  }),
  mit(E('fulfillment-personen--*', 'Berufliche Personenkarten je Mandat (Funktion, Name, optional Kontakt-Kennung, Werdegang/Themen/Auftritte — je Angabe Quelle und Datum, nur beruflich), Stand der Information nach Art. 14, Löschtag, Vermerke gelöschter Karten nur als Anzahl. Art. 17: Karten der Person fallen weg (person-weitere.ts).', 'fulfillment-personen'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO — berufliche Recherche im Mandat, Interessenabwägung je Dossier dokumentiert; Information nach Art. 14 durch den Verantwortlichen (Einrichtung › Datenschutz; Hinweis, keine Rechtsberatung)',
    art15: 'Kontakt: die Auskunft nennt die Karten, die die Person nennen (Name oder Kontakt-Kennung — lib/fulfillment/auskunft.ts); sehen dürfen sie nur der Inhaber und Mitglieder mit vollem Zugang',
    loeschfrist: '90 Tage nach Mandatsende (Frist „fulfillment-personen“, einstellbar 30–365 Tage) — dann fällt die Karte weg, nur der Vermerk (Anzahl) bleibt',
  }),
  mit({ muster: 'fulfillment-unterlagen', bezug: 'dritte', behandlung: 'ausgenommen', frist: 'fulfillment-unterlagen', grund: 'Dateien der Fulfillment-Unterlagen (<daten>/fulfillment-unterlagen, verschlüsselt über die Bild-Ablage, Name ud-<uuid>.bin) — kein Bestand; Verweis, Art. 15/17 und Frist über die Metadaten in fulfillment-kunde--*.' }, {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Mandats)',
    art15: 'über die Metadaten der Unterlage (fulfillment-kunde--*); Download nur intern als Anhang',
    loeschfrist: '90 Tage nach Mandatsende (Frist „fulfillment-unterlagen“), außer als Beleg übernommen; fällt die Metadaten-Zeile weg, entfernt der Fristen-Lauf die Datei',
  }),
  // Prozesse (21.10., Etappe B1, lib/prozesse/werkstatt-server.ts): zwei Bestände je Haushalt des Inhabers, nur Business.
  mit(H('prozesse--*', 'Prozesse aller Business-Bereiche (Werkstatt): je Prozess Entwurf, veröffentlichte Versionen, Status — Ablauf, Bausteine, Masken-Werte (Textvorlagen mit Platzhaltern, nie eingesetzte Daten), Notiz-Zettel. Geschäftswissen, keine Daten Dritter; Personen nur als Team-Kennung (Eigner) bzw. Speichername (wer angelegt/geändert/veröffentlicht, „läuft als“). Seit 22.10. optional Testdaten für den Probelauf: nur erfundene Werte (Adressen unter „.invalid“, Platzhalter-Telefon, nie eine IBAN — geprüft im Schreibweg und beim Lesen) und „Weg annehmen“ als Kennungen von Knoten.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Organisation der eigenen Abläufe durch die Mitglieder des Haushalts; Personen nur als Kennung bzw. Speichername',
    art15: 'alle Konten des Haushalts sehen die Prozesse unter Prozesse › Werkstatt (GET /api/prozesse/werkstatt); Daten Dritter stehen hier nicht',
    loeschfrist: 'bis der Haushalt den Prozess archiviert bzw. die Instanz gelöscht wird; Konto löschen tilgt den Speichernamen und die Team-Kennung des Kontos („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  // Prozesse · Landkarte anpassen (22.10., lib/prozesse/landkarte-anpassung-server.ts): NUR die Abweichungen der Landkarte von der Vorgabe je Haushalt.
  mit(H('prozesse-landkarte--*', 'Landkarte der Prozesse angepasst: Namen, Sätze und Töne der Bereiche, eigene Bereiche, je Kachel (Prozess-Kennung) Bereich, Beschriftung, ausgeblendet, Reihenfolge je Bereich — nur Abweichungen von der Vorgabe. Geschäftswissen, keine Daten Dritter; Person nur als Speichername (wer zuletzt geändert hat).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Organisation der eigenen Abläufe durch die Mitglieder des Haushalts; Person nur als Speichername',
    art15: 'alle Konten des Haushalts sehen die angepasste Landkarte unter Prozesse (GET /api/prozesse/landkarte); Daten Dritter stehen hier nicht',
    loeschfrist: 'bis „Auf Vorgabe zurück“ bzw. die Instanz gelöscht wird; Konto löschen tilgt den Speichernamen („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  // Prozesse · Stellschrauben der festen Prozesse (22.10., lib/prozesse/stellschrauben-werte-server.ts): NUR Abweichungen von der Vorgabe je Haushalt.
  mit(H('prozesse-stellschrauben--*', 'Stellschrauben der festen System-Prozesse: Uhrzeit/Wochentag/an-aus je Head-Modus, Fenster des Monatsabschlusses, Haltezeit und Gültigkeit des Mail-Links der Buchung, Schwellen der Kapazität, Abstand der Fortschritts-Reports — nur Zahlen und Schalter, nur Abweichungen von der Vorgabe. Keine Daten Dritter; Person nur als Speichername (wer zuletzt geändert hat).'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Organisation der eigenen Abläufe durch die Mitglieder des Haushalts; Person nur als Speichername',
    art15: 'alle Konten des Haushalts sehen die Werte im Steckbrief der Prozesse (GET /api/prozesse/landkarte, /api/prozesse/stellschrauben); Daten Dritter stehen hier nicht',
    loeschfrist: 'bis ein Wert auf die Vorgabe zurückgesetzt bzw. die Instanz gelöscht wird; Konto löschen tilgt den Speichernamen („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  // Prozesse · eigene Vorlagen (22.10., lib/prozesse/eigene-vorlagen-server.ts): Struktur und Texte eines Prozesses als Vorlage des Haushalts — ohne Personen, ohne Fall-Daten.
  mit(H('prozess-vorlagen--*', 'Eigene Vorlagen der Prozesse je Haushalt: Name, Beschreibung, Bereich, Fall-Art und die Definition (Phasen, Bausteine, Masken-Werte als Textvorlagen mit Platzhaltern, Zettel ohne Verfasser) — Personen nur als Rolle („Zuständig im Fall“), kein Eigner, kein „läuft als“, keine Versionen, keine Läufe, keine Fall-Daten. Wer sie gespeichert hat: Speichername.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Organisation der eigenen Abläufe durch die Mitglieder des Haushalts; Person nur als Speichername',
    art15: 'alle Konten des Haushalts sehen die eigenen Vorlagen in der Galerie „Aus Vorlage anlegen“ (GET /api/prozesse/werkstatt?vorlagen=1); Daten Dritter stehen hier nicht',
    loeschfrist: 'bis der Haushalt die Vorlage löscht bzw. die Instanz gelöscht wird; Konto löschen tilgt den Speichernamen („[gelöscht]“)',
    kategorie: ['vertraulich'],
  }),
  mit(E('prozesse-webhook--*', 'Webhooks der Prozesse: je Prozess die öffentliche Adresse (pw-…) und NUR der Fingerabdruck (SHA-256) des Schlüssels, scharf ja/nein, Zähler; dazu die angenommenen Eingänge (nur die Felder des Schemas am Auslöser — fremder Text, kann Personen nennen, z. B. ein Formular). Art. 17: Eingänge, die die Person nennen, fallen weg (person-weitere.ts).', 'ereignisse'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Anfragen und Meldungen, die ein Fremdsystem im Auftrag des Haushalts schickt (z. B. Formular der eigenen Website); nur die Felder des Schemas, der Rest wird verworfen',
    art15: 'Kontakt: die Auskunft zählt die Eingänge, die die Person nennen (weitere Speicher); Konten des Haushalts sehen Adresse und Zähler in der Werkstatt, nie den Schlüssel',
    loeschfrist: 'Eingänge nach der Frist „ereignisse“ (Vorgabe 30 Tage, Stammdaten › Datenschutz) im täglichen Löschfristen-Lauf; Adresse und Fingerabdruck bis „Webhook entfernen“ bzw. Archivieren des Prozesses',
  }),
  // Prozesse · Läufe (21.10., Etappe C1, lib/prozesse/lauf-server.ts): je Haushalt des Inhabers, nur Business. Je Lauf NUR Kennungen und Status (Punkt 98).
  mit(T('prozess-laeufe--*', 'Läufe der Prozesse: je Lauf Prozess, Version, Fall (Kennung: Lead/Deal/Mandat/Firma/Event/Kampagne), Kennungen aus dem auslösenden Ereignis (Kontakt, Firma, Deal …), je besuchtem Schritt Status, Zeitpunkte, Kosten und die Kennungen der Wirkungen (Aufgabe, Vorschlag, Teil-Lauf) — nie Texte, Namen oder Adressen (die stehen in Aufgabe, Vorschlag bzw. Akte). Dazu je Prozess Einstellungen (Budget, Flutschutz, Ziel/Abbruch), Zähler, der Verlauf (wer schaltete scharf, Gründe von Hand) und die Testfälle (22.10.: Kennung des Falls bzw. „Beispiel“ und die erwartete Statusfolge je Knoten — kein Name, kein Inhalt, kein „von“). Art. 17: Kennung der Person → „[gelöscht]“, der Lauf endet (Fall weg); Konto löschen: Speichername → „[gelöscht]“.', 'prozess-laeufe'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO — Durchführung der Geschäftsabläufe (Kundengewinnung, Übergabe, Fulfillment) durch die Mitglieder des Haushalts; Dritte nur als Kennung',
    art15: 'Kontakt: die Auskunft zählt die Läufe, die seine Kennung tragen (weitere Speicher); Konten des Haushalts sehen die Läufe unter Prozesse (GET /api/prozesse/laeufe) — nur Kennungen und Status',
    loeschfrist: 'beendete Läufe nach der Frist „prozess-laeufe“ (Vorgabe 12 Monate ab Ende, Stammdaten › Datenschutz) im täglichen Löschfristen-Lauf; offene Läufe bleiben, bis sie enden (Art. 18/Werbesperre beenden sie sofort)',
  }),
  K('crm-scoring', 'Scoring-Einstellungen des CRM (Kriterien, Stufen, Schwellen MQL/SQL) samt früheren Fassungen und Vermerk wer/wann — keine Personendaten (Leads tragen ihre Antworten selbst, in crm/kontakte).'),
  // Restpunkte (24.10., lib/crm/vorlagen-anpassung-server.ts): Vorlagen der Markttraktion je Haushalt — nur Abweichungen von den Vorgaben im Code und eigene Kopien.
  K('kampagnen-vorlagen--*', 'Playbooks der Kampagnen je Haushalt: Abweichungen von den Vorgaben (Name, Texte, Kanal, Segment-Vorschlag als Kennung, Nachfass-Schritte) und eigene Kopien — Geschäftswissen, keine Personendaten (wer geändert hat, steht nur im Änderungsprotokoll); Rechtshinweise bleiben im Code.'),
  K('event-vorlagen--*', 'Vorlagen eigener Abende je Haushalt: Abweichungen von den Vorgaben (Name, Beschreibung, Uhrzeit, Plätze, Soll-Mischung, Ablauf, Checkliste, Budget-Posten ohne Beträge) und eigene Kopien — keine Personendaten.'),
  K('traktion-verlauf', 'Markttraktion-Kennzahlen je Tag (nur Zahlen).'),
  K('finanzchef-einstellung', 'Einstellungen des Finanzchefs.'),
  K('performance--*', 'Wachstums-Score je Person (Zahlen) — Altbestand, wird seit 21.10. nicht mehr geschrieben.'),
  K('flaeche', 'Anordnung der Flächen (Erstkonto).'),
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
  mit(H('datenschutz-einrichtung', 'Datenschutz-Einrichtung: Verantwortlicher (Name/Firma, Anschrift, Kontakt-Mail, optional Telefon, Vertretung, Datenschutzbeauftragter) und Empfänger/Auftragsverarbeiter mit AVV-Nachweis — schreibt nur der Inhaber (Einstellungen › Datenschutz), Protokoll nur mit Feldnamen.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Pflichtangaben Art. 13 Abs. 1 lit. a/b, Art. 30 Abs. 1 lit. a, Nachweis Art. 5 Abs. 2, Art. 28)',
    art15: 'Einstellungen › Datenschutz zeigt dem Haushalt des Inhabers alles; die Angaben stehen in jeder Auskunft (GET /api/crm/datenschutz › verantwortlich) und im Verzeichnis-Export',
    loeschfrist: 'solange die Instanz betrieben wird; der Inhaber ändert bzw. leert die Angaben jederzeit (frühere Fassungen nur in den Sicherungen, bis zu 12 Monate)',
  }),
  // Ereignisse (09.10., E1 „Ereignisstelle“, lib/ereignisse): NUR Kennungen (Mail-, Buchungs-, Deal-, Aufgaben-Kennung, Kontakt-/Firmen-Kennung im
  // Bezug), Art, Bereich, für wen sichtbar, Zeitpunkt — nie Betreff, Text, Beträge, Namen oder Adressen. Rollend nach Frist „ereignisse“.
  mit(E('ereignisse--*', 'Ereignisse für die Agenten je Haushalt (neue Mail, Zahlungseingang, Deal-Stufe, Anfrage, Absage, An ZOE gegeben) — Art. 17: Einträge mit der Kennung der Person fallen weg (person-weitere.ts); Konto löschen: Einträge NUR dieser Person fallen weg.', 'ereignisse'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Software durch die Kontoperson: Agenten reagieren auf eigene Daten); Kennungen Dritter Art. 6 Abs. 1 lit. f (eigene Arbeit organisieren, nur Kennungen)',
    art15: 'nur Kennungen — die Auskunft eines Kontakts zählt die Einträge, die seine Kennung tragen (weitere Speicher); Inhalte stehen in der Quelle (Postfach, Kartei, Finanzen)',
    loeschfrist: 'Frist „ereignisse“ (Vorgabe 30 Tage, Stammdaten › Datenschutz): ältere Einträge fallen beim nächsten Ereignis und im täglichen Löschfristen-Lauf weg; ein Agent reagiert höchstens 72 Stunden darauf',
  }),
  // Pannen-Register (05.10., Zusatz; Art. 33 Abs. 5): nur Kategorien/Anzahl Betroffener, keine Namen; nur der Inhaber.
  mit(H('datenschutz-pannen', 'Pannen-Register (lib/datenschutz/pannen.ts): Kenntnis, Beschreibung, Art, Betroffene nur als Kategorien/Anzahl, Datenkategorien, Risiko, Meldung an die Behörde, Benachrichtigung, Maßnahmen, Abschluss, wer — liest und schreibt nur der Inhaber.'), {
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO i. V. m. Art. 33 Abs. 5 (Dokumentationspflicht)',
    art15: 'Einstellungen › Datenschutz › Pannen-Register (nur Inhaber); Betroffene sind dort nicht namentlich geführt',
    loeschfrist: 'abgeschlossene Pannen 36 Monate ab Abschluss (Frist „pannen“, einstellbar 12–120 Monate); offene bleiben',
  }),
  K('datenschutz-grabsteine', 'Marke „Grabsteine zuletzt angewendet“ (Fingerabdruck der Grabstein-Datei, Zahl).'),
  K('datenschutz-migration', 'Marke der Umrechnung v1 → v2 je Pepper (nur Zahlen).'),
];

// ─── Bereich je Bestand (09.10. spät, Inventur in TRENNUNG_PRIVAT_BUSINESS.md) ─────────────────────────────────────────────
// Regel „im Zweifel gemischt“: was heute Privat und Business in EINEM Bestand hält — auch nur abgeleitet oder als Verweis —, steht
// unten in GEMISCHT mit dem Feld, das heute trennt. Eine Entscheidung oder ein Umbau nimmt einen Bestand heraus (Liste wird kürzer);
// ein neuer Bestand kommt nie dazu. Die Selbstständigkeit (kdc) gehört seit 05.10. zum Bereich Privat (lib/einheiten.ts) — deshalb
// sind Bestände gemischt, die sie zusammen mit den Business-Gesellschaften führen.

const IN_PRIVAT: readonly string[] = [
  'familie--*', 'ernaehrung', 'ernaehrung-vorschlag', 'kompass', 'nordstern--*', 'gesundheit-takt',
  // Lauf-Spur des Privat-Bereichs (10.10., je Bereich ein Bestand — nie gemischt)
  'lauf-spur--privat--*',
  // Fokus · Privat je Haushalt (10.10.), Prioritäten · Privat je Haushalt (10.10., Fokus-Steuerung)
  'fokus-privat--*', 'fokus-steuerung-privat--*',
];
const IN_BUSINESS: readonly string[] = [
  // Kartei-Pflicht und Markttraktion (die Kartei selbst steht unter GEMISCHT — Entscheidungsfrage 2 im Plan)
  'crm-import-konflikte', 'crm-import-laeufe--*', 'crm-sperrliste--*', 'crm-loeschprotokoll', 'kennung-alias--*', 'datenschutz-migration',
  'netzwerk', 'kunden', 'stammdaten', 'prospects', 'crm-signale', 'crm-scoring', 'kampagnen-vorlagen--*', 'event-vorlagen--*', 'markttraktion-planung--*', 'social--*', 'social-verbindungen--*', 'social-lauf--*', 'social-linkedin-zustand', 'produkt-treppe--*', 'traktion-verlauf', 'uebergabe-journal--*', 'events-geloescht',
  'netzwerken-erfassungen--*', 'visitenkarten--*', 'buchung--*', 'angebot-formular--*', 'head-*', 'heads-replay-*', 'content-entwuerfe', 'delegation-runde',
  // Wissen der Business-Heads, Fokus · Business je Haushalt und je Person (10.10.)
  'agenten-wissen--*', 'fokus-business--*', 'fokus-eigen-business--*',
  // Lauf-Spur des Business-Bereichs (10.10., je Bereich ein Bestand — nie gemischt)
  'lauf-spur--business--*',
  // Fokus-Steuerung · Business (10.10.): Themen je Haushalt, Soll-Zeit je Person
  'fokus-steuerung-business--*', 'fokus-soll-business--*',
  // Business-Postfächer und -Kalender (Google Workspace mit Domain-Prüfung, Microsoft 365, WhatsApp-Nummer nur im Business)
  'gmail-stand--*', 'gmail-text--*', 'kalender-google--*', 'kalender-umzug-sicherung--*', 'm365-postfach', 'microsoft-inbox', 'kemaris-calendar',
  'whatsapp-spiegel', 'whatsapp-zustand', 'whatsapp-medien',
  // Business-Medien, Team, Planungs-Einheiten, Business-Finanzen ohne Privat-Einheit
  'medien--*', 'team--*', 'planung-einheiten--*', 'finance', 'business-eroeffnung',
  // Unternehmen › Schild (10.10.): nur Business-Gesellschaften — getrennt vom gemischten Register; Head of Recht (10.10.) ebenso
  'unternehmen-schild--*', 'recht-check--*',
  // Gesundheits-Verlauf des Schilds (11.10.): nur Zahlen je Business-Gesellschaft
  'unternehmen-verlauf--*',
  // Fulfillment (10.10.): Vorlagen, Fälle, Kunde (Links/Antworten/Puls), Dossiers, Personenkarten und der Datei-Ordner — nur Business
  'fulfillment--*', 'fulfillment-faelle--*', 'fulfillment-kunde--*', 'fulfillment-dossiers--*', 'fulfillment-personen--*', 'fulfillment-unterlagen',
  // Prozesse (21.10., B1): Werkstatt und Webhooks — nur Business
  'prozesse--*', 'prozesse-webhook--*', 'prozesse-landkarte--*', 'prozess-vorlagen--*', 'prozesse-stellschrauben--*',
  // Prozesse · Läufe (21.10., C1) — nur Business
  'prozess-laeufe--*',
];
const JE_PERSON: readonly string[] = [
  // Gesundheit (Art. 9) — Altbestand ohne Suffix gehört dem Inhaber
  'sport', 'sport--*', 'vitals', 'vitals--*', 'gesundheit-index', 'gesundheit-index--*', 'privat-score--*', 'haut', 'haut--*', 'streak', 'streak--*', 'health-log', 'health-log--*', 'journal', 'journal--*',
  'gesundheit-alltag', 'gesundheit-alltag--*', 'gesundheit-koerper', 'gesundheit-koerper--*', 'gesundheit-unterlagen', 'gesundheit-unterlagen--*', 'gesundheitszeit', 'gesundheitszeit--*',
  'gesundheit-einwilligungen', 'whoop-stand--*', 'whoop-verbindung--*', 'erholung--*',
  // Routinen 2 (10.10.): Zähler, Erinnerungs-Einstellung und Riegel je Person — wie der Gesundheits-Log
  'routinen-person--*',
  // Mein Fokus · Privat (10.10.), eigene Soll-Zeit · Privat (10.10., Fokus-Steuerung)
  'fokus-eigen--*', 'fokus-soll-privat--*',
  // Eigene Meilensteine an eigenen Zielen (10.10.) — immer Privat, je Person
  'meilensteine-eigen--*',
  // Zugänge und Kanäle der Person
  'google-verbindung--*', 'icloud-verbindung--*', 'kalender-icloud--*', 'postfaecher--*', 'postfach-zugang--*', 'oauth-tokens',
  'zoe-kanal--*', 'zoe-whatsapp-medien',
  // eigene Einstellungen und eigene Ablagen
  'arbeitsmodus', 'arbeitsmodus--*', 'arbeitsrahmen--*', 'flaeche', 'flaeche--*', 'onboarding--*', 'fokus-laufend--*',
  // Heute › Top 3 (10.10.): die eigene Festlegung des Tages — nur Aufgaben-Kennungen
  'heute-top3--*',
  // Was ist neu (18.10.): das zuletzt gesehene Update je Person
  'neuigkeiten--*',
  // Inbox › Aufgaben-Vorschläge (10.10.): Merker je Person (nur Fingerabdrücke), Schalter „automatisch“
  'inbox-vorschlaege--*',
  'agenten-skills-privat--*', 'medien-privat--*', 'ki-tiefenbericht--*',
];
const INSTANZ: readonly string[] = [
  'konten', 'anmeldungen', 'telegram', 'oauth-states', 'google-oauth-zustand', 'whoop-oauth-zustand', 'zoe-whatsapp-zustand',
  'ki-verbrauch', 'ki-einstellungen', 'ki-protokoll--*', 'ki-auftraege-offen', 'ki-stand', 'demo-instanz', 'backlog', 'bauplan-bilder',
  'protokoll-siegel', 'protokoll-pruefung', 'bauzeit', 'agents-config', 'brain-konsolidierung', 'brain-bruecke--*', 'brain-app-spiegel',
  'crm-loeschfristen', 'dashboard', 'filter', 'fokus-regler', 'labels', 'spaces', 'arbeitsplatz', 'kalender-einstellungen', 'kalender-sicherung',
  'onboarding', 'tagesstart', 'willkommen', 'anwesenheit', 'nutzung', 'client-fehler', 'absichten--*', 'anfragen-ergebnis',
  'wochenplan-uebernahme', 'zulieferer-uebernahme', 'hoi-meldung', 'hoi-durchsicht', 'hoi-aussen', 'hoi-csp',
  'datenschutz-einrichtung', 'datenschutz-pannen', 'datenschutz-grabsteine',
];
/** Gemischte Bestände (Stand 09.10.) → was heute trennt. Nur kürzer werden lassen (tests/trennung-bereiche.test.ts). */
export const GEMISCHT: Readonly<Record<string, string>> = {
  // ── Kartei und Markttraktion ──
  kontakte: 'kein Feld — Bereich einer Person nur abgeleitet (Firma → Deals/Mandate ihrer Gesellschaft, lib/zoe/crm-sicht.ts); Kunden der Selbstständigkeit liegen in derselben Kartei',
  crm: 'Deal/Mandat/Angebot.gesellschaft (Selbstständigkeit = Privat), Event.fuer; Bereich einer Firma abgeleitet (bereichVonGesellschaft)',
  'crm-dateien--*': 'Bezug je Eintrag (Kontakt, Firma, Mandat, Rechnung, Angebot, Gesellschaft) → Gesellschaft; auch Rechnungs-PDFs der Selbstständigkeit',
  'gesellschaften--*': 'je Gesellschaft (Selbstständigkeit = Privat, kdv/ug/g-… = Business) — Steckbrief, Absender, Cap-Table, Verträge',
  'mandate-tabelle-laeufe': 'Lauf-Protokoll eingefügter Mandate (Mandat → Gesellschaft)',
  // ── Aufgaben und Planung ──
  tasks: 'Task/Project.spaceId (privat · kdc · kdv · ug · m-<firma>), eigene Status je Space; Vorlagen, Serien und Papierkorb über alle Spaces',
  'aufgaben-dateien--*': 'Feld bereich (privat/business, aus dem Space der Aufgabe) je Datei; die Dateien liegen im selben Ordner wie die CRM-Ablage',
  ordnung: 'orgs: Aufgabe → Ort (privat oder Gesellschaft) von Hand; Themen-Reihenfolge',
  'zoe-chargen--*': 'Kennungen von Aufgaben/Vorschlägen beider Bereiche',
  ziele: 'Ziel.space + einheit je Horizont; Fokus-Sätze je Space (privat:jahr / business:jahr)',
  'ziele-eigen': 'persönliche Ziele mit space je Horizont (Altname Erstkonto)',
  'ziele-eigen--*': 'persönliche Ziele mit space je Horizont',
  meilensteine: 'Meilenstein.space + einheit/mandatId (Bereich über wirksamerSpace)',
  'meilenstein-raum--*': 'Austausch je Meilenstein (Meilenstein → space)',
  routinen: 'Routine.space und Block.art (privat/business) + einheit',
  wochenplan: 'Altbestand (nur Archiv der Übernahme): Blöcke mit art privat/business',
  'wochenplan--*': 'Altbestand (nur Archiv der Übernahme): Blöcke mit art privat/business',
  'kapazitaet--*': 'zählt Arbeit, nicht Bereich: Zuweisungen Person × Mandat/Kunde auch der Selbstständigkeit (Privat-Einheit)',
  'kapazitaet-plan--*': 'Wochenpläne der Arbeit inkl. Selbstständigkeit (Posten nur als Kennung)',
  zeit: 'Schlüssel space:bereich je Tag; Fokus-Blöcke mit Einheit/Mandat',
  'zeit--*': 'Schlüssel space:bereich je Tag; Fokus-Blöcke mit Einheit/Mandat',
  performance: 'Altbestand (bis 21.10.): Wachstums-Score je Tag — Säulen Gesundheit/Familie (privat) und Business/Finanzen in einem Eintrag; seitdem getrennt (privat-score--*, business-verlauf)',
  'performance--*': 'Altbestand (bis 21.10.): Wachstums-Score je Tag — Säulen Gesundheit/Familie (privat) und Business/Finanzen in einem Eintrag; seitdem getrennt (privat-score--*, business-verlauf)',
  tageslauf: 'Tagesläufe: Ausrichtung mit Tagesform (Art. 9) und Business-Prioritäten in einem Text',
  'tageslauf--*': 'Tagesläufe: Ausrichtung mit Tagesform (Art. 9) und Business-Prioritäten in einem Text',
  // ── Kalender ──
  'calendar-cache': 'Kategorie/Kalender je Termin (privat, gemeinsam, holding, Google je Person) — Space über kalender-einstellungen',
  'kalender-icloud': 'iCloud-Spiegel des Haushalts — Space je Kalender aus kalender-einstellungen (privat, gemeinsam, Business)',
  'kalender-bezug': 'Bezug je Termin: Kontakt/Firma/Mandat/Deal/Event (Business) und Aufgabe (beide); der Termin liegt im privaten oder geschäftlichen Kalender',
  meetings: 'kein Feld — Bereich nur über den Termin (Kalender → Space)',
  'apple-reminders-cache': 'Altbestand: Erinnerungen-Listen vom Mac ohne Bereich (eingefroren, als Aufgaben übernommen)',
  'apple-contacts-cache': 'Altbestand: Adressbuch vom Mac ohne Bereich (eingefroren)',
  // ── Postfächer ──
  'imap-stand--*': 'mehrere Postfächer je Person in einem Bestand — postfachId → Bereich im Register postfaecher--*',
  'imap-text--*': 'mehrere Postfächer je Person in einem Bestand — postfachId → Bereich im Register postfaecher--*',
  'inbox-zustand--*': 'je Gespräch (Kennung → Postfach → Bereich) und Screener je Absender',
  'inbox-uebergaben--*': 'je Übergabe das Gespräch → Postfach → Bereich',
  'inbox-uebergaben': 'Datei-Ordner der Übergaben — je Datei die Übergabe → Gespräch → Postfach → Bereich',
  'inbox-geteilt--*': 'je Gespräch → Postfach → Bereich',
  'inbox-absender': 'Altbestand: Screener aller Postfächer ohne Bereich (abgelöst durch inbox-zustand--*)',
  'inbox-triage': 'Altbestand: Einstufungen von Mails aller Postfächer ohne Bereich',
  'inbox-status': 'Altbestand der alten Inbox: Zustand je Mail aller Postfächer ohne Bereich',
  'apple-mail-cache': 'Altbestand: Mail-Zwischenspeicher vom Mac (private und geschäftliche Postfächer, ohne Bereich)',
  // ── Finanzen und Steuern ──
  finanzplan: 'Rechnungen/Zahlungen/Merkposten/Konten je firmaId (Selbstständigkeit = Privat, kdv/ug = Business)',
  rechnungswesen: 'Nummernkreise je Gesellschaft (auch Selbstständigkeit)',
  'finanzen-plan--*': 'EIN Dokument je Haushalt, Pfade privat/business (businessSicht, privatTeil); Selbstständigkeit unter Privat',
  liquiplan: 'Planposten je Firma bzw. ausdrücklich privat (ohnePrivatPosten)',
  buchungen: 'Feld ort (privat · kdc · kdv · ug)',
  grundlage: 'V1-Export: Teile p (privat, Kredite), s (Selbstständigkeit), u (UG), b (Belege)',
  'business-abschluesse': 'Monatsabschlüsse je Firma — Selbstständigkeit (Privat) und Business-Gesellschaften, getrennt über bereichVonFirma',
  'abschluss-laeufe': 'Lauf-Protokoll je Gesellschaft (auch Selbstständigkeit)',
  'business-einstellungen': 'je Sicht — gespeicherte Werte der Selbstständigkeit (kdc) bleiben liegen',
  'business-verlauf': 'je Sicht — gespeicherter Verlauf der Selbstständigkeit (kdc) bleibt liegen',
  'finanzchef-einstellung': 'Steuer- und Rechtsform-Einstellungen für kdv UND kdc (Selbstständigkeit)',
  steuern: 'Einstellungen je Steuer-Firma (kdc, kdv) und die private Einkommensteuer',
  'haushalt-*--*': 'Haushaltsfinanzen: Posten/Belege je einheit (privat · kdc · kdv · ug); dazu haushalt-chef--* (Head of Finance Business + Haushalt)',
  'haushalt-umzug--*': 'Umzugskopie der Haushaltsfinanzen (wie haushalt-*--*)',
  'konten--*': 'Konten je Inhaber (Gesellschaft, privat, gemeinsam)',
  'kontoauszug-laeufe--*': 'je Lauf das Konto → Gesellschaft bzw. privat',
  // ── ZOE, Agenten, KI, Medien ──
  'zoe-verlauf': 'kein Feld — Gespräche mit ZOE über beide Bereiche',
  'zoe-gedaechtnis': 'kein Feld — Merksätze aus beiden Bereichen',
  'zoe-protokoll': 'Werkzeug-Aufrufe beider Bereiche (Bereich über das Werkzeug)',
  'zoe-stapel': 'Vorschläge beider Bereiche (Bereich je Vorschlag abgeleitet, lib/zoe/bereich-server.ts)',
  'zoe-entscheidungen--*': 'Entscheidungen zu Vorschlägen beider Bereiche (Bereich des Vorschlags)',
  'zoe-auftraege': 'Warteschlange der Läufe beider Bereiche (Auftrags- und Ergebnistexte)',
  'zoe-empfang': 'Begrüßungstext aus beiden Bereichen (Zwischenspeicher)',
  'agenten-faeden--*': 'Threads je Person mit ZOE, Business-Heads und Privat-Heads (Agent → Bereich)',
  'agenten-faden--*': 'ein Thread je Datei — Agent → Bereich (ZOE, Business-Head oder Privat-Head)',
  'agenten-skills--*': 'Werkstatt je Haushalt: Business-Heads und Familie-Head (Head → Bereich)',
  'agenten-plan--*': 'Hintergrundaufgaben je Person für beliebige Agenten (Agent → Bereich)',
  'agenten-einstellung--*': 'Business-Heads je Haushalt UND Abschnitte der Privat-Heads je Person (Auftrag an den Gesundheits-Head, Art. 9)',
  'agent-log': 'Läufe aller Agenten (Bereich über den Agenten)',
  'meldungen--*': 'Glocke je Person: Meldungen beider Bereiche mit Titeln (Art/Bezug → Bereich)',
  'ereignisse--*': 'Feld bereich je Ereignis',
  'ki-medien--*': 'Auftragsbuch/Altbestand der KI-Medien — Ziel medien--* (Business) oder medien-privat--* (privat)',
  'ki-medien': 'Dateien der KI-Medien beider Ablagen',
  medien: 'Dateien von medien--* (Business) und medien-privat--* (privat) im selben Speicher — Schlüssel je Medium',
  'medien-uploads': 'offene Uploads für Business- und private Alben (Album → Katalog)',
  // ── Protokolle, deren Einträge je einem Bestand/Bereich gehören ──
  'aenderungsprotokoll--*': 'Feld bestand je Eintrag → Bereich des Bestands',
  'leseprotokoll--*': 'Feld bereich je Eintrag (gesundheit, finanzen, kontakte, gesellschaften …)',
  aenderungen: 'Altbestand (nur gelesen): Browser-Änderungen je Bestand',
};

const BEREICH_JE_MUSTER: ReadonlyMap<string, SpeicherBereich> = new Map<string, SpeicherBereich>([
  ...IN_PRIVAT.map(m => [m, 'privat'] as const),
  ...IN_BUSINESS.map(m => [m, 'business'] as const),
  ...JE_PERSON.map(m => [m, 'person'] as const),
  ...INSTANZ.map(m => [m, 'instanz'] as const),
  ...Object.keys(GEMISCHT).map(m => [m, 'gemischt'] as const),
]);
/** Wie oft ein Muster in den Bereichs-Listen steht — für den Wächter (genau einmal). */
export function bereichNennungen(muster: string): number {
  return [IN_PRIVAT, IN_BUSINESS, JE_PERSON, INSTANZ, Object.keys(GEMISCHT)].reduce((n, l) => n + l.filter(x => x === muster).length, 0);
}
/** Alle Muster der Bereichs-Listen (Wächter: keine toten Einträge). */
export const BEREICH_MUSTER: readonly string[] = [...IN_PRIVAT, ...IN_BUSINESS, ...JE_PERSON, ...INSTANZ, ...Object.keys(GEMISCHT)];

export const SPEICHER_REGISTER: readonly SpeicherEintrag[] = REGISTER_EINTRAEGE.map(e => {
  const bereich = BEREICH_JE_MUSTER.get(e.muster);
  if (!bereich) return e;
  return bereich === 'gemischt' ? { ...e, bereich, trennung: GEMISCHT[e.muster] } : { ...e, bereich };
});

/** Dynamische Namen im Code, deren Präfix aus einer Konstante kommt (`${KONSTANTE}${…}` → „**“) — mit ihrem Muster. */
export const DYNAMISCHE_NAMEN: Readonly<Record<string, { datei: string; muster: string }>> = {
  '**': { datei: 'lib/crm/verbindungen-laden.ts', muster: 'aufgaben-dateien--*' },
};

const alsRegex = (muster: string) => new RegExp(`^${muster.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

/** Der Register-Eintrag für einen Bestandsnamen (auch ein Code-Muster wie `heads-replay-*`) — oder null. */
export function registerEintrag(name: string): SpeicherEintrag | null {
  return SPEICHER_REGISTER.find(e => e.muster === name || alsRegex(e.muster).test(name)) ?? null;
}

/** Bereich eines Bestandsnamens laut Register — oder null (unbekannt). Noch ohne Wirkung; Grundlage der Stufen 2–4 im Plan. */
export function bereichVonBestand(name: string): SpeicherBereich | null {
  return registerEintrag(name)?.bereich ?? null;
}
