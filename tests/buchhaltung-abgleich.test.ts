// ─── Buchhaltung — Abgleich Zahlung ↔ Rechnung und Beleg mit Gesellschaft (02.11.) ────────────────────────────────────────────────────
// (1) Vorschläge rein: ±0,5 %, Teilbetrag, Nummer im Zweck vor Name, gleiche Gesellschaft, nie vor dem Rechnungsdatum, nie bezahlte/stornierte.
// (2) „bezahlt“ mit `buchungId` verknüpft GENAU diese Buchung; passt sie nicht → 409, Rechnung UND Buchungen unverändert; falsche Form → 400.
// (3) Beleg ohne Gesellschaft → 400, nichts gebucht (nie still eine Gesellschaft). Eigener Datenordner, erfundene Werte.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { haushaltKonten } from './fixtures/konten';
import { betragArt, rechnungOffen, zahlungVorschlaege, type RechnungFuerAbgleich } from '@/lib/finanzen/buchhaltung/zahlung-rechnung';
import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-bh-abgleich-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-bh-abgleich';
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const b = (x: Partial<BhBuchung> & { id: string }): BhBuchung => ({ datum: '2026-10-10', wer: 'Kunde Beispiel GmbH', betrag: 1190, kategorie: 'Erlöse', ort: 'ug', ...x });
const r = (x: Partial<RechnungFuerAbgleich> & { id: string }): RechnungFuerAbgleich => ({ firmaId: 'ug', kunde: 'Kunde Beispiel GmbH', nummer: 'RE-2026-007', betrag: 1190, status: 'gestellt', datum: '2026-10-01', ...x });

describe('Vorschläge Zahlung ↔ Rechnung (rein)', () => {
  it('Betrag: genau, ±0,5 % fast gleich, kleiner = Teilbetrag, darüber nie', () => {
    expect(betragArt(119000, 119000)).toBe('genau');
    expect(betragArt(118500, 119000)).toBe('nahe');
    expect(betragArt(119500, 119000)).toBe('nahe');
    expect(betragArt(50000, 119000)).toBe('teil');
    expect(betragArt(130000, 119000)).toBeNull();
  });
  it('offen = weder bezahlt noch storniert, kein Editor-Entwurf', () => {
    expect(rechnungOffen(r({ id: 'a' }))).toBe(true);
    expect(rechnungOffen(r({ id: 'a', status: 'bezahlt' }))).toBe(false);
    expect(rechnungOffen(r({ id: 'a', status: 'storniert' }))).toBe(false);
    expect(rechnungOffen(r({ id: 'a', status: 'geplant', positionen: [] }))).toBe(false);
  });
  it('Nummer im Zweck schlägt Name; andere Gesellschaft, frühere Zahlung, verknüpfte Buchung und Ausgang fallen weg', () => {
    const rechnungen = [r({ id: 're-n' }), r({ id: 're-name', nummer: 'RE-2026-099' }), r({ id: 're-kdv', firmaId: 'kdv' })];
    const v = zahlungVorschlaege([
      b({ id: 'bu-1', zweck: 'Zahlung RE-2026-007 danke' }),
      b({ id: 'bu-2', datum: '2026-09-20', zweck: 'RE-2026-007' }),
      b({ id: 'bu-3', rechnungId: 're-alt' }),
      b({ id: 'bu-4', betrag: -1190 }),
    ], rechnungen);
    expect(v.filter(x => x.buchungId === 'bu-1').map(x => [x.rechnungId, x.grund])).toEqual([['re-n', 'Nummer im Zweck'], ['re-name', 'Name passt']]);
    expect(v.some(x => x.rechnungId === 're-kdv')).toBe(false);
    expect(v.some(x => ['bu-2', 'bu-3', 'bu-4'].includes(x.buchungId))).toBe(false);
  });
  it('ohne Bezug (weder Nummer noch Name) kein Vorschlag — auch nicht bei gleichem Betrag', () => {
    expect(zahlungVorschlaege([b({ id: 'bu-x', wer: 'Ganz Andere AG', zweck: 'Überweisung' })], [r({ id: 're-1' })])).toEqual([]);
  });
  it('Teilbetrag wird als Teil vorgeschlagen, höchstens drei je Buchung', () => {
    const v = zahlungVorschlaege([b({ id: 'bu-t', betrag: 500 })], [1, 2, 3, 4].map(n => r({ id: `re-${n}`, nummer: `RE-X-${n}` })));
    expect(v).toHaveLength(3);
    expect(v.every(x => x.art === 'teil')).toBe(true);
  });
});

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); await haushaltKonten(db); });

const PLAN = () => ({ firmen: [], zahlungen: [], merkposten: [], produkte: [], uhrwerk: { letztesMeeting: null, agenda: [] },
  rechnungen: [{ id: 're-a', nummer: 'RE-2026-001', firmaId: 'ug', kunde: 'Kunde Beispiel GmbH', titel: 'Beratung', betrag: 1190, status: 'gestellt', datum: '2026-10-01' }] });
const BUCHUNGEN = () => ({ buchungen: [
  { id: 'bu-ein', datum: '2026-10-12', wer: 'Kunde Beispiel GmbH', betrag: 1190, kategorie: 'Erlöse', ort: 'ug', auszug: 'az-1', konto: 'Konto MAKE' },
  { id: 'bu-kdv', datum: '2026-10-12', wer: 'Kunde Beispiel GmbH', betrag: 1190, kategorie: 'Erlöse', ort: 'kdv', auszug: 'az-1', konto: 'Konto KDV' },
  { id: 'bu-aus', datum: '2026-10-12', wer: 'Lieferant Beispiel', betrag: -1190, kategorie: 'Büro', ort: 'ug', auszug: 'az-1', konto: 'Konto MAKE' },
] });

describe('„bezahlt“ mit gewählter Buchung', () => {
  beforeEach(async () => { await db.saveJson('finanzplan', PLAN()); await db.saveJson('buchungen', BUCHUNGEN()); });
  const vermerke = async (buchungId: unknown) => (await import('@/lib/finanzen/rechnung/bezahlt-server')).rechnungBezahltVermerken({ id: 're-a', am: '2026-10-12', heute: '2026-11-02', buchungId });
  const lies = async () => ({
    re: (await db.loadJson<{ rechnungen: { id: string; status: string }[] }>('finanzplan'))!.rechnungen[0],
    bu: (await db.loadJson<{ buchungen: { id: string; rechnungId?: string }[] }>('buchungen'))!.buchungen,
  });

  it('verknüpft genau diese Buchung, legt keine zweite an', async () => {
    const e = await vermerke('bu-ein');
    expect(e).toMatchObject({ ok: true, buchung: { id: 'bu-ein', gebucht: 'verknuepft' } });
    const { re, bu } = await lies();
    expect(re.status).toBe('bezahlt');
    expect(bu).toHaveLength(3);
    expect(bu.find(x => x.id === 'bu-ein')?.rechnungId).toBe('re-a');
    expect(bu.filter(x => x.rechnungId === 're-a')).toHaveLength(1);
  });
  it.each([['andere Gesellschaft', 'bu-kdv'], ['Ausgang', 'bu-aus'], ['unbekannt', 'bu-gibt-es-nicht']])('passt nicht (%s) → 409, Rechnung und Buchungen unverändert', async (_n, id) => {
    const vorher = await lies();
    const e = await vermerke(id);
    expect(e).toMatchObject({ ok: false, status: 409 });
    expect(await lies()).toEqual(vorher);
  });
  it('unzulässige Kennung → 400, nichts gespeichert', async () => {
    const vorher = await lies();
    expect(await vermerke('../x y')).toMatchObject({ ok: false, status: 400 });
    expect(await lies()).toEqual(vorher);
  });
});

describe('Beleg übernehmen braucht die Gesellschaft', () => {
  it('ohne `firma` → 400, nichts gebucht', async () => {
    await db.saveJson('finanzplan', PLAN());
    await db.saveJson('buchungen', BUCHUNGEN());
    const route = await import('@/app/api/beleg/uebernehmen/route');
    const schick = (body: unknown) => route.POST(new Request('http://t/api/beleg/uebernehmen', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'kevin' }, body: JSON.stringify(body) }));
    const vorher = await db.loadJson('buchungen');
    const a = await schick({ ziel: 'buchung', partner: 'Laden Beispiel', betrag: 12.5, datum: '2026-10-20', anfrageId: 'anf-bh-ohne-firma-1' });
    expect(a.status).toBe(400);
    expect((await a.json()).error).toMatch(/Gesellschaft/);
    const c = await schick({ ziel: 'rechnung', firma: 'unbekannt', partner: 'Kunde Beispiel', betragBrutto: 119, anfrageId: 'anf-bh-ohne-firma-2' });
    expect(c.status).toBe(400);
    expect(await db.loadJson('buchungen')).toEqual(vorher);
    expect((await db.loadJson<{ rechnungen: unknown[] }>('finanzplan'))!.rechnungen).toHaveLength(1);
  });
});
