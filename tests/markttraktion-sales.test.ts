// Markttraktion · Sales zu zweit (25.09.): Kevin verantwortet Sales, Malin
// macht auch Sales. Getestet wird die reine Logik hinter Power Hour (Team-
// Zeile), Pipeline (Prognose je Person, Filter-Zahlen), Kunden (Zeile je
// Person) und Kampagnen (wer die Schritt-Aufgaben bekommt, wer angesprochen hat).
import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import type { Chance, Mandat, Kampagne, PowerHourSitzung } from '../lib/crm/typen';
import { bearbeiterFuer, werZahlen, prognoseJePerson, prognose, teamZahlen, echtesGespraech, kampagneJePerson } from '../lib/crm/pipeline';
import { kundenJePerson } from '../lib/crm/kunden';
import { werIstDran } from '../lib/crm/heute';
import { leererBestand } from '../lib/crm/speicher';

const HEUTE = '2026-09-25'; // Freitag
const ch = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-aaaa'], art: 'retainer', wert: { betrag: 1000, basis: 'monat', laufzeitMonate: 10 }, stufe: 'angebot',
  historie: [{ stufe: 'angebot', am: '2026-09-20', von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: '2026-09-01', geaendert: '2026-09-20', naechsterSchritt: { text: 'nachfassen', datum: '2026-09-30' }, ...x,
});
const md = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Beratung', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'auto', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: HEUTE, ...x,
});
const akt = (von: string, am: string, x: Partial<Aktivitaet> = {}): Aktivitaet => ({ am: `${am}T10:00:00.000Z`, art: 'anruf', von, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const kp = (x: Partial<Kampagne> = {}): Kampagne => ({
  id: 'kp-1', name: 'Test', playbook: 'eigen', ziel: 'Gespräche', zielgruppe: {}, kanal: 'persoenlich', status: 'aktiv', schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: HEUTE, ...x,
});

describe('Kampagnen-Aufgaben: wer bekommt sie?', () => {
  it('die Zuständigkeit der Kampagne — nicht, wer gerade klickt', () => {
    expect(bearbeiterFuer('malin', 'sales', 'kevin')).toBe('malin');
    expect(bearbeiterFuer('kevin', 'sales', 'malin')).toBe('kevin');
  });
  it('ohne Eintrag die Sales-Verantwortung (Kevin), bei „beide“ die anfragende Person', () => {
    expect(bearbeiterFuer(undefined, 'sales', 'malin')).toBe('kevin');
    expect(bearbeiterFuer('beide', 'sales', 'malin')).toBe('malin');
    expect(bearbeiterFuer('beide', 'sales', 'kevin')).toBe('kevin');
  });
  it('unbekannte Kürzel gelten als nicht eingetragen', () => {
    expect(bearbeiterFuer('joerg', 'sales', 'malin')).toBe('kevin');
    expect(bearbeiterFuer(undefined, 'marketing', 'kevin')).toBe('malin');
  });
});

describe('Filter-Zahlen „Alle · Meins · Malin“', () => {
  it('„beide“ zählt bei beiden, ohne Eintrag zählt es bei Kevin', () => {
    const l = [{ z: 'kevin' }, { z: 'malin' }, { z: 'beide' }, { z: undefined }];
    expect(werZahlen(l, x => x.z, 'sales', 'malin')).toEqual({ alle: 4, kevin: 3, malin: 2, ich: 2 });
    expect(werZahlen(l, x => x.z, 'sales', 'kevin').ich).toBe(3);
  });
  it('ohne angemeldete Person kein „ich“', () => {
    expect(werZahlen([{ z: 'malin' }], x => x.z, 'sales', null)).toEqual({ alle: 1, kevin: 0, malin: 1 });
  });
});

describe('Prognose je Person', () => {
  const chancen = [
    ch({ id: 'ch-a', besitzer: 'kevin' }), // 10.000 × 75 %
    ch({ id: 'ch-b', besitzer: 'malin', stufe: 'abschluss', wert: { betrag: 5000, basis: 'einmalig' } }), // 5.000 × 90 %, Commit
    ch({ id: 'ch-c', besitzer: 'malin', naechsterSchritt: { text: 'x', datum: '2026-09-20' } }), // hängt (überfällig)
    ch({ id: 'ch-d', besitzer: 'kevin', stufe: 'gewonnen' }), // zählt nicht
  ];
  it('teilt nach Besitzer, rechnet gewichtet, Commit und hängende Chancen', () => {
    const [kevin, malin] = prognoseJePerson(chancen, HEUTE);
    expect(kevin).toMatchObject({ person: 'kevin', anzahl: 1, offen: 10000, gewichtet: 7500, commit: 0, haengt: 0, ohneSchritt: 0 });
    expect(malin).toMatchObject({ person: 'malin', anzahl: 2, offen: 15000, gewichtet: 4500 + 7500, commit: 5000, haengt: 1 });
  });
  it('„Beide“ erscheint nur, wenn es gemeinsame Chancen gibt; die Summe passt zur Gesamtprognose', () => {
    expect(prognoseJePerson(chancen, HEUTE).map(x => x.person)).toEqual(['kevin', 'malin']);
    const mit = [...chancen, ch({ id: 'ch-e', besitzer: 'beide', naechsterSchritt: undefined })];
    const je = prognoseJePerson(mit, HEUTE);
    expect(je.map(x => x.person)).toEqual(['kevin', 'malin', 'beide']);
    expect(je[2]).toMatchObject({ anzahl: 1, ohneSchritt: 1 });
    expect(je.reduce((a, x) => a + x.offen, 0)).toBe(prognose(mit, HEUTE).offen);
  });
  it('unbekannter Besitzer liegt bei der Sales-Verantwortung', () => {
    expect(prognoseJePerson([ch({ besitzer: 'k' })], HEUTE)[0]).toMatchObject({ person: 'kevin', anzahl: 1 });
  });
});

describe('Team-Zeile der Power Hour', () => {
  const sitzungen: Pick<PowerHourSitzung, 'person' | 'datum'>[] = [
    { person: 'kevin', datum: HEUTE }, { person: 'kevin', datum: '2026-09-22' }, { person: 'kevin', datum: '2026-09-18' }, // 18. liegt vor den 7 Tagen
    { person: 'malin', datum: '2026-09-24' },
  ];
  const kontakte = [
    k('a', { aktivitaeten: [akt('kevin', HEUTE, { ergebnis: 'gespraech' }), akt('kevin', HEUTE, { ergebnis: 'mailbox' }), akt('kevin', '2026-09-23', { ergebnis: 'termin', art: 'termin' })] }),
    k('b', { aktivitaeten: [akt('malin', HEUTE, { art: 'gespraech' }), akt('malin', '2026-09-10', { ergebnis: 'gespraech' }), akt('system', HEUTE, { art: 'termin' }), akt('jarvis', HEUTE, { art: 'gespraech' })] }),
  ];
  it('Power Hours und echte Gespräche je Person — heute und 7 Tage (einschließlich heute)', () => {
    const [kevin, malin] = teamZahlen(kontakte, sitzungen, HEUTE);
    expect(kevin).toEqual({ person: 'kevin', powerHours: { heute: 1, woche: 2 }, gespraeche: { heute: 1, woche: 2 } });
    expect(malin).toEqual({ person: 'malin', powerHours: { heute: 0, woche: 1 }, gespraeche: { heute: 1, woche: 1 } });
  });
  it('echtes Gespräch: Ergebnis Gespräch/Termin oder ein Gespräch ohne Ergebnis — Mailbox, Notiz, Termin-Signal nicht', () => {
    expect(echtesGespraech({ art: 'anruf', ergebnis: 'gespraech' })).toBe(true);
    expect(echtesGespraech({ art: 'termin', ergebnis: 'termin' })).toBe(true);
    expect(echtesGespraech({ art: 'gespraech' })).toBe(true);
    expect(echtesGespraech({ art: 'anruf', ergebnis: 'mailbox' })).toBe(false);
    expect(echtesGespraech({ art: 'termin' })).toBe(false);
    expect(echtesGespraech({ art: 'notiz' })).toBe(false);
  });
});

describe('Kunden je Person', () => {
  const mandate = [
    md({ id: 'm-a' }), // ohne Eintrag → Kevin
    md({ id: 'm-b', zustaendig: 'malin', honorar: { betrag: 2000, basis: 'monat', netto: true }, naechstesReview: '2026-09-30', offen: ['Ziel unklar'] }),
    md({ id: 'm-c', zustaendig: 'malin', status: 'verhandlung', offen: ['Preis'] }),
    md({ id: 'm-d', zustaendig: 'malin', status: 'beendet', offen: ['alt'] }), // zählt nicht
    md({ id: 'm-e', zustaendig: 'kevin', health: { beteiligung: 40, umsetzung: 40, wirkung: 40, zahlung: null, stimmung: null } }), // rot
  ];
  it('aktive Mandate, MRR, Reviews in 7 Tagen, kritische und offene Punkte je Zuständigkeit', () => {
    const [kevin, malin] = kundenJePerson(mandate, HEUTE);
    expect(kevin).toEqual({ person: 'kevin', aktiv: 2, mrr: 6000, reviews: 0, kritisch: 1, offen: 0 });
    expect(malin).toEqual({ person: 'malin', aktiv: 1, mrr: 2000, reviews: 1, kritisch: 0, offen: 2 });
  });
  it('„Beide“ nur bei gemeinsamen Mandaten; die Lage vom Server hat Vorrang', () => {
    expect(kundenJePerson(mandate, HEUTE).length).toBe(2);
    expect(kundenJePerson([...mandate, md({ id: 'm-f', zustaendig: 'beide' })], HEUTE).map(x => x.person)).toEqual(['kevin', 'malin', 'beide']);
    expect(kundenJePerson([md({ id: 'm-a' })], HEUTE, { 'm-a': { ampel: 'rot' } })[0].kritisch).toBe(1);
  });
});

describe('Kampagne: wer hat angesprochen?', () => {
  it('je Person die angesprochenen Personen, Gespräche und Chancen — ältere Einträge ohne „von“ extra', () => {
    const k1 = kp({ ergebnisse: [
      { kontaktId: 'c-a', ergebnis: 'angesprochen', am: '2026-09-20', von: 'malin' },
      { kontaktId: 'c-a', ergebnis: 'gespraech', am: '2026-09-22', von: 'malin' },
      { kontaktId: 'c-b', ergebnis: 'angesprochen', am: '2026-09-20', von: 'kevin' },
      { kontaktId: 'c-c', ergebnis: 'chance', am: '2026-09-23', von: 'kevin' },
      { kontaktId: 'c-d', ergebnis: 'kein_interesse', am: '2026-09-21' },
    ] });
    expect(kampagneJePerson(k1)).toEqual([
      { person: 'kevin', angesprochen: 2, gespraeche: 0, chancen: 1 },
      { person: 'malin', angesprochen: 1, gespraeche: 1, chancen: 0 },
      { person: '', angesprochen: 1, gespraeche: 0, chancen: 0 },
    ]);
  });
  it('ohne Ergebnisse leer', () => {
    expect(kampagneJePerson(kp())).toEqual([]);
  });
});

describe('Power Hour je Person (Fundament, hier im Zusammenspiel)', () => {
  it('Karten der anderen Person tauchen nicht auf, werden aber gezählt', () => {
    const kontakte = [
      k('kevin1', { naechsterSchritt: { text: 'anrufen', datum: HEUTE }, telefon: '030', besitzer: 'kevin', lebensphase: 'kunde' }),
      k('malin1', { naechsterSchritt: { text: 'anrufen', datum: HEUTE }, telefon: '030', besitzer: 'malin', lebensphase: 'kunde' }),
    ];
    const crm = leererBestand();
    const kevin = werIstDran(kontakte, crm, HEUTE, 'kevin');
    const malin = werIstDran(kontakte, crm, HEUTE, 'malin');
    expect(kevin.karten.map(x => x.kontakt.id)).not.toContain('c-malin1');
    expect(malin.karten.map(x => x.kontakt.id)).not.toContain('c-kevin1');
    expect(kevin.ausgefiltert.beiAnderen).toBeGreaterThanOrEqual(1);
    expect(malin.ausgefiltert.beiAnderen).toBeGreaterThanOrEqual(1);
  });
});
