// ─── Markenzeichen: der Flow (17.10.) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Kevin 17.10.: „Denke dir auch immer den Flow, diese Linie, mit — das ist unser Markenzeichen.“ — „Nach und nach kommt alles in den Flow.“ Der Test hält
// fest: EIN Zeichner (lib/lichtfaeden/flow.ts) für FadenLinie, Reise, Fluss und Fläche; reduzierte Bewegung = kein Takt; ein gemeinsamer Takt für alle Ebenen;
// die Fadenlage (hell bis „Hier“, Stau an offenen Rauten) kommt aus denselben Spalten wie „Hier“ (`fallStelle`); keine Animation in Druck und Kunden-Ansicht;
// nie ein Faden ohne Weg. Dazu die kleinen Punkte (Fläche als Vorgabe, „Versuche“, Hinweis für alte Fälle) und der Index-Status ohne Widerspruch.
// Erfundene Daten, kein Netz.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));

import { FLOW, flowProben, flowEbene, taktLauf, taktStand, weglaenge, zeichneFaden, type FlowFaden } from '@/lib/lichtfaeden/flow';
import { fadenSaaten } from '@/lib/lichtfaeden/band';
import { reiseFlow, reiseFaden, pfeilZustand, pfeilFaden, flaecheFaden, stufeBegonnen, type ReiseLagen } from '@/lib/reise/flow';
import type { BildSpalte, FlussBild, FlussKnotenBild } from '@/lib/reise/bild';
import { reiseZeile, type ReiseBildEingabe } from '@/lib/fulfillment/prozesse/reise-bild';
import { fallStelle } from '@/lib/fulfillment/prozesse/reise';
import { ausfuehrungNachUebernahme } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { editorModell } from '@/lib/fulfillment/prozesse/editor';
import { indexStatus, berechneModell } from '@/lib/kennzahlen/kern';
import { bildSpalten } from '@/components/os/fulfillment/reise/FallReise';
import { ReiseBild } from '@/components/os/ui/reise/ReiseBild';
import { Fluss } from '@/components/os/ui/reise/Fluss';
import { FlaechePfeil } from '@/components/os/ui/reise/flaeche-formen';
import { FLOW_TON } from '@/components/os/ui/reise/formen';
import { FlowLinie, flowFaedenAus } from '@/components/os/ui/flow';
import { editorAnsichtVorgabe } from '@/components/os/fulfillment/editor/ProzessEditor';
import { AusfuehrungWartet } from '@/components/os/fulfillment/prozesse/FallUeberblick';
import type { FallAntwort } from '@/components/os/fulfillment/prozesse/daten';
import type { Fall, FallKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const e of readdirSync(path.join(wurzel, ordner))) {
    const p = `${ordner}/${e}`;
    if (statSync(path.join(wurzel, p)).isDirectory()) raus.push(...dateien(p));
    else if (/\.(tsx?|mts)$/.test(e)) raus.push(p);
  }
  return raus;
}
const ALLE = [...dateien('components'), ...dateien('lib'), ...dateien('app')];

function attrappe() {
  let striche = 0, punkte = 0;
  class P { moveTo() {} lineTo() {} rect() {} arc() {} }
  vi.stubGlobal('Path2D', P);
  const ctx = new Proxy({}, { get: (_, k) => (k === 'stroke' ? () => { striche++; } : k === 'fill' ? () => { punkte++; } : () => {}), set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx: ctx as CanvasRenderingContext2D, striche: () => striche, punkte: () => punkte };
}
/** Eine falsche Uhr: zählt, wie viele requestAnimationFrame-Aufrufe je Bild warten (der gemeinsame Takt = einer). */
function uhr() {
  const warte: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return { tick: (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); return f.length; }, wartend: () => warte.length };
}
const gerade = (id: string, x1 = 300): FlowFaden => ({ id, punkte: [[0, 10], [x1, 10]], farbe: '#58D9CD', staerke: 'mittel' });

describe('EIN Zeichner für jeden Faden', () => {
  it('flowProben, zeichneFaden, zeichneFlow, taktLauf, flowEbene, FlowLinie liegen genau einmal', () => {
    for (const [name, ort] of [['flowProben', 'lib/lichtfaeden/flow.ts'], ['zeichneFaden', 'lib/lichtfaeden/flow.ts'], ['zeichneFlow', 'lib/lichtfaeden/flow.ts'], ['taktLauf', 'lib/lichtfaeden/flow.ts'], ['flowEbene', 'lib/lichtfaeden/flow.ts'], ['FlowLinie', 'components/os/ui/flow.tsx'], ['reiseFaden', 'lib/reise/flow.ts'], ['pfeilFaden', 'lib/reise/flow.ts'], ['flussFaeden', 'components/os/ui/reise/faden.tsx']] as const) {
      const orte = ALLE.filter(p => new RegExp(`export function ${name}\\b`).test(lies(p)));
      expect(orte, name).toEqual([ort]);
    }
    // Bündel zeichnen nur die Lichtfäden-Zeichner selbst — FadenLinie, Reise, Fluss und Fläche gehen über flow.ts.
    expect(ALLE.filter(p => /zeichneBuendel\(/.test(lies(p))).sort()).toEqual(['lib/lichtfaeden/faedenband.ts', 'lib/lichtfaeden/flow.ts', 'lib/lichtfaeden/zeichnen.ts']);
  });
  it('FadenLinie (Index-Verläufe), Reise, Fluss, Editor-Fluss und Fläche nutzen ihn — eine Quelle für das Aussehen und den Takt', () => {
    const fl = lies('lib/lichtfaeden/fadenlinie.ts');
    expect(fl).toContain('zeichneFaden(ctx, proben');
    expect(fl).toContain('taktLauf({');
    expect(fl).not.toMatch(/starteLauf\(|zeichneBuendel\(/);
    expect(lies('components/os/ui/reise/ReiseBild.tsx')).toContain("import { FlowLinie } from '../flow'");
    expect(lies('components/os/ui/reise/faden.tsx')).toContain("import { FlowLinie } from '../flow'");
    expect(lies('components/os/ui/reise/Fluss.tsx')).toContain("import { FlussFaden } from './faden'");
    expect(lies('components/os/fulfillment/editor/EditorFluss.tsx')).toContain("import { FlussFaden } from '../../ui/reise/faden'");
    expect(lies('components/os/fulfillment/editor/Flaeche.tsx')).toContain("import { flowEbene, bewegungReduziert, type FlowEbene } from '@/lib/lichtfaeden/flow'");
    expect(lies('components/os/ui/flow.tsx')).toContain('flowEbene(c, eltern ?? c,');
    // Die FadenLinie zeichnet mit denselben Werten wie jeder Faden (Kern breit = Rechner, mittel = Handy).
    expect(FLOW.kern.strich.breit).toBe(5); expect(FLOW.kern.strich.mittel).toBe(4);
    expect(FLOW.punkte).toMatchObject({ abstand: 8, groesse: 1, hell: 2.2, jeder: 2 });
  });
});

describe('Proben (rein)', () => {
  it('deterministisch; Normalen Einheitslänge; ein Schritt je FLOW.schritt px; auch um Ecken weich', () => {
    const f: FlowFaden = { id: 'l', punkte: [[0, 0], [100, 0], [100, 80]], farbe: '#58D9CD' };
    const a = flowProben(f);
    expect(a).toEqual(flowProben(f));
    expect(a.laenge).toBe(180);
    expect(a.proben.length).toBe(Math.ceil(180 / FLOW.schritt) + 1);
    for (const p of a.proben) expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(1);
    // An der Ecke liegt die Normale zwischen beiden Richtungen (nie ein Sprung um 90°).
    const ecke = a.proben.find(p => p.s === 100)!;
    expect(Math.abs(ecke.nx)).toBeGreaterThan(0.3); expect(Math.abs(ecke.ny)).toBeGreaterThan(0.3);
    expect(flowProben({ ...f, punkte: [[0, 0]] }).proben).toEqual([]);
    expect(flowProben({ ...f, punkte: [[0, 0], [0, 0]] }).proben).toEqual([]);
    expect(weglaenge([[0, 0], [3, 4]])).toBe(5);
  });
  it('hell bis „Hier“, dahinter gedämpft; ausgefranst nur mit `frans` und nur hinter „Hier“; bisHier 0 = ganz gedämpft', () => {
    const p = flowProben({ ...gerade('h'), bisHier: 0.5, frans: true }).proben;
    expect(p.filter(x => x.s < 140).every(x => x.hell === 1 && !x.frans)).toBe(true);
    expect(p.at(-1)!.hell).toBeCloseTo(FLOW.gedaempft);
    expect(p.at(-1)!.frans).toBeGreaterThan(0.5);
    expect(flowProben({ ...gerade('h'), bisHier: 0.5 }).proben.every(x => !x.frans)).toBe(true);
    expect(flowProben({ ...gerade('h'), bisHier: 0 }).proben.every(x => x.hell === FLOW.gedaempft)).toBe(true);
    expect(flowProben(gerade('h')).proben.every(x => x.hell === 1)).toBe(true);
  });
  it('Stau vor einer offenen Stelle: das Bündel weitet sich und leuchtet, dahinter ein Hals; Durchgang leuchtet nur kurz auf', () => {
    const p = flowProben({ ...gerade('s'), bisHier: 0.2, stellen: [{ bei: 0.6, art: 'stau' }] }).proben;
    const vor = p.reduce((a, x) => (Math.abs(x.s - 179) < Math.abs(a.s - 179) ? x : a));
    const weit = p.find(x => x.s > 60 && x.s < 100)!;
    const hals = p.find(x => x.s > 182 && x.s < 190)!;
    expect(vor.spreizung).toBeGreaterThan(weit.spreizung * 1.8);
    expect(vor.hell).toBeGreaterThan(1);
    expect(hals.spreizung).toBeLessThan(weit.spreizung);
    const d = flowProben({ ...gerade('d'), stellen: [{ bei: 0.5, art: 'durch' }] }).proben;
    expect(Math.max(...d.map(x => x.hell))).toBeGreaterThan(1.25); expect(Math.max(...d.map(x => x.hell))).toBeLessThanOrEqual(FLOW.durch.hell);
    expect(d.filter(x => Math.abs(x.s - 150) > FLOW.durch.laenge).every(x => x.hell === 1)).toBe(true);
  });
  it('Farbabschnitte laufen nahtlos (gleicher Punkt am Übergang)', () => {
    const fp = flowProben({ ...gerade('f'), farben: [{ von: 0.4, bis: 0.6, farbe: '#FF5C5C' }] });
    expect(fp.laeufe.map(l => l.farbe)).toEqual(['#58D9CD', '#FF5C5C', '#58D9CD']);
    for (let i = 1; i < fp.laeufe.length; i++) expect(fp.laeufe[i].von).toBe(fp.laeufe[i - 1].bis);
    expect(fp.laeufe.at(-1)!.bis).toBe(fp.proben.length - 1);
  });
  it('zeichneFaden: Kern + Fäden + Partikel additiv; ohne Proben nichts', () => {
    const a = attrappe();
    const n = zeichneFaden(a.ctx, flowProben(gerade('z')).proben, { farbe: '#58D9CD', saaten: fadenSaaten(6, 1) }, 0);
    expect(n).toBeGreaterThan(1);
    expect(a.striche()).toBeGreaterThan(1);
    expect(zeichneFaden(a.ctx, [], { farbe: '#58D9CD', saaten: fadenSaaten(6, 1) }, 0)).toBe(0);
  });
});

describe('Takt — ein gemeinsamer requestAnimationFrame, reduzierte Bewegung = kein Takt', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('reduzierte Bewegung: kein Gast im Takt, genau ein Standbild, danach nur auf Zuruf', () => {
    const u = uhr();
    let bilder = 0;
    const l = taktLauf({ beobachte: null, zeichne: () => { bilder++; }, ruhig: true });
    expect(taktStand()).toEqual({ gaeste: 0, laeuft: false });
    u.tick(0); u.tick(100); u.tick(200);
    expect(bilder).toBe(1);
    l.einmal(); u.tick(300);
    expect(bilder).toBe(2);
    l.stop();
  });
  it('zwei Ebenen teilen EINEN Takt (ein Aufruf je Bild), ~30 Bilder je Sekunde, nach dem letzten stop() steht er', () => {
    const u = uhr();
    let a = 0, b = 0;
    const la = taktLauf({ beobachte: null, zeichne: () => { a++; }, ruhig: false });
    const lb = taktLauf({ beobachte: null, zeichne: () => { b++; }, ruhig: false });
    expect(taktStand()).toEqual({ gaeste: 2, laeuft: true });
    let max = 0;
    for (let t = 0; t <= 1000; t += 16) max = Math.max(max, u.tick(t));
    expect(max).toBe(1); // nie zwei Schleifen
    expect(a).toBeGreaterThan(20); expect(a).toBeLessThanOrEqual(32);
    expect(b).toBe(a);
    la.stop();
    expect(taktStand().gaeste).toBe(1);
    lb.stop();
    expect(taktStand()).toEqual({ gaeste: 0, laeuft: false });
    u.tick(1100); u.tick(1200);
    expect(a + b).toBeLessThanOrEqual(64);
  });
  it('Faden-Ebene: ruhig = ein Bild je Änderung (auch mit Kamera); bewegt = im Takt; Aufbau nur mit `aufbau`', () => {
    let u = uhr();
    const r = flowEbene(attrappe().canvas, null, { ruhig: true });
    r.setze([gerade('a'), { ...gerade('b'), aufbau: true }], { breite: 320, hoehe: 40 });
    u.tick(0); u.tick(50); u.tick(100);
    expect(r.lauf.messung().bilder).toBe(1);
    expect(r.aufbau()).toBeNull();
    r.kamera({ s: 2, x: 5, y: 5 }); u.tick(150);
    expect(r.lauf.messung().bilder).toBe(2);
    r.kamera({ s: 2, x: 5, y: 5 }); u.tick(200); // gleiche Kamera: nichts neu
    expect(r.lauf.messung().bilder).toBe(2);
    r.stop();
    u = uhr();
    const z = flowEbene(attrappe().canvas, null, { ruhig: false });
    z.setze([{ ...gerade('a'), aufbau: true }], { breite: 320, hoehe: 40 });
    u.tick(1000);
    expect(z.aufbau()).toBe(0);
    u.tick(1000 + FLOW.aufbau / 2);
    expect(z.aufbau()).toBeGreaterThan(0.3);
    u.tick(1000 + FLOW.aufbau + 40);
    expect(z.aufbau()).toBeNull();
    z.stop();
    expect(taktStand().gaeste).toBe(0);
  });
  it('Leistung: 300 Pfeile der Fläche mit Kamera — Stützpunkte und ein Bild bleiben schnell; außerhalb des Bildes wird nichts gerechnet', () => {
    const u = uhr();
    const a = attrappe();
    const e = flowEbene(a.canvas, null, { ruhig: true });
    const faeden: FlowFaden[] = Array.from({ length: 300 }, (_, i) => flaecheFaden({ id: `p${i}`, art: i % 7 === 0 ? 'nein' : 'weiter', punkte: [[(i % 20) * 220, Math.floor(i / 20) * 160], [(i % 20) * 220, Math.floor(i / 20) * 160 + 60], [(i % 20) * 220 + 120, Math.floor(i / 20) * 160 + 60]] }, FLOW_TON));
    e.setze(faeden, { breite: 1200, hoehe: 800 });
    e.kamera({ s: 0.25, x: 20, y: 20 });
    const t0 = performance.now();
    u.tick(0);
    expect(performance.now() - t0).toBeLessThan(400);
    const alle = a.striche();
    expect(alle).toBeGreaterThan(0);
    // Hineingezoomt: nur, was im Bild liegt, wird gezeichnet.
    e.kamera({ s: 2, x: 0, y: 0 });
    u.tick(50);
    expect(a.striche() - alle).toBeLessThan(alle);
    e.stop();
  });
});

// ── Reise: der Stand aus denselben Spalten wie „Hier“ ─────────────────────────────────────────────────────────────────────────────────────

const HEUTE = '2026-10-17';
const J = '2026-10-17T09:00:00.000Z';
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const FREIGABEN = [{ id: 'F0', titel: 'Mandatsrahmen', wer: 'beide' as const }, { id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide' as const }];
function fall(x: Partial<Fall> = {}): Fall {
  const knoten: FallKnoten[] = [
    k('w', undefined, 'Paket', 1),
    k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0', kundeSichtbar: true }), k('p1-a', 'p1', 'Kick-off', 1, { status: 'erledigt' }),
    k('p2', 'w', 'Analyse', 2, { kundeSichtbar: true }), k('p2-a', 'p2', 'Interviews führen', 1, { status: 'erledigt' }), k('p2-b', 'p2', 'Leitfaden schreiben', 2),
    k('p3', 'w', 'Diagnose', 3, { freigabe: 'F3' }), k('p3-a', 'p3', 'Diagnosebericht', 1),
    k('p4', 'w', 'Übergabe', 4), k('p4-a', 'p4', 'Übergabe-Gespräch', 1),
  ];
  return {
    mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', knoten,
    freigaben: { F0: { am: HEUTE, von: 'pia' } }, onboarding: { willkommenGesendetAm: J }, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [],
    quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia', ...x,
  } as Fall;
}
const eingabe = (f: Fall): ReiseBildEingabe => ({ fall: f, freigaben: FREIGABEN, heute: HEUTE, nachsorge: { ende: null, plan: [] } });
/** Lagen wie am Rechner gemessen: je Stufe 200 px, dazwischen 22 px Rauten-Spalte. */
const lagenFuer = (n: number, mitGrenze: readonly boolean[] = []): ReiseLagen => ({
  stufen: Array.from({ length: n }, (_, i) => ({ von: i * 222, bis: i * 222 + 200 })),
  grenzen: Array.from({ length: n }, (_, i) => (i < n - 1 || mitGrenze[i] ? i * 222 + 211 : null)), quer: 14, achse: 'quer',
});

describe('Reise: hell bis „Hier“ — aus denselben Daten wie der Fall-Kopf (fallStelle)', () => {
  it('„Hier“ des Fadens = die Phase aus fallStelle; bisHier = Mitte dieser Phase; gegebene Rauten davor fließen hindurch, offene dahinter stauen', () => {
    const f = fall();
    const st = fallStelle(f, FREIGABEN, HEUTE);
    const spalten = bildSpalten(reiseZeile(eingabe(f)));
    const flow = reiseFlow(spalten);
    const i = spalten.findIndex(s => s.id === st.phase!.id);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(flow.hier).toEqual({ art: 'mitte', i });
    const faden = reiseFaden(flow, lagenFuer(spalten.length), FLOW_TON)!;
    const L = (spalten.length - 1) * 222 + 200;
    expect(faden.bisHier).toBeCloseTo((i * 222 + 100) / L, 5);
    expect(faden.hier).toBe(true); expect(faden.frans).toBe(true); expect(faden.aufbau).toBe(true);
    // Raute hinter Phase 1 (F0 vermerkt) liegt vor „Hier“ → Durchgang; die offene hinter der Diagnose (F3) → Stau.
    const r1 = faden.stellen!.find(s => Math.abs(s.bei - 211 / L) < 1e-9)!;
    const r3 = faden.stellen!.find(s => Math.abs(s.bei - (2 * 222 + 211) / L) < 1e-9)!;
    expect(r1.art).toBe('durch');
    expect(r3.art).toBe('stau');
  });
  it('alles fertig = bis zum Ende ohne Leuchtpunkt; nichts begonnen = gedämpft vom Anfang; Abstimmungspunkt dran = „Hier“ an der Raute', () => {
    const s = (zustand: BildSpalte['zustand'], x: Partial<BildSpalte> = {}): BildSpalte => ({ id: `s${Math.random()}`, nr: 1, titel: 'S', zustand, kaestchen: [], mehr: 0, ...x });
    const fertig = reiseFlow([s('fertig'), s('fertig')]);
    expect(fertig.hier).toEqual({ art: 'ende' });
    const ff = reiseFaden(fertig, lagenFuer(2), FLOW_TON)!;
    expect(ff.bisHier).toBe(1); expect(ff.hier).toBe(false); expect(ff.frans).toBe(false);
    const nichts = reiseFaden(reiseFlow([s('offen'), s('offen')]), lagenFuer(2), FLOW_TON)!;
    expect(nichts.bisHier).toBe(0); expect(nichts.hier).toBe(false);
    const raute = reiseFlow([s('fertig'), s('jetzt', { raute: { titel: 'A2', gegeben: false, hier: true } }), s('offen')]);
    expect(raute.hier).toEqual({ art: 'grenze', i: 1 });
    const fr = reiseFaden(raute, lagenFuer(3), FLOW_TON)!;
    expect(fr.stellen).toEqual([{ bei: fr.bisHier, art: 'stau' }]);
  });
  it('rot bzw. gelb nur, wo etwas hängt; der Kreislauf (läuft) hat kein „Hier“ und jede Stufe in ihrer Farbe', () => {
    const s = (zustand: BildSpalte['zustand'], x: Partial<BildSpalte> = {}): BildSpalte => ({ id: 'x', nr: 1, titel: 'S', zustand, kaestchen: [], mehr: 0, ...x });
    const f = reiseFaden(reiseFlow([s('fertig'), s('jetzt', { haengt: 'rot' }), s('offen')]), lagenFuer(3), FLOW_TON)!;
    expect(f.farben).toEqual([{ von: expect.any(Number), bis: expect.any(Number), farbe: FLOW_TON.rot }]);
    expect(reiseFaden(reiseFlow([s('fertig'), s('jetzt'), s('offen')]), lagenFuer(3), FLOW_TON)!.farben).toBeUndefined();
    const kreis = reiseFlow([s('laeuft', { farbe: '#4FC3F7' }), s('laeuft', { farbe: '#FF9F43' })]);
    expect(kreis.hier).toBeNull();
    const kf = reiseFaden(kreis, lagenFuer(2), FLOW_TON, { farben: ['#4FC3F7', '#FF9F43'] })!;
    expect(kf.bisHier).toBe(1); expect(kf.frans).toBe(false);
    expect(kf.farben!.map(x => x.farbe)).toEqual(['#4FC3F7', '#FF9F43']);
  });
  it('am Handy senkrecht: derselbe Faden, nur die Achse wechselt; ohne Stufen bzw. Länge kein Faden', () => {
    const st = reiseFlow([{ zustand: 'jetzt' }, { zustand: 'offen' }]);
    const hoch = reiseFaden(st, { stufen: [{ von: 0, bis: 100 }, { von: 100, bis: 200 }], grenzen: [null, null], quer: 8, achse: 'hoch' }, FLOW_TON)!;
    expect(hoch.punkte).toEqual([[8, 0], [8, 200]]);
    expect(hoch.bisHier).toBeCloseTo(0.25);
    expect(reiseFaden(st, { stufen: [], grenzen: [], quer: 8, achse: 'quer' }, FLOW_TON)).toBeNull();
    expect(reiseFaden(st, { stufen: [{ von: 0, bis: 2 }, { von: 2, bis: 3 }], grenzen: [null, null], quer: 8, achse: 'quer' }, FLOW_TON)).toBeNull();
  });
});

describe('Fluss: Pfeile als Fäden — erledigt hell, offen gedämpft, der Pfeil in den aktuellen Knoten glüht, nein im Ton der Erinnerung', () => {
  it('pfeilZustand und pfeilFaden (rein)', () => {
    expect(pfeilZustand({ zustand: 'erledigt' }, { zustand: 'erledigt' })).toBe('erledigt');
    expect(pfeilZustand({ zustand: 'erledigt' }, { zustand: 'hier' })).toBe('hier');
    expect(pfeilZustand('begonnen', { zustand: 'hier' })).toBe('hier');
    expect(pfeilZustand({ zustand: 'hier' }, { zustand: 'offen' })).toBe('offen');
    expect(pfeilZustand(null, { zustand: 'offen' })).toBe('offen');
    expect(stufeBegonnen([{ zustand: 'offen' }, { zustand: 'hier' }])).toBe(true);
    expect(stufeBegonnen([{ zustand: 'offen' }])).toBe(false);
    expect(pfeilFaden('a', [0, 0], [0, 20], 'hier', 'weiter', FLOW_TON)).toMatchObject({ farbe: FLOW_TON.basis, bisHier: 1, gluehen: true });
    expect(pfeilFaden('a', [0, 0], [0, 20], 'offen', 'nein', FLOW_TON)).toMatchObject({ farbe: FLOW_TON.nein, bisHier: 0 });
    expect(FLOW_TON.nein).not.toBe(FLOW_TON.basis);
  });
  it('der Fluss trägt den Zustand je Pfeil aus den Knoten davor/danach — und hängt EINE Faden-Ebene an', () => {
    type K = FlussKnotenBild<K>;
    const fluss: FlussBild<K> = {
      nr: 1, titel: 'P', start: { titel: 'Start' }, abschluss: [], ende: { titel: 'Ende' },
      teile: [{ art: 'linie', knoten: [
        { id: 'a', titel: 'A', form: 'schritt', zustand: 'erledigt' },
        { id: 'b', titel: 'B', form: 'schritt', zustand: 'erledigt' },
        { id: 'e', titel: 'E?', form: 'entscheidung', zustand: 'hier', entscheid: true, neinKnoten: { id: 'r', titel: 'Erinnern', form: 'erinnerung', zustand: 'offen' } },
        { id: 'c', titel: 'C', form: 'schritt', zustand: 'offen' },
      ] }],
    };
    const html = renderToStaticMarkup(h(Fluss<K>, { fluss, gewaehlt: null, onWahl: () => {} }));
    const pfeile = [...html.matchAll(/data-flow-pfeil="(\w+)" data-flow-art="(\w+)"/g)].map(m => `${m[1]}/${m[2]}`);
    expect(pfeile).toEqual(['erledigt/weiter', 'erledigt/weiter', 'hier/weiter', 'offen/nein', 'offen/ja', 'offen/weiter']);
    expect(html.match(/data-flow-ebene=""/g)).toHaveLength(1);
    expect(html).toContain('ff-fluss-pfeil-linie'); // die ruhige Linie bleibt für Druck und den ersten Moment
    expect(renderToStaticMarkup(h(Fluss<K>, { fluss, gewaehlt: null, onWahl: () => {}, flow: 'aus' }))).not.toContain('data-flow-ebene');
  });
});

describe('Nie ohne Weg; Druck und Kunden-Ansicht ohne Bewegung', () => {
  it('FlowLinie: ohne Weg nichts, mit Weg eine verborgene Leinwand ohne Zeiger', () => {
    expect(renderToStaticMarkup(h(FlowLinie, {}))).toBe('');
    expect(renderToStaticMarkup(h(FlowLinie, { punkte: [[0, 0]] }))).toBe('');
    expect(renderToStaticMarkup(h(FlowLinie, { faeden: [] }))).toBe('');
    const html = renderToStaticMarkup(h(FlowLinie, { punkte: [[0, 4], [200, 4]], bisHier: 0.5 }));
    expect(html).toMatch(/^<canvas aria-hidden="true" data-flow-ebene="" class="ff-flow-ebene" style="pointer-events:none"/);
    expect(flowFaedenAus({ punkte: [[0, 4], [200, 4]], bisHier: 0.5, ton: '#123456' })).toEqual([{ id: 'flow', punkte: [[0, 4], [200, 4]], farbe: '#123456', staerke: 'mittel', bisHier: 0.5 }]);
  });
  it('ReiseBild: Faden nur mit Stufen; „ff-reise“ bleibt dieselbe Zeile; `aus` ohne Faden', () => {
    const sp: BildSpalte[] = [{ id: 'a', nr: 1, titel: 'A', zustand: 'jetzt', kaestchen: [], mehr: 0 }];
    expect(renderToStaticMarkup(h(ReiseBild, { spalten: [] }))).toBe('');
    const html = renderToStaticMarkup(h(ReiseBild, { spalten: sp }));
    expect(html).toMatch(/^<div class="ff-reise-weg"><div class="ff-reise" role="list"/);
    expect(html).toContain('data-flow-ebene=""');
    expect(html).toContain('data-flow-stufe="0"');
    expect(renderToStaticMarkup(h(ReiseBild, { spalten: sp, flow: 'aus' }))).not.toContain('data-flow-ebene');
  });
  it('Kunden-Seite: Standbild (`flow="still"`); FlowLinie „still“ = ruhig (kein Takt); Druck: Ebene aus, ruhige Linien zurück', () => {
    expect(lies('components/os/fulfillment/kunde/KundenAnsicht.tsx')).toMatch(/<ReiseBild [^>]*flow="still"/);
    expect(lies('components/os/ui/flow.tsx')).toContain('{ ruhig: !!p.still || bewegungReduziert()');
    const css = lies('app/globals.css');
    expect(css).toContain('@media print { .ff-flow-ebene { display: none !important; } }');
    // Ausgeblendet werden die ruhigen Linien nur am Bildschirm — gedruckt stehen sie wieder da.
    expect(css).toContain('@media screen { .ff-fluss[data-flow="an"] .ff-fluss-pfeil-linie { opacity: 0; } }');
    expect(css).toMatch(/@media screen and \(min-width: 721px\) \{ \.ff-reise-weg\[data-flow="an"\] \.ff-reise-band/);
    expect(css).toMatch(/@media screen \{\n {2}\.ff-flaeche-buehne\[data-flow="an"\] \[data-teil="pfad"\]/);
  });
});

describe('Fläche: Pfeile als Fäden, der neue Pfeil zieht einen Faden mit, Export als ruhiges Standbild', () => {
  it('flaecheFaden: weiter/ja im Grundton, nein im Ton der Erinnerung, „zurück“ leise', () => {
    const p = [[0, 0], [10, 0]] as const;
    expect(flaecheFaden({ id: 'a', art: 'weiter', punkte: p }, FLOW_TON)).toMatchObject({ farbe: FLOW_TON.basis, staerke: 'fein' });
    expect(flaecheFaden({ id: 'a', art: 'ja', punkte: p }, FLOW_TON).farbe).toBe(FLOW_TON.basis);
    expect(flaecheFaden({ id: 'a', art: 'nein', punkte: p }, FLOW_TON).farbe).toBe(FLOW_TON.nein);
    expect(flaecheFaden({ id: 'a', art: 'zurueck', punkte: p }, FLOW_TON)).toMatchObject({ farbe: FLOW_TON.nein, bisHier: 0 });
  });
  it('die Ebene liegt unter dem SVG und bekommt Kamera, Wege beim Ziehen und den Zieh-Faden direkt (kein React-Zustand je Bewegung)', () => {
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    expect(f).toMatch(/<canvas ref=\{fadenLeinwand\}[^>]*className="ff-flow-ebene"[^>]*\/>\s*<svg ref=\{svg\}/);
    expect(f).not.toContain('<rect width="100%" height="100%" fill={C.grund} />');
    const zeichne = f.slice(f.indexOf('const zeichne = '), f.indexOf('const setzeKamera = '));
    expect(zeichne).toContain('faeden.current?.kamera(k)');
    expect(f.slice(f.indexOf('const wegeNeu = '), f.indexOf('/** Teile um (dx, dy) zeigen'))).toContain('faeden.current?.weg(pf.id, punkte)');
    const bewegt = f.slice(f.indexOf('const bewegt = '), f.indexOf('/** Markierung „hier landet es“'));
    expect(bewegt).toContain('faeden.current?.zug({');
    expect(f.slice(f.indexOf('const aufraeumen = '), f.indexOf('const abbrechen = '))).toContain('faeden.current?.zug(null)');
    expect(lies('app/globals.css')).toMatch(/\.ff-flaeche-buehne > svg \{ position: relative;/);
  });
  it('Export: der Pfeil als Standbild in seiner Farbe (Schein + Kern); live ohne `faden` wie bisher, gewählt sichtbar', () => {
    const still = renderToStaticMarkup(h('svg', null, h(FlaechePfeil, { d: 'M0 0 L10 0', spitze: 's', faden: { farbe: '#FF9F43' } })));
    expect(still.match(/stroke="#FF9F43"/g)).toHaveLength(2);
    expect(still).toContain(`stroke-width="${FLOW.standbild.schein.breite}"`);
    const live = renderToStaticMarkup(h('svg', null, h(FlaechePfeil, { d: 'M0 0 L10 0', spitze: 's', gewaehlt: true })));
    expect(live).toContain('data-gewaehlt=""');
    expect(live).not.toContain('#FF9F43');
  });
});

describe('Kleine Punkte: Fläche als Vorgabe, „Versuche“, Hinweis für alte Fälle', () => {
  it('Editor: am Rechner die Fläche, am Handy die Liste — die gemerkte Wahl des Browsers gewinnt, eine feste Ansicht (Tests) erst recht', () => {
    expect(editorAnsichtVorgabe(undefined, null, false)).toBe('flaeche');
    expect(editorAnsichtVorgabe(undefined, null, true)).toBe('fluss');
    expect(editorAnsichtVorgabe(undefined, 'fluss', false)).toBe('fluss');
    expect(editorAnsichtVorgabe('fluss', 'flaeche', false)).toBe('fluss');
  });
  it('„Versuche“ (1–20, Vorgabe 5) an Erinnerungen: das Modell trägt das Feld, das Seitenfeld zeigt es nur an Erinnerungen', () => {
    const V: ProzessVorlage = { id: 'fp-t', art: 'paket', titel: 'T', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], phasenVonHand: true, freigaben: [],
      knoten: [{ id: 'fk-w', titel: 'T', rang: 1 }, { id: 'fk-p', elternId: 'fk-w', titel: 'P', rang: 1 }, { id: 'fk-e', elternId: 'fk-p', titel: 'E?', rang: 1, form: 'entscheidung', zweige: { nein: 'fk-r' } }, { id: 'fk-r', elternId: 'fk-p', titel: 'Erinnern', rang: 2, form: 'erinnerung', versuche: 3 }] };
    const r = editorModell(V).phasen[0].abschnitte.flatMap(a => a.knoten).find(x => x.id === 'fk-r')!;
    expect(r.versuche).toBe(3);
    const sf = lies('components/os/fulfillment/editor/SeitenFeld.tsx');
    expect(sf).toContain("{k.form === 'erinnerung' && (");
    expect(sf).toContain('label={`Versuche (${VERSUCHE_MIN}–${VERSUCHE_MAX})`}');
    expect(sf).toContain('platzhalter={String(VERSUCHE_VORGABE)}');
    expect(sf).toContain('void setze({ versuche: n })');
  });
  it('alter Fall ohne Formen: Hinweis „Vorlage übernehmen, damit die Ausführung startet ›“ nur, wenn die neue Fassung Formen bringt', () => {
    const alt = fall();
    const vorlage = { knoten: [{ id: 'x', form: 'schritt' as const }] };
    expect(ausfuehrungNachUebernahme(alt, vorlage, { neu: [] })).toBe(true);
    expect(ausfuehrungNachUebernahme(alt, vorlage, null)).toBe(false);
    expect(ausfuehrungNachUebernahme(alt, { knoten: [{ id: 'x' }] }, { neu: [] })).toBe(false);
    expect(ausfuehrungNachUebernahme({ knoten: [...alt.knoten, k('s', 'p2', 'S', 9, { form: 'schritt' })] }, vorlage, { neu: [] })).toBe(false);
    const d = { neu: [], geaendert: [{ id: 'p2-b', titel: 'Leitfaden', felder: ['form'] }], entfernt: [], reihenfolge: [], von: 1, nach: 2 };
    const html = renderToStaticMarkup(h(AusfuehrungWartet, { daten: { ausfuehrungWartet: true, diff: d } as unknown as FallAntwort }));
    expect(html).toContain('Vorlage übernehmen, damit die Ausführung startet ›');
    expect(renderToStaticMarkup(h(AusfuehrungWartet, { daten: { ausfuehrungWartet: false, diff: d } as unknown as FallAntwort }))).toBe('');
    expect(lies('components/os/fulfillment/prozesse/FallUeberblick.tsx')).toContain('<div id="ff-vorlage-geaendert"');
    expect(lies('components/os/fulfillment/reise/FallReise.tsx')).toContain('<AusfuehrungWartet daten={daten} />');
  });
});

describe('Index-Status ohne Widerspruch (Kevins Bild: „Noch keine Daten“ neben einem gemessenen Score)', () => {
  it('eine gemessene, aber zu dünne Säule zählt als „Vorläufig“ — nie „Noch keine Daten“ neben einer Kachel mit Wert', () => {
    const kz = (id: string) => ({ id, label: id, saeule: 'mt', gruppe: 'g', einheit: 'punkte' as const, richtung: 'hoch' as const, gruen: 70, rot: 40, formel: '', quelle: '', luecke: 'fehlt' });
    const ergebnis = berechneModell({
      saeulen: [{ id: 'mt', label: 'Markttraktion', gewicht: 1, satz: '' }], kennzahlen: ['traktion', 'a', 'b', 'c'].map(kz),
      messen: { traktion: () => ({ wert: 37, anzeige: '37', quelle: 'Traktions-Index' }) }, bestand: null, stand: HEUTE, scope: 'gesamt',
    });
    expect(ergebnis.index).toBeNull();
    expect(ergebnis.abdeckung).toBe(0); // zu dünn — zählte bisher als „nichts gemessen“
    const st = indexStatus(ergebnis);
    expect(st.titel).toBe('Vorläufig');
    expect(st.satz).toContain('erst 1 von 4 Kennzahlen gemessen');
    expect(lies('components/os/business/IndexStreifen.tsx')).toContain('indexStatus(bi).titel');
    // Ohne jede Messung bleibt es „Noch keine Daten“; mit Wert das Label.
    expect(indexStatus({ ...ergebnis, saeulen: ergebnis.saeulen.map(s => ({ ...s, score: null, kennzahlen: s.kennzahlen.map(x => ({ ...x, gemessen: false })) })) }).titel).toBe('Noch keine Daten');
    expect(indexStatus({ index: null, label: 'Noch keine Daten', abdeckung: 0, luecken: 2, saeulen: [{ id: 'x', label: 'x', score: 50 }] } as never).titel).toBe('Vorläufig');
  });
});

describe('DESIGN_STANDARD: Markenzeichen: der Flow', () => {
  it('Abschnitt mit Leitsatz, Regeln, Liste „hat den Flow“ / „als Nächstes“', () => {
    const d = lies('DESIGN_STANDARD.md');
    const ab = d.slice(d.indexOf('## Markenzeichen: der Flow'));
    expect(ab.length).toBeGreaterThan(500);
    for (const w of ['Nach und nach kommt alles in den Flow', 'FlowLinie', 'lib/lichtfaeden/flow.ts', 'prefers-reduced-motion', 'Druck', 'zählt nicht', 'Hat den Flow', 'Als Nächstes']) expect(ab, w).toContain(w);
  });
});
