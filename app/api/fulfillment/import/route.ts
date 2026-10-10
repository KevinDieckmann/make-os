// ─── Fulfillment — Import der Vorlagen und Abläufe (STUB aus C0; gehört Paket C1) ──────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 2.7: POST `vorschau` (schreibt nichts) · `uebernehmen` (vorschauId, 409) · `rueckgaengig` (laufId); ≤ 4 MB (413).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json({ ok: false, fehler: 'kommt mit Paket C1' }, { status: 501 });
}
