// ─── Gegenprüfung finanzplan-5 (05.10.) — unabhängige Rechnung, adversarial ─────────────────────────────────────────────
// Kevin: „Achte bei der Finanzplanung nur, dass wir das wirklich sauber machen.“ Alle Erwartungswerte hier sind UNABHÄNGIG vom Code des
// Autors gerechnet (eigene Tarif-, Soli- und Gewerbesteuer-Formeln, eigene Summen). Erfundene Zahlen, nie echte Daten.
//
// `it.fails(...)` = gefundener Fehler: der Test beschreibt das RICHTIGE Verhalten und schlägt heute fehl. Wird der Fehler behoben, schlägt
// `it.fails` an — dann auf `it` umstellen. Normale `it` = geprüft und korrekt (oder ein Fund, dessen Ausmaß dokumentiert wird).
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { estJahre, jahrVon, kalMonat, lohnJahre, rechneSelbst } from '../lib/finanzen/rechenkern';
import { estTarif, jahresSteuer, neuerSteuerrechner, TARIF_2026, type Steuerparameter } from '../lib/finanzen/ertragsteuer';
import { rechneMit, neuesPlanszenario, neuerBaustein, mitBereich } from '../lib/finanzen/szenarien';
import { leeresDokument, monatsLabels, wendeOperationenAn } from '../lib/finanzen/plan/operationen';
import { businessSicht, businessPfadErlaubt, fuerSicht, kennzahlenFuerSicht } from '../lib/finanzen/plan/sicht';
import { kennzahlenVon } from '../lib/finanzen/plan/speicher';
import { pruefeEinDarlehen } from '../lib/finanzen/darlehen';
import { finanzStraenge } from '../lib/lichtfaeden/quellen/finanzen';
import { planFix, planAltMigration } from './fixtures/finanz-plan';

// ── Eigene Formeln (unabhängig vom Autor) ────────────────────────────────────────────────────────────────────────────
/** § 32a Abs. 1 EStG, Veranlagungszeitraum 2026 (Steuerfortentwicklungsgesetz): Zonen, Koeffizienten, Rundung auf volle Euro (zvE und Steuer). */
function T26(zve: number): number {
  const x = Math.floor(Math.max(0, zve));
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}
/** § 32a Abs. 5 EStG: Splittingverfahren. */
const T26split = (zve: number): number => 2 * T26(Math.floor(Math.max(0, zve) / 2));
/** § 4 SolZG 2026: Freigrenze 20.350 € (Splitting 40.700 €), Milderungszone 11,9 % des Überschusses, sonst 5,5 %. */
const soliVon = (est: number, split = false): number => { const g = split ? 40700 : 20350; return est > g ? Math.min(0.055 * est, 0.119 * (est - g)) : 0; };

/** Die erwartete Jahressteuer (Mehrsteuer-Methode, wie Kevins Vorgabe): G Gewinn, L Lohneinkünfte (nach Pauschbetrag), A Vorsorge+Sonderausgaben. */
function erwartet(G: number, L: number, A: number, split = false, heb = 400) {
  const tarif = split ? T26split : T26;
  const estG = tarif(Math.max(0, G + L - A)), estL = tarif(Math.max(0, L - A)), mehr = estG - estL;
  const MB = 0.035 * Math.max(0, G - 24500), gewst = MB * heb / 100;
  const anr = Math.min(4 * MB, gewst, Math.max(0, mehr));                  // Autor: Deckel = Mehrsteuer (siehe Fund § 35 unten)
  const soli = soliVon(estG - anr, split) - soliVon(estL, split);
  return { est: mehr, gewst, anr, soli, summe: gewst + mehr - anr + soli };
}
const P = (x: Partial<Steuerparameter> = {}): Steuerparameter => ({
  form: 'einzel', kstAn: false, kst: 0.15, soliAn: true, soli: 0.055, gewstAn: true, messzahl: 0.035, hebesatz: 400, estAn: true, tarif: TARIF_2026,
  estAbzug: 0, freibetrag: 24500, anrechnung: 4, soliFreigrenze: 20350, verlustvortrag: true, zahlweise: 'folgejahr', zahlMonat: 6, ...x,
});

// ── a) Tarif 2026 ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('a) Einkommensteuer-Tarif 2026 (§ 32a EStG)', () => {
  it('estTarif = eigene Formel für jedes volle zvE von 0 bis 320.000 € (und Stichproben bis 2 Mio.)', () => {
    for (let x = 0; x <= 320000; x++) if (estTarif(x) !== T26(x)) throw new Error(`zvE ${x}: Code ${estTarif(x)} ≠ ${T26(x)}`);
    for (const x of [400000, 777777.77, 2_000_000]) expect(estTarif(x)).toBe(T26(x));
  });
  it('die vom Autor genannten Werte stimmen', () => {
    const soll: [number, number][] = [[26770, 3324], [32570, 4953], [38370, 6698], [44170, 8559], [46770, 9432], [52570, 11462], [116370, 37739], [45000, 8835], [60000, 14233]];
    for (const [x, t] of soll) { expect(T26(x), `eigene Formel ${x}`).toBe(t); expect(estTarif(x), `Code ${x}`).toBe(t); }
  });
  it('stetig (Sprung an den Zonengrenzen höchstens 1 € Rundung), monoton, Grenzsteuersatz 14 % → 23,97 % → 42 % → 45 %', () => {
    let vor = 0;
    for (let x = 0; x <= 300000; x += 1) { const t = estTarif(x); expect(t >= vor, `monoton bei ${x}`).toBe(true); expect(t - vor <= 1, `Sprung bei ${x}`).toBe(true); vor = t; }
    const gs = (x: number) => (estTarif(x + 1000) - estTarif(x)) / 1000;   // Grenzsteuersatz über 1.000 €
    expect(gs(12348)).toBeGreaterThan(0.139); expect(gs(12348)).toBeLessThan(0.15);
    expect(gs(17799)).toBeGreaterThan(0.239); expect(gs(17799)).toBeLessThan(0.245);
    expect(gs(68878)).toBeGreaterThan(0.415); expect(gs(68878)).toBeLessThanOrEqual(0.421);
    expect(gs(69879)).toBeCloseTo(0.42, 2); expect(gs(277826)).toBeCloseTo(0.45, 2);
  });
});

// ── a) Soli, Splitting, GewSt, § 35, Differenzmethode ─────────────────────────────────────────────────────────────────
describe('a) Jahressteuer der Selbstständigkeit gegen eigene Rechnung', () => {
  it('Raster: Gewinn × Lohn × Abzüge × Splitting × Hebesatz — ESt (Mehrsteuer), GewSt, Anrechnung, Soli, Summe', () => {
    let n = 0;
    for (const G of [-30000, 0, 10000, 24500, 30000, 60000, 150000, 400000])
      for (const L of [0, 20000, 46770, 120000])
        for (const A of [0, 2500, 30000])
          for (const split of [false, true])
            for (const heb of [380, 400, 450]) {
              const e = erwartet(G, L, A, split, heb);
              const j = jahresSteuer(P({ estAbzug: A, splitting: split, hebesatz: heb, lohn: { 2027: L } }), G, 0, 2027);
              const w = `G ${G} L ${L} A ${A} split ${split} heb ${heb}`;
              expect(j.est, `est ${w}`).toBeCloseTo(e.est, 6); expect(j.gewst, `gewst ${w}`).toBeCloseTo(e.gewst, 6);
              expect(j.anrechnung, `anr ${w}`).toBeCloseTo(e.anr, 6); expect(j.soli, `soli ${w}`).toBeCloseTo(e.soli, 6);
              expect(j.summe, `summe ${w}`).toBeCloseTo(e.summe, 6); n++;
            }
    expect(n).toBe(576);
  });
  it('Soli: Freigrenze 20.350 € und Milderungszone 11,9 % (ohne Gewerbesteuer, ohne Lohn)', () => {
    const p = P({ gewstAn: false });
    expect(jahresSteuer(p, 70000).soli).toBe(0);                                         // T(70000) = 18.264 < 20.350
    expect(jahresSteuer(p, 116370).soli).toBeCloseTo(0.119 * (37739 - 20350), 6);       // Milderungszone
    expect(jahresSteuer(p, 300000).soli).toBeCloseTo(0.055 * T26(300000), 6);           // voller Satz
    expect(jahresSteuer(P({ gewstAn: false, splitting: true }), 116370).soli).toBe(0);   // Splitting: 2 × T(58.185) = 27.288 < 40.700
  });
  it('Arbeitnehmer-Pauschbetrag 1.230 € je Person und Jahr, Gehalt Jan–Sep zählt in 2026 (lohnJahre)', () => {
    const d = planSteuerjahr();
    const g = rechneMit(d, d.planszenarien![0]);
    expect(g.ug[0].kevinBrutto).toBe(4000);
    expect(lohnJahre(g.d, g.ug)[2026]).toBe(27000 + 3 * 4000 - 1230);
    expect(lohnJahre(g.d, g.ug)[2027]).toBe(12 * 4000 - 1230);
  });

  it.fails('Fund (klein, bekannt): § 35 EStG — Anrechnung höchstens Ermäßigungshöchstbetrag (ESt × gewerbliche / alle positiven Einkünfte), nicht die Mehrsteuer', () => {
    // G 40.000, Lohneinkünfte 15.000, Abzüge 30.000: zvE 25.000 → ESt 2.850 (alles Mehrsteuer, Lohn allein steuerfrei).
    // Höchstbetrag = 2.850 × 40.000 / 55.000 = 2.072,73; 4 × Messbetrag = 2.170 → gesetzlich 2.072,73, Code 2.170.
    const j = jahresSteuer(P({ estAbzug: 30000, lohn: { 2027: 15000 } }), 40000, 0, 2027);
    expect(j.anrechnung).toBeCloseTo(T26(25000) * 40000 / 55000, 2);
  });

  it.fails('Fund (klein): Gewerbesteuer-Verlustvortrag geht verloren, wenn auf ein Jahr MIT Lohn ein Jahr OHNE Lohn folgt', () => {
    // 2026: Verlust 50.000, Lohn 30.000 → ESt-Vortrag 20.000, GewSt-Vortrag 50.000. 2027 ohne Lohn: Gewinn 60.000.
    // Richtig: Gewerbeertrag 60.000 − 50.000 = 10.000 < Freibetrag → GewSt 0; ESt = T(40.000); Soli 0 → Steuer 2027 = T(40.000).
    // Code: der Pfad ohne Lohn nimmt den ESt-Vortrag (20.000) auch für die Gewerbesteuer → GewSt 2.441,25, Anrechnung 2.170 → +271,25 €.
    const st = neuerSteuerrechner(P({ lohn: { 2026: 30000 }, hebesatz: 450 }), jahrVon, kalMonat);
    st(1, -50000); st(2, 0); st(3, 0);
    for (let m = 4; m <= 15; m++) st(m, 5000);
    let zahlung = 0;
    for (let m = 16; m <= 21; m++) zahlung = st(m, 0).zahlung;   // Juni 2028 = Abschluss 2027
    expect(zahlung).toBeCloseTo(T26(40000), 2);
  });
});

// ── b) 2026 als EIN Steuerjahr ────────────────────────────────────────────────────────────────────────────────────────
/** Erfundener Plan: Selbstständigkeit Jan–Sep 24.000 € Gewinn, ab Okt 5.000 €/Monat, Gehalt 1 aus der GmbH 4.000 €/Monat, Jan–Sep 27.000 €. */
function planSteuerjahr(laenge = 27): FinanzDaten {
  const d = leeresDokument('2026-10-01');
  d.monate = monatsLabels(2026, 10, laenge);
  d.annahmen = { ...d.annahmen, kevinBrutto: 4000, kevinAb: 1, malinBrutto: 0, malinAb: 1, nettoTabelle: [[0, 0], [10000, 6000]], steuerMonat: 6 };
  d.steuern = { kdc: { rechtsform: 'einzel', zeilen: { gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6 } } };
  d.selbst = { ...d.selbst, posten: [{ id: 'e', name: 'Honorar', art: 'einnahme', betrag: 30000, status: 'bezahlt' }, { id: 'a', name: 'Kosten', art: 'ausgabe', betrag: 6000, status: 'bezahlt' }],
    vorsorge: 2000, sonderausgaben: 500, kontoStart: 20000, lohnVorPlan: 27000, estVorausgezahlt: 1000 };
  d.planszenarien = [{ ...neuesPlanszenario('ps', 'Plan', 'basis', '2026-10-01T00:00:00.000Z'), bausteine: [neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Beratung', preis: 5000, start: 1 })] }];
  d.arbeitsplan = 'ps';
  return d;
}

describe('b) 2026 = EIN Steuerjahr (Jan–Sep + Okt–Dez)', () => {
  const A = 2500, G26 = 24000 + 3 * 5000, L26 = 27000 + 12000 - 1230, G27 = 60000, L27 = 48000 - 1230;
  it('Steuer 2026 genau einmal über den ganzen Jahresgewinn, Abzüge einmal, Zahlung Juni 2027 minus Vorauszahlung', () => {
    const d = planSteuerjahr(), g = rechneMit(d, d.planszenarien![0]);
    const s26 = erwartet(G26, L26, A).summe;
    expect(g.kdc[8].st.zahlung).toBeCloseTo(s26 - 1000, 6);               // Plan-Monat 9 = Juni 2027
    for (let m = 1; m <= 27; m++) if (m !== 9 && m !== 21) expect(g.kdc[m - 1].st.zahlung, `keine Zahlung in Monat ${m}`).toBe(0);
    // Nicht doppelt: weder Jan–Sep zweimal noch Abzüge zweimal.
    expect(s26).not.toBeCloseTo(erwartet(G26 + 24000, L26, A).summe, 0);
    expect(s26).not.toBeCloseTo(erwartet(G26, L26, 2 * A).summe, 0);
    // Rücklage Okt 26 = Steuer auf Jan–Okt (Progression mit dem Jahreslohn) minus schon Vorausgezahltes.
    expect(g.kdc[0].st.ruecklage).toBeCloseTo(erwartet(24000 + 5000, L26, A).summe - 1000, 6);
    // Dez 26: die ganze Steuer 2026 minus Vorauszahlung.
    expect(g.kdc[2].st.ruecklage).toBeCloseTo(s26 - 1000, 6);
    // Aufwand Okt–Dez = Zuwachs über die Steuer auf Jan–Sep.
    const aufwand = g.kdc.slice(0, 3).reduce((s, k) => s + k.st.summe, 0);
    expect(aufwand).toBeCloseTo(s26 - erwartet(24000, L26, A).summe, 6);
    // 2027 im Juni 2028.
    expect(g.kdc[20].st.zahlung).toBeCloseTo(erwartet(G27, L27, A).summe, 6);
  });
  it('Abschluss (Jan–Sep) und Jahresübersicht stimmen mit dem Steuerrechner überein', () => {
    const d = planSteuerjahr(), g = rechneMit(d, d.planszenarien![0]);
    const ab = rechneSelbst(g.d, undefined, g.lohn);
    expect(ab.gewinn).toBe(24000); expect(ab.lohn).toBe(L26);
    expect(ab.steuer).toBeCloseTo(erwartet(24000, L26, A).summe, 6);
    expect(ab.frei).toBeCloseTo(20000 - (erwartet(24000, L26, A).summe - 1000), 6);
    const ej = estJahre(g.d, g.kdc, g.ug);
    expect(ej.find(j => j.jahr === 2026)!.summe).toBeCloseTo(erwartet(G26, L26, A).summe, 6);
    expect(ej.find(j => j.jahr === 2027)!.summe).toBeCloseTo(erwartet(G27, L27, A).summe, 6);
  });
  it('Quartals-Vorauszahlungen: schon Bezahltes zählt einmal, Rücklage am Ende 0 (2028 = 2027), Summe der Zahlungen stimmt', () => {
    const d = planSteuerjahr(); d.steuern!.kdc!.param = { zahlweise: 'quartal', zahlMonat: 6 };
    const g = rechneMit(d, d.planszenarien![0]);
    const s26 = erwartet(G26, L26, A).summe, s27 = erwartet(G27, L27, A).summe;
    expect(g.kdc[2].st.zahlung).toBe(0);                                                   // Dez 26: noch keine Vorauszahlung (kein Vorjahr im Plan)
    expect(g.kdc[5].st.zahlung).toBeCloseTo(s26 / 4, 6);                                   // März 27: ¼ der Steuer 2026
    expect(g.kdc[8].st.zahlung).toBeCloseTo(s26 / 4 + (s26 - 1000), 6);                    // Juni 27: Vorauszahlung + Abschluss 2026 minus schon bezahlt
    expect(g.kdc.reduce((s, k) => s + k.st.zahlung, 0)).toBeCloseTo(s26 - 1000 + 2 * s27, 6);
    expect(g.kdc[26].st.ruecklage).toBeCloseTo(0, 6);
  });
  it.fails('Fund (klein, Anzeige): Karte „Einkommensteuer gemeinsam“ (estJahre) ignoriert einen Handwert auf ab.est — und der Hinweis darauf prüft nur kdc.*', () => {
    const d = planSteuerjahr(); d.plan = { ...d.plan, 'ab.est:0': 0 };
    const g = rechneMit(d, d.planszenarien![0]);
    const ej = estJahre(g.d, g.kdc, g.ug).find(j => j.jahr === 2026)!;
    expect(ej.summe).toBeCloseTo(g.kdc[8].st.zahlung + 1000, 6);   // „Steuer des Jahres aus dem Plan“ = was gezahlt wird (+ schon bezahlt)
  });
  it('Planlänge > 27 Monate (bis Dez 29): Jahreswechsel und Zahlmonate stimmen, Steuer 2028 im Juni 2029', () => {
    const d = planSteuerjahr(39), g = rechneMit(d, d.planszenarien![0]);
    expect(g.kdc.length).toBe(39);
    expect(g.lohn[2029]).toBe(48000 - 1230);
    expect(g.kdc[32].st.zahlung).toBeCloseTo(erwartet(G27, L27, A).summe, 6);   // Plan-Monat 33 = Juni 2029 zahlt 2028
  });
  it('Verlust der Selbstständigkeit mindert die Steuer aufs Gehalt (Erstattung im Juni 2027), Rest als Vortrag', () => {
    const st = neuerSteuerrechner(P({ lohn: { 2026: 30000 } }), jahrVon, kalMonat);
    st(1, -10000); st(2, 0); st(3, 0);
    let z = 0; for (let m = 4; m <= 9; m++) z = st(m, 0).zahlung;
    expect(z).toBeCloseTo(T26(20000) - T26(30000), 6);   // negativ = Erstattung
  });
});

// ── c) Darlehen ──────────────────────────────────────────────────────────────────────────────────────────────────────
describe('c) Darlehen: hin und zurück konsistent, kein Ergebnis-/Steuereffekt, Gruppe gleich', () => {
  const mitDarlehen = (): FinanzDaten => ({ ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 },
    darlehen: [
      { id: 'd1', name: 'Privat an KDV', geber: 'privat', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 10 },
      { id: 'd2', name: 'Selbst an MAKE', geber: 'kdc', nehmer: 'ug', betrag: 5000, aus: 2, zurueck: 8 },
      { id: 'd3', name: 'KDV an Privat', geber: 'kdv', nehmer: 'privat', betrag: 700, aus: 3, zurueck: 0 },
      { id: 'd4', name: 'Bank an MAKE', geber: 'extern', nehmer: 'ug', betrag: 2000, aus: 4, zurueck: 12 },
    ] });
  it('Kasse: Summe aller Veränderungen ist je Monat genau der externe Teil; Ergebnis, Steuern, Gruppe bleiben', () => {
    const a = rechneMit({ ...mitDarlehen(), darlehen: undefined }, null), b = rechneMit(mitDarlehen(), null);
    for (let i = 0; i < 27; i++) {
      const m = i + 1;
      expect(b.ug[i].gewinn).toBeCloseTo(a.ug[i].gewinn, 9); expect(b.ug[i].st.summe).toBeCloseTo(a.ug[i].st.summe, 9);
      expect(b.ug[i].kdvGewinn).toBeCloseTo(a.ug[i].kdvGewinn, 9); expect(b.ug[i].kdvSt.summe).toBeCloseTo(a.ug[i].kdvSt.summe, 9);
      expect(b.kdc[i].gewinn).toBeCloseTo(a.kdc[i].gewinn, 9); expect(b.kdc[i].st.summe).toBeCloseTo(a.kdc[i].st.summe, 9);
      const dUg = b.ug[i].konto - a.ug[i].konto, dKdv = b.ug[i].kdvKonto - a.ug[i].kdvKonto, dKdc = b.kdc[i].konto - a.kdc[i].konto, dPr = b.pr[i].luftKum - a.pr[i].luftKum;
      // eigene Erwartung je Seite (kumuliert)
      expect(dKdv, `kdv ${m}`).toBeCloseTo((m < 10 ? 0 : -1500) - (m >= 3 ? 700 : 0), 9);
      expect(dPr, `privat ${m}`).toBeCloseTo((m >= 10 ? 1500 : 0) + (m >= 3 ? 700 : 0), 9);
      expect(dKdc, `kdc ${m}`).toBeCloseTo(m >= 2 && m < 8 ? -5000 : 0, 9);
      expect(dUg, `ug ${m}`).toBeCloseTo((m >= 2 && m < 8 ? 5000 : 0) + (m >= 4 && m < 12 ? 2000 : 0), 9);
      expect(dUg + dKdv + dKdc + dPr, `Summe ${m}`).toBeCloseTo(m >= 4 && m < 12 ? 2000 : 0, 9);
      expect(b.gruppe[i] - a.gruppe[i], `Gruppe ${m}`).toBeCloseTo(m >= 4 && m < 12 ? 2000 : 0, 9);
    }
  });
  it('Business-Sicht: private Seite → „außerhalb“, Notiz weg, rein private Darlehen weg, Rechnung der Gesellschaften gleich', () => {
    const d = { ...mitDarlehen(), darlehen: [...mitDarlehen().darlehen!, { id: 'd5', name: 'Privat an Selbst', geber: 'privat' as const, nehmer: 'kdc' as const, betrag: 999, aus: 1, zurueck: 0, notiz: 'geheim' }] };
    d.darlehen[0] = { ...d.darlehen[0], notiz: 'privat geheim' };
    const b = businessSicht(d);
    expect(b.darlehen!.map(l => l.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(b.darlehen!.every(l => l.geber !== 'privat' && l.geber !== 'kdc' && l.nehmer !== 'privat' && l.nehmer !== 'kdc')).toBe(true);
    expect(JSON.stringify(b)).not.toContain('geheim');
    expect(JSON.stringify(rechneMit(b, null).ug)).toBe(JSON.stringify(rechneMit(d, null).ug));
  });
  it.fails('Fund (klein): der frei gewählte NAME eines Darlehens mit privater Seite geht in die Business-Sicht', () => {
    const d = { ...mitDarlehen(), darlehen: [{ id: 'd1', name: 'Erbe Oma für Kevin', geber: 'privat' as const, nehmer: 'kdv' as const, betrag: 1500, aus: 0, zurueck: 0 }] };
    expect(JSON.stringify(businessSicht(d))).not.toContain('Erbe Oma');
  });
  it.fails('Fund (mittel): Altdarlehen per Handwert auf der GmbH-Seite „ausgeschaltet“ — die Selbstständigkeit zahlt trotzdem aus (Geld verschwindet)', () => {
    // Kevin: „Es gibt kein Gesellschafterdarlehen.“ Wer das vor dem 05.10. über Handwerte gelöst hat (Kapital = nur Stammkapital, Rückzahlung 0),
    // erwartet dieselbe Gruppe wie mit darlehenKevin = 0. Der neue Kern bucht die Gegenseite in der Selbstständigkeit trotzdem (−3.000 Okt 26 … +3.000 Monat 14).
    const hand = planFix(14000); hand.plan = { ...hand.plan, 'ug.kapital:1': 2500, 'ug.darlehen:14': 0 };
    const null0 = { ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } };
    const a = rechneMit(hand, null), b = rechneMit(null0, null);
    for (let i = 0; i < 27; i++) expect(a.gruppe[i], `Gruppe ${i + 1}`).toBeCloseTo(b.gruppe[i], 6);
  });
  it('Fund (mittel, dokumentiert): ein Business-Konto darf annahmen.darlehenKevin schreiben — das bewegt das Konto der (privaten) Selbstständigkeit', () => {
    const d = { ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } };
    expect(businessPfadErlaubt('/annahmen/darlehenKevin', d, 8000)).toBeNull();
    const r = wendeOperationenAn(d, [{ pfad: '/annahmen/darlehenKevin', neu: 8000 }], 'team', '2026-10-05T10:00:00.000Z').dokument;
    expect(rechneMit(r, null).kdc[0].konto - rechneMit(d, null).kdc[0].konto).toBeCloseTo(-8000, 6);
  });
  it.fails('Fund (klein): Rückzahlung nach Planende (über den Schreibweg) wird auf den letzten Planmonat gezogen statt „offen“ zu bleiben', () => {
    const l = pruefeEinDarlehen({ id: 'x', geber: 'privat', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 40 }, 27)!;
    expect(l.zurueck === 0 || l.zurueck > 27).toBe(true);   // Code: 27 → Rückzahlung im Dez 28
  });
});

// ── d) Sicht-Leaks und Schreibrechte ─────────────────────────────────────────────────────────────────────────────────
describe('d) Business-Sicht ist unabhängig von allem Privaten (Dokument, Kennzahlen, Protokoll)', () => {
  /** Alles, was seit 05.10. privat ist, kräftig verändern — über den echten Schreibweg (mit Protokoll). */
  const privatVeraendert = (d: FinanzDaten): FinanzDaten => wendeOperationenAn(d, [
    { pfad: '/selbst/kontoStart', neu: 987654 }, { pfad: '/selbst/lohnVorPlan', neu: 55555 }, { pfad: '/selbst/estVorausgezahlt', neu: 4444 },
    { pfad: '/selbst/posten/-', neu: { id: 'sp9', name: 'Geheimhonorar', art: 'einnahme', betrag: 77777, status: 'offen' } },
    { pfad: '/steuern/kdc/param/veranlagung', neu: 'zusammen' }, { pfad: '/steuern/kdc/param/werbungskosten', neu: 3333 },
    { pfad: '/plan/kdc.umsatz:3', neu: 42424 }, { pfad: '/plan/ab.est:0', neu: 31313 }, { pfad: '/plan/p.luft:4', neu: -9999 },
    { pfad: '/darlehen/-', neu: { id: 'dp', name: 'Geheimdarlehen', geber: 'privat', nehmer: 'kdc', betrag: 12121, aus: 2, zurueck: 9, notiz: 'Geheimnotiz' } },
    { pfad: '/privatBudget/-', neu: { id: 'pb9', name: 'Geheimbudget', einheit: 'privat', gruppe: 'Flexibel', soll: 5000, typ: 'flex' } },
  ], 'kevin', '2026-10-05T10:00:00.000Z').dokument;
  /** Ein privater Eintrag, ANGEHÄNGT über `/-` (der übliche Weg der Oberfläche für „+ neu“). */
  const angehaengt = (pfad: string, neu: unknown): FinanzDaten => wendeOperationenAn(planAltMigration(), [{ pfad, neu }], 'kevin', '2026-10-05T10:00:00.000Z').dokument;
  it.fails('Fund (mittel): angehängter Baustein der Selbstständigkeit steht mit Name und Preis im Business-Protokoll', () => {
    const v = angehaengt('/planszenarien/id=ps2/bausteine/-', neuerBaustein('k9', { art: 'umsatz', einheit: 'kdc', name: 'Geheimkunde', preis: 9999, start: 1 }));
    expect(JSON.stringify(businessSicht(v).protokoll)).not.toContain('Geheimkunde');
  });
  it.fails('Fund (mittel): angehängte Sachkosten-Zeile der Selbstständigkeit steht im Business-Protokoll', () => {
    const v = angehaengt('/sachkosten/-', { id: 'sk9', name: 'Geheimbuero', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 700, ab: 1 });
    expect(JSON.stringify(businessSicht(v).protokoll)).not.toContain('Geheimbuero');
  });
  it.fails('Fund (mittel): angehängtes privates Ereignis steht im Business-Protokoll', () => {
    const v = angehaengt('/szenarien/id=s1/ereignisse/-', { id: 'e9', name: 'Geheimreise', einheit: 'privat', betrag: 4000, monat: 5 });
    expect(JSON.stringify(businessSicht(v).protokoll)).not.toContain('Geheimreise');
  });
  it('Gegenprobe: angehängte private Posten, Schulden, Buchungen, Darlehen bleiben aus dem Business-Protokoll', () => {
    for (const [pfad, neu] of [
      ['/posten/-', { id: 'po9', name: 'Geheimposten', art: 'rechnung', einheit: 'selbststaendigkeit', betrag: 1, status: 'offen' }],
      ['/schulden/-', { id: 'sc9', name: 'Geheimschuld', einheit: 'privat', rest: 1, rate: 1, zins: 0, start: 1, status: 'läuft' }],
      ['/darlehen/-', { id: 'dl9', name: 'Geheimdarlehen', geber: 'privat', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 0 }],
    ] as const) expect(JSON.stringify(businessSicht(angehaengt(pfad, neu)).protokoll), pfad).not.toContain('Geheim');
  });
  it('GET-Dokument der Business-Sicht ändert sich nicht, wenn sich nur Privates ändert (bis auf Stand/Protokoll-Länge)', () => {
    const d = planAltMigration(), v = privatVeraendert(d);
    const ohne = (x: FinanzDaten) => ({ ...businessSicht(x), protokoll: [] as unknown[], stand: '' });
    expect(JSON.stringify(ohne(v))).toBe(JSON.stringify(ohne(d)));
    expect(businessSicht(v).protokoll).toEqual([]);   // keiner der privaten Schritte erscheint im Business-Protokoll
    expect(JSON.stringify(businessSicht(v))).not.toMatch(/Geheim|987654|55555|77777|42424|31313|12121/);
  });
  it('Kennzahlen der Business-Sicht (?nur=kennzahlen&sicht=business) ändern sich nicht, wenn sich nur Privates ändert', () => {
    const d = planAltMigration(), v = privatVeraendert(d);
    const k = (x: FinanzDaten) => { const r = kennzahlenFuerSicht(kennzahlenVon(fuerSicht(x, 'business'), 'business'), 'business') as Record<string, unknown>; delete r.stand; return r; };
    expect(JSON.stringify(k(v))).toBe(JSON.stringify(k(d)));
  });
  it.fails('Fund (klein): Kennzahlen der Business-Sicht rechnen den GEMEINSAMEN Arbeitsplan, nicht den des Business-Bereichs', () => {
    const d = planAltMigration();   // bereiche: privat → ps2, business → ps3; gemeinsam: ps2
    const k = kennzahlenFuerSicht(kennzahlenVon(fuerSicht(d, 'business'), 'business'), 'business') as Record<string, unknown>;
    const ui = rechneMit(mitBereich(businessSicht(d), 'business'), businessSicht(d).planszenarien!.find(p => p.id === 'ps3')!);
    expect(k.arbeitsplanId).toBe('ps3');
    expect(k.kdvDez28).toBeCloseTo(ui.kz.kdvDez28, 6);
  });
  it('Gesellschafts-Zahlen (MAKE, KD Ventures) gerechnet aus der Business-Sicht = gerechnet aus der vollen Sicht', () => {
    const v = privatVeraendert(planAltMigration());
    for (const ps of ['ps2', 'ps3']) {
      const voll = rechneMit(v, v.planszenarien!.find(p => p.id === ps)!), bus = rechneMit(businessSicht(v), businessSicht(v).planszenarien!.find(p => p.id === ps)!);
      expect(JSON.stringify(bus.ug)).toBe(JSON.stringify(voll.ug));
    }
  });
});

describe('d) Business-Schreibwege, die Privat verändern', () => {
  it.fails('Fund (mittel): /annahmen als Ganzes ersetzen ist aus Business erlaubt — überschreibt die private Netto-Tabelle', () => {
    const d = planFix();
    expect(businessPfadErlaubt('/annahmen', d, { ...d.annahmen, nettoTabelle: [[0, 0], [1, 1]] })).not.toBeNull();
  });
  it('… und der Schreibweg nimmt das an: die Netto-Tabelle ist danach der Business-Platzhalter', () => {
    const d = planFix(); const b = businessSicht(d);
    const r = wendeOperationenAn(d, [{ pfad: '/annahmen', neu: { ...b.annahmen, kevinBrutto: 3100 } }], 'team', '2026-10-05T10:00:00.000Z').dokument;
    expect(r.annahmen.nettoTabelle).toEqual([[0, 0], [1, 1]]);
    expect(d.annahmen.nettoTabelle.length).toBe(4);
  });
  it.fails('Fund (mittel): einen Treiber (/szenarien/id=…) als Ganzes ersetzen ist aus Business erlaubt — private Ereignisse gehen verloren', () => {
    const d = planFix(); const s = businessSicht(d).szenarien[0];   // die Business-Sicht kennt die privaten Ereignisse nicht
    expect(businessPfadErlaubt('/szenarien/id=s1', d, s)).not.toBeNull();
  });
  it('… und so sähe der Verlust aus: das private Ereignis „Umzug“ ist danach weg', () => {
    const d = planFix(); const s = businessSicht(d).szenarien[0];
    const r = wendeOperationenAn(d, [{ pfad: '/szenarien/id=s1', neu: s }], 'team', '2026-10-05T10:00:00.000Z').dokument;
    expect(d.szenarien[0].ereignisse!.some(e => e.einheit === 'privat')).toBe(true);
    expect(r.szenarien[0].ereignisse!.some(e => e.einheit === 'privat')).toBe(false);
  });
  it.fails('Fund (klein): ein neues Planszenario mit Steuern der Selbstständigkeit (/planszenarien/-) ist aus Business erlaubt', () => {
    const d = planFix();
    expect(businessPfadErlaubt('/planszenarien/-', d, { id: 'neu', name: 'X', basis: 's1', bausteine: [], annahmen: { steuern: { kdc: { param: { veranlagung: 'zusammen' } } } } })).not.toBeNull();
  });
  it.fails('Fund (klein, außerhalb des Finanzplans): Lichtfäden führen Posten der Selbstständigkeit im Business-Space', () => {
    const s = finanzStraenge({ posten: [{ id: 'p1', name: 'Steuer Selbst', art: 'rechnung', einheit: 'selbststaendigkeit', status: 'offen', faellig: '2026-10-20' }], heute: '2026-10-05' });
    expect(s[0].pfad.join('/')).toContain('privat');
  });
});

// ── e) Umzug: Handwerte des Abschlusses bekommen eine neue Bedeutung ─────────────────────────────────────────────────────
describe('e) Umzug — Abschluss-Handwerte (ab.est/ab.zve) bekommen eine neue Bedeutung', () => {
  it('Fund (mittel, dokumentiert): ein alter Handwert ab.est:0 = 50 senkt die Steuer 2026 jetzt um 860 € (Formel neu 910 statt 21)', () => {
    // planAltMigration: Gewinn Jan–Sep 16.000, Abzüge 3.500, Gehalt 1 Nov+Dez 6.000 − 1.230 = 4.770.
    // Vorher: ab.est-Formel = T(12.500) = 21 → der Handwert 50 lag 29 € DARÜBER (und zählte nur in „frei nach Abschluss“).
    // Jetzt: Formel = T(17.270) − T(1.270) = 910 → derselbe Handwert liegt 860 € DARUNTER und mindert die Jahressteuer 2026.
    expect(T26(12500)).toBe(21); expect(T26(17270) - T26(1270)).toBe(910);
    const mit = planAltMigration(), ohne = planAltMigration();
    const { 'ab.est:0': _x, ...rest } = ohne.plan; ohne.plan = rest;
    const ps = (d: FinanzDaten) => d.planszenarien!.find(p => p.id === 'ps3')!;   // ps3: Zahlweise Folgejahr, Juni
    const zMit = rechneMit(mit, ps(mit)).kdc[8].st.zahlung, zOhne = rechneMit(ohne, ps(ohne)).kdc[8].st.zahlung;
    expect(zMit - zOhne).toBeCloseTo(50 - 910, 6);
  });
  it('Splitting: Gehalt 2 zählt 2026 nur ab Okt — es gibt kein Feld für Jan–Sep (nur Gehalt 1 hat lohnVorPlan)', () => {
    const d = planFix(14000);
    d.steuern = { kdc: { param: { veranlagung: 'zusammen' } } };
    d.selbst = { ...d.selbst, lohnVorPlan: 20000 };
    const g = rechneMit(d, null);
    // Gehalt 1: 20.000 + Nov/Dez 6.000 − 1.230; Gehalt 2: Okt/Nov über die Selbstständigkeit + Dez aus der GmbH = 7.500 − 1.230. Jan–Sep von Gehalt 2 fehlt.
    expect(g.lohn[2026]).toBe(26000 - 1230 + 7500 - 1230);
  });
});
