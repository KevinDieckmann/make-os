// ─── Route /api/crm/verbindungen (28.09.): Zugang, Vorschau schreibt nichts, Reparatur, Idempotenz ──
// Eigener Datenordner, Dienstschlüssel + Person, Konten mit Test-Haushalt. Erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-verbindungen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-verbindungen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
const kopf = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const get = (h: Record<string, string> = kopf('kevin')) => route.GET(new Request('http://test/api/crm/verbindungen', { headers: h }));
const post = (body: unknown, h: Record<string, string> = kopf('kevin')) => route.POST(new Request('http://test/api/crm/verbindungen', { method: 'POST', headers: h, body: JSON.stringify(body) }));
const J = '2026-09-01T10:00:00.000Z';
const Q = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' };
const kontakt = (id: string, x: Record<string, unknown> = {}) => ({ id, vorname: id, nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
/** Alle Bestände als Text — um zu beweisen, dass die Vorschau nichts schreibt. */
const platte = () => Object.fromEntries(readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => [n, readFileSync(path.join(ordner, n), 'utf8')]));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [kontakt('c-anna1', { firmaId: 'f-alpha', lead: { status: 'sql', kriterien: Q, chanceId: 'd-weg' } })] });
  await db.saveJson('crm', { ...speicher.leererBestand(),
    firmen: [{ id: 'f-alpha', name: 'Firma Alpha', rolle: 'zielkunde', geaendert: J }],
    chancen: [{ id: 'd-1', titel: 'Deal', kontaktIds: ['c-anna1', 'c-weg1'], firmaId: 'f-weg', art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: Q, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J }],
    followups: [{ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-weg1' }, kontaktId: 'c-weg1', art: 'anruf', text: 'x', faellig: '2026-10-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J }],
  });
  await db.saveJson('crm-import-konflikte', { konflikte: [{ kontaktId: 'c-weg1', feld: 'email', online: 1, liste: 2 }], moeglicheDubletten: [], ohneBesitzer: 0, stand: J, quelle: 'test' });
  await db.saveJson('crm-dateien--test-haus', { eintraege: [{ id: 'd-abcd1', art: 'vertrag', kontaktId: 'c-anna1', datei: { name: 'v.pdf', typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: J, hochgeladenVon: 'kevin' }] });
  route = (await import('@/app/api/crm/verbindungen/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Zugang (Default-Deny)', () => {
  it('ohne Schlüssel, ohne Person oder aus einem anderen Haushalt: 403 — lesen wie schreiben', async () => {
    expect((await get({})).status).toBe(403);
    expect((await get(kopf())).status).toBe(403);
    expect((await get({ 'x-make-user': 'gast' })).status).toBe(403);
    expect((await post({ ids: ['deal-kontakt-tot'] }, {})).status).toBe(403);
    expect((await post({ ids: ['deal-kontakt-tot'] }, kopf())).status).toBe(403);
    expect((await post({ ids: ['deal-kontakt-tot'] }, { 'content-type': 'application/json', 'x-make-user': 'gast' })).status).toBe(403);
    expect((await get({ 'x-make-user': 'malin' })).status).toBe(200);
  });
  it('nur reparierbare Befunde sind erlaubt', async () => {
    expect((await post({ ids: ['deal-firma-tot'] })).status).toBe(400);
    expect((await post({ ids: [] })).status).toBe(400);
    expect((await post({ ids: ['deal-kontakt-tot', 'gibt-es-nicht'] })).status).toBe(400);
  });
});

describe('GET · Vorschau · Reparatur', () => {
  it('GET liefert Befunde mit Kennungen und ein ETag; derselbe Stand → 304', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    const x = await r.json() as { ampel: string; befunde: { id: string; anzahl: number; beispiele: string[] }[] };
    expect(x.ampel).toBe('rot');
    const ids = x.befunde.map(b => b.id);
    expect(ids).toEqual(expect.arrayContaining(['deal-kontakt-tot', 'deal-firma-tot', 'kontakt-lead-deal-tot', 'followup-kontakt-tot', 'konflikt-veraltet', 'datei-fehlt']));
    expect(JSON.stringify(x)).not.toMatch(/Firma Alpha|@example/);
    const etag = r.headers.get('etag')!;
    expect((await get({ ...kopf('kevin'), 'if-none-match': etag })).status).toBe(304);
  });

  it('Vorschau schreibt nichts', async () => {
    const vorher = platte();
    const r = await post({ ids: ['deal-kontakt-tot', 'kontakt-lead-deal-tot', 'followup-kontakt-tot', 'konflikt-veraltet', 'datei-fehlt'], vorschau: true });
    const x = await r.json() as { ok: boolean; vorschau: boolean; aenderungen: { befundId: string; speicher: string; anzahl: number }[] };
    expect(x).toMatchObject({ ok: true, vorschau: true });
    expect(x.aenderungen.map(a => a.speicher).sort()).toEqual(['crm', 'crm', 'dateien', 'import-konflikte', 'kontakte']);
    expect(platte()).toEqual(vorher);
  });

  it('Reparatur ändert nur Verweise — und ein zweiter Lauf ändert nichts mehr', async () => {
    const ids = ['deal-kontakt-tot', 'kontakt-lead-deal-tot', 'followup-kontakt-tot', 'konflikt-veraltet', 'datei-fehlt'];
    const r = await (await post({ ids })).json() as { ok: boolean; befunde: { id: string }[] };
    expect(r.ok).toBe(true);
    for (const id of ids) expect(r.befunde.map(b => b.id)).not.toContain(id);
    expect(r.befunde.map(b => b.id)).toContain('deal-firma-tot');
    const crm = await db.loadJson<{ chancen: { kontaktIds: string[]; firmaId?: string; geaendert: string }[]; followups: { status: string; notiz?: string }[] }>('crm');
    expect(crm!.chancen[0]).toMatchObject({ kontaktIds: ['c-anna1'], firmaId: 'f-weg', geaendert: J });
    expect(crm!.followups).toHaveLength(1);
    expect(crm!.followups[0].status).toBe('abgesagt');
    const kontakte = await db.loadJson<{ kontakte: { lead?: { chanceId?: string; status: string }; geaendertAm: string }[] }>('kontakte');
    expect(kontakte!.kontakte[0].lead).toEqual({ status: 'sql', kriterien: Q });
    expect(kontakte!.kontakte[0].geaendertAm).toBe('2026-08-01');
    expect((await db.loadJson<{ konflikte: unknown[] }>('crm-import-konflikte'))!.konflikte).toEqual([]);
    const ablage = await db.loadJson<{ eintraege: { id: string; dateiFehlt?: string }[] }>('crm-dateien--test-haus');
    expect(ablage!.eintraege).toHaveLength(1);
    expect(ablage!.eintraege[0].dateiFehlt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const vorher = platte();
    const zwei = await (await post({ ids: ['deal-kontakt-tot', 'followup-kontakt-tot', 'datei-fehlt'] })).json() as { aenderungen: unknown[] };
    expect(zwei.aenderungen).toEqual([]);
    expect(platte()).toEqual(vorher);
  });
});
