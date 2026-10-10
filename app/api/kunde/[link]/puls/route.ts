// ─── Kunden-Link — Kunden-Puls (öffentlich; STUB aus C0, gehört Paket C2 — kommt AUSGESCHALTET) ──────────────────────────────────────
// FULFILLMENT_KONZEPT.md 5.5: Wert 0–10 + ein Satz mit dem Puls-Token (öffnet nur den Puls) — jede Fehlerart dieselbe 404.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, { status: 404 });
}
