// Markttraktion · Geführte Runden (25.09.): 438 von 453 Kontakten ohne Kreis,
// 17 im Gespräch ohne Chance. Getestet wird die reine Logik hinter der
// Kreis-Runde (wer in welcher Reihenfolge, mit welchem Grund, Zähler und
// Zusammenfassung) und der Chancen-Runde (wer, welcher Vorschlag, was der
// Säuberer aus der neuen Chance macht, Summen).
import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import type { Chance, Mandat } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import {
  kreisKandidaten, kreisBilanz, kreisZusammenfassung, letzteNotiz, kurzDatum, KREIS_WAHL,
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
