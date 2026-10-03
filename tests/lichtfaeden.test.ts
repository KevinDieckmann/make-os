// ─── Lichtfäden (03.10.): Mathematik, Markierungs-Layout, Helligkeit, reduzierte Bewegung, Website-Kopie ─
// Modell, Quellen, Baum, Engstellen, Route und Oberfläche der v2 prüfen tests/lichtfaeden-*.test.ts.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fadenSaaten, versatz, gauss, saettigen, wertBei, kurve, textSaat, zufall, spreizung, LICHTFAEDEN } from '@/lib/lichtfaeden/band';
import { starteLauf } from '@/lib/lichtfaeden/zeichnen';
import { BAND_MASSE, bandMasse, hellBei, dichteBei, sanft, engstellenGruppen, type BandBild } from '@/lib/lichtfaeden/faedenband';
import { stapeln } from '@/lib/planung/zeitstrahl';
import { erzeugen, ZIEL } from '../scripts/lichtfaeden-website.mjs';

describe('Lichtfäden — Mathematik', () => {
  it('Saaten und Versatz sind deterministisch und begrenzt', () => {
    expect(fadenSaaten(22, 7)).toEqual(fadenSaaten(22, 7));
    expect(fadenSaaten(22, 7)).not.toEqual(fadenSaaten(22, 8));
    expect(textSaat('z-a')).toBe(textSaat('z-a'));
    const r = zufall(1); const werte = Array.from({ length: 1000 }, r);
    expect(Math.min(...werte)).toBeGreaterThanOrEqual(0); expect(Math.max(...werte)).toBeLessThan(1);
    for (const f of fadenSaaten(30, 3)) for (const s of [0, 100, 777]) for (const t of [0, 5000, 1e6]) expect(Math.abs(versatz(f, s, t))).toBeLessThan(1.4);
    // Standbild (t = 0) ist stabil, Bewegung verschiebt
    const f = fadenSaaten(1, 5)[0];
    expect(versatz(f, 50, 0)).toBe(versatz(f, 50, 0));
    expect(versatz(f, 50, 3000)).not.toBe(versatz(f, 50, 0));
  });

  it('Glättung erhält die Summe, Sättigung bleibt unter 1, Werte zwischen Feldern linear', () => {
    const g = gauss([0, 0, 0, 0, 6, 0, 0, 0, 0], 1);
    expect(g.reduce((a, c) => a + c, 0)).toBeCloseTo(6, 5);
    expect(g[4]).toBeGreaterThan(g[3]);
    expect(saettigen(0, 1)).toBe(0); expect(saettigen(1, 1)).toBeCloseTo(0.5); expect(saettigen(100, 1)).toBeLessThanOrEqual(1);
    expect(wertBei([0, 1], 0.5)).toBeCloseTo(0.5); expect(wertBei([0, 1], 0)).toBe(0); expect(wertBei([0, 1], 1)).toBe(1);
    expect(spreizung(1, 100)).toBeGreaterThan(spreizung(0, 100));
    expect(spreizung(0, 100)).toBeCloseTo(100 * LICHTFAEDEN.ruhe * 0.85);
  });

  it('Kurve: durch die Anker, Normalen Einheitslänge, Weg wächst, Werte gleiten', () => {
    const k = kurve([{ x: 0, y: 0, werte: [0] }, { x: 0, y: 100, werte: [10] }, { x: 50, y: 200, werte: [20] }], 5);
    expect(k[0]).toMatchObject({ x: 0, y: 0 });
    expect(k.at(-1)!.x).toBeCloseTo(50); expect(k.at(-1)!.y).toBeCloseTo(200);
    for (let i = 1; i < k.length; i++) { expect(k[i].s).toBeGreaterThan(k[i - 1].s); expect(Math.hypot(k[i].nx, k[i].ny)).toBeCloseTo(1); }
    expect(k.find(p => Math.abs(p.y - 100) < 0.01)?.werte[0]).toBeCloseTo(10);
  });

  it('Helligkeit: Vergangenheit gedämpft, HEUTE leuchtet, Dichte hebt', () => {
    const d = { heuteX: 500 } as BandBild;
    expect(hellBei(100, d, 0)).toBeLessThan(hellBei(900, d, 0));
    expect(hellBei(500, d, 0)).toBeGreaterThan(hellBei(900, d, 0));
    expect(hellBei(900, d, 1)).toBeGreaterThan(hellBei(900, d, 0));
    expect(hellBei(100, { heuteX: null, heuteSeite: 'links' } as BandBild, 0)).toBeGreaterThan(hellBei(100, { heuteX: null, heuteSeite: 'rechts' } as BandBild, 0));
  });

  it('Dichte an einer Stelle: Woche 0 beginnt `wochenVersatz` Tage vor dem Fenster, linear zwischen den Wochenmitten', () => {
    const d = { breite: 70, tage: 70, wochenVersatz: 0 };
    const b = { dichte: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] };
    expect(dichteBei(b, 10.5, d)).toBeCloseTo(1); // Mitte der zweiten Woche (Tag 10,5)
    expect(dichteBei(b, 3.5, d)).toBeCloseTo(0);
    expect(dichteBei(b, 7, d)).toBeCloseTo(0.5);
    expect(dichteBei({ dichte: [0, 1] }, 0, { breite: 70, tage: 70, wochenVersatz: 7 })).toBeCloseTo(0.5); // Fenster beginnt in Woche 1
    expect(dichteBei({ dichte: [] }, 5, d)).toBe(0);
  });

  it('Engstellen-Knöpfe: benachbarte Wochen werden EIN Knopf „KW 42–44“, entfernte bleiben einzeln', () => {
    const g = engstellenGruppen([{ x: 100, kw: 42 }, { x: 110, kw: 43 }, { x: 121, kw: 44 }, { x: 400, kw: 3 }], 64);
    expect(g.map(x => x.label)).toEqual(['KW 42–44', 'KW 3']);
    expect(g[0].x).toBeCloseTo(110.33, 1);
    expect(engstellenGruppen([], 64)).toEqual([]);
  });

  it('Übergang schwingt sanft: 0 → 0, ½ → ½, 1 → 1, monoton', () => {
    expect(sanft(0)).toBe(0); expect(sanft(1)).toBe(1); expect(sanft(0.5)).toBeCloseTo(0.5);
    for (let q = 0; q < 1; q += 0.05) expect(sanft(q + 0.05)).toBeGreaterThanOrEqual(sanft(q));
    expect(sanft(-1)).toBe(0); expect(sanft(2)).toBe(1);
  });
});

describe('Markierungen über dem Band — ohne Überlappung', () => {
  for (const [name, m] of Object.entries(BAND_MASSE)) {
    it(`${name}: gleiche Reihe nie überlappend, Reihen nie übereinander, Knopf passt in die Reihe${name === 'handy' ? ', Tippziel ≥ 44 px' : ''}`, () => {
      const r = zufall(42);
      const breite = name === 'handy' ? 320 : 1100;
      for (let lauf = 0; lauf < 50; lauf++) {
        const items = Array.from({ length: 4 + Math.floor(r() * 20) }, () => ({ x: r() * breite, w: 40 + r() * 140 })).sort((a, c) => a.x - c.x);
        const st = stapeln(items, breite, m.maxReihen);
        const lagen = st.lagen.map((l, i) => ('reihe' in l ? { ...l, w: Math.min(items[i].w, breite) } : null)).filter(Boolean) as { reihe: number; links: number; w: number }[];
        for (const a of lagen) {
          expect(a.links).toBeGreaterThanOrEqual(0); expect(a.links + a.w).toBeLessThanOrEqual(breite + 0.001);
          expect(a.reihe).toBeLessThan(m.maxReihen);
          for (const c of lagen) if (a !== c && a.reihe === c.reihe) expect(a.links + a.w <= c.links || c.links + c.w <= a.links).toBe(true);
        }
        // jede Eingabe hat eine Lage (Reihe oder „+n“)
        expect(st.lagen.length).toBe(items.length);
      }
      expect(m.knopf).toBeLessThanOrEqual(m.reihe);
      expect(m.chip).toBeLessThanOrEqual(m.knopf);
      if (name === 'handy') expect(m.knopf).toBeGreaterThanOrEqual(44);
    });
  }
  it('Handy-Maße unter 520 px Breite', () => {
    expect(bandMasse(375)).toBe(BAND_MASSE.handy);
    expect(bandMasse(1000)).toBe(BAND_MASSE.rechner);
  });
});

describe('Lauf — Bewegung und reduzierte Bewegung', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  function falscheUhr() {
    const warte: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    return { tick: (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); return f.length; } };
  }

  it('reduzierte Bewegung: genau ein Standbild (t = 0), danach nur auf Zuruf — keine Eigenbewegung', () => {
    const uhr = falscheUhr();
    const zeiten: number[] = [];
    const lauf = starteLauf({ beobachte: null, zeichne: t => zeiten.push(t), ruhig: true });
    uhr.tick(1000); uhr.tick(2000); uhr.tick(3000);
    expect(zeiten).toEqual([0]);
    lauf.einmal(); uhr.tick(9000);
    expect(zeiten).toEqual([0, 0]);
    lauf.stop(); lauf.einmal(); uhr.tick(10000);
    expect(zeiten).toEqual([0, 0]);
  });

  it('mit Bewegung: zeichnet je Bild mit wachsender Zeit, stoppt sauber und misst', () => {
    const uhr = falscheUhr();
    const zeiten: number[] = [];
    const lauf = starteLauf({ beobachte: null, zeichne: t => zeiten.push(t), ruhig: false });
    uhr.tick(1000); uhr.tick(1016); uhr.tick(1033);
    expect(zeiten).toEqual([0, 16, 33]);
    lauf.stop();
    uhr.tick(1050); uhr.tick(1066);
    expect(zeiten).toEqual([0, 16, 33]);
    expect(lauf.messung().bilder).toBe(3);
  });
});

describe('Website-Kopie der Lichtfäden', () => {
  it(`${ZIEL} entspricht band.ts + zeichnen.ts (sonst: node scripts/lichtfaeden-website.mjs)`, () => {
    expect(readFileSync(join(__dirname, '..', ZIEL), 'utf8')).toBe(erzeugen());
  });
  it('dieselben Parameter wie in der App, ohne Verbotenes', () => {
    const js = readFileSync(join(__dirname, '..', ZIEL), 'utf8');
    expect(js).toContain(`tempo: ${LICHTFAEDEN.tempo}`);
    expect(js).toContain(`rechner: ${LICHTFAEDEN.faeden.rechner}`);
    expect(js).not.toMatch(/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|eval|Function)\b|innerHTML|import\s*\(/);
    expect(js).not.toMatch(/MAKE[ ]?O[S]/i);
    expect(js.length).toBeLessThan(20000);
  });
});
