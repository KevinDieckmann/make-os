// ─── Zeit & Fokus · Route: Zuordnen, Umbuchen, nur eigene Blöcke, Zeit je Einheit ─
// Eigener Datenordner, erfundene Personen, Aufgaben und Zeiten — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zeit-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zeit';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let zeit: Mod; let einheiten: Mod; let db: typeof import('@/lib/store/local-db');

const post = (person: string | undefined, body: unknown) => new Request('http://test/api/state/zeit', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) }, body: JSON.stringify(body),
});
const get = (person: string, url = 'http://test/api/state/zeit/einheiten?zeitraum=woche&stichtag=2026-09-24') =>
  new Request(url, { headers: { 'x-make-user': person } });
const VON = '2026-09-24T08:00:00.000Z', BIS = '2026-09-24T08:30:00.000Z';
const blockVon = async (person: string) => {
  const d = await db.loadJson<{ tage: Record<string, { bloecke: { von: string; schluessel: string; aufgabeId?: string; einheit?: string }[]; bewusst: Record<string, number> }> }>(`zeit--${person}`);
  const t = Object.values(d?.tage ?? {})[0];
  return { block: t?.bloecke.find(b => b.von === VON), bewusst: t?.bewusst };
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  zeit = (await import('@/app/api/state/zeit/route')) as unknown as Mod;
  einheiten = (await import('@/app/api/state/zeit/einheiten/route')) as unknown as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
  ], einladungen: [] });
  await db.saveJson('tasks', { projects: [], tasks: [{ id: 't-biz', title: 'Erfundene Business-Aufgabe', projectId: 'p', space: 'business', einheit: 'KD Ventures', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '', updatedAt: '' }] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Zeit-Route — Schreiben nur mit Person, nur im eigenen Bestand', () => {
  it('ohne Person: 401', async () => {
    expect((await zeit.POST(post(undefined, { aktion: 'fokus', von: VON, bis: BIS, schluessel: 'privat:gesundheit' }))).status).toBe(401);
    expect((await zeit.POST(post(undefined, { aktion: 'umbuchen', von: VON, space: 'business' }))).status).toBe(401);
  });

  it('Privat-Block ins Business umbuchen, zuordnen, zurück nach Privat', async () => {
    expect((await zeit.POST(post('pb', { aktion: 'fokus', von: VON, bis: BIS, schluessel: 'privat:gesundheit', label: 'Gesundheit', einheit: 'KD Ventures' }))).status).toBe(200);
    expect((await blockVon('pb')).block).not.toHaveProperty('einheit'); // Privat verwirft schon beim Verbuchen

    const r = await zeit.POST(post('pb', { aktion: 'umbuchen', von: VON, space: 'business' }));
    expect(r.status).toBe(200);
    expect((await blockVon('pb')).block?.schluessel).toBe('business:gesundheit');
    expect((await blockVon('pb')).bewusst).toEqual({ 'business:gesundheit': 1800 });

    expect((await zeit.POST(post('pb', { aktion: 'zuordnen', von: VON, aufgabeId: 't-biz' }))).status).toBe(200);
    expect((await blockVon('pb')).block).toMatchObject({ aufgabeId: 't-biz', einheit: 'KD Ventures' });

    const e = await (await einheiten.GET(get('pa'))).json();
    expect(e.personen.map((p: { person: string }) => p.person)).toEqual(['pa', 'pb']);
    expect(e.gesamt.zeilen.find((z: { label: string }) => z.label === 'KD Ventures').sek).toBe(1800);

    expect((await zeit.POST(post('pb', { aktion: 'umbuchen', von: VON, space: 'privat' }))).status).toBe(200);
    const zurueck = (await blockVon('pb')).block;
    expect(zurueck?.schluessel).toBe('privat:gesundheit');
    expect(zurueck).not.toHaveProperty('aufgabeId');
    expect(zurueck).not.toHaveProperty('einheit');
  });

  it('fremde Blöcke: die andere Person findet sie nicht (404) und ändert nichts', async () => {
    const vorher = await blockVon('pb');
    expect((await zeit.POST(post('pa', { aktion: 'umbuchen', von: VON, space: 'business' }))).status).toBe(404);
    expect((await zeit.POST(post('pa', { aktion: 'zuordnen', von: VON, einheit: 'KD Ventures' }))).status).toBe(404);
    // Eine mitgeschickte Person im Körper zählt nicht.
    expect((await zeit.POST(post('pa', { aktion: 'umbuchen', von: VON, space: 'business', person: 'pb', fuer: 'pb' }))).status).toBe(404);
    expect(await blockVon('pb')).toEqual(vorher);
    expect(await db.loadJson('zeit--pa')).toBeNull();
  });

  it('Privat-Zeit der anderen Person taucht in Zeit je Einheit nicht auf', async () => {
    const e = await (await einheiten.GET(get('pa'))).json();
    expect(e.gesamt.sek).toBe(0);
    expect(JSON.stringify(e)).not.toContain('gesundheit');
  });

  it('ungültige Eingaben: 400', async () => {
    expect((await zeit.POST(post('pb', { aktion: 'umbuchen', von: VON, space: 'gemeinsam' }))).status).toBe(400);
    expect((await zeit.POST(post('pb', { aktion: 'umbuchen', space: 'business' }))).status).toBe(400);
  });
});
