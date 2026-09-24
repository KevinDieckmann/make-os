// ─── MAKE OS — Rituale (privat · MAKE.One) ──────────────────────────────────
// Log: { "YYYY-MM-DD": ["sunday-dinner", ...] } — welche Rituale gehalten
// wurden. Speist die Säule „Beziehung & Team": die einzige Größe dort, die
// Kevin aktiv steuern kann.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { personDatei } from '@/lib/performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RitualLog = Record<string, string[]>;

// Je Person (24.09.): der Score las schon immer rituale--<person>, die Route
// schrieb aber für alle in „rituale“ — Malins Häkchen landeten bei Kevin.
const name = (req: Request) => personDatei('rituale', personAus(req));

export async function GET(req: Request) {
  const log = (await loadJson<RitualLog>(name(req))) ?? {};
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

  const log = await updateJson<RitualLog>(name(req), current => {
    const l = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const tag = new Set(l[date] ?? []);
    if (body.an === false) tag.delete(id); else tag.add(id);
    return { ...l, [date]: Array.from(tag) };
  });

  return NextResponse.json({ ok: true, log });
}
