// Szenarien der Liquidität: unsichere Einnahmen UND die Ausgaben, die an ihnen
// hängen (USt-Zahllast aus geplantem Umsatz), fallen im schlechten Fall weg.
import { describe, it, expect } from 'vitest';
import { vorschau, type Planposten } from '../lib/make-one/liquiditaet';

const firmen = [{ id: 'kdv', name: 'KD Ventures', kontostand: 10000, stand: '2026-09-24' }];
const posten: Planposten[] = [
  { id: 'ein', titel: 'Retainer (zu klären)', betrag: 3570, rhythmus: 'einmalig', ab: '2026-10-15', sicher: false, wahrscheinlich: 50, firmaId: 'kdv' },
  { id: 'ust', titel: 'USt-Zahllast', betrag: -570, rhythmus: 'einmalig', ab: '2026-11-10', sicher: false, wahrscheinlich: 50, firmaId: 'kdv' },
  { id: 'miete', titel: 'Büro', betrag: -380, rhythmus: 'einmalig', ab: '2026-10-01', sicher: true, firmaId: 'kdv' },
];
const ende = (sz: 'schlecht' | 'real' | 'gut') => vorschau(firmen, [], [], [], '2026-09-24', 12, false, posten, sz, undefined, true).wochen.at(-1)!.stand;

describe('Szenarien', () => {
  it('gut: Einnahme und ihre Steuer zählen', () => expect(ende('gut')).toBe(10000 + 3570 - 570 - 380));
  it('realistisch/schlecht: beide fallen weg, sichere Kosten bleiben', () => {
    expect(ende('real')).toBe(10000 - 380);
    expect(ende('schlecht')).toBe(10000 - 380);
  });
  it('eine unsichere Ausgabe ohne Wahrscheinlichkeit zählt wie bisher immer', () => {
    const v = vorschau(firmen, [], [], [], '2026-09-24', 12, false, [{ id: 'x', titel: 'Kosten', betrag: -100, rhythmus: 'einmalig', ab: '2026-10-01', sicher: false, firmaId: 'kdv' }], 'schlecht', undefined, true);
    expect(v.wochen.at(-1)!.stand).toBe(9900);
  });
});
