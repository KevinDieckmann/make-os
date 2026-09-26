// ─── MAKE OS — Aufgabe anlegen (aus Agenten, z. B. Meeting-Agent) ───────────
// Hängt eine valide Task an den echten Aufgaben-Store an. Nur auf Klick des
// Nutzers (Human-in-the-Loop).

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { TasksState, Task, TaskStatus } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NewTask { title?: string; description?: string; projectId?: string; owner?: Owner; priority?: Priority; dueDate?: string; }

export async function POST(req: Request) {
  let body: NewTask;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const title = (body.title ?? '').trim().slice(0, 300);
  if (!title) return NextResponse.json({ ok: false, error: 'Kein Titel.' }, { status: 400 });
  // Fristen-Plausibilität: kein Datum aus der Vergangenheit vor 2020 o. ä. Unsinn.
  if (body.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) || body.dueDate < '2020-01-01')) {
    body.dueDate = undefined;
  }

  const state = (await loadJson<TasksState>('tasks')) ?? { projects: [], tasks: [] };

  // Duplikat-Schutz: gleiche (normalisierte) Überschrift + noch offen → nicht
  // doppelt anlegen. Sonst erzeugt jeder Lauf/Doppelklick dieselbe Aufgabe neu.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const vorhanden = state.tasks.find(t => t.status !== 'done' && norm(t.title) === norm(title));
  if (vorhanden) {
    return NextResponse.json({ ok: true, id: vorhanden.id, duplikat: true, hinweis: 'Gibt es schon als offene Aufgabe — nicht doppelt angelegt.' });
  }
  const projectId = state.projects.some(p => p.id === body.projectId) ? body.projectId! : (state.projects[0]?.id ?? 'proj-kdm');
  const now = new Date().toISOString();
  const priority: Priority = (['low', 'medium', 'high', 'critical'] as Priority[]).includes(body.priority as Priority) ? body.priority as Priority : 'medium';
  const assignee: Owner = (['kevin', 'malin', 'both'] as Owner[]).includes(body.owner as Owner) ? body.owner as Owner : 'kevin';

  const task: Task = {
    // Kollisionsfrei: nicht an array.length koppeln (bricht nach Löschungen).
    id: `mtg-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
    projectId,
    title,
    description: body.description?.trim() || 'Aus Meeting übernommen.',
    status: 'todo' as TaskStatus,
    priority,
    assignee,
    tags: [],
    dueDate: body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : undefined,
    subTasks: [],
    dependencies: [],
    // max+1 statt length: nach Loeschungen sonst doppelte Sortierwerte.
    sortOrder: state.tasks.reduce((mx, t) => Math.max(mx, t.sortOrder ?? 0), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };

  await updateJson<TasksState>('tasks', cur => ({ projects: cur?.projects ?? state.projects, tasks: [...(cur?.tasks ?? []).filter(t => t.id !== task.id), task] }));
  return NextResponse.json({ ok: true, id: task.id });
}
