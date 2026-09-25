// Kalender (25.09.): Fristen aus dem System, Erinnerungen, und wer den Kalender sehen darf.
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/zugang/konten', () => ({
  ladeKonten: async () => ({ konten: [
    { speicher: 'kevin', rolle: 'inhaber', haushalt: 'kevin-malin' },
    { speicher: 'malin', rolle: 'mitglied', haushalt: 'kevin-malin' },
    { speicher: 'test', rolle: 'mitglied', haushalt: 'test' },
    { speicher: 'joerg2', rolle: 'mitglied' },
  ] }),
}));

import { fristen, erinnerungen } from '../lib/kalender/eintraege';
import { kalenderZugang } from '../lib/kalender/zugang';
import { wemGehoert, EINSTELLUNGEN_LEER, einstellungenSauber } from '../lib/kalender/einstellungen';
import { wandzeit } from '../lib/kalender/zeit';

describe('Fristen', () => {
  it('Meilensteine, Etappen, Mandate (Ende, Kündigungsfrist, Review), offene Zahlungen, gestellte Rechnungen — nur im Zeitraum', () => {
    const f = fristen({
      meilensteine: [{ id: 'm1', titel: 'MAKE OS live', faellig: '2026-09-30', bereich: 'System' }, { id: 'm2', titel: 'später', faellig: '2026-12-01' }],
      etappen: [{ id: 'e-1', name: 'Malin arbeitet täglich damit', ziel: '2026-10-10' }, { id: 'e-2', name: 'ohne Datum' }],
      mandate: [
        { id: 'a', kunde: 'Acme', status: 'aktiv', ende: '2026-12-31', kuendigungsfristTage: 90, naechstesReview: '2026-10-01' },
        { id: 'b', kunde: 'Beendet GmbH', status: 'beendet', ende: '2026-10-05' },
      ],
      zahlungen: [{ id: 'z1', an: 'Finanzamt', titel: 'USt', betrag: 1200, status: 'offen', faellig: '2026-10-10' }, { id: 'z2', an: 'Alt', status: 'bezahlt', faellig: '2026-10-01' }],
      rechnungen: [{ id: 'r1', kunde: 'One Finance', titel: 'Retainer Okt', betrag: 3000, status: 'gestellt', faellig: '2026-10-14' }, { id: 'r2', kunde: 'Plan', status: 'geplant', faellig: '2026-10-02' }],
    }, '2026-09-28', '2026-10-15');
    expect(f.map(x => [x.tag, x.art, x.titel])).toEqual([
      ['2026-09-30', 'meilenstein', 'MAKE OS live'],
      ['2026-10-01', 'mandat', 'Review: Acme'],
      ['2026-10-02', 'mandat', 'Kündigungsfrist: Acme'],
      ['2026-10-10', 'etappe', 'Malin arbeitet täglich damit'],
      ['2026-10-10', 'zahlung', 'Zahlung: Finanzamt'],
      ['2026-10-14', 'eingang', 'Zahlungseingang: One Finance'],
    ]);
    expect(f.find(x => x.art === 'zahlung')!.unter).toMatch(/USt · 1\.200\s€/);
    expect(f.every(x => x.href.startsWith('/os/'))).toBe(true);
  });
  it('Erinnerungen vom Mac: nur mit Datum im Zeitraum, Uhrzeit wenn gesetzt', () => {
    const e = erinnerungen([
      { id: 'r1', title: 'Blumen gießen', due: '2026-09-29T16:00:00.000Z', list: 'Zuhause' },
      { id: 'r2', title: 'ohne Datum' },
      { id: 'r3', title: 'ganztags', due: '2026-09-30T22:00:00.000Z' },
      { id: 'r4', title: 'zu spät', due: '2026-11-01T10:00:00.000Z' },
    ], '2026-09-28', '2026-10-05', wandzeit);
    expect(e).toEqual([
      { id: 'er-r1', tag: '2026-09-29', zeit: '18:00', titel: 'Blumen gießen', liste: 'Zuhause' },
      { id: 'er-r3', tag: '2026-10-01', titel: 'ganztags' },
    ]);
    expect(erinnerungen({ error: 'x' }, '2026-09-28', '2026-10-05', wandzeit)).toEqual([]);
  });
});

describe('Zugang und Zuordnung', () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (kopf: Record<string, string>) => new Request('http://x/api/kalender', { headers: kopf });
  it('Haushalt des Inhabers ja, anderer Haushalt und Konten ohne Haushalt nein, Dienstweg nur mit dem echten Schlüssel', async () => {
    vi.stubEnv('MAKE_OS_KEY', 'geheim');
    expect(await kalenderZugang(req({ 'x-make-user': 'kevin' }))).toEqual({ person: 'kevin', dienst: false });
    expect(await kalenderZugang(req({ 'x-make-user': 'malin' }))).toEqual({ person: 'malin', dienst: false });
    expect(await kalenderZugang(req({ 'x-make-user': 'test' }))).toBeNull();
    expect(await kalenderZugang(req({ 'x-make-user': 'joerg2' }))).toBeNull();
    expect(await kalenderZugang(req({ 'x-make-user': 'gibtsnicht' }))).toBeNull();
    expect(await kalenderZugang(req({}))).toBeNull();
    expect(await kalenderZugang(req({ 'x-make-key': 'falsch', 'x-make-person': 'kevin' }))).toBeNull();
    expect(await kalenderZugang(req({ 'x-make-key': 'geheim' }))).toEqual({ person: 'kevin', dienst: true });
  });
  it('Kalender gehören Kevin, Malin oder beiden — Groß/klein und Leerzeichen egal', () => {
    const e = einstellungenSauber(null);
    expect(e.kalender).toEqual(EINSTELLUNGEN_LEER.kalender);
    expect(['Privat Kevin', 'privat malin ', 'Kalender', 'Familie', 'Kevin Dieckmann', 'Malin Sport', 'Kevin & Malin'].map(n => wemGehoert(e, n))).toEqual(['kevin', 'malin', 'beide', 'beide', 'kevin', 'malin', 'beide']);
  });
});
