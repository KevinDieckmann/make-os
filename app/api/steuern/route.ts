// ─── Steuern (25.09.) ───────────────────────────────────────────────────────
// GET  → Fristen (je Firma und privat, mit Countdown), Umsatzsteuer je
//        Zeitraum, Rücklage & Prognose, Belege, Übergabe an den Steuerberater.
//        Legt dabei die Aufgaben vor den Fristen an (Vorlauf aus den Einstellungen) — immer für ALLE Fristen.
//        ?space=business (05.10.): nur die Business-Gesellschaften, serverseitig gefiltert (die Selbstständigkeit gehört zu Privat);
//        ohne/`privat`: alles (Privat sieht Business). Einkommen- und Gewerbesteuer der Selbstständigkeit aus der Finanzplanung.
// POST { einstellungen: {…} }             → Einstellungen ändern
//      { abhaken: { key, an: true|false } } → Frist oder Übergabe-Punkt abhaken
// Nur der Haushalt des Inhabers und der Dienstweg. Hinweis, keine Steuerberatung.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { steuernStand, speichereSteuern, steuerAufgabenAbgleichen } from '@/lib/steuern/speicher';
import { businessSchreibenErlaubt } from '@/lib/steuern/rechnen';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';

/**
 * Welche Sicht gilt (05.10.)? Business, wenn die Anfrage aus dem Business-Bereich kommt (`?space=business`) ODER das Konto kein
 * Privat-Recht hat (`finanzRecht: 'business'`, wie in der Finanzplanung `planZugangFuer`) — die Adresse kann ein Recht nie aufheben.
 */
async function sichtFuer(req: Request, person: string): Promise<'privat' | 'business'> {
  if (new URL(req.url).searchParams.get('space') === 'business') return 'business';
  return (await planZugangFuer(person))?.sicht === 'business' ? 'business' : 'privat';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Steuern — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const bereich = await sichtFuer(req, wer.person);
  const { alleFristen, ...st } = await steuernStand(undefined, bereich);
  const aufgaben = await steuerAufgabenAbgleichen(alleFristen, st.heute).catch(() => ({ neu: 0, erledigt: 0 }));
  return NextResponse.json({ ok: true, ...st, aufgaben }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  // Business-Sicht (05.10.): nie Privates oder die Selbstständigkeit schreiben — serverseitig, nicht nur in der Oberfläche.
  if ((await sichtFuer(req, wer.person)) === 'business') {
    const grund = businessSchreibenErlaubt(b);
    if (grund) return NextResponse.json({ ok: false, fehler: grund }, { status: 403 });
  }
  const r = await speichereSteuern(b, wer.person);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
