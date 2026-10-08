// ─── Rechnungen schreiben mit PDF — Typen (rein, client-sicher, 08.10.) ──────
// Kevin 08.10. (ROADMAP_Q4.md › Lücken, Punkt 4): „Rechnungen schreiben wie das Angebots-Tool (fortlaufende Nummer je
// Gesellschaft + PDF in einer Sperre, Angebot → Rechnung, Mahnstufen als Vorschlag; E-Rechnung danach).“
//
// Die Rechnung bleibt der Eintrag im Finanzplan-Bestand (`finanzplan` › `rechnungen`, Typ `Rechnung` in
// lib/finanzen/finanzplan-bestand.ts) — Liquidität, Business-Index, Umsatz-Reiter und Steuern lesen weiter dieselbe Quelle.
// Hier stehen nur die NEUEN, durchweg optionalen Felder (Kompatibilitätsmodus: der alte Online-Stand kennt sie nicht und
// verliert beim nächsten Speichern nur sie — Rückweg in UPDATES.md). Beträge der Positionen in CENT.
//
// E-Rechnung (XRechnung/ZUGFeRD, EN 16931) ist noch nicht gebaut — die Felder sind so geschnitten, dass sie später daraus
// entsteht: Positionen mit Menge, Einheit, Einzelpreis und Steuersatz; Absender/Empfänger mit Straße, PLZ, Ort, Land und
// USt-IdNr.; Leistungszeitraum; Fälligkeit; Bank (beim Stellen aus dem Gesellschafts-Register); Steuerhinweis (Kleinunternehmer,
// Reverse Charge, steuerfrei mit Grund).

import type { AngebotAbsender } from '@/lib/crm/typen';

/** Eine Rechnungsposition — wie die Angebotsposition, aber ohne Basis/Laufzeit (eine Rechnung rechnet einen Zeitraum ab). */
export interface RechnungPosition {
  id: string;
  /** Aus welchem Produkt die Position stammt (Text und Preis wurden übernommen). */
  leistungId?: string;
  titel: string;
  text: string;
  menge: number;
  /** z. B. „Monat“, „Tag“, „Stunde“, „pauschal“. */
  einheit: string;
  /** Einzelpreis netto in Cent (nie negativ — eine Stornorechnung kehrt nur das Vorzeichen der Summen um). */
  einzelpreisCent: number;
  rabattProzent?: number;
  /** 19, 7 oder 0. */
  ustSatz: number;
}

/**
 * Empfänger als Momentaufnahme: im Entwurf änderbar, ab „gestellt“ fest (steht so im PDF). Strukturiert (Straße, PLZ, Ort, Land)
 * — so braucht die E-Rechnung später keine Zerlegung von Freitext.
 */
export interface RechnungEmpfaenger {
  /** Ansprechperson („z. Hd.“) bzw. Name einer Privatperson. */
  name?: string;
  firma?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  /** Leer bzw. „Deutschland“ = Inland. */
  land?: string;
  /** USt-IdNr. des Empfängers — Pflicht bei Reverse Charge (§ 13b UStG). */
  ustId?: string;
  /** Adresse für den Versand (nur der Mail-Entwurf nutzt sie). */
  email?: string;
  /** Bestellnummer / Referenz des Kunden (CRM › Zahlungsdaten). */
  referenz?: string;
}

/** Absender beim Stellen — dieselbe Form wie beim Angebot (IBAN in der Momentaufnahme maskiert, im PDF voll). */
export type RechnungAbsender = AngebotAbsender;

/** Warum eine Position ohne Umsatzsteuer ist (außer Kleinunternehmer, das kommt aus dem Register). */
export type SteuerHinweis = 'reverse-charge' | 'steuerfrei';

export type Mahnstufe = 1 | 2 | 3;
/** Eine Mahnung (Zahlungserinnerung · 1. Mahnung · 2. Mahnung) — vermerkt erst, wenn jemand sie per Klick verschickt. */
export interface Mahnung { stufe: Mahnstufe; am: string; von: string }

/** Laufende Nummer je Gesellschaft und Jahr — Grundlage der lückenlosen Vergabe (nur Server). */
export interface RechnungLauf { jahr: number; nr: number }

/**
 * Die optionalen Felder der Rechnungen mit PDF. `art`, `stornoZu`, `lauf`, `pdfDateiId`, `sha256`, `gestelltAm/-Von`, `absender`,
 * `mahnungen`, `stornoRechnungId` setzt NUR der Server (RECHNUNG_SERVER_FELDER) — der allgemeine Finanzplan-Weg übernimmt sie nie
 * aus dem Browser.
 */
export interface RechnungZusatz {
  positionen?: RechnungPosition[];
  empfaenger?: RechnungEmpfaenger;
  absender?: RechnungAbsender;
  /** Empfänger aus der Kartei (c-…) — nur Verweis; der Name steht in der Momentaufnahme. */
  kontaktId?: string;
  /** Kundenfirma aus dem CRM (f-…). Nicht verwechseln mit `firmaId` (= die EIGENE Gesellschaft, kdc · kdv · ug). */
  kundeFirmaId?: string;
  /** Aus diesem Angebot (Angebots-Tool) entstanden. */
  angebotId?: string;
  zahlungszielTage?: number;
  steuerHinweis?: SteuerHinweis;
  steuerfreiGrund?: string;
  einleitung?: string;
  schluss?: string;
  lauf?: RechnungLauf;
  pdfDateiId?: string;
  sha256?: string;
  gestelltAm?: string;
  gestelltVon?: string;
  /** Eine Stornorechnung (eigene Nummer, negativ, Bezug `stornoZu`). Status immer „storniert“ — zählt nirgends mit. */
  art?: 'storno';
  stornoZu?: string;
  /** Am Original: die Stornorechnung dazu. */
  stornoRechnungId?: string;
  mahnungen?: Mahnung[];
}
