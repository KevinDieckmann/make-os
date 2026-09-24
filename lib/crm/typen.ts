// ─── CRM — Chancen, Kunden & Mandate, Leistungen, Events (24.09.) ──────────
// Kevin: „Alles, was mit Kundengewinnung zu tun hat, unter das CRM“ — und
// dabei die Markttraktion aus KEMARIS Operations übernehmen (Pipeline mit
// Austrittskriterien, Warum-jetzt-Punkte, Einwilligung, Sperre statt
// Löschen), im MAKE-OS-Design. Die Kartei (Personen) bleibt im Speicher
// „kontakte“ (lib/make-one/crm.ts); alles, was an Personen hängt, liegt hier
// im Speicher „crm“. Konzept: docs/konzepte/crm-sales-marketing-events.md

/** Chancen-Stufen nach KEMARIS Operations (pipeline.ts, Version 2): jede Stufe endet mit einem Ereignis auf KUNDENseite. */
export type ChancenStufe = 'qualifiziert' | 'bedarf' | 'diagnose' | 'angebot' | 'abschluss' | 'gewonnen' | 'verloren' | 'geparkt';
export type ChancenArt = 'retainer' | 'projekt' | 'workshop' | 'vermittlung' | 'software';
export type WertBasis = 'monat' | 'jahr' | 'einmalig';
export type Quelle = 'empfehlung' | 'event' | 'content' | 'outreach' | 'bestand' | 'inbound';
export type Qual = 'ja' | 'nein' | 'unklar';
export type Gesellschaft = 'kdv' | 'kdc' | 'ug' | 'offen';

export interface Chance {
  id: string;
  titel: string;
  kontaktIds: string[];
  firma?: string;
  art: ChancenArt;
  leistungId?: string;
  wert: { betrag: number; basis: WertBasis; laufzeitMonate?: number };
  stufe: ChancenStufe;
  historie: { stufe: ChancenStufe; am: string; von: string }[];
  naechsterSchritt?: { text: string; datum: string };
  quelle?: Quelle;
  quelleBezug?: string;
  /** Die sechs Kernfragen der Qualifizierung. */
  qualifizierung: { schmerz: Qual; entscheider: Qual; budget: Qual; zeitpunkt: Qual; wirkung: Qual; alternative: Qual };
  /** Pflicht bei verloren/geparkt. */
  grund?: string;
  wiedervorlage?: string;
  erwartetAm?: string;
  gesellschaft: Gesellschaft;
  besitzer: string;
  /** Selbstauskunft: „Wie sind Sie auf uns aufmerksam geworden?“ */
  selbstauskunft?: string;
  angelegt: string;
  geaendert: string;
  letzteAktivitaet?: string;
  notiz?: string;
}

export type MandatStatus = 'angebot' | 'verhandlung' | 'aktiv' | 'pausiert' | 'beendet';
export interface Mandat {
  id: string;
  kunde: string;
  kontaktIds: string[];
  titel: string;
  art: ChancenArt;
  leistungId?: string;
  chanceId?: string;
  gesellschaft: Gesellschaft;
  status: MandatStatus;
  vertragUnterschrieben: boolean;
  start?: string;
  ende?: string;
  mindestlaufzeitMonate?: number;
  kuendigungsfristTage?: number;
  verlaengerung: 'auto' | 'manuell' | 'offen';
  honorar: { betrag: number; basis: 'monat' | 'einmalig' | 'tag'; netto: boolean };
  /** 19 (Inland) oder 0 (Reverse Charge, Ausland). */
  ustSatz: number;
  /** Verknüpfter Posten im Liquiditätsplan (vorhanden oder aus dem Mandat angelegt). */
  planpostenId?: string;
  rechnungsrhythmus: 'monatlich' | 'quartal' | 'einmalig';
  zahlungszielTage: number;
  naechstesReview?: string;
  ziele: { id: string; text: string; ziel?: string; ist?: string }[];
  /** DEAR, für Beratung übersetzt — je 0–100, null = noch nicht bewertet. */
  health: { beteiligung: number | null; umsetzung: number | null; wirkung: number | null; zahlung: number | null; stimmung: number | null };
  leistungen: string[];
  /** Widersprüche und offene Punkte — werden nicht geglättet, sondern sichtbar gemacht. */
  offen: string[];
  quelle?: string;
  notiz?: string;
  geaendert: string;
}

export type LeistungTyp = 'diagnose' | 'workshop' | 'retainer' | 'sprint' | 'vermittlung' | 'software';
export interface Leistung {
  id: string;
  name: string;
  typ: LeistungTyp;
  /** Accelerant Curve: Einstieg → Kern → Premium. */
  stufe: 'einstieg' | 'kern' | 'premium';
  preis: { betrag: number; bis?: number; einheit: string };
  beschreibung?: string;
  lieferumfang: string[];
  grenzen?: string;
  ergebnis?: string;
  gesellschaft: Gesellschaft;
  status: 'aktiv' | 'entwurf' | 'eingestellt';
  quelle?: string;
  geaendert: string;
}

export type FirmaRolle = 'zielkunde' | 'kunde' | 'ex_kunde' | 'partner' | 'dienstleister' | 'investor' | 'netzwerk' | 'wettbewerb' | 'offen';
/** Ein Unternehmen — Stammdaten an EINER Stelle, Personen zeigen per firmaId darauf. */
export interface Firma {
  id: string;
  name: string;
  domain?: string;
  webseite?: string;
  branche?: string;
  mitarbeiter?: string;
  umsatz?: string;
  stadt?: string;
  gegruendet?: string;
  linkedin?: string;
  telefon?: string;
  email?: string;
  rechtsform?: string;
  rolle: FirmaRolle;
  /** Rolle von Hand gesetzt — der Abgleich leitet sie dann nicht mehr ab. */
  rolleVonHand?: boolean;
  marktinfo?: string;
  notiz?: string;
  geaendert: string;
}

export type EventFormat = 'stammtisch' | 'workshop' | 'dinner' | 'webinar' | 'messe' | 'sonstig';
export interface Event {
  id: string;
  titel: string;
  format: EventFormat;
  /** Spezifisch und strittig (Parker) — „Netzwerken“ ist kein Ziel. */
  ziel: string;
  zielgruppe?: string;
  datum: string;
  uhrzeit?: string;
  ort?: string;
  kapazitaet?: number;
  kostenEuro?: number;
  coHost?: string;
  status: 'idee' | 'geplant' | 'einladung' | 'durchgefuehrt' | 'abgesagt';
  notiz?: string;
  geaendert: string;
}
export type TeilnahmeStatus = 'vorgemerkt' | 'eingeladen' | 'zugesagt' | 'abgesagt' | 'da' | 'no_show';
export interface Teilnahme {
  id: string;
  eventId: string;
  kontaktId: string;
  status: TeilnahmeStatus;
  notiz?: string;
  followUpAm?: string;
  geaendert: string;
}

export interface PowerHourKarte { kontaktId: string; kategorie: string; ergebnis?: string; notiz?: string }
export interface PowerHourSitzung {
  id: string;
  person: string;
  datum: string;
  start: string;
  ende?: string;
  ziel: { gespraeche: number; termine: number };
  karten: PowerHourKarte[];
  gelernt?: string;
}

/** Betroffenenantrag (Art. 15–21 DSGVO) — Frist ein Monat ab Eingang. */
export type AntragArt = 'auskunft' | 'berichtigung' | 'loeschung' | 'einschraenkung' | 'uebertragbarkeit' | 'widerspruch';
export interface Antrag { id: string; art: AntragArt; name: string; email?: string; kontaktId?: string; eingang: string; frist: string; status: 'offen' | 'erledigt'; ergebnis?: string; erledigtAm?: string; von?: string; geaendert: string }
/** Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO). */
export interface Verarbeitung { id: string; name: string; zweck: string; personen: string; daten: string; rechtsgrundlage: string; empfaenger: string; drittland: string; loeschfrist: string; toms: string; verantwortlich: string; stand: string }

export interface CrmBestand {
  firmen: Firma[];
  chancen: Chance[];
  mandate: Mandat[];
  leistungen: Leistung[];
  events: Event[];
  teilnahmen: Teilnahme[];
  sitzungen: PowerHourSitzung[];
  antraege: Antrag[];
  verarbeitungen: Verarbeitung[];
  /** Wahrscheinlichkeiten je Stufe, von Hand überschreibbar (wie in KEMARIS Operations „von_hand“). */
  wahrscheinlichkeiten?: Partial<Record<ChancenStufe, number>>;
}

export const CRM_LISTEN = ['firmen', 'chancen', 'mandate', 'leistungen', 'events', 'teilnahmen', 'sitzungen', 'antraege', 'verarbeitungen'] as const;
export type CrmListe = typeof CRM_LISTEN[number];
