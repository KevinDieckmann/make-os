// ─── MAKE OS — Was die KI kostet (Route) ────────────────────────────────────
// Damit der Inhaber nach vier Wochen sagen kann, welcher Agent die Rechnung treibt —
// und nicht aus Unsicherheit alles abschaltet.
// Sicherheitsprüfung 09.10.: ein Konto „nur Business“ (`finanzRecht: 'business'`) sieht die Kosten je Zweck OHNE die Privat-Heads
// (agent-gesundheit, agent-familie …) und ohne private Systemläufe — sonst verriete schon der Zweck, dass im Haushalt z. B. ein
// Gesundheits-Coach läuft. Die Summen der Instanz bleiben (Budget-Balken der Instanz).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { uebersicht, zweckPrivat } from '@/lib/zoe/verbrauch';
import { budgetLage, budgetStand } from '@/lib/ki/tor';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const tage = Math.max(1, Math.min(45, Number(new URL(req.url).searchParams.get('tage')) || 30));
  // Seit 09.10. (Anbieter-Tor): Euro und das Instanz-Budget des Monats (Budget-Balken: Verbrauch, Grenze, Prozent, Warnstufe 80/95/100).
  const budget = await budgetStand().then(budgetLage).catch(() => null);
  const u = await uebersicht(tage);
  // Volles Mitglied (Haushalt ohne „nur Business“) sieht alles; sonst ohne die Privat-Zwecke — serverseitig, nie bloß ausgeblendet.
  const voll = !!(await haushaltFuer(zugang.person).catch(() => null));
  const sicht = voll ? u : {
    ...u,
    tage: u.tage.map(t => ({ ...t, posten: t.posten.filter(p => !zweckPrivat(p.zweck)) })),
    jeZweck: u.jeZweck.filter(z => !zweckPrivat(z.zweck)),
  };
  return NextResponse.json({ ok: true, ...sicht, budget });
}
