// ─── Kalender — Zeit-Auswertung (29.09., Paket K2) ──────────────────────────
// GET ?stichtag=YYYY-MM-DD (Standard heute) → Woche des Stichtags + 4 Vorwochen: Meetings, Fokus, Abwesend, frei,
// Privat/Business, je Firma (Einheit) und je Mandat, meistbesuchte Kontakte (sobald Termine Kontakte tragen, K3).
// Rechnung rein in lib/kalender/auswertung.ts, Lesen in auswertung-server.ts. Die Zeit ist persönlich: nur die
// angemeldete Person im Haushalt des Inhabers. Gemerkt je Person + Woche für eine Minute.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { zeitAuswertungFuer } from '@/lib/kalender/auswertung-server';
import { montagDer } from '@/lib/kalender/auswertung';
import { merken } from '@/lib/store/memo';
import { zeitBloeckeStand } from '@/lib/zeitmessung/speicher';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const roh = new URL(req.url).searchParams.get('stichtag') ?? '';
  const stichtag = /^\d{4}-\d{2}-\d{2}$/.test(roh) ? roh : localDay();
  // `zeit` ist Memo-Rauschen — der Stand der Blöcke gehört in den Schlüssel (wie bei Zeit je Einheit).
  const a = await merken(`kalender-auswertung:${z.person}:${montagDer(stichtag)}:${zeitBloeckeStand()}`, 60_000, () => zeitAuswertungFuer(z.person, stichtag));
  return NextResponse.json({ ok: true, ...a }, { headers: { 'Cache-Control': 'no-store' } });
}
