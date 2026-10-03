// ─── Lichtfäden — Farben der Bündel (03.10.2026) ────────────────────────────
// Je Ziel eine Farbe aus FADEN_FARBEN (design.ts), in der Reihenfolge der Bündel je Space — deterministisch, ohne Feld am
// Ziel. Ohne Space (gemeinsam) gilt die Business-Reihe; „ohne Ziel“ leuchtet im Zeit-Cyan.

import { FADEN_FARBEN } from '@/lib/make-one/design';
import type { SpaceId } from '@/lib/make-one/space-regeln';
import { OHNE_ZIEL } from './dichte';

/** Farben für Bündel in ihrer Reihenfolge: je Space fortlaufend durch die Reihe. */
export function buendelFarben(buendel: readonly { id: string; space?: SpaceId }[]): Record<string, string> {
  const zaehler: Record<string, number> = {};
  const aus: Record<string, string> = {};
  for (const b of buendel) {
    if (b.id === OHNE_ZIEL) { aus[b.id] = FADEN_FARBEN.ohne; continue; }
    const reihe = b.space === 'privat' ? FADEN_FARBEN.privat : FADEN_FARBEN.business;
    const k = b.space === 'privat' ? 'privat' : 'business';
    const i = zaehler[k] ?? 0;
    zaehler[k] = i + 1;
    aus[b.id] = reihe[i % reihe.length];
  }
  return aus;
}
