// ─── Öffentliche Website-Vorschau eines Betriebs (30.10.2026, KAMPAGNE_HOMEPAGE_PLAN.md › 5) ───────────────────────────────────
// GET /vorschau/v1-<32 hex> — ohne Anmeldung (middleware.ts `VORSCHAU_OFFEN`, nur diese Token-Form, nur GET/HEAD). Es gibt den Link erst nach der
// Freigabe im ZOE-Stapel; im Bestand liegt nur sein Fingerabdruck. Abgelaufen, unbekannt oder Fund gesperrt → 404 (verrät nichts).
// Handelt für niemanden, liefert nur diese eine Seite: keine Skripte, keine fremden Quellen (eigene CSP), noindex, kein Referrer, gedrosselt
// je Netz. Der erste Aufruf vermerkt nur „angesehen am“ am Fund (kein Tracking, keine Adresse) — begründetes Schreiben beim Lesen.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { aendereFunde, fundeHaushalt, ladeFunde, vorschauTokenHash } from '@/lib/funde/speicher';
import { vorschauHtml } from '@/lib/funde/vorschau';
import { fundKontext } from '@/lib/funde/kontext';
import { OSM_NAMENSNENNUNG } from '@/lib/funde/osm';
import { VORSCHAU_TOKEN } from '@/lib/funde/typen';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOPF = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
const NICHT_DA = () => new NextResponse('<!doctype html><meta charset="utf-8"><title>Nicht gefunden</title><p style="font-family:system-ui;padding:24px">Diese Vorschau gibt es nicht (mehr).</p>', { status: 404, headers: KOPF });
/** So viele Aufrufe je Netz und Viertelstunde frei. */
const FREI = 60;

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!VORSCHAU_TOKEN.test(token)) return NICHT_DA();
  const schluessel = `fund-vorschau:${adresseNetz(req)}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return new NextResponse('Zu viele Aufrufe — bitte später noch einmal.', { status: 429, headers: { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(p.warteSek) } });
  fehlschlag(schluessel, Date.now(), FREI);
  const h = await fundeHaushalt();
  const b = await ladeFunde(h);
  const hash = vorschauTokenHash(token);
  const f = b.funde.find(x => x.vorschau?.tokenHash === hash);
  if (!f || !f.vorschau || f.status === 'gesperrt' || f.status === 'verworfen' || (f.vorschau.gueltigBis && f.vorschau.gueltigBis < localDay())) return NICHT_DA();
  if (!f.angesehenAm) {
    const am = new Date().toISOString();
    await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === f.id && !y.angesehenAm ? { ...y, angesehenAm: am } : y)) }), { h }).catch(() => null);
  }
  const k = await fundKontext(b.einstellungen, h);
  return new NextResponse(vorschauHtml(f, f.vorschau, { absender: k.absender, intern: false, ...(f.quelle === 'osm' ? { namensnennung: OSM_NAMENSNENNUNG } : {}) }), { headers: KOPF });
}
