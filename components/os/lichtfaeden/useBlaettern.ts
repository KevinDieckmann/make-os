'use client';

// ─── Lichtfäden — Blättern im Zeitfenster per Geste (30.09., aus dem Zeitstrahl übernommen) ─
// Kevin: „einzeln nach vorne und hinten scrollen“. Ziehen/Wischen (waagerecht, ab 8 px), Umschalt+Mausrad bzw. Trackpad
// waagerecht, Tasten ← → (Umschalt = Quartal). Senkrecht bleibt Seite rollen. Während des Ziehens verschiebt sich die
// Fläche sichtbar (`zug`); ein Ziehen löst keinen Klick aus.

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

export interface Blaettern {
  /** Sichtbare Verschiebung während des Ziehens (px). */
  zug: number;
  /** Wurde gerade gezogen? (Klick danach ignorieren) */
  gezogen: () => boolean;
  griffe: {
    onKeyDown: (e: KeyboardEvent) => void;
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => boolean;
    onPointerUp: (e: PointerEvent) => void;
    onPointerCancel: () => void;
  };
}

/** `monatBreite` = Pixel je Monat (ein Monat je Monatsbreite gezogen). */
export function useBlaettern(box: RefObject<HTMLElement | null>, onBlaettern: ((n: number) => void) | undefined, monatBreite: number): Blaettern {
  const [zug, setZug] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number; aktiv: boolean } | null>(null);
  const gezogen = useRef(false);
  const ruf = useRef(onBlaettern); ruf.current = onBlaettern;
  const rad = useRef(0);
  useEffect(() => {
    const el = box.current;
    if (!el || !onBlaettern) return;
    const aufRad = (e: WheelEvent) => {
      const dx = e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY) ? e.deltaY : e.deltaX;
      if (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      rad.current += dx;
      const schritt = Math.max(40, monatBreite * 0.6);
      const n = Math.trunc(rad.current / schritt);
      if (n) { rad.current -= n * schritt; ruf.current?.(n); }
    };
    el.addEventListener('wheel', aufRad, { passive: false });
    return () => el.removeEventListener('wheel', aufRad);
  }, [box, onBlaettern, monatBreite]);

  return {
    zug,
    gezogen: () => { const g = gezogen.current; gezogen.current = false; return g; },
    griffe: {
      onKeyDown: e => {
        if (!ruf.current || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        ruf.current((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 3 : 1));
      },
      onPointerDown: e => { if (!ruf.current || e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, aktiv: false }; gezogen.current = false; },
      onPointerMove: e => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return false;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.aktiv && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { d.aktiv = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* egal */ } }
        if (d.aktiv) { gezogen.current = true; setZug(dx); return true; }
        return false;
      },
      onPointerUp: e => {
        const d = drag.current; drag.current = null;
        if (d?.aktiv) { const n = Math.round(-(e.clientX - d.x) / Math.max(1, monatBreite)); setZug(0); if (n) ruf.current?.(n); }
      },
      onPointerCancel: () => { drag.current = null; setZug(0); },
    },
  };
}
