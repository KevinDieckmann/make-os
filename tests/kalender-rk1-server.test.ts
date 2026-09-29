// Kalender R-K1 (29.09.) — Abgleich und Termin-Route gegen einen nachgebauten CalDAV-Server mit drei Kalendern: gleiche
// UID in zwei Kalendern (#46), 403 eines Kalenders stoppt den Rest nicht (#51), 401/503 mit Pause (#50), gekürzte
// Antwort (#43), Zeitüberschreitung beim Anlegen ohne Duplikat (#38), ohne ETag nie blind (#37), fremd-private
// Termine per API unantastbar (#96), abgesagt belegt nicht (#68). Nie echtes iCloud, erfundene Daten (@example.invalid).
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
vi.mock('@/lib/store/aenderungsprotokoll', () => ({
  protokolliere: async (bestand: string, aenderungen: { op: string; id: string; felder?: string[] }[]) => { protokoll.push({ bestand, aenderungen }); },
  werAus: () => ({ art: 'person', person: 'kevin' }),
}));

import { POST, PATCH, DELETE } from '../app/api/kalender/termin/route';
import { GET } from '../app/api/kalender/route';
import { abgleichen, ladeStand, anlegen } from '../lib/kalender/icloud';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KAL = { home: 'Privat Kevin', 'ABC-work-7': 'Gemeinsam', geteilt: 'Geteilt' } as const;
type KalName = keyof typeof KAL;
let server: Record<KalName, Record<string, { ics: string; etag?: string }>>;
let ctag = 1;
let status: { report403?: KalName; report507?: KalName; alle?: number; retryAfter?: string; putTimeout?: number; getText?: string } = {};
let puts: string[] = [];
const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ok = (x: string) => `<d:status>HTTP/1.1 200 OK</d:status>${x}`;

function fakeFetch(url: string, init: RequestInit): Response {
  const kopf = (init.headers ?? {}) as Record<string, string>;
  if (status.alle) return new Response('', { status: status.alle, headers: status.retryAfter ? { 'retry-after': status.retryAfter } : {} });
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms(`<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop>${ok('')}</d:propstat></d:response>`);
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set><c:calendar-user-address-set><d:href>mailto:kevin@example.invalid</d:href></c:calendar-user-address-set></d:prop>${ok('')}</d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') return ms((Object.keys(KAL) as KalName[]).map(k => `<d:response><d:href>/123/calendars/${k}/</d:href><d:propstat><d:prop><d:displayname>${KAL[k]}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${ctag}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop>${ok('')}</d:propstat></d:response>`).join(''));
  for (const k of Object.keys(KAL) as KalName[]) {
    const basis = `${HOME}${k}/`;
    if (url === basis && init.method === 'REPORT') {
      if (status.report403 === k) return new Response('', { status: 403 });
      if (status.report507 === k) return ms(`<d:response><d:href>/123/calendars/${k}/</d:href><d:status>HTTP/1.1 507 Insufficient Storage</d:status></d:response>`);
      return ms(Object.entries(server[k]).map(([n, o]) => `<d:response><d:href>/123/calendars/${k}/${n}</d:href><d:propstat><d:prop>${o.etag ? `<d:getetag>"${o.etag}"</d:getetag>` : ''}<c:calendar-data>${esc(o.ics)}</c:calendar-data></d:prop>${ok('')}</d:propstat></d:response>`).join(''));
    }
    if (url.startsWith(basis)) {
      const name = decodeURIComponent(url.slice(basis.length)), da = server[k][name];
      if (init.method === 'GET') return da ? new Response(status.getText ?? da.ics, { status: 200, headers: { etag: `"${da.etag ?? 'geholt'}"` } }) : new Response('', { status: 404 });
      if (init.method === 'PUT') {
        if (kopf['If-None-Match'] === '*' && da) return new Response('', { status: 412 });
        if (kopf['If-Match'] && (!da || `"${da.etag ?? 'geholt'}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
        server[k][name] = { ics: String(init.body), etag: `e${puts.length + 1}` }; ctag++; puts.push(`${k}/${name}`);
        // Zeitüberschreitung NACH dem Speichern (die Antwort geht verloren) — so wie iCloud es tun kann.
        if (status.putTimeout && status.putTimeout-- > 0) throw Object.assign(new Error('Zeitüberschreitung'), { name: 'TimeoutError' });
        return new Response(null, { status: da ? 204 : 201 });
      }
      if (init.method === 'DELETE') { delete server[k][name]; ctag++; return new Response(null, { status: 204 }); }
    }
  }
  return new Response('nicht gefunden', { status: 404 });
}

const vcal = (uid: string, ...zeilen: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//DE\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\n${zeilen.join('\r\n')}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const TERMIN = (titel: string, tag = '20261001', extra: string[] = []) => [`DTSTART;TZID=Europe/Berlin:${tag}T090000`, `DTEND;TZID=Europe/Berlin:${tag}T100000`, `SUMMARY:${titel}`, ...extra];
const anfrage = (methode: string, body?: unknown, person = 'kevin', suche = '') =>
  new Request(`http://localhost/api/kalender/termin${suche}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body ? { body: JSON.stringify(body) } : {}) });
const lesen = (person = 'kevin') => GET(new Request('http://localhost/api/kalender?von=2026-09-28&bis=2026-10-05', { headers: { 'x-make-user': person } })).then(r => r.json());

beforeEach(() => {
  speicher.clear(); protokoll.length = 0; puts = []; ctag = 1; status = {};
  server = {
    home: { 'gleich.ics': { ics: vcal('gleich', ...TERMIN('Kopie Kevin')), etag: 'h1' }, 'arzt.ics': { ics: vcal('arzt', ...TERMIN('Arzt', '20261002', ['CLASS:PRIVATE'])), etag: 'h2' } },
    'ABC-work-7': { 'gleich.ics': { ics: vcal('gleich', ...TERMIN('Kopie Gemeinsam')), etag: 'w1' }, 'abgesagt.ics': { ics: vcal('abgesagt', ...TERMIN('Fällt aus', '20261003', ['STATUS:CANCELLED'])), etag: 'w2' } },
    geteilt: { 'fremd.ics': { ics: vcal('fremd', ...TERMIN('Geteilt', '20260930')), etag: 'g1' } },
  };
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('#46 gleiche UID in zwei Kalendern', () => {
  it('zwei Termine mit eigener id; Ändern trifft den richtigen Kalender; die alte reine UID ist mehrdeutig → 409', async () => {
    const t = (await lesen()).termine.filter((x: { uid: string }) => x.uid === 'gleich');
    expect(t.map((x: { id: string }) => x.id).sort()).toEqual(['ABC-work-7|gleich', 'home|gleich']);
    const r = await PATCH(anfrage('PATCH', { uid: 'ABC-work-7|gleich', titel: 'Nur Gemeinsam' }));
    expect(r.status).toBe(200);
    expect(server['ABC-work-7']['gleich.ics'].ics).toContain('SUMMARY:Nur Gemeinsam');
    expect(server.home['gleich.ics'].ics).toContain('SUMMARY:Kopie Kevin');
    expect(protokoll.at(-1)?.aenderungen[0]).toMatchObject({ op: 'geaendert', id: 'ABC-work-7|gleich' });
    const alt = await PATCH(anfrage('PATCH', { uid: 'gleich', titel: 'Irgendwo' }));
    expect(alt.status).toBe(409);
    expect(server.home['gleich.ics'].ics).toContain('SUMMARY:Kopie Kevin');
  });
  it('Bezug hängt am Kalender: Kontakt an der Kopie in „Gemeinsam“ erscheint nicht an der Kopie in „Privat Kevin“', async () => {
    await lesen();
    expect((await PATCH(anfrage('PATCH', { uid: 'ABC-work-7|gleich', bezug: { kontaktId: 'c-anna' } }))).status).toBe(200);
    const t = (await lesen()).termine.filter((x: { uid: string }) => x.uid === 'gleich');
    expect(t.find((x: { id: string }) => x.id === 'ABC-work-7|gleich').bezug).toEqual({ kontaktId: 'c-anna' });
    expect(t.find((x: { id: string }) => x.id === 'home|gleich').bezug).toBeUndefined();
  });
  it('eine alte eindeutige UID geht weiter; ihr alter Bezug-Eintrag zieht beim Abgleich auf den neuen Schlüssel', async () => {
    speicher.set('kalender-bezug', { bezuege: { arzt: { kontaktId: 'c-doc', geaendert: '2026-09-01T00:00:00Z' } } });
    await abgleichen({ erzwingen: true });
    const b = (speicher.get('kalender-bezug') as { bezuege: Record<string, unknown> }).bezuege;
    expect(b['home|arzt']).toMatchObject({ kontaktId: 'c-doc' }); expect(b.arzt).toBeUndefined();
    expect((await PATCH(anfrage('PATCH', { uid: 'arzt', titel: 'Arzt (neu)' }))).status).toBe(200);
    expect(server.home['arzt.ics'].ics).toContain('SUMMARY:Arzt (neu)');
  });
});

describe('#51/#43/#50 Abgleich: ein Kalender scheitert, der Rest läuft; Pause', () => {
  it('403 eines Kalenders: übersprungen mit Hinweis, alter Stand bleibt, keine „abgelehnte Anmeldung“', async () => {
    await abgleichen({ erzwingen: true });
    status.report403 = 'geteilt';
    server.home['neu.ics'] = { ics: vcal('neu', ...TERMIN('Neu', '20261001')), etag: 'h3' }; ctag++;
    const s = await abgleichen({ erzwingen: true });
    expect(s.hinweise).toEqual([{ kalender: 'Geteilt', grund: expect.stringContaining('403') }]);
    expect(s.fehlerAnmeldung).toBeUndefined();
    const d = await lesen();
    expect(d.termine.map((x: { titel: string }) => x.titel)).toEqual(expect.arrayContaining(['Neu', 'Geteilt']));
    expect(d.abgleich).toMatchObject({ vorMin: 0, veraltet: false, hinweise: [{ kalender: 'Geteilt' }] });
    // Der ctag des übersprungenen Kalenders bleibt alt — der nächste Lauf versucht ihn wieder.
    status.report403 = undefined;
    server.geteilt['zwei.ics'] = { ics: vcal('zwei', ...TERMIN('Zwei', '20261001')), etag: 'g2' };
    const s2 = await abgleichen();
    expect(s2.hinweise).toBeUndefined();
    expect(Object.values(s2.objekte).flat().some(o => o.ics.includes('UID:zwei'))).toBe(true);
  });
  it('gekürzte Antwort (507) wird gemeldet, nicht still übernommen', async () => {
    await abgleichen({ erzwingen: true });
    status.report507 = 'home';
    const s = await abgleichen({ erzwingen: true });
    expect(s.hinweise?.[0]).toMatchObject({ kalender: 'Privat Kevin', grund: expect.stringContaining('gekürzt') });
    expect(s.objekte[`${HOME}home/`].length).toBe(2);
  });
  it('401 = Anmeldung (30 Min. Pause); 503 mit Retry-After: Pause danach', async () => {
    status.alle = 401;
    await expect(abgleichen({ erzwingen: true })).rejects.toMatchObject({ status: 401 });
    let s = await ladeStand();
    expect(s.fehlerAnmeldung).toBe(true);
    expect(Date.parse(s.pauseBis!) - Date.parse(s.fehlerAt!)).toBe(30 * 60_000);
    status = { alle: 503, retryAfter: '900' };
    await expect(abgleichen({ erzwingen: true })).rejects.toMatchObject({ status: 503 });
    s = await ladeStand();
    expect(s.fehlerAnmeldung).toBe(false);
    expect(s.fehlerFolge).toBe(2);
    expect(Date.parse(s.pauseBis!) - Date.parse(s.fehlerAt!)).toBe(900_000);
  });
});

describe('#38 Zeitüberschreitung, #37 ohne ETag', () => {
  it('Anlegen: die Antwort geht verloren → nachsehen, kein zweiter Termin, keine neue UID', async () => {
    await abgleichen({ erzwingen: true });
    status.putTimeout = 1;
    const r = await anlegen({ titel: 'Einmal', kalender: 'Privat Kevin', start: '2026-10-01T12:00:00', ende: '2026-10-01T13:00:00' });
    expect(puts).toHaveLength(1);
    expect(Object.keys(server.home).filter(n => server.home[n].ics.includes('SUMMARY:Einmal'))).toEqual([`${r.uid}.ics`]);
    expect(r.schluessel).toBe(`home|${r.uid}`);
  });
  it('fehlt der ETag, wird er geholt; weicht der Server-Text ab → 409 statt blind zu schreiben', async () => {
    server.home['ohne.ics'] = { ics: vcal('ohne', ...TERMIN('Ohne Stand')) };
    await abgleichen({ erzwingen: true });
    expect((await PATCH(anfrage('PATCH', { uid: 'home|ohne', titel: 'Mit Stand' }))).status).toBe(200);
    expect(server.home['ohne.ics'].ics).toContain('SUMMARY:Mit Stand');
    server.home['ohne2.ics'] = { ics: vcal('ohne2', ...TERMIN('Ohne 2')) };
    await abgleichen({ erzwingen: true });
    delete server.home['ohne2.ics'].etag;
    status.getText = vcal('ohne2', ...TERMIN('Am iPhone geändert'));
    const r = await PATCH(anfrage('PATCH', { uid: 'home|ohne2', titel: 'Meins' }));
    expect(r.status).toBe(409);
    expect(puts.some(p => p.endsWith('ohne2.ics'))).toBe(false);
  });
});

describe('#96 Rechte, #68 abgesagt', () => {
  it('Malin darf Kevins privaten Termin weder per PATCH ändern noch löschen — auch nicht mit Schlüssel', async () => {
    const m = (await lesen('malin')).termine.find((x: { titel: string; start: string }) => x.start === '2026-10-02T09:00:00');
    expect(m).toMatchObject({ titel: 'Belegt', maskiert: true });
    expect(m.uid).not.toBe('arzt');
    expect((await PATCH(anfrage('PATCH', { uid: 'home|arzt', titel: 'Gehackt' }, 'malin'))).status).toBe(403);
    expect((await PATCH(anfrage('PATCH', { uid: 'arzt', bezug: { kontaktId: 'c-x' } }, 'malin'))).status).toBe(403);
    expect((await DELETE(anfrage('DELETE', undefined, 'malin', '?uid=home%7Carzt'))).status).toBe(403);
    expect(server.home['arzt.ics'].ics).toContain('SUMMARY:Arzt');
    expect((await PATCH(anfrage('PATCH', { uid: 'home|arzt', titel: 'Arzt Kevin' }, 'kevin'))).status).toBe(200);
  });
  it('STATUS:CANCELLED: im Kalender als abgesagt markiert, belegt nicht', async () => {
    const t = (await lesen()).termine.find((x: { uid: string }) => x.uid === 'abgesagt');
    expect(t).toMatchObject({ status: 'abgesagt', abgesagt: true, beschaeftigt: false });
  });
  it('POST liefert den Schlüssel; Anlegen mit Endzone', async () => {
    const r = await (await POST(anfrage('POST', { titel: 'Flug', start: '2026-10-01T18:00', ende: '2026-10-01T20:00', endZone: 'America/New_York' }))).json();
    expect(r).toMatchObject({ ok: true, schluessel: `home|${r.uid}` });
    expect(server.home[`${r.uid}.ics`].ics).toContain('DTEND;TZID=America/New_York:20261001T200000');
  });
});
