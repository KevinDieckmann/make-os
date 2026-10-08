// ─── Routinen der anderen Person nur „Belegt“ (08.10., Kevin) — die reine Filter- und Schreibregel ─────────────────────
// Erfundene Werte. Wächter mit Routen: tests/messlatte-malin.test.ts.
import { describe, it, expect } from 'vitest';
import { routinenFuerBetrachter, routineBelegt, routinenSchreibPruefen, routinenVollSchreiben, ROUTINE_FREMD, ROUTINE_BELEGT, sauberRoutine } from '@/lib/planung/routinen';
import type { Routine } from '@/lib/planung/typen';

const r = (id: string, owner: string | undefined, extra: Partial<Routine> = {}): Routine =>
  ({ id, label: `Titel-${id}`, wann: 'abend', kategorie: 'gesundheit', dauerMin: 20, aktiv: true, ...(owner ? { owner } : {}), ...extra });
const A = r('a', 'person-a', { rhythmus: 'monatlich', naechstesMal: '2026-11-02', rang: 3, space: 'business', einheit: 'Einheit X' });
const B = r('b', 'person-b');
const G = r('g', 'beide');
const ALT = r('x-alt', undefined); // Altbestand ohne owner = gemeinsam

describe('routinenFuerBetrachter', () => {
  it('fremde verdeckt, eigene/gemeinsame/Altbestand voll; Systemlauf (null) unverändert', () => {
    const l = routinenFuerBetrachter([A, B, G, ALT], 'person-b');
    expect(l[1]).toBe(B);
    expect(l[2]).toBe(G);
    expect(l[3]).toBe(ALT);
    expect(l[0]).toEqual({ id: 'a', label: ROUTINE_BELEGT, wann: 'abend', kategorie: 'leben', dauerMin: 20, aktiv: true, owner: 'person-a', space: 'business', rhythmus: 'monatlich', naechstesMal: '2026-11-02', belegt: true });
    expect(JSON.stringify(l)).not.toContain('"Titel-a"');
    expect(JSON.stringify(l)).not.toContain('Einheit X');
    expect(routinenFuerBetrachter([A, B], null)).toEqual([A, B]);
  });
  it('der Schreibweg übernimmt `belegt` nie', () => {
    expect(sauberRoutine(routineBelegt(A))).not.toHaveProperty('belegt');
  });
});

describe('routinenSchreibPruefen', () => {
  it('ändern, löschen, neu für die andere, zuschieben → ROUTINE_FREMD; eigene und gemeinsame frei', () => {
    const liste = [A, B, G];
    expect(routinenSchreibPruefen(liste, [{ op: 'teil', id: 'a', felder: { aktiv: false } }], 'person-b')).toBe(ROUTINE_FREMD);
    expect(routinenSchreibPruefen(liste, [{ op: 'delete', id: 'a' }], 'person-b')).toBe(ROUTINE_FREMD);
    expect(routinenSchreibPruefen(liste, [{ op: 'upsert', eintrag: { ...A, owner: 'person-b' } }], 'person-b')).toBe(ROUTINE_FREMD);
    expect(routinenSchreibPruefen(liste, [{ op: 'upsert', eintrag: r('neu', 'person-a') }], 'person-b')).toBe(ROUTINE_FREMD);
    expect(routinenSchreibPruefen(liste, [{ op: 'teil', id: 'g', felder: { owner: 'person-a' } }], 'person-b')).toBe(ROUTINE_FREMD);
    expect(routinenSchreibPruefen(liste, [{ op: 'teil', id: 'b', felder: { owner: 'beide' } }, { op: 'delete', id: 'g' }, { op: 'upsert', eintrag: r('neu', 'person-b') }], 'person-b')).toBeNull();
  });
});

describe('routinenVollSchreiben (PUT-Altweg)', () => {
  it('verdeckt zurück oder weggelassen → die echte Fassung bleibt; geändert → fremd', () => {
    expect(routinenVollSchreiben([A, B], [routineBelegt(A), { ...B, label: 'neu' }], 'person-b')).toEqual({ liste: [A, { ...B, label: 'neu' }] });
    expect(routinenVollSchreiben([A, B], [B], 'person-b')).toEqual({ liste: [B, A] });
    expect(routinenVollSchreiben([A, B], [{ ...routineBelegt(A), label: 'anders' }, B], 'person-b')).toEqual({ fremd: true });
    expect(routinenVollSchreiben([B], [B, r('neu', 'person-a')], 'person-b')).toEqual({ fremd: true });
  });
});
