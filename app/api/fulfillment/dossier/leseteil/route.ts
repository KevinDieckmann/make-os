// ─── Fulfillment — Leseteil „Tiefenbericht — nur für dich“ (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.7) ─────────────────────────────────────────
// GET `?m=` → der Tiefenbericht des Dossiers NUR für die Person der SITZUNG, die ihn ausgelöst hat — jede andere Person bekommt 404, der Dienstweg 401.
// Mit Suchvorschlägen (HTML nur für ein abgeschottetes iframe `sandbox=""`) und Quellen. Er geht nie an Agenten, Synthese, Prüfer, Brain, Suche oder
// ZOE: gelesen wird ausschließlich über lib/ki/leseteil.ts (in lib/ki, die Google-Regeln bleiben dort unverändert) — und nur HIER.
// Klasse `person`, Tor `personDerSitzung`; seit 18.10. (Gesamtprüfung L3 C9) zusätzlich nur im Haushalt des Inhabers — wer den Haushalt verlässt, liest
// den Bericht über die Kundenfirma nicht weiter. Kein Lese-Protokoll: es sind die eigenen Daten der Person (ein Bericht über eine Firma).

import { NextResponse } from 'next/server';
import { personDerSitzung, ohnePerson, imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { fulfillmentLesen } from '@/lib/fulfillment/speicher';
import { leseteilFuer } from '@/lib/ki/leseteil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NICHT = { ok: false, fehler: 'Diesen Leseteil sieht nur die Person, die den Tiefenbericht ausgelöst hat.' } as const;

export async function GET(req: Request) {
  const person = personDerSitzung(req);
  if (!person) return ohnePerson();
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const m = new URL(req.url).searchParams.get('m') ?? '';
  if (!MANDAT_ID.test(m)) return NextResponse.json(NICHT, { status: 404 });
  const d = (await fulfillmentLesen('dossiers')).dossiers[m];
  if (!d?.leseteil || d.leseteil.person !== person) return NextResponse.json(NICHT, { status: 404 });
  const l = await leseteilFuer(person, d.leseteil.id);
  return NextResponse.json({ ok: true, leseteil: l ?? { status: 'abgelaufen', frage: '', gestartet: d.leseteil.gestartetAm } }, { headers: { 'cache-control': 'no-store' } });
}
