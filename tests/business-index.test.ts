// Business-Index (25.09.): unsere KSI-Logik mit unseren Zahlen — Punkte, Quellen,
// Trennung der Firmen (Privates nie), jede Kennzahl, Säulen und Gesamt 50/30/20.
import { describe, it, expect } from 'vitest';
import { punkte, ampel, berechne } from '../lib/business/index';
import { MESSEN, istMonate, type Bestand } from '../lib/business/messen';
import { KENNZAHLEN, kennzahlenFuer } from '../lib/business/register';
import type { Mandat, Chance } from '../lib/crm/typen';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const leer = (x: Partial<Bestand> = {}): Bestand => ({
  heute: HEUTE, scope: 'gesamt', firmen: [], rechnungen: [], zahlungen: [], merkposten: [], planposten: [], finance: null,
  grundlageMonate: [], grundlageFixkosten: {}, abschluesse: [], mandate: [], chancen: [], traktion: { score: null, text: '' },
  termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], fte: {}, mrrVerlauf: {}, ...x,
});
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const chance = (id: string, stufe: Chance['stufe'], historie: Chance['historie'], x: Partial<Chance> = {}): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 10000, basis: 'einmalig' }, stufe, historie, qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as Chance);
const mess = (id: string, b: Bestand) => MESSEN[id](b);
const wert = (id: string, b: Bestand) => { const m = mess(id, b); if ('luecke' in m) throw new Error(`${id}: ${m.luecke}`); return m.wert; };
const monate = (von: number, bis: number, u: number, k: number) => Array.from({ length: bis - von + 1 }, (_, i) => ({ monat: `2026-${String(von + i).padStart(2, '0')}`, umsatzNetto: u, kostenNetto: k }));

describe('Punkte und Ampel', () => {
  it('rote Schwelle 20, grüne 100, dazwischen linear; jenseits von Rot bis 0; niedrig gespiegelt; direkt = Wert', () => {
    const hoch = { richtung: 'hoch' as const, gruen: 6, rot: 3 };
    expect([8, 6, 4.5, 3, 1.5, 0].map(w => punkte(w, hoch))).toEqual([100, 100, 60, 20, 10, 0]);
    expect([6, 4, 3, 2].map(w => ampel(w, hoch))).toEqual(['gruen', 'gelb', 'gelb', 'rot']);
    const niedrig = { richtung: 'niedrig' as const, gruen: 40, rot: 55 };
    expect([30, 40, 47.5, 55, 70].map(w => punkte(w, niedrig))).toEqual([100, 100, 60, 20, 0]);
    expect([40, 50, 56].map(w => ampel(w, niedrig))).toEqual(['gruen', 'gelb', 'rot']);
    expect(punkte(63, { richtung: 'hoch', gruen: 70, rot: 40, direkt: true })).toBe(63);
  });
  it('jede Kennzahl hat eine Messung, Schwellen in der richtigen Reihenfolge, Säulen vollständig', () => {
    for (const k of KENNZAHLEN) {
      expect(MESSEN[k.id], k.id).toBeTypeOf('function');
      expect(k.richtung === 'hoch' ? k.gruen > k.rot : k.gruen < k.rot, k.id).toBe(true);
    }
    expect(kennzahlenFuer('kdc').some(k => k.nurGesamt)).toBe(false);
    expect(new Set(KENNZAHLEN.map(k => k.saeule))).toEqual(new Set(['fh', 'ud', 'mt']));
  });
});

describe('Ist-Monate: beste Quelle je Monat', () => {
  it('Monatsabschluss vor Grundlage (Consulting); Gesamt = beide Firmen, sonst Controlling, sonst was da ist', () => {
    const b = leer({
      grundlageMonate: monate(1, 8, 10000, 6000),
      abschluesse: [{ firma: 'kdc', monat: '2026-08', umsatz: 12000, kosten: 7000, personal: 3000 }, { firma: 'kdv', monat: '2026-08', umsatz: 1000, kosten: 500 }],
      finance: { jahr: 2026, zielUmsatz: 300000, zielGewinn: 0, cash: 0, months: Array.from({ length: 12 }, (_, i) => ({ m: String(i), umsatz: i === 6 ? 50000 : 0, kosten: i === 6 ? 20000 : 0 })) },
    });
    expect(istMonate({ ...b, scope: 'kdc' }).slice(-2).map(m => [m.monat, m.umsatz, m.quelle])).toEqual([['2026-07', 10000, 'Grundlage'], ['2026-08', 12000, 'Monatsabschluss']]);
    const g = istMonate(b);
    expect(g.find(m => m.monat === '2026-08')).toMatchObject({ umsatz: 13000, kosten: 7500, personal: 3000 });
    expect(g.find(m => m.monat === '2026-07')).toMatchObject({ umsatz: 50000, quelle: 'Controlling' });
    expect(g.find(m => m.monat === '2026-06')!.quelle).toMatch(/nur 1 von 2 Firmen/);
    expect(istMonate({ ...b, scope: 'kdv' }).map(m => m.monat)).toEqual(['2026-08']);
    expect(g.some(m => m.monat === '2026-09')).toBe(false); // laufender Monat zählt nicht
  });
});

describe('Firmen getrennt, Privates nie', () => {
  const b = leer({
    firmen: [{ id: 'kdc', name: 'C', kontostand: 30000, stand: null }, { id: 'kdv', name: 'V', kontostand: 10000, stand: null }, { id: 'privat', name: 'P', kontostand: 99999, stand: null }],
    rechnungen: [
      { id: 'r1', kunde: 'A', titel: '', betrag: 1000, status: 'gestellt', faellig: '2026-09-01', firmaId: 'kdc' },
      { id: 'r2', kunde: 'B', titel: '', betrag: 3000, status: 'gestellt', faellig: '2026-10-30', firmaId: 'kdc' },
      { id: 'r3', kunde: 'C', titel: '', betrag: 5000, status: 'gestellt', faellig: '2026-09-01', firmaId: 'kdv' },
      { id: 'r4', kunde: 'Privat', titel: '', betrag: 7000, status: 'gestellt', faellig: '2026-09-01', firmaId: 'privat' },
    ],
    planposten: [
      { id: 'p1', titel: 'Miete', betrag: -2000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc', kategorie: 'raum' },
      { id: 'p2', titel: 'Tools', betrag: -1000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdv', kategorie: 'betrieb' },
      { id: 'p3', titel: 'Wohnung', betrag: -1500, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'privat', kategorie: 'privat' },
    ],
  });
  it('Kasse, Forderungen und Kosten je Sicht; Privat zählt in keiner', () => {
    expect(wert('liquiditaet', b)).toBeCloseTo(40000 / 3000);
    expect(wert('liquiditaet', { ...b, scope: 'kdc' })).toBeCloseTo(15);
    expect(wert('liquiditaet', { ...b, scope: 'kdv' })).toBeCloseTo(10);
    expect(wert('ueberfaellig', b)).toBeCloseTo((6000 / 9000) * 100);
    expect(wert('ueberfaellig', { ...b, scope: 'kdc' })).toBeCloseTo(25);
    expect(wert('ueberfaellig', { ...b, scope: 'kdv' })).toBe(100);
    expect(wert('deckung13', { ...b, scope: 'kdc' })).toBeGreaterThan(0);
  });
});

describe('Die Kennzahlen', () => {
  it('Runway: Netto-Verbrauch; wer Gewinn macht, verbraucht nichts', () => {
    const b = leer({ scope: 'kdc', firmen: [{ id: 'kdc', name: 'C', kontostand: 24000, stand: null }], grundlageMonate: monate(6, 8, 10000, 14000) });
    expect(wert('runway', b)).toBe(6);
    expect(mess('runway', { ...b, grundlageMonate: monate(6, 8, 14000, 10000) })).toMatchObject({ anzeige: 'kein Verbrauch' });
  });
  it('DSO erst ab 2 bezahlten Rechnungen mit Daten; Kundenkonzentration; Kosten- und Fixkostenquote', () => {
    const r = (id: string, datum: string, bezahltAm: string) => ({ id, kunde: 'A', titel: '', betrag: 1000, status: 'bezahlt', datum, bezahltAm, firmaId: 'kdc' });
    expect(mess('dso', leer({ rechnungen: [r('a', '2026-08-01', '2026-08-31')] }))).toMatchObject({ luecke: expect.stringContaining('mindestens 2') });
    expect(wert('dso', leer({ rechnungen: [r('a', '2026-08-01', '2026-08-31'), r('b', '2026-07-01', '2026-08-20')] }))).toBe(40);
    expect(wert('konzentration', leer({ mandate: [mandat('a', { kunde: 'Acme', honorar: { betrag: 3000, basis: 'monat', netto: true } }), mandat('b'), mandat('x', { status: 'beendet' })] }))).toBe(75);
    expect(mess('konzentration', leer({ mandate: [mandat('a', { kunde: 'Acme', honorar: { betrag: 3000, basis: 'monat', netto: true } }), mandat('z', { honorar: { betrag: 0, basis: 'monat', netto: true } })] }))).toMatchObject({ quelle: expect.stringContaining('1 Kunde)') });
    const b = leer({ scope: 'kdc', grundlageMonate: monate(1, 8, 10000, 9000), planposten: [{ id: 'p', titel: 'Miete', betrag: -4000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc' }] });
    expect(wert('kostenquote', b)).toBe(90);
    expect(wert('fixkostenquote', b)).toBe(40);
    expect(wert('plan_ist', b)).toBeCloseTo(125);
  });
  it('Kapitaldienst nur aus Business-Krediten; EK-Quote und Quick Ratio aus dem Monatsabschluss', () => {
    const b = leer({ scope: 'kdc', grundlageMonate: monate(1, 8, 10000, 8000) });
    expect(mess('kapitaldienst', b)).toMatchObject({ anzeige: 'kein Kredit' });
    const mitKredit = { ...b, planposten: [{ id: 'k', titel: 'Darlehen', betrag: -1000, rhythmus: 'monatlich' as const, ab: '2026-01-01', sicher: true, firmaId: 'kdc', kategorie: 'kredite' }] };
    expect(wert('kapitaldienst', mitKredit)).toBe(2);
    expect(mess('ek_quote', b)).toHaveProperty('luecke');
    const mitAbschluss = { ...b, firmen: [{ id: 'kdc', name: 'C', kontostand: 8000, stand: null }], abschluesse: [{ firma: 'kdc' as const, monat: '2026-08', eigenkapital: 20000, bilanzsumme: 50000, kurzfrVerbindlichkeiten: 10000 }] };
    expect(wert('ek_quote', mitAbschluss)).toBe(40);
    expect(wert('quick_ratio', mitAbschluss)).toBeCloseTo(0.8);
    // Gesamt braucht beide Firmen, sonst Lücke statt halber Zahl.
    expect(mess('ek_quote', { ...mitAbschluss, scope: 'gesamt' })).toHaveProperty('luecke');
  });
  it('Unternehmer-DNA: Umsatz je Kopf, Personalquote, Fokus, Meetings (ohne Malins Termine), Delegation (ohne Takt), Meilensteine', () => {
    const b = leer({ grundlageMonate: monate(1, 8, 10000, 5000), fte: { kdc: 1 }, planposten: [{ id: 'p', titel: 'Gehalt', betrag: -3000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc', kategorie: 'personal' }] });
    expect(wert('umsatz_kopf', b)).toBe(120000);
    expect(wert('personalquote', b)).toBe(30);
    // Künftig geplante Gehälter zählen nicht rückwirkend.
    const spaeter = { ...b, planposten: [{ id: 'p', titel: 'Neue Stelle', betrag: -9000, rhythmus: 'monatlich' as const, ab: '2026-10-01', sicher: true, firmaId: 'kdc', kategorie: 'personal' }] };
    expect(wert('personalquote', spaeter)).toBe(0);
    const fokus = leer({ bloecke: [{ date: '2026-09-22', dauerMin: 600, art: 'fokus' }, { date: '2026-09-15', dauerMin: 1800, art: 'fokus' }, { date: '2026-09-15', dauerMin: 999, art: 'reha' }] });
    expect(wert('fokuszeit', fokus)).toBe(10);
    const termine = [{ start: '2026-09-22T09:00:00', ende: '2026-09-22T11:00:00', owner: 'kevin' }, { start: '2026-09-23T09:00:00', ende: '2026-09-23T15:00:00', owner: 'both' }, { start: '2026-09-23T09:00:00', ende: '2026-09-23T19:00:00', owner: 'malin' }];
    expect(wert('meetinglast', leer({ termine }))).toBe(2);
    expect(mess('meetinglast', leer({ termine, termineVollstaendig: false }))).toHaveProperty('luecke');
    const auftraege = [...Array(8)].map((_, i) => ({ status: 'fertig', beendet: `2026-09-${10 + i}T10:00:00Z`, anlass: 'Jarvis' })).concat([{ status: 'fertig', beendet: '2026-09-20T10:00:00Z', anlass: 'Takt: Morgenlauf' }]);
    expect(wert('delegation', leer({ auftraege }))).toBe(2);
    expect(wert('meilensteine', leer({ meilensteine: [{ bereich: 'business', fortschritt: 80, erledigt: false }, { bereich: 'business', faellig: '2026-09-01', fortschritt: 90, erledigt: false }, { bereich: 'gesundheit', fortschritt: 0, erledigt: false }] }))).toBe(40);
  });
  it('Markttraktion: Win Rate ab 10 Entscheidungen, Sales Cycle, Kündigungsrate, NRR aus dem Verlauf, CAC', () => {
    const ang = (am: string) => [{ stufe: 'bedarf' as const, am, von: 'k' }, { stufe: 'angebot' as const, am, von: 'k' }];
    const neun = [...Array(9)].map((_, i) => chance(`c${i}`, i < 3 ? 'gewonnen' : 'verloren', ang('2026-03-01T10:00:00Z')));
    expect(mess('win_rate', leer({ chancen: neun }))).toHaveProperty('luecke');
    expect(wert('win_rate', leer({ chancen: [...neun, chance('c9', 'verloren', ang('2026-03-01T10:00:00Z'))] }))).toBe(30);
    const gew = (id: string, start: string, ende: string) => chance(id, 'gewonnen', [{ stufe: 'bedarf', am: start, von: 'k' }, { stufe: 'gewonnen', am: ende, von: 'k' }]);
    expect(wert('sales_cycle', leer({ chancen: [gew('a', '2026-06-01T10:00:00Z', '2026-07-31T10:00:00Z'), gew('b', '2026-07-01T10:00:00Z', '2026-08-10T10:00:00Z')] }))).toBe(50);
    const churn = leer({ mandate: [mandat('a', { start: '2025-01-01' }), mandat('b', { start: '2025-01-01', status: 'beendet', ende: '2026-06-30' })] });
    expect(wert('churn', churn)).toBeGreaterThan(4);
    expect(mess('nrr', leer({ mrrVerlauf: { '2026-09': { A: 1000 } } }))).toHaveProperty('luecke');
    expect(wert('nrr', leer({ mrrVerlauf: { '2026-05': { A: 1000, B: 1000 }, '2026-09': { A: 1500, C: 5000 } } }))).toBe(75);
    const cac = leer({ scope: 'kdc', grundlageMonate: monate(1, 8, 10000, 5000), abschluesse: [{ firma: 'kdc', monat: '2026-08', umsatz: 10000, kosten: 5000, marketingVertrieb: 1000 }], mandate: [mandat('n1', { start: '2026-04-01' }), mandat('n2', { start: '2026-05-01', kunde: 'Neu 2' })] });
    expect(wert('cac', cac)).toBe(6000);
  });
});

describe('Säulen und Gesamt', () => {
  it('50/30/20 über die zählenden Säulen; unter 40 % Abdeckung zählt eine Säule nicht; Firmen ohne Gesamt-Kennzahlen', () => {
    const b = leer({
      firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }, { id: 'kdv', name: 'V', kontostand: 0, stand: null }],
      grundlageMonate: monate(1, 8, 20000, 10000),
      abschluesse: [{ firma: 'kdv', monat: '2026-08', umsatz: 0, kosten: 1000 }],
      traktion: { score: 50, text: 'Sales 50' },
      mandate: [mandat('a'), mandat('b')],
    });
    const g = berechne(b);
    const fh = g.saeulen.find(s => s.id === 'fh')!, ud = g.saeulen.find(s => s.id === 'ud')!, mt = g.saeulen.find(s => s.id === 'mt')!;
    expect(fh.score).not.toBeNull();
    expect(ud.zuDuenn || ud.score == null).toBe(true);
    const zaehlt = [fh, mt].filter(s => s.score != null && !s.zuDuenn);
    const erwartet = Math.round(zaehlt.reduce((a, s) => a + s.score! * s.gewicht, 0) / zaehlt.reduce((a, s) => a + s.gewicht, 0));
    expect(g.index).toBe(erwartet);
    expect(g.luecken).toBeGreaterThan(0);
    const kdc = berechne({ ...b, scope: 'kdc' });
    expect(kdc.saeulen.flatMap(s => s.kennzahlen.map(k => k.id))).not.toContain('traktion');
    expect(berechne(leer()).index).toBeNull();
  });
});
