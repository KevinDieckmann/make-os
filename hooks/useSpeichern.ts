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
//
// Zu zweit (24.09.): Mit `listen` schickt der Hook nicht mehr den ganzen
// Stand, sondern nur, was sich gegenüber dem zuletzt bekannten Serverstand
// geändert hat (PATCH mit Einzeländerungen, lib/sync.ts). Was Malin
// inzwischen an ANDEREN Einträgen geändert hat, bleibt so erhalten. Die Seite
// meldet den Serverstand mit `kenne(stand)` — nach dem Laden und nach jedem
// Abgleich.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { aenderungen, leer, type ListenSchluessel } from '@/lib/sync';

export interface SpeichernOptionen {
  /** Wie lange nach der letzten Eingabe gewartet wird. */
  verzoegerung?: number;
  /** Wird nach jedem Schreibversuch aufgerufen — für „gespeichert ✓". */
  danach?: (ok: boolean) => void;
  /** Zu zweit arbeiten: nur Einzeländerungen schicken (PATCH). Listen und ihr Schlüsselfeld. */
  listen?: ListenSchluessel;
  /** Nach dem Speichern: den Serverstand übernehmen (enthält die Änderungen des anderen) —
   *  nur, wenn inzwischen nichts Neues getippt wurde. */
  uebernehmen?: (stand: Record<string, unknown>) => void;
}

export function useSpeichern(pfad: string, opt: SpeichernOptionen = {}) {
  const { verzoegerung = 500, danach, listen } = opt;
  /** Der zuletzt bekannte Serverstand — Grundlage für den Vergleich. */
  const basis = useRef<Record<string, unknown> | null>(null);
  const uebernehmenRef = useRef(opt.uebernehmen);
  uebernehmenRef.current = opt.uebernehmen;
  const listenRef = useRef(listen);
  listenRef.current = listen;
  /** Eine Einzeländerung ist unterwegs — bis sie da ist, darf kein Abgleich drüber. */
  const unterwegs = useRef(false);
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
    const l = listenRef.current;
    if (l && basis.current) {
      const a = aenderungen(basis.current, nutzlast as Record<string, unknown>, l);
      if (leer(a)) { danachRef.current?.(true); return; }
      unterwegs.current = true;
      try {
        const r = await fetch(pfad, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a), keepalive: true,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.ok === false) {
          console.error(`[MAKE OS] Einzeländerung nach ${pfad} abgelehnt (${r.status}).`, d);
          danachRef.current?.(false);
          return;
        }
        basis.current = (d.stand as Record<string, unknown>) ?? (nutzlast as Record<string, unknown>);
        danachRef.current?.(true);
        if (d.stand && offen.current === null) uebernehmenRef.current?.(d.stand);
      } catch (err) {
        offen.current = nutzlast;
        console.error(`[MAKE OS] Speichern nach ${pfad} fehlgeschlagen.`, err);
        danachRef.current?.(false);
      } finally {
        unterwegs.current = false;
      }
      return;
    }
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

  /** Den Serverstand bekannt machen (nach dem Laden, nach dem Abgleich). */
  const kenne = useCallback((stand: unknown) => { basis.current = (stand && typeof stand === 'object') ? JSON.parse(JSON.stringify(stand)) : null; }, []);
  /** Liegt noch Ungespeichertes an? Dann darf ein Abgleich nicht drüberbügeln. */
  const hatOffenes = useCallback(() => offen.current !== null || unterwegs.current, []);

  // Stabil halten: Seiten hängen Ladefunktionen daran — ein neues Objekt je
  // Zeichnung hieße eine Ladeschleife.
  return useMemo(() => ({ speichern, jetzt, kenne, hatOffenes }), [speichern, jetzt, kenne, hatOffenes]);
}
