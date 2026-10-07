// ─── Postfächer — Anbieter-Voreinstellungen und Anleitungen (rein, client-sicher, 06.10.2026) ─────────────────────
// Belegt in research/inbox/FAKTEN_WHATSAPP_IMAP.md (Primärquellen, 06.10.):
//   iCloud  IMAP imap.mail.me.com:993 (SSL) · SMTP smtp.mail.me.com:587 (STARTTLS) · app-spezifisches Passwort PFLICHT (Zwei-Faktor
//           nötig, höchstens 25, ein Wechsel des Apple-Passworts macht ALLE ungültig) · IMAP-Benutzer = Teil vor dem @, SMTP = volle
//           Adresse · 1.000 Mails/Tag, „primarily for personal use“ (nur 1:1)
//   IONOS   IMAP imap.ionos.de:993 (SSL) · SMTP smtp.ionos.de:465 (SSL) bzw. 587 (STARTTLS) · Benutzer = volle Adresse · Passwort des
//           Postfachs · seit 29.01.2024 nur Absender derselben Domain · IDLE gemessen
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
export const anbieterFuerFormular = (demo: boolean): Anbieter[] => (demo ? ['demo', 'icloud', 'ionos', 'eigen'] : ['icloud', 'ionos', 'eigen']);

/** Anbieter aus der Adresse erraten (nur Vorauswahl): @icloud.com/@me.com/@mac.com → iCloud. Rein. */
export function anbieterRaten(adresse: string): Anbieter | null {
  const d = volle(adresse).split('@')[1] ?? '';
  if (/^(icloud|me|mac)\.com$/.test(d)) return 'icloud';
  return null;
}

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
