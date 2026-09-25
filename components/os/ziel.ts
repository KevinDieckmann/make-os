'use client';

// ─── Ziel aus dem Link — hinspringen und hervorheben ────────────────────────
// Ein Punkt hinter einer Kennzahl verlinkt auf genau einen Eintrag
// (/os/finanzen/planung?r=<Rechnung>, …/liquiditaet?p=<Posten>). Die Seite
// liest den Parameter, springt nach dem Laden einmal dorthin und hebt den
// Eintrag hervor — so endet ein Klick nie auf einer Liste, in der man suchen muss.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Wert eines Link-Parameters (ohne Suspense-Pflicht: gelesen nach dem ersten Zeichnen). */
export function useZiel(param: string): string | null {
  const [z, setZ] = useState<string | null>(null);
  useEffect(() => { setZ(new URLSearchParams(window.location.search).get(param)); }, [param]);
  return z;
}

/** Springt einmal zum Element `ziel-<id>` (bzw. zum #Anker der Adresse), sobald `bereit` ist. */
export function useZuZiel(id: string | null, bereit: boolean) {
  const erledigt = useRef<string | null>(null);
  useEffect(() => {
    const anker = !id && typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const schluessel = id ? `ziel-${id}` : anker;
    if (!schluessel || !bereit || erledigt.current === schluessel) return;
    // Nach dem Zeichnen suchen — Listen kommen oft einen Takt später.
    const t = window.setTimeout(() => {
      const el = document.getElementById(schluessel);
      if (!el) return;
      erledigt.current = schluessel;
      el.scrollIntoView({ behavior: 'smooth', block: id ? 'center' : 'start' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [id, bereit]);
}

/** Rahmen für den verlinkten Eintrag. */
export const zielRahmen = (aktiv: boolean, farbe: string): CSSProperties =>
  aktiv ? { boxShadow: `0 0 0 1px ${farbe}8C, 0 0 30px -12px ${farbe}66`, background: `${farbe}12`, borderRadius: 12, paddingLeft: 10, paddingRight: 10 } : {};
