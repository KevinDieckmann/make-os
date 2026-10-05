// ─── Art.-9-Einwilligung Gesundheit (05.10.) ────────────────────────────────────────────────────────────────────────
// GET  → eigener Stand (a/b/c), Texte, Fassung, Hinweis „bitte bestätigen“, eigener Nachweis (Ereignisse)
// POST { zweck: 'verarbeiten'|'ki'|'partner', an: boolean, fassung } → Erklärung anhängen (nie ändern)
// Nur die Person SELBST (Sitzung): der Dienstweg (ZOE, Takt, Arbeiter) und jede fremde Person → 403 — auch der Inhaber
// kann für niemanden einwilligen. Nachweis unveränderlich (lib/datenschutz/gesundheit-einwilligung.ts).

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { GESUNDHEIT_FASSUNG, GESUNDHEIT_TEXTE, GESUNDHEIT_ZWECKE, gesundheitErklaeren, gesundheitNachweis, gesundheitStandFuer } from '@/lib/datenschutz/gesundheit-einwilligung';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERSON = /^[a-z0-9-]{1,40}$/;
const NUR_SELBST = () => NextResponse.json({ ok: false, error: 'Einwilligen kann nur die Person selbst.' }, { status: 403 });

/** Die Person aus der SITZUNG — nie aus dem Dienstweg. */
function selbst(req: Request): string | null {
  if (istDienst(req)) return null;
  const p = req.headers.get('x-make-user');
  return p && PERSON.test(p) ? p : null;
}

export async function GET(req: Request) {
  const person = selbst(req);
  if (!person) return NUR_SELBST();
  const [stand, nachweis] = await Promise.all([gesundheitStandFuer(person), gesundheitNachweis(person)]);
  return NextResponse.json({
    ok: true, stand, fassung: GESUNDHEIT_FASSUNG,
    texte: GESUNDHEIT_ZWECKE.map(z => ({ zweck: z, ...GESUNDHEIT_TEXTE[z] })),
    nachweis,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const person = selbst(req);
  if (!person) return NUR_SELBST();
  if (zuGross(req, 8_000)) return ZU_GROSS(8_000);
  let b: { zweck?: unknown; an?: unknown; fassung?: unknown; person?: unknown };
  try { b = await jsonBegrenzt(req, 8_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Wer eine andere Person nennt, bekommt 403 — nicht still die eigene Erklärung.
  if (b.person !== undefined && b.person !== person) return NUR_SELBST();
  const r = await gesundheitErklaeren(person, b.zweck, b.an, b.fassung);
  if (!r.ok) {
    const text = r.fehler === 'fassung' ? 'Der Text hat sich geändert — bitte neu laden und erneut bestätigen.'
      : r.fehler === 'voraussetzung' ? '„An die KI geben“ braucht zuerst „In MAKE OS verarbeiten“; „Mit dem Partner teilen“ braucht beides.'
      : 'Unbekannte Einwilligung.';
    return NextResponse.json({ ok: false, error: text, fehler: r.fehler }, { status: r.fehler === 'zweck' ? 400 : 409 });
  }
  return NextResponse.json({ ok: true, stand: r.stand, neu: r.neu, nachweis: await gesundheitNachweis(person) });
}
