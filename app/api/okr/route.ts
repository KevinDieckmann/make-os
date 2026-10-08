// ─── MAKE OS — OKR-/Ziel-Agent ──────────────────────────────────────────────
// Klammert den Nordstern (1 Mio € KD Ventures → 300k Gewinn) mit den echten
// Zahlen (Controlling) und den echten Aufgaben zusammen: Objectives + Key
// Results, ordnet vorhandene Tasks zu und flaggt Lücken. Read-only Synthese.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { logRun } from '@/lib/agent-log';
import { gatherBrain } from '@/lib/brain';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TaskLite { title?: string; status?: string; priority?: string; description?: string; }

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let payload: { finance?: FinanceState; tasks?: TaskLite[] };
  try { payload = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Server-seitig aus dem Brain; Body bleibt optionaler Override.
  // Sicht-Prüfung 08.10.: das Brain der auslösenden Person (Sitzung bzw. `x-make-person` des Agentenlaufs) — vorher ohne
  // Person = Rückfall auf den Inhaber, und Malins ZOE bekam dessen „nur ich“-Aufgaben in den Zielbaum. Nur der Systemlauf
  // ohne Person rechnet für den Inhaber (Regel 5: kein fester Name).
  const person = personStreng(req) ?? await inhaberSpeicher();
  if (!person) return NextResponse.json({ ok: false, error: 'Keine Person.' }, { status: 401 });
  const brain = await gatherBrain(undefined, person);
  const fin = payload.finance ?? brain.finance ?? undefined;
  const tasks: TaskLite[] = Array.isArray(payload.tasks) && payload.tasks.length
    ? payload.tasks
    // Haushalts-Aufgaben (Stichwort „haushalt“) bleiben draußen — OKR-Ergebnisse können an Dritte gehen.
    : brain.tasks.offen.filter(t => !((t as { tags?: string[] }).tags ?? []).includes('haushalt')).map(t => ({ title: t.title, status: t.status, priority: t.priority }));

  if (!hasAnthropicKey()) return NextResponse.json({ lage: 'Kein Anthropic-Key hinterlegt.', objectives: [] });
  const agent = await resolveAgent('okr');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), lage: '', objectives: [] });

  const m = fin ? computeMetrics(fin) : null;
  const finText = fin && m
    ? [
        `Ziel: ${eur(fin.zielUmsatz)} Umsatz → ${eur(fin.zielGewinn)} Gewinn (KD Ventures).`,
        m.aktiveMonate > 0
          ? `Ist: ${eur(m.istUmsatz)} (${Math.round(m.fortschritt * 100)}%), Gewinn ${eur(m.istGewinn)}, Ø ${eur(m.runRateAktuell)}/Monat. Nötige Run-Rate: ${eur(m.runRateNoetig)}/Monat, ${m.restMonate} Monate übrig. Runway ${m.runwayMonate != null ? m.runwayMonate.toFixed(1) + ' Monate' : 'n/a'}.`
          : 'Ist-Zahlen noch nicht gepflegt (Controlling leer).',
      ].join('\n')
    : 'Noch keine Finanzdaten hinterlegt.';

  const taskText = tasks.length
    ? tasks.slice(0, 40).map(t => `- [${t.status ?? '?'}/${t.priority ?? '?'}] ${t.title ?? ''}${t.description ? ` — ${t.description.slice(0, 90)}` : ''}`).join('\n')
    : '(keine Aufgaben übergeben)';

  const system = [
    'Du bist der OKR-/Ziel-Agent in Kevins MAKE OS. Nordstern: 1 Mio € Umsatz bei KD Ventures → min. 300k € Gewinn für Kevin & Malin.',
    'Deine Aufgabe: aus Nordstern + echten Zahlen + echten Aufgaben eine klare OKR-Struktur bauen, die vorhandenen Aufgaben den Zielen zuordnen und LÜCKEN benennen (wo kein Task auf ein Key Result einzahlt).',
    'Nutze NUR die gegebenen Zahlen/Aufgaben — erfinde keine. Sei ehrlich, wenn der Kurs nicht reicht. Kein Startup-Sprech.',
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"lage":"<2-3 Sätze Gesamtlage zum Nordstern>","objectives":[{"titel":"<Objective>","warum":"<1 Satz>","keyResults":["<messbares KR mit Zielwert>", "..."],"hebelTasks":["<exakter Titel einer vorhandenen Aufgabe, die einzahlt>", "..."],"luecke":"<was fehlt / nächster konkreter Schritt>"}]}',
    'Max 4 Objectives, je 2-3 Key Results. hebelTasks nur aus der gegebenen Aufgabenliste (wörtlich), leeres Array wenn keine passt.',
  ].join('\n');

  const user = [`FINANZLAGE:\n${finText}`, '', `AUFGABEN (echt):\n${taskText}`].join('\n');

  const r = await askJson<{ lage?: string; objectives?: unknown[] }>({ zweck: 'okr', ki: kiAus(req, ['finanzen', 'aufgaben']), system, user, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ lage: r.error ?? 'Analyse gerade nicht möglich.', objectives: [] });

  const objectives = Array.isArray(r.data.objectives) ? r.data.objectives.slice(0, 4) : [];
  await logRun('okr', 'OKR-Zielbaum', { lage: r.data.lage, objectives });
  return NextResponse.json({ lage: r.data.lage ?? '', objectives, metrics: m });
}
