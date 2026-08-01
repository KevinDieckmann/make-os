// ─── MAKE OS — Verbindungs-Status ───────────────────────────────────────────
// GET → je Anbieter: konfiguriert? verbunden? (nur Metadaten, NIE Tokens).
// POST { provider, aktion: 'trennen' } → Tokens lokal löschen.

import { NextResponse } from 'next/server';
import { PROVIDER, konfiguriert, tokenStatus, trennen } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const liste = await Promise.all(Object.values(PROVIDER).map(async p => {
    const s = await tokenStatus(p.id);
    return {
      id: p.id,
      name: p.name,
      konfiguriert: konfiguriert(p),
      verbunden: s.verbunden,
      seit: s.seit ?? null,
      laeuftAb: s.laeuftAb ?? null,
      scope: s.scope ?? null,
      anleitung: p.anleitung,
      envId: p.envId,
      envSecret: p.envSecret,
    };
  }));
  return NextResponse.json({ verbindungen: liste });
}

export async function POST(req: Request) {
  let body: { provider?: string; aktion?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.aktion !== 'trennen' || !PROVIDER[body.provider ?? '']) {
    return NextResponse.json({ ok: false, error: 'provider + aktion=trennen nötig.' }, { status: 400 });
  }
  await trennen(body.provider!);
  return NextResponse.json({ ok: true });
}
