// ─── MAKE OS — Controlling-Zustand persistieren (lokal) ─────────────────────
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { schwellen } from '@/lib/schwellen';
import { geschaeftsKasse, type FinanceState } from '@/lib/make-one/finance-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [state, plan, grenzen] = await Promise.all([
    loadJson<FinanceState>('finance'),
    loadJson<{ firmen?: { id: string; kontostand?: number | null; stand?: string | null }[] }>('finanzplan'),
    schwellen(),
  ]);
  // Die Kasse kommt aus den Firmenkonten; `state.cash` bleibt nur Rückfall.
  return NextResponse.json({ state, kasse: geschaeftsKasse(plan?.firmen, state?.cash), runway: { rot: grenzen.runwayRot, amber: grenzen.runwayAmber } });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = body as Partial<FinanceState>;
  if (!s || !Array.isArray(s.months) || typeof s.zielUmsatz !== 'number') {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand.' }, { status: 400 });
  }
  // Schrumpf-Wächter: die Ansicht schickt immer die komplette Monatsreihe.
  // Ein Client, der seinen Stand nicht laden konnte, würde damit das ganze
  // Controlling-Jahr auf ein paar leere Monate zurücksetzen.
  let verloren: string | null = null;
  await updateJson<FinanceState>('finance', current => {
    const neu: FinanceState = {
      jahr: s.jahr ?? 2026,
      zielUmsatz: s.zielUmsatz!,
      zielGewinn: s.zielGewinn ?? 0,
      cash: s.cash ?? 0,
      months: s.months!,
      // Startmonat mitschreiben — ohne ihn zählt die Rechnung ab Januar.
      ...(typeof s.startMonat === 'number' && s.startMonat >= 0 && s.startMonat <= 11 ? { startMonat: Math.round(s.startMonat) } : {}),
    };
    const alt = current?.months?.length ?? 0;
    if (alt >= 6 && neu.months.length < alt / 2) {
      verloren = `${alt} → ${neu.months.length} Monate`;
      return current!;
    }
    return neu;
  });

  if (verloren) {
    return NextResponse.json(
      { ok: false, error: `Verweigert: die Monatsreihe wäre von ${verloren} geschrumpft. Der alte Stand bleibt stehen — Seite neu laden.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
