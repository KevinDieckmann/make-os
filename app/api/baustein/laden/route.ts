// ─── Baustein herunterladen — der Link aus der Liefer-Mail (31.10.) ────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `bausteinOffen`, auch als Navigation aus einem Mail-Programm — vor `crossSiteVerboten`). Handelt nie als
// Person, schreibt keinen Bestand. GET ?t=<token>&b=<baustein>&d=pdf|xlsx → die Datei als Download (attachment, nosniff, no-store, noindex, CSP sandbox).
// Token zustandslos und signiert (lib/bausteine/server.ts `tokenPruefen`: Bestell-Kennung + Ablauf 30 Tage, nie die Adresse, eigener Zweck — ein
// Unterlagen-Token gilt hier nie). Geliefert nur, solange die Bestellung „geliefert“ ist und ihre Rechnung nicht storniert, nur Bausteine dieser
// Bestellung (Paket: seine Teile), nur Dateien aus dem Katalog im Ordner unterlagen/bausteine/. Abgelaufen → 410, falsch → 404 (kleine Seite mit
// „Schreiben Sie uns“). Drossel je Netz; falsche Tokens zählen wie Fehlversuche. Jeder gelungene Download steht im Lese-Protokoll (nur Kennungen).

import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { ARTEN, INHALTSTYP, anhangKopf, linkSeite } from '@/lib/bausteine/regeln';
import { dateiLesen, downloadZiel, tokenPruefen } from '@/lib/bausteine/server';
import { leseZugriffLauf } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Downloads je Netz und Viertelstunde frei; falsche Tokens zählen zusätzlich. */
const LADEN_FREI = 60;
const FALSCH_FREI = 10;
const SEITE_KOPF = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const seite = (status: number, abgelaufen: boolean) => new Response(linkSeite({ abgelaufen }), { status, headers: SEITE_KOPF });

export async function GET(req: Request) {
  const netz = adresseNetz(req);
  for (const k of [`baustein-laden:${netz}`, `baustein-falsch:${netz}`]) {
    const p = pruefe(k);
    if (!p.erlaubt) return new Response('Zu viele Versuche auf einmal — bitte gleich noch einmal.', { status: 429, headers: { 'Retry-After': String(p.warteSek), 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  fehlschlag(`baustein-laden:${netz}`, Date.now(), LADEN_FREI);
  const q = new URL(req.url).searchParams;
  const t = tokenPruefen(q.get('t'));
  if (!t.ok) {
    if (t.grund === 'ungueltig') fehlschlag(`baustein-falsch:${netz}`, Date.now(), FALSCH_FREI);
    return seite(t.grund === 'abgelaufen' ? 410 : 404, t.grund === 'abgelaufen');
  }
  const art = ARTEN.find(a => a === q.get('d'));
  const b = art ? await downloadZiel(t.id, q.get('b')).catch(() => null) : null;
  const d = b && art ? await dateiLesen(b, art) : null;
  if (!b || !art || !d) { fehlschlag(`baustein-falsch:${netz}`, Date.now(), FALSCH_FREI); return seite(404, false); }
  // Protokoll: nur Kennungen (Bestellung, Baustein, Art) — kein Name, keine Adresse, keine Netzadresse.
  leseZugriffLauf({ art: 'system' }, 'oeffentlich:baustein-laden', 'bausteine', { ids: [t.id, `${b.id}:${art}`] });
  return new Response(new Uint8Array(d.inhalt), {
    status: 200,
    headers: {
      'Content-Type': INHALTSTYP[art], 'Content-Disposition': anhangKopf(d.name), 'Content-Length': String(d.inhalt.length),
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
