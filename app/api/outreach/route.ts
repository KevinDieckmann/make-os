// ─── MAKE OS — Outreach-Agent ───────────────────────────────────────────────
// Der Schritt von „qualifiziert" zu „kontaktiert": aus Score, Fit und
// Aufhänger des Prospecting-Agenten wird eine persönliche Erstansprache im
// Namen der auslösenden Person — als E-Mail UND als LinkedIn-Nachricht. Entwurf-Autonomie:
// versendet wird NIE automatisch, die Person prüft und schickt selbst (Gate ✋).
// Absender und Produkte aus Konto und Katalog (lib/crm/absender.ts, 09.10.) — nie fest im Code.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { absenderLaden, absenderZeilen, betreffRueckfall } from '@/lib/crm/absender';
import { RECHT } from '@/lib/ansprache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProspectIn {
  company?: string; industry?: string; size?: string; region?: string;
  fit?: string; angle?: string; score?: number;
}

// Deterministischer Rechts-Hinweis — kommt NICHT vom Modell. EINE Fassung mit der Erstansprache (lib/ansprache.ts `RECHT`; der
// frühere Satz „LinkedIn ist der sichere erste Kanal“ war falsch — LinkedIn-Nachrichten sind elektronische Post).

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { prospect?: ProspectIn; icp?: string };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const p = body.prospect;
  if (!p?.company) return NextResponse.json({ error: 'prospect.company nötig.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('outreach');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const person = personStreng(req);
  const absender = await absenderLaden(person);
  const system = [
    'Du schreibst Erstansprachen (E-Mail und LinkedIn-Nachricht) als Entwurf — versendet wird nur von Hand.',
    ...absenderZeilen(absender),
    'STIMME: klar, auf Augenhöhe, unternehmerisch, warm aber ohne Anbiederung. Kurze Sätze. Kein Vertriebs-Sprech, keine Buzzwords (kein „Game Changer“, keine „Disruption“).',
    'Anrede: Sie. Weitere Sprachregeln und Begriffe der Instanz stehen in den Brain-Regeln.',
    'AUFBAU E-MAIL (max 110 Wörter): 1) konkreter, firmenspezifischer Aufhänger (aus den Daten unten — nichts erfinden), 2) höchstens EIN Satz, welches Problem eines der Produkte oben löst (ohne Produkt: weglassen), 3) niedrigschwellige Frage als Abschluss (kein Termin-Druck). Betreff: konkret, ohne Clickbait, max 7 Wörter.',
    'AUFBAU LINKEDIN (max 55 Wörter): noch persönlicher, ohne Firmen-Pitch-Absatz — Aufhänger + eine ehrliche Frage.',
    'Wenn dir Fakten fehlen, bleib allgemein statt zu erfinden — KEINE erfundenen Zahlen, Namen oder Ereignisse über die Firma.',
    'Antworte NUR als JSON: {"betreff":"…","email":"…","linkedin":"…"}',
  ].join('\n');

  const user = [
    `FIRMA: ${String(p.company).slice(0, 120)}`,
    p.industry ? `Branche: ${String(p.industry).slice(0, 80)}` : '',
    p.size ? `Größe: ${String(p.size).slice(0, 40)}` : '',
    p.region ? `Region: ${String(p.region).slice(0, 40)}` : '',
    typeof p.score === 'number' ? `Fit-Score: ${p.score}/100` : '',
    p.fit ? `Warum es passt: ${String(p.fit).slice(0, 300)}` : '',
    p.angle ? `Vorgeschlagener Aufhänger: ${String(p.angle).slice(0, 300)}` : '',
    '',
    'IDEALES KUNDENPROFIL (Kontext):',
    String(body.icp ?? '').slice(0, 900),
  ].filter(Boolean).join('\n');

  const r = await askJson<{ betreff?: string; email?: string; linkedin?: string }>({ zweck: 'outreach', ki: kiAus(req, ['crm', 'konto'], { anzahl: 1 }),
    system, user, maxTokens: 3500, model: agent.model, timeoutMs: 120_000,
  });
  if (!r.ok || !r.data?.email) return NextResponse.json({ error: r.error ?? 'Kein Entwurf erhalten.' }, { status: 200 });

  await logRun('outreach', `Ansprache entworfen: ${p.company}`, { company: p.company, score: p.score ?? null }, { person });

  return NextResponse.json({
    ki: kiKennzeichen({ anbieter: r.anbieter, modell: agent.model }), // KI-VO Art. 50 (05.10.; Anbieter seit 09.10.)
    betreff: String(r.data.betreff ?? betreffRueckfall(String(p.company))).slice(0, 140),
    email: String(r.data.email).slice(0, 2000),
    linkedin: String(r.data.linkedin ?? '').slice(0, 800),
    hinweis: RECHT,
  });
}
