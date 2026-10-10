// ─── MAKE OS — Fokus › Wirkung: der Wachstums-Score je Bereich (10.10.) — rein ──────────────────────────────────────────────────
// Die frühere Seite „Wachstum“ ist der Abschnitt „Wirkung“ der Fokus-Seite. Der Score mischt Privat (Gesundheit, Familie, die private
// Hälfte der Finanzen) und Business (Business-Index, die Business-Hälfte der Finanzen) — die Seite folgt aber dem Kopf-Schalter, und
// „Business zeigt nie Privat-Themen, Privat nie Business-Themen“. Darum filtert der SERVER (GET /api/performance?sicht=…) hier:
//   · Privat:   Gesundheit & Energie · Familie & Partnerschaft · Finanzen nur mit der Privat-Hälfte
//   · Business: Business-Performance · Finanzen nur mit der Business-Hälfte (dazu das Detail des Business-Index)
// Planung & Ausführung und Agenten rechnen über beide Bereiche — sie stehen in keiner der beiden Sichten. Der Score der Sicht ist das
// gewichtete Mittel ihrer tragfähigen Säulen (dieselben Gewichte wie im Gesamt-Score). Der Verlauf rechnet ebenso — die Finanzen-Säule
// liegt im Verlauf nur als Gesamtwert vor und zählt dort nicht.

import type { PerfIndex, Saeule } from '@/lib/performance';
import type { SteuerBereich } from './steuerung';

export const WIRKUNG_SAEULEN: Readonly<Record<SteuerBereich, readonly string[]>> = {
  privat: ['health', 'social', 'finance'],
  business: ['business', 'finance'],
};
/** Säulen, die im Verlauf je Sicht zählen (die Finanzen liegen dort nur gemischt vor). */
const VERLAUF_SAEULEN: Readonly<Record<SteuerBereich, readonly string[]>> = { privat: ['health', 'social'], business: ['business'] };
/** Vorsilbe der Finanz-Faktoren je Hälfte (lib/performance.ts: „Business · …“ / „Privat · …“). */
const HAELFTE: Readonly<Record<SteuerBereich, string>> = { privat: 'Privat · ', business: 'Business · ' };
const MIN_ABDECKUNG = 0.4;

export function wirkungLabel(v: number | null): string {
  if (v == null) return 'noch keine Datenbasis';
  if (v >= 80) return 'Souverän';
  if (v >= 60) return 'Solide';
  if (v >= 40) return 'Verbesserungsfähig';
  return 'Kritisch';
}

/** Eine Säule für die Sicht: Finanzen nur mit der eigenen Hälfte (Faktoren, Wert, kein `teile` der anderen). */
function saeuleFuer(s: Saeule, b: SteuerBereich): Saeule {
  if (s.key !== 'finance') return s;
  const faktoren = s.faktoren.filter(f => f.label.startsWith(HAELFTE[b])).map(f => ({ ...f, label: f.label.slice(HAELFTE[b].length) }));
  const score = s.teile ? s.teile[b] : null;
  const echt = faktoren.filter(f => f.echt).length;
  const abdeckung = faktoren.length ? echt / faktoren.length : 0;
  const { teile: _teile, ...rest } = s;
  return { ...rest, faktoren, score, abdeckung, zuDuenn: score != null && abdeckung < MIN_ABDECKUNG, hinweis: b === 'privat' ? 'Privat-Index (Sparquote, Luft, Schuldenabbau)' : 'Finanzielle Gesundheit (Business-Index)' };
}

/** Der Score einer Sicht (rein): nur ihre Säulen, Score = gewichtetes Mittel der tragfähigen, Hebel und Abdeckung neu gerechnet. */
export function wirkungFuerSicht(p: PerfIndex, b: SteuerBereich): PerfIndex {
  const saeulen = p.saeulen.filter(s => WIRKUNG_SAEULEN[b].includes(s.key)).map(s => saeuleFuer(s, b));
  const gezaehlt = saeulen.filter(s => s.score != null && !s.zuDuenn);
  const summe = gezaehlt.reduce((a, s) => a + s.gewicht, 0);
  const index = summe > 0 ? Math.round(gezaehlt.reduce((a, s) => a + (s.score as number) * s.gewicht, 0) / summe) : null;
  const hebelS = gezaehlt.length ? gezaehlt.reduce((best, x) => ((100 - (x.score as number)) * x.gewicht > (100 - (best.score as number)) * best.gewicht ? x : best)) : null;
  const gesamtGewicht = saeulen.reduce((a, s) => a + s.gewicht, 0) || 1;
  const abdeckung = saeulen.reduce((a, s) => a + (s.zuDuenn || s.score == null ? 0 : s.abdeckung) * s.gewicht, 0) / gesamtGewicht;
  const { business, ...rest } = p;
  return {
    ...rest, index, label: wirkungLabel(index), saeulen, abdeckung, hebel: hebelS?.label ?? null, hebelKey: hebelS?.key ?? null,
    // Das Detail des Business-Index nur in der Business-Sicht.
    ...(b === 'business' && business ? { business } : {}),
  };
}

/** Ein Tagespunkt des Verlaufs je Sicht: Score aus den Säulen der Sicht (Gewichte aus dem aktuellen Score), Säulen der anderen Sicht fallen weg. */
export function verlaufFuerSicht<T extends { date: string; index: number | null; saeulen: Record<string, number | null>; abdeckung: number; notiz?: string }>(
  liste: readonly T[], gewichte: Readonly<Record<string, number>>, b: SteuerBereich,
): { date: string; index: number | null; saeulen: Record<string, number | null> }[] {
  const keys = VERLAUF_SAEULEN[b];
  return liste.map(s => {
    const werte = keys.map(k => [k, s.saeulen?.[k] ?? null] as const);
    const mit = werte.filter(([, v]) => typeof v === 'number');
    const summe = mit.reduce((a, [k]) => a + (gewichte[k] ?? 0), 0);
    const index = summe > 0 ? Math.round(mit.reduce((a, [k, v]) => a + (v as number) * (gewichte[k] ?? 0), 0) / summe) : null;
    return { date: s.date, index, saeulen: Object.fromEntries(werte) };
  });
}
