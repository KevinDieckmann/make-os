// Stand-Prüfung und Zugriff für die Haushaltsfinanzen: wer eine veraltete
// Zeile speichert, bekommt einen Konflikt; ohne ausdrücklich benannte Person
// gibt es keinen Zugang — auch nicht über den Rückfall auf „kevin“.

import { describe, it, expect } from 'vitest';
import { opsAnwenden, sauberBeleg, Ungueltig, speicherName } from '../lib/finanzen/haushalt/speicher';
import { personStreng } from '../lib/finanzen/haushalt/zugriff';
import type { Zeile } from '../lib/finanzen/haushalt/typen';

type T = Zeile & { name: string };
const sauber = (r: Record<string, unknown>) => ({ name: String(r.name ?? '') });
const liste: T[] = [{ id: 'a', stand: 3, name: 'eins' }, { id: 'b', stand: 1, name: 'zwei' }];
const J = '2026-09-24T00:00:00Z';

describe('Stand-Prüfung', () => {
  it('ändert mit aktuellem Stand und zählt hoch', () => {
    const e = opsAnwenden<T>(liste, [{ op: 'upsert', eintrag: { id: 'a', name: 'neu' }, stand: 3 }], sauber, J);
    expect(e.ok).toBe(true);
    expect(e.ok && e.liste!.find(x => x.id === 'a')).toEqual({ id: 'a', stand: 4, name: 'neu' });
  });
  it('lehnt einen veralteten Stand ab — alles oder nichts', () => {
    const e = opsAnwenden<T>(liste, [{ op: 'upsert', eintrag: { id: 'b', name: 'ok' }, stand: 1 }, { op: 'upsert', eintrag: { id: 'a', name: 'alt' }, stand: 2 }], sauber, J);
    expect(e.ok).toBe(false);
    if (!e.ok) { expect(e.status).toBe(409); expect(e.konflikte?.[0]).toMatchObject({ id: 'a', grund: 'inzwischen geändert' }); }
  });
  it('Löschen braucht den aktuellen Stand; Gelöschtes meldet sich', () => {
    expect(opsAnwenden<T>(liste, [{ op: 'delete', id: 'a', stand: 1 }], sauber, J).ok).toBe(false);
    const e = opsAnwenden<T>(liste, [{ op: 'delete', id: 'a', stand: 3 }], sauber, J);
    expect(e.ok && e.liste!.map(x => x.id)).toEqual(['b']);
    expect(opsAnwenden<T>(liste, [{ op: 'upsert', eintrag: { id: 'weg', name: 'x' }, stand: 2 }], sauber, J).ok).toBe(false);
  });
  it('neue Zeilen bekommen eine Kennung und Stand 1', () => {
    const e = opsAnwenden<T>(liste, [{ op: 'upsert', eintrag: { name: 'drei' } }], sauber, J);
    expect(e.ok && e.zeilen[0]).toMatchObject({ stand: 1, name: 'drei' });
  });
  it('mehr als die Hälfte auf einmal löschen wird abgelehnt', () => {
    const viele: T[] = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, stand: 1, name: `${i}` }));
    const e = opsAnwenden<T>(viele, viele.slice(0, 7).map(x => ({ op: 'delete' as const, id: x.id, stand: 1 })), sauber, J);
    expect(e.ok).toBe(false);
  });
  it('unbekannte Einheit wird abgewiesen, alte Namen werden vereinheitlicht', () => {
    expect(() => sauberBeleg({ bezeichnung: 'x', einheit: 'kemaris' })).toThrow(Ungueltig);
    expect(sauberBeleg({ bezeichnung: 'x', einheit: 'selbst' }).einheit).toBe('selbststaendigkeit');
  });
});

describe('Zugriff ohne Rückfall', () => {
  it('ohne Sitzung und ohne benannte Person: niemand', () => {
    expect(personStreng(new Request('http://x/api/haushalt'))).toBeNull();
    expect(personStreng(new Request('http://x/', { headers: { 'x-make-person': 'malin' } }))).toBe('malin');
    expect(personStreng(new Request('http://x/', { headers: { 'x-make-user': '../etc' } }))).toBeNull();
  });
  it('Speichernamen je Haushalt, nie aus fremder Eingabe', () => {
    expect(speicherName('buchungen', 'kevin-malin')).toBe('haushalt-buchungen--kevin-malin');
    expect(() => speicherName('buchungen', '../x')).toThrow();
  });
});
