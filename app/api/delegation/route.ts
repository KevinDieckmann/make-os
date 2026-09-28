// ─── MAKE OS — Delegations-Loop ─────────────────────────────────────────────
// Kevins Kernwunsch: „so gut wie nichts mehr selbst machen müssen." ZOE
// geht alle offenen Aufgaben durch und schlägt je Aufgabe vor: bleibt bei
// Kevin (nur was WIRKLICH nur er kann) oder geht an die richtige Person aus
// dem Team (Miro-Verantwortungen). Kevin übernimmt per Klick — Human-in-the-
// Loop, es wird nichts automatisch verschickt.
// PRIVATSPHÄRE: Nur business-Projekte gehen in den Prompt; joint (MAKE.One)
// ist ausschließlich für Malin delegierbar; Gesundheit/Privat NIE (fail-closed).
// TEAM (28.09., U4): Namen und Kurzwörter kommen zur Laufzeit aus `team--<haushalt>`
// (lib/make-one/team-speicher.ts) — nie aus dem Code; leerer Speicher → Rollen-Platzhalter.

import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { teamFuerAnfrage } from '@/lib/make-one/team-speicher';
import { delegierbar, personZuKurz, teamZeilenAus } from '@/lib/make-one/team-typen';
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

interface DelegationRunde { zeit: string; vorschlaege: Vorschlag[]; privatAnzahl: number }
const RUNDE = 'delegation-runde';

/** Die letzte abgelegte Runde (höchstens 7 Tage alt) — für die Aufgaben-Seite. */
export async function GET() {
  const r = await loadJson<DelegationRunde>(RUNDE);
  const frisch = r && Date.now() - Date.parse(r.zeit) < 7 * 864e5 ? r : null;
  return NextResponse.json({ ok: true, runde: frisch }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  // Hintergrundlauf (ZOE, Takt) legt die Runde ab — die Aufgaben-Seite zeigt sie dann als „von ZOE“ (27.09.).
  let ablegen = false;
  try { ablegen = (await req.json())?.ablegen === true; } catch { /* ohne Rumpf: nicht ablegen */ }
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

  const team = await teamFuerAnfrage(req);
  const empfaenger = delegierbar(team);
  const kurznamen = empfaenger.map(t => t.kurz);
  // MAKE.One (Kevin & Malin privat) geht nur an Malin — ihr Konto, egal welches Kurzwort sie im Team trägt.
  const privatKurz = empfaenger.find(t => t.speicher === 'malin')?.kurz;
  const system = [
    'Du bist ZOE und entlastest Kevin radikal: Er behält NUR, was wirklich nur er kann (finale Entscheidungen, Sales-Definition, C-Level-Beziehungen, seine eigene Gesundheit). Alles andere wird delegiert.',
    'TEAM & VERANTWORTUNG (delegiere entlang dieser Zuständigkeiten):',
    ...teamZeilenAus(team).map(z => `- ${z}`),
    'REGELN:',
    `- "an" MUSS einer dieser Kurznamen sein: ${kurznamen.join(', ')}.`,
    privatKurz ? `- Aufgaben aus MAKE.One (unten als [MAKE.One] markiert) dürfen NUR an ${privatKurz} gehen — oder bleiben.` : '- Aufgaben aus MAKE.One (unten als [MAKE.One] markiert) bleiben.',
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
      // Harte Leitplanken: nur echte Team-Kurznamen (Schreibweise aus den Daten); MAKE.One nur an Malin.
      an = an ? personZuKurz(empfaenger, an)?.kurz : undefined;
      if (jointIds.has(String(v.taskId)) && an && an !== privatKurz) an = privatKurz;
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

  if (ablegen) await updateJson<DelegationRunde>(RUNDE, () => ({ zeit: new Date().toISOString(), vorschlaege, privatAnzahl })).catch(() => { /* Runde nur im Lauf-Text */ });
  return NextResponse.json({ vorschlaege, privatAnzahl, abgelegt: ablegen });
}
