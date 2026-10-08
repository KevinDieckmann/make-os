// ─── Follow-up = Aufgabe (29.09., #99) ──────────────────────────────────────
// Vorher zwei Wahrheiten: „Aufgabe anlegen“ in Kontakt öffnen legte ein Follow-up an, die Karte daneben zeigte Aufgaben;
// eine verknüpfte Aufgabe erledigen ließ das Follow-up offen. Jetzt:
//   · Neue „Aufgaben“ aus dem CRM sind Aufgaben mit `bezug` (Kontakt/Firma) — die Follow-up-Liste zeigt sie mit an.
//   · Bestehende Follow-ups mit `aufgabeId` bleiben verknüpft, der Abgleich läuft serverseitig in beide Richtungen und
//     ist idempotent: Aufgabe erledigt → Follow-up erledigt (hier, eingehängt in lib/aufgaben/speicher.ts nach jedem
//     Schreiben); Follow-up erledigt → Aufgabe erledigt (app/api/crm/followup über `aufgabeErledigenNachFollowUp`).
// Rein (auch im Browser): `neuErledigt`, `followupsErledigen`, `aufgabenAlsFaellig`. Server (lib/crm/followup-aufgabe-server.ts):
// `followupsNachAufgaben`, `aufgabeErledigenNachFollowUp` — getrennt, damit kein Server-Modul ins Browser-Bündel gerät.

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

// ── Aufgabe mit Kontakt-Bezug erledigt → Aktivität am Kontakt (08.10., Woche 1 · 4.7) ─────────────────────────────────────
// Der neue Standardweg „+ Hinzufügen“ in Kontakt öffnen legt Aufgaben an (keine Follow-ups). Beim Abhaken entstand bisher keine
// Aktivität, und die Kadenz lief weiter. Jetzt hinterlässt eine erledigte Aufgabe mit Kontakt-Bezug genau EINE Aktivität (idempotent
// über `Aktivitaet.aufgabeId`) — außer:
//   · „nur ich“-Aufgaben: der Verlauf am Kontakt ist geteilt, er würde eine private Aufgabe verraten
//   · die Aufgabe hing an einem Follow-up, das schon VOR diesem Schreiben erledigt war (der Follow-up-Weg hat die Aktivität geschrieben)
// Eingeschränkte Personen (Art. 18) und Werbesperre prüft der Server-Teil an der Person.

/** Eine Aktivität, die eine erledigte Aufgabe am Kontakt hinterlässt. */
export interface AufgabeAktivitaet { aufgabeId: string; kontaktId: string; titel: string }

/**
 * Welche gerade erledigten Aufgaben eine Aktivität am Kontakt hinterlassen (rein). `followupsVorher` = Follow-ups VOR diesem Schreiben,
 * `erledigtJetzt` = Kennungen der Follow-ups, die dieses Schreiben über die Aufgabe erledigt hat (`followupsErledigen`).
 */
export function aufgabenFuerAktivitaet(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>, followupsVorher: readonly FollowUp[], erledigtJetzt: readonly string[]): AufgabeAktivitaet[] {
  const fertig = new Set(neuErledigt(vorher, nachher));
  const jetzt = new Set(erledigtJetzt);
  return nachher.tasks
    .filter(t => fertig.has(t.id) && !!t.bezug?.kontaktId && t.sichtbarkeit !== 'nur-ich' && !t.geloeschtAm)
    .filter(t => !followupsVorher.some(f => f.aufgabeId === t.id && f.status !== 'offen' && !jetzt.has(f.id)))
    .map(t => ({ aufgabeId: t.id, kontaktId: t.bezug!.kontaktId!, titel: t.title }));
}

/** Offene Aufgaben mit Kontakt-Bezug, fällig bis heute — für die Power Hour (4.7). Ohne „nur ich“ anderer: die Sicht filtert vorher. */
export const aufgabenFuerPowerHour = (tasks: readonly Task[], heute: string): AufgabeFaellig[] =>
  aufgabenAlsFaellig(tasks, heute, 0).filter(a => !!a.kontaktId && a.faellig <= heute);
