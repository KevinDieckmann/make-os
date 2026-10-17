// ─── Steuern: EINE Rechenquelle je Bereich und je Gesellschaft (17.10., L2 E1/E2) ──────────────────────────────────────────────────
// E1: Der Steuern-Bereich las die Finanzplanung immer mit dem GEMEINSAMEN Arbeitsplan — rechnete Finanzen › Privat › Planung ein eigenes
//     Szenario, zeigte die Einkommensteuer dort eine andere Zahl als unter Steuern. Jetzt je Teil das Szenario seines Bereichs (`arbeitsplanFuer`).
// E2: KD Ventures rechnete unter Steuern mit festen 15,825 % + 3,5 % × eigenem Hebesatz, die Finanzplanung mit ihrem Steuerprofil — jetzt
//     dieselben Sätze (`mitFinanzplanung` auch für `kdv`, wie seit 15.10. für die Hauptgesellschaft). Rein, erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import { estGemeinsamFuer, steuerAusPlan } from '@/lib/finanzen/est-gemeinsam';
import { estJahre } from '@/lib/finanzen/rechenkern';
import { rechneMit, arbeitsplanVon } from '@/lib/finanzen/szenarien';
import { steuerParameter } from '@/lib/finanzen/steuern';
import { STANDARD_STEUERN, mitFinanzplanung, prognose, jahresgewinn } from '@/lib/steuern/rechnen';
import { pruefPlan } from './fixtures/finanz-plan';

const estVon = (d: ReturnType<typeof pruefPlan>, ps: ReturnType<typeof arbeitsplanVon>) => {
  const g = rechneMit(d, ps);
  return estJahre(g.d, g.kdc, g.ug).find(x => x.jahr === 2026)!;
};

describe('E1 · Einkommensteuer aus dem Szenario des Bereichs Privat', () => {
  it('ohne eigene Bereichs-Einstellung: wie bisher der gemeinsame Arbeitsplan (bit-gleich)', () => {
    const d = pruefPlan();
    expect(estGemeinsamFuer(d, 2026)).toMatchObject(estVon(d, arbeitsplanVon(d)));
  });
  it('Privat rechnet Basis, gemeinsam gilt „Plan“: Steuern zeigt die Zahl von Privat — vorher zwei Zahlen, jetzt eine', () => {
    const d = { ...pruefPlan(), bereiche: { privat: { arbeitsplan: null } } };
    const privat = estVon(d, null);
    const gemeinsam = estVon(d, arbeitsplanVon(d));
    expect(Math.round(privat.summe)).not.toBe(Math.round(gemeinsam.summe)); // vorher stand unter Steuern `gemeinsam`
    const e = estGemeinsamFuer(d, 2026)!;
    expect(e).toMatchObject(privat);
    expect(e.plan).toBeNull();
    // Die Hauptgesellschaft rechnet weiter mit dem Szenario ihres Bereichs (Business = gemeinsamer Arbeitsplan).
    expect(steuerAusPlan(d, 2026).ug?.plan).toBe('Plan');
  });
});

describe('E2 · KD Ventures mit den Sätzen der Finanzplanung', () => {
  const ist = (u: number, k: number) => Array.from({ length: 9 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatz: u, kosten: k, quelle: 'Monatsabschluss' }));
  const g = { kdc: null, kdv: jahresgewinn(ist(5000, 4000), 2026), ug: null };

  it('Profil aus der Finanzplanung = steuerParameter des Kerns', () => {
    const d = pruefPlan();
    const p = steuerAusPlan(d, 2026).kdv!;
    const k = steuerParameter(rechneMit(d, arbeitsplanVon(d)).d, 'kdv');
    expect(p).toMatchObject({ kapital: true, kst: k.kst, soli: k.soli, messzahl: k.messzahl, hebesatz: k.hebesatz, plan: 'Plan' });
  });

  it('Rücklage-Prognose: vorher 15,825 % + 3,5 % × 410, jetzt KSt × (1 + Soli) + Messzahl × Hebesatz aus dem Plan', () => {
    const vorher = prognose(STANDARD_STEUERN, '2026-10-15', g, {}, null).zeilen.find(x => x.id === 'kst')!;
    expect(vorher.betrag).toBeCloseTo(12000 * (0.15825 + 0.035 * 4.1), 5);
    const kdv = steuerAusPlan(pruefPlan(), 2026).kdv!; // pruefPlan: KSt 15 %, Soli 5,5 %, Messzahl 3,5 %, Hebesatz 400 %
    const e = mitFinanzplanung(STANDARD_STEUERN, null, null, kdv);
    expect(e.kdv).toMatchObject({ rechtsform: 'ug', gewerbe: true, saetze: { kst: 0.15, soli: 0.055, messzahl: 0.035, hebesatz: 400, plan: 'Plan' } });
    const jetzt = prognose(e, '2026-10-15', g, {}, null).zeilen.find(x => x.id === 'kst')!;
    expect(jetzt.betrag).toBeCloseTo(12000 * (0.15 * 1.055 + 0.035 * 4), 5);
    expect(jetzt.formel).toContain('Sätze aus der Finanzplanung');
    // Laut Plan keine Kapitalgesellschaft → keine Schätzung, Weg in die Finanzplanung (KD Ventures).
    const einzel = prognose(mitFinanzplanung(STANDARD_STEUERN, null, null, { ...kdv, kapital: false }), '2026-10-15', g, {}, null).zeilen.find(x => x.id === 'kst')!;
    expect(einzel.betrag).toBeNull();
    expect(einzel.href).toContain('steuern=kdv');
    // Ohne Plan bleibt alles, wie es ist (dasselbe Objekt).
    expect(mitFinanzplanung(STANDARD_STEUERN, null, null, null)).toBe(STANDARD_STEUERN);
  });
});
