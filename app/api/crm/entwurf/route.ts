// ─── MAKE OS — Entwurf für einen Kontakt ────────────────────────────────────
// POST { id } → Betreff, E-Mail, LinkedIn-Nachricht. Kein Versand.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { hasAnthropicKey } from '@/lib/anthropic';
import { entwurfFuer } from '@/lib/ansprache';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const agentCfg = await resolveAgent('crm'); if (!agentCfg.enabled) return NextResponse.json(disabledResponse(agentCfg), { status: 409 });
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let b: { id?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  // Art. 18 zentral (29.09.): kein Entwurf für eingeschränkte Personen.
  const k = (await kontakteFuerVerarbeitung()).find(x => x.id === String(b.id ?? ''));
  if (!k) return NextResponse.json({ error: 'Kontakt nicht gefunden oder Verarbeitung eingeschränkt (Art. 18).' }, { status: 404 });
  const r = await entwurfFuer(k);
  if (!r.ok) return NextResponse.json({ error: r.fehler }, { status: 200 });
  return NextResponse.json(r.entwurf);
}
