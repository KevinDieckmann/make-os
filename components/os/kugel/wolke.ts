// ─── MAKE OS — Kugel: Wolken bauen (rein, 05.10.2026) ───────────────────────
// Aus Punkten auf der Kugel werden die Puffer für den Motor. Rein und deterministisch (fester Zufall) — getestet in
// tests/kugeln.test.ts. Die ZOE-Wolke ist reine Form; die Brain-Wolke (brain-layout.ts) trägt Datensätze.

import { fibonacciKugel, verlaufT, zufall, type Vec3 } from './geometrie';
import type { KugelDaten } from './motor';

/** Punktzahlen der ZOE-Kugel: groß am Rechner (nah an der Vorlage mit 120 k), groß am Handy, klein als Symbol (sparsam). */
export const ZOE_PUNKTE = { gross: 80000, handy: 25000, symbol: 1400 } as const;

/** Die ZOE-Wolke: n Punkte, Größe und Helligkeit leicht gestreut (sonst wirkt es wie ein Gitter). */
export function zoeWolke(n: number, saat = 11): KugelDaten {
  const pos = fibonacciKugel(n, saat);
  const z = zufall(saat * 31 + 5);
  const wert = new Float32Array(n * 4);
  // Viele Punkte addieren sich: die Helligkeit je Punkt sinkt mit der Dichte, damit das Bild gleich hell bleibt.
  const dichte = Math.min(1, Math.max(0.55, Math.sqrt(20000 / n)));
  for (let i = 0; i < n; i++) {
    const p: Vec3 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const fein = z();
    wert[i * 4] = 0.5 + fein * fein * fein * 1.3;  // Größe: meist fein, wenige größere Körner
    wert[i * 4 + 1] = (0.45 + z() * 0.55) * dichte;  // Helligkeit
    wert[i * 4 + 2] = z();                         // Saat (Flackern)
    wert[i * 4 + 3] = verlaufT(p);                 // Verlauf Smaragd → Granat
  }
  return { pos, wert, pickbar: 0 };
}
