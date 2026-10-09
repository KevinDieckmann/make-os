// ─── MAKE OS — Was die KI kostet (Route) ────────────────────────────────────
// Damit der Inhaber nach vier Wochen sagen kann, welcher Agent die Rechnung treibt —
// und nicht aus Unsicherheit alles abschaltet.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { uebersicht } from '@/lib/zoe/verbrauch';
import { budgetLage, budgetStand } from '@/lib/ki/tor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const tage = Math.max(1, Math.min(45, Number(new URL(req.url).searchParams.get('tage')) || 30));
  // Seit 09.10. (Anbieter-Tor): Euro und das Instanz-Budget des Monats (Budget-Balken: Verbrauch, Grenze, Prozent, Warnstufe 80/95/100).
  const budget = await budgetStand().then(budgetLage).catch(() => null);
  return NextResponse.json({ ok: true, ...(await uebersicht(tage)), budget });
}
