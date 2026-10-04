'use client';

// ─── MAKE OS — Kapazität im Browser: laden und ändern (04.10.) ──────────────
// EIN Weg zur Kapazität: GET/PATCH /api/kapazitaet. Der Server rechnet und filtert (Erholung/Titel nur die eigenen),
// hier wird nichts gerechnet. Wer Meilensteine/Ziele speichert, ruft `kapazitaetNeu()` — dann laden alle Ansichten frisch.

import { useCallback, useEffect, useState } from 'react';
import type { KapaStand } from '@/lib/kapazitaet/typen';
import type { KapaOp } from '@/lib/kapazitaet/aendern';

export interface Bezug { art: 'mandat' | 'kunde'; id: string; label: string }
export interface KapaAntwort { ok: boolean; ich?: string; inhaber?: boolean; stand?: KapaStand; bezuege?: Bezug[]; fehler?: string }

const EREIGNIS = 'make-kapazitaet-neu';
/** Nach dem Speichern von Meilensteinen/Zielen: alle Kapazitäts-Ansichten laden neu. */
export function kapazitaetNeu() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EREIGNIS)); }

export function useKapazitaet(aktiv = true) {
  const [daten, setDaten] = useState<KapaAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zugang, setZugang] = useState(true);

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/kapazitaet', { cache: 'no-store' });
      if (r.status === 403 || r.status === 401) { setZugang(false); return; }
      const j = await r.json() as KapaAntwort;
      if (j.ok) { setDaten(j); setFehler(null); } else setFehler(j.fehler ?? 'Kapazität nicht geladen.');
    } catch { setFehler('Kapazität nicht geladen — Netz?'); }
  }, []);

  useEffect(() => {
    if (!aktiv) return;
    void laden();
    const neu = () => { void laden(); };
    // Meilensteine werden mit kurzer Verzögerung gespeichert (usePlanung) — kurz danach noch einmal.
    const spaet = () => { window.setTimeout(neu, 1500); };
    window.addEventListener(EREIGNIS, neu);
    window.addEventListener(EREIGNIS, spaet);
    return () => { window.removeEventListener(EREIGNIS, neu); window.removeEventListener(EREIGNIS, spaet); };
  }, [aktiv, laden]);

  /** Ändern — Antwort ist der neue Stand (oder der Fehlertext des Servers). */
  const aendern = useCallback(async (ops: KapaOp[]): Promise<string | null> => {
    try {
      const r = await fetch('/api/kapazitaet', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) });
      const j = await r.json() as KapaAntwort;
      if (!j.ok) return j.fehler ?? 'Nicht gespeichert.';
      setDaten(j);
      return null;
    } catch { return 'Nicht gespeichert — Netz?'; }
  }, []);

  return { stand: daten?.stand ?? null, ich: daten?.ich ?? null, inhaber: !!daten?.inhaber, bezuege: daten?.bezuege ?? [], fehler, zugang, laden, aendern };
}
