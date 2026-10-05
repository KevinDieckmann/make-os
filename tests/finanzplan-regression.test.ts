// ─── Finanzplanung jetzt — Regression: der Rechenkern rechnet wie vorher, wo er nicht bewusst geändert wurde ─────
// Kevin 02.10.: „Prüfe genau, dass sich bei unveränderten Eingaben keine Zahl verändert.“ Erfundener Plan, keine echten Zahlen.
// Kern-Umbau 02.10. (Kevins Entscheidung: Steuern einzeln, Selbstständigkeit eigene Achse, Einkommensteuer, zwei Felder gelöscht):
// die Goldwerte der betroffenen Fälle sind angepasst und im Kommentar erklärt; alles andere (Privat, Ziele, Töpfe, Buchungen) stammt
// aus dem unveränderten Kern c83cb1f und bleibt exakt gleich.
import { describe, it, expect } from 'vitest';
import { rechneSelbst, toepfeUG, zielStaende, istHistorie } from '../lib/finanzen/rechenkern';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, pruefeDokument } from '../lib/finanzen/plan/operationen';
import { steuerOps } from '../lib/finanzen/steuern';
import { aufteilen } from '../lib/finanzen/ertragsteuer';
import { planFix, arbeitsplanFix, arbeitsplanOhneSelbst, planGold } from './fixtures/finanz-plan';
import goldJson from './fixtures/kern-vorher-gold.json';

const JETZT = '2026-10-02T10:00:00.000Z';
const kennwerte = (d: FinanzDaten, ps: ReturnType<typeof arbeitsplanFix> | null) => {
  const { ug, pr, kz } = rechneMit(d, ps);
  const sum = (f: (u: (typeof ug)[number]) => number) => Math.round(ug.reduce((s, u) => s + f(u), 0) * 100) / 100;
  const sp = (f: (u: (typeof pr)[number]) => number) => Math.round(pr.reduce((s, u) => s + f(u), 0) * 100) / 100;
  return {
    umsatz: sum(u => u.umsatz), steuer: sum(u => u.steuer), gewinn: sum(u => u.gewinn), konto27: ug[26].konto, frei27: ug[26].frei, kdv27: ug[26].kdvKonto,
    ruecklage12: ug[11].steuerRuecklage, ust5: ug[4].ustOffen, luftSum: sp(u => u.luft), angespart27: pr[26].angespart, ausschuettung: sp(u => u.ausschuettung), ausStr: sp(u => u.ausschuettungSteuer), minFrei: kz.minFrei,
  };
};
const nah = (a: Record<string, number>, b: Record<string, number>) => { for (const k of Object.keys(b)) expect(a[k], k).toBeCloseTo(b[k], 6); };
/** Rekursiv gleich — Zahlen auf 1e-8 genau (die Steuer wird jetzt als Summe der Einzelsteuern gebildet, das ändert nur die letzten Bits). */
function gleich(ist: unknown, soll: unknown, pfad = ''): void {
  if (typeof soll === 'number') { expect(typeof ist, pfad).toBe('number'); expect(ist as number, pfad).toBeCloseTo(soll, 8); return; }
  if (Array.isArray(soll)) { expect(Array.isArray(ist), pfad).toBe(true); expect((ist as unknown[]).length, pfad).toBe(soll.length); soll.forEach((x, i) => gleich((ist as unknown[])[i], x, `${pfad}[${i}]`)); return; }
  if (soll && typeof soll === 'object') { for (const k of Object.keys(soll)) gleich((ist as Record<string, unknown>)[k], (soll as Record<string, unknown>)[k], `${pfad}.${k}`); return; }
  expect(ist, pfad).toEqual(soll);
}

describe('Goldwerte nach dem Kern-Umbau 02.10. (Vorher c83cb1f → nachher, Abweichungen erklärt)', () => {
  // Fassung A/B ohne Plan: bit-genau wie vorher. Mit Arbeitsplan weicht ab, was der Umbau bewusst ändert:
  //  · umsatz −3.000 / gewinn −3.000: der Baustein „K“ der Selbstständigkeit (500 € × 6 Monate) läuft nicht mehr in den MAKE-Zahlen, sondern auf der eigenen Achse;
  //  · steuer: die MAKE-Steuer sinkt um 28 % davon (840 bzw. 420 €), dafür zahlt KD Ventures Ertragsteuer auf seinen Baustein „V“ (200 €/Monat ab Dez 26) — vorher nur die pauschale Steuer auf den Ausstieg;
  //  · kdv27: −728 € (die Ertragsteuer auf „V“ über 25 Monate: 0,28 × 5.000 € = 1.400 € gezahlt bis Dez 28, Rücklage steht im „frei“ von KD Ventures);
  //  · ust5: die USt auf die Eingänge des Bausteins „K“ steht jetzt in der Selbstständigkeit.
  it('Fassung A, reiner Treiber — unverändert', () => {
    nah(kennwerte(planFix(4000), null), { umsatz: 106340, steuer: 675, gewinn: -109650, konto27: -113623.6, frei27: -113825, kdv27: 13050, ruecklage12: 0, ust5: 353.4, luftSum: 50420, angespart27: 55820, ausschuettung: 0, ausStr: 0, minFrei: -113825 });
  });
  it('Fassung A, Arbeitsplan mit Bausteinen, Ausschüttung und eigener Quote', () => {
    nah(kennwerte(planFix(4000), arbeitsplanFix()), { umsatz: 119140, steuer: 1442.84, gewinn: -152323, konto27: -169064.44, frei27: -169265.84, kdv27: 17322, ruecklage12: 0, ust5: 657.4, luftSum: 57952, angespart27: 63352, ausschuettung: 8832, ausStr: 3168, minFrei: -169265.84 });
  });
  it('Fassung B (Steuer fällt an), reiner Treiber — unverändert', () => {
    nah(kennwerte(planFix(14000), null), { umsatz: 246340, steuer: 35247, gewinn: 30350, konto27: -8195.6, frei27: -8397, kdv27: 13050, ruecklage12: 23175, ust5: 353.4, luftSum: 50420, angespart27: 55820, ausschuettung: 0, ausStr: 0, minFrei: -8397 });
  });
  it('Fassung B, Arbeitsplan', () => {
    nah(kennwerte(planFix(14000), arbeitsplanFix()), { umsatz: 259140, steuer: 29345.4, gewinn: -12323, konto27: -56967, frei27: -57168.4, kdv27: 17322, ruecklage12: 19364.52, ust5: 657.4, luftSum: 57952, angespart27: 63352, ausschuettung: 8832, ausStr: 3168, minFrei: -57168.4 });
  });
  it('Selbstständigkeit 2026 (Abschluss) wie vorher — ohne Gehalt; mit Gehalt gemeinsam versteuert (finanzplan-5, 05.10.)', () => {
    // Ohne Lohn (Aufruf ohne `lohn`) dieselben Zahlen wie vorher; neu nur die Felder lohn/steuer/korr/darlehen/vorausgezahlt. Gegenprüfung 05.10.
    // (Kevin: „Es gibt kein Gesellschafterdarlehen“): das Altdarlehen hat keinen Geber im Plan, das Altfeld `darlehenAnUG` zählt nicht — der Abschluss
    // zieht nichts ab. frei −3.021 (vor finanzplan-5 und in finanzplan-5) → −21.
    expect(rechneSelbst(planFix())).toEqual({ ein: 20000, aus: 4000, gewinn: 16000, lohn: 0, zve: 12500, est: 21, steuer: 21, korr: 0, darlehen: 0, vorausgezahlt: 0, frei: -21, nachConsors: -2021 });
    // Mit Gehalt 1 (3.000 € ab Nov 26 → 6.000 € − 1.230 € Pauschbetrag = 4.770 € Lohneinkünfte 2026): zvE = 16.000 + 4.770 − 3.500 = 17.270
    // → Zone 1: y = 0,4922; (914,51·y + 1.400)·y = 910,63 → 910 €; auf den Lohn allein (4.770 − 3.500 = 1.270) 0 € → Anteil Jan–Sep 910 € (vorher 21 €).
    const r = rechneSelbst(planFix(), undefined, { 2026: 4770 });
    expect(r.zve).toBe(17270); expect(r.est).toBe(910); expect(r.steuer).toBe(910); expect(r.frei).toBe(5000 - 4000 - 910 - 1000);
  });
});

// Die Teile, die NICHT von den vier Punkten betroffen sind, stammen aus dem unveränderten Kern c83cb1f (tests/fixtures/kern-vorher-gold.json,
// erzeugt mit dem alten Kern und einem Plan ohne Selbstständigkeit und ohne KD-Ventures-Baustein) und müssen exakt gleich bleiben.
describe('Nicht betroffene Teile bleiben exakt gleich (Gold aus c83cb1f)', () => {
  const gold = goldJson as unknown as Record<string, { pr: unknown[]; toepfe: unknown[]; ziele: unknown[]; ist: unknown; ug: Record<string, number>[]; kz: Record<string, number>; awFrei: Record<string, number>; awRunway: unknown }>;
  const fall: [string, ReturnType<typeof arbeitsplanOhneSelbst> | null][] = [['ohnePlan', null], ['ohneSelbst', arbeitsplanOhneSelbst()]];
  for (const [name, ps] of fall) {
    it(`${name}: Privat-Blatt, Ziele, Töpfe, Buchungen, MAKE-Konto`, () => {
      const g = rechneMit(planGold(), ps), v = gold[name];
      gleich(JSON.parse(JSON.stringify(g.pr.map(({ entnahme: _e, ...rest }) => rest))), v.pr, 'pr');
      gleich(JSON.parse(JSON.stringify(toepfeUG(g.ug, 2))), v.toepfe, 'toepfe');
      // Ziel „Gruppe“ zählt seit dem Umbau auch die Selbstständigkeit mit (eigener Strom) — ihr Konto wird für den Vergleich abgezogen.
      const ziele = zielStaende(g.d, g.ug, g.pr, g.kdc).map(z => ({ id: z.ziel.id, verlauf: z.ziel.quelle === 'gruppe' ? z.verlauf.map((x, i) => x - g.kdc[i].frei) : z.verlauf, ...(z.ziel.quelle === 'gruppe' ? {} : { erreichtMonat: z.erreichtMonat, status: z.status }) }));
      gleich(ziele, (v.ziele as { id: string; verlauf: number[] }[]).map(z => (z.id === 'z4' ? { id: z.id, verlauf: z.verlauf } : z)), 'ziele');
      gleich(JSON.parse(JSON.stringify(istHistorie(g.d))), v.ist, 'ist');
      g.ug.forEach((u, i) => { for (const k of ['konto', 'frei', 'steuer', 'steuerRuecklage', 'umsatz', 'gewinn', 'kdvKonto']) expect(u[k as 'konto'], `${k} Monat ${i + 1}`).toBeCloseTo(v.ug[i][k], 9); });
      for (const k of Object.keys(v.kz).filter(k => k !== 'gruppeDez28')) expect((g.kz as unknown as Record<string, number>)[k], k).toBeCloseTo(v.kz[k], 9);
      expect(g.kz.gruppeDez28).toBeCloseTo(v.kz.gruppeDez28 + g.kdc[26].frei, 9);
    });
  }
  it('Auswertung: frei MAKE/KD Ventures/Privat und Runway wie vorher; Gesamt = vorher + Konto der Selbstständigkeit', () => {
    const g = rechneMit(planGold(), arbeitsplanOhneSelbst()), aw = auswertung(g.d, g.ug, g.pr, g.kdc), v = gold.ohneSelbst;
    expect(aw.frei.ug).toBeCloseTo(v.awFrei.ug, 9); expect(aw.frei.kdv).toBeCloseTo(v.awFrei.kdv, 9); expect(aw.frei.privat).toBeCloseTo(v.awFrei.privat, 9);
    expect(aw.runway).toEqual(v.awRunway);
    expect(aw.frei.gesamt).toBeCloseTo(v.awFrei.gesamt + aw.frei.kdc, 9);
    // Formel-Prüfung 05.10. (bewusst geändert): Gehalt 2 läuft vor der GmbH (malinAb 3) über die Selbstständigkeit — deren Konto trägt jetzt die
    // Kosten (2.500 × 1,2 = 3.000 im Okt 26). Vorher: frei = Kontostart 5.000 (Geld aus dem Nichts), nachher 2.000.
    // finanzplan-5 (05.10., bewusst geändert) 2.000 → −1.302: (1) das Altdarlehen 3.000 geht im Okt 26 aus der Selbstständigkeit an MAKE;
    // (2) EINE Einkommensteuer 2026: der Gewinn Jan–Sep (16.000) steht am Jahresanfang, Okt bringt −3.000 → 13.000; Lohneinkünfte 2026 4.770
    // (Gehalt 1 Nov+Dez 6.000 − 1.230) → zvE 13.000 + 4.770 − 3.500 = 14.270 → y = 0,1922; (914,51·y + 1.400)·y = 302,86 → 302 € Rücklage.
    // Gegenprüfung 05.10. (finanzplan-5b): (1) zurückgenommen — das Altdarlehen hat den Geber außerhalb des Plans: −1.302 → 1.698.
    const a = planGold().annahmen;
    expect(aw.m0).toBe(1);
    expect(aw.frei.kdc).toBeCloseTo(planGold().selbst.kontoStart - a.malinBrutto * (1 + a.agAnteil) - 302, 9);
  });
});

describe('Unveränderte Eingaben → unveränderte Zahlen', () => {
  const zahlen = (g: ReturnType<typeof rechneMit>) => JSON.stringify({ ug: g.ug, pr: g.pr, kz: g.kz });
  const vorher = (d: FinanzDaten) => zahlen(rechneMit(d, arbeitsplanFix()));
  const mitOps = (d: FinanzDaten, ops: Parameters<typeof wendeOperationenAn>[1]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;

  it('Steuerzeilen ein- und ausblenden (USt, Rechtsform) ändert keine Zahl', () => {
    const d = planFix(14000);
    const v = vorher(d);
    const a = mitOps(d, steuerOps(d, 'ug', { art: 'an', steuer: 'ust', wert: false }));
    expect(vorher(a)).toBe(v);
    const b = mitOps(a, [...steuerOps(a, 'ug', { art: 'an', steuer: 'ust', wert: true }), ...steuerOps(a, 'kdv', { art: 'an', steuer: 'exit', wert: true })]);
    expect(vorher(b)).toBe(v);
    // Die Einkommensteuer der Selbstständigkeit auszuschalten betrifft nur deren Achse (MAKE und Privat bleiben).
    const ohneEst = rechneMit(mitOps(d, steuerOps(d, 'kdc', { art: 'an', steuer: 'est', wert: false })), arbeitsplanFix());
    expect(JSON.stringify({ ug: ohneEst.ug, pr: ohneEst.pr })).toBe(JSON.stringify({ ug: rechneMit(d, arbeitsplanFix()).ug, pr: rechneMit(d, arbeitsplanFix()).pr }));
  });
  it('Ohne Eintrag rechnet der Kern die Ertragsteuer mit genau der Gesamtquote von vorher (Vorgabe-Hebesatz aus steuerUG)', () => {
    for (const satz of [0.3, 0.2825, 0.12]) {
      const d = { ...planFix(14000), annahmen: { ...planFix().annahmen, steuerUG: satz } };
      const { ug } = rechneMit(d, null);
      const gewinn = (von: number, bis: number) => ug.slice(von - 1, bis).reduce((s, u) => s + u.gewinn, 0);
      // Alte Formel: Zahlung im Juni (Plan-Monat 9 und 21) = Quote × Gewinn des Vorjahres; Rücklage = Quote × Gewinn seit Jahresbeginn (+ Vorjahr bis zur Zahlung).
      expect(gewinn(1, 3)).toBeGreaterThan(0); expect(gewinn(4, 15)).toBeGreaterThan(0);
      expect(ug[8].steuer).toBeCloseTo(satz * gewinn(1, 3), 8);
      expect(ug[20].steuer).toBeCloseTo(satz * gewinn(4, 15), 8);
      expect(ug[5].steuerRuecklage).toBeCloseTo(satz * gewinn(1, 3) + satz * gewinn(4, 6), 8);
    }
  });
  it('Die abgeleiteten Vorgaben von Hand eingetragen ergeben bit-genau dieselben Zahlen wie leere Felder', () => {
    for (const satz of [0.3, 0.2825]) {
      const d = { ...planFix(14000), annahmen: { ...planFix().annahmen, steuerUG: satz } };
      const v = aufteilen(satz);
      const e = mitOps(d, [
        { pfad: '/steuern/ug/zeilen/kst/satz', neu: v.kst }, { pfad: '/steuern/ug/zeilen/soli/satz', neu: v.soli },
        { pfad: '/steuern/ug/zeilen/gewst/satz', neu: v.messzahl }, { pfad: '/steuern/ug/zeilen/gewst/hebesatz', neu: v.hebesatz },
      ]);
      const ohnePlan = (x: FinanzDaten) => zahlen(rechneMit(x, null));   // mit Arbeitsplan gälte dessen eigene Quote (0,28)
      expect(ohnePlan(e)).toBe(ohnePlan(d));
    }
  });
  it('Neue optionale Felder (Schwellen, Überschreibung leer) ändern nichts', () => {
    const d = planFix(14000);
    const e = mitOps(d, [{ pfad: '/schwellen/runwayWarnMonate', neu: 3 }]);
    expect(vorher(e)).toBe(vorher(d));
    expect(zahlen(rechneMit(e, null))).toBe(zahlen(rechneMit(d, null)));
  });
  it('Ein Dokument ohne die neuen Schlüssel kommt unverändert durch die Prüfung (ältere Dokumente laufen)', () => {
    const d = planFix(14000);
    const p = pruefeDokument(JSON.parse(JSON.stringify(d)));
    expect(p.ok).toBe(true);
    if (p.ok) { expect('steuern' in p.dokument).toBe(false); expect('schwellen' in p.dokument).toBe(false); expect(zahlen(rechneMit(p.dokument, null))).toBe(zahlen(rechneMit(d, null))); }
  });
});
