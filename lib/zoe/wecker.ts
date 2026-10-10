// ─── Arbeiter-Wecker (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md S16) ────────────────────────────────────────────
// Bis 10.10. wartete jeder Sprung über die Warteschlange auf die nächste Runde des Arbeiters (worker.mjs: Pause bis 30 s auf kleinen Maschinen,
// wenn eine Weile nichts los war) — ZOE → Head → Mitarbeiter = zwei Sprünge, spürbare Wartezeit ohne Not. Jetzt fragt ein untätiger Arbeiter
// mit einer LANGEN Abfrage (`POST /api/zoe/auftraege/nimm { wartenMs }`): ist nichts da, hält die Route die Anfrage offen, bis `reihe()` etwas
// einreiht (`arbeiterWecken`) oder die Wartezeit um ist. Lokaler Anstoß im App-Prozess — kein Netz, kein neuer Dienst, kein Polling-Takt.
// Zustand am `globalThis` (die Route und der einreihende Code können in verschiedenen Modul-Bündeln liegen, wie die Sperren der Datenschicht).
// Ein Anstoß zwischen „nichts genommen“ und „warte“ geht nicht verloren: gewartet wird nur, solange sich der Zähler seit `weckStand()` nicht
// bewegt hat.

interface Wecker { zaehler: number; warten: Set<() => void> }
const g = globalThis as unknown as { __makeosArbeiterWecker?: Wecker };
const W: Wecker = (g.__makeosArbeiterWecker ??= { zaehler: 0, warten: new Set() });

/** Höchste Wartezeit einer langen Abfrage (die Route deckelt jeden Wunsch darauf). */
export const WARTEN_MAX_MS = 20_000;

/** Stand des Zählers — vor dem Nehmen lesen, dann `aufWecken(…, stand)`. */
export const weckStand = (): number => W.zaehler;

/** Etwas wurde eingereiht: alle wartenden Abfragen wecken. */
export function arbeiterWecken(): void {
  W.zaehler++;
  const alle = Array.from(W.warten);
  W.warten.clear();
  for (const f of alle) { try { f(); } catch { /* ein Wecken darf nie das Einreihen stören */ } }
}

/** Warten, bis geweckt wird (true) oder `ms` um sind bzw. die Anfrage abgebrochen ist (false). Hat sich der Zähler seit `seit` bewegt: sofort true. */
export function aufWecken(ms: number, seit: number, signal?: AbortSignal): Promise<boolean> {
  if (W.zaehler !== seit) return Promise.resolve(true);
  const dauer = Math.max(0, Math.min(ms, WARTEN_MAX_MS));
  if (!dauer || signal?.aborted) return Promise.resolve(false);
  return new Promise(ok => {
    let fertig = false;
    const ende = (wert: boolean) => {
      if (fertig) return;
      fertig = true;
      clearTimeout(t);
      W.warten.delete(weck);
      signal?.removeEventListener('abort', ab);
      ok(wert);
    };
    const weck = () => ende(true);
    const ab = () => ende(false);
    const t = setTimeout(() => ende(false), dauer);
    (t as { unref?: () => void }).unref?.();
    W.warten.add(weck);
    signal?.addEventListener('abort', ab, { once: true });
  });
}

/** Für Tests und das Lagebild: wie viele Abfragen gerade warten. */
export const wartende = (): number => W.warten.size;
