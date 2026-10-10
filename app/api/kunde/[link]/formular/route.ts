// ─── Kunden-Link — Formular-Antworten (öffentlich; Fulfillment C2, 10.10. — kommt AUSGESCHALTET; FULFILLMENT_KONZEPT.md 5.4) ───────────────────────
// POST { formular: 'fo-…', antworten: { <frage>: text }, stand?, abschnitt?, fertig?, stempel, webseite } — nur mit `x-kunde-token` und Recht
// „Formular“ (sonst dieselbe 404). Dann: Körper ≤ 64 KB (413), Honigtopf `webseite` und Stempel (≥ 3 s, ≤ 12 h) mit DEMSELBEN Satz (400),
// je Link höchstens 120 Antworten je Stunde (429), Antwort je Frage ≤ 4.000 Zeichen (413), Stand des Formulars (409 — die Eingabe bleibt im Feld).
// Gespeichert wird im Bestand `fulfillment-kunde--<inhaber-haushalt>` über die eine Schreibstelle (Protokoll „System“, ohne Werte).

import { kundeZugriff, antwortOeffentlich } from '@/lib/fulfillment/kunde/oeffentlich';
import { formularKunde } from '@/lib/fulfillment/kunde/server';
import { formularPruefen } from '@/lib/fulfillment/kunde/token';
import { bremse } from '@/lib/fulfillment/kunde/bremse';
import { jsonBegrenzt, AnfrageZuGross } from '@/lib/zugang/json-grenze';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größter Körper (Formular-Abschnitt) — darüber 413. */
const MAX_BYTES = 64 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ link: string }> }) {
  const link = (await ctx?.params?.catch(() => null))?.link;
  const z = await kundeZugriff(req, link, 'formular');
  if (z instanceof Response) return z;
  if (z.art !== 'voll') return antwortOeffentlich({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, 404);
  let roh: Record<string, unknown>;
  try {
    const j = await jsonBegrenzt<unknown>(req, MAX_BYTES);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new SyntaxError();
    roh = j as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AnfrageZuGross) return antwortOeffentlich({ ok: false, fehler: 'Zu viel auf einmal — bitte Abschnitt für Abschnitt speichern.' }, 413);
    return antwortOeffentlich({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);
  }
  const falle = formularPruefen(z.link.id, roh.stempel, roh.webseite);
  if (falle) return antwortOeffentlich({ ok: false, fehler: falle }, 400);
  const b = bremse('formular', z.link.id);
  if (!b.erlaubt) return antwortOeffentlich({ ok: false, fehler: 'Gerade sehr viele Änderungen — bitte kurz warten.' }, 429, { 'Retry-After': String(b.warteSek) });
  const r = await formularKunde(z, roh);
  return antwortOeffentlich(r.body, r.status);
}
