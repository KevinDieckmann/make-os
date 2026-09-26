// ─── MAKE OS — Meeting-Agent ────────────────────────────────────────────────
// Transkript/Notizen rein → Zusammenfassung + Entscheidungen + Action-Items.
// Die Action-Items lassen sich (mit Freigabe) in echte Aufgaben übernehmen.
// Auto-Mitschrift (Granola/Fireflies) ist der spätere Zusatz.

import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { localDay } from '@/lib/zeit';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Kevins reale Projekte — der Agent ordnet Action-Items hier zu.
const PROJECTS = [
  { id: 'proj-ig', label: 'KEMARIS Innovation Group (IG)' },
  { id: 'proj-poincap', label: 'POINCAP — Produkt & Traktion' },
  { id: 'proj-kdm', label: 'KD Management (Holding)' },
  { id: 'proj-health', label: 'Gesundheit & Aufbau' },
  { id: 'proj-make', label: 'MAKE.One (Malin & Kevin)' },
  { id: 'proj-privat', label: 'Privat & Recht' },
];

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let payload: { transcript?: string; datum?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const transcript = (payload.transcript ?? '').trim();
  if (transcript.length < 20) return NextResponse.json({ error: 'Bitte Transkript oder Notizen einfügen (etwas mehr Text).' }, { status: 400 });
  const heute = payload.datum && /^\d{4}-\d{2}-\d{2}$/.test(payload.datum) ? payload.datum : localDay();

  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key (.env.local).', needsKey: true }, { status: 200 });
  const agent = await resolveAgent('meeting');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const system = [
    'Du bist der Meeting-Agent in Kevins MAKE OS. Aus einem Meeting-Transkript oder Notizen machst du ein sauberes Protokoll.',
    'Extrahiere NUR, was wirklich dasteht — erfinde keine Entscheidungen oder Aufgaben. Wenn etwas unklar ist, lass es weg.',
    'Kein Startup-Sprech. Deutsch, knapp, konkret.',
    `Ordne jedes Action-Item einem Projekt zu (projectId aus dieser Liste): ${PROJECTS.map(p => `${p.id} = ${p.label}`).join('; ')}. Wenn unklar: proj-kdm.`,
    `owner ist "kevin", "malin" oder "both". prio ist "low", "medium", "high" oder "critical". due nur wenn im Text ein Datum/Frist genannt ist (Format YYYY-MM-DD), sonst weglassen. HEUTE ist ${heute} — löse relative Angaben (heute, morgen, Mittwoch, nächste Woche) exakt auf dieses Datum und Jahr auf.`,
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"titel":"<kurzer Meeting-Titel>","zusammenfassung":"<3-5 Sätze>","entscheidungen":["<getroffene Entscheidung>", "..."],"actionItems":[{"titel":"<klare Aufgabe>","owner":"kevin","prio":"high","projectId":"proj-poincap","due":"2026-08-05"}]}',
  ].join('\n');

  const r = await askJson<{ titel?: string; zusammenfassung?: string; entscheidungen?: string[]; actionItems?: unknown[] }>({ zweck: 'meeting',
    system, user: transcript.slice(0, 24000), maxTokens: 4000, model: agent.model,
  });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error ?? 'Keine strukturierte Antwort.' }, { status: 200 });

  const validProjects = new Set(PROJECTS.map(p => p.id));
  const items = (Array.isArray(r.data.actionItems) ? r.data.actionItems : []).map((raw2) => {
    const it = raw2 as { titel?: string; owner?: string; prio?: string; projectId?: string; due?: string };
    return {
      titel: it.titel ?? '',
      owner: ['kevin', 'malin', 'both'].includes(it.owner ?? '') ? it.owner : 'kevin',
      prio: ['low', 'medium', 'high', 'critical'].includes(it.prio ?? '') ? it.prio : 'medium',
      projectId: validProjects.has(it.projectId ?? '') ? it.projectId : 'proj-kdm',
      due: it.due && /^\d{4}-\d{2}-\d{2}$/.test(it.due) ? it.due : undefined,
    };
  }).filter(x => x.titel);

  const out = {
    titel: r.data.titel ?? 'Meeting',
    zusammenfassung: r.data.zusammenfassung ?? '',
    entscheidungen: Array.isArray(r.data.entscheidungen) ? r.data.entscheidungen.slice(0, 8) : [],
    actionItems: items.slice(0, 20),
  };
  await logRun('meeting', out.titel, { zusammenfassung: out.zusammenfassung, entscheidungen: out.entscheidungen, actionItems: out.actionItems.length });
  return NextResponse.json(out);
}
