// Gemeinsamer Index-Speicher (26.09.): Verlauf, Trend und Ampel-Wechsel aus
// den Tages-Schnappschüssen, Schwellenprüfung und der Schutz des Speichernamens.
// Reine Funktionen — der Dateizugriff (fortschreiben, speichereSchwelle) ist
// nur eine dünne Hülle darum.
import { describe, it, expect } from 'vitest';
import { berechneModell, type KennzahlDefBasis, type SaeuleDef } from '../lib/kennzahlen/kern';
import { verlaufAus, tagVon, schwellePruefen, indexName, type IndexDatei } from '../lib/kennzahlen/speicher';

const SAEULEN: SaeuleDef[] = [{ id: 'a', label: 'A', gewicht: 1, satz: '' }];
const KENNZAHLEN: KennzahlDefBasis[] = [
  { id: 'hoch', label: 'Hoch', saeule: 'a', gruppe: 'g', einheit: 'anzahl', richtung: 'hoch', gruen: 10, rot: 5, formel: '', quelle: '', luecke: '' },
  { id: 'niedrig', label: 'Niedrig', saeule: 'a', gruppe: 'g', einheit: 'anzahl', richtung: 'niedrig', gruen: 1, rot: 3, formel: '', quelle: '', luecke: '' },
];
const rechne = (hoch: number | null, niedrig: number, heute: string) => berechneModell<{ h: number | null; n: number }>({
  saeulen: SAEULEN, kennzahlen: KENNZAHLEN, bestand: { h: hoch, n: niedrig }, stand: heute, scope: 'test',
  messen: { hoch: b => (b.h == null ? { luecke: 'fehlt' } : { wert: b.h, anzeige: String(b.h), quelle: '' }), niedrig: b => ({ wert: b.n, anzeige: String(b.n), quelle: '' }) },
});

describe('Index-Speicher', () => {
  it('tagVon hält Index, Säulen, Werte und Ampeln fest', () => {
    const t = tagVon(rechne(12, 0, '2026-09-25'));
    expect(t).toEqual({ index: 100, saeulen: { a: 100 }, werte: { hoch: 12, niedrig: 0 }, ampeln: { hoch: 'gruen', niedrig: 'gruen' } });
  });

  it('verlaufAus: 90 Tage Verlauf plus heute, Vergleich zu vor 30 Tagen, Ampel-Wechsel seit dem letzten Schnappschuss', () => {
    const d: IndexDatei = { schwellen: {}, tage: {} };
    for (let i = 1; i <= 120; i++) {
      const dd = new Date('2026-09-25T12:00:00Z'); dd.setUTCDate(dd.getUTCDate() - i);
      d.tage[dd.toISOString().slice(0, 10)] = tagVon(rechne(i <= 30 ? 12 : 6, i === 1 ? 0 : 2, dd.toISOString().slice(0, 10)));
    }
    const v = verlaufAus(d, rechne(12, 4, '2026-09-25'), '2026-09-25');
    expect(v.verlauf).toHaveLength(91);
    expect(v.verlauf.at(-1)).toMatchObject({ tag: '2026-09-25', index: 55 });   // hoch 12 → 100 · niedrig 4 (halbe Breite jenseits von Rot) → 10 · Mittel 55
    expect(v.vor30).toBe(d.tage['2026-08-26'].index);
    expect(v.wechsel).toEqual([{ id: 'niedrig', von: 'gruen', nach: 'rot', seit: '2026-09-24' }]);
    // Grau zählt nie als Wechsel — eine Lücke ist kein Umschlag.
    expect(verlaufAus(d, rechne(null, 0, '2026-09-25'), '2026-09-25').wechsel).toEqual([]);
    // Ohne Vergangenheit: nur heute, kein Vergleich.
    expect(verlaufAus({ schwellen: {}, tage: {} }, rechne(12, 0, '2026-09-25'), '2026-09-25')).toMatchObject({ vor30: null, wechsel: [] });
  });

  it('schwellePruefen: bekannte Kennzahl, Zahlen (auch deutsch), richtige Reihenfolge, zurücksetzen', () => {
    expect(schwellePruefen(KENNZAHLEN, { id: 'gibtsnicht', gruen: 1, rot: 0 })).toEqual({ ok: false, fehler: 'Unbekannte Kennzahl.' });
    expect(schwellePruefen(KENNZAHLEN, { id: 'hoch', gruen: '12,5', rot: '7' })).toEqual({ ok: true, id: 'hoch', schwelle: { gruen: 12.5, rot: 7 } });
    expect(schwellePruefen(KENNZAHLEN, { id: 'hoch', gruen: 5, rot: 10 })).toMatchObject({ ok: false, fehler: expect.stringContaining('Grün muss über Rot') });
    expect(schwellePruefen(KENNZAHLEN, { id: 'niedrig', gruen: 4, rot: 2 })).toMatchObject({ ok: false, fehler: expect.stringContaining('Grün muss unter Rot') });
    expect(schwellePruefen(KENNZAHLEN, { id: 'niedrig', gruen: 'x', rot: 2 })).toEqual({ ok: false, fehler: 'Grün und Rot bitte als Zahl.' });
    expect(schwellePruefen(KENNZAHLEN, { id: 'niedrig', zuruecksetzen: true })).toEqual({ ok: true, id: 'niedrig', schwelle: null });
  });

  it('indexName lässt nur einfache Namen durch — kein Pfad, kein Punkt, keine Großbuchstaben', () => {
    expect(indexName('traktion-index')).toBe('traktion-index');
    expect(indexName('gesundheit-index--test')).toBe('gesundheit-index--test');
    for (const s of ['../x', 'a.b', 'A', '', '-a', 'a/b', 'a'.repeat(81)]) expect(() => indexName(s), s).toThrow();
  });
});
