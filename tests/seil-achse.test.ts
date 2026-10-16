// Seil — Lage der Achsen-Beschriftung (Abnahme 15.10. C3: „HEUTE“ lag über „Okt“). Die Lage rechnet NUR seil-geometrie.ts (`seilAchse`);
// hier: Monatsnamen überdecken einander nie, „HEUTE“ steht versetzt (eigene Zeile) und überdeckt nie einen Monatsnamen, bleibt ganz im Bild.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { monatsTicks } from '@/lib/planung/zeitstrahl';
import { SEIL_FORM, seilAchse, seilSpalte, seilX } from '@/lib/lichtfaeden/seil-geometrie';

type Kasten = { x: number; y: number; breite: number; hoehe: number };
const ueberdeckt = (a: Kasten, b: Kasten) => a.x < b.x + b.breite && b.x < a.x + a.breite && a.y < b.y + b.hoehe && b.y < a.y + a.hoehe;
const tagPlus = (tag: string, n: number) => new Date(Date.parse(`${tag}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function achseFuer(von: string, bis: string, heute: string, breite: number) {
  const x = (t: string) => seilX(t, von, bis, breite);
  return seilAchse(monatsTicks(von, bis), x, breite, heute >= von && heute <= bis ? x(heute) : null);
}

describe('seilAchse — Beschriftung der Zeit-Achse', () => {
  it('Fall aus der Abnahme: Jun 2026 – Dez 2027, heute 16.10. — „Okt“ steht, „HEUTE“ darunter versetzt, nichts überdeckt', () => {
    const breite = seilSpalte(1090).zeit;
    const a = achseFuer('2026-06-01', '2027-12-31', '2026-10-16', breite);
    expect(a.monate.map(m => m.text)).toContain('Okt');
    expect(a.heute).not.toBeNull();
    const h = a.heute!;
    const okt = a.monate.find(m => m.date === '2026-10-01')!;
    expect(ueberdeckt({ ...h, x: h.links }, okt)).toBe(false);
    // Versetzt: die HEUTE-Zeile beginnt erst unter der Monatszeile.
    expect(h.y).toBeGreaterThanOrEqual(okt.y + okt.hoehe);
    // Mittig über der Linie.
    expect(h.links + h.breite / 2).toBeCloseTo(h.x, 5);
  });

  it('über viele Fenster, Breiten und Tage: Monate überdecken einander nie, HEUTE nie einen Monat, beides in der Achse', () => {
    const fenster: [string, string][] = [['2026-01-01', '2026-12-31'], ['2026-06-01', '2027-12-31'], ['2026-10-01', '2028-03-31'], ['2026-09-15', '2026-12-14']];
    for (const [von, bis] of fenster) {
      for (const gesamt of [520, 720, 900, 1090, 1400]) {
        const breite = seilSpalte(gesamt).zeit;
        for (let tag = von; tag <= bis; tag = tagPlus(tag, 3)) {
          const a = achseFuer(von, bis, tag, breite);
          for (let i = 1; i < a.monate.length; i++) expect(a.monate[i].x).toBeGreaterThan(a.monate[i - 1].x + a.monate[i - 1].breite);
          for (const m of a.monate) { expect(m.x + m.breite).toBeLessThan(breite + 4); expect(m.y + m.hoehe).toBeLessThanOrEqual(a.hoehe); }
          const h = a.heute!;
          expect(h.links).toBeGreaterThanOrEqual(0);
          expect(h.links + h.breite).toBeLessThanOrEqual(breite + 1e-9);
          expect(h.y + h.hoehe).toBeLessThanOrEqual(a.hoehe);
          for (const m of a.monate) expect(ueberdeckt({ ...h, x: h.links }, m)).toBe(false);
        }
      }
    }
  });

  it('ohne Heute im Fenster keine Marke; die Bühne rechnet nicht selbst (eine Stelle)', () => {
    expect(achseFuer('2027-01-01', '2027-12-31', '2026-10-16', 800).heute).toBeNull();
    const t = readFileSync(path.resolve(__dirname, '..', 'components/os/seil/SeilBand.tsx'), 'utf8');
    expect(t).toContain('seilAchse(');
    expect(t).not.toMatch(/text\.length \* 7/);
    expect(t).not.toMatch(/translateX\(-50%\)/);
    expect(SEIL_FORM.achse.heute.y).toBeGreaterThanOrEqual(SEIL_FORM.achse.monat.y + SEIL_FORM.achse.monat.hoehe);
  });
});
