'use client';

// ─── Gesundheit › Erholung — Laden und Ändern im Browser (10.10.) ─────────────────────────────────────────────────────────────────
// EIN Haken für Reiter (components/os/gesundheit/Erholung.tsx) und Heute-Widget (ErholungHeute.tsx) — eigene Datei, damit das Widget
// ohne die Fläche geladen wird (keine Import-Schleife widgets → Erholung → Fläche → widgets).

import { useCallback, useEffect, useRef, useState } from 'react';
import { LEUCHT } from '@/lib/make-one/design';
import type { ErholungStand } from '@/lib/gesundheit/erholung';
import type { ErholungSicht } from '@/lib/gesundheit/erholung-server';

/** Farbe des Bereichs Erholung (Gesundheit). */
export const ERHOLUNG_FARBE = LEUCHT.gut;
/** Ereignis nach jedem Speichern — Heute-Widget und andere Karten laden nach. */
export const ERHOLUNG_GEAENDERT = 'make-erholung-geaendert';

export interface ErholungAntwort { ok: boolean; ich: string; fuer: string; eigene: boolean; erholung: ErholungStand; stand?: string; sicht: ErholungSicht; error?: string }
export type Op = Record<string, unknown>;

/** Laden und Ändern der Erholung — `fuer` = andere Person (nur lesen, nur geteilt). */
export function useErholung(fuer?: string, aktiv = true) {
  const [d, setD] = useState<ErholungAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const stand = useRef<string | null>(null);
  // Schreiben nacheinander (schnelles Abhaken zweier Programme): jeder Schritt wartet auf den Stand des vorigen — sonst 409.
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  // Wer gespeichert hat, lädt nicht selbst nach (die Antwort trägt den neuen Stand) — nur die anderen Karten.
  const ich = useRef({});
  const url = `/api/gesundheit/erholung${fuer ? `?fuer=${encodeURIComponent(fuer)}` : ''}`;
  const laden = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const x = (await r.json().catch(() => null)) as ErholungAntwort | null;
      if (r.ok && x?.ok) { setD(x); stand.current = x.stand ?? null; setFehler(null); }
      else { setD(null); setFehler(x?.error ?? null); }
    } catch { /* offline — beim nächsten Mal */ }
    setGeladen(true);
  }, [url]);
  useEffect(() => { if (aktiv) void laden(); }, [laden, aktiv]);
  useEffect(() => {
    const neu = (e: Event) => { if (aktiv && (e as CustomEvent).detail !== ich.current) void laden(); };
    window.addEventListener(ERHOLUNG_GEAENDERT, neu);
    return () => window.removeEventListener(ERHOLUNG_GEAENDERT, neu);
  }, [laden, aktiv]);
  const einmal = useCallback(async (ops: Op[]): Promise<boolean> => {
    setFehler(null);
    try {
      const r = await fetch('/api/gesundheit/erholung', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stand: stand.current, ops }) });
      const x = await r.json().catch(() => ({}));
      if (r.ok && x.ok) {
        stand.current = x.stand ?? null;
        setD(alt => (alt ? { ...alt, erholung: x.erholung, sicht: x.sicht, stand: x.stand } : alt));
        window.dispatchEvent(new CustomEvent(ERHOLUNG_GEAENDERT, { detail: ich.current }));
        return true;
      }
      if (r.status === 409 && x.konflikt) await laden();
      setFehler(x.error ?? 'Nicht gespeichert.');
      return false;
    } catch { setFehler('Nicht gespeichert — offline?'); return false; }
  }, [laden]);
  const aendern = useCallback((ops: Op[]): Promise<boolean> => {
    const p = kette.current.then(() => einmal(ops));
    kette.current = p.catch(() => false);
    return p;
  }, [einmal]);
  return { d, fehler, geladen, laden, aendern };
}

