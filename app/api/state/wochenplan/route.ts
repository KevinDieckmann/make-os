// ─── MAKE OS — Wochenplan (lokal) ───────────────────────────────────────────
// Die verschiebbaren Blöcke des Wochenplaners, je Woche (Schlüssel = Montag).
// Feste Termine kommen NICHT hierher — die leben in den Kalendern und werden
// im Planer nur angezeigt. Hier liegt, was Kevin frei schiebt: Fokus, Reha,
// Routinen, Pausen, eingeplante Aufgaben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { PLAN_ARTEN, type PlanBlock } from '@/types/planer';
// Wiederausfuhr für Bestandsimporte — die Wahrheit liegt in types/planer.
export type { PlanBlock };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanFile = Record<string, PlanBlock[]>;

const WOCHE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const woche = new URL(req.url).searchParams.get('woche') ?? '';
  if (!WOCHE_RE.test(woche)) return NextResponse.json({ ok: false, error: 'woche=YYYY-MM-DD (Montag) nötig.' }, { status: 400 });
  const f = (await loadJson<PlanFile>('wochenplan')) ?? {};
  return NextResponse.json({ bloecke: Array.isArray(f[woche]) ? f[woche] : [] });
}

/** Einen Block säubern — von PUT und PATCH gemeinsam benutzt. */
function sauberBlock(b: PlanBlock, woche: string): PlanBlock {
  return {
    id: b.id || `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: WOCHE_RE.test(b.date ?? '') ? b.date : woche,
    startMin: Math.max(0, Math.min(24 * 60 - 15, Math.round(Number(b.startMin) / 15) * 15)),
    dauerMin: Math.max(15, Math.min(8 * 60, Math.round(Number(b.dauerMin) / 15) * 15 || 60)),
    titel: String(b.titel ?? '').slice(0, 120) || 'Block',
    art: (PLAN_ARTEN as readonly string[]).includes(b.art) ? b.art : 'block',
    taskId: b.taskId ? String(b.taskId).slice(0, 80) : undefined,
    appleUid: b.appleUid ? String(b.appleUid).slice(0, 80) : undefined,
  };
}

export async function PUT(req: Request) {
  let body: { woche?: string; bloecke?: PlanBlock[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const woche = body.woche ?? '';
  if (!WOCHE_RE.test(woche) || !Array.isArray(body.bloecke)) {
    return NextResponse.json({ ok: false, error: 'woche + bloecke nötig.' }, { status: 400 });
  }

  const sauber: PlanBlock[] = body.bloecke.slice(0, 120).map(b => sauberBlock(b, woche));

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

/**
 * Einzelne Blöcke ändern statt der ganzen Woche.
 *
 * Dasselbe Fundament wie bei den Aufgaben: Kevin und Malin planen die Woche
 * ZUSAMMEN, und vorher schrieb jeder Zug die komplette Woche — wer zuletzt
 * einen Block zog, überschrieb still die Züge des anderen. Jetzt schickt ein
 * Fenster nur den Block, den ES bewegt hat; updateJson führt die
 * Schreibvorgänge serialisiert aus, zwei gleichzeitige Züge gehen beide durch.
 */
export async function PATCH(req: Request) {
  let body: { woche?: string; ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const woche = body.woche ?? '';
  if (!WOCHE_RE.test(woche)) return NextResponse.json({ ok: false, error: 'woche=YYYY-MM-DD (Montag) nötig.' }, { status: 400 });
  const roh = Array.isArray(body.ops) ? body.ops.slice(0, 60) : null;
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });

  interface Op { op: 'upsert' | 'delete'; block?: PlanBlock; id?: string }
  const ops: Op[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id });
    else if (o?.op === 'upsert' && o.block && typeof (o.block as PlanBlock).id === 'string') {
      ops.push({ op: 'upsert', block: sauberBlock(o.block as PlanBlock, woche) });
    }
  }
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  const next = await updateJson<PlanFile>('wochenplan', current => {
    const f = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const nachId = new Map((Array.isArray(f[woche]) ? f[woche] : []).map(b => [b.id, b]));
    for (const o of ops) {
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else { nachId.set(o.block!.id, o.block!); angewandt++; }
    }
    return { ...f, [woche]: Array.from(nachId.values()).slice(0, 120) };
  });
  return NextResponse.json({ ok: true, angewandt, bloecke: next[woche] });
}
