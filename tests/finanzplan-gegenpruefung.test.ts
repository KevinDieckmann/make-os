// ─── Gegenprüfung finanzplan-5 (05.10.) — unabhängige Rechnung, adversarial ─────────────────────────────────────────────
// Kevin: „Achte bei der Finanzplanung nur, dass wir das wirklich sauber machen.“ Alle Erwartungswerte hier sind UNABHÄNGIG vom Code des
// Autors gerechnet (eigene Tarif-, Soli- und Gewerbesteuer-Formeln, eigene Summen). Erfundene Zahlen, nie echte Daten.
//
// `it.fails(...)` = gefundener Fehler: der Test beschreibt das RICHTIGE Verhalten und schlägt heute fehl. Wird der Fehler behoben, schlägt
// `it.fails` an — dann auf `it` umstellen. Normale `it` = geprüft und korrekt (oder ein Fund, dessen Ausmaß dokumentiert wird).
// finanzplan-5b (05.10.): Funde 1–13 behoben (jetzt `it`, Titel „Fund … — behoben“), Wächter je Fund unten im Abschnitt f). Fund 14 (Lichtfäden)
// gehört zum Paket selbst-privat und bleibt hier `it.fails`.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { estJahre, jahrVon, kalMonat, lohnJahre, rechneSelbst, darlehenFluesse } from '../lib/finanzen/rechenkern';
import { estTarif, jahresSteuer, neuerSteuerrechner, TARIF_2026, type Steuerparameter } from '../lib/finanzen/ertragsteuer';
import { rechneMit, neuesPlanszenario, neuerBaustein, mitBereich } from '../lib/finanzen/szenarien';
import { leeresDokument, monatsLabels, wendeOperationenAn, pruefeDokument, OperationUngueltig, type Operation } from '../lib/finanzen/plan/operationen';
import { businessSicht, businessPfadErlaubt, fuerSicht, kennzahlenFuerSicht, protokollBusiness } from '../lib/finanzen/plan/sicht';
import { schreibeAlsBusiness, privatTeil } from '../lib/finanzen/plan/business-schreiben';
import { kennzahlenVon } from '../lib/finanzen/plan/speicher';
import { pruefeEinDarlehen, darlehenFuerBusiness, DARLEHEN_NAME_PRIVAT } from '../lib/finanzen/darlehen';
import { KERN_STAND, BEDEUTUNG_NEU_FP5, HAND_FELDER } from '../lib/finanzen/handwerte';
import { annahmeGruppen } from '../lib/finanzen/annahmen-felder';
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

/** Die erwartete Jahressteuer (Mehrsteuer-Methode, wie Kevins Vorgabe; § 35 mit Ermäßigungshöchstbetrag): G Gewinn, L Lohneinkünfte (nach Pauschbetrag), A Vorsorge+Sonderausgaben. */
function erwartet(G: number, L: number, A: number, split = false, heb = 400) {
  const tarif = split ? T26split : T26;
  const estG = tarif(Math.max(0, G + L - A)), estL = tarif(Math.max(0, L - A)), mehr = estG - estL;
  const MB = 0.035 * Math.max(0, G - 24500), gewst = MB * heb / 100;
  // § 35 EStG (seit finanzplan-5b gesetzlich): Ermäßigungshöchstbetrag = tarifliche ESt × positive gewerbliche / Summe der positiven Einkünfte,
  // dazu ≤ GewSt und ≤ 4 × Messbetrag. (Vorher: Deckel = Mehrsteuer — Fund § 35 unten.)
  const gP = Math.max(0, G), lP = Math.max(0, L);
  const hoechst = gP > 0 ? tarif(Math.max(0, G + L - A)) * gP / (gP + lP) : 0;
  const anr = Math.min(4 * MB, gewst, hoechst);
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
  }, 30_000);
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
  }, 30_000);   // 300.000 Prüfschritte — auf dem 8-GB-Mac unter Last länger als die Vorgabe 5 s
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

  it('Fund (klein, bekannt): § 35 EStG — Anrechnung höchstens Ermäßigungshöchstbetrag (ESt × gewerbliche / alle positiven Einkünfte), nicht die Mehrsteuer', () => {
    // G 40.000, Lohneinkünfte 15.000, Abzüge 30.000: zvE 25.000 → ESt 2.850 (alles Mehrsteuer, Lohn allein steuerfrei).
    // Höchstbetrag = 2.850 × 40.000 / 55.000 = 2.072,73; 4 × Messbetrag = 2.170 → gesetzlich 2.072,73, Code 2.170.
    const j = jahresSteuer(P({ estAbzug: 30000, lohn: { 2027: 15000 } }), 40000, 0, 2027);
    expect(j.anrechnung).toBeCloseTo(T26(25000) * 40000 / 55000, 2);
  });

  it('Fund (klein): Gewerbesteuer-Verlustvortrag geht verloren, wenn auf ein Jahr MIT Lohn ein Jahr OHNE Lohn folgt', () => {
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
  it('Fund (klein, Anzeige): Karte „Einkommensteuer gemeinsam“ (estJahre) ignoriert einen Handwert auf ab.est — und der Hinweis darauf prüft nur kdc.*', () => {
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
  it('Fund (klein): der frei gewählte NAME eines Darlehens mit privater Seite geht in die Business-Sicht', () => {
    const d = { ...mitDarlehen(), darlehen: [{ id: 'd1', name: 'Erbe Oma für Kevin', geber: 'privat' as const, nehmer: 'kdv' as const, betrag: 1500, aus: 0, zurueck: 0 }] };
    expect(JSON.stringify(businessSicht(d))).not.toContain('Erbe Oma');
  });
  it('Fund (mittel): Altdarlehen per Handwert auf der GmbH-Seite „ausgeschaltet“ — die Selbstständigkeit zahlt trotzdem aus (Geld verschwindet)', () => {
    // Kevin: „Es gibt kein Gesellschafterdarlehen.“ Wer das vor dem 05.10. über Handwerte gelöst hat (Kapital = nur Stammkapital, Rückzahlung 0),
    // erwartet dieselbe Gruppe wie mit darlehenKevin = 0. Der neue Kern bucht die Gegenseite in der Selbstständigkeit trotzdem (−3.000 Okt 26 … +3.000 Monat 14).
    const hand = planFix(14000); hand.plan = { ...hand.plan, 'ug.kapital:1': 2500, 'ug.darlehen:14': 0 };
    const null0 = { ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } };
    const a = rechneMit(hand, null), b = rechneMit(null0, null);
    for (let i = 0; i < 27; i++) expect(a.gruppe[i], `Gruppe ${i + 1}`).toBeCloseTo(b.gruppe[i], 6);
  });
  it('Fund 2 (mittel) — behoben: annahmen.darlehenKevin aus Business bewegt keine private Kasse mehr (Geber außerhalb des Plans)', () => {
    // Vorher: −8.000 im Konto der (privaten) Selbstständigkeit. Jetzt: das Geld kommt in die GmbH, Selbstständigkeit und Privat bleiben gleich.
    const d = { ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } };
    expect(businessPfadErlaubt('/annahmen/darlehenKevin', d, 8000)).toBeNull();   // eine Annahme der GmbH — bleibt aus Business schreibbar
    const w = schreibeAlsBusiness(d, [{ pfad: '/annahmen/darlehenKevin', neu: 8000 }], 'team', '2026-10-05T10:00:00.000Z');
    expect(w.ok).toBe(true);
    const a = rechneMit(d, null), b = rechneMit(w.ok ? w.r.dokument : d, null);
    for (let i = 0; i < 27; i++) {
      expect(b.kdc[i].konto, `Selbstständigkeit ${i + 1}`).toBeCloseTo(a.kdc[i].konto, 9);
      expect(b.pr[i].luftKum, `Privat ${i + 1}`).toBeCloseTo(a.pr[i].luftKum, 9);
    }
    expect(b.ug[0].konto - a.ug[0].konto).toBeCloseTo(8000, 6);
  });
  it('Fund (klein): Rückzahlung nach Planende (über den Schreibweg) wird auf den letzten Planmonat gezogen statt „offen“ zu bleiben', () => {
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
  it('Fund (mittel): angehängter Baustein der Selbstständigkeit steht mit Name und Preis im Business-Protokoll', () => {
    const v = angehaengt('/planszenarien/id=ps2/bausteine/-', neuerBaustein('k9', { art: 'umsatz', einheit: 'kdc', name: 'Geheimkunde', preis: 9999, start: 1 }));
    expect(JSON.stringify(businessSicht(v).protokoll)).not.toContain('Geheimkunde');
  });
  it('Fund (mittel): angehängte Sachkosten-Zeile der Selbstständigkeit steht im Business-Protokoll', () => {
    const v = angehaengt('/sachkosten/-', { id: 'sk9', name: 'Geheimbuero', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 700, ab: 1 });
    expect(JSON.stringify(businessSicht(v).protokoll)).not.toContain('Geheimbuero');
  });
  it('Fund (mittel): angehängtes privates Ereignis steht im Business-Protokoll', () => {
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
  it('Fund (klein): Kennzahlen der Business-Sicht rechnen den GEMEINSAMEN Arbeitsplan, nicht den des Business-Bereichs', () => {
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
  it('Fund (mittel): /annahmen als Ganzes ersetzen ist aus Business erlaubt — überschreibt die private Netto-Tabelle', () => {
    const d = planFix();
    expect(businessPfadErlaubt('/annahmen', d, { ...d.annahmen, nettoTabelle: [[0, 0], [1, 1]] })).not.toBeNull();
  });
  it('… und der Schreibweg nimmt das an: die Netto-Tabelle ist danach der Business-Platzhalter', () => {
    const d = planFix(); const b = businessSicht(d);
    const r = wendeOperationenAn(d, [{ pfad: '/annahmen', neu: { ...b.annahmen, kevinBrutto: 3100 } }], 'team', '2026-10-05T10:00:00.000Z').dokument;
    expect(r.annahmen.nettoTabelle).toEqual([[0, 0], [1, 1]]);
    expect(d.annahmen.nettoTabelle.length).toBe(4);
  });
  it('Fund (mittel): einen Treiber (/szenarien/id=…) als Ganzes ersetzen ist aus Business erlaubt — private Ereignisse gehen verloren', () => {
    const d = planFix(); const s = businessSicht(d).szenarien[0];   // die Business-Sicht kennt die privaten Ereignisse nicht
    expect(businessPfadErlaubt('/szenarien/id=s1', d, s)).not.toBeNull();
  });
  it('… und so sähe der Verlust aus: das private Ereignis „Umzug“ ist danach weg', () => {
    const d = planFix(); const s = businessSicht(d).szenarien[0];
    const r = wendeOperationenAn(d, [{ pfad: '/szenarien/id=s1', neu: s }], 'team', '2026-10-05T10:00:00.000Z').dokument;
    expect(d.szenarien[0].ereignisse!.some(e => e.einheit === 'privat')).toBe(true);
    expect(r.szenarien[0].ereignisse!.some(e => e.einheit === 'privat')).toBe(false);
  });
  it('Fund (klein): ein neues Planszenario mit Steuern der Selbstständigkeit (/planszenarien/-) ist aus Business erlaubt', () => {
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
  it('Fund 5 (Ausmaß, ohne Umzug gerechnet): ein alter Handwert ab.est:0 = 50 würde die Steuer 2026 um 860 € senken (Formel neu 910 statt 21)', () => {
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
  it('Splitting ohne Feld: Gehalt 2 zählt 2026 nur ab Okt, solange `selbst.lohn2VorPlan` fehlt (Fund 11: Feld seit finanzplan-5b, Test in f)', () => {
    const d = planFix(14000);
    d.steuern = { kdc: { param: { veranlagung: 'zusammen' } } };
    d.selbst = { ...d.selbst, lohnVorPlan: 20000 };
    const g = rechneMit(d, null);
    // Gehalt 1: 20.000 + Nov/Dez 6.000 − 1.230; Gehalt 2: Okt/Nov über die Selbstständigkeit + Dez aus der GmbH = 7.500 − 1.230. Jan–Sep von Gehalt 2 fehlt.
    expect(g.lohn[2026]).toBe(26000 - 1230 + 7500 - 1230);
  });
});

// ── f) finanzplan-5b: Wächter je Fund (05.10., nach der Behebung) ─────────────────────────────────────────────────────────
const JETZT = '2026-10-05T10:00:00.000Z';
const ueberPruefung = (d: FinanzDaten): FinanzDaten => { const p = pruefeDokument(JSON.parse(JSON.stringify(d))); if (!p.ok) throw new Error(p.fehler); return p.dokument; };

describe('f) Fund 1+2: Altdarlehen außerhalb des Plans; Handwerte auf Darlehen — die Gegenseite folgt dem wirksamen Wert', () => {
  it('Altdarlehen: Geld in die GmbH (Monat 1) und zurück (Rückzahlmonat) — Selbstständigkeit und Privat sehen davon nichts', () => {
    const mit = planFix(14000), ohne = { ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 } };
    const a = rechneMit(mit, null), b = rechneMit(ohne, null);
    for (let i = 0; i < 27; i++) {
      expect(a.kdc[i].konto - b.kdc[i].konto, `kdc ${i + 1}`).toBeCloseTo(0, 9);
      expect(a.pr[i].luftKum - b.pr[i].luftKum, `privat ${i + 1}`).toBeCloseTo(0, 9);
    }
    expect(a.ug[0].kapital - b.ug[0].kapital).toBe(3000);   // rein im Monat 1 (mit dem Stammkapital)
    expect(a.ug[13].darlehen - b.ug[13].darlehen).toBe(3000);   // hinaus im Monat 14 — nach außerhalb des Plans
    expect(rechneSelbst(mit).darlehen).toBe(0);   // der Abschluss zieht nichts mehr ab
  });
  const zwei = (): FinanzDaten => ({ ...planFix(14000), annahmen: { ...planFix(14000).annahmen, darlehenKevin: 0 }, darlehen: [
    { id: 'a', name: 'A', geber: 'privat', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 10 },
    { id: 'b', name: 'B', geber: 'kdc', nehmer: 'kdv', betrag: 500, aus: 0, zurueck: 10 },
  ] });
  it('Handwert auf der Nehmer-Seite (KD Ventures zahlt im Monat 10 nur 1.000 statt 2.000 zurück): die Geber bekommen anteilig 750 + 250', () => {
    const d = zwei(); d.plan = { ...d.plan, 'kdv.darlehenAus:10': 1000 };
    const f = darlehenFluesse(d, 27);
    expect(f.kdv.aus[9]).toBe(2000);   // die Formel; den Handwert setzt der Kern
    expect(f.privat.ein[9]).toBeCloseTo(750, 9); expect(f.kdc.ein[9]).toBeCloseTo(250, 9);
    const g = rechneMit(d, null), o = rechneMit(zwei(), null);
    expect(g.ug[9].kdvDarlehenAus).toBe(1000);
    expect(g.pr[9].darlehenEin).toBeCloseTo(750, 9); expect(g.kdc[9].darlehenEin).toBeCloseTo(250, 9);
    // Die Summe aller Kassen bleibt gleich: was KD Ventures behält, fehlt den Gebern — nichts entsteht, nichts verschwindet.
    for (let i = 0; i < 27; i++) {
      const s = (x: typeof g) => x.ug[i].kdvKonto + x.kdc[i].konto + x.pr[i].luftKum;
      expect(s(g) - s(o), `Summe ${i + 1}`).toBeCloseTo(0, 6);
    }
  });
  it('Handwert auf der Geber-Seite: der Nehmer folgt; haben beide Seiten einen Handwert, behält jede ihren', () => {
    const d = zwei(); d.plan = { ...d.plan, 'p.darlehenEin:10': 0 };
    expect(rechneMit(d, null).ug[9].kdvDarlehenAus).toBeCloseTo(500, 9);   // nur noch B zahlt zurück
    const e = zwei(); e.plan = { ...e.plan, 'p.darlehenEin:10': 0, 'kdv.darlehenAus:10': 2000 };
    expect(rechneMit(e, null).ug[9].kdvDarlehenAus).toBe(2000); expect(rechneMit(e, null).pr[9].darlehenEin).toBe(0);
  });
  it('Handwert = Formelwert ändert nichts; Handwert ohne Darlehen in der Zelle hat keine Gegenseite', () => {
    const d = zwei(); d.plan = { ...d.plan, 'kdv.darlehenAus:10': 2000, 'p.darlehenAus:5': 777 };
    expect(JSON.stringify(darlehenFluesse(d, 27))).toBe(JSON.stringify(darlehenFluesse(zwei(), 27)));
  });
  it('Annahmen-Karte: Hinweis „Nur eintragen, wenn es ein echtes Darlehen gibt — sonst 0“', () => {
    const f = annahmeGruppen('A', 'B').flatMap(g => g.felder).find(x => x.k === 'darlehenKevin')!;
    expect(f.hinweis).toContain('Nur eintragen, wenn es ein echtes Darlehen gibt — sonst 0');
  });
});

describe('f) Fund 3: Business-Protokoll prüft den NEUEN Eintrag bei „/-“', () => {
  const anh = (pfad: string, neu: unknown) => wendeOperationenAn(planAltMigration(), [{ pfad, neu }], 'kevin', JETZT).dokument;
  it('Business-Einträge, angehängt, stehen im Business-Protokoll; private nicht — die Kennung steht im Protokoll', () => {
    const ja: [string, { id: string }][] = [
      ['/sachkosten/-', { id: 'skb', name: 'Bueromiete', einheit: 'ug', gruppe: 'Räume', soll: 1, ab: 1 } as never],
      ['/planszenarien/id=ps3/bausteine/-', neuerBaustein('kb', { art: 'umsatz', einheit: 'ug', name: 'Produktkunde', preis: 1, start: 1 })],
      ['/szenarien/id=s1/ereignisse/-', { id: 'eb', name: 'Messestand', einheit: 'ug', betrag: 1, monat: 5 } as never],
      ['/darlehen/-', { id: 'db', name: 'Bankkredit', geber: 'extern', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0 } as never],
    ];
    for (const [pfad, neu] of ja) {
      const v = anh(pfad, neu);
      expect(v.protokoll[0].eintrag, pfad).toBe(neu.id);
      expect(businessSicht(v).protokoll.length, pfad).toBe(1);
    }
    const nein: [string, unknown][] = [
      ['/sachkosten/-', { id: 'skp', name: 'Geheim', einheit: 'privat', gruppe: 'X', soll: 1, ab: 1 }],
      ['/planszenarien/id=ps3/bausteine/-', neuerBaustein('kp', { art: 'umsatz', einheit: 'privat', name: 'Geheim', preis: 1, start: 1 })],
      ['/planszenarien/-', { ...neuesPlanszenario('psneu', 'Geheimplan', 's1', JETZT) }],
      ['/szenarien/-', { ...planFix().szenarien[0], id: 's9', name: 'Geheimtreiber' }],
    ];
    for (const [pfad, neu] of nein) expect(JSON.stringify(businessSicht(anh(pfad, neu)).protokoll), pfad).not.toContain('Geheim');
  });
  it('ältere Einträge mit „/-“ ohne Kennung und Einträge zu Gelöschtem: nie im Business-Protokoll', () => {
    const d = planAltMigration();
    const e = (eintrag?: string) => ({ wer: 'k', wann: JETZT, feld: 'x', alt: '', neu: 'x', pfad: '/sachkosten/-', ...(eintrag ? { eintrag } : {}) });
    expect(protokollBusiness(e(), d)).toBe(false);
    expect(protokollBusiness(e('gibtsnicht'), d)).toBe(false);
    expect(protokollBusiness(e('sk1'), d)).toBe(true);
    expect(protokollBusiness(e('sk-kdc'), d)).toBe(false);
  });
});

describe('f) Fund 4: Wächter-Tabelle „Pfad → aus Business erlaubt?“ über alle Wurzelschlüssel', () => {
  const basis = (): FinanzDaten => {
    const d = planAltMigration();
    d.schulden = [{ id: 'sb', name: 'Bank', einheit: 'ug', rest: 1, rate: 1, zins: 0, start: 1, status: 'läuft' }, { id: 'sp', name: 'P', einheit: 'privat', rest: 1, rate: 1, zins: 0, start: 1, status: 'läuft' }];
    d.posten = [{ id: 'pb', art: 'rechnung', einheit: 'ug', name: 'R', betrag: 1, status: 'offen' }, { id: 'pp', art: 'rechnung', einheit: 'selbststaendigkeit', name: 'S', betrag: 1, status: 'offen' }];
    d.buchungen = [{ id: 'bb', d: '2026-10-01', b: -1, n: 'x', k: 'k', z: 'sk1', e: 'ug' }, { id: 'bp', d: '2026-10-01', b: -1, n: 'y', k: 'k', z: 'pb1' }];
    d.ziele = [{ id: 'zb', name: 'Z', quelle: 'ug.frei', ziel: 1, bis: '2027-01', einheit: 'ug' }, { id: 'zp', name: 'P', quelle: 'privat.angespart', ziel: 1, bis: '2027-01', einheit: 'privat' }];
    d.darlehen = [{ id: 'db', name: 'Bank', geber: 'extern', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0 }, { id: 'dp', name: 'Privat', geber: 'privat', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 0 }];
    d.notizen = { 'sk1:3': 'b', 'pb1:3': 'p' }; d.ist = { 'sk1:3': 1, 'pb1:3': 1 };
    d.schwellen = { runwayWarnMonate: 3 } as FinanzDaten['schwellen'];
    d.handAlt = { 'ab.est:0': 50 };
    return d;
  };
  const ps3 = () => planAltMigration().planszenarien!.find(p => p.id === 'ps3')!;
  // [Pfad, neu (undefined = entfernen), aus Business erlaubt?]
  const T: [string, unknown, boolean][] = [
    // Gesperrt für alle (400 im Schreibweg) — aus Business ebenso nie
    ['/version', 4, false], ['/stand', 'x', false], ['/monate', [], false], ['/historie', [], false], ['/meta', {}, false], ['/protokoll', [], false], ['/kernStand', 4, false],
    // Nur Privat
    ['/privatEinnahmen/-', { id: 'x', name: 'x', einheit: 'privat', gruppe: 'x', soll: 1 }, false], ['/privatBudget/id=pb1/soll', 1, false], ['/privatSchulden', [], false],
    ['/check/punkte', [], false], ['/fokus/entscheidung', 'x', false], ['/abschluesse', [], false], ['/regeln/rewe', 'sk1', false], ['/schwellen/runwayWarnMonate', 2, false],
    ['/selbst/kontoStart', 1, false], ['/selbst', {}, false], ['/handAlt/ab.est:0', undefined, false],
    // Geteilte Einstellungen (bewusst gemeinsam, 04.10. spät) — erlaubt; der Privat-Bereich nie
    ['/aktiv', 's1', false], ['/arbeitsplan', 'ps3', false], ['/einstellungen/reserveMonate', 3, true], ['/bereiche/business/arbeitsplan', 'ps3', true],
    ['/bereiche/privat/arbeitsplan', 'ps3', false], ['/bereiche', {}, false],
    // Annahmen: nur Blätter, nie die Netto-Tabelle, nie das Ganze
    ['/annahmen/kevinBrutto', 3100, true], ['/annahmen/darlehenKevin', 0, true], ['/annahmen/nettoTabelle', [[0, 0], [1, 1]], false], ['/annahmen/nettoTabelle/0', [0, 0], false],
    ['/annahmen', { ...planFix().annahmen }, false],
    // Plan / IST / Notizen: nur Business-Schlüssel
    ['/plan/ug.konto:3', 1, true], ['/plan/sk1:3', 1, true], ['/plan/kdc.konto:3', 1, false], ['/plan/ab.est:0', 1, false], ['/plan/p.luft:3', 1, false], ['/plan/pb1:3', 1, false], ['/plan', {}, false],
    ['/ist/sk1:3', 2, true], ['/ist/pb1:3', 2, false], ['/notizen/sk1:3', 'n', true], ['/notizen/pb1:3', 'n', false], ['/notizen', {}, false],
    // Sachkosten
    ['/sachkosten/-', { id: 'n', name: 'n', einheit: 'ug', gruppe: 'g', soll: 1 }, true], ['/sachkosten/-', { id: 'n', name: 'n', einheit: 'selbststaendigkeit', gruppe: 'g', soll: 1 }, false],
    ['/sachkosten/id=sk1/soll', 2, true], ['/sachkosten/id=sk1/einheit', 'selbststaendigkeit', false], ['/sachkosten/id=sk-kdc/soll', 2, false], ['/sachkosten/id=sk-kdc', undefined, false],
    ['/sachkosten/id=sk1', undefined, true], ['/sachkosten', [], false],
    // Treiber (tragen private Lebensereignisse)
    ['/szenarien/id=s1/ob/betrag', 1, true], ['/szenarien/id=s1/name', 'x', true], ['/szenarien/id=s1', { ...planFix().szenarien[0], ereignisse: [] }, false], ['/szenarien/id=s1', undefined, false],
    ['/szenarien', [], false], ['/szenarien/-', { ...planFix().szenarien[0], id: 's7', ereignisse: [] }, true], ['/szenarien/-', { ...planFix().szenarien[0], id: 's8' }, false],
    ['/szenarien/id=s1/ereignisse/id=e2/betrag', 1, true], ['/szenarien/id=s1/ereignisse/id=e1/betrag', 1, false], ['/szenarien/id=s1/ereignisse/id=e2/einheit', 'privat', false],
    ['/szenarien/id=s1/ereignisse', [], false], ['/szenarien/id=s1/ereignisse/-', { id: 'e9', name: 'x', einheit: 'privat', betrag: 1, monat: 2 }, false],
    ['/szenarien/id=s1/ereignisse/id=e2', { id: 'e2', name: 'x', einheit: 'privat', betrag: 1, monat: 2 }, false], ['/szenarien/id=s1/ereignisse/id=e2', { id: 'e2', name: 'x', einheit: 'ug', betrag: 1, monat: 2 }, true],
    // Planszenarien
    ['/planszenarien', [], false], ['/planszenarien/id=ps3', ps3(), false], ['/planszenarien/id=ps2', undefined, false],
    ['/planszenarien/-', { ...neuesPlanszenario('n1', 'n', 's1', JETZT) }, true],
    ['/planszenarien/-', { ...neuesPlanszenario('n2', 'n', 's1', JETZT), annahmen: { steuern: { kdc: { param: { veranlagung: 'zusammen' } } } } }, false],
    ['/planszenarien/-', { ...neuesPlanszenario('n3', 'n', 's1', JETZT), annahmen: { entnahme: { betrag: 1, ab: 1 } } }, false],
    ['/planszenarien/-', { ...neuesPlanszenario('n4', 'n', 's1', JETZT), bausteine: [neuerBaustein('x', { art: 'umsatz', einheit: 'kdc', name: 'x', preis: 1, start: 1 })] }, false],
    ['/planszenarien/id=ps3/name', 'x', true], ['/planszenarien/id=ps3/annahmen', {}, false], ['/planszenarien/id=ps3/annahmen/kevinBrutto', 1, true],
    ['/planszenarien/id=ps2/annahmen/entnahme', undefined, false], ['/planszenarien/id=ps2/annahmen/steuern', {}, false], ['/planszenarien/id=ps2/annahmen/steuern/kdc/param/zahlweise', 'folgejahr', false],
    ['/planszenarien/id=ps2/annahmen/steuern/ug/param/zahlMonat', 5, true], ['/planszenarien/id=ps3/annahmen/ausschuettungSteuer', 0.2, false],
    ['/planszenarien/id=ps2/bausteine/id=k1/preis', 1, false], ['/planszenarien/id=ps2/bausteine/id=b1/preis', 1, true], ['/planszenarien/id=ps2/bausteine/id=b1/einheit', 'kdc', false],
    ['/planszenarien/id=ps2/bausteine', [], false], ['/planszenarien/id=ps2/bausteine/id=k1', undefined, false],
    // Steuern
    ['/steuern/ug/zeilen/gewst/hebesatz', 420, true], ['/steuern/ug', { rechtsform: 'kapital' }, true], ['/steuern/kdc/param/zahlMonat', 5, false], ['/steuern/privat', {}, false], ['/steuern', {}, false],
    // Darlehen
    ['/darlehen/id=db/betrag', 2, true], ['/darlehen/id=dp/betrag', 2, false], ['/darlehen/id=db/geber', 'privat', false], ['/darlehen/id=dp', undefined, false], ['/darlehen', [], false],
    ['/darlehen/-', { id: 'dn', name: 'n', geber: 'ug', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 0 }, true], ['/darlehen/-', { id: 'dn', name: 'n', geber: 'kdc', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 0 }, false],
    // Listen mit Einheit
    ['/schulden/id=sb/rate', 2, true], ['/schulden/id=sp/rate', 2, false], ['/schulden', [], false], ['/schulden/-', { id: 's9', name: 'x', einheit: 'selbststaendigkeit', rest: 1, rate: 1, zins: 0, start: 1, status: 'läuft' }, false],
    ['/posten/id=pb/betrag', 2, true], ['/posten/id=pp/betrag', 2, false], ['/posten', [], false],
    ['/buchungen/id=bb/notiz', 'x', true], ['/buchungen/id=bp/notiz', 'x', false], ['/buchungen/id=bb/e', 'selbststaendigkeit', false], ['/buchungen', [], false],
    ['/ziele/id=zb/ziel', 2, true], ['/ziele/id=zp/ziel', 2, false], ['/ziele/id=zb/quelle', 'gruppe', false], ['/ziele', [], false],
    // Unbekanntes
    ['/irgendwas', 1, false],
  ];
  it('jede Zeile der Tabelle: Schreibweg (Business) entscheidet wie die Tabelle; erlaubte Schritte ändern den privaten Teil nicht', () => {
    for (const [pfad, neu, erlaubt] of T) {
      const d = basis();
      const op: Operation = neu === undefined ? { pfad } : { pfad, neu };
      const w = schreibeAlsBusiness(d, [op], 'team', JETZT);
      expect(w.ok, `${pfad} ${String(JSON.stringify(neu)).slice(0, 60)}: ${w.ok ? 'ok' : w.fehler}`).toBe(erlaubt);
      if (!w.ok) expect([400, 403], pfad).toContain(w.status);
      if (w.ok) expect(JSON.stringify(privatTeil(w.r.dokument, d)), pfad).toBe(JSON.stringify(privatTeil(d, w.r.dokument)));
    }
  });
  it('die Tabelle deckt jeden Wurzelschlüssel von FinanzDaten ab (auch die optionalen)', () => {
    const schluessel = new Set([...Object.keys(basis()), ...Object.keys(leeresDokument('2026-10-05')), 'planszenarien', 'arbeitsplan', 'bereiche', 'steuern', 'schwellen', 'darlehen', 'kernStand', 'handAlt']);
    const abgedeckt = new Set(T.map(([p]) => p.split('/')[1]));
    for (const k of schluessel) expect(abgedeckt.has(k), `Wurzelschlüssel ${k} fehlt in der Tabelle`).toBe(true);
  });
  it('JSON-Patch-Schritte (move/copy mit „from“) gibt es nicht — 400, aus Business wie aus Privat; nichts wird kopiert', () => {
    const d = basis();
    for (const op of [{ op: 'copy', from: '/selbst', pfad: '/annahmen/kevinBrutto' }, { op: 'move', from: '/annahmen/nettoTabelle', pfad: '/sachkosten/id=sk1/name' }, { from: '/selbst/kontoStart', pfad: '/plan/ug.konto:3' }, { op: 'add', pfad: '/sachkosten/id=sk1/soll', neu: 1 }] as unknown as Operation[]) {
      const w = schreibeAlsBusiness(d, [op], 'team', JETZT);
      expect(w.ok).toBe(false); expect(w.ok ? 0 : w.status).toBe(400);
      expect(() => wendeOperationenAn(d, [op], 'kevin', JETZT)).toThrow(OperationUngueltig);
    }
  });
  it('Netz hinter den Pfad-Regeln: ein erlaubter Pfad mit privater Nebenwirkung wird abgelehnt (Planszenario löschen, das der Privat-Bereich rechnet)', () => {
    const d = basis();
    d.planszenarien = [...d.planszenarien!, { ...neuesPlanszenario('psx', 'nur Business', 's1', JETZT) }];
    d.bereiche = { privat: { arbeitsplan: 'psx' }, business: { arbeitsplan: 'ps3' } };
    expect(businessPfadErlaubt('/planszenarien/id=psx', d)).toBeNull();
    const w = schreibeAlsBusiness(d, [{ pfad: '/planszenarien/id=psx' }], 'team', JETZT);
    expect(w.ok).toBe(false); expect(w.ok ? '' : w.grund).toBe('privat'); expect(w.ok ? 0 : w.status).toBe(403);
  });
  it('mehrere Schritte: ein angelegter Business-Eintrag lässt sich im selben Aufruf nicht privat machen', () => {
    const d = basis();
    expect(schreibeAlsBusiness(d, [{ pfad: '/sachkosten/-', neu: { id: 'neu', name: 'n', einheit: 'ug', gruppe: 'g', soll: 1 } }, { pfad: '/sachkosten/id=neu/einheit', neu: 'privat' }], 'team', JETZT).ok).toBe(false);
    expect(schreibeAlsBusiness(d, [{ pfad: '/darlehen/-', neu: { id: 'neu', name: 'n', geber: 'ug', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 0 } }, { pfad: '/darlehen/id=neu/geber', neu: 'privat' }], 'team', JETZT).ok).toBe(false);
  });
});

describe('f) Fund 5: Handwerte aus dem Stand vor finanzplan-5 werden nicht still mit neuer Bedeutung angewendet', () => {
  const ps = (d: FinanzDaten) => d.planszenarien!.find(p => p.id === 'ps3')!;
  const z = (x: FinanzDaten) => rechneMit(x, ps(x)).kdc[8].st.zahlung;
  it('ohne kernStand: ab.est/ab.zve/kdc-Steuerwerte wandern beim Lesen nach handAlt (gleicher Wert), alles andere bleibt im Plan', () => {
    const roh = planAltMigration(); roh.plan = { ...roh.plan, 'ab.zve:0': 9999, 'kdc.est@ps2:2': 5, 'ab.frei:0': 123 };
    const g = ueberPruefung(roh);
    expect(g.kernStand).toBe(KERN_STAND);
    expect(g.handAlt).toEqual({ 'ab.est:0': 50, 'ab.zve:0': 9999, 'kdc.est:3': 800, 'kdc.est@ps2:2': 5 });
    for (const k of Object.keys(g.handAlt!)) expect(k in g.plan, k).toBe(false);
    for (const k of ['kdc.konto:5', 'kdc.kosten:6', 'kdc.umsatz@ps2:4', 'ab.frei:0', 'ug.konto:7']) expect(g.plan[k], k).toBe(roh.plan[k]);
    // Gerechnet wird ohne sie: dieselbe Zahlung wie ohne die alten Handwerte.
    const ohne = planAltMigration(); for (const k of ['ab.est:0', 'kdc.est:3']) delete ohne.plan[k];
    expect(z(g)).toBeCloseTo(z(ohne), 9);
    // Ein zweites Lesen (mit kernStand) lässt alles, wie es ist.
    expect(JSON.stringify(ueberPruefung(g))).toBe(JSON.stringify(g));
  });
  it('übernehmen (/plan/<k> setzen) wendet ihn an und räumt handAlt; verwerfen (/handAlt/<k> entfernen) lässt die Formel', () => {
    const g = ueberPruefung(planAltMigration());
    const ueb = wendeOperationenAn(g, [{ pfad: '/plan/ab.est:0', neu: 50 }], 'kevin', JETZT).dokument;
    expect(ueb.handAlt).toEqual({ 'kdc.est:3': 800 });
    expect(z(ueb) - z(g)).toBeCloseTo(50 - 910, 6);   // jetzt bewusst mit neuer Bedeutung (das Ausmaß aus e)
    const verw = wendeOperationenAn(g, [{ pfad: '/handAlt/ab.est:0' }, { pfad: '/handAlt/kdc.est:3' }], 'kevin', JETZT).dokument;
    expect(verw.handAlt).toBeUndefined(); expect(z(verw)).toBeCloseTo(z(g), 9);
    // Rückgängig von „verwerfen“ legt den Wert wieder ab (nur Zahlen, nur Schlüssel mit geänderter Bedeutung) — gerechnet wird damit weiter nicht.
    const zurueck = wendeOperationenAn(verw, [{ pfad: '/handAlt/ab.est:0', neu: 50 }], 'kevin', JETZT).dokument;
    expect(zurueck.handAlt).toEqual({ 'ab.est:0': 50 }); expect(z(zurueck)).toBeCloseTo(z(g), 9);
    expect(() => wendeOperationenAn(g, [{ pfad: '/handAlt/ug.konto:3', neu: 1 }], 'kevin', JETZT)).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(g, [{ pfad: '/handAlt/ab.est:0', neu: 'x' }], 'kevin', JETZT)).toThrow(OperationUngueltig);
  });
  it('neue Dokumente und Handwerte nach dem Umzug gelten sofort; Business sieht handAlt nie', () => {
    expect(leeresDokument('2026-10-05').kernStand).toBe(KERN_STAND);
    const g = ueberPruefung(planAltMigration());
    const neu = ueberPruefung(wendeOperationenAn(g, [{ pfad: '/plan/ab.zve:0', neu: 1000 }], 'kevin', JETZT).dokument);
    expect(neu.plan['ab.zve:0']).toBe(1000); expect(neu.handAlt?.['ab.zve:0']).toBeUndefined();
    expect('handAlt' in businessSicht(g)).toBe(false);
    for (const k of BEDEUTUNG_NEU_FP5) expect(HAND_FELDER[k], k).toBeDefined();
  });
});

describe('f) Fund 6: Rückweg (dokumentiert — im alten Code nicht behebbar, UPDATES.md)', () => {
  it('Was der alte Stand beim ersten Schreiben verwirft (Darlehen, Gehalt Jan–Sep, Vorauszahlungen, Veranlagung) — die Zahlen ändern sich', () => {
    const d = planSteuerjahr();
    d.darlehen = [{ id: 'dl', name: 'D', geber: 'privat', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 10 }];
    d.selbst = { ...d.selbst, lohn2VorPlan: 9000 };
    d.steuern!.kdc!.param = { ...d.steuern!.kdc!.param, veranlagung: 'zusammen', lohnEinbeziehen: true, werbungskosten: 1500 };
    // So sähe das Dokument nach einem Schreiben mit dem alten Stand aus (sein Säuberer kennt diese Felder nicht).
    const alt: FinanzDaten = JSON.parse(JSON.stringify(d));
    delete alt.darlehen; delete alt.kernStand; delete alt.handAlt;
    delete alt.selbst.lohnVorPlan; delete alt.selbst.lohn2VorPlan; delete alt.selbst.estVorausgezahlt;
    alt.steuern!.kdc!.param = { zahlweise: 'folgejahr', zahlMonat: 6 };
    const a = rechneMit(d, d.planszenarien![0]), b = rechneMit(alt, alt.planszenarien![0]);
    expect(Math.abs(a.kdc[8].st.zahlung - b.kdc[8].st.zahlung)).toBeGreaterThan(100);   // Steuer 2026 anders
    expect(a.pr[9].darlehenEin).toBe(1500); expect(b.pr[9].darlehenEin).toBe(0);         // Darlehen weg
    expect(ueberPruefung(alt).kernStand).toBe(KERN_STAND);   // das Dokument bleibt lesbar (alles optional)
  });
});

describe('f) Fund 7 + 8: Gewerbesteuer-Vortrag in beiden Pfaden, § 35 mit Ermäßigungshöchstbetrag', () => {
  it('GewSt-Vortrag auch MIT Lohn in beiden Jahren eigener Vortrag (nie der ESt-Vortrag)', () => {
    const st = neuerSteuerrechner(P({ lohn: { 2026: 30000, 2027: 10000 }, hebesatz: 450 }), jahrVon, kalMonat);
    st(1, -50000); st(2, 0); st(3, 0);
    for (let m = 4; m <= 15; m++) st(m, 5000);
    const j27 = st.jahre().find(j => j.jahr === 2027)!;
    expect(j27.vortrag).toBe(20000); expect(j27.vortragGewerbe).toBe(50000);
    expect(j27.js.gewst).toBe(0);   // 60.000 − 50.000 = 10.000 < Freibetrag
    expect(j27.js.est).toBeCloseTo(T26(60000 - 20000 + 10000) - T26(10000), 6);
  });
  it('§ 35: Anrechnung = min(4 × Messbetrag, GewSt, ESt × Gewinn/(Gewinn + Lohn)) — auch mit Splitting; ohne Lohn die ganze ESt', () => {
    for (const split of [false, true]) {
      const tarif = split ? T26split : T26;
      const j = jahresSteuer(P({ estAbzug: 30000, lohn: { 2027: 15000 }, splitting: split }), 40000, 0, 2027);
      expect(j.anrechnung, `split ${split}`).toBeCloseTo(Math.min(4 * 0.035 * 15500, tarif(25000) * 40000 / 55000), 6);
    }
    const o = jahresSteuer(P({ hebesatz: 300 }), 80000, 0, 2027);
    expect(o.anrechnung).toBeCloseTo(Math.min(4 * 0.035 * 55500, 3 * 0.035 * 55500, T26(80000)), 6);
  });
});

describe('f) Fund 9 + 10: Darlehens-Monate außerhalb des Plans → 400, neutraler Name in Business', () => {
  it('Schreibweg und Import: Auszahlung/Rückzahlung außerhalb des Plans → 400 mit klarer Meldung (nie geklemmt)', () => {
    const d = planFix();
    for (const [aus, zurueck] of [[28, 0], [0, 28], [-1, 0], [0, 40]]) {
      expect(() => wendeOperationenAn(d, [{ pfad: '/darlehen/-', neu: { id: 'x', name: 'X', geber: 'privat', nehmer: 'kdv', betrag: 1, aus, zurueck } }], 'kevin', JETZT), `${aus}/${zurueck}`).toThrow(/außerhalb des Plans/);
    }
    const ok = wendeOperationenAn(d, [{ pfad: '/darlehen/-', neu: { id: 'x', name: 'X', geber: 'privat', nehmer: 'kdv', betrag: 1, aus: 27, zurueck: 0 } }], 'kevin', JETZT).dokument;
    expect(ok.darlehen![0].aus).toBe(27);
    const p = pruefeDokument({ ...JSON.parse(JSON.stringify(planFix())), darlehen: [{ id: 'x', name: 'X', geber: 'privat', nehmer: 'kdv', betrag: 1, aus: 0, zurueck: 99 }] });
    expect(p.ok).toBe(false); expect(p.ok ? '' : p.fehler).toMatch(/außerhalb des Plans/);
  });
  it('Business-Sicht: private Seite → „Darlehen (privat)“ ohne Notiz; Bank- und Gesellschaftsdarlehen behalten Name und Notiz', () => {
    expect(darlehenFuerBusiness({ id: 'a', name: 'Erbe', geber: 'kdc', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0, notiz: 'n' })).toEqual({ id: 'a', name: DARLEHEN_NAME_PRIVAT, geber: 'extern', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0 });
    expect(darlehenFuerBusiness({ id: 'b', name: 'Sparkasse', geber: 'extern', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0, notiz: 'Zins fix' })).toMatchObject({ name: 'Sparkasse', notiz: 'Zins fix' });
    expect(darlehenFuerBusiness({ id: 'c', name: 'KDV an MAKE', geber: 'kdv', nehmer: 'ug', betrag: 1, aus: 0, zurueck: 0, notiz: 'n' })).toMatchObject({ name: 'KDV an MAKE', notiz: 'n' });
  });
});

describe('f) Fund 11: Gehalt 2 Jan–Sep 2026 (selbst.lohn2VorPlan)', () => {
  it('wirkt bei Zusammenveranlagung, nicht bei Einzelveranlagung; bleibt beim Lesen; Business sieht es nie', () => {
    const d = planFix(14000);
    d.steuern = { kdc: { param: { veranlagung: 'zusammen' } } };
    d.selbst = { ...d.selbst, lohnVorPlan: 20000, lohn2VorPlan: 15432 };
    expect(rechneMit(d, null).lohn[2026]).toBe(26000 - 1230 + 15432 + 7500 - 1230);
    const e = { ...d, steuern: { kdc: { param: { veranlagung: 'einzeln' as const } } } };
    expect(rechneMit(e, null).lohn[2026]).toBe(26000 - 1230);
    expect(ueberPruefung(d).selbst.lohn2VorPlan).toBe(15432);
    expect(JSON.stringify(businessSicht(d))).not.toContain('15432');
  });
});

describe('f) Fund 12: „Einkommensteuer gemeinsam“ = dieselbe Rechnung wie Rücklage und Zahlung', () => {
  it('mit Handwerten auf ab.est, ab.zve, kdc.est, kdc.verlustvortrag und Vorauszahlung: Steuer des Jahres − vorausgezahlt = Abschlusszahlung', () => {
    for (const zahlweise of ['folgejahr', 'quartal'] as const) {
      const d = planSteuerjahr(39); d.steuern!.kdc!.param = { zahlweise, zahlMonat: 6 };
      d.plan = { ...d.plan, 'ab.zve:0': 30000, 'ab.est:0': 2000, 'kdc.est:3': 900, 'kdc.est:14': -300, 'kdc.verlustvortrag:16': 4000 };
      const g = rechneMit(d, d.planszenarien![0]);
      const ej = estJahre(g.d, g.kdc, g.ug);
      expect(ej.map(j => j.jahr)).toEqual([2026, 2027, 2028, 2029]);
      for (const j of ej) expect(j.summe, `${zahlweise} ${j.jahr}`).toBeCloseTo(j.zahlung + j.vorausgezahlt, 9);
      for (const j of ej.filter(x => x.jahr < 2029)) {
        const m = (j.jahr + 1 - 2026) * 12 - 3;   // Juni des Folgejahres als Plan-Monat (Juni 27 = 9)
        const vor = zahlweise === 'quartal' ? j.summe / 4 : 0;   // im Juni zusätzlich die Vorauszahlung Q2 aufs neue Jahr
        expect(g.kdc[m - 1].st.zahlung, `${zahlweise} ${j.jahr}`).toBeCloseTo(j.zahlung + vor, 6);
      }
      expect(ej[0].korr).not.toBe(0); expect(ej[0].vorausgezahlt).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('f) Fund 13: Kennzahlen je Bereich mit dem Arbeitsplan des Bereichs', () => {
  it('Business → ps3, Privat → ps2; die beiden Pläne geben verschiedene Zahlen (der Test kann nicht zufällig grün sein)', () => {
    const d = planAltMigration();   // bereiche: privat → ps2, business → ps3; gemeinsam: ps2
    const kb = kennzahlenVon(fuerSicht(d, 'business'), 'business'), kp = kennzahlenVon(d, 'privat');
    expect(kb.arbeitsplanId).toBe('ps3'); expect(kp.arbeitsplanId).toBe('ps2');
    const mit = (id: string) => rechneMit(d, d.planszenarien!.find(p => p.id === id)!).kz;
    expect(Math.abs(mit('ps2').kdvDez28 - mit('ps3').kdvDez28)).toBeGreaterThan(100);
    expect(kb.kdvDez28).toBeCloseTo(mit('ps3').kdvDez28, 6); expect(kp.kdvDez28).toBeCloseTo(mit('ps2').kdvDez28, 6);
    // Ohne eigene Wahl: beide Bereiche rechnen den gemeinsamen Arbeitsplan.
    const g: FinanzDaten = { ...d }; delete g.bereiche;
    expect(kennzahlenVon(fuerSicht(g, 'business'), 'business').arbeitsplanId).toBe('ps2');
  });
});
