// WHOOP je Person — Routen, Abgleich, Webhook, Takt-Zustand, HOI (Sicht „Malin bekommt nichts aus Kevins WHOOP“, Dienstweg 403,
// Art.-9-Sperre, Handwert gewinnt, Sport ohne Dubletten, Signatur, Doppelte einmal, 429 → Pause). Echter Datenspeicher (Temp, verschlüsselt),
// WHOOP nachgebaut (tests/fixtures/whoop-fake.ts) — kein Netz.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { WhoopFake, schlaf, erholung, zyklus, training, uuid } from './fixtures/whoop-fake';
import { haushaltKonten } from './fixtures/konten';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-whoop-r-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-whoop-route';
process.env.MAKE_OS_KEY = 'dienst-test-whoop-route';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let status: R, verbinden: R, rueckruf: R, trennen: R, abgleich: R, webhook: R;
let V: typeof import('@/lib/whoop/verbindung'), A: typeof import('@/lib/whoop/abgleich'), W: typeof import('@/lib/whoop/webhook'), db: typeof import('@/lib/store/local-db');
let middleware: typeof import('@/middleware').middleware;
let w: WhoopFake;

const kopf = (person: string | null) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (url: string, h: Record<string, string>, methode = 'GET', body?: unknown) => new Request(`http://localhost${url}`, { method: methode, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const warte = (ms = 60) => new Promise(r => setTimeout(r, ms));
// Hintergrundarbeit (after/Abgleich) braucht unter Last unterschiedlich lange — warten, bis es eingetreten ist, statt fester Zeiten.
// Uhr = performance.now(): Date ist in diesem Test fest gestellt.
async function bis(pruef: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const ende = performance.now() + ms;
  while (!(await pruef())) { if (performance.now() > ende) throw new Error('Bedingung nicht eingetreten'); await warte(25); }
}
async function stabil(wert: () => number, ruhe = 300, ms = 5000): Promise<void> {
  const ende = performance.now() + ms; let alt = wert(); let seit = performance.now();
  while (performance.now() - seit < ruhe) { if (performance.now() > ende) throw new Error('kommt nicht zur Ruhe'); await warte(25); const neu = wert(); if (neu !== alt) { alt = neu; seit = performance.now(); } }
}

beforeAll(async () => {
  V = await import('@/lib/whoop/verbindung'); A = await import('@/lib/whoop/abgleich'); W = await import('@/lib/whoop/webhook'); db = await import('@/lib/store/local-db');
  status = await import('../app/api/whoop/status/route') as R; verbinden = await import('../app/api/whoop/verbinden/route') as R;
  rueckruf = await import('../app/api/whoop/rueckruf/route') as R; trennen = await import('../app/api/whoop/trennen/route') as R;
  abgleich = await import('../app/api/whoop/abgleich/route') as R; webhook = await import('../app/api/whoop/webhook/route') as R;
  ({ middleware } = await import('@/middleware'));
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(ordner, { recursive: true, force: true }); });

async function einwilligen(person: string, an = true) {
  const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  await gesundheitErklaeren(person, 'verarbeiten', an, GESUNDHEIT_FASSUNG);
}
async function verbunden(person: string, userId: number) {
  const { url } = await V.verbindungStarten(person);
  await V.verbindungAbschliessen(person, w.code(userId), new URL(url).searchParams.get('state')!, ['kevin', 'malin']);
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T08:00:00.000Z'));
  w = new WhoopFake();
  const k = w.konto(4711, 'kevin@example.invalid');
  k.sleep.push(schlaf(1, '2026-10-07T05:00:00Z', { stunden: 7.5 }), schlaf(2, '2026-10-08T05:10:00Z', { stunden: 6.2 }));
  k.recovery.push(erholung(1, '2026-10-07T05:05:00Z', 81), erholung(2, '2026-10-08T05:15:00Z', 47, { hrv: 44, rhr: 58 }));
  k.cycle.push(zyklus(901, '2026-10-06T22:00:00Z', 12.4), zyklus(902, '2026-10-07T22:00:00Z', 6.1));
  k.workout.push(training(10, '2026-10-06T16:00:00Z', 50, 'running', { meter: 10_020 }), training(11, '2026-10-07T07:00:00Z', 60, 'Functional Fitness'));
  w.konto(4712, 'malin@example.invalid').recovery.push(erholung(30, '2026-10-08T06:00:00Z', 90));
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => w.handle(String(u), i)));
  vi.stubEnv('WHOOP_CLIENT_ID', 'whoop-client-test'); vi.stubEnv('WHOOP_CLIENT_SECRET', 'whoop-geheimnis-test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.beispiel.test'); vi.stubEnv('WHOOP_RUECKRUF_URL', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  await haushaltKonten(db);
  await einwilligen('kevin'); await einwilligen('malin');
});

// Ein Webhook stößt den Abgleich im Hintergrund an (after). Läuft er beim nächsten Test noch, hält er dessen Sperre „ein Lauf je
// Person“ und schreibt in den schon geleerten Ordner — deshalb wartet jeder Test, bis kein Abgleich mehr läuft.
afterEach(async () => {
  await bis(() => !A.whoopAbgleichLaeuft('kevin') && !A.whoopAbgleichLaeuft('malin'), 10_000);
});

describe('Zugang: nur die eigene Person', () => {
  it('Dienstweg (auch mit Person) und ohne Sitzung → 403 auf jeder Route außer dem Webhook', async () => {
    for (const [r, url, m] of [[status, '/api/whoop/status', 'GET'], [verbinden, '/api/whoop/verbinden', 'POST'], [rueckruf, '/api/whoop/rueckruf?code=x&state=Ab3dEf7h', 'GET'], [trennen, '/api/whoop/trennen', 'POST'], [abgleich, '/api/whoop/abgleich', 'POST']] as const) {
      const f = (r as R)[m as 'GET' | 'POST']!;
      expect((await f(anfrage(url, dienst('kevin'), m, m === 'POST' ? {} : undefined))).status, url).toBe(403);
      expect((await f(anfrage(url, kopf(null), m, m === 'POST' ? {} : undefined))).status, url).toBe(403);
    }
  });
  it('Sicht: Malin bekommt nichts aus Kevins WHOOP — ihr Status ist ihrer, ohne Kennung/Token/Werte von Kevin', async () => {
    await verbunden('kevin', 4711);
    await A.whoopAbgleichen('kevin');
    const k = await j(await status.GET!(anfrage('/api/whoop/status', kopf('kevin'))));
    expect(k.d).toMatchObject({ ok: true, verbunden: true, konto: expect.stringMatching(/^k\*+@/), zuletzt: { tag: '2026-10-08', rec: 47 } });
    expect(JSON.stringify(k.d)).not.toMatch(/acc-|ref-|4711|kevin@example|refresh|access/i);
    const m = await j(await status.GET!(anfrage('/api/whoop/status', kopf('malin'))));
    expect(m.d).toMatchObject({ ok: true, verbunden: false });
    expect(m.d.zuletzt).toBeUndefined();
    expect(JSON.stringify(m.d)).not.toMatch(/k\*|81|47|12[.,]4/);
    // Malins Bestände bleiben leer — Kevins Abgleich schreibt nur in seine.
    expect(await db.loadJson('vitals--malin')).toBeNull();
    expect(await db.loadJson('sport--malin')).toBeNull();
  });
  it('Middleware: genau der Webhook (POST) ist ohne Sitzung offen; Rückruf darf von WHOOP aus navigiert werden', async () => {
    vi.stubEnv('SESSION_SECRET', 's'.repeat(40));
    const mw = (pfad: string, methode = 'GET', h: Record<string, string> = {}) => middleware(new NextRequest(`https://app.beispiel.test${pfad}`, { method: methode, headers: { 'content-type': 'application/json', ...h } }));
    expect((await mw('/api/whoop/webhook', 'POST')).status).not.toBe(401);
    expect((await mw('/api/whoop/webhook')).status).toBe(401);
    expect((await mw('/api/whoop/status')).status).toBe(401);
    expect((await mw('/api/whoop/abgleich', 'POST')).status).toBe(401);
    const { crossSiteVerboten } = await import('@/lib/zugang/cross-site');
    const nav = { get: (n: string) => ({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } as Record<string, string>)[n] ?? null };
    expect(crossSiteVerboten('/api/whoop/rueckruf', nav)).toBe(false);
    expect(crossSiteVerboten('/api/whoop/trennen', nav)).toBe(true);
  });
});

describe('Verbinden und Rückruf', () => {
  it('Verbinden liefert die WHOOP-Anmeldeseite; der Rückruf führt zu Gesundheit — ohne Code/Token in der Adresse', async () => {
    const v = await j(await verbinden.POST!(anfrage('/api/whoop/verbinden', kopf('kevin'), 'POST', {})));
    expect(v.status).toBe(200);
    const u = new URL(v.d.url);
    expect(u.origin + u.pathname).toBe('https://api.prod.whoop.com/oauth/oauth2/auth');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.beispiel.test/api/whoop/rueckruf');
    const r = await rueckruf.GET!(anfrage(`/api/whoop/rueckruf?code=${w.code(4711)}&state=${u.searchParams.get('state')}`, kopf('kevin')));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://app.beispiel.test/os/gesundheit?whoop=verbunden#whoop');
    expect((await V.ladeVerbindung('kevin'))?.userId).toBe(4711);
  });
  it('Kevins state in Malins Sitzung → nichts verbunden („person“)', async () => {
    const v = await j(await verbinden.POST!(anfrage('/api/whoop/verbinden', kopf('kevin'), 'POST', {})));
    const state = new URL(v.d.url).searchParams.get('state');
    const r = await rueckruf.GET!(anfrage(`/api/whoop/rueckruf?code=${w.code(4712)}&state=${state}`, kopf('malin')));
    expect(r.headers.get('location')).toContain('whoop=person');
    expect(await V.ladeVerbindung('malin')).toBeNull();
  });
  it('Art. 9: ohne Einwilligung (a) kein Verbinden und kein Abgleich — und keine Anfrage an WHOOP', async () => {
    await verbunden('kevin', 4711);
    await einwilligen('kevin', false);
    const anzahl = w.aufrufe.length;
    expect((await j(await verbinden.POST!(anfrage('/api/whoop/verbinden', kopf('kevin'), 'POST', {})))).d).toMatchObject({ einwilligung: 'gesundheit' });
    expect((await abgleich.POST!(anfrage('/api/whoop/abgleich', kopf('kevin'), 'POST', {}))).status).toBe(403);
    expect(await A.whoopAbgleichen('kevin')).toMatchObject({ ok: false, grund: 'einwilligung' });
    expect(w.aufrufe.length).toBe(anzahl);
    expect(await db.loadJson('vitals')).toBeNull();
  });
});

describe('Abgleich', () => {
  it('Erstabgleich: Vitalwerte je Tag (Handwert gewinnt), Lauf + Training im Sport, Spiegel schlank', async () => {
    await verbunden('kevin', 4711);
    await db.saveJson('vitals', { '2026-10-08': { rec: 60, note: 'gefühlt', quellen: { rec: 'hand' } } });
    const r = await j(await abgleich.POST!(anfrage('/api/whoop/abgleich', kopf('kevin'), 'POST', {})));
    expect(r.d).toMatchObject({ ok: true });
    const v = await db.loadJson<Record<string, Record<string, unknown>>>('vitals');
    expect(v?.['2026-10-07']).toMatchObject({ rec: 81, sleep: 7.5, hrv: 61, rhr: 52, quellen: { rec: 'whoop', sleep: 'whoop', hrv: 'whoop', rhr: 'whoop' } });
    expect(v?.['2026-10-08']).toMatchObject({ rec: 60, note: 'gefühlt', sleep: 6.2, hrv: 44, rhr: 58, quellen: { rec: 'hand' } });
    const s = await db.loadJson<{ laeufe: { quelle: string; externeId: string }[]; training: { sport: string }[] }>('sport');
    expect(s?.laeufe).toEqual([expect.objectContaining({ quelle: 'whoop', externeId: `whoop:${uuid(10)}`, distanzKm: 10.02 })]);
    expect(s?.training).toEqual([expect.objectContaining({ sport: 'functional-fitness', quelle: 'whoop' })]);
    const stand = await A.ladeWhoopStand('kevin');
    expect(Object.keys(stand!.workouts)).toHaveLength(2);
    expect(stand!.zyklen['902'].strain).toBe(6.1);
    // die API v2, seitenweise mit höchstens 25
    expect(w.aufrufe.filter(a => a.pfad.startsWith('/developer/v2/')).every(a => a.pfad === '/developer/v2/user/profile/basic' || a.query.get('limit') === '25')).toBe(true);
  });
  it('zweiter Abgleich und Seiten mit next_token: keine Dubletten', async () => {
    w.seite = 1;
    await verbunden('kevin', 4711);
    await A.whoopAbgleichen('kevin');
    await A.whoopAbgleichen('kevin', { voll: true });
    const s = await db.loadJson<{ laeufe: unknown[]; training: unknown[] }>('sport');
    expect(s?.laeufe).toHaveLength(1);
    expect(s?.training).toHaveLength(1);
    expect(w.aufrufe.some(a => a.query.get('nextToken') === '1')).toBe(true);
  });
  it('429 → Pause nach X-RateLimit-Reset; der Takt fragt in der Pause nicht', async () => {
    await verbunden('kevin', 4711);
    w.fehler.push({ teil: '/v2/recovery', status: 429, kopf: { 'x-ratelimit-reset': '120' }, einmal: true });
    expect(await A.whoopAbgleichen('kevin')).toMatchObject({ ok: false, grund: 'fehler' });
    const s = await A.ladeWhoopStand('kevin');
    expect(s?.pauseBis).toBe(Date.now() + 120_000);
    expect(A.whoopFaellig(s, Date.now() + 60_000)).toBe(false);
    expect((await j(await abgleich.POST!(anfrage('/api/whoop/abgleich', kopf('kevin'), 'POST', {})))).status).toBe(429);
  });
  it('Zugang bei WHOOP widerrufen → „getrennt“, eine Glocke, Abgleich hört auf', async () => {
    await verbunden('kevin', 4711);
    w.allesWiderrufen(4711);
    expect(await A.whoopAbgleichen('kevin')).toMatchObject({ ok: false, grund: 'getrennt' });
    expect(await A.whoopAbgleichen('kevin')).toMatchObject({ ok: false, grund: 'getrennt' });
    const m = await db.loadJson<{ eintraege: { art: string }[] }>('meldungen--kevin');
    expect(m?.eintraege.filter(x => x.art === 'verbindung')).toHaveLength(1);
  });
  it('Trennen: Widerruf bei WHOOP; die übernommenen Werte bleiben bei der Person', async () => {
    await verbunden('kevin', 4711);
    await A.whoopAbgleichen('kevin');
    const r = await j(await trennen.POST!(anfrage('/api/whoop/trennen', kopf('kevin'), 'POST', {})));
    expect(r.d).toMatchObject({ ok: true, war: true, widerrufen: true });
    expect(await A.ladeWhoopStand('kevin')).toBeNull();
    expect((await db.loadJson<Record<string, unknown>>('vitals'))?.['2026-10-07']).toBeDefined();
    expect((await j(await status.GET!(anfrage('/api/whoop/status', kopf('kevin'))))).d).toMatchObject({ verbunden: false });
  });
});

describe('Webhook', () => {
  const meldung = (o: Record<string, unknown>) => Buffer.from(JSON.stringify({ user_id: 4711, id: uuid(10), type: 'workout.updated', trace_id: 'spur-1', ...o }));
  const senden = (roh: Buffer, sig?: string, ts = '1759910400000') => webhook.POST!(new Request('http://localhost/api/whoop/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-whoop-signature-timestamp': ts, 'x-whoop-signature': sig ?? W.signieren(roh, ts, 'whoop-geheimnis-test') }, body: new Uint8Array(roh) }));

  it('ohne Einrichtung 404; falsche Signatur 401 und nichts passiert', async () => {
    await verbunden('kevin', 4711);
    vi.stubEnv('WHOOP_CLIENT_SECRET', '');
    expect((await senden(meldung({}))).status).toBe(404);
    vi.stubEnv('WHOOP_CLIENT_SECRET', 'whoop-geheimnis-test');
    const vorher = w.aufrufe.length;
    expect((await senden(meldung({}), W.signieren(meldung({}), '1759910400000', 'falsch'))).status).toBe(401);
    expect((await senden(meldung({}), undefined, '1759910400999')).status).toBe(200); // passende Signatur zu einem anderen Zeitstempel → gültig
    await bis(() => w.aufrufe.length > vorher);
  });
  it('gültig → 200 leer, Abgleich danach; dieselbe trace_id ein zweites Mal wirkt nicht noch einmal', async () => {
    await verbunden('kevin', 4711);
    const r1 = await senden(meldung({}));
    expect(r1.status).toBe(200);
    expect(await r1.text()).toBe('');
    const recovery = () => w.aufrufe.filter(a => a.pfad === '/developer/v2/recovery').length;
    await bis(() => recovery() > 0);
    await stabil(recovery);
    await bis(async () => ((await A.ladeWhoopStand('kevin'))?.spuren ?? []).includes('spur-1'));
    const nach1 = recovery();
    expect((await senden(meldung({}))).status).toBe(200);
    await warte(300);
    expect(w.aufrufe.filter(a => a.pfad === '/developer/v2/recovery').length).toBe(nach1);
    expect((await A.ladeWhoopStand('kevin'))?.spuren).toEqual(['spur-1']);
  });
  it('unbekannte WHOOP-Kennung → 200 (WHOOP soll nicht wiederholen), aber nichts angelegt; nie eine Person aus dem Körper', async () => {
    await verbunden('kevin', 4711);
    expect((await senden(meldung({ user_id: 999 }))).status).toBe(200);
    await warte();
    expect(await A.ladeWhoopStand('kevin')).toBeNull();
    expect(await db.loadJson('whoop-stand--malin')).toBeNull();
  });
  it('workout.deleted → der WHOOP-Lauf fällt aus dem Sport, nichts anderes', async () => {
    await verbunden('kevin', 4711);
    await A.whoopAbgleichen('kevin');
    w.konten.get(4711)!.workout.splice(0, 1);
    expect((await senden(meldung({ type: 'workout.deleted', trace_id: 'spur-weg' }))).status).toBe(200);
    await bis(async () => ((await db.loadJson<{ laeufe: unknown[] }>('sport'))?.laeufe ?? [1]).length === 0);
    const s = await db.loadJson<{ laeufe: unknown[]; training: unknown[] }>('sport');
    expect(s?.laeufe).toEqual([]);
    expect(s?.training).toHaveLength(1);
  });
});

describe('Head of IT', () => {
  it('nur Zähler: verbunden, getrennt, ohne Einwilligung — nie Adressen/Kennungen', async () => {
    const { whoopLage } = await import('@/lib/whoop/lage');
    const { whoopBefunde } = await import('@/lib/hoi/lage');
    await verbunden('kevin', 4711); await verbunden('malin', 4712);
    await A.whoopAbgleichen('kevin');
    await V.alsGetrenntMarkieren('malin', 'Test');
    const l = await whoopLage();
    expect(l).toMatchObject({ personen: 2, getrennt: 1 });
    expect(JSON.stringify(l)).not.toMatch(/4711|4712|example|kevin|malin/);
    expect(whoopBefunde(l)[0]).toMatchObject({ id: 'whoop', ampel: 'rot' });
    expect(whoopBefunde({ personen: 1, getrennt: 0, vorMin: 30, veraltet: 0, fehler: 0, webhook: 1, ohneEinwilligung: 0, webhookMoeglich: true })[0].ampel).toBe('gruen');
    expect(whoopBefunde(null)).toEqual([]);
  });
});
