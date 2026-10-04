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

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]).toString('base64'); // strukturell gültig (der Server säubert Metadaten)
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
  it('Ein Link mit javascript: wird mit Text abgelehnt (409), eine ungültige Firmenkennung nicht gespeichert', async () => {
    const r = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'events', op: 'teil', id: 'ev-besuch-1', felder: { fuer: { art: 'kunde', firmaId: 'kaputt' }, link: 'javascript:alert(1)' } }] }) }));
    // Ein unmöglicher Link wird nicht mehr still verworfen: die GANZE Änderung kommt mit Text zurück (409), nichts wird gespeichert (Technik-Prüfung 03.10.).
    expect(r.status).toBe(409);
    expect(JSON.stringify((await r.json()).fehler)).toContain('Link');
    const e = (await crm()).events.find(x => x.id === 'ev-besuch-1')!;
    expect(e.fuer).toBeUndefined();
    expect(e.link).toBeUndefined();
    // Ohne den Link: die ungültige Firmenkennung fällt weiter still weg (Säuberer).
    const r2 = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'events', op: 'teil', id: 'ev-besuch-1', felder: { fuer: { art: 'kunde', firmaId: 'kaputt' } } }] }) }));
    expect(r2.status).toBe(200);
    expect((await crm()).events.find(x => x.id === 'ev-besuch-1')!.fuer).toBeUndefined();
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

describe('An Kunden übergeben (POST /api/crm/events { aktion: kunden-vorschau | kunden-uebergabe }) — Übermittlung (netz-recht)', () => {
  const nwAngabe = (id: string, x: Record<string, unknown> = {}) => ({ erfassungId: id, schritt: 'nur-kontakt', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-01T15:00:00.000Z', ...x });
  const vorbereiten = async (fuer?: unknown) => {
    await db.saveJson('kontakte', { kontakte: [
      kontakt('anna', { firma: 'Beispielwerk GmbH', notiz: 'GEHEIM' }),
      kontakt('berta', { eingeschraenkt: { seit: '2026-09-25', grund: 'Antrag', von: 'kevin' } }),
      kontakt('emil', { firma: 'Altbestand AG' }),
    ] });
    await db.saveJson('crm', { ...(await crm()), events: [
      { id: 'ev-k', titel: 'Messe für den Kunden', format: 'messe', ziel: '', datum: '2026-10-01', status: 'durchgefuehrt', marke: 'Netzwerken', ...(fuer ? { fuer } : {}), geaendert: '2026-09-01' },
    ], teilnahmen: [
      { id: 't-anna', eventId: 'ev-k', kontaktId: 'c-anna', status: 'da', geaendert: '2026-10-01', netzwerken: nwAngabe('e1', { info: 'GESPRÄCHSINHALT', neuAngelegt: true }) },
      { id: 't-berta', eventId: 'ev-k', kontaktId: 'c-berta', status: 'da', geaendert: '2026-10-01', netzwerken: nwAngabe('e2', { neuAngelegt: true, erfasstAm: '2026-10-01T15:05:00.000Z' }) },
      { id: 't-emil', eventId: 'ev-k', kontaktId: 'c-emil', status: 'da', geaendert: '2026-10-01', netzwerken: nwAngabe('e3', { erfasstAm: '2026-10-01T15:06:00.000Z' }) },
    ] });
  };
  const kunde = { art: 'kunde', firmaId: 'f-kunde1' };
  const uebergabe = (h: Record<string, string>, x: Record<string, unknown> = {}) => eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k', hinweisBestaetigt: true, ...x }, h);

  it('Vorschau: neu angelegt / Bestand / gesperrt, „noch nicht informiert“ — schreibt nichts', async () => {
    await vorbereiten(kunde);
    const r = await eventsPost({ aktion: 'kunden-vorschau', eventId: 'ev-k' }, kopf('kevin'));
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, kunde: { id: 'f-kunde1', name: 'Kundenwerk GmbH' }, fehlend: 0 });
    const z = (r.d as unknown as { zeilen: { kontaktId: string; neu: boolean; informiert: boolean; gesperrt: string | null }[] }).zeilen;
    expect(z.map(x => [x.kontaktId, x.neu, x.informiert, x.gesperrt])).toEqual([['c-anna', true, false, null], ['c-berta', true, false, 'eingeschraenkt'], ['c-emil', false, false, null]]);
    expect(JSON.stringify(r.d)).not.toContain('GEHEIM');
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
  it('liefert die CSV (nur die neu angelegte, nicht die gesperrte, nicht die Bestandsperson), zählt das Ausgelassene und protokolliert mit Empfänger, Datei und Kennungen — jedes Mal', async () => {
    await vorbereiten(kunde);
    const a = await uebergabe(kopf('kevin'));
    expect(a.status).toBe(200);
    expect(a.d).toMatchObject({ ok: true, anzahl: 1, ausgelassen: { gesperrt: 1, fehlend: 0, bestand: 1 } });
    expect(a.d.csv).toContain('anna@example.invalid');
    expect(a.d.csv).not.toContain('berta@example.invalid');
    expect(a.d.csv).not.toContain('emil@example.invalid');
    expect(a.d.csv).not.toContain('GEHEIM');
    expect(a.d.csv).not.toContain('GESPRÄCHSINHALT');
    expect(a.r.headers.get('cache-control')).toBe('no-store');
    await uebergabe(kopf('malin'), { bestandIds: ['c-emil'] });
    const e = (await crm()).events.find(x => x.id === 'ev-k')!;
    expect(e.uebergaben).toEqual([
      { am: expect.any(String), von: 'kevin', anzahl: 1, empfaengerFirmaId: 'f-kunde1', dateiname: 'kontakte-messe-fur-den-kunden-2026-10-01.csv', kontaktIds: ['c-anna'], avvBzwHinweisBestaetigt: true },
      { am: expect.any(String), von: 'malin', anzahl: 2, empfaengerFirmaId: 'f-kunde1', dateiname: 'kontakte-messe-fur-den-kunden-2026-10-01.csv', kontaktIds: ['c-anna', 'c-emil'], avvBzwHinweisBestaetigt: true },
    ]);
    // Das Protokoll trägt Kennungen, nie Namen oder Mails.
    expect(JSON.stringify(e.uebergaben)).not.toContain('anna@');
    expect(JSON.stringify(e.uebergaben)).not.toContain('Muster');
  });
  it('ohne den Haken „Rolle und Vertrag geklärt“ (hinweisBestaetigt) wird nichts übergeben', async () => {
    await vorbereiten(kunde);
    const r = await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-k' }, kopf('kevin'));
    expect(r.status).toBe(400);
    expect(r.d.fehler).toMatch(/Rolle und Vertrag/);
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
  it('bestandIds nur als Kennungen von Personen; Unsinn → 400', async () => {
    await vorbereiten(kunde);
    expect((await uebergabe(kopf('kevin'), { bestandIds: ['kein-kontakt'] })).status).toBe(400);
    expect((await uebergabe(kopf('kevin'), { bestandIds: 'c-emil' as unknown as string[] })).status).toBe(200); // kein Array = keine Haken
  });
  it('nur bei einem besuchten Event für einen Kunden — für MAKE selbst und bei unseren Abenden 400', async () => {
    await vorbereiten();
    expect((await uebergabe(kopf('kevin'))).status).toBe(400);
    expect((await eventsPost({ aktion: 'kunden-vorschau', eventId: 'ev-k' }, kopf('kevin'))).status).toBe(400);
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-eigen-1', hinweisBestaetigt: true }, kopf('kevin'))).status).toBe(404); // das Event steht in diesem Test nicht mehr im Bestand
    await db.saveJson('crm', { ...(await crm()), events: [{ id: 'ev-m', titel: 'Abend', format: 'stammtisch', ziel: 'x', datum: '2026-10-01', status: 'durchgefuehrt', fuer: kunde, geaendert: '2026-09-01' }] });
    expect((await eventsPost({ aktion: 'kunden-uebergabe', eventId: 'ev-m', hinweisBestaetigt: true }, kopf('kevin'))).status).toBe(400);
  });
  it('Personendaten gehen nie über den Dienstweg und nie an fremde Haushalte — auch die Vorschau nicht', async () => {
    await vorbereiten(kunde);
    for (const aktion of ['kunden-uebergabe', 'kunden-vorschau']) {
      expect((await eventsPost({ aktion, eventId: 'ev-k', hinweisBestaetigt: true }, dienst('kevin'))).status).toBe(403);
      expect((await eventsPost({ aktion, eventId: 'ev-k', hinweisBestaetigt: true }, dienst())).status).toBe(403);
      expect((await eventsPost({ aktion, eventId: 'ev-k', hinweisBestaetigt: true }, kopf('fremd'))).status).toBe(403);
      expect((await eventsPost({ aktion, eventId: 'ev-k', hinweisBestaetigt: true }, { 'content-type': 'application/json' })).status).toBe(403);
    }
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
  it('ohne exportierbare Kontakte: 400 mit Grund, kein Protokolleintrag', async () => {
    await vorbereiten(kunde);
    await db.saveJson('crm', { ...(await crm()), teilnahmen: (await crm()).teilnahmen.filter(t => t.id === 't-berta') });
    const r = await uebergabe(kopf('kevin'));
    expect(r.status).toBe(400);
    expect(r.d.fehler).toContain('1 gesperrte Person');
    expect(((await crm()).events.find(x => x.id === 'ev-k')!.uebergaben ?? [])).toEqual([]);
  });
  it('der Browser kann das Protokoll über den generischen Weg weder setzen noch fälschen noch löschen (Alt-Stand gilt)', async () => {
    await vorbereiten(kunde);
    await uebergabe(kopf('kevin'));
    const vorher = (await crm()).events.find(x => x.id === 'ev-k')!.uebergaben;
    expect(vorher).toHaveLength(1);
    const patch = (ops: unknown[]) => bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops }) }));
    // teil: gefälschtes Protokoll
    expect((await patch([{ liste: 'events', op: 'teil', id: 'ev-k', felder: { uebergaben: [{ am: '2020-01-01', von: 'kevin', anzahl: 999 }], titel: 'Messe neu' } }])).status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-k')!;
    expect(e.titel).toBe('Messe neu');
    expect(e.uebergaben).toEqual(vorher);
    // Neues Event: ein vom Browser mitgeschicktes Protokoll fällt weg.
    expect((await patch([{ liste: 'events', op: 'upsert', eintrag: { id: 'ev-neu2', titel: 'Neu', format: 'messe', ziel: 'x', datum: '2026-11-01', status: 'geplant', marke: 'Netzwerken', uebergaben: [{ am: '2026-10-01', von: 'kevin', anzahl: 5 }] } }])).status).toBe(200);
    expect((await crm()).events.find(x => x.id === 'ev-neu2')!.uebergaben).toBeUndefined();
  });
});

describe('Event löschen mit Übergaben (POST /api/crm/events { aktion: loeschen }) — der Nachweis bleibt (Art. 15/19)', () => {
  // Endgültig löschen geht seit 04.10. nur aus dem Papierkorb (lib/crm/ablage.ts) — `imKorb` legt das Event vorher hinein.
  const vorher = async (imKorb = false) => {
    await db.saveJson('kontakte', { kontakte: [kontakt('anna', { firma: 'Beispielwerk GmbH' })] });
    await db.saveJson('crm', { ...(await crm()), events: [
      { id: 'ev-k', titel: 'Messe für den Kunden', format: 'messe', ziel: '', datum: '2026-10-01', status: 'durchgefuehrt', marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde1' }, geaendert: '2026-09-01', ...(imKorb ? { geloeschtAm: '2026-10-03T08:00:00.000Z' } : {}),
        uebergaben: [{ am: '2026-10-02T08:00:00.000Z', von: 'kevin', anzahl: 1, empfaengerFirmaId: 'f-kunde1', dateiname: 'kontakte-x.csv', kontaktIds: ['c-anna'], avvBzwHinweisBestaetigt: true }] },
    ], teilnahmen: [] });
  };
  it('ohne ausdrückliche Bestätigung 409 mit Warnung — nichts gelöscht; auch der generische Weg lehnt ab', async () => {
    await vorher();
    const r = await eventsPost({ aktion: 'loeschen', eventId: 'ev-k' }, kopf('kevin'));
    expect(r.status).toBe(409);
    expect(r.d.fehler).toMatch(/1 Übergabe an Kunden.*Übergabe-Journal/);
    expect((await crm()).events.some(x => x.id === 'ev-k')).toBe(true);
    const g = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'events', op: 'delete', id: 'ev-k' }] }) }));
    expect(g.status).toBe(409);
    expect((await crm()).events.some(x => x.id === 'ev-k')).toBe(true);
  });
  it('mit Bestätigung: das Event ist weg, das Protokoll steht im Übergabe-Journal (Empfänger, Kennungen) und beantwortet Art. 15/17', async () => {
    await vorher(true);
    const r = await eventsPost({ aktion: 'loeschen', eventId: 'ev-k', uebergabenBestaetigt: true }, kopf('kevin'));
    expect(r.status).toBe(200);
    expect((await speicher.ladeCrmMitPapierkorb()).events.some(x => x.id === 'ev-k')).toBe(false);
    const journal = await db.loadJson<{ eintraege: { eventTitel: string; empfaengerName?: string; kontaktIds?: string[]; grund: string }[] }>('uebergabe-journal--test-haus');
    expect(journal?.eintraege).toEqual([expect.objectContaining({ eventTitel: 'Messe für den Kunden', empfaengerName: 'Kundenwerk GmbH', kontaktIds: ['c-anna'], grund: 'event-geloescht' })]);
    const { personAufzaehlen } = await import('@/lib/crm/person-bestaende');
    const a = await personAufzaehlen('c-anna');
    expect(a.uebergaben).toEqual([expect.objectContaining({ empfaenger: 'Kundenwerk GmbH', event: 'Messe für den Kunden', text: 'übergeben am 02.10.2026 an Kundenwerk GmbH (Messe für den Kunden)' })]);
    // Art. 17: der Bericht nennt den Empfänger (Art. 19), das Journal verliert die Kennung der Person.
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    const b = await personEntfernen('c-anna');
    expect(b.uebergaben).toEqual(['Person wurde am 02.10.2026 an Kundenwerk GmbH übergeben (Messe für den Kunden) — dort informieren (Art. 19)']);
    expect(JSON.stringify(await db.loadJson('uebergabe-journal--test-haus'))).not.toContain('c-anna');
  });
  it('Event im PAPIERKORB (DSGVO-Prüfung 04.10.): Art. 15 nennt die Übergabe, Art. 17 tilgt die Kennung auch dort', async () => {
    await vorher(true);
    expect((await crm()).events.some(x => x.id === 'ev-k')).toBe(false); // für alle Leser unsichtbar …
    const { personAufzaehlen, personEntfernen } = await import('@/lib/crm/person-bestaende');
    expect((await personAufzaehlen('c-anna')).uebergaben).toHaveLength(1); // … aber in der Auskunft
    const b = await personEntfernen('c-anna');
    expect(b.uebergaben).toHaveLength(1); // Art. 19-Hinweis auch aus dem Papierkorb
    const roh = await speicher.ladeCrmMitPapierkorb();
    expect(roh.events.find(x => x.id === 'ev-k')!.uebergaben![0]).not.toHaveProperty('kontaktIds');
    expect(JSON.stringify(roh)).not.toContain('c-anna');
  });
  it('Art. 17 bei Protokoll am Event: Kennung fällt aus kontaktIds, Datum/Anzahl/Empfänger bleiben; der Bericht nennt den Empfänger', async () => {
    await vorher();
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    const b = await personEntfernen('c-anna');
    expect(b.uebergaben).toHaveLength(1);
    const u = (await crm()).events.find(x => x.id === 'ev-k')!.uebergaben!;
    expect(u).toEqual([{ am: '2026-10-02T08:00:00.000Z', von: 'kevin', anzahl: 1, empfaengerFirmaId: 'f-kunde1', dateiname: 'kontakte-x.csv', avvBzwHinweisBestaetigt: true }]);
    expect(JSON.stringify(await crm())).not.toContain('c-anna');
  });
});
