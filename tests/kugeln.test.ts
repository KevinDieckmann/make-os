// ─── ZOE-Kugel + Brain-Kugel — Mathematik, Zustände, CI, Leistung, Rückfall (05.10.2026) ─
// Kevin (04.10., UMBAU_ABEND_0410.md 1/3): ZOE tritt als Lichtkugel auf (Vorlage „Solaris“ — die Wirkung, nicht der Code),
// groß im Empfang und klein als Symbol; das Brain wird eine Kugel aus allen Datensätzen. Der Test hält fest: die reine
// Rechnung (Kugel, Zeiger, Projektion, Einstieg), die Zustände über Tempo/Farbgewicht (wie das ZoeHirn), NUR unsere Farben
// (Granat/Smaragd + abgeleitete Töne aus design.ts — kein Farb-Literal in components/os/kugel), die Leistungsregeln
// (Deckel, Pause, dpr ≤ 2, Kontext freigeben) und die Rückfälle (ZoeHirn, Symbol, Liste).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  fibonacciKugel, zeigerAufKugel, aufBildschirm, drehung, perspektive, kameraAbstand, laenge, einstieg, EINSTIEG_MS,
  zoeParameter, ZOE_ZUSTAND, nachziehen, alsRgb, verlaufT, type Vec3,
} from '@/components/os/kugel/geometrie';
import { zoeWolke, ZOE_PUNKTE } from '@/components/os/kugel/wolke';
import { brainLayout, BEREICH_MITTE, frische, HUELLE_PUNKTE } from '@/components/os/kugel/brain-layout';
import { UNIFORMS, ECKEN_SHADER, FLAECHEN_SHADER } from '@/components/os/kugel/shader';
import { KUGEL, KUGEL_BEREICH_FARBE, FARBE, mischHex } from '@/lib/make-one/design';
import type { BrainPunkt } from '@/lib/brain/kugel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const nah = (a: number, b: number, e = 1e-4) => Math.abs(a - b) < e;

describe('Kugel-Mathematik (rein)', () => {
  it('Fibonacci-Kugel: n Einheitsvektoren, deterministisch, gleichmäßig über beide Hälften', () => {
    const a = fibonacciKugel(2000, 7), b = fibonacciKugel(2000, 7);
    expect(a).toEqual(b);
    let oben = 0;
    for (let i = 0; i < 2000; i++) {
      expect(nah(laenge([a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]), 1, 1e-5)).toBe(true);
      if (a[i * 3 + 1] > 0) oben++;
    }
    expect(Math.abs(oben - 1000)).toBeLessThan(40);
  });
  it('Zeiger trifft die Kugel vorne, daneben nichts — und der Treffer liegt auf dem Bildschirm unter dem Zeiger', () => {
    const fov = (34 * Math.PI) / 180, D = kameraAbstand(fov, 1, 0.8);
    const dreh = drehung(0.7, 0.3), proj = perspektive(fov, 1, 0.1, 50);
    const mitte = zeigerAufKugel([0, 0], fov, 1, D, drehung(0, 0));
    expect(mitte && nah(mitte[2], 1)).toBe(true);
    expect(zeigerAufKugel([0.99, 0.99], fov, 1, D, dreh)).toBeNull();
    const t = zeigerAufKugel([0.2, -0.15], fov, 1, D, dreh)!;
    expect(nah(laenge(t), 1, 1e-6)).toBe(true);
    const s = aufBildschirm(t, dreh, proj, D, 400, 400);
    expect(s.vorne).toBe(true);
    expect(Math.abs(s.x - (0.2 * 0.5 + 0.5) * 400)).toBeLessThan(0.5);
    expect(Math.abs(s.y - (0.5 + 0.15 * 0.5) * 400)).toBeLessThan(0.5);
    // Der Punkt gegenüber liegt hinten.
    expect(aufBildschirm([-t[0], -t[1], -t[2]] as Vec3, dreh, proj, D, 400, 400).vorne).toBe(false);
  });
  it('Kamera-Abstand: die Kugel füllt den gewünschten Anteil der kurzen Seite (hoch und quer)', () => {
    const fov = (34 * Math.PI) / 180;
    for (const aspekt of [1, 0.6, 1.8]) {
      const D = kameraAbstand(fov, aspekt, 0.8, 1);
      const proj = perspektive(fov, aspekt, 0.1, 50);
      const rand = aufBildschirm([1, 0, 0], drehung(0, 0), proj, D, 1000 * aspekt, 1000);
      const anteil = (rand.x - 500 * aspekt) / (Math.min(1000 * aspekt, 1000) / 2);
      expect(anteil).toBeGreaterThan(0.74); expect(anteil).toBeLessThan(0.86);
    }
  });
  it('Einstieg 2,4 s: gefüllt und nah → Ring und Abstand, die Wolke blüht aus dem Nichts auf', () => {
    expect(einstieg(0)).toEqual({ sicht: 0, hohl: 0, naeher: 1 });
    const ende = einstieg(EINSTIEG_MS);
    expect(ende.sicht).toBe(1); expect(ende.hohl).toBe(1); expect(nah(ende.naeher, 0)).toBe(true);
    const mitte = einstieg(EINSTIEG_MS / 2);
    expect(mitte.naeher).toBeLessThan(0.2); expect(mitte.hohl).toBeGreaterThan(0.3);
    expect(EINSTIEG_MS).toBe(2400);
  });
});

describe('ZOE-Zustände: Atem-Tempo und Farbgewicht, kein Feuerwerk', () => {
  it('dieselben Takte wie das ZoeHirn (TON) — ruht 5,4 · hört 4,2 · denkt 4,8 · spricht 3,2 s', async () => {
    const { TON } = await import('@/components/os/ZoeHirn');
    for (const z of ['ruht', 'hoert', 'denkt', 'spricht'] as const) expect(nah(ZOE_ZUSTAND[z].tempo, 5.4 / TON[z].takt)).toBe(true);
  });
  it('zuhören zieht nach innen und wird kühler (Smaragd), sprechen dehnt sich, denken wird wärmer (Granat)', () => {
    expect(ZOE_ZUSTAND.hoert.weite).toBeLessThan(0); expect(ZOE_ZUSTAND.hoert.verschiebung).toBeLessThan(0);
    expect(ZOE_ZUSTAND.spricht.weite).toBeGreaterThan(0); expect(ZOE_ZUSTAND.spricht.hell).toBeGreaterThan(ZOE_ZUSTAND.ruht.hell);
    expect(ZOE_ZUSTAND.denkt.verschiebung).toBeGreaterThan(0);
    // Der Pegel verstärkt in Richtung des Zustands: zuhören weiter nach innen, sprechen weiter nach außen.
    expect(zoeParameter('hoert', 1).weite).toBeLessThan(zoeParameter('hoert', 0).weite);
    expect(zoeParameter('spricht', 1).weite).toBeGreaterThan(zoeParameter('spricht', 0).weite);
  });
  it('dezent: Atem höchstens 11 % des Radius, Tempo nie über das Doppelte (auch mit vielen Aufträgen)', () => {
    for (const z of ['ruht', 'hoert', 'denkt', 'spricht'] as const) {
      const p = zoeParameter(z, 1, 50);
      expect(p.atem).toBeLessThanOrEqual(0.11); expect(p.tempo).toBeLessThanOrEqual(2); expect(Math.abs(p.weite)).toBeLessThanOrEqual(0.1);
    }
  });
  it('Zustandswechsel werden nachgezogen, nicht geschaltet — unabhängig von der Bildrate', () => {
    const a = zoeParameter('ruht'), b = zoeParameter('spricht', 0.5);
    const schritt60 = nachziehen(a, b, 1 / 60);
    let schritt30 = a; schritt30 = nachziehen(schritt30, b, 1 / 120); schritt30 = nachziehen(schritt30, b, 1 / 120);
    expect(schritt60.weite).toBeGreaterThan(a.weite); expect(schritt60.weite).toBeLessThan(b.weite);
    expect(nah(schritt60.weite, schritt30.weite, 1e-6)).toBe(true);
  });
});

describe('CI: nur Granat und Smaragd (und daraus abgeleitete Töne) — keine fremden Farben', () => {
  it('das Kugel-Paar ist das der Website', () => {
    expect(KUGEL.smaragd).toBe('#2FA878'); expect(KUGEL.granat).toBe('#C9465C');
    const css = lies('website/css/seite.css');
    expect(css).toContain(`--granat: ${KUGEL.granat}`); expect(css).toContain(`--smaragd: ${KUGEL.smaragd}`);
  });
  it('Bereichsfarben der Brain-Kugel sind nur Kugel-Paar, Mischungen mit unserem Weiß oder unser Silber', () => {
    const erlaubt = new Set([KUGEL.smaragd, KUGEL.granat, mischHex(KUGEL.smaragd, FARBE.ink, 0.5), mischHex(KUGEL.granat, FARBE.ink, 0.5), FARBE.inkDim]);
    for (const f of Object.values(KUGEL_BEREICH_FARBE)) expect(erlaubt.has(f)).toBe(true);
    expect(mischHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
  it('kein Farb-Literal in components/os/kugel (hex, rgb, hsl) — alles kommt aus lib/make-one/design.ts', () => {
    const ordner = path.join(wurzel, 'components/os/kugel');
    const dateien = readdirSync(ordner).filter(f => /\.(ts|tsx)$/.test(f));
    expect(dateien.length).toBeGreaterThanOrEqual(8);
    for (const f of dateien) {
      const code = ohneKommentare(readFileSync(path.join(ordner, f), 'utf8'));
      expect(code, f).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/);
      expect(code, f).not.toMatch(/\brgba?\s*\(|\bhsla?\s*\(/);
    }
  });
  it('die ZOE-Töne im Empfang kommen aus dem Kugel-Paar', async () => {
    const { ZOE_KUGEL_TON } = await import('@/components/os/kugel/ZoeKugel');
    expect(ZOE_KUGEL_TON.ruht).toBe(KUGEL.smaragd); expect(ZOE_KUGEL_TON.denkt).toBe(KUGEL.granat);
    expect(lies('components/os/ZoeStart.tsx')).toContain('farbe: ZOE_KUGEL_TON[zustand]');
  });
});

describe('Shader und Motor: Vorlage nachgebaut, Leistung im Griff', () => {
  it('Shader: Simplex-Atmen entlang der Normale, Fresnel-Rand (0,4 … 0,9), Ausbruch, Einstieg — jede Uniform deklariert', () => {
    expect(ECKEN_SHADER).toContain('snoise(n * 1.5'); expect(ECKEN_SHADER).toContain('smoothstep(0.4, 0.9, 1.0 - abs(zu))');
    expect(ECKEN_SHADER).toContain('e * uFlare * flacker'); expect(ECKEN_SHADER).toContain('uHohl');
    for (const u of UNIFORMS) expect(ECKEN_SHADER).toMatch(new RegExp(`uniform \\w+ ${u};`));
    expect(FLAECHEN_SHADER).toContain('gl_PointCoord');
    // WebGL 1: keine Erweiterungen, keine Texturen, kein three.js.
    expect(ECKEN_SHADER + FLAECHEN_SHADER).not.toMatch(/#version|texture2D|#extension/);
    expect(JSON.parse(lies('package.json')).dependencies.three).toBeUndefined();
  });
  it('Motor: Bildrate gedeckelt, pausiert außer Sicht und im Hintergrund, dpr ≤ 2, Puffer nach Layout-Box, Kontext wird freigegeben', () => {
    const m = lies('components/os/kugel/motor.ts');
    expect(m).toContain('IntersectionObserver'); expect(m).toContain("'visibilitychange'"); expect(m).toContain('document.hidden');
    expect(m).toContain('Math.min(2, window.devicePixelRatio'); expect(m).toContain('ResizeObserver');
    expect(m).toContain('mindestAbstand'); expect(m).toContain('loseContext()'); expect(m).toContain("'webglcontextlost'");
    expect(m).toMatch(/opt\.ruhig\) \{ zeichne\(performance\.now\(\)\); return; \}/); // Standbild: keine Schleife
  });
  it('Symbol: wenige Punkte, 24–30 Bilder je Sekunde, kein Zeiger; groß am Handy weniger Punkte', async () => {
    const { KUGEL_VORGABEN } = await import('@/components/os/kugel/Kugel');
    expect(ZOE_PUNKTE.symbol).toBeLessThanOrEqual(1500);
    expect(KUGEL_VORGABEN.symbol.fps).toBeGreaterThanOrEqual(24); expect(KUGEL_VORGABEN.symbol.fps).toBeLessThanOrEqual(30);
    expect(KUGEL_VORGABEN.symbol.zeigerRadius).toBe(0);
    expect(ZOE_PUNKTE.handy).toBeLessThan(ZOE_PUNKTE.gross);
    const w = zoeWolke(ZOE_PUNKTE.symbol);
    expect(w.pos.length).toBe(ZOE_PUNKTE.symbol * 3); expect(w.wert.length).toBe(ZOE_PUNKTE.symbol * 4); expect(w.pickbar).toBe(0);
    // Verlauf: unten Smaragd (0), oben Granat (1).
    expect(verlaufT([0, -1, 0])).toBeLessThan(0.2); expect(verlaufT([0, 1, 0])).toBeGreaterThan(0.8);
    expect(alsRgb(KUGEL.smaragd)[1]).toBeGreaterThan(alsRgb(KUGEL.smaragd)[0]);
  });
});

describe('Einbau und Rückfall', () => {
  it('Empfang: groß die Kugel, ohne WebGL das bisherige ZoeHirn — keine Verwandlung in einen Weg', () => {
    const s = lies('components/os/ZoeStart.tsx');
    expect(s).toMatch(/<ZoeKugel\s+groesse="gross"/); expect(s).toMatch(/rueckfall=\{\s*<ZoeHirn/);
    expect(s).toContain("aspectRatio: '1 / 1'");
    for (const f of readdirSync(path.join(wurzel, 'components/os/kugel'))) expect(readFileSync(path.join(wurzel, 'components/os/kugel', f), 'utf8')).not.toMatch(/pfad\(|formation|scroll/i);
  });
  it('ZoePanel: unten das Symbol (auch im Kopf), ohne WebGL das bisherige Orb', () => {
    const s = lies('components/os/ZoePanel.tsx');
    expect(s).toContain('<ZoeKugel groesse="symbol"'); expect(s).toContain('rueckfall={<Orb size={size} puls={puls} />}');
    expect((s.match(/<ZoeSymbol size=/g) ?? []).length).toBe(2);
  });
  it('die Leinwand rendert serverseitig dekorativ (aria-hidden) und ohne Hydrationsfalle', async () => {
    const { Kugel } = await import('@/components/os/kugel/Kugel');
    const html = renderToStaticMarkup(createElement(Kugel, { name: 'probe', art: 'symbol', daten: zoeWolke(10), zustand: zoeParameter('ruht'), rueckfall: createElement('span', null, 'R') }));
    expect(html).toContain('<canvas'); expect(html).toContain('aria-hidden="true"'); expect(html).toContain('data-kugel="probe"');
    expect(html).not.toContain('R</span>');
  });
  it('Brain-Seite: die Kugel steht in der Brain-Übersicht, darunter die Liste als Rückfall (Tastatur, Vorleser)', () => {
    expect(lies('components/os/WissenView.tsx')).toContain('<BrainKugel />');
    const b = lies('components/os/kugel/BrainKugel.tsx');
    expect(b).toContain("fetch('/api/brain/punkte')"); expect(b).toContain('Alle Punkte als Liste');
    expect(b).toContain('onFocus={() => zeige(p.id)}'); expect(b).toContain('href={wegFuer(p)}');
    expect(b).toContain('<details open={!mitGl}');
  });
});

describe('Brain-Layout (rein)', () => {
  const p = (id: string, art: BrainPunkt['art'], bereich: BrainPunkt['bereich'], datum: string | null): BrainPunkt => ({ id: `${art}:${id}`, art, bereich, titel: id, datum, links: [] });
  const punkte: BrainPunkt[] = [
    ...Array.from({ length: 40 }, (_, i) => p(`k${i}`, 'kontakt', 'markttraktion', '2026-10-01')),
    ...Array.from({ length: 12 }, (_, i) => p(`f${i}`, 'firma', 'markttraktion', '2026-06-01')),
    ...Array.from({ length: 30 }, (_, i) => p(`a${i}`, 'aufgabe', 'planung', '2026-10-03')),
    ...Array.from({ length: 8 }, (_, i) => p(`t${i}`, 'termin', 'kalender', '2026-10-08')),
    ...Array.from({ length: 20 }, (_, i) => p(`n${i}`, 'notiz', 'wissen', null)),
    p('g1', 'gesellschaft', 'unternehmen', '2026-01-01'),
  ];
  it('jeder Datensatz ein Punkt auf der Kugel, zeigbar, mit Kennung je Puffer-Index; die Hülle ist nie zeigbar', () => {
    const l = brainLayout(punkte, '2026-10-05');
    expect(l.daten.pickbar).toBe(punkte.length);
    expect(l.ids).toHaveLength(punkte.length);
    expect(l.daten.pos.length).toBe((punkte.length + HUELLE_PUNKTE) * 3);
    for (const q of punkte) {
      const i = l.index.get(q.id)!;
      expect(l.ids[i]).toBe(q.id);
      expect(nah(laenge([l.daten.pos[i * 3], l.daten.pos[i * 3 + 1], l.daten.pos[i * 3 + 2]]), 1, 1e-5)).toBe(true);
    }
    expect(brainLayout(punkte, '2026-10-05').daten.pos).toEqual(l.daten.pos); // deterministisch
  });
  it('Cluster: ein Punkt liegt näher an der Mitte SEINES Bereichs als an jeder anderen', () => {
    const l = brainLayout(punkte, '2026-10-05', false);
    for (const q of punkte) {
      const i = l.index.get(q.id)!;
      const v: Vec3 = [l.daten.pos[i * 3], l.daten.pos[i * 3 + 1], l.daten.pos[i * 3 + 2]];
      const dot = (m: Vec3) => v[0] * m[0] + v[1] * m[1] + v[2] * m[2];
      const eigen = dot(BEREICH_MITTE[q.bereich]);
      for (const [b, m] of Object.entries(BEREICH_MITTE)) if (b !== q.bereich) expect(eigen).toBeGreaterThan(dot(m));
    }
  });
  it('Aktualität: frischer = größer und heller; Künftiges zählt als frisch, ohne Datum leise; Farbe = Bereich', () => {
    expect(frische('2026-10-05', '2026-10-05')).toBe(1); expect(frische('2026-12-01', '2026-10-05')).toBe(1);
    expect(frische('2026-01-01', '2026-10-05')).toBeLessThan(0.2); expect(frische(null, '2026-10-05')).toBeLessThan(0.2);
    const l = brainLayout(punkte, '2026-10-05');
    const k = l.index.get('kontakt:k0')!, f = l.index.get('firma:f0')!;
    expect(l.daten.wert[k * 4]).toBeGreaterThan(l.daten.wert[f * 4]); expect(l.daten.wert[k * 4 + 1]).toBeGreaterThan(l.daten.wert[f * 4 + 1]);
    const g = alsRgb(KUGEL_BEREICH_FARBE.markttraktion);
    expect(Array.from(l.daten.farbe!.subarray(k * 3, k * 3 + 3)).map(x => Math.round(x * 255))).toEqual(g.map(x => Math.round(x * 255)));
  });
});
