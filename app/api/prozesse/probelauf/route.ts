// ─── Prozesse — Probelauf (Etappe C1, 21.10.; ANALYSE_100.md Punkt 48 — Vertrag mit der Werkstatt B2) ─────────────────────────────────────────────────
// POST { prozessId, quelle: 'entwurf' | 'version', fall?: { art, id } | 'beispiel' }
//   → { ok, schritte: [{ knotenId, status: 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler', text, kostenCent? }], kostenSchaetzungCent, befunde }
// Derselbe Motor-Code wie der echte Lauf, nur im Schatten (lib/prozesse/lauf-server.ts `probelauf` → lib/prozesse/lauf-regeln.ts `voran`): spielt den
// Entwurf bzw. die jüngste Version mit einem echten Fall (Kennung) oder dem erfundenen Beispiel durch. Schreibt NICHTS — keinen Lauf, keine Aufgabe, keinen
// Vorschlag, keine Glocke, kein Modellaufruf (Agenten-Schritte nur „würde … fragen, ca. x ct“). Die Sätze nennen nur Titel der Schritte, nie Daten des Falls.
// Tor: `werkstattZugang` (Haushalt des Inhabers, Sicht Privat 403); nur eine angemeldete Person (Dienstweg 403).

import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { PROZESS_KENNUNG, FALL_ART_IDS } from '@/lib/prozesse/definition';
import { FALL_KENNUNG } from '@/lib/prozesse/lauf-typen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler }, { status });

export async function POST(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  if (z.dienst) return nein(403, 'Den Probelauf startet nur eine angemeldete Person.');
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const prozessId = typeof b.prozessId === 'string' && PROZESS_KENNUNG.test(b.prozessId) ? b.prozessId : null;
  if (!prozessId) return nein(400, 'Welcher Prozess? (prozessId pz-…)');
  const quelle = b.quelle === 'version' ? 'version' : b.quelle === 'entwurf' || b.quelle === undefined ? 'entwurf' : null;
  if (!quelle) return nein(400, 'quelle: entwurf oder version.');
  let fall: { art: string; id: string } | 'beispiel' | undefined;
  if (b.fall === 'beispiel' || b.fall === undefined || b.fall === null) fall = 'beispiel';
  else if (b.fall && typeof b.fall === 'object') {
    const f = b.fall as { art?: unknown; id?: unknown };
    if (typeof f.art !== 'string' || !(FALL_ART_IDS as readonly string[]).includes(f.art) || typeof f.id !== 'string' || !FALL_KENNUNG.test(f.id)) return nein(400, 'fall: { art, id } oder „beispiel“.');
    fall = { art: f.art, id: f.id };
  } else return nein(400, 'fall: { art, id } oder „beispiel“.');
  const { probelauf } = await import('@/lib/prozesse/lauf-server');
  const r = await probelauf({ prozessId, quelle, fall, person: z.person });
  if (!r.ok) return nein(r.status, r.fehler);
  return NextResponse.json({ ok: true, schritte: r.schritte, kostenSchaetzungCent: r.kostenSchaetzungCent, befunde: r.befunde });
}
