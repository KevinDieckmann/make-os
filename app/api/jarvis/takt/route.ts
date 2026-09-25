// ─── MAKE OS — Der Takt (Route) ─────────────────────────────────────────────
// GET  zeigt, was gerade fällig wäre — ohne etwas zu tun.
// POST reiht das Fällige in die Warteschlange ein.
//
// Der Arbeiter fragt jede Minute, der Browser alle paar Minuten als Rückfall.
// Beides zusammen erzeugt nichts doppelt: die Fälligkeit kommt aus dem echten
// Zustand, und die Warteschlange lässt denselben Auftrag nur einmal offen.

import { NextResponse } from 'next/server';
import { faellig } from '@/lib/jarvis/takt';
import { reihe } from '@/lib/jarvis/auftraege';
import { verbunden, ladeStand, abgleichen, naechsterVersuchFaellig } from '@/lib/kalender/icloud';
import { alleSichten } from '@/lib/business/speicher';
import { localDay } from '@/lib/zeit';

/** Business-Index: einmal am Tag festhalten (Verlauf, Trend, Ampel-Wechsel, MRR für die NRR) — auch ohne offene Seite. */
let businessTag = '';
async function businessTagesstand() {
  const heute = localDay();
  if (businessTag === heute) return;
  businessTag = heute;
  await alleSichten(heute).catch(() => { businessTag = ''; });
}

/** Kalender im Hintergrund frisch halten (alle 10 Min.) — Jarvis, Morgenlauf und Heute lesen den Stand, auch wenn keine Seite offen ist. */
async function kalenderFrischHalten() {
  if (!verbunden()) return;
  const s = await ladeStand();
  const zuletzt = Date.parse(s.at ?? '') || 0;
  if (Date.now() - zuletzt > 10 * 60_000 && naechsterVersuchFaellig(s)) void abgleichen().catch(() => { /* Fehler steht im Stand */ });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // ?in=<Minuten> schaut voraus, ohne etwas zu tun — so lässt sich prüfen, ob
  // der Takt später wirklich anspringt, statt darauf zu warten.
  const vor = Number(new URL(req.url).searchParams.get('in')) || 0;
  const jetzt = new Date(Date.now() + Math.max(0, Math.min(24 * 60, vor)) * 60_000);
  const dran = await faellig(jetzt);
  return NextResponse.json({
    ok: true,
    zeitpunkt: jetzt.toISOString(),
    faellig: dran.map(f => ({ id: f.id, grund: f.grund, name: f.auftrag.name, auftrag: f.auftrag.auftrag })),
  });
}

export async function POST() {
  await kalenderFrischHalten().catch(() => {});
  void businessTagesstand();
  const dran = await faellig();
  if (!dran.length) return NextResponse.json({ ok: true, eingereiht: 0 });
  const { angelegt, schonDa } = await reihe(dran.map(f => f.auftrag));
  return NextResponse.json({
    ok: true,
    eingereiht: angelegt.length,
    schonDa,
    was: dran.map(f => `${f.id} (${f.grund})`),
  });
}
