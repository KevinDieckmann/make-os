// ─── 0-Punkt (Eröffnung) je Business-Gesellschaft (05.10., Kevin: „Bring in Business einen 0-Punkt rein“) ─────────────────────────
// Prüft: Eröffnung setzt Kontostand/Liquidität; Posten vor dem Stichtag zählen nicht, bleiben aber abrufbar; offene Posten der Eröffnung
// erscheinen; Business-Index vorher → nachher; Finanzplan-Startwert aus der Eröffnung, Handwert gewinnt; ohne Eröffnung bit-gleich; Rechte
// (fremder Haushalt, Business-Recht, Privat-Gesellschaft); Historie + Rückgängig. Eigener Datenordner, erfundene Personen und Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-nullpunkt-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-nullpunkt';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;

import { abEroeffnung, geltendeEroeffnungen, eroeffnungPruefen, kontoStartFuerPlan, kontoQuelle, archivZahlen, type Eroeffnung } from '@/lib/business/eroeffnung';
import { vorschau, type Firma, type Rechnung, type Zahlung, type Planposten } from '@/lib/make-one/liquiditaet';
import { rechneMit } from '@/lib/finanzen/szenarien';
import { planFix } from './fixtures/finanz-plan';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person?: string, body?: unknown, methode?: string) => new Request(`http://test${url}`, {
  method: methode ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
/** Berliner Tag relativ zu heute (die Route rechnet mit dem echten Heute). */
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

// ── Rein: die eine Wirkungsstelle ───────────────────────────────────────────────────────────────────────────────────────────────

const firmen = (): (Firma & { bank: string })[] => [
  { id: 'ug', name: 'MAKE', bank: '', kontostand: 5000, stand: '2026-09-01' },
  { id: 'kdv', name: 'KDV', bank: '', kontostand: 1000, stand: '2026-09-01' },
  { id: 'privat', name: 'Privat', bank: '', kontostand: 777, stand: '2026-09-01' },
];
const rechnungen = (): (Rechnung & { firmaId: string })[] => [
  { id: 'r-alt', firmaId: 'ug', kunde: 'Altkunde', titel: 'August', betrag: 2000, status: 'gestellt', datum: '2026-08-01', faellig: '2026-08-15' },
  { id: 'r-neu', firmaId: 'ug', kunde: 'Neukunde', titel: 'Oktober', betrag: 3000, status: 'gestellt', datum: '2026-10-01', faellig: '2026-10-20' },
  { id: 'r-bez', firmaId: 'ug', kunde: 'Altkunde', titel: 'Juli', betrag: 1200, status: 'bezahlt', datum: '2026-07-01', bezahltAm: '2026-07-20' },
  { id: 'r-kdv', firmaId: 'kdv', kunde: 'Holdingkunde', titel: 'Umlage', betrag: 900, status: 'gestellt', datum: '2026-08-01', faellig: '2026-08-20' },
];
const zahlungen = (): (Zahlung & { firmaId: string })[] => [
  { id: 'z-alt', firmaId: 'ug', an: 'Altlieferant', titel: 'August', betrag: 400, status: 'offen', faellig: '2026-08-10' },
  { id: 'z-neu', firmaId: 'ug', an: 'Neulieferant', titel: 'Oktober', betrag: 600, status: 'offen', faellig: '2026-10-15' },
];
const planposten = (): Planposten[] => [
  { id: 'p-einmal', titel: 'Messe August', betrag: -500, rhythmus: 'einmalig', ab: '2026-08-01', sicher: true, firmaId: 'ug' },
  { id: 'p-lauf', titel: 'Miete', betrag: -1000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'ug' },
  { id: 'p-endet', titel: 'Altvertrag', betrag: -200, rhythmus: 'monatlich', ab: '2026-01-01', bis: '2026-09-01', sicher: true, firmaId: 'ug' },
];
const er = (teil: Partial<Eroeffnung> = {}): Eroeffnung => ({
  id: 'er-1', firma: 'ug', stichtag: '2026-09-15', kontostand: 8000, gesetztVon: 'pa', gesetztAm: '2026-10-05T08:00:00.000Z',
  forderungen: [{ name: 'Kunde A', betrag: 1500, faellig: '2026-10-01' }], verbindlichkeiten: [{ name: 'Lieferant B', betrag: 300 }], ...teil,
});

describe('abEroeffnung — die eine Hilfsfunktion', () => {
  it('ohne Eröffnung: dieselben Listen (gleiche Objekte), Archiv leer — bit-gleich', () => {
    const b = { firmen: firmen(), rechnungen: rechnungen(), zahlungen: zahlungen(), planposten: planposten(), merkposten: [] };
    const a = abEroeffnung(b, {});
    expect(a.firmen).toBe(b.firmen); expect(a.rechnungen).toBe(b.rechnungen); expect(a.zahlungen).toBe(b.zahlungen); expect(a.planposten).toBe(b.planposten);
    expect(a.archiv).toEqual({ rechnungen: [], zahlungen: [], planposten: [] });
    expect(abEroeffnung(b, null).rechnungen).toBe(b.rechnungen);
  });

  it('mit Eröffnung: Konto = Anfangsbestand, Posten davor archiviert, offene Posten dazu — nur für diese Gesellschaft', () => {
    const g = geltendeEroeffnungen([er()]);
    const a = abEroeffnung({ firmen: firmen(), rechnungen: rechnungen(), zahlungen: zahlungen(), planposten: planposten() }, g);
    expect(a.firmen.map(f => [f.id, f.kontostand, f.stand])).toEqual([['ug', 8000, '2026-09-15'], ['kdv', 1000, '2026-09-01'], ['privat', 777, '2026-09-01']]);
    expect(a.archiv.rechnungen.map(r => r.id)).toEqual(['r-alt', 'r-bez']);
    expect(a.archiv.zahlungen.map(z => z.id)).toEqual(['z-alt']);
    expect(a.archiv.planposten.map(p => p.id)).toEqual(['p-einmal', 'p-endet']);
    expect(a.rechnungen.map(r => r.id)).toEqual(['r-neu', 'r-kdv', 'er-1-f1']); // KD Ventures ohne Eröffnung bleibt, wie sie ist
    expect(a.rechnungen.at(-1)).toMatchObject({ kunde: 'Kunde A', betrag: 1500, status: 'gestellt', faellig: '2026-10-01', firmaId: 'ug', eroeffnung: true });
    expect(a.zahlungen.map(z => z.id)).toEqual(['z-neu', 'er-1-v1']);
    expect(a.zahlungen.at(-1)).toMatchObject({ an: 'Lieferant B', betrag: 300, status: 'offen', firmaId: 'ug' });
    expect(a.planposten.map(p => p.id)).toEqual(['p-lauf']);
  });

  it('Liquiditätsvorschau startet beim Anfangsbestand; Überfälliges von vor dem Stichtag fällt heraus, die offene Forderung kommt rein', () => {
    const heute = '2026-10-05';
    const b = { firmen: firmen(), rechnungen: rechnungen(), zahlungen: zahlungen(), planposten: planposten(), merkposten: [] };
    const vorher = vorschau(b.firmen, b.rechnungen, b.zahlungen, b.merkposten, heute, 4, false, b.planposten, 'real', undefined, true);
    const a = abEroeffnung(b, geltendeEroeffnungen([er()]));
    const nachher = vorschau(a.firmen, a.rechnungen, a.zahlungen, a.merkposten, heute, 4, false, a.planposten, 'real', undefined, true);
    expect(vorher.start).toBe(6000); // MAKE 5.000 + KDV 1.000 (Privat zählt nie)
    expect(nachher.start).toBe(9000); // MAKE ab 0-Punkt 8.000 + KDV 1.000
    const texte = (v: typeof vorher) => v.wochen[0].bewegungen.map(x => x.text).join(' | ');
    expect(texte(vorher)).toContain('Altkunde'); expect(texte(vorher)).toContain('Altlieferant');
    expect(texte(nachher)).not.toContain('Altkunde'); expect(texte(nachher)).not.toContain('Altlieferant');
    expect(texte(nachher)).toContain('Kunde A');
    // Verbindlichkeit ohne Fälligkeit: wie jede offene Zahlung in zwei Wochen.
    expect(nachher.wochen.flatMap(w => w.bewegungen).find(x => x.text.startsWith('Lieferant B'))).toMatchObject({ betrag: -300, art: 'ausgang' });
  });

  it('ein später eingetragener Kontostand löst den Anfangsbestand ab; fehlt das Konto, entsteht es', () => {
    const f = firmen(); f[0] = { ...f[0], kontostand: 9100, stand: '2026-09-20' };
    const g = geltendeEroeffnungen([er()]);
    expect(kontoQuelle(f[0], g.ug!)).toBe('konto');
    expect(abEroeffnung({ firmen: f }, g).firmen[0].kontostand).toBe(9100);
    // Tag gleich dem Stichtag: die Eröffnung gilt (der Kontostand trägt keine Uhrzeit).
    expect(kontoQuelle({ ...f[0], stand: '2026-09-15' }, g.ug!)).toBe('eroeffnung');
    const ohneKdv = abEroeffnung({ firmen: firmen().filter(x => x.id !== 'kdv') }, geltendeEroeffnungen([er({ id: 'er-k', firma: 'kdv', kontostand: 250, forderungen: [], verbindlichkeiten: [] })]));
    expect(ohneKdv.firmen.find(x => x.id === 'kdv')).toMatchObject({ kontostand: 250, stand: '2026-09-15' });
  });

  it('Historie: der jüngste nicht zurückgenommene Eintrag gilt; zurückgenommen → der vorige; Privat-Einheit nie', () => {
    const a = er({ id: 'er-a', stichtag: '2026-09-01', gesetztAm: '2026-10-01T08:00:00.000Z' });
    const b = er({ id: 'er-b', stichtag: '2026-09-15', gesetztAm: '2026-10-02T08:00:00.000Z' });
    expect(geltendeEroeffnungen([a, b]).ug?.id).toBe('er-b');
    expect(geltendeEroeffnungen([a, { ...b, zurueckgenommenAm: '2026-10-03T08:00:00.000Z' }]).ug?.id).toBe('er-a');
    expect(geltendeEroeffnungen([{ ...a, zurueckgenommenAm: 'x' }, { ...b, zurueckgenommenAm: 'x' }]).ug).toBeUndefined();
    expect(geltendeEroeffnungen([er({ firma: 'kdc' as never })])).toEqual({});
  });

  it('Eingabe prüfen: Privat-Einheit und Unsinn abgelehnt, deutsche Zahlen, leere Zeilen fallen weg', () => {
    expect(eroeffnungPruefen({ firma: 'kdc', stichtag: '2026-10-01', kontostand: 1 }).ok).toBe(false);
    expect(eroeffnungPruefen({ firma: 'ug', stichtag: '01.10.2026', kontostand: 1 }).ok).toBe(false);
    expect(eroeffnungPruefen({ firma: 'ug', stichtag: '2026-10-01', kontostand: 'viel' }).ok).toBe(false);
    expect(eroeffnungPruefen({ firma: 'ug', stichtag: '2026-10-01', kontostand: 1, forderungen: [{ name: '', betrag: 5 }] }).ok).toBe(false);
    const p = eroeffnungPruefen({ firma: 'ug', stichtag: '2026-10-01', kontostand: '-12.500,50', forderungen: [{ name: 'X', betrag: '1.000,25' }, { name: '', betrag: '' }] });
    expect(p).toEqual({ ok: true, daten: { firma: 'ug', stichtag: '2026-10-01', kontostand: -12500.5, forderungen: [{ name: 'X', betrag: 1000.25 }] } });
  });

  it('Archiv zählt je Gesellschaft (Rechnungen, Zahlungen, Planposten, Abschlüsse, Buchungen)', () => {
    const z = archivZahlen(geltendeEroeffnungen([er()]), {
      rechnungen: rechnungen(), zahlungen: zahlungen(), planposten: planposten(),
      abschluesse: [{ firma: 'ug', monat: '2026-08' }, { firma: 'ug', monat: '2026-09' }, { firma: 'kdv', monat: '2026-08' }],
      buchungen: [{ datum: '2026-09-01', ort: 'ug' }, { datum: '2026-09-20', ort: 'ug' }, { datum: '2026-09-01', ort: 'privat' }],
    });
    expect(z).toEqual({ ug: { rechnungen: 2, zahlungen: 1, planposten: 2, abschluesse: 1, buchungen: 1, gesamt: 7 } });
  });
});

describe('Finanzplanung: Kontostand-Startwert aus der Eröffnung', () => {
  it('Plan-Monat aus dem Stichtag (vor dem Plan → 1, nach dem Plan → keiner), nur MAKE/KD Ventures', () => {
    const g = geltendeEroeffnungen([er({ stichtag: '2026-12-10' }), er({ id: 'er-k', firma: 'kdv', stichtag: '2026-05-01', kontostand: 40, gesetztAm: '2026-10-05T09:00:00.000Z' })]);
    expect(kontoStartFuerPlan(g, 24)).toEqual({ ug: { monat: 3, betrag: 8000, stichtag: '2026-12-10' }, kdv: { monat: 1, betrag: 40, stichtag: '2026-05-01' } });
    expect(kontoStartFuerPlan(geltendeEroeffnungen([er({ stichtag: '2030-01-01' })]), 24)).toBeUndefined();
    expect(kontoStartFuerPlan({}, 24)).toBeUndefined();
  });

  it('Konto startet im Stichtag-Monat beim Anfangsbestand, Monate davor unverändert; ohne Eröffnung bit-gleich; Handwert gewinnt', () => {
    const d = planFix();
    const ohne = rechneMit(d, null);
    expect(JSON.stringify(rechneMit({ ...d, eroeffnung: undefined }, null).ug)).toBe(JSON.stringify(ohne.ug));
    const mit = rechneMit({ ...d, eroeffnung: { ug: { monat: 3, betrag: 50_000, stichtag: '2026-12-01' }, kdv: { monat: 2, betrag: 7_000, stichtag: '2026-11-01' } } }, null);
    // Vor dem Stichtag-Monat: gleich.
    expect(mit.ug[0].konto).toBe(ohne.ug[0].konto); expect(mit.ug[1].konto).toBe(ohne.ug[1].konto);
    expect(mit.ug[0].kdvKonto).toBe(ohne.ug[0].kdvKonto);
    // Im Stichtag-Monat: Anfangsbestand + Saldo des Monats; danach um dieselbe Differenz verschoben.
    expect(mit.ug[2].konto).toBeCloseTo(50_000 + ohne.ug[2].saldo, 6);
    const diff = mit.ug[2].konto - ohne.ug[2].konto;
    expect(mit.ug[5].konto - ohne.ug[5].konto).toBeCloseTo(diff, 6);
    expect(mit.ug[1].kdvKonto - ohne.ug[1].kdvKonto).toBeCloseTo(7_000 - ohne.ug[0].kdvKonto, 6);
    // Handwert im Stichtag-Monat gewinnt weiter.
    const hand = rechneMit({ ...d, plan: { ...d.plan, 'ug.konto:3': 123 }, eroeffnung: { ug: { monat: 3, betrag: 50_000, stichtag: '2026-12-01' } } }, null);
    expect(hand.ug[2].konto).toBe(123);
  });
});

// ── Schnittstellen: Route, Business-Index, Finanzplanung, Rechte ─────────────────────────────────────────────────────────────────

let db: typeof import('@/lib/store/local-db');
let eroeffnung: Route, business: Route, finanzplan: Route;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  eroeffnung = await import('@/app/api/business/eroeffnung/route') as Route;
  business = await import('@/app/api/business/route') as Route;
  finanzplan = await import('@/app/api/finanzplan/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
    { id: '4', speicher: 'po', email: 'po@example.invalid', name: 'Ohne Haushalt', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01' },
  ], einladungen: [] });
  await db.saveJson('finanzplan', {
    firmen: [
      { id: 'ug', name: 'MAKE', bank: '', kontostand: 5000, stand: tag(-60) },
      { id: 'kdv', name: 'KDV', bank: '', kontostand: 1000, stand: tag(-60) },
      { id: 'privat', name: 'Privat', bank: '', kontostand: 777, stand: tag(-60) },
    ],
    rechnungen: [
      { id: 'r-alt', firmaId: 'ug', kunde: 'Altkunde', titel: 'alt', betrag: 2000, status: 'gestellt', datum: tag(-40), faellig: tag(-30) },
      { id: 'r-neu', firmaId: 'ug', kunde: 'Neukunde', titel: 'neu', betrag: 3000, status: 'gestellt', datum: tag(-5), faellig: tag(20) },
    ],
    zahlungen: [{ id: 'z-alt', firmaId: 'ug', an: 'Altlieferant', titel: 'alt', betrag: 400, status: 'offen', faellig: tag(-35) }],
    merkposten: [], produkte: [],
  });
  await db.saveJson('liquiplan', { posten: [{ id: 'p-lauf', titel: 'Miete', betrag: -1000, rhythmus: 'monatlich', ab: '2025-01-01', sicher: true, firmaId: 'ug' }] });
  // Ein Abschluss deutlich vor dem Stichtag (Kosten 2.500) — trägt vorher die Monatskosten der Liquidität.
  await db.saveJson('business-abschluesse', { eintraege: [{ firma: 'ug', monat: tag(-70).slice(0, 7), umsatz: 1000, kosten: 2500, von: 'pa', am: '2026-09-02T10:00:00.000Z' }] });
  await db.saveJson('finanzen-plan--h-pruef', planFix());
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const kennzahl = async (scope: string, id: string) => {
  const j = await (await business.GET!(anfrage(`/api/business?scope=${scope}&kompakt=1`, 'pa'))).json();
  return j.bi.saeulen.flatMap((s: { kennzahlen: { id: string }[] }) => s.kennzahlen).find((k: { id: string }) => k.id === id) as { wert: number | null; quelle?: string; luecke?: string };
};

describe('Route /api/business/eroeffnung + Wirkung im Business-Index', () => {
  let vorherIndex = '';
  it('vorher: Liquidität = 5.000 ÷ 2.500 (Abschluss), überfällig 40 % (die alte Rechnung)', async () => {
    vorherIndex = JSON.stringify((await (await business.GET!(anfrage('/api/business?scope=ug&kompakt=1', 'pa'))).json()).bi);
    expect((await kennzahl('ug', 'liquiditaet')).wert).toBeCloseTo(2, 6);
    expect((await kennzahl('ug', 'ueberfaellig')).wert).toBeCloseTo(40, 6);
  });

  it('Rechte: fremder Haushalt, ohne Haushalt, ohne Person → 403; Privat-Einheit/Privat → 400; Business-Recht darf', async () => {
    for (const p of ['px', 'po', undefined]) {
      expect((await eroeffnung.GET!(anfrage('/api/business/eroeffnung', p))).status).toBe(403);
      expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', p, { aktion: 'setzen', firma: 'ug', stichtag: tag(-10), kontostand: 1 }))).status).toBe(403);
    }
    const kdc = await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'kdc', stichtag: tag(-10), kontostand: 1 }));
    expect(kdc.status).toBe(400); expect((await kdc.json()).fehler).toMatch(/Privat/);
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'privat', stichtag: tag(-10), kontostand: 1 }))).status).toBe(400);
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'unbekannt', firma: 'ug' }))).status).toBe(400);
    // Konto mit Finanzrecht „business“ im Haushalt: sieht und darf (Business-Buchführung) — hier für KD Ventures.
    const g = await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pt'));
    expect(g.status).toBe(200); expect((await g.json()).darf).toBe(true);
    const k = await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pt', { aktion: 'setzen', firma: 'kdv', stichtag: tag(-10), kontostand: '1.000' }));
    expect(k.status).toBe(200);
    // Ohne Änderung an KD Ventures' Zahlen (Kontostand gleich) — zurücknehmen, damit der Vergleich unten nur MAKE betrifft.
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pt', { aktion: 'zuruecknehmen', firma: 'kdv' }))).status).toBe(200);
  });

  it('setzen: Hinweis auf archivierte Posten; Kontostand/Liquidität ab Anfangsbestand; Überfälliges weg, offene Forderung zählt', async () => {
    const r = await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', {
      aktion: 'setzen', firma: 'ug', stichtag: tag(-10), kontostand: 8000, basis: null,
      forderungen: [{ name: 'Kunde A', betrag: 1500, faellig: tag(10) }], verbindlichkeiten: [{ name: 'Lieferant B', betrag: '300' }],
    }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.archiv.ug).toEqual({ rechnungen: 1, zahlungen: 1, planposten: 0, abschluesse: 1, buchungen: 0, gesamt: 3 });
    // Liquidität: 8.000 ÷ 1.000 (der Abschluss vor dem Stichtag zählt nicht, die Miete trägt die Monatskosten).
    expect((await kennzahl('ug', 'liquiditaet')).wert).toBeCloseTo(8, 6);
    // Überfällig: nichts mehr (alte Rechnung archiviert); offen = Neukunde 3.000 + Kunde A 1.500.
    const u = await kennzahl('ug', 'ueberfaellig');
    expect(u.wert).toBe(0);
    expect((await kennzahl('gesamt', 'liquiditaet')).quelle).toContain('9.000'); // MAKE 8.000 + KDV 1.000
    // Dieselbe Hilfe serverseitig (Fluss, Head of Finance, Schilde, Startfläche, Kasse): Konto ab 0-Punkt, alte Posten raus, offene rein.
    const { mitEroeffnung } = await import('@/lib/business/eroeffnung-server');
    const ab = await mitEroeffnung((await db.loadJson<{ firmen: Firma[]; rechnungen: (Rechnung & { firmaId: string })[]; zahlungen: (Zahlung & { firmaId: string })[] }>('finanzplan'))!);
    expect(ab.firmen.find(f => f.id === 'ug')?.kontostand).toBe(8000);
    expect(ab.rechnungen.map(x => x.kunde)).toEqual(['Neukunde', 'Kunde A']);
    expect(ab.zahlungen.map(x => x.an)).toEqual(['Lieferant B']);
  });

  it('nichts gelöscht: die alten Posten stehen im Bestand und im Archiv der Route', async () => {
    const fp = (await db.loadJson<{ rechnungen: { id: string }[]; zahlungen: { id: string }[] }>('finanzplan'))!;
    expect(fp.rechnungen.map(x => x.id)).toEqual(['r-alt', 'r-neu']);
    expect(fp.zahlungen.map(x => x.id)).toEqual(['z-alt']);
    const j = await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json();
    expect(j.archiv.posten.ug.rechnungen.map((x: { id: string }) => x.id)).toEqual(['r-alt']);
    expect(j.archiv.posten.ug.zahlungen.map((x: { id: string }) => x.id)).toEqual(['z-alt']);
    expect(j.archiv.posten.ug.abschluesse).toHaveLength(1);
    // Kurzform für rechnende Ansichten: nur die geltenden Eröffnungen.
    const kurz = await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung?nur=geltend', 'pa'))).json();
    expect(Object.keys(kurz).sort()).toEqual(['geltend', 'ok']); expect(kurz.geltend.ug.kontostand).toBe(8000);
    expect((await eroeffnung.GET!(anfrage('/api/business/eroeffnung?nur=geltend', 'px'))).status).toBe(403);
    // Die Abschluss-Karte zeigt ihn weiter (mit Stichtag zum Kennzeichnen).
    const voll = await (await business.GET!(anfrage('/api/business?scope=ug', 'pa'))).json();
    expect(voll.abschluesse).toHaveLength(1);
    expect(voll.stichtage).toEqual({ ug: tag(-10) });
  });

  it('Finanzplanung: das Dokument trägt den Startwert (nie gespeichert); ein Schritt auf /eroeffnung → 400', async () => {
    const r = await finanzplan.GET!(anfrage('/api/finanzplan', 'pa'));
    const d = (await r.json()).dokument;
    expect(d.eroeffnung.ug).toMatchObject({ betrag: 8000, stichtag: tag(-10) });
    const roh = await db.loadJson<Record<string, unknown>>('finanzen-plan--h-pruef');
    expect(roh && 'eroeffnung' in roh).toBe(false);
    const p = await finanzplan.PATCH!(anfrage('/api/finanzplan', 'pa', { basisStand: d.stand, ops: [{ pfad: '/eroeffnung/ug/betrag', neu: 1 }] }, 'PATCH'));
    expect(p.status).toBe(400);
  });

  it('Historie + Rückgängig: Änderung = neuer Eintrag, veraltete Basis → 409, zurücknehmen → ohne Eröffnung bit-gleich wie vorher', async () => {
    const vorher = await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json();
    const basis = vorher.geltend.ug.id;
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'ug', stichtag: tag(-10), kontostand: 8100, basis: 'er-veraltet' }))).status).toBe(409);
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'ug', stichtag: tag(-10), kontostand: 8100, basis }))).status).toBe(200);
    const j = await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json();
    expect(j.eintraege.filter((e: Eroeffnung) => e.firma === 'ug')).toHaveLength(2);
    expect(j.geltend.ug.kontostand).toBe(8100);
    // Rückgängig: die vorige (8.000) gilt wieder.
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'zuruecknehmen', firma: 'ug', basis: j.geltend.ug.id }))).status).toBe(200);
    expect((await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json()).geltend.ug.kontostand).toBe(8000);
    // Und noch einmal: keine Eröffnung mehr — der Index ist bit-gleich wie vor dem 0-Punkt; die Historie bleibt (3 ug-Einträge + 1 kdv).
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'zuruecknehmen', firma: 'ug' }))).status).toBe(200);
    const leer = await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json();
    expect(leer.geltend).toEqual({});
    expect(leer.eintraege).toHaveLength(3);
    expect(JSON.stringify((await (await business.GET!(anfrage('/api/business?scope=ug&kompakt=1', 'pa'))).json()).bi)).toBe(vorherIndex);
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'zuruecknehmen', firma: 'ug' }))).status).toBe(400);
  });
});
