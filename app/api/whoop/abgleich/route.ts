// ─── WHOOP — „Jetzt abgleichen“ (08.10.2026) ─────────────────────────────────────────────────────────────────────────────
// POST → { ok, tage, trainings } bzw. { ok: false, grund } — ein Abgleich der EIGENEN Werte (wartet, bis er fertig ist). Nur die eigene
// Person (Dienstweg 403); ohne Einwilligung (a) → 403 `einwilligung: 'gesundheit'`. Eine laufende Pause nach 429 gilt auch hier.
import { NextResponse } from 'next/server';
import { whoopAbgleichen } from '@/lib/whoop/abgleich';
import { eigenePerson } from '@/lib/google/zugang';
import { NUR_SELBST_WHOOP } from '@/lib/whoop/zugang';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEXT: Record<string, string> = {
  'nicht-konfiguriert': 'WHOOP ist noch nicht eingerichtet.',
  'nicht-verbunden': 'WHOOP ist nicht verbunden.',
  getrennt: 'Die WHOOP-Verbindung ist getrennt — bitte neu verbinden.',
  pause: 'WHOOP bittet gerade um eine Pause — gleich noch einmal.',
  fehler: 'WHOOP war nicht erreichbar — der nächste Abgleich versucht es wieder.',
};

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST_WHOOP);
  if (z instanceof NextResponse) return z;
  { const sperre = await gesundheitSchreibSperre(z.person); if (sperre) return sperre; }
  const r = await whoopAbgleichen(z.person);
  if (r.ok) return NextResponse.json({ ok: true, tage: r.tage ?? 0, trainings: r.trainings ?? 0 });
  return NextResponse.json({ ok: false, grund: r.grund, fehler: TEXT[r.grund ?? 'fehler'] ?? TEXT.fehler }, { status: r.grund === 'nicht-verbunden' || r.grund === 'getrennt' || r.grund === 'nicht-konfiguriert' ? 409 : r.grund === 'pause' ? 429 : 502 });
}
