// Priorität per Pfeil: stabil sortiert, Rang gespeichert, Verschieben nur innerhalb der sichtbaren Teilmenge.

import { describe, expect, it } from 'vitest';
import { sortiertNachRang, mitRang, verschiebe, offenErledigt, naechsterRang } from '@/lib/planung/rang';

const l = [
  { id: 'a', rang: 2 },
  { id: 'b' },
  { id: 'c', rang: 1 },
  { id: 'd' },
];

describe('Sortierung', () => {
  it('nach Rang, ohne Rang hinten in Anlage-Reihenfolge (stabil)', () => {
    expect(sortiertNachRang(l).map(x => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('gleiche Ränge bleiben in ihrer Reihenfolge', () => {
    expect(sortiertNachRang([{ id: 'x', rang: 1 }, { id: 'y', rang: 1 }, { id: 'z', rang: 1 }]).map(x => x.id)).toEqual(['x', 'y', 'z']);
  });
  it('mitRang vergibt lückenlos 1..n', () => {
    expect(mitRang(sortiertNachRang(l)).map(x => x.rang)).toEqual([1, 2, 3, 4]);
  });
});

describe('Verschieben', () => {
  it('eine Stelle nach oben — alle bekommen einen Rang', () => {
    const neu = verschiebe(l, 'b', 'auf');
    expect(sortiertNachRang(neu).map(x => x.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(neu.every(x => Number.isInteger(x.rang))).toBe(true);
  });
  it('am Anfang nach oben oder am Ende nach unten ändert nichts', () => {
    expect(verschiebe(l, 'c', 'auf')).toEqual(l);
    expect(verschiebe(l, 'd', 'ab')).toEqual(l);
    expect(verschiebe(l, 'gibt-es-nicht', 'ab')).toEqual(l);
  });
  it('innerhalb einer Teilmenge (z. B. nur offene im Filter) überspringt fremde Einträge', () => {
    // sichtbar: a, d (b und c ausgeblendet). d nach oben → vor a, b und c behalten ihren Platz relativ.
    const neu = verschiebe(l, 'd', 'auf', ['a', 'd']);
    const reihe = sortiertNachRang(neu).map(x => x.id);
    expect(reihe.indexOf('d')).toBeLessThan(reihe.indexOf('a'));
    expect(reihe.filter(id => id === 'b' || id === 'c')).toEqual(['c', 'b']);
  });
});

describe('Offen und erledigt', () => {
  it('trennt und sortiert beide Teile', () => {
    const { offen, erledigt } = offenErledigt([{ id: 'a', rang: 2, erledigt: true }, { id: 'b', rang: 1 }, { id: 'c', rang: 3 }]);
    expect(offen.map(x => x.id)).toEqual(['b', 'c']);
    expect(erledigt.map(x => x.id)).toEqual(['a']);
  });
  it('nächster Rang hängt hinten an', () => {
    expect(naechsterRang(l)).toBe(3);
    expect(naechsterRang([])).toBe(1);
  });
});
