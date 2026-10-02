// ─── MAKE OS — Meilenstein löschen, mit der Kette und mit „Rückgängig“ (01.10.) ───────────
// EINE Stelle für Fenster, Liste und Ziel-Detail: der Meilenstein geht raus, seine Nachfolger warten nicht mehr auf ihn
// (`ohneMeilenstein`, lib/planung/meilenstein-kette.ts — der Server räumt dasselbe noch einmal in derselben Sperre, falls
// ein anderer Weg löscht), und „Rückgängig“ holt Meilenstein UND die Verweise der Nachfolger wieder zurück.
// Der Ziel-Bezug am Meilenstein selbst bleibt beim Zurückholen erhalten (er steht im Eintrag).

import type { MutableRefObject } from 'react';
import { ohneStand } from '@/lib/make-one/liste-stand';
import { ohneMeilenstein, verweiseZurueck } from '@/lib/planung/meilenstein-kette';
import type { Meilenstein } from '@/lib/planung/typen';
import type { PlanungStand } from './usePlanung';
import type { Rueckgaengig } from './Rueckgaengig';

/** Löscht den Meilenstein; `stand` ist der jüngste Stand (das Zurückholen läuft später). Liefert, wie viele Nachfolger betroffen waren. */
export function loescheMeilenstein(stand: MutableRefObject<PlanungStand>, id: string, rueck: Rueckgaengig): number {
  const p = stand.current;
  const roh = p.ms.find(m => m.id === id);
  if (!roh) return 0;
  const alt = ohneStand(roh as Meilenstein & { stand?: string });
  const { liste, betroffen } = ohneMeilenstein(p.ms, id);
  p.persistMs(liste);
  const n = betroffen.length;
  rueck.melden(`„${alt.titel}“ gelöscht${n ? ` — ${n} ${n === 1 ? 'Meilenstein wartet' : 'Meilensteine warten'} nicht mehr darauf` : ''}`, () => {
    const q = stand.current;
    if (q.ms.some(m => m.id === alt.id)) return;
    q.persistMs(verweiseZurueck([...q.ms, alt], alt.id, betroffen));
  });
  return n;
}
