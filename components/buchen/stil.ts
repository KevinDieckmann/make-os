// ─── Öffentliche Buchungsseite — Stil (29.09., Paket K4) ─────────────────────
// Klar·DARK wie MAKE OS (Token aus lib/make-one/design.ts), aber ohne die Bauteile des OS — die Seite ist für Gäste:
// eine Spalte am Handy, zwei ab 760 px, große Klickziele, keine fremden Schriften oder Bilder.

import type { CSSProperties } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';

export { C, SCHRIFT };
export const AKZENT = '#21B5AA';

export const seite: CSSProperties = { minHeight: '100vh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, padding: '32px 16px 48px', boxSizing: 'border-box' };
export const rahmen: CSSProperties = { maxWidth: 880, margin: '0 auto', display: 'grid', gap: 18 };
export const karte: CSSProperties = { background: C.flaeche, borderRadius: 16, padding: 18, boxShadow: '0 12px 40px rgba(0,0,0,.35)', minWidth: 0 };
export const titel: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', margin: 0, lineHeight: 1.15 };
export const leise: CSSProperties = { color: C.inkDim, fontSize: 14, lineHeight: 1.55 };
export const klein: CSSProperties = { color: C.inkLeise, fontSize: 12.5, lineHeight: 1.5 };
export const feld: CSSProperties = { width: '100%', boxSizing: 'border-box', background: C.grund, color: C.ink, border: `1px solid ${C.linie}`, borderRadius: 10, padding: '11px 12px', fontSize: 16, fontFamily: SCHRIFT.text, outline: 'none' };
export const label: CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: C.inkDim };
export function knopf(aktiv = true, leise = false): CSSProperties {
  return {
    border: leise ? `1px solid ${C.linie}` : 'none', borderRadius: 12, padding: '12px 18px', minHeight: 44, fontSize: 15, fontWeight: 700, fontFamily: SCHRIFT.text,
    cursor: aktiv ? 'pointer' : 'not-allowed', opacity: aktiv ? 1 : 0.55,
    background: leise ? 'transparent' : `linear-gradient(180deg, ${AKZENT}, #178C84)`, color: leise ? C.ink : '#061312',
  };
}
export function chip(gewaehlt: boolean): CSSProperties {
  return {
    border: `1px solid ${gewaehlt ? AKZENT : C.linie}`, background: gewaehlt ? 'rgba(33,181,170,.16)' : 'transparent', color: gewaehlt ? C.ink : C.inkDim,
    borderRadius: 10, padding: '10px 12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SCHRIFT.text, fontVariantNumeric: 'tabular-nums',
  };
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** Berliner Tag „YYYY-MM-DD“ → „Mi, 01.10.“ (ohne Zeitzonen-Rechnung — der Tag ist schon Berliner Wandzeit). */
export const tagText = (tag: string, mitJahr = false) => `${WD[new Date(`${tag}T12:00:00Z`).getUTCDay()]}, ${tag.slice(8, 10)}.${tag.slice(5, 7)}.${mitJahr ? tag.slice(0, 4) : ''}`;
/** „Mi, 01.10.2026 · 10:00–10:30 Uhr“ */
export const zeitText = (start: string, ende: string) => `${tagText(start.slice(0, 10), true)} · ${start.slice(11, 16)}–${ende.slice(11, 16)} Uhr`;
