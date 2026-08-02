'use client';

// ─── MAKE OS — Sicher speichern ─────────────────────────────────────────────
// Eingaben werden gesammelt und kurz danach geschrieben (sonst gäbe es bei
// jedem Tastendruck eine Schreiboperation). Das Problem daran: Wer sofort
// die Seite wechselt oder den Tab schließt, verliert die letzte Eingabe.
//
// Dieser Hook schließt die Lücke — er schreibt in drei Fällen:
//   1. kurz nach der letzten Eingabe (wie bisher)
//   2. beim Verlassen der Seite (Unmount)
//   3. wenn der Tab in den Hintergrund geht oder geschlossen wird
//
// Was einmal eingetippt wurde, ist beim nächsten Öffnen wieder da.

import { useCallback, useEffect, useRef } from 'react';

export interface SpeichernOptionen {
  /** Wie lange nach der letzten Eingabe gewartet wird. */
  verzoegerung?: number;
  /** Wird nach jedem Schreibversuch aufgerufen — für „gespeichert ✓". */
  danach?: (ok: boolean) => void;
}

export function useSpeichern(pfad: string, opt: SpeichernOptionen = {}) {
  const { verzoegerung = 500, danach } = opt;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Was noch nicht geschrieben wurde — Grundlage für alle Sofort-Schreibungen. */
  const offen = useRef<unknown>(null);
  const danachRef = useRef(danach);
  danachRef.current = danach;

  /** Sofort schreiben, ohne zu warten. */
  const jetzt = useCallback(async (daten?: unknown) => {
    const nutzlast = daten !== undefined ? daten : offen.current;
    if (nutzlast === null || nutzlast === undefined) return;
    offen.current = null;
    clearTimeout(timer.current);
    try {
      const r = await fetch(pfad, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nutzlast),
        keepalive: true, // überlebt das Schließen des Tabs
      });
      if (!r.ok) console.error(`[MAKE OS] Speichern nach ${pfad} abgelehnt (${r.status}).`);
      danachRef.current?.(r.ok);
    } catch (err) {
      // Nicht verwerfen: beim nächsten Versuch nochmal probieren.
      offen.current = nutzlast;
      console.error(`[MAKE OS] Speichern nach ${pfad} fehlgeschlagen.`, err);
      danachRef.current?.(false);
    }
  }, [pfad]);

  /** Gesammelt speichern — der Normalfall beim Tippen. */
  const speichern = useCallback((daten: unknown) => {
    offen.current = daten;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void jetzt(); }, verzoegerung);
  }, [jetzt, verzoegerung]);

  // Tab wechselt weg oder wird geschlossen → sofort schreiben.
  useEffect(() => {
    const raus = () => { if (offen.current !== null) void jetzt(); };
    const beiSichtwechsel = () => { if (document.visibilityState === 'hidden') raus(); };
    window.addEventListener('pagehide', raus);
    document.addEventListener('visibilitychange', beiSichtwechsel);
    return () => {
      window.removeEventListener('pagehide', raus);
      document.removeEventListener('visibilitychange', beiSichtwechsel);
      // Seite wird verlassen → was offen ist, geht jetzt raus.
      clearTimeout(timer.current);
      if (offen.current !== null) void jetzt();
    };
  }, [jetzt]);

  return { speichern, jetzt };
}
