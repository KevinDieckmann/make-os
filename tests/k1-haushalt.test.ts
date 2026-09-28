// ─── Paket K1 (28.09.) — Haushaltsprüfung der Kartei-Routen (#66/#67) und Regel 5 (Dubletten, Löschprotokoll) ──
// Eigener Datenordner, erfundene Konten und Daten. Drei Fälle je Route: Konto ohne Haushalt → 403, Konto im
// Test-Haushalt → 403, Haushalt des Inhabers → 200. Dazu der Dienstweg: ohne Person (Systemlauf) darf, mit
// Person nur, wenn die Person zum Haushalt des Inhabers gehört.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k1-haushalt-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k1-haushalt';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PUT?: Handler; PATCH?: Handler };
const routen: Record<string, Route> = {};
const NAMEN = ['kontakte', 'kunden', 'prospects', 'netzwerk', 'stammdaten', 'aenderungen'] as const;

const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const kontakt = (id: string) => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' });

let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'inhaber', 'inhaber-haus'),
    konto('k2', 'malin', 'mitglied', 'inhaber-haus'),
    konto('k3', 'fremd', 'mitglied', 'test'),
    konto('k4', 'ohne', 'mitglied'),
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [kontakt('c-anna'), kontakt('c-bert')] });
  await db.saveJson('kunden', { kunden: [{ id: 'k-beispiel', name: 'Beispiel AG', status: 'aktiv' }] });
  routen.kontakte = (await import('@/app/api/state/kontakte/route')) as Route;
  routen.kunden = (await import('@/app/api/state/kunden/route')) as Route;
  routen.prospects = (await import('@/app/api/state/prospects/route')) as Route;
  routen.netzwerk = (await import('@/app/api/state/netzwerk/route')) as Route;
  routen.stammdaten = (await import('@/app/api/state/stammdaten/route')) as Route;
  routen.aenderungen = (await import('@/app/api/state/aenderungen/route')) as unknown as Route;
  routen.dubletten = (await import('@/app/api/crm/dubletten/route')) as Route;
  routen.datenschutz = (await import('@/app/api/crm/datenschutz/route')) as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Kartei-Routen: nur Haushalt des Inhabers (#66/#67)', () => {
  for (const n of NAMEN) {
    it(`GET /api/state/${n}: ohne Haushalt 403 · Test-Haushalt 403 · Inhaber-Haushalt 200`, async () => {
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, sitzung('ohne')))).status).toBe(403);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, sitzung('fremd')))).status).toBe(403);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, sitzung('niemand')))).status).toBe(403);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, sitzung('malin')))).status).toBe(200);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, sitzung('kevin')))).status).toBe(200);
    });
  }

  it('fremde Konten lesen nichts aus der Kartei', async () => {
    const r = await routen.kontakte.GET!(anfrage('/api/state/kontakte?voll=1', sitzung('fremd')));
    expect(r.status).toBe(403);
    expect(await r.text()).not.toContain('c-anna');
  });

  it('schreibende Wege: ohne Haushalt und aus dem Test-Haushalt 403, nichts geändert', async () => {
    const vorher = JSON.stringify(await db.loadJson('kontakte'));
    const op = { ops: [{ op: 'teil', id: 'c-anna', felder: { notiz: 'fremd geschrieben' } }] };
    for (const p of ['ohne', 'fremd']) {
      expect((await routen.kontakte.PATCH!(anfrage('/api/state/kontakte', sitzung(p), 'PATCH', op))).status).toBe(403);
      expect((await routen.kunden.PATCH!(anfrage('/api/state/kunden', sitzung(p), 'PATCH', { ops: [{ op: 'delete', id: 'k-beispiel' }] }))).status).toBe(403);
      expect((await routen.kunden.PUT!(anfrage('/api/state/kunden', sitzung(p), 'PUT', { kunden: [] }))).status).toBe(403);
      expect((await routen.prospects.PUT!(anfrage('/api/state/prospects', sitzung(p), 'PUT', { icp: 'x', prospects: [] }))).status).toBe(403);
      expect((await routen.netzwerk.PUT!(anfrage('/api/state/netzwerk', sitzung(p), 'PUT', { kontakte: [] }))).status).toBe(403);
      expect((await routen.netzwerk.PATCH!(anfrage('/api/state/netzwerk', sitzung(p), 'PATCH', { ops: [] }))).status).toBe(403);
      expect((await routen.stammdaten.PUT!(anfrage('/api/state/stammdaten', sitzung(p), 'PUT', { firmen: [] }))).status).toBe(403);
    }
    expect(JSON.stringify(await db.loadJson('kontakte'))).toBe(vorher);
    expect((await routen.kontakte.PATCH!(anfrage('/api/state/kontakte', sitzung('malin'), 'PATCH', op))).status).toBe(200);
  });

  it('Dienstweg: ohne Person (Takt) 200 · mit Person des Inhaber-Haushalts 200 · mit fremder Person 403', async () => {
    for (const n of NAMEN) {
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, dienst()))).status).toBe(200);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, dienst('kevin')))).status).toBe(200);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, dienst('malin')))).status).toBe(200);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, dienst('fremd')))).status).toBe(403);
      expect((await routen[n].GET!(anfrage(`/api/state/${n}`, dienst('ohne')))).status).toBe(403);
    }
    // Falscher Schlüssel ist kein Dienstweg — und ohne Sitzung gibt es keinen Zugang.
    expect((await routen.kontakte.GET!(anfrage('/api/state/kontakte', { 'x-make-key': 'falsch', 'x-make-person': 'kevin' }))).status).toBe(403);
  });
});

describe('Regel 5: ausdrückliche Person bei Dubletten-Merge und Löschprotokoll', () => {
  it('POST /api/crm/dubletten: Dienstweg ohne Person → 401, es wird nichts zusammengeführt', async () => {
    const vorher = JSON.stringify(await db.loadJson('kontakte'));
    const r = await routen.dubletten.POST!(anfrage('/api/crm/dubletten', dienst(), 'POST', { behalten: 'c-anna', weg: 'c-bert' }));
    // Seit 28.09. abends lehnt schon `imHaushaltDesInhabers` den Dienstweg ohne Person ab (403) — vorher die Route (401).
    expect([401, 403]).toContain(r.status);
    expect(JSON.stringify(await db.loadJson('kontakte'))).toBe(vorher);
  });
  it('POST /api/crm/datenschutz: Dienstweg ohne Person → 401, nichts gelöscht, kein Protokolleintrag „kevin“', async () => {
    const r = await routen.datenschutz.POST!(anfrage('/api/crm/datenschutz', dienst(), 'POST', { id: 'c-bert' }));
    expect([401, 403]).toContain(r.status);
    expect(((await db.loadJson<{ kontakte: { id: string }[] }>('kontakte'))?.kontakte ?? []).some(k => k.id === 'c-bert')).toBe(true);
    expect(await db.loadJson('crm-loeschprotokoll')).toBeNull();
  });
  it('mit Person: Löschprotokoll nennt genau diese Person', async () => {
    const r = await routen.datenschutz.POST!(anfrage('/api/crm/datenschutz', dienst('malin'), 'POST', { id: 'c-bert' }));
    expect(r.status).toBe(200);
    const p = await db.loadJson<{ eintraege: { id: string; von: string }[] }>('crm-loeschprotokoll');
    // Seit 29.09. (D-B #30) nur eine Protokoll-ID — nie die Kontakt-Kennung (sie trägt die E-Mail).
    expect(p?.eintraege).toEqual([expect.objectContaining({ id: expect.stringMatching(/^lp-/), von: 'malin' })]);
    expect(JSON.stringify(p)).not.toContain('c-bert');
  });
});
