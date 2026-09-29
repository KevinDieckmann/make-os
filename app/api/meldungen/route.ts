// ─── MAKE OS — Meldungen der Glocke (28.09. abends, Paket B2) ───────────────
// GET  → { ok, meldungen, ungelesen, einstellungen, heute } · ETag (Person + Berliner Tag + Stand
//        von `meldungen--<person>` und `tasks`) → 304, wenn sich nichts geändert hat.
// POST { aktion: 'gelesen', ids?: string[], alle?: true }  → dieselbe Sicht, frisch.
// POST { aktion: 'einstellungen', telegram: boolean }      → Kanal vorgesehen, versendet noch nichts.
// Zugang: angemeldete Person im Haushalt des Inhabers (`imHaushaltDesInhabers` — streng, Regel 5);
// Dienstweg ohne Person → 403. Es gibt nur die EIGENEN Meldungen — keine Abfrage für andere Personen.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { zuGross } from '@/lib/zugang/umfang';
import { etagAus, unveraendert, jsonAntwort } from '@/lib/http/json-antwort';
import { heuteBerlin, meldungenEinstellen, meldungenGelesen, meldungenSicht, meldungenStand } from '@/lib/meldungen/speicher';
import { GELESEN_IDS_MAX, MELDUNG_ID_OK } from '@/lib/meldungen/regeln';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Meldungen nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;

/** Die eigene Person — oder null (→ 403). Kein Rückfall, kein Systemlauf. */
async function eigenePerson(req: Request): Promise<string | null> {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return null;
  // Doppelt gesichert: die Person der Sitzung (bzw. des Dienstwegs) muss genau diese sein.
  return personStreng(req) === w.person || (w.dienst && req.headers.get('x-make-person') === w.person) ? w.person : null;
}

export async function GET(req: Request) {
  const person = await eigenePerson(req);
  if (!person) return NextResponse.json(GESPERRT, { status: 403 });
  const jetzt = new Date();
  const etag = etagAus('meldungen2', person, heuteBerlin(jetzt), await meldungenStand(person, jetzt));
  const nichts = unveraendert(req, etag);
  if (nichts) return nichts;
  const sicht = await meldungenSicht(person, jetzt);
  return jsonAntwort(req, { ok: true, ...sicht }, etag);
}

export async function POST(req: Request) {
  const person = await eigenePerson(req);
  if (!person) return NextResponse.json(GESPERRT, { status: 403 });
  if (zuGross(req, 200_000)) return NextResponse.json({ ok: false, fehler: 'Zu groß.' }, { status: 413 });
  let body: { aktion?: unknown; ids?: unknown; alle?: unknown; telegram?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (body.aktion === 'gelesen') {
    const alle = body.alle === true;
    if (body.ids !== undefined && !Array.isArray(body.ids)) return NextResponse.json({ ok: false, fehler: 'ids muss eine Liste sein.' }, { status: 400 });
    const roh = (body.ids ?? []) as unknown[];
    // Nie still kürzen: zu viele Kennungen → 413 mit Text.
    if (roh.length > GELESEN_IDS_MAX) return NextResponse.json({ ok: false, fehler: `Höchstens ${GELESEN_IDS_MAX} Meldungen auf einmal — „alle“ nutzen.` }, { status: 413 });
    const ids = roh.filter((x): x is string => typeof x === 'string' && MELDUNG_ID_OK.test(x));
    if (!alle && !ids.length) return NextResponse.json({ ok: false, fehler: 'ids oder alle angeben.' }, { status: 400 });
    const sicht = await meldungenGelesen(person, { ids, alle });
    return NextResponse.json({ ok: true, ...sicht });
  }
  if (body.aktion === 'einstellungen') {
    if (typeof body.telegram !== 'boolean') return NextResponse.json({ ok: false, fehler: 'telegram muss an oder aus sein.' }, { status: 400 });
    const sicht = await meldungenEinstellen(person, { telegram: body.telegram });
    return NextResponse.json({ ok: true, ...sicht });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
