// ─── MAKE OS — Kugel: Wolken bauen (rein, 05.10.2026) ───────────────────────
// Aus Punkten auf der Kugel werden die Puffer für den Motor. Rein und deterministisch (fester Zufall) — getestet in
// tests/kugeln.test.ts. Die ZOE-Wolke ist reine Form; die Brain-Wolke (brain-layout.ts) trägt Datensätze.

import { fibonacciKugel, verlaufT, zufall, type Vec3 } from './geometrie';
import type { KugelDaten } from './motor';

/** Punktzahlen der ZOE-Kugel: groß am Rechner, groß am Handy, klein als Symbol. Bewusst weit unter der Vorlage (120 k). */
export const ZOE_PUNKTE = { gross: 14000, handy: 7000, symbol: 900 } as const;

/** Die ZOE-Wolke: n Punkte, Größe und Helligkeit leicht gestreut (sonst wirkt es wie ein Gitter). */
export function zoeWolke(n: number, saat = 11): KugelDaten {
  const pos = fibonacciKugel(n, saat);
  const z = zufall(saat * 31 + 5);
  const wert = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const p: Vec3 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const fein = z();
    wert[i * 4] = 0.55 + fein * fein * 0.9;        // Größe: meist fein, wenige größere Körner
    wert[i * 4 + 1] = 0.45 + z() * 0.45;           // Helligkeit
    wert[i * 4 + 2] = z();                         // Saat (Flackern)
    wert[i * 4 + 3] = verlaufT(p);                 // Verlauf Smaragd → Granat
  }
  return { pos, wert, pickbar: 0 };
}
