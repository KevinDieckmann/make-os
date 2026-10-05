// ─── Welcher Art ist ein KI-Aufruf? (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ──────────────────────────────────
//   gespraech    ZOE im Gespräch (jemand fragt gerade)
//   aufruf       ein Knopf, eine Seite, ein Auftrag aus dem Gespräch (jemand hat es gerade ausgelöst)
//   hintergrund  automatischer Lauf des Takts (niemand hat gerade gefragt) — dafür gilt der Schalter „Hintergrund-KI“
//
// Weitergegeben wird die Art
//   · im selben Prozess über AsyncLocalStorage (`imHintergrund(fn)` im Arbeiter, wenn der Auftrag vom Takt kommt) und
//   · über interne Hops mit dem Kopf `x-make-lauf: hintergrund` — den glaubt eine Route nur auf dem Dienstweg
//     (`istDienst`), ein Browser kann sich damit nichts erschleichen (er könnte sich höchstens selbst bremsen).
// Ein Dienstaufruf OHNE Person ist ein Systemlauf des Takts (Regel 7) — also auch Hintergrund.

import { AsyncLocalStorage } from 'node:async_hooks';
import { istDienst } from '@/lib/zugang/dienst';

export type KiLauf = 'gespraech' | 'aufruf' | 'hintergrund';
export const LAUF_KOPF = 'x-make-lauf';

const speicher = new AsyncLocalStorage<{ lauf: KiLauf }>();

/** `fn` als Hintergrund-Lauf ausführen — jeder KI-Aufruf darin zählt als automatisch. */
export function imHintergrund<T>(fn: () => Promise<T>): Promise<T> { return speicher.run({ lauf: 'hintergrund' }, fn); }

/** Läuft der aktuelle Code in einem Hintergrund-Lauf (AsyncLocalStorage)? */
export function laufImKontext(): KiLauf | undefined { return speicher.getStore()?.lauf; }

/** Die Art eines Aufrufs aus der Anfrage (Routen). */
export function kiLaufAus(req: Request, sonst: KiLauf = 'aufruf'): KiLauf {
  if (laufImKontext() === 'hintergrund') return 'hintergrund';
  if (istDienst(req)) {
    if (req.headers.get(LAUF_KOPF) === 'hintergrund') return 'hintergrund';
    if (!req.headers.get('x-make-person')) return 'hintergrund';
  }
  return sonst;
}

/** Kopf für interne Hops eines Hintergrund-Laufs. */
export const hintergrundKopf = (hintergrund: boolean): Record<string, string> => (hintergrund ? { [LAUF_KOPF]: 'hintergrund' } : {});

/**
 * Der KI-Kontext einer Route in einem Zug (für `askText({ …, ki })`): Lauf-Art aus der Anfrage, Person aus der Sitzung
 * bzw. dem Dienstweg, dazu die Kategorien, die der Aufrufer in den Prompt schreibt.
 */
export function kiAus(req: Request, kategorien: import('./ki-einstellungen').KiKategorie[], extra: { anzahl?: number; pseudonym?: boolean; person?: string | null; lauf?: KiLauf } = {}): import('./ki-tor').KiKontext {
  const p = req.headers.get('x-make-user') || req.headers.get('x-make-person');
  const person = extra.person !== undefined ? extra.person : (p && /^[a-z0-9-]{1,40}$/.test(p) ? p : null);
  const lauf = laufImKontext() === 'hintergrund' ? 'hintergrund' : (extra.lauf ?? kiLaufAus(req));
  return { lauf, person, kategorien, ...(extra.anzahl !== undefined ? { anzahl: extra.anzahl } : {}), ...(extra.pseudonym !== undefined ? { pseudonym: extra.pseudonym } : {}) };
}
