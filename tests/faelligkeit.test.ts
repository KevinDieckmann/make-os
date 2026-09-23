// ─── Fälligkeiten rechnen ───────────────────────────────────────────────────
// Kevins Wunsch vom Board: „Ich möchte einmal draufklicken können und dann das
// Datum verschieben." Dahinter steckt Datumsarithmetik, und die geht genau an
// vier Stellen schief: Monatsende, Jahreswechsel, Schaltjahr und Zeitumstellung.
//
// Der Trick im Code ist die Uhrzeit 12:00 — damit kann die Zeitumstellung
// (eine Stunde vor oder zurück) den Tag nicht kippen. Ohne sie landete ein
// „+1 Tag" über die Oktobernacht auf demselben Datum.

import { describe, it, expect } from 'vitest';
import { tageDazu, tageBis } from '../lib/make-one/faelligkeit';

describe('Tage dazurechnen', () => {
  it('über das Monatsende', () => {
    expect(tageDazu('2026-08-31', 1)).toBe('2026-09-01');
    expect(tageDazu('2026-09-30', 1)).toBe('2026-10-01');
    expect(tageDazu('2026-09-28', 7)).toBe('2026-10-05');
  });

  it('über den Jahreswechsel', () => {
    expect(tageDazu('2026-12-31', 1)).toBe('2027-01-01');
    expect(tageDazu('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('über den 29. Februar im Schaltjahr', () => {
    expect(tageDazu('2028-02-28', 1)).toBe('2028-02-29');
    expect(tageDazu('2028-02-29', 1)).toBe('2028-03-01');
    // 2026 ist keins — da folgt auf den 28. direkt der März.
    expect(tageDazu('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('über die Zeitumstellung — hier kippt naive Rechnung', () => {
    // Nacht auf Sonntag, 25.10.2026: die Uhr geht eine Stunde zurück.
    expect(tageDazu('2026-10-24', 1)).toBe('2026-10-25');
    expect(tageDazu('2026-10-25', 1)).toBe('2026-10-26');
    // Und im Frühjahr die andere Richtung (29.03.2026).
    expect(tageDazu('2026-03-28', 1)).toBe('2026-03-29');
    expect(tageDazu('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('auch rückwärts', () => {
    expect(tageDazu('2026-09-01', -1)).toBe('2026-08-31');
    expect(tageDazu('2027-01-01', -1)).toBe('2026-12-31');
    expect(tageDazu('2026-09-07', 0)).toBe('2026-09-07');
  });
});

describe('Tage bis', () => {
  it('zählt vorwärts, rückwärts und heute', () => {
    expect(tageBis('2026-09-07', '2026-09-07')).toBe(0);
    expect(tageBis('2026-09-08', '2026-09-07')).toBe(1);
    expect(tageBis('2026-09-06', '2026-09-07')).toBe(-1);
  });

  it('zählt über Monats- und Jahresgrenze richtig', () => {
    expect(tageBis('2026-10-01', '2026-09-30')).toBe(1);
    expect(tageBis('2027-01-01', '2026-12-31')).toBe(1);
    expect(tageBis('2026-09-30', '2026-09-01')).toBe(29);
  });

  it('bleibt über die Zeitumstellung ganzzahlig', () => {
    // Ohne die 12-Uhr-Verankerung käme hier 0,958… heraus und würde gerundet
    // — mit genug Abstand irgendwann falsch.
    expect(tageBis('2026-10-26', '2026-10-24')).toBe(2);
    expect(tageBis('2026-03-30', '2026-03-28')).toBe(2);
  });
});
