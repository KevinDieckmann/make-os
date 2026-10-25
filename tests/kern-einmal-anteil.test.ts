// ─── Kern-Reste 3 (25.10.): der Einmal-Anteil und die Zusatzmodule überall — Ist-Basis der Planung und CSV-Export ──────────────────────────────────────
// Befund: die Ist-Vorschläge der Finanzplanung (`istBasisVorschlaege`) kannten nur den Hauptpreis — der Einmal-Anteil eines gewonnenen Deals
// (`wert.einmalBetrag`) und die Zusatzmodule eines Mandats fehlten; der CSV-Export der Deals nannte den Einmal-Anteil nicht, der der Mandate keine Zusatzmodule.
// Rein, erfundene Werte. Spalten nur am Ende angehängt — keine bestehende verschoben.
import { describe, it, expect } from 'vitest';
import { istBasisVorschlaege } from '@/lib/finanzen/produkte';
import { dealsCsv, mandateCsv } from '@/lib/crm/export';
import { leererBestand } from '@/lib/crm/speicher';
import type { PreisTeil } from '@/lib/crm/produkt-karte';
import type { Chance, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';

const J = '2026-10-24T08:00:00.000Z';
const HEUTE = '2026-10-24';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const SPRINT = {
  id: 'l-sprint', name: 'Probesprint', typ: 'sprint', stufe: 'kern', preis: { betrag: 0, einheit: '' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J,
  preise: [teil({ id: 'pt-1', art: 'fest', betragCent: 150_000 }), teil({ id: 'pt-2', art: 'monatlich', betragCent: 90_000 }), teil({ id: 'pt-3', art: 'tagessatz', betragCent: 120_000, rolle: 'option', mengeJeMonat: 2 })],
} as unknown as Leistung;
const EVENT = { id: 'l-event', name: 'Probe-Event', typ: 'workshop', stufe: 'kern', preis: { betrag: 400, einheit: 'pauschal netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J } as unknown as Leistung;
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Probe GmbH', kontaktIds: [], titel: 'Probesprint Probe', art: 'retainer', leistungId: 'l-sprint', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-11-01', verlaengerung: 'offen', mindestlaufzeitMonate: 6, honorar: { betrag: 900, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  zusatz: [
    { id: 'mz-e-1', leistungId: 'l-sprint', preisTeilId: 'pt-1', honorar: { betragCent: 150_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } },
    { id: 'mz-e-3', leistungId: 'l-sprint', preisTeilId: 'pt-3', honorar: { betragCent: 120_000, basis: 'tag' }, tageJeMonat: 2 },
    { id: 'mz-event', leistungId: 'l-event', ab: '2027-01-01', bis: '2027-06-30', honorar: { betragCent: 40_000, basis: 'monat' } },
    { id: 'mz-inkl', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' },
    { id: 'mz-stk', leistungId: 'l-event', honorar: { betragCent: 5_000, basis: 'einheit' } },
  ],
  ...x,
} as Mandat);
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Probesprint Hafen', kontaktIds: [], firmaId: 'f-hafen', firma: 'Hafen GmbH', art: 'retainer', leistungId: 'l-sprint',
  wert: { betrag: 900, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 }, stufe: 'gewonnen', historie: [], gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J, ...x,
} as unknown as Chance);
const crm = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), leistungen: [SPRINT, EVENT], ...x } as CrmBestand);

describe('Ist-Basis der Planung: Hauptpreis + Zusatzmodule + Einmal-Anteil', () => {
  const v = istBasisVorschlaege(crm({ mandate: [mandat()], chancen: [deal()] }), HEUTE);
  it('Mandat: Hauptpreis wie bisher, dann je Zusatzmodul mit Betrag ein Eintrag — eigene Teile ohne Produkt (nie zweimal im Plan), inklusive und „je Einheit“ nicht', () => {
    const m = v.filter(x => x.quelle === 'mandat');
    expect(m.map(x => [x.teil ?? 'haupt', x.name ?? x.produkt, x.betrag, x.rhythmus, x.produktId ?? null])).toEqual([
      ['haupt', 'Probesprint', 900, 'monatlich', 'l-sprint'],
      ['zusatz:mz-e-1', 'Probesprint · Festpreis', 1500, 'einmalig', null],
      ['zusatz:mz-e-3', 'Probesprint · Tagessatz', 2400, 'monatlich', null],
      ['zusatz:mz-event', 'Probe-Event', 400, 'monatlich', 'l-event'],
    ]);
    expect(m.find(x => x.teil === 'zusatz:mz-e-1')).toMatchObject({ laufzeit: null, start: m[0].start });
    expect(m.find(x => x.teil === 'zusatz:mz-e-3')?.laufzeit).toBe(6);
    // Laufzeit des Moduls aus ab/bis, Start im Monat von ab.
    const ev = m.find(x => x.teil === 'zusatz:mz-event')!;
    expect(ev.laufzeit).toBe(6);
    expect(ev.start).toBeGreaterThan(m[0].start);
  });
  it('gewonnener Deal ohne Mandat: laufender Wert wie bisher, der Einmal-Anteil als eigener Eintrag (vorher fehlte er)', () => {
    const d = v.filter(x => x.quelle === 'deal');
    expect(d.map(x => [x.teil ?? 'haupt', x.name ?? x.produkt, x.betrag, x.rhythmus])).toEqual([['haupt', 'Probesprint', 900, 'monatlich'], ['einmal', 'Probesprint · einmalig', 1500, 'einmalig']]);
    expect(d[1].produktId).toBeUndefined();
    // nur ein Einmal-Anteil (kein laufender Wert) zählt auch
    expect(istBasisVorschlaege(crm({ chancen: [deal({ wert: { betrag: 0, basis: 'monat', einmalBetrag: 800 } })] }), HEUTE).map(x => [x.teil, x.betrag])).toEqual([['einmal', 800]]);
  });
  it('ohne Zusatzmodule und ohne Einmal-Anteil genau wie bisher (ein Eintrag, kein `teil`)', () => {
    const alt = istBasisVorschlaege(crm({ mandate: [mandat({ zusatz: undefined })], chancen: [deal({ id: 'ch-2', wert: { betrag: 900, basis: 'monat', laufzeitMonate: 6 } })] }), HEUTE);
    expect(alt).toHaveLength(2);
    expect(alt.every(x => x.teil === undefined && x.name === undefined)).toBe(true);
    // ein Mandat ohne Honorar, aber mit Zusatzmodul: nur das Modul
    expect(istBasisVorschlaege(crm({ mandate: [mandat({ honorar: { betrag: 0, basis: 'monat', netto: true }, zusatz: [mandat().zusatz![2]] })] }), HEUTE).map(x => x.teil)).toEqual(['zusatz:mz-event']);
  });
});

const zeilen = (csv: string) => csv.replace(/^﻿/, '').trim().split('\n').map(z => z.split(';'));
describe('CSV-Export: Einmal-Anteil und Zusatzmodule als NEUE letzte Spalte', () => {
  it('Deals: WERT_EINMALIG am Ende, die bisherigen Spalten unverändert an ihrem Platz', () => {
    const [kopf, z] = zeilen(dealsCsv({ kontakte: [], crm: crm({ chancen: [deal()] }) }));
    expect(kopf.at(-1)).toBe('WERT_EINMALIG');
    expect(kopf.slice(0, 4)).toEqual(['ID', 'TITEL', 'FIRMA_ID', 'FIRMA']);
    expect(kopf.at(-2)).toBe('GEAENDERT');
    expect(z.at(-1)).toBe('1500');
    expect(z[kopf.indexOf('GESAMTWERT')]).toBe('6900');
    const [, ohne] = zeilen(dealsCsv({ kontakte: [], crm: crm({ chancen: [deal({ wert: { betrag: 900, basis: 'monat' } })] }) }));
    expect(ohne.at(-1)).toBe('');
  });
  it('Mandate: ZUSATZMODULE am Ende — eigene Preis-Teile „<Produkt> · <Teil>“', () => {
    const [kopf, z] = zeilen(mandateCsv({ kontakte: [], crm: crm({ mandate: [mandat()] }) }));
    expect(kopf.at(-1)).toBe('ZUSATZMODULE');
    expect(kopf.at(-2)).toBe('GEAENDERT');
    expect(z.at(-1)).toMatch(/^Probesprint · Festpreis — .+ · Probesprint · Tagessatz — /);
  });
});
