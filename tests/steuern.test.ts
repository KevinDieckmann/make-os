// Steuern (25.09.): Fristen je Firma und privat (gerechnet, § 108 AO), Abgabefristen
// mit/ohne Steuerberater, Umsatzsteuer je Zeitraum (Ist/Soll), Rücklage & Prognose,
// Belege, Übergabe-Checkliste. Hinweis, keine Steuerberatung.
import { describe, it, expect } from 'vitest';
import { STANDARD_STEUERN, erklaerungsFrist, fristen, zeitraumVon, ustZeitraum, prognose, jahresgewinn, belegPunkte, uebergabeMonat, uebergabeJahr, mitFinanzplanung, steuernNurBusiness, type SteuerEinstellungen } from '../lib/steuern/rechnen';
import type { EstGemeinsam } from '../lib/finanzen/est-gemeinsam';
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
  it('Selbstständigkeit (seit 05.10. gewerblich): Umsatzsteuer-Voranmeldung und Gewerbesteuer-Vorauszahlungen, keine Körperschaftsteuer', () => {
    // Kevin 05.10.: „Ich habe in der Selbstständigkeit einfach ein Gewerbe angemeldet.“ — vorher Freiberuf ohne Gewerbesteuer.
    expect(STANDARD_STEUERN.kdc).toMatchObject({ rechtsform: 'einzel', gewerbe: true });
    expect(ids).toContain('kdc-ust-2026-10-12'); // 10.10.2026 ist ein Samstag
    expect(ids).toContain('kdc-gewst-2026-11-16'); // 15.11.2026 ist ein Sonntag
    expect(f.some(x => x.einheit === 'kdc' && x.art === 'kst')).toBe(false);
    // Freiberuf bleibt einstellbar (Plattform) — dann ohne Gewerbesteuer.
    const frei = fristen({ ...STANDARD_STEUERN, kdc: { ...STANDARD_STEUERN.kdc, rechtsform: 'freiberuf', gewerbe: false } }, HEUTE);
    expect(frei.some(x => x.einheit === 'kdc' && x.art === 'gewst')).toBe(false);
  });
  it('EINE Quelle: mit Finanzplanung kommen Rechtsform und Gewerbesteuer der Selbstständigkeit aus deren Steuerprofil', () => {
    const gespeichert: SteuerEinstellungen = { ...STANDARD_STEUERN, kdc: { ...STANDARD_STEUERN.kdc, rechtsform: 'freiberuf', gewerbe: false } };
    expect(mitFinanzplanung(gespeichert, { gewerbe: true }).kdc).toMatchObject({ rechtsform: 'einzel', gewerbe: true, ust: 'quartal' });
    expect(mitFinanzplanung(STANDARD_STEUERN, { gewerbe: false }).kdc).toMatchObject({ rechtsform: 'freiberuf', gewerbe: false });
    expect(mitFinanzplanung(gespeichert, null)).toBe(gespeichert);   // ohne Plan: die gespeicherte Einstellung
  });
  it('KD Ventures (UG): Körperschaft- und Gewerbesteuer-Vorauszahlungen, Offenlegung', () => {
    expect(ids).toEqual(expect.arrayContaining(['kdv-kst-2026-12-10', 'kdv-gewst-2026-11-16', 'kdv-offenlegung-2026-12-31', 'kdv-erklaerung-2027-03-01']));
  });
  it('Privat: ESt-Vorauszahlungen und die Erklärung; abgehakt bleibt abgehakt; Countdown und Aufgabe 7 Tage vorher', () => {
    const vz = f.find(x => x.id === 'privat-est-2026-09-10')!;
    expect(vz).toMatchObject({ tage: -15, erledigt: true });
    // Seit 05.10. führen Privat-Fristen in die Privat-Sicht der Steuer-Seite.
    expect(f.find(x => x.id === 'privat-est-2026-12-10')).toMatchObject({ tage: 76, aufgabeAb: '2026-12-03', erledigt: false, href: '/os/finanzen?s=steuern&space=privat#ruecklage' });
    expect(f.find(x => x.id === 'kdv-kst-2026-12-10')?.href).toBe('/os/finanzen?s=steuern#ruecklage');
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
  // 05.10.: Einkommensteuer gemeinsam (Gehalt + Selbstständigkeit) und Gewerbesteuer der Selbstständigkeit kommen aus der Finanzplanung
  // (`est`, lib/finanzen/est-gemeinsam.ts) — vorher „hochgerechneter Consulting-Gewinn × Steuerquote“, ohne Gewerbesteuer.
  const est: EstGemeinsam = {
    jahr: 2026, gewinn: 40000, vorab: 30000, lohn: 10770, zve: 50770, estGesamt: 12000, estLohn: 1000, est: 11000, soli: 0, gewst: 1500, anrechnung: 1400, korr: 0, summe: 11100, vorausgezahlt: 0, zahlung: 11100,
    gewerbe: true, hebesatz: 410, freibetrag: 24500, anrechnungFaktor: 4, splitting: false, plan: 'Arbeitsplan',
  };
  it('ESt gemeinsam und GewSt der Selbstständigkeit aus der Finanzplanung, KSt+Soli+GewSt für KD Ventures, Vorauszahlungen aus EINER Quelle', () => {
    const e: SteuerEinstellungen = { ...STANDARD_STEUERN, steuerquote: 30, vorauszahlung: { est: 1000, gewstKdc: 200 }, ruecklageIst: { privat: 10000 } };
    const g = { kdc: jahresgewinn(ist(10000, 5000), 2026), kdv: jahresgewinn(ist(5000, 5000 - 20000 / 12), 2026) };
    const p = prognose(e, HEUTE, g, { kdc: 171 }, { rechnungen: 0 }, est);
    const z = Object.fromEntries(p.zeilen.map(x => [x.id, x.betrag]));
    // 05.10. abends (Kevin: „Vorauszahlungen eine Quelle — führend ist die Finanzplanung“): Mehrsteuer 11.000 − Anrechnung 1.400 + Soli 0 = 9.600,
    // minus die Vorauszahlungen der FINANZPLANUNG (hier 0). Vorher (selbst-privat) zogen die Steuer-Einstellungen 3 × 1.000 ab → 6.600; die zählen
    // mit Finanzplanung nicht mehr (sonst stünden zwei Quellen nebeneinander) — sie werden als „ungenutzt“ benannt.
    expect(z.est).toBeCloseTo(11000 - 1400, 5);
    // Gewerbesteuer 1.500 (vorher − 3 × 200 aus den Einstellungen = 900)
    expect(z['gewst-kdc']).toBeCloseTo(1500, 5);
    expect(p.vorauszahlung).toEqual({ quelle: 'finanzplanung', est: 0, gewst: 0, ungenutzt: { est: 3000, gewstKdc: 600 } });
    expect(p.zeilen.find(x => x.id === 'est')?.formel).toContain('Vorauszahlungen laut Finanzplanung');
    expect(p.zeilen.find(x => x.id === 'est')?.titel).toContain('gemeinsam');
    expect(p.zeilen.find(x => x.id === 'est')?.href).toBe('/os/finanzen?s=finanzplanung&space=privat&u=selbst');
    expect(z.kst).toBeCloseTo(20000 * 0.15825 + 20000 * 0.035 * 4.1, 3);
    expect(z['ust-kdc']).toBe(171);
    expect(p.je.privat).toMatchObject({ soll: 9600, ist: 10000 });
    expect(p.je.kdc.soll).toBeCloseTo(1500 + 171, 5);
    // Gewerbesteuer abgeschaltet (Freiberuf) → keine Gewerbesteuer-Zeile
    expect(prognose(e, HEUTE, g, {}, { rechnungen: 0 }, { ...est, gewerbe: false }).zeilen.some(x => x.id === 'gewst-kdc')).toBe(false);
  });
  it('Wächter Vorauszahlungen (05.10. abends): mit Finanzplanung zählt NUR deren `vorausgezahlt` — ESt zuerst, Rest GewSt, nie doppelt', () => {
    const g = { kdc: null, kdv: null };
    const ohneEinst: SteuerEinstellungen = { ...STANDARD_STEUERN, vorauszahlung: {} };
    const mitEinst: SteuerEinstellungen = { ...STANDARD_STEUERN, vorauszahlung: { est: 2500, gewstKdc: 400 } };
    for (const vz of [0, 3000, 9600, 10000, 11100, 20000]) {
      const plan = { ...est, vorausgezahlt: vz, zahlung: est.summe - vz };
      const a = prognose(ohneEinst, HEUTE, g, {}, { rechnungen: 0 }, plan), b = prognose(mitEinst, HEUTE, g, {}, { rechnungen: 0 }, plan);
      const summe = (p: typeof a) => p.zeilen.filter(x => x.id === 'est' || x.id === 'gewst-kdc').reduce((s, x) => s + (x.betrag ?? 0), 0);
      // Kein Doppelabzug: ESt + GewSt = Abschlusszahlung der Finanzplanung (nie darunter), egal was in den Steuer-Einstellungen steht.
      expect(summe(a)).toBeCloseTo(Math.max(0, est.summe - vz), 5);
      expect(summe(b)).toBeCloseTo(summe(a), 5);
      expect(b.vorauszahlung.est + b.vorauszahlung.gewst).toBeCloseTo(Math.min(vz, est.summe), 5);
      expect(b.vorauszahlung.quelle).toBe('finanzplanung');
    }
    // Aufteilung: 10.000 vorausgezahlt → ESt 9.600 voll gedeckt, 400 auf die Gewerbesteuer (1.500 → 1.100).
    const p = prognose(mitEinst, HEUTE, g, {}, { rechnungen: 0 }, { ...est, vorausgezahlt: 10000 });
    expect(Object.fromEntries(p.zeilen.map(x => [x.id, x.betrag]))).toMatchObject({ est: 0, 'gewst-kdc': 1100 });
    // Ohne Finanzplanung bleibt die Steuer-Einstellung die Quelle (benannt; einen Betrag gibt es ohne Plan nicht).
    expect(prognose(mitEinst, HEUTE, g, {}, { rechnungen: 0 }, null).vorauszahlung).toEqual({ quelle: 'einstellungen', est: 7500, gewst: 1200 });
    // Business-Sicht: die Einkommensteuer-Vorauszahlung ist privat — sie geht nie hinaus.
    const st = steuernNurBusiness({ einstellungen: mitEinst, fristen: [], ust: [], prognose: p, gewinn: { kdc: null, kdv: null }, uebergabe: { monat: '2026-08', punkte: [], jahr: 2025, jahresPunkte: [] } });
    expect(st.prognose.vorauszahlung).toEqual({ quelle: 'keine', est: 0, gewst: 0 });
  });
  it('ohne Finanzplanung für das Jahr: ehrlich „fehlt“, kein Schätzwert — auch nicht aus der alten Steuerquote', () => {
    const e: SteuerEinstellungen = { ...STANDARD_STEUERN, steuerquote: 30 };
    const p = prognose(e, HEUTE, { kdc: jahresgewinn(ist(10000, 5000), 2026), kdv: null }, {}, { rechnungen: 0 }, null);
    expect(p.zeilen.find(x => x.id === 'est')).toMatchObject({ betrag: null, luecke: expect.stringContaining('Finanzplanung') });
    expect(p.zeilen.find(x => x.id === 'gewst-kdc')).toMatchObject({ betrag: null });
    expect(p.je.privat.soll).toBe(0);
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
