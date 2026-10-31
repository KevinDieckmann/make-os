// ─── Newsletter-Anmeldung über die Website — die Regeln (30.10., Branch `newsletter-anmeldung`, rein, getestet) ───────────────────────
// Kevin 30.10.: „einen Bereich, wo wir kostenlose Sachen anbieten … Newsletter: Anmeldung mit Double-Opt-in, der Versand bleibt Handarbeit“.
// Ablauf: öffentliche Seite /newsletter (E-Mail, Vorname freiwillig, Häkchen mit dem Einwilligungstext) → Bestätigungsmail mit Link
// `<Website>/newsletter#t=<token>` (Token NUR im Fragment, wie die Buchung) → Klick auf „Anmeldung bestätigen“ → Kontakt im CRM mit der
// Einwilligung „Newsletter“ und vollem Nachweis (Art. 7 Abs. 1 DSGVO: Zeitpunkt, wer, Wortlaut + Fassung, Beleg `newsletter:<nl-…>`) —
// genau das, was die Kanal-Ampel (lib/crm/recht.ts `kanalStatus`, lib/crm/einwilligung.ts `nachweisLuecken`) für „grün“ verlangt.
// Hier stehen nur die reinen Teile: Formen, Grenzen, Fristen, Einwilligungstext und seine Fassung, der Text der Bestätigungsmail, der
// Datenschutzhinweis, die Einwilligung für die Kartei und die Löschfrist. Server: lib/newsletter/speicher.ts (Bestände, Token) und
// lib/newsletter/server.ts (Anmelden, Bestätigen, CRM). Keine Namen, keine Marke im Code — die Instanz trägt sie ein.
// Hinweis, keine Rechtsberatung — Einwilligungstext, Hinweis und Mail einmal anwaltlich gegenlesen.

import type { Einwilligung } from '@/lib/make-one/crm';

/** Bestand der Anmeldungen (je Instanz) und der Einstellungen. */
export const ANMELDUNGEN = 'newsletter-anmeldungen';
export const EINSTELLUNGEN = 'newsletter-einstellungen';

/** Der Bestätigungslink gilt so viele Tage (danach neu anmelden). */
export const TOKEN_TAGE = 7;
/** Höchstens so viele Bestätigungsmails je Adresse und Berliner Tag — darüber geht nichts mehr raus (die Antwort bleibt gleich). */
export const MAILS_JE_TAG = 3;
/** Unbestätigte (und nicht übernommene) Anmeldungen fallen nach so vielen Tagen weg. */
export const FRIST_UNBESTAETIGT_TAGE = 30;
/** Höchstens so viele Anmeldungen gleichzeitig im Bestand — darüber nimmt die Seite keine neue an (nie gekürzt). */
export const ANMELDUNGEN_MAX = 20_000;

export const GRENZEN = { email: 160, vorname: 60, marke: 60, text: 600, verantwortlich: 300, link: 300 } as const;
/** Kennung einer Anmeldung: `nl-<uuid>` (lib/kennung.ts `neueKennung('nl')`). */
export const ID_OK = /^nl-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Token: 32 Zufallsbytes base64url (43 Zeichen) — steht nur in der Mail und im Fragment, gespeichert nur als SHA-256. */
export const TOKEN_OK = /^[A-Za-z0-9_-]{43}$/;
/** Vorsatz der Fassung des Einwilligungstexts (`newsletter-einwilligung-<n>`). */
export const FASSUNG_VORSATZ = 'newsletter-einwilligung-';

// ── Formen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface NewsletterAnmeldung {
  id: string;
  /** Adresse klein geschrieben (Schlüssel für die Grenze je Tag, Art. 15/17). */
  email: string;
  vorname?: string;
  /** SHA-256 des Tokens — nur solange die Anmeldung auf die Bestätigung wartet; mit der Bestätigung fällt er weg (einmalig). */
  tokenHash?: string;
  /** Letzte Anmeldung (ISO) — eine erneute Anmeldung derselben Adresse erneuert Token und Zeit. */
  angemeldet: string;
  /** Bis wann der Link gilt (ISO). */
  gueltigBis?: string;
  /** Wann die (letzte) Bestätigungsmail verschickt wurde (ISO). */
  mailGesendet?: string;
  /** Bestätigungsmails je Berliner Tag — höchstens `MAILS_JE_TAG`. */
  mails?: { tag: string; anzahl: number };
  /** Klartext eines Versand-Fehlers (ohne Adresse) — sieht nur der Haushalt. */
  versandFehler?: string;
  /** Bestätigt per Klick (ISO). */
  bestaetigt?: string;
  /** Der Wortlaut, dem die Person zugestimmt hat, und seine Fassung (Nachweis Art. 7 Abs. 1). */
  wortlaut: string;
  fassung: string;
  /** Adresse gesperrt (Werbesperre bzw. Sperrliste) — keine Bestätigungsmail, keine Einwilligung; nur zum Klären im Haushalt. */
  gesperrt?: 'werbesperre' | 'sperrliste';
  /** Übernahme ins CRM nach der Bestätigung — `abgelehnt` (Art. 18, Werbesperre, Sperrliste) bzw. `fehler` nie an den Gast. */
  crm?: { status: 'ok' | 'abgelehnt' | 'fehler'; am: string; kontaktId?: string; grund?: string };
}

export interface AnmeldungenBestand { anmeldungen: NewsletterAnmeldung[] }

export interface NewsletterEinstellungen {
  /** An/aus — kommt AUS; eingeschaltet wirkt es nur mit Absender, Verantwortlichem und Adresse der Website (`bereitGruende`). */
  aktiv: boolean;
  /** Absender-Postfach — ein Inhaber wählt eines SEINER Postfächer mit Business-Bereich (wie beim Formular „Angebot anfordern“). Diese Wahl ist
   *  seine Freigabe für die Bestätigungsmails; ohne Eintrag geht nie eine raus und die Anmeldung ist aus. */
  absender?: { person: string; postfach: string; gesetztAm: string };
  /** Name in Seite und Mail (z. B. die Marke der Website) — ohne Angabe die Firma der Instanz ohne Rechtsform. */
  marke?: string;
  /** Eigener Einwilligungstext — ohne Angabe die neutrale Vorgabe (`einwilligungVorgabe`). `{marke}` wird ersetzt. */
  einwilligungstext?: string;
  /** Zählt hoch, sobald sich der angezeigte Wortlaut ändert (Text oder Name) — steht an jeder Anmeldung und Einwilligung. */
  fassung: number;
  /** Adresse der Website, unter der /newsletter läuft (`https://…`, nur Ursprung) — ohne Angabe MAKE_OS_ADRESSE. */
  website?: string;
  /** Abweichung von Einstellungen › Datenschutz (sonst die Einrichtung der Instanz). */
  verantwortlich?: string;
  datenschutzLink?: string;
  geaendert?: string;
  geaendertVon?: string;
}

export const leereEinstellungen = (): NewsletterEinstellungen => ({ aktiv: false, fassung: 1 });

// ── Texte an den Gast (Seite und Schnittstelle — immer dieselben, egal was im Hintergrund geschieht) ──────────────────────────────

/** Die eine Antwort auf jede angenommene Anmeldung — bekannt, unbekannt, gesperrt oder eingeschränkt sind nicht zu unterscheiden. */
export const ANMELDUNG_TEXT = 'Fast geschafft: Bitte bestätigen Sie Ihre Anmeldung über den Link in der E-Mail, die wir Ihnen gerade geschickt haben.';
export const BESTAETIGT_TEXT = 'Angemeldet — danke für Ihre Bestätigung. Sie erhalten unseren Newsletter ab der nächsten Ausgabe.';
/** Unbekannt, schon benutzt, abgelaufen oder kaputt — derselbe Satz. */
export const LINK_UNGUELTIG = 'Dieser Link ist nicht (mehr) gültig. Haben Sie schon bestätigt, ist alles erledigt — sonst melden Sie sich einfach neu an.';

// ── Prüfen der Eingaben ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const EMAIL_OK = /^[^\s@<>"',;:()[\]\\]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/i;
/** Eine Adresse in der Form, die die Seite annimmt (klein geschrieben, ohne Leerzeichen) — sonst null. */
export function emailSauber(roh: unknown): string | null {
  if (typeof roh !== 'string') return null;
  const e = roh.normalize('NFC').trim().toLowerCase();
  return e.length <= GRENZEN.email && EMAIL_OK.test(e) ? e : null;
}

/**
 * Vorname (freiwillig): nur Buchstaben, Leerzeichen, Bindestrich, Punkt, Apostroph — keine Ziffern, kein @, kein „://“. So lässt sich die
 * Bestätigungsmail nicht als Träger für fremde Links oder Texte missbrauchen. `''` = keiner, `null` = nicht angenommen.
 */
export function vornameSauber(roh: unknown): string | null {
  if (roh === undefined || roh === null) return '';
  if (typeof roh !== 'string') return null;
  const v = roh.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  // 31.10.: ein Punkt nur am Ende eines Wortes („Dr. Anna“) — „www.beispiel.de“ besteht auch nur aus Buchstaben und Punkten, wäre in einer Mail
  // aber ein Link (die Website-Mails — Unterlagen, Bericht der Checks — nehmen den Vornamen ebenfalls nur über diese Prüfung).
  return v.length <= GRENZEN.vorname && /^\p{L}[\p{L}\p{M} .'’-]*$/u.test(v) && !/\.[^\s]/u.test(v) ? v : null;
}

/** Kurztext für Name, Verantwortlichen: eine Zeile, ohne < > { }. `''` = leeren, `null` = ungültig. */
export function zeileSauber(roh: unknown, max: number): string | null {
  if (roh === null || roh === undefined) return '';
  if (typeof roh !== 'string') return null;
  const t = roh.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= max && !/[<>{}]/.test(t) ? t : null;
}

/** Einwilligungstext: mehrzeilig erlaubt, ohne < > (nur `{marke}` als Platzhalter). `''` = Vorgabe, `null` = ungültig. */
export function textSauber(roh: unknown): string | null {
  if (roh === null || roh === undefined) return '';
  if (typeof roh !== 'string') return null;
  const t = roh.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!t) return '';
  if (t.length > GRENZEN.text || t.length < 20 || /[<>]/.test(t) || /\{(?!marke\})[^}]*\}/.test(t)) return null;
  return t;
}

/** Adresse der Website: nur `https://host[:port]` (ohne Pfad, Zugangsdaten, Abfrage) — als Ursprung. `''` = leeren, `null` = ungültig. */
export function websiteSauber(roh: unknown): string | null {
  if (roh === null || roh === undefined) return '';
  if (typeof roh !== 'string') return null;
  const t = roh.trim().replace(/\/+$/, '');
  if (!t) return '';
  if (t.length > GRENZEN.link) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== '/')) return null;
    return u.origin;
  } catch { return null; }
}

/** Link zur Datenschutzerklärung: https-Adresse (oder `host/pfad`, wird zu https). `''` = leeren, `null` = ungültig. */
export function datenschutzLinkSauber(roh: unknown): string | null {
  if (roh === null || roh === undefined) return '';
  if (typeof roh !== 'string') return null;
  const t = roh.trim();
  if (!t) return '';
  if (t.length > GRENZEN.link || /\s|[<>"']/.test(t)) return null;
  const mit = /^https:\/\//i.test(t) ? t : /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(t) ? `https://${t}` : '';
  try { const u = new URL(mit); return u.protocol === 'https:' && !!u.hostname && !u.username ? u.toString() : null; } catch { return null; }
}

// ── Einwilligungstext und Fassung ───────────────────────────────────────────────────────────────────────────────────────────────

/** Neutrale Vorgabe (Sie-Form): was kommt, wie oft offen, Widerruf jederzeit. */
export const einwilligungVorgabe = (): string =>
  'Ja, ich möchte den Newsletter von {marke} per E-Mail erhalten: Neuigkeiten, Praxiswissen, Einladungen zu Veranstaltungen und Angebote. '
  + 'Meine Einwilligung kann ich jederzeit widerrufen — über den Abmeldelink in jeder Ausgabe oder per E-Mail.';

/** Der Wortlaut, wie die Person ihn sieht (Platzhalter ersetzt) — er geht in Anmeldung und Einwilligung. */
export function wortlautFuer(e: Pick<NewsletterEinstellungen, 'einwilligungstext'>, marke: string): string {
  return (e.einwilligungstext?.trim() || einwilligungVorgabe()).replace(/\{marke\}/g, marke);
}
export const fassungKennung = (n: number): string => `${FASSUNG_VORSATZ}${Math.max(1, Math.floor(n))}`;

/** Neue Fassung, wenn sich der angezeigte Wortlaut ändert (Text oder Name) — sonst dieselbe. */
export function naechsteFassung(alt: NewsletterEinstellungen, neu: NewsletterEinstellungen, markeAlt: string, markeNeu: string): number {
  return wortlautFuer(alt, markeAlt) === wortlautFuer(neu, markeNeu) ? alt.fassung : alt.fassung + 1;
}

// ── Datenschutzhinweis (Art. 13) und Bestätigungsmail ───────────────────────────────────────────────────────────────────────────

/** Der Hinweis in Kürze unter dem Formular (und in der Mail). Verantwortlicher NIE fest im Code — aus Einstellung bzw. Einrichtung. */
export function datenschutzZeilen(verantwortlich: string, link: string | null): string[] {
  return [
    `Verantwortlich: ${verantwortlich}.`,
    'Wofür: Wir schicken Ihnen den Newsletter an die angegebene Adresse — nur, wenn Sie das Häkchen setzen und die Anmeldung über den Link in unserer E-Mail bestätigen (Double-Opt-in). Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).',
    'Was wir speichern: Ihre E-Mail-Adresse, Ihren Vornamen (falls angegeben), den Wortlaut Ihrer Einwilligung sowie die Zeitpunkte von Anmeldung, Bestätigungsmail und Bestätigung — als Nachweis Ihrer Einwilligung.',
    `Speicherdauer: Unbestätigte Anmeldungen löschen wir nach ${FRIST_UNBESTAETIGT_TAGE} Tagen. Nach der Bestätigung, solange Sie angemeldet sind; danach bleibt nur der Nachweis, dass und wann Sie eingewilligt und widerrufen haben.`,
    'Sie können die Einwilligung jederzeit widerrufen (über den Abmeldelink in jeder Ausgabe oder per E-Mail). Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Beschwerde bei einer Aufsichtsbehörde'
      + `${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}

export interface MailWerte { marke: string; vorname?: string; link: string; verantwortlich: string; datenschutzLink: string | null }
/**
 * Die Bestätigungsmail — fester Text, KEINE Werbung (nur die Bitte um Bestätigung, der Link, „wenn Sie das nicht waren“, Datenschutz).
 * Der Text kommt nur von hier; der Aufrufer setzt nur die Werte der Instanz und den Link.
 */
export function bestaetigungsMail(w: MailWerte): { betreff: string; text: string } {
  const gruss = w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,';
  return {
    betreff: `Bitte bestätigen Sie Ihre Anmeldung — ${w.marke}`,
    text: [
      gruss,
      '',
      `Sie haben sich für den Newsletter von ${w.marke} angemeldet. Bitte bestätigen Sie das mit einem Klick auf diesen Link:`,
      '',
      w.link,
      '',
      `Der Link gilt ${TOKEN_TAGE} Tage. Erst mit Ihrer Bestätigung sind Sie angemeldet.`,
      '',
      `Wenn Sie das nicht waren, ignorieren Sie diese Mail einfach — Sie erhalten dann nichts, und wir löschen die Anmeldung nach ${FRIST_UNBESTAETIGT_TAGE} Tagen.`,
      '',
      `Viele Grüße`,
      w.marke,
      '',
      '—',
      `Datenschutz: Verantwortlich ist ${w.verantwortlich}. Wir verwenden Ihre Adresse nur für den Newsletter, wenn Sie die Anmeldung bestätigen (Art. 6 Abs. 1 lit. a DSGVO), und speichern den Nachweis Ihrer Einwilligung. `
        + `Widerruf jederzeit über den Abmeldelink in jeder Ausgabe oder per Antwort auf diese Mail.${w.datenschutzLink ? ` Mehr: ${w.datenschutzLink}` : ''}`,
    ].join('\n'),
  };
}

// ── Einwilligung für die Kartei ─────────────────────────────────────────────────────────────────────────────────────────────────

export const belegRefVon = (id: string): string => `newsletter:${id}`;

const zeitDe = (iso: string): string => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Die Einwilligung „Newsletter“ mit vollem Nachweis — Zeitpunkt und „erfasst von“ stempelt der Server beim Speichern
 * (`datenschutzStempeln`), Wortlaut + Fassung + Beleg stehen hier. `erteiltAm` = Berliner Tag der Bestätigung.
 */
export function einwilligungAus(a: Pick<NewsletterAnmeldung, 'id' | 'angemeldet' | 'mailGesendet' | 'bestaetigt' | 'wortlaut' | 'fassung'>, erteiltAm: string): Einwilligung {
  const teile = [`Double-Opt-in bestätigt am ${zeitDe(a.bestaetigt ?? a.angemeldet)}`, `angemeldet ${zeitDe(a.angemeldet)}`, ...(a.mailGesendet ? [`Bestätigungsmail ${zeitDe(a.mailGesendet)}`] : []), 'über die Website'];
  return { kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm, nachweis: teile.join(' · '), wortlaut: a.wortlaut, wortlautVersion: a.fassung, belegRef: belegRefVon(a.id) };
}

/** Trägt eine Person schon eine gültige Newsletter-Einwilligung mit vollem Nachweis (dann keine neue Anmeldung nötig)? */
export function hatVolleNewsletterEinwilligung(ew: readonly Einwilligung[] | undefined, luecken: (e: Einwilligung) => string[]): boolean {
  return (ew ?? []).some(e => e.kanal === 'newsletter' && e.grundlage === 'einwilligung' && !e.widerrufenAm && !luecken(e).length);
}

// ── Löschfrist ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Löschfrist (rein): unbestätigte, gesperrte und nicht übernommene Anmeldungen nach `FRIST_UNBESTAETIGT_TAGE` Tagen ohne Änderung; bestätigte
 * und übernommene, solange am Kontakt eine NICHT widerrufene Newsletter-Einwilligung mit genau diesem Beleg steht (`belegeAktiv`). Nach dem
 * Widerruf trägt die Kartei den Nachweis selbst (die Liste der Einwilligungen wächst nur) — dann fällt die Anmeldung weg.
 * `belegeAktiv === null` (Kartei nicht lesbar): bestätigte bleiben.
 */
export function anmeldungenAufraeumen(b: AnmeldungenBestand, jetzt: Date, belegeAktiv: ReadonlySet<string> | null): { bestand: AnmeldungenBestand; entfernt: number } {
  const grenze = jetzt.getTime() - FRIST_UNBESTAETIGT_TAGE * 86_400_000;
  const bleibt = b.anmeldungen.filter(a => {
    if (a.bestaetigt && a.crm?.status === 'ok') return belegeAktiv === null || belegeAktiv.has(belegRefVon(a.id));
    const zuletzt = Math.max(Date.parse(a.bestaetigt ?? '') || 0, Date.parse(a.angemeldet) || 0);
    return zuletzt >= grenze;
  });
  return { bestand: { ...b, anmeldungen: bleibt }, entfernt: b.anmeldungen.length - bleibt.length };
}

/** Wo eine Anmeldung steht — für die Liste im Haushalt. */
export type AnmeldungStand = 'wartet' | 'abgelaufen' | 'gesperrt' | 'bestaetigt' | 'nicht-uebernommen';
export function standVon(a: NewsletterAnmeldung, jetzt: Date): AnmeldungStand {
  if (a.gesperrt) return 'gesperrt';
  if (a.bestaetigt) return a.crm?.status === 'ok' ? 'bestaetigt' : 'nicht-uebernommen';
  return a.gueltigBis && Date.parse(a.gueltigBis) < jetzt.getTime() ? 'abgelaufen' : 'wartet';
}
