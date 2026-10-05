// ─── Zugang & Schlüssel härten, Punkt 1 (05.10.): Dienstschlüssel nur von innen, eigener Zulieferer-Schlüssel ─────
// Der Dienstschlüssel (MAKE_OS_KEY) öffnet nur noch Anfragen aus dem Docker-Netz bzw. Loopback; über Caddy (öffentliche
// Adresse in x-forwarded-for oder X-Make-Vorbau) ist er wertlos — einzige Ausnahme im Übergang: POST /api/zulieferung,
// solange MAKE_OS_ZULIEFERER_KEY fehlt. Der Zulieferer-Schlüssel öffnet NUR die Zulieferung. Nur Test-Werte.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { istPrivateAdresse, anfrageIntern, zuliefererSchluessel } from '@/lib/zugang/intern';
import { istDienst, istZulieferer } from '@/lib/zugang/dienst';
import { zugangBefunde } from '@/lib/hoi/lage';

const DIENST = 'pruef-dienstschluessel-nur-test-0001';
const ZULIEFERER = 'pruef-zulieferer-schluessel-nur-test-0001';
process.env.MAKE_OS_KEY = DIENST;
let middleware: typeof import('@/middleware').middleware;
beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
afterEach(() => { delete process.env.MAKE_OS_ZULIEFERER_KEY; });

const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
const AUSSEN = { 'x-forwarded-for': '203.0.113.7' };
const DOCKER = { 'x-forwarded-for': '::ffff:172.18.0.4' };

describe('intern: welche Adresse ist von innen', () => {
  it('Loopback, Docker-Netz und private Netze sind innen', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.3', '172.16.0.1', '172.31.255.254', '192.168.1.20', 'fd7a:115c::1', '[::1]', '172.18.0.4:51234']) expect(istPrivateAdresse(a), a).toBe(true);
  });
  it('öffentliche Adressen, Tailscale/CGNAT und Link-Local sind außen', () => {
    for (const a of ['203.0.113.7', '8.8.8.8', '172.32.0.1', '172.15.0.1', '100.64.0.1', '169.254.1.1', '2001:db8::1', 'fe80::1', '::ffff:203.0.113.7', 'unbekannt', '']) expect(istPrivateAdresse(a), a).toBe(false);
  });
  it('anfrageIntern: jede Adresse der Kette muss innen sein; X-Make-Vorbau heißt immer außen', () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(anfrageIntern(h({}))).toBe(true);
    expect(anfrageIntern(h({ 'x-forwarded-for': '127.0.0.1' }))).toBe(true);
    expect(anfrageIntern(h({ 'x-forwarded-for': '172.18.0.4, 127.0.0.1' }))).toBe(true);
    expect(anfrageIntern(h({ 'x-forwarded-for': '127.0.0.1, 203.0.113.7' }))).toBe(false);
    expect(anfrageIntern(h({ 'x-forwarded-for': '127.0.0.1', 'x-make-vorbau': '1' }))).toBe(false);
  });
  it('Zulieferer-Schlüssel gilt erst ab 24 Zeichen', () => {
    process.env.MAKE_OS_ZULIEFERER_KEY = 'kurz';
    expect(zuliefererSchluessel()).toBeNull();
    process.env.MAKE_OS_ZULIEFERER_KEY = ZULIEFERER;
    expect(zuliefererSchluessel()).toBe(ZULIEFERER);
  });
});

describe('istDienst / istZulieferer', () => {
  const req = (h: Record<string, string>) => new Request('http://localhost:3000/api/x', { headers: h });
  it('Dienstschlüssel zählt nur von innen', () => {
    expect(istDienst(req({ 'x-make-key': DIENST }))).toBe(true);
    expect(istDienst(req({ 'x-make-key': DIENST, ...DOCKER }))).toBe(true);
    expect(istDienst(req({ 'x-make-key': DIENST, ...AUSSEN }))).toBe(false);
    expect(istDienst(req({ 'x-make-key': DIENST, 'x-make-vorbau': '1' }))).toBe(false);
    expect(istDienst(req({ 'x-make-key': 'falsch', ...DOCKER }))).toBe(false);
  });
  it('Zulieferer: Kopf der Middleware oder Dienstweg von innen', () => {
    expect(istZulieferer(req({ 'x-make-zulieferer': '1', ...AUSSEN }))).toBe(true);
    expect(istZulieferer(req({ 'x-make-zulieferer': 'alt', ...AUSSEN }))).toBe(true);
    expect(istZulieferer(req({ 'x-make-zulieferer': 'ja', ...AUSSEN }))).toBe(false);
    expect(istZulieferer(req({ 'x-make-key': DIENST, ...AUSSEN }))).toBe(false);
    expect(istZulieferer(req({ 'x-make-key': DIENST }))).toBe(true);
  });
});

describe('Middleware: Dienstschlüssel nur von innen', () => {
  it('von innen (Docker-Netz, Loopback) öffnet er alles — mit Person im Kopf', async () => {
    const r = await lauf('/api/zoe/takt', { method: 'POST', headers: { 'x-make-key': DIENST, 'x-make-person': 'person-a', ...DOCKER } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-person')).toBe('person-a');
    expect(offen(await lauf('/api/konto/stand?speicher=a', { headers: { 'x-make-key': DIENST, 'x-forwarded-for': '127.0.0.1' } }))).toBe(true);
  });
  it('von außen (über Caddy) ist er wertlos: 401 überall außer der Zulieferung im Übergang', async () => {
    for (const p of ['/api/zoe/takt', '/api/konto/stand?speicher=a', '/api/intern/schreibpause', '/os']) {
      const r = await lauf(p, { method: p === '/os' ? 'GET' : 'POST', headers: { 'x-make-key': DIENST, ...AUSSEN } });
      expect(offen(r), p).toBe(false);
      expect(r.status, p).toBe(401);
    }
    const vorbau = await lauf('/api/zoe/takt', { method: 'POST', headers: { 'x-make-key': DIENST, 'x-make-vorbau': '1' } });
    expect(vorbau.status).toBe(401);
  });
  it('Übergang: ohne Zulieferer-Schlüssel darf MAKE_OS_KEY von außen NUR POST /api/zulieferung — als „alt“, ohne Schlüssel im Kopf', async () => {
    const r = await lauf('/api/zulieferung', { method: 'POST', headers: { 'x-make-key': DIENST, 'x-make-person': 'person-a', ...AUSSEN } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-zulieferer')).toBe('alt');
    expect(r.headers.get('x-middleware-request-x-make-key')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
    expect((await lauf('/api/zulieferung', { headers: { 'x-make-key': DIENST, ...AUSSEN } })).status).toBe(401);
  });
  it('mit Zulieferer-Schlüssel auf dem Server endet der Übergang', async () => {
    process.env.MAKE_OS_ZULIEFERER_KEY = ZULIEFERER;
    expect((await lauf('/api/zulieferung', { method: 'POST', headers: { 'x-make-key': DIENST, ...AUSSEN } })).status).toBe(401);
    const r = await lauf('/api/zulieferung', { method: 'POST', headers: { 'x-make-key': ZULIEFERER, ...AUSSEN } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-zulieferer')).toBe('1');
    expect(r.headers.get('x-middleware-request-x-make-key')).toBeNull();
  });
  it('der Zulieferer-Schlüssel öffnet nichts anderes — auch nicht von innen', async () => {
    process.env.MAKE_OS_ZULIEFERER_KEY = ZULIEFERER;
    for (const [p, m] of [['/api/zoe/takt', 'POST'], ['/api/zulieferung', 'GET'], ['/api/state/tasks', 'GET'], ['/api/hoi/aussen', 'POST']] as const) {
      expect((await lauf(p, { method: m, headers: { 'x-make-key': ZULIEFERER, ...AUSSEN } })).status, `${m} ${p}`).toBe(401);
      expect((await lauf(p, { method: m, headers: { 'x-make-key': ZULIEFERER, ...DOCKER } })).status, `innen ${m} ${p}`).toBe(401);
    }
  });
  it('ein Browser kann sich nicht selbst zum Zulieferer erklären', async () => {
    const r = await lauf('/api/buchung/erstgesprach-0123456789abcdef01234567', { headers: { 'x-make-zulieferer': '1', ...AUSSEN } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-zulieferer')).toBeNull();
  });
});

describe('HOI: Zulieferer-Befund', () => {
  const jetzt = '2026-10-05T12:00:00.000Z';
  it('Übergang in den letzten 7 Tagen → gelb; eigener Schlüssel → grün; nie benutzt → nichts', () => {
    expect(zugangBefunde({ zuliefererSchluessel: false, zuliefererAltZuletzt: '2026-10-05T11:00:00.000Z' }, jetzt)[0]).toMatchObject({ id: 'zulieferer', ampel: 'gelb' });
    expect(zugangBefunde({ zuliefererSchluessel: true, zuliefererAltZuletzt: '2026-10-05T11:00:00.000Z' }, jetzt)[0]).toMatchObject({ id: 'zulieferer', ampel: 'gruen' });
    expect(zugangBefunde({ zuliefererSchluessel: false, zuliefererAltZuletzt: null }, jetzt)).toEqual([]);
    expect(zugangBefunde({ zuliefererSchluessel: false, zuliefererAltZuletzt: '2026-09-20T11:00:00.000Z' }, jetzt)).toEqual([]);
  });
});
