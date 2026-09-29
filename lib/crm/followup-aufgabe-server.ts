// ─── Follow-up = Aufgabe (29.09., #99) — Server-Teil ─────────────────────────
// Die reinen Regeln (auch im Browser genutzt) liegen in ./followup-aufgabe.ts. Hier: der Abgleich in beide Richtungen.

import type { TasksState } from '@/types/tasks';
import type { FollowUp } from './typen';
import { neuErledigt, followupsErledigen } from './followup-aufgabe';

/** Nach jedem Aufgaben-Schreiben: erledigte Aufgaben → ihre offenen Follow-ups erledigt. Wirft nie (das Schreiben der Aufgabe steht schon). */
export async function followupsNachAufgaben(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>, person: string): Promise<number> {
  const fertig = neuErledigt(vorher, nachher);
  if (!fertig.length) return 0;
  try {
    const { ladeCrm, aendereCrm } = await import('./speicher');
    const c0 = await ladeCrm();
    if (!(c0.followups ?? []).some(f => f.aufgabeId && fertig.includes(f.aufgabeId) && f.status === 'offen')) return 0;
    let n = 0;
    const jetzt = new Date().toISOString();
    await aendereCrm(c => { const r = followupsErledigen(c, fertig, person, jetzt); n = r.erledigt.length; return r.crm; }, { art: person === 'system' ? 'system' : 'person', ...(person !== 'system' ? { person } : {}) });
    return n;
  } catch (e) {
    console.error('[followup-aufgabe] Follow-ups nicht nachgezogen:', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Follow-up erledigt → die verknüpfte Aufgabe erledigt (über den Aufgaben-Schreibweg, Verlauf „durch System“). Idempotent. */
export async function aufgabeErledigenNachFollowUp(f: Pick<FollowUp, 'aufgabeId'>, person: string): Promise<boolean> {
  if (!f.aufgabeId) return false;
  try {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const id = f.aufgabeId;
    const r = await systemAufgabenAendern(stand => {
      const t = stand.tasks.find(x => x.id === id);
      return t && t.status !== 'done' && t.status !== 'cancelled' && !t.geloeschtAm ? { teile: [{ id, felder: { status: 'done' } }] } : {};
    }, { person });
    return r.ok;
  } catch (e) {
    console.error('[followup-aufgabe] Aufgabe nicht erledigt:', e instanceof Error ? e.message : e);
    return false;
  }
}
