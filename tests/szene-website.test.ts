// ─── Szene: EINE Quelle für makeinnovation.de und fokusinnovation.de (04.10.2026; „Klar“ 05.10.2026) ──────────────────────
// website/js/szene/ (kern · formationen · motor · spur · verlauf) ist das Original; fokus/js/szene/ ist eine Byte-gleiche Kopie
// (scripts/szene-website.mjs). Neue Fähigkeiten (die Formation „tafel“) sind freiwillig je Drehbuch — makeinnovation.de bleibt
// unverändert. Hier wird beides bewacht.
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { pruefen, kopien, ZIELE, DATEIEN, QUELLE } from '../scripts/szene-website.mjs';
import { GLEICH_WIE_WEBSITE } from '../fokus/pruefen.mjs';

const wurzel = process.cwd();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Szene = any;
/** Die Szene einer Seite ohne DOM laden (wie website/standbild.mjs). */
function szene(ordner: string): Szene {
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  for (const d of ['js/szene/kern.js', 'js/szene/formationen.js', 'js/drehbuch.js']) vm.runInContext(readFileSync(join(wurzel, ordner, d), 'utf8'), ctx);
  return ctx.MakeSzene;
}

describe('fokus/js/szene/ = website/js/szene/ (Byte für Byte)', () => {
  it('jede Kopie gleicht dem Original (sonst: node scripts/szene-website.mjs oder node scripts/fokus-seite.mjs)', () => {
    expect(ZIELE).toEqual(['fokus/js/szene']);
    expect(DATEIEN).toEqual(['kern.js', 'formationen.js', 'motor.js', 'spur.js', 'verlauf.js']);
    expect(pruefen(wurzel)).toEqual([]);
    for (const [q, z] of kopien() as [string, string][]) expect(readFileSync(join(wurzel, z)).equals(readFileSync(join(wurzel, q))), z).toBe(true);
  });

  it('fokus/pruefen.mjs vergleicht dieselben Dateien (ohne Abhängigkeiten)', () => {
    for (const d of DATEIEN) expect((GLEICH_WIE_WEBSITE as Record<string, string>)[`js/szene/${d}`]).toBe(`js/szene/${d}`);
  });

  it('eine geänderte Kopie fällt auf', () => {
    const d = mkdtempSync(join(tmpdir(), 'szene-website-'));
    try {
      mkdirSync(join(d, 'fokus/js'), { recursive: true });
      cpSync(join(wurzel, QUELLE), join(d, QUELLE), { recursive: true });
      cpSync(join(wurzel, 'fokus/js/szene'), join(d, 'fokus/js/szene'), { recursive: true });
      writeFileSync(join(d, 'fokus/js/szene/motor.js'), readFileSync(join(d, 'fokus/js/szene/motor.js'), 'utf8') + '\n// eigene Fassung\n');
      expect(pruefen(d)).toEqual(['fokus/js/szene/motor.js: weicht von website/js/szene/motor.js ab']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('Szene von fokusinnovation.de — Geometrie ohne DOM', () => {
  const S = szene('fokus');

  it('die Tafel ist in allen drei Zuständen Punkt für Punkt gleich (nur die Kamera fährt); die Karte nennt die sechs Städte', () => {
    for (const handy of [false, true]) {
      const welt = S.formationen.bauen(S.drehbuch, { handy, anzahl: handy ? 3200 : 6000 });
      const name = (n: string) => S.drehbuch.zustaende.findIndex((z: Szene) => z.name === n);
      const tafel = ['abend', 'gespraech', 'themen'].map(n => Array.from(welt.formationen[name(n)].punkte as Float32Array));
      expect(tafel[1]).toEqual(tafel[0]);
      expect(tafel[2]).toEqual(tafel[0]);
      // Jedes Teilchen der Tafel ist zu sehen (kein Füllpunkt mit Helligkeit 0) — der Boden nimmt die übrigen.
      expect(tafel[0].filter((_, i) => i % 4 === 3).every(w => w % 1 > 0)).toBe(true);
      expect(welt.formationen[name('staedte')].marken).toHaveLength(6);
    }
  });

  it('Karte: die Städte der Reihe in der Reihenfolge von scripts/fokus-seite.mjs, Berlin ist der Start', async () => {
    const { STAEDTE } = await import('../scripts/fokus-seite.mjs');
    const karte = S.drehbuch.zustaende.find((z: Szene) => z.formation === 'karte');
    expect(karte.optionen.start).toBe('Berlin');
    expect(karte.optionen.staedte.map((s: Szene) => [s.name, s.lat, s.lon])).toEqual((STAEDTE as Szene[]).map(s => [s.name, s.breite, s.laenge]));
  });

  it('Kamera: endliche Werte für jeden Scroll-Stand, Rechner und Handy; ruhig gestellt (ohne Netz und Pfad)', () => {
    const Z = S.kern.zustaende(S.drehbuch.zustaende);
    for (let T = 0; T <= Z.length - 1; T += .25) for (const handy of [false, true]) {
      const kam = S.kern.kamera(Z, T, 0, 0, handy ? .46 : 1.6, { handy });
      expect([...kam.auge, ...kam.ziel, kam.D].every(Number.isFinite)).toBe(true);
    }
    expect(S.drehbuch.netz).toBe(false);
    expect(S.drehbuch.pfad).toBe(false);
    expect(S.drehbuch.fortschritt).toBe('extern');
  });
});

describe('makeinnovation.de bleibt unverändert', () => {
  it('das Drehbuch nutzt die neue Formation nicht (Kugel wie bisher)', () => {
    const S = szene('website');
    for (const z of S.drehbuch.zustaende) expect(z.formation).toBe('kugel');
  });
});
