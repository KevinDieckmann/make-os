// ─── MAKE OS — Flächen-Layout je Person ─────────────────────────────────────
// GET  ?seite=heute        → gespeichertes Layout dieser Seite für die angemeldete Person (oder null)
// PUT  { seite, layout }   → Layout speichern (leer/Standard = Eintrag löschen)
// Jede Person hat ihr eigenes (speicherFuer): Kevin und Malin gestalten unabhängig.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, speicherFuer } from '@/lib/jarvis/raum';
import { sauberDatei, sauberLayout, seiteOk, type FlaecheDatei } from '@/lib/flaeche/modell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const seite = new URL(req.url).searchParams.get('seite') ?? '';
  if (!seiteOk(seite)) return NextResponse.json({ ok: false, error: 'Seite fehlt.' }, { status: 400 });
  const d = sauberDatei(await loadJson<FlaecheDatei>(speicherFuer('flaeche', personAus(req))));
  return NextResponse.json({ ok: true, seite, layout: d.seiten[seite] ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  let b: { seite?: string; layout?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const seite = String(b.seite ?? '');
  if (!seiteOk(seite)) return NextResponse.json({ ok: false, error: 'Seite fehlt.' }, { status: 400 });
  const layout = b.layout ? sauberLayout(b.layout) : null;
  const next = await updateJson<FlaecheDatei>(speicherFuer('flaeche', personAus(req)), cur => {
    const d = sauberDatei(cur);
    if (!layout || (!layout.plaetze.length && !layout.versteckt.length)) delete d.seiten[seite]; else d.seiten[seite] = layout;
    return d;
  });
  return NextResponse.json({ ok: true, seite, layout: next.seiten[seite] ?? null });
}
