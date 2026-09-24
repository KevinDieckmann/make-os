// Prüfliste: private Posten in den Firmen-Speichern werden gegen den Haushalt
// abgeglichen — mit Vorschlag, nie still verschoben. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { pruefliste } from '../lib/finanzen/haushalt/entflechtung';
import type { Haushalt } from '../lib/finanzen/haushalt/typen';

const h = {
  stamm: { konten: [{ id: 'k1', stand: 1, name: 'Testkonto', inhaber: 'Kevin', einheit: 'privat', iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true }], kategorien: [], regeln: [], aliase: {} },
  buchungen: [{ id: 'hb1', stand: 1, konto_id: 'k1', datum: '2026-08-03', betrag: -4782, beschreibung: 'Supermarkt', empfaenger: 'Supermarkt Beispiel', kategorie_id: null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: null, geaendert: '' }],
  schulden: [{ id: 's1', stand: 1, bezeichnung: 'Ratenkredit Beispiel', glaeubiger: null, einheit: 'privat', startbetrag: 300000, restbetrag: 250000, rate: 9000, zinssatz: null, rhythmus: null, naechste_faelligkeit: null, endet_am: null, notiz: null, aus_buchung_id: null }],
  belege: [], planwerte: [],
} as unknown as Haushalt;

describe('Prüfliste Privat in Business', () => {
  const liste = pruefliste({
    finanzplan: {
      firmen: [{ id: 'kdc', name: 'Firma', kontostand: 100 }, { id: 'privat', name: 'Privat', kontostand: null }],
      zahlungen: [{ id: 'z1', an: 'Stadtwerke Beispiel', titel: 'Strom', betrag: 85, status: 'offen', firmaId: 'privat' }, { id: 'z2', an: 'Firma X', titel: 'y', betrag: 1, status: 'offen', firmaId: 'kdc' }],
      merkposten: [{ id: 'm1', titel: 'Ratenkredit Beispiel', betrag: -2500, art: 'kredit', notiz: 'Rate 90 €/Monat', firmaId: 'privat' }],
    },
    buchungen: { buchungen: [{ id: 'b1', datum: '2026-08-03', wer: 'Kevin', betrag: -48, kategorie: 'Lebensmittel' }, { id: 'b2', datum: '2026-08-04', betrag: -12, ort: 'kdc' }] },
    liquiplan: { posten: [{ id: 'p1', titel: 'Miete', betrag: -1250, rhythmus: 'monatlich', kategorie: 'privat' }, { id: 'p2', titel: 'Honorar', betrag: 3000, rhythmus: 'monatlich' }, { id: 'p3', titel: 'Tool', betrag: -20, rhythmus: 'monatlich', firmaId: 'kdc' }] },
  }, h);
  const nach = (q: string, id: string) => liste.find(p => p.quelle === q && p.id === id);
  it('findet nur Privates und Firmenloses — Business bleibt außen vor', () => {
    expect(liste.map(p => `${p.quelle}:${p.id}`).sort()).toEqual(['buchung:b1', 'firma:privat', 'merkposten:m1', 'planposten:p1', 'planposten:p2', 'zahlung:z1']);
  });
  it('erkennt Dubletten: gerundete Buchung (±0,50 €) und gleichnamiger Kredit', () => {
    expect(nach('buchung', 'b1')?.vorschlag).toBe('dublette');
    expect(nach('merkposten', 'm1')?.vorschlag).toBe('dublette');
  });
  it('schlägt Übernehmen für offene private Zahlungen vor, Zuordnen für firmenlose Planposten', () => {
    expect(nach('zahlung', 'z1')?.vorschlag).toBe('uebernehmen');
    expect(nach('planposten', 'p2')?.aktionen).toContain('kdc');
    expect(nach('planposten', 'p1')?.vorschlag).toBe('entfernen');
  });
});
