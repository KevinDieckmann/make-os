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

import { FINANZ_ORT_IDS, finanzOrtAus, finanzOrtName, type FinanzOrt } from '@/lib/einheiten';

// Einheit (28.09., eine Einheitenliste): die Kennungen aus lib/einheiten.ts — privat · kdc · kdv · ug.
// VORHER hieß es hier privat · selbststaendigkeit · ug, und `ug` war die „KD Management UG“ =
// Gründungsname der KD Ventures UG (CLAUDE.md), NICHT die MAKE OS UG. Gespeicherte Bestände
// ohne Fassungs-Marke werden deshalb beim Lesen übersetzt: selbststaendigkeit → kdc, ug → kdv
// (`haushaltEinheitAusAlt`, `einheitenLesen` in speicher.ts); geschrieben wird die neue Fassung.
export type Einheit = FinanzOrt;
export const EINHEITEN: Einheit[] = [...FINANZ_ORT_IDS];
export const EINHEIT_NAME: Record<Einheit, string> = {
  privat: finanzOrtName('privat'), kdc: finanzOrtName('kdc'), kdv: finanzOrtName('kdv'), ug: finanzOrtName('ug'),
};
/** Fassung der Einheiten in einer Haushalts-Datei: fehlt sie, gilt das alte Vokabular (ug = KD Ventures). */
export const EINHEITEN_FASSUNG = 2;

/** Rhythmus einer wiederkehrenden Zahlung. Seit 27.09. auch halbjährlich und „unregelmäßig“ (Malins Rückmeldung: „Rhythmus unklar“ muss klärbar sein). */
export type Turnus = 'monatlich' | 'quartal' | 'halbjahr' | 'jahr' | 'unregelmaessig';
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
  /** Rhythmus von Hand bestätigt (27.09.): dann fragt „Rhythmus unklar“ nicht mehr — auch wenn die Abstände weiter unklar aussehen. */
  turnus_geklaert?: boolean;
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

/**
 * Einheit aus einer EINGABE (Oberfläche, API) — neues Vokabular der einen Liste (`ug` = MAKE OS UG),
 * Namen und Altnamen („Selbstständigkeit“, „KD Management UG“) werden erkannt. Leer = privat.
 * Unbekanntes wird abgewiesen, nicht geraten.
 */
export function einheitAus(roh: unknown): Einheit | null {
  const s = String(roh ?? '').trim();
  if (!s) return 'privat';
  return finanzOrtAus(s) ?? null;
}

/**
 * Einheit aus einem ALTEN Bestand (Datei ohne Fassungs-Marke, Malins MAKE.ORGA/Supabase, V1):
 * dort war `ug` die KD Management UG = KD Ventures (kdv), `selbststaendigkeit` die Selbstständigkeit (kdc).
 * Unbekanntes → null (nie raten, nie still verwerfen — der Aufrufer entscheidet).
 */
export function haushaltEinheitAusAlt(roh: unknown): Einheit | null {
  const s = String(roh ?? '').trim().toLowerCase();
  if (!s || s === 'privat') return 'privat';
  if (s === 'ug' || s === 'kd management ug') return 'kdv';
  if (s === 'selbst' || s === 'selbststaendigkeit' || s === 'selbstständigkeit') return 'kdc';
  return einheitAus(roh);
}
