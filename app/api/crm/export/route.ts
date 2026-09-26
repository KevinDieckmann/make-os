// ─── CRM — Exporte als CSV ──────────────────────────────────────────────────
// GET ?was=kontakte|firmen|deals|followups|mandate  (ohne `was`: kontakte —
// so bleibt der alte Link „Kartei als CSV“ gültig). Aufbau der Tabellen in
// lib/crm/export.ts (rein, getestet): UTF-8 mit BOM, Semikolon, deutsche
// Spaltenköpfe, Datum ISO. Ohne Privatnotiz, ohne Verlauf; gesperrte Personen
// stehen mit Markierung drin, damit eine Werbeliste sie ausschließen kann —
// nie stillschweigend weglassen.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { EXPORTE, exportCsv, exportDateiname, istExportArt } from '@/lib/crm/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const was = new URL(req.url).searchParams.get('was') ?? 'kontakte';
  if (!istExportArt(was)) return NextResponse.json({ ok: false, fehler: `was: ${EXPORTE.join(' | ')}` }, { status: 400 });
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  return new Response(exportCsv(was, { kontakte, crm }), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${exportDateiname(was, localDay())}"`, 'Cache-Control': 'no-store' },
  });
}
