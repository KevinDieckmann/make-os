// ─── MAKE OS — Dashboard-Board (lokal) ──────────────────────────────────────
// Das Dashboard ist ein Widget-Board: Kevin bestimmt Reihenfolge und
// Sichtbarkeit selbst. Hier liegt nur die geordnete Liste der aktiven
// Widget-IDs — die Widgets selbst wohnen im Dashboard-Code.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BoardFile { widgets: string[] }

export async function GET() {
  const f = await loadJson<BoardFile>('dashboard');
  return NextResponse.json({ widgets: Array.isArray(f?.widgets) ? f.widgets : [] });
}

export async function PUT(req: Request) {
  let body: { widgets?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const widgets = (Array.isArray(body.widgets) ? body.widgets : [])
    .map(w => String(w).slice(0, 40)).filter(Boolean).slice(0, 30);
  if (!widgets.length) return NextResponse.json({ ok: false, error: 'widgets darf nicht leer sein.' }, { status: 400 });
  const next = await updateJson<BoardFile>('dashboard', () => ({ widgets }));
  return NextResponse.json({ ok: true, widgets: next.widgets });
}
