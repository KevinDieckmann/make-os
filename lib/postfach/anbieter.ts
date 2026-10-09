// ─── Postfächer — Anbieter-Voreinstellungen und Anleitungen (rein, client-sicher, 06.10.2026) ─────────────────────
// Belegt in research/inbox/FAKTEN_WHATSAPP_IMAP.md (Primärquellen, 06.10.):
//   iCloud  IMAP imap.mail.me.com:993 (SSL) · SMTP smtp.mail.me.com:587 (STARTTLS) · app-spezifisches Passwort PFLICHT (Zwei-Faktor
//           nötig, höchstens 25, ein Wechsel des Apple-Passworts macht ALLE ungültig) · IMAP-Benutzer = Teil vor dem @, SMTP = volle
//           Adresse · 1.000 Mails/Tag, „primarily for personal use“ (nur 1:1)
//   IONOS   IMAP imap.ionos.de:993 (SSL) · SMTP smtp.ionos.de:465 (SSL) bzw. 587 (STARTTLS) · Benutzer = volle Adresse · Passwort des
//           Postfachs · seit 29.01.2024 nur Absender derselben Domain · IDLE gemessen
//   Google  (09.10., Kundenpostfächer; research/inbox/KUNDENPOSTFAECHER.md) IMAP imap.gmail.com:993 (SSL Pflicht) · SMTP smtp.gmail.com:465
//           (SSL) bzw. 587 (STARTTLS) — https://developers.google.com/workspace/gmail/imap/imap-smtp · App-Passwort nur mit 2-Schritt-
//           Bestätigung, wird bei jedem Wechsel des Google-Passworts widerrufen — https://support.google.com/accounts/answer/185833 ·
//           Workspace: der Admin muss IMAP erlauben („Enable IMAP access for all users“ + „Allow any mail client“; Clients ohne OAuth nur
//           dann) — https://knowledge.workspace.google.com/admin/sync/turn-pop-and-imap-on-or-off-for-users · seit 14.03.2025 kein normales
//           Passwort mehr für IMAP/SMTP, App-Passwörter sind die genannte Ausnahme —
//           https://knowledge.workspace.google.com/admin/sync/transition-from-less-secure-apps-to-oauth · Benutzer = volle Adresse (Annahme,
//           üblich; Google nennt es auf den Seiten oben nicht wörtlich) · Gmail legt über SMTP Gesendetes selbst in „Gesendet“ ab (Annahme)
//   Microsoft 365 / Exchange Online: Basic-Anmeldung für IMAP ist in allen Mandanten abgeschaltet und nicht wieder einschaltbar —
//           https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online
//           → KEINE Voreinstellung (es ginge nur mit OAuth), nur der ehrliche Hinweis `NICHT_MOEGLICH` im Formular.
// „Eigener Anbieter“ trägt Server und Ports selbst ein. `demo` gibt es nur in der Demo-Instanz (erfundene Post, kein Netz).

import type { Anbieter, ServerAdresse } from './typen';

export interface Voreinstellung {
  anbieter: Anbieter;
  name: string;
  imap?: ServerAdresse;
  smtp?: ServerAdresse;
  /** IMAP-Anmeldename aus der Adresse. */
  imapBenutzer: (adresse: string) => string;
  smtpBenutzer: (adresse: string) => string;
  /** Wie das Passwort heißt (Beschriftung im Formular). */
  passwortWort: string;
  /** Anleitung in ganzen Sätzen (Schritte). */
  anleitung: string[];
  /** Link zur Stelle, an der man das Passwort bekommt (nur https, öffnet neu). */
  link?: { text: string; url: string };
  /** Hinweis zum Senden (Grenzen des Anbieters). */
  sendeHinweis?: string;
  /** Das Passwort vor dem Speichern/Prüfen säubern (Google zeigt App-Passwörter in Vierergruppen mit Leerzeichen). */
  passwortSauber?: (p: string) => string;
  /** Der Anbieter legt über SMTP Gesendetes selbst in „Gesendet“ ab — MAKE OS hängt dann keine zweite Kopie an. */
  legtGesendetAb?: boolean;
}

const volle = (a: string) => a.trim().toLowerCase();
const vorDemAt = (a: string) => volle(a).split('@')[0] ?? '';

export const VOREINSTELLUNGEN: Readonly<Record<Anbieter, Voreinstellung>> = {
  icloud: {
    anbieter: 'icloud', name: 'iCloud-Mail (Apple)',
    imap: { host: 'imap.mail.me.com', port: 993, sicherheit: 'ssl' },
    smtp: { host: 'smtp.mail.me.com', port: 587, sicherheit: 'starttls' },
    imapBenutzer: vorDemAt, smtpBenutzer: volle,
    passwortWort: 'App-spezifisches Passwort',
    anleitung: [
      'Apple verlangt für fremde Programme ein eigenes „App-spezifisches Passwort“ — dein Apple-Passwort funktioniert hier nicht.',
      'Öffne appleid.apple.com, melde dich an und wähle „Anmeldung und Sicherheit“ › „App-spezifische Passwörter“.',
      'Lege ein neues an (Name z. B. „MAKE OS Inbox“) und kopiere das Passwort im Format xxxx-xxxx-xxxx-xxxx hierher.',
      'Dafür muss die Zwei-Faktor-Authentifizierung an sein. Änderst du später dein Apple-Passwort, werden alle App-Passwörter ungültig — dann hier „Verbindung erneuern“.',
    ],
    link: { text: 'appleid.apple.com öffnen', url: 'https://appleid.apple.com' },
    sendeHinweis: 'iCloud ist für persönliche Post gedacht: höchstens 1.000 Mails am Tag, keine Rundschreiben — Antworten hier sind 1:1.',
  },
  google: {
    anbieter: 'google', name: 'Google Workspace / Gmail (App-Passwort)',
    imap: { host: 'imap.gmail.com', port: 993, sicherheit: 'ssl' },
    smtp: { host: 'smtp.gmail.com', port: 465, sicherheit: 'ssl' },
    imapBenutzer: volle, smtpBenutzer: volle,
    passwortWort: 'App-Passwort (16 Buchstaben)',
    anleitung: [
      'Für Postfächer in der Google-Domain eines Kunden (oder eine weitere Gmail-Adresse): MAKE OS liest über IMAP und sendet über SMTP — mit einem eigenen App-Passwort, nie mit dem normalen Google-Passwort.',
      'Melde dich mit der Adresse des Postfachs bei Google an und schalte unter „Sicherheit“ die Bestätigung in zwei Schritten ein (falls noch aus).',
      'Öffne myaccount.google.com/apppasswords (Link unten), gib einen Namen ein (z. B. „MAKE OS Inbox“) und tippe auf „Erstellen“. Kopiere die 16 Buchstaben hierher — die Leerzeichen dürfen mit.',
      'Fehlt die Seite „App-Passwörter“ oder klappt die Anmeldung nicht: Der Admin der Kundenfirma muss IMAP erlauben (Admin-Konsole › Apps › Google Workspace › Gmail › Endnutzerzugriff › „POP- und IMAP-Zugriff“ › IMAP für alle Nutzer an, „Beliebiger E-Mail-Client“) bzw. App-Passwörter nicht sperren. Das entscheidet der Kunde.',
      'Ändert jemand das Google-Passwort des Postfachs, widerruft Google alle App-Passwörter — dann hier „Verbindung erneuern“.',
    ],
    link: { text: 'myaccount.google.com/apppasswords öffnen', url: 'https://myaccount.google.com/apppasswords' },
    sendeHinweis: 'Gesendet wird über smtp.gmail.com mit der Adresse des Postfachs — nur 1:1-Antworten auf Klick, Gmail legt die Kopie selbst in „Gesendet“ ab.',
    passwortSauber: p => p.replace(/\s+/g, ''),
    legtGesendetAb: true,
  },
  ionos: {
    anbieter: 'ionos', name: 'IONOS',
    imap: { host: 'imap.ionos.de', port: 993, sicherheit: 'ssl' },
    smtp: { host: 'smtp.ionos.de', port: 465, sicherheit: 'ssl' },
    imapBenutzer: volle, smtpBenutzer: volle,
    passwortWort: 'Passwort des Postfachs',
    anleitung: [
      'Bei IONOS hat jede E-Mail-Adresse ein eigenes Passwort — das Passwort des Postfachs, nicht das deines IONOS-Kontos.',
      'Kennst du es nicht mehr: im IONOS-Kundenbereich unter „E-Mail“ die Adresse wählen und dort ein neues Passwort setzen.',
      'Gesendet wird über smtp.ionos.de — IONOS nimmt nur Absender derselben Domain an.',
    ],
    link: { text: 'IONOS-Hilfe: Serverdaten', url: 'https://www.ionos.de/hilfe/e-mail/allgemeine-themen/serverinformationen-fuer-imap-pop3-und-smtp/' },
  },
  eigen: {
    anbieter: 'eigen', name: 'Anderer Anbieter (IMAP)',
    imapBenutzer: volle, smtpBenutzer: volle,
    passwortWort: 'Passwort',
    anleitung: [
      'Die Serverdaten stehen in der Hilfe deines Anbieters („IMAP und SMTP“). Gelesen wird über IMAP mit TLS, gesendet über SMTP mit Anmeldung.',
      'Verlangt dein Anbieter Zwei-Faktor-Anmeldung, brauchst du meist ein eigenes App-Passwort.',
    ],
  },
  demo: {
    anbieter: 'demo', name: 'Demo-Postfach (erfunden)',
    imap: { host: 'imap.demo.example.invalid', port: 993, sicherheit: 'ssl' },
    smtp: { host: 'smtp.demo.example.invalid', port: 465, sicherheit: 'ssl' },
    imapBenutzer: volle, smtpBenutzer: volle,
    passwortWort: 'Passwort (beliebig, „falsch“ zeigt den Fehlerfall)',
    anleitung: ['Nur in der Demo-Instanz: erfundene Post, nichts verlässt den Rechner. Das Passwort „falsch“ zeigt, wie eine gescheiterte Anmeldung aussieht.'],
  },
};

/** Die Anbieter, die das Formular anbietet (Demo nur in der Demo-Instanz). */
export const anbieterFuerFormular = (demo: boolean): Anbieter[] => (demo ? ['demo', 'google', 'icloud', 'ionos', 'eigen'] : ['google', 'icloud', 'ionos', 'eigen']);

/** Anbieter aus der Adresse erraten (nur Vorauswahl): @icloud.com/@me.com/@mac.com → iCloud, @gmail.com/@googlemail.com → Google. Rein. */
export function anbieterRaten(adresse: string): Anbieter | null {
  const d = volle(adresse).split('@')[1] ?? '';
  if (/^(icloud|me|mac)\.com$/.test(d)) return 'icloud';
  if (/^(gmail|googlemail)\.com$/.test(d)) return 'google';
  return null;
}

/** Das Passwort so, wie es an den Anbieter geht (Voreinstellung säubert, sonst unverändert). Rein. */
export const passwortFuer = (anbieter: Anbieter, p: string): string => VOREINSTELLUNGEN[anbieter].passwortSauber?.(p) ?? p;

/**
 * Was heute NICHT geht — ehrlich im Formular statt eines Anbieters, der nie funktioniert. Microsoft 365 / Exchange Online nimmt IMAP
 * nur noch mit OAuth an (Basic-Anmeldung in allen Mandanten aus, Quelle im Kopf dieser Datei).
 */
export const NICHT_MOEGLICH: readonly { name: string; text: string }[] = [
  { name: 'Microsoft 365 / Outlook (Exchange Online)', text: 'Microsoft hat die Anmeldung mit Passwort für IMAP in allen Firmen-Mandanten abgeschaltet — ein Postfach dort ginge nur über eine Microsoft-Anmeldung (OAuth), die MAKE OS noch nicht hat. Ein Umweg wäre eine Weiterleitung an ein verbundenes Postfach — ob sie erlaubt ist, entscheidet der Admin des Kunden.' },
];

/** Hostname prüfen (kein Schema, kein Pfad, keine Leerzeichen, keine IP-Literale im lokalen Netz). Rein. */
export function hostOk(h: unknown): h is string {
  if (typeof h !== 'string' || !h || h.length > 253) return false;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(h)) return false;
  // Nie ins eigene Netz (Server-Anfragefälschung): localhost, .local, .internal und reine Ziffern-Adressen.
  if (/(^|\.)(localhost|local|internal|lan|home|intranet)$/i.test(h)) return false;
  if (/^\d+(\.\d+){3}$/.test(h)) return false;
  return true;
}

export const portOk = (p: unknown): p is number => Number.isInteger(p) && (p as number) > 0 && (p as number) < 65536;
