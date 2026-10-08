import { describe, it, expect } from 'vitest';
import { aufloesen, markttraktion, angebotLink, angebotAusAdresse, BEREICHE, REITER_ZEILE, reiterVon, kontaktAkte, dealAkte } from '../lib/crm/adresse';
import { WEG } from '../lib/wege';

// Markttraktion · Schnellknopf „Angebot“ und die Leiste (Kevin 28.09. abends).

describe('Adresse — Bereich „angebot“', () => {
  it('ist ein eigener Bereich', () => {
    expect(BEREICHE).toContain('angebot');
    expect(aufloesen('angebot')).toEqual({ s: 'angebot' });
    expect(markttraktion('angebot')).toBe('/os/markttraktion?s=angebot');
  });

  it('angebotLink baut die Vorbelegung — nur, was gesetzt ist', () => {
    expect(angebotLink()).toBe('/os/markttraktion?s=angebot');
    expect(angebotLink({ kontaktId: 'c-1' })).toBe('/os/markttraktion?s=angebot&kontakt=c-1');
    expect(angebotLink({ angebotId: 'ang-7', kontaktId: 'c-1', firmaId: 'f-acme', dealId: 'ch-3' }))
      .toBe('/os/markttraktion?s=angebot&k=ang-7&kontakt=c-1&firma=f-acme&deal=ch-3');
    expect(angebotLink({ dealId: 'ch-3', kontaktId: null, firmaId: '' })).toBe('/os/markttraktion?s=angebot&deal=ch-3');
    expect(WEG.angebot({ firmaId: 'f-x' })).toBe('/os/markttraktion?s=angebot&firma=f-x');
    expect(WEG.qualifizierung()).toBe('/os/markttraktion?s=qualifizierung');
  });

  it('kaputte Kennungen fallen weg (nichts Fremdes in der Adresse)', () => {
    expect(angebotLink({ kontaktId: 'c-1&s=kontakte', firmaId: '../x', dealId: 'x'.repeat(200) })).toBe('/os/markttraktion?s=angebot');
  });

  it('angebotAusAdresse liest dasselbe zurück', () => {
    const link = angebotLink({ angebotId: 'ang-7', kontaktId: 'c-1', firmaId: 'f-acme', dealId: 'ch-3' });
    const p = new URLSearchParams(link.split('?')[1]);
    expect(aufloesen(p.get('s'), p.get('a'))).toEqual({ s: 'angebot' });
    expect(angebotAusAdresse(p)).toEqual({ angebotId: 'ang-7', kontaktId: 'c-1', firmaId: 'f-acme', dealId: 'ch-3' });
    expect(angebotAusAdresse(new URLSearchParams('s=angebot&kontakt=<b>'))).toEqual({ angebotId: null, kontaktId: null, firmaId: null, dealId: null });
  });

  it('alte Adressen bleiben unverändert', () => {
    expect(aufloesen('qualifizierung')).toEqual({ s: 'qualifizierung' });
    // Seit 08.10. (Aufräumen Etappe 3): Power Hour unter Follow-up, Leads unter Qualifizierung.
    expect(aufloesen('heute')).toEqual({ s: 'followup', a: 'powerhour' });
    expect(aufloesen('sales', 'leads')).toEqual({ s: 'qualifizierung', a: 'leads' });
    expect(markttraktion('deals', 'liste')).toBe('/os/markttraktion?s=deals&a=liste');
    expect(kontaktAkte('c-1', 'umsatz')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-1&t=umsatz');
    expect(dealAkte('ch-1')).toBe('/os/markttraktion?s=deals&a=akte&k=ch-1');
  });
});

describe('Reiterleiste — links · Mitte · rechts', () => {
  it('Schnellknöpfe in der Mitte: Qualifizierung, dann Angebot', () => {
    expect(REITER_ZEILE.mitte).toEqual(['qualifizierung', 'angebot']);
    // Aufräumen Etappe 3 (08.10.): sechs Reiter, Stammdaten hinter dem Zahnrad.
    expect(REITER_ZEILE.links.map(r => r.id)).toEqual(['ueberblick', 'kontakte', 'deals', 'followup']);
    expect(REITER_ZEILE.rechts.map(r => r.id)).toEqual(['marketing', 'events']);
    expect(REITER_ZEILE.zahnrad).toBe('stammdaten');
  });

  it('jeder Bereich steht genau einmal in der Leiste', () => {
    const alle = [...REITER_ZEILE.links.flatMap(r => r.bereiche), ...REITER_ZEILE.mitte, ...REITER_ZEILE.rechts.flatMap(r => r.bereiche), REITER_ZEILE.zahnrad];
    expect(new Set(alle).size).toBe(alle.length);
    expect([...alle].sort()).toEqual([...BEREICHE].sort());
    expect(reiterVon('angebot')).toBeNull();
  });
});
