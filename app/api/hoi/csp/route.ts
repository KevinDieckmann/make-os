// ─── /api/hoi/csp — CSP-Verstöße vom Browser (Head of IT, 27.09.) ───────────
// Offen (kein Cookie, kein Origin-Kopf — der Browser schickt Berichte so), darum:
// nur Zähler (Richtlinie, blockierte Quelle ohne Pfad/Parameter, Seite ohne
// Parameter), höchstens 200 Einträge, nichts älter als 30 Tage, und eine
// Ratengrenze im Prozess (60 Berichte pro Minute, sonst 429). Antwort immer 204.
// GET: die Liste für die Seite (Haushalt des Inhabers).

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { cspMeldungenAus, cspZusammenfuehren } from '@/lib/hoi/rechnen';
import { HOI_CSP, type CspSpeicher } from '@/lib/hoi/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let fenster = 0; let zaehler = 0;
function ratenGrenze(): boolean {
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== fenster) { fenster = minute; zaehler = 0; }
  return ++zaehler > 60;
}

export async function POST(req: Request) {
  if (ratenGrenze()) return new NextResponse(null, { status: 429 });
  const laenge = Number(req.headers.get('content-length') ?? 0);
  if (laenge > 20_000) return new NextResponse(null, { status: 413 });
  let roh: unknown = null;
  try { const text = (await req.text()).slice(0, 20_000); roh = text ? JSON.parse(text) : null; } catch { roh = null; }
  const neu = cspMeldungenAus(roh, new Date().toISOString());
  if (neu.length) await updateJson<CspSpeicher>(HOI_CSP, cur => ({ meldungen: cspZusammenfuehren(cur?.meldungen ?? [], neu, new Date().toISOString()) })).catch(() => { /* Meldung verloren — nichts, was den Browser interessiert */ });
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: Request) {
  if (req.headers.get('x-make-hoi') !== '1' && !(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const s = await loadJson<CspSpeicher>(HOI_CSP);
  return NextResponse.json({ ok: true, meldungen: s?.meldungen ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
