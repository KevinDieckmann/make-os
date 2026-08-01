// ─── MAKE OS — Wochenplan (lokal) ───────────────────────────────────────────
// Die verschiebbaren Blöcke des Wochenplaners, je Woche (Schlüssel = Montag).
// Feste Termine kommen NICHT hierher — die leben in den Kalendern und werden
// im Planer nur angezeigt. Hier liegt, was Kevin frei schiebt: Fokus, Reha,
// Routinen, Pausen, eingeplante Aufgaben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PlanBlock {
  id: string;
  /** Tag YYYY-MM-DD */
  date: string;
  /** Minuten ab 00:00 */
  startMin: number;
  dauerMin: number;
  titel: string;
  art: 'fokus' | 'reha' | 'routine' | 'pause' | 'aufgabe' | 'block';
  taskId?: string;
}
type PlanFile = Record<string, PlanBlock[]>;

const WOCHE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ARTEN = ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'] as const;

export async function GET(req: Request) {
  const woche = new URL(req.url).searchParams.get('woche') ?? '';
  if (!WOCHE_RE.test(woche)) return NextResponse.json({ ok: false, error: 'woche=YYYY-MM-DD (Montag) nötig.' }, { status: 400 });
  const f = (await loadJson<PlanFile>('wochenplan')) ?? {};
  return NextResponse.json({ bloecke: Array.isArray(f[woche]) ? f[woche] : [] });
}

export async function PUT(req: Request) {
  let body: { woche?: string; bloecke?: PlanBlock[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const woche = body.woche ?? '';
  if (!WOCHE_RE.test(woche) || !Array.isArray(body.bloecke)) {
    return NextResponse.json({ ok: false, error: 'woche + bloecke nötig.' }, { status: 400 });
  }

  const sauber: PlanBlock[] = body.bloecke.slice(0, 120).map(b => ({
    id: b.id || `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: WOCHE_RE.test(b.date ?? '') ? b.date : woche,
    startMin: Math.max(0, Math.min(24 * 60 - 15, Math.round(Number(b.startMin) / 15) * 15)),
    dauerMin: Math.max(15, Math.min(8 * 60, Math.round(Number(b.dauerMin) / 15) * 15 || 60)),
    titel: String(b.titel ?? '').slice(0, 120) || 'Block',
    art: (ARTEN as readonly string[]).includes(b.art) ? b.art : 'block',
    taskId: b.taskId ? String(b.taskId).slice(0, 80) : undefined,
  }));

  const next = await updateJson<PlanFile>('wochenplan', current => {
    const f = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    // Nur die letzten 12 Wochen behalten — alte Pläne braucht niemand.
    const keys = Object.keys(f).sort().slice(-11);
    const behalten: PlanFile = {};
    for (const k of keys) behalten[k] = f[k];
    behalten[woche] = sauber;
    return behalten;
  });
  return NextResponse.json({ ok: true, bloecke: next[woche] });
}
