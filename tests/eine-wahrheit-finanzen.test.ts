// ─── Eine Wahrheit: Runway und Ist-Monate überall gleich (17.10., L2 R1/R2/R6/C2) ─────────────────────────────────────────────────
// Vorher gab es zwei Eingangswege: der Business-Index (Cockpit) rechnete die Runway aus `istMonate` (12 Monate, Abschluss nur, wenn ALLE
// Firmen einen haben, Kasse nur aus Konten, 0-Punkt), `computeMetrics` (ZOE, Board, Loop, OKR, Schilde, Analyse) aus den Controlling-Monaten
// (mit `mitAbschluessen` schon bei EINER Firma, ohne 0-Punkt, Brain sogar mit dem alten Feld `cash`). Jetzt: EINE Runway (`runwayDesIndex`),
// EINE Lesestelle der Monate (`ladeControlling` → `mitAbschluessen` mit derselben Regel und dem 0-Punkt). Erfundene Personen und Zahlen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-eine-wahrheit-finanzen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-eine-wahrheit';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
delete process.env.ANTHROPIC_API_KEY;

import { computeMetrics, mitAbschluessen, DEFAULT_FINANCE, type FinanceState } from '@/lib/make-one/finance-data';
import { runwayRechnen, runwayAnzeige } from '@/lib/finanzen/runway';

const HEUTE = '2026-10-17';
const anfrage = (url: string, person: string, body?: unknown) => new Request(`http://test${url}`, {
  method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const ab = (firma: string, monat: string, umsatz: number, kosten: number) => ({ firma, monat, umsatz, kosten, von: 'pa', am: '2026-10-02T10:00:00.000Z' });

// Controlling von Hand: profitabel (5.000 Umsatz, 1.000 Kosten) Jan–Sep, dazu das alte Feld `cash` 50.000.
const finance: FinanceState = { ...DEFAULT_FINANCE, jahr: 2026, zielUmsatz: 120000, cash: 50000, months: DEFAULT_FINANCE.months.map((m, i) => (i < 9 ? { ...m, umsatz: 5000, kosten: 1000 } : { ...m })) };
const abschluesse = [
  ab('ug', '2026-02', 99999, 1),          // vor dem 0-Punkt — archiviert, zählt nicht
  ab('ug', '2026-06', 100, 200),          // nur EINE Firma — dann gilt das gepflegte Controlling (wie im Index)
  ...['2026-07', '2026-08', '2026-09'].flatMap(m => [ab('ug', m, 2000, 3400), ab('kdv', m, 0, 1000)]), // beide Firmen: 2.400 Netto-Verbrauch je Monat
];
const eroeffnung = (firma: string) => ({ id: `er-${firma}`, firma, stichtag: '2026-03-01', kontostand: 1, gesetztVon: 'pa', gesetztAm: '2026-10-05T08:00:00.000Z', forderungen: [], verbindlichkeiten: [] });

let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HEUTE}T10:00:00Z`));
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pa', 'inhaber', 'h-pruef'), konto('k2', 'pb', 'mitglied', 'h-pruef'), konto('k3', 'px', 'mitglied', 'h-fremd')], einladungen: [] });
  // Kasse = 6.000 + 3.000 (Kontostände NACH dem Stichtag gelten, `kontoQuelle`); privat zählt nie.
  await db.saveJson('finanzplan', {
    firmen: [
      { id: 'ug', name: 'MAKE', bank: '', kontostand: 6000, stand: '2026-10-01' },
      { id: 'kdv', name: 'KDV', bank: '', kontostand: 3000, stand: '2026-10-01' },
      { id: 'privat', name: 'Privat', bank: '', kontostand: 777777, stand: '2026-10-01' },
    ],
    rechnungen: [], zahlungen: [], merkposten: [], produkte: [],
  });
  await db.saveJson('finance', finance);
  await db.saveJson('business-abschluesse', { eintraege: abschluesse });
  await db.saveJson('business-eroeffnung', { eintraege: [eroeffnung('ug'), eroeffnung('kdv')] });
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('vorher: zwei Wege, zwei Zahlen', () => {
  it('die alte Brain-Runway (Feld `cash`) und die alte Controlling-Ist-Summe wichen vom Cockpit ab', () => {
    // Brain rechnete computeMetrics(fin) OHNE Konten-Kasse: 50.000 ÷ 2.400 ≈ 20,8 — das Cockpit 9.000 ÷ 2.400 = 3,75.
    const netto = [{ umsatz: 2000, kosten: 4400 }, { umsatz: 2000, kosten: 4400 }, { umsatz: 2000, kosten: 4400 }];
    expect(runwayAnzeige(runwayRechnen(50000, netto))).toBe('20,8 Monate');
    expect(runwayAnzeige(runwayRechnen(9000, netto))).toBe('3,8 Monate');
  });
});

describe('jetzt: EINE Runway — Cockpit, Controlling, Head of Finance, Schilde, ZOE, Board, Analyse', () => {
  it('überall „3,8 Monate“ (Kasse der Business-Konten ÷ Ø Netto-Verbrauch Jul–Sep)', async () => {
    const { runwayDesIndex } = await import('@/lib/business/fuer-chef');
    const index = await runwayDesIndex(HEUTE);
    expect(index).toMatchObject({ gemessen: true, keinVerbrauch: false });
    expect(index!.monate).toBeCloseTo(3.75, 6);
    expect(index!.anzeige).toBe('3,8 Monate');

    // Controlling (vom Server mitgeliefert)
    const route = await import('@/app/api/state/finance/route');
    const g = await (await route.GET(anfrage('/api/state/finance', 'pa'))).json();
    expect(g.runwayIst.anzeige).toBe(index!.anzeige);

    // Head of Finance
    const { ladeFinanzbild } = await import('@/lib/finanzen/chef/lauf');
    const hof = (await ladeFinanzbild('h-pruef', HEUTE)).bild.business.controlling!;
    expect(hof.runway_anzeige).toBe(index!.anzeige);
    expect(hof.runway_monate).toBeCloseTo(3.75, 2);

    // Schilde (3,75 < 2 × Kompass-Grenze → gelb) — derselbe Text
    const { computeShields } = await import('@/lib/risk');
    const schild = (await computeShields(HEUTE, 'pa')).find(s => s.id === 'runway');
    expect(schild?.text).toContain(`Runway ${index!.anzeige}`);

    // ZOE (Brain) — nicht mehr 20,8 aus dem alten Feld
    const { gatherBrain, blockZahlen } = await import('@/lib/brain');
    const brain = await gatherBrain(HEUTE, 'pa');
    expect(brain.runway?.anzeige).toBe(index!.anzeige);
    expect(JSON.stringify(brain.metrics)).not.toMatch(/runway/i);
    expect(blockZahlen(brain)).toContain(`Runway ${index!.anzeige}`);

    // Board (ohne Modell-Schlüssel: nur die Kennzahlen)
    const board = await import('@/app/api/board/route');
    const b = await (await board.POST(anfrage('/api/board', 'pa', {}))).json();
    expect(b.stats.finance.runway).toBeCloseTo(3.75, 6);
    expect(b.stats.finance.runwayAnzeige).toBe(index!.anzeige);

    // Controlling-Analyse (ohne Körper, wie ZOE/Agent sie ruft)
    const analyse = await import('@/app/api/controlling/analyse/route');
    const a = await (await analyse.POST(anfrage('/api/controlling/analyse', 'pa', {}))).json();
    expect(a.runway.anzeige).toBe(index!.anzeige);
  });

  it('eine Person aus einem anderen Haushalt bekommt im Brain weder Controlling noch Runway', async () => {
    const { gatherBrain } = await import('@/lib/brain');
    const b = await gatherBrain(HEUTE, 'px');
    expect(b.finance).toBeNull();
    expect(b.runway).toBeNull();
  });
});

describe('jetzt: EINE Lesestelle der Ist-Monate (mit Monatsabschlüssen und 0-Punkt)', () => {
  it('Controlling-Monate = Ist-Monate des Business-Index; vor dem 0-Punkt nichts; Teil-Abschluss → gepflegtes Controlling', async () => {
    const { ladeControlling } = await import('@/lib/finanzen/controlling-server');
    const c = (await ladeControlling())!;
    expect(c.months.slice(0, 2).map(m => [m.umsatz, m.kosten])).toEqual([[0, 0], [0, 0]]); // Jan, Feb: vor dem 0-Punkt
    expect([c.months[5].umsatz, c.months[5].kosten]).toEqual([5000, 1000]);                // Jun: nur MAKE → Controlling
    expect([c.months[8].umsatz, c.months[8].kosten]).toEqual([2000, 4400]);                // Sep: beide Firmen

    const { ladeRoh, bestandFuer } = await import('@/lib/business/speicher');
    const { istMonate } = await import('@/lib/business/messen');
    const ist = istMonate(bestandFuer(await ladeRoh(HEUTE), 'gesamt'));
    for (let i = 0; i < 9; i++) {
      const key = `2026-${String(i + 1).padStart(2, '0')}`;
      const im = ist.find(x => x.monat === key);
      expect([im?.umsatz ?? 0, im?.kosten ?? 0], key).toEqual([c.months[i].umsatz, c.months[i].kosten]);
    }
  });

  it('Ist-Umsatz: Controlling, Head of Finance und Cockpit (Run-Rate) zeigen dieselbe Summe — vorher 126.099 / 35.000', async () => {
    const { ladeControlling } = await import('@/lib/finanzen/controlling-server');
    const ist = computeMetrics((await ladeControlling())!, new Date(`${HEUTE}T12:00:00`)).istUmsatz;
    expect(ist).toBe(26000); // Mär–Mai 15.000 + Jun 5.000 + Jul–Sep 6.000
    // Vorher (ohne 0-Punkt, Abschluss schon bei einer Firma): 5.000 + 99.999 + 15.000 + 100 + 6.000.
    const vorher = computeMetrics({ ...finance, months: finance.months.map((m, i) => (i === 1 ? { ...m, umsatz: 99999, kosten: 1 } : i === 5 ? { ...m, umsatz: 100, kosten: 200 } : i >= 6 && i <= 8 ? { ...m, umsatz: 2000, kosten: 4400 } : m)) }, new Date(`${HEUTE}T12:00:00`)).istUmsatz;
    expect(vorher).toBe(126099);

    const route = await import('@/app/api/state/finance/route');
    const g = await (await route.GET(anfrage('/api/state/finance', 'pa'))).json();
    expect(computeMetrics(g.state, new Date(`${HEUTE}T12:00:00`)).istUmsatz).toBe(ist);
    expect(g.nullpunkt).toBe('2026-03');

    const { ladeFinanzbild } = await import('@/lib/finanzen/chef/lauf');
    expect((await ladeFinanzbild('h-pruef', HEUTE)).bild.business.controlling!.ist_umsatz).toBe(ist);

    const { sichtenFuerChef } = await import('@/lib/business/fuer-chef');
    const rr = (await sichtenFuerChef(HEUTE)).alle.gesamt.saeulen.flatMap(s => s.kennzahlen).find(k => k.id === 'run_rate')!;
    expect(rr.details?.find(d => d.titel === 'Ist seit Januar')?.wert).toMatch(/26\.000/);
  });

  it('`mitAbschluessen` folgt derselben Regel wie der Index (rein)', () => {
    const f: FinanceState = { ...DEFAULT_FINANCE, jahr: 2026, months: DEFAULT_FINANCE.months.map(m => ({ ...m, umsatz: 10, kosten: 5 })) };
    const r = mitAbschluessen(f, [ab('ug', '2026-01', 1, 1), ab('ug', '2026-02', 7, 3), ab('kdv', '2026-02', 4, 3)], { abschlussVor: () => false, abMonat: null });
    expect(r.months[0]).toMatchObject({ umsatz: 10, kosten: 5 }); // nur eine Firma + gepflegter Wert → gepflegt
    expect(r.months[1]).toMatchObject({ umsatz: 11, kosten: 6 }); // beide Firmen → Summe der Abschlüsse
    // 0-Punkt: Abschluss davor zählt nicht, Monate davor auch nicht.
    const n = mitAbschluessen(f, [ab('ug', '2026-02', 7, 3), ab('kdv', '2026-02', 4, 3)], { abschlussVor: a => a.monat < '2026-03', abMonat: '2026-03' });
    expect(n.months.slice(0, 2).map(m => m.umsatz + m.kosten)).toEqual([0, 0]);
    expect(n.months[2]).toMatchObject({ umsatz: 10, kosten: 5 });
    const leer = { ...f, months: f.months.map(m => ({ ...m, umsatz: 0, kosten: 0 })) };
    expect(mitAbschluessen(leer, [ab('ug', '2026-01', 1, 1)], null).months[0]).toMatchObject({ umsatz: 1, kosten: 1 }); // ohne gepflegten Wert: die Firma, die es gibt
  });
});
