'use client';

// ─── Fulfillment · Sprung innerhalb eines Falls (11.10., Design-Überarbeitung) ──────────────────────────────────────────────────────────
// Der Kopf eines Falls (Phasen-Strahl, Hauptaktion) springt in einen Reiter UND an eine Stelle: eine Phase im Ablauf aufklappen, den Freigabe-
// Dialog öffnen, die Willkommensmail vorbereiten. Steht man schon im Reiter, geht ein Ereignis an die Ansicht; sonst trägt die Adresse den
// Sprung als Anker (`#phase-<id>`, `#freigabe-F3`, `#willkommen`) und die Ansicht liest ihn beim Öffnen. Nur Darstellung — nichts wird gespeichert.

import { useEffect, useRef } from 'react';

export type Sprung = { art: 'phase'; wert: string } | { art: 'freigabe'; wert: string } | { art: 'willkommen' } | { art: 'stelle'; wert: string };
const EREIGNIS = 'make-fulfillment-sprung';
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export const sprungAnker = (s: Sprung): string => (s.art === 'willkommen' ? 'willkommen' : `${s.art}-${s.wert}`);
/** 12.10.: eine Stelle in einem Reiter (Karte mit dieser `id`) — z. B. die Quick Wins im Überblick, der Wirkungsbericht unter „Abschluss & Kreislauf“. */
export const STELLE = /^[a-z][a-z0-9-]{0,60}$/;

/** Den Anker einer Adresse lesen (ohne „#“ oder mit) — Unbekanntes → null. */
export function sprungAus(anker: string): Sprung | null {
  const a = anker.replace(/^#/, '');
  if (a === 'willkommen') return { art: 'willkommen' };
  const st = /^stelle-(.+)$/.exec(a);
  if (st) return STELLE.test(st[1]) ? { art: 'stelle', wert: st[1] } : null;
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

/** Eine Stelle sanft ins Bild holen (nach dem Aufklappen). Steht sie noch nicht da (Ansicht lädt), noch ein paar Mal versuchen (≤ 2 s). */
export function insBild(id: string): void {
  if (typeof document === 'undefined') return;
  let n = 0;
  const versuch = () => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (++n < 25) setTimeout(versuch, 80);
  };
  setTimeout(versuch, 60);
}

/** Auf Sprünge zu einer Stelle hören (`#stelle-<id>`) — für Reiter ohne eigene Sprung-Logik. */
export function useStellenSprung(): void {
  useSprung(s => { if (s.art === 'stelle') insBild(s.wert); });
}
