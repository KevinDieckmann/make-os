'use client';

// ─── Fulfillment · Sprung innerhalb eines Falls (11.10., Design-Überarbeitung) ──────────────────────────────────────────────────────────
// Der Kopf eines Falls (Phasen-Strahl, Hauptaktion) springt in einen Reiter UND an eine Stelle: eine Phase im Ablauf aufklappen, den Freigabe-
// Dialog öffnen, die Willkommensmail vorbereiten. Steht man schon im Reiter, geht ein Ereignis an die Ansicht; sonst trägt die Adresse den
// Sprung als Anker (`#phase-<id>`, `#freigabe-F3`, `#willkommen`) und die Ansicht liest ihn beim Öffnen. Nur Darstellung — nichts wird gespeichert.

import { useEffect, useRef } from 'react';

export type Sprung = { art: 'phase'; wert: string } | { art: 'freigabe'; wert: string } | { art: 'willkommen' };
const EREIGNIS = 'make-fulfillment-sprung';
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export const sprungAnker = (s: Sprung): string => (s.art === 'willkommen' ? 'willkommen' : `${s.art}-${s.wert}`);

/** Den Anker einer Adresse lesen (ohne „#“ oder mit) — Unbekanntes → null. */
export function sprungAus(anker: string): Sprung | null {
  const a = anker.replace(/^#/, '');
  if (a === 'willkommen') return { art: 'willkommen' };
  const m = /^(phase|freigabe)-(.+)$/.exec(a);
  return m && ID.test(m[2]) ? { art: m[1] as 'phase' | 'freigabe', wert: m[2] } : null;
}

/** In der offenen Ansicht springen (sie hört mit `useSprung`). */
export function springe(s: Sprung): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<Sprung>(EREIGNIS, { detail: s }));
}

/** Auf Sprünge hören — einmal beim Öffnen aus dem Anker der Adresse, danach über das Ereignis. */
export function useSprung(handler: (s: Sprung) => void): void {
  const h = useRef(handler);
  useEffect(() => { h.current = handler; });
  useEffect(() => {
    const aus = sprungAus(window.location.hash);
    if (aus) h.current(aus);
    const hoer = (e: Event) => { const d = (e as CustomEvent<Sprung>).detail; if (d) h.current(d); };
    window.addEventListener(EREIGNIS, hoer);
    return () => window.removeEventListener(EREIGNIS, hoer);
  }, []);
}

/** Eine Stelle sanft ins Bild holen (nach dem Aufklappen). */
export function insBild(id: string): void {
  if (typeof document === 'undefined') return;
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}
