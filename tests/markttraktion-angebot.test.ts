import { describe, it, expect } from 'vitest';
import { aufloesen, markttraktion, angebotLink, angebotAusAdresse, angebotVonHier, BEREICHE, HUB_MENUE, punktVon, kontaktAkte, dealAkte } from '../lib/crm/adresse';
import { WEG } from '../lib/wege';

// Markttraktion · Angebot (Kevin 28.09. abends; seit 22.10. Hub-Punkt „Angebote“ und „+ Angebot“ in den Akten).

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

describe('Hub — „Angebote“ unter Vertrieb, „+ Angebot“ in den Akten (22.10.)', () => {
  it('Angebote ist ein Punkt der Gruppe Vertrieb und führt in die Liste', () => {
    const vertrieb = HUB_MENUE.gruppen.find(g => g.id === 'vertrieb')!;
    expect(vertrieb.punkte.map(p => p.id)).toEqual(['qualifizierung', 'deals', 'angebot', 'followup']);
    expect(vertrieb.punkte.find(p => p.id === 'angebot')!.ziel).toBe(angebotLink());
    expect(punktVon({ s: 'angebot' })).toBe('angebot');
  });
  it('„+ Angebot“ nimmt die offene Akte mit: Kontakt, Firma, Deal — ohne Bezug die Liste', () => {
    expect(angebotVonHier('kontakte', 'akte', 'c-1')).toBe(angebotLink({ kontaktId: 'c-1' }));
    expect(angebotVonHier('kontakte', undefined, 'f-acme')).toBe(angebotLink({ firmaId: 'f-acme' }));
    expect(angebotVonHier('firmen', undefined, 'f-acme')).toBe(angebotLink({ firmaId: 'f-acme' }));
    expect(angebotVonHier('deals', 'akte', 'ch-3')).toBe(angebotLink({ dealId: 'ch-3' }));
    expect(angebotVonHier('deals', undefined, null)).toBe(angebotLink());
  });
  it('jeder Bereich steht genau einmal im Hub', () => {
    const alle = [...HUB_MENUE.gruppen.flatMap(g => g.punkte.flatMap(p => p.bereiche)), ...HUB_MENUE.automation.bereiche, ...HUB_MENUE.fuss.flatMap(p => p.bereiche)];
    expect(new Set(alle).size).toBe(alle.length);
    expect([...alle].sort()).toEqual([...BEREICHE].sort());
  });
});
