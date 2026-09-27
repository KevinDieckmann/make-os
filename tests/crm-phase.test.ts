import { describe, it, expect } from 'vitest';
import { phaseVon } from '@/lib/crm/phase';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const k = (extra: Partial<Kontakt> = {}) => ({ id: 'c-a', vorname: 'A', nachname: 'T', stufe: 'gespraech', aktivitaeten: [], ...extra }) as unknown as Kontakt;
const crm = (t: Partial<CrmBestand>) => ({ mandate: [], chancen: [], firmen: [], ...t }) as unknown as CrmBestand;

describe('Phase abgeleitet (27.09.)', () => {
  it('aktives Mandat schlägt alles → Kunde', () => {
    const b = crm({ mandate: [{ id: 'm', kunde: 'K', kontaktIds: ['c-a'], status: 'aktiv' }] as never, chancen: [{ id: 'ch', titel: 'D', kontaktIds: ['c-a'], stufe: 'angebot' }] as never });
    expect(phaseVon(k(), b)).toMatchObject({ phase: 'kunde', vonHand: false });
  });
  it('offener Deal → Opportunity, beendetes Mandat → Ex-Kunde, aktiver Firmen-Lead → Interessent', () => {
    expect(phaseVon(k(), crm({ chancen: [{ id: 'ch', titel: 'D', kontaktIds: ['c-a'], stufe: 'bedarf' }] as never })).phase).toBe('opportunity');
    expect(phaseVon(k(), crm({ mandate: [{ id: 'm', kunde: 'K', kontaktIds: ['c-a'], status: 'beendet' }] as never })).phase).toBe('ex_kunde');
    expect(phaseVon(k({ firmaId: 'f-1' }), crm({ firmen: [{ id: 'f-1', name: 'F', lead: { status: 'im_gespraech', kriterien: {} } }] as never })).phase).toBe('interessent');
  });
  it('von Hand nur Partner/Multiplikator; sonst Kontakt', () => {
    expect(phaseVon(k({ lebensphase: 'multiplikator' }), crm({}))).toMatchObject({ phase: 'multiplikator', vonHand: true });
    expect(phaseVon(k(), crm({})).phase).toBe('kontakt');
    expect(phaseVon(k({ lebensphase: 'kunde' }), crm({}))).toMatchObject({ phase: 'kunde', vonHand: true });
  });
});
