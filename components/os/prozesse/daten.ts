'use client';

// ─── Prozesse — Daten im Browser (Etappe A, 21.10.) ─────────────────────────────────────────────────────────────────────────────────────────
// EIN Abruf: GET /api/prozesse/landkarte?space=business (serverseitig nur Business, ETag). Beim Zurückkehren in den Tab frisch (der Bündler teilt gleiche
// Anfragen, der Server antwortet 304, wenn sich nichts geändert hat). Rechnet nichts — Lage und Regeln stehen in lib/prozesse/*.

import { useCallback, useEffect, useState } from 'react';
import type { LandkarteDaten } from '@/lib/prozesse/typen';

export const LANDKARTE_QUELLE = '/api/prozesse/landkarte?space=business';

export function useLandkarte(): { daten: LandkarteDaten | null; fehler: string | null; neu: () => Promise<void> } {
  const [daten, setDaten] = useState<LandkarteDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch(LANDKARTE_QUELLE).catch(() => null);
    const j = r ? await r.json().catch(() => null) as (LandkarteDaten & { fehler?: string }) | null : null;
    if (!r || !r.ok || !j?.ok) { setFehler(String(j?.fehler ?? 'Die Prozesse ließen sich nicht laden.')); return; }
    setFehler(null);
    setDaten(alt => (alt?.stand === j.stand ? alt : j));
  }, []);
  useEffect(() => {
    void laden();
    const sicht = () => { if (!document.hidden) void laden(); };
    document.addEventListener('visibilitychange', sicht);
    return () => document.removeEventListener('visibilitychange', sicht);
  }, [laden]);
  return { daten, fehler, neu: laden };
}

/** Antwort von POST /api/prozesse/landkarte (Landkarte anpassen) — bei 409 mit der aktuellen Fassung. */
export interface AnpassenAntwort { status: number; j: { ok?: boolean; fehler?: string; anpassung?: import('@/lib/prozesse/landkarte-anpassung').LandkarteAnpassung; anpassungStand?: string } | null }
let anpassenKette: Promise<unknown> = Promise.resolve();
/**
 * EIN Schreibweg „Landkarte anpassen“ (POST, nacheinander): der Körper entsteht erst, wenn die Anfrage an der Reihe ist (`koerper()`), damit der Stand aus der
 * letzten Antwort kommt. Netzfehler → Status 0 (nie geworfen).
 */
export function landkarteAnpassen(koerper: () => { stand: string; ops: import('@/lib/prozesse/landkarte-anpassung').LandkarteOp[] }): Promise<AnpassenAntwort> {
  const lauf = anpassenKette.then(async (): Promise<AnpassenAntwort> => {
    const r = await fetch(LANDKARTE_QUELLE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(koerper()) }).catch(() => null);
    if (!r) return { status: 0, j: null };
    return { status: r.status, j: await r.json().catch(() => null) };
  });
  anpassenKette = lauf.catch(() => undefined);
  return lauf;
}
