// ─── MAKE OS — Fokus-/Entscheidungs-Agent ───────────────────────────────────
// Verrechnet Whoop-Recovery × Aufgaben-Last → die Tagesform. Der Doppelziel-
// Hebel: Firma + Gesundheit in EINER Empfehlung. Braucht ANTHROPIC_API_KEY.

import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { zoneOf, vitalsHint } from '@/lib/vitals';
import { gatherBrain, blockAufgaben } from '@/lib/brain';
import { personAus } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await gatherBrain(undefined, personAus(req));
  const v = b.vitals;
  const rec = v.rec;
  const zone = zoneOf(rec);

  if (!hasAnthropicKey()) {
    return NextResponse.json({ reply: 'Mir fehlt noch dein Anthropic-Key (.env.local), dann richte ich deinen Tag nach deiner Recovery aus.', recovery: rec, zone, needsKey: true });
  }
  const agent = await resolveAgent('fokus');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), reply: '', recovery: rec, zone });

  // Aufgaben kommen aus dem Brain — kein Mock-Fallback mehr: leer ist leer.
  const taskLines = blockAufgaben(b, 15);

  const system = [
    'Du bist der Fokus-/Entscheidungs-Agent in Kevins MAKE OS — der Agent, der Gesundheit UND Firma in einer Empfehlung zusammenbringt.',
    'Kernregel: die Recovery bestimmt die Tagesform.',
    '- GRÜN (Recovery ≥66): volle Kapazität → 2–3 harte Deep-Work-Blöcke (90 Min) auf die kritischste Aufgabe.',
    '- GELB (40–65): fokussiert, aber mit Puffer — weniger/ kürzere Blöcke, mehr Pausen.',
    '- ROT (<40): nur das Essentielle + Regeneration (NSDR, Reha, früher Feierabend). Nicht durchpowern.',
    'Kontext: Fokuszeit 09–17 schützen, Reha täglich, Spritze/Bandscheibe → spine-safe. Nordstern: mehr Ruhe + 1 Mio € Umsatz KD Ventures.',
    'Antworte auf Deutsch, kurz & strukturiert in Markdown mit genau diesen fetten Überschriften:',
    '**Tagesform** (1 Satz zur Recovery-Zone) · **Heute zuerst** (die EINE wichtigste Aufgabe) · **Zeitblöcke** (2–3 konkrete mit Uhrzeit) · **Heute bewusst NICHT** (was warten kann) · **Körper** (1 konkreter Reha-/Ruhe-Hinweis).',
    'Keine Textwände, keine Floskeln, kein Startup-Sprech. Souverän und klar.',
  ].join('\n');

  const message = `Recovery: ${rec}% (Zone ${zone})${vitalsHint(v)}. Ruhepuls ${v.rhr}, HRV ${v.hrv}, Schlaf letzte Nacht ${v.sleep}h.${v.note ? ` Kevin notiert: "${v.note}"` : ""}\n\n${taskLines}\n\nRichte meinen Tag aus.`;

  const r = await askText({ zweck: 'fokus', system, user: message, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.text) return NextResponse.json({ reply: r.error ?? 'Konnte gerade keinen Tagesplan erzeugen — nochmal versuchen.', recovery: rec, zone });

  await logRun('fokus', `Tagesform ${zone} (${rec}%)`, { zone, recovery: rec, reply: r.text.slice(0, 1500) });
  return NextResponse.json({ reply: r.text, recovery: rec, zone, stand: v.stand, heute: v.heute });
}
