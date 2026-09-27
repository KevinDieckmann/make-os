// ─── Sport · Hyrox: Splits, Schwächen, Bestzeiten je Station ────────────────
import { describe, it, expect } from 'vitest';
import { STATIONEN, LAUF_ANTEIL, ROXZONE_ANTEIL, splitsAusZielzeit, gesamtAus, vollstaendig, schwaechen, bestesJeStation, bestzeitPrognose } from '../lib/sport/hyrox';
import type { HyroxEinheit } from '../lib/sport/modell';
import { STATION_IDS } from '../lib/sport/modell';

describe('Splits aus der Zielzeit', () => {
  it('die Anteile ergeben zusammen 100 %', () => {
    const summe = STATIONEN.reduce((s, x) => s + x.anteil, 0) + LAUF_ANTEIL + ROXZONE_ANTEIL;
    expect(Math.round(summe * 1000) / 1000).toBe(1);
  });
  it('90 Minuten Zielzeit → Lauf je km und Stationen', () => {
    const s = splitsAusZielzeit(5400);
    expect(s.laeufeGesamt).toBe(Math.round(5400 * LAUF_ANTEIL));
    expect(s.laufJeKm).toBe(Math.round(5400 * LAUF_ANTEIL / 8));
    expect(s.stationen.wallballs).toBe(Math.round(5400 * 0.07));
    expect(s.gesamt).toBe(5400);
    // Summe der Teile weicht höchstens durch Rundung ab
    const teile = STATION_IDS.reduce((a, id) => a + s.stationen[id], 0) + s.laeufeGesamt + s.roxzone;
    expect(Math.abs(teile - 5400)).toBeLessThanOrEqual(8);
  });
});

const einheit = (teil: Partial<HyroxEinheit> = {}): HyroxEinheit => ({ id: 'h1', datum: '2026-09-20', art: 'simulation', stationen: {}, laeufe: [], ...teil });

describe('Einheit', () => {
  it('rechnet die Gesamtzeit aus den Teilen, wenn keine eingetragen ist', () => {
    expect(gesamtAus(einheit())).toBeNull();
    expect(gesamtAus(einheit({ stationen: { skierg: 300 }, laeufe: [330, 340] }))).toBe(970);
    expect(gesamtAus(einheit({ stationen: { skierg: 300 }, gesamtSek: 5000 }))).toBe(5000);
  });
  it('kennt vollständige Einheiten', () => {
    const alle = Object.fromEntries(STATION_IDS.map(id => [id, 200]));
    expect(vollstaendig(einheit({ stationen: alle, laeufe: Array(8).fill(330) }))).toBe(true);
    expect(vollstaendig(einheit({ stationen: alle, laeufe: Array(7).fill(330) }))).toBe(false);
  });
});

describe('Schwächen', () => {
  it('sortiert nach Kosten gegen das Ziel, Läufe als Mittel je km', () => {
    const ziel = splitsAusZielzeit(5400);
    const e = einheit({ stationen: { wallballs: ziel.stationen.wallballs + 90, skierg: ziel.stationen.skierg - 10, farmers: ziel.stationen.farmers + 5 }, laeufe: [ziel.laufJeKm + 20, ziel.laufJeKm + 40] });
    const s = schwaechen(e, ziel);
    expect(s.map(x => x.id)).toEqual(['wallballs', 'lauf', 'farmers', 'skierg']);
    expect(s[0].deltaSek).toBe(90);
    expect(s[1].ist).toBe(ziel.laufJeKm + 30);
    expect(s[3].deltaSek).toBe(-10);
  });
});

describe('Bestzeiten je Station und Prognose', () => {
  it('nimmt das Beste über alle Einheiten', () => {
    const b = bestesJeStation([einheit({ id: 'a', stationen: { skierg: 300 }, laeufe: [340] }), einheit({ id: 'b', datum: '2026-09-21', stationen: { skierg: 280 }, laeufe: [350, 335] })]);
    expect(b.skierg).toEqual({ sek: 280, datum: '2026-09-21' });
    expect(b.lauf).toEqual({ sek: 335, datum: '2026-09-21' });
  });
  it('prognostiziert erst, wenn alles gemessen ist', () => {
    expect(bestzeitPrognose([einheit({ stationen: { skierg: 300 }, laeufe: [340] })])).toBeNull();
    const alle = Object.fromEntries(STATION_IDS.map(id => [id, 240]));
    const p = bestzeitPrognose([einheit({ stationen: alle, laeufe: [330] })]);
    expect(p).toBe(Math.round((8 * 240 + 8 * 330) / (1 - ROXZONE_ANTEIL)));
  });
});
