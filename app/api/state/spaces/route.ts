// ─── MAKE OS — Space-Zuordnungen (Postfächer) ───────────────────────────────
// GET → { postfaecher }  ·  PUT { postfaecher } → gemerkt (Haushalt-weit, eine Wahrheit).
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { spaceEinstellungenSauber, type SpaceEinstellungen } from '@/lib/make-one/space-einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(spaceEinstellungenSauber(await loadJson<SpaceEinstellungen>('spaces')));
}

export async function PUT(req: Request) {
  let b: unknown;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<SpaceEinstellungen>('spaces', cur => {
    const alt = spaceEinstellungenSauber(cur);
    const neu = spaceEinstellungenSauber(b);
    return { postfaecher: { ...alt.postfaecher, ...neu.postfaecher } };
  });
  return NextResponse.json({ ok: true, ...next });
}
