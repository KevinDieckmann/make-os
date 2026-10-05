// ─── Sport · Route: je Person, Schritte, ETag, Vitalwerte zum Vorbelegen ────
// Eigener Datenordner, erfundene Werte — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay } from '@/lib/zeit';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-sport-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-sport';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

// Berliner Tag wie der Server (29.09., Paket D-B) — vorher UTC-Tag: zwischen 0 und 2 Uhr rot.
const H = localDay();
const kopf = (person?: string) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) });
const req = (person: string | undefined, body?: unknown, extra: Record<string, string> = {}) =>
  new Request('http://test/api/sport', { method: body ? 'PUT' : 'GET', headers: { ...kopf(person), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });

type Mod = { GET: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response> };
let route: Mod; let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/sport/route')) as unknown as Mod;
  // Erfundene Vitalwerte für die Prüfperson (Whoop-Format des Morgen-Checks).
  await db.saveJson('vitals--pruefling', { [H]: { rec: 71, sleep: 7.4, hrv: 61, rhr: 52 }, '2020-01-01': { rec: 50 } });
  // Art. 9 (05.10.): Sport schreibt nur mit der Einwilligung (a) der Person — die Prüfperson willigt ein.
  const e = await import('@/lib/datenschutz/gesundheit-einwilligung');
  await e.gesundheitErklaeren('pruefling', 'verarbeiten', true, e.GESUNDHEIT_FASSUNG);
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Sport-Route', () => {
  it('ohne Person: 401', async () => {
    expect((await route.GET(req(undefined))).status).toBe(401);
    expect((await route.PUT(req(undefined, { ops: [] }))).status).toBe(401);
  });
  it('leerer Start: Einstieg offen, Vitalwerte der letzten 14 Tage dabei, Bibliothek dabei', async () => {
    const r = await route.GET(req('pruefling'));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ok).toBe(true); expect(d.ich).toBe('pruefling');
    expect(d.stand.einstieg.fertig).toBe(false);
    expect(d.vitals[H]).toEqual({ schlafH: 7.4, hrv: 61, ruhepuls: 52, recovery: 71 });
    expect(d.vitals['2020-01-01']).toBeUndefined();
    expect(d.bibliothek.uebungen.length).toBeGreaterThan(5);
  });
  it('Schritte schreiben, ETag springt, danach 304', async () => {
    const r1 = await route.GET(req('pruefling'));
    const etag1 = r1.headers.get('etag')!;
    expect((await route.GET(req('pruefling', undefined, { 'if-none-match': etag1 }))).status).toBe(304);
    const p = await route.PUT(req('pruefling', { ops: [
      { op: 'ziel', eintrag: { id: 'z1', art: 'hyrox', titel: 'Hyrox Prüfstadt', datum: '2027-03-06', zielzeitSek: 5400 } },
      { op: 'lauf', eintrag: { id: 'l1', datum: H, distanzKm: 8, dauerSek: 2400, art: 'locker', gefuehl: 4 } },
      { op: 'erholung', tag: H, werte: { schlafH: 7.4, gefuehl: 4 } },
      { op: 'einstieg', fertig: true },
    ] }));
    expect(p.status).toBe(200);
    const d = await p.json();
    expect(d.stand.ziele[0].titel).toBe('Hyrox Prüfstadt');
    expect(d.stand.laeufe[0].quelle).toBe('hand');
    expect(d.stand.einstieg.fertig).toBe(true);
    const r2 = await route.GET(req('pruefling', undefined, { 'if-none-match': etag1 }));
    expect(r2.status).toBe(200);
    expect(r2.headers.get('etag')).not.toBe(etag1);
  });
  it('ein ungültiger Schritt lässt den ganzen Stapel liegen (400, nichts halb geschrieben)', async () => {
    const p = await route.PUT(req('pruefling', { ops: [{ op: 'lauf-weg', id: 'l1' }, { op: 'lauf', eintrag: { id: 'l2', datum: H } }] }));
    expect(p.status).toBe(400);
    expect((await p.json()).error).toMatch(/Distanz/);
    const d = await (await route.GET(req('pruefling'))).json();
    expect(d.stand.laeufe.map((l: { id: string }) => l.id)).toEqual(['l1']);
  });
  it('eine andere Person sieht einen eigenen, leeren Stand', async () => {
    const d = await (await route.GET(req('zweite-pruefperson'))).json();
    expect(d.stand.ziele).toEqual([]); expect(d.stand.laeufe).toEqual([]);
    expect(d.vitals).toEqual({});
  });
  it('lehnt leere und kaputte Anfragen ab', async () => {
    expect((await route.PUT(req('pruefling', { ops: [] }))).status).toBe(400);
    expect((await route.PUT(new Request('http://test/api/sport', { method: 'PUT', headers: kopf('pruefling'), body: '{' }))).status).toBe(400);
  });
});
