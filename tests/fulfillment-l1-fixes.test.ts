// Gesamtprüfung 17.10. — Linse 1 (Ende zu Ende): Funde, die die Regeln betreffen. Erfundene Daten, rein.
import { describe, it, expect } from 'vitest';
import { willkommenUhr } from '@/lib/fulfillment/prozesse/onboarding';
import { tagKurz } from '@/components/os/fulfillment/prozesse/daten';

describe('B2 · Willkommens-Uhr', () => {
  it('nur der Tag der Unterschrift bekannt: die 24 Stunden laufen ab dem Ende dieses Tages', () => {
    const u = willkommenUhr('2026-10-17', 24, undefined, '2026-10-17T19:00:00.000Z');
    expect(u.faellig).toBe('2026-10-18T22:00:00.000Z');
    expect(u.ueberfaellig).toBe(false);
    expect(u.restStunden).toBe(27);
  });
  it('mit Uhrzeit gilt die Uhrzeit', () => {
    expect(willkommenUhr('2026-10-17T18:53:00.000Z', 24, undefined, '2026-10-17T19:00:00.000Z').faellig).toBe('2026-10-18T18:53:00.000Z');
  });
  it('Datum eines Zeitstempels als Berliner Tag — nie der UTC-Tag', () => {
    expect(tagKurz('2026-10-17T22:00:00.000Z')).toBe('18.10.');
    expect(tagKurz('2026-10-17')).toBe('17.10.');
  });
});
