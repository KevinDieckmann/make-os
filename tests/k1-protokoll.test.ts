// ─── Paket K1 (28.09.) — Änderungsprotokoll serverseitig, nur anhängend (#44) · Ablehnen statt Kürzen ──
// Eigener Datenordner, erfundene Konten und Daten. Prüft: die Schreibwege (listePatchen, aendereCrm, PUT-Wege)
// schreiben wer/was/wann ohne Inhalte in Monatsdateien; der Browser-POST ist abgeschaltet; nichts wird gekürzt;
// zu große Änderungslisten werden abgelehnt statt still abgeschnitten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k1-protokoll-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k1-protokoll';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PUT?: Handler; PATCH?: Handler };
let kontakte: Route, aenderungen: Route, bestand: Route, stammdaten: Route, kunden: Route;
let db: typeof import('@/lib/store/local-db');
let prot: typeof import('@/lib/store/aenderungsprotokoll');
let speicher: typeof import('@/lib/crm/speicher');

const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-k1' });
const kontakt = (id: string) => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' });
const protokoll = async () => prot.protokollMonat('haus-k1', prot.monatBerlin());

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  prot = await import('@/lib/store/aenderungsprotokoll');
  speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [kontakt('c-anna'), kontakt('c-bert')] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', geaendert: '2026-09-01T10:00:00.000Z' }] });
  kontakte = (await import('@/app/api/state/kontakte/route')) as Route;
  aenderungen = (await import('@/app/api/state/aenderungen/route')) as unknown as Route;
  bestand = (await import('@/app/api/crm/bestand/route')) as Route;
  stammdaten = (await import('@/app/api/state/stammdaten/route')) as Route;
  kunden = (await import('@/app/api/state/kunden/route')) as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Reine Teile', () => {
  it('Monatsdatei je Haushalt, Berliner Monat', () => {
    expect(prot.protokollName('haus-k1', '2026-09')).toBe('aenderungsprotokoll--haus-k1--2026-09');
    // 31.10. 23:30 UTC ist in Berlin schon November.
    expect(prot.monatBerlin(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
    expect(prot.vormonat('2026-01')).toBe('2025-12');
  });
  it('Diff nennt Feldnamen, nie Werte', () => {
    const d = prot.listenDiff([{ id: 'a', x: 1 } as { id: string }, { id: 'b' }], [{ id: 'a', x: 2 } as { id: string }, { id: 'c' }]);
    expect(d).toEqual([{ op: 'geaendert', id: 'a', felder: ['x'] }, { op: 'neu', id: 'c' }, { op: 'geloescht', id: 'b' }]);
  });
  it('wer: Sitzung = Person · Dienstweg mit Person = ZOE · ohne = System', () => {
    expect(prot.werAus(anfrage('/', sitzung('malin')))).toEqual({ art: 'person', person: 'malin' });
    expect(prot.werAus(anfrage('/', dienst('kevin')))).toEqual({ art: 'zoe', person: 'kevin' });
    expect(prot.werAus(anfrage('/', dienst()))).toEqual({ art: 'system' });
    expect(prot.werAus(anfrage('/', { 'x-make-key': 'falsch', 'x-make-person': 'kevin' }))).toEqual({ art: 'system' });
  });
});

describe('Schreibwege protokollieren selbst', () => {
  it('Kartei-PATCH: wer, Bestand, Kennung, Felder — ohne den Wert', async () => {
    const r = await kontakte.PATCH!(anfrage('/api/state/kontakte', sitzung('malin'), 'PATCH', { ops: [{ op: 'teil', id: 'c-anna', felder: { notiz: 'Geheimer Inhalt 4711' } }] }));
    expect(r.status).toBe(200);
    const e = (await protokoll()).filter(x => x.bestand === 'kontakte');
    // Kontakt-Kennungen tragen die E-Mail — im Protokoll nur als Fingerabdruck.
    expect(e.at(-1)).toMatchObject({ wer: 'person', person: 'malin', bestand: 'kontakte', op: 'geaendert', id: prot.protokollKennung('c-anna') });
    expect(prot.protokollKennung('c-anna')).toMatch(/^c#[0-9a-f]{12}$/);
    expect(JSON.stringify(await protokoll())).not.toContain('c-anna');
    expect(e.at(-1)!.felder).toContain('notiz');
    expect(JSON.stringify(await protokoll())).not.toContain('Geheimer Inhalt');
  });
  it('ZOE im Auftrag (Dienstweg + Person) steht als zoe mit Person', async () => {
    await kontakte.PATCH!(anfrage('/api/state/kontakte', dienst('kevin'), 'PATCH', { ops: [{ op: 'teil', id: 'c-bert', felder: { notiz: 'von ZOE' } }] }));
    expect((await protokoll()).at(-1)).toMatchObject({ wer: 'zoe', person: 'kevin', id: prot.protokollKennung('c-bert') });
  });
  it('CRM über aendereCrm (jede Route): Liste, Kennung, Felder', async () => {
    const r = await bestand.PATCH!(anfrage('/api/crm/bestand', sitzung('kevin'), 'PATCH', { ops: [{ liste: 'firmen', op: 'teil', id: 'f-muster', felder: { notiz: 'Wert 999' } }] }));
    expect(r.status).toBe(200);
    const e = (await protokoll()).filter(x => x.bestand === 'crm');
    expect(e).toEqual(expect.arrayContaining([expect.objectContaining({ wer: 'person', person: 'kevin', liste: 'firmen', op: 'geaendert', id: 'f-muster' })]));
    expect(JSON.stringify(e)).not.toContain('Wert 999');
    // Direkter Aufruf ohne Anfrage (Skript/Takt): System.
    await speicher.aendereCrm(c => ({ ...c, firmen: [...c.firmen, { id: 'f-neu', name: 'Neu GmbH', rolle: 'zielkunde', geaendert: '2026-09-02T10:00:00.000Z' }] }) as typeof c);
    expect((await protokoll()).at(-1)).toMatchObject({ wer: 'system', bestand: 'crm', liste: 'firmen', op: 'neu', id: 'f-neu' });
  });
  it('Stammdaten (PATCH, seit 08.10. spät) und PUT-Wege (Kunden) protokollieren ebenfalls', async () => {
    const r = await stammdaten.PATCH!(anfrage('/api/state/stammdaten', sitzung('malin'), 'PATCH', { liste: 'firmen', ops: [{ op: 'upsert', eintrag: { id: 's-1', name: 'X' } }] }));
    expect(r.status).toBe(200);
    expect((await protokoll()).at(-1)).toMatchObject({ wer: 'person', person: 'malin', bestand: 'stammdaten', op: 'neu', id: 's-1' });
    await kunden.PUT!(anfrage('/api/state/kunden', sitzung('kevin'), 'PUT', { kunden: [{ id: 'kd-1', name: 'Beispiel AG', status: 'aktiv' }] }));
    expect((await protokoll()).at(-1)).toMatchObject({ bestand: 'kunden', liste: 'kunden', op: 'neu', id: 'kd-1' });
  });
  it('liegt in einer Monatsdatei des Haushalts', () => {
    expect(readdirSync(ordner)).toContain(`aenderungsprotokoll--haus-k1--${prot.monatBerlin()}.json`);
  });
});

describe('Nur anhängend, nie gekürzt; Browser-POST aus', () => {
  it('POST /api/state/aenderungen → 405, schreibt nichts', async () => {
    const vorher = (await protokoll()).length;
    const r = await aenderungen.POST!(anfrage('/api/state/aenderungen', sitzung('kevin'), 'POST', { bestand: 'finanzplan', art: 'PUT' }));
    expect(r.status).toBe(405);
    expect((await protokoll()).length).toBe(vorher);
    expect(await db.loadJson('aenderungen')).toBeNull();
  });
  it('mehr als 400 Einträge bleiben alle erhalten (vorher: gekürzt auf 400)', async () => {
    const vorher = (await protokoll()).length;
    for (let i = 0; i < 9; i++) await prot.protokolliere('test-bestand', Array.from({ length: 50 }, (_, j) => ({ op: 'neu' as const, id: `t-${i}-${j}` })), { art: 'system' });
    const nachher = await protokoll();
    expect(nachher.length).toBe(vorher + 450);
    expect(nachher.some(e => e.id === 't-0-0')).toBe(true);
  });
  it('GET liest (Haushalt des Inhabers) — neueste zuerst, mit Gesamtzahl', async () => {
    const r = await aenderungen.GET!(anfrage('/api/state/aenderungen?bestand=kontakte', sitzung('malin')));
    expect(r.status).toBe(200);
    const d = await r.json() as { eintraege: { person: string; bestand: string; id: string }[]; anzahl: number };
    expect(d.eintraege[0]).toMatchObject({ bestand: 'kontakte', id: 'c-bert', person: 'ZOE für Kevin' });
    expect(d.anzahl).toBeGreaterThanOrEqual(2);
  });
});

describe('Ablehnen statt still kürzen (Regel „nie abschneiden“)', () => {
  it('Kartei: 201 Änderungen auf einmal → 413, nichts gespeichert', async () => {
    const vorher = JSON.stringify(await db.loadJson('kontakte'));
    const ops = Array.from({ length: 201 }, (_, i) => ({ op: 'upsert', eintrag: kontakt(`c-massen-${i}`) }));
    const r = await kontakte.PATCH!(anfrage('/api/state/kontakte', sitzung('kevin'), 'PATCH', { ops }));
    expect(r.status).toBe(413);
    expect(JSON.stringify(await db.loadJson('kontakte'))).toBe(vorher);
  });
  it('CRM-Bestand: 201 Änderungen → 413, nichts gespeichert (vorher: die ersten 200 gespeichert, der Rest still weg)', async () => {
    const vorher = JSON.stringify(await db.loadJson('crm'));
    const ops = Array.from({ length: 201 }, (_, i) => ({ liste: 'firmen', op: 'upsert', eintrag: { id: `f-m-${i}`, name: `Firma ${i}`, rolle: 'zielkunde' } }));
    const r = await bestand.PATCH!(anfrage('/api/crm/bestand', sitzung('kevin'), 'PATCH', { ops }));
    expect(r.status).toBe(413);
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
  });
  it('genau 200 gehen weiter durch', async () => {
    const ops = Array.from({ length: 200 }, (_, i) => ({ op: 'upsert', eintrag: kontakt(`c-ok-${i}`) }));
    const r = await kontakte.PATCH!(anfrage('/api/state/kontakte', sitzung('kevin'), 'PATCH', { ops, erzwingen: true }));
    expect(r.status).toBe(200);
    expect(((await db.loadJson<{ kontakte: unknown[] }>('kontakte'))?.kontakte ?? []).length).toBe(202);
  });
});
