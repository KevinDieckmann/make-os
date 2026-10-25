// ─── Preis-Kette Produkt → Angebot → Deal → Mandat → Rechnung → Liquidität (24.10., Bau-Test; Branch `kern-preise`) ──────────────────────────────
// Kevin 24.10.: „Das wird das Modul sein, worüber wir jetzt bald am meisten arbeiten werden.“ Geprüft wird die Kette mit GENAU dem Produkt des Bau-Tests
// (erfundene Namen und Firmen): 1.500 € fest (Zahlplan 50/50) · 900 €/Monat · optional Tagessatz 1.200 € mit 2 Tagen/Monat geplant, Mindestlaufzeit 6.
//   · Angebot: jeder Preis-Teil eine Position mit eigenem Betrag/Basis, der Deal-Wert ersetzt nie einen Teil; Tagessatz „je Tag“, laufend, Summen getrennt
//   · Deal-Wert: laufend und einmalig getrennt (`einmalBetrag`) — nie ein verteilter Monatswert
//   · Mandat: Honorar = laufender Hauptpreis, Festpreis 50/50 und Tagessatz als Zusatzmodule (`preisTeilId`), Start wählbar
//   · erste Rechnung: Handprobe auf den Cent (Start 15.11.: 480,00 + 750,00 + 1 Tag 1.200,00 = 2.430,00 netto, 461,70 USt, 2.891,70 brutto)
//   · Fälligkeit = Zahltag im Liquiplan (eine Regel), Liquidität mit allen Teilen, keine Doppelzählung, Summe Posten = Summe Rechnungen
//   · Preisänderung am Produkt ändert das Mandat nicht (Hinweis statt stiller Zeile), Reihenfolge der Teile ändert den Hauptpreis nicht,
//     ein Produkt mit einem Preis bleibt bit-gleich
import { describe, it, expect } from 'vitest';
import {
  hauptpreis, hauptpreisAus, teileHauptZuerst, angebotPositionenAusProdukt, mandatVorlageAusProdukt, mandatZusatzPruefen, mandatZusatzSaeubern,
  eigeneTeileOffen, zusatzAusTeil, dealWertAusProdukt, produktSpiegeln, type PreisTeil,
} from '@/lib/crm/produkt-karte';
import { hauptpreisId } from '@/lib/crm/produkt-katalog';
import {
  angebotSummen, dealWertAusAngebot, dealWertUebernehmen, mandatVorbelegung, positionenAusDeal, positionenErgaenzen, angebotEinmalRest, angebotAufteilung,
  positionSaeubern, aufwandLabel, positionAusProdukt,
} from '@/lib/crm/angebote';
import { gesamtwert, dealWertText } from '@/lib/crm/pipeline';
import { mandatAusDeal, startVorschlag, startAus } from '@/lib/crm/mandat-aus-deal';
import { monatsPositionen, abrechnenPositionen, zusatzName, zusatzOptionen, vertragsHinweise, honorarText } from '@/lib/crm/mandat-zusatz';
import { mandatPosten } from '@/lib/crm/kunden';
import { faelligAm, neuerEntwurf, rechnungSummen } from '@/lib/finanzen/rechnung/regeln';
import { rechnungDeckung, ersetztText, vorschau, zahltage, type Planposten } from '@/lib/make-one/liquiditaet';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import type { Angebot, Chance, Leistung } from '@/lib/crm/typen';

const J = '2026-10-24T08:00:00.000Z';
const HEUTE = '2026-10-24';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-x', name: 'Produkt', typ: 'sprint', stufe: 'kern', preis: { betrag: 0, einheit: '' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);

// Das Produkt des Bau-Tests — der Festpreis steht auf der Karte VOR dem Monatspreis (genau das zerfiel am 24.10.).
const TEILE = [
  teil({ id: 'pt-1', art: 'fest', betragCent: 150_000, zahlplan: { anzahlungProzent: 50 } }),
  teil({ id: 'pt-2', art: 'monatlich', betragCent: 90_000 }),
  teil({ id: 'pt-3', art: 'tagessatz', betragCent: 120_000, rolle: 'option', mengeJeMonat: 2 }),
];
const SPRINT = leistung({
  id: 'l-sprint', name: 'Vertriebssprint', angebot: { leistungstext: 'Sechs Monate Vertriebssprint mit wöchentlicher Steuerung.' }, lieferumfang: ['Pipeline-Aufbau', 'Wochensteuerung'],
  preise: TEILE, vertrag: { mindestlaufzeitMonate: 6, zahlungszielTage: 14 },
});
const KATALOG = [SPRINT];
const ctx = { katalog: KATALOG, nettoAusBrutto };

const angebot = (positionen: Angebot['positionen'], x: Partial<Angebot> = {}): Angebot => ({
  id: 'ang-1', nummer: 'BSP-A-2026-0001', gesellschaft: 'ug', kontaktId: 'c-beispiel', firmaId: 'f-hafen', dealId: 'ch-1', titel: 'Hafenbeispiel GmbH · Vertriebssprint', positionen,
  einleitung: '', schluss: '', gueltigBis: '2026-11-23', zahlungszielTage: 14, status: 'angenommen', version: 1, angenommenAm: HEUTE, angelegt: J, geaendert: J, ...x,
} as Angebot);
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Vertriebssprint Hafenbeispiel', kontaktIds: ['c-beispiel'], firmaId: 'f-hafen', firma: 'Hafenbeispiel GmbH', art: 'retainer', leistungId: 'l-sprint',
  wert: { betrag: 900, basis: 'monat', laufzeitMonate: 6 }, stufe: 'gewonnen', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'unklar' },
  gesellschaft: 'ug', besitzer: 'kevin', angelegt: J, geaendert: J, ...x,
} as Chance);

// Angebot aus dem Deal (Deal-Wert 900 €/Monat × 6) — danach die Option „Tagessatz“ dazu.
const ohneOption = positionenAusDeal(SPRINT, deal().wert);
const option = angebotPositionenAusProdukt(SPRINT, ['pt-3']);
const mitOption = [...ohneOption, ...positionenErgaenzen(ohneOption, option).neu];

describe('Hauptpreis: der laufende Teil — die Reihenfolge auf der Karte entscheidet nichts', () => {
  it('Festpreis vor dem Monatspreis: Hauptpreis ist der Monatspreis; umgedreht ebenso', () => {
    expect(hauptpreis(SPRINT)?.id).toBe('pt-2');
    expect(hauptpreis({ ...SPRINT, preise: [...TEILE].reverse() })?.id).toBe('pt-2');
    expect(hauptpreisId([TEILE[2], TEILE[0], TEILE[1]])).toBe('pt-2');
    expect(teileHauptZuerst(TEILE).map(t => t.id)).toEqual(['pt-2', 'pt-1', 'pt-3']);
    // Optionen zählen nur, wenn kein Teil immer gilt; gleiche Form: der höhere Betrag.
    expect(hauptpreisAus([teil({ id: 'pt-a', art: 'monatlich', betragCent: 100 }), teil({ id: 'pt-b', art: 'monatlich', betragCent: 900 })])?.id).toBe('pt-b');
    // Das gespiegelte alte Preisfeld folgt dem Hauptpreis (alte Leser, der alte Stand).
    expect(produktSpiegeln(SPRINT).preis).toEqual({ betrag: 900, einheit: 'Monat netto', basis: 'monat' });
  });
});

describe('Angebot aus dem Deal: jeder Preis-Teil eine Position, der Deal-Wert ersetzt keinen', () => {
  it('Grund-Teile mit eigenem Betrag und eigener Basis; der Hauptpreis vorne mit dem Produkttext', () => {
    expect(ohneOption.map(p => [p.preisTeilId, p.basis, p.menge, p.einzelpreisCent, p.laufzeitMonate ?? null])).toEqual([['pt-2', 'monat', 1, 90_000, 6], ['pt-1', 'einmalig', 1, 150_000, null]]);
    expect(ohneOption[0].titel).toBe('Vertriebssprint');
    expect(ohneOption[1].titel).toBe('Vertriebssprint · Festpreis');
    expect(ohneOption[0].text).toContain('• Pipeline-Aufbau');
    expect(ohneOption[0].text).not.toContain('Zahlung 50 %');
    expect(ohneOption[1].text).toContain('Zahlung 50 % bei Auftrag, 50 % bei Abschluss.');
    const s = angebotSummen({ positionen: ohneOption });
    expect([s.einmalig.netto, s.monat.netto, s.aufwand.netto, s.gesamt.netto]).toEqual([150_000, 90_000, 0, 690_000]);
  });
  it('die Option „Tagessatz“: nur sie kommt dazu — je Tag, geplante Menge je Monat, laufend (nie „einmalig“)', () => {
    expect(positionenErgaenzen(ohneOption, option).schonDa.map(p => p.preisTeilId)).toEqual(['pt-2', 'pt-1']);
    const t = mitOption[2];
    expect(t).toMatchObject({ preisTeilId: 'pt-3', titel: 'Vertriebssprint · Tagessatz', menge: 2, einheit: 'Tag', einzelpreisCent: 120_000, basis: 'monat', satz: 'tag', laufzeitMonate: 6 });
    const s = angebotSummen({ positionen: mitOption });
    expect([s.einmalig.netto, s.monat.netto, s.aufwand.netto, s.gesamt.netto]).toEqual([150_000, 90_000, 240_000, 150_000 + 330_000 * 6]);
    expect(aufwandLabel(mitOption)).toBe('Tagessätze je Monat (geplant)');
    // Der Säuberer hält das Feld (nur mit Basis „monat“).
    expect(positionSaeubern(t as unknown as Record<string, unknown>, 0)?.satz).toBe('tag');
    expect(positionSaeubern({ ...t, basis: 'einmalig' } as unknown as Record<string, unknown>, 0)?.satz).toBeUndefined();
  });
});

describe('Deal-Wert aus dem Angebot: laufend und einmalig getrennt', () => {
  it('ohne Option: 900 €/Monat · 6 + 1.500 € einmalig = 6.900 € (nie „1.350 €/Monat“)', () => {
    const w = dealWertAusAngebot({ positionen: ohneOption });
    expect(w).toEqual({ betrag: 900, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 });
    expect(gesamtwert({ wert: w })).toBe(6900);
    expect(dealWertText({ wert: w })).toBe('900 € je Monat · 6 Monate + 1.500 € einmalig');
    expect(dealWertText({ wert: w }, { kurz: true })).toBe('900 €/M + 1.500 €');
  });
  it('mit Option: der geplante Tagessatz zählt laufend — Gesamtwert = Gesamtwert des Angebots', () => {
    const w = dealWertAusAngebot({ positionen: mitOption });
    expect(w).toEqual({ betrag: 3300, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 });
    expect(gesamtwert({ wert: w }) * 100).toBe(angebotSummen({ positionen: mitOption }).gesamt.netto);
  });
  it('rein laufend bzw. rein einmalig: wie bisher (kein einmalBetrag)', () => {
    expect(dealWertAusAngebot({ positionen: [ohneOption[0]] })).toEqual({ betrag: 900, basis: 'monat', laufzeitMonate: 6 });
    expect(dealWertAusAngebot({ positionen: [ohneOption[1]] })).toEqual({ betrag: 1500, basis: 'einmalig' });
  });
  it('Vorgabe des Deal-Formulars aus dem Produkt: dieselbe Trennung', () => {
    expect(dealWertAusProdukt(SPRINT)).toEqual({ betrag: 900, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 });
  });
});

const ANGENOMMEN = angebot(mitOption);
const START = '2026-11-15';
const AUS_ANGEBOT = mandatAusDeal(deal(), { leistungen: KATALOG, angebote: [ANGENOMMEN], firmen: [{ id: 'f-hafen', name: 'Hafenbeispiel GmbH' }], id: 'm-sprint', jetzt: J, heute: HEUTE, person: 'kevin', start: START });
const M = AUS_ANGEBOT.mandat;

describe('Mandat aus dem angenommenen Angebot: Hauptpreis + Zusatzmodule, Start wählbar', () => {
  it('Honorar 900 €/Monat, Festpreis 50/50 und Tagessatz (2 Tage/Monat) als Zusatzmodule mit Preis-Teil', () => {
    expect(AUS_ANGEBOT.quelle).toBe('angebot');
    expect(M).toMatchObject({ start: START, leistungId: 'l-sprint', honorar: { betrag: 900, basis: 'monat', netto: true }, mindestlaufzeitMonate: 6, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ustSatz: 19, vertragUnterschrieben: true });
    expect(M.zusatz).toEqual([
      { id: 'mz-e-1', leistungId: 'l-sprint', preisTeilId: 'pt-1', honorar: { betragCent: 150_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } },
      { id: 'mz-e-3', leistungId: 'l-sprint', preisTeilId: 'pt-3', honorar: { betragCent: 120_000, basis: 'tag' }, tageJeMonat: 2 },
    ]);
    expect(M.zusatz!.map(z => zusatzName(z, KATALOG))).toEqual(['Vertriebssprint · Festpreis', 'Vertriebssprint · Tagessatz']);
    // Leistungen = Leistungstext + Lieferumfang (nicht mehr die Namen der Teile).
    expect(M.leistungen).toEqual(['Sechs Monate Vertriebssprint mit wöchentlicher Steuerung.', 'Pipeline-Aufbau', 'Wochensteuerung']);
    expect(honorarText(M)).toBe('900 € netto je Monat');
    // Der Einmalbetrag steht am Mandat — keine eigene Einmal-Rechnung daneben (nie doppelt).
    expect(angebotEinmalRest(ANGENOMMEN, KATALOG)).toEqual([]);
  });
  it('Start: Vorgabe erster Tag des Folgemonats; Unsinn wird abgelehnt', () => {
    expect(startVorschlag('2026-10-24')).toBe('2026-11-01');
    expect(startVorschlag('2026-12-05')).toBe('2027-01-01');
    expect(startAus('2026-11-15', HEUTE)).toBe('2026-11-15');
    expect(startAus('2026-02-30', HEUTE)).toBeNull();
    expect(startAus('2030-01-01', HEUTE)).toBeNull();
    expect(startAus(42, HEUTE)).toBeNull();
  });
  it('ohne Angebot aus dem Produkt: Deal-Wert als Honorar, die übrigen Grund-Teile als Zusatzmodule (Optionen nur gewählt)', () => {
    const r = mandatAusDeal(deal({ wert: { betrag: 900, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 } }), { leistungen: KATALOG, angebote: [], firmen: [], id: 'm-2', jetzt: J, heute: HEUTE, person: 'kevin' });
    expect(r.quelle).toBe('produkt');
    expect(r.mandat).toMatchObject({ start: HEUTE, honorar: { betrag: 900, basis: 'monat' } });
    expect(r.mandat.zusatz).toEqual([{ id: 'mz-e-1', leistungId: 'l-sprint', preisTeilId: 'pt-1', honorar: { betragCent: 150_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } }]);
    // Nur der Festpreis als Wert (falsche Basis): Honorar ist trotzdem der Hauptpreis — der Festpreis stünde sonst zweimal im Mandat.
    const f = mandatAusDeal(deal({ wert: { betrag: 1500, basis: 'einmalig' } }), { leistungen: KATALOG, angebote: [], firmen: [], id: 'm-3', jetzt: J, heute: HEUTE, person: 'kevin' });
    expect(f.mandat.honorar).toEqual({ betrag: 900, basis: 'monat', netto: true });
  });
  it('„+ Zusatzmodul“ bietet die noch nicht übernommenen eigenen Teile an; eigene Teile bringen keine Optionen mit', () => {
    expect(eigeneTeileOffen(SPRINT, []).map(t => t.id)).toEqual(['pt-1', 'pt-3']);
    expect(eigeneTeileOffen(SPRINT, M.zusatz!.map(z => z.preisTeilId))).toEqual([]);
    expect(zusatzOptionen(M.zusatz![0], KATALOG)).toEqual([]);
    expect(mandatVorlageAusProdukt(SPRINT, [], { optionen: ['pt-3'] }).zusatz?.map(z => z.preisTeilId)).toEqual(['pt-1', 'pt-3']);
  });
  it('Schreibweg: eigener Teil erlaubt, der Hauptpreis-Teil nie, unbekannte und doppelte Teile 400; der Säuberer hält preisTeilId', () => {
    const k = { katalog: KATALOG, hauptId: 'l-sprint' };
    expect(mandatZusatzPruefen(M.zusatz, undefined, k)).toEqual([]);
    expect(mandatZusatzPruefen([zusatzAusTeil(SPRINT, TEILE[1])], undefined, k)[0].text).toMatch(/schon das Honorar/);
    expect(mandatZusatzPruefen([{ ...M.zusatz![0], preisTeilId: 'pt-9' }], undefined, k)[0].text).toMatch(/Preis-Teil gibt es am Produkt nicht/);
    expect(mandatZusatzPruefen([M.zusatz![0], { ...M.zusatz![0], id: 'mz-e-zwei' }], undefined, k).some(f => /nur einmal/.test(f.text))).toBe(true);
    // ohne preisTeilId bleibt die alte Regel: das Hauptprodukt ist kein Zusatzmodul
    expect(mandatZusatzPruefen([{ id: 'mz-x', leistungId: 'l-sprint', honorar: { betragCent: 1, basis: 'monat' } }], undefined, k)[0].text).toMatch(/schon das Hauptprodukt/);
    expect(mandatZusatzSaeubern(M.zusatz)).toEqual(M.zusatz);
    expect(mandatZusatzSaeubern([{ ...M.zusatz![0], preisTeilId: 'kaputt' }])?.[0].preisTeilId).toBeUndefined();
  });
});

describe('Erste Rechnung: Handprobe auf den Cent', () => {
  const nov = monatsPositionen(M, '2026-11', ctx);
  const tag = abrechnenPositionen(M, '2026-11', [{ zusatzId: 'mz-e-3', menge: 1 }], ctx);
  it('Teilmonat Monatshonorar 480,00 + Anzahlung 750,00 automatisch, der Tagessatz nur über „abrechnen“', () => {
    expect(nov.map(p => p.einzelpreisCent)).toEqual([48_000, 75_000]);
    expect(nov[1].titel).toBe('Vertriebssprint · Festpreis — Anzahlung 50 %');
    expect(tag.ok && tag.positionen.map(p => [p.menge, p.einheit, p.einzelpreisCent])).toEqual([[1, 'Tag', 120_000]]);
    const s = rechnungSummen([...nov, ...(tag.ok ? tag.positionen : [])]);
    expect([s.netto, s.ust, s.brutto]).toEqual([243_000, 46_170, 289_170]);
  });
  it('Rest 750,00 bei Abschluss: im Monat des Mandatsendes (Ende der Mindestlaufzeit 14.05.2027), dazwischen nur das Monatshonorar (25.10.)', () => {
    expect(monatsPositionen(M, '2026-12', ctx).map(p => p.einzelpreisCent)).toEqual([90_000]);
    expect(monatsPositionen(M, '2027-01', ctx).map(p => p.einzelpreisCent)).toEqual([90_000]);
    expect(monatsPositionen(M, '2027-05', ctx).map(p => p.einzelpreisCent)).toEqual([90_000, 75_000]);
  });
  it('Fälligkeit = Zahltag im Liquiplan: im Voraus gestellt frühestens Leistungsbeginn + Ziel', () => {
    expect(faelligAm('2026-10-24', 14, '2026-11-15')).toBe('2026-11-29');
    expect(faelligAm('2026-11-20', 14, '2026-11-15')).toBe('2026-12-04');
    expect(faelligAm('2026-10-24', 14)).toBe('2026-11-07');
    expect(neuerEntwurf({ id: 'r-1', firmaId: 'ug', kunde: 'Hafenbeispiel GmbH', heute: HEUTE, zahlungszielTage: 14, leistungVon: START }).faellig).toBe('2026-11-29');
    const posten = mandatPosten(M, HEUTE, { katalog: KATALOG });
    const novPosten = posten.filter(p => p.leistungsmonat === '2026-11');
    expect(novPosten.length).toBeGreaterThan(0);
    expect(new Set(novPosten.map(p => p.ab))).toEqual(new Set(['2026-11-29']));
  });
});

describe('Liquidität: alle Teile, keine Doppelzählung, Summe Posten = Summe Rechnungen', () => {
  const posten = mandatPosten(M, HEUTE, { katalog: KATALOG });
  const zahlungen = (p: Planposten) => zahltage(p, '2026-01-01', '2028-12-31');
  it('Anzahlung und Rest je 892,50 € brutto, Tagessatz 2 × 1.200 × 1,19 je vollem Monat', () => {
    const fest = posten.filter(p => p.id.includes('~z-mz-e-1'));
    expect(fest.map(p => [p.betrag, p.ab])).toEqual([[892.5, '2026-11-29'], [892.5, '2027-05-15']]);
    const tagessatz = posten.filter(p => p.id.includes('~z-mz-e-3'));
    expect(tagessatz.find(p => p.rhythmus === 'monatlich')?.betrag).toBe(2856);
    expect(tagessatz.find(p => p.leistungsmonat === '2026-11')?.betrag).toBe(1523.2);
    expect(posten.every(p => p.kategorie === 'mandat' && p.mandatId === 'm-sprint')).toBe(true);
  });
  it('Summe der Posten = Summe der Monatsrechnungen (ohne den nach Menge abgerechneten Tagessatz), auf den Cent', () => {
    const plan = posten.filter(p => !p.id.includes('~z-mz-e-3')).reduce((a, p) => a + Math.round(p.betrag * 100) * zahlungen(p).length, 0);
    const monate = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'];
    const rechnungen = monate.reduce((a, mo) => a + rechnungSummen(monatsPositionen(M, mo, ctx, '2027-05-14')).brutto, 0);
    expect(plan).toBe(rechnungen);
  });
  it('die gestellte Novemberrechnung ersetzt die Novemberzahlungen (gekennzeichnet), zählt unter „Mandate & Honorare“ — nichts doppelt', () => {
    const r = { id: 'r-nov', kunde: 'Hafenbeispiel GmbH', titel: 'Vertriebssprint — November 2026', betrag: 2891.7, status: 'gestellt', faellig: '2026-11-29', mandatId: 'm-sprint', leistungVon: START, zahlungszielTage: 14, positionen: [{ id: 'p1' }] };
    const deckung = rechnungDeckung([r]);
    const novPosten = posten.filter(p => p.leistungsmonat === '2026-11');
    expect(novPosten.every(p => deckung(p, p.ab))).toBe(true);
    expect(novPosten.map(p => ersetztText(p, HEUTE, deckung))).toEqual(novPosten.map(() => 'durch Rechnung ersetzt'));
    const dez = posten.find(p => p.id.includes('~z-mz-e-1') && p.leistungsmonat === '2027-05')!;
    expect(deckung(dez, dez.ab)).toBe(false);
    expect(ersetztText(dez, HEUTE, deckung)).toBeNull();
    const v = vorschau([{ id: 'ug', name: 'Beispiel', kontostand: 0, stand: HEUTE }], [r], [], [], HEUTE, 8, false, posten);
    const ein = v.wochen.flatMap(w => w.bewegungen).filter(b => b.betrag > 0 && b.datum === '2026-11-29');
    expect(ein.map(b => [b.quelle?.art, b.kategorie, b.betrag])).toEqual([['rechnung', 'mandat', 2891.7]]);
  });
});

describe('Preisänderung am Produkt ändert das Mandat nicht', () => {
  const teurer = { ...SPRINT, preise: TEILE.map(t => (t.id === 'pt-2' ? { ...t, betragCent: 95_000 } : t.id === 'pt-1' ? { ...t, betragCent: 160_000 } : t)) };
  it('Rechnung bleibt bei 900 bzw. 1.500, der Hinweis sagt es', () => {
    expect(monatsPositionen(M, '2026-11', { katalog: [teurer], nettoAusBrutto }).map(p => p.einzelpreisCent)).toEqual([48_000, 75_000]);
    expect(vertragsHinweise(M, teurer)).toEqual([
      'Produkt kostet inzwischen 950 € netto/Monat — dieses Mandat bleibt bei 900 € (Vertrag).',
      'Vertriebssprint · Festpreis: Produkt kostet inzwischen 1.600 € — dieses Mandat bleibt bei 1.500 € (Vertrag).',
    ]);
    expect(vertragsHinweise(M, SPRINT)).toEqual([]);
  });
});

describe('Reihenfolge der Teile auf der Karte ändert nichts an der Kette', () => {
  const UMGEDREHT = { ...SPRINT, preise: [TEILE[2], TEILE[1], TEILE[0]] };
  it('Angebot, Deal-Wert und Mandat wie mit der Original-Reihenfolge', () => {
    const pos = positionenAusDeal(UMGEDREHT, deal().wert);
    expect(pos.map(p => p.preisTeilId)).toEqual(['pt-2', 'pt-1']);
    expect(dealWertAusAngebot({ positionen: pos })).toEqual(dealWertAusAngebot({ positionen: ohneOption }));
    const v = mandatVorbelegung(angebot([...pos, ...positionenErgaenzen(pos, angebotPositionenAusProdukt(UMGEDREHT, ['pt-3'])).neu]), [UMGEDREHT]);
    expect(v.honorar).toEqual(M.honorar);
    expect(v.zusatz?.map(z => z.preisTeilId).sort()).toEqual(['pt-1', 'pt-3']);
  });
});

describe('Ein Produkt mit einem Preis bleibt bit-gleich', () => {
  const EINS = leistung({ id: 'l-eins', name: 'Begleitung', angebot: { leistungstext: 'Monatliche Begleitung.' }, preise: [teil({ id: 'pt-m', art: 'monatlich', betragCent: 250_000 })], vertrag: { mindestlaufzeitMonate: 6 } });
  const TAG = leistung({ id: 'l-tag', name: 'Beratungstag', preise: [teil({ id: 'pt-t', art: 'tagessatz', betragCent: 140_000, mengeJeMonat: 2 })] });
  it('Angebot aus dem Deal: der Deal-Wert gilt wie bisher; Tagessatz allein „1 Tag einmalig“', () => {
    const w = { betrag: 2200, basis: 'monat' as const, laufzeitMonate: 9 };
    expect(positionenAusDeal(EINS, w)).toEqual([dealWertUebernehmen(positionAusProdukt(EINS, 'p-1'), w)]);
    expect(angebotPositionenAusProdukt(TAG)).toEqual([expect.objectContaining({ menge: 1, einheit: 'Tag', basis: 'einmalig', einzelpreisCent: 140_000 })]);
    expect(angebotPositionenAusProdukt(TAG)[0]).not.toHaveProperty('satz');
  });
  it('Mandat: keine eigenen Zusatzmodule, die alte Vorbelegung (Honorar = laufende Summe)', () => {
    expect(mandatVorlageAusProdukt(EINS).zusatz).toBeUndefined();
    const a = angebot([dealWertUebernehmen(positionAusProdukt(EINS, 'p-1'), { betrag: 2200, basis: 'monat', laufzeitMonate: 9 })]);
    expect(angebotAufteilung(a, [EINS])).toBeNull();
    expect(mandatVorbelegung(a, [EINS])).toMatchObject({ honorar: { betrag: 2200, basis: 'monat', netto: true }, mindestlaufzeitMonate: 9, leistungId: 'l-eins', leistungen: ['Begleitung'] });
    expect(mandatVorbelegung(a, [EINS]).zusatz).toBeUndefined();
  });
});
