// Zuordnung `kalenderZiel(person, art)` und alle Stellen, die Termine schreiben: Privat bleibt iCloud, Business → Google
// Kalender der Person (wenn verbunden), sonst der bisherige Weg (Rückfall). Dazu: Event-Spiegel, Netzwerken-Termin,
// Buchungs-Freigabe (Zielkalender), Haushalts-/Personengrenzen, Takt-Fälligkeit, HOI-Befund, Einstellungen (nie gespeichert).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';
import { IcloudFake } from './fixtures/icloud-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-z-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-ziel';
process.env.MAKE_OS_KEY = 'dienst-test-google-ziel';

let Z: typeof import('@/lib/kalender/google/ziel'), TS: typeof import('@/lib/kalender/termin-server'), V: typeof import('@/lib/google/verbindung');
let A: typeof import('@/lib/kalender/google/abgleich'), S: typeof import('@/lib/kalender/google/stand'), db: typeof import('@/lib/store/local-db');
let E: typeof import('@/lib/kalender/einstellungen'), T: typeof import('@/lib/kalender/google/takt'), H: typeof import('@/lib/hoi/lage');
let g: GoogleFake, ic: IcloudFake;

beforeAll(async () => {
  Z = await import('@/lib/kalender/google/ziel'); TS = await import('@/lib/kalender/termin-server'); V = await import('@/lib/google/verbindung');
  A = await import('@/lib/kalender/google/abgleich'); S = await import('@/lib/kalender/google/stand'); db = await import('@/lib/store/local-db');
  E = await import('@/lib/kalender/einstellungen'); T = await import('@/lib/kalender/google/takt'); H = await import('@/lib/hoi/lage');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const WER = { art: 'person' as const, person: 'kevin' };
async function verbinden(person: string, email = 'kevin@makeinnovation.test') {
  g.konto = { ...g.konto, email }; g.kalenderId = email;
  g.kalenderListe = [{ id: email, summary: email, primary: true, accessRole: 'owner', backgroundColor: '#9fe1e7', timeZone: 'Europe/Berlin' }];
  const { url } = await V.verbindungStarten(person, ['kalender']);
  await V.verbindungAbschliessen(person, 'code-ok', new URL(url).searchParams.get('state')!);
  await A.googleAbgleichen(person);
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake(); ic = new IcloudFake().add('privat-kevin', 'Privat Kevin').add('privat-malin', 'Privat Malin').add('gemeinsam', 'Gemeinsam');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => (await ic.handle(String(u), i)) ?? g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test');
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid'); vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
});

describe('Zuordnung (rein)', () => {
  const icloud = { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' };
  it('Privat und Gemeinsam bleiben iCloud — auch mit Google; Business → Google der Person, sonst iCloud (Rückfall)', () => {
    const google = { kevin: 'MAKE Kevin (Google)' };
    expect(Z.zielRein({ person: 'kevin', art: 'privat', icloud, google })).toEqual({ quelle: 'icloud', kalender: 'Privat Kevin' });
    expect(Z.zielRein({ person: 'kevin', art: 'gemeinsam', icloud, google })).toEqual({ quelle: 'icloud', kalender: 'Gemeinsam' });
    expect(Z.zielRein({ person: 'kevin', art: 'business', icloud, google })).toEqual({ quelle: 'google', kalender: 'MAKE Kevin (Google)', person: 'kevin' });
    expect(Z.zielRein({ person: 'malin', art: 'business', icloud, google })).toEqual({ quelle: 'icloud', kalender: 'Privat Malin' });
    expect(Z.zielRein({ person: 'kevin', art: 'business', icloud, google: {} })).toEqual({ quelle: 'icloud', kalender: 'Privat Kevin' });
    expect(Z.zielRein({ person: 'beide', art: 'business', icloud, google })).toEqual({ quelle: 'icloud', kalender: 'Gemeinsam' });
    expect(Z.zielRein({ person: 'dritte', art: 'business', icloud, google })).toEqual({ quelle: 'icloud', kalender: undefined });
  });
  it('mit Verbindung (async): nur SCHREIBBARE Google-Kalender sind Ziel; getrennt → wieder iCloud', async () => {
    await db.saveJson('kalender-einstellungen', { kalender: icloud });
    expect(await Z.kalenderZiel('kevin', 'business')).toMatchObject({ quelle: 'icloud', kalender: 'Privat Kevin' });
    await verbinden('kevin');
    expect(await Z.kalenderZiel('kevin', 'business')).toEqual({ quelle: 'google', kalender: 'MAKE Kevin (Google)', person: 'kevin' });
    expect(await Z.kalenderZiel('kevin', 'privat')).toMatchObject({ quelle: 'icloud' });
    expect(await Z.kalenderZiel('malin', 'business')).toMatchObject({ quelle: 'icloud', kalender: 'Privat Malin' });
    await S.aendereGoogleStand('kevin', c => ({ ...c, schreibbar: false }));
    expect(await Z.kalenderZiel('kevin', 'business')).toMatchObject({ quelle: 'icloud' });
  });
});

describe('Server-Schreiber (Event-Spiegel, Netzwerken, Blöcke …) über `terminAnlegenServer`', () => {
  const termin = { titel: 'Event: Messe', start: '2026-10-20T10:00:00', ende: '2026-10-20T13:00:00', wer: 'kevin' as const, art: 'termin' as const, beschaeftigt: true, von: 'kevin', bezug: { eventId: 'ev-1' } };
  it('bereich „business“ → Google Kalender der Person: kein Aufruf bei iCloud; Bezug unter google-kevin|uid; Protokoll; sofort lesbar', async () => {
    await verbinden('kevin');
    const r = await TS.terminAnlegenServer({ ...termin, bereich: 'business', uid: 'makeos-event-ev-1' }, WER);
    expect(r).toMatchObject({ uid: 'makeos-event-ev-1', schluessel: 'google-kevin|makeos-event-ev-1', kalender: 'MAKE Kevin (Google)' });
    expect(ic.aufrufe.filter(a => a.methode === 'PUT')).toHaveLength(0);
    expect(g.events.size).toBe(1);
    const bez = (await db.loadJson<{ bezuege: Record<string, { eventId?: string; von?: string }> }>('kalender-bezug'))!.bezuege['google-kevin|makeos-event-ev-1'];
    expect(bez).toMatchObject({ eventId: 'ev-1', von: 'kevin' });
  });
  it('ohne bereich (Standard privat) → iCloud wie bisher, auch wenn Google verbunden ist', async () => {
    await verbinden('kevin');
    const r = await TS.terminAnlegenServer({ ...termin, uid: 'makeos-t-privat-1' }, WER);
    expect(r.kalender).toBe('Privat Kevin');
    expect(ic.aufrufe.filter(a => a.methode === 'PUT')).toHaveLength(1);
    expect(g.events.size).toBe(0);
  });
  it('business ohne Google-Verbindung → iCloud-Kalender der Person (heutiger Stand, Rückfall)', async () => {
    const r = await TS.terminAnlegenServer({ ...termin, bereich: 'business', uid: 'makeos-t-fallback1' }, WER);
    expect(r.kalender).toBe('Privat Kevin');
    expect(g.events.size).toBe(0);
  });
  it('Termin für die ANDERE Person (Netzwerken: „Termin im Kalender des anderen“) → deren Google Kalender, wenn SIE verbunden ist — sonst iCloud', async () => {
    await verbinden('kevin');
    const mal = await TS.terminAnlegenServer({ ...termin, wer: 'malin', bereich: 'business', uid: 'makeos-t-fuer-malin1' }, WER);
    expect(mal.kalender).toBe('Privat Malin');
    await verbinden('malin', 'malin@makeinnovation.test');
    const mal2 = await TS.terminAnlegenServer({ ...termin, wer: 'malin', bereich: 'business', uid: 'makeos-t-fuer-malin2' }, WER);
    expect(mal2).toMatchObject({ kalender: 'MAKE Malin (Google)', schluessel: 'google-malin|makeos-t-fuer-malin2' });
    // Malins Termin liegt in Malins Spiegel, nie in Kevins.
    expect(Object.keys((await S.ladeGoogleStand('kevin'))!.events)).toEqual([]);
    expect(Object.keys((await S.ladeGoogleStand('malin'))!.events)).toHaveLength(1);
  });
  it('nur Google (kein iCloud-Zugang): Schreiber laufen; privat ohne iCloud → klare Meldung statt Absturz', async () => {
    vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
    await verbinden('kevin');
    expect((await TS.terminAnlegenServer({ ...termin, bereich: 'business', uid: 'makeos-t-nurgoogle1' }, WER)).kalender).toBe('MAKE Kevin (Google)');
    await expect(TS.terminAnlegenServer({ ...termin, uid: 'makeos-t-nurgoogle2' }, WER)).rejects.toMatchObject({ status: 409 });
    // Ändern und Löschen eines Google-Termins über den Server-Weg.
    await TS.terminAendernServer('makeos-t-nurgoogle1', { titel: 'Neu', start: '2026-10-21T10:00:00', ende: '2026-10-21T13:00:00' }, WER, { dealId: 'd-1' });
    const ev = [...g.events.values()][0];
    expect(ev).toMatchObject({ summary: 'Neu', start: { dateTime: '2026-10-21T10:00:00' } });
    await TS.terminLoeschenServer('makeos-t-nurgoogle1', WER);
    expect([...g.events.values()][0].status).toBe('cancelled');
  });
  it('ein bestehender iCloud-Spiegel wird weiter über seine UID nachgezogen (ändern findet ihn in iCloud, nicht in Google)', async () => {
    await verbinden('kevin');
    await TS.terminAnlegenServer({ ...termin, uid: 'makeos-event-alt0001' }, WER); // privat → iCloud
    await TS.terminAendernServer('makeos-event-alt0001', { titel: 'Verschoben' }, WER);
    expect(ic.aufrufe.filter(a => a.methode === 'PUT' && /alt0001/.test(a.url) && /Verschoben/.test(a.body ?? '')).length).toBe(1);
    expect(aufrufeAn(g, '/events', 'PATCH')).toHaveLength(0);
  });
});

describe('Einstellungen und Rückweg', () => {
  it('`google` (Kalendername → Person) wird zur Laufzeit dazugelegt und NIE gespeichert; Zuordnung/Space/belegt greifen darauf', async () => {
    await verbinden('kevin');
    await db.saveJson('kalender-einstellungen', E.einstellungenSauber({}));
    const e = await E.ladeEinstellungen();
    expect(e.google).toEqual({ 'MAKE Kevin (Google)': 'kevin' });
    expect(E.wemGehoert(e, 'MAKE Kevin (Google)')).toBe('kevin');
    expect(E.zaehltAlsBelegt(e, 'MAKE Kevin (Google)')).toBe(true);
    expect(E.spaceVonKalender(e, 'MAKE Kevin (Google)')).toBe('business');
    // Ein ausdrücklicher Space-Eintrag gewinnt weiter.
    expect(E.spaceVonKalender({ ...e, space: { 'MAKE Kevin (Google)': 'privat' } }, 'MAKE Kevin (Google)')).toBe('privat');
    const gespeichert = await db.loadJson('kalender-einstellungen');
    expect(JSON.stringify(gespeichert)).not.toContain('Google');
    expect(E.einstellungenSauber({ ...e, google: { x: 'y' } } as never)).not.toHaveProperty('google');
    const route = await import('../app/api/state/kalender-einstellungen/route');
    await route.PUT(new Request('http://localhost/api/state/kalender-einstellungen', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-make-user': 'kevin' }, body: JSON.stringify({ teil: { google: { böse: 'kevin' }, dauer: { termin: 30 } } }) }));
    expect(JSON.stringify(await db.loadJson('kalender-einstellungen'))).not.toMatch(/böse|MAKE Kevin/);
    expect((await db.loadJson<{ dauer: { termin: number } }>('kalender-einstellungen'))!.dauer.termin).toBe(30);
  });
  it('Rückweg auf den alten Stand: der iCloud-Bestand hat dieselbe Form; Google-Termine stehen nie darin; neue Bestände sind eigene Dateien', async () => {
    await verbinden('kevin');
    g.setze({ id: 'a', summary: 'A', start: { dateTime: '2026-10-05T10:00:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-05T11:00:00+02:00', timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const I = await import('@/lib/kalender/icloud');
    await I.abgleichen({ erzwingen: true });
    const roh = await db.loadJson<{ kalender: { id: string; quelle?: string; person?: string; ich?: string[] }[]; objekte: Record<string, unknown[]> }>('kalender-icloud');
    expect(roh!.kalender.map(k => k.id)).not.toContain('google:kalender/google-kevin');
    expect(roh!.kalender.every(k => !k.quelle && !k.person && !k.ich)).toBe(true);
    expect(Object.keys(roh!.objekte).some(k => k.startsWith('google'))).toBe(false);
    // Der calendar-cache für ZOE & Co. enthält beide Quellen.
    const cache = await db.loadJson<{ events: { title: string; calendarName: string }[] }>('calendar-cache');
    expect(cache!.events.map(e => e.calendarName)).toContain('MAKE Kevin (Google)');
  });
});

describe('Tägliche Sicherung', () => {
  it('sichert nur die iCloud-Kalender — Google-Kalender nie per CalDAV (Google hat seinen eigenen Versionsverlauf)', async () => {
    ic.setze('privat-kevin', 'x.ics', (await import('./fixtures/icloud-fake')).einfachIcs('UID-SICHERUNG-1', 'Etwas', '2026-10-07'));
    await verbinden('kevin');
    g.setze({ id: 'a', summary: 'A', start: { dateTime: '2026-10-05T10:00:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-05T11:00:00+02:00', timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const I = await import('@/lib/kalender/icloud');
    await I.abgleichen({ erzwingen: true });
    const SV = await import('@/lib/kalender/sicherung-server');
    const r = await SV.kalenderSicherungTaeglich(new Date('2026-10-05T01:30:00Z'), { erzwingen: true, prozessStart: 0 });
    expect(r).toEqual({ gesichert: 3, fehler: 0 }); // Privat Kevin, Privat Malin, Gemeinsam — nicht „MAKE Kevin (Google)“
    expect(ic.aufrufe.some(a => a.url.includes('google'))).toBe(false);
    await expect(SV.kalenderWiederherstellen('MAKE Kevin (Google)', { wer: WER })).rejects.toMatchObject({ status: 404 });
  });
});

describe('Takt und HOI', () => {
  it('Takt: fällig ohne Stand, nach 5 Min. ohne Kanal, nach 30 Min. mit Kanal; nie in der Pause; getrennt/aus: gar nicht', () => {
    const jetzt = Date.parse('2026-10-03T10:00:00.000Z');
    const vor = (min: number) => new Date(jetzt - min * 60_000).toISOString();
    expect(T.faelligFuer(null, jetzt)).toBe(true);
    expect(T.faelligFuer({ at: vor(3) }, jetzt)).toBe(false);
    expect(T.faelligFuer({ at: vor(6) }, jetzt)).toBe(true);
    expect(T.faelligFuer({ at: vor(6), kanal: { ablauf: jetzt + 3600_000 } }, jetzt)).toBe(false);
    expect(T.faelligFuer({ at: vor(31), kanal: { ablauf: jetzt + 3600_000 } }, jetzt)).toBe(true);
    expect(T.faelligFuer({ at: vor(10), kanal: { ablauf: jetzt - 1000 } }, jetzt)).toBe(true);
    expect(T.faelligFuer({ at: vor(10), fehlerAt: vor(1), pauseBis: new Date(jetzt + 600_000).toISOString() }, jetzt)).toBe(false);
  });
  it('Takt-Job: gleicht verbundene Personen ab, richtet den Push-Kanal ein; ohne Konfiguration nichts', async () => {
    await verbinden('kevin');
    vi.setSystemTime(new Date(Date.now() + 6 * 60_000));
    const r = await T.googleJobsImTakt(Date.now());
    expect(r.gestartet).toEqual(['kevin']);
    await vi.waitFor(async () => expect((await S.ladeGoogleStand('kevin'))?.kanal).toBeTruthy());
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    expect((await T.googleJobsImTakt(Date.now() + 3600_000)).gestartet).toEqual([]);
  });
  it('HOI-Befund: getrennt = rot, steht still = gelb/rot, läuft = grün; Zähler statt Inhalte', () => {
    const ok = { personen: 2, vorMin: 3, veraltet: false, getrennt: 0, push: { aktiv: 2, von: 2, moeglich: true } };
    expect(H.googleKalenderBefunde(ok)[0]).toMatchObject({ id: 'kalender-google', ampel: 'gruen' });
    expect(H.googleKalenderBefunde({ ...ok, getrennt: 1 })[0].ampel).toBe('rot');
    expect(H.googleKalenderBefunde({ ...ok, vorMin: 45, veraltet: true })[0].ampel).toBe('gelb');
    expect(H.googleKalenderBefunde({ ...ok, vorMin: 400, veraltet: true })[0].ampel).toBe('rot');
    expect(H.googleKalenderBefunde({ ...ok, vorMin: null })[0].ampel).toBe('rot');
    expect(H.googleKalenderBefunde(null)).toEqual([]);
    expect(JSON.stringify(H.googleKalenderBefunde(ok))).not.toMatch(/@|makeinnovation/);
  });
  it('Lage aus den Beständen: zählt Personen, Alter, getrennte und Push-Kanäle', async () => {
    await verbinden('kevin');
    const { googleLage } = await import('@/lib/kalender/google/lage');
    expect(await googleLage(Date.now())).toMatchObject({ personen: 1, vorMin: 0, veraltet: false, getrennt: 0, push: { aktiv: 0, von: 1, moeglich: true } });
    await V.alsGetrenntMarkieren('kevin', 'test');
    expect(await googleLage(Date.now())).toMatchObject({ personen: 1, getrennt: 1 });
  });
});
