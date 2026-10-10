// ─── Fulfillment — Dossier je Mandat (STUB aus C0; gehört Paket C3) ───────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9 / 4: GET `?m=` Dossier OHNE Personenteil (Lese-Protokoll) · POST anlegen · eingaben · f1 · lia · uebernehmen ·
// verwerfen · pruefen · ueberstimmen · f2 · aussage-hand · firma-uebernehmen · nach-fall (gibt dem Browser die Ops zurück).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'kommt mit Paket C3' } as const;

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
