// ─── Gesundheits-Index (25.09.) ─────────────────────────────────────────────
// GET  ?fuer=<person> → Index, Säulen, Kennzahlen (Wert, Ampel, Formel, Quelle
//        oder Messlücke, die Punkte dahinter mit Links), Verlauf, Trend, Wechsel.
//        ?kompakt=1 → nur Index, Status (Abdeckung, Lücken, Teilwert — indexStatus, 14.10.) und Säulen.
// POST { schwelle: { id, gruen, rot } | { id, zuruecksetzen: true } } — nur die eigenen.
// Sehen: die eigenen immer, fremde nur, wenn die Person teilt (Konto → teilt.gesundheit).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ansichtPerson, personAus, darfGesundheitSehen } from '@/lib/zoe/raum';
import { gesundheitStand, gesundheitOhneEinwilligung, speichereGesundheitSchwelle } from '@/lib/gesundheit/speicher';
import { gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ ok: false, fehler: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  // Ohne Einwilligung (a) der Person keine Werte (16.10., C12) — dieselbe Form, jede Kennzahl „ohne Einwilligung“, nichts gerechnet oder gespeichert.
  const erlaubt = await gesundheitVerarbeitungErlaubt(person);
  const st = erlaubt ? await gesundheitStand(person) : gesundheitOhneEinwilligung(person);
  if (new URL(req.url).searchParams.get('kompakt') === '1') {
    return NextResponse.json({ ok: true, person, ...(erlaubt ? {} : { ohneEinwilligung: true }), index: st.pi.index, label: st.pi.label, abdeckung: st.pi.abdeckung, luecken: st.pi.luecken, ...(st.pi.teil ? { teil: st.pi.teil } : {}), ...(st.pi.vorlaeufig ? { vorlaeufig: st.pi.vorlaeufig } : {}), saeulen: st.pi.saeulen.map(s => ({ id: s.id, label: s.label, score: s.score })) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: true, ...st, ...(erlaubt ? {} : { ohneEinwilligung: true }) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const person = personAus(req);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b.schwelle || typeof b.schwelle !== 'object') return NextResponse.json({ ok: false, fehler: 'Schwelle fehlt.' }, { status: 400 });
  const r = await speichereGesundheitSchwelle(person, b.schwelle as Record<string, unknown>);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
