// ─── MAKE OS — Aufträge einreihen und ansehen ───────────────────────────────
// GET  Stand und Liste. POST reiht ein — mehrere auf einmal, das ist der Sinn.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { reihe, lies, stand, type NeuerAuftrag } from '@/lib/zoe/auftraege';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { modellSchranke } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  // Sichtbar sind die eigenen Aufträge und die des Systems (ohne Person) — nie
  // Eingabe und Ergebnis, die für die andere Person liefen (26.09.).
  const person = personStreng(req);
  const [liste, s] = await Promise.all([lies(), stand()]);
  return NextResponse.json({ ok: true, stand: s, auftraege: liste.filter(a => !a.person || a.person === person).slice(0, 120) });
}

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt(); // einreihen auch der Systemlauf (Takt, starte_auftraege)
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { auftraege?: NeuerAuftrag[] };
  try { body = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Die Person kommt aus der Sitzung (bzw. dem Dienstkopf), nie aus dem Body —
  // sonst könnte jedes Konto einen Auftrag als jemand anderes einreihen (26.09.).
  const person = personStreng(req) ?? undefined;
  const neue = (Array.isArray(body.auftraege) ? body.auftraege : [])
    .filter(a => a && (a.art === 'werkzeug' || a.art === 'agent') && typeof a.name === 'string')
    .slice(0, 40)
    .map(a => ({ ...a, person }));
  if (!neue.length) return NextResponse.json({ ok: false, error: 'Keine Aufträge übergeben.' }, { status: 400 });
  const { angelegt, schonDa } = await reihe(neue);
  return NextResponse.json({ ok: true, angelegt: angelegt.length, schonDa, ids: angelegt.map(a => a.id) });
}
