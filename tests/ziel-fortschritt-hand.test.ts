// ─── Ziel-Fortschritt über Unterziele/Elternziel überschreibt nie einen Wert von Hand (16.10., Update-Probe) ─────────────────
// C17 (Abnahme 2) zieht den Fortschritt auch aus Unterzielen bzw. dem Elternziel nach. Live können Ziele einen von Hand gesetzten
// Fortschritt tragen — der bleibt. Nachgezogen wird nur 0 (nie gesetzt) oder der zuletzt vom Server gesetzte Wert (`fortschrittAuto`).
import { describe, it, expect } from 'vitest';
import { zieleFortschrittAnwenden } from '@/lib/planung/meilenstein-aufgaben';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';

const z = (id: string, f: number, extra: Partial<Ziel> = {}): Ziel => ({ id, titel: id, fortschritt: f, erledigt: false, ...extra });
const ms = (id: string, zielId: string, f: number) => ({ id, titel: id, zielId, fortschritt: f, erledigt: false }) as unknown as Meilenstein;

describe('Ziel-Fortschritt: Wert von Hand bleibt', () => {
  it('Oberziel mit Unterziel: 0 wird nachgezogen und als automatisch gemerkt', () => {
    const r = zieleFortschrittAnwenden([z('o', 0), z('u', 50, { oberzielId: 'o' })], []);
    expect(r.liste[0]).toMatchObject({ fortschritt: 50, fortschrittAuto: 50 });
  });
  it('Oberziel mit Wert von Hand: bleibt', () => {
    const r = zieleFortschrittAnwenden([z('o', 70), z('u', 50, { oberzielId: 'o' })], []);
    expect(r.liste[0].fortschritt).toBe(70);
    expect(r.geaendert).toBe(0);
  });
  it('zuletzt automatisch gesetzt: zieht weiter nach', () => {
    const r = zieleFortschrittAnwenden([z('o', 50, { fortschrittAuto: 50 }), z('u', 80, { oberzielId: 'o' })], []);
    expect(r.liste[0]).toMatchObject({ fortschritt: 80, fortschrittAuto: 80 });
  });
  it('abgeleitetes Ziel mit Wert von Hand: folgt dem Elternziel nicht', () => {
    const r = zieleFortschrittAnwenden([z('j~monat', 40, { abgeleitetVon: 'j' })], [], new Map([['j', 33]]));
    expect(r.liste[0].fortschritt).toBe(40);
  });
  it('abgeleitetes Ziel ohne Wert: folgt dem Elternziel', () => {
    const r = zieleFortschrittAnwenden([z('j~monat', 0, { abgeleitetVon: 'j' })], [], new Map([['j', 33]]));
    expect(r.liste[0].fortschritt).toBe(33);
  });
  it('mit Meilensteinen wie bisher: immer der Mittelwert', () => {
    const r = zieleFortschrittAnwenden([z('m', 90)], [ms('a', 'm', 20), ms('b', 'm', 40)]);
    expect(r.liste[0].fortschritt).toBe(30);
  });
});

describe('Kaskade: der Merker „automatisch“ bleibt beim Nachziehen (18.10., Update-Probe)', () => {
  it('ein abgeleitetes Ziel behält fortschrittAuto — der nächste Elternwert zieht weiter mit', async () => {
    const { abgeleitetesZiel } = await import('@/lib/planung/kaskade');
    const jahr = z('j', 33, { zielwert: 120000, einheit: '€', titel: 'Umsatz' });
    const bisher = z('j~quartal', 33, { abgeleitetVon: 'j', fortschrittAuto: 33 });
    const neu = abgeleitetesZiel(jahr, 'quartal', 2026, bisher);
    expect(neu).toMatchObject({ fortschritt: 33, fortschrittAuto: 33 });
    // Danach ändert sich das Elternziel: der Wert zieht mit, weil er automatisch gesetzt war.
    const r = zieleFortschrittAnwenden([neu], [], new Map([['j', 50]]));
    expect(r.liste[0]).toMatchObject({ fortschritt: 50, fortschrittAuto: 50 });
    // Ein von Hand gesetzter Wert (ohne Merker) bleibt weiter stehen.
    const hand = abgeleitetesZiel(jahr, 'quartal', 2026, z('j~quartal', 20, { abgeleitetVon: 'j' }));
    expect(hand).not.toHaveProperty('fortschrittAuto');
    expect(zieleFortschrittAnwenden([hand], [], new Map([['j', 50]])).liste[0].fortschritt).toBe(20);
  });
});
