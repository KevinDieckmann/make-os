// ─── Sport · Erholung: Ampel „heute trainieren?“ ────────────────────────────
import { describe, it, expect } from 'vitest';
import { ampel, erholungsPunkte, bezugAus } from '../lib/sport/ampel';

describe('Erholungspunkte', () => {
  it('ohne Werte null, mit Werten das Mittel der gemessenen Merkmale', () => {
    expect(erholungsPunkte(undefined).punkte).toBeNull();
    expect(erholungsPunkte({ schlafH: 8 }).punkte).toBe(100);
    expect(erholungsPunkte({ schlafH: 8, gefuehl: 3 }).punkte).toBe(Math.round((100 + 65) / 2));
    expect(erholungsPunkte({ muskelkater: 5 }).punkte).toBe(10);
  });
  it('HRV und Ruhepuls zählen nur gegen einen Bezug', () => {
    expect(erholungsPunkte({ hrv: 50 }).punkte).toBeNull();
    expect(erholungsPunkte({ hrv: 50 }, { hrv7: 50 }).punkte).toBe(100);
    expect(erholungsPunkte({ ruhepuls: 60 }, { ruhepuls7: 52 }).punkte).toBe(15);
  });
  it('Recovery aus den Vitalwerten zählt als eigenes Merkmal', () => {
    expect(erholungsPunkte(undefined, {}, 80).punkte).toBe(80);
    expect(erholungsPunkte({ gefuehl: 5 }, {}, 60).punkte).toBe(80);
  });
  it('Bezug: Mittel der letzten 7 Tage vor heute, ab drei Werten', () => {
    const log = { '2026-09-20': { hrv: 40 }, '2026-09-21': { hrv: 50 }, '2026-09-22': { hrv: 60, ruhepuls: 55 }, '2026-09-27': { hrv: 999 } };
    expect(bezugAus(log, '2026-09-27')).toEqual({ hrv7: 50, ruhepuls7: undefined });
  });
});

describe('Ampel', () => {
  it('unbekannt ohne Werte, mit passendem Satz', () => {
    const a = ampel(undefined, 'lauf');
    expect(a.stufe).toBe('unbekannt'); expect(a.text).toMatch(/Schlaf und Gefühl/);
  });
  it('grün bei guter Erholung, gelb dazwischen, rot bei wenig', () => {
    expect(ampel({ schlafH: 8, gefuehl: 5 }, 'hyrox').stufe).toBe('gruen');
    expect(ampel({ schlafH: 6.8, gefuehl: 3, muskelkater: 3 }, 'hyrox')).toMatchObject({ stufe: 'gelb' });
    expect(ampel({ schlafH: 6.8, gefuehl: 3, muskelkater: 3 }, 'lauf').text).toMatch(/locker/);
    expect(ampel({ schlafH: 5, gefuehl: 2, muskelkater: 4 }, 'gym')).toMatchObject({ stufe: 'rot' });
  });
  it('am Ruhetag bleibt es grün — auch bei wenig Erholung', () => {
    const a = ampel({ schlafH: 5, gefuehl: 1 }, 'ruhe');
    expect(a.stufe).toBe('gruen'); expect(a.text).toMatch(/brauchst/);
  });
});
