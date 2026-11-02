// ─── Nächste Rechnungsnummer je Gesellschaft (02.11.) ─────────────────────────────────────────────────────────────────────────────────
// Eine Einstellung je Gesellschaft statt einer festen Regel im Code: „Nächste Rechnungsnummer“ im Kreis des laufenden Jahres — nur nach oben.
// Geprüft: Setzen auf 6 → nächste Rechnung Nr. 6, danach 7; Storno teilt den Kreis; kleiner als vergeben → 409, nichts geändert; neues Jahr
// beginnt bei 1; Rechte (Business-Konto bei Privat-Gesellschaft 403, Dienstweg 403, fremder Haushalt 403); ohne Einstellung bitgleich wie vorher;
// Format mit {NR3}. Eigener Datenordner, alles erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { startnummerPruefen, naechsteNummer, STARTNUMMER_MAX } from '@/lib/finanzen/rechnung/regeln';

describe('Regel (rein)', () => {
  const vergeben = [{ firmaId: 'kdc', lauf: { jahr: 2026, nr: 3 } }, { firmaId: 'kdv', lauf: { jahr: 2026, nr: 9 } }, { firmaId: 'kdc', lauf: { jahr: 2025, nr: 40 } }] as Pick<Rechnung, 'firmaId' | 'lauf'>[];
  it('nur nach oben: Zähler = n − 1; kleiner als vergeben → 409; keine ganze Zahl 1 … max → 400', () => {
    expect(startnummerPruefen([], undefined, 'kdc', 2026, 6)).toEqual({ ok: true, zaehler: 5 });
    expect(startnummerPruefen(vergeben, undefined, 'kdc', 2026, 4)).toEqual({ ok: true, zaehler: 3 });
    expect(startnummerPruefen(vergeben, undefined, 'kdc', 2026, 3)).toMatchObject({ ok: false, status: 409, hoechste: 3 });
    expect(startnummerPruefen(vergeben, 7, 'kdc', 2026, 7)).toMatchObject({ ok: false, status: 409, hoechste: 7 });
    // Andere Gesellschaft und anderes Jahr zählen nicht.
    expect(startnummerPruefen(vergeben, undefined, 'kdc', 2027, 1)).toEqual({ ok: true, zaehler: 0 });
    for (const n of [0, -1, 1.5, STARTNUMMER_MAX + 1, '6', null, undefined, NaN]) expect(startnummerPruefen([], undefined, 'kdc', 2026, n)).toMatchObject({ ok: false, status: 400 });
    expect(startnummerPruefen([], undefined, 'kdc', 2026, STARTNUMMER_MAX)).toEqual({ ok: true, zaehler: STARTNUMMER_MAX - 1 });
  });
  it('mit dem Zähler n − 1 vergibt naechsteNummer genau n; {NR3} ergibt dreistellig', () => {
    expect(naechsteNummer([], 5, 'kdc', 2026, 'KDC').nummer).toBe('KDC-R-2026-0006');
    expect(naechsteNummer([], 5, 'kdc', 2026, 'KDC', '{KURZ}-R-{JAHR}-{NR3}').nummer).toBe('KDC-R-2026-006');
  });
});

// ── Route /api/rechnung ──────────────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rechnung-startnummer-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-startnummer';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-startnummer-test';

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/finanzen/rechnung/server');
let JAHR = 0;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const post = async (body: Record<string, unknown>, kopf: Record<string, string> = sitzung('inhaberin')): Promise<Antwort> => {
  const x = await route.POST(new Request('http://test/api/rechnung', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const holen = async (q = '', person = 'inhaberin'): Promise<Antwort> => {
  const x = await route.GET(new Request(`http://test/api/rechnung${q}`, { headers: sitzung(person) }));
  return { status: x.status, d: await x.json() };
};
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const wesen = async () => db.loadJson<{ zaehler?: Record<string, number> }>('rechnungswesen');
let anf = 0;
const neueAnf = () => `anf-startnummer-${++anf}`;
const POS = [{ id: 'p1', titel: 'Workshop', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 100000, ustSatz: 19 }];
const EMPF = { firma: 'Beispiel Kunde GmbH', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt' };

async function gestellt(g: string): Promise<Rechnung> {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g, kontaktId: 'c-lea1' });
  expect(n.status, JSON.stringify(n.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', positionen: POS, empfaenger: EMPF } });
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  const r = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung, anfrageId: neueAnf() });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  return r.d.rechnung as Rechnung;
}
const nummerVon = (n: Antwort, g: string) => (n.d.nummern as { id: string; nr: number; rechnung: string; storno: string }[]).find(x => x.id === g);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  server = await import('@/lib/finanzen/rechnung/server');
  JAHR = Number((await import('@/lib/zeit')).localDay().slice(0, 4));
  const { leererBestand } = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-a', ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'inhaberin', 'inhaber'), konto('k2', 'partner', 'mitglied', { finanzRecht: 'business' }), konto('k3', 'gast', 'mitglied', { haushalt: 'haus-b' })], einladungen: [] });
  const k: Kontakt = { id: 'c-lea1', vorname: 'Lea', nachname: 'Beispiel', email: 'lea@example.invalid', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' } as Kontakt;
  await db.saveJson('kontakte', { kontakte: [k] });
  await db.saveJson('crm', leererBestand() as unknown as CrmBestand);
  const absender = (id: string, x: Record<string, unknown> = {}) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: ['DE89', '3704', '0044', '0532', '0130', '00'].join('') }, ...x });
  const hrb = { geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' };
  await db.saveJson('gesellschaften--haus-a', { gesellschaften: [absender('kdc'), absender('kdv', hrb), absender('ug', { ...hrb, rechnungsformat: '{KURZ}-R-{JAHR}-{NR3}' })] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  route = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Ohne Einstellung bitgleich wie vorher', () => {
  it('Lesen der nächsten Nummern schreibt nichts; „nächste = 1“ ohne Zähler schreibt auch nichts; die erste Rechnung ist Nr. 1', async () => {
    const n = await holen('?nummern=1');
    expect(n.status).toBe(200);
    expect(n.d.jahr).toBe(JAHR);
    expect(nummerVon(n, 'kdv')).toMatchObject({ nr: 1, rechnung: `KDV-R-${JAHR}-0001` });
    expect(await wesen()).toBeNull();
    const eins = await post({ aktion: 'startnummer', firmaId: 'kdv', nr: 1 });
    expect(eins.status, JSON.stringify(eins.d)).toBe(200);
    expect(await wesen()).toBeNull();
    const r = await gestellt('kdv');
    expect(r).toMatchObject({ nummer: `KDV-R-${JAHR}-0001`, lauf: { jahr: JAHR, nr: 1 } });
    expect((await wesen())?.zaehler).toEqual({ [`kdv-${JAHR}`]: 1 });
  });
});

describe('Setzen nur nach oben', () => {
  it('auf 6 → nächste Rechnung Nr. 6, die danach Nr. 7; Storno teilt den Kreis (Nr. 8)', async () => {
    const s = await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 6, jahr: JAHR });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect(s.d.naechste).toMatchObject({ id: 'kdc', jahr: JAHR, nr: 6, rechnung: `KDC-R-${JAHR}-0006` });
    expect((await wesen())?.zaehler?.[`kdc-${JAHR}`]).toBe(5);
    expect(nummerVon(await holen('?nummern=1'), 'kdc')?.rechnung).toBe(`KDC-R-${JAHR}-0006`);
    const a = await gestellt('kdc');
    expect(a.nummer).toBe(`KDC-R-${JAHR}-0006`);
    const b = await gestellt('kdc');
    expect(b.nummer).toBe(`KDC-R-${JAHR}-0007`);
    const st = await post({ aktion: 'storno', id: a.id, grund: 'Testfall Storno', anfrageId: neueAnf() });
    expect(st.status, JSON.stringify(st.d)).toBe(200);
    expect(st.d.storno.nummer).toBe(`KDC-R-${JAHR}-0008`);
    expect(nummerVon(await holen('?nummern=1'), 'kdc')?.nr).toBe(9);
    // Andere Gesellschaften unberührt.
    expect(nummerVon(await holen('?nummern=1'), 'kdv')?.nr).toBe(2);
  });
  it('kleiner als vergeben → 409 mit Satz, nichts geändert; gleich der nächsten → ok ohne Änderung; höher → Lücke nach oben', async () => {
    const vorher = JSON.stringify(await wesen());
    const zuKlein = await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 8 });
    expect(zuKlein.status).toBe(409);
    expect(zuKlein.d.fehler).toMatch(/Nummer 8 ist schon vergeben — die nächste kann nicht kleiner sein/);
    expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 2 })).status).toBe(409);
    expect(JSON.stringify(await wesen())).toBe(vorher);
    expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 9 })).status).toBe(200);
    expect(JSON.stringify(await wesen())).toBe(vorher);
    for (const nr of [0, 1.5, '12', 1_000_000]) expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr })).status).toBe(400);
    expect((await post({ aktion: 'startnummer', firmaId: 'g-unbekannt', nr: 5 })).status).toBe(400);
    expect(JSON.stringify(await wesen())).toBe(vorher);
  });
  it('Format {NR3}: die nächste Nummer steht dreistellig da', async () => {
    const s = await post({ aktion: 'startnummer', firmaId: 'ug', nr: 6 });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect(s.d.naechste.rechnung).toMatch(new RegExp(`-R-${JAHR}-006$`));
    expect((await gestellt('ug')).nummer).toMatch(new RegExp(`-R-${JAHR}-006$`));
  });
});

describe('Jahreswechsel', () => {
  it('ein neues Jahr beginnt bei 1; die Einstellung gilt nur für den Kreis ihres Jahres', async () => {
    const naechstes = new Date(Date.UTC(JAHR + 1, 0, 2, 10));
    const n = await server.naechsteNummern({ haushalt: 'haus-a', sicht: 'privat' }, naechstes);
    expect(n.jahr).toBe(JAHR + 1);
    expect(n.nummern.find(x => x.id === 'kdc')).toMatchObject({ nr: 1, rechnung: `KDC-R-${JAHR + 1}-0001` });
    // Gezeigtes Jahr ≠ laufendes Jahr → 409 statt still im neuen Kreis.
    await expect(server.startnummerSetzen({ firmaId: 'kdc', nr: 20, jahr: JAHR, haushalt: 'haus-a', sicht: 'privat', jetzt: naechstes })).rejects.toMatchObject({ status: 409 });
    const vorher = JSON.stringify(await wesen());
    expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 20, jahr: JAHR + 1 })).status).toBe(409);
    expect(JSON.stringify(await wesen())).toBe(vorher);
  });
});

describe('Rechte', () => {
  it('Business-Konto: Privat-Gesellschaft 403 (und nicht in der Liste), Business-Gesellschaft geht', async () => {
    const vorher = JSON.stringify(await wesen());
    const p = await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 50 }, sitzung('partner'));
    expect(p.status).toBe(403);
    expect(JSON.stringify(await wesen())).toBe(vorher);
    const n = await holen('?nummern=1', 'partner');
    expect(n.status).toBe(200);
    expect(n.d.nummern.map((x: { id: string }) => x.id).sort()).toEqual(['kdv', 'ug']);
    expect((await post({ aktion: 'startnummer', firmaId: 'kdv', nr: 10 }, sitzung('partner'))).status).toBe(200);
  });
  it('Dienstweg 403, fremder Haushalt 403 — nichts geändert', async () => {
    const vorher = JSON.stringify(await wesen());
    expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 60 }, dienst('inhaberin'))).status).toBe(403);
    expect((await post({ aktion: 'startnummer', firmaId: 'kdc', nr: 60 }, sitzung('gast'))).status).toBe(403);
    expect((await holen('?nummern=1', 'gast')).status).toBe(403);
    expect(JSON.stringify(await wesen())).toBe(vorher);
    expect((await plan()).rechnungen.every(r => !r.lauf || r.lauf.nr < 60)).toBe(true);
  });
});
