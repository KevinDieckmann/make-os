// ─── Sport · Entlastung nach Tagesform: HRV-Trend und Ruhepuls statt fester Deload-Wochen (rein, getestet, 09.10.2026) ─────
// Wunsch der trainierenden Person (09.10.): „Deload nach Tagesform/HRV-Trend, nicht fest alle 3–4 Wochen.“ EINE Regel:
//   In den letzten `fensterTage` Tagen (Vorgabe 3) ist ein Tag auffällig, wenn die HRV unter `hrvAnteil` (Vorgabe 90 %) des Bezugs liegt
//   ODER der Ruhepuls über Bezug + `pulsPlus` (Vorgabe 3 Schläge). Sind mindestens `mindestTage` (Vorgabe 2) Tage auffällig, schlägt die
//   Regel eine Entlastung vor (die Person nimmt sie für die Woche an → Phase „Deload“, lib/sport/plan-bau.ts).
//   Bezug = Ø der 14 Tage VOR dem Fenster (mindestens 5 Werte je Größe) — so zieht ein schlechtes Fenster den eigenen Maßstab nicht mit nach unten.
// Mehrere leicht auffällige Tage sagen mehr als ein einzelner tiefer Wert (darum mildere Schwellen als die Tages-Ampel der Körperwerte,
// lib/gesundheit/koerperwerte.ts: 85 % / +4). Alle Zahlen sind eigene Annahmen und je Person einstellbar (`SportStand.einstellungen.entlastung`).
// Ein Vorschlag, keine Trainings- oder ärztliche Beratung.

import type { EntlastungEinstellung } from './modell';
import { tagPlus } from './pace';

export const ENTLASTUNG_VORGABE = { fensterTage: 3, mindestTage: 2, hrvAnteil: 0.9, pulsPlus: 3 } as const;
export const BEZUG_TAGE = 14;
export const BEZUG_MIN = 5;

export interface EntlastungTag { tag: string; hrv?: number; ruhepuls?: number; auffaellig: boolean; gruende: string[] }
export interface EntlastungLage {
  /** Entlastung vorschlagen? */
  vorschlag: boolean;
  auffaellig: number;
  /** Tage im Fenster mit mindestens einem Wert. */
  gemessen: number;
  fensterTage: number;
  mindestTage: number;
  bezug: { hrv?: number; ruhepuls?: number };
  tage: EntlastungTag[];
  text: string;
}

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const mittel = (w: number[]) => w.reduce((a, b) => a + b, 0) / w.length;

/** Die wirksamen Zahlen (Einstellung der Person, sonst Vorgabe). */
export function entlastungZahlen(e?: EntlastungEinstellung): { fensterTage: number; mindestTage: number; hrvAnteil: number; pulsPlus: number } {
  const fensterTage = e?.fensterTage ?? ENTLASTUNG_VORGABE.fensterTage;
  return {
    fensterTage,
    mindestTage: Math.min(fensterTage, e?.mindestTage ?? ENTLASTUNG_VORGABE.mindestTage),
    hrvAnteil: e?.hrvAnteil ?? ENTLASTUNG_VORGABE.hrvAnteil,
    pulsPlus: e?.pulsPlus ?? ENTLASTUNG_VORGABE.pulsPlus,
  };
}

/**
 * Die Lage bis `heute` (einschließlich). null = ausgeschaltet oder zu wenig Werte (weniger als `mindestTage` gemessene Tage im Fenster
 * oder kein Bezug) — dann sagt die Regel nichts, statt zu raten.
 */
export function entlastungPruefen(log: Readonly<Record<string, { hrv?: number; ruhepuls?: number } | undefined>>, heute: string, einst?: EntlastungEinstellung): EntlastungLage | null {
  if (einst?.aus) return null;
  const z = entlastungZahlen(einst);
  const fensterStart = tagPlus(heute, -(z.fensterTage - 1));
  const bezugWerte = (feld: 'hrv' | 'ruhepuls') => {
    const w: number[] = [];
    for (let i = 1; i <= BEZUG_TAGE; i++) { const v = log[tagPlus(fensterStart, -i)]?.[feld]; if (ok(v)) w.push(v); }
    return w.length >= BEZUG_MIN ? mittel(w) : undefined;
  };
  const bezug = { hrv: bezugWerte('hrv'), ruhepuls: bezugWerte('ruhepuls') };
  if (bezug.hrv === undefined && bezug.ruhepuls === undefined) return null;
  const tage: EntlastungTag[] = [];
  for (let i = 0; i < z.fensterTage; i++) {
    const tag = tagPlus(fensterStart, i);
    const d = log[tag];
    const hrv = ok(d?.hrv) ? d!.hrv : undefined, ruhepuls = ok(d?.ruhepuls) ? d!.ruhepuls : undefined;
    if (hrv === undefined && ruhepuls === undefined) continue;
    const gruende: string[] = [];
    if (hrv !== undefined && bezug.hrv !== undefined && hrv < bezug.hrv * z.hrvAnteil) gruende.push(`HRV ${Math.round(hrv)} unter ${Math.round(z.hrvAnteil * 100)} % deines Bezugs (${Math.round(bezug.hrv)})`);
    if (ruhepuls !== undefined && bezug.ruhepuls !== undefined && ruhepuls > bezug.ruhepuls + z.pulsPlus) gruende.push(`Ruhepuls ${Math.round(ruhepuls)} über deinem Bezug (${Math.round(bezug.ruhepuls)}) + ${z.pulsPlus}`);
    tage.push({ tag, ...(hrv !== undefined ? { hrv } : {}), ...(ruhepuls !== undefined ? { ruhepuls } : {}), auffaellig: gruende.length > 0, gruende });
  }
  if (tage.length < z.mindestTage) return null;
  const auffaellig = tage.filter(t => t.auffaellig).length;
  const vorschlag = auffaellig >= z.mindestTage;
  const text = vorschlag
    ? `An ${auffaellig} von ${tage.length} Tagen lagen HRV oder Ruhepuls deutlich neben deinem Normal — eine leichtere Woche (Deload) könnte jetzt passen.`
    : auffaellig ? `${auffaellig} auffälliger Tag in den letzten ${z.fensterTage} — noch kein Muster.` : `HRV und Ruhepuls im Rahmen deines Normals.`;
  return {
    vorschlag, auffaellig, gemessen: tage.length, fensterTage: z.fensterTage, mindestTage: z.mindestTage,
    bezug: { ...(bezug.hrv !== undefined ? { hrv: Math.round(bezug.hrv) } : {}), ...(bezug.ruhepuls !== undefined ? { ruhepuls: Math.round(bezug.ruhepuls) } : {}) },
    tage, text,
  };
}
