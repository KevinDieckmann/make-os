// ─── MAKE OS — Tagesvitalwerte (privat · MAKE.One) ──────────────────────────
// Vorher standen Recovery/Schlaf/HRV als KONSTANTE im Code (Stand 30.07.).
// Für die tägliche Nutzung ist das unbrauchbar: der Fokus-Agent und der
// Morgen-Loop hätten ewig mit denselben Zahlen gerechnet.
//
// Jetzt: die Werte kommen je Person aus ihrem Bestand (`vitals` bzw. `vitals--<person>`, speicherFuer) — WHOOP-Abgleich,
// Export oder Morgen-Check. Ohne Eintrag fallen wir auf den letzten bekannten Stand zurück und sagen ehrlich, wie alt
// er ist. 08.10. abends (Fragebogen Teil 3): kein Personen-Sonderfall und keine festen Rückfallwerte mehr — ohne Werte
// gibt es keine Werte (0 = keine Angabe, Anzeige „—“, `vitalsKurz`), nie die Zahlen eines alten Exports im Code.

import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';

export interface DayVitals {
  /** Recovery in % (0–100) */
  rec?: number;
  /** Schlaf letzte Nacht in Stunden */
  sleep?: number;
  /** HRV in ms */
  hrv?: number;
  /** Ruhepuls */
  rhr?: number;
  /** Freitext: wie fühlt es sich an */
  note?: string;
  /**
   * Woher ein Wert stammt (08.10., WHOOP je Person): `whoop` = vom Abgleich geschrieben — darf er nachziehen; `hand` = von Hand
   * (Morgen-Check). Fehlt die Angabe, gilt der Wert als Handwert: der Abgleich überschreibt NIE, was nicht als `whoop` markiert ist.
   * `whoop-export` (08.10., Kevin Phase 0: „WHOOP ist die Quelle — Werte aus dem alten Export: Schnittstelle gewinnt, nur echte
   * Handeingaben bleiben“): aus dem WHOOP-Datenexport (lib/whoop-export.ts) — der Abgleich überschreibt ihn wie `whoop`. Altbestand
   * ohne Angabe bleibt Handwert; nur beim Einlesen des Datenexports bekommt ein GENAU gleicher Wert die Herkunft `whoop-export`
   * (Wert unverändert) — die Schnittstelle selbst fasst ihn nie an (Gegenprüfung 08.10.).
   */
  quellen?: Partial<Record<MessFeld, VitalQuelle>>;

  // ── Weitere Tageswerte aus WHOOP (09.10., Kevin: „mit allen Daten, die du bekommen kannst“) ──────────────────────────────
  // Alle optional, nur von WHOOP geschrieben (Quelle `whoop`, lib/whoop/abbilden.ts `tageswerte`) — von Hand gibt es sie (noch) nicht;
  // die Regel „Handwert gewinnt“ gilt trotzdem je Feld (ein Feld ohne `whoop`-Herkunft fasst der Abgleich nie an). Felder der API v2:
  // https://developer.whoop.com/api (research/whoop/FAKTEN_WHOOP.md › 5). Fehlt ein Wert, fehlt das Feld (nie 0 als „keine Angabe“).
  /** Tages-Strain 0–21 (Zyklus `score.strain`). */
  strain?: number;
  /** Energie des Tages in kcal (Zyklus `score.kilojoule` ÷ 4,184, ganze Zahl). */
  kcal?: number;
  /** Schritte des Tages (Zyklus `step_count`). */
  schritte?: number;
  /** Blutsauerstoff in % (Recovery `spo2_percentage`). */
  spo2?: number;
  /** Hauttemperatur in °C (Recovery `skin_temp_celsius`) — sinnvoll nur gegen den eigenen Bezug, nie als absolute Ampel. */
  hautTemp?: number;
  /** Atemfrequenz im Schlaf (Sleep `respiratory_rate`; Einheit: Atemzüge je Minute — Annahme, die Doku nennt keine). */
  atem?: number;
  /** Schlaf-Leistung in % = geschlafen ÷ Bedarf (Sleep `sleep_performance_percentage`). */
  schlafLeistung?: number;
  /** Schlaf-Konsistenz in % (Sleep `sleep_consistency_percentage`). */
  schlafKonsistenz?: number;
  /** Schlaf-Effizienz in % (Sleep `sleep_efficiency_percentage`). */
  schlafEffizienz?: number;
  /** Schlafbedarf in Stunden (Sleep `sleep_needed`: Basis + Schlafschuld + Belastung + Nickerchen). */
  schlafBedarf?: number;
  /** Schlafphasen in Stunden (Sleep `stage_summary`): leicht · Tiefschlaf · REM · wach im Bett. */
  phaseLeicht?: number;
  phaseTief?: number;
  phaseRem?: number;
  phaseWach?: number;
  /** Störungen im Schlaf (Sleep `stage_summary.disturbance_count`). */
  stoerungen?: number;
}
/** Die Felder, die eine Quelle liefern UND die Person von Hand setzen kann (Morgen-Check). */
export type VitalFeld = 'rec' | 'sleep' | 'hrv' | 'rhr';
/** Weitere Tageswerte, die nur eine Quelle (WHOOP) liefert (09.10.). */
export type ZusatzFeld = 'strain' | 'kcal' | 'schritte' | 'spo2' | 'hautTemp' | 'atem' | 'schlafLeistung' | 'schlafKonsistenz' | 'schlafEffizienz'
  | 'schlafBedarf' | 'phaseLeicht' | 'phaseTief' | 'phaseRem' | 'phaseWach' | 'stoerungen';
/** Alle Messfelder eines Tages (Kern + Zusatz) — über diese Liste mischt der WHOOP-Abgleich ein (Handwert gewinnt je Feld). */
export type MessFeld = VitalFeld | ZusatzFeld;
/** Herkunft eines Vitalwerts (siehe `DayVitals.quellen`). */
export type VitalQuelle = 'whoop' | 'whoop-export' | 'hand';
export const VITAL_FELDER: readonly VitalFeld[] = ['rec', 'sleep', 'hrv', 'rhr'];
export const ZUSATZ_FELDER: readonly ZusatzFeld[] = ['strain', 'kcal', 'schritte', 'spo2', 'hautTemp', 'atem', 'schlafLeistung', 'schlafKonsistenz', 'schlafEffizienz',
  'schlafBedarf', 'phaseLeicht', 'phaseTief', 'phaseRem', 'phaseWach', 'stoerungen'];
export const MESS_FELDER: readonly MessFeld[] = [...VITAL_FELDER, ...ZUSATZ_FELDER];
export type VitalsLog = Record<string, DayVitals>;

export interface ResolvedVitals {
  rec: number;
  sleep: number;
  hrv: number;
  rhr: number;
  note?: string;
  /** Datum, aus dem die Werte stammen */
  stand: string;
  /** true = heute eingetragen */
  heute: boolean;
  /** Alter in Tagen (0 = heute) */
  alterTage: number;
  /** true = gar kein Eintrag — alle Werte 0 (keine Angabe), `stand` „—“ */
  fallback: boolean;
}

// Datums-Key kommt aus der einen Zeit-Quelle — hier nur re-exportiert.
import { localDay } from '@/lib/zeit';
export { localDay };

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  if (isNaN(a) || isNaN(b)) return 999;
  return Math.round((b - a) / 86_400_000);
}

/** Trägt der Tag einen Kernwert (Recovery, Schlaf, HRV, Ruhepuls) oder eine Notiz? */
export function hatKernwert(v: DayVitals | undefined): boolean {
  if (!v || typeof v !== 'object') return false;
  return VITAL_FELDER.some(f => typeof v[f] === 'number' && Number.isFinite(v[f])) || (typeof v.note === 'string' && !!v.note);
}

/** Die Werte, mit denen gerechnet werden soll — heute, sonst der letzte bekannte Stand, sonst keine (0 = keine Angabe).
 *  `person` ist Pflicht (Regel 5, kein Rückfall auf eine feste Person): wer für niemanden rechnet, liest keine Werte. */
export async function resolveVitals(today: string | undefined, person: string): Promise<ResolvedVitals> {
  const tag = today ?? localDay();
  const keine: ResolvedVitals = { rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true };
  try {
    const log = (await loadJson<VitalsLog>(speicherFuer('vitals', person))) ?? {};
    // Nur Tage mit einem Kernwert oder einer Notiz (09.10.): ein Tag, an dem bisher nur Zusatzwerte stehen (z. B. Schritte des laufenden
    // WHOOP-Zyklus nach Mitternacht), verdrängt den letzten echten Morgen-Check nicht.
    const days = Object.keys(log).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= tag && hatKernwert(log[d])).sort();
    const latest = days[days.length - 1];
    if (!latest) return keine;
    const v = log[latest] ?? {};
    const zahl = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0);
    return {
      rec: zahl(v.rec),
      sleep: zahl(v.sleep),
      hrv: zahl(v.hrv),
      rhr: zahl(v.rhr),
      note: v.note,
      stand: latest,
      heute: latest === tag,
      alterTage: daysBetween(latest, tag),
      fallback: false,
    };
  } catch {
    return keine;
  }
}

/** Die Werte als kurze Zeile für Prompts — fehlende Werte ehrlich als „—“ (nie eine erfundene Zahl). */
export function vitalsKurz(v: Pick<ResolvedVitals, VitalFeld>, felder: readonly VitalFeld[] = ['rec', 'sleep']): string {
  const NAME: Record<VitalFeld, [string, string]> = { rec: ['Recovery', '%'], sleep: ['Schlaf', 'h'], hrv: ['HRV', ''], rhr: ['Ruhepuls', ''] };
  return felder.map(f => { const [n, e] = NAME[f]; const w = v[f]; return w > 0 ? `${n} ${w}${e}` : `${n} —`; }).join(', ');
}

/** Ampel aus der Recovery — die eine Regel, die überall gleich gilt. */
export function zoneOf(rec: number): 'GRÜN' | 'GELB' | 'ROT' {
  return rec >= 66 ? 'GRÜN' : rec >= 40 ? 'GELB' : 'ROT';
}

/** Zone für die Tagesplanung: ohne Recovery-Wert (0 = keine Angabe) keine Zone aus einer erfundenen Zahl, sondern GELB
 *  (mit Puffer planen) — 08.10. abends, seit es keine festen Rückfallwerte mehr gibt. */
export function tagesZone(rec: number): 'GRÜN' | 'GELB' | 'ROT' {
  return rec > 0 ? zoneOf(rec) : 'GELB';
}

/** Ehrlicher Hinweis für den Prompt, wenn die Werte nicht von heute sind (neutral — kein Name im Code). */
export function vitalsHint(v: ResolvedVitals): string {
  if (v.heute) return '';
  if (v.fallback) return ' — ACHTUNG: Es liegen keine Werte vor. Bitte die Person, unter /os/gesundheit ihren Morgen-Check zu machen (oder WHOOP zu verbinden), und bewerte die Tagesform vorsichtig.';
  return ` — ACHTUNG: diese Werte sind vom ${v.stand} (${v.alterTage} Tag(e) alt), NICHT von heute. Behandle die Tagesform als unsicher und bitte die Person um ihren Morgen-Check unter /os/gesundheit.`;
}
