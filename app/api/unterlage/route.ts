// ─── Unterlage per E-Mail anfordern — die öffentliche Schnittstelle (31.10.) ─────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `unterlageOffen`: nur GET/POST /api/unterlage und GET /api/unterlage/laden). Handelt nie als Person.
// Das Formular steht auf der statischen Website (fokusinnovation.de, Caddy leitet /api/unterlage* an die App).
// GET  ?id=<kennung>  → { ok, aktiv, titel, newsletter: { wortlaut, fassung } | null, hinweis: { zeilen, link } } — unbekannt → 404.
// POST { id, vorname, email, firma?, newsletter?, newsletterFassung?, webseite (Honigtopf, leer) }
//      → IMMER dieselbe Antwort { ok: true, text } — egal ob die Adresse bekannt, gesperrt, eingeschränkt oder über der Grenze ist; die Arbeit
//        (Mail mit Download-Links, Anfrage im CRM, Newsletter-Anmeldung) läuft NACH der Antwort (lib/unterlagen/server.ts `anforderungVerarbeiten`).
// Aktiv nur mit Website-Absender (verbunden), Verantwortlichem und Adresse der Website (lib/oeffentlich/website-post.ts `websiteLage`) — sonst
// `aktiv: false` und POST 404 (die Website zeigt dann einen Ersatz). Schutz: Drossel je Netz (Lesen großzügig, Anfordern knapp), Grenze je Adresse
// (3 Mails je Tag, dieselbe Antwort), Honigtopf, Körper ≤ 8 KB (413), Fassung des Newsletter-Wortlauts muss zur Seite passen (409).

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { emailSauber, vornameSauber, zeileSauber } from '@/lib/newsletter/regeln';
import { ANFORDERUNG_TEXT, NICHT_DA_TEXT, UNTERLAGE_ID_OK, unterlageHinweis } from '@/lib/unterlagen/regeln';
import { KatalogKaputt, anforderungVerarbeiten, unterlageVon } from '@/lib/unterlagen/server';
import { nachDerAntwort, websiteLage } from '@/lib/oeffentlich/website-post';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const UNBEKANNT = { ok: false, fehler: 'Diese Unterlage gibt es nicht.' };
const KAPUTT = { ok: false, fehler: 'Die Unterlagen sind gerade nicht verfügbar — bitte später noch einmal.' };
/** Honigtopf: derselbe Text wie bei Check und Newsletter — verrät nicht, was auffiel. */
const NICHT_ANGENOMMEN = { ok: false, fehler: 'Das hat leider nicht geklappt. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.' };
/** Lesen je Netz und Viertelstunde frei (jede Seite einer großen Vorlage fragt einmal). */
const LESEN_FREI = 120;
/** Anforderungen je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const ANFORDERN_FREI = 6;

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche auf einmal — bitte in ${Math.max(1, Math.ceil(p.warteSek / 60))} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

async function unterlageLaden(id: unknown) {
  if (typeof id !== 'string' || !UNTERLAGE_ID_OK.test(id)) return { u: null };
  try { return { u: await unterlageVon(id) }; } catch (x) { if (x instanceof KatalogKaputt) return { u: null, kaputt: true }; throw x; }
}

export async function GET(req: Request) {
  const netz = adresseNetz(req);
  const g = gedrosselt(`unterlage-lesen:${netz}`); if (g) return g;
  fehlschlag(`unterlage-lesen:${netz}`, Date.now(), LESEN_FREI);
  const { u, kaputt } = await unterlageLaden(new URL(req.url).searchParams.get('id'));
  if (kaputt) return antwort(KAPUTT, 503);
  if (!u) return antwort(UNBEKANNT, 404);
  const lage = await websiteLage();
  if (!lage) return antwort({ ok: true, aktiv: false, titel: u.titel, newsletter: null, hinweis: { zeilen: [], link: null }, text: NICHT_DA_TEXT });
  // Newsletter-Häkchen nur, wenn die Anmeldung der Instanz läuft — mit genau dem Wortlaut, der als Einwilligung gespeichert wird.
  const { newsletterBereit } = await import('@/lib/newsletter/server');
  const nl = await newsletterBereit().catch(() => null);
  return antwort({
    ok: true, aktiv: true, titel: u.titel,
    newsletter: nl ? { wortlaut: nl.wortlaut, fassung: nl.fassung } : null,
    hinweis: { zeilen: unterlageHinweis(lage.verantwortlich, lage.datenschutzLink), link: lage.datenschutzLink },
  });
}

export async function POST(req: Request) {
  const netz = adresseNetz(req);
  const g = gedrosselt(`unterlage:${netz}`); if (g) return g;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (x) { return jsonZuGross(x) ?? antwort({ ok: false, fehler: 'Kein JSON.' }, 400); }
  fehlschlag(`unterlage:${netz}`, Date.now(), ANFORDERN_FREI);
  const { u, kaputt } = await unterlageLaden(b.id);
  if (kaputt) return antwort(KAPUTT, 503);
  if (!u) return antwort(UNBEKANNT, 404);
  const lage = await websiteLage();
  if (!lage) return antwort({ ok: false, fehler: NICHT_DA_TEXT }, 404);
  if (typeof b.webseite === 'string' && b.webseite.trim()) return antwort(NICHT_ANGENOMMEN, 400);
  const email = emailSauber(b.email);
  if (!email) return antwort({ ok: false, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
  const vorname = vornameSauber(b.vorname);
  if (vorname === null) return antwort({ ok: false, fehler: 'Bitte im Vornamen nur Buchstaben verwenden (höchstens 60).' }, 400);
  if (!vorname) return antwort({ ok: false, fehler: 'Bitte Ihren Vornamen angeben.' }, 400);
  const firma = zeileSauber(b.firma, 120);
  if (firma === null) return antwort({ ok: false, fehler: 'Bitte die Firma in einer Zeile, höchstens 120 Zeichen.' }, typeof b.firma === 'string' && b.firma.length > 120 ? 413 : 400);
  // Newsletter (wie im Check): das Häkchen gilt nur mit der Fassung des Wortlauts, die die Seite gezeigt hat — sonst neu laden.
  const { newsletterBereit } = await import('@/lib/newsletter/server');
  const nl = b.newsletter === true ? await newsletterBereit().catch(() => null) : null;
  if (b.newsletter === true && (!nl || b.newsletterFassung !== nl.fassung)) return antwort({ ok: false, fehler: 'Der Text zum Newsletter hat sich geändert. Bitte laden Sie die Seite neu.' }, 409);
  nachDerAntwort(() => anforderungVerarbeiten({ email, vorname, firma, newsletter: !!nl }, u, lage), 'unterlagen');
  return antwort({ ok: true, text: ANFORDERUNG_TEXT });
}
