// Follow-up-Ebene (27.09.): eine Liste aus echten Follow-ups und den alten Feldern, ohne Doppelung. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { faellige, zaehlen, puenktlichkeit, neuesFollowUp, virtuell, gruppeVon, taktVon } from '../lib/crm/followup';
import { leererBestand } from '../lib/crm/speicher';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand, FollowUp } from '../lib/crm/typen';

const HEUTE = '2026-09-27';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: id.toUpperCase(), eignung: 'hoch', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, besitzer: 'kevin', ...x } as Kontakt);
const fu = (x: Partial<FollowUp>): FollowUp => ({ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'anruf', text: 'Anrufen', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });

describe('Follow-up — fällige Liste', () => {
  const kontakte = [
    k('c-a', { naechsterSchritt: { text: 'Angebot schicken', datum: '2026-09-25' } }),            // überfällig (virtuell)
    k('c-b', { wiedervorlage: HEUTE }),                                                            // heute (virtuell)
    k('c-c', { kreis: 'A', letzterKontakt: '2026-08-01' }),                                        // Kadenz A 30 Tage → seit 27 Tagen fällig
    k('c-d', { kreis: 'D', letzterKontakt: '2026-09-20' }),                                        // Kadenz D 180 → nicht im Horizont
    k('c-e', { naechsterSchritt: { text: 'x', datum: HEUTE }, werbesperre: { seit: HEUTE, grund: 'Widerspruch' } }), // gesperrt → nie
  ];
  const crm: CrmBestand = { ...leererBestand(),
    followups: [fu({ id: 'fu-1', kontaktId: 'c-a', bezug: { art: 'kontakt', id: 'c-a' }, faellig: '2026-09-25', text: 'Angebot schicken' }), fu({ id: 'fu-2', kontaktId: 'c-b', faellig: '2026-10-03', text: 'Nächste Woche', status: 'offen' }), fu({ id: 'fu-3', status: 'erledigt', erledigtAm: '2026-09-20T10:00:00Z', faellig: '2026-09-21' })],
    chancen: [{ id: 'ch-1', titel: 'Deal', kontaktIds: ['c-b'], art: 'retainer', wert: { betrag: 1, basis: 'monat' }, stufe: 'bedarf', historie: [], naechsterSchritt: { text: 'Diagnose', datum: '2026-09-29' }, qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdc', besitzer: 'malin', angelegt: HEUTE, geaendert: HEUTE }],
  };
  const liste = faellige(kontakte, crm, HEUTE);

  it('echte Follow-ups schlagen den virtuellen Eintrag am selben Tag — keine Doppelung', () => {
    const a = liste.filter(f => f.kontaktId === 'c-a');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: 'fu-1', virtuell: false, gruppe: 'ueberfaellig', tageUeber: 2 });
  });
  it('alte Felder erscheinen als virtuelle Einträge, Gesperrte nie, Kadenz nur im Horizont', () => {
    expect(liste.find(f => f.id === 'v:wiedervorlage:c-b')).toMatchObject({ gruppe: 'heute', quelle: 'wiedervorlage' });
    expect(liste.find(f => f.id === 'v:dealschritt:ch-1')).toMatchObject({ gruppe: 'woche', zustaendig: 'malin', bezug: { art: 'chance', id: 'ch-1' } });
    expect(liste.find(f => f.id === 'v:kadenz:c-c')).toMatchObject({ quelle: 'kadenz', gruppe: 'ueberfaellig' });
    expect(liste.some(f => f.kontaktId === 'c-d')).toBe(false);
    expect(liste.some(f => f.kontaktId === 'c-e')).toBe(false);
  });
  it('sortiert nach Gruppe und Datum und zählt', () => {
    expect(liste.map(f => f.gruppe)).toEqual([...liste.map(f => f.gruppe)].sort((a, b) => ['ueberfaellig', 'heute', 'woche', 'spaeter'].indexOf(a) - ['ueberfaellig', 'heute', 'woche', 'spaeter'].indexOf(b)));
    const z = zaehlen(liste);
    expect(z.gesamt).toBe(liste.length);
    expect(z.ueberfaellig).toBe(2);
  });
  it('Gruppen, Takt, Pünktlichkeit und Kennungen', () => {
    expect(gruppeVon('2026-09-26', HEUTE)).toBe('ueberfaellig');
    expect(gruppeVon('2026-10-04', HEUTE)).toBe('woche');
    expect(gruppeVon('2026-10-05', HEUTE)).toBe('spaeter');
    expect(taktVon({ kreis: 'B' })).toBe(60);
    expect(taktVon({ kreis: 'B', taktTage: 14 })).toBe(14);
    expect(taktVon({ kreis: 'B' }, { kadenzTage: { B: 45 } })).toBe(45);
    expect(taktVon({})).toBeNull();
    expect(puenktlichkeit(crm.followups, HEUTE)).toMatchObject({ erledigt: 1, puenktlich: 1, quote: null });
    expect(virtuell('v:kadenz:c-9')).toEqual({ quelle: 'kadenz', ziel: 'c-9' });
    expect(virtuell('fu-1')).toBeNull();
    const n = neuesFollowUp({ id: 'fu-9', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', text: '  Anrufen  ', faellig: HEUTE }, kontakte[0], 'malin', `${HEUTE}T09:00:00Z`);
    expect(n).toMatchObject({ zustaendig: 'kevin', status: 'offen', quelle: 'hand', text: 'Anrufen' });
  });
});
