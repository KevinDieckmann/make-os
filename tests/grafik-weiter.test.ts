// Wächter (16.10., Abnahme 2 · B7): „Jede Grafik führt weiter.“ Jeder Grafik-Baustein (lib/make-one/grafiken.ts) hat einen Klick-Weg
// (`data-grafik-weiter` + Navigation), die Verwender geben ihn mit, und „Für dich“ kennt für JEDEN Bereich ein Ziel je Periode.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { GRAFIK_BAUSTEINE, GRAFIK_VERWENDER } from '@/lib/make-one/grafiken';
import { FLUSS_BEREICHE, FLUSS_FENSTER, type FlussReihe } from '@/lib/fluss/modell';
import { flussPerioden, flussPeriodeLink, flussPeriodenAnzahl, periodeStart } from '@/lib/fluss/wege';

const wurzel = path.resolve(__dirname, '..');
const lies = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');

describe('Grafik-Bausteine führen weiter', () => {
  it('jeder Baustein der Liste trägt `data-grafik-weiter` und einen echten Weg (Link, router.push, onClick, geh, onSpalte)', () => {
    expect(GRAFIK_BAUSTEINE.length).toBeGreaterThanOrEqual(8);
    for (const b of GRAFIK_BAUSTEINE) {
      expect(existsSync(path.join(wurzel, b.datei)), b.datei).toBe(true);
      const q = lies(b.datei);
      expect(q, `${b.name}: data-grafik-weiter`).toContain('data-grafik-weiter');
      expect(q, `${b.name}: Navigation`).toMatch(/<Link\b|router\.push\(|geh\(|onClick=\{|onSpalte|href=/);
    }
  });
  it('die Verwender geben den Weg wirklich mit (Ring mit href, FadenLinie mit onSpalte)', () => {
    for (const v of GRAFIK_VERWENDER) expect(lies(v.datei), `${v.datei}: ${v.warum}`).toContain(v.muss);
  });
  it('Schmuck ist keine Grafik: das Netz-Motiv trägt `data-deko` und lässt Zeiger durch', () => {
    const q = lies('components/os/ui/fokus.tsx');
    expect(q).toMatch(/data-deko=""[^>]*className="ui-netz"/);
    expect(q).toContain("pointerEvents: 'none'");
  });
  it('Lichtfäden: ein Strang ohne tiefere Ebene öffnet sein Ziel, eine freie Stelle die Woche im Kalender', () => {
    const q = lies('components/os/lichtfaeden/Faedenband.tsx');
    expect(q).toContain('router.push(ziel.link)');
    expect(q).toContain('router.push(WEG.kalender(tag))');
  });
  it('Controlling: jeder Wochenbalken öffnet die Liquidität dieser Woche; die Liquidität liest `?w=`', () => {
    expect(lies('components/os/ControllingView.tsx')).toContain('WEG.liquiditaet(w.von)');
    expect(lies('components/os/LiquiditaetView.tsx')).toContain("useZiel('w')");
  });
});

describe('„Für dich“: jede Periode der Linie hat ein Ziel', () => {
  const reihe = (bereich: FlussReihe['bereich'], raster: 'woche' | 'monat'): FlussReihe => ({
    bereich, titel: 't', einheit: 'anzahl', raster, heute: '2026-10-15', ist: new Array(FLUSS_FENSTER[raster]).fill(1), istLabel: 'erledigt',
    prognose: new Array(FLUSS_FENSTER[raster]).fill(2), prognoseGrundlage: 'aus Fälligkeiten', prognoseLabel: 'fällig', zeilen: [],
  });
  it('für JEDEN Bereich und beide Arten ein Weg in die App (über WEG)', () => {
    for (const b of FLUSS_BEREICHE) for (const art of ['ist', 'prognose'] as const) {
      const l = flussPeriodeLink(b, { art, start: '2026-10-12', raster: 'woche', space: 'business' });
      expect(l, `${b}/${art}`).toMatch(/^\/os(\/|\?|$)/);
    }
  });
  it('die Woche führt genau in diese Woche (Kalender, Aufgaben-Modus, Planen), der Monat in seine Buchungen', () => {
    expect(flussPeriodeLink('kalender', { art: 'ist', start: '2026-10-05', raster: 'woche' })).toBe('/os/kalender?tag=2026-10-05');
    expect(flussPeriodeLink('aufgaben', { art: 'prognose', start: '2026-10-19', raster: 'woche', space: 'privat' })).toBe('/os/kalender?modus=aufgaben&tag=2026-10-19&space=privat');
    expect(flussPeriodeLink('planung', { art: 'prognose', start: '2026-10-19', raster: 'woche' })).toBe('/os/kalender?modus=planen&tag=2026-10-19');
    expect(flussPeriodeLink('finanzen-privat', { art: 'ist', start: '2026-08-01', raster: 'monat' })).toContain('monat=2026-08');
  });
  it('Perioden: laufende einmal, Ist links bis HEUTE (Mitte), Prognose rechts — aufsteigend, Woche ab Montag', () => {
    const p = flussPerioden(reihe('kalender', 'woche'));
    expect(p).toHaveLength(flussPeriodenAnzahl('woche'));
    expect(p.map(x => x.x)).toEqual([...p.map(x => x.x)].sort((a, b) => a - b));
    expect(p[0].x).toBe(0); expect(p.at(-1)!.x).toBe(1);
    const jetzt = p.find(x => x.x === 0.5)!;
    expect(jetzt.art).toBe('ist'); expect(jetzt.start).toBe('2026-10-12'); expect(periodeStart('2026-10-15', 'woche', 0)).toBe('2026-10-12');
    expect(periodeStart('2026-10-15', 'monat', -2)).toBe('2026-08-01');
    expect(p.filter(x => x.start === '2026-10-12')).toHaveLength(1);
  });
  it('die Linie rendert die Spalten (Links) und HEUTE als Tastatur-Weg', () => {
    const q = lies('components/os/ui/fluss.tsx');
    expect(q).toContain('<FlussSpalten f={f} space={space} />');
    expect(q).toContain("flussPeriodeLink(f.bereich, { art: 'ist', start: jetzt");
  });
});
