// Push-Webhook und Kanal (lib/kalender/google/kanal.ts, Route /api/kalender/google/meldung): falsches Token → 403 ohne Inhalt,
// kein Datenleck, nie Daten in der Antwort, nur ein Abgleich wird angestoßen (höchstens alle 5 s je Person), „sync“ stößt nichts
// an, Fehlversuche je Netz gedrosselt. Kanal: nur mit öffentlicher HTTPS-Adresse, Erneuerung vor Ablauf ohne Lücke, Stoppen.
// Die Middleware lässt genau diesen Pfad (POST) ohne Sitzung durch — und nichts sonst.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-w-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-webhook';
process.env.MAKE_OS_KEY = 'dienst-test-google-webhook';

let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/kalender/google/abgleich'), S: typeof import('@/lib/kalender/google/stand');
let K: typeof import('@/lib/kalender/google/kanal'), db: typeof import('@/lib/store/local-db'), melde: { POST: (r: Request) => Promise<Response> };
let middleware: typeof import('@/middleware').middleware;
let g: GoogleFake;

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/kalender/google/abgleich'); S = await import('@/lib/kalender/google/stand');
  K = await import('@/lib/kalender/google/kanal'); db = await import('@/lib/store/local-db');
  melde = await import('../app/api/kalender/google/meldung/route') as typeof melde;
  ({ middleware } = await import('@/middleware'));
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const kanalKopf = (k: { id: string; resourceId: string }, token: string, zustand = 'exists') => ({ 'x-goog-channel-id': k.id, 'x-goog-channel-token': token, 'x-goog-resource-id': k.resourceId, 'x-goog-resource-state': zustand, 'x-goog-message-number': '2' });
const sende = async (kopf: Record<string, string>) => { const r = await melde.POST(new Request('http://localhost/api/kalender/google/meldung', { method: 'POST', headers: kopf })); return { status: r.status, text: await r.text() }; };
const kanalVon = async () => (await S.ladeGoogleStand('kevin'))!.kanal!;
/** Das Kanal-Token kennt nur Google — der Test holt es aus dem Aufruf an watch. */
const tokenVon = () => (aufrufeAn(g, '/events/watch', 'POST').pop()!.body as { token: string }).token;

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren(); K._anstossZuruecksetzen(); (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake();
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' }], einladungen: [] });
  const { url } = await V.verbindungStarten('kevin', ['kalender']);
  await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
  await A.googleAbgleichen('kevin');
});

describe('Kanal anlegen und erneuern', () => {
  it('nur mit öffentlicher HTTPS-Adresse: lokal/ohne Zertifikat/IP → „aus“ (Rückfall: Abfrage alle 5 Min.)', async () => {
    for (const a of ['http://localhost:3001', 'https://localhost', 'https://203.0.113.9', 'http://app.makeinnovation.test', 'https://nas.local']) { vi.stubEnv('MAKE_OS_ADRESSE', a); expect(K.webhookAdresse(), a).toBeNull(); expect(await K.kanalSicherstellen('kevin')).toBe('aus'); }
    vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test/');
    expect(K.webhookAdresse()).toBe('https://app.makeinnovation.test/api/kalender/google/meldung');
    expect(aufrufeAn(g, '/events/watch')).toHaveLength(0);
  });
  it('legt einen Kanal an: Kennung mit Person, Token nur als Hash im Bestand, Adresse = Webhook', async () => {
    expect(await K.kanalSicherstellen('kevin')).toBe('neu');
    const w = aufrufeAn(g, '/events/watch', 'POST')[0].body as { id: string; type: string; address: string; token: string; params: { ttl: string } };
    expect(w).toMatchObject({ type: 'web_hook', address: 'https://app.makeinnovation.test/api/kalender/google/meldung' });
    expect(w.id).toMatch(/^mk-kevin-[a-f0-9]{24}$/);
    expect(K.personAusKanalId(w.id)).toBe('kevin');
    const k = await kanalVon();
    expect(k.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(k)).not.toContain(w.token);
    expect(await K.kanalSicherstellen('kevin')).toBe('aktiv');
    expect(aufrufeAn(g, '/events/watch')).toHaveLength(1);
  });
  it('Erneuerung ab 36 Stunden Restlaufzeit: der NEUE Kanal steht, dann wird der alte gestoppt (keine Lücke)', async () => {
    await K.kanalSicherstellen('kevin');
    const alt = await kanalVon();
    vi.setSystemTime(new Date(alt.ablauf - 30 * 3600_000));
    expect(await K.kanalSicherstellen('kevin')).toBe('erneuert');
    const neu = await kanalVon();
    expect(neu.id).not.toBe(alt.id);
    const reihe = g.aufrufe.map(a => a.pfad.replace('/calendar/v3', ''));
    expect(reihe.lastIndexOf('/channels/stop')).toBeGreaterThan(reihe.lastIndexOf('/calendars/kevin%40makeinnovation.test/events/watch'));
    expect(aufrufeAn(g, '/channels/stop', 'POST').pop()!.body).toMatchObject({ id: alt.id, resourceId: alt.resourceId });
  });
  it('Kanal-Fehler stört nie: Ergebnis „fehler“, Abgleich läuft weiter', async () => {
    g.fehler.push({ teil: '/events/watch', status: 500 });
    expect(await K.kanalSicherstellen('kevin')).toBe('fehler');
    expect(await A.googleAbgleichen('kevin')).toBeTruthy();
  });
});

describe('Webhook — Prüfung', () => {
  async function mitKanal() { await K.kanalSicherstellen('kevin'); return { k: await kanalVon(), token: tokenVon() }; }
  it('richtiges Token + Kanal + Ressource: 200, LEERE Antwort, ein Abgleich wird angestoßen', async () => {
    const { k, token } = await mitKanal();
    g.setze({ id: 'neu1', summary: 'Neu', start: { dateTime: '2026-10-05T10:00:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-05T11:00:00+02:00', timeZone: 'Europe/Berlin' } });
    const vorher = aufrufeAn(g, '/events', 'GET').length;
    const r = await sende(kanalKopf(k, token));
    expect(r).toEqual({ status: 200, text: '' });
    await vi.waitFor(async () => expect((await S.ladeGoogleStand('kevin'))!.events.neu1).toBeTruthy());
    expect(aufrufeAn(g, '/events', 'GET').length).toBe(vorher + 1);
  });
  it('falsches Token → 403 ohne Inhalt, KEIN Abgleich, kein Datenleck', async () => {
    const { k } = await mitKanal();
    const vorher = g.aufrufe.length;
    const r = await sende(kanalKopf(k, 'falsch'));
    expect(r).toEqual({ status: 403, text: '' });
    expect(g.aufrufe.length).toBe(vorher);
  });
  it('falsche Ressourcen-ID, falsche Kennung, fremde Person, fehlende Köpfe → 403', async () => {
    const { k, token } = await mitKanal();
    for (const kopf of [
      kanalKopf({ ...k, resourceId: 'anders' }, token),
      kanalKopf({ ...k, id: 'mk-kevin-000000000000000000000000' }, token),
      kanalKopf({ ...k, id: 'mk-malin-aaaaaaaaaaaaaaaaaaaaaaaa' }, token),
      kanalKopf({ ...k, id: '../../etc/passwd' }, token),
      {} as Record<string, string>,
      { 'x-goog-channel-id': k.id },
    ]) expect((await sende(kopf)).status).toBe(403);
    expect(aufrufeAn(g, '/events', 'GET').length).toBe(1); // nur die erste Volllesung aus dem Aufbau
  });
  it('„sync“ (erste Meldung nach dem Anlegen) stößt nichts an; zweiter Anstoß innerhalb von 5 s ebenfalls nicht', async () => {
    const { k, token } = await mitKanal();
    const lese = () => aufrufeAn(g, '/events', 'GET').length;
    const v0 = lese();
    expect((await sende(kanalKopf(k, token, 'sync'))).status).toBe(200);
    expect(lese()).toBe(v0);
    expect((await sende(kanalKopf(k, token))).status).toBe(200);
    await vi.waitFor(() => expect(lese()).toBe(v0 + 1));
    expect((await sende(kanalKopf(k, token))).status).toBe(200);
    await new Promise(r => setTimeout(r, 30));
    expect(lese()).toBe(v0 + 1);
    vi.setSystemTime(new Date(Date.now() + 6000));
    g.setze({ id: 'n2', summary: 'N2' });
    expect((await sende(kanalKopf(k, token))).status).toBe(200);
    await vi.waitFor(() => expect(lese()).toBe(v0 + 2));
  });
  it('Fehlversuche je Netz werden gedrosselt (429) — auch ein gültiger Aufruf kommt dann kurz nicht durch', async () => {
    const { k, token } = await mitKanal();
    const stati: number[] = [];
    for (let i = 0; i < 14; i++) stati.push((await sende(kanalKopf(k, `falsch${i}`))).status);
    expect(stati.slice(0, 10).every(s => s === 403)).toBe(true);
    expect(stati.at(-1)).toBe(429);
    expect((await sende(kanalKopf(k, token))).status).toBe(429);
  });
  it('Push während eines laufenden Abgleichs geht nicht verloren: danach wird EINMAL nachgelesen', async () => {
    const { k, token } = await mitKanal();
    const lese = () => aufrufeAn(g, '/events', 'GET').length;
    const v0 = lese();
    const wie = g.handle;
    let freigeben!: () => void;
    const tor = new Promise<void>(r => { freigeben = r; });
    let erster = true;
    g.handle = async (u, i) => { const r = await wie(u, i); if (erster && /\/events/.test(u) && (i?.method ?? 'GET') === 'GET') { erster = false; await tor; } return r; };
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
    const lauf = A.googleAbgleichen('kevin');
    await vi.waitFor(() => expect(lese()).toBe(v0 + 1));
    g.setze({ id: 'spaet', summary: 'Spät', start: { dateTime: '2026-10-05T10:00:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-05T11:00:00+02:00', timeZone: 'Europe/Berlin' } });
    vi.setSystemTime(new Date(Date.now() + 6000));
    expect((await sende(kanalKopf(k, token))).status).toBe(200);
    freigeben();
    await lauf;
    await vi.waitFor(async () => expect((await S.ladeGoogleStand('kevin'))!.events.spaet).toBeTruthy());
    expect(lese()).toBe(v0 + 2);
  });
  it('die Prüfung ist rein: Kennung, Ressource und Token müssen ALLE stimmen', () => {
    const k = { id: 'mk-kevin-aaaaaaaaaaaaaaaaaaaaaaaa', resourceId: 'r1', tokenHash: 'a'.repeat(64) };
    expect(K.meldungPasst(k, { kanal: k.id, token: 'x', ressource: 'r1' })).toBe(false);
    expect(K.meldungPasst(undefined, { kanal: k.id, token: 'x', ressource: 'r1' })).toBe(false);
    expect(K.meldungPasst({ ...k, tokenHash: 'kaputt' }, { kanal: k.id, token: 'x', ressource: 'r1' })).toBe(false);
  });
});

describe('Middleware: offen ist NUR dieser Webhook (POST) und der Rückruf (cross-site)', () => {
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('POST /api/kalender/google/meldung ohne Sitzung und ohne Origin: durch — nie als Person', async () => {
    const r = await lauf('/api/kalender/google/meldung', { method: 'POST', headers: { 'x-make-user': 'kevin', 'x-make-person': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
  });
  it('alles Nachbarliche bleibt zu: GET auf den Webhook, andere Google-Wege, Unterpfade', async () => {
    for (const [p, m] of [['/api/kalender/google/meldung', 'GET'], ['/api/kalender/google', 'POST'], ['/api/kalender/google/umzug', 'POST'], ['/api/google/trennen', 'POST'], ['/api/google/status', 'GET'], ['/api/kalender/google/meldung/x', 'POST'], ['/api/kalender/google/meldungen', 'POST']] as const) {
      const r = await lauf(p, { method: m, headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } });
      expect(offen(r), `${m} ${p}`).toBe(false);
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });
  it('der Webhook nimmt einen fremden Origin nicht gesondert an — Google sendet keinen; ein Browser mit fremdem Origin darf trotzdem nur den (prüfenden) Webhook erreichen', async () => {
    const r = await lauf('/api/kalender/google/meldung', { method: 'POST', headers: { origin: 'https://fremd.example.invalid' } });
    expect(offen(r)).toBe(true); // die Route prüft Kanal + Token und liefert nie Daten
  });
  it('Rückruf der Anmeldung: nur dieser Pfad darf von Google (cross-site) angesteuert werden — jeder andere API-Weg nicht', async () => {
    const { crossSiteVerboten } = await import('@/lib/zugang/cross-site');
    const nav = new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' });
    expect(crossSiteVerboten('/api/google/rueckruf', nav)).toBe(false);
    expect(crossSiteVerboten('/api/oauth/callback', nav)).toBe(false); // Whoop/M365 (03.10.)
    for (const p of ['/api/oauth/callback/x', '/api/oauth/start', '/api/oauth/callback2']) expect(crossSiteVerboten(p, nav), p).toBe(true);
    for (const p of ['/api/google/status', '/api/google/trennen', '/api/kalender/termin', '/api/google/rueckruf/x', '/api/google/rueckruf2']) expect(crossSiteVerboten(p, nav), p).toBe(true);
    expect(crossSiteVerboten('/api/google/status', new Headers({ 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate' }))).toBe(false);
    expect(crossSiteVerboten('/os/kalender', nav)).toBe(false);
    // Und die Middleware ruft genau diese Regel auf: ein anderer Weg wird weiter vor der Sitzungsprüfung abgewiesen.
    expect((await lauf('/api/google/status', { headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } })).status).toBe(401);
  });
});
