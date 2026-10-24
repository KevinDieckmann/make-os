// ─── Prozesse — die Tage eines Zeitplan-Auslösers (Feinschliff 24.10., Bau-Test A2: „wöchentlich“ zeigte die Tage 1–31) ──────────────────────────────────────
// Dieselbe Regel wie der Takt (lib/agenten/zeitplan.ts `slotsAmTag`): wöchentlich = Wochentage 1 (Montag) … 7 (Sonntag), ohne Wahl montags; monatlich = Monatstage
// 1–31, ohne Wahl am 1.; ein Tag über dem Monatsende läuft am letzten Tag des Monats — darum heißt die 31 hier „letzter Tag“. Täglich und werktags kennen keine Tage.
// `zeitplanKurz` ist der Satz am Knoten („montags 08:00“). Rein und client-sicher.

import type { Ausloeser } from './definition';

export interface TagOption { id: string; label: string }
export const WOCHENTAGE: readonly TagOption[] = [
  { id: '1', label: 'Mo' }, { id: '2', label: 'Di' }, { id: '3', label: 'Mi' }, { id: '4', label: 'Do' }, { id: '5', label: 'Fr' }, { id: '6', label: 'Sa' }, { id: '7', label: 'So' },
];
/** Der Monatstag, der „am letzten Tag des Monats“ heißt (der Takt rückt jeden Tag über dem Monatsende auf den letzten). */
export const LETZTER_TAG = 31;
export const MONATSTAGE: readonly TagOption[] = [...Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) })), { id: String(LETZTER_TAG), label: 'letzter Tag' }];
const WOCHENTAG_LANG = ['montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags', 'sonntags'] as const;

/** Welche Tage ein Rhythmus anbietet (rein) — null: dieser Rhythmus kennt keine Tage (täglich, werktags). */
export function tageOptionen(rhythmus: unknown): readonly TagOption[] | null {
  return rhythmus === 'woechentlich' ? WOCHENTAGE : rhythmus === 'monatlich' ? MONATSTAGE : null;
}

/** Der Satz am Knoten (rein): „täglich 08:00“, „werktags 08:00“, „montags 08:00“, „Mo, Mi, Fr 08:00“, „am 1. 08:00“, „am letzten Tag 08:00“. */
export function zeitplanKurz(a: Extract<Ausloeser, { art: 'zeitplan' }>): string {
  const u = a.uhrzeit;
  const t = [...new Set(a.tage ?? [])].sort((x, y) => x - y);
  switch (a.rhythmus) {
    case 'taeglich': return `täglich ${u}`;
    case 'werktags': return `werktags ${u}`;
    case 'woechentlich': {
      const l = (t.length ? t : [1]).filter(x => x >= 1 && x <= 7);
      if (l.length === 1) return `${WOCHENTAG_LANG[l[0] - 1]} ${u}`;
      return `${l.map(x => WOCHENTAGE[x - 1].label).join(', ')} ${u}`;
    }
    case 'monatlich': {
      const l = t.length ? t : [1];
      return `am ${l.map(x => (x >= LETZTER_TAG ? 'letzten Tag' : `${x}.`)).join(', ')} ${u}`;
    }
    default: return `Zeitplan ${u}`;
  }
}
