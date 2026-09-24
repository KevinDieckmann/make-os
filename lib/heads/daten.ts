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
import { eventZahlen, followUpBis, nachfassenRest } from '@/lib/crm/events';
import { mix, checklisteStand, zielHinweis, budgetSumme, gaesteVorschlag } from '@/lib/crm/eventplanung';
import type { HeadId } from './prompt';
import { PLAYBOOKS, kundenprofil, aehnlicheFirmen, zielgruppe, kampagnenZahlen } from '@/lib/crm/kampagnen';
import { einstellungAus, marketingKennzahlen, wirkungZahlen, newsletterEmpfaenger, abmeldequote } from '@/lib/crm/marketing';
import { kontextAus, segmentAuswerten } from '@/lib/crm/segmente';

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

  // Kampagnen planen (Sales und Marketing): Kundenprofil, ähnliche Firmen, Playbooks mit heutiger Zielgruppe.
  if (modus === 'kampagne' && (head === 'sales' || head === 'marketing')) {
    const profil = kundenprofil(crm, heute);
    const personenJeFirma = new Map<string, Kontakt[]>();
    for (const k of aktiv) if (k.firmaId) personenJeFirma.set(k.firmaId, [...(personenJeFirma.get(k.firmaId) ?? []), k]);
    return {
      meta,
      kundenprofil: { kunden: profil.firmen.map(f => ({ name: f.name, branche: f.branche, stadt: f.stadt, mitarbeiter: f.mitarbeiter })), branchen: profil.branchen, staedte: profil.staedte, groesse: profil.groesse, mrr_je_kunde: profil.mrrJeKunde },
      aehnliche: aehnlicheFirmen(crm, heute, 15).map(a => ({ firma: a.firma.name, branche: a.firma.branche, gruende: a.gruende, personen: (personenJeFirma.get(a.firma.id) ?? []).slice(0, 3).map(p) })),
      playbooks: PLAYBOOKS.filter(pb => pb.fuer.includes(head === 'sales' ? 'head-sales' : 'head-marketing')).map(pb => {
        const zg = zielgruppe(aktiv, crm, pb, heute);
        return { id: pb.id, name: pb.name, warum: pb.warum, kanal: pb.kanal, kennzahl: pb.kennzahl, recht: pb.recht, zielgruppe_anzahl: zg.length, zielgruppe: zg.slice(0, 20).map(p) };
      }),
      laufende_kampagnen: crm.kampagnen.filter(k => k.status === 'entwurf' || k.status === 'aktiv').map(k => ({ name: k.name, playbook: k.playbook, status: k.status, zahlen: kampagnenZahlen(k, heute) })),
      segmente: crm.segmente.map(sg => ({ name: sg.name, kriterien: sg.kriterien })),
      mrr: mrr(crm.mandate), konzentration: konzentration(crm.mandate),
    };
  }

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
    const vor60 = new Date(Date.parse(heute) - 60 * 864e5).toISOString().slice(0, 10);
    const einst = einstellungAus(crm);
    const saeule = (id?: string) => einst.saeulen.find(x => x.id === id)?.name ?? id;
    const ctx = kontextAus(crm, heute);
    return {
      meta,
      positionierung: { text: kurz(einst.positionierung, 1500), zielgruppe: kurz(einst.icp, 1500), ton: einst.ton, saeulen: einst.saeulen.map(x => ({ name: x.name, beschreibung: kurz(x.beschreibung, 200) })) },
      kennzahlen: marketingKennzahlen(aktiv, crm, heute).map(x => ({ label: x.label, wert: x.anzeige, ampel: x.ampel, ziel: x.ziel })),
      content_log: crm.beitraege.filter(b => !b.datum || b.datum >= vor60).slice(-30).map(b => ({
        titel: b.titel, kanal: b.kanal, saeule: saeule(b.saeule), status: b.status, datum: b.datum ?? null, wirkung: wirkungZahlen(b),
        reagiert: b.wirkung.map(w => nachId.get(w.kontaktId)).filter((k): k is Kontakt => !!k).slice(0, 5).map(k => ({ id: k.id, name: anzeigename(k), firma: k.firma })),
      })),
      segmente: crm.segmente.map(sg => { const a = segmentAuswerten(aktiv, sg.kriterien, ctx); return { name: sg.name, anzahl: a.anzahl, kanaele: a.kanaele }; }),
      newsletter: { empfaenger_doi: newsletterEmpfaenger(aktiv).length, ausgaben: crm.newsletter.slice(-5).map(a => ({ titel: a.titel, status: a.status, datum: a.datum ?? null, empfaenger: a.empfaenger ?? null, antworten: a.antworten ?? null, abmeldequote: abmeldequote(a) })) },
      kampagnen: crm.kampagnen.filter(k => k.status === 'entwurf' || k.status === 'aktiv').map(k => ({ name: k.name, playbook: k.playbook, zahlen: kampagnenZahlen(k, heute) })),
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
  // Gästevorschläge für das nächste Event (mit Grund und zulässigem Einladungsweg), sonst allgemein die Kreise.
  const naechstes = events.filter(e => e.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum))[0];
  const seg = naechstes?.segmentId ? crm.segmente.find(sg => sg.id === naechstes.segmentId) : undefined;
  const kandidaten = naechstes
    ? gaesteVorschlag(aktiv, crm, naechstes, heute, seg?.kriterien, 15).map(g => ({ ...p(g.kontakt), gruende: g.gruende, gruppe: g.gruppe, einladungsweg: g.weg }))
    : aktiv.filter(k => (k.kreis && k.kreis !== 'D') || k.lebensphase === 'kunde' || k.lebensphase === 'multiplikator' || k.prio === 'A').slice(0, 40).map(p);
  return {
    meta,
    events: events.map(e => ({
      id: e.id, titel: e.titel, format: e.format, ziel: kurz(e.ziel, 300), ziel_hinweis: zielHinweis(e.ziel), datum: e.datum, ort: e.ort, kapazitaet: e.kapazitaet, kosten: budgetSumme(e), status: e.status,
      nachfassen_bis: followUpBis(e), nachfassen_rest_stunden: nachfassenRest(e, Date.now()), zahlen: eventZahlen(e, crm.teilnahmen, kontakte, crm.chancen),
      mischung: mix(e, crm.teilnahmen, kontakte, crm.firmen), checkliste: checklisteStand(e, heute),
      gaeste: crm.teilnahmen.filter(t => t.eventId === e.id).map(t => { const k = nachId.get(t.kontaktId); return k ? { status: t.status, rolle: t.rolle ?? 'gast', fotofreigabe: t.fotofreigabe ?? null, einladungsweg: t.einladungsweg ?? null, eingeladen_am: t.eingeladenAm ?? null, notiz_vom_abend: kurz(t.notiz, 240), nachgefasst: t.followUpAm ?? null, einladung_per_mail: kanalStatus(k, 'einladung').farbe, ...p(k) } : null; }).filter(Boolean),
    })),
    kandidaten, naechstes_event: naechstes?.id ?? null,
    chancen_aus_events: crm.chancen.filter(c => c.quelle === 'event').map(c => ({ id: c.id, titel: c.titel, event_id: c.quelleBezug, wert_gesamt: Math.round(gesamtwert(c)) })),
  };
}
export type Datenpaket = ReturnType<typeof datenpaket>;
