// ─── Steuern (25.09.) ───────────────────────────────────────────────────────
// GET  → Fristen (je Firma und privat, mit Countdown), Umsatzsteuer je
//        Zeitraum, Rücklage & Prognose, Belege, Übergabe an den Steuerberater.
//        Legt dabei die Aufgaben vor den Fristen an (Vorlauf aus den Einstellungen).
// POST { einstellungen: {…} }             → Einstellungen ändern
//      { abhaken: { key, an: true|false } } → Frist oder Übergabe-Punkt abhaken
// Nur der Haushalt des Inhabers und der Dienstweg. Hinweis, keine Steuerberatung.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { steuernStand, speichereSteuern, steuerAufgabenAbgleichen } from '@/lib/steuern/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Steuern — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const st = await steuernStand();
  const aufgaben = await steuerAufgabenAbgleichen(st.fristen, st.heute).catch(() => ({ neu: 0, erledigt: 0 }));
  return NextResponse.json({ ok: true, ...st, aufgaben }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await speichereSteuern(b, wer.person);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
