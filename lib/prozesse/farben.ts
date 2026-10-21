// ─── Prozesse — die Töne der Landkarte (Etappe A, 21.10.; ANALYSE_100.md Punkt 26) ──────────────────────────────────────────────────────────
// Farben NUR aus den Token (lib/make-one/design.ts) — keine Literale in den Ansichten. Die Farbe trägt nie allein: jede Stufe steht zusätzlich als Wort
// über ihrer Spalte, jede Kachel trägt ihren Titel, eine Zahl immer mit Wort, „hängt“ immer mit Zeichen. Kontrast ≥ 3:1 gegen den Grund (Grafik,
// WCAG 1.4.11) und Text auf der getönten Kachel ≥ 4,5:1 — Wächter tests/prozesse-modell.test.ts.

import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import type { Band, KernStufe } from './typen';

/** Je Stufe der Fliege ein Ton (der Knoten „Übergabe“ im Akzent der Instanz — dort, wo „Hier“ im Flow steht). */
export const STUFE_FARBE: Readonly<Record<KernStufe, string>> = {
  marketing: LEUCHT.beziehung,
  sales: LEUCHT.business,
  uebergabe: C.aktiv,
  fulfillment: LEUCHT.puls,
  ausbau: LEUCHT.agenten,
};
/** Führung und Unterstützung bleiben ruhig. */
export const BAND_FARBE: Readonly<Record<Exclude<Band, 'kern'>, string>> = { fuehrung: C.inkDim, unterstuetzung: C.inkDim };

export const tonVon = (p: { band: Band; stufe?: KernStufe }): string => (p.band === 'kern' ? STUFE_FARBE[p.stufe ?? 'fulfillment'] : BAND_FARBE[p.band]);
