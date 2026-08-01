// ─── MAKE OS — Risk-Shields (deterministisch) ───────────────────────────────
// GET → aktuelle Warnungen aus den echten Stores. Kein KI-Anteil.

import { NextResponse } from 'next/server';
import { computeShields } from '@/lib/risk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const shields = await computeShields();
  return NextResponse.json({ shields });
}
