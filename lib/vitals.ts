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
  quellen?: Partial<Record<VitalFeld, VitalQuelle>>;
}
/** Die Felder, die eine Quelle (WHOOP) liefern kann. */
export type VitalFeld = 'rec' | 'sleep' | 'hrv' | 'rhr';
/** Herkunft eines Vitalwerts (siehe `DayVitals.quellen`). */
export type VitalQuelle = 'whoop' | 'whoop-export' | 'hand';
export const VITAL_FELDER: readonly VitalFeld[] = ['rec', 'sleep', 'hrv', 'rhr'];
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

/** Die Werte, mit denen gerechnet werden soll — heute, sonst der letzte bekannte Stand, sonst keine (0 = keine Angabe).
 *  `person` ist Pflicht (Regel 5, kein Rückfall auf eine feste Person): wer für niemanden rechnet, liest keine Werte. */
export async function resolveVitals(today: string | undefined, person: string): Promise<ResolvedVitals> {
  const tag = today ?? localDay();
  const keine: ResolvedVitals = { rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true };
  try {
    const log = (await loadJson<VitalsLog>(speicherFuer('vitals', person))) ?? {};
    const days = Object.keys(log).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= tag).sort();
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

/** Ehrlicher Hinweis für den Prompt, wenn die Werte nicht von heute sind (neutral — kein Name im Code). */
export function vitalsHint(v: ResolvedVitals): string {
  if (v.heute) return '';
  if (v.fallback) return ' — ACHTUNG: Es liegen keine Werte vor. Bitte die Person, unter /os/gesundheit ihren Morgen-Check zu machen (oder WHOOP zu verbinden), und bewerte die Tagesform vorsichtig.';
  return ` — ACHTUNG: diese Werte sind vom ${v.stand} (${v.alterTage} Tag(e) alt), NICHT von heute. Behandle die Tagesform als unsicher und bitte die Person um ihren Morgen-Check unter /os/gesundheit.`;
}
