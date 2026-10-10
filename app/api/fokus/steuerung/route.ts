// ─── MAKE OS — Fokus-Steuerung: Prioritäten und Zeit je Bereich (10.10.) ─────────────────────────────────────────────────────────
// Entscheidung 10.10.: „Prio und Fokus geben wir im Fokus-Bereich … dort auch das Thema Zeit — Privat wie Business einzeln.“ Bestände
// getrennt nach Privat und Business (lib/fokus/steuerung.ts), Lesen/Schreiben NUR über lib/fokus/steuerung-server.ts.
//   GET  ?bereich=privat|business → Themen des Haushalts DIESES Bereichs, eigenes Soll, eigene Ist-Zeit NUR aus diesem Bereich, Passung.
//        Ohne Person 401, ohne Haushalt 403, Privat mit Konto „nur Business“ 403 — die Antwort trägt nie ein Thema des anderen Bereichs.
//   PUT  { bereich, aktion: 'themen', themen, stand } | { bereich, aktion: 'vorgabe', stand } — Stand/409 (die aktuelle Sicht kommt mit);
//        Grenzen → 413 (nie gekürzt); nur volle Mitglieder. Spiegelt die Gewichte in den früheren Fokus-Regler (nur Säulen des Bereichs).
//   PUT  { bereich, aktion: 'soll', soll: { <thema>: h/Woche | null } } — eigene Soll-Zeit; jede Person für sich.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ohnePerson, personStreng, planZugangVon } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { istSteuerBereich } from '@/lib/fokus/steuerung';
import { sollSchreiben, steuerungSichtFuer, themenSchreiben } from '@/lib/fokus/steuerung-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OHNE_HAUSHALT = () => NextResponse.json({ ok: false, error: 'Die Steuerung gehört zu einem Haushalt — dieses Konto hat keinen.' }, { status: 403 });
const fehler = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request) {
  const person = personStreng(req);
  if (!person) return ohnePerson();
  if (!(await planZugangVon(req))) return OHNE_HAUSHALT();
  const bereich = new URL(req.url).searchParams.get('bereich') ?? 'privat';
  if (!istSteuerBereich(bereich)) return fehler('bereich privat|business nötig.', 400);
  const s = await steuerungSichtFuer(person, bereich);
  if ('fehler' in s) return fehler(s.fehler, s.status);
  return NextResponse.json({ ok: true, ...s }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  const person = personStreng(req);
  if (!person) return ohnePerson();
  if (!(await planZugangVon(req))) return OHNE_HAUSHALT();
  const bau = bauPruefen(req); if (bau) return bau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (!istSteuerBereich(b.bereich)) return fehler('bereich privat|business nötig.', 400);
  if (b.aktion === 'soll') {
    const r = await sollSchreiben(person, b.bereich, b.soll, werAus(req));
    if (!r.ok) return fehler(r.fehler, r.status);
    return NextResponse.json({ ok: true, soll: r.soll });
  }
  if (b.aktion !== 'themen' && b.aktion !== 'vorgabe') return fehler('aktion themen|vorgabe|soll nötig.', 400);
  if (typeof b.stand !== 'string' || !b.stand) return fehler('Stand fehlt — Seite neu laden.', 400);
  const r = await themenSchreiben(person, b.bereich, { themen: b.themen, vorgabe: b.aktion === 'vorgabe', stand: b.stand }, werAus(req));
  if (!r.ok && 'konflikt' in r) {
    const aktuell = await steuerungSichtFuer(person, b.bereich);
    return NextResponse.json({ ok: false, konflikt: true, error: 'Die Themen wurden inzwischen geändert — die neue Fassung ist geladen, deine Änderung ist nicht gespeichert.', ...(!('fehler' in aktuell) ? { sicht: aktuell } : {}) }, { status: 409 });
  }
  if (!r.ok) return fehler(r.fehler, r.status);
  return NextResponse.json({ ok: true, geaendert: r.geaendert });
}
