// ─── Keine Rechnung ohne Zuordnung zur Markttraktion (30.10.) ─────────────────────────────────────────────────────────────────────────
// Kevin 30.10.: „Wir müssen zusätzlich bei den Rechnungen einbauen, dass wir das Ganze auch in der Selbstständigkeit immer mit der Markttraktion
// abgleichen und wir da suchen können. Es geht keine Rechnung raus, ohne dass das Ganze zugeordnet ist.“
// Geprüft: Stellen ohne Firma/Person/Mandat → 409 (Business UND Selbstständigkeit, keine Nummer verbraucht), mit Zuordnung → ok; toter Verweis zählt
// nicht; Storno des Altbestands geht; Versand und Mahnung des Altbestands erst nach „zuordnen“ (Beleg unverändert); Umsatz-Reiter bekommt die
// Rechnung der Selbstständigkeit nur als volles Mitglied, nie als Konto „nur Business“. Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { istZugeordnet, zuordnungText } from '@/lib/finanzen/rechnung/regeln';
import { rechnungenFiltern } from '@/lib/finanzen/rechnung/uebersicht';
import { umsatzBezug, type UmsatzRechnung } from '@/lib/crm/umsatz';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const HEUTE = '2026-10-30';
const r = (id: string, x: Partial<Rechnung> = {}): Rechnung => ({ id, firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Beratung', betrag: 119, status: 'gestellt', ...x } as Rechnung);

describe('Regeln (rein)', () => {
  it('zugeordnet = Firma, Person oder Mandat; frei getippte Empfängerfelder zählen nicht', () => {
    expect(istZugeordnet({})).toBe(false);
    expect(istZugeordnet(r('a', { empfaenger: { firma: 'Muster GmbH', strasse: 'X 1', plz: '12345', ort: 'Y' } }))).toBe(false);
    expect(istZugeordnet({ kundeFirmaId: 'f-muster' })).toBe(true);
    expect(istZugeordnet({ kontaktId: 'c-anna1' })).toBe(true);
    expect(istZugeordnet({ mandatId: 'm-1' })).toBe(true);
  });
  it('Liste: Filter „Ohne Zuordnung“ (ohne Stornorechnungen) und Suche über Firma/Person der Zuordnung', () => {
    const namen = { 'f-nord': 'Nordwerk GmbH', 'c-lea1': 'Lea Beispiel' };
    const l = [r('r-1', { kundeFirmaId: 'f-nord', kontaktId: 'c-lea1', kunde: 'Kunde' }), r('r-2'), r('r-3', { art: 'storno', status: 'storniert' })];
    expect(rechnungenFiltern(l, { filter: 'ohne-zuordnung' }, HEUTE).map(x => x.id)).toEqual(['r-2']);
    expect(rechnungenFiltern(l, { filter: 'alle', suche: 'nordwerk', namen }, HEUTE).map(x => x.id)).toEqual(['r-1']);
    expect(rechnungenFiltern(l, { filter: 'alle', suche: 'lea', namen }, HEUTE).map(x => x.id)).toEqual(['r-1']);
    expect(zuordnungText(l[0], namen)).toBe('Nordwerk GmbH · Lea Beispiel');
  });
  it('Umsatz: über die Zuordnung (auch Selbstständigkeit, gekennzeichnet); fremd zugeordnete nie per Name', () => {
    const crm = { chancen: [], mandate: [], firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: '' }] } as unknown as CrmBestand;
    const k = { id: 'c-anna1', firmaId: 'f-muster', vorname: 'Anna', nachname: 'Test' };
    const liste: UmsatzRechnung[] = [
      { id: 'r-kdc', firmaId: 'kdc', kunde: 'Anders benannt', titel: 'Workshop', betrag: 500, status: 'gestellt', kontaktId: 'c-anna1' },
      { id: 'r-firma', firmaId: 'kdv', kunde: 'Anders', titel: 'Beratung', betrag: 100, status: 'bezahlt', kundeFirmaId: 'f-muster' },
      { id: 'r-fremd', firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Gleicher Name', betrag: 100, status: 'gestellt', kundeFirmaId: 'f-andere' },
    ];
    const b = umsatzBezug(k, crm, liste, HEUTE);
    expect(b.rechnungen.map(z => z.r.id).sort()).toEqual(['r-firma', 'r-kdc']);
    expect(b.rechnungen.find(z => z.r.id === 'r-kdc')).toMatchObject({ privat: true, perName: false });
    expect(b.rechnungen.find(z => z.r.id === 'r-firma')?.privat).toBeUndefined();
  });
});

// ── Route /api/rechnung ──────────────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rechnung-zuordnung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zuordnung';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-zuordnungs-test';

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const post = async (body: Record<string, unknown>, person = 'kevin'): Promise<Antwort> => {
  const x = await route.POST(new Request('http://test/api/rechnung', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const holen = async (q = '', person = 'kevin'): Promise<Antwort> => {
  const x = await route.GET(new Request(`http://test/api/rechnung${q}`, { headers: sitzung(person) }));
  return { status: x.status, d: await x.json() };
};
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const zaehler = async () => (await db.loadJson<{ zaehler?: Record<string, number> }>('rechnungswesen'))?.zaehler ?? {};
let anf = 0;
const neueAnf = () => `anf-zuordnung-${++anf}`;
const POS = [{ id: 'p1', titel: 'Workshop', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 100000, ustSatz: 19 }];
const EMPF = { firma: 'Frei getippt GmbH', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt' };

/** Entwurf der Gesellschaft g, vollständig bis auf die Zuordnung (Empfänger nur frei getippt), dazu optional Felder. */
async function entwurf(g: string, felder: Record<string, unknown> = {}) {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g });
  expect(n.status, JSON.stringify(n.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', positionen: POS, empfaenger: EMPF, ...felder } });
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  return s.d.rechnung as Rechnung & { fassung: string };
}
const stellen = (e: { id: string; fassung: string }) => post({ aktion: 'stellen', id: e.id, stand: e.fassung, anfrageId: neueAnf() });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const { leererBestand } = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus', ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' }), k('c-gesperrt1', { nachname: 'Gesperrt', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } } as Partial<Kontakt>)] });
  const J = '2026-09-01T10:00:00.000Z';
  const mandat = { id: 'm-ohnefirma', kunde: 'Kunde ohne Kartei', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto',
    honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J } as unknown as Mandat;
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' } } }], mandate: [mandat] } as unknown as CrmBestand);
  const absender = (id: string, x: Record<string, unknown> = {}) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: IBAN }, ...x });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [absender('kdv', { geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' }), absender('kdc')] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  route = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Stellen nur mit Zuordnung', () => {
  it('ohne Zuordnung → 409 „zuordnung“, nichts gestellt, keine Nummer verbraucht — Business UND Selbstständigkeit', async () => {
    for (const g of ['kdv', 'kdc']) {
      const e = await entwurf(g);
      const s = await stellen(e);
      expect(s.status, g).toBe(409);
      expect(s.d.grund).toBe('zuordnung');
      expect(s.d.fehler).toMatch(/Markttraktion/);
      expect((await plan()).rechnungen.find(x => x.id === e.id)).toMatchObject({ status: 'geplant' });
      expect((await plan()).rechnungen.find(x => x.id === e.id)?.nummer).toBeUndefined();
    }
    expect(await zaehler()).toEqual({});
  });
  it('ein toter Verweis (Firma gibt es nicht) zählt nicht', async () => {
    const e = await entwurf('kdv', { kundeFirmaId: 'f-gibtsnicht' });
    expect((await stellen(e)).d.grund).toBe('zuordnung');
  });
  it('mit Firma, mit Person, mit Mandat → gestellt (Business und Selbstständigkeit)', async () => {
    const e1 = await entwurf('kdc');
    const k1 = await post({ aktion: 'kunde', id: e1.id, stand: e1.fassung, kundeFirmaId: 'f-muster' });
    expect((await stellen(k1.d.rechnung)).status).toBe(200);
    const e2 = await entwurf('kdv');
    const k2 = await post({ aktion: 'kunde', id: e2.id, stand: e2.fassung, kontaktId: 'c-anna1' });
    const s2 = await stellen(k2.d.rechnung);
    expect(s2.status, JSON.stringify(s2.d)).toBe(200);
    expect(s2.d.rechnung).toMatchObject({ kontaktId: 'c-anna1', kundeFirmaId: 'f-muster', status: 'gestellt' });
    const e3 = await entwurf('kdv', { mandatId: 'm-ohnefirma' });
    const s3 = await stellen(e3);
    expect(s3.status, JSON.stringify(s3.d)).toBe(200);
  }, 120_000);
  it('neu angelegt: „anschriftBehalten“ lässt getippte Felder stehen, wo die Kartei nichts weiß', async () => {
    const e = await entwurf('kdv', { empfaenger: { ...EMPF, ustId: 'DE123456789' } });
    const k = await post({ aktion: 'kunde', id: e.id, stand: e.fassung, kundeFirmaId: 'f-muster', anschriftBehalten: true });
    expect(k.d.rechnung.empfaenger).toMatchObject({ firma: 'Muster GmbH', strasse: 'Hauptstraße 5', ustId: 'DE123456789' });
  });
});

describe('Altbestand: Storno geht, Versand und Mahnung erst nach dem Zuordnen', () => {
  it('Storno einer gestellten Rechnung ohne Zuordnung wird nicht blockiert', async () => {
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, r('r-alt-storno', { nummer: 'ALT-1', datum: '2026-09-01' })] }));
    const s = await post({ aktion: 'storno', id: 'r-alt-storno', grund: 'doppelt erfasst', anfrageId: neueAnf() });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect((await plan()).rechnungen.find(x => x.id === 'r-alt-storno')).toMatchObject({ status: 'storniert' });
  });
  it('Mahnung ohne Zuordnung → 409; „zuordnen“ trägt nur den Verweis nach (Beleg unverändert), dann geht die Mahnung', async () => {
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, r('r-alt-mahn', { nummer: 'ALT-2', datum: '2026-09-01', faellig: '2026-09-15', empfaenger: { firma: 'Alt GmbH' } })] }));
    const m = await post({ aktion: 'mahnung', id: 'r-alt-mahn', stufe: 1, anfrageId: neueAnf() });
    expect(m.status).toBe(409);
    expect(m.d.grund).toBe('zuordnung');
    const vorher = (await plan()).rechnungen.find(x => x.id === 'r-alt-mahn')!;
    const { fassung } = await import('@/lib/finanzen/finanzplan-bestand');
    expect((await post({ aktion: 'zuordnen', id: 'r-alt-mahn', stand: 'alt', kontaktId: 'c-anna1' })).status).toBe(409);
    expect((await post({ aktion: 'zuordnen', id: 'r-alt-mahn', stand: fassung(vorher), kontaktId: 'c-gesperrt1' })).status).toBe(404);
    const z = await post({ aktion: 'zuordnen', id: 'r-alt-mahn', stand: fassung(vorher), kontaktId: 'c-anna1' });
    expect(z.status, JSON.stringify(z.d)).toBe(200);
    const nachher = (await plan()).rechnungen.find(x => x.id === 'r-alt-mahn')!;
    expect(nachher).toMatchObject({ kontaktId: 'c-anna1', kundeFirmaId: 'f-muster', nummer: 'ALT-2', betrag: vorher.betrag, empfaenger: { firma: 'Alt GmbH' } });
    // Schon zugeordnet: kein Wechsel des Kunden an einer gestellten Rechnung.
    expect((await post({ aktion: 'zuordnen', id: 'r-alt-mahn', stand: fassung(nachher), kundeFirmaId: 'f-muster' })).status).toBe(409);
    expect((await post({ aktion: 'mahnung', id: 'r-alt-mahn', stufe: 1, anfrageId: neueAnf() })).status).toBe(200);
  });
  it('Versand aus der Inbox: Rechnung ohne Zuordnung → 409, nichts gesendet; Stornorechnung geht', async () => {
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen,
      r('r-alt-pdf', { nummer: 'ALT-3', pdfDateiId: 'd-alt-pdf' } as Partial<Rechnung>),
      r('r-alt-sto', { nummer: 'ALT-4', status: 'storniert', art: 'storno', stornoZu: 'r-alt-pdf', pdfDateiId: 'd-alt-sto' } as Partial<Rechnung>)] }));
    const { belegPruefen } = await import('@/lib/inbox/beleg-versand');
    await expect(belegPruefen({ art: 'rechnung', id: 'r-alt-pdf' }, ['d-alt-pdf'])).rejects.toMatchObject({ status: 409 });
    await expect(belegPruefen({ art: 'rechnung', id: 'r-alt-sto' }, ['d-alt-sto'])).resolves.toBeUndefined();
  });
});

describe('Umsatz-Reiter: Sicht serverseitig', () => {
  it('volles Mitglied bekommt die Rechnung der Selbstständigkeit, das Konto „nur Business“ nie', async () => {
    const voll = await holen('?umsatz=1');
    expect(voll.status).toBe(200);
    const kdcVoll = voll.d.rechnungen.filter((x: { firmaId: string }) => x.firmaId === 'kdc');
    expect(kdcVoll.length).toBeGreaterThan(0);
    expect(kdcVoll.some((x: { kundeFirmaId?: string }) => x.kundeFirmaId === 'f-muster')).toBe(true);
    const nurBusiness = await holen('?umsatz=1', 'partner');
    expect(nurBusiness.status).toBe(200);
    expect(nurBusiness.d.sicht).toBe('business');
    expect(nurBusiness.d.rechnungen.length).toBeGreaterThan(0);
    expect(nurBusiness.d.rechnungen.some((x: { firmaId: string }) => x.firmaId === 'kdc')).toBe(false);
  });
  it('die Liste trägt die Namen der Zuordnung — Business-Sicht nur für ihre Rechnungen', async () => {
    const voll = await holen('?bereich=privat');
    expect(voll.d.namen['f-muster']).toBe('Muster GmbH');
    const b = await holen('', 'partner');
    const ids = new Set(b.d.rechnungen.flatMap((x: Rechnung) => [x.kundeFirmaId, x.kontaktId, x.mandatId].filter(Boolean)));
    expect(Object.keys(b.d.namen).every(k => ids.has(k))).toBe(true);
  });
});
