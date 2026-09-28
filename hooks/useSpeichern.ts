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
import { aenderungen, leer, schluesselVon, type Aenderung, type ListenSchluessel } from '@/lib/sync';

/** Was beim Schreiben schiefging — Status und Text vom Server (409 = inzwischen geändert). */
export interface SpeichernFehler { status: number; fehler?: string }

/**
 * Stand je Eintrag aus dem letzten SERVERstand übernehmen (28.09., K3 · #107): Die Sicht der Seite kann
 * noch die Fassung von vor dem letzten eigenen Speichern tragen — die zählt nicht als Änderung und
 * darf nicht als „veraltet“ zum Server gehen. Liefert die Sicht mit den Fassungen der Basis.
 */
export function standAusBasis(basis: Record<string, unknown>, sicht: Record<string, unknown>, listen: ListenSchluessel, feld: string): Record<string, unknown> {
  const aus: Record<string, unknown> = { ...sicht };
  for (const [name, schluessel] of Object.entries(schluesselVon(listen))) {
    const alt = new Map(((basis[name] as Record<string, unknown>[] | undefined) ?? []).map(x => [String(x[schluessel]), x]));
    const l = sicht[name] as Record<string, unknown>[] | undefined;
    if (!Array.isArray(l)) continue;
    aus[name] = l.map(x => {
      const b = alt.get(String(x[schluessel]));
      if (!b || !(feld in b)) { if (!(feld in x)) return x; const { [feld]: _weg, ...rest } = x; return rest; }
      return { ...x, [feld]: b[feld] };
    });
  }
  return aus;
}

/** Löschungen tragen den Stand der Basis mit (`stand`), damit der Server auch sie prüfen kann. */
export function loeschStand(a: Aenderung, basis: Record<string, unknown>, listen: ListenSchluessel, feld: string): Aenderung {
  const sl = schluesselVon(listen);
  return {
    ...a,
    ops: a.ops.map(o => {
      if (o.op !== 'delete') return o;
      const b = ((basis[o.liste] as Record<string, unknown>[] | undefined) ?? []).find(x => String(x[sl[o.liste] ?? 'id']) === o.id);
      return b && typeof b[feld] === 'string' ? { ...o, stand: b[feld] as string } : o;
    }),
  };
}

export interface SpeichernOptionen {
  /** Wie lange nach der letzten Eingabe gewartet wird. */
  verzoegerung?: number;
  /** Wird nach jedem Schreibversuch aufgerufen — für „gespeichert ✓". Bei Ablehnung mit Status und Text. */
  danach?: (ok: boolean, fehler?: SpeichernFehler) => void;
  /**
   * Feld mit dem Stand je Eintrag (z. B. `fassung` im Finanzplan, 28.09.): Er kommt immer aus dem
   * letzten Serverstand, nie aus der Sicht — so meldet der Server nur fremde Änderungen als 409.
   */
  standFeld?: string;
  /** Zu zweit arbeiten: nur Einzeländerungen schicken (PATCH). Listen und ihr Schlüsselfeld. */
  listen?: ListenSchluessel;
  /** Nach dem Speichern: den Serverstand übernehmen (enthält die Änderungen des anderen) —
   *  nur, wenn inzwischen nichts Neues getippt wurde. */
  uebernehmen?: (stand: Record<string, unknown>) => void;
}

export function useSpeichern(pfad: string, opt: SpeichernOptionen = {}) {
  const { verzoegerung = 500, danach, listen, standFeld } = opt;
  const standFeldRef = useRef(standFeld);
  standFeldRef.current = standFeld;
  /** Die laufende Einzeländerung — die nächste wartet, bis sie da ist (sonst prüft sie gegen einen alten Stand). */
  const flug = useRef<Promise<void> | null>(null);
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
      // Nacheinander: erst die laufende Änderung abwarten, dann gegen den neuen Serverstand vergleichen.
      while (flug.current) await flug.current;
      if (!basis.current) return;
      const feld = standFeldRef.current;
      const sicht = feld ? standAusBasis(basis.current, nutzlast as Record<string, unknown>, l, feld) : nutzlast as Record<string, unknown>;
      let a = aenderungen(basis.current, sicht, l);
      if (leer(a)) { danachRef.current?.(true); return; }
      if (feld) a = loeschStand(a, basis.current, l, feld);
      unterwegs.current = true;
      let fertig: () => void = () => {};
      flug.current = new Promise<void>(r => { fertig = r; });
      try {
        const r = await fetch(pfad, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a), keepalive: true,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.ok === false) {
          console.error(`[MAKE OS] Einzeländerung nach ${pfad} abgelehnt (${r.status}).`, d);
          // 409 mit Serverstand (28.09.): den aktuellen Stand übernehmen statt die abgelehnte Sicht stehen zu lassen.
          if (d.stand && typeof d.stand === 'object') {
            basis.current = d.stand as Record<string, unknown>;
            if (offen.current === null) uebernehmenRef.current?.(d.stand);
          }
          danachRef.current?.(false, { status: r.status, ...(typeof d.error === 'string' ? { fehler: d.error } : typeof d.fehler === 'string' ? { fehler: d.fehler } : {}) });
          return;
        }
        basis.current = (d.stand as Record<string, unknown>) ?? (nutzlast as Record<string, unknown>);
        danachRef.current?.(true);
        if (d.stand && offen.current === null) uebernehmenRef.current?.(d.stand);
      } catch (err) {
        offen.current = nutzlast;
        console.error(`[MAKE OS] Speichern nach ${pfad} fehlgeschlagen.`, err);
        danachRef.current?.(false, { status: 0, fehler: 'Keine Verbindung — noch nicht gespeichert.' });
      } finally {
        unterwegs.current = false;
        flug.current = null;
        fertig();
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
  /** Stand eines Eintrags im letzten Serverstand (`standFeld`) — für Aktionen, die an der Liste vorbei gehen (z. B. Storno). */
  const standVon = useCallback((liste: string, id: string): string | undefined => {
    const feld = standFeldRef.current;
    const l = basis.current?.[liste];
    if (!feld || !Array.isArray(l)) return undefined;
    const e = (l as Record<string, unknown>[]).find(x => x.id === id);
    return e && typeof e[feld] === 'string' ? e[feld] as string : undefined;
  }, []);

  // Stabil halten: Seiten hängen Ladefunktionen daran — ein neues Objekt je
  // Zeichnung hieße eine Ladeschleife.
  return useMemo(() => ({ speichern, jetzt, kenne, hatOffenes, standVon }), [speichern, jetzt, kenne, hatOffenes, standVon]);
}
