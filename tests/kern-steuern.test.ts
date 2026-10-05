// ─── Kern-Umbau 02.10. — Steuern einzeln, Selbstständigkeit eigene Achse (erfundene Zahlen, von Hand nachgerechnet) ──
// Kevin hat am 02.10. entschieden, den Rechenkern zu ändern: (1) Ertragsteuern einzeln (KSt, Soli, Gewerbesteuer, Einkommensteuer, Anrechnung),
// (2) Selbstständigkeit mit eigener Monatsachse, (3) Einkommensteuer nach echtem Grundtarif, (4) `ruecklage5a`/`notgroschenMonate` gelöscht.
// Und: „Mir ist wichtig, dass ich alles anpassen kann“ — jeder neue Parameter ist ein Feld mit Vorgabe: ein geänderter Parameter wirkt,
// ein geleerter wirkt wie die Vorgabe (letzter Block).
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { est2026, jahrVon, kalMonat, rechneSelbstAchse } from '../lib/finanzen/rechenkern';
import {
  estTarif, jahresSteuer, neuerSteuerrechner, TARIF_2026, gesamtquote, type Steuerparameter,
} from '../lib/finanzen/ertragsteuer';
import { rechneMit, auswertung, neuesPlanszenario, neuerBaustein, pruefeBaustein, type Planszenario } from '../lib/finanzen/szenarien';
import { steuerOps, steuerParameter, type SteuerAenderung, type SteuerBereich } from '../lib/finanzen/steuern';
import { geschaeftsblatt } from '../lib/finanzen/geschaeft';
import { leeresDokument, wendeOperationenAn, pruefeDokument } from '../lib/finanzen/plan/operationen';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

const JETZT = '2026-10-02T10:00:00.000Z';
const an = (d: FinanzDaten, ops: Parameters<typeof wendeOperationenAn>[1]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;
const nah = (a: number, b: number, n = 6) => expect(a).toBeCloseTo(b, n);

/** Parameter einer Kapitalgesellschaft mit runden Vorgaben (400 % Hebesatz) — für Rechenbeispiele von Hand. */
const kap = (teil: Partial<Steuerparameter> = {}): Steuerparameter => ({
  form: 'kapital', kstAn: true, kst: 0.15, soliAn: true, soli: 0.055, gewstAn: true, messzahl: 0.035, hebesatz: 400, estAn: true, tarif: TARIF_2026, estAbzug: 0,
  freibetrag: 24500, anrechnung: 4, verlustvortrag: true, zahlweise: 'folgejahr', zahlMonat: 6, ...teil,
});
const einz = (teil: Partial<Steuerparameter> = {}): Steuerparameter => kap({ form: 'einzel', ...teil });

describe('Einkommensteuer nach Grundtarif (Eckwerte einstellbar, Vorgabe 2026)', () => {
  it('Vorgabe = der bisherige est2026 an allen Zonengrenzen', () => {
    for (const x of [-5, 0, 12348, 12349, 15000, 17799, 17800, 30000, 69878, 69879, 120000, 277825, 277826, 400000]) expect(estTarif(x)).toBe(est2026(x));
  });
  it('von Hand: zvE 30.000 € → Zone 2: z = 1,2201; (173,10·z + 2.397)·z + 1.034,87', () => {
    const z = (30000 - 17799) / 10000;
    expect(estTarif(30000)).toBe(Math.floor((173.10 * z + 2397) * z + 1034.87));
    expect(estTarif(100000)).toBe(Math.floor(0.42 * 100000 - 11135.63));   // 30.864
    expect(estTarif(300000)).toBe(Math.floor(0.45 * 300000 - 19470.38));
  });
  it('geänderte Eckwerte wirken: höherer Grundfreibetrag, anderer Spitzensatz', () => {
    expect(estTarif(15000)).toBeGreaterThan(0);
    expect(estTarif(15000, { ...TARIF_2026, grundfreibetrag: 20000, zone2Ende: 25000 })).toBe(0);
    expect(estTarif(100000, { ...TARIF_2026, satz3: 0.5 })).toBe(Math.floor(0.5 * 100000 - 11135.63));
  });
});

describe('Kapitalgesellschaft: KSt 15 % + Soli 5,5 % auf die KSt + Gewerbesteuer (Messzahl 3,5 % × Hebesatz)', () => {
  it('Gewinn 100.000 €, Hebesatz 400 % → KSt 15.000, Soli 825, GewSt 14.000, zusammen 29.825', () => {
    const s = jahresSteuer(kap(), 100000);
    nah(s.kst, 15000); nah(s.soli, 825); nah(s.gewst, 14000); nah(s.summe, 29825);
    expect(s.est).toBe(0);
    nah(gesamtquote(kap()), 0.29825, 12);
  });
  it('jede Zahl ist ein Parameter: KSt-Satz, Soli, Messzahl, Hebesatz, einzelne Zeilen aus', () => {
    nah(jahresSteuer(kap({ kst: 0.2 }), 100000).kst, 20000); nah(jahresSteuer(kap({ kst: 0.2 }), 100000).soli, 1100);
    nah(jahresSteuer(kap({ soli: 0 }), 100000).soli, 0);
    nah(jahresSteuer(kap({ messzahl: 0.04 }), 100000).gewst, 16000);
    nah(jahresSteuer(kap({ hebesatz: 500 }), 100000).gewst, 17500);
    nah(jahresSteuer(kap({ gewstAn: false }), 100000).summe, 15825);
    const ohneKst = jahresSteuer(kap({ kstAn: false }), 100000);
    nah(ohneKst.kst, 0); nah(ohneKst.soli, 0); nah(ohneKst.summe, 14000);          // Soli gibt es nur mit KSt
    nah(jahresSteuer(kap({ soliAn: false }), 100000).summe, 29000);
  });
  it('Verlust: kein Gewinn, keine Steuer', () => {
    expect(jahresSteuer(kap(), -20000).summe).toBe(0); expect(jahresSteuer(kap(), 0).summe).toBe(0);
  });
  it('Verlustvortrag mindert den Gewinn (an) — oder nicht (aus)', () => {
    nah(jahresSteuer(kap(), 50000, 30000).kst, 3000);                 // (50.000 − 30.000) × 15 %
    nah(jahresSteuer(kap(), 50000, 30000).summe, 20000 * 0.29825);
    nah(jahresSteuer(kap(), 50000, 80000).summe, 0);                  // Vortrag größer als der Gewinn
    nah(jahresSteuer(kap({ verlustvortrag: false }), 50000, 30000).kst, 7500);
  });
  it('Soli hängt nur an der KSt: bei KSt-Satz 0 kein Soli, auch wenn der Soli-Satz gesetzt ist', () => {
    const s = jahresSteuer(kap({ kst: 0 }), 100000); nah(s.soli, 0); nah(s.summe, 14000);
  });
});

describe('Einzelunternehmen: Einkommensteuer, Gewerbesteuer mit Freibetrag, Anrechnung nach § 35 EStG', () => {
  it('Gewinn 60.000 €, Hebesatz 400 %: Messbetrag (60.000 − 24.500) × 3,5 % = 1.242,50; GewSt 4.970; Anrechnung 4 × 1.242,50 = 4.970 → Netto = ESt', () => {
    const s = jahresSteuer(einz(), 60000);
    nah(s.gewst, 4970); expect(s.est).toBe(estTarif(60000)); nah(s.anrechnung, 4970); nah(s.summe, estTarif(60000));
  });
  it('Hebesatz 500 %: GewSt 6.212,50, angerechnet nur 4.970 → 1.242,50 Mehrbelastung', () => {
    const s = jahresSteuer(einz({ hebesatz: 500 }), 60000);
    nah(s.gewst, 6212.5); nah(s.anrechnung, 4970); nah(s.summe, estTarif(60000) + 1242.5);
  });
  it('Freibetrag: bis 24.500 € keine Gewerbesteuer; ein anderer Freibetrag wirkt', () => {
    expect(jahresSteuer(einz(), 24000).gewst).toBe(0);
    nah(jahresSteuer(einz({ freibetrag: 0 }), 24000).gewst, 24000 * 0.035 * 4);
    expect(jahresSteuer(einz({ freibetrag: 100000 }), 60000).gewst).toBe(0);
  });
  it('Anrechnung: Faktor 0 = keine; gedeckelt durch die Einkommensteuer', () => {
    nah(jahresSteuer(einz({ anrechnung: 0 }), 60000).summe, estTarif(60000) + 4970);
    const klein = jahresSteuer(einz({ freibetrag: 0, hebesatz: 900 }), 14000);   // ESt (14.000 − 0) ist klein, GewSt groß
    expect(klein.anrechnung).toBeLessThanOrEqual(klein.est + 1e-9);
    expect(klein.summe).toBeGreaterThanOrEqual(0);
  });
  it('Abzüge (Vorsorge, Sonderausgaben) mindern nur die Einkommensteuer, nicht die Gewerbesteuer', () => {
    const s = jahresSteuer(einz({ estAbzug: 10000 }), 60000);
    expect(s.est).toBe(estTarif(50000)); nah(s.gewst, 4970);
  });
  it('Einkommensteuer aus: nur Gewerbesteuer ohne Anrechnung', () => {
    const s = jahresSteuer(einz({ estAn: false }), 60000);
    expect(s.est).toBe(0); expect(s.anrechnung).toBe(0); nah(s.summe, 4970);
  });
});

describe('Steuerrechner: Aufwand, Zahlung, Rücklage, Verlustvortrag über die Jahre', () => {
  // Plan-Monat 1 = Okt 26 … 27 = Dez 28. 2026 = Monate 1–3, 2027 = 4–15, 2028 = 16–27. Zahlung im Folgejahr im Juni: Monate 9 und 21.
  const lauf = (p: Steuerparameter, gewinn: (m: number) => number, N = 27) => { const f = neuerSteuerrechner(p, jahrVon, kalMonat); return Array.from({ length: N }, (_, i) => f(i + 1, gewinn(i + 1))); };

  it('Gewinn 2026: Aufwand zeitanteilig, Zahlung im Juni 2027, Rücklage dazwischen', () => {
    const r = lauf(kap(), m => (m <= 3 ? 10000 : 0));
    r.slice(0, 3).forEach(x => nah(x.summe, 10000 * 0.29825));
    nah(r[2].ruecklage, 30000 * 0.29825); expect(r[2].zahlung).toBe(0);
    for (let m = 4; m <= 8; m++) { nah(r[m - 1].ruecklage, 30000 * 0.29825); expect(r[m - 1].zahlung).toBe(0); }
    nah(r[8].zahlung, 30000 * 0.29825);                       // Juni 27
    expect(r[8].ruecklage).toBeCloseTo(0, 9);                 // bezahlt
    r.forEach((x, i) => { if (i !== 8) expect(x.zahlung, `Monat ${i + 1}`).toBe(0); });
  });
  it('Verlust in 2026 mindert 2027 (Verlustvortrag an); ohne Vortrag zahlt 2027 voll', () => {
    const g = (m: number) => (m === 1 ? -40000 : m === 4 ? 100000 : 0);
    const an_ = lauf(kap(), g), aus = lauf(kap({ verlustvortrag: false }), g);
    nah(an_[20].zahlung, 60000 * 0.29825);                    // Juni 28: (100.000 − 40.000) × 29,825 %
    nah(aus[20].zahlung, 100000 * 0.29825);
    expect(an_[3].verlustvortrag).toBe(40000); expect(aus[3].verlustvortrag).toBe(0);
    nah(an_[3].summe, 60000 * 0.29825);                       // Aufwand im Monat 4 schon nach Vortrag
    expect(an_[8].zahlung).toBe(0);                           // 2026 war Verlust → nichts zu zahlen
  });
  it('Verlustvortrag wird über mehrere Jahre aufgebraucht', () => {
    const r = lauf(kap(), m => (m === 1 ? -100000 : m === 4 ? 30000 : m === 16 ? 90000 : 0));
    expect(r[3].verlustvortrag).toBe(100000); expect(r[15].verlustvortrag).toBe(70000);
    expect(r[8].zahlung).toBe(0); expect(r[20].zahlung).toBe(0);              // 2027: Gewinn 30.000 komplett im Vortrag
    expect(r[26].ruecklage).toBeCloseTo(20000 * 0.29825, 8);                  // 2028: 90.000 − 70.000
  });
  it('Zahlmonat ist ein Parameter', () => {
    const r = lauf(kap({ zahlMonat: 3 }), m => (m <= 3 ? 10000 : 0));
    nah(r[5].zahlung, 30000 * 0.29825);                       // März 27 = Plan-Monat 6
    expect(r[8].zahlung).toBe(0);
  });
  it('Vorauszahlungen je Quartal: ein Viertel der Vorjahressteuer im März, Juni, September, Dezember; Abschluss im Zahlmonat', () => {
    // 2026: 30.000 € Gewinn → Steuer S26. 2027: 120.000 € Gewinn (10.000 je Monat Jan–Dez 27) → Steuer S27.
    const g = (m: number) => (m <= 3 ? 10000 : m <= 15 ? 10000 : 0);
    const r = lauf(kap({ zahlweise: 'quartal' }), g);
    const s26 = 30000 * 0.29825, s27 = 120000 * 0.29825;
    // Jahr 2027: Vorauszahlungen Monate 6, 9, 12, 15 = s26 / 4; im Juni (Monat 9) zusätzlich der Abschluss 2026 (s26 − 0 Vorauszahlungen)
    nah(r[5].zahlung, s26 / 4); nah(r[8].zahlung, s26 / 4 + s26); nah(r[11].zahlung, s26 / 4); nah(r[14].zahlung, s26 / 4);
    // Abschluss 2027 im Juni 28 (Monat 21) = s27 − Vorauszahlungen 2027, dazu die erste Vorauszahlung 2028 (s27 / 4)
    nah(r[20].zahlung, s27 - s26 + s27 / 4);
    // alles, was 2027 an Steuer entstanden ist, ist bis Ende 2028 gezahlt
    const gezahlt27 = r[5].zahlung + r[8].zahlung - s26 + r[11].zahlung + r[14].zahlung + r[20].zahlung - s27 / 4;
    nah(gezahlt27, s27);
    // Rücklage nie negativ
    r.forEach(x => expect(x.ruecklage).toBeGreaterThanOrEqual(0));
  });
});

// ── Im Kern: MAKE Innovation GmbH und KD Ventures ──────────────────────────
/** Ein Plan, in dem die Gewinne von Hand bestimmt werden: leeres Dokument, Bausteine liefern Umsatz/Kosten, Steuer-Hebesatz 400 %. */
function spiel(bausteine: Planszenario['bausteine'], annahmen: Planszenario['annahmen'] = {}): { d: FinanzDaten; ps: Planszenario } {
  const d = leeresDokument('2026-10-02');
  d.annahmen.steuerUG = 0.29825;   // = 15 % KSt + 5,5 % Soli darauf + 3,5 % × 400 % — die Vorgabe-Aufteilung ergibt Hebesatz 400
  d.annahmen.exitSteuer = 0.25;
  const ps: Planszenario = { ...neuesPlanszenario('ps1', 'Spiel', 'basis', JETZT), bausteine, annahmen };
  return { d: { ...d, planszenarien: [ps], arbeitsplan: 'ps1' }, ps };
}

describe('MAKE Innovation GmbH im Kern: Steuern einzeln', () => {
  const { d, ps } = spiel([neuerBaustein('u1', { art: 'umsatz', einheit: 'ug', name: 'Projekt', preis: 100000, rhythmus: 'einmalig', start: 1 })]);
  const g = rechneMit(d, ps);
  it('Vorgabe-Hebesatz aus dem früheren Gesamtsatz = 400 %', () => { nah(steuerParameter(d, 'ug').hebesatz, 400, 9); });
  it('Gewinn 100.000 € im Okt 26: KSt 15.000, Soli 825, GewSt 14.000 als Aufwand; Rücklage 29.825; Zahlung im Juni 27 (Monat 9)', () => {
    const u = g.ug[0];
    nah(u.st.kst, 15000); nah(u.st.soli, 825); nah(u.st.gewst, 14000); nah(u.st.summe, 29825);
    for (let m = 1; m <= 8; m++) { nah(g.ug[m - 1].steuerRuecklage, 29825); expect(g.ug[m - 1].steuer).toBe(0); }
    nah(g.ug[8].steuer, 29825); nah(g.ug[8].steuerRuecklage, 0, 9);
    // Das Geld geht aus der Kasse: Konto Juni 27 gegenüber Mai 27
    nah(g.ug[8].konto - g.ug[7].konto, -29825);
    // frei = Konto − Rücklage − USt offen
    nah(g.ug[0].frei, g.ug[0].konto - 29825 - g.ug[0].ustOffen);
  });
});

describe('KD Ventures im Kern: eigene Ertragsteuer im Monatsraster — die Steuer auf den Ausstieg kommt zusätzlich', () => {
  const treiber = { exit1: { betrag: 20000, monat: 5 } };
  const { d, ps } = spiel([neuerBaustein('v1', { art: 'umsatz', einheit: 'kdv', name: 'Beteiligung', preis: 10000, rhythmus: 'einmalig', start: 1 })]);
  d.szenarien[0] = { ...d.szenarien[0], ...treiber };
  const g = rechneMit(d, ps);
  it('Ergebnis aus Bausteinen wird wie bei einer GmbH versteuert (10.000 € → 2.982,50), der Ausstieg nur pauschal (25 %)', () => {
    nah(g.ug[0].kdvGewinn, 10000); nah(g.ug[0].kdvSt.summe, 2982.5);
    nah(g.ug[8].kdvSt.zahlung, 2982.5); nah(g.ug[4].kdvExit, 20000); nah(g.ug[4].kdvExitSteuer, 5000);
    expect(g.ug[4].kdvGewinn).toBe(0);                       // der Ausstieg ist kein laufendes Ergebnis → keine KSt/GewSt darauf
    // Kontostand: Start 0 + Baustein 10.000 + Ausstieg 20.000 − Ausstiegsteuer 5.000 − Ertragsteuer 2.982,50 (die Partnerdarlehen-Ablösung bleibt aus: kein Darlehen)
    nah(g.ug[26].kdvKonto, 10000 + 20000 - 5000 - 2982.5);
    nah(g.ug[0].kdvFrei, g.ug[0].kdvKonto - g.ug[0].kdvSt.ruecklage);
  });
  it('Das Blatt zeigt beide Steuern: Ertragsteuer-Aufwand und Steuer auf den Ausstieg', () => {
    const b = geschaeftsblatt(g.d, 'kdv', g, ps, 1);
    nah(b.steuerArten.kst[0] + b.steuerArten.soli[0] + b.steuerArten.gewst[0], 2982.5); nah(b.steuerArten.exit[4], 5000);
    nah(b.steuer.reduce((s, v) => s + v, 0), 2982.5 + 5000);
    expect(b.ergebnisNachSteuern[4]).toBeCloseTo(b.ergebnisVorSteuern[4] - 5000, 9);
  });
});

// ── Selbstständigkeit: eigene Achse ─────────────────────────────────────────
describe('Selbstständigkeit auf eigener Monatsachse', () => {
  const bausteine = () => [
    neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 6000, start: 1, laufzeit: 12, zahlungsziel: 1 }),
    neuerBaustein('k2', { art: 'kosten', einheit: 'kdc', kostenArt: 'tool', name: 'Software', preis: 500, start: 1 }),
    neuerBaustein('k3', { art: 'kosten', einheit: 'kdc', kostenArt: 'stelle', name: 'Assistenz', preis: 1000, start: 4 }),
  ];
  const { d, ps } = spiel(bausteine());
  d.selbst = { ...d.selbst, kontoStart: 2000, vorsorge: 3000, sonderausgaben: 500 };
  d.annahmen.agAnteil = 0.2;
  const g = rechneMit(d, ps);

  it('Bausteine mit Einheit Selbstständigkeit laufen dort — nicht mehr in den MAKE-Zahlen', () => {
    expect(g.ug.every(u => u.umsatz === 0 && u.bausteineUmsatz === 0 && u.sach === 0 && u.stellen === 0)).toBe(true);
    nah(g.kdc[0].umsatz, 6000); nah(g.kdc[0].sach, 500); nah(g.kdc[0].personal, 0); nah(g.kdc[3].personal, 1200);   // Stelle mit Arbeitgeberanteil
    nah(g.kdc[0].gewinn, 5500); nah(g.kdc[3].gewinn, 6000 - 500 - 1200);
  });
  it('Bausteine ohne Zuordnung (oder mit unbekannter Einheit) bleiben bei MAKE — der Säuberer liest sie als MAKE', () => {
    const roh = pruefeBaustein({ id: 'x', art: 'umsatz', name: 'Ohne', preis: 1000, start: 1 })!, fremd = pruefeBaustein({ id: 'y', art: 'umsatz', einheit: 'gibtsnicht', preis: 500, start: 1 })!;
    expect(roh.einheit).toBe('ug'); expect(fremd.einheit).toBe('ug');
    const o = spiel([roh, fremd]), r = rechneMit(o.d, o.ps);
    expect(r.ug[0].umsatz).toBe(1500); expect(r.kdc[0].umsatz).toBe(0);
  });
  it('Zahlungsziel verschiebt den Eingang; USt kommt obendrauf und geht im Folgemonat ans Finanzamt (Durchlauf)', () => {
    expect(g.kdc[0].eingang).toBe(0); nah(g.kdc[1].eingang, 6000);
    nah(g.kdc[1].ustEin, 6000 * 0.19); nah(g.kdc[2].ustZahlung, 6000 * 0.19);
  });
  it('Eigenes Konto startet beim Kontostand, Einkommensteuer nach Grundtarif auf (Ergebnis − Vorsorge − Sonderausgaben)', () => {
    nah(g.kdc[0].konto, 2000 - 500);                          // Monat 1: nur die Software (Eingang erst im Folgemonat)
    // 2026 (Monate 1–3): Ergebnis 3 × 5.500 = 16.500 → zvE 13.000
    const est26 = estTarif(16500 - 3500);
    nah(g.kdc[0].st.est + g.kdc[1].st.est + g.kdc[2].st.est, est26);
    expect(g.kdc[2].st.gewst).toBe(0);                        // unter dem Freibetrag von 24.500 €
    nah(g.kdc[8].st.zahlung, est26);                          // Juni 27
    // 2027 (Monate 4–15): Umsatz bis Monat 12 → 9 Monate × 6.000 − 12 × 500 − 12 × 1.200
    const gew27 = 9 * 6000 - 12 * 500 - 12 * 1200;
    expect(g.kdc.slice(3, 15).reduce((s, k) => s + k.gewinn, 0)).toBeCloseTo(gew27, 6);
    const mess = Math.max(0, gew27 - 24500) * 0.035;
    const gewst = mess * steuerParameter(g.d, 'kdc').hebesatz / 100;
    const est27 = estTarif(gew27 - 3500);
    const netto = est27 + gewst - Math.min(4 * mess, gewst, est27);
    nah(g.kdc.slice(3, 15).reduce((s, k) => s + k.st.summe, 0), netto, 6);
    nah(g.kdc[20].st.zahlung, netto, 6);                       // Juni 28
  });
  it('frei = Konto − Rücklage − USt offen; die Rücklage steht bis zur Zahlung', () => {
    nah(g.kdc[2].frei, g.kdc[2].konto - g.kdc[2].steuerRuecklage - g.kdc[2].ustOffen);
    expect(g.kdc[2].steuerRuecklage).toBeGreaterThan(0); nah(g.kdc[8].steuerRuecklage, g.kdc[8].st.ruecklage);
  });
  it('Ohne Bausteine der Selbstständigkeit steht nur das Konto: Achse leer, Ergebnis null (Gehalt 2 schon in der GmbH)', () => {
    const e = rechneSelbstAchse({ ...planFix(), annahmen: { ...planFix().annahmen, malinAb: 1 } });
    expect(e.length).toBe(27); expect(e.every(k => k.gewinn === 0 && k.st.summe === 0 && k.konto === 5000 && k.entnahme === 0)).toBe(true);
  });
  it('Formel-Prüfung 05.10.: vor der GmbH (malinAb 3) zahlt die Selbstständigkeit Gehalt 2 — Okt und Nov je 3.000 mit Arbeitgeberanteil', () => {
    const e = rechneSelbstAchse(planFix());
    expect(e.map(k => k.malinBrutto).slice(0, 4)).toEqual([2500, 2500, 0, 0]);
    expect(e[0].konto).toBeCloseTo(2000, 9); expect(e[1].konto).toBeCloseTo(-1000, 9); expect(e[26].konto).toBeCloseTo(-1000, 9);
    expect(e.every(k => k.st.summe === 0)).toBe(true);   // Verlust: keine Steuer
  });
  it('Sachkosten-Zeilen der Selbstständigkeit laufen dort, alle anderen bei MAKE', () => {
    const e = planFix(); e.sachkosten = [...e.sachkosten, { id: 'sk9', name: 'Büro Selbst', einheit: 'selbststaendigkeit', gruppe: 'X', soll: 700, ab: 1 }];
    const alt = rechneMit(planFix(), null), neu = rechneMit(e, null);
    nah(neu.kdc[0].sach, 700); expect(neu.ug.map(u => u.sach)).toEqual(alt.ug.map(u => u.sach));
  });
});

describe('Entnahme der Selbstständigkeit → Privat (Gesamt/Privat nehmen sie als eigenen Strom)', () => {
  const basis = spiel([
    neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 6000, start: 1, laufzeit: 24 }),
    neuerBaustein('k2', { art: 'kosten', einheit: 'kdc', kostenArt: 'tool', name: 'Software', preis: 1000, start: 1 }),
  ]);
  const mit = (entnahme: NonNullable<Planszenario['annahmen']['entnahme']> | undefined) => rechneMit(basis.d, { ...basis.ps, annahmen: entnahme ? { entnahme } : {} });
  const ohne = mit(undefined);
  it('ohne Regel keine Entnahme — das Geld bleibt im Konto der Selbstständigkeit', () => {
    expect(ohne.kdc.every(k => k.entnahme === 0)).toBe(true); expect(ohne.pr.every(p => p.entnahme === 0)).toBe(true);
  });
  it('fester Betrag ab Monat: Kasse der Selbstständigkeit raus, Privat verfügbar rein (keine weitere Steuer)', () => {
    const e = mit({ betrag: 1500, ab: 3 });
    expect(e.kdc[1].entnahme).toBe(0); nah(e.kdc[2].entnahme, 1500); nah(e.pr[2].entnahme, 1500);
    nah(e.pr[2].verfuegbar - ohne.pr[2].verfuegbar, 1500); nah(e.pr[2].luft - ohne.pr[2].luft, 1500);
    nah(e.kdc[4].konto - ohne.kdc[4].konto, -1500 * 3);                // Monate 3, 4, 5
    // Gesamt verändert sich nicht durch die Entnahme: Selbstständigkeit frei + Privat Luft (kumuliert) = vorher
    const kum = (r: typeof ohne, m: number) => r.kdc[m - 1].konto + r.pr.slice(0, m).reduce((s, p) => s + p.luft, 0);
    nah(kum(e, 10), kum(ohne, 10));
  });
  it('Anteil am positiven Ergebnis nach Steuern', () => {
    const e = mit({ anteil: 0.5, ab: 1 });
    nah(e.kdc[0].entnahme, 0.5 * Math.max(0, e.kdc[0].ergebnisNach)); expect(e.kdc[0].entnahme).toBeGreaterThan(0);
  });
  it('Eine Entnahme senkt die „frei“-Zahl der Selbstständigkeit und hebt Privat — Summe in Auswertung bleibt konsistent', () => {
    const e = mit({ betrag: 1500, ab: 1 }), aw = auswertung(e.d, e.ug, e.pr, e.kdc);
    expect(aw.uebergaenge.entnahme).toBe(1500);
    nah(aw.frei.gesamt, aw.frei.ug + aw.frei.kdv + aw.frei.kdc + aw.frei.privat);
  });
});

describe('Gesamt-Summen: die Gesellschaften ergeben zusammen das Gesamt', () => {
  it('ein Baustein von MAKE zur Selbstständigkeit verschoben: Summe der Ergebnisse vor Steuern und der Umsatz bleiben gleich, Privat ändert sich nicht', () => {
    const lade = (ort: 'ug' | 'kdc') => { const s = spiel([neuerBaustein('u', { art: 'umsatz', einheit: ort, preis: 5000, start: 1, laufzeit: 10 }), neuerBaustein('k', { art: 'kosten', einheit: ort, kostenArt: 'tool', preis: 800, start: 2 })]); return rechneMit(s.d, s.ps); };
    const a = lade('ug'), b = lade('kdc');
    for (let i = 0; i < 27; i++) {
      nah(a.ug[i].gewinn + a.kdc[i].gewinn, b.ug[i].gewinn + b.kdc[i].gewinn, 9);
      nah(a.ug[i].umsatz + a.kdc[i].umsatz, b.ug[i].umsatz + b.kdc[i].umsatz, 9);
      expect(a.pr[i].luft).toBe(b.pr[i].luft);
    }
  });
  it('Auswertung: frei gesamt = MAKE + KD Ventures + Selbstständigkeit + Privat; Steuerrücklage gesamt = Summe der drei', () => {
    const g = rechneMit(planFix(14000), arbeitsplanFix()), aw = auswertung(g.d, g.ug, g.pr, g.kdc);
    nah(aw.frei.gesamt, aw.frei.ug + aw.frei.kdv + aw.frei.kdc + aw.frei.privat, 9);
    nah(aw.steuer.ruecklageGesamt, aw.steuer.ruecklage + aw.steuer.ruecklageKdv + aw.steuer.ruecklageKdc, 9);
    // Gruppe Dez 28 (Kennzahl) = Summe der Teile im letzten Monat
    nah(g.kz.gruppeDez28, g.ug[26].frei + g.ug[26].kdvFrei + g.kdc[26].frei + g.pr[26].angespart, 9);
  });
  it('Steuerzahlungen je Jahr: die Summe der Gesellschaften = alles, was aus den Konten ging', () => {
    const g = rechneMit(planFix(14000), arbeitsplanFix());
    const aus = (f: (i: number) => number) => g.ug.reduce((s, _, i) => s + f(i), 0);
    const gesamt = aus(i => g.ug[i].steuer + g.ug[i].kdvSt.zahlung + g.kdc[i].st.zahlung);
    nah(gesamt, g.ug.reduce((s, u) => s + u.steuer, 0) + g.ug.reduce((s, u) => s + u.kdvSt.zahlung, 0) + g.kdc.reduce((s, k) => s + k.st.zahlung, 0), 9);
    expect(gesamt).toBeGreaterThan(0);
  });
  it('Blatt je Gesellschaft: Ergebnis nach Steuern = vor Steuern − Einzelsteuern (KSt + Soli + GewSt + ESt − Anrechnung + Ausstieg)', () => {
    const g = rechneMit(planFix(14000), arbeitsplanFix());
    for (const ort of ['ug', 'kdv', 'kdc'] as const) {
      const b = geschaeftsblatt(g.d, ort, g, arbeitsplanFix(), 1), a = b.steuerArten;
      b.ergebnisNachSteuern.forEach((v, i) => nah(v, b.ergebnisVorSteuern[i] - (a.kst[i] + a.soli[i] + a.gewst[i] + a.est[i] - a.anrechnung[i] + a.exit[i]), 9));
    }
  });
});

describe('Alte Dokumente: gelöschte Felder werden beim Lesen ignoriert', () => {
  it('ruecklage5a und notgroschenMonate im Dokument stürzen nichts ab und werden nicht mitgeschrieben', () => {
    const roh = JSON.parse(JSON.stringify(planFix(14000)));
    roh.annahmen.ruecklage5a = 1234; roh.einstellungen.notgroschenMonate = 6;
    const p = pruefeDokument(roh);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect('ruecklage5a' in p.dokument.annahmen).toBe(false); expect('notgroschenMonate' in p.dokument.einstellungen).toBe(false);
      expect(JSON.stringify(rechneMit(p.dokument, null).ug)).toBe(JSON.stringify(rechneMit(planFix(14000), null).ug));
    }
  });
  it('Ein Dokument ohne `steuern` rechnet mit den Vorgaben; Unsinn im Profil wird begrenzt', () => {
    const d = an(planFix(), [{ pfad: '/steuern/kdc/param/anrechnung', neu: 99 }, { pfad: '/steuern/kdc/param/zahlMonat', neu: 14 }, { pfad: '/steuern/kdc/param/tarif/satz3', neu: -1 }, { pfad: '/steuern/kdc/param/tarif/gibtsnicht', neu: 5 }, { pfad: '/steuern/kdc/param/zahlweise', neu: 'quatsch' }]);
    const k = d.steuern!.kdc!.param!;
    expect(k.anrechnung).toBe(20); expect(k.zahlMonat).toBe(12); expect(k.tarif).toEqual({ satz3: 0 }); expect(k.zahlweise).toBeUndefined();
  });
});

// ── Kevin: „alles anpassen, damit ich selber spielen kann“ ─────────────────
describe('Jeder Parameter ist ein Feld: geändert wirkt er, geleert wirkt er wie die Vorgabe', () => {
  // Plan mit Verlust 2026 und Gewinn 2027 in MAKE und KD Ventures, Gewinn in der Selbstständigkeit, damit jeder Parameter etwas bewegt.
  const spielwiese = () => spiel([
    neuerBaustein('u0', { art: 'kosten', einheit: 'ug', kostenArt: 'sonstiges', name: 'Anlauf', preis: 50000, rhythmus: 'einmalig', start: 1 }),
    neuerBaustein('u1', { art: 'umsatz', einheit: 'ug', name: 'Projekte', preis: 12000, start: 4, laufzeit: 24 }),
    neuerBaustein('v1', { art: 'kosten', einheit: 'kdv', name: 'Holding', preis: 1000, rhythmus: 'einmalig', start: 1 }),
    neuerBaustein('v2', { art: 'umsatz', einheit: 'kdv', name: 'Beteiligung', preis: 6000, start: 4, laufzeit: 24 }),
    neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 7000, start: 1, laufzeit: 27 }),
  ], {});
  const signatur = (d: FinanzDaten, ps: Planszenario): string => {
    const g = rechneMit(d, ps);
    return JSON.stringify({ ug: g.ug.map(u => [u.steuer, u.steuerRuecklage, u.kdvSt.zahlung, u.kdvSt.ruecklage, u.konto, u.kdvKonto]), kdc: g.kdc.map(k => [k.st.zahlung, k.st.summe, k.st.ruecklage, k.konto]) });
  };
  type Fall = { ort: 'ug' | 'kdv' | 'kdc'; a: SteuerAenderung };
  const F = (ort: Fall['ort'], id: string, wert: number | boolean | string): Fall => ({ ort, a: { art: 'feld', id, wert } });
  const faelle: [string, Fall][] = [
    ['MAKE: KSt-Satz', F('ug', 'kst.satz', 0.2)], ['MAKE: Soli-Satz', F('ug', 'soli.satz', 0.02)], ['MAKE: Messzahl', F('ug', 'gewst.satz', 0.05)], ['MAKE: Hebesatz', F('ug', 'gewst.hebesatz', 500)],
    ['MAKE: Verlustvortrag aus', F('ug', 'verlustvortrag', false)], ['MAKE: Zahlweise Quartal', F('ug', 'zahlweise', 'quartal')], ['MAKE: Zahlmonat', F('ug', 'zahlMonat', 9)],
    ['KD Ventures: KSt-Satz', F('kdv', 'kst.satz', 0.2)], ['KD Ventures: Hebesatz', F('kdv', 'gewst.hebesatz', 300)], ['KD Ventures: Verlustvortrag aus', F('kdv', 'verlustvortrag', false)], ['KD Ventures: Zahlweise Quartal', F('kdv', 'zahlweise', 'quartal')],
    ['Selbstständigkeit: Freibetrag', F('kdc', 'freibetrag', 0)], ['Selbstständigkeit: Anrechnung', F('kdc', 'anrechnung', 0)], ['Selbstständigkeit: Hebesatz', F('kdc', 'gewst.hebesatz', 600)],
    ['Selbstständigkeit: Messzahl', F('kdc', 'gewst.satz', 0.05)], ['Selbstständigkeit: Zahlweise Quartal', F('kdc', 'zahlweise', 'quartal')], ['Selbstständigkeit: Zahlmonat', F('kdc', 'zahlMonat', 3)],
    ['Selbstständigkeit: Tarif Spitzensatz', F('kdc', 'tarif.satz3', 0.5)], ['Selbstständigkeit: Tarif Grundfreibetrag', F('kdc', 'tarif.grundfreibetrag', 20000)], ['Selbstständigkeit: Tarif Zone 1 a', F('kdc', 'tarif.a1', 1500)],
    ['Selbstständigkeit: Gewerbesteuer aus', { ort: 'kdc', a: { art: 'an', steuer: 'gewst', wert: false } }], ['Selbstständigkeit: Einkommensteuer aus', { ort: 'kdc', a: { art: 'an', steuer: 'est', wert: false } }],
    ['MAKE: Rechtsform Einzel', { ort: 'ug', a: { art: 'rechtsform', wert: 'einzel' } }],
  ];
  // Verlustvortrag wirkt nur, wenn es einen Verlust gibt: MAKE 2026 (−50.000) und KD Ventures 2026 (−1.000) — beides in der Spielwiese.
  for (const [name, f] of faelle) {
    it(`${name}: eingetragen ändert das Ergebnis, geleert (zurücksetzen) ergibt wieder exakt die Vorgabe`, () => {
      const { d, ps } = spielwiese();
      const basis = signatur(d, ps);
      const geaendert = an(d, steuerOps(d, f.ort, f.a));
      expect(signatur(geaendert, ps), 'wirkt').not.toBe(basis);
      if (f.a.art === 'feld') {
        const leer = an(geaendert, steuerOps(geaendert, f.ort, { art: 'feld', id: f.a.id, wert: null }));
        expect(signatur(leer, ps), 'zurückgesetzt = Vorgabe').toBe(basis);
      }
    });
    it(`${name}: dieselbe Änderung nur im Szenario (Überlagerung) rechnet gleich wie im Plan`, () => {
      const { d, ps } = spielwiese();
      const imPlan = signatur(an(d, steuerOps(d, f.ort, f.a)), ps);
      const bereich: SteuerBereich = { art: 'szenario', id: ps.id };
      const imSzenario = an(d, steuerOps(d, f.ort, f.a, bereich, undefined));
      expect(signatur(imSzenario, imSzenario.planszenarien![0])).toBe(imPlan);
      // und ein ANDERES Szenario ohne die Überlagerung rechnet wie vorher
      expect(signatur(imSzenario, { ...ps, id: 'ps2' })).toBe(signatur(d, ps));
    });
  }
  it('Der Hebesatz als Vorgabe folgt dem Gesamtsatz der Annahmen (leer = Vorgabe) — ein eingetragener Hebesatz nicht mehr', () => {
    const { d, ps } = spielwiese();
    const hoch = { ...d, annahmen: { ...d.annahmen, steuerUG: 0.35 } };
    expect(signatur(hoch, ps)).not.toBe(signatur(d, ps));
    const fest = an(d, steuerOps(d, 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: 400 }));
    const festHoch = { ...fest, annahmen: { ...fest.annahmen, steuerUG: 0.35 } };
    const ug = (x: FinanzDaten) => rechneMit(x, ps).ug.map(u => u.steuer);
    expect(ug(festHoch)).toEqual(ug(fest));
  });
  it('Steuer auf den Ausstieg (KD Ventures) und Entnahme: je Szenario einstellbar, wirken sofort', () => {
    const { d, ps } = spielwiese();
    d.szenarien[0] = { ...d.szenarien[0], exit1: { betrag: 20000, monat: 12 } };
    const kdv = (p: Planszenario) => rechneMit(d, p).ug[26].kdvKonto;
    const basis = kdv(ps);
    nah(kdv({ ...ps, annahmen: { exitSteuer: 0.5 } }), basis - 5000);     // 20.000 × (50 % − 25 %)
    expect(rechneMit(d, { ...ps, annahmen: { entnahme: { betrag: 100, ab: 1 } } }).pr[0].entnahme).toBe(100);
  });
});
