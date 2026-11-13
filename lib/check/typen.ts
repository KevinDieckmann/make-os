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
  /** Pflichtfrage in eigenen Worten (31.10., Kevin: „Auswahl geben, aber zwischendrin auch selbst schreiben“) — nie überspringbar, zählt nicht in die Punkte. */
  pflicht?: boolean;
}

export interface CheckAbschnitt {
  id: string;
  key: string;
  name: string;
  /** Dimension, auf die der Abschnitt einzahlt — null bei Profil, Branchen-Modulen und den Säulen Sichtbarkeit/Vertrieb. */
  dimension: DimKey | null;
  /** Säule bzw. Bereich, auf den der Abschnitt einzahlt (30.10.: S Sichtbarkeit, V Vertrieb; in Vertriebscheck und Sichtbarkeitstest
   *  ihre eigenen Bereiche) — die Innovation rechnet aus den Dimensionen. */
  saeule?: SaeuleKey;
  /** Zoes Satz, wenn der Abschnitt beginnt (für Besucher) — fehlt er, gilt `ABSCHNITT_SATZ` (lib/check/zoe-texte.ts). */
  satz?: string;
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

/**
 * Säulen bzw. Bereiche eines Checks (30.10., Kevin: „Alle drei Säulen“ + Vertriebscheck und Sichtbarkeitstest): Kennungen kommen aus der
 * Vorlage (Innovations-Check: sichtbarkeit · vertrieb · innovation; Vertriebscheck: organisation · zahlen · neukunden …). Nur die Kennung
 * `innovation` ist besonders: sie hat keine eigenen Fragen, sondern ist der Gesamtwert der Dimensionen B bis G (Referenz unverändert).
 */
export type SaeuleKey = string;
/** Bereich eines Angebots der Instanz (Einstellung des Checks) — jede Säule einer Vorlage zeigt auf einen davon. */
export type AngebotBereich = 'sichtbarkeit' | 'vertrieb' | 'innovation';
export type SchrittBand = 'niedrig' | 'mittel' | 'hoch';
export interface CheckSaeule { key: SaeuleKey; name: string; abschnitt: string; gewicht: number; angebot?: AngebotBereich }
/** Mehrere Säulen unter einer Überschrift (13.11., Sichtbarkeits- und Vertriebs-Check): Wert = Mittel der gemessenen Säulen. */
export interface CheckGruppe { key: string; name: string; saeulen: SaeuleKey[]; frage?: string }

/** Texte der Seite eines Checks (Einstieg, Dauer, Zoes zweiter Satz) — Daten der Vorlage, nie fest im Code. */
export interface CheckSeite {
  titel: string;
  text: string;
  bereiche?: { name: string; text: string }[];
  minuten: number;
  /** Ausführliche Variante (30.10. abends, nur Innovations-Check): Minuten und die Wahl am Anfang. Ohne Feld gibt es keine Wahl. */
  minuten_lang?: number;
  umfang?: { frage: string; kurz: { name: string; text: string }; lang: { name: string; text: string } };
  einleitung: string;
}

export interface CheckStufe { stufe: number; name: string; von: number; bis: number; kurz: string }

export interface CheckRegeln {
  version: string;
  dimensionen: { key: DimKey; name: string; abschnitt: string; gewicht: number }[];
  robotik: { relevante_branchen: string[] };
  stufen: CheckStufe[];
  siegel: { ab_stufe: number; name: string };
  zeitersparnis_schaetzung: { werte_stunden: Record<string, number> };
  /** Säulen und Stufen des Gesamtergebnisses (30.10.) — fehlen sie, gilt nur die Innovation wie bisher. */
  saeulen?: CheckSaeule[];
  saeulen_stufen?: CheckStufe[];
  /** Zwei Überschriften über den Säulen (optional) — ohne Feld zeigt das Ergebnis nur die Säulen wie bisher. */
  gruppen?: CheckGruppe[];
  /** Ein nächster Schritt je Säule und Band (niedrig bis 40, mittel bis 70, hoch darüber). */
  naechste_schritte?: Partial<Record<SaeuleKey, Record<SchrittBand, string>>>;
  /** Nächste Schritte je Dimension (Innovations-Check ohne Säulen, 30.10. abends): die größten Lücken zum Branchenwert. */
  dimension_schritte?: Partial<Record<DimKey, Record<SchrittBand, string>>>;
  /** Reihenfolge bei Gleichstand der schwächsten Säulen — fehlt sie, gilt die Reihenfolge von `saeulen`. */
  schritt_reihe?: SaeuleKey[];
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

/** Eine Vorlage = alles, was ein Check zum Rechnen und Zeigen braucht. */
export interface CheckVorlage {
  id: string;
  name: string;
  seite: CheckSeite;
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
  /** Eigene Antwort zu einer Auswahlfrage (31.10., freiwillig) — zählt nicht in die Punkte, geht an kein KI-Modell, nur an den Inhaber. */
  anmerkung?: string;
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

/** Gesamtergebnis über die Säulen (30.10.) — Säulen ohne beantwortete Frage fehlen in `werte` und zählen nicht. */
export interface SaeulenErgebnis { werte: Partial<Record<SaeuleKey, number>>; gesamt: number; stufe: number; stufe_name: string }

export interface CheckVerhalten { gespraechGebucht?: boolean; berichtGeoeffnet?: boolean; gratisProdukte?: number }

export interface CheckLeadScore { punkte: number; klasse: 'A' | 'B' | 'C' }
