'use client';

// ─── Heute: Tages-Briefing (10.10., Branch `heute-top3`) ────────────────────────────────────────────────────────────────────────
// Kevin 08.10. (Fragebogen): „kurzes Tages-Briefing als Text“. Drei bis fünf Sätze: was ansteht, was brennt, was auf Freigabe wartet, die Top 3,
// ein Hinweis zum Fokus. Der Text kommt vom Server (GET /api/heute/briefing?space=…, Regelwerk aus den Zahlen DIESES Bereichs — kein Modell,
// nichts aus dem anderen Bereich) und frischt sich auf, wenn sich etwas ändert (Top 3 festgelegt) oder man ins Fenster zurückkehrt.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE, SPACE_LABEL } from '@/lib/make-one/space-regeln';
import { Karte, Ueberschrift, Leer } from '../ui';
import type { TopBereich } from '@/lib/heute/top3';

/** Andere Karten von Heute melden hiermit, dass sich etwas geändert hat, das im Briefing steht (Top 3 festgelegt). */
export const HEUTE_GEAENDERT = 'make-heute-geaendert';
export const heuteGeaendert = (): void => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(HEUTE_GEAENDERT)); };

/** `vorgabe`: schon geladene Sätze als Startzustand (Render-Test, Vorschau) — im Betrieb leer, die Karte lädt dann selbst. */
export function BriefingKarte({ i, sicht, titel, vorgabe }: { i: number; sicht: TopBereich; titel?: string; vorgabe?: string[] }) {
  const [saetze, setSaetze] = useState<string[] | null | undefined>(vorgabe);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/heute/briefing?space=${sicht}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() as { saetze?: string[] } : null;
      setSaetze(Array.isArray(d?.saetze) && d!.saetze!.length ? d!.saetze! : null);
    } catch { setSaetze(prev => prev ?? null); }
  }, [sicht]);
  useEffect(() => { setSaetze(undefined); void laden(); }, [laden]);
  useEffect(() => {
    const frisch = () => { if (document.visibilityState === 'visible') void laden(); };
    const spaeter = () => { window.setTimeout(() => { void laden(); }, 600); };
    document.addEventListener('visibilitychange', frisch);
    window.addEventListener('focus', frisch);
    window.addEventListener(HEUTE_GEAENDERT, spaeter);
    return () => { document.removeEventListener('visibilitychange', frisch); window.removeEventListener('focus', frisch); window.removeEventListener(HEUTE_GEAENDERT, spaeter); };
  }, [laden]);

  if (saetze === null) return null; // der Bereich gehört nicht zu dieser Person oder nichts erreichbar — keine leere Karte
  return (
    <Karte i={i} akzent={SPACE_FARBE[sicht]}>
      <Ueberschrift farbe={SPACE_FARBE[sicht]} erklaerung="heute.briefing">{titel ?? `Tages-Briefing · ${SPACE_LABEL[sicht]}`}</Ueberschrift>
      {saetze === undefined ? <Leer>lade …</Leer> : <p style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.6, color: C.ink }}>{saetze.join(' ')}</p>}
    </Karte>
  );
}
