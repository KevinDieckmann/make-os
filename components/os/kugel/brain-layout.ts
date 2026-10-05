// ─── MAKE OS — Brain-Kugel: Anordnung (rein, 05.10.2026 · Überarbeitung „Galaxie“) ─
// Jeder Datensatz ein heller Stern auf der Kugel: Cluster je Bereich (feste Himmelsrichtung — man lernt, wo was liegt),
// darin je Art ein Unter-Cluster, darin die Sterne als Sonnenblumen-Spirale (neueste innen). Größe nach Bedeutung
// (Verbindungen) und Aktualität, Helligkeit nach Aktualität. Dazu eine dichte, dunkle Partikel-Hülle („Galaxie“, nur Form, nie
// zeigbar) — sie trägt das Bild auch bei wenig Daten; nahe einem Cluster nimmt sie leise dessen Farbe an (Farbnebel).
// Deterministisch: dieselben Daten ergeben dieselbe Kugel. Farben nur aus KUGEL / KUGEL_BEREICH_FARBE (Token).

import { KUGEL, KUGEL_BEREICH_FARBE } from '@/lib/make-one/design';
import { KUGEL_ARTEN, KUGEL_BEREICHE, type BrainPunkt, type KugelBereich } from '@/lib/brain/kugel';
import { hashZahl, kreuz, norm, alsRgb, klemme, zufall, type Vec3 } from './geometrie';
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
/** Formpunkte der Hülle: Rechner und Handy. Sehr leise — sie sind die Galaxie, nicht die Daten. */
export const HUELLE_PUNKTE = 30000;
export const HUELLE_PUNKTE_HANDY = 12000;
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

/** 0 … 1: Bedeutung aus der Zahl der Verbindungen (ein Kontakt mit 12 Aufgaben leuchtet größer als einer ohne). */
export const bedeutung = (verbindungen: number) => klemme(Math.log2(1 + verbindungen) / 4, 0, 1);

export interface BrainLayout {
  daten: KugelDaten;
  /** Index im Puffer je Punkt-Kennung. */
  index: Map<string, number>;
  /** Punkt-Kennung je Puffer-Index (nur Datenpunkte). */
  ids: string[];
  /** Mitte der sichtbaren Cluster (für Beschriftung und Kamerafahrt). */
  cluster: { bereich: KugelBereich; mitte: Vec3; anzahl: number }[];
}

/** Punkte (schon nach Aktualität sortiert, neueste zuerst) → Puffer für den Motor. `huelle` = Zahl der Formpunkte. */
export function brainLayout(punkte: readonly BrainPunkt[], heute: string, huelle = HUELLE_PUNKTE): BrainLayout {
  const n = punkte.length;
  const pos = new Float32Array((n + huelle) * 3);
  const farbe = new Float32Array((n + huelle) * 3);
  const wert = new Float32Array((n + huelle) * 4);
  const index = new Map<string, number>();
  const ids: string[] = [];

  // Verbindungen je Punkt (beide Richtungen) → Bedeutung.
  const grad = new Map<string, number>();
  for (const p of punkte) for (const l of p.links) { grad.set(p.id, (grad.get(p.id) ?? 0) + 1); grad.set(l, (grad.get(l) ?? 0) + 1); }

  // Gruppen: Bereich → Art → Punkte (Reihenfolge der Eingabe bleibt: neueste zuerst = innen).
  const gruppen = new Map<KugelBereich, Map<string, number[]>>();
  punkte.forEach((p, i) => {
    if (!gruppen.has(p.bereich)) gruppen.set(p.bereich, new Map());
    const g = gruppen.get(p.bereich)!;
    g.set(p.art, [...(g.get(p.art) ?? []), i]);
  });

  const cluster: BrainLayout['cluster'] = [];
  let i = 0;
  for (const bereich of KUGEL_BEREICHE) {
    const g = gruppen.get(bereich);
    if (!g) continue;
    const mitte = BEREICH_MITTE[bereich];
    const arten = KUGEL_ARTEN.filter(a => g.has(a));
    const f = alsRgb(KUGEL_BEREICH_FARBE[bereich]);
    let anzahl = 0;
    arten.forEach((art, j) => {
      const liste = g.get(art)!;
      anzahl += liste.length;
      // Unter-Cluster je Art um die Bereichsmitte; ein einzelner sitzt in der Mitte.
      const c = arten.length === 1 ? mitte : versetzt(mitte, 0.2 + 0.05 * arten.length, (j / arten.length) * Math.PI * 2 + 0.6);
      const radius = klemme(0.05 + 0.014 * Math.sqrt(liste.length), 0.05, 0.62);
      liste.forEach((pi, k) => {
        const p = punkte[pi];
        const zitter = (hashZahl(p.id) % 1000) / 1000;
        const ort = versetzt(c, radius * Math.sqrt((k + 0.5) / liste.length), k * GOLD + zitter * 0.6);
        const fr = frische(p.datum, heute), be = bedeutung(grad.get(p.id) ?? 0);
        // Etwas Tiefe je Stern (0,9 … 1,04): ein Cluster ist eine Wolke, keine Scheibe — von der Seite kein greller Strich.
        const tief = 0.9 + ((hashZahl(`${p.id}#r`) % 1000) / 1000) * 0.14;
        pos.set([ort[0] * tief, ort[1] * tief, ort[2] * tief], i * 3);
        farbe.set(f, i * 3);
        // x Größe (Bedeutung + Aktualität) · y Helligkeit (Aktualität) · z Saat · w = Stern
        wert.set([0.75 + fr * 0.45 + be * 0.8, 0.7 + fr * 0.6, zitter, 1], i * 4);
        index.set(p.id, i);
        ids.push(p.id);
        i++;
      });
    });
    cluster.push({ bereich, mitte, anzahl });
  }
  // Galaxie: Formpunkte im Volumen (nach außen dichter), leise; nahe einem Cluster leise in dessen Farbe (Farbnebel).
  if (huelle) {
    const z = zufall(23);
    const grau = alsRgb(KUGEL.huelle);
    const nebel = cluster.map(c => ({ mitte: c.mitte, f: alsRgb(KUGEL_BEREICH_FARBE[c.bereich]), weite: klemme(0.35 + 0.02 * Math.sqrt(c.anzahl), 0.35, 0.75) }));
    for (let k = 0; k < huelle; k++, i++) {
      // Gleichmäßige Richtung (Kugel-Stichprobe) — ein Drittel als Schleier in Richtung der Cluster gezogen.
      const zz = z() * 2 - 1, w = z() * Math.PI * 2, rr = Math.sqrt(1 - zz * zz);
      let d: Vec3 = [Math.cos(w) * rr, zz, Math.sin(w) * rr];
      if (nebel.length && z() < 0.33) {
        const ziel = nebel[Math.floor(z() * nebel.length)];
        d = versetzt(ziel.mitte, ziel.weite * Math.sqrt(z()), z() * Math.PI * 2);
      }
      const r = 0.42 + 0.58 * Math.sqrt(z());
      pos.set([d[0] * r, d[1] * r, d[2] * r], i * 3);
      // Farbnebel: Anteil der Bereichsfarbe nach Nähe zur Clustermitte.
      let t = 0, nf = grau;
      for (const c of nebel) {
        const naehe = klemme((d[0] * c.mitte[0] + d[1] * c.mitte[1] + d[2] * c.mitte[2] - Math.cos(c.weite)) / (1 - Math.cos(c.weite)), 0, 1);
        if (naehe > t) { t = naehe; nf = c.f; }
      }
      const m = t * 0.75;
      farbe.set([grau[0] + (nf[0] - grau[0]) * m, grau[1] + (nf[1] - grau[1]) * m, grau[2] + (nf[2] - grau[2]) * m], i * 3);
      wert.set([0.3 + z() * 0.25, (0.11 + z() * 0.1) * (0.6 + 0.4 * r) + t * 0.16, z(), 0], i * 4);
    }
  }
  return { daten: { pos: pos.subarray(0, i * 3), farbe: farbe.subarray(0, i * 3), wert: wert.subarray(0, i * 4), pickbar: ids.length }, index, ids, cluster };
}
