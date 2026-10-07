// ─── Postfächer je Person — Typen (rein, client-sicher, Inbox 2, 06.10.2026) ──────────────────────────────────
// Kevin 06.10.: „Privat wird nur Mail benötigt. KD Ventures hat Apple Mail und MAKE Innovation Google … dann müssen wir nur daraus
// alles ableiten können.“ — Jede Person trägt IHRE Postfächer ein (Register `postfaecher--<person>`); jedes Postfach hat genau EINEN
// Bereich: `privat` oder eine Gesellschaft (feste Kennung kdc/kdv/ug oder `g-…` aus dem Gesellschafts-Register). Nichts ist auf
// Personen oder Firmen verdrahtet — ein Kunde trägt seine eigenen Postfächer ein (Plattform-Regel „verkaufbar“).
//
// Quellen: `gmail` (Google-Verbindung der Person, lib/gmail/*) · `imap` (beliebiger Anbieter mit IMAP + SMTP, lib/postfach/*) ·
// `whatsapp` (vorbereitet: Cloud API mit eigener Business-Nummer, Adapter folgt — INBOX_KONZEPT.md Abschnitt 8).
// Zugangsdaten stehen NIE hier: sie liegen getrennt im Bestand `postfach-zugang--<person>` (Server, verschlüsselte Hülle) und gehen
// nie an den Browser.

export const QUELLEN = ['gmail', 'imap', 'whatsapp'] as const;
export type Quelle = typeof QUELLEN[number];
export const istQuelle = (v: unknown): v is Quelle => (QUELLEN as readonly string[]).includes(v as string);

/** Anbieter-Voreinstellungen (lib/postfach/anbieter.ts). `demo` gibt es nur in einer Demo-Instanz (MAKE_OS_DEMO=1). */
export const ANBIETER = ['icloud', 'ionos', 'eigen', 'demo'] as const;
export type Anbieter = typeof ANBIETER[number];
export const istAnbieter = (v: unknown): v is Anbieter => (ANBIETER as readonly string[]).includes(v as string);

export interface ServerAdresse {
  host: string;
  port: number;
  /** IMAP: TLS ab dem ersten Byte (993). SMTP: `ssl` = 465, `starttls` = 587. */
  sicherheit: 'ssl' | 'starttls';
}

/** Die Ordner im Postfach (IMAP-Pfade) — beim Prüfen gefunden (SPECIAL-USE, sonst bekannte Namen). */
export interface Ordner {
  posteingang: string;
  gesendet?: string;
  archiv?: string;
}

/**
 * Ein Postfach im Register — ohne Zugangsdaten. `bereich` = `privat` | Gesellschaftskennung | `g-…`; `null` nur bei einem Gmail-Postfach,
 * das verbunden, aber noch keinem Bereich zugeordnet ist (es erscheint dann nur unter „Alle“, nie in einem Bereich).
 */
export interface Postfach {
  id: string;
  quelle: Quelle;
  bereich: string | null;
  /** Wie das Postfach in der Inbox heißt (z. B. „Privat · iCloud“). */
  anzeigename: string;
  /** Absenderadresse (klein). Bei Gmail die Adresse der Google-Verbindung (nur serverseitig gefüllt, ausgeliefert maskiert). */
  adresse: string;
  /** Name im Absender (`Name <adresse>`). */
  absenderName?: string;
  /** Signatur, die beim Antworten unten im Editor steht (sichtbar, änderbar). */
  signatur?: string;
  anbieter?: Anbieter;
  imap?: ServerAdresse;
  smtp?: ServerAdresse;
  /** Anmeldename (IMAP; SMTP nimmt `smtpBenutzer` oder diesen). Kein Geheimnis, aber nur serverseitig nötig. */
  benutzer?: string;
  smtpBenutzer?: string;
  ordner?: Ordner;
  /** Bietet der Server IMAP IDLE an (beim Prüfen gemessen)? */
  idle?: boolean;
  angelegtAm: string;
  geaendertAm?: string;
}

/** Was der Browser über ein Postfach erfährt — nie Passwort, nie Anmeldename, Adresse nur der Person selbst (eigene Daten). */
export interface PostfachOeffentlich {
  id: string;
  quelle: Quelle;
  bereich: string | null;
  bereichName: string;
  anzeigename: string;
  adresse: string;
  absenderName?: string;
  signatur?: string;
  anbieter?: Anbieter;
  zustand: PostfachZustand;
}

/** Zustand der Verbindung — für die Postfach-Leiste (Punkt) und den HOI (nur Zähler). */
export interface PostfachZustand {
  /** `aktuell` · `verzoegert` (> 30 Min. seit dem letzten gelungenen Abgleich) · `anmeldung` (Zugang abgelehnt → „Verbindung erneuern“) ·
   *  `fehler` (Netz/Server, wird wiederholt) · `neu` (noch nie abgeglichen) · `aus` (Quelle nicht eingerichtet, z. B. Google fehlt) ·
   *  `vorbereitet` (WhatsApp: Adapter folgt). */
  stufe: 'aktuell' | 'verzoegert' | 'anmeldung' | 'fehler' | 'neu' | 'aus' | 'vorbereitet';
  /** Letzter gelungener Abgleich (ISO). */
  at?: string;
  vorMin?: number | null;
  fehler?: string;
  idle?: boolean;
  nachrichten?: number;
}

/** Grenzen — nie still überschritten (Datenschicht-Regel „ablehnen statt abschneiden“). */
export const POSTFACH_GRENZEN = {
  /** Postfächer je Person. */
  jePerson: 12,
  anzeigename: 80,
  absenderName: 120,
  signatur: 2000,
  host: 253,
  benutzer: 254,
  passwort: 512,
  /** Erstabgleich: so viele Tage zurück (wie Gmail). */
  erstTage: 30,
  /** Nachrichten im Spiegel je Postfach. */
  koepfeMax: 1500,
  /** Nachrichten, die ein Lauf höchstens nachlädt — der Rest folgt im nächsten Lauf. */
  proLauf: 300,
  /** So viel einer Nachricht wird geholt (Kopf + Text, ohne große Anhänge). */
  quelleMax: 256 * 1024,
  /** Anhang-Download (Byte). */
  anhangMax: 25 * 1024 * 1024,
} as const;

export const PERSON_OK = /^[a-z0-9-]{1,40}$/;
/** Postfach-Kennung: `pf-<uuid>` (IMAP/WhatsApp) bzw. `gmail` (die eine Google-Verbindung der Person). */
export const POSTFACH_ID = /^(gmail|pf-[0-9a-f-]{36})$/;
export const GMAIL_POSTFACH = 'gmail';

/** Bestandsnamen je Person (kein Sonderfall für eine Person). */
export const registerName = (person: string) => `postfaecher--${person}`;
export const zugangName = (person: string) => `postfach-zugang--${person}`;
export const imapStandName = (person: string) => `imap-stand--${person}`;
export const imapTextName = (person: string) => `imap-text--${person}`;

/** Bereich als Wort für die Oberfläche: `privat` → „Privat“, sonst der Name aus der Liste der Gesellschaften (Aufrufer reicht sie). */
export function bereichName(bereich: string | null, namen: Readonly<Record<string, string>>): string {
  if (!bereich) return 'Ohne Bereich';
  if (bereich === 'privat') return 'Privat';
  return namen[bereich] ?? bereich;
}
