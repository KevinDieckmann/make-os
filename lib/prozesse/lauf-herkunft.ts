// ─── Prozesse · Lauf-Motor — die Herkunft einer Wirkung (Etappe C1, 21.10.; ANALYSE_100.md Punkt 49 „Schleifenschutz über die Herkunft“) ────────────────
// Häufigste Endlosschleife: ein Prozess löst sich über seine eigene Wirkung wieder aus (Mail gesendet → „Antwort gesendet“ → derselbe Prozess startet …).
// Darum läuft JEDE Wirkung eines Laufs (Aufgabe, Vorschlag, Freigabe mit Versand) im Zusammenhang `mitLaufHerkunft(…)`; die EINE Ereignisstelle
// (lib/ereignisse/server.ts `ereignis`) stempelt die Herkunft `prozess:<prozess>:<lauf>:<tiefe>` an jedes Ereignis, das in diesem Zusammenhang entsteht —
// keine Quelle muss davon wissen. Der Motor startet auf so ein Ereignis nie den eigenen Prozess, und eine Kette endet nach `LAUF_GRENZEN.kettenTiefe`.
// Nur Server (AsyncLocalStorage).

import { AsyncLocalStorage } from 'node:async_hooks';

export interface LaufHerkunft { prozessId: string; laufId: string; tiefe: number }

const SPEICHER = new AsyncLocalStorage<LaufHerkunft>();

/** `fn` im Zusammenhang eines Laufs ausführen — Ereignisse darin tragen seine Herkunft. */
export function mitLaufHerkunft<T>(h: LaufHerkunft, fn: () => Promise<T>): Promise<T> {
  return SPEICHER.run(h, fn);
}

/** Die Herkunft im aktuellen Zusammenhang als Text (`prozess:<prozess>:<lauf>:<tiefe>`) — oder null. */
export function laufHerkunftText(): string | null {
  const h = SPEICHER.getStore();
  return h ? `prozess:${h.prozessId}:${h.laufId}:${Math.max(0, Math.min(9, Math.floor(h.tiefe)))}` : null;
}

/** Eine Herkunft lesen (rein): `prozess:<prozess>:<lauf>:<tiefe>` → Teile, sonst null. */
export function herkunftAus(t: string | undefined | null): LaufHerkunft | null {
  const m = /^prozess:(pz-[0-9a-f-]{36}):(pl-[0-9a-f-]{36}):([0-9])$/.exec(t ?? '');
  return m ? { prozessId: m[1], laufId: m[2], tiefe: Number(m[3]) } : null;
}
