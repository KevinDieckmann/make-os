// ─── Evals der Heads ─────────────────────────────────────────────────────────
// GET  ?head=sales            → offline: die gespeicherten Fälle (letzte 25 Läufe)
//                               mit ihren damaligen Antworten gegen die festen
//                               Kriterien bewerten — kostet nichts.
// POST { head, n?, k?, modus? } → live: die letzten n Fälle (höchstens 10) je
//                               k-mal (höchstens 3) mit dem AKTUELLEN Prompt und
//                               Modell neu beantworten lassen, pass^k je Prüfung.
//                               Kostet Modell-Aufrufe — nur bewusst auslösen,
//                               z. B. vor und nach einer Prompt-Änderung.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { askText, extractJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, MODEL_BY_TIER } from '@/lib/agent-config';
import { HEADS, SYSTEM, SCHEMA, AGENT_ID, REVIEW_MODI, aufgabe, datenBlock, type HeadId } from '@/lib/heads/prompt';
import { normalisiere } from '@/lib/heads/pruefer';
import { bewerte, passK, type Bewertung } from '@/lib/heads/eval';
import type { ReplayStand } from '@/lib/heads/lauf';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const headAus = (h: unknown) => (HEADS.includes(h as HeadId) ? (h as HeadId) : null);

export async function GET(req: Request) {
  const h = headAus(new URL(req.url).searchParams.get('head'));
  if (!h) return NextResponse.json({ ok: false, fehler: 'head=sales|marketing|event' }, { status: 400 });
  const faelle = (await loadJson<ReplayStand>(`heads-replay-${h}`))?.faelle ?? [];
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const bewertungen = faelle.map(f => ({ zeit: f.zeit, modus: f.modus, quelle: f.quelle, modell: f.modell, bewertung: bewerte(f.roh, f.daten, kontakte, crm, f.heute) }));
  return NextResponse.json({ ok: true, head: h, faelle: bewertungen.length, je_pruefung: passK(bewertungen.map(b => [b.bewertung])), bewertungen: bewertungen.slice(-10) });
}

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  if (zuGross(req, 1000000)) return ZU_GROSS(1000000);
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
  let b: { head?: string; n?: number; k?: number; modus?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const h = headAus(b.head);
  if (!h) return NextResponse.json({ ok: false, fehler: 'head=sales|marketing|event' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ ok: false, fehler: 'Kein Anthropic-Schlüssel.' }, { status: 400 });
  const n = Math.max(1, Math.min(10, Number(b.n) || 5)), k = Math.max(1, Math.min(3, Number(b.k) || 3));
  const alle = (await loadJson<ReplayStand>(`heads-replay-${h}`))?.faelle ?? [];
  const faelle = alle.filter(f => !b.modus || f.modus === b.modus).slice(-n);
  if (!faelle.length) return NextResponse.json({ ok: false, fehler: 'Noch keine gespeicherten Fälle — erst Läufe machen.' }, { status: 404 });
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const agent = await resolveAgent(AGENT_ID[h]);
  const ergebnis: Bewertung[][] = [];
  const fehler: string[] = [];
  for (const f of faelle) {
    const wdh: Bewertung[] = [];
    const modell = process.env.ANTHROPIC_MODEL ?? (REVIEW_MODI.has(f.modus) ? MODEL_BY_TIER.stark : agent.model);
    for (let i = 0; i < k; i++) {
      const r = await askText({ system: SYSTEM[h], user: '', messages: [{ role: 'user', content: [{ type: 'text', text: datenBlock(f.daten), cache_control: { type: 'ephemeral' } }, { type: 'text', text: aufgabe(f.modus) }] }], model: modell, effort: REVIEW_MODI.has(f.modus) ? 'high' : 'medium', schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, maxTokens: 12000, timeoutMs: 200_000, zweck: `${AGENT_ID[h]}-eval` });
      if (!r.ok) { fehler.push(`${f.modus}: ${r.error}`); break; }
      wdh.push(bewerte(normalisiere(extractJson(r.text), h), f.daten, kontakte, crm, f.heute));
    }
    if (wdh.length) ergebnis.push(wdh);
  }
  return NextResponse.json({ ok: true, head: h, faelle: ergebnis.length, k, je_pruefung: passK(ergebnis), fehler });
}
