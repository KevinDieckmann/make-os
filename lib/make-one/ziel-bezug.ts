// ─── MAKE OS — Ziel-Bezug (03.10., Kevin: „immer der Fokus auf die Ziele“) ──
// Reine Auswahl: auf welches private Jahresziel zahlt ein Bereich (Gesundheit, Familie, Wissen …) ein? Kein Speicher, keine Schreibwege —
// die Seiten zeigen den Bezug nur an (components/os/ui › ZielBezug). Client-safe.
//
// Reihenfolge der Treffer: 1. Meilensteine des Bereichs, die auf ein Ziel zeigen (`zielId`) · 2. Stichworte im Zieltitel ·
// 3. das oberste offene private Jahresziel (ehrlich als „Oberstes Ziel“ gekennzeichnet, nicht als Bezug des Bereichs).

import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import { OHNE_FARBE, zielFarben } from '@/lib/lichtfaeden/modell';

export type BezugBereich = 'gesundheit' | 'beziehung' | 'wissen' | 'training' | 'privat';

/** Wie der Treffer zustande kam — bestimmt den Text („zahlt ein auf“ nur bei einem echten Bezug). */
export type BezugGrund = 'meilenstein' | 'stichwort' | 'rang';

export interface ZielBezugEintrag { id: string; titel: string; fortschritt: number; grund: BezugGrund; farbe: string }

const STICHWORTE: Record<BezugBereich, RegExp | null> = {
  gesundheit: /gesund|körper|koerper|fit|schlaf|ernähr|ernaehr|gewicht|haut|energie|reha|rücken|ruecken|recovery|whoop/i,
  training: /sport|training|lauf|hyrox|gym|kraft|marathon|fit|ausdauer|reha|bewegung/i,
  beziehung: /beziehung|paar|familie|partner|malin|hochzeit|kind|ehe|zweit|date|zusammen/i,
  wissen: /lern|wissen|buch|lesen|kurs|brain|bildung|studium/i,
  privat: null,
};

const offen = (z: Ziel) => !z.erledigt && z.fortschritt < 100;
const privat = (z: Ziel) => z.space === 'privat' || z.space === undefined;

/**
 * Bis zu `max` Jahresziele, auf die der Bereich einzahlt. `ziele` = die Jahresziele (alle Spaces, wie die Route sie liefert),
 * `meilensteine` = alle Meilensteine. Reihenfolge der Ziele = Rang (ohne Rang hinten), die Farbe je Ziel kommt aus
 * `zielFarben` (lib/lichtfaeden/modell.ts) — dieselbe Farbe wie im Zeitstrahl der Planung und an den Ziel-Chips der Aufgaben.
 */
export function zielBezug(bereich: BezugBereich, ziele: readonly Ziel[], meilensteine: readonly Meilenstein[], max = 2): ZielBezugEintrag[] {
  const rang = (z: Ziel) => (z.rang && z.rang > 0 ? z.rang : 1e6);
  const sortiert = [...ziele.filter(privat)].sort((a, b) => rang(a) - rang(b));
  // Die EINE Farbregel für Ziele (lib/lichtfaeden/modell.ts) — dieselbe Farbe wie im Zeitstrahl und an den Ziel-Chips der Aufgaben.
  const farben = zielFarben(ziele);
  const farbeVon = (z: Ziel) => farben.get(z.id) ?? OHNE_FARBE;
  const kandidaten = sortiert.filter(offen);
  const treffer: ZielBezugEintrag[] = [];
  const nimm = (z: Ziel, grund: BezugGrund) => {
    if (treffer.length >= max || treffer.some(t => t.id === z.id)) return;
    treffer.push({ id: z.id, titel: z.titel, fortschritt: Math.max(0, Math.min(100, Math.round(z.fortschritt))), grund, farbe: farbeVon(z) });
  };
  // 1. Meilensteine des Bereichs (Altfeld `bereich: gesundheit` = privat) zeigen auf ein Ziel
  if (bereich === 'gesundheit' || bereich === 'training') {
    const ids = new Set(meilensteine.filter(m => m.bereich === 'gesundheit' && !m.erledigt && m.zielId).map(m => m.zielId as string));
    kandidaten.filter(z => ids.has(z.id)).forEach(z => nimm(z, 'meilenstein'));
  }
  // 2. Stichworte im Titel
  const wort = STICHWORTE[bereich];
  if (wort) kandidaten.filter(z => wort.test(z.titel)).forEach(z => nimm(z, 'stichwort'));
  // 3. sonst das oberste private Jahresziel
  if (!treffer.length && kandidaten[0]) nimm(kandidaten[0], 'rang');
  return treffer;
}
