// Marke Make.One (27.09.): Konstante, Ableitung, Säuberung, Export und Nachfass-Text.
import { describe, it, expect } from 'vitest';
import type { Event } from '../lib/crm/typen';
import { MARKE_EVENTS, markeVon, eventName } from '../lib/crm/marke';
import { MARKE_EVENTS as AUS_EVENTS } from '../lib/crm/events';
import { saeubern } from '../lib/crm/speicher';
import { icsText } from '../lib/crm/eventplanung';
import { followUpEingabe } from '../lib/crm/event-bruecke';

const J = '2026-09-27T10:00:00.000Z';
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Stammtisch Maschinenbau', format: 'stammtisch', ziel: 'drei Folgegespräche', datum: '2026-11-05', status: 'geplant', geaendert: J, ...x });
const sauber = (roh: Record<string, unknown>) => saeubern('events', roh, J, 'kevin') as unknown as Event;

describe('Marke Make.One', () => {
  it('eine Konstante, von events.ts durchgereicht', () => {
    expect(MARKE_EVENTS).toBe('Make.One');
    expect(AUS_EVENTS).toBe(MARKE_EVENTS);
  });

  it('ohne Eintrag gilt Make.One — abgeleitet; gesetzt gewinnt die eigene Marke', () => {
    expect(markeVon({})).toBe('Make.One');
    expect(markeVon({ marke: '  ' })).toBe('Make.One');
    expect(markeVon({ marke: 'KD Ventures Salon' })).toBe('KD Ventures Salon');
    expect(eventName(ev())).toBe('Make.One · Stammtisch Maschinenbau');
    expect(eventName(ev({ marke: 'Salon' }))).toBe('Salon · Stammtisch Maschinenbau');
  });

  it('Säuberung reicht die Marke durch, schreibt aber keine Vorgabe zurück; kürzt auf 40 Zeichen', () => {
    expect(sauber({ ...ev(), marke: 'Make.One' }).marke).toBe('Make.One');
    expect('marke' in sauber({ ...ev() })).toBe(false);
    expect(sauber({ ...ev(), marke: '' }).marke).toBeUndefined();
    expect(sauber({ ...ev(), marke: 'x'.repeat(60) }).marke).toHaveLength(40);
  });

  it('nach außen: Veranstalter im Kalender-Export, Marke im Nachfass-Text', () => {
    const entfaltet = icsText(ev(), J).replace(/\r\n /g, '');
    expect(entfaltet).toContain('Veranstalter: Make.One');
    expect(icsText(ev({ marke: 'Salon' }), J).replace(/\r\n /g, '')).toContain('Veranstalter: Salon');
    expect(followUpEingabe(ev(), { kontaktId: 'c-a' }).text).toBe('Nachfassen nach „Make.One · Stammtisch Maschinenbau“');
  });
});
