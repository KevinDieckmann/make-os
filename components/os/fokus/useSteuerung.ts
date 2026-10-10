'use client';

// ─── Fokus-Steuerung im Browser (10.10.) — lesen und schreiben NUR über /api/fokus/steuerung ───────────────────────────────────
// Der Bereich kommt von der Seite (Kopf-Schalter); der Server liefert nur diesen Bereich. Themen schreiben mit dem Stand der letzten
// Antwort (409 → die neue Fassung wird geladen, die Meldung bleibt stehen); Soll je Thema ohne Stand (eigene Daten).

import { useCallback, useEffect, useState } from 'react';
import type { SteuerBereich, SteuerThema } from '@/lib/fokus/steuerung';
import type { SteuerSicht } from '@/lib/fokus/steuerung-server';
import { ZEIT_EREIGNIS } from '../zeit/fokus-beenden';

/** Die Sicht der Fokus-Steuerung — dieselbe Form wie der Server sie liefert. */
export type SteuerungSicht = SteuerSicht;
/** Ereignis nach jeder Änderung (andere Karten der Seite laden neu). */
export const STEUERUNG_EREIGNIS = 'make-fokus-steuerung';

export function useSteuerung(bereich: SteuerBereich | null) {
  const [sicht, setSicht] = useState<SteuerungSicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    if (!bereich) return;
    try {
      const r = await fetch(`/api/fokus/steuerung?bereich=${bereich}`, { cache: 'no-store' });
      const d = await r.json().catch(() => null) as (SteuerungSicht & { ok?: boolean; error?: string }) | null;
      if (!r.ok || !d?.ok) { setSicht(null); setFehler(d?.error ?? 'Die Steuerung ist gerade nicht erreichbar.'); return; }
      setSicht(d); setFehler(null);
    } catch { setFehler('Die Steuerung ist gerade nicht erreichbar.'); } finally { setLaedt(false); }
  }, [bereich]);

  useEffect(() => {
    setSicht(null); setLaedt(true);
    void laden();
    const neu = () => { void laden(); };
    window.addEventListener(ZEIT_EREIGNIS, neu);
    window.addEventListener(STEUERUNG_EREIGNIS, neu);
    return () => { window.removeEventListener(ZEIT_EREIGNIS, neu); window.removeEventListener(STEUERUNG_EREIGNIS, neu); };
  }, [laden]);

  const senden = useCallback(async (koerper: Record<string, unknown>): Promise<{ ok: boolean; meldung?: string }> => {
    if (!bereich) return { ok: false, meldung: 'Kein Bereich.' };
    try {
      const r = await fetch('/api/fokus/steuerung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bereich, ...koerper }) });
      const d = await r.json().catch(() => null) as { ok?: boolean; error?: string; sicht?: SteuerungSicht } | null;
      if (r.status === 409 && d?.sicht) setSicht(d.sicht);
      if (!r.ok || !d?.ok) return { ok: false, meldung: d?.error ?? 'Nicht gespeichert.' };
      await laden();
      window.dispatchEvent(new Event(STEUERUNG_EREIGNIS));
      return { ok: true };
    } catch { return { ok: false, meldung: 'Nicht erreichbar — nicht gespeichert.' }; }
  }, [bereich, laden]);

  /** Die ganze Themenliste (Reihenfolge = Rang) mit dem Stand der letzten Antwort. */
  const themenSetzen = useCallback((themen: SteuerThema[]) => senden({ aktion: 'themen', themen: themen.map(({ id, label, gewicht, zeit, einheit }) => ({ id, label, gewicht, zeit, ...(einheit ? { einheit } : {}) })), stand: sicht?.stand ?? '' }), [senden, sicht?.stand]);
  const vorgabe = useCallback(() => senden({ aktion: 'vorgabe', stand: sicht?.stand ?? '' }), [senden, sicht?.stand]);
  const sollSetzen = useCallback((id: string, stunden: number | null) => senden({ aktion: 'soll', soll: { [id]: stunden } }), [senden]);

  return { sicht, fehler, laedt, laden, themenSetzen, vorgabe, sollSetzen };
}
