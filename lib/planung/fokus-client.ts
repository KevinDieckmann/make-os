'use client';

// ─── MAKE OS — Fokus im Browser: EIN Hook für Fokus-Seite, Heute, Planung, Ritual, Kompass (09.10.) ─────────────────────────────
// Liest und schreibt NUR über /api/planung/fokus (Bestände getrennt nach Privat/Business, lib/planung/fokus.ts). Schreiben mit dem Stand der
// Zelle — 409 lädt die neue Fassung und meldet es, die Eingabe bleibt beim Aufrufer. Nichts wird im Browser gefiltert: was ein Partner
// teilt, schickt der Server, sonst nichts.

import { useCallback, useEffect, useState } from 'react';
import type { FokusBereich, FokusHorizont, FokusWessen, FokusZelle } from './fokus';

export interface FokusPartnerZelle { speicher: string; vorname: string; text: string }
export interface FokusHorizontSicht { unser: FokusZelle; mein: FokusZelle & { geteilt: boolean }; partner: FokusPartnerZelle[] }
export interface FokusSichtBrowser {
  bereich: FokusBereich; einheit: string; jahr: number; laufend: number;
  horizonte: Record<FokusHorizont, FokusHorizontSicht>;
  einheiten: { id: string; name: string }[];
  partner: { speicher: string; vorname: string }[];
  darfUnser: boolean;
}
export type FokusSetzErgebnis = { ok: true } | { ok: false; meldung: string };

/** Ereignis nach jedem Schreiben — andere Karten derselben Seite laden neu. */
export const FOKUS_GEAENDERT = 'make-fokus-saetze-geaendert';

export function useFokus(bereich: FokusBereich | null, o: { einheit?: string; jahr?: number } = {}) {
  const [sicht, setSicht] = useState<FokusSichtBrowser | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const q = bereich ? `?bereich=${bereich}${o.einheit ? `&einheit=${encodeURIComponent(o.einheit)}` : ''}${o.jahr ? `&jahr=${o.jahr}` : ''}` : '';

  const laden = useCallback(async () => {
    if (!bereich) return;
    try {
      const r = await fetch(`/api/planung/fokus${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => null) as (FokusSichtBrowser & { ok?: boolean; error?: string }) | null;
      if (!r.ok || !d?.ok) { setSicht(null); setFehler(d?.error ?? 'Fokus gerade nicht erreichbar.'); return; }
      setSicht(d); setFehler(null);
    } catch { setFehler('Keine Verbindung.'); }
  }, [bereich, q]);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { const neu = () => { void laden(); }; window.addEventListener(FOKUS_GEAENDERT, neu); return () => window.removeEventListener(FOKUS_GEAENDERT, neu); }, [laden]);

  /** Einen Satz setzen (Unser bzw. Mein) oder Mein Fokus teilen — mit dem Stand der Zelle. */
  const schreiben = useCallback(async (wessen: FokusWessen, horizont: FokusHorizont, teil: { text?: string; geteilt?: boolean }): Promise<FokusSetzErgebnis> => {
    if (!bereich || !sicht) return { ok: false, meldung: 'Noch nicht geladen.' };
    const zelle = wessen === 'unser' ? sicht.horizonte[horizont].unser : sicht.horizonte[horizont].mein;
    try {
      const r = await fetch('/api/planung/fokus', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bereich, wessen, horizont, ...(horizont === 'jahr' ? { jahr: sicht.jahr } : {}), ...(wessen === 'unser' && bereich === 'business' ? { einheit: sicht.einheit } : {}), ...teil, stand: zelle.stand }),
      });
      const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; zelle?: FokusZelle & { geteilt?: boolean } };
      if (d.zelle) {
        const z = d.zelle;
        setSicht(s => (s ? { ...s, horizonte: { ...s.horizonte, [horizont]: { ...s.horizonte[horizont], ...(wessen === 'unser' ? { unser: { text: z.text, quelle: z.quelle, stand: z.stand } } : { mein: { text: z.text, quelle: z.quelle, stand: z.stand, geteilt: !!z.geteilt } }) } } } : s));
      }
      if (!r.ok || !d.ok) return { ok: false, meldung: d.error ?? `Nicht gespeichert (${r.status}).` };
      window.dispatchEvent(new Event(FOKUS_GEAENDERT));
      return { ok: true };
    } catch { return { ok: false, meldung: 'Keine Verbindung — nicht gespeichert. Deine Eingabe bleibt im Feld.' }; }
  }, [bereich, sicht]);

  return { sicht, fehler, laden, schreiben };
}
