// ─── Website — öffentliche Inhalte (31.10., der Vertrag mit der Website: WEBSITE_VERTRAG_INHALT.md) ─────────────────────────────────────
// GET → { ok, stand, angebote[], bausteine[], events[], faq[], fakten[], texte{}, bilder[{ id, url, alt }] } — nur sichtbare Einträge, nur öffentliche
// Felder (lib/website/regeln.ts `oeffentlicherInhalt`): keine Personen, keine Gäste, keine Kennungen interner Bestände außer der eigenen id. Ohne Sitzung
// offen (middleware.ts `WEBSITE_OEFFENTLICH`, nur GET/HEAD), handelt für niemanden (Köpfe gelöscht), schreibt nichts; gedrosselt je Netz, ETag + 304,
// zwischenspeicherbar fünf Minuten.

import { createHash } from 'node:crypto';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** So viele Abrufe je Netz und Viertelstunde frei (die Website fragt einmal je Seitenaufruf, der Browser hält fünf Minuten). */
const LESEN_FREI = 120;
const KOEPFE = { 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } as const;

export async function GET(req: Request) {
  const schluessel = `website-inhalt:${adresseNetz(req)}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return Response.json({ ok: false, fehler: 'Zu viele Abfragen.' }, { status: 429, headers: { ...KOEPFE, 'Cache-Control': 'no-store', 'Retry-After': String(p.warteSek) } });
  fehlschlag(schluessel, Date.now(), LESEN_FREI);
  const { websiteOeffentlich } = await import('@/lib/website/server');
  const inhalt = await websiteOeffentlich().catch(() => null);
  if (!inhalt) return Response.json({ ok: false, fehler: 'Gerade nicht verfügbar.' }, { status: 503, headers: { ...KOEPFE, 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  const text = JSON.stringify(inhalt);
  const etag = `"${createHash('sha256').update(text).digest('base64url').slice(0, 27)}"`;
  const kopf = { ...KOEPFE, 'Cache-Control': 'public, max-age=300', ETag: etag, 'Content-Type': 'application/json; charset=utf-8' };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: kopf });
  return new Response(text, { status: 200, headers: kopf });
}
