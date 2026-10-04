// ─── MAKE OS — Kapazität (04.10.) ───────────────────────────────────────────
// GET   → { stand, bezuege, ich, inhaber } — je Person und Woche verfügbar/verplant, Team-Wochen (Last, Engpässe), Machbarkeit je
//          Meilenstein/Ziel, Zuweisungen, Kennzahlen. Serverseitig gefiltert (lib/kapazitaet/modell.ts `fuerBetrachter`):
//          Erholung und Ausnahme-Titel sieht nur die Person selbst, alle anderen nur den Team-Faktor.
// PATCH { ops: KapaOp[] } → Grundwert, Ausnahmen (Urlaub, feste Blöcke), Zuweisungen (Mandat/Kunde, h/Woche).
//          Die eigene Kapa oder — als Inhaber — die des Teams; sonst 403 (lib/kapazitaet/aendern.ts).
// Nur der Haushalt des Inhabers mit Person (Sitzung oder Dienstweg mit x-make-person) — Testkunden/andere Haushalte 403.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { zuGross } from '@/lib/zugang/umfang';
import { kapaStandFuer, kapaSchreiben, kapaIdVon } from '@/lib/kapazitaet/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Die Kapazität gehört zum Haushalt des Inhabers.' } as const;

export async function GET(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const [{ stand, bezuege }, inhaber] = await Promise.all([kapaStandFuer(wer.person), istInhaber(wer.person)]);
  return NextResponse.json({ ok: true, ich: kapaIdVon(wer.person), inhaber, stand, bezuege }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zuGross(req, 64 * 1024)) return NextResponse.json({ ok: false, fehler: 'Anfrage zu groß.' }, { status: 413 });
  let b: { ops?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const r = await kapaSchreiben(wer.person, b.ops);
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
  const [{ stand, bezuege }, inhaber] = await Promise.all([kapaStandFuer(wer.person), istInhaber(wer.person)]);
  return NextResponse.json({ ok: true, ich: kapaIdVon(wer.person), inhaber, stand, bezuege });
}
