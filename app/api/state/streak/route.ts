// ─── MAKE OS — Der Streak ───────────────────────────────────────────────────
// Kevins Ziel vom 29.07.: der saubere Schnitt. Ein Eintrag je Tag: sauber
// ja/nein, Verlangen 0–10. Der Zähler misst Tage seit dem letzten Rückfall —
// ein vergessener Abend nimmt ihn nicht weg (Regel in eintraege.ts).
//
// Haltung: unterstützend, nie wertend. Ein Rückfall ist ein Datum.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/jarvis/raum';
import { saeubereStreak, streakStand, type StreakLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const log = (await loadJson<StreakLog>(speicherFuer('streak', person))) ?? {};
  return NextResponse.json({ person, log, stand: streakStand(log, localDay()) });
}

export async function PUT(req: Request) {
  let b: { datum?: string; eintrag?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereStreak(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.sauber (true/false) fehlt.' }, { status: 400 });
  const person = personAus(req);
  const log = await updateJson<StreakLog>(speicherFuer('streak', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, stand: streakStand(log, localDay()) });
}
