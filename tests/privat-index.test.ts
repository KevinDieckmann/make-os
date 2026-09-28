// Privat-Index (25.09.): dieselbe Logik wie der Business-Index für den Haushalt —
// drei Säulen, Schwellen, Messlücken, Punkte mit Links in Buchungen/Schulden.
// Nur erfundene Beispieldaten.
import { describe, it, expect } from 'vitest';
import { berechnePrivat, privatFrisch, PRIVAT_KENNZAHLEN, PRIVAT_SAEULEN, type PrivatBestand } from '../lib/privat/index';
import type { Buchung, Kategorie, Schuld, Beleg, Planwert, Konto } from '../lib/finanzen/haushalt/typen';
import { bild, type ZeitDatei } from '../lib/zeitmessung/modell';

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
]).concat([b('2026-08-28', -10000, 'freizeit'), b('2026-08-20', 5000, null, { einheit: 'kdc' })]);
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
    // 26.09. spät: vierte Säule „Fokus & Zeit“ (10 %) — die drei Finanz-Säulen behalten ihr Verhältnis 40/35/25.
    expect(PRIVAT_SAEULEN.map(s => [s.id, Math.round(s.gewicht * 1000) / 1000])).toEqual([['rl', 0.36], ['ab', 0.315], ['vs', 0.225], ['fz', 0.1]]);
    for (const x of PRIVAT_KENNZAHLEN) expect(x.richtung === 'hoch' ? x.gruen > x.rot : x.gruen < x.rot, x.id).toBe(true);
  });

  // Zeit & Fokus (26.09. spät): 3 h mitgelaufen + 1 h bewusst in Gesundheit, alles heute.
  const zeitDatei: ZeitDatei = { tage: { [HEUTE]: { auto: { 'privat:gesundheit': 3 * 3600 }, bewusst: { 'privat:gesundheit': 3600 }, bloecke: [{ von: `${HEUTE}T09:00:00.000Z`, bis: `${HEUTE}T10:00:00.000Z`, schluessel: 'privat:gesundheit', label: 'Gesundheit', sek: 3600 }] } } };
  const zeit = bild(zeitDatei, HEUTE);

  it('rechnet jede Kennzahl aus den Buchungen — nur Privat, nie Selbständigkeit', () => {
    const pi = berechnePrivat(bestand({ ruecklage: { betrag: 1_080_000, stand: '2026-09-01' }, zeit }));
    expect(k(pi, 'zeit_woche')).toMatchObject({ wert: 4, ampel: 'gelb' });          // 4 h von 8 h grün
    expect(k(pi, 'bewusst_woche')).toMatchObject({ wert: 1, ampel: 'gelb' });
    expect(k(pi, 'fokus_tage')).toMatchObject({ wert: 1, ampel: 'gelb' });
    expect(k(pi, 'bereich_zeit')).toMatchObject({ wert: 4, ampel: 'gruen' });       // Gesundheit ≥ 3 h
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

  it('unter einer Stunde in 7 Tagen ist Fokus & Zeit eine Lücke mit Stand, keine Note', () => {
    const wenig = bild({ tage: { [HEUTE]: { auto: { 'privat:home': 600 }, bewusst: { 'privat:gesundheit': 6 }, bloecke: [] } } }, HEUTE);
    const pi = berechnePrivat(bestand({ ruecklage: { betrag: 1_080_000, stand: '2026-09-01' }, zeit: wenig }));
    expect(pi.saeulen.find(s => s.id === 'fz')!.score).toBeNull();
    expect(k(pi, 'zeit_woche')).toMatchObject({ gemessen: false, quelle: expect.stringContaining('Erst 10 min gemessen') });
  });

  it('ohne Zeitmessung zählt Fokus & Zeit nicht — der Index ist exakt der Finanz-Index (40/35/25)', () => {
    const pi = berechnePrivat(bestand({ ruecklage: { betrag: 1_080_000, stand: '2026-09-01' } }));
    const fz = pi.saeulen.find(s => s.id === 'fz')!;
    expect(fz.score).toBeNull();
    expect(fz.kennzahlen.every(x => !x.gemessen)).toBe(true);
    expect(pi.luecken).toBe(4);
    const s = (id: string) => pi.saeulen.find(x => x.id === id)!.score as number;
    expect(pi.index).toBe(Math.round(s('rl') * 0.4 + s('ab') * 0.35 + s('vs') * 0.25));
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
