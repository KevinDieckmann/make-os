// WHOOP je Person — Verbindung (lib/whoop/verbindung.ts): state gehört der Person, Token verschlüsselt im eigenen Bestand, Erneuern mit
// Rotation (ein Lauf je Person), abgelehnt → „getrennt“ + EINE Glocke, ein WHOOP-Konto nur bei EINER Person, Trennen = Widerruf + Bestand
// weg + Grabstein, Übergang des alten gemeinsamen Tokens nur für den Inhaber. Echter Datenspeicher (Temp, verschlüsselt), WHOOP nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WhoopFake } from './fixtures/whoop-fake';
import { haushaltKonten } from './fixtures/konten';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-whoop-v-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-whoop-verbindung';

let V: typeof import('@/lib/whoop/verbindung');
let db: typeof import('@/lib/store/local-db');
let w: WhoopFake;

beforeAll(async () => { V = await import('@/lib/whoop/verbindung'); db = await import('@/lib/store/local-db'); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));
beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  w = new WhoopFake();
  w.konto(4711, 'kevin@example.invalid'); w.konto(4712, 'malin@example.invalid');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => w.handle(String(u), i)));
  vi.stubEnv('WHOOP_CLIENT_ID', 'whoop-client-test'); vi.stubEnv('WHOOP_CLIENT_SECRET', 'whoop-geheimnis-test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.beispiel.test'); vi.stubEnv('WHOOP_RUECKRUF_URL', '');
  await haushaltKonten(db);
});

async function verbinden(person: string, userId: number) {
  const { url } = await V.verbindungStarten(person);
  return V.verbindungAbschliessen(person, w.code(userId), new URL(url).searchParams.get('state')!, ['kevin', 'malin']);
}

describe('Anmelden', () => {
  it('Code + state → eigener verschlüsselter Bestand mit WHOOP-Kennung; Status nur maskiert, nie Token', async () => {
    const r = await verbinden('kevin', 4711);
    expect(r).toEqual({ konto: expect.stringMatching(/^k\*+@/), scopesFehlen: [] });
    const v = await V.ladeVerbindung('kevin');
    expect(v).toMatchObject({ v: 1, userId: 4711, status: 'verbunden' });
    const roh = readFileSync(path.join(ordner, 'whoop-verbindung--kevin.json'), 'utf8');
    expect(roh).not.toContain(v!.refreshToken);
    expect(roh).not.toContain('kevin@example.invalid');
    const s = await V.whoopStatus('kevin');
    expect(JSON.stringify(s)).not.toMatch(/acc-|ref-|4711|kevin@example/);
    expect(s).toMatchObject({ konfiguriert: true, verbunden: true });
  });
  it('der state gehört der Person, die gestartet hat — eine andere Sitzung tauscht nichts; state nur einmal', async () => {
    const { url } = await V.verbindungStarten('kevin');
    const state = new URL(url).searchParams.get('state')!;
    await expect(V.verbindungAbschliessen('malin', w.code(4712), state, ['kevin', 'malin'])).rejects.toMatchObject({ code: 'person' });
    await expect(V.verbindungAbschliessen('kevin', w.code(4711), state, ['kevin', 'malin'])).rejects.toMatchObject({ code: 'state' });
    expect(await V.ladeVerbindung('malin')).toBeNull();
  });
  it('ein WHOOP-Konto nur bei EINER Person (sonst ließen sich Webhooks nicht zuordnen) — der neue Zugang wird widerrufen', async () => {
    await verbinden('kevin', 4711);
    await expect(verbinden('malin', 4711)).rejects.toMatchObject({ code: 'belegt' });
    expect(await V.ladeVerbindung('malin')).toBeNull();
    expect(w.widerrufen).toContain(4711);
  });
  it('ohne Konfiguration: sichtbar aus, Starten abgelehnt', async () => {
    vi.stubEnv('WHOOP_CLIENT_ID', '');
    expect(await V.whoopStatus('kevin')).toMatchObject({ konfiguriert: false, fehlt: ['WHOOP_CLIENT_ID'] });
    await expect(V.verbindungStarten('kevin')).rejects.toMatchObject({ code: 'nicht-konfiguriert' });
  });
});

describe('Erneuern und Trennen', () => {
  it('abgelaufen → Erneuern mit Rotation; zwei gleichzeitige Anfragen erneuern nur EINMAL', async () => {
    await verbinden('kevin', 4711);
    const alt = (await V.ladeVerbindung('kevin'))!;
    await db.updateJson('whoop-verbindung--kevin', (c: unknown) => ({ ...(c as object), ablauf: Date.now() - 1 }));
    const [a, b] = await Promise.all([V.whoopZugriffstoken('kevin'), V.whoopZugriffstoken('kevin')]);
    expect(a).toBe(b);
    expect(w.aufrufe.filter(x => x.pfad === '/oauth/oauth2/token' && x.body.includes('refresh_token'))).toHaveLength(1);
    const neu = (await V.ladeVerbindung('kevin'))!;
    expect(neu.refreshToken).not.toBe(alt.refreshToken); // das NEUE Refresh-Token ist gespeichert
  });
  it('Erneuern abgelehnt → „getrennt“ + genau EINE Glocke', async () => {
    await verbinden('kevin', 4711);
    w.allesWiderrufen(4711);
    await db.updateJson('whoop-verbindung--kevin', (c: unknown) => ({ ...(c as object), ablauf: Date.now() - 1 }));
    await expect(V.whoopZugriffstoken('kevin')).rejects.toMatchObject({ code: 'getrennt' });
    await expect(V.whoopZugriffstoken('kevin')).rejects.toMatchObject({ code: 'getrennt' });
    await V.alsGetrenntMarkieren('kevin', 'noch einmal');
    const m = await db.loadJson<{ eintraege: { art: string; titel: string }[] }>('meldungen--kevin');
    expect(m?.eintraege.filter(x => x.art === 'verbindung')).toHaveLength(1);
    expect(JSON.stringify(m)).not.toMatch(/acc-|ref-/);
    expect(await V.whoopStatus('kevin')).toMatchObject({ verbunden: false, getrennt: { grund: expect.any(String) } });
    expect(await db.loadJson('meldungen--malin')).toBeNull();
  });
  it('Trennen: Widerruf bei WHOOP, Verbindung + Spiegel weg, Grabstein bleibt', async () => {
    await verbinden('kevin', 4711);
    await db.saveJson('whoop-stand--kevin', { v: 1, abTag: '2026-07-01', recovery: {}, schlaf: {}, zyklen: {}, workouts: {} });
    const r = await V.whoopTrennen('kevin');
    expect(r).toEqual({ war: true, widerrufen: true });
    expect(w.widerrufen).toEqual([4711]);
    expect(await V.ladeVerbindung('kevin')).toBeNull();
    expect(await db.loadJson('whoop-stand--kevin')).toBeNull();
    expect(await db.loadJson('whoop-verbindung--kevin')).toMatchObject({ v: 0 });
  });
});

describe('Übergang: alter gemeinsamer Token (Rohbau bis 08.10.)', () => {
  it('gilt NUR für den Inhaber — wird einmal in seinen Bestand übernommen und aus dem gemeinsamen Bestand gelöscht', async () => {
    await db.saveJson('oauth-tokens', { whoop: { access_token: 'acc-alt', refresh_token: 'ref-alt', expires_at: Date.now() + 60_000, scope: 'read:recovery read:sleep read:cycles read:profile offline', verbunden_am: '2026-09-26T10:00:00.000Z' }, microsoft: { access_token: 'm' } });
    expect(await V.ladeVerbindung('malin')).toBeNull(); // nie für eine andere Person
    expect((await db.loadJson<Record<string, unknown>>('oauth-tokens'))?.whoop).toBeDefined();
    const v = await V.ladeVerbindung('kevin');
    expect(v).toMatchObject({ status: 'verbunden', herkunft: 'alt', userId: null });
    const rest = await db.loadJson<Record<string, unknown>>('oauth-tokens');
    expect(rest?.whoop).toBeUndefined();
    expect(rest?.microsoft).toBeDefined();
    expect(await V.whoopStatus('kevin')).toMatchObject({ uebernommen: true, scopesFehlen: ['read:workout'] });
  });
});
