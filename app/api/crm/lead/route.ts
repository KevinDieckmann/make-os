// ─── Sales · Ebene 1 → 2 → 3: Lead, SQL, Deal, Kunde ───────────────────────
// GET                                   → alle Leads (lib/crm/leads.ts) + Trichter
// POST { aktion: 'setze', id, felder }  → Status, Kernfragen, Fit, Notiz, Grund am Lead
//      id = Firma (f-…) oder Person ohne Firma (c-…)
// POST { aktion: 'sql', id, deal }      → Lead wird SQL, der Deal entsteht in der
//      Pipeline (Stufe „SQL“) — Kernfragen, Personen, Firma wandern mit.
//      Pflicht: nächster Schritt mit Datum. Ohne erfüllte SQL-Kriterien nur mit
//      `trotzdem: true` (dann steht es in der Notiz).
// POST { aktion: 'mandat', chanceId }   → gewonnener Deal wird Mandat (Deals ›
//      Kunden); Firma wird Kunde, Personen Lebensphase „Kunde“.
// Nichts wird versendet.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/zoe/raum';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { dealZuFirma } from '@/lib/crm/firmen-bezug';
import { leads, trichter, sqlBereit, fehltBisSql, leereKriterien } from '@/lib/crm/leads';
import { dealAnlegen } from '@/lib/crm/deal-anlegen';
import { leadSaeubern } from '@/lib/crm/lead-form';
import { phaseHeben } from '@/lib/crm/lifecycle';
import { wer, BEIDE } from '@/lib/crm/team';
import type { Lead, Mandat } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const etag = etagAus('l2', await speicherStand(['crm', 'kontakte']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const z = leads(kontakte, crm, localDay());
  return jsonAntwort(req, { ok: true, leads: z, trichter: trichter(z, crm) }, etag);
}

/** Lead an Firma oder Person schreiben — der Rest des Eintrags bleibt, wie er ist. */
async function leadSchreiben(id: string, mut: (alt: Lead | undefined) => Lead | undefined): Promise<Lead | undefined> {
  let neu: Lead | undefined;
  if (id.startsWith('f-')) {
    await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === id ? (() => { neu = leadSaeubern(mut(f.lead)); return { ...f, ...(neu ? { lead: neu } : {}) }; })() : f)) }));
  } else {
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === id ? (() => { neu = leadSaeubern(mut(k.lead)); return { ...k, ...(neu ? { lead: neu } : {}), geaendertAm: localDay() }; })() : k)) }));
  }
  return neu;
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; id?: string; felder?: Record<string, unknown>; deal?: Record<string, unknown>; trotzdem?: boolean; zweiter?: boolean; chanceId?: string; an?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();

  if (b.aktion === 'mandat') {
    const c = crm.chancen.find(x => x.id === b.chanceId);
    if (!c || c.stufe !== 'gewonnen') return NextResponse.json({ ok: false, fehler: 'Nur ein gewonnener Deal wird Mandat.' }, { status: 400 });
    if (crm.mandate.some(m => m.chanceId === c.id)) return NextResponse.json({ ok: false, fehler: 'Zu diesem Deal gibt es schon ein Mandat.' }, { status: 409 });
    // (die Prüfung läuft unten noch einmal INNERHALB der Sperre — ein Doppelklick legt kein zweites Mandat an, Stufe 2)
    const m: Mandat = {
      id: neueId('m'), kunde: c.firma ?? c.titel, ...(c.firmaId ? { firmaId: c.firmaId } : {}), kontaktIds: c.kontaktIds, titel: c.titel, art: c.art, chanceId: c.id, gesellschaft: c.gesellschaft, status: 'aktiv',
      // Das Produkt reist mit (26.09.) — sonst sieht die Produkt-Auswertung das Mandat nie.
      ...(c.leistungId ? { leistungId: c.leistungId } : {}),
      vertragUnterschrieben: false, start: jetzt.slice(0, 10), verlaengerung: 'offen',
      honorar: { betrag: c.wert.basis === 'jahr' ? Math.round(c.wert.betrag / 12) : c.wert.betrag, basis: c.wert.basis === 'einmalig' ? 'einmalig' : 'monat', netto: true },
      ustSatz: 19, rechnungsrhythmus: c.wert.basis === 'einmalig' ? 'einmalig' : 'monatlich', zahlungszielTage: 14, ziele: [],
      health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: ['Vertrag unterschreiben lassen', 'Kickoff-Termin festlegen'],
      quelle: `aus Deal „${c.titel}“`, zustaendig: c.besitzer, geaendert: jetzt, geaendertVon: person,
    };
    const ids = new Set(c.kontaktIds);
    let schonDa = false;
    await aendereCrm(x => {
      if (x.mandate.some(mm => mm.chanceId === c.id)) { schonDa = true; return x; }
      return { ...x, mandate: [...x.mandate, m], firmen: x.firmen.map(f => (dealZuFirma(c, f) && !f.rolleVonHand ? { ...f, rolle: 'kunde' } : f)) };
    });
    if (schonDa) return NextResponse.json({ ok: false, fehler: 'Zu diesem Deal gibt es schon ein Mandat.' }, { status: 409 });
    // Lifecycle (Prüfbericht F1): eine gesetzte Phase vor „Kunde“ wird Kunde — ohne gesetzte Phase bleibt es beim Vorschlag.
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
      if (!ids.has(k.id)) return k;
      const phase = phaseHeben(k.phase, 'kunde');
      return { ...k, lebensphase: 'kunde', stufe: 'gewonnen', ...(phase ? { phase } : {}), geaendertAm: jetzt.slice(0, 10) };
    }) }));
    return NextResponse.json({ ok: true, mandatId: m.id, text: `Mandat „${m.kunde}“ angelegt — unter Produkte & Mandate: Vertrag und Kickoff klären.` });
  }

  const id = String(b.id ?? '');
  const zeile = leads(kontakte, crm).find(z => z.id === id);
  if (!zeile) return NextResponse.json({ ok: false, fehler: 'Lead nicht gefunden.' }, { status: 404 });
  const basis = (alt: Lead | undefined): Lead => alt ?? { status: zeile.status, kriterien: zeile.kriterien };

  if (b.aktion === 'setze') {
    const f = b.felder ?? {};
    const lead = await leadSchreiben(id, alt => {
      const l = basis(alt);
      // Kernfrage, Antwort oder Fit angefasst = qualifiziert — die Runde legt den Lead damit für 60 Tage weg.
      const qualifiziert = f.kriterien !== undefined || f.antworten !== undefined || f.fit !== undefined || f.geprueft === true;
      return { ...l, ...(f.status ? { status: f.status as Lead['status'] } : {}), kriterien: { ...leereKriterien(), ...l.kriterien, ...((f.kriterien as object) ?? {}) },
        ...(f.antworten && typeof f.antworten === 'object' ? { antworten: { ...(l.antworten ?? {}), ...(f.antworten as object) } } : {}),
        ...(f.fit !== undefined ? { fit: f.fit as Lead['fit'] } : {}), ...(f.notiz !== undefined ? { notiz: String(f.notiz) } : {}), ...(f.grund !== undefined ? { grund: String(f.grund) } : {}),
        ...(qualifiziert ? { qualifiziertAm: jetzt.slice(0, 10) } : {}),
        geaendert: jetzt, geaendertVon: person };
    });
    return NextResponse.json({ ok: true, lead });
  }

  if (b.aktion === 'sql') {
    // Seit 27.09. über den EINEN Anlageweg (lib/crm/deal-anlegen.ts): Firma per Kennung, Dubletten-Prüfung, Lead wird SQL.
    // `trotzdem` hier = SQL-Kriterien bewusst übergehen (steht dann in der Notiz); ein zweiter offener Deal braucht `zweiter: true`.
    const d = b.deal ?? {};
    const schritt = d.schritt as { text?: string; datum?: string } | undefined;
    if (!schritt?.text?.trim() || !tagOk(schritt.datum)) return NextResponse.json({ ok: false, fehler: 'Nächster Schritt mit Datum ist Pflicht — ohne ihn verliert sich der Deal.' }, { status: 400 });
    if (!sqlBereit(zeile.kriterien) && !b.trotzdem) return NextResponse.json({ ok: false, fehler: `Noch kein SQL — es fehlt: ${fehltBisSql(zeile.kriterien).join(', ')}.`, fehlt: fehltBisSql(zeile.kriterien) }, { status: 400 });
    const besitzer = wer(d.besitzer) && wer(d.besitzer) !== BEIDE ? wer(d.besitzer)! : zeile.besitzer === BEIDE ? person : zeile.besitzer;
    const kontaktIds = Array.isArray(d.kontaktIds) && d.kontaktIds.length ? (d.kontaktIds as string[]) : zeile.personen.map(p => p.id);
    const r = await dealAnlegen({
      titel: String(d.titel ?? ''), kontaktIds, ...(zeile.art === 'firma' ? { firmaId: zeile.id } : {}),
      art: d.art as never, wert: { betrag: Number(d.betrag) || 0, basis: d.basis === 'einmalig' ? 'einmalig' : d.basis === 'jahr' ? 'jahr' : 'monat' },
      schritt: { text: String(schritt.text), datum: String(schritt.datum) }, ...(tagOk(d.erwartetAm) ? { erwartetAm: tagOk(d.erwartetAm) } : {}), besitzer, trotzdem: b.zweiter === true,
    }, person, jetzt);
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.offen ? { offen: r.offen } : {}) }, { status: r.status });
    if (b.trotzdem && !sqlBereit(zeile.kriterien)) await leadSchreiben(id, alt => ({ ...basis(alt), status: 'sql', sqlAm: jetzt, chanceId: r.chance.id, notiz: `${basis(alt).notiz ? `${basis(alt).notiz}\n` : ''}SQL ohne alle Kriterien angelegt (${fehltBisSql(zeile.kriterien).join(', ')} offen).`, geaendert: jetzt, geaendertVon: person }));
    return NextResponse.json({ ok: true, chanceId: r.chance.id, text: `SQL: Deal „${r.chance.titel}“ steht unter Deals (Stufe SQL).` });
  }

  // Qualifizierungsrunde (27.09.): Leads ohne Besitzer übernimmt, wer sie qualifiziert — alle Personen des Leads, die noch niemandem gehören.
  if (b.aktion === 'uebernehmen') {
    const an = wer(b.an ?? person);
    if (!an || an === BEIDE) return NextResponse.json({ ok: false, fehler: 'Übernehmen braucht eine Person (kevin oder malin).' }, { status: 400 });
    const ids = new Set(zeile.personen.map(p => p.id));
    let n = 0;
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
      if (!ids.has(k.id) || (k.besitzer && k.besitzer !== BEIDE)) return k;
      n++;
      return { ...k, besitzer: an, geaendertAm: jetzt.slice(0, 10), aktivitaeten: [...(k.aktivitaeten ?? []), { am: jetzt, art: 'uebergabe' as const, von: person, text: `Übernommen in der Qualifizierungsrunde von ${an}` }] };
    }) }));
    return NextResponse.json({ ok: true, uebernommen: n, an });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: setze, sql, mandat oder uebernehmen.' }, { status: 400 });
}
