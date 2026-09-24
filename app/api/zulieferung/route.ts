// ─── Zulieferung vom Mac (24.09., Kevins Entscheidung „Mac liefert zu“) ────
// Auf dem Server gibt es kein Apple. Kevins Mac liest Kalender, Mail,
// Erinnerungen und Kontakte (zulieferer.mjs) und schiebt den Stand hierher.
// Nur mit dem Dienstschlüssel — eine Anmeldung im Browser reicht nicht, denn
// wer hier schreibt, bestimmt, was Jarvis für Kevins Kalender hält.
// GET zeigt, was wann zuletzt ankam (ohne Inhalte).

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { SPEICHER, ZULIEFERUNGEN, type Gemerkt, type Zulieferung } from '@/lib/mac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dienst = (req: Request) => !!process.env.MAKE_OS_KEY && req.headers.get('x-make-key') === process.env.MAKE_OS_KEY;
const MAX_BYTES = 3_000_000;

export async function POST(req: Request) {
  if (!dienst(req)) return NextResponse.json({ ok: false, fehler: 'Nur mit Dienstschlüssel.' }, { status: 403 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, fehler: 'Zu groß.' }, { status: 413 });
  let b: { art?: unknown; daten?: unknown; at?: unknown };
  try { b = JSON.parse(text); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const art = ZULIEFERUNGEN.find(a => a === b.art) as Zulieferung | undefined;
  if (!art) return NextResponse.json({ ok: false, fehler: `art muss eins sein von: ${ZULIEFERUNGEN.join(', ')}` }, { status: 400 });
  const at = typeof b.at === 'string' && !Number.isNaN(Date.parse(b.at)) ? new Date(b.at).toISOString() : new Date().toISOString();
  if (art === 'kalender') {
    if (!Array.isArray(b.daten)) return NextResponse.json({ ok: false, fehler: 'Kalender: daten muss eine Liste von Terminen sein.' }, { status: 400 });
    await saveJson(SPEICHER.kalender, { events: b.daten, at });
    return NextResponse.json({ ok: true, art, anzahl: b.daten.length, at });
  }
  if (b.daten == null || typeof b.daten !== 'object') return NextResponse.json({ ok: false, fehler: 'daten fehlt.' }, { status: 400 });
  await saveJson<Gemerkt>(SPEICHER[art], { daten: b.daten, at, quelle: 'zulieferung' });
  return NextResponse.json({ ok: true, art, anzahl: Array.isArray(b.daten) ? b.daten.length : undefined, at });
}

export async function GET() {
  const stand: Record<string, string | null> = {};
  for (const art of ZULIEFERUNGEN) {
    const g = await loadJson<{ at?: string }>(SPEICHER[art]);
    stand[art] = g?.at ?? null;
  }
  return NextResponse.json({ ok: true, stand });
}
