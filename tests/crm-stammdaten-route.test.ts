// Routen-Test der Stammdaten (Malins Rückmeldung 27.09.): „+ neu“ in der Akte legt einen Wert über
// POST /api/crm/stammdaten { aktion: 'wertelisten' } an — geprüft und gesäubert (lib/crm/wertelisten.ts),
// feste Standardwerte bleiben, GET liefert fest + eigene. Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BRANCHEN_STANDARD, TYPEN_STANDARD, WERT_MAX } from '../lib/crm/wertelisten';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-stamm-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-27-09-akte';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const req = (body?: unknown, method = 'POST') => new Request('http://test/api/crm/stammdaten', { method, headers: kopf, ...(body ? { body: JSON.stringify(body) } : {}) });

type Mod = { POST: (r: Request) => Promise<Response>; GET: (r: Request) => Promise<Response> };
type Liste = { wert: string; fest: boolean }[];
let route: Mod, db: typeof import('@/lib/store/local-db'), speicher: typeof import('@/lib/crm/speicher');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  // Regel 5 (28.09. abends): der Dienstweg braucht eine Person im Haushalt des Inhabers — erfundene Konten.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  route = (await import('@/app/api/crm/stammdaten/route')) as unknown as Mod;
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', speicher.leererBestand());
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const wertelisten = async () => ((await (await route.GET(req(undefined, 'GET'))).json()) as { ok: boolean; wertelisten: { branchen: Liste; typen: Liste; kategorien: Liste } }).wertelisten;
const anlegen = (liste: 'branchen' | 'typen' | 'kategorien', werte: string[]) => route.POST(req({ aktion: 'wertelisten', wertelisten: { [liste]: werte } }));

describe('Stammdaten-Route — Wertelisten aus der Akte anlegen', () => {
  it('ohne Schlüssel oder Person: kein Zugang', async () => {
    const r = await route.POST(new Request('http://test/api/crm/stammdaten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'wertelisten', wertelisten: { typen: ['X Y'] } }) }));
    expect(r.status).toBe(403);
  });
  it('eine neue Branche hängt hinter den festen — Antwort und GET zeigen fest + eigen, der Speicher nur das Eigene', async () => {
    const r = await anlegen('branchen', ['Luft- & Raumfahrt']);
    expect(r.status).toBe(200);
    const a = (await r.json()) as { ok: boolean; wertelisten: { branchen: Liste } };
    expect(a.ok).toBe(true);
    expect(a.wertelisten.branchen.map(b => b.wert)).toEqual([...BRANCHEN_STANDARD, 'Luft- & Raumfahrt']);
    expect(a.wertelisten.branchen.at(-1)).toEqual({ wert: 'Luft- & Raumfahrt', fest: false });
    expect((await wertelisten()).branchen.filter(b => !b.fest).map(b => b.wert)).toEqual(['Luft- & Raumfahrt']);
    expect((await speicher.ladeCrm()).wertelisten?.branchen).toEqual(['Luft- & Raumfahrt']);
  });
  it('die Akte schickt immer die ganze eigene Liste — ein zweiter Wert kommt dazu, Leerraum wird gesäubert', async () => {
    const r = await anlegen('branchen', ['Luft- & Raumfahrt', '  Logistik   & Verkehr ']);
    expect(r.status).toBe(200);
    expect((await wertelisten()).branchen.filter(b => !b.fest).map(b => b.wert)).toEqual(['Luft- & Raumfahrt', 'Logistik & Verkehr']);
  });
  it('ein Typ, der schon fest ist, wird nicht doppelt angelegt; eine leere Liste löscht die festen nicht', async () => {
    const r = await anlegen('typen', ['Zielkunde', 'Sparringspartner']);
    expect(r.status).toBe(200);
    const t = (await wertelisten()).typen;
    expect(t.filter(x => x.wert === 'Zielkunde')).toHaveLength(1);
    expect(t.filter(x => !x.fest).map(x => x.wert)).toEqual(['Sparringspartner']);
    expect((await anlegen('typen', [])).status).toBe(200);
    const nachher = (await wertelisten()).typen;
    expect(nachher.map(x => x.wert)).toEqual([...TYPEN_STANDARD]);
    expect(nachher.every(x => x.fest)).toBe(true);
  });
  it('zu kurz oder zu lang → 400 mit Grund, nichts wird geschrieben', async () => {
    const vorher = (await speicher.ladeCrm()).wertelisten;
    const kurz = await anlegen('kategorien', ['A']);
    expect(kurz.status).toBe(400);
    expect(((await kurz.json()) as { fehler: string }).fehler).toMatch(/Kategorie .*2–60 Zeichen/);
    const lang = await anlegen('kategorien', ['x'.repeat(WERT_MAX + 1)]);
    expect(lang.status).toBe(400);
    expect((await speicher.ladeCrm()).wertelisten).toEqual(vorher);
  });
  it('eine unbekannte Liste ändert nichts, falsche Form wird abgelehnt', async () => {
    const r = await route.POST(req({ aktion: 'wertelisten', wertelisten: { farben: ['Rot'] } }));
    expect(r.status).toBe(200);
    expect((await speicher.ladeCrm()).wertelisten).not.toHaveProperty('farben');
    expect((await route.POST(req({ aktion: 'wertelisten', wertelisten: 'Rot' }))).status).toBe(400);
  });
});

describe('Regel 5 (28.09. abends): Dienstweg ohne Person oder mit fremder Person → 403', () => {
  it('ohne Person und mit einer Person außerhalb des Haushalts des Inhabers wird nichts gelesen', async () => {
    const ohne = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! };
    expect((await route.GET(new Request('http://test/api/crm/stammdaten', { headers: ohne }))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/crm/stammdaten', { headers: { ...ohne, 'x-make-person': 'fremd' } }))).status).toBe(403);
  });
});
