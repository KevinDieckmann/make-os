// ─── E-Rechnung (31.10.) — von Ende zu Ende über die Routen: Stellen mit ZUGFeRD, „E-Rechnung aus“, XRechnung-Download, Beleg-Eingang ─
// Eigener Datenordner, Datenschlüssel gesetzt, alles erfunden (example.invalid, Beispiel-IBAN zusammengesetzt). Kein Modell: der Eingang
// liest E-Rechnungen aus der Datei (ohne ANTHROPIC_API_KEY).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-erechnung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-erechnung';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-erechnungs-test';
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let beleg: { POST: H };
let db: typeof import('@/lib/store/local-db');
let ablage: typeof import('@/lib/dateien/ablage');
let pdf: typeof import('@/lib/finanzen/erechnung/pdf');
let lesen: typeof import('@/lib/finanzen/erechnung/lesen');

const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const post = async (body: Record<string, unknown>, person = 'kevin'): Promise<Antwort> => {
  const r = await route.POST(new Request('http://test/api/rechnung', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: r.status, d: await r.json() };
};
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const rechnung = async (id: string) => (await plan()).rechnungen.find(r => r.id === id)!;

async function gestellt(g: string): Promise<Rechnung> {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g, kontaktId: 'c-anna1' });
  expect(n.status, JSON.stringify(n.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', leistungBis: '2026-10-31', positionen: [
    { id: 'p1', titel: 'Beratung Oktober', text: 'Zwei Workshops', menge: 2, einheit: 'Tag', einzelpreisCent: 120000, ustSatz: 19 },
    { id: 'p2', titel: 'Unterlagen', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 4999, ustSatz: 7 },
  ] } });
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  const st = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung });
  expect(st.status, JSON.stringify(st.d)).toBe(200);
  return rechnung(s.d.rechnung.id);
}
const pdfBytes = async (r: Rechnung) => new Uint8Array((await ablage.lesen('test-haus', r.pdfDateiId!))!.bytes);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ablage = await import('@/lib/dateien/ablage');
  pdf = await import('@/lib/finanzen/erechnung/pdf');
  lesen = await import('@/lib/finanzen/erechnung/lesen');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', { haushalt: 'test-haus' }), konto('k3', 'partner', 'mitglied', { haushalt: 'test-haus', finanzRecht: 'business' })], einladungen: [] });
  const k: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Test', email: 'anna@example.invalid', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' } as Kontakt;
  await db.saveJson('kontakte', { kontakte: [k] });
  const J = '2026-09-01T10:00:00.000Z';
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, referenz: 'PO-7' } }] } as unknown as CrmBestand);
  const absender = (id: string, x: Record<string, unknown> = {}) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: 'info@example.invalid', steuernummer: '12/345/67890', ustId: 'DE123456789', bank: { iban: IBAN, bic: 'COBADEFFXXX', bank: 'Beispielbank' }, ...x });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [
    absender('kdv', { firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' }),
    absender('kdc', { firmierung: 'Beispiel Beratung', eRechnungAus: true }),
    { id: 'ug', firmierung: 'Beispiel GmbH' },
  ] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  route = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
  beleg = (await import('@/app/api/beleg/route')) as unknown as { POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Stellen: die PDF trägt die ZUGFeRD-XML', () => {
  it('gestellt → factur-x.xml in der PDF, gleiche Beträge wie der Datensatz, Prüfsumme über die neue PDF, Kennzeichen eRechnung', async () => {
    const r = await gestellt('kdv');
    expect(r.eRechnung).toBe('zugferd');
    const bytes = await pdfBytes(r);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(r.sha256);
    const ein = await pdf.eingebetteteXml(bytes);
    expect(ein?.name).toBe('factur-x.xml');
    const e = lesen.eRechnungLesen(ein!.xml)!;
    expect(e).toMatchObject({ nummer: r.nummer, datum: r.datum, faellig: r.faellig, brutto: r.betrag, netto: r.netto, gutschrift: false });
    expect(e.verkaeufer.ustId).toBe('DE123456789');
    expect(e.kaeufer.name).toBe('Muster GmbH');
  });
  it('„E-Rechnung aus“ an der Gesellschaft → PDF wie bisher, ohne eingebettete Datei und ohne Kennzeichen', async () => {
    const r = await gestellt('kdc');
    expect(r.eRechnung).toBeUndefined();
    expect(await pdf.eingebetteteXml(await pdfBytes(r))).toBeNull();
  });
  it('Empfänger-Land unbekannt → 409 mit Pflichtangabe, keine Nummer verbraucht', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv', kontaktId: 'c-anna1' });
    const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', empfaenger: { ...n.d.rechnung.empfaenger, land: 'Atlantis' }, positionen: [{ id: 'p1', titel: 'X', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 1000, ustSatz: 19 }] } });
    const st = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung });
    expect(st.status).toBe(409);
    expect(st.d.fehler).toContain('Atlantis');
    expect((await rechnung(s.d.rechnung.id)).nummer).toBeUndefined();
  });
  it('Stornorechnung trägt ebenfalls die XML (Art 381, Bezug auf das Original)', async () => {
    const r = await gestellt('kdv');
    const s2 = await post({ aktion: 'storno', id: r.id, grund: 'Falscher Zeitraum' });
    expect(s2.status, JSON.stringify(s2.d)).toBe(200);
    const s = await rechnung(s2.d.storno.id);
    expect(s.eRechnung).toBe('zugferd');
    const e = lesen.eRechnungLesen((await pdf.eingebetteteXml(await pdfBytes(s)))!.xml)!;
    expect(e.art).toBe('381');
    expect(e.brutto).toBe(r.betrag);
  });
});

describe('XRechnung als Download', () => {
  const holen = async (id: string, person = 'kevin') => route.GET(new Request(`http://test/api/rechnung?xrechnung=${id}`, { headers: sitzung(person) }));
  it('ohne Leitweg-ID und Telefon → 409 mit klarer Liste', async () => {
    const r = await gestellt('kdv');
    const a = await holen(r.id);
    expect(a.status).toBe(409);
    const d = await a.json();
    expect(d.fehler).toContain('Leitweg-ID');
    expect(d.fehler).toContain('Telefon des Absenders');
  });
  it('mit Leitweg-ID an der Kundenfirma und Telefon im Absender → XML-Download (nosniff, attachment), gleiche Beträge wie die PDF', async () => {
    const r = await gestellt('kdv');
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!, firmen: c!.firmen.map(f => (f.id === 'f-muster' ? { ...f, zahlung: { ...f.zahlung, leitwegId: '991-12345-67' } } : f)) }));
    await db.updateJson<{ gesellschaften: Record<string, unknown>[] }>('gesellschaften--test-haus', c => ({ gesellschaften: c!.gesellschaften.map(g => (g.id === 'kdv' ? { ...g, telefon: '+49 30 1234567' } : g)) }));
    const a = await holen(r.id);
    expect(a.status, await a.clone().text()).toBe(200);
    expect(a.headers.get('content-type')).toContain('application/xml');
    expect(a.headers.get('x-content-type-options')).toBe('nosniff');
    expect(a.headers.get('content-disposition')).toContain('attachment');
    const xml = await a.text();
    expect(xml).toContain('urn:xeinkauf.de:kosit:xrechnung_3.0');
    expect(xml).toContain('<ram:BuyerReference>991-12345-67</ram:BuyerReference>');
    const e = lesen.eRechnungLesen(xml)!;
    expect(e).toMatchObject({ xrechnung: true, nummer: r.nummer, brutto: r.betrag });
  });
  it('Entwurf → 409; fremde Sicht → 404; unzulässige Kennung → 400', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv', kontaktId: 'c-anna1' });
    expect((await holen(n.d.rechnung.id)).status).toBe(409);
    const privat = await gestellt('kdc'); // Selbstständigkeit = Privat — die Business-Sicht bekommt sie nicht
    expect((await holen(privat.id, 'partner')).status).toBe(404);
    expect((await holen('../x')).status).toBe(400);
  });
});

describe('Eingang: /api/beleg liest E-Rechnungen aus der Datei — ohne Modell', () => {
  const senden = async (bytes: Uint8Array | string, medientyp: string, name: string) => {
    const datei = Buffer.from(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes).toString('base64');
    const r = await beleg.POST(new Request('http://test/api/beleg', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ datei, medientyp, name }) }));
    return { status: r.status, d: await r.json() };
  };
  it('eigene ZUGFeRD-PDF → Vorschlag aus der XML (Richtung Ausgang)', async () => {
    const r = await gestellt('kdv');
    const a = await senden(await pdfBytes(r), 'application/pdf', 'rechnung.pdf');
    expect(a.d.ok, JSON.stringify(a.d)).toBe(true);
    expect(a.d.beleg).toMatchObject({ quelle: 'e-rechnung', format: 'ZUGFeRD/Factur-X', richtung: 'ausgang', rechnungsnummer: r.nummer, betragBrutto: r.betrag, partner: 'Muster GmbH' });
  });
  it('reine XRechnung (XML) eines Lieferanten → Richtung Eingang', async () => {
    const { ciiXml } = await import('@/lib/finanzen/erechnung/cii');
    const xml = ciiXml({ r: { id: 'r-x', firmaId: 'kdv', kunde: 'Beispiel Ventures UG (haftungsbeschränkt)', titel: 'Lizenz', betrag: 0, status: 'gestellt', nummer: 'LF-1', datum: '2026-10-20', faellig: '2026-11-03', leistungVon: '2026-10-20',
      empfaenger: { firma: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', ustId: 'DE123456789' },
      positionen: [{ id: 'p1', titel: 'Lizenz', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 10000, ustSatz: 19 }] } as Rechnung,
      g: { id: 'kdv', firmierung: 'Lieferant Beispiel AG', strasse: 'Weg 2', plz: '99999', ort: 'Anderswo', ustId: 'DE999999999', bank: { iban: IBAN } }, kleinunternehmer: false }, 'xrechnung');
    const a = await senden(xml, 'application/xml', 'rechnung.xml');
    expect(a.d.ok, JSON.stringify(a.d)).toBe(true);
    expect(a.d.beleg).toMatchObject({ richtung: 'eingang', partner: 'Lieferant Beispiel AG', betragNetto: 100, betragBrutto: 119, ustSatz: 19, format: 'XRechnung (CII)', faellig: '2026-11-03' });
  });
  it('XXE-XML → abgelehnt, nichts gelesen', async () => {
    const a = await senden('<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><Invoice><ID>&x;</ID></Invoice>', 'text/xml', 'boese.xml');
    expect(a.d.ok).toBe(false);
    expect(a.d.error).toContain('nicht lesbar');
    expect(JSON.stringify(a.d)).not.toContain('root:');
  });
  it('PDF ohne E-Rechnung und ohne Modell-Schlüssel → der bisherige Hinweis', async () => {
    const r = await gestellt('kdc');
    const a = await senden(await pdfBytes(r), 'application/pdf', 'scan.pdf');
    expect(a.d.ok).toBe(false);
    expect(a.d.error).toContain('ANTHROPIC_API_KEY');
  });
});
