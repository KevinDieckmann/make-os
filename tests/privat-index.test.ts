// Privat-Index (25.09.): dieselbe Logik wie der Business-Index für den Haushalt —
// drei Säulen, Schwellen, Messlücken, Punkte mit Links in Buchungen/Schulden.
// Nur erfundene Beispieldaten.
import { describe, it, expect } from 'vitest';
import { berechnePrivat, privatFrisch, PRIVAT_KENNZAHLEN, PRIVAT_SAEULEN, type PrivatBestand } from '../lib/privat/index';
import type { Buchung, Kategorie, Schuld, Beleg, Planwert, Konto } from '../lib/finanzen/haushalt/typen';

const HEUTE = '2026-09-25';
let n = 0;
const b = (datum: string, betrag: number, kategorie_id: string | null, x: Partial<Buchung> = {}): Buchung => ({
  id: `b${++n}`, stand: 1, konto_id: 'k1', datum, betrag, beschreibung: kategorie_id ?? 'x', empfaenger: kategorie_id ?? 'x', kategorie_id,
  ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: null, geaendert: HEUTE, ...x,
});
const kat = (id: string, name: string, typ: Kategorie['typ'], monatsbudget: number | null = null): Kategorie => ({ id, stand: 1, name, typ, sortierung: 0, monatsbudget });
const MONATE = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const buchungen: Buchung[] = MONATE.flatMap(m => [
  b(`${m}-01`, 400000, 'gehalt'),
  b(`${m}-03`, -150000, 'miete', { ist_fixkosten: true, empfaenger: 'Vermieter' }),
  b(`${m}-12`, m === '2026-08' ? -60000 : -50000, 'lebensmittel'),
  b(`${m}-15`, -30000, 'tilgung'),
]).concat([b('2026-08-28', -10000, 'freizeit'), b('2026-08-20', 5000, null, { einheit: 'selbststaendigkeit' })]);
const haushalt: PrivatBestand['haushalt'] = {
  stamm: {
    konten: [{ id: 'k1', stand: 1, name: 'Gemeinschaftskonto', inhaber: 'gemeinsam', einheit: 'privat', iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true } as Konto],
    kategorien: [kat('gehalt', 'Gehalt', 'einnahme'), kat('miete', 'Wohnen', 'ausgabe'), kat('lebensmittel', 'Lebensmittel', 'ausgabe', 55000), kat('freizeit', 'Freizeit', 'ausgabe', 20000), kat('tilgung', 'Tilgung', 'ausgabe')],
    regeln: [], aliase: {},
  },
  buchungen,
  schulden: [{ id: 's1', stand: 1, bezeichnung: 'Autokredit', glaeubiger: 'Bank', einheit: 'privat', startbetrag: 1200000, restbetrag: 900000, rate: 30000, zinssatz: 4, rhythmus: 'monatlich', naechste_faelligkeit: '2026-10-15', endet_am: '2029-03-15', notiz: null, aus_buchung_id: null } as Schuld],
  belege: [{ id: 'r1', stand: 1, art: 'rechnung', bezeichnung: 'Zahnarzt', empfaenger: 'Praxis', betrag: 12000, faellig_am: '2026-09-10', verursacher: null, einheit: 'privat', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null } as Beleg],
  planwerte: [{ id: 'p1', stand: 1, einheit: 'privat', jahr: 2026, monat: 8, posten: 'Ausgaben', sollwert: 200000, notiz: null } as Planwert],
};
const bestand = (x: Partial<PrivatBestand> = {}): PrivatBestand => ({ heute: HEUTE, haushalt, ruecklage: null, ...x });
const k = (pi: ReturnType<typeof berechnePrivat>, id: string) => pi.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === id)!;

describe('Privat-Index', () => {
  it('Aufbau: drei Säulen 40/35/25, Schwellen in der richtigen Reihenfolge', () => {
    expect(PRIVAT_SAEULEN.map(s => [s.id, s.gewicht])).toEqual([['rl', 0.4], ['ab', 0.35], ['vs', 0.25]]);
    for (const x of PRIVAT_KENNZAHLEN) expect(x.richtung === 'hoch' ? x.gruen > x.rot : x.gruen < x.rot, x.id).toBe(true);
  });

  it('rechnet jede Kennzahl aus den Buchungen — nur Privat, nie Selbständigkeit', () => {
    const pi = berechnePrivat(bestand({ ruecklage: { betrag: 1_080_000, stand: '2026-09-01' } }));
    expect(k(pi, 'notgroschen')).toMatchObject({ wert: 6, ampel: 'gruen' });     // 10.800 € ÷ (1.500 Miete + 300 Rate)
    expect(k(pi, 'luft')).toMatchObject({ wert: 2200, ampel: 'gruen' });         // 4.000 − 1.800
    expect(k(pi, 'planbar').wert).toBeCloseTo(4000 / 1800, 5);
    expect(k(pi, 'fixquote')).toMatchObject({ wert: 45, ampel: 'gruen' });
    expect(k(pi, 'konsumquote').wert).toBeCloseTo((50000 + 50000 + 60000 + 10000) / 1_200_000 * 100, 5); // ohne Tilgung
    expect(k(pi, 'budget')).toMatchObject({ wert: 50, ampel: 'rot' });            // Lebensmittel über, Freizeit drin
    expect(k(pi, 'ist_soll').wert).toBeCloseTo(10, 5);                            // 2.200 Ist ÷ 2.000 Soll
    expect(k(pi, 'zuordnung')).toMatchObject({ wert: 0, ampel: 'gruen' });
    expect(k(pi, 'aktualitaet')).toMatchObject({ wert: 28, ampel: 'gelb' });
    expect(k(pi, 'sparquote').wert).toBeCloseTo(1_000_000 / 2_400_000 * 100, 5);
    expect(k(pi, 'schuldendienst')).toMatchObject({ wert: 7.5, ampel: 'gruen' });
    expect(k(pi, 'tilgung')).toMatchObject({ wert: 100, ampel: 'gruen' });
    expect(k(pi, 'schuldenfrei')).toMatchObject({ wert: 30, ampel: 'gruen' });
    expect(k(pi, 'rechnungen')).toMatchObject({ wert: 1, ampel: 'gelb' });
    expect(pi.index).toBeGreaterThan(60);
    expect(pi.luecken).toBe(0);
  });

  it('ohne Rücklage ist der Notgroschen eine Messlücke mit Weg zur Eingabe', () => {
    const n = k(berechnePrivat(bestand()), 'notgroschen');
    expect(n).toMatchObject({ gemessen: false, ampel: 'grau', quelle: 'Rücklage ist nicht eingetragen' });
    expect(n.details[0]).toMatchObject({ href: '/os/finanzen?s=privat#ruecklage' });
  });

  it('die Punkte führen in die gefilterten Buchungen, Kategorien und Schulden', () => {
    const pi = berechnePrivat(bestand({ ruecklage: { betrag: 1_080_000, stand: '2026-06-01' } }));
    expect(k(pi, 'budget').details[0]).toMatchObject({ titel: 'Lebensmittel', ampel: 'rot', href: '/os/finanzen?s=privat&t=buchungen&monat=2026-08&kat=lebensmittel' });
    expect(k(pi, 'konsumquote').details.map(d => d.titel)).toEqual(['Lebensmittel', 'Freizeit']);
    expect(k(pi, 'schuldenfrei').details[0]).toMatchObject({ titel: 'Autokredit', href: '/os/finanzen?s=privat&t=schulden' });
    expect(k(pi, 'rechnungen').details[0]).toMatchObject({ titel: 'Praxis', ampel: 'rot' });
    expect(k(pi, 'notgroschen').details[0]).toMatchObject({ ampel: 'gelb', unter: expect.stringContaining('116 Tage alt') });
    const alle = pi.saeulen.flatMap(s => s.kennzahlen).flatMap(x => [...x.details.map(d => d.href), x.pflegen?.href]).filter(Boolean) as string[];
    expect(alle.filter(h => !/^\/os\/finanzen\?s=privat(&t=[a-z]+)?(&[a-z]+=[^&#]+)*(#(index|ruecklage))?$/.test(h))).toEqual([]);
  });

  it('eigene Schwellen gelten; veraltete Buchungen sind nicht frisch', () => {
    const pi = berechnePrivat(bestand({ schwellen: { fixquote: { gruen: 40, rot: 44 } } }));
    expect(k(pi, 'fixquote')).toMatchObject({ gruen: 40, rot: 44, ampel: 'rot', angepasst: true });
    expect(privatFrisch({ heute: HEUTE, haushalt })).toBe(true);
    expect(privatFrisch({ heute: '2026-11-01', haushalt })).toBe(false);
  });
});
