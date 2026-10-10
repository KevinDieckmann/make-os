// ─── Fulfillment — Vorlagen, Bibliothek, Rituale, Zuordnung, Einstellungen (STUB aus C0; gehört Paket C1) ──────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9: GET Vorlagen/Bibliothek (Kurzform, `?baustein=` lang)/Rituale/Zuordnung/Einstellungen/Onboarding-Kandidaten/
// Kennzahlen · PATCH Einzel-Ops mit Stand (409), Kunden-Link-Schalter nur Inhaber. Tor: `fulfillmentZugang` (Routen-Register, Modul fulfillment).

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

export async function PATCH(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}
