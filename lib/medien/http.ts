// ─── Medien — kleine Helfer der Routen (09.10., Paket 5) ─────────────────────────────────────────────────────────────────
// Rohkörper begrenzt lesen (Stücke, Vorschauen, Belege — nie mehr als die Grenze im Speicher; über der Grenze 413, nie gekürzt) und
// Fehler als JSON mit Satz (`fehler` + `error`, wie überall).

import { NextResponse } from 'next/server';
import { AnfrageZuGross } from '@/lib/zugang/json-grenze';

export { AnfrageZuGross };

/** Rohkörper lesen, höchstens `max` Byte — sonst `AnfrageZuGross` (→ 413). */
export async function rohBegrenzt(req: Request, max: number): Promise<Buffer> {
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > max) throw new AnfrageZuGross(max);
  if (!req.body) return Buffer.alloc(0);
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
  return Buffer.concat(teile.map(t => Buffer.from(t.buffer, t.byteOffset, t.byteLength)));
}

export const fehler = (status: number, text: string) => NextResponse.json({ ok: false, fehler: text, error: text }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Ergebnis einer Server-Funktion als Antwort (`ok: false` → Status + Satz). */
export function antwort(r: { ok: boolean; status?: number; fehler?: string } & Record<string, unknown>): NextResponse {
  if (!r.ok) return fehler(r.status ?? 400, r.fehler ?? 'Fehler.');
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}
