// ─── Fulfillment — interne Unterlagen (STUB aus C0; gehört Paket C2) ──────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9: POST hochladen (multipart, Typ am Inhalt) · GET Download nur als Anhang · DELETE entfernen (nicht bei Beleg).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'kommt mit Paket C2' } as const;

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

export async function DELETE(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}
