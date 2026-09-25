// Kontaktakte (25.09.): eine Person mit allen Feldern, dem Verlauf und jeder Verbindung.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, Firma } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { vollstaendigkeit, verbindungen, takt, verlaufZahlen, PERSON_FELDER, FIRMA_FELDER, EINORDNUNG_FELDER, HERKUNFT_FELDER } from '../lib/crm/akte';
import { markttraktion, aufloesen } from '../lib/crm/adresse';

const J = '2026-09-25T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const f = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });

describe('Matrix', () => {
  it('führt jedes Feld der Masterdatei genau einmal — die private Notiz nie', () => {
    const felder = [...PERSON_FELDER, ...EINORDNUNG_FELDER, ...HERKUNFT_FELDER].map(x => x.feld);
    expect(new Set(felder).size).toBe(felder.length);
    expect(felder).not.toContain('privatNotiz');
    expect(FIRMA_FELDER.map(x => x.feld)).not.toContain('name');
  });
});

describe('Vollständigkeit', () => {
  it('zählt Person, Firma (aus dem Firmeneintrag) und Einordnung samt Prio und Eignung', () => {
    const p = k('a', { email: 'a@x.de', position: 'CEO', firmaId: 'f-x', firma: 'Firma x', prio: 'A', aufhaenger: 'Wachstum' });
    const v = vollstaendigkeit(p, f('x', { branche: 'Software', stadt: 'Köln' }));
    expect(v.gruppen.person).toEqual([4, PERSON_FELDER.length]);
    expect(v.gruppen.firma).toEqual([3, FIRMA_FELDER.length + 1]);
    expect(v.gruppen.einordnung).toEqual([2, EINORDNUNG_FELDER.length + 2]);
    expect(v.gefuellt).toBe(9);
  });
  it('ohne Firmeneintrag gelten die Firmenfelder aus dem Import; Leerzeichen zählen nicht', () => {
    const v = vollstaendigkeit(k('a', { firma: 'Acme', firmaBranche: 'Handel', firmaStadt: '  ' }));
    expect(v.gruppen.firma[0]).toBe(2);
  });
});

describe('Takt und Verlauf', () => {
  it('fällig nach dem Takt des Kreises; ohne vermerkten Kontakt sofort; ohne Kreis kein Takt', () => {
    expect(takt(k('a', { kreis: 'A', letzterKontakt: '2026-09-01' }), '2026-09-25')).toEqual({ tage: 30, seit: 24, faelligAm: '2026-10-01', ueberfaellig: false });
    expect(takt(k('a', { kreis: 'B' }), '2026-09-25')).toMatchObject({ seit: null, faelligAm: '2026-09-25', ueberfaellig: true });
    expect(takt(k('a'), '2026-09-25')).toBeNull();
  });
  it('zählt Gespräche und den jüngsten echten Eintrag (System zählt nicht)', () => {
    const z = verlaufZahlen(k('a', { aktivitaeten: [
      { am: '2026-09-01T09:00:00Z', art: 'anruf', ergebnis: 'gespraech', von: 'kevin' }, { am: '2026-09-10T09:00:00Z', art: 'termin', von: 'malin' },
      { am: '2026-09-12T09:00:00Z', art: 'mail', von: 'kevin' }, { am: '2026-09-20T09:00:00Z', art: 'system', von: 'system' },
    ] }));
    expect(z).toEqual({ eintraege: 4, gespraeche: 2, zuletzt: '2026-09-12T09:00:00Z' });
  });
});

describe('Verbindungen', () => {
  it('Deals der Person und der Firma, Events, Kampagnen mit Ergebnis, Beiträge, Power Hour, Anträge, Kollegen', () => {
    const a = k('a', { firmaId: 'f-x' });
    const kontakte = [a, k('b', { firmaId: 'f-x', kreis: 'A' }), k('c', { firmaId: 'f-x', lebensphase: 'kunde' }), k('d', { firmaId: 'f-y' })];
    const stand = {
      ...leererBestand(), firmen: [f('x')],
      chancen: [deal('ch-1', { kontaktIds: ['c-a'] }), deal('ch-2', { firma: 'Firma x', kontaktIds: ['c-b'] }), deal('ch-3', { firma: 'Firma y' })],
      events: [{ id: 'e-1', titel: 'Dinner', format: 'dinner' as const, ziel: 'x', datum: '2026-09-10', status: 'durchgefuehrt' as const, geaendert: J }],
      teilnahmen: [{ id: 't-1', eventId: 'e-1', kontaktId: 'c-a', status: 'da' as const, geaendert: J }, { id: 't-2', eventId: 'e-weg', kontaktId: 'c-a', status: 'da' as const, geaendert: J }],
      kampagnen: [{ id: 'kp-1', name: 'Herbst', playbook: 'x', ziel: 'x', zielgruppe: {}, kanal: 'telefon' as const, status: 'aktiv' as const, schritte: [], kontaktIds: ['c-a'], ergebnisse: [{ kontaktId: 'c-a', ergebnis: 'angesprochen' as const, am: '2026-09-02' }, { kontaktId: 'c-a', ergebnis: 'gespraech' as const, am: '2026-09-09' }], von: 'hand' as const, geaendert: J }],
      beitraege: [{ id: 'b-1', titel: 'Post', kanal: 'linkedin' as const, status: 'veroeffentlicht' as const, wirkung: [{ kontaktId: 'c-a', art: 'anfrage' as const, am: '2026-09-05' }], quellen: [], geaendert: J }],
      sitzungen: [{ id: 's-1', person: 'kevin', datum: '2026-09-03', start: J, ziel: { gespraeche: 4, termine: 1 }, karten: [{ kontaktId: 'c-a', kategorie: 'neu', ergebnis: 'mailbox' }] }],
      antraege: [{ id: 'an-1', art: 'auskunft' as const, name: 'a', kontaktId: 'c-a', eingang: '2026-09-01', frist: '2026-10-01', status: 'offen' as const, geaendert: J }],
    };
    const v = verbindungen(a, kontakte, stand);
    expect(v.deals.map(d => [d.id, !!d.ueberFirma])).toEqual([['ch-1', false], ['ch-2', true]]);
    expect(v.events.map(e => e.event.titel)).toEqual(['Dinner']);
    expect(v.kampagnen[0]).toMatchObject({ ergebnis: 'gespraech', am: '2026-09-09' });
    expect(v.beitraege[0]).toMatchObject({ art: 'Anfrage' });
    expect(v.powerHour).toEqual([{ datum: '2026-09-03', person: 'kevin', ergebnis: 'mailbox' }]);
    expect(v.antraege).toHaveLength(1);
    expect(v.kollegen.map(x => x.id)).toEqual(['c-c', 'c-b']);
  });
});

describe('Adresse der Akte', () => {
  it('Kontakte › Akte einer Person — der Zurück-Weg ist die Kartei mit derselben Person', () => {
    expect(markttraktion('kontakte', 'akte', 'c-a')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-a');
    expect(aufloesen('kontakte', 'akte')).toEqual({ s: 'kontakte', a: 'akte' });
    expect(markttraktion('kontakte', undefined, 'c-a')).toBe('/os/markttraktion?s=kontakte&k=c-a');
  });
});
