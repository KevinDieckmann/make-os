// ─── MAKE OS — Social: ein Medium für die Plattform abholen (öffentlich, kurzlebig) — 28.10.2026 ─────────────────────────────────────
// Instagram holt Bild/Video selbst (lib/social/medien-link.ts). Ohne Sitzung offen (middleware.ts `SOCIAL_MEDIEN_LINK`, nur GET/HEAD), handelt für
// niemanden (Köpfe gelöscht); gedrosselt je Netz bei Fehlversuchen. Liefert nur das Original EINES Mediums, solange es für „Social Media“
// freigegeben ist — sonst immer dieselbe 404 ohne Text. Nie Metadaten, nie eine Liste.
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { linkAufloesen } from '@/lib/social/medien-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nichts = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

async function liefern(req: Request, token: string, kopfNur: boolean): Promise<Response> {
  const netz = `social-link:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return nichts();
  const mediumId = await linkAufloesen(token).catch(() => null);
  if (!mediumId) { fehlschlag(netz); return nichts(); }
  const { socialMedienLesen } = await import('@/lib/social/medien');
  const m = (await socialMedienLesen([mediumId])).get(mediumId);
  if (!m || m.geloescht || m.status !== 'freigegeben' || !m.social || (m.art === 'video' && m.ton === 'nicht-freigegeben')) return nichts();
  const { inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
  const inhaber = await inhaberSpeicher().catch(() => null);
  if (!inhaber) return nichts();
  const { inhaltLesen } = await import('@/lib/medien/upload-server');
  const r = await inhaltLesen(inhaber, mediumId, 'original', req.headers.get('range'), null).catch(() => null);
  if (!r?.ok) return nichts();
  const kopf: Record<string, string> = {
    'Content-Type': r.inhalt.kopf['Content-Type'], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex',
    'Accept-Ranges': 'bytes', ...(r.inhalt.kopf['Content-Length'] ? { 'Content-Length': r.inhalt.kopf['Content-Length'] } : {}),
    ...(r.inhalt.kopf['Content-Range'] ? { 'Content-Range': r.inhalt.kopf['Content-Range'] } : {}),
    ...(r.ki ? { 'X-KI-Generiert': '1' } : {}),
  };
  if (kopfNur) { await r.inhalt.strom?.cancel().catch(() => {}); return new Response(null, { status: r.inhalt.status, headers: kopf }); }
  return new Response(r.inhalt.strom, { status: r.inhalt.status, headers: kopf });
}

// HEAD beantwortet Next selbst über GET (ohne Körper) — eine Methode, ein Weg.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) { return liefern(req, (await ctx.params).token, req.method === 'HEAD'); }
