'use client';

// ─── Lichtfäden v2 — Daten einer Ansicht holen (GET /api/lichtfaeden) ──────
// Hält die letzte Antwort, solange die nächste lädt (kein Flackern beim Auffächern); bricht veraltete Anfragen ab.

import { useEffect, useState } from 'react';
import type { Ansicht } from '@/lib/lichtfaeden/baum';
import type { Engstelle } from '@/lib/lichtfaeden/fokus';

export interface LichtPerson { id: string; name: string; ich: boolean }
export interface LichtDaten {
  heute: string; sicht: string; personen: LichtPerson[]; ansicht: Ansicht; engstellen: Engstelle[]; text: string;
  /** Schlüssel der Anfrage, die diese Antwort geholt hat (`lichtSchluessel`) — daran hängt ein Ebenen-Übergang. */
  schluessel: string;
}
export interface LichtAnfrageOptionen { wurzel: string; person: string; von: string; bis: string }
/** Der Schlüssel einer Anfrage: Ebene | Person | Zeitraum. Ein Übergang gilt NUR für die Antwort mit genau diesem Schlüssel. */
export const lichtSchluessel = (o: LichtAnfrageOptionen): string => `${o.wurzel}|${o.person}|${o.von}|${o.bis}`;
export interface LichtLaden { daten: LichtDaten | null; laedt: boolean; fehler: string | null; neu: () => void }

export function useLichtfaeden(o: LichtAnfrageOptionen): LichtLaden {
  const [daten, setDaten] = useState<LichtDaten | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const { wurzel, person, von, bis } = o;
  useEffect(() => {
    const ab = new AbortController();
    setLaedt(true);
    const schluessel = lichtSchluessel({ wurzel, person, von, bis });
    const q = new URLSearchParams({ wurzel, person, von, bis });
    fetch(`/api/lichtfaeden?${q}`, { signal: ab.signal })
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.ok) throw new Error(d?.fehler ?? 'Die Lichtfäden ließen sich nicht laden.');
        setDaten({ ...(d as Omit<LichtDaten, 'schluessel'>), schluessel }); setFehler(null);
      })
      .catch(e => { if (!ab.signal.aborted) setFehler(e instanceof Error ? e.message : 'Die Lichtfäden ließen sich nicht laden.'); })
      .finally(() => { if (!ab.signal.aborted) setLaedt(false); });
    return () => ab.abort();
  }, [wurzel, person, von, bis, runde]);
  return { daten, laedt, fehler, neu: () => setRunde(r => r + 1) };
}
