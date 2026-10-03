'use client';
// Handy-Breite (≤ 720 px, wie die Medienabfragen in globals.css), live — für Stellen, die am Handy ANDERS aufgebaut sind (nicht nur kleiner).
import { useEffect, useState } from 'react';

export function useHandy(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 720px)');
    const lesen = () => setH(m.matches);
    lesen();
    m.addEventListener('change', lesen);
    return () => m.removeEventListener('change', lesen);
  }, []);
  return h;
}
