// ─── MAKE OS — Fokus-/Entscheidungs-Agent ───────────────────────────────────
// Verrechnet Whoop-Recovery × Aufgaben-Last → die Tagesform. Der Doppelziel-
// Hebel: Firma + Gesundheit in EINER Empfehlung. Braucht ANTHROPIC_API_KEY.

import { NextResponse } from 'next/server';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { resolveVitals, tagesZone, vitalsHint, vitalsKurz } from '@/lib/vitals';
import { gatherBrain, blockAufgaben } from '@/lib/brain';
import { personStreng, laufPerson } from '@/lib/finanzen/haushalt/zugriff';
import { eigenerGesundheitsKontext, KONTEXT_REGEL } from '@/lib/gesundheit/kontext';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { nordsternSatz } from '@/lib/planung/nordstern';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { wochentag } from '@/lib/zeit/kalender-kern';
import type { RoutinenDatei } from '@/lib/planung/typen';

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
  // Ohne Wert (0 = keine Angabe) keine Zone aus einer erfundenen Zahl: dann wie GELB (mit Puffer), ehrlich ohne Recovery.
  const rec = v.rec;
  const zone = tagesZone(rec);

  if (!hasAnthropicKey()) {
    return NextResponse.json({ reply: 'Mir fehlt noch dein Anthropic-Key (.env.local), dann richte ich deinen Tag nach deiner Recovery aus.', recovery: rec, zone, needsKey: true });
  }
  const agent = await resolveAgent('fokus');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), reply: '', recovery: rec, zone });

  // Aufgaben kommen aus dem Brain — kein Mock-Fallback mehr: leer ist leer.
  const taskLines = blockAufgaben(b, 15);

  // Arbeitszeit aus den DATEN der Person (08.10. abends): ihre Wochenvorlage (Planung › Routinen, Blöcke „business“) für heute —
  // vorher stand hier für jede Person und Instanz eine feste Uhrzeit-Spanne (aus dem entfernten festen Wochen-Rhythmus). Ohne Vorlage: keine
  // feste Arbeitszeit annehmen. Nur Uhrzeiten, keine Titel.
  const routinenF = await loadJson<RoutinenDatei>('routinen').catch(() => null);
  const heute = wochentag(localDay());
  const arbeit = (Array.isArray(routinenF?.bloecke) ? routinenF!.bloecke : [])
    .filter(bl => bl.owner === fuer && bl.art === 'business' && bl.wochentag === heute)
    .sort((x, y) => x.von.localeCompare(y.von))
    .map(bl => `${bl.von}–${bl.bis}`);
  const arbeitszeit = arbeit.length
    ? `Arbeitszeit heute laut Wochenvorlage: ${arbeit.join(', ')} — diese Zeit für Fokus schützen, Blöcke nur darin planen.`
    : 'Für heute ist keine Arbeitszeit in der Wochenvorlage hinterlegt — nimm keine feste Arbeitszeit an.';

  const system = [
    'Du bist der Fokus-/Entscheidungs-Agent in Kevins MAKE OS — der Agent, der Gesundheit UND Firma in einer Empfehlung zusammenbringt.',
    'Kernregel: die Recovery bestimmt die Tagesform.',
    '- GRÜN (Recovery ≥66): volle Kapazität → 2–3 harte Deep-Work-Blöcke (90 Min) auf die kritischste Aufgabe.',
    '- GELB (40–65): fokussiert, aber mit Puffer — weniger/ kürzere Blöcke, mehr Pausen.',
    '- ROT (<40): nur das Essentielle + Regeneration (NSDR, Reha, früher Feierabend). Nicht durchpowern.',
    // S1 #9: kein fester Gesundheitskontext mehr — nur aus dem eigenen Profil der fragenden Person (unten, falls gepflegt).
    // Nordstern aus den Daten des Haushalts (08.10. abends) — vorher fest im Code, samt eines persönlichen Ziels.
    `Kontext: ${arbeitszeit} ${nordsternSatz(b.nordstern)}`,
    KONTEXT_REGEL,
    'Antworte auf Deutsch, kurz & strukturiert in Markdown mit genau diesen fetten Überschriften:',
    '**Tagesform** (1 Satz zur Recovery-Zone) · **Heute zuerst** (die EINE wichtigste Aufgabe) · **Zeitblöcke** (2–3 konkrete mit Uhrzeit) · **Heute bewusst NICHT** (was warten kann) · **Körper** (1 konkreter Reha-/Ruhe-Hinweis).',
    'Keine Textwände, keine Floskeln, kein Startup-Sprech. Souverän und klar.',
  ].join('\n');

  const eigeneAngaben = await eigenerGesundheitsKontext(personStreng(req));
  const koerper = b.gesundheitFrei
    ? `${vitalsKurz(v, ['rec'])} (Zone ${zone})${vitalsHint(v)}. ${vitalsKurz(v, ['rhr', 'hrv', 'sleep'])}.${v.note ? ` Notiz: "${v.note}"` : ''}`
    : 'KEINE GESUNDHEITSWERTE: Die Person hat nicht eingewilligt, dass sie an die KI gehen. Plane nach den Aufgaben mit mittlerer Last (wie GELB) und frag nicht nach Werten; unter **Tagesform** und **Körper** nur ein allgemeiner Satz.';
  const message = `${koerper}${eigeneAngaben ? `\n\n${eigeneAngaben}` : ''}\n\n${taskLines}\n\nRichte meinen Tag aus.`;

  const r = await askText({ zweck: 'fokus', system, user: message, maxTokens: 4000, model: agent.model,
    ki: kiAus(req, b.gesundheitFrei || eigeneAngaben ? ['aufgaben', 'gesundheit'] : ['aufgaben']) });
  if (!r.ok || !r.text) return NextResponse.json({ reply: r.error ?? 'Konnte gerade keinen Tagesplan erzeugen — nochmal versuchen.', recovery: rec, zone });

  // Der Titel des Laufs geht später als Gedächtnis in andere Prompts (blockGedaechtnis) — deshalb ohne Gesundheitswert.
  await logRun('fokus', 'Tagesplan erstellt', { ...(b.gesundheitFrei ? { zone, recovery: rec } : {}), reply: r.text.slice(0, 1500) }, { person: fuer });
  return NextResponse.json({ reply: r.text, recovery: rec, zone, stand: v.stand, heute: v.heute });
}
