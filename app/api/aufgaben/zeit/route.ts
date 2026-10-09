// ─── MAKE OS — Zeit je Aufgabe (28.09. spät) ────────────────────────────────
// GET ?ids=<Aufgabe>,<Unteraufgabe>… → Summe der Fokus-Blöcke, die darauf gebucht sind, je Person des Haushalts.
// Zugang wie die Aufgaben (Haushalt des Inhabers, Person aus der Sitzung — kein Rückfall, Regel 5).
// Rechnung rein in lib/aufgaben/zeit.ts.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { ladeZeit } from '@/lib/zeitmessung/speicher';
import { zeitPersonenVon } from '@/lib/zeitmessung/personen';
import { zeitJeAufgabe } from '@/lib/aufgaben/zeit';
import { verborgeneAufgabenFuer } from '@/lib/aufgaben/sicht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const MAX_IDS = 250;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
  const roh = (new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (roh.length > MAX_IDS) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_IDS} Aufgaben auf einmal.` }, { status: 413 });
  // Nur Aufgaben, die die Person sieht (09.10., E4 — EINE Konto-Sicht): fremde „nur ich“ und für ein Konto „nur Business“ der Privat-Bereich
  // zählen nicht mit (auch keine Zahl darüber).
  const gueltig = roh.filter(id => KENNUNG.test(id));
  if (!gueltig.length) return NextResponse.json({ ok: false, error: 'Keine Aufgabe genannt.' }, { status: 400 });
  const verborgen = await verborgeneAufgabenFuer(zugang.person);
  const ids = gueltig.filter(id => !verborgen.has(id));
  const { personen } = await zeitPersonenVon(zugang.person);
  const dateien = await Promise.all(personen.map(async p => ({ ...p, datei: await ladeZeit(p.person) })));
  return NextResponse.json({ ok: true, ...zeitJeAufgabe(dateien, ids) }, { headers: { 'Cache-Control': 'no-store' } });
}
