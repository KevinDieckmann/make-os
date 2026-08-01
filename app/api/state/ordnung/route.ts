// ─── MAKE OS — Die Ordnung (Store) ──────────────────────────────────────────
// Was zählt zuerst: die Reihenfolge der Themen (Kevin & Malin legen sie fest)
// und die Aufgaben, die von Hand einer anderen Bahn zugeordnet wurden.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrdnungFile {
  reihenfolge: string[];
  zuordnung: Record<string, string>;
}

const STANDARD = ['recht', 'umsatz', 'produkt', 'leben'];
const ERLAUBT = new Set(STANDARD);

export async function GET() {
  const f = await loadJson<OrdnungFile>('ordnung');
  return NextResponse.json({
    reihenfolge: Array.isArray(f?.reihenfolge) && f.reihenfolge.length ? f.reihenfolge.filter(x => ERLAUBT.has(x)) : STANDARD,
    zuordnung: f?.zuordnung && typeof f.zuordnung === 'object' ? f.zuordnung : {},
  });
}

export async function PUT(req: Request) {
  let body: Partial<OrdnungFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const next = await updateJson<OrdnungFile>('ordnung', current => {
    const reihenfolge = Array.isArray(body.reihenfolge)
      ? body.reihenfolge.filter(x => typeof x === 'string' && ERLAUBT.has(x))
      : (current?.reihenfolge ?? STANDARD);
    // Fehlende Themen hinten anhängen — es darf nie eine Bahn verschwinden.
    for (const id of STANDARD) if (!reihenfolge.includes(id)) reihenfolge.push(id);

    const zuordnung = { ...(current?.zuordnung ?? {}) };
    if (body.zuordnung && typeof body.zuordnung === 'object') {
      for (const [taskId, thema] of Object.entries(body.zuordnung).slice(0, 500)) {
        if (typeof thema === 'string' && ERLAUBT.has(thema)) zuordnung[String(taskId).slice(0, 60)] = thema;
        else delete zuordnung[String(taskId).slice(0, 60)];
      }
    }
    return { reihenfolge, zuordnung };
  });

  return NextResponse.json({ ok: true, ...next });
}
