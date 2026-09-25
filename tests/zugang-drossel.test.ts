// Bremse gegen Passwort-Raten (25.09.): fünf Fehlversuche frei, dann wachsende Wartezeit.
import { describe, it, expect, beforeEach } from 'vitest';
import { pruefe, fehlschlag, erfolg, adresse, _zuruecksetzen } from '../lib/zugang/drossel';

beforeEach(() => _zuruecksetzen());

describe('Drossel', () => {
  it('fünf Fehlversuche frei, dann 30 s, dann 60 s — höchstens 15 Minuten', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) fehlschlag('ip:1', t);
    expect(pruefe('ip:1', t).erlaubt).toBe(true);
    fehlschlag('ip:1', t);
    expect(pruefe('ip:1', t)).toEqual({ erlaubt: false, warteSek: 30 });
    expect(pruefe('ip:1', t + 31_000).erlaubt).toBe(true);
    fehlschlag('ip:1', t + 31_000);
    expect(pruefe('ip:1', t + 31_000).warteSek).toBe(60);
    for (let i = 0; i < 20; i++) fehlschlag('ip:2', t);
    expect(pruefe('ip:2', t).warteSek).toBe(900);
  });
  it('ein Erfolg setzt zurück; nach dem Fenster beginnt es neu; Schlüssel sind getrennt', () => {
    const t = 5_000_000;
    for (let i = 0; i < 6; i++) fehlschlag('mail:a', t);
    expect(pruefe('mail:b', t).erlaubt).toBe(true);
    erfolg('mail:a');
    expect(pruefe('mail:a', t).erlaubt).toBe(true);
    for (let i = 0; i < 3; i++) fehlschlag('mail:c', t);
    fehlschlag('mail:c', t + 16 * 60_000);
    for (let i = 0; i < 4; i++) fehlschlag('mail:c', t + 16 * 60_000);
    expect(pruefe('mail:c', t + 16 * 60_000).erlaubt).toBe(true);
  });
  it('Adresse: der letzte Eintrag in X-Forwarded-For (den setzt der eigene Vorbau)', () => {
    expect(adresse(new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' } }))).toBe('203.0.113.9');
    expect(adresse(new Request('http://x'))).toBe('unbekannt');
  });
});
