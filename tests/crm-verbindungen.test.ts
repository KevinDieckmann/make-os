// ─── Verbindungsprüfung (28.09.): je Prüfung ein Fall, Reparatur, Idempotenz ──
// Alle Daten erfunden (@example.invalid) — nie echte Bestände.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Angebot, Chance, CrmBestand, Firma, Mandat, FollowUp, Leistung } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { verbindungenPruefen, verbindungenReparieren, verbindungsAmpel, PRUEFUNGEN, PRUEFUNG_IDS, REPARIERBAR, type VerbindungsBestaende, type PruefungId } from '../lib/crm/verbindungen';
import { befunde } from '../lib/crm/befunde';
import type { DateiEintrag } from '../lib/dateien/regeln';

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const JETZT = '2026-09-28T10:00:00.000Z';
const Q = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;

const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: id, nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [], qualifizierung: { ...Q }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: 'Firma f-alpha', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const angebot = (id: string, x: Partial<Angebot> = {}): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-alpha', dealId: 'd-1', titel: 'A', positionen: [], einleitung: '', schluss: '', gueltigBis: '2026-10-28', zahlungszielTage: 14, status: 'entwurf', version: 1, angelegt: J, geaendert: J, ...x });
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: id, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', geaendert: J, ...x });
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
    fokus: [{ person: 'kevin', bloecke: [{ von: J, bis: J, schluessel: 'business:markttraktion', label: 'x', sek: 60, aufgabeId: 't-1' }, { von: JETZT, bis: JETZT, schluessel: 'business:markttraktion', label: 'x', sek: 60, mandatId: 'm-1', firmaId: 'f-alpha' }] }],
    // Mandat an Zielen und Zeit (28.09.): Ziele/Meilensteine mit lebendem Mandats-/Firmen-Bezug.
    planung: { ziele: [{ speicher: 'ziele', ziele: [{ id: 'z-1', mandatId: 'm-1', firmaId: 'f-alpha' }, { id: 'z-2' }] }], meilensteine: [{ id: 'ms-1', mandatId: 'm-1' }] },
    dateien: { eintraege: [{ id: 'd-abcd1', art: 'vertrag', kontaktId: 'c-anna1', mandatId: 'm-1', rechnungId: 'r-1', datei: { name: 'v.pdf', typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: J, hochgeladenVon: 'kevin' }], aufPlatte: ['d-abcd1', 'd-aufg1'] },
    // Projekt-/Aufgaben-Dateien (28.09., C2): eigener Bestand, derselbe Ordner — ihre .bin ist keine „Datei ohne Eintrag“.
    aufgabenDateien: { eintraege: [aufgabenDatei('d-aufg1', { aufgabeId: 't-1' })], projekte: ['p-1', 'p-2'] },
    konflikte: { konflikte: [{ kontaktId: 'c-anna1', feld: 'email', online: 'a', liste: 'b' }], moeglicheDubletten: [{ kontaktId: 'c-bert1', mitId: 'c-anna1', grund: 'Name' }], ohneBesitzer: 0, stand: J, quelle: 'test' },
  };
}
function aufgabenDatei(id: string, x: Partial<DateiEintrag> = {}): DateiEintrag {
  return { id, art: 'sonstig', projektId: 'p-1', bereich: 'business', datei: { name: 'plan.pdf', typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: J, hochgeladenVon: 'kevin', ...x };
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
    expect(REPARIERBAR).toEqual(['firma-mutter-tot', 'werte-ausserhalb-wertelisten', 'firma-lead-deal-tot', 'kontakt-lead-deal-tot', 'deal-kontakt-tot', 'deal-rolle-tot', 'mandat-kontakt-tot', 'followup-kontakt-tot', 'followup-bezug-tot', 'kampagne-kontakt-tot', 'beitrag-kontakt-tot', 'antrag-kontakt-tot', 'werbesperre-kampagne', 'einschraenkung-kampagne', 'aufgabe-bezug-tot', 'datei-fehlt', 'konflikt-veraltet', 'kontakt-firma-text-abweichend', 'kontakt-typ-abweichend', 'teilnahme-doppelt', 'ziel-mandat-tot', 'meilenstein-mandat-tot', 'zeit-mandat-tot']);
  });
});

// Je Prüfung ein Fall: [Befund, Änderung am sauberen Bestand, erwartete Anzahl, erwartetes Beispiel]
const FAELLE: [PruefungId, (b: VerbindungsBestaende) => void, number, string][] = [
  ['doppelt-kennung', b => { b.crm.chancen.push(deal('d-1')); }, 1, 'chancen:d-1'],
  ['kontakt-email-doppelt', b => { b.kontakte[1].email = 'C-ANNA1@example.invalid '; }, 2, 'c-anna1'],
  ['kontakt-firma-tot', b => { b.kontakte[1].firmaId = 'f-weg'; }, 1, 'c-bert1'],
  ['firma-ohne-personen', b => { b.crm.firmen.push(firma('f-leer')); }, 1, 'f-leer'],
  // Stationen, Haupt-Adresse, Mutterfirmen (28.09.)
  ['kontakt-station-firma-tot', b => { b.kontakte[1].stationen = [{ firmaId: 'f-alpha', aktiv: true, haupt: true }, { firmaId: 'f-weg', aktiv: false, bis: '2026-01-01' }]; }, 1, 'c-bert1'],
  ['kontakt-station-haupt', b => { b.crm.firmen.push(firma('f-beta')); b.kontakte[1].stationen = [{ firmaId: 'f-alpha', aktiv: true, haupt: true }, { firmaId: 'f-beta', aktiv: true, haupt: true }]; }, 1, 'c-bert1'],
  ['kontakt-email-haupt', b => { b.kontakte[1].emails = [{ adresse: 'c-bert1@example.invalid' }, { adresse: 'bert.privat@example.invalid', art: 'privat' }]; }, 1, 'c-bert1'],
  ['firma-mutter-tot', b => { b.crm.firmen[0].mutterId = 'f-weg'; }, 1, 'f-alpha'],
  ['werte-ausserhalb-wertelisten', b => { b.kontakte[0].typen = ['Zielkunde', 'Sondertyp']; b.kontakte[0].typ = 'Zielkunde'; b.kontakte[1].labels = ['Messe 2026', 'messe 2026']; }, 2, 'typ:Sondertyp'],
  ['firma-mutter-zyklus', b => { b.crm.firmen.push(firma('f-beta', { mutterId: 'f-alpha' })); b.crm.firmen[0].mutterId = 'f-beta'; b.kontakte.push(k('c-cora1', { firmaId: 'f-beta' })); }, 2, 'f-alpha'],
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
  ['einschraenkung-kampagne', b => { b.kontakte[1].eingeschraenkt = { seit: HEUTE, grund: 'Antrag Art. 18', von: 'kevin' }; }, 1, 'kp-1'],
  ['einschraenkung-einladung', b => { b.kontakte[1].eingeschraenkt = { seit: HEUTE, grund: 'Antrag Art. 18', von: 'kevin' }; }, 1, 'ev-1'],
  ['werbesperre-followup', b => { b.kontakte[0].werbesperre = { seit: HEUTE, grund: 'Widerspruch' }; }, 1, 'fu-1'],
  ['aufgabe-einheit-ungueltig', b => { b.aufgaben!.liste[1].einheit = 'KD Ventures'; b.aufgaben!.liste.push({ id: 't-3', title: 'x', projectId: 'p', space: 'business', einheit: 'Erfundene Einheit', status: 'todo' }); }, 2, 't-2'],
  ['aufgabe-ohne-einheit', b => { b.aufgaben!.liste.push({ id: 't-4', title: 'x', projectId: 'p', status: 'todo' }, { id: 't-5', title: 'y', projectId: 'p', status: 'done' }); }, 1, 't-4'],
  // CRM-Bezug der Aufgaben (28.09. spät): je totem Feld eine Aufgabe, die lebende zählt nicht.
  ['aufgabe-bezug-tot', b => { const t = (id: string, bezug: object) => ({ id, title: 'x', projectId: 'p-1', space: 'business' as const, einheit: 'KD Ventures', status: 'todo', bezug }); b.aufgaben!.liste.push(t('t-bk', { kontaktId: 'c-weg1' }), t('t-bf', { firmaId: 'f-weg' }), t('t-bm', { mandatId: 'm-weg' }), t('t-bd', { dealId: 'd-weg' }), t('t-ok', { kontaktId: 'c-anna1', firmaId: 'f-alpha', mandatId: 'm-1', dealId: 'd-1' })); }, 4, 't-bk'],
  ['aufgabe-verweis-tot', b => { b.crm.followups[0].aufgabeId = 't-weg'; b.crm.events[0].checkliste = [{ id: 'c1', text: 'x', tageVorher: 3, erledigt: false, aufgabeId: 't-weg2' }]; }, 2, 't-weg'],
  ['fokus-aufgabe-tot', b => { b.fokus![0].bloecke[0].aufgabeId = 't-weg'; }, 1, 't-weg'],
  ['datei-verweis-tot', b => { b.dateien!.eintraege[0].dealId = 'd-weg'; }, 1, 'd-abcd1'],
  ['datei-fehlt', b => { b.dateien!.aufPlatte = []; }, 1, 'd-abcd1'],
  ['datei-fehlt-markiert', b => { b.dateien!.aufPlatte = []; b.dateien!.eintraege[0].dateiFehlt = HEUTE; }, 1, 'd-abcd1'],
  ['datei-ohne-eintrag', b => { b.dateien!.aufPlatte.push('d-zzzz9'); }, 1, 'd-zzzz9'],
  // Projekt-/Aufgaben-Dateien (C2): totes Projekt, tote Aufgabe; „Sonstige“ eines Space ist ein gültiges Projekt.
  ['aufgaben-datei-verweis-tot', b => { b.aufgabenDateien!.eintraege.push(aufgabenDatei('d-aufg2', { projektId: 'p-weg' }), aufgabenDatei('d-aufg3', { aufgabeId: 't-weg' }), aufgabenDatei('d-aufg4', { projektId: 'sonstige-privat', bereich: 'privat' })); b.dateien!.aufPlatte.push('d-aufg2', 'd-aufg3', 'd-aufg4'); }, 2, 'd-aufg2'],
  ['aufgaben-datei-fehlt', b => { b.dateien!.aufPlatte = ['d-abcd1']; }, 1, 'd-aufg1'],
  ['konflikt-veraltet', b => { b.konflikte!.konflikte.push({ kontaktId: 'c-weg1', feld: 'email', online: 1, liste: 2 }); }, 1, 'c-weg1'],
  // Angebote (28.09., Angebots-Tool)
  ['angebot-verweis-tot', b => { b.crm.angebote.push(angebot('ang-a1', { kontaktId: 'c-weg1' }), angebot('ang-a2', { dealId: 'd-weg' }), angebot('ang-a3', { vorgaengerId: 'ang-weg' })); }, 3, 'ang-a1'],
  ['angebot-produkt-tot', b => { b.crm.angebote.push(angebot('ang-a1', { positionen: [{ id: 'p1', leistungId: 'l-weg', titel: 'x', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100, ustSatz: 19, basis: 'einmalig' }] })); }, 1, 'ang-a1'],
  ['angebot-ohne-pdf', b => { b.crm.angebote.push(angebot('ang-a1', { status: 'gestellt', nummer: 'KDV-A-2026-0001' }), angebot('ang-a2', { status: 'gestellt', nummer: 'KDV-A-2026-0002', pdfDateiId: 'd-abcd1' }), angebot('ang-a3', { status: 'gestellt', nummer: 'KDV-A-2026-0003', pdfDateiId: 'd-weg99' })); }, 2, 'ang-a3'],
  ['produkt-ohne-angebotstext', b => { b.crm.leistungen.push(produkt('l-ohne'), produkt('l-mit', { angebot: { leistungstext: 'Text' } }), produkt('l-entwurf', { status: 'entwurf' })); }, 1, 'l-ohne'],
  // Integritätsprüfung 28.09. abends
  ['kontakt-firma-text-abweichend', b => { b.kontakte[1].firma = 'Neue Arbeit GmbH'; b.kontakte[0].firma = 'Firma F-Alpha GmbH'; }, 1, 'c-bert1'],
  ['kontakt-typ-abweichend', b => { b.kontakte[0].typ = 'Partner'; b.kontakte[0].typen = ['Kunde', 'Partner']; b.kontakte[1].typ = 'kunde'; b.kontakte[1].typen = ['Kunde']; }, 1, 'c-anna1'],
  ['aktivitaet-firma-tot', b => { b.kontakte[0].aktivitaeten = [{ am: J, art: 'notiz', von: 'kevin', firmaId: 'f-weg' }, { am: J, art: 'notiz', von: 'kevin', firmaId: 'f-alpha' }]; }, 1, 'c-anna1'],
  ['aktivitaet-bezug-tot', b => { b.kontakte[1].aktivitaeten = [{ am: J, art: 'notiz', von: 'kevin', bezug: 'd-weg' }, { am: J, art: 'notiz', von: 'kevin', bezug: 'kp-1' }]; }, 1, 'c-bert1'],
  ['deal-quelle-bezug-tot', b => { b.crm.chancen.push(deal('d-2', { quelle: 'event', quelleBezug: 'ev-weg' }), deal('d-3', { quelle: 'kampagne', quelleBezug: 'kp-1' })); }, 1, 'd-2'],
  ['mandat-planposten-tot', b => { b.liquiplan = { posten: ['pp-1'] }; b.crm.mandate[0].planpostenId = 'pp-weg'; b.crm.mandate.push(mandat('m-2', { planpostenId: 'pp-1' })); }, 1, 'm-1'],
  ['mandat-phase-ungueltig', b => { b.crm.leistungen.push(produkt('l-1', { phasen: [{ id: 'ph-a', name: 'Analyse' }] })); b.crm.mandate[0].leistungId = 'l-1'; b.crm.mandate[0].phase = 'ph-weg'; b.crm.mandate.push(mandat('m-2', { leistungId: 'l-1', phase: 'ph-a' })); }, 1, 'm-1'],
  ['teilnahme-doppelt', b => { b.crm.teilnahmen.push({ id: 'tn-2', eventId: 'ev-1', kontaktId: 'c-bert1', status: 'da', geaendert: J }); }, 1, 'ev-1'],
  ['kampagne-ergebnis-ausserhalb', b => { b.crm.kampagnen[0].ergebnisse.push({ kontaktId: 'c-anna1', ergebnis: 'reagiert', am: HEUTE }); }, 1, 'kp-1'],
  ['head-vorschlag-kontakt-tot', b => { b.heads = [{ head: 'sales', vorschlaege: [{ id: 'hs-1', kontakt_id: 'c-weg1', status: 'offen' }, { id: 'hs-2', kontakt_id: 'c-weg1', status: 'abgelehnt' }, { id: 'hs-3', kontakt_id: 'c-anna1', status: 'offen' }] }]; }, 1, 'sales:hs-1'],
  // Mandat an Zielen und Zeit (28.09.)
  ['ziel-mandat-tot', b => { b.planung!.ziele[0].ziele.push({ id: 'z-3', mandatId: 'm-weg' }); b.planung!.ziele.push({ speicher: 'ziele-eigen--malin', ziele: [{ id: 'z-4', firmaId: 'f-weg' }, { id: 'z-5', mandatId: 'm-1' }] }); }, 2, 'z-3'],
  ['meilenstein-mandat-tot', b => { b.planung!.meilensteine.push({ id: 'ms-2', mandatId: 'm-weg', firmaId: 'f-alpha' }); }, 1, 'ms-2'],
  ['zeit-mandat-tot', b => { b.fokus![0].bloecke.push({ von: HEUTE, bis: HEUTE, schluessel: 'business:x', label: 'x', sek: 60, mandatId: 'm-weg' }); }, 1, 'm-weg'],
  ['einwilligung-beleg-tot', b => { b.kontakte[0].einwilligungen = [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'Formular', wortlaut: 'Ja, gern', belegRef: 'd-weg99' }]; b.kontakte[1].einwilligungen = [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'Formular', wortlaut: 'Ja, gern', belegRef: 'Formular d-abcd1' }]; }, 1, 'c-anna1'],
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
  it('Aufgaben-Bezug: jeder tote Einzelverweis (Kontakt, Firma, Mandat, Deal) wird gefunden, lebende nicht', () => {
    const mitBezug = (bezug: object) => mit(x => { x.aufgaben!.liste[0].bezug = bezug; });
    for (const bezug of [{ kontaktId: 'c-weg1' }, { firmaId: 'f-weg' }, { mandatId: 'm-weg' }, { dealId: 'd-weg' }, { kontaktId: 'c-anna1', dealId: 'd-weg' }]) {
      expect(finde(mitBezug(bezug), 'aufgabe-bezug-tot'), JSON.stringify(bezug)).toMatchObject({ anzahl: 1, beispiele: ['t-1'], art: 'aufgabe', bereich: 'aufgaben', schwere: 'fehler' });
    }
    expect(finde(mitBezug({ kontaktId: 'c-anna1', firmaId: 'f-alpha', mandatId: 'm-1', dealId: 'd-1' }), 'aufgabe-bezug-tot')).toBeUndefined();
    // Ohne geladene Aufgaben keine Prüfung.
    expect(verbindungenPruefen({ ...mitBezug({ kontaktId: 'c-weg1' }), aufgaben: null }).map(x => x.id)).not.toContain('aufgabe-bezug-tot');
  });
  it('Aufgabe mit gültigem Space ist nie „ohne Einheit“ (Einheit kommt aus dem Space) — ohne Space schon', () => {
    const b = mit(x => { x.aufgaben!.liste.push(
      { id: 't-kdc', title: 'x', projectId: 'p', status: 'todo', spaceId: 'kdc' },
      { id: 't-mand', title: 'y', projectId: 'p', status: 'todo', spaceId: 'm-f-alpha' },
      { id: 't-kaputt', title: 'z', projectId: 'p', status: 'todo', spaceId: 'gibt es nicht', space: 'business' },
    ); });
    expect(finde(b, 'aufgabe-ohne-einheit')).toMatchObject({ anzahl: 1, beispiele: ['t-kaputt'] });
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
    b.crm.firmen[0].mutterId = 'f-weg';
    b.kontakte[1].labels = ['Messe 2026'];
    b.kontakte[0].lead!.chanceId = 'd-weg';
    b.crm.followups.push(fu('fu-2', { kontaktId: 'c-weg1', bezug: { art: 'kontakt', id: 'c-weg1' } }), fu('fu-3', { kontaktId: undefined, bezug: { art: 'event', id: 'ev-weg' } }));
    b.crm.kampagnen[0].kontaktIds.push('c-weg1');
    // Werbesperre in laufender Kampagne (reparierbar seit 28.09.): eigene gesperrte Person, damit die übrigen Erwartungen gleich bleiben.
    b.kontakte.push({ ...b.kontakte[1], id: 'c-sperr1', firmaId: undefined, werbesperre: { seit: HEUTE, grund: 'Widerspruch' } });
    b.crm.kampagnen[0].kontaktIds.push('c-sperr1');
    // Art. 18 in laufender Kampagne (U2, reparierbar): eigene eingeschränkte Person.
    b.kontakte.push({ ...b.kontakte[1], id: 'c-einsch1', firmaId: undefined, eingeschraenkt: { seit: HEUTE, grund: 'Antrag Art. 18', von: 'kevin' } });
    b.crm.kampagnen[0].kontaktIds.push('c-einsch1');
    b.crm.beitraege[0].quellen.push('c-weg1');
    b.crm.antraege[0].kontaktId = 'c-weg3';
    b.konflikte!.konflikte.push({ kontaktId: 'c-weg1', feld: 'email', online: 1, liste: 2 });
    b.dateien!.aufPlatte = [];
    // 28.09. abends: Firmentext ≠ Hauptstation, Typ nicht vorn, doppelte Teilnahme (mit Feldern zum Übernehmen).
    b.kontakte[1].firma = 'Neue Arbeit GmbH';
    b.kontakte[0].typ = 'Partner'; b.kontakte[0].typen = ['Kunde', 'Partner'];
    b.crm.teilnahmen.push({ id: 'tn-2', eventId: 'ev-1', kontaktId: 'c-bert1', status: 'da', notiz: 'kam spät', followUpAm: HEUTE, geaendert: J });
    // 28.09. spät: Aufgabe mit toten und lebenden CRM-Verweisen.
    b.aufgaben!.liste.push({ id: 't-bz', title: 'Nachfassen', projectId: 'p-1', space: 'business', einheit: 'KD Ventures', status: 'todo', bezug: { kontaktId: 'c-weg1', firmaId: 'f-alpha', dealId: 'd-weg' } });
    // Mandat an Zielen und Zeit (28.09.): tote Bezüge an Ziel, Meilenstein, Fokus-Block.
    b.planung!.ziele[0].ziele.push({ id: 'z-9', mandatId: 'm-weg', firmaId: 'f-alpha' });
    b.planung!.meilensteine.push({ id: 'ms-9', firmaId: 'f-weg' });
    b.fokus![0].bloecke.push({ von: HEUTE, bis: HEUTE, schluessel: 'business:x', label: 'x', sek: 60, mandatId: 'm-weg', einheit: 'KD Ventures' });
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
    for (const l of ['firmen', 'chancen', 'mandate', 'followups', 'kampagnen', 'beitraege', 'antraege'] as const) expect(n.crm[l].length, l).toBe(b.crm[l].length);
    // Einzige Ausnahme: die DOPPELTE Teilnahme geht in der stärkeren auf (Status „da“ bleibt, Felder übernommen).
    expect(n.crm.teilnahmen.length).toBe(b.crm.teilnahmen.length - 1);
    expect(n.crm.teilnahmen.find(t => t.eventId === 'ev-1' && t.kontaktId === 'c-bert1')).toMatchObject({ id: 'tn-2', status: 'da', notiz: 'kam spät', followUpAm: HEUTE, geaendert: J });
    expect(n.kontakte[1].firma).toBe('Firma f-alpha');
    expect(n.kontakte[0].typen).toEqual(['Partner', 'Kunde']);
    expect(n.kontakte.length).toBe(b.kontakte.length);
    expect(n.dateien!.eintraege.length).toBe(1);
    expect(n.crm.chancen[0]).toEqual({ ...b.crm.chancen[0], kontaktIds: ['c-anna1'], personenRollen: { 'c-anna1': 'entscheider' } });
    expect(n.crm.chancen[0].geaendert).toBe(J);
    expect(n.crm.mandate[0]).toEqual({ ...b.crm.mandate[0], kontaktIds: ['c-anna1'] });
    // Lead mit totem Deal (28.09. abends): Verweis weg UND „SQL“ zurück auf „Qualifizierung“, sqlAm weg.
    expect(n.kontakte[0]).toEqual({ ...b.kontakte[0], typen: ['Partner', 'Kunde'], lead: { status: 'qualifizierung', kriterien: { ...Q } } });
    expect(n.kontakte[0].geaendertAm).toBe('2026-08-01');
    expect(n.crm.firmen[0].lead).toEqual({ status: 'qualifizierung', kriterien: { ...Q } });
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
    // Aufgaben: nur die toten Einzelverweise gehen, die Aufgabe und der lebende Verweis bleiben.
    expect(n.aufgaben!.liste.length).toBe(b.aufgaben!.liste.length);
    expect(n.aufgaben!.liste.find(t => t.id === 't-bz')).toEqual({ ...b.aufgaben!.liste.find(t => t.id === 't-bz'), bezug: { firmaId: 'f-alpha' } });
    // Mandat an Zielen und Zeit: nur die tote Kennung geht, der Rest (lebende Firma, Einheit, Sekunden) bleibt.
    expect(n.planung!.ziele[0].ziele.find(z => z.id === 'z-9')).toEqual({ id: 'z-9', firmaId: 'f-alpha' });
    expect(n.planung!.meilensteine.find(m => m.id === 'ms-9')).toEqual({ id: 'ms-9' });
    expect(n.planung!.ziele[0].ziele.find(z => z.id === 'z-1')).toEqual({ id: 'z-1', mandatId: 'm-1', firmaId: 'f-alpha' });
    expect(n.fokus![0].bloecke.at(-1)).toMatchObject({ sek: 60, einheit: 'KD Ventures' });
    expect(n.fokus![0].bloecke.at(-1)).not.toHaveProperty('mandatId');
    expect(r.aenderungen.map(a => a.speicher)).toEqual(expect.arrayContaining(['crm', 'kontakte', 'import-konflikte', 'dateien', 'tasks', 'ziele', 'meilensteine', 'zeit']));
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

describe('Aufgaben-Bezug reparieren (28.09. spät)', () => {
  it('entfernt nur die toten Felder; lebende bleiben, leerer Bezug fällt weg, sonst nichts an der Aufgabe', () => {
    const b = mit(x => {
      x.aufgaben!.liste[0].bezug = { kontaktId: 'c-anna1', firmaId: 'f-weg', mandatId: 'm-1', dealId: 'd-weg' };
      x.aufgaben!.liste[1].bezug = { kontaktId: 'c-weg1' };
      x.aufgaben!.liste.push({ id: 't-3', title: 'Lebt', projectId: 'p-1', space: 'business', einheit: 'KD Ventures', status: 'todo', bezug: { mandatId: 'm-1' } });
    });
    const r = verbindungenReparieren(b, ['aufgabe-bezug-tot'], JETZT, 'kevin');
    expect(r.aenderungen).toEqual([{ befundId: 'aufgabe-bezug-tot', speicher: 'tasks', anzahl: 2, text: expect.stringMatching(/^2 Aufgaben: tote Verweise/) }]);
    const l = r.bestaende.aufgaben!.liste;
    expect(l[0]).toEqual({ ...b.aufgaben!.liste[0], bezug: { kontaktId: 'c-anna1', mandatId: 'm-1' } });
    expect(l[1]).not.toHaveProperty('bezug');
    expect(l[1]).toEqual((({ bezug: _b, ...rest }) => rest)(b.aufgaben!.liste[1]));
    expect(l[2]).toBe(b.aufgaben!.liste[2]);
    expect(r.bestaende.crm).toBe(b.crm);
    expect(verbindungenPruefen(r.bestaende).map(x => x.id)).not.toContain('aufgabe-bezug-tot');
    expect(verbindungenReparieren(r.bestaende, ['aufgabe-bezug-tot'], JETZT, 'kevin').aenderungen).toEqual([]);
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


describe('Werte außerhalb der Wertelisten (Kevin 28.09.)', () => {
  it('ein Sammel-Hinweis; „In Werteliste aufnehmen“ legt die Werte als eigene an, feste bleiben, Personen unverändert', () => {
    const b = mit(x => { x.kontakte[0].typ = 'Kunde'; x.kontakte[0].typen = ['Kunde', 'Sondertyp']; x.kontakte[0].kategorie = 'Eigene Kategorie'; x.kontakte[1].labels = ['Messe 2026']; x.crm.wertelisten = { typen: ['Schon eigen'] }; });
    const h = verbindungenPruefen(b).find(x => x.id === 'werte-ausserhalb-wertelisten')!;
    expect(h).toMatchObject({ anzahl: 3, schwere: 'hinweis', reparierbar: true, knopf: 'In Werteliste aufnehmen' });
    const r = verbindungenReparieren(b, ['werte-ausserhalb-wertelisten'], JETZT, 'kevin');
    expect(r.bestaende.crm.wertelisten).toEqual({ typen: ['Schon eigen', 'Sondertyp'], kategorien: ['Eigene Kategorie'], labels: ['Messe 2026'] });
    expect(r.bestaende.kontakte).toEqual(b.kontakte);
    expect(verbindungenPruefen(r.bestaende).find(x => x.id === 'werte-ausserhalb-wertelisten')).toBeUndefined();
    // Zweimal: nichts mehr zu tun.
    expect(verbindungenReparieren(r.bestaende, ['werte-ausserhalb-wertelisten'], JETZT, 'kevin').aenderungen).toEqual([]);
  });
});
