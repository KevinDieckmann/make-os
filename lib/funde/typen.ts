// ─── Funde — Kampagne „Homepage“ (30.10.2026, KAMPAGNE_HOMEPAGE_PLAN.md) — Typen ────────────────────────────────────────────
// Ein Fund = ein Betrieb (Gastro, Handwerk, Einzelhandel) aus einer öffentlichen Quelle (OpenStreetMap) oder von Hand eingetragen, dessen
// Website fehlt oder schlecht ist. Funde sind KEINE Kontakte: sie liegen kurz im eigenen Bestand `kampagne-funde--<haushalt>` und kommen erst
// mit der Freigabe im ZOE-Stapel in die Kartei (Firma + Kontakt + Lead, lib/funde/uebernehmen.ts). Nicht übernommene Funde löscht die Frist.

export type FundBranche = 'gastro' | 'handwerk' | 'einzelhandel';
export const FUND_BRANCHEN: { id: FundBranche; name: string }[] = [
  { id: 'gastro', name: 'Gastronomie' }, { id: 'handwerk', name: 'Handwerk & Dienstleistung' }, { id: 'einzelhandel', name: 'Einzelhandel' },
];
export const istFundBranche = (v: unknown): v is FundBranche => FUND_BRANCHEN.some(b => b.id === v);

/**
 * neu → vorbereitet (Vorschau + Entwurf liegen, Vorschlag im Stapel) → uebernommen (in der Kartei) → gesendet (Mail raus) ·
 * verworfen (von Hand bzw. Stapel abgelehnt) · gesperrt (Sperrliste/Abmeldung — nie wieder)
 */
export type FundStatus = 'neu' | 'vorbereitet' | 'uebernommen' | 'gesendet' | 'verworfen' | 'gesperrt';

export interface FundAdresse { strasse?: string; hausnummer?: string; plz?: string; ort?: string }

export interface FundBewertung {
  /** Bedarf 0–100: hoch = keine oder schlechte Website. */
  punkte: number;
  gruende: string[];
  website: boolean;
  erreichbar?: boolean;
  https?: boolean;
  mobil?: boolean;
  /** PageSpeed-Mobilwert 0–100 (nur mit Schlüssel). */
  pagespeed?: number;
  /** Jüngstes Jahr im Copyright-Vermerk der Seite. */
  jahr?: number;
  impressum?: boolean;
  gemessenAm: string;
}

/** Die Vorschau: nur Fakten + eigene Texte, nie Bilder/Logos/Texte des Betriebs (KAMPAGNE_HOMEPAGE_PLAN.md › 5). */
export interface FundVorschau {
  farbe: string;
  ueberschrift: string;
  willkommen: string;
  leistungen: string[];
  /** Texte kommen vom Modell (KI-VO Art. 50: die Seite sagt es). */
  ki: boolean;
  /** Öffentlicher Link erst nach Freigabe: nur der Fingerabdruck des Tokens, Ablauf. */
  tokenHash?: string;
  gueltigBis?: string;
}

export interface FundEntwurf { betreff: string; text: string; anruf: string; ki: boolean }

export interface Fund {
  id: string;
  kampagneId: string;
  quelle: 'osm' | 'hand';
  /** OSM-Kennung `n123`/`w123`/`r123` — gegen Doppelte über Läufe hinweg. */
  osmId?: string;
  name: string;
  branche: FundBranche;
  /** OSM-Wert (restaurant, hairdresser …) bzw. von Hand. */
  kategorie?: string;
  adresse?: FundAdresse;
  gebiet?: string;
  oeffnungszeiten?: string;
  website?: string;
  email?: string;
  telefon?: string;
  bewertung?: FundBewertung;
  vorschau?: FundVorschau;
  entwurf?: FundEntwurf;
  status: FundStatus;
  grund?: string;
  angelegt: string;
  geaendert: string;
  /** Wer ihn von Hand eingetragen bzw. zuletzt entschieden hat (Speichername) — Systemlauf: fehlt. */
  von?: string;
  vorschlagId?: string;
  kontaktId?: string;
  firmaId?: string;
  gesendet?: { am: string; ueber: string; von: string; eigenesRisiko: true };
  /** Die öffentliche Vorschau wurde geöffnet (nur Zeitpunkt, keine Adresse/Kennung des Aufrufs). */
  angesehenAm?: string;
}

export interface FundeEinstellungen {
  /** Der Inhaber hat Mail + Anruf ohne Einwilligung AUF EIGENES RISIKO freigeschaltet (Vorgabe aus, KAMPAGNE_HOMEPAGE_PLAN.md › Kevins Entscheidungen). */
  eigenesRisiko?: { an: true; seit: string; von: string };
  /** Absender-Postfach (eigenes Business-Postfach eines Inhabers) — wie beim Formular „Angebot anfordern“. */
  absender?: { person: string; postfach: string };
  /** Stadt + Gebiete (Bezirke) für die OSM-Abfrage — Instanz-Daten, nie fest im Code (Vorlagen in lib/funde/osm.ts). */
  stadt?: string;
  gebiete: string[];
  /** Nächstes Gebiet im Abendlauf (reihum). */
  gebietIndex: number;
  branchen: FundBranche[];
  /** Funde je Abend (Vorgabe 20, höchstens 50). */
  jeAbend: number;
  /** Die Kampagne in der Markttraktion, an der die Funde hängen. */
  kampagneId?: string;
  segmentId?: string;
  /** Absender-Gesellschaft (Kennung aus dem Register — Name über `gesellschaftenLaden`), Vorgabe die erste Business-Gesellschaft. */
  gesellschaft?: string;
  /** Das Angebot: ein Produkt aus dem Katalog (`crm.leistungen`) — Name und Preis kommen nur von dort. */
  produktId?: string;
  /** Persona (31.10.): nur diese OSM-Arten (z. B. restaurant, cafe) — fehlt es, zählt jede Art der gewählten Branchen. */
  arten?: string[];
  /** Persona (31.10.): nur Betriebe mit veröffentlichter Mail-Adresse (OSM oder Startseite) — der Kanal ist die Mail. */
  nurMitMail?: boolean;
}

/** Vorlagen für die Persona-Filter (Kevin 31.10.: „Restaurants & Cafés“). */
export const ARTEN_VORLAGEN: { id: string; name: string; arten: string[] }[] = [
  { id: 'restaurant-cafe', name: 'Nur Restaurants & Cafés', arten: ['restaurant', 'cafe'] },
];

export interface FundeLaufStand { tag: string; gebiet?: string; geholt: number; neu: number; vorbereitet: number; fehler?: string; am: string }

export interface FundeBestand {
  funde: Fund[];
  einstellungen: FundeEinstellungen;
  /** OSM-Kennungen verworfener/gesperrter/gelöschter Funde — der Abendlauf bringt sie nie wieder (nur Kennung, kein Name). */
  bekannt: string[];
  lauf?: FundeLaufStand;
}

export const JE_ABEND_VORGABE = 20;
export const JE_ABEND_MAX = 50;
/** Ab diesen Punkten gilt eine Website als „schlecht“ (bzw. fehlt) — darunter kein Fund. */
export const BEDARF_AB = 50;
export const PLAYBOOK_ID = 'homepage-funde';
export const SEGMENT_LABEL = 'homepage-funnel';
/** Tage bis zum Anruf, wenn keine Antwort kam (Kevin 30.10.: 72 Stunden). */
export const ANRUF_NACH_TAGEN = 3;
/** Gültigkeit des öffentlichen Vorschau-Links. */
export const VORSCHAU_TAGE = 60;
/** Kennung des öffentlichen Links: `v1-<32 hex>` (nur der Fingerabdruck liegt im Bestand). */
export const VORSCHAU_TOKEN = /^v1-[0-9a-f]{32}$/;

export const leereEinstellungen = (): FundeEinstellungen => ({ gebiete: [], gebietIndex: 0, branchen: ['gastro', 'handwerk', 'einzelhandel'], jeAbend: JE_ABEND_VORGABE });
export const leererBestand = (): FundeBestand => ({ funde: [], einstellungen: leereEinstellungen(), bekannt: [] });
