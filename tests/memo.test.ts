// Zwischenspeicher für teure Berechnungen (26.09.): merken, teilen, nach Schreibung neu rechnen.
import { describe, it, expect } from 'vitest';
import { merken, standErhoehen, memoLeeren } from '../lib/store/memo';

describe('memo', () => {
  process.env.MAKE_OS_MEMO = 'an';
  it('rechnet einmal, teilt gleichzeitige Aufrufe und rechnet nach einer Schreibung neu', async () => {
    memoLeeren();
    let n = 0;
    const rechne = async () => { n++; await new Promise(r => setTimeout(r, 5)); return n; };
    const [a, b] = await Promise.all([merken('x', 10_000, rechne), merken('x', 10_000, rechne)]);
    expect(a).toBe(1); expect(b).toBe(1); expect(n).toBe(1);
    expect(await merken('x', 10_000, rechne)).toBe(1);
    standErhoehen();
    expect(await merken('x', 10_000, rechne)).toBe(2);
    // Schlüssel sind getrennt; ein Fehler wird nicht gemerkt
    await expect(merken('y', 10_000, async () => { throw new Error('kaputt'); })).rejects.toThrow('kaputt');
    expect(await merken('y', 10_000, async () => 7)).toBe(7);
    // abgelaufen
    expect(await merken('z', 0, rechne)).toBe(3);
    await new Promise(r => setTimeout(r, 2));
    expect(await merken('z', 0, rechne)).toBe(4);
  });

  // Prüfbericht 28.09.: Eine Rechnung, die VOR einem Schreiben begann, wurde unter dem NEUEN Stand gemerkt —
  // der nächste Aufruf bekam das veraltete Ergebnis, bis die TTL ablief.
  it('ein Ergebnis, dessen Rechnung vor einer Schreibung begann, gilt danach nicht als frisch', async () => {
    memoLeeren();
    let n = 0;
    let freigeben: () => void = () => {};
    const langsam = async () => { n++; const meins = n; await new Promise<void>(r => { freigeben = r; }); return `stand-${meins}`; };
    const erster = merken('k', 60_000, langsam);
    await new Promise(r => setTimeout(r, 0));
    standErhoehen('aufgaben');           // Schreibung WÄHREND der Rechnung
    freigeben();
    expect(await erster).toBe('stand-1'); // der Aufrufer bekommt sein Ergebnis …
    const zweiter = merken('k', 60_000, async () => { n++; return `stand-${n}`; });
    expect(await zweiter).toBe('stand-2'); // … aber der nächste rechnet neu
    expect(await merken('k', 60_000, async () => 'nie')).toBe('stand-2'); // und das neue Ergebnis wird gemerkt
  });

  it('eine ältere Rechnung überschreibt nie das Ergebnis einer jüngeren', async () => {
    memoLeeren();
    let alt: () => void = () => {};
    const erster = merken('j', 60_000, () => new Promise<string>(r => { alt = () => r('alt'); }));
    await new Promise(r => setTimeout(r, 0));
    standErhoehen('aufgaben');
    expect(await merken('j', 60_000, async () => 'jung')).toBe('jung');
    alt();
    expect(await erster).toBe('alt');
    expect(await merken('j', 60_000, async () => 'nie')).toBe('jung');
  });
});
