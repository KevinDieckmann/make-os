// ─── Brain-Kugel: zoomen, drehen, verschieben (16.10.2026) ───────────────────
// Kevin: „Das Brain muss zoombar sein. Ich will raus und rein zoomen können — am besten wie beim MacBook auf dem Touchpad.“
// und „So muss ich das Hirn auch irgendwie bewegen können, nach links oder rechts — das muss beweglicher sein.“
// Der Test hält fest: die reine Rechnung (Lupe: Grenzen, Zoom zum Punkt, Dämpfung; Drehen, Schwung, Klick vs. Ziehen,
// Mausrad vs. Trackpad, Tasten, Hinweis), die Eingabe an der Fläche (nur dort, nie passiv, wo preventDefault nötig ist — außerhalb
// rollt die Seite weiter) und dass die ZOE-Kugel ohne Bedienung bleibt, wie sie war.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aufBildschirm, drehung, perspektive, kameraAbstand, zeigerAufKugel, norm, type Vec3 } from '@/components/os/kugel/geometrie';
import {
  LUPE_RUHE, LUPE_MAX, begrenzeLupe, zoomeUm, verschiebeLupe, lupeNachziehen, mitLupe, durchLupe, ohneLupe, ndcAus, lupePunkt, radFaktor, radArt,
  MAUSRAD_RASTER, drehAusPx, klemmeNeigung, NEIGUNG_GRENZE, istZiehen, ZIEH_SCHWELLE, schwungAus, schwungAbklingen, SCHWUNG_MAX_PX, eigenAnlauf,
  tasteAktion, TASTE_ZOOM, kameraHinweis, type Lupe, type RadStand,
} from '@/components/os/kugel/steuerung';
import { kugelEingabe, EINGABE_LAUSCHER, AKTIVE_LAUSCHER } from '@/components/os/kugel/eingabe';
import type { Motor } from '@/components/os/kugel/motor';
import { zoeWolke } from '@/components/os/kugel/wolke';
import { zoeParameter } from '@/components/os/kugel/geometrie';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;
const FOV = (34 * Math.PI) / 180;

describe('Lupe: Grenzen, Zoom zum Punkt, Dämpfung (rein)', () => {
  it('Grenzen: nie weiter heraus als die ganze Kugel, höchstens LUPE_MAX hinein; bei 1 kein Versatz', () => {
    expect(begrenzeLupe({ s: 0.3, x: 0.4, y: -0.2 })).toEqual(LUPE_RUHE);
    expect(begrenzeLupe({ s: 50, x: 0, y: 0 }).s).toBe(LUPE_MAX);
    expect(begrenzeLupe({ s: Number.NaN, x: 1, y: 1 })).toEqual(LUPE_RUHE);
    expect(Object.is(begrenzeLupe({ s: 1, x: -0, y: 0 }).x, 0)).toBe(true);
    expect(zoomeUm({ s: 3, x: 0.5, y: -0.4 }, 0.01, [0.3, 0.3])).toEqual(LUPE_RUHE); // ganz heraus = ganze Kugel, mittig
  });
  it('Verschieben ist begrenzt: die Bildmitte bleibt über der Kugel — sie läuft nie ganz aus dem Bild', () => {
    const umriss = { rx: 0.45, ry: 0.8 };
    for (const s of [1.5, 3, LUPE_MAX]) for (const [x, y] of [[9, 0], [-9, 9], [0, -9], [3, 3]]) {
      const l = begrenzeLupe({ s, x, y }, umriss);
      const mitte = ohneLupe(l, [0, 0]); // Rohbild-Punkt in der Mitte des Ausschnitts
      expect(Math.hypot(mitte[0] / umriss.rx, mitte[1] / umriss.ry)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.abs(mitte[0])).toBeLessThanOrEqual(1 - 1 / s + 1e-9);
    }
    // Bei s = 1 verschiebt sich nichts.
    expect(verschiebeLupe(LUPE_RUHE, 120, -80, 400, 300, umriss)).toEqual(LUPE_RUHE);
    // Hineingezoomt folgt der Inhalt dem Zeiger: 100 px nach rechts in 400 px Breite = 0,5 NDC.
    const l = verschiebeLupe({ s: 3, x: 0, y: 0 }, 100, 0, 400, 300, { rx: 1, ry: 1 });
    expect(nah(durchLupe(l, [0, 0])[0] - durchLupe({ s: 3, x: 0, y: 0 }, [0, 0])[0], 0.5)).toBe(true);
  });
  it('Zoom zum Punkt: der Punkt unter dem Zeiger bleibt stehen (auch über mehrere Schritte)', () => {
    let l: Lupe = LUPE_RUHE;
    for (const u of [[0.3, -0.2], [-0.5, 0.4], [0.1, 0.1]] as [number, number][]) {
      const roh = ohneLupe(l, u);
      l = zoomeUm(l, 1.8, u, { rx: 2, ry: 2 });
      const d = durchLupe(l, roh);
      expect(nah(d[0], u[0], 1e-9) && nah(d[1], u[1], 1e-9)).toBe(true);
    }
    expect(l.s).toBeGreaterThan(5);
    // Zur Mitte: kein Versatz.
    expect(zoomeUm(LUPE_RUHE, 2)).toEqual({ s: 2, x: 0, y: 0 });
  });
  it('Projektion mit Lupe = Bildpunkt durch die Lupe; ohne Lupe genau die alte Projektion (ZOE unverändert)', () => {
    const proj = perspektive(FOV, 1.6, 0.05, 50), dreh = drehung(0.7, 0.26), abstand = kameraAbstand(FOV, 1.6, 0.84), W = 800, H = 500;
    expect(Array.from(mitLupe(proj, LUPE_RUHE))).toEqual(Array.from(proj));
    const l: Lupe = { s: 2.5, x: 0.3, y: -0.4 };
    for (const p of [[0.2, 0.4, 0.89], [-0.6, -0.1, 0.79], [0, 1, 0]] as Vec3[]) {
      const a = aufBildschirm(p, dreh, proj, abstand, W, H), b = aufBildschirm(p, dreh, mitLupe(proj, l), abstand, W, H);
      const erwartet = durchLupe(l, ndcAus(a.x, a.y, W, H));
      const ist = ndcAus(b.x, b.y, W, H);
      expect(nah(ist[0], erwartet[0], 1e-5) && nah(ist[1], erwartet[1], 1e-5)).toBe(true);
      expect(b.vorne).toBe(a.vorne);
    }
  });
  it('Hit-Test mit Zoom: der Zeiger-Strahl ohne Lupe trifft den Stern, der unter dem Zeiger steht', () => {
    const proj = perspektive(FOV, 1, 0.05, 50), dreh = drehung(-0.4, 0.3), abstand = kameraAbstand(FOV, 1, 0.84), W = 600, H = 600;
    const l: Lupe = { s: 4, x: -0.6, y: 0.9 };
    const p = norm([0.15, 0.1, 1]);
    const sch = aufBildschirm(p, dreh, mitLupe(proj, l), abstand, W, H);
    const treffer = zeigerAufKugel(ohneLupe(l, ndcAus(sch.x, sch.y, W, H)), FOV, 1, abstand, dreh, 1);
    expect(treffer).not.toBeNull();
    expect(Math.hypot(treffer![0] - p[0], treffer![1] - p[1], treffer![2] - p[2])).toBeLessThan(1e-4);
  });
  it('Dämpfung: weich, unabhängig von der Bildrate, rastet am Ziel ein — und der Zoom-Punkt bleibt auch unterwegs stehen', () => {
    const ziel: Lupe = { s: 4, x: 0.6, y: -0.3 };
    const ein = lupeNachziehen(LUPE_RUHE, ziel, 1 / 30), zwei = lupeNachziehen(lupeNachziehen(LUPE_RUHE, ziel, 1 / 60), ziel, 1 / 60);
    expect(nah(ein.s, zwei.s, 1e-9) && nah(ein.x, zwei.x, 1e-9)).toBe(true);
    expect(ein.s).toBeGreaterThan(1); expect(ein.s).toBeLessThan(4);
    let l: Lupe = LUPE_RUHE;
    for (let i = 0; i < 240; i++) l = lupeNachziehen(l, ziel, 1 / 60);
    expect(l).toBe(ziel);
    const u: [number, number] = [0.4, -0.5];
    const z = zoomeUm(LUPE_RUHE, 3, u, { rx: 2, ry: 2 });
    const mitte = lupeNachziehen(LUPE_RUHE, z, 1 / 60);
    const d = durchLupe(mitte, ohneLupe(LUPE_RUHE, u));
    expect(nah(d[0], u[0], 1e-9) && nah(d[1], u[1], 1e-9)).toBe(true);
  });
  it('Sterne wachsen mit der Lupe, aber langsamer als ihr Abstand — so trennen sie sich und bleiben lesbar', () => {
    expect(lupePunkt(1)).toBe(1);
    expect(lupePunkt(LUPE_MAX)).toBeGreaterThan(1.5);
    expect(lupePunkt(LUPE_MAX)).toBeLessThan(Math.sqrt(LUPE_MAX));
  });
});

describe('Pinch, Rad und Trackpad (rein)', () => {
  it('Pinch-Faktor: auseinander (deltaY < 0) zoomt hinein, große Schritte gedeckelt, Zeilen-Modus umgerechnet', () => {
    expect(radFaktor(-4)).toBeGreaterThan(1); expect(radFaktor(4)).toBeLessThan(1);
    expect(radFaktor(1000)).toBeCloseTo(Math.exp(-0.5), 9); expect(radFaktor(-1000)).toBeCloseTo(Math.exp(0.5), 9);
    expect(radFaktor(-1, 1)).toBeCloseTo(Math.exp(0.16), 9);
    expect(radFaktor(Number.NaN)).toBe(1);
  });
  it('Mausrad oder Trackpad: Rastschritte und Zeilen = Mausrad (Seite rollt), Querbewegung und kleine Schritte = Trackpad', () => {
    const art = (e: Partial<Parameters<typeof radArt>[0]>, vorher: RadStand | null = null, jetzt = 1000) => radArt({ deltaX: 0, deltaY: 0, deltaMode: 0, ...e }, vorher, jetzt).art;
    expect(art({ deltaY: 3, deltaMode: 1 })).toBe('rad');
    expect(art({ deltaY: MAUSRAD_RASTER })).toBe('rad');
    expect(art({ deltaY: -2 * MAUSRAD_RASTER })).toBe('rad');
    expect(art({ deltaY: 100, wheelDeltaY: -120 })).toBe('rad');            // Windows-Mausrad
    expect(art({ deltaY: 40, wheelDeltaY: -120 })).toBe('trackpad');         // Chrome-Trackpad: wheelDeltaY = −3 · deltaY
    expect(art({ deltaY: 2.5 })).toBe('trackpad');
    expect(art({ deltaX: 6, deltaY: 30 })).toBe('trackpad');
    expect(art({ deltaX: MAUSRAD_RASTER, shiftKey: true })).toBe('rad');     // ⇧ + Mausrad am Mac kommt quer
    // Unklar → nichts abfangen; in einer laufenden Bewegung gilt ihre Art; nach einer Pause wieder unklar.
    expect(art({ deltaY: 57 })).toBeNull();
    const tp: RadStand = { art: 'trackpad', zeit: 900 };
    expect(art({ deltaY: 57 }, tp, 1000)).toBe('trackpad');
    expect(art({ deltaY: 57 }, tp, 1500)).toBeNull();
    // Unklar, aber dicht folgende kleine Schritte = Trackpad; seltene große = Mausrad.
    expect(art({ deltaY: 10 }, { art: null, zeit: 990 }, 1000)).toBe('trackpad');
    expect(art({ deltaY: 120 }, { art: null, zeit: 900 }, 1000)).toBe('rad');
  });
});

describe('Drehen, Schwung, Klick vs. Ziehen (rein)', () => {
  it('Ziehen dreht so, dass die Oberfläche unter dem Zeiger mitläuft; mit Lupe feiner; Neigung begrenzt', () => {
    const proj = perspektive(FOV, 1, 0.05, 50), abstand = kameraAbstand(FOV, 1, 0.84), W = 600, H = 600, eins = drehung(0, 0);
    const a = aufBildschirm([0, 0, 1], eins, proj, abstand, W, H), b = aufBildschirm([0.01, 0, 1], eins, proj, abstand, W, H);
    const r = Math.abs(b.x - a.x) / 0.01;
    const d = drehAusPx(6, 0, r);
    const nach = aufBildschirm([0, 0, 1], drehung(d.g, 0), proj, abstand, W, H);
    expect(Math.abs(nach.x - a.x - 6)).toBeLessThan(0.1);
    const v = drehAusPx(0, 6, r);
    const runter = aufBildschirm([0, 0, 1], drehung(0, v.n), proj, abstand, W, H);
    expect(Math.abs(runter.y - a.y - 6)).toBeLessThan(0.1);
    expect(drehAusPx(10, 0, 100, 2).g).toBeCloseTo(drehAusPx(10, 0, 100, 1).g / 2, 12);
    expect(klemmeNeigung(9)).toBe(NEIGUNG_GRENZE); expect(klemmeNeigung(-9)).toBe(-NEIGUNG_GRENZE);
  });
  it('Klick ≠ Ziehen: erst ab etwa 5 px ist es Ziehen', () => {
    expect(ZIEH_SCHWELLE).toBe(5);
    expect(istZiehen(3, 3)).toBe(false); expect(istZiehen(0, 4.9)).toBe(false);
    expect(istZiehen(4, 3)).toBe(true); expect(istZiehen(-5, 0)).toBe(true);
  });
  it('Schwung: Geschwindigkeit aus den letzten Millisekunden, stand der Zeiger still keiner, Ausreißer gedeckelt', () => {
    const proben = [0, 10, 20, 30].map(t => ({ t, x: 100 + t, y: 50 }));
    expect(schwungAus(proben, 35).x).toBeCloseTo(1000, 6);
    expect(schwungAus(proben, 35).y).toBe(0);
    expect(schwungAus(proben, 200)).toEqual({ x: 0, y: 0 });
    expect(schwungAus(proben.slice(0, 1), 5)).toEqual({ x: 0, y: 0 });
    const v = schwungAus([{ t: 0, x: 0, y: 0 }, { t: 10, x: 5000, y: 0 }], 12);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(SCHWUNG_MAX_PX, 6);
  });
  it('Trägheit: klingt sanft ab (unabhängig von der Bildrate), kommt sicher zum Stehen, der Weg bleibt endlich', () => {
    const ein = schwungAbklingen({ g: 2, n: -1 }, 1 / 30), zwei = schwungAbklingen(schwungAbklingen({ g: 2, n: -1 }, 1 / 60), 1 / 60);
    expect(nah(ein.g, zwei.g, 1e-12) && nah(ein.n, zwei.n, 1e-12)).toBe(true);
    expect(ein.g).toBeLessThan(2); expect(ein.g).toBeGreaterThan(1.5);
    let v = { g: 3, n: 0 }, weg = 0, t = 0;
    while ((v.g || v.n) && t < 10) { weg += v.g / 60; v = schwungAbklingen(v, 1 / 60); t += 1 / 60; }
    expect(v).toEqual({ g: 0, n: 0 });
    expect(t).toBeLessThan(3);
    expect(weg).toBeGreaterThan(0.5); expect(weg).toBeLessThan(1.5);
  });
  it('Eigendrehung: bremst beim Bedienen schnell ab und läuft danach sanft wieder an', () => {
    let e = 1;
    for (let i = 0; i < 6; i++) e = eigenAnlauf(e, 0, 1 / 60);
    expect(e).toBeLessThan(0.2);
    let a = 0;
    for (let i = 0; i < 30; i++) a = eigenAnlauf(a, 1, 1 / 60);
    expect(a).toBeGreaterThan(0.3); expect(a).toBeLessThan(0.7);
    for (let i = 0; i < 400; i++) a = eigenAnlauf(a, 1, 1 / 60);
    expect(a).toBe(1);
    expect(eigenAnlauf(1, 1, 1 / 60)).toBe(1); // ohne Bedienung bleibt die Eigendrehung genau, wie sie war
  });
  it('Tasten und Hinweis', () => {
    expect(tasteAktion('+')).toEqual({ art: 'zoom', faktor: TASTE_ZOOM });
    expect(tasteAktion('-')).toEqual({ art: 'zoom', faktor: 1 / TASTE_ZOOM });
    expect(tasteAktion('0')).toEqual({ art: 'zurueck' });
    expect(tasteAktion('ArrowLeft')).toEqual({ art: 'drehen', dx: -40, dy: 0 });
    expect(tasteAktion('ArrowUp', true)).toEqual({ art: 'verschieben', dx: 0, dy: -40 });
    expect(tasteAktion('a')).toBeNull();
    expect(kameraHinweis(true, false)).toBe('Ziehen zum Drehen · Pinch oder ⌘ + Scrollen zum Zoomen');
    expect(kameraHinweis(false, false)).toContain('Strg + Scrollen');
    expect(kameraHinweis(true, true)).toContain('zwei Finger');
  });
});

// ── Eingabe an der Fläche (ohne Browser: ein nachgebautes Element) ──
function nachbau() {
  const lauscher: { typ: string; fn: (e: unknown) => void; opt?: AddEventListenerOptions }[] = [];
  const el = {
    style: { cursor: 'grab' },
    addEventListener: (typ: string, fn: (e: unknown) => void, opt?: AddEventListenerOptions) => { lauscher.push({ typ, fn, opt }); },
    removeEventListener: (typ: string, fn: (e: unknown) => void) => { const i = lauscher.findIndex(l => l.typ === typ && l.fn === fn); if (i >= 0) lauscher.splice(i, 1); },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
    setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(),
  };
  const sende = (typ: string, e: Record<string, unknown> = {}) => {
    const ev = { type: typ, target: null, preventDefault: vi.fn(), cancelable: true, ...e };
    for (const l of lauscher.filter(x => x.typ === typ)) l.fn(ev);
    return ev;
  };
  let s = 1;
  const motor = {
    zoome: vi.fn(), verschiebe: vi.fn(), drehe: vi.fn(), greifen: vi.fn(), loslassen: vi.fn(),
    kameraStand: () => ({ s, veraendert: s > 1 }),
  };
  let jetzt = 0;
  const zurueck = vi.fn(), hinweis = vi.fn();
  const eingabe = kugelEingabe(el as unknown as HTMLElement, { motor: () => motor as unknown as Motor, zuruecksetzen: zurueck, hinweis, uhr: () => jetzt });
  return { el, lauscher, sende, motor, eingabe, zurueck, hinweis, setzeS: (v: number) => { s = v; }, uhr: (t: number) => { jetzt = t; } };
}

describe('Eingabe: nur an der Kugel-Fläche, außerhalb rollt die Seite weiter', () => {
  it('jeder Lauscher hängt an der Fläche; Rad, Geste und Touch nie passiv; Abbauen nimmt alle wieder ab', () => {
    const n = nachbau();
    expect(n.lauscher.map(l => l.typ).sort()).toEqual([...EINGABE_LAUSCHER].sort());
    for (const typ of ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove']) {
      expect(AKTIVE_LAUSCHER).toContain(typ);
      expect(n.lauscher.find(l => l.typ === typ)?.opt).toEqual({ passive: false });
    }
    n.eingabe.abbauen();
    expect(n.lauscher).toHaveLength(0);
  });
  it('Quelltext: nie an Fenster oder Dokument; die Brain-Kugel hängt die Eingabe an ihre Fläche und schaltet den Motor bedienbar', () => {
    const e = lies('components/os/kugel/eingabe.ts');
    expect(e).not.toMatch(/(window|document)\.addEventListener/);
    expect(e).toContain('el.addEventListener(typ');
    const b = lies('components/os/kugel/BrainKugel.tsx');
    expect(b).not.toMatch(/(window|document)\.addEventListener\(\s*['"](wheel|gesture|touch|pointer|key)/);
    expect(b).toContain('kugelEingabe(el,'); expect(b).toContain('ref={flaecheSetzen}');
    expect(b).toMatch(/<Kugel[\s\S]*?bedienbar[\s\S]*?beiKamera=\{beiKamera\}/);
    expect(b).toContain("touchAction: gezoomt ? 'none' : 'pan-y'");
    expect(b).toContain('tabIndex={0}');
    expect(b).toContain('if (eingabe.current?.warZiehen()) return;');
  });
  it('Pinch (ctrlKey) und ⌘ + Mausrad zoomen zum Zeiger — die Seite zoomt nicht mit', () => {
    const n = nachbau();
    const ev = n.sende('wheel', { ctrlKey: true, deltaY: -10, deltaX: 0, deltaMode: 0, clientX: 110, clientY: 70 });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(n.motor.zoome).toHaveBeenCalledWith(radFaktor(-10), 100, 50);
    const ev2 = n.sende('wheel', { metaKey: true, deltaY: 100, deltaX: 0, deltaMode: 0, clientX: 210, clientY: 120 });
    expect(ev2.preventDefault).toHaveBeenCalled();
    expect(n.motor.zoome).toHaveBeenLastCalledWith(radFaktor(100), 200, 100);
  });
  it('Mausrad ohne Taste: die Seite rollt weiter (kein preventDefault), nur der Hinweis erscheint', () => {
    const n = nachbau();
    [{ deltaY: 100, wheelDeltaY: -120 }, { deltaY: MAUSRAD_RASTER }, { deltaY: 3, deltaMode: 1 }, { deltaY: 57 }].forEach((e, i) => {
      n.uhr(1000 * (i + 1)); // Pausen dazwischen: jede Bewegung beginnt neu
      const ev = n.sende('wheel', { deltaX: 0, deltaMode: 0, clientX: 50, clientY: 50, ...e });
      expect(ev.preventDefault).not.toHaveBeenCalled();
    });
    expect(n.hinweis).toHaveBeenCalledTimes(4);
    expect(n.motor.drehe).not.toHaveBeenCalled(); expect(n.motor.zoome).not.toHaveBeenCalled();
  });
  it('Zwei-Finger-Wischen (Trackpad) dreht, mit ⇧ verschiebt es — dabei rollt die Seite nicht', () => {
    const n = nachbau();
    const ev = n.sende('wheel', { deltaX: 1, deltaY: 2, deltaMode: 0, clientX: 50, clientY: 50 });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(n.motor.drehe).toHaveBeenCalledWith(-1, -2);
    const ev2 = n.sende('wheel', { deltaX: 3, deltaY: 1.5, deltaMode: 0, shiftKey: true, clientX: 50, clientY: 50 });
    expect(ev2.preventDefault).toHaveBeenCalled();
    expect(n.motor.verschiebe).toHaveBeenCalledWith(-3, -1.5);
  });
  it('Safari: Pinch als Geste zoomt zum Zeiger; das gleichzeitige Rad mit ctrlKey zählt nicht doppelt', () => {
    const n = nachbau();
    expect(n.sende('gesturestart', { scale: 1, clientX: 110, clientY: 120 }).preventDefault).toHaveBeenCalled();
    n.sende('gesturechange', { scale: 1.5, clientX: 110, clientY: 120 });
    expect(n.motor.zoome).toHaveBeenCalledWith(1.5, 100, 100);
    n.sende('wheel', { ctrlKey: true, deltaY: -5, deltaX: 0, deltaMode: 0, clientX: 110, clientY: 120 });
    expect(n.motor.zoome).toHaveBeenCalledTimes(1);
    n.sende('gestureend', {});
    n.sende('wheel', { ctrlKey: true, deltaY: -5, deltaX: 0, deltaMode: 0, clientX: 110, clientY: 120 });
    expect(n.motor.zoome).toHaveBeenCalledTimes(2);
  });
  it('Klick ≠ Ziehen: unter 5 px bleibt es ein Klick (Stern öffnet), darüber dreht es — mit Schwung beim Loslassen', () => {
    const n = nachbau();
    n.sende('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 110, clientY: 120 });
    n.sende('pointermove', { pointerId: 1, clientX: 113, clientY: 122 });
    n.sende('pointerup', { pointerId: 1, clientX: 113, clientY: 122 });
    expect(n.motor.greifen).not.toHaveBeenCalled(); expect(n.motor.drehe).not.toHaveBeenCalled();
    expect(n.eingabe.warZiehen()).toBe(false);

    n.uhr(0);
    n.sende('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 110, clientY: 120 });
    for (const t of [10, 20, 30]) { n.uhr(t); n.sende('pointermove', { pointerId: 2, clientX: 110 + t, clientY: 120 }); }
    expect(n.motor.greifen).toHaveBeenCalledTimes(1);
    expect(n.motor.drehe).toHaveBeenNthCalledWith(1, 10, 0);
    expect(n.el.setPointerCapture).toHaveBeenCalledWith(2);
    expect(n.el.style.cursor).toBe('grabbing');
    expect(n.eingabe.zieht()).toBe(true);
    n.uhr(35);
    n.sende('pointerup', { pointerId: 2, clientX: 140, clientY: 120 });
    const [vx, vy] = n.motor.loslassen.mock.calls[0];
    expect(vx).toBeCloseTo(1000, 6); expect(vy).toBe(0);
    expect(n.eingabe.warZiehen()).toBe(true); // das Loslassen öffnet keinen Stern
    expect(n.eingabe.zieht()).toBe(false);
    expect(n.el.style.cursor).toBe('grab');
  });
  it('⇧ + Ziehen verschiebt (ohne Schwung); rechte Taste und Knöpfe in der Fläche lösen nichts aus; Abbruch ohne Schwung', () => {
    const n = nachbau();
    n.sende('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 110, clientY: 120 });
    n.sende('pointermove', { pointerId: 1, clientX: 130, clientY: 140, shiftKey: true });
    expect(n.motor.verschiebe).toHaveBeenCalledWith(20, 20);
    n.sende('pointerup', { pointerId: 1 });
    expect(n.motor.loslassen).toHaveBeenLastCalledWith(0, 0);
    n.sende('pointerdown', { pointerId: 3, pointerType: 'mouse', button: 2, clientX: 110, clientY: 120 });
    n.sende('pointermove', { pointerId: 3, clientX: 200, clientY: 120 });
    n.sende('pointerdown', { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 110, clientY: 120, target: { closest: () => ({}) } });
    n.sende('pointermove', { pointerId: 4, clientX: 200, clientY: 120 });
    expect(n.motor.drehe).not.toHaveBeenCalled();
    n.sende('pointerdown', { pointerId: 5, pointerType: 'touch', button: 0, clientX: 110, clientY: 120 });
    n.sende('pointermove', { pointerId: 5, clientX: 140, clientY: 120 });
    n.sende('pointercancel', { pointerId: 5 });
    expect(n.motor.loslassen).toHaveBeenLastCalledWith(0, 0);
  });
  it('Handy: zwei Finger zoomen um ihre Mitte und verschieben; das Loslassen ist kein Tippen; die Seite rollt dabei nicht', () => {
    const n = nachbau();
    n.sende('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 110, clientY: 120 });
    n.sende('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 210, clientY: 120 });
    expect(n.eingabe.warZiehen()).toBe(true); expect(n.eingabe.zieht()).toBe(true);
    n.sende('pointermove', { pointerId: 2, clientX: 310, clientY: 120 });
    expect(n.motor.zoome).toHaveBeenCalledWith(2, 200, 100);
    expect(n.motor.verschiebe).toHaveBeenCalledWith(50, 0);
    expect(n.sende('touchmove', { touches: [{}, {}] }).preventDefault).toHaveBeenCalled();
    expect(n.sende('touchmove', { touches: [{}] }).preventDefault).not.toHaveBeenCalled();
    n.sende('pointerup', { pointerId: 2 });
    n.sende('pointermove', { pointerId: 1, clientX: 300, clientY: 120 }); // der verbliebene Finger dreht nicht
    n.sende('pointerup', { pointerId: 1 });
    expect(n.motor.drehe).not.toHaveBeenCalled();
    expect(n.eingabe.warZiehen()).toBe(true);
  });
  it('Doppelklick zoomt zum Punkt (ganz drinnen: zurück); Tasten + − 0 und Pfeile, ⌘ + bleibt beim Browser', () => {
    const n = nachbau();
    n.sende('dblclick', { clientX: 160, clientY: 170 });
    expect(n.motor.zoome).toHaveBeenCalledWith(2, 150, 150);
    n.setzeS(LUPE_MAX);
    n.sende('dblclick', { clientX: 160, clientY: 170 });
    expect(n.zurueck).toHaveBeenCalledTimes(1);
    n.sende('keydown', { key: '+' }); expect(n.motor.zoome).toHaveBeenLastCalledWith(TASTE_ZOOM);
    n.sende('keydown', { key: '-' }); expect(n.motor.zoome).toHaveBeenLastCalledWith(1 / TASTE_ZOOM);
    n.sende('keydown', { key: 'ArrowRight' }); expect(n.motor.drehe).toHaveBeenLastCalledWith(40, 0);
    n.sende('keydown', { key: 'ArrowDown', shiftKey: true }); expect(n.motor.verschiebe).toHaveBeenLastCalledWith(0, 40);
    n.sende('keydown', { key: '0' }); expect(n.zurueck).toHaveBeenCalledTimes(2);
    expect(n.sende('keydown', { key: '+', metaKey: true }).preventDefault).not.toHaveBeenCalled();
    expect(n.sende('keydown', { key: 'Tab' }).preventDefault).not.toHaveBeenCalled();
  });
});

describe('ZOE bleibt, wie sie war — Bedienung nur, wenn die Ansicht sie einschaltet', () => {
  it('Vorgabe aus: keine Voreinstellung schaltet sie ein, ZOE-Kugeln geben sie nicht an, der Motor fragt `darf`', async () => {
    const { KUGEL_VORGABEN } = await import('@/components/os/kugel/Kugel');
    for (const v of Object.values(KUGEL_VORGABEN)) expect((v as { bedienbar?: boolean }).bedienbar).toBeUndefined();
    for (const f of ['components/os/kugel/ZoeKugel.tsx', 'components/os/ZoeStart.tsx', 'components/os/ZoePanel.tsx']) expect(lies(f), f).not.toContain('bedienbar');
    const m = lies('components/os/kugel/motor.ts');
    expect(m).toContain('const darf = !!opt.bedienbar;');
    for (const fn of ['zoome(faktor, x, y) {', 'verschiebe(dx, dy) {', 'drehe(dx, dy) {', 'zuruecksetzen() {']) {
      const ab = m.indexOf(fn);
      expect(ab, fn).toBeGreaterThan(0);
      expect(m.slice(ab, ab + 80), fn).toContain('if (!darf) return;');
    }
    // Hit-Test, Beschriftungen und Shader nehmen dieselbe Projektion mit Lupe.
    expect(m).toContain('aufBildschirm(p, dreh, projLupe');
    expect(m).toContain('uniformMatrix4fv(u.uProj!, false, projLupe)');
    expect(m).toContain('zeigerAufKugel(ohneLupe(lupeIst, ndc)');
    // Eigendrehung pausiert beim Bedienen, Trägheit nur ohne „Bewegung reduzieren“.
    expect(m).toContain('gier += dt * opt.drehTempo * eigen');
    expect(m).toContain('opt.ruhig ? { g: 0, n: 0 }');
  });
  it('die Kugel rendert serverseitig auch bedienbar ohne Fehler (dekorativ, aria-hidden)', async () => {
    const { Kugel } = await import('@/components/os/kugel/Kugel');
    const html = renderToStaticMarkup(createElement(Kugel, { name: 'probe', art: 'brain', bedienbar: true, daten: zoeWolke(10), zustand: zoeParameter('ruht'), rueckfall: null }));
    expect(html).toContain('aria-hidden="true"');
  });
});
