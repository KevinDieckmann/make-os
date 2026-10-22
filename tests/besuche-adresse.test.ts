// ─── Events (besuchte Veranstaltungen, 03.10.) — Adressen und Reiterleiste ────
// Make.One bleibt die Kennung `event` (und der alte Name `events`); der neue Reiter heißt `besuche`. Alte Links bleiben gültig.
import { describe, it, expect } from 'vitest';
import { aufloesen, markttraktion, HUB_MENUE, punktVon, eventsReiterVon, EVENTS_REITER, BESUCHE_ANSICHTEN } from '../lib/crm/adresse';
import { WEG } from '../lib/wege';
import { zoeBezugFuer } from '../lib/zoe/crm-bezug';

describe('Reiter „Events“ (besuche) neben Make.One (event)', () => {
  it('alte Links bleiben Make.One: s=event, s=events (alter CRM-Bereich), mit und ohne Ansicht', () => {
    expect(aufloesen('event')).toEqual({ s: 'event' });
    expect(aufloesen('events')).toEqual({ s: 'event' });
    expect(aufloesen('events', 'gaeste')).toEqual({ s: 'event', a: 'gaeste' });
    expect(markttraktion('events')).toBe('/os/markttraktion?s=event');
    expect(markttraktion('event', undefined, 'ev-1')).toBe('/os/markttraktion?s=event&k=ev-1');
    expect(WEG.event('ev-1', 'gaeste')).toBe('/os/markttraktion?s=event&k=ev-1&r=gaeste');
  });

  it('neuer Bereich besuche: Kalender ist der Start und steht nicht in der Adresse; Wirkung und Für Kunden sind Ansichten; Unsinn fällt weg', () => {
    expect(BESUCHE_ANSICHTEN).toEqual(['kalender', 'wirkung', 'kunden']);
    expect(aufloesen('besuche')).toEqual({ s: 'besuche' });
    expect(aufloesen('besuche', 'kalender')).toEqual({ s: 'besuche' });
    expect(aufloesen('besuche', 'wirkung')).toEqual({ s: 'besuche', a: 'wirkung' });
    expect(aufloesen('besuche', 'kunden')).toEqual({ s: 'besuche', a: 'kunden' });
    expect(aufloesen('besuche', 'quatsch')).toEqual({ s: 'besuche' });
    expect(markttraktion('besuche')).toBe('/os/markttraktion?s=besuche');
    expect(markttraktion('besuche', 'wirkung')).toBe('/os/markttraktion?s=besuche&a=wirkung');
  });

  it('WEG.besuch: Event-Akte über k, Ansicht über a; WEG.netzwerken trägt „Heute bei“ mit', () => {
    expect(WEG.besuch()).toBe('/os/markttraktion?s=besuche');
    expect(WEG.besuch('ev-1')).toBe('/os/markttraktion?s=besuche&k=ev-1');
    expect(WEG.besuch(undefined, 'kunden')).toBe('/os/markttraktion?s=besuche&a=kunden');
    expect(WEG.netzwerken({ event: 'ev-1' })).toBe('/os/netzwerken?event=ev-1');
    expect(WEG.netzwerken({ bericht: 'ev-1' })).toBe('/os/netzwerken?bericht=ev-1');
    expect(WEG.netzwerken()).toBe('/os/netzwerken');
  });

  it('Hub (22.10.): EIN Punkt „Events“ unter Marketing trägt Besuchte Events und Make.One — die Reiter stehen in EINER Zeile', () => {
    const marketing = HUB_MENUE.gruppen.find(g => g.id === 'marketing')!;
    expect(marketing.punkte.map(p => p.id)).toEqual(['marketing', 'events', 'netzwerken']);
    expect(marketing.punkte.find(p => p.id === 'events')?.bereiche).toEqual(['besuche', 'event']);
    expect(punktVon({ s: 'besuche' })).toBe('events');
    expect(punktVon({ s: 'event' })).toBe('events');
    // Keine vierte Ebene: Kalender · Wirkung · Im Kundenauftrag · Make.One nebeneinander, die Adressen bleiben.
    expect(EVENTS_REITER.map(r => r.id)).toEqual(['kalender', 'wirkung', 'kunden', 'makeone']);
    for (const r of EVENTS_REITER) expect(eventsReiterVon(aufloesen(r.s, r.a))).toBe(r.id);
    expect(eventsReiterVon(aufloesen('events', 'gaeste'))).toBe('makeone');
    expect(eventsReiterVon(aufloesen('besuche', 'quatsch'))).toBe('kalender');
    expect(eventsReiterVon(aufloesen('deals'))).toBeNull();
  });

  it('ZOE fragen: der Reiter Events hat denselben Bezug wie die Event-Welt', () => {
    expect(zoeBezugFuer('besuche', undefined, null)).toEqual({ art: 'event-welt' });
    expect(zoeBezugFuer('event', undefined, null)).toEqual({ art: 'event-welt' });
  });
});
