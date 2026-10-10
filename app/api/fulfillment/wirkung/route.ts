// ─── Fulfillment — Wirkungsbericht (STUB aus C0; gehört Paket C1) ─────────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 5.3: POST erzeugt das PDF (Ablage `fulfillment-unterlagen`, verschlüsselt) · GET `?m=` liefert es als Anhang. Versand nur per Klick.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'kommt mit Paket C1' } as const;

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
