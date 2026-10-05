// ─── MAKE OS — Der Streak ───────────────────────────────────────────────────
// Kevins Ziel vom 29.07.: der saubere Schnitt. Ein Eintrag je Tag: sauber
// ja/nein, Verlangen 0–10. Der Zähler misst Tage seit dem letzten Rückfall —
// ein vergessener Abend nimmt ihn nicht weg (Regel in eintraege.ts).
//
// Haltung: unterstützend, nie wertend. Ein Rückfall ist ein Datum.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { saeubereStreak, streakStand, type StreakLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const log = (await loadJson<StreakLog>(speicherFuer('streak', person))) ?? {};
  return NextResponse.json({ person, log, stand: streakStand(log, localDay()) });
}

export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { datum?: string; eintrag?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereStreak(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.sauber (true/false) fehlt.' }, { status: 400 });
  const person = personAus(req);
  const log = await updateJson<StreakLog>(speicherFuer('streak', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, stand: streakStand(log, localDay()) });
}
