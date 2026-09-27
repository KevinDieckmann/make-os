// ─── /api/brain/konsolidierung — den Tag jetzt verdichten (27.09.) ──────────
// POST (Haushalt des Inhabers): der nächtliche Lauf auf Zuruf, übergeht den Tages-Riegel. GET: Stand des Riegels.
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { loadJson } from '@/lib/store/local-db';
import { konsolidieren, RIEGEL, type KonsolidierungStand } from '@/lib/brain/konsolidierung';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  return NextResponse.json({ ok: true, ...((await loadJson<KonsolidierungStand>(RIEGEL)) ?? {}) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  try { return NextResponse.json(await konsolidieren(new Date().toISOString(), true)); }
  catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Lauf fehlgeschlagen.' }, { status: 500 }); }
}
