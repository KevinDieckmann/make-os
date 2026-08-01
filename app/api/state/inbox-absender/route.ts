// ─── MAKE OS — Absender-Register (Screener) ─────────────────────────────────
// Wer schon einmal durchgelassen wurde, landet direkt im Postfach. Wer neu
// ist, wartet im Screener — genau eine Entscheidung, dann nie wieder.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AbsenderFile {
  /** E-Mail (klein) → Entscheidung */
  bekannt: Record<string, { status: 'durchgelassen' | 'geblockt'; seit: string; fach?: string }>;
}

export async function GET() {
  const f = await loadJson<AbsenderFile>('inbox-absender');
  return NextResponse.json({ bekannt: f?.bekannt && typeof f.bekannt === 'object' ? f.bekannt : {} });
}

export async function POST(req: Request) {
  let body: { absender?: string; status?: string; fach?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const key = String(body.absender ?? '').toLowerCase().trim().slice(0, 200);
  if (!key) return NextResponse.json({ ok: false, error: 'Kein Absender.' }, { status: 400 });
  const status = body.status === 'geblockt' ? 'geblockt' : 'durchgelassen';

  const next = await updateJson<AbsenderFile>('inbox-absender', current => {
    const bekannt = { ...(current?.bekannt ?? {}) };
    bekannt[key] = { status, seit: new Date().toISOString().slice(0, 10), ...(body.fach ? { fach: String(body.fach).slice(0, 20) } : {}) };
    return { bekannt };
  });
  return NextResponse.json({ ok: true, bekannt: next.bekannt });
}
