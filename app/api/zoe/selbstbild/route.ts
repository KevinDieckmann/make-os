// ─── MAKE OS — Das Selbstbild in den Vault schreiben ────────────────────────
// GET zeigt, was geschrieben würde, ohne es zu tun. POST schreibt.
//
// Die Blätter werden aus den echten Quellen gerechnet, nicht von Hand gepflegt:
// eine geschriebene Beschreibung wäre nach zwei Tagen falsch, und eine falsche
// Beschreibung im Gehirn ist schlimmer als keine — ZOE antwortet daraus.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt, nurInhaber, nurDerInhaber } from '@/lib/zugang/tor';
import { blaetter } from '@/lib/zoe/selbstbild';
import { schreibeEigene } from '@/lib/zoe/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const liste = await blaetter();
  return NextResponse.json({
    ok: true,
    blaetter: liste.map(b => ({ name: b.name, zeichen: b.text.length, anfang: b.text.slice(0, 220) })),
  });
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return nurDerInhaber();
  const liste = await blaetter();
  const ergebnisse = [];
  for (const b of liste) {
    const r = await schreibeEigene(b.name, b.text);
    ergebnisse.push({ name: b.name, ok: r.ok, pfad: r.pfad, fehler: r.fehler });
  }
  const geschrieben = ergebnisse.filter(e => e.ok).length;
  return NextResponse.json({ ok: geschrieben > 0, geschrieben, von: liste.length, ergebnisse });
}
