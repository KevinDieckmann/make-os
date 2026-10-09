// ─── Endprüfung „Nahtstellen Finanzen & Daten“ (09.10.) — was ZWISCHEN den Paketen der Nacht bricht ──────────────────────────────────────
// Über die echten Routen, eigener Datenordner, erfundene Namen und Beträge:
//   A  Rechnung „bezahlt“ (`bu-re-…`) ↔ Kontoauszug (`bu-ka-…`): derselbe Zahlungseingang steht genau EINMAL in den Business-Buchungen — in
//      beiden Reihenfolgen; eine Buchung schluckt nie einen zweiten Umsatz (auch nicht aus einer späteren Datei); Storno findet den verknüpften
//      Eingang; „Rückgängig“ des Kontoauszugs lässt den von der Rechnung benutzten Umsatz stehen.
//   B  Beleg übernehmen ↔ Kontoauszug: dieselbe Ausgabe einmal, in beiden Reihenfolgen.
//   D  Bank-Referenz je Tag neu („NONREF“): der einzige Umsatz eines späteren Tagesauszugs wird übernommen, nicht als „schon da“ verschluckt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-nahtstellen-fin-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-nahtstellen';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

import { camt, testIban, utf8, type CamtPosten } from './fixtures/kontoauszug';
import { bytesZuBase64 } from '@/lib/finanzen/kontoauszug/lesen';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person: string, body?: unknown, methode?: string) => new Request(`http://test${url}`, {
  method: methode ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

const IBAN_UG = testIban('37040044', '532013111');
const IBAN_KDV = testIban('37040044', '532013222');

let db: typeof import('@/lib/store/local-db');
let konten: Route, auszug: Route, finanzplan: Route, beleg: Route;
let ugKonto = '', kdvKonto = '';

type Buchung = { id: string; ort?: string; auszug?: string; betrag: number; wer: string; zweck?: string; rechnungId?: string; beleg?: string; kategorie?: string };
const buchungen = async (ort?: string) => ((await db.loadJson<{ buchungen: Buchung[] }>('buchungen'))?.buchungen ?? []).filter(b => !ort || b.ort === ort);
const summeEin = (l: Buchung[]) => Math.round(l.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag * 100, 0)) / 100;

/** Vorschau → Übernehmen (mit der Kennung der Vorschau). */
async function einlesen(kontoId: string, iban: string, posten: CamtPosten[]) {
  const datei = { inhalt: bytesZuBase64(utf8(camt({ iban, posten }))) };
  const v = await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'vorschau', kontoId, datei }));
  const vj = await v.json() as { basis: string; zahlen: Record<string, number>; abgleiche: number; zeilen: { cent: number; status: string; grund?: string; abgleich?: { id: string } }[] };
  expect(v.status, JSON.stringify(vj)).toBe(200);
  const u = await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'uebernehmen', kontoId, datei, basis: vj.basis }));
  const uj = await u.json() as { ok: boolean; angelegt: number; zugeordnet?: number; nichtsNeu?: boolean; lauf: { id: string } | null };
  expect(u.status, JSON.stringify(uj)).toBe(200);
  return { vorschau: vj, ergebnis: uj };
}
const bezahlt = async (rechnungId: string, am: string) => {
  const r = await finanzplan.PATCH!(anfrage('/api/state/finanzplan', 'pa', { aktion: 'bezahlt', rechnungId, am }, 'PATCH'));
  const j = await r.json() as { ok: boolean; buchung: { id: string; gebucht: string } | null; error?: string };
  expect(r.status, JSON.stringify(j)).toBe(200);
  return j;
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  konten = await import('@/app/api/finanzen/konten/route') as Route;
  auszug = await import('@/app/api/finanzen/konten/auszug/route') as Route;
  finanzplan = await import('@/app/api/state/finanzplan/route') as Route;
  beleg = await import('@/app/api/beleg/uebernehmen/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-n' },
  ], einladungen: [] });
  const rechnung = (id: string, kunde: string, nummer: string, betrag: number, firmaId = 'ug') =>
    ({ id, firmaId, kunde, titel: 'Beratung', nummer, betrag, status: 'gestellt', datum: tag(-20), faellig: tag(-6) });
  await db.saveJson('finanzplan', {
    firmen: [{ id: 'ug', name: 'MAKE', bank: '', kontostand: 500, stand: tag(-30) }],
    rechnungen: [
      rechnung('r-a1', 'Beispiel Kunde GmbH', 'RE-2026-0042', 1190),
      rechnung('r-a3', 'Zweiter Kunde AG', 'RE-2026-0043', 2380),
      rechnung('r-a4', 'Dritte Beispiel KG', 'RE-2026-0044', 595),
      rechnung('r-a5', 'Gleichbetrag Kunde GmbH', 'RE-2026-0045', 1000),
      rechnung('r-a6', 'Gleichbetrag Kunde GmbH', 'RE-2026-0046', 1000),
      rechnung('r-h1', 'Offen Beispiel GmbH', 'RE-2026-0050', 714),
    ],
    zahlungen: [], merkposten: [], produkte: [], uhrwerk: { letztesMeeting: null, agenda: [] },
  });
  const r = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [
    { op: 'konto-neu', konto: { name: 'Geschäftskonto MAKE', art: 'giro', ort: 'ug', iban: IBAN_UG } },
    { op: 'konto-neu', konto: { name: 'Geschäftskonto KDV', art: 'giro', ort: 'kdv', iban: IBAN_KDV } },
  ] }));
  const j = await r.json();
  expect(r.status, JSON.stringify(j)).toBe(200);
  [ugKonto, kdvKonto] = j.neu;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('A · Rechnung bezahlt ↔ Kontoauszug: ein Zahlungseingang, einmal', () => {
  it('erst „bezahlt“, dann der Kontoauszug: der Bank-Umsatz ist „schon gebucht“ — 1.190 € stehen einmal da', async () => {
    const b = await bezahlt('r-a1', tag(-3));
    expect(b.buchung).toMatchObject({ id: 'bu-re-r-a1', gebucht: 'neu' });
    const { vorschau, ergebnis } = await einlesen(ugKonto, IBAN_UG, [
      { betrag: '1190.00', datum: tag(-2), name: 'BEISPIEL KUNDE GMBH', zweck: ['RE-2026-0042 Beratung'] },
      { betrag: '3.20', dbit: true, datum: tag(-2), name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    ]);
    const zeile = vorschau.zeilen.find(z => z.cent === 119000)!;
    expect(zeile).toMatchObject({ status: 'vorhanden', abgleich: { id: 'bu-re-r-a1' } });
    expect(vorschau.zahlen).toMatchObject({ neu: 1, vorhanden: 1 });
    expect(ergebnis).toMatchObject({ angelegt: 1, zugeordnet: 1 });
    const ug = await buchungen('ug');
    expect(summeEin(ug)).toBe(1190);
    expect(ug.filter(x => x.betrag > 0)).toHaveLength(1);
  });

  it('derselbe Auszug noch einmal: nichts Neues (die Zuordnung ist festgehalten)', async () => {
    const datei = { inhalt: bytesZuBase64(utf8(camt({ iban: IBAN_UG, posten: [
      { betrag: '1190.00', datum: tag(-2), name: 'BEISPIEL KUNDE GMBH', zweck: ['RE-2026-0042 Beratung'] },
      { betrag: '3.20', dbit: true, datum: tag(-2), name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    ] }))) };
    const v = await (await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'vorschau', kontoId: ugKonto, datei }))).json() as { zahlen: Record<string, number>; abgleiche: number };
    expect(v.zahlen).toMatchObject({ neu: 0, vorhanden: 2 });
    expect(v.abgleiche).toBe(0);
  });

  it('eine zweite, gleich hohe Zahlung desselben Kunden (spätere Datei) wird übernommen — die Rechnungsbuchung schluckt sie nicht', async () => {
    const { ergebnis } = await einlesen(ugKonto, IBAN_UG, [{ betrag: '1190.00', datum: tag(-1), name: 'BEISPIEL KUNDE GMBH', zweck: ['Abschlag Folgeauftrag'] }]);
    expect(ergebnis).toMatchObject({ angelegt: 1 });
    expect(summeEin(await buchungen('ug'))).toBe(2380);
  });

  it('erst der Kontoauszug, dann „bezahlt“: kein zweiter Eingang — der Bank-Umsatz bekommt den Bezug; Storno findet ihn; Rückgängig lässt ihn stehen', async () => {
    const { ergebnis } = await einlesen(ugKonto, IBAN_UG, [{ betrag: '2380.00', datum: tag(-4), name: 'Zweiter Kunde AG', zweck: ['Rechnung RE 2026 0043'] }]);
    expect(ergebnis.angelegt).toBe(1);
    const lauf = ergebnis.lauf!.id;
    const vorher = summeEin(await buchungen('ug'));
    const b = await bezahlt('r-a3', tag(-1));
    expect(b.buchung).toMatchObject({ gebucht: 'verknuepft' });
    const ug = await buchungen('ug');
    expect(ug.some(x => x.id === 'bu-re-r-a3')).toBe(false);
    expect(summeEin(ug)).toBe(vorher);
    const bank = ug.find(x => x.rechnungId === 'r-a3')!;
    expect(bank.id.startsWith('bu-ka-')).toBe(true);
    // Noch einmal „bezahlt“ (Wiederholung): nichts Neues.
    expect((await bezahlt('r-a3', tag(-1))).buchung).toMatchObject({ gebucht: 'vorhanden' });
    // Storno: die Gegenbuchung entsteht zum verknüpften Eingang — ohne Lauf-Marke des Kontoauszugs.
    const s = await finanzplan.PATCH!(anfrage('/api/state/finanzplan', 'pa', { aktion: 'storno', rechnungId: 'r-a3', grund: 'Testfall Storno' }, 'PATCH'));
    expect(s.status).toBe(200);
    const gegen = (await buchungen('ug')).find(x => x.id === 'bu-st-r-a3')!;
    expect(gegen).toMatchObject({ betrag: -2380, rechnungId: 'r-a3' });
    expect(gegen.auszug).toBeUndefined();
    // Rückgängig des Kontoauszugs: der von der Rechnung benutzte Umsatz bleibt (Konflikt), die Gegenbuchung auch.
    const z = await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'zuruecknehmen', laufId: lauf }));
    const zj = await z.json() as { entfernt: number; konflikte: unknown[] };
    expect(zj).toMatchObject({ entfernt: 0 });
    expect(zj.konflikte).toHaveLength(1);
    const nach = await buchungen('ug');
    expect(nach.some(x => x.id === bank.id)).toBe(true);
    expect(nach.some(x => x.id === 'bu-st-r-a3')).toBe(true);
  });

  it('zwei gleich hohe Rechnungen desselben Kunden, beide im Auszug: jede Buchung bekommt genau einen Umsatz', async () => {
    await bezahlt('r-a5', tag(-6));
    await bezahlt('r-a6', tag(-5));
    const { vorschau } = await einlesen(ugKonto, IBAN_UG, [
      { betrag: '1000.00', datum: tag(-5), name: 'Gleichbetrag Kunde GmbH', zweck: ['RE-2026-0045'] },
      { betrag: '1000.00', datum: tag(-4), name: 'Gleichbetrag Kunde GmbH', zweck: ['RE-2026-0046'] },
      { betrag: '1000.00', datum: tag(-3), name: 'Gleichbetrag Kunde GmbH', zweck: ['Vorauszahlung'] },
    ]);
    const ids = vorschau.zeilen.filter(z => z.cent === 100000).map(z => z.abgleich?.id ?? z.status);
    expect(ids).toEqual(['bu-re-r-a5', 'bu-re-r-a6', 'neu']);
  });

  it('ein gleich hoher Eingang eines ANDEREN Kunden ohne Rechnungsnummer bleibt ein eigener Umsatz', async () => {
    await bezahlt('r-a4', tag(-2));
    const { vorschau } = await einlesen(ugKonto, IBAN_UG, [{ betrag: '595.00', datum: tag(-1), name: 'Ganz Andere Firma GmbH', zweck: ['Gutschrift'] }]);
    expect(vorschau.zeilen[0]).toMatchObject({ status: 'neu' });
  });
});

describe('B · Beleg übernehmen ↔ Kontoauszug: eine Ausgabe, einmal', () => {
  it('erst der Kontoauszug, dann der Beleg: zugeordnet statt zweite Buchung (Kategorie aus dem Beleg)', async () => {
    await einlesen(kdvKonto, IBAN_KDV, [{ betrag: '119.00', dbit: true, datum: tag(-5), name: 'Software Beispiel GmbH', zweck: ['Abo Oktober'] }]);
    const r = await beleg.POST!(anfrage('/api/beleg/uebernehmen', 'pa', { ziel: 'buchung', firma: 'kdv', partner: 'Software Beispiel GmbH', datum: tag(-7), betragBrutto: 119, kategorie: 'Software', anfrageId: 'beleg-n-1' }));
    const j = await r.json() as { ok: boolean; verknuepft?: boolean; angelegt?: string };
    expect(r.status, JSON.stringify(j)).toBe(200);
    expect(j.verknuepft).toBe(true);
    const kdv = await buchungen('kdv');
    expect(kdv.filter(x => x.betrag < 0)).toHaveLength(1);
    expect(kdv[0]).toMatchObject({ kategorie: 'Software' });
    expect(kdv[0].beleg).toMatch(/^b-/);
  });

  it('erst der Beleg, dann der Kontoauszug: der Bank-Umsatz ist „schon gebucht“', async () => {
    const r = await beleg.POST!(anfrage('/api/beleg/uebernehmen', 'pa', { ziel: 'buchung', firma: 'kdv', partner: 'Druckerei Beispiel', datum: tag(-8), betragBrutto: 59.5, kategorie: 'Büro', anfrageId: 'beleg-n-2' }));
    expect(r.status).toBe(200);
    const { vorschau } = await einlesen(kdvKonto, IBAN_KDV, [{ betrag: '59.50', dbit: true, datum: tag(-6), name: 'DRUCKEREI BEISPIEL E.K.', zweck: ['Visitenkarten'] }]);
    expect(vorschau.zeilen[0]).toMatchObject({ status: 'vorhanden' });
    expect((await buchungen('kdv')).filter(x => x.betrag === -59.5)).toHaveLength(1);
  });
});

describe('D · Bank-Referenz je Tag neu: kein Umsatz verschwindet als „schon da“', () => {
  it('zwei Tagesauszüge mit je einem Umsatz und derselben Referenz „NONREF“ → beide übernommen', async () => {
    await einlesen(kdvKonto, IBAN_KDV, [{ betrag: '40.00', dbit: true, datum: tag(-3), name: 'Tankstelle Beispiel', zweck: ['Tanken'], ref: 'NONREF' }]);
    const { vorschau, ergebnis } = await einlesen(kdvKonto, IBAN_KDV, [{ betrag: '12.90', dbit: true, datum: tag(-2), name: 'Porto Beispiel', zweck: ['Porto'], ref: 'NONREF' }]);
    expect(vorschau.zeilen[0]).toMatchObject({ status: 'neu' });
    expect(ergebnis.angelegt).toBe(1);
    const kdv = await buchungen('kdv');
    expect(kdv.some(x => x.betrag === -40)).toBe(true);
    expect(kdv.some(x => x.betrag === -12.9)).toBe(true);
  });
});

describe('E · Rückgängig eines Kontoauszugs stellt den Zustand vorher her (Konten-Register × Liquidität × Finanzplanung)', () => {
  const IBAN_PRIVAT = testIban('10010010', '987650001');
  it('Gesellschaft: der erste Saldo machte das Register zur Quelle → nach Rückgängig gilt wieder der Kontostand von vorher (nicht „unbekannt“)', async () => {
    const vorher = (await db.loadJson<{ firmen: { id: string; kontostand: number | null; stand: string | null }[] }>('finanzplan'))!.firmen.find(f => f.id === 'ug')!;
    expect(vorher).toMatchObject({ kontostand: 500, stand: tag(-30) });
    const datei = { inhalt: bytesZuBase64(utf8(camt({ iban: IBAN_UG, ende: { betrag: '1234.56', datum: tag(-1) }, posten: [{ betrag: '1.00', dbit: true, datum: tag(-1), name: 'Kontoführung Beispielbank', zweck: ['Entgelt'] }] }))) };
    const v = await (await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'vorschau', kontoId: ugKonto, datei }))).json() as { basis: string };
    const u = await (await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei, basis: v.basis }))).json() as { saldo: string; lauf: { id: string } };
    expect(u.saldo).toBe('neu');
    const { registerKasseLaden } = await import('@/lib/finanzen/konten/server');
    expect((await registerKasseLaden()).ug).toMatchObject({ betrag: 1234.56 });
    expect((await db.loadJson<{ firmen: { id: string; kontostand: number | null }[] }>('finanzplan'))!.firmen.find(f => f.id === 'ug')!.kontostand).toBe(1234.56);
    const z = await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'zuruecknehmen', laufId: u.lauf.id }));
    expect(z.status).toBe(200);
    expect((await registerKasseLaden()).ug).toBeUndefined();
    expect((await db.loadJson<{ firmen: { id: string; kontostand: number | null; stand: string | null }[] }>('finanzplan'))!.firmen.find(f => f.id === 'ug')).toMatchObject({ kontostand: 500, stand: tag(-30) });
  });

  it('Privat: nach Rückgängig rechnet die Finanzplanung wieder mit ihren eigenen Kontoständen (Register führt Privat nicht mehr — nicht 0 €)', async () => {
    const r = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [{ op: 'konto-neu', konto: { name: 'Girokonto Anna', art: 'giro', ort: 'privat', person: 'pa', iban: IBAN_PRIVAT } }] }));
    const privatKonto = (await r.json()).neu[0] as string;
    const datei = { inhalt: bytesZuBase64(utf8(camt({ iban: IBAN_PRIVAT, ende: { betrag: '321.00', datum: tag(-1) }, posten: [{ betrag: '9.99', dbit: true, datum: tag(-1), name: 'Streaming Beispiel', zweck: ['Abo'] }] }))) };
    const v = await (await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'vorschau', kontoId: privatKonto, datei }))).json() as { basis: string };
    const u = await (await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'uebernehmen', kontoId: privatKonto, datei, basis: v.basis }))).json() as { lauf: { id: string } };
    const { registerFuerPlan } = await import('@/lib/finanzen/konten/server');
    expect((await registerFuerPlan('h-n')).ist?.privat).toMatchObject({ betrag: 321 });
    await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'zuruecknehmen', laufId: u.lauf.id }));
    expect((await registerFuerPlan('h-n')).ist).toBeUndefined();
  });

  it('rein: ein zurückgenommener Saldo eines Kontoauszugs führt nicht — ein zurückgenommener Stand von Hand weiter (bisherige Regel)', async () => {
    const { regiert, kasseFuer } = await import('@/lib/finanzen/konten/register');
    const konto = (art: 'auszug' | 'konten') => ({ id: 'kt-x', name: 'X', art: 'giro' as const, ort: 'ug' as const, angelegtVon: 'pa', angelegtAm: '2026-10-01T00:00:00Z',
      staende: [{ id: 'ks-1', betrag: 10, datum: '2026-10-01', quelle: 'bank' as const, erfasstVon: 'pa', erfasstAm: '2026-10-01T00:00:00Z', herkunft: { art, id: 'l' }, zurueckgenommenAm: '2026-10-02T00:00:00Z' }] });
    expect(regiert([konto('auszug')], o => o === 'ug')).toBe(false);
    expect(kasseFuer([konto('auszug')], o => o === 'ug')).toBeNull();
    expect(regiert([konto('konten')], o => o === 'ug')).toBe(true);
    expect(kasseFuer([konto('konten')], o => o === 'ug')).toMatchObject({ konten: 0 });
  });
});

describe('G · gemischtes Angebot: Einmalposten-Rechnung (Woche 1) und „Rechnung schreiben“ (EIN Rechnungs-Anleger) verrechnen nichts doppelt', () => {
  it('steht die Einmalposten-Rechnung (gestellt), legt „Rechnung über alle Positionen“ keine zweite an (409); storniert → wieder möglich', async () => {
    const speicher = await import('@/lib/crm/speicher');
    const J = '2026-09-01T10:00:00.000Z';
    const mandat = { id: 'm-gemischt1', kunde: 'Gemischt Beispiel GmbH', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J };
    const angebot = { id: 'ang-gemischt1', gesellschaft: 'kdv', mandatId: 'm-gemischt1', titel: 'Einführung + Begleitung', nummer: 'KDV-A-2026-0099', status: 'angenommen', version: 1, gestelltAm: J, angelegt: J, geaendert: J, einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14,
      positionen: [
        { id: 'p1', titel: 'Einführung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' },
        { id: 'p2', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 50000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 },
      ] };
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat], angebote: [angebot] });
    const { entwurfNeu, einmalRechnungId } = await import('@/lib/finanzen/rechnung/server');
    const z = { person: 'pa', haushalt: 'h-n', sicht: 'privat' as const };
    const e1 = await entwurfNeu({ quelle: 'angebot', angebotId: 'ang-gemischt1', nur: 'einmalig', ...z });
    expect(e1.rechnung.id).toBe(einmalRechnungId('ang-gemischt1'));
    expect(e1.rechnung.betrag).toBe(1190);
    // Die Einmalposten-Rechnung wird gestellt (hier direkt im Bestand — Nummer/PDF prüfen andere Tests).
    await db.updateJson<{ rechnungen: { id: string; status: string; nummer?: string }[] }>('finanzplan', cur => ({ ...cur!, rechnungen: cur!.rechnungen.map(r => (r.id === e1.rechnung.id ? { ...r, status: 'gestellt', nummer: 'KDV-R-2026-0099' } : r)) }));
    const zahl = async () => (await db.loadJson<{ rechnungen: { angebotId?: string }[] }>('finanzplan'))!.rechnungen.filter(r => r.angebotId === 'ang-gemischt1').length;
    await expect(entwurfNeu({ quelle: 'angebot', angebotId: 'ang-gemischt1', ...z })).rejects.toMatchObject({ status: 409 });
    expect(await zahl()).toBe(1);
    // Storniert → die Einmalposten sind nicht mehr verrechnet: eine Rechnung über alle Positionen geht wieder.
    await db.updateJson<{ rechnungen: { id: string; status: string }[] }>('finanzplan', cur => ({ ...cur!, rechnungen: cur!.rechnungen.map(r => (r.id === e1.rechnung.id ? { ...r, status: 'storniert' } : r)) }));
    const voll = await entwurfNeu({ quelle: 'angebot', angebotId: 'ang-gemischt1', ...z });
    expect(voll.vorhanden).toBe(false);
    expect(await zahl()).toBe(2);
  });
});

describe('H · Vorschau sagt, wo dasselbe Geld sonst doppelt zählt oder still wegfällt', () => {
  const vorschau = async (kontoId: string, iban: string, posten: CamtPosten[], ende?: { betrag: string; datum: string }) => {
    const datei = { inhalt: bytesZuBase64(utf8(camt({ iban, posten, ...(ende ? { ende } : {}) }))) };
    const r = await auszug.POST!(anfrage('/api/finanzen/konten/auszug', 'pa', { aktion: 'vorschau', kontoId, datei }));
    const j = await r.json() as { hinweise: string[]; zeilen: { status: string }[] };
    expect(r.status, JSON.stringify(j)).toBe(200);
    return j;
  };
  it('Eingang passt zu einer offenen Rechnung bzw. zu einer offenen Forderung des 0-Punkts → Hinweis „dort bezahlt setzen“ (gebucht wird trotzdem nur der Umsatz)', async () => {
    const v = await vorschau(ugKonto, IBAN_UG, [{ betrag: '714.00', datum: tag(-1), name: 'Offen Beispiel GmbH', zweck: ['RE-2026-0050'] }]);
    expect(v.zeilen[0].status).toBe('neu');
    expect(v.hinweise.join(' ')).toMatch(/offenen Rechnung RE-2026-0050.*„bezahlt“/);
    await db.saveJson('business-eroeffnung', { eintraege: [{ id: 'er-hinweis-1', firma: 'kdv', stichtag: tag(-60), kontostand: 0, forderungen: [{ name: 'Altkunde Beispiel GmbH', betrag: 333, rechnungsnr: 'AR-2026-77' }], gesetztVon: 'pa', gesetztAm: new Date().toISOString() }] });
    const w = await vorschau(kdvKonto, IBAN_KDV, [{ betrag: '333.00', datum: tag(-1), name: 'ALTKUNDE BEISPIEL', zweck: ['Ausgleich AR-2026-77'] }]);
    expect(w.hinweise.join(' ')).toMatch(/offenen Forderung des 0-Punkts.*„bezahlt am“/);
    await db.saveJson('business-eroeffnung', { eintraege: [] });
  });
  it('erster Saldo einer Gesellschaft: Übergang zum Konten-Register und Konten ohne Stand werden genannt', async () => {
    await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [{ op: 'konto-neu', konto: { name: 'Tagesgeld KDV', art: 'tagesgeld', ort: 'kdv' } }] }));
    const v = await vorschau(kdvKonto, IBAN_KDV, [{ betrag: '5.00', dbit: true, datum: tag(-1), name: 'Gebühr Beispiel', zweck: ['Entgelt'] }], { betrag: '995.00', datum: tag(-1) });
    const t = v.hinweise.join(' ');
    expect(t).toMatch(/führt das Konten-Register den Kontostand/);
    expect(t).toMatch(/1 weiteres Konto .* noch keinen Stand/);
  });
  it('erster Privat-Saldo: die eigenen Kontostände der Finanzplanung, die dann nicht mehr zählen, werden genannt', async () => {
    await db.saveJson('finanzen-plan--h-n', { posten: [{ id: 'po-tagesgeld', art: 'konto', einheit: 'privat', name: 'Tagesgeld', betrag: 2000 }] });
    const iban = testIban('10010010', '987650002');
    const r = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [{ op: 'konto-neu', konto: { name: 'Girokonto Zwei', art: 'giro', ort: 'privat', person: 'pa', iban } }] }));
    const id = (await r.json()).neu[0] as string;
    const v = await vorschau(id, iban, [{ betrag: '1.00', dbit: true, datum: tag(-1), name: 'Kiosk Beispiel', zweck: ['Zeitung'] }], { betrag: '100.00', datum: tag(-1) });
    expect(v.hinweise.join(' ')).toMatch(/einem eigenen Kontostand \(zusammen 2\.000,00 €\)/);
  });
});

describe('I · 0-Punkt-OP-Liste (Daten-Assistent) ↔ Rechnung im Finanzplan: dieselbe Rechnung zählt einmal', () => {
  it('gleiche Gesellschaft + gleiche Rechnungsnummer: einmal als offener Posten; im Finanzplan bezahlt → erledigt; ohne Nummer bzw. ohne Eröffnung wie bisher', async () => {
    const { abEroeffnung } = await import('@/lib/business/eroeffnung');
    const e = { id: 'er-op-1', firma: 'ug' as const, stichtag: '2026-10-01', kontostand: 0, gesetztVon: 'pa', gesetztAm: '2026-10-01T08:00:00Z',
      forderungen: [{ name: 'Altkunde Beispiel GmbH', betrag: 500, rechnungsnr: 'RE-2026-0031' }, { name: 'Ohne Nummer Beispiel', betrag: 70 }] };
    // Ältere Rechnung ohne Rechnungsdatum, fällig nach dem Stichtag — sie wird nicht archiviert.
    const r = (status: string) => ({ id: 'r-op', firmaId: 'ug', kunde: 'Altkunde Beispiel GmbH', titel: 'Beratung', betrag: 500, status, nummer: 're 2026 0031', faellig: '2026-10-15' });
    const offen = (b: { rechnungen?: { betrag: number; status: string }[] }) => (b.rechnungen ?? []).filter(x => x.status !== 'bezahlt' && x.status !== 'storniert').reduce((s, x) => s + x.betrag, 0);
    expect(offen(abEroeffnung({ rechnungen: [r('gestellt')] }, { ug: e }))).toBe(570);
    expect(offen(abEroeffnung({ rechnungen: [r('bezahlt')] }, { ug: e }))).toBe(70);
    expect(offen(abEroeffnung({ rechnungen: [{ ...r('gestellt'), nummer: 'RE-2026-9999' }] }, { ug: e }))).toBe(1070);
    const ohne = { rechnungen: [r('gestellt')] };
    expect(abEroeffnung(ohne, {}).rechnungen).toBe(ohne.rechnungen);
  });
});

describe('J · Mandate-Tabelle zurücknehmen, wenn inzwischen eine Rechnung am Mandat hängt', () => {
  it('die Rechnung (auch ein Entwurf) sperrt: Mandat bleibt, Konflikt gezählt — keine Rechnung zeigt ins Leere', async () => {
    const mt = await import('@/app/api/crm/mandate-tabelle/route') as Route;
    const { tabelleLesen, zeilenAufbereiten, datensaetzeBauen } = await import('@/lib/tabelle/einfuegen');
    const { MANDAT_FELDER } = await import('@/lib/crm/mandate-tabelle');
    const g = tabelleLesen('Kunde\tTitel\tHonorar netto/Monat\nTabelle Beispiel GmbH\tBegleitung\t2.000,00\n');
    if (!g.ok) throw new Error(g.fehler);
    const a = zeilenAufbereiten(g.zeilen, MANDAT_FELDER);
    const zeilen = datensaetzeBauen(a, a.vorschlag);
    const v = await (await mt.POST!(anfrage('/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen, gesellschaft: 'ug' }))).json() as { basis: string };
    const u = await (await mt.POST!(anfrage('/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen, gesellschaft: 'ug', basis: v.basis }))).json() as { ok: boolean; laufId: string };
    expect(u.ok).toBe(true);
    const crm = await db.loadJson<{ mandate: { id: string; kunde: string }[] }>('crm');
    const m = crm!.mandate.find(x => x.kunde === 'Tabelle Beispiel GmbH')!;
    const { entwurfNeu } = await import('@/lib/finanzen/rechnung/server');
    const r = await entwurfNeu({ quelle: 'mandat', mandatId: m.id, person: 'pa', haushalt: 'h-n', sicht: 'privat' });
    expect(r.rechnung.betrag).toBe(2380);   // 2.000 € netto + 19 % über ust.ts
    const z = await (await mt.POST!(anfrage('/api/crm/mandate-tabelle', 'pa', { aktion: 'zurueck', laufId: u.laufId }))).json() as { ok: boolean; mandate: number; konflikte: number };
    expect(z).toMatchObject({ ok: true, mandate: 0 });
    expect(z.konflikte).toBeGreaterThanOrEqual(1);
    expect((await db.loadJson<{ mandate: { id: string }[] }>('crm'))!.mandate.some(x => x.id === m.id)).toBe(true);
  });
});

describe('Regel „dieselbe Zahlung“ (rein)', () => {
  it('Name ohne Rechtsform und Allerweltswörter, Nummer ohne Trennzeichen, Fenster 14 Tage, Betrag auf den Cent', async () => {
    const { gleicheZahlung, namenPassen, nummerImText, trefferStufe } = await import('@/lib/finanzen/zahlung-abgleich');
    expect(namenPassen('BEISPIEL KUNDE GMBH', 'Beispiel Kunde GmbH & Co. KG')).toBe(true);
    expect(namenPassen('Deutsche Beispiel AG', 'Deutsche Andere GmbH')).toBe(false);
    expect(namenPassen('GmbH', 'GmbH')).toBe(false);
    expect(nummerImText('RE-2026-0042', 'Zahlung re 2026 0042 danke')).toBe(true);
    expect(nummerImText('RE1', 'RE1')).toBe(false);
    const bank = { datum: '2026-10-10', cent: 119000, gegenpartei: 'Beispiel Kunde GmbH', zweck: 'RE-2026-0042' };
    expect(trefferStufe(bank, { datum: '2026-10-01', cent: 119000, name: 'Ganz anders', nummer: 'RE-2026-0042' })).toBe(0);
    expect(trefferStufe(bank, { datum: '2026-10-01', cent: 119000, name: 'Beispiel Kunde' })).toBe(1);
    expect(gleicheZahlung(bank, { datum: '2026-09-25', cent: 119000, name: 'Beispiel Kunde' })).toBe(false);
    expect(gleicheZahlung(bank, { datum: '2026-10-10', cent: 118999, name: 'Beispiel Kunde' })).toBe(false);
    expect(gleicheZahlung(bank, { datum: '2026-10-10', cent: -119000, name: 'Beispiel Kunde' })).toBe(false);
  });
});
