// ─── Privat-Score · Planung — die eigene Aufgabenlage im Privat-Bereich (21.10.) — rein ──────────────────────────────────────────────
// Wie die Planungs-Säule des früheren Wachstums-Scores, aber nur Privat und nur die eigene Person: Aufgaben, für die sie verantwortlich oder an
// denen sie beteiligt ist, im Privat-Bereich (lib/aufgaben/bereich-sicht.ts — die Selbstständigkeit als Privat-Einheit zählt mit), ohne Abgebrochene.
// Die Liste kommt schon aus der Sicht der Person (`ladeAufgabenSicht` — „nur ich“ der anderen nie).

import type { Task } from '@/types/tasks';
import { aufgabenNurBereich } from '@/lib/aufgaben/bereich-sicht';
import { istOffen } from '@/lib/aufgaben/struktur';
import { localDay } from '@/lib/zeit';
import type { PlanungsLage } from './privat-score';

const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Die eigene Aufgabenlage im Privat-Bereich (rein): verantwortlich oder beteiligt, ohne Abgebrochene. null = keine eigenen privaten Aufgaben. */
export function planungsLage(tasks: readonly Task[], person: string, heute: string): PlanungsLage | null {
  const eigene = aufgabenNurBereich(tasks, 'privat').filter(t => t.status !== 'cancelled' && (t.assignee === person || (t.beteiligte ?? []).includes(person)));
  if (!eigene.length) return null;
  const offen = eigene.filter(t => istOffen(t));
  const ueber = offen.filter(t => t.dueDate && t.dueDate.slice(0, 10) < heute);
  const krit = offen.filter(t => t.priority === 'critical');
  const ab = tagPlus(heute, -6);
  const erledigt7 = eigene.filter(t => t.status === 'done' && t.completedAt && localDay(new Date(t.completedAt)) >= ab && localDay(new Date(t.completedAt)) <= heute).length;
  return {
    offen: offen.length, ueberfaellig: ueber.length, kritisch: krit.length, erledigt7,
    beispiele: {
      ueberfaellig: [...ueber].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 3).map(t => ({ id: t.id, titel: t.title, ...(t.dueDate ? { faellig: t.dueDate.slice(0, 10) } : {}) })),
      kritisch: krit.slice(0, 3).map(t => ({ id: t.id, titel: t.title })),
    },
  };
}

