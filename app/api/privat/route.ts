// ─── Privat-Index (25.09.) ──────────────────────────────────────────────────
// GET  → Index, Säulen, Kennzahlen (Wert, Ampel, Formel, Quelle oder Messlücke,
//        die Punkte dahinter mit Links), Verlauf, Trend, Ampel-Wechsel, Rücklage
//        ?kompakt=1 → nur Index und Säulen (Kopfzeile, Wachstums-Score)
// POST { ruecklage: 12000 | null }            → Rücklage in Euro (Stand = heute)
//      { schwelle: { id, gruen, rot } }       → eigene Schwelle
//      { schwelle: { id, zuruecksetzen: true } }
// Nur der eigene Haushalt (Konto mit Haushalt), streng ohne Rückfall.

import { NextResponse } from 'next/server';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { privatStand, speicherePrivat } from '@/lib/privat/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const st = await privatStand(z.haushalt);
  if (new URL(req.url).searchParams.get('kompakt') === '1') {
    return NextResponse.json({ ok: true, index: st.pi.index, label: st.pi.label, frisch: st.frisch, saeulen: st.pi.saeulen.map(s => ({ id: s.id, label: s.label, score: s.score })) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: true, ...st }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await speicherePrivat(z.haushalt, b, z.person);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
