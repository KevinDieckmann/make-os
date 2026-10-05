// ─── Kalender — Google: Business-Termine aus iCloud umziehen (03.10.2026) ────
// GET  ?kalender=<Name>&kalender=<Name>[&vergangen=1]  → Vorschau (schreibt NICHTS): welche iCloud-Kalender wählbar sind,
//                                                       was umzieht, was bleibt (mit Grund), Sicherung, Ziel
// POST { kalender: string[], mitVergangenen?, bestaetigt: true } → ausführen: Sicherung → je Termin Google anlegen →
//                                                       Verweise umhängen → in iCloud löschen (lib/kalender/google/umzug.ts)
// Nur die EIGENE Person (Sitzung), nie der Dienstweg; ohne `bestaetigt: true` passiert nichts. Eigene Aktion — nie automatisch.
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { umzugVorschau, umzugAusfuehren } from '@/lib/kalender/google/umzug';
import { werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const namen = (v: unknown): string[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 100).slice(0, 20);

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const v = await umzugVorschau(z.person, { kalender: namen(q.getAll('kalender')), mitVergangenen: q.get('vergangen') === '1' });
  return NextResponse.json({ ok: true, ...v, sicherung: `Vor dem Umzug wird jeder Termin als iCloud-Text gesichert (verschlüsselt, 30 Tage).` }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let b: { kalender?: unknown; mitVergangenen?: unknown; bestaetigt?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const kalender = namen(b.kalender);
  if (b.bestaetigt !== true || !kalender.length) return NextResponse.json({ ok: false, fehler: 'Bitte Kalender wählen und den Umzug bestätigen — vorher zeigt die Vorschau, was passiert.' }, { status: 400 });
  try {
    const r = await umzugAusfuehren(z.person, { kalender, mitVergangenen: b.mitVergangenen === true }, werAus(req));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Umzug nicht möglich.' }, { status: 409 });
  }
}
