// ─── CRM — Exporte als CSV ──────────────────────────────────────────────────
// GET ?was=kontakte|firmen|deals|followups|mandate  (ohne `was`: kontakte —
// so bleibt der alte Link „Kartei als CSV“ gültig). Aufbau der Tabellen in
// lib/crm/export.ts (rein, getestet): UTF-8 mit BOM, Semikolon, deutsche
// Spaltenköpfe, Datum ISO. Ohne Privatnotiz, ohne Verlauf; gesperrte Personen
// stehen mit Markierung drin, damit eine Werbeliste sie ausschließen kann —
// nie stillschweigend weglassen. Eingeschränkte Personen (Art. 18) fehlen
// standardmäßig (29.09.); `&mitEingeschraenkten=1` nimmt sie markiert auf (Auskunft).

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { localDay } from '@/lib/zeit';
import { ladeCrm } from '@/lib/crm/speicher';
import { EXPORTE, exportCsv, exportDateiname, istExportArt } from '@/lib/crm/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const url = new URL(req.url);
  const was = url.searchParams.get('was') ?? 'kontakte';
  if (!istExportArt(was)) return NextResponse.json({ ok: false, fehler: `was: ${EXPORTE.join(' | ')}` }, { status: 400 });
  const mitEingeschraenkten = url.searchParams.get('mitEingeschraenkten') === '1';
  const kontakte = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }); // der Filter sitzt in exportCsv (auch für Follow-ups)
  const crm = await ladeCrm();
  return new Response(exportCsv(was, { kontakte, crm, heute: localDay(), mitEingeschraenkten }), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${exportDateiname(was, localDay())}"`, 'Cache-Control': 'no-store' },
  });
}
