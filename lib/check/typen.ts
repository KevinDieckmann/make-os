// ─── Checks — Typen (24.10., Innovations-Check, Branch `innovations-check`) ─────────────────────────────────────
// EINE Check-Maschine für alle Checks der Website (Innovations-Check zuerst; KI-Reifegrad-, Markteintritt- und Vertriebs-Check
// folgen als weitere Vorlagen). Fragen, Punkte, Gewichte, Stufen, Benchmarks und Lead-Scoring sind DATEN je Vorlage
// (lib/check/vorlagen/<id>/*.json, freigegeben vom Inhaber) — der Code rechnet nur. Rein, client- und serversicher.

/** Antwortart einer Frage. `beleg` = Freitext mit Bewertung 0–4 nach Rubrik, `offen` = Freitext ohne Punkte. */
export type FrageTyp = 'einfach' | 'mehrfach' | 'beleg' | 'offen';

export interface CheckOption {
  id: string;
  text: string;
  /** 0–4 Punkte (Dimensions-Fragen); fehlt bei Profil- und Mehrfach-Fragen. */
  punkte?: number | null;
  /** Kennwert für Profil-Felder (z. B. Branche `handwerk`). */
  code?: string;
  /** Option mit eigenem Freitext (z. B. „Sonstige“). */
  freitext?: boolean;
  freitext_feld?: string;
  /** Mehrfachauswahl: schließt alle anderen aus („Noch für keine Aufgabe“). */
  exklusiv?: boolean;
  /** Branchen-Module: Hebel-Stufe 0–4 (niedrig = großer Hebel) — zählt nicht in die Dimensionen. */
  stufe?: number;
  hinweis?: string;
}

export interface CheckFrage {
  id: string;
  text: string;
  typ: FrageTyp;
  kurzcheck?: boolean;
  optionen?: CheckOption[];
  /** Profil-Feld, das diese Frage füllt (A-Fragen). */
  feld?: string;
  /** Zusatzfrage am selben Bildschirm (A1: „Seid ihr ein Start-up?“). */
  zusatz?: { feld: string; text: string; typ: 'ja_nein' };
  eingabe?: string[];
  nachfragen?: string[];
  /** Beleg-Fragen: Rubrik [Punkte, Beschreibung]. */
  rubrik?: [number, string][];
  bewertung?: string;
  /** `false` = zählt nicht in die Dimensionen (Branchen-Module). */
  punkte?: boolean;
  hinweis?: string;
  auswertung?: string;
}

export interface CheckAbschnitt {
  id: string;
  key: string;
  name: string;
  /** Dimension, auf die der Abschnitt einzahlt — null bei Profil und Branchen-Modulen. */
  dimension: DimKey | null;
  intro: string;
  bedingung?: string;
  fragen: CheckFrage[];
}

export interface CheckKatalog {
  version: string;
  stand: string;
  sprache?: string;
  anzahl_fragen: number;
  anzahl_kurzcheck: number;
  abschnitte: CheckAbschnitt[];
}

export type DimKey = 'strategie' | 'ki' | 'automatisierung' | 'daten' | 'robotik' | 'team';

export interface CheckStufe { stufe: number; name: string; von: number; bis: number; kurz: string }

export interface CheckRegeln {
  version: string;
  dimensionen: { key: DimKey; name: string; abschnitt: string; gewicht: number }[];
  robotik: { relevante_branchen: string[] };
  stufen: CheckStufe[];
  siegel: { ab_stufe: number; name: string };
  zeitersparnis_schaetzung: { werte_stunden: Record<string, number> };
}

export interface BenchmarkQuelle {
  id: string;
  quelle: string;
  datum: string;
  jahr_der_daten?: number;
  kennzahl: string;
  werte: Record<string, number>;
  einheit: string;
  einsatz: string;
}

export interface CheckBenchmarks {
  version: string;
  quellen: BenchmarkQuelle[];
  dimension_benchmark_start: { werte_0_100: Record<string, Record<DimKey, number>> };
}

export interface LeadScoringRegeln {
  version: string;
  /** Reihenfolge wie in der Vorlage: Mitarbeitende, Umsatz, Rolle, Budget, Stufe, Zeithorizont, Gratis-Produkte. */
  automatisch_aus_dem_check: [
    { werte: Record<string, number> },
    { werte: Record<string, number> },
    { werte: Record<string, number> },
    { werte_nach_punkten: Record<string, number>; fehlt: number },
    { werte: Record<string, number> },
    ...unknown[],
  ];
}

/** Eine Vorlage = alles, was ein Check zum Rechnen braucht. */
export interface CheckVorlage {
  id: string;
  name: string;
  katalog: CheckKatalog;
  regeln: CheckRegeln;
  benchmarks: CheckBenchmarks;
  leadScoring: LeadScoringRegeln;
}

/** Eine gespeicherte Antwort. Klick = `optionIds`, Freitext = `freitext`, Beleg-Bewertung (0–4) = `belegScore` (von Hand bzw. später KI). */
export interface CheckAntwort {
  optionIds?: string[];
  freitext?: string;
  /** Zusatzfeld der Frage (A1: Start-up ja/nein). */
  zusatz?: boolean;
  /** Freitext einer Option mit `freitext` (A1 „Sonstige“). */
  optionText?: string;
  belegScore?: number;
  /** Wer bewertet hat (Speichername) und wann — nur Beleg-Fragen. */
  belegVon?: string;
  am?: string;
}

export type CheckAntworten = Record<string, CheckAntwort>;

/** Profil aus den A-Fragen (Codes aus dem Katalog) — für Robotik, Benchmarks, Lead-Scoring. */
export interface CheckProfil {
  branche?: string;
  branche_sonstige?: string;
  startup?: boolean;
  groesse?: string;
  umsatz?: string;
  alter?: string;
  rolle?: string;
  ziel?: string;
  /** Logistik laut Freitext bei „Sonstige“ — setzt später Zoe bzw. der Inhaber. */
  logistik?: boolean;
  /** Punkte der Budget-Frage B2 (0–4). */
  budgetPunkte?: number;
  /** Phase eines Start-ups (J1-Stufe 0–4). */
  phase?: number;
}

export interface CheckErgebnis {
  dimensionen: Partial<Record<DimKey, number>>;
  gewichte: Record<DimKey, number>;
  gesamt: number;
  stufe: number;
  stufe_name: string;
  genauigkeit: 'genau' | 'vorlaeufig';
  robotik_gewertet: boolean;
}

export interface CheckLuecke { dimension: DimKey; wert: number; branche: number; abstand: number }

export interface CheckVerhalten { gespraechGebucht?: boolean; berichtGeoeffnet?: boolean; gratisProdukte?: number }

export interface CheckLeadScore { punkte: number; klasse: 'A' | 'B' | 'C' }
