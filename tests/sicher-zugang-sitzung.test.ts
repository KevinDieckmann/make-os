// ─── Zugang & Schlüssel härten, Punkt 7 (05.10.): Leerlauf-Ende und fail-closed Stand-Prüfung ──────────────
// Antwortet der Server nicht, trägt nur ein höchstens 5 min alter Stand weiter; sonst „unklar“ → 503 (Sitzung bleibt).
// Wer länger als `leerlaufStunden` keine Anfrage stellt, ist raus (und wird beim Server widerrufen). Nur Test-Werte.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-sitzung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-sitzung-nur-test';
process.env.SESSION_SECRET = 'pruef-sitzungsgeheimnis-sitzung-nur-test-0000';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let S: typeof import('@/lib/zugang/sitzung');
let SP: typeof import('@/lib/zugang/stand-pruefung');
let K: typeof import('@/lib/zugang/konten');
let db: typeof import('@/lib/store/local-db');
let standRoute: typeof import('@/app/api/konto/stand/route');
let middleware: typeof import('@/middleware').middleware;
const STAND = 'abcdef012345';
const req = new Request('http://localhost:3000/os');

beforeAll(async () => {
  S = await import('@/lib/zugang/sitzung');
  SP = await import('@/lib/zugang/stand-pruefung');
  K = await import('@/lib/zugang/konten');
  db = await import('@/lib/store/local-db');
  standRoute = await import('@/app/api/konto/stand/route');
  ({ middleware } = await import('@/middleware'));
});
beforeEach(() => SP.standVergessen());
afterEach(() => vi.unstubAllGlobals());
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const antwort = (x: Record<string, unknown> = {}) => new Response(JSON.stringify({ ok: true, stand: STAND, ab: 0, widerrufen: [], ...x }), { status: 200 });
async function zettel(ausgestellt = Date.now()) {
  return S.sitzungPruefen(process.env.SESSION_SECRET!, await S.sitzungAusstellen(process.env.SESSION_SECRET!, 'person-a', STAND, ausgestellt), ausgestellt);
}

describe('fail-closed', () => {
  it('ohne gemerkten Stand und ohne Antwort: „unklar“ (früher still gültig)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('weg'); }));
    const s = (await zettel())!;
    expect(await SP.standPruefen(req, s, 'k')).toBe('unklar');
    expect(await SP.standGueltig(req, s, 'k')).toBe(false);
  });
  it('kurzer Aussetzer: ein höchstens 5 min alter Stand trägt; danach „unklar“', async () => {
    const t0 = Date.now();
    const s = (await zettel(t0 - 1000))!;
    vi.stubGlobal('fetch', vi.fn(async () => antwort()));
    expect(await SP.standPruefen(req, s, 'k', t0)).toBe('gueltig');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Neustart'); }));
    expect(await SP.standPruefen(req, s, 'k', t0 + 60_000)).toBe('gueltig');
    expect(await SP.standPruefen(req, s, 'k', t0 + SP.KULANZ_MS + 1000)).toBe('unklar');
  });
  it('Server antwortet mit Fehler (500): wie keine Antwort', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await SP.standPruefen(req, (await zettel())!, 'k')).toBe('unklar');
  });
});

describe('Leerlauf-Ende', () => {
  it('länger als die Einstellung ohne Anfrage → ungültig, beim Server widerrufen, bleibt tot', async () => {
    const t0 = Date.now();
    const s = (await zettel(t0 - 1000))!;
    const aufrufe: { url: string; body?: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { aufrufe.push({ url, body: init?.body as string | undefined }); return antwort({ leerlaufMin: 60 }); }));
    expect(await SP.standPruefen(req, s, 'k', t0)).toBe('gueltig');
    expect(await SP.standPruefen(req, s, 'k', t0 + 50 * 60_000)).toBe('gueltig');
    expect(await SP.standPruefen(req, s, 'k', t0 + 50 * 60_000 + 61 * 60_000)).toBe('ungueltig');
    const widerruf = aufrufe.find(a => a.body);
    expect(widerruf?.url).toMatch(/\/api\/konto\/stand$/);
    expect(JSON.parse(widerruf!.body!)).toMatchObject({ speicher: 'person-a', sid: s.sid });
    expect(await SP.standPruefen(req, s, 'k', t0 + 50 * 60_000 + 62 * 60_000)).toBe('ungueltig');
  });
  it('ohne Angabe des Servers gelten 12 Stunden; ein neuer Prozess (vergessen) beginnt die Uhr neu', async () => {
    const t0 = Date.now();
    const s = (await zettel(t0 - 1000))!;
    vi.stubGlobal('fetch', vi.fn(async () => antwort()));
    expect(await SP.standPruefen(req, s, 'k', t0)).toBe('gueltig');
    expect(await SP.standPruefen(req, s, 'k', t0 + 11 * 3_600_000)).toBe('gueltig');
    SP.standVergessen();
    expect(await SP.standPruefen(req, s, 'k', t0 + 30 * 3_600_000)).toBe('gueltig');
  });
});

describe('Middleware und Route', () => {
  it('„unklar“ → 503 mit Retry-After, Seiten wie Schnittstellen — ohne Umleitung zur Anmeldung', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('weg'); }));
    const z = await S.sitzungAusstellen(process.env.SESSION_SECRET!, 'person-a', STAND);
    for (const p of ['/api/state/tasks', '/os']) {
      const r = await middleware(new NextRequest(`http://localhost:3001${p}`, { headers: { cookie: `${S.SITZUNG_COOKIE}=${z}` } } as never));
      expect(r.status, p).toBe(503);
      expect(r.headers.get('retry-after')).toBe('5');
    }
  });
  it('GET /api/konto/stand nennt den Leerlauf; POST widerruft (nur Dienstweg)', async () => {
    const h = await K.passwortHashen('TESTPASSWORT-nur-fuer-den-test');
    await db.saveJson('konten', { konten: [{ id: 'k-a', speicher: 'person-a', email: 'a@example.invalid', name: 'A', rolle: 'inhaber', ...h, angelegt: 'x', teilt: { gesundheit: [] } }], einladungen: [], einstellungen: { leerlaufStunden: 3 } });
    const dienst = { 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json' };
    expect((await (await standRoute.GET(new Request('http://t/api/konto/stand?speicher=person-a', { headers: dienst }))).json()).leerlaufMin).toBe(180);
    const body = JSON.stringify({ speicher: 'person-a', sid: 'abcdefabcdef', bis: Date.now() + 864e5 });
    expect((await standRoute.POST(new Request('http://t/api/konto/stand', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' }, body }))).status).toBe(403);
    expect((await standRoute.POST(new Request('http://t/api/konto/stand', { method: 'POST', headers: { ...dienst, 'x-forwarded-for': '203.0.113.9' }, body }))).status).toBe(403);
    expect((await standRoute.POST(new Request('http://t/api/konto/stand', { method: 'POST', headers: dienst, body }))).status).toBe(200);
    const st = await (await standRoute.GET(new Request('http://t/api/konto/stand?speicher=person-a', { headers: dienst }))).json();
    expect(st.widerrufen).toEqual(['abcdefabcdef']);
  });
});
