'use client';

// ─── Werkzeug-Muster — die eigene Spalte eines Werkzeugs IN der Leiste (22.10. abends, Gruppe B; lib/make-one/werkzeuge.ts `spalte`) ─────────────────
// Entscheidung 22.10. abends: nie zwei linke Spalten nebeneinander. Der Kalender hat links seine Spalte (Mini-Monat, Sicht und Kalender, Planen-Bausteine, Karten); mit dem
// Werkzeug-Menü wird daraus EINE Spalte: die Leiste zeigt oben das Menü und darunter einen Ort (`WerkzeugSpalteZiel`), in den die Seite ihre Spalte legt
// (`useWerkzeugSpalte` → createPortal). Gibt es den Ort nicht (Handy, schmal, eingeklappte Leiste), legt die Seite ihre Spalte wie bisher selbst hin.
// Die Seite meldet, ob sie gerade etwas hineinlegt (`spalteBelegen`) — nur dann wird die Leiste breiter.

import { useEffect, useState, useSyncExternalStore } from 'react';

let knoten: HTMLElement | null = null;
let belegt = false;
const hoerer = new Set<() => void>();
const melden = () => { for (const h of hoerer) h(); };
const abonnieren = (h: () => void) => { hoerer.add(h); return () => { hoerer.delete(h); }; };

/** Breite der Leiste, solange eine Spalte darin steht (Kalender-Spalte bisher 280 px + Rand der Leiste). */
export const SPALTE_BREITE = 312;

/** Der Ort in der Leiste (unter dem Menü). */
export function WerkzeugSpalteZiel() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    knoten = el; melden();
    return () => { if (knoten === el) { knoten = null; melden(); } };
  }, [el]);
  return <div ref={setEl} data-werkzeug-spalte="" style={{ display: 'grid', minWidth: 0, marginTop: 10 }} />;
}

/** Der Ort, wenn die Leiste ihn gerade zeigt — sonst null (dann legt die Seite ihre Spalte selbst hin). */
export function useWerkzeugSpalte(): HTMLElement | null {
  return useSyncExternalStore(abonnieren, () => knoten, () => null);
}

/** Legt die Seite gerade etwas in die Spalte? (Leiste: breiter.) */
export function useSpalteBelegt(): boolean {
  return useSyncExternalStore(abonnieren, () => belegt, () => false);
}
/** Die Seite meldet, ob ihre Spalte in der Leiste steht und offen ist. */
export function spalteBelegen(an: boolean): void {
  if (belegt === an) return;
  belegt = an; melden();
}
