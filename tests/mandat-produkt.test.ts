// ─── Produkte & Mandate · P3 Mandat (19.10.): Vorlage aus dem Produkt, Zusatzmodule in Rechnung und Liquidität, Anrechnung, Deal folgt Angebot ──
// Erfundene Produkte, Preise und Namen — nie echte Inhalte einer Instanz (Plattform-Regel). Geprüft wird (PRODUKTE_KONZEPT.md „Mandat übernimmt den Vertrag“):
//   · Vorlage aus jeder Preis-Form (+ Mandat, Änderungen im Dialog gewinnen, Excel-Einfügen, angenommenes Angebot) — Altbestand bit-gleich
//   · Zusatz monatlich (Teilmonat anteilig), einmalig 50/50, je Event „abrechnen“, Stundensatz mit Deckel, jährlich, inklusive (0 €)
//   · Anrechnung genau einmal, höchstens bis zum Rechnungsbetrag
//   · Teilmonat mit Zusatz: Summe der Liquidität = Summe der Monatsrechnungen (auf den Cent)
//   · Mandat ohne Zusatz rechnet bit-gleich wie bisher
//   · Prüfen der Zusatzmodule im Schreibweg (400/413), Deal folgt dem Angebot (Hauptprodukt)
import { describe, it, expect } from 'vitest';
import { mandatVorlageAusProdukt, mandatZusatzPruefen, mandatZusatzSaeubern, zusatzExtras, pruefStatus, type PreisTeil } from '@/lib/crm/produkt-karte';
import { mandatEntwurf, mandatEingabeAus, vertragEingabeAus } from '@/lib/crm/mandat-anlegen';
import { neuesMandat, mandatPlan } from '@/lib/crm/mandate-tabelle';
import { mandatVorbelegung, angebotHauptprodukt } from '@/lib/crm/angebote';
import {
  monatsPositionen, zusatzPositionen, abrechnenPositionen, abrechnenWahlAus, anrechnungPositionen, anrechnungId, gekauftCent, zusatzLiquiditaet, zusatzArt,
  zusatzBeschreibung, nurAbgerechnet, positionsId, anrechnungLiquiditaet, type AnrechnungKontext,
} from '@/lib/crm/mandat-zusatz';
import { mandatPosten, mandatLiquiLage, postenAngleichen, postenVomMandat, hauptPostenId, anrechnungPostenId, ANRECHNUNG_FEHLT } from '@/lib/crm/kunden';
import { geplantesEnde, leistungsmonat } from '@/lib/crm/mandat-laufzeit';
import { positionAusMandat, rechnungSummen, positionenSaeubern } from '@/lib/finanzen/rechnung/regeln';
import { zahltage, type Planposten } from '@/lib/make-one/liquiditaet';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import type { Angebot, Leistung, Mandat, MandatZusatz } from '@/lib/crm/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';

const J = '2026-10-19T08:00:00.000Z';
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispielwerk GmbH', firmaId: 'f-beispiel', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-11-01', verlaengerung: 'offen', mindestlaufzeitMonate: 6, honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, leistungId: 'l-haupt', ...x,
} as Mandat);
const zusatz = (x: Partial<MandatZusatz>): MandatZusatz => ({ id: 'mz-1', leistungId: 'l-mon', ...x } as MandatZusatz);

// ── Erfundener Katalog in allen Preis-Formen ──
const HAUPT = leistung({
  id: 'l-haupt', name: 'Vertriebsbegleitung', angebot: { leistungstext: 'Führung des Vertriebs.' }, lieferumfang: ['Wochenplan'],
  preise: [teil({ id: 'pt-mon', art: 'monatlich', betragCent: 250_000 })], vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar', kuendigungsfristTage: 30, zahlungszielTage: 10 },
  regeln: { inklusive: [{ leistungId: 'l-event', menge: 1, je: 'quartal' }] },
});
const MON = leistung({ id: 'l-mon', name: 'Reporting-Modul', rolle: 'zusatz', preise: [teil({ art: 'monatlich', betragCent: 49_000 })] });
const EVENT = leistung({ id: 'l-event', name: 'Messebegleitung', typ: 'vermittlung', rolle: 'beides', dauerTage: 60, preise: [teil({ id: 'pt-auf', art: 'fest', betragCent: 500_000, zahlplan: { anzahlungProzent: 50 } }), teil({ id: 'pt-je', art: 'je_einheit', betragCent: 150_000, einheit: 'je Event', rolle: 'option' })] });
const JE = leistung({ id: 'l-je', name: 'Messe-Einsatz', rolle: 'zusatz', preise: [teil({ art: 'je_einheit', betragCent: 150_000, einheit: 'je Event' })] });
const STD = leistung({ id: 'l-std', name: 'Sparring', typ: 'sprint', rolle: 'zusatz', preise: [teil({ art: 'stundensatz', betragCent: 18_000, deckel: { stundenJeMonat: 20 } })] });
const TAG = leistung({ id: 'l-tag', name: 'Beratungstag', typ: 'sprint', rolle: 'zusatz', preise: [teil({ art: 'tagessatz', betragCent: 140_000 })] });
const JAHR = leistung({ id: 'l-jahr', name: 'Assistent', typ: 'software', rolle: 'zusatz', preise: [teil({ art: 'jaehrlich', betragCent: 120_000 })] });
const WS = leistung({ id: 'l-ws', name: 'Klarheitstag', typ: 'workshop', preise: [teil({ art: 'fest', betragCent: 480_000 })], regeln: { anrechnung: { auf: ['l-haupt'], anteilProzent: 100 } } });
const FREI = leistung({ id: 'l-frei', name: 'Erstgespräch', typ: 'diagnose', preise: [teil({ art: 'kostenlos' })] });
const ERFOLG = leistung({ id: 'l-erfolg', name: 'Vermittlung', typ: 'vermittlung', preise: [teil({ art: 'erfolg', text: 'zehn Prozent der ersten Jahresgage' })] });
const KATALOG = [HAUPT, MON, EVENT, JE, STD, TAG, JAHR, WS, FREI, ERFOLG];
const ctx = { katalog: KATALOG, nettoAusBrutto };

describe('Vorlage aus dem Produkt — jede Preis-Form', () => {
  const entwurf = (l: Leistung, vertrag?: Parameters<typeof mandatEntwurf>[0]['vertrag']) => mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'A GmbH' }, kontaktIds: ['c-a'], gesellschaft: 'offen', leistung: l, ...(vertrag ? { vertrag } : {}), jetzt: J, person: 'kevin' });
  it('monatlich: Honorar, Vertrag, Leistungen, Gesellschaft vom Produkt, inklusive Modul laut Regel', () => {
    const m = entwurf(HAUPT);
    expect(m).toMatchObject({ gesellschaft: 'ug', honorar: { betrag: 2500, basis: 'monat', netto: true }, rechnungsrhythmus: 'monatlich', mindestlaufzeitMonate: 6, kuendigungsfristTage: 30, verlaengerung: 'auto', zahlungszielTage: 10, leistungen: ['Führung des Vertriebs.', 'Wochenplan'] });
    expect(m.zusatz).toEqual([{ id: 'mz-1', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' }]);
  });
  it('fest, jährlich, je Einheit, Tagessatz, Stundensatz, Erfolg, kostenlos', () => {
    expect(entwurf(WS).honorar).toEqual({ betrag: 4800, basis: 'einmalig', netto: true });
    expect(entwurf(WS).rechnungsrhythmus).toBe('einmalig');
    expect(entwurf(JAHR).honorar).toEqual({ betrag: 100, basis: 'monat', netto: true });
    expect(entwurf(JE).honorar).toEqual({ betrag: 1500, basis: 'einmalig', netto: true });
    expect(entwurf(JE).offen).toContain('Preis je Event — Menge beim Abrechnen angeben.');
    expect(entwurf(TAG).honorar).toEqual({ betrag: 1400, basis: 'tag', netto: true });
    expect(entwurf(STD).honorar).toEqual({ betrag: 3600, basis: 'monat', netto: true });
    expect(entwurf(ERFOLG).honorar.betrag).toBe(0);
    expect(entwurf(FREI).honorar).toEqual({ betrag: 0, basis: 'einmalig', netto: true });
  });
  it('was im Dialog geändert wurde, gewinnt (Honorar, Laufzeit, Rhythmus, Zahlungsziel, Leistungen)', () => {
    const m = entwurf(HAUPT, { honorar: { betrag: 2500, basis: 'monat' }, mindestlaufzeitMonate: null, rechnungsrhythmus: 'quartal', zahlungszielTage: 30, leistungen: ['Nur das'] });
    expect(m).toMatchObject({ honorar: { betrag: 2500, basis: 'monat', netto: true }, rechnungsrhythmus: 'quartal', zahlungszielTage: 30, leistungen: ['Nur das'] });
    expect(m.mindestlaufzeitMonate).toBeUndefined();
    // Einmaliges Honorar ohne eigenen Rhythmus → einmalig abgerechnet.
    expect(entwurf(HAUPT, { honorar: { betrag: 900, basis: 'einmalig' } }).rechnungsrhythmus).toBe('einmalig');
  });
  it('Eingabe aus dem Netz: Unsinn 400, zu viel 413, nie gekürzt', () => {
    expect(vertragEingabeAus({ honorar: { betrag: -1, basis: 'monat' } })).toMatchObject({ ok: false, status: 400 });
    expect(vertragEingabeAus({ mindestlaufzeitMonate: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(vertragEingabeAus({ leistungen: Array.from({ length: 51 }, (_, i) => `L${i}`) })).toMatchObject({ ok: false, status: 413 });
    expect(vertragEingabeAus({ leistungen: ['x'.repeat(401)] })).toMatchObject({ ok: false, status: 413 });
    const e = mandatEingabeAus({ firma: { name: 'A GmbH' }, person: { id: 'c-a' }, gesellschaft: 'ug', leistungId: 'l-haupt', vertrag: { honorar: { betrag: 100, basis: 'tag' }, zahlungszielTage: 7 } });
    expect(e.ok && e.e.vertrag).toEqual({ honorar: { betrag: 100, basis: 'tag' }, zahlungszielTage: 7 });
  });
  it('Zusatzmodul übernimmt Zahlplan (50/50) bzw. den Deckel als geplante Stunden', () => {
    expect(zusatzExtras(EVENT)).toEqual({ zahlplan: { anzahlungProzent: 50 } });
    expect(zusatzExtras(STD)).toEqual({ stundenJeMonat: 20 });
    const v = mandatVorlageAusProdukt(HAUPT, [{ leistung: STD }, { leistung: EVENT, inklusive: false }]);
    expect(v.zusatz).toEqual([
      { id: 'mz-1', leistungId: 'l-std', honorar: { betragCent: 18_000, basis: 'stunde' }, stundenJeMonat: 20 },
      { id: 'mz-2', leistungId: 'l-event', honorar: { betragCent: 500_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } },
    ]);
    expect(mandatZusatzSaeubern(v.zusatz)).toEqual(v.zusatz);
  });
  it('Excel-Einfügen: erkanntes Produkt (Karte) belegt vor, die Zeile gewinnt; Altbestand wie bisher', () => {
    const basis = { quelle: 'Zeile 2', kunde: 'A GmbH', titel: 'Vertriebsbegleitung', gesellschaft: 'ug' as const, leistung: { id: 'l-haupt', name: 'Vertriebsbegleitung', typ: 'retainer' as const } };
    const ohne = neuesMandat('m-tab-1', basis, { id: 'f-a', name: 'A GmbH' }, 'q', HAUPT);
    expect(ohne).toMatchObject({ honorar: { betrag: 2500, basis: 'monat' }, mindestlaufzeitMonate: 6, zahlungszielTage: 10, kuendigungsfristTage: 30, verlaengerung: 'auto', leistungen: ['Führung des Vertriebs.', 'Wochenplan'] });
    const mit = neuesMandat('m-tab-1', { ...basis, honorar: 2000, laufzeit: 12, ustSatz: 0 }, { id: 'f-a', name: 'A GmbH' }, 'q', HAUPT);
    expect(mit).toMatchObject({ honorar: { betrag: 2000, basis: 'monat' }, mindestlaufzeitMonate: 12, ustSatz: 0 });
    const alt = leistung({ id: 'l-haupt', name: 'Vertriebsbegleitung' });
    expect(neuesMandat('m-tab-1', basis, { id: 'f-a', name: 'A GmbH' }, 'q', alt)).toEqual(neuesMandat('m-tab-1', basis, { id: 'f-a', name: 'A GmbH' }, 'q'));
    const plan = mandatPlan([basis], { firmen: [], mandate: [], leistungen: KATALOG }, '2026-10-19', J).zeilen[0];
    expect(plan.aenderungen).toContainEqual({ feld: 'Honorar / Monat', neu: '2.500,00 € (vom Produkt)' });
    expect(plan.text).toBeUndefined();
  });
  it('angenommenes Angebot: inklusive Module des Hauptprodukts kommen dazu (0 €, nie doppelt mit dem Angebot)', () => {
    const a = { positionen: [{ id: 'p-1', leistungId: 'l-haupt', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 250_000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 }], gesellschaft: 'ug', titel: 'Begleitung', zahlungszielTage: 14 } as unknown as Angebot;
    expect(mandatVorbelegung(a, KATALOG).zusatz).toEqual([{ id: 'mz-1', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' }]);
    expect(mandatVorbelegung(a).zusatz).toBeUndefined();
  });
});

describe('Zusatzmodule auf der Monatsrechnung', () => {
  const brutto = (m: Mandat, monat: string) => rechnungSummen(monatsPositionen(m, monat, ctx)).brutto;
  it('monatlich: angebrochener Monat anteilig (dieselbe Regel wie das Honorar), dann voll', () => {
    const m = mandat({ zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' }, ab: '2026-11-18' })] });
    const nov = monatsPositionen(m, '2026-11', ctx);
    expect(nov.map(p => [p.id, p.einzelpreisCent])).toEqual([['p1', 250_000], [positionsId('monat', 'mz-1'), 21_233]]);
    expect(nov[1]).toMatchObject({ titel: 'Reporting-Modul — November 2026 (anteilig ab 18.11., 13 von 30 Tagen)', einheit: 'pauschal', leistungId: 'l-mon', ustSatz: 19 });
    expect(monatsPositionen(m, '2026-12', ctx)[1]).toMatchObject({ einzelpreisCent: 49_000, einheit: 'Monat' });
    expect(zusatzArt(m.zusatz![0])).toBe('monat');
  });
  it('einmalig 50/50: Anzahlung im Monat des Beginns, Rest im Monat von „bis“ (ohne „bis“ im Folgemonat)', () => {
    const z = zusatz({ id: 'mz-ev', leistungId: 'l-event', honorar: { betragCent: 500_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 }, ab: '2026-11-10', bis: '2027-01-09' });
    const m = mandat({ zusatz: [z] });
    expect(zusatzPositionen(m, '2026-11', ctx)).toMatchObject([{ titel: 'Messebegleitung — Anzahlung 50 %', einzelpreisCent: 250_000 }]);
    expect(zusatzPositionen(m, '2026-12', ctx)).toEqual([]);
    expect(zusatzPositionen(m, '2027-01', ctx)).toMatchObject([{ titel: 'Messebegleitung — Restzahlung 50 %', einzelpreisCent: 250_000 }]);
    const ohneBis = mandat({ zusatz: [{ ...z, bis: undefined }] });
    expect(zusatzPositionen(ohneBis, '2026-12', ctx)).toMatchObject([{ einzelpreisCent: 250_000 }]);
    // Ohne Zahlplan: voll im Monat des Beginns; 30 % Anzahlung kaufmännisch, Rest = Betrag − Anzahlung.
    expect(zusatzPositionen(mandat({ zusatz: [{ ...z, zahlplan: undefined }] }), '2026-11', ctx)).toMatchObject([{ titel: 'Messebegleitung', einzelpreisCent: 500_000 }]);
    const drittel = mandat({ zusatz: [{ ...z, honorar: { betragCent: 100_001, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 30 } }] });
    expect(zusatzPositionen(drittel, '2026-11', ctx)[0].einzelpreisCent + zusatzPositionen(drittel, '2027-01', ctx)[0].einzelpreisCent).toBe(100_001);
  });
  it('je Event: nie von selbst — nur „abrechnen“ mit Menge', () => {
    const m = mandat({ zusatz: [zusatz({ id: 'mz-je', leistungId: 'l-je', honorar: { betragCent: 150_000, basis: 'einheit' } })] });
    expect(zusatzPositionen(m, '2026-11', ctx)).toEqual([]);
    const r = abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-je', menge: 3 }], ctx);
    expect(r.ok && r.positionen).toEqual([{ id: positionsId('abrechnen', 'mz-je'), leistungId: 'l-je', titel: 'Messe-Einsatz — November 2026', text: 'Zusatzmodul, nach Menge', menge: 3, einheit: 'Event', einzelpreisCent: 150_000, ustSatz: 19 }]);
    expect(abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-je', menge: 0 }], ctx)).toMatchObject({ ok: false, status: 400 });
    expect(abrechnenPositionen(m, '2026-10', [{ zusatzId: 'mz-je', menge: 1 }], ctx)).toMatchObject({ ok: false, status: 409 });
    expect(abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-weg', menge: 1 }], ctx)).toMatchObject({ ok: false, status: 400 });
    expect(abrechnenPositionen(mandat({ zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' } })] }), '2026-11', [{ zusatzId: 'mz-1', menge: 1 }], ctx)).toMatchObject({ ok: false, status: 409 });
    expect(abrechnenWahlAus([{ zusatzId: 'x', menge: 1 }])).toMatchObject({ ok: false, status: 400 });
    expect(abrechnenWahlAus(Array.from({ length: 21 }, () => ({ zusatzId: 'mz-je', menge: 1 })))).toMatchObject({ ok: false, status: 413 });
    expect(abrechnenWahlAus(undefined)).toEqual({ ok: true, wahl: [] });
  });
  it('Stundensatz nach Stunden — höchstens der Deckel des Produkts; Tagessatz nach Tagen', () => {
    const m = mandat({ zusatz: [zusatz({ id: 'mz-std', leistungId: 'l-std', honorar: { betragCent: 18_000, basis: 'stunde' }, stundenJeMonat: 12 }), zusatz({ id: 'mz-tag', leistungId: 'l-tag', honorar: { betragCent: 140_000, basis: 'tag' } })] });
    const r = abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-std', menge: 25 }, { zusatzId: 'mz-tag', menge: 1.5 }], ctx);
    expect(r.ok && r.positionen.map(p => [p.menge, p.einheit, p.text])).toEqual([[20, 'Stunde', '25 Stunden erfasst — berechnet höchstens 20 Stunden je Monat (vereinbarter Deckel).'], [1.5, 'Tag', 'Zusatzmodul, nach Menge']]);
    expect(zusatzBeschreibung(m.zusatz![0], KATALOG)).toBe('180 € netto/Stunde · 12 Std./Monat geplant · höchstens 20 Std./Monat');
  });
  it('jährlich: im Monat des Beginns und alle 12 Monate', () => {
    const m = mandat({ verlaengerung: 'auto', zusatz: [zusatz({ id: 'mz-j', leistungId: 'l-jahr', honorar: { betragCent: 120_000, basis: 'jahr' }, ab: '2026-12-05' })] });
    const monate = ['2026-12', '2027-01', '2027-11', '2027-12', '2028-12'].map(mo => zusatzPositionen(m, mo, ctx).length);
    expect(monate).toEqual([1, 0, 0, 1, 1]);
  });
  it('inklusive: 0-€-Position mit Hinweis in jedem Monat — kein Posten in der Liquidität', () => {
    const m = mandat({ zusatz: [zusatz({ id: 'mz-inkl', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' })] });
    expect(zusatzPositionen(m, '2026-11', ctx)).toEqual([{ id: positionsId('inklusive', 'mz-inkl'), leistungId: 'l-event', titel: 'Messebegleitung — inklusive', text: 'Im Honorar enthalten (1 je Quartal).', menge: 1, einheit: 'pauschal', einzelpreisCent: 0, ustSatz: 19 }]);
    expect(rechnungSummen(monatsPositionen(m, '2026-11', ctx)).brutto).toBe(rechnungSummen(monatsPositionen(mandat(), '2026-11', ctx)).brutto);
    expect(zusatzLiquiditaet(m, '2026-11', geplantesEnde(m), ctx)).toEqual([]);
    expect(zusatzBeschreibung(m.zusatz![0])).toBe('inklusive · 1 je Quartal');
    // Abrechnen geht für inklusive nicht (es steht schon da).
    expect(abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-inkl', menge: 1 }], ctx)).toMatchObject({ ok: false, status: 409 });
  });
  it('Reihenfolge auf der Rechnung: Honorar, laufende, inklusive, jährliche, einmalige — und nur im Monat der Laufzeit', () => {
    const m = mandat({ zusatz: [
      zusatz({ id: 'mz-e', leistungId: 'l-event', honorar: { betragCent: 10_000, basis: 'einmalig' } }), zusatz({ id: 'mz-j', leistungId: 'l-jahr', honorar: { betragCent: 20_000, basis: 'jahr' } }),
      zusatz({ id: 'mz-i', leistungId: 'l-event', inklusive: true }), zusatz({ id: 'mz-m', honorar: { betragCent: 30_000, basis: 'monat' } }),
    ] });
    expect(monatsPositionen(m, '2026-11', ctx).map(p => p.id.slice(0, 3))).toEqual(['p1', 'zm-', 'zi-', 'zj-', 'ze-']);
    expect(monatsPositionen(m, '2026-10', ctx)).toEqual([]);
    expect(brutto(m, '2026-11')).toBe(rechnungSummen(monatsPositionen(m, '2026-11', ctx)).brutto);
  });
});

describe('Anrechnung — genau einmal, höchstens bis zum Betrag der Rechnung', () => {
  const m = mandat();
  const workshopRechnung: Rechnung = { id: 'r-ws', firmaId: 'ug', kunde: 'Beispielwerk GmbH', titel: 'Workshop', betrag: 5712, status: 'bezahlt', kundeFirmaId: 'f-beispiel', positionen: [{ id: 'p1', leistungId: 'l-ws', titel: 'Workshop', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 480_000, ustSatz: 19 }] };
  const ak = (rechnungen: Rechnung[], mandate: Mandat[] = [m]): AnrechnungKontext => ({ katalog: KATALOG, mandate, rechnungen, nettoAusBrutto });
  it('aus einer bezahlten Rechnung derselben Firma: Minusposition bis zum Rechnungsbetrag — die Rechnung steht auf 0 €', () => {
    const pos = monatsPositionen(m, '2026-11', ctx);
    const a = anrechnungPositionen(m, pos, ak([workshopRechnung]));
    expect(a).toEqual([{ id: anrechnungId('l-ws', 'f-beispiel'), leistungId: 'l-ws', titel: 'Anrechnung Klarheitstag', text: 'Angerechnet voll: 2.500,00 € von 4.800,00 € (höchstens bis zum Betrag dieser Rechnung, einmalig).', menge: 1, einheit: 'pauschal', einzelpreisCent: -250_000, ustSatz: 19 }]);
    expect(rechnungSummen([...pos, ...a]).netto).toBe(0);
    // Die Säuberung lässt nur der Anrechnung einen negativen Preis.
    expect(positionenSaeubern([...pos, ...a]).map(p => p.einzelpreisCent)).toEqual([250_000, -250_000]);
    expect(positionenSaeubern([{ ...a[0], id: 'p9' }])[0].einzelpreisCent).toBe(0);
  });
  it('steht sie schon auf einer gültigen Rechnung (auch Entwurf), nie noch einmal; nach Storno wieder frei', () => {
    const pos = monatsPositionen(m, '2026-12', ctx);
    const erste = anrechnungPositionen(m, pos, ak([workshopRechnung]));
    const nov: Rechnung = { id: 'r-nov', firmaId: 'ug', mandatId: 'm-1', kunde: 'x', titel: 'Nov', betrag: 0, status: 'geplant', positionen: [...pos, ...erste] };
    expect(anrechnungPositionen(m, pos, ak([workshopRechnung, nov]))).toEqual([]);
    expect(anrechnungPositionen(m, pos, ak([workshopRechnung, { ...nov, status: 'storniert' }]))).toHaveLength(1);
  });
  it('aus einem Mandat des Produkts (einmalig, ohne Rechnung), anteilig laut Regel; ohne Kauf bzw. ohne Firma: nichts', () => {
    const ws = mandat({ id: 'm-ws', leistungId: 'l-ws', honorar: { betrag: 4800, basis: 'einmalig', netto: true }, status: 'beendet' });
    const halb = KATALOG.map(l => (l.id === 'l-ws' ? { ...l, regeln: { anrechnung: { auf: ['l-haupt'], anteilProzent: 50 } } } : l));
    expect(gekauftCent('l-ws', 'f-beispiel', ak([], [m, ws]))).toBe(480_000);
    const a = anrechnungPositionen(m, monatsPositionen(m, '2026-11', ctx), { ...ak([], [m, ws]), katalog: halb });
    expect(a.map(p => [p.einzelpreisCent, p.text])).toEqual([[-240_000, 'Angerechnet zu 50 % (einmalig).']]);
    expect(anrechnungPositionen(m, monatsPositionen(m, '2026-11', ctx), ak([]))).toEqual([]);
    expect(anrechnungPositionen(mandat({ firmaId: undefined }), monatsPositionen(m, '2026-11', ctx), ak([workshopRechnung]))).toEqual([]);
  });
});

/** Alle Zahlungen einer Liste von Posten (Cent) in einem weiten Fenster. */
const liqSumme = (l: Planposten[]) => l.reduce((a, p) => a + zahltage(p, '2020-01-01', '2035-12-31').length * Math.round(p.betrag * 100), 0);
const monateVon = (von: string, bis: string) => { const l: string[] = []; for (let m = von; m <= bis;) { l.push(m); const [j, mo] = m.split('-').map(Number); m = mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, '0')}`; } return l; };
/** Die Monatsrechnungen (brutto, Cent) bis zum geplanten Ende — genau wie der Rechnungs-Server (Positionen + Summen). */
const rechnungenSumme = (m: Mandat) => { const ende = geplantesEnde(m)!; const mit = { ...m, ende }; return monateVon(m.start!.slice(0, 7), ende.slice(0, 7)).reduce((a, mo) => a + rechnungSummen(monatsPositionen(mit, mo, ctx)).brutto, 0); };

describe('Teilmonat mit Zusatz: Summe der Liquidität = Summe der Monatsrechnungen', () => {
  const faelle: { name: string; m: Partial<Mandat>; heute: string }[] = [
    { name: 'Beginn mitten im Monat, laufendes Modul ab Beginn', m: { start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true }, zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' } })] }, heute: '2026-10-18' },
    { name: 'krumme Beträge (Rundung je Rechnung) + Modul ab später, bis vor dem Ende', m: { start: '2026-10-05', honorar: { betrag: 4999.99, basis: 'monat', netto: true }, zusatz: [zusatz({ honorar: { betragCent: 33_333, basis: 'monat' }, ab: '2026-11-17', bis: '2027-02-11' })] }, heute: '2026-10-05' },
    { name: 'einmalig 50/50 + jährlich + laufend (alle zusammen)', m: { start: '2026-10-18', honorar: { betrag: 3333.33, basis: 'monat', netto: true }, zusatz: [
      zusatz({ id: 'mz-e', leistungId: 'l-event', honorar: { betragCent: 500_001, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 }, ab: '2026-11-05', bis: '2027-02-20' }),
      zusatz({ id: 'mz-j', leistungId: 'l-jahr', honorar: { betragCent: 120_007, basis: 'jahr' } }), zusatz({ id: 'mz-m', honorar: { betragCent: 12_345, basis: 'monat' } }),
    ] }, heute: '2026-10-18' },
    { name: 'Brutto-Honorar, Reverse Charge', m: { start: '2026-10-20', ustSatz: 0, honorar: { betrag: 3000, basis: 'monat', netto: false }, zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' }, ab: '2026-12-10' })] }, heute: '2026-10-20' },
  ];
  for (const f of faelle) {
    it(f.name, () => {
      const m = mandat({ ...f.m, leistungId: undefined });
      const posten = mandatPosten(m, f.heute, { katalog: KATALOG });
      expect(liqSumme(posten)).toBe(rechnungenSumme(m));
      // Die Posten der Module gehören zum Mandat (Plan angleichen, Lage, Link in die Akte).
      expect(posten.every(p => postenVomMandat(p.id, m))).toBe(true);
    });
  }
  it('Posten je Modul: angebrochene Monate einmalig, die vollen ein Monatsposten; 50/50 = zwei Zahlungen', () => {
    const m = mandat({ start: '2026-10-18', leistungId: undefined, zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' } }), zusatz({ id: 'mz-e', leistungId: 'l-event', honorar: { betragCent: 500_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 }, ab: '2026-11-05', bis: '2027-01-20' })] });
    const z = mandatPosten(m, '2026-10-18', { katalog: KATALOG }).filter(p => p.id.includes('~z-'));
    expect(z.map(p => [p.id, p.rhythmus, p.betrag, p.ab, p.bis ?? null])).toEqual([
      // Oktober 18.–31.: 490 € × 14/31 = 221,29 € netto → brutto auf der ganzen Rechnung gerundet 263,33 €; April 1.–17.: 490 € × 17/30 = 277,67 € → 330,42 €.
      ['lp-mandat-m-1~z-mz-1~2026-10', 'einmalig', 263.33, '2026-11-01', null],
      ['lp-mandat-m-1~z-mz-1', 'monatlich', 583.1, '2026-11-15', '2027-03-15'],
      ['lp-mandat-m-1~z-mz-e~2026-11', 'einmalig', 2975, '2026-11-19', null],
      ['lp-mandat-m-1~z-mz-e~2027-01', 'einmalig', 2975, '2027-01-15', null],
      ['lp-mandat-m-1~z-mz-1~2027-04', 'einmalig', 330.42, '2027-04-15', null],
    ]);
    expect(z[0].titel).toBe('Beispielwerk GmbH · Begleitung — Reporting-Modul Oktober 2026 anteilig');
  });
  it('Stundensatz: geplante Stunden je Monat (höchstens der Deckel) als Posten; je Einheit und inklusive: keiner', () => {
    const m = mandat({ leistungId: undefined, zusatz: [zusatz({ id: 'mz-std', leistungId: 'l-std', honorar: { betragCent: 18_000, basis: 'stunde' }, stundenJeMonat: 30 }), zusatz({ id: 'mz-je', leistungId: 'l-je', honorar: { betragCent: 150_000, basis: 'einheit' } })] });
    const z = zusatzLiquiditaet(m, '2026-11', geplantesEnde(m), ctx);
    expect(z).toEqual([{ id: 'z-mz-std', titel: 'Sparring', betrag: 4284, rhythmus: 'monatlich', ab: '2026-11-15', bis: '2027-04-15', notiz: 'Aus dem Mandat (CRM): Zusatzmodul „Sparring“ — 30 Std./Monat geplant (abgerechnet wird nach Stunden).' }]);
  });
  it('offen verlängert: das laufende Modul läuft ohne Ende weiter', () => {
    const m = mandat({ verlaengerung: 'auto', mindestlaufzeitMonate: undefined, leistungId: undefined, zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' } })] });
    const z = zusatzLiquiditaet(m, '2026-11', geplantesEnde(m), ctx);
    expect(z).toEqual([{ id: 'z-mz-1', titel: 'Reporting-Modul', betrag: 583.1, rhythmus: 'monatlich', ab: '2026-11-15', notiz: 'Aus dem Mandat (CRM): Zusatzmodul „Reporting-Modul“ — wie die Monatsrechnung.' }]);
  });
  it('„Plan angleichen“ kennt die Module; alte Posten bleiben, bis jemand angleicht', () => {
    const ohne = mandat({ leistungId: undefined });
    const alt = mandatPosten(ohne, '2026-10-19');
    const m = { ...ohne, zusatz: [zusatz({ honorar: { betragCent: 49_000, basis: 'monat' } })] };
    const lage = mandatLiquiLage(m, alt, '2026-10-19', KATALOG);
    expect(lage.lage).toBe('abweichend');
    expect(lage.grund).toBe('Zusatzmodul Reporting-Modul (583,10 €) fehlt im Plan.');
    const neu = postenAngleichen(alt, m, lage.soll, '2026-10-19');
    expect(mandatLiquiLage(m, neu, '2026-10-19', KATALOG).lage).toBe('ok');
    expect(neu.find(p => p.id === hauptPostenId(m))).toEqual(alt.find(p => p.id === hauptPostenId(m)));
  });
});

describe('Mandat ohne Zusatz: bit-gleich wie bisher', () => {
  const m = mandat({ start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true }, leistungId: undefined });
  it('Monatsrechnung = genau die eine Position aus dem Honorar', () => {
    for (const mo of ['2026-10', '2026-11', '2027-04']) {
      const lm = leistungsmonat(m, mo);
      expect(monatsPositionen(m, mo, ctx)).toEqual([positionAusMandat(m, mo, { nettoAusBrutto, anteil: lm })]);
      expect(monatsPositionen({ ...m, zusatz: [] }, mo, ctx)).toEqual(monatsPositionen(m, mo, ctx));
    }
    expect(monatsPositionen({ ...m, honorar: { ...m.honorar, betrag: 0 } }, '2026-11', ctx)).toEqual([]);
  });
  it('Liquidität: dieselben Posten wie bisher (Werte aus der Nachprüfung 18.10.), mit und ohne Katalog', () => {
    const l = mandatPosten(mandat({ start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true }, mindestlaufzeitMonate: 6 }), '2026-10-18', { katalog: KATALOG });
    expect(l.map(p => ({ id: p.id, betrag: p.betrag, rhythmus: p.rhythmus, ab: p.ab, bis: p.bis }))).toEqual([
      { id: 'lp-mandat-m-1~2026-10', betrag: 2257.16, rhythmus: 'einmalig', ab: '2026-11-01', bis: undefined },
      { id: 'lp-mandat-m-1', betrag: 4998, rhythmus: 'monatlich', ab: '2026-11-15', bis: '2027-03-15' },
      { id: 'lp-mandat-m-1~2027-04', betrag: 2832.2, rhythmus: 'einmalig', ab: '2027-04-15', bis: undefined },
    ]);
    expect(mandatPosten(m, '2026-10-18')).toEqual(mandatPosten(m, '2026-10-18', { katalog: KATALOG }));
    expect(zusatzLiquiditaet(m, '2026-10', geplantesEnde(m), ctx)).toEqual([]);
  });
  it('keine Anrechnung ohne Regel am Katalog; keine abgerechneten Positionen', () => {
    expect(anrechnungPositionen(mandat(), monatsPositionen(mandat(), '2026-11', ctx), { katalog: KATALOG.filter(l => l.id !== 'l-ws'), mandate: [], rechnungen: [], nettoAusBrutto })).toEqual([]);
    expect(nurAbgerechnet({ positionen: monatsPositionen(m, '2026-11', ctx) })).toBe(false);
  });
});

describe('Prüfen im Schreibweg (lib/crm/produkt-karte.ts mandatZusatzPruefen)', () => {
  const k = { katalog: KATALOG, hauptId: 'l-haupt' };
  it('Produkt, Rolle, ab/bis, Honorar — 400; zu viele — 413', () => {
    expect(mandatZusatzPruefen([zusatz({ honorar: { betragCent: 1, basis: 'monat' } })], undefined, k)).toEqual([]);
    expect(pruefStatus(mandatZusatzPruefen([zusatz({ leistungId: 'l-gibts-nicht' })], undefined, k))).toBe(400);
    expect(pruefStatus(mandatZusatzPruefen([zusatz({ leistungId: 'l-ws' })], undefined, k))).toBe(400);
    expect(mandatZusatzPruefen([zusatz({ leistungId: 'l-ws', inklusive: true })], undefined, k)).toEqual([]);
    expect(pruefStatus(mandatZusatzPruefen([zusatz({ leistungId: 'l-haupt', inklusive: true })], undefined, k))).toBe(400);
    expect(pruefStatus(mandatZusatzPruefen([zusatz({ ab: '2026-12-01', bis: '2026-11-01' })], undefined, k))).toBe(400);
    expect(pruefStatus(mandatZusatzPruefen([{ id: 'mz-1', leistungId: 'l-mon', honorar: { betragCent: 1, basis: 'woche' } }], undefined, k))).toBe(400);
    expect(pruefStatus(mandatZusatzPruefen([zusatz({ stundenJeMonat: 5, honorar: { betragCent: 1, basis: 'monat' } })], undefined, k))).toBe(400);
    expect(pruefStatus(mandatZusatzPruefen(Array.from({ length: 51 }, (_, i) => zusatz({ id: `mz-${i}` })), undefined, k))).toBe(413);
  });
  it('ein unveränderter Eintrag (Produkt inzwischen gelöscht) sperrt keine andere Änderung', () => {
    const alt = [zusatz({ leistungId: 'l-geloescht', honorar: { betragCent: 1, basis: 'monat' } })];
    expect(mandatZusatzPruefen([...alt, zusatz({ id: 'mz-2', honorar: { betragCent: 2, basis: 'monat' } })], alt, k)).toEqual([]);
  });
});

describe('Deal folgt dem Angebot — das Hauptprodukt', () => {
  const pos = (leistungId: string, basis: 'monat' | 'einmalig') => ({ id: `p-${leistungId}`, leistungId, titel: 'x', text: '', menge: 1, einheit: 'x', einzelpreisCent: 1, ustSatz: 19, basis });
  it('laufend vor einmalig; ohne Katalog wie bisher; ein reines Zusatzmodul zählt nicht', () => {
    expect(angebotHauptprodukt({ positionen: [pos('l-ws', 'einmalig'), pos('l-haupt', 'monat')] })).toBe('l-haupt');
    expect(angebotHauptprodukt({ positionen: [pos('l-ws', 'einmalig')] })).toBe('l-ws');
    expect(angebotHauptprodukt({ positionen: [pos('l-mon', 'monat'), pos('l-ws', 'einmalig')] })).toBe('l-mon');
    expect(angebotHauptprodukt({ positionen: [pos('l-mon', 'monat'), pos('l-ws', 'einmalig')] }, KATALOG)).toBe('l-ws');
    expect(angebotHauptprodukt({ positionen: [pos('l-mon', 'monat')] }, KATALOG)).toBe('l-mon');
    expect(angebotHauptprodukt({ positionen: [] })).toBeUndefined();
  });
});

describe('Anrechnung in der Liquidität — dieselbe Regel wie die Monatsrechnung (P3b)', () => {
  const ws: Rechnung = { id: 'r-ws', firmaId: 'ug', kunde: 'Beispielwerk GmbH', titel: 'Workshop', betrag: 5712, status: 'bezahlt', kundeFirmaId: 'f-beispiel', positionen: [{ id: 'p1', leistungId: 'l-ws', titel: 'Workshop', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 480_000, ustSatz: 19 }] };
  const halb = KATALOG.map(l => (l.id === 'l-ws' ? { ...l, regeln: { anrechnung: { auf: ['l-haupt'], anteilProzent: 50 } } } : l));
  /** Die Monatsrechnungen nacheinander, wie der Server sie anlegt (jede sieht die vorigen Entwürfe — die Anrechnung kommt einmal). Summe brutto in Cent. */
  const rechnungenMit = (m: Mandat, rechnungen: Rechnung[], katalog = KATALOG) => {
    const ende = geplantesEnde(m)!;
    const mit = { ...m, ende };
    const liste = [...rechnungen];
    let summe = 0;
    for (const mo of monateVon(m.start!.slice(0, 7), ende.slice(0, 7))) {
      const pos = monatsPositionen(mit, mo, { ...ctx, katalog });
      const alle = [...pos, ...anrechnungPositionen(m, pos, { katalog, mandate: [m], rechnungen: liste, nettoAusBrutto })];
      summe += rechnungSummen(alle).brutto;
      liste.push({ id: `r-${mo}`, firmaId: 'ug', mandatId: m.id, kunde: 'x', titel: mo, betrag: 0, status: 'geplant', leistungVon: leistungsmonat(mit, mo)!.von, positionen: alle });
    }
    return summe;
  };
  const plan = (m: Mandat, heute: string, rechnungen: Rechnung[], katalog = KATALOG) => mandatPosten(m, heute, { katalog, anrechnung: { mandate: [m], rechnungen } });
  const faelle: { name: string; m: Partial<Mandat>; katalog?: Leistung[]; anrechnung: number }[] = [
    { name: 'Teilmonat-Start: Anrechnung größer als der erste Monat — gedeckelt, der Rest verfällt', m: { start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true } }, anrechnung: -2257.16 },
    { name: 'voller erster Monat, Anrechnung größer als der Monat', m: {}, anrechnung: -2975 },
    { name: 'Anrechnung kleiner als der erste Monat (50 %) — voll angerechnet', m: {}, katalog: halb, anrechnung: -2856 },
    // Oktober 18.–31.: 999,99 € × 14/31 = 451,61 € + Modul 777,77 € × 14/31 = 351,25 € → 802,86 € netto: die Grenze ist die ganze Rechnung (955,40 € brutto).
    { name: 'Teilmonat-Start mit Zusatzmodul im ersten Monat (die Grenze ist die ganze Rechnung)', m: { start: '2026-10-18', honorar: { betrag: 999.99, basis: 'monat', netto: true }, zusatz: [zusatz({ honorar: { betragCent: 77_777, basis: 'monat' } })] }, katalog: halb, anrechnung: -955.4 },
  ];
  for (const f of faelle) {
    it(f.name, () => {
      const m = mandat(f.m);
      const posten = plan(m, m.start!, [ws], f.katalog);
      expect(posten.find(p => p.id === anrechnungPostenId(m))?.betrag).toBe(f.anrechnung);
      expect(liqSumme(posten)).toBe(rechnungenMit(m, [ws], f.katalog));
      // Ohne Anrechnung wäre der Plan genau um sie zu hoch.
      expect(liqSumme(mandatPosten(m, m.start!, { katalog: f.katalog ?? KATALOG })) + Math.round(f.anrechnung * 100)).toBe(rechnungenMit(m, [ws], f.katalog));
    });
  }
  it('der Posten: einmalig, am Zahltag des ersten Monats, mit Namen', () => {
    const m = mandat({ start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true } });
    expect(plan(m, '2026-10-18', [ws]).find(p => p.id === anrechnungPostenId(m))).toMatchObject({ rhythmus: 'einmalig', ab: '2026-11-01', titel: 'Beispielwerk GmbH · Begleitung — Anrechnung Klarheitstag', kategorie: 'mandat' });
  });
  it('steht sie schon auf einer Rechnung dieses Mandats: deren Wirkung in deren Monat; vergangen bzw. an einem anderen Mandat: keine', () => {
    const m = mandat();
    const pos = monatsPositionen(m, '2026-12', ctx);
    const anr = anrechnungPositionen(m, pos, { katalog: KATALOG, mandate: [m], rechnungen: [ws], nettoAusBrutto });
    const dez: Rechnung = { id: 'r-dez', firmaId: 'ug', mandatId: 'm-1', kunde: 'x', titel: 'Dez', betrag: 0, status: 'geplant', leistungVon: '2026-12-01', positionen: [...pos, ...anr] };
    const ak = (rechnungen: Rechnung[]) => ({ katalog: KATALOG, mandate: [m], rechnungen, nettoAusBrutto });
    expect(anrechnungLiquiditaet(m, '2026-11', geplantesEnde(m), ak([ws, dez]))).toEqual([{ monat: '2026-12', cent: -297_500, titel: 'Anrechnung Klarheitstag' }]);
    expect(anrechnungLiquiditaet(m, '2027-01', geplantesEnde(m), ak([ws, dez]))).toEqual([]);
    expect(anrechnungLiquiditaet(m, '2026-11', geplantesEnde(m), ak([ws, { ...dez, mandatId: 'm-anders' }]))).toEqual([]);
    expect(anrechnungLiquiditaet(m, '2026-11', geplantesEnde(m), ak([ws, { ...dez, status: 'storniert' }]))).toEqual([{ monat: '2026-11', cent: -297_500, titel: 'Anrechnung Klarheitstag' }]);
  });
  it('„Plan angleichen“ kennt sie: fehlt sie im Plan, „Liquiplan weicht ab — Anrechnung fehlt“; angeglichen ok', () => {
    const m = mandat({ start: '2026-10-18', honorar: { betrag: 4200, basis: 'monat', netto: true } });
    const anrechnung = { mandate: [m], rechnungen: [ws] };
    const alt = mandatPosten(m, '2026-10-18');
    const lage = mandatLiquiLage(m, alt, '2026-10-18', KATALOG, anrechnung);
    expect(lage.lage).toBe('abweichend');
    expect(lage.grund).toBe(`${ANRECHNUNG_FEHLT} — Anrechnung Klarheitstag (-2.257,16 €) steht nicht im Plan, der Monat ist sonst zu hoch.`);
    const neu = postenAngleichen(alt, m, lage.soll, '2026-10-18');
    expect(mandatLiquiLage(m, neu, '2026-10-18', KATALOG, anrechnung).lage).toBe('ok');
    expect(neu.filter(p => !alt.some(a => a.id === p.id)).map(p => p.id)).toEqual([anrechnungPostenId(m)]);
  });
  it('ohne Bestand der Rechnungen bzw. ohne Regel: kein Posten (bit-gleich)', () => {
    const m = mandat();
    expect(mandatPosten(m, '2026-11-01', { katalog: KATALOG })).toEqual(mandatPosten(m, '2026-11-01'));
    expect(plan(m, '2026-11-01', [ws], KATALOG.filter(l => l.id !== 'l-ws'))).toEqual(mandatPosten(m, '2026-11-01'));
    expect(plan(m, '2026-11-01', [])).toEqual(mandatPosten(m, '2026-11-01'));
  });
});
