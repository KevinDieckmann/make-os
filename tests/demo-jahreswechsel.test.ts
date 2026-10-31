// Demo-Saat über den Jahreswechsel (31.10., Zeitreise-Prüfung): die Altbestands-Rechnung des Kreislaufs bekam in den ersten Januartagen ein
// „Bezahlt am“ in der Zukunft — die Finanzplan-Route lehnte ab (400) und die ganze Saat (Demo, Zurücksetzen, alle Demo-Tests) brach ab.
import { describe, expect, it } from 'vitest';
import { altbestandTage } from '@/lib/demo/saat-kreislauf';

describe('altbestandTage — Altbestand der Demo, nie bezahlt in der Zukunft', () => {
  it('mitten im Jahr: vor 120 Tagen, bezahlt zehn Tage später (wie bisher)', () => {
    expect(altbestandTage('2026-10-31')).toEqual({ altTag: '2026-07-03', altBezahlt: '2026-07-13' });
  });
  it('Jahresanfang: nicht vor dem 1.1., bezahlt höchstens heute', () => {
    expect(altbestandTage('2027-01-01')).toEqual({ altTag: '2027-01-01', altBezahlt: '2027-01-01' });
    expect(altbestandTage('2027-01-04')).toEqual({ altTag: '2027-01-01', altBezahlt: '2027-01-04' });
    expect(altbestandTage('2027-01-11')).toEqual({ altTag: '2027-01-01', altBezahlt: '2027-01-11' });
    expect(altbestandTage('2027-02-20')).toEqual({ altTag: '2027-01-01', altBezahlt: '2027-01-11' });
  });
  it('jeden Tag eines Jahres: Rechnungstag ≤ Zahlungstag ≤ heute, beides im laufenden Jahr', () => {
    for (let d = new Date('2027-01-01T12:00:00Z'); d.getUTCFullYear() === 2027; d.setUTCDate(d.getUTCDate() + 1)) {
      const heute = d.toISOString().slice(0, 10);
      const { altTag, altBezahlt } = altbestandTage(heute);
      expect(altTag <= altBezahlt && altBezahlt <= heute, heute).toBe(true);
      expect(altTag.slice(0, 4), heute).toBe('2027');
    }
  });
});
