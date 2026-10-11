// ─── Fulfillment — Mandats-Cockpit (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 6.3) ──────────────────────────────────────────────────────
// GET → je laufendem Fall (Mandate von Business-Gesellschaften): Kunde, Paket, Phase, Fortschritt, nächster Schritt, „wartet auf euch“,
//       Health-Ampel, Report fällig, Puls (C2), Analyse-Stand (C3), Onboarding, nächster Ritual-Termin — und „Was hängt“ zuerst (rot vor gelb,
//       älteste zuerst). Dazu die Kapazität aus der Leistungstreppe (Aufwand je Woche gegen freie Stunden). Nur lesen, schreibt nie.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { cockpitDaten } from '@/lib/fulfillment/prozesse/server';
import { allesWasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import { localDay } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const heute = localDay();
  const { zeilen } = await cockpitDaten(heute);
  // Die Zeilen nennen Kunden (Firmen) — Lese-Protokoll (Prüf-Fund 11.10.), nur die Anzahl.
  leseZugriff(req, 'fulfillment', { anzahl: zeilen.length });
  const kapa = await import('@/lib/crm/treppe-server').then(t => t.treppeLage(z.person, heute)).then(l => ({ stundenWoche: l.kapa.stundenWoche, frei: l.kapa.frei ?? null, ueber: l.kapa.ueber })).catch(() => null);
  return NextResponse.json({ ok: true, heute, zeilen: zeilen.map(({ gesellschaft: _g, ...r }) => r), haengt: allesWasHaengt(zeilen), kapa });
}
