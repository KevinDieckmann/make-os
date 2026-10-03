// Umzug der Business-Termine aus iCloud nach Google (lib/kalender/google/umzug.ts + Route /api/kalender/google/umzug):
// Vorschau schreibt nichts und nennt Gründe; Ausführen nur mit Bestätigung, Sicherung ZUERST, dann Google anlegen →
// Verweise umhängen → in iCloud löschen; nie Gäste/Serien/Blöcke; idempotent (Abbruch → nie weg, nie doppelt in Google);
// nur die eigene Person, nur eigene iCloud-Kalender.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake } from './fixtures/google-fake';
import { IcloudFake, einfachIcs } from './fixtures/icloud-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-u-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-umzug';
process.env.MAKE_OS_KEY = 'dienst-test-google-umzug';

type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let U: typeof import('@/lib/kalender/google/umzug'), V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/kalender/google/abgleich');
let I: typeof import('@/lib/kalender/icloud'), S: typeof import('@/lib/kalender/google/stand'), db: typeof import('@/lib/store/local-db'), route: Route;
let g: GoogleFake, ic: IcloudFake;

const KAL = 'Kevin Dieckmann';
const KEY = (uid: string) => `kevin-dieckmann|${uid}`;
const WER = { art: 'person' as const, person: 'kevin' };
const j = async (r: Response) => ({ status: r.status, d: await r.json() as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const req = (methode: string, person: string, body?: unknown, q = '') => new Request(`http://localhost/api/kalender/google/umzug${q}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body ? { body: JSON.stringify(body) } : {}) });
const TAG = '2026-10-06', GESTERN = '2026-10-02';

beforeAll(async () => {
  U = await import('@/lib/kalender/google/umzug'); V = await import('@/lib/google/verbindung'); A = await import('@/lib/kalender/google/abgleich');
  I = await import('@/lib/kalender/icloud'); S = await import('@/lib/kalender/google/stand'); db = await import('@/lib/store/local-db');
  route = await import('../app/api/kalender/google/umzug/route') as Route;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake(); ic = new IcloudFake().add('kevin-dieckmann', KAL).add('privat-kevin', 'Privat Kevin').add('privat-malin', 'Privat Malin');
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => (await ic.handle(String(u), i)) ?? g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test'); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid'); vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  const k = 'kevin-dieckmann';
  ic.setze(k, 'e1.ics', einfachIcs('UID-ANNA-0001', 'Kennenlernen Anna', TAG, '100000', '110000', 'LOCATION:Büro\r\nDESCRIPTION:Agenda\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nDESCRIPTION:x\r\nEND:VALARM\r\n'));
  ic.setze(k, 'e2.ics', einfachIcs('UID-PLAIN-0002', 'Strategie-Runde', '2026-10-07', '140000', '150000'));
  ic.setze(k, 'e3.ics', einfachIcs('UID-SERIE-0003', 'Montagsrunde', TAG, '090000', '093000', 'RRULE:FREQ=WEEKLY;COUNT=4\r\n'));
  ic.setze(k, 'e4.ics', einfachIcs('UID-GAST-0004', 'Gespräch mit Gast', '2026-10-08', '100000', '110000', 'ORGANIZER:mailto:kevin.konto@example.invalid\r\nATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:gast@example.invalid\r\n'));
  ic.setze(k, 'e5.ics', einfachIcs('UID-BLOCK-0005', 'Fokus-Block', '2026-10-08', '130000', '140000', 'X-MAKE-ART:block\r\n'));
  ic.setze(k, 'e6.ics', einfachIcs('UID-ALT-0006', 'Gestern', GESTERN, '100000', '110000'));
  ic.setze(k, 'e7.ics', einfachIcs('makeos-event-ev-0007', 'Messe Nord', '2026-10-09', '100000', '130000', 'X-MAKE-ART:termin\r\n'));
  ic.setze('privat-kevin', 'p1.ics', einfachIcs('UID-PRIVAT-0008', 'Zahnarzt', '2026-10-07', '080000', '090000'));
  ic.setze('privat-malin', 'p2.ics', einfachIcs('UID-MALIN-0009', 'Malins Termin', '2026-10-07', '080000', '090000'));
  await I.abgleichen({ erzwingen: true });
  await db.saveJson('kalender-bezug', { bezuege: {
    [KEY('UID-ANNA-0001')]: { kontaktId: 'c-anna1', von: 'kevin', tag: TAG, geaendert: '2026-10-01T10:00:00.000Z' },
    [KEY('makeos-event-ev-0007')]: { eventId: 'ev-0007', von: 'kevin', tag: '2026-10-09', geaendert: '2026-10-01T10:00:00.000Z' },
  } });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', stufe: 'neu', eignung: '', prio: '', importiertAm: '2026-08-01', geaendertAm: '2026-08-01', aktivitaeten: [{ am: '2026-10-01', art: 'termin', text: 'Meeting: Kennenlernen Anna', von: 'kevin', terminUid: KEY('UID-ANNA-0001') }] }] });
  const crm = await import('@/lib/crm/speicher');
  await crm.aendereCrm(c => ({
    ...c,
    followups: [{ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-anna1' }, kontaktId: 'c-anna1', art: 'termin', text: 'Termin vorbereiten', faellig: '2026-10-05', zustaendig: 'kevin', status: 'offen', quelle: 'termin', terminUid: KEY('UID-ANNA-0001'), angelegt: '2026-10-01T10:00:00.000Z', geaendert: '2026-10-01T10:00:00.000Z' } as never],
    events: [{ id: 'ev-0007', titel: 'Messe Nord', format: 'messe', ziel: 'Kunden treffen', datum: '2026-10-09', uhrzeit: '10:00', status: 'geplant', kalenderUid: 'makeos-event-ev-0007' } as never],
  }), WER);
  // Google verbinden (Kevin).
  const { url } = await V.verbindungStarten('kevin', ['kalender']);
  await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
  await A.googleAbgleichen('kevin');
});

const objekteIn = (kal: string) => Object.values(ic.kalender[kal].objekte).map(o => /UID:([^\r\n]+)/.exec(o.ics)![1]);

describe('Vorschau (schreibt nichts)', () => {
  it('wählbar nur iCloud-Kalender, die der Person gehören (nicht Malins, nicht Google); Business erkannt', async () => {
    const v = await U.umzugVorschau('kevin');
    expect(v.ziel).toBe('MAKE Kevin (Google)');
    expect(v.quellen.map(q => q.name).sort()).toEqual([KAL, 'Privat Kevin']);
    expect(v.quellen.find(q => q.name === KAL)?.business).toBe(true);
    expect(v.quellen.find(q => q.name === 'Privat Kevin')?.business).toBe(false);
    expect(v.umzieht).toEqual([]); // ohne Wahl nichts
  });
  it('mit Wahl: was umzieht (ab heute) und was bleibt — mit Grund; Vergangenes nur auf Wunsch', async () => {
    const v = await U.umzugVorschau('kevin', { kalender: [KAL] });
    expect(v.umzieht.map(t => t.titel).sort()).toEqual(['Kennenlernen Anna', 'Messe Nord', 'Strategie-Runde']);
    const grund = Object.fromEntries(v.bleibt.map(t => [t.titel, t.grund]));
    expect(grund['Montagsrunde']).toMatch(/Serie/);
    expect(grund['Gespräch mit Gast']).toMatch(/Gäste/);
    expect(grund['Fokus-Block']).toMatch(/Planung/);
    expect(v.umzieht.find(t => t.titel === 'Gestern')).toBeUndefined();
    const mit = await U.umzugVorschau('kevin', { kalender: [KAL], mitVergangenen: true });
    expect(mit.umzieht.map(t => t.titel)).toContain('Gestern');
    expect(v.quellen.find(q => q.name === KAL)).toMatchObject({ umzieht: 3, bleibt: 3 });
    // geschrieben wurde nichts
    expect(ic.aufrufe.filter(a => ['PUT', 'DELETE'].includes(a.methode)).length).toBe(0);
    expect(g.events.size).toBe(0);
  });
  it('Gründe rein: abgesagt, Serie, Gäste, Block/Fokus, nicht änderbar', () => {
    const ok = { serie: false, mitTeilnehmern: false, bearbeitbar: true, art: 'termin', kalenderSchreibbar: true };
    expect(U.bleibtGrund(ok)).toBeNull();
    expect(U.bleibtGrund({ ...ok, abgesagt: true })).toBe('abgesagt');
    expect(U.bleibtGrund({ ...ok, art: 'fokus' })).toMatch(/Planung/);
    expect(U.bleibtGrund({ ...ok, bearbeitbar: false })).toMatch(/nicht änderbar/);
    expect(U.bleibtGrund({ ...ok, kalenderSchreibbar: false })).toMatch(/nicht änderbar/);
  });
});

describe('Ausführen', () => {
  it('Route: ohne Bestätigung oder ohne Kalenderwahl passiert nichts (400)', async () => {
    expect((await j(await route.POST(req('POST', 'kevin', { kalender: [KAL] })))).status).toBe(400);
    expect((await j(await route.POST(req('POST', 'kevin', { kalender: [], bestaetigt: true })))).status).toBe(400);
    expect(g.events.size).toBe(0);
    expect(objekteIn('kevin-dieckmann')).toHaveLength(7);
  });
  it('Sicherung zuerst, dann Google → Verweise → iCloud löschen; Gäste/Serie/Block bleiben; Bezug, Meeting, Follow-up und Event zeigen auf den neuen Termin', async () => {
    // Beim ersten Schreiben nach Google muss die Sicherung schon da sein.
    let sicherungVorErstemPost: string[] | null = null;
    const wie = g.handle;
    g.handle = async (u, i) => { if (sicherungVorErstemPost === null && (i?.method ?? 'GET') === 'POST' && /\/events(\?|$)/.test(u)) { db.leseCacheLeeren(); sicherungVorErstemPost = Object.keys((await db.loadJson<{ eintraege: Record<string, unknown> }>('kalender-umzug-sicherung--kevin'))?.eintraege ?? {}); } return wie(u, i); };
    const r = await j(await route.POST(req('POST', 'kevin', { kalender: [KAL], bestaetigt: true })));
    expect(r).toMatchObject({ status: 200, d: { ok: true, umgezogen: 3, fehler: [] } });
    expect((sicherungVorErstemPost as string[] | null)?.sort()).toEqual([KEY('UID-ANNA-0001'), KEY('UID-PLAIN-0002'), KEY('makeos-event-ev-0007')].sort());
    const sich = await db.loadJson<{ eintraege: Record<string, { ics: string }> }>('kalender-umzug-sicherung--kevin');
    expect(sich!.eintraege[KEY('UID-ANNA-0001')].ics).toContain('SUMMARY:Kennenlernen Anna');
    // iCloud: nur noch Serie, Gast, Block, Gestern.
    expect(objekteIn('kevin-dieckmann').sort()).toEqual(['UID-ALT-0006', 'UID-BLOCK-0005', 'UID-GAST-0004', 'UID-SERIE-0003']);
    // Google: drei Termine mit Inhalt, Erinnerung, Ort — und unserer Kennung.
    const evs = [...g.events.values()];
    expect(evs.map(e => e.summary).sort()).toEqual(['Kennenlernen Anna', 'Messe Nord', 'Strategie-Runde']);
    const anna = evs.find(e => e.summary === 'Kennenlernen Anna')!;
    expect(anna).toMatchObject({ location: 'Büro', description: 'Agenda', start: { dateTime: `${TAG}T10:00:00`, timeZone: 'Europe/Berlin' }, reminders: { overrides: [{ method: 'popup', minutes: 15 }] } });
    const { neueUidFuer } = U;
    const neuAnna = neueUidFuer(KEY('UID-ANNA-0001'));
    expect((anna.extendedProperties as { private: { makeOsId: string } }).private.makeOsId).toBe(neuAnna);
    // Verweise.
    const bez = (await db.loadJson<{ bezuege: Record<string, { kontaktId?: string; eventId?: string; von?: string }> }>('kalender-bezug'))!.bezuege;
    expect(bez[KEY('UID-ANNA-0001')]).toBeUndefined();
    expect(bez[`google-kevin|${neuAnna}`]).toMatchObject({ kontaktId: 'c-anna1', von: 'kevin' });
    expect(bez[`google-kevin|${neueUidFuer(KEY('makeos-event-ev-0007'))}`]).toMatchObject({ eventId: 'ev-0007' });
    const k = (await db.loadJson<{ kontakte: { aktivitaeten: { terminUid?: string }[] }[] }>('kontakte'))!.kontakte[0];
    expect(k.aktivitaeten[0].terminUid).toBe(`google-kevin|${neuAnna}`);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(crm.followups?.[0].terminUid).toBe(`google-kevin|${neuAnna}`);
    expect(crm.events?.[0].kalenderUid).toBe(neueUidFuer(KEY('makeos-event-ev-0007')));
    // Und im Stand sieht man sie jetzt in Google, nicht mehr in iCloud.
    const t = I.termineImZeitraum(await I.ladeStand(), '2026-10-05', '2026-10-12');
    expect(t.filter(x => x.titel === 'Kennenlernen Anna').map(x => x.kalender)).toEqual(['MAKE Kevin (Google)']);
  });
  it('idempotent: zweiter Lauf zieht nichts mehr um; ein Abbruch beim iCloud-Löschen lässt den Termin NIE verschwinden und legt in Google NIE doppelt an', async () => {
    const wie = ic.handle;
    let n = 0;
    ic.handle = async (u, i) => { if ((i?.method ?? '') === 'DELETE' && ++n === 1) return new Response('', { status: 500 }); return wie(u, i); };
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => (await ic.handle(String(u), i)) ?? g.handle(String(u), i)));
    const r1 = await U.umzugAusfuehren('kevin', { kalender: [KAL] }, WER);
    expect(r1.umgezogen).toBe(2);
    expect(r1.fehler).toHaveLength(1);
    expect(g.events.size).toBe(3); // alle drei in Google …
    expect(objekteIn('kevin-dieckmann').length).toBe(5); // … und einer noch in iCloud (nie weg)
    const r2 = await U.umzugAusfuehren('kevin', { kalender: [KAL] }, WER);
    expect(r2).toMatchObject({ umgezogen: 1, schonDa: 1, fehler: [] });
    expect(g.events.size).toBe(3); // kein Duplikat
    expect(objekteIn('kevin-dieckmann').length).toBe(4);
    const r3 = await U.umzugAusfuehren('kevin', { kalender: [KAL] }, WER);
    expect(r3.umgezogen).toBe(0);
  });
  it('Protokoll: Schlüssel, nie Titel; Sicherung wird nach 30 Tagen aufgeräumt', async () => {
    await U.umzugAusfuehren('kevin', { kalender: [KAL] }, WER);
    const alle = readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll--'));
    const text = (await Promise.all(alle.map(async f => JSON.stringify(await db.loadJson(f.replace(/\.json$/, '')))))).join('');
    expect(text).toContain('umzug');
    expect(text).not.toMatch(/Kennenlernen|Strategie|Messe Nord/);
    expect(await U.sicherungAufraeumen('kevin', Date.now())).toBe(0);
    expect(await U.sicherungAufraeumen('kevin', Date.now() + 31 * 86_400_000)).toBe(3);
    expect(Object.keys((await db.loadJson<{ eintraege: object }>('kalender-umzug-sicherung--kevin'))!.eintraege)).toEqual([]);
  });
});

describe('Grenzen', () => {
  it('Malin sieht und zieht nur EIGENE iCloud-Kalender um — Kevins Kalender „Kevin Dieckmann“ ist für sie nicht wählbar; ohne eigenes Google nichts', async () => {
    const v = await j(await route.GET(req('GET', 'malin', undefined, `?kalender=${encodeURIComponent(KAL)}`)));
    expect(v.d.quellen.map((q: { name: string }) => q.name)).toEqual(['Privat Malin']);
    expect(v.d.umzieht).toEqual([]);
    expect(v.d.ziel).toBeNull();
    const p = await j(await route.POST(req('POST', 'malin', { kalender: [KAL], bestaetigt: true })));
    expect(p.status).toBe(409);
    expect(g.events.size).toBe(0);
    expect(objekteIn('kevin-dieckmann')).toHaveLength(7);
  });
  it('der Dienstweg (ZOE, Takt, Skripte) zieht nie um: 403', async () => {
    const r = await route.POST(new Request('http://localhost/api/kalender/google/umzug', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }, body: JSON.stringify({ kalender: [KAL], bestaetigt: true }) }));
    expect(r.status).toBe(403);
    expect(g.events.size).toBe(0);
  });
  it('ohne Google-Verbindung: Vorschau sagt es, Ausführen scheitert sauber, nichts wird gelöscht', async () => {
    await V.googleTrennen('kevin'); await S.leereGoogleStand('kevin');
    const v = await U.umzugVorschau('kevin', { kalender: [KAL] });
    expect(v.ziel).toBeNull();
    expect(v.hinweis).toMatch(/verbunden/);
    await expect(U.umzugAusfuehren('kevin', { kalender: [KAL] }, WER)).rejects.toThrow(/Google Kalender/);
    expect(objekteIn('kevin-dieckmann')).toHaveLength(7);
  });
});
