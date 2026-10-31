// ─── Homepage-Funde — interne Vorschau eines Funds (HTML, 30.10.2026) ────────────────────────────────────────────────────────
// GET ?id=<fund> → die Vorschau als ganze Seite mit Banner „Interne Vorschau — noch nicht freigegeben“ (öffnet im neuen Fenster).
// Nur Haushalt des Inhabers; keine Skripte, alles maskiert (lib/funde/vorschau.ts), nicht zwischenspeichern, nicht indexieren.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { ladeFunde, fundeHaushalt } from '@/lib/funde/speicher';
import { vorschauHtml } from '@/lib/funde/vorschau';
import { fundKontext } from '@/lib/funde/kontext';
import { OSM_NAMENSNENNUNG } from '@/lib/funde/osm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const h = await fundeHaushalt();
  const b = await ladeFunde(h);
  const f = b.funde.find(x => x.id === id);
  if (!f || !f.vorschau) return NextResponse.json({ ok: false, fehler: 'Diese Vorschau gibt es nicht (mehr).' }, { status: 404 });
  leseZugriff(req, 'firmen', { anzahl: 1 });
  const ctx = await fundKontext(b.einstellungen, h);
  const html = vorschauHtml(f, f.vorschau, { absender: ctx.absender, intern: true, ...(f.quelle === 'osm' ? { namensnennung: OSM_NAMENSNENNUNG } : {}) });
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
}
