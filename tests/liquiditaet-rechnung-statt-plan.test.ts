// Rundgang 19.10. A2 (21.10.): Die Liquidität zählte eine gestellte Rechnung eines Mandats UND die Planposten desselben Monats.
// Regel (EINE Stelle, lib/make-one/liquiditaet.ts `rechnungDeckung`): Gibt es für einen Mandats-Monat eine Rechnung (gestellt/bezahlt, nicht storniert,
// Mandat + Leistungsmonat), zählt die Rechnung — der Planposten dieses Monats nicht. Gilt für die Vorschau UND die Kopfzahl „Was reinkommt“, auch für
// Altbestand ohne die neuen Felder; ohne solche Rechnungen bit-gleich. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { mandatPosten } from '../lib/crm/kunden';
import { monatsPositionen, POS } from '../lib/crm/mandat-zusatz';
import { leistungsmonat } from '../lib/crm/mandat-laufzeit';
import { rechnungSummen } from '../lib/finanzen/rechnung/regeln';
import {
  vorschau, monatsSumme, rechnungDeckung, KEINE_DECKUNG, postenLeistungsmonat, mandatVonPosten, ABGERECHNET_PRAEFIX, type Planposten, type Rechnung,
} from '../lib/make-one/liquiditaet';
import { nettoAusBrutto } from '../lib/finanzen/ust';
import type { Leistung, Mandat } from '../lib/crm/typen';

const J = '2026-10-19T08:00:00.000Z';
const MESSE = { id: 'l-messe', name: 'Messe-Modul', typ: 'vermittlung', stufe: 'kern', rolle: 'zusatz', preis: { betrag: 1900, einheit: 'pauschal netto' }, preise: [{ id: 'pt-1', art: 'fest', betragCent: 190_000, rolle: 'grund', zahlplan: { anzahlungProzent: 50 } }], lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J } as unknown as Leistung;
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-see', kunde: 'Seeblick Beispiel GmbH', firmaId: 'f-see', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-19', verlaengerung: 'offen', mindestlaufzeitMonate: 6, honorar: { betrag: 2900, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  zusatz: [{ id: 'mz-messe', leistungId: 'l-messe', honorar: { betragCent: 190_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } }], ...x,
} as Mandat);
const ctx = { katalog: [MESSE], nettoAusBrutto };

/** Die Monatsrechnung eines Leistungsmonats, wie der Rechnungs-Server sie anlegt (Positionen, Leistungsmonat, Fälligkeit = Beginn + Zahlungsziel). */
function monatsRechnung(m: Mandat, monat: string, x: Partial<Rechnung> = {}): Rechnung {
  const lm = leistungsmonat(m, monat)!;
  const positionen = monatsPositionen(m, monat, ctx);
  const faellig = new Date(Date.parse(`${lm.von}T12:00:00Z`) + m.zahlungszielTage * 864e5).toISOString().slice(0, 10);
  return { id: `r-${monat}`, kunde: m.kunde, titel: `${m.titel} — ${monat}`, betrag: rechnungSummen(positionen).brutto / 100, status: 'gestellt', faellig, mandatId: m.id, leistungVon: lm.von, leistungBis: lm.bis, zahlungszielTage: m.zahlungszielTage, positionen, ...x };
}
const ein = (v: ReturnType<typeof vorschau>) => v.wochen.flatMap(w => w.bewegungen.filter(b => b.betrag > 0).map(b => ({ datum: b.datum, cent: Math.round(b.betrag * 100), art: b.quelle?.art })));
const summe = (l: { cent: number }[]) => l.reduce((a, b) => a + b.cent, 0);
const ohneFelder = (l: Planposten[]) => l.map(({ mandatId: _m, leistungsmonat: _l, ...p }) => p as Planposten);

describe('A2 · Rechnung statt Plan in der Vorschau', () => {
  const m = mandat();
  const posten = mandatPosten(m, '2026-10-19', { katalog: [MESSE] });
  const okt = monatsRechnung(m, '2026-10');

  it('die Posten tragen Mandat und Leistungsmonat (Oktober anteilig, Anzahlung, Rest, volle Monate)', () => {
    expect(posten.map(p => [p.id, p.mandatId, p.leistungsmonat])).toEqual([
      ['lp-mandat-m-see~2026-10', 'm-see', '2026-10'],
      ['lp-mandat-m-see~z-mz-messe~2026-10', 'm-see', '2026-10'],
      ['lp-mandat-m-see', 'm-see', '2026-11'],
      ['lp-mandat-m-see~2027-04', 'm-see', '2027-04'],
      // Rest bei Abschluss (25.10.): im Monat des Mandatsendes (Ende der Mindestlaufzeit), nicht mehr im Folgemonat des Beginns.
      ['lp-mandat-m-see~z-mz-messe~2027-04', 'm-see', '2027-04'],
    ]);
  });
  it('gestellte Oktober-Rechnung: in der Woche ab 02.11. steht nur die Rechnung — die Posten des Oktobers zählen nicht mehr', () => {
    const nur = ein(vorschau([], [], [], [], '2026-10-27', 12, false, posten, 'real'));
    const mit = ein(vorschau([], [okt], [], [], '2026-10-27', 12, false, posten, 'real'));
    const tag = '2026-11-02';
    // Vorher (der Rundgang): Rechnung + zwei Posten am 02.11. — jetzt die Rechnung allein, mit genau ihrem Betrag.
    expect(nur.filter(b => b.datum === tag).map(b => b.art)).toEqual(['planposten', 'planposten']);
    expect(mit.filter(b => b.datum === tag)).toEqual([{ datum: tag, cent: Math.round(okt.betrag * 100), art: 'rechnung' }]);
    // Summe der Posten des Oktobers = die Rechnung (auf den Cent) — also bleibt die Summe über alle Wochen gleich, nichts doppelt.
    expect(summe(nur.filter(b => b.datum === tag))).toBe(Math.round(okt.betrag * 100));
    expect(summe(mit)).toBe(summe(nur));
  });
  it('bezahlt: weder Rechnung (schon auf dem Konto) noch Posten; storniert: der Posten zählt wieder', () => {
    const bez = ein(vorschau([], [{ ...okt, status: 'bezahlt' }], [], [], '2026-10-27', 12, false, posten, 'real'));
    expect(bez.filter(b => b.datum === '2026-11-02')).toEqual([]);
    const sto = ein(vorschau([], [{ ...okt, status: 'storniert' }], [], [], '2026-10-27', 12, false, posten, 'real'));
    expect(sto).toEqual(ein(vorschau([], [], [], [], '2026-10-27', 12, false, posten, 'real')));
  });
  it('ein Monat in einem wiederkehrenden Posten: nur dieser Zahltag fällt weg (November-Rechnung), Dezember zählt weiter', () => {
    const nov = monatsRechnung(m, '2026-11');
    const mit = ein(vorschau([], [nov], [], [], '2026-11-03', 8, false, posten, 'real'));
    expect(mit.filter(b => b.art === 'planposten' && b.datum === '2026-11-15')).toEqual([]);
    expect(mit.filter(b => b.art === 'planposten' && b.datum === '2026-12-15')).toHaveLength(1);
    expect(mit.filter(b => b.art === 'rechnung')).toEqual([{ datum: '2026-11-15', cent: Math.round(nov.betrag * 100), art: 'rechnung' }]);
  });
  it('Entwurf: zählt nicht und ersetzt nichts (realistisch); optimistisch zählt er — und ersetzt den Posten', () => {
    const entwurf = { ...okt, status: 'geplant' };
    expect(ein(vorschau([], [entwurf], [], [], '2026-10-27', 12, false, posten, 'real'))).toEqual(ein(vorschau([], [], [], [], '2026-10-27', 12, false, posten, 'real')));
    const opt = ein(vorschau([], [entwurf], [], [], '2026-10-27', 12, true, posten, 'real'));
    expect(summe(opt)).toBe(summe(ein(vorschau([], [], [], [], '2026-10-27', 12, true, posten, 'real'))));
  });
  it('keine Monatsrechnung: aus einem Angebot, nur abgerechnete Zusatzmodule, ohne Mandat oder Leistungsmonat — der Plan zählt weiter', () => {
    const keine: Rechnung[] = [
      { ...okt, id: 'r-a', angebotId: 'ang-1' },
      { ...okt, id: 'r-za', positionen: [{ id: `${ABGERECHNET_PRAEFIX}1` }] },
      { ...okt, id: 'r-ohne', mandatId: undefined },
      { ...okt, id: 'r-ohne-lm', leistungVon: undefined },
      { ...okt, id: 'r-storno', art: 'storno' },
    ];
    const planposten = (r: Rechnung[]) => ein(vorschau([], r, [], [], '2026-10-27', 12, false, posten, 'real')).filter(b => b.art === 'planposten');
    expect(planposten(keine)).toEqual(planposten([]));
    expect(POS.abrechnen).toBe(ABGERECHNET_PRAEFIX);
  });
});

describe('A2 · Altbestand ohne die neuen Felder — dieselbe Regel', () => {
  it('Mandat aus der Kennung, Monat aus der Kennung bzw. ab − Zahlungsziel (auch bei 30 Tagen)', () => {
    const m30 = mandat({ zahlungszielTage: 30, zusatz: undefined });
    const alt = ohneFelder(mandatPosten(m30, '2026-10-19'));
    expect(alt.every(p => !('mandatId' in p) && !('leistungsmonat' in p))).toBe(true);
    for (const p of alt) expect(mandatVonPosten(p)).toBe('m-see');
    const voll = alt.find(p => p.id === 'lp-mandat-m-see')!;
    // ab = 01.11. + 30 Tage = 01.12. → Leistungsmonat November; der nächste Zahltag (01.01.) gehört zum Dezember.
    expect([voll.ab, postenLeistungsmonat(voll, voll.ab, 30), postenLeistungsmonat(voll, '2027-01-01', 30)]).toEqual(['2026-12-01', '2026-11', '2026-12']);
    const nov = monatsRechnung(m30, '2026-11');
    const mit = ein(vorschau([], [nov], [], [], '2026-11-20', 8, false, alt, 'real'));
    expect(mit.filter(b => b.art === 'planposten' && b.datum === '2026-12-01')).toEqual([]);
    expect(mit.filter(b => b.art === 'planposten' && b.datum === '2027-01-01')).toHaveLength(1);
  });
  it('ohne Rechnungen bit-gleich: KEINE_DECKUNG, gleiche Vorschau mit und ohne die neuen Felder', () => {
    expect(rechnungDeckung([])).toBe(KEINE_DECKUNG);
    const posten = mandatPosten(mandat(), '2026-10-19', { katalog: [MESSE] });
    const a = vorschau([], [], [], [], '2026-10-19', 30, false, posten, 'real');
    const b = vorschau([], [], [], [], '2026-10-19', 30, false, ohneFelder(posten), 'real');
    expect(a).toEqual(b);
    // Eine fremde Rechnung (anderes Mandat) ändert an den Posten nichts.
    const fremd = monatsRechnung(mandat({ id: 'm-anders' }), '2026-10');
    const c = vorschau([], [fremd], [], [], '2026-10-19', 30, false, posten, 'real');
    expect(c.wochen.map(w => w.bewegungen.filter(x => x.quelle?.art === 'planposten'))).toEqual(a.wochen.map(w => w.bewegungen));
  });
});

describe('A2 · Kopfzahl „Was reinkommt“ — dieselbe Regel', () => {
  it('ein wiederkehrender Posten, dessen einziger Zahltag im Fenster schon eine Rechnung trägt, zählt je Monat nicht', () => {
    const m = mandat({ zusatz: undefined });
    const posten = mandatPosten(m, '2026-10-19');
    const heute = '2026-11-03';
    expect(monatsSumme(posten, heute)).toBe(3451);
    const deckung = rechnungDeckung([monatsRechnung(m, '2026-11')]);
    expect(monatsSumme(posten, heute, deckung)).toBe(0);
    // Ohne passende Rechnung: dieselbe Zahl wie vorher.
    expect(monatsSumme(posten, heute, rechnungDeckung([monatsRechnung(m, '2026-10')]))).toBe(3451);
  });
});
