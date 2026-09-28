// ─── Verbindungsprüfung (28.09.): je Prüfung ein Fall, Reparatur, Idempotenz ──
// Alle Daten erfunden (@example.invalid) — nie echte Bestände.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Mandat, FollowUp } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { verbindungenPruefen, verbindungenReparieren, verbindungsAmpel, PRUEFUNGEN, PRUEFUNG_IDS, REPARIERBAR, type VerbindungsBestaende, type PruefungId } from '../lib/crm/verbindungen';
import { befunde } from '../lib/crm/befunde';

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const JETZT = '2026-09-28T10:00:00.000Z';
const Q = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;

const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: id, nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [], qualifizierung: { ...Q }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: 'Firma f-alpha', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'chance', id: 'd-1' }, kontaktId: 'c-anna1', art: 'anruf', text: 'Nachfassen', faellig: '2026-10-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J, ...x });

/** Ein sauberer Bestand: jede Kennung zeigt auf etwas, das es gibt — ergibt keinen einzigen Befund. */
function sauber(): VerbindungsBestaende {
  const crm: CrmBestand = {
    ...leererBestand(),
    firmen: [firma('f-alpha')],
    chancen: [deal('d-1', { kontaktIds: ['c-anna1'], firmaId: 'f-alpha', personenRollen: { 'c-anna1': 'entscheider' } })],
    mandate: [mandat('m-1', { kontaktIds: ['c-anna1'], firmaId: 'f-alpha', start: '2026-01-01' })],
    followups: [fu('fu-1', { aufgabeId: 't-1' })],
    events: [{ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-10', status: 'geplant', segmentId: 'seg-1', geaendert: J }],
    teilnahmen: [{ id: 'tn-1', eventId: 'ev-1', kontaktId: 'c-bert1', status: 'eingeladen', geaendert: J }],
    segmente: [{ id: 'seg-1', name: 'Kalt', kriterien: { temperatur: ['kalt'], kreis: ['A'] }, geaendert: J }],
    kampagnen: [{ id: 'kp-1', name: 'K', playbook: 'eigen', ziel: '', zielgruppe: { lifecycle: ['lead'] }, segmentId: 'seg-1', kanal: 'persoenlich', status: 'aktiv', schritte: [{ id: 's1', text: 'x', tag: 0, erledigt: false, aufgabeId: 't-1' }], kontaktIds: ['c-bert1'], ergebnisse: [{ kontaktId: 'c-bert1', ergebnis: 'angesprochen', am: HEUTE }], von: 'hand', geaendert: J }],
    beitraege: [{ id: 'b-1', titel: 'B', kanal: 'linkedin', status: 'idee', wirkung: [{ kontaktId: 'c-bert1', art: 'reaktion', am: HEUTE }], quellen: ['c-anna1', 'Kundengespräch Sommer'], geaendert: J }],
    newsletter: [{ id: 'n-1', titel: 'N', status: 'entwurf', inhalt: '', beitragIds: ['b-1'], geaendert: J }],
    sitzungen: [{ id: 'ph-1', person: 'kevin', datum: HEUTE, start: J, ziel: { gespraeche: 5, termine: 1 }, karten: [{ kontaktId: 'c-anna1', kategorie: 'kern' }] }],
    antraege: [{ id: 'a-1', art: 'auskunft', name: 'Bert Test', kontaktId: 'c-bert1', eingang: HEUTE, frist: '2026-10-28', status: 'offen', geaendert: J }],
  };
  return {
    heute: HEUTE,
    kontakte: [k('c-anna1', { firmaId: 'f-alpha', lead: { status: 'sql', kriterien: { ...Q }, chanceId: 'd-1' } }), k('c-bert1', { firmaId: 'f-alpha' })],
    crm,
    finanzplan: { rechnungen: [{ id: 'r-1', firmaId: 'kdc', mandatId: 'm-1', status: 'gestellt', betrag: 2500, datum: '2026-09-15' }], firmen: ['kdc', 'kdv'] },
    aufgaben: { liste: [{ id: 't-1', title: 'Angebot', projectId: 'p-1', space: 'business', einheit: 'KD Ventures', status: 'todo' }, { id: 't-2', title: 'Einkauf', projectId: 'p-2', space: 'privat', status: 'todo' }], orte: {}, eigeneEinheiten: [] },
    fokus: [{ person: 'kevin', bloecke: [{ von: J, bis: J, schluessel: 'business:markttraktion', label: 'x', sek: 60, aufgabeId: 't-1' }] }],
    dateien: { eintraege: [{ id: 'd-abcd1', art: 'vertrag', kontaktId: 'c-anna1', mandatId: 'm-1', rechnungId: 'r-1', datei: { name: 'v.pdf', typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: J, hochgeladenVon: 'kevin' }], aufPlatte: ['d-abcd1'] },
    konflikte: { konflikte: [{ kontaktId: 'c-anna1', feld: 'email', online: 'a', liste: 'b' }], moeglicheDubletten: [{ kontaktId: 'c-bert1', mitId: 'c-anna1', grund: 'Name' }], ohneBesitzer: 0, stand: J, quelle: 'test' },
  };
}
const mit = (f: (b: VerbindungsBestaende) => void): VerbindungsBestaende => { const b = structuredClone(sauber()); f(b); return b; };
const finde = (b: VerbindungsBestaende, id: PruefungId) => verbindungenPruefen(b).find(x => x.id === id);

describe('Verbindungsprüfung — sauberer Bestand', () => {
  it('ein sauberer Bestand hat keinen Befund, die Ampel ist grün', () => {
    expect(verbindungenPruefen(sauber())).toEqual([]);
    expect(verbindungsAmpel([])).toBe('gruen');
  });
  it('jede Prüfung hat Satz, Schwere und Bereich; reparierbar ist eine feste Teilmenge', () => {
    for (const id of PRUEFUNG_IDS) expect(PRUEFUNGEN[id].text(2)).toMatch(/^\S/);
    expect(REPARIERBAR).toEqual(['firma-lead-deal-tot', 'kontakt-lead-deal-tot', 'deal-kontakt-tot', 'deal-rolle-tot', 'mandat-kontakt-tot', 'followup-kontakt-tot', 'followup-bezug-tot', 'kampagne-kontakt-tot', 'beitrag-kontakt-tot', 'antrag-kontakt-tot', 'werbesperre-kampagne', 'datei-fehlt', 'konflikt-veraltet']);
  });
});

// Je Prüfung ein Fall: [Befund, Änderung am sauberen Bestand, erwartete Anzahl, erwartetes Beispiel]
const FAELLE: [PruefungId, (b: VerbindungsBestaende) => void, number, string][] = [
  ['doppelt-kennung', b => { b.crm.chancen.push(deal('d-1')); }, 1, 'chancen:d-1'],
  ['kontakt-email-doppelt', b => { b.kontakte[1].email = 'C-ANNA1@example.invalid '; }, 2, 'c-anna1'],
  ['kontakt-firma-tot', b => { b.kontakte[1].firmaId = 'f-weg'; }, 1, 'c-bert1'],
  ['firma-ohne-personen', b => { b.crm.firmen.push(firma('f-leer')); }, 1, 'f-leer'],
  ['kunde-ohne-mandat-person', b => { b.kontakte.push(k('c-kunde1', { lebensphase: 'kunde' })); }, 1, 'c-kunde1'],
  ['kunde-ohne-mandat-firma', b => { b.crm.firmen.push(firma('f-kunde', { rolle: 'kunde' })); b.kontakte.push(k('c-kunde2', { firmaId: 'f-kunde' })); }, 1, 'f-kunde'],
  ['firma-lead-deal-tot', b => { b.crm.firmen[0].lead = { status: 'sql', kriterien: { ...Q }, chanceId: 'd-weg' }; }, 1, 'f-alpha'],
  ['kontakt-lead-deal-tot', b => { b.kontakte[0].lead!.chanceId = 'd-weg'; }, 1, 'c-anna1'],
  ['deal-kontakt-tot', b => { b.crm.chancen[0].kontaktIds.push('c-weg1'); }, 1, 'd-1'],
  ['deal-firma-tot', b => { b.crm.chancen[0].firmaId = 'f-weg'; }, 1, 'd-1'],
  ['deal-rolle-tot', b => { b.crm.chancen[0].personenRollen!['c-weg1'] = 'nutzer'; }, 1, 'd-1'],
  ['deal-rolle-ausserhalb', b => { b.crm.chancen[0].personenRollen!['c-bert1'] = 'nutzer'; }, 1, 'd-1'],
  ['deal-produkt-tot', b => { b.crm.chancen[0].leistungId = 'l-weg'; }, 1, 'd-1'],
  ['deal-gewonnen-ohne-mandat', b => { b.crm.chancen.push(deal('d-2', { stufe: 'gewonnen' })); }, 1, 'd-2'],
  ['deal-offen-doppelt', b => { b.crm.chancen.push(deal('d-3', { firmaId: 'f-alpha', stufe: 'bedarf' })); }, 1, 'f-alpha'],
  ['mandat-deal-tot', b => { b.crm.mandate[0].chanceId = 'd-weg'; }, 1, 'm-1'],
  ['mandat-firma-tot', b => { b.crm.mandate[0].firmaId = 'f-weg'; }, 1, 'm-1'],
  ['mandat-kontakt-tot', b => { b.crm.mandate[0].kontaktIds.push('c-weg1'); }, 1, 'm-1'],
  ['mandat-produkt-tot', b => { b.crm.mandate[0].leistungId = 'l-weg'; }, 1, 'm-1'],
  ['mandat-ohne-rechnung', b => { b.finanzplan!.rechnungen[0].datum = '2026-06-01'; }, 1, 'm-1'],
  ['rechnung-mandat-tot', b => { b.finanzplan!.rechnungen.push({ id: 'r-2', firmaId: 'kdc', mandatId: 'm-weg', status: 'geplant', betrag: 100 }); }, 1, 'r-2'],
  ['rechnung-gesellschaft-tot', b => { b.finanzplan!.rechnungen[0].firmaId = 'weg'; }, 1, 'r-1'],
  ['rechnung-bezahlt-ohne-datum', b => { b.finanzplan!.rechnungen[0].status = 'bezahlt'; }, 1, 'r-1'],
  ['rechnung-betrag', b => { b.finanzplan!.rechnungen[0].betrag = 0; }, 1, 'r-1'],
  ['followup-kontakt-tot', b => { b.crm.followups[0].kontaktId = 'c-weg1'; }, 1, 'fu-1'],
  ['followup-bezug-tot', b => { b.crm.followups[0].bezug = { art: 'mandat', id: 'm-weg' }; }, 1, 'fu-1'],
  ['followup-alt-tot', b => { b.crm.followups.push(fu('fu-2', { status: 'erledigt', erledigtAm: J, bezug: { art: 'event', id: 'ev-weg' } })); }, 1, 'fu-2'],
  ['followup-erledigt-ohne-datum', b => { b.crm.followups[0].status = 'erledigt'; }, 1, 'fu-1'],
  ['teilnahme-event-tot', b => { b.crm.teilnahmen.push({ id: 'tn-2', eventId: 'ev-weg', kontaktId: 'c-anna1', status: 'da', geaendert: J }); }, 1, 'c-anna1'],
  ['teilnahme-kontakt-tot', b => { b.crm.teilnahmen.push({ id: 'tn-3', eventId: 'ev-1', kontaktId: 'c-weg1', status: 'da', geaendert: J }); }, 1, 'ev-1'],
  ['segment-verweis-tot', b => { b.crm.kampagnen[0].segmentId = 'seg-weg'; }, 1, 'seg-weg'],
  ['segment-kriterien', b => { (b.crm.segmente[0].kriterien as Record<string, unknown>).bean = ['X']; }, 1, 'seg-1'],
  ['kampagne-kriterien', b => { (b.crm.kampagnen[0].zielgruppe as Record<string, unknown>).temperatur = ['eisig']; }, 1, 'kp-1'],
  ['kampagne-kontakt-tot', b => { b.crm.kampagnen[0].kontaktIds.push('c-weg1'); }, 1, 'kp-1'],
  ['kampagne-ergebnis-tot', b => { b.crm.kampagnen[0].ergebnisse.push({ kontaktId: 'c-weg1', ergebnis: 'reagiert', am: HEUTE }); }, 1, 'kp-1'],
  ['beitrag-kontakt-tot', b => { b.crm.beitraege[0].quellen.push('c-weg1'); }, 1, 'b-1'],
  ['beitrag-wirkung-tot', b => { b.crm.beitraege[0].wirkung.push({ kontaktId: 'c-weg1', art: 'anfrage', am: HEUTE }); }, 1, 'b-1'],
  ['newsletter-beitrag-tot', b => { b.crm.newsletter[0].beitragIds.push('b-weg'); }, 1, 'n-1'],
  ['powerhour-kontakt-tot', b => { b.crm.sitzungen[0].karten.push({ kontaktId: 'c-weg1', kategorie: 'x' }); }, 1, 'ph-1'],
  ['antrag-kontakt-tot', b => { b.crm.antraege[0].kontaktId = 'c-weg1'; }, 1, 'a-1'],
  ['werbesperre-kampagne', b => { b.kontakte[1].werbesperre = { seit: HEUTE, grund: 'Widerspruch' }; }, 1, 'kp-1'],
  ['werbesperre-einladung', b => { b.kontakte[1].werbesperre = { seit: HEUTE, grund: 'Widerspruch' }; }, 1, 'ev-1'],
  ['werbesperre-followup', b => { b.kontakte[0].werbesperre = { seit: HEUTE, grund: 'Widerspruch' }; }, 1, 'fu-1'],
  ['aufgabe-einheit-ungueltig', b => { b.aufgaben!.liste[1].einheit = 'KD Ventures'; b.aufgaben!.liste.push({ id: 't-3', title: 'x', projectId: 'p', space: 'business', einheit: 'Erfundene Einheit', status: 'todo' }); }, 2, 't-2'],
  ['aufgabe-ohne-einheit', b => { b.aufgaben!.liste.push({ id: 't-4', title: 'x', projectId: 'p', status: 'todo' }, { id: 't-5', title: 'y', projectId: 'p', status: 'done' }); }, 1, 't-4'],
  ['aufgabe-verweis-tot', b => { b.crm.followups[0].aufgabeId = 't-weg'; b.crm.events[0].checkliste = [{ id: 'c1', text: 'x', tageVorher: 3, erledigt: false, aufgabeId: 't-weg2' }]; }, 2, 't-weg'],
  ['fokus-aufgabe-tot', b => { b.fokus![0].bloecke[0].aufgabeId = 't-weg'; }, 1, 't-weg'],
  ['datei-verweis-tot', b => { b.dateien!.eintraege[0].dealId = 'd-weg'; }, 1, 'd-abcd1'],
  ['datei-fehlt', b => { b.dateien!.aufPlatte = []; }, 1, 'd-abcd1'],
  ['datei-fehlt-markiert', b => { b.dateien!.aufPlatte = []; b.dateien!.eintraege[0].dateiFehlt = HEUTE; }, 1, 'd-abcd1'],
  ['datei-ohne-eintrag', b => { b.dateien!.aufPlatte.push('d-zzzz9'); }, 1, 'd-zzzz9'],
  ['konflikt-veraltet', b => { b.konflikte!.konflikte.push({ kontaktId: 'c-weg1', feld: 'email', online: 1, liste: 2 }); }, 1, 'c-weg1'],
];

describe('Verbindungsprüfung — je Prüfung ein Fall', () => {
  it('jede Prüfung ist mit einem Fall abgedeckt', () => {
    expect(new Set(FAELLE.map(f => f[0]))).toEqual(new Set(PRUEFUNG_IDS));
  });
  it.each(FAELLE)('%s', (id, aendern, anzahl, beispiel) => {
    const b = finde(mit(aendern), id);
    expect(b, id).toBeDefined();
    expect(b!.anzahl).toBe(anzahl);
    expect(b!.beispiele).toContain(beispiel);
    expect(b!.schwere).toBe(PRUEFUNGEN[id].schwere);
    expect(b!.reparierbar).toBe(PRUEFUNGEN[id].reparierbar);
  });
  it('eine stornierte Rechnung zählt nicht als gestellt (28.09., K3)', () => {
    expect(finde(mit(() => {}), 'mandat-ohne-rechnung')).toBeUndefined();
    expect(finde(mit(x => { x.finanzplan!.rechnungen[0].status = 'storniert'; }), 'mandat-ohne-rechnung')?.beispiele).toContain('m-1');
  });
  it('Beispiele tragen nur Kennungen — nie Namen oder Mailadressen', () => {
    const b = mit(x => { x.kontakte[1].email = 'c-anna1@example.invalid'; x.kontakte[1].firmaId = 'f-weg'; x.crm.chancen[0].kontaktIds.push('c-weg1'); });
    const alle = verbindungenPruefen(b).flatMap(x => [...x.beispiele, x.text]).join(' ');
    expect(alle).not.toMatch(/@|Test|Firma f-alpha/);
  });
  it('fehlende Bestände werden nicht geprüft (null = nicht geladen)', () => {
    const b = mit(x => { x.finanzplan!.rechnungen[0].betrag = 0; x.dateien!.aufPlatte = []; });
    const ohne = verbindungenPruefen({ ...b, finanzplan: null, dateien: null, aufgaben: null, konflikte: null });
    expect(ohne.map(x => x.id)).not.toContain('rechnung-betrag');
    expect(ohne.map(x => x.id)).not.toContain('datei-fehlt');
  });
  it('Sortierung: Fehler vor Warnungen vor Hinweisen; Ampel folgt der schwersten Stufe', () => {
    const l = verbindungenPruefen(mit(x => { x.crm.firmen.push(firma('f-leer')); x.kontakte[1].email = 'c-anna1@example.invalid'; x.crm.chancen[0].firmaId = 'f-weg'; }));
    expect(l.map(x => x.schwere)).toEqual(['fehler', 'warnung', 'hinweis']);
    expect(verbindungsAmpel(l)).toBe('rot');
    expect(verbindungsAmpel(l.filter(x => x.schwere !== 'fehler'))).toBe('gelb');
  });
  it('Fehler erscheinen auch in den Befunden des Markttraktion-Überblicks', () => {
    const b = mit(x => { x.crm.chancen[0].kontaktIds.push('c-weg1'); });
    const v = befunde(b.kontakte, b.crm, HEUTE).find(x => x.titel.includes('Verbindungsfehler'));
    expect(v).toMatchObject({ prio: 1, bereich: 'stammdaten', ansicht: 'qualitaet' });
    expect(befunde(sauber().kontakte, sauber().crm, HEUTE).some(x => x.titel.includes('Verbindungsfehler'))).toBe(false);
  });
});

describe('Verbindungen reparieren', () => {
  const kaputt = () => mit(b => {
    b.crm.chancen[0].kontaktIds.push('c-weg1'); b.crm.chancen[0].personenRollen!['c-weg1'] = 'blocker';
    b.crm.mandate[0].kontaktIds.push('c-weg2');
    b.crm.firmen[0].lead = { status: 'sql', kriterien: { ...Q }, chanceId: 'd-weg' };
    b.kontakte[0].lead!.chanceId = 'd-weg';
    b.crm.followups.push(fu('fu-2', { kontaktId: 'c-weg1', bezug: { art: 'kontakt', id: 'c-weg1' } }), fu('fu-3', { kontaktId: undefined, bezug: { art: 'event', id: 'ev-weg' } }));
    b.crm.kampagnen[0].kontaktIds.push('c-weg1');
    // Werbesperre in laufender Kampagne (reparierbar seit 28.09.): eigene gesperrte Person, damit die übrigen Erwartungen gleich bleiben.
    b.kontakte.push({ ...b.kontakte[1], id: 'c-sperr1', firmaId: undefined, werbesperre: { seit: HEUTE, grund: 'Widerspruch' } });
    b.crm.kampagnen[0].kontaktIds.push('c-sperr1');
    b.crm.beitraege[0].quellen.push('c-weg1');
    b.crm.antraege[0].kontaktId = 'c-weg3';
    b.konflikte!.konflikte.push({ kontaktId: 'c-weg1', feld: 'email', online: 1, liste: 2 });
    b.dateien!.aufPlatte = [];
    // Nicht reparierbar — muss stehen bleiben:
    b.crm.chancen[0].firmaId = 'f-weg';
    b.crm.teilnahmen.push({ id: 'tn-9', eventId: 'ev-1', kontaktId: 'c-weg1', status: 'da', geaendert: J });
  });

  it('räumt genau die reparierbaren Befunde ab — nicht reparierbare bleiben stehen', () => {
    const vorher = verbindungenPruefen(kaputt());
    const ids = vorher.filter(x => x.reparierbar).map(x => x.id);
    expect(ids.sort()).toEqual([...REPARIERBAR].sort());
    const r = verbindungenReparieren(kaputt(), ids, JETZT, 'kevin');
    const nachher = verbindungenPruefen(r.bestaende).map(x => x.id);
    for (const id of ids) expect(nachher, id).not.toContain(id);
    expect(nachher).toEqual(expect.arrayContaining(['deal-firma-tot', 'teilnahme-kontakt-tot', 'followup-alt-tot', 'datei-fehlt-markiert']));
  });

  it('ändert nur Verweise: kein Datensatz verschwindet, Zeitstempel von Deals, Mandaten und Personen bleiben', () => {
    const b = kaputt();
    const r = verbindungenReparieren(b, REPARIERBAR, JETZT, 'kevin');
    const n = r.bestaende;
    for (const l of ['firmen', 'chancen', 'mandate', 'followups', 'kampagnen', 'beitraege', 'antraege', 'teilnahmen'] as const) expect(n.crm[l].length, l).toBe(b.crm[l].length);
    expect(n.kontakte.length).toBe(b.kontakte.length);
    expect(n.dateien!.eintraege.length).toBe(1);
    expect(n.crm.chancen[0]).toEqual({ ...b.crm.chancen[0], kontaktIds: ['c-anna1'], personenRollen: { 'c-anna1': 'entscheider' } });
    expect(n.crm.chancen[0].geaendert).toBe(J);
    expect(n.crm.mandate[0]).toEqual({ ...b.crm.mandate[0], kontaktIds: ['c-anna1'] });
    expect(n.kontakte[0]).toEqual({ ...b.kontakte[0], lead: { status: 'sql', kriterien: { ...Q } } });
    expect(n.kontakte[0].geaendertAm).toBe('2026-08-01');
    expect(n.crm.firmen[0].lead).toEqual({ status: 'sql', kriterien: { ...Q } });
    expect(n.crm.antraege[0].kontaktId).toBeUndefined();
    expect(n.crm.antraege[0].name).toBe('Bert Test');
    expect(n.crm.beitraege[0].quellen).toEqual(['c-anna1', 'Kundengespräch Sommer']);
    expect(n.crm.kampagnen[0].kontaktIds).toEqual(['c-bert1']);
    // Follow-ups ohne Ziel: abgesagt mit Grund, nicht gelöscht; das gesunde bleibt offen.
    const f2 = n.crm.followups.find(f => f.id === 'fu-2')!, f3 = n.crm.followups.find(f => f.id === 'fu-3')!;
    expect(f2).toMatchObject({ status: 'abgesagt', kontaktId: 'c-weg1', geaendertVon: 'kevin' });
    expect(f2.notiz).toMatch(/^Verbindungsprüfung 2026-09-28: abgesagt — die Person gibt es nicht mehr\./);
    expect(f3.notiz).toContain('das Event existiert nicht mehr');
    expect(n.crm.followups.find(f => f.id === 'fu-1')!.status).toBe('offen');
    // Konflikte: nur der veraltete fällt weg; Datei nur markiert.
    expect(n.konflikte!.konflikte.map(x => x.kontaktId)).toEqual(['c-anna1']);
    expect(n.dateien!.eintraege[0].dateiFehlt).toBe(HEUTE);
    expect(r.aenderungen.map(a => a.speicher)).toEqual(expect.arrayContaining(['crm', 'kontakte', 'import-konflikte', 'dateien']));
  });

  it('nur die gewählten Befunde — und nicht reparierbare Kennungen werden ignoriert', () => {
    const r = verbindungenReparieren(kaputt(), ['deal-kontakt-tot', 'deal-firma-tot', 'gibt-es-nicht'], JETZT, 'kevin');
    expect(r.aenderungen.map(a => a.befundId)).toEqual(['deal-kontakt-tot']);
    expect(r.bestaende.crm.chancen[0].firmaId).toBe('f-weg');
    expect(r.bestaende.crm.chancen[0].personenRollen).toHaveProperty('c-weg1');
    expect(r.bestaende.crm.mandate[0].kontaktIds).toContain('c-weg2');
  });

  it('idempotent: ein zweiter Lauf ändert nichts mehr', () => {
    const eins = verbindungenReparieren(kaputt(), REPARIERBAR, JETZT, 'kevin');
    const zwei = verbindungenReparieren(eins.bestaende, REPARIERBAR, '2026-09-29T10:00:00.000Z', 'malin');
    expect(zwei.aenderungen).toEqual([]);
    expect(zwei.bestaende).toEqual(eins.bestaende);
  });

  it('ein sauberer Bestand bleibt unberührt', () => {
    const r = verbindungenReparieren(sauber(), REPARIERBAR, JETZT, 'kevin');
    expect(r.aenderungen).toEqual([]);
    expect(r.bestaende).toEqual(sauber());
  });
});

describe('Werbesperre in Kampagnen reparieren (Kevin 28.09.)', () => {
  it('nimmt gesperrte Personen aus laufenden Kampagnen heraus, sonst nichts', () => {
    const b = sauber();
    b.kontakte[1].werbesperre = { seit: HEUTE, grund: 'Widerspruch' };
    const vorher = verbindungenPruefen(b).find(x => x.id === 'werbesperre-kampagne');
    expect(vorher?.anzahl).toBe(1);
    const r = verbindungenReparieren(b, ['werbesperre-kampagne'], JETZT, 'kevin');
    expect(r.aenderungen.map(a => a.befundId)).toEqual(['werbesperre-kampagne']);
    expect(verbindungenPruefen(r.bestaende).find(x => x.id === 'werbesperre-kampagne')).toBeUndefined();
    expect(r.bestaende.kontakte).toHaveLength(b.kontakte.length);
    expect(verbindungenReparieren(r.bestaende, ['werbesperre-kampagne'], JETZT, 'kevin').aenderungen).toEqual([]);
  });
});

