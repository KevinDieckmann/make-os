// Kalender K1 (29.09.): Termin-Route gegen einen nachgebauten CalDAV-Server — Arten, privat (Belegt für die andere
// Person), Bezug nur im Neben-Bestand, Stand/409 mit aktuellem Termin, Bezug an Serien ohne iCloud-Schreiben,
// Build-Kennung, Änderungsprotokoll ohne Titel. Nie echtes iCloud, erfundene Daten.
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
const lesen = (person: string) => GET(new Request('http://localhost/api/kalender?von=2026-09-28&bis=2026-10-05', { headers: { 'x-make-user': person } })).then(r => r.json());

beforeEach(() => {
  speicher.clear(); protokoll.length = 0; puts = 0; ctag = 1;
  server = { 'serie.ics': { ics: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:serie\r\nDTSTAMP:20260901T100000Z\r\nDTSTART:20260928T060000Z\r\nDTEND:20260928T063000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Tagesstart\r\nEND:VEVENT\r\nEND:VCALENDAR`, etag: 's1' } };
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Termin-Route (K1)', () => {
  it('legt eine private Fokuszeit an: Art/CLASS im Termin, Bezug + Sicherung nur im Neben-Bestand, Protokoll ohne Titel', async () => {
    const r = await POST(anfrage('POST', { titel: 'Angebot Nord schreiben', start: '2026-09-30T09:00', ende: '2026-09-30T10:30', art: 'fokus', sichtbarkeit: 'privat', farbe: 'tomato', erinnerungenMin: [10, 60], bezug: { aufgabeId: 't-1', mandatId: 'm-1' } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    const obj = Object.values(server).find(o => o.ics.includes(d.uid))!;
    expect(obj.ics).toContain('X-MAKE-ART:fokus'); expect(obj.ics).toContain('CLASS:PRIVATE'); expect(obj.ics).toContain('COLOR:tomato');
    expect(obj.ics).not.toMatch(/t-1|m-1/);
    const b = (speicher.get('kalender-bezug') as { bezuege: Record<string, unknown> }).bezuege[d.uid];
    expect(b).toMatchObject({ aufgabeId: 't-1', mandatId: 'm-1', von: 'kevin', art: 'fokus', privat: true, tag: '2026-09-30' });
    expect(protokoll).toEqual([{ bestand: 'kalender', aenderungen: [{ liste: 'termine', op: 'neu', id: d.uid, felder: ['art', 'mandatId', 'aufgabeId'] }] }]);
    expect(JSON.stringify(protokoll)).not.toContain('Angebot');

    // Kevin sieht alles, Malin nur „Belegt“ — ohne Bezug, ohne Farbe.
    const kevin = (await lesen('kevin')).termine.find((t: { uid: string }) => t.uid === d.uid);
    expect(kevin).toMatchObject({ titel: 'Angebot Nord schreiben', art: 'fokus', sichtbarkeit: 'privat', bezug: { aufgabeId: 't-1', mandatId: 'm-1' }, von: 'kevin', erinnerungen: [10, 60], beschaeftigt: true });
    const malin = (await lesen('malin')).termine.find((t: { uid: string }) => t.uid === d.uid);
    expect(malin).toMatchObject({ titel: 'Belegt', maskiert: true, bearbeitbar: false, start: '2026-09-30T09:00:00' });
    expect(malin.bezug).toBeUndefined(); expect(malin.farbeEigen).toBeUndefined();
  });

  it('Stand veraltet → 409 mit dem aktuellen Termin; mit aktuellem Stand gespeichert', async () => {
    const { uid } = await (await POST(anfrage('POST', { titel: 'Steuerberater', start: '2026-09-30T14:00', ende: '2026-09-30T15:00' }))).json();
    const t = (await lesen('kevin')).termine.find((x: { uid: string }) => x.uid === uid);
    // Am iPhone geändert (und schon abgeglichen): neuer ETag.
    const name = Object.keys(server).find(n => server[n].ics.includes(uid))!;
    server[name] = { ics: server[name].ics.replace('SUMMARY:Steuerberater', 'SUMMARY:Steuerberater (verschoben)'), etag: 'iphone' }; ctag++;
    const { abgleichen } = await import('../lib/kalender/icloud');
    await abgleichen({ erzwingen: true });
    const r = await PATCH(anfrage('PATCH', { uid, stand: t.stand, titel: 'Steuerberater Müller' }));
    expect(r.status).toBe(409);
    const k = await r.json();
    expect(k).toMatchObject({ ok: false, konflikt: true, aktuell: { uid, titel: 'Steuerberater (verschoben)' } });
    expect(server[name].ics).toContain('Steuerberater (verschoben)');
    // „Meine Fassung übernehmen“: mit dem Stand aus der 409-Antwort erneut.
    const ok = await PATCH(anfrage('PATCH', { uid, stand: k.aktuell.stand, titel: 'Steuerberater Müller', farbe: 'gold', beschaeftigt: false }));
    expect(ok.status).toBe(200);
    expect(server[name].ics).toContain('SUMMARY:Steuerberater Müller'); expect(server[name].ics).toContain('COLOR:gold'); expect(server[name].ics).toContain('TRANSP:TRANSPARENT');
  });

  it('Bezug an einer Serie: nur Neben-Bestand, kein Schreiben nach iCloud; Termin-Felder an Serien bleiben gesperrt', async () => {
    await lesen('kevin');
    const vorher = puts;
    const r = await PATCH(anfrage('PATCH', { uid: 'serie', bezug: { aufgabeId: 't-9' } }));
    expect(r.status).toBe(200);
    expect(puts).toBe(vorher);
    expect((speicher.get('kalender-bezug') as { bezuege: Record<string, unknown> }).bezuege.serie).toMatchObject({ aufgabeId: 't-9' });
    expect((await PATCH(anfrage('PATCH', { uid: 'serie', farbe: 'gold' }))).status).toBe(400);
    expect((await PATCH(anfrage('PATCH', { uid: 'gibt-es-nicht', bezug: { aufgabeId: 't-9' } }))).status).toBe(404);
  });

  it('Löschen räumt den Bezug ab und protokolliert; fremder Bau → 409 neuLaden, nichts geschrieben', async () => {
    const { uid } = await (await POST(anfrage('POST', { titel: 'Weg', start: '2026-10-01', ende: '2026-10-02', ganztags: true, art: 'abwesend' }))).json();
    expect((speicher.get('kalender-bezug') as { bezuege: Record<string, unknown> }).bezuege[uid]).toBeTruthy();
    const d = await DELETE(anfrage('DELETE', undefined, 'kevin', {}, `?uid=${encodeURIComponent(uid)}`));
    expect(d.status).toBe(200);
    expect((speicher.get('kalender-bezug') as { bezuege: Record<string, unknown> }).bezuege[uid]).toBeUndefined();
    expect(protokoll.at(-1)).toEqual({ bestand: 'kalender', aenderungen: [{ liste: 'termine', op: 'geloescht', id: uid }] });
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const alt = await POST(anfrage('POST', { titel: 'Alt', start: '2026-10-01T09:00', ende: '2026-10-01T10:00' }, 'kevin', { 'x-make-bau': 'bau-alt' }));
    expect(alt.status).toBe(409);
    expect(await alt.json()).toMatchObject({ neuLaden: true });
    expect((await POST(anfrage('POST', { titel: 'X', start: '2026-10-01T09:00', ende: '2026-10-01T10:00' }, 'fremd'))).status).toBe(403);
  });
});
