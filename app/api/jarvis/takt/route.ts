// ─── MAKE OS — Der Takt (Route) ─────────────────────────────────────────────
// GET  zeigt, was gerade fällig wäre — ohne etwas zu tun.
// POST reiht das Fällige in die Warteschlange ein.
//
// Der Arbeiter fragt jede Minute, der Browser alle paar Minuten als Rückfall.
// Beides zusammen erzeugt nichts doppelt: die Fälligkeit kommt aus dem echten
// Zustand, und die Warteschlange lässt denselben Auftrag nur einmal offen.

import { NextResponse } from 'next/server';
import { faellig } from '@/lib/jarvis/takt';
import { reihe } from '@/lib/jarvis/auftraege';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // ?in=<Minuten> schaut voraus, ohne etwas zu tun — so lässt sich prüfen, ob
  // der Takt später wirklich anspringt, statt darauf zu warten.
  const vor = Number(new URL(req.url).searchParams.get('in')) || 0;
  const jetzt = new Date(Date.now() + Math.max(0, Math.min(24 * 60, vor)) * 60_000);
  const dran = await faellig(jetzt);
  return NextResponse.json({
    ok: true,
    zeitpunkt: jetzt.toISOString(),
    faellig: dran.map(f => ({ id: f.id, grund: f.grund, name: f.auftrag.name, auftrag: f.auftrag.auftrag })),
  });
}

export async function POST() {
  const dran = await faellig();
  if (!dran.length) return NextResponse.json({ ok: true, eingereiht: 0 });
  const { angelegt, schonDa } = await reihe(dran.map(f => f.auftrag));
  return NextResponse.json({
    ok: true,
    eingereiht: angelegt.length,
    schonDa,
    was: dran.map(f => `${f.id} (${f.grund})`),
  });
}
