// ─── Business-Index (25.09.) ────────────────────────────────────────────────
// GET  ?scope=gesamt|kdc|kdv → Index, Säulen, Kennzahlen (Wert, Ampel, Formel,
//      Quelle oder Messlücke), Trend, Ampel-Wechsel, Monatsabschlüsse, Einstellungen
// POST { aktion: 'abschluss', firma, monat, umsatz?, kosten?, personal?, … }
//      { aktion: 'abschluss_weg', firma, monat }
//      { aktion: 'einstellungen', fte?: { kdc?, kdv? }, ziele?: { kdc?, kdv? },
//        schwelle?: { id, sicht: 'alle'|'gesamt'|'kdc'|'kdv', gruen, rot } | { id, sicht, zuruecksetzen: true } }
// GET  ?kompakt=1 → nur diese Sicht, ohne Verlauf/Abschlüsse (für die Fachseiten)
// Nur der Haushalt des Inhabers (Kevin & Malin) und der Dienstweg.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { alleSichten, vergleich, speichereAbschluss, loescheAbschluss, speichereEinstellungen, ladeEinstellungen, ladeRoh, bestandFuer } from '@/lib/business/speicher';
import { berechne } from '@/lib/business/index';
import { SCOPES, type Scope } from '@/lib/business/register';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zum Business-Index — er gehört zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const q = new URL(req.url).searchParams;
  const s = q.get('scope');
  const scope: Scope = SCOPES.some(x => x.id === s) ? (s as Scope) : 'gesamt';
  if (q.get('kompakt') === '1') {
    // Fachseiten (Zahlen, Markttraktion, Mandate): nur diese Sicht, schnell.
    const roh = await ladeRoh();
    return NextResponse.json({ ok: true, scope, bi: berechne(bestandFuer(roh, scope)) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const { roh, ergebnis } = await alleSichten();
  const bi = ergebnis[scope];
  const { vor30, wechsel } = vergleich(roh.verlauf, scope, roh.heute, bi);
  const verlauf = Object.entries(roh.verlauf.tage ?? {}).filter(([t]) => t < roh.heute).sort(([a], [b]) => a.localeCompare(b)).slice(-90)
    .map(([tag, je]) => ({ tag, index: je[scope]?.index ?? null, saeulen: je[scope]?.saeulen ?? {}, werte: je[scope]?.werte ?? {} }));
  verlauf.push({ tag: roh.heute, index: bi.index, saeulen: Object.fromEntries(bi.saeulen.map(x => [x.id, x.score])), werte: Object.fromEntries(bi.saeulen.flatMap(x => x.kennzahlen.map(k => [k.id, k.wert]))) });
  return NextResponse.json({
    ok: true, scope, bi,
    sichten: Object.fromEntries(SCOPES.map(x => [x.id, { index: ergebnis[x.id].index, label: ergebnis[x.id].label }])),
    vor30, wechsel, verlauf,
    abschluesse: roh.abschluesse.slice(0, 36),
    einstellungen: await ladeEinstellungen(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'abschluss') {
    const r = await speichereAbschluss(b, wer.person);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (b.aktion === 'abschluss_weg') {
    if (!['kdc', 'kdv'].includes(String(b.firma)) || !/^\d{4}-\d{2}$/.test(String(b.monat))) return NextResponse.json({ ok: false, fehler: 'Firma und Monat nötig.' }, { status: 400 });
    await loescheAbschluss(String(b.firma), String(b.monat));
    return NextResponse.json({ ok: true });
  }
  if (b.aktion === 'einstellungen') {
    const r = await speichereEinstellungen(b);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
