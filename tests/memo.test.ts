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
});
