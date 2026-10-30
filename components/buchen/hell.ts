// ─── Öffentliche Buchungsseite — heller Stil (29.10.) ─────────────────────
// Die Buchung gehört zum öffentlichen Auftritt, nicht zum OS: dieselbe Bildsprache wie der Innovations-Check und die Website (Papier und
// Tinte, Lavendel nur als Akzent, eine Schrift, kein Leuchten) — Gäste kommen vom Check direkt hierher. Gleiche Namen wie stil.ts (Klar·DARK,
// bleibt für „Angebot anfordern“ und „Abmelden“, die Bausteine des OS einbetten). Alle Farben der Buchung stehen hier und sonst nirgends;
// die Schrift liegt unter public/schriften (buchen.module.css). Eine Spalte am Handy, zwei ab 760 px, große Klickziele, keine fremden Schriften.

import type { CSSProperties } from 'react';
import modul from './buchen.module.css';

/** Klasse für das äußerste Element der Seite (heller Rahmen, Schrift). */
export const seiteKlasse = modul.flaeche;

/** Farben der Gäste-Seite (gleiche Werte wie components/check/check.module.css). Kontrast Text auf Grund ≥ 4,5 : 1. */
export const C = {
  grund: '#F6F4F0',
  flaeche: '#FCFBF9',
  linie: 'rgba(17, 19, 22, .14)',
  ink: '#111316',
  inkDim: '#5F6468',
  inkLeise: '#5F6468',
  gut: '#3F7D5C',
  achtung: '#9A4B12',
  kritisch: '#A1342B',
} as const;
export const SCHRIFT = {
  text: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
  display: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;
export const AKZENT = '#7C3AED';
const GEWAEHLT = '#EFEAFB';

export const seite: CSSProperties = { minHeight: '100vh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, padding: '32px 16px 48px', boxSizing: 'border-box', WebkitFontSmoothing: 'antialiased' };
export const rahmen: CSSProperties = { maxWidth: 880, margin: '0 auto', display: 'grid', gap: 18 };
export const karte: CSSProperties = { background: C.flaeche, border: `1px solid ${C.linie}`, borderRadius: 10, padding: 18, minWidth: 0 };
export const titel: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 28, letterSpacing: '-.025em', margin: 0, lineHeight: 1.12 };
export const leise: CSSProperties = { color: C.inkDim, fontSize: 15, lineHeight: 1.55 };
export const klein: CSSProperties = { color: C.inkLeise, fontSize: 13, lineHeight: 1.5 };
export const feld: CSSProperties = { width: '100%', boxSizing: 'border-box', background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: SCHRIFT.text };
export const label: CSSProperties = { display: 'grid', gap: 6, fontSize: 14, color: C.inkDim };
export function knopf(aktiv = true, leise = false): CSSProperties {
  return {
    border: `1px solid ${leise ? C.linie : C.ink}`, borderRadius: 8, padding: '12px 20px', minHeight: 48, fontSize: 15, fontWeight: 600, fontFamily: SCHRIFT.text,
    cursor: aktiv ? 'pointer' : 'not-allowed', opacity: aktiv ? 1 : 0.5,
    background: leise ? 'transparent' : C.ink, color: leise ? C.ink : C.grund,
  };
}
export function chip(gewaehlt: boolean): CSSProperties {
  return {
    border: `1px solid ${gewaehlt ? AKZENT : C.linie}`, background: gewaehlt ? GEWAEHLT : 'transparent', color: gewaehlt ? C.ink : C.inkDim,
    borderRadius: 8, padding: '10px 12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SCHRIFT.text,
  };
}

export { tagText, zeitText } from './stil';
