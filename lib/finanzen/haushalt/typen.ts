// ─── MAKE OS — Haushaltsfinanzen: Datenmodell (24.09.) ──────────────────────
// Übernommen aus Malins „MAKE.ORGA“ (Supabase-Schema, samt der Felder, die
// dort live nachgetragen wurden: monatsbudget, art/betrag/bezahlt_am …).
//
// Zwei bewusste Abweichungen:
//   • Beträge in CENT als ganze Zahl. Summen über tausend Buchungen sollen
//     auf den Cent stimmen, nicht auf den Gleitkommafehler.
//   • Jede Zeile trägt einen `stand` (Versionszähler). Wer eine veraltete
//     Zeile speichert, bekommt einen Konflikt statt still zu überschreiben —
//     Malins bekannte Schwäche „wer zuletzt speichert, gewinnt“.

export type Einheit = 'privat' | 'selbststaendigkeit' | 'ug';
export const EINHEITEN: Einheit[] = ['privat', 'selbststaendigkeit', 'ug'];
export const EINHEIT_NAME: Record<Einheit, string> = {
  privat: 'Privat', selbststaendigkeit: 'Selbstständigkeit', ug: 'KD Management UG',
};

export type Turnus = 'monatlich' | 'quartal' | 'jahr';
export type KategorieTyp = 'ausgabe' | 'einnahme' | 'umbuchung';

/** Jede gespeicherte Zeile: Kennung + Versionsstand. */
export interface Zeile { id: string; stand: number }

export interface Konto extends Zeile {
  name: string;
  inhaber: string | null;          // Kevin | Malin | gemeinsam
  einheit: Einheit;
  iban_suffix: string | null;      // nur die letzten 4 Stellen, nie die ganze IBAN
  bank: string | null;
  waehrung: string;
  aktiv: boolean;
}

export interface Kategorie extends Zeile {
  name: string;
  typ: KategorieTyp;
  sortierung: number;
  monatsbudget: number | null;     // Cent
}

export interface Buchung extends Zeile {
  konto_id: string;
  datum: string;                   // JJJJ-MM-TT
  betrag: number;                  // Cent, negativ = Ausgabe
  beschreibung: string;
  empfaenger: string;
  kategorie_id: string | null;
  ist_umbuchung: boolean;
  ist_fixkosten: boolean;
  turnus: Turnus;
  einheit: Einheit;
  zeilen_hash: string | null;      // Dublettenschutz je Konto
  notiz: string | null;
  import_id: string | null;
  erfasst_von: string | null;
  geaendert: string;               // ISO-Zeit der letzten Änderung
}

export interface Regel extends Zeile {
  muster: string;
  empfaenger: string;
  kategorie_id: string | null;
  ist_umbuchung: boolean;
  ist_fixkosten: boolean;
  turnus: Turnus;
  ganzes_wort: boolean;
  prioritaet: number;              // kleiner = zuerst
  treffer_zaehler: number;
}

export interface Schuld extends Zeile {
  bezeichnung: string;
  glaeubiger: string | null;
  einheit: Einheit;
  startbetrag: number;             // Cent
  restbetrag: number;              // Cent
  rate: number | null;             // Cent pro Monat
  zinssatz: number | null;         // Prozent p. a.
  rhythmus: string | null;
  naechste_faelligkeit: string | null;
  endet_am: string | null;
  notiz: string | null;
  aus_buchung_id: string | null;   // Kredit-Einnahme, aus der sie entstand
}

export interface Beleg extends Zeile {
  art: 'rechnung' | 'beleg';       // Rechnung = Geld geht noch raus; Beleg = Papier fehlt
  bezeichnung: string;
  empfaenger: string | null;
  betrag: number | null;           // Cent
  faellig_am: string | null;
  verursacher: string | null;
  einheit: Einheit;
  erledigt: boolean;
  bezahlt_am: string | null;
  notiz: string | null;
  buchung_id: string | null;
}

export type Posten = 'Umsatz' | 'Ausgaben' | 'Sparrate' | 'Tilgung';
export const POSTEN: Posten[] = ['Umsatz', 'Ausgaben', 'Sparrate', 'Tilgung'];

export interface Planwert extends Zeile {
  einheit: Einheit;
  jahr: number;
  monat: number;
  posten: Posten;
  sollwert: number;                // Cent
  notiz: string | null;
}

/** Der Stammbestand eines Haushalts. `aliase`: alte Kategorie-Kennung → neue (Aufräumen ohne Datenverlust). */
export interface Stamm {
  konten: Konto[];
  kategorien: Kategorie[];
  regeln: Regel[];
  aliase: Record<string, string>;
}

/** Alles, was eine Ansicht eines Haushalts braucht. */
export interface Haushalt {
  stamm: Stamm;
  buchungen: Buchung[];
  schulden: Schuld[];
  belege: Beleg[];
  planwerte: Planwert[];
}

/** Euro-Anzeige aus Cent. */
export function eur(cent: number | null | undefined, mitCent = true): string {
  if (cent === null || cent === undefined || !Number.isFinite(cent)) return '–';
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: mitCent ? 2 : 0, maximumFractionDigits: mitCent ? 2 : 0 });
}

/** Euro (Zahl oder Text wie „1.234,56“) → Cent. null, wenn es keine Zahl ist. */
export function zuCent(wert: unknown): number | null {
  if (typeof wert === 'number') return Number.isFinite(wert) ? Math.round(wert * 100) : null;
  if (typeof wert !== 'string') return null;
  let s = wert.replace(/[\s€]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

/** Einheit aus altem oder neuem Namen — Unbekanntes wird abgewiesen, nicht geraten. */
export function einheitAus(roh: unknown): Einheit | null {
  const s = String(roh ?? '').trim().toLowerCase();
  if (!s || s === 'privat') return 'privat';
  if (s === 'selbst' || s === 'selbststaendigkeit' || s === 'selbstständigkeit') return 'selbststaendigkeit';
  if (s === 'ug' || s === 'kd management ug') return 'ug';
  return null;
}
