// ─── Netzwerken — Recht, Server (03.10., Paket „netz-recht“) ─────────────────────────────────────────
// Erfassen auf einem Kunden-Event (Markierung, Interessenabwägung, neu angelegt), Danke-Mail „ist raus“ (Datenschutzhinweis atomar/wiederholbar),
// „Nicht senden“, Datenschutz-Route, Stammdaten (VVT, Löschliste Netzwerken), Löschfristen-Lauf, Kampagnen-Ampel, Fotos ohne Exif.
// Echter Datenordner (temporär), erfundene Personen (@example.invalid), kein Kalender.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-netzrecht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-netzrecht';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Kontakt = import('@/lib/make-one/crm').Kontakt;
type Mod = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let netz: Mod, events: Mod, datenschutz: Mod, stammdaten: Mod, kampagnen: Mod;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

const bytes = (...teile: number[][]) => Buffer.from(teile.flat());
const seg = (marker: number, text: string) => { const b = Array.from(text).map(c => c.charCodeAt(0)); const n = b.length + 2; return [0xff, marker, n >> 8, n & 255, ...b]; };
const JFIF = seg(0xe0, 'JFIF\u0000\u0001\u0001\u0000\u0000\u0001\u0000\u0001\u0000\u0000');
const SCAN = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9];
const JPEG_MIT_GPS = bytes([0xff, 0xd8], JFIF, seg(0xe1, 'Exif\u0000\u0000GPS-52.52N-13.40E'), SCAN).toString('base64');

const kopf = (u: string) => ({ 'content-type': 'application/json', 'x-make-user': u });
const post = (url: string, body: unknown, h: Record<string, string>) => new Request(`http://test${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
const netzSenden = async (body: unknown, user = 'kevin') => { const r = await netz.POST!(post('/api/netzwerken', body, kopf(user))); return { status: r.status, d: await r.json() as Record<string, unknown> & { ok: boolean; fehler?: string; kontaktId?: string; neu?: boolean } }; };
const erfassung = (x: Record<string, unknown> = {}) => ({
  erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-kunde', kontakt: { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH', position: 'Geschäftsführerin', email: 'anna.beispiel@example.invalid', telefon: '+49 30 1234567' },
  bilder: [], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x,
});
const crm = () => speicher.ladeCrm();
const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);
const kontaktMit = (mail: string) => kontakte().then(l => l.find(k => k.email === mail)!);
const kontaktStamm = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Muster', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-09-20', ...x } as unknown as Kontakt);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  netz = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
  events = (await import('@/app/api/crm/events/route')) as unknown as Mod;
  datenschutz = (await import('@/app/api/crm/datenschutz/route')) as unknown as Mod;
  stammdaten = (await import('@/app/api/crm/stammdaten/route')) as unknown as Mod;
  kampagnen = (await import('@/app/api/crm/kampagnen/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:00:00+02:00')); // Samstag, 09:00 Berlin
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nicht gefunden', { status: 404 })));
  const k = (id: string, speicherName: string, rolle: string, haushalt: string) => ({ id, speicher: speicherName, email: `${speicherName}@test`, name: speicherName, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    firmen: [{ id: 'f-kunde1', name: 'Kundenwerk GmbH', rolle: 'kunde', geaendert: '2026-09-01' }],
    events: [
      { id: 'ev-kunde', titel: 'Messe für den Kunden', format: 'sonstig', ziel: '', datum: '2026-10-03', status: 'geplant', anmeldung: 'angemeldet', marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde1' }, geaendert: '2026-09-01' },
      { id: 'ev-make', titel: 'Messe für uns', format: 'sonstig', ziel: '', datum: '2026-10-03', status: 'geplant', anmeldung: 'angemeldet', marke: 'Netzwerken', geaendert: '2026-09-01' },
    ],
  });
  for (const n of ['crm-dateien--test-haus', 'netzwerken-erfassungen--test-haus', 'meldungen--malin', 'meldungen--kevin', 'kalender-bezug', 'tasks', 'absichten--test-haus']) {
    await db.saveJson(n, n.startsWith('crm-dateien') || n.startsWith('netzwerken') ? { eintraege: [] } : n.startsWith('meldungen') ? { eintraege: [], einstellungen: { telegram: false } } : n === 'tasks' ? { projects: [], tasks: [] } : n === 'kalender-bezug' ? { bezuege: {} } : { absichten: [] });
  }
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Erfassen auf einem Kunden-Event: Markierung, Interessenabwägung, neu angelegt', () => {
  it('neue Person: LIA-Verweis, „kennengelernt für <Kunde>“, Teilnahme „neu angelegt“ + Kartenfoto — und KEINE Einwilligung, keine Sperre', async () => {
    const r = await netzSenden(erfassung({ bilder: [{ name: 'k.jpg', typ: 'image/jpeg', daten: JPEG_MIT_GPS }] }));
    expect(r.status).toBe(200);
    const k = await kontaktMit('anna.beispiel@example.invalid');
    expect(k.rechtsgrundlageNotiz).toBe('LIA-Netzwerken v1');
    expect(k.rechtsgrundlage).toBe('berechtigt');
    expect(k.kennengelerntFuer).toEqual([{ firmaId: 'f-kunde1', eventId: 'ev-kunde', am: '2026-10-03' }]);
    expect(k.einwilligungen ?? []).toEqual([]);          // eine Visitenkarte ist keine Einwilligung
    expect(k.werbesperre).toBeUndefined();               // keine Sperre für die eigene Akquise
    expect(k.datenschutzInformiertAm).toBeUndefined();   // erst die Danke-Mail setzt das
    const t = (await crm()).teilnahmen.find(x => x.kontaktId === k.id)!;
    expect(t.netzwerken).toMatchObject({ neuAngelegt: true, kartenfoto: true });
    expect(t.netzwerken).not.toHaveProperty('keinGespraech');
  });
  it('ein Event für MAKE selbst trägt keine „kennengelernt für“-Markierung, aber die Interessenabwägung', async () => {
    await netzSenden(erfassung({ eventId: 'ev-make' }));
    const k = await kontaktMit('anna.beispiel@example.invalid');
    expect(k.kennengelerntFuer).toBeUndefined();
    expect(k.rechtsgrundlageNotiz).toBe('LIA-Netzwerken v1');
  });
  it('„Diesen nehmen“ (Bestandsperson): sie bekommt die Markierung, aber KEINE Interessenabwägung und die Teilnahme ist nicht „neu angelegt“', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('bestand', { firma: 'Altbestand AG' })] });
    const r = await netzSenden(erfassung({ vorhandenKontaktId: 'c-bestand', kontakt: { nachname: 'Muster', telefon: '+49 30 7654321' } }));
    expect(r.status).toBe(200);
    const k = (await kontakte()).find(x => x.id === 'c-bestand')!;
    expect(k.kennengelerntFuer).toEqual([{ firmaId: 'f-kunde1', eventId: 'ev-kunde', am: '2026-10-03' }]);
    expect(k.rechtsgrundlageNotiz).toBeUndefined();
    const t = (await crm()).teilnahmen.find(x => x.kontaktId === 'c-bestand')!;
    expect(t.netzwerken).not.toHaveProperty('neuAngelegt');
  });
  it('Mail-Zusammenführung (gleiche Adresse): die Erfassung hängt an der Bestandsperson — nicht „neu angelegt“, nie ungefragt im Export', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('anna', { email: 'anna.beispiel@example.invalid', vorname: 'Anna', nachname: 'Beispiel' })] });
    const r = await netzSenden(erfassung());
    expect(r.status).toBe(200);
    expect(r.d.neu).toBe(false);
    const t = (await crm()).teilnahmen.find(x => x.kontaktId === 'c-anna')!;
    expect(t.netzwerken).not.toHaveProperty('neuAngelegt');
    // die Vorschau führt sie als Bestandsperson
    const v = await events.POST!(post('/api/crm/events', { aktion: 'kunden-vorschau', eventId: 'ev-kunde' }, kopf('kevin')));
    const z = ((await v.json()) as { zeilen: { kontaktId: string; neu: boolean }[] }).zeilen;
    expect(z).toEqual([expect.objectContaining({ kontaktId: 'c-anna', neu: false })]);
  });
  it('ohne persönliches Gespräch: „keinGespraech“ an der Teilnahme, Follow-up trägt „Datenschutzhinweis geben“, kein Danke-Eintrag', async () => {
    const r = await netzSenden(erfassung({ gesprochen: false, schritt: 'followup', followup: { faellig: '2026-10-07' } }));
    expect(r.status).toBe(200);
    const c = await crm();
    expect(c.teilnahmen[0].netzwerken).toMatchObject({ keinGespraech: true });
    expect(c.followups![0].text).toMatch(/\(Datenschutzhinweis geben\)/);
  });
  it('Follow-up bei einer Person MIT Mail und Gespräch: kein Datenschutz-Zusatz im Text', async () => {
    await netzSenden(erfassung({ schritt: 'followup', followup: { faellig: '2026-10-07' } }));
    expect((await crm()).followups![0].text).not.toMatch(/Datenschutzhinweis/);
  });
  it('das Foto wird vor dem Ablegen von Exif/GPS befreit', async () => {
    const r = await netzSenden(erfassung({ bilder: [{ name: 'k.jpg', typ: 'image/jpeg', daten: JPEG_MIT_GPS }] }));
    expect(r.status).toBe(200);
    const ablage = await import('@/lib/dateien/ablage');
    const dateien = await ablage.ablageListe('test-haus');
    const bild = dateien.find(x => x.datei?.typ === 'image/jpeg')!;
    const roh = (await ablage.lesen('test-haus', bild.id))!.bytes.toString('latin1');
    expect(roh).not.toMatch(/Exif|GPS/);
    expect(roh).toContain('JFIF');
  });
  it('die Browser-Kartei kann die Server-Felder nicht fälschen (PATCH /api/state/kontakte)', async () => {
    await netzSenden(erfassung());
    const k = await kontaktMit('anna.beispiel@example.invalid');
    const kontakteRoute = (await import('@/app/api/state/kontakte/route')) as unknown as Mod;
    const patch = async (felder: Record<string, unknown>) => { const p = await kontakteRoute.PATCH!(new Request('http://test/api/state/kontakte', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ op: 'teil', id: k.id, felder }] }) })); return p.status; };
    expect(await patch({ rechtsgrundlageNotiz: 'selbst', kennengelerntFuer: [], datenschutzInformiertAm: '2020-01-01' })).toBe(200);
    const nach = (await kontakte()).find(x => x.id === k.id)!;
    expect(nach.rechtsgrundlageNotiz).toBe('LIA-Netzwerken v1');
    expect(nach.kennengelerntFuer).toHaveLength(1);
    expect(nach.datenschutzInformiertAm).toBeUndefined();
    expect(await patch({ rechtsgrundlageNotiz: null, kennengelerntFuer: null, datenschutzInformiertAm: null })).toBe(200);   // auch Leeren geht nicht
    expect((await kontakte()).find(x => x.id === k.id)!.kennengelerntFuer).toHaveLength(1);
  });
});

describe('Danke-Mail „ist raus“: Datenschutzhinweis vermerkt, wiederholbar; „Nicht senden“', () => {
  const dankePost = (body: Record<string, unknown>, user = 'kevin') => netz.POST!(post('/api/netzwerken', body, kopf(user))).then(async r => ({ status: r.status, d: await r.json() as Record<string, unknown> & { ok: boolean; schonDa?: boolean; fehler?: string } }));
  const vorbereiten = async () => { await netzSenden(erfassung()); return (await kontaktMit('anna.beispiel@example.invalid')).id; };

  it('„ist raus“: Teilnahme, Aktivität „Mail“ und datenschutzInformiertAm in einem Zug; Stufe und Wiedervorlage bleiben', async () => {
    const id = await vorbereiten();
    const vorher = (await kontakte()).find(x => x.id === id)!;
    const r = await dankePost({ aktion: 'danke-raus', eventId: 'ev-kunde', kontaktId: id });
    expect(r.status).toBe(200);
    const k = (await kontakte()).find(x => x.id === id)!;
    expect(k.datenschutzInformiertAm).toBe('2026-10-03');
    expect((k.aktivitaeten ?? []).filter(a => a.art === 'mail' && (a.text ?? '').startsWith('Danke-Mail nach'))).toHaveLength(1);
    expect(k.stufe).toBe(vorher.stufe);
    expect((await crm()).teilnahmen[0].netzwerken!.danke!.rausAm).toBe('2026-10-03');
  });
  it('Retry nach Abbruch: ist die Teilnahme schon „raus“, aber die Kartei noch nicht nachgezogen, holt der nächste Klick den zweiten Teil nach — nie doppelt', async () => {
    const id = await vorbereiten();
    // Zustand nach einem Abbruch zwischen CRM und Kartei: rausAm steht, die Kartei nicht.
    await speicher.aendereCrm(b => ({ ...b, teilnahmen: b.teilnahmen.map(t => ({ ...t, netzwerken: { ...t.netzwerken!, danke: { rausAm: '2026-10-03' } } })) }));
    expect((await kontakte()).find(x => x.id === id)!.datenschutzInformiertAm).toBeUndefined();
    const r = await dankePost({ aktion: 'danke-raus', eventId: 'ev-kunde', kontaktId: id });
    expect(r.d).toMatchObject({ ok: true, schonDa: true });
    const k = (await kontakte()).find(x => x.id === id)!;
    expect(k.datenschutzInformiertAm).toBe('2026-10-03');
    expect((k.aktivitaeten ?? []).filter(a => a.art === 'mail' && (a.text ?? '').startsWith('Danke-Mail nach'))).toHaveLength(1);
    await dankePost({ aktion: 'danke-raus', eventId: 'ev-kunde', kontaktId: id });
    expect(((await kontakte()).find(x => x.id === id)!.aktivitaeten ?? []).filter(a => a.art === 'mail' && (a.text ?? '').startsWith('Danke-Mail nach'))).toHaveLength(1);
  });
  it('nur wer die Person kennengelernt hat; Art. 18 bekommt keinen Vermerk', async () => {
    const id = await vorbereiten();
    expect((await dankePost({ aktion: 'danke-raus', eventId: 'ev-kunde', kontaktId: id }, 'malin')).status).toBe(403);
    expect((await dankePost({ aktion: 'danke-verzicht', eventId: 'ev-kunde', kontaktId: id }, 'malin')).status).toBe(403);
  });
  it('„Nicht senden“: Verzicht-Tag an der Teilnahme, KEIN nachgefasst, kein Datenschutzvermerk; wiederholbar; „ist raus“ hebt den Verzicht auf', async () => {
    const id = await vorbereiten();
    const r = await dankePost({ aktion: 'danke-verzicht', eventId: 'ev-kunde', kontaktId: id });
    expect(r.status).toBe(200);
    let t = (await crm()).teilnahmen[0];
    expect(t.netzwerken!.danke).toMatchObject({ verzichtetAm: '2026-10-03' });
    expect(t.followUpAm).toBeUndefined();               // die Kennzahl bleibt ehrlich
    expect((await kontakte()).find(x => x.id === id)!.datenschutzInformiertAm).toBeUndefined();
    expect((await dankePost({ aktion: 'danke-verzicht', eventId: 'ev-kunde', kontaktId: id })).d.schonDa).toBe(true);
    await dankePost({ aktion: 'danke-raus', eventId: 'ev-kunde', kontaktId: id });
    t = (await crm()).teilnahmen[0];
    expect(t.netzwerken!.danke).toMatchObject({ rausAm: '2026-10-03' });
    expect(t.netzwerken!.danke).not.toHaveProperty('verzichtetAm');
  });
  it('ungültige Kennungen und der Dienstweg → 400/403', async () => {
    expect((await dankePost({ aktion: 'danke-verzicht', eventId: 'x', kontaktId: 'y' })).status).toBe(400);
    const r = await netz.POST!(post('/api/netzwerken', { aktion: 'danke-verzicht', eventId: 'ev-kunde', kontaktId: 'c-abcd1' }, { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }));
    expect(r.status).toBe(403);
  });
});

describe('Datenschutz-Route: Datenschutzhinweis persönlich erteilt', () => {
  it('setzt den Tag (nur einmal) und hinterlässt eine Aktivität; eingeschränkte Personen nicht', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('anna'), kontaktStamm('berta', { eingeschraenkt: { seit: '2026-09-25', grund: 'x', von: 'kevin' } })] });
    const ds = (body: unknown) => datenschutz.POST!(post('/api/crm/datenschutz', body, kopf('kevin'))).then(async r => ({ status: r.status, d: await r.json() }));
    expect((await ds({ aktion: 'datenschutz-informiert', id: 'c-anna' })).status).toBe(200);
    const a = (await kontakte()).find(x => x.id === 'c-anna')!;
    expect(a.datenschutzInformiertAm).toBe('2026-10-03');
    expect(a.aktivitaeten!.some(x => (x.text ?? '').includes('Datenschutzhinweis (Art. 13) persönlich gegeben'))).toBe(true);
    await ds({ aktion: 'datenschutz-informiert', id: 'c-anna' });
    expect((await kontakte()).find(x => x.id === 'c-anna')!.aktivitaeten!.filter(x => (x.text ?? '').includes('Datenschutzhinweis'))).toHaveLength(1);
    expect((await ds({ aktion: 'datenschutz-informiert', id: 'c-berta' })).status).toBe(409);
    expect((await kontakte()).find(x => x.id === 'c-berta')!.datenschutzInformiertAm).toBeUndefined();
  });
});

describe('Stammdaten: Verzeichnis (VVT) und Löschliste', () => {
  it('der Aufruf trägt die drei Netzwerken-Verarbeitungen idempotent nach — auch bei schon gepflegtem Verzeichnis', async () => {
    const get = async () => { const r = await stammdaten.GET!(new Request('http://test/api/crm/stammdaten', { headers: kopf('kevin') })); return (await r.json()) as { verarbeitungen: { id: string }[]; selbstpruefung: { id: string; status: string }[] }; };
    const a = await get();
    expect(a.verarbeitungen.map(v => v.id)).toEqual(expect.arrayContaining(['vv-kontakte', 'vv-netzwerken', 'vv-besuche-kunde', 'vv-kunden-export']));
    const zahl = a.verarbeitungen.length;
    expect((await get()).verarbeitungen).toHaveLength(zahl);   // zweiter Aufruf: nichts doppelt
    expect(a.selbstpruefung.find(x => x.id === 'verzeichnis')!.status).toBe('erfuellt');
    // Ein vorhandenes, nur mit den alten Einträgen gepflegtes Verzeichnis bekommt die neuen dazu.
    await speicher.aendereCrm(c => ({ ...c, verarbeitungen: c.verarbeitungen.filter(v => !v.id.startsWith('vv-netz') && v.id !== 'vv-besuche-kunde' && v.id !== 'vv-kunden-export') }));
    expect((await get()).verarbeitungen).toHaveLength(zahl);
  });
  it('Personen aus Netzwerken ohne Interaktion seit 12 Monaten stehen in der Liste „über der Frist“ (netzwerken: true), die 24-Monats-Liste bleibt', async () => {
    await db.saveJson('kontakte', { kontakte: [
      kontaktStamm('alt', { labels: ['Netzwerken'], importiertAm: '2025-08-01' }),
      kontaktStamm('uralt', { importiertAm: '2023-01-01' }),
      kontaktStamm('neu', { labels: ['Netzwerken'], importiertAm: '2026-09-20' }),
    ] });
    const r = await stammdaten.GET!(new Request('http://test/api/crm/stammdaten', { headers: kopf('kevin') }));
    const d = (await r.json()) as { speicherbegrenzung: { id: string; netzwerken?: boolean }[]; loeschfristen: { tabelle: { id: string }[] } };
    expect(d.speicherbegrenzung.map(x => [x.id, x.netzwerken ?? false])).toEqual([['c-uralt', false], ['c-alt', true]]);
    expect(d.loeschfristen.tabelle.map(f => f.id)).toEqual(expect.arrayContaining(['netzwerken-karten', 'netzwerken-sprachnotizen', 'netzwerken-kontakte', 'netzwerken-info', 'uebergabe-protokolle']));
  });
});

describe('Löschfristen-Lauf: Medien, Info, Protokolle, Prüf-Aufgabe', () => {
  const lauf = async () => (await import('@/lib/crm/loeschfristen-lauf')).loeschfristenLauf(new Date('2027-04-10T08:00:00.000Z'), true);
  it('Kartenfoto nach 6 Monaten, Sprachnotiz nach 90 Tagen — Belege und fremde Dateien bleiben', async () => {
    const ablage = await import('@/lib/dateien/ablage');
    const mkMedium = (titel: string, notiz: string, am: string) => ablage.ablegen('test-haus', 'kevin', { art: 'sonstig', titel, kontaktId: 'c-anna', notiz }, { bytes: Buffer.from(bytes([0xff, 0xd8], JFIF, SCAN)), name: 'x.jpg', typ: 'image/jpeg' }, am);
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('anna')] });
    const foto = await mkMedium('Visitenkarte 1/1 · 3f2b9c1e', 'Netzwerken bei „Messe“', '2026-09-01T10:00:00.000Z');       // 7 Monate alt
    const fotoJung = await mkMedium('Visitenkarte 1/1 · 4a2b9c1e', 'Netzwerken bei „Messe“', '2026-12-01T10:00:00.000Z');  // 4 Monate
    const fremd = await mkMedium('Vertrag Anna', 'meine Datei', '2026-01-01T10:00:00.000Z');
    const r = await lauf();
    expect(r.bereinigt['netzwerken-kartenfotos']).toBe(1);
    const ids = (await ablage.ablageListe('test-haus')).map(x => x.id);
    expect(ids).not.toContain(foto.id);
    expect(ids).toEqual(expect.arrayContaining([fotoJung.id, fremd.id]));
  });
  it('Sprachnotiz: 90 Tage', async () => {
    const ablage = await import('@/lib/dateien/ablage');
    const mk = (am: string, marke: string) => ablage.ablegen('test-haus', 'kevin', { art: 'sonstig', titel: `Sprachnotiz · ${marke}`, kontaktId: 'c-anna', notiz: 'Sprachnotiz bei „Messe“ — Abschrift folgt (KI)' }, { bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]), name: 'sprachnotiz.webm', typ: 'audio/webm' as never }, am);
    const alt = await mk('2027-01-01T10:00:00.000Z', '3f2b9c1e');     // 99 Tage
    const jung = await mk('2027-02-15T10:00:00.000Z', '4a2b9c1e');    // 54 Tage
    const r = await lauf();
    expect(r.bereinigt['netzwerken-sprachnotizen']).toBe(1);
    const ids = (await ablage.ablageListe('test-haus')).map(x => x.id);
    expect(ids).not.toContain(alt.id);
    expect(ids).toContain(jung.id);
  });
  it('Gesprächs-Info/Zielpersonen 12 Monate nach dem Event; Übergabe-Protokolle 36 Monate (Event und Journal); Zahlen im Ergebnis, Personen unberührt', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('anna')] });
    await db.saveJson('crm', { ...(await crm()), events: [
      { id: 'ev-alt', titel: 'Alte Messe', format: 'messe', ziel: '', datum: '2026-03-01', status: 'durchgefuehrt', marke: 'Netzwerken', zielpersonen: [{ kontaktId: 'c-anna' }, { firmaId: 'f-kunde1' }], geaendert: '2026-03-01',
        uebergaben: [{ am: '2023-01-01T08:00:00.000Z', von: 'kevin', anzahl: 1 }, { am: '2026-03-02T08:00:00.000Z', von: 'kevin', anzahl: 1 }] },
    ], teilnahmen: [{ id: 't-1', eventId: 'ev-alt', kontaktId: 'c-anna', status: 'da', geaendert: '2026-03-01', notiz: 'Studie', netzwerken: { erfassungId: randomUUID(), schritt: 'followup', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-03-01T10:00:00.000Z', info: 'Studie' } }] });
    await db.saveJson('uebergabe-journal--test-haus', { eintraege: [
      { eventId: 'ev-weg', eventTitel: 'Weg', eventDatum: '2022-01-01', am: '2022-01-02T08:00:00.000Z', von: 'kevin', anzahl: 1, verschobenAm: '2022-02-01T00:00:00.000Z', grund: 'event-geloescht' },
      { eventId: 'ev-weg2', eventTitel: 'Weg 2', eventDatum: '2026-01-01', am: '2026-01-02T08:00:00.000Z', von: 'kevin', anzahl: 1, verschobenAm: '2026-02-01T00:00:00.000Z', grund: 'event-geloescht' },
    ] });
    const r = await lauf();
    expect(r.bereinigt).toMatchObject({ 'netzwerken-info': 1, 'netzwerken-zielpersonen': 1, 'uebergabe-protokolle': 1, 'uebergabe-journal': 1 });
    const c = await crm();
    expect(c.teilnahmen[0].netzwerken).not.toHaveProperty('info');
    expect(c.teilnahmen[0].notiz).toBeUndefined();
    expect(c.events[0].zielpersonen).toEqual([{ firmaId: 'f-kunde1' }]);
    expect(c.events[0].uebergaben).toHaveLength(1);
    expect(((await db.loadJson<{ eintraege: { eventId: string }[] }>('uebergabe-journal--test-haus'))!.eintraege).map(e => e.eventId)).toEqual(['ev-weg2']);
    expect((await kontakte()).map(k => k.id)).toEqual(['c-anna']);  // Personen werden nie angefasst
  });
  it('Netzwerken-Kontakte ohne Interaktion seit 12 Monaten → EINE Prüf-Aufgabe (mit der Zahl, ohne Namen), nie gelöscht', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('anna', { labels: ['Netzwerken'], importiertAm: '2025-08-01' }), kontaktStamm('berta', { labels: ['Netzwerken'], importiertAm: '2026-09-01' })] });
    const r = await lauf();
    expect(r.aufgabe).toBe('neu');
    expect(r.text).toMatch(/\+ 1 aus Netzwerken ohne Interaktion/);
    const aufgabe = ((await db.loadJson<{ tasks: { id: string; title: string; description?: string }[] }>('tasks'))!.tasks).find(t => t.id === 'loeschfrist-kontakte')!;
    expect(aufgabe.title).toBe('0 Kontakte (+ 1 aus Netzwerken ohne Interaktion seit 12 Monaten) über der Löschfrist — prüfen: löschen oder begründen');
    expect(JSON.stringify(aufgabe)).not.toMatch(/anna|berta|Muster/);
    expect((await kontakte()).map(k => k.id).sort()).toEqual(['c-anna', 'c-berta']);
  });
});

describe('Kampagnen: werblicher Kanal lehnt rote Ampel ab', () => {
  const planen = async (playbook: string) => { const r = await kampagnen.POST!(post('/api/crm/kampagnen', { aktion: 'planen', playbook }, kopf('kevin'))); return { status: r.status, d: await r.json() as { ok: boolean; kampagne: { kanal: string; kontaktIds: string[] }; text: string; abgelehnt?: number } }; };
  it('„planen“ mit dem LinkedIn-Playbook: Kaltkontakte und Personen ohne Profil (rot) kommen nicht hinein, bekannte (gelb) mit Hinweis', async () => {
    await db.saveJson('kontakte', { kontakte: [
      kontaktStamm('kalt', { prio: 'A', linkedin: 'https://linkedin.example/in/kalt' }),
      kontaktStamm('bekannt', { prio: 'A', kreis: 'A', linkedin: 'https://linkedin.example/in/bekannt' }),
      kontaktStamm('ohnelink', { prio: 'A' }),
    ] });
    const r = await planen('vernetzen');
    expect(r.status).toBe(200);
    expect(r.d.kampagne.kanal).toBe('linkedin');
    expect(r.d.kampagne.kontaktIds).toEqual(['c-bekannt']);
    expect(r.d.abgelehnt).toBe(2);
    expect(r.d.text).toMatch(/2 Personen mit roter Ampel für LinkedIn wurden nicht aufgenommen/);
    expect(r.d.text).toMatch(/Eine Person hat eine gelbe Ampel — nur persönlich oder nach Klärung, keine Werbung ohne Einwilligung/);
    expect(r.d.text).not.toMatch(/kalt|ohnelink|Muster/);
    expect((await crm()).kampagnen[0].kontaktIds).toEqual(['c-bekannt']);
  });
  it('persönlicher Kanal: unverändert — die ganze Zielgruppe, ohne Ampel-Text', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('a1', { kreis: 'A' }), kontaktStamm('b2', { kreis: 'C', email: undefined })] });
    const r = await planen('newsletter');
    expect(r.status).toBe(200);
    expect(r.d.kampagne.kanal).toBe('persoenlich');
    expect(r.d.kampagne.kontaktIds.sort()).toEqual(['c-a1', 'c-b2']);
    expect(r.d.abgelehnt).toBeUndefined();
    expect(r.d.text).not.toMatch(/Ampel/);
  });
  it('der generische Weg (PATCH /api/crm/bestand): rote Personen in einer Mail-Kampagne → 409 ohne Namen; gelbe → 200 mit Hinweis', async () => {
    await db.saveJson('kontakte', { kontakte: [kontaktStamm('kalt'), kontaktStamm('bekannt', { kreis: 'A' })] });
    const bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Mod;
    const patch = (kontaktIds: string[]) => bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'kampagnen', op: 'upsert', eintrag: { id: 'kp-test1', name: 'Herbstmail', kanal: 'mail', status: 'entwurf', kontaktIds } }] }) }));
    const rot = await patch(['c-kalt']);
    expect(rot.status).toBe(409);
    const t = JSON.stringify(await rot.json());
    expect(t).toMatch(/Kampagne „Herbstmail“ \(Mail\): eine Person mit roter Ampel kommt nicht hinein/);
    expect(t).not.toMatch(/c-kalt|kalt@example|Muster/);
    expect((await crm()).kampagnen).toEqual([]);
    const gelb = await patch(['c-bekannt']);
    expect(gelb.status).toBe(200);
    const d = (await gelb.json()) as { hinweise?: string[] };
    expect(d.hinweise?.[0]).toMatch(/Kampagne „Herbstmail“ \(Mail\): eine Person mit gelber Ampel/);
    expect((await crm()).kampagnen[0].kontaktIds).toEqual(['c-bekannt']);
  });
});
