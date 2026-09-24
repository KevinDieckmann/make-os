// Privat ist nie Business (Kevin, 24.09.): private Posten in den Firmen-
// Speichern zählen in keiner Business-Rechnung mehr — weder im Kontostand,
// noch in der Liquidität, noch in der Monatslast, noch im roten Schild.

import { describe, it, expect } from 'vitest';
import { vorschau, monatlicheLast, nurBusiness, businessFirmen, istPrivatPosten } from '../lib/make-one/liquiditaet';

const heute = '2026-09-24';
const firmen = [{ id: 'kdc', name: 'Beispiel Consulting', kontostand: 1000, stand: null }, { id: 'privat', name: 'Privat', kontostand: 500, stand: null }];
const zahlungen = [
  { id: 'z1', an: 'Lieferant Beispiel', titel: 'x', betrag: 100, status: 'offen', faellig: '2026-09-26', firmaId: 'kdc' },
  { id: 'z2', an: 'Vermieter Beispiel', titel: 'x', betrag: 900, status: 'offen', faellig: '2026-09-20', firmaId: 'privat' },
];
const merkposten = [
  { id: 'm1', titel: 'Kredit Firma', betrag: -5000, art: 'kredit', notiz: 'Rate 100 €/Monat', firmaId: 'kdc' },
  { id: 'm2', titel: 'Kredit privat', betrag: -3000, art: 'kredit', notiz: 'Rate 90 €/Monat', firmaId: 'privat' },
];

describe('Entflechtung Privat / Business', () => {
  it('Privates erkennt man an Firma oder Kategorie', () => {
    expect(istPrivatPosten({ firmaId: 'privat' })).toBe(true);
    expect(istPrivatPosten({ kategorie: 'privat' })).toBe(true);
    expect(istPrivatPosten({})).toBe(false);
    expect(nurBusiness([...zahlungen]).map(z => z.id)).toEqual(['z1']);
    expect(businessFirmen(firmen).map(f => f.id)).toEqual(['kdc']);
  });
  it('Business-Vorschau: ohne privaten Kontostand, ohne private Zahlung, ohne private Rate', () => {
    const v = vorschau(firmen, [], zahlungen, merkposten, heute, 4, false, [], 'real', undefined, true);
    expect(v.start).toBe(1000);
    const texte = v.wochen.flatMap(w => w.bewegungen.map(b => b.text)).join(' | ');
    expect(texte).not.toMatch(/Vermieter|Kredit privat/);
    expect(texte).toMatch(/Lieferant/);
  });
  it('ohne den Schalter bleibt alles wie bisher (für die ausdrückliche Wahl „Privat“)', () => {
    expect(vorschau(firmen, [], zahlungen, merkposten, heute, 4).start).toBe(1500);
    expect(vorschau(firmen, [], zahlungen, merkposten, heute, 4, false, [], 'real', 'privat', true).start).toBe(500);
  });
  it('Monatslast nur aus Firmen-Posten', () => {
    expect(monatlicheLast(nurBusiness(merkposten)).map(x => x.text)).toEqual(['Kredit Firma (Rate)']);
  });
});
