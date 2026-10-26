// ─── Rechnungsstellung nach der Zahlungsweise des Angebots (26.10., Kevin: „danach die Rechnungsstellung darauf anpassen“) ──────────────
// Raten (n Raten, alle k Monate) und Anzahlung aus dem Angebot werden am Mandat zu Rechnungen „Rate i von n“ bzw. Anzahlung/Rest — auf den Cent wie im
// Angebot; die Liquidität plant dieselben Beträge. Erfundene Daten, eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Angebot, AngebotPosition, CrmBestand, Firma, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { mandatVorbelegung, zahlweiseFuerMandat, zahlweiseText } from '@/lib/crm/angebote';
import { honorarText, monatsPositionen, zahlplanMonate, zahlplanPosition } from '@/lib/crm/mandat-zusatz';
import { mandatRatenSaeubern } from '@/lib/crm/produkt-karte';
import { nettoAusBrutto } from '@/lib/finanzen/ust';

const J = '2026-09-01T10:00:00.000Z';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Landing', art: 'projekt', gesellschaft: 'kdv', status: 'aktiv',
  vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2990, basis: 'einmalig', netto: true }, ustSatz: 19, rechnungsrhythmus: 'einmalig',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], start: '2026-11-03', geaendert: J, ...x,
} as unknown as Mandat);
const pos = (o: Partial<AngebotPosition> = {}): AngebotPosition => ({ id: 'p1', titel: 'Landing', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 299000, ustSatz: 19, basis: 'einmalig', ...o });
const angebot = (x: Partial<Angebot> = {}): Angebot => ({
  id: 'ang-r1', gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Landing', nummer: 'KDV-A-2026-0009', positionen: [pos()],
  einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14, status: 'angenommen', version: 1, angelegt: J, geaendert: J, ...x,
} as Angebot);
const ctx = { nettoAusBrutto };

describe('Angebot → Mandat: die Zahlungsweise geht mit', () => {
  it('Raten → raten (ohne Zahlplan), Anzahlung → Zahlplan, eigener Text → offener Punkt; laufendes Honorar → offener Punkt', () => {
    expect(zahlweiseFuerMandat({ zahlweise: { art: 'raten', anzahl: 6, abstandMonate: 1 } }, 'einmalig')).toEqual({ raten: { anzahl: 6, abstandMonate: 1 } });
    expect(zahlweiseFuerMandat({ zahlweise: { art: 'anzahlung', prozent: 30, rest: 'bei Abnahme' } }, 'einmalig')).toEqual({ zahlplan: { anzahlungProzent: 30 } });
    expect(zahlweiseFuerMandat({ zahlweise: { art: 'frei', text: '50/50' } }, 'einmalig').offen?.[0]).toContain('„50/50“');
    expect(zahlweiseFuerMandat({ zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 1 } }, 'monat').offen?.[0]).toContain('3 Raten');
    expect(zahlweiseFuerMandat({}, 'einmalig')).toEqual({});
    const v = mandatVorbelegung(angebot({ zahlweise: { art: 'raten', anzahl: 6, abstandMonate: 1 } }));
    expect(v).toMatchObject({ honorar: { betrag: 2990, basis: 'einmalig' }, raten: { anzahl: 6, abstandMonate: 1 } });
    expect(v.zahlplan).toBeUndefined();
    expect(mandatVorbelegung(angebot()).raten).toBeUndefined();
  });
  it('Säubern am Mandat: 2–12 Raten, 1–12 Monate', () => {
    expect(mandatRatenSaeubern({ anzahl: 6, abstandMonate: 2 })).toEqual({ anzahl: 6, abstandMonate: 2 });
    expect(mandatRatenSaeubern({ anzahl: 13 })).toBeUndefined();
    expect(mandatRatenSaeubern({ anzahl: 1 })).toBeUndefined();
    expect(mandatRatenSaeubern({ anzahl: 4 })).toEqual({ anzahl: 4, abstandMonate: 1 });
  });
});

describe('Raten am Mandat: Monate, Beträge, Positionen (rein)', () => {
  const m = mandat('m-r', { raten: { anzahl: 6, abstandMonate: 1 } });
  it('Monate: ab dem Beginn monatlich bzw. alle 2 Monate — auch nach dem Ende des Mandats', () => {
    expect(zahlplanMonate(m)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
    expect(zahlplanMonate(mandat('m', { raten: { anzahl: 3, abstandMonate: 2 } }))).toEqual(['2026-11', '2027-01', '2027-03']);
    expect(zahlplanMonate(mandat('m', { raten: { anzahl: 3, abstandMonate: 1 }, honorar: { betrag: 900, basis: 'monat', netto: true } }))).toBeNull();
  });
  it('Rate i von n: gleiche Raten, Rest auf der letzten — Summe = Honorar; Angebot nennt dieselben Beträge', () => {
    const betraege = zahlplanMonate(m)!.map(mo => zahlplanPosition(m, mo, ctx)![0].einzelpreisCent);
    expect(betraege).toEqual([49833, 49833, 49833, 49833, 49833, 49835]);
    expect(betraege.reduce((a, b) => a + b, 0)).toBe(299000);
    expect(zahlplanPosition(m, '2026-12', ctx)![0].titel).toBe('Landing — Rate 2 von 6');
    expect(zahlplanPosition(m, '2027-06', ctx)).toEqual([]);
    const satz = zahlweiseText({ positionen: [pos()], zahlweise: { art: 'raten', anzahl: 6, abstandMonate: 1 } })!.replace(/ /g, ' ');
    for (const b of ['498,33 €', '498,35 €']) expect(satz).toContain(b);
    expect(satz).toContain('(netto, zzgl. USt)');
  });
  it('Monatsrechnung: im Ratenmonat nach dem Ende des Mandats trotzdem die Rate; außerhalb der Raten nichts', () => {
    const mitEnde = mandat('m-e', { raten: { anzahl: 3, abstandMonate: 1 }, ende: '2026-11-20' });
    expect(monatsPositionen(mitEnde, '2027-01', { nettoAusBrutto })[0]).toMatchObject({ titel: 'Landing — Rate 3 von 3', einzelpreisCent: 99666 });
    expect(monatsPositionen(mitEnde, '2027-02', { nettoAusBrutto })).toEqual([]);
  });
  it('Honorar in einem Satz', () => {
    expect(honorarText(m).replace(/ /g, ' ')).toBe('2.990 € netto einmalig · 6 Raten (monatlich)');
  });
});

// ── Server: Rechnung je Rate ────────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-raten-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-raten';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-raten-test';
let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/finanzen/rechnung/server');
const z = { person: 'pia', haushalt: 'test-haus', sicht: 'privat' as const, wer: { art: 'person' as const, person: 'pia' } };
const firma = (id: string): Firma => ({ id, name: 'Muster GmbH', rolle: 'kunde', geaendert: J } as Firma);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pia')], einladungen: [] });
  const k: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Test', email: 'c-anna1@example.invalid', firmaId: 'f-muster', firma: 'Muster GmbH', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' } as Kontakt;
  await db.saveJson('kontakte', { kontakte: [k] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [firma('f-muster')], mandate: [mandat('m-raten', { raten: { anzahl: 3, abstandMonate: 1 }, ende: '2026-11-20' }), mandat('m-anz', { zahlplan: { anzahlungProzent: 30 }, ende: '2027-01-15' })] } as unknown as CrmBestand);
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  server = await import('@/lib/finanzen/rechnung/server');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Rechnung aus dem Mandat mit Raten bzw. Anzahlung', () => {
  it('ohne Monat: die erste Rate; Rate 3 nach dem Ende des Mandats geht; ein Monat ohne Zahlung → 409 mit dem nächsten Monat', async () => {
    const r1 = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-raten' });
    expect(r1.rechnung.positionen![0]).toMatchObject({ titel: 'Landing — Rate 1 von 3', einzelpreisCent: 99667 });
    const r3 = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-raten', monat: '2027-01' });
    expect(r3.rechnung.positionen![0]).toMatchObject({ titel: 'Landing — Rate 3 von 3', einzelpreisCent: 99666 });
    expect(r3.rechnung).toMatchObject({ leistungVon: '2027-01-01', leistungBis: '2027-01-31' });
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-raten', monat: '2027-02' })).rejects.toMatchObject({ status: 409 });
  });
  it('Anzahlung 30 % aus dem Angebot: Anzahlung im Beginnmonat, Rest im Endmonat, dazwischen keine leere Rechnung', async () => {
    const a = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-anz', monat: '2026-11' });
    expect(a.rechnung.positionen![0]).toMatchObject({ titel: 'Landing — Anzahlung 30 %', einzelpreisCent: 89700 });
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-anz', monat: '2026-12' })).rejects.toMatchObject({ status: 409, extra: { grund: 'keine-zahlung' } });
    const rest = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-anz', monat: '2027-01' });
    expect(rest.rechnung.positionen![0]).toMatchObject({ titel: 'Landing — Restzahlung 70 %', einzelpreisCent: 209300 });
  });
});
