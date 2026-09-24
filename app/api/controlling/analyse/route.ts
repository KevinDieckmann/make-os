// ─── MAKE OS — Controlling-Agent: Lagebericht ──────────────────────────────
// Kennzahlen kommen deterministisch rein (server-seitig gerechnet), die KI
// liefert nur die ehrliche Einordnung: Kurs zum 1-Mio-Ziel, Runway, Fokus.

import { NextResponse } from 'next/server';
import { logRun } from '@/lib/agent-log';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { computeMetrics, mitKasse, eur, MONTHS_DE, type FinanceState } from '@/lib/make-one/finance-data';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let payload: { state?: FinanceState };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Ohne Body: Server liest selbst — damit Jarvis den Agenten direkt ausführen kann.
  const roh = payload.state ?? (await loadJson<FinanceState>('finance'));
  if (!roh || !Array.isArray(roh.months)) return NextResponse.json({ error: 'Kein Finanzstand hinterlegt — Zahlen unter /os/controlling pflegen.' }, { status: 200 });

  // Kasse immer aus den Firmenkonten — auch wenn die Seite ihren Stand mitschickt.
  const plan = await loadJson<{ firmen?: { id: string; kontostand?: number | null; stand?: string | null }[] }>('finanzplan');
  const s = mitKasse(roh, plan?.firmen);
  const m = computeMetrics(s);
  if (!hasAnthropicKey()) return NextResponse.json({ briefing: 'Kein Anthropic-Key hinterlegt — die Kennzahlen stehen aber (siehe Cockpit).', metrics: m });
  const agent = await resolveAgent('controlling');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), metrics: m });

  const hasData = m.aktiveMonate > 0;
  const system = [
    'Du bist der Controlling-Agent in Kevins MAKE OS. Nordstern: 1 Mio € Umsatz bei KD Ventures → min. 300k € Gewinn für Kevin & Malin.',
    'Du bekommst FERTIG GERECHNETE Kennzahlen. Rechne NICHT neu und erfinde KEINE Zahlen — interpretiere nur, was dasteht.',
    'Sei nüchtern und ehrlich: Wo steht er wirklich, ist die nötige Run-Rate realistisch, reicht der Runway, worauf muss er diesen Monat fokussieren.',
    'Kein Startup-Sprech (kein „Disruption/Unicorn/Game-Changer"). Klar, ruhig, Klartext.',
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"briefing":"<3-4 Sätze Lage>","fokus":["<konkreter Hebel diesen Monat>", "..."],"risiken":["<Risiko/Warnung>", "..."]}',
  ].join('\n');

  const kpis = [
    `Jahr: ${s.jahr}`,
    `Ziel-Umsatz: ${eur(s.zielUmsatz)} · Ziel-Gewinn: ${eur(s.zielGewinn)}`,
    hasData ? `Ist-Umsatz (kumuliert): ${eur(m.istUmsatz)} (${Math.round(m.fortschritt * 100)}% vom Ziel)` : 'Ist-Umsatz: noch keine Zahlen hinterlegt',
    hasData ? `Ist-Kosten: ${eur(m.istKosten)} · Ist-Gewinn: ${eur(m.istGewinn)}` : '',
    hasData ? `Aktive Monate: ${m.aktiveMonate}, Ø Umsatz/Monat bisher: ${eur(m.runRateAktuell)}` : '',
    `Rest-Monate bis Dez: ${m.restMonate}`,
    `Nötige Run-Rate, um Ziel zu treffen: ${eur(m.runRateNoetig)}/Monat`,
    `Cash: ${eur(s.cash)} (${s.kasse.quelle === 'konten' ? `Summe ${s.kasse.konten} Firmenkonten${s.kasse.stand ? `, ältester Stand ${s.kasse.stand}` : ''}` : s.kasse.quelle === 'manuell' ? 'manuell eingetragen, keine Kontostände' : 'kein Kontostand hinterlegt'})${m.runwayMonate != null ? ` · Runway: ${m.runwayMonate.toFixed(1)} Monate (bei Ø Burn ${eur(m.avgBurn)})` : ' · Runway: n/a (kein Burn hinterlegt)'}`,
    '',
    'Monatsverlauf (Umsatz / Kosten):',
    s.months.map((r, i) => `${MONTHS_DE[i]}: ${eur(r.umsatz)} / ${eur(r.kosten)}`).join('\n'),
  ].filter(Boolean).join('\n');

  const r = await askJson<{ briefing?: string; fokus?: string[]; risiken?: string[] }>({ zweck: 'controlling-analyse', system, user: kpis, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ briefing: r.error ?? 'Analyse gerade nicht möglich — Kennzahlen stehen.', metrics: m });

  const out = {
    briefing: r.data.briefing ?? '',
    fokus: Array.isArray(r.data.fokus) ? r.data.fokus.slice(0, 5) : [],
    risiken: Array.isArray(r.data.risiken) ? r.data.risiken.slice(0, 5) : [],
  };
  await logRun('controlling', `Lagebericht ${s.jahr}`, { ...out, metrics: m });
  return NextResponse.json({ ...out, metrics: m });
}
