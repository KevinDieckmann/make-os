// ─── MAKE OS — Controlling-Zustand persistieren (lokal) ─────────────────────
import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import type { FinanceState } from '@/lib/make-one/finance-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await loadJson<FinanceState>('finance');
  return NextResponse.json({ state });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = body as Partial<FinanceState>;
  if (!s || !Array.isArray(s.months) || typeof s.zielUmsatz !== 'number') {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand.' }, { status: 400 });
  }
  await saveJson('finance', { jahr: s.jahr ?? 2026, zielUmsatz: s.zielUmsatz, zielGewinn: s.zielGewinn ?? 0, cash: s.cash ?? 0, months: s.months });
  return NextResponse.json({ ok: true });
}
