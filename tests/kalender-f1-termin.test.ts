// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.) #6: Termin anlegen idempotent — die UID entsteht im Browser (Entwurf), ein
// zweites Senden nach verlorener Antwort legt nichts doppelt an; was NACH dem iCloud-Schreiben scheitert (Protokoll,
// Bezug zu groß), ist ein Hinweis, kein 502/413 — sonst sendet der Browser erneut. Nachgebauter CalDAV-Server wie in
// tests/kalender-k1-route.test.ts, nie echtes iCloud, erfundene Daten.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const speicher = new Map<string, unknown>();
vi.mock('@/lib/store/local-db', () => ({
  loadJson: async (n: string) => (speicher.has(n) ? structuredClone(speicher.get(n)) : null),
  saveJson: async (n: string, d: unknown) => { speicher.set(n, structuredClone(d)); },
  updateJson: async (n: string, f: (c: unknown) => unknown) => { const neu = f(speicher.has(n) ? structuredClone(speicher.get(n)) : null); speicher.set(n, structuredClone(neu)); return neu; },
}));
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));
const protokoll: { bestand: string; aenderungen: { op: string; id: string; felder?: string[] }[] }[] = [];
const zustand = { protokollScheitert: false };
vi.mock('@/lib/store/aenderungsprotokoll', () => ({
  protokolliere: async (bestand: string, aenderungen: { op: string; id: string; felder?: string[] }[]) => { if (zustand.protokollScheitert) throw new Error('Platte voll'); protokoll.push({ bestand, aenderungen }); },
  werAus: () => ({ art: 'person', person: 'kevin' }),
}));

import { POST, PATCH } from '../app/api/kalender/termin/route';
import { BEZUG_MAX } from '../lib/kalender/bezug';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KEVIN = `${HOME}home/`;
let server: Record<string, { ics: string; etag: string }>;
let ctag = 1;
let puts = 0;
const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function fakeFetch(url: string, init: RequestInit): Response {
  const kopf = (init.headers ?? {}) as Record<string, string>;
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') return ms(`<d:response><d:href>/123/calendars/home/</d:href><d:propstat><d:prop><d:displayname>Privat Kevin</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${ctag}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === KEVIN && init.method === 'REPORT') return ms(Object.entries(server).map(([n, o]) => `<d:response><d:href>/123/calendars/home/${n}</d:href><d:propstat><d:prop><d:getetag>"${o.etag}"</d:getetag><c:calendar-data>${esc(o.ics)}</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
  if (url.startsWith(KEVIN)) {
    const name = url.slice(KEVIN.length), da = server[name];
    if (init.method === 'PUT') {
      puts++;
      if (kopf['If-Match'] && (!da || `"${da.etag}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
      server[name] = { ics: String(init.body), etag: `e${puts}x` }; ctag++;
      return new Response(null, { status: da ? 204 : 201 });
    }
    if (init.method === 'DELETE') { delete server[name]; ctag++; return new Response(null, { status: 204 }); }
  }
  return new Response('nicht gefunden', { status: 404 });
}

const anfrage = (methode: string, body?: unknown, person = 'kevin', extra: Record<string, string> = {}, suche = '') =>
  new Request(`http://localhost/api/kalender/termin${suche}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  speicher.clear(); protokoll.length = 0; puts = 0; ctag = 1; zustand.protokollScheitert = false;
  server = { 'serie.ics': { ics: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:serie\r\nDTSTAMP:20260901T100000Z\r\nDTSTART:20260928T060000Z\r\nDTEND:20260928T063000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Tagesstart\r\nEND:VEVENT\r\nEND:VCALENDAR`, etag: 's1' } };
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('F1 #6 Termin anlegen idempotent', () => {
  const UID = 'makeos-t-0f6c1e2a-0000-4000-8000-000000000001';
  const koerper = { titel: 'Probe Anlegen', start: '2026-09-30T09:00', ende: '2026-09-30T10:00', uid: UID };

  it('zweimal dieselbe UID → ein Termin; die zweite Antwort sagt schonDa, protokolliert wird einmal', async () => {
    const a = await POST(anfrage('POST', koerper));
    const da = await a.json();
    expect(a.status).toBe(200);
    expect(da.uid).toBe(UID);
    const b = await POST(anfrage('POST', koerper));
    const db = await b.json();
    expect(b.status).toBe(200);
    expect(db).toMatchObject({ ok: true, uid: UID, schonDa: true });
    expect(puts).toBe(1);
    expect(Object.values(server).filter(o => o.ics.includes(`UID:${UID}`))).toHaveLength(1);
    expect(protokoll.filter(p => p.aenderungen.some(x => x.op === 'neu'))).toHaveLength(1);
  });

  it('ungültige UID → 400, nichts geschrieben', async () => {
    const r = await POST(anfrage('POST', { ...koerper, uid: 'x/../böse' }));
    expect(r.status).toBe(400);
    expect(puts).toBe(0);
  });

  it('Protokoll scheitert nach dem Anlegen → 200 mit Hinweis (kein 502), der Termin steht', async () => {
    zustand.protokollScheitert = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await POST(anfrage('POST', koerper));
    warn.mockRestore();
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.hinweis).toMatch(/Änderungsprotokoll/);
    expect(puts).toBe(1);
  });

  it('PATCH: Bezug zu groß nach dem iCloud-Schreiben → 200 mit Hinweis; nur Bezug (ohne iCloud) → weiter 413', async () => {
    const d = await (await POST(anfrage('POST', koerper))).json();
    const voll: Record<string, unknown> = {};
    for (let i = 0; i < BEZUG_MAX; i++) voll[`k|u${i}`] = { von: 'kevin' };
    speicher.set('kalender-bezug', { version: 1, bezuege: voll });
    const r = await PATCH(anfrage('PATCH', { uid: d.schluessel, titel: 'Probe umbenannt', farbe: 'gold' }));
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.hinweis).toMatch(/zu groß/);
    expect(Object.values(server).find(o => o.ics.includes(`UID:${UID}`))!.ics).toContain('SUMMARY:Probe umbenannt');
    const nurBezug = await PATCH(anfrage('PATCH', { uid: d.schluessel, bezug: { aufgabeId: 't-1' } }));
    expect(nurBezug.status).toBe(413);
  });
});
