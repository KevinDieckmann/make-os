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
import { spaceVonKalender } from '@/lib/kalender/space';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const roh = Number(new URL(req.url).searchParams.get('jahr'));
  const jahr = Number.isInteger(roh) && roh >= 1900 && roh <= 2200 ? roh : Number(localDay().slice(0, 4));
  const einst = await ladeEinstellungen();
  const g = await termineLesen(einst, `${jahr}-01-01`, `${jahr + 1}-01-01`);
  // Sicht Privat · Business (10.10.): mit `?space=` nur Kalender dieses Bereichs (`spaceVonKalender`, wie GET /api/kalender).
  const bereich = sichtDerAnfrage(req);
  const imBereich = (name: string) => !bereich || spaceVonKalender(einst, name) === bereich;
  // Private Termine der ANDEREN Person nur als „Belegt“ (K1 `maskieren`) — auch in den ganztägigen Titeln.
  const termine = g.termine.filter(t => imBereich(t.kalender)).map(t => maskieren(t, zugang.person));
  const kalender = g.kalender.filter(k => imBereich(k.name));
  return NextResponse.json({ ok: true, jahr, quelle: g.quelle, kalender, ...jahrVerdichten(termine, jahr) }, { headers: { 'Cache-Control': 'no-store' } });
}
