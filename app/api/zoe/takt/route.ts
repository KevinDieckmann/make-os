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
import { verbunden, ladeStand, abgleichen, naechsterVersuchFaellig } from '@/lib/kalender/icloud';
import { alleSichten } from '@/lib/business/speicher';
import { kalenderSicherungTaeglich } from '@/lib/kalender/sicherung-server';
import { eventSpiegelImTakt } from '@/lib/kalender/spiegel-server';
import { localDay } from '@/lib/zeit';

/** Business-Index: einmal am Tag festhalten (Verlauf, Trend, Ampel-Wechsel, MRR für die NRR) — auch ohne offene Seite. */
let businessTag = '';
async function businessTagesstand() {
  const heute = localDay();
  if (businessTag === heute) return;
  businessTag = heute;
  await alleSichten(heute).catch(() => { businessTag = ''; });
}

/** Kalender im Hintergrund frisch halten (alle 5 Min., seit 27.09. — der Seitenpfad wartet nicht mehr auf iCloud) — ZOE, Morgenlauf und Heute lesen den Stand, auch wenn keine Seite offen ist. */
async function kalenderFrischHalten() {
  if (!verbunden()) return;
  const s = await ladeStand();
  const zuletzt = Date.parse(s.at ?? '') || 0;
  if (Date.now() - zuletzt > 5 * 60_000 && naechsterVersuchFaellig(s)) void abgleichen().catch(() => { /* Fehler steht im Stand */ });
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
  await kalenderFrischHalten().catch(() => {});
  // Tägliche Voll-Sicherung je Kalender (R-K1 #K5) — nachts ab 03:00, einmal je Tag, nie blockierend.
  void kalenderSicherungTaeglich().catch(() => { /* Fehler stehen im Stand kalender-sicherung */ });
  // Event-Termine im Takt nachziehen (K6a) — auch Änderungen am Event ohne Bestand-PATCH (ZOE, Heads); alle 30 Min.
  // F1 #5: die Hinweise je Event protokolliert eventSpiegelImTakt selbst; ein Fehler des ganzen Laufs hier (nie Titel).
  void eventSpiegelImTakt().catch(e => console.warn(`[spiegel] Takt: ${e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler'}`));
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
