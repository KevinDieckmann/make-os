// ─── Google — Status der eigenen Verbindung (03.10.2026) ─────────────────────
// GET → { ok, konfiguriert, verbunden, konto (maskiert), seit, funktionen, bereit, getrennt?, erlaubteDomain }
// Nur die eigene Person; nie Tokens, nie die volle Adresse.
import { NextResponse } from 'next/server';
import { googleStatus, GOOGLE_FUNKTIONEN } from '@/lib/google/verbindung';
import { eigenePerson } from '@/lib/google/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const s = await googleStatus(z.person);
  return NextResponse.json({ ok: true, ...s, erlaubteDomain: !!s.erlaubteDomain, verfuegbareFunktionen: Object.keys(GOOGLE_FUNKTIONEN) }, { headers: { 'Cache-Control': 'no-store' } });
}
