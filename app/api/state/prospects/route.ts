// ─── MAKE OS — Prospecting-Zustand persistieren (lokal) ─────────────────────
// GET  → { state } (oder null beim Erststart)
// PUT  → speichert ICP + komplette Zielliste

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
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
  await saveJson('prospects', { icp: s.icp, prospects: s.prospects });
  return NextResponse.json({ ok: true });
}
