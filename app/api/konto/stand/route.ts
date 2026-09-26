// ─── Konto: der Passwort-Stand (26.09.) — nur für den Dienstweg ───────────────
// Die Middleware fragt hier nach, ob eine Sitzung noch zum aktuellen Passwort
// gehört (lib/zugang/stand-pruefung.ts). Der Stand ist ein Fingerabdruck des
// Salzes, kein Geheimnis — aber die Route bleibt hinter dem Dienstschlüssel,
// damit niemand Kontonamen durchprobieren kann.

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { ladeKonten } from '@/lib/zugang/konten';
import { kontoStand } from '@/lib/zugang/sitzung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ error: 'Nur für den Dienstweg.' }, { status: 403 });
  const speicher = new URL(req.url).searchParams.get('speicher') ?? '';
  const k = (await ladeKonten()).konten.find(x => x.speicher === speicher);
  if (!k) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ ok: true, stand: await kontoStand(k.salz) }, { headers: { 'Cache-Control': 'no-store' } });
}
