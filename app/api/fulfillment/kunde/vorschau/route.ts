// ─── Fulfillment — „So sieht der Kunde es“ (STUB aus C0; gehört Paket C2) ─────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 6.4: genau die serverseitig gefilterte Kunden-Sicht (`kundenSicht`, Positivliste) — dieselbe Komponente wie die öffentliche Seite.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  return NextResponse.json({ ok: false, fehler: 'kommt mit Paket C2' }, { status: 501 });
}
