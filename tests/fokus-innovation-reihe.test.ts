// Fokus Innovation (03.10.): Reihe unter Make.One — Werteliste, Säuberung, Schreibweg mit Stand, Name nach außen,
// Herkunft in der Qualifizierung, Filter und Kennzahlen je Reihe (eine Rechnung: eventZahlen + zahlenSumme).
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Event, Teilnahme } from '@/lib/crm/typen';
import { saeubern, wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import { standVon } from '@/lib/crm/crm-stand';
import { EVENT_REIHEN, OHNE_REIHE, reiheKennung, reiheName, reiheVon, titelMitReihe, eventName, alsMarketingAnmeldung, NETZWERKEN_MARKE } from '@/lib/crm/marke';
import { reihenUebersicht, reihenFilter, passtReihe, zahlenSumme, reiheSchluessel } from '@/lib/crm/reihen';
import { eventZahlen } from '@/lib/crm/events';
import { marketingHerkunft } from '@/lib/crm/scoring';
import { herkunftVon } from '@/lib/crm/herkunft';
import { icsText } from '@/lib/crm/eventplanung';
import { KACHELN } from '@/lib/crm/flaechen';

const J = '2026-10-03T10:00:00.000Z';
const HEUTE = '2026-10-03';
const ev = (id: string, x: Partial<Event> = {}): Event => ({ id, titel: `Abend ${id}`, format: 'dinner', ziel: 'drei Folgegespräche', datum: '2026-09-20', status: 'durchgefuehrt', geaendert: J, ...x });
const tn = (eventId: string, kontaktId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${eventId}-${kontaktId}`, eventId, kontaktId, status: 'da', geaendert: J, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x } as Kontakt);
const sauber = (roh: Record<string, unknown>) => saeubern('events', roh, J, 'kevin') as unknown as Event;
const FI = 'fokus-innovation';

describe('Werteliste und Namen', () => {
  it('Fokus Innovation steht in der Werteliste, Kennung fest', () => {
    expect(EVENT_REIHEN).toContainEqual({ id: FI, name: 'Fokus Innovation' });
    expect(reiheName(FI)).toBe('Fokus Innovation');
    expect(reiheName('salon-x')).toBe('salon-x'); // unbekannt: steht für sich (Rückweg aus einem neueren Stand)
  });
  it('Kennung: klein, Ziffern, Bindestriche, höchstens 40 Zeichen', () => {
    expect(reiheKennung(FI)).toBe(FI);
    for (const falsch of ['Fokus Innovation', 'fokus_innovation', '-x', 'x-', '', 'a'.repeat(41), 42, null, '<b>']) expect(reiheKennung(falsch)).toBeUndefined();
  });
  it('Name nach außen: Reihe vor dem Titel, nie doppelt; ohne Reihe unverändert; besuchte Events nie', () => {
    expect(eventName(ev('a', { reihe: FI, titel: 'Dinner' }))).toBe('Make.One · Fokus Innovation · Dinner');
    expect(eventName(ev('a', { reihe: FI, titel: 'Fokus Innovation Hamburg' }))).toBe('Make.One · Fokus Innovation Hamburg');
    expect(eventName(ev('a', { reihe: FI, titel: 'fokus innovation hamburg' }))).toBe('Make.One · fokus innovation hamburg');
    expect(eventName(ev('a', { titel: 'Stammtisch' }))).toBe('Make.One · Stammtisch');
    expect(titelMitReihe(ev('a', { reihe: FI, marke: NETZWERKEN_MARKE, titel: 'Messe' }))).toBe('Messe');
    expect(reiheVon(ev('a', { reihe: FI, marke: NETZWERKEN_MARKE }))).toBeUndefined();
  });
});

describe('Säuberung und Schreibweg (Kompatibilitätsmodus: nur optional)', () => {
  it('gültige Reihe bleibt, ungültige fällt weg, Altbestand bekommt kein Feld', () => {
    expect(sauber({ ...ev('ev-a'), reihe: FI }).reihe).toBe(FI);
    expect('reihe' in sauber({ ...ev('ev-a') })).toBe(false);
    expect('reihe' in sauber({ ...ev('ev-a'), reihe: 'Fokus Innovation' })).toBe(false);
    expect('reihe' in sauber({ ...ev('ev-a'), reihe: '' })).toBe(false);
  });
  it('besuchte Events (Netzwerken) tragen nie eine Reihe', () => {
    expect('reihe' in sauber({ ...ev('ev-a'), marke: NETZWERKEN_MARKE, reihe: FI })).toBe(false);
  });
  it('teil setzt und leert die Reihe, ohne andere Felder anzufassen', () => {
    const b0: CrmBestand = { ...leererBestand(), events: [ev('ev-1', { marke: 'Make.One', ort: 'Hamburg' })] };
    const r1 = wendeCrmAn(b0, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { reihe: FI } }], J, 'kevin');
    expect(r1.konflikte).toEqual([]);
    expect(r1.bestand.events[0]).toMatchObject({ reihe: FI, marke: 'Make.One', ort: 'Hamburg' });
    const r2 = wendeCrmAn(r1.bestand, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { reihe: '' } }], J, 'kevin');
    expect(r2.bestand.events[0].reihe).toBeUndefined();
    expect(r2.bestand.events[0].ort).toBe('Hamburg');
  });
  it('Stand-409: zwei Geräte mit demselben Stand — das zweite bekommt den Konflikt, nichts wird überschrieben', () => {
    const e0 = ev('ev-1');
    const b0: CrmBestand = { ...leererBestand(), events: [e0] };
    const stand0 = standVon(e0);
    const r1 = wendeCrmAn(b0, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { reihe: FI }, stand: stand0 }], J, 'kevin');
    expect(r1.konflikte).toEqual([]);
    const r2 = wendeCrmAn(r1.bestand, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { reihe: '' }, stand: stand0 }], J, 'malin');
    expect(r2.konflikte).toHaveLength(1);
    expect(r2.konflikte[0]).toMatchObject({ liste: 'events', id: 'ev-1', grund: 'inzwischen geändert', aktuell: { reihe: FI } });
    expect(r2.bestand.events[0].reihe).toBe(FI);
  });
});

describe('Herkunft: Make.One-Gast zählt als Marketing-Lead — mit Reihe im Text', () => {
  const fi = ev('ev-fi', { reihe: FI, titel: 'Fokus Innovation Hamburg', datum: '2026-09-12' });
  it('EINE Regel: alsMarketingAnmeldung = Herkunft „event“ im Scoring', () => {
    const faelle: [Partial<Teilnahme>, Partial<Event>, boolean][] = [
      [{ status: 'da', einladungsweg: 'mail' }, {}, true],
      [{ status: 'zugesagt' }, {}, true],
      [{ status: 'eingeladen', einladungsweg: 'mail' }, {}, false],
      [{ status: 'da', einladungsweg: 'persoenlich' }, {}, false],
      [{ status: 'da', einladungsweg: 'telefon' }, {}, false],
      [{ status: 'da' }, { marke: NETZWERKEN_MARKE }, false],
    ];
    for (const [t, e, soll] of faelle) {
      const evx = ev('ev-x', e), t1 = tn('ev-x', 'c-a', t);
      expect(alsMarketingAnmeldung(t1, evx)).toBe(soll);
      expect(marketingHerkunft([k('c-a')], { events: [evx], teilnahmen: [t1] }).some(g => g.quelle === 'event')).toBe(soll);
    }
  });
  it('Qualifizierung nennt „Make.One · Fokus Innovation Hamburg“ an der Karte', () => {
    const crm = { events: [fi], teilnahmen: [tn('ev-fi', 'c-a', { einladungsweg: 'mail' })], kampagnen: [], firmen: [] };
    const h = herkunftVon([k('c-a')], crm);
    expect(h.teile.find(t => t.art === 'makeone')?.text).toBe('Make.One · Fokus Innovation Hamburg · 12.09.');
    const ohneReiheImTitel = herkunftVon([k('c-a')], { ...crm, events: [{ ...fi, titel: 'Dinner' }] });
    expect(ohneReiheImTitel.teile.find(t => t.art === 'makeone')?.text).toBe('Make.One · Fokus Innovation · Dinner · 12.09.');
  });
  it('Kalender-Datei für Gäste: Reihe im Titel und in der Beschreibung', () => {
    const ics = icsText(ev('ev-1', { reihe: FI, titel: 'Dinner', uhrzeit: '19:00' }), J).replace(/\r\n /g, '');
    expect(ics).toContain('SUMMARY:Fokus Innovation · Dinner');
    expect(ics).toContain('Reihe: Fokus Innovation');
    expect(icsText(ev('ev-2', { titel: 'Dinner' }), J).replace(/\r\n /g, '')).not.toContain('Reihe:');
  });
});

describe('Filter und Kennzahlen je Reihe', () => {
  const events: Event[] = [
    ev('e1', { reihe: FI, datum: '2026-09-10' }),
    ev('e2', { reihe: FI, datum: '2026-11-05', status: 'geplant' }),
    ev('e3', { datum: '2026-09-15' }),
    ev('e4', { reihe: FI, datum: '2026-09-01', status: 'abgesagt' }),
    ev('e5', { marke: NETZWERKEN_MARKE, datum: '2026-09-18', reihe: FI }),
  ];
  const teilnahmen: Teilnahme[] = [
    tn('e1', 'c-a', { einladungsweg: 'mail', followUpAm: '2026-09-11' }),
    tn('e1', 'c-b', { einladungsweg: 'persoenlich' }),
    tn('e1', 'c-c', { status: 'zugesagt', einladungsweg: 'linkedin' }),
    tn('e2', 'c-a', { status: 'zugesagt', einladungsweg: 'mail' }),
    tn('e3', 'c-d', { einladungsweg: 'mail' }),
    tn('e4', 'c-e', { einladungsweg: 'mail' }),
    tn('e5', 'c-f', { einladungsweg: 'mail' }),
  ];
  const kontakte = ['c-a', 'c-b', 'c-c', 'c-d', 'c-e', 'c-f'].map(id => k(id));
  const chancen = [{ id: 'ch-1', titel: 'Deal', stufe: 'qualifiziert', kontaktIds: ['c-a'], wert: { betrag: 12000, basis: 'einmalig' }, quelle: 'event', quelleBezug: 'e1', angelegt: '2026-09-12', geaendert: J } as unknown as Chance];
  const zahlen = Object.fromEntries(events.map(e => [e.id, eventZahlen(e, teilnahmen, kontakte, chancen)]));

  it('eventZahlen zählt entstandene Deals (Anzahl neben dem Wert)', () => {
    expect(zahlen.e1.dealsVerursacht).toBe(1);
    expect(zahlen.e1.verursacht).toBeGreaterThan(0);
    expect(zahlen.e3.dealsVerursacht).toBe(0);
  });
  it('Übersicht: Fokus Innovation summiert seine Events (ohne abgesagte, ohne besuchte), Leads je Person einmal', () => {
    const r = reihenUebersicht(events, zahlen, teilnahmen, HEUTE);
    expect(r.map(x => x.id)).toEqual([FI, OHNE_REIHE]);
    const fi = r[0];
    expect(fi).toMatchObject({ name: 'Fokus Innovation', events: 2, vorbei: 1, kommend: 1, leads: 2 });
    // Gäste da: c-a, c-b (e1); Zusagen: c-a, c-b, c-c (e1) + c-a (e2); nachgefasst: c-a
    expect(fi.summe).toMatchObject({ da: 2, zugesagt: 4, nachgefasst: 1, nachfassenOffen: 1, dealsVerursacht: 1 });
    expect(fi.nachgefasstQuote).toBe(0.5);
    expect(r[1]).toMatchObject({ name: 'Ohne Reihe', events: 1, leads: 1 });
  });
  it('Summe = dieselben Zahlen je Event (eine Rechnung): zahlenSumme der Reihe = Summe der eventZahlen', () => {
    const r = reihenUebersicht(events, zahlen, teilnahmen, HEUTE)[0];
    expect(r.summe).toEqual(zahlenSumme([zahlen.e1, zahlen.e2]));
    expect(zahlenSumme([undefined, { da: 2 }]).da).toBe(2);
  });
  it('Fokus Innovation steht auch ohne Events da; „ohne Reihe“ nur, wenn es solche Abende gibt', () => {
    expect(reihenUebersicht([], {}, [], HEUTE)).toEqual([expect.objectContaining({ id: FI, events: 0, leads: 0, nachgefasstQuote: null })]);
  });
  it('Filter: erst sichtbar, wenn ein Event eine Reihe trägt; zählt nur eigene Abende', () => {
    expect(reihenFilter([ev('x')])).toEqual([]);
    expect(reihenFilter(events)).toEqual([{ id: FI, label: 'Fokus Innovation', anzahl: 3 }, { id: OHNE_REIHE, label: 'Ohne Reihe', anzahl: 1 }]);
    expect(events.filter(e => passtReihe(e, FI)).map(e => e.id)).toEqual(['e1', 'e2', 'e4']);
    expect(events.filter(e => passtReihe(e, null))).toHaveLength(5);
    expect(reiheSchluessel(events[4])).toBe(OHNE_REIHE);
  });
  it('die Kachel „Reihen“ steht in der Make.One-Fläche', () => {
    expect(KACHELN.event.map(x => x.id)).toContain('reihen');
  });
});
