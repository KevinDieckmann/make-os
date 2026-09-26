// ─── MAKE OS — Umfang und Takt einer Anfrage (26.09.) ──────────────────────
// Zwei Schranken, die vor teurer Arbeit stehen: wie groß darf der Body sein,
// und wie oft darf eine Person das Modell bemühen. Beide antworten mit einem
// fertigen 413/429, damit Routen sie in einer Zeile nutzen können.

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { istDienst } from '@/lib/zugang/dienst';
import { modellErlaubt, MODELL_ZU_VIEL } from '@/lib/zugang/modell-drossel';

/** Body größer als erlaubt? (Content-Length; fehlt er, lässt Next den Body ohnehin puffern — dann gilt das Limit der Route.) */
export function zuGross(req: Request, maxBytes: number): boolean {
  const n = Number(req.headers.get('content-length') ?? '');
  return Number.isFinite(n) && n > maxBytes;
}
export const ZU_GROSS = (maxBytes: number) => NextResponse.json({ ok: false, error: `Anfrage zu groß (höchstens ${Math.round(maxBytes / 1_000_000)} MB).` }, { status: 413 });

/** Darf diese Person gerade das Modell rufen? Sonst ein fertiger 429. Der Dienstweg ohne Person (Takt) hat ein eigenes, weiteres Fenster. */
export function modellSchranke(req: Request, max?: number): NextResponse | null {
  const person = req.headers.get('x-make-user') || req.headers.get('x-make-person') || '';
  const schluessel = person && /^[a-z0-9-]{1,40}$/.test(person) ? person : istDienst(req) ? 'dienst' : personAus(req);
  const r = modellErlaubt(schluessel, max ?? (schluessel === 'dienst' ? 120 : 40));
  if (r.ok) return null;
  return NextResponse.json({ ok: false, error: MODELL_ZU_VIEL(r.warteSek), reply: MODELL_ZU_VIEL(r.warteSek) }, { status: 429, headers: { 'Retry-After': String(r.warteSek) } });
}
