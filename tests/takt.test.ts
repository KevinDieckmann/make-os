// ─── Der Takt liest den letzten Lauf ────────────────────────────────────────
// Am 07.09. hat der Takt den Tageslauf im Minutentakt neu gestartet, weil ich
// das erste Element der Liste für den letzten Lauf hielt. Die Route liefert
// neueste zuerst — der SPEICHER hängt sie hinten an. Eine angenommene
// Reihenfolge ist keine Reihenfolge.

import { describe, it, expect } from 'vitest';
import { neuester } from '../lib/jarvis/takt';

const l = (t: string) => ({ gestartet: t });

describe('Takt: letzter Lauf', () => {
  it('findet den neuesten, wenn er hinten steht (so liegt es im Speicher)', () => {
    expect(neuester([l('2026-09-07T07:00:00Z'), l('2026-09-07T09:00:00Z')])?.gestartet)
      .toBe('2026-09-07T09:00:00Z');
  });

  it('findet den neuesten, wenn er vorn steht (so liefert es die Route)', () => {
    expect(neuester([l('2026-09-07T09:00:00Z'), l('2026-09-07T07:00:00Z')])?.gestartet)
      .toBe('2026-09-07T09:00:00Z');
  });

  it('findet ihn auch bei durcheinandergewürfelter Liste', () => {
    expect(neuester([l('2026-09-07T08:00:00Z'), l('2026-09-07T11:00:00Z'), l('2026-09-07T09:30:00Z')])?.gestartet)
      .toBe('2026-09-07T11:00:00Z');
  });

  it('gibt nichts zurück, wenn nichts da ist', () => {
    expect(neuester([])).toBeUndefined();
  });
});
