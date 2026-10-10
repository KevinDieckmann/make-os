// ─── Belastungstage für den Wochenvorschlag (09.10.2026, Server) ────────────────────────────────────────────────────────
// Der Essens-Wochenvorschlag (/api/ernaehrung/vorschlag) darf harte Trainingstage berücksichtigen (an diesen Tagen kohlenhydratreicher),
// aber NUR personenneutral und NUR mit Einwilligung (b) „an die KI“ der Person, deren Trainingsplan bzw. Strain einfließt
// (`gesundheitAnKi` — der Trainingsplan und der Strain sind Gesundheitsdaten). In den Prompt gehen nur Wochentage, nie Namen,
// nie Werte (lib/ernaehrung/orientierung.ts `belastungsZeile`).

import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import type { VitalsLog } from '@/lib/vitals';
import { belastungsTage, belastungsTageHaushalt, planBelastung, strainJeWochentag, W_TAGE, type Belastung, type WTag } from './orientierung';

/** Belastungstage des Haushalts aus den Personen, die (b) erklärt haben. `personen` = Konto-Profile (Speichernamen). */
export async function belastungFuerHaushalt(personen: readonly string[], heute: string): Promise<{ tage: WTag[]; mitGesundheit: boolean }> {
  const { gesundheitAnKi } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  const { saeubere } = await import('@/lib/sport/modell');
  const je: WTag[][] = [];
  let mitGesundheit = false;
  for (const p of personen) {
    if (!/^[a-z0-9-]{1,40}$/.test(p)) continue;
    if (!(await gesundheitAnKi(p).catch(() => false))) continue;
    const [sportRoh, vitals] = await Promise.all([loadJson<unknown>(speicherFuer('sport', p)), loadJson<VitalsLog>(speicherFuer('vitals', p))]);
    const woche = saeubere(sportRoh).woche;
    const plan: Partial<Record<WTag, Belastung | null>> = {};
    for (const w of W_TAGE) plan[w] = planBelastung(woche?.[w]);
    const tage = belastungsTage(plan, strainJeWochentag(vitals, heute));
    if (tage.length) { je.push(tage); mitGesundheit = true; }
  }
  return { tage: belastungsTageHaushalt(je), mitGesundheit };
}
