// ─── MAKE OS — Tagesvitalwerte (privat · MAKE.One) ──────────────────────────
// Vorher standen Recovery/Schlaf/HRV als KONSTANTE im Code (Stand 30.07.).
// Für die tägliche Nutzung ist das unbrauchbar: der Fokus-Agent und der
// Morgen-Loop hätten ewig mit denselben Zahlen gerechnet.
//
// Jetzt: Kevin trägt morgens seine Whoop-Werte ein (15 Sekunden), alles
// Nachgelagerte rechnet damit. Ohne Eintrag fallen wir auf den letzten
// bekannten Stand zurück — und sagen ehrlich, wie alt der ist.

import { loadJson } from '@/lib/store/local-db';
import { WHOOP } from '@/lib/make-one/health-data';

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
}
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
  /** true = gar kein Eintrag, wir nutzen den alten Whoop-Export */
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

/** Die Werte, mit denen gerechnet werden soll — heute, sonst der letzte
 *  bekannte Stand, sonst der ursprüngliche Whoop-Export. */
export async function resolveVitals(today = localDay(), person: string = 'kevin'): Promise<ResolvedVitals> {
  // Kevins Whoop-Export ist sein Ausgangspunkt. Malin startet ohne — bei ihr
  // gibt es keine erfundenen Rückfallwerte, sondern ehrlich leere Säulen.
  const base = person === 'kevin'
    ? { rec: WHOOP.rec, sleep: WHOOP.sleepLast, hrv: WHOOP.hrv, rhr: WHOOP.rhr }
    : { rec: 0, sleep: 0, hrv: 0, rhr: 0 };
  try {
    const log = (await loadJson<VitalsLog>(person === 'kevin' ? 'vitals' : `vitals--${person}`)) ?? {};
    const days = Object.keys(log).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today).sort();
    const latest = days[days.length - 1];
    if (!latest) {
      return { ...base, stand: person === 'kevin' ? WHOOP.stand : '—', heute: false, alterTage: 999, fallback: true };
    }
    const v = log[latest] ?? {};
    return {
      rec: typeof v.rec === 'number' ? v.rec : base.rec,
      sleep: typeof v.sleep === 'number' ? v.sleep : base.sleep,
      hrv: typeof v.hrv === 'number' ? v.hrv : base.hrv,
      rhr: typeof v.rhr === 'number' ? v.rhr : base.rhr,
      note: v.note,
      stand: latest,
      heute: latest === today,
      alterTage: daysBetween(latest, today),
      fallback: false,
    };
  } catch {
    return { ...base, stand: person === 'kevin' ? WHOOP.stand : '—', heute: false, alterTage: 999, fallback: true };
  }
}

/** Ampel aus der Recovery — die eine Regel, die überall gleich gilt. */
export function zoneOf(rec: number): 'GRÜN' | 'GELB' | 'ROT' {
  return rec >= 66 ? 'GRÜN' : rec >= 40 ? 'GELB' : 'ROT';
}

/** Ehrlicher Hinweis für den Prompt, wenn die Werte nicht von heute sind. */
export function vitalsHint(v: ResolvedVitals): string {
  if (v.heute) return '';
  if (v.fallback) return ' — ACHTUNG: Kevin hat noch nie Werte eingetragen, das ist ein alter Export. Sag ihm, er soll unter /os/gesundheit seinen Morgen-Check machen, und bewerte die Tagesform vorsichtig.';
  return ` — ACHTUNG: diese Werte sind vom ${v.stand} (${v.alterTage} Tag(e) alt), NICHT von heute. Behandle die Tagesform als unsicher und bitte Kevin um seinen Morgen-Check unter /os/gesundheit.`;
}
