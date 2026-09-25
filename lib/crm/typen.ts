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
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
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
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
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
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
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
  /** Ablauf des Abends (Uhrzeit + Punkt). */
  ablauf?: { zeit: string; punkt: string }[];
  /** Checkliste mit Vorlauf in Tagen vor dem Event; angenommen → Aufgabe (aufgabeId). */
  checkliste?: { id: string; text: string; tageVorher: number; erledigt: boolean; aufgabeId?: string; /** Wer den Punkt erledigt — wird Bearbeiter der Aufgabe. */ wer?: string }[];
  /** Kostenpositionen — Summe ersetzt kostenEuro, sobald Positionen da sind. */
  budget?: { id: string; posten: string; betrag: number }[];
  /** Soll-Mischung der Gäste in Prozent (Zielkunden inkl. Interessenten; Kunden + Multiplikatoren). */
  mixZiel?: { zielkunden: number; kunden: number };
  /** Gästeliste aus einem Segment vorgeschlagen. */
  segmentId?: string;
  vorlage?: string;
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}
export type TeilnahmeStatus = 'vorgemerkt' | 'eingeladen' | 'zugesagt' | 'abgesagt' | 'da' | 'no_show';
export interface Teilnahme {
  id: string;
  eventId: string;
  kontaktId: string;
  status: TeilnahmeStatus;
  notiz?: string;
  followUpAm?: string;
  rolle?: 'gast' | 'co_host' | 'speaker';
  /** Fotos nur mit ausdrücklicher Freigabe. */
  fotofreigabe?: boolean;
  eingeladenAm?: string;
  einladungsweg?: 'persoenlich' | 'telefon' | 'mail' | 'linkedin';
  /** Wer die Person einlädt und nachfasst — hält meist die Beziehung. */
  einladenDurch?: string;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}

// ── Marketing (24.09. nachts) ────────────────────────────────────────────
/** Ein Segment = gespeicherter Filter über die Kartei (für Kampagnen, Einladungen, Newsletter). */
export interface SegmentKriterien {
  lebensphase?: string[]; kreis?: string[]; prio?: string[]; firmaRolle?: string[]; herkunft?: string[];
  branche?: string; stadt?: string; stichwort?: string;
  /** Nur, wer über diesen Kanal zulässig erreichbar ist (Ampel grün, bei 'persoenlich' alle). */
  kanal?: 'mail' | 'telefon' | 'linkedin' | 'newsletter' | 'einladung';
  mitChance?: boolean; ohneKontaktSeitTagen?: number;
}
export interface Segment { id: string; name: string; beschreibung?: string; kriterien: SegmentKriterien; geaendert: string; geaendertVon?: string }
export type BeitragKanal = 'linkedin' | 'newsletter' | 'blog' | 'podcast' | 'vortrag' | 'sonstig';
export interface Beitrag {
  id: string; titel: string; kanal: BeitragKanal; saeule?: string;
  status: 'idee' | 'entwurf' | 'geplant' | 'veroeffentlicht';
  datum?: string; text?: string; link?: string;
  /** Wirkung: wer reagiert hat, welche Gespräche/Anfragen daraus entstanden (Attribution per Kontakt). */
  wirkung: { kontaktId: string; art: 'reaktion' | 'gespraech' | 'anfrage'; am: string; notiz?: string }[];
  /** Aus welchen Kundengesprächen das Thema stammt (Stimme der Kunden). */
  quellen: string[];
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  /** In wessen Namen es erscheint (LinkedIn-Profil, Absender): kevin, malin oder „marke“. */
  stimme?: string;
  /** Freigabe durch die Stimme, wenn jemand anderes schreibt. */
  freigabe?: Freigabe;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}
/** Freigabe zwischen Kevin und Malin: Wer schreibt, bittet die Stimme um ihr Okay. */
export interface Freigabe { status: 'offen' | 'ok' | 'aenderung'; an: string; von?: string; am?: string; notiz?: string }
export interface NewsletterAusgabe {
  id: string; titel: string; datum?: string; status: 'entwurf' | 'bereit' | 'versendet';
  inhalt: string; beitragIds: string[];
  /** Zahlen nach dem Versand (von Hand aus dem Versandwerkzeug) — keine Öffnungsraten. */
  empfaenger?: number; antworten?: number; abmeldungen?: number;
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  freigabe?: Freigabe;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}
/** Kampagne: ein geplanter Anlauf auf eine Zielgruppe nach einem bewährten Vorgehen (Playbook). Versendet wird nichts. */
export type KampagnenStatus = 'entwurf' | 'aktiv' | 'abgeschlossen' | 'abgebrochen';
export type KampagnenErgebnis = 'angesprochen' | 'reagiert' | 'gespraech' | 'chance' | 'kein_interesse';
export interface Kampagne {
  id: string; name: string; playbook: string; ziel: string;
  zielgruppe: SegmentKriterien; segmentId?: string;
  kanal: 'persoenlich' | 'telefon' | 'mail' | 'linkedin' | 'event' | 'mix';
  status: KampagnenStatus; start?: string; ende?: string;
  schritte: { id: string; text: string; tag: number; erledigt: boolean; aufgabeId?: string }[];
  /** Ausgewählte Personen (aus der Zielgruppe übernommen oder einzeln). */
  kontaktIds: string[];
  ergebnisse: { kontaktId: string; ergebnis: KampagnenErgebnis; am: string }[];
  /** Wer sie angelegt hat — von Hand oder aus einem Vorschlag eines Heads. */
  von: 'hand' | 'head-sales' | 'head-marketing';
  notiz?: string;
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}

export interface MarketingEinstellung { positionierung: string; icp: string; ton: string; saeulen: { id: string; name: string; beschreibung: string }[] }

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
  segmente: Segment[];
  beitraege: Beitrag[];
  newsletter: NewsletterAusgabe[];
  kampagnen: Kampagne[];
  marketing?: MarketingEinstellung;
  /** Wahrscheinlichkeiten je Stufe, von Hand überschreibbar (wie in KEMARIS Operations „von_hand“). */
  wahrscheinlichkeiten?: Partial<Record<ChancenStufe, number>>;
}

export const CRM_LISTEN = ['firmen', 'chancen', 'mandate', 'leistungen', 'events', 'teilnahmen', 'sitzungen', 'antraege', 'verarbeitungen', 'segmente', 'beitraege', 'newsletter', 'kampagnen'] as const;
export type CrmListe = typeof CRM_LISTEN[number];
