// ─── Website — ein freigegebenes Bild (31.10., öffentlich) ─────────────────────────────────────────────────────────────────────────────
// GET /api/website/bild/wb-… → das Bild in der Ansichts-Größe (≤ 1568 px), NUR wenn es in Markttraktion › Website sichtbar ist (mit Alt-Text) UND das
// Medium für den Kanal „Website“ freigegeben ist (Medien-Ablage, Einwilligungen geprüft) — sonst immer dieselbe 404 ohne Text. Ohne Sitzung offen
// (middleware.ts `WEBSITE_BILD`, nur GET/HEAD), handelt für niemanden, schreibt nichts; Typ aus dem Medium (nur JPEG/PNG/WebP), nosniff, Größe begrenzt,
// gedrosselt je Netz bei Fehlversuchen. Nie Metadaten, nie eine Liste.

import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPEN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;
const nichts = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' } });

async function liefern(req: Request, id: string, kopfNur: boolean): Promise<Response> {
  const netz = `website-bild:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return nichts();
  const { ladeWebsiteInhalt, websiteMedien } = await import('@/lib/website/server');
  const { bildEintragOeffentlich } = await import('@/lib/website/regeln');
  const eintrag = bildEintragOeffentlich(await ladeWebsiteInhalt().catch(() => ({ bilder: [] })), id);
  if (!eintrag || !(await websiteMedien()).has(eintrag.medium)) { fehlschlag(netz); return nichts(); }
  const { inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
  const inhaber = await inhaberSpeicher().catch(() => null);
  if (!inhaber) return nichts();
  const { inhaltLesen } = await import('@/lib/medien/upload-server');
  const r = await inhaltLesen(inhaber, eintrag.medium, 'ansicht', null, null).catch(() => null);
  if (!r?.ok) return nichts();
  const typ = r.inhalt.kopf['Content-Type'];
  const laenge = Number(r.inhalt.kopf['Content-Length'] ?? 0);
  if (!TYPEN.has(typ) || laenge > MAX_BYTES) { await r.inhalt.strom?.cancel().catch(() => {}); return nichts(); }
  const kopf: Record<string, string> = {
    'Content-Type': typ, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-site',
    ...(laenge ? { 'Content-Length': String(laenge) } : {}), ...(r.ki ? { 'X-KI-Generiert': '1' } : {}),
  };
  if (kopfNur) { await r.inhalt.strom?.cancel().catch(() => {}); return new Response(null, { status: 200, headers: kopf }); }
  return new Response(r.inhalt.strom, { status: 200, headers: kopf });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return liefern(req, (await ctx.params).id, req.method === 'HEAD'); }
