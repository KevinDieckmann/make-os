// Routen-Test des Masterlisten-Imports (27.09., „Online gewinnt“): Vorschau schreibt nichts,
// Schreiben legt Konflikte ab statt sie anzuwenden, Konfliktauflösung wirkt, Segment „Vernetzen“ entsteht.
// Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand. Alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-import-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-27-09';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const req = (body?: unknown, method = 'POST') => new Request('http://test/api/crm/import', { method, headers: kopf, ...(body ? { body: JSON.stringify(body) } : {}) });

type Mod = { POST: (r: Request) => Promise<Response>; GET: (r: Request) => Promise<Response> };
type Kontakt = import('@/lib/make-one/crm').Kontakt;
let route: Mod, db: typeof import('@/lib/store/local-db'), speicher: typeof import('@/lib/crm/speicher');

const KOPFZEILE = 'VORNAME;NACHNAME;EMAIL;FIRMA;OWNER;GESPRAECHSAUFHAENGER;KEVIN_NOTIZ;STATUS_RECHERCHE';
const csv = (zeilen: string[]) => [KOPFZEILE, ...zeilen].join('\n');
const LISTE = csv([
  'Testa;Beispielmann;testa@example.invalid;Testfirma GmbH;Malin Würriehausen;Aufhänger Liste;Notiz Liste;',
  'Testo;Musterfrau;testo@example.invalid;Musterwerk AG;(kein Owner);;;⚠ Owner klären (Dublette Kevin/Malin)',
]);

const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  route = (await import('@/app/api/crm/import/route')) as unknown as Mod;
  const { ausZeile, vonHandMarkieren } = await import('@/lib/make-one/crm');
  // Online steht Testa schon — mit einer von Hand geschriebenen Notiz.
  const testa = ausZeile({ VORNAME: 'Testa', NACHNAME: 'Beispielmann', EMAIL: 'testa@example.invalid', FIRMA: 'Testfirma GmbH' }, '2026-09-20');
  await db.saveJson('kontakte', { kontakte: [vonHandMarkieren(testa, { ...testa, notiz: 'Malins Notiz online' })] });
  await db.saveJson('crm', speicher.leererBestand());
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Import-Route — Vorschau, Konflikte, Auflösung', () => {
  it('weist ohne Schlüssel ab', async () => {
    const r = await route.POST(new Request('http://test/api/crm/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: LISTE, vorschau: true }) }));
    expect(r.status).toBe(403);
  });

  it('Vorschau rechnet alles und schreibt nichts', async () => {
    const vorher = await kontakte();
    const r = await route.POST(req({ csv: LISTE, name: 'liste.csv', vorschau: true }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toMatchObject({ ok: true, vorschau: true, zeilen: 2, neu: 1, unveraendert: 0, konflikte: 1, ohneBesitzer: 1, abgelehnt: false });
    expect(d.beispiele.konflikte).toEqual([{ kontaktId: vorher[0].id, feld: 'notiz' }]);
    expect(d.beispiele.moeglicheDubletten.some((x: { grund: string }) => x.grund === 'Liste: Owner klären')).toBe(true);
    expect(await kontakte()).toEqual(vorher);
    expect(await db.loadJson('crm-import-konflikte')).toBeNull();
    expect((await speicher.ladeCrm()).segmente).toEqual([]);
  });

  it('Schreiben: füllt Lücken, wendet Konflikte NICHT an, legt sie ab und legt das Segment „Vernetzen“ an', async () => {
    const r = await route.POST(req({ csv: LISTE, name: 'liste.csv' }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toMatchObject({ ok: true, neu: 1, aktualisiert: 1, ohneBesitzer: 1 });
    const k = await kontakte();
    const testa = k.find(x => x.email === 'testa@example.invalid')!;
    expect(testa.notiz).toBe('Malins Notiz online');
    expect(testa.aufhaenger).toBe('Aufhänger Liste');
    expect(testa.besitzer).toBe('malin');
    expect(k.find(x => x.email === 'testo@example.invalid')?.besitzer).toBeUndefined();
    const st = await db.loadJson<{ konflikte: { kontaktId: string; feld: string; online: unknown; liste: unknown }[] }>('crm-import-konflikte');
    expect(st?.konflikte).toEqual([{ kontaktId: testa.id, feld: 'notiz', online: 'Malins Notiz online', liste: 'Notiz Liste' }]);
    const seg = (await speicher.ladeCrm()).segmente.find(s => s.id === 'seg-vernetzen');
    expect(seg).toMatchObject({ name: 'Vernetzen · kalte Leads', geaendertVon: 'system', kriterien: { temperatur: ['kalt'] } });
    const g = await (await route.GET(req(undefined, 'GET'))).json();
    expect(g.konflikte).toHaveLength(1);
    expect(g.ohneBesitzer).toBe(1);
  });

  it('zweiter Lauf ändert nichts und meldet denselben Konflikt', async () => {
    const vorher = await kontakte();
    const d = await (await route.POST(req({ csv: LISTE, name: 'liste.csv' }))).json();
    expect(d).toMatchObject({ neu: 0, aktualisiert: 0, unveraendert: 2 });
    expect(d.konflikte).toHaveLength(1);
    expect(await kontakte()).toEqual(vorher);
    expect((await speicher.ladeCrm()).segmente.filter(s => s.id === 'seg-vernetzen')).toHaveLength(1);
  });

  it('Konflikt „Liste übernehmen“ setzt den Wert, merkt das Feld als entschieden und schließt den Konflikt', async () => {
    const testa = (await kontakte()).find(x => x.email === 'testa@example.invalid')!;
    const falsch = await route.POST(req({ aktion: 'konflikt', kontaktId: testa.id, feld: 'stufe', wahl: 'liste' }));
    expect(falsch.status).toBe(400);
    const r = await route.POST(req({ aktion: 'konflikt', kontaktId: testa.id, feld: 'notiz', wahl: 'liste' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, offen: 0 });
    const nachher = (await kontakte()).find(x => x.id === testa.id)!;
    expect(nachher.notiz).toBe('Notiz Liste');
    expect(nachher.vonHand).toContain('notiz');
    expect((await (await route.GET(req(undefined, 'GET'))).json()).konflikte).toEqual([]);
    // Noch einmal: nicht mehr offen.
    expect((await route.POST(req({ aktion: 'konflikt', kontaktId: testa.id, feld: 'notiz', wahl: 'online' }))).status).toBe(404);
    // Nächster Import: gleicher Wert, kein Konflikt mehr.
    const d = await (await route.POST(req({ csv: LISTE, name: 'liste.csv' }))).json();
    expect(d.konflikte).toEqual([]);
  });

  it('Konflikt „Online behalten“ lässt den Wert stehen und schützt das Feld', async () => {
    const testa = (await kontakte()).find(x => x.email === 'testa@example.invalid')!;
    const liste2 = csv(['Testa;Beispielmann;testa@example.invalid;Testfirma GmbH;Malin Würriehausen;Aufhänger Liste;Notiz Liste v2;']);
    const d = await (await route.POST(req({ csv: liste2, name: 'liste2.csv' }))).json();
    expect(d.konflikte).toEqual([{ kontaktId: testa.id, feld: 'notiz', online: 'Notiz Liste', liste: 'Notiz Liste v2' }]);
    const r = await route.POST(req({ aktion: 'konflikt', kontaktId: testa.id, feld: 'notiz', wahl: 'online' }));
    expect(r.status).toBe(200);
    const nachher = (await kontakte()).find(x => x.id === testa.id)!;
    expect(nachher.notiz).toBe('Notiz Liste');
    expect(nachher.vonHand).toContain('notiz');
  });

  it('schreibt ins Änderungsprotokoll als „import“ — nur Kennungen und Feldnamen (28.09.)', async () => {
    const { protokollMonat, monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
    const e = (await protokollMonat('ohne-haushalt', monatBerlin())).filter(x => x.bestand === 'kontakte');
    expect(e.length).toBeGreaterThan(0);
    expect(e.every(x => x.wer === 'import' && x.person === 'kevin')).toBe(true);
    expect(JSON.stringify(e)).not.toContain('@example.invalid');
  });

  it('eine zweite Adresse zu einer bekannten Person wird angehängt, nicht überschrieben (28.09., #11)', async () => {
    const vorher = (await kontakte()).find(x => x.email === 'testa@example.invalid')!;
    const liste3 = csv(['Testa;Beispielmann;testa.privat@example.invalid;Testfirma GmbH;Malin Würriehausen;Aufhänger Liste;Notiz Liste;']);
    const d = await (await route.POST(req({ csv: liste3, name: 'liste3.csv' }))).json();
    expect(d).toMatchObject({ neu: 0, weitereAdressen: 1 });
    const k = (await kontakte()).find(x => x.id === vorher.id)!;
    expect(k.email).toBe('testa@example.invalid');
    expect(k.emails?.map(x => x.adresse)).toEqual(['testa@example.invalid', 'testa.privat@example.invalid']);
    // Zweimal: nichts Neues.
    const d2 = await (await route.POST(req({ csv: liste3, name: 'liste3.csv' }))).json();
    expect(d2).toMatchObject({ neu: 0, weitereAdressen: 0 });
  });
});
