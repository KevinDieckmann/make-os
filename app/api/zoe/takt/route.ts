// ─── MAKE OS — Der Takt (Route) ─────────────────────────────────────────────
// GET  zeigt, was gerade fällig wäre — ohne etwas zu tun.
// POST reiht das Fällige in die Warteschlange ein.
//
// Der Arbeiter fragt jede Minute, der Browser alle paar Minuten als Rückfall.
// Beides zusammen erzeugt nichts doppelt: die Fälligkeit kommt aus dem echten
// Zustand, und die Warteschlange lässt denselben Auftrag nur einmal offen.

import { herzschlag } from '@/lib/hoi/innen';
import { NextResponse } from 'next/server';
import { faellig } from '@/lib/zoe/takt';
import { reihe } from '@/lib/zoe/auftraege';
import { alleSichten } from '@/lib/business/speicher';
import { kalenderJobsImTakt } from '@/lib/kalender/takt-jobs';
import { localDay } from '@/lib/zeit';

/** Business-Index: einmal am Tag festhalten (Verlauf, Trend, Ampel-Wechsel, MRR für die NRR) — auch ohne offene Seite. */
let businessTag = '';
async function businessTagesstand() {
  const heute = localDay();
  if (businessTag === heute) return;
  businessTag = heute;
  await alleSichten(heute).catch(() => { businessTag = ''; });
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
  void herzschlag();
  // Brain-Index alle 30 Minuten leise mit dem Vault abgleichen (27.09.; erst 10, seit der Tempo-Prüfung 30 — der Lauf
  // liest alle Notizen und rechnet synchron in SQLite) — nie blockierend.
  void import('@/lib/brain/index').then(ix => ix.indexFrischHalten(30)).catch(() => {});
  // Kalender (U1 M4): höchstens EIN iCloud-Job je Takt, gestaffelt — Abgleich (alle 5 Min., seit 27.09.: ZOE, Morgenlauf
  // und Heute lesen den Stand auch ohne offene Seite), sonst die Tagessicherung (R-K1 #K5, 03:00–05:00, frühestens 30 Min.
  // nach dem Start), sonst der Event-Spiegel (K6a, alle 30 Min.; U1 B3: nur eigene, künftige Termine, Absagen → Glocke).
  // Nie blockierend; Fehler als eine Zeile `[kalender-sicherung] …` / `[spiegel] …` (lib/kalender/takt-jobs.ts).
  await kalenderJobsImTakt().catch(() => {});
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
