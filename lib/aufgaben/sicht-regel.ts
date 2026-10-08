// ─── MAKE OS — Sichtregel „nur ich“ (rein, ohne Speicher; 08.10. aus lib/aufgaben/sicht.ts herausgelöst) ─────────────────
// Dieselben Funktionen wie bisher (sicht.ts reicht sie weiter) — eigene Datei, damit reine Module (Papierkorb-Regeln) sie
// nutzen können, ohne den Speicher (local-db) zu laden. Regeln siehe lib/aufgaben/sicht.ts › „Sichtbarkeit „nur ich““.

import type { Task } from '@/types/tasks';

/** Ist die Aufgabe selbst als „nur ich“ markiert? */
export const istNurIch = (t: Pick<Task, 'sichtbarkeit'> | undefined | null): boolean => t?.sichtbarkeit === 'nur-ich';

/**
 * Darf `person` die Aufgabe sehen? `nachId` = alle Aufgaben (für die Vorfahren einer Unteraufgabe). Seit 01.10. (mehrstufige
 * Unteraufgaben) gilt die ganze Kette: liegt IRGENDEIN Vorfahre auf „nur ich“ einer anderen Person, ist auch der Enkel
 * unsichtbar. Kreisfest (gesehene Einträge, höchstens 64 Schritte).
 */
export function darfSehen(t: Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>, person: string | null | undefined, nachId?: ReadonlyMap<string, Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>): boolean {
  const fremd = (x: Pick<Task, 'sichtbarkeit' | 'angelegtVon'>) => istNurIch(x) && (!person || x.angelegtVon !== person);
  if (fremd(t)) return false;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = nachId?.get(pid);
    if (!e) break;
    if (fremd(e)) return false;
    pid = e.parentId;
  }
  return true;
}

/**
 * Wer darf die Aufgabe sehen — dieselbe Regel wie `darfSehen`, nur als Antwort statt als Ja/Nein (für Leser, die ALLE
 * Aufgaben bekommen und je Betrachter maskieren, z. B. die Lichtfäden):
 *   · `undefined` — keine „nur ich“-Markierung in der Kette (Aufgabe oder ein Vorfahre): alle dürfen sie sehen.
 *   · Speichername — genau diese Person (die Anlegerin der „nur ich“-Aufgabe bzw. des „nur ich“-Vorfahren).
 *   · `null` — niemand: „nur ich“ ohne bestimmbare Anlegerin (Altaufgabe ohne `angelegtVon`) oder zwei „nur ich“ in der
 *     Kette mit verschiedenen Anlegerinnen. Solche Aufgaben gehören in keine geteilte Sicht.
 * Es gilt immer: `darfSehen(t, p, nachId) === (b === undefined || b === p)` für jede Person `p`. Kreisfest wie `darfSehen`.
 */
export function nurIchBesitzer(t: Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>, nachId?: ReadonlyMap<string, Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>): string | null | undefined {
  let besitzer: string | null | undefined;
  const pruefe = (x: Pick<Task, 'sichtbarkeit' | 'angelegtVon'>): boolean => {
    if (!istNurIch(x)) return true;
    if (!x.angelegtVon || (besitzer !== undefined && besitzer !== x.angelegtVon)) { besitzer = null; return false; }
    besitzer = x.angelegtVon;
    return true;
  };
  if (!pruefe(t)) return null;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = nachId?.get(pid);
    if (!e) break;
    if (!pruefe(e)) return null;
    pid = e.parentId;
  }
  return besitzer;
}
