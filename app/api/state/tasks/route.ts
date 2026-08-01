// ─── MAKE OS — Aufgaben-Zustand persistieren (lokal) ────────────────────────
// GET  → gespeicherter TasksState (oder null beim Erststart)
// PUT  → speichert den kompletten TasksState (single-user, lokal)

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
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
  await saveJson('tasks', { projects: s.projects, tasks: s.tasks });
  return NextResponse.json({ ok: true });
}
