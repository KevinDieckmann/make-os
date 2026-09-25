// ─── Bauplan — Bildschirmfotos ──────────────────────────────────────────────
// POST { daten: data-URL } → { name }  (JPEG/PNG/WebP, höchstens 3 MB, echte Bilddatei)
// GET  ?name=…             → das Bild (nur angemeldet — die Middleware schützt alles)
import { NextResponse } from 'next/server';
import { bildSpeichern, bildLesen } from '@/lib/bauplan/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { daten?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await bildSpeichern(String(b.daten ?? ''));
  return 'fehler' in r ? NextResponse.json({ ok: false, fehler: r.fehler }, { status: 400 }) : NextResponse.json({ ok: true, name: r.name });
}

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const b = await bildLesen(name);
  if (!b) return new NextResponse('Nicht gefunden.', { status: 404 });
  return new NextResponse(new Uint8Array(b.daten), { headers: { 'Content-Type': b.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}
