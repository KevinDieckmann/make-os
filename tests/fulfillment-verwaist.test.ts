// Gesamtprüfung 17.10. (L2 B5): verwaiste Fälle werden nie auf einen Schlag gelöscht — erst markiert, nach 30 Tagen entfernt, Bremse ohne
// Mandate bzw. bei zu vielen auf einmal; ein zurückgekehrtes Mandat löst die Marke. Erfundene Kennungen.
import { describe, it, expect } from 'vitest';
import { verwaisteFaelleOrdnen, MARKE_VERWAIST, VERWAIST_TAGE } from '@/lib/fulfillment/prozesse/verwaist';
import type { Fall } from '@/lib/fulfillment/typen';
import { tagPlus } from '@/lib/kalender/zeit';

const fall = (id: string, marken: Record<string, string> = {}) => ({ mandatId: id, marken, stakeholder: [] }) as unknown as Fall;
const heute = '2026-10-17';

describe('verwaiste Fälle', () => {
  it('ohne ein einziges Mandat bleibt alles, wie es ist (Bremse)', () => {
    const r = verwaisteFaelleOrdnen({ a: fall('a'), b: fall('b') }, new Set(), heute);
    expect(r.gebremst).toBe('keine-mandate');
    expect(Object.keys(r.faelle)).toEqual(['a', 'b']);
    expect(r.faelle.a.marken[MARKE_VERWAIST]).toBeUndefined();
  });

  it('beim ersten Mal nur markiert, nichts entfernt', () => {
    const r = verwaisteFaelleOrdnen({ a: fall('a'), b: fall('b') }, new Set(['a']), heute);
    expect(r).toMatchObject({ markiert: 1, weg: 0, gebremst: null });
    expect(r.faelle.b.marken[MARKE_VERWAIST]).toBe(heute);
    expect(r.faelle.a.marken[MARKE_VERWAIST]).toBeUndefined();
  });

  it(`erst nach ${VERWAIST_TAGE} Tagen entfernt`, () => {
    const knapp = verwaisteFaelleOrdnen({ a: fall('a'), b: fall('b', { [MARKE_VERWAIST]: tagPlus(heute, -(VERWAIST_TAGE - 1)) }) }, new Set(['a']), heute);
    expect(knapp.weg).toBe(0);
    expect(knapp.faelle.b).toBeDefined();
    const faellig = verwaisteFaelleOrdnen({ a: fall('a'), b: fall('b', { [MARKE_VERWAIST]: tagPlus(heute, -VERWAIST_TAGE) }) }, new Set(['a']), heute);
    expect(faellig.weg).toBe(1);
    expect(faellig.faelle.b).toBeUndefined();
  });

  it('kommt das Mandat zurück, verschwindet die Marke — andere Marken bleiben', () => {
    const r = verwaisteFaelleOrdnen({ a: fall('a', { [MARKE_VERWAIST]: '2026-09-01', andere: 'x' }) }, new Set(['a']), heute);
    expect(r.zurueck).toBe(1);
    expect(r.faelle.a.marken).toEqual({ andere: 'x' });
  });

  it('bremst, wenn mehr als die Hälfte und mehr als drei Fälle auf einmal fällig wären', () => {
    const alt = { [MARKE_VERWAIST]: '2026-08-01' };
    const faelle = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(id => [id, fall(id, alt)]));
    const r = verwaisteFaelleOrdnen({ ...faelle, x: fall('x') }, new Set(['x']), heute);
    expect(r.gebremst).toBe('zu-viele');
    expect(Object.keys(r.faelle)).toHaveLength(6);
    // wenige auf einmal dürfen weg
    const wenige = verwaisteFaelleOrdnen({ a: fall('a', alt), x: fall('x'), y: fall('y'), z: fall('z') }, new Set(['x', 'y', 'z']), heute);
    expect(wenige).toMatchObject({ weg: 1, gebremst: null });
  });

  it('ändert keinen Fall mit Mandat', () => {
    const a = fall('a');
    expect(verwaisteFaelleOrdnen({ a }, new Set(['a']), heute).faelle.a).toBe(a);
  });
});
