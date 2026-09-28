// ─── Follow-up = Aufgabe (29.09., #99) ──────────────────────────────────────
// Vorher zwei Wahrheiten: „Aufgabe anlegen“ in Kontakt öffnen legte ein Follow-up an, die Karte daneben zeigte Aufgaben;
// eine verknüpfte Aufgabe erledigen ließ das Follow-up offen. Jetzt:
//   · Neue „Aufgaben“ aus dem CRM sind Aufgaben mit `bezug` (Kontakt/Firma) — die Follow-up-Liste zeigt sie mit an.
//   · Bestehende Follow-ups mit `aufgabeId` bleiben verknüpft, der Abgleich läuft serverseitig in beide Richtungen und
//     ist idempotent: Aufgabe erledigt → Follow-up erledigt (hier, eingehängt in lib/aufgaben/speicher.ts nach jedem
//     Schreiben); Follow-up erledigt → Aufgabe erledigt (app/api/crm/followup über `aufgabeErledigenNachFollowUp`).
// Rein: `neuErledigt`, `followupsErledigen`, `aufgabenAlsFaellig`. Server: `followupsNachAufgaben`, `aufgabeErledigenNachFollowUp`.

import type { Task, TasksState } from '@/types/tasks';
import type { CrmBestand, FollowUp } from './typen';

/** Aufgaben, die in diesem Schreiben erledigt wurden (vorher nicht erledigt, jetzt erledigt). */
export function neuErledigt(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>): string[] {
  const alt = new Map(vorher.tasks.map(t => [t.id, t.status]));
  return nachher.tasks.filter(t => t.status === 'done' && alt.get(t.id) !== 'done').map(t => t.id);
}

/** Offene Follow-ups dieser Aufgaben auf „erledigt“ (rein). Unverändert, wenn keins passt (dasselbe Objekt). */
export function followupsErledigen(c: CrmBestand, aufgabeIds: readonly string[], person: string, jetzt: string): { crm: CrmBestand; erledigt: string[] } {
  const ids = new Set(aufgabeIds);
  const erledigt: string[] = [];
  const followups = (c.followups ?? []).map(f => {
    if (!f.aufgabeId || !ids.has(f.aufgabeId) || f.status !== 'offen') return f;
    erledigt.push(f.id);
    return { ...f, status: 'erledigt' as const, erledigtAm: jetzt, notiz: `${f.notiz ? `${f.notiz}\n` : ''}Über die verknüpfte Aufgabe erledigt.`.slice(0, 1000), geaendert: jetzt, geaendertVon: person };
  });
  return erledigt.length ? { crm: { ...c, followups }, erledigt } : { crm: c, erledigt };
}

/** Eine Zeile der Follow-up-Liste für eine Aufgabe mit CRM-Bezug (nur offen, mit Deadline). */
export interface AufgabeFaellig { id: string; aufgabeId: string; titel: string; faellig: string; kontaktId?: string; firmaId?: string; zustaendig: string; tageUeber: number }

/** Offene Aufgaben mit Bezug zu Kontakt/Firma/Deal/Mandat und Deadline — für die Follow-up-Liste (rein). */
export function aufgabenAlsFaellig(tasks: readonly Task[], heute: string, horizontTage = 14): AufgabeFaellig[] {
  const bis = new Date(Date.parse(`${heute}T12:00:00Z`) + horizontTage * 86_400_000).toISOString().slice(0, 10);
  return tasks
    .filter(t => !t.geloeschtAm && t.status !== 'done' && t.status !== 'cancelled' && !!t.dueDate && !!t.bezug && (t.bezug.kontaktId || t.bezug.firmaId || t.bezug.dealId || t.bezug.mandatId) && t.dueDate.slice(0, 10) <= bis)
    .map(t => {
      const tag = t.dueDate!.slice(0, 10);
      return {
        id: `a:${t.id}`, aufgabeId: t.id, titel: t.title, faellig: tag, ...(t.bezug?.kontaktId ? { kontaktId: t.bezug.kontaktId } : {}), ...(t.bezug?.firmaId ? { firmaId: t.bezug.firmaId } : {}),
        zustaendig: t.assignee, tageUeber: Math.max(0, Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${tag}T12:00:00Z`)) / 86_400_000)),
      };
    })
    .sort((a, b) => a.faellig.localeCompare(b.faellig));
}

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
