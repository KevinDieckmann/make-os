// ─── Finanzplanung — Rechen-Prüfstand (Formel-Prüfung 05.10., Kevin: „alle Formeln wirklich überprüfen“) ─────────────
// Ein erfundener, realistischer Plan: Privat + MAKE Innovation GmbH (ug) + KD Ventures (kdv) + Selbstständigkeit (kdc), Gehälter,
// Fixkosten, Stelle, Ereignisse, Retainer mit Verzug, Produkte mit Zahlungsziel, USt-Durchlauf, KSt/Soli/GewSt, ESt mit GewSt-Freibetrag,
// Ausschüttung, Entnahme, Jahreskosten-Topf, Handwerte (allgemein, je Szenario, Umsatz mit Eingang, Steuer).
// Jede Erwartung ist VON HAND gerechnet (die Rechenwege stehen als Kommentar daneben) — der Rechenkern wird hier nie zum Nachrechnen
// benutzt, nur geprüft. Nur erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneSelbst, toepfeUG, zahlungskalender, kennzahlen } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, OperationUngueltig } from '../lib/finanzen/plan/operationen';
import { parseBetrag } from '../lib/finanzen/plan/hilfen';
import { pruefPlan } from './fixtures/finanz-plan';

const nah = (ist: number, soll: number, was: string) => expect(ist, was).toBeCloseTo(soll, 2);
/** Einkommensteuer-Grundtarif 2026, Zone 1/2 — unabhängig vom Kern nach § 32a EStG nachgeschrieben (nur für die Prüfwerte). */
const estZone2 = (zve: number) => { const x = Math.floor(zve); if (x <= 12348) return 0; const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); };
/** Grundtarif 2026, alle Zonen bis 277.825 € — unabhängig vom Kern nachgeschrieben (finanzplan-5: gemeinsame Einkommensteuer). */
const estHand = (zve: number) => {
  const x = Math.floor(Math.max(0, zve));
  if (x <= 12348) return 0;
  if (x <= 17799) return estZone2(x);
  if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  return Math.floor(0.42 * x - 11135.63);
};
/** Soli 2026 auf eine Einkommensteuer: 0 bis 20.350 €, darüber min(5,5 %, 11,9 % des Überschusses). */
const soliHand = (est: number) => (est <= 20350 ? 0 : Math.min(0.055 * est, 0.119 * (est - 20350)));

/** Satz Kapitalgesellschaft: KSt 15 % + Soli 5,5 % auf die KSt + Gewerbesteuer 3,5 % × 400 % = 29,825 %. */
const SATZ_UG = 0.15 + 0.15 * 0.055 + 0.035 * 4;

const mitPlan = (d: FinanzDaten, plan: Record<string, number>): FinanzDaten => ({ ...d, plan: { ...d.plan, ...plan } });
const lauf = (d: FinanzDaten) => rechneMit(d, d.planszenarien![0]);

describe('Prüfstand: MAKE Innovation GmbH, Monate 1–4 (Okt 26 – Jan 27) und Jahresende 2026', () => {
  const g = lauf(pruefPlan());
  const U = (m: number) => g.ug[m - 1];
  it('Okt 26: Umsatz 10.000 (Ankermandat), Kapital 25.000, Kosten 11.200, Ergebnis −1.200, Konto 23.800', () => {
    // Personal: (4.000 + 3.000) × 1,2 = 8.400; Sach 1.500 + 300 = 1.800; Gründung 1.000; Holding erst ab Nov → Kosten 11.200.
    nah(U(1).umsatz, 10000, 'umsatz'); nah(U(1).personal, 8400, 'personal'); nah(U(1).sach, 1800, 'sach'); nah(U(1).kosten, 11200, 'kosten');
    nah(U(1).gewinn, -1200, 'gewinn'); nah(U(1).ustEin, 0, 'ust (Ankermandat ohne USt, Retainer mit Verzug)');
    nah(U(1).einzahlungen, 35000, 'einzahlungen'); nah(U(1).auszahlungen, 11200, 'auszahlungen'); nah(U(1).konto, 23800, 'konto'); nah(U(1).frei, 23800, 'frei');
  });
  it('Nov 26: Retainer 2.000 und Produkt 1.000 sind Umsatz, kommen aber noch nicht an; Steuer auf das Jahr bis jetzt (1.100 × 29,825 %)', () => {
    nah(U(2).umsatz, 13000, 'umsatz'); nah(U(2).retainerEingang, 0, 'Retainer mit 1 Monat Verzug'); nah(U(2).bausteineEingang, 0, 'Produkt mit 2 Monaten Ziel');
    nah(U(2).kosten, 10700, 'kosten (Holding 500 ab Nov)'); nah(U(2).gewinn, 2300, 'gewinn');
    nah(U(2).steuerRuecklage, 1100 * SATZ_UG, 'rücklage 328,08'); nah(U(2).steuer, 0, 'gezahlt wird im Juni 27');
    nah(U(2).konto, 23800 + 10000 - 10700, 'konto 23.100'); nah(U(2).frei, 23100 - 1100 * SATZ_UG, 'frei');
  });
  it('Dez 26: Retainer kommt an (2.000 + 380 USt), Stelle und Messe; das Jahr endet mit −1.100 → keine Steuer, Rücklage 0', () => {
    nah(U(3).retainerEingang, 2000, 'retainer'); nah(U(3).ustEin, 380, 'ust'); nah(U(3).einzahlungen, 12380, 'einzahlungen');
    nah(U(3).stellen, 3600, 'stelle 3.000 × 1,2'); nah(U(3).einmalig, 1200, 'messe'); nah(U(3).kosten, 15200, 'kosten'); nah(U(3).gewinn, -2200, 'gewinn');
    nah(U(3).steuerRuecklage, 0, 'rücklage'); nah(U(3).st.summe, -1100 * SATZ_UG, 'aufwand wird zurückgenommen');
    nah(U(3).konto, 20280, 'konto'); nah(U(3).frei, 20280 - 380, 'frei (USt offen)');
  });
  it('Jan 27: Produkt-Eingang (1.000 + 190), USt-Zahlung Dez (380), Ausschüttung 1.000; Verlustvortrag 1.100 → keine Steuer', () => {
    nah(U(4).bausteineEingang, 1000, 'produkt'); nah(U(4).ustEin, 570, 'ust (2.000 + 1.000) × 19 %'); nah(U(4).einzahlungen, 13570, 'einzahlungen');
    nah(U(4).ustZahlung, 380, 'ust dez'); nah(U(4).ausschuettung, 1000, 'ausschüttung'); nah(U(4).auszahlungen, 15380, 'auszahlungen');
    nah(U(4).st.verlustvortrag, 1100, 'vortrag'); nah(U(4).steuerRuecklage, 0, 'rücklage');
    nah(U(4).konto, 18470, 'konto'); nah(U(4).frei, 17900, 'frei');
  });
  it('Juni 27 (Plan-Monat 9): Zahlung der Steuer 2026 = 0 (Verlustjahr)', () => { nah(U(9).steuer, 0, 'zahlung'); });
});

describe('Prüfstand: KD Ventures und Selbstständigkeit', () => {
  const g = lauf(pruefPlan());
  it('KD Ventures: Umlage hebt sich mit den Holdingkosten auf, Beratung 100/Monat ist der laufende Verlust (Vortrag 300 → 2027 keine Steuer)', () => {
    for (const [m, konto] of [[1, 9900], [2, 9800], [3, 9700], [4, 9600]] as const) { nah(g.ug[m - 1].kdvKonto, konto, `konto ${m}`); nah(g.ug[m - 1].kdvFrei, konto, `frei ${m}`); }
    nah(g.ug[1].kdvUmlage, 500, 'umlage'); nah(g.ug[1].kdvHolding, 500, 'holding'); nah(g.ug[3].kdvSt.verlustvortrag, 300, 'vortrag');
  });
  it('Selbstständigkeit: Umsatz 6.000 mit 1 Monat Ziel, Büro 200, Entnahme 2.000 ab Nov — Konto, USt, Entnahme wie vorher', () => {
    const K = (m: number) => g.kdc[m - 1];
    nah(K(1).gewinn, 5800, 'gewinn'); nah(K(1).eingang, 0, 'eingang erst Nov'); nah(K(1).konto, 7800, 'konto okt');
    nah(K(2).eingang, 6000, 'eingang'); nah(K(2).ustEin, 1140, 'ust'); nah(K(2).entnahme, 2000, 'entnahme'); nah(K(2).konto, 12740, 'konto nov');
    nah(K(3).ustZahlung, 1140, 'ust nov'); nah(K(3).konto, 16540, 'konto dez'); nah(K(4).konto, 20340, 'konto jan');
  });
  it('finanzplan-5: EINE Einkommensteuer 2026 über Abschluss Jan–Sep + Okt–Dez + Gehalt 1 — von Hand', () => {
    const K = (m: number) => g.kdc[m - 1];
    // Lohneinkünfte 2026: Gehalt 1 4.000 € × 3 (Okt–Dez, kevinAb 1) = 12.000 − 1.230 Pauschbetrag = 10.770 (Einzelveranlagung: Gehalt 2 zählt nicht).
    expect(g.lohn[2026]).toBe(10770);
    // Jahresanfang: Gewinn Jan–Sep 16.000 → zvE 26.770 → Zone 2: z = 0,8971 → 3.324,53 → 3.324; Lohn allein T(10.770) = 0 → Anteil Jan–Sep 3.324.
    expect(estHand(26770)).toBe(3324);
    // Okt: 21.800 → zvE 32.570 → 4.953 · Nov: 27.600 → 38.370 → 6.698; GewSt (27.600 − 24.500) × 3,5 % × 400 % = 434, voll angerechnet
    // Dez: 33.400 → 44.170 → 8.559; GewSt (33.400 − 24.500) × 3,5 % × 4 = 1.246, voll angerechnet; Soli: 8.559 − 1.246 < 20.350 → 0.
    expect(estHand(32570)).toBe(4953); expect(estHand(38370)).toBe(6698); expect(estHand(44170)).toBe(8559);
    nah(K(1).st.est, 4953 - 3324, 'ESt-Aufwand Okt'); nah(K(2).st.est, 6698 - 4953, 'Nov'); nah(K(3).st.est, 8559 - 6698, 'Dez');
    nah(K(2).st.gewst, 434, 'GewSt Nov'); nah(K(2).st.anrechnung, 434, 'Anrechnung Nov'); nah(K(3).st.gewst, 1246 - 434, 'GewSt Dez'); nah(K(3).st.soli, 0, 'Soli');
    nah(K(1).steuerRuecklage, 4953, 'Rücklage Okt (inkl. Jan–Sep)'); nah(K(3).steuerRuecklage, 8559, 'Rücklage Dez = Steuer 2026');
    nah(K(3).frei, 16540 - 8559 - 1140, 'frei dez'); nah(K(3).ergebnisNach, 5800 - (8559 - 6698), 'ergebnis nach Steuern Dez');
    nah(K(9).st.zahlung, 8559, 'Zahlung Juni 27 = EINE Steuer 2026'); nah(K(9).steuerRuecklage, K(8).steuerRuecklage + K(9).st.summe - 8559, 'Rücklage Juni = Mai + Aufwand Juni − Zahlung 2026');
    // Vorher (getrennt): Okt–Dez allein ESt auf 17.400 = 940, und die 21 € ESt auf Jan–Sep wurden in der Monatsachse nie gezahlt.
    expect(estZone2(17400)).toBe(940);
  });
  it('finanzplan-5: Einkommensteuer 2027 gemeinsam — Gewinn 69.600 + Lohneinkünfte 46.770 — von Hand', () => {
    const K = (m: number) => g.kdc[m - 1];
    expect(g.lohn[2027]).toBe(48000 - 1230);
    // zvE gesamt 116.370 → Zone 3: 0,42 × 116.370 − 11.135,63 = 37.739,77 → 37.739; Lohn allein T(46.770): z = 2,8971 → 9.432,03 → 9.432.
    const ges = estHand(69600 + 46770), lohn = estHand(46770);
    expect(ges).toBe(37739); expect(lohn).toBe(9432);
    // GewSt (69.600 − 24.500) × 3,5 % = 1.578,50 × 400 % = 6.314, voll angerechnet; Soli auf 37.739 − 6.314 = 31.425 → min(1.728,38; 11,9 % × 11.075 = 1.317,93) = 1.317,925.
    const soli = soliHand(ges - 6314) - soliHand(lohn);
    nah(soli, 1317.925, 'soli von Hand');
    const summe27 = 6314 + (ges - lohn) - 6314 + soli;   // 29.624,925
    nah(g.kdc.slice(3, 15).reduce((s, k) => s + k.st.summe, 0), summe27, 'Steuer 2027');
    nah(g.kdc.slice(3, 15).reduce((s, k) => s + k.st.est, 0), ges - lohn, 'Mehrsteuer 2027 = 28.307');
    nah(K(21).st.zahlung, summe27, 'Zahlung Juni 28');
  });
  it('Abschluss 2026 (Posten): Gewinn 16.000, ESt-Anteil Jan–Sep gemeinsam mit dem Gehalt, frei = Konto − offene Ausgaben − Steuer', () => {
    const ohneLohn = rechneSelbst(pruefPlan());
    nah(ohneLohn.gewinn, 16000, 'gewinn'); nah(ohneLohn.est, estZone2(16000), 'est ohne Gehalt (wie bis 05.10.)'); nah(ohneLohn.frei, 8000 - 4000 - estZone2(16000), 'frei');
    const a = rechneSelbst(g.d, undefined, g.lohn);
    nah(a.zve, 26770, 'zvE 16.000 + 10.770'); nah(a.est, 3324, 'ESt-Anteil Jan–Sep'); nah(a.steuer, 3324, 'ohne GewSt (16.000 < 24.500)'); nah(a.frei, 8000 - 4000 - 3324, 'frei');
  });
});

describe('Prüfstand: Privat, Töpfe, Gruppe (keine Doppelzählung)', () => {
  const g = lauf(pruefPlan());
  const P = (m: number) => g.pr[m - 1];
  it('Netto aus der Tabelle, Entnahme ab Nov, Ausschüttung netto ab Jan (1.000 − 26,4 %), Luft und Angespart', () => {
    nah(P(1).kevinNetto, 2600, 'kevin netto'); nah(P(1).malinNetto, 1950, 'malin netto (3.000 × 2.600/4.000)');
    nah(P(1).verfuegbar, 4550, 'verfügbar okt'); nah(P(2).verfuegbar, 6550, 'verfügbar nov (+ Entnahme)'); nah(P(4).verfuegbar, 7286, 'verfügbar jan (+ 736 Ausschüttung netto)');
    nah(P(1).bedarf, 3200, 'bedarf (2.000 + 800 + 100 + 300)'); nah(P(1).luft, 1100, 'luft okt'); nah(P(2).luft, 3100, 'luft nov'); nah(P(4).luft, 3286, 'luft jan (Umzug 800, Kredit vorbei)');
    nah(P(4).angespart, 1100 + 3100 + 3100 + 3286 + 4 * 300, 'angespart = Luft + Sparen');
    nah(P(3).toepfe['p.b.vers'], 300 - 1200, 'Topf Versicherung nach der Zahlung im Dezember');
  });
  it('Gruppe = MAKE frei + KD Ventures frei + Selbstständigkeit frei + Privat angespart — Gehalt, Entnahme und Ausschüttung zählen je einmal', () => {
    // Selbstständigkeit Jan 27: Konto 20.340 − Rücklage (Steuer 2026 8.559 + Jan 27: T(5.800 + 46.770) − T(46.770) = 11.462 − 9.432 = 2.030) − USt 1.140 = 8.611.
    expect(estHand(52570)).toBe(11462);
    nah(g.kdc[3].steuerRuecklage, 8559 + 2030, 'rücklage jan');
    nah(g.gruppe[3], 17900 + 9600 + (20340 - 10589 - 1140) + 11786, 'gruppe jan');
    // Entnahme: Selbstständigkeit −2.000, Privat +2.000; Ausschüttung: MAKE −1.000, Privat +736 (264 Steuer gehen hinaus); Gehälter: MAKE −8.400, Privat +4.550.
    nah(g.kdc[1].auszahlungen - g.kdc[1].kosten - g.kdc[1].ustZahlung - g.kdc[1].st.zahlung, 2000, 'entnahme genau einmal ab');
    nah(g.pr[3].ausschuettung + g.pr[3].ausschuettungSteuer, g.ug[3].ausschuettung, 'ausschüttung brutto = netto + steuer');
  });
  it('Töpfe MAKE Okt 26: Reserve-Ziel 2 × laufende Kosten (10.200), Reserve 20.400, frei 3.400', () => {
    const t = toepfeUG(g.ug, 2);
    nah(t[0].reserveZiel, 20400, 'ziel'); nah(t[0].reserve, 20400, 'reserve'); nah(t[0].frei, 3400, 'frei');
  });
  it('Lage (Stichtag Okt 26): frei verfügbar 23.800 + 9.900 + 2.847 + 1.100, Business 33.700, Privat-Bereich 3.947, Mindestumsatz 10.200', () => {
    const aw = auswertung(g.d, g.ug, g.pr, g.kdc);
    // Selbstständigkeit Okt: Konto 7.800 − Rücklage 4.953 (gemeinsame ESt 2026 bis Okt, inkl. Jan–Sep) = 2.847 (vorher 7.800 ohne Steuer auf Jan–Sep und ohne Progression).
    nah(aw.frei.kdc, 2847, 'selbstständigkeit');
    nah(aw.frei.gesamt, 23800 + 9900 + 2847 + 1100, 'gesamt'); nah(aw.mindestumsatz.jetzt, 10200, 'mindestumsatz');
    nah(aw.frei.business, 23800 + 9900, 'business = nur Gesellschaften'); nah(aw.frei.privatBereich, 1100 + 2847, 'privat-Bereich = Privat + Selbstständigkeit');
    nah(aw.steuer.ruecklageBusiness, aw.steuer.ruecklage + aw.steuer.ruecklageKdv, 'rücklage business');
    const ersterMinus = g.ug.findIndex(u => u.frei < -0.5);
    expect(aw.runway.ug).toBe(ersterMinus < 0 ? null : ersterMinus);   // Runway = Monate bis „frei“ unter null fällt
  });
});

describe('Prüfstand: Handwerte (Summe mit Eingang, Szenario, Steuer)', () => {
  it('Umsatz Nov von Hand 15.000 (+2.000): Eingang im selben Monat (Ziel 0) mit USt, Steuer auf 3.100', () => {
    const g = lauf(mitPlan(pruefPlan(), { 'ug.umsatz:2': 15000 }));
    nah(g.ug[1].einzahlungen, 12380, 'einzahlungen nov'); nah(g.ug[1].konto, 25480, 'konto nov'); nah(g.ug[1].steuerRuecklage, 3100 * SATZ_UG, 'rücklage');
    nah(g.ug[2].ustZahlung, 380, 'ust im Dezember'); nah(g.ug[2].steuerRuecklage, 900 * SATZ_UG, 'rücklage dez (Jahr 900)'); nah(g.ug[2].konto, 22280, 'konto dez');
  });
  it('Kontostand Jan nur im Szenario „Plan“ von Hand: das Szenario rechnet damit weiter, die Basis nicht', () => {
    const d = mitPlan(pruefPlan(), { 'ug.konto@ps1:4': 20000 });
    const g = lauf(d), b = rechneMit(d, null);
    nah(g.ug[3].konto, 20000, 'szenario'); expect(b.ug[3].konto).not.toBe(20000);
    nah(g.ug[4].konto - lauf(pruefPlan()).ug[4].konto, 20000 - 18470, 'Folgemonat rechnet vom Handwert weiter');
  });
  it('ESt-Aufwand Dez von Hand 1.500 (Formel 1.861): die Steuer 2026 sinkt um 361 → Rücklage und Zahlung Juni 27 8.198', () => {
    const g = lauf(mitPlan(pruefPlan(), { 'kdc.est:3': 1500 }));
    nah(g.kdc[2].steuerRuecklage, 8559 - 361, 'rücklage'); nah(g.kdc[8].st.zahlung, 8198, 'zahlung juni'); nah(g.kdc[2].frei, 16540 - 8198 - 1140, 'frei');
  });
  it('ESt-Anteil Jan–Sep von Hand (ab.est 4.000 statt 3.324): +676 in der Steuer 2026 der Monatsachse', () => {
    const g = lauf(mitPlan(pruefPlan(), { 'ab.est:0': 4000 }));
    nah(g.kdc[0].steuerRuecklage, 4953 + 676, 'rücklage okt'); nah(g.kdc[8].st.zahlung, 8559 + 676, 'zahlung juni 27');
  });
});

describe('Bedienwege', () => {
  it('Eingaben: Komma, Punkt, Tausender, Minus, Euro, Leer, Unsinn', () => {
    expect(parseBetrag('1.234,50')).toBe(1234.5); expect(parseBetrag('1.234')).toBe(1234); expect(parseBetrag('1234.5')).toBe(1234.5);
    expect(parseBetrag('-1.000')).toBe(-1000); expect(parseBetrag('2.500 €')).toBe(2500); expect(parseBetrag(' 0 ')).toBe(0);
    expect(parseBetrag('')).toBeNull(); expect(Number.isNaN(parseBetrag('zwölf'))).toBe(true); expect(parseBetrag('1.000.000')).toBe(1000000);
    expect(parseBetrag('1,234.50')).toBe(1234.5);   // englische Tausender (Fund 05.10.)
    expect(parseBetrag('12 %')).toBe(12);            // Prozentzeichen wird ignoriert (Fund 05.10.)
  });
  it('Monat 0 nur für Werte ohne Monat (Abschluss), Monats-Werte nie im Monat 0 (Fund 05.10.: wurde still angenommen und nie gerechnet)', () => {
    const d = pruefPlan();
    expect(() => wendeOperationenAn(d, [{ pfad: '/plan/ug.konto:0', neu: 1 }], 'kevin', '2026-10-05T00:00:00.000Z')).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, [{ pfad: '/plan/ug.s.miete:0', neu: 1 }], 'kevin', '2026-10-05T00:00:00.000Z')).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, [{ pfad: '/plan/ab.est:3', neu: 1 }], 'kevin', '2026-10-05T00:00:00.000Z')).toThrow(OperationUngueltig);
    expect(wendeOperationenAn(d, [{ pfad: '/plan/ab.est:0', neu: 1 }], 'kevin', '2026-10-05T00:00:00.000Z').dokument.plan['ab.est:0']).toBe(1);
  });
  it('Zahlungskalender: Retainer-Eingang mit dem eingestellten USt-Satz, auch Provision/Events/Umsatz von Hand/Holding (Fund 05.10.)', () => {
    const d = { ...pruefPlan(), annahmen: { ...pruefPlan().annahmen, ust: 0 }, einstellungen: { heute: '2026-11-01', reserveMonate: 1 } };
    const g = lauf(mitPlan(d, { 'ug.umsatz:2': 15000 }));
    const t = zahlungskalender(g.d, g.ug, g.pr, 70, g.kdc);
    const ret = t.find(x => x.text === 'Eingang Retainer' && x.datum.startsWith('2026-12'));
    expect(ret?.betrag).toBe(2000);   // vorher fest × 1,19 → 2.380, obwohl der Plan ohne USt rechnet
    expect(t.some(x => x.text === 'Eingang aus Umsatz von Hand' && x.betrag === 2000)).toBe(true);
    expect(t.some(x => x.text === 'Holding-Umlage an KD Ventures' && x.betrag === -500)).toBe(true);
  });
  it('Kennzahlen „Dez 28“ nehmen Monat 27 — auch wenn der Plan länger ist (Fund 05.10.: Gruppe und Privat nahmen den letzten Monat)', () => {
    const g = lauf(pruefPlan());
    const lang = [...g.pr, ...g.pr.slice(0, 3).map((p, i) => ({ ...p, m: 28 + i, angespart: 999999, luftKum: 999999 }))];
    const ug = [...g.ug, ...g.ug.slice(0, 3).map((u, i) => ({ ...u, m: 28 + i }))];
    const kz = kennzahlen(ug, lang, g.kdc);
    expect(kz.privatKumDez28).toBe(g.pr[26].luftKum);
    expect(kz.gruppeDez28).toBeCloseTo(g.ug[26].frei + g.ug[26].kdvFrei + g.kdc[26].frei + g.pr[26].angespart, 6);
  });
});

describe('Funde mit Formel-Korrektur (05.10.)', () => {
  it('Gehalt 2 vor der GmbH läuft über die Selbstständigkeit: Privat bekommt das Netto UND die Selbstständigkeit trägt die Kosten (vorher Geld aus dem Nichts)', () => {
    const d = { ...pruefPlan(), annahmen: { ...pruefPlan().annahmen, malinAb: 3 } };
    const g = lauf(d), v = lauf(pruefPlan());
    nah(g.pr[0].malinNetto, 1950, 'netto okt aus der Selbstständigkeit');
    nah(g.kdc[0].malinBrutto, 3000, 'brutto in der Selbstständigkeit'); nah(g.kdc[0].personal, 3600, 'mit Arbeitgeberanteil');
    nah(g.kdc[0].konto, 7800 - 3600, 'konto okt'); nah(g.kdc[2].malinBrutto, 0, 'ab Dez in der GmbH');
    nah(g.ug[0].malinBrutto, 0, 'GmbH zahlt Gehalt 2 erst ab Dez');
    // Gruppe: das Netto (1.950) kommt privat an, die Kosten (3.600) trägt jetzt die Selbstständigkeit statt niemand — Privat unverändert.
    nah(g.pr[0].verfuegbar, v.pr[0].verfuegbar, 'privat gleich'); nah(g.kdc[0].konto - v.kdc[0].konto, -3600, 'Selbstständigkeit −3.600');
  });
  it('Soli auf die Einkommensteuer über der Freigrenze 20.350 € (gemildert), darunter 0; Freigrenze als Feld, leer = Vorgabe', async () => {
    const { jahresSteuer, estTarif } = await import('../lib/finanzen/ertragsteuer');
    const p = { form: 'einzel' as const, kstAn: true, kst: 0.15, soliAn: true, soli: 0.055, gewstAn: false, messzahl: 0.035, hebesatz: 400, estAn: true, tarif: (await import('../lib/finanzen/ertragsteuer')).TARIF_2026, estAbzug: 0, freibetrag: 24500, anrechnung: 0, verlustvortrag: true, zahlweise: 'folgejahr' as const, zahlMonat: 6 };
    expect(jahresSteuer(p, 60000).soli).toBe(0);                         // ESt ≈ 15.9 T€ < Freigrenze
    const est = estTarif(90000);                                          // ESt ≈ 26,4 T€
    const soli = jahresSteuer(p, 90000).soli;
    expect(soli).toBeCloseTo(Math.min(0.055 * est, 0.119 * (est - 20350)), 6);
    expect(jahresSteuer(p, 300000).soli).toBeCloseTo(0.055 * estTarif(300000), 6);   // voller Satz weit über der Grenze
    expect(jahresSteuer({ ...p, soliFreigrenze: 0 }, 60000).soli).toBeCloseTo(Math.min(0.055 * estTarif(60000), 0.119 * estTarif(60000)), 6);
    const { steuerParameter } = await import('../lib/finanzen/steuern');
    const d = pruefPlan();
    expect(steuerParameter(d, 'kdc').soliFreigrenze).toBe(20350);
    expect(steuerParameter({ ...d, steuern: { ...d.steuern, kdc: { ...d.steuern!.kdc, param: { soliFreigrenze: 1000 } } } }, 'kdc').soliFreigrenze).toBe(1000);
  });
});

describe('Prüfstand finanzplan-5: Darlehen hin und zurück (Geber und Nehmer frei, die Rückzahlung kommt beim Geber an)', () => {
  const basis = lauf(pruefPlan());
  it('Privat → KD Ventures 1.500, vor Planbeginn ausgezahlt, zurück im Feb 27 (Monat 5): KD Ventures −1.500, Privat +1.500, Gruppe gleich', () => {
    const d = { ...pruefPlan(), darlehen: [{ id: 'dl-1', name: 'Privat an KD Ventures', geber: 'privat' as const, nehmer: 'kdv' as const, betrag: 1500, aus: 0, zurueck: 5 }] };
    const g = lauf(d);
    for (let m = 1; m <= 4; m++) nah(g.ug[m - 1].kdvKonto, basis.ug[m - 1].kdvKonto, `kdv vor der Rückzahlung ${m}`);
    nah(g.ug[4].kdvDarlehenAus, 1500, 'kdv zahlt zurück'); nah(g.ug[4].kdvKonto, basis.ug[4].kdvKonto - 1500, 'kdv konto feb');
    nah(g.pr[4].darlehenEin, 1500, 'privat bekommt zurück'); nah(g.pr[4].luft, basis.pr[4].luft + 1500, 'luft feb'); nah(g.pr[26].angespart, basis.pr[26].angespart + 1500, 'angespart');
    g.gruppe.forEach((x, i) => nah(x, basis.gruppe[i], `gruppe ${i + 1}`));
    for (let m = 1; m <= 27; m++) nah(g.ug[m - 1].kdvGewinn, basis.ug[m - 1].kdvGewinn, `kein Ergebnis ${m}`);
    const t = zahlungskalender({ ...g.d, einstellungen: { heute: '2027-02-01', reserveMonate: 1 } }, g.ug, g.pr, 30, g.kdc);
    expect(t.filter(x => x.text.startsWith('Darlehen')).map(x => [x.einheit, x.betrag])).toEqual([['kdv', -1500], ['privat', 1500]]);
  });
  it('Selbstständigkeit → MAKE 2.000 im Nov 26 (Monat 2), zurück im Mrz 27 (Monat 6): beide Konten hin und zurück, Steuern unverändert', () => {
    const d = { ...pruefPlan(), darlehen: [{ id: 'dl-2', name: 'Anschub', geber: 'kdc' as const, nehmer: 'ug' as const, betrag: 2000, aus: 2, zurueck: 6 }] };
    const g = lauf(d);
    nah(g.kdc[1].darlehenAus, 2000, 'kdc zahlt aus'); nah(g.ug[1].darlehenEin, 2000, 'ug erhält');
    for (let m = 2; m <= 5; m++) { nah(g.kdc[m - 1].konto, basis.kdc[m - 1].konto - 2000, `kdc ${m}`); nah(g.ug[m - 1].konto, basis.ug[m - 1].konto + 2000, `ug ${m}`); }
    nah(g.ug[5].darlehen, 2000, 'ug zahlt zurück'); nah(g.kdc[5].darlehenEin, 2000, 'kdc bekommt zurück');
    for (let m = 6; m <= 27; m++) { nah(g.kdc[m - 1].konto, basis.kdc[m - 1].konto, `kdc ${m}`); nah(g.ug[m - 1].konto, basis.ug[m - 1].konto, `ug ${m}`); }
    g.gruppe.forEach((x, i) => nah(x, basis.gruppe[i], `gruppe ${i + 1}`));
    g.ug.forEach((u, i) => nah(u.steuerRuecklage, basis.ug[i].steuerRuecklage, `steuer ug ${i + 1}`));
    // Abschluss: das Darlehen geht noch hinaus → frei nach Abschluss −2.000.
    nah(rechneSelbst(g.d, undefined, g.lohn).darlehen, 2000, 'abschluss darlehen');
  });
  it('Altes Gesellschafterdarlehen (Annahme 3.000, zurück Monat 14): Geber außerhalb des Plans — Selbstständigkeit und Privat unberührt (Gegenprüfung 05.10.)', () => {
    // finanzplan-5 hatte den Geber als Selbstständigkeit gedeutet (−3.000 dort im Okt 26). Kevin: „Es gibt kein Gesellschafterdarlehen“ — das Feld
    // bleibt nur für ein echtes Darlehen von außen: hinein in die GmbH, zurück nach außen; die Gruppe hat das Geld so lange (wie vor finanzplan-5).
    const d = { ...pruefPlan(), annahmen: { ...pruefPlan().annahmen, darlehenKevin: 3000, darlehenRueckMonat: 14 } };
    const g = lauf(d);
    nah(g.ug[0].kapital, 25000 + 3000, 'ug okt (Stammkapital + Darlehen)'); nah(g.kdc[0].darlehenAus, 0, 'kdc zahlt nichts aus');
    nah(g.ug[13].darlehen, 3000, 'ug zahlt zurück'); nah(g.kdc[13].darlehenEin, 0, 'kdc bekommt nichts');
    g.kdc.forEach((k, i) => nah(k.konto, basis.kdc[i].konto, `kdc ${i + 1}`));
    g.gruppe.forEach((x, i) => nah(x, basis.gruppe[i] + (i + 1 < 14 ? 3000 : 0), `gruppe ${i + 1} (von außen hinein, im Monat 14 hinaus)`));
  });
  it('Säuberer: Geber = Nehmer oder unbekannte Seite → abgelehnt; Rückzahlung vor Auszahlung → offen', () => {
    const d = pruefPlan();
    expect(() => wendeOperationenAn(d, [{ pfad: '/darlehen/-', neu: { id: 'dl-x', name: 'x', geber: 'ug', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0 } }], 'kevin', '2026-10-05T00:00:00.000Z')).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, [{ pfad: '/darlehen/-', neu: { id: 'dl-x', name: 'x', geber: 'bank', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0 } }], 'kevin', '2026-10-05T00:00:00.000Z')).toThrow(OperationUngueltig);
    const r = wendeOperationenAn(d, [{ pfad: '/darlehen/-', neu: { id: 'dl-y', name: 'y', geber: 'extern', nehmer: 'kdv', betrag: 1000.004, aus: 5, zurueck: 3 } }], 'kevin', '2026-10-05T00:00:00.000Z').dokument;
    expect(r.darlehen).toEqual([{ id: 'dl-y', name: 'y', geber: 'extern', nehmer: 'kdv', betrag: 1000, aus: 5, zurueck: 0 }]);
  });
});

describe('Prüfstand finanzplan-5: Business-Sicht ohne Selbstständigkeit, Ankermandat ohne USt (Absicht)', () => {
  it('Business-Sicht: MAKE und KD Ventures exakt wie in der vollen Sicht; keine Selbstständigkeit im Dokument; Termine ohne Selbstständigkeit', async () => {
    const { businessSicht, nurBusinessTermine, kennungIstBusiness, businessPfadErlaubt } = await import('../lib/finanzen/plan/sicht');
    const d = pruefPlan(), b = businessSicht(d);
    const voll = lauf(d), bus = lauf(b);
    expect(JSON.stringify(bus.ug)).toBe(JSON.stringify(voll.ug));
    expect(b.sachkosten.map(z => z.id)).toEqual(['ug.s.miete', 'ug.s.tool']);
    expect(b.planszenarien![0].bausteine.map(x => x.id)).toEqual(['u1', 'st', 'kv']);
    expect(b.steuern?.kdc).toBeUndefined(); expect(b.selbst.posten).toEqual([]);
    expect(kennungIstBusiness('kdc.konto', d)).toBe(false); expect(kennungIstBusiness('ab.est', d)).toBe(false); expect(kennungIstBusiness('ug.s.kdc', d)).toBe(false);
    expect(businessPfadErlaubt('/selbst/vorsorge', d, 1)).not.toBeNull();
    expect(businessPfadErlaubt('/plan/kdc.konto:3', d, 1)).not.toBeNull();
    expect(businessPfadErlaubt('/steuern/kdc/param/veranlagung', d, 'zusammen')).not.toBeNull();
    const t = nurBusinessTermine(zahlungskalender({ ...voll.d, einstellungen: { heute: '2026-10-01', reserveMonate: 1 } }, voll.ug, voll.pr, 90, voll.kdc));
    expect(t.length).toBeGreaterThan(0); expect(t.some(x => x.einheit === 'selbststaendigkeit' || x.einheit === 'privat')).toBe(false);
  });
  it('Ankermandat ohne USt ist Absicht (Kevin 05.10.): Okt 26 Einzahlung 35.000 = Kapital 25.000 + Ankermandat 10.000 netto, USt 0', () => {
    const g = lauf(pruefPlan());
    nah(g.ug[0].ob, 10000, 'ankermandat'); nah(g.ug[0].ustEin, 0, 'keine USt auf das Ankermandat'); nah(g.ug[0].einzahlungen, 35000, 'einzahlungen');
  });
});
