// Finanzen-Säule: Business und Privat je zur Hälfte, fehlende Hälfte zählt
// nicht als Null, veraltete Haushaltsdaten sind eine Lücke, kein Minus.
import { describe, it, expect } from 'vitest';
import { finanzSaeule, privatFaktoren } from '../lib/finanzen/haushalt/score';
import { testHaushalt } from '../lib/finanzen/haushalt/testdaten';

const f = (wert: number, echt = true) => ({ label: 'x', wert, echt, quelle: '' });

describe('Finanzen-Säule', () => {
  it('beide Hälften: Schnitt der Hälften, nicht der Faktoren', () => {
    const s = finanzSaeule([f(20), f(40)], [f(90), f(90), f(90)]);
    expect(s.teile).toEqual({ business: 30, privat: 90 });
    expect(s.score).toBe(60);
  });
  it('fehlt eine Hälfte, zählt nur die andere', () => {
    expect(finanzSaeule([f(40)], []).score).toBe(40);
    expect(finanzSaeule([f(0, false)], [f(80)]).score).toBe(80);
    expect(finanzSaeule([f(0, false)], [f(0, false)]).score).toBeNull();
  });
  it('private Faktoren aus einem (erfundenen) Haushalt — frisch gezählt, veraltet nicht', () => {
    const h = testHaushalt('2026-09-24');
    const frisch = privatFaktoren(h, '2026-09-24');
    expect(frisch.map(x => x.label)).toEqual(['Sparquote', 'Luft pro Monat', 'Schuldenabbau']);
    expect(frisch.every(x => x.echt)).toBe(true);
    const spaeter = privatFaktoren(h, '2027-03-01');
    expect(spaeter.some(x => x.echt)).toBe(false);
    expect(spaeter[0].quelle).toMatch(/Daten zu alt/);
  });
});
