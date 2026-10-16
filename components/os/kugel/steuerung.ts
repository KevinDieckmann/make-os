// ─── MAKE OS — Kugel: Bedienung, reine Rechnung (16.10.2026) ─────────────────
// Kevin: „Das Brain muss zoombar sein. Ich will raus und rein zoomen können — am besten wie beim MacBook auf dem Touchpad.“
// und „So muss ich das Hirn auch irgendwie bewegen können, nach links oder rechts — das muss beweglicher sein.“
// Ohne DOM, ohne WebGL (läuft im Motor und in den Tests, tests/kugel-steuerung.test.ts):
//   · Lupe — Vergrößerung + Versatz NACH der Projektion (wie ein Objektiv): Zoom zum Punkt unter dem Zeiger, Verschieben,
//     begrenzt (1 = ganze Kugel … LUPE_MAX = einzelne Sterne gut lesbar; die Bildmitte bleibt immer über der Kugel),
//     sanft nachgezogen (unabhängig von der Bildrate).
//   · Drehen aus Pixeln („die Kugel greifen“), Neigung begrenzt, Schwung beim Loslassen (Trägheit, gedämpft), Eigendrehung
//     läuft danach sanft wieder an.
//   · Klick ≠ Ziehen (ab ZIEH_SCHWELLE px), Mausrad ≠ Trackpad (Rad-Erkennung), Tasten, Hinweistext.
// Die Werte hält der Motor (motor.ts), die Eingabe am Element liest das DOM (eingabe.ts) — hier steht nur die Rechnung.

import { klemme, type Mat4 } from './geometrie';

// ── Lupe ─────────────────────────────────────────────────────────────────────
/** Lupe: Vergrößerung `s` (1 = ganze Kugel) und Versatz (x, y) in Bildschirm-Einheiten (NDC −1 … 1, y nach oben).
 *  Ein Bildpunkt n (ohne Lupe) steht mit Lupe bei n · s + (x, y). */
export interface Lupe { s: number; x: number; y: number }
export const LUPE_RUHE: Lupe = Object.freeze({ s: 1, x: 0, y: 0 }) as Lupe;
/** Weiter heraus als die ganze Kugel geht es nicht. */
export const LUPE_MIN = 1;
/** So weit hinein, dass einzelne Sterne mit Abstand und lesbarer Größe stehen. */
export const LUPE_MAX = 8;

/** Umriss der Kugel ohne Lupe als NDC-Halbachsen (quer ist die Kugel in NDC schmaler) — hält beim Verschieben die Kugel im Bild. */
export interface KugelUmriss { rx: number; ry: number }

const ohneMinusNull = (v: number) => (v === 0 ? 0 : v);

/**
 * Lupe in ihre Grenzen: Vergrößerung LUPE_MIN … LUPE_MAX; der Ausschnitt verlässt das ursprüngliche Bild nie (bei s = 1 also
 * kein Versatz) und seine Mitte bleibt über der Kugel (Ellipse des Umrisses) — so läuft die Kugel nie ganz aus dem Bild.
 */
export function begrenzeLupe(l: Lupe, umriss?: KugelUmriss): Lupe {
  const s = klemme(Number.isFinite(l.s) ? l.s : 1, LUPE_MIN, LUPE_MAX);
  // Mitte des Ausschnitts im Bild ohne Lupe: c = −(x, y) / s.
  const rand = Math.max(0, 1 - 1 / s);
  let cx = klemme(Number.isFinite(l.x) ? -l.x / s : 0, -rand, rand);
  let cy = klemme(Number.isFinite(l.y) ? -l.y / s : 0, -rand, rand);
  if (umriss && umriss.rx > 0 && umriss.ry > 0) {
    const e = Math.hypot(cx / umriss.rx, cy / umriss.ry);
    if (e > 1) { cx /= e; cy /= e; }
  }
  return { s, x: ohneMinusNull(-cx * s), y: ohneMinusNull(-cy * s) };
}

/** Um `faktor` zoomen; der Bildpunkt `um` (NDC, z. B. unter dem Zeiger) bleibt dabei stehen. */
export function zoomeUm(l: Lupe, faktor: number, um: readonly [number, number] = [0, 0], umriss?: KugelUmriss): Lupe {
  if (!(faktor > 0) || !Number.isFinite(faktor)) return begrenzeLupe(l, umriss);
  const s = klemme(l.s * faktor, LUPE_MIN, LUPE_MAX);
  const k = s / l.s;
  return begrenzeLupe({ s, x: um[0] - (um[0] - l.x) * k, y: um[1] - (um[1] - l.y) * k }, umriss);
}

/** Den Ausschnitt um (dx, dy) CSS-Pixel verschieben (der Inhalt folgt dem Zeiger: rechts/unten positiv). */
export function verschiebeLupe(l: Lupe, dx: number, dy: number, breite: number, hoehe: number, umriss?: KugelUmriss): Lupe {
  return begrenzeLupe({ s: l.s, x: l.x + (2 * dx) / Math.max(1, breite), y: l.y - (2 * dy) / Math.max(1, hoehe) }, umriss);
}

/** Weich zum Ziel (k ≈ Anteil je 1/60 s, unabhängig von der Bildrate); s und Versatz mit demselben Anteil — so bleibt der Punkt
 *  unter dem Zeiger auch unterwegs stehen. Nahe am Ziel rastet es ein (kein endloses Nachzeichnen). */
export function lupeNachziehen(ist: Lupe, ziel: Lupe, dtSek: number, k = 0.25): Lupe {
  const a = 1 - (1 - k) ** (Math.max(0, dtSek) * 60);
  const s = ist.s + (ziel.s - ist.s) * a, x = ist.x + (ziel.x - ist.x) * a, y = ist.y + (ziel.y - ist.y) * a;
  if (Math.abs(ziel.s - s) < 1e-4 && Math.abs(ziel.x - x) < 1e-4 && Math.abs(ziel.y - y) < 1e-4) return ziel;
  return { s, x, y };
}

/** Projektion mit Lupe: P' = L · P (L skaliert und verschiebt in Clip-Koordinaten). Mit LUPE_RUHE genau P. */
export function mitLupe(proj: Mat4, l: Lupe, aus: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++) {
    const w = proj[c * 4 + 3];
    aus[c * 4] = l.s * proj[c * 4] + l.x * w;
    aus[c * 4 + 1] = l.s * proj[c * 4 + 1] + l.y * w;
    aus[c * 4 + 2] = proj[c * 4 + 2];
    aus[c * 4 + 3] = w;
  }
  return aus;
}
/** Bildpunkt ohne Lupe → mit Lupe (NDC). */
export const durchLupe = (l: Lupe, n: readonly [number, number]): [number, number] => [n[0] * l.s + l.x, n[1] * l.s + l.y];
/** Bildpunkt mit Lupe → ohne Lupe (NDC) — für den Zeiger-Strahl. */
export const ohneLupe = (l: Lupe, n: readonly [number, number]): [number, number] => [(n[0] - l.x) / l.s, (n[1] - l.y) / l.s];
/** CSS-Pixel in der Fläche → NDC. */
export const ndcAus = (x: number, y: number, breite: number, hoehe: number): [number, number] => [(x / Math.max(1, breite)) * 2 - 1, 1 - (y / Math.max(1, hoehe)) * 2];
/** Sterne wachsen mit der Lupe — langsamer als der Abstand zwischen ihnen, damit sie sich beim Hineinzoomen trennen. */
export const lupePunkt = (s: number) => Math.max(1, s) ** 0.35;

// ── Rad und Pinch ────────────────────────────────────────────────────────────
/** Zoom-Faktor aus einem Rad-Ereignis mit ctrlKey (Trackpad-Pinch) bzw. ⌘/Strg + Mausrad: kleine Schritte fein, große gedeckelt. */
export function radFaktor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-klemme(Number.isFinite(px) ? px : 0, -50, 50) * 0.01);
}

export type RadArt = 'trackpad' | 'rad';
export interface RadEreignis { deltaX: number; deltaY: number; deltaMode: number; wheelDeltaY?: number; shiftKey?: boolean }
export interface RadStand { art: RadArt | null; zeit: number }
/** Ein Rastschritt des Mausrads in Chrome am Mac (dieselbe Regel nutzt Mapbox GL). */
export const MAUSRAD_RASTER = 4.000244140625;

/**
 * Mausrad oder Trackpad? (Zwei-Finger-Wischen dreht die Kugel, ein Mausrad lässt die Seite rollen.) Sicher erkennbar sind nur
 * einzelne Fälle — Zeilen/Seiten-Modus und Rastschritte = Mausrad, Querbewegung und sehr kleine Schritte = Trackpad; sonst gilt
 * die Art der laufenden Bewegung (< 400 ms seit dem letzten Ereignis) bzw. dicht folgende kleine Schritte = Trackpad.
 * Unklar (`art: null`) heißt: nichts abfangen — lieber rollt die Seite einmal mit, als dass ein Mausrad hängen bleibt.
 */
export function radArt(e: RadEreignis, vorher: RadStand | null, jetzt: number): RadStand {
  const dt = vorher ? jetzt - vorher.zeit : Infinity;
  const laufend = dt < 400 ? vorher?.art ?? null : null;
  const fest = (art: RadArt): RadStand => ({ art, zeit: jetzt });
  if (e.deltaMode !== 0) return fest('rad');
  if (!e.shiftKey && e.deltaX !== 0) return fest('trackpad');
  const v = e.deltaY !== 0 ? e.deltaY : e.deltaX;
  if (v === 0) return { art: laufend, zeit: jetzt };
  if (v % MAUSRAD_RASTER === 0) return fest('rad');
  const w = e.wheelDeltaY;
  if (typeof w === 'number' && w !== 0 && e.deltaY !== 0) {
    if (w === -3 * e.deltaY) return fest('trackpad');
    if (w % 120 === 0) return fest('rad');
  }
  if (Math.abs(v) < 4) return fest('trackpad');
  if (laufend) return fest(laufend);
  if (dt < 400) return fest(Math.abs(dt * v) < 200 ? 'trackpad' : 'rad');
  return { art: null, zeit: jetzt };
}

// ── Drehen und Schwung ───────────────────────────────────────────────────────
/** Die Neigung bleibt diesseits der Pole — sonst kippt die Kugel über Kopf und links/rechts vertauschen sich. */
export const NEIGUNG_GRENZE = 1.35;
export const klemmeNeigung = (n: number) => klemme(n, -NEIGUNG_GRENZE, NEIGUNG_GRENZE);

/** Ziehen in Pixeln → Drehung (rad): die Oberfläche folgt dem Zeiger („die Kugel greifen“); mit Lupe feiner. Rechts/unten positiv. */
export function drehAusPx(dx: number, dy: number, radiusPx: number, s = 1): { g: number; n: number } {
  const r = Math.max(1, radiusPx) * Math.max(1, s);
  return { g: dx / r, n: dy / r };
}

/** Ab so vielen Pixeln Bewegung ist es Ziehen — darunter ein Klick (ein Stern öffnet sich wie bisher). */
export const ZIEH_SCHWELLE = 5;
export const istZiehen = (dx: number, dy: number, schwelle = ZIEH_SCHWELLE) => Math.hypot(dx, dy) >= schwelle;

export interface Probe { t: number; x: number; y: number }
/** Nur die letzten Millisekunden vor dem Loslassen zählen — stand der Zeiger zuletzt still, gibt es keinen Schwung. */
export const SCHWUNG_FENSTER_MS = 90;
/** Höchstens so schnell (px/s) — ein Ausreißer schleudert die Kugel nicht herum. */
export const SCHWUNG_MAX_PX = 3000;
/** Dämpfung je 1/60 s und Ende (rad/s). */
export const SCHWUNG_DAEMPFUNG = 0.06;
export const SCHWUNG_ENDE = 0.02;

/** Geschwindigkeit beim Loslassen (px/s) aus den Zug-Proben. */
export function schwungAus(proben: readonly Probe[], jetzt: number): { x: number; y: number } {
  const neu = proben.filter(p => jetzt - p.t <= SCHWUNG_FENSTER_MS);
  if (neu.length < 2) return { x: 0, y: 0 };
  const a = neu[0], b = neu[neu.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt < 0.004) return { x: 0, y: 0 };
  let x = (b.x - a.x) / dt, y = (b.y - a.y) / dt;
  const v = Math.hypot(x, y);
  if (v > SCHWUNG_MAX_PX) { x *= SCHWUNG_MAX_PX / v; y *= SCHWUNG_MAX_PX / v; }
  return { x, y };
}

/** Schwung klingt ab (unabhängig von der Bildrate); unter SCHWUNG_ENDE ist er vorbei. */
export function schwungAbklingen(v: { g: number; n: number }, dtSek: number, k = SCHWUNG_DAEMPFUNG): { g: number; n: number } {
  const a = (1 - k) ** (Math.max(0, dtSek) * 60);
  const g = v.g * a, n = v.n * a;
  return Math.hypot(g, n) < SCHWUNG_ENDE ? { g: 0, n: 0 } : { g, n };
}

/** Eigendrehung: bremst schnell ab, wenn jemand bedient, und läuft danach sanft wieder an (Anteil 0 … 1). */
export function eigenAnlauf(ist: number, ziel: number, dtSek: number): number {
  const k = ziel > ist ? 0.03 : 0.3;
  const v = ist + (ziel - ist) * (1 - (1 - k) ** (Math.max(0, dtSek) * 60));
  return Math.abs(ziel - v) < 1e-3 ? ziel : v;
}

// ── Tastatur und Hinweis ─────────────────────────────────────────────────────
export type TastenAktion =
  | { art: 'zoom'; faktor: number }
  | { art: 'drehen'; dx: number; dy: number }
  | { art: 'verschieben'; dx: number; dy: number }
  | { art: 'zurueck' };
/** Zoom je Tastendruck und Schritt der Pfeiltasten (in Pixeln wie beim Ziehen). */
export const TASTE_ZOOM = 1.4;
export const TASTE_SCHRITT = 40;

/** Taste → Aktion, wenn die Kugel den Fokus hat: + / − / 0, Pfeile drehen, ⇧ + Pfeil verschiebt. */
export function tasteAktion(taste: string, umschalt = false): TastenAktion | null {
  if (taste === '+' || taste === '=') return { art: 'zoom', faktor: TASTE_ZOOM };
  if (taste === '-' || taste === '_') return { art: 'zoom', faktor: 1 / TASTE_ZOOM };
  if (taste === '0') return { art: 'zurueck' };
  const r: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const p = r[taste];
  if (!p) return null;
  return { art: umschalt ? 'verschieben' : 'drehen', dx: p[0] * TASTE_SCHRITT, dy: p[1] * TASTE_SCHRITT };
}

/** Der kleine Hinweis am Rand — am Mac mit ⌘, sonst Strg, am Handy ohne Tasten. */
export function kameraHinweis(mac: boolean, touch: boolean): string {
  if (touch) return 'Ziehen zum Drehen · zwei Finger zum Zoomen';
  return mac ? 'Ziehen zum Drehen · Pinch oder ⌘ + Scrollen zum Zoomen' : 'Ziehen zum Drehen · Pinch oder Strg + Scrollen zum Zoomen';
}
