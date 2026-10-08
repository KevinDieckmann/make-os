// ─── MAKE OS — Fokus-/Entscheidungs-Agent ───────────────────────────────────
// Verrechnet Whoop-Recovery × Aufgaben-Last → die Tagesform. Der Doppelziel-
// Hebel: Firma + Gesundheit in EINER Empfehlung. Braucht ANTHROPIC_API_KEY.

import { NextResponse } from 'next/server';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { resolveVitals, zoneOf, vitalsHint } from '@/lib/vitals';
import { gatherBrain, blockAufgaben } from '@/lib/brain';
import { personStreng, laufPerson } from '@/lib/finanzen/haushalt/zugriff';
import { eigenerGesundheitsKontext, KONTEXT_REGEL } from '@/lib/gesundheit/kontext';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  // Für wen der Lauf rechnet = unter wem er im Agenten-Log steht (08.10.): benannte Person, im Systemlauf der Inhaber.
  const fuer = await laufPerson(req);
  const b = await gatherBrain(undefined, fuer);
  // Anzeige (eigene Werte der Person, bleiben im Haus) getrennt vom Prompt: an die KI gehen Vitalwerte nur mit
  // Einwilligung (b) — `b.gesundheitFrei` (Art. 9, 05.10.).
  const v = b.gesundheitFrei ? b.vitals : await resolveVitals(undefined, fuer);
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
    // S1 #9: kein fester Gesundheitskontext mehr — nur aus dem eigenen Profil der fragenden Person (unten, falls gepflegt).
    'Kontext: Fokuszeit 09–17 schützen. Nordstern: mehr Ruhe + 1 Mio € Umsatz KD Ventures.',
    KONTEXT_REGEL,
    'Antworte auf Deutsch, kurz & strukturiert in Markdown mit genau diesen fetten Überschriften:',
    '**Tagesform** (1 Satz zur Recovery-Zone) · **Heute zuerst** (die EINE wichtigste Aufgabe) · **Zeitblöcke** (2–3 konkrete mit Uhrzeit) · **Heute bewusst NICHT** (was warten kann) · **Körper** (1 konkreter Reha-/Ruhe-Hinweis).',
    'Keine Textwände, keine Floskeln, kein Startup-Sprech. Souverän und klar.',
  ].join('\n');

  const eigeneAngaben = await eigenerGesundheitsKontext(personStreng(req));
  const koerper = b.gesundheitFrei
    ? `Recovery: ${rec}% (Zone ${zone})${vitalsHint(v)}. Ruhepuls ${v.rhr}, HRV ${v.hrv}, Schlaf letzte Nacht ${v.sleep}h.${v.note ? ` Notiz: "${v.note}"` : ''}`
    : 'KEINE GESUNDHEITSWERTE: Die Person hat nicht eingewilligt, dass sie an die KI gehen. Plane nach den Aufgaben mit mittlerer Last (wie GELB) und frag nicht nach Werten; unter **Tagesform** und **Körper** nur ein allgemeiner Satz.';
  const message = `${koerper}${eigeneAngaben ? `\n\n${eigeneAngaben}` : ''}\n\n${taskLines}\n\nRichte meinen Tag aus.`;

  const r = await askText({ zweck: 'fokus', system, user: message, maxTokens: 4000, model: agent.model,
    ki: kiAus(req, b.gesundheitFrei || eigeneAngaben ? ['aufgaben', 'gesundheit'] : ['aufgaben']) });
  if (!r.ok || !r.text) return NextResponse.json({ reply: r.error ?? 'Konnte gerade keinen Tagesplan erzeugen — nochmal versuchen.', recovery: rec, zone });

  // Der Titel des Laufs geht später als Gedächtnis in andere Prompts (blockGedaechtnis) — deshalb ohne Gesundheitswert.
  await logRun('fokus', 'Tagesplan erstellt', { ...(b.gesundheitFrei ? { zone, recovery: rec } : {}), reply: r.text.slice(0, 1500) }, { person: fuer });
  return NextResponse.json({ reply: r.text, recovery: rec, zone, stand: v.stand, heute: v.heute });
}
