// Zu zweit: wer verschiedene Einträge ändert, verliert nichts.
import { describe, it, expect } from 'vitest';
import { aenderungen, wendeAn, leer } from '../lib/sync';

const basis = { posten: [{ id: 'a', titel: 'Miete', betrag: -1000 }, { id: 'b', titel: 'Retainer', betrag: 3000 }], notiz: 'x' };

describe('Einzeländerungen statt ganzem Stand', () => {
  it('erkennt Neues, Geändertes, Gelöschtes und Einzelfelder', () => {
    const neu = { posten: [{ id: 'a', titel: 'Miete', betrag: -1100 }, { id: 'c', titel: 'Neu', betrag: 50 }], notiz: 'y' };
    const a = aenderungen(basis, neu, ['posten']);
    expect(a.ops).toEqual([
      { liste: 'posten', op: 'upsert', eintrag: { id: 'a', titel: 'Miete', betrag: -1100 } },
      { liste: 'posten', op: 'upsert', eintrag: { id: 'c', titel: 'Neu', betrag: 50 } },
      { liste: 'posten', op: 'delete', id: 'b' },
    ]);
    expect(a.felder).toEqual({ notiz: 'y' });
    expect(leer(aenderungen(basis, basis, ['posten']))).toBe(true);
  });
  it('Kevin und Malin ändern gleichzeitig verschiedene Posten — beides kommt an', () => {
    const kevin = aenderungen(basis, { ...basis, posten: [{ ...basis.posten[0], betrag: -1200 }, basis.posten[1]] }, ['posten']);
    const malin = aenderungen(basis, { ...basis, posten: [basis.posten[0], { ...basis.posten[1], betrag: 3500 }] }, ['posten']);
    let server = basis.posten as Record<string, unknown>[];
    server = wendeAn(server, malin.ops).liste;
    server = wendeAn(server, kevin.ops).liste;
    expect(server).toEqual([{ id: 'a', titel: 'Miete', betrag: -1200 }, { id: 'b', titel: 'Retainer', betrag: 3500 }]);
  });
  it('ganzer Stand hätte Malins Änderung überschrieben (das alte Verhalten)', () => {
    const kevinsGanzerStand = [{ ...basis.posten[0], betrag: -1200 }, basis.posten[1]];
    expect(kevinsGanzerStand[1].betrag).toBe(3000); // Malins 3500 wäre weg
  });
  it('Monatsraster über ein anderes Schlüsselfeld', () => {
    const alt = { months: [{ m: 'Jan', umsatz: 0 }, { m: 'Feb', umsatz: 0 }] };
    const a = aenderungen(alt, { months: [{ m: 'Jan', umsatz: 5 }, { m: 'Feb', umsatz: 0 }] }, { months: 'm' });
    expect(a.ops).toEqual([{ liste: 'months', op: 'upsert', eintrag: { m: 'Jan', umsatz: 5 } }]);
    expect(wendeAn(alt.months, a.ops, 'm').liste).toEqual([{ m: 'Jan', umsatz: 5 }, { m: 'Feb', umsatz: 0 }]);
  });
});
