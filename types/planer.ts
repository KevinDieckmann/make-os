// ─── MAKE OS — Planer-Typen (eine Wahrheit) ─────────────────────────────────
// PlanBlock war fünfmal definiert (Route, Wochenplaner, Tagesplan, Ritual,
// Energie) — fünf Stellen, die auseinanderlaufen können. Härtung 04.08.:
// EIN Typ hier, alle importieren.

export const PLAN_ARTEN = ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'] as const;
export type PlanArt = typeof PLAN_ARTEN[number];

export interface PlanBlock {
  id: string;
  /** Tag YYYY-MM-DD */
  date: string;
  /** Minuten ab 00:00 */
  startMin: number;
  dauerMin: number;
  titel: string;
  art: PlanArt;
  /** Verknüpfte Aufgabe, wenn der Block aus dem Board gezogen wurde. */
  taskId?: string;
  /** Termin-Id im Apple Kalender, falls der Block dorthin gespiegelt wurde. */
  appleUid?: string;
}

/** Die eine Farbwahrheit je Art — vorher in jeder Ansicht einzeln notiert. */
export const ART_FARBE: Record<PlanArt, string> = {
  fokus: '#21B5AA',
  reha: '#58D9CD',
  routine: '#D9A441',
  pause: '#96A8A2',
  aufgabe: '#4A6CF7',
  block: '#AC9D80',
};
