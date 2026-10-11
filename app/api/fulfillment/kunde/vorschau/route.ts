// ─── Fulfillment — „So sieht der Kunde es“ (C2, 10.10.; FULFILLMENT_KONZEPT.md 6.4) ─────────────────────────────────────────────────────────────
// GET ?m=<mandat> → genau die serverseitig gefilterte Kunden-Sicht (`kundenSicht`, Positivliste) — dieselbe Komponente `KundenAnsicht` wie die öffentliche
// Seite. Mit aktivem Link: dessen Rechte; ohne: wie ein neuer Link. Nur lesen; Lese-Protokoll „fulfillment“ (Formular-Antworten können Personen nennen).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { vorschauFuer } from '@/lib/fulfillment/kunde/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const m = new URL(req.url).searchParams.get('m') ?? '';
  if (!MANDAT_ID.test(m)) return NextResponse.json({ ok: false, fehler: 'Unzulässige Mandat-Kennung.' }, { status: 400 });
  const v = await vorschauFuer(m);
  if (!v) return NextResponse.json({ ok: false, fehler: 'Dieses Mandat gibt es nicht (mehr) — oder es gehört nicht zum Business.' }, { status: 404 });
  leseZugriff(req, 'fulfillment', { ids: [m] });
  return NextResponse.json({ ok: true, sicht: v.sicht, schalter: v.schalter }, { headers: { 'Cache-Control': 'no-store, private' } });
}
