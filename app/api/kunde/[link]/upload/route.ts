// ─── Kunden-Link — eine Unterlage hochladen (öffentlich; STUB aus C0, gehört Paket C2 — kommt AUSGESCHALTET) ─────────────────────────
// FULFILLMENT_KONZEPT.md 5.4: nur mit Recht „upload“ (Vorgabe aus), Typ am Inhalt, ≤ 25 MB, Drossel — jede Fehlerart dieselbe 404.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, { status: 404 });
}
