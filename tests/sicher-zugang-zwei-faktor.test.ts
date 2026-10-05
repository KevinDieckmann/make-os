// ─── Zugang & Schlüssel härten, Punkt 4 (05.10.): 2FA-Pflicht als Instanz-Einstellung ─────────────────────
// Inhaber schaltet (nur mit eigenem zweiten Faktor); Konten ohne Faktor bekommen beim nächsten Anmelden eine Sitzung, die
// NUR die Einrichtung erlaubt (Middleware: API 403, Seiten → /anmelden?einrichten=2fa). Neue Instanz: Pflicht an; laufende
// (ohne Einstellungen): aus. Sitzungen von vor dem Einschalten laufen weiter. Eigener Datenordner, nur Test-Werte.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zwei-faktor-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zwei-faktor-nur-test';
process.env.SESSION_SECRET = 'pruef-sitzungsgeheimnis-zwei-faktor-nur-test-000';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const PW = 'TESTPASSWORT-nur-fuer-den-test';
let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let S: typeof import('@/lib/zugang/sitzung');
let SP: typeof import('@/lib/zugang/stand-pruefung');
let drossel: typeof import('@/lib/zugang/drossel');
let totp: typeof import('@/lib/zugang/totp');
let anmelden: typeof import('@/app/api/konto/anmelden/route');
let einstellungen: typeof import('@/app/api/konto/einstellungen/route');
let standRoute: typeof import('@/app/api/konto/stand/route');
let ich: typeof import('@/app/api/konto/ich/route');
let middleware: typeof import('@/middleware').middleware;

const json = (pfad: string, methode: string, kopf: Record<string, string>, body?: unknown) =>
  new Request(`http://test${pfad}`, { method: methode, headers: { 'content-type': 'application/json', ...kopf }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

async function grundzustand(einst?: Record<string, unknown>) {
  const hash = await K.passwortHashen(PW);
  await db.saveJson('konten', {
    konten: [
      { id: 'k-a', speicher: 'person-a', email: 'a@example.invalid', name: 'A', rolle: 'inhaber', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
      { id: 'k-b', speicher: 'person-b', email: 'b@example.invalid', name: 'B', rolle: 'mitglied', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
    ],
    einladungen: [],
    ...(einst ? { einstellungen: einst } : {}),
  });
  await db.saveJson('anmeldungen', { eintraege: [] });
  drossel._zuruecksetzen();
  SP.standVergessen();
}
const zfFuer = async (speicher: string) => {
  await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === speicher ? { ...k, zweiterFaktor: { geheimnis: totp.neuesGeheimnis(), seit: '2026-01-01', wiederherstellung: [] } } : k) }));
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  S = await import('@/lib/zugang/sitzung');
  SP = await import('@/lib/zugang/stand-pruefung');
  drossel = await import('@/lib/zugang/drossel');
  totp = await import('@/lib/zugang/totp');
  anmelden = await import('@/app/api/konto/anmelden/route');
  einstellungen = await import('@/app/api/konto/einstellungen/route');
  standRoute = await import('@/app/api/konto/stand/route');
  ich = await import('@/app/api/konto/ich/route');
  ({ middleware } = await import('@/middleware'));
});
beforeEach(() => grundzustand());
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Einstellungen im Kontenbestand', () => {
  it('bleiben erhalten, auch wenn ein Schreibweg nur { konten, einladungen } zurückgibt (beitreten)', async () => {
    await grundzustand({ zweiFaktorPflicht: true, zweiFaktorPflichtSeit: '2026-10-05T00:00:00.000Z', leerlaufStunden: 8 });
    await K.aendereKonten(s => ({ konten: s.konten, einladungen: [] }));
    expect((await K.ladeKonten()).einstellungen).toEqual({ zweiFaktorPflicht: true, zweiFaktorPflichtSeit: '2026-10-05T00:00:00.000Z', leerlaufStunden: 8 });
  });
  it('laufende Instanz ohne Feld: keine Pflicht, Leerlauf 12 h', async () => {
    const st = await K.ladeKonten();
    expect(st.einstellungen).toBeUndefined();
    expect(K.zweiFaktorOffen(st.einstellungen, st.konten[0])).toBe(false);
    expect(K.leerlaufStunden(st.einstellungen)).toBe(12);
    expect(K.leerlaufStunden({ leerlaufStunden: 0 })).toBe(12);
    expect(K.leerlaufStunden({ leerlaufStunden: 400 })).toBe(12);
  });
});

describe('PUT /api/konto/einstellungen', () => {
  it('nur der Inhaber mit Sitzung — Mitglied und Dienstweg „im Auftrag“ bekommen 403', async () => {
    expect((await einstellungen.PUT(json('/api/konto/einstellungen', 'PUT', { 'x-make-user': 'person-b' }, { leerlaufStunden: 4 }))).status).toBe(403);
    expect((await einstellungen.PUT(json('/api/konto/einstellungen', 'PUT', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'person-a' }, { leerlaufStunden: 4 }))).status).toBe(403);
    expect((await einstellungen.GET(json('/api/konto/einstellungen', 'GET', { 'x-make-user': 'person-b' }))).status).toBe(403);
  });
  it('Pflicht nur mit eigenem zweiten Faktor; setzt „seit“; aus entfernt beides; Leerlauf 1–336', async () => {
    const put = (b: unknown) => einstellungen.PUT(json('/api/konto/einstellungen', 'PUT', { 'x-make-user': 'person-a' }, b));
    expect((await put({ zweiFaktorPflicht: true })).status).toBe(409);
    await zfFuer('person-a');
    const r = await (await put({ zweiFaktorPflicht: true, leerlaufStunden: 6 })).json();
    expect(r).toMatchObject({ ok: true, zweiFaktorPflicht: true, leerlaufStunden: 6, ohneZweitenFaktor: 1 });
    const e = (await K.ladeKonten()).einstellungen!;
    expect(Date.parse(e.zweiFaktorPflichtSeit!)).toBeGreaterThan(Date.now() - 5000);
    expect((await put({ leerlaufStunden: 0 })).status).toBe(400);
    expect((await put({ leerlaufStunden: 2.5 })).status).toBe(400);
    expect((await put({ zweiFaktorPflicht: 'ja' })).status).toBe(400);
    await put({ zweiFaktorPflicht: false });
    expect((await K.ladeKonten()).einstellungen).toEqual({ leerlaufStunden: 6 });
  });
});

describe('Anmelden mit Pflicht', () => {
  const login = (email: string) => anmelden.POST(json('/api/konto/anmelden', 'POST', {}, { email, passwort: PW }));
  it('ohne Pflicht: normale Sitzung; mit Pflicht und ohne Faktor: Sitzung mit „zweiterFaktorEinrichten“', async () => {
    expect((await (await login('b@example.invalid')).json()).zweiterFaktorEinrichten).toBeUndefined();
    await grundzustand({ zweiFaktorPflicht: true, zweiFaktorPflichtSeit: new Date().toISOString() });
    const r = await login('b@example.invalid');
    expect(r.status).toBe(200);
    expect((await r.json()).zweiterFaktorEinrichten).toBe(true);
    expect(r.headers.get('set-cookie')).toContain('make-os-sitzung=');
  });
  it('/api/konto/ich und /api/konto/stand melden die offene Pflicht', async () => {
    await grundzustand({ zweiFaktorPflicht: true, zweiFaktorPflichtSeit: '2026-10-05T00:00:00.000Z' });
    expect((await (await ich.GET(json('/api/konto/ich', 'GET', { 'x-make-user': 'person-b' }))).json()).zweiterFaktorEinrichten).toBe(true);
    const st = await (await standRoute.GET(json('/api/konto/stand?speicher=person-b', 'GET', { 'x-make-key': process.env.MAKE_OS_KEY! }))).json();
    expect(st).toMatchObject({ zfOffen: true, zfAb: Date.parse('2026-10-05T00:00:00.000Z') });
    await zfFuer('person-b');
    expect((await (await standRoute.GET(json('/api/konto/stand?speicher=person-b', 'GET', { 'x-make-key': process.env.MAKE_OS_KEY! }))).json()).zfOffen).toBe(false);
  });
});

describe('Middleware mit offener Pflicht', () => {
  const STAND = 'abcdef012345';
  async function lauf(pfad: string, methode: string, zfAb: number, ausgestellt = Date.now()) {
    SP.standVergessen();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, stand: STAND, ab: 0, widerrufen: [], zfOffen: true, zfAb }), { status: 200 })));
    const zettel = await S.sitzungAusstellen(process.env.SESSION_SECRET!, 'person-b', STAND, ausgestellt);
    return middleware(new NextRequest(`http://localhost:3001${pfad}`, { method: methode, headers: { cookie: `${S.SITZUNG_COOKIE}=${zettel}`, ...(methode !== 'GET' ? { origin: 'http://localhost:3001', host: 'localhost:3001' } : {}) } } as never));
  }
  it('Schnittstellen → 403, Seiten → /anmelden?einrichten=2fa', async () => {
    const api = await lauf('/api/state/tasks', 'GET', 0);
    expect(api.status).toBe(403);
    expect((await api.json()).zweiterFaktorEinrichten).toBe(true);
    const seite = await lauf('/os/kalender', 'GET', 0);
    expect(seite.status).toBe(307);
    expect(seite.headers.get('location')).toContain('/anmelden?einrichten=2fa&zu=%2Fos%2Fkalender');
  });
  it('erlaubt: zweiten Faktor einrichten, sich selbst sehen, abmelden', async () => {
    for (const [p, m] of [['/api/konto/zwei-faktor', 'POST'], ['/api/konto/ich', 'GET'], ['/api/konto/abmelden', 'POST']] as const) {
      const r = await lauf(p, m, 0);
      expect(r.headers.get('x-middleware-next'), `${m} ${p}`).toBe('1');
      expect(r.headers.get('x-middleware-request-x-make-user')).toBe('person-b');
    }
    expect((await lauf('/api/konto/ich', 'PUT', 0)).status).toBe(403);
  });
  it('Sitzungen von VOR dem Einschalten laufen weiter', async () => {
    const r = await lauf('/api/state/tasks', 'GET', Date.now() + 60_000);
    expect(r.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('HOI: Zweiter-Faktor-Befund', () => {
  it('keine Pflicht und Konten ohne → gelb; Pflicht und alle → grün; ohne Konten → nichts', async () => {
    const { zugangBefunde } = await import('@/lib/hoi/lage');
    const j = '2026-10-05T12:00:00.000Z';
    const b = { zuliefererSchluessel: false, zuliefererAltZuletzt: null };
    expect(zugangBefunde({ ...b, zweiFaktor: { pflicht: false, ohne: 1, konten: 2 } }, j)[0]).toMatchObject({ id: 'zwei-faktor', ampel: 'gelb' });
    expect(zugangBefunde({ ...b, zweiFaktor: { pflicht: true, ohne: 0, konten: 2 } }, j)[0]).toMatchObject({ id: 'zwei-faktor', ampel: 'gruen' });
    expect(zugangBefunde({ ...b, zweiFaktor: { pflicht: false, ohne: 0, konten: 0 } }, j)).toEqual([]);
  });
});
