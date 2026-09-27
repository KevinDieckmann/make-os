'use client';

// ─── Sport — Daten im Browser: laden mit ETag, Schritte schicken ────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Op, SportStand, Uebung, Vorlage } from '@/lib/sport/modell';
import type { VitalTag } from '@/app/api/sport/route';

export interface SportAntwort { ok: boolean; ich: string; heute: string; stand: SportStand; vitals: Record<string, VitalTag>; bibliothek: { uebungen: Uebung[]; vorlagen: Vorlage[] } }

export function useSport() {
  const [d, setD] = useState<SportAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/sport', { cache: 'no-store', headers: etag.current ? { 'If-None-Match': etag.current } : {} });
      if (r.status === 304) return;
      if (r.status === 401) { setFehler('Bitte anmelden.'); return; }
      const j = (await r.json()) as SportAntwort & { error?: string };
      if (!j.ok) { setFehler(j.error ?? 'Nicht geladen.'); return; }
      etag.current = r.headers.get('etag');
      setD(j); setFehler(null);
    } catch { setFehler('Nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const zeige = useCallback((text: string) => {
    setMeldung(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMeldung(null), 2600);
  }, []);

  /** Schritte an den Server — bei Erfolg kommt der neue Stand zurück, bei Fehler ein Satz. */
  const schicke = useCallback(async (ops: Op[], erfolg = 'Gespeichert.'): Promise<boolean> => {
    try {
      const r = await fetch('/api/sport', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) });
      const j = (await r.json()) as { ok: boolean; stand?: SportStand; error?: string };
      if (!j.ok || !j.stand) { zeige(j.error ?? 'Nicht gespeichert.'); return false; }
      etag.current = null;
      setD(alt => (alt ? { ...alt, stand: j.stand! } : alt));
      zeige(erfolg);
      return true;
    } catch { zeige('Nicht erreichbar.'); return false; }
  }, [zeige]);

  return { d, fehler, meldung, laden, schicke };
}
