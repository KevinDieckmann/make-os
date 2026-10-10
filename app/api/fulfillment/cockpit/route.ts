// ─── Fulfillment — Mandats-Cockpit (STUB aus C0; gehört Paket C1) ─────────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 6.3: je aktivem Fall Phase, Fortschritt, wartet auf euch, Health, Puls (C2), Analyse (C3) — „was hängt“ zuerst. Nur lesen.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  return NextResponse.json({ ok: false, fehler: 'kommt mit Paket C1' }, { status: 501 });
}
