'use client';

// ─── MAKE OS — verzögertes Speichern ────────────────────────────────────────
// An dreizehn Stellen stand der Speicher-Timer INNERHALB eines State-Updaters
// (`setX(prev => { … setTimeout(fetch) … })`). Zwei Dinge stimmen daran nicht:
//
// 1. React darf einen Updater mehrfach aufrufen. Alles, was dabei nach außen
//    wirkt — fetch, Timer —, gehört deshalb nicht hinein.
// 2. Der Timer lief weiter, wenn man die Seite vorher verließ. Dann schrieb
//    eine Seite, die es nicht mehr gab.
//
// Beides löst dieser Baustein: planen statt sofort schreiben, und beim
// Verlassen der Seite wird ein noch offener Schreibvorgang abgebrochen.

import { useCallback, useEffect, useRef } from 'react';

export function useNachspeichern<T>(speichern: (wert: T) => void, ms = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Immer die frischeste Fassung aufrufen, ohne den Aufruf neu zu erzeugen.
  const fn = useRef(speichern);
  useEffect(() => { fn.current = speichern; });
  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback((wert: T) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn.current(wert), ms);
  }, [ms]);
}
