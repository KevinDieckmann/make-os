// ─── MAKE OS — Delegations-Loop ─────────────────────────────────────────────
// Kevins Kernwunsch: „so gut wie nichts mehr selbst machen müssen." Jarvis
// geht alle offenen Aufgaben durch und schlägt je Aufgabe vor: bleibt bei
// Kevin (nur was WIRKLICH nur er kann) oder geht an die richtige Person aus
// dem Team (Miro-Verantwortungen). Kevin übernimmt per Klick — Human-in-the-
// Loop, es wird nichts automatisch verschickt.
// PRIVATSPHÄRE: Nur business-Projekte gehen in den Prompt; joint (MAKE.One)
// ist ausschließlich für Malin delegierbar; Gesundheit/Privat NIE (fail-closed).

import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { loadJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { TEAM, teamZeilen } from '@/lib/make-one/team-data';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StoredTask { id: string; title: string; description?: string; status: string; priority: string; dueDate?: string; projectId?: string; assignee?: string }
interface StoredProject { id: string; category?: string }
interface TasksFile { tasks: StoredTask[]; projects: StoredProject[] }

export interface Vorschlag {
  taskId: string;
  titel: string;
  empfehlung: 'abgeben' | 'bleibt';
  an?: string;
  warum: string;
  uebergabe?: string;
}

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  if (!sperren('delegation')) return NextResponse.json({ error: 'Die Delegations-Runde läuft gerade schon — einen Moment.' }, { status: 200 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('task');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const f = await loadJson<TasksFile>('tasks');
  const projekte = new Map((f?.projects ?? []).map(p => [p.id, p.category ?? '']));
  const offen = (f?.tasks ?? []).filter(t => t.status !== 'done' && t.assignee !== 'malin');
  // Fail-closed: nur business in den Prompt; joint (MAKE.One) separat — nur Malin.
  const business = offen.filter(t => projekte.get(t.projectId ?? '') === 'business');
  const joint = offen.filter(t => projekte.get(t.projectId ?? '') === 'joint');
  const privatAnzahl = offen.length - business.length - joint.length;
  if (!business.length && !joint.length) {
    return NextResponse.json({ vorschlaege: [], privatAnzahl, hinweis: 'Keine delegierbaren Aufgaben offen.' });
  }

  const kurznamen = TEAM.filter(t => t.kurz !== 'Kevin').map(t => t.kurz);
  const system = [
    'Du bist JARVIS und entlastest Kevin radikal: Er behält NUR, was wirklich nur er kann (finale Entscheidungen, Sales-Definition, C-Level-Beziehungen, seine eigene Gesundheit). Alles andere wird delegiert.',
    'TEAM & VERANTWORTUNG (delegiere entlang dieser Zuständigkeiten):',
    ...teamZeilen().map(z => `- ${z}`),
    'REGELN:',
    `- "an" MUSS einer dieser Kurznamen sein: ${kurznamen.join(', ')}.`,
    '- Aufgaben aus MAKE.One (unten als [MAKE.One] markiert) dürfen NUR an Malin gehen — oder bleiben.',
    '- Sei mutig: Im Zweifel abgeben. Kevin will fast nichts mehr selbst machen.',
    '- "uebergabe" = 1–2 Sätze, die Kevin der Person wörtlich schicken kann (konkret: was, bis wann, was Fertig heißt).',
    'Antworte NUR als JSON: {"vorschlaege":[{"taskId":"…","empfehlung":"abgeben|bleibt","an":"Kurzname (nur bei abgeben)","warum":"1 kurzer Satz","uebergabe":"nur bei abgeben"}]} — für JEDE übergebene Aufgabe genau ein Eintrag.',
  ].join('\n');

  const zeile = (t: StoredTask, marker = '') =>
    `- [${t.id}]${marker} ${t.title} (${t.priority}${t.dueDate ? `, fällig ${t.dueDate}` : ''}${t.assignee === 'both' ? ', bisher Kevin+Malin' : ''})${t.description ? ` — ${t.description.slice(0, 120)}` : ''}`;
  const user = [
    'OFFENE AUFGABEN:',
    ...business.slice(0, 20).map(t => zeile(t)),
    ...joint.slice(0, 6).map(t => zeile(t, ' [MAKE.One]')),
  ].join('\n');

  const r = await askJson<{ vorschlaege?: Partial<Vorschlag>[] }>({ zweck: 'delegation', system, user, maxTokens: 6000, model: agent.model, timeoutMs: 150_000 });
  if (!r.ok || !Array.isArray(r.data?.vorschlaege)) {
    return NextResponse.json({ error: r.error ?? 'Keine Vorschläge erhalten.' }, { status: 200 });
  }

  const erlaubt = new Set([...business, ...joint].map(t => t.id));
  const titelVon = new Map([...business, ...joint].map(t => [t.id, t.title]));
  const jointIds = new Set(joint.map(t => t.id));
  const vorschlaege: Vorschlag[] = r.data.vorschlaege
    .filter(v => v.taskId && erlaubt.has(String(v.taskId)))
    .map(v => {
      const abgeben = v.empfehlung === 'abgeben';
      let an = abgeben ? String(v.an ?? '').trim() : undefined;
      // Harte Leitplanken: nur echte Team-Kurznamen; MAKE.One nur an Malin.
      if (an && !kurznamen.includes(an)) an = undefined;
      if (jointIds.has(String(v.taskId)) && an && an !== 'Malin') an = 'Malin';
      return {
        taskId: String(v.taskId),
        titel: titelVon.get(String(v.taskId)) ?? '',
        empfehlung: abgeben && an ? 'abgeben' as const : 'bleibt' as const,
        an,
        warum: String(v.warum ?? '').slice(0, 200),
        uebergabe: v.uebergabe ? String(v.uebergabe).slice(0, 400) : undefined,
      };
    });

  const abgabe = vorschlaege.filter(v => v.empfehlung === 'abgeben').length;
  await logRun('task', `Delegations-Runde: ${abgabe} von ${vorschlaege.length} abgebbar`, { abgabe, gesamt: vorschlaege.length, privatAusgeblendet: privatAnzahl });

  return NextResponse.json({ vorschlaege, privatAnzahl });
}
