// ─── Gesundheits-Index (25.09.) ─────────────────────────────────────────────
// GET  ?fuer=<person> → Index, Säulen, Kennzahlen (Wert, Ampel, Formel, Quelle
//        oder Messlücke, die Punkte dahinter mit Links), Verlauf, Trend, Wechsel.
//        ?kompakt=1 → nur Index und Säulen.
// POST { schwelle: { id, gruen, rot } | { id, zuruecksetzen: true } } — nur die eigenen.
// Sehen: die eigenen immer, fremde nur, wenn die Person teilt (Konto → teilt.gesundheit).

import { NextResponse } from 'next/server';
import { ansichtPerson, personAus, darfGesundheitSehen } from '@/lib/jarvis/raum';
import { gesundheitStand, speichereGesundheitSchwelle } from '@/lib/gesundheit/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ ok: false, fehler: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const st = await gesundheitStand(person);
  if (new URL(req.url).searchParams.get('kompakt') === '1') {
    return NextResponse.json({ ok: true, person, index: st.pi.index, label: st.pi.label, saeulen: st.pi.saeulen.map(s => ({ id: s.id, label: s.label, score: s.score })) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: true, ...st }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const person = personAus(req);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b.schwelle || typeof b.schwelle !== 'object') return NextResponse.json({ ok: false, fehler: 'Schwelle fehlt.' }, { status: 400 });
  const r = await speichereGesundheitSchwelle(person, b.schwelle as Record<string, unknown>);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
