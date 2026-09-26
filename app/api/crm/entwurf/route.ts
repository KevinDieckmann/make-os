// ─── MAKE OS — Entwurf für einen Kontakt ────────────────────────────────────
// POST { id } → Betreff, E-Mail, LinkedIn-Nachricht. Kein Versand.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { hasAnthropicKey } from '@/lib/anthropic';
import { entwurfFuer } from '@/lib/ansprache';
import type { Kontakt } from '@/lib/make-one/crm';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let b: { id?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === String(b.id ?? ''));
  if (!k) return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 });
  const r = await entwurfFuer(k);
  if (!r.ok) return NextResponse.json({ error: r.fehler }, { status: 200 });
  return NextResponse.json(r.entwurf);
}
