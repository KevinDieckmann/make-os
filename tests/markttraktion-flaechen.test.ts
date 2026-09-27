// Flächen für Sales, Marketing, Events (27.09.): Standardanordnung als Daten — gültig, eindeutig, Standard bleibt Standard.
import { describe, it, expect } from 'vitest';
import { FLAECHE, KACHELN, kachel, standardVon } from '../lib/crm/flaechen';
import { anwenden, istStandard, wende, seiteOk, BREITEN } from '../lib/flaeche/modell';

const WELTEN = ['sales', 'marketing', 'event'] as const;

describe('Markttraktion-Flächen', () => {
  it('Seiten-Ids sind gültige Flächen-Ids und eindeutig', () => {
    for (const w of WELTEN) expect(seiteOk(FLAECHE[w])).toBe(true);
    expect(new Set(Object.values(FLAECHE)).size).toBe(3);
  });

  it('Kacheln je Welt: eindeutige Ids, Titel, erlaubte Breiten; Kevins Standardanordnung', () => {
    const breiten = new Set(BREITEN.map(b => b.b));
    for (const w of WELTEN) {
      const ids = KACHELN[w].map(k => k.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const k of KACHELN[w]) { expect(k.titel.length).toBeGreaterThan(0); expect(breiten.has(k.breite)).toBe(true); expect(k.id).toMatch(/^[a-z0-9-]+$/); }
    }
    expect(KACHELN.sales.map(k => k.id)).toEqual(['head', 'scoreboard', 'trichter', 'kanal']);
    expect(KACHELN.marketing.slice(0, 4).map(k => k.id)).toEqual(['strecke', 'anfragen', 'segmente', 'freigabe']);
    expect(KACHELN.event.slice(0, 3).map(k => k.id)).toEqual(['head', 'events', 'detail']);
    expect(kachel('sales', 'head')).toEqual({ id: 'head', titel: 'Head of Sales', breite: 6 });
    expect(() => kachel('sales', 'gibtsnicht')).toThrow(/Unbekannte Kachel/);
  });

  it('der Standard wird nie gespeichert: ohne Speicherstand ist er Standard, nach einem Schritt nicht mehr', () => {
    for (const w of WELTEN) {
      const std = standardVon(w);
      expect(std.every(p => p.art === 'seite' && p.titel)).toBe(true);
      const l = anwenden(std, null);
      expect(l.plaetze.map(p => p.id)).toEqual(KACHELN[w].map(k => k.id));
      expect(istStandard(l, std)).toBe(true);
      expect(istStandard(wende(l, { op: 'ausblenden', id: std[0].id }, std), std)).toBe(false);
    }
  });
});
