// ─── Rechnung: Teilmonat anteilig, Angebots-Nr. (Kevins Entscheidungen 18.10.) ──
// Gesamtprüfung L1 › B9: die erste Monatsrechnung eines Mandats, das mitten im Monat beginnt, rechnete den vollen Monat; die
// Angebots-Nr. der Monatsrechnung blieb leer. Erfundene Daten, eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Angebot, CrmBestand, Firma, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import {
  leistungsmonat, mandatLaeuftIm, mandatMonatVorgabe, ausserhalbLaufzeit, anteilText, positionAusMandat,
} from '@/lib/finanzen/rechnung/regeln';
import { nettoAusBrutto, bruttoAusNetto } from '@/lib/finanzen/ust';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');

// ── Rein ────────────────────────────────────────────────────────────────────

describe('Teilmonat: Leistungszeitraum und Anteil (rein)', () => {
  it('Beginn am 17.10. → 17.10.–31.10., 15 von 31 Tagen', () => {
    expect(leistungsmonat({ start: '2026-10-17' }, '2026-10')).toEqual({ monat: '2026-10', von: '2026-10-17', bis: '2026-10-31', tage: 15, monatsTage: 31, anteilig: true });
  });
  it('Beginn am 1. (bzw. ohne Beginn) → voller Monat, nicht anteilig', () => {
    expect(leistungsmonat({ start: '2026-10-01' }, '2026-10')).toMatchObject({ von: '2026-10-01', bis: '2026-10-31', tage: 31, anteilig: false });
    expect(leistungsmonat({}, '2026-11')).toMatchObject({ von: '2026-11-01', bis: '2026-11-30', tage: 30, monatsTage: 30, anteilig: false });
    expect(leistungsmonat({ start: '2026-05-12' }, '2026-10')).toMatchObject({ tage: 31, anteilig: false });
  });
  it('Ende mitten im Monat → anteilig bis zum Ende; Beginn und Ende im selben Monat', () => {
    expect(leistungsmonat({ start: '2026-05-01', ende: '2026-12-15' }, '2026-12')).toMatchObject({ von: '2026-12-01', bis: '2026-12-15', tage: 15, monatsTage: 31, anteilig: true });
    expect(leistungsmonat({ start: '2026-10-10', ende: '2026-10-20' }, '2026-10')).toMatchObject({ von: '2026-10-10', bis: '2026-10-20', tage: 11, anteilig: true });
  });
  it('Schaltjahr-Februar: 29 Tage (2028), sonst 28', () => {
    expect(leistungsmonat({ start: '2028-02-15' }, '2028-02')).toMatchObject({ von: '2028-02-15', bis: '2028-02-29', tage: 15, monatsTage: 29, anteilig: true });
    expect(leistungsmonat({ start: '2027-02-15' }, '2027-02')).toMatchObject({ bis: '2027-02-28', tage: 14, monatsTage: 28 });
    expect(leistungsmonat({}, '2028-02')).toMatchObject({ tage: 29, monatsTage: 29, anteilig: false });
  });
  it('außerhalb der Laufzeit: 0 Tage; Vorgabe-Monat in die Laufzeit geklemmt; Satz nennt den richtigen Monat', () => {
    expect(leistungsmonat({ start: '2026-11-03' }, '2026-10')).toMatchObject({ tage: 0, anteilig: false });
    expect(mandatLaeuftIm({ start: '2026-11-03' }, '2026-10')).toBe(false);
    expect(mandatLaeuftIm({ start: '2026-05-01', ende: '2026-08-31' }, '2026-09')).toBe(false);
    expect(mandatLaeuftIm({ start: '2026-10-31' }, '2026-10')).toBe(true);
    expect(mandatMonatVorgabe({ start: '2026-11-03' }, '2026-10-05')).toBe('2026-11');
    expect(mandatMonatVorgabe({ start: '2026-01-01', ende: '2026-08-31' }, '2026-10-05')).toBe('2026-08');
    expect(mandatMonatVorgabe({ start: '2026-01-01' }, '2026-10-05')).toBe('2026-10');
    expect(ausserhalbLaufzeit({ start: '2026-11-03' }, '2026-10')).toBe('Das Mandat beginnt am 03.11.2026 — für Oktober 2026 gibt es keine Monatsrechnung. Die erste ist für November 2026.');
    expect(ausserhalbLaufzeit({ ende: '2026-08-31' }, '2026-10')).toContain('Die letzte ist für August 2026.');
    expect(leistungsmonat({}, '2026-13')).toBeNull();
  });
  it('Text der Position: ab · bis · von–bis', () => {
    expect(anteilText(leistungsmonat({ start: '2026-10-17' }, '2026-10')!)).toBe('anteilig ab 17.10., 15 von 31 Tagen');
    expect(anteilText(leistungsmonat({ ende: '2026-12-15' }, '2026-12')!)).toBe('anteilig bis 15.12., 15 von 31 Tagen');
    expect(anteilText(leistungsmonat({ start: '2026-10-10', ende: '2026-10-20' }, '2026-10')!)).toBe('anteilig 10.10.–20.10., 11 von 31 Tagen');
  });
});

describe('Teilmonat: Betrag der Position (rein, auf den Cent über ust.ts)', () => {
  const m = (x: Partial<Mandat> = {}) => ({ titel: 'Begleitung', honorar: { betrag: 4500, basis: 'monat' as const, netto: true }, ustSatz: 19, leistungen: ['Jour fixe'], ...x });
  const opt = { nettoAusBrutto };
  it('netto: 4.500 € × 15 / 31 = 2.177,42 € — Position „pauschal“ mit lesbarem Anteil', () => {
    const p = positionAusMandat(m(), '2026-10', { ...opt, anteil: leistungsmonat({ start: '2026-10-17' }, '2026-10') });
    expect(p).toMatchObject({ titel: 'Begleitung — Oktober 2026 (anteilig ab 17.10., 15 von 31 Tagen)', menge: 1, einheit: 'pauschal', einzelpreisCent: 217742, ustSatz: 19, text: '• Jour fixe' });
  });
  it('brutto-Honorar: erst der Anteil vom Honorar, dann netto über ust.ts', () => {
    const p = positionAusMandat(m({ honorar: { betrag: 5355, basis: 'monat', netto: false } }), '2026-10', { ...opt, anteil: leistungsmonat({ start: '2026-10-17' }, '2026-10') });
    expect(p.einzelpreisCent).toBe(Math.round(nettoAusBrutto(2591.13, 19) * 100)); // 5.355 × 15/31 = 2.591,129… → 2.591,13
  });
  it('voller Monat bzw. ohne Anteil: wie bisher (bit-gleich); Tages-Honorar wird nie anteilig', () => {
    const alt = positionAusMandat(m(), '2026-10', opt);
    expect(alt).toEqual({ id: 'p1', titel: 'Begleitung — Oktober 2026', text: '• Jour fixe', menge: 1, einheit: 'Monat', einzelpreisCent: 450000, ustSatz: 19 });
    expect(positionAusMandat(m(), '2026-10', { ...opt, anteil: leistungsmonat({ start: '2026-10-01' }, '2026-10') })).toEqual(alt);
    const tag = positionAusMandat(m({ honorar: { betrag: 1200, basis: 'tag', netto: true } }), '2026-10', { ...opt, anteil: leistungsmonat({ start: '2026-10-17' }, '2026-10') });
    expect(tag).toMatchObject({ einheit: 'Tag', einzelpreisCent: 120000, titel: 'Begleitung — Oktober 2026' });
  });
  it('Schaltjahr: 3.000 € × 15 / 29 = 1.551,72 €', () => {
    const p = positionAusMandat(m({ honorar: { betrag: 3000, basis: 'monat', netto: true } }), '2028-02', { ...opt, anteil: leistungsmonat({ start: '2028-02-15' }, '2028-02') });
    expect(p.einzelpreisCent).toBe(155172);
    expect(p.titel).toContain('15 von 29 Tagen');
  });
});

describe('Kontakt › Umsatz: Monatsrechnungen mit der Angebots-Nr. zeigen das Angebot nicht noch einmal', () => {
  it('Rechnung mit der Nummer eines Tool-Angebots → keine zweite Angebots-Zeile; fremde Nummer bleibt', async () => {
    const { angeboteListe, umsatzBezug } = await import('@/lib/crm/umsatz');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const a = { id: 'ang-0003-c', gesellschaft: 'kdv', kontaktId: 'c-x1', titel: 'Retainer', nummer: 'KDV-A-2026-0009', positionen: [], einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14, status: 'angenommen', version: 1, gestelltAm: J, angelegt: J, geaendert: J } as unknown as Angebot;
    const crmB = { ...leererBestand(), mandate: [mandat('m-x', { kontaktIds: ['c-x1'], firmaId: undefined, kunde: 'Kunde X' })] } as CrmBestand;
    const r = (id: string, angebot: string) => ({ id, mandatId: 'm-x', firmaId: 'kdv', kunde: 'Kunde X', titel: `Monat ${id}`, betrag: 5355, status: 'geplant', angebot, angebotAm: '2026-10-02' });
    const b = umsatzBezug({ id: 'c-x1' }, crmB, [r('r-okt', 'KDV-A-2026-0009'), r('r-nov', 'KDV-A-2026-0009'), r('r-alt', 'A-1')], '2026-10-18');
    const l = angeboteListe(b, [], [a]);
    expect(l.map(x => x.schluessel).sort()).toEqual(['a:ang-0003-c', 'r:r-alt']);
  });
});

// ── Server (eigener Datenordner) ────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-teilmonat-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-teilmonat';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-teilmonat-test';

let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/finanzen/rechnung/server');
const z = { person: 'pia', haushalt: 'test-haus', sicht: 'privat' as const, wer: { art: 'person' as const, person: 'pia' } };
const J = '2026-09-01T10:00:00.000Z';

const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv',
  vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 4500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as unknown as Mandat);
const angebot = (id: string, x: Partial<Angebot>): Angebot => ({
  id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Begleitung', nummer: 'KDV-A-2026-0007', positionen: [{ id: 'p1', titel: 'Retainer', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 450000, ustSatz: 19, basis: 'monat' }],
  einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14, status: 'angenommen', version: 1, gestelltAm: '2026-10-02T09:00:00.000Z', angenommenAm: '2026-10-09T09:00:00.000Z', angelegt: J, geaendert: J, ...x,
} as Angebot);
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'kunde', geaendert: J, ...x } as Firma);


beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber'), konto('k2', 'ole', 'mitglied')], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' }), k('c-ben1', { vorname: 'Ben', firmaId: 'f-neu', firma: 'Firma f-neu' }),
    k('c-ohne1', { vorname: 'Ohne', nachname: 'Firma' }), k('c-weg1', { vorname: 'Weg', firmaId: 'f-weg', firma: 'Firma f-weg' }),
  ] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    firmen: [
      firma('f-muster', { name: 'Muster GmbH', zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, referenz: 'PO-7' } }),
      firma('f-neu', { zahlung: { referenz: 'PO-9', iban: IBAN, empfaenger: { name: 'Buchhaltung' } } }),
      firma('f-weg', { geloeschtAm: '2026-10-10T08:00:00.000Z' }),
    ],
    mandate: [
      mandat('m-mitte', { start: '2026-10-17' }),
      mandat('m-erster', { start: '2026-10-01' }),
      mandat('m-ende', { start: '2026-05-01', ende: '2026-12-15' }),
      mandat('m-schalt', { start: '2028-02-15', honorar: { betrag: 3000, basis: 'monat', netto: true } }),
      mandat('m-spaet', { start: '2026-11-03' }),
      mandat('m-alt', { start: '2026-10-17' }),
      mandat('m-angebot', { start: '2026-10-01', chanceId: 'ch-1' }),
      mandat('m-neu', { firmaId: 'f-neu', kunde: 'Firma f-neu', kontaktIds: ['c-ben1'], start: '2026-10-01' }),
    ],
    angebote: [angebot('ang-0001-a', { dealId: 'ch-1' }), angebot('ang-0002-b', { dealId: 'ch-2', mandatId: 'm-erster', nummer: 'KDV-A-2026-0008', angenommenAm: '2026-10-12T09:00:00.000Z' })],
  } as unknown as CrmBestand);
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  server = await import('@/lib/finanzen/rechnung/server');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Monatsrechnung aus dem Mandat: Teilmonat anteilig', () => {
  it('Beginn 17.10. → Leistungszeitraum 17.10.–31.10., Betrag 15/31 auf den Cent; je Monat nur eine', async () => {
    const r = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-mitte', monat: '2026-10' });
    expect(r.vorhanden).toBe(false);
    expect(r.rechnung).toMatchObject({ leistungVon: '2026-10-17', leistungBis: '2026-10-31', netto: 2177.42, betrag: bruttoAusNetto(2177.42, 19), status: 'geplant' });
    expect(r.rechnung.positionen![0]).toMatchObject({ titel: 'Begleitung — Oktober 2026 (anteilig ab 17.10., 15 von 31 Tagen)', einzelpreisCent: 217742 });
    expect((await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-mitte', monat: '2026-10' }))).toMatchObject({ vorhanden: true, rechnung: { id: r.rechnung.id } });
    // Der nächste Monat ist wieder voll.
    expect((await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-mitte', monat: '2026-11' })).rechnung).toMatchObject({ leistungVon: '2026-11-01', leistungBis: '2026-11-30', netto: 4500, betrag: 5355 });
  });
  it('Beginn am 1. → voller Monat wie bisher', async () => {
    const r = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-erster', monat: '2026-10' });
    expect(r.rechnung).toMatchObject({ leistungVon: '2026-10-01', leistungBis: '2026-10-31', netto: 4500, betrag: 5355, positionen: [{ einheit: 'Monat', einzelpreisCent: 450000, titel: 'Begleitung — Oktober 2026' }] });
  });
  it('Ende mitten im Monat → anteilig bis zum Ende; danach keine Monatsrechnung (409)', async () => {
    const r = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-ende', monat: '2026-12' });
    expect(r.rechnung).toMatchObject({ leistungVon: '2026-12-01', leistungBis: '2026-12-15', netto: 2177.42 });
    expect(r.rechnung.positionen![0].titel).toContain('anteilig bis 15.12., 15 von 31 Tagen');
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-ende', monat: '2027-01' })).rejects.toMatchObject({ status: 409, extra: { grund: 'ausserhalb-laufzeit' } });
  });
  it('Schaltjahr-Februar → 15 von 29 Tagen', async () => {
    const r = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-schalt', monat: '2028-02' });
    expect(r.rechnung).toMatchObject({ leistungVon: '2028-02-15', leistungBis: '2028-02-29', netto: 1551.72 });
  });
  it('Monat vor dem Beginn → 409 mit dem ersten Monat; ohne Monat nimmt der Server den ersten Monat der Laufzeit', async () => {
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-spaet', monat: '2026-10' })).rejects.toMatchObject({ status: 409, extra: { grund: 'ausserhalb-laufzeit' }, message: expect.stringContaining('Die erste ist für November 2026') });
    const r = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-spaet', jetzt: new Date('2026-10-05T10:00:00Z') });
    expect(r.rechnung).toMatchObject({ leistungVon: '2026-11-03', leistungBis: '2026-11-30' });
    expect(r.rechnung.positionen![0].titel).toContain('anteilig ab 03.11., 28 von 30 Tagen');
  });
  it('ein Monatsentwurf aus der Zeit davor (voller Monat ab dem 1.) zählt — kein zweiter; eine Einmal-Rechnung aus dem Angebot hält den Monat nicht auf', async () => {
    const alt = { id: 'r-alt-oktober', firmaId: 'kdv', mandatId: 'm-alt', kunde: 'Muster GmbH', titel: 'Begleitung — Oktober 2026', betrag: 5355, netto: 4500, status: 'geplant', faellig: '2026-11-14', leistungVon: '2026-10-01', leistungBis: '2026-10-31' };
    const einmal = { id: 'r-einmal-nov', firmaId: 'kdv', mandatId: 'm-alt', angebotId: 'ang-0001-a', kunde: 'Muster GmbH', titel: 'Auftakt — einmalig', betrag: 1190, netto: 1000, status: 'gestellt', faellig: '2026-11-14', leistungVon: '2026-11-01' };
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, alt as Rechnung, einmal as Rechnung] }));
    expect(await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-alt', monat: '2026-10' })).toMatchObject({ vorhanden: true, rechnung: { id: 'r-alt-oktober' } });
    const nov = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-alt', monat: '2026-11' });
    expect(nov.vorhanden).toBe(false);
    expect(nov.rechnung.id).not.toBe('r-einmal-nov');
  });
});

describe('Monatsrechnung: Angebots-Nr. aus dem angenommenen Angebot', () => {
  it('über das Mandat (`mandatId` am Angebot) bzw. über den Deal — nur als Nummer/Datum, nie als `angebotId`', async () => {
    const a = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-erster', monat: '2026-11' })).rechnung;
    expect(a).toMatchObject({ angebot: 'KDV-A-2026-0008', angebotAm: '2026-10-02' });
    expect(a.angebotId).toBeUndefined();
    const b = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-angebot', monat: '2026-10' })).rechnung;
    expect(b).toMatchObject({ angebot: 'KDV-A-2026-0007', angebotAm: '2026-10-02' });
    expect(b.angebotId).toBeUndefined();
    // Ohne Angebot bleibt das Feld leer.
    expect((await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-schalt', monat: '2028-03' })).rechnung.angebot).toBeUndefined();
  });
});
