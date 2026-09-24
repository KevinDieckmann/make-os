// Eine Zahl, eine Quelle: Kasse aus den Firmenkonten, Rest-Monate ab heute.
import { describe, it, expect } from 'vitest';
import { computeMetrics, geschaeftsKasse, mitKasse, DEFAULT_FINANCE, type FinanceState } from '../lib/make-one/finance-data';

const fin = (over: Partial<FinanceState> = {}): FinanceState => ({
  ...DEFAULT_FINANCE, jahr: 2026, startMonat: 5, cash: 1000,
  months: DEFAULT_FINANCE.months.map((m, i) => (i === 5 || i === 6 ? { ...m, umsatz: 10000, kosten: 4000 } : { ...m })),
  ...over,
});

describe('Business-Kasse', () => {
  it('Firmenkonten schlagen das alte Cash-Feld, privat zählt nie', () => {
    const k = geschaeftsKasse([
      { id: 'kdv', kontostand: 5000, stand: '2026-09-20' },
      { id: 'kdc', kontostand: 3000, stand: '2026-09-10' },
      { id: 'privat', kontostand: 99999, stand: '2026-09-24' },
    ], 1000);
    expect(k).toEqual({ betrag: 8000, quelle: 'konten', konten: 2, stand: '2026-09-10' });
  });
  it('ohne Kontostände gilt das manuelle Feld — und es ist als manuell markiert', () => {
    expect(geschaeftsKasse([{ id: 'kdv', kontostand: null }], 1000).quelle).toBe('manuell');
    expect(geschaeftsKasse([], 0).quelle).toBe('keine');
  });
  it('Runway rechnet mit der Kasse aus den Konten', () => {
    const m = computeMetrics(mitKasse(fin(), [{ id: 'kdv', kontostand: 8000 }]), new Date('2026-09-24T10:00:00Z'));
    expect(m.runwayMonate).toBe(2); // 8.000 / Ø 4.000 Kosten
  });
});

describe('Rest-Monate', () => {
  it('zählen ab heute: im September mit Stand Juli bleiben Sep–Dez', () => {
    expect(computeMetrics(fin(), new Date('2026-09-24T10:00:00Z')).restMonate).toBe(4);
  });
  it('ist der laufende Monat gepflegt, zählt er nicht mehr mit', () => {
    const f = fin(); f.months[8] = { ...f.months[8], umsatz: 5000, kosten: 1000 };
    expect(computeMetrics(f, new Date('2026-09-24T10:00:00Z')).restMonate).toBe(3);
  });
  it('am Monatsersten nachts deutscher Zeit gilt schon der neue Monat', () => {
    // 30.09. 22:30 UTC = 01.10. 00:30 in Berlin → Okt–Dez
    expect(computeMetrics(fin(), new Date('2026-09-30T22:30:00Z')).restMonate).toBe(3);
  });
  it('Ist zählt erst ab dem Startmonat', () => {
    const f = fin(); f.months[0] = { ...f.months[0], umsatz: 50000, kosten: 0 };
    expect(computeMetrics(f, new Date('2026-09-24T10:00:00Z')).istUmsatz).toBe(20000);
  });
});
