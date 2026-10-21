// Rundgang 19.10. B4 (21.10., Kevin: „Am Produkt steht eine geplante Menge je Monat (Vorgabe: der Deckel bzw. 0), am Mandat bzw. Zusatz änderbar.
// Finanzplanung und Liquidität rechnen Satz × geplante Menge monatlich, die Rechnung nimmt die echten Stunden bzw. Tage.“) — dazu „kostenlos“ statt
// „Preis offen“ in der Planung. Erfundene Produkte und Preise.
import { describe, it, expect } from 'vitest';
import {
  planBausteinAusProdukt, geplanteMenge, preisteilSaeubern, preisteilPruefen, zusatzExtras, mandatVorlageAusProdukt, mandatZusatzSaeubern, mandatZusatzPruefen, pruefStatus,
  type PreisTeil,
} from '../lib/crm/produkt-karte';
import { produktVorschlaege, produktPlanText, produktEinheit, bausteinAusProdukt, istBasisVorschlaege, margeVon } from '../lib/finanzen/produkte';
import { mandatPosten, keinPostenGrund } from '../lib/crm/kunden';
import { zusatzLiquiditaet, zusatzBeschreibung } from '../lib/crm/mandat-zusatz';
import { geplantesEnde } from '../lib/crm/mandat-laufzeit';
import { mandatEntwurf } from '../lib/crm/mandat-anlegen';
import { nettoAusBrutto } from '../lib/finanzen/ust';
import type { Leistung, Mandat } from '../lib/crm/typen';

const J = '2026-10-19T08:00:00.000Z';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'sprint', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);
const STD = leistung({ id: 'l-std', name: 'Sparring', rolle: 'beides', preise: [teil({ art: 'stundensatz', betragCent: 16_000, deckel: { stundenJeMonat: 15 } })] });
const STD_PLAN = leistung({ id: 'l-std2', name: 'Sparring geplant', rolle: 'beides', preise: [teil({ art: 'stundensatz', betragCent: 16_000, deckel: { stundenJeMonat: 20 }, mengeJeMonat: 10 })] });
const TAG = leistung({ id: 'l-tag', name: 'Beratungstag', rolle: 'beides', preise: [teil({ art: 'tagessatz', betragCent: 140_000 })] });
const TAG_PLAN = leistung({ id: 'l-tag2', name: 'Beratungstag geplant', rolle: 'beides', preise: [teil({ art: 'tagessatz', betragCent: 140_000, mengeJeMonat: 2 })] });
const FREI = leistung({ id: 'l-frei', name: 'Kennzahlen-Check', typ: 'diagnose', preise: [teil({ art: 'kostenlos' })] });
const FEST = leistung({ id: 'l-fest', name: 'Workshop', typ: 'workshop', preise: [teil({ art: 'fest', betragCent: 240_000 })] });
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', firmaId: 'f-b', kontaktIds: [], titel: 'Beratung', art: 'projekt', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-11-01', verlaengerung: 'offen', mindestlaufzeitMonate: 3, honorar: { betrag: 1400, basis: 'tag', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);

describe('B4 · geplante Menge je Monat am Preis-Teil', () => {
  it('Vorgabe: der Deckel (Stundensatz) bzw. 0; gesetzt gewinnt, beim Stundensatz höchstens der Deckel; andere Formen 0', () => {
    expect(geplanteMenge(STD.preise![0])).toBe(15);
    expect(geplanteMenge(STD_PLAN.preise![0])).toBe(10);
    expect(geplanteMenge(teil({ art: 'stundensatz', deckel: { stundenJeMonat: 5 }, mengeJeMonat: 9 }))).toBe(5);
    expect(geplanteMenge(TAG.preise![0])).toBe(0);
    expect(geplanteMenge(TAG_PLAN.preise![0])).toBe(2);
    expect(geplanteMenge(teil({ art: 'monatlich', mengeJeMonat: 3 }))).toBe(0);
  });
  it('Säuberer und Prüfung: nur Tages-/Stundensatz, 0 … 744 — sonst 400 bzw. weg', () => {
    expect(preisteilSaeubern({ id: 'pt-1', art: 'tagessatz', betragCent: 1, mengeJeMonat: 2.5 }, 'pt-x')).toMatchObject({ mengeJeMonat: 2.5 });
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 1, mengeJeMonat: 2 }, 'pt-x')).not.toHaveProperty('mengeJeMonat');
    expect(preisteilPruefen({ art: 'stundensatz', mengeJeMonat: 12 })).toEqual([]);
    expect(pruefStatus(preisteilPruefen({ art: 'fest', mengeJeMonat: 2 }))).toBe(400);
    expect(pruefStatus(preisteilPruefen({ art: 'tagessatz', mengeJeMonat: 800 }))).toBe(400);
  });
});

describe('B4 · Finanzplanung: Satz × geplante Menge je Monat, „kostenlos“', () => {
  it('Stundensatz mit Deckel: 2.400 € monatlich (15 Std. × 160 €) statt „160 € einmalig“', () => {
    const p = planBausteinAusProdukt(STD);
    expect(p).toMatchObject({ preis: 2400, basis: 'monat', rhythmus: 'monatlich', fehlt: [], satz: { betrag: 160, menge: 15, einheit: 'Std.' }, kostenlos: false });
    expect(produktPlanText(produktVorschlaege({ leistungen: [STD] })[0])).toBe('2.400 € monatlich (15 Std. × 160 €)');
    const b = bausteinAusProdukt('b-1', produktVorschlaege({ leistungen: [STD] })[0]);
    expect(b).toMatchObject({ preis: 2400, rhythmus: 'monatlich', produktId: 'l-std' });
  });
  it('Tagessatz: ohne geplante Tage eine Lücke (nichts erfunden), mit 2 Tagen 2.800 € monatlich', () => {
    expect(planBausteinAusProdukt(TAG)).toMatchObject({ preis: 0, basis: 'monat', fehlt: ['geplante Tage je Monat'] });
    expect(produktPlanText(produktVorschlaege({ leistungen: [TAG] })[0])).toBe('1.400 € je Tag · geplante Menge je Monat offen');
    expect(planBausteinAusProdukt(TAG_PLAN)).toMatchObject({ preis: 2800, fehlt: [], satz: { betrag: 1400, menge: 2, einheit: 'Tage' } });
  });
  it('kostenlos heißt „kostenlos“, nicht „Preis offen“; Festpreis wie bisher', () => {
    expect(produktPlanText(produktVorschlaege({ leistungen: [FREI] })[0])).toBe('kostenlos');
    expect(produktPlanText(produktVorschlaege({ leistungen: [FEST] })[0])).toBe('2.400 € einmalig');
    expect(produktPlanText({ preis: 0, basis: 'monat' })).toBe('Preis offen');
  });
  it('die Einheit des Produkts (Katalog, Angebot) und die Marge je Einheit bleiben beim Satz', () => {
    expect(produktEinheit(STD)).toBe('Stunde netto');
    expect(produktEinheit(TAG)).toBe('Tag netto');
    expect(margeVon({ ...STD, aufwand: { anteil: 0.5 } })).toEqual({ kosten: 80, marge: 80, anteil: 0.5 });
  });
  it('Altbestand ohne Preis-Teile: unverändert (der alte Preis „Stunde netto“ bleibt einmalig)', () => {
    const alt = leistung({ id: 'l-alt', preis: { betrag: 160, einheit: 'Stunde netto' } });
    expect(planBausteinAusProdukt(alt)).toEqual({ preis: 160, einheit: 'Stunde netto', basis: 'einmalig', rhythmus: 'einmalig', laufzeit: null, fehlt: [], kostenlos: false, anzeigeBasis: 'einmalig' });
  });
});

describe('B4 · Mandat und Zusatzmodul: geplante Tage bzw. Stunden, änderbar — die Liquidität plant Satz × Menge', () => {
  it('Vorlage: Tagessatz trägt die geplanten Tage; Stundensatz plant die geplanten Stunden (höchstens der Deckel)', () => {
    expect(mandatVorlageAusProdukt(TAG_PLAN)).toMatchObject({ honorar: { betrag: 1400, basis: 'tag' }, tageJeMonat: 2 });
    expect(mandatVorlageAusProdukt(TAG).tageJeMonat).toBeUndefined();
    expect(mandatVorlageAusProdukt(STD_PLAN).honorar).toEqual({ betrag: 1600, basis: 'monat', netto: true });
    expect(mandatVorlageAusProdukt(STD).honorar).toEqual({ betrag: 2400, basis: 'monat', netto: true });
    const m = mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'A GmbH' }, kontaktIds: [], gesellschaft: 'ug', leistung: TAG_PLAN, jetzt: J, person: 'pia' });
    expect(m.tageJeMonat).toBe(2);
    expect(mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'A GmbH' }, kontaktIds: [], gesellschaft: 'ug', leistung: TAG_PLAN, vertrag: { honorar: { betrag: 2000, basis: 'monat' } }, jetzt: J, person: 'pia' }).tageJeMonat).toBeUndefined();
  });
  it('Mandat je Tag: ohne geplante Tage kein Posten (mit Satz, warum); mit Tagen ein Monatsposten Tagessatz × Tage', () => {
    expect(mandatPosten(mandat(), '2026-10-20')).toEqual([]);
    expect(keinPostenGrund(mandat())).toContain('geplanten Tagen je Monat');
    const l = mandatPosten(mandat({ tageJeMonat: 2 }), '2026-10-20');
    expect(l.map(p => [p.id, p.betrag, p.rhythmus, p.ab, p.bis, p.leistungsmonat])).toEqual([['lp-mandat-m-1', 3332, 'monatlich', '2026-11-15', '2027-01-15', '2026-11']]);
    expect(l[0].notiz).toContain('2 Tage/Monat geplant');
  });
  it('Zusatzmodul je Tag: geplante Tage → Posten; Säuberer und Prüfung (nur beim Tagessatz)', () => {
    expect(zusatzExtras(TAG_PLAN)).toEqual({ tageJeMonat: 2 });
    expect(zusatzExtras(STD_PLAN)).toEqual({ stundenJeMonat: 10 });
    const m = mandat({ honorar: { betrag: 2000, basis: 'monat', netto: true }, zusatz: [{ id: 'mz-t', leistungId: 'l-tag', honorar: { betragCent: 140_000, basis: 'tag' }, tageJeMonat: 1.5 }] });
    const z = zusatzLiquiditaet(m, '2026-11', geplantesEnde(m), { katalog: [TAG], nettoAusBrutto });
    expect(z.map(p => [p.id, p.betrag, p.rhythmus])).toEqual([['z-mz-t', 2499, 'monatlich']]);
    expect(zusatzBeschreibung(m.zusatz![0], [TAG])).toBe('1.400 € netto/Tag · 1,5 Tage/Monat geplant');
    expect(mandatZusatzSaeubern([{ id: 'mz-t', leistungId: 'l-tag', honorar: { betragCent: 1, basis: 'tag' }, tageJeMonat: 3 }])).toEqual([{ id: 'mz-t', leistungId: 'l-tag', honorar: { betragCent: 1, basis: 'tag' }, tageJeMonat: 3 }]);
    expect(pruefStatus(mandatZusatzPruefen([{ id: 'mz-t', leistungId: 'l-tag', honorar: { betragCent: 1, basis: 'monat' }, tageJeMonat: 3 }], undefined, { katalog: [TAG] }))).toBe(400);
  });
  it('Ist-Basis der Planung: ein Mandat je Tag mit geplanten Tagen ist monatlich Satz × Tage', () => {
    const v = istBasisVorschlaege({ mandate: [mandat({ tageJeMonat: 2 })], chancen: [], leistungen: [] }, '2026-10-20');
    expect(v[0]).toMatchObject({ betrag: 2800, rhythmus: 'monatlich' });
    expect(istBasisVorschlaege({ mandate: [mandat()], chancen: [], leistungen: [] }, '2026-10-20')[0]).toMatchObject({ betrag: 1400, rhythmus: 'einmalig' });
  });
});

describe('Karte: Feld „Geplant je Monat“ am Tages-/Stundensatz (21.10.)', () => {
  it('nur bei Sätzen, Dezimal erlaubt, nie über dem Deckel, leer = Vorgabe; Formwechsel behält es nur bei Sätzen', async () => {
    const { PREIS_TEIL_FELDER, teilFeldSetzen, teilFeldWert, teilFuerArt } = await import('@/lib/crm/produkt-katalog');
    expect(PREIS_TEIL_FELDER.tagessatz).toContain('menge');
    expect(PREIS_TEIL_FELDER.stundensatz).toContain('menge');
    expect(PREIS_TEIL_FELDER.monatlich).not.toContain('menge');
    const tag = { id: 'pt-1', art: 'tagessatz' as const, rolle: 'grund' as const, betragCent: 120_000 };
    const r = teilFeldSetzen(tag, 'menge', '1,5');
    expect(r).toEqual({ ok: true, teil: { ...tag, mengeJeMonat: 1.5 } });
    if (r.ok) {
      expect(teilFeldWert(r.teil, 'menge')).toBe('1,5');
      expect(teilFeldSetzen(r.teil, 'menge', '')).toEqual({ ok: true, teil: tag });
      expect(teilFuerArt(r.teil, 'monatlich')).not.toHaveProperty('mengeJeMonat');
    }
    const std = { id: 'pt-2', art: 'stundensatz' as const, rolle: 'option' as const, betragCent: 15_000, deckel: { stundenJeMonat: 8 } };
    expect(teilFeldSetzen(std, 'menge', '10')).toMatchObject({ ok: false });
    expect(teilFeldSetzen(std, 'menge', 'abc')).toMatchObject({ ok: false });
    expect(teilFeldSetzen(std, 'menge', '6')).toMatchObject({ ok: true, teil: { mengeJeMonat: 6 } });
  });
});
