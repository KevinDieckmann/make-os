// ─── Kampagnen: welche Welt, wer zuständig, was sichtbar (rein, 08.10., Markttraktion Woche 2 · 5.7/6.6) ─────────────────────
// Kampagnen gehörten fest zur Welt „sales“ (Standard: die Sales-Verantwortung), stehen seit dem Aufräumen aber unter Marketing — von Heads
// angelegte Marketing-Kampagnen landeten so bei Sales. Jetzt entscheidet das Playbook (die führende Welt = erster Eintrag in `fuer` des
// Playbooks, lib/crm/kampagnen.ts; der Wächter in tests/markttraktion-woche2b.test.ts gleicht beide ab). Ohne Playbook (eigene Kampagne):
// wer sie angelegt hat (Head of Sales → Sales), sonst Marketing — dort stehen Kampagnen. Eine eingetragene Zuständigkeit gilt immer zuerst.
// Bewusst ohne Import aus kampagnen.ts/team.ts-Folgen (team.ts liest hier, kampagnen.ts hängt an kunden.ts → team.ts).

import type { Kampagne } from './typen';
import type { Welt } from './traktion';

/** Führende Welt je Playbook — muss zu `PLAYBOOKS[].fuer[0]` passen (Wächtertest). */
export const PLAYBOOK_WELT: Readonly<Record<string, Welt>> = {
  empfehlung: 'sales', reaktivierung: 'sales', lookalike: 'marketing', fallstudie: 'marketing', event: 'marketing',
  upsell: 'sales', verlaengerung: 'sales', vernetzen: 'marketing', newsletter: 'marketing',
};

/** Die Welt einer Kampagne (für die Standard-Zuständigkeit, Filter und Aufgaben). */
export function weltDerKampagne(k: Pick<Kampagne, 'playbook'> & { von?: Kampagne['von'] }): Welt {
  const p = k.playbook ? PLAYBOOK_WELT[k.playbook] : undefined;
  if (p) return p;
  return k.von === 'head-sales' ? 'sales' : 'marketing';
}

/**
 * Welche Kampagnen die Liste zeigt (5.7): Archiv/Liste und der Personen-Filter wie bisher — aber die Kampagne aus dem Link (`k`) steht
 * IMMER da, auch wenn der gemerkte Filter „Meins“ steht oder sie archiviert ist (sonst öffnete der Link nichts).
 */
export function sichtbareKampagnen<T extends { id: string; archiviertAm?: string }>(alle: readonly T[], o: { sicht: 'liste' | 'archiv' | 'papierkorb'; offen: string | null; passt: (k: T) => boolean }): T[] {
  return alle.filter(k => k.id === o.offen || ((o.sicht === 'archiv' ? !!k.archiviertAm : !k.archiviertAm) && o.passt(k)));
}
