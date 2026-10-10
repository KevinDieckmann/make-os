// ─── MAKE OS — Routinen 2: die eigene Einstellung und der Kalender-Abgleich (10.10.) ────────────────────────────────────────
// NUR die Person selbst (Sitzung), kein `?fuer=`, kein Dienstweg (403):
// GET   → { ok, handy, bloecke } — „Erinnerungen auch aufs Handy“ (Vorgabe aus) und wie viele Routinen-Blöcke MAKE OS gerade für sie führt.
// PATCH { handy: boolean } → die Einstellung (Bestand `routinen-person--<person>`). Einschalten nur mit Einwilligung (a) — die Erinnerung liest
//        den Gesundheits-Log; Ausschalten geht immer.
// POST  { aktion: 'kalender' } → die eigenen Routinen mit „Kalender-Block“ jetzt nachziehen (sonst im Morgenlauf) — feste UIDs, idempotent,
//        entfernt nur eigene künftige Blöcke (lib/planung/routinen-takt.ts). Ohne Kalender: 409 mit Satz, nichts verändert.

import { NextResponse } from 'next/server';
import { istDienst, personStreng, ohnePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { handySetzen, personStandVon } from '@/lib/planung/routinen-haken-server';
import { routineBloeckeAbgleichen } from '@/lib/planung/routinen-takt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = () => NextResponse.json({ ok: false, error: 'Diese Einstellung sieht und ändert nur die Person selbst — angemeldet, nie über den Dienstweg.' }, { status: 403 });

export async function GET(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  const s = await personStandVon(person);
  return NextResponse.json({ ok: true, handy: !!s.handy, bloecke: Object.keys(s.bloecke ?? {}).length }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  let b: { handy?: unknown };
  try { b = await jsonBegrenzt(req, 2_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (typeof b?.handy !== 'boolean') return NextResponse.json({ ok: false, error: 'handy: true oder false.' }, { status: 400 });
  if (b.handy) { const sperre = await gesundheitSchreibSperre(person); if (sperre) return sperre; }
  const s = await handySetzen(person, b.handy);
  return NextResponse.json({ ok: true, handy: !!s.handy });
}

export async function POST(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  let b: { aktion?: unknown };
  try { b = await jsonBegrenzt(req, 2_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b?.aktion !== 'kalender') return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  const r = await routineBloeckeAbgleichen(person);
  if (r.fehler) return NextResponse.json({ ok: false, error: r.fehler, angelegt: r.angelegt, entfernt: r.entfernt }, { status: 409 });
  return NextResponse.json({ ok: true, angelegt: r.angelegt, entfernt: r.entfernt });
}
