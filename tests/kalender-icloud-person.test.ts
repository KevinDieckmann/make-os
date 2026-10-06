// iCloud je Person (06.10.2026, lib/kalender/icloud-person.ts): jede Person verbindet ihr EIGENES iCloud-Konto (Apple-ID +
// app-spezifisches Passwort) in Kalender › Einstellungen. Geprüft wird gegen zwei nachgebaute CalDAV-Konten (nie echtes iCloud,
// alle Adressen @example.invalid), mit echtem, verschlüsseltem Datenspeicher (Temp-Ordner):
//   · Verbinden: Anmeldung vor dem Speichern geprüft, falsches Passwort → nichts gespeichert, Zugangsdaten nie in Antworten
//     und nie im Klartext auf der Platte, Drossel nach Fehlversuchen, Dienstweg/fremde Konten 403
//   · Trennung: Termine aus Malins Verbindung sieht Kevin nur als „Belegt“ (ohne Titel, ohne Kalendernamen) — überall, wo
//     maskiert wird (Kalender, ZOE, Zwischenspeicher); umgekehrt genauso; der Haushalts-Kalender bleibt geteilt wie bisher
//   · Schreiben: in Malins Kalender nur Malin (mit IHREM Zugang), Kevin → 403
//   · geteilte Kalender (in beiden Konten) zählen nur einmal; Kalender einzeln ausblenden
//   · Übergang Umgebung → Kevin: ohne Eintrag gilt die Server-Einrichtung, ein Eintrag ersetzt sie, „Trennen“ schaltet sie ab
//   · App-Passwort ungültig (401): klare Meldung, EINE Glocke, „Verbindung erneuern“ setzt zurück
//   · Trennen löscht Zugang und Spiegel
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { IcloudFake, einfachIcs } from './fixtures/icloud-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-icloud-person-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-icloud-person';
process.env.MAKE_OS_KEY = 'dienst-test-icloud-person';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response>; DELETE?: (r: Request) => Promise<Response> };
let icloudRoute: R, kalenderRoute: R, termin: R, appleCal: R, einstRoute: R;
let P: typeof import('@/lib/kalender/icloud-person'), I: typeof import('@/lib/kalender/icloud'), H: typeof import('@/lib/kalender/icloud-haupt'), db: typeof import('@/lib/store/local-db');
let kev: IcloudFake, mal: IcloudFake, lena: IcloudFake;

const KEVIN_PW = 'aaaa-bbbb-cccc-dddd';
const MALIN_PW = 'eeee-ffff-gggg-hhhh';
const TAG = '2026-10-07';
const kopf = (person: string | null) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const req = (methode: string, url: string, k: Record<string, string>, body?: unknown) => new Request(`http://localhost${url}`, { method: methode, headers: k, ...(body ? { body: JSON.stringify(body) } : {}) });
const icloud = (person: string | null, body?: unknown) => (body ? icloudRoute.POST!(req('POST', '/api/kalender/icloud', kopf(person), body)) : icloudRoute.GET!(req('GET', '/api/kalender/icloud', kopf(person)))).then(j);
const kalender = (person: string) => kalenderRoute.GET!(req('GET', `/api/kalender?von=2026-10-06&bis=2026-10-13`, kopf(person))).then(j);
const verbindeMalin = () => icloud('malin', { aktion: 'verbinden', appleId: 'Malin@Example.invalid ', passwort: 'EEEE FFFF GGGG HHHH' });

beforeAll(async () => {
  P = await import('@/lib/kalender/icloud-person'); I = await import('@/lib/kalender/icloud'); H = await import('@/lib/kalender/icloud-haupt'); db = await import('@/lib/store/local-db');
  icloudRoute = await import('../app/api/kalender/icloud/route') as R; kalenderRoute = await import('../app/api/kalender/route') as R;
  termin = await import('../app/api/kalender/termin/route') as R; appleCal = await import('../app/api/apple-calendar/route') as R;
  einstRoute = await import('../app/api/state/kalender-einstellungen/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  H.hauptVergessen();
  (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'));
  kev = new IcloudFake({ nr: '123', adresse: 'kevin@example.invalid', zugang: { id: 'kevin@example.invalid', passwort: KEVIN_PW } });
  kev.add('home', 'Privat Kevin').add('gemeinsam', 'Gemeinsam');
  kev.setze('home', 'k1.ics', einfachIcs('KEV-1', 'Kevin Beratung', TAG, '090000', '100000'));
  kev.setze('gemeinsam', 's1.ics', einfachIcs('SHARED-1', 'Familienessen', TAG, '190000', '200000'));
  mal = new IcloudFake({ nr: '456', adresse: 'malin@example.invalid', zugang: { id: 'malin@example.invalid', passwort: MALIN_PW } });
  mal.add('home', 'Kalender').add('arzt', 'Arzttermine').add('geteilt', 'Gemeinsam');
  mal.setze('home', 'm1.ics', einfachIcs('MAL-1', 'Malin Yoga mit Anna', TAG, '070000', '080000', 'LOCATION:Studio Nord\r\n'));
  mal.setze('arzt', 'm2.ics', einfachIcs('MAL-2', 'Physio', TAG, '120000', '130000'));
  mal.setze('geteilt', 's1.ics', einfachIcs('SHARED-1', 'Familienessen', TAG, '190000', '200000'));
  lena = new IcloudFake({ nr: '789', adresse: 'lena@example.invalid', zugang: { id: 'lena@example.invalid', passwort: 'iiii-jjjj-kkkk-llll' } });
  lena.add('home', 'Lena');
  const konten = [kev, mal, lena];
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => {
    const url = String(u);
    const auth = ((i.headers ?? {}) as Record<string, string>).Authorization;
    if (url === 'https://caldav.icloud.com/') return (await (konten.find(k => k.passt(auth)) ?? kev).handle(url, i))!;
    const k = konten.find(x => url.includes(`/${x.nr}/`));
    return k ? (await k.handle(url, i))! : new Response('nicht gefunden', { status: 404 });
  }));
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', ''); vi.stubEnv('ICLOUD_PERSON', '');
  // Übergang: Kevins bisherige Server-Einrichtung (Umgebung) = der Haushalts-Kalender.
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid'); vi.stubEnv('ICLOUD_APP_PASSWORT', KEVIN_PW);
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k3', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k4', speicher: 'gast', email: 'gast@example.invalid', name: 'Gast Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  await I.abgleichen({ erzwingen: true });
});

describe('Eingaben (rein)', () => {
  it('App-Passwort: 16 Buchstaben mit/ohne Bindestriche, Leerzeichen, Großbuchstaben → xxxx-xxxx-xxxx-xxxx; das normale Apple-Passwort nie', () => {
    expect(P.passwortSauber('abcd-efgh-ijkl-mnop')).toBe('abcd-efgh-ijkl-mnop');
    expect(P.passwortSauber(' ABCD EFGH ijkl mnop ')).toBe('abcd-efgh-ijkl-mnop');
    expect(P.passwortSauber('abcdefghijklmnop')).toBe('abcd-efgh-ijkl-mnop');
    expect(P.passwortSauber('Sommer2026!')).toBeNull();
    expect(P.passwortSauber('abcd-efgh-ijkl-mno1')).toBeNull();
    expect(P.passwortSauber(undefined)).toBeNull();
  });
  it('Apple-ID: E-Mail-Adresse, klein, ohne Leerzeichen', () => {
    expect(P.appleIdSauber(' Malin@Example.invalid ')).toBe('malin@example.invalid');
    expect(P.appleIdSauber('malin')).toBeNull();
    expect(P.appleIdSauber('a"b@x.de')).toBeNull();
  });
});

describe('Verbinden je Person', () => {
  it('Malin verbindet ihr eigenes Konto: Anmeldung geprüft, gespeichert (verschlüsselt), Kalender erscheinen — Zugangsdaten nie in der Antwort', async () => {
    const r = await verbindeMalin();
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, haupt: false, quelle: 'oberflaeche', verbunden: true, konto: 'm***@example.invalid' });
    expect(r.text).not.toContain(MALIN_PW);
    expect(r.text).not.toContain('eeeeffff');
    expect(r.text).not.toContain('malin@example.invalid');
    expect(r.d.kalender.map((k: { name: string }) => k.name).sort()).toEqual(['Arzttermine', 'Gemeinsam', 'Kalender']);
    // Auf der Platte nur die Hülle — weder Passwort noch Apple-ID im Klartext.
    const roh = readFileSync(path.join(ordner, 'icloud-verbindung--malin.json'), 'utf8');
    expect(roh).not.toContain(MALIN_PW);
    expect(roh).not.toContain('malin@example.invalid');
    expect(roh).toContain('__verschluesselt');
    // Der Abgleich lief mit IHREM Zugang — nie mit Kevins.
    expect(mal.aufrufe.filter(a => a.methode === 'REPORT').length).toBeGreaterThan(0);
    expect(mal.aufrufe.every(a => a.auth === `Basic ${Buffer.from(`malin@example.invalid:${MALIN_PW}`).toString('base64')}`)).toBe(true);
    // GET liefert dasselbe — wieder ohne Zugangsdaten.
    const g = await icloud('malin');
    expect(g.d).toMatchObject({ verbunden: true, haupt: false });
    expect(g.text).not.toContain(MALIN_PW);
  });

  it('falsches App-Passwort: Apple lehnt ab → klare Meldung, NICHTS gespeichert; nach 3 Fehlversuchen erst nach einer Pause', async () => {
    const r = await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'zzzz-zzzz-zzzz-zzzz' });
    expect(r.status).toBe(400);
    expect(r.d).toMatchObject({ ok: false, anmeldung: true });
    expect(r.d.fehler).toMatch(/App-Passwort/);
    expect(existsSync(path.join(ordner, 'icloud-verbindung--malin.json'))).toBe(false);
    await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'zzzz-zzzz-zzzz-zzzy' });
    await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'zzzz-zzzz-zzzz-zzzx' });
    await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'zzzz-zzzz-zzzz-zzzw' });
    const gesperrt = await verbindeMalin();
    expect(gesperrt.status).toBe(429);
  });

  it('das normale Apple-Passwort wird gar nicht erst an Apple geschickt (400 mit Erklärung)', async () => {
    const vorher = mal.aufrufe.length + kev.aufrufe.length;
    const r = await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'MeinApplePasswort1' });
    expect(r.status).toBe(400);
    expect(r.d.fehler).toMatch(/appleid\.apple\.com/);
    expect(mal.aufrufe.length + kev.aufrufe.length).toBe(vorher);
  });

  it('nur die Person selbst: Dienstweg (auch mit Person) 403, Konto ohne Haushalt 403, ohne Sitzung 403', async () => {
    const d = await icloudRoute.POST!(req('POST', '/api/kalender/icloud', dienst('malin'), { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: MALIN_PW })).then(j);
    expect(d.status).toBe(403);
    expect((await icloudRoute.GET!(req('GET', '/api/kalender/icloud', dienst('malin'))).then(j)).status).toBe(403);
    expect((await icloud('gast')).status).toBe(403);
    expect((await icloud(null)).status).toBe(403);
    expect(existsSync(path.join(ordner, 'icloud-verbindung--malin.json'))).toBe(false);
  });
});

describe('Trennung der Sichten', () => {
  it('Kevin sieht Malins eigene Termine nur als „Belegt“ — ohne Titel, Ort und Kalendernamen; Malin sieht sie voll', async () => {
    await verbindeMalin();
    const kevin = await kalender('kevin');
    expect(kevin.status).toBe(200);
    expect(kevin.text).not.toContain('Yoga');
    expect(kevin.text).not.toContain('Studio Nord');
    expect(kevin.text).not.toContain('Physio');
    expect(kevin.text).not.toContain('Arzttermine');
    expect(kevin.text).not.toContain('456/calendars');
    const belegt = kevin.d.termine.filter((t: { maskiert?: boolean }) => t.maskiert);
    expect(belegt.map((t: { titel: string; kalender: string }) => [t.titel, t.kalender])).toEqual([['Belegt', 'iCloud · Malin'], ['Belegt', 'iCloud · Malin']]);
    // Kalenderliste: Malins Kalender nur als EIN neutraler, nicht schreibbarer Eintrag.
    expect(kevin.d.kalender.filter((k: { quelle?: string }) => k.quelle === 'icloud')).toEqual([{ name: 'iCloud · Malin', schreibbar: false, wer: 'malin', quelle: 'icloud' }]);
    expect(Object.keys(kevin.d.einstellungen.persoenlich ?? {})).toEqual(['iCloud · Malin']);
    const malin = await kalender('malin');
    const titel = malin.d.termine.map((t: { titel: string }) => t.titel);
    expect(titel).toEqual(expect.arrayContaining(['Malin Yoga mit Anna', 'Physio', 'Kevin Beratung', 'Familienessen']));
    expect(malin.d.kalender.map((k: { name: string }) => k.name)).toEqual(expect.arrayContaining(['Kalender · Malin', 'Arzttermine · Malin']));
    // Geteilter Kalender (in beiden Konten): Familienessen genau EINMAL — im Haushalts-Kalender.
    expect(malin.d.termine.filter((t: { titel: string }) => t.titel === 'Familienessen')).toHaveLength(1);
    expect(malin.d.termine.find((t: { titel: string }) => t.titel === 'Familienessen').kalender).toBe('Gemeinsam');
    // Die Einstellungen geben Kevin keine echten Kalendernamen von Malin (auch nicht über die Einstellungen-Route).
    const e = await einstRoute.GET!(req('GET', '/api/state/kalender-einstellungen', kopf('kevin'))).then(j);
    expect(e.text).not.toContain('Arzttermine');
  });

  it('auch für ZOE, den Zwischenspeicher und den Systemlauf (Mac-Zulieferer): Malins Termine nur als „Belegt“', async () => {
    await verbindeMalin();
    const { termineFuerZoe } = await import('@/lib/kalender/zoe-sicht-server');
    const z = await termineFuerZoe('kevin', '2026-10-06', '2026-10-13');
    expect(JSON.stringify(z)).not.toContain('Yoga');
    expect(z.termine.filter(t => t.maskiert)).toHaveLength(2);
    const zm = await termineFuerZoe('malin', '2026-10-06', '2026-10-13');
    expect(JSON.stringify(zm)).toContain('Yoga');
    const cache = JSON.stringify(await db.loadJson('calendar-cache'));
    expect(cache).toContain('"persoenlich":"malin"');
    const sys = await appleCal.GET!(req('GET', '/api/apple-calendar', dienst())).then(j);
    expect(sys.status).toBe(200);
    expect(sys.text).not.toContain('Yoga');
    expect(sys.text).toContain('Kevin Beratung');
    const k = await appleCal.GET!(req('GET', '/api/apple-calendar', kopf('kevin'))).then(j);
    expect(k.text).not.toContain('Yoga');
  });

  it('umgekehrt: gehört der Haushalts-Kalender einer dritten Person, sind Kevins und Malins Konten beide eigene — keiner sieht die Termine des anderen', async () => {
    vi.stubEnv('ICLOUD_PERSON', 'lena'); vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
    await db.saveJson('kalender-icloud', { kalender: [], objekte: {} });
    expect((await icloud('kevin', { aktion: 'verbinden', appleId: 'kevin@example.invalid', passwort: KEVIN_PW })).d).toMatchObject({ ok: true, haupt: false });
    expect((await verbindeMalin()).d).toMatchObject({ ok: true, haupt: false });
    const malin = await kalender('malin');
    expect(malin.text).not.toContain('Kevin Beratung');
    expect(malin.text).toContain('Malin Yoga');
    const kevin = await kalender('kevin');
    expect(kevin.text).toContain('Kevin Beratung');
    expect(kevin.text).not.toContain('Malin Yoga');
    // Ein Termin, der in BEIDEN eigenen Konten steht (geteilter Kalender), ist für jeden der Eigentümerin/des Eigentümers — der andere sieht „Belegt“.
    expect(malin.d.termine.filter((t: { maskiert?: boolean; kalender: string }) => t.maskiert && t.kalender === 'iCloud · Kevin').length).toBeGreaterThan(0);
  });

  it('Kalender einzeln ausblenden: der Kalender kommt aus dem Spiegel und aus allen Sichten', async () => {
    await verbindeMalin();
    const r = await icloud('malin', { aktion: 'kalender', kennung: 'arzt', zeigen: false });
    expect(r.d.kalender.find((k: { kennung: string }) => k.kennung === 'arzt')).toMatchObject({ gezeigt: false });
    const malin = await kalender('malin');
    expect(malin.text).not.toContain('Physio');
    expect((await kalender('kevin')).d.termine.filter((t: { maskiert?: boolean }) => t.maskiert)).toHaveLength(1);
    // Unbekannter Kalender → 409; fremde Person kann Malins Auswahl nicht ändern (das Tor ist die eigene Person).
    expect((await icloud('malin', { aktion: 'kalender', kennung: 'gibtsnicht', zeigen: true })).status).toBe(409);
    expect((await icloud('kevin', { aktion: 'kalender', kennung: 'arzt', zeigen: true })).status).toBe(409);
  });
});

describe('Schreiben', () => {
  it('Malin legt in IHREM Kalender an (mit ihrem Zugang); Kevin darf dort weder anlegen noch ändern noch löschen (403)', async () => {
    await verbindeMalin();
    const neu = { titel: 'Massage', kalender: 'Kalender · Malin', start: `${TAG}T15:00`, ende: `${TAG}T16:00`, uid: 'makeos-t-malin00001' };
    const k = await termin.POST!(req('POST', '/api/kalender/termin', kopf('kevin'), neu)).then(j);
    expect(k.status).toBe(403);
    expect(Object.values(mal.kalender.home.objekte).some(o => o.ics.includes('Massage'))).toBe(false);
    const m = await termin.POST!(req('POST', '/api/kalender/termin', kopf('malin'), neu)).then(j);
    expect(m.status).toBe(200);
    const put = mal.aufrufe.find(a => a.methode === 'PUT')!;
    expect(put.auth).toBe(`Basic ${Buffer.from(`malin@example.invalid:${MALIN_PW}`).toString('base64')}`);
    expect(kev.aufrufe.some(a => a.methode === 'PUT')).toBe(false);
    // Kevin kennt den echten Schlüssel nicht (er sieht „belegt-…“) — selbst mit ihm: 403.
    const schluessel = m.d.schluessel as string;
    const p = await termin.PATCH!(req('PATCH', '/api/kalender/termin', kopf('kevin'), { uid: schluessel, titel: 'Geändert' })).then(j);
    expect(p.status).toBe(403);
    const d = await termin.DELETE!(req('DELETE', `/api/kalender/termin?uid=${encodeURIComponent(schluessel)}`, kopf('kevin'))).then(j);
    expect(d.status).toBe(403);
    // Malin selbst darf ändern — wieder mit ihrem Zugang.
    const mp = await termin.PATCH!(req('PATCH', '/api/kalender/termin', kopf('malin'), { uid: schluessel, titel: 'Massage 2' })).then(j);
    expect(mp.status).toBe(200);
    expect(Object.values(mal.kalender.home.objekte).some(o => o.ics.includes('Massage 2'))).toBe(true);
  });

  it('auch der Server-Weg (ZOE, Spiegel) legt nichts im Kalender einer anderen Person an', async () => {
    await verbindeMalin();
    const { terminAnlegenServer } = await import('@/lib/kalender/termin-server');
    await expect(terminAnlegenServer({ titel: 'Block', start: `${TAG}T15:00:00`, ende: `${TAG}T16:00:00`, wer: 'kevin', kalender: 'Kalender · Malin', von: 'kevin' }, { art: 'system', id: 'test' } as never)).rejects.toMatchObject({ status: 403 });
  });
});

describe('Übergang Server-Einrichtung → Oberfläche (Haupt-Person)', () => {
  it('ohne Eintrag gilt die Umgebung als Kevins Verbindung (Haushalts-Kalender, Quelle „Server-Einrichtung“)', async () => {
    const s = await icloud('kevin');
    expect(s.d).toMatchObject({ haupt: true, quelle: 'umgebung', verbunden: true });
    expect(s.text).not.toContain(KEVIN_PW);
    expect(I.verbunden()).toBe(true);
    const m = await icloud('malin');
    expect(m.d).toMatchObject({ haupt: false, verbunden: false, quelle: 'keine' });
  });

  it('ein Eintrag in der Oberfläche ersetzt die Umgebung — der Haushalts-Kalender läuft mit dem neuen Zugang', async () => {
    const neuPw = 'mmmm-nnnn-oooo-pppp';
    kev.zugang = { id: 'kevin@example.invalid', passwort: neuPw }; // bei Apple neues App-Passwort, das alte gilt nicht mehr
    await expect(I.abgleichen({ erzwingen: true })).rejects.toMatchObject({ status: 401 });
    const r = await icloud('kevin', { aktion: 'verbinden', appleId: 'kevin@example.invalid', passwort: neuPw });
    expect(r.d).toMatchObject({ ok: true, haupt: true, quelle: 'oberflaeche', verbunden: true });
    expect(I.zugang()).toEqual({ id: 'kevin@example.invalid', passwort: neuPw });
    const st = await I.abgleichen({ erzwingen: true });
    expect(st.fehler).toBeUndefined();
    expect((await kalender('malin')).text).toContain('Familienessen');
    expect(existsSync(path.join(ordner, 'kalender-icloud--kevin.json'))).toBe(false); // kein eigener Spiegel: Kevins Konto IST der Haushalts-Kalender
  });

  it('„Trennen“ schaltet auch die Umgebung ab; eine NEUE Server-Einrichtung gilt wieder', async () => {
    const r = await icloud('kevin', { aktion: 'trennen' });
    expect(r.d).toMatchObject({ ok: true, war: true, verbunden: false, quelle: 'getrennt' });
    expect(I.verbunden()).toBe(false);
    expect((await I.ladeStandIcloud()).kalender).toEqual([]);
    expect((await kalender('kevin')).text).not.toContain('Kevin Beratung');
    vi.stubEnv('ICLOUD_APP_PASSWORT', 'qqqq-rrrr-ssss-tttt'); // deploy/icloud-verbinden.sh mit neuem Passwort
    await P.hauptZugangLaden();
    expect(I.verbunden()).toBe(true);
  });
});

describe('App-Passwort ungültig', () => {
  it('401 beim Abgleich: Stand „Anmeldung abgelehnt“, EINE Glocke, Meldung mit „Verbindung erneuern“; erneuern setzt zurück', async () => {
    await verbindeMalin();
    mal.zugang = { id: 'malin@example.invalid', passwort: 'neue-zzzz' }; // Malin hat ihr Apple-Passwort geändert
    vi.setSystemTime(new Date('2026-10-06T09:00:00.000Z'));
    await expect(P.personAbgleichen('malin', { erzwingen: true })).rejects.toMatchObject({ status: 401 });
    await expect(P.personAbgleichen('malin', { erzwingen: true })).rejects.toMatchObject({ status: 401 });
    const s = await icloud('malin');
    expect(s.d).toMatchObject({ verbunden: true, anmeldung: true });
    expect(s.d.abgleich.fehler).toMatch(/Verbindung erneuern/);
    const glocke = (await db.loadJson<{ eintraege?: { titel: string }[] }>('meldungen--malin'))?.eintraege ?? [];
    expect(glocke.filter(m => /App-Passwort/.test(m.titel))).toHaveLength(1);
    expect((await db.loadJson('meldungen--kevin')) ?? null).toBeNull();
    // Kalender-Antwort: Malins eigener Stand zeigt die abgelehnte Anmeldung — nur bei ihr.
    expect((await kalender('malin')).d.icloudEigen.abgleich).toMatchObject({ anmeldung: true });
    expect((await kalender('kevin')).d.icloudEigen).toBeUndefined();
    // Verbindung erneuern mit dem neuen App-Passwort.
    mal.zugang = { id: 'malin@example.invalid', passwort: 'uuuu-vvvv-wwww-xxxx' };
    const r = await icloud('malin', { aktion: 'verbinden', appleId: 'malin@example.invalid', passwort: 'uuuu-vvvv-wwww-xxxx' });
    expect(r.d).toMatchObject({ ok: true, verbunden: true });
    expect(r.d.anmeldung).toBeUndefined();
    expect(r.d.erneuert).toBeTruthy();
  });
});

describe('Trennen je Person', () => {
  it('löscht Zugang und Spiegel dieser Person (Datei weg), ihre Termine verschwinden — Kevins Haushalts-Kalender bleibt', async () => {
    await verbindeMalin();
    expect(existsSync(path.join(ordner, 'kalender-icloud--malin.json'))).toBe(true);
    const r = await icloud('malin', { aktion: 'trennen' });
    expect(r.d).toMatchObject({ ok: true, war: true, verbunden: false });
    expect(existsSync(path.join(ordner, 'icloud-verbindung--malin.json'))).toBe(false);
    expect(existsSync(path.join(ordner, 'kalender-icloud--malin.json'))).toBe(false);
    expect(await P.personZugang('malin')).toBeNull();
    const malin = await kalender('malin');
    expect(malin.text).not.toContain('Yoga');
    expect(malin.text).toContain('Kevin Beratung');
    expect(I.verbunden()).toBe(true);
    expect(JSON.stringify(await db.loadJson('calendar-cache'))).not.toContain('Yoga');
  });
});

describe('Takt', () => {
  it('gleicht je Person höchstens alle 5 Minuten ab, nie in der Pause nach einer abgelehnten Anmeldung', async () => {
    await verbindeMalin();
    expect((await P.icloudPersonenImTakt(Date.parse('2026-10-06T08:02:00Z'))).gestartet).toEqual([]);
    expect((await P.icloudPersonenImTakt(Date.parse('2026-10-06T08:06:00Z'))).gestartet).toEqual(['malin']);
    await new Promise(r => setTimeout(r, 0));
    while (P.personAbgleichLaeuft('malin')) await new Promise(r => setTimeout(r, 5));
    mal.zugang = { id: 'malin@example.invalid', passwort: 'falsch-falsch' };
    vi.setSystemTime(new Date('2026-10-06T08:20:00.000Z'));
    await P.personAbgleichen('malin', { erzwingen: true }).catch(() => {});
    expect((await P.icloudPersonenImTakt(Date.parse('2026-10-06T08:30:00Z'))).gestartet).toEqual([]); // 30 Min. Pause
  });
});
