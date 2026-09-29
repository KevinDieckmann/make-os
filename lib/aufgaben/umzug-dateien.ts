// ─── Umzug Privat ↔ Business: Dateien ziehen mit (29.09., #4) ───────────────
// Nach jedem Aufgaben-Schreiben (lib/aufgaben/speicher.ts): Aufgaben, deren Bereich (privat/business) sich geändert hat,
// nehmen den Bereich ihrer Dateien mit (lib/dateien/aufgaben-ablage.ts `aufgabenDateienBereichSetzen`). Wirft nie.

import type { TasksState } from '@/types/tasks';
import { bereichVonSpace } from './struktur';

/** Aufgaben mit neuem Bereich (rein). */
export function bereichGewechselt(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>): Map<string, 'privat' | 'business'> {
  const alt = new Map(vorher.tasks.map(t => [t.id, t.spaceId]));
  const raus = new Map<string, 'privat' | 'business'>();
  for (const t of nachher.tasks) {
    if (!alt.has(t.id) || !t.spaceId) continue;
    const a = alt.get(t.id);
    if (a && bereichVonSpace(a) !== bereichVonSpace(t.spaceId)) raus.set(t.id, bereichVonSpace(t.spaceId));
  }
  return raus;
}

export async function dateienBereichNachziehen(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>, haushalt: string | undefined, person: string): Promise<number> {
  if (!haushalt) return 0;
  const neu = bereichGewechselt(vorher, nachher);
  if (!neu.size) return 0;
  try {
    const { aufgabenDateienBereichSetzen } = await import('@/lib/dateien/aufgaben-ablage');
    return await aufgabenDateienBereichSetzen(haushalt, person, neu);
  } catch (e) {
    console.error('[aufgaben/umzug] Bereich der Dateien nicht nachgezogen —', e instanceof Error ? e.message : e);
    return 0;
  }
}
