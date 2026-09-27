// ─── Sport · Erholung: Ampel „heute trainieren?“ ────────────────────────────
// Aus dem, was die Person heute weiß (Schlaf, Gefühl, Muskelkater, Puls, HRV —
// von Hand oder aus den Vitalwerten) und dem, was der Plan heute vorsieht.
// Ein Hinweis, keine Trainingsberatung. Ohne Werte sagt die Ampel ehrlich „unbekannt“.

import type { ErholungTag, PlanArt } from './modell';

export type Stufe = 'gruen' | 'gelb' | 'rot' | 'unbekannt';
export interface Ampel { stufe: Stufe; punkte: number | null; text: string; gruende: string[] }

export interface Bezug { hrv7?: number; ruhepuls7?: number }

/** Mittel der letzten 7 Tage aus dem Erholungs-Log für HRV und Ruhepuls (ohne heute). */
export function bezugAus(log: Record<string, ErholungTag>, heute: string): Bezug {
  const tage = Object.keys(log).filter(d => d < heute).sort().slice(-7);
  const hrv = tage.map(d => log[d].hrv).filter((v): v is number => !!v);
  const rp = tage.map(d => log[d].ruhepuls).filter((v): v is number => !!v);
  return {
    hrv7: hrv.length >= 3 ? Math.round(hrv.reduce((a, b) => a + b, 0) / hrv.length) : undefined,
    ruhepuls7: rp.length >= 3 ? Math.round(rp.reduce((a, b) => a + b, 0) / rp.length) : undefined,
  };
}

/**
 * Erholungspunkte 0–100. Jedes vorhandene Merkmal zählt gleich; fehlende Merkmale
 * verwässern nicht (Punkte = Mittel der gemessenen). Null, wenn nichts gemessen ist.
 */
export function erholungsPunkte(t: ErholungTag | undefined, bezug: Bezug = {}, recovery?: number): { punkte: number | null; gruende: string[] } {
  const teile: number[] = [];
  const gruende: string[] = [];
  if (typeof recovery === 'number') { teile.push(Math.max(0, Math.min(100, recovery))); gruende.push(`Recovery ${Math.round(recovery)} %`); }
  if (t?.schlafH !== undefined) { const p = t.schlafH >= 7.5 ? 100 : t.schlafH >= 6.5 ? 65 : t.schlafH >= 5.5 ? 35 : 10; teile.push(p); gruende.push(`Schlaf ${String(t.schlafH).replace('.', ',')} h`); }
  if (t?.gefuehl) { teile.push([0, 10, 35, 65, 85, 100][t.gefuehl]); gruende.push(`Gefühl ${t.gefuehl}/5`); }
  if (t?.muskelkater) { teile.push([0, 100, 85, 60, 30, 10][t.muskelkater]); gruende.push(`Muskelkater ${t.muskelkater}/5`); }
  if (t?.hrv && bezug.hrv7) { const q = t.hrv / bezug.hrv7; teile.push(q >= 1 ? 100 : q >= 0.92 ? 70 : q >= 0.85 ? 40 : 15); gruende.push(`HRV ${t.hrv} (Ø ${bezug.hrv7})`); }
  if (t?.ruhepuls && bezug.ruhepuls7) { const d = t.ruhepuls - bezug.ruhepuls7; teile.push(d <= 0 ? 100 : d <= 3 ? 75 : d <= 6 ? 40 : 15); gruende.push(`Ruhepuls ${t.ruhepuls} (Ø ${bezug.ruhepuls7})`); }
  if (!teile.length) return { punkte: null, gruende };
  return { punkte: Math.round(teile.reduce((a, b) => a + b, 0) / teile.length), gruende };
}

const HART: PlanArt[] = ['hyrox'];

/** Die Ampel für heute: Erholung gegen geplante Belastung. */
export function ampel(t: ErholungTag | undefined, geplant: PlanArt, bezug: Bezug = {}, recovery?: number): Ampel {
  const { punkte, gruende } = erholungsPunkte(t, bezug, recovery);
  if (punkte === null) {
    return { stufe: 'unbekannt', punkte, gruende, text: geplant === 'ruhe' ? 'Ruhetag laut Plan. Trag kurz ein, wie du geschlafen hast — dann sagt die Ampel morgen mehr.' : 'Noch keine Werte für heute. Schlaf und Gefühl eintragen, dann zeigt die Ampel, ob der Plan passt.' };
  }
  if (geplant === 'ruhe') return { stufe: 'gruen', punkte, gruende, text: punkte < 45 ? 'Ruhetag — und den brauchst du heute auch. Gut geplant.' : 'Ruhetag laut Plan. Erholung ist Training.' };
  if (punkte >= 65) return { stufe: 'gruen', punkte, gruende, text: geplant === 'frei' ? 'Frisch. Wenn du willst, ist heute ein guter Tag für eine Einheit.' : `Frisch — ${label(geplant)} wie geplant.` };
  if (punkte >= 45) return { stufe: 'gelb', punkte, gruende, text: HART.includes(geplant) || geplant === 'gym' ? `Mittel erholt. ${label(geplant)} geht — lieber Technik und Umfang statt Maximal.` : geplant === 'lauf' ? 'Mittel erholt. Lauf locker halten, Intervalle verschieben.' : 'Mittel erholt. Etwas Leichtes ist in Ordnung.' };
  return { stufe: 'rot', punkte, gruende, text: geplant === 'frei' ? 'Wenig erholt. Heute lieber Pause oder Spaziergang.' : `Wenig erholt. Statt ${label(geplant)} heute leicht bewegen oder tauschen mit einem Ruhetag.` };
}

const label = (a: PlanArt) => ({ hyrox: 'Hyrox', lauf: 'Lauf', gym: 'Gym', ruhe: 'Ruhe', frei: 'frei' })[a];

export const AMPEL_LABEL: Record<Stufe, string> = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot', unbekannt: 'Offen' };
