// ─── Agenten-Bereich: Hintergrundaufgaben und „Als Nächstes“ (09.10., Paket 3; AGENTEN_KONZEPT.md C11) ─────────────────────
// GET  → `LaeufeAntwort` + `planStaende`: Läuft/Fertig/Fehler (Lesemodell aus Warteschlange, Threads, Head-/Finanzchef-Berichten,
//      Takt — eigene voll, Systemläufe neutral, die anderer Personen nie), „Als Nächstes“ (dieselben Zeitplan-Regeln wie der Takt, nach
//      Eisenhower) und die geplanten Hintergrundaufgaben der Person.
// POST `LaeufeAnfrage`: planen (geplant/wiederkehrend; „jetzt“ = Thread, Paket 1), plan-aendern, plan-loeschen (mit Stand), abbrechen,
//      neu-starten — dazu `kostenBestaetigt` (Schätzung über der Schwelle, Antwort 16) und `trotzdem` (Business-frei).
// Nur die Person selbst (`eigenePerson`: Sitzung, Haushalt des Inhabers; Dienstweg 403), keine Personen-Parameter. Body ≤ 32 KB.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { einmalig } from '@/lib/store/anfragen';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { laeufeLesen, laufAbbrechen, laufNeuStarten } from '@/lib/agenten/laeufe';
import { naechstesLesen, naechstesVerdichten } from '@/lib/agenten/naechstes';
import { planAendern, planen, planLesen, planLoeschen } from '@/lib/agenten/plan-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY = 32 * 1024;
type Antwort = { ok: boolean; status?: number; fehler?: string } & Record<string, unknown>;
const antwort = (r: Antwort) => (r.ok
  ? NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
  : NextResponse.json({ ...r, error: r.fehler }, { status: r.status ?? 400 }));

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const jetzt = new Date();
  const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
  const [laeufe, naechstes, plan, ki] = await Promise.all([laeufeLesen(z.person, jetzt), naechstesLesen(z.person, jetzt), planLesen(z.person), kiSchalterFuer(z.person).catch(() => null)]);
  // Rundgang 09.10.: je wiederkehrendem Lauf nur das nächste Vorkommen (+ „n weitere“) — die Rechnung bleibt die des Takts.
  // `hintergrundKi` (Rundgang „Agenten live“): ohne Hintergrund-KI laufen geplante Aufgaben nicht — die Oberfläche sagt es dann.
  return NextResponse.json({ ok: true, laeufe, naechstes: naechstesVerdichten(naechstes), plan: plan.aufgaben, planStaende: plan.staende, ...(ki ? { hintergrundKi: !!ki.hintergrund } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}

type Body = Record<string, unknown> & { aktion?: string };

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: Body;
  try { b = await jsonBegrenzt<Body>(req, MAX_BODY); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.', error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object') return NextResponse.json({ ok: false, fehler: 'Anfrage fehlt.', error: 'Anfrage fehlt.' }, { status: 400 });
  const p = z.person;
  const kostenBestaetigt = b.kostenBestaetigt === true;
  switch (b.aktion) {
    case 'planen': {
      const e = await einmalig('agenten-plan', b.anfrageId, async () => { const r = await planen(p, b.aufgabe, { kostenBestaetigt }); return { status: r.ok ? 200 : r.status, body: r }; }, undefined, { wer: p });
      const body = e.body as Antwort;
      return NextResponse.json({ ...body, ...(body.ok === false ? { error: body.fehler ?? body.error } : {}) }, { status: e.status });
    }
    case 'plan-aendern': return antwort(await planAendern(p, b.id, b.teil, b.stand, { kostenBestaetigt }) as Antwort);
    case 'plan-loeschen': return antwort(await planLoeschen(p, b.id, b.stand) as Antwort);
    case 'abbrechen': return antwort(await laufAbbrechen(p, b.laufId) as Antwort);
    case 'neu-starten': return antwort(await laufNeuStarten(p, b.laufId, { kostenBestaetigt, trotzdem: b.trotzdem === true }) as Antwort);
    default: return antwort({ ok: false, status: 400, fehler: 'Unbekannte Aktion.' });
  }
}
