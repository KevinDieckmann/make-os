// ─── MAKE OS — Aufgaben-Zustand persistieren (lokal) ────────────────────────
// GET  → gespeicherter TasksState (oder null beim Erststart)
// PUT  → speichert den kompletten TasksState
//
// Mit Schrumpf-Wächter: Ein Client, der seinen Stand nicht laden konnte,
// darf nicht die echten Aufgaben mit einem leeren oder Beispiel-Stand
// überschreiben. Die Prüfung läuft INNERHALB von updateJson, damit sie auch
// bei zwei gleichzeitigen Schreibversuchen greift.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { brauchtBestaetigung, MASSEN_GRENZE } from '@/lib/store/massen-wache';
import type { Task, TasksState } from '@/types/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await loadJson<TasksState>('tasks');
  return NextResponse.json({ state });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 });
  }
  const s = body as Partial<TasksState> & { massenAenderung?: boolean; massenLoeschung?: boolean };
  if (!s || !Array.isArray(s.tasks) || !Array.isArray(s.projects)) {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: tasks/projects fehlen.' }, { status: 400 });
  }

  let abgelehnt = false;
  // Zweiter Weg, auf dem Arbeit verschwindet: nicht löschen, sondern zuklappen.
  // Der Schrumpf-Schutz sieht das nicht — die Liste bleibt ja gleich lang.
  let massen = 0;
  await updateJson<TasksState>('tasks', current => {
    const alt = current?.tasks?.length ?? 0;
    // Ab 10 Aufgaben: die Hälfte auf einmal zu verlieren ist fast immer ein
    // Fehler — aber eben nur fast. Bis zum 07.09. gab es GAR KEINEN Weg, das
    // Board absichtlich zu leeren; wer es wollte, musste am Wächter vorbei in
    // die Datei schreiben. Ein Schutz, den man nur umgehen kann, wird umgangen.
    // Deshalb jetzt derselbe Weg wie bei der Massen-Erledigung: ablehnen, bis
    // der Aufrufer ausdrücklich bestätigt.
    if (alt >= 10 && s.tasks!.length < alt / 2 && s.massenLoeschung !== true) {
      abgelehnt = true;
      return current ?? { projects: s.projects!, tasks: s.tasks! };
    }
    const pruef = brauchtBestaetigung(current?.tasks ?? [], s.tasks!, s.massenAenderung === true);
    if (pruef.noetig) {
      massen = pruef.anzahl;
      return current ?? { projects: s.projects!, tasks: s.tasks! };
    }
    return { projects: s.projects!, tasks: s.tasks! };
  });

  if (abgelehnt) {
    return NextResponse.json(
      {
        ok: false, massenLoeschung: true,
        error: 'Abgelehnt: das hätte über die Hälfte der Aufgaben gelöscht. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.',
      },
      { status: 409 },
    );
  }
  if (massen) {
    return NextResponse.json(
      {
        ok: false, massenAenderung: true, anzahl: massen, grenze: MASSEN_GRENZE,
        error: `Abgelehnt: das hätte ${massen} Aufgaben auf einmal erledigt. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.`,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * Einzelne Änderungen einspielen statt der ganzen Liste.
 *
 * Das Fundament für zwei Leute in zwei Fenstern: Vorher schrieb jedes Fenster
 * bei jeder Änderung ALLE Aufgaben — wer zuletzt klickte, überschrieb still
 * die Änderung des anderen. Jetzt schickt ein Fenster nur noch die Aufgaben,
 * die ES geändert hat; alles andere bleibt unberührt. updateJson führt die
 * Schreibvorgänge serialisiert aus, zwei gleichzeitige Klicks gehen also
 * beide durch.
 */
const STATUS = ['backlog', 'todo', 'in-progress', 'blocked', 'done'];
const PRIO = ['low', 'medium', 'high', 'critical'];
const S = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);
/** Eine Aufgabe von außen: nur bekannte Felder, begrenzt — die Liste lesen viele Seiten und Prompts (26.09.). */
function taskSauber(o: unknown): Task | null {
  if (!o || typeof o !== 'object') return null;
  const t = o as Record<string, unknown>;
  const id = S(t.id, 80), title = S(t.title, 300);
  if (!id || !title) return null;
  const jetzt = new Date().toISOString();
  const raus = {
    id, title, projectId: S(t.projectId, 80) ?? '', description: S(t.description, 4000),
    status: STATUS.includes(String(t.status)) ? t.status : 'todo',
    priority: PRIO.includes(String(t.priority)) ? t.priority : 'medium',
    assignee: S(t.assignee, 40) ?? 'kevin',
    tags: Array.isArray(t.tags) ? t.tags.slice(0, 20).map(x => String(x).slice(0, 40)) : [],
    dueDate: S(t.dueDate, 40), completedAt: S(t.completedAt, 40),
    subTasks: Array.isArray(t.subTasks) ? (t.subTasks as Record<string, unknown>[]).slice(0, 50).filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id ?? '').slice(0, 80), taskId: id, title: String(x.title ?? '').slice(0, 300), completed: x.completed === true, sortOrder: Number(x.sortOrder) || 0, createdAt: S(x.createdAt, 40) ?? jetzt, updatedAt: S(x.updatedAt, 40) ?? jetzt })) : [],
    dependencies: Array.isArray(t.dependencies) ? (t.dependencies as Record<string, unknown>[]).slice(0, 50).filter(x => x && typeof x === 'object' && typeof x.blockedByTaskId === 'string').map(x => ({ blockedByTaskId: String(x.blockedByTaskId).slice(0, 80), ...(typeof x.resolvedAt === 'string' ? { resolvedAt: x.resolvedAt.slice(0, 40) } : {}) })) : [],
    sortOrder: Number(t.sortOrder) || 0,
    createdAt: S(t.createdAt, 40) ?? jetzt, updatedAt: S(t.updatedAt, 40) ?? jetzt,
  };
  for (const k of ['description', 'dueDate', 'completedAt'] as const) if (raus[k] === undefined) delete raus[k];
  return raus as unknown as Task;
}

export async function PATCH(req: Request) {
  let body: { ops?: unknown; massenAenderung?: boolean; projekte?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Zu zweit (24.09.): Projekte reisen mit, statt die ganze Aufgabenliste per PUT
  // zu schreiben — so bleibt, was der andere an Aufgaben geändert hat.
  const projekte = Array.isArray(body.projekte) ? (body.projekte as TasksState['projects']).slice(0, 200) : null;
  const roh = Array.isArray(body.ops) ? body.ops.slice(0, 100) : (projekte ? [] : null);
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });

  interface Op { op: 'upsert' | 'delete'; task?: Task; id?: string }
  const ops: Op[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id.slice(0, 80) });
    else if (o?.op === 'upsert') { const t = taskSauber(o.task); if (t) ops.push({ op: 'upsert', task: t }); }
  }
  if (!ops.length && !projekte) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  let massen = 0;
  await updateJson<TasksState>('tasks', current => {
    const f: TasksState = current && Array.isArray(current.tasks)
      ? current
      : { projects: [], tasks: [] };
    const nachId = new Map(f.tasks.map(t => [t.id, t]));
    for (const o of ops) {
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else { nachId.set(o.task!.id, o.task!); angewandt++; }
    }
    const naechste = Array.from(nachId.values());
    // Auch der Einzeländerungs-Weg braucht den Schutz: 57 Aufgaben kann man
    // genauso gut in 57 kleinen Schritten in EINEM Aufruf erledigen.
    const pruef = brauchtBestaetigung(f.tasks, naechste, body.massenAenderung === true);
    if (pruef.noetig) { massen = pruef.anzahl; angewandt = 0; return f; }
    return { ...f, tasks: naechste, ...(projekte ? { projects: projekte } : {}) };
  });

  if (massen) {
    return NextResponse.json(
      {
        ok: false, massenAenderung: true, anzahl: massen, grenze: MASSEN_GRENZE,
        error: `Abgelehnt: das hätte ${massen} Aufgaben auf einmal erledigt. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.`,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, angewandt });
}
