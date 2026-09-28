// Beleg übernehmen: Beträge auf den Cent, brutto/netto über lib/finanzen/ust.ts
// (28.09., K3). Vorher wurde der Rechnungsbetrag auf ganze Euro gerundet und ein
// reiner Nettobetrag als brutto übernommen. Erfundene Beträge.
import { describe, it, expect } from 'vitest';
import { belegBetrag, euroText } from '../lib/finanzen/beleg-betrag';
import { aufCent, nettoAusBrutto, ustAusBrutto } from '../lib/finanzen/ust';

describe('belegBetrag', () => {
  it('Rechnungsbetrag bleibt centgenau (nicht auf ganze Euro)', () => {
    expect(belegBetrag({ betragBrutto: 123.45 })).toEqual({ brutto: 123.45 });
    expect(belegBetrag({ betragBrutto: 0.99 })).toEqual({ brutto: 0.99 });
    expect(belegBetrag({ betragBrutto: 1.005 })?.brutto).toBe(1.01);
  });
  it('mit Satz vom Beleg: netto über ust.ts, netto + Steuer = brutto', () => {
    const b = belegBetrag({ betragBrutto: 1190.5, betragNetto: 1000, ustSatz: 19 })!;
    expect(b).toEqual({ brutto: 1190.5, netto: nettoAusBrutto(1190.5, 19), ustSatz: 19 });
    expect(aufCent(b.netto! + ustAusBrutto(1190.5, 19))).toBe(1190.5);
    expect(belegBetrag({ betragBrutto: 10.7, ustSatz: 7 })).toEqual({ brutto: 10.7, netto: 10, ustSatz: 7 });
    expect(belegBetrag({ betragBrutto: 50, ustSatz: 0 })).toEqual({ brutto: 50, netto: 50, ustSatz: 0 });
  });
  it('ohne Satz kein geratenes Netto (ist ab „gestellt“ festgeschrieben)', () => {
    expect(belegBetrag({ betragBrutto: 99.99 })).toEqual({ brutto: 99.99 });
    expect(belegBetrag({ betragBrutto: 99.99, ustSatz: 99 })).toEqual({ brutto: 99.99 });
  });
  it('nur netto gelesen: brutto über ust.ts, netto wird nicht als brutto übernommen', () => {
    expect(belegBetrag({ betragNetto: 100, ustSatz: 19 })).toEqual({ brutto: 119, netto: 100, ustSatz: 19 });
    expect(belegBetrag({ betragNetto: 0.5 })).toEqual({ brutto: 0.6, netto: 0.5, ustSatz: 19 });
  });
  it('altes Feld „betrag“ gilt als brutto; Unplausibles → null', () => {
    expect(belegBetrag({ betrag: 42.42 })).toEqual({ brutto: 42.42 });
    expect(belegBetrag({ betragBrutto: 12.34, betrag: 99 })?.brutto).toBe(12.34);
    for (const e of [{}, { betrag: 0 }, { betrag: -5 }, { betrag: 'abc' }, { betragBrutto: 0.001 }, { betrag: Infinity }]) expect(belegBetrag(e)).toBeNull();
  });
  it('Anzeige mit zwei Nachkommastellen', () => {
    expect(euroText(1190.5)).toBe('1.190,50 €');
    expect(euroText(-12.3)).toBe('-12,30 €');
  });
});
