'use client';

// ─── MAKE OS — Der Atem ─────────────────────────────────────────────────────
// Eine Zahl, die sich fortlaufend bewegt, plus eine Maus-Parallaxe.
//
// Warum das ein Hook ist und keine CSS-Animation: CSS kann einen Kreis
// pulsieren lassen, aber nicht zwei Ringe unterschiedlich schnell atmen und
// dabei auf die Lautstärke reagieren. Sobald mehrere Ebenen ZUSAMMEN leben
// sollen, braucht es eine gemeinsame Uhr.
//
// Läuft über requestAnimationFrame, aber der Zustand wird bewusst nur ~20 mal
// je Sekunde nach React gereicht: die Bewegung entsteht im SVG durch
// Interpolation, nicht durch 60 Renderdurchläufe. Sonst kostet ein ruhig
// atmender Bildschirm dauerhaft Rechenzeit.

import { useEffect, useRef, useState } from 'react';

export interface Atem {
  /** Sekunden seit dem Öffnen — die gemeinsame Uhr aller Ebenen. */
  zeit: number;
  /** Maus, von -1 bis 1 je Achse, geglättet. */
  maus: { x: number; y: number };
  /** Respektiert der Nutzer-Rechner reduzierte Bewegung? */
  ruhig: boolean;
}

/** Zufälliger Startpunkt der Uhr. Ohne ihn sieht jeder Seitenaufbau exakt
 *  gleich aus — und genau das verrät die Maschine. Mit ihm steht das Hirn
 *  jedes Mal an einer anderen Stelle seiner Bewegung. */
const VERSATZ = Math.random() * 240;

export function useAtem(): Atem {
  const [zeit, setZeit] = useState(0);
  const [maus, setMaus] = useState({ x: 0, y: 0 });
  const [ruhig, setRuhig] = useState(false);
  const ziel = useRef({ x: 0, y: 0 });
  const jetzt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setRuhig(m.matches);
    const hoere = () => setRuhig(m.matches);
    m.addEventListener('change', hoere);
    return () => m.removeEventListener('change', hoere);
  }, []);

  useEffect(() => {
    if (ruhig) return;

    // Parallaxe nur, wo es einen echten Zeiger gibt. Auf einem Tablet
    // erzeugt jeder Fingertipp sonst einen Sprung des ganzen Bildes.
    const zeigerGeraet = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const zeiger = (e: PointerEvent) => {
      ziel.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    if (zeigerGeraet) window.addEventListener('pointermove', zeiger, { passive: true });

    const start = performance.now();
    let bild = 0;
    let letzteMeldung = 0;
    const takt = (t: number) => {
      // Maus nachziehen — träge, damit es sich schwer anfühlt statt nervös.
      jetzt.current.x += (ziel.current.x - jetzt.current.x) * 0.045;
      jetzt.current.y += (ziel.current.y - jetzt.current.y) * 0.045;
      if (t - letzteMeldung > 50) {
        letzteMeldung = t;
        setZeit(VERSATZ + (t - start) / 1000);
        setMaus({
          x: Math.round(jetzt.current.x * 1000) / 1000,
          y: Math.round(jetzt.current.y * 1000) / 1000,
        });
      }
      bild = requestAnimationFrame(takt);
    };
    bild = requestAnimationFrame(takt);

    // Im Hintergrundtab läuft sonst die ganze Rechnerei weiter. Der Browser
    // drosselt requestAnimationFrame zwar, aber nicht überall gleich —
    // besser selbst anhalten.
    const sichtbar = () => {
      if (document.hidden) { cancelAnimationFrame(bild); }
      else { letzteMeldung = 0; bild = requestAnimationFrame(takt); }
    };
    document.addEventListener('visibilitychange', sichtbar);

    return () => {
      cancelAnimationFrame(bild);
      document.removeEventListener('visibilitychange', sichtbar);
      window.removeEventListener('pointermove', zeiger);
    };
  }, [ruhig]);

  return { zeit, maus, ruhig };
}

/**
 * Einen Wert weich nachziehen, getaktet von der gemeinsamen Uhr.
 *
 * Warum das gebraucht wird: ein harter Wechsel zwischen zwei Zuständen liest
 * sich wie ein ausgetauschtes Bild. Ein Übergang über eine knappe halbe
 * Sekunde liest sich wie dasselbe Wesen in einer anderen Verfassung. Genau
 * dieser Unterschied entscheidet, ob der Empfang lebendig wirkt.
 *
 * Kein eigener Bildtakt: der Schritt hängt an `zeit` aus useAtem. Der
 * Vergleich mit dem letzten Zeitwert sorgt zugleich dafür, dass ein doppelter
 * Renderdurchlauf (React im Entwicklungsmodus) nicht doppelt zieht.
 */
export function useNachziehen(ziel: number, zeit: number, faktor = 0.2): number {
  const jetzt = useRef(ziel);
  const letzte = useRef(zeit);
  if (zeit !== letzte.current) {
    letzte.current = zeit;
    jetzt.current += (ziel - jetzt.current) * faktor;
  }
  return Math.round(jetzt.current * 1000) / 1000;
}
