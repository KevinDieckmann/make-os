// ─── MAKE OS — Planung: Rhythmus und Fälligkeit von Routinen ────────────────
// Malin (27.09.): Routinen täglich · 3×/Woche · wöchentlich · monatlich ·
// quartalsweise · halbjährlich · jährlich, mit Fälligkeit „nächstes Mal am“
// (Arzt, Steuererklärung). Gerechnet wird rein auf YYYY-MM-DD — kein
// Zeitzonen-Sprung, kein UTC-Vortag. Monatsende wird geklemmt (31.01. + 1
// Monat = 28./29.02.). Tests: tests/planung-rhythmus.test.ts.

import type { Rhythmus, Routine } from './typen';
import { montagVon, tagePlus } from './zeitraum';

const p = (n: number) => String(n).padStart(2, '0');
const tageImMonat = (y: number, m1: number) => new Date(y, m1, 0).getDate();

/** Monate dazurechnen — Tag auf das Monatsende geklemmt. */
export function monatePlus(tag: string, n: number): string {
  const y = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)), d = Number(tag.slice(8, 10));
  const gesamt = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(gesamt / 12), nm = (gesamt % 12) + 1;
  return `${ny}-${p(nm)}-${p(Math.min(d, tageImMonat(ny, nm)))}`;
}

/** Wann ist eine Routine nach einer Erledigung am Tag `ab` das nächste Mal dran? `null` für 3×/Woche (zählt statt zu terminieren). */
export function naechstesMalNach(r: Rhythmus, ab: string): string | null {
  switch (r) {
    case 'taeglich': return tagePlus(ab, 1);
    case '3x-woche': return null;
    case 'woechentlich': return tagePlus(ab, 7);
    case 'monatlich': return monatePlus(ab, 1);
    case 'quartal': return monatePlus(ab, 3);
    case 'halbjahr': return monatePlus(ab, 6);
    case 'jaehrlich': return monatePlus(ab, 12);
  }
}

export interface Faelligkeit {
  /** Heute dran (auch wenn überfällig)? */
  faellig: boolean;
  /** Der Tag, an dem sie (wieder) dran ist — heute oder früher heißt fällig. */
  naechstes: string;
  ueberfaellig: boolean;
  /** Nur 3×/Woche: wie oft diese Woche schon. */
  dieseWoche?: number;
}

/**
 * Fälligkeit einer Routine für eine Person: `erledigtTage` sind die Tage, an
 * denen diese Person die Routine abgehakt hat (aus ihrem health-log).
 *   täglich       → dran, solange heute nicht abgehakt
 *   3×/Woche      → dran, solange heute nicht abgehakt und diese Woche (Mo–So) < 3×
 *   ab wöchentlich → dran ab `naechstesMal` bzw. Rhythmus nach der letzten Erledigung
 */
export function faelligkeit(r: Pick<Routine, 'rhythmus' | 'naechstesMal'>, erledigtTage: readonly string[], heute: string): Faelligkeit {
  const rh: Rhythmus = r.rhythmus ?? 'taeglich';
  const heuteErledigt = erledigtTage.includes(heute);
  if (rh === 'taeglich') return { faellig: !heuteErledigt, naechstes: heuteErledigt ? tagePlus(heute, 1) : heute, ueberfaellig: false };
  if (rh === '3x-woche') {
    const mo = montagVon(heute), so = tagePlus(mo, 6);
    const dieseWoche = erledigtTage.filter(d => d >= mo && d <= so).length;
    const faellig = !heuteErledigt && dieseWoche < 3;
    return { faellig, naechstes: faellig ? heute : dieseWoche >= 3 ? tagePlus(mo, 7) : tagePlus(heute, 1), ueberfaellig: false, dieseWoche };
  }
  const letzte = erledigtTage.reduce<string | null>((m, d) => (m == null || d > m ? d : m), null);
  const anker = r.naechstesMal && /^\d{4}-\d{2}-\d{2}$/.test(r.naechstesMal) ? r.naechstesMal : undefined;
  const naechstes = letzte && (!anker || letzte >= anker) ? (naechstesMalNach(rh, letzte) ?? heute) : (anker ?? heute);
  return { faellig: naechstes <= heute, naechstes, ueberfaellig: naechstes < heute };
}

/** Der Rhythmus als Wort — für Chips. */
export function rhythmusKurz(r: Rhythmus | undefined): string {
  switch (r ?? 'taeglich') {
    case 'taeglich': return 'täglich';
    case '3x-woche': return '3×/Woche';
    case 'woechentlich': return 'wöchentlich';
    case 'monatlich': return 'monatlich';
    case 'quartal': return 'quartalsweise';
    case 'halbjahr': return 'halbjährlich';
    case 'jaehrlich': return 'jährlich';
  }
}
