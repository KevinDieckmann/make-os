// Steuern (25.09.): Fristen je Firma und privat (gerechnet, § 108 AO), Abgabefristen
// mit/ohne Steuerberater, Umsatzsteuer je Zeitraum (Ist/Soll), Rücklage & Prognose,
// Belege, Übergabe-Checkliste. Hinweis, keine Steuerberatung.
import { describe, it, expect } from 'vitest';
import { STANDARD_STEUERN, erklaerungsFrist, fristen, zeitraumVon, ustZeitraum, prognose, jahresgewinn, belegPunkte, uebergabeMonat, uebergabeJahr, type SteuerEinstellungen } from '../lib/steuern/rechnen';
import type { Beleg } from '../lib/finanzen/haushalt/typen';

const HEUTE = '2026-09-25';

describe('Abgabefristen der Jahreserklärungen', () => {
  it('mit Steuerberater Ende Februar des übernächsten Jahres (Übergang 2024: 30.04.2026), sonst 31.07.; Wochenende → Werktag', () => {
    expect(erklaerungsFrist(2024, true)).toBe('2026-04-30');
    expect(erklaerungsFrist(2025, true)).toBe('2027-03-01'); // 28.02.2027 ist ein Sonntag
    expect(erklaerungsFrist(2026, true)).toBe('2028-02-29');
    expect(erklaerungsFrist(2025, false)).toBe('2026-07-31');
  });
});

describe('Fristen', () => {
  const f = fristen(STANDARD_STEUERN, HEUTE, { 'f:privat-est-2026-09-10': { am: '2026-09-09', von: 'kevin' } });
  const ids = f.map(x => x.id);
  it('Consulting (Freiberufler): Umsatzsteuer-Voranmeldung, keine Gewerbe- oder Körperschaftsteuer', () => {
    expect(ids).toContain('kdc-ust-2026-10-12'); // 10.10.2026 ist ein Samstag
    expect(f.some(x => x.einheit === 'kdc' && (x.art === 'gewst' || x.art === 'kst'))).toBe(false);
  });
  it('KD Ventures (UG): Körperschaft- und Gewerbesteuer-Vorauszahlungen, Offenlegung', () => {
    expect(ids).toEqual(expect.arrayContaining(['kdv-kst-2026-12-10', 'kdv-gewst-2026-11-16', 'kdv-offenlegung-2026-12-31', 'kdv-erklaerung-2027-03-01']));
  });
  it('Privat: ESt-Vorauszahlungen und die Erklärung; abgehakt bleibt abgehakt; Countdown und Aufgabe 7 Tage vorher', () => {
    const vz = f.find(x => x.id === 'privat-est-2026-09-10')!;
    expect(vz).toMatchObject({ tage: -15, erledigt: true });
    expect(f.find(x => x.id === 'privat-est-2026-12-10')).toMatchObject({ tage: 76, aufgabeAb: '2026-12-03', erledigt: false, href: '/os/finanzen?s=steuern#ruecklage' });
    expect(ids).toContain('privat-erklaerung-2027-03-01');
    expect(f.map(x => x.datum)).toEqual(f.map(x => x.datum).slice().sort());
  });
});

describe('Umsatzsteuer', () => {
  const rechnungen = [
    { id: 'r1', kunde: 'Acme', titel: 'x', betrag: 1190, status: 'bezahlt', datum: '2026-06-20', bezahltAm: '2026-08-10', ustSatz: 19, nummer: 'RE-1', firmaId: 'kdc' },
    { id: 'r2', kunde: 'Beta', titel: 'y', betrag: 1190, status: 'gestellt', datum: '2026-08-01', firmaId: 'kdc' },
    { id: 'r3', kunde: 'Holding', titel: 'z', betrag: 5000, status: 'bezahlt', datum: '2026-08-01', bezahltAm: '2026-08-02', firmaId: 'kdv' },
  ];
  const grund = { stand: '2026-09-21', kosten: [{ datum: '2026-07-15', brutto: 119, netto: 100 }], ugRechnungen: [] };
  it('Zeitraum je Rhythmus', () => {
    expect(zeitraumVon(HEUTE, 'quartal')).toEqual({ label: 'Q3/2026', von: '2026-07-01', bis: '2026-09-30' });
    expect(zeitraumVon(HEUTE, 'monatlich')).toEqual({ label: '09/2026', von: '2026-09-01', bis: '2026-09-30' });
    expect(zeitraumVon(HEUTE, 'keine')).toBeNull();
  });
  it('Ist-Versteuerung nach Zahlungseingang, Soll nach Rechnungsdatum; fehlender Satz = 19 % angenommen; Vorsteuer aus der Grundlage', () => {
    const zr = zeitraumVon(HEUTE, 'quartal')!;
    const ist = ustZeitraum('kdc', { ...STANDARD_STEUERN.kdc, istVersteuerung: true }, zr, rechnungen, grund, '2026-10-12');
    expect(ist.rechnungen.map(r => r.id)).toEqual(['r1']);
    expect(ist.ust).toBeCloseTo(190, 5);
    expect(ist.vorsteuer).toBeCloseTo(19, 5);
    expect(ist.zahllast).toBeCloseTo(171, 5);
    expect(ist.vorsteuerQuelle).toContain('bis 21.09.2026');
    const soll = ustZeitraum('kdc', { ...STANDARD_STEUERN.kdc, istVersteuerung: false }, zr, rechnungen, null, null);
    expect(soll.rechnungen.map(r => [r.id, r.angenommen])).toEqual([['r2', true]]);
    expect(soll).toMatchObject({ vorsteuer: null, zahllast: soll.ust });
  });
});

describe('Rücklage & Prognose', () => {
  const ist = (u: number, k: number) => Array.from({ length: 8 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatz: u, kosten: k, quelle: 'Monatsabschluss' }));
  it('ESt-Anteil Consulting, KSt+Soli+GewSt für KD Ventures, Vorauszahlungen abgezogen, Deckung gegen die Rücklage', () => {
    const e: SteuerEinstellungen = { ...STANDARD_STEUERN, steuerquote: 30, vorauszahlung: { est: 1000 }, ruecklageIst: { privat: 10000 } };
    const g = { kdc: jahresgewinn(ist(10000, 5000), 2026), kdv: jahresgewinn(ist(5000, 5000 - 20000 / 12), 2026) };
    expect(g.kdc).toMatchObject({ gewinn: 40000, monate: 8, hochgerechnet: 60000 });
    const p = prognose(e, HEUTE, g, { kdc: 171 });
    const z = Object.fromEntries(p.zeilen.map(x => [x.id, x.betrag]));
    expect(z.est).toBeCloseTo(18000 - 3000, 5); // 3 Vorauszahlungen bis heute
    expect(z.kst).toBeCloseTo(20000 * 0.15825 + 20000 * 0.035 * 4.1, 3);
    expect(z['ust-kdc']).toBe(171);
    expect(p.je.privat).toMatchObject({ soll: 15000, ist: 10000 });
    expect(p.je.privat.deckung).toBeCloseTo(2 / 3, 5);
    const ohneQuote = prognose({ ...e, steuerquote: null }, HEUTE, g, {});
    expect(ohneQuote.zeilen.find(x => x.id === 'est')).toMatchObject({ betrag: null, luecke: expect.stringContaining('Steuerquote') });
  });
});

describe('Belege und Übergabe', () => {
  const belege = [
    { id: 'b1', stand: 3, art: 'beleg', bezeichnung: 'Hotel', empfaenger: null, betrag: null, faellig_am: '2026-08-20', verursacher: 'Kevin', einheit: 'selbststaendigkeit', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
    { id: 'b2', stand: 1, art: 'beleg', bezeichnung: 'Privat', empfaenger: null, betrag: null, faellig_am: null, verursacher: null, einheit: 'privat', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
  ] as Beleg[];
  const rechnungen = [{ id: 'r9', kunde: 'Acme', titel: 'x', betrag: 1190, status: 'gestellt', datum: '2026-08-05', firmaId: 'kdc' }];
  it('fehlende Pflichtangaben verlinken auf die Rechnung, fehlende Belege tragen ihre Kennung zum Erledigen — Privates nie', () => {
    const p = belegPunkte(rechnungen, belege, HEUTE);
    expect(p.map(x => x.id)).toEqual(['b-b1', 'r-r9']);
    expect(p[1]).toMatchObject({ href: '/os/finanzen/planung?r=r9', unter: 'fehlt: Rechnungsnummer, USt-Satz, Leistungszeitraum' });
    expect(p[0]).toMatchObject({ belegId: 'b1', stand: 3, art: 'beleg' });
  });
  it('Monats-Checkliste leitet ab, was sie sieht; Abhaken überstimmt', () => {
    const m = uebergabeMonat('2026-08', { rechnungen, belege, abschluesse: [{ firma: 'kdc', monat: '2026-08' }], buchungsMonate: [], abgehakt: { 'm:2026-08:konto': { am: HEUTE, von: 'kevin' } } });
    expect(Object.fromEntries(m.map(x => [x.key.split(':')[2], x.status]))).toEqual({ konto: 'ok', rechnungen: 'offen', belege: 'offen', abschluss: 'offen', abgleich: 'hand', uebergeben: 'hand' });
    expect(m.find(x => x.key === 'm:2026-08:rechnungen')).toMatchObject({ href: '/os/finanzen/planung?r=r9' });
    expect(uebergabeJahr(2025, {}).every(x => x.status === 'hand' && x.key.startsWith('j:2025:'))).toBe(true);
  });
});
