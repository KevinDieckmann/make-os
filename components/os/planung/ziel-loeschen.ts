// ─── MAKE OS — Ziel löschen: Meilensteine bleiben, mit „Rückgängig“ (01.10.) ─────────────
// EINE Stelle für die Liste und das Ziel-Detail. Kevin: „Mehrere Meilensteine zu einem Ziel“ — wer das Ziel löscht, verliert
// nicht die Meilensteine: der Server löst nur ihren Ziel-Bezug (`zielId`, app/api/state/ziele), sie stehen weiter in
// Ziele & Planung (ohne Ziel). Der Hinweis nennt das; „Rückgängig“ legt das Ziel UND den Bezug wieder an.

import type { MutableRefObject } from 'react';
import { ohneStand } from '@/lib/make-one/liste-stand';
import type { Ziel } from '@/lib/planung/typen';
import type { PlanungStand } from './usePlanung';
import type { Rueckgaengig } from './Rueckgaengig';

/** Löscht das Ziel; `stand` ist der jüngste Stand (das Zurückholen läuft später). Liefert, wie viele Meilensteine ohne Ziel bleiben. */
export function loescheZiel(stand: MutableRefObject<PlanungStand>, id: string, rueck: Rueckgaengig): number {
  const p = stand.current;
  const alt = p.ziele.find(z => z.id === id);
  if (!alt) return 0;
  const kinder = p.ms.filter(m => m.zielId === id).map(m => m.id);
  p.persistZiele(p.ziele.filter(z => z.id !== id));
  rueck.melden(`Ziel „${alt.titel}“ gelöscht${kinder.length ? ` — ${kinder.length} ${kinder.length === 1 ? 'Meilenstein bleibt' : 'Meilensteine bleiben'} ohne Ziel` : ''}`, () => {
    const q = stand.current;
    if (q.ziele.some(z => z.id === id)) return;
    q.persistZiele([...q.ziele, ohneStand(alt as Ziel & { stand?: string })]);
    // Der Server hat den Bezug gelöst — erst frisch laden (sonst passt der Stand nicht), dann den Bezug wieder setzen.
    if (kinder.length) void q.msNeuLaden().then(() => { const r = stand.current; r.persistMs(r.ms.map(m => (kinder.includes(m.id) && !m.zielId ? { ...m, zielId: id } : m))); });
  });
  return kinder.length;
}
