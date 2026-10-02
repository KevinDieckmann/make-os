'use client';

// ─── Netzwerken — Zähler der Warteschlange (Browser, 03.10.) ─────────────────
// Der Sender im /os-Rahmen (components/os/netzwerken/Sender.tsx) schreibt hier, wie viele Erfassungen noch auf dem Gerät warten;
// die Handy-Leiste liest es als Abzeichen am Netzwerken-Knopf („2 warten“). Ein winziger Speicher ohne Bibliothek:
// `useSyncExternalStore` — beide Seiten liegen im selben Seitenlauf.

import { useSyncExternalStore } from 'react';

export interface Wartezahl { wartend: number; fehler: number }
const LEER: Wartezahl = { wartend: 0, fehler: 0 };
let stand: Wartezahl = LEER;
const hoerer = new Set<() => void>();

/** Neuen Stand setzen — meldet nur, wenn sich etwas geändert hat. */
export function wartezahlSetzen(neu: Wartezahl): void {
  if (neu.wartend === stand.wartend && neu.fehler === stand.fehler) return;
  stand = neu;
  for (const f of hoerer) f();
}
const abonnieren = (f: () => void) => { hoerer.add(f); return () => { hoerer.delete(f); }; };

export function useWartezahl(): Wartezahl {
  return useSyncExternalStore(abonnieren, () => stand, () => LEER);
}

/** Das Abzeichen als Text: „2 warten“, sonst „1 Fehler“, sonst nichts. */
export const wartezahlText = (z: Wartezahl): string | null => (z.wartend > 0 ? `${z.wartend} warten` : z.fehler > 0 ? `${z.fehler} Fehler` : null);
