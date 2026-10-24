// ─── Standard · Fläche — die Kamera einer unendlichen Zeichenfläche, reine Rechnung (17.10.) ─────────────────────────────────────────────
// Rückmeldung 17.10. (Prozess-Editor): „freie Fläche … zoomen und schieben“ — wie am MacBook (Pinch, ⌘ + Scrollen, zwei Finger). Ohne DOM (läuft in den
// Tests): ein Bildpunkt der Fläche (Welt) steht auf dem Bildschirm bei Welt · s + (x, y). Zoom zum Punkt unter dem Zeiger (er bleibt stehen — dieselbe Regel
// wie die Lupe der Brain-Kugel, components/os/kugel/steuerung.ts `zoomeUm`, nur ohne Kugel-Grenzen), Verschieben, „Alles zeigen“, Raster.
// Rad- und Pinch-Erkennung kommen unverändert von der Kugel (`radFaktor`, `radArt`, `istZiehen`) — siehe ./eingabe.ts.

import { einpassen, type Raender } from '@/lib/einpassen';

export interface Kamera { s: number; x: number; y: number }
export interface Rechteck { x: number; y: number; b: number; h: number }

/** So weit hinaus bzw. hinein geht es (15 % … 250 %). */
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 2.5;
/** Zoom je Knopfdruck bzw. Taste + / −. */
export const ZOOM_SCHRITT = 1.25;
export const KAMERA_RUHE: Readonly<Kamera> = Object.freeze({ s: 1, x: 0, y: 0 });

const klemme = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const endlich = (k: Kamera): Kamera => ({ s: Number.isFinite(k.s) && k.s > 0 ? k.s : 1, x: Number.isFinite(k.x) ? k.x : 0, y: Number.isFinite(k.y) ? k.y : 0 });

/** Um `faktor` zoomen; der Bildschirmpunkt (px, py) bleibt dabei stehen. Der Zoom bleibt in ZOOM_MIN … ZOOM_MAX. */
export function zoomUm(k0: Kamera, faktor: number, px: number, py: number): Kamera {
  const k = endlich(k0);
  if (!(faktor > 0) || !Number.isFinite(faktor)) return k;
  const s = klemme(k.s * faktor, ZOOM_MIN, ZOOM_MAX);
  const f = s / k.s;
  return { s, x: px - (px - k.x) * f, y: py - (py - k.y) * f };
}

/** Um (dx, dy) Bildschirm-Pixel verschieben (der Inhalt folgt dem Zeiger). */
export const verschiebe = (k: Kamera, dx: number, dy: number): Kamera => ({ s: k.s, x: k.x + dx, y: k.y + dy });

/** Bildschirm → Welt. */
export const weltAus = (k: Kamera, sx: number, sy: number): [number, number] => [(sx - k.x) / k.s, (sy - k.y) / k.s];
/** Welt → Bildschirm. */
export const bildAus = (k: Kamera, wx: number, wy: number): [number, number] => [wx * k.s + k.x, wy * k.s + k.y];

/**
 * Die Kamera, die das Rechteck (Welt) mit Rand in die Bühne (breite × hoehe) setzt — höchstens `max` (Vorgabe 100 %, nie größer als der Inhalt). `raender`
 * (Feinschliff 1, 23.10.): was schwebende Leisten an den Seiten verdecken (./schwebe.ts misst sie) — eingepasst wird dann ins freie Feld. EINE Rechnung mit der
 * Werkstatt: lib/einpassen.ts `einpassen`.
 */
export function allesZeigen(r: Rechteck, breite: number, hoehe: number, rand = 40, max = 1, raender?: Raender): Kamera {
  return einpassen(r, { b: breite, h: hoehe }, { raender, rand, min: ZOOM_MIN, max: klemme(max, ZOOM_MIN, ZOOM_MAX) });
}

/** Die Kamera als SVG-Transform der Welt-Gruppe. */
export const transformVon = (k: Kamera) => `translate(${k.x} ${k.y}) scale(${k.s})`;

/** Weich zum Ziel (Anteil 0 … 1, z. B. eine Kurve über die Zeit) — für „Alles zeigen“ ohne Sprung; bei reduzierter Bewegung gleich das Ziel. */
export const zwischen = (a: Kamera, b: Kamera, t: number): Kamera => {
  const u = klemme(t, 0, 1);
  return { s: a.s + (b.s - a.s) * u, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
};
/** Die Kurve dazu (sanft an, sanft aus). */
export const sanft = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Auf das Raster legen (an) bzw. nur runden (aus). */
export const einrasten = (v: number, raster: number, an: boolean) => (an && raster > 0 ? Math.round(v / raster) * raster : Math.round(v));

/** Der kleine Hinweis am Rand — am Mac mit ⌘, sonst Strg, am Handy ohne Tasten. */
export function flaecheHinweis(mac: boolean, touch: boolean, bearbeiten: boolean): string {
  if (touch) return 'Zwei Finger: zoomen und schieben';
  const zoom = mac ? 'Pinch oder ⌘ + Scrollen zoomt' : 'Pinch oder Strg + Scrollen zoomt';
  return `${zoom} · Leertaste + Ziehen oder zwei Finger verschieben${bearbeiten ? ' · Doppelklick bearbeitet' : ''}`;
}
