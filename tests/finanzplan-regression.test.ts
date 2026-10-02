// ─── Finanzplanung jetzt — Regression: der Rechenkern rechnet wie vorher ─────
// Kevin 02.10.: „Prüfe genau, dass sich bei unveränderten Eingaben keine Zahl verändert.“ Die Erwartungswerte unten
// stammen aus dem UNVERÄNDERTEN Rechenkern (Stand 1818c5c, vor „Alle Felder anpassbar“) — erfundener Plan, keine echten Zahlen.
// Danach wird gezeigt: Steuer-Profil, Ausblenden und Aufschlüsseln verändern keine Zahl; neue optionale Felder ebenso wenig.
import { describe, it, expect } from 'vitest';
import { rechneSelbst } from '../lib/finanzen/rechenkern';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, pruefeDokument } from '../lib/finanzen/plan/operationen';
import { steuerOps } from '../lib/finanzen/steuern';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

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

describe('Goldwerte aus dem unveränderten Kern (Stand 1818c5c)', () => {
  it('Fassung A, reiner Treiber', () => {
    nah(kennwerte(planFix(4000), null), { umsatz: 106340, steuer: 675, gewinn: -109650, konto27: -113623.6, frei27: -113825, kdv27: 13050, ruecklage12: 0, ust5: 353.4, luftSum: 50420, angespart27: 55820, ausschuettung: 0, ausStr: 0, minFrei: -113825 });
  });
  it('Fassung A, Arbeitsplan mit Bausteinen, Ausschüttung und eigener Quote', () => {
    nah(kennwerte(planFix(4000), arbeitsplanFix()), { umsatz: 122140, steuer: 1862.84, gewinn: -149323, konto27: -166484.44, frei27: -166685.84, kdv27: 18050, ruecklage12: 0, ust5: 752.4, luftSum: 57952, angespart27: 63352, ausschuettung: 8832, ausStr: 3168, minFrei: -166685.84 });
  });
  it('Fassung B (Steuer fällt an), reiner Treiber', () => {
    nah(kennwerte(planFix(14000), null), { umsatz: 246340, steuer: 35247, gewinn: 30350, konto27: -8195.6, frei27: -8397, kdv27: 13050, ruecklage12: 23175, ust5: 353.4, luftSum: 50420, angespart27: 55820, ausschuettung: 0, ausStr: 0, minFrei: -8397 });
  });
  it('Fassung B, Arbeitsplan', () => {
    nah(kennwerte(planFix(14000), arbeitsplanFix()), { umsatz: 262140, steuer: 30185.4, gewinn: -9323, konto27: -54807, frei27: -55008.4, kdv27: 18050, ruecklage12: 19784.52, ust5: 752.4, luftSum: 57952, angespart27: 63352, ausschuettung: 8832, ausStr: 3168, minFrei: -55008.4 });
  });
  it('Selbstständigkeit 2026 (Abschluss) wie vorher', () => {
    expect(rechneSelbst(planFix())).toEqual({ ein: 20000, aus: 4000, gewinn: 16000, zve: 12500, est: 21, frei: -3021, nachConsors: -5021 });
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
    expect(vorher(mitOps(d, steuerOps(d, 'kdc', { art: 'an', steuer: 'est', wert: false })))).toBe(v);
  });
  it('Nach Steuerarten aufschlüsseln: der Gesamtsatz und damit jede Zahl bleiben exakt gleich', () => {
    for (const satz of [0.3, 0.2825, 0.12]) {
      const d = { ...planFix(14000), annahmen: { ...planFix().annahmen, steuerUG: satz } };
      const ops = steuerOps(d, 'ug', { art: 'einzeln', wert: true });
      expect(ops.some(o => o.pfad === '/annahmen/steuerUG')).toBe(false);
      const e = mitOps(d, ops);
      expect(e.annahmen.steuerUG).toBe(satz);
      expect(vorher(e)).toBe(vorher(d));
      // und zurück
      expect(vorher(mitOps(e, steuerOps(e, 'ug', { art: 'einzeln', wert: false })))).toBe(vorher(d));
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
