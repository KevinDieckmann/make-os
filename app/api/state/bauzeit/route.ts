// ─── MAKE OS — Bauzeit ──────────────────────────────────────────────────────
// Kevins Ansage: „Wir müssen aufpassen, dass wenn ich gleichzeitig im Programm
// rumprogrammiere, wir nicht was kaputtmachen — programmierfreie Zonen."
//
// Der Schalter ist die Absprache in sichtbarer Form: steht er an, zeigt die
// Software auf JEDER Seite einen Hinweis. Malin sieht dann sofort, dass gerade
// gebaut wird, und trägt nichts Wichtiges ein.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Bauzeit {
  aktiv: boolean;
  /** Woran gerade gebaut wird — damit der Hinweis etwas sagt. */
  woran: string;
  seit: string | null;
  von: string;
}

const LEER: Bauzeit = { aktiv: false, woran: '', seit: null, von: 'Kevin' };

export async function GET() {
  const b = await loadJson<Bauzeit>('bauzeit');
  return NextResponse.json(b ?? LEER);
}

export async function PUT(req: Request) {
  let body: Partial<Bauzeit>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const aktiv = !!body.aktiv;
  const next = await updateJson<Bauzeit>('bauzeit', current => ({
    aktiv,
    woran: String(body.woran ?? '').slice(0, 140),
    // Beim Einschalten neu stempeln, beim Weiterlaufen den alten Start behalten.
    seit: aktiv ? (current?.aktiv && current.seit ? current.seit : new Date().toISOString()) : null,
    von: String(body.von ?? 'Kevin').slice(0, 40),
  }));
  return NextResponse.json({ ok: true, ...next });
}
