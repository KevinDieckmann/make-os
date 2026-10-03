// ─── Aufgaben → Meilenstein → Ziel (rein, client- und server-sicher, 03.10.) ──
// Kevin: „immer der Fokus auf die Ziele“ — wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt die Oberfläche
// es ruhig als Chip in der Ziel-Farbe. Nichts wird gespeichert und kein Feld kommt dazu: der Bezug folgt der Kette, die es schon gibt —
// Aufgabe liegt in der Liste eines Meilensteins (`meilensteinVonAufgabe`), der Meilenstein zeigt auf ein Ziel (`zielVonMeilenstein`).
// Die Farbe kommt aus der EINEN Regel `zielFarben` (lib/lichtfaeden/modell.ts) — dieselbe wie in den Lichtfäden.

import { FADEN_FARBEN } from '@/lib/make-one/design';
import { zielFarben as farbRegel } from '@/lib/lichtfaeden/modell';
import { meilensteinListeId, zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';

export interface ZielRoh { id: string; titel: string; space?: 'privat' | 'business'; rang?: number; erledigt?: boolean; abgeleitetVon?: string }
export interface MeilensteinRoh { id: string; titel: string; zielId?: string; abgeleitetVon?: string }
export interface ZielBezug { zielId: string; zielTitel: string; farbe: string; meilensteinId: string; meilensteinTitel: string }

/** Die Farbe je Ziel — dieselbe Regel wie in den Lichtfäden (Wurzel-Ziele je Space nach Rang; abgeleitete wie ihr Jahresziel). */
export function zielFarben(ziele: readonly ZielRoh[]): Map<string, string> {
  return farbRegel(ziele);
}

/** Liste eines Meilensteins (Kennung) → Ziel-Bezug. Meilensteine ohne (lebendes) Ziel kommen nicht vor. */
export function bezugNachListe(ziele: readonly ZielRoh[], meilensteine: readonly MeilensteinRoh[]): Map<string, ZielBezug> {
  const farben = zielFarben(ziele);
  const nachId = new Map(ziele.map(z => [z.id, z]));
  const aus = new Map<string, ZielBezug>();
  for (const m of meilensteine) {
    const zid = zielVonMeilenstein(m);
    const z = zid ? nachId.get(zid) : undefined;
    if (!z) continue;
    aus.set(meilensteinListeId(m.id), { zielId: z.id, zielTitel: z.titel, farbe: farben.get(z.id) ?? FADEN_FARBEN.ohne, meilensteinId: m.id, meilensteinTitel: m.titel });
  }
  return aus;
}

/** Der Ziel-Bezug einer Aufgabe (über ihre Liste) — null, wenn sie in keiner Meilenstein-Liste liegt oder das Ziel fehlt. */
export function bezugVonAufgabe(t: { listeId?: string } | undefined | null, karte: ReadonlyMap<string, ZielBezug>): ZielBezug | null {
  return (t?.listeId && karte.get(t.listeId)) || null;
}
