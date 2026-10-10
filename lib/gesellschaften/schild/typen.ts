// ─── MAKE OS — Unternehmen › Schild: Datenform und Grundbegriffe (rein, client-sicher, 10.10.) ───────────────────────
// Kevin 10.10.: „Welche Infos muss ich immer dokumentiert bei mir haben — rechtlich wie ein Schild aufstellen, das Risiko immer
// wieder mitbewerten, damit wir nicht angreifbar sind. Maximal ausbauen.“ Grundlage: research/unternehmen/FAKTEN_UNTERNEHMEN_RECHT.md.
// Hinweis überall: keine Rechtsberatung — anwaltlich gegenlesen.
//
// WO DIE DATEN LIEGEN (Trennungsregel „nie gemischt“, TRENNUNG_PRIVAT_BUSINESS.md): ein EIGENER Business-Bestand je Haushalt,
// `unternehmen-schild--<haushalt>` (Speicher-Register: IN_BUSINESS). Das Gesellschafts-Register (`gesellschaften--*`) bleibt, wie es
// ist (gemischt: die Selbstständigkeit gehört zu Privat) — hier steht je BUSINESS-Gesellschaft (`bereichVon` = business: die festen
// Business-Gesellschaften und jede Register-Gesellschaft `g-…`) EIN Eintrag mit derselben Kennung. Eine Privat-Einheit nimmt der Server
// nie an (400, `GEHOERT_ZU_PRIVAT`) und liefert sie nie aus.
//
// GESPEICHERT wird nur, was ein Mensch festhält: Profil (Beschäftigte, Umsatz, Größenklasse …), Dokumente (Status, Datum, Datei-Kennungen
// der verschlüsselten Ablage), Vermerke „erledigt am“ zu Pflichten, Ereignisse, Risiken mit Bewertungs-Verlauf, Marken, Domains,
// Versicherungen und Entwürfe aus Vorlagen. GERECHNET (nie gespeichert): Soll-Liste je Rechtsform, Fristen, Schwellen, Ampeln,
// Prüftermine, Aufbewahrungsfristen. Personen nur als Speichername eines Kontos des Haushalts (`von`, `verantwortlich`) — nie Dritte.

import type { GesellschaftId } from '@/lib/einheiten';

/** Name des Bestands je Haushalt (Speicher-Register: `unternehmen-schild--*`, Bereich Business). */
export const schildName = (haushalt: string) => `unternehmen-schild--${haushalt}`;

/** Stand der Regeln (Fristen, Schwellen, Kataloge) — jede Aussage trägt ihn; älter als 12 Monate → „Stand prüfen“. */
export const REGEL_STAND = '2026-10-10';
/** Der Pflicht-Hinweis unter allem, was dieser Bereich sagt (research › 6b). */
export const SCHILD_HINWEIS = 'Hinweis, keine Rechtsberatung — anwaltlich und steuerlich gegenlesen.';

// ── Dokumente ────────────────────────────────────────────────────────────────────────────────────────────────────

export type DokStatus = 'vorhanden' | 'entwurf' | 'nicht-noetig';
export const DOK_STATUS: readonly { id: DokStatus; label: string }[] = [
  { id: 'vorhanden', label: 'vorhanden' }, { id: 'entwurf', label: 'Entwurf' }, { id: 'nicht-noetig', label: 'nicht nötig' },
];
export type DokQuelle = 'notar' | 'register-abruf' | 'eigen' | 'steuerbuero' | 'kanzlei' | 'behoerde';
export const DOK_QUELLEN: readonly { id: DokQuelle; label: string }[] = [
  { id: 'eigen', label: 'selbst erstellt' }, { id: 'notar', label: 'Notar' }, { id: 'register-abruf', label: 'Register-Abruf' },
  { id: 'steuerbuero', label: 'Steuerbüro' }, { id: 'kanzlei', label: 'Kanzlei' }, { id: 'behoerde', label: 'Behörde' },
];
export interface Dokument {
  /** `dok-<uuid>` */
  id: string;
  /** Katalog-Kennung (lib/gesellschaften/schild/dokumente.ts `DOKUMENT_KATALOG`). */
  art: string;
  titel?: string;
  status: DokStatus;
  /** Fassung vom (Tag) — Grundlage für „prüfen“, „veraltet“ und die Aufbewahrung. */
  fassungVom?: string;
  /** Gültig bis (Zertifikat, Bescheinigung) — danach „abgelaufen“. */
  gueltigBis?: string;
  /** Geschäftsjahr (Jahr des Stichtags), für Dokumente je Geschäftsjahr (Jahresabschluss). */
  geschaeftsjahr?: number;
  quelle?: DokQuelle;
  /** Unterlagen in der verschlüsselten Dateiablage (`d-…`, Bezug = diese Gesellschaft). */
  dateiIds?: string[];
  notiz?: string;
  /** Bei „nicht nötig“: warum (Pflicht). */
  grund?: string;
  angelegt?: string;
  geloeschtAm?: string;
}

// ── Pflichten: Vermerke und Ereignisse ───────────────────────────────────────────────────────────────────────────

export type VermerkStatus = 'erledigt' | 'nicht-zutreffend';
/** „Erledigt am“ zu einer gerechneten Pflicht — Schlüssel `regelId` + `periode`, nur dieser Vermerk ist gespeichert. */
export interface Vermerk {
  /** `vm-<uuid>` */
  id: string;
  regelId: string;
  /** Geschäftsjahres-Ende (`2025-12-31`), Jahr (`2026`), Ereignis-Kennung (`ev-…`) bzw. `laufend` (Schwellen). */
  periode: string;
  status: VermerkStatus;
  /** Tag der Erledigung. */
  am: string;
  /** Speichername der Person, die vermerkt hat (setzt der Server). */
  von: string;
  notiz?: string;
  /** Beleg: Dokument dieser Gesellschaft. */
  belegDokId?: string;
}

export type EreignisArt =
  | 'anteilsuebertragung' | 'kapitalmassnahme' | 'gf-wechsel' | 'satzungsaenderung' | 'sitz-anschrift' | 'prokura'
  | 'gewerbe-aenderung' | 'betriebseroeffnung' | 'erste-beschaeftigung' | 'neuer-vertrag' | 'verlust-haelfte' | 'ug-drohende-zu'
  | 'zahlungsunfaehigkeit' | 'ueberschuldung';
export interface Ereignis {
  /** `ev-<uuid>` */
  id: string;
  art: EreignisArt;
  /** Tag des Ereignisses — Anker der Ereignis-Pflichten. */
  datum: string;
  notiz?: string;
  /** Aus diesem Beschluss des Registers (Beschluss-Buch, 10.10.) — setzt NUR der Server bei der Freigabe der Folge; bleibt beim Ändern. */
  beschlussId?: string;
  angelegt?: string;
  geloeschtAm?: string;
}

// ── Profil (für Größenklasse, Schwellen, Risikotragfähigkeit) ─────────────────────────────────────────────────────

export type Groessenklasse = 'kleinst' | 'klein' | 'mittel' | 'gross';
export const GROESSENKLASSEN: readonly { id: Groessenklasse; label: string }[] = [
  { id: 'kleinst', label: 'Kleinst' }, { id: 'klein', label: 'klein' }, { id: 'mittel', label: 'mittel' }, { id: 'gross', label: 'groß' },
];
export interface SchildProfil {
  /** Personen, die beschäftigt sind (ohne Gesellschafter-GF ohne Anstellung) — Schwellen 1/10/20/50. */
  beschaeftigte?: number;
  umsatzVorjahrCent?: number;
  bilanzsummeCent?: number;
  /** Nur Einzelunternehmen: Gewinn des Vorjahres (Buchführungspflicht ab 80.000 €). */
  gewinnVorjahrCent?: number;
  groessenklasse?: Groessenklasse;
  /** Erklärungen macht ein Steuerbüro (längere Erklärungsfrist). */
  beraten?: boolean;
  /** Regelmäßige Aufträge an selbständige Kreative (Künstlersozialabgabe). */
  kreativeHonorare?: boolean;
  /** Risikotragfähigkeit: größter Verlust, den die Gesellschaft ohne Bestandsgefährdung trägt (Cent). */
  tragfaehigkeitCent?: number;
  /** Zuletzt geändert (Server) — ein Schwellen-Wechsel danach stößt die Risiko-Neubewertung an. */
  geaendert?: string;
}

// ── Risiken ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type RisikoKategorie = 'liquiditaet' | 'recht' | 'steuern' | 'struktur' | 'personen' | 'it' | 'kunden' | 'lieferanten' | 'reputation' | 'verflechtung';
export const RISIKO_KATEGORIEN: readonly { id: RisikoKategorie; label: string }[] = [
  { id: 'liquiditaet', label: 'Liquidität & Finanzen' }, { id: 'recht', label: 'Recht & Compliance' }, { id: 'steuern', label: 'Steuern' },
  { id: 'struktur', label: 'Gesellschafter & Struktur' }, { id: 'personen', label: 'Personen & Schlüsselpersonen' }, { id: 'it', label: 'IT, Cyber & Daten' },
  { id: 'kunden', label: 'Kunden & Markt' }, { id: 'lieferanten', label: 'Lieferanten & Dienstleister' }, { id: 'reputation', label: 'Reputation' },
  { id: 'verflechtung', label: 'Verflechtung Privat ↔ Firma' },
];
export type Behandlung = 'vermeiden' | 'vermindern' | 'uebertragen' | 'tragen';
export const BEHANDLUNGEN: readonly { id: Behandlung; label: string }[] = [
  { id: 'vermindern', label: 'vermindern' }, { id: 'vermeiden', label: 'vermeiden' }, { id: 'uebertragen', label: 'übertragen (Versicherung, Vertrag)' }, { id: 'tragen', label: 'bewusst tragen' },
];
export type RisikoStatus = 'offen' | 'beobachtet' | 'akzeptiert' | 'erledigt';
export const RISIKO_STATUS: readonly { id: RisikoStatus; label: string }[] = [
  { id: 'offen', label: 'offen' }, { id: 'beobachtet', label: 'beobachtet' }, { id: 'akzeptiert', label: 'akzeptiert' }, { id: 'erledigt', label: 'erledigt' },
];
/** Wer verantwortet etwas — eine Rolle (Organ), nie ein Name im Code. */
export type Rolle = 'gf' | 'gesellschafter' | 'inhaber' | 'steuerbuero' | 'kanzlei';
export const ROLLEN: readonly { id: Rolle; label: string }[] = [
  { id: 'gf', label: 'Geschäftsführung' }, { id: 'gesellschafter', label: 'Gesellschafter' }, { id: 'inhaber', label: 'Inhaber' },
  { id: 'steuerbuero', label: 'Steuerbüro' }, { id: 'kanzlei', label: 'Kanzlei' },
];
export type Stufe = 1 | 2 | 3 | 4 | 5;
export interface Bewertung {
  /** Tag der Bewertung (Server). */
  am: string;
  /** Speichername der Person (Server). */
  von: string;
  eintritt: Stufe;
  wirkung: Stufe;
  /** brutto = vor Maßnahmen, netto = nach Maßnahmen. */
  art: 'brutto' | 'netto';
  /** Wirkung in Geld (optional, für die Aggregation gegen die Tragfähigkeit). */
  wirkungCent?: number;
  grund?: string;
}
export interface Massnahme { id: string; text: string; frist?: string; erledigt?: true }
export interface Risiko {
  /** `rk-<uuid>` */
  id: string;
  titel: string;
  kategorie: RisikoKategorie;
  /** Aus dem Startkatalog übernommen (`R1` … `R17`). */
  katalogId?: string;
  ursache?: string;
  ereignis?: string;
  wirkungText?: string;
  /** Frühwarn-Indikator (Kennzahl + Schwelle, als Satz). */
  indikator?: string;
  behandlung?: Behandlung;
  massnahmen?: Massnahme[];
  /** Verantwortlich: Speichername einer Person des Haushalts (Team) … */
  verantwortlich?: string;
  /** … und/oder eine Rolle. */
  rolle?: Rolle;
  status: RisikoStatus;
  /** Verlauf — nie überschrieben, nur angehängt (Server stempelt `am`/`von`). */
  bewertungen: Bewertung[];
  /** Übertragen auf diese Versicherungen. */
  versicherungIds?: string[];
  angelegt?: string;
  geloeschtAm?: string;
}

// ── Marken, Domains, Versicherungen ──────────────────────────────────────────────────────────────────────────────

export type MarkenAmt = 'dpma' | 'euipo' | 'wipo';
export const MARKEN_AEMTER: readonly { id: MarkenAmt; label: string }[] = [{ id: 'dpma', label: 'DPMA' }, { id: 'euipo', label: 'EUIPO' }, { id: 'wipo', label: 'WIPO' }];
export type MarkenForm = 'wort' | 'bild' | 'wort-bild' | 'sonstige';
export const MARKEN_FORMEN: readonly { id: MarkenForm; label: string }[] = [{ id: 'wort', label: 'Wortmarke' }, { id: 'wort-bild', label: 'Wort-/Bildmarke' }, { id: 'bild', label: 'Bildmarke' }, { id: 'sonstige', label: 'Sonstige' }];
export interface Marke {
  /** `mk-<uuid>` */
  id: string;
  bezeichnung: string;
  form?: MarkenForm;
  amt?: MarkenAmt;
  registerNr?: string;
  anmeldetag?: string;
  eintragungstag?: string;
  /** Ende der Widerspruchsfrist bzw. des Widerspruchsverfahrens — Beginn der Benutzungsschonfrist. */
  widerspruchsEnde?: string;
  /** Schutz läuft (nach einer Verlängerung) bis — sonst gerechnet aus dem Anmeldetag. */
  schutzBis?: string;
  klassen?: number[];
  /** Inhaber ist die Gesellschaft (nicht eine Privatperson/Agentur). */
  inhaberIstGesellschaft?: boolean;
  dateiIds?: string[];
  notiz?: string;
  angelegt?: string;
  geloeschtAm?: string;
}
export interface Domain {
  /** `dm-<uuid>` */
  id: string;
  domain: string;
  registrar?: string;
  inhaberIstGesellschaft?: boolean;
  laeuftBis?: string;
  autoVerlaengerung?: boolean;
  zweiFaktor?: boolean;
  /** Zugang hinterlegt (ja/nein) und wo — NIE ein Passwort oder eine Zugangskennung. */
  zugangHinterlegt?: boolean;
  zugangWo?: string;
  markeId?: string;
  notiz?: string;
  angelegt?: string;
  geloeschtAm?: string;
}
export type VersicherungArt = 'betriebshaftpflicht' | 'vermoegensschaden' | 'do' | 'cyber' | 'inhalt' | 'rechtsschutz' | 'keyperson' | 'kfz' | 'sonstige';
export const VERSICHERUNG_ARTEN: readonly { id: VersicherungArt; label: string }[] = [
  { id: 'betriebshaftpflicht', label: 'Betriebshaftpflicht' }, { id: 'vermoegensschaden', label: 'Vermögensschaden-/Berufshaftpflicht' }, { id: 'do', label: 'D&O' },
  { id: 'cyber', label: 'Cyber' }, { id: 'inhalt', label: 'Inhalt/Elektronik' }, { id: 'rechtsschutz', label: 'Rechtsschutz' }, { id: 'keyperson', label: 'Key-Person' },
  { id: 'kfz', label: 'Kfz' }, { id: 'sonstige', label: 'Sonstige' },
];
export interface Versicherung {
  /** `vs-<uuid>` */
  id: string;
  art: VersicherungArt;
  versicherer?: string;
  vertragsNr?: string;
  deckungFallCent?: number;
  selbstbehaltCent?: number;
  praemieJahrCent?: number;
  beginn?: string;
  /** Ende der laufenden Versicherungsperiode (Hauptfälligkeit). */
  ablauf?: string;
  /** Stillschweigende Verlängerung je Mal in Monaten (§ 11 Abs. 1 VVG: höchstens 12) — Vorgabe 12. */
  verlaengerungMonate?: number;
  /** Kündigungsfrist in Monaten (§ 11 Abs. 3 VVG: 1–3) — Vorgabe 3. */
  kuendigungsfristMonate?: number;
  /** D&O: Nachmeldefrist in Monaten. */
  nachmeldefristMonate?: number;
  /** Gekündigt zum (Tag) — dann keine Verlängerung mehr. */
  gekuendigtZum?: string;
  obliegenheiten?: string;
  dateiIds?: string[];
  notiz?: string;
  angelegt?: string;
  geloeschtAm?: string;
}

// ── Entwürfe aus Vorlagen ────────────────────────────────────────────────────────────────────────────────────────

export interface Entwurf {
  /** `ew-<uuid>` */
  id: string;
  /** Vorlagen-Kennung (lib/gesellschaften/schild/vorlagen.ts). */
  vorlage: string;
  titel: string;
  text: string;
  am: string;
  von: string;
  geaendert?: string;
  geloeschtAm?: string;
}

// ── Bestand ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SchildGesellschaft {
  id: GesellschaftId;
  profil?: SchildProfil;
  dokumente?: Dokument[];
  vermerke?: Vermerk[];
  ereignisse?: Ereignis[];
  risiken?: Risiko[];
  marken?: Marke[];
  domains?: Domain[];
  versicherungen?: Versicherung[];
  entwuerfe?: Entwurf[];
  geaendert?: string;
  geaendertVon?: string;
}
export interface SchildDatei { gesellschaften: SchildGesellschaft[] }

export type SchildListe = 'dokumente' | 'ereignisse' | 'risiken' | 'marken' | 'domains' | 'versicherungen' | 'entwuerfe';
export const SCHILD_LISTEN: readonly SchildListe[] = ['dokumente', 'ereignisse', 'risiken', 'marken', 'domains', 'versicherungen', 'entwuerfe'];
export const SCHILD_PRAEFIX: Record<SchildListe, string> = { dokumente: 'dok', ereignisse: 'ev', risiken: 'rk', marken: 'mk', domains: 'dm', versicherungen: 'vs', entwuerfe: 'ew' };
/** Grenzen — nie still kürzen (darüber 413 mit Text). */
export const SCHILD_GRENZEN = {
  dokumente: 300, ereignisse: 200, risiken: 80, marken: 60, domains: 100, versicherungen: 60, entwuerfe: 60,
  vermerke: 3000, bewertungen: 400, massnahmen: 30, dateien: 20, text: 30_000,
} as const;

/** Ein leerer Eintrag (die Gesellschaft hat noch nichts im Schild). */
export const leererEintrag = (id: GesellschaftId): SchildGesellschaft => ({ id });
