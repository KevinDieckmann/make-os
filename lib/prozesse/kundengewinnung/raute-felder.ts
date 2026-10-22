// ─── Prozesse · welche Felder eine Definition liest (22.10. spät, Bausteine mit eigenem Weg) ──────────────────────────────────────────────────────────────
// Eine Raute nach Regel, eine Score-Raute, „nur wenn …“ am Auslöser und am Warten sowie Ziel/Abbruch nennen Felder des Falls, des Ereignisses, des Webhooks
// und der Schritte davor (`abfrage.*`, `schleife.*`, `agent.*`). Diese Stelle zählt sie auf — für den Motor (teure Fall-Felder werden nur gerechnet, wenn eine
// Definition sie nennt: lib/prozesse/kundengewinnung/fall-felder-server.ts) und für den Wächter, der alle Rauten der 18 Vorlagen gegen die gelieferten
// Fall-Felder prüft (tests/prozesse-bausteine2-felder.test.ts — keine Raute fällt still auf den Vorgabe-Ast). Rein und client-sicher.

import type { Bedingung, ProzessDefinition } from '../definition';
import { alleSchritte } from '../fluss';

/** Ein gelesenes Feld: wo (Knoten), welches, mit welcher Prüfung (`leer`/`gesetzt` lassen ein fehlendes Feld bewusst zu). */
export interface GelesenesFeld { knotenId: string; feld: string; op: Bedingung['op'] | 'score'; wo: 'raute' | 'ausloeser' | 'warten' }

/** Felder, die eine Score-Raute liest (dieselben wie lib/prozesse/lauf-regeln.ts `scoreTrifft`). */
const SCORE_FELD: Readonly<Record<string, string>> = { score: 'lead.score', temperatur: 'lead.temperatur', 'sql-bereit': 'lead.sql-bereit', mql: 'lead.mql' };

/** Alle Felder, die die Schritte einer Definition lesen (rein, deterministisch, Lese-Reihenfolge). */
export function gelesenFelder(def: Pick<ProzessDefinition, 'knoten'>): GelesenesFeld[] {
  const raus: GelesenesFeld[] = [];
  const bed = (knotenId: string, wo: GelesenesFeld['wo'], l: readonly Bedingung[] | undefined) => { for (const b of l ?? []) raus.push({ knotenId, feld: b.feld, op: b.op, wo }); };
  for (const { schritt: k } of alleSchritte(def)) {
    const r = k.raute;
    if (r?.art === 'regel') bed(k.id, 'raute', r.bedingungen);
    if (r?.art === 'score') raus.push({ knotenId: k.id, feld: SCORE_FELD[r.pruefung] ?? 'lead.score', op: 'score', wo: 'raute' });
    const a = k.ausloeser;
    if (a && (a.art === 'ereignis' || a.art === 'webhook')) bed(k.id, 'ausloeser', a.bedingungen);
    if (k.warten?.art === 'ereignis') bed(k.id, 'warten', k.warten.bedingungen);
  }
  return raus;
}

/** Die Feld-Kennungen als Menge (für „nur rechnen, was gebraucht wird“). */
export const gelesenFelderMenge = (def: Pick<ProzessDefinition, 'knoten'>): Set<string> => new Set(gelesenFelder(def).map(f => f.feld));

/** Felder, die nicht vom Fall kommen, sondern vom Lauf selbst (Ereignis, Webhook-Eingang, Ergebnisse der Schritte davor). */
export const istLaufFeld = (feld: string): boolean => /^(ereignis|bezug|webhook|abfrage|schleife|agent|lauf)\./.test(feld);
