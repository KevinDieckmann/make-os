// ─── Gestellte Rechnung zurückziehen (03.11.) ─────────────────────────────────────────────────────────────────────────────────────────
// Kevin: „Rechnung löschen, neu ab 0006“ — eine versehentlich mit falscher Nummer gestellte, nie versendete Rechnung darf ein volles
// Haushaltsmitglied löschen: Grund + eingetippte Nummer, Archivkopie zuerst, PDF aus der Ablage, Nummernkreis bleibt. Danach stellt
// „Nächste Rechnungsnummer“ den Kreis ein. Versendet, gemahnt, bezahlt, storniert → 409 (stornieren). Dienstweg/Business-Konto 403.
// Eigener Datenordner, alles erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rechnung-zurueck-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zurueckziehen';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-zurueckziehen-test';

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let JAHR = 0;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const post = async (body: Record<string, unknown>, kopf: Record<string, string> = sitzung('inhaberin')): Promise<Antwort> => {
  const x = await route.POST(new Request('http://test/api/rechnung', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const ablage = async () => (await db.loadJson<{ eintraege: { id: string; rechnungsPdf?: string }[] }>('crm-dateien--haus-a'))?.eintraege ?? [];
const wesen = async () => db.loadJson<{ zaehler?: Record<string, number> }>('rechnungswesen');
const archive = () => { try { return readdirSync(path.join(ordner, 'archiv')).filter(n => n.startsWith('rechnung-zurueckgezogen-')); } catch { return []; } };
let anf = 0;
const neueAnf = () => `anf-zurueck-${++anf}`;
const POS = [{ id: 'p1', titel: 'Workshop', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 150000, ustSatz: 19 }];
const EMPF = { firma: 'Beispiel Kunde GmbH', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt' };

async function gestellt(g: string): Promise<Rechnung & { fassung: string }> {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g, kontaktId: 'c-lea1' });
  expect(n.status, JSON.stringify(n.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', positionen: POS, empfaenger: EMPF } });
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  const r = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung, anfrageId: neueAnf() });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  return r.d.rechnung;
}
const zurueck = (r: { id: string; fassung: string; nummer?: string }, x: Record<string, unknown> = {}, kopf?: Record<string, string>) =>
  post({ aktion: 'zurueckziehen', id: r.id, stand: r.fassung, grund: 'Falsche Nummer vergeben', bestaetigung: r.nummer, ...x }, kopf);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  JAHR = Number((await import('@/lib/zeit')).localDay().slice(0, 4));
  const { leererBestand } = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-a', ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'inhaberin', 'inhaber'), konto('k2', 'partner', 'mitglied', { finanzRecht: 'business' }), konto('k3', 'gast', 'mitglied', { haushalt: 'haus-b' })], einladungen: [] });
  const k: Kontakt = { id: 'c-lea1', vorname: 'Lea', nachname: 'Beispiel', email: 'lea@example.invalid', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' } as Kontakt;
  await db.saveJson('kontakte', { kontakte: [k] });
  await db.saveJson('crm', leererBestand() as unknown as CrmBestand);
  const absender = (id: string, x: Record<string, unknown> = {}) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: ['DE89', '3704', '0044', '0532', '0130', '00'].join('') }, ...x });
  const hrb = { geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' };
  await db.saveJson('gesellschaften--haus-a', { gesellschaften: [absender('kdc'), absender('kdv', hrb), absender('ug', hrb)] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  route = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Regel (rein)', () => {
  const r = { id: 'r-1', status: 'gestellt', nummer: 'KDC-R-2026-0001' } as unknown as Rechnung;
  it('gestellt, nicht versendet/gemahnt/bezahlt/storniert → darf; alles andere nennt den Grund', async () => {
    const { zurueckziehenGruende } = await import('@/lib/finanzen/rechnung/server');
    expect(zurueckziehenGruende(r, false)).toEqual([]);
    expect(zurueckziehenGruende(r, true)).toHaveLength(1);
    expect(zurueckziehenGruende({ ...r, status: 'geplant' } as Rechnung, false)[0]).toMatch(/Entwurf/);
    expect(zurueckziehenGruende({ ...r, status: 'bezahlt', bezahltAm: '2026-11-01' } as Rechnung, false).length).toBeGreaterThan(0);
    expect(zurueckziehenGruende({ ...r, stornoRechnungId: 'r-2' } as Rechnung, false).length).toBeGreaterThan(0);
    expect(zurueckziehenGruende({ ...r, mahnungen: [{}] } as unknown as Rechnung, false).length).toBeGreaterThan(0);
    expect(zurueckziehenGruende({ ...r, versendet: [{}] } as unknown as Rechnung, false).length).toBeGreaterThan(0);
  });
});

describe('Zurückziehen und neu ab 0006', () => {
  it('falsche Bestätigung / ohne Grund → 400, Rechte → 403; nichts geändert', async () => {
    const r = await gestellt('kdc');
    expect(r.nummer).toBe(`KDC-R-${JAHR}-0001`);
    const vorher = JSON.stringify(await plan());
    expect((await zurueck(r, { bestaetigung: `KDC-R-${JAHR}-0002` })).status).toBe(400);
    expect((await zurueck(r, { bestaetigung: undefined })).status).toBe(400);
    expect((await zurueck(r, { grund: '' })).status).toBe(400);
    expect((await zurueck(r, { grund: 'x'.repeat(301) })).status).toBe(413);
    expect((await zurueck(r, {}, dienst('inhaberin'))).status).toBe(403);
    expect((await zurueck(r, {}, sitzung('partner'))).status).toBe(403);
    expect((await zurueck(r, {}, sitzung('gast'))).status).toBe(403);
    expect((await zurueck(r, { stand: 'alt' })).status).toBe(409);
    expect(JSON.stringify(await plan())).toBe(vorher);
    expect(archive()).toEqual([]);
  });
  it('Erfolg: Rechnung und PDF weg, Archivkopie da, Zähler bleibt; nach „nächste = 6“ wird die neue KDC-R-…-0006', async () => {
    const r = (await plan()).rechnungen.find(x => x.firmaId === 'kdc' && x.status === 'gestellt')!;
    const { mitFassung } = await import('@/lib/finanzen/rechnung/server');
    const rf = mitFassung(r);
    expect((await ablage()).some(e => e.rechnungsPdf === r.id)).toBe(true);
    const z = await zurueck(rf);
    expect(z.status, JSON.stringify(z.d)).toBe(200);
    expect(z.d).toMatchObject({ ok: true, id: r.id, nummer: `KDC-R-${JAHR}-0001` });
    expect((await plan()).rechnungen.some(x => x.id === r.id)).toBe(false);
    expect((await ablage()).some(e => e.rechnungsPdf === r.id)).toBe(false);
    expect(archive()).toHaveLength(1);
    const { archivLesen } = await import('@/lib/store/archiv');
    const kopie = await archivLesen<{ rechnung: Rechnung; grund: string; pdf?: { base64: string } }>(archive()[0]);
    expect(kopie?.rechnung.nummer).toBe(`KDC-R-${JAHR}-0001`);
    expect(kopie?.grund).toBe('Falsche Nummer vergeben');
    expect(kopie?.pdf?.base64.length).toBeGreaterThan(100);
    expect((await wesen())?.zaehler?.[`kdc-${JAHR}`]).toBe(1);
    // Ein zweites Mal → 404.
    expect((await zurueck(rf)).status).toBe(404);
    const s = await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 6 });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect((await gestellt('kdc')).nummer).toBe(`KDC-R-${JAHR}-0006`);
  });
  it('gemahnt, bezahlt, storniert → 409 (stornieren statt zurückziehen)', async () => {
    const a = await gestellt('kdv');
    const m = await post({ aktion: 'mahnung', id: a.id, stufe: 1, anfrageId: neueAnf() });
    expect(m.status, JSON.stringify(m.d)).toBe(200);
    const am = (await plan()).rechnungen.find(x => x.id === a.id)!;
    const { mitFassung } = await import('@/lib/finanzen/rechnung/server');
    const za = await zurueck(mitFassung(am));
    expect(za.status).toBe(409);
    expect(za.d.grund).toBe('nicht-zurueckziehbar');
    const b = await gestellt('kdv');
    const bz = await post({ aktion: 'bezahlt', id: b.id, stand: b.fassung });
    expect(bz.status, JSON.stringify(bz.d)).toBe(200);
    expect((await zurueck(mitFassung((await plan()).rechnungen.find(x => x.id === b.id)!))).status).toBe(409);
    const c = await gestellt('kdv');
    const st = await post({ aktion: 'storno', id: c.id, grund: 'Testfall Storno', anfrageId: neueAnf() });
    expect(st.status, JSON.stringify(st.d)).toBe(200);
    expect((await zurueck(mitFassung((await plan()).rechnungen.find(x => x.id === c.id)!))).status).toBe(409);
    expect((await zurueck(st.d.storno)).status).toBe(409);
    expect(archive()).toHaveLength(1);
  });
});
