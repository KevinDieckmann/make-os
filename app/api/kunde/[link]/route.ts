// ─── Kunden-Link — Kunden-Sicht (öffentlich; STUB aus C0, gehört Paket C2 — kommt AUSGESCHALTET) ─────────────────────────────────────
// FULFILLMENT_KONZEPT.md 5.4: offen nur über die enge Regex der Middleware (`KUNDE_OFFEN`), handelt für niemanden (Köpfe gelöscht). Unbekannter Link,
// falsches Token, abgelaufen, Schalter aus und Recht aus ergeben DIESELBE Antwort: 404 „Dieser Link ist nicht (mehr) gültig.“ — so auch der Stub.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, { status: 404 });
}
