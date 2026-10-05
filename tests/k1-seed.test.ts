// ─── Paket K1 (28.09.) — Startbestände ohne echte Daten; bestehende Bestände bleiben unberührt ──
// Eigener Datenordner, erfundene Werte. Der SEED greift nur bei leerem Speicher — ein vorhandener
// Plan (auch einer mit eigenen Rechnungen und Merkposten) wird nicht angefasst.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k1-seed-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k1-seed';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
let finanzplan: { GET: Handler }, kunden: { GET: Handler }, meilensteine: { GET: Handler };
let db: typeof import('@/lib/store/local-db');
let bestand: typeof import('@/lib/finanzen/finanzplan-bestand');
const kevin = () => new Request('http://test/api/state/x', { headers: { 'x-make-user': 'kevin' } });
const datei = (n: string) => path.join(ordner, `${n}.json`);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  bestand = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-seed' }], einladungen: [] });
  finanzplan = (await import('@/app/api/state/finanzplan/route')) as unknown as { GET: Handler };
  kunden = (await import('@/app/api/state/kunden/route')) as unknown as { GET: Handler };
  meilensteine = (await import('@/app/api/state/meilensteine/route')) as unknown as { GET: Handler };
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Finanzplan-SEED: nur Struktur', () => {
  it('keine Rechnungen, keine Merkposten, keine Beträge, keine Bank', () => {
    const s = bestand.SEED;
    expect(s.rechnungen).toEqual([]);
    expect(s.merkposten).toEqual([]);
    expect(s.zahlungen).toEqual([]);
    // Seit 28.09. auch das (leere) Konto der MAKE Innovation GmbH — Rechnungen aus UG-Mandaten landen dort.
    expect(s.firmen.map(f => f.id)).toEqual(['kdv', 'kdc', 'ug']);
    expect(s.firmen.every(f => f.bank === '' && f.kontostand === null)).toBe(true);
    expect(s.produkte.every(p => p.preis === 0)).toBe(true);
  });

  it('leerer Speicher → neuer Plan startet ohne Rechnungen und Merkposten', async () => {
    const r = await finanzplan.GET(kevin());
    expect(r.status).toBe(200);
    const plan = await r.json() as { rechnungen: unknown[]; merkposten: unknown[]; firmen: { id: string }[] };
    expect(plan.rechnungen).toEqual([]);
    expect(plan.merkposten).toEqual([]);
    expect(plan.firmen.map(f => f.id)).toEqual(['kdv', 'kdc', 'ug']);
  });

  it('bestehender Plan wird nicht angefasst (Datei bleibt Byte für Byte gleich)', async () => {
    const eigener = {
      ...bestand.SEED,
      firmen: [{ id: 'kdc', name: 'Eigene Firma', bank: 'Testbank', kontostand: 1234, stand: '2026-09-01' }],
      rechnungen: [{ id: 'r-eigen', firmaId: 'kdc', kunde: 'Beispiel AG', titel: 'Leistung', betrag: 500, status: 'gestellt' }],
      merkposten: [{ id: 'm-eigen', firmaId: 'kdc', titel: 'Merkposten', betrag: 42, art: 'sonstig' }],
    };
    await db.saveJson('finanzplan', eigener);
    const vorher = readFileSync(datei('finanzplan'), 'utf8');
    await finanzplan.GET(kevin());
    expect(readFileSync(datei('finanzplan'), 'utf8')).toBe(vorher);
  });

  it('alter Plan ohne Produkte: nur Produkte/Agenda werden nachgezogen, eigene Listen bleiben', async () => {
    await db.saveJson('finanzplan', { firmen: [{ id: 'kdc', name: 'Eigene Firma', bank: 'Testbank', kontostand: 1, stand: null }], rechnungen: [{ id: 'r-eigen', firmaId: 'kdc', kunde: 'Beispiel AG', titel: 'Leistung', betrag: 500, status: 'gestellt' }], merkposten: [{ id: 'm-eigen', firmaId: 'kdc', titel: 'Merkposten', betrag: 42, art: 'sonstig' }], zahlungen: [] });
    await finanzplan.GET(kevin());
    const f = await db.loadJson<{ rechnungen: { id: string }[]; merkposten: { id: string }[]; firmen: { bank: string }[]; produkte: unknown[] }>('finanzplan');
    expect(f!.rechnungen.map(r => r.id)).toEqual(['r-eigen']);
    expect(f!.merkposten.map(m => m.id)).toEqual(['m-eigen']);
    expect(f!.firmen[0].bank).toBe('Testbank');
    expect(f!.produkte.length).toBeGreaterThan(0);
  });
});

describe('Kunden und Meilensteine: kein Startbestand mehr', () => {
  it('leerer Speicher → leere Liste, es wird nichts angelegt', async () => {
    const k = await (await kunden.GET(kevin())).json() as { kunden: unknown[] };
    expect(k.kunden).toEqual([]);
    expect(existsSync(datei('kunden'))).toBe(false);
    const m = await (await meilensteine.GET(kevin())).json() as { meilensteine: unknown[] };
    expect(m.meilensteine).toEqual([]);
    expect(existsSync(datei('meilensteine'))).toBe(false);
  });
  it('bestehende Kunden bleiben, wie sie sind', async () => {
    await db.saveJson('kunden', { kunden: [{ id: 'kd-1', name: 'Beispiel AG', status: 'aktiv' }] });
    const vorher = readFileSync(datei('kunden'), 'utf8');
    const k = await (await kunden.GET(kevin())).json() as { kunden: { id: string }[] };
    expect(k.kunden.map(x => x.id)).toEqual(['kd-1']);
    expect(readFileSync(datei('kunden'), 'utf8')).toBe(vorher);
  });
});
