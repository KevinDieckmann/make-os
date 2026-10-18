// ─── CRM → Liquiditätsplan ──────────────────────────────────────────────────
// Ein unterschriebenes Mandat ist Geld, das kommt — aber es wird nicht
// automatisch geschrieben: Einige Eingänge (einzelne Kunden) stehen schon von Hand
// im Plan, und doppelt gezählt ist schlimmer als gar nicht. Deshalb:
// GET  → je Mandat der Posten, den es erzeugen würde, und ob er schon da ist
// POST { mandatId, aktion: 'anlegen' | 'verknuepfen' | 'beenden', postenId? } — „beenden“ gleicht die Posten an das Ende des beendeten Mandats an.
// 18.10. (Nachprüfung N4/N14): EIN Zahlplan mit der Monatsrechnung (lib/crm/mandat-laufzeit.ts) — angebrochene Monate als einmalige Posten
// `lp-mandat-<id>~JJJJ-MM`, die vollen Monate ein Monatsposten; Lage und Angleichen rein in lib/crm/kunden.ts (`mandatLiquiLage`, `postenAngleichen`).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { planpostenAus, mandatPosten, mandatLiquiLage, postenAngleichen, postenVomMandat, hauptPostenId, keinPostenGrund } from '@/lib/crm/kunden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const heute = localDay();
  const crm = await ladeCrm();
  const posten = (await loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [];
  return NextResponse.json({
    ok: true,
    mandate: crm.mandate.map(m => {
      const l = mandatLiquiLage(m, posten, heute);
      return {
        id: m.id, kunde: m.kunde, titel: m.titel, status: m.status, vorschlag: planpostenAus(m, heute), soll: l.soll,
        vorhanden: l.vorhanden, lage: l.lage, ...(l.grund ? { grund: l.grund } : {}), ...(l.letzteZahlung ? { letzteZahlung: l.letzteZahlung } : {}),
      };
    }),
    // Kandidaten zum Verknüpfen: Einnahmen der Kategorie Mandat ohne Mandat (auch kein Teilmonat eines Mandats).
    freiePosten: posten.filter(p => p.betrag > 0 && (p.kategorie === 'mandat' || !p.kategorie) && !crm.mandate.some(m => postenVomMandat(p.id, m))).map(p => ({ id: p.id, titel: p.titel, betrag: p.betrag, rhythmus: p.rhythmus })),
  });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { mandatId?: string; aktion?: string; postenId?: string };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
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
    // Anlegen bzw. „Plan angleichen“: Monatsposten und Teilmonate wie der Zahlplan (ein vorhandener Monatsposten übernimmt die Werte des Mandats).
    const heute = localDay();
    const soll = mandatPosten(m, heute);
    if (!soll.length) return NextResponse.json({ ok: false, fehler: `Aus diesem Mandat entsteht kein Posten: ${keinPostenGrund(m)}` }, { status: 400 });
    await updateJson<{ posten: Planposten[] }>('liquiplan', cur => ({ posten: postenAngleichen(cur?.posten ?? [], m, soll, heute) }));
    const haupt = soll.find(p => p.id === hauptPostenId(m));
    if (!m.planpostenId && haupt) await aendereCrm(cur => ({ ...cur, mandate: cur.mandate.map(x => (x.id === m.id ? { ...x, planpostenId: haupt.id } : x)) }));
    return NextResponse.json({ ok: true, posten: haupt ?? soll[0], soll });
  }
  if (b.aktion === 'beenden') {
    // Beendetes Mandat (17.10., L1 A2; 18.10. N4): die Posten enden mit dem Mandat — der letzte Monat anteilig wie die Rechnung. Am Monatsposten
    // ändern sich nur Beginn und Ende (Betrag, Titel, Sicherheit bleiben, wie sie im Plan stehen).
    if (m.status !== 'beendet') return NextResponse.json({ ok: false, fehler: 'Das Mandat ist nicht beendet.' }, { status: 400 });
    const heute = localDay();
    const soll = mandatPosten(m, heute, { beendet: true });
    let gefunden = false;
    await updateJson<{ posten: Planposten[] }>('liquiplan', cur => {
      const l = cur?.posten ?? [];
      gefunden = l.some(x => postenVomMandat(x.id, m));
      return gefunden ? { posten: postenAngleichen(l, m, soll, heute, { nurZeit: true }) } : cur ?? { posten: [] };
    });
    if (!gefunden) return NextResponse.json({ ok: false, fehler: 'Posten nicht im Liquiditätsplan.' }, { status: 404 });
    const lage = mandatLiquiLage(m, (await loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [], heute);
    return NextResponse.json({ ok: true, ...(lage.letzteZahlung ? { letzteZahlung: lage.letzteZahlung, bis: lage.letzteZahlung } : {}) });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: anlegen, verknuepfen oder beenden.' }, { status: 400 });
}
