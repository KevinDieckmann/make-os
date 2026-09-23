// ─── MAKE OS — Aufträge übernehmen (nur für den Arbeiter) ───────────────────
// Der Arbeiter fragt hier nach Arbeit. Das Übernehmen läuft in einem einzigen
// Schreibvorgang, damit zwei Arbeiter nie denselben Auftrag greifen.

import { NextResponse } from 'next/server';
import { nimm } from '@/lib/jarvis/auftraege';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { anzahl?: number; pacht?: number };
  try { body = await req.json(); } catch { body = {}; }
  const anzahl = Math.max(1, Math.min(16, Number(body.anzahl) || 4));
  const pacht = Math.max(60, Math.min(1800, Number(body.pacht) || 300));
  const genommen = await nimm(anzahl, pacht);
  return NextResponse.json({ ok: true, auftraege: genommen });
}
