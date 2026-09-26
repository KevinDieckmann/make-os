// Space-Regeln (26.09.): Ort gibt vor, Aufgabe kann abweichen.
import { describe, it, expect } from 'vitest';
import { spaceVonAufgabe, spaceVonOrg } from '../lib/make-one/space-regeln';

describe('Space-Regeln', () => {
  it('Ort → Space, Abweichung gewinnt', () => {
    expect(spaceVonOrg('privat')).toBe('privat');
    expect(spaceVonOrg('kdv')).toBe('business');
    expect(spaceVonAufgabe({ id: 't1', title: 'Wohnung kündigen', projectId: 'x' })).toBe('privat');
    expect(spaceVonAufgabe({ id: 't2', title: 'KEMARIS Angebot', projectId: 'x' })).toBe('business');
    expect(spaceVonAufgabe({ id: 't3', title: 'Irgendwas', projectId: 'proj-health' })).toBe('privat');
    expect(spaceVonAufgabe({ id: 't4', title: 'Irgendwas', projectId: 'unbekannt' })).toBe('business');
    expect(spaceVonAufgabe({ id: 't5', title: 'KEMARIS Angebot', projectId: 'x', space: 'privat' })).toBe('privat');
    expect(spaceVonAufgabe({ id: 't6', title: 'Irgendwas', projectId: 'x' }, { t6: 'privat' })).toBe('privat');
  });
});
