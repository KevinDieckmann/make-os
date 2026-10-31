// ─── Unterlage herunterladen — der Link aus der Mail (31.10.) ───────────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `unterlageOffen`, auch als Navigation aus einem Mail-Programm — vor `crossSiteVerboten`). Handelt nie als
// Person, schreibt nichts. GET ?t=<token>&d=pdf|xlsx → die Datei als Download (attachment, nosniff, no-store, noindex, CSP sandbox).
// Token zustandslos und signiert (lib/unterlagen/server.ts `tokenPruefen`: Kennung + Ablauf, nie die Adresse). Abgelaufen → 410, falsch → 404 — je
// eine kleine Seite mit dem Weg zur Seite der Unterlage. Drossel je Netz; falsche Tokens zählen wie Fehlversuche.

import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { ARTEN, INHALTSTYP, anhangKopf, linkSeite } from '@/lib/unterlagen/regeln';
import { dateiLesen, tokenPruefen, unterlageVon } from '@/lib/unterlagen/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Downloads je Netz und Viertelstunde frei; falsche Tokens zählen zusätzlich. */
const LADEN_FREI = 60;
const FALSCH_FREI = 10;
const SEITE_KOPF = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const seite = (status: number, abgelaufen: boolean, pfad: string | null) => new Response(linkSeite({ abgelaufen, seite: pfad }), { status, headers: SEITE_KOPF });

export async function GET(req: Request) {
  const netz = adresseNetz(req);
  for (const k of [`unterlage-laden:${netz}`, `unterlage-falsch:${netz}`]) {
    const p = pruefe(k);
    if (!p.erlaubt) return new Response('Zu viele Versuche auf einmal — bitte gleich noch einmal.', { status: 429, headers: { 'Retry-After': String(p.warteSek), 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  fehlschlag(`unterlage-laden:${netz}`, Date.now(), LADEN_FREI);
  const q = new URL(req.url).searchParams;
  const t = tokenPruefen(q.get('t'));
  const art = ARTEN.find(a => a === q.get('d'));
  // Die Seite der Unterlage nur aus dem Katalog (eine Vermutung aus einem falschen Token zeigt höchstens den Weg dorthin).
  const u = await unterlageVon(t.id).catch(() => null);
  if (!t.ok) {
    if (t.grund === 'ungueltig') fehlschlag(`unterlage-falsch:${netz}`, Date.now(), FALSCH_FREI);
    return seite(t.grund === 'abgelaufen' ? 410 : 404, t.grund === 'abgelaufen', u?.seite ?? null);
  }
  if (!u || !art) return seite(404, false, u?.seite ?? null);
  const d = await dateiLesen(u, art);
  if (!d) return seite(404, false, u.seite);
  return new Response(new Uint8Array(d.inhalt), {
    status: 200,
    headers: {
      'Content-Type': INHALTSTYP[art], 'Content-Disposition': anhangKopf(d.name), 'Content-Length': String(d.inhalt.length),
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
