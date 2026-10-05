// ─── MAKE OS — Risk-Shields (deterministisch) ───────────────────────────────
// GET → aktuelle Warnungen aus den echten Stores. Kein KI-Anteil.

import { NextResponse } from 'next/server';
import { computeShields } from '@/lib/risk';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Warnungen aus Finanz-, Aufgaben- und Kalenderbeständen: nur der Haushalt des Inhabers (05.10.); die Blöcke sind die der Person.
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const shields = await computeShields(undefined, z.person);
  return NextResponse.json({ shields });
}
