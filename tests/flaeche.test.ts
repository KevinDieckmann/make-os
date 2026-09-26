// Flächen (26.09.): Standard + gespeicherter Stand zusammenführen, Schritte, Säubern.
import { describe, it, expect } from 'vitest';
import { anwenden, wende, sauberLayout, ausgeblendet, istStandard, type StandardPlatz, type Layout } from '../lib/flaeche/modell';

const STD: StandardPlatz[] = [
  { id: 'aufgaben', art: 'aufgaben', breite: 4 }, { id: 'fokus', art: 'fokus', breite: 2 },
  { id: 'termine', art: 'termine', breite: 4 }, { id: 'koerper', art: 'koerper', breite: 2 },
];
const J = '2026-09-26T10:00:00.000Z';

describe('Flächen-Modell', () => {
  it('ohne Speicherstand ist der Standard das Layout — und gilt als Standard', () => {
    const l = anwenden(STD, null);
    expect(l.plaetze.map(p => [p.id, p.art, p.breite])).toEqual([['aufgaben', 'aufgaben', 4], ['fokus', 'fokus', 2], ['termine', 'termine', 4], ['koerper', 'koerper', 2]]);
    expect(istStandard(l, STD)).toBe(true);
  });

  it('verschieben, Breite, ausblenden/einblenden, Widget hinzufügen und entfernen', () => {
    let l = anwenden(STD, null);
    l = wende(l, { op: 'verschieben', id: 'koerper', vorId: 'aufgaben' }, STD, J);
    expect(l.plaetze.map(p => p.id)).toEqual(['koerper', 'aufgaben', 'fokus', 'termine']);
    l = wende(l, { op: 'verschieben', id: 'koerper', vorId: null }, STD, J);
    expect(l.plaetze.map(p => p.id)).toEqual(['aufgaben', 'fokus', 'termine', 'koerper']);
    expect(wende(l, { op: 'verschieben', id: 'gibtsnicht', vorId: null }, STD, J)).toBe(l);
    l = wende(l, { op: 'breite', id: 'fokus', breite: 6 }, STD, J);
    expect(l.plaetze.find(p => p.id === 'fokus')?.breite).toBe(6);
    expect(istStandard(l, STD)).toBe(false);
    // feste Karte ausblenden → merkt sich; Widget aus dem Katalog → einfach weg
    l = wende(l, { op: 'ausblenden', id: 'termine' }, STD, J);
    expect(l.plaetze.map(p => p.id)).toEqual(['aufgaben', 'fokus', 'koerper']);
    expect(l.versteckt).toEqual(['termine']);
    expect(ausgeblendet(l, STD).map(x => x.id)).toEqual(['termine']);
    l = wende(l, { op: 'hinzufuegen', art: 'index', breite: 2, einstellungen: { saeule: 'gesundheit' }, id: 'w-index-1' }, STD, J);
    expect(l.plaetze.at(-1)).toMatchObject({ id: 'w-index-1', art: 'index', breite: 2, einstellungen: { saeule: 'gesundheit' } });
    l = wende(l, { op: 'einstellen', id: 'w-index-1', einstellungen: { saeule: 'business' }, titel: 'Business heute' }, STD, J);
    expect(l.plaetze.at(-1)).toMatchObject({ einstellungen: { saeule: 'business' }, titel: 'Business heute' });
    l = wende(l, { op: 'ausblenden', id: 'w-index-1' }, STD, J);
    expect(l.plaetze.some(p => p.id === 'w-index-1')).toBe(false);
    expect(l.versteckt).toEqual(['termine']);
    // einblenden setzt die Karte an ihre Standardstelle (nach fokus)
    l = wende(l, { op: 'einblenden', id: 'termine' }, STD, J);
    expect(l.plaetze.map(p => p.id)).toEqual(['aufgaben', 'fokus', 'termine', 'koerper']);
    expect(l.versteckt).toEqual([]);
    expect(wende(l, { op: 'zuruecksetzen' }, STD, J).plaetze.map(p => p.breite)).toEqual([4, 2, 4, 2]);
  });

  it('Standard entwickelt sich weiter: neue feste Karten rutschen an ihre Stelle, weggefallene verschwinden', () => {
    const gespeichert: Layout = { plaetze: [{ id: 'koerper', art: 'koerper', breite: 6, einstellungen: {} }, { id: 'alt', art: 'seite', breite: 3, einstellungen: {} }, { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: {} }, { id: 'w-index-1', art: 'index', breite: 2, einstellungen: {} }], versteckt: ['fokus', 'nichtmehr'], stand: J };
    const l = anwenden(STD, gespeichert);
    // termine ist neu → nach fokus (ausgeblendet) bzw. nach aufgaben (dem vorigen sichtbaren Standard-Nachbarn)
    expect(l.plaetze.map(p => p.id)).toEqual(['koerper', 'aufgaben', 'termine', 'w-index-1']);
    expect(l.versteckt).toEqual(['fokus']);
    expect(l.plaetze[0].breite).toBe(6);
  });

  it('säubert fremde Eingaben', () => {
    const l = sauberLayout({ plaetze: [{ id: 'a b', art: 'x' }, { id: 'ok', art: 'seite', breite: 5, einstellungen: { n: 3, t: 'x'.repeat(500), o: {} } }, { id: 'ok', art: 'seite' }], versteckt: ['ok', 'ok', '<script>'], stand: 5 });
    expect(l.plaetze).toHaveLength(1);
    expect(l.plaetze[0]).toMatchObject({ id: 'ok', breite: 3, einstellungen: { n: 3 } });
    expect((l.plaetze[0].einstellungen.t as string).length).toBe(400);
    expect(l.versteckt).toEqual(['ok']);
    expect(l.stand).toBe('5');
  });
});
