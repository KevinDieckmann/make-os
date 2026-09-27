// Head of IT — Rechenhilfen (lib/hoi/rechnen.ts): Zähler aus Aufträgen, Anmeldungen, CSP-Berichten; Außenmeldung säubern.
import { describe, it, expect } from 'vitest';
import { fehlerquote24h, fehlanmeldungen24h, neueNetze7d, cspMeldungenAus, cspZusammenfuehren, cspBild, aussenSaeubern } from '@/lib/hoi/rechnen';
import type { Auftrag } from '@/lib/zoe/auftraege';
import type { Anmeldung } from '@/lib/zugang/anmeldungen';

const JETZT = '2026-09-27T12:00:00.000Z';
const a = (status: Auftrag['status'], beendet?: string) => ({ id: 'x', zeit: JETZT, tag: '2026-09-27', art: 'agent', name: 'n', eingabe: {}, schluessel: 's', status, versuche: 1, beendet } as Auftrag);
const anm = (zeit: string, ok: boolean, adresse: string, art: Anmeldung['art'] = 'anmelden'): Anmeldung => ({ zeit, speicher: ok ? 'kevin' : null, art, ok, adresse });

describe('Fehlerquote und Anmeldungen', () => {
  it('rechnet nur beendete Läufe der letzten 24 h — ohne Läufe null', () => {
    expect(fehlerquote24h([], JETZT)).toBeNull();
    expect(fehlerquote24h([a('offen'), a('laeuft')], JETZT)).toBeNull();
    expect(fehlerquote24h([a('fertig', '2026-09-27T10:00:00Z'), a('fehler', '2026-09-27T11:00:00Z'), a('fehler', '2026-09-25T11:00:00Z')], JETZT)).toBe(50);
  });
  it('zählt Fehlanmeldungen der letzten 24 h und neue Netze der letzten 7 Tage', () => {
    const liste = [
      anm('2026-09-27T09:00:00Z', false, '203.0.113.7'), anm('2026-09-27T09:01:00Z', false, '203.0.113.7'), anm('2026-09-20T09:00:00Z', false, '203.0.113.7'),
      anm('2026-09-26T09:00:00Z', true, '198.51.100.20'), anm('2026-09-01T09:00:00Z', true, '198.51.100.99'), // gleiches /24 wie vorher → nicht neu
      anm('2026-09-25T09:00:00Z', true, '192.0.2.44'), // neues Netz
      anm('2026-09-25T10:00:00Z', true, '192.0.2.44', 'passwort'), // andere Art zählt nicht
    ];
    expect(fehlanmeldungen24h(liste, JETZT)).toBe(2);
    expect(neueNetze7d(liste, JETZT)).toBe(1);
  });
});

describe('CSP-Berichte', () => {
  it('liest den alten und den neuen Berichtsweg und behält nur Zähler-Form', () => {
    const alt = cspMeldungenAus({ 'csp-report': { 'document-uri': 'https://x.test/os/heute?token=geheim', 'blocked-uri': 'https://evil.example/a.js?x=1', 'violated-directive': 'script-src' } }, JETZT);
    expect(alt).toEqual([{ zeit: JETZT, richtlinie: 'script-src', blockiert: 'https://evil.example', seite: '/os/heute' }]);
    const neu = cspMeldungenAus([{ type: 'csp-violation', body: { documentURL: 'https://x.test/os?x=1', blockedURL: 'inline', effectiveDirective: 'style-src-elem' } }], JETZT);
    expect(neu[0]).toMatchObject({ richtlinie: 'style-src-elem', blockiert: 'inline', seite: '/os' });
    expect(cspMeldungenAus('quatsch', JETZT)).toEqual([]);
    expect(cspMeldungenAus(null, JETZT)).toEqual([]);
  });
  it('führt gleiche Meldungen zusammen, begrenzt und vergisst nach 30 Tagen', () => {
    const eins = cspZusammenfuehren([], [{ zeit: JETZT, richtlinie: 'script-src', blockiert: 'inline', seite: '/os' }], JETZT);
    const zwei = cspZusammenfuehren(eins, [{ zeit: JETZT, richtlinie: 'script-src', blockiert: 'inline', seite: '/os' }, { zeit: JETZT, richtlinie: 'img-src', blockiert: 'https://a.test', seite: '/os' }], JETZT);
    expect(zwei).toHaveLength(2);
    expect(zwei.find(m => m.richtlinie === 'script-src')?.anzahl).toBe(2);
    const alt = [{ zeit: '2026-08-01T00:00:00Z', richtlinie: 'x', blockiert: 'y', seite: '/', anzahl: 9 }];
    expect(cspZusammenfuehren(alt, [], JETZT)).toEqual([]);
    const viele = Array.from({ length: 250 }, (_, i) => ({ zeit: JETZT, richtlinie: 'r', blockiert: `q${i}`, seite: '/' }));
    expect(cspZusammenfuehren([], viele, JETZT)).toHaveLength(200);
    expect(cspBild(zwei, JETZT)).toEqual({ meldungen7d: 3, top: 'script-src ← inline' });
  });
});

describe('Außenmeldung', () => {
  it('nimmt nur die erlaubte Form an', () => {
    const m = aussenSaeubern({ zeit: '2026-09-27T11:50:00Z', status: 200, ms: 412.6, tlsTage: 61, kopfzeilen: { 'strict-transport-security': true, 'x-frame-options': false, 'Böse Kopfzeile': true, 'content-security-policy': 'ja' }, laeufer: 'github', observatory: { note: 'A+', punkte: 105 }, extra: 'weg' }, JETZT);
    expect(m).toEqual({ zeit: '2026-09-27T11:50:00.000Z', status: 200, ms: 413, tlsTage: 61, kopfzeilen: { 'strict-transport-security': true, 'x-frame-options': false }, laeufer: 'github', observatory: { note: 'A+', punkte: 105 } });
    // Zeit weit weg → jetzt; unsinnige Zahlen fallen weg
    expect(aussenSaeubern({ zeit: '2020-01-01T00:00:00Z', status: 99999, ms: -1 }, JETZT)).toEqual({ zeit: JETZT });
    expect(aussenSaeubern('x', JETZT)).toBeNull();
  });
});
