// ─── MAKE OS — Stammdaten: Aufbau der Kartei ────────────────────────────────
// Der sichere Platz für die Zahlen, die man dreimal im Jahr braucht und dann
// nicht findet: Steuernummern, IBANs, wer beim Finanzamt zuständig ist.
//
// Anlass: dieselben Angaben lagen bisher nur im Browser-Speicher des
// HTML-Dashboards — auf einem Rechner, ohne Sicherung, ohne Schutz. Hier
// liegen sie in .data, werden täglich gesichert und verlassen den Rechner
// nicht.
//
// „schutz: true" heißt: wird nur als •••• angezeigt, bis man auf Zeigen tippt.

export type Feldart = 'text' | 'lang' | 'datum';

export interface Feld {
  key: string;
  label: string;
  art?: Feldart;
  /** Verdeckt anzeigen — Steuer-ID, SV-Nummer, IBAN. */
  schutz?: boolean;
  hinweis?: string;
}

export interface Kartei {
  id: 'firmen' | 'konten' | 'personen' | 'partner';
  titel: string;
  /** Ein Satz, der erklärt, wofür man das hier braucht. */
  satz: string;
  /** Womit die Karte überschrieben wird. */
  titelFeld: string;
  /** Was in der Zeile unter dem Titel steht. */
  untertitelFeld?: string;
  felder: Feld[];
  /** Nur im Business- bzw. Privat-Modus zeigen. */
  modus: 'privat' | 'business' | 'beides';
}

export const KARTEIEN: Kartei[] = [
  {
    id: 'firmen',
    titel: 'Firmen',
    satz: 'Je Firma einmal alles, was auf Rechnungen, Verträgen und beim Steuerberater gebraucht wird.',
    titelFeld: 'name',
    untertitelFeld: 'form',
    modus: 'business',
    felder: [
      { key: 'name', label: 'Name' },
      { key: 'form', label: 'Rechtsform', hinweis: 'UG (haftungsbeschränkt), Einzelunternehmen …' },
      { key: 'sitz', label: 'Sitz / Anschrift', art: 'lang' },
      { key: 'steuernummer', label: 'Steuernummer', schutz: true },
      { key: 'ustId', label: 'USt-IdNr.', hinweis: 'DE…' },
      { key: 'handelsregister', label: 'Handelsregister', hinweis: 'HRB … / Amtsgericht' },
      { key: 'finanzamt', label: 'Finanzamt' },
      { key: 'gruendung', label: 'Gegründet am', art: 'datum' },
      { key: 'notiz', label: 'Notiz', art: 'lang' },
    ],
  },
  {
    id: 'konten',
    titel: 'Konten',
    satz: 'Welches Konto zu welcher Firma gehört — und wofür es da ist.',
    titelFeld: 'name',
    untertitelFeld: 'bank',
    modus: 'beides',
    felder: [
      { key: 'name', label: 'Bezeichnung', hinweis: 'z. B. Geschäftskonto KD Ventures' },
      { key: 'bank', label: 'Bank' },
      { key: 'inhaber', label: 'Kontoinhaber' },
      { key: 'iban', label: 'IBAN', schutz: true },
      { key: 'bic', label: 'BIC' },
      { key: 'zweck', label: 'Wofür', art: 'lang', hinweis: 'Gehalt, laufende Kosten, Rücklage …' },
      { key: 'notiz', label: 'Notiz', art: 'lang' },
    ],
  },
  {
    id: 'personen',
    titel: 'Personen',
    satz: 'Kevin und Malin — die Angaben, die jede Steuererklärung und jeder Antrag verlangt.',
    titelFeld: 'name',
    untertitelFeld: 'rolle',
    modus: 'beides',
    felder: [
      { key: 'name', label: 'Name' },
      { key: 'rolle', label: 'Rolle', hinweis: 'Geschäftsführer, angestellt, selbständig …' },
      { key: 'geburtsdatum', label: 'Geburtsdatum', art: 'datum' },
      { key: 'steuerId', label: 'Steuer-Identifikationsnummer', schutz: true, hinweis: '11-stellig, lebenslang gleich' },
      { key: 'svNummer', label: 'Sozialversicherungsnummer', schutz: true },
      { key: 'adresse', label: 'Meldeadresse', art: 'lang' },
      { key: 'krankenkasse', label: 'Krankenkasse' },
      { key: 'notiz', label: 'Notiz', art: 'lang' },
    ],
  },
  {
    id: 'partner',
    titel: 'Ansprechpartner',
    satz: 'Steuerberater, Bank, Versicherung, Anwalt — damit niemand erst suchen muss.',
    titelFeld: 'name',
    untertitelFeld: 'rolle',
    modus: 'beides',
    felder: [
      { key: 'name', label: 'Name' },
      { key: 'rolle', label: 'Wofür zuständig', hinweis: 'Steuerberater, Bankberater, Anwalt …' },
      { key: 'firma', label: 'Kanzlei / Haus' },
      { key: 'telefon', label: 'Telefon' },
      { key: 'mail', label: 'E-Mail' },
      { key: 'notiz', label: 'Notiz', art: 'lang' },
    ],
  },
];

export const KARTEI = Object.fromEntries(KARTEIEN.map(k => [k.id, k])) as Record<string, Kartei>;

/** Feld verdeckt darstellen: letzte vier Zeichen bleiben stehen. */
export function verdecken(wert: string): string {
  const s = wert.replace(/\s+/g, '');
  if (s.length <= 4) return '••••';
  return '•'.repeat(Math.min(s.length - 4, 16)) + s.slice(-4);
}
