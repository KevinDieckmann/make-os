// Anmelde-Alarm (27.09.): neue Adresse und zu viele Fehlschläge — rein, ohne Telegram.
import { describe, it, expect } from 'vitest';
import { neueAdresse, zuVieleFehlschlaege, darfMelden, alarmeVergessen, textNeueAdresse, textFehlschlaege } from '../lib/zugang/anmelde-alarm';
import type { Anmeldung } from '../lib/zugang/anmeldungen';

const e = (min: number, ok: boolean, adresse = '10.0.0.x', speicher: string | null = 'kevin'): Anmeldung => ({ zeit: new Date(Date.parse('2026-09-27T08:00:00Z') + min * 60_000).toISOString(), speicher, art: 'anmelden', ok, adresse });

describe('Anmelde-Alarm', () => {
  it('neue Adresse: nur, wenn es schon erfolgreiche Anmeldungen gab und keine aus diesem Netz', () => {
    expect(neueAdresse([], 'kevin', '10.0.0.x')).toBe(false);
    expect(neueAdresse([e(-100, true)], 'kevin', '10.0.0.x')).toBe(false);
    expect(neueAdresse([e(-100, true)], 'kevin', '77.1.2.x')).toBe(true);
    // Fehlschläge zählen nicht als „bekannt“, andere Konten auch nicht
    expect(neueAdresse([e(-100, false, '77.1.2.x'), e(-90, true)], 'kevin', '77.1.2.x')).toBe(true);
    expect(neueAdresse([e(-100, true, '77.1.2.x', 'malin')], 'kevin', '77.1.2.x')).toBe(false);
  });
  it('Fehlschläge: Alarm bei 5 in 10 Minuten, dann bei 10, nicht bei 6', () => {
    const l = [e(-20, false), e(-9, false), e(-8, false), e(-7, false), e(-6, false)];
    expect(zuVieleFehlschlaege(l, 'kevin', '2026-09-27T08:00:00Z')).toMatchObject({ alarm: false, anzahl: 4 });
    const m = [...l, e(-1, false, '77.1.2.x')];
    expect(zuVieleFehlschlaege(m, 'kevin', '2026-09-27T08:00:00Z')).toMatchObject({ alarm: true, anzahl: 5, adressen: ['10.0.0.x', '77.1.2.x'] });
    expect(zuVieleFehlschlaege([...m, e(0, false)], 'kevin', '2026-09-27T08:00:00Z').alarm).toBe(false);
  });
  it('Ruhezeit je Schlüssel', () => {
    alarmeVergessen();
    const t0 = Date.parse('2026-09-27T08:00:00Z');
    expect(darfMelden('kevin:neu', t0)).toBe(true);
    expect(darfMelden('kevin:neu', t0 + 5 * 60_000)).toBe(false);
    expect(darfMelden('kevin:fehl', t0 + 5 * 60_000)).toBe(true);
    expect(darfMelden('kevin:neu', t0 + 31 * 60_000)).toBe(true);
  });
  it('Texte nennen Uhrzeit, Netz und den Weg', () => {
    expect(textNeueAdresse('77.1.2.x', '2026-09-27T08:05:00.000Z')).toContain('77.1.2.x');
    expect(textNeueAdresse('77.1.2.x', '2026-09-27T08:05:00.000Z')).toContain('alle anderen Geräte abmelden');
    expect(textFehlschlaege(5, ['a', 'b'], '2026-09-27T08:05:00.000Z')).toContain('5 falsche Passwörter');
  });
});
