'use client';

// ─── Seil — Daten einer Ansicht holen (GET /api/seil, 07.10.) ──────────────────────────────────────────────────────────
// Hält die letzte Antwort, solange die nächste lädt (kein Flackern beim Blättern); bricht veraltete Anfragen ab. `neu()` lädt frisch
// (z. B. nachdem eine Aufgabe erledigt oder ein Bezug gesetzt wurde — dann füllt sich der Strang sichtbar).

import { useEffect, useState } from 'react';
import type { SeilAnsicht } from '@/lib/lichtfaeden/seil';

export type SeilEbene = 'jahr' | 'aufgaben';
export type SeilBereichWahl = 'alle' | 'privat' | 'business';
export interface SeilDaten { ebene: SeilEbene; bereich: SeilBereichWahl; ansicht: SeilAnsicht }
export interface SeilLaden { daten: SeilDaten | null; laedt: boolean; fehler: string | null; neu: () => void }

/** Ereignis: Bezüge oder Fortschritt haben sich geändert — offene Seile laden neu (Detail-Auswahl, Abhaken). */
export const SEIL_NEU = 'make-seil-neu';
export const seilNeuMelden = () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SEIL_NEU)); };

export function useSeil(o: { ebene: SeilEbene; bereich: SeilBereichWahl; von: string; bis: string; schluessel?: string | number }): SeilLaden {
  const [daten, setDaten] = useState<SeilDaten | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const { ebene, bereich, von, bis, schluessel } = o;
  useEffect(() => {
    const neu = () => setRunde(r => r + 1);
    window.addEventListener(SEIL_NEU, neu);
    return () => window.removeEventListener(SEIL_NEU, neu);
  }, []);
  // Ein neuer `schluessel` (z. B. Aufgaben geändert) lädt verzögert nach — erst wenn der Browser fertig gespeichert hat.
  const [spaet, setSpaet] = useState(schluessel);
  useEffect(() => { const t = setTimeout(() => setSpaet(schluessel), 1500); return () => clearTimeout(t); }, [schluessel]);
  useEffect(() => {
    const ab = new AbortController();
    setLaedt(true);
    const q = new URLSearchParams({ ebene, bereich, von, bis });
    fetch(`/api/seil?${q}`, { signal: ab.signal, cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.ok) throw new Error(d?.fehler ?? 'Das Seil ließ sich nicht laden.');
        setDaten({ ebene: d.ebene, bereich: d.bereich, ansicht: d.ansicht as SeilAnsicht }); setFehler(null);
      })
      .catch(e => { if (!ab.signal.aborted) setFehler(e instanceof Error ? e.message : 'Das Seil ließ sich nicht laden.'); })
      .finally(() => { if (!ab.signal.aborted) setLaedt(false); });
    return () => ab.abort();
  }, [ebene, bereich, von, bis, runde, spaet]);
  return { daten, laedt, fehler, neu: () => setRunde(r => r + 1) };
}
