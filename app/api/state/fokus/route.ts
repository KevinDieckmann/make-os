// ─── MAKE OS — laufender Fokus je Person (29.09.) ───────────────────────────
// GET  → { ok, laufend } — der laufende Fokus der angemeldeten Person (oder null).
// POST { laufend: {...} | null } → setzen bzw. beenden (der fertige Block geht weiter über POST /api/state/zeit).
// Nur mit ausdrücklicher Person (401), nur der eigene Bestand. Vorher lebte der laufende Fokus nur im Browser
// (localStorage) — Gerätewechsel oder gelöschte Tab-Daten verloren den Start. Regeln: lib/zeitmessung/fokus-regeln.ts.

import { NextResponse } from 'next/server';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { laufendLesen, laufendSetzen } from '@/lib/zeitmessung/fokus-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, error: 'Keine Person.' }, { status: 401 });
  return NextResponse.json({ ok: true, laufend: await laufendLesen(person) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, error: 'Keine Person.' }, { status: 401 });
  let b: { laufend?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || !('laufend' in b)) return NextResponse.json({ ok: false, error: 'laufend fehlt (Objekt oder null).' }, { status: 400 });
  const r = await laufendSetzen(person, b.laufend ?? null);
  if (!r.ok) return NextResponse.json({ ok: false, error: 'Ungültiger Fokus (Beginn/Schlüssel).', laufend: r.laufend }, { status: 400 });
  return NextResponse.json({ ok: true, laufend: r.laufend }, { headers: { 'Cache-Control': 'no-store' } });
}
