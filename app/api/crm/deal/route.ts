// ─── Markttraktion — Deal-Ebene (27.09.) ────────────────────────────────────
// POST { aktion: 'anlegen', titel?, kontaktIds?, firmaId?, art?, wert?, schritt: { text, datum }, quelle?, … }
//      → der EINE Weg, einen Deal anzulegen (lib/crm/deal-anlegen.ts): Firma per Kennung,
//        Kernfragen vom Lead, Pflicht zum nächsten Schritt, Lead wird SQL. 409, wenn an
//        derselben Firma schon ein Deal offen ist (mit `trotzdem: true` bewusst ein zweiter).
// Stufenwechsel laufen weiter über PATCH /api/crm/bestand (op teil) — die Regeln
// prüft der Server dort (lib/crm/speicher.ts dealRegeln).

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { dealAnlegen, type DealEingabe } from '@/lib/crm/deal-anlegen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: DealEingabe & { aktion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'anlegen') return NextResponse.json({ ok: false, fehler: 'aktion: anlegen.' }, { status: 400 });
  const r = await dealAnlegen(b, personAus(req));
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.offen ? { offen: r.offen } : {}) }, { status: r.status });
  return NextResponse.json({ ok: true, chance: r.chance, text: r.text });
}
