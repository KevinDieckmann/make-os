// ─── CRM — Bestand (Chancen, Mandate, Leistungen, Events, Sitzungen) ────────
// GET   → Bestand + was der Code daraus rechnet (Prognose, MRR, Konzentration,
//         Lage je Mandat, Ampel je Chance, Zahlen je Event)
// PATCH → { ops: [{ liste, op: 'upsert'|'delete', eintrag|id }] } — Einzeländerungen,
//         damit Kevin und Malin gleichzeitig arbeiten können.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';
import { ladeCrm, aendereCrm, wendeCrmAn } from '@/lib/crm/speicher';
import { prognose, gesundheit, gewinnquote, STUFEN, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { mandatLage, mrr, konzentration } from '@/lib/crm/kunden';
import { eventZahlen } from '@/lib/crm/events';
import type { CrmBestand } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function antwort(b: CrmBestand) {
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  return {
    ok: true, heute, stand: b,
    stufen: STUFEN.map(s => ({ ...s, p: wahrscheinlichkeit(s.id, b.wahrscheinlichkeiten) })),
    prognose: prognose(b.chancen, heute, b.wahrscheinlichkeiten),
    gewinnquote: gewinnquote(b.chancen),
    ampel: Object.fromEntries(b.chancen.map(c => [c.id, gesundheit(c, heute)])),
    mandate: Object.fromEntries(b.mandate.map(m => [m.id, mandatLage(m, heute)])),
    mrr: mrr(b.mandate), konzentration: konzentration(b.mandate),
    events: Object.fromEntries(b.events.map(e => [e.id, eventZahlen(e, b.teilnahmen, kontakte, b.chancen)])),
  };
}

export async function GET() {
  return NextResponse.json(await antwort(await ladeCrm()));
}

export async function PATCH(req: Request) {
  let body: { ops?: ListenOp[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const ops = (Array.isArray(body.ops) ? body.ops : []).slice(0, 200);
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  const person = personAus(req);
  let angewandt = 0;
  const b = await aendereCrm(cur => { const r = wendeCrmAn(cur, ops, new Date().toISOString(), person); angewandt = r.angewandt; return r.bestand; });
  return NextResponse.json({ ...(await antwort(b)), angewandt });
}
