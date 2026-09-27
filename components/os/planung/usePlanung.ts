'use client';

// ─── MAKE OS — Planung: Ziele, Meilensteine, Einheiten laden und schreiben ──
// EIN Hook für alle Horizonte (Tag · Woche · Monat · Quartal · Jahr). Die
// Ziele eines Horizonts werden als Liste geschrieben; die Antwort des Servers
// trägt schon die Kaskade (Quartal/Monat/Woche/Tag aus dem Jahr) und wird
// übernommen, sofern inzwischen nichts Neues getippt wurde. Meilensteine gehen
// als Einzel-Änderungen (Zwei-Fenster-Fundament), Einheiten je Haushalt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listeSchreiben } from '@/lib/make-one/liste-sync';
import { localDay } from '@/lib/zeit';
import { EINHEITEN_STANDARD } from '@/lib/planung/einheiten';
import { zeitraum, type Zeitraum } from '@/lib/planung/zeitraum';
import type { Meilenstein, Ziel, ZielHorizont } from '@/lib/planung/typen';

export interface PlanungStand {
  heute: string;
  zr: Zeitraum;
  geladen: boolean;
  ziele: Ziel[];
  fokus: Record<string, string>;
  ms: Meilenstein[];
  einheiten: string[];
  persistZiele: (next: Ziel[]) => void;
  persistMs: (next: Meilenstein[]) => void;
  fokusSetzen: (schluessel: string, wert: string) => void;
  einheitAnlegen: (name: string) => Promise<string | null>;
}

const kopf = { 'Content-Type': 'application/json' };

export function usePlanung(horizont: ZielHorizont): PlanungStand {
  const heute = localDay();
  const zr = useMemo(() => zeitraum(horizont, heute), [horizont, heute]);
  const [ziele, setZiele] = useState<Ziel[]>([]);
  const [fokus, setFokus] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<Meilenstein[]>([]);
  const [einheiten, setEinheiten] = useState<string[]>([...EINHEITEN_STANDARD]);
  const [geladen, setGeladen] = useState(false);
  const zieleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const msTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Zuletzt gelesener/geschriebener Meilenstein-Stand — Basis für die Unterschiede. */
  const msGespeichert = useRef<Meilenstein[] | null>(null);
  /** Zählt jede Ziel-Änderung — eine Server-Antwort gilt nur, wenn inzwischen nichts Neues kam. */
  const version = useRef(0);

  const ladeMs = useCallback(() => {
    fetch('/api/state/meilensteine').then(r => r.json()).then(d => { const l = Array.isArray(d.meilensteine) ? d.meilensteine : []; msGespeichert.current = l; setMs(l); }).catch(() => {});
  }, []);

  useEffect(() => {
    let aktiv = true;
    setGeladen(false);
    fetch('/api/state/ziele').then(r => r.json()).then(d => {
      if (!aktiv) return;
      setZiele(Array.isArray(d[horizont]) ? d[horizont] : []);
      setFokus(d.fokus && typeof d.fokus === 'object' ? d.fokus : {});
      setGeladen(true);
    }).catch(() => { if (aktiv) setGeladen(true); });
    ladeMs();
    fetch('/api/planung/einheiten').then(r => r.json()).then(d => { if (aktiv && Array.isArray(d.einheiten)) setEinheiten(d.einheiten); }).catch(() => {});
    return () => { aktiv = false; };
  }, [horizont, ladeMs]);

  const persistZiele = useCallback((next: Ziel[]) => {
    setZiele(next);
    const v = ++version.current;
    clearTimeout(zieleTimer.current);
    zieleTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: kopf, body: JSON.stringify({ horizont, ziele: next }) })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d || version.current !== v) return;
          if (Array.isArray(d[horizont])) setZiele(d[horizont]);
          // Termin-Ziele des Jahres sind Meilensteine geworden — den Stand nachladen.
          if (horizont === 'jahr') ladeMs();
        })
        .catch(() => {});
    }, 500);
  }, [horizont, ladeMs]);

  const persistMs = useCallback((next: Meilenstein[]) => {
    setMs(next);
    clearTimeout(msTimer.current);
    msTimer.current = setTimeout(() => {
      const alt = msGespeichert.current;
      msGespeichert.current = next;
      void listeSchreiben<Meilenstein>('/api/state/meilensteine', 'meilensteine', alt, next);
    }, 500);
  }, []);

  const fokusSetzen = useCallback((schluessel: string, wert: string) => {
    setFokus(a => ({ ...a, [schluessel]: wert }));
    clearTimeout(fokusTimer.current);
    fokusTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: kopf, body: JSON.stringify({ horizont: schluessel, fokus: wert }) }).catch(() => {});
    }, 600);
  }, []);

  const einheitAnlegen = useCallback(async (name: string): Promise<string | null> => {
    try {
      const r = await fetch('/api/planung/einheiten', { method: 'POST', headers: kopf, body: JSON.stringify({ name }) });
      const d = await r.json();
      if (!r.ok || !d.einheit) return null;
      if (Array.isArray(d.einheiten)) setEinheiten(d.einheiten);
      return d.einheit as string;
    } catch { return null; }
  }, []);

  return { heute, zr, geladen, ziele, fokus, ms, einheiten, persistZiele, persistMs, fokusSetzen, einheitAnlegen };
}
