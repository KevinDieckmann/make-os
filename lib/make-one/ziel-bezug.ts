// ─── MAKE OS — Ziel-Bezug (03.10., Kevin: „immer der Fokus auf die Ziele“) ──
// Reine Auswahl: auf welches private Jahresziel zahlt ein Bereich (Gesundheit, Familie, Training …) ein? Kein Speicher, keine
// Schreibwege — die Seiten zeigen den Bezug nur an (components/os/ui › ZielBezug). Client-safe.
//
// Review 03.10.: keine Stichworte im Zieltitel mehr (ohne Wortgrenzen traf „fit“ „Profit“, „buch“ „Buchhaltung“) und keine
// Personennamen im Code. Ein echter Bezug kommt NUR aus der Thema-Zuordnung der Lichtfäden — dieselbe Funktion
// (`zielThema`, lib/lichtfaeden/modell.ts): ein Ziel gehört zum Thema seiner Meilensteine (über `zielVonMeilenstein`,
// abgeleitete Ziele auf ihr Jahresziel gerechnet). Gibt es keinen, steht ehrlich das oberste offene private Jahresziel da
// („Oberstes Ziel“, nicht „zahlt ein auf“). Space ohne Angabe = Business (`spaceVonZiel`, dieselbe Regel wie überall).

import type { Meilenstein, Ziel, ZielHorizont } from '@/lib/planung/typen';
import { istWurzelZiel, meilensteineJeWurzel, spaceVonZiel, zielThema, zielWurzeln, type ThemaId } from '@/lib/lichtfaeden/modell';

export type BezugBereich = 'gesundheit' | 'beziehung' | 'wissen' | 'training' | 'privat';

/** Wie der Treffer zustande kam — bestimmt den Text („zahlt ein auf“ nur bei einem echten Bezug). */
export type BezugGrund = 'thema' | 'rang';

export interface ZielBezugEintrag { id: string; titel: string; fortschritt: number; grund: BezugGrund; farbe: string }

/** Welches Lichtfäden-Thema ein Bereich meint (null = kein eigenes Thema, dann nur „Oberstes Ziel“). */
export const THEMA_DES_BEREICHS: Record<BezugBereich, ThemaId | null> = {
  gesundheit: 'gesundheit', training: 'gesundheit', beziehung: 'beziehung', wissen: null, privat: null,
};

/** Was der Ziel-Bezug von einem Ziel braucht — die Farbe kommt vom Server (`farbe`). */
export type BezugZiel = Pick<Ziel, 'id' | 'titel' | 'fortschritt' | 'erledigt' | 'space' | 'rang' | 'abgeleitetVon' | 'mandatId' | 'firmaId'> & { horizont: ZielHorizont; farbe: string };

const offen = (z: BezugZiel) => !z.erledigt && z.fortschritt < 100;

/**
 * Bis zu `max` private Jahresziele, auf die der Bereich einzahlt. `ziele` = alle Ziele (alle Horizonte, mit Farbe vom
 * Server), `meilensteine` = alle Meilensteine. Reihenfolge = Rang (ohne Rang hinten).
 */
export function zielBezug(bereich: BezugBereich, ziele: readonly BezugZiel[], meilensteine: readonly Pick<Meilenstein, 'zielId' | 'abgeleitetVon' | 'bereich'>[], max = 2): ZielBezugEintrag[] {
  const rang = (z: BezugZiel) => (z.rang && z.rang > 0 ? z.rang : 1e6);
  const wurzel = zielWurzeln(ziele);
  const msJe = meilensteineJeWurzel(wurzel, meilensteine);
  const kandidaten = ziele.filter(z => z.horizont === 'jahr' && istWurzelZiel(wurzel, z.id) && spaceVonZiel(z) === 'privat' && offen(z)).sort((a, b) => rang(a) - rang(b));
  const treffer: ZielBezugEintrag[] = [];
  const nimm = (z: BezugZiel, grund: BezugGrund) => {
    if (treffer.length >= max || treffer.some(t => t.id === z.id)) return;
    treffer.push({ id: z.id, titel: z.titel, fortschritt: Math.max(0, Math.min(100, Math.round(z.fortschritt))), grund, farbe: z.farbe });
  };
  const thema = THEMA_DES_BEREICHS[bereich];
  if (thema) kandidaten.filter(z => zielThema(z, msJe.get(z.id) ?? []) === thema).forEach(z => nimm(z, 'thema'));
  if (!treffer.length && kandidaten[0]) nimm(kandidaten[0], 'rang');
  return treffer;
}
