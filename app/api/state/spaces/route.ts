// ─── MAKE OS — Space-Zuordnungen (Postfächer) ───────────────────────────────
// GET → { postfaecher }  ·  PUT { postfaecher } → gemerkt (Haushalt-weit, eine Wahrheit).
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { spaceEinstellungenSauber, type SpaceEinstellungen } from '@/lib/make-one/space-einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  return NextResponse.json(spaceEinstellungenSauber(await loadJson<SpaceEinstellungen>('spaces')));
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let b: unknown;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<SpaceEinstellungen>('spaces', cur => {
    const alt = spaceEinstellungenSauber(cur);
    const neu = spaceEinstellungenSauber(b);
    return { postfaecher: { ...alt.postfaecher, ...neu.postfaecher } };
  });
  return NextResponse.json({ ok: true, ...next });
}
