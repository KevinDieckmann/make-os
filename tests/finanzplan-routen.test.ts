// ─── Finanzplanung jetzt — Routen mit eigenem Datenordner ────────────────────
// Dienstaufruf per Schlüssel + Person; das Konto trägt einen Test-Haushalt.
// Erfundene, kleine Zahlen — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fp';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
const req = (url: string, body?: unknown, method = 'GET', person = 'kevin', extra: Record<string, string> = {}) =>
  new Request(`http://test${url}`, { method, headers: { ...kopf(person), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
type ImportMod = { POST: (r: Request) => Promise<Response> };
type GetMod = { GET: (r: Request) => Promise<Response> };
let plan: Mod, imp: ImportMod, vorschlaege: GetMod, leeres: typeof import('@/lib/finanzen/plan/operationen')['leeresDokument'];

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-plan' },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-plan' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  plan = (await import('@/app/api/finanzplan/route')) as unknown as Mod;
  imp = (await import('@/app/api/finanzplan/import/route')) as unknown as ImportMod;
  vorschlaege = (await import('@/app/api/finanzplan/vorschlaege/route')) as unknown as GetMod;
  leeres = (await import('@/lib/finanzen/plan/operationen')).leeresDokument;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const lade = async (person = 'kevin') => {
  const r = await plan.GET(req('/api/finanzplan', undefined, 'GET', person));
  return { r, d: (await r.json()) as { ok: boolean; dokument: null | { stand: string; plan: Record<string, number>; meta: Record<string, { wer: string }>; protokoll: { wer: string; feld: string; neu: string }[]; regeln: Record<string, string>; buchungen: { z: string }[] } } };
};

describe('Finanzplan-Routen', () => {
  it('ohne Haushalt am Konto: 403 — auch für Import und PATCH', async () => {
    expect((await plan.GET(req('/api/finanzplan', undefined, 'GET', 'gast'))).status).toBe(403);
    expect((await imp.POST(req('/api/finanzplan/import', { leer: true }, 'POST', 'gast'))).status).toBe(403);
    expect((await plan.PATCH(req('/api/finanzplan', { basisStand: 'x', ops: [{ pfad: '/aktiv', neu: 'basis' }] }, 'PATCH', 'gast'))).status).toBe(403);
    expect((await plan.GET(new Request('http://test/api/finanzplan'))).status).toBe(403);
  });
  it('ohne Dokument: GET liefert dokument null, PATCH 404, Kennzahlen „leer“', async () => {
    const { r, d } = await lade();
    expect(r.status).toBe(200); expect(d.ok).toBe(true); expect(d.dokument).toBeNull();
    expect((await plan.PATCH(req('/api/finanzplan', { basisStand: 'x', ops: [{ pfad: '/aktiv', neu: 'basis' }] }, 'PATCH'))).status).toBe(404);
    const kz = await (await plan.GET(req('/api/finanzplan?nur=kennzahlen'))).json();
    expect(kz).toEqual({ ok: true, leer: true });
  });
  it('Import lehnt falsches Format ab und nimmt „leer beginnen“ an; Malin sieht dasselbe Dokument', async () => {
    const falsch = await imp.POST(req('/api/finanzplan/import', { dokument: { version: 2 } }, 'POST'));
    expect(falsch.status).toBe(400);
    const r = await imp.POST(req('/api/finanzplan/import', { leer: true }, 'POST'));
    expect(r.status).toBe(200);
    const e = await r.json() as { ok: boolean; stand: string; ersetzt: boolean };
    expect(e.ok).toBe(true); expect(e.ersetzt).toBe(false);
    const { d } = await lade('malin');
    expect(d.dokument?.stand).toBe(e.stand);
    expect(d.dokument?.protokoll[0]).toMatchObject({ wer: 'kevin', feld: 'Startbestand hochgeladen' });
  });
  it('zweiter Import ohne „ersetzen“: 409; mit „ersetzen“ ersetzt er und hebt den Stand an', async () => {
    const vorher = (await lade()).d.dokument!.stand;
    expect((await imp.POST(req('/api/finanzplan/import', { leer: true }, 'POST'))).status).toBe(409);
    const r = await imp.POST(req('/api/finanzplan/import?ersetzen=1', { leer: true }, 'POST'));
    expect(r.status).toBe(200);
    const e = await r.json() as { stand: string; ersetzt: boolean };
    expect(e.ersetzt).toBe(true); expect(e.stand > vorher).toBe(true);
  });
  it('Import als Datei (multipart) mit erfundenem Dokument', async () => {
    const doc = leeres('2026-09-27');
    doc.privatBudget.push({ id: 'p.b.a', name: 'Lebensmittel', einheit: 'privat', gruppe: 'Flexibel', soll: 400, typ: 'flex' });
    doc.buchungen.push({ id: 'b1', d: '2026-03-05', b: -20, n: 'Rewe', k: 'gemeinsam', z: 'x.offen' }, { id: 'b2', d: '2026-04-05', b: -30, n: 'REWE', k: 'kevin', z: 'x.offen' });
    const form = new FormData();
    form.set('datei', new File([JSON.stringify(doc)], 'finanzen-plan.json', { type: 'application/json' }));
    form.set('ersetzen', 'true');
    const r = await imp.POST(new Request('http://test/api/finanzplan/import', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'malin' }, body: form }));
    expect(r.status).toBe(200);
    const { d } = await lade();
    expect(d.dokument?.buchungen).toHaveLength(2);
    expect(d.dokument?.protokoll[0]).toMatchObject({ wer: 'malin', feld: 'Plan ersetzt', neu: 'finanzen-plan.json' });
  });
  it('GET mit ETag: zweiter Aufruf mit If-None-Match bekommt 304; nach einer Änderung wieder 200', async () => {
    const r1 = await plan.GET(req('/api/finanzplan'));
    const etag = r1.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const r2 = await plan.GET(req('/api/finanzplan', undefined, 'GET', 'kevin', { 'if-none-match': etag }));
    expect(r2.status).toBe(304);
    const stand = (await lade()).d.dokument!.stand;
    await new Promise(r => setTimeout(r, 5));
    const p = await plan.PATCH(req('/api/finanzplan', { basisStand: stand, ops: [{ pfad: '/plan/p.b.a:2', alt: 400, neu: 420, feld: 'Lebensmittel · Nov 26' }] }, 'PATCH', 'malin'));
    expect(p.status).toBe(200);
    const r3 = await plan.GET(req('/api/finanzplan', undefined, 'GET', 'kevin', { 'if-none-match': etag }));
    expect(r3.status).toBe(200);
  });
  it('PATCH: Stand-Prüfung (409 mit aktuellem Dokument), Meta trägt die Person, Protokoll ist lesbar', async () => {
    const { d } = await lade();
    expect(d.dokument?.plan['p.b.a:2']).toBe(420);
    expect(d.dokument?.meta['p.b.a:2']).toMatchObject({ wer: 'malin' });
    expect(d.dokument?.protokoll[0]).toMatchObject({ wer: 'malin', feld: 'Lebensmittel · Nov 26', neu: '420' });
    const alt = await plan.PATCH(req('/api/finanzplan', { basisStand: 'veraltet', ops: [{ pfad: '/plan/p.b.a:3', neu: 1 }] }, 'PATCH'));
    expect(alt.status).toBe(409);
    const k = await alt.json() as { ok: boolean; stand: string; dokument: { stand: string } };
    expect(k.ok).toBe(false); expect(k.dokument.stand).toBe(d.dokument!.stand); expect(k.stand).toBe(d.dokument!.stand);
    expect((await lade()).d.dokument?.plan['p.b.a:3']).toBeUndefined();
  });
  it('PATCH: ungültige Schritte → 400 und nichts geschrieben; Regel merken ordnet rückwirkend zu und sagt „nachladen“', async () => {
    const stand = (await lade()).d.dokument!.stand;
    const falsch = await plan.PATCH(req('/api/finanzplan', { basisStand: stand, ops: [{ pfad: '/plan/p.b.a:4', neu: 5 }, { pfad: '/stand', neu: 'x' }] }, 'PATCH'));
    expect(falsch.status).toBe(400);
    const nach = (await lade()).d.dokument!;
    expect(nach.stand).toBe(stand); expect(nach.plan['p.b.a:4']).toBeUndefined();
    const r = await plan.PATCH(req('/api/finanzplan', { basisStand: stand, ops: [{ pfad: '/regeln/Rewe', neu: 'p.b.a', feld: 'Regel Rewe' }] }, 'PATCH'));
    expect(r.status).toBe(200);
    const e = await r.json() as { ok: boolean; nachladen: boolean; stand: string; protokoll: { neu: string }[] };
    expect(e.nachladen).toBe(true); expect(e.protokoll[0].neu).toMatch(/2 Buchungen/);
    const { d } = await lade();
    expect(d.dokument?.regeln.rewe).toBe('p.b.a');
    expect(d.dokument?.buchungen.every(b => b.z === 'p.b.a')).toBe(true);
    expect(d.dokument?.stand).toBe(e.stand);
    expect((await plan.PATCH(req('/api/finanzplan', { basisStand: e.stand, ops: [] }, 'PATCH'))).status).toBe(400);
  });
  it('Szenario-Baukasten über PATCH: Planszenario anlegen, Arbeitsplan setzen, Kennzahlen folgen dem Arbeitsplan; Vorschläge ohne CRM leer, ohne Haushalt 403', async () => {
    const stand = (await lade()).d.dokument!.stand;
    const ps = { id: 'ps-test', name: 'Zwei Retainer', basis: 'basis', bausteine: [{ id: 'b1', art: 'umsatz', einheit: 'ug', name: 'Retainer', preis: 1000, menge: 2, rhythmus: 'monatlich', start: 1, an: true }], annahmen: {}, angelegt: '2026-09-27T10:00:00.000Z' };
    const r = await plan.PATCH(req('/api/finanzplan', { basisStand: stand, ops: [{ pfad: '/planszenarien/-', neu: ps, feld: 'Szenario angelegt' }, { pfad: '/arbeitsplan', alt: null, neu: 'ps-test', feld: 'Arbeitsplan' }] }, 'PATCH'));
    expect(r.status).toBe(200);
    const kz = await (await plan.GET(req('/api/finanzplan?nur=kennzahlen'))).json() as Record<string, unknown>;
    expect(kz.arbeitsplan).toBe('Zwei Retainer'); expect(kz.arbeitsplanId).toBe('ps-test');
    expect(typeof kz.freiJetzt).toBe('number'); expect(typeof kz.zieleImPlan).toBe('number');
    const falsch = await plan.PATCH(req('/api/finanzplan', { basisStand: (await lade()).d.dokument!.stand, ops: [{ pfad: '/arbeitsplan', neu: 'gibtsnicht' }] }, 'PATCH'));
    expect(falsch.status).toBe(400);
    const v = await vorschlaege.GET(req('/api/finanzplan/vorschlaege'));
    expect(v.status).toBe(200);
    const vj = await v.json() as { ok: boolean; produkte: unknown[]; istBasis: unknown[]; inSzenarien: Record<string, unknown>; arbeitsplan: string | null };
    expect(vj.ok).toBe(true); expect(vj.produkte).toEqual([]); expect(vj.istBasis).toEqual([]); expect(vj.inSzenarien).toEqual({}); expect(vj.arbeitsplan).toBe('ps-test');
    expect((await vorschlaege.GET(req('/api/finanzplan/vorschlaege', undefined, 'GET', 'gast'))).status).toBe(403);
    // aufräumen: Arbeitsplan zurück, damit die Kennzahlen-Prüfung darunter den Treiber sieht
    const s2 = (await lade()).d.dokument!.stand;
    expect((await plan.PATCH(req('/api/finanzplan', { basisStand: s2, ops: [{ pfad: '/planszenarien/id=ps-test', alt: 'Zwei Retainer' }] }, 'PATCH'))).status).toBe(200);
    expect((await lade()).d.dokument).toMatchObject({ arbeitsplan: null, planszenarien: [] });
  });
  it('Kennzahlen: nur verdichtete Zahlen, endlich, ohne Zeilen', async () => {
    const kz = await (await plan.GET(req('/api/finanzplan?nur=kennzahlen', undefined, 'GET', 'malin'))).json() as Record<string, unknown>;
    expect(kz.ok).toBe(true); expect(kz.leer).toBe(false); expect(kz.szenario).toBe('Basis');
    expect(Number.isFinite(kz.minFrei)).toBe(true); expect(kz.offeneBuchungen).toBe(0);
    expect('buchungen' in kz).toBe(false); expect('plan' in kz).toBe(false);
  });
});
