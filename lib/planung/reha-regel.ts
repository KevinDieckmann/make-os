// ─── Reha als eigene Gewohnheit — EINE reine Regel (Server UND Browser) ──────
// Reha gehört nur dann in Prüfungen (Schild „Reha fehlt“, Tagesplanung „Durchgeplant“), wenn die Person selbst in den
// letzten `REHA_GEWOHNHEIT_TAGE` Tagen Reha-Blöcke geplant hat — nie fest für alle (08.10. abends, Plattform-Regel).

import { tagPlus } from '@/lib/kalender/zeit';

/** Wie weit zurück „Reha gehört zur eigenen Routine“ zählt (Tage). */
export const REHA_GEWOHNHEIT_TAGE = 14;

type BlockKurz = { date: string; art: string };

/** Hat die Person in den letzten `REHA_GEWOHNHEIT_TAGE` Tagen vor `today` selbst Reha geplant? */
export function rehaGewohnt(bloecke: readonly BlockKurz[], today: string): boolean {
  const ab = tagPlus(today, -REHA_GEWOHNHEIT_TAGE);
  return bloecke.some(b => b.art === 'reha' && b.date >= ab && b.date < today);
}

/**
 * Reha-Schild (rein): heute sind Blöcke geplant, aber kein Reha-Block — UND die Person hat in den letzten
 * `REHA_GEWOHNHEIT_TAGE` Tagen selbst Reha-Blöcke geplant. Wer nie Reha plant, bekommt den Schild nie.
 */
export function rehaFehltHeute(bloecke: readonly BlockKurz[], today: string): boolean {
  const heute = bloecke.filter(b => b.date === today);
  if (!heute.length || heute.some(b => b.art === 'reha')) return false;
  return rehaGewohnt(bloecke, today);
}
