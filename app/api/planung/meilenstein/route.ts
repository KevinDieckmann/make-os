// ─── MAKE OS — Meilenstein im Detail: Aufgaben-Liste + Austausch (30.09.) ────
// GET  ?id=<Meilenstein>  → { meilenstein, raum, listeId, projektId, spaceId }. Sichert „lazy“ die Aufgaben-Liste des
//                           Meilensteins (falls ein Schreiber sie noch nicht angelegt hat — lib/planung/meilenstein-aufgaben-server.ts).
// POST { id, aktion }     → Verlauf (senden · bearbeiten · entfernen), Notiz (mit `stand`, 409), Links. Antwort: der Raum.
// Zugang: nur Personen im Haushalt des Inhabers (Sitzung oder Dienstweg MIT Person — kein Systemlauf, kein Rückfall
// auf „kevin“); schreiben mit Build-Kennung (bauPruefen); Körper ≤ 128 KB (413); Grenzen je Feld → 413, nie gekürzt.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { zuGross } from '@/lib/zugang/umfang';
import { mitStand } from '@/lib/store/fingerabdruck';
import type { Meilenstein } from '@/lib/planung/typen';
import { meilensteinListeId, meilensteinProjektId, meilensteinAufgabenSpace } from '@/lib/planung/meilenstein-aufgaben';
import { meilensteinStrukturSichern } from '@/lib/planung/meilenstein-aufgaben-server';
import { aktionLesen, raumFuerBrowser } from '@/lib/planung/meilenstein-raum';
import { raumLaden, raumAendern } from '@/lib/planung/meilenstein-raum-server';
import { meilensteineSichtbarFuer } from '@/lib/planung/eigene-ziele-sicht-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 128 * 1024;
const GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
const KENNUNG = /^[A-Za-z0-9_~:.-]{1,80}$/;

async function zugangUndHaushalt(req: Request): Promise<{ person: string; haushalt: string } | NextResponse> {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return GESPERRT();
  const h = await haushaltFuer(z.person);
  if (!h) return NextResponse.json({ ok: false, error: 'Kein Haushalt zu dieser Person.' }, { status: 403 });
  return { person: z.person, haushalt: h.haushalt };
}

/**
 * Der Meilenstein, wie `person` ihn sehen darf (08.10., eigene Ziele nur geteilt): einer aus dem Altbestand, der an einem nicht geteilten
 * eigenen Ziel einer anderen Person hängt, gibt es für sie nicht (404 — lesen UND Verlauf/Notiz schreiben, wie PATCH /api/state/meilensteine).
 */
async function meilensteinFinden(id: string, person: string): Promise<Meilenstein | null> {
  const f = await loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine');
  const m = (Array.isArray(f?.meilensteine) ? f!.meilensteine : []).find(x => x.id === id);
  return m ? (await meilensteineSichtbarFuer([m], person))[0] ?? null : null;
}

export async function GET(req: Request) {
  const z = await zugangUndHaushalt(req);
  if (z instanceof NextResponse) return z;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!KENNUNG.test(id)) return NextResponse.json({ ok: false, error: 'Kennung fehlt.' }, { status: 400 });
  const m = await meilensteinFinden(id, z.person);
  if (!m) return NextResponse.json({ ok: false, error: 'Diesen Meilenstein gibt es nicht (mehr).' }, { status: 404 });
  // Lazy: die Liste entsteht spätestens hier (idempotent — schreibt nur, wenn etwas fehlt oder abweicht).
  await meilensteinStrukturSichern([id], { person: z.person });
  const spaceId = meilensteinAufgabenSpace(m);
  return NextResponse.json({
    ok: true, meilenstein: mitStand([m])[0], raum: raumFuerBrowser(await raumLaden(z.haushalt, id)),
    listeId: meilensteinListeId(id), projektId: meilensteinProjektId(spaceId), spaceId,
  });
}

export async function POST(req: Request) {
  const z = await zugangUndHaushalt(req);
  if (z instanceof NextResponse) return z;
  const alt = bauPruefen(req);
  if (alt) return alt;
  if (zuGross(req, MAX_BYTES)) return NextResponse.json({ ok: false, error: 'Abgelehnt: zu groß (höchstens 128 KB). Nichts gespeichert.' }, { status: 413 });
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = typeof b?.id === 'string' && KENNUNG.test(b.id) ? b.id : null;
  const aktion = aktionLesen(b?.aktion);
  if (!id || !aktion) return NextResponse.json({ ok: false, error: 'id + aktion nötig.' }, { status: 400 });
  const m = await meilensteinFinden(id, z.person);
  if (!m) return NextResponse.json({ ok: false, error: 'Diesen Meilenstein gibt es nicht (mehr).' }, { status: 404 });
  const r = await raumAendern(z.haushalt, id, m.titel, aktion, z.person);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.fehler, ...(r.status === 409 ? { raum: raumFuerBrowser(await raumLaden(z.haushalt, id)) } : {}) }, { status: r.status });
  }
  return NextResponse.json({ ok: true, raum: raumFuerBrowser(r.raum) });
}
