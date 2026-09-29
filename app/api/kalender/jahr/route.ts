// ─── Kalender — Jahr verdichtet (29.09., Paket K2) ──────────────────────────
// GET ?jahr=JJJJ → nur, was die Jahresansicht braucht: je Tag die Zahl der Termine je Kalender (mehrtägige auf jedem
// Tag, höchstens 62) und die ganztägigen Einträge (Titel, Kalender; private der anderen Person als „Belegt“) — keine
// Orte, Notizen, Teilnehmer. So bleibt die 120-Tage-Grenze von GET /api/kalender, wie sie ist. Gelesen ohne Abgleich
// (lib/kalender/termine-lesen.ts).
// Zugang wie der Kalender.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { termineLesen } from '@/lib/kalender/termine-lesen';
import { jahrVerdichten } from '@/lib/kalender/jahr';
import { maskieren } from '@/lib/kalender/bezug';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const roh = Number(new URL(req.url).searchParams.get('jahr'));
  const jahr = Number.isInteger(roh) && roh >= 1900 && roh <= 2200 ? roh : Number(localDay().slice(0, 4));
  const g = await termineLesen(await ladeEinstellungen(), `${jahr}-01-01`, `${jahr + 1}-01-01`);
  // Private Termine der ANDEREN Person nur als „Belegt“ (K1 `maskieren`) — auch in den ganztägigen Titeln.
  const termine = g.termine.map(t => maskieren(t, zugang.person));
  return NextResponse.json({ ok: true, jahr, quelle: g.quelle, kalender: g.kalender, ...jahrVerdichten(termine, jahr) }, { headers: { 'Cache-Control': 'no-store' } });
}
