// ─── MAKE OS — Das Haut-Tagebuch ────────────────────────────────────────────
// Schuppenflechte: Juckreiz 0–10, Schub, Stellen, Auslöser — ein Eintrag je
// Tag. Kevin am 29.07.: „Ich merke, wenn mein Stresslevel hoch ist oder ich
// nervös werde, kratze ich." Hier wird das sichtbar, und beim Hautarzt sind es
// Zahlen statt Erinnerung.
//
// GET  ?fuer=kevin|malin  → Log + Trend (Kevins Entscheidung 23.09.: Malin
//                            sieht alles — beide dürfen die Seite der anderen
//                            Person LESEN; geschrieben wird nur die eigene)
// PUT  { datum?, eintrag } → einen Tag setzen

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/jarvis/raum';
import { saeubereHaut, hautTrend, type HautLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const log = (await loadJson<HautLog>(speicherFuer('haut', person))) ?? {};
  return NextResponse.json({ person, log, trend: hautTrend(log, localDay()) });
}

export async function PUT(req: Request) {
  let b: { datum?: string; eintrag?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereHaut(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.juckreiz (0–10) fehlt.' }, { status: 400 });
  const person = personAus(req);
  const log = await updateJson<HautLog>(speicherFuer('haut', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, trend: hautTrend(log, localDay()) });
}
