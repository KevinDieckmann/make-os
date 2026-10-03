// ─── Lichtfäden v2 — Engstellen: wo laufen zu viele Stränge zusammen? (03.10.2026, rein) ─
// Kevin: „Ein Werkzeug, was nachher Fokus anzeigt, weil extrem viele Stränge zusammenlaufen.“ Eine ENGSTELLE ist eine
// Woche (ab der laufenden), in der die Last der Ansicht deutlich über ihrem eigenen Mittel liegt — oder in der viele
// Bündel gleichzeitig fällig sind. Sie trägt einen Satz („KW 44: 3 Ziele · 9 Fristen · 4 Termine“) und die schwersten
// Stränge dahinter (mit Link, private der anderen Person nur als „Belegt“ — das regelt schon die Route).
//
// Regel (deterministisch, Tests: tests/lichtfaeden-fokus.test.ts):
//   Last(w)  = Summe der Gewichte aller Stränge der Ansicht in Woche w (überfällige zählen in der Woche von heute).
//   Schwelle = max(SCHWELLE_MIN, Mittel + SCHWELLE_SIGMA · Streuung) über die Wochen ab heute mit Last > 0.
//   Engstelle, wenn Last ≥ Schwelle  ODER  (≥ VIELE_BUENDEL Bündel aktiv UND Last ≥ SCHWELLE_MIN).
//   Höchstens MAX_ENGSTELLEN, die schwersten, nach Datum sortiert.

import { RASTER_RAND, kalenderwoche, montag, raster, wochenVon, type Ansicht } from './baum';
import { QUELLEN, type Strang } from './modell';

export const SCHWELLE_MIN = 4;
export const SCHWELLE_SIGMA = 1;
export const VIELE_BUENDEL = 3;
export const MAX_ENGSTELLEN = 4;
export const TOP_STRAENGE = 5;

export interface EngstelleStrang { id: string; titel: string; tag: string; quelle: Strang['quelle']; link?: string; buendel: string; ueberfaellig: boolean }
export interface Engstelle {
  /** Montag der Woche. */
  woche: string;
  kw: number;
  last: number;
  ziele: number;
  fristen: number;
  termine: number;
  /** Aktive Bündel in der Woche. */
  buendel: number;
  /** „KW 44: 3 Ziele · 9 Fristen · 4 Termine“ */
  text: string;
  top: EngstelleStrang[];
}

const zahlWort = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Der Satz einer Engstelle (ohne Nullen). */
export function engstelleText(kw: number, z: { ziele: number; fristen: number; termine: number }): string {
  const teile = [
    z.ziele ? zahlWort(z.ziele, 'Ziel', 'Ziele') : '',
    z.fristen ? zahlWort(z.fristen, 'Frist', 'Fristen') : '',
    z.termine ? zahlWort(z.termine, 'Termin', 'Termine') : '',
  ].filter(Boolean);
  return `KW ${kw}: ${teile.join(' · ') || 'viel zugleich'}`;
}

/**
 * Engstellen einer Ansicht. `straenge` = die Stränge der Ansicht (baum.ts `straengeImBlick`), `buendelVon` = welches
 * Bündel einen Strang trägt (für die Markierung im Band).
 */
export function engstellen(a: Ansicht, straenge: readonly Strang[], buendelVon: (s: Strang) => string, heute: string): Engstelle[] {
  const r = raster(a.von, a.bis);
  const n = r.wochen.length;
  if (!n) return [];
  const je: Strang[][] = r.wochen.map(() => []);
  for (const s of straenge) for (const i of wochenVon(s, r, heute)) { const w = i - RASTER_RAND; if (w >= 0 && w < n) je[w].push(s); }
  const ab = montag(heute);
  const kandidaten = r.wochen.map((w, i) => ({ w, i, last: je[i].reduce((s, x) => s + x.gewicht, 0) })).filter(x => x.w >= ab && x.last > 0);
  if (!kandidaten.length) return [];
  const mittel = kandidaten.reduce((s, x) => s + x.last, 0) / kandidaten.length;
  const streu = Math.sqrt(kandidaten.reduce((s, x) => s + (x.last - mittel) ** 2, 0) / kandidaten.length);
  const schwelle = Math.max(SCHWELLE_MIN, mittel + SCHWELLE_SIGMA * streu);
  const treffer = kandidaten
    .map(x => ({ ...x, aktiv: new Set(je[x.i].map(buendelVon)).size }))
    .filter(x => x.last >= schwelle || (x.aktiv >= VIELE_BUENDEL && x.last >= SCHWELLE_MIN))
    .sort((a1, b1) => b1.last - a1.last || a1.w.localeCompare(b1.w))
    .slice(0, MAX_ENGSTELLEN)
    .sort((a1, b1) => a1.w.localeCompare(b1.w));
  return treffer.map(x => {
    const l = je[x.i];
    const ziele = new Set(l.map(s => s.pfad.find(p => p.startsWith('ziel:'))).filter(Boolean)).size;
    const fristen = l.filter(s => QUELLEN[s.quelle].art === 'frist').length;
    const termine = l.length - fristen;
    const kw = kalenderwoche(x.w);
    const top = [...l].sort((p, q) => q.gewicht - p.gewicht || p.zeit.tag.localeCompare(q.zeit.tag) || p.id.localeCompare(q.id)).slice(0, TOP_STRAENGE)
      .map(s => ({ id: s.id, titel: s.titel, tag: s.zeit.tag, quelle: s.quelle, ...(s.link ? { link: s.link } : {}), buendel: buendelVon(s), ueberfaellig: s.status === 'ueberfaellig' }));
    return { woche: x.w, kw, last: Math.round(x.last * 100) / 100, ziele, fristen, termine, buendel: x.aktiv, text: engstelleText(kw, { ziele, fristen, termine }), top };
  });
}
