// ─── Finanzplan (Altweg /api/state/finanzplan): Erststart ersetzt nie vorhandene Einträge (Update-Probe 11.10.) ─────────────
// Befund: Stand ohne Firmen (Plan nie geöffnet, z. B. nach dem Konten-Spiegel), aber schon mit einer Rechnung → das nächste GET
// legte die Startdaten über den ganzen Bestand und die Rechnung war weg. Jetzt kommen nur die fehlenden Firmen dazu.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-erst-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fp-erst';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const req = () => new Request('http://test/api/state/finanzplan', { headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'person-a' } });

let db: typeof import('@/lib/store/local-db');
let route: { GET: (r: Request) => Promise<Response> };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'person-a', email: 'a@test.invalid', name: 'Person A', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h-test' },
  ], einladungen: [] });
  route = (await import('@/app/api/state/finanzplan/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Finanzplan-Erststart', () => {
  it('Bestand ohne Firmen, aber mit Rechnung: GET behält die Rechnung und ergänzt nur die Firmen', async () => {
    await db.saveJson('finanzplan', { firmen: [], rechnungen: [{ id: 'r-probe', firmaId: 'kdv', kunde: 'Beispiel GmbH', titel: 'Leistung', betrag: 119, status: 'geplant' }] });
    const r = await route.GET(req());
    expect(r.status).toBe(200);
    const roh = (await db.loadJson<{ firmen: unknown[]; rechnungen: { id: string }[] }>('finanzplan'))!;
    expect(roh.rechnungen.map(x => x.id)).toContain('r-probe');
    expect(roh.firmen.length).toBeGreaterThan(0);
  });
  it('ganz ohne Bestand: Startdaten wie bisher', async () => {
    await db.saveJson('finanzplan', null as unknown as object);
    const r = await route.GET(req());
    expect(r.status).toBe(200);
    const roh = (await db.loadJson<{ firmen: unknown[] }>('finanzplan'))!;
    expect(roh.firmen.length).toBeGreaterThan(0);
  });
});
