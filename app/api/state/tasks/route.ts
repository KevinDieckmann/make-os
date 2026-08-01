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
import type { TasksState } from '@/types/tasks';

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
  const s = body as Partial<TasksState>;
  if (!s || !Array.isArray(s.tasks) || !Array.isArray(s.projects)) {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: tasks/projects fehlen.' }, { status: 400 });
  }

  let abgelehnt = false;
  await updateJson<TasksState>('tasks', current => {
    const alt = current?.tasks?.length ?? 0;
    // Ab 10 Aufgaben: die Hälfte auf einmal zu verlieren ist immer ein Fehler.
    if (alt >= 10 && s.tasks!.length < alt / 2) {
      abgelehnt = true;
      return current ?? { projects: s.projects!, tasks: s.tasks! };
    }
    return { projects: s.projects!, tasks: s.tasks! };
  });

  if (abgelehnt) {
    return NextResponse.json(
      { ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Aufgaben gelöscht. Seite neu laden und noch einmal versuchen.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
