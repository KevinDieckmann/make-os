// ─── Business-frei (08.10., Lücke 7): Termin-Route — Rückfrage statt still anlegen ─────────────────────────────────────
// Ein Business-Termin (Bereich Business bzw. Business-Kalender) in einer Business-freien Zeit → 409 { businessFrei } ohne Zeiten
// und Namen, NICHTS geschrieben; erst `businessFreiBestaetigt: true` (der Klick im Dialog) legt an. Privat, Abwesend und Zeiten
// außerhalb bleiben frei; der Dienstweg kann nicht bestätigen (403). Nachgebauter CalDAV-Server, nie echtes iCloud.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const speicher = new Map<string, unknown>();
vi.mock('@/lib/store/local-db', () => ({
  loadJson: async (n: string) => (speicher.has(n) ? structuredClone(speicher.get(n)) : null),
  saveJson: async (n: string, d: unknown) => { speicher.set(n, structuredClone(d)); },
  updateJson: async (n: string, f: (c: unknown) => unknown) => { const neu = f(speicher.has(n) ? structuredClone(speicher.get(n)) : null); speicher.set(n, structuredClone(neu)); return neu; },
  updateJsonAsync: async (n: string, f: (c: unknown) => Promise<unknown>) => { const neu = await f(speicher.has(n) ? structuredClone(speicher.get(n)) : null); speicher.set(n, structuredClone(neu)); return neu; },
}));
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => {
    const p = req.headers.get('x-make-user') ?? req.headers.get('x-make-person');
    return p === 'person-a' ? { person: p, dienst: !!req.headers.get('x-make-key') } : null;
  },
}));
vi.mock('@/lib/store/aenderungsprotokoll', async () => ({
  ...(await vi.importActual<object>('@/lib/store/aenderungsprotokoll')),
  protokolliere: async () => {},
  werAus: () => ({ art: 'person', person: 'person-a' }),
}));
// Die Business-freien Zeiten von person-a: Freitag 02.10. ab 20 Uhr bis Mitternacht.
const fensterAufrufe: string[] = [];
vi.mock('@/lib/arbeitsrahmen/server', () => ({
  businessFreiFensterFuer: async (person: string) => {
    fensterAufrufe.push(person);
    return person === 'person-a' ? [{ start: '2026-10-02T20:00:00', ende: '2026-10-03T00:00:00' }] : [];
  },
}));

import { POST } from '../app/api/kalender/termin/route';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KAL = `${HOME}home/`;
let server: Record<string, { ics: string; etag: string }>;
const puts: string[] = [];
const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
function fakeFetch(url: string, init: RequestInit): Response {
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') return ms(`<d:response><d:href>/123/calendars/home/</d:href><d:propstat><d:prop><d:displayname>Kalender Test</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>1</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === KAL && init.method === 'REPORT') return ms('');
  if (url.startsWith(KAL) && init.method === 'PUT') {
    vi.setSystemTime(new Date(Date.now() + 1000));
    puts.push(String(init.body));
    server[url.slice(KAL.length)] = { ics: String(init.body), etag: `e${puts.length}` };
    return new Response(null, { status: 201 });
  }
  return new Response('nicht gefunden', { status: 404 });
}

const anfrage = (body: unknown, kopf: Record<string, string> = { 'x-make-user': 'person-a' }) =>
  new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(body) });
const termin = (x: Record<string, unknown> = {}) => ({ titel: 'Kundengespräch', kalender: 'Kalender Test', start: '2026-10-02T20:30', ende: '2026-10-02T21:30', bereich: 'business', ...x });

beforeEach(() => {
  speicher.clear(); puts.length = 0; fensterAufrufe.length = 0; server = {};
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-30T08:00:00.000Z'));
  vi.stubEnv('ICLOUD_APPLE_ID', 'test@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('MAKE_OS_KEY', 'dienst-test-schluessel');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Termin-Route: Business-Termin in Business-freier Zeit', () => {
  it('ohne Bestätigung: 409 { businessFrei } — ohne Zeiten und Namen, KEIN PUT', async () => {
    const r = await POST(anfrage(termin()));
    expect(r.status).toBe(409);
    const d = await r.json() as Record<string, unknown>;
    expect(d).toMatchObject({ ok: false, businessFrei: true });
    expect(String(d.fehler)).toMatch(/^Business-frei — trotzdem\?/);
    expect(JSON.stringify(d)).not.toMatch(/20:00|person-a|Familie/);
    expect(puts).toEqual([]);
  });

  it('mit Bestätigung aus dem Dialog: angelegt', async () => {
    const r = await POST(anfrage(termin({ businessFreiBestaetigt: true })));
    expect(r.status).toBe(200);
    expect(puts).toHaveLength(1);
  });

  it('Privat (ohne Business-Bereich, privater Kalender), Abwesend und Zeiten außerhalb bleiben frei', async () => {
    expect((await POST(anfrage(termin({ bereich: undefined, titel: 'Abendessen' })))).status).toBe(200);
    expect((await POST(anfrage(termin({ art: 'abwesend', titel: 'Weg' })))).status).toBe(200);
    expect((await POST(anfrage(termin({ start: '2026-10-02T10:00', ende: '2026-10-02T11:00' })))).status).toBe(200);
    expect(puts).toHaveLength(3);
    // Der private Termin fragt die Business-freien Zeiten gar nicht erst ab.
    expect(fensterAufrufe).toEqual(['person-a']);
  });

  it('ganztägig an dem Tag zählt mit; der Dienstweg kann nicht bestätigen (403)', async () => {
    expect((await POST(anfrage(termin({ ganztags: true, start: '2026-10-02', ende: '2026-10-03' })))).status).toBe(409);
    const d = await POST(anfrage(termin({ businessFreiBestaetigt: true }), { 'x-make-key': 'dienst-test-schluessel', 'x-make-person': 'person-a' }));
    expect(d.status).toBe(403);
    expect(puts).toEqual([]);
  });
});
