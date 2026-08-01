// ─── MAKE OS — Fokus-Regler (lokal) ─────────────────────────────────────────
// Der MENSCH entscheidet, wohin die Energie fließt — je Säule ein Regler 0–100.
// Der Score LIEFERT die Datenlage, die Regler sind Kevins Antwort darauf.
// Wirkung: Aufgaben-Vorsortierung (Wochenplaner-Leiste) und Jarvis' Wochen-
// vorschlag gewichten danach.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SaeuleKey = 'health' | 'business' | 'planning' | 'finance' | 'social';
export type Regler = Record<SaeuleKey, number>;
interface ReglerFile { regler: Regler; stand: string }

const KEYS: SaeuleKey[] = ['health', 'business', 'planning', 'finance', 'social'];
// Neutraler Start — Kevin stellt selbst. Kein erfundener Schwerpunkt.
const NEUTRAL: Regler = { health: 50, business: 50, planning: 50, finance: 50, social: 50 };

export async function GET() {
  const f = await loadJson<ReglerFile>('fokus-regler');
  const regler = { ...NEUTRAL, ...(f?.regler ?? {}) };
  return NextResponse.json({ regler, stand: f?.stand ?? null });
}

export async function PUT(req: Request) {
  let body: { regler?: Partial<Regler> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!body.regler || typeof body.regler !== 'object') {
    return NextResponse.json({ ok: false, error: 'regler fehlt.' }, { status: 400 });
  }
  const sauber: Regler = { ...NEUTRAL };
  for (const k of KEYS) {
    const v = Number(body.regler[k]);
    if (isFinite(v)) sauber[k] = Math.max(0, Math.min(100, Math.round(v)));
  }
  const next = await updateJson<ReglerFile>('fokus-regler', () => ({ regler: sauber, stand: new Date().toISOString() }));
  return NextResponse.json({ ok: true, regler: next.regler });
}
