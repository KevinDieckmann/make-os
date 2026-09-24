import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { leererBestand } from '../lib/crm/speicher';
import { kontextAus, imSegment, segmentAuswerten } from '../lib/crm/segmente';

const HEUTE = '2026-09-24';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

describe('Segmente', () => {
  const crm = { ...leererBestand(), firmen: [{ id: 'f-a', name: 'A', branche: 'Maschinenbau', stadt: 'Berlin', rolle: 'zielkunde' as const, geaendert: HEUTE }] };
  const ctx = kontextAus(crm, HEUTE);
  it('Kriterien über Person und Firma; gesperrte Personen nie', () => {
    expect(imSegment(k('a', { firmaId: 'f-a', kreis: 'A' }), { branche: 'maschinen', kreis: ['A'], firmaRolle: ['zielkunde'] }, ctx)).toBe(true);
    expect(imSegment(k('b', { firmaId: 'f-a', kreis: 'B' }), { kreis: ['A'] }, ctx)).toBe(false);
    expect(imSegment(k('c', { werbesperre: { seit: HEUTE, grund: 'x' } }), {}, ctx)).toBe(false);
  });
  it('Kanal-Kriterium zählt nur zulässig Erreichbare; Auswertung je Kanal', () => {
    const ew = { kanal: 'mail' as const, grundlage: 'einwilligung' as const, erteiltAm: HEUTE, nachweis: 'x' };
    const l = [k('a', { email: 'a@b.de', einwilligungen: [ew] }), k('b', { email: 'b@b.de' }), k('c', { telefon: '030' })];
    expect(segmentAuswerten(l, { kanal: 'mail' }, ctx).anzahl).toBe(1);
    expect(segmentAuswerten(l, {}, ctx).kanaele).toMatchObject({ mail: 1, einladung: 1, nurPersoenlich: 2 });
  });
});
