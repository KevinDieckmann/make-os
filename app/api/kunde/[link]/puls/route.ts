// ─── Kunden-Link — Kunden-Puls (öffentlich; Fulfillment C2, 10.10. — kommt AUSGESCHALTET; FULFILLMENT_KONZEPT.md 5.5) ──────────────────────────────
// POST { wert: 0–10, satz?: ≤ 500 Zeichen, stempel, webseite } — mit dem Puls-Token (`x-kunde-puls`, öffnet NUR diesen Weg) oder dem Link-Token mit
// Recht „Puls“, und nur, solange eine Anfrage offen ist (eine Antwort je Anfrage, sonst 409). Sonst dieselbe 404. Je Link ≤ 5 je Tag (429).
// Ein Wert bis zur Schwelle (Vorgabe 6, einstellbar) → neutrale Glocke an die zuständige Person (ohne Wert) + Stapel-Vorschlag „Gespräch anbieten“.

import { kundeZugriff, antwortOeffentlich } from '@/lib/fulfillment/kunde/oeffentlich';
import { pulsKunde } from '@/lib/fulfillment/kunde/server';
import { formularPruefen } from '@/lib/fulfillment/kunde/token';
import { bremse } from '@/lib/fulfillment/kunde/bremse';
import { jsonBegrenzt, AnfrageZuGross } from '@/lib/zugang/json-grenze';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ link: string }> }) {
  const link = (await ctx?.params?.catch(() => null))?.link;
  const z = await kundeZugriff(req, link, 'puls');
  if (z instanceof Response) return z;
  let roh: Record<string, unknown>;
  try {
    const j = await jsonBegrenzt<unknown>(req, MAX_BYTES);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new SyntaxError();
    roh = j as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AnfrageZuGross) return antwortOeffentlich({ ok: false, fehler: 'Der Satz ist zu lang.' }, 413);
    return antwortOeffentlich({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);
  }
  const falle = formularPruefen(z.link.id, roh.stempel, roh.webseite);
  if (falle) return antwortOeffentlich({ ok: false, fehler: falle }, 400);
  const b = bremse('puls', z.link.id);
  if (!b.erlaubt) return antwortOeffentlich({ ok: false, fehler: 'Heute schon genug Rückmeldungen — danke!' }, 429, { 'Retry-After': String(b.warteSek) });
  const r = await pulsKunde(z, roh);
  return antwortOeffentlich(r.body, r.status);
}
