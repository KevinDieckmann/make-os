// ─── Kalender — gemeinsame freie Zeit („Mit … planen“, 29.09., Paket K4) ─────
// GET ?personen=kevin,malin&dauer=30&tage=14&puffer=0&von=YYYY-MM-DD
//   → { ok, vorschlaege: [{ start, ende, tag, feiertag? }], von, bis }
// Nur Zeiten, nie Titel (auch private Termine der anderen Person sind nur „belegt“). Die Rechnung ist die eine
// Lesefunktion `freieZeitFuer` (lib/kalender/freie-zeit.ts) — dieselbe nutzen Buchungsseite, ZOE und Angebot.
// Nur der Haushalt des Inhabers (wie der Kalender); nur lesen.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { freieZeitFuer } from '@/lib/kalender/freie-zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const zahl = (v: string | null, min: number, max: number, sonst: number) => { const n = Math.round(Number(v ?? '')); return v !== null && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst; };

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const personen = Array.from(new Set((q.get('personen') ?? '').split(',').map(s => s.trim()).filter(Boolean)));
  if (!personen.length || personen.length > 4) return NextResponse.json({ ok: false, fehler: 'Für wen? (personen=kevin,malin)' }, { status: 400 });
  for (const p of personen) if (!(await personImHaushaltDesInhabers(p))) return NextResponse.json({ ok: false, fehler: 'Nur Personen des Haushalts.' }, { status: 400 });
  const von = TAG.test(q.get('von') ?? '') ? q.get('von')! : undefined;
  const r = await freieZeitFuer({ personen, dauerMin: zahl(q.get('dauer'), 10, 480, 30), tage: zahl(q.get('tage'), 1, 60, 14), pufferMin: zahl(q.get('puffer'), 0, 120, 0), ...(von ? { von } : {}) });
  return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
