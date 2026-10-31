// Steckbrief-Ansprechpartner (31.10., ICP-Profile): Art. 15 listet, Art. 17 entfernt nur den vollen Namen — erfundene Beispieldaten.
import { describe, it, expect } from 'vitest';
import { ansprechpartnerBei, ansprechpartnerTilgen } from '@/lib/crm/person-bestaende';
import type { Firma } from '@/lib/crm/typen';

const firma = (id: string, namen: string[]): Firma => ({ id, name: `Beispiel ${id} GmbH`, steckbrief: { gemessenAm: '2026-10-31', ansprechpartner: namen.map(n => ({ name: n, rolle: 'Vertrieb', quelle: 'https://example.invalid/team' })) } } as unknown as Firma);

describe('Ansprechpartner im Steckbrief — Auskunft und Löschung', () => {
  const firmen = [firma('a', ['Erika Muster', 'Max Probe']), firma('b', ['Max Probe']), firma('c', [])];
  it('Art. 15: findet nur Firmen mit dem vollen Namen; ohne Nachnamen nichts', () => {
    expect(ansprechpartnerBei(firmen, 'Erika Muster').map(f => f.id)).toEqual(['a']);
    expect(ansprechpartnerBei(firmen, 'Max Probe').map(f => f.id)).toEqual(['a', 'b']);
    expect(ansprechpartnerBei(firmen, 'Erika')).toEqual([]);
    expect(ansprechpartnerBei(firmen, null)).toEqual([]);
  });
  it('Art. 17: entfernt nur diesen Namen, lässt andere stehen, leere Liste fällt weg; idempotent', () => {
    const crm = { firmen };
    const nach = ansprechpartnerTilgen(crm, 'Max Probe');
    expect(nach.firmen.find(f => f.id === 'a')?.steckbrief?.ansprechpartner?.map(x => x.name)).toEqual(['Erika Muster']);
    expect(nach.firmen.find(f => f.id === 'b')?.steckbrief?.ansprechpartner).toBeUndefined();
    expect(ansprechpartnerTilgen(nach, 'Max Probe')).toBe(nach);
    expect(ansprechpartnerTilgen(crm, null)).toBe(crm);
  });
});
