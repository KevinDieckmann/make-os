// ─── JSON-Körper mit Größengrenze lesen (05.10., Paket „Zugang & Schlüssel härten“ Punkt 8) ──────────────────
// Next begrenzt Route-Handler nicht: `await req.json()` puffert jeden Körper ganz in den Speicher — ein einzelner
// Aufruf mit ein paar hundert MB brächte die App (1280 MB Grenze) zum Absturz. `jsonBegrenzt(req, n)` ist der Ersatz
// für `req.json()` in JEDER Route:
//   · Content-Length über der Grenze → sofort `AnfrageZuGross` (nichts gelesen),
//   · ohne/mit falscher Länge (chunked) → gelesen wird höchstens bis zur Grenze, dann abgebrochen,
//   · sonst wie `req.json()` (leerer/kaputter Körper → SyntaxError, wie bisher → die 400 der Route).
// In der Route: `try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? <bisherige 400>; }`
// → 413 mit einem Satz. Standard 1 MB; Routen, die ganze Bestände, Bilder oder Importe annehmen, geben ihre Grenze
// mit (eigene `zuGross`-Grenze bzw. `JSON_GROSS`).

import { NextResponse } from 'next/server';

/** Standard für kleine Schnittstellen (Formulare, Einstellungen, einzelne Datensätze). */
export const JSON_GRENZE = 1_000_000;
/** Für Routen, die ganze Bestände, Importe oder Bilder als JSON schicken (wie /api/state/tasks seit 26.09.). */
export const JSON_GROSS = 20 * 1024 * 1024;

export class AnfrageZuGross extends Error {
  readonly status = 413;
  constructor(readonly grenze: number) { super(`Anfrage zu groß (höchstens ${grenzeText(grenze)}).`); }
}

const grenzeText = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10} MB` : `${Math.round(n / 1000)} KB`);

/** Wie `req.json()`, aber mit Obergrenze in Bytes. Wirft `AnfrageZuGross` (→ 413) oder SyntaxError (→ 400). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ersatz für req.json(), das ebenfalls any liefert
export async function jsonBegrenzt<T = any>(req: Request, max: number = JSON_GRENZE): Promise<T> {
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > max) throw new AnfrageZuGross(max);
  if (!req.body) return JSON.parse('') as T;
  const leser = req.body.getReader();
  const teile: Uint8Array[] = [];
  let summe = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    summe += value.byteLength;
    if (summe > max) { await leser.cancel().catch(() => {}); throw new AnfrageZuGross(max); }
    teile.push(value);
  }
  const alles = new Uint8Array(summe);
  let pos = 0;
  for (const t of teile) { alles.set(t, pos); pos += t.byteLength; }
  return JSON.parse(new TextDecoder().decode(alles)) as T;
}

/** Im catch einer Route: 413-Antwort, wenn die Grenze überschritten war — sonst null (dann gilt die bisherige 400). */
export function jsonZuGross(e: unknown): NextResponse | null {
  if (!(e instanceof AnfrageZuGross)) return null;
  return NextResponse.json({ ok: false, error: e.message, fehler: e.message }, { status: 413 });
}
