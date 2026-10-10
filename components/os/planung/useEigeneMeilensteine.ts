'use client';

// ─── MAKE OS — Eigene Meilensteine laden und schreiben (10.10., Kevin: „Ja, eigene Meilensteine“) ────────────────────────────────
// EIN Hook für die Spalten „Meine Ziele“ (schreiben) und „<Name>“ (nur lesen, was die andere Person über ihre Ziele teilt — der Server
// filtert, lib/planung/eigene-ziele-sicht.ts). Geschrieben wird nur als Einzeländerung mit Stand (ListenSchreiber) an
// PATCH /api/state/meilensteine-eigen; nach jedem gelungenen Schreiben zieht der Server den Fortschritt der eigenen Ziele nach — `nachSchreiben`
// lädt sie dann neu (sonst gäbe die nächste Änderung am Ziel ein 409).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListenSchreiber, type SchreibErgebnis } from '@/lib/make-one/liste-stand';
import type { EigenerMeilenstein } from '@/lib/planung/eigene-meilensteine';

type MsZeile = EigenerMeilenstein & { stand?: string };

export interface EigeneMeilensteineStand {
  geladen: boolean;
  ms: MsZeile[];
  /** Antwort des Servers — fremde Bestände nie. */
  darfSchreiben: boolean;
  /** Die neue Liste (die Ansicht reicht sie) — daraus wird je Meilenstein eine Änderung. */
  persist: (next: EigenerMeilenstein[]) => void;
  /** Hinweis nach einem abgelehnten Speichern — sonst null. */
  hinweis: string | null;
}

const PFAD = '/api/state/meilensteine-eigen';

function hinweisAus(e: SchreibErgebnis<unknown>): string | null {
  if (e.ok) return null;
  if (e.fehler?.startsWith('Abgelehnt')) return e.fehler;
  if (e.status === 409) return 'Inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.';
  return e.fehler ?? 'Nicht gespeichert.';
}

/** `fuer` = `'ich'` (eigene, schreiben) oder der Speichername einer anderen Person (nur lesen). `aktiv = false` lädt nichts. */
export function useEigeneMeilensteine(fuer: string, aktiv = true, nachSchreiben?: () => unknown): EigeneMeilensteineStand {
  const q = fuer === 'ich' ? '' : `?fuer=${encodeURIComponent(fuer)}`;
  const [ms, setMs] = useState<MsZeile[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [darfSchreiben, setDarfSchreiben] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const msRef = useRef<MsZeile[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nach = useRef(nachSchreiben); nach.current = nachSchreiben;
  const schreiber = useMemo(() => new ListenSchreiber<MsZeile>({ pfad: PFAD, liste: d => (Array.isArray(d.meilensteine) ? (d.meilensteine as MsZeile[]) : null) }), []);
  const zeigen = useCallback((l: MsZeile[]) => { msRef.current = l; setMs(l); }, []);

  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    setGeladen(false);
    fetch(`${PFAD}${q}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!lebt) return;
      const l: MsZeile[] = Array.isArray(d?.meilensteine) ? d.meilensteine : [];
      // Nicht geteilt / kein Zugang: leer, nur lesen — der Server hat nichts geschickt.
      const darf = fuer === 'ich' && d?.darfSchreiben === true;
      setDarfSchreiben(darf);
      // Nur mit bestätigtem Stand schreibbar (403 → nichts bekannt → nichts wird gesendet).
      if (darf) schreiber.kenne(l);
      zeigen((darf ? schreiber.sicht() : null) ?? l);
      setGeladen(true);
    }).catch(() => { if (lebt) setGeladen(true); });
    return () => { lebt = false; };
  }, [aktiv, fuer, q, schreiber, zeigen]);

  const persist = useCallback((next: EigenerMeilenstein[]) => {
    if (fuer !== 'ich' || !schreiber.geladen) return; // fremde nie, ohne bekannten Stand nichts
    schreiber.aendern(msRef.current, next as MsZeile[]);
    zeigen(next as MsZeile[]);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void schreiber.senden().then(e => {
        setHinweis(hinweisAus(e));
        if (e.sicht && !e.nichts) zeigen(e.sicht);
        if (e.ok && !e.nichts) void nach.current?.();
      });
    }, 400);
  }, [fuer, schreiber, zeigen]);

  // Beim Verlassen: Offenes noch senden.
  useEffect(() => () => { clearTimeout(timer.current); if (schreiber.hatOffenes) void schreiber.senden(); }, [schreiber]);

  return { geladen, ms, darfSchreiben, persist, hinweis };
}
