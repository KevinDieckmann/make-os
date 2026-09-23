'use client';

// ─── MAKE OS — Nutzungs-Melder ──────────────────────────────────────────────
// Schreibt leise mit, welche Seite geöffnet wird UND wie lange ihr dort wart.
// Nur Pfad und Dauer — keine Inhalte, keine Texte.
//
// Kevins Ansage: „Die Zeiten hinter den Flächen klar tracken, wie lange wir
// drauf waren — das kommt dann ins Reflexionsmeeting der Woche."
//
// Gezählt wird nur aktive Zeit: wer den Tab in den Hintergrund legt, sammelt
// keine Stunden an. Sonst stünde am Freitag „14 h Finanzen", weil ein Fenster
// offen lag.

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';

/** Unter 8 Sekunden ist Durchklicken, keine Arbeit. */
const MINDEST_MS = 8_000;
/** Über 45 Minuten am Stück ohne Wechsel: da lag das Fenster offen. */
const DECKEL_MS = 45 * 60_000;

export function NutzungsMelder() {
  const pfad = usePathname();
  const seit = useRef<number>(0);
  const aktiv = useRef(true);
  const gesendet = useRef(false);

  useEffect(() => {
    if (!pfad?.startsWith('/os')) return;
    seit.current = Date.now();
    gesendet.current = false;
    aktiv.current = document.visibilityState === 'visible';

    const melden = (dauerMs: number) => {
      if (gesendet.current) return;
      gesendet.current = true;
      const dauer = Math.min(DECKEL_MS, Math.max(0, dauerMs));
      // Wer hier arbeitet, steht im Browser — so wird die Zeit der richtigen
      // Person zugeschrieben, auch wenn beide gleichzeitig drin sind.
      Promise.resolve({ person: personLesen() })
        .then(a => fetch('/api/state/nutzung', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pfad, person: a?.person ?? 'kevin', sekunden: Math.round(dauer / 1000) }),
          keepalive: true,
        }))
        .catch(() => { /* Mitschreiben darf nie stören */ });
    };

    // Pausiert, sobald der Tab in den Hintergrund geht.
    let gesammelt = 0;
    const sichtbarkeit = () => {
      if (document.visibilityState === 'hidden') {
        if (aktiv.current) { gesammelt += Date.now() - seit.current; aktiv.current = false; }
      } else {
        seit.current = Date.now(); aktiv.current = true;
      }
    };
    document.addEventListener('visibilitychange', sichtbarkeit);

    const beimVerlassen = () => {
      const gesamt = gesammelt + (aktiv.current ? Date.now() - seit.current : 0);
      if (gesamt >= MINDEST_MS) melden(gesamt);
    };
    window.addEventListener('pagehide', beimVerlassen);

    return () => {
      document.removeEventListener('visibilitychange', sichtbarkeit);
      window.removeEventListener('pagehide', beimVerlassen);
      beimVerlassen();
    };
  }, [pfad]);

  return null;
}
