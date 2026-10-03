// ─── CRM — Chancen, Kunden & Mandate, Leistungen, Events (24.09.) ──────────
// Kevin: „Alles, was mit Kundengewinnung zu tun hat, unter das CRM“ — und
// dabei die Markttraktion aus KEMARIS Operations übernehmen (Pipeline mit
// Austrittskriterien, Warum-jetzt-Punkte, Einwilligung, Sperre statt
// Löschen), im MAKE-OS-Design. Die Kartei (Personen) bleibt im Speicher
// „kontakte“ (lib/make-one/crm.ts); alles, was an Personen hängt, liegt hier
// im Speicher „crm“. Konzept: docs/konzepte/crm-sales-marketing-events.md

/** Chancen-Stufen nach KEMARIS Operations (pipeline.ts, Version 2): jede Stufe endet mit einem Ereignis auf KUNDENseite. */
// ── Ebene 1: Lead (25.09., Kevin: „Kontakt-/Firmen-Ebene, wo wir qualifizieren und es ein SQL wird“) ──
/** Lead-Status — die Qualifizierung VOR dem Deal. Ab „sql“ gehört es in die Deal-Ebene (Pipeline). */
export type LeadStatus = 'neu' | 'kontaktiert' | 'im_gespraech' | 'qualifizierung' | 'sql' | 'kunde' | 'kein_fit' | 'ruht';
/** Die sechs Kernfragen der Qualifizierung (dieselben wie am Deal — sie wandern beim SQL mit). */
export interface Kriterien { schmerz: Qual; entscheider: Qual; budget: Qual; zeitpunkt: Qual; wirkung: Qual; alternative: Qual }
/** Qualifizierung an der Firma (Account) — ohne Firma an der Person. */
export interface Lead {
  status: LeadStatus;
  kriterien: Kriterien;
  /** Freitext je Frage (Qualifizierungsrunde 27.09.): was genau der Schmerz ist, wer entscheidet, … Seit 03.10. je Kriterium der Scoring-Einstellungen (Kennung → Text). */
  antworten?: Record<string, string>;
  /**
   * Die im Gespräch gewählte Stufe je Kriterium der Sales-Scoring-Einstellungen (03.10., lib/crm/scoring.ts): Kennung → Stufen-Kennung.
   * Neu und optional — ältere Leads tragen nur `kriterien` (ja/nein/unklar) und `fit`; der Rechenkern liest beides.
   */
  stufen?: Record<string, string>;
  /** Geparkt (Status „ruht“) bis zu diesem Tag (03.10.): dann kommt der Lead in die Qualifizierungsrunde zurück. */
  wiedervorlage?: string;
  /** Warum ausgeschieden (Kein Fit) oder geparkt — eine feste Art für die Auswertung (lib/crm/lead-grund.ts), `grund` bleibt der freie Satz. */
  grundArt?: string;
  /** Wann zuletzt qualifiziert wurde (Runde, Kernfrage, Antwort) — steuert die Wiedervorlage in der Qualifizierungsrunde. */
  qualifiziertAm?: string;
  /** Passt die Firma zu unserem Kundenprofil? */
  fit?: Qual;
  notiz?: string;
  /** Wann es ein SQL wurde und welcher Deal daraus entstand. */
  sqlAm?: string; chanceId?: string;
  /** Warum kein Fit / ruht. */
  grund?: string;
  geaendert?: string; geaendertVon?: string;
}

export type ChancenStufe = 'qualifiziert' | 'bedarf' | 'diagnose' | 'angebot' | 'abschluss' | 'gewonnen' | 'verloren' | 'geparkt';
export type ChancenArt = 'retainer' | 'projekt' | 'workshop' | 'vermittlung' | 'software';
export type WertBasis = 'monat' | 'jahr' | 'einmalig';
export type Quelle = 'empfehlung' | 'event' | 'content' | 'outreach' | 'bestand' | 'inbound' | 'kampagne';
/** Rolle einer Person im Deal (27.09., Deal-Ebene): wer entscheidet, wer wirbt für uns, wer nutzt, wer bremst. */
export type DealRolle = 'entscheider' | 'fuersprecher' | 'nutzer' | 'blocker';
export type Qual = 'ja' | 'nein' | 'unklar';
/** Lead-Temperatur aus dem Score (lib/crm/score.ts): kalt < 25 · lau < 50 · warm < 75 · heiß. */
export type Temperatur = 'kalt' | 'lau' | 'warm' | 'heiss';
export type Gesellschaft = 'kdv' | 'kdc' | 'ug' | 'offen';

export interface Chance {
  id: string;
  titel: string;
  kontaktIds: string[];
  /** Anzeigename der Firma — seit 27.09. nur noch Anzeige; die Verbindung läuft über firmaId. */
  firma?: string;
  /** Die Firma per Kennung (f-…) — Umbenennen reißt die Verbindung nicht mehr (27.09.). */
  firmaId?: string;
  /** Rolle je Person im Deal (kontaktId → Rolle). */
  personenRollen?: Record<string, DealRolle>;
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
  /** Das erste „Entscheidung bis“, bevor es nach hinten verschoben wurde — setzt nur der Server (dealRegeln, 28.09., K4). */
  erwartetUrsprung?: string;
  /** Wie oft „Entscheidung bis“ nach hinten verschoben wurde — setzt nur der Server; ab 2 wird die Ampel gelb. */
  erwartetVerschoben?: number;
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
  /** Die Firma per Kennung (f-…), 27.09. — `kunde` bleibt der Anzeigename. */
  firmaId?: string;
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
  /** Aktuelle Phase im Ablauf des Produkts (id aus Leistung.phasen). */
  phase?: string;
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
/** Ein Schritt im Ablauf eines Produkts (25.09.) — ein Mandat steht in genau einer Phase. */
export interface ProduktPhase { id: string; name: string; dauerTage?: number; beschreibung?: string }
export type UnterlageArt = 'angebot' | 'vertrag' | 'deck' | 'onepager' | 'sonstiges';
/** Unterlage zu einem Produkt: Link (https) oder Notiz im Brain (/os/wissen?n=…). */
export interface Unterlage { id: string; titel: string; art: UnterlageArt; url?: string }
export interface Leistung {
  id: string;
  name: string;
  typ: LeistungTyp;
  /** Accelerant Curve: Einstieg → Kern → Premium. */
  stufe: 'einstieg' | 'kern' | 'premium';
  /**
   * Preis: `einheit` bleibt Freitext („Monat netto“); `basis` ist die strukturierte Form für die
   * Finanzplanung (27.09.) — fehlt sie, leitet lib/finanzen/produkte.ts sie aus der Einheit ab.
   */
  preis: { betrag: number; bis?: number; einheit: string; basis?: 'monat' | 'jahr' | 'einmalig' };
  /** Typische Laufzeit in Monaten (Planung: Umsatzbaustein läuft so lange) — 27.09. */
  laufzeitMonate?: number;
  /** Kosten-/Aufwandsanteil am Preis (0–1) für die Marge; optional Stunden je Einheit — 27.09. */
  aufwand?: { anteil?: number; stunden?: number };
  beschreibung?: string;
  lieferumfang: string[];
  grenzen?: string;
  ergebnis?: string;
  gesellschaft: Gesellschaft;
  status: 'aktiv' | 'entwurf' | 'eingestellt';
  quelle?: string;
  /** Produktlinie (frei, z. B. „Beratung & Begleitung“) — ohne Eintrag aus dem Typ abgeleitet (lib/crm/produkte.ts). */
  linie?: string;
  /** Ablauf in Phasen — ein Mandat auf diesem Produkt steht in einer davon. */
  phasen?: ProduktPhase[];
  unterlagen?: Unterlage[];
  /**
   * Angebotstexte (28.09., Kevin: „Produkte brauchen Angebotstexte“) — daraus baut das Angebots-Tool die Position.
   * Ein Produkt geht erst mit `leistungstext` auf „aktiv“ (Server 409, lib/crm/angebote.ts `produktAngebotFehlt`).
   */
  angebot?: LeistungAngebot;
  geaendert: string;
}
/** Texte eines Produkts für Angebote (28.09.) — `leistungstext` ist Pflicht, der Rest optional. */
export interface LeistungAngebot { titel?: string; einleitung?: string; leistungstext: string; ergebnis?: string; hinweise?: string }

// ── Angebote (28.09., Angebots-Tool) ─────────────────────────────────────
// Ein Angebot je Gesellschaft (kdc · kdv · ug) mit Positionen in CENT. Entwurf frei änderbar;
// „gestellt“ = festgeschrieben (Nummer lückenlos je Gesellschaft und Jahr, PDF + Prüfsumme in der
// Dateiablage, Inhalt unveränderlich); Änderung nur als neue Version mit Bezug. Regeln: lib/crm/angebote.ts
// (rein), Server: lib/crm/angebot-server.ts, Route /api/crm/angebot.
export type AngebotsStatus = 'entwurf' | 'gestellt' | 'angenommen' | 'abgelehnt' | 'abgelaufen' | 'ersetzt';
export type AngebotBasis = 'einmalig' | 'monat' | 'jahr';
export interface AngebotPosition {
  id: string;
  /** Aus welchem Produkt die Position stammt (Text und Preis wurden beim Hinzufügen übernommen). */
  leistungId?: string;
  titel: string;
  text: string;
  menge: number;
  /** z. B. „Stück“, „Monat“, „Tag“, „pauschal“. */
  einheit: string;
  /** Einzelpreis netto in Cent. */
  einzelpreisCent: number;
  rabattProzent?: number;
  /** 19, 7 oder 0. */
  ustSatz: number;
  basis: AngebotBasis;
  /** Nur bei monatlich/jährlich: Laufzeit, über die der Gesamtwert gerechnet wird. */
  laufzeitMonate?: number;
}
/** Festgehaltener Absender beim Stellen (ohne IBAN im Klartext — die steht nur im PDF). */
export interface AngebotAbsender { firmierung: string; zeilen: string[]; kontakt: string[]; fuss: string[]; kleinunternehmer: boolean }
/** Festgehaltener Empfänger beim Stellen. */
export interface AngebotEmpfaenger { name: string; firma?: string; zeilen: string[]; email?: string }
export interface Angebot {
  id: string;
  /** Vergibt nur der Server beim Stellen (Nummernformat der Gesellschaft). */
  nummer?: string;
  /** Laufende Nummer je Gesellschaft und Jahr — Grundlage der lückenlosen Vergabe (nur Server). */
  lauf?: { jahr: number; nr: number };
  gesellschaft: import('@/lib/einheiten').Gesellschaftskennung;
  /** Empfänger (Person) — beim Lösen des Personenbezugs (Art. 17) fällt er weg, das gestellte Angebot bleibt. */
  kontaktId?: string;
  firmaId?: string;
  dealId?: string;
  mandatId?: string;
  titel: string;
  positionen: AngebotPosition[];
  einleitung: string;
  schluss: string;
  /** YYYY-MM-DD */
  gueltigBis: string;
  zahlungszielTage: number;
  status: AngebotsStatus;
  version: number;
  vorgaengerId?: string;
  /** Nachfolger (neue Version), wenn es eine gibt — setzt nur der Server. */
  nachfolgerId?: string;
  gestelltAm?: string;
  gestelltVon?: string;
  /** SHA-256 des PDFs (hex) — setzt nur der Server beim Stellen. */
  pruefsumme?: string;
  pdfDateiId?: string;
  absender?: AngebotAbsender;
  empfaenger?: AngebotEmpfaenger;
  /** Grund bei „abgelehnt“ (Pflicht). */
  grund?: string;
  angenommenAm?: string;
  abgelehntAm?: string;
  abgelaufenAm?: string;
  /** Personenbezug gelöst (Art. 17) — Tag. */
  personGeloest?: string;
  angelegt: string;
  angelegtVon?: string;
  geaendert: string;
  geaendertVon?: string;
}

/** Zahlungsweg eines Kunden (28.09., Reiter „Umsatz“). */
export type Zahlungsweg = 'ueberweisung' | 'sepa' | 'karte' | 'bar';
/**
 * Zahlungsmöglichkeiten eines Kunden (28.09.) — an der Firma, bei einer Person ohne Firma an der Person.
 * Säuberung und Anzeige: lib/crm/zahlung.ts. Die IBAN wird NUR maskiert gezeigt und geht nie in einen Export oder an einen Agenten.
 */
export interface Zahlungsdaten {
  weg?: Zahlungsweg;
  /** Zahlungsziel in Tagen. */
  zielTage?: number;
  /** Rechnungsempfänger, wenn abweichend (Buchhaltung, Einkauf). */
  empfaenger?: { name?: string; email?: string; anschrift?: string };
  ustId?: string;
  /** Bestellnummer / Referenz des Kunden — gehört auf jede Rechnung. */
  referenz?: string;
  /** Grundform ohne Leerzeichen; nur mit gültiger Prüfziffer gespeichert. Im Browser nur maskiert (lib/crm/zahlung.ts `zahlungMaskiert`). */
  iban?: string;
  /** Nur in Antworten an den Browser (28.09.): eine IBAN ist gespeichert — `iban` ist dann maskiert. Nie gespeichert. */
  ibanGesetzt?: boolean;
  /** Nur beim Speichern (28.09.): die gespeicherte IBAN ausdrücklich entfernen. Nie gespeichert. */
  ibanEntfernen?: boolean;
  /** Nur bei SEPA-Lastschrift. */
  sepa?: { mandatsreferenz?: string; datum?: string };
  /** Zahlungslink (https), z. B. Kreditkarte/PayPal. */
  link?: string;
  notiz?: string;
  geaendert?: string;
  geaendertVon?: string;
}

export type FirmaRolle = 'zielkunde' | 'kunde' | 'ex_kunde' | 'partner' | 'dienstleister' | 'investor' | 'netzwerk' | 'wettbewerb' | 'offen';
/** Ein Unternehmen — Stammdaten an EINER Stelle, Personen zeigen per firmaId darauf. */
export interface Firma {
  id: string;
  name: string;
  domain?: string;
  webseite?: string;
  branche?: string;
  /** Mehrere Branchen (27.09.): `branche` bleibt der zusammengesetzte Anzeigetext. */
  branchen?: string[];
  mitarbeiter?: string;
  umsatz?: string;
  stadt?: string;
  gegruendet?: string;
  linkedin?: string;
  telefon?: string;
  email?: string;
  rechtsform?: string;
  rolle: FirmaRolle;
  /** Ebene 1: Qualifizierung dieser Firma als Lead (fehlt → aus den Personen abgeleitet). */
  lead?: Lead;
  /** Rolle von Hand gesetzt — der Abgleich leitet sie dann nicht mehr ab. */
  rolleVonHand?: boolean;
  marktinfo?: string;
  notiz?: string;
  /** Zahlungsmöglichkeiten (28.09., lib/crm/zahlung.ts) — gelten für alle Personen der Firma. */
  zahlung?: Zahlungsdaten;
  /** BEAN-Kundengruppe von Hand (28.09., H4, lib/crm/bean.ts) — fehlt es, gilt die Ableitung (`beanFirma`); gilt dann auch für Personen ohne eigene Wahl. */
  bean?: import('./bean').BeanId;
  /**
   * Mutterfirma (28.09., #7, lib/crm/konzern.ts) — zeigt auf eine bestehende Firma, nie auf sich selbst,
   * keine Kreise (Säuberung + `mutterPruefen` + Verbindungsprüfung). Töchter ergeben sich aus den Verweisen.
   */
  mutterId?: string;
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
  /** Kennung des Termins im Kalender, wenn das Event dort angelegt wurde (27.09.) — verhindert einen zweiten Termin. */
  kalenderUid?: string;
  /** Wer es bearbeitet: Team-Kürzel (kevin, malin) oder „beide“ — fehlt es, gilt die/der Verantwortliche der Welt (lib/crm/team.ts). */
  zustaendig?: string;
  /** Veranstaltungsmarke, unter der das Event läuft (Kevin 27.09.: „Make.One“). Fehlt sie, gilt MARKE_EVENTS (lib/crm/events.ts) — abgeleitet, nie zurückgeschrieben. */
  marke?: string;
  // ── Besuchte Events (Reiter „Events“, 03.10., lib/crm/besuche.ts) — alles optional, der Altbestand liest ohne Migration ──
  /** Für wen wir dort sind: MAKE selbst (Standard, fehlt = make) oder ein Kunde (Firma der Kartei, ggf. mit Mandat). */
  fuer?: EventFuer;
  /** Anmeldestand eines BESUCHTEN Events; fehlt er, gilt er abgeleitet aus `status` (`anmeldungVon`). `status` zieht beim Setzen mit. */
  anmeldung?: EventAnmeldung;
  /** Wer von uns hingeht (Team-Kürzel, lib/crm/team.ts). */
  wer?: string[];
  /** Link zur Veranstaltung (nur https). */
  link?: string;
  /** Wen wir treffen wollen — Personen/Firmen aus der Kartei; beim Event abhaken (getroffen). Personenbezogen (Art. 15/17: lib/crm/person-verweise.ts). */
  zielpersonen?: EventZielperson[];
  /** Protokoll „An Kunden übergeben“ (Auftragsverarbeitung): wann, wer, wie viele Kontakte — nie die Kontakte selbst. */
  uebergaben?: EventUebergabe[];
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}
/** Für wen ein besuchtes Event ist: wir selbst oder ein Kunde (Firma der Kartei; das Mandat ist optional). */
export type EventFuer = { art: 'make' } | { art: 'kunde'; firmaId: string; mandatId?: string };
/** Anmeldestand eines besuchten Events. */
export type EventAnmeldung = 'geplant' | 'angemeldet' | 'abgesagt' | 'besucht';
/** Ein Ziel „wen wollen wir treffen“: eine Person oder eine Firma der Kartei; `getroffen` wird beim Event abgehakt. */
export interface EventZielperson { kontaktId?: string; firmaId?: string; getroffen?: boolean }
/**
 * Ein Eintrag im Übergabe-Protokoll (An Kunden übergeben) — die Übermittlung an einen Dritten (Art. 13/15/19 DSGVO).
 * Seit 03.10. (netz-recht) optional dazu: Empfänger (Kunden-Firma), Dateiname, Kennungen der übergebenen Personen (fallen bei Art. 17
 * mit der Person weg — `personEntfernen`) und `avvBzwHinweisBestaetigt` (der Haken im Dialog: Rolle/Vertrag mit dem Kunden geklärt).
 */
export interface EventUebergabe { am: string; von: string; anzahl: number; empfaengerFirmaId?: string; dateiname?: string; kontaktIds?: string[]; avvBzwHinweisBestaetigt?: boolean }
/** Die Schritte nach dem Kennenlernen (Netzwerken — Erfassen, 02.10.). Liste, Beschriftung und Regeln: lib/crm/netzwerken.ts. */
export type NetzwerkSchritt = 'termin' | 'qualifizieren' | 'followup' | 'vermitteln' | 'andere' | 'angebot' | 'makeone' | 'nur-kontakt';
/** Was „Netzwerken“ an der Teilnahme festhält (alles optional im Altbestand; gesäubert in lib/crm/speicher.ts `zusatz`). */
export interface NetzwerkenAngabe {
  /** Kennung der Erfassung (Idempotenz — dieselbe Erfassung wirkt nur einmal). */
  erfassungId: string;
  schritt: NetzwerkSchritt;
  /** Wer die Person danach betreut (Speichername). */
  zustaendig: string;
  /** Wer sie kennengelernt hat (Speichername). */
  erfasstVon: string;
  /** ISO — wann erfasst (die Zeit der Begegnung, nicht des Sendens). */
  erfasstAm: string;
  /** Info zum Gespräch (Freitext, höchstens 1.000 Zeichen). */
  info?: string;
  /** Termin (Berliner Wandzeit), wenn der Schritt „Termin“ war. */
  terminAm?: string;
  /** Schlüssel des Termins im Kalender (Link „Termin öffnen“) — erst gesetzt, wenn der Termin wirklich angelegt ist. */
  terminId?: string;
  /**
   * Danke-Mail: gewählte Anrede, der Tag, an dem sie als „raus“ bestätigt wurde, bzw. der Tag, an dem bewusst darauf verzichtet wurde
   * („Nicht senden“, 03.10.) — beides nimmt sie aus Glocke und Heute.
   */
  danke?: { anrede?: 'Du' | 'Sie'; rausAm?: string; verzichtetAm?: string };
  /** An DIESEM Event neu angelegt (nicht vorher bekannt, nicht angehängt) — nur sie gehen ungefragt in den Kunden-Export (03.10.). */
  neuAngelegt?: true;
  /** Beim Erfassen wurde die Visitenkarte fotografiert — Herkunftsangabe im Kunden-Export (das Foto selbst fällt nach 6 Monaten). */
  kartenfoto?: true;
  /** Es gab KEIN persönliches Gespräch (Haken beim Erfassen) — dann kein Danke-Entwurf (§ 7 UWG), Datenschutzhinweis beim ersten Kontakt. */
  keinGespraech?: true;
}
export type TeilnahmeStatus = 'vorgemerkt' | 'eingeladen' | 'zugesagt' | 'abgesagt' | 'da' | 'no_show';
export interface Teilnahme {
  id: string;
  eventId: string;
  kontaktId: string;
  status: TeilnahmeStatus;
  notiz?: string;
  followUpAm?: string;
  /** Nachfassen bewusst ausgelassen (27.09.): der Eintrag verschwindet aus Follow-up und Power Hour, zählt aber NICHT als nachgefasst — die Kennzahl bleibt ehrlich. */
  nachfassenVerzichtet?: string;
  rolle?: 'gast' | 'co_host' | 'speaker';
  /** Fotos nur mit ausdrücklicher Freigabe. */
  fotofreigabe?: boolean;
  /** Rückmeldung des Gastes nach dem Event (27.09.): Note 1–5 und ein Satz. */
  feedback?: { note?: number; text?: string; am?: string };
  eingeladenAm?: string;
  einladungsweg?: 'persoenlich' | 'telefon' | 'mail' | 'linkedin';
  /** Wer die Person einlädt und nachfasst — hält meist die Beziehung. */
  einladenDurch?: string;
  /** Wer beim Einlass „da“ oder „nicht gekommen“ gesetzt hat. */
  eingechecktVon?: string;
  /** Erfasst über „Netzwerken“ (02.10., lib/crm/netzwerken.ts): nächster Schritt, Zuständigkeit, Danke-Mail — Quelle des Abendberichts. */
  netzwerken?: NetzwerkenAngabe;
  geaendert: string;
  /** Wer zuletzt geändert hat (vom Server gesetzt) — für „Zuletzt im Team“. */
  geaendertVon?: string;
}

// ── Marketing (24.09. nachts) ────────────────────────────────────────────
/** Ein Segment = gespeicherter Filter über die Kartei (für Kampagnen, Einladungen, Newsletter). */
export interface SegmentKriterien {
  lebensphase?: string[]; kreis?: string[]; prio?: string[]; firmaRolle?: string[]; herkunft?: string[];
  /** Rollen der Person (mehrfach, 26.09.) — trifft, wenn eine der gewählten dabei ist. */
  branche?: string; stadt?: string; stichwort?: string;
  /** Nur, wer über diesen Kanal zulässig erreichbar ist (Ampel grün, bei 'persoenlich' alle). */
  kanal?: 'mail' | 'telefon' | 'linkedin' | 'newsletter' | 'einladung';
  mitChance?: boolean; ohneKontaktSeitTagen?: number;
  /** Lead-Temperatur (27.09.): z. B. nur kalte Leads zum Vernetzen. */
  temperatur?: Temperatur[];
  /** Lifecycle (28.09.): gesetzt, sonst der Vorschlag aus den Daten (lib/crm/vorschlaege.ts `lifecycleVon`). */
  lifecycle?: import('./lifecycle').LifecyclePhase[];
  /** BEAN-Kundengruppe (28.09., H4): von Hand, sonst abgeleitet (lib/crm/bean.ts `beanVon`). */
  bean?: import('./bean').BeanId[];
  /** Typ, Kategorie, Label (mehrfach, 28.09.): trifft, wenn die Person EINEN der Werte trägt (Groß-/Kleinschreibung egal). */
  typ?: string[]; kategorie?: string[]; label?: string[];
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
  /** Kosten des Beitrags in Euro (27.09., für Kosten je Anfrage) — Anzeigen, Produktion, Tools. */
  kostenEuro?: number;
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
  /** In wessen Namen die Ausgabe erscheint (27.09.): kevin, malin oder „marke“. */
  stimme?: string;
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
  ergebnisse: { kontaktId: string; ergebnis: KampagnenErgebnis; am: string; /** Wer angesprochen hat. */ von?: string }[];
  /** Wer sie angelegt hat — von Hand oder aus einem Vorschlag eines Heads. */
  von: 'hand' | 'head-sales' | 'head-marketing';
  /** Kosten der Kampagne in Euro (27.09.) — für Kosten je qualifiziertem Lead. */
  kostenEuro?: number;
  notiz?: string;
  /** Nur Playbook „vernetzen“: Texte, Thema, Folgetage und Tagesportion — modular je Kampagne (lib/crm/netzwerk.ts). */
  vernetzen?: import('./netzwerk-form').VernetzenEinstellung;
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

// ── Follow-up-Ebene (27.09., Kevin: „die ganze Follow-up-Ebene sauber einpflegen“) ──
// Bisher lagen Nachfass-Termine an acht Stellen (nächster Schritt und Wiedervorlage am
// Kontakt, am Deal, Teilnahme.followUpAm, Mandat.naechstesReview, Kampagnen-Schritte,
// Aufgaben, Inbox-Wiedervorlage). Jetzt gibt es EIN Objekt mit Bezug, Art, Fälligkeit,
// Zuständigkeit, Status und Ergebnis — mehrere je Person, mit Herkunft.
export type FollowUpBezugArt = 'kontakt' | 'firma' | 'chance' | 'mandat' | 'event';
export type FollowUpArt = 'anruf' | 'mail' | 'linkedin' | 'termin' | 'nachricht' | 'sonstig';
export type FollowUpStatus = 'offen' | 'erledigt' | 'verpasst' | 'abgesagt';
export type FollowUpQuelle = 'hand' | 'regel' | 'kadenz' | 'kampagne' | 'event' | 'head' | 'zoe' | 'deal';
export interface FollowUp {
  id: string;
  /** Woran es hängt — immer mit der Person, die man anspricht (kontaktId), wenn es eine gibt. */
  bezug: { art: FollowUpBezugArt; id: string };
  kontaktId?: string;
  art: FollowUpArt;
  text: string;
  /** Tag YYYY-MM-DD. */
  faellig: string;
  /** Uhrzeit HH:MM, wenn es einen Termin gibt. */
  uhrzeit?: string;
  zustaendig: string;
  status: FollowUpStatus;
  /** Was dabei herauskam (Gesprächsergebnis wie in erfassen.ts) — beim Erledigen. */
  ergebnis?: string;
  notiz?: string;
  quelle: FollowUpQuelle;
  /** Verknüpfte Aufgabe im Board, wenn man es sich dorthin geholt hat. */
  aufgabeId?: string;
  /**
   * Termin, an dem das Follow-up hängt (K6a, 29.09.; `kalender|uid(::RID)` wie `Aktivitaet.terminUid`) — z. B. „Termin
   * vorbereiten“ einer Buchung. Verschiebt sich der Termin, zieht die Verbindungsprüfung das Datum nach (Vortag).
   */
  terminUid?: string;
  /** Wie oft verschoben — ab dem dritten Mal ist es ehrlicherweise keine Zusage mehr. */
  verschoben?: number;
  erledigtAm?: string;
  angelegt: string;
  geaendert: string;
  geaendertVon?: string;
}

/** Pflegbare Wertelisten (27.09., Stammdaten) — was frei ist, steht hier; woran Programmlogik hängt, bleibt fest im Code. */
export interface Wertelisten {
  verlustgruende?: string[];
  /** Kadenz je Kreis in Tagen (kern/aktiv/weit) — wann eine Beziehung ohne Kontakt als „fällig“ gilt. */
  kadenzTage?: Record<string, number>;
  /** Gesprächsergebnisse (frei erweiterbar; die festen bleiben). */
  ergebnisse?: string[];
  /** Ziele je Monat: Umsatz neu (€), SQL, Gespräche — für die Kennzahlen gegen Ziel. */
  ziele?: { umsatzNeuMonat?: number; sqlMonat?: number; gespraecheWoche?: number };
  /** Eigene Einträge zu den Standardlisten (27.09.): Branchen (mehrfach je Firma), Lead-Typen, Kategorien. */
  branchen?: string[]; typen?: string[]; kategorien?: string[];
  /** Labels (28.09.): frei vergebbar, keine Standardwerte — nur eigene. */
  labels?: string[];
}

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
  /** Follow-up-Ebene (27.09.). */
  followups: FollowUp[];
  /** Angebote (28.09., Angebots-Tool) — geschrieben nur über /api/crm/angebot. */
  angebote: Angebot[];
  marketing?: MarketingEinstellung;
  /** Pflegbare Wertelisten (27.09.). */
  wertelisten?: Wertelisten;
  /**
   * Scoring-Einstellungen (03.10., lib/crm/scoring.ts) — NUR beim Lesen angehängt (`ladeCrm`, aus dem eigenen Bestand
   * `crm-scoring`), nie im Bestand `crm` gespeichert. So sehen Leads, Akte, Lifecycle, Segmente und ZOE überall dieselben Werte.
   */
  scoring?: import('./scoring').ScoringEinstellungen;
  /** Wahrscheinlichkeiten je Stufe, von Hand überschreibbar (wie in KEMARIS Operations „von_hand“). */
  wahrscheinlichkeiten?: Partial<Record<ChancenStufe, number>>;
}

export const CRM_LISTEN = ['firmen', 'chancen', 'mandate', 'leistungen', 'events', 'teilnahmen', 'sitzungen', 'antraege', 'verarbeitungen', 'segmente', 'beitraege', 'newsletter', 'kampagnen', 'followups', 'angebote'] as const;
export type CrmListe = typeof CRM_LISTEN[number];
