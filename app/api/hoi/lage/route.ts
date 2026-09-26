// ─── /api/hoi/lage — die Lage des Systems (Head of IT, 27.09.) ──────────────
// GET: alle Befunde mit Ampel, Gesamtampel und Kurztext. Sehen darf der Haushalt
// des Inhabers (Seite /os/hoi) und der eingeschränkte HOI-Schlüssel (Middleware
// setzt x-make-hoi) — keine Personen, keine Inhalte, nur Zähler und Zustände.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { lage } from '@/lib/hoi/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (req.headers.get('x-make-hoi') !== '1' && !(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  try {
    const l = await lage();
    return NextResponse.json({ ok: true, ...l }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Lage nicht lesbar.' }, { status: 500 });
  }
}
