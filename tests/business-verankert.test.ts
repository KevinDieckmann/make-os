// Business-Index tiefer verankert (25.09.): Jarvis liest und schreibt (mit Freigabe),
// der Head of Finance warnt bei Rot und fehlendem Monatsabschluss, eigene Schwellen
// und Jahresziele werden gespeichert — alles nur für den Haushalt des Inhabers.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const speicher = new Map<string, unknown>();
vi.mock('@/lib/store/local-db', () => ({
  loadJson: async (n: string) => (speicher.has(n) ? structuredClone(speicher.get(n)) : null),
  saveJson: async (n: string, d: unknown) => { speicher.set(n, structuredClone(d)); },
  updateJson: async (n: string, f: (x: unknown) => unknown) => { const neu = f(speicher.has(n) ? structuredClone(speicher.get(n)) : null); speicher.set(n, structuredClone(neu)); return neu; },
}));
vi.mock('@/lib/zugang/konten', () => ({
  ladeKonten: async () => ({ konten: [
    { speicher: 'kevin', rolle: 'inhaber', haushalt: 'kevin-malin' },
    { speicher: 'malin', rolle: 'mitglied', haushalt: 'kevin-malin' },
    { speicher: 'gast', rolle: 'mitglied' },
  ] }),
}));

import { WERKZEUGE } from '../lib/jarvis/werkzeuge';
import { risikoVon } from '../lib/jarvis/register';
import { businessFuerChef, businessText } from '../lib/business/fuer-chef';
import { speichereEinstellungen, ladeEinstellungen, ladeRoh, bestandFuer } from '../lib/business/speicher';
import { berechne } from '../lib/business/index';

const HEUTE = '2026-09-25';

beforeEach(() => {
  speicher.clear();
  speicher.set('finanzplan', {
    firmen: [{ id: 'kdc', name: 'Consulting', kontostand: 500, stand: HEUTE }, { id: 'kdv', name: 'KD Ventures', kontostand: 20000, stand: HEUTE }],
    rechnungen: [{ id: 'r1', kunde: 'Acme', titel: 'Sep', betrag: 4000, status: 'gestellt', faellig: '2026-09-01', firmaId: 'kdc' }],
    zahlungen: [], merkposten: [],
  });
  speicher.set('liquiplan', { posten: [{ id: 'p', titel: 'Tools', betrag: -1000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc', kategorie: 'betrieb' }] });
  speicher.set('business-abschluesse', { eintraege: [{ firma: 'kdc', monat: '2026-07', umsatz: 8000, kosten: 6000 }, { firma: 'kdc', monat: '2026-06', umsatz: 8000, kosten: 6000 }] });
});

describe('Jarvis', () => {
  it('Lesen ist frei, der Monatsabschluss braucht Freigabe', () => {
    expect(risikoVon('business_index')).toBe('frei');
    expect(risikoVon('monatsabschluss_erfassen')).toBe('freigabe');
  });
  it('beantwortet den Index und eine Kennzahl — aber nicht für ein Konto außerhalb des Haushalts', async () => {
    const gesamt = await WERKZEUGE.business_index.lauf({}, '', 'malin');
    expect(gesamt).toMatch(/^Business-Index Gesamt: \d+/);
    expect(gesamt).toMatch(/Rot: .*Überfällige Forderungen/);
    const eine = await WERKZEUGE.business_index.lauf({ sicht: 'kdc', kennzahl: 'ueberfaellig' }, '', 'kevin');
    expect(eine).toMatch(/Überfällige Forderungen \(Consulting\): 100 % — rot/);
    expect(await WERKZEUGE.business_index.lauf({ kennzahl: 'ek_quote' }, '', 'kevin')).toMatch(/noch nicht messbar/);
    expect(await WERKZEUGE.business_index.lauf({}, '', 'gast')).toMatch(/Kein Zugang/);
  });
  it('Monatsabschluss per Jarvis: ergänzt nur Genanntes, keine Zukunft, kein fremdes Konto', async () => {
    const r = await WERKZEUGE.monatsabschluss_erfassen.lauf({ firma: 'kdc', monat: '2026-07', personal: 2000 }, '', 'kevin');
    expect(r).toMatch(/gespeichert/);
    const e = (speicher.get('business-abschluesse') as { eintraege: { monat: string; umsatz?: number; personal?: number }[] }).eintraege.find(x => x.monat === '2026-07')!;
    expect(e).toMatchObject({ umsatz: 8000, personal: 2000 });
    // Direkt danach liest Jarvis schon den neuen Stand (kein veralteter Zwischenspeicher).
    expect(await WERKZEUGE.business_index.lauf({ sicht: 'kdc', kennzahl: 'personalquote' }, '', 'kevin')).toMatch(/Personalaufwandsquote \(Consulting\): \d/);
    expect(await WERKZEUGE.monatsabschluss_erfassen.lauf({ firma: 'kdc', monat: '2030-01', umsatz: 1 }, '', 'kevin')).toMatch(/Nicht eingetragen/);
    expect(await WERKZEUGE.monatsabschluss_erfassen.lauf({ firma: 'kdc', monat: '2026-08', umsatz: 1 }, '', 'gast')).toMatch(/Kein Zugang/);
  });
});

describe('Head of Finance', () => {
  it('rote Kennzahlen werden Hinweise (Finanzielle Gesundheit = hoch), fehlender Vormonat wird ein Daten-Hinweis', async () => {
    const { block, hinweise } = await businessFuerChef(HEUTE);
    expect(hinweise.some(h => h.schwere === 'hoch' && /Überfällige Forderungen ist rot/.test(h.text))).toBe(true);
    expect(hinweise.filter(h => h.bereich === 'daten').map(h => h.text)).toEqual([
      expect.stringContaining('2026-08 für Consulting fehlt'), expect.stringContaining('2026-08 für KD Ventures fehlt'),
    ]);
    expect(block).toMatchObject({ gesamt: { index: expect.any(Number) }, monatsabschluss_fehlt: ['Consulting 2026-08', 'KD Ventures 2026-08'] });
    expect((block.rot as { kennzahl: string }[]).map(r => r.kennzahl)).toContain('Überfällige Forderungen');
    expect(await businessText('kdv', undefined, HEUTE)).toMatch(/Business-Index KD Ventures/);
  });
});

describe('Feinjustierung speichern', () => {
  it('Jahresziele, Schwellen je Sicht (überschreiben „alle“), Zurücksetzen, verdrehte Schwellen abgewiesen', async () => {
    expect(await speichereEinstellungen({ ziele: { kdc: '240000' } })).toMatchObject({ ok: true });
    expect(await speichereEinstellungen({ schwelle: { id: 'ueberfaellig', sicht: 'alle', gruen: 50, rot: 150 } })).toMatchObject({ ok: true });
    expect(await speichereEinstellungen({ schwelle: { id: 'ueberfaellig', sicht: 'kdc', gruen: 5, rot: 10 } })).toMatchObject({ ok: true });
    expect(await speichereEinstellungen({ schwelle: { id: 'ueberfaellig', sicht: 'kdc', gruen: 20, rot: 10 } })).toMatchObject({ ok: false });
    const e = await ladeEinstellungen();
    expect(e.ziele).toEqual({ kdc: 240000 });
    const roh = await ladeRoh(HEUTE);
    const k = (scope: 'gesamt' | 'kdc') => berechne(bestandFuer(roh, scope)).saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'ueberfaellig')!;
    expect(k('gesamt')).toMatchObject({ gruen: 50, rot: 150, ampel: 'gelb', angepasst: true });
    expect(k('kdc')).toMatchObject({ gruen: 5, rot: 10, ampel: 'rot' });
    expect(berechne(bestandFuer(roh, 'kdc')).saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'run_rate')!.gemessen).toBe(true);
    await speichereEinstellungen({ schwelle: { id: 'ueberfaellig', sicht: 'kdc', zuruecksetzen: true } });
    const roh2 = await ladeRoh(HEUTE);
    expect(berechne(bestandFuer(roh2, 'kdc')).saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'ueberfaellig')).toMatchObject({ gruen: 50, rot: 150 });
  });
});
