// ─── Der Takt liest den letzten Lauf ────────────────────────────────────────
// Am 07.09. hat der Takt den Tageslauf im Minutentakt neu gestartet, weil ich
// das erste Element der Liste für den letzten Lauf hielt. Die Route liefert
// neueste zuerst — der SPEICHER hängt sie hinten an. Eine angenommene
// Reihenfolge ist keine Reihenfolge.

import { describe, it, expect } from 'vitest';
import { neuester, wartenNachFehler } from '../lib/jarvis/takt';

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

describe('Takt: Pause nach Fehlschlägen (25.09.)', () => {
  const f = (beendet: string, name = 'morgen', status = 'fehler') => ({ name, tag: '2026-09-25', status, zeit: beendet, beendet });
  const um = (hm: string) => new Date(`2026-09-25T${hm}:00Z`);
  it('ohne Fehlschlag sofort frei', () => {
    expect(wartenNachFehler([f('2026-09-25T08:00:00Z', 'morgen', 'fertig')], 'morgen', '2026-09-25', um('08:01'))).toBe(0);
  });
  it('wartet 5, 15, 45 … Minuten — höchstens drei Stunden', () => {
    expect(wartenNachFehler([f('2026-09-25T08:00:00Z')], 'morgen', '2026-09-25', um('08:02'))).toBe(3);
    expect(wartenNachFehler([f('2026-09-25T08:00:00Z')], 'morgen', '2026-09-25', um('08:05'))).toBe(0);
    expect(wartenNachFehler([f('2026-09-25T08:00:00Z'), f('2026-09-25T08:05:00Z')], 'morgen', '2026-09-25', um('08:10'))).toBe(10);
    const viele = Array.from({ length: 12 }, (_, i) => f(`2026-09-25T08:${String(i).padStart(2, '0')}:00Z`));
    expect(wartenNachFehler(viele, 'morgen', '2026-09-25', um('09:11'))).toBe(120);
  });
  it('zählt nur denselben Auftrag am selben Tag', () => {
    expect(wartenNachFehler([f('2026-09-25T08:00:00Z', 'abend')], 'morgen', '2026-09-25', um('08:01'))).toBe(0);
    expect(wartenNachFehler([{ ...f('2026-09-24T21:59:00Z'), tag: '2026-09-24' }], 'morgen', '2026-09-25', um('07:00'))).toBe(0);
  });
});
