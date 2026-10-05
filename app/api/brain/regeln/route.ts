// ─── /api/brain/regeln — Konstitution + Regelregister (27.09.) ──────────────
// GET: Konstitution und Regeln, die die Person sehen darf. POST (Haushalt des Inhabers):
//   { aktion: 'anlegen', titel, text, prioritaet, giltFuer, status, quelle, scope }
//   { aktion: 'aendern', id, felder }  ·  { aktion: 'archivieren', id }
//   { aktion: 'konstitution', text }
// Menschen schreiben hier — ZOE nur über die Inbox (Vorschlag mit Freigabe).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personAus } from '@/lib/zoe/raum';
import { regelnLesen, konstitutionLesen, konstitutionSchreiben, regelAnlegen, regelAendern, regelArchivieren, KONSTITUTION_MAX_ZEILEN, type NeueRegel } from '@/lib/brain/regeln';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const person = personAus(req);
  const [konstitution, regeln] = await Promise.all([konstitutionLesen(), regelnLesen({ person })]);
  return NextResponse.json({ ok: true, person, konstitution, regeln, maxZeilen: KONSTITUTION_MAX_ZEILEN }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const person = personAus(req);
  let b: { aktion?: string; id?: string; text?: string; felder?: Partial<NeueRegel> } & Partial<NeueRegel>;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const sicht = { person };
  if (b.aktion === 'konstitution') { const r = await konstitutionSchreiben(String(b.text ?? ''), person); return NextResponse.json({ ...r, konstitution: await konstitutionLesen() }, { status: r.ok ? 200 : 400 }); }
  if (b.aktion === 'anlegen') { const r = await regelAnlegen({ titel: String(b.titel ?? ''), text: String(b.text ?? ''), prioritaet: b.prioritaet, giltFuer: b.giltFuer, status: b.status, quelle: b.quelle, scope: b.scope }, person); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  if (b.aktion === 'aendern') { const r = await regelAendern(String(b.id ?? ''), b.felder ?? {}, person, sicht); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  if (b.aktion === 'archivieren') { const r = await regelArchivieren(String(b.id ?? ''), person, sicht); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
