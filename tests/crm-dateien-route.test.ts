// ─── Route /api/crm/dateien: verschlüsselte Ablage je Haushalt (28.09.) ──────
// Eigener Datenordner, Dienstschlüssel + Person, Konten mit Test-Haushalt, gesetzter
// Datenschlüssel. Erfundene Inhalte — nie echte Dateien.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dateien-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-dateien';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-test';

type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; DELETE: (r: Request) => Promise<Response> };
let route: Mod;
const kopf = (person?: string, extra: Record<string, string> = {}) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), ...extra });

const GEHEIM = 'KLARTEXT-MARKE-7f3a nur im Test';
const pdf = (text = GEHEIM) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`);
function hochladen(inhalt: Uint8Array, name: string, meta: unknown, person = 'kevin', typ = 'application/pdf') {
  const f = new FormData();
  f.append('datei', new File([inhalt as BlobPart], name, { type: typ }));
  f.append('meta', JSON.stringify(meta));
  return route.POST(new Request('http://test/api/crm/dateien', { method: 'POST', headers: kopf(person), body: f }));
}
const liste = async (q: string, person = 'kevin') => (await (await route.GET(new Request(`http://test/api/crm/dateien?${q}`, { headers: kopf(person) }))).json()) as { ok: boolean; eintraege: { id: string; art: string; datei?: { name: string; verschluesselt: boolean } }[] };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer-haus' },
    { id: 'k4', speicher: 'ohne', email: 'o@test', name: 'Ohne', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  route = (await import('@/app/api/crm/dateien/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Upload → Liste → Download', () => {
  let id = '';
  it('lädt hoch, listet je Kontakt, liefert denselben Inhalt als Anhang zurück', async () => {
    const r = await hochladen(pdf(), '../Vertrag "Probe".pdf', { art: 'vertrag', titel: 'Rahmenvertrag', kontaktId: 'c-probe-1', vertrag: { vertragsart: 'rahmen', von: '2026-01-01' } });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ok).toBe(true);
    id = d.eintrag.id;
    expect(id).toMatch(/^d-[a-z0-9-]+$/);
    expect(d.eintrag.datei).toMatchObject({ name: 'Vertrag Probe.pdf', typ: 'application/pdf', verschluesselt: true });
    expect(d.eintrag.hochgeladenVon).toBe('kevin');

    const l = await liste('kontakt=c-probe-1');
    expect(l.eintraege.map(e => e.id)).toEqual([id]);
    expect((await liste('kontakt=c-niemand')).eintraege).toEqual([]);

    const dl = await route.GET(new Request(`http://test/api/crm/dateien?id=${id}`, { headers: kopf('malin') }));
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toBe('application/pdf');
    expect(dl.headers.get('content-disposition')).toMatch(/^attachment; filename="Vertrag Probe\.pdf"/);
    expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await dl.arrayBuffer())).toEqual(pdf());
  });
  it('auf der Platte steht kein Klartext — weder Inhalt noch Dateiname', () => {
    const datei = path.join(ordner, 'dateien', 'test-haus', `${id}.bin`);
    expect(existsSync(datei)).toBe(true);
    expect(readFileSync(datei).includes(Buffer.from(GEHEIM))).toBe(false);
    expect(readFileSync(datei).subarray(0, 8).toString('ascii')).toBe('MKOSDAT1');
    const meta = readFileSync(path.join(ordner, 'crm-dateien--test-haus.json'), 'utf8');
    expect(meta).toContain('__verschluesselt');
    expect(meta).not.toContain('Rahmenvertrag');
  });
  it('Metadaten ändern (PATCH), Art und Datei bleiben', async () => {
    const r = await route.PATCH(new Request('http://test/api/crm/dateien', { method: 'PATCH', headers: { ...kopf('kevin'), 'content-type': 'application/json' }, body: JSON.stringify({ id, felder: { titel: 'Rahmenvertrag neu', art: 'angebot', datei: { name: 'x.exe' } } }) }));
    const d = await r.json();
    expect(d.eintrag).toMatchObject({ titel: 'Rahmenvertrag neu', art: 'vertrag', datei: { name: 'Vertrag Probe.pdf' }, geaendertVon: 'kevin' });
  });
  it('Angebot ohne Datei (JSON) — mit Status', async () => {
    const r = await route.POST(new Request('http://test/api/crm/dateien', { method: 'POST', headers: { ...kopf('kevin'), 'content-type': 'application/json' }, body: JSON.stringify({ meta: { art: 'angebot', firmaId: 'f-probe', angebot: { nummer: 'A-1', betrag: 1200, status: 'offen' } } }) }));
    const d = await r.json();
    expect(d.eintrag).toMatchObject({ art: 'angebot', angebot: { nummer: 'A-1', betrag: 1200, status: 'offen' } });
    expect(d.eintrag.datei).toBeUndefined();
    const ohneDatei = await route.POST(new Request('http://test/api/crm/dateien', { method: 'POST', headers: { ...kopf('kevin'), 'content-type': 'application/json' }, body: JSON.stringify({ meta: { art: 'vertrag', kontaktId: 'c-probe-1' } }) }));
    expect(ohneDatei.status).toBe(400);
  });
  it('Löschen entfernt Eintrag und Datei', async () => {
    const r = await route.DELETE(new Request(`http://test/api/crm/dateien?id=${id}`, { method: 'DELETE', headers: kopf('kevin') }));
    expect(r.status).toBe(200);
    expect(existsSync(path.join(ordner, 'dateien', 'test-haus', `${id}.bin`))).toBe(false);
    expect((await liste('kontakt=c-probe-1')).eintraege).toEqual([]);
    expect((await route.DELETE(new Request(`http://test/api/crm/dateien?id=${id}`, { method: 'DELETE', headers: kopf('kevin') }))).status).toBe(404);
  });
});

describe('Zugang und Schranken', () => {
  it('403: Sitzung aus anderem Haushalt, Konto ohne Haushalt, Dienst ohne Person, gar kein Zugang', async () => {
    for (const p of ['gast', 'ohne']) expect((await route.GET(new Request('http://test/api/crm/dateien', { headers: { 'x-make-user': p } }))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/crm/dateien', { headers: kopf('ohne') }))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/crm/dateien', { headers: kopf() }))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/crm/dateien'))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/crm/dateien', { headers: { 'x-make-user': 'gast' } }))).status).toBe(403);
    expect((await hochladen(pdf(), 'a.pdf', { art: 'sonstig', kontaktId: 'c-x-1' }, 'ohne')).status).toBe(403);
  });
  it('Sitzung im Haushalt des Inhabers darf; der Dienstweg mit Person sieht nur deren Haushalt', async () => {
    expect((await route.GET(new Request('http://test/api/crm/dateien', { headers: { 'x-make-user': 'malin' } }))).status).toBe(200);
    const fremd = await liste('kontakt=c-probe-1', 'gast');
    expect(fremd.ok).toBe(true);
    expect(fremd.eintraege).toEqual([]);
  });
  it('413 zu groß — per Content-Length und beim Lesen', async () => {
    const gross = new Uint8Array(15 * 1024 * 1024 + 10);
    gross.set(pdf().subarray(0, 8));
    expect((await hochladen(gross, 'gross.pdf', { art: 'sonstig', kontaktId: 'c-x-1' })).status).toBe(413);
    const gelogen = await route.POST(new Request('http://test/api/crm/dateien', { method: 'POST', headers: { ...kopf('kevin'), 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(40 * 1024 * 1024) }, body: 'x' }));
    expect(gelogen.status).toBe(413);
  });
  it('415 falscher Typ oder Inhalt passt nicht zur Endung', async () => {
    expect((await hochladen(new TextEncoder().encode('MZ…'), 'boese.exe', { art: 'sonstig', kontaktId: 'c-x-1' }, 'kevin', 'application/octet-stream')).status).toBe(415);
    expect((await hochladen(new TextEncoder().encode('<html><script>'), 'getarnt.pdf', { art: 'sonstig', kontaktId: 'c-x-1' })).status).toBe(415);
    expect((await route.POST(new Request('http://test/api/crm/dateien', { method: 'POST', headers: { ...kopf('kevin'), 'content-type': 'text/plain' }, body: 'x' }))).status).toBe(415);
  });
  it('Traversierung abgewiesen: Kennungen nur d-[a-z0-9-], nichts außerhalb der Ablage', async () => {
    for (const boese of ['../konten', 'd-../../konten', '..%2Fkonten', 'd-ABC', 'd-a/b']) {
      expect((await route.GET(new Request(`http://test/api/crm/dateien?id=${encodeURIComponent(boese)}`, { headers: kopf('kevin') }))).status).toBe(400);
      expect((await route.DELETE(new Request(`http://test/api/crm/dateien?id=${encodeURIComponent(boese)}`, { method: 'DELETE', headers: kopf('kevin') }))).status).toBe(400);
    }
    expect(existsSync(path.join(ordner, 'konten.json'))).toBe(true);
  });
  it('ohne Bezug wird nichts abgelegt; Haushalte sehen einander nicht', async () => {
    expect((await hochladen(pdf(), 'a.pdf', { art: 'sonstig' })).status).toBe(400);
    const r = await (await hochladen(pdf('zweiter'), 'b.pdf', { art: 'sonstig', kontaktId: 'c-x-1' })).json();
    expect(r.ok).toBe(true);
    expect(readdirSync(path.join(ordner, 'dateien'))).toEqual(['test-haus']);
    expect((await liste('kontakt=c-x-1', 'gast')).eintraege).toEqual([]);
  });
});

describe('Skript Ein-/Ausschalten (daten-verschluesselung.mjs) stellt auch die Ablage um', () => {
  it('entschlüsseln → Klartext auf der Platte, Download gleich; verschlüsseln → wieder Hülle', async () => {
    const { execFileSync } = await import('node:child_process');
    const r = await (await hochladen(pdf('skript'), 's.pdf', { art: 'sonstig', kontaktId: 'c-skript-1' })).json();
    const datei = path.join(ordner, 'dateien', 'test-haus', `${r.eintrag.id}.bin`);
    const lauf = (m: string) => execFileSync(process.execPath, ['scripts/daten-verschluesselung.mjs', m], { env: { ...process.env, MAKE_OS_DATEN_DIR: ordner }, stdio: 'pipe' });
    const laden = async () => new Uint8Array(await (await route.GET(new Request(`http://test/api/crm/dateien?id=${r.eintrag.id}`, { headers: kopf('kevin') }))).arrayBuffer());
    lauf('--entschluesseln');
    expect(readFileSync(datei).includes(Buffer.from('skript'))).toBe(true);
    expect(await laden()).toEqual(pdf('skript'));
    lauf('--verschluesseln');
    expect(readFileSync(datei).subarray(0, 8).toString('ascii')).toBe('MKOSDAT1');
    expect(await laden()).toEqual(pdf('skript'));
  });
});

describe('ohne Datenschlüssel', () => {
  it('bleibt lokal wie der Rest Klartext — der Eintrag merkt sich das', async () => {
    const key = process.env.MAKE_OS_DATEN_SCHLUESSEL;
    const { ablegen, lesen } = await import('@/lib/dateien/ablage');
    try {
      delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
      // Metadaten-Bestand eines neuen Haushalts (der verschlüsselte des Test-Haushalts wäre ohne Schlüssel nicht lesbar).
      const e = await ablegen('klar-haus', 'kevin', { art: 'sonstig', kontaktId: 'c-x-1' }, { bytes: Buffer.from(pdf('klar')), name: 'k.pdf', typ: 'application/pdf' });
      expect(e.datei?.verschluesselt).toBe(false);
      expect(readFileSync(path.join(ordner, 'dateien', 'klar-haus', `${e.id}.bin`)).includes(Buffer.from('klar'))).toBe(true);
      expect((await lesen('klar-haus', e.id))!.bytes).toEqual(Buffer.from(pdf('klar')));
    } finally { process.env.MAKE_OS_DATEN_SCHLUESSEL = key; }
  });
});

describe('Belege mit Rechnungs- oder Mandatsbezug werden nicht gelöscht (28.09., K3 · #50/#81)', () => {
  const loeschen = (id: string) => route.DELETE(new Request(`http://test/api/crm/dateien?id=${id}`, { method: 'DELETE', headers: kopf('kevin') }));
  const aendern = (id: string, felder: unknown) => route.PATCH(new Request('http://test/api/crm/dateien', { method: 'PATCH', headers: { ...kopf('kevin'), 'content-type': 'application/json' }, body: JSON.stringify({ id, felder }) }));

  it('Rechnungs-PDF: Löschen → 409, Eintrag und Datei bleiben; vom Bezug lösen, dann löschbar', async () => {
    const e = (await (await hochladen(pdf('beleg'), 'r.pdf', { art: 'rechnung', rechnungId: 'r-probe-1', kontaktId: 'c-beleg-1' })).json()).eintrag;
    const r = await loeschen(e.id);
    expect(r.status).toBe(409);
    expect((await r.json()).fehler).toMatch(/Bezug lösen/);
    expect((await liste('kontakt=c-beleg-1')).eintraege.map(x => x.id)).toEqual([e.id]);
    expect(existsSync(path.join(ordner, 'dateien', 'test-haus', `${e.id}.bin`))).toBe(true);
    // Vom Bezug lösen (Kontakt bleibt) — danach ist es eine gewöhnliche Datei.
    expect((await aendern(e.id, { rechnungId: null })).status).toBe(200);
    expect((await loeschen(e.id)).status).toBe(200);
  });

  it('Vertrag am Mandat: Löschen → 409; nur-Mandat-Bezug lässt sich nicht lösen (sonst nirgends zu finden) → 400', async () => {
    const e = (await (await hochladen(pdf('mandat'), 'v.pdf', { art: 'vertrag', mandatId: 'm-probe-1' })).json()).eintrag;
    expect((await loeschen(e.id)).status).toBe(409);
    expect((await aendern(e.id, { mandatId: null })).status).toBe(400);
    expect((await liste('mandat=m-probe-1')).eintraege.map(x => x.id)).toContain(e.id);
  });
});
