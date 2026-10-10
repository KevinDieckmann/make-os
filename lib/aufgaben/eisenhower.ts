// ─── Aufgaben nach Eisenhower (10.10., Heute › Top 3; Kevin 08.10.: „Prioritäten (Eisenhower) sichtbarer“) ──────────────────────────
// EINE Stelle für die Einordnung — rein und client-sicher: der Server rechnet damit die Top 3 des Tages, die Aufgaben-Karte auf Heute
// zeichnet das Zeichen daraus, und „Geplant“ im Agenten-Bereich (lib/agenten/naechstes.ts) nimmt dieselbe Vierfelder-Regel.
//
//   q1 wichtig + dringend · q2 wichtig · q3 dringend · q4 weder noch
//
// Aufgabe: WICHTIG = Priorität hoch oder kritisch (oder ein Grund von außen, z. B. ein Meilenstein mit Frist — `wichtigWeil`);
// DRINGEND = Deadline in höchstens `FRIST_DRINGEND_TAGE` Tagen (überfällige Aufgaben ohnehin). KRITISCH = Priorität kritisch — nur diese
// Aufgaben pulsieren (Leitbild: „Kritisch pulsiert“, Klasse `krit-puls` in app/globals.css). Die Einordnung wird nie gespeichert.

import type { Task } from '@/types/tasks';
import type { Eisenhower } from '@/lib/agenten/typen';
import { tagPlus } from '@/lib/kalender/zeit';

/** So viele Tage vor der Deadline gilt etwas als dringend (Aufgaben, Fristen, Läufe — eine Grenze für „Geplant“ und „Top 3“). */
export const FRIST_DRINGEND_TAGE = 2;

export const quadrantVon = (wichtig: boolean, dringend: boolean): Eisenhower => (wichtig ? (dringend ? 'q1' : 'q2') : dringend ? 'q3' : 'q4');

/** Die Namen der vier Felder (für Zeichen, Erklärung und „Geplant“). */
export const EISENHOWER_NAME: Readonly<Record<Eisenhower, string>> = { q1: 'Wichtig & dringend', q2: 'Wichtig', q3: 'Dringend', q4: 'Später' };

export interface Einordnung { wichtig: boolean; dringend: boolean; quadrant: Eisenhower; kritisch: boolean }

/** Kritisch = Priorität kritisch (offen oder nicht — der Aufrufer entscheidet, ob eine erledigte noch zeigt). */
export const istKritisch = (t: Pick<Task, 'priority'>): boolean => t.priority === 'critical';

/**
 * Die Einordnung einer Aufgabe am Tag `heute` (Berliner Tag). `wichtigWeil`: ein Grund von außen, der eine Aufgabe wichtig macht, obwohl ihre
 * Priorität es nicht sagt (Meilenstein mit naher Frist, andere warten darauf) — kommt nur vom Server, der Browser rechnet ohne.
 */
export function aufgabeEinordnung(t: Pick<Task, 'priority' | 'dueDate'>, heute: string, wichtigWeil = false): Einordnung {
  const wichtig = wichtigWeil || t.priority === 'high' || t.priority === 'critical';
  const faellig = t.dueDate ? t.dueDate.slice(0, 10) : '';
  const dringend = !!faellig && faellig <= tagPlus(heute, FRIST_DRINGEND_TAGE);
  return { wichtig, dringend, quadrant: quadrantVon(wichtig, dringend), kritisch: istKritisch(t) };
}

/** Rang eines Feldes (q1 = 0 … q4 = 3) — zum Sortieren. */
export const quadrantRang = (q: Eisenhower): number => ['q1', 'q2', 'q3', 'q4'].indexOf(q);
