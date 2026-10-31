// ─── Kreislauf-Rest (31.10., Kevin: „Kreislauf-Rest — heute fertig“) ───────────────────────────────────────────────────────────────────────
// 1 Gemischte Angebote: Einmalposten → je Zahlung (Raten/Anzahlung bzw. ganz) ein Entwurf im fälligen Monat, nie doppelt.
// 2 Morgenlauf auch für Quartal, einmaliges Honorar ohne Zahlplan, Tagessatz (Tage aus der erfassten Zeit, ohne Zeit nur die Aufgabe).
// 3 Mandate der Selbstständigkeit (Privat) mit Liquiplan-Posten — ein Konto „nur Business“ bekommt sie nie (Wächter).
// Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { ordner, zeit } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kreislauf-rest-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kreislauf-rest', MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-nur-fuer-den-kreislauf-rest-test' });
  /** Erfasste Zeit je Monat und Mandat (Sekunden) — ersetzt die Zeitmessung im Lauf. */
  const zeit: Record<string, Record<string, number>> = {};
  return { ordner, zeit };
});
vi.mock('@/lib/zeitmessung/mandate-server', () => ({
  zeitJeMandatFuer: async (_p: string, _z: string, stichtag: string) => ({
    gesamt: { zeilen: Object.entries(zeit[stichtag.slice(0, 7)] ?? {}).map(([id, sek]) => ({ id, art: 'mandat', sek, bloecke: 1, label: id })) },
  }),
  stundenText: () => '',
}));

import type { FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import type { Angebot, Chance, CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import type { RechnungPosition } from '@/lib/finanzen/rechnung/typen';
import { einmalTeilPositionen, einmalZahlungen, rechnungFuerMonat, tageAusZeit, vorbereitenFaellig } from '@/lib/finanzen/rechnung/kreislauf-regeln';
import { abgerechneteMonate, positionNetto, rechnungsMonate } from '@/lib/finanzen/rechnung/regeln';

const J = '2026-10-01T10:00:00.000Z';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-11-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);

describe('Regeln (rein)', () => {
  it('Quartal: je Quartal im Rhythmus des Mandats EIN Termin im ersten Monat; ein Quartal mit gestelltem Monat fällt weg', () => {
    const q = mandat('m-q', { rechnungsrhythmus: 'quartal' });
    expect(vorbereitenFaellig(q, '2026-11-03', new Set(), '2026-11')).toEqual([{ monat: '2026-11', art: 'quartal' }]);
    expect(vorbereitenFaellig(q, '2027-02-05', new Set(), '2026-11').map(f => f.monat)).toEqual(['2026-11', '2027-02']);
    expect(vorbereitenFaellig(q, '2027-02-05', new Set(['2026-12']), '2026-11').map(f => f.monat)).toEqual(['2027-02']);
    // Quartal begann vor der Einführung → nie rückwirkend.
    expect(vorbereitenFaellig(mandat('m-q0', { rechnungsrhythmus: 'quartal', start: '2026-10-01' }), '2026-11-03', new Set(), '2026-11')).toEqual([]);
  });
  it('Tagessatz: erst wenn der Leistungsmonat vorbei ist; einmalig ohne Zahlplan: EIN Termin zum Beginn', () => {
    const t = mandat('m-t', { honorar: { betrag: 800, basis: 'tag', netto: true }, start: '2026-10-01' });
    expect(vorbereitenFaellig(t, '2026-11-20', new Set(), '2026-11')).toEqual([]);
    expect(vorbereitenFaellig(t, '2026-12-01', new Set(), '2026-11')).toEqual([{ monat: '2026-11', art: 'tag' }]);
    const e = mandat('m-e', { honorar: { betrag: 2000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-11-10' });
    expect(vorbereitenFaellig(e, '2026-11-12', new Set(), '2026-11')).toEqual([{ monat: '2026-11', art: 'einmalig' }]);
    expect(vorbereitenFaellig({ ...e, start: '2026-10-10' }, '2026-11-12', new Set(), '2026-11')).toEqual([]);
    // Monatlich wie bisher.
    expect(vorbereitenFaellig(mandat('m-m'), '2026-12-02', new Set(['2026-11']), '2026-11')).toEqual([{ monat: '2026-12', art: 'monat' }]);
  });
  it('Tage aus Zeit: Vierteltage, 8 h = 1 Tag; nichts erfasst = 0', () => {
    expect(tageAusZeit(20 * 3600)).toBe(2.5);
    expect(tageAusZeit(9 * 3600)).toBe(1.25);
    expect(tageAusZeit(0)).toBe(0);
    expect(tageAusZeit(16 * 3600, 4)).toBe(4);
  });
  it('Einmalposten: Raten, Anzahlung/Rest, ganz — Summe genau die Einmalposten', () => {
    const m = { start: '2026-11-15', ende: '2027-02-28' };
    expect(einmalZahlungen({ zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 1 } }, m).map(z => z.monat)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(einmalZahlungen({ zahlweise: { art: 'raten', anzahl: 2, abstandMonate: 3 } }, m).map(z => z.monat)).toEqual(['2026-11', '2027-02']);
    expect(einmalZahlungen({ zahlweise: { art: 'anzahlung', prozent: 30, rest: 'bei Abnahme' } }, m).map(z => [z.monat, z.art])).toEqual([['2026-11', 'anzahlung'], ['2027-02', 'rest']]);
    expect(einmalZahlungen({}, m)).toEqual([{ nr: 1, von: 1, monat: '2026-11', art: 'ganz' }]);
    expect(einmalZahlungen({ zahlweise: { art: 'frei', text: 'nach Absprache' } }, m)).toHaveLength(1);
    const pos: RechnungPosition[] = [
      { id: 'p1', titel: 'Einführung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100001, ustSatz: 19 },
      { id: 'p2', titel: 'Workshop', text: '', menge: 2, einheit: 'Tag', einzelpreisCent: 90000, rabattProzent: 10, ustSatz: 7 },
    ];
    const summe = (l: RechnungPosition[]) => l.reduce((s, p) => s + positionNetto(p), 0);
    const raten = einmalZahlungen({ zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 1 } }, m);
    const teile = raten.map(z => einmalTeilPositionen(pos, z));
    expect(teile.reduce((s, l) => s + summe(l), 0)).toBe(summe(pos));
    expect(teile[1][0].titel).toBe('Einführung — Rate 2 von 3');
    expect(teile[0][1]).toMatchObject({ menge: 1, einheit: 'pauschal', ustSatz: 7 });
    const anz = einmalZahlungen({ zahlweise: { art: 'anzahlung', prozent: 30, rest: 'bei Abnahme' } }, m).map(z => einmalTeilPositionen(pos, z));
    expect(summe(anz[0]) + summe(anz[1])).toBe(summe(pos));
  });
  it('Rechnung über mehrere Monate (Quartal) deckt jeden Monat — gestellt hält die Monate, Entwurf hält den Monat für den Lauf', () => {
    const r = { mandatId: 'm-q', leistungVon: '2026-11-01', leistungBis: '2027-01-31', status: 'gestellt' as const };
    expect(rechnungsMonate(r)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect([...abgerechneteMonate('m-q', [r])]).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(rechnungFuerMonat([{ ...r, status: 'geplant' }], 'm-q', '2026-12')).toBe(true);
    // Ein Monat wie bisher.
    expect(rechnungsMonate({ leistungVon: '2026-11-01', leistungBis: '2026-11-30' })).toEqual(['2026-11']);
  });
});

// ── Server (eigener Datenordner) ─────────────────────────────────────────────────────────────────────────────────────────────

type H = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let rechnungRoute: { POST: H; GET: H };
let angebotRoute: { POST: H };
let liquiRoute: { POST: H; GET: H };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const postAn = async (route: { POST: H }, url: string, body: Record<string, unknown>, person = 'pa'): Promise<Antwort> => {
  const x = await route.POST(new Request(`http://test${url}`, { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const re = (body: Record<string, unknown>) => postAn(rechnungRoute, '/api/rechnung', body);
let anf = 0;
const neueAnf = () => `anf-kr-${++anf}`;
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const tasks = async () => (await db.loadJson<{ tasks: { id: string; status: string; title: string; description?: string }[] }>('tasks'))?.tasks ?? [];
const J2 = '2026-09-01T10:00:00.000Z';
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: 'Sprint Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', firma: 'Muster GmbH', art: 'projekt', wert: { betrag: 3000, basis: 'einmalig' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J2, von: 'pa' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdv', besitzer: 'pa', geaendert: J2, ...x } as unknown as Chance);
const EINMAL = { id: 'p1', titel: 'Einführung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 300000, ustSatz: 19, basis: 'einmalig' as const };
const LAUFEND = { id: 'p2', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 50000, ustSatz: 19, basis: 'monat' as const, laufzeitMonate: 6 };
const angebot = (id: string, x: Partial<Angebot> = {}): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Strategie-Sprint', nummer: `KDV-A-2026-${id.slice(-4)}`, positionen: [EINMAL, LAUFEND], einleitung: '', schluss: '', gueltigBis: '2027-12-31', zahlungszielTage: 21, status: 'angenommen', angenommenAm: J2, version: 1, gestelltAm: J2, angelegt: J2, geaendert: J2, ...x } as Angebot);
const lauf = async (tag: string) => (await import('@/lib/finanzen/rechnung/kreislauf')).rechnungenVorbereiten('kg-haus', tag, new Date(`${tag}T10:00:00Z`));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'kg-haus', ...x });
  await db.saveJson('konten', { konten: [konto('k1', 'pa', 'inhaber'), konto('k2', 'pb', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  const k = (id: string): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1')] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J2, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, zielTage: 30 } }] } as unknown as CrmBestand);
  const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
  const absender = (id: string) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: IBAN }, geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' });
  await db.saveJson('gesellschaften--kg-haus', { gesellschaften: [absender('kdv'), absender('kdc')] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  await db.saveJson('liquiplan', { posten: [] });
  // Einführung des Morgenlaufs am 30.10. (wie live) → wirksam ab November.
  await db.saveJson('rechnungswesen', { kreislauf: { vorbereiten: { ab: '2026-10-30' } } });
  rechnungRoute = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
  angebotRoute = (await import('@/app/api/crm/angebot/route')) as unknown as { POST: H };
  liquiRoute = (await import('@/app/api/crm/liquiplan/route')) as unknown as { GET: H; POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('1 · gemischtes Angebot: Einmalposten je Zahlung ein Entwurf', () => {
  it('Raten: je Rate ein Entwurf im fälligen Monat (+ Aufgabe), laufende Posten monatlich — nie doppelt, Summe = Einmalposten', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { einmalRateRechnungId } = await import('@/lib/finanzen/rechnung/server');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-mix', { chanceId: 'd-mix', honorar: { betrag: 500, basis: 'monat', netto: true } })],
      angebote: [...(b.angebote ?? []), angebot('ang-mix-0001', { dealId: 'd-mix', zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 1 } })] }));
    await lauf('2026-11-02');
    const r1 = (await plan()).rechnungen.find(r => r.id === einmalRateRechnungId('ang-mix-0001', 1));
    expect(r1).toMatchObject({ status: 'geplant', mandatId: 'm-mix', angebotId: 'ang-mix-0001' });
    expect(r1!.positionen![0]).toMatchObject({ einzelpreisCent: 100000, titel: 'Einführung — Rate 1 von 3' });
    expect(r1!.titel).toContain('Rate 1 von 3');
    // Die Monatsrechnung läuft daneben wie bisher (Einmal-Rechnung hält den Monat nicht auf).
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-mix' && !r.angebotId)).toHaveLength(1);
    expect((await tasks()).some(t => t.id.startsWith('rve-m-mix-') && t.title.includes('Rate 1 von 3'))).toBe(true);
    // Zweiter Lauf im selben Monat: nichts Neues.
    await lauf('2026-11-03');
    expect((await plan()).rechnungen.filter(r => r.angebotId === 'ang-mix-0001')).toHaveLength(1);
    await lauf('2026-12-02');
    await lauf('2027-01-04');
    await lauf('2027-01-05');
    const raten = (await plan()).rechnungen.filter(r => r.angebotId === 'ang-mix-0001');
    expect(raten.map(r => r.id).sort()).toEqual([1, 2, 3].map(n => einmalRateRechnungId('ang-mix-0001', n)).sort());
    expect(raten.reduce((s, r) => s + (r.positionen ?? []).reduce((x, p) => x + p.einzelpreisCent, 0), 0)).toBe(300000);
    // Der Knopf „nur die Einmalposten“ gibt die vorhandene zurück (keine zweite Rechnung).
    const knopf = await re({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-mix-0001', nur: 'einmalig', anfrageId: neueAnf() });
    expect(knopf.status, JSON.stringify(knopf.d)).toBe(200);
    expect((await plan()).rechnungen.filter(r => r.angebotId === 'ang-mix-0001')).toHaveLength(3);
  }, 120_000);
  it('ohne Zahlungsweise: EIN Entwurf zum Mandatsstart; vor der Einführung nie', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { einmalRechnungId } = await import('@/lib/finanzen/rechnung/server');
    await aendereCrm(b => ({ ...b,
      mandate: [...b.mandate, mandat('m-ganz', { chanceId: 'd-ganz', start: '2026-11-05' }), mandat('m-alt', { chanceId: 'd-alt', start: '2026-10-01' })],
      angebote: [...(b.angebote ?? []), angebot('ang-ganz-0001', { dealId: 'd-ganz' }), angebot('ang-alt-0001', { dealId: 'd-alt' })] }));
    await lauf('2026-11-06');
    const e = (await plan()).rechnungen.filter(r => r.angebotId === 'ang-ganz-0001');
    expect(e.map(r => r.id)).toEqual([einmalRechnungId('ang-ganz-0001')]);
    expect(e[0].positionen![0].einzelpreisCent).toBe(300000);
    expect((await plan()).rechnungen.some(r => r.angebotId === 'ang-alt-0001')).toBe(false);
    // Schon von Hand geschrieben (Knopf) → der Lauf legt keine zweite an.
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-hand', { chanceId: 'd-hand', start: '2026-12-01' })], angebote: [...(b.angebote ?? []), angebot('ang-hand-0001', { dealId: 'd-hand' })] }));
    expect((await re({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-hand-0001', nur: 'einmalig', anfrageId: neueAnf() })).status).toBe(200);
    await lauf('2026-12-02');
    expect((await plan()).rechnungen.filter(r => r.angebotId === 'ang-hand-0001')).toHaveLength(1);
    expect((await tasks()).some(t => t.id.startsWith('rve-m-hand-'))).toBe(false);
  }, 120_000);
});

describe('2 · Morgenlauf für Quartal, einmaliges Honorar, Tagessatz', () => {
  it('Quartal: EIN Entwurf über die drei Monate; der Knopf im zweiten Monat gibt ihn zurück', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-quart', { rechnungsrhythmus: 'quartal' })] }));
    await lauf('2026-11-02');
    const l = (await plan()).rechnungen.filter(r => r.mandatId === 'm-quart');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ leistungVon: '2026-11-01', leistungBis: '2027-01-31', status: 'geplant' });
    expect(l[0].positionen).toHaveLength(3);
    expect(l[0].netto).toBe(3000);
    expect((await tasks()).find(t => t.id === 'rv-m-quart-2026-11')?.title).toContain('bis');
    await lauf('2026-12-02');
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-quart')).toHaveLength(1);
    const knopf = await re({ aktion: 'neu', quelle: 'mandat', mandatId: 'm-quart', monat: '2026-12', anfrageId: neueAnf() });
    expect(knopf.status, JSON.stringify(knopf.d)).toBe(200);
    expect(knopf.d.rechnung.id).toBe(l[0].id);
  }, 120_000);
  it('einmaliges Honorar ohne Zahlplan: EIN Entwurf zum Beginn, danach nichts mehr', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-einmal', { honorar: { betrag: 2000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-11-10', ende: '2026-12-20' })] }));
    await lauf('2026-11-11');
    await lauf('2026-12-02');
    const l = (await plan()).rechnungen.filter(r => r.mandatId === 'm-einmal');
    expect(l).toHaveLength(1);
    expect(l[0].netto).toBe(2000);
  }, 120_000);
  it('Tagessatz: am Monatsersten Entwurf mit den Tagen aus der erfassten Zeit; ohne Zeit nur die Aufgabe mit Hinweis', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const tag = { honorar: { betrag: 800, basis: 'tag' as const, netto: true }, start: '2026-11-01' };
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-tag', tag), mandat('m-tag2', tag)] }));
    zeit['2026-11'] = { 'm-tag': 20 * 3600 };
    await lauf('2026-11-20');
    expect((await plan()).rechnungen.some(r => r.mandatId === 'm-tag')).toBe(false);
    await lauf('2026-12-01');
    const l = (await plan()).rechnungen.filter(r => r.mandatId === 'm-tag');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ leistungVon: '2026-11-01' });
    expect(l[0].positionen![0]).toMatchObject({ menge: 2.5, einheit: 'Tag', einzelpreisCent: 80000 });
    expect(l[0].positionen![0].text).toContain('erfassten Zeit');
    expect((await plan()).rechnungen.some(r => r.mandatId === 'm-tag2')).toBe(false);
    const t2 = (await tasks()).find(t => t.id === 'rv-m-tag2-2026-11');
    expect(t2?.description).toContain('keine Zeit erfasst');
    // Nichts doppelt.
    await lauf('2026-12-02');
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-tag')).toHaveLength(1);
  }, 120_000);
});

describe('3 · Selbstständigkeit: Mandat + Liquiplan wie Business — Business-Konto sieht nichts davon', () => {
  it('angenommen → Mandat + Posten mit der Firma der Selbstständigkeit; „nur Business“ bekommt weder Mandat noch Posten (GET) und darf nicht schreiben (403)', async () => {
    const { aendereCrm, ladeCrm } = await import('@/lib/crm/speicher');
    const { mitStand } = await import('@/lib/crm/angebot-server');
    await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal('d-selbst', { gesellschaft: 'kdc' } as Partial<Chance>)],
      angebote: [...(b.angebote ?? []), angebot('ang-selbst-0001', { gesellschaft: 'kdc', dealId: 'd-selbst', status: 'gestellt', positionen: [EINMAL] })] }));
    const a0 = ((await ladeCrm()).angebote ?? []).find(x => x.id === 'ang-selbst-0001')!;
    const a = await postAn(angebotRoute, '/api/crm/angebot', { aktion: 'annehmen', id: a0.id, stand: mitStand(a0).stand });
    expect(a.status, JSON.stringify(a.d)).toBe(200);
    expect(a.d.automatik, JSON.stringify(a.d.automatik)).toMatchObject({ angelegt: true, liquiplan: 1 });
    const m = (await ladeCrm()).mandate.find(x => x.chanceId === 'd-selbst')!;
    expect(m.gesellschaft).toBe('kdc');
    const posten = (await db.loadJson<{ posten: Planposten[] }>('liquiplan'))!.posten.filter(p => p.mandatId === m.id);
    expect(posten).toHaveLength(1);
    expect(posten[0].firmaId).toBe('kdc');
    // Volles Mitglied sieht es.
    const voll = await (await liquiRoute.GET(new Request('http://test/api/crm/liquiplan', { headers: sitzung('pa') }))).json();
    expect(voll.mandate.some((x: { id: string }) => x.id === m.id)).toBe(true);
    // Konto „nur Business“: nichts aus Privat — kein Mandat der Selbstständigkeit, kein Posten einer Privat-Firma, Schreiben 403.
    const biz = await (await liquiRoute.GET(new Request('http://test/api/crm/liquiplan', { headers: sitzung('pb') }))).json();
    expect(biz.ok).toBe(true);
    expect(biz.mandate.some((x: { gesellschaft: string }) => x.gesellschaft === 'kdc')).toBe(false);
    expect(JSON.stringify(biz)).not.toContain(m.id);
    expect(biz.mandate.length).toBeGreaterThan(0);
    const w = await postAn(liquiRoute, '/api/crm/liquiplan', { mandatId: m.id, aktion: 'anlegen' }, 'pb');
    expect(w.status).toBe(403);
  }, 120_000);
});
