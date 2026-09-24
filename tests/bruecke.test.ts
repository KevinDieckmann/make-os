// Die Brücke Privat → Business: vom privaten Sockel zum Mindestumsatz.
// Erfundener Test-Haushalt; jede fehlende Zutat verhindert eine Zahl.
import { describe, it, expect } from 'vitest';
import { bruecke } from '../lib/finanzen/haushalt/gesamt';
import { testHaushalt } from '../lib/finanzen/haushalt/testdaten';
import { luft } from '../lib/finanzen/haushalt/fixkosten';
import { katNamen } from '../lib/finanzen/haushalt/einordnung';

const HEUTE = '2026-09-24';
const h = testHaushalt(HEUTE);
const business = { umsatzProMonat: 3000, fixkostenMonatBrutto: 200, bisMonat: '2026-08', monate: 3 };

describe('Mindestumsatz', () => {
  it('rechnet Sockel − planbares Einkommen → Entnahme → Gewinn → Umsatz', () => {
    const b = bruecke(h, business, 30, HEUTE);
    const sockel = luft(h.buchungen, h.schulden, katNamen(h.stamm), HEUTE).sockel.gesamt;
    expect(b.sockel).toBe(sockel);
    expect(b.planbarOhneEntnahme).toBe(280000); // Beispiel-Gehalt, ohne Entnahme
    expect(b.entnahmeIst).toBe(150000);
    expect(b.noetigeEntnahme).toBe(Math.max(0, sockel - 280000));
    expect(b.noetigerGewinn).toBeCloseTo(b.noetigeEntnahme / 0.7, 6);
    expect(b.mindestUmsatz).toBeCloseTo(b.noetigerGewinn! + 20000, 6);
    expect(b.umsatzIst).toBe(300000);
    expect(b.fehlt).toEqual([]);
  });
  it('ohne Annahme zur Steuerrücklage oder ohne Business-Zahlen: keine erfundene Zahl', () => {
    expect(bruecke(h, business, null, HEUTE)).toMatchObject({ noetigerGewinn: null, mindestUmsatz: null, fehlt: ['Annahme zur Steuerrücklage'] });
    expect(bruecke(h, null, 30, HEUTE)).toMatchObject({ mindestUmsatz: null, umsatzIst: null, fehlt: ['Business-Zahlen (Grundlage)'] });
  });
});
