// ─── Rechnungs-Kreislauf (27.10., Kevin: „den ganzen Rechnungsprozess sauber ziehen … auch Rechnungen, die nicht an Produkten hängen“) ─────
// Angebot → Rechnung → stellen → Zahlungseingang → Storno → korrigierte Kopie; freie Rechnung mit Kunde aus der Kartei und Position aus Produkt;
// die EINE Übersicht (Zustand, Filter, Summen) und die Trennung Privat/Business serverseitig. Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Angebot, CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { rechnungsZustand, rechnungenFiltern, rechnungsSummen, rechnungsZeile } from '@/lib/finanzen/rechnung/uebersicht';
import { bezahltAnwenden, sauberFile } from '@/lib/finanzen/finanzplan-bestand';
import { entwurfAnwenden, pflichtFehlt, positionSaeubern } from '@/lib/finanzen/rechnung/regeln';
import { rechnungDokument } from '@/lib/finanzen/rechnung/dokument';
import { absenderAus } from '@/lib/crm/angebot-dokument';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const HEUTE = '2026-10-27';
const r = (id: string, x: Partial<Rechnung> = {}): Rechnung => ({ id, firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Beratung', betrag: 119, status: 'gestellt', ...x } as Rechnung);

describe('Übersicht (rein): Zustand, Filter, Reihenfolge, Summen, Zeile', () => {
  const liste = [
    r('r-1', { faellig: '2026-10-20', nummer: 'A-1' }), r('r-2', { faellig: '2026-11-05', nummer: 'A-2', betrag: 238 }),
    r('r-3', { status: 'bezahlt', bezahltAm: '2026-10-01', nummer: 'A-3' }), r('r-4', { status: 'geplant', positionen: [] }),
    r('r-5', { status: 'storniert', nummer: 'A-5' }), r('r-6', { art: 'storno', status: 'storniert', nummer: 'A-6' }), r('r-7', { status: 'geplant' }),
  ];
  it('Zustand: überfällig wird gerechnet, nie gespeichert; Planposten ≠ Entwurf', () => {
    expect(liste.map(x => rechnungsZustand(x, HEUTE))).toEqual(['ueberfaellig', 'offen', 'bezahlt', 'entwurf', 'storniert', 'storno', 'geplant']);
  });
  it('Filter + Reihenfolge: Überfälliges oben; „offen“ schließt überfällig ein; Suche über Nummer und Kunde', () => {
    expect(rechnungenFiltern(liste, { filter: 'offen' }, HEUTE).map(x => x.id)).toEqual(['r-1', 'r-2']);
    expect(rechnungenFiltern(liste, { filter: 'alle' }, HEUTE)[0].id).toBe('r-1');
    expect(rechnungenFiltern(liste, { filter: 'storniert' }, HEUTE).map(x => x.id).sort()).toEqual(['r-5', 'r-6']);
    expect(rechnungenFiltern(liste, { filter: 'alle', suche: 'a-3' }, HEUTE).map(x => x.id)).toEqual(['r-3']);
    expect(rechnungenFiltern(liste, { filter: 'alle', gesellschaft: 'kdc' }, HEUTE)).toEqual([]);
  });
  it('Summen in Cent: offen inkl. überfällig, bezahlt im Jahr, Entwürfe; Stornos zählen nie', () => {
    expect(rechnungsSummen(liste, HEUTE)).toEqual({ offenCent: 35700, offen: 2, ueberfaelligCent: 11900, ueberfaellig: 1, bezahltJahrCent: 11900, bezahltJahr: 1, entwuerfe: 1 });
  });
  it('Zeile: der Kunde steht nicht doppelt (Monatsrechnung trägt ihn im Titel); ohne Empfänger klar benannt', () => {
    expect(rechnungsZeile({ kunde: 'Nordwerk GmbH', titel: 'Nordwerk GmbH · Messe — November', nummer: undefined })).toEqual({ titel: 'Entwurf · Nordwerk GmbH', unter: 'Messe — November' });
    expect(rechnungsZeile({ kunde: 'Kunde', titel: 'Rechnung', nummer: 'X-1' }).titel).toBe('X-1 · ohne Empfänger');
  });
});

describe('Regeln (rein): bezahlt nur gestellt, Positionen ohne Titel, Betrag nach dem Leeren, Angebotsnummer im PDF', () => {
  const f = (rs: Rechnung[]) => ({ ...sauberFile(null), rechnungen: rs }) as FinanzplanFile;
  it('ein Entwurf mit Positionen springt nie auf „bezahlt“; Datum nicht in der Zukunft, nicht vor dem Rechnungsdatum; Planposten wie bisher', () => {
    expect(bezahltAnwenden(f([r('e', { status: 'geplant', positionen: [] })]), 'e', HEUTE, undefined, HEUTE)).toMatchObject({ ok: false, status: 409 });
    expect(bezahltAnwenden(f([r('g', { datum: '2026-10-10' })]), 'g', '2026-10-30', undefined, HEUTE)).toMatchObject({ ok: false, status: 400 });
    expect(bezahltAnwenden(f([r('g', { datum: '2026-10-10' })]), 'g', '2026-10-01', undefined, HEUTE)).toMatchObject({ ok: false, status: 400 });
    expect(bezahltAnwenden(f([r('g', { datum: '2026-10-10' })]), 'g', '2026-10-12', undefined, HEUTE)).toMatchObject({ ok: true, rechnung: { status: 'bezahlt', bezahltAm: '2026-10-12' } });
    expect(bezahltAnwenden(f([r('p', { status: 'geplant' })]), 'p', HEUTE, undefined, HEUTE)).toMatchObject({ ok: true });
  });
  it('Position ohne Bezeichnung, aber mit Preis bleibt im Entwurf — stellen erst mit Bezeichnung', () => {
    expect(positionSaeubern({ id: 'p1', titel: '', einzelpreisCent: 5000, menge: 1 }, 0)).toMatchObject({ titel: '', einzelpreisCent: 5000 });
    expect(positionSaeubern({ id: 'p1', titel: '', menge: 1 }, 0)).toBeNull();
    const fehlt = pflichtFehlt({ firmaId: 'kdv', positionen: [{ id: 'p1', titel: '', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 5000, ustSatz: 19 }] } as never, null);
    expect(fehlt.map(x => x.text)).toContain('Eine Position hat noch keine Bezeichnung.');
  });
  it('alle Positionen entfernt → 0 € (kein Phantom-Eingang in der Liquidität)', () => {
    const alt = r('e', { status: 'geplant', betrag: 595, netto: 500, positionen: [{ id: 'p1', titel: 'X', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 50000, ustSatz: 19 }] });
    expect(entwurfAnwenden(alt, { positionen: [] })).toMatchObject({ betrag: 0, netto: 0, positionen: [] });
  });
  it('die Angebotsnummer steht im Dokument (PDF und Vorschau)', () => {
    const d = rechnungDokument(r('e', { angebot: 'KDV-A-2026-0003', angebotAm: '2026-09-15', positionen: [] }), absenderAus({ id: 'kdv' }), { datum: HEUTE });
    expect(d.meta).toContainEqual({ label: 'Zu Angebot', wert: 'KDV-A-2026-0003 vom 15.09.2026' });
  });
});

// ── Route /api/rechnung ──────────────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kreislauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kreislauf';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-kreislauf-test';

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let heute = '';
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
let anf = 0;
const neueAnf = () => `anf-kreislauf-${++anf}`;

/** Frei, vollständig, gestellt — Rechnung der Gesellschaft g. */
async function gestellteRechnung(g = 'kdv', person = 'kevin'): Promise<Rechnung & { fassung: string }> {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g }, person);
  const k = await post({ aktion: 'kunde', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, kundeFirmaId: 'f-muster' }, person);
  expect(k.status, JSON.stringify(k.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: k.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', positionen: [{ id: 'p1', titel: 'Workshop', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 100000, ustSatz: 19 }] } }, person);
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  const st = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung, anfrageId: neueAnf() }, person);
  expect(st.status, JSON.stringify(st.d)).toBe(200);
  return st.d.rechnung;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus', ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' }), k('c-gesperrt1', { nachname: 'Gesperrt', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } } as Partial<Kontakt>)] });
  const J = '2026-09-01T10:00:00.000Z';
  const angebot: Angebot = { id: 'ang-kreis-1', gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Strategie-Sprint', nummer: 'KDV-A-2026-0001', positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 500000, ustSatz: 19, basis: 'einmalig' }], einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 21, status: 'angenommen', version: 1, gestelltAm: J, angelegt: J, geaendert: J } as Angebot;
  const produkt = (id: string, status: string) => ({ id, name: `Produkt ${id}`, status, gesellschaft: 'kdv', preis: { betrag: 900, basis: 'einmalig' }, geaendert: J });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, zielTage: 30 } }], angebote: [angebot], leistungen: [produkt('l-aktiv', 'aktiv'), produkt('l-entwurf', 'entwurf')] } as unknown as CrmBestand);
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

describe('Freie Rechnung: Kunde aus der Kartei, Produkt-Katalog', () => {
  it('Kunde aus der Kartei: Firma belegt Empfänger und Zahlungsziel vor, eine Person nimmt ihre Firma mit; Art. 18 → 404', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv' });
    expect(n.d.rechnung.empfaenger).toBeUndefined();
    const f = await post({ aktion: 'kunde', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, kundeFirmaId: 'f-muster' });
    expect(f.d.rechnung).toMatchObject({ kunde: 'Muster GmbH', kundeFirmaId: 'f-muster', zahlungszielTage: 30, empfaenger: { firma: 'Muster GmbH', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt' } });
    expect(f.d.rechnung.kontaktId).toBeUndefined();
    const p = await post({ aktion: 'kunde', id: n.d.rechnung.id, stand: f.d.rechnung.fassung, kontaktId: 'c-anna1' });
    expect(p.d.rechnung).toMatchObject({ kontaktId: 'c-anna1', kundeFirmaId: 'f-muster', empfaenger: { firma: 'Muster GmbH', name: 'Anna Test' } });
    expect((await post({ aktion: 'kunde', id: n.d.rechnung.id, stand: p.d.rechnung.fassung, kontaktId: 'c-gesperrt1' })).status).toBe(404);
    expect((await post({ aktion: 'kunde', id: n.d.rechnung.id, stand: 'alt', kundeFirmaId: 'f-muster' })).status).toBe(409);
  });
  it('Katalog: nur aktive Produkte; die Kartei ohne eingeschränkte Personen', async () => {
    const k = await holen('?katalog=1');
    expect(k.status).toBe(200);
    expect(k.d.produkte.map((x: { id: string }) => x.id)).toEqual(['l-aktiv']);
    expect(k.d.firmen).toEqual([{ id: 'f-muster', name: 'Muster GmbH' }]);
    expect(k.d.personen.map((x: { id: string }) => x.id)).toEqual(['c-anna1']);
  });
});

describe('Kreislauf: stellen → bezahlt → Storno → korrigierte Kopie', () => {
  it('ein Entwurf wird nicht bezahlt; gestellt: Zukunft → 400, dann bezahlt mit Buchung; zweimal = dieselbe', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv' });
    const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { positionen: [{ id: 'p1', titel: 'X', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 1000, ustSatz: 19 }] } });
    expect((await post({ aktion: 'bezahlt', id: s.d.rechnung.id })).status).toBe(409);
    const g = await gestellteRechnung();
    expect((await post({ aktion: 'bezahlt', id: g.id, am: '2099-01-01' })).status).toBe(400);
    const b = await post({ aktion: 'bezahlt', id: g.id, am: heute, stand: g.fassung });
    expect(b.status, JSON.stringify(b.d)).toBe(200);
    expect(b.d.rechnung).toMatchObject({ status: 'bezahlt', bezahltAm: heute });
    expect(b.d.buchung).toMatchObject({ id: `bu-re-${g.id}`.slice(0, 40) });
    const buchungen = (await db.loadJson<{ buchungen: { id: string; betrag: number }[] }>('buchungen'))!.buchungen;
    expect(buchungen.find(x => x.id === `bu-re-${g.id}`.slice(0, 40))).toMatchObject({ betrag: 1190 });
    const nochmal = await post({ aktion: 'bezahlt', id: g.id, am: heute });
    expect(nochmal.d).toMatchObject({ ok: true, schonBezahlt: true });
  }, 120_000);
  it('Kopie einer gestellten Rechnung: neuer Entwurf ohne Nummer, ohne Leistungszeitraum; nach Storno: Korrektur mit Zeitraum', async () => {
    const g = await gestellteRechnung();
    const k = await post({ aktion: 'kopie', id: g.id, anfrageId: neueAnf() });
    expect(k.status, JSON.stringify(k.d)).toBe(200);
    expect(k.d.rechnung).toMatchObject({ status: 'geplant', kundeFirmaId: 'f-muster', titel: g.titel, betrag: g.betrag, notiz: `Kopie von Rechnung ${g.nummer}` });
    expect(k.d.rechnung.nummer).toBeUndefined();
    expect(k.d.rechnung.leistungVon).toBeUndefined();
    expect(k.d.rechnung.positionen).toHaveLength(1);
    const st = await post({ aktion: 'storno', id: g.id, grund: 'Falscher Betrag', anfrageId: neueAnf() });
    expect(st.status, JSON.stringify(st.d)).toBe(200);
    const korr = await post({ aktion: 'kopie', id: st.d.storno.id, anfrageId: neueAnf() }); // aus der Stornorechnung → kopiert das Original
    expect(korr.d.rechnung).toMatchObject({ status: 'geplant', leistungVon: '2026-10-01', notiz: `Korrektur zu Rechnung ${g.nummer}` });
  }, 120_000);
  it('Storno einer Rechnung ohne PDF (außerhalb gestellt) über dieselbe Route: storniert, der Eintrag bleibt', async () => {
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, r('r-alt-1', { nummer: 'ALT-7', datum: '2026-09-01' })] }));
    const s = await post({ aktion: 'storno', id: 'r-alt-1', grund: 'doppelt erfasst', anfrageId: neueAnf() });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect((await plan()).rechnungen.find(x => x.id === 'r-alt-1')).toMatchObject({ status: 'storniert', stornoGrund: 'doppelt erfasst' });
  });
});

describe('Angebot → Rechnung: einmal', () => {
  it('nach dem Stellen legt ein zweiter Klick keine zweite volle Rechnung an (409 mit Verweis); die Angebotsnummer steht in der Rechnung', async () => {
    const e = await post({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-kreis-1' });
    expect(e.d.rechnung).toMatchObject({ angebot: 'KDV-A-2026-0001', angebotId: 'ang-kreis-1' });
    const s = await post({ aktion: 'speichern', id: e.d.rechnung.id, stand: e.d.rechnung.fassung, felder: { leistungVon: '2026-10-01' } });
    const st = await post({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung, anfrageId: neueAnf() });
    expect(st.status, JSON.stringify(st.d)).toBe(200);
    const zweit = await post({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-kreis-1' });
    expect(zweit.status).toBe(409);
    expect(zweit.d).toMatchObject({ grund: 'angebot-schon-gestellt', rechnungId: e.d.rechnung.id });
    // Die Kopie hängt nicht am Angebot (sie ist keine zweite Rechnung über das Angebot).
    const k = await post({ aktion: 'kopie', id: e.d.rechnung.id, anfrageId: neueAnf() });
    expect(k.d.rechnung.angebotId).toBeUndefined();
  }, 120_000);
});

describe('Privat und Business getrennt — serverseitig', () => {
  let kdcId = '';
  it('Business zeigt keine Rechnung der Selbstständigkeit, Privat genau sie; `re` auf die andere → nur `ort`', async () => {
    kdcId = (await gestellteRechnung('kdc')).id;
    const b = await holen('?bereich=business');
    expect(b.d.rechnungen.every((x: Rechnung) => x.firmaId !== 'kdc')).toBe(true);
    expect(b.d.gesellschaften.map((x: { id: string }) => x.id)).toEqual(['kdv', 'ug']);
    const p = await holen('?bereich=privat');
    expect(p.d.rechnungen.map((x: Rechnung) => x.firmaId)).toEqual(['kdc']);
    expect(p.d.vorgabe).toBe('kdc');
    const umleiten = await holen(`?bereich=business&re=${kdcId}`);
    expect(umleiten.d.ort).toBe('privat');
    expect(JSON.stringify(umleiten.d.rechnungen)).not.toContain(kdcId);
  }, 120_000);
  it('Konto „nur Business“: Privat angefragt → trotzdem Business; Zahlungseingang für Business ja, für die Selbstständigkeit 404', async () => {
    const p = await holen('?bereich=privat', 'partner');
    expect(p.d.bereich).toBe('business');
    expect(JSON.stringify(p.d)).not.toContain(kdcId);
    expect((await holen(`?re=${kdcId}`, 'partner')).d.ort).toBeUndefined();
    expect((await post({ aktion: 'bezahlt', id: kdcId, am: heute }, 'partner')).status).toBe(404);
    const g = await gestellteRechnung('kdv');
    const b = await post({ aktion: 'bezahlt', id: g.id, am: heute }, 'partner');
    expect(b.status, JSON.stringify(b.d)).toBe(200);
    expect((await post({ aktion: 'kopie', id: kdcId }, 'partner')).status).toBe(404);
  }, 120_000);
});
