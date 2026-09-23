// ─── MAKE OS — Prospecting-Agent: KI-Qualifizierung ─────────────────────────
// Bewertet einen Prospect gegen das ICP: Score 0–100 + Fit-Begründung + Aufhänger.
// Nutzt die gemeinsame KI-Schicht (Timeout, Retry, robustes JSON).

import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProspectIn { company?: string; domain?: string; industry?: string; size?: string; region?: string; }

export async function POST(req: Request) {
  let payload: { prospect?: ProspectIn; icp?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const p = payload.prospect ?? {};
  const icp = (payload.icp ?? '').trim();
  if (!p.company) return NextResponse.json({ error: 'Kein Unternehmen angegeben.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key (.env.local).', needsKey: true });

  // Deine Einstellungen aus /os/agenten gelten wirklich.
  const agent = await resolveAgent('prospect');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const system = [
    'Du bist der Prospecting-Agent in Kevins MAKE OS und qualifizierst Firmen gegen ein ideales Kundenprofil (ICP) für "POINCAP".',
    'Bewerte NÜCHTERN und ehrlich. Wenn du eine Firma nicht kennst, leite den Fit aus Branche/Größe/Region ab und sag das offen — erfinde keine Fakten.',
    'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, kein Fließtext, kein Markdown:',
    '{"score": <0-100 int>, "fit": "<1-2 Sätze: warum passt/passt nicht>", "angle": "<1 Satz: konkreter Aufhänger für die Erstansprache>"}',
    'score: Wie gut passt die Firma auf das ICP (Branche, Größe, wahrscheinliche Controlling-Schmerzen)? 80+ = starker Fit, 50-79 = prüfen, <50 = eher nein.',
    'Kein Startup-Sprech. Deutsch.',
  ].join('\n');

  const user = [
    `ICP:\n${icp || '(keins hinterlegt)'}`,
    '',
    'Zu bewertende Firma:',
    `- Name: ${p.company}`,
    p.domain ? `- Domain: ${p.domain}` : '',
    p.industry ? `- Branche: ${p.industry}` : '',
    p.size ? `- Größe: ${p.size}` : '',
    p.region ? `- Region: ${p.region}` : '',
  ].filter(Boolean).join('\n');

  // 2500 statt 500: extended thinking teilt sich das Budget mit der Antwort.
  const r = await askJson<{ score?: number; fit?: string; angle?: string }>({ zweck: 'prospecting-score', system, user, maxTokens: 2500, timeoutMs: 60_000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error ?? 'Keine Antwort.' });

  const score = Math.max(0, Math.min(100, Math.round(Number(r.data.score) || 0)));
  return NextResponse.json({ score, fit: r.data.fit ?? '', angle: r.data.angle ?? '', modell: agent.tier });
}
