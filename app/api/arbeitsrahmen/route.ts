// ─── Arbeitsrahmen — Business-freie Zeiten der EIGENEN Person (08.10., Lücke 7) ────────────────────────────────────────
// GET  ?von=YYYY-MM-DD&bis=YYYY-MM-DD (Standard: heute + 7 Tage, höchstens 62)
//      → { jetzt: { frei, bis?, bisText? }, fenster: Spanne[] (eigene, im Zeitraum), eigene: { fenster, stand },
//          familie: { gilt }, andere: [{ person, name, frei, bis? }] }
// PUT  { fenster: BusinessFreiFenster[], stand } → eigene Ergänzung speichern (nur einschränken; > 10 → 413, ungültig → 400,
//      fremder Stand → 409)
// Nur die angemeldete Person selbst (`eigenePerson`: Sitzung, Haushalt des Inhabers; Dienstweg und andere Konten 403) — keine
// Personen-Parameter. Die gemeinsamen Zeiten der Familie stecken in `fenster`, aber nur für volle Mitglieder des Haushalts
// (`familie.gilt`); ihre Einstellung selbst bleibt in Familie › Rahmen. Über andere Personen gibt es NUR ja/nein — volle
// Mitglieder sehen dazu „bis“, Konten mit `finanzRecht: 'business'` nie (Plattform-Regel: Trennung serverseitig).
// Regel: lib/arbeitsrahmen/regel.ts, Laden/Schreiben: lib/arbeitsrahmen/server.ts.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { eigenePerson } from '@/lib/google/zugang';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { bisText } from '@/lib/arbeitsrahmen/regel';
import { andereStatus, businessFreiFensterFuer, businessFreiJetzt, eigeneLesen, eigeneSetzen, rahmenFuer } from '@/lib/arbeitsrahmen/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false as const, fehler: 'Den eigenen Arbeitsrahmen sieht und pflegt nur die Person selbst — angemeldet, nie über den Dienstweg.' };
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const TAGE_MAX = 62;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const jetzt = new Date();
  const heute = localDay(jetzt);
  const von = TAG.test(q.get('von') ?? '') ? q.get('von')! : heute;
  const bisRoh = TAG.test(q.get('bis') ?? '') ? q.get('bis')! : tagPlus(von, 7);
  const bis = bisRoh > von ? (bisRoh <= tagPlus(von, TAGE_MAX) ? bisRoh : tagPlus(von, TAGE_MAX)) : tagPlus(von, 1);
  const [fenster, frei, eigene, rahmen, andere] = await Promise.all([
    businessFreiFensterFuer(z.person, von, bis),
    businessFreiJetzt(z.person, jetzt),
    eigeneLesen(z.person),
    rahmenFuer(z.person),
    andereStatus(z.person, jetzt),
  ]);
  return NextResponse.json({
    ok: true, von, bis,
    jetzt: frei.frei && frei.bisWand ? { frei: true, bis: frei.bisWand, bisText: bisText(frei.bisWand, heute) } : { frei: false },
    fenster,
    eigene,
    familie: { gilt: rahmen.ausFamilie },
    andere: andere.map(a => ({ person: a.person, name: a.name, frei: a.frei, ...(a.bisWand ? { bis: a.bisWand, bisText: bisText(a.bisWand, heute) } : {}) })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: { fenster?: unknown; stand?: unknown };
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await eigeneSetzen(z.person, b?.fenster, b?.stand);
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.status === 409 ? { eigene: await eigeneLesen(z.person) } : {}) }, { status: r.status });
  return NextResponse.json({ ok: true, eigene: { fenster: r.fenster, stand: r.stand } });
}
