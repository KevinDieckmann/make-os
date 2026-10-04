// ─── Wächter: Strahl ruhig (04.10.2026 abends, UMBAU_ABEND_0410.md › 6) ─────
// Kevin: „Gliedere einfach mehr. Die einzelnen Farben von den einzelnen Themen müssen immer gebündelt sein und zusammenlaufen.
// Es darf nur ausgeschlagen werden, wenn etwas Unvorhergesehenes kommt oder etwas schiefgelaufen ist.“ Der Test hält fest:
// ohne Abweichung ist jeder Strang glatt (Amplitude 0 bis auf die Strangbreite), Ausschlag nur aus echten Abweichungen (Stärke =
// Größe, deterministisch), Höchstwerte der Parameter, Spuren gegliedert und zusammenlaufend, keine additive Mischung, kein
// Glühen/Netz/Partikel im Zeichner, Privat-Regel der Abweichungen, Website unverändert.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STRAHL, spurAbstand, spurVersatz, strangMitte, strangBreite, zusammenlauf, wocheWeich, strahlHell, ausbruchRichtung, type StrahlBuehne } from '@/lib/lichtfaeden/strahl';
import {
  ABWEICHUNG, abweichungenAusStraengen, abweichungenSammeln, abweichungsStaerke, ausschlagJeWoche, abweichungFuerBetrachter, dealsVerschoben,
  type Abweichung, type AbweichungsQuelle,
} from '@/lib/lichtfaeden/abweichung';
import { baueBaum, rechneAnsicht, raster, FAEDEN, type Baum } from '@/lib/lichtfaeden/baum';
import { faedenband, BAND_MASSE, type BandBild } from '@/lib/lichtfaeden/faedenband';
import { versatz, fadenSaaten } from '@/lib/lichtfaeden/band';
import { BEIDE, GESAMT, type Knoten, type Strang } from '@/lib/lichtfaeden/modell';
import { QUELLEN as WEBSITE_QUELLEN } from '../scripts/lichtfaeden-website.mjs';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const HEUTE = '2026-10-04';
const B: StrahlBuehne = { breite: 1200, bandOben: 100, bandHoehe: STRAHL.band.rechner, heuteX: 500, heuteSeite: 'rechts', handy: false };

describe('Höchstwerte (damit es nicht wieder kippt)', () => {
  it('wenige, dünne, leise Fäden; kleines Band; begrenzter Ausschlag', () => {
    expect(STRAHL.faeden.max).toBeLessThanOrEqual(10);
    expect(STRAHL.faeden.deckel.rechner).toBeLessThanOrEqual(64);
    expect(STRAHL.faeden.deckel.handy).toBeLessThanOrEqual(40);
    expect(STRAHL.deckkraft).toBeLessThanOrEqual(0.2);
    expect(STRAHL.strich).toBeLessThanOrEqual(0.8);
    expect(STRAHL.kern.deckkraft).toBeLessThanOrEqual(0.06);
    expect(STRAHL.strang.max).toBeLessThanOrEqual(4);
    expect(STRAHL.ausschlag.rechner).toBeLessThanOrEqual(STRAHL.band.rechner * 0.2);
    expect(STRAHL.ausschlag.handy).toBeLessThanOrEqual(STRAHL.band.handy * 0.2);
    expect(STRAHL.band.rechner).toBeLessThanOrEqual(220);
    expect(STRAHL.band.handy).toBeLessThanOrEqual(160);
    expect(STRAHL.tempo).toBeLessThanOrEqual(0.6);
    expect(BAND_MASSE.rechner.band).toBe(STRAHL.band.rechner);
    expect(BAND_MASSE.handy.band).toBe(STRAHL.band.handy);
    // Der Baum nimmt dieselben Fäden-Grenzen (eine Stelle).
    expect(FAEDEN).toBe(STRAHL.faeden);
  });
});

describe('Spuren: gegliedert, glatt, zusammenlaufend', () => {
  it('ohne Abweichung ist jeder Strang glatt: links von HEUTE eine Gerade, danach nur der sanfte, monotone Zusammenlauf', () => {
    for (const n of [1, 2, 4, 7]) for (let i = 0; i < n; i++) {
      const ys = Array.from({ length: 241 }, (_, k) => strangMitte(i, n, k * 5, B, 0, strangBreite(5, 8, 0)));
      // bis HEUTE (x ≤ 500) konstant
      expect(new Set(ys.slice(0, 101).map(y => y.toFixed(6))).size).toBe(1);
      // danach monoton zur Mitte (kein Wellen)
      const mitte = B.bandOben + B.bandHoehe / 2;
      const ab = ys.slice(100).map(y => Math.abs(y - mitte));
      for (let k = 1; k < ab.length; k++) expect(ab[k]).toBeLessThanOrEqual(ab[k - 1] + 1e-9);
    }
  });
  it('Fäden bleiben innerhalb der Strangbreite (Amplitude 0 bis auf die minimale Fadenbreite), auch wenn sie fließen', () => {
    const w = strangBreite(STRAHL.faeden.max, STRAHL.faeden.max, 0);
    expect(w).toBeLessThanOrEqual(STRAHL.strang.max);
    for (const f of fadenSaaten(STRAHL.faeden.max, 7)) for (const s of [0, 200, 900]) for (const t of [0, 5000, 60000]) {
      expect(Math.abs(versatz(f, s, t) * w)).toBeLessThanOrEqual(1.3 * STRAHL.strang.max);
    }
  });
  it('Spuren übereinander in Rang-Reihenfolge, Abstand ≤ STRAHL.spur.abstand, alles + Ausschlag passt ins Band', () => {
    for (const handy of [false, true]) {
      const b = { ...B, handy, bandHoehe: handy ? STRAHL.band.handy : STRAHL.band.rechner };
      for (const n of [2, 5, 7, 12]) {
        const a = spurAbstand(n, b);
        expect(a).toBeLessThanOrEqual(handy ? STRAHL.spur.abstand.handy : STRAHL.spur.abstand.rechner);
        const ys = Array.from({ length: n }, (_, i) => spurVersatz(i, n, 0, b));
        for (let i = 1; i < n; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
        for (let i = 0; i < n; i++) {
          const y = strangMitte(i, n, 0, b, 1, strangBreite(8, 8, 1));
          expect(y).toBeGreaterThanOrEqual(b.bandOben); expect(y).toBeLessThanOrEqual(b.bandOben + b.bandHoehe);
        }
      }
    }
  });
  it('Zusammenlauf: volle Spuren bis HEUTE, am rechten Rand auf `zusammen`; Fenster ganz in der Vergangenheit = parallel', () => {
    expect(zusammenlauf(100, B)).toBe(1);
    expect(zusammenlauf(500, B)).toBe(1);
    expect(zusammenlauf(1200, B)).toBeCloseTo(STRAHL.zusammen);
    expect(zusammenlauf(1100, { ...B, heuteX: null, heuteSeite: 'rechts' })).toBe(1);
    expect(zusammenlauf(1200, { ...B, heuteX: null, heuteSeite: 'links' })).toBeCloseTo(STRAHL.zusammen);
  });
  it('Ausschlag: nach außen, Stärke = Größe der Abweichung, weich zwischen den Wochen (keine Zacke)', () => {
    expect(ausbruchRichtung(0, 4)).toBe(-1); expect(ausbruchRichtung(3, 4)).toBe(1); expect(ausbruchRichtung(1, 3)).toBe(-1);
    const ruhig = strangMitte(0, 4, 200, B, 0, 2);
    const halb = strangMitte(0, 4, 200, B, 0.5, 2), voll = strangMitte(0, 4, 200, B, 1, 2);
    expect(halb).toBeLessThan(ruhig); expect(voll).toBeLessThan(halb);
    expect(ruhig - halb).toBeCloseTo((ruhig - voll) / 2, 0);
    expect(strangBreite(4, 8, 1)).toBeCloseTo(strangBreite(4, 8, 0) * STRAHL.ausschlag.faecher);
    const d = { breite: 70, tage: 70, wochenVersatz: 0 };
    expect(wocheWeich([0, 1, 0], 10.5, d)).toBeCloseTo(1);
    expect(wocheWeich([0, 1, 0], 7, d)).toBeCloseTo(0.5);
    // flacher als linear nahe der Wochenmitte (sanftes Anklingen)
    expect(wocheWeich([0, 1], 4, d)).toBeLessThan(0.5 / 7 * 0.6 + 0.01);
  });
  it('Helligkeit ohne Lichtschnitt am HEUTE-Punkt: Vergangenheit gedämpft, nie über 1', () => {
    const h = (x: number) => strahlHell(x, B, 1);
    expect(h(100)).toBeLessThan(h(520));
    for (let x = 0; x <= 1200; x += 5) expect(h(x)).toBeLessThanOrEqual(1 + 1e-9);
    // kein Buckel um HEUTE: von 480 bis 560 monoton steigend bzw. gleich
    for (let x = 480; x < 560; x += 2) expect(h(x + 2)).toBeGreaterThanOrEqual(h(x) - 1e-9);
  });
});

// ── Abweichungen ─────────────────────────────────────────────────────────────
const BIZ = [GESAMT, 'space:business', 'thema:business:planung'];
const st = (id: string, quelle: Strang['quelle'], tag: string, x: Partial<Strang> = {}): Strang => ({
  id, quelle, titel: id, pfad: [...BIZ, 'ziel:z1'], person: BEIDE, zeit: { tag }, gewicht: 3, status: tag < HEUTE ? 'ueberfaellig' : 'offen', ...x,
});

describe('Abweichungen (rein)', () => {
  it('nur offene, vorbeigegangene Meilensteine/Ziel-Fristen/Fristen/Projekte/Rechnungen; Aufgaben, Termine, Follow-ups nie', () => {
    const l = abweichungenAusStraengen([
      st('ms:a', 'meilenstein', '2026-09-17'), st('ms:b', 'meilenstein', '2026-10-20'), st('ms:c', 'meilenstein', '2026-09-01', { status: 'erledigt' }),
      st('ziel:z1', 'ziel', '2026-09-30'), st('frist:u', 'frist', '2026-09-10'), st('aufgabe:x', 'aufgabe', '2026-09-01'),
      st('termin:x', 'termin', '2026-09-01'), st('followup:x', 'followup', '2026-09-01'), st('belegt:x', 'belegt', '2026-09-01'),
    ], HEUTE);
    expect(l.map(a => [a.strang, a.art])).toEqual([['ms:a', 'ueberfaellig'], ['ziel:z1', 'ziel-gekippt'], ['frist:u', 'frist-gerissen']]);
    expect(l[0]).toMatchObject({ von: '2026-09-17', bis: HEUTE, verlauf: 'anstieg' });
  });
  it('Stärke wächst mit der Dauer (weich gesättigt, halb nach `halbTage`), mal Gewicht; 0 Tage = 0', () => {
    expect(abweichungsStaerke(0)).toBe(0);
    expect(abweichungsStaerke(ABWEICHUNG.halbTage)).toBeCloseTo(0.5);
    expect(abweichungsStaerke(3)).toBeLessThan(abweichungsStaerke(30));
    expect(abweichungsStaerke(1000)).toBeLessThanOrEqual(1);
    expect(abweichungsStaerke(14, 0.5)).toBeCloseTo(0.25);
  });
  it('Ausschlag je Woche: 0 ohne Abweichung; steigt bis heute an, klingt danach aus; nie über 1; deterministisch', () => {
    const r = raster('2026-08-01', '2026-12-31');
    expect(ausschlagJeWoche([], r.wochen).every(v => v === 0)).toBe(true);
    const a = abweichungenAusStraengen([st('ms:a', 'meilenstein', '2026-09-17')], HEUTE);
    const w = ausschlagJeWoche(a, r.wochen);
    expect(w).toEqual(ausschlagJeWoche(a, r.wochen));
    const i0 = r.wochen.indexOf('2026-09-14'), ih = r.wochen.indexOf('2026-09-28');
    expect(w.slice(0, i0).every(v => v === 0)).toBe(true);
    for (let i = i0 + 1; i <= ih; i++) expect(w[i]).toBeGreaterThanOrEqual(w[i - 1]);
    expect(w[ih]).toBeCloseTo(a[0].staerke, 2);
    expect(w[ih + 3]).toBe(0);
    const viele = Array.from({ length: 30 }, (_, k) => ({ ...a[0], id: `x${k}`, staerke: 0.9 }));
    expect(Math.max(...ausschlagJeWoche(viele, r.wochen))).toBeLessThanOrEqual(1);
  });
  it('angedockte Quelle (Schnittstelle, z. B. Kapazität): gekapselt, ungültige fallen weg, Privat-Regel greift', () => {
    const k = { heute: HEUTE, von: '2026-01-01', bis: '2026-12-31', straenge: [] as Strang[] };
    const kapazitaet: AbweichungsQuelle = () => [
      { id: 'ueberlastet:kw42', art: 'ueberlastet', pfad: [GESAMT, 'space:business'], person: BEIDE, von: '2026-10-12', bis: '2026-10-18', staerke: 0.7, verlauf: 'gleich', titel: 'Woche überlastet' },
      { id: 'kaputt', art: 'ueberlastet', pfad: ['x'], person: BEIDE, von: 'gestern', staerke: 2, verlauf: 'gleich', titel: '' } as Abweichung,
      { id: 'privat:m', art: 'ueberlastet', pfad: [GESAMT, 'space:privat', 'thema:privat:gesundheit'], person: 'malin', von: '2026-10-12', staerke: 0.5, verlauf: 'gleich', titel: 'Arzttermine', privat: true },
    ];
    const wirft: AbweichungsQuelle = () => { throw new Error('kaputt'); };
    const l = abweichungenSammeln(k, 'kevin', [kapazitaet, wirft]);
    expect(l.map(a => a.id)).toEqual(['ueberlastet:kw42', expect.stringMatching(/^belegt:/)]);
    expect(l[1]).toMatchObject({ titel: 'Belegt', pfad: [GESAMT, 'space:privat'] });
    expect(l[1].strang).toBeUndefined();
    // die eigene Person sieht ihre private Abweichung im Klartext
    expect(abweichungFuerBetrachter(kapazitaet(k)[2], 'malin').titel).toBe('Arzttermine');
  });
  it('Deal-Entscheidung ≥ 2× verschoben = Abweichung `verschoben` am Strang des Deals; einmal verschoben = ruhig', () => {
    const dealStrang = st('deal:d1', 'deal', '2026-11-20', { pfad: [GESAMT, 'space:business', 'thema:business:markttraktion'] });
    const k = { heute: HEUTE, von: '2026-01-01', bis: '2026-12-31', straenge: [dealStrang] };
    const q = dealsVerschoben([
      { id: 'd1', titel: 'Retainer', erwartetAm: '2026-11-20', erwartetUrsprung: '2026-09-20', erwartetVerschoben: 2 },
      { id: 'd2', titel: 'Einmal', erwartetAm: '2026-11-20', erwartetUrsprung: '2026-10-20', erwartetVerschoben: 1 },
    ], 2);
    const l = q(k);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ art: 'verschoben', strang: 'deal:d1', von: '2026-09-20', bis: HEUTE, verlauf: 'anstieg' });
    expect(l[0].staerke).toBeGreaterThan(0); expect(l[0].staerke).toBeLessThanOrEqual(0.6);
  });
});

// ── Ansicht: Ausschlag nur am betroffenen Strang ─────────────────────────────
const zielK = (id: string, farbe: string, rang = 0): Knoten => ({ id: `ziel:${id}`, art: 'ziel', name: id, farbe, eltern: BIZ[2], rang });
function bau(mitAbweichung: boolean): Baum {
  const s: Strang[] = [
    st('ms:m1', 'meilenstein', mitAbweichung ? '2026-09-17' : '2026-11-04'),
    st('ms:m2', 'meilenstein', '2026-12-01'),
    { ...st('followup:f', 'followup', '2026-10-10'), pfad: [GESAMT, 'space:business', 'thema:business:markttraktion'], gewicht: 1 },
    { ...st('belegt:p', 'belegt', '2026-09-01'), pfad: [GESAMT, 'space:privat'], person: 'malin', privat: true, gewicht: 0.5 },
  ];
  return baueBaum([zielK('z1', '#C77DFF'), zielK('z2', '#FF7EB6', 1)], s);
}
const OPT = { von: '2026-01-01', bis: '2027-12-31', heute: HEUTE, person: { art: 'alle' as const } };

describe('Ansicht: ruhig im Plan, Ausschlag nur aus Abweichungen', () => {
  it('im Plan: jeder Strang ohne Ausschlag (überall 0), Text sagt „Alles im Plan“', () => {
    const a = rechneAnsicht(bau(false), { ...OPT, wurzel: 'space:business' })!.ansicht;
    expect(a.buendel.length).toBeGreaterThan(1);
    for (const b of a.buendel) expect(b.ausschlag.every(v => v === 0)).toBe(true);
    expect(a.abweichungen).toEqual([]);
  });
  it('überfälliger Meilenstein: nur SEIN Strang schlägt aus (Thema, Ziel, Meilenstein-Faden), alle anderen bleiben glatt', () => {
    const baum = bau(true);
    const biz = rechneAnsicht(baum, { ...OPT, wurzel: 'space:business' })!.ansicht;
    const planung = biz.buendel.find(b => b.id === 'thema:business:planung')!;
    expect(Math.max(...planung.ausschlag)).toBeGreaterThan(0);
    for (const b of biz.buendel.filter(x => x.id !== planung.id)) expect(b.ausschlag.every(v => v === 0)).toBe(true);
    expect(biz.abweichungen.map(x => x.text)).toEqual(['ms:m1 überfällig seit 17.09.']);
    const ziel = rechneAnsicht(baum, { ...OPT, wurzel: 'ziel:z1' })!.ansicht;
    expect(ziel.buendel.find(b => b.id === 'direkt:ziel:z1')!.ausschlag.some(v => v > 0)).toBe(true);
    // Gesamt: Business schlägt aus, Privat (nur „Belegt“) nie
    const ges = rechneAnsicht(baum, { ...OPT, wurzel: GESAMT })!.ansicht;
    expect(ges.buendel.find(b => b.id === 'space:privat')!.ausschlag.every(v => v === 0)).toBe(true);
  });
  it('Farben nur je Ziel: ein Thema trägt die Farbe seines ersten Ziels (Server-Farbe), ohne Ziel seine Themenfarbe', () => {
    const a = rechneAnsicht(bau(false), { ...OPT, wurzel: 'space:business' })!.ansicht;
    expect(a.buendel.find(b => b.id === 'thema:business:planung')!.farbe).toBe('#C77DFF');
    expect(a.buendel.find(b => b.id === 'thema:business:markttraktion')!.farbe).not.toBe('#C77DFF');
  });
  it('Personen-Sicht gilt auch für Abweichungen', () => {
    const baum = baueBaum([zielK('z1', '#C77DFF')], [st('ms:m1', 'meilenstein', '2026-09-17', { person: 'malin' })]);
    const k = rechneAnsicht(baum, { ...OPT, wurzel: 'space:business', person: { art: 'person', person: 'kevin' } });
    expect(k?.ansicht.abweichungen ?? []).toEqual([]);
  });
});

// ── Zeichner: ruhig ──────────────────────────────────────────────────────────
function attrappe() {
  const ops: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? (...a: unknown[]) => { ops.push(String(k)); void a; return { addColorStop: () => {} }; } : () => {}),
    set: (_, k, v) => { if (k === 'globalCompositeOperation' || k === 'filter') ops.push(`${String(k)}=${v}`); return true; },
  });
  class P { moveTo() {} lineTo() {} rect() { ops.push('rect'); } arc() {} }
  vi.stubGlobal('Path2D', P);
  return { canvas: { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement, ops };
}
describe('Zeichner ruhig', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('normal gemischt, ohne Partikel, ohne Glühen/Weichzeichner, ohne Lichtschein (kein Radialverlauf)', () => {
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { setTimeout(() => f(0), 0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const a = attrappe();
    const bild: BandBild = { breite: 900, hoehe: 300, bandOben: 60, bandHoehe: 200, wochenVersatz: 0, tage: 365, heuteX: 400, heuteFarbe: '#4FC3F7', verbinder: [], engstellen: [], engstelleFarbe: '#FFC93C', hervor: null, handy: false,
      buendel: [{ id: 'a', farbe: '#FF9F43', dichte: [0.5, 0.2], faeden: 6 }, { id: 'b', farbe: '#C77DFF', dichte: [0.1, 0.9], faeden: 4, ausschlag: [0, 0.8] }] };
    const z = faedenband(a.canvas, null as unknown as Element, true);
    z.setze(bild);
    return new Promise<void>(ok => setTimeout(() => {
      expect(a.ops).not.toContain('globalCompositeOperation=lighter');
      expect(a.ops).not.toContain('rect');
      expect(a.ops.some(o => o.startsWith('filter='))).toBe(false);
      expect(a.ops).not.toContain('createRadialGradient');
      z.stop(); ok();
    }, 5));
  });
  it('Quelltext: kein Netz, kein Glanz, keine Partikel, kein Puls am HEUTE-Punkt', () => {
    const band = lies('lib/lichtfaeden/faedenband.ts');
    for (const v of ['zeichneNetz', 'glanzPuffer', 'punkte:', "'lighter'", 'createRadialGradient']) expect(band).not.toContain(v);
    expect(lies('components/os/lichtfaeden/Faedenband.tsx')).not.toContain('zeit-puls');
  });
  it('Website bleibt unverändert: der Generator übersetzt weiter nur band.ts + zeichnen.ts (strahl.ts/abweichung.ts gehören der App)', () => {
    expect(WEBSITE_QUELLEN).toEqual(['lib/lichtfaeden/band.ts', 'lib/lichtfaeden/zeichnen.ts']);
  });
});
