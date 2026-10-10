// ─── Fulfillment — ein Fall je Mandat (STUB aus C0; gehört Paket C1) ──────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9: GET `?m=` Fall + Vorlagen-Diff (Lese-Protokoll „fulfillment“) · POST `starten` (anfrageId), `vorlage-uebernehmen`
// · PATCH Ops am Fall (knoten-status, freigabe, vereinbarung, stakeholder, entscheidung, … quickwins-setzen, kickoff-fragen) mit Stand.

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

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}

export async function PATCH(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}
