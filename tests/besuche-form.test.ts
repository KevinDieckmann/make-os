// ─── Besuchte Events — neue optionale Felder: Säuberung, Schreibweg, Schranken, Verweise (03.10.) ───
// Alles optional: ein Event ohne die neuen Felder liest und schreibt sich wie vorher; jede Änderung läuft über die bestehende
// Schreibkette (Einzel-Ops, Grenzen, Personen-Schranke, Löschsperre) — kein zweiter Speicher.
import { describe, it, expect } from 'vitest';
import { anmeldungVon, anmeldungPatch, fuerSaeubern, fuerVon, fuerFirmaId, werSaeubern, linkSaeubern, zielpersonenSaeubern, uebergabenSaeubern, istBesuch, besuchAbgesagt, ZIELPERSONEN_MAX } from '../lib/crm/besuche-form';
import { saeubern, wendeCrmAn, leererBestand } from '../lib/crm/speicher';
import { loeschSperren } from '../lib/crm/crm-stand';
import { personEntfernen, personUmbiegen, personVerweise } from '../lib/crm/person-verweise';
import type { CrmBestand, Event } from '../lib/crm/typen';

const J = '2026-10-03T08:00:00.000Z';
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Mittelstandstag Beispielstadt', format: 'sonstig', ziel: '', datum: '2026-10-20', status: 'geplant', marke: 'Netzwerken', geaendert: '2026-10-01', ...x });
const bestand = (events: Event[] = [ev()]): CrmBestand => ({ ...leererBestand(), events });

describe('Anmeldestand', () => {
  it('der gesetzte gewinnt, sonst wird er aus dem Status abgeleitet — nie zurückgeschrieben', () => {
    expect(anmeldungVon({ status: 'geplant' })).toBe('geplant');
    expect(anmeldungVon({ status: 'durchgefuehrt' })).toBe('besucht');
    expect(anmeldungVon({ status: 'abgesagt' })).toBe('abgesagt');
    expect(anmeldungVon({ status: 'geplant', anmeldung: 'angemeldet' })).toBe('angemeldet');
    expect(anmeldungVon({ status: 'idee' })).toBe('geplant');
  });
  it('anmeldungPatch zieht den Status mit (Kalender-Spiegel, Heads, Kennzahlen lesen `status`)', () => {
    expect(anmeldungPatch('besucht')).toEqual({ anmeldung: 'besucht', status: 'durchgefuehrt' });
    expect(anmeldungPatch('abgesagt')).toEqual({ anmeldung: 'abgesagt', status: 'abgesagt' });
    expect(anmeldungPatch('angemeldet')).toEqual({ anmeldung: 'angemeldet', status: 'geplant' });
    expect(anmeldungPatch('geplant')).toEqual({ anmeldung: 'geplant', status: 'geplant' });
  });
  it('abgesagt zählt über Anmeldestand ODER Status', () => {
    expect(besuchAbgesagt({ status: 'geplant', anmeldung: 'abgesagt' })).toBe(true);
    expect(besuchAbgesagt({ status: 'abgesagt' })).toBe(true);
    expect(besuchAbgesagt({ status: 'geplant', anmeldung: 'angemeldet' })).toBe(false);
  });
  it('ein besuchtes Event ist eins mit der Marke Netzwerken — unsere Abende nicht', () => {
    expect(istBesuch({ marke: 'Netzwerken' })).toBe(true);
    expect(istBesuch({ marke: 'Make.One' })).toBe(false);
    expect(istBesuch({})).toBe(false);
  });
});

describe('Säuberung der neuen Felder (Längen, Kennungsformat)', () => {
  it('für wen: MAKE ist der Standard und wird nicht gespeichert; ein Kunde braucht eine gültige Firmenkennung', () => {
    expect(fuerSaeubern({ art: 'make' })).toBeUndefined();
    expect(fuerSaeubern(undefined)).toBeUndefined();
    expect(fuerSaeubern({ art: 'kunde', firmaId: 'f-beispielwerk' })).toEqual({ art: 'kunde', firmaId: 'f-beispielwerk' });
    expect(fuerSaeubern({ art: 'kunde', firmaId: 'beispielwerk' })).toBeUndefined();
    expect(fuerSaeubern({ art: 'kunde', firmaId: 'F-GROSS' })).toBeUndefined();
    expect(fuerSaeubern({ art: 'kunde', firmaId: 'f-beispielwerk', mandatId: 'm-1' })).toEqual({ art: 'kunde', firmaId: 'f-beispielwerk', mandatId: 'm-1' });
    expect(fuerSaeubern({ art: 'kunde', firmaId: 'f-beispielwerk', mandatId: '<script>' })).toEqual({ art: 'kunde', firmaId: 'f-beispielwerk' });
    expect(fuerVon({})).toEqual({ art: 'make' });
    expect(fuerFirmaId({ fuer: { art: 'kunde', firmaId: 'f-x1' } })).toBe('f-x1');
    expect(fuerFirmaId({})).toBeNull();
  });
  it('wer geht hin: nur Team-Kürzel, ohne „beide“ und Doppelte', () => {
    expect(werSaeubern(['kevin', 'malin', 'kevin', 'beide', 'fremd'])).toEqual(['kevin', 'malin']);
    expect(werSaeubern([])).toBeUndefined();
    expect(werSaeubern('kevin')).toBeUndefined();
  });
  it('Link: nur https, nie javascript:', () => {
    expect(linkSaeubern('https://beispiel.example/tickets')).toBe('https://beispiel.example/tickets');
    expect(linkSaeubern('javascript:alert(1)')).toBeUndefined();
    expect(linkSaeubern('http://unsicher.example')).toBe('http://unsicher.example');   // http ist erlaubt (Technik-Prüfung)
    expect(linkSaeubern('messe.example/programm')).toBe('https://messe.example/programm');   // ohne Schema: https davor
    expect(linkSaeubern('messe.example:8080/x')).toBe('https://messe.example:8080/x');       // ein Port ist kein Schema
    for (const schlecht of ['mailto:a@b.example', 'data:text/html,x', 'ftp://x.example/a', 'kein link', 'javascript:alert(1)//messe.example', 'http://', 'https://ohnepunkt']) expect(linkSaeubern(schlecht), schlecht).toBeUndefined();
    expect(linkSaeubern('https://mit leerzeichen.example')).toBeUndefined();
  });
  it('Zielpersonen: Person ODER Firma, gültige Kennung, ohne Doppelte, getroffen nur als true', () => {
    const l = zielpersonenSaeubern([
      { kontaktId: 'c-anna1', getroffen: true }, { kontaktId: 'c-anna1' }, { firmaId: 'f-werk1', getroffen: 'ja' }, { firmaId: 'kaputt' }, { kontaktId: 'x' }, {}, null, 'text',
    ]);
    expect(l).toEqual([{ kontaktId: 'c-anna1', getroffen: true }, { firmaId: 'f-werk1' }]);
    expect(zielpersonenSaeubern([])).toBeUndefined();
  });
  it('Übergabe-Protokoll: Tag, Person, Anzahl — sonst nichts', () => {
    expect(uebergabenSaeubern([{ am: '2026-10-03T08:00:00.000Z', von: 'kevin', anzahl: 4, kontakte: ['geheim'] }, { am: 'gestern', von: 'kevin', anzahl: 1 }, { am: '2026-10-03', von: 'Kevin Dieckmann', anzahl: 1 }]))
      .toEqual([{ am: '2026-10-03T08:00:00.000Z', von: 'kevin', anzahl: 4 }]);
  });
});

describe('Schreibkette des Bestands (saeubern, wendeCrmAn)', () => {
  it('der Säuberer behält die neuen Felder — ohne sie fielen sie bei jedem Speichern weg', () => {
    const e = saeubern('events', { ...ev(), fuer: { art: 'kunde', firmaId: 'f-werk1' }, anmeldung: 'angemeldet', wer: ['malin'], link: 'https://beispiel.example/x', zielpersonen: [{ kontaktId: 'c-anna1' }], uebergaben: [{ am: '2026-10-03', von: 'kevin', anzahl: 2 }] }, J, 'kevin')!;
    expect(e).toMatchObject({ fuer: { art: 'kunde', firmaId: 'f-werk1' }, anmeldung: 'angemeldet', wer: ['malin'], link: 'https://beispiel.example/x', zielpersonen: [{ kontaktId: 'c-anna1' }], uebergaben: [{ am: '2026-10-03', von: 'kevin', anzahl: 2 }], marke: 'Netzwerken' });
  });
  it('Altbestand: ein Event ohne die neuen Felder bekommt beim Speichern keine (kein Schlüssel mit undefined)', () => {
    const e = saeubern('events', { ...ev() }, J, 'kevin')!;
    for (const f of ['fuer', 'anmeldung', 'wer', 'link', 'zielpersonen', 'uebergaben']) expect(f in e, f).toBe(false);
  });
  it('Teil-Änderung: ändert nur dieses Feld, die anderen neuen Felder bleiben; `fuer: ""` nimmt den Kunden wieder weg', () => {
    const b0 = bestand([ev({ fuer: { art: 'kunde', firmaId: 'f-werk1' }, wer: ['kevin'], zielpersonen: [{ firmaId: 'f-werk1' }] })]);
    const r1 = wendeCrmAn(b0, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { anmeldung: 'besucht', status: 'durchgefuehrt' } }], J, 'kevin');
    expect(r1.bestand.events[0]).toMatchObject({ anmeldung: 'besucht', status: 'durchgefuehrt', fuer: { art: 'kunde', firmaId: 'f-werk1' }, wer: ['kevin'], zielpersonen: [{ firmaId: 'f-werk1' }] });
    const r2 = wendeCrmAn(r1.bestand, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { fuer: '', wer: [] } }], J, 'kevin');
    expect(r2.bestand.events[0].fuer).toBeUndefined();
    expect(r2.bestand.events[0].wer).toBeUndefined();
    expect(r2.bestand.events[0].zielpersonen).toEqual([{ firmaId: 'f-werk1' }]);
  });
  it('Obergrenze: zu viele Zielpersonen → ganze Änderung abgelehnt (413), nichts gekürzt', () => {
    const viele = Array.from({ length: ZIELPERSONEN_MAX + 1 }, (_, i) => ({ kontaktId: `c-p${i}` }));
    const r = wendeCrmAn(bestand(), [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { zielpersonen: viele } }], J, 'kevin');
    expect(r.grenze.join(' ')).toContain('zielpersonen');
    expect(r.bestand.events[0].zielpersonen).toBeUndefined();
  });
  it('Personen-Schranke: eine Person mit Einschränkung (Art. 18) kommt nie NEU auf die Zielliste; wer schon drinsteht, wird nicht rückwirkend abgelehnt', () => {
    const gesperrt = { id: 'c-gesperrt', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } };
    const frei = { id: 'c-frei' };
    const neu = wendeCrmAn(bestand(), [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { zielpersonen: [{ kontaktId: 'c-gesperrt' }, { kontaktId: 'c-frei' }] } }], J, 'kevin', undefined, [gesperrt, frei]);
    expect(neu.abgelehnt?.length).toBeGreaterThan(0);
    expect(neu.bestand.events[0].zielpersonen).toBeUndefined();
    const ok = wendeCrmAn(bestand(), [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { zielpersonen: [{ kontaktId: 'c-frei' }] } }], J, 'kevin', undefined, [gesperrt, frei]);
    expect(ok.abgelehnt).toBeUndefined();
    expect(ok.bestand.events[0].zielpersonen).toEqual([{ kontaktId: 'c-frei' }]);
    const schonDrin = bestand([ev({ zielpersonen: [{ kontaktId: 'c-gesperrt' }] })]);
    const spaeter = wendeCrmAn(schonDrin, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { zielpersonen: [{ kontaktId: 'c-gesperrt', getroffen: true }] } }], J, 'kevin', undefined, [gesperrt]);
    expect(spaeter.abgelehnt).toBeUndefined();
  });
  it('Löschsperre: eine Firma, für die ein Event läuft (oder die dort Zielfirma ist), wird nicht gelöscht', () => {
    const firma = { id: 'f-werk1', name: 'Beispielwerk GmbH', rolle: 'kunde', geaendert: J };
    const b = { ...bestand([ev({ fuer: { art: 'kunde', firmaId: 'f-werk1' } }), ev({ id: 'ev-2', zielpersonen: [{ firmaId: 'f-werk1' }] })]), firmen: [firma] } as unknown as CrmBestand;
    const s = loeschSperren(b, [{ liste: 'firmen', op: 'delete', id: 'f-werk1' }]);
    expect(s).toHaveLength(1);
    expect(s[0].anzahl.events).toBe(2);
    expect(s[0].text).toContain('2 Events');
    const ohne = loeschSperren({ ...b, events: [ev()] }, [{ liste: 'firmen', op: 'delete', id: 'f-werk1' }]);
    expect(ohne).toHaveLength(0);
  });
});

describe('Art. 15 / 17 / Zusammenführen: Zielpersonen stehen in der einen Stelle für Verweise (lib/crm/person-verweise.ts)', () => {
  const b = (): CrmBestand => bestand([ev({ zielpersonen: [{ kontaktId: 'c-alt', getroffen: true }, { kontaktId: 'c-x' }, { firmaId: 'f-werk1' }] }), ev({ id: 'ev-2', zielpersonen: [{ kontaktId: 'c-alt' }] }), ev({ id: 'ev-3' })]);
  it('Art. 17: die Kennung steht danach nirgends mehr; ein Event ohne Ziele behält kein leeres Feld', () => {
    const neu = personEntfernen(b(), 'c-alt');
    expect(JSON.stringify(neu)).not.toContain('c-alt');
    expect(neu.events[0].zielpersonen).toEqual([{ kontaktId: 'c-x' }, { firmaId: 'f-werk1' }]);
    expect('zielpersonen' in neu.events[1]).toBe(false);
    expect(neu.events[2]).toEqual(b().events[2]);
  });
  it('Zusammenführen: alt wird neu, ohne Doppelte, „getroffen“ bleibt', () => {
    const neu = personUmbiegen(b(), 'c-alt', 'c-x');
    expect(JSON.stringify(neu)).not.toContain('c-alt');
    expect(neu.events[0].zielpersonen).toEqual([{ kontaktId: 'c-x', getroffen: true }, { firmaId: 'f-werk1' }]);
    expect(neu.events[1].zielpersonen).toEqual([{ kontaktId: 'c-x' }]);
  });
  it('Art. 15: die Auskunft nennt, auf welchen Ziellisten die Person steht', () => {
    expect(personVerweise(b(), 'c-alt').eventZiele).toEqual([
      { id: 'ev-1', titel: 'Mittelstandstag Beispielstadt', datum: '2026-10-20', getroffen: true },
      { id: 'ev-2', titel: 'Mittelstandstag Beispielstadt', datum: '2026-10-20', getroffen: false },
    ]);
  });
});
