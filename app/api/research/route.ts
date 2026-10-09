// ─── MAKE OS — Research-Agent (read-only, autonom) ──────────────────────────
// Belegte Recherche mit Web-Suche. Read-only → braucht KEINE Freigabe.
// Anthropic Messages API + server-seitiges web_search-Tool.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askWithSearch, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = [
  'Du bist der Research-Agent in MAKE OS. Recherchiere die Frage gründlich mit Web-Suche und gib eine klare, BELEGTE Antwort auf Deutsch.',
  'Format: Markdown mit kurzen fetten Zwischenüberschriften + knappen Aufzählungen. Nenne die wichtigsten Quellen (Titel/Domain). Sei präzise, keine Floskeln, kein Startup-Sprech.',
  'Wenn du dir bei etwas nicht sicher bist, sag es offen — erfinde keine Fakten oder Zahlen.',
].join('\n');

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let payload: { query?: string };
  try { payload = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ reply: '', error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const query = (payload.query ?? '').trim();
  if (!query) return NextResponse.json({ reply: 'Sag mir, was ich recherchieren soll.' });

  if (!hasAnthropicKey()) return NextResponse.json({ reply: 'Mir fehlt der Anthropic-Key (.env.local), dann recherchiere ich mit Quellen für dich.', needsKey: true });
  const agent = await resolveAgent('research');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), reply: '' });

  const r2 = await askWithSearch({ zweck: 'research',
    // Pseudonymisieren ginge hier zu tief: der Suchauftrag IST das Thema (oft eine Firma/Person) — als offen gemeldet.
    ki: kiAus(req, ['allgemein'], { pseudonym: false }), system: SYSTEM, user: query, maxTokens: 5000, model: agent.model, timeoutMs: 120_000 });
  if (!r2.ok || !r2.text) return NextResponse.json({ reply: r2.error ?? 'Konnte gerade nicht recherchieren — versuch es nochmal.' });

  await logRun('research', query.slice(0, 120), { query, reply: r2.text.slice(0, 2000), webUsed: r2.webUsed }, { person: personStreng(req) });
  return NextResponse.json({ reply: r2.text, webUsed: r2.webUsed });
}
