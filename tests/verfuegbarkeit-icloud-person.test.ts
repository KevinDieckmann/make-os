// ─── Freie Zeit: die EIGENE iCloud-Verbindung einer Person zählt auch ohne Haushalts-iCloud/Google (18.10.) ──────────────────────────
// `verfuegbarkeitFuer` (lib/kalender/verfuegbarkeit.ts) las ohne Haushalts-iCloud und ohne Google nur den Mac-Stand (`calendar-cache`) —
// Termine aus der eigenen Verbindung einer Person (`icloud-verbindung--<person>`, Spiegel `kalender-icloud--<person>`) zählten dann nicht.
// Jetzt zählen sie bei IHRER Verfügbarkeit mit: nur „belegt“ (nie ein Titel), nie bei anderen Personen, nie doppelt (was der Mac-Stand trägt,
// zählt nur dort; Kopien der Überlagerung im Zwischenspeicher zählen nicht als Mac-Stand). Gegenprobe ohne eigene Verbindung: bit-gleich.
// Nachgebautes CalDAV-Konto (IcloudFake, @example.invalid), echter verschlüsselter Datenspeicher im Temp-Ordner, erfundene Personen.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { IcloudFake, einfachIcs } from './fixtures/icloud-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-verfuegbarkeit-person-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-verfuegbarkeit-person';
process.env.MAKE_OS_OHNE_APPLE = '1';
for (const n of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'ICLOUD_PERSON', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[n];
vi.setConfig({ testTimeout: 30_000 });

let P: typeof import('@/lib/kalender/icloud-person'), I: typeof import('@/lib/kalender/icloud'), H: typeof import('@/lib/kalender/icloud-haupt');
let V: typeof import('@/lib/kalender/verfuegbarkeit'), db: typeof import('@/lib/store/local-db');
let jonas: IcloudFake;
let netz: ReturnType<typeof vi.fn>;

const TAG = '2026-10-07'; // Mittwoch, kein Feiertag in NRW
const BIS = '2026-10-08';
const JONAS_PW = 'mmmm-nnnn-oooo-pppp';
const GEHEIM = /Zahnarzt|Kur am See|Lesestunde|Abgesagtes/;

/** Ein VEVENT mit freiem Zusatz (TRANSP, STATUS, X-MAKE-ART) — `einfachIcs` setzt TRANSP fest auf OPAQUE. */
const ics = (uid: string, titel: string, von: string, bis: string, zusatz: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//DE\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:${TAG.replace(/-/g, '')}T${von}\r\nDTEND;TZID=Europe/Berlin:${TAG.replace(/-/g, '')}T${bis}\r\nSUMMARY:${titel}\r\n${zusatz}END:VEVENT\r\nEND:VCALENDAR`;

/** Der Mac-Stand: ein Team-Termin (zählt für alle) und das Familienessen, das auch in Jonas' geteiltem Kalender steht. */
const MAC = [
  { id: 'MAC-TEAM', title: 'Wochenstart Team', startDate: `${TAG}T09:00:00`, endDate: `${TAG}T09:45:00`, allDay: false, calendarName: 'Arbeit' },
  { id: 'SHARED-1', title: 'Familienessen', startDate: `${TAG}T18:00:00`, endDate: `${TAG}T19:00:00`, allDay: false, calendarName: 'Arbeit' },
  { title: 'Ohne Kennung', startDate: `${TAG}T20:00:00`, endDate: `${TAG}T20:30:00`, allDay: false, calendarName: 'Arbeit' },
];
const macStand = () => db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: MAC });
const zeiten = (v: Awaited<ReturnType<typeof V.verfuegbarkeitFuer>>) => v.tage[0].beschaeftigt.map(b => `${b.start.slice(11, 16)}–${b.ende.slice(11, 16)}`);
const verbindeJonas = () => P.icloudVerbinden('jonas', 'jonas@example.invalid', JONAS_PW);

beforeAll(async () => {
  P = await import('@/lib/kalender/icloud-person'); I = await import('@/lib/kalender/icloud'); H = await import('@/lib/kalender/icloud-haupt');
  V = await import('@/lib/kalender/verfuegbarkeit'); db = await import('@/lib/store/local-db');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  (await import('@/lib/store/memo')).memoLeeren();
  H.hauptVergessen();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'));
  jonas = new IcloudFake({ nr: '555', adresse: 'jonas@example.invalid', zugang: { id: 'jonas@example.invalid', passwort: JONAS_PW } });
  jonas.add('home', 'Kalender').add('geteilt', 'Familie');
  jonas.setze('home', 'j1.ics', einfachIcs('J-PRIVAT', 'Zahnarzt mit Befund', TAG, '100000', '110000'));
  jonas.setze('home', 'j2.ics', ics('J-FREI', 'Lesestunde', '130000', '140000', 'TRANSP:TRANSPARENT\r\n'));
  jonas.setze('home', 'j3.ics', ics('J-ABGESAGT', 'Abgesagtes Treffen', '140000', '150000', 'TRANSP:OPAQUE\r\nSTATUS:CANCELLED\r\n'));
  jonas.setze('home', 'j4.ics', ics('J-AB', 'Kur am See', '160000', '170000', 'TRANSP:OPAQUE\r\nX-MAKE-ART:abwesend\r\n'));
  jonas.setze('geteilt', 's1.ics', einfachIcs('SHARED-1', 'Familienessen', TAG, '180000', '190000'));
  netz = vi.fn(async (u: string | URL, i: RequestInit = {}) => {
    const url = String(u);
    if (url === 'https://caldav.icloud.com/' || url.includes(`/${jonas.nr}/`)) return (await jonas.handle(url, i))!;
    return new Response('nicht gefunden', { status: 404 });
  });
  vi.stubGlobal('fetch', netz);
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'jonas', email: 'jonas@example.invalid', name: 'Jonas Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-02', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k3', speicher: 'ben', email: 'ben@example.invalid', name: 'Ben Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-03', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await db.saveJson('kalender-bezug', { bezuege: {} });
  await db.saveJson('kalender-einstellungen', { belegt: { Arbeit: true } });
});

describe('Ohne Haushalts-iCloud und ohne Google: die eigene Verbindung zählt bei ihrer Person', () => {
  it('Voraussetzung: weder Haushalts-iCloud noch Google — Jonas verbindet SEIN Konto (keine Haupt-Person)', async () => {
    expect(I.verbunden()).toBe(false);
    const r = await verbindeJonas();
    expect(r).toMatchObject({ haupt: false });
    expect(I.verbunden()).toBe(false);
  });

  it('Jonas: Mac-Stand + eigene Termine sind belegt (frei/abgesagt nicht), das Familienessen nur EINMAL, Abwesenheit ohne Titel', async () => {
    await verbindeJonas();
    await macStand(); // nach dem Verbinden: der Abgleich schreibt den Zwischenspeicher neu
    const v = await V.verfuegbarkeitFuer('jonas', TAG, BIS);
    expect(zeiten(v)).toEqual(['09:00–09:45', '10:00–11:00', '16:00–17:00', '18:00–19:00', '20:00–20:30']);
    expect(v.tage[0].abwesend).toEqual([{ start: `${TAG}T16:00:00`, ende: `${TAG}T17:00:00`, art: 'abwesend', ganztags: false }]);
    expect(v.tage[0].abwesend[0]).not.toHaveProperty('titel');
    expect(JSON.stringify(v)).not.toMatch(GEHEIM);
    expect(V.istFrei(v, `${TAG}T10:15:00`, `${TAG}T10:45:00`)).toBe(false);
  });

  it('Andere Personen bekommen nichts aus Jonas’ Verbindung — nur den Mac-Stand', async () => {
    await verbindeJonas();
    await macStand();
    for (const p of ['ben', 'lena']) {
      const v = await V.verfuegbarkeitFuer(p, TAG, BIS);
      expect(zeiten(v), p).toEqual(['09:00–09:45', '18:00–19:00', '20:00–20:30']);
      expect(v.tage[0].abwesend, p).toEqual([]);
      expect(JSON.stringify(v), p).not.toMatch(GEHEIM);
    }
  });

  it('Freie-Zeit-Suche: kein Vorschlag für Jonas liegt auf seinem eigenen Termin oder seiner Abwesenheit', async () => {
    await verbindeJonas();
    await macStand();
    const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
    const r = await freieZeitFuer({ personen: ['jonas'], dauerMin: 60, von: TAG, tage: 1, vorlaufMin: 0, rasterMin: 30, grenze: 20, jetzt: new Date('2026-10-06T08:00:00.000Z') });
    expect(r.vorschlaege.length).toBeGreaterThan(0);
    for (const s of r.vorschlaege) {
      for (const [a, b] of [['10:00', '11:00'], ['16:00', '17:00']]) expect(s.ende <= `${TAG}T${a}:00` || s.start >= `${TAG}T${b}:00`, `${s.start}–${s.ende}`).toBe(true);
    }
    expect(JSON.stringify(r)).not.toMatch(GEHEIM);
  });

  it('Nie doppelt: trägt der Zwischenspeicher nur Kopien der Überlagerung, zählt jeder Termin genau einmal (aus der Verbindung)', async () => {
    await verbindeJonas(); // der Abgleich hat den Zwischenspeicher aus der Überlagerung geschrieben (`persoenlich` an jedem Eintrag)
    const cache = await db.loadJson<{ events: { persoenlich?: string }[] }>('calendar-cache');
    expect(cache?.events.length).toBeGreaterThan(0);
    expect(cache?.events.every(e => e.persoenlich === 'jonas')).toBe(true);
    expect(zeiten(await V.verfuegbarkeitFuer('jonas', TAG, BIS))).toEqual(['10:00–11:00', '16:00–17:00', '18:00–19:00']);
    expect(zeiten(await V.verfuegbarkeitFuer('ben', TAG, BIS))).toEqual([]);
  });

  it('Eigene Kalender auf „zählt nicht als belegt“ gestellt → zählen nicht (die anderen Kalender der Person schon)', async () => {
    await verbindeJonas();
    await macStand();
    const ueber = await P.persoenlicheUeberlagerung(await I.ladeStandIcloud());
    const name = ueber.kalender.find(k => k.person === 'jonas' && /^Kalender · /.test(k.name))!.name;
    await db.saveJson('kalender-einstellungen', { belegt: { Arbeit: true, [name]: false } });
    expect(zeiten(await V.verfuegbarkeitFuer('jonas', TAG, BIS))).toEqual(['09:00–09:45', '18:00–19:00', '20:00–20:30']);
  });

  it('Regel rein (`werFuerTermin`): eigene Verbindung → ihre Person (auch ohne passendes Fach), Schalter aus → niemand; sonst wie bisher', async () => {
    const { werFuerTermin, werFuerBelegung } = await import('@/lib/kalender/belegt');
    const e = { kalender: { kevin: 'Fach Eins', malin: 'Fach Zwei', beide: 'Gemeinsam' }, belegt: { Arbeit: true, 'Aus · Jonas': false } };
    expect(werFuerTermin(e, { kalender: 'Kalender · Jonas', persoenlich: 'jonas' })).toBe('jonas');
    expect(werFuerTermin(e, { kalender: 'Aus · Jonas', persoenlich: 'jonas' })).toBe('niemand');
    for (const k of ['Arbeit', 'Fach Eins', 'Gemeinsam', 'Unbekannt']) expect(werFuerTermin(e, { kalender: k })).toBe(werFuerBelegung(e, k));
  });
});

describe('Gegenprobe: ohne eigene Verbindung ist alles bit-gleich wie vorher (nur der Mac-Stand, kein Netz)', () => {
  it('für jede Person dasselbe Ergebnis wie die alte Rechnung (Mac-Stand + `werFuerBelegung`)', async () => {
    await macStand();
    const { macTermine } = await import('@/lib/kalender/termine-lesen');
    const { mitBezug } = await import('@/lib/kalender/bezug');
    const { ladeBezuege } = await import('@/lib/kalender/bezug-server');
    const { ladeEinstellungen, werFuerBelegung } = await import('@/lib/kalender/einstellungen');
    const { verfuegbarkeitAus } = await import('@/lib/kalender/verfuegbarkeit-regeln');
    const [einst, bezuege] = await Promise.all([ladeEinstellungen(), ladeBezuege()]);
    for (const p of ['jonas', 'ben', 'lena']) {
      const alt = verfuegbarkeitAus({ person: p, von: TAG, bis: BIS, termine: macTermine(MAC, TAG, BIS).map(t => ({ ...mitBezug(t, bezuege), wer: werFuerBelegung(einst, t.kalender) })), bloecke: [] });
      expect(await V.verfuegbarkeitFuer(p, TAG, BIS), p).toEqual(alt);
    }
    expect(netz).not.toHaveBeenCalled();
  });
});
