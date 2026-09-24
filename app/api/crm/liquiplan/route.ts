// ─── CRM → Liquiditätsplan ──────────────────────────────────────────────────
// Ein unterschriebenes Mandat ist Geld, das kommt — aber es wird nicht
// automatisch geschrieben: Einige Eingänge (OneBanking) stehen schon von Hand
// im Plan, und doppelt gezählt ist schlimmer als gar nicht. Deshalb:
// GET  → je Mandat der Posten, den es erzeugen würde, und ob er schon da ist
// POST { mandatId, aktion: 'anlegen' | 'verknuepfen', postenId? }

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { planpostenAus } from '@/lib/crm/kunden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const heute = localDay();
  const crm = await ladeCrm();
  const posten = (await loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [];
  return NextResponse.json({
    ok: true,
    mandate: crm.mandate.map(m => {
      const vorschlag = planpostenAus(m, heute);
      const da = posten.find(p => p.id === (m.planpostenId ?? `lp-mandat-${m.id}`));
      return {
        id: m.id, kunde: m.kunde, titel: m.titel, status: m.status, vorschlag,
        vorhanden: da ?? null,
        lage: !vorschlag ? 'kein-posten' : !da ? 'fehlt' : Math.abs(da.betrag - vorschlag.betrag) > 1 || da.rhythmus !== vorschlag.rhythmus ? 'abweichend' : 'ok',
      };
    }),
    // Kandidaten zum Verknüpfen: Einnahmen der Kategorie Mandat ohne Mandat.
    freiePosten: posten.filter(p => p.betrag > 0 && (p.kategorie === 'mandat' || !p.kategorie) && !crm.mandate.some(m => (m.planpostenId ?? `lp-mandat-${m.id}`) === p.id)).map(p => ({ id: p.id, titel: p.titel, betrag: p.betrag, rhythmus: p.rhythmus })),
  });
}

export async function POST(req: Request) {
  let b: { mandatId?: string; aktion?: string; postenId?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const crm = await ladeCrm();
  const m = crm.mandate.find(x => x.id === b.mandatId);
  if (!m) return NextResponse.json({ ok: false, fehler: 'Mandat nicht gefunden.' }, { status: 404 });
  if (b.aktion === 'verknuepfen') {
    const posten = (await loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [];
    if (!posten.some(p => p.id === b.postenId)) return NextResponse.json({ ok: false, fehler: 'Posten nicht im Liquiditätsplan.' }, { status: 404 });
    await aendereCrm(cur => ({ ...cur, mandate: cur.mandate.map(x => (x.id === m.id ? { ...x, planpostenId: b.postenId, geaendert: new Date().toISOString() } : x)) }));
    return NextResponse.json({ ok: true, verknuepft: b.postenId });
  }
  if (b.aktion === 'anlegen') {
    const p = planpostenAus(m, localDay());
    if (!p) return NextResponse.json({ ok: false, fehler: 'Aus diesem Mandat entsteht kein Posten (Status oder Honorar fehlt).' }, { status: 400 });
    await updateJson<{ posten: Planposten[] }>('liquiplan', cur => {
      const l = cur?.posten ?? [];
      return { posten: l.some(x => x.id === p.id) ? l.map(x => (x.id === p.id ? { ...x, ...p } : x)) : [...l, p] };
    });
    if (!m.planpostenId) await aendereCrm(cur => ({ ...cur, mandate: cur.mandate.map(x => (x.id === m.id ? { ...x, planpostenId: p.id } : x)) }));
    return NextResponse.json({ ok: true, posten: p });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: anlegen oder verknuepfen.' }, { status: 400 });
}
