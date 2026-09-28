// ─── Eine USt-Funktion, auf den Cent (28.09., K3 · #79/#80) ─────────────────
// Vorher: Mandat → Rechnung auf ganze Euro gerundet, Voranmeldung ungerundet,
// Finanzplanung „netto = brutto / 1,19“. Jetzt eine Stelle, kaufmännisch je Rechnung.
import { describe, it, expect } from 'vitest';
import { bruttoAusNetto, nettoAusBrutto, ustAusBrutto, ustAusNetto, kaufmaennisch, aufCent } from '../lib/finanzen/ust';
import { planpostenAus } from '../lib/crm/kunden';
import { ustZeitraum } from '../lib/steuern/rechnen';
import type { Mandat } from '../lib/crm/typen';

describe('lib/finanzen/ust', () => {
  it('1.190,50 € bleibt 1.190,50 €: netto + Steuer ergeben genau den Rechnungsbetrag', () => {
    expect(ustAusBrutto(1190.5)).toBe(190.08);
    expect(nettoAusBrutto(1190.5)).toBe(1000.42);
    expect(aufCent(nettoAusBrutto(1190.5) + ustAusBrutto(1190.5))).toBe(1190.5);
    expect(bruttoAusNetto(1000.42)).toBe(1190.5);
  });
  it('kaufmännisch: ab ,5 aufrunden (auch bei Gleitkomma-Resten und negativ weg von der Null)', () => {
    expect(ustAusNetto(0.5, 19)).toBe(0.1); // 9,5 ct → 10 ct
    expect(aufCent(1.005)).toBe(1.01); // 1.005 × 100 = 100.4999… in Gleitkomma
    expect(kaufmaennisch(-2.5)).toBe(-3);
    expect(kaufmaennisch(2.5)).toBe(3);
  });
  it('Sätze: Regelsatz ohne Angabe, 7 %, 0 % (Reverse Charge)', () => {
    expect(bruttoAusNetto(100)).toBe(119);
    expect(bruttoAusNetto(100, 7)).toBe(107);
    expect(bruttoAusNetto(100, 0)).toBe(100);
    expect(nettoAusBrutto(107, 7)).toBe(100);
  });
});

describe('Verbraucher rechnen mit derselben Funktion', () => {
  it('Mandat → Liquiplan-Posten: brutto auf den Cent (vorher auf ganze Euro)', () => {
    const m = { id: 'm1', kunde: 'Probe GmbH', titel: 'Beratung', status: 'aktiv', vertragUnterschrieben: true, gesellschaft: 'kdc', honorar: { betrag: 1000.42, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14 } as unknown as Mandat;
    expect(planpostenAus(m, '2026-09-28')!.betrag).toBe(1190.5);
  });
  it('USt-Voranmeldung: Steuer je Rechnung auf den Cent', () => {
    const z = ustZeitraum('kdc', { ust: 'quartal', istVersteuerung: false } as never, { label: 'Q3/2026', von: '2026-07-01', bis: '2026-09-30' },
      [{ id: 'r1', kunde: 'Probe', titel: 't', betrag: 1190.5, status: 'gestellt', datum: '2026-09-10', firmaId: 'kdc' }], null, null);
    expect(z.rechnungen[0].ust).toBe(190.08);
    expect(z.ust).toBe(190.08);
  });
});
