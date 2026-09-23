// ─── MAKE OS — Aufträge einreihen und ansehen ───────────────────────────────
// GET  Stand und Liste. POST reiht ein — mehrere auf einmal, das ist der Sinn.

import { NextResponse } from 'next/server';
import { reihe, lies, stand, type NeuerAuftrag } from '@/lib/jarvis/auftraege';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [liste, s] = await Promise.all([lies(), stand()]);
  return NextResponse.json({ ok: true, stand: s, auftraege: liste.slice(0, 120) });
}

export async function POST(req: Request) {
  let body: { auftraege?: NeuerAuftrag[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const neue = (Array.isArray(body.auftraege) ? body.auftraege : [])
    .filter(a => a && (a.art === 'werkzeug' || a.art === 'agent') && typeof a.name === 'string')
    .slice(0, 40);
  if (!neue.length) return NextResponse.json({ ok: false, error: 'Keine Aufträge übergeben.' }, { status: 400 });
  const { angelegt, schonDa } = await reihe(neue);
  return NextResponse.json({ ok: true, angelegt: angelegt.length, schonDa, ids: angelegt.map(a => a.id) });
}
