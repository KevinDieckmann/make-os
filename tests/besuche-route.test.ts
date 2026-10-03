// ─── Besuchte Events — Server: Schreibweg, „Heute bei“ mit „für wen“, An Kunden übergeben (03.10.) ───
// Echter Datenordner (temporär), erfundene Personen (@example.invalid), kein Kalender (nur Kennung-Pfade ohne Termin).
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-besuche-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-besuche';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Kontakt = import('@/lib/make-one/crm').Kontakt;
type Mod = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let netz: Mod, events: Mod, bestand: Mod;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
const kopf = (u: string) => ({ 'content-type': 'application/json', 'x-make-user': u });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const post = (url: string, body: unknown, h: Record<string, string>) => new Request(`http://test${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
const netzSenden = async (body: unknown, user = 'kevin') => { const r = await netz.POST!(post('/api/netzwerken', body, kopf(user))); return { status: r.status, d: await r.json() as Record<string, unknown> & { ok: boolean; fehler?: string } }; };
const eventsPost = async (body: unknown, h: Record<string, string>) => { const r = await events.POST!(post('/api/crm/events', body, h)); return { status: r.status, r, d: await r.json() as Record<string, unknown> & { ok: boolean; fehler?: string; csv?: string; anzahl?: number; ausgelassen?: { gesperrt: number; fehlend: number } } }; };
const erfassung = (x: Record<string, unknown> = {}) => ({
  erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-besuch-1',
  kontakt: { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH', position: 'Geschäftsführerin', email: 'anna.beispiel@example.invalid', telefon: '+49 30 1234567' },
  bilder: [{ name: 'vorderseite.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x,
});
const crm = () => speicher.ladeCrm();
const kontakt = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Muster', email: `${id}@example.invalid`, eignung: '', prio: '', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-09-20', ...x } as unknown as Kontakt);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  netz = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
  events = (await import('@/app/api/crm/events/route')) as unknown as Mod;
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T09:00:00+02:00')); // Freitag, 09:00 Berlin
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nicht gefunden', { status: 404 })));
  const k = (id: string, speicherName: string, rolle: string, haushalt: string) => ({ id, speicher: speicherName, email: `${speicherName}@test`, name: speicherName, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus'), k('k3', 'fremd', 'mitglied', 'anderer-haus')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    firmen: [{ id: 'f-kunde1', name: 'Kundenwerk GmbH', rolle: 'kunde', geaendert: '2026-09-01' }],
    events: [
      { id: 'ev-besuch-1', titel: 'Mittelstandstag Beispielstadt', format: 'sonstig', ziel: '', datum: '2026-10-02', status: 'geplant', anmeldung: 'angemeldet', marke: 'Netzwerken', geaendert: '2026-09-01' },
      { id: 'ev-eigen-1', titel: 'Stammtisch Beispielstadt', format: 'stammtisch', ziel: 'Gespräche', datum: '2026-10-02', status: 'geplant', geaendert: '2026-09-01' },
    ],
  });
  for (const n of ['crm-dateien--test-haus', 'netzwerken-erfassungen--test-haus', 'meldungen--malin', 'meldungen--kevin', 'kalender-bezug', 'tasks', 'absichten--test-haus']) {
    await db.saveJson(n, n.startsWith('crm-dateien') || n.startsWith('netzwerken') ? { eintraege: [] } : n.startsWith('meldungen') ? { eintraege: [], einstellungen: { telegram: false } } : n === 'tasks' ? { projects: [], tasks: [] } : n === 'kalender-bezug' ? { bezuege: {} } : { absichten: [] });
  }
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Schreibweg: die neuen Felder über PATCH /api/crm/bestand', () => {
  it('Event anlegen und teilweise ändern — für wen, wer, Link, Zielpersonen überleben, Altes bleibt', async () => {
    const patch = (ops: unknown[]) => bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops }) }));
    const neu = { id: 'ev-neu', titel: 'Kongress Beispielstadt', format: 'sonstig', ziel: 'Drei Gespräche', datum: '2026-11-12', status: 'geplant', marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde1' }, wer: ['kevin', 'malin'], link: 'https://beispiel.example/kongress', zielpersonen: [{ firmaId: 'f-kunde1' }] };
    expect((await patch([{ liste: 'events', op: 'upsert', eintrag: neu }])).status).toBe(200);
    const r = await patch([{ liste: 'events', op: 'teil', id: 'ev-neu', felder: { anmeldung: 'angemeldet', kostenEuro: 450 } }]);
    expect(r.status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-neu')!;
    expect(e).toMatchObject({ fuer: { art: 'kunde', firmaId: 'f-kunde1' }, wer: ['kevin', 'malin'], link: 'https://beispiel.example/kongress', zielpersonen: [{ firmaId: 'f-kunde1' }], anmeldung: 'angemeldet', kostenEuro: 450, titel: 'Kongress Beispielstadt' });
  });
  it('Kunde mit ungültiger Firmenkennung und ein Link mit javascript: werden nicht gespeichert', async () => {
    const r = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'events', op: 'teil', id: 'ev-besuch-1', felder: { fuer: { art: 'kunde', firmaId: 'kaputt' }, link: 'javascript:alert(1)' } }] }) }));
    expect(r.status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-besuch-1')!;
    expect(e.fuer).toBeUndefined();
    expect(e.link).toBeUndefined();
  });
});

describe('„Heute bei“ → Erfassen: für wen und Anmeldestand', () => {
  it('ein ohne Netz angelegtes Event kommt mit „für wen“ auf den Server (eventNeu.fuer)', async () => {
    const r = await netzSenden(erfassung({ eventId: 'ev-offline', eventNeu: { titel: 'Unterwegs-Event', datum: '2026-10-02', fuer: { art: 'kunde', firmaId: 'f-kunde1' } } }));
    expect(r.status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-offline')!;
    expect(e).toMatchObject({ marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde1' }, status: 'durchgefuehrt' });
  });
  it('ein ungültiges „für wen“ im Körper fällt weg — das Event entsteht trotzdem, für MAKE selbst', async () => {
    const r = await netzSenden(erfassung({ eventId: 'ev-offline2', eventNeu: { titel: 'Noch ein Event', datum: '2026-10-02', fuer: { art: 'kunde', firmaId: '<x>' } } }));
    expect(r.status).toBe(200);
    expect((await crm()).events.find(x => x.id === 'ev-offline2')!.fuer).toBeUndefined();
  });
  it('wer bei einem „angemeldeten“ Event von heute erfasst, hat es besucht: Anmeldestand und Status ziehen mit', async () => {
    expect((await netzSenden(erfassung())).status).toBe(200);
    expect((await crm()).events.find(x => x.id === 'ev-besuch-1')).toMatchObject({ status: 'durchgefuehrt', anmeldung: 'besucht' });
  });
  it('unsere eigenen Abende bekommen dabei keinen Anmeldestand (altes Bild bleibt, nichts Neues am Altbestand)', async () => {
    expect((await netzSenden(erfassung({ eventId: 'ev-eigen-1' }))).status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-eigen-1')!;
    expect(e.status).toBe('durchgefuehrt');
    expect('anmeldung' in e).toBe(false);
  });
});

describe('An Kunden übergeben (POST /api/crm/events { aktion: kunden-uebergabe })', () => {
  const vorbereiten = async (fuer?: unknown) => {
    await db.saveJson('kontakte', { kontakte: [
      kontakt('anna', { firma: 'Beispielwerk GmbH', notiz: 'GEHEIM' }),
      kontakt('berta', { eingeschraenkt: { seit: '2026-09-25', grund: 'Antrag', von: 'kevin' } }),
    ] });
    await db.saveJson('crm', { ...(await crm()), events: [
      { id: 'ev-k', titel: 'Messe für den Kunden', format: 'messe', ziel: '', datum: '2026-10-01', status: 'durchgefuehrt', marke: 'Netzwerken', ...(fuer ? { fuer } : {}), geaendert: '2026-09-01' },
    ], teilnahmen: [
      { id: 't-anna', eventId: 'ev-k', kontaktId: 'c-anna', status: 'da', geaendert: '2026-10-01', netzwerken: { erfassungId: 'e1', schritt: 'nur-kontakt', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-01T15:00:00.000Z', info: 'GESPRÄCHSINHALT' } },
      { id: 't-berta', eventId: 'ev-k', kontaktId: 'c-berta', status: 'da', geaendert: '2026-10-01', netzwerken: { erfassungId: 'e2', schritt: 'nur-kontakt', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-01T15:05:00.000Z' } },
    ] });
  };
  const kunde = { art: 'kunde', firmaId: 'f-kunde1' };

  it('liefert die CSV (ohne die eingeschränkte Person, ohne Gesprächsinhalt), zählt das Ausgelassene und protokolliert die Übergabe — jedes Mal', async () => {
    await vorbereiten(kunde);
    const a = await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('kevin'));
    expect(a.status).toBe(200);
    expect(a.d).toMatchObject({ ok: true, anzahl: 1, ausgelassen: { gesperrt: 1, fehlend: 0 } });
    expect(a.d.csv).toContain('anna@example.invalid');
    expect(a.d.csv).not.toContain('berta@example.invalid');
    expect(a.d.csv).not.toContain('GEHEIM');
    expect(a.d.csv).not.toContain('GESPRÄCHSINHALT');
    expect(a.r.headers.get('cache-control')).toBe('no-store');
    await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('malin'));
    const e = (await crm()).events.find(x => x.id === 'ev-k')!;
    expect(e.uebergaben).toEqual([{ am: expect.any(String), von: 'kevin', anzahl: 1 }, { am: expect.any(String), von: 'malin', anzahl: 1 }]);
    // Das Protokoll trägt keine Kontakte.
    expect(JSON.stringify(e.uebergaben)).not.toContain('anna');
  });
  it('nur bei einem besuchten Event für einen Kunden — für MAKE selbst und bei unseren Abenden 400', async () => {
    await vorbereiten();
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('kevin'))).status).toBe(400);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-eigen-1' }, kopf('kevin'))).status).toBe(404); // das Event steht in diesem Test nicht mehr im Bestand
    await db.saveJson('crm', { ...(await crm()), events: [{ id: 'ev-m', titel: 'Abend', format: 'stammtisch', ziel: 'x', datum: '2026-10-01', status: 'durchgefuehrt', fuer: kunde, geaendert: '2026-09-01' }] });
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-m' }, kopf('kevin'))).status).toBe(400);
  });
  it('Personendaten gehen nie über den Dienstweg und nie an fremde Haushalte', async () => {
    await vorbereiten(kunde);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, dienst('kevin'))).status).toBe(403);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, dienst())).status).toBe(403);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('fremd'))).status).toBe(403);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, { 'content-type': 'application/json' })).status).toBe(403);
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
  it('ohne exportierbare Kontakte: 400 mit Grund, kein Protokolleintrag', async () => {
    await vorbereiten(kunde);
    await db.saveJson('crm', { ...(await crm()), teilnahmen: (await crm()).teilnahmen.filter(t => t.id === 't-berta') });
    const r = await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('kevin'));
    expect(r.status).toBe(400);
    expect(r.d.fehler).toContain('1 gesperrte Person');
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
});
