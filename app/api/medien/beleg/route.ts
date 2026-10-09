// ─── Medien: Belege — Lizenz-Nachweis fremder Fotografen, Unterschrift einer Einwilligung (09.10., Paket 5) ───────────────────
// POST ?id=<md-…>&name=<Dateiname>   Lizenz-Nachweis (PDF/JPEG/PNG ≤ 8 MB, roh) — Pflicht vor jeder Freigabe eines fremden Fotos (Kevin 09.10.)
// GET  ?art=lizenz&id=<md-…>          Nachweis herunterladen (wer das Medium sieht)
// GET  ?art=unterschrift&id=<ew-…>    Unterschrift ansehen (wer freigeben darf, und die Person selbst, deren Einwilligung es ist — Art. 15)
//                                     — beides als Download, nosniff, Sandbox
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';
import { leseZugriff, leseKennung } from '@/lib/store/leseprotokoll';
import { GRENZEN } from '@/lib/medien/typen';
import { lizenzAblegen, belegLesen } from '@/lib/medien/upload-server';
import { antwort, fehler, rohBegrenzt, AnfrageZuGross } from '@/lib/medien/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const art = q.get('art') ?? '', id = q.get('id') ?? '';
  if (!/^(md|ew)-[0-9a-z-]{8,60}$/.test(id)) return fehler(400, 'Kennung fehlt.');
  const r = await belegLesen(z.person, art, id).catch(() => ({ ok: false as const, status: 500, fehler: 'Beleg nicht lesbar.' }));
  if (!r.ok) return fehler(r.status, r.fehler);
  if (art === 'unterschrift') leseZugriff(req, 'medien', { ids: [leseKennung(id)] });
  const name = r.name.replace(/[^\p{L}\p{N} ._-]/gu, '_');
  return new Response(new Uint8Array(r.bytes), { headers: {
    'Content-Type': r.typ, 'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`, 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store',
  } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (!/^md-[0-9a-f-]{36}$/.test(id)) return fehler(400, 'Kennung fehlt.');
  try {
    return antwort(await lizenzAblegen(z.person, id, q.get('name') ?? 'nachweis', await rohBegrenzt(req, GRENZEN.beleg)) as Parameters<typeof antwort>[0]);
  } catch (e) {
    if (e instanceof AnfrageZuGross) return fehler(413, 'Nachweis höchstens 8 MB.');
    console.error('[medien] Beleg:', e instanceof Error ? e.message : e);
    return fehler(500, 'Der Nachweis konnte nicht gespeichert werden.');
  }
}
