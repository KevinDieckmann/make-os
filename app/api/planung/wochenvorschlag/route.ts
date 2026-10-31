// ─── Planung mit ZOE — Wochenvorschlag (31.10.) ──────────────────────────────────────────────────────────────────────────────────
// GET  ?woche=YYYY-MM-DD&space=privat|business → { ok, vorschlag, uebernommen, bereitgelegt } — der bereitgelegte Vorschlag, sonst frisch gerechnet
//      (Regelwerk, schreibt nichts).
// POST { aktion: 'planen', woche, space, formulieren? } → neu rechnen (übernommene Blöcke bleiben) und bereitlegen; `formulieren: true` lässt die KI
//      NUR die Sätze umformulieren (KI-Tor, Kategorien aufgaben + kalender; ohne KI bleibt das Regelwerk).
// POST { aktion: 'uebernehmen', woche, space, stand, ids?, verschoben? } → die gewählten Blöcke über `blockAnlegen` anlegen (feste UIDs, nichts doppelt;
//      belegte Zeit wird nicht angelegt). `stand` veraltet → 409.
// Nur die Person selbst (Sitzung, Haushalt des Inhabers): kein Personen-Parameter, der Dienstweg (ZOE, Takt) bekommt 403 — ZOE legt hier nichts an.

import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { localDay } from '@/lib/zeit';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { wocheAus, wochenvorschlagLesen, wochenvorschlagNeu, wochenvorschlagUebernehmen } from '@/lib/planung/wochenvorschlag-server';
import { istWvBereich } from '@/lib/planung/wochenvorschlag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_CACHE = { 'Cache-Control': 'no-store' };
const NUR_SELBST = { ok: false, fehler: 'Den Wochenvorschlag plant und übernimmt nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;
const falsch = (fehler: string, status = 400) => NextResponse.json({ ok: false, error: fehler }, { status, headers: KEIN_CACHE });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const u = new URL(req.url).searchParams;
  const bereich = u.get('space') ?? 'business';
  if (!istWvBereich(bereich)) return falsch('space ist privat oder business.');
  const montag = wocheAus(u.get('woche') ?? undefined, localDay());
  if (!montag) return falsch('woche: ein Tag dieser oder der nächsten acht Wochen (YYYY-MM-DD).');
  const r = await wochenvorschlagLesen(z.person, montag, bereich);
  if (!r.ok) return falsch(r.fehler, r.status);
  return NextResponse.json(r, { headers: KEIN_CACHE });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let body: { aktion?: unknown; woche?: unknown; space?: unknown; formulieren?: unknown; stand?: unknown; ids?: unknown; verschoben?: unknown };
  try { body = await jsonBegrenzt(req, 32 * 1024); } catch (e) { return jsonZuGross(e) ?? falsch('Kein gültiges JSON.'); }
  const bereich = body.space ?? 'business';
  if (!istWvBereich(bereich)) return falsch('space ist privat oder business.');
  const montag = wocheAus(body.woche, localDay());
  if (!montag) return falsch('woche: ein Tag dieser oder der nächsten acht Wochen (YYYY-MM-DD).');
  if (body.aktion === 'planen') {
    const r = await wochenvorschlagNeu(z.person, montag, bereich, body.formulieren === true ? { ki: kiAus(req, ['aufgaben', 'kalender'], { person: z.person }) } : {});
    if (!r.ok) return falsch(r.fehler, r.status);
    return NextResponse.json(r, { headers: KEIN_CACHE });
  }
  if (body.aktion === 'uebernehmen') {
    const r = await wochenvorschlagUebernehmen(z.person, { montag, bereich, stand: body.stand, ...(body.ids !== undefined ? { ids: body.ids } : {}), ...(body.verschoben !== undefined ? { verschoben: body.verschoben } : {}) });
    if (!r.ok) {
      // 409: den aktuellen Stand gleich mitgeben (die Oberfläche zeigt ihn statt des alten).
      const aktuell = r.status === 409 ? await wochenvorschlagLesen(z.person, montag, bereich).catch(() => null) : null;
      return NextResponse.json({ ok: false, error: r.fehler, ...(aktuell?.ok ? { aktuell } : {}) }, { status: r.status, headers: KEIN_CACHE });
    }
    return NextResponse.json(r, { headers: KEIN_CACHE });
  }
  return falsch('aktion ist planen oder uebernehmen.');
}
