// ─── Fokus-Signatur + Strahl v3 (04.10.) ────────────────────────────────────
// Kevin (04.10.): „Diese Akzente will ich überall drauf haben, wo Fokus ist. Dezent, aber immer wichtig. Und der Strahl läuft im
// Grunde genommen immer von links nach rechts.“ Der Test hält fest: Reihen sind echte Daten (rein, deterministisch), die
// FadenLinie zeigt ohne Reihe nichts und nennt die Reihe im Text, reduzierte Bewegung = ein Standbild, der Strahl fließt nach
// rechts und wächst von links ein, Karte `ton="fokus"`/Segmentbalken rendern mit Rolle und Kante — und die Regeln je Ansicht.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  jeTag, jeWoche, summeJeMonat, summeJeTagZurueck, normalisiere, reiheGueltig, reiheText, tagBeschriftung, wochenBeschriftung,
  monatBeschriftung, tageZurueckBeschriftung, wocheMontag,
} from '@/lib/lichtfaeden/reihen';
import { fadenLinienProben, fadenlinie, FADENLINIE, type FadenLinieBild } from '@/lib/lichtfaeden/fadenlinie';
import { fadenSaaten, versatz, fransen, buendelMitte, LICHTFAEDEN } from '@/lib/lichtfaeden/band';
import { zeichneBuendel, type Probe } from '@/lib/lichtfaeden/zeichnen';
import { faedenband, wocheBei, type BandBild } from '@/lib/lichtfaeden/faedenband';
import { FOKUS_LICHT } from '@/lib/make-one/design';

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

const HEUTE = '2026-10-04'; // ein Sonntag

describe('Reihen (rein)', () => {
  it('jeTag: Index 0 = heute, Überfälliges zählt auf heute, nach dem Fenster nichts, Ungültiges fällt weg', () => {
    const r = jeTag(['2026-10-04', '2026-10-01', '2026-10-05', '2026-10-17', '2026-10-18', 'kaputt', null, undefined], HEUTE, 14);
    expect(r).toHaveLength(14);
    expect(r[0]).toBe(2); expect(r[1]).toBe(1); expect(r[13]).toBe(1);
    expect(r.reduce((a, v) => a + v, 0)).toBe(4); // 18.10. liegt hinter dem Fenster
    expect(jeTag(['2026-10-01'], HEUTE, 3, { ueberfaelligHeute: false })).toEqual([0, 0, 0]);
  });
  it('jeWoche: älteste zuerst, die laufende Woche zuletzt (Montag-Wochen)', () => {
    expect(wocheMontag(HEUTE)).toBe('2026-09-28');
    const r = jeWoche(['2026-10-04', '2026-09-28', '2026-09-27', '2026-08-01', '2026-11-01'], HEUTE, 4);
    expect(r).toEqual([0, 0, 1, 2]);
  });
  it('summeJeMonat und summeJeTagZurueck: Summen je Feld, Überfälliges im laufenden Monat', () => {
    expect(summeJeMonat([{ tag: '2026-10-20', wert: 100 }, { tag: '2026-09-01', wert: 50 }, { tag: '2026-12-02', wert: 7.5 }, { tag: '2027-06-01', wert: 1 }], HEUTE, 3)).toEqual([150, 0, 7.5]);
    expect(summeJeTagZurueck([{ tag: '2026-10-04', wert: 30 }, { tag: '2026-10-02', wert: 15 }, { tag: '2026-09-01', wert: 99 }], HEUTE, 3)).toEqual([15, 0, 30]);
  });
  it('normalisiere: 0 … 1, Boden = 0; mit negativen Werten liegt die Nulllinie dazwischen; flache Reihe am Boden', () => {
    expect(normalisiere([0, 5, 10])).toEqual({ werte: [0, 0.5, 1], null0: null });
    const n = normalisiere([-100, 0, 300]);
    expect(n.null0).toBeCloseTo(0.25); expect(n.werte).toEqual([0, 0.25, 1]);
    expect(normalisiere([0, 0, 0])).toEqual({ werte: [0, 0, 0], null0: null });
  });
  it('reiheGueltig: mindestens zwei endliche Werte', () => {
    expect(reiheGueltig([1, 2])).toBe(true);
    expect(reiheGueltig([1])).toBe(false); expect(reiheGueltig([])).toBe(false); expect(reiheGueltig([1, NaN])).toBe(false); expect(reiheGueltig(null)).toBe(false);
  });
  it('reiheText nennt jeden Wert mit Beschriftung, Summe und Höchstwert', () => {
    const t = reiheText('Fällige Follow-ups, nächste 3 Tage', [3, 0, 1], tagBeschriftung(HEUTE));
    expect(t).toBe('Fällige Follow-ups, nächste 3 Tage: heute 3, morgen 0, Di 6.10. 1 — zusammen 4, höchstens 3.');
    expect(wochenBeschriftung(HEUTE, 3)(2)).toBe('diese Woche');
    expect(wochenBeschriftung(HEUTE, 3)(0)).toBe('Woche ab 14.9.');
    expect(monatBeschriftung(HEUTE)(3)).toBe('Jan');
    expect(tageZurueckBeschriftung(HEUTE, 3)(0)).toBe('Fr 2.10.');
  });
});

describe('Strahl v3 — Fließen nach rechts, Ausfransen, Spitzen', () => {
  it('alle Fäden fließen in Zeitrichtung (Tempo > 0); das Muster verschiebt sich mit der Zeit nach rechts', () => {
    const saaten = fadenSaaten(30, 11);
    expect(saaten.every(f => f.tempo > 0)).toBe(true);
    // Kreuzkorrelation: welche Verschiebung k bringt das Bild zu t = 4 s mit dem zu t = 0 zur Deckung? k > 0 = nach rechts.
    for (const f of saaten.slice(0, 8)) {
      const a = Array.from({ length: 1600 }, (_, s) => versatz(f, s, 0));
      const b = Array.from({ length: 1600 }, (_, s) => versatz(f, s, 4000));
      let best = 0, bestK = 0;
      for (let k = -80; k <= 80; k++) { let c = 0; for (let s = 100; s < 1500; s++) c += a[s] * b[s + k]; if (c > best) { best = c; bestK = k; } }
      expect(bestK).toBeGreaterThan(0);
    }
    // Die Leitkurven der Bündel ebenso.
    const m0 = Array.from({ length: 1600 }, (_, s) => buendelMitte(1, 3, s, 0, 0.7));
    const m1 = Array.from({ length: 1600 }, (_, s) => buendelMitte(1, 3, s, 6000, 0.7));
    let best = -Infinity, bestK = 0;
    for (let k = -150; k <= 150; k++) { let c = 0; for (let s = 200; s < 1400; s++) c += m0[s] * m1[s + k]; if (c > best) { best = c; bestK = k; } }
    expect(bestK).toBeGreaterThan(0);
  });
  it('Ausfransen (FadenLinie) ist begrenzt', () => {
    for (const f of fadenSaaten(20, 3)) for (const s of [0, 300, 900]) expect(Math.abs(fransen(f, s, 5000))).toBeLessThan(1.5);
  });
  // Strahl ruhig (04.10. abends): Band, Spuren, Ausschlag nur aus Abweichungen — Wächter in tests/strahl-ruhig.test.ts.
  it('Dichte je Woche: linear zwischen Wochenmitten', () => {
    const d = { breite: 70, tage: 70, wochenVersatz: 0 };
    expect(wocheBei([0, 1, 0], 10.5, d)).toBeCloseTo(1);
    expect(wocheBei([0, 1, 0], 7, d)).toBeCloseTo(0.5);
  });
});

// ── Zeichner gegen eine Attrappe ─────────────────────────────────────────────
function attrappe() {
  const linienX: number[] = []; let rechtecke = 0, striche = 0;
  class P { moveTo() {} lineTo(x: number) { linienX.push(x); } rect() { rechtecke++; } arc() {} }
  vi.stubGlobal('Path2D', P);
  const ctx = new Proxy({}, { get: (_, k) => (k === 'stroke' ? () => { striche++; } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: () => {} }) : () => {}), set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx: ctx as CanvasRenderingContext2D, linienX, rechtecke: () => rechtecke, striche: () => striche };
}
function uhr() {
  const warte: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); };
}
const proben = (n: number): Probe[] => Array.from({ length: n }, (_, i) => ({ x: i * 5, y: 50, nx: 0, ny: 1, s: i * 5, spreizung: 6, hell: 1 }));

describe('Zeichner v3', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('Aufbau: kein Faden reicht über die Front hinaus; ohne Front bis ans Ende', () => {
    const a = attrappe();
    zeichneBuendel(a.ctx, proben(200), { farbe: '#5AD7F2', saaten: fadenSaaten(10, 1), front: 300 }, 0);
    expect(Math.max(...a.linienX)).toBeLessThanOrEqual(300 + 1e-6);
    const b = attrappe();
    zeichneBuendel(b.ctx, proben(200), { farbe: '#5AD7F2', saaten: fadenSaaten(10, 1) }, 0);
    expect(Math.max(...b.linienX)).toBeCloseTo(995);
  });
  it('Partikel: nur mit `punkte`, und sie wandern mit der Zeit', () => {
    const a = attrappe();
    zeichneBuendel(a.ctx, proben(200), { farbe: '#5AD7F2', saaten: fadenSaaten(6, 1) }, 0);
    expect(a.rechtecke()).toBe(0);
    const b = attrappe();
    zeichneBuendel(b.ctx, proben(200), { farbe: '#5AD7F2', saaten: fadenSaaten(6, 1), punkte: LICHTFAEDEN.punkte }, 0);
    expect(b.rechtecke()).toBeGreaterThan(6 * 50);
  });
  it('Fädenband: Aufbau läuft 0 → 1 und endet; reduzierte Bewegung = kein Aufbau, ein Standbild', () => {
    const BILD: BandBild = { breite: 600, hoehe: 260, bandOben: 40, bandHoehe: 150, wochenVersatz: 0, tage: 182, buendel: [{ id: 'b', farbe: '#FF9F43', dichte: [0.2, 0.8, 0.3], ausschlag: [0, 1, 0], faeden: 8 }], heuteX: 200, heuteFarbe: '#4FC3F7', verbinder: [], engstellen: [], engstelleFarbe: '#FFC93C', hervor: null, handy: false };
    let tick = uhr();
    attrappe();
    const z = faedenband(attrappe().canvas, null as unknown as Element, false);
    z.setze(BILD);
    tick(1000);
    expect(z.aufbau()).toBe(0);
    tick(1000 + LICHTFAEDEN.aufbau / 2);
    expect(z.aufbau()).toBeGreaterThan(0.3); expect(z.aufbau()).toBeLessThan(0.7);
    tick(1000 + LICHTFAEDEN.aufbau + 10);
    expect(z.aufbau()).toBeNull();
    z.stop();
    tick = uhr();
    const r = faedenband(attrappe().canvas, null as unknown as Element, true);
    r.setze(BILD); tick(500); tick(900);
    expect(r.aufbau()).toBeNull();
    expect(r.lauf.messung().bilder).toBe(1);
    r.stop();
  });
});

describe('FadenLinie (Mini-Strahl)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const BILD: FadenLinieBild = { breite: 300, hoehe: 44, werte: [0, 1, 0.2, 0.5], null0: null, farbe: '#5AD7F2', heute: 1, handy: false, saat: 'test' };
  it('Proben: deterministisch, höherer Wert = weiter oben und breiter, Ausfransen nur rechts von HEUTE, Normalen Einheitslänge', () => {
    const p = fadenLinienProben(BILD);
    expect(p).toEqual(fadenLinienProben(BILD));
    expect(p.length).toBeGreaterThan(80);
    const spitze = p.reduce((a, x) => (x.y < a.y ? x : a));
    expect(spitze.x).toBeCloseTo(FADENLINIE.rand + (300 - 2 * FADENLINIE.rand) / 3, 0);
    expect(spitze.spreizung).toBeGreaterThan(p[0].spreizung);
    for (const x of p) expect(Math.hypot(x.nx, x.ny)).toBeCloseTo(1);
    expect(p.filter(x => x.x < spitze.x).every(x => !x.frans)).toBe(true);
    expect(p.at(-1)!.frans).toBeGreaterThan(0.5);
    expect(fadenLinienProben({ ...BILD, werte: [1] })).toEqual([]);
  });
  it('Zeichner: reduzierte Bewegung = ein Standbild ohne Aufbau; mit Bewegung höchstens ~30 Bilder je Sekunde', () => {
    let tick = uhr();
    const ruhig = fadenlinie(attrappe().canvas, null, true);
    ruhig.setze(BILD); tick(100); tick(200); tick(300);
    expect(ruhig.lauf.messung().bilder).toBe(1);
    expect(ruhig.aufbau()).toBeNull();
    ruhig.stop();
    tick = uhr();
    const z = fadenlinie(attrappe().canvas, null, false);
    z.setze(BILD);
    for (let t = 0; t <= 1000; t += 16) tick(t);
    const n = z.lauf.messung().bilder;
    expect(n).toBeGreaterThan(20); expect(n).toBeLessThanOrEqual(32);
    z.stop();
  });
  it('Baustein: ohne gültige Reihe nichts; mit Reihe eine Abbildung mit dem ganzen Text als aria-label, Leinwand verborgen', async () => {
    const { FadenLinie } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(FadenLinie, { reihe: [], label: 'Leer' }))).toBe('');
    expect(renderToStaticMarkup(h(FadenLinie, { reihe: [4], label: 'Eins' }))).toBe('');
    const html = renderToStaticMarkup(h(FadenLinie, { reihe: [3, 0, 1], label: 'Fällige Follow-ups', beschriftung: tagBeschriftung(HEUTE), achse: ['Heute', '+2 T'] }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Fällige Follow-ups: heute 3, morgen 0, Di 6.10. 1 — zusammen 4, höchstens 3."');
    expect(html).toMatch(/<canvas[^>]*aria-hidden="true"/);
    expect(html).toContain('ui-fadenlinie-achse');
  });
});

describe('Karte ton="fokus" und Segmentbalken', () => {
  it('Fokus-Karte: Klasse, laufende Kante in der Lichtfarbe, Netz nur auf Wunsch; normale Karte ohne Kante', async () => {
    const { Karte } = await import('@/components/os/ui');
    const f = renderToStaticMarkup(h(Karte, { ton: 'fokus', children: 'Inhalt' }));
    expect(f).toContain('ui-karte-fokus');
    expect(f).toContain('ui-fokus-kante');
    expect(f).toContain('ui-fokus-licht');
    expect(f).toContain(FOKUS_LICHT);
    expect(f).not.toContain('ui-netz');
    const n = renderToStaticMarkup(h(Karte, { ton: 'fokus', licht: '#FF9F43', netz: true, children: 'x' }));
    expect(n).toContain('ui-netz'); expect(n).toContain('#FF9F43');
    const g = renderToStaticMarkup(h(Karte, { ton: '#FF9F43', children: 'x' }));
    expect(g).not.toContain('ui-fokus-kante');
  });
  it('Segmentbalken: Rolle progressbar mit Prozent, belegte Segmente nach Anteil', async () => {
    const { Segmentbalken } = await import('@/components/os/ui');
    const html = renderToStaticMarkup(h(Segmentbalken, { anteil: 0.5, label: 'Gespräche 2 von 4', segmente: 12, zahl: true }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html.match(/ui-segbalken-teil ui-segbalken-an/g)?.length).toBe(6);
    expect(html.match(/class="ui-segbalken-teil"/g)?.length).toBe(6);
    // eigene Klassen — `.ui-segment` gehört den Segment-Knöpfen (Praxis 04.10.: sonst wurden die Umschalter schräg)
    expect(lies('app/globals.css')).not.toMatch(/\.ui-segment\s*\{[^}]*skewX/);
    expect(html).toContain('50 %');
  });
});

describe('Wächter — Regeln der Fokus-Signatur', () => {
  const quellen = dateien('components').filter(f => !f.startsWith('components/os/ui/'));
  it('jede FadenLinie bekommt eine echte Reihe (keine fest eingetippte Zahlenliste) und einen Text', () => {
    let n = 0;
    for (const f of quellen) {
      const t = lies(f);
      for (const m of t.matchAll(/<FadenLinie\b([\s\S]*?)\/>/g)) {
        n++;
        expect(m[1], `${f}: FadenLinie ohne reihe`).toMatch(/\breihe=\{/);
        expect(m[1], `${f}: FadenLinie mit fester Zahlenliste`).not.toMatch(/\breihe=\{\s*\[/);
        expect(m[1], `${f}: FadenLinie ohne label`).toMatch(/\blabel=/);
      }
    }
    expect(n).toBeGreaterThanOrEqual(7);
  });
  it('höchstens EINE Fokus-Karte und ZWEI FadenLinien je Datei (≈ je Ansicht)', () => {
    for (const f of quellen) {
      const t = lies(f);
      const karten = (t.match(/\bton=(?:"fokus"|\{[^}]*['"]fokus['"][^}]*\})/g) ?? []).length;
      const linien = (t.match(/<FadenLinie\b/g) ?? []).length;
      expect(karten, `${f}: ${karten} Fokus-Karten`).toBeLessThanOrEqual(1);
      expect(linien, `${f}: ${linien} FadenLinien`).toBeLessThanOrEqual(2);
    }
  });
  it('eingebaut, wo Fokus ist', () => {
    const fokus = (f: string) => /\bton=(?:"fokus"|\{[^}]*['"]fokus['"])/.test(lies(f));
    for (const f of ['components/os/crm/Ueberblick.tsx', 'components/os/crm/Qualifizierung.tsx', 'components/os/crm/Heute.tsx', 'components/os/crm/Pipeline.tsx', 'components/os/planung/ZielDetail.tsx', 'components/os/FokusView.tsx']) expect(fokus(f), f).toBe(true);
    for (const f of ['components/os/LiquiditaetView.tsx', 'components/os/zeit/ZeitJeEinheit.tsx', 'components/os/kennzahlen/IndexAnsicht.tsx']) expect(lies(f), f).toContain('<FadenLinie');
  });
  it('Farben aus dem Token, Bewegung in CSS still bei reduzierter Bewegung, Doku nennt die Bausteine', () => {
    for (const f of quellen) expect(lies(f).toUpperCase(), f).not.toContain(FOKUS_LICHT.toUpperCase());
    const css = lies('app/globals.css');
    expect(css).toMatch(/\.ui-fokus-licht\s*\{[^}]*animation:/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after \{ animation: none !important;/);
    expect(css).not.toMatch(/\.ui-karte-fokus\s*\{[^}]*backdrop-filter/); // kein Halt für fixe Dialoge in der Karte
    const doku = lies('DESIGN_STANDARD.md');
    for (const w of ['Fokus-Signatur', 'FadenLinie', 'Segmentbalken', 'ton="fokus"', 'Strahl v3']) expect(doku).toContain(w);
    expect(lies('LICHTFAEDEN.md')).toContain('Strahl v3');
  });
});
