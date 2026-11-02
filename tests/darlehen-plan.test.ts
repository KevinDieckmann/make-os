// ─── Darlehen mit Raten und Zinsen (02.11., Kevin: „Ja, mit Raten und Zinsen“) ─────────────────────────────────────────────
// Rein: lib/finanzen/darlehen-plan.ts · Kern: lib/finanzen/rechenkern.ts (`darlehenFluesse`, Gewinn der Gesellschaften/Selbstständigkeit).
// Ohne Ratenplan bleibt der Kern bit-genau (Wächter zusätzlich: finanzplan-regression gegen das Gold aus dem alten Kern). Erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import { darlehenPlan, betragDeutsch, monateZwischen, monatPlus } from '../lib/finanzen/darlehen-plan';
import { darlehenFluesse, darlehenOffen, type Darlehen, type FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit } from '../lib/finanzen/szenarien';
import { pruefeEinDarlehen, darlehenMonatFehler, darlehenFuerBusiness } from '../lib/finanzen/darlehen';
import { businessSicht } from '../lib/finanzen/plan/sicht';
import { planFix } from './fixtures/finanz-plan';

const E = { betrag: 12000, zinsProzent: 6, wartezeit: 6, ratenAnzahl: 12, rate: 1000 } as const;

describe('darlehenPlan (rein)', () => {
  it('Beispiel: 12.000 € · 6 % · 6 Monate Wartezeit · 12 × 1.000 € → 360 + 330 = 690 € Zinsen', () => {
    const p = darlehenPlan({ ...E, zinsen: 'gestundet' });
    if ('fehler' in p) throw new Error(p.fehler);
    expect(p.zinsenGesamt).toBe(690);
    expect(p.tilgungGesamt).toBe(12000);
    expect(p.monate).toHaveLength(18);
    expect(p.monate.slice(0, 6).reduce((s, x) => s + x.zins, 0)).toBe(360);
    expect(p.monate.slice(6).reduce((s, x) => s + x.zins, 0)).toBe(330);
    expect(p.monate[6]).toMatchObject({ k: 6, rateNr: 1, tilgung: 1000, restschuld: 11000, zins: 55 });
    // gestundet: alle Zinsen mit der letzten Rate, sonst nur Tilgung
    expect(p.monate.slice(0, 17).every(x => x.zinsZahlung === 0)).toBe(true);
    expect(p.monate[17]).toMatchObject({ rateNr: 12, tilgung: 1000, zinsZahlung: 690, zahlung: 1690, restschuld: 0 });
  });
  it('laufend: jeden Monat Zins mit der Rate, auch in der Wartezeit', () => {
    const p = darlehenPlan({ ...E, zinsen: 'laufend' });
    if ('fehler' in p) throw new Error(p.fehler);
    expect(p.monate[0]).toMatchObject({ zins: 60, zinsZahlung: 60, zahlung: 60, tilgung: 0 });
    expect(p.monate[6]).toMatchObject({ zahlung: 1055 });
    expect(p.zahlungGesamt).toBe(12690);
  });
  it('letzte Rate nimmt den Rest; zinslos; Fehler als Satz', () => {
    const p = darlehenPlan({ betrag: 1000, zinsProzent: 0, wartezeit: 0, ratenAnzahl: 3, rate: 300, zinsen: 'gestundet' });
    if ('fehler' in p) throw new Error(p.fehler);
    expect(p.monate.map(x => x.tilgung)).toEqual([300, 300, 400]);
    expect(p.zinsenGesamt).toBe(0);
    expect(darlehenPlan({ ...E, zinsen: 'gestundet', zinsProzent: 99 })).toHaveProperty('fehler');
    expect(darlehenPlan({ ...E, zinsen: 'gestundet', wartezeit: -1 })).toHaveProperty('fehler');
  });
  it('Hilfen: deutsches Zahlenformat ohne €, Monate zwischen zwei Tagen', () => {
    expect(betragDeutsch(1234.5)).toBe('1.234,50');
    expect(betragDeutsch(690)).toBe('690,00');
    expect(monateZwischen('2026-11-15', '2027-05-01')).toBe(6);
    expect(monatPlus('2027-05-01', 11)).toBe('2028-04');
  });
});

const ohneAlt = (): FinanzDaten => ({ ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } });
const planDarlehen = (zinsen: 'gestundet' | 'laufend', geber: Darlehen['geber'] = 'extern', nehmer: Darlehen['nehmer'] = 'ug'): Darlehen =>
  ({ id: 'dp', name: 'Testdarlehen', geber, nehmer, betrag: 12000, aus: 1, zurueck: 0, zinsProzent: 6, ratenAb: 7, ratenAnzahl: 12, rate: 1000, zinsen });

describe('Rechenkern mit Ratenplan', () => {
  it('ohne Ratenplan: Zinsreihe überall 0, Rückzahlung im Monat `zurueck` wie bisher', () => {
    const d = { ...ohneAlt(), darlehen: [{ id: 'd1', name: 'x', geber: 'kdc' as const, nehmer: 'ug' as const, betrag: 5000, aus: 2, zurueck: 8 }] };
    const r = darlehenFluesse(d, 27);
    expect(r.ug.zins.every(z => z === 0) && r.kdc.zins.every(z => z === 0)).toBe(true);
    expect(r.ug.aus[7]).toBe(5000);
    const a = rechneMit(ohneAlt(), null), b = rechneMit(d, null);
    for (let i = 0; i < 27; i++) { expect(Object.is(b.ug[i].gewinn, a.ug[i].gewinn)).toBe(true); expect(Object.is(b.kdc[i].gewinn, a.kdc[i].gewinn)).toBe(true); }
  });
  it('Nehmer MAKE (gestundet): Raten + Zinsen als Kasse, Zins mindert den Gewinn (Steuerbasis) Monat für Monat', () => {
    const d = { ...ohneAlt(), darlehen: [planDarlehen('gestundet')] };
    const r = darlehenFluesse(d, 27);
    expect(r.ug.ein[0]).toBe(12000);
    expect(r.ug.aus.reduce((s, x) => s + x, 0)).toBe(12690);
    expect(r.ug.aus[17]).toBe(1690);
    expect(r.ug.zins.reduce((s, x) => s + x, 0)).toBeCloseTo(-690, 9);
    const a = rechneMit(ohneAlt(), null), b = rechneMit(d, null);
    let summe = 0;
    for (let i = 0; i < 27; i++) { const dg = b.ug[i].gewinn - a.ug[i].gewinn; expect(dg).toBeCloseTo(r.ug.zins[i], 9); summe += dg; }
    expect(summe).toBeCloseTo(-690, 6);
    expect(b.ug.reduce((s, x) => s + x.st.summe, 0)).toBeLessThanOrEqual(a.ug.reduce((s, x) => s + x.st.summe, 0));
  });
  it('Geber KD Ventures, Nehmer MAKE (laufend): Ertrag beim Geber, Aufwand beim Nehmer, Kasse gegenläufig', () => {
    const d = { ...ohneAlt(), darlehen: [planDarlehen('laufend', 'kdv', 'ug')] };
    const r = darlehenFluesse(d, 27);
    expect(r.kdv.aus[0]).toBe(12000);
    expect(r.ug.aus[0]).toBe(60);
    expect(r.kdv.ein.reduce((s, x) => s + x, 0)).toBe(12690);
    expect(r.kdv.zins.reduce((s, x) => s + x, 0)).toBeCloseTo(690, 9);
    const a = rechneMit(ohneAlt(), null), b = rechneMit(d, null);
    expect(b.ug.reduce((s, x) => s + x.kdvGewinn, 0) - a.ug.reduce((s, x) => s + x.kdvGewinn, 0)).toBeCloseTo(690, 6);
  });
  it('Privat als Geber: nur Kasse, keine Steuer — der Zins wirkt nur beim Nehmer', () => {
    const d = { ...ohneAlt(), darlehen: [planDarlehen('gestundet', 'privat', 'ug')] };
    const r = darlehenFluesse(d, 27);
    expect(r.privat.ein.reduce((s, x) => s + x, 0)).toBe(12690);
    expect(r.privat.zins.reduce((s, x) => s + x, 0)).toBeCloseTo(690, 9);   // nur gemerkt, rechnePrivat liest ihn nicht
  });
  it('Restschuld (darlehenOffen) folgt dem Plan', () => {
    const l = planDarlehen('gestundet');
    expect(darlehenOffen(l, 1)).toBe(12000);
    expect(darlehenOffen(l, 7)).toBe(11000);
    expect(darlehenOffen(l, 18)).toBe(0);
  });
});

describe('Schreibweg: Säubern, Monate im Plan, Business-Sicht', () => {
  it('Felder bleiben erhalten, Altform ohne Felder unverändert', () => {
    expect(pruefeEinDarlehen({ id: 'a', name: 'x', geber: 'kdv', nehmer: 'ug', betrag: 10, aus: 1, zurueck: 0 })).toEqual({ id: 'a', name: 'x', geber: 'kdv', nehmer: 'ug', betrag: 10, aus: 1, zurueck: 0 });
    expect(pruefeEinDarlehen({ ...planDarlehen('laufend'), vertragId: 'vtr-abcd-1234' })).toMatchObject({ zinsProzent: 6, ratenAb: 7, ratenAnzahl: 12, rate: 1000, zinsen: 'laufend', vertragId: 'vtr-abcd-1234' });
  });
  it('erste/letzte Rate außerhalb des Plans oder unvollständig → Meldung (Route 400)', () => {
    expect(darlehenMonatFehler(planDarlehen('gestundet'), 27)).toBeNull();
    expect(darlehenMonatFehler({ ...planDarlehen('gestundet'), ratenAnzahl: 30 }, 27)).toMatch(/nach dem Planende/);
    expect(darlehenMonatFehler({ ...planDarlehen('gestundet'), rate: undefined }, 27)).toMatch(/Beginn, Anzahl und Rate/);
    expect(darlehenMonatFehler({ ...planDarlehen('gestundet'), aus: 9 }, 27)).toMatch(/vor der Auszahlung/);
  });
  it('Sicht Business bekommt nichts aus Privat: private Seite „außerhalb des Plans“, Name neutral', () => {
    const l = { ...planDarlehen('gestundet', 'privat', 'ug'), name: 'Geheimer Name', notiz: 'geheim' };
    const b = darlehenFuerBusiness(l)!;
    expect(b.geber).toBe('extern'); expect(b.name).toBe('Darlehen (privat)'); expect(b.notiz).toBeUndefined();
    const s = JSON.stringify(businessSicht({ ...ohneAlt(), darlehen: [l] }));
    expect(s).not.toContain('Geheimer Name'); expect(s).not.toContain('geheim');
    // Die Business-Sicht rechnet die Seite „außerhalb“: keine private Kasse in der Rechnung
    const r = darlehenFluesse({ ...ohneAlt(), darlehen: [b] }, 27);
    expect(r.privat.ein.every(x => x === 0)).toBe(true);
    expect(r.ug.aus.reduce((s2, x) => s2 + x, 0)).toBe(12690);
  });
});
