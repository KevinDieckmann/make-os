'use client';

// ─── Werkzeug-Muster — die Zoom-Leiste unten rechts (22.10., Miro-Art: − % + · Alles zeigen · Karte) ──────────────────────────────────────────
// Der Maßstab kommt aus der Kamera der Fläche (`onMassstab` an Bühne bzw. Werkstatt-Fläche, je Bild aufgerufen) und wird direkt in die Zahl geschrieben —
// kein React-Zustand je Bild (dieselbe Regel wie die Flächen: Kamera in Refs, gezeichnet per requestAnimationFrame).

import { useCallback, useRef, type ReactNode } from 'react';
import { Minus, Plus, Fullscreen } from 'lucide-react';
import { SymbolKnopf } from '../ui';

/** Der Maßstab als Zahl „87 %“: `setzen` (aus der Fläche, je Bild) merkt den Wert und schreibt ihn, wenn die Zahl sichtbar ist — erscheint die Leiste
 * später (Ort des Rahmens), steht sofort der letzte Wert da. */
export type MassstabRef = (el: HTMLSpanElement | null) => void;
export function useMassstab(): { ref: MassstabRef; setzen: (s: number) => void } {
  const el = useRef<HTMLSpanElement | null>(null);
  const wert = useRef(1);
  const schreib = useCallback(() => {
    const t = `${Math.round(wert.current * 100)} %`;
    if (el.current && el.current.textContent !== t) el.current.textContent = t;
  }, []);
  const setzen = useCallback((s: number) => { if (Number.isFinite(s) && s > 0) { wert.current = s; schreib(); } }, [schreib]);
  const ref = useCallback((e: HTMLSpanElement | null) => { el.current = e; schreib(); }, [schreib]);
  return { ref, setzen };
}

/** Die Zoom-Leiste: −, Maßstab, +, „Alles zeigen“ — dahinter, was die Fläche sonst noch hat (Karte/Minimap). */
export function ZoomLeiste({ onKleiner, onGroesser, onAlles, massstab, children }: {
  onKleiner: () => void; onGroesser: () => void; onAlles: () => void;
  massstab?: MassstabRef;
  children?: ReactNode;
}) {
  return (
    <div role="toolbar" aria-label="Zoom" className="wz-zoom">
      <SymbolKnopf ariaLabel="Verkleinern (−)" onClick={onKleiner}><Minus size={16} /></SymbolKnopf>
      {massstab && <span ref={massstab} className="wz-massstab" title="Maßstab der Fläche">100 %</span>}
      <SymbolKnopf ariaLabel="Vergrößern (+)" onClick={onGroesser}><Plus size={16} /></SymbolKnopf>
      <SymbolKnopf ariaLabel="Alles zeigen" onClick={onAlles}><Fullscreen size={16} /></SymbolKnopf>
      {children}
    </div>
  );
}
