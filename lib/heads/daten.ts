// ─── Die Datenpakete der Heads (rein, getestet) ────────────────────────────
// Nur Arbeitsfelder (R11): nie privatNotiz, nie Personen mit Werbesperre,
// keine Haushaltsdaten. Jede Person trägt ihre Kanal-Ampel als
// „kanal_erlaubt“ — daran hält der Prüfer jeden Entwurf.

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { werIstDran } from '@/lib/crm/heute';
import { ampel, art14, kanalStatus } from '@/lib/crm/recht';
import { prognose, gesundheit, gesamtwert, OFFENE_STUFEN, STUFEN, gewinnquote } from '@/lib/crm/pipeline';
import { mandatLage, mrr, konzentration } from '@/lib/crm/kunden';
import { eventZahlen, followUpBis } from '@/lib/crm/events';
import type { HeadId } from './prompt';

const kurz = (t: string | undefined, n: number) => (t ?? '').replace(/\s+/g, ' ').trim().slice(0, n) || undefined;

/** Eine Person, wie ein Agent sie sehen darf. */
export function person(k: Kontakt, ctx: { hatMandat?: boolean; hatChance?: boolean } = {}) {
  const erlaubt = ampel(k, ctx).filter(s => s.farbe !== 'rot').map(s => s.kanal);
  return {
    id: k.id, name: anzeigename(k), firma: k.firma, position: kurz(k.position ?? k.jobtitel, 80), kreis: k.kreis, phase: k.lebensphase, anrede: k.anrede ?? 'Sie',
    stufe: k.stufe, letzter_kontakt: k.letzterKontakt, naechster_schritt: k.naechsterSchritt, aufhaenger: kurz(k.aufhaenger, 240),
    kanal_erlaubt: erlaubt,
    verlauf: (k.aktivitaeten ?? []).filter(a => a.art !== 'system').slice(-3).map(a => ({ am: a.am.slice(0, 10), art: a.art, ergebnis: a.ergebnis, text: kurz(a.text, 160), bedarf: kurz(a.notiz?.bedarf, 160), zusage: kurz(a.notiz?.zusage, 120) })),
  };
}

export function datenpaket(head: HeadId, modus: string, kontakte: Kontakt[], crm: CrmBestand, heute: string, personName: string, frueher: { titel: string; status: string }[]) {
  const aktiv = kontakte.filter(k => !k.werbesperre);
  const nachId = new Map(aktiv.map(k => [k.id, k]));
  const mandatJe = new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds));
  const chanceJe = new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds));
  const p = (k: Kontakt) => person(k, { hatMandat: mandatJe.has(k.id), hatChance: chanceJe.has(k.id) });
  const meta = { heute, head, modus, fuer: personName, fruehere_vorschlaege: frueher.slice(-15) };

  if (head === 'sales') {
    const a = werIstDran(aktiv, crm, heute, personName, 12);
    const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
    const verloren = crm.chancen.filter(c => c.stufe === 'verloren' && c.grund);
    return {
      meta,
      karten: a.karten.map(c => ({ kategorie: c.kategorie, gruende: c.gruende, ...p(c.kontakt) })),
      nicht_auf_der_liste: a.ausgefiltert,
      pipeline: prognose(crm.chancen, heute, crm.wahrscheinlichkeiten),
      chancen: offen.slice(0, 25).map(c => ({
        id: c.id, titel: c.titel, firma: c.firma, stufe: STUFEN.find(s => s.id === c.stufe)?.label, wert_gesamt: Math.round(gesamtwert(c)), wert: c.wert,
        ampel: gesundheit(c, heute), naechster_schritt: c.naechsterSchritt ?? null, qualifizierung: c.qualifizierung, entscheidung_bis: c.erwartetAm ?? null,
        personen: c.kontaktIds.map(id => nachId.get(id)).filter((k): k is Kontakt => !!k).map(p),
      })),
      mandate: crm.mandate.filter(m => m.status !== 'beendet').map(m => ({ id: m.id, kunde: m.kunde, titel: kurz(m.titel, 120), status: m.status, honorar: m.honorar, lage: mandatLage(m, heute), offene_punkte: m.offen.slice(0, 5).map(o => kurz(o, 200)), vertrag: m.vertragUnterschrieben, ansprechpartner: m.kontaktIds.map(id => nachId.get(id)).filter((k): k is Kontakt => !!k).slice(0, 2).map(p) })),
      mrr: mrr(crm.mandate), konzentration: konzentration(crm.mandate), gewinnquote: gewinnquote(crm.chancen),
      verlustgruende: Object.entries(verloren.reduce((x, c) => ({ ...x, [c.grund!]: (x[c.grund!] ?? 0) + 1 }), {} as Record<string, number>)),
      power_hours_4_wochen: crm.sitzungen.filter(s => s.datum >= new Date(Date.parse(heute) - 28 * 864e5).toISOString().slice(0, 10)).map(s => ({ datum: s.datum, person: s.person, versuche: s.karten.filter(k => k.ergebnis).length, gespraeche: s.karten.filter(k => k.ergebnis === 'gespraech' || k.ergebnis === 'termin').length, termine: s.karten.filter(k => k.ergebnis === 'termin').length })),
    };
  }

  if (head === 'marketing') {
    const stimmen = aktiv.flatMap(k => (k.aktivitaeten ?? []).filter(x => x.notiz?.bedarf).map(x => ({ kontakt_id: k.id, am: x.am.slice(0, 10), bedarf: kurz(x.notiz!.bedarf, 240), phase: k.lebensphase }))).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 20);
    const quellen: Record<string, number> = {};
    for (const c of crm.chancen) quellen[c.quelle ?? 'nicht erfasst'] = (quellen[c.quelle ?? 'nicht erfasst'] ?? 0) + 1;
    return {
      meta,
      bestand: {
        kartei: kontakte.length, gesperrt: kontakte.length - aktiv.length,
        mail_freigegeben: aktiv.filter(k => kanalStatus(k, 'mail').farbe === 'gruen').length,
        newsletter_doi: aktiv.filter(k => kanalStatus(k, 'newsletter').farbe === 'gruen').length,
        kreis_a_bis_c: aktiv.filter(k => k.kreis && k.kreis !== 'D').length,
      },
      art14_faellig: aktiv.filter(k => art14(k, heute)?.faellig).slice(0, 15).map(k => ({ ...p(k), tage: art14(k, heute)!.tage })),
      einwilligungen_alt: aktiv.filter(k => (k.einwilligungen ?? []).some(e => !e.widerrufenAm && (Date.parse(heute) - Date.parse(e.erteiltAm)) / 864e5 > 730)).slice(0, 10).map(p),
      quellen_der_chancen: quellen,
      selbstauskunft: crm.chancen.filter(c => c.selbstauskunft).map(c => ({ chance_id: c.id, text: kurz(c.selbstauskunft, 200) })),
      stimme_der_kunden: stimmen,
      anstehende_events: crm.events.filter(e => e.datum >= heute && e.status !== 'abgesagt').map(e => ({ id: e.id, titel: e.titel, datum: e.datum, ziel: kurz(e.ziel, 200) })),
      kunden_gruen: crm.mandate.filter(m => m.status === 'aktiv' && mandatLage(m, heute).ampel === 'gruen').map(m => ({ mandat_id: m.id, kunde: m.kunde })),
    };
  }

  // event
  const events = crm.events.filter(e => e.status !== 'abgesagt');
  const kandidaten = aktiv.filter(k => (k.kreis && k.kreis !== 'D') || k.lebensphase === 'kunde' || k.lebensphase === 'multiplikator' || k.prio === 'A').slice(0, 40).map(p);
  return {
    meta,
    events: events.map(e => ({
      id: e.id, titel: e.titel, format: e.format, ziel: kurz(e.ziel, 300), datum: e.datum, ort: e.ort, kapazitaet: e.kapazitaet, kosten: e.kostenEuro, status: e.status,
      nachfassen_bis: followUpBis(e), zahlen: eventZahlen(e, crm.teilnahmen, kontakte, crm.chancen),
      gaeste: crm.teilnahmen.filter(t => t.eventId === e.id).map(t => { const k = nachId.get(t.kontaktId); return k ? { status: t.status, notiz_vom_abend: kurz(t.notiz, 240), nachgefasst: t.followUpAm ?? null, einladung_per_mail: kanalStatus(k, 'einladung').farbe, ...p(k) } : null; }).filter(Boolean),
    })),
    kandidaten,
    chancen_aus_events: crm.chancen.filter(c => c.quelle === 'event').map(c => ({ id: c.id, titel: c.titel, event_id: c.quelleBezug, wert_gesamt: Math.round(gesamtwert(c)) })),
  };
}
export type Datenpaket = ReturnType<typeof datenpaket>;
