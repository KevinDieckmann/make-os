// Fälligkeit je Rhythmus — reine Datumsrechnung auf YYYY-MM-DD (Europe/Berlin
// oder jede andere Zone: kein UTC-Vortag, Monatsende geklemmt, Zeitumstellung egal).

import { describe, expect, it } from 'vitest';
import { monatePlus, naechstesMalNach, faelligkeit } from '@/lib/planung/rhythmus';
import { zeitraum, kalenderwoche, montagVon } from '@/lib/planung/zeitraum';

describe('Monate dazurechnen', () => {
  it('klemmt auf das Monatsende', () => {
    expect(monatePlus('2026-01-31', 1)).toBe('2026-02-28');
    expect(monatePlus('2028-01-31', 1)).toBe('2028-02-29');
    expect(monatePlus('2026-08-31', 1)).toBe('2026-09-30');
  });
  it('über den Jahreswechsel und ein ganzes Jahr', () => {
    expect(monatePlus('2026-11-15', 3)).toBe('2027-02-15');
    expect(monatePlus('2026-12-31', 1)).toBe('2027-01-31');
    expect(monatePlus('2026-07-31', 12)).toBe('2027-07-31');
    expect(monatePlus('2028-02-29', 12)).toBe('2029-02-28');
  });
});

describe('Nächstes Mal nach Erledigung', () => {
  it('je Rhythmus', () => {
    expect(naechstesMalNach('taeglich', '2026-10-24')).toBe('2026-10-25'); // Nacht der Zeitumstellung
    expect(naechstesMalNach('woechentlich', '2026-09-28')).toBe('2026-10-05');
    expect(naechstesMalNach('monatlich', '2026-09-30')).toBe('2026-10-30');
    expect(naechstesMalNach('quartal', '2026-09-27')).toBe('2026-12-27');
    expect(naechstesMalNach('halbjahr', '2026-09-27')).toBe('2027-03-27');
    expect(naechstesMalNach('jaehrlich', '2026-05-31')).toBe('2027-05-31');
    expect(naechstesMalNach('3x-woche', '2026-09-27')).toBeNull();
  });
});

describe('Fälligkeit', () => {
  const heute = '2026-09-30'; // Mittwoch, KW 40

  it('täglich: dran, bis heute abgehakt', () => {
    expect(faelligkeit({}, [], heute)).toMatchObject({ faellig: true, naechstes: heute });
    expect(faelligkeit({ rhythmus: 'taeglich' }, ['2026-09-29'], heute).faellig).toBe(true);
    expect(faelligkeit({ rhythmus: 'taeglich' }, [heute], heute)).toMatchObject({ faellig: false, naechstes: '2026-10-01' });
  });

  it('3×/Woche: zählt Montag bis Sonntag', () => {
    expect(faelligkeit({ rhythmus: '3x-woche' }, ['2026-09-28', '2026-09-29'], heute)).toMatchObject({ faellig: true, dieseWoche: 2 });
    // Sonntag und Samstag der Vorwoche zählen nicht mit
    expect(faelligkeit({ rhythmus: '3x-woche' }, ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-26'], heute)).toMatchObject({ faellig: true, dieseWoche: 2 });
    // dreimal diese Woche → erst nächsten Montag wieder
    expect(faelligkeit({ rhythmus: '3x-woche' }, ['2026-09-28', '2026-09-29', '2026-09-30'], heute)).toMatchObject({ faellig: false, naechstes: '2026-10-05', dieseWoche: 3 });
    // Vorwoche zählt nicht
    expect(faelligkeit({ rhythmus: '3x-woche' }, ['2026-09-24', '2026-09-25', '2026-09-26'], heute)).toMatchObject({ faellig: true, dieseWoche: 0 });
  });

  it('wöchentlich: ab der letzten Erledigung + 7 Tage', () => {
    expect(faelligkeit({ rhythmus: 'woechentlich' }, [], heute)).toMatchObject({ faellig: true, naechstes: heute, ueberfaellig: false });
    expect(faelligkeit({ rhythmus: 'woechentlich' }, ['2026-09-25'], heute)).toMatchObject({ faellig: false, naechstes: '2026-10-02' });
    expect(faelligkeit({ rhythmus: 'woechentlich' }, ['2026-09-20'], heute)).toMatchObject({ faellig: true, naechstes: '2026-09-27', ueberfaellig: true });
  });

  it('„nächstes Mal am“ gewinnt vor der letzten Erledigung, bis danach erledigt wurde', () => {
    // Steuererklärung: Anker 2026-10-15 gesetzt, zuletzt im Vorjahr gemacht → erst am 15.10. dran
    expect(faelligkeit({ rhythmus: 'jaehrlich', naechstesMal: '2026-10-15' }, ['2025-10-01'], heute)).toMatchObject({ faellig: false, naechstes: '2026-10-15' });
    expect(faelligkeit({ rhythmus: 'jaehrlich', naechstesMal: '2026-10-15' }, ['2025-10-01'], '2026-10-15').faellig).toBe(true);
    expect(faelligkeit({ rhythmus: 'jaehrlich', naechstesMal: '2026-10-15' }, ['2025-10-01'], '2026-10-20')).toMatchObject({ faellig: true, ueberfaellig: true });
    // nach dem Anker erledigt → nächster Termin ein Jahr nach der Erledigung
    expect(faelligkeit({ rhythmus: 'jaehrlich', naechstesMal: '2026-10-15' }, ['2025-10-01', '2026-10-16'], '2026-10-20')).toMatchObject({ faellig: false, naechstes: '2027-10-16' });
  });

  it('monatlich am Monatsende: 31.08. erledigt → 30.09. dran', () => {
    expect(faelligkeit({ rhythmus: 'monatlich' }, ['2026-08-31'], '2026-09-29').faellig).toBe(false);
    expect(faelligkeit({ rhythmus: 'monatlich' }, ['2026-08-31'], '2026-09-30')).toMatchObject({ faellig: true, naechstes: '2026-09-30' });
  });
});

describe('Zeitraum je Horizont', () => {
  it('Tag, Woche (Mo–So), Monat, Quartal, Jahr', () => {
    expect(zeitraum('tag', '2026-09-30')).toMatchObject({ von: '2026-09-30', bis: '2026-09-30' });
    expect(zeitraum('woche', '2026-09-30')).toMatchObject({ von: '2026-09-28', bis: '2026-10-04' });
    expect(zeitraum('woche', '2026-09-30').label).toMatch(/^KW 40/);
    expect(zeitraum('monat', '2026-09-30')).toMatchObject({ von: '2026-09-01', bis: '2026-09-30', label: 'September 2026' });
    expect(zeitraum('quartal', '2026-09-30')).toMatchObject({ von: '2026-07-01', bis: '2026-09-30', label: 'Q3 2026' });
    expect(zeitraum('quartal', '2026-11-05')).toMatchObject({ von: '2026-10-01', bis: '2026-12-31', label: 'Q4 2026' });
    expect(zeitraum('jahr', '2026-09-30')).toMatchObject({ von: '2026-01-01', bis: '2026-12-31', label: '2026' });
  });
  it('Woche über den Jahreswechsel und Kalenderwoche', () => {
    expect(montagVon('2027-01-01')).toBe('2026-12-28');
    expect(kalenderwoche('2027-01-01')).toBe(53);
    expect(kalenderwoche('2026-01-01')).toBe(1);
  });
});
