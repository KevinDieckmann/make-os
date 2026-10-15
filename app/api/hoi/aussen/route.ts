// ─── /api/hoi/aussen — der Blick von außen (Head of IT, 27.09.) ─────────────
// POST: die GitHub-Aktion (.github/workflows/hoi-aussenblick.yml) meldet Status,
// Antwortzeit, Kopfzeilen und TLS-Rest — mit dem eingeschränkten Schlüssel
// MAKE_OS_KEY_HOI (Middleware: x-make-hoi) oder dem Dienstweg. Es bleiben die
// letzten 60 Meldungen. GET: die Reihe für die Seite (Haushalt des Inhabers).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { aussenSaeubern } from '@/lib/hoi/rechnen';
import { HOI_AUSSEN, type AussenSpeicher } from '@/lib/hoi/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX = 60;

export async function GET(req: Request) {
  // Sicherheitslage nur für Inhaber (15.10., Abnahme 2 B8) — vorher jedes Konto im Haushalt, auch „nur Business“. Der HOI-Schlüssel bleibt.
  if (req.headers.get('x-make-hoi') !== '1' && !(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  const s = await loadJson<AussenSpeicher>(HOI_AUSSEN);
  return NextResponse.json({ ok: true, meldungen: s?.meldungen ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (req.headers.get('x-make-hoi') !== '1' && !istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Nur mit dem HOI-Schlüssel.' }, { status: 403 });
  let roh: unknown;
  try { roh = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const m = aussenSaeubern(roh, new Date().toISOString());
  if (!m) return NextResponse.json({ ok: false, fehler: 'Meldung unlesbar.' }, { status: 400 });
  const s = await updateJson<AussenSpeicher>(HOI_AUSSEN, cur => ({ meldungen: [...(cur?.meldungen ?? []), m].slice(-MAX) }));
  return NextResponse.json({ ok: true, anzahl: s.meldungen.length });
}
