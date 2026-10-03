// Google-Abgleich (lib/kalender/google/abgleich.ts): syncToken inkrementell, 410 → voller Neuabgleich, Seiten, abgesagte
// Ereignisse und Vorkommen, Echo-Erkennung der eigenen Schreibungen, Fehler (401 → erneuern, invalid_grant → getrennt +
// EINE Glocke, 403/429 → Pause), „letzter Abgleich vor X Min.“, Überlagerung des Kalender-Stands, iCloud-Bestand unberührt.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-a-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-abgleich';
process.env.MAKE_OS_KEY = 'dienst-test-google-abgleich';

type Mod = {
  V: typeof import('@/lib/google/verbindung'); A: typeof import('@/lib/kalender/google/abgleich'); S: typeof import('@/lib/kalender/google/stand');
  I: typeof import('@/lib/kalender/icloud'); db: typeof import('@/lib/store/local-db');
};
let m: Mod;
let g: GoogleFake;
const berlin = (tag: string, uhr: string, ende: string) => ({ start: { dateTime: `${tag}T${uhr}:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${tag}T${ende}:00+02:00`, timeZone: 'Europe/Berlin' } });

beforeAll(async () => {
  m = { V: await import('@/lib/google/verbindung'), A: await import('@/lib/kalender/google/abgleich'), S: await import('@/lib/kalender/google/stand'), I: await import('@/lib/kalender/icloud'), db: await import('@/lib/store/local-db') };
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

async function verbinden(person = 'kevin') {
  const { url } = await m.V.verbindungStarten(person, ['kalender']);
  await m.V.verbindungAbschliessen(person, 'code-ok', new URL(url).searchParams.get('state')!);
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  m.db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake();
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test');
  vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
  await m.db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await verbinden('kevin');
});

describe('Erste Lesung (voll) und Kalender wählen', () => {
  it('Hauptkalender wird gewählt, Name „MAKE Kevin (Google)“, Termine kommen in den Stand (Überlagerung) — mit Seiten', async () => {
    g.seite = 2;
    for (let i = 1; i <= 5; i++) g.setze({ id: `e${i}`, summary: `Termin ${i}`, ...berlin(`2026-10-0${i + 3}`, '10:00', '11:00') });
    const r = await m.A.googleAbgleichen('kevin');
    expect(r).toMatchObject({ voll: true, ereignisse: 5, vonAussen: 5 });
    expect(aufrufeAn(g, '/events', 'GET').length).toBe(3); // 3 Seiten
    const s = await m.I.ladeStand();
    expect(s.kalender.map(k => k.name)).toEqual(['MAKE Kevin (Google)']);
    expect(s.kalender[0]).toMatchObject({ quelle: 'google', person: 'kevin', schreibbar: true, farbe: '#9fe1e7', ich: ['kevin@makeinnovation.test'] });
    const t = m.I.termineImZeitraum(s, '2026-10-01', '2026-10-31');
    expect(t.map(x => x.titel)).toEqual(['Termin 1', 'Termin 2', 'Termin 3', 'Termin 4', 'Termin 5']);
    expect(t[0].id).toBe('google-kevin|e1');
  });
  it('die erste Lesung begrenzt auf heute − 90 Tage (timeMin), singleEvents=false, showDeleted=true', async () => {
    await m.A.googleAbgleichen('kevin');
    const q = aufrufeAn(g, '/events', 'GET')[0].query;
    expect(q.get('timeMin')).toBe('2026-07-05T00:00:00Z');
    expect(q.get('singleEvents')).toBe('false');
    expect(q.get('showDeleted')).toBe('true');
    expect(q.get('syncToken')).toBeNull();
  });
  it('anderen Kalender wählen: Bestand wird neu aufgesetzt, alte Termine verschwinden, Name bleibt eindeutig', async () => {
    g.setze({ id: 'alt', summary: 'Alt', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    await m.A.googleKalenderWaehlen('kevin', 'team@group.calendar.google.test');
    const s = await m.S.ladeGoogleStand('kevin');
    expect(s).toMatchObject({ kalenderId: 'team@group.calendar.google.test', kalenderName: 'MAKE Kevin (Google)', schreibbar: true });
    expect(Object.keys(s!.events)).toEqual([]);
    const liste = await m.A.googleKalenderListe('kevin');
    expect(liste.map(k => [k.name, k.schreibbar])).toEqual([['kevin@makeinnovation.test', true], ['Feiertage', false], ['Team', true]]);
  });
  it('ein nur lesbarer Kalender ist gewählbar, aber nicht schreibbar (kein Ziel für neue Termine)', async () => {
    await m.A.googleKalenderWaehlen('kevin', 'feiertage@group.calendar.google.test');
    expect((await m.S.ladeGoogleStand('kevin'))?.schreibbar).toBe(false);
    const { googleKalenderNamen } = await import('@/lib/kalender/google/namen');
    expect(await googleKalenderNamen()).toEqual({});
  });
});

describe('Inkrementell', () => {
  it('nach der Volllesung nur Änderungen per syncToken: neu, geändert, gelöscht', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    g.setze({ id: 'b', summary: 'B', ...berlin('2026-10-06', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    g.setze({ id: 'a', summary: 'A neu' }); g.loesche('b'); g.setze({ id: 'c', summary: 'C', ...berlin('2026-10-07', '10:00', '11:00') });
    const r = await m.A.googleAbgleichen('kevin');
    expect(r).toMatchObject({ voll: false, geaendert: 3, vonAussen: 3, ereignisse: 2 });
    const q = aufrufeAn(g, '/events', 'GET').pop()!.query;
    expect(q.get('syncToken')).toMatch(/^st\d+$/);
    expect(q.get('timeMin')).toBeNull();
    const t = m.I.termineImZeitraum(await m.I.ladeStand(), '2026-10-01', '2026-10-31');
    expect(t.map(x => x.titel)).toEqual(['A neu', 'C']);
  });
  it('410 (Token abgelaufen) → der Bestand wird verworfen und SOFORT voll neu gelesen — nie ein halber Stand', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    g.loesche('a'); g.setze({ id: 'n', summary: 'Neu', ...berlin('2026-10-06', '10:00', '11:00') });
    g.gone = true;
    const r = await m.A.googleAbgleichen('kevin');
    expect(r.voll).toBe(true);
    const t = m.I.termineImZeitraum(await m.I.ladeStand(), '2026-10-01', '2026-10-31');
    expect(t.map(x => x.titel)).toEqual(['Neu']);
    expect(aufrufeAn(g, '/events', 'GET').filter(a => a.query.get('timeMin')).length).toBe(2); // erste + erneute Volllesung
  });
  it('abgesagte Vorkommen einer Serie bleiben als EXDATE; ein abgesagtes Master-Ereignis nimmt seine Ausnahmen mit', async () => {
    g.setze({ id: 's', summary: 'Serie', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4'], ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    g.setze({ id: 's_20261012T080000Z', status: 'cancelled', recurringEventId: 's', originalStartTime: { dateTime: '2026-10-12T10:00:00+02:00', timeZone: 'Europe/Berlin' } });
    await m.A.googleAbgleichen('kevin');
    let t = m.I.termineImZeitraum(await m.I.ladeStand(), '2026-10-01', '2026-11-30');
    expect(t.map(x => x.start.slice(0, 10))).toEqual(['2026-10-05', '2026-10-19', '2026-10-26']);
    g.loesche('s');
    await m.A.googleAbgleichen('kevin');
    t = m.I.termineImZeitraum(await m.I.ladeStand(), '2026-10-01', '2026-11-30');
    expect(t).toEqual([]);
    expect(Object.keys((await m.S.ladeGoogleStand('kevin'))!.events)).toEqual([]);
  });
  it('läuft nie doppelt: zwei gleichzeitige Abgleiche teilen EINEN Lauf', async () => {
    const [a, b] = await Promise.all([m.A.googleAbgleichen('kevin'), m.A.googleAbgleichen('kevin')]);
    expect(a).toBe(b);
    expect(aufrufeAn(g, '/events', 'GET')).toHaveLength(1);
  });
});

describe('Echo: eigene Schreibungen sind keine Änderung von außen', () => {
  it('der ETag unserer Schreibung wird beim Abgleich als Echo erkannt (nicht „von außen“, kein Zurückschreiben)', async () => {
    await m.A.googleAbgleichen('kevin');
    const st = (await m.S.ladeGoogleStand('kevin'))!;
    const ev = g.setze({ id: 'mkEcho', summary: 'Von uns', ...berlin('2026-10-06', '10:00', '11:00') });
    await m.S.aendereGoogleStand('kevin', cur => ({ ...cur, eigene: { ...(cur.eigene ?? {}), mkEcho: String(ev.etag) } }));
    const r = await m.A.googleAbgleichen('kevin');
    expect(r).toMatchObject({ echo: 1, vonAussen: 0, geaendert: 1 });
    expect((await m.S.ladeGoogleStand('kevin'))?.eigene).toEqual({});
    // Ein Abgleich schreibt NIE nach Google: keine POST/PATCH/PUT/DELETE auf Ereignisse.
    expect(g.aufrufe.filter(a => /\/events/.test(a.pfad) && a.methode !== 'GET')).toEqual([]);
    expect(st).toBeTruthy();
  });
  it('dieselbe Änderung von außen (anderer ETag) zählt als von außen', async () => {
    await m.A.googleAbgleichen('kevin');
    g.setze({ id: 'x', summary: 'X', ...berlin('2026-10-06', '10:00', '11:00') });
    expect((await m.A.googleAbgleichen('kevin')).vonAussen).toBe(1);
    expect((await m.S.ladeGoogleStand('kevin'))?.aussen?.n).toBe(1);
  });
});

describe('Fehler', () => {
  it('401: Token wird einmal erneuert und die Anfrage wiederholt', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    g.gueltig.clear(); // alle bisherigen Zugriffstoken ungültig, das Refresh-Token tut noch
    const r = await m.A.googleAbgleichen('kevin');
    expect(r.ereignisse).toBe(1);
    expect(g.aufrufe.filter(a => a.pfad === '/token' && String(a.body).includes('refresh_token'))).toHaveLength(1);
  });
  it('invalid_grant: Verbindung getrennt, Abgleich scheitert mit klarem Text, genau EINE Glocke an die Person', async () => {
    await m.A.googleAbgleichen('kevin');
    g.gueltig.clear(); g.refreshOk = false;
    vi.setSystemTime(new Date(Date.now() + 1000));
    await expect(m.A.googleAbgleichen('kevin', { voll: true })).rejects.toMatchObject({ code: 'getrennt' });
    const s = (await m.S.ladeGoogleStand('kevin'))!;
    expect(s).toMatchObject({ fehlerAnmeldung: true, getrenntGemeldet: true });
    expect(s.pauseBis && Date.parse(s.pauseBis) > Date.now()).toBe(true);
    expect((await m.V.googleStatus('kevin')).getrennt).toBeTruthy();
    const glocke = async () => (await m.db.loadJson<{ eintraege: { art: string; titel: string }[] }>('meldungen--kevin'))?.eintraege ?? [];
    await expect(m.A.googleAbgleichen('kevin')).rejects.toBeTruthy();
    const kalender = (await glocke()).filter(x => x.art === 'kalender' && /Google/.test(x.titel));
    expect(kalender).toHaveLength(1);
  });
  it('429 mit Retry-After: Pause mindestens so lang; danach wieder fällig', async () => {
    await m.A.googleAbgleichen('kevin');
    g.fehler.push({ teil: '/events', methode: 'GET', status: 429, kopf: { 'retry-after': '1200' } });
    vi.setSystemTime(new Date(Date.now() + 1000));
    await expect(m.A.googleAbgleichen('kevin')).rejects.toBeTruthy();
    const s = (await m.S.ladeGoogleStand('kevin'))!;
    expect(Date.parse(s.pauseBis!) - Date.now()).toBeGreaterThanOrEqual(1200 * 1000 - 1000);
    expect(m.A.googleAbgleichFaellig(s, Date.now() + 5 * 60_000)).toBe(false);
    expect(m.A.googleAbgleichFaellig(s, Date.now() + 25 * 60_000)).toBe(true);
  });
  it('403 mit Kontingent-Grund (rateLimitExceeded) = Pause, kein Rechteproblem; sonstiges 403 = verweigert', async () => {
    await m.A.googleAbgleichen('kevin');
    g.fehler.push({ teil: '/events', methode: 'GET', status: 403, body: { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }] } } });
    await expect(m.A.googleAbgleichen('kevin')).rejects.toMatchObject({ status: 429 });
    g.fehler.push({ teil: '/events', methode: 'GET', status: 403, body: { error: { code: 403, errors: [{ reason: 'forbidden' }] } } });
    await expect(m.A.googleAbgleichen('kevin')).rejects.toMatchObject({ status: 403 });
  });
  it('500: Backoff steigt (2 → 4 Min.), Stand zeigt „letzter Abgleich vor X Min.“ und ab 30 Min. „veraltet“', async () => {
    await m.A.googleAbgleichen('kevin');
    g.fehler.push({ teil: '/events', status: 503, einmal: false });
    await expect(m.A.googleAbgleichen('kevin')).rejects.toBeTruthy();
    const eins = (await m.S.ladeGoogleStand('kevin'))!;
    vi.setSystemTime(new Date(Date.parse('2026-10-03T08:00:00.000Z') + 3 * 60_000));
    await expect(m.A.googleAbgleichen('kevin')).rejects.toBeTruthy();
    const zwei = (await m.S.ladeGoogleStand('kevin'))!;
    expect(zwei.fehlerFolge).toBe(2);
    expect(Date.parse(zwei.pauseBis!) - Date.parse(zwei.fehlerAt!)).toBeGreaterThan(Date.parse(eins.pauseBis!) - Date.parse(eins.fehlerAt!));
    const a = m.A.googleAlter(zwei, Date.parse('2026-10-03T08:00:00.000Z') + 40 * 60_000)!;
    expect(a).toMatchObject({ vorMin: 40, veraltet: true });
    expect(a.fehler).toMatch(/Fehler/);
    expect(m.A.googleAlter(zwei, Date.parse('2026-10-03T08:00:00.000Z') + 5 * 60_000)?.veraltet).toBe(false);
  });
  it('Kalender nicht gefunden (404) → klarer Text, Stand bleibt', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    g.fehler.push({ teil: '/events', methode: 'GET', status: 404 });
    await expect(m.A.googleAbgleichen('kevin')).rejects.toMatchObject({ status: 404 });
    expect(m.I.termineImZeitraum(await m.I.ladeStand(), '2026-10-01', '2026-10-31')).toHaveLength(1);
  });
});

describe('Abgrenzung', () => {
  it('der iCloud-Bestand wird vom Google-Abgleich nie angelegt oder verändert; Rückweg: nur eigene neue Bestände', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    const dateien = readdirSync(ordner).filter(f => f.endsWith('.json'));
    expect(dateien.some(f => f.startsWith('kalender-icloud'))).toBe(false);
    expect(dateien).toEqual(expect.arrayContaining(['kalender-google--kevin.json', 'google-verbindung--kevin.json']));
    expect(existsSync(path.join(ordner, 'calendar-cache.json'))).toBe(true);
    const cache = await m.db.loadJson<{ events: { title: string; category: string; owner: string; calendarName: string }[] }>('calendar-cache');
    expect(cache?.events[0]).toMatchObject({ title: 'A', category: 'holding', owner: 'kevin', calendarName: 'MAKE Kevin (Google)' });
  });
  it('Malins Stand ist getrennt von Kevins: eigener Bestand, eigener Kalender; Kevins Token öffnet nichts für Malin', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    await expect(m.A.googleAbgleichen('malin')).rejects.toMatchObject({ code: 'nicht-verbunden' });
    expect(await m.S.ladeGoogleStand('malin')).toBeNull();
  });
  it('Trennen verwirft den Spiegel: danach keine Google-Termine mehr im Stand', async () => {
    g.setze({ id: 'a', summary: 'A', ...berlin('2026-10-05', '10:00', '11:00') });
    await m.A.googleAbgleichen('kevin');
    const { googleTrennenAlles } = await import('@/lib/google/trennen');
    await googleTrennenAlles('kevin');
    expect((await m.I.ladeStand()).kalender).toEqual([]);
    expect(await m.S.ladeGoogleStand('kevin')).toBeNull();
    expect(g.widerrufen).toHaveLength(1);
  });
});
