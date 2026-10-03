// ─── Lichtfäden v2 — Navigation durch die Ebenen (rein, getestet) ───────────
// Tippen auf ein Bündel = eine Ebene tiefer (die Kinder fächern aus ihm auf), eine Brotkrume = zurück (die Kinder fließen
// in ihr Bündel zusammen). Der Zustand ist nur die Wurzel + der laufende Übergang; die Daten holt die Oberfläche je Wurzel.

import type { Buendel } from './baum';
import type { Knoten } from './modell';

export interface NavUebergang {
  richtung: 'auf' | 'zu';
  /** Das Bündel der OBEREN Ebene, das auf- bzw. zufächert (Knoten-Kennung). */
  fokus: string;
  /** Die Wurzel, von der aus gewechselt wurde. */
  von: string;
}
export interface NavStand { wurzel: string; uebergang: NavUebergang | null }

export const navStart = (wurzel: string): NavStand => ({ wurzel, uebergang: null });

/** Eine Ebene tiefer in ein Bündel — null, wenn es darunter nichts aufzufächern gibt. */
export function tiefer(stand: NavStand, b: Pick<Buendel, 'id' | 'tiefer'>): NavStand | null {
  if (!b.tiefer || b.tiefer === stand.wurzel) return null;
  return { wurzel: b.tiefer, uebergang: { richtung: 'auf', fokus: b.id, von: stand.wurzel } };
}

/**
 * Zurück zu einem Knoten der Brotkrumen (`pfad` = Brotkrumen der aktuellen Ansicht, von „gesamt“ bis zur Wurzel). Fokus
 * des Übergangs ist das Kind dieses Knotens auf dem Weg zur bisherigen Wurzel — dorthin fließen die Fäden zusammen.
 */
export function zurueck(stand: NavStand, ziel: string, pfad: readonly Pick<Knoten, 'id'>[]): NavStand | null {
  const i = pfad.findIndex(k => k.id === ziel);
  if (i < 0 || ziel === stand.wurzel || i + 1 >= pfad.length) return null;
  return { wurzel: ziel, uebergang: { richtung: 'zu', fokus: pfad[i + 1].id, von: stand.wurzel } };
}

/** Eine Wurzel von außen setzen (Seite wechselt Ziel/Space) — ohne Übergang. */
export const springe = (wurzel: string): NavStand => navStart(wurzel);
