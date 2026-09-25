// Produkte & Mandate (25.09.): Linien, Zahlen je Produkt, Phasen, Speicherform.
import { describe, it, expect } from 'vitest';
import type { Chance, Leistung, Mandat } from '../lib/crm/typen';
import { linieVon, linienGruppen, produktZahlen, portfolio, mandatPhase, neuePhasenId } from '../lib/crm/produkte';
import { saeubern, unterlageLink } from '../lib/crm/speicher';

const J = '2026-09-25T10:00:00.000Z';
const l = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: id, typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'kdc', status: 'aktiv', geaendert: J, ...x });
const m = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const c = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'bedarf', historie: [], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });

describe('Produktlinien', () => {
  it('eingetragen oder aus dem Typ; bekannte Linien zuerst, darin aktiv → Entwurf, Einstieg → Premium', () => {
    expect(linieVon(l('a', { typ: 'vermittlung' }))).toBe('Vermittlung & Provision');
    expect(linieVon(l('a', { linie: ' POINCAP ' }))).toBe('POINCAP');
    const g = linienGruppen([l('p', { stufe: 'premium' }), l('w', { typ: 'workshop' }), l('e', { stufe: 'einstieg', status: 'entwurf' }), l('k'), l('x', { linie: 'Aaa eigene' })]);
    expect(g.map(x => [x.linie, x.produkte.map(p => p.id)])).toEqual([['Beratung & Begleitung', ['k', 'p', 'e']], ['Workshops & Formate', ['w']], ['Aaa eigene', ['x']]]);
  });
});

describe('Zahlen je Produkt', () => {
  it('aktive Mandate, Monatsumsatz, Pipeline und Abschlussquote', () => {
    const crm = {
      mandate: [m('m1', { leistungId: 'r', honorar: { betrag: 3000, basis: 'monat', netto: true } }), m('m2', { leistungId: 'r', status: 'beendet', honorar: { betrag: 2000, basis: 'monat', netto: true } }), m('m3', { leistungId: 'r', honorar: { betrag: 5000, basis: 'einmalig', netto: true } }), m('m4')],
      chancen: [c('c1', { leistungId: 'r', wert: { betrag: 24000, basis: 'jahr' } }), c('c2', { leistungId: 'r', stufe: 'gewonnen' }), c('c3', { leistungId: 'r', stufe: 'verloren' }), c('c4', { leistungId: 'r', stufe: 'gewonnen' })],
    };
    expect(produktZahlen(l('r'), crm)).toEqual({ mandateAktiv: 2, mandateGesamt: 3, mrr: 3000, einmalig: 5000, dealsOffen: 1, pipelineWert: 2000, gewonnen: 2, verloren: 1, quote: 2 / 3 });
    expect(produktZahlen(l('leer'), crm).quote).toBeNull();
  });
  it('Portfolio: aktive Mandate, Monatsumsatz, größter Kunde, Mandate ohne Produkt', () => {
    const p = portfolio({ mandate: [m('a', { kunde: 'Acme', honorar: { betrag: 3000, basis: 'monat', netto: true }, leistungId: 'r' }), m('b', { kunde: 'Beta', honorar: { betrag: 1000, basis: 'monat', netto: true } }), m('c', { status: 'beendet' })], leistungen: [l('r'), l('s', { status: 'entwurf' })] });
    expect(p).toEqual({ aktiv: 2, mrr: 4000, ohneProdukt: 1, produkteAktiv: 1, groessterKunde: { kunde: 'Acme', anteil: 0.75 } });
  });
});

describe('Phasen', () => {
  it('Mandat steht in einer Phase des Produkts; ohne Angabe in der ersten', () => {
    const p = l('r', { phasen: [{ id: 'p1', name: 'Kickoff' }, { id: 'p2', name: 'Diagnose' }, { id: 'p3', name: 'Umsetzung' }] });
    expect(mandatPhase(m('x', { phase: 'p2' }), p)).toEqual({ nr: 2, von: 3, name: 'Diagnose', naechste: 'Umsetzung' });
    expect(mandatPhase(m('x'), p)).toMatchObject({ nr: 1, name: 'Kickoff' });
    expect(mandatPhase(m('x'), l('ohne'))).toBeNull();
    expect(neuePhasenId(p)).toBe('p4');
  });
});

describe('Speicherform', () => {
  it('Produkt behält Linie, Phasen und Unterlagen — nur sichere Links', () => {
    const s = saeubern('leistungen', { id: 'l-1', name: 'Retainer', linie: 'Beratung & Begleitung', phasen: [{ id: 'p1', name: 'Kickoff', dauerTage: 14 }, { name: '' }], unterlagen: [{ titel: 'Angebot', art: 'angebot', url: 'https://example.com/a.pdf' }, { titel: 'Böse', url: 'javascript:alert(1)' }, { titel: 'Notiz', url: '/os/wissen?n=abc' }] }, J, 'kevin') as unknown as Leistung;
    expect(s.linie).toBe('Beratung & Begleitung');
    expect(s.phasen).toEqual([{ id: 'p1', name: 'Kickoff', dauerTage: 14 }]);
    expect(s.unterlagen?.map(u => [u.titel, u.art, u.url ?? null])).toEqual([['Angebot', 'angebot', 'https://example.com/a.pdf'], ['Böse', 'sonstiges', null], ['Notiz', 'sonstiges', '/os/wissen?n=abc']]);
    expect(unterlageLink('http://unsicher.de')).toBeUndefined();
    expect((saeubern('mandate', { ...m('m-1'), phase: 'p2' }, J, 'kevin') as unknown as Mandat).phase).toBe('p2');
  });
});
