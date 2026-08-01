// ─── MAKE OS — Rituale (privat · MAKE.One) ──────────────────────────────────
// Log: { "YYYY-MM-DD": ["sunday-dinner", ...] } — welche Rituale gehalten
// wurden. Speist die Säule „Beziehung & Team": die einzige Größe dort, die
// Kevin aktiv steuern kann.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RitualLog = Record<string, string[]>;

export async function GET() {
  const log = (await loadJson<RitualLog>('rituale')) ?? {};
  return NextResponse.json({ log });
}

/** Ein Ritual für einen Tag an/aus — ohne die anderen Tage zu berühren. */
export async function PUT(req: Request) {
  let body: { date?: string; id?: string; an?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'Kein Ritual.' }, { status: 400 });

  const p = (n: number) => String(n).padStart(2, '0');
  const heute = new Date();
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : `${heute.getFullYear()}-${p(heute.getMonth() + 1)}-${p(heute.getDate())}`;

  const log = await updateJson<RitualLog>('rituale', current => {
    const l = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const tag = new Set(l[date] ?? []);
    if (body.an === false) tag.delete(id); else tag.add(id);
    return { ...l, [date]: Array.from(tag) };
  });

  return NextResponse.json({ ok: true, log });
}
