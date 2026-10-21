// Ein Kennungs-Umzug oder Zusammenführen schreibt Kontakt-Kennungen um — daraus dürfen keine „neuen“ Ereignisse entstehen,
// sonst starten Prozesse (z. B. Newsletter-Begleitung) für den ganzen Bestand. Echte Zuwächse melden sich weiter.
import { describe, it, expect } from 'vitest';
import { crmDiffKundengewinnung, einwilligungDiff } from '@/lib/ereignisse/quellen-kundengewinnung';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const ew = { kanal: 'newsletter', erteiltAm: '2026-10-01', zeitpunkt: '2026-10-01T10:00:00', erfasstVon: 'a', wortlaut: 'w', belegRef: 'doi:1' };
const k = (id: string, einwilligungen: unknown[] = [ew]) => ({ id, einwilligungen }) as unknown as Kontakt;
const kp = (ergebnisse: { kontaktId: string; ergebnis: string; am: string }[]) => ({ kampagnen: [{ id: 'kp1', status: 'aktiv', ergebnisse }] }) as unknown as Pick<CrmBestand, 'kampagnen'>;

describe('Ereignisse überstehen einen Kennungs-Umzug', () => {
  it('Einwilligung unter neuer Kennung ist keine neue — eine wirklich neue schon', () => {
    expect(einwilligungDiff([k('alt-1')], [k('c-neu-1')])).toEqual([]);
    const neu = einwilligungDiff([k('alt-1')], [k('c-neu-1'), k('c-neu-2', [{ ...ew, belegRef: 'doi:2', zeitpunkt: '2026-10-20T09:00:00' }])]);
    expect(neu.map(e => e.bezug)).toEqual([{ kontaktId: 'c-neu-2' }]);
  });
  it('Kampagnen-Ergebnis mit umgeschriebener Kennung meldet nichts, ein zusätzliches schon', () => {
    const vorher = kp([{ kontaktId: 'alt-1', ergebnis: 'antwort', am: '2026-10-02' }]);
    expect(crmDiffKundengewinnung(vorher, kp([{ kontaktId: 'c-neu-1', ergebnis: 'antwort', am: '2026-10-02' }])).filter(e => e.art === 'kampagnen-ergebnis')).toEqual([]);
    const mehr = crmDiffKundengewinnung(vorher, kp([{ kontaktId: 'c-neu-1', ergebnis: 'antwort', am: '2026-10-02' }, { kontaktId: 'c-neu-2', ergebnis: 'antwort', am: '2026-10-02' }]));
    expect(mehr.filter(e => e.art === 'kampagnen-ergebnis').length).toBe(1);
  });
});
