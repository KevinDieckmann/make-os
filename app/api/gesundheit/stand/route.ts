// ─── MAKE OS — Gesundheit: der Stand auf einen Blick ────────────────────────
// Ein Aufruf für die Seite: Vitalwerte, Haut, Streak, Routinen, Journal,
// Telegram — für die angemeldete Person oder (Kevins Entscheidung 23.09.:
// „Malin sieht alles") per ?fuer= für die andere.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { ansichtPerson, personAus, darfGesundheitSehen, speicherFuer } from '@/lib/jarvis/raum';
import { resolveVitals } from '@/lib/vitals';
import { localDay } from '@/lib/zeit';
import { hautTrend, streakStand, routineQuote, tageZurueck, type HautLog, type StreakLog, type RoutinenLog } from '@/lib/gesundheit/eintraege';
import { ladeStand, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';
import type { TaktStand } from '@/lib/gesundheit/takt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Routine { id: string; label: string; wann: string; aktiv: boolean; kategorie?: string }

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const ich = personAus(req);
  const heute = localDay();
  const [vitals, haut, streak, hl, journal, routinenF, tg, takt] = await Promise.all([
    resolveVitals(heute, person),
    loadJson<HautLog>(speicherFuer('haut', person)),
    loadJson<StreakLog>(speicherFuer('streak', person)),
    loadJson<RoutinenLog>(speicherFuer('health-log', person)),
    loadJson<Record<string, { text?: string; gut?: string; dankbar?: string; hart?: string; mood?: number; energy?: number; stress?: number }>>(speicherFuer('journal', person)),
    loadJson<{ routinen?: Routine[] }>('routinen'),
    ladeStand(),
    loadJson<TaktStand>('gesundheit-takt'),
  ]);
  const routinen = (routinenF?.routinen ?? []).filter(r => r.aktiv);
  const t14 = tageZurueck(heute, 14);
  const q = routineQuote(hl ?? {}, routinen.map(r => r.id), heute, 7);
  const je = (id: string) => routineQuote(hl ?? {}, [id], heute, 7).quote;

  return NextResponse.json({
    person, ich, heute,
    vitals,
    haut: { trend: hautTrend(haut ?? {}, heute), tage: t14.map(d => ({ d, e: haut?.[d] ?? null })) },
    streak: streakStand(streak ?? {}, heute),
    routinen: {
      liste: routinen.map(r => ({ ...r, quote7: je(r.id), heute: (hl?.[heute] ?? []).includes(r.id) })),
      quote7: q.quote, tage7: q.tage,
      tage: t14.map(d => ({ d, n: (hl?.[d] ?? []).length })),
    },
    journal: { tage7: tageZurueck(heute, 7).filter(d => journal?.[d]).length, heute: journal?.[heute] ?? null },
    telegram: { konfiguriert: telegramKonfiguriert(), gekoppelt: chatsFuerPerson(tg, person).length > 0, zuletzt: takt?.[person] ?? {} },
  });
}
