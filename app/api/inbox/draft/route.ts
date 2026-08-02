// ─── MAKE OS — Inbox-Agent: Antwort-Entwurf ─────────────────────────────────
// Jarvis schreibt eine Antwort in Kevins Stimme. NUR Entwurf — Versand macht
// Kevin selbst (öffnet in Apple Mail). Läuft über die gemeinsame KI-Schicht;
// die fremde Mail geht als DATEN in den Prompt (Injection-Schutz).

import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let p: { sender?: string; senderEmail?: string; subject?: string; body?: string; hint?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ draft: '', error: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (!hasAnthropicKey()) return NextResponse.json({ draft: '', needsKey: true, error: 'Kein Anthropic-Key hinterlegt (.env.local).' });
  const agent = await resolveAgent('inbox');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), draft: '' });

  const system = [
    'Du schreibst eine E-Mail-Antwort im Namen von Kevin Dieckmann — Gründer der KEMARIS Innovation Group / Produkt POINCAP / Holding KD Ventures.',
    FREMD_REGEL,
    'Stimme: souverän, klar, freundlich-direkt. Deutsch — außer der Absender schreibt englisch, dann englisch.',
    'Kurz und konkret. Kein Startup-Sprech; NIEMALS: Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting.',
    'Wenn Infos fehlen, halte die Antwort bewusst offen/rückfragend statt zu erfinden.',
    'Gib NUR den Mailtext aus — mit Anrede und Abschluss „Beste Grüße\\nKevin". Kein Betreff, keine Erklärungen, keine Meta-Kommentare.',
  ].join('\n');

  const message = [
    'Eingegangene Mail:',
    fremd('apple-mail', [
      `Von: ${p.sender ?? 'Unbekannt'}${p.senderEmail ? ` <${p.senderEmail}>` : ''}`,
      `Betreff: ${p.subject ?? '(kein Betreff)'}`,
      '',
      (p.body ?? '(kein Inhalt verfügbar)').slice(0, 4000),
    ].join('\n')),
    '',
    p.hint ? `Kevins Hinweis für die Antwort: ${p.hint}` : 'Schreibe eine passende, knappe Antwort.',
  ].join('\n');

  const r = await askText({ system, user: message, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.text) return NextResponse.json({ draft: '', error: r.error ?? 'Konnte gerade keinen Entwurf schreiben — nochmal versuchen.' });
  return NextResponse.json({ draft: r.text });
}
