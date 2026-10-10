import { neueKennung } from '@/lib/kennung';
// ─── MAKE OS — Sport: Datenmodell (27.09.) ──────────────────────────────────
// Kevins Auftrag: „Im Gesundheitsbereich einen Sport-Bereich einbauen — für
// Malin ausgebaut mit Hyrox, Running, Gym und Erholung, damit sie ihre Ziele
// am Anfang schon perfekt planen kann.“
//
// Ein Bestand je Person (`sport--<person>`, Kevin ohne Suffix wie überall).
// Änderungen laufen als kleine Schritte (`Op`) über `wendeAn` — zu zweit und
// am Handy überschreibt so niemand den anderen. `saeubere` macht aus allem,
// was in der Datei liegt, einen gültigen Stand: nichts Erfundenes, keine Null.
// Reine Logik, keine Ein-/Ausgabe — getestet in tests/sport-*.test.ts.

export type Disziplin = 'hyrox' | 'lauf' | 'kraft' | 'grundlagen';
/** Art eines Plan-Tags: eine Sparte (09.10.: auch Rad, Ausdauer, Mobility, Sonstiges) oder Ruhe/frei. */
export type PlanArt = Sparte | 'ruhe' | 'frei';
export type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const WOCHENTAG_LABEL: Record<Wochentag, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
export const DISZIPLIN_LABEL: Record<Disziplin, string> = { hyrox: 'Hyrox', lauf: 'Laufen', kraft: 'Kraft', grundlagen: 'Grundlagen' };
export const PLAN_LABEL: Record<PlanArt, string> = { hyrox: 'Hyrox', lauf: 'Lauf', gym: 'Gym', rad: 'Rad', ausdauer: 'Ausdauer', mobility: 'Mobility', sonstiges: 'Sonstiges', ruhe: 'Ruhe', frei: 'frei' };

export type StationId = 'skierg' | 'sledPush' | 'sledPull' | 'bbj' | 'rudern' | 'farmers' | 'lunges' | 'wallballs';
export type LaufArt = 'locker' | 'intervall' | 'tempo' | 'longrun' | 'wettkampf';
export const LAUF_ARTEN: { id: LaufArt; label: string }[] = [
  { id: 'locker', label: 'locker' }, { id: 'intervall', label: 'Intervall' }, { id: 'tempo', label: 'Tempo' }, { id: 'longrun', label: 'Longrun' }, { id: 'wettkampf', label: 'Wettkampf' },
];
export type Quelle = 'hand' | 'apple-health' | 'strava' | 'whoop';

/**
 * Sparte einer Einheit (09.10., Training sichtbar): die Disziplinen, nach denen gezählt und geplant wird. Importe ordnet EINE Tabelle zu
 * (lib/sport/training.ts `SPORT_ZUORDNUNG`), die Person kann je Sportart (`SportStand.sportArten`) und je Einheit (`TrainingEinheit.art`)
 * umstellen. `erholung` (Sauna, Eisbad, Massage …) und `alltag` (Gehen, Pendeln, Hausarbeit …) erscheinen in der Liste, zählen aber nicht
 * als Training.
 */
export type Sparte = 'lauf' | 'gym' | 'hyrox' | 'rad' | 'ausdauer' | 'mobility' | 'sonstiges';
export type Klasse = Sparte | 'erholung' | 'alltag';
export const SPARTEN: Sparte[] = ['lauf', 'gym', 'hyrox', 'rad', 'ausdauer', 'mobility', 'sonstiges'];
export const KLASSEN: Klasse[] = [...SPARTEN, 'erholung', 'alltag'];
export const KLASSE_LABEL: Record<Klasse, string> = {
  lauf: 'Laufen', gym: 'Gym & Kraft', hyrox: 'Hyrox & Functional', rad: 'Rad', ausdauer: 'Ausdauer', mobility: 'Mobility & Yoga', sonstiges: 'Anderes Training',
  erholung: 'Erholung', alltag: 'Alltagsbewegung',
};
/** Zählt eine Klasse als Trainingseinheit? (Erholung und Alltag stehen in der Liste, zählen aber nicht.) */
export const zaehltAlsTraining = (k: Klasse): k is Sparte => k !== 'erholung' && k !== 'alltag';

export interface Ziel {
  id: string;
  art: Disziplin;
  titel: string;
  /** Zieldatum (Wettkampf, Stichtag) — YYYY-MM-DD. */
  datum?: string;
  /** Zielzeit in Sekunden (Hyrox gesamt, Lauf über `distanzKm`). */
  zielzeitSek?: number;
  /** Lauf: Distanz in km (5 · 10 · 21,1). */
  distanzKm?: number;
  /** Kraft: Übung und Zielgewicht (e1RM oder Arbeitsgewicht). */
  uebung?: string;
  zielKg?: number;
  notiz?: string;
  angelegt: string;
  erledigt?: boolean;
  /** Referenzzeit für die Prognose (09.10.): z. B. 10 km in 57:30 — ohne Angabe nimmt der Rechner Bestzeit bzw. Ausgangswert. */
  referenz?: { distanzKm: number; sek: number };
}

export interface Ausgang {
  /** Aktuelle Bestzeiten in Sekunden — der Punkt, von dem aus geplant wird. */
  lauf5kSek?: number;
  lauf10kSek?: number;
  hyroxSek?: number;
  /** Kraft: Arbeitsgewicht je Übung (kg). */
  kraft: Record<string, number>;
  /** Trainingstage, die die Woche hergibt (2–7). */
  tageProWoche?: number;
}

/**
 * Ein Plan-Tag. Seit 09.10. (Plan-Baukasten) optional mit EINHEITEN (bis 4 je Tag) — dann ist `art` die Sparte der ersten Einheit und
 * `dauerMin` die Summe (abgeleitet, `saeuberePlanTag`), damit alle älteren Leser (Ampel, Kachel, „Für dich“) weiter stimmen.
 * Ohne Einheiten gilt der Tag wie bisher als EINE Einheit seiner Art (`einheitenVon`, lib/sport/plan-bau.ts).
 */
export interface PlanTag { art: PlanArt; dauerMin?: number; notiz?: string; einheiten?: PlanEinheit[] }
export type Woche = Record<Wochentag, PlanTag>;

/** Art einer geplanten Einheit — was in der Einheit passiert (Vorschlag der Struktur, keine Trainingsberatung). */
export type EinheitTyp = 'grundlage' | 'locker' | 'intervall' | 'tempo' | 'longrun' | 'kraft' | 'technik' | 'stationen' | 'simulation' | 'wettkampf' | 'mobility' | 'erholung';
export type Intensitaet = 'leicht' | 'mittel' | 'hart';
export const INTENSITAETEN: Intensitaet[] = ['leicht', 'mittel', 'hart'];
export const INTENSITAET_LABEL: Record<Intensitaet, string> = { leicht: 'leicht', mittel: 'mittel', hart: 'hart' };
export const EINHEIT_TYPEN: { id: EinheitTyp; label: string; intensitaet: Intensitaet }[] = [
  { id: 'grundlage', label: 'Grundlage', intensitaet: 'leicht' }, { id: 'locker', label: 'Locker', intensitaet: 'leicht' },
  { id: 'intervall', label: 'Intervall', intensitaet: 'hart' }, { id: 'tempo', label: 'Tempo', intensitaet: 'hart' },
  { id: 'longrun', label: 'Lang', intensitaet: 'mittel' }, { id: 'kraft', label: 'Kraft', intensitaet: 'mittel' },
  { id: 'technik', label: 'Technik', intensitaet: 'leicht' }, { id: 'stationen', label: 'Stationen', intensitaet: 'hart' },
  { id: 'simulation', label: 'Simulation', intensitaet: 'hart' }, { id: 'wettkampf', label: 'Wettkampf', intensitaet: 'hart' },
  { id: 'mobility', label: 'Mobility', intensitaet: 'leicht' }, { id: 'erholung', label: 'Erholung', intensitaet: 'leicht' },
];
export const TYP_LABEL = Object.fromEntries(EINHEIT_TYPEN.map(t => [t.id, t.label])) as Record<EinheitTyp, string>;

/** Eine geplante Einheit (Plan-Baukasten, 09.10.). */
export interface PlanEinheit {
  id: string;
  sparte: Sparte;
  typ?: EinheitTyp;
  dauerMin?: number;
  /** Ohne Angabe gilt die Vorgabe des Typs (`intensitaetVon`, lib/sport/plan-bau.ts). */
  intensitaet?: Intensitaet;
  /** Zielzone 1–5 (Herzfrequenz). */
  zone?: number;
  /** Strain-Ziel der Einheit (0–21) — optional, damit „Belastung gegen Plan“ etwas hat. */
  strain?: number;
  /** Geplante Uhrzeit „HH:MM“ (Vorgabe für den Kalender-Block). */
  uhrzeit?: string;
  notiz?: string;
}

/** Eine Wochen-Vorlage der Person (eigene) — die Startvorlagen stehen im Code (lib/sport/plan-bau.ts), nie im Bestand. */
export interface PlanVorlage {
  id: string;
  name: string;
  woche: Woche;
  notiz?: string;
  /** Von ZOE vorgeschlagen und von der Person übernommen (nur Anzeige). */
  vonZoe?: true;
}
/** Phase einer Block-Woche: Aufbau (voll), Deload (leichter), Taper (vor dem Wettkampf). */
export type BlockPhase = 'aufbau' | 'deload' | 'taper';
export const BLOCK_PHASEN: BlockPhase[] = ['aufbau', 'deload', 'taper'];
export const PHASE_LABEL: Record<BlockPhase, string> = { aufbau: 'Aufbau', deload: 'Deload', taper: 'Taper' };
export interface BlockWoche { vorlage: string; phase: BlockPhase }
/** Ein Block: Wochen nacheinander ab `start` (Montag), je Woche eine Vorlage und eine Phase; optional auf ein Ziel hin. */
export interface PlanBlock { id: string; start: string; wochen: BlockWoche[]; zielId?: string }

export interface HyroxEinheit {
  id: string;
  datum: string;
  art: 'training' | 'simulation' | 'wettkampf';
  /** Zeit je Station in Sekunden — nur die gemessenen. */
  stationen: Partial<Record<StationId, number>>;
  /** Die 8 Läufe (Sekunden) — leer, wenn nicht gemessen. */
  laeufe: number[];
  /** Gesamtzeit in Sekunden — vom Wettkampf übernommen oder gerechnet. */
  gesamtSek?: number;
  ort?: string;
  notiz?: string;
}

export interface Lauf {
  id: string;
  datum: string;
  distanzKm: number;
  dauerSek: number;
  art: LaufArt;
  /** Gefühl 1 (zäh) … 5 (fliegt). */
  gefuehl?: number;
  notiz?: string;
  /** Woher kommt der Lauf — heute von Hand, später Import (Apple Health, Strava). */
  quelle: Quelle;
  /** Kennung beim Import, damit ein zweiter Import nichts doppelt anlegt. */
  externeId?: string;
  /** Startzeit in Ortszeit „HH:MM“ (nur Importe, 09.10.) — für die Anzeige und um zwei Quellen derselben Einheit zu erkennen. */
  uhrzeit?: string;
  // Messwerte aus einem Import (09.10., WHOOP — lib/whoop/abbilden.ts `sportAnwenden`); von Hand gibt es sie nicht.
  /** WHOOP-Strain 0–21. */
  strain?: number;
  kcal?: number;
  pulsSchnitt?: number;
  pulsMax?: number;
  /** Minuten je Herzfrequenz-Zone 0–5 (immer sechs Werte). */
  zonenMin?: number[];
  /** Höhenmeter bergauf. */
  hoeheM?: number;
}

export interface Satz { kg: number; wdh: number }
export interface Satzgruppe { uebung: string; saetze: Satz[] }
export interface GymEinheit {
  id: string;
  datum: string;
  /** Aus welcher Vorlage die Einheit kam (Anzeige, kein Zwang). */
  vorlage?: string;
  uebungen: Satzgruppe[];
  dauerMin?: number;
  notiz?: string;
}
export type Muskelgruppe = 'beine' | 'ruecken' | 'brust' | 'schulter' | 'rumpf' | 'ganzkoerper' | 'hyrox';
export interface Uebung { id: string; name: string; gruppe: Muskelgruppe; /** von der Person angelegt */ eigen?: boolean }
export interface VorlageUebung { uebung: string; saetze: number; wdh: string }
export interface Vorlage { id: string; name: string; uebungen: VorlageUebung[]; eigen?: boolean }

/**
 * Training (08.10., WHOOP; 09.10. auch von Hand): jedes Workout, das kein Lauf mit Distanz ist (Krafttraining, Rad, Hyrox-Training …).
 * Importe legen es mit `quelle` + `externeId` an (idempotent). Von Hand (`quelle: 'hand'`) kommen nur Einheiten, die weder Lauf, Gym noch
 * Hyrox sind (Rad, Yoga …) — dafür bleiben deren eigene Wege. `art`, `gefuehl` und `notiz` setzt die Person; ein erneuter Import lässt
 * sie stehen.
 */
export interface TrainingEinheit {
  id: string;
  datum: string;
  /** Sportart, wie die Quelle sie nennt (z. B. „functional-fitness“). */
  sport: string;
  dauerMin: number;
  /** WHOOP-Strain 0–21. */
  strain?: number;
  kcal?: number;
  pulsSchnitt?: number;
  pulsMax?: number;
  distanzKm?: number;
  /** Minuten je Herzfrequenz-Zone 0–5 (immer sechs Werte, 09.10.). */
  zonenMin?: number[];
  /** Höhenmeter bergauf (09.10.). */
  hoeheM?: number;
  quelle: Quelle;
  externeId?: string;
  /** Startzeit in Ortszeit „HH:MM“ (Importe). */
  uhrzeit?: string;
  /** „Zählt als“ — von der Person gesetzt; ohne Angabe gilt die Sportart (Tabelle bzw. `SportStand.sportArten`). */
  art?: Klasse;
  /** Gefühl 1 (zäh) … 5 (stark) — von der Person. */
  gefuehl?: number;
  notiz?: string;
}

export interface ErholungTag {
  schlafH?: number;
  ruhepuls?: number;
  hrv?: number;
  /** Wie fühlst du dich 1–5 (5 = frisch). */
  gefuehl?: number;
  /** Muskelkater 1–5 (5 = überall). */
  muskelkater?: number;
  notiz?: string;
  quelle?: Quelle;
}

export interface SportStand {
  version: 1;
  einstieg: { fertig: boolean; am?: string };
  ziele: Ziel[];
  ausgang: Ausgang;
  woche: Woche;
  /** Montag der Woche, ab der der Plan gilt — Bezug für den Deload-Rhythmus. */
  planStart?: string;
  hyrox: HyroxEinheit[];
  laeufe: Lauf[];
  gym: { uebungen: Uebung[]; einheiten: GymEinheit[]; vorlagen: Vorlage[] };
  /** Je Tag (YYYY-MM-DD) die Erholung. */
  erholung: Record<string, ErholungTag>;
  /** Trainings aus Importen (WHOOP, 08.10.) und von Hand (09.10.) — fehlt, solange es keine gibt (alte Stände bleiben bit-gleich). */
  training?: TrainingEinheit[];
  /** Eigene Zuordnung je Sportart (Schlüssel wie `sportSchluessel`, lib/sport/training.ts) — fehlt, solange die Person nichts umstellt. */
  sportArten?: Record<string, Klasse>;
  /** Eigene Wochen-Vorlagen (09.10., Plan-Baukasten) — fehlt, solange es keine gibt. */
  planVorlagen?: PlanVorlage[];
  /** Der laufende Block (Aufbau → Deload …) — fehlt ohne Block; dann gilt `woche` jede Woche. */
  block?: PlanBlock;
  /** Phase einzelner Wochen, von der Person gesetzt (z. B. „Entlastung annehmen“ nach dem HRV-Trend) — Schlüssel = Montag. */
  wochenPhase?: Record<string, BlockPhase>;
  /**
   * Plan für einzelne Tage (09.10.): gewinnt über Woche/Block — verschobene Einheiten, die Taper-Tage vor einem Wettkampf. Schlüssel = Datum.
   * Ein Tag mit `{ art: 'frei' }` heißt „an diesem Tag nichts“ (die Einheit wurde weggeschoben).
   */
  tage?: Record<string, PlanTag>;
  /** Einstellungen der Person (09.10.) — fehlt, solange alles auf Vorgabe steht. */
  einstellungen?: SportEinstellungen;
}

/** Was im Gesundheits-Cockpit zuerst steht (je Person; Vorgabe Tagesform). */
export type Zuerst = 'tagesform' | 'schlaf' | 'training' | 'countdown';
export const ZUERST: Zuerst[] = ['tagesform', 'schlaf', 'training', 'countdown'];
export const ZUERST_LABEL: Record<Zuerst, string> = { tagesform: 'Tagesform', schlaf: 'Schlaf', training: 'Training heute', countdown: 'Countdown' };
/** Regel „Entlastung nach HRV-Trend“ (lib/sport/entlastung.ts) — jede Zahl einstellbar, ohne Angabe die Vorgabe dort. */
export interface EntlastungEinstellung {
  /** Wie viele der letzten Tage betrachtet werden (2–7). */
  fensterTage?: number;
  /** Ab wie vielen auffälligen Tagen im Fenster eine Entlastung vorgeschlagen wird. */
  mindestTage?: number;
  /** HRV gilt als auffällig unter diesem Anteil des Bezugs (0,70–0,99). */
  hrvAnteil?: number;
  /** Ruhepuls gilt als auffällig über Bezug + so vielen Schlägen (1–15). */
  pulsPlus?: number;
  /** Aus = keine Vorschläge. */
  aus?: boolean;
}
export interface SportEinstellungen {
  zuerst?: Zuerst;
  entlastung?: EntlastungEinstellung;
  /** Umfang einer Deload-Woche in % (40–90). */
  deloadProzent?: number;
  /** Umfang einer Taper-Woche in % (30–90). */
  taperProzent?: number;
}

/** Grenzen des Plan-Baukastens — darüber lehnt der Schritt ab (nie still kürzen). */
export const PLAN_GRENZEN = { einheitenJeTag: 4, vorlagen: 30, blockWochen: 52, tage: 120 } as const;

// ── Grundzustand und Prüfung ─────────────────────────────────────────────────

export const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const STATION_IDS: StationId[] = ['skierg', 'sledPush', 'sledPull', 'bbj', 'rudern', 'farmers', 'lunges', 'wallballs'];
const DISZIPLINEN: Disziplin[] = ['hyrox', 'lauf', 'kraft', 'grundlagen'];
const PLAN_ARTEN: PlanArt[] = [...SPARTEN, 'ruhe', 'frei'];
const TYP_IDS = EINHEIT_TYPEN.map(t => t.id);
const LAUF_ART_IDS: LaufArt[] = ['locker', 'intervall', 'tempo', 'longrun', 'wettkampf'];
const QUELLEN: Quelle[] = ['hand', 'apple-health', 'strava', 'whoop'];
const GRUPPEN: Muskelgruppe[] = ['beine', 'ruecken', 'brust', 'schulter', 'rumpf', 'ganzkoerper', 'hyrox'];
const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;
const uhrzeit = (v: unknown): string | undefined => (typeof v === 'string' && UHRZEIT.test(v) ? v : undefined);
/** Schlüssel einer Sportart für die eigene Zuordnung: klein, nur a–z, 0–9 und Bindestrich (wie `sportSchluessel`). */
const SPORT_SCHLUESSEL = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export function leereWoche(): Woche {
  return { mo: { art: 'frei' }, di: { art: 'frei' }, mi: { art: 'frei' }, do: { art: 'frei' }, fr: { art: 'frei' }, sa: { art: 'frei' }, so: { art: 'frei' } };
}

export function leererStand(): SportStand {
  return { version: 1, einstieg: { fertig: false }, ziele: [], ausgang: { kraft: {} }, woche: leereWoche(), hyrox: [], laeufe: [], gym: { uebungen: [], einheiten: [], vorlagen: [] }, erholung: {} };
}

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const zahl = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const ganz = (v: unknown, min: number, max: number): number | undefined => { const n = zahl(v, min, max); return n === undefined ? undefined : Math.round(n); };
const tag = (v: unknown): string | undefined => (typeof v === 'string' && TAG.test(v) ? v : undefined);
const id = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);
const aus = <T extends string>(v: unknown, liste: readonly T[]): T | undefined => (liste as readonly unknown[]).includes(v) ? (v as T) : undefined;

export function saeubereZiel(e: unknown): Ziel | null {
  if (!istObj(e)) return null;
  const zid = id(e.id); const art = aus(e.art, DISZIPLINEN); const titel = text(e.titel, 120);
  if (!zid || !art || !titel) return null;
  const z: Ziel = { id: zid, art, titel, angelegt: typeof e.angelegt === 'string' ? e.angelegt : new Date().toISOString() };
  const d = tag(e.datum); if (d) z.datum = d;
  const zz = ganz(e.zielzeitSek, 1, 24 * 3600); if (zz) z.zielzeitSek = zz;
  const km = zahl(e.distanzKm, 0.1, 500); if (km) z.distanzKm = Math.round(km * 100) / 100;
  const u = id(e.uebung); if (u) z.uebung = u;
  const kg = zahl(e.zielKg, 0.5, 1000); if (kg) z.zielKg = Math.round(kg * 10) / 10;
  const n = text(e.notiz, 600); if (n) z.notiz = n;
  if (e.erledigt === true) z.erledigt = true;
  if (istObj(e.referenz)) {
    const rk = zahl(e.referenz.distanzKm, 1, 100); const rs = ganz(e.referenz.sek, 60, 24 * 3600);
    if (rk && rs) z.referenz = { distanzKm: Math.round(rk * 100) / 100, sek: rs };
  }
  return z;
}

export function saeubereAusgang(a: unknown): Ausgang {
  const o = istObj(a) ? a : {};
  const r: Ausgang = { kraft: {} };
  const s5 = ganz(o.lauf5kSek, 600, 3 * 3600); if (s5) r.lauf5kSek = s5;
  const s10 = ganz(o.lauf10kSek, 1200, 5 * 3600); if (s10) r.lauf10kSek = s10;
  const hx = ganz(o.hyroxSek, 30 * 60, 5 * 3600); if (hx) r.hyroxSek = hx;
  const t = ganz(o.tageProWoche, 1, 7); if (t) r.tageProWoche = t;
  if (istObj(o.kraft)) for (const [k, v] of Object.entries(o.kraft)) { const kid = id(k); const kg = zahl(v, 0.5, 1000); if (kid && kg) r.kraft[kid] = Math.round(kg * 10) / 10; }
  return r;
}

export function saeuberePlanEinheit(e: unknown): PlanEinheit | null {
  if (!istObj(e)) return null;
  const eid = id(e.id); const sparte = aus(e.sparte, SPARTEN);
  if (!eid || !sparte) return null;
  const p: PlanEinheit = { id: eid, sparte };
  const t = aus(e.typ, TYP_IDS); if (t) p.typ = t;
  const d = ganz(e.dauerMin, 5, 600); if (d) p.dauerMin = d;
  const i = aus(e.intensitaet, INTENSITAETEN); if (i) p.intensitaet = i;
  const z = ganz(e.zone, 1, 5); if (z) p.zone = z;
  const st = zahl(e.strain, 0, 21); if (st !== undefined) p.strain = Math.round(st * 10) / 10;
  const uz = uhrzeit(e.uhrzeit); if (uz) p.uhrzeit = uz;
  const n = text(e.notiz, 200); if (n) p.notiz = n;
  return p;
}

export function saeuberePlanTag(t: unknown): PlanTag {
  if (!istObj(t)) return { art: 'frei' };
  const n = text(t.notiz, 200);
  // Mit Einheiten (09.10.): Art und Dauer folgen den Einheiten — so lesen ältere Stellen denselben Tag.
  const einheiten = Array.isArray(t.einheiten) ? eindeutig(t.einheiten.map(saeuberePlanEinheit).filter((x): x is PlanEinheit => !!x)) : [];
  if (einheiten.length) {
    const summe = einheiten.reduce((acc, e) => acc + (e.dauerMin ?? 0), 0);
    return { art: einheiten[0].sparte, ...(summe ? { dauerMin: summe } : {}), ...(n ? { notiz: n } : {}), einheiten };
  }
  const art = aus(t.art, PLAN_ARTEN) ?? 'frei';
  const p: PlanTag = { art };
  const d = ganz(t.dauerMin, 5, 600); if (d && art !== 'ruhe' && art !== 'frei') p.dauerMin = d;
  if (n) p.notiz = n;
  return p;
}

export function saeubereWoche(w: unknown): Woche {
  const o = istObj(w) ? w : {};
  const r = leereWoche();
  for (const t of WOCHENTAGE) r[t] = saeuberePlanTag(o[t]);
  return r;
}

export function saeubereHyrox(e: unknown): HyroxEinheit | null {
  if (!istObj(e)) return null;
  const hid = id(e.id); const datum = tag(e.datum);
  if (!hid || !datum) return null;
  const h: HyroxEinheit = { id: hid, datum, art: aus(e.art, ['training', 'simulation', 'wettkampf'] as const) ?? 'training', stationen: {}, laeufe: [] };
  if (istObj(e.stationen)) for (const s of STATION_IDS) { const v = ganz(e.stationen[s], 1, 3600); if (v) h.stationen[s] = v; }
  if (Array.isArray(e.laeufe)) h.laeufe = e.laeufe.slice(0, 8).map(v => ganz(v, 1, 3600)).filter((v): v is number => v !== undefined);
  const g = ganz(e.gesamtSek, 60, 8 * 3600); if (g) h.gesamtSek = g;
  const ort = text(e.ort, 80); if (ort) h.ort = ort;
  const n = text(e.notiz, 600); if (n) h.notiz = n;
  return h;
}

export function saeubereLauf(e: unknown): Lauf | null {
  if (!istObj(e)) return null;
  const lid = id(e.id); const datum = tag(e.datum); const km = zahl(e.distanzKm, 0.1, 500); const sek = ganz(e.dauerSek, 10, 48 * 3600);
  if (!lid || !datum || !km || !sek) return null;
  const l: Lauf = { id: lid, datum, distanzKm: Math.round(km * 100) / 100, dauerSek: sek, art: aus(e.art, LAUF_ART_IDS) ?? 'locker', quelle: aus(e.quelle, QUELLEN) ?? 'hand' };
  const g = ganz(e.gefuehl, 1, 5); if (g) l.gefuehl = g;
  const n = text(e.notiz, 600); if (n) l.notiz = n;
  const x = text(e.externeId, 120); if (x) l.externeId = x;
  const st = zahl(e.strain, 0, 21); if (st !== undefined) l.strain = Math.round(st * 10) / 10;
  const kc = ganz(e.kcal, 1, 20000); if (kc) l.kcal = kc;
  const ps = ganz(e.pulsSchnitt, 25, 250); if (ps) l.pulsSchnitt = ps;
  const pm = ganz(e.pulsMax, 25, 250); if (pm) l.pulsMax = pm;
  const zo = zonenMin(e.zonenMin); if (zo) l.zonenMin = zo;
  const hm = ganz(e.hoeheM, 1, 20000); if (hm) l.hoeheM = hm;
  const uz = uhrzeit(e.uhrzeit); if (uz) l.uhrzeit = uz;
  return l;
}

/** Minuten je Herzfrequenz-Zone 0–5: genau sechs Zahlen 0 … 48 h, eine Nachkommastelle — sonst keine Angabe (09.10.). */
export function zonenMin(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length !== 6) return undefined;
  const w = v.map(x => zahl(x, 0, 48 * 60));
  if (w.some(x => x === undefined) || w.every(x => x === 0)) return undefined;
  return w.map(x => Math.round(x! * 10) / 10);
}

export function saeubereGym(e: unknown): GymEinheit | null {
  if (!istObj(e)) return null;
  const gid = id(e.id); const datum = tag(e.datum);
  if (!gid || !datum) return null;
  const g: GymEinheit = { id: gid, datum, uebungen: [] };
  if (Array.isArray(e.uebungen)) {
    for (const u of e.uebungen.slice(0, 30)) {
      if (!istObj(u)) continue;
      const uid = id(u.uebung); if (!uid) continue;
      const saetze: Satz[] = Array.isArray(u.saetze) ? u.saetze.slice(0, 20).map(s => {
        if (!istObj(s)) return null;
        const kg = zahl(s.kg, 0, 1000); const wdh = ganz(s.wdh, 1, 200);
        return kg !== undefined && wdh ? { kg: Math.round(kg * 10) / 10, wdh } : null;
      }).filter((s): s is Satz => !!s) : [];
      if (saetze.length) g.uebungen.push({ uebung: uid, saetze });
    }
  }
  const v = id(e.vorlage); if (v) g.vorlage = v;
  const d = ganz(e.dauerMin, 1, 600); if (d) g.dauerMin = d;
  const n = text(e.notiz, 600); if (n) g.notiz = n;
  return g;
}

export function saeubereUebung(e: unknown): Uebung | null {
  if (!istObj(e)) return null;
  const uid = id(e.id); const name = text(e.name, 60);
  if (!uid || !name) return null;
  return { id: uid, name, gruppe: aus(e.gruppe, GRUPPEN) ?? 'ganzkoerper', eigen: true };
}

export function saeubereVorlage(e: unknown): Vorlage | null {
  if (!istObj(e)) return null;
  const vid = id(e.id); const name = text(e.name, 60);
  if (!vid || !name) return null;
  const uebungen: VorlageUebung[] = Array.isArray(e.uebungen) ? e.uebungen.slice(0, 20).map(u => {
    if (!istObj(u)) return null;
    const uid = id(u.uebung); const saetze = ganz(u.saetze, 1, 20); const wdh = text(u.wdh, 20) ?? '8';
    return uid && saetze ? { uebung: uid, saetze, wdh } : null;
  }).filter((u): u is VorlageUebung => !!u) : [];
  return { id: vid, name, uebungen, eigen: true };
}

export function saeubereTraining(e: unknown): TrainingEinheit | null {
  if (!istObj(e)) return null;
  const tid = id(e.id); const datum = tag(e.datum); const sport = text(e.sport, 60); const dauer = ganz(e.dauerMin, 1, 24 * 60);
  if (!tid || !datum || !sport || !dauer) return null;
  const t: TrainingEinheit = { id: tid, datum, sport, dauerMin: dauer, quelle: aus(e.quelle, QUELLEN) ?? 'hand' };
  const st = zahl(e.strain, 0, 21); if (st !== undefined) t.strain = Math.round(st * 10) / 10;
  const kc = ganz(e.kcal, 1, 20000); if (kc) t.kcal = kc;
  const ps = ganz(e.pulsSchnitt, 25, 250); if (ps) t.pulsSchnitt = ps;
  const pm = ganz(e.pulsMax, 25, 250); if (pm) t.pulsMax = pm;
  const km = zahl(e.distanzKm, 0.01, 1000); if (km) t.distanzKm = Math.round(km * 100) / 100;
  const zo = zonenMin(e.zonenMin); if (zo) t.zonenMin = zo;
  const hm = ganz(e.hoeheM, 1, 20000); if (hm) t.hoeheM = hm;
  const x = text(e.externeId, 120); if (x) t.externeId = x;
  const uz = uhrzeit(e.uhrzeit); if (uz) t.uhrzeit = uz;
  const art = aus(e.art, KLASSEN); if (art) t.art = art;
  const g = ganz(e.gefuehl, 1, 5); if (g) t.gefuehl = g;
  const n = text(e.notiz, 600); if (n) t.notiz = n;
  return t;
}

export function saeuberePlanVorlage(e: unknown): PlanVorlage | null {
  if (!istObj(e)) return null;
  const vid = id(e.id); const name = text(e.name, 60);
  if (!vid || !name) return null;
  const v: PlanVorlage = { id: vid, name, woche: saeubereWoche(e.woche) };
  const n = text(e.notiz, 600); if (n) v.notiz = n;
  if (e.vonZoe === true) v.vonZoe = true;
  return v;
}

export function saeubereBlock(e: unknown): PlanBlock | null {
  if (!istObj(e)) return null;
  const bid = id(e.id); const start = tag(e.start);
  if (!bid || !start || !Array.isArray(e.wochen)) return null;
  const wochen = e.wochen.map(w => {
    if (!istObj(w)) return null;
    const v = id(w.vorlage); const ph = aus(w.phase, BLOCK_PHASEN);
    return v && ph ? { vorlage: v, phase: ph } : null;
  }).filter((w): w is BlockWoche => !!w);
  if (!wochen.length) return null;
  const b: PlanBlock = { id: bid, start, wochen };
  const z = id(e.zielId); if (z) b.zielId = z;
  return b;
}

/** Einstellungen der Person: nur bekannte Felder in ihren Grenzen — leer = keine (die Vorgaben gelten). */
export function saeubereEinstellungen(e: unknown): SportEinstellungen | undefined {
  if (!istObj(e)) return undefined;
  const r: SportEinstellungen = {};
  const z = aus(e.zuerst, ZUERST); if (z) r.zuerst = z;
  if (istObj(e.entlastung)) {
    const en: EntlastungEinstellung = {};
    const f = ganz(e.entlastung.fensterTage, 2, 7); if (f) en.fensterTage = f;
    const m = ganz(e.entlastung.mindestTage, 1, 7); if (m) en.mindestTage = Math.min(m, en.fensterTage ?? 7);
    const h = zahl(e.entlastung.hrvAnteil, 0.7, 0.99); if (h !== undefined) en.hrvAnteil = Math.round(h * 100) / 100;
    const pp = ganz(e.entlastung.pulsPlus, 1, 15); if (pp) en.pulsPlus = pp;
    if (e.entlastung.aus === true) en.aus = true;
    if (Object.keys(en).length) r.entlastung = en;
  }
  const d = ganz(e.deloadProzent, 40, 90); if (d) r.deloadProzent = d;
  const t = ganz(e.taperProzent, 30, 90); if (t) r.taperProzent = t;
  return Object.keys(r).length ? r : undefined;
}

/** Phase je Woche (Montag → Phase) — nur gültige Tage und Phasen. */
export function saeubereWochenPhase(e: unknown): Record<string, BlockPhase> | undefined {
  if (!istObj(e)) return undefined;
  const r: Record<string, BlockPhase> = {};
  for (const [k, v] of Object.entries(e)) { const ph = aus(v, BLOCK_PHASEN); if (TAG.test(k) && ph) r[k] = ph; }
  return Object.keys(r).length ? r : undefined;
}

/** Die eigene Zuordnung je Sportart: nur gültige Schlüssel und Klassen (höchstens 200 Sportarten). */
export function saeubereSportArten(v: unknown): Record<string, Klasse> | undefined {
  if (!istObj(v)) return undefined;
  const r: Record<string, Klasse> = {};
  for (const [k, w] of Object.entries(v).slice(0, 200)) { const kl = aus(w, KLASSEN); if (SPORT_SCHLUESSEL.test(k) && kl) r[k] = kl; }
  return Object.keys(r).length ? r : undefined;
}

export function saeubereErholung(e: unknown): ErholungTag | null {
  if (!istObj(e)) return null;
  const t: ErholungTag = {};
  const s = zahl(e.schlafH, 0, 24); if (s !== undefined) t.schlafH = Math.round(s * 10) / 10;
  const rp = ganz(e.ruhepuls, 25, 200); if (rp) t.ruhepuls = rp;
  const hrv = ganz(e.hrv, 1, 300); if (hrv) t.hrv = hrv;
  const g = ganz(e.gefuehl, 1, 5); if (g) t.gefuehl = g;
  const m = ganz(e.muskelkater, 1, 5); if (m) t.muskelkater = m;
  const n = text(e.notiz, 300); if (n) t.notiz = n;
  const q = aus(e.quelle, QUELLEN); if (q) t.quelle = q;
  return Object.keys(t).length ? t : null;
}

const nachDatum = <T extends { datum: string }>(l: T[]) => [...l].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
const eindeutig = <T extends { id: string }>(l: T[]) => { const m = new Map<string, T>(); for (const e of l) m.set(e.id, e); return [...m.values()]; };

/** Aus allem, was in der Datei liegt, ein gültiger Stand. Unbekanntes fällt weg, nichts wird erfunden. */
export function saeubere(raw: unknown): SportStand {
  const s = leererStand();
  if (!istObj(raw)) return s;
  if (istObj(raw.einstieg)) { s.einstieg.fertig = raw.einstieg.fertig === true; const am = typeof raw.einstieg.am === 'string' ? raw.einstieg.am : undefined; if (am) s.einstieg.am = am; }
  if (Array.isArray(raw.ziele)) s.ziele = eindeutig(raw.ziele.map(saeubereZiel).filter((z): z is Ziel => !!z)).slice(0, 50);
  s.ausgang = saeubereAusgang(raw.ausgang);
  s.woche = saeubereWoche(raw.woche);
  const ps = tag(raw.planStart); if (ps) s.planStart = ps;
  if (Array.isArray(raw.hyrox)) s.hyrox = nachDatum(eindeutig(raw.hyrox.map(saeubereHyrox).filter((h): h is HyroxEinheit => !!h))).slice(0, 1000);
  if (Array.isArray(raw.laeufe)) s.laeufe = nachDatum(eindeutig(raw.laeufe.map(saeubereLauf).filter((l): l is Lauf => !!l))).slice(0, 5000);
  if (istObj(raw.gym)) {
    if (Array.isArray(raw.gym.uebungen)) s.gym.uebungen = eindeutig(raw.gym.uebungen.map(saeubereUebung).filter((u): u is Uebung => !!u)).slice(0, 200);
    if (Array.isArray(raw.gym.einheiten)) s.gym.einheiten = nachDatum(eindeutig(raw.gym.einheiten.map(saeubereGym).filter((g): g is GymEinheit => !!g))).slice(0, 5000);
    if (Array.isArray(raw.gym.vorlagen)) s.gym.vorlagen = eindeutig(raw.gym.vorlagen.map(saeubereVorlage).filter((v): v is Vorlage => !!v)).slice(0, 50);
  }
  if (istObj(raw.erholung)) for (const [d, e] of Object.entries(raw.erholung)) { if (!TAG.test(d)) continue; const t = saeubereErholung(e); if (t) s.erholung[d] = t; }
  if (Array.isArray(raw.training)) { const t = nachDatum(eindeutig(raw.training.map(saeubereTraining).filter((x): x is TrainingEinheit => !!x))).slice(0, 5000); if (t.length) s.training = t; }
  const sa = saeubereSportArten(raw.sportArten); if (sa) s.sportArten = sa;
  if (Array.isArray(raw.planVorlagen)) { const v = eindeutig(raw.planVorlagen.map(saeuberePlanVorlage).filter((x): x is PlanVorlage => !!x)); if (v.length) s.planVorlagen = v; }
  const bl = saeubereBlock(raw.block); if (bl) s.block = bl;
  const wp = saeubereWochenPhase(raw.wochenPhase); if (wp) s.wochenPhase = wp;
  if (istObj(raw.tage)) { const t: Record<string, PlanTag> = {}; for (const [k, v] of Object.entries(raw.tage)) if (TAG.test(k) && istObj(v)) t[k] = saeuberePlanTag(v); if (Object.keys(t).length) s.tage = t; }
  const en = saeubereEinstellungen(raw.einstellungen); if (en) s.einstellungen = en;
  return s;
}

// ── Schritte ─────────────────────────────────────────────────────────────────

export type Op =
  | { op: 'einstieg'; fertig: boolean }
  | { op: 'ziel'; eintrag: unknown }
  | { op: 'ziel-weg'; id: string }
  | { op: 'ausgang'; werte: unknown }
  | { op: 'woche'; tage: unknown; planStart?: string }
  | { op: 'hyrox'; eintrag: unknown }
  | { op: 'hyrox-weg'; id: string }
  | { op: 'lauf'; eintrag: unknown }
  | { op: 'lauf-weg'; id: string }
  | { op: 'gym'; eintrag: unknown }
  | { op: 'gym-weg'; id: string }
  | { op: 'uebung'; eintrag: unknown }
  | { op: 'uebung-weg'; id: string }
  | { op: 'vorlage'; eintrag: unknown }
  | { op: 'vorlage-weg'; id: string }
  | { op: 'erholung'; tag: string; werte: unknown }
  | { op: 'erholung-weg'; tag: string }
  /** Training von Hand anlegen/ändern (09.10.) — nur Einträge mit `quelle: 'hand'`; Importe ändert `training-anmerken`. */
  | { op: 'training'; eintrag: unknown }
  /** Nur Einträge von Hand; ein importierter Eintrag käme beim nächsten Abgleich wieder — ihn stellt man auf „Alltag“ (zählt nicht). */
  | { op: 'training-weg'; id: string }
  /** Was die Person an einer (auch importierten) Einheit setzt: „zählt als“, Gefühl, Notiz — `null` leert. */
  | { op: 'training-anmerken'; id: string; art?: Klasse | null; gefuehl?: number | null; notiz?: string | null }
  /** Eigene Zuordnung einer Sportart (`null` = zurück auf die Vorgabe). */
  | { op: 'sportart'; sport: string; klasse: Klasse | null }
  /** Plan-Baukasten (09.10.): eigene Wochen-Vorlage anlegen/ändern bzw. entfernen; Block setzen (`null` = beenden). */
  | { op: 'plan-vorlage'; eintrag: unknown }
  | { op: 'plan-vorlage-weg'; id: string }
  | { op: 'plan-block'; block: unknown | null }
  /** Phase einer einzelnen Woche setzen (z. B. Entlastung annehmen) — `null` = zurück auf Block/Standard. */
  | { op: 'wochen-phase'; montag: string; phase: BlockPhase | null }
  /** Einstellungen ändern (zusammengeführt; ein Feld mit `null` geht zurück auf die Vorgabe). */
  | { op: 'einstellungen'; werte: unknown }
  /** Plan einzelner Tage setzen (`null` = zurück auf Woche/Block) — mehrere auf einmal (z. B. Taper-Tage, Verschieben). */
  | { op: 'plan-tage'; tage: Record<string, unknown | null> };

/** Prüft die Einheiten je Tag gegen die Grenze, bevor gesäubert wird (sonst fiele ein Teil still weg). */
function einheitenGrenze(woche: unknown): void {
  if (!istObj(woche)) return;
  for (const t of WOCHENTAGE) {
    const tg = woche[t];
    if (istObj(tg) && Array.isArray(tg.einheiten) && tg.einheiten.length > PLAN_GRENZEN.einheitenJeTag) throw new Error(`Höchstens ${PLAN_GRENZEN.einheitenJeTag} Einheiten je Tag (${WOCHENTAG_LABEL[t]}).`);
  }
}

const setze = <T extends { id: string }>(liste: T[], e: T) => [e, ...liste.filter(x => x.id !== e.id)];

/** Ein Schritt auf den Stand — gibt den neuen Stand zurück oder wirft mit einem Satz, den man zeigen kann. */
export function wendeAn(stand: SportStand, op: Op): SportStand {
  const s: SportStand = { ...stand, ...(stand.training ? { training: [...stand.training] } : {}), ziele: [...stand.ziele], hyrox: [...stand.hyrox], laeufe: [...stand.laeufe], gym: { uebungen: [...stand.gym.uebungen], einheiten: [...stand.gym.einheiten], vorlagen: [...stand.gym.vorlagen] }, erholung: { ...stand.erholung } };
  switch (op.op) {
    case 'einstieg': s.einstieg = { fertig: op.fertig === true, ...(op.fertig ? { am: new Date().toISOString() } : {}) }; return s;
    case 'ziel': { const z = saeubereZiel(op.eintrag); if (!z) throw new Error('Ziel unvollständig: Art, Titel und eine Kennung braucht es.'); s.ziele = setze(s.ziele, z).sort((a, b) => (a.datum ?? '9999') < (b.datum ?? '9999') ? -1 : 1); return s; }
    case 'ziel-weg': s.ziele = s.ziele.filter(z => z.id !== op.id); return s;
    case 'ausgang': s.ausgang = saeubereAusgang({ ...s.ausgang, ...(istObj(op.werte) ? op.werte : {}), kraft: { ...s.ausgang.kraft, ...(istObj(op.werte) && istObj(op.werte.kraft) ? op.werte.kraft : {}) } }); return s;
    case 'woche': einheitenGrenze(op.tage); s.woche = saeubereWoche(op.tage); { const ps = tag(op.planStart); if (ps) s.planStart = ps; } return s;
    case 'hyrox': { const h = saeubereHyrox(op.eintrag); if (!h) throw new Error('Hyrox-Einheit braucht Datum und Kennung.'); s.hyrox = nachDatum(setze(s.hyrox, h)); return s; }
    case 'hyrox-weg': s.hyrox = s.hyrox.filter(h => h.id !== op.id); return s;
    case 'lauf': { const l = saeubereLauf(op.eintrag); if (!l) throw new Error('Lauf braucht Datum, Distanz und Zeit.'); s.laeufe = nachDatum(setze(s.laeufe, l)); return s; }
    case 'lauf-weg': s.laeufe = s.laeufe.filter(l => l.id !== op.id); return s;
    case 'gym': { const g = saeubereGym(op.eintrag); if (!g) throw new Error('Einheit braucht Datum und Kennung.'); if (!g.uebungen.length) throw new Error('Mindestens ein Satz mit Gewicht und Wiederholungen.'); s.gym.einheiten = nachDatum(setze(s.gym.einheiten, g)); return s; }
    case 'gym-weg': s.gym.einheiten = s.gym.einheiten.filter(g => g.id !== op.id); return s;
    case 'uebung': { const u = saeubereUebung(op.eintrag); if (!u) throw new Error('Übung braucht einen Namen.'); s.gym.uebungen = setze(s.gym.uebungen, u); return s; }
    case 'uebung-weg': s.gym.uebungen = s.gym.uebungen.filter(u => u.id !== op.id); return s;
    case 'vorlage': { const v = saeubereVorlage(op.eintrag); if (!v) throw new Error('Vorlage braucht einen Namen.'); s.gym.vorlagen = setze(s.gym.vorlagen, v); return s; }
    case 'vorlage-weg': s.gym.vorlagen = s.gym.vorlagen.filter(v => v.id !== op.id); return s;
    case 'erholung': {
      if (!TAG.test(op.tag)) throw new Error('Tag ungültig.');
      const t = saeubereErholung({ ...(s.erholung[op.tag] ?? {}), ...(istObj(op.werte) ? op.werte : {}) });
      if (t) s.erholung[op.tag] = t; else delete s.erholung[op.tag];
      return s;
    }
    case 'erholung-weg': delete s.erholung[op.tag]; return s;
    case 'training': {
      const roh = istObj(op.eintrag) ? op.eintrag : {};
      const alt = (s.training ?? []).find(t => t.id === roh.id);
      if (alt && alt.quelle !== 'hand') throw new Error('Importierte Einheiten ändern sich nur über „Zählt als“, Gefühl und Notiz.');
      const t = saeubereTraining({ ...roh, quelle: 'hand', externeId: undefined });
      if (!t) throw new Error('Training braucht Datum, Sportart und Dauer.');
      if (!t.art) throw new Error('Wähle, als was die Einheit zählt.');
      s.training = nachDatum(setze(s.training ?? [], t));
      return s;
    }
    case 'training-weg': {
      const alt = (s.training ?? []).find(t => t.id === op.id);
      if (alt && alt.quelle !== 'hand') throw new Error('Importierte Einheiten kommen beim nächsten Abgleich wieder — stell sie auf „Alltag“, dann zählen sie nicht.');
      const rest = (s.training ?? []).filter(t => t.id !== op.id);
      if (rest.length) s.training = rest; else delete s.training;
      return s;
    }
    case 'training-anmerken': {
      const liste = s.training ?? [];
      const i = liste.findIndex(t => t.id === op.id);
      if (i < 0) throw new Error('Diese Einheit gibt es nicht mehr.');
      const t: TrainingEinheit = { ...liste[i] };
      if (op.art !== undefined) { if (op.art === null) delete t.art; else { const k = aus(op.art, KLASSEN); if (!k) throw new Error('Unbekannte Sparte.'); t.art = k; } }
      if (op.gefuehl !== undefined) { if (op.gefuehl === null) delete t.gefuehl; else { const g = ganz(op.gefuehl, 1, 5); if (!g) throw new Error('Gefühl 1 bis 5.'); t.gefuehl = g; } }
      if (op.notiz !== undefined) { const n = op.notiz === null ? undefined : text(op.notiz, 600); if (n) t.notiz = n; else delete t.notiz; }
      if (t.quelle === 'hand' && !t.art) throw new Error('Eine Einheit von Hand braucht eine Sparte.');
      s.training = [...liste.slice(0, i), t, ...liste.slice(i + 1)];
      return s;
    }
    case 'sportart': {
      const k = typeof op.sport === 'string' ? op.sport : '';
      if (!SPORT_SCHLUESSEL.test(k)) throw new Error('Unbekannte Sportart.');
      const neu: Record<string, Klasse> = { ...(s.sportArten ?? {}) };
      if (op.klasse === null) delete neu[k];
      else { const kl = aus(op.klasse, KLASSEN); if (!kl) throw new Error('Unbekannte Sparte.'); neu[k] = kl; }
      if (Object.keys(neu).length > 200) throw new Error('Höchstens 200 eigene Zuordnungen.');
      if (Object.keys(neu).length) s.sportArten = neu; else delete s.sportArten;
      return s;
    }
    case 'plan-vorlage': {
      const roh = istObj(op.eintrag) ? op.eintrag : {};
      if (typeof roh.id === 'string' && roh.id.startsWith('start-')) throw new Error('Startvorlagen bleiben, wie sie sind — speichere eine Kopie unter eigenem Namen.');
      einheitenGrenze(roh.woche);
      const v = saeuberePlanVorlage(roh);
      if (!v) throw new Error('Vorlage braucht einen Namen.');
      const liste = s.planVorlagen ?? [];
      const da = liste.some(x => x.id === v.id);
      if (!da && liste.length >= PLAN_GRENZEN.vorlagen) throw new Error(`Höchstens ${PLAN_GRENZEN.vorlagen} eigene Vorlagen — entferne eine ältere.`);
      s.planVorlagen = da ? liste.map(x => (x.id === v.id ? v : x)) : [...liste, v];
      return s;
    }
    case 'plan-vorlage-weg': {
      if (s.block?.wochen.some(w => w.vorlage === op.id)) throw new Error('Die Vorlage steckt im laufenden Block — erst den Block ändern oder beenden.');
      const rest = (s.planVorlagen ?? []).filter(v => v.id !== op.id);
      if (rest.length) s.planVorlagen = rest; else delete s.planVorlagen;
      return s;
    }
    case 'plan-block': {
      if (op.block === null) { delete s.block; return s; }
      const roh = istObj(op.block) ? op.block : {};
      const n = Array.isArray(roh.wochen) ? roh.wochen.length : 0;
      if (n > PLAN_GRENZEN.blockWochen) throw new Error(`Ein Block hat höchstens ${PLAN_GRENZEN.blockWochen} Wochen.`);
      const b = saeubereBlock(roh);
      if (!b) throw new Error('Block braucht einen Start und mindestens eine Woche.');
      if (b.wochen.length !== n) throw new Error('Eine Block-Woche ist unvollständig (Vorlage und Phase).');
      if (new Date(`${b.start}T12:00:00Z`).getUTCDay() !== 1) throw new Error('Ein Block beginnt an einem Montag.');
      if (b.zielId && !s.ziele.some(z => z.id === b.zielId)) throw new Error('Das Ziel des Blocks gibt es nicht.');
      // Vorlage je Woche: die Standardwoche, eine Startvorlage (im Code, `start-…`) oder eine eigene.
      const unbekannt = b.wochen.find(w => w.vorlage !== 'standard' && !w.vorlage.startsWith('start-') && !(s.planVorlagen ?? []).some(v => v.id === w.vorlage));
      if (unbekannt) throw new Error('Eine Vorlage des Blocks gibt es nicht.');
      s.block = b;
      return s;
    }
    case 'wochen-phase': {
      const m = tag(op.montag);
      if (!m || new Date(`${m}T12:00:00Z`).getUTCDay() !== 1) throw new Error('Eine Woche beginnt an einem Montag.');
      const neu: Record<string, BlockPhase> = { ...(s.wochenPhase ?? {}) };
      if (op.phase === null) delete neu[m];
      else { const ph = aus(op.phase, BLOCK_PHASEN); if (!ph) throw new Error('Unbekannte Phase.'); neu[m] = ph; }
      // Nur das letzte Jahr zählt für den Plan — ältere Einträge fallen beim Schreiben weg (keine Daten, nur ein Merker je Woche).
      const grenze = new Date(`${m}T12:00:00Z`); grenze.setUTCDate(grenze.getUTCDate() - 371);
      for (const k of Object.keys(neu)) if (k < grenze.toISOString().slice(0, 10)) delete neu[k];
      if (Object.keys(neu).length) s.wochenPhase = neu; else delete s.wochenPhase;
      return s;
    }
    case 'plan-tage': {
      if (!istObj(op.tage)) throw new Error('Keine Tage.');
      const neu: Record<string, PlanTag> = { ...(s.tage ?? {}) };
      let juengster = '';
      for (const [k, v] of Object.entries(op.tage)) {
        if (!TAG.test(k)) throw new Error('Tag ungültig.');
        if (k > juengster) juengster = k;
        if (v === null) { delete neu[k]; continue; }
        if (istObj(v) && Array.isArray(v.einheiten) && v.einheiten.length > PLAN_GRENZEN.einheitenJeTag) throw new Error(`Höchstens ${PLAN_GRENZEN.einheitenJeTag} Einheiten je Tag.`);
        neu[k] = saeuberePlanTag(v);
      }
      // Tage, die mehr als 60 Tage hinter dem jüngsten geschriebenen liegen, braucht kein Plan mehr (nur Planwerte, keine Erfassung).
      if (juengster) { const g = new Date(`${juengster}T12:00:00Z`); g.setUTCDate(g.getUTCDate() - 60); for (const k of Object.keys(neu)) if (k < g.toISOString().slice(0, 10)) delete neu[k]; }
      if (Object.keys(neu).length > PLAN_GRENZEN.tage) throw new Error(`Höchstens ${PLAN_GRENZEN.tage} geplante Einzeltage.`);
      if (Object.keys(neu).length) s.tage = neu; else delete s.tage;
      return s;
    }
    case 'einstellungen': {
      if (!istObj(op.werte)) throw new Error('Keine Einstellungen.');
      const alt = (s.einstellungen ?? {}) as Record<string, unknown>;
      const zusammen: Record<string, unknown> = { ...alt };
      for (const [k, v] of Object.entries(op.werte)) {
        if (v === null) delete zusammen[k];
        else if (k === 'entlastung' && istObj(v)) {
          const e2: Record<string, unknown> = { ...(istObj(alt.entlastung) ? alt.entlastung : {}) };
          for (const [ek, ev] of Object.entries(v)) { if (ev === null) delete e2[ek]; else e2[ek] = ev; }
          zusammen.entlastung = e2;
        } else zusammen[k] = v;
      }
      const en = saeubereEinstellungen(zusammen);
      if (en) s.einstellungen = en; else delete s.einstellungen;
      return s;
    }
    default: throw new Error('Unbekannter Schritt.');
  }
}

/** Kurze Kennung für neue Einträge — lesbar, eindeutig genug für eine Person. */
export const neueId = (praefix: string) => neueKennung(praefix);
