// ─── Kern-Bau-Test 2 — Befunde (25.10., Branch `kern-runde4`) ──────────────────────────────────────────────────────────────────────────────
// Geprüft mit GENAU dem Fall des Bau-Tests (erfundene Namen und Beträge): Produkt fest 2.000 € (Zahlplan 50/50) · 1.100 €/Monat · optional Tagessatz
// 1.000 € mit 3 Tagen/Monat geplant, Mindestlaufzeit 4; Mandat ab 15.11.2026 → Ende der Mindestlaufzeit 14.03.2027.
import { describe, it, expect } from 'vitest';
import type { Leistung, Mandat, MandatZusatz } from '@/lib/crm/typen';
import type { PreisTeil } from '@/lib/crm/produkt-karte';
import { monatsPositionen, restMonat, zahlplanMonate } from '@/lib/crm/mandat-zusatz';
import { mandatPosten } from '@/lib/crm/kunden';
import { rechnungSummen } from '@/lib/finanzen/rechnung/regeln';
import { zahltage, type Planposten } from '@/lib/make-one/liquiditaet';
import { nettoAusBrutto } from '@/lib/finanzen/ust';

const J = '2026-10-25T08:00:00.000Z';
const HEUTE = '2026-10-25';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const PAKET: Leistung = {
  id: 'l-paket', name: 'Wachstumspaket', typ: 'sprint', stufe: 'kern', preis: { betrag: 1100, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Workshop'], gesellschaft: 'ug', status: 'aktiv', geaendert: J,
  preise: [
    teil({ id: 'pt-1', art: 'fest', betragCent: 200_000, zahlplan: { anzahlungProzent: 50 } }),
    teil({ id: 'pt-2', art: 'monatlich', betragCent: 110_000 }),
    teil({ id: 'pt-3', art: 'tagessatz', betragCent: 100_000, rolle: 'option', mengeJeMonat: 3 }),
  ],
  vertrag: { mindestlaufzeitMonate: 4, zahlungszielTage: 14 },
} as Leistung;
const KATALOG = [PAKET];
const ctx = { katalog: KATALOG, nettoAusBrutto };
const FEST: MandatZusatz = { id: 'mz-e-1', leistungId: 'l-paket', preisTeilId: 'pt-1', honorar: { betragCent: 200_000, basis: 'einmalig' }, zahlplan: { anzahlungProzent: 50 } };
const TAG: MandatZusatz = { id: 'mz-e-3', leistungId: 'l-paket', preisTeilId: 'pt-3', honorar: { betragCent: 100_000, basis: 'tag' }, tageJeMonat: 3 };
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-paket', kunde: 'Beispiel Logistik AG', firmaId: 'f-beispiel', kontaktIds: [], titel: 'Wachstumspaket', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-11-15', verlaengerung: 'offen', mindestlaufzeitMonate: 4, honorar: { betrag: 1100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  leistungId: 'l-paket', zusatz: [FEST, TAG], ...x,
} as Mandat);

describe('1 · Restzahlung bei Abschluss: im Monat des Mandatsendes — Rechnung und Liquidität', () => {
  const M = mandat();
  const zahlungen = (p: Planposten) => zahltage(p, '2026-01-01', '2028-12-31');
  it('Rest im März 2027 (Ende der Mindestlaufzeit 14.03.), nicht im Dezember', () => {
    expect(restMonat(M, FEST)).toBe('2027-03');
    expect(monatsPositionen(M, '2026-11', ctx).map(p => [p.titel, p.einzelpreisCent])).toEqual([
      ['Wachstumspaket — November 2026 (anteilig ab 15.11., 16 von 30 Tagen)', 58_667],
      ['Wachstumspaket · Festpreis — Anzahlung 50 %', 100_000],
    ]);
    expect(monatsPositionen(M, '2026-12', ctx).map(p => p.einzelpreisCent)).toEqual([110_000]);
    expect(monatsPositionen(M, '2027-03', ctx).map(p => [p.titel, p.einzelpreisCent])).toEqual([
      ['Wachstumspaket — März 2027', 110_000],
      ['Wachstumspaket · Festpreis — Restzahlung 50 %', 100_000],
    ]);
  });
  it('Liquidität: Anzahlung am 29.11., Rest am 15.03.2027 — der Text sagt „Rest bei Abschluss“ und den Monat', () => {
    const posten = mandatPosten(M, HEUTE, { katalog: KATALOG });
    const fest = posten.filter(p => p.id.includes('~z-mz-e-1'));
    expect(fest.map(p => [p.betrag, p.ab, p.leistungsmonat])).toEqual([[1190, '2026-11-29', '2026-11'], [1190, '2027-03-15', '2027-03']]);
    expect(fest[1].titel).toContain('Restzahlung 50 %');
    expect(fest[1].notiz).toContain('Rest bei Abschluss (März 2027), wie die Monatsrechnung');
    expect(posten.some(p => p.leistungsmonat === '2026-12' && p.id.includes('~z-mz-e-1'))).toBe(false);
  });
  it('Summe der Posten = Summe der Monatsrechnungen (ohne den nach Tagen abgerechneten Tagessatz), auf den Cent — ohne und mit gesetztem Ende', () => {
    for (const m of [M, mandat({ ende: '2027-03-14' })]) {
      const posten = mandatPosten(m, HEUTE, { katalog: KATALOG });
      const plan = posten.filter(p => !p.id.includes('~z-mz-e-3')).reduce((a, p) => a + Math.round(p.betrag * 100) * zahlungen(p).length, 0);
      const monate = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
      const rechnungen = monate.reduce((a, mo) => a + rechnungSummen(monatsPositionen(m, mo, ctx, '2027-03-14')).brutto, 0);
      expect(plan).toBe(rechnungen);
    }
  });
  it('die Regel: „bis“ am Modul, sonst gesetztes Ende, sonst Ende der Mindestlaufzeit, erst ohne beides der Folgemonat', () => {
    expect(restMonat(M, { ...FEST, bis: '2027-01-20' })).toBe('2027-01');
    expect(restMonat(mandat({ ende: '2027-02-10' }), FEST)).toBe('2027-02');
    expect(restMonat(mandat({ ende: '2027-02-10' }), { ...FEST, bis: '2027-06-30' })).toBe('2027-02');
    expect(restMonat(mandat({ mindestlaufzeitMonate: undefined }), FEST)).toBe('2026-12');
    // Fällt der Abschluss in den Monat des Beginns: eine Zahlung.
    expect(restMonat(mandat({ ende: '2026-11-30' }), FEST)).toBe('2026-11');
    expect(monatsPositionen(mandat({ ende: '2026-11-30' }), '2026-11', ctx).find(p => p.titel.includes('Festpreis'))?.einzelpreisCent).toBe(200_000);
    // Das einmalige Honorar mit Zahlplan folgt derselben Regel.
    expect(zahlplanMonate(mandat({ honorar: { betrag: 2000, basis: 'einmalig', netto: true }, zahlplan: { anzahlungProzent: 50 }, zusatz: [] }))).toEqual(['2026-11', '2027-03']);
  });
});

// ── 2 · Deal-Wert: festes Honorar, geplante Sätze und einmalig getrennt ──
import { dealWertAusAngebot } from '@/lib/crm/angebote';
import { angebotPositionenAusProdukt, dealWertAusProdukt } from '@/lib/crm/produkt-karte';
import { dealWertText, festerMonatswert, geplanterMonatswert, gesamtwert, prognose } from '@/lib/crm/pipeline';
import { istBasisVorschlaege } from '@/lib/finanzen/produkte';
import { saeubern } from '@/lib/crm/speicher';
import type { Chance } from '@/lib/crm/typen';

describe('2 · Deal-Wert: „1.100 €/Monat + ca. 3.000 €/Monat Tagessätze (geplant)“ statt „4.100 € je Monat“', () => {
  const positionen = angebotPositionenAusProdukt(PAKET, ['pt-3']);
  const w = dealWertAusAngebot({ positionen });
  const deal = { wert: w } as Pick<Chance, 'wert'>;
  it('Wert aus dem Angebot: Gesamt wie bisher, der geplante Teil getrennt benannt', () => {
    expect(w).toEqual({ betrag: 4100, basis: 'monat', laufzeitMonate: 4, einmalBetrag: 2000, geplantBetrag: 3000, geplantSatz: 'tag' });
    expect(gesamtwert(deal)).toBe(4100 * 4 + 2000);
    expect(dealWertText(deal)).toBe('1.100 €/Monat + ca. 3.000 €/Monat Tagessätze (geplant) · 4 Monate + 2.000 € einmalig');
    expect(dealWertText(deal, { kurz: true })).toBe('1.100 €/M + ca. 3.000 €/M geplant + 2.000 €');
  });
  it('Kennzahl „monatlich wiederkehrend“ nimmt nur das feste Honorar; Pipeline/Prognose rechnen mit dem Gesamtwert', () => {
    expect(festerMonatswert(deal)).toBe(1100);
    expect(geplanterMonatswert(deal)).toBe(3000);
    const offen = { id: 'ch-1', stufe: 'angebot', wert: w, historie: [], angelegt: J, naechsterSchritt: { text: 'Nachfassen', datum: '2026-10-30' } } as unknown as Chance;
    expect(prognose([offen], HEUTE).offen).toBe(gesamtwert(deal));
    // Ist-Basis der Planung: festes Honorar als Hauptpreis, geplante Sätze als eigener Teil.
    const gewonnen = { ...offen, titel: 'Wachstumspaket', firma: 'Beispiel Logistik AG', stufe: 'gewonnen', leistungId: 'l-paket', gesellschaft: 'ug' } as Chance;
    const ist = istBasisVorschlaege({ mandate: [], chancen: [gewonnen], leistungen: KATALOG }, HEUTE);
    expect(ist.map(x => [x.teil ?? 'haupt', x.betrag, x.rhythmus])).toEqual([['haupt', 1100, 'monatlich'], ['geplant', 3000, 'monatlich'], ['einmal', 2000, 'einmalig']]);
  });
  it('ohne geplante Sätze bleibt alles wie bisher (Text, Wert, Kennzahl)', () => {
    const ohne = { wert: dealWertAusAngebot({ positionen: angebotPositionenAusProdukt(PAKET, []) }) };
    expect(ohne.wert).toEqual({ betrag: 1100, basis: 'monat', laufzeitMonate: 4, einmalBetrag: 2000 });
    expect(dealWertText(ohne)).toBe('1.100 € je Monat · 4 Monate + 2.000 € einmalig');
    expect(festerMonatswert(ohne)).toBe(1100);
  });
  it('Produkt-Vorgabe trennt ebenso (nur Grund-Teile); der Säuberer hält das Feld nur bei Basis „monat“ und höchstens bis zum Monatswert', () => {
    const grund = { ...PAKET, preise: PAKET.preise!.map(t => (t.id === 'pt-3' ? { ...t, rolle: 'grund' as const } : t)) };
    expect(dealWertAusProdukt(grund)).toMatchObject({ betrag: 4100, geplantBetrag: 3000, geplantSatz: 'tag' });
    expect(dealWertAusProdukt(PAKET)).toEqual({ betrag: 1100, basis: 'monat', laufzeitMonate: 4, einmalBetrag: 2000 });
    const roh = (wert: Record<string, unknown>) => (saeubern('chancen', { id: 'ch-1', titel: 'Deal', kontaktIds: [], wert, stufe: 'angebot' }, J, 'kevin') as unknown as Chance | null)?.wert;
    expect(roh({ betrag: 4100, basis: 'monat', geplantBetrag: 3000, geplantSatz: 'tag' })).toMatchObject({ geplantBetrag: 3000, geplantSatz: 'tag' });
    expect(roh({ betrag: 2000, basis: 'monat', geplantBetrag: 3000 })).not.toHaveProperty('geplantBetrag');
    expect(roh({ betrag: 4100, basis: 'einmalig', geplantBetrag: 3000 })).not.toHaveProperty('geplantBetrag');
  });
});

// ── 3 · Fall-Dialog: Startdatum = Start des Mandats ──
import { fallStartVorgabe } from '@/lib/prozesse/produkt-ablauf';
import { readFileSync } from 'node:fs';
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('3 · „Fall starten“ belegt den Start des Mandats vor (liegt er zurück: heute)', () => {
  it('Regel', () => {
    expect(fallStartVorgabe('2026-11-15', HEUTE)).toBe('2026-11-15');
    expect(fallStartVorgabe('2026-10-01', HEUTE)).toBe(HEUTE);
    expect(fallStartVorgabe(null, HEUTE)).toBe(HEUTE);
    expect(fallStartVorgabe('kaputt', HEUTE)).toBe(HEUTE);
  });
  it('der Dialog nimmt die Regel; jede Stelle mit dem Dialog reicht den Start des Mandats herein', () => {
    expect(quelle('components/os/fulfillment/prozesse/Onboarding.tsx')).toMatch(/useState\(\(\) => fallStartVorgabe\(k\.start, localDay\(\)\)\)/);
    expect(quelle('components/os/fulfillment/prozesse/FallAmDeal.tsx')).toMatch(/start: mandat\.start/);
    expect(quelle('components/os/fulfillment/prozesse/FallAmDeal.tsx')).toMatch(/start: r\.start/);
    expect(quelle('components/os/fulfillment/prozesse/FallUeberblick.tsx')).toMatch(/start: daten\.mandat\.start/);
    expect(quelle('components/os/fulfillment/prozesse/OnboardingFrage.tsx')).toMatch(/start: m\.start/);
    expect(quelle('components/os/fulfillment/reise/HeuteListe.tsx')).toMatch(/start: r\.start/);
    expect(quelle('lib/fulfillment/prozesse/server.ts')).toMatch(/m\.start \? \{ start: m\.start \}/);
  });
});

// ── 5 · Onboarding-Zählung: „x von n“ und „+n“ aus derselben Menge ──
import { reiseZeile, phasenFluss, flussKnoten, verborgeneSchritte, KAESTCHEN_MAX } from '@/lib/fulfillment/prozesse/reise-bild';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

describe('5 · Reise: „0 von 8“ mit vier Kästchen und „+4“ (nie „+9“ — die Abschluss-Stellen sind keine Schritte)', () => {
  const kn = (id: string, elternId: string | undefined, titel: string, rang: number): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen' } as FallKnoten);
  const schritte = ['Willkommen', 'Kick-off', 'Vereinbarung', 'Playbook', 'Stakeholder', 'Wert-Konto', 'Entscheidungslog', 'Abstimmung'];
  const fall = { status: 'onboarding', freigaben: {}, befaehigung: [], knoten: [kn('w', undefined, 'Akte', 1), kn('ob', 'w', 'Onboarding', 1), ...schritte.map((t, i) => kn(`s${i}`, 'ob', t, i + 1))] } as unknown as Fall;
  const eingabe = { fall, freigaben: [], heute: HEUTE };
  const z = reiseZeile(eingabe);
  it('die einzige Phase trägt den Abschluss — gezählt werden nur ihre Schritte', () => {
    const s = z.spalten[0];
    expect(s.gesamt).toBe(8);
    expect(s.kaestchen.length).toBe(KAESTCHEN_MAX);
    expect(s.mehr).toBe(4);
    expect(s.kaestchen.length + s.mehr).toBe(s.gesamt);
  });
  it('der Fluss der Phase zeigt dieselben acht Schritte (gezeigt + „+n weitere“ = 8), der Abschluss steht für sich', () => {
    const fl = phasenFluss(eingabe, 'ob');
    const alle = fl ? flussKnoten(fl).filter(k => schritte.some((_, i) => k.id === `s${i}`)) : [];
    expect(alle).toHaveLength(8);
    expect(verborgeneSchritte(schritte.map((_, i) => ({ knoten: { id: `s${i}` } as FallKnoten })), alle.slice(0, 6))).toBe(2);
  });
});

// ── 4 · EINE Zählung der Phasen für Reise, Mandat (Cockpit) und Kunden-Ansicht ──
import { ablaufSpalten, phasenText, phasenZaehlung, type ProduktAblaufAnsicht } from '@/lib/prozesse/produkt-ablauf';
import { cockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { onboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { fallStelle } from '@/lib/fulfillment/prozesse/reise';
import { kundenTeile } from '@/lib/fulfillment/kunde/bild';
import { kundenAblaufPhasen } from '@/lib/prozesse/kunden-etappen';

describe('4 · „Phase 1 von 3 · Onboarding“ überall — der Ablauf im Schatten zählt mit, gekennzeichnet', () => {
  const kn = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
  const akte = {
    mandatId: 'm-paket', vorlageId: 'pz-paket', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'kevin', status: 'onboarding',
    knoten: [kn('w', undefined, 'Wachstumspaket', 1), kn('ob', 'w', 'Onboarding', 1, { kundeSichtbar: true }), kn('ob-1', 'ob', 'Willkommensmail', 1, { kundeSichtbar: true }), kn('ob-2', 'ob', 'Kick-off', 2)],
    freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'kevin',
  } as unknown as Fall;
  const ablauf: ProduktAblaufAnsicht = {
    id: 'pz-paket', titel: 'Wachstumspaket', lage: 'schatten', version: 1, lauf: null,
    phasen: [
      { id: 'ph-a', titel: 'Ablauf', schritte: [{ id: 'k-1', titel: 'Workshop vorbereiten', form: 'schritt', zustand: 'offen', kunde: true }] },
      { id: 'ph-b', titel: 'Umsetzung', schritte: [{ id: 'k-2', titel: 'Maßnahmen umsetzen', form: 'schritt', zustand: 'offen' }] },
    ],
  };
  const st = fallStelle(akte, [], HEUTE);
  const reise = reiseZeile({ fall: akte, freigaben: [], heute: HEUTE });
  const spalten = [...reise.spalten, ...ablaufSpalten(ablauf, reise.spalten.length + 1, true)];
  it('Reise: Onboarding + zwei Phasen des Ablaufs, fortlaufend nummeriert, die des Ablaufs mit Kennzeichen', () => {
    expect(spalten.map(s => [s.nr, s.titel])).toEqual([[1, 'Onboarding'], [2, 'Ablauf'], [3, 'Umsetzung']]);
    expect(ablaufSpalten(ablauf, 2, true).map(s => s.unter)).toEqual(['0 von 1 · im Schatten', '0 von 1 · im Schatten']);
    expect(ablaufSpalten({ ...ablauf, lage: 'scharf' }, 2, true)[0].unter).toBe('0 von 1');
  });
  it('Zählung: dieselbe Zahl wie die Reise; ohne Ablauf genau wie bisher', () => {
    const z = phasenZaehlung(st.phase, reise.spalten.length, ablauf)!;
    expect(z).toEqual({ nr: 1, von: spalten.length, titel: 'Onboarding', ablauf: 'schatten' });
    expect(phasenText(z)).toBe('Phase 1 von 3 · Onboarding · Ablauf im Schatten');
    expect(phasenZaehlung(st.phase, reise.spalten.length, null)).toEqual({ nr: 1, von: 1, titel: 'Onboarding' });
    expect(phasenText(phasenZaehlung(st.phase, 1, { ...ablauf, lage: 'scharf' })!)).toBe('Phase 1 von 3 · Onboarding');
  });
  it('Mandat/Cockpit: Phase 1 von 3 mit Kennzeichen, der Strahl trägt alle drei Phasen', () => {
    const ob = onboardingStand(akte, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: J });
    const eingabe = { fall: akte, kunde: 'Beispiel Logistik AG', titel: 'Wachstumspaket', onboarding: ob, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE };
    expect(cockpitZeile({ ...eingabe, ablauf })).toMatchObject({ phase: 'Onboarding', phaseNr: 1, phasenAnzahl: 3, ablaufLage: 'schatten' });
    expect(cockpitZeile({ ...eingabe, ablauf }).phasen?.map(p => p.titel)).toEqual(['Onboarding', 'Ablauf', 'Umsetzung']);
    const ohne = cockpitZeile(eingabe);
    expect([ohne.phaseNr, ohne.phasenAnzahl, ohne.ablaufLage, ohne.phasen?.length]).toEqual([1, 1, undefined, 1]);
  });
  it('Kunden-Ansicht: hinter dem Onboarding die Phasen des Ablaufs, die der Kunde sehen darf — „Phase 1 von 2“, nie „Schatten“', () => {
    const danach = kundenAblaufPhasen(ablauf);
    expect(danach).toEqual([{ titel: 'Ablauf', stand: 'kommt' }]);
    const t = kundenTeile({ fall: akte, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), danachPhasen: danach });
    expect(t.phasen.map(p => p.titel)).toEqual(['Onboarding', 'Ablauf']);
    expect(t.lage.saetze[0]).toContain('Phase 1 von 2');
    expect(JSON.stringify(t)).not.toMatch(/Schatten/);
    // Ohne Ablauf genau wie bisher.
    expect(kundenTeile({ fall: akte, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set() }).lage.saetze[0]).toContain('Phase 1 von 1');
  });
});

