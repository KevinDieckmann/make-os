// ─── MAKE OS — Agenten-Gedächtnis (HTTP-Sicht) ──────────────────────────────
// Dünne Hülle um lib/agent-log — die Anhänge-Logik lebt NUR dort, damit es
// keine zweite Kopie mit eigenem Limit/Format gibt.
//
// GET  ?agent=board&limit=5   → exakter Agent
// GET  ?prefix=loop-&limit=20 → alle Loops (Filter VOR dem Kürzen)
// POST { agent, title, payload }

import { NextResponse } from 'next/server';
import { logRun, recentRuns } from '@/lib/agent-log';
import { istDienst } from '@/lib/zugang/dienst';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agent = url.searchParams.get('agent') ?? undefined;
  const prefix = url.searchParams.get('prefix') ?? undefined;
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 10));
  const entries = await recentRuns(agent, limit, prefix);
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  // Agentenläufe steuern den Wochen-Loop — nur Dienstweg oder Inhaber tragen ein (26.09.).
  if (!istDienst(req) && !(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
  let body: { agent?: string; title?: string; payload?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const agent = (body.agent ?? '').trim();
  if (!agent) return NextResponse.json({ ok: false, error: 'agent fehlt.' }, { status: 400 });
  await logRun(agent, body.title ?? agent, body.payload ?? null);
  return NextResponse.json({ ok: true });
}
