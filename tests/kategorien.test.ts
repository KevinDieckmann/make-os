// Kategorien aufräumen: Schreibvarianten und Synonyme finden, beim Anwenden
// nichts verlieren (Buchungen, Regeln umhängen, Alias merken).
import { describe, it, expect } from 'vitest';
import { vorschlag, anwenden, ungenutzt } from '../lib/finanzen/haushalt/kategorien';
import { katNamen } from '../lib/finanzen/haushalt/einordnung';
import type { Buchung, Kategorie, Stamm } from '../lib/finanzen/haushalt/typen';

const k = (id: string, name: string, typ: Kategorie['typ'] = 'ausgabe'): Kategorie => ({ id, stand: 1, name, typ, sortierung: 1, monatsbudget: null });
const b = (id: string, kat: string | null) => ({ id, stand: 1, kategorie_id: kat } as unknown as Buchung);
const stamm: Stamm = {
  konten: [], aliase: {},
  kategorien: [k('m1', 'Mobilität'), k('m2', 'Mobilitaet'), k('t1', 'Tilgung'), k('t2', 'Kredit & Raten'), k('e1', 'Essen auswärts'), k('leer', 'Alt & leer'), k('g', 'Gehalt', 'einnahme')],
  regeln: [{ id: 'r1', stand: 1, muster: 'Bahn', empfaenger: 'Bahn', kategorie_id: 'm2', ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', ganzes_wort: true, prioritaet: 100, treffer_zaehler: 0 }],
};
const buchungen = [b('x1', 'm1'), b('x2', 'm1'), b('x3', 'm2'), b('x4', 't2'), b('x5', 'e1')];

describe('Kategorien aufräumen', () => {
  it('findet Schreibvarianten und Synonyme', () => {
    const v = vorschlag(stamm, buchungen);
    expect(v.map(x => `${x.vonName}→${x.nachName}`).sort()).toEqual(['Kredit & Raten→Tilgung', 'Mobilitaet→Mobilität']);
  });
  it('hängt Buchungen und Regeln um, merkt den Alias, verliert nichts', () => {
    const e = anwenden(stamm, buchungen, [{ von: 'm2', nach: 'm1' }, { von: 't2', nach: 't1' }], 'j');
    expect(e.buchungen.map(x => x.kategorie_id)).toEqual(['m1', 'm1', 'm1', 't1', 'e1']);
    expect(e.stamm.regeln[0].kategorie_id).toBe('m1');
    expect(e.stamm.kategorien.map(x => x.id)).toEqual(['m1', 't1', 'e1', 'leer', 'g']);
    expect(katNamen(e.stamm)('m2')).toBe('Mobilität');
    expect(e.geaendert).toBe(2);
  });
  it('leere Kategorien ohne Nutzen werden gezeigt — Einnahme-Arten nie', () => {
    expect(ungenutzt(stamm, buchungen).map(x => x.id)).toEqual(['t1', 'leer']);
  });
});
