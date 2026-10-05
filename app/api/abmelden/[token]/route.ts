// ─── Abmeldelink — Schnittstelle ohne Anmeldung (05.10., Betroffenenrechte v2; lib/datenschutz/abmelden.ts) ──────────────────
// POST /api/abmelden/<a1-…>  → abmelden (Knopf auf der Seite ODER One-Click nach RFC 8058 vom Mail-Anbieter, Körper
//                               „List-Unsubscribe=One-Click“ — der Körper wird nie gelesen). Antwort IMMER gleich, auch bei unbekannter
//                               Adresse, schon gesperrter Person oder Unsinn: { ok: true, text } — verrät nie, ob es die Adresse gibt.
// GET  /api/abmelden/<a1-…>  → 303 auf die Seite /abmelden/<a1-…> (ein Mail-Programm öffnet den List-Unsubscribe-Link im Browser).
// Ohne Sitzung (middleware.ts `ABMELDE_OFFEN`), handelt für niemanden; gedrosselt je Netz. Nie Daten in der Antwort.

import { NextResponse } from 'next/server';
import { ABMELDE_ANTWORT, ABMELDE_TOKEN } from '@/lib/datenschutz/abmelden';
import { abmeldenAnwenden } from '@/lib/datenschutz/abmelden-server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** So viele Abmeldungen je Netz und Viertelstunde frei (ein Büro mit vielen Empfängern), danach wächst die Wartezeit. */
const FREI = 30;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ziel = new URL(`/abmelden/${ABMELDE_TOKEN.test(token) ? token : ''}`, req.url);
  return NextResponse.redirect(ziel, { status: 303, headers: KOPF });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const schluessel = `abmelden:${adresseNetz(req)}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return NextResponse.json({ ok: false, text: `Gerade zu viele Anfragen — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, { status: 429, headers: { ...KOPF, 'Retry-After': String(p.warteSek) } });
  fehlschlag(schluessel, Date.now(), FREI);
  try { await abmeldenAnwenden(token); }
  catch (e) {
    // Auch ein Fehler verrät nichts über die Adresse — aber er wird laut (Server-Log), damit niemand still weiter Werbung bekommt.
    console.error('[abmelden] nicht angewendet:', e instanceof Error ? e.message.slice(0, 160) : e);
    return NextResponse.json({ ok: false, text: 'Das hat gerade nicht geklappt — bitte später noch einmal oder antworten Sie einfach auf die Mail.' }, { status: 503, headers: KOPF });
  }
  return NextResponse.json({ ok: true, text: ABMELDE_ANTWORT }, { headers: KOPF });
}
