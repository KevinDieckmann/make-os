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

