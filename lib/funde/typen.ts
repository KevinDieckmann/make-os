// ─── Funde — Kampagne „Homepage“ (30.10.2026, KAMPAGNE_HOMEPAGE_PLAN.md) — Typen ────────────────────────────────────────────
// Ein Fund = ein Betrieb (Gastro, Handwerk, Einzelhandel) aus einer öffentlichen Quelle (OpenStreetMap) oder von Hand eingetragen, dessen
// Website fehlt oder schlecht ist. Funde sind KEINE Kontakte: sie liegen kurz im eigenen Bestand `kampagne-funde--<haushalt>` und kommen erst
// mit der Freigabe im ZOE-Stapel in die Kartei (Firma + Kontakt + Lead, lib/funde/uebernehmen.ts). Nicht übernommene Funde löscht die Frist.

export type FundBranche = 'gastro' | 'handwerk' | 'einzelhandel' | 'startup' | 'unternehmer' | 'scaleup';
export const FUND_BRANCHEN: { id: FundBranche; name: string }[] = [
  { id: 'gastro', name: 'Gastronomie' }, { id: 'handwerk', name: 'Handwerk & Dienstleistung' }, { id: 'einzelhandel', name: 'Einzelhandel' },
  // Zweites Suchprofil (31.10., lib/funde/icp.ts): Start-ups und innovative Unternehmer — keine OSM-Quelle, nur Recherche-Import; kein Website-Entwurf.
  { id: 'startup', name: 'Start-ups' },
  { id: 'unternehmer', name: 'Innovative Unternehmer' },
  { id: 'scaleup', name: 'Scale-ups' },
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
  /** Festnetz (oder eine ausländische Nummer) — normiert „+49…“ (lib/funde/telefon.ts). */
  telefon?: string;
  /** Handynummer, die der Betrieb selbst veröffentlicht (+49 15x/16x/17x) — zählt in der Erreichbarkeit am meisten (Kevin 31.10.). */
  mobil?: string;
  /** Inhaber/Betreiber aus einer veröffentlichten Anbieterkennzeichnung (Impressum, Lieferdienst-Impressum) — nie geraten (31.10.). */
  inhaber?: string;
  inhaberArt?: 'person' | 'firma';
  /** Instagram-Profil des Betriebs (Handle ohne @) — Instagram-Nachrichten sind elektronische Post: Ampel rot, nur zum Ansehen. */
  instagram?: string;
  /** Woher jede Angabe stammt (Feld → http(s)-Adresse) — Art. 14 Abs. 2 lit. f (Quelle), höchstens 10. */
  quellen?: Record<string, string>;
  bewertung?: FundBewertung;
  /** Thema der Firma in Stichworten (Profil Start-ups, aus Quelle bzw. Website). */
  thema?: string;
  /** ICP-Bewertung (Profil Start-ups, lib/funde/icp.ts): Score, Stufe A/B/C, Einstieg, Gründe, Aufhänger. */
  icp?: import('./icp').IcpErgebnis;
  /** Steckbrief aus öffentlichen Quellen (ICP-Profile) — geht bei der Übernahme an die Firma (lib/crm/icp-firma.ts). */
  steckbrief?: import('@/lib/crm/icp-firma').FirmaSteckbrief;
  /** Niveau-Analyse der vorhandenen Website gegen unser Paket (lib/funde/analyse.ts) — nur bei erreichbarer eigener Seite. */
  analyse?: import('./analyse').AnalyseErgebnis & { leistung?: { lcpMs?: number; gewichtKb?: number; anfragen?: number; quelle: string } };
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
  /** Die Mail liegt (freigegeben „auf eigenes Risiko“) im Mail-Stapel der Funde-Kampagne (M1, 01.11.) — gesendet wird gedrosselt im Takt. */
  post?: { id: string; am: string; von: string };
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
  /** Kampagne des Profils Start-ups (31.10., lib/funde/icp.ts) — eigene Kampagne/Segment, nie mit dem Homepage-Funnel gemischt. */
  kampagneStartupId?: string;
  /** Kampagne des Profils Scale-ups (31.10.) — eigene Ansprache (Struktur im Vertrieb). */
  kampagneScaleupId?: string;
  /** Kampagne des Profils innovative Unternehmer (31.10.) — planbares Neugeschäft. */
  kampagneUnternehmerId?: string;
  /** Absender-Gesellschaft (Kennung aus dem Register — Name über `gesellschaftenLaden`), Vorgabe die erste Business-Gesellschaft. */
  gesellschaft?: string;
  /** Das Angebot: ein Produkt aus dem Katalog (`crm.leistungen`) — Name und Preis kommen nur von dort. */
  produktId?: string;
  /** Persona (31.10.): nur diese OSM-Arten (z. B. restaurant, cafe) — fehlt es, zählt jede Art der gewählten Branchen. */
  arten?: string[];
  /** Persona (31.10.): nur Betriebe mit veröffentlichter Mail-Adresse (OSM oder Startseite). */
  nurMitMail?: boolean;
  /** Persona (31.10. abends, Kevin: „wir werden sie anrufen“): nur Betriebe mit veröffentlichter Telefonnummer (Handy oder Festnetz). */
  nurMitTelefon?: boolean;
}

/** Vorlagen für die Persona-Filter (Kevin 31.10.: „Restaurants & Cafés“). */
export const ARTEN_VORLAGEN: { id: string; name: string; arten: string[] }[] = [
  { id: 'restaurant-cafe', name: 'Nur Restaurants & Cafés', arten: ['restaurant', 'cafe'] },
];

/** `texte` (02.11.): womit die Vorschau-Texte dieses Laufs entstanden — Modell oder Regelwerk; `ohneKi` = warum ohne (z. B. Hintergrund-KI aus). */
export interface FundeLaufStand { tag: string; gebiet?: string; geholt: number; neu: number; vorbereitet: number; fehler?: string; am: string; texte?: 'ki' | 'regelwerk'; ohneKi?: string }

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

/** Je Profil eine Kampagne mit Segment und Label (31.10.): Homepage-Funnel (Gastro/Handwerk/Einzelhandel) und ICP Start-ups. */
export interface FundProfil { id: 'homepage' | 'startup' | 'unternehmer' | 'scaleup'; playbook: string; segmentId: string; segmentName: string; beschreibung: string; label: string }
export const PROFIL_HOMEPAGE: FundProfil = { id: 'homepage', playbook: PLAYBOOK_ID, segmentId: 'seg-homepage-funnel', segmentName: 'Homepage-Funnel', beschreibung: 'Betriebe aus der Kampagne „Homepage“ (übernommene Funde).', label: SEGMENT_LABEL };
export const PROFIL_STARTUP: FundProfil = { id: 'startup', playbook: 'icp-startups', segmentId: 'seg-icp-startups', segmentName: 'ICP · Start-ups', beschreibung: 'Innovative Start-ups aus öffentlichen Förder-, Hochschul- und Startup-Listen (übernommene Funde, ICP-Raster).', label: 'icp-startups' };
export const PROFIL_SCALEUP: FundProfil = { id: 'scaleup', playbook: 'icp-scaleups', segmentId: 'seg-icp-scaleups', segmentName: 'ICP · Scale-ups', beschreibung: 'Scale-ups im Vertriebsausbau aus öffentlichen Quellen (Finanzierungsrunden, Portfolio-Listen) — übernommene Funde, ICP-Raster.', label: 'icp-scaleups' };
export const PROFIL_UNTERNEHMER: FundProfil = { id: 'unternehmer', playbook: 'icp-unternehmer', segmentId: 'seg-icp-unternehmer', segmentName: 'ICP · Innovative Unternehmer', beschreibung: 'Inhabergeführte, innovative Firmen mit fertigem Produkt aus öffentlichen Quellen (Innovationspreise, Förderprogramme) — übernommene Funde, ICP-Raster.', label: 'icp-unternehmer' };
/** Profile aus der ICP-Recherche (Import, kein OpenStreetMap, keine Website-Vorschau). */
export const istIcpBranche = (b: FundBranche): b is 'startup' | 'unternehmer' | 'scaleup' => b === 'startup' || b === 'unternehmer' || b === 'scaleup';
export const profilFuer = (b: FundBranche): FundProfil => (b === 'startup' ? PROFIL_STARTUP : b === 'unternehmer' ? PROFIL_UNTERNEHMER : b === 'scaleup' ? PROFIL_SCALEUP : PROFIL_HOMEPAGE);
/** Gespeicherte Kampagne eines Profils. */
export const kampagneVon = (e: FundeEinstellungen, p: FundProfil): string | undefined => (p.id === 'startup' ? e.kampagneStartupId : p.id === 'unternehmer' ? e.kampagneUnternehmerId : p.id === 'scaleup' ? e.kampagneScaleupId : e.kampagneId);
