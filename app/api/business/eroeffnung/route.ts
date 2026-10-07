// ─── 0-Punkt (Eröffnung) je Business-Gesellschaft (05.10.) ───────────────────────────────────────────────────────────────────────
// GET  → { eintraege (Historie, jüngste zuerst), geltend (je Gesellschaft), firmen (Business-Gesellschaften), archiv (was vor dem 0-Punkt
//        liegt: Zahlen + Posten), darf } · ?nur=geltend → { geltend } (für Ansichten, die nur rechnen)
// POST { aktion: 'setzen', firma, stichtag, kontostand, forderungen?: [{ name, betrag, faellig? }], verbindlichkeiten?: […], notiz?, basis? }
//      { aktion: 'zuruecknehmen', firma, basis? }  → Rückgängig: die geltende Eröffnung zurücknehmen (bleibt in der Historie)
// Nur Business-Gesellschaften (`istBusinessGesellschaft`) — die Selbstständigkeit/Privat → 400 „gehört zu Privat“. Bestand und Regeln:
// lib/business/eroeffnung.ts (rein) + lib/business/eroeffnung-server.ts. Zugang: Haushalt des Inhabers (wie der Business-Index); schreiben
// nur Personen mit Finanzrecht im Haushalt (Inhaber oder Konto mit Haushalt — volles oder Business-Finanzrecht), nie der Dienstweg/ZOE.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross, JSON_GRENZE } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, istInhaber, nurHaushalt } from '@/lib/zugang/tor';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { BUSINESS_GESELLSCHAFTEN, GEHOERT_ZU_PRIVAT, finanzOrtName, istBusinessGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { geltendeEroeffnungen } from '@/lib/business/eroeffnung';
import { archivAnsicht, ladeEroeffnungen, nimmEroeffnungZurueck, speichereEroeffnung } from '@/lib/business/eroeffnung-server';
import { businessGeaendert } from '@/lib/business/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Schreiben: Inhaber oder ein Konto mit Finanzrecht im Haushalt (voll oder „business“) — die Eröffnung ist Business-Buchführung. */
async function darfSchreiben(person: string): Promise<boolean> {
  return (await istInhaber(person)) || !!(await planZugangFuer(person));
}

export async function GET(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return nurHaushalt();
  leseZugriff(req, 'finanzplan'); // Lese-Protokoll (Kontostände, offene Posten)
  const eintraege = (await ladeEroeffnungen()).filter(e => istBusinessGesellschaft(e.firma)).sort((a, b) => b.gesetztAm.localeCompare(a.gesetztAm));
  const geltend = geltendeEroeffnungen(eintraege);
  // Ansichten, die nur rechnen (Zahlen, Liquidität, Controlling): nur die geltenden Eröffnungen, ohne Historie und Archiv.
  if (new URL(req.url).searchParams.get('nur') === 'geltend') return NextResponse.json({ ok: true, geltend }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({
    ok: true, eintraege, geltend,
    firmen: BUSINESS_GESELLSCHAFTEN.map(id => ({ id, label: finanzOrtName(id) })),
    archiv: await archivAnsicht(geltend),
    darf: !wer.dienst && await darfSchreiben(wer.person),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return nurHaushalt();
  // Human-in-the-Loop: die Eröffnung setzt ein Mensch in der App — nie ZOE oder ein Hintergrundlauf.
  if (wer.dienst || !(await darfSchreiben(wer.person))) return NextResponse.json({ ok: false, fehler: 'Die Eröffnung setzen nur Personen mit Finanzrecht im Haushalt.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, JSON_GRENZE); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });
  const firma = b.firma;
  if (istGesellschaft(firma) && !istBusinessGesellschaft(firma)) return NextResponse.json({ ok: false, fehler: GEHOERT_ZU_PRIVAT(firma) }, { status: 400 });
  if (!istBusinessGesellschaft(firma)) return NextResponse.json({ ok: false, fehler: `Gesellschaft fehlt (${BUSINESS_GESELLSCHAFTEN.map(finanzOrtName).join(' oder ')}).` }, { status: 400 });
  const r = b.aktion === 'setzen' ? await speichereEroeffnung(b, wer.person)
    : b.aktion === 'zuruecknehmen' ? await nimmEroeffnungZurueck(firma, wer.person, b.basis)
    : null;
  if (!r) return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion (setzen, zuruecknehmen).' }, { status: 400 });
  if (!r.ok) return NextResponse.json(r, { status: r.status });
  businessGeaendert();
  // Was jetzt ausgeblendet ist (Anzahl archivierter Posten je Gesellschaft) — für den Hinweis nach dem Speichern.
  return NextResponse.json({ ...r, archiv: (await archivAnsicht(r.geltend)).zahlen });
}
