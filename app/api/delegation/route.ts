// ─── MAKE OS — Delegations-Loop ─────────────────────────────────────────────
// Kernwunsch des Inhabers: „so gut wie nichts mehr selbst machen müssen." ZOE
// geht alle offenen Aufgaben des Inhabers durch und schlägt je Aufgabe vor: bleibt
// (nur was WIRKLICH nur der Inhaber kann) oder geht an die richtige Person aus
// dem Team. Übernommen wird per Klick — Human-in-the-Loop, es wird nichts
// automatisch verschickt.
// PRIVATSPHÄRE: Nur business-Projekte gehen in den Prompt; gemeinsame (joint) Projekte
// gehen nur an Personen mit Konto im Haushalt; Gesundheit/Privat NIE (fail-closed).
// TEAM (28.09., U4): Namen und Kurzwörter kommen zur Laufzeit aus `team--<haushalt>`
// (lib/make-one/team-speicher.ts) — nie aus dem Code; leerer Speicher → nur die Konten.
// 09.10. (Paket „neutral-rest“): kein fester Name mehr — Inhaber und Haushalts-Konten aus dem Team (Konto-Rolle).

import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, imHaushaltOderSystemlauf } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { teamFuerAnfrage } from '@/lib/make-one/team-speicher';
import { delegierbar, personZuKurz, teamZeilenAus } from '@/lib/make-one/team-typen';
import { modellSchranke } from '@/lib/zugang/umfang';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { ohnePrivatBereich } from '@/lib/aufgaben/bereich-sicht';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StoredTask { id: string; title: string; description?: string; status: string; priority: string; dueDate?: string; projectId?: string; assignee?: string }

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
export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const r = await loadJson<DelegationRunde>(RUNDE);
  const frisch = r && Date.now() - Date.parse(r.zeit) < 7 * 864e5 ? r : null;
  // EINE Konto-Sicht (09.10., E4): die Runde liegt für den ganzen Haushalt — sie zeigt nur Vorschläge zu Aufgaben, die die Person
  // sieht (ein Konto „nur Business“ keine aus dem Privat-Bereich, niemand fremde „nur ich“).
  const sichtbar = frisch ? new Set((await ladeAufgabenSicht(z.person)).tasks.map(t => t.id)) : null;
  const runde = frisch && sichtbar ? { ...frisch, vorschlaege: frisch.vorschlaege.filter(v => sichtbar.has(v.taskId)) } : null;
  return NextResponse.json({ ok: true, runde }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  // Hintergrundlauf (ZOE, Takt) legt die Runde ab — die Aufgaben-Seite zeigt sie dann als „von ZOE“ (27.09.).
  let ablegen = false;
  try { ablegen = (await jsonBegrenzt(req))?.ablegen === true; } catch { /* ohne Rumpf: nicht ablegen */ }
  const schranke = modellSchranke(req); if (schranke) return schranke;
  if (!sperren('delegation')) return NextResponse.json({ error: 'Die Delegations-Runde läuft gerade schon — einen Moment.' }, { status: 200 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('task');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  // Delegations-Runde geht an ein Modell und an Dritte: nie „nur ich“-Aufgaben (Systemsicht, 29.09.).
  // Löst ein Konto „nur Business“ die Runde aus (ZOE `run_agent` „task“), geht nichts aus dem Privat-Bereich hinein (09.10., E4).
  const [f0, team, ohnePrivat] = await Promise.all([ladeAufgabenSicht(null), teamFuerAnfrage(req), privatAusgeblendetFuer(personStreng(req))]);
  const f = ohnePrivat ? ohnePrivatBereich(f0) : f0;
  // Wer delegiert: der Inhaber laut Team (Konto-Rolle bzw. Haupt-Inhaber) — nie über einen Namen erkannt.
  const inhaber = team.find(p => p.inhaber && p.speicher);
  const projekte = new Map((f?.projects ?? []).map(p => [p.id, p.category ?? '']));
  // Kandidaten: offene Aufgaben des Inhabers bzw. gemeinsame (ohne Zuständigkeit/„both“) — Aufgaben anderer Personen nie.
  const offen = (f?.tasks ?? []).filter(t => t.status !== 'done' && (!t.assignee || t.assignee === 'both' || t.assignee === inhaber?.speicher));
  // Fail-closed: nur business in den Prompt; joint (gemeinsame Projekte) separat — nur Personen mit Konto im Haushalt.
  const business = offen.filter(t => projekte.get(t.projectId ?? '') === 'business');
  const joint = offen.filter(t => projekte.get(t.projectId ?? '') === 'joint');
  const privatAnzahl = offen.length - business.length - joint.length;
  if (!business.length && !joint.length) {
    return NextResponse.json({ vorschlaege: [], privatAnzahl, hinweis: 'Keine delegierbaren Aufgaben offen.' });
  }

  const empfaenger = delegierbar(team);
  const kurznamen = empfaenger.map(t => t.kurz);
  // Gemeinsame (joint) Projekte gehen nur an Personen mit Konto im Haushalt — egal welches Kurzwort sie im Team tragen.
  const haushaltKurze = empfaenger.filter(t => t.quelle === 'konto').map(t => t.kurz);
  const wer = inhaber?.kurz ?? 'die Person, die delegiert';
  const system = [
    `Du bist ZOE und entlastest ${wer} radikal: ${wer} behält NUR, was wirklich nur diese Person kann (finale Entscheidungen, Sales-Definition, C-Level-Beziehungen, die eigene Gesundheit). Alles andere wird delegiert.`,
    'TEAM & VERANTWORTUNG (delegiere entlang dieser Zuständigkeiten):',
    ...teamZeilenAus(team).map(z => `- ${z}`),
    'REGELN:',
    `- "an" MUSS einer dieser Kurznamen sein: ${kurznamen.join(', ')}.`,
    haushaltKurze.length ? `- Gemeinsame Aufgaben (unten als [gemeinsam] markiert) dürfen NUR an ${haushaltKurze.join(' oder ')} gehen — oder bleiben.` : '- Gemeinsame Aufgaben (unten als [gemeinsam] markiert) bleiben.',
    `- Sei mutig: Im Zweifel abgeben. ${wer} will fast nichts mehr selbst machen.`,
    `- "uebergabe" = 1–2 Sätze, die ${wer} der Person wörtlich schicken kann (konkret: was, bis wann, was Fertig heißt).`,
    'Antworte NUR als JSON: {"vorschlaege":[{"taskId":"…","empfehlung":"abgeben|bleibt","an":"Kurzname (nur bei abgeben)","warum":"1 kurzer Satz","uebergabe":"nur bei abgeben"}]} — für JEDE übergebene Aufgabe genau ein Eintrag.',
  ].join('\n');

  const zeile = (t: StoredTask, marker = '') =>
    `- [${t.id}]${marker} ${t.title} (${t.priority}${t.dueDate ? `, fällig ${t.dueDate}` : ''}${t.assignee === 'both' ? ', bisher gemeinsam' : ''})${t.description ? ` — ${t.description.slice(0, 120)}` : ''}`;
  const user = [
    'OFFENE AUFGABEN:',
    ...business.slice(0, 20).map(t => zeile(t)),
    ...joint.slice(0, 6).map(t => zeile(t, ' [gemeinsam]')),
  ].join('\n');

  const r = await askJson<{ vorschlaege?: Partial<Vorschlag>[] }>({ zweck: 'delegation', ki: kiAus(req, ['aufgaben']), system, user, maxTokens: 6000, model: agent.model, timeoutMs: 150_000 });
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
      // Harte Leitplanken: nur echte Team-Kurznamen (Schreibweise aus den Daten); gemeinsame Aufgaben nur an Konten des Haushalts
      // (bei genau einem Konto dorthin umgelenkt — wie bisher, sonst bleibt die Aufgabe).
      an = an ? personZuKurz(empfaenger, an)?.kurz : undefined;
      if (jointIds.has(String(v.taskId)) && an && !haushaltKurze.includes(an)) an = haushaltKurze.length === 1 ? haushaltKurze[0] : undefined;
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
  await logRun('task', `Delegations-Runde: ${abgabe} von ${vorschlaege.length} abgebbar`, { abgabe, gesamt: vorschlaege.length, privatAusgeblendet: privatAnzahl }, { person: personStreng(req) });

  if (ablegen) await updateJson<DelegationRunde>(RUNDE, () => ({ zeit: new Date().toISOString(), vorschlaege, privatAnzahl })).catch(() => { /* Runde nur im Lauf-Text */ });
  return NextResponse.json({ vorschlaege, privatAnzahl, abgelegt: ablegen });
}
