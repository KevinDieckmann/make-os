// ─── Agenten-Bereich: ein Thread-Lauf im Hintergrund (09.10., Paket 1 „Kern“) ─────────────────────────────────────────────────
// Der Arbeiter (worker.mjs → Warteschlange `zoe-auftraege`, Name `LAUF_AGENT` = 'faden' → lib/zoe/agenten.ts) ruft diese Route mit
// dem `LaufAuftrag` eines Auftrags (Mitarbeiter-Thread, Skill-Lauf, geplante Hintergrundaufgabe). NUR der Dienstweg MIT Person aus
// dem Haushalt des Inhabers — der Lauf rechnet immer für die AUSLÖSENDE Person (CLAUDE.md Regel 5/7), nie als Systemlauf. Ein freier
// Text ist kein Lauf (400); Thread, Skill und Hintergrundaufgabe müssen der Person gehören (lib/agenten/delegation.ts `fadenLauf`).
// Die Antwort trägt nur Metadaten (Status, Thread-Kennung) — Inhalte stehen im Thread.
import { NextResponse } from 'next/server';
import { istDienst, nurDienstweg, ohnePerson, nurHaushalt, personImHaushaltDesInhabers } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHintergrund, kiLaufAus } from '@/lib/datenschutz/ki-lauf';
import { innenAdresse } from '@/lib/innen';
import { HEAD_IDS } from '@/lib/agenten/katalog';
import type { LaufAuftrag } from '@/lib/agenten/typen';
import { istFadenId } from '@/lib/agenten/faeden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 360;

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler, error: fehler }, { status });

/** Nur die drei Formen eines Laufs — alles andere (auch freier Text) wird abgelehnt. */
function laufAus(roh: unknown): LaufAuftrag | null {
  if (!roh || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  if (o.art === 'faden' && istFadenId(o.fadenId)) return { art: 'faden', fadenId: o.fadenId };
  if (o.art === 'plan' && typeof o.planId === 'string' && /^hg-[a-z0-9-]{8,60}$/.test(o.planId)) return { art: 'plan', planId: o.planId };
  if (o.art === 'skill' && typeof o.skillId === 'string' && /^sk-[a-z0-9-]{8,60}$/.test(o.skillId) && typeof o.headId === 'string' && HEAD_IDS.includes(o.headId)
    && (o.ausloeser === 'hand' || o.ausloeser === 'zeitplan' || o.ausloeser === 'ereignis')) {
    const e = o.eingaben && typeof o.eingaben === 'object' && !Array.isArray(o.eingaben) ? Object.entries(o.eingaben as Record<string, unknown>) : [];
    if (e.length > 12 || e.some(([k, v]) => !/^[a-z0-9-]{1,40}$/.test(k) || typeof v !== 'string' || v.length > 2_000)) return null;
    return { art: 'skill', skillId: o.skillId, headId: o.headId, ausloeser: o.ausloeser, ...(e.length ? { eingaben: Object.fromEntries(e) as Record<string, string> } : {}), ...(typeof o.ereignisId === 'string' ? { ereignisId: o.ereignisId.slice(0, 80) } : {}) };
  }
  return null;
}

export async function POST(req: Request) {
  if (!istDienst(req)) return nurDienstweg();
  const person = req.headers.get('x-make-person');
  if (!person) return ohnePerson();
  if (!(await personImHaushaltDesInhabers(person))) return nurHaushalt();
  let body: unknown;
  try { body = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  const auftrag = laufAus(body);
  if (!auftrag) return nein(400, 'Kein gültiger Lauf — erwartet wird ein Lauf-Auftrag (Thread, Skill oder Hintergrundaufgabe), kein freier Text.');
  const hintergrund = kiLaufAus(req, 'aufruf') === 'hintergrund';
  const { fadenLauf } = await import('@/lib/agenten/delegation');
  const lauf = () => fadenLauf(person, auftrag, { origin: innenAdresse(req), hintergrund });
  try {
    const r = hintergrund ? await imHintergrund(lauf) : await lauf();
    return NextResponse.json({ ok: r.ok, ...(r.fadenId ? { fadenId: r.fadenId } : {}), ...(r.laufStatus ? { laufStatus: r.laufStatus } : {}), ergebnis: r.ergebnis, ...(r.ok ? {} : { fehler: r.ergebnis, error: r.ergebnis }) }, { status: r.status });
  } catch (e) {
    return nein(500, `Lauf fehlgeschlagen (${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}).`);
  }
}
