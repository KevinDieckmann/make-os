// ─── CRM — Marketing ────────────────────────────────────────────────────────
// GET                                   → { ok, heute, einstellung, kennzahlen, stimmen }
// GET ?segment=<id>&format=csv          → Mitglieder des Segments als CSV (UTF-8 mit BOM):
//                                         name, firma, email (nur bei grüner Mail-Ampel),
//                                         telefon, kreis, phase, kanal_status
// GET ?newsletter=empfaenger&format=csv → nur Double-Opt-in: name, email
// POST { aktion: 'einstellung', einstellung } → Positionierung, ICP, Ton, Säulen speichern
//
// Nie in einer Antwort: Privatnotizen, Personen mit Werbesperre. Versendet
// wird nichts — der Export ist für Kevins eigenes Versandwerkzeug.
// Die Rechnung steckt in lib/crm/marketing.ts (rein, getestet).

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { kontextAus } from '@/lib/crm/segmente';
import { marketingKennzahlen, einstellungAus, saeubereEinstellung, stimmenAus, segmentCsv, newsletterCsv, dateiTeil } from '@/lib/crm/marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const csvAntwort = (inhalt: string, datei: string) => new Response(inhalt, {
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${datei}"`, 'Cache-Control': 'no-store' },
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const format = url.searchParams.get('format');
  const segmentId = url.searchParams.get('segment');

  if (segmentId !== null) {
    if (format !== 'csv') return NextResponse.json({ ok: false, fehler: 'Nur format=csv.' }, { status: 400 });
    const s = crm.segmente.find(x => x.id === segmentId);
    if (!s) return NextResponse.json({ ok: false, fehler: 'Segment nicht gefunden.' }, { status: 404 });
    return csvAntwort(segmentCsv(kontakte, s.kriterien, kontextAus(crm, heute)), `MAKE-OS-Segment-${dateiTeil(s.name)}-${heute}.csv`);
  }
  if (url.searchParams.get('newsletter') !== null) {
    if (url.searchParams.get('newsletter') !== 'empfaenger' || format !== 'csv') return NextResponse.json({ ok: false, fehler: 'Nur newsletter=empfaenger&format=csv.' }, { status: 400 });
    return csvAntwort(newsletterCsv(kontakte), `MAKE-OS-Newsletter-Empfaenger-${heute}.csv`);
  }

  return NextResponse.json({
    ok: true, heute,
    einstellung: einstellungAus(crm),
    kennzahlen: marketingKennzahlen(kontakte, crm, heute),
    stimmen: stimmenAus(kontakte, 30),
  });
}

export async function POST(req: Request) {
  let body: { aktion?: unknown; einstellung?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (body?.aktion !== 'einstellung') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  const einstellung = saeubereEinstellung(body.einstellung);
  const b = await aendereCrm(cur => ({ ...cur, marketing: einstellung }));
  return NextResponse.json({ ok: true, einstellung: einstellungAus(b) });
}
