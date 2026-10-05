// ─── Schreibpause für die nächtliche Sicherung (29.09., Paket D-A #61) ─────────
// deploy/sicherung.sh ruft das im App-Container über den Dienstweg: `{ an: true, sekunden ≤ 30 }` hält neue
// Schreibungen an (sie warten, statt zu scheitern) und antwortet, sobald keine Sperre mehr gehalten wird —
// dann ist der Datenordner für den Schnappschuss in sich stimmig. `{ aus: true }` hebt sofort auf; spätestens
// nach 30 s läuft es von selbst weiter (die App bleibt nie hängen, auch wenn das Skript abbricht).
// Nur Dienstweg (x-make-key) — keine Sitzung, keine Person.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { schreibpauseSetzen, schreibpauseAufheben } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Nur Dienstweg.' }, { status: 403 });
  let b: { an?: unknown; aus?: unknown; sekunden?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aus === true) { schreibpauseAufheben(); return NextResponse.json({ ok: true, pause: false }); }
  if (b.an !== true) return NextResponse.json({ ok: false, fehler: '{ an: true, sekunden } oder { aus: true }' }, { status: 400 });
  const sekunden = Math.max(1, Math.min(30, Number(b.sekunden) || 30));
  const r = await schreibpauseSetzen(sekunden * 1000);
  // still = keine Schreibung mehr in Arbeit; sonst hebt das Skript auf und sichert ohne Pause (Status „ohne-pause“).
  return NextResponse.json({ ok: true, pause: true, still: r.still, bis: r.bis });
}
