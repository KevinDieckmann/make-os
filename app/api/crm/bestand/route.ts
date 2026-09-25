// ─── CRM — Bestand (Chancen, Mandate, Leistungen, Events, Sitzungen) ────────
// GET   → Bestand + was der Code daraus rechnet (Prognose, MRR, Konzentration,
//         Lage je Mandat, Ampel je Chance, Zahlen je Event)
// PATCH → { ops: [{ liste, op: 'upsert'|'delete'|'teil', eintrag|id|felder }] } — Einzeländerungen,
//         damit Kevin und Malin gleichzeitig arbeiten können.

import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { personAus } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';
import { ladeCrm, aendereCrm, wendeCrmAn } from '@/lib/crm/speicher';
import { prognose, gesundheit, gewinnquote, STUFEN, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { mandatLage, mrr, konzentration, zahlungAusRechnungen, type RechnungKurz } from '@/lib/crm/kunden';
import { eventZahlen } from '@/lib/crm/events';
import type { CrmBestand } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function antwort(b: CrmBestand, ich: string) {
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const rechnungen = (await loadJson<{ rechnungen?: RechnungKurz[] }>('finanzplan'))?.rechnungen ?? [];
  return {
    ok: true, ich, heute, stand: b,
    stufen: STUFEN.map(s => ({ ...s, p: wahrscheinlichkeit(s.id, b.wahrscheinlichkeiten) })),
    prognose: prognose(b.chancen, heute, b.wahrscheinlichkeiten),
    gewinnquote: gewinnquote(b.chancen),
    ampel: Object.fromEntries(b.chancen.map(c => [c.id, gesundheit(c, heute)])),
    mandate: Object.fromEntries(b.mandate.map(m => [m.id, mandatLage(m, heute, rechnungen)])),
    zahlung: Object.fromEntries(b.mandate.map(m => [m.id, zahlungAusRechnungen(m, rechnungen, heute)])),
    mrr: mrr(b.mandate), konzentration: konzentration(b.mandate),
    events: Object.fromEntries(b.events.map(e => [e.id, eventZahlen(e, b.teilnahmen, kontakte, b.chancen)])),
    termine: ((await loadJson<{ kommend?: Record<string, { titel: string; start: string }> }>('crm-signale'))?.kommend) ?? {},
  };
}

export async function GET(req: Request) {
  const person = personAus(req);
  // Alles, woraus die Antwort entsteht: die vier Speicher, der Tag (Ampeln, Prognose) und wer fragt.
  const etag = etagAus('b', await speicherStand(['crm', 'kontakte', 'finanzplan', 'crm-signale']), localDay(), person);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  return jsonAntwort(req, await antwort(await ladeCrm(), person), etag);
}

export async function PATCH(req: Request) {
  let body: { ops?: ListenOp[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const ops = (Array.isArray(body.ops) ? body.ops : []).slice(0, 200);
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  const person = personAus(req);
  let angewandt = 0;
  const b = await aendereCrm(cur => { const r = wendeCrmAn(cur, ops, new Date().toISOString(), person); angewandt = r.angewandt; return r.bestand; });
  return jsonAntwort(req, { ...(await antwort(b, person)), angewandt });
}
