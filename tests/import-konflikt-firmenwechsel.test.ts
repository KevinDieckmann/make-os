// ─── Import-Konflikt „Firmenwechsel?“ (28.09.) — „Liste übernehmen“ mit Absicht ─────────────────────────
// Vorher übernahm „Liste übernehmen“ beim Feld `firma` nur den Firmentext: der neue Name stand über der alten
// Hauptstation (firmaId/Stationen blieben alt) — ohne Rückfrage, ohne Fehler. Jetzt braucht es bei einer Person mit
// Hauptstation dieselbe Absicht wie im Kontakt (`firmaWechsel`: jobwechsel · zusaetzlich · korrektur), sonst 409 mit
// `firmaWechselNoetig`. Eigener Datenordner, Dienstaufruf per Schlüssel, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-firmenwechsel-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-firmenwechsel';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const H = new Date().toISOString().slice(0, 10);
const J = new Date().toISOString();
const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const post = (body: unknown) => new Request('http://test/api/crm/import', { method: 'POST', headers: kopf, body: JSON.stringify(body) });
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Testa', nachname: 'Beispielfrau', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const mitStation = (id: string) => person(id, { firmaId: 'f-alt', firma: 'Alt GmbH', position: 'CFO', stationen: [{ firmaId: 'f-alt', rolle: 'CFO', aktiv: true, haupt: true }] });
const konflikt = (kontaktId: string, liste = 'Neu AG') => ({ kontaktId, feld: 'firma', online: 'Alt GmbH', liste, hinweis: 'Firmenwechsel?' });

type Route = { POST: (r: Request) => Promise<Response> };
let imp: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let firmen: typeof import('@/lib/crm/firmen');
const kartei = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;
const offen = async () => (await db.loadJson<{ konflikte: { kontaktId: string }[] }>('crm-import-konflikte'))?.konflikte ?? [];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  firmen = await import('@/lib/crm/firmen');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-fw' }], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [mitStation('c-fw-job'), mitStation('c-fw-korr'), mitStation('c-fw-zus'), person('c-fw-text', { firma: 'Alt GmbH' })] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-alt', name: 'Alt GmbH', rolle: 'zielkunde', geaendert: J }, { id: 'f-da', name: 'Schon Da KG', rolle: 'zielkunde', geaendert: J }] });
  await db.saveJson('crm-import-konflikte', { konflikte: [konflikt('c-fw-job'), konflikt('c-fw-korr', 'Schon Da KG'), konflikt('c-fw-zus', 'Dritte SE'), konflikt('c-fw-text', 'Nur Text GmbH')], moeglicheDubletten: [], ohneBesitzer: 0, stand: J, quelle: 'Test' });
  imp = (await import('@/app/api/crm/import/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('POST /api/crm/import { aktion: konflikt } — Feld firma', () => {
  it('ohne Absicht bei Hauptstation → 409 firmaWechselNoetig, nichts geändert, Konflikt bleibt offen', async () => {
    const r = await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-job', feld: 'firma', wahl: 'liste' }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, firmaWechselNoetig: true });
    expect((await kartei()).find(k => k.id === 'c-fw-job')).toMatchObject({ firma: 'Alt GmbH', firmaId: 'f-alt' });
    expect((await offen()).some(k => k.kontaktId === 'c-fw-job')).toBe(true);
    expect((await crm()).firmen).toHaveLength(2);
  });
  it('Jobwechsel: neue Firma angelegt, alte Station endet, neue ist Hauptstation', async () => {
    const r = await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-job', feld: 'firma', wahl: 'liste', firmaWechsel: 'jobwechsel' }));
    expect(r.status).toBe(200);
    const neuId = firmen.firmenId('Neu AG');
    expect((await crm()).firmen.find(f => f.id === neuId)?.name).toBe('Neu AG');
    const k = (await kartei()).find(x => x.id === 'c-fw-job')!;
    expect(k).toMatchObject({ firma: 'Neu AG', firmaId: neuId });
    expect(k.stationen?.find(s => s.firmaId === 'f-alt')).toMatchObject({ aktiv: false, bis: H });
    expect(k.stationen?.find(s => s.haupt)?.firmaId).toBe(neuId);
    expect(k.vonHand).toContain('firma');
    expect((k as unknown as Record<string, unknown>).firmaWechsel).toBeUndefined();
    expect((await offen()).some(x => x.kontaktId === 'c-fw-job')).toBe(false);
  });
  it('Korrektur: bestehende Firma (gleicher Name) wird verknüpft, die Hauptstation ersetzt — ohne Historie', async () => {
    const vorher = (await crm()).firmen.length;
    expect((await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-korr', feld: 'firma', wahl: 'liste', firmaWechsel: 'korrektur' }))).status).toBe(200);
    expect((await crm()).firmen).toHaveLength(vorher);
    const k = (await kartei()).find(x => x.id === 'c-fw-korr')!;
    expect(k).toMatchObject({ firma: 'Schon Da KG', firmaId: 'f-da' });
    expect(k.stationen).toEqual([expect.objectContaining({ firmaId: 'f-da', aktiv: true, haupt: true })]);
  });
  it('Zusätzlich: zweite laufende Station, die Hauptstation (und der Firmentext) bleibt', async () => {
    expect((await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-zus', feld: 'firma', wahl: 'liste', firmaWechsel: 'zusaetzlich' }))).status).toBe(200);
    const k = (await kartei()).find(x => x.id === 'c-fw-zus')!;
    expect(k.firmaId).toBe('f-alt');
    expect(k.firma).toBe('Alt GmbH');
    expect(k.stationen?.filter(s => s.aktiv).map(s => s.firmaId).sort()).toEqual(['f-alt', firmen.firmenId('Dritte SE')].sort());
  });
  it('ohne Hauptstation (nur Firmentext): wie bisher, keine Absicht nötig', async () => {
    expect((await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-text', feld: 'firma', wahl: 'liste' }))).status).toBe(200);
    expect((await kartei()).find(x => x.id === 'c-fw-text')?.firma).toBe('Nur Text GmbH');
  });
  it('ungültige Absicht zählt nicht', async () => {
    await db.saveJson('crm-import-konflikte', { konflikte: [konflikt('c-fw-job', 'Vierte GmbH')], moeglicheDubletten: [], ohneBesitzer: 0, stand: J, quelle: 'Test' });
    const r = await imp.POST(post({ aktion: 'konflikt', kontaktId: 'c-fw-job', feld: 'firma', wahl: 'liste', firmaWechsel: 'irgendwas' }));
    expect(r.status).toBe(409);
  });
});
