// ─── MAKE OS — Prospecting-Zustand persistieren (lokal) ─────────────────────
// GET  → { state } (oder null beim Erststart)
// PUT  → speichert ICP + komplette Zielliste

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt } from '@/lib/store/local-db';
import type { ProspectsState } from '@/lib/make-one/prospecting-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await loadJson<ProspectsState>('prospects');
  return NextResponse.json({ state });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = body as Partial<ProspectsState>;
  if (!s || !Array.isArray(s.prospects) || typeof s.icp !== 'string') {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: icp/prospects fehlen.' }, { status: 400 });
  }
  const { ok } = await updateGeschuetzt<{ icp: unknown; prospects: unknown[] }>('prospects', { icp: s.icp, prospects: s.prospects }, x => x.prospects?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Zielkunden geloescht.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
