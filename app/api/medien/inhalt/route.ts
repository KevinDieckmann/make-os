// ─── Medien: Inhalt ansehen und abspielen (09.10., Paket 5) ─────────────────────────────────────────────────────────────────
// GET ?id=<md-…>&v=raster|ansicht|poster|original[&download=1] — nur, wer das Medium sieht (dieselbe Filterstelle wie die Liste).
// Original mit Range (206, `Accept-Ranges`, `Content-Range` — Safari spielt Videos nur so), entschlüsselt Segment für Segment als Strom.
// Vorschaubilder verschlüsselt im Speicher, im Browser privat zwischengespeichert (ETag, `Cache-Control: private`), das Original nie.
// Video mit nicht freigegebenem Ton: das Original wird nie ausgeliefert (403 mit Satz). Original mit Personen → Lese-Protokoll.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';
import { leseZugriff, leseKennung } from '@/lib/store/leseprotokoll';
import { VARIANTEN, type Variante } from '@/lib/medien/typen';
import { inhaltLesen } from '@/lib/medien/upload-server';
import { fehler } from '@/lib/medien/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  const v = (VARIANTEN.find(x => x === q.get('v')) ?? 'raster') as Variante;
  if (!/^md-[0-9a-f-]{36}$/.test(id)) return fehler(400, 'Kennung fehlt.');
  let r: Awaited<ReturnType<typeof inhaltLesen>>;
  try { r = await inhaltLesen(z.person, id, v, req.headers.get('range'), req.headers.get('if-none-match')); }
  catch (e) { console.error('[medien] Inhalt:', e instanceof Error ? e.message : e); return fehler(500, 'Das Medium lässt sich gerade nicht öffnen.'); }
  if (!r.ok) return fehler(r.status, r.fehler);
  if (v === 'original' && r.mitPersonen) leseZugriff(req, 'medien', { ids: [leseKennung(id)] });
  const kopf = { ...r.inhalt.kopf, ...(q.get('download') === '1' ? { 'Content-Disposition': `attachment; filename="${id}.${r.inhalt.kopf['Content-Type'].split('/')[1].replace('quicktime', 'mov').replace('jpeg', 'jpg')}"` } : { 'Content-Disposition': 'inline' }) };
  return new Response(r.inhalt.strom, { status: r.inhalt.status, headers: kopf });
}
