import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { mailAdresse, mailSignale, terminSignale, signaleAnwenden, personImTitel, bezugMail } from '../lib/crm/signale';

const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

describe('Signale aus Mail und Kalender', () => {
  it('Absender auflösen, nur bekannte und nicht gesperrte Personen, wiederholbar', () => {
    expect(mailAdresse('"Max M." <Max@Firma.de>')).toBe('max@firma.de');
    const kontakte = [k('max', { email: 'max@firma.de' }), k('sp', { email: 'sp@firma.de', werbesperre: { seit: '2026-09-01', grund: 'x' } })];
    const s = mailSignale(kontakte, [{ id: 'm1', email: 'max@firma.de', betreff: 'Re: Angebot', am: '2026-09-23T10:00:00Z' }, { id: 'm2', email: 'sp@firma.de', betreff: 'x', am: '2026-09-23T10:00:00Z' }, { id: 'm3', email: 'fremd@x.de', betreff: 'y', am: '2026-09-23T10:00:00Z' }]);
    expect(s.map(x => x.kontaktId)).toEqual(['c-max']);
    const r = signaleAnwenden(kontakte, s);
    expect(r.kontakte[0]).toMatchObject({ letzterKontakt: '2026-09-23' });
    expect(r.kontakte[0].aktivitaeten[0]).toMatchObject({ art: 'antwort', bezug: bezugMail('m1') });
    expect(mailSignale(r.kontakte, [{ id: 'm1', email: 'max@firma.de', betreff: 'Re: Angebot', am: '2026-09-23T10:00:00Z' }]).length).toBe(0);
  });
  it('Termine: Vor- und Nachname im Titel, eindeutig; vergangen → Verlauf, kommend → nächster Termin', () => {
    const w = k('wilfried', { vorname: 'Wilfried', nachname: 'Streiner' });
    expect(personImTitel(w, 'Call mit Wilfried Streiner (OneBanking)')).toBe(true);
    expect(personImTitel(w, 'Streinerweg Wilfriedstraße')).toBe(false);
    const t = terminSignale([w, k('simon', { vorname: 'Simon', nachname: 'Streiner' })], [
      { id: 't1', titel: 'Wilfried Streiner Review', start: '2026-09-20T10:00:00Z' },
      { id: 't2', titel: 'Wilfried Streiner Planung', start: '2026-09-30T10:00:00Z' },
      { id: 't3', titel: 'Streiner Familie', start: '2026-09-21T10:00:00Z' },
    ], '2026-09-24T12:00:00Z');
    expect(t.vergangen.map(x => x.kontaktId)).toEqual(['c-wilfried']);
    expect(t.kommend['c-wilfried']).toMatchObject({ titel: 'Wilfried Streiner Planung' });
  });
});

describe('Signale — keine Funktionspostfächer, nur frische Antworten warten', () => {
  it('info@/events@ und Einträge ohne Namen werden nicht zugeordnet', () => {
    const s = mailSignale([k('ev', { vorname: '', nachname: '', firma: 'Galerie', email: 'events@galerie.de' }), k('in', { email: 'info@firma.de' })], [
      { id: 'a', email: 'events@galerie.de', betreff: 'Finissage', am: '2026-09-20T10:00:00Z' }, { id: 'b', email: 'info@firma.de', betreff: 'News', am: '2026-09-20T10:00:00Z' },
    ]);
    expect(s).toEqual([]);
  });
});

import { kontaktVereinen } from '../lib/make-one/crm';
describe('Kontakt vereinen (kein verlorener Verlauf)', () => {
  it('ein älterer Client-Stand wischt serverseitig angehängte Aktivitäten nicht weg', () => {
    const alt = k('a', { aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'mail', von: 'kevin' }, { am: '2026-09-24T09:00:00Z', art: 'antwort', text: 'Mail: Re', von: 'system', bezug: 'mail-x' }], letzterKontakt: '2026-09-24' });
    const neu = k('a', { kreis: 'A', aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'mail', von: 'kevin' }], letzterKontakt: '2026-09-20' });
    const v = kontaktVereinen(neu, alt);
    expect(v.kreis).toBe('A');
    expect(v.aktivitaeten.map(x => x.art)).toEqual(['mail', 'antwort']);
    expect(v.letzterKontakt).toBe('2026-09-24');
  });
});
