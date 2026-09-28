'use client';

// ─── MAKE OS — Planung: Ziele, Meilensteine, Einheiten laden und schreiben ──
// EIN Hook für alle Horizonte (Tag · Woche · Monat · Quartal · Jahr). Ziele und
// Meilensteine sind GETEILTE Bestände: seit 28.09. gehen sie nur als
// Einzeländerungen mit Stand raus (lib/make-one/liste-stand.ts) — Anlegen,
// Ändern, Rang, Erledigt, Löschen je Eintrag. Die Antwort trägt schon die
// Kaskade (Quartal/Monat/Woche/Tag aus dem Jahr); gezeigt wird Serverstand +
// noch offene eigene Änderungen. Veralteter Stand → 409, Hinweis, aktueller
// Stand sichtbar — nichts wird still überschrieben. Einheiten je Haushalt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListenSchreiber, type SchreibErgebnis } from '@/lib/make-one/liste-stand';
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
  /** Hinweis nach einem abgelehnten Speichern (z. B. „inzwischen geändert“) — sonst null. */
  hinweis: string | null;
}

type ZielZeile = Ziel & { stand?: string };
type MsZeile = Meilenstein & { stand?: string };

/** Text für die Ansicht, wenn ein Speichern nicht durchging. */
function hinweisAus(e: SchreibErgebnis<unknown>): string | null {
  if (e.ok) return null;
  if (e.status === 409) return 'Jemand hat inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.';
  return e.fehler ?? 'Nicht gespeichert.';
}

const kopf = { 'Content-Type': 'application/json' };

export function usePlanung(horizont: ZielHorizont): PlanungStand {
  const heute = localDay();
  const zr = useMemo(() => zeitraum(horizont, heute), [horizont, heute]);
  const [ziele, setZiele] = useState<ZielZeile[]>([]);
  const [fokus, setFokus] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<MsZeile[]>([]);
  const [einheiten, setEinheiten] = useState<string[]>([...EINHEITEN_STANDARD]);
  const [geladen, setGeladen] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const zieleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const msTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Die aktuelle Sicht — Grundlage für „was hat die Person gerade geändert“. */
  const zieleRef = useRef<ZielZeile[]>([]);
  const msRef = useRef<MsZeile[]>([]);
  // Je Horizont ein Schreiber (Ziele) + einer für die Meilensteine.
  const zieleSchreiber = useMemo(() => new ListenSchreiber<ZielZeile>({
    pfad: '/api/state/ziele',
    koerper: ops => ({ horizont, ops }),
    liste: d => (Array.isArray(d[horizont]) ? (d[horizont] as ZielZeile[]) : null),
  }), [horizont]);
  const msSchreiber = useMemo(() => new ListenSchreiber<MsZeile>({
    pfad: '/api/state/meilensteine',
    liste: d => (Array.isArray(d.meilensteine) ? (d.meilensteine as MsZeile[]) : null),
  }), []);
  const zieleZeigen = useCallback((l: ZielZeile[]) => { zieleRef.current = l; setZiele(l); }, []);
  const msZeigen = useCallback((l: MsZeile[]) => { msRef.current = l; setMs(l); }, []);

  const ladeMs = useCallback(() => {
    fetch('/api/state/meilensteine', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!Array.isArray(d.meilensteine)) return;
      msSchreiber.kenne(d.meilensteine);
      msZeigen(msSchreiber.sicht() ?? d.meilensteine);
    }).catch(() => {});
  }, [msSchreiber, msZeigen]);

  useEffect(() => {
    let aktiv = true;
    setGeladen(false);
    fetch('/api/state/ziele', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!aktiv) return;
      const l: ZielZeile[] = Array.isArray(d[horizont]) ? d[horizont] : [];
      zieleSchreiber.kenne(l);
      zieleZeigen(zieleSchreiber.sicht() ?? l);
      setFokus(d.fokus && typeof d.fokus === 'object' ? d.fokus : {});
      setGeladen(true);
    }).catch(() => { if (aktiv) setGeladen(true); });
    ladeMs();
    fetch('/api/planung/einheiten').then(r => r.json()).then(d => { if (aktiv && Array.isArray(d.einheiten)) setEinheiten(d.einheiten); }).catch(() => {});
    return () => { aktiv = false; };
  }, [horizont, ladeMs, zieleSchreiber, zieleZeigen]);

  /** Die Ansicht reicht die neue Liste — hier wird daraus je Ziel eine Änderung (nie der ganze Horizont). */
  const persistZiele = useCallback((next: Ziel[]) => {
    if (!zieleSchreiber.geladen) return; // ohne bekannten Stand wird nichts geschrieben
    zieleSchreiber.aendern(zieleRef.current, next as ZielZeile[]);
    zieleZeigen(next as ZielZeile[]);
    clearTimeout(zieleTimer.current);
    zieleTimer.current = setTimeout(() => {
      void zieleSchreiber.senden().then(e => {
        setHinweis(hinweisAus(e));
        if (e.sicht && !e.nichts) zieleZeigen(e.sicht);
        // Termin-Ziele des Jahres sind Meilensteine geworden — den Stand nachladen.
        if (e.ok && !e.nichts && horizont === 'jahr') ladeMs();
      });
    }, 500);
  }, [horizont, ladeMs, zieleSchreiber, zieleZeigen]);

  const persistMs = useCallback((next: Meilenstein[]) => {
    if (!msSchreiber.geladen) return;
    msSchreiber.aendern(msRef.current, next as MsZeile[]);
    msZeigen(next as MsZeile[]);
    clearTimeout(msTimer.current);
    msTimer.current = setTimeout(() => {
      void msSchreiber.senden().then(e => {
        setHinweis(hinweisAus(e));
        if (e.sicht && !e.nichts) msZeigen(e.sicht);
      });
    }, 500);
  }, [msSchreiber, msZeigen]);

  // Beim Verlassen: Offenes noch senden (die Absichten liegen im Schreiber).
  useEffect(() => () => {
    clearTimeout(zieleTimer.current); clearTimeout(msTimer.current);
    if (zieleSchreiber.hatOffenes) void zieleSchreiber.senden();
    if (msSchreiber.hatOffenes) void msSchreiber.senden();
  }, [zieleSchreiber, msSchreiber]);

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

  return { heute, zr, geladen, ziele, fokus, ms, einheiten, persistZiele, persistMs, fokusSetzen, einheitAnlegen, hinweis };
}
