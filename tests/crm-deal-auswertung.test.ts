// Deal-Ebene (27.09.): Anlage über den einen Weg, Auswertung mit Mindestmengen. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { dealBauen } from '../lib/crm/deal-anlegen';
import { verweildauer, verweildauerJeStufe, umwandlung, winLoss, zyklus, prognoseNachMonat, haengtNachWert } from '../lib/crm/deal-auswertung';
import type { Chance } from '../lib/crm/typen';
import type { Kontakt } from '../lib/make-one/crm';

const HEUTE = '2026-09-27';
const J = (d: string) => `${d}T10:00:00.000Z`;
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({
  id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat', laufzeitMonate: 12 }, stufe: 'qualifiziert',
  historie: [{ stufe: 'qualifiziert', am: J('2026-09-01'), von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J('2026-09-01'), geaendert: J('2026-09-01'), ...x,
});
const k = (id: string, firmaId?: string): Kontakt => ({ id, vorname: 'A', nachname: id, eignung: 'hoch', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, ...(firmaId ? { firmaId } : {}) } as unknown as Kontakt);

describe('Deal anlegen — der eine Weg', () => {
  const ctx = { kontakte: [k('c-a', 'f-acme'), k('c-b')], firmen: [{ id: 'f-acme', name: 'Acme GmbH' }], chancen: [] as Chance[], leadZeilen: [], person: 'malin', jetzt: J(HEUTE) };
  it('braucht einen nächsten Schritt und eine Person oder Firma', () => {
    expect(dealBauen({ kontaktIds: ['c-a'] }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(dealBauen({ schritt: { text: 'Anruf', datum: '2026-10-01' } }, ctx)).toMatchObject({ ok: false, status: 400 });
  });
  it('nimmt die Firma der Person per Kennung, setzt Titel, Historie und Besitzer', () => {
    const r = dealBauen({ kontaktIds: ['c-a'], schritt: { text: 'Bedarfsgespräch', datum: '2026-10-01' }, wert: { betrag: 2500, basis: 'monat', laufzeitMonate: 6 } }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chance).toMatchObject({ firmaId: 'f-acme', firma: 'Acme GmbH', titel: 'Acme GmbH · Retainer', stufe: 'qualifiziert', besitzer: 'malin', naechsterSchritt: { text: 'Bedarfsgespräch', datum: '2026-10-01' } });
    expect(r.chance.historie).toEqual([{ stufe: 'qualifiziert', am: J(HEUTE), von: 'malin' }]);
    expect(r.chance.wert).toEqual({ betrag: 2500, basis: 'monat', laufzeitMonate: 6 });
  });
  it('ein zweiter offener Deal an derselben Firma nur mit Absicht', () => {
    const mit = { ...ctx, chancen: [deal('ch-1', { firmaId: 'f-acme', firma: 'Acme GmbH' })] };
    const r = dealBauen({ firmaId: 'f-acme', schritt: { text: 'x', datum: '2026-10-01' } }, mit);
    expect(r).toMatchObject({ ok: false, status: 409, offen: { id: 'ch-1' } });
    expect(dealBauen({ firmaId: 'f-acme', schritt: { text: 'x', datum: '2026-10-01' }, trotzdem: true }, mit).ok).toBe(true);
  });
});

describe('Deal-Auswertung', () => {
  const chancen = [
    deal('g1', { stufe: 'gewonnen', historie: [{ stufe: 'qualifiziert', am: J('2026-06-01'), von: '' }, { stufe: 'bedarf', am: J('2026-06-11'), von: '' }, { stufe: 'angebot', am: J('2026-06-21'), von: '' }, { stufe: 'gewonnen', am: J('2026-07-01'), von: '' }], angelegt: J('2026-06-01') }),
    deal('v1', { stufe: 'verloren', grund: 'Preis', historie: [{ stufe: 'qualifiziert', am: J('2026-08-01'), von: '' }, { stufe: 'verloren', am: J('2026-08-15'), von: '' }] }),
    deal('o1', { stufe: 'bedarf', erwartetAm: '2026-10-15', historie: [{ stufe: 'qualifiziert', am: J('2026-09-01'), von: '' }, { stufe: 'bedarf', am: J('2026-09-20'), von: '' }] }),
    deal('o2', { stufe: 'qualifiziert', wert: { betrag: 500, basis: 'monat' } }),
  ];
  it('Verweildauer je Deal und je Stufe', () => {
    const v = verweildauer(chancen[0], HEUTE);
    expect(v.map(x => [x.stufe, x.tage])).toEqual([['qualifiziert', 10], ['bedarf', 10], ['angebot', 10], ['gewonnen', 88]]);
    const js = verweildauerJeStufe(chancen, HEUTE);
    expect(js.find(x => x.stufe === 'qualifiziert')).toMatchObject({ n: 4 });
    expect(js.find(x => x.stufe === 'bedarf')).toMatchObject({ n: 2 });
  });
  it('Win/Loss mit Gründen, Quote erst ab Mindestmenge', () => {
    const w = winLoss(chancen, HEUTE);
    expect(w).toMatchObject({ gewonnen: 1, verloren: 1, quote: null, wertGewonnen: 12000 });
    expect(w.gruende).toEqual([{ grund: 'Preis', anzahl: 1, wert: 12000 }]);
  });
  it('Zyklus und Deal-Größe halten sich an Mindestmengen', () => {
    expect(zyklus(chancen)).toEqual({ n: 1, median: null, schnitt: null, dealGroesse: null });
  });
  it('Prognose nach Monat legt Deals auf ihre Entscheidung, ohne Datum nach hinten', () => {
    const p = prognoseNachMonat(chancen, HEUTE);
    expect(p[0].monat).toBe('2026-09');
    expect(p.find(x => x.monat === '2026-10')).toMatchObject({ anzahl: 1, wert: 12000, gewichtet: 5400 });
    expect(p.find(x => x.monat === 'offen')).toMatchObject({ anzahl: 1, wert: 6000 });
  });
  it('Umwandlung zählt Erreichte und Weitergekommene', () => {
    const u = umwandlung(chancen);
    expect(u[0]).toMatchObject({ von: 'qualifiziert', nach: 'bedarf', erreicht: 4, weiter: 2, quote: null });
  });
  it('hängt nach Wert', () => {
    expect(haengtNachWert(chancen, { o1: { ampel: 'rot' } })).toEqual({ anteil: 67, wert: 12000, gesamt: 18000 });
  });
});
