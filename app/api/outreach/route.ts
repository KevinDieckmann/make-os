// ─── MAKE OS — Outreach-Agent ───────────────────────────────────────────────
// Der Schritt von „qualifiziert" zu „kontaktiert": aus Score, Fit und
// Aufhänger des Prospecting-Agenten wird eine persönliche Erstansprache in
// Kevins Stimme — als E-Mail UND als LinkedIn-Nachricht. Entwurf-Autonomie:
// versendet wird NIE automatisch, Kevin prüft und schickt selbst (Gate ✋).

import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProspectIn {
  company?: string; industry?: string; size?: string; region?: string;
  fit?: string; angle?: string; score?: number;
}

// Deterministischer Rechts-Hinweis — kommt NICHT vom Modell.
const RECHT =
  'B2B-Kaltansprache per E-Mail ist in DE nur mit mutmaßlicher Einwilligung sauber (§7 UWG) — bei kaltem Kontakt ist LinkedIn oder Telefon der sichere erste Kanal. Versand bleibt bei dir.';

export async function POST(req: Request) {
  let body: { prospect?: ProspectIn; icp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const p = body.prospect;
  if (!p?.company) return NextResponse.json({ error: 'prospect.company nötig.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('outreach');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const system = [
    'Du schreibst Erstansprachen für Kevin Dieckmann (Gründer KEMARIS, Produkt CapOS — Controlling-/Liquiditäts-Cockpit für den Mittelstand).',
    'KEVINS STIMME: klar, auf Augenhöhe, unternehmerisch, warm aber ohne Anbiederung. Kurze Sätze. Kein Vertriebs-Sprech, kein Buzzword-Feuerwerk.',
    'SPRACHREGELN (verbindlich): NIEMALS diese Wörter: Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting, „einfach zu bedienen". Stattdessen wo passend: Echtzeit-Finanzbild, Steuerungslücke, Kapitalstau, Souveränität. Anrede: Sie.',
    'AUFBAU E-MAIL (max 110 Wörter): 1) konkreter, firmenspezifischer Aufhänger (aus den Daten unten — nichts erfinden), 2) EIN Satz, welches Problem CapOS löst, 3) niedrigschwellige Frage als Abschluss (kein Termin-Druck). Betreff: konkret, ohne Clickbait, max 7 Wörter.',
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

  const r = await askJson<{ betreff?: string; email?: string; linkedin?: string }>({
    system, user, maxTokens: 3500, model: agent.model, timeoutMs: 120_000,
  });
  if (!r.ok || !r.data?.email) return NextResponse.json({ error: r.error ?? 'Kein Entwurf erhalten.' }, { status: 200 });

  await logRun('outreach', `Ansprache entworfen: ${p.company}`, { company: p.company, score: p.score ?? null });

  return NextResponse.json({
    betreff: String(r.data.betreff ?? `CapOS × ${p.company}`).slice(0, 140),
    email: String(r.data.email).slice(0, 2000),
    linkedin: String(r.data.linkedin ?? '').slice(0, 800),
    hinweis: RECHT,
  });
}
