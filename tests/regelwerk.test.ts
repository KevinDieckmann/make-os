// Regelwerk-Rückfall für Morgen-/Abendlauf (lib/jarvis/regelwerk.ts)
import { describe, it, expect } from 'vitest';
import { regelBericht } from '@/lib/jarvis/regelwerk';

const leer = { heute: '2026-09-27', tasks: { alle: [], offen: [], overdue: [], dueToday: [], kritisch: [], projektName: () => '' }, kalender: { heute: [], woche: [], at: null, alterH: null, stale: false, quellen: { apple: { alterH: null, stale: true }, kemaris: { alterH: null, stale: true } } }, geld: { forderungen: 0, vorbereitung: 0, ueberfaelligeForderungen: 0 }, shields: [] } as unknown as Parameters<typeof regelBericht>[0];

describe('regelBericht', () => {
  it('sagt ehrlich, wenn nichts liegt', () => {
    expect(regelBericht(leer, 'morgen')).toContain('frei von meiner Seite');
    expect(regelBericht(leer, 'abend')).toContain('nichts blieb liegen');
  });
  it('zählt, was liegt — und schweigt über einen veralteten Kalender', () => {
    const L = leer as unknown as { tasks: Record<string, unknown>; kalender: Record<string, unknown>; geld: Record<string, unknown> };
    const b = { ...leer, tasks: { ...L.tasks, overdue: [{}, {}], dueToday: [{}] }, kalender: { ...L.kalender, heute: [{ date: '2026-09-27' }] }, geld: { ...L.geld, ueberfaelligeForderungen: 1 }, shields: [{}] } as unknown as Parameters<typeof regelBericht>[0];
    const s = regelBericht(b, 'morgen');
    expect(s).toContain('2 Aufgaben überfällig'); expect(s).toContain('1 heute fällig'); expect(s).toContain('1 Termin heute'); expect(s).toContain('1 überfällige Forderung'); expect(s).toContain('1 Frühwarnung aktiv');
    const K = b.kalender as unknown as Record<string, unknown>;
    const alt = regelBericht({ ...b, kalender: { ...K, stale: true } as unknown as typeof b.kalender }, 'morgen');
    expect(alt).not.toContain('Termin');
    expect(regelBericht({ ...b, kalender: { ...K, woche: [{ date: '2026-09-28' }] } as unknown as typeof b.kalender }, 'abend')).toContain('morgen steht ein Termin');
  });
});
