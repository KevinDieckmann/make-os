// Markttraktion · Geführte Runden (25.09.): 438 von 453 Kontakten ohne Kreis,
// 17 im Gespräch ohne Chance. Getestet wird die reine Logik hinter der
// Kreis-Runde (wer in welcher Reihenfolge, mit welchem Grund, Zähler und
// Zusammenfassung) und der Chancen-Runde (wer, welcher Vorschlag, was der
// Säuberer aus der neuen Chance macht, Summen).
import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import type { Chance, Mandat, Leistung, Firma } from '../lib/crm/typen';
import { leererBestand, saeubern } from '../lib/crm/speicher';
import {
  kreisKandidaten, kreisBilanz, kreisZusammenfassung, letzteNotiz, kurzDatum, KREIS_WAHL,
  chancenKandidaten, wertFuerArt, chanceAnlegen, chanceBesitzer, chancenBilanz, schrittOk, STUFE_ZU_CHANCE,
} from '../lib/crm/runden';

const HEUTE = '2026-09-25'; // Freitag
const J = '2026-09-25T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const md = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'ACME Venetian Products GmbH', kontaktIds: [], titel: 'Beratung', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true,
  verlaengerung: 'auto', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: HEUTE, ...x,
});
const ch = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-aaaa'], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot',
  historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x,
});
const lst = (x: Partial<Leistung>): Leistung => ({ id: 'l-x', name: 'X', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'offen', status: 'aktiv', geaendert: HEUTE, ...x });
const akt = (am: string, x: Partial<Aktivitaet> = {}): Aktivitaet => ({ am: `${am}T10:00:00.000Z`, art: 'notiz', von: 'kevin', ...x });

describe('Kreis-Runde: wer, in welcher Reihenfolge, warum', () => {
  const kontakte = [
    k('rest', { prio: 'C', letzterKontakt: '2026-09-01' }),
    k('prio-b', { prio: 'B' }),
    k('prio-a-alt', { prio: 'A', letzterKontakt: '2026-03-01' }),
    k('prio-a-neu', { prio: 'A', eignung: 'ja', letzterKontakt: '2026-09-10' }),
    k('gespraech', { stufe: 'gespraech', letzterKontakt: '2026-08-24' }),
    k('mandat'),
    k('kunde', { lebensphase: 'kunde' }),
    k('chance'),
    k('schon', { kreis: 'A', lebensphase: 'kunde' }),
    k('gesperrt', { lebensphase: 'kunde', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
  ];
  const crm = { ...leererBestand(), mandate: [md({ kontaktIds: ['c-mandat', 'c-kunde'] })], chancen: [ch({ kontaktIds: ['c-chance'], titel: 'Workshop Q4', stufe: 'bedarf' })] };
  const l = kreisKandidaten(kontakte, crm, HEUTE);

  it('ohne Kreis und ohne Werbesperre', () => {
    const ids = l.map(x => x.kontakt.id);
    expect(ids).not.toContain('c-schon');
    expect(ids).not.toContain('c-gesperrt');
    expect(ids).toHaveLength(8);
  });
  it('Kunden, Mandate und Chancen zuerst, dann im Gespräch, dann Prio A vor B (jüngster Kontakt zuerst), dann der Rest', () => {
    expect(l.slice(0, 3).map(x => x.gruppe)).toEqual([0, 0, 0]);
    expect(l.slice(3).map(x => x.kontakt.id)).toEqual(['c-gespraech', 'c-prio-a-neu', 'c-prio-a-alt', 'c-prio-b', 'c-rest']);
  });
  it('je Karte ein kurzer Grund', () => {
    const grund = (id: string) => l.find(x => x.kontakt.id === `c-${id}`)!.grund;
    expect(grund('kunde')).toBe('Kunde · Mandat ACME Venetian Products');
    expect(grund('mandat')).toBe('Mandat ACME Venetian Products');
    expect(grund('chance')).toBe('Chance „Workshop Q4“');
    expect(grund('gespraech')).toBe('im Gespräch · zuletzt 24.8.');
    expect(grund('prio-a-neu')).toBe('Prio A · Eignung ja · zuletzt 10.9.');
    expect(grund('rest')).toBe('Prio C · zuletzt 1.9.');
  });
  it('wichtig = alles außer den Übrigen (erste Etappe)', () => {
    expect(l.filter(x => x.wichtig).length).toBe(7);
    expect(l[l.length - 1].wichtig).toBe(false);
  });
  it('ein beendetes Mandat oder ein Mandat im Angebot steht dabei — mit Status', () => {
    const r = kreisKandidaten([k('ex', { lebensphase: 'ex_kunde' }), k('neu')], { ...leererBestand(), mandate: [md({ kontaktIds: ['c-ex'], status: 'beendet', kunde: 'Recruvia' }), md({ id: 'm-2', kontaktIds: ['c-neu'], status: 'angebot', kunde: 'CapOS GmbH i. G.' })] }, HEUTE);
    expect(r.map(x => [x.kontakt.id, x.gruppe, x.grund])).toEqual([['c-neu', 0, 'Mandat CapOS (Angebot)'], ['c-ex', 1, 'Ex-Kunde · früher Mandat Recruvia']]);
  });
  it('die vier Kreise mit Taste und Takt aus KREIS_TAKT', () => {
    expect(KREIS_WAHL.map(w => `${w.taste}${w.id}${w.takt}`)).toEqual(['1A30', '2B60', '3C90', '4D180']);
  });
});

describe('Kreis-Runde: Zähler und Zusammenfassung', () => {
  const b = kreisBilanz([
    { kontaktId: 'c-1', kreis: 'A', besitzer: 'kevin', anrede: 'Sie' },
    { kontaktId: 'c-2', kreis: 'B', besitzer: 'malin', anrede: 'Du' },
    { kontaktId: 'c-3', kreis: 'B', besitzer: 'beide' },
    { kontaktId: 'c-4', kreis: null, besitzer: 'kevin' },
  ]);
  it('je Kreis, je Person, übersprungen', () => {
    expect(b.jeKreis).toEqual({ A: 1, B: 2, C: 0, D: 0 });
    expect(b.jePerson).toEqual({ kevin: 1, malin: 1, beide: 1 });
    expect([b.gesetzt, b.uebersprungen]).toEqual([3, 1]);
  });
  it('„an Malin“ — verteilt heißt: weg von der Sales-Verantwortung', () => {
    expect(kreisZusammenfassung(b)).toBe('A 1 · B 2 · C 0 · D 0 · an Malin 1 · gemeinsam 1 · 1 übersprungen');
    expect(kreisZusammenfassung(kreisBilanz([]))).toBe('A 0 · B 0 · C 0 · D 0');
  });
  it('letzte Notiz: Vorlage vor Text, System zählt nicht', () => {
    const x = k('n', { aktivitaeten: [akt('2026-09-01', { text: 'erste' }), akt('2026-09-10', { notiz: { bedarf: 'Vertrieb aufbauen', zusage: 'Deck schicken' } }), akt('2026-09-20', { art: 'system', text: 'Zusammengeführt' })] });
    expect(letzteNotiz(x)).toEqual({ am: '2026-09-10T10:00:00.000Z', von: 'kevin', text: 'Bedarf / Schmerz: Vertrieb aufbauen · Unsere Zusage: Deck schicken' });
    expect(letzteNotiz(k('leer'))).toBeNull();
  });
  it('Datum kurz, mit Jahr nur außerhalb des laufenden', () => {
    expect(kurzDatum('2026-02-04', HEUTE)).toBe('4.2.');
    expect(kurzDatum('2025-12-24', HEUTE)).toBe('24.12.25');
  });
});

describe('Chancen-Runde: wer und welcher Vorschlag', () => {
  const leistungen = [
    lst({ id: 'l-premium', typ: 'retainer', stufe: 'premium', preis: { betrag: 3000, einheit: 'Monat netto' } }),
    lst({ id: 'l-kern', name: 'Retainer Kern', typ: 'retainer', stufe: 'kern', preis: { betrag: 2000, einheit: 'Monat netto, Laufzeit 3, 6 oder 12 Monate' } }),
    lst({ id: 'l-entwurf', typ: 'retainer', stufe: 'kern', status: 'entwurf', preis: { betrag: 500, einheit: 'Monat' } }),
    lst({ id: 'l-ws', name: 'Workshop-Paket', typ: 'workshop', stufe: 'einstieg', preis: { betrag: 3000, einheit: 'einmalig' } }),
    lst({ id: 'l-prov', typ: 'vermittlung', preis: { betrag: 10, einheit: '% der Monatsgebühr' } }),
  ];
  const firmen: Firma[] = [{ id: 'f-dotama-1', name: 'Dotama GmbH', rolle: 'zielkunde', geaendert: HEUTE }];
  const kontakte = [
    k('gespraech', { stufe: 'gespraech', firma: 'Alt GmbH', firmaId: 'f-dotama-1', letzterKontakt: '2026-02-04', prio: 'A' }),
    k('termin', { stufe: 'termin', letzterKontakt: '2026-09-01', aktivitaeten: [akt('2026-09-01', { art: 'gespraech', notiz: { bedarf: 'Vertrieb skalieren', zusage: 'Konzept bis Freitag', naechster: 'Diagnose ansetzen' } })] }),
    k('angebot', { stufe: 'angebot', firma: 'Tagesspiegel', naechsterSchritt: { text: 'Angebot nachfassen', datum: '2026-09-20' } }),
    k('offen', { stufe: 'gespraech' }),
    k('verloren', { stufe: 'gespraech' }),
    k('gesperrt', { stufe: 'angebot', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('neu', { stufe: 'neu' }),
    k('kunde', { stufe: 'gespraech', lebensphase: 'kunde' }),
  ];
  const crm = {
    ...leererBestand(), firmen, leistungen,
    chancen: [ch({ id: 'ch-o', kontaktIds: ['c-offen'], stufe: 'bedarf' }), ch({ id: 'ch-v', kontaktIds: ['c-verloren'], stufe: 'verloren', titel: 'Alt', grund: 'Preis' })],
    mandate: [md({ kontaktIds: ['c-kunde'], kunde: 'ILD GmbH' }), md({ id: 'm-alt', kontaktIds: ['c-verloren'], kunde: 'Infinity Future GmbH', status: 'beendet' })],
  };
  const l = chancenKandidaten(kontakte, crm, HEUTE);
  const von = (id: string) => l.find(x => x.kontakt.id === `c-${id}`)!;

  it('im Gespräch, Termin oder Angebot — ohne offene Chance, ohne Sperre; Angebote zuerst', () => {
    expect(l.map(x => x.kontakt.id)).toEqual(['c-angebot', 'c-termin', 'c-gespraech', 'c-kunde', 'c-verloren']);
  });
  it('Stufe aus der Kontaktstufe, Titel = Firma (Stammdaten vor Freitext), sonst Name', () => {
    expect(STUFE_ZU_CHANCE).toEqual({ angebot: 'angebot', termin: 'diagnose', gespraech: 'bedarf' });
    expect(von('angebot').vorschlag.stufe).toBe('angebot');
    expect(von('termin').vorschlag.stufe).toBe('diagnose');
    expect(von('gespraech').vorschlag).toMatchObject({ stufe: 'bedarf', titel: 'Dotama GmbH', firma: 'Dotama GmbH' });
    expect(von('termin').vorschlag.titel).toBe('termin Test');
    expect(von('termin').vorschlag.firma).toBeUndefined();
  });
  it('Wert aus der Kern-Leistung, Hinweise aus der letzten Notiz, Schritt aus Zusage oder Notiz', () => {
    expect(von('termin').vorschlag.wert).toEqual({ betrag: 2000, basis: 'monat', leistungId: 'l-kern', leistung: 'Retainer Kern' });
    expect(von('termin').hinweise).toEqual(['Bedarf: Vertrieb skalieren', 'Unsere Zusage: Konzept bis Freitag']);
    expect(von('termin').vorschlag.naechsterSchritt).toEqual({ text: 'Diagnose ansetzen', datum: '2026-09-30' });
    // Zugesagt am 20.09. — überfällig, also heute statt eines Datums in der Vergangenheit.
    expect(von('angebot').vorschlag.naechsterSchritt).toEqual({ text: 'Angebot nachfassen', datum: HEUTE });
    expect(von('angebot').hinweise[0]).toBe('Zugesagt: Angebot nachfassen (20.9.)');
    expect(von('gespraech').vorschlag.naechsterSchritt.text).toBe('');
    expect(von('gespraech').grund).toBe('Im Gespräch · zuletzt 4.2. · Prio A');
  });
  it('laufendes Mandat: Hinweis, und „kein Bedarf“ lässt die Person Kunde bleiben', () => {
    expect(von('kunde').keinBedarf).toBe('gewonnen');
    expect(von('kunde').hinweise[0]).toMatch(/^Mandat ILD \(aktiv\)/);
    expect(von('gespraech').keinBedarf).toBe('ruht');
    expect(von('verloren').hinweise).toEqual(['Früheres Mandat Infinity Future (beendet)', 'Frühere Chance „Alt“: verloren (Preis)']);
    expect(von('verloren').keinBedarf).toBe('ruht');
  });
  it('Wert je Art: aktiv, mit Preis, keine Prozente — sonst leer', () => {
    expect(wertFuerArt('workshop', leistungen)).toEqual({ betrag: 3000, basis: 'einmalig', leistungId: 'l-ws', leistung: 'Workshop-Paket' });
    expect(wertFuerArt('vermittlung', leistungen)).toEqual({ betrag: 0, basis: 'einmalig' });
    expect(wertFuerArt('retainer', [])).toEqual({ betrag: 0, basis: 'monat' });
  });
});

describe('Chancen-Runde: anlegen, wie der Speicher es annimmt', () => {
  const kontakt = k('aaaa', { besitzer: 'malin' });
  const eingabe = { titel: ' Dotama GmbH ', firma: 'Dotama GmbH', art: 'retainer' as const, betrag: 2000, basis: 'monat' as const, stufe: 'bedarf' as const, naechsterSchritt: { text: ' Bedarf klären ', datum: '2026-09-30' }, erwartetAm: '2026-10-31', besitzer: 'malin', leistungId: 'l-kern' };
  const c = chanceAnlegen('ch-test1', kontakt, eingabe, J, 'kevin');

  it('Felder nach typen.ts — der Säuberer verwirft nichts', () => {
    const s = saeubern('chancen', { ...c }, J, 'kevin');
    expect(s).not.toBeNull();
    const { geaendertVon: _v, ...rest } = s as Record<string, unknown>;
    expect(rest).toEqual({ ...c });
    expect(c).toMatchObject({ titel: 'Dotama GmbH', kontaktIds: ['c-aaaa'], naechsterSchritt: { text: 'Bedarf klären', datum: '2026-09-30' }, historie: [{ stufe: 'bedarf', am: J, von: 'kevin' }], gesellschaft: 'offen', besitzer: 'malin' });
  });
  it('ohne Titel der Name, kein Datum-Unsinn bei „Entscheidung bis“', () => {
    const d = chanceAnlegen('ch-test2', kontakt, { ...eingabe, titel: ' ', erwartetAm: 'morgen', betrag: Number.NaN }, J, 'kevin');
    expect(d.titel).toBe('aaaa Test');
    expect(d.erwartetAm).toBeUndefined();
    expect(d.wert.betrag).toBe(0);
  });
  it('Besitzer: wer die Beziehung hält — bei „beide“ wer anlegt, ohne Eintrag Kevin', () => {
    expect(chanceBesitzer(k('x', { besitzer: 'malin' }), 'kevin')).toBe('malin');
    expect(chanceBesitzer(k('x', { besitzer: 'beide' }), 'malin')).toBe('malin');
    expect(chanceBesitzer(k('x', { besitzer: 'beide' }), null)).toBe('kevin');
    expect(chanceBesitzer(k('x'), 'malin')).toBe('kevin');
  });
  it('nächster Schritt ist Pflicht: Text und Datum', () => {
    expect(schrittOk({ text: 'x', datum: '2026-09-30' })).toBe(true);
    expect(schrittOk({ text: ' ', datum: '2026-09-30' })).toBe(false);
    expect(schrittOk({ text: 'x', datum: '' })).toBe(false);
  });
  it('Summe (Monat × 12) und gewichtet nach Stufe', () => {
    const b = chancenBilanz([{ wert: { betrag: 2000, basis: 'monat' }, stufe: 'bedarf' }, { wert: { betrag: 3000, basis: 'einmalig' }, stufe: 'angebot' }]);
    expect(b).toEqual({ anzahl: 2, summe: 27000, gewichtet: Math.round(24000 * 0.45) + Math.round(3000 * 0.75) });
    expect(chancenBilanz([{ wert: { betrag: 1000, basis: 'einmalig' }, stufe: 'angebot' }], { angebot: 50 }).gewichtet).toBe(500);
  });
});
