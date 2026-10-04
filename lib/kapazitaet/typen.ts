// ─── MAKE OS — Kapazität: die Typen (eine Wahrheit, client-sicher) ──────────
// Kevin 04.10.: „Schlichtweg die Zeit und Machbarkeit über die Personen und Kapas … Das Ziel ist super, wir brauchen
// aber auch die Umsetzung dahinter … manchmal sind die Ziele nicht zu erreichen, weil man sonst z. B. 30 Stunden am
// Tag arbeiten müsste … messbar machen mit den Kapas, die da sind. Realistisch planbar.“ + „Kopf & Energie“.
//
// Gespeichert wird nur, was nicht schon woanders steht (Speicher `kapazitaet--<haushalt>`):
//   · je Person der Grundwert (Stunden je Woche) und Ausnahmen (Urlaub, feste Blöcke)
//   · Zuweisungen: wiederkehrende Stunden je Woche für ein Mandat oder einen Kunden (CRM-Kennung, nie ein Name)
// Der Aufwand eines Meilensteins/Ziels steht AM Meilenstein/Ziel (optionale Felder `aufwand`, `personen`).
// Personen kommen aus dem Team des Haushalts (lib/make-one/team-speicher.ts) — nichts fest im Code.

/** Kennung einer Person in der Kapazität = Kennung im Team (`konto-<speicher>` oder die Team-Kennung). */
export const PERSON_ID_OK = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const TAG_OK = /^\d{4}-\d{2}-\d{2}$/;
const BEZUG_OK = /^[A-Za-z0-9_~:.-]{1,80}$/;
export const istBezugKennung = (v: unknown): v is string => typeof v === 'string' && BEZUG_OK.test(v);

/** Höchstwerte im Schreibweg — darüber wird abgelehnt (400), nie still gekürzt. */
export const MAX_STUNDEN_WOCHE = 80;
export const MAX_AUSNAHMEN = 60;
export const MAX_ZUWEISUNGEN = 200;
export const MAX_AUFWAND = 10_000;
export const MAX_PERSONEN_AM_POSTEN = 10;

/**
 * Grundannahme, wenn für ein Konto weder Grundwert noch Wochenvorlage da ist: 40 h je Woche (Mo–Fr à 8 h).
 * Steht in der Ansicht als „Annahme“ — ändern über den Grundwert der Person.
 */
export const ANNAHME_STUNDEN_WOCHE = 40;
/** Umschalten zwischen Terminen (Meeting-Last): je Termin gehen 15 min Arbeitszeit verloren. */
export const UMSCHALTEN_STUNDEN = 0.25;
/** „Kopf & Energie“ wirkt nur auf die nächsten 14 Tage — Erholung ist ein Zustand von jetzt, keine Prognose fürs Jahr. */
export const KOPF_TAGE = 14;
/** Machbar, solange der Restbedarf höchstens 80 % der freien Zeit bis zum Termin braucht; bis 100 % „eng“. */
export const MACHBAR_BIS = 0.8;
/** Wochen, die gerechnet werden (ab der laufenden). Der Strahl zeigt darüber hinaus nichts. */
export const WOCHEN_STANDARD = 53;

export type AusnahmeArt = 'urlaub' | 'block';
/** Urlaub: Tage ganz frei. Fester Block: so viele Stunden je Woche sind gebunden (z. B. Lehrauftrag, Elternzeit-Anteil). */
export interface Ausnahme { id: string; art: AusnahmeArt; von: string; /** einschließlich; fehlt beim Block = unbefristet */ bis?: string; stundenWoche?: number; titel?: string }
export interface PersonEinstellung { /** Grundwert: verfügbare Stunden je Woche. Fehlt → Wochenvorlage, sonst Annahme (nur Konten). */ stundenWoche?: number; ausnahmen?: Ausnahme[] }

export type ZuweisungArt = 'mandat' | 'kunde';
/** Wiederkehrend gebundene Zeit: Person × Mandat/Kunde × Stunden je Woche, optional befristet. */
export interface Zuweisung { id: string; person: string; art: ZuweisungArt; bezugId: string; stundenWoche: number; von?: string; bis?: string }

export interface KapaDatei { personen: Record<string, PersonEinstellung>; zuweisungen: Zuweisung[] }
export const LEERE_KAPA: KapaDatei = { personen: {}, zuweisungen: [] };

// ── Eingabe der Rechnung (aus den vorhandenen Lesewegen, Server) ────────────

/** Ein Kalendertag einer Person — aus `verfuegbarkeitFuer` (lib/kalender/verfuegbarkeit.ts) übersetzt. */
export interface TagEingabe {
  tag: string;
  /** Soll aus der Wochenvorlage (h) — null, wenn die Person keine Vorlage hat. */
  vorlageStunden: number | null;
  /** Feiertag oder ganztägig abwesend (Kalender). */
  frei: boolean;
  feiertag?: string;
  /** Termine (Art „termin“, Abwesenheit mit Uhrzeit) im Arbeitsfenster, überlappungsfrei, in Stunden. */
  terminStunden: number;
  terminAnzahl: number;
}

export interface PersonEingabe {
  id: string;
  name: string;
  quelle: 'konto' | 'team';
  /** Kalendertage (nur Konten) — fehlen sie, gilt nur der Grundwert. */
  tage?: TagEingabe[];
  hatVorlage?: boolean;
  /**
   * Ø Recovery (0–100) der letzten 7 Tage — NUR gesetzt, wenn die Person ihre Gesundheit mit allen anderen Konten des
   * Haushalts teilt (Server-Regel). Geht nur als Team-Faktor in die Rechnung, nie als Einzelwert zu anderen.
   */
  erholung?: number | null;
}

/** Ein Meilenstein bzw. Ziel, wie die Machbarkeit ihn braucht. */
export interface PostenEingabe {
  art: 'meilenstein' | 'ziel';
  id: string;
  titel: string;
  /** Termin YYYY-MM-DD (Meilenstein: fällig; Ziel: Termin, sonst Jahresende). */
  termin?: string;
  aufwand?: number;
  personen?: string[];
  fortschritt: number;
  erledigt: boolean;
  rang?: number;
  zielId?: string;
  /** Gemessene Fokus-Zeit auf Aufgaben dieses Meilensteins (Stunden) — nur zur Anzeige. */
  istStunden?: number;
}

export interface KapaEingabe {
  heute: string;
  wochen?: number;
  personen: PersonEingabe[];
  datei: KapaDatei;
  posten: PostenEingabe[];
  /** Gemessene bewusste Business-Zeit je Person und Tag (Stunden) — für Plan-Treue. */
  ist?: { person: string; tag: string; stunden: number }[];
  /** Namen der Bezüge (Mandat/Kunde) — zur Anzeige, aus dem CRM (Server). */
  bezugNamen?: Record<string, string>;
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────

export type MachbarStatus = 'machbar' | 'eng' | 'nicht-machbar' | 'ueberfaellig' | 'aufwand-fehlt' | 'termin-fehlt' | 'erledigt';
export const MACHBAR_LABEL: Record<MachbarStatus, string> = {
  machbar: 'machbar', eng: 'eng', 'nicht-machbar': 'nicht machbar', ueberfaellig: 'überfällig',
  'aufwand-fehlt': 'Aufwand fehlt', 'termin-fehlt': 'Termin fehlt', erledigt: 'erledigt',
};

export interface Machbarkeit {
  art: 'meilenstein' | 'ziel';
  id: string;
  titel: string;
  termin?: string;
  aufwand?: number;
  /** Rest = Aufwand × (1 − Fortschritt). */
  rest?: number;
  /** Wer daran arbeitet (Kennungen) — leer = das ganze Team. */
  personen: string[];
  status: MachbarStatus;
  /** Freie Stunden bis zum Termin (nach allem, was vorher dran ist). */
  frei?: number;
  /** Personen-Arbeitstage bis zum Termin. */
  arbeitstage?: number;
  /** Was es je Person und Arbeitstag bräuchte — der „30 h/Tag“-Fall. */
  braeuchteStdTag?: number;
  freiStdTag?: number;
  istStunden?: number;
  /** Ein Satz, ehrlich aus den Zahlen. */
  text: string;
  zielId?: string;
}

export interface WochePerson {
  woche: string;
  /** Soll ohne Abwesenheit. */
  brutto: number;
  /** Urlaub, Feiertag, ganz abwesend. */
  abwesend: number;
  termine: number;
  termineAnzahl: number;
  umschalten: number;
  bloecke: number;
  /** brutto − abwesend − termine − umschalten − Blöcke */
  netto: number;
  /** netto × Kopf & Energie (nur die nächsten 14 Tage) */
  belastbar: number;
  /** Zuweisungen (Mandat/Kunde) */
  gebunden: number;
  /** gebunden + verplanter Aufwand */
  bedarf: number;
  ist?: number;
}

export interface PersonStand {
  id: string;
  name: string;
  quelle: 'konto' | 'team';
  /** Grundwert je Woche und woher er kommt. */
  grundwert: number;
  grundwertQuelle: 'einstellung' | 'vorlage' | 'annahme';
  /** Team-Personen ohne Grundwert zählen nicht (keine geratene Kapa). */
  ohneKapa?: boolean;
  wochen: WochePerson[];
  ausnahmen: Ausnahme[];
  /** Nur für die Person selbst (fuerBetrachter): ihr eigener Erholungswert. */
  erholung?: { wert: number; faktor: number };
}

export type LastStufe = 'leer' | 'gut' | 'eng' | 'ueber';
export interface WocheTeam {
  woche: string;
  brutto: number;
  netto: number;
  belastbar: number;
  bedarf: number;
  frei: number;
  /** bedarf ÷ belastbar (null, wenn beides 0). */
  auslastung: number | null;
  stufe: LastStufe;
  ist?: number;
}

export interface KapaKennzahlen {
  /** Last nächste 4 Wochen in % (Bedarf ÷ belastbare Zeit). */
  last4: number | null;
  bedarf4: number; belastbar4: number;
  machbar: { machbar: number; eng: number; nicht: number; ueberfaellig: number; ohneAufwand: number; ohneTermin: number; bewertet: number };
  /** Anteil machbarer Posten in % (eng zählt halb). */
  machbarAnteil: number | null;
  /** Ø Ist (gemessen, 4 Wochen) ÷ Ø Plan-Bedarf je Woche (nächste 4 Wochen), in %. */
  planTreue: number | null;
  istStdWoche: number | null;
  planStdWoche: number;
  /** Ø freie Stunden je Woche (nächste 4 Wochen) — null, solange nichts verplant ist. */
  pufferStdWoche: number | null;
  /** Kopf & Energie (Team): Faktor × 100 — null ohne geteilte Messung. */
  erholung: number | null;
  erholungPersonen: number;
  engpassWochen: string[];
  /** Die engsten Posten (für Details der Kennzahlen). */
  kritisch: { id: string; art: 'meilenstein' | 'ziel'; titel: string; status: MachbarStatus; text: string }[];
}

export interface KapaStand {
  heute: string;
  wochen: string[];
  personen: PersonStand[];
  team: { wochen: WocheTeam[]; kopf: { faktor: number; personen: number; tage: number } };
  posten: Machbarkeit[];
  zuweisungen: (Zuweisung & { label: string })[];
  kennzahlen: KapaKennzahlen;
}
