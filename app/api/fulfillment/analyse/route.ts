// ─── Fulfillment — Analyse-Läufe (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.2/4.3/4.7) ───────────────────────────────────────────────────────────
// GET  `?m=` → je Agent Zustand (bereit · gesperrt mit Gründen · läuft), SCHÄTZUNG je Lauf („ca. x“, „höchstens y“), Zahl der Läufe, KI-Lage der Person
//        (ehrlich: kein Zugang, Bereich aus, Web-Suche aus, Tiefenbericht aus — nichts wird umgeschaltet), Minimalset als Vorschlag. Liest nur.
// POST `starten` { mandatId, agent, bestaetigtCent, anfrageId, grund?, funktion? } — NUR per Klick auf genau diesen Lauf (kein Autostart, kein
//        „alle starten“): Abhängigkeiten, F1, Schalter, Schätzung neu (größer → 409 `kostenRueckfrage`), ≤ 2 laufend (429), ≤ 3 je Agent (4. nur mit
//        Grund). Antwort 202, die Arbeit läuft im App-Prozess (`after`). · `abbrechen` { mandatId, laufId } · `tiefenbericht` { mandatId, frage?,
//        bestaetigtCent } — Ergebnis nur als Leseteil für die auslösende Person.
// Tor: `fulfillmentZugang` (schreiben nur per Sitzung + Bau-Kennung; der Dienstweg startet nie). Wiederholte Anfragen über `anfrageId` (`einmalig`).

import { NextResponse } from 'next/server';
import { fulfillmentZugang, mandatAusserSicht } from '@/lib/fulfillment/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { einmalig } from '@/lib/store/anfragen';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { ANALYSE_AGENTEN } from '@/lib/fulfillment/lesen';
import type { AnalyseAgentId } from '@/lib/fulfillment/typen';
import { analyseLage } from '@/lib/fulfillment/analyse/lage';
import { laufStarten, laufAbbrechen, tiefenberichtStarten } from '@/lib/fulfillment/analyse/lauf';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const m = new URL(req.url).searchParams.get('m') ?? '';
  if (!MANDAT_ID.test(m)) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt (?m=).' }, { status: 400 });
  { const nein = await mandatAusserSicht(z, m, 'lesen'); if (nein) return nein; }
  const lage = await analyseLage(m, z.person);
  if (!lage) return NextResponse.json({ ok: false, fehler: 'Für dieses Mandat gibt es noch kein Dossier.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...lage });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const mandatId = typeof b?.mandatId === 'string' ? b.mandatId : '';
  if (!MANDAT_ID.test(mandatId)) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt.' }, { status: 400 });
  { const nein = await mandatAusserSicht(z, mandatId, 'schreiben'); if (nein) return nein; }
  const aktion = b.aktion;
  if (aktion === 'starten') {
    const agent = typeof b.agent === 'string' && (ANALYSE_AGENTEN as readonly string[]).includes(b.agent) ? (b.agent as AnalyseAgentId) : null;
    if (!agent) return NextResponse.json({ ok: false, fehler: 'Unbekannter Agent.' }, { status: 400 });
    // Regel 7 (18.10., Gesamtprüfung L3 B7): ein Lauf löst Modellaufrufe (mit Web-Suche) aus — das Stundenbudget je Person gilt auch hier.
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const r = await einmalig('fulfillment-analyse', b.anfrageId, async () => laufStarten({
      mandatId, agent, bestaetigtCent: typeof b.bestaetigtCent === 'number' ? b.bestaetigtCent : Number.NaN,
      ...(typeof b.grund === 'string' ? { grund: b.grund } : {}), ...(typeof b.funktion === 'string' ? { funktion: b.funktion } : {}),
    }, z.person), undefined, { wer: z.person, merken: a => a.status === 200 || a.status === 202 });
    return NextResponse.json(r.body, { status: r.status });
  }
  if (aktion === 'abbrechen') {
    const r = await laufAbbrechen(mandatId, typeof b.laufId === 'string' ? b.laufId : '', z.person);
    return NextResponse.json(r.body, { status: r.status });
  }
  if (aktion === 'tiefenbericht') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const r = await einmalig('fulfillment-tiefenbericht', b.anfrageId, async () => tiefenberichtStarten({
      mandatId, ...(typeof b.frage === 'string' ? { frage: b.frage } : {}), ...(typeof b.bestaetigtCent === 'number' ? { bestaetigtCent: b.bestaetigtCent } : {}),
    }, z.person), undefined, { wer: z.person, merken: a => a.status === 202 });
    return NextResponse.json(r.body, { status: r.status });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
