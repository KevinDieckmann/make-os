// ─── Meldungen (Glocke, 28.09. abends): melde() + Route /api/meldungen ───────
// Eigener Datenordner, Konten mit Test-Haushalt, erfundene Aufgaben. Prüft: nur eigene Meldungen,
// 403 für fremde Haushalte und den Dienstweg ohne Person, gelesen setzen nur im eigenen Bestand,
// ETag/304, melde() wirft nie und meldet nie an sich selbst, Telegram versendet nichts.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-meldungen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-meldungen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
type Sicht = { ok: boolean; meldungen: { id: string; art: string; gelesen: boolean; virtuell?: boolean; bezug?: { id: string } }[]; ungelesen: number; einstellungen: { telegram: boolean }; heute: string };
let route: Mod;
let melde: typeof import('@/lib/meldungen/melden').melde;
let heute = '';
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const get = (h: Record<string, string>) => route.GET(new Request('http://test/api/meldungen', { headers: h }));
const post = (body: unknown, h: Record<string, string>) => route.POST(new Request('http://test/api/meldungen', { method: 'POST', headers: h, body: JSON.stringify(body) }));
const sicht = async (h: Record<string, string>) => (await (await get(h)).json()) as Sicht;
const zuweisung = (an: string, von: string, id: string) => ({ an, von, art: 'zuweisung' as const, titel: `Aufgabe ${id} zugewiesen`, link: `/os/aufgaben?offen=${id}`, bezug: { art: 'aufgabe' as const, id } });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const { heuteBerlin } = await import('@/lib/meldungen/speicher');
  const { tagPlus } = await import('@/lib/kalender/zeit');
  heute = heuteBerlin();
  const k = (id: string, speicher: string, rolle: string, haushalt: string) => ({ id, speicher, email: `${speicher}@test`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus'), k('k3', 'gast', 'mitglied', 'anderer-haus'), k('k4', 'kind', 'mitglied', 'test-haus')], einladungen: [] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'malin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-09-01', ...x });
  await db.saveJson('tasks', { projects: [], tasks: [
    t('t-heute', { dueDate: heute }),
    t('t-gestern', { dueDate: tagPlus(heute, -1) }),
    t('t-morgen', { dueDate: tagPlus(heute, 1) }),
    t('t-kevin', { dueDate: heute, assignee: 'kevin' }),
  ] });
  melde = (await import('@/lib/meldungen/melden')).melde;
  route = (await import('@/app/api/meldungen/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('melde()', () => {
  it('legt beim Empfänger ab, nie an sich selbst, nie außerhalb des Haushalts', async () => {
    await melde(zuweisung('malin', 'kevin', 't-heute'));
    await melde(zuweisung('kevin', 'kevin', 't-kevin'));
    await melde(zuweisung('gast', 'kevin', 't-heute'));
    const m = await sicht(sitzung('malin'));
    expect(m.meldungen.filter(x => !x.virtuell).map(x => x.art)).toEqual(['zuweisung']);
    const k = await sicht(sitzung('kevin'));
    expect(k.meldungen.filter(x => !x.virtuell)).toEqual([]);
    expect(existsSync(path.join(ordner, 'meldungen--gast.json'))).toBe(false);
    expect(existsSync(path.join(ordner, 'meldungen--kevin.json'))).toBe(false);
  });
  it('wirft nie — auch nicht bei Unsinn oder einem unlesbaren Bestand', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(melde(null as never)).resolves.toBeUndefined();
    await expect(melde({ an: 'malin', art: 'quatsch' } as never)).resolves.toBeUndefined();
    mkdirSync(path.join(ordner, 'meldungen--kind.json')); // Verzeichnis statt Datei → Lesefehler
    await expect(melde(zuweisung('kind', 'kevin', 't-heute'))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('Zugang', () => {
  it('403 ohne Sitzung, aus einem anderen Haushalt und auf dem Dienstweg ohne Person', async () => {
    expect((await get({})).status).toBe(403);
    expect((await get(sitzung('gast'))).status).toBe(403);
    expect((await get(dienst())).status).toBe(403);
    expect((await get(dienst('gast'))).status).toBe(403);
    expect((await get({ 'x-make-user': 'unbekannt' })).status).toBe(403);
    expect((await post({ aktion: 'gelesen', alle: true }, dienst())).status).toBe(403);
    expect((await post({ aktion: 'gelesen', alle: true }, sitzung('gast'))).status).toBe(403);
    expect((await get(dienst('malin'))).status).toBe(200);
  });
  it('nur eigene Meldungen: fällig/überfällig aus den eigenen Aufgaben', async () => {
    const m = await sicht(sitzung('malin'));
    expect(m.heute).toBe(heute);
    expect(m.meldungen.filter(x => x.virtuell).map(x => `${x.art}:${x.bezug?.id}`)).toEqual(['ueberfaellig:t-gestern', 'faellig:t-heute']);
    expect(m.ungelesen).toBe(3);
    const k = await sicht(sitzung('kevin'));
    expect(k.meldungen.map(x => x.bezug?.id)).toEqual(['t-kevin']);
    // Eine Abfrage für andere Personen gibt es nicht — ?fuer= wird nicht beachtet.
    const fremd = (await (await route.GET(new Request('http://test/api/meldungen?fuer=malin', { headers: sitzung('kevin') }))).json()) as Sicht;
    expect(fremd.meldungen.map(x => x.bezug?.id)).toEqual(['t-kevin']);
  });
  it('ETag: derselbe Stand → 304, je Person verschieden', async () => {
    const r = await get(sitzung('malin'));
    const etag = r.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect((await get({ ...sitzung('malin'), 'if-none-match': etag })).status).toBe(304);
    expect((await get({ ...sitzung('kevin'), 'if-none-match': etag })).status).toBe(200);
  });
});

describe('gelesen setzen', () => {
  it('fremde Kennungen ändern nichts; eigene einzeln und alle', async () => {
    const vorher = await sicht(sitzung('malin'));
    const zuw = vorher.meldungen.find(x => x.art === 'zuweisung')!;
    // Kevin versucht Malins Meldung als gelesen zu setzen → bei Malin bleibt sie ungelesen.
    expect((await post({ aktion: 'gelesen', ids: [zuw.id] }, sitzung('kevin'))).status).toBe(200);
    expect((await sicht(sitzung('malin'))).meldungen.find(x => x.id === zuw.id)?.gelesen).toBe(false);

    const r = (await (await post({ aktion: 'gelesen', ids: [zuw.id] }, sitzung('malin'))).json()) as Sicht;
    expect(r.meldungen.find(x => x.id === zuw.id)?.gelesen).toBe(true);
    expect(r.ungelesen).toBe(2);

    const alle = (await (await post({ aktion: 'gelesen', alle: true }, sitzung('malin'))).json()) as Sicht;
    expect(alle.ungelesen).toBe(0);
    // Abgeleitete bleiben heute gelesen.
    expect((await sicht(sitzung('malin'))).ungelesen).toBe(0);
    // Kevins Glocke ist davon unberührt.
    expect((await sicht(sitzung('kevin'))).ungelesen).toBe(1);
  });
  it('eine neue Zuweisung nach dem Lesen zählt wieder', async () => {
    await melde(zuweisung('malin', 'kevin', 't-heute'));
    expect((await sicht(sitzung('malin'))).ungelesen).toBe(1);
  });
  it('Eingaben: zu viele Kennungen 413, ohne Auswahl oder unbekannte Aktion 400', async () => {
    expect((await post({ aktion: 'gelesen', ids: Array.from({ length: 2001 }, (_, i) => `m-${i}`) }, sitzung('malin'))).status).toBe(413);
    expect((await post({ aktion: 'gelesen' }, sitzung('malin'))).status).toBe(400);
    expect((await post({ aktion: 'gelesen', ids: 'x' }, sitzung('malin'))).status).toBe(400);
    expect((await post({ aktion: 'loeschen' }, sitzung('malin'))).status).toBe(400);
    expect((await post({ aktion: 'einstellungen', telegram: 'ja' }, sitzung('malin'))).status).toBe(400);
  });
});

describe('Telegram vorgesehen, versendet nichts', () => {
  it('Einstellung je Person, standardmäßig aus; auch eingeschaltet geht kein Aufruf hinaus', async () => {
    expect((await sicht(sitzung('malin'))).einstellungen).toEqual({ telegram: false });
    const r = (await (await post({ aktion: 'einstellungen', telegram: true }, sitzung('malin'))).json()) as Sicht;
    expect(r.einstellungen).toEqual({ telegram: true });
    expect((await sicht(sitzung('kevin'))).einstellungen).toEqual({ telegram: false });
    process.env.TELEGRAM_BOT_TOKEN = 'pruef-token';
    const netz = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    await melde({ an: 'malin', von: 'kevin', art: 'erwaehnung', titel: 'Kevin hat dich erwähnt', link: '/os/aufgaben?offen=t-heute', bezug: { art: 'aufgabe', id: 't-heute' } });
    expect(netz).not.toHaveBeenCalled();
    netz.mockRestore();
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await sicht(sitzung('malin'))).meldungen.some(x => x.art === 'erwaehnung')).toBe(true);
  });
});
