// ─── Heute: das Tages-Briefing als kurzer Text (10.10., Branch `heute-top3`) ───────────────────────────────────────────────────
// GET ?space=privat|business → { ok, tag, space, saetze: string[3–5], text } — Regelwerk aus den Zahlen des Bereichs (Termine, Aufgaben, Freigaben,
// Top 3, Fokus), kein Modell, gemerkt. Ein Bereich je Antwort: Business bekommt nichts aus Privat (und umgekehrt); ein Konto „nur Business“
// bekommt für Privat 403. Nur die Person selbst (Dienstweg 403) — das Briefing nennt Termine und Aufgaben dieser Person.

import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { briefingLesen } from '@/lib/heute/briefing-server';
import { istTopBereich } from '@/lib/heute/top3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const space = new URL(req.url).searchParams.get('space');
  if (!istTopBereich(space)) return NextResponse.json({ ok: false, error: 'space ist privat oder business.' }, { status: 400 });
  const b = await briefingLesen(z.person, space);
  if (!b) return NextResponse.json({ ok: false, error: space === 'privat' ? 'Dieses Konto hat keinen Privat-Bereich.' : 'Dieses Konto gehört zu keinem Haushalt.' }, { status: 403 });
  return NextResponse.json({ ok: true, tag: b.tag, space, saetze: b.saetze, text: b.text }, { headers: { 'Cache-Control': 'no-store' } });
}
