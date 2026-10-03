'use client';

// ─── Standard · Bildschirmbreite (Review 03.10.) ─────────────────────────────
// EIN Ort für „Handy?“ und „Spalten?“ — vorher gab es hooks/useHandy.ts, useBreit in schlank.tsx und eigene matchMedia-
// Abfragen in mehreren Bausteinen. Die Grenzen sind dieselben wie die Medienabfragen in app/globals.css.

import { useEffect, useState } from 'react';

/** Handy-Breite (≤ 720 px, wie `@media (max-width: 720px)` in globals.css). */
export const HANDY_BIS = 720;
/** Ab dieser Fensterbreite stehen Spalten nebeneinander (200 px Leiste + ~1000 px Fläche). */
export const SPALTEN_AB = 1180;

/** Trifft die Medienabfrage zu? Live (Drehen, Split View, Fenster ziehen); beim ersten Zeichnen (Server) false. */
export function useMedien(abfrage: string): boolean {
  const [trifft, setTrifft] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(abfrage);
    const lesen = () => setTrifft(mq.matches);
    lesen();
    mq.addEventListener('change', lesen);
    return () => mq.removeEventListener('change', lesen);
  }, [abfrage]);
  return trifft;
}

/** Handy-Breite — für Stellen, die am Handy ANDERS aufgebaut sind (nicht nur kleiner). */
export const useHandy = (): boolean => useMedien(`(max-width: ${HANDY_BIS}px)`);
/** Ist genug Platz für Spalten? Für Ansichten, die sich dann anders verhalten (Lesefenster statt Aufklappen). */
export const useBreit = (): boolean => useMedien(`(min-width: ${SPALTEN_AB}px)`);
