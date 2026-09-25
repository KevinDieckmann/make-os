// iCloud-Abgleich gegen einen nachgebauten CalDAV-Server (25.09.):
// Entdecken, nur Geänderte holen, Anlegen/Verschieben/Löschen mit ETag,
// Zugang nie an fremde Adressen, Serien und Einladungen bleiben unangetastet.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const speicher = new Map<string, unknown>();
vi.mock('@/lib/store/local-db', () => ({
  loadJson: async (n: string) => (speicher.has(n) ? structuredClone(speicher.get(n)) : null),
  saveJson: async (n: string, d: unknown) => { speicher.set(n, structuredClone(d)); },
}));

import { abgleichen, anlegen, aendern, loeschen, termineImZeitraum, ladeStand, verbunden, naechsterVersuchFaellig, frischerStand } from '../lib/kalender/icloud';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KEVIN = `${HOME}home/`, MALIN = `${HOME}malin-geteilt/`;
const ev = (uid: string, start: string, ende: string, titel: string, extra = '') =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\nDTSTART:${start}\r\nDTEND:${ende}\r\nSUMMARY:${titel}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR`;

interface Obj { ics: string; etag: string }
let server: Record<string, Record<string, Obj>>;
let ctag: Record<string, number>;
let anfragen: { url: string; method: string; auth: boolean; kopf: Record<string, string> }[];
let reportZaehler: Record<string, number>;

const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function fakeFetch(url: string, init: RequestInit) {
  const kopf = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
  anfragen.push({ url, method: init.method ?? 'GET', auth: !!kopf.Authorization, kopf });
  const body = String(init.body ?? '');
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>https://p42-caldav.icloud.com:443/123/calendars/</d:href></c:calendar-home-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') {
    const kal = (href: string, name: string, schreiben: boolean) => `<d:response><d:href>${new URL(href).pathname}</d:href><d:propstat><d:prop><d:displayname>${name}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${ctag[href]}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set><d:current-user-privilege-set><d:privilege><d:read/></d:privilege>${schreiben ? '<d:privilege><d:write/></d:privilege>' : ''}</d:current-user-privilege-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
    return ms(`<d:response><d:href>/123/calendars/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>${kal(KEVIN, 'Privat Kevin', true)}${kal(MALIN, 'Privat Malin', false)}`);
  }
  const kal = Object.keys(server).find(k => url.startsWith(k));
  if (kal && init.method === 'REPORT') {
    reportZaehler[kal] = (reportZaehler[kal] ?? 0) + 1;
    return ms(Object.entries(server[kal]).map(([n, o]) => `<d:response><d:href>${new URL(kal).pathname}${n}</d:href><d:propstat><d:prop><d:getetag>"${o.etag}"</d:getetag><c:calendar-data>${esc(o.ics)}</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
  }
  if (kal) {
    const name = url.slice(kal.length);
    const da = server[kal][name];
    if (init.method === 'PUT') {
      if (kopf['If-None-Match'] === '*' && da) return new Response('', { status: 412 });
      if (kopf['If-Match'] && (!da || `"${da.etag}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
      server[kal][name] = { ics: body, etag: `e${Math.random().toString(36).slice(2, 7)}` };
      ctag[kal]++;
      return new Response(null, { status: da ? 204 : 201 });
    }
    if (init.method === 'DELETE') {
      if (kopf['If-Match'] && da && `"${da.etag}"` !== kopf['If-Match']) return new Response('', { status: 412 });
      delete server[kal][name]; ctag[kal]++;
      return new Response(null, { status: 204 });
    }
  }
  return new Response('nicht gefunden', { status: 404 });
}

beforeEach(() => {
  speicher.clear();
  anfragen = []; reportZaehler = {};
  ctag = { [KEVIN]: 1, [MALIN]: 1 };
  server = {
    [KEVIN]: {
      'a.ics': { ics: ev('a', '20260928T070000Z', '20260928T080000Z', 'Steuerberater'), etag: 'e1' },
      'serie.ics': { ics: ev('serie', '20260101T060000Z', '20260101T063000Z', 'Tagesstart', 'RRULE:FREQ=DAILY\r\n'), etag: 'e2' },
    },
    [MALIN]: { 'm.ics': { ics: ev('m', '20260929T160000Z', '20260929T170000Z', 'Yoga', 'ATTENDEE:mailto:x@example.invalid\r\n'), etag: 'e3' } },
  };
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('iCloud-Abgleich', () => {
  it('entdeckt die Kalender, faltet Serien auf und schreibt den Cache für alle Leser', async () => {
    expect(verbunden()).toBe(true);
    const s = await abgleichen();
    expect(s.kalender.map(k => [k.name, k.schreibbar])).toEqual([['Privat Kevin', true], ['Privat Malin', false]]);
    const t = termineImZeitraum(s, '2026-09-28', '2026-09-30');
    expect(t.map(x => [x.titel, x.start, x.bearbeitbar])).toEqual([
      ['Tagesstart', '2026-09-28T08:00:00', false], ['Steuerberater', '2026-09-28T09:00:00', true],
      ['Tagesstart', '2026-09-29T08:00:00', false], ['Yoga', '2026-09-29T18:00:00', false],
    ]);
    const cache = speicher.get('calendar-cache') as { events: { title: string; startDate: string; calendarName: string }[]; quelle: string };
    expect(cache.quelle).toBe('icloud');
    expect(cache.events.some(e => e.title === 'Steuerberater' && e.startDate === '2026-09-28T09:00:00' && e.calendarName === 'Privat Kevin')).toBe(true);
    expect(anfragen.every(a => a.auth && new URL(a.url).hostname.endsWith('icloud.com'))).toBe(true);
  });

  it('holt nur Kalender neu, deren ctag sich geändert hat', async () => {
    await abgleichen();
    await abgleichen({});
    expect(reportZaehler).toEqual({ [KEVIN]: 1, [MALIN]: 1 });
    ctag[MALIN]++;
    await abgleichen();
    expect(reportZaehler).toEqual({ [KEVIN]: 1, [MALIN]: 2 });
  });

  it('anlegen → verschieben → löschen, jeweils mit ETag; der Stand ist danach sofort da', async () => {
    const { uid, kalender } = await anlegen({ titel: 'Fokus: Plan', kalender: 'privat kevin', start: '2026-09-30T09:00:00', ende: '2026-09-30T10:30:00' });
    expect(kalender).toBe('Privat Kevin');
    const put = anfragen.find(a => a.method === 'PUT')!;
    expect(put.kopf['If-None-Match']).toBe('*');
    expect(put.url).toBe(`${KEVIN}${uid}.ics`);
    let s = await ladeStand();
    expect(termineImZeitraum(s, '2026-09-30', '2026-10-01').map(x => [x.titel, x.start])).toContainEqual(['Fokus: Plan', '2026-09-30T09:00:00']);

    await aendern(uid, { start: '2026-10-01T14:00:00' });
    expect(anfragen.filter(a => a.method === 'PUT').at(-1)!.kopf['If-Match']).toMatch(/^"e/);
    s = await ladeStand();
    expect(termineImZeitraum(s, '2026-10-01', '2026-10-02').find(x => x.uid === uid)).toMatchObject({ start: '2026-10-01T14:00:00', ende: '2026-10-01T15:30:00' });

    await loeschen(uid);
    s = await ladeStand();
    expect(termineImZeitraum(s, '2026-09-01', '2026-11-01').some(x => x.uid === uid)).toBe(false);
  });

  it('Konflikt: woanders geändert → 409, nichts überschrieben', async () => {
    await abgleichen();
    // Jemand ändert am iPhone — ohne dass MAKE OS es schon gesehen hat.
    server[KEVIN]['a.ics'] = { ics: ev('a', '20260928T090000Z', '20260928T100000Z', 'Steuerberater (iPhone)'), etag: 'neu' };
    speicher.set('kalender-icloud', { ...(speicher.get('kalender-icloud') as object), at: new Date().toISOString() });
    await expect(aendern('a', { titel: 'Anders' })).rejects.toMatchObject({ status: 409 });
    expect(server[KEVIN]['a.ics'].ics).toContain('Steuerberater (iPhone)');
  });

  it('Serien, Einladungen und fremde Kalender bleiben unangetastet', async () => {
    await abgleichen();
    await expect(aendern('serie', { titel: 'X' })).rejects.toMatchObject({ status: 400 });
    await expect(loeschen('serie')).rejects.toThrow(/Serientermin/);
    await expect(loeschen('m')).rejects.toMatchObject({ status: 403 });
    await expect(anlegen({ titel: 'X', kalender: 'Privat Malin', start: '2026-09-30T09:00:00', ende: '2026-09-30T10:00:00' })).rejects.toMatchObject({ status: 403 });
    expect(anfragen.some(a => a.method === 'PUT' || a.method === 'DELETE')).toBe(false);
  });

  it('Zugang geht nie an eine fremde Adresse — auch nicht über eine Weiterleitung', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => {
      anfragen.push({ url: String(u), method: i.method ?? 'GET', auth: true, kopf: {} });
      return new Response('', { status: 302, headers: { location: 'https://boese.example/123/' } });
    }));
    await expect(abgleichen()).rejects.toThrow(/nur an iCloud/);
    expect(anfragen.map(a => new URL(a.url).hostname)).toEqual(['caldav.icloud.com']);
    expect((speicher.get('kalender-icloud') as { fehler?: string }).fehler).toMatch(/nur an iCloud/);
  });

  it('abgelehnte Anmeldung: Stand bleibt, nächster Versuch erst nach 30 Minuten (Apple sperrt sonst)', async () => {
    await abgleichen();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const vorher = (await ladeStand()).at!;
    speicher.set('kalender-icloud', { ...(speicher.get('kalender-icloud') as object), at: new Date(Date.now() - 5 * 60_000).toISOString() });
    const s = await frischerStand();
    expect(s.fehler).toMatch(/lehnt die Anmeldung ab/);
    expect(s.kalender.length).toBe(2);
    expect(termineImZeitraum(s, '2026-09-28', '2026-09-29').length).toBeGreaterThan(0);
    const aufrufe = (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await frischerStand();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(aufrufe);
    expect(naechsterVersuchFaellig(s, Date.now() + 29 * 60_000)).toBe(false);
    expect(naechsterVersuchFaellig(s, Date.now() + 31 * 60_000)).toBe(true);
    expect(vorher).toBeTruthy();
  });
});
