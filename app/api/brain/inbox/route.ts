// ─── /api/brain/inbox — Vorschläge von ZOE mit Freigabe (27.09.) ─────────
// GET ?welche=offen|erledigt|abgelehnt · POST { aktion: 'annehmen'|'ablehnen', id, grund?, zielNotiz?, zielOrdner? }
// Nur der Haushalt des Inhabers; Vertraulichkeit je Vorschlag (privat-kevin sieht nur Kevin).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personAus } from '@/lib/zoe/raum';
import { vorschlaegeLesen, vorschlagAnnehmen, vorschlagAblehnen } from '@/lib/brain/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const person = personAus(req);
  const w = new URL(req.url).searchParams.get('welche');
  const welche = w === 'erledigt' || w === 'abgelehnt' ? w : 'offen';
  return NextResponse.json({ ok: true, person, welche, vorschlaege: await vorschlaegeLesen({ person }, welche) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const person = personAus(req);
  let b: { aktion?: string; id?: string; grund?: string; zielNotiz?: string; zielOrdner?: string };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'annehmen') { const r = await vorschlagAnnehmen(String(b.id ?? ''), person, { person }, { zielNotiz: b.zielNotiz, zielOrdner: b.zielOrdner }); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  if (b.aktion === 'ablehnen') { const r = await vorschlagAblehnen(String(b.id ?? ''), person, { person }, b.grund); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
