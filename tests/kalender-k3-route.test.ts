// Kalender K3 (30.09.): Gäste und CRM an der Termin-Route gegen einen nachgebauten CalDAV-Server. Kernregel (Kevin
// „Echte Einladung nach Klick“, KALENDER_FEHLER_PRUEFLISTE #57/#K2/#59/#60): OHNE Bestätigung kein PUT mit ATTENDEE
// (409 mit den Adressen), der Dienstweg darf nie einladen, ORGANIZER = Adresse des iCloud-Kontos, Protokoll ohne
// Adressen. CRM: Termin → genau eine Meeting-Aktivität mit `terminUid` (ohne `wann`), gelöst/gelöscht in der Zukunft →
// weg. Als Gast nur antworten (nach Bestätigung). Nie echtes iCloud, Gäste nur @example.invalid, erfundene Daten.
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
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));
const protokoll: { bestand: string; aenderungen: { liste?: string; op: string; id: string; felder?: string[] }[] }[] = [];
vi.mock('@/lib/store/aenderungsprotokoll', async () => ({
  ...(await vi.importActual<object>('@/lib/store/aenderungsprotokoll')),
  protokolliere: async (bestand: string, aenderungen: { liste?: string; op: string; id: string; felder?: string[] }[]) => { protokoll.push({ bestand, aenderungen }); },
  werAus: () => ({ art: 'person', person: 'kevin' }),
}));

import { POST, PATCH, DELETE } from '../app/api/kalender/termin/route';
import { GET as bezugGET } from '../app/api/kalender/bezug/route';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KEVIN = `${HOME}home/`;
let server: Record<string, { ics: string; etag: string }>;
let ctag = 1;
const puts: string[] = [];
const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function fakeFetch(url: string, init: RequestInit): Response {
  const kopf = (init.headers ?? {}) as Record<string, string>;
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
  // Das Konto kennt seine Adressen (calendar-user-address-set) — daraus kommt der ORGANIZER (#60).
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set><c:calendar-user-address-set><d:href>mailto:kevin.konto@example.invalid</d:href><d:href>/123/principal/</d:href></c:calendar-user-address-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') return ms(`<d:response><d:href>/123/calendars/home/</d:href><d:propstat><d:prop><d:displayname>Privat Kevin</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${ctag}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === KEVIN && init.method === 'REPORT') return ms(Object.entries(server).map(([n, o]) => `<d:response><d:href>/123/calendars/home/${n}</d:href><d:propstat><d:prop><d:getetag>"${o.etag}"</d:getetag><c:calendar-data>${esc(o.ics)}</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
  if (url.startsWith(KEVIN)) {
    // Die Uhr läuft (der Stand trägt die Zeit des Abgleichs — mit angehaltener Uhr sähe der Termin-Zwischenspeicher nichts Neues).
    vi.setSystemTime(new Date(Date.now() + 1000));
    const name = url.slice(KEVIN.length), da = server[name];
    if (init.method === 'PUT') {
      puts.push(String(init.body));
      if (kopf['If-Match'] && (!da || `"${da.etag}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
      server[name] = { ics: String(init.body), etag: `e${puts.length}x` }; ctag++;
      return new Response(null, { status: da ? 204 : 201 });
    }
    if (init.method === 'DELETE') { delete server[name]; ctag++; return new Response(null, { status: 204 }); }
  }
  return new Response('nicht gefunden', { status: 404 });
}

const anfrage = (methode: string, body?: unknown, extra: Record<string, string> = {}, suche = '') =>
  new Request(`http://localhost/api/kalender/termin${suche}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': 'kevin', ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
const kontakte = () => (speicher.get('kontakte') as { kontakte: { id: string; letzterKontakt?: string; aktivitaeten: { art: string; terminUid?: string; wann?: string; text?: string }[]; geloeschteAktivitaeten?: string[] }[] }).kontakte;
const k = (id: string) => kontakte().find(x => x.id === id)!;
// R-K1 #46: Bezug und Meeting-Verweis tragen den Kalender (`home|uid`).
const S = (uid: string) => `home|${uid}`;
const bezug = (uid: string) => (speicher.get('kalender-bezug') as { bezuege: Record<string, Record<string, unknown>> }).bezuege[S(uid)];
const MORGEN = '2026-10-02';
const fremdeEinladung = (partstat = 'NEEDS-ACTION') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:fremd\r\nDTSTAMP:20260901T100000Z\r\nDTSTART:20261002T080000Z\r\nDTEND:20261002T090000Z\r\nSUMMARY:Workshop Nord\r\nORGANIZER;CN=Nora Nord:mailto:nora@example.invalid\r\nATTENDEE;CN=Nora Nord;PARTSTAT=ACCEPTED:mailto:nora@example.invalid\r\nATTENDEE;PARTSTAT=${partstat};RSVP=TRUE:mailto:kevin.konto@example.invalid\r\nEND:VEVENT\r\nEND:VCALENDAR`;

beforeEach(() => {
  speicher.clear(); protokoll.length = 0; puts.length = 0; ctag = 1;
  server = { 'fremd.ics': { ics: fremdeEinladung(), etag: 'f1' } };
  speicher.set('kontakte', { kontakte: [
    { id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', stufe: 'neu', aktivitaeten: [] },
    { id: 'c-bert1', vorname: 'Bert', nachname: 'Muster', email: 'bert@example.invalid', stufe: 'neu', aktivitaeten: [], werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } },
    { id: 'c-carl1', vorname: 'Carl', nachname: 'Probe', email: 'carl@example.invalid', stufe: 'neu', aktivitaeten: [], eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } },
  ] });
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-30T08:00:00.000Z'));
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('MAKE_OS_KEY', 'dienst-test-schluessel');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const neuMitGast = (x: Record<string, unknown> = {}) => ({ titel: 'Kennenlernen', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, bezug: { kontaktId: 'c-anna1' }, gaeste: [{ email: 'anna@example.invalid', kontaktId: 'c-anna1' }, { email: 'gast@example.invalid', name: 'Gast Frei' }], ...x });

describe('Termin-Route (K3) — Einladung nur nach Klick', () => {
  it('ohne Bestätigung: 409 mit den Adressen, KEIN PUT, nichts gespeichert', async () => {
    const r = await POST(anfrage('POST', neuMitGast()));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, einladung: 'einladung', anzahl: 2, adressen: ['anna@example.invalid', 'gast@example.invalid'] });
    expect(puts).toEqual([]);
    expect(Object.keys(server)).toEqual(['fremd.ics']);
    expect(speicher.get('kalender-bezug')).toBeUndefined();
    // Ein Termin OHNE Gäste schreibt nie ein ATTENDEE.
    const ohne = await POST(anfrage('POST', { titel: 'Allein', start: `${MORGEN}T12:00`, ende: `${MORGEN}T13:00` }));
    expect(ohne.status).toBe(200);
    expect(puts).toHaveLength(1);
    expect(puts[0]).not.toMatch(/ATTENDEE|ORGANIZER/);
  });

  it('mit Bestätigung: ORGANIZER = Adresse des Kontos, ATTENDEE mit SCHEDULE-AGENT=SERVER; Protokoll ohne Adressen; CRM-Meeting ohne `wann`', async () => {
    const r = await POST(anfrage('POST', neuMitGast({ einladungBestaetigt: true })));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d).toMatchObject({ ok: true, gaeste: 2, crm: { neu: 1 } });
    const ics = puts.at(-1)!.replace(/\r?\n[ \t]/g, '');
    expect(ics).toMatch(/ORGANIZER;SCHEDULE-AGENT=SERVER:mailto:kevin\.konto@example\.invalid/);
    expect(ics).toMatch(/ATTENDEE;[^\r\n]*SCHEDULE-AGENT=SERVER[^\r\n]*:mailto:gast@example\.invalid/);
    expect(ics).toMatch(/ATTENDEE;[^\r\n]*PARTSTAT=NEEDS-ACTION[^\r\n]*:mailto:anna@example\.invalid/);
    expect(ics).not.toMatch(/c-anna1/);
    // Bezug: Kontakt + Gast-Kennungen, nie Adressen.
    expect(bezug(d.uid)).toMatchObject({ kontaktId: 'c-anna1', gastKontakte: ['c-anna1'], von: 'kevin', tag: MORGEN });
    expect(JSON.stringify(speicher.get('kalender-bezug'))).not.toContain('@');
    // Protokoll: Liste „einladungen“ mit Anzahl — nie Adressen.
    expect(protokoll.flatMap(p => p.aenderungen).find(a => a.liste === 'einladungen')).toEqual({ liste: 'einladungen', op: 'neu', id: S(d.uid), felder: ['gaeste:2'] });
    expect(JSON.stringify(protokoll)).not.toContain('@');
    // CRM: genau eine Meeting-Aktivität mit terminUid, ohne `wann`; geplant → noch kein letzter Kontakt.
    const m = k('c-anna1').aktivitaeten.filter(a => a.art === 'termin');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ terminUid: S(d.uid), text: 'Meeting: Kennenlernen' });
    expect(m[0].wann).toBeUndefined();
    expect(k('c-anna1').letzterKontakt).toBeUndefined();
    // Die Akte liest die Zeit über den Bezug.
    const akte = await (await bezugGET(new Request('http://localhost/api/kalender/bezug?kontakte=c-anna1', { headers: { 'x-make-user': 'kevin' } }))).json();
    expect(akte.kommend.map((t: { uid: string }) => t.uid)).toEqual([d.uid]);
    expect(akte.zeiten[d.uid]).toMatchObject({ start: `${MORGEN}T10:00:00`, ende: `${MORGEN}T11:00:00` });
    expect(akte.kommend[0].antworten).toEqual([{ status: 'offen', name: 'Anna Beispiel' }, { status: 'offen', name: 'Gast Frei' }]);
  });

  it('Dienstweg (ZOE, Skripte) darf nie einladen, bestätigen oder antworten → 403, kein PUT', async () => {
    const dienst = { 'x-make-key': 'dienst-test-schluessel' };
    expect((await POST(anfrage('POST', neuMitGast({ einladungBestaetigt: true }), dienst))).status).toBe(403);
    expect((await PATCH(anfrage('PATCH', { uid: 'fremd', antwort: 'zugesagt', einladungBestaetigt: true }, dienst))).status).toBe(403);
    expect((await DELETE(anfrage('DELETE', undefined, dienst, '?uid=fremd&einladungBestaetigt=1'))).status).toBe(403);
    expect(puts).toEqual([]);
  });

  it('Art. 18: eingeschränkte Person nie einladbar — auch nicht per frei eingegebener Adresse; Werbesperre wird nur gezählt', async () => {
    const r = await POST(anfrage('POST', { titel: 'X', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, gaeste: [{ email: 'CARL@example.invalid' }], einladungBestaetigt: true }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ eingeschraenkt: true });
    expect(puts).toEqual([]);
    const w = await (await POST(anfrage('POST', { titel: 'Y', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, gaeste: [{ email: 'bert@example.invalid' }], einladungBestaetigt: true }))).json();
    expect(w).toMatchObject({ ok: true, werbesperre: 1 });
    // Frei eingegebene Adresse einer (einzigen) Person → deren Kennung als Gast-Kontakt.
    expect(bezug(w.uid)).toMatchObject({ gastKontakte: ['c-bert1'] });
    expect(k('c-bert1').aktivitaeten.filter(a => a.terminUid === S(w.uid))).toHaveLength(1);
  });

  it('Termin mit Gästen ändern/löschen nur nach Bestätigung; SEQUENCE nur bei Zeit/Ort; Löschen einer künftigen Termins nimmt das Meeting (mit Löschmarke)', async () => {
    const { uid } = await (await POST(anfrage('POST', neuMitGast({ einladungBestaetigt: true })))).json();
    const vorher = puts.length;
    const r = await PATCH(anfrage('PATCH', { uid, start: `${MORGEN}T14:00`, ende: `${MORGEN}T15:00` }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ einladung: 'aenderung', anzahl: 2 });
    expect(puts.length).toBe(vorher);
    expect((await PATCH(anfrage('PATCH', { uid, start: `${MORGEN}T14:00`, ende: `${MORGEN}T15:00`, einladungBestaetigt: true }))).status).toBe(200);
    expect(puts.at(-1)).toContain('SEQUENCE:1');
    expect((await PATCH(anfrage('PATCH', { uid, farbe: 'gold', einladungBestaetigt: true }))).status).toBe(200);
    expect(puts.at(-1)).toContain('SEQUENCE:1'); // Farbe ist nicht wesentlich (#61)
    // Verschoben → die Akte zeigt die neue Zeit (eine Quelle).
    const akte = await (await bezugGET(new Request('http://localhost/api/kalender/bezug?kontakte=c-anna1', { headers: { 'x-make-user': 'kevin' } }))).json();
    expect(akte.zeiten[uid]?.start).toBe(`${MORGEN}T14:00:00`);
    // Löschen: ohne Bestätigung 409 (Absage an 2), mit → weg, Meeting weg, Löschmarke gesetzt.
    const d1 = await DELETE(anfrage('DELETE', undefined, {}, `?uid=${encodeURIComponent(uid)}`));
    expect(d1.status).toBe(409);
    expect(await d1.json()).toMatchObject({ einladung: 'absage', anzahl: 2 });
    expect((await DELETE(anfrage('DELETE', undefined, {}, `?uid=${encodeURIComponent(uid)}&einladungBestaetigt=1`))).status).toBe(200);
    expect(k('c-anna1').aktivitaeten.filter(a => a.terminUid === S(uid))).toEqual([]);
    expect(k('c-anna1').geloeschteAktivitaeten?.length).toBe(1);
    expect(protokoll.flatMap(p => p.aenderungen).filter(a => a.liste === 'einladungen').map(a => a.op)).toEqual(['neu', 'geaendert', 'geaendert', 'geloescht']);
  });

  it('als Gast: ändern verboten, antworten nur nach Bestätigung (PARTSTAT), Bezug geht trotzdem', async () => {
    expect((await PATCH(anfrage('PATCH', { uid: 'fremd', titel: 'Anders' }))).status).toBe(400);
    const a = await PATCH(anfrage('PATCH', { uid: 'fremd', antwort: 'zugesagt' }));
    expect(a.status).toBe(409);
    expect(await a.json()).toMatchObject({ einladung: 'antwort', adressen: ['nora@example.invalid'] });
    expect(puts).toEqual([]);
    expect((await PATCH(anfrage('PATCH', { uid: 'fremd', antwort: 'zugesagt', einladungBestaetigt: true }))).status).toBe(200);
    expect(puts.at(-1)!.replace(/\r?\n[ \t]/g, '')).toMatch(/ATTENDEE;PARTSTAT=ACCEPTED:mailto:kevin\.konto@example\.invalid/);
    expect(protokoll.at(-1)).toEqual({ bestand: 'kalender', aenderungen: [{ liste: 'antworten', op: 'geaendert', id: S('fremd'), felder: ['zugesagt'] }] });
    // Verknüpfen geht auch an einer fremden Einladung (nur Neben-Bestand) → Meeting am Kontakt.
    const n = puts.length;
    expect((await PATCH(anfrage('PATCH', { uid: 'fremd', bezug: { kontaktId: 'c-anna1' } }))).status).toBe(200);
    expect(puts.length).toBe(n);
    expect(k('c-anna1').aktivitaeten.filter(x => x.terminUid === S('fremd'))).toHaveLength(1);
    // Lösen, solange der Termin in der Zukunft liegt → das Meeting fällt weg.
    expect((await PATCH(anfrage('PATCH', { uid: 'fremd', bezug: { kontaktId: null } }))).status).toBe(200);
    expect(k('c-anna1').aktivitaeten.filter(x => x.terminUid === S('fremd'))).toEqual([]);
  });

  it('vergangener Termin mit Kontakt zählt sofort als Kontakt (letzter Kontakt = sein Tag), idempotent', async () => {
    const d = await (await POST(anfrage('POST', { titel: 'Rückblick', start: '2026-09-29T10:00', ende: '2026-09-29T11:00', bezug: { kontaktId: 'c-anna1' } }))).json();
    expect(k('c-anna1').letzterKontakt).toBe('2026-09-29');
    expect((await PATCH(anfrage('PATCH', { uid: d.uid, bezug: { kontaktId: 'c-anna1' } }))).status).toBe(200);
    expect(k('c-anna1').aktivitaeten.filter(a => a.terminUid === S(d.uid))).toHaveLength(1);
  });
});
