// ─── MAKE OS — Kapazität (04.10.) ───────────────────────────────────────────
// GET   → { stand, bezuege, ich, inhaber } — je Person und Woche verfügbar/verplant, Team-Wochen (Last, Engpässe), Machbarkeit je
//          Meilenstein/Ziel, Zuweisungen, Kennzahlen. Serverseitig gefiltert (lib/kapazitaet/modell.ts `fuerBetrachter`):
//          Erholung und Ausnahme-Titel sieht nur die Person selbst, alle anderen nur den Team-Faktor.
// PATCH { ops: KapaOp[] } → Grundwert, Ausnahmen (Urlaub, feste Blöcke), Zuweisungen (Mandat/Kunde, h/Woche).
//          Die eigene Kapa oder — als Inhaber — die des Teams; sonst 403 (lib/kapazitaet/aendern.ts).
// GET ?auskunft=<person> → Art. 15 (DSGVO-Nachtrag 04.10.): Kopie der Kapazitätsdaten als JSON-Datei — auch einer deaktivierten
//          Team-Person (bis zur Löschung 30 Tage nach dem Deaktivieren). Eigene Daten: die Person selbst (Konto). Team-Personen
//          ohne Konto: nur der Inhaber. Die Daten eines anderen Kontos (Ausnahme-Titel, Einwilligung) nie → 403. Unbekannt → 404.
// Nur der Haushalt des Inhabers mit Person (Sitzung oder Dienstweg mit x-make-person) — Testkunden/andere Haushalte 403.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { zuGross } from '@/lib/zugang/umfang';
import { kapaStandFuer, kapaSchreiben, kapaIdVon, kapaAuskunftLaden } from '@/lib/kapazitaet/server';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Die Kapazität gehört zum Haushalt des Inhabers.' } as const;

export async function GET(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const auskunft = new URL(req.url).searchParams.get('auskunft');
  if (auskunft !== null) return auskunftAntwort(auskunft, wer.person);
  const [{ stand, bezuege }, inhaber] = await Promise.all([kapaStandFuer(wer.person), istInhaber(wer.person)]);
  return NextResponse.json({ ok: true, ich: kapaIdVon(wer.person), inhaber, stand, bezuege }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Art. 15: eigene Daten (Konto) oder — als Inhaber — die einer Team-Person ohne Konto. */
async function auskunftAntwort(id: string, person: string): Promise<Response> {
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) return NextResponse.json({ ok: false, fehler: 'Unbekannte Person.' }, { status: 400 });
  const r = await kapaAuskunftLaden(id);
  if (!r) return NextResponse.json({ ok: false, fehler: 'Diese Person gibt es im Team nicht.' }, { status: 404 });
  const selbst = id === kapaIdVon(person);
  if (r.konto ? !selbst : !(await istInhaber(person))) {
    return NextResponse.json({ ok: false, fehler: r.konto ? 'Die Auskunft über ein Konto bekommt nur die Person selbst.' : 'Die Auskunft über eine Team-Person gibt der Inhaber.' }, { status: 403 });
  }
  return new NextResponse(JSON.stringify(r.auskunft, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="kapazitaet-auskunft-${id}-${localDay()}.json"`, 'Cache-Control': 'no-store' },
  });
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
