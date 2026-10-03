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

describe('Nachfass- und Herkunftstexte: EIN Helfer (Review 03.10.)', () => {
  it('nachfassText/nachgefasstText: Marke + Reihe; ein besuchtes Event (Netzwerken) heißt wie es heißt', async () => {
    const { nachfassText, nachgefasstText, NETZWERKEN_MARKE } = await import('../lib/crm/marke');
    expect(nachfassText(ev())).toBe('Nachfassen nach „Make.One · Stammtisch Maschinenbau“');
    expect(nachfassText(ev({ titel: 'Dinner', reihe: 'fokus-innovation' }))).toBe('Nachfassen nach „Make.One · Fokus Innovation · Dinner“');
    expect(nachfassText(ev({ marke: NETZWERKEN_MARKE, titel: 'IHK-Abend' }))).toBe('Nachfassen nach „IHK-Abend“');
    expect(nachgefasstText(ev(), 'Gespräch')).toBe('Nachgefasst nach „Make.One · Stammtisch Maschinenbau“ — Gespräch');
    expect(nachgefasstText(ev(), null)).toBe('Nachgefasst nach „Make.One · Stammtisch Maschinenbau“');
    // Die Teilnahme-Brücke nimmt die Reihe mit (Pick enthält 'reihe').
    expect(followUpEingabe(ev({ titel: 'Dinner', reihe: 'fokus-innovation' }), { kontaktId: 'k-1' }).text).toBe('Nachfassen nach „Make.One · Fokus Innovation · Dinner“');
  });

  it('kein Ort baut den Nachfass-Text selbst; die Herkunft nutzt eventName (keine „Make.One“-Regex)', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const w = path.resolve(__dirname, '..');
    const lies = (f: string) => readFileSync(path.join(w, f), 'utf8');
    for (const f of ['lib/crm/followup.ts', 'lib/crm/heute.ts', 'lib/crm/netzwerken-server.ts', 'lib/crm/event-bruecke.ts', 'components/os/crm/events/gemeinsam.tsx']) {
      expect(lies(f), f).not.toMatch(/`Nachfassen nach „\$\{|`Nachgefasst nach „\$\{/);
    }
    expect(lies('lib/crm/herkunft.ts')).not.toMatch(/Make\\\.One/);
  });

  it('Herkunft: ein Event mit eigener Marke steht mit seiner Marke da (nicht „Make.One · Marke · …“)', async () => {
    const { herkunftVon } = await import('../lib/crm/herkunft');
    const k = { id: 'k-1', name: 'Erika Beispiel', stufe: 'kontakt', letzterKontakt: '2026-11-06' } as unknown as import('../lib/make-one/crm').Kontakt;
    const crm = { events: [ev({ marke: 'Forum Süd' })], teilnahmen: [{ id: 't-1', eventId: 'ev-1', kontaktId: 'k-1', status: 'da' }], kampagnen: [], firmen: [] } as unknown as Parameters<typeof herkunftVon>[1];
    const roh = JSON.stringify(herkunftVon([k], crm));
    expect(roh).toContain('Forum Süd · Stammtisch Maschinenbau');
    expect(roh).not.toContain('Make.One · Forum Süd');
  });
});

describe('Praxis-Fund F6: Name und Titel-Vorschlag mit Reihe', () => {
  it('eventTitelVorschlag: Reihe · Vorlage, sonst was da ist, sonst „Neues Event“', async () => {
    const { eventTitelVorschlag, eventName } = await import('../lib/crm/marke');
    expect(eventTitelVorschlag('fokus-innovation', 'Dinner')).toBe('Fokus Innovation · Dinner');
    expect(eventTitelVorschlag('fokus-innovation', undefined)).toBe('Fokus Innovation');
    expect(eventTitelVorschlag(undefined, 'Stammtisch')).toBe('Stammtisch');
    expect(eventTitelVorschlag(undefined, undefined)).toBe('Neues Event');
    // Kein doppelter Reihenname im Namen nach außen.
    expect(eventName(ev({ titel: 'Fokus Innovation · Dinner', reihe: 'fokus-innovation' }))).toBe('Make.One · Fokus Innovation · Dinner');
  });
  it('keine Oberfläche baut „Marke · Titel“ selbst (die Reihe fiele weg) — eventName/titelMitReihe', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const path = await import('node:path');
    const w = path.resolve(__dirname, '..');
    const dateien = (d: string): string[] => readdirSync(path.join(w, d)).flatMap(n => { const r = `${d}/${n}`; return statSync(path.join(w, r)).isDirectory() ? dateien(r) : /\.tsx?$/.test(n) ? [r] : []; });
    const funde = [...dateien('components'), ...dateien('app')].filter(f => /\$\{markeVon\([^)]*\)\} · \$\{[^}]*titel\}/.test(readFileSync(path.join(w, f), 'utf8')));
    expect(funde).toEqual([]);
    for (const f of ['components/os/crm/Events.tsx', 'components/os/crm/events/Start.tsx']) expect(readFileSync(path.join(w, f), 'utf8'), f).toContain('eventTitelVorschlag(');
  });
});
