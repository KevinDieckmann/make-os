// ─── Fulfillment — Analyse-Läufe (STUB aus C0; gehört Paket C3) ───────────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 4.3: GET `?m=` Läufe, Zustände, Schätzung je Lauf · POST `starten` (agent, bestaetigtCent, anfrageId — NUR per Klick auf genau
// diesen Lauf, kein Autostart) · `abbrechen` · `tiefenbericht` (frage, bestaetigtCent).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'kommt mit Paket C3' } as const;

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}
