// ─── MAKE OS — Prospecting-Zustand persistieren (lokal) ─────────────────────
// GET  → { state } (oder null beim Erststart)
// PUT  → speichert ICP + komplette Zielliste

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt } from '@/lib/store/local-db';
import type { ProspectsState } from '@/lib/make-one/prospecting-data';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { karteiZugang, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67).
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const state = await loadJson<ProspectsState>('prospects');
  return NextResponse.json({ state });
}

export async function PUT(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  if (zuGross(req, 2000000)) return ZU_GROSS(2000000);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = body as Partial<ProspectsState>;
  if (!s || !Array.isArray(s.prospects) || typeof s.icp !== 'string') {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: icp/prospects fehlen.' }, { status: 400 });
  }
  const vorher = await loadJson<{ icp: unknown; prospects: unknown[] }>('prospects');
  const { ok, next } = await updateGeschuetzt<{ icp: unknown; prospects: unknown[] }>('prospects', { icp: s.icp, prospects: s.prospects }, x => x.prospects?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Zielkunden geloescht.' }, { status: 409 });
  // Änderungsprotokoll (28.09., K1 #44): nur Kennungen und Feldnamen.
  await protokolliereBestand('prospects', vorher, next, werAus(req));
  return NextResponse.json({ ok: true });
}
