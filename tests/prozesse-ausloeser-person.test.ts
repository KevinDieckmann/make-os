// ─── Prozesse · Auslöser „je Person ab Uhrzeit“ (24.10., Paket Ü 2) — rein ───────────────────────────────────────────────────────────────────────────
// Entscheidung 24.10. (Klickrunde): „je Person ab Uhrzeit, nur an Arbeitstagen (nicht Business-frei, Feiertage wie der alte Weg), einmal am Tag, mit Nachholen“ —
// als allgemeiner Auslöser des Lauf-Motors. Geprüft: Säubern/Prüfen, Satz, die Regel des Takts (erster Takt merkt nur, Tage, Uhrzeit, bis, Morgenlauf, Business-frei
// je Haushalt und je Person mit Nachholen am selben Tag, einmal am Tag, Grenze, Stunde aus einer Stellschraube), Säuberer des Bestands, Art. 17 im Lauf-Bestand.
import { describe, it, expect } from 'vitest';
import { ausloeserAus, ausloeserText, personenFaellig, personSchluessel, personAb, personTagPasst, type PersonLage } from '@/lib/prozesse/ausloeser';
import { definitionAus } from '@/lib/prozesse/bestand';
import { BAUSTEIN_KATALOG } from '@/lib/prozesse/baustein-katalog';
import { AUSLOESER_ARTEN, type Ausloeser } from '@/lib/prozesse/definition';
import { laeufeOhneKonto } from '@/lib/prozesse/lauf-server';
import { leereLaeufe } from '@/lib/prozesse/lauf-typen';

type PA = Extract<Ausloeser, { art: 'person' }>;
const A: PA = { art: 'person', uhrzeit: '07:00', bis: '22:00', tage: 'mo-fr', nachMorgenlauf: true };
/** Montag 2026-12-21 … Freitag 2026-12-25 (1. Weihnachtstag, Feiertag NRW). */
const lage = (wand: string, o: Partial<PersonLage> = {}): PersonLage => ({ wand, wochentag: 1, feiertag: false, morgenlaufDurch: true, haushaltFrei: false, frei: new Set(), ...o });
const P = ['pia', 'olaf'];
const stand = (seit = '2026-12-20', tage: Record<string, string> = {}) => ({ seit, tage });

describe('Prüfen und Satz', () => {
  it('gültig: Uhrzeit, bis, Tage (ohne = Mo–Fr), nach dem Morgenlauf, Stunde aus einer Stellschraube „ab Uhrzeit“', () => {
    expect(ausloeserAus({ art: 'person', uhrzeit: '07:00' }, 'keiner')).toEqual({ ausloeser: { art: 'person', uhrzeit: '07:00', tage: 'mo-fr' }, befunde: [] });
    expect(ausloeserAus({ ...A, stundeAus: 'head.sales.power_hour.stunde' }, 'keiner').ausloeser).toEqual({ ...A, stundeAus: 'head.sales.power_hour.stunde' });
    expect(ausloeserAus({ art: 'person', uhrzeit: '09:00', tage: 'werktage' }, 'deal').befunde).toEqual([]);
  });
  it('unvollständig bzw. falsch: ohne Uhrzeit, „bis“ nicht nach „ab“, unbekannte Tage, Stellschraube keine Stunde', () => {
    expect(ausloeserAus({ art: 'person' }, 'keiner').befunde[0].stufe).toBe('offen');
    expect(ausloeserAus({ art: 'person', uhrzeit: '09:00', bis: '08:00' }, 'keiner').ausloeser).toBeNull();
    expect(ausloeserAus({ art: 'person', uhrzeit: '09:00', bis: '9 Uhr' }, 'keiner').befunde.some(b => b.stufe === 'fehler')).toBe(true);
    expect(ausloeserAus({ art: 'person', uhrzeit: '09:00', tage: 'wochenende' }, 'keiner').ausloeser).toBeNull();
    expect(ausloeserAus({ art: 'person', uhrzeit: '09:00', stundeAus: 'treppe.reportTage' }, 'keiner').befunde.some(b => b.stufe === 'fehler')).toBe(true);
  });
  it('Satz, Art in der Liste, Baustein in der Palette (mit Maske)', () => {
    expect(ausloeserText(A)).toBe('je Person Mo–Fr ab 07:00 bis 22:00 nach dem Morgenlauf, einmal am Tag (Business-frei ruht er)');
    expect(ausloeserText({ ...A, stundeAus: 'head.sales.power_hour.stunde' })).toContain('ab der Uhrzeit der Stellschraube');
    expect(AUSLOESER_ARTEN).toContain('person');
    const k = BAUSTEIN_KATALOG.find(e => e.id === 'ausloeser.person')!;
    expect(k.maske.map(f => f.id)).toEqual(['uhrzeit', 'bis', 'tage', 'nachMorgenlauf']);
    expect(k.nurUeberfuehrung).toBeUndefined();
  });
  it('der Säuberer des Bestands behält den Auslöser (fehlende Tage = Mo–Fr)', () => {
    const roh = { id: 'pz-a', titel: 'Je Person', bereich: 'sales', fallArt: 'keiner', knoten: [{ id: 'w', titel: 'W', rang: 0 }, { id: 'p', elternId: 'w', titel: 'P', rang: 0 },
      { id: 't', elternId: 'p', titel: 'T', rang: 0, form: 'ausloeser', ausloeser: { art: 'person', uhrzeit: '08:00', stundeAus: 'head.sales.power_hour.stunde', unsinn: 1 } }] };
    const d = definitionAus(roh);
    expect(d?.knoten.find(k => k.id === 't')?.ausloeser).toEqual({ art: 'person', uhrzeit: '08:00', tage: 'mo-fr', stundeAus: 'head.sales.power_hour.stunde' });
  });
});

describe('Die Regel des Takts', () => {
  it('erster Takt: nur merken — niemand startet, ab dem Folgetag', () => {
    const r = personenFaellig(A, P, lage('2026-12-21T09:00:00'), undefined);
    expect(r).toEqual({ stand: { seit: '2026-12-21', tage: {} }, starten: [], ueber: 0 });
    expect(personenFaellig(A, P, lage('2026-12-21T09:30:00'), r.stand).starten).toEqual([]);
    expect(personenFaellig(A, P, lage('2026-12-22T09:00:00', { wochentag: 2 }), r.stand).starten).toEqual(P);
  });
  it('Uhrzeit erreicht, nicht über „bis“, nur nach dem Morgenlauf', () => {
    expect(personenFaellig(A, P, lage('2026-12-21T06:59:00'), stand()).starten).toEqual([]);
    expect(personenFaellig(A, P, lage('2026-12-21T07:00:00'), stand()).starten).toEqual(P);
    expect(personenFaellig(A, P, lage('2026-12-21T22:00:00'), stand()).starten).toEqual([]);
    expect(personenFaellig(A, P, lage('2026-12-21T08:00:00', { morgenlaufDurch: false }), stand()).starten).toEqual([]);
    expect(personenFaellig({ ...A, nachMorgenlauf: undefined }, P, lage('2026-12-21T08:00:00', { morgenlaufDurch: false }), stand()).starten).toEqual(P);
  });
  it('Tage: Mo–Fr zählt Feiertage mit (wie die Heads), Werktage nicht, Wochenende nie, täglich immer', () => {
    expect(personTagPasst('mo-fr', 5, true)).toBe(true);
    expect(personTagPasst('werktage', 5, true)).toBe(false);
    expect(personTagPasst('werktage', 4, false)).toBe(true);
    expect(personTagPasst('mo-fr', 6, false)).toBe(false);
    expect(personTagPasst('taeglich', 7, true)).toBe(true);
    expect(personenFaellig(A, P, lage('2026-12-25T08:00:00', { wochentag: 5, feiertag: true }), stand()).starten).toEqual(P);
    expect(personenFaellig({ ...A, tage: 'werktage' }, P, lage('2026-12-25T08:00:00', { wochentag: 5, feiertag: true }), stand()).starten).toEqual([]);
    expect(personenFaellig(A, P, lage('2026-12-26T08:00:00', { wochentag: 6 }), stand()).starten).toEqual([]);
  });
  it('Business-frei: der Haushalt sperrt alle, eine Person nur sich — sie kommt später am selben Tag (Nachholen), am nächsten Tag nicht doppelt', () => {
    expect(personenFaellig(A, P, lage('2026-12-21T08:00:00', { haushaltFrei: true }), stand()).starten).toEqual([]);
    const r1 = personenFaellig(A, P, lage('2026-12-21T08:00:00', { frei: new Set(['olaf']) }), stand());
    expect(r1.starten).toEqual(['pia']);
    const gestartet = stand('2026-12-20', { [personSchluessel('pia')]: '2026-12-21' });
    expect(personenFaellig(A, P, lage('2026-12-21T11:00:00'), gestartet).starten).toEqual(['olaf']);
    expect(personenFaellig(A, P, lage('2026-12-21T11:00:00'), { ...gestartet, tage: { ...gestartet.tage, [personSchluessel('olaf')]: '2026-12-21' } }).starten).toEqual([]);
    expect(personenFaellig(A, P, lage('2026-12-22T07:30:00', { wochentag: 2 }), gestartet).starten).toEqual(P);
  });
  it('Stunde aus der Stellschraube gewinnt vor der Uhrzeit; ohne Wert gilt die Uhrzeit', () => {
    const S: PA = { ...A, stundeAus: 'head.sales.power_hour.stunde' };
    expect(personAb(S, 9)).toBe('09:00');
    expect(personAb(S)).toBe('07:00');
    expect(personAb(A, 9)).toBe('07:00');
    expect(personenFaellig(S, P, lage('2026-12-21T08:00:00', { stunde: 9 }), stand()).starten).toEqual([]);
    expect(personenFaellig(S, P, lage('2026-12-21T09:00:00', { stunde: 9 }), stand()).starten).toEqual(P);
  });
  it('Grenze: höchstens n Personen — der Rest wird gezählt, nie still', () => {
    expect(personenFaellig(A, ['a', 'b', 'c'], lage('2026-12-21T08:00:00'), stand(), 2)).toMatchObject({ starten: ['a', 'b'], ueber: 1 });
  });
  it('der Stand trägt nur Fingerabdrücke — Konto löschen nimmt den der Person heraus', () => {
    expect(personSchluessel('pia')).toMatch(/^[0-9a-f]{8}$/);
    const d = leereLaeufe();
    d.prozesse['pz-a'] = { einstellung: {}, verlauf: [], person: { t: { seit: '2026-12-20', tage: { [personSchluessel('pia')]: '2026-12-21', [personSchluessel('olaf')]: '2026-12-21' } } } };
    const r = laeufeOhneKonto(d, 'pia');
    expect(r.n).toBe(1);
    expect(r.neu.prozesse['pz-a'].person?.t.tage).toEqual({ [personSchluessel('olaf')]: '2026-12-21' });
    expect(JSON.stringify(r.neu)).not.toContain('pia');
  });
});
