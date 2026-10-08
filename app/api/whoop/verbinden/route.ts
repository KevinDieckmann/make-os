// ─── WHOOP — Verbinden starten (08.10.2026) ──────────────────────────────────────────────────────────────────────────────
// POST → { ok, url } — die Adresse der WHOOP-Anmeldeseite (Authorization-Code + state). Der Browser leitet dorthin; WHOOP kommt über
// /api/whoop/rueckruf zurück. Nur die eigene Person; ohne Einwilligung (a) in Gesundheitsdaten → 403 `einwilligung: 'gesundheit'`.
import { NextResponse } from 'next/server';
import { verbindungStarten, WhoopVerbindungsFehler } from '@/lib/whoop/verbindung';
import { eigenePerson } from '@/lib/google/zugang';
import { NUR_SELBST_WHOOP } from '@/lib/whoop/zugang';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST_WHOOP);
  if (z instanceof NextResponse) return z;
  { const sperre = await gesundheitSchreibSperre(z.person); if (sperre) return sperre; }
  try {
    const { url } = await verbindungStarten(z.person);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof WhoopVerbindungsFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'WHOOP ließ sich nicht starten.' }, { status: 502 });
  }
}
