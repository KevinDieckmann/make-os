// ─── Google — Trennen (03.10.2026) ───────────────────────────────────────────
// POST → { ok, widerrufen } — widerruft das Token bei Google, stoppt den Push-Kanal, verwirft den Spiegel der Google-
// Termine (Wahrheit bleibt Google) und löscht den Token-Bestand. Nur die eigene Person.
import { NextResponse } from 'next/server';
import { googleTrennenAlles } from '@/lib/google/trennen';
import { eigenePerson } from '@/lib/google/zugang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  const r = await googleTrennenAlles(z.person);
  if (r.war) await protokolliere('kalender', [{ liste: 'google', op: 'geloescht', id: 'verbindung', felder: [r.widerrufen ? 'widerrufen' : 'nicht-widerrufen'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
  return NextResponse.json({ ok: true, war: r.war, widerrufen: r.widerrufen });
}
