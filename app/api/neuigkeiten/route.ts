// ─── Was ist neu (18.10.) ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// GET  → { ok, eintraege, ungelesen, gesehen } — die Updates, die das Konto sehen darf (ein Konto „nur Business“ bekommt keine Privat-Punkte —
//        serverseitig, `neuigkeitenFuer`), und welche davon für die Person neu sind. Lesen schreibt nie.
// POST { gesehen: <Kennung> } → { ok } — merkt sich das zuletzt gesehene Update im eigenen Bestand `neuigkeiten--<person>`.
// Nur die Person selbst (Sitzung, Haushalt des Inhabers): kein Personen-Parameter, der Dienstweg (ZOE, Takt) bekommt 403.

import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { neuigkeitenStand, gesehenSetzen } from '@/lib/neuigkeiten/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const s = await neuigkeitenStand(z.person);
  return NextResponse.json({ ok: true, ...s }, { headers: KEIN_CACHE });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let body: { gesehen?: unknown };
  try { body = await jsonBegrenzt(req, 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (typeof body.gesehen !== 'string') return NextResponse.json({ ok: false, error: 'gesehen ist die Kennung eines Updates.' }, { status: 400 });
  const r = await gesehenSetzen(z.person, body.gesehen);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.status, headers: KEIN_CACHE });
  return NextResponse.json({ ok: true }, { headers: KEIN_CACHE });
}
