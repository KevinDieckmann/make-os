// ─── WHOOP — Trennen (08.10.2026) ────────────────────────────────────────────────────────────────────────────────────────
// POST → { ok, war, widerrufen } — widerruft den Zugang bei WHOOP (`DELETE /v2/user/access`), löscht Verbindung und Spiegel samt
// Tageskopien und legt einen Grabstein ab. Übernommene Werte (Vitalwerte, Trainings) bleiben bei der Person. Nur die eigene Person.
import { NextResponse } from 'next/server';
import { whoopTrennen } from '@/lib/whoop/verbindung';
import { eigenePerson } from '@/lib/google/zugang';
import { NUR_SELBST_WHOOP } from '@/lib/whoop/zugang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST_WHOOP);
  if (z instanceof NextResponse) return z;
  const r = await whoopTrennen(z.person);
  if (r.war) await protokolliere('whoop', [{ liste: 'verbindung', op: 'geloescht', id: 'whoop', felder: [r.widerrufen ? 'widerrufen' : 'nicht-widerrufen'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
  return NextResponse.json({ ok: true, war: r.war, widerrufen: r.widerrufen });
}
