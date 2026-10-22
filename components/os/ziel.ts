'use client';

// ─── Ziel aus dem Link — hinspringen und hervorheben ────────────────────────
// Ein Punkt hinter einer Kennzahl verlinkt auf genau einen Eintrag
// (/os/finanzen?s=rechnungen&r=<Rechnung>, …?s=liquiditaet&p=<Posten>). Die Seite
// liest den Parameter, springt nach dem Laden einmal dorthin und hebt den
// Eintrag hervor — so endet ein Klick nie auf einer Liste, in der man suchen muss.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Wert eines Link-Parameters (ohne Suspense-Pflicht: gelesen nach dem ersten Zeichnen). */
export function useZiel(param: string): string | null {
  const [z, setZ] = useState<string | null>(null);
  useEffect(() => { setZ(new URLSearchParams(window.location.search).get(param)); }, [param]);
  return z;
}

/**
 * Springt einmal zum Element `ziel-<id>` (bzw. zum #Anker der Adresse), sobald `bereit` ist. `stand` (22.10. abends, Werkzeug-Menü): ändert sich die
 * Adresse ohne neues Laden der Seite (z. B. Finanzen › „Einstellungen“ bzw. „0-Punkt“ im Menü der Leiste = ein Anker im Cockpit), wird der Anker erneut
 * gesucht. Listen und Karten kommen oft erst nach den Daten — gesucht wird darum einige Male (bis etwa 3 s), dann nicht mehr.
 */
export function useZuZiel(id: string | null, bereit: boolean, stand?: string) {
  const erledigt = useRef<string | null>(null);
  useEffect(() => {
    const anker = !id && typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const schluessel = id ? `ziel-${id}` : anker;
    const merker = `${stand ?? ''}|${schluessel}`;
    if (!schluessel || !bereit || erledigt.current === merker) return;
    let versuche = 0;
    let t = 0;
    const suche = () => {
      const el = document.getElementById(schluessel);
      if (!el) { if (++versuche < 25) t = window.setTimeout(suche, 120); return; }
      erledigt.current = merker;
      el.scrollIntoView({ behavior: 'smooth', block: id ? 'center' : 'start' });
    };
    // Nach dem Zeichnen suchen — Listen kommen oft einen Takt später.
    t = window.setTimeout(suche, 60);
    return () => window.clearTimeout(t);
  }, [id, bereit, stand]);
}

/** Rahmen für den verlinkten Eintrag. */
export const zielRahmen = (aktiv: boolean, farbe: string): CSSProperties =>
  aktiv ? { boxShadow: `0 0 0 1px ${farbe}8C, 0 0 30px -12px ${farbe}66`, background: `${farbe}12`, borderRadius: 12, paddingLeft: 10, paddingRight: 10 } : {};
