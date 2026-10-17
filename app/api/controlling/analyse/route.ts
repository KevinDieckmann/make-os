// ─── MAKE OS — Controlling-Agent: Lagebericht ──────────────────────────────
// Kennzahlen kommen deterministisch rein (server-seitig gerechnet), die KI
// liefert nur die ehrliche Einordnung: Kurs zum Ziel (Nordstern aus den Daten des Haushalts), Runway, Fokus.

import { mitEroeffnung, geltendeLaden } from '@/lib/business/eroeffnung-server';
import { ladeControlling } from '@/lib/finanzen/controlling-server';
import { runwayDesIndex } from '@/lib/business/fuer-chef';
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { logRun } from '@/lib/agent-log';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { computeMetrics, mitKasse, eur, MONTHS_DE } from '@/lib/make-one/finance-data';
import { loadJson } from '@/lib/store/local-db';
import { modellSchranke } from '@/lib/zugang/umfang';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { nordsternSatzFuer } from '@/lib/planung/nordstern-server';
import { runwaySatz, RUNWAY_ERKLAERUNG } from '@/lib/finanzen/runway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (Einstellungen › Konto).' };

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  // Der Körper ist optional (ZOE und der Agent rufen ohne ihn) — er wird nur geprüft, sein `state` zählt nicht mehr (17.10., L2 C2):
  // die Analyse liest DIESELBEN Monate wie Controlling, Cockpit, ZOE und Head of Finance (`ladeControlling`: Monatsabschlüsse + 0-Punkt)
  // und DIESELBE Runway (`runwayDesIndex`) — vorher rechnete sie ohne Körper mit den rohen gepflegten Monaten eine eigene Zahl.
  try { await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const geltende = await geltendeLaden();
  const [roh, planRoh, runway] = await Promise.all([
    ladeControlling(geltende),
    loadJson<{ firmen?: { id: string; kontostand?: number | null; stand?: string | null }[] }>('finanzplan'),
    runwayDesIndex().catch(() => null),
  ]);
  if (!roh) return NextResponse.json({ error: 'Kein Finanzstand hinterlegt — Zahlen unter Finanzen › Business › Controlling & Ziele pflegen.' }, { status: 200 });

  // Kasse immer aus den Firmenkonten. 0-Punkt (05.10.): die Kasse aus den Konten ab der Eröffnung je Gesellschaft (lib/business/eroeffnung.ts).
  const plan = planRoh ? await mitEroeffnung(planRoh, geltende) : null;
  const s = mitKasse(roh, plan?.firmen);
  const m = computeMetrics(s);
  if (!hasAnthropicKey()) return NextResponse.json({ briefing: 'Kein Anthropic-Key hinterlegt — die Kennzahlen stehen aber (siehe Cockpit).', metrics: m, runway });
  const agent = await resolveAgent('controlling');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), metrics: m, runway });

  const hasData = m.aktiveMonate > 0;
  const system = [
    // Nordstern aus den Daten des Haushalts (08.10. abends) — vorher eine feste Zeile im Code.
    `Du bist der Controlling-Agent in MAKE OS. ${await nordsternSatzFuer(personStreng(req))}`,
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
    `Cash: ${eur(s.cash)} (${s.kasse.quelle === 'konten' ? `Summe ${s.kasse.konten} Firmenkonten${s.kasse.stand ? `, ältester Stand ${s.kasse.stand}` : ''}` : s.kasse.quelle === 'manuell' ? 'manuell eingetragen, keine Kontostände' : 'kein Kontostand hinterlegt'}) · Runway: ${runwaySatz(runway)} — ${RUNWAY_ERKLAERUNG}`,
    '',
    'Monatsverlauf (Umsatz / Kosten):',
    s.months.map((r, i) => `${MONTHS_DE[i]}: ${eur(r.umsatz)} / ${eur(r.kosten)}`).join('\n'),
  ].filter(Boolean).join('\n');

  const r = await askJson<{ briefing?: string; fokus?: string[]; risiken?: string[] }>({ zweck: 'controlling-analyse', ki: kiAus(req, ['finanzen'], { person: personStreng(req) }), system, user: kpis, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ briefing: r.error ?? 'Analyse gerade nicht möglich — Kennzahlen stehen.', metrics: m, runway });

  const out = {
    briefing: r.data.briefing ?? '',
    fokus: Array.isArray(r.data.fokus) ? r.data.fokus.slice(0, 5) : [],
    risiken: Array.isArray(r.data.risiken) ? r.data.risiken.slice(0, 5) : [],
  };
  await logRun('controlling', `Lagebericht ${s.jahr}`, { ...out, metrics: m, runway: runway?.anzeige ?? null }, { person: personStreng(req) });
  return NextResponse.json({ ...out, metrics: m, runway });
}
