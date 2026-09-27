import { describe, it, expect } from 'vitest';
import { personEntfernen, personUmbiegen, personVerweise } from '@/lib/crm/person-verweise';
import { verweiseUmbiegen } from '@/lib/crm/dubletten';
import type { CrmBestand } from '@/lib/crm/typen';

/** Ein Bestand, in dem die Person in JEDER Liste vorkommt, die eine Person kennen kann. */
function bestand(id = 'c-alt', andere = 'c-x'): CrmBestand {
  const b = {
    firmen: [], leistungen: [], events: [{ id: 'ev1', titel: 'Abend', datum: '2026-09-20', status: 'durchgefuehrt' }], verarbeitungen: [], segmente: [], newsletter: [], wertelisten: {},
    chancen: [{ id: 'ch1', titel: 'Deal', kontaktIds: [id, andere], personenRollen: { [id]: 'entscheider', [andere]: 'nutzer' }, stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' }],
    mandate: [{ id: 'm1', kunde: 'K', kontaktIds: [id], status: 'aktiv' }],
    teilnahmen: [{ id: 't1', eventId: 'ev1', kontaktId: id, status: 'da', geaendert: 'x' }, { id: 't2', eventId: 'ev1', kontaktId: andere, status: 'da', geaendert: 'x' }],
    kampagnen: [{ id: 'kp1', name: 'K', status: 'aktiv', kontaktIds: [id, andere], ergebnisse: [{ kontaktId: id, ergebnis: 'gespraech', am: '2026-09-01' }] }],
    beitraege: [{ id: 'b1', titel: 'B', quellen: [id], wirkung: [{ kontaktId: id, art: 'reaktion', am: '2026-09-01' }] }],
    followups: [
      { id: 'fu1', bezug: { art: 'kontakt', id }, kontaktId: id, art: 'anruf', text: 'Anrufen', faellig: '2026-10-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: 'x', geaendert: 'x' },
      { id: 'fu2', bezug: { art: 'chance', id: 'ch1' }, kontaktId: id, art: 'mail', text: 'Angebot', faellig: '2026-10-02', zustaendig: 'kevin', status: 'offen', quelle: 'deal', angelegt: 'x', geaendert: 'x' },
      { id: 'fu3', bezug: { art: 'kontakt', id: andere }, kontaktId: andere, art: 'mail', text: 'Bleibt', faellig: '2026-10-02', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: 'x', geaendert: 'x' },
    ],
    sitzungen: [{ id: 's1', datum: '2026-09-25', person: 'kevin', karten: [{ kontaktId: id, kategorie: 'pflege' }, { kontaktId: andere, kategorie: 'neu' }] }],
    antraege: [{ id: 'a1', art: 'auskunft', name: 'N', kontaktId: id, eingang: '2026-09-01', frist: '2026-10-01', status: 'offen' }],
  };
  return b as unknown as CrmBestand;
}

describe('Person im CRM-Bestand — eine Stelle für alle Listen (Feinschliff 3)', () => {
  it('entfernen: die Kennung steht danach NIRGENDS mehr im Bestand', () => {
    const neu = personEntfernen(bestand(), 'c-alt');
    expect(JSON.stringify(neu)).not.toContain('c-alt');
    expect(neu.chancen[0].kontaktIds).toEqual(['c-x']);
    expect(neu.chancen[0].personenRollen).toEqual({ 'c-x': 'nutzer' });
    expect(neu.followups?.map(f => f.id)).toEqual(['fu3']);
    expect(neu.sitzungen[0].karten.map(k => k.kontaktId)).toEqual(['c-x']);
    expect(neu.antraege[0].kontaktId).toBeUndefined();
    expect(neu.antraege).toHaveLength(1);
  });
  it('umbiegen: alles zeigt auf die behaltene Person, ohne Doppelungen', () => {
    const neu = personUmbiegen(bestand(), 'c-alt', 'c-x');
    expect(JSON.stringify(neu)).not.toContain('c-alt');
    expect(neu.chancen[0].kontaktIds).toEqual(['c-x']);
    expect(neu.chancen[0].personenRollen).toEqual({ 'c-x': 'nutzer' }); // vorhandene Rolle der behaltenen Person gewinnt
    expect(neu.followups?.find(f => f.id === 'fu1')?.bezug).toEqual({ art: 'kontakt', id: 'c-x' });
    expect(neu.followups?.find(f => f.id === 'fu2')?.kontaktId).toBe('c-x');
    expect(neu.kampagnen[0].kontaktIds).toEqual(['c-x']);
    expect(neu.antraege[0].kontaktId).toBe('c-x');
  });
  it('verweiseUmbiegen (Dubletten) nutzt dieselbe Stelle', () => {
    expect(JSON.stringify(verweiseUmbiegen(bestand(), 'c-alt', 'c-x'))).not.toContain('c-alt');
  });
  it('Auskunft zählt jede Liste auf', () => {
    const a = personVerweise(bestand(), 'c-alt');
    expect(a.chancen).toHaveLength(1); expect(a.chancen[0]).toMatchObject({ rolle: 'entscheider' });
    expect(a.followups).toHaveLength(2); expect(a.powerHours).toHaveLength(1); expect(a.antraege).toHaveLength(1);
    expect(a.kampagnen[0].ergebnisse).toHaveLength(1); expect(a.beitraege[0].wirkung).toHaveLength(1); expect(a.events[0].event).toBe('Abend');
  });
});
