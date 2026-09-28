// ─── MAKE OS — Eine Hauptverantwortliche + Beteiligte (rein, 29.09.) ────────
// Kevin 29.09.: „Eine Hauptverantwortliche + Beteiligte statt ‚Beide‘; Bestand: Anlegerin = verantwortlich, die andere =
// beteiligt.“ `assignee` ist genau EINE Person (Speichername aus dem Haushalt), `beteiligte[]` die übrigen.
//
// „both“ auflösen (Übernahme des Altbestands UND Schreiber, die noch „both“ schicken — alte Fenster, Heads, Eingang …):
//   verantwortlich = die Anlegerin (`angelegtVon`), sonst die Person aus dem Verlauf „angelegt“, sonst die schreibende
//   Person (beim Schreiben), sonst die Person, die zuletzt geschrieben hat (Verlauf) — nie geraten „kevin“. Ist niemand
//   bekannt: die erste Person des Haushalts (Inhaber zuerst) und die Aufgabe steht in der Hinweis-Liste (`geraten`).
//   Beteiligt = alle anderen Personen des Haushalts (bei zwei Personen: die andere). Der Status bleibt, wie er ist.
// Tests: tests/aufgaben-t1-modell.test.ts.

import type { Task } from '@/types/tasks';

export const SYSTEM = 'system';

const bekannt = (p: string | undefined, personen: readonly string[]): p is string => !!p && p !== SYSTEM && personen.includes(p);

/** Die Anlegerin laut Feld oder Verlauf „angelegt“ (nie „system“). */
export function anlegerinVon(t: Pick<Task, 'angelegtVon' | 'verlauf'>): string | undefined {
  if (t.angelegtVon && t.angelegtVon !== SYSTEM) return t.angelegtVon;
  const v = (t.verlauf ?? []).find(e => e.was === 'angelegt' && e.von && e.von !== SYSTEM && !e.durch);
  return v?.von;
}

/** Wer zuletzt (als Person, nicht als Systemlauf) an der Aufgabe geschrieben hat — laut Verlauf. */
export function letzteSchreiberin(t: Pick<Task, 'verlauf'>, personen: readonly string[]): string | undefined {
  const l = t.verlauf ?? [];
  for (let i = l.length - 1; i >= 0; i--) if (bekannt(l[i].von, personen) && l[i].durch !== 'system') return l[i].von;
  return undefined;
}

export interface Aufgeloest<T> { task: T; geaendert: boolean; /** Niemand bekannt — erste Person genommen (Hinweis-Liste). */ geraten: boolean }

/**
 * „both“ → eine Verantwortliche + Beteiligte. Ohne Personen (kein Konto bekannt, z. B. Tests) bleibt alles, wie es ist.
 * Beteiligte werden bereinigt: nie die Verantwortliche selbst, ohne Doppelte.
 */
export function beideAufloesen<T extends Pick<Task, 'assignee' | 'beteiligte' | 'angelegtVon' | 'verlauf'>>(t: T, personen: readonly string[], schreiber?: string | null): Aufgeloest<T> {
  if (!personen.length) return { task: t, geaendert: false, geraten: false };
  if (t.assignee !== 'both') {
    const b = beteiligteOhne(t.beteiligte, t.assignee);
    if (sameListe(b, t.beteiligte)) return { task: t, geaendert: false, geraten: false };
    return { task: mitBeteiligten(t, b), geaendert: true, geraten: false };
  }
  const kandidaten = [anlegerinVon(t), schreiber ?? undefined, letzteSchreiberin(t, personen)];
  const gefunden = kandidaten.find(p => bekannt(p, personen));
  const verantwortlich = gefunden ?? personen[0];
  const beteiligte = beteiligteOhne([...(t.beteiligte ?? []), ...personen], verantwortlich);
  const n = mitBeteiligten({ ...t, assignee: verantwortlich as Task['assignee'] }, beteiligte);
  return { task: n, geaendert: true, geraten: !gefunden };
}

function beteiligteOhne(l: readonly string[] | undefined, verantwortlich: string): string[] {
  return Array.from(new Set((l ?? []).filter(p => p && p !== verantwortlich && p !== 'both')));
}
const sameListe = (a: readonly string[], b: readonly string[] | undefined) => a.length === (b ?? []).length && a.every((x, i) => x === b![i]);
function mitBeteiligten<T extends Pick<Task, 'beteiligte'>>(t: T, b: string[]): T {
  const n = { ...t };
  if (b.length) n.beteiligte = b; else delete n.beteiligte;
  return n;
}

/** Wer die Aufgabe „hat“ (verantwortlich + beteiligt) — für Meldungen bei Kommentaren. „both“ (Altbestand) = alle. */
export function alleZustaendigen(t: Pick<Task, 'assignee' | 'beteiligte'>, personen: readonly string[]): string[] {
  const v = t.assignee === 'both' ? [...personen] : t.assignee ? [t.assignee] : [];
  return Array.from(new Set([...v, ...(t.beteiligte ?? [])]));
}

/** Ist die Person verantwortlich („Meine“)? Altbestand „both“ zählt bis zur Übernahme für alle. */
export const istVerantwortlich = (t: Pick<Task, 'assignee'>, ich: string | null | undefined): boolean => !!ich && (t.assignee === ich || t.assignee === 'both');
/** Ist die Person beteiligt (nicht verantwortlich)? */
export const istBeteiligt = (t: Pick<Task, 'beteiligte'>, ich: string | null | undefined): boolean => !!ich && (t.beteiligte ?? []).includes(ich);
