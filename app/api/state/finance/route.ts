// ─── MAKE OS — Controlling-Zustand persistieren (lokal) ─────────────────────
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { schwellen } from '@/lib/schwellen';
import { geschaeftsKasse, DEFAULT_FINANCE, type FinanceState, type MonthRow } from '@/lib/make-one/finance-data';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const [roh, plan, grenzen, ab] = await Promise.all([
    loadJson<FinanceState>('finance'),
    loadJson<{ firmen?: { id: string; kontostand?: number | null; stand?: string | null }[] }>('finanzplan'),
    schwellen(),
    loadJson<{ eintraege?: { firma: string; monat: string; umsatz?: number; kosten?: number }[] }>('business-abschluesse'),
  ]);
  // Eine Wahrheit (26.09.): liegt ein Monatsabschluss (je Firma, Business-Index) vor, gilt er — die
  // hier gepflegten Monate sind nur noch Rückfall. So zählt derselbe Umsatz nicht doppelt.
  const state = roh && ab?.eintraege?.length ? {
    ...roh,
    months: roh.months.map((m, i) => {
      const key = `${roh.jahr}-${String(i + 1).padStart(2, '0')}`;
      const je = ab.eintraege!.filter(e => e.monat === key && (e.umsatz != null || e.kosten != null));
      return je.length ? { ...m, umsatz: je.reduce((s, e) => s + (e.umsatz ?? 0), 0), kosten: je.reduce((s, e) => s + (e.kosten ?? 0), 0) } : m;
    }),
  } : roh;
  // Die Kasse kommt aus den Firmenkonten; `state.cash` bleibt nur Rückfall.
  return NextResponse.json({ state, kasse: geschaeftsKasse(plan?.firmen, state?.cash), runway: { rot: grenzen.runwayRot, amber: grenzen.runwayAmber } });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
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

/**
 * Zu zweit (24.09.): Einzeländerungen — Monate über ihren Namen
 * ({ ops: [{ liste: 'months', op: 'upsert', eintrag: { m, umsatz, kosten } }] })
 * und Einzelfelder ({ felder: { zielUmsatz, zielGewinn, cash, startMonat, jahr } }).
 */
export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let body: { ops?: ListenOp[]; felder?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const zahl = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined);
  let angewandt = 0;
  const next = await updateJson<FinanceState>('finance', current => {
    const f: FinanceState = current ?? { ...DEFAULT_FINANCE, months: DEFAULT_FINANCE.months.map(m => ({ ...m })) };
    // Monate: nur Umsatz/Kosten eines bekannten Monats — das Raster bleibt immer zwölf lang.
    const monatsOps = (body.ops ?? []).filter(o => o.liste === 'months' && o.op === 'upsert');
    const r = wendeAn(f.months as unknown as Record<string, unknown>[], monatsOps, 'm', roh => {
      if (!f.months.some(x => x.m === roh.m)) return null;
      return { m: String(roh.m), umsatz: zahl(roh.umsatz) ?? 0, kosten: zahl(roh.kosten) ?? 0 };
    });
    angewandt += r.angewandt;
    const reihenfolge = f.months.map(x => x.m);
    const months = reihenfolge.map(m => (r.liste as unknown as MonthRow[]).find(x => x.m === m)!);
    const fe = body.felder ?? {};
    const neu: FinanceState = { ...f, months };
    for (const k of ['jahr', 'zielUmsatz', 'zielGewinn', 'cash'] as const) if (k in fe && zahl(fe[k]) !== undefined) { neu[k] = zahl(fe[k])!; angewandt++; }
    if ('startMonat' in fe && zahl(fe.startMonat) !== undefined && zahl(fe.startMonat)! >= 0 && zahl(fe.startMonat)! <= 11) { neu.startMonat = zahl(fe.startMonat); angewandt++; }
    return neu;
  });
  return NextResponse.json({ ok: true, angewandt, stand: next });
}
