// ─── Heute: die Top 3 des Tages (10.10., Branch `heute-top3`) ─────────────────────────────────────────────────────────────────
// GET [?space=privat|business]  → { ok, tag, space, bereiche: { privat?: Block, business?: Block } } — ZOEs Vorschlag (Regelwerk, kein Modell), die
//        eigene Festlegung dieses Tages und die Auswahl zum Tauschen. Ohne `space` beide Bereiche der Person; mit `space` NUR dieser — der Server
//        liefert nie den anderen (Heute › Business bekommt nichts aus Privat). Ein Konto „nur Business“ bekommt Privat nie.
// PUT { aktion: 'festlegen', space, ids: [1–3 Aufgaben], stand? } | { aktion: 'zuruecksetzen', space, stand? } → { ok, block } — schreibt NUR den
//        eigenen Bestand `heute-top3--<person>`; `stand` veraltet → 409 mit dem aktuellen Block. Abhaken geht über den Aufgaben-Schreibweg.
// Nur die Person selbst (Sitzung, Haushalt des Inhabers): kein Personen-Parameter, der Dienstweg (ZOE, Takt) bekommt 403.

import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { tagesDaten, top3Festlegen } from '@/lib/heute/top3-server';
import { istTopBereich, type TopBereich } from '@/lib/heute/top3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const roh = new URL(req.url).searchParams.get('space');
  if (roh && roh !== 'alles' && !istTopBereich(roh)) return NextResponse.json({ ok: false, error: 'space ist privat, business oder alles.' }, { status: 400 });
  const gefragt: TopBereich[] = istTopBereich(roh) ? [roh] : ['privat', 'business'];
  const d = await tagesDaten(z.person, new Date(), gefragt);
  return NextResponse.json({ ok: true, tag: d.tag, space: istTopBereich(roh) ? roh : 'alles', bereiche: d.bloecke }, { headers: KEIN_CACHE });
}

export async function PUT(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let body: { aktion?: unknown; space?: unknown; ids?: unknown; stand?: unknown };
  try { body = await jsonBegrenzt(req, 4096); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!istTopBereich(body.space)) return NextResponse.json({ ok: false, error: 'space ist privat oder business.' }, { status: 400 });
  if (body.aktion !== 'festlegen' && body.aktion !== 'zuruecksetzen') return NextResponse.json({ ok: false, error: 'aktion ist festlegen oder zuruecksetzen.' }, { status: 400 });
  if (body.stand !== undefined && typeof body.stand !== 'string') return NextResponse.json({ ok: false, error: 'stand ist ein Text.' }, { status: 400 });
  const r = await top3Festlegen(z.person, { bereich: body.space, ids: body.aktion === 'festlegen' ? body.ids ?? [] : null, ...(body.stand !== undefined ? { stand: body.stand } : {}) });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler, ...(r.block ? { block: r.block } : {}) }, { status: r.status, headers: KEIN_CACHE });
  return NextResponse.json({ ok: true, block: r.block }, { headers: KEIN_CACHE });
}
