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

// ─── Rechnungsschutz auch in der Entflechtung (28.09., U3) ──────────────────
// Ab „gestellt“ wird eine Rechnung nirgends gelöscht — auch nicht beim Aufräumen
// von Privatem. Sie lässt sich nur mit Vermerk einer Firma zuordnen; ein
// Löschversuch bekommt 409 (entflechtungSperre). Erfundene Daten.
import { entflechtungSperre, rechnungenEntflechten, rechnungSchutz, type Rechnung } from '../lib/finanzen/finanzplan-bestand';

describe('Prüfliste: gestellte Rechnungen werden nicht gelöscht', () => {
  const re = (id: string, status: Rechnung['status'], x: Partial<Rechnung> = {}): Rechnung => ({ id, firmaId: 'privat', kunde: 'Kunde A', titel: 'Beratung', betrag: 119, status, ...x });
  const rechnungen = [re('r-geplant', 'geplant'), re('r-gestellt', 'gestellt', { nummer: 'RE-1' }), re('r-bezahlt', 'bezahlt', { notiz: 'alt' }), re('r-storniert', 'storniert', { storniertAm: '2026-09-01', stornoGrund: 'doppelt' })];
  const liste = pruefliste({ finanzplan: { rechnungen }, buchungen: null, liquiplan: null }, h);
  const nach = (id: string) => liste.find(p => p.quelle === 'rechnung' && p.id === id)!;

  it('bietet „entfernen“ nur, wo der Rechnungsschutz Löschen erlaubt', () => {
    for (const r of rechnungen) {
      expect(nach(r.id).aktionen.includes('entfernen'), r.status).toBe(rechnungSchutz(r, null) === null);
    }
    expect(nach('r-geplant').vorschlag).toBe('entfernen');
    expect(nach('r-gestellt')).toMatchObject({ vorschlag: 'behalten', aktionen: ['kdc', 'kdv', 'ug', 'behalten'] });
    expect(nach('r-bezahlt').grund).toContain('nicht gelöscht');
  });

  it('Sperre (409): Löschen, Dublette oder Übernehmen einer gestellten/bezahlten Rechnung', () => {
    for (const aktion of ['entfernen', 'dublette', 'uebernehmen']) {
      expect(entflechtungSperre(rechnungen, [{ quelle: 'rechnung', id: 'r-gestellt', aktion }])).toMatch(/nicht gelöscht, sondern storniert/);
    }
    expect(entflechtungSperre(rechnungen, [{ quelle: 'rechnung', id: 'r-bezahlt', aktion: 'entfernen' }])).toMatch(/bezahlt/);
    expect(entflechtungSperre(rechnungen, [{ quelle: 'rechnung', id: 'r-geplant', aktion: 'entfernen' }])).toBeNull();
    expect(entflechtungSperre(rechnungen, [{ quelle: 'rechnung', id: 'r-gestellt', aktion: 'kdc' }, { quelle: 'rechnung', id: 'r-gestellt', aktion: 'behalten' }])).toBeNull();
    // Gleiche Kennung in einer anderen Quelle betrifft die Rechnung nicht.
    expect(entflechtungSperre(rechnungen, [{ quelle: 'planposten', id: 'r-gestellt', aktion: 'entfernen' }])).toBeNull();
  });

  it('verschiebt nur mit Vermerk — gelöscht wird nur die geplante', () => {
    const weg = new Set(['r-geplant', 'r-gestellt', 'r-storniert']);
    const zuordnen = new Map([['r-bezahlt', 'kdc']]);
    const aus = rechnungenEntflechten(rechnungen, weg, zuordnen, '2026-09-28');
    expect(aus.map(r => r.id)).toEqual(['r-gestellt', 'r-bezahlt', 'r-storniert']);
    expect(aus[0]).toEqual(rechnungen[1]);
    expect(aus[2]).toEqual(rechnungen[3]);
    expect(aus[1]).toMatchObject({ firmaId: 'kdc', status: 'bezahlt', betrag: 119 });
    expect(aus[1].notiz).toBe('alt · Aus „privat“ nach Selbstständigkeit verschoben am 2026-09-28 (Entflechtung).');
    expect(rechnungSchutz(rechnungen[2], aus[1])).toBeNull();
  });
});

// ─── Zuordnen: die eine Einheitenliste + KEMARIS (28.09.) ───────────────────
// Vorher bot die Prüfliste nur kdv · kdc · kemaris — die MAKE Innovation GmbH fehlte, und die
// Route hätte eine UG-Zuordnung als „weg“ gezählt. Namen kommen aus lib/einheiten.ts.
import { AKTION_TEXT, ZUORDNUNGEN, istZuordnung, zuordnungName } from '../lib/finanzen/haushalt/entflechtung';
import { GESELLSCHAFTEN, finanzOrtName } from '../lib/einheiten';

describe('Prüfliste: Zuordnen zu allen Gesellschaften', () => {
  it('genau die Gesellschaften aus lib/einheiten.ts — keine feste Beteiligung mehr (09.10., Plattform-Regel)', () => {
    expect(ZUORDNUNGEN).toEqual([...GESELLSCHAFTEN]);
    expect(ZUORDNUNGEN).toContain('ug');
    for (const g of GESELLSCHAFTEN) expect(AKTION_TEXT[g]).toBe(`gehört zu: ${finanzOrtName(g)}`);
    expect(AKTION_TEXT.ug).toBe('gehört zu: MAKE Innovation GmbH');
    expect(istZuordnung('kemaris')).toBe(false);
    expect(zuordnungName('altwert')).toBe('altwert'); // ein gespeicherter Altwert wird roh genannt, nie still umgedeutet
    expect(istZuordnung('ug')).toBe(true);
    expect(istZuordnung('entfernen')).toBe(false);
    expect(istZuordnung('privat')).toBe(false);
  });
  it('firmenloser Planposten lässt sich der UG zuordnen', () => {
    const l = pruefliste({ finanzplan: null, buchungen: null, liquiplan: { posten: [{ id: 'p9', titel: 'Hosting', betrag: -20, rhythmus: 'monatlich' }] } }, h);
    expect(l[0].aktionen).toEqual(['kdc', 'kdv', 'ug', 'entfernen', 'behalten']);
  });
  it('gestellte Rechnung → UG: verschoben mit Vermerk, nichts gelöscht', () => {
    const r: Rechnung = { id: 'r-ug', firmaId: 'privat', kunde: 'Kunde B', titel: 'Lizenz', betrag: 59.5, status: 'gestellt', nummer: 'RE-2' };
    const aus = rechnungenEntflechten([r], new Set(), new Map([['r-ug', 'ug']]), '2026-09-28');
    expect(aus).toHaveLength(1);
    expect(aus[0]).toMatchObject({ firmaId: 'ug', betrag: 59.5, status: 'gestellt' });
    expect(aus[0].notiz).toBe(`Aus „privat“ nach ${zuordnungName('ug')} verschoben am 2026-09-28 (Entflechtung).`);
    expect(aus[0].notiz).toContain('MAKE Innovation GmbH');
  });
});
