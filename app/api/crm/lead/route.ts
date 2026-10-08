// ─── Sales · Ebene 1 → 2 → 3: Lead, SQL, Deal, Kunde ───────────────────────
// GET                                   → alle Leads (lib/crm/leads.ts) + Trichter
// POST { aktion: 'setze', id, felder }  → Status, Kernfragen, Fit, Notiz, Grund am Lead
//      id = Firma (f-…) oder Person ohne Firma (c-…)
// POST { aktion: 'sql', id, deal }      → Lead wird SQL, der Deal entsteht in der
//      Pipeline (Stufe „SQL“) — Kernfragen, Personen, Firma wandern mit.
//      Pflicht: nächster Schritt mit Datum. Ohne erfüllte SQL-Kriterien nur mit
//      `trotzdem: true` — seit 08.10. (Woche 1 · 2.3, EIN Regelwerk mit /api/crm/deal) wird der Lead dann NICHT SQL,
//      sondern trägt den Vermerk „direkt angelegt“ (`direktAm`, `direktOffen`; lib/crm/deal-anlegen.ts). Ein zweiter offener
//      Deal braucht `zweiter: true` (409 mit `offen` sonst). Die Quelle kommt aus der Herkunft des Leads (2.5).
// POST { aktion: 'setze', id, felder: { geprueft: true } } → „Geprüft“ in der Runde: der Server stempelt `geprueftAm` (Berliner
//      Tag) — Ruhe bis zur Wiedervorlage (2.1, lib/crm/leads.ts `brauchtQualifizierung`).
// POST { aktion: 'setze', id, felder: { stufen: { <Frage>: <Stufe>|null }, antworten, fit, status, notiz, … } }
//      Seit 03.10. (Qualifizierung & Scoring): `stufen` wählt je Frage der Sales-Einstellungen eine Stufe (null = zurück auf offen);
//      für Fragen mit altem Feld (Schmerz … Alternative, Fit) wird `kriterien`/`fit` mitgeschrieben (lib/crm/scoring.ts `altWertAusStufe`).
// POST { aktion: 'parken', id, bis, grundArt?, grund? }  → Status „ruht“ mit Wiedervorlage (kommt dann in die Runde zurück) + Follow-up
// POST { aktion: 'raus', id, grundArt, grund? }          → Status „Kein Fit“ mit Grund (fließt in die Auswertung, lib/crm/lead-grund.ts)
// POST { aktion: 'abgeben', id, an, notiz? }             → alle Personen des Leads gehen an kevin/malin (Übergabe mit Aufgabe)
// POST { aktion: 'firma-folgen-vorschau' | 'firma-folgen', personIds, von?, nach, leadMit, dealsMit }
//      → nach einem Firmenwechsel der Person: Lead und offene Deals zur neuen Firma (lib/crm/firma-umhaengen-server.ts)
// POST { aktion: 'firmen-zusammen-vorschau' | 'firmen-zusammen', behalten, weg }  → Firmen-Dublette zusammenführen
// Die neuen Schreib-Aktionen laufen nie über den Dienstweg (403) und prüfen die Bau-Kennung.
// POST { aktion: 'mandat', chanceId }   → gewonnener Deal wird Mandat (Deals ›
//      Kunden); Firma wird Kunde, Personen Lebensphase „Kunde“.
// Nichts wird versendet.
//
// Ablaufprüfung 28.09.: Art. 18 — eine eingeschränkte Person wird nicht verarbeitet: `setze` an ihrem Lead und
// `mandat` mit ihr → 409 `EINGESCHRAENKT_FEHLER`; `uebernehmen` lässt sie aus (ist es ihr eigener Lead: 409).
// `sql` prüft es im Anlageweg (lib/crm/deal-anlegen.ts). Mandat-Kunde nur aus der Firma, sonst „Privatkunde“ —
// nie der Deal-Titel (der konnte einen Personennamen tragen).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus, type Wer } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay, tagVon } from '@/lib/zeit';
import { personAus } from '@/lib/zoe/raum';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { dealZuFirma } from '@/lib/crm/firmen-bezug';
import { leads, trichter, salesBereit, fehltBisSqlZeile, leereKriterien, ausscheidenGesperrt } from '@/lib/crm/leads';
import { standardScoring, altWertAusStufe } from '@/lib/crm/scoring';
import { LEAD_MAP_MAX } from '@/lib/crm/lead-form';
import { istGrundRaus, istGrundParken } from '@/lib/crm/lead-grund';
import { uebergeben } from '@/lib/crm/uebergabe';
import { folgenVorschau, folgenAnwenden, zusammenVorschau, zusammenfuehren } from '@/lib/crm/firma-umhaengen-server';
import { neuesFollowUp } from '@/lib/crm/followup';
import { bauPruefen } from '@/lib/bau/pruefen';
import { dealAnlegen } from '@/lib/crm/deal-anlegen';
import { leadSaeubern } from '@/lib/crm/lead-form';
import { phaseHeben } from '@/lib/crm/lifecycle';
import { wer, BEIDE, nameVon } from '@/lib/crm/team';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import type { Lead, Mandat } from '@/lib/crm/typen';
import { angenommenZuDeal, mandatVorbelegung } from '@/lib/crm/angebote';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => neueKennung(p);
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const etag = etagAus('l3', await speicherStand(['crm', 'kontakte', 'crm-scoring']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const z = leads(kontakte, crm, localDay());
  return jsonAntwort(req, { ok: true, leads: z, trichter: trichter(z, crm) }, etag);
}

/** Lead an Firma oder Person schreiben — der Rest des Eintrags bleibt, wie er ist. */
async function leadSchreiben(id: string, mut: (alt: Lead | undefined) => Lead | undefined, wer?: Wer): Promise<Lead | undefined> {
  let neu: Lead | undefined;
  if (id.startsWith('f-')) {
    await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === id ? (() => { neu = leadSaeubern(mut(f.lead)); return { ...f, ...(neu ? { lead: neu } : {}) }; })() : f)) }), wer);
  } else {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === id ? (() => { neu = leadSaeubern(mut(k.lead)); return { ...k, ...(neu ? { lead: neu } : {}), geaendertAm: localDay() }; })() : k)) }), wer);
  }
  return neu;
}

/** Neue Schreib-Aktionen (03.10.): nie über den Dienstweg — nur eine angemeldete Person des Haushalts. */
const VON_HAND = ['parken', 'raus', 'abgeben', 'firma-folgen', 'firmen-zusammen'];

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  let b: { aktion?: string; id?: string; felder?: Record<string, unknown>; deal?: Record<string, unknown>; trotzdem?: boolean; zweiter?: boolean; chanceId?: string; an?: string; bis?: string; grundArt?: string; grund?: string; notiz?: string; personIds?: unknown[]; von?: string; nach?: string; leadMit?: boolean; dealsMit?: boolean; behalten?: string; weg?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  if (VON_HAND.includes(String(b.aktion)) && zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Das geht nur von Hand, nicht über den Dienstweg.' }, { status: 403 });

  // Firmen: Folgen eines Firmenwechsels und Zusammenführen (kein Lead nötig).
  if (b.aktion === 'firma-folgen-vorschau' || b.aktion === 'firma-folgen') {
    const e = { personIds: Array.isArray(b.personIds) ? b.personIds.map(String) : [], ...(typeof b.von === 'string' && b.von ? { von: b.von } : {}), nach: String(b.nach ?? ''), leadMit: b.leadMit === true, dealsMit: b.dealsMit === true };
    const r = b.aktion === 'firma-folgen' ? await folgenAnwenden(e, person, werAus(req)) : await folgenVorschau(e);
    return r.ok ? NextResponse.json({ ok: true, plan: r.plan }) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
  }
  if (b.aktion === 'firmen-zusammen-vorschau' || b.aktion === 'firmen-zusammen') {
    const r = b.aktion === 'firmen-zusammen' ? await zusammenfuehren(String(b.behalten ?? ''), String(b.weg ?? ''), person, werAus(req)) : await zusammenVorschau(String(b.behalten ?? ''), String(b.weg ?? ''));
    return r.ok ? NextResponse.json({ ok: true, vorschau: r.vorschau }) : NextResponse.json({ ok: false, fehler: r.fehler, ...(r.fremd ? { fremd: r.fremd } : {}) }, { status: r.status });
  }
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();

  if (b.aktion === 'mandat') {
    const c = crm.chancen.find(x => x.id === b.chanceId);
    if (!c || c.stufe !== 'gewonnen') return NextResponse.json({ ok: false, fehler: 'Nur ein gewonnener Deal wird Mandat.' }, { status: 400 });
    if (crm.mandate.some(m => m.chanceId === c.id)) return NextResponse.json({ ok: false, fehler: 'Zu diesem Deal gibt es schon ein Mandat.' }, { status: 409 });
    // Art. 18: mit einer eingeschränkten Person entsteht kein Mandat (Verarbeitung gesperrt).
    if (c.kontaktIds.some(id => kontakte.find(k => k.id === id)?.eingeschraenkt)) return NextResponse.json({ ok: false, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true }, { status: 409 });
    // Kunde = die Firma (Stammdaten vor dem Text am Deal), sonst „Privatkunde“ — nie der Deal-Titel (Personenname, Art. 17).
    const kunde = (c.firmaId ? crm.firmen.find(f => f.id === c.firmaId)?.name : undefined) ?? c.firma ?? 'Privatkunde';
    // (die Prüfung läuft unten noch einmal INNERHALB der Sperre — ein Doppelklick legt kein zweites Mandat an, Stufe 2)
    const m: Mandat = {
      id: neueId('m'), kunde, ...(c.firmaId ? { firmaId: c.firmaId } : {}), kontaktIds: c.kontaktIds, titel: c.titel, art: c.art, chanceId: c.id, gesellschaft: c.gesellschaft, status: 'aktiv',
      // Das Produkt reist mit (26.09.) — sonst sieht die Produkt-Auswertung das Mandat nie.
      ...(c.leistungId ? { leistungId: c.leistungId } : {}),
      vertragUnterschrieben: false, start: tagVon(jetzt), verlaengerung: 'offen',
      honorar: { betrag: c.wert.basis === 'jahr' ? Math.round(c.wert.betrag / 12) : c.wert.betrag, basis: c.wert.basis === 'einmalig' ? 'einmalig' : 'monat', netto: true },
      ustSatz: 19, rechnungsrhythmus: c.wert.basis === 'einmalig' ? 'einmalig' : 'monatlich', zahlungszielTage: 14, ziele: [],
      health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: ['Vertrag unterschreiben lassen', 'Kickoff-Termin festlegen'],
      quelle: `aus Deal „${c.titel}“`, zustaendig: c.besitzer, geaendert: jetzt, geaendertVon: person,
    };
    // Angebots-Tool (28.09.): gibt es ein angenommenes Angebot zum Deal, belegt es Honorar, Laufzeit, Produkt,
    // Gesellschaft, USt, Zahlungsziel und Leistungen vor — derselbe Weg, nur mit besseren Startwerten.
    const angebot = angenommenZuDeal(crm.angebote, c.id);
    if (angebot) {
      const v = mandatVorbelegung(angebot);
      Object.assign(m, v, { quelle: `aus Angebot ${angebot.nummer ?? ''} (Deal „${c.titel}“)`.replace('  ', ' ') });
      if (!v.titel) m.titel = c.titel;
    }
    const ids = new Set(c.kontaktIds);
    let schonDa = false;
    await aendereCrm(x => {
      if (x.mandate.some(mm => mm.chanceId === c.id)) { schonDa = true; return x; }
      return { ...x, mandate: [...x.mandate, m], firmen: x.firmen.map(f => (dealZuFirma(c, f) && !f.rolleVonHand ? { ...f, rolle: 'kunde' } : f)) };
    });
    if (schonDa) return NextResponse.json({ ok: false, fehler: 'Zu diesem Deal gibt es schon ein Mandat.' }, { status: 409 });
    // Lifecycle (Prüfbericht F1): eine gesetzte Phase vor „Kunde“ wird Kunde — ohne gesetzte Phase bleibt es beim Vorschlag.
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
      if (!ids.has(k.id) || k.eingeschraenkt) return k;
      const phase = phaseHeben(k.phase, 'kunde');
      return { ...k, lebensphase: 'kunde', stufe: 'gewonnen', ...(phase ? { phase } : {}), geaendertAm: tagVon(jetzt) };
    }) }), werAus(req));
    return NextResponse.json({ ok: true, mandatId: m.id, text: `Mandat „${m.kunde}“ angelegt — unter Produkte & Mandate: Vertrag und Kickoff klären.` });
  }

  const id = String(b.id ?? '');
  // Art. 18: der eigene Lead einer eingeschränkten Person wird weder gesetzt, noch SQL, noch übernommen (die Lead-Liste
  // kennt sie ohnehin nicht — hier die klare Antwort statt „nicht gefunden“).
  if (!id.startsWith('f-') && kontakte.find(k => k.id === id)?.eingeschraenkt) return NextResponse.json({ ok: false, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true }, { status: 409 });
  const zeile = leads(kontakte, crm, localDay()).find(z => z.id === id);
  if (!zeile) return NextResponse.json({ ok: false, fehler: 'Lead nicht gefunden.' }, { status: 404 });
  const basis = (alt: Lead | undefined): Lead => alt ?? { status: zeile.status, kriterien: zeile.kriterien };

  if (b.aktion === 'setze') {
    const f = b.felder ?? {};
    // Stufen je Frage (03.10.): nur Fragen der Sales-Einstellungen, nur Stufen, die es dort gibt; null = zurück auf offen.
    const einst = crm.scoring ?? standardScoring();
    const fragen = new Map(einst.sales.teile.flatMap(t => t.kriterien).filter(k => k.quelle === 'frage').map(k => [k.id, k]));
    const stufenAenderung: Record<string, string | null> = {};
    if (f.stufen !== undefined) {
      if (!f.stufen || typeof f.stufen !== 'object' || Array.isArray(f.stufen)) return NextResponse.json({ ok: false, fehler: 'stufen: { <Frage>: <Stufe> | null }.' }, { status: 400 });
      for (const [kid, v] of Object.entries(f.stufen as Record<string, unknown>)) {
        const k = fragen.get(kid);
        if (!k) return NextResponse.json({ ok: false, fehler: `Die Frage „${kid}“ gibt es in den Scoring-Einstellungen nicht.` }, { status: 400 });
        if (v !== null && !(typeof v === 'string' && k.stufen.some(st => st.id === v))) return NextResponse.json({ ok: false, fehler: `Die Stufe passt nicht zur Frage „${k.name}“.` }, { status: 400 });
        stufenAenderung[kid] = v as string | null;
      }
    }
    // Nie still abschneiden: zu viele Antworten/Stufen oder zu lange Texte → 413.
    const antwortenNeu = f.antworten && typeof f.antworten === 'object' && !Array.isArray(f.antworten) ? f.antworten as Record<string, unknown> : null;
    if (antwortenNeu && Object.values(antwortenNeu).some(t => String(t ?? '').length > 1000)) return NextResponse.json({ ok: false, fehler: 'Eine Antwort ist länger als 1.000 Zeichen.' }, { status: 413 });
    if (f.notiz !== undefined && String(f.notiz).length > 2000) return NextResponse.json({ ok: false, fehler: 'Die Notiz ist länger als 2.000 Zeichen.' }, { status: 413 });
    if (f.grund !== undefined && String(f.grund).length > 300) return NextResponse.json({ ok: false, fehler: 'Der Grund ist länger als 300 Zeichen.' }, { status: 413 });
    // Hauptansprechpartner (03.10.): nur eine Person dieses Leads.
    if (f.hauptKontaktId !== undefined && f.hauptKontaktId !== null && !zeile.personen.some(p => p.id === f.hauptKontaktId)) return NextResponse.json({ ok: false, fehler: 'Der Hauptansprechpartner muss eine Person dieses Leads sein.' }, { status: 400 });
    const vorher = (zeile.stufen ?? {}) as Record<string, string>;
    const stufenSumme = new Set([...Object.keys(vorher), ...Object.keys(stufenAenderung).filter(k => stufenAenderung[k] !== null)]).size;
    const antwortenSumme = new Set([...Object.keys(zeile.antworten ?? {}), ...Object.keys(antwortenNeu ?? {})]).size;
    if (stufenSumme > LEAD_MAP_MAX || antwortenSumme > LEAD_MAP_MAX) return NextResponse.json({ ok: false, fehler: `Höchstens ${LEAD_MAP_MAX} Antworten je Lead.` }, { status: 413 });
    const lead = await leadSchreiben(id, alt => {
      const l = basis(alt);
      // Kernfrage, Antwort, Stufe oder Fit angefasst = qualifiziert. Seit 08.10. (2.1) hält eine offene MUSS-Frage den Lead trotzdem in
      // der Runde — nur „Geprüft“ (`geprueftAm`, Server-Stempel) gibt Ruhe bis zur Wiedervorlage.
      const qualifiziert = f.kriterien !== undefined || f.antworten !== undefined || f.fit !== undefined || f.stufen !== undefined || f.geprueft === true;
      const stufen: Record<string, string> = { ...(l.stufen ?? {}) };
      const kriterien = { ...leereKriterien(), ...l.kriterien };
      let fit = l.fit;
      for (const [kid, v] of Object.entries(stufenAenderung)) {
        const k = fragen.get(kid)!;
        if (v === null) delete stufen[kid]; else stufen[kid] = v;
        // Das alte Feld bleibt stimmig (Deal-Kopie, Anzeigen, ältere Leser): beste Stufe ja, ab 60 % ja, 0 nein, sonst unklar.
        if (k.alt === 'fit') fit = altWertAusStufe(k, v);
        else if (k.alt) kriterien[k.alt] = altWertAusStufe(k, v);
      }
      const neuerStatus = f.status as Lead['status'] | undefined;
      const weiterAktiv = neuerStatus && neuerStatus !== 'ruht' && neuerStatus !== 'kein_fit';
      const { wiedervorlage: _w, grundArt: _g, ...ohneRuhe } = l;
      const { hauptKontaktId: _hk, ...ohneHaupt } = (weiterAktiv ? ohneRuhe : l) as Lead;
      return { ...ohneHaupt, ...(f.hauptKontaktId === null ? {} : typeof f.hauptKontaktId === 'string' ? { hauptKontaktId: f.hauptKontaktId } : l.hauptKontaktId ? { hauptKontaktId: l.hauptKontaktId } : {}), ...(neuerStatus ? { status: neuerStatus } : {}), kriterien: { ...kriterien, ...((f.kriterien as object) ?? {}) },
        ...(Object.keys(stufen).length ? { stufen } : { stufen: undefined }),
        ...(antwortenNeu ? { antworten: { ...(l.antworten ?? {}), ...(antwortenNeu as Record<string, string>) } } : {}),
        ...(f.fit !== undefined ? { fit: f.fit as Lead['fit'] } : fit !== undefined ? { fit } : {}), ...(f.notiz !== undefined ? { notiz: String(f.notiz) } : {}), ...(f.grund !== undefined ? { grund: String(f.grund) } : {}),
        ...(qualifiziert ? { qualifiziertAm: tagVon(jetzt) } : {}), ...(f.geprueft === true ? { geprueftAm: tagVon(jetzt) } : {}),
        geaendert: jetzt, geaendertVon: person };
    }, werAus(req));
    return NextResponse.json({ ok: true, lead });
  }

  // Parken (03.10.): Status „ruht“ mit Wiedervorlage — am Tag kommt der Lead in die Runde zurück; dazu ein Follow-up.
  // Raus: „Kein Fit“ mit fester Grund-Art (Auswertung). Beides nie bei einem Lead mit offenem Deal (dann den Deal parken).
  if (b.aktion === 'parken' || b.aktion === 'raus') {
    const gesperrt = ausscheidenGesperrt(zeile);
    if (gesperrt) return NextResponse.json({ ok: false, fehler: gesperrt }, { status: 409 });
    const grund = String(b.grund ?? '').trim();
    if (grund.length > 300) return NextResponse.json({ ok: false, fehler: 'Der Grund ist länger als 300 Zeichen.' }, { status: 413 });
    const parken = b.aktion === 'parken';
    if (parken ? b.grundArt !== undefined && !istGrundParken(b.grundArt) : !istGrundRaus(b.grundArt)) return NextResponse.json({ ok: false, fehler: parken ? 'grundArt passt nicht zu „Parken“.' : 'Für „Kein Fit“ braucht es einen Grund aus der Liste.' }, { status: 400 });
    const heute = localDay();
    if (parken && (!tagOk(b.bis) || String(b.bis) < heute)) return NextResponse.json({ ok: false, fehler: 'Wiedervorlage: ein Datum ab heute.' }, { status: 400 });
    const lead = await leadSchreiben(id, alt => {
      const { wiedervorlage: _w, grundArt: _g, ...l } = basis(alt);
      return { ...l, status: parken ? 'ruht' : 'kein_fit', ...(parken ? { wiedervorlage: String(b.bis) } : {}), grundArt: String(b.grundArt ?? 'spaeter'), ...(grund ? { grund } : { grund: undefined }), qualifiziertAm: tagVon(jetzt), geaendert: jetzt, geaendertVon: person };
    }, werAus(req));
    let followup = false;
    if (parken) {
      try {
        const haupt = zeile.personen[0] ? kontakte.find(k => k.id === zeile.personen[0].id) : undefined;
        const f = neuesFollowUp({ id: neueId('fu'), bezug: zeile.art === 'firma' ? { art: 'firma', id: zeile.id } : { art: 'kontakt', id: zeile.id }, ...(haupt ? { kontaktId: haupt.id } : {}), art: 'sonstig', text: `Wiedervorlage Qualifizierung: ${zeile.name}`.slice(0, 300), faellig: String(b.bis), ...(wer(zeile.besitzer) && zeile.besitzer !== BEIDE ? { zustaendig: zeile.besitzer } : {}) }, haupt, person, jetzt);
        await aendereCrm(c => ({ ...c, followups: [...(c.followups ?? []), { ...f, geaendertVon: person }] }), werAus(req));
        followup = true;
      } catch { /* die Wiedervorlage am Lead trägt allein — die Runde holt ihn zurück */ }
    }
    return NextResponse.json({ ok: true, lead, followup, text: parken ? `Geparkt bis ${String(b.bis)} — dann kommt „${zeile.name}“ in die Runde zurück.` : `„${zeile.name}“ ist raus (Kein Fit) — der Grund steht in der Auswertung.` });
  }

  // Abgeben: alle Personen des Leads gehen an Kevin oder Malin (Übergabe im Verlauf, Aufgabe für die andere Person).
  if (b.aktion === 'abgeben') {
    const an = wer(b.an);
    if (!an || an === BEIDE) return NextResponse.json({ ok: false, fehler: 'Abgeben braucht eine Person (kevin oder malin).' }, { status: 400 });
    if (String(b.notiz ?? '').length > 600) return NextResponse.json({ ok: false, fehler: 'Die Notiz ist länger als 600 Zeichen.' }, { status: 413 });
    const r = await uebergeben({ art: 'kontakte', ids: zeile.personen.map(p => p.id), an, notiz: typeof b.notiz === 'string' ? b.notiz : undefined }, person, werAus(req));
    return r.ok ? NextResponse.json({ ok: true, an: r.an, aufgabe: r.aufgabe, text: `„${zeile.name}“ → ${nameVon(r.an)}${r.aufgabe ? ' · Aufgabe angelegt' : ''}` }) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
  }

  if (b.aktion === 'sql') {
    // Seit 27.09. über den EINEN Anlageweg (lib/crm/deal-anlegen.ts): Firma per Kennung, Dubletten-Prüfung, Lead wird SQL.
    // `trotzdem` hier = SQL-Kriterien bewusst übergehen (steht dann in der Notiz); ein zweiter offener Deal braucht `zweiter: true`.
    const d = b.deal ?? {};
    const schritt = d.schritt as { text?: string; datum?: string } | undefined;
    if (!schritt?.text?.trim() || !tagOk(schritt.datum)) return NextResponse.json({ ok: false, fehler: 'Nächster Schritt mit Datum ist Pflicht — ohne ihn verliert sich der Deal.' }, { status: 400 });
    if (!salesBereit(zeile) && !b.trotzdem) return NextResponse.json({ ok: false, fehler: `Noch kein SQL — es fehlt: ${fehltBisSqlZeile(zeile).join(', ')}.`, fehlt: fehltBisSqlZeile(zeile) }, { status: 400 });
    const besitzer = wer(d.besitzer) && wer(d.besitzer) !== BEIDE ? wer(d.besitzer)! : zeile.besitzer === BEIDE ? person : zeile.besitzer;
    const kontaktIds = Array.isArray(d.kontaktIds) && d.kontaktIds.length ? (d.kontaktIds as string[]) : zeile.personen.map(p => p.id);
    const r = await dealAnlegen({
      titel: String(d.titel ?? ''), kontaktIds, ...(zeile.art === 'firma' ? { firmaId: zeile.id } : {}),
      art: d.art as never, wert: { betrag: Number(d.betrag) || 0, basis: d.basis === 'einmalig' ? 'einmalig' : d.basis === 'jahr' ? 'jahr' : 'monat' },
      schritt: { text: String(schritt.text), datum: String(schritt.datum) }, ...(tagOk(d.erwartetAm) ? { erwartetAm: tagOk(d.erwartetAm) } : {}), besitzer, trotzdem: b.zweiter === true,
    }, person, jetzt, werAus(req));
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.offen ? { offen: r.offen } : {}) }, { status: r.status });
    // EIN Regelwerk (2.3): ob der Lead SQL wird, entscheidet `dealAnlegen` nach den Scoring-Einstellungen — „trotzdem“ legt den Deal an,
    // der Lead trägt dann den Vermerk „direkt angelegt“ (nie mehr ein SQL ohne erfüllte Kriterien).
    return NextResponse.json({ ok: true, chanceId: r.chance.id, sql: r.sql, text: r.sql ? `SQL: Deal „${r.chance.titel}“ steht unter Deals (Stufe SQL).` : `Deal „${r.chance.titel}“ steht unter Deals — direkt angelegt, der Lead bleibt in der Qualifizierung (es fehlt: ${r.fehlt.join(', ') || '—'}).` });
  }

  // Qualifizierungsrunde (27.09.): Leads ohne Besitzer übernimmt, wer sie qualifiziert — alle Personen des Leads, die noch niemandem gehören.
  if (b.aktion === 'uebernehmen') {
    const an = wer(b.an ?? person);
    if (!an || an === BEIDE) return NextResponse.json({ ok: false, fehler: 'Übernehmen braucht eine Person (kevin oder malin).' }, { status: 400 });
    const ids = new Set(zeile.personen.map(p => p.id));
    // Art. 18: eingeschränkte Personen einer Firma bleiben unberührt (werden gezählt, nicht übernommen).
    let n = 0, ausgelassen = 0;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
      if (!ids.has(k.id) || (k.besitzer && k.besitzer !== BEIDE)) return k;
      if (k.eingeschraenkt) { ausgelassen++; return k; }
      n++;
      return { ...k, besitzer: an, geaendertAm: tagVon(jetzt), aktivitaeten: [...(k.aktivitaeten ?? []), { am: jetzt, art: 'uebergabe' as const, von: person, text: `Übernommen in der Qualifizierungsrunde von ${an}` }] };
    }) }), werAus(req));
    return NextResponse.json({ ok: true, uebernommen: n, an, ...(ausgelassen ? { ausgelassen, hinweis: `${ausgelassen} eingeschränkte Person(en) (Art. 18) nicht übernommen.` } : {}) });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: setze, parken, raus, abgeben, sql, mandat, uebernehmen, firma-folgen(-vorschau) oder firmen-zusammen(-vorschau).' }, { status: 400 });
}
