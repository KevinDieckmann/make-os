// ─── MAKE OS — Kontakte (das CRM) ───────────────────────────────────────────
// GET: alle Kontakte plus Stand der Pipeline. 443 Einträge sind klein genug,
// dass die Oberfläche selbst filtert — eine Suche über die Schnittstelle
// wäre eine zweite Wahrheit darüber, was „passt".
// PATCH: einzelne Änderungen (upsert/delete) nach dem Zwei-Fenster-Muster —
// mit der Massen-Wache für Stufen: mehr als zwölf Kontakte auf einmal in
// eine andere Stufe ist nie ein Klick, sondern ein Fehler.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { listePatchen, opsLesen } from '@/lib/store/patch-liste';
import { saeubereKontakt, kontaktVereinen, privatNotizVereinen, fuerPerson, massenStufe, pipelineStand, MASSEN_GRENZE, type Kontakt } from '@/lib/make-one/crm';
import { personAus } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bestand = { kontakte: Kontakt[] };

export async function GET(req: Request) {
  const f = await loadJson<Bestand>('kontakte');
  const person = personAus(req);
  // Private Notizen sieht nur, wer sie schrieb.
  const kontakte = (f?.kontakte ?? []).map(k => fuerPerson(k, person));
  return NextResponse.json({ kontakte, stand: pipelineStand(kontakte) });
}

export async function PATCH(req: Request) {
  let body: { ops?: unknown; erzwingen?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = opsLesen<Kontakt>(body.ops, saeubereKontakt);
  if (!roh) return NextResponse.json({ error: 'ops muss eine Liste sein.' }, { status: 400 });
  const person = personAus(req);
  // Neue Kontakte: eine private Notiz gehört der Person, die sie anlegt.
  const ops = roh.map(o => (o.op === 'upsert' && o.eintrag ? { ...o, eintrag: privatNotizVereinen(o.eintrag, undefined, person) } : o));

  // Massen-Wache: wie viele Stufen würden sich ändern?
  const vorher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
  const nachher = ops.filter(o => o.op === 'upsert').map(o => o.eintrag!);
  const wechsel = massenStufe(vorher, nachher);
  if (wechsel > MASSEN_GRENZE && !body.erzwingen) {
    return NextResponse.json({ error: `${wechsel} Kontakte würden die Stufe wechseln — das braucht eine ausdrückliche Bestätigung.`, wechsel }, { status: 409 });
  }

  const r = await listePatchen<Kontakt, Bestand>('kontakte', 'kontakte', ops, 20, (neu, alt) => kontaktVereinen(neu, alt, person));
  if (!r.ok) return NextResponse.json({ error: r.fehler }, { status: 409 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, stand: pipelineStand(r.next?.kontakte ?? []) });
}
