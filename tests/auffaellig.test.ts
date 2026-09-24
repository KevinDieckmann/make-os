// Auffälligkeiten im (erfundenen) Haushalt: nachvollziehbare Regeln, keine Magie.
import { describe, it, expect } from 'vitest';
import { auffaelligkeiten } from '../lib/finanzen/chef/auffaellig';
import { testHaushalt } from '../lib/finanzen/haushalt/testdaten';
import type { Buchung } from '../lib/finanzen/haushalt/typen';

const HEUTE = '2026-09-24';
describe('Auffälligkeiten', () => {
  it('findet eine Doppelabbuchung und eine große Einzelausgabe', () => {
    const h = testHaushalt(HEUTE);
    const vorlage = h.buchungen.find(b => b.empfaenger === 'Supermarkt Beispiel')!;
    const kat = vorlage.kategorie_id;
    const extra: Buchung[] = [
      { ...vorlage, id: 'd1', datum: '2026-09-15', betrag: -8999, empfaenger: 'Elektronik Beispiel', beschreibung: 'Elektronik Beispiel' },
      { ...vorlage, id: 'd2', datum: '2026-09-16', betrag: -8999, empfaenger: 'Elektronik Beispiel', beschreibung: 'Elektronik Beispiel' },
      { ...vorlage, id: 'g1', datum: '2026-08-20', betrag: -145000, empfaenger: 'Möbelhaus Beispiel', beschreibung: 'Möbelhaus Beispiel', kategorie_id: kat },
    ];
    const a = auffaelligkeiten({ ...h, buchungen: [...h.buchungen, ...extra] }, HEUTE);
    expect(a.some(x => x.art === 'doppelt' && /Elektronik Beispiel/.test(x.text))).toBe(true);
    expect(a.some(x => x.art === 'einzelausgabe' && /Möbelhaus/.test(x.text))).toBe(true);
    expect(a.every(x => x.regel.length > 10)).toBe(true);
  });
  it('ohne Ausreißer bleibt es ruhig bei den Kategorien', () => {
    expect(auffaelligkeiten(testHaushalt(HEUTE), HEUTE).filter(x => x.art === 'kategorie' && x.schwere === 'hoch')).toEqual([]);
  });
});
