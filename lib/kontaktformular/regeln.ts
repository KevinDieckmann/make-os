// ─── Kontaktformular der Website — Regeln (rein, 31.10., Website-Anbau) ─────────────────────────────────────────────────────────────
// Kevin 31.10.: „Homepage-Anbau“ — neben Check, Newsletter und Buchung ein schlichtes Kontaktformular. Öffentliche Seite `/anfrage`,
// Schnittstelle `POST /api/anfrage` (middleware.ts `KONTAKTFORMULAR_OFFEN`). Der Eingang läuft über den EINEN Anfrage-Weg
// (lib/crm/anfrage-anlegen.ts, Kanal „Website“): Person in der Kartei (vorhandene Person → „Adresse unbestätigt“), Aktivität „Anfrage über
// Website: Kontaktformular …“, Einwilligung „Antwort auf Anfrage“ (KEINE Werbe-Einwilligung), Follow-up „Anfrage beantworten“, Lead, Ereignis
// „neuer Lead“ mit Stufe `webseite-formular`. Kein eigener Bestand mit Personenbezug, keine Mail — die Antwort schreibt ein Mensch.
// Hier: Grenzen, Prüfung der Eingabe, Datenschutzhinweis, feste Texte.

export const EINSTELLUNGEN = 'kontaktformular-einstellungen';

export interface KontaktformularEinstellungen {
  /** Kommt AUS — eingeschaltet nur vom Inhaber (Markttraktion › Marketing › Anfragen). */
  aktiv: boolean;
  geaendert?: string;
  geaendertVon?: string;
}

/** Grenzen — darüber 413 mit Text, nie still gekürzt. */
export const GRENZEN = { vorname: 60, nachname: 60, firma: 120, email: 160, telefon: 40, nachricht: 2500, koerper: 8 * 1024 } as const;

export interface KontaktEingabe { vorname: string; nachname: string; firma: string; email: string; telefon: string; nachricht: string }

export const NICHT_ANGENOMMEN = 'Das hat leider nicht geklappt. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.';
export const DANKE_TEXT = 'Danke für Ihre Nachricht. Wir melden uns persönlich bei Ihnen — in der Regel innerhalb von zwei Werktagen.';

const EMAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const TELEFON_OK = /^\+?[\d ()/-]{6,30}$/;
/** Steuerzeichen (außer Zeilenumbruch/Tab) haben in einer Nachricht nichts zu suchen. */
// eslint-disable-next-line no-control-regex
const STEUER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

type Pruefung = { ok: true; eingabe: KontaktEingabe } | { ok: false; status: 400 | 413; fehler: string };

const feld = (x: unknown): string => (typeof x === 'string' ? x.normalize('NFC').trim() : '');

/** Die Eingabe des Formulars prüfen (rein). Pflicht: Vorname, E-Mail, Nachricht. Zu lang → 413, unförmig → 400. */
export function eingabePruefen(b: Record<string, unknown>): Pruefung {
  const e: KontaktEingabe = { vorname: feld(b.vorname), nachname: feld(b.nachname), firma: feld(b.firma), email: feld(b.email).toLowerCase(), telefon: feld(b.telefon), nachricht: feld(b.nachricht) };
  for (const k of ['vorname', 'nachname', 'firma', 'email', 'telefon', 'nachricht'] as const) {
    if (e[k].length > GRENZEN[k]) return { ok: false, status: 413, fehler: k === 'nachricht' ? `Die Nachricht ist zu lang (höchstens ${GRENZEN.nachricht} Zeichen).` : 'Eine Angabe ist zu lang.' };
  }
  if (!e.vorname) return { ok: false, status: 400, fehler: 'Bitte geben Sie Ihren Vornamen an.' };
  if (!EMAIL_OK.test(e.email)) return { ok: false, status: 400, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' };
  if (e.telefon && !TELEFON_OK.test(e.telefon)) return { ok: false, status: 400, fehler: 'Die Telefonnummer sieht nicht richtig aus.' };
  if (e.nachricht.length < 5) return { ok: false, status: 400, fehler: 'Bitte schreiben Sie kurz, worum es geht.' };
  if ([e.vorname, e.nachname, e.firma, e.telefon].some(x => /[\r\n]/.test(x) || STEUER.test(x)) || STEUER.test(e.nachricht)) return { ok: false, status: 400, fehler: 'Eine Angabe enthält Zeichen, die wir nicht annehmen.' };
  return { ok: true, eingabe: e };
}

/** Der Text der Anfrage-Aktivität (nach „Anfrage über Website: “) — die Nachricht wörtlich, sie bleibt fremder Text. */
export const anfrageText = (e: Pick<KontaktEingabe, 'nachricht'>): string => `Kontaktformular — ${e.nachricht}`;

/**
 * Datenschutzhinweis in Kürze (Art. 13) — Verantwortlicher aus der Einrichtung bzw. der Abweichung der Website (Check-Einstellungen). Hinweis,
 * keine Rechtsberatung — anwaltlich gegenlesen.
 */
export function datenschutzZeilen(verantwortlich: string, link: string | null): string[] {
  return [
    `Verantwortlich: ${verantwortlich}.`,
    'Wofür: Wir beantworten Ihre Anfrage und halten sie in unserem Kundensystem fest (Art. 6 Abs. 1 lit. b DSGVO — Anfrage vor einem möglichen Vertrag; sonst lit. f — Beantwortung Ihrer Nachricht). Werbung schicken wir Ihnen damit nicht.',
    'Was wir speichern: Ihren Namen, Ihre E-Mail-Adresse, Firma und Telefon (falls angegeben), Ihre Nachricht und den Zeitpunkt.',
    'Speicherdauer: solange wir mit Ihnen in Kontakt stehen; ohne weiteren Kontakt prüfen wir spätestens nach 24 Monaten, ob die Angaben gelöscht werden.',
    'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit und Beschwerde bei einer Aufsichtsbehörde'
      + `${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}
