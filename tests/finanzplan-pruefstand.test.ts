// ─── Finanzplanung — Rechen-Prüfstand (Formel-Prüfung 05.10., Kevin: „alle Formeln wirklich überprüfen“) ─────────────
// Ein erfundener, realistischer Plan: Privat + MAKE Innovation GmbH (ug) + KD Ventures (kdv) + Selbstständigkeit (kdc), Gehälter,
// Fixkosten, Stelle, Ereignisse, Retainer mit Verzug, Produkte mit Zahlungsziel, USt-Durchlauf, KSt/Soli/GewSt, ESt mit GewSt-Freibetrag,
// Ausschüttung, Entnahme, Jahreskosten-Topf, Handwerte (allgemein, je Szenario, Umsatz mit Eingang, Steuer).
// Jede Erwartung ist VON HAND gerechnet (die Rechenwege stehen als Kommentar daneben) — der Rechenkern wird hier nie zum Nachrechnen
// benutzt, nur geprüft. Nur erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneSelbst, toepfeUG, zahlungskalender, kennzahlen } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung, neuesPlanszenario, neuerBaustein, type Planszenario } from '../lib/finanzen/szenarien';
import { leeresDokument, wendeOperationenAn, OperationUngueltig } from '../lib/finanzen/plan/operationen';
import { parseBetrag } from '../lib/finanzen/plan/hilfen';

const nah = (ist: number, soll: number, was: string) => expect(ist, was).toBeCloseTo(soll, 2);
/** Einkommensteuer-Grundtarif 2026, Zone 1/2 — unabhängig vom Kern nach § 32a EStG nachgeschrieben (nur für die Prüfwerte). */
const estZone2 = (zve: number) => { const x = Math.floor(zve); if (x <= 12348) return 0; const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); };

/** Satz Kapitalgesellschaft: KSt 15 % + Soli 5,5 % auf die KSt + Gewerbesteuer 3,5 % × 400 % = 29,825 %. */
const SATZ_UG = 0.15 + 0.15 * 0.055 + 0.035 * 4;

function pruefPlan(): FinanzDaten {
  const d = leeresDokument('2026-10-01');
  d.annahmen = {
    ...d.annahmen, kevinBrutto: 4000, kevinAb: 1, malinBrutto: 3000, malinAb: 1, agAnteil: 0.2, stammkapital: 25000, gruendungskosten: 1000,
    darlehenKevin: 0, darlehenRueckMonat: 0, retainerVerzug: 1, astarnaProvision: 0, steuerUG: 0.3, ust: 0.19, steuerMonat: 6,
    holdingKosten: 500, holdingAb: 2, kdvStart: 10000, exitSteuer: 0.25, nettoTabelle: [[0, 0], [4000, 2600], [8000, 4800]], gehaltTag: 28,
  };
  d.steuern = {
    ug: { rechtsform: 'kapital', zeilen: { kst: { satz: 0.15 }, soli: { satz: 0.055 }, gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6 } },
    kdv: { rechtsform: 'kapital', zeilen: { kst: { satz: 0.15 }, soli: { satz: 0.055 }, gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6 } },
    kdc: { rechtsform: 'einzel', zeilen: { gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6, freibetrag: 24500, anrechnung: 4 } },
  };
  d.szenarien = [{ id: 'basis', name: 'Basis', ob: { betrag: 10000, start: 1, laufzeit: 99 }, retainer: [{ betrag: 2000, start: 2, laufzeit: 99 }], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 },
    erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 50000, monat: 13 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false,
    ereignisse: [{ id: 'e1', name: 'Messe', einheit: 'ug', betrag: 1200, monat: 3 }, { id: 'e2', name: 'Umzug', einheit: 'privat', betrag: 800, monat: 4 }] }];
  d.sachkosten = [
    { id: 'ug.s.miete', name: 'Miete', einheit: 'ug', gruppe: 'Räume', soll: 1500, ab: 1 },
    { id: 'ug.s.tool', name: 'Software', einheit: 'ug', gruppe: 'Tools', soll: 300, ab: 1, bis: 2 },
    { id: 'ug.s.kdc', name: 'Büro Selbstständigkeit', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 200, ab: 1 },
  ];
  d.privatBudget = [
    { id: 'p.b.miete', name: 'Miete', einheit: 'privat', gruppe: 'Fixkosten', soll: 2000, typ: 'fix', tag: 3 },
    { id: 'p.b.essen', name: 'Essen', einheit: 'privat', gruppe: 'Flexibel', soll: 800, typ: 'flex' },
    { id: 'p.b.vers', name: 'Versicherung', einheit: 'privat', gruppe: 'Jahreskosten & Puffer', soll: 100, typ: 'jahr', jahresbetrag: 1200, faellig: [12] },
    { id: 'p.b.spar', name: 'Rücklage', einheit: 'privat', gruppe: 'Sparen', soll: 300, typ: 'sparen' },
  ];
  d.privatSchulden = [{ id: 'p.d.kredit', name: 'Kredit', einheit: 'privat', gruppe: 'Schulden', soll: 250, ab: 1, bis: 3, tag: 5 }];
  d.selbst = { posten: [{ id: 'sp1', name: 'Honorar', art: 'einnahme', betrag: 20000, status: 'bezahlt' }, { id: 'sp2', name: 'Kosten', art: 'ausgabe', betrag: 4000, status: 'offen' }], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 8000 };
  const ps: Planszenario = {
    ...neuesPlanszenario('ps1', 'Plan', 'basis', '2026-10-01T00:00:00.000Z'),
    bausteine: [
      neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 6000, start: 1, zahlungsziel: 1 }),
      neuerBaustein('u1', { art: 'umsatz', einheit: 'ug', name: 'Produkt', preis: 1000, start: 2, zahlungsziel: 2 }),
      neuerBaustein('st', { art: 'kosten', einheit: 'ug', kostenArt: 'stelle', name: 'Assistenz', preis: 3000, start: 3 }),
      neuerBaustein('kv', { art: 'kosten', einheit: 'kdv', kostenArt: 'sonstiges', name: 'Beratung', preis: 100, start: 1 }),
    ],
    annahmen: { ausschuettung: { betrag: 1000, ab: 4 }, entnahme: { betrag: 2000, ab: 2 }, zahlungsziel: 0 },
  };
  return { ...d, planszenarien: [ps], arbeitsplan: 'ps1', plan: {} };
}
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
  it('Selbstständigkeit: Umsatz 6.000 mit 1 Monat Ziel, Büro 200, ESt auf 17.400 (Okt–Dez) = Grundtarif, GewSt unter Freibetrag 0, Entnahme 2.000 ab Nov', () => {
    const K = (m: number) => g.kdc[m - 1];
    nah(K(1).gewinn, 5800, 'gewinn'); nah(K(1).eingang, 0, 'eingang erst Nov'); nah(K(1).konto, 7800, 'konto okt');
    nah(K(2).eingang, 6000, 'eingang'); nah(K(2).ustEin, 1140, 'ust'); nah(K(2).entnahme, 2000, 'entnahme'); nah(K(2).konto, 12740, 'konto nov');
    nah(K(3).st.est, estZone2(17400), 'ESt 2026 auf 17.400'); nah(K(3).st.gewst, 0, 'GewSt unter 24.500'); nah(K(3).steuerRuecklage, estZone2(17400), 'rücklage');
    nah(K(3).ustZahlung, 1140, 'ust nov'); nah(K(3).konto, 16540, 'konto dez'); nah(K(3).frei, 16540 - estZone2(17400) - 1140, 'frei dez');
    nah(K(4).konto, 20340, 'konto jan'); nah(K(4).steuerRuecklage, estZone2(17400), 'rücklage bleibt bis zur Zahlung');
    nah(K(9).st.zahlung, estZone2(17400), 'Zahlung Juni 27');
    nah(K(3).ergebnisNach, 5800 - estZone2(17400), 'ergebnis nach steuern');
  });
  it('Abschluss 2026 (Posten): Gewinn 16.000, ESt nach Grundtarif, frei = Konto − offene Ausgaben − ESt', () => {
    const a = rechneSelbst(pruefPlan());
    nah(a.gewinn, 16000, 'gewinn'); nah(a.est, estZone2(16000), 'est'); nah(a.frei, 8000 - 4000 - estZone2(16000), 'frei');
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
    nah(g.gruppe[3], 17900 + 9600 + (20340 - estZone2(17400) - 1140) + 11786, 'gruppe jan');
    // Entnahme: Selbstständigkeit −2.000, Privat +2.000; Ausschüttung: MAKE −1.000, Privat +736 (264 Steuer gehen hinaus); Gehälter: MAKE −8.400, Privat +4.550.
    nah(g.kdc[1].auszahlungen - g.kdc[1].kosten - g.kdc[1].ustZahlung - g.kdc[1].st.zahlung, 2000, 'entnahme genau einmal ab');
    nah(g.pr[3].ausschuettung + g.pr[3].ausschuettungSteuer, g.ug[3].ausschuettung, 'ausschüttung brutto = netto + steuer');
  });
  it('Töpfe MAKE Okt 26: Reserve-Ziel 2 × laufende Kosten (10.200), Reserve 20.400, frei 3.400', () => {
    const t = toepfeUG(g.ug, 2);
    nah(t[0].reserveZiel, 20400, 'ziel'); nah(t[0].reserve, 20400, 'reserve'); nah(t[0].frei, 3400, 'frei');
  });
  it('Lage (Stichtag Okt 26): frei verfügbar 23.800 + 9.900 + 7.800 + 1.100, Mindestumsatz 10.200', () => {
    const aw = auswertung(g.d, g.ug, g.pr, g.kdc);
    nah(aw.frei.gesamt, 23800 + 9900 + 7800 + 1100, 'gesamt'); nah(aw.mindestumsatz.jetzt, 10200, 'mindestumsatz');
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
  it('ESt Dez von Hand 1.500: Rücklage 1.500, Zahlung Juni 27 1.500', () => {
    const g = lauf(mitPlan(pruefPlan(), { 'kdc.est:3': 1500 }));
    nah(g.kdc[2].steuerRuecklage, 1500, 'rücklage'); nah(g.kdc[8].st.zahlung, 1500, 'zahlung juni'); nah(g.kdc[2].frei, 16540 - 1500 - 1140, 'frei');
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
