// ─── MAKE OS — Onboarding „Einrichtung“ (Daten, rein, client-sicher) ────────
// Kevin 08.10. spät: „Ich möchte, dass du ein sauberes Onboarding für uns baust. Mit dem nächsten Update soll ein komplettes
// Onboarding mit Erklärung durchgeführt werden, sodass wir alles wirklich sauber verbinden können. Auch alle Zahlen, Daten,
// Fakten sollen sauber rein.“ Konzept: ONBOARDING_PLAN.md (Teil A) — das „Freitag-Paket“ B0 (alle Schritte der Etappen 0–8 mit Erklärung
// und die Datenkarte A3) und B1 (09.10., für Update 2): Ebenen statt Namen.
//
// Der Plan prüft sich selbst: Wo das System nachsehen kann, ob ein Schritt getan ist, zählt der echte Zustand (lib/onboarding-status.ts,
// nur ja/nein oder Zähler, nie Werte). Nur was sich nicht messen lässt, hakt man von Hand ab — gespeichert serverseitig
// (app/api/onboarding/route.ts): persönliche Häkchen je Person (`onboarding--<speicher>`), gemeinsame im Bestand `onboarding`.
//
// Drei Ebenen (ONBOARDING_PLAN.md A1), gebildet aus den Konten — keine Namen im Code (B1, 09.10.: die früheren Spuren mit
// Personen-Kennungen sind weg; `EBENEN`, Seiten /os/onboarding/{instanz,gemeinsam,ich}, alte Adressen nur in next.config.mjs):
//   instanz    Server und Einstellungen der Instanz — nur ein Inhaber hakt ab (`nurInhaber`; seit R9 jeder Inhaber)
//   gemeinsam  Haushalt und Firmen — eine Person trägt ein, alle sehen den Stand (`nurInhaber`, wo ein Inhaber es tun muss)
//   ich        „Meine Einrichtung“ — jede Person für sich; Prüfung und Häkchen gelten nur der Person der Sitzung
// Wer welchen Schritt bekommt, steht NUR in `schrittFuer` (Rolle, Zahl der Konten, „eingeladen“ — alles aus dem Konto).
// Wächter: tests/onboarding-stand.test.ts, tests/onboarding-ebenen.test.ts, tests/onboarding-u2.test.ts.
//
// Update 2 (16.10., ONBOARDING_PLAN.md A5 B4/B8/B10): jeder Schritt trägt sein Modul (`modul` — eine Instanz „nur Markttraktion“ zeigt nur
// Grundlage + ihre Schritte, `nurModule`), Voraussetzungen (`nach` — nur als Hinweis und für „Als Nächstes“, nie eine zweite Fertig-Regel),
// worauf er wartet (`wartetAuf`, Text) und welche Zahlen der Datenkarte er einträgt (`datenOrt`). Ein Befund kann „leer“ sein (nichts zu prüfen
// — dann entscheidet das Häkchen) oder „veraltet“ (nur fürs Bild der Datenbasis). „Zurückgefallen“ (B10) = ein Schritt mit Prüfung, der schon
// einmal grün war (`gruen`, festgehalten im Morgenlauf) und jetzt rot ist — EINE Regel `zurueckgefallen`, für Heute-Karte und Einrichtung.
//
// Neustart (09.10., Kevin: „Wir fangen bei 0 an … Wir sind ein komplett ‚neuer‘ Kunde und wollen als Paar geonboardet werden. Jeder für sich.“ —
// Nachtrag: „dass wir alles einmal eingeben müssen … Dann können wir alle Schnittstellen extrem sauber ziehen“): trägt die Instanz die Marke des
// Neustarts (`Kontext.neustart`, lib/onboarding-neustart.ts), gilt ein eigener Ablauf — ALS DATEN unten (`NEUSTART_ETAPPEN`, `NEUSTART`,
// `NEUSTART_ENTFAELLT`): (1) Zugang & Sicherheit → (2) alles eingeben (je Person Ziele, Alltag, Gesundheit; gemeinsam Planung, Familie, Finanzen;
// „Business online“: Gesellschaft & Konten, Angebot & Vertrieb) → (3) Schnittstellen → (4) Agenten → Abschluss. Der Kern sind (1)+(2). Jeder
// Schritt bekommt dort seine Fassung (`fassungFuer`: Etappe, Nummer, Kern/danach, Texte) — die Fertig-Regel bleibt `istFertig`. Ein Schritt, der
// NICHT in der Tabelle steht (z. B. ein neuer Schritt eines anderen Pakets), landet über `neustartEtappeVon` in der passenden Etappe — ein
// Gesundheits-Schritt „ich“ in „Meine Gesundheit“ — und behält seine Gruppe; niemand muss die Tabelle dafür anfassen.

import { WEG } from '@/lib/wege';
import { BUSINESS_EINHEITEN_NAMEN, UG_NAME } from '@/lib/einheiten';

export type Ebene = 'instanz' | 'gemeinsam' | 'ich';

/**
 * Modul eines Schritts (A1.10 „modul-fähig“): `grundlage` braucht jede Instanz (Server, Zugang, Datenschutz, Abschluss); die übrigen gehören zu
 * einem Bereich, den eine Instanz auch einzeln haben kann. Kennungen nie ändern (Filter, spätere Lizenzen).
 */
export type Modul = 'grundlage' | 'kalender' | 'postfach' | 'unternehmen' | 'finanzen' | 'markttraktion' | 'planung' | 'gesundheit' | 'familie' | 'zoe';
export const MODULE: Readonly<Record<Modul, string>> = {
  grundlage: 'Grundlage', kalender: 'Kalender', postfach: 'Postfächer', unternehmen: 'Unternehmen', finanzen: 'Finanzen', markttraktion: 'Markttraktion',
  planung: 'Planung & Aufgaben', gesundheit: 'Gesundheit', familie: 'Familie', zoe: 'ZOE & Brain',
};

/** Ein Befund der Server-Prüfung (lib/onboarding-status.ts) — nur ja/nein und Zähler, nie Werte. */
export interface PruefBefund {
  erfuellt: boolean;
  wert: string;
  /** Es gibt (noch) nichts zu prüfen (z. B. kein laufendes Mandat, noch kein Monatsabschluss fällig) — dann entscheidet das Häkchen. */
  leer?: true;
  /** Rot, weil ein Stand zu alt ist (Kontostand, Sicherung) — nur fürs Bild der Datenbasis; zählt wie rot. */
  veraltet?: true;
}

export interface Schritt {
  id: string;
  /** Etappe 0–8 (ONBOARDING_PLAN.md A2). */
  etappe: number;
  /** Nummer im Plan, z. B. „3.6“ — nur zum Wiederfinden. */
  nr: string;
  ebene: Ebene;
  titel: string;
  /** Warum das gebraucht wird — ohne das ist es eine Aufgabenliste ohne Sinn. */
  warum: string;
  /** Was zu tun ist bzw. was dabei passiert. */
  wie: string[];
  /** Was danach anders ist. */
  danach?: string;
  minuten: number;
  wo?: { href: string; label: string };
  /** Am Server: der Befehl — nie ein Wert (Platzhalter in spitzen Klammern). */
  befehl?: string;
  /** Schlüssel, unter dem der Server den echten Zustand prüft (lib/onboarding-status.ts). */
  pruefung?: string;
  /** Am Server (nur der Inhaber, per SSH). */
  server?: true;
  /** Nur der Inhaber darf abhaken (Server und Einstellungen der Instanz, Firmen-Grundlagen) — sonst 403. */
  nurInhaber?: true;
  /** Optional: zählt nicht im Fortschritt mit, solange er offen ist. */
  optional?: true;
  /** Entfällt, wenn die Instanz nur ein Konto hat. */
  nurMitMehreren?: true;
  /** Kern des langen Samstags (Kevin R1: „Alles an einem langen Samstag (≈ 8 h), Rest einzeln“). */
  samstag?: true;
  /** Einzeln bis 16.10. — zählt im Fortschritt und auf Heute wie optional (erst, wenn getan). */
  spaeter?: true;
  /** Die Prüfung zeigt nur einen Teil (z. B. „Kontakte da“) — fertig erst mit Prüfung UND Häkchen. */
  bestaetigen?: true;
  /** Hängt am Stichtag bzw. an Zahlen — alte Häkchen (vor dem 08.10.) werden hier nie übernommen. */
  stichtag?: true;
  /** Nur für Konten mit Zugang zu den Privat-Finanzen (nicht `finanzRecht: 'business'`) — sonst weder gezählt noch abhakbar. */
  privatFinanzen?: true;
  /**
   * Gehört in den Privat-Bereich (z. B. eigene Ziele) — wie Gesundheit, Familie und Privat-Finanzen hat ein Konto „nur Business“ ihn nicht
   * (`istPrivatSchritt`, EINE Konto-Sicht).
   */
  privat?: true;
  /** Nur auf einer Instanz mit Altbestand im Code (Inhaber-Konto vor dem 09.10.2026, keine Demo) — `Kontext.altbestand`. */
  nurAltbestand?: true;
  /** Nur für Konten, die über eine Einladung kamen (jedes Konto außer dem Haupt-Inhaber) — `Kontext.eingeladen`. */
  nurEingeladen?: true;
  /** Nur im Neustart (`Kontext.neustart`) — sonst weder gezählt noch abhakbar. Nummer und Gruppe kommen dann aus `fassungFuer`. */
  nurNeustart?: true;
  /** Nur in einer Fassung (`fassungFuer`, Neustart) gesetzt: Reihenfolge im Ablauf. Nie in `SCHRITTE`. */
  reihe?: number;
  /** Modul (B4) — gesetzt an jedem Schritt (Wächter); fehlt es, gilt `grundlage`. */
  modul?: Modul;
  /** Voraussetzungen (Kennungen anderer Schritte, B4): nur Hinweis („erst …“) und Reihenfolge von „Als Nächstes“ — nie eine Sperre. */
  nach?: string[];
  /** Worauf der Schritt wartet, das sich nicht abhaken lässt (z. B. die erste Nachtsicherung) — Text, kein Wert. */
  wartetAuf?: string;
  /** Welche Zahlen der Datenkarte hier eingetragen werden (Kennungen aus `DATENKARTE`). */
  datenOrt?: string[];
  /**
   * Die Fassung für eine Instanz OHNE Altbestand (Rundgang 09.10.): wo Titel oder Anleitung Daten und Entscheidungen der gewachsenen
   * Instanz tragen (Stichtag, Planbeginn, „eure Entscheidung vom …“), steht hier der neutrale Text. Gelesen NUR über `texteFuer`.
   */
  allgemein?: Partial<Pick<Schritt, 'titel' | 'warum' | 'wie' | 'danach'>>;
}

/** Die drei Ebenen als Seiten (Filter auf die Einrichtung). `nurInhaber`: die Seite zeigt ihre Schritte nur Inhabern. */
export interface EbeneSeite { id: Ebene; titel: string; satz: string; href: string; nurInhaber?: true }
export const EBENEN: readonly EbeneSeite[] = [
  { id: 'ich', titel: 'Meine Einrichtung', satz: 'Jede Person für sich: Zugang, Verbindungen, Arbeitsrahmen, Gesundheit, ZOE — Prüfung und Häkchen gelten nur dir.', href: '/os/onboarding/ich' },
  { id: 'gemeinsam', titel: 'Gemeinsam', satz: 'Haushalt und Firmen: Stichtag, Zahlen, Kartei, Planung, Familie — eine Person trägt ein, alle sehen den Stand.', href: '/os/onboarding/gemeinsam' },
  { id: 'instanz', titel: 'Instanz', satz: 'Server, Sicherheit und Einstellungen der Instanz — das richten die Inhaber ein.', href: '/os/onboarding/instanz', nurInhaber: true },
];
/** Die Ebene per Kennung (null = unbekannt). */
export const ebeneMitId = (id: string): EbeneSeite | null => EBENEN.find(e => e.id === id) ?? null;

/**
 * Ein Hinweis in einer Etappe: entschieden, aber noch nicht gebaut — kein Schritt, kein Häkchen. `nurAltbestand`: betrifft nur die
 * gewachsene Instanz (z. B. ein Abschalten nach ihrem Upload) — eine neue Instanz zeigt ihn nicht.
 */
export interface EtappenHinweis { titel: string; satz: string; wann: string; nurAltbestand?: true }
/**
 * `allgemein`: Titel/Satz für eine Instanz ohne Altbestand (ohne Upload-Tag und Daten) — gelesen nur über `etappenFuer`. `datenkarte`: in dieser
 * Etappe werden Zahlen eingetragen — die Einrichtung verweist auf die Datenkarte.
 */
export interface Etappe { nr: number; titel: string; satz: string; hinweise?: EtappenHinweis[]; allgemein?: { titel?: string; satz?: string }; datenkarte?: true }

export const ETAPPEN: Etappe[] = [
  { nr: 0, titel: 'Am Upload-Tag und direkt danach', satz: 'Am Server, nur der Inhaber — am Abend des Uploads. Die zweite Kopie am Mac geht erst am Tag nach der ersten Nachtsicherung.',
    allgemein: { titel: 'Server und Instanz', satz: 'Am Server, nur die Inhaber — bevor die anderen loslegen. Die zweite Kopie der Sicherung geht erst nach der ersten Nachtsicherung.' },
    hinweise: [{ titel: 'Mac-Zulieferer wird abgeschaltet', wann: 'nach dem Upload', nurAltbestand: true, satz: 'Alles läuft nur noch auf dem Server; am Mac bleibt nur der Mail-Weg. Unter Einstellungen › Verbindungen › Mac-Zulieferer die Apple-Erinnerungen einmal als Aufgaben übernehmen (Vorschau → Bestätigen) — danach ist der Zulieferer aus; am Mac den Dienst mit scripts/mac-zulieferer-entfernen.sh entfernen. Kein eigener Zulieferer-Schlüssel mehr.' }] },
  { nr: 1, titel: 'Zugang, Sicherheit, Datenschutz', satz: 'Wer reinkommt, wie er sich ausweist, wer was sieht — und was die Instanz mit Daten tun darf.' },
  { nr: 2, titel: 'Verbindungen', satz: 'Kalender, Postfächer und Geräte. Jede Person verbindet nur ihre eigenen Konten; niemand liest die Post einer anderen Person.',
    hinweise: [{ titel: 'ZOE aufs Handy über WhatsApp', wann: 'kommt in Phase 1', satz: 'ZOE bekommt eine eigene, zweite WhatsApp-Business-Nummer — nur für ZOE, getrennt von der Business-Nummer der Inbox. Telegram ist raus; bis dahin gibt es dafür keinen Schritt.' }] },
  { nr: 3, titel: 'Firmen & Zahlen', satz: 'Steckbrief, 0-Punkt, Kontostände, offene Posten, Privatkonten. Jede Zahl hat genau einen Eingabeort — siehe Datenkarte. Alle Zahlen kommen von Hand über die vorhandenen Formulare.',
    datenkarte: true,
    hinweise: [
      { titel: 'Bank-Anbindung', wann: 'vorgezogen in Phase 1', satz: 'Bis dahin tragt ihr Kontostände und Buchungen von Hand ein bzw. lest Kontoauszüge ein.' },
      { titel: 'Haushalt → Finanzplanung', wann: 'Brücke kommt in Phase 1', satz: 'Der Haushalt führt das Ist (Buchungen, Fixkosten, Budget, Schulden); die Finanzplanung liest künftig daraus. Bis dahin nicht doppelt pflegen.' },
    ] },
  { nr: 4, titel: 'Kontakte, Vertrieb & Mandate', satz: 'Kartei, Produkte, laufende Mandate, offene Deals und die Grundlagen des Vertriebs.' },
  { nr: 5, titel: 'Planung & Finanzplan', satz: 'Ziele, Meilensteine, Finanzplan, Arbeitsrahmen und die gemeinsamen Rhythmen.', datenkarte: true },
  { nr: 6, titel: 'Gesundheit & Familie', satz: 'Gesundheit macht jede Person nur für sich. Familie richtet ihr gemeinsam ein.' },
  { nr: 7, titel: 'ZOE & Brain', satz: 'Wie viel die Agenten selbst tun dürfen, wie ZOE arbeitet und was im Brain steht.' },
  { nr: 8, titel: 'Abschluss', satz: 'Einmal durch alles gehen, den Datenstand prüfen, den Head of IT auf Grün bringen.' },
];

/**
 * Der Ablauf (Kevin 08.10. spät, Entscheidung R1: „Alles an einem langen Samstag (≈ 8 h), Rest einzeln“): Server-Teil am Abend des
 * Uploads, dann der Samstag-Kern (`samstag`), der Rest einzeln bis 16.10. (`spaeter`). Die Minuten des Samstags je Rolle hält der
 * Wächter tests/onboarding-stand.test.ts unter acht Stunden.
 */
export const ABLAUF: { wann: string; was: string }[] = [
  { wann: 'Freitag 09.10., nach dem Upload', was: 'Etappe 0 am Server (Inhaber, etwa 2½ Stunden). Zuerst 1.8 (eigene Einwilligung (a) zur Gesundheit), dann 0.1 Update, 0.2 Pepper, 0.5 Altbestand, 0.6 Sicherung, 0.8 Vault, 0.9 Adresse, 0.10 WHOOP- und 0.11 Google-Anwendung.' },
  { wann: 'Samstag 10.10. (höchstens etwa 8 Stunden)', was: 'Alle Schritte mit „Samstag“: vormittags jede Person ihre Etappen 1 und 2 (Zugang, Verbindungen), danach gemeinsam Stichtag, 0-Punkt, Kontostände, offene Posten, Kartei, Jahresziele, Finanzplan, Gesundheit und Familie. Die zweite Person braucht deutlich weniger Zeit.' },
  { wann: 'Einzeln bis 16.10.', was: 'Alles mit „einzeln“: zweite Kopie am Mac und Probe (frühestens Sonntag), Mandate, Produkte, Vertrieb, Planung, Steuerprofil, ZOE, Brain, Abschluss — Mail-Umzug und WhatsApp als eigene Termine. Der erste Monatsabschluss (Oktober) kommt Anfang November. Der Altbestand (0.5) muss vor dem Update am 16.10. übernommen sein.' },
];

/**
 * Der Ablauf einer Instanz ohne Altbestand (Rundgang 09.10.: eine neue bzw. fremde Instanz sah sonst den Upload-Fahrplan der gewachsenen
 * Instanz mit festen Tagen): dieselbe Reihenfolge, ohne Datum.
 */
export const ABLAUF_ALLGEMEIN: { wann: string; was: string }[] = [
  { wann: 'Zuerst · am Server', was: 'Etappe 0 — nur die Inhaber: Update, Schlüssel, Sicherung, Vault, Adresse und die Anwendungen für die Verbindungen, jeweils mit Befehl. Wer Gesundheitsdaten nutzt, gibt vorher die eigene Einwilligung (1.8).' },
  { wann: 'Der Kern', was: 'Alle Schritte mit „Der Kern“: zuerst jede Person ihre Etappen 1 und 2 (Zugang, Verbindungen), danach gemeinsam Stichtag, 0-Punkt, Kontostände, offene Posten, Kartei, Jahresziele, Finanzplan, Gesundheit und Familie. Weitere Personen brauchen deutlich weniger Zeit.' },
  { wann: 'Nach und nach', was: 'Alles mit „Nach und nach“: zweite Kopie der Sicherung und Probe, Mandate, Produkte, Vertrieb, Planung, Steuerprofil, ZOE, Brain, Abschluss — Mail-Umzug und WhatsApp als eigene Termine. Der erste Monatsabschluss kommt nach dem ersten vollen Monat ab dem Stichtag.' },
];

/**
 * Der Ablauf im Neustart (Kevin 09.10., Nachtrag: „dass wir alles einmal eingeben müssen, was wir wollen. Dann können wir alle Schnittstellen
 * extrem sauber ziehen“): Zugang → alles eingeben → Schnittstellen → Agenten. Ohne Datum, ohne Namen.
 */
export const ABLAUF_NEUSTART: { wann: string; was: string }[] = [
  { wann: 'Zuerst · am Server', was: 'Etappe 0 — nur die Inhaber. Auf einem bestehenden Server ist das meiste schon grün; offen bleibt, was die neue Instanz braucht.' },
  { wann: 'Der Kern · Zugang', was: 'Etappe 1 — jede Person: zweiter Faktor, Einwilligungen, eigene KI-Schalter, Handy, ein kurzer Rundgang; die Inhaber: Haushalt, Datenschutz, KI der Instanz.' },
  { wann: 'Der Kern · alles eingeben', was: 'Etappen 2 bis 7 — jede Person ihre eigenen Ziele, ihren Alltag und ihre Gesundheit; gemeinsam Planung, Familie und Finanzen; dann „Business online“: Gesellschaft & Konten, Angebot & Vertrieb. Zahlen eintragen oder hochladen (Kontoauszug, Excel, OP-Liste).' },
  { wann: 'Danach · Schnittstellen', was: 'Etappe 8 — Kalender, Postfächer, WHOOP und WhatsApp sauber neu verbinden, jede Person ihre eigenen.' },
  { wann: 'Danach · Agenten und Abschluss', was: 'Etappen 9 und 10 — Agenten einstellen, ZOE und Brain; zum Schluss Datenstand und Head of IT.' },
];

/** Der Ablauf für diese Instanz: im Neustart dessen Ablauf, mit Altbestand der Fahrplan ihres Uploads (`ABLAUF`), sonst der neutrale ohne Datum. Rein. */
export const ablaufFuer = (altbestand: boolean, neustart = false): readonly { wann: string; was: string }[] => (neustart ? ABLAUF_NEUSTART : altbestand ? ABLAUF : ABLAUF_ALLGEMEIN);

/**
 * Die Etappen für diese Instanz: im Neustart die des Neustarts (`NEUSTART_ETAPPEN`); ohne Altbestand mit neutralem Titel/Satz und ohne Hinweise,
 * die nur die gewachsene Instanz betreffen. Rein.
 */
export function etappenFuer(altbestand: boolean, neustart = false): Etappe[] {
  if (neustart) return NEUSTART_ETAPPEN;
  if (altbestand) return ETAPPEN;
  return ETAPPEN.map(({ allgemein, hinweise, ...e }) => {
    const h = (hinweise ?? []).filter(x => !x.nurAltbestand);
    return { ...e, ...(allgemein ?? {}), ...(h.length ? { hinweise: h } : {}) };
  });
}

/** Titel, Anleitung und Ergebnis eines Schritts für diese Person — ohne Altbestand die neutrale Fassung (`allgemein`). Rein. */
export function texteFuer(s: Schritt, k: Pick<Kontext, 'altbestand'> | null | undefined): Schritt {
  return k?.altbestand || !s.allgemein ? s : { ...s, ...s.allgemein };
}

const KONTO = { href: WEG.konto(), label: 'Konto' };
const HOI = { href: '/os/hoi', label: 'Head of IT' };
const BUSINESS = BUSINESS_EINHEITEN_NAMEN.length ? ` (bei euch: ${BUSINESS_EINHEITEN_NAMEN.join(' · ')})` : '';

export const SCHRITTE: Schritt[] = [
  // ── Etappe 0 — Am Upload-Tag und direkt danach (Server, nur der Inhaber) ─────────────────────────────────────────────────────
  {
    id: 'update', etappe: 0, nr: '0.1', ebene: 'instanz', server: true, nurInhaber: true, minuten: 25,
    modul: 'grundlage',
    titel: 'Update einspielen',
    warum: 'Erst mit dem neuen Stand gibt es diese Einrichtung, die Prüfungen und alle Verbindungen. Vorher wird gesichert, damit es einen Weg zurück gibt.',
    wie: [
      'Vorher am Server eine Sicherung ziehen (wie beim letzten Update) — die Anleitung steht in UPLOAD_0810.md, Abschnitt 0.',
      'Den Stand „entwicklung“ nach „main“ zusammenführen und hochladen. Die GitHub-Aktion prüft und rollt aus (etwa fünf Minuten, die alte Version läuft solange weiter).',
      'Danach im App-Ordner am Server die Caddy-Einstellung prüfen und neu laden (Befehl unten).',
    ],
    danach: 'Der Head of IT zeigt die neue Bau-Kennung; diese Seite zeigt alle neuen Schritte.',
    befehl: 'cd /srv/make-os/app && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile\ncd /srv/make-os/app && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile',
    wo: HOI,
  },
  {
    id: 'pepper', etappe: 0, nr: '0.2', ebene: 'instanz', server: true, nurInhaber: true, minuten: 10, pruefung: 'pepper',
    modul: 'grundlage', nach: ['update'],
    titel: 'Pepper und strenger Start-Riegel',
    warum: 'Mit dem Pepper sind die Fingerabdrücke gesperrter oder gelöschter Personen nicht mehr zu erraten. Der strenge Start-Riegel sorgt dafür, dass MAKE OS ohne seine Geheimnisse gar nicht erst startet.',
    wie: [
      'Am Mac einen Wert erzeugen (Befehl unten) und in beide Passwort-Manager und auf Papier legen. Den Pepper nie wechseln.',
      'Am Server in die .env: MAKE_OS_PEPPER=<Wert> und MAKE_OS_START_RIEGEL=streng — dann neu starten.',
      'Startet die App nicht, nennt das Log, was fehlt oder zu kurz ist (nur Namen, nie Werte).',
    ],
    danach: 'Im Head of IT stehen „Start-Riegel“ und die Fingerabdrücke (HMAC mit Pepper) auf Grün.',
    befehl: 'openssl rand -hex 32          # am Mac\ncd /srv/make-os/app && nano .env      # MAKE_OS_PEPPER=<Wert> · MAKE_OS_START_RIEGEL=streng\ncd /srv/make-os/app && docker compose up -d',
    wo: HOI,
  },
  {
    id: 'altbestand', nurAltbestand: true, etappe: 0, nr: '0.5', ebene: 'instanz', server: true, nurInhaber: true, minuten: 15,
    modul: 'grundlage', nach: ['update', 'ich-gesundheit'],
    titel: 'Altbestand übernehmen — vor dem Update am 16.10.',
    warum: 'Bisherige persönliche Inhalte standen im Code: das Körper-Profil und der Nordstern (gemeinsamer Satz und persönliches Kernziel). Sie wandern genau einmal in die Daten des Inhabers bzw. des Haushalts und fliegen danach aus dem Code — nichts geht verloren.',
    wie: [
      'Zuerst unter „Meine Einrichtung“ Schritt 1.8 „Gesundheit: Einwilligung erklären“: Das Körper-Profil braucht die Einwilligung (a) zur Verarbeitung; das persönliche Kernziel wird nur mit AUSDRÜCKLICH erklärter Einwilligung (a) übernommen.',
      'Am Server in die .env: MAKE_OS_ALTBESTAND_PERSON=<Speichername des Inhabers>, dann neu starten (Befehl unten).',
      'Im Log je Teil nachsehen — „koerper“, „nordstern“, „kernziel“: „uebernommen“ oder „schon-uebernommen“ (nie Inhalte, nur der Teil). „ohne-einwilligung“ → 1.8 nachholen und neu starten.',
      'Erst danach Körper-Profil und Nordstern bearbeiten.',
      'Muss erledigt sein, bevor das nächste Update (16.10.) das Übernahme-Modul wieder entfernt.',
    ],
    danach: 'Geprüft wird, wie viele der drei Teile (Körper, Nordstern, Kernziel) übernommen bzw. entschieden sind; danach kann die Variable wieder aus der .env.',
    pruefung: 'altbestand',
    befehl: 'cd /srv/make-os/app && nano .env      # MAKE_OS_ALTBESTAND_PERSON=<Speichername>\ncd /srv/make-os/app && docker compose up -d\ncd /srv/make-os/app && docker compose logs app | grep Altbestand',
  },
  {
    id: 'sicherung', etappe: 0, nr: '0.6', ebene: 'instanz', server: true, nurInhaber: true, minuten: 25, pruefung: 'sicherung',
    modul: 'grundlage', nach: ['update'],
    titel: 'Nachtsicherung mit age und Wächter',
    warum: 'Jede Nacht sichert der Server alles verschlüsselt. Den privaten Schlüssel habt nur ihr — ohne ihn ist die Sicherung für niemanden lesbar. Fällt die Sicherung aus, schlägt der Wächter (Healthchecks) Alarm.',
    wie: [
      'age am Mac installieren — ohne Homebrew wie in RESTORE_TEST.md, Abschnitt 1 (Release laden, age und age-keygen nach ~/.local/bin).',
      'Am Mac einmal ein age-Schlüsselpaar erzeugen. Den privaten Schlüssel in beide Passwort-Manager und auf Papier, nie auf den Server.',
      'Am Server age installieren (falls noch nicht da) und nur den öffentlichen Schlüssel ablegen (Befehle unten).',
      'Den Healthchecks-Ping am Server eintragen (Datei .healthchecks-sicherung) — sonst merkt niemand, wenn die Sicherung ausbleibt.',
    ],
    danach: 'Grün erst, wenn die letzte Nachtsicherung gelungen ist, mit age verschlüsselt und den Wächter erreicht hat (bis zur ersten Nacht offen).',
    befehl: 'age-keygen -o <Ort am Mac>/make-os-sicherung.key      # am Mac\ncommand -v age || sudo apt-get install -y age      # am Server\necho \'<öffentlicher Schlüssel age1…>\' > /srv/make-os/sicherung.pub\necho \'<Ping-Adresse von Healthchecks>\' > /srv/make-os/.healthchecks-sicherung',
    wo: HOI,
  },
  {
    id: 'sicherung-mac', spaeter: true, etappe: 0, nr: '0.7', ebene: 'instanz', server: true, nurInhaber: true, minuten: 45, pruefung: 'abholung', bestaetigen: true,
    modul: 'grundlage', nach: ['sicherung'], wartetAuf: 'die erste Nachtsicherung (03:15) — vorher gibt es kein age-Archiv',
    titel: 'Zweite Kopie am Mac — und einmal zurückspielen',
    warum: 'Eine Sicherung, die nie zurückgespielt wurde, ist ein Versprechen. Der zweite Ort holt jede Nacht das neueste Archiv auf den Mac; die Probe beweist, dass es sich wiederherstellen lässt.',
    wie: [
      'Frühestens am Tag nach der ersten Nachtsicherung (03:15) — vorher gibt es kein age-Archiv.',
      'Die Abholung einmal einrichten (nur lesender Zugang) und einmal sofort holen — RESTORE_TEST.md, Abschnitt 2.',
      'Dann die Probe — RESTORE_TEST.md, Abschnitt 3: die age-Identität vorübergehend in eine Datei (Rechte 600), den Datenschlüssel nur in die Umgebung, einmal der Produktionsbau am Mac (nicht gleichzeitig mit Tests). Ergebnis mit Datum in DEPLOY.md festhalten, die Identitäts-Datei danach löschen.',
    ],
    danach: 'Geprüft wird die Abholung: der Mac hat die letzte Sicherung abgeholt und bestätigt. Die Probe bestätigst du mit dem Häkchen — dann wisst ihr, wie lange eine Wiederherstellung dauert.',
    befehl: 'bash deploy/sicherung-abholen.sh --einrichten      # einmal\nbash deploy/sicherung-abholen.sh\nbash deploy/sicherung-probe.sh ~/MAKE-OS-Sicherungen/make-os-<JJJJ-MM-TT>.tar.gz.age <Datei mit der age-Identität> --app',
    wo: HOI,
  },
  {
    id: 'vault', etappe: 0, nr: '0.8', ebene: 'instanz', server: true, nurInhaber: true, minuten: 30, pruefung: 'vault',
    modul: 'zoe', nach: ['update'],
    titel: 'Vault umziehen, Abgleich und App-Spiegel an',
    warum: 'Das Brain ist euer Wissen. Der Server-Vault wird die Wahrheit; der Abgleich hält ihn alle fünf Minuten mit dem Mac gleich. Der App-Spiegel schreibt Projekte, Mandate und Wochen als Notizen ins Brain.',
    wie: [
      'Den Vault genau nach VAULT_UMZUG_ANLEITUNG.md umziehen (Obsidian dabei geschlossen, etwa 20 Minuten). Private Ordner gehen nicht auf den Server.',
      'Am Server den App-Spiegel einschalten (Befehl unten). Der erste Lauf kommt nachts.',
    ],
    danach: 'Geprüft wird der Vault-Abgleich im Head of IT: kein Konflikt, kein gescheiterter Push, letzter Abgleich höchstens zwei Tage alt.',
    befehl: 'cd /srv/make-os/app && nano .env      # MAKE_OS_APP_SPIEGEL=an\ncd /srv/make-os/app && docker compose up -d app',
    wo: HOI,
  },
  {
    id: 'adresse', etappe: 0, nr: '0.9', ebene: 'instanz', server: true, nurInhaber: true, minuten: 5, pruefung: 'adresse',
    modul: 'grundlage', nach: ['update'],
    titel: 'Adresse der Instanz prüfen',
    warum: 'Aus MAKE_OS_ADRESSE entstehen Rückruf-Adressen (Google, WHOOP), Einladungslinks und Cookies. Sie muss genau die Adresse sein, unter der ihr arbeitet — mit https.',
    wie: ['In der .env am Server MAKE_OS_ADRESSE prüfen: genau die Adresse, die im Browser oben steht, mit https:// und ohne Schrägstrich am Ende.'],
    danach: 'Verbindungen mit Google und WHOOP finden ihren Rückweg.',
    befehl: 'cd /srv/make-os/app && grep -c "^MAKE_OS_ADRESSE=https://" .env',
  },
  {
    id: 'whoop-app', etappe: 0, nr: '0.10', ebene: 'instanz', server: true, nurInhaber: true, minuten: 15, pruefung: 'whoop-konfig',
    modul: 'gesundheit', nach: ['adresse'],
    titel: 'WHOOP-Anwendung einmal je Instanz',
    warum: 'Damit jede Person ihr eigenes WHOOP-Konto verbinden kann, braucht die Instanz einmal eine eigene WHOOP-Anwendung (Schnittstelle v2).',
    wie: [
      'Im WHOOP-Entwicklerbereich eine Anwendung anlegen: Redirect …/api/whoop/rueckruf, Webhook …/api/whoop/webhook (jeweils hinter der Adresse aus 0.9), nur die nötigen Lese-Rechte.',
      'Client-ID und Secret über das Skript am Server eintragen — es fragt verdeckt (Befehl unten). Nie in den Chat.',
    ],
    danach: 'Unter Gesundheit erscheint für jede Person die Karte „WHOOP verbinden“.',
    befehl: 'ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/whoop-verbinden.sh',
  },
  {
    id: 'google-app', etappe: 0, nr: '0.11', ebene: 'instanz', server: true, nurInhaber: true, minuten: 25, pruefung: 'google-konfig',
    modul: 'kalender', nach: ['adresse'],
    titel: 'Google prüfen und Gmail freischalten',
    warum: 'Business-Kalender und Gmail laufen über eine Google-Verbindung je Person. Die Instanz braucht dafür einmal ein Google-Projekt mit Gmail-Schnittstelle.',
    wie: [
      'GOOGLE_GMAIL_EINRICHTEN.md, Teil A: Gmail-Schnittstelle an, Bereich „gmail.modify“, Lizenz für jede Person, Datenverarbeitungszusatz in der Admin-Konsole.',
      'Redirect genau: Adresse aus 0.9 + /api/google/rueckruf.',
      'Zugangsdaten über das Skript am Server eintragen (fragt verdeckt).',
    ],
    danach: 'Jede Person kann im Kalender (Business) und in der Inbox ihr Google-Konto verbinden.',
    befehl: 'ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/google-verbinden.sh',
  },
  {
    id: 'notfallmappe', samstag: true, etappe: 0, nr: '0.12', ebene: 'gemeinsam', minuten: 20,
    modul: 'grundlage', nach: ['pepper', 'sicherung'],
    titel: 'Notfallmappe',
    warum: 'Fällt der Inhaber aus, muss jemand an Pepper, age-Schlüssel, Datenschlüssel, Server-Zugang und Wiederherstellungs-Codes kommen — sonst ist alles verschlüsselt und unerreichbar.',
    wie: [
      'Gemeinsam festlegen, wo diese Dinge liegen: auf Papier an einem sicheren Ort und im Passwort-Manager.',
      'Keine Werte in MAKE OS eintragen — hier wird nur abgehakt, dass beide wissen, wo die Mappe liegt (NOTFALL.md).',
    ],
    danach: 'Beide wissen, was im Ernstfall zu tun ist.',
  },
  {
    id: 'medienspeicher', spaeter: true, etappe: 0, nr: '0.13', ebene: 'instanz', server: true, nurInhaber: true, minuten: 20, pruefung: 'medien',
    modul: 'grundlage', nach: ['update'],
    titel: 'Medienspeicher (Object Storage) einrichten',
    warum: 'Fotos und Videos aus „Medien unterwegs“ liegen sonst im Ordner auf dem Server — außerhalb der Nachtsicherung und mit einer festen Grenze. Im Object Storage liegen sie verschlüsselt (je Medium ein eigener Schlüssel, der auf dem Server bleibt).',
    wie: [
      'In der Cloud-Konsole des Anbieters einen privaten Bucket anlegen (Versionierung aus) und eine Lebenszyklus-Regel für abgebrochene Uploads (2 Tage) setzen — Schritte in UPDATES.md, Abschnitt „Medien unterwegs“.',
      'Zugangsschlüssel erzeugen und über das Skript am Server eintragen — es fragt verdeckt (Befehl unten). Nie in den Chat.',
    ],
    danach: 'Geprüft wird: der Object Storage ist vollständig eingerichtet (nicht mehr der Ordner auf dem Server). Der Head of IT meldet einen vollen Speicher.',
    befehl: 'ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/medien-speicher-verbinden.sh',
    wo: HOI,
  },

  // ── Etappe 1 — Zugang, Sicherheit, Datenschutz ───────────────────────────────────────────────────────────────────────────────
  {
    id: 'zweite-einladung', samstag: true, nurEingeladen: true, etappe: 1, nr: '1.0', ebene: 'ich', minuten: 5,
    modul: 'grundlage',
    titel: 'Einladung annehmen',
    warum: 'Erster Schritt: reinkommen. Es gibt keine offene Registrierung — eine Einladung des Inhabers ist der einzige Weg.',
    wie: [
      'Den Einladungslink öffnen (gilt 48 Stunden, nur einmal).',
      'Vorname, E-Mail-Adresse und ein Passwort mit mindestens 10 Zeichen. War die Einladung an vorhandene Daten gebunden, hängen sie jetzt an deinem Konto.',
    ],
    danach: 'Du hast ein eigenes Konto; alles Weitere baut darauf auf.',
  },
  {
    id: 'ich-zwei-faktor', samstag: true, etappe: 1, nr: '1.1', ebene: 'ich', minuten: 5, pruefung: 'zwei-faktor',
    modul: 'grundlage',
    titel: 'Zweiten Faktor einrichten',
    warum: 'Ein Passwort allein reicht für einen Server im Netz nicht. Mit dem zweiten Faktor kommt nur rein, wer zusätzlich dein Handy hat.',
    wie: [
      'Konto › „Zweiter Faktor · Authenticator“ › Einrichten.',
      'Den QR-Code mit einer Authenticator-App scannen (z. B. die Passwörter-App des iPhones) und den 6-stelligen Code bestätigen.',
      'Die Wiederherstellungs-Codes in den Passwort-Manager — sie sind der Weg zurück, wenn das Handy weg ist.',
    ],
    danach: 'Beim Anmelden fragt MAKE OS zusätzlich den Code.',
    wo: KONTO,
  },
  {
    id: 'einladen', samstag: true, etappe: 1, nr: '1.2', ebene: 'instanz', nurInhaber: true, nurMitMehreren: true, minuten: 5, pruefung: 'personen',
    modul: 'grundlage', nach: ['update'],
    titel: 'Zweite Person einladen',
    warum: 'Jede Person hat ein eigenes Konto. Gibt es das Konto schon, ist hier nichts zu tun; arbeitet ihr allein, entfällt der Schritt.',
    wie: [
      'Konto › Einladen: Vorname (optional die E-Mail-Adresse). Soll das Konto an vorhandene Bestände anschließen, den Speichernamen eintragen, unter dem sie liegen.',
      'Den Link schicken — er gilt 48 Stunden und nur einmal.',
    ],
    danach: 'Die zweite Person kann ihre eigene Einrichtung gehen.',
    wo: KONTO,
  },
  {
    id: 'haushalt', samstag: true, etappe: 1, nr: '1.3', ebene: 'instanz', nurInhaber: true, minuten: 5, pruefung: 'haushalt',
    modul: 'grundlage', nach: ['einladen'],
    titel: 'Haushalt und Finanzrecht',
    warum: 'Ohne Haushalt sieht ein Konto keine privaten Finanzen, keine Familie und keine Ernährung. „Nur Business“ sperrt Privates auf dem Server — nicht bloß in der Oberfläche.',
    wie: ['Konto › Haushalt: jedes Konto dem Haushalt zuordnen und bewusst entscheiden, ob es alles sieht oder nur Business.'],
    danach: 'Jedes Konto sieht genau seinen Bereich.',
    wo: KONTO,
  },
  {
    id: 'zwei-faktor-pflicht', samstag: true, etappe: 1, nr: '1.4', ebene: 'instanz', nurInhaber: true, minuten: 2, pruefung: 'zwei-faktor-pflicht',
    modul: 'grundlage', nach: ['ich-zwei-faktor'],
    titel: 'Zweiten Faktor für alle zur Pflicht machen',
    warum: 'Damit kein Konto mit Passwort allein hereinkommt. Vorher zeigt der Head of IT, wie viele Konten noch ohne zweiten Faktor sind.',
    wie: [
      'Zuerst den eigenen zweiten Faktor einrichten (Schritt 1.1).',
      'Dann Konto › „Zugang der Instanz“ › 2FA-Pflicht einschalten.',
    ],
    danach: 'Wer noch keinen zweiten Faktor hat, wird beim nächsten Anmelden zur Einrichtung geführt.',
    wo: KONTO,
  },
  {
    id: 'datenschutz', samstag: true, etappe: 1, nr: '1.5', ebene: 'instanz', nurInhaber: true, minuten: 35, pruefung: 'datenschutz', bestaetigen: true,
    modul: 'grundlage',
    titel: 'Datenschutz der Instanz',
    warum: 'Sobald Kontakte und Mandanten drin sind, braucht die Instanz einen Verantwortlichen, ein vollständiges Empfänger-Register und klare Löschfristen. Hinweis, keine Rechtsberatung.',
    wie: [
      `Den Verantwortlichen in der App eintragen (Datenschutz › Verantwortlicher). Eure Entscheidung vom 08.10.: die ${UG_NAME}.`,
      'Empfänger auf Stand bringen: genutzte Dienste mit Datum des Auftragsverarbeitungsvertrags eintragen, nicht genutzte archivieren. Eine schon gespeicherte Liste kennt neue Startwerte nicht — die von Hand ergänzen.',
      'Die Vorlage für die Information nach Art. 14 prüfen (bevor Kontakte importiert werden, Schritt 4.2).',
      'Die Löschfristen ansehen.',
    ],
    allgemein: { wie: [
      'Den Verantwortlichen in der App eintragen (Datenschutz › Verantwortlicher) — in der Regel die Gesellschaft, die die Instanz betreibt.',
      'Empfänger auf Stand bringen: genutzte Dienste mit Datum des Auftragsverarbeitungsvertrags eintragen, nicht genutzte archivieren. Eine schon gespeicherte Liste kennt neue Startwerte nicht — die von Hand ergänzen.',
      'Die Vorlage für die Information nach Art. 14 prüfen (bevor Kontakte importiert werden, Schritt 4.2).',
      'Die Löschfristen ansehen.',
    ] },
    danach: 'Geprüft wird die Selbstprüfung: Verantwortlicher benannt, jeder Auftragsverarbeiter mit bestätigtem Vertrag, Drittländer mit Garantie. Art.-14-Vorlage und Löschfristen bestätigst du mit dem Häkchen.',
    wo: { href: WEG.datenschutz('verantwortlicher'), label: 'Datenschutz › Verantwortlicher' },
  },
  {
    id: 'ki-instanz', samstag: true, etappe: 1, nr: '1.6', ebene: 'instanz', nurInhaber: true, minuten: 10, pruefung: 'ki',
    modul: 'zoe', nach: ['datenschutz'],
    titel: 'KI der Instanz',
    warum: 'Ohne Schlüssel und Guthaben fallen ZOE und die Heads still auf das Regelwerk zurück. Die Schalter der Instanz legen fest, ob KI im Hintergrund läuft, ob sie im Web suchen darf und für welche Bereiche.',
    wie: [
      'Im Head of IT nachsehen, ob die KI erreichbar ist (Schlüssel, Guthaben).',
      'Unter Datenschutz › KI die Schalter der Instanz bewusst setzen.',
    ],
    danach: 'Geprüft wird: Schlüssel da, Guthaben verfügbar, die Schalter der Instanz einmal bewusst gesetzt. Jede Person kann für sich nur noch weiter einschränken (Schritt 1.9).',
    wo: { href: WEG.datenschutz('ki'), label: 'Datenschutz › KI' },
  },
  {
    id: 'ich-sicht', samstag: true, etappe: 1, nr: '1.7', ebene: 'ich', minuten: 10,
    modul: 'grundlage', nach: ['haushalt'],
    titel: 'Wer sieht was — und was ich teile',
    warum: 'Gemeinsam heißt nicht: alles für alle. Die Trennung macht der Server — was du nicht sehen darfst, kommt gar nicht erst bei dir an.',
    wie: [
      'Gemeinsam: Aufgaben und Projekte (außer „nur ich“), Kontakte und Markttraktion, Finanzen je nach Recht, gemeinsame Kalender.',
      'Nur du: deine Notizen, „nur ich“-Aufgaben, private Termine (andere sehen „Belegt“), Routinen, Postfächer, deine Agenten-Läufe und dein Körper-Profil.',
      'Ob jemand deine Gesundheit und deine eigenen Ziele sieht, entscheidest du selbst: Konto › „Gesundheit teilen“ und „Eigene Ziele teilen“. Vorgabe: niemand.',
      'In Kalender, die nicht privat sind, darf die andere Person schreiben — wie eine Assistenz.',
    ],
    danach: 'Du weißt, was geteilt ist und was nur dir gehört.',
    wo: KONTO,
  },
  {
    id: 'ich-gesundheit', samstag: true, etappe: 1, nr: '1.8', ebene: 'ich', minuten: 5, pruefung: 'gesundheit-einwilligung',
    modul: 'gesundheit',
    titel: 'Gesundheit: Einwilligung erklären',
    warum: 'Gesundheitsdaten sind besonders geschützt (Art. 9 DSGVO). MAKE OS erfasst sie erst, wenn du selbst einwilligst — jede Person für sich, niemand für eine andere. Der Inhaber macht das zuerst, vor der Übernahme des Altbestands (0.5).',
    allgemein: { warum: 'Gesundheitsdaten sind besonders geschützt (Art. 9 DSGVO). MAKE OS erfasst sie erst, wenn du selbst einwilligst — jede Person für sich, niemand für eine andere. Ohne (a) bleiben Körper-Profil, Sport und WHOOP leer.' },
    wie: [
      '(a) Verarbeiten: MAKE OS speichert deine Gesundheitsdaten für deine eigenen Auswertungen. Ohne (a) wird nichts erfasst.',
      '(b) An die KI: ZOE und automatische Läufe dürfen deine Gesundheitswerte nutzen. Setzt (a) voraus.',
      '(c) Partner: Personen, mit denen du Gesundheit teilst, dürfen sie auch über ihre ZOE abfragen. Setzt (a) und (b) voraus.',
      'Jede Erklärung lässt sich an derselben Stelle widerrufen.',
    ],
    danach: 'Gesundheit, Sport und WHOOP arbeiten mit deinen Daten — nur so weit, wie du eingewilligt hast.',
    wo: { href: WEG.datenschutz('gesundheit'), label: 'Einstellungen › Datenschutz' },
  },
  {
    id: 'ich-ki', samstag: true, etappe: 1, nr: '1.9', ebene: 'ich', minuten: 5,
    modul: 'zoe', nach: ['ki-instanz'],
    titel: 'Eigene KI-Schalter',
    warum: 'Die Instanz gibt den Rahmen vor; du kannst für dich nur weiter einschränken — etwa keine KI im Hintergrund für deine Bereiche.',
    wie: ['Datenschutz › KI: deine eigenen Schalter ansehen und bewusst setzen.'],
    danach: 'ZOE und die Läufe halten sich an deine Grenzen.',
    wo: { href: WEG.datenschutz('ki'), label: 'Datenschutz › KI' },
  },
  {
    id: 'ich-handy', samstag: true, etappe: 1, nr: '1.10', ebene: 'ich', minuten: 5,
    modul: 'grundlage', nach: ['ich-zwei-faktor'],
    titel: 'Handy einrichten',
    warum: 'Am Handy liegt MAKE OS wie eine App da — schneller Zugriff auf Heute, Inbox und ZOE.',
    wie: [
      'Am iPhone in Safari: Teilen › „Zum Home-Bildschirm“.',
      'Optional ZOE das Mikrofon erlauben (Sprache) und unter Konto weitere Anmelde-Adressen hinterlegen.',
    ],
    danach: 'MAKE OS ist mit einem Tipp offen.',
    wo: KONTO,
  },
  // Zweite gleichwertige Inhaberin (R9, Update 2 am 16.10.): Rolle in der App, eigener Server-Zugang per eigenem SSH-Schlüssel.
  {
    id: 'weitere-inhaber', spaeter: true, etappe: 1, nr: '1.11', ebene: 'instanz', nurInhaber: true, nurMitMehreren: true, minuten: 10, pruefung: 'inhaber',
    modul: 'grundlage', nach: ['haushalt', 'ich-zwei-faktor'],
    titel: 'Zweite Person zur gleichwertigen Inhaberin machen',
    warum: 'Fällt ein Inhaber aus, muss jemand Konten, Haushalt, den zweiten Faktor, Datenschutz und Nachweise verwalten können. Inhaber heißt Verwaltung — Persönliches (Gesundheit, „nur ich“, private Notizen) bleibt bei jeder Person.',
    wie: [
      'Die zweite Person richtet zuerst ihren zweiten Faktor ein (Schritt 1.1) und ist dem Haushalt zugeordnet (Schritt 1.3).',
      'Konto › Inhaber: bei ihr „Zum Inhaber machen“, Rückfrage bestätigen, dann das eigene Passwort und den Code.',
      'Alle Inhaber bekommen eine Meldung; im Anmeldeprotokoll steht der Schritt. Zurück geht es mit „Rolle abgeben“ (die Person selbst).',
    ],
    danach: 'Beide Inhaber dürfen dasselbe. Der Haupt-Inhaber (das erste Konto) behält den Altbestand, die Systemläufe und den Haushalts-Kalender und gibt die Rolle nicht ab.',
    wo: { href: `${WEG.konto()}#inhaber`, label: 'Konto › Inhaber' },
  },
  {
    id: 'ssh-zweiter-schluessel', spaeter: true, etappe: 1, nr: '1.12', ebene: 'instanz', server: true, nurInhaber: true, nurMitMehreren: true, minuten: 15,
    modul: 'grundlage', nach: ['weitere-inhaber'],
    titel: 'Eigener Server-Zugang für die zweite Inhaberin',
    warum: 'Wer Inhaber ist, muss im Ernstfall auch an den Server kommen (Update, Sicherung, Schlüssel). Jede Person bekommt einen EIGENEN Schlüssel — nie einen geteilten: geht ein Gerät verloren, wird genau dieser herausgenommen.',
    wie: [
      'Die zweite Person erzeugt am eigenen Rechner einen Schlüssel (mit Passphrase) und gibt nur die öffentliche Zeile weiter (Datei id_ed25519.pub).',
      'Wer schon Zugang hat, trägt sie ein (Befehl unten) und fügt die Zeile ein, wenn gefragt — kein Doppel, der Ausroll-Schlüssel bleibt unberührt.',
      'Die zweite Person prüft von ihrem Rechner aus den Zugang (letzte Zeile). Wo die Schlüssel liegen, steht in der Notfallmappe (Schritt 0.12, NOTFALL.md).',
    ],
    befehl: 'ssh-keygen -t ed25519 -C "<vorname>-make-os"        # am Rechner der zweiten Person\nssh -t make@<SERVER> bash /srv/make-os/app/deploy/ssh-schluessel-hinzufuegen.sh\nssh make@<SERVER> bash /srv/make-os/app/deploy/ssh-schluessel-hinzufuegen.sh --liste\nssh make@<SERVER> \'sudo -n true && echo ok\'        # Probe der zweiten Person',
    danach: 'Beide kommen als Admin auf den Server; jeder Schlüssel lässt sich einzeln wieder herausnehmen (--entfernen).',
  },

  // ── Etappe 2 — Verbindungen ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ich-icloud', samstag: true, etappe: 2, nr: '2.1', ebene: 'ich', minuten: 10, pruefung: 'icloud',
    modul: 'kalender',
    titel: 'iCloud-Kalender verbinden (Privat)',
    warum: 'Damit deine Termine in MAKE OS stehen, Planen um sie herum plant und Blöcke aus Planen und ZOE auf deinem eigenen iPhone landen. Die andere Person sieht deine Termine nur als „Belegt“.',
    wie: [
      'Auf appleid.apple.com › Anmelden und Sicherheit › App-spezifische Passwörter ein Passwort anlegen. Nicht das normale Apple-Passwort.',
      'Kalender › Bereich Privat › Karte „iCloud Kalender“: Apple-ID und App-Passwort eintragen, Kalender wählen.',
      'Inhaber: zeigt die Prüfung „über die Server-Umgebung verbunden“, die Verbindung hier in der Oberfläche eintragen — der Eintrag ersetzt die Server-Einrichtung; danach die alten ICLOUD-Zeilen von Hand aus der .env nehmen.',
      'Wechselst du später dein Apple-Passwort, wird das App-Passwort ungültig — dann „Verbindung erneuern“.',
    ],
    danach: 'Verbunden und gesund: Apple nimmt das App-Passwort an.',
    wo: { href: '/os/kalender?space=privat', label: 'Kalender › Privat' },
  },
  {
    id: 'ich-google', samstag: true, etappe: 2, nr: '2.2', ebene: 'ich', minuten: 5, pruefung: 'google',
    modul: 'kalender', nach: ['google-app'],
    titel: 'Google-Kalender verbinden (Business)',
    warum: 'Business-Termine liegen im Google-Kalender deines Firmenkontos — in beide Richtungen: was du hier anlegst, steht dort, und umgekehrt.',
    wie: [
      'Kalender › Bereich Business › „verbinden“ und bei Google anmelden.',
      'Optional: alte Business-Termine aus iCloud nach Vorschau zu Google umziehen (etwa 15 Minuten).',
    ],
    danach: 'Verbunden und gesund: Google hat die Kalender-Freigabe erteilt und die Verbindung ist nicht getrennt.',
    wo: { href: '/os/kalender?space=business', label: 'Kalender › Business' },
  },
  {
    id: 'ich-gmail', samstag: true, etappe: 2, nr: '2.3', ebene: 'ich', minuten: 5, pruefung: 'gmail',
    modul: 'postfach', nach: ['google-app'],
    titel: 'Gmail verbinden',
    warum: 'Dein Firmen-Postfach erscheint in der Inbox — lesen, zuordnen, antworten per Klick. Nur du liest es; der Dienstweg und ZOE senden nie selbst.',
    wie: ['Inbox › Postfächer › „Gmail verbinden“ — die Google-Verbindung wird um Gmail ergänzt.'],
    danach: 'Verbunden und gesund: die Gmail-Freigabe ist da und Google nimmt die Anmeldung an.',
    wo: { href: '/os/inbox?postfaecher=1', label: 'Inbox › Postfächer' },
  },
  {
    id: 'ich-postfaecher', samstag: true, etappe: 2, nr: '2.4', ebene: 'ich', minuten: 15, pruefung: 'postfach',
    modul: 'postfach', nach: ['ich-gmail'],
    titel: 'Weitere Postfächer und ihr Bereich',
    warum: 'Die Inbox ist der tägliche Einstieg. Jedes Postfach gehört genau einer Person und genau einem Bereich (Privat oder eine Gesellschaft) — auch Gmail.',
    wie: [
      'Inbox › Postfächer: weitere Postfächer verbinden (z. B. iCloud-Mail mit App-Passwort für Privates, das bisherige Postfach bis zum Umzug).',
      'Jedem Postfach einen Bereich geben, auch dem Gmail-Postfach.',
      'Danach neue Absender zulassen oder blocken.',
    ],
    danach: 'Die Inbox zeigt jedes Postfach im passenden Bereich.',
    wo: { href: '/os/inbox?postfaecher=1', label: 'Inbox › Postfächer' },
  },
  {
    id: 'kalender-zuordnen', samstag: true, etappe: 2, nr: '2.5', ebene: 'gemeinsam', minuten: 20,
    modul: 'kalender', nach: ['ich-icloud', 'ich-google'],
    titel: 'Kalender zuordnen',
    warum: 'MAKE OS muss wissen, welcher Kalender wem gehört, welcher gemeinsam ist und was als belegt zählt — sonst plant es in eure Termine hinein.',
    wie: [
      'Kalender je Person und „Gemeinsam“ zuordnen; in den gemeinsamen spiegeln Paar-Gespräch, Dates und Events.',
      'Je Kalender Privat oder Business festlegen.',
      '„Zählt als belegt“, freie Tage, Arbeitsfenster, Standarddauern und Vorlauf für Kündigungsfristen prüfen.',
      'Den gemeinsamen Kalender in Apple miteinander teilen.',
    ],
    danach: 'Freie Zeiten, Kapazität und ZOE rechnen mit den richtigen Kalendern.',
    wo: { href: '/os/kalender?einstellungen=1', label: 'Kalender › Einstellungen' },
  },
  {
    id: 'ich-woanders', samstag: true, etappe: 2, nr: '2.6', ebene: 'ich', optional: true, minuten: 20,
    modul: 'kalender', nach: ['kalender-zuordnen'], datenOrt: ['arbeitszeit-aussen'],
    titel: 'Zeit, die woanders belegt ist',
    warum: 'Arbeitest du auch in einem Kalender, den MAKE OS noch nicht anbinden kann (z. B. Microsoft 365 eines Arbeitgebers oder Kunden), gilt diese Zeit sonst als frei — in Kapazität, freier Zeit und bei ZOE.',
    wie: [
      'Übergang: diese Zeit als feste Blöcke bzw. Abwesenheit in die Wochenvorlage (Planung › Routinen).',
      'Oder eine Frei/Gebucht-Freigabe in einen verbundenen Kalender — den Weg vorher prüfen.',
    ],
    danach: 'Kapazität und freie Zeit stimmen auch an Tagen mit fremden Terminen.',
    wo: { href: WEG.routinen(), label: 'Planung › Routinen' },
  },
  {
    id: 'ich-whoop', samstag: true, etappe: 2, nr: '2.7', ebene: 'ich', optional: true, minuten: 3, pruefung: 'whoop',
    modul: 'gesundheit', nach: ['whoop-app', 'ich-gesundheit'],
    titel: 'WHOOP verbinden',
    warum: 'Mit WHOOP kommen Erholung, Schlaf und Training von selbst in Gesundheit und Sport — ohne Abtippen. Jede Person verbindet nur ihr eigenes Konto; andere sehen die Werte nur, wenn du Gesundheit mit ihnen teilst.',
    wie: [
      'Vorher die Gesundheits-Einwilligung (a) erklären (Schritt 1.8) — ohne sie holt MAKE OS nichts ab.',
      'Gesundheit › Karte „WHOOP“ › Verbinden. Zeigt die Karte „neu verbinden“, neu verbinden (ein alter Zugang hat keine Workouts).',
      'Beim ersten Mal kommen die letzten 90 Tage; danach meldet WHOOP neue Werte von selbst. Eigene Einträge überschreibt WHOOP nie.',
    ],
    danach: 'Verbunden und gesund: nicht getrennt, alle nötigen Rechte erteilt.',
    wo: { href: '/os/gesundheit#whoop', label: 'Gesundheit › WHOOP' },
  },
  {
    id: 'mail-umzug', spaeter: true, etappe: 2, nr: '2.8', ebene: 'instanz', nurInhaber: true, minuten: 90,
    modul: 'postfach', nach: ['ich-gmail'],
    titel: 'Mail-Domain umziehen (eigener Termin)',
    warum: 'Wenn die Post der Firma künftig über Google läuft, muss der Umzug in der richtigen Reihenfolge passieren — sonst gehen Mails verloren.',
    wie: [
      'Reihenfolge: gemeinsame Adressen als Gruppe, „Senden als“, Testmail, SPF/DKIM/DMARC — die MX-Einträge ganz zuletzt.',
      'Alte Mails optional mitnehmen.',
      'Den bisherigen Anbieter mindestens vier Wochen weiterlaufen lassen.',
      'Anleitung: GOOGLE_GMAIL_EINRICHTEN.md, Teil D. An einem Werktag-Vormittag nach dem Gmail-Test.',
    ],
    danach: 'Neue Post kommt bei Google an; die Inbox zeigt sie über die Gmail-Verbindung.',
  },
  {
    id: 'whatsapp', spaeter: true, etappe: 2, nr: '2.9', ebene: 'instanz', nurInhaber: true, minuten: 90,
    modul: 'postfach', nach: ['datenschutz'], wartetAuf: 'die Verifizierung bei Meta (dauert Tage)',
    titel: 'WhatsApp Business (eigener Termin)',
    warum: 'Die Business-Nummer der Instanz erscheint in der Inbox. Die Verifizierung bei Meta dauert Tage — deshalb früh anstoßen, sobald der Weg entschieden ist.',
    wie: [
      'Den Weg für ZOE über WhatsApp vorher gemeinsam entscheiden.',
      'Anleitung in UPDATES.md, Abschnitt „WhatsApp Business“; Zugangsdaten über das Skript am Server (fragt verdeckt).',
    ],
    danach: 'System › Verbindungen zeigt den Zustand der Nummer; der Head of IT meldet Probleme.',
    befehl: 'ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/whatsapp-verbinden.sh',
    wo: { href: WEG.verbindungen(), label: 'Einstellungen › Verbindungen' },
  },

  // ── Etappe 3 — Firmen & Zahlen ──────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'stichtag', stichtag: true, samstag: true, etappe: 3, nr: '3.1', ebene: 'gemeinsam', minuten: 10,
    modul: 'finanzen',
    titel: 'Stichtag des 0-Punkts: 01.10.2026',
    warum: 'Ab dem Stichtag rechnet jede Business-Gesellschaft neu. Eure Entscheidung vom 08.10.: der 01.10.2026 für jede Business-Gesellschaft — derselbe Tag, an dem die Finanzplanung beginnt.',
    wie: [
      'Januar bis September bleiben gespeichert und sichtbar („vor dem 0-Punkt“), zählen aber nicht mehr: Rechnungen, Zahlungen, Planposten, Buchungen und Monatsabschlüsse davor. Nichts davon wird nachgetragen.',
      'Ein Kontostand mit Datum genau am 01.10. zählt nicht — dort gilt der 0-Punkt. Neue Kontostände tragen ein Datum ab dem 02.10.',
      'Weil Stichtag und Planbeginn zusammenfallen, braucht die Finanzplanung keinen Handwert für den ersten Planmonat.',
    ],
    danach: 'Abhaken, wenn beide den Stichtag kennen; Schritt 3.6 trägt ihn je Gesellschaft ein.',
    allgemein: {
      titel: 'Stichtag des 0-Punkts festlegen',
      warum: 'Ab dem Stichtag rechnet jede Business-Gesellschaft neu. Am einfachsten ist der Erste eines Monats — am besten derselbe Tag, an dem die Finanzplanung beginnt.',
      wie: [
        'Alles davor bleibt gespeichert und sichtbar („vor dem 0-Punkt“), zählt aber nicht mehr: Rechnungen, Zahlungen, Planposten, Buchungen und Monatsabschlüsse davor. Nichts davon wird nachgetragen.',
        'Ein Kontostand mit Datum genau am Stichtag zählt nicht — dort gilt der 0-Punkt. Neue Kontostände tragen ein Datum nach dem Stichtag.',
        'Fallen Stichtag und Planbeginn zusammen, braucht die Finanzplanung keinen Handwert für den ersten Planmonat.',
      ],
      danach: 'Abhaken, wenn alle den Stichtag kennen; Schritt 3.6 trägt ihn je Gesellschaft ein.',
    },
  },
  {
    id: 'steckbrief', samstag: true, etappe: 3, nr: '3.2', ebene: 'gemeinsam', nurInhaber: true, minuten: 35,
    modul: 'unternehmen', nach: ['haushalt'], datenOrt: ['firmendaten'],
    titel: 'Steckbrief je Gesellschaft',
    warum: 'Rechtsform, Rolle und Geschäftsjahr steuern, wie MAKE OS rechnet — die Rolle „Holding“ etwa bestimmt die Holding-Sicht im Business-Index.',
    wie: [
      'Unternehmen: je Gesellschaft Rechtsform, Status, Rolle operativ/holding, Sitz, Gründung, Stammkapital, Geschäftsjahr.',
      'Optional: Gründungs- bzw. Umbenennungsfahrplan per Klick, solange eine Eintragung läuft.',
    ],
    danach: 'Index und Finanzen kennen eure Gesellschaften richtig.',
    wo: { href: WEG.unternehmen(), label: 'Business › Unternehmen' },
  },
  {
    id: 'register', spaeter: true, etappe: 3, nr: '3.3', ebene: 'gemeinsam', nurInhaber: true, minuten: 50,
    modul: 'unternehmen', nach: ['steckbrief'], datenOrt: ['beteiligungen', 'vertraege'],
    titel: 'Gesellschafter, Organe, Beschlüsse, Beteiligungen, Verträge',
    warum: 'Wer hält was, wer führt, was wurde beschlossen — und welche Verträge laufen. Verträge mit „kündigen bis“ erinnern rechtzeitig.',
    wie: [
      'Je Gesellschaft: Gesellschafter (die Nennbeträge ergeben das Stammkapital), Organe (je Kapitalgesellschaft eine Geschäftsführung), Beschlüsse.',
      'Beteiligungen an fremden Firmen und laufende Verträge samt Unterlagen.',
      'Verträge mit „kündigen bis“ erzeugen eine Erinnerung (Vorgabe 30 Tage vorher) und einen Kalendereintrag.',
    ],
    danach: 'Fristen erscheinen im Kalender und in der Glocke.',
    wo: { href: WEG.unternehmen(), label: 'Business › Unternehmen' },
  },
  {
    id: 'absender', samstag: true, etappe: 3, nr: '3.4', ebene: 'gemeinsam', nurInhaber: true, minuten: 20,
    modul: 'unternehmen', nach: ['steckbrief'], datenOrt: ['firmendaten'],
    titel: 'Absender für Angebote',
    warum: 'Ohne vollständige Pflichtangaben kann MAKE OS kein sauberes Angebot erzeugen.',
    wie: ['Je Gesellschaft (Reiter „Absender“): Firmierung, Anschrift, Steuernummer, USt-ID, Register, Geschäftsführung, Bank, Logo, Nummernkürzel.'],
    danach: 'Angebote tragen die richtigen Angaben und fortlaufende Nummern.',
    wo: { href: WEG.unternehmen(), label: 'Business › Unternehmen' },
  },
  {
    id: 'eroeffnung', stichtag: true, samstag: true, etappe: 3, nr: '3.6', ebene: 'gemeinsam', nurInhaber: true, minuten: 30, pruefung: 'eroeffnung',
    modul: 'finanzen', nach: ['stichtag', 'steckbrief'], datenOrt: ['konto-stichtag', 'posten-stichtag'],
    titel: '0-Punkt je Business-Gesellschaft',
    warum: `Ab dem 0-Punkt rechnet jede Business-Gesellschaft${BUSINESS} mit sauberen Zahlen: Kontostand am Stichtag plus alles, was dann offen war.`,
    wie: [
      'Finanzen › Business › 0-Punkt: Stichtag 01.10.2026 (Schritt 3.1) und der Kontostand an diesem Tag.',
      'Alle zum Stichtag offenen Forderungen und Verbindlichkeiten eintragen — je Posten mit Fälligkeit, auch Rechnungen aus der Liste mit Datum vor dem Stichtag (die werden archiviert).',
      'Ein Eröffnungs-Posten, der später bezahlt wird, geht heute nur über eine neue Fassung des 0-Punkts raus.',
    ],
    allgemein: { wie: [
      'Finanzen › Business › 0-Punkt: den Stichtag (Schritt 3.1) und den Kontostand an diesem Tag.',
      'Alle zum Stichtag offenen Forderungen und Verbindlichkeiten eintragen — je Posten mit Fälligkeit, auch Rechnungen aus der Liste mit Datum vor dem Stichtag (die werden archiviert).',
      'Ein Eröffnungs-Posten, der später bezahlt wird, geht heute nur über eine neue Fassung des 0-Punkts raus.',
    ] },
    danach: 'Älteres bleibt sichtbar („vor dem 0-Punkt“), zählt aber nicht mehr.',
    wo: { href: WEG.eroeffnung(), label: 'Finanzen › Business › 0-Punkt' },
  },
  {
    id: 'monatsabschluss', stichtag: true, samstag: true, etappe: 3, nr: '3.7', ebene: 'gemeinsam', minuten: 5, pruefung: 'monatsabschluss',
    modul: 'finanzen', nach: ['eroeffnung'], datenOrt: ['monatszahlen'], wartetAuf: 'das Ende des ersten Monats ab dem Stichtag',
    titel: 'Monatsabschlüsse ab Oktober',
    warum: 'Controlling und Business-Index rechnen mit den Monatszahlen. Mit dem Stichtag 01.10. zählen erst die Monate ab Oktober — Januar bis September werden nicht nachgetragen.',
    wie: [
      'Der erste Abschluss ist der Oktober — Anfang November, je Business-Gesellschaft, von Hand über das Formular.',
      'Am Samstag nur den Termin für den ersten Abschluss festlegen (etwa 30 Minuten Anfang November) und abhaken. Danach jeden Monat den Vormonat.',
    ],
    allgemein: {
      titel: 'Monatsabschlüsse ab dem Stichtag',
      warum: 'Controlling und Business-Index rechnen mit den Monatszahlen. Ab dem Stichtag zählen erst die Monate danach — ältere werden nicht nachgetragen.',
      wie: [
        'Der erste Abschluss ist der erste volle Monat ab dem Stichtag — kurz nach dessen Ende, je Business-Gesellschaft, von Hand über das Formular.',
        'Beim Einrichten nur den Termin für den ersten Abschluss festlegen (etwa 30 Minuten) und abhaken. Danach jeden Monat den Vormonat.',
      ],
    },
    danach: 'Geprüft wird ab dem ersten fälligen Monat, ob der Abschluss des Vormonats je Business-Gesellschaft vorliegt. Bis dahin zählt dein Häkchen (Termin festgelegt).',
    wo: { href: WEG.abschluss(), label: 'Finanzen › Business › Monatsabschluss' },
  },
  {
    id: 'kontostaende', stichtag: true, samstag: true, etappe: 3, nr: '3.8a', ebene: 'gemeinsam', minuten: 15, pruefung: 'konten',
    modul: 'finanzen', nach: ['eroeffnung'], datenOrt: ['konto-danach'],
    titel: 'Kontostände nach dem Stichtag',
    warum: 'Die Liquiditäts-Vorschau startet beim aktuellen Kontostand. Ist der älter als eine Woche, ist die ganze Kurve unsicher.',
    wie: [
      'Liquidität › Kontostände: für jede Business-Gesellschaft den aktuellen Stand mit Datum eintragen.',
      'Das Datum muss nach dem Stichtag liegen (ab 02.10.) — sonst gilt der 0-Punkt.',
      'Bis zur Bank-Anbindung (Phase 1) von Hand, etwa einmal die Woche.',
    ],
    allgemein: { wie: [
      'Liquidität › Kontostände: für jede Business-Gesellschaft den aktuellen Stand mit Datum eintragen.',
      'Das Datum muss nach dem Stichtag liegen — sonst gilt der 0-Punkt.',
      'Bis zur Bank-Anbindung von Hand, etwa einmal die Woche.',
    ] },
    danach: 'Geprüft wird, ob jedes Geschäftskonto einen Stand hat, der höchstens sieben Tage alt ist (der 0-Punkt zählt mit).',
    wo: { href: WEG.kontostaende(), label: 'Finanzen › Liquidität' },
  },
  {
    id: 'offene-posten', stichtag: true, samstag: true, etappe: 3, nr: '3.8b', ebene: 'gemeinsam', minuten: 15, pruefung: 'posten',
    modul: 'finanzen', nach: ['eroeffnung'], datenOrt: ['posten-danach'],
    titel: 'Offene Rechnungen und Zahlungen',
    warum: 'Das ist die Prioritätenliste: was zuerst raus muss, was noch reinkommt.',
    wie: [
      'Gestellte Rechnungen prüfen — was eingegangen ist, auf „bezahlt“ setzen.',
      'Offene Zahlungen mit Fälligkeit versehen.',
      'Datum nach dem Stichtag (ab 02.10.), sonst gilt der 0-Punkt — Offenes vom Stichtag steht im 0-Punkt (3.6) und wird DORT gepflegt: Fälligkeit nachtragen bzw. bezahlt über eine neue Fassung.',
    ],
    allgemein: { wie: [
      'Gestellte Rechnungen prüfen — was eingegangen ist, auf „bezahlt“ setzen.',
      'Offene Zahlungen mit Fälligkeit versehen.',
      'Datum nach dem Stichtag, sonst gilt der 0-Punkt — Offenes vom Stichtag steht im 0-Punkt (3.6) und wird DORT gepflegt: Fälligkeit nachtragen bzw. bezahlt über eine neue Fassung.',
    ] },
    danach: 'Geprüft wird: keine überfällige gestellte Rechnung, keine offene Zahlung ohne Fälligkeit — Posten aus dem 0-Punkt werden eigens ausgewiesen.',
    wo: { href: WEG.rechnungen(), label: 'Finanzen › Rechnungen & Zahlungen' },
  },
  {
    id: 'business-grundlagen', spaeter: true, etappe: 3, nr: '3.9', ebene: 'gemeinsam', nurInhaber: true, minuten: 15, pruefung: 'business-einstellungen',
    modul: 'finanzen', nach: ['steckbrief'], datenOrt: ['koepfe'],
    titel: 'Grundlagen des Business-Index',
    warum: 'Ohne Köpfe, Beratertage und Jahresziel bleiben Personal und Auslastung im Index „keine Daten“.',
    wie: [
      'Business › Feinjustierung: Köpfe (FTE), verfügbare Beratertage je Monat, Jahresziel je Gesellschaft (dieselbe Zahl wie in Planung › Jahr, Schritt 5.1).',
      'Bei Bedarf eigene Schwellen.',
    ],
    danach: 'Geprüft wird: Köpfe und Jahresziel je Business-Gesellschaft gesetzt. Dann rechnet der Index alle Säulen.',
    wo: { href: WEG.einstellungen(), label: 'Finanzen › Business › Einstellungen' },
  },
  {
    id: 'ich-privatkonten', privatFinanzen: true, spaeter: true, etappe: 3, nr: '3.10', ebene: 'ich', minuten: 45, pruefung: 'konten-register',
    modul: 'finanzen', nach: ['haushalt'], datenOrt: ['konto-privat'],
    titel: 'Privatkonten und Kontoauszüge',
    warum: 'Die Haushaltsfinanzen rechnen mit euren Buchungen. Jede Person trägt ihre Konten ein, gemeinsame nur einmal. (Gilt nur für Konten mit Zugang zu den Privat-Finanzen.)',
    wie: [
      'Privat › Konten & Buchungen: eigene Konten mit Inhaber anlegen, gemeinsame einmal. In der Karte „Konten“ den Stand mit Datum eintragen (bisherige Stände vorher einmal übernehmen).',
      'Kontoauszüge einlesen und die Kontrollsumme prüfen. Den Zeitraum gemeinsam festlegen.',
      'Bis zur Bank-Anbindung (vorgezogen in Phase 1) ist das der monatliche Weg.',
    ],
    danach: 'Geprüft wird im Konten-Register: jedes deiner Konten und jedes gemeinsame mit einem Stand, der höchstens 31 Tage alt ist.',
    wo: { href: WEG.privat('buchungen'), label: 'Finanzen › Privat › Konten & Buchungen' },
  },
  {
    id: 'privat-fixkosten', privatFinanzen: true, spaeter: true, etappe: 3, nr: '3.11', ebene: 'gemeinsam', minuten: 35, pruefung: 'haushalt-fixkosten',
    modul: 'finanzen', nach: ['ich-privatkonten'], datenOrt: ['privat-ist', 'ruecklage'],
    titel: 'Fixkosten, Budget, Schulden und Rücklage (Privat)',
    warum: 'Damit der Privat-Index ehrlich rechnet: Fixkosten mit Rhythmus, Schulden mit Rate, ein Ziel für die Rücklage. Eure Entscheidung vom 08.10.: der Haushalt führt das Ist, die Finanzplanung liest daraus. (Nur für Konten mit Zugang zu den Privat-Finanzen.)',
    allgemein: { warum: 'Damit der Privat-Index ehrlich rechnet: Fixkosten mit Rhythmus, Schulden mit Rate, ein Ziel für die Rücklage. Der Haushalt führt das Ist, die Finanzplanung liest daraus. (Nur für Konten mit Zugang zu den Privat-Finanzen.)' },
    wie: [
      'Fixkosten durchgehen, bis keine mehr „Rhythmus unklar“ hat.',
      'Budget, Schulden und Fixkosten im Haushalt pflegen (Privat › Konten & Buchungen) — nicht zusätzlich in der Finanzplanung. Die Brücke, über die die Finanzplanung daraus liest, kommt in Phase 1.',
      'Das Rücklage-Ziel im Privat-Index setzen.',
    ],
    danach: 'Geprüft wird: Buchungen da, keine Fixkosten mit „Rhythmus unklar“, jede offene Schuld mit Rate, eine Rücklage gesetzt.',
    wo: { href: WEG.privat('fixkosten'), label: 'Finanzen › Privat › Fixkosten' },
  },

  // ── Etappe 4 — Kontakte, Vertrieb & Mandate ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'team', spaeter: true, etappe: 4, nr: '4.1', ebene: 'gemeinsam', minuten: 10,
    modul: 'grundlage', nach: ['haushalt'],
    titel: 'Team und Zuständigkeiten',
    warum: 'Wer kümmert sich um Vertrieb, Marketing und Events, wer um Haushaltsfinanzen, wer begleitet Gesundheit — daran hängen Vorschläge und Power Hour.',
    wie: ['Konto › Team: je Person die Rolle eintragen.'],
    danach: 'Vorschläge und Aufgaben gehen an die zuständige Person.',
    wo: KONTO,
  },
  {
    id: 'kartei', bestaetigen: true, samstag: true, etappe: 4, nr: '4.2', ebene: 'gemeinsam', nurInhaber: true, minuten: 50, pruefung: 'kontakte',
    modul: 'markttraktion', nach: ['datenschutz'],
    titel: 'Kartei importieren und bereinigen',
    warum: 'Power Hour, Pipeline und Index rechnen mit der Kartei. Herkunft, Rechtsgrundlage und Zuständigkeit müssen stimmen, sonst schlägt das System die Falschen vor.',
    wie: [
      'Markttraktion › Zahnrad (Stammdaten): Import mit Vorschau, Konflikte entscheiden, Dubletten und Firmen zusammenführen.',
      'Herkunft und Rechtsgrundlage übernehmen; bei den wichtigsten Menschen Kreis A oder B setzen.',
      '„Zuständig“ je wichtigem Kontakt setzen — sonst landet die Power Hour bei einer Person.',
      'Für Kontakte aus fremden Quellen läuft ab dem Import die Ein-Monats-Frist für die Information nach Art. 14.',
    ],
    danach: 'Die Prüfung zeigt nur „Kontakte da, keine offenen Import-Konflikte“ — abhaken erst, wenn auch Herkunft, Kreis und Zuständig stehen.',
    wo: { href: WEG.stammdaten(), label: 'Markttraktion › Stammdaten' },
  },
  {
    id: 'produkte', spaeter: true, etappe: 4, nr: '4.3', ebene: 'gemeinsam', minuten: 30, pruefung: 'produkte',
    modul: 'markttraktion', nach: ['steckbrief'], datenOrt: ['produkte'],
    titel: 'Produkte',
    warum: 'Produkte sind die eine Quelle für Angebote, Mandate und die Umsatz-Bausteine der Finanzplanung.',
    wie: [
      'Mandate & Unternehmen › Produkte: Preis, Basis, Laufzeit, Gesellschaft und Leistungstext (ohne Leistungstext kein „aktiv“).',
      'Die alte Karte „Produkte“ unter Rechnungen nicht mehr pflegen.',
    ],
    danach: 'Geprüft wird: mindestens ein aktives Produkt mit Leistungstext. Angebote und Finanzplan greifen auf denselben Katalog zu.',
    wo: { href: WEG.produkt(), label: 'Mandate & Unternehmen › Produkte' },
  },
  {
    id: 'mandate', spaeter: true, etappe: 4, nr: '4.4', ebene: 'gemeinsam', nurInhaber: true, minuten: 30, pruefung: 'mandate',
    modul: 'markttraktion', nach: ['kartei', 'produkte'],
    titel: 'Laufende Mandate',
    warum: 'Mandate sind Umsatz, Zeit und Kapazität. Ohne sie fehlen Index, Liquidität und Planung die wichtigste Größe.',
    wie: ['Je laufendem Mandat: Firma (aus der Kartei), Produkt, Honorar, Rhythmus, Gesellschaft, Zahlungsziel, Zuständigkeit.'],
    danach: 'Geprüft wird: jedes laufende Mandat mit Firma aus der Kartei, Honorar und Gesellschaft. Ohne laufendes Mandat zählt dein Häkchen.',
    wo: { href: WEG.mandat(), label: 'Mandate & Unternehmen › Mandate' },
  },
  {
    id: 'deals', spaeter: true, etappe: 4, nr: '4.5', ebene: 'gemeinsam', nurInhaber: true, minuten: 20,
    modul: 'markttraktion', nach: ['kartei'],
    titel: 'Offene Deals',
    warum: 'Die Pipeline zeigt, was kommt — aber nur, wenn jeder Deal einen nächsten Schritt mit Datum hat.',
    wie: ['Markttraktion › Deals: jeden offenen Deal mit Stufe, Wert und nächstem Schritt samt Datum.'],
    danach: 'Follow-up und Head of Sales arbeiten mit echten Deals.',
    wo: { href: WEG.deals(), label: 'Markttraktion › Deals' },
  },
  {
    id: 'vertrieb', spaeter: true, etappe: 4, nr: '4.6', ebene: 'gemeinsam', minuten: 30,
    modul: 'markttraktion', nach: ['team'],
    titel: 'Grundlagen des Vertriebs',
    warum: 'Positionierung, Wertelisten und Wochenziele machen Vorschläge, Texte und das Scoreboard erst passend.',
    wie: [
      'Marketing › Positionierung: Zielgruppe, Nutzen, Ton.',
      'Zahnrad › Wertelisten: Verlustgründe, Kadenz je Kreis.',
      'Überblick: Wochenziele im Scoreboard je Person. Den Scoring-Standard lassen oder anpassen.',
    ],
    danach: 'Die Heads schlagen in eurer Sprache vor.',
    wo: { href: WEG.marketing('positionierung'), label: 'Markttraktion › Marketing' },
  },
  {
    id: 'ich-visitenkarte', spaeter: true, etappe: 4, nr: '4.7', ebene: 'ich', optional: true, minuten: 10,
    modul: 'markttraktion',
    titel: 'Eigene Visitenkarte',
    warum: 'Auf Veranstaltungen zeigst du deine Karte als QR-Code — wer sie scannt, hat deine Kontaktdaten.',
    wie: ['Netzwerken › Meine Karte: Profil anlegen, Design wählen.'],
    danach: 'Deine Karte ist unterwegs mit einem Tipp da.',
    wo: { href: WEG.netzwerkenKarte(), label: 'Netzwerken › Meine Visitenkarten' },
  },
  {
    id: 'ich-buchungsseite', spaeter: true, etappe: 4, nr: '4.8', ebene: 'ich', optional: true, minuten: 15,
    modul: 'kalender', nach: ['datenschutz', 'kalender-zuordnen', 'ich-arbeitsrahmen'],
    titel: 'Buchungsseite für Erstgespräche',
    warum: 'Interessenten buchen selbst einen freien Termin bei dir. Braucht den Verantwortlichen (1.5), einen frischen Kalender und deine Wochenvorlage (5.7).',
    wie: ['Kalender › Buchungsseiten: Seite anlegen, Fenster und Dauer festlegen, Link kopieren.'],
    danach: 'Anfragen kommen in die Glocke; freigeben musst du immer selbst.',
    wo: { href: '/os/kalender?buchungen=1', label: 'Kalender › Buchungsseiten' },
  },

  // ── Etappe 5 — Planung & Finanzplan ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'jahresziele', samstag: true, etappe: 5, nr: '5.1', ebene: 'gemeinsam', minuten: 30, pruefung: 'ziele',
    modul: 'planung', nach: ['altbestand'], datenOrt: ['jahresziel'],
    titel: 'Nordstern und Jahresziele',
    warum: 'Die Jahresziele sind die Messlatte für alles darunter — Quartal, Monat, Woche und die Indizes rechnen daraus.',
    wie: [
      'Planung › Jahr: je Bereich die Jahresziele des laufenden Jahres, möglichst mit Zahl.',
      'Den Nordstern erst bearbeiten, wenn 0.5 „übernommen“ meldet — sonst entsteht eine zweite Fassung neben der übernommenen.',
    ],
    allgemein: { wie: [
      'Planung › Jahr: je Bereich die gemeinsamen Jahresziele des laufenden Jahres, möglichst mit Zahl.',
      'Darüber in der Karte „Nordstern“ euren gemeinsamen Satz — eure eigenen Ziele trägt jede Person für sich ein.',
    ] },
    danach: 'Geprüft wird, ob es Jahresziele für das laufende Jahr gibt (aus der Planung, nicht aus einer Vorgabe).',
    wo: { href: WEG.jahr(), label: 'Planung › Jahr' },
  },
  {
    id: 'zahlenziele', stichtag: true, spaeter: true, etappe: 5, nr: '5.2', ebene: 'gemeinsam', nurInhaber: true, minuten: 10,
    modul: 'finanzen', nach: ['jahresziele', 'business-grundlagen'], datenOrt: ['jahresziel'],
    titel: 'Zahlenziele gleichziehen',
    warum: 'Das Umsatzziel steht heute noch an mehreren Stellen. Bis es eine Quelle gibt, überall dieselbe Zahl — sonst widersprechen sich Controlling und Index.',
    wie: [
      'Controlling & Ziele: Jahresziel, Startmonat, Runway-Schwelle — bewusst speichern.',
      'Das Jahresziel je Gesellschaft (3.9) auf dieselbe Zahl wie in Planung › Jahr.',
    ],
    danach: 'Alle Auswertungen messen gegen dieselbe Zahl.',
    wo: { href: WEG.controlling(), label: 'Finanzen › Controlling & Ziele' },
  },
  {
    id: 'meilensteine-fokus', spaeter: true, etappe: 5, nr: '5.3', ebene: 'gemeinsam', minuten: 30, pruefung: 'fokus',
    modul: 'planung', nach: ['jahresziele'],
    titel: 'Meilensteine und Fokus',
    warum: 'Meilensteine mit Termin, Aufwand und Beteiligten machen die Kapazität sichtbar. Ein Fokus je Horizont sagt ZOE und Planen, was gerade wichtiger ist.',
    wie: [
      'Planung › Jahr: Meilensteine mit Termin, Aufwand und Beteiligten.',
      'Fokus: je Horizont (Jahr, Quartal, Monat, Woche) einen Satz — gemeinsam oder je Bereich.',
    ],
    danach: 'Geprüft wird, wie viele Horizonte einen Fokus haben (mindestens drei von vier).',
    wo: { href: '/os/fokus', label: 'Planung › Fokus' },
  },
  {
    id: 'finanzplan', privatFinanzen: true, samstag: true, etappe: 5, nr: '5.4', ebene: 'gemeinsam', minuten: 45, pruefung: 'finanzplan',
    modul: 'finanzen', nach: ['eroeffnung'],
    titel: 'Finanzplan anlegen',
    warum: 'Die Finanzplanung rechnet Runway, Steuern und Szenarien. Sie startet mit einem Dokument — hochgeladen oder leer begonnen. (Nur für Konten mit Zugang zu den Privat-Finanzen.)',
    wie: [
      'Finanzen › Privat › Planung: Dokument hochladen oder leer beginnen; Gehälter, Netto-Tabelle, Privatkonten, Darlehen.',
      'Die Kontostände der Gesellschaften kommen aus dem 0-Punkt (3.6). Stichtag und Planbeginn fallen zusammen (01.10.) — kein Handwert für den ersten Planmonat nötig.',
      'Budget, Schulden und Fixkosten nicht hier doppelt pflegen — der Haushalt führt das Ist (Datenkarte).',
    ],
    allgemein: { wie: [
      'Finanzen › Privat › Planung: Dokument hochladen oder leer beginnen; Gehälter, Netto-Tabelle, Privatkonten, Darlehen.',
      'Die Kontostände der Gesellschaften kommen aus dem 0-Punkt (3.6). Fallen Stichtag und Planbeginn zusammen, braucht der erste Planmonat keinen Handwert.',
      'Budget, Schulden und Fixkosten nicht hier doppelt pflegen — der Haushalt führt das Ist (Datenkarte).',
    ] },
    danach: 'Geprüft wird: das Dokument ist da und die Netto-Tabelle ist kein Platzhalter mehr. Runway und Szenarien rechnen mit euren Zahlen.',
    wo: { href: WEG.finanzplanung('privat'), label: 'Finanzen › Privat › Planung' },
  },
  {
    id: 'steuerprofil', spaeter: true, etappe: 5, nr: '5.4b', ebene: 'gemeinsam', nurInhaber: true, minuten: 25,
    modul: 'finanzen', nach: ['finanzplan', 'steckbrief'], datenOrt: ['steuerparameter'],
    titel: 'Steuerprofil',
    warum: `Fristen und Schätzungen rechnen mit Rechtsform, Hebesatz und Vorauszahlungen. Für die ${UG_NAME} rechnet das Steuer-Modul noch keine Fristen und keine Schätzung (es zeigt „nicht hinterlegt“). Hinweis, keine Steuerberatung.`,
    wie: [
      'Steuer-Modul: das Profil der Gesellschaften, für die es rechnet, setzen.',
      'Die Steuerparameter der Selbstständigkeit NUR in der Finanzplanung › Zahnrad (führend, siehe Datenkarte) — das Steuer-Modul liest sie dann von dort. Das geht erst, wenn der Finanzplan aus 5.4 steht.',
      'Optional den Schalter „Steuertermine im Kalender“ einschalten (Vorgabe aus).',
    ],
    danach: 'Steuertermine und Rücklagen stimmen.',
    wo: { href: WEG.steuern(), label: 'Finanzen › Steuern' },
  },
  {
    id: 'selbststaendigkeit', spaeter: true, etappe: 5, nr: '5.5', ebene: 'gemeinsam', nurInhaber: true, minuten: 30,
    modul: 'finanzen', nach: ['finanzplan'], datenOrt: ['selbst-jan-sep', 'est-voraus'],
    titel: 'Selbstständigkeit: Januar bis September',
    warum: 'Die Einkommensteuer rechnet über das ganze Jahr. Die Monate vor dem Planbeginn (01.10.) gehören deshalb in die Finanzplanung — als Summen, nicht als Monatsabschlüsse.',
    wie: [
      'Planung › Blatt „Selbstständigkeit“: Einnahmen, Ausgaben und Gehalt von Januar bis September.',
      'Die Vorauszahlungen zur Einkommensteuer NUR hier eintragen — die Steuer-Einstellungen zählen mit Finanzplanung nicht.',
    ],
    allgemein: {
      titel: 'Selbstständigkeit: Monate vor dem Planbeginn',
      warum: 'Die Einkommensteuer rechnet über das ganze Jahr. Die Monate des laufenden Jahres vor dem Planbeginn gehören deshalb in die Finanzplanung — als Summen, nicht als Monatsabschlüsse.',
      wie: [
        'Planung › Blatt „Selbstständigkeit“: Einnahmen, Ausgaben und Gehalt der Monate vor dem Planbeginn.',
        'Die Vorauszahlungen zur Einkommensteuer NUR hier eintragen — die Steuer-Einstellungen zählen mit Finanzplanung nicht.',
      ],
    },
    danach: 'Die Steuer des laufenden Jahres stimmt.',
    wo: { href: WEG.finanzplanung('privat', 'selbst'), label: 'Finanzen › Privat › Planung' },
  },
  {
    id: 'finanzplan-business', spaeter: true, etappe: 5, nr: '5.6', ebene: 'gemeinsam', nurInhaber: true, minuten: 30,
    modul: 'finanzen', nach: ['mandate', 'finanzplan'], datenOrt: ['kosten-business'],
    titel: 'Finanzplan Business',
    warum: 'Der Business-Teil der Planung rechnet aus Mandaten, Sachkosten und dem Arbeitsplan.',
    wie: ['Finanzen › Business › Planung: Bausteine aus den Mandaten übernehmen, Sachkosten, Arbeitsplan setzen, offene Vorschläge entscheiden.'],
    danach: 'Der Plan der Gesellschaften steht.',
    wo: { href: WEG.finanzplanung('business'), label: 'Finanzen › Business › Planung' },
  },
  {
    id: 'ich-arbeitsrahmen', spaeter: true, etappe: 5, nr: '5.7', ebene: 'ich', minuten: 20, pruefung: 'arbeitsrahmen',
    modul: 'planung', nach: ['kalender-zuordnen'], datenOrt: ['arbeitszeit', 'urlaub'],
    titel: 'Mein Arbeitsrahmen',
    warum: 'Ohne Eintrag rechnet MAKE OS mit 40 Stunden bzw. Mo–Fr 9–18 Uhr. Deine echte Arbeitszeit macht Kapazität und freie Zeit ehrlich.',
    wie: [
      'Planung › Routinen: die Wochenvorlage ist führend (Blöcke für Arbeit).',
      'Kapazität: Grundwert; Urlaub nur einmal als „Abwesend“ im Kalender.',
      'Arbeitszeit außerhalb (2.6) als Block.',
    ],
    danach: 'Geprüft wird: ein Grundwert in der Kapazität oder Arbeits-Blöcke in deiner Wochenvorlage. Dann stimmen Machbarkeit und freie Zeit für dich.',
    wo: { href: WEG.routinen(), label: 'Planung › Routinen' },
  },
  {
    id: 'mandate-kapazitaet', spaeter: true, etappe: 5, nr: '5.8', ebene: 'gemeinsam', nurInhaber: true, minuten: 10, pruefung: 'kapazitaet',
    modul: 'planung', nach: ['mandate', 'ich-arbeitsrahmen'],
    titel: 'Mandate je Person',
    warum: 'Mandate binden Stunden. Erst mit der Zuweisung sieht die Kapazität, was wirklich frei ist.',
    wie: ['Planung › Kapazität: je aktivem Mandat die gebundenen Stunden je Woche und Person.'],
    danach: 'Geprüft wird: jedes laufende Mandat hat eine Zuweisung. Ohne laufendes Mandat zählt dein Häkchen.',
    wo: { href: WEG.kapazitaet(), label: 'Planung › Kapazität' },
  },
  {
    id: 'ich-routinen', spaeter: true, etappe: 5, nr: '5.9', ebene: 'ich', minuten: 10, pruefung: 'routinen',
    modul: 'planung',
    titel: 'Eigene Routinen',
    warum: 'Was regelmäßig dran ist, steht dann auf Heute — abhakbar, ohne daran denken zu müssen.',
    wie: ['Planung › Routinen: mindestens eine eigene Routine mit Rhythmus anlegen.'],
    danach: 'Geprüft wird: mindestens eine aktive eigene Routine. Heute zeigt, was dran ist.',
    wo: { href: WEG.routinen(), label: 'Planung › Routinen' },
  },
  {
    id: 'rhythmen', spaeter: true, etappe: 5, nr: '5.10', ebene: 'gemeinsam', nurMitMehreren: true, minuten: 20,
    modul: 'planung', nach: ['kalender-zuordnen'],
    titel: 'Gemeinsame Rhythmen',
    warum: 'Zu zweit hält ein fester Takt alles zusammen: Finanzen-Check, Wochenstart, Rückblick, Paar-Gespräch.',
    wie: [
      'Aufgaben: Finanzen-Check als Serie mit Rotation über euch beide.',
      'Routinen: Wochenstart und Rückblick für beide.',
      'Familie › Rahmen: Paar-Gespräch mit Termin.',
    ],
    danach: 'Der gemeinsame Takt steht im Kalender und auf Heute.',
    wo: { href: WEG.routinen(), label: 'Planung › Routinen' },
  },
  {
    id: 'kompass', spaeter: true, etappe: 5, nr: '5.11', ebene: 'gemeinsam', minuten: 15, pruefung: 'kompass',
    modul: 'planung', nach: ['jahresziele'],
    titel: 'Kompass stellen',
    warum: 'Die Regler steuern, wie das System euch behandelt — wie hart es schützt, wie viel es zumutet, wann es Alarm schlägt. Er gilt vorerst für beide.',
    wie: ['Lage wählen, die Regler durchgehen und die Wirkung mitlesen.', 'Unten die Abweichungen ansehen: dort steht, wo der Alltag dem Kompass widerspricht.'],
    danach: 'ZOE und die Agenten richten sich nach dem Kompass.',
    wo: { href: '/os/kompass', label: 'Planung › Kompass' },
  },
  {
    id: 'projekte', spaeter: true, etappe: 5, nr: '5.12', ebene: 'gemeinsam', minuten: 30,
    modul: 'planung', nach: ['mandate'],
    titel: 'Projekte und Listen je Space',
    warum: 'Ordnung in den Aufgaben: je Gesellschaft, Privat und Mandant die Projekte, die gerade laufen.',
    wie: ['Aufgaben › Überblick › „+ Projekt“ — aus Vorlagen, mit Verantwortlichen.'],
    danach: 'Jede Aufgabe hat ihren Platz.',
    wo: { href: WEG.aufgaben(), label: 'Aufgaben' },
  },
  {
    id: 'ich-aufgaben', spaeter: true, etappe: 5, nr: '5.13', ebene: 'ich', minuten: 20, pruefung: 'aufgaben-ich',
    modul: 'planung', nach: ['projekte'],
    titel: 'Deine Aufgaben sichten',
    warum: 'Was auf dich zugewiesen ist, soll nicht in einer langen Liste untergehen.',
    wie: ['Aufgaben › Filter „Meine“.', 'Fälligkeiten setzen oder mit Kommentar zurückgeben; mit @Name holst du jemanden dazu.', 'Überfälliges neu datieren oder schließen.'],
    danach: 'Geprüft wird: nichts auf dich überfällig.',
    wo: { href: WEG.aufgaben(), label: 'Aufgaben' },
  },

  // ── Etappe 6 — Gesundheit & Familie ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ich-gesundheit-profil', samstag: true, etappe: 6, nr: '6.1', ebene: 'ich', minuten: 20,
    modul: 'gesundheit', nach: ['ich-gesundheit', 'altbestand'],
    titel: 'Gesundheit für dich einrichten',
    warum: 'Ernährungsprofil, Sport-Einstieg und Körper-Profil gehören nur dir. Niemand richtet das für eine andere Person ein.',
    wie: [
      'Gesundheit: Ernährungsprofil (Bedarf, Ziel, Unverträgliches).',
      'Sport: Einstieg und Ziele.',
      'Körper-Profil — beim Inhaber erst nach der Übernahme des Altbestands (0.5).',
    ],
    danach: 'Vorschläge und Indizes rechnen mit deinen Angaben.',
    wo: { href: '/os/gesundheit', label: 'Gesundheit' },
  },
  {
    id: 'ich-kopf-energie', samstag: true, etappe: 6, nr: '6.2', ebene: 'ich', optional: true, minuten: 5,
    modul: 'gesundheit', nach: ['ich-gesundheit'],
    titel: '„Kopf & Energie“ in der Kapazität',
    warum: 'Deine Erholung kann in die Kapazität einfließen — nur mit deiner eigenen Einwilligung und wenn du Gesundheit mit allen im Haushalt teilst. Vorgabe: aus.',
    wie: ['Planung › Kapazität: bei dir „Kopf & Energie“ einschalten oder bewusst aus lassen.'],
    danach: 'An erschöpften Tagen plant die Kapazität weniger ein.',
    wo: { href: WEG.kapazitaet(), label: 'Planung › Kapazität' },
  },
  {
    id: 'familie-rahmen', samstag: true, etappe: 6, nr: '6.3', ebene: 'gemeinsam', minuten: 15, pruefung: 'familie-rahmen', bestaetigen: true,
    modul: 'familie', nach: ['kalender-zuordnen'],
    titel: 'Familie › Rahmen',
    warum: 'Paar-Gespräch, Business-freie Zeiten und Ausnahmezeit geben dem Familienbereich seinen Takt.',
    wie: [
      'Paar-Gespräch: Wochentag und Uhrzeit — es landet im gemeinsamen Kalender.',
      'Business-freie Zeiten und, wenn nötig, eine Ausnahmezeit.',
    ],
    danach: 'Geprüft wird, ob das nächste Paar-Gespräch im gemeinsamen Kalender steht; Business-freie Zeiten und Ausnahmezeit bestätigt ihr mit dem Häkchen.',
    wo: { href: WEG.familie(), label: 'Familie' },
  },
  {
    id: 'familie-menschen', samstag: true, etappe: 6, nr: '6.4', ebene: 'gemeinsam', minuten: 15, pruefung: 'familie-menschen',
    modul: 'familie', datenOrt: ['geburtstage'],
    titel: 'Menschen und wichtige Tage',
    warum: 'Geburtstage und wichtige Tage erinnern rechtzeitig — private hier, die von Geschäftskontakten im CRM (siehe Datenkarte).',
    wie: ['Familie: die wichtigsten Menschen mit Geburtstag und die wichtigen Tage eintragen.'],
    danach: 'Geprüft wird, ob mindestens ein Mensch mit Geburtstag eingetragen ist. Die Glocke erinnert am Vortag; Heute zeigt die nächsten Anlässe.',
    wo: { href: WEG.familie(), label: 'Familie' },
  },

  // ── Etappe 7 — ZOE & Brain ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'agenten', spaeter: true, etappe: 7, nr: '7.1', ebene: 'gemeinsam', nurInhaber: true, minuten: 15, pruefung: 'agenten', bestaetigen: true,
    modul: 'zoe', nach: ['ki-instanz'],
    titel: 'Autonomie der Agenten',
    warum: 'Jeder Agent braucht eine Stufe: nur vorschlagen, nach Freigabe oder selbstständig. Was nach außen geht, braucht immer eine Freigabe.',
    wie: ['ZOE › Agenten: jeden Agenten durchgehen und die Stufe bewusst setzen.', 'Abschalten, was gerade nicht gebraucht wird.'],
    danach: 'Geprüft wird, ob mindestens ein Head eingestellt ist bzw. du schon mit einem Head arbeitest; dass alle durchgesehen sind, bestätigst du mit dem Häkchen.',
    wo: { href: WEG.agenten(), label: 'ZOE › Agenten' },
  },
  {
    id: 'ich-zoe', spaeter: true, etappe: 7, nr: '7.2', ebene: 'ich', minuten: 10, pruefung: 'zoe',
    modul: 'zoe', nach: ['ich-ki'],
    titel: 'ZOE kennenlernen',
    warum: 'Fragen statt suchen. ZOE kennt die Zahlen, Aufgaben und Termine, die du sehen darfst — und bereitet Arbeit vor. Entscheiden tust du.',
    wie: [
      'ZOE öffnen und fragen, z. B. „Was ist diese Woche fällig?“',
      'Alles, was etwas ändert oder nach außen geht, landet bei den Freigaben und passiert erst mit deinem Klick.',
      'Einmal das Protokoll ansehen.',
    ],
    danach: 'Dein Gesprächsverlauf gehört dir.',
    wo: { href: '/zoe', label: 'ZOE' },
  },
  {
    id: 'brain', spaeter: true, etappe: 7, nr: '7.3', ebene: 'gemeinsam', minuten: 45, pruefung: 'brain', bestaetigen: true,
    modul: 'zoe', nach: ['vault'],
    titel: 'Brain: Regeln und Kern-Notizen',
    warum: 'Regeln und Konstitution sind Anweisungen an ZOE — sie gelten erst, wenn eine Person sie freigibt. Kern-Notizen sagen ZOE, wer ihr seid.',
    wie: [
      'Brain: Regeln und Konstitution prüfen und freigeben, Kern-Notizen „Wer wir sind“ anlegen.',
      'App-Brücke (Privat nur als Zahlen oder voll) und die Zeit-Freigabe je Person festlegen.',
    ],
    danach: 'Geprüft wird: mindestens eine freigegebene Regel und die App-Brücke bewusst gesetzt; die Kern-Notizen bestätigt ihr mit dem Häkchen.',
    wo: { href: WEG.wissen(), label: 'Brain' },
  },
  {
    id: 'uebergabe-probe', spaeter: true, etappe: 7, nr: '7.4', ebene: 'gemeinsam', nurMitMehreren: true, minuten: 10,
    modul: 'planung', nach: ['haushalt'],
    titel: 'Probelauf: Übergabe',
    warum: 'Einmal ausprobieren, wie Arbeit zwischen euch wandert — bevor es darauf ankommt.',
    wie: ['Auf Heute eine Aufgabe mit @Name an die andere Person anlegen.', 'Die andere Person sieht sie in der Glocke, kommentiert und hakt sie ab.'],
    danach: 'Ihr wisst, wie Übergaben laufen.',
    wo: { href: WEG.heute(), label: 'Heute' },
  },

  // ── Etappe 8 — Abschluss ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ich-rundgang', spaeter: true, etappe: 8, nr: '8.1', ebene: 'ich', minuten: 20,
    modul: 'grundlage',
    titel: 'Rundgang durch die Software',
    warum: 'Wer weiß, wo was liegt, findet sich in fünf Minuten zurecht statt in zwei Wochen.',
    wie: [
      'Oben der Schalter Alles · Privat · Business — die Leiste darunter folgt ihm. Am Handy öffnet „Menü“ unten dasselbe.',
      'Heute ist die Startseite — über „Anpassen“ gestaltest du sie selbst. Fokus, Kompass und Wachstum liegen unter Planung; Freigaben, Agenten und Brain unter ZOE.',
      'Unten links Einstellungen. ⌘K (am Handy die Lupe) springt zu jeder Seite. Netzwerken erfasst unterwegs.',
    ],
    danach: 'Du findest dich zurecht.',
    wo: { href: WEG.heute(), label: 'Heute' },
  },
  {
    id: 'ich-bauplan', spaeter: true, etappe: 8, nr: '8.5', ebene: 'ich', minuten: 5,
    modul: 'grundlage',
    titel: 'Mitbauen: Problem oder Idee melden',
    warum: 'Mitbauen braucht keinen Code. Was hakt oder fehlt, kommt als Karte auf das Bauplan-Board — mit der Seite, auf der du gerade warst.',
    wie: [
      'Unten links „Problem oder Idee melden“ (am Handy im Menü): Fehler, Idee oder Wunsch, gern mit Bildschirmfoto.',
      'Das Board: Ideen → Bereit → In Arbeit → Zum Testen → Fertig. Was unter „Zum Testen“ steht, probierst du aus: „Passt“ oder „Passt noch nicht“ mit Kommentar.',
    ],
    danach: 'Deine Rückmeldung landet direkt beim nächsten Bau.',
    wo: { href: '/os/bauplan', label: 'Bauplan' },
  },
  {
    id: 'datenstand', spaeter: true, etappe: 8, nr: '8.2', ebene: 'gemeinsam', minuten: 15,
    modul: 'grundlage',
    titel: 'Datenstand prüfen',
    warum: 'Am Ende einmal sehen, welcher Bereich gepflegt, leer oder veraltet ist.',
    wie: [
      'Datenbasis ansehen und Lücken schließen.',
      'Markttraktion › Stammdaten: Verbindungsprüfung ohne Fehler; Business-Index ohne Finanz-Lücke.',
    ],
    danach: 'Ihr startet mit einem sauberen Bestand.',
    wo: { href: '/os/datenbasis', label: 'Einstellungen › Datenbasis' },
  },
  {
    id: 'hoi-gruen', spaeter: true, etappe: 8, nr: '8.3', ebene: 'instanz', nurInhaber: true, minuten: 20, pruefung: 'hoi',
    modul: 'grundlage', nach: ['update', 'sicherung', 'adresse'],
    titel: 'Head of IT ohne Rot',
    warum: 'Das Lagebild zeigt, ob Server, Sicherung, Verbindungen und Schlüssel in Ordnung sind. Erst ohne Rot ist die Einrichtung abgeschlossen.',
    wie: [
      'Am Server läuft der Lage-Sammler (der Befund „Host“ ist nicht grau).',
      'Für den Außenblick in den GitHub-Einstellungen den eingeschränkten HOI-Schlüssel und die Adresse hinterlegen — nie den Dienstschlüssel.',
      'Alle roten Befunde abarbeiten.',
    ],
    danach: 'Geprüft wird: kein roter Befund, Lage-Sammler und Außenblick melden. Der Head of IT bleibt eure dauerhafte Ampel.',
    wo: HOI,
  },
  {
    id: 'regeln', spaeter: true, etappe: 8, nr: '8.4', ebene: 'gemeinsam', minuten: 5,
    modul: 'grundlage',
    titel: 'Zusammenarbeit: Zonen und Updates',
    warum: 'Am Code wird laufend weitergebaut — aber nicht am laufenden System. Die Zonen sagen, was jederzeit geht und wann man kurz wartet.',
    wie: [
      'Grün: Daten in der Oberfläche eintragen — übersteht jedes Update.',
      'Gelb: große Mengen auf einmal (Import, Finanzplan ersetzen, „Neu anfangen“) nicht während „Update läuft“.',
      'Rot: Code und Server — online geht ein Update nur auf ausdrückliches Wort des Inhabers.',
      'Wer was geändert hat, steht unter Zusammenarbeit — nur wer, was, wann; nie Inhalte.',
    ],
    danach: 'Weiterbauen und Arbeiten kommen sich nicht in die Quere.',
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },

  // ── Nur im Neustart (09.10.) — Etappe und Gruppe hier sind die des Neustarts; die Nummer rechnet `fassungFuer` ─────────────────────────
  // Texte ohne Schritt-Nummern (die Nummern ergeben sich aus der Reihenfolge) und ohne Namen — Orte nur über WEG bzw. vorhandene Seiten.
  {
    id: 'neustart', nurNeustart: true, samstag: true, etappe: 1, nr: '', ebene: 'gemeinsam', minuten: 10, pruefung: 'neustart',
    modul: 'grundlage',
    titel: 'Neustart: was mitkam, was neu ist',
    warum: 'Ihr fangt bei null an — wie eine neue Instanz. Mitgekommen sind nur eure Konten, die Kartei mit der Markttraktion und die Aufgaben, die ihr selbst angelegt habt. Alles andere tragt ihr einmal sauber neu ein; danach zieht ihr die Schnittstellen.',
    wie: [
      'Mitgekommen: eure Konten (Anmeldung, zweiter Faktor), die Kartei samt Firmen und Markttraktion, eure eigenen Aufgaben und Projekte. Die Prüfung rechts zeigt, was übernommen wurde — nur Zähler.',
      'Neu einzutragen: eigene und gemeinsame Ziele, Routinen, Gesundheit, Familie, Finanzen (Konten, Kosten, Kontostände, offene Posten), Gesellschaften und Absender, Planung.',
      'Neu zu verbinden (Etappe „Schnittstellen“): Kalender, Postfächer, WHOOP, WhatsApp — im neuen Datenordner ist jede Verbindung neu, auch wenn sie vorher stand.',
      'Die Reihenfolge: erst Zugang, dann alles eingeben, dann die Schnittstellen, dann die Agenten.',
    ],
    danach: 'Abhaken, wenn alle wissen, was mitkam und was neu kommt.',
  },
  {
    id: 'ich-ziele', nurNeustart: true, samstag: true, privat: true, etappe: 2, nr: '', ebene: 'ich', minuten: 20, pruefung: 'ziele-ich',
    modul: 'planung',
    titel: 'Meine eigenen Ziele',
    warum: 'Neben den gemeinsamen Zielen hat jede Person ihre eigenen — privat, beruflich, für den Körper. Sie gehören nur dir: niemand sieht sie, außer du teilst sie.',
    wie: [
      'Planung › Kompass: oben dich selbst wählen und je Horizont (Jahr, Quartal, Monat, Woche) deinen Satz eintragen — das sind deine eigenen Ziele.',
      'Was der ganze Haushalt sehen soll, gehört zu den gemeinsamen Jahreszielen (Planung › Jahr) — nicht hierher.',
      'Ob jemand deine eigenen Ziele sieht, entscheidest du unter Konto › „Eigene Ziele teilen“. Vorgabe: niemand.',
    ],
    danach: 'Geprüft wird nur, ob du für das laufende Jahr ein eigenes Ziel oder einen eigenen Satz hast — nie, was drinsteht.',
    wo: { href: '/os/kompass', label: 'Planung › Kompass' },
  },
  {
    id: 'ich-koerper', nurNeustart: true, samstag: true, etappe: 3, nr: '', ebene: 'ich', minuten: 20, pruefung: 'koerper',
    modul: 'gesundheit', nach: ['ich-gesundheit'],
    titel: 'Körper-Profil',
    warum: 'Dein Körper-Profil sagt, was gerade Aufmerksamkeit braucht und woran du arbeitest — die Grundlage für den Gesundheits-Index, für Vorschläge und (nur mit deiner Einwilligung) für ZOE. Nur du siehst es.',
    wie: [
      'Gesundheit › Körper: ein Leitsatz (was gerade zählt), deine Hebel — am besten je Hebel mit Kennzahl — und ein Stufenplan (jetzt · danach · später).',
      'Optional Zusammenhänge und ein Hinweis; Symptom-Regler und Zähler „Sauber geblieben“ nur, wenn du sie willst.',
      'Ohne deine Einwilligung (a) zur Gesundheit speichert MAKE OS nichts — sie steht unter Zugang & Datenschutz.',
    ],
    danach: 'Geprüft wird nur, ob dein Profil Inhalt hat — nie, was drinsteht. Andere Personen sehen den Reiter nicht.',
    wo: { href: WEG.energie(), label: 'Gesundheit › Körper' },
  },
  {
    id: 'ich-ernaehrung', nurNeustart: true, samstag: true, etappe: 3, nr: '', ebene: 'ich', minuten: 15, pruefung: 'ernaehrung',
    modul: 'gesundheit', nach: ['ich-gesundheit'],
    titel: 'Ernährungsprofil',
    warum: 'Essensplan, Einkauf und Rezepte richten sich nach allen Profilen im Haushalt — ohne dein Profil plant MAKE OS an dir vorbei.',
    wie: [
      'Gesundheit › Ernährung: dein Profil mit Bedarf (in eigenen Worten), Ziel und Unverträglichem.',
      'Gäste oder Kinder legt der Haushalt als eigene Profile an.',
      'Vorschläge nennen nie eine Person — dein Profil sehen andere nur, wenn du Gesundheit mit ihnen teilst.',
    ],
    danach: 'Geprüft wird, ob dein Profil Bedarf, Ziel oder Unverträgliches trägt.',
    wo: { href: WEG.ernaehrung(), label: 'Gesundheit › Ernährung' },
  },
  {
    id: 'ich-sport', nurNeustart: true, samstag: true, etappe: 3, nr: '', ebene: 'ich', minuten: 15, pruefung: 'sport',
    modul: 'gesundheit', nach: ['ich-gesundheit'],
    titel: 'Sport: Einstieg und Ziele',
    warum: 'Der Sport-Plan schlägt Wochen vor, die zu deinen Zielen passen — Hyrox, Laufen, Kraft oder Grundlagen. Vorschläge, keine Trainingsberatung.',
    wie: [
      'Sport: den Einstieg durchgehen (was du machst, wie oft, Ausgangswerte).',
      'Mindestens ein Ziel anlegen, z. B. einen Wettkampf oder eine Zeit.',
      'Die Woche ansehen und bei Bedarf anpassen.',
    ],
    danach: 'Geprüft wird: Einstieg fertig und mindestens ein Ziel.',
    wo: { href: WEG.sport(), label: 'Gesundheit › Sport' },
  },
  {
    id: 'ich-gesundheit-routinen', nurNeustart: true, samstag: true, etappe: 3, nr: '', ebene: 'ich', minuten: 10, pruefung: 'routinen-gesundheit',
    modul: 'gesundheit', nach: ['ich-gesundheit'],
    titel: 'Gesundheits-Routinen',
    warum: 'Was dein Körper regelmäßig braucht — Bewegung, Reha, Schlaf, Vorsorge — steht dann auf Heute, abhakbar. Andere sehen deine Routinen nur als „Belegt“.',
    wie: [
      'Planung › Routinen: Routinen mit der Kategorie „Gesundheit“ anlegen, mit Tageszeit und Rhythmus.',
      'Seltene Termine (z. B. Vorsorge) mit Rhythmus und nächstem Mal.',
    ],
    danach: 'Geprüft wird: mindestens eine aktive eigene Routine der Kategorie Gesundheit.',
    wo: { href: WEG.routinen(), label: 'Planung › Routinen' },
  },
  {
    id: 'business-online', nurNeustart: true, samstag: true, etappe: 6, nr: '', ebene: 'gemeinsam', minuten: 5, pruefung: 'business-vorlage',
    modul: 'planung',
    titel: 'Plan „Business online“ anlegen',
    warum: 'Die Strecke dieser und der nächsten Etappe als Plan: ein Jahresziel mit Meilensteinen in fester Reihenfolge und Aufgaben — so steht sie in Planung, Kapazität und Zeitstrahl, nicht nur hier.',
    wie: [
      'Unten die Gesellschaft wählen und „Plan anlegen“: ein Ziel und Meilensteine — Gesellschaft, Konten und 0-Punkt, Kosten, Angebot, Kartei, Pipeline, Vertrieb im Rhythmus, Schnittstellen, Agenten — jeweils mit Aufgaben.',
      'Termine sind Vorschläge ab heute — in der Planung anpassen. Ein zweiter Klick ergänzt nur, was fehlt.',
    ],
    danach: 'Geprüft wird, ob der Plan in der Planung steht.',
    wo: { href: WEG.jahr(), label: 'Planung › Jahr' },
  },
  {
    id: 'konten-business', nurNeustart: true, samstag: true, etappe: 6, nr: '', ebene: 'gemeinsam', minuten: 15, pruefung: 'konten-business',
    modul: 'finanzen', nach: ['steckbrief'],
    titel: 'Bankkonten der Gesellschaften',
    warum: 'Jedes Geschäftskonto steht genau einmal im Konten-Register — Liquidität, 0-Punkt, Business-Index und Finanzplanung lesen nur daraus. Hier dockt später auch die Bank-Anbindung an.',
    wie: [
      'Finanzen › Business › Liquidität › Kontostände: je Gesellschaft ihre Konten anlegen (Name, Art, Bank, IBAN — gezeigt wird sie nur maskiert).',
      'Kredite und Depots auch eintragen — sie zählen nicht zur Kasse, gehören aber ins Bild.',
      'Die Stände kommen mit dem 0-Punkt und danach von Hand oder per Kontoauszug-Datei.',
    ],
    danach: 'Geprüft wird: jede Business-Gesellschaft hat mindestens ein Konto im Register (nur Zähler).',
    wo: { href: WEG.kontenRegister('business'), label: 'Finanzen › Business › Liquidität' },
  },
  {
    id: 'angebot-entwurf', nurNeustart: true, samstag: true, etappe: 7, nr: '', ebene: 'gemeinsam', minuten: 15, pruefung: 'angebote', bestaetigen: true,
    modul: 'markttraktion', nach: ['absender', 'produkte'],
    titel: 'Angebotsvorlage: ein Angebot als Entwurf',
    warum: 'Erst wenn ein Angebot einmal sauber aussieht — Absender, Positionen aus dem Produkt, Anrede, Einleitung und Schluss —, sitzt jedes weitere in Minuten.',
    wie: [
      'Markttraktion › Angebot: ein neues Angebot für einen echten Kontakt, Position aus einem Produkt, Anrede Sie oder Du.',
      'Die Vorschau prüfen: Pflichtangaben, Nummernkürzel, Bank. Als Entwurf speichern — gestellt wird es erst, wenn es rausgeht.',
    ],
    danach: 'Geprüft wird, ob es mindestens ein Angebot gibt; dass es passt, bestätigst du mit dem Häkchen.',
    wo: { href: WEG.angebot(), label: 'Markttraktion › Angebot' },
  },
  {
    id: 'kampagne-start', nurNeustart: true, samstag: true, etappe: 7, nr: '', ebene: 'gemeinsam', minuten: 20,
    modul: 'markttraktion', nach: ['kartei'],
    titel: 'Follow-up-Kadenz und erste Kampagne',
    warum: 'Die Pipeline lebt vom Nachfassen. Die Kadenz je Kreis sagt, wann wer wieder dran ist; eine erste Kampagne bringt neue Gespräche.',
    wie: [
      'Markttraktion › Follow-up › Kadenz: den Takt je Kreis (A bis D) prüfen und festlegen.',
      'Marketing › Kampagnen: eine erste Kampagne aus einem Playbook planen — Segment, Kanal (die Kanal-Ampel beachten), Text.',
      'MAKE OS versendet nichts selbst — jede Nachricht geht per Klick.',
    ],
    danach: 'Follow-up und Power Hour schlagen die Richtigen zur richtigen Zeit vor.',
    wo: { href: WEG.followup('kadenz'), label: 'Markttraktion › Follow-up' },
  },
  {
    id: 'powerhour', nurNeustart: true, samstag: true, etappe: 7, nr: '', ebene: 'gemeinsam', minuten: 15,
    modul: 'markttraktion', nach: ['team', 'kampagne-start'],
    titel: 'Power Hour einrichten',
    warum: 'Eine feste Stunde für Anrufe und Nachrichten, in der MAKE OS die Reihenfolge vorgibt — je Person, damit nie zwei dieselbe Person anrufen.',
    wie: [
      'Planung › Routinen: in der Wochenvorlage je Person einen festen Block „Power Hour“ (Business).',
      'Markttraktion › Überblick: Wochenziele im Scoreboard je Person.',
      'Markttraktion › Follow-up › Power Hour einmal durchgehen.',
    ],
    danach: 'Die Power Hour füllt sich jede Woche selbst; im Kalender steht sie, sobald er verbunden ist.',
    wo: { href: WEG.powerHour(), label: 'Markttraktion › Power Hour' },
  },
];

/** Ein Schritt per Kennung (null = unbekannt). */
export const schrittMitId = (id: string): Schritt | null => SCHRITTE.find(s => s.id === id) ?? null;

/** Persönlich gespeichert und geprüft (Ebene „ich“)? */
export const istPersoenlich = (s: Pick<Schritt, 'ebene'>): boolean => s.ebene === 'ich';

// ── Neustart (09.10.): eigener Ablauf als Daten ──────────────────────────────────────────────────────────────────────────────────────────
// Kevin: „Wir fangen bei 0 an … Wir sind ein komplett ‚neuer‘ Kunde und wollen als Paar geonboardet werden. Jeder für sich. Mit seinen privaten
// Zielen, Gesundheit komplett, Ziele etc. … dann auch eine Strecke, wie man Business online bringt.“ Nachtrag: (1) Zugang & Sicherheit →
// (2) ALLES eingeben → (3) Schnittstellen als eigene Etappe danach → (4) Agenten als zweiter Schritt. Der Kern sind (1)+(2).
// Ehrlich: Google Drive ist nicht angebunden (kein Schritt), eine Bank-Anbindung gibt es noch nicht — bis dahin Kontoauszug-Dateien; das
// Konten-Register ist die Andockstelle (Hinweis, kein Schritt).

export const NEUSTART_ETAPPEN: Etappe[] = [
  { nr: 0, titel: 'Server und Instanz', satz: 'Am Server, nur die Inhaber. Auf einem bestehenden Server ist das meiste schon eingerichtet — die Prüfungen zeigen es; offen bleibt, was die neue Instanz noch braucht.' },
  { nr: 1, titel: 'Zugang, Sicherheit, Datenschutz', satz: 'Wer reinkommt, wie er sich ausweist, wer was sieht, eure Einwilligungen und ein kurzer Rundgang. Danach geht es ans Eingeben.' },
  { nr: 2, titel: 'Meine Ziele und mein Alltag', satz: 'Jede Person für sich: eigene Ziele, Routinen, Arbeitszeit und die übernommenen Aufgaben. Niemand richtet das für eine andere Person ein.' },
  { nr: 3, titel: 'Meine Gesundheit', satz: 'Komplett und nur für dich: Körper-Profil, Ernährung, Sport und Gesundheits-Routinen — nach deiner Einwilligung. Andere sehen höchstens, ob du eingerichtet bist, nie Inhalte.' },
  { nr: 4, titel: 'Gemeinsam: Ziele, Planung, Familie', satz: 'Eure gemeinsamen Jahresziele und der Nordstern, Fokus, die übernommenen Projekte und die wichtigsten Menschen.' },
  { nr: 5, titel: 'Finanzen: eintragen oder hochladen', satz: 'Privatkonten, Kontoauszüge, Fixkosten, Budget, Schulden und der Finanzplan — jede Zahl einmal, am richtigen Ort.', datenkarte: true,
    hinweise: [
      { titel: 'Bank-Anbindung', wann: 'kommt später', satz: 'Eine Anbindung an die Bank gibt es noch nicht. Bis dahin lest ihr je Konto Kontoauszug-Dateien ein (CAMT.053 oder CSV aus dem Online-Banking) — das Konten-Register ist die Stelle, an der die Bank später andockt. Kein eigener Schritt.' },
      { titel: 'Haushalt → Finanzplanung', wann: 'Brücke kommt später', satz: 'Der Haushalt führt das Ist (Buchungen, Fixkosten, Budget, Schulden); die Finanzplanung liest künftig daraus. Bis dahin nicht doppelt pflegen.' },
    ] },
  { nr: 6, titel: 'Business online: Gesellschaft & Konten', satz: 'Steckbrief, Absender, Bankkonten, Stichtag und 0-Punkt, Kontostände, offene Posten, Kosten und Steuerprofil — damit jede Gesellschaft mit sauberen Zahlen startet.', datenkarte: true },
  { nr: 7, titel: 'Business online: Angebot & Vertrieb', satz: 'Team, Produkte, eine Angebotsvorlage, die übernommene Kartei, Mandate und Pipeline, Kadenz, erste Kampagne und die Power Hour.' },
  { nr: 8, titel: 'Schnittstellen', satz: 'Erst jetzt, wo alles drin ist, verbindet ihr: Kalender, Postfächer, WHOOP, WhatsApp. Jede Person verbindet nur ihre eigenen Konten — im neuen Datenordner ist jede Verbindung neu, auch wenn sie vorher stand.',
    hinweise: [
      { titel: 'Google Drive', wann: 'nicht angebunden', satz: 'Dateien aus Google Drive kommen nicht von selbst — Unterlagen ladet ihr dort hoch, wo sie hingehören (Aufgaben, Unternehmen, Kartei). Kein Schritt.' },
      { titel: 'ZOE aufs Handy über WhatsApp', wann: 'kommt später', satz: 'ZOE bekommt eine eigene WhatsApp-Business-Nummer, getrennt von der Nummer der Inbox. Bis dahin gibt es dafür keinen Schritt.' },
    ] },
  { nr: 9, titel: 'Agenten und ZOE', satz: 'Der zweite Schritt: wie viel die Agenten selbst tun dürfen, ZOE kennenlernen, das Brain — erst jetzt arbeiten sie mit euren echten Daten.' },
  { nr: 10, titel: 'Abschluss', satz: 'Einmal durch alles gehen, den Datenstand prüfen, den Head of IT auf Grün bringen.' },
];

/**
 * Ein Schritt im Neustart: Etappe, Gruppe (`zuerst` = Etappe 0 am Server, `kern` = zählt sofort, `danach` = Schnittstellen, Agenten, Abschluss —
 * zählt auf Heute mit), optional, Bestätigung, eigene Voraussetzungen und Texte. Die Reihenfolge der Tabelle ist die Reihenfolge in der Etappe;
 * die Nummer („6.3“) entsteht daraus. Texte hier tragen keine Schritt-Nummern.
 */
export interface NeustartEintrag {
  id: string;
  etappe: number;
  gruppe?: 'zuerst' | 'kern' | 'danach';
  optional?: true;
  bestaetigen?: true;
  nach?: string[];
  texte?: Partial<Pick<Schritt, 'titel' | 'warum' | 'wie' | 'danach'>>;
}

const KERN = 'kern' as const, DANACH = 'danach' as const;
export const NEUSTART: readonly NeustartEintrag[] = [
  // 0 · Server und Instanz
  { id: 'update', etappe: 0 }, { id: 'pepper', etappe: 0 }, { id: 'sicherung', etappe: 0 }, { id: 'sicherung-mac', etappe: 0, gruppe: DANACH },
  { id: 'vault', etappe: 0 }, { id: 'adresse', etappe: 0 }, { id: 'medienspeicher', etappe: 0, gruppe: DANACH },
  // 1 · Zugang, Sicherheit, Datenschutz
  { id: 'neustart', etappe: 1, gruppe: KERN }, { id: 'zweite-einladung', etappe: 1, gruppe: KERN }, { id: 'ich-zwei-faktor', etappe: 1, gruppe: KERN },
  { id: 'einladen', etappe: 1, gruppe: KERN }, { id: 'haushalt', etappe: 1, gruppe: KERN }, { id: 'zwei-faktor-pflicht', etappe: 1, gruppe: KERN },
  { id: 'notfallmappe', etappe: 1, gruppe: KERN }, { id: 'datenschutz', etappe: 1, gruppe: KERN }, { id: 'ki-instanz', etappe: 1, gruppe: KERN },
  { id: 'ich-sicht', etappe: 1, gruppe: KERN }, { id: 'ich-gesundheit', etappe: 1, gruppe: KERN }, { id: 'ich-ki', etappe: 1, gruppe: KERN },
  { id: 'ich-handy', etappe: 1, gruppe: KERN }, { id: 'ich-rundgang', etappe: 1, gruppe: KERN },
  { id: 'weitere-inhaber', etappe: 1, gruppe: DANACH }, { id: 'ssh-zweiter-schluessel', etappe: 1, gruppe: DANACH },
  // 2 · Meine Ziele und mein Alltag (je Person)
  { id: 'ich-ziele', etappe: 2, gruppe: KERN }, { id: 'ich-routinen', etappe: 2, gruppe: KERN },
  { id: 'ich-arbeitsrahmen', etappe: 2, gruppe: KERN, nach: [], texte: { wie: [
    'Planung › Routinen: die Wochenvorlage ist führend — Blöcke für Arbeit (Business) je Wochentag.',
    'Kapazität: dein Grundwert in Stunden je Woche.',
    'Urlaub später als „Abwesend“ im Kalender, sobald er verbunden ist; Zeit in einem fremden Kalender als Block (nächster Schritt).',
  ] } },
  { id: 'ich-woanders', etappe: 2, gruppe: KERN, optional: true, nach: ['ich-arbeitsrahmen'] },
  { id: 'ich-aufgaben', etappe: 2, gruppe: KERN, bestaetigen: true, nach: [], texte: {
    titel: 'Deine übernommenen Aufgaben sichten',
    warum: 'Deine Aufgaben sind mit dem Neustart mitgekommen. Was auf dich zugewiesen ist, soll nicht in einer langen Liste untergehen.',
    wie: ['Aufgaben › Filter „Meine“: was gilt noch?', 'Fälligkeiten setzen, Überfälliges neu datieren oder schließen; mit @Name holst du jemanden dazu.'],
    danach: 'Geprüft wird: nichts auf dich überfällig; dass du durch bist, bestätigst du mit dem Häkchen.',
  } },
  // 3 · Meine Gesundheit (je Person) — weitere Gesundheits-Schritte „ich“ anderer Pakete landen über `neustartEtappeVon` hier (am Ende)
  { id: 'ich-koerper', etappe: 3, gruppe: KERN }, { id: 'ich-ernaehrung', etappe: 3, gruppe: KERN }, { id: 'ich-sport', etappe: 3, gruppe: KERN },
  { id: 'ich-gesundheit-routinen', etappe: 3, gruppe: KERN }, { id: 'ich-kopf-energie', etappe: 3, gruppe: KERN, optional: true },
  // 4 · Gemeinsam: Ziele, Planung, Familie
  { id: 'jahresziele', etappe: 4, gruppe: KERN, nach: [], texte: { titel: 'Gemeinsame Jahresziele und Nordstern' } },
  { id: 'meilensteine-fokus', etappe: 4, gruppe: KERN },
  { id: 'projekte', etappe: 4, gruppe: KERN, nach: [], texte: {
    titel: 'Übernommene Projekte und Listen sichten',
    warum: 'Eure eigenen Aufgaben sind mitgekommen — mit Projekten und Listen. Einmal durchgehen: was gilt noch, was fehlt, was ist erledigt.',
    wie: ['Aufgaben › Überblick: je Space die Projekte durchsehen, Erledigtes abschließen, Fehlendes mit „+ Projekt“ (auch aus Vorlagen) anlegen.', 'Verantwortliche setzen; „nur ich“ für Persönliches.'],
  } },
  { id: 'familie-menschen', etappe: 4, gruppe: KERN },
  { id: 'kompass', etappe: 4, gruppe: DANACH }, { id: 'rhythmen', etappe: 4, gruppe: DANACH },
  // 5 · Finanzen: eintragen oder hochladen (Privat)
  { id: 'ich-privatkonten', etappe: 5, gruppe: KERN, texte: {
    titel: 'Privatkonten: Stand eintragen oder Kontoauszug hochladen',
    wie: [
      'Finanzen › Privat › Konten & Buchungen › Konten: eigene Konten mit Inhaber anlegen, gemeinsame nur einmal.',
      'Je Konto den Stand mit Datum eintragen ODER „Kontoauszug einlesen“ (CAMT.053 oder CSV aus dem Online-Banking) — die Buchungen landen im Haushalt, mit Vorschau, Saldo-Prüfung und Rückgängig.',
      'Den Zeitraum gemeinsam festlegen (z. B. ab Jahresbeginn), damit Fixkosten und Budget ein ganzes Bild haben. Eine Bank-Anbindung gibt es noch nicht.',
    ],
  } },
  { id: 'privat-fixkosten', etappe: 5, gruppe: KERN, texte: { wie: [
    'Fixkosten: aus den eingelesenen Buchungen erkennt der Haushalt wiederkehrende Zahlungen — durchgehen, bis keine mehr „Rhythmus unklar“ hat; Fehlendes von Hand ergänzen.',
    'Budget je Kategorie und Schulden mit Rate — nur im Haushalt, nicht zusätzlich in der Finanzplanung.',
    'Das Rücklage-Ziel im Privat-Index setzen.',
  ] } },
  { id: 'finanzplan', etappe: 5, gruppe: KERN, nach: ['ich-privatkonten'], texte: { wie: [
    'Finanzen › Privat › Planung: leer beginnen oder ein vorhandenes Dokument hochladen; Gehälter, Netto-Tabelle, Darlehen.',
    'Kontostände kommen aus dem Konten-Register und dem 0-Punkt — hier nicht doppelt.',
    'Budget, Schulden und Fixkosten führt der Haushalt (Datenkarte).',
  ] } },
  { id: 'selbststaendigkeit', etappe: 5, gruppe: DANACH, texte: {
    titel: 'Selbstständigkeit: Summen des laufenden Jahres',
    warum: 'Die Einkommensteuer rechnet über das ganze Jahr. Startet ihr mitten im Jahr neu, gehören die Monate davor als Summen in die Finanzplanung — die alten Buchungen sind nicht mitgekommen.',
  } },
  // 6 · Business online: Gesellschaft & Konten
  { id: 'business-online', etappe: 6, gruppe: KERN },
  { id: 'steckbrief', etappe: 6, gruppe: KERN }, { id: 'absender', etappe: 6, gruppe: KERN }, { id: 'konten-business', etappe: 6, gruppe: KERN },
  { id: 'stichtag', etappe: 6, gruppe: KERN, texte: {
    titel: 'Stichtag des 0-Punkts wählen',
    warum: 'Mit dem Neustart fängt jede Business-Gesellschaft bei null an. Ab dem Stichtag rechnet sie mit sauberen Zahlen — nehmt den Tag des Neustarts oder den Ersten des laufenden Monats, am besten denselben Tag, an dem die Finanzplanung beginnt.',
    wie: [
      'Der neue Datenordner hat keine alten Rechnungen, Zahlungen oder Buchungen — vor dem Stichtag gibt es nichts zu archivieren und nichts nachzutragen.',
      'Was zum Stichtag offen war, kommt in den 0-Punkt; Kontostände danach tragen ein Datum nach dem Stichtag.',
      'Fallen Stichtag und Planbeginn zusammen, braucht die Finanzplanung keinen Handwert für den ersten Planmonat.',
    ],
    danach: 'Abhaken, wenn alle den Stichtag kennen; der 0-Punkt trägt ihn je Gesellschaft ein.',
  } },
  { id: 'eroeffnung', etappe: 6, gruppe: KERN, texte: { wie: [
    'Finanzen › Business › 0-Punkt: je Business-Gesellschaft den Stichtag und den Kontostand an diesem Tag.',
    'Alle zum Stichtag offenen Forderungen und Verbindlichkeiten — von Hand oder aus Excel bzw. der OP-Liste („Offene Posten aus Excel einfügen“, mit Vorschau und Rückgängig).',
    'Ein Eröffnungs-Posten, der später bezahlt wird: „Heute bezahlt“ an seiner Zeile.',
  ] } },
  { id: 'kontostaende', etappe: 6, gruppe: KERN, texte: { wie: [
    'Liquidität › Kontostände: je Konto den aktuellen Stand mit Datum — oder „Kontoauszug einlesen“ (CAMT.053 oder CSV, mit Vorschau und Rückgängig).',
    'Das Datum muss nach dem Stichtag liegen — sonst gilt der 0-Punkt.',
    'Eine Bank-Anbindung gibt es noch nicht: bis dahin etwa einmal die Woche Stand oder Kontoauszug.',
  ] } },
  { id: 'offene-posten', etappe: 6, gruppe: KERN, texte: { wie: [
    'Rechnungen & Zahlungen: gestellte Rechnungen nach dem Stichtag eintragen, Eingegangenes auf „bezahlt“.',
    'Offene Zahlungen (Eingangsrechnungen) mit Fälligkeit.',
    'Offenes vom Stichtag steht im 0-Punkt und wird dort gepflegt.',
  ] } },
  { id: 'finanzplan-business', etappe: 6, gruppe: KERN, nach: ['steckbrief', 'finanzplan'], texte: {
    titel: 'Kosten und Finanzplan der Gesellschaften',
    warum: 'Alle laufenden Kosten der Gesellschaften einmal sauber eintragen — Software, Miete, Personal, Beratung. Daraus rechnen Liquidität, Runway und Steuern; Umsätze kommen aus Mandaten und Produkten.',
    wie: [
      'Finanzen › Business › Planung: je Kostenposten einen Baustein (Stelle, Software, Miete, Rate) mit Betrag, Start und Rhythmus.',
      'Umsatz-Bausteine aus den Mandaten übernehmen, sobald die Mandate geprüft sind (nächste Etappe).',
      'Offene Vorschläge entscheiden und den Arbeitsplan setzen.',
    ],
  } },
  { id: 'steuerprofil', etappe: 6, gruppe: KERN }, { id: 'monatsabschluss', etappe: 6, gruppe: KERN }, { id: 'business-grundlagen', etappe: 6, gruppe: KERN },
  { id: 'register', etappe: 6, gruppe: DANACH }, { id: 'zahlenziele', etappe: 6, gruppe: DANACH },
  // 7 · Business online: Angebot & Vertrieb
  { id: 'team', etappe: 7, gruppe: KERN },
  { id: 'produkte', etappe: 7, gruppe: KERN, bestaetigen: true, texte: { titel: 'Produkte prüfen und ergänzen' } },
  { id: 'angebot-entwurf', etappe: 7, gruppe: KERN },
  { id: 'kartei', etappe: 7, gruppe: KERN, texte: {
    titel: 'Übernommene Kartei sichten und bereinigen',
    warum: 'Die Kartei ist mit dem Neustart mitgekommen. Power Hour, Pipeline und Index rechnen mit ihr — Herkunft, Rechtsgrundlage, Kreis und Zuständigkeit müssen stimmen.',
    wie: [
      'Markttraktion › Zahnrad (Stammdaten) › Datenqualität: die Verbindungsprüfung laufen lassen, Dubletten und Firmen zusammenführen.',
      'Bei den wichtigsten Menschen Kreis A oder B und „Zuständig“ setzen — sonst landet die Power Hour bei einer Person.',
      'Herkunft und Rechtsgrundlage prüfen; neue Listen nur über den Import mit Vorschau (für Kontakte aus fremden Quellen läuft dann die Frist nach Art. 14).',
    ],
  } },
  { id: 'mandate', etappe: 7, gruppe: KERN, bestaetigen: true, texte: {
    titel: 'Laufende Mandate prüfen',
    wie: [
      'Mandate & Unternehmen › Mandate: jedes laufende Mandat mit Firma aus der Kartei, Produkt, Honorar, Rhythmus, Gesellschaft, Zahlungsziel und Zuständigkeit.',
      'Fehlende Mandate von Hand oder aus Excel („Mandate aus Excel einfügen“, mit Vorschau und Rückgängig).',
    ],
  } },
  { id: 'deals', etappe: 7, gruppe: KERN, texte: { titel: 'Pipeline: offene Deals prüfen' } },
  { id: 'vertrieb', etappe: 7, gruppe: KERN, texte: {
    titel: 'Positionierung, Wertelisten und Scoring',
    wie: ['Marketing › Positionierung: Zielgruppe, Nutzen, Ton.', 'Zahnrad › Wertelisten: Verlustgründe und eigene Werte.', 'Qualifizierung & Scoring: den Standard lassen oder anpassen.'],
  } },
  { id: 'kampagne-start', etappe: 7, gruppe: KERN }, { id: 'powerhour', etappe: 7, gruppe: KERN },
  { id: 'mandate-kapazitaet', etappe: 7, gruppe: DANACH }, { id: 'ich-visitenkarte', etappe: 7, gruppe: KERN, optional: true },
  // 8 · Schnittstellen
  { id: 'whoop-app', etappe: 8, gruppe: DANACH }, { id: 'google-app', etappe: 8, gruppe: DANACH },
  { id: 'ich-icloud', etappe: 8, gruppe: DANACH }, { id: 'ich-google', etappe: 8, gruppe: DANACH }, { id: 'ich-gmail', etappe: 8, gruppe: DANACH },
  { id: 'ich-postfaecher', etappe: 8, gruppe: DANACH }, { id: 'kalender-zuordnen', etappe: 8, gruppe: DANACH },
  { id: 'familie-rahmen', etappe: 8, gruppe: DANACH, nach: ['kalender-zuordnen'], texte: {
    warum: 'Paar-Gespräch, Business-freie Zeiten und Ausnahmezeit geben dem Familienbereich seinen Takt — jetzt, wo der gemeinsame Kalender verbunden ist, landet das Paar-Gespräch dort.',
  } },
  { id: 'ich-whoop', etappe: 8, gruppe: DANACH, optional: true }, { id: 'ich-buchungsseite', etappe: 8, gruppe: DANACH, optional: true },
  { id: 'mail-umzug', etappe: 8, gruppe: DANACH }, { id: 'whatsapp', etappe: 8, gruppe: DANACH },
  // 9 · Agenten und ZOE (zweiter Schritt)
  { id: 'agenten', etappe: 9, gruppe: DANACH }, { id: 'ich-zoe', etappe: 9, gruppe: DANACH }, { id: 'brain', etappe: 9, gruppe: DANACH }, { id: 'uebergabe-probe', etappe: 9, gruppe: DANACH },
  // 10 · Abschluss
  { id: 'ich-bauplan', etappe: 10, gruppe: DANACH }, { id: 'datenstand', etappe: 10, gruppe: DANACH }, { id: 'hoi-gruen', etappe: 10, gruppe: DANACH }, { id: 'regeln', etappe: 10, gruppe: DANACH },
];
/** Entfällt im Neustart: der Altbestand (es gibt keinen) und „Gesundheit für dich einrichten“ (aufgeteilt in eigene Schritte der Etappe Gesundheit). */
export const NEUSTART_ENTFAELLT: readonly string[] = ['altbestand', 'ich-gesundheit-profil'];

/**
 * Wohin ein Schritt im Neustart gehört, der NICHT in der Tabelle steht (z. B. ein neuer Schritt eines anderen Pakets) — aus Etappe, Ebene und
 * Modul seiner Grundfassung. Ein Gesundheits-Schritt „ich“ landet in „Meine Gesundheit“. Rein.
 */
export function neustartEtappeVon(s: Pick<Schritt, 'etappe' | 'ebene' | 'modul' | 'privatFinanzen' | 'nurNeustart'>): number {
  if (s.nurNeustart) return s.etappe;
  switch (s.etappe) {
    case 0: return 0;
    case 1: return 1;
    case 2: return 8;
    case 3: return s.privatFinanzen ? 5 : 6;
    case 4: return 7;
    case 5: return modulVon(s) === 'finanzen' ? (s.privatFinanzen ? 5 : 6) : s.ebene === 'ich' ? 2 : 4;
    case 6: return s.ebene === 'ich' ? (modulVon(s) === 'gesundheit' ? 3 : 2) : 4;
    case 7: return 9;
    default: return 10;
  }
}

/**
 * Schritt-Nummern in Texten der Grundfassung („Schritt 3.6“, „(1.8)“) auf die Nummern des Neustarts umschreiben — nur echte Schritt-Nummern
 * (aus der Tabelle `nummern`), nie Daten wie „08.10.“ oder Zahlen wie „1.000“. Rein.
 */
export function nummernUmschreiben(text: string, nummern: ReadonlyMap<string, string>): string {
  return text.replace(/(?<![\d.])(\d{1,2}\.\d{1,2}[a-z]?)(?![\d.a-z])/g, m => nummern.get(m) ?? m);
}

let neustartMerk: Map<string, Schritt> | null = null;
/** Alle Fassungen des Neustarts (Kennung → Schritt), einmal gerechnet. Fehlt eine Kennung, entfällt der Schritt im Neustart. */
function neustartFassungen(): Map<string, Schritt> {
  if (neustartMerk) return neustartMerk;
  const tabelle = new Map(NEUSTART.map(e => [e.id, e]));
  const raus = new Set(NEUSTART_ENTFAELLT);
  const reihe: { s: Schritt; e: NeustartEintrag | null; etappe: number }[] = [];
  for (const { nr } of NEUSTART_ETAPPEN) {
    for (const e of NEUSTART) { const s = e.etappe === nr ? schrittMitId(e.id) : null; if (s && !raus.has(s.id)) reihe.push({ s, e, etappe: nr }); }
    for (const s of SCHRITTE) if (!tabelle.has(s.id) && !raus.has(s.id) && !s.nurAltbestand && neustartEtappeVon(s) === nr) reihe.push({ s, e: null, etappe: nr });
  }
  const zaehler = new Map<number, number>();
  const nummern = new Map<string, string>();
  const nrn = reihe.map(x => {
    const z = (zaehler.get(x.etappe) ?? 0) + 1;
    zaehler.set(x.etappe, z);
    if (!x.s.nurNeustart) nummern.set(x.s.nr, `${x.etappe}.${z}`);
    return `${x.etappe}.${z}`;
  });
  const umschreiben = (s: Schritt): Schritt => (s.nurNeustart ? s : {
    ...s, titel: nummernUmschreiben(s.titel, nummern), warum: nummernUmschreiben(s.warum, nummern), wie: s.wie.map(w => nummernUmschreiben(w, nummern)),
    ...(s.danach ? { danach: nummernUmschreiben(s.danach, nummern) } : {}),
  });
  neustartMerk = new Map(reihe.map(({ s, e, etappe }, i) => {
    const gruppe = e?.gruppe ?? (s.samstag ? 'kern' : s.spaeter ? 'danach' : etappe === 0 ? 'zuerst' : 'danach');
    // Grundfassung → neutrale Fassung (ohne Altbestand) → Nummern des Neustarts → Texte des Neustarts. `allgemein` fällt weg, damit `texteFuer`
    // die Fassung nie wieder überschreibt.
    const { allgemein, samstag: _s, spaeter: _p, ...basis } = s;
    const f: Schritt = {
      ...umschreiben({ ...basis, ...(allgemein ?? {}) }), ...(e?.texte ?? {}), etappe, nr: nrn[i], reihe: i,
      ...(gruppe === 'kern' ? { samstag: true as const } : gruppe === 'danach' ? { spaeter: true as const } : {}),
      ...(e?.optional ? { optional: true as const } : {}), ...(e?.bestaetigen ? { bestaetigen: true as const } : {}), ...(e?.nach ? { nach: e.nach } : {}),
    };
    return [s.id, f];
  }));
  return neustartMerk;
}

/**
 * Die Fassung eines Schritts für diese Instanz: im Neustart Etappe, Nummer, Gruppe und Texte des Neustarts (`NEUSTART`); sonst der Schritt
 * selbst (dasselbe Objekt). Ein im Neustart entfallener Schritt bleibt, wie er ist — `sichtbarFuer` blendet ihn aus. Rein.
 */
export function fassungFuer(s: Schritt, k: Pick<Kontext, 'neustart'> | null | undefined): Schritt {
  return k?.neustart ? neustartFassungen().get(s.id) ?? s : s;
}

/** Alle Schritte des Neustarts in ihrer Reihenfolge (für Wächter und Übersichten — wer welchen hat, sagt `schritteFuer`). */
export const neustartSchritte = (): Schritt[] => [...neustartFassungen().values()];

/**
 * Wer schaut (aus dem Konto, nie ein Name): Rolle (`inhaber` = Inhaber-Rechte, seit R9 jeder Inhaber; `haupt` = Haupt-Inhaber), ob das
 * Konto über eine Einladung kam (`eingeladen` — fehlt die Angabe, gilt: wer nicht Inhaber ist), Zahl der Konten, Zugang zu den
 * Privat-Finanzen (`finanzRecht` ≠ business, im Haushalt der Inhaber) und ob die Instanz einen Altbestand im Code hatte (Haupt-Inhaber
 * vor dem 09.10.2026 angelegt, keine Demo — lib/onboarding-status.ts).
 */
export interface Kontext {
  inhaber: boolean; haupt?: boolean; eingeladen?: boolean; personen: number; privatFinanzen?: boolean; altbestand?: boolean;
  /** Die Instanz trägt die Marke des Neustarts (lib/onboarding-neustart.ts) — dann gilt der Neustart-Ablauf (`fassungFuer`), nie ein Altbestand. */
  neustart?: boolean;
}

/** Etappen-Reihenfolge (Etappe, dann die Reihenfolge der Fassung bzw. in SCHRITTE). */
const nachEtappe = (l: readonly Schritt[]): Schritt[] => l.map((s, i) => ({ s, i: s.reihe ?? (SCHRITTE.indexOf(s) >= 0 ? SCHRITTE.indexOf(s) : i) })).sort((a, b) => a.s.etappe - b.s.etappe || a.i - b.i).map(x => x.s);

/**
 * Die Schritte einer Ebene, nach Etappe sortiert (die Ebenen-Seiten filtern damit; wer welchen Schritt hat, sagt `schrittFuer`). Mit Kontext in
 * der Fassung dieser Instanz (Neustart: Etappe, Nummer, Gruppe aus `fassungFuer`) — ohne Kontext die Grundfassung aller Schritte.
 */
export function schritteDerEbene(ebene: Ebene, k?: Kontext | null): Schritt[] {
  return nachEtappe(SCHRITTE.filter(s => s.ebene === ebene).map(s => fassungFuer(s, k ?? null)));
}

/**
 * Ein Schritt im Privat-Bereich: Privat-Finanzen, Gesundheit, Familie oder ausdrücklich `privat` (eigene Ziele). Instanz-Schritte nie (die richtet
 * ein Inhaber ein). Ein Konto „nur Business“ (`Kontext.privatFinanzen === false`, dieselbe Konto-Sicht wie überall) hat ihn nicht. Rein.
 */
export function istPrivatSchritt(s: Pick<Schritt, 'privatFinanzen' | 'privat' | 'modul' | 'ebene'>): boolean {
  if (s.privatFinanzen || s.privat) return true;
  return s.ebene !== 'instanz' && (modulVon(s) === 'gesundheit' || modulVon(s) === 'familie');
}

/** Sieht diese Person den Schritt überhaupt (Privat-Bereich, Altbestand, Neustart)? Gilt auch auf den Ebenen-Seiten. */
export function sichtbarFuer(s: Schritt, k: Kontext | null): boolean {
  if (k && k.privatFinanzen === false && istPrivatSchritt(s)) return false;
  if (s.nurNeustart && !k?.neustart) return false;
  if (k?.neustart && !neustartFassungen().has(s.id)) return false; // entfällt im Neustart (Altbestand, ersetzte Schritte)
  return !s.nurAltbestand || !!k?.altbestand;
}

/** Betrifft der Schritt diese Person (sichtbar + Rolle + Zahl der Konten)? — dieselbe Regel für Zählung und POST. */
export function schrittFuer(s: Schritt, k: Kontext | null): boolean {
  if (!sichtbarFuer(s, k)) return false;
  if (s.nurMitMehreren && k && k.personen < 2) return false;
  if (s.nurEingeladen) return !!k && (k.eingeladen ?? !k.inhaber);
  if (s.ebene === 'ich') return !!k;
  return s.nurInhaber ? !!k?.inhaber : true;
}

/**
 * Die Schritte, die eine Person betreffen — Meine Einrichtung, Gemeinsames, beim Inhaber die Instanz — in Etappen-Reihenfolge und in der Fassung
 * dieser Instanz (`fassungFuer`; ohne Neustart die Schritte selbst).
 */
export function schritteFuer(k: Kontext | null): Schritt[] {
  return nachEtappe(SCHRITTE.filter(s => schrittFuer(s, k)).map(s => fassungFuer(s, k)));
}

/**
 * Der Zustand einer Person: Häkchen, Befunde (nur ja/nein + Zähler), alte Häkchen (`frueher`) und — B10 — die Schritte mit Prüfung, die schon
 * einmal grün waren (`gruen`: Kennung → Tag, festgehalten im Morgenlauf, nur die eigenen).
 */
export interface HakenZustand { erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, PruefBefund>; frueher?: string[]; gruen?: Record<string, string> }

/**
 * Getan? Mit Prüfung zählt der Befund: rot ist NIE getan (auch nicht mit Häkchen); grün ist getan — bei `bestaetigen` erst mit Häkchen.
 * Ohne Prüfung (oder ohne Befund für diese Person, oder ein „leerer“ Befund — es gibt nichts zu prüfen) zählt das Häkchen.
 * DIE Fertig-Regel — Fortschritt, „Als Nächstes“, Voraussetzungen, „zurückgefallen“, Heute-Karte und Datenbasis fragen nur sie.
 */
export function istFertig(s: Schritt, z: HakenZustand | null | undefined): boolean {
  if (!z) return false;
  const b = s.pruefung ? z.befunde[s.pruefung] : undefined;
  const hand = !!z.erledigt[s.id];
  if (b && !b.leer) return b.erfuellt && (!s.bestaetigen || hand);
  return hand;
}

/** Zählt erst, wenn getan: optionale und spätere Schritte (einzeln bis 16.10. bzw. „danach“). */
const zaehltErstWennGetan = (s: Schritt) => !!(s.optional || s.spaeter);

/**
 * Fortschritt über eine Schrittliste. „Als Nächstes“ ist der erste offene, zählende Schritt in Etappen-Reihenfolge, dessen Voraussetzungen
 * (`nach`, soweit sie in DIESER Liste stehen und zählen) getan sind — sonst der erste offene. Voraussetzungen sperren nie, sie ordnen nur.
 * `alle` (Heute-Karte, Neustart): auch die späteren Schritte zählen sofort mit — „fertig“ heißt dann: jeder nicht-optionale Schritt getan;
 * „Als Nächstes“ nimmt trotzdem zuerst den Kern (alles außer „später“). Ohne `alle` bleibt es bei „Späteres zählt erst, wenn getan“.
 */
export function fortschrittVon(schritte: readonly Schritt[], z: HakenZustand | null | undefined, o: { alle?: boolean } = {}): { fertig: number; gesamt: number; offeneMinuten: number; naechster: Schritt | null } {
  const sortiert = nachEtappe(schritte);
  const zaehlen = sortiert.filter(s => (o.alle ? !s.optional : !zaehltErstWennGetan(s)) || istFertig(s, z));
  const offen = zaehlen.filter(s => !istFertig(s, z));
  const offenIds = new Set(offen.map(s => s.id));
  const bereit = (l: readonly Schritt[]) => l.find(s => !(s.nach ?? []).some(id => offenIds.has(id)));
  const vorn = offen.filter(s => !s.spaeter);
  const naechster = bereit(vorn) ?? vorn[0] ?? bereit(offen) ?? offen[0] ?? null;
  return { fertig: zaehlen.length - offen.length, gesamt: zaehlen.length, offeneMinuten: offen.reduce((n, s) => n + s.minuten, 0), naechster };
}

/** Restzeit als Text — EINE Stelle für Übersicht und Heute-Widget, deutsche Zahlform („rund 8,8 Std.“, nie „8.8“). */
export function restzeitText(minuten: number): string {
  if (minuten < 60) return `${minuten} Min.`;
  return `rund ${(Math.round(minuten / 6) / 10).toLocaleString('de-DE')} Std.`;
}

/**
 * Offene Voraussetzungen eines Schritts für diese Person (Hinweis „erst …“): nur Schritte, die die Person überhaupt sieht (Privat-Finanzen,
 * Altbestand) und die bei ihr nicht entfallen (eine Person) — Instanz-Schritte der Inhaber zählen mit (alle sehen ihren Stand). Fertig nur
 * über `istFertig`.
 */
export function offeneVoraussetzungen(s: Schritt, k: Kontext | null, z: HakenZustand | null | undefined): Schritt[] {
  return (s.nach ?? []).map(schrittMitId).filter((v): v is Schritt =>
    !!v && sichtbarFuer(v, k) && !(v.nurMitMehreren && k && k.personen < 2) && !(v.nurEingeladen && !schrittFuer(v, k)))
    .map(v => fassungFuer(v, k)).filter(v => !istFertig(v, z));
}

/**
 * B10 „dauerhafte Ampel“: Schritte mit Prüfung, die schon einmal grün waren (`z.gruen`, Morgenlauf) und jetzt rot sind — „braucht dich“.
 * Ein leerer Befund ist nie zurückgefallen (nichts zu prüfen), ein fehlender auch nicht (kein Befund für diese Person). Rein.
 */
export function zurueckgefallen(schritte: readonly Schritt[], z: HakenZustand | null | undefined): Schritt[] {
  if (!z?.gruen) return [];
  return nachEtappe(schritte).filter(s => {
    const b = s.pruefung ? z.befunde[s.pruefung] : undefined;
    return !!b && !b.leer && !b.erfuellt && !!z.gruen![s.id] && !istFertig(s, z);
  });
}

/** Modul eines Schritts (fehlt = Grundlage). */
export const modulVon = (s: Pick<Schritt, 'modul'>): Modul => s.modul ?? 'grundlage';
/** Nur die Schritte der Grundlage und der gegebenen Module (A1.10: eine Instanz „nur Markttraktion“) — ohne Angabe alle. */
export function nurModule(schritte: readonly Schritt[], module?: readonly Modul[] | null): Schritt[] {
  if (!module) return [...schritte];
  return schritte.filter(s => modulVon(s) === 'grundlage' || module.includes(modulVon(s)));
}

/** Wie steht ein Bereich in der Datenbasis (B8)? Aus EINEM Befund: gepflegt · leer · veraltet · offen; ohne Befund „unbekannt“. */
export type DatenStand = 'gepflegt' | 'leer' | 'veraltet' | 'offen' | 'unbekannt';
export function datenStandVon(b: PruefBefund | null | undefined): DatenStand {
  if (!b) return 'unbekannt';
  if (b.leer) return 'leer';
  if (b.erfuellt) return 'gepflegt';
  return b.veraltet ? 'veraltet' : 'offen';
}

export type Gruppe = 'freitag' | 'samstag' | 'spaeter';
/** Wann ein Schritt dran ist: Freitag (Etappe 0 am Server), Samstag-Kern, einzeln bis 16.10. */
export const gruppeVon = (s: Schritt): Gruppe => (s.samstag ? 'samstag' : s.spaeter ? 'spaeter' : s.etappe === 0 ? 'freitag' : 'spaeter');
export const GRUPPEN: Record<Gruppe, { titel: string; satz: string }> = {
  freitag: { titel: 'Freitag · am Server', satz: 'Etappe 0 am Abend des Uploads — nur der Inhaber.' },
  samstag: { titel: 'Samstag', satz: 'Der Kern an einem langen Tag — von oben nach unten.' },
  spaeter: { titel: 'Einzeln bis 16.10.', satz: 'Zählt erst, wenn getan — nach und nach, jede Person und gemeinsam.' },
};
/** Dieselben drei Gruppen ohne Wochentage und Datum (Instanz ohne Altbestand, Rundgang 09.10.). Die Zuordnung `gruppeVon` bleibt. */
export const GRUPPEN_ALLGEMEIN: Record<Gruppe, { titel: string; satz: string }> = {
  freitag: { titel: 'Zuerst · am Server', satz: 'Etappe 0 — nur die Inhaber, bevor die anderen loslegen.' },
  samstag: { titel: 'Der Kern', satz: 'Das Wichtigste in einem Zug — von oben nach unten.' },
  spaeter: { titel: 'Nach und nach', satz: 'Zählt erst, wenn getan — in eigenem Tempo, jede Person und gemeinsam.' },
};
/** Die drei Gruppen im Neustart: zuerst der Server, dann der Kern (Zugang + alles eingeben), danach Schnittstellen, Agenten, Abschluss. */
export const GRUPPEN_NEUSTART: Record<Gruppe, { titel: string; satz: string }> = {
  freitag: { titel: 'Zuerst · am Server', satz: 'Etappe 0 — nur die Inhaber; auf einem bestehenden Server ist das meiste schon erledigt, die Prüfungen zeigen es.' },
  samstag: { titel: 'Der Kern', satz: 'Erst Zugang und Sicherheit, dann alles eingeben — jede Person für sich und gemeinsam, von oben nach unten.' },
  spaeter: { titel: 'Danach', satz: 'Schnittstellen, Agenten und Abschluss — wenn alles eingegeben ist. Zählt mit: die Karte auf Heute bleibt, bis alles steht.' },
};
/** Die Gruppen-Namen für diese Instanz (`neustart` vor `altbestand`). Rein. */
export const gruppenFuer = (altbestand: boolean, neustart = false): Record<Gruppe, { titel: string; satz: string }> => (neustart ? GRUPPEN_NEUSTART : altbestand ? GRUPPEN : GRUPPEN_ALLGEMEIN);

/** Minuten des Kerns (Samstag bzw. im Neustart „Der Kern“) für eine Person, ohne optionale — für den Wächter „≈ 8 h“ und die Schätzung. */
export const samstagMinuten = (k: Kontext): number => schritteFuer(k).filter(s => s.samstag && !s.optional).reduce((n, s) => n + s.minuten, 0);

/** Wer den Schritt macht — für den Chip. */
export function werText(s: Schritt): string {
  if (s.server) return 'am Server · Inhaber';
  if (s.nurInhaber) return 'Inhaber';
  if (s.ebene === 'ich') return s.nurEingeladen ? 'neue Person' : 'jede Person';
  return 'gemeinsam';
}

/**
 * Alte Häkchen (bis 08.10.) → neue Schritte. Die früheren Spuren trugen den Speichernamen einer Person als Präfix (`<speicher>-<schritt>`);
 * diese Häkchen stehen im gemeinsamen Bestand und bleiben dort unangetastet liegen (nichts geht verloren). Die Tabelle unten übersetzt nur
 * diese alten Kennungen (Altbestand — keine neuen Namen im Code). Gegenprüfung 08.10. spät: viele neue Schritte bedeuten mehr
 * als die alten (Kontostände ab dem Stichtag, Kartei bereinigt, Agenten bewusst gesetzt …) — deshalb zählt ein altes Häkchen NIE als
 * getan. Bei Schritten ohne Prüfung und ohne Stichtagsbezug zeigt die Einrichtung „früher abgehakt — bitte bestätigen“ (`frueherErlaubt`;
 * persönliche nur der Person mit genau diesem Speichernamen, lib/onboarding-haken.ts); bei allen anderen entscheidet die Prüfung bzw. ein
 * neues Häkchen.
 */
export const ALT_ZU_NEU: Readonly<Record<string, string>> = {
  updates: 'regeln',
  'kevin-zwei-faktor': 'ich-zwei-faktor', 'kevin-kalender': 'ich-icloud', 'kevin-postfach': 'ich-postfaecher',
  'kevin-kontakte': 'kartei', 'kevin-aufgaben': 'ich-aufgaben', 'kevin-kompass': 'kompass', 'kevin-fokus': 'meilensteine-fokus',
  'kevin-ziele': 'zahlenziele', 'kevin-gesundheit': 'ich-gesundheit', 'kevin-agenten': 'agenten', 'kevin-zoe': 'ich-zoe',
  'malin-einladung': 'zweite-einladung', 'malin-zwei-faktor': 'ich-zwei-faktor', 'malin-sicht': 'ich-sicht', 'malin-gesundheit': 'ich-gesundheit',
  'malin-kalender': 'ich-icloud', 'malin-postfach': 'ich-postfaecher', 'malin-whoop': 'ich-whoop', 'malin-rundgang': 'ich-rundgang',
  'malin-konten': 'kontostaende', 'malin-posten': 'offene-posten', 'malin-aufgaben': 'ich-aufgaben', 'malin-bauplan': 'ich-bauplan', 'malin-zoe': 'ich-zoe',
};
/** Darf ein altes Häkchen als „früher abgehakt — bitte bestätigen“ erscheinen? Nie bei Prüfung oder Stichtagsbezug. */
export const frueherErlaubt = (s: Pick<Schritt, 'pruefung' | 'stichtag'>): boolean => !s.pruefung && !s.stichtag;
/**
 * Der Speichername hinter einem alten Häkchen (`<speicher>-<schritt>` → `<speicher>`) — nur für Kennungen aus `ALT_ZU_NEU`, sonst null
 * (auch der gemeinsame Altbestand wie `updates`). Ein altes persönliches Häkchen gilt („früher abgehakt — bitte bestätigen“) einmalig
 * NUR für die Person mit genau diesem Speichernamen (lib/onboarding-haken.ts) — Regel aus dem Präfix, kein Name im Code.
 */
export const altePerson = (altId: string): string | null => (ALT_ZU_NEU[altId] ? /^([a-z0-9]+)-[a-z]/.exec(altId)?.[1] ?? null : null);

// ── Datenkarte (ONBOARDING_PLAN.md A3): welche Zahl wohin, bis die Doppelungen weg sind ─────────────────────────────────────────
export interface DatenkartenZeile {
  /** Kennung (für `Schritt.datenOrt`) — nie ändern. */ id: string; fakt: string; hier: string; nicht: string; href?: string; etappe: number;
  /** Fassung für eine Instanz ohne Altbestand (ohne Stichtag/Planbeginn der gewachsenen Instanz) — gelesen nur über `datenkarteFuer`. */
  allgemein?: { fakt?: string; hier?: string };
}
export const DATENKARTE: DatenkartenZeile[] = [
  { id: 'konto-stichtag', fakt: 'Kontostand einer Gesellschaft am Stichtag (01.10.2026)', hier: '0-Punkt', nicht: 'Finanzplanung (Posten „Konto“), Startwerte der Planung', href: WEG.eroeffnung(), etappe: 3, allgemein: { fakt: 'Kontostand einer Gesellschaft am Stichtag' } },
  { id: 'konto-danach', fakt: 'Kontostand einer Gesellschaft danach', hier: 'Konten-Register: Liquidität › Kontostände (Konto, Stand mit Datum ab 02.10.)', nicht: 'Einstellungen › Stammdaten › Konten', href: WEG.kontostaende(), etappe: 3, allgemein: { hier: 'Konten-Register: Liquidität › Kontostände (Konto, Stand mit Datum nach dem Stichtag)' } },
  { id: 'konto-privat', fakt: 'Kontostand privat', hier: 'Konten-Register: Privat › Konten & Buchungen › Konten (die Finanzplanung liest daraus)', nicht: 'Finanzplanung (Posten „Konto“) — vorhandene Stände einmal übernehmen', href: WEG.kontenRegister('privat'), etappe: 5 },
  { id: 'posten-stichtag', fakt: 'Offene Posten am Stichtag', hier: '0-Punkt (auch Rechnungen mit Datum vor dem Stichtag)', nicht: 'Finanzplanung › Verpflichtungen', href: WEG.eroeffnung(), etappe: 3 },
  { id: 'posten-danach', fakt: 'Offene Posten danach', hier: 'Rechnungen & Zahlungen', nicht: 'Finanzplanung › Verpflichtungen', href: WEG.rechnungen(), etappe: 3 },
  { id: 'monatszahlen', fakt: 'Monatszahlen Business', hier: 'Monatsabschluss ab Oktober 2026 (Januar bis September nicht nachtragen)', nicht: 'alte Monatswerte im Controlling', href: WEG.abschluss(), etappe: 3, allgemein: { hier: 'Monatsabschluss ab dem Stichtag (frühere Monate nicht nachtragen)' } },
  { id: 'koepfe', fakt: 'Köpfe und Beratertage je Gesellschaft', hier: 'Business › Einstellungen', nicht: 'Kapazität (rechnet je Person, nicht je Firma)', href: WEG.einstellungen(), etappe: 3 },
  { id: 'firmendaten', fakt: 'Firmendaten, Bank', hier: 'Unternehmen › Steckbrief und Absender', nicht: 'Einstellungen › Stammdaten › Firmen und Konten', href: WEG.unternehmen(), etappe: 3 },
  { id: 'beteiligungen', fakt: 'Beteiligungen an fremden Firmen', hier: 'Unternehmen › Beteiligungen', nicht: '–', href: WEG.unternehmen(), etappe: 3 },
  { id: 'selbst-jan-sep', fakt: 'Selbstständigkeit Januar bis September', hier: 'Finanzplanung › Selbstständigkeit', nicht: 'Privat-Monatsabschluss derselben Monate', href: WEG.finanzplanung('privat', 'selbst'), etappe: 5, allgemein: { fakt: 'Selbstständigkeit: Monate vor dem Planbeginn' } },
  { id: 'est-voraus', fakt: 'Vorauszahlungen Einkommensteuer der Selbstständigkeit', hier: 'Finanzplanung › Selbstständigkeit', nicht: 'Steuer-Einstellungen (zählen mit Finanzplanung nicht)', href: WEG.finanzplanung('privat', 'selbst'), etappe: 5 },
  { id: 'steuerparameter', fakt: 'Steuerparameter der Selbstständigkeit', hier: 'Finanzplanung › Zahnrad', nicht: 'Steuer-Modul (liest bei vorhandener Finanzplanung daraus)', href: WEG.finanzplanung('privat'), etappe: 5 },
  { id: 'produkte', fakt: 'Produkte und Preise', hier: 'Mandate & Unternehmen › Produkte', nicht: 'Rechnungen › Karte „Produkte“', href: WEG.produkt(), etappe: 4 },
  { id: 'jahresziel', fakt: 'Jahresziel Umsatz', hier: 'Planung › Jahr — dieselbe Zahl in Controlling und Business-Einstellungen', nicht: '–', href: WEG.jahr(), etappe: 5 },
  { id: 'arbeitszeit', fakt: 'Arbeitszeit', hier: 'Wochenvorlage (Planung › Routinen)', nicht: 'Kalender-Arbeitsfenster, Beratertage', href: WEG.routinen(), etappe: 5 },
  { id: 'arbeitszeit-aussen', fakt: 'Arbeitszeit außerhalb (fremder Kalender)', hier: 'Blöcke bzw. Abwesenheit (Schritt 2.6)', nicht: '–', href: WEG.routinen(), etappe: 2 },
  { id: 'urlaub', fakt: 'Urlaub', hier: 'Kalender „Abwesend“', nicht: 'Ausnahme in der Kapazität', href: WEG.kalender(), etappe: 5 },
  { id: 'kosten-business', fakt: 'Laufende Kosten der Gesellschaften (Software, Miete, Personal …)', hier: 'Finanzplanung › Business (Kosten-Bausteine)', nicht: 'Rechnungen & Zahlungen (nur echte Rechnungen), Monatsabschluss (nur das Ist)', href: WEG.finanzplanung('business'), etappe: 5 },
  { id: 'privat-ist', fakt: 'Budget, Schulden, Fixkosten und Ist privat', hier: 'Haushalt (Privat › Konten & Buchungen) — er führt das Ist', nicht: 'Finanzplanung (liest ab Phase 1 aus dem Haushalt)', href: WEG.privat('fixkosten'), etappe: 3 },
  { id: 'ruecklage', fakt: 'Rücklage privat', hier: 'Privat-Index', nicht: '–', href: WEG.privatIndex('ruecklage'), etappe: 3 },
  { id: 'geburtstage', fakt: 'Geburtstage', hier: 'Familie (privat) bzw. CRM (geschäftlich)', nicht: '–', href: WEG.familie(), etappe: 6 },
  { id: 'kennungen', fakt: 'Persönliche Kennungen (Steuer-ID, SV-Nummer)', hier: 'vorerst nirgends', nicht: 'Einstellungen › Stammdaten', etappe: 3 },
  { id: 'vertraege', fakt: 'Verträge', hier: 'Gesellschaften: Unternehmen › Verträge · privat: noch kein Ort', nicht: '–', href: WEG.unternehmen(), etappe: 3 },
];

/** Eine Zeile der Datenkarte per Kennung (null = unbekannt). */
export const datenkarteMitId = (id: string): DatenkartenZeile | null => DATENKARTE.find(d => d.id === id) ?? null;
/** Die Datenkarte für diese Instanz — ohne Altbestand die neutrale Fassung jeder Zeile (`allgemein`). Rein. */
export const datenkarteFuer = (altbestand: boolean): DatenkartenZeile[] => (altbestand ? DATENKARTE : DATENKARTE.map(({ allgemein, ...d }) => ({ ...d, ...(allgemein ?? {}) })));

/** Die drei Zonen — die Abmachung, damit Weiterbauen und Arbeiten sich nicht in die Quere kommen. */
export const ZONEN = [
  {
    farbe: 'gruen', titel: 'Grün — immer sicher',
    satz: 'Daten in der Oberfläche eintragen. Sie liegen auf dem Server und überstehen jedes Update — auch während eines Updates läuft die alte Version weiter.',
    beispiele: ['Aufgaben anlegen und abhaken', 'Rechnungen und Zahlungen pflegen', 'Kontostände, Journal, Ernährung', 'Mit ZOE reden', 'Problem oder Idee melden'],
  },
  {
    farbe: 'gelb', titel: 'Gelb — nicht während „Update läuft“',
    satz: 'Alles, was größere Mengen auf einmal schreibt. Zeigt Zusammenarbeit „Update läuft“, kurz warten — das Ausrollen dauert etwa fünf Minuten.',
    beispiele: ['Kontakte importieren', 'Finanzplanung hochladen oder ersetzen', '„Neu anfangen“ in Aufgaben/Planung', 'Agenten-Autonomie ändern'],
  },
  {
    farbe: 'rot', titel: 'Rot — nur der Inhaber',
    satz: 'Code und Server. Gebaut wird lokal auf „entwicklung“; online geht nur „main“, und nur auf ausdrückliches Wort des Inhabers.',
    beispiele: ['Code ändern (lokal, Stand „entwicklung“)', 'Update ausrollen (Stand „main“)', 'Schlüssel und Einstellungen am Server', 'Sicherung zurückspielen'],
  },
] as const;
