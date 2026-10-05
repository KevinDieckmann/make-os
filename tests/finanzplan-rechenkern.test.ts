// ─── Finanzplanung jetzt — Rechenkern mit erfundenen, kleinen Zahlen ─────────
// Jede Erwartung ist von Hand nachgerechnet (Kommentare). Keine echten Daten.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten, Szenario, Zeile } from '../lib/finanzen/rechenkern';
import {
  netto, est2026, wert, key, jahrVon, kalMonat, rechneUG, rechnePrivat, rechneSelbst, kennzahlen, sollBudget,
  istHistorie, istSchnitt, lerneRegel, toepfeUG, zielStaende, zahlungskalender, tilgungsplan, tempo, histIndex, planMonat,
} from '../lib/finanzen/rechenkern';
import { monatsLabels } from '../lib/finanzen/plan/operationen';

const szenario = (over: Partial<Szenario> = {}): Szenario => ({
  id: 's1', name: 'Test', ob: { betrag: 1000, start: 1, laufzeit: 3 }, retainer: [], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 },
  erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 0, monat: 0 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false, ...over,
});

function mini(over: Partial<FinanzDaten> = {}, annahmen: Partial<FinanzDaten['annahmen']> = {}): FinanzDaten {
  return {
    version: 3, stand: '2026-09-27', monate: monatsLabels(2026, 10, 27), aktiv: 's1', schulden: [], meta: {}, abschluesse: [], historie: monatsLabels(2026, 1, 9),
    einstellungen: { heute: '2026-09-27', reserveMonate: 1 },
    buchungen: [], regeln: {}, ziele: [], check: { punkte: [], eintraege: [] }, notizen: {},
    annahmen: {
      kevinBrutto: 1000, kevinAb: 2, malinBrutto: 1000, malinAb: 2, agAnteil: 0.2, stammkapital: 500, gruendungskosten: 100, darlehenKevin: 0, darlehenRueckMonat: 0,
      retainerVerzug: 0, astarnaProvision: 100, steuerUG: 0.3, ust: 0.19, steuerMonat: 6, holdingKosten: 0, holdingAb: 99, kdvStart: 0,
      bjoernBetrag: 0, bjoernRate: 0, bjoernRateVon: 0, bjoernRateBis: 0, bjoernSchluss: 0, bjoernSchlussMonat: 0, bjoernZinsMonat: 0, bjoernZinsDeckel: 0,
      exitSteuer: 0, nettoTabelle: [[1000, 800], [2000, 1500]], gehaltTag: 28, ...annahmen,
    },
    sachkosten: [], privatEinnahmen: [], privatBudget: [], privatSchulden: [],
    szenarien: [szenario()],
    selbst: { posten: [], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 0 },
    posten: [], fokus: { saetze: [], regeln: [], schritte: [] }, plan: {}, ist: {}, protokoll: [],
    ...over,
  };
}
const zeile = (over: Partial<Zeile> & Pick<Zeile, 'id' | 'soll'>): Zeile => ({ name: over.id, einheit: 'privat', gruppe: 'Test', ...over });

describe('Zeitachse', () => {
  it('Monat 1 = Okt 26, 4 = Jan 27, 27 = Dez 28; Historie Jan 26 = 0', () => {
    expect([jahrVon(1), kalMonat(1)]).toEqual([2026, 10]);
    expect([jahrVon(4), kalMonat(4)]).toEqual([2027, 1]);
    expect([jahrVon(27), kalMonat(27)]).toEqual([2028, 12]);
    expect(histIndex('2026-01-15')).toBe(0);
    expect(histIndex('2026-09-27')).toBe(8);
    expect(planMonat('2026-10-01')).toBe(1);
    expect(monatsLabels(2026, 10, 27)).toHaveLength(27);
    expect(monatsLabels(2026, 10, 4)).toEqual(['Okt 26', 'Nov 26', 'Dez 26', 'Jan 27']);
  });
});

describe('netto() und est2026()', () => {
  const t: [number, number][] = [[1000, 800], [2000, 1500]];
  it('interpoliert linear, darunter proportional, darüber mit der letzten Steigung', () => {
    expect(netto(0, t)).toBe(0);
    expect(netto(500, t)).toBe(400);      // 500 · 800/1000
    expect(netto(1500, t)).toBe(1150);    // 800 + 500 · 700/1000
    expect(netto(3000, t)).toBe(2200);    // 1500 + 1000 · 0,7
  });
  it('Grundtarif 2026: Grundfreibetrag steuerfrei, 20.000 → 1.570', () => {
    expect(est2026(12348)).toBe(0);
    expect(est2026(20000)).toBe(1570);    // (173,10·0,2201 + 2397)·0,2201 + 1034,87 = 1570,8 → abgerundet
    expect(est2026(100000)).toBe(Math.floor(0.42 * 100000 - 11135.63));
  });
});

describe('wert() mit Zellen-Überschreibung', () => {
  it('Soll gilt ab/bis, eine Planzelle gewinnt immer', () => {
    const z = zeile({ id: 'p.b.x', soll: 100, ab: 2, bis: 3 });
    expect(wert(z, 1, {})).toBe(0);
    expect(wert(z, 2, {})).toBe(100);
    expect(wert(z, 4, {})).toBe(0);
    expect(wert(z, 4, { [key('p.b.x', 4)]: 55 })).toBe(55);
    expect(wert(z, 2, { 'p.b.x:2': 0 })).toBe(0);
  });
  it('Jahreskosten-Topf: Monatsanteil = Jahresbetrag / 12', () => {
    const z = zeile({ id: 'p.b.j', soll: 100, typ: 'jahr', jahresbetrag: 1200, faellig: [1, 7] });
    expect(sollBudget(z, 1, {})).toBe(100);
    expect(sollBudget(z, 1, { 'p.b.j:1': 30 })).toBe(30);
  });
});

describe('rechneUG() — ein UG-Monat von Hand', () => {
  it('Monat 1: Kapital + Umsatz, Gründung raus, Steuerrücklage 30 % auf den Gewinn', () => {
    const d = mini(); const ug = rechneUG(d, d.szenarien[0]);
    const m1 = ug[0];
    expect(m1.umsatz).toBe(1000);
    expect(m1.einzahlungen).toBe(1500);       // 500 Stammkapital + 1000 Ankermandat (ohne USt)
    expect(m1.auszahlungen).toBe(100);        // nur Gründungskosten, Gehälter erst ab Monat 2
    expect(m1.konto).toBe(1400);
    expect(m1.gewinn).toBe(900);
    expect(m1.steuerRuecklage).toBe(270);
    expect(m1.frei).toBe(1130);
  });
  it('Monat 2 und 3: Gehälter inkl. 20 % Arbeitgeber, Rücklage fällt auf null bei negativem Jahresgewinn', () => {
    const d = mini(); const ug = rechneUG(d, d.szenarien[0]);
    expect(ug[1].kevin).toBe(1200); expect(ug[1].malin).toBe(1200);
    expect(ug[1].auszahlungen).toBe(2400);
    expect(ug[1].konto).toBe(0);              // 1400 + 1000 − 2400
    expect(ug[1].gewinnYTD).toBe(-500);       // 900 − 1400
    expect(ug[1].steuerRuecklage).toBe(0);
    expect(ug[2].konto).toBe(-1400);
    expect(ug[3].umsatz).toBe(0);             // Ankermandat läuft drei Monate
  });
  it('Retainer mit einem Monat Zahlungsverzug: Umsatz sofort, Geld und USt einen Monat später, USt-Zahlung wieder einen Monat später', () => {
    const d = mini({ szenarien: [szenario({ ob: { betrag: 0, start: 0, laufzeit: 0 }, retainer: [{ betrag: 1000, start: 1, laufzeit: 2 }] })] }, { retainerVerzug: 1, kevinAb: 99, malinAb: 99, gruendungskosten: 0 });
    const ug = rechneUG(d, d.szenarien[0]);
    expect(ug[0].retainer).toBe(1000); expect(ug[0].retainerEingang).toBe(0); expect(ug[0].ustEin).toBe(0);
    expect(ug[1].retainer).toBe(1000); expect(ug[1].retainerEingang).toBe(1000); expect(ug[1].ustEin).toBeCloseTo(190);
    expect(ug[1].einzahlungen).toBeCloseTo(1190);
    expect(ug[2].retainer).toBe(0); expect(ug[2].retainerEingang).toBe(1000); expect(ug[2].ustZahlung).toBeCloseTo(190);
    expect(ug[0].retainerAnzahl).toBe(1); expect(ug[2].retainerAnzahl).toBe(0);
  });
  it('Ertragsteuer: 30 % des Vorjahresgewinns im Steuermonat, davor als Rücklage geführt', () => {
    const d = mini({}, { kevinAb: 99, malinAb: 99, gruendungskosten: 0, steuerMonat: 1 });
    const ug = rechneUG(d, d.szenarien[0]);
    expect(ug[2].gewinnYTD).toBe(3000);
    expect(ug[2].steuerRuecklage).toBe(900);
    expect(ug[2].frei).toBe(3500 - 900);
    expect(ug[3].steuer).toBe(900);           // Jan 27 = Kalendermonat 1
    expect(ug[3].konto).toBe(2600);
    expect(ug[3].steuerRuecklage).toBe(0);    // 2027 noch ohne Gewinn, Vorjahr bezahlt
    expect(ug[3].frei).toBe(2600);
  });
  it('Partnerdarlehen-Rate läuft über die UG in die KD Ventures und tilgt den Rest', () => {
    const d = mini({}, { kevinAb: 99, malinAb: 99, gruendungskosten: 0, bjoernBetrag: 1000, bjoernRate: 100, bjoernRateVon: 2, bjoernRateBis: 11, bjoernSchluss: 0, bjoernSchlussMonat: 0 });
    const ug = rechneUG(d, d.szenarien[0]);
    expect(ug[0].bjoern).toBe(0); expect(ug[0].bjoernRest).toBe(1000);
    expect(ug[1].bjoern).toBe(100); expect(ug[1].bjoernRest).toBe(900);
    expect(ug[10].bjoernRest).toBe(0);
    expect(ug[1].kdvKonto).toBe(0);           // Rate kommt rein und geht als Tilgung wieder raus
  });
  it('Planzelle überschreibt eine berechnete Zeile (ug.ob)', () => {
    const d = mini({ plan: { 'ug.ob:1': 250 } });
    expect(rechneUG(d, d.szenarien[0])[0].umsatz).toBe(250);
  });
});

describe('rechnePrivat()', () => {
  it('Verfügbar = weitere Einnahmen + Netto; Luft = Verfügbar − Bedarf − Schulden; Malin vor der UG über die Selbstständigkeit', () => {
    const d = mini({ privatEinnahmen: [zeile({ id: 'p.e.a', soll: 500 })], privatBudget: [zeile({ id: 'p.b.fix', soll: 300, typ: 'fix' })] });
    const ug = rechneUG(d, d.szenarien[0]); const pr = rechnePrivat(d, ug, d.szenarien[0]);
    expect(pr[0].kevinNetto).toBe(0); expect(pr[0].malinNetto).toBe(800);
    expect(pr[0].verfuegbar).toBe(1300); expect(pr[0].bedarf).toBe(300); expect(pr[0].luft).toBe(1000);
    expect(pr[1].verfuegbar).toBe(2100); expect(pr[1].luft).toBe(1800); expect(pr[1].luftKum).toBe(2800);
    expect(pr[1].angespart).toBe(2800);
  });
  it('Jahreskosten-Topf füllt sich monatlich und leert sich im Fälligkeitsmonat', () => {
    const d = mini({ privatBudget: [zeile({ id: 'p.b.j', soll: 100, typ: 'jahr', jahresbetrag: 1200, faellig: [1, 7] })] });
    const pr = rechnePrivat(d, rechneUG(d, d.szenarien[0]));
    expect(pr[2].toepfe['p.b.j']).toBe(300);
    expect(pr[3].toepfe['p.b.j']).toBe(-200);  // Jan: +100 − 600
    expect(pr[1].jahr).toBe(100);
  });
  it('Lebensereignisse eines Szenarios drücken die Luft nur in ihrem Monat', () => {
    const d = mini({ szenarien: [szenario({ ereignisse: [{ id: 'e1', name: 'Umzug', einheit: 'privat', betrag: 400, monat: 2 }] })] });
    const pr = rechnePrivat(d, rechneUG(d, d.szenarien[0]), d.szenarien[0]);
    expect(pr[1].ereignisse).toBe(400); expect(pr[0].ereignisse).toBe(0);
  });
});

describe('Kennzahlen, Töpfe, Ziele', () => {
  it('kennzahlen(): Tiefpunkt und Monate im Minus', () => {
    const d = mini(); const ug = rechneUG(d, d.szenarien[0]); const kz = kennzahlen(ug, rechnePrivat(d, ug));
    expect(kz.minFrei).toBe(Math.min(...ug.map(u => u.frei)));
    expect(kz.monateMinus).toBe(ug.filter(u => u.frei < 0).length);
    expect(kz.freiDez26).toBe(ug[2].frei);
  });
  it('toepfeUG(): erst USt, dann Steuer, dann Reserve (n Monatskosten), der Rest ist frei', () => {
    const d = mini(); const t = toepfeUG(rechneUG(d, d.szenarien[0]), 1);
    expect(t[0]).toMatchObject({ steuer: 270, reserve: 0, frei: 1130, reserveZiel: 0 });
    expect(t[1].reserveZiel).toBe(2400);
    expect(t[1].reserve).toBe(0);
  });
  it('zielStaende(): erreicht-Monat und Status gegen das Zieldatum', () => {
    const d = mini({ privatEinnahmen: [zeile({ id: 'p.e.a', soll: 500 })], ziele: [{ id: 'g1', name: 'Polster', quelle: 'privat.angespart', ziel: 2000, bis: '2027-06', einheit: 'privat' }] });
    const ug = rechneUG(d, d.szenarien[0]); const [z] = zielStaende(d, ug, rechnePrivat(d, ug, d.szenarien[0]));
    expect(z.bisMonat).toBe(9);
    expect(z.erreichtMonat).toBe(2);
    expect(z.status).toBe('im Plan');
  });
});

describe('IST aus Buchungen', () => {
  const b = (id: string, d: string, betrag: number, z: string, n = 'Laden') => ({ id, d, b: betrag, n, k: 'gemeinsam', z });
  it('istHistorie(): Ausgaben je Zeile, Einnahmen, Offenes, Zähler', () => {
    const d = mini({ buchungen: [b('1', '2026-03-05', -50, 'p.b.a'), b('2', '2026-03-06', 2000, 'x.einnahme'), b('3', '2026-03-07', -30, 'x.offen'), b('4', '2026-04-01', -10, 'p.b.a'), b('5', '2026-04-02', -99, 'x.umbuchung')] });
    const h = istHistorie(d);
    expect(h.zeilen['p.b.a'][2]).toBe(50); expect(h.zeilen['p.b.a'][3]).toBe(10);
    expect(h.einnahmen[2]).toBe(2000); expect(h.offen[2]).toBe(30); expect(h.ausgaben[2]).toBe(80); expect(h.anzahl[2]).toBe(3);
    expect(h.umbuchung[3]).toBe(-99); expect(h.ausgaben[3]).toBe(10);
  });
  it('istSchnitt(): Durchschnitt der letzten k Monate bis zum Index', () => {
    expect(istSchnitt([0, 0, 50, 10], 2, 3)).toBe(30);
    expect(istSchnitt([0, 0, 50, 10], 3, 3)).toBe(20);
    expect(istSchnitt(undefined, 3, 3)).toBe(0);
  });
  it('lerneRegel(): Empfänger → Zeile, rückwirkend, unabhängig von Groß/Klein', () => {
    const d = mini({ buchungen: [b('1', '2026-03-05', -5, 'x.offen', 'REWE'), b('2', '2026-04-05', -6, 'x.offen', 'rewe'), b('3', '2026-04-06', -7, 'x.offen', 'Aldi')] });
    expect(lerneRegel(d, 'Rewe', 'p.b.lm')).toBe(2);
    expect(d.regeln.rewe).toBe('p.b.lm');
    expect(d.buchungen.map(x => x.z)).toEqual(['p.b.lm', 'p.b.lm', 'x.offen']);
  });
});

describe('Kalender, Tilgung, Tempo, Selbstständigkeit', () => {
  it('zahlungskalender(): nur Termine im Fenster ab heute, Fixkosten am Tag, Eingänge positiv', () => {
    const d = mini({ privatBudget: [zeile({ id: 'p.b.fix', soll: 300, typ: 'fix', tag: 5, name: 'Miete' })] });
    const ug = rechneUG(d, d.szenarien[0]); const t = zahlungskalender(d, ug, rechnePrivat(d, ug), 30);
    expect(t.find(x => x.text === 'Miete')).toMatchObject({ datum: '2026-10-05', betrag: -300, einheit: 'privat' });
    expect(t.find(x => x.text === 'Eingang One Banking')).toMatchObject({ datum: '2026-10-05', betrag: 1000, einheit: 'ug' });
    expect(t.some(x => x.text.startsWith('Gehälter'))).toBe(false); // Tag 28 liegt hinter dem 30-Tage-Fenster (endet 27.10.)
    expect(t.every(x => x.datum >= '2026-09-27' && x.datum <= '2026-10-27')).toBe(true);
  });
  it('tilgungsplan(): ohne Zins in Rest/Rate Monaten frei; Sondertilgung verkürzt; Zins kostet', () => {
    const s = { id: 's', name: 'Kredit', einheit: 'privat' as const, rest: 1200, rate: 100, zins: 0, start: 1, status: 'läuft' as const };
    const t = tilgungsplan(s, 0, 27);
    expect(t.frei).toBe(12); expect(t.monate[11]).toBe(0); expect(t.zinsen).toBe(0); expect(t.monate[0]).toBe(1100);
    expect(tilgungsplan(s, 100, 27).frei).toBe(6);
    const z = tilgungsplan({ ...s, rest: 1000, rate: 110, zins: 12 }, 0, 27);
    expect(z.monate[0]).toBeCloseTo(900);   // 1000 + 10 Zins − 110
    expect(z.zinsen).toBeGreaterThan(0);
    expect(z.frei).toBeGreaterThan(9);
    expect(tilgungsplan({ ...s, status: 'getilgt' }, 0, 3).frei).toBeNull();
    expect(tilgungsplan({ ...s, rest: 0 }, 0, 3).frei).toBe(0);
  });
  it('tempo(): Zeit- und Geldanteil, Prognose, Rest je Tag', () => {
    const t = tempo(50, 100, 15, 30);
    expect(t.anteilZeit).toBe(0.5); expect(t.anteilGeld).toBe(0.5); expect(t.prognose).toBe(100); expect(t.restProTag).toBeCloseTo(50 / 15);
    expect(tempo(0, 100, 0, 30).prognose).toBe(0);
    expect(tempo(120, 100, 30, 30).restProTag).toBe(0);
  });
  it('rechneSelbst(): Gewinn, zu versteuerndes Einkommen, offene Posten bestimmen das freie Geld', () => {
    const d = mini({ selbst: { posten: [{ id: 'a', name: 'Honorar', art: 'einnahme', betrag: 20000, status: 'bezahlt' }, { id: 'b', name: 'Offen', art: 'einnahme', betrag: 5000, status: 'offen' }, { id: 'c', name: 'Laptop', art: 'ausgabe', betrag: 2000, status: 'bezahlt' }, { id: 'd', name: 'Alt', art: 'ausgabe', betrag: 999, status: 'bezahlt', aus: true }], vorsorge: 3000, sonderausgaben: 0, sicherheit: 500, darlehenAnUG: 1000, consorsAbloesung: 200, kontoStart: 4000 } });
    const r = rechneSelbst(d);
    expect(r.ein).toBe(25000); expect(r.aus).toBe(2000); expect(r.gewinn).toBe(23000); expect(r.zve).toBe(20000); expect(r.est).toBe(1570);
    // finanzplan-5 (05.10., Kevin: kein Gesellschafterdarlehen): das Altfeld `darlehenAnUG` zählt nicht mehr — der Abschluss zieht nur Darlehen ab,
    // die die Selbstständigkeit laut Darlehensliste im Plan noch auszahlt (hier keins). Vorher 5.930 → 6.930. Gegenprüfung 05.10.: die Annahme
    // `darlehenKevin` hat keinen Geber im Plan mehr (außerhalb) — sie mindert den Abschluss nicht (finanzplan-5: −1.000).
    expect(r.darlehen).toBe(0);
    expect(r.frei).toBe(4000 + 5000 - 0 - 1570 - 500);
    expect(rechneSelbst({ ...d, annahmen: { ...d.annahmen, darlehenKevin: 1000, darlehenRueckMonat: 5 } }).frei).toBe(4000 + 5000 - 1570 - 500);
    expect(rechneSelbst({ ...d, darlehen: [{ id: 'x', name: 'x', geber: 'kdc', nehmer: 'ug', betrag: 1000, aus: 1, zurueck: 5 }] }).frei).toBe(4000 + 5000 - 1000 - 1570 - 500);
    expect(r.nachConsors).toBe(r.frei - 200);
  });
});
