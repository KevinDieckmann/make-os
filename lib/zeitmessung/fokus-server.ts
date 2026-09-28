// ─── Zeit & Fokus — laufender Fokus je Person (Server, 29.09.) ──────────────
// Bestand `fokus-laufend--<person>` { laufend, geaendert } — klein, Memo-Rauschen (lib/store/memo.ts). Siehe fokus-regeln.ts.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { LaufenderFokus } from './fokus-laufend';
import { laufendSaeubern } from './fokus-regeln';

interface Datei { laufend: LaufenderFokus | null; geaendert?: string }
const PERSON = /^[a-z0-9-]{1,40}$/;
export function fokusName(person: string): string {
  if (!PERSON.test(person)) throw new Error('Unzulässige Person.');
  return `fokus-laufend--${person}`;
}

export async function laufendLesen(person: string): Promise<LaufenderFokus | null> {
  return laufendSaeubern((await loadJson<Datei>(fokusName(person)))?.laufend ?? null);
}

/** Setzen (oder mit null beenden). Ungültiges wird abgelehnt (null zurück, nichts geschrieben). */
export async function laufendSetzen(person: string, roh: unknown, jetzt = new Date().toISOString()): Promise<{ ok: boolean; laufend: LaufenderFokus | null }> {
  const l = roh === null ? null : laufendSaeubern(roh, Date.parse(jetzt));
  if (roh !== null && !l) return { ok: false, laufend: await laufendLesen(person) };
  await updateJson<Datei>(fokusName(person), cur => (JSON.stringify(cur?.laufend ?? null) === JSON.stringify(l) ? (cur as Datei) : { laufend: l, geaendert: jetzt }));
  return { ok: true, laufend: l };
}
