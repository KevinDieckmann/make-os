// ─── Fulfillment — Leseteil „Tiefenbericht — nur für dich“ (STUB aus C0; gehört Paket C3) ─────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 4.7: nur die Person der SITZUNG, die den Tiefenbericht ausgelöst hat (andere 404); nie der Dienstweg, nie an Agenten,
// Synthese, Brain oder Suche (die Google-Regeln in lib/ki bleiben unverändert; gelesen wird nur über lib/ki/leseteil, C3). Klasse `person`, Tor `personDerSitzung`.

import { NextResponse } from 'next/server';
import { personDerSitzung, ohnePerson } from '@/lib/zugang/tor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!personDerSitzung(req)) return ohnePerson();
  return NextResponse.json({ ok: false, fehler: 'kommt mit Paket C3' }, { status: 501 });
}
