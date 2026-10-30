// Flächen (26.09.): Standard + gespeicherter Stand zusammenführen, Schritte, Säubern.
import { describe, it, expect } from 'vitest';
import { anwenden, wende, sauberLayout, ausgeblendet, istStandard, mitAbwesendenKarten, type StandardPlatz, type Layout } from '../lib/flaeche/modell';

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

  it('feste Karten mit Titel im Standard gelten als Standard — erst eine Änderung macht sie zum eigenen Layout (27.09.)', () => {
    const mitTitel: StandardPlatz[] = [{ id: 'head', art: 'seite', breite: 6, titel: 'Head of Sales' }, { id: 'trichter', art: 'seite', breite: 3, titel: 'Sales-Trichter' }];
    const l = anwenden(mitTitel, null);
    expect(l.plaetze.map(p => p.titel)).toEqual(['Head of Sales', 'Sales-Trichter']);
    expect(istStandard(l, mitTitel)).toBe(true);
    expect(istStandard(wende(l, { op: 'breite', id: 'trichter', breite: 6 }, mitTitel, J), mitTitel)).toBe(false);
    expect(istStandard(wende(l, { op: 'einstellen', id: 'trichter', titel: 'Mein Trichter' }, mitTitel, J), mitTitel)).toBe(false);
  });

  it('säubert fremde Eingaben', () => {
    const l = sauberLayout({ plaetze: [{ id: 'a b', art: 'x' }, { id: 'ok', art: 'seite', breite: 5, einstellungen: { n: 3, t: 'x'.repeat(500), o: {} } }, { id: 'ok', art: 'seite' }], versteckt: ['ok', 'ok', '<script>'], stand: 5 });
    expect(l.plaetze).toHaveLength(1);
    expect(l.plaetze[0]).toMatchObject({ id: 'ok', breite: 3, einstellungen: { n: 3 } });
    expect((l.plaetze[0].einstellungen.t as string).length).toBe(400);
    expect(l.versteckt).toEqual(['ok']);
    expect(l.stand).toBe('5');
  });

  // 30.10. (Kevin: „bei Gesundheit extrem aufgefallen“): Karten, die die Seite nur unter einer Bedingung zeigt (Werte geladen, eigene Ansicht),
  // verloren beim Anpassen ohne sie ihren Platz — und ausgeblendete kamen wieder.
  it('Karten, die gerade fehlen, behalten beim Speichern Platz, Breite und „ausgeblendet“', () => {
    const voll: StandardPlatz[] = [{ id: 'a', breite: 3 }, { id: 'schlaf', breite: 3 }, { id: 'b', breite: 3 }, { id: 'werte', breite: 3 }];
    let alt = wende(anwenden(voll, null), { op: 'breite', id: 'schlaf', breite: 6 }, voll, J);
    alt = wende(alt, { op: 'verschieben', id: 'schlaf', vorId: 'a' }, voll, J);
    alt = wende(alt, { op: 'ausblenden', id: 'werte' }, voll, J);
    expect(alt.plaetze.map(p => p.id)).toEqual(['schlaf', 'a', 'b']);
    // Ansicht ohne „schlaf“ und „werte“ (Bedingung nicht erfüllt): jemand verschiebt b nach vorn
    const ohne: StandardPlatz[] = [{ id: 'a', breite: 3 }, { id: 'b', breite: 3 }];
    const gezeigt = anwenden(ohne, alt);
    expect(gezeigt.plaetze.map(p => p.id)).toEqual(['a', 'b']);
    const neu = wende(gezeigt, { op: 'verschieben', id: 'b', vorId: 'a' }, ohne, J);
    const gespeichert = mitAbwesendenKarten(neu, alt, ohne);
    expect(gespeichert.plaetze.map(p => p.id)).toEqual(['schlaf', 'b', 'a']);
    expect(gespeichert.versteckt).toEqual(['werte']);
    // kommt die Bedingung zurück, steht „schlaf“ breit an seiner Stelle und „werte“ bleibt ausgeblendet
    const wieder = anwenden(voll, gespeichert);
    expect(wieder.plaetze.map(p => [p.id, p.breite])).toEqual([['schlaf', 6], ['b', 3], ['a', 3]]);
    expect(wieder.versteckt).toEqual(['werte']);
    // ohne bisherigen Stand und ohne fehlende Karten: unverändert dasselbe Objekt
    expect(mitAbwesendenKarten(neu, null, ohne)).toBe(neu);
    expect(mitAbwesendenKarten(neu, neu, ohne)).toBe(neu);
    // Widgets aus dem Katalog bleiben ohnehin im Layout — hier geht es nur um feste Karten
    const mitWidget: Layout = { ...alt, plaetze: [...alt.plaetze, { id: 'w-x', art: 'aufgaben', breite: 2, einstellungen: {} }] };
    expect(mitAbwesendenKarten(wende(anwenden(ohne, mitWidget), { op: 'breite', id: 'a', breite: 6 }, ohne, J), mitWidget, ohne).plaetze.filter(p => p.id === 'w-x')).toHaveLength(1);
  });
});
