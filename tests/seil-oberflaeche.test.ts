// ─── Seil (07.10.) — Oberfläche: Beschriftungs-Spalte (Gantt), Bühne serverseitig gezeichnet, Zeichner bei „Bewegung reduzieren“ ─
// Kein Browser: SeilBand wird serverseitig gezeichnet (fängt Laufzeitfehler, prüft Spalte/Knöpfe/Rollen); der Zeichner läuft gegen
// eine Attrappe der Leinwand (Standbild ohne Aufbau, Führungslinien). Erfundene Ziele und Stränge.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { seilRechnen, type SeilEingang } from '@/lib/lichtfaeden/seil';
import { SEIL_FORM, seilLage, seilSpalte } from '@/lib/lichtfaeden/seil-geometrie';
import { seilband } from '@/lib/lichtfaeden/seilband';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/planung/jahr' }));
const h = (c: unknown, props: unknown) => createElement(c as never, props as never);

const HEUTE = '2026-10-07';
const EINGANG: SeilEingang = {
  heute: HEUTE, von: '2026-09-01', bis: '2027-08-31',
  ziele: [
    { id: 'umsatz', titel: 'Umsatz verdoppeln', farbe: '#E0A84E', rang: 1, space: 'business', anker: '2027-06-30', ankerArt: 'frist', link: '/os/planung/ziel/umsatz' },
    { id: 'q1', titel: 'Q1: zehn Kunden', farbe: '#E0A84E', rang: 5, space: 'business', anker: '2027-03-31', elternId: 'umsatz', fortschritt: 30 },
  ],
  straenge: [
    { id: 'ms:vertrag', art: 'meilenstein', titel: 'Vertrag', zielId: 'umsatz', ende: '2026-11-15', erledigt: true, erledigtAm: '2026-10-02', fortschritt: 1, link: '/os/planung/meilenstein/vertrag' },
    { id: 'ms:website', art: 'meilenstein', titel: 'Website', zielId: 'umsatz', ende: '2027-02-01', fortschritt: 0.5, wartetAuf: ['ms:vertrag'], link: '/os/planung/meilenstein/website' },
    { id: 'ms:launch', art: 'meilenstein', titel: 'Launch', zielId: 'umsatz', ende: '2027-05-01', fortschritt: 0, wartetAuf: ['ms:website'] },
    { id: 'ms:q1-a', art: 'meilenstein', titel: 'Akquise-Welle', zielId: 'q1', ende: '2027-01-20', fortschritt: 0 },
    { id: 'projekt:frei', art: 'projekt', titel: 'Ohne Ziel', zielId: null, start: '2026-10-01', ende: '2026-11-30' },
  ],
  karten: [],
  marken: [],
};
const A = seilRechnen(EINGANG);

describe('Beschriftungs-Spalte — eine Regel (seilSpalte)', () => {
  it('breit, mittel, schmal; die Zeit-Fläche behält ihr Minimum; Maße stehen in SEIL_FORM', () => {
    const F = SEIL_FORM.spalte;
    expect(seilSpalte(1200)).toEqual({ spalte: F.breit, zeit: 1200 - F.breit });
    expect(seilSpalte(F.ab.breit - 1).spalte).toBe(F.mittel);
    expect(seilSpalte(F.ab.mittel - 1).spalte).toBe(F.schmal);
    expect(seilSpalte(100).zeit).toBe(F.zeitMin);
    expect(F.breit).toBeGreaterThan(F.mittel); expect(F.mittel).toBeGreaterThan(F.schmal);
    // Die Zeile passt in eine Spur, der Einzug lässt Platz für den Titel.
    expect(F.schmal - F.einzug - F.luft).toBeGreaterThanOrEqual(100);
  });
});

describe('SeilBand (Server)', () => {
  it('links je Spur eine Zeile (Marke, Titel, Fortschritt) mit Link zum Strang; Leinwand aria-hidden; Spalten-Kopf', async () => {
    const { SeilBand } = await import('@/components/os/seil/SeilBand');
    const html = renderToStaticMarkup(h(SeilBand, { ansicht: A, heute: HEUTE, fokus: null, onFokus: () => {}, label: 'Seil Jahr' }));
    expect(html).toContain('role="group" aria-label="Seil Jahr"');
    expect(html).toContain('<canvas aria-hidden="true" data-seil=""');
    expect(html).toContain('>STRÄNGE<');
    // Jede Spur hat genau eine Zeile in der Spalte — auch Stränge ohne Link und „Ohne Ziel“.
    for (const id of Object.keys(A.straenge)) expect(html).toContain(`data-seil-zeile="${id}"`);
    expect(html.match(/data-seil-zeile=/g)).toHaveLength(Object.keys(A.straenge).length);
    // Link zum Meilenstein mit vollem Namen (Art, Titel, Fortschritt, Grund) für Vorleser.
    expect(html).toMatch(/<a[^>]+data-seil-zeile="ms:website"[^>]+href="\/os\/planung\/meilenstein\/website"/);
    expect(html).toMatch(/aria-label="Meilenstein „Website“ · 50 %[^"]*"/);
    // Unterziel-Faser: „über …“ im Namen.
    expect(html).toContain('(über „Q1: zehn Kunden“)');
    // Standardbreite 900 px → mittlere Spalte mit Prozent-Zahl.
    expect(html).toContain('>50 %<');
    // Die Zeile sitzt in der Spalte (links), nicht auf der Zeit-Fläche.
    const { spalte } = seilSpalte(900);
    expect(html).toContain(`left:${SEIL_FORM.spalte.einzug}px;top:`);
    expect(html).toContain(`width:${spalte - SEIL_FORM.spalte.einzug - SEIL_FORM.spalte.luft}px;height:${SEIL_FORM.spur}px`);
    // Fokus-Knopf je Seil.
    expect(html).toContain('aria-pressed="false"');
  });
  it('keine Farb-Literale für Rand/Flächen — Token aus lib/make-one/design', () => {
    const t = readFileSync(path.resolve(__dirname, '..', 'components/os/seil/SeilBand.tsx'), 'utf8');
    expect(t).not.toMatch(/rgba\(255,\s*255,\s*255/);
    expect(t).not.toMatch(/['"`]#[0-9A-Fa-f]{3,8}['"`]/);
    expect(t).not.toMatch(/randFuer|beschriftungBei/); // eine Regel: seilSpalte
  });
});

// ── Zeichner gegen eine Attrappe ─────────────────────────────────────────────
function attrappe() {
  let striche = 0;
  const linien: number[][] = [];
  let strich: number[] = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'stroke' ? () => { striche++; if (strich.length) linien.push(strich); strich = []; }
      : k === 'moveTo' ? (x: number, y: number) => { strich = [x, y]; }
      : k === 'lineTo' ? (x: number, y: number) => { strich.push(x, y); }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: () => {} }) : () => {}),
    set: () => true,
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, striche: () => striche, linien };
}
function uhr() {
  const warte: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} bezierCurveTo() {} rect() {} arc() {} closePath() {} });
  return (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); };
}

describe('Zeichner (seilband)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('Bewegung reduziert: Standbild ohne Aufbau, nichts bewegt sich, kein zweites Bild; Führungslinie ab x = 0', () => {
    const tick = uhr();
    const a = attrappe();
    const lage = seilLage(A, 700);
    const z = seilband(a.canvas, null as unknown as Element, true);
    z.setze({ ansicht: A, lage, heuteX: lage.x(HEUTE), fokus: null, hervor: null, raster: [], farben: { heute: '#4FC3F7', achtung: '#FFC93C', leise: '#86918F', kritisch: '#FF5C5C', grund: '#161B1F' }, handy: false });
    tick(1000);
    const nachEins = a.striche();
    expect(nachEins).toBeGreaterThan(0);
    expect(z.aufbau()).toBeNull();
    expect(z.bewegt()).toBe(false);
    tick(2000); tick(3000);
    expect(a.striche()).toBe(nachEins);
    expect(z.lauf.messung().bilder).toBe(1);
    // Ein Strang, der erst später beginnt, bekommt eine Führungslinie vom linken Rand (Spalte) bis kurz vor seinen Anfang.
    const sp = lage.gruppen.flatMap(g => g.spuren).find(s => s.x0 > 40)!;
    expect(sp).toBeDefined();
    expect(a.linien.some(l => l[0] === 0 && l[1] === sp.y && l[2] === sp.x0 - 3 && l[3] === sp.y)).toBe(true);
    z.stop();
  });
});
