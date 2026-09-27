// Die Follow-up-Ebene führt (Feinschliff 3, 27.09.): Für dich und Befunde lesen dieselbe Fälligkeitsliste wie der Reiter Follow-up.
import { describe, it, expect } from 'vitest';
import { fuerDich } from '@/lib/crm/team';
import { befunde } from '@/lib/crm/befunde';
import { leererBestand } from '@/lib/crm/speicher';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const H = '2026-09-27';
const k = (id: string, extra: Partial<Kontakt> = {}) => ({ id, vorname: id, nachname: 'T', stufe: 'gespraech', kreis: 'B', besitzer: 'kevin', aktivitaeten: [], geaendertAm: H, ...extra }) as unknown as Kontakt;
const crm = (): CrmBestand => ({ ...leererBestand(), followups: [
  { id: 'fu1', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'anruf', text: 'Angebot nachfassen', faellig: '2026-09-20', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: H, geaendert: H },
  { id: 'fu2', bezug: { art: 'kontakt', id: 'c-b' }, kontaktId: 'c-b', art: 'mail', text: 'Malins Zusage', faellig: H, zustaendig: 'malin', status: 'offen', quelle: 'hand', angelegt: H, geaendert: H },
] } as CrmBestand);

describe('Follow-up-Ebene führt', () => {
  it('„Für dich“ zählt echte Follow-ups der Person — nicht nur nächste Schritte am Kontakt', () => {
    const kevin = fuerDich('kevin', [k('c-a'), k('c-b')], crm(), H).find(x => x.id === 'zusagen');
    expect(kevin).toMatchObject({ anzahl: 1, ziel: { s: 'followup', a: 'faellig' } });
    expect(kevin?.text).toMatch(/1 überfällig/);
    expect(fuerDich('malin', [k('c-a'), k('c-b')], crm(), H).find(x => x.id === 'zusagen')?.anzahl).toBe(1);
  });
  it('Befunde nennen überfällige Follow-ups mit Ziel Follow-up › Fällig', () => {
    const b = befunde([k('c-a'), k('c-b')], crm(), H).find(x => x.titel.includes('Follow-up'));
    expect(b).toMatchObject({ prio: 1, bereich: 'followup', ansicht: 'faellig' });
    expect(b?.titel).toBe('1 Follow-up überfällig');
  });
});
