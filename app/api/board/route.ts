// ─── MAKE OS — Reporting-/Board-Agent ───────────────────────────────────────
// Aggregiert Controlling + Prospecting + Aufgaben zu einem Board-/Wochen-Pack.
// Kennzahlen deterministisch in JS, das Narrativ (Lage, Risiken, Fokus) von der
// KI. Read-only Synthese über die anderen Agenten.

import { NextResponse } from 'next/server';
import { logRun } from '@/lib/agent-log';
import { loadJson } from '@/lib/store/local-db';
import { gatherBrain } from '@/lib/brain';
import { personAus } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProspectLite { status?: string; score?: number; company?: string; }
interface TaskLite { title?: string; status?: string; priority?: string; dueDate?: string; }

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let p: { finance?: FinanceState; prospects?: ProspectLite[]; tasks?: TaskLite[]; today?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }

  // Server-seitig aus dem Brain — der Browser ist nicht mehr der Datenlieferant.
  // POST-Body bleibt als Override erlaubt (Tests), sonst gilt das Brain.
  const brain = await gatherBrain(undefined, personAus(req));
  const fin = p.finance ?? brain.finance ?? undefined;
  const prospects = Array.isArray(p.prospects) && p.prospects.length ? p.prospects : brain.prospects;
  let tasks: TaskLite[];
  if (Array.isArray(p.tasks) && p.tasks.length) {
    tasks = p.tasks;
  } else {
    // Privat bleibt privat — Filter jetzt SERVER-seitig: nur business-Projekte.
    const store = await loadJson<{ tasks: (TaskLite & { projectId?: string })[]; projects: { id: string; category?: string }[] }>('tasks');
    const businessIds = new Set((store?.projects ?? []).filter(x => x.category === 'business').map(x => x.id));
    tasks = (store?.tasks ?? []).filter(t => t.projectId && businessIds.has(t.projectId));
  }
  const today = p.today && /^\d{4}-\d{2}-\d{2}$/.test(p.today) ? p.today : localDay();

  // ── Deterministische Kennzahlen ──
  const m = fin ? computeMetrics(fin) : null;
  const scored = prospects.filter(x => typeof x.score === 'number');
  const pipeline = {
    total: prospects.length,
    hot: prospects.filter(x => (x.score ?? 0) >= 80).length,
    qualifiziert: prospects.filter(x => x.status === 'qualifiziert').length,
    kontaktiert: prospects.filter(x => x.status === 'kontaktiert').length,
    avgScore: scored.length ? Math.round(scored.reduce((a, x) => a + (x.score ?? 0), 0) / scored.length) : 0,
  };
  const open = tasks.filter(t => t.status !== 'done');
  const taskStats = {
    open: open.length,
    critical: open.filter(t => t.priority === 'critical').length,
    inProgress: open.filter(t => t.status === 'in-progress').length,
    blocked: open.filter(t => t.status === 'blocked').length,
    overdue: open.filter(t => t.dueDate && t.dueDate < today).length,
  };

  const stats = {
    finance: m ? {
      fortschritt: Math.round(m.fortschritt * 100), istUmsatz: m.istUmsatz, gewinn: m.istGewinn,
      runRateNoetig: m.runRateNoetig, runway: m.runwayMonate, aktiv: m.aktiveMonate > 0,
      zielUmsatz: fin!.zielUmsatz, zielGewinn: fin!.zielGewinn,
    } : null,
    pipeline, tasks: taskStats,
  };

  if (!hasAnthropicKey()) return NextResponse.json({ headline: 'Kein Anthropic-Key — Kennzahlen stehen.', stats, sektionen: [], risiken: [], naechsteWoche: [] });
  const agent = await resolveAgent('board');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), headline: '', stats, sektionen: [], risiken: [], naechsteWoche: [] });

  const critList = open.filter(t => t.priority === 'critical').slice(0, 8).map(t => `- ${t.title} [${t.status}${t.dueDate ? `, fällig ${t.dueDate}` : ''}]`).join('\n') || '(keine)';

  const context = [
    `Stichtag: ${today}. Nordstern: 1 Mio € Umsatz KD Ventures → min. 300k € Gewinn (Kevin & Malin).`,
    '',
    'CONTROLLING:',
    m && stats.finance?.aktiv
      ? `Ist-Umsatz ${eur(m.istUmsatz)} (${stats.finance.fortschritt}%), Gewinn ${eur(m.istGewinn)}, nötige Run-Rate ${eur(m.runRateNoetig)}/Monat, Runway ${m.runwayMonate != null ? m.runwayMonate.toFixed(1) + ' Monate' : 'n/a'}.`
      : 'Noch keine Ist-Zahlen gepflegt (Controlling leer).',
    '',
    `PIPELINE (Prospecting): ${pipeline.total} Firmen, ${pipeline.hot} starker Fit (80+), ${pipeline.qualifiziert} qualifiziert, ${pipeline.kontaktiert} kontaktiert, Ø-Score ${pipeline.avgScore}.`,
    '',
    `AUSFÜHRUNG (Aufgaben): ${taskStats.open} offen, davon ${taskStats.critical} kritisch, ${taskStats.inProgress} in Arbeit, ${taskStats.blocked} blockiert, ${taskStats.overdue} überfällig.`,
    `Kritische Aufgaben:\n${critList}`,
  ].join('\n');

  const system = [
    'Du bist der Reporting-/Board-Agent in Kevins MAKE OS. Erzeuge ein knappes, ehrliches Board-/Wochen-Pack.',
    'Du bekommst FERTIGE Kennzahlen — rechne nicht neu, erfinde nichts. Nüchtern, Klartext, kein Startup-Sprech.',
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"headline":"<1-2 Sätze Executive Summary: wo steht die Woche wirklich>","sektionen":[{"titel":"Umsatz & Kurs","punkte":["...", "..."]},{"titel":"Pipeline","punkte":["..."]},{"titel":"Ausführung","punkte":["..."]}],"risiken":["<Risiko>", "..."],"naechsteWoche":["<konkreter Fokus 1>", "..."]}',
    'Je Sektion 2-4 Punkte, max 4 Risiken, 3 Fokus-Punkte für nächste Woche. Beziehe dich auf die echten Zahlen/Aufgaben.',
  ].join('\n');

  const r = await askJson<{ headline?: string; sektionen?: unknown[]; risiken?: string[]; naechsteWoche?: string[] }>({ zweck: 'board', system, user: context, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ headline: r.error ?? 'Analyse gerade nicht möglich — Kennzahlen stehen.', stats, sektionen: [], risiken: [], naechsteWoche: [] });

  const out = {
    headline: r.data.headline ?? '',
    sektionen: Array.isArray(r.data.sektionen) ? r.data.sektionen.slice(0, 5) : [],
    risiken: Array.isArray(r.data.risiken) ? r.data.risiken.slice(0, 5) : [],
    naechsteWoche: Array.isArray(r.data.naechsteWoche) ? r.data.naechsteWoche.slice(0, 4) : [],
  };
  await logRun('board', `Board-Pack ${today}`, { headline: out.headline, risiken: out.risiken, naechsteWoche: out.naechsteWoche, stats });
  return NextResponse.json({ ...out, stats });
}
