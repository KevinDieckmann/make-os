'use client';

// ─── Standard · Reise + Fluss — die Pfeile des Flusses als Lichtfäden (Markenzeichen: der Flow, 17.10.; DESIGN_STANDARD.md › Markenzeichen: der Flow) ───
// EINE Ebene je Fluss (eine Leinwand hinter den Knoten): jeder Pfeil (`data-flow-pfeil` = Zustand, `data-flow-art` = weiter · ja · nein) wird ein feiner
// Faden in Laufrichtung — erledigt hell, offen gedämpft, der Pfeil in den aktuellen Knoten glüht am Ende, der Nein-Pfad zur Erinnerung im Ton der Erinnerung.
// Genutzt vom Fluss (Fall, Einrichtung, Planung) und vom Prozess-Editor — derselbe Zeichner wie Reise und Fläche (lib/lichtfaeden/flow.ts). Keine Daten-Importe.

import { pfeilFaden, type PfeilArt, type PfeilZustand } from '@/lib/reise/flow';
import type { FlowFaden } from '@/lib/lichtfaeden/flow';
import { FlowLinie } from '../flow';
import { FLOW_TON } from './formen';

const ZUSTAENDE: readonly PfeilZustand[] = ['erledigt', 'hier', 'offen'];
const ARTEN: readonly PfeilArt[] = ['weiter', 'ja', 'nein'];

/**
 * Die Pfeile eines Flusses als Fäden — gemessen an den Pfeilen im Bild (relativ zur Leinwand). Senkrecht (oben → unten, endet in der Spitze) bzw. quer
 * (Seitenpfeil, unter seinem Wort „nein“; am Handy gedreht = senkrecht). Unsichtbare Pfeile fallen weg.
 */
export function flussFaeden(eltern: HTMLElement, box: Pick<DOMRect, 'left' | 'top'>): FlowFaden[] {
  const raus: FlowFaden[] = [];
  eltern.querySelectorAll<HTMLElement>('[data-flow-pfeil]').forEach((el, n) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return;
    const z = (ZUSTAENDE as readonly string[]).includes(el.dataset.flowPfeil ?? '') ? (el.dataset.flowPfeil as PfeilZustand) : 'offen';
    const art = (ARTEN as readonly string[]).includes(el.dataset.flowArt ?? '') ? (el.dataset.flowArt as PfeilArt) : 'weiter';
    const x0 = r.left - box.left, y0 = r.top - box.top;
    const quer = r.width > r.height;
    const von: [number, number] = quer ? [x0 + 2, y0 + r.height - 2] : [x0 + r.width / 2, y0 + 1];
    const nach: [number, number] = quer ? [x0 + r.width - 4, y0 + r.height - 2] : [x0 + r.width / 2, y0 + r.height - 5];
    raus.push(pfeilFaden(`pf-${n}`, von, nach, z, art, FLOW_TON));
  });
  return raus;
}

/** Die Faden-Ebene eines Flusses — als letztes Kind in `.ff-fluss` (globals.css legt sie hinter die Knoten). */
export function FlussFaden({ still }: { still?: boolean }) {
  return <FlowLinie messen={flussFaeden} still={still} />;
}
