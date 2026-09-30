'use client';

// ─── MAKE OS — Planung: Hinweis mit „Rückgängig“ (30.09.) ───────────────────
// Wie bei den Aufgaben (components/os/aufgaben/Handlung.tsx, #87): nach dem
// Löschen eines Meilensteins oder Ziels steht unten ein Hinweis mit
// „Rückgängig“ — gleiche Dauer, gleiches Aussehen. Zurückholen legt den Eintrag
// über denselben Schreibweg wieder an (ohne Stand = neu).

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { RUECKGAENGIG_MS } from '../aufgaben/Handlung';

export interface Rueckgaengig {
  /** Hinweis zeigen; mit `rueck` gibt es den Knopf „Rückgängig“. */
  melden: (text: string, rueck?: () => void) => void;
  /** Der Hinweis selbst — einmal in die Seite hängen. */
  hinweis: ReactNode;
}

export function useRueckgaengig(): Rueckgaengig {
  const [h, setH] = useState<{ id: number; text: string; rueck?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const melden = useCallback((text: string, rueck?: () => void) => {
    const id = Date.now();
    setH({ id, text, rueck });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setH(x => (x?.id === id ? null : x)), RUECKGAENGIG_MS);
  }, []);
  const hinweis = h ? (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 9998, width: 'min(460px, calc(100vw - 32px))',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', borderRadius: 14, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.7)', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</span>
      {h.rueck && <button onClick={() => { const r = h.rueck; setH(null); r?.(); }} className="fassbar" style={{ background: 'none', border: `1px solid ${C.aktiv}66`, borderRadius: 10, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '8px 12px', minHeight: 40 }}>Rückgängig</button>}
      <button onClick={() => setH(null)} aria-label="Hinweis schließen" className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 18, minWidth: 36, minHeight: 36 }}>×</button>
    </div>
  ) : null;
  return { melden, hinweis };
}
