// ─── Fulfillment — Kunden-Link intern (STUB aus C0; gehört Paket C2) ──────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9 / 5.4: GET `?m=` Link-Stand (nie Token), Formulare, Puls, Unterlagen-Metadaten (Lese-Protokoll) · POST link-anlegen
// (Token genau einmal) · widerrufen · verlaengern · rechte · puls-anfrage · puls-hand · puls-uebernehmen · unterlage-status · formular-intern · export.

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
