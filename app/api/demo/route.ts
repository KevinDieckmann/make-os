// ─── MAKE OS — Demo-Instanz: Lage und „Demo zurücksetzen“ (05.10.) ─────────────────────────────────────────────────────
// GET   → { ok, demo: true, inhaber, darf, gruende, angelegt } — nur in einer Demo-Instanz (`MAKE_OS_DEMO=1`), sonst 404.
// POST  { aktion: 'zuruecksetzen', bestaetigt: true } → leert den Datenordner und sät die Demo neu (lib/demo/server.ts).
//        Nur der Inhaber der Demo mit Sitzung (kein Dienstweg); greift ein Riegel (lib/demo/schutz.ts), 409 mit Gründen —
//        dann ist nichts verändert. In jeder Nicht-Demo-Instanz gibt es diesen Weg NICHT: 404 vor jeder anderen Prüfung
//        (Wächtertest tests/demo.test.ts).

import { NextResponse } from 'next/server';
import { istDemoInstanz } from '@/lib/demo/schutz';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NICHT_DA = () => NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
const KEIN_ZUGANG = { ok: false, fehler: 'Nur der Inhaber der Demo.' } as const;

export async function GET(req: Request) {
  if (!istDemoInstanz()) return NICHT_DA();
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const { demoLage } = await import('@/lib/demo/server');
  const [lage, inhaber] = await Promise.all([demoLage(), istInhaber(wer.person)]);
  const angelegt = (lage.marke as { angelegt?: string } | null)?.angelegt ?? null;
  return NextResponse.json({ ok: true, demo: true, inhaber, darf: inhaber && !lage.gruende.length, gruende: inhaber ? lage.gruende : [], angelegt }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!istDemoInstanz()) return NICHT_DA();
  // Nur mit Sitzung: der Dienstweg (Takt, ZOE) setzt nie zurück.
  if (istDienst(req)) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const wer = await imHaushaltDesInhabers(req);
  if (!wer || !(await istInhaber(wer.person))) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: unknown; bestaetigt?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion !== 'zuruecksetzen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  if (b.bestaetigt !== true) return NextResponse.json({ ok: false, fehler: 'Bitte bestätigen — alles in der Demo geht auf den Ausgangsstand zurück.' }, { status: 400 });
  const { demoZuruecksetzen, DemoGesperrt } = await import('@/lib/demo/server');
  try {
    const bericht = await demoZuruecksetzen(wer.person);
    return NextResponse.json({ ok: true, bericht });
  } catch (e) {
    if (e instanceof DemoGesperrt) return NextResponse.json({ ok: false, fehler: 'Zurücksetzen gesperrt.', gruende: e.gruende }, { status: 409 });
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen.' }, { status: 500 });
  }
}
