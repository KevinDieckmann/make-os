// ─── MAKE OS — Jarvis plant die Essens-Woche ────────────────────────────────
// POST { hinweis? } → Vorschlag für 7 Tage × 3 Mahlzeiten nach Kevins
// Grundsätzen (anti-entzündlich, regelmäßig, einfach) + gebündelte Einkaufs-
// liste. NUR ein Vorschlag: Kevin übernimmt per Klick, nichts wird hier
// gespeichert. Kein Medizin-/Ernährungsrat — der Hinweis ist deterministisch.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { TAGE, type ErnaehrungFile, type Tag, type Mahlzeiten } from '@/lib/make-one/ernaehrung-data';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CARE =
  'Alltagsküche, kein Medizin- oder Ernährungsrat — Psoriasis-Fragen gehören zu Arzt/Ernährungsberatung.';

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { hinweis?: string } = {};
  try { body = await req.json(); } catch { /* leer ok */ }
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('health');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const f = await loadJson<ErnaehrungFile>('ernaehrung');
  const grundsaetze = f?.grundsaetze ?? 'anti-entzündlich (mediterran), regelmäßig, einfach';

  const system = [
    'Du planst Kevins Essens-Woche — Alltagsküche für einen vielbeschäftigten Gründer, der aktuell UNREGELMÄSSIG isst. Dein Job: eine Woche, die er wirklich durchhält.',
    'GRUNDSÄTZE (verbindlich):',
    grundsaetze,
    'REGELN:',
    '- Je Mahlzeit EIN Gericht, max 8 Wörter (z. B. „Lachs mit Ofengemüse und Quinoa"). Kein Rezepttext.',
    '- Frühstück und Mittag alltagstauglich schnell; 2–3 Gerichte dürfen sich wiederholen (Meal-Prep!), aber nicht alles.',
    '- Abends leicht. Freitag/Samstag darf EIN entspanntes Genuss-Gericht sein — durchhaltbar schlägt perfekt.',
    '- EINKAUFSLISTE: alle nötigen Zutaten der Woche, gebündelt und dedupliziert, grobe Mengen (z. B. „Lachs (2 Portionen)"), 15–30 Posten, nach Kategorie sortiert (Gemüse zuerst, dann Protein, Vorrat).',
    'Antworte NUR als JSON: {"begruendung":"1-2 Sätze, wie du die Woche gedacht hast","plan":{"mo":{"fruehstueck":"…","mittag":"…","abend":"…"},"di":{…},"mi":{…},"do":{…},"fr":{…},"sa":{…},"so":{…}},"einkauf":["…","…"]}',
  ].join('\n');

  const user = body.hinweis ? `Kevins Hinweis für diese Woche: ${String(body.hinweis).slice(0, 300)}` : 'Plane eine normale Arbeitswoche.';

  const r = await askJson<{ begruendung?: string; plan?: Partial<Record<Tag, Partial<Mahlzeiten>>>; einkauf?: unknown[] }>({ zweck: 'ernaehrung-vorschlag',
    system, user, maxTokens: 5000, model: agent.model, timeoutMs: 150_000,
  });
  if (!r.ok || !r.data?.plan) return NextResponse.json({ error: r.error ?? 'Kein Vorschlag erhalten.' }, { status: 200 });

  const plan = {} as Record<Tag, Mahlzeiten>;
  for (const t of TAGE) {
    const m = r.data.plan[t] ?? {};
    plan[t] = {
      fruehstueck: String(m.fruehstueck ?? '').slice(0, 200),
      mittag: String(m.mittag ?? '').slice(0, 200),
      abend: String(m.abend ?? '').slice(0, 200),
    };
  }
  const einkauf = (Array.isArray(r.data.einkauf) ? r.data.einkauf : [])
    .map(x => String(x ?? '').slice(0, 120)).filter(Boolean).slice(0, 40);

  await logRun('health', 'Essens-Woche vorgeschlagen', { posten: einkauf.length });

  return NextResponse.json({ begruendung: String(r.data.begruendung ?? '').slice(0, 400), plan, einkauf, hinweis: CARE });
}
