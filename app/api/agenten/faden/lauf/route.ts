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
import type { Faden, Hintergrundaufgabe, LaufAuftrag } from '@/lib/agenten/typen';
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

/** Head eines Lauf-Auftrags: Thread → sein Agent, Skill → `headId`, Hintergrundaufgabe → ihr Agent. */
async function headVon(person: string, a: LaufAuftrag): Promise<{ headId: string | null; fadenId?: string }> {
  if (a.art === 'skill') return { headId: a.headId };
  const [{ loadJson }, { fadenBestand, planBestand }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/agenten/typen')]);
  if (a.art === 'faden') {
    const f = (await loadJson<{ faeden?: Faden[] }>(fadenBestand(person)).catch(() => null))?.faeden?.find(x => x.id === a.fadenId && x.besitzer === person);
    return { headId: f && f.agent.art !== 'zoe' ? f.agent.headId : null, fadenId: f?.id };
  }
  const p = (await loadJson<{ aufgaben?: Hintergrundaufgabe[] }>(planBestand(person)).catch(() => null))?.aufgaben?.find(x => x.id === a.planId && x.besitzer === person);
  return { headId: p && p.agent.art !== 'zoe' ? p.agent.headId : null };
}

/** Sperre vor dem Lauf (Paket 4b) — und am Thread vermerken, warum er nicht läuft. */
async function laufSperreFuer(person: string, a: LaufAuftrag): Promise<{ status: 'abgebrochen' | 'wartet'; text: string; fadenId?: string } | null> {
  const { headId, fadenId } = await headVon(person, a);
  if (!headId) return null;
  const { laufSperre, ANGEHALTEN } = await import('@/lib/agenten/einstellung');
  const s = await laufSperre(person, headId).catch(() => null);
  if (!s) return null;
  const status = s.grund === 'not-aus' ? 'abgebrochen' as const : 'wartet' as const;
  if (fadenId) {
    const { fadenAendern } = await import('@/lib/agenten/faeden-server');
    const jetzt = new Date().toISOString();
    await fadenAendern(person, fadenId, f => (f.lauf && f.lauf.status !== 'wartet' && f.lauf.status !== 'laeuft' ? f : {
      ...f, status, lauf: { ...(f.lauf ?? { schritte: [], start: jetzt, kostenCent: 0 }), status, fehler: s.grund === 'not-aus' ? ANGEHALTEN : s.grund === 'aus' ? `${s.text} Der Lauf geht weiter, sobald er wieder an ist.` : s.text, ...(status === 'abgebrochen' ? { ende: jetzt, wartetAuf: 'not-aus' as const } : {}),
        // Nachschliff 09.10.: „Head aus“ als Feld — beim Wiedereinschalten reiht `laeufeNachHeadAn` genau diese Läufe einmal neu ein (Budget nie).
        ...(s.grund === 'aus' ? { wartetAuf: 'head-aus' as const } : {}) },
    })).catch(() => null);
  }
  return { status, text: s.grund === 'not-aus' ? ANGEHALTEN : s.text, ...(fadenId ? { fadenId } : {}) };
}

/** Der Head-Thread eines Mitarbeiter-Laufs (Eltern) bzw. der Thread selbst — dort stehen die Pläne. */
async function planStapelnFuer(person: string, fadenId: string): Promise<number> {
  const { eigenerFaden } = await import('@/lib/agenten/faeden-server');
  const { planStapeln } = await import('@/lib/agenten/plan-stapel');
  const f = await eigenerFaden(person, fadenId);
  let n = await planStapeln(person, fadenId);
  if (f?.elternId) n += await planStapeln(person, f.elternId);
  return n;
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
  // Paket 4b: Not-Aus (für alle bzw. je Head), ausgeschalteter Head, Head-Budget — VOR dem Lauf. Kein Fehler für die Warteschlange (200,
  // nicht neu einreihen): ein Thread bekommt „abgebrochen“ (Not-Aus) bzw. „wartet“ (Budget, aus) mit Grund; neu starten geht von Hand.
  const sperre = await laufSperreFuer(person, auftrag);
  if (sperre) return NextResponse.json({ ok: true, ...(sperre.fadenId ? { fadenId: sperre.fadenId } : {}), laufStatus: sperre.status, ergebnis: sperre.text });
  const hintergrund = kiLaufAus(req, 'aufruf') === 'hintergrund';
  const { fadenLauf } = await import('@/lib/agenten/delegation');
  const lauf = () => fadenLauf(person, auftrag, { origin: innenAdresse(req), hintergrund });
  try {
    const r = hintergrund ? await imHintergrund(lauf) : await lauf();
    // Plan-Freigaben, die der Lauf angelegt hat, auch in den Stapel (Art `plan`, idempotent) — für den Head-Thread des Laufs.
    if (r.fadenId) await planStapelnFuer(person, r.fadenId).catch(() => 0);
    // Gegenprüfung 09.10.: ein Lauf, der GELAUFEN ist (Status steht am Thread — auch „fehler“/„abgebrochen“), ist für die Warteschlange
    // erledigt — sonst reihte der Arbeiter ihn bis zu dreimal neu ein und der ganze Lauf (Modell, Vorschläge) liefe noch einmal. Neu
    // starten geht von Hand (Läufe › „Neu starten“). `laufOk` sagt, wie er ausging.
    const gelaufen = r.status === 200 && !!r.laufStatus;
    const ok = r.ok || gelaufen;
    return NextResponse.json({ ok, ...(gelaufen ? { laufOk: r.ok } : {}), ...(r.fadenId ? { fadenId: r.fadenId } : {}), ...(r.laufStatus ? { laufStatus: r.laufStatus } : {}), ergebnis: r.ergebnis, ...(ok ? {} : { fehler: r.ergebnis, error: r.ergebnis }) }, { status: r.status });
  } catch (e) {
    return nein(500, `Lauf fehlgeschlagen (${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}).`);
  }
}
