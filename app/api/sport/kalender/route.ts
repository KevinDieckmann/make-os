// ─── MAKE OS — Sport: eine geplante Einheit als Block in den EIGENEN Kalender (09.10.2026) ──────────────────────────────
// POST { datum, einheitId, startMin } — nur die angemeldete Person, nur nach ihrem Klick (Dienstweg → 403: ZOE, Takt und Skripte legen
// keine Trainings-Blöcke an). Der Block geht über den VORHANDENEN Weg (lib/planung/bloecke-server.ts `blockAnlegen`: Art „routine“, Kalender
// der Person, eigenes iCloud-Konto zuerst, Änderungsprotokoll) — kein eigener Kalenderweg daneben. Titel neutral („Training · Lauf · Intervall“),
// Dauer aus der geplanten Einheit. Seit 11.10. immer privat (andere sehen nur „Belegt“). Schon ein Block mit diesem Titel an dem Tag zur selben Zeit → 409 (nichts doppelt).

import { NextResponse } from 'next/server';
import { personStreng, istDienst } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { saeubere, PLAN_LABEL, TYP_LABEL } from '@/lib/sport/modell';
import { geplanteEinheiten } from '@/lib/sport/plan-bau';
import { montagVon, tagPlus } from '@/lib/sport/pace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler, error: fehler }, { status });

export async function POST(req: Request) {
  if (istDienst(req)) return nein(403, 'Trainings-Blöcke legt nur die Person selbst an — nie ZOE oder ein Skript.');
  const person = personStreng(req);
  if (!person) return nein(401, 'Bitte anmelden — Sport ist persönlich.');
  const bau = bauPruefen(req);
  if (bau) return bau;
  let body: { datum?: unknown; einheitId?: unknown; startMin?: unknown };
  try { body = await jsonBegrenzt(req, 4_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  const datum = typeof body.datum === 'string' && TAG.test(body.datum) ? body.datum : null;
  const einheitId = typeof body.einheitId === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(body.einheitId) ? body.einheitId : null;
  const startMin = typeof body.startMin === 'number' && Number.isInteger(body.startMin) && body.startMin >= 0 && body.startMin < 24 * 60 ? body.startMin : null;
  if (!datum || !einheitId || startMin === null) return nein(400, 'Datum, Einheit und Uhrzeit fehlen.');

  const stand = saeubere(await loadJson<unknown>(speicherFuer('sport', person)));
  const g = geplanteEinheiten(stand, montagVon(datum)).find(x => x.datum === datum && x.einheit.id === einheitId);
  if (!g) return nein(404, 'Diese Einheit steht an dem Tag nicht (mehr) im Plan.');
  const titel = ['Training', PLAN_LABEL[g.einheit.sparte], g.einheit.typ ? TYP_LABEL[g.einheit.typ] : null].filter(Boolean).join(' · ');
  const dauerMin = g.einheit.dauerMin ?? 60;

  const [{ planBloeckeLesen, blockAnlegen }, { KalenderFehler }] = await Promise.all([import('@/lib/planung/bloecke-server'), import('@/lib/kalender/icloud')]);
  try {
    const da = await planBloeckeLesen({ von: datum, bis: tagPlus(datum, 1), person, archiv: false });
    if (da.some(b => b.date === datum && b.titel === titel && Math.abs(b.startMin - startMin) < 15)) return nein(409, 'Dieser Block steht schon im Kalender.');
    // Prüf-Fund 11.10.: privat — Training ist Gesundheit; andere sehen den Block nur „Belegt“ (ohne Titel).
    const r = await blockAnlegen(person, { date: datum, startMin, dauerMin, titel, art: 'routine', privat: true }, { art: 'person', person });
    return NextResponse.json({ ok: true, uid: r.uid });
  } catch (e) {
    if (e instanceof KalenderFehler) return nein(e.status >= 400 && e.status < 600 ? e.status : 502, e.message);
    return nein(502, 'Der Kalender war nicht erreichbar — nichts angelegt.');
  }
}
