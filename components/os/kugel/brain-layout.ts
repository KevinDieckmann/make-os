// ─── MAKE OS — Brain-Kugel: Anordnung der Datenpunkte (rein, 05.10.2026) ─────
// Jeder Datensatz ein Punkt auf der Kugel: Cluster je Bereich (feste Himmelsrichtung — man lernt, wo was liegt), darin
// je Art ein Unter-Cluster, darin die Punkte als Sonnenblumen-Spirale (neueste innen). Größe und Helligkeit nach
// Aktualität. Dazu eine leise Hülle (nur Form, nie zeigbar), damit wenige Punkte noch als Kugel lesbar sind.
// Deterministisch: dieselben Daten ergeben dieselbe Kugel. Farben nur aus KUGEL_BEREICH_FARBE (Token).

import { KUGEL, KUGEL_BEREICH_FARBE } from '@/lib/make-one/design';
import { KUGEL_ARTEN, KUGEL_BEREICHE, type BrainPunkt, type KugelBereich } from '@/lib/brain/kugel';
import { fibonacciKugel, hashZahl, kreuz, norm, alsRgb, klemme, type Vec3 } from './geometrie';
import type { KugelDaten } from './motor';

/** Feste Mitte je Bereich (Einheitsvektor): Markttraktion vorne links, Ziele & Aufgaben vorne rechts, Kalender oben,
 *  Wissen hinten, Unternehmen unten. */
export const BEREICH_MITTE: Record<KugelBereich, Vec3> = {
  markttraktion: norm([-0.78, 0.12, 0.62]),
  planung: norm([0.78, 0.08, 0.62]),
  kalender: norm([0.05, 0.9, -0.2]),
  wissen: norm([0, -0.05, -1]),
  unternehmen: norm([0.05, -0.92, 0.3]),
};
export const HUELLE_PUNKTE = 1100;
const GOLD = Math.PI * (3 - Math.sqrt(5));

/** Tangentialbasis an c. */
function basis(c: Vec3): [Vec3, Vec3] {
  const hilfs: Vec3 = Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(kreuz(hilfs, c));
  return [u, kreuz(c, u)];
}
/** Von c aus um `winkel` (Bogenmaß auf der Kugel) in Richtung `theta` gehen. */
export function versetzt(c: Vec3, winkel: number, theta: number): Vec3 {
  const [u, v] = basis(c);
  const s = Math.sin(winkel), k = Math.cos(winkel);
  return norm([
    c[0] * k + (u[0] * Math.cos(theta) + v[0] * Math.sin(theta)) * s,
    c[1] * k + (u[1] * Math.cos(theta) + v[1] * Math.sin(theta)) * s,
    c[2] * k + (u[2] * Math.cos(theta) + v[2] * Math.sin(theta)) * s,
  ]);
}

/** 0 … 1: wie frisch ein Datum ist (Halbwertszeit ~ 3 Monate; Künftiges zählt als frisch, ohne Datum leise). */
export function frische(datum: string | null, heute: string): number {
  if (!datum) return 0.15;
  const tage = (Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${datum}T12:00:00Z`)) / 864e5;
  if (!Number.isFinite(tage)) return 0.15;
  return tage <= 0 ? 1 : Math.exp(-tage / 130);
}

export interface BrainLayout { daten: KugelDaten; /** Index im Puffer je Punkt-Kennung. */ index: Map<string, number>; /** Punkt-Kennung je Puffer-Index (nur Datenpunkte). */ ids: string[] }

/** Punkte (schon nach Aktualität sortiert, neueste zuerst) → Puffer für den Motor. */
export function brainLayout(punkte: readonly BrainPunkt[], heute: string, mitHuelle = true): BrainLayout {
  const n = punkte.length;
  const huelle = mitHuelle ? HUELLE_PUNKTE : 0;
  const pos = new Float32Array((n + huelle) * 3);
  const farbe = new Float32Array((n + huelle) * 3);
  const wert = new Float32Array((n + huelle) * 4);
  const index = new Map<string, number>();
  const ids: string[] = [];

  // Gruppen: Bereich → Art → Punkte (Reihenfolge der Eingabe bleibt: neueste zuerst = innen).
  const gruppen = new Map<KugelBereich, Map<string, number[]>>();
  punkte.forEach((p, i) => {
    if (!gruppen.has(p.bereich)) gruppen.set(p.bereich, new Map());
    const g = gruppen.get(p.bereich)!;
    g.set(p.art, [...(g.get(p.art) ?? []), i]);
  });

  let i = 0;
  for (const bereich of KUGEL_BEREICHE) {
    const g = gruppen.get(bereich);
    if (!g) continue;
    const mitte = BEREICH_MITTE[bereich];
    const arten = KUGEL_ARTEN.filter(a => g.has(a));
    const f = alsRgb(KUGEL_BEREICH_FARBE[bereich]);
    arten.forEach((art, j) => {
      const liste = g.get(art)!;
      // Unter-Cluster je Art um die Bereichsmitte; ein einzelner sitzt in der Mitte.
      const c = arten.length === 1 ? mitte : versetzt(mitte, 0.2 + 0.05 * arten.length, (j / arten.length) * Math.PI * 2 + 0.6);
      const radius = klemme(0.05 + 0.014 * Math.sqrt(liste.length), 0.05, 0.62);
      liste.forEach((pi, k) => {
        const p = punkte[pi];
        const zitter = (hashZahl(p.id) % 1000) / 1000;
        const ort = versetzt(c, radius * Math.sqrt((k + 0.5) / liste.length), k * GOLD + zitter * 0.6);
        const fr = frische(p.datum, heute);
        pos.set(ort, i * 3);
        farbe.set(f, i * 3);
        wert.set([0.8 + fr * 0.7, 0.5 + fr * 0.5, zitter, 0.5], i * 4);
        index.set(p.id, i);
        ids.push(p.id);
        i++;
      });
    });
  }
  // Leise Hülle — Form, keine Daten, nie zeigbar (liegt hinter `pickbar`).
  if (huelle) {
    const h = fibonacciKugel(huelle, 23);
    const f = alsRgb(KUGEL.huelle);
    for (let k = 0; k < huelle; k++, i++) {
      pos.set([h[k * 3], h[k * 3 + 1], h[k * 3 + 2]], i * 3);
      farbe.set(f, i * 3);
      wert.set([0.42, 0.16, (k * 0.618) % 1, 0.5], i * 4);
    }
  }
  return { daten: { pos: pos.subarray(0, i * 3), farbe: farbe.subarray(0, i * 3), wert: wert.subarray(0, i * 4), pickbar: ids.length }, index, ids };
}
