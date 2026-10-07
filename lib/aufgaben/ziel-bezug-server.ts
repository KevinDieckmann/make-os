// ─── MAKE OS — „zahlt ein auf …“ an Aufgaben und Projekten lösen/zurücksetzen (Server, 07.10., Seil) ──────────────────
// Wird ein Ziel gelöscht, verlieren Aufgaben und Projekte, die direkt darauf einzahlen, ihr `zielId` — über den EINEN Schreibweg
// `aufgabenAendern` (Systemlauf im Namen der Person: Verlauf, Protokoll ohne Werte; Sichtfilter „nur ich“ gilt für Systemläufe nicht,
// sie schreiben per Kennung). „Rückgängig“ setzt es zurück — nur, wo das Feld noch leer ist (lib/planung/bezuege.ts `bezuegeZurueck`).

import type { Project, Task, TasksState } from '@/types/tasks';
import { aufgabenAendern, keineOps, type AufgabenOps, type Op } from './speicher';
import { zielBezuegeLoesen } from '@/lib/planung/bezuege';

/** Eine Aufgabe/ein Projekt als Teil-Änderung ohne Stand: nur `zielId` setzen bzw. leeren (der Teil-Merge des Schreibwegs
 *  entfernt ein geleertes Feld nur, wenn es im Eintrag fehlt — darum hier ausdrücklich ohne). */
function zielTeil<E extends Task | Project>(alt: E, zielId: string | null): Op<E> {
  const e = { ...alt } as E;
  if (zielId) e.zielId = zielId; else delete e.zielId;
  return { op: 'upsert', eintrag: e, felder: zielId ? { gesetzt: ['zielId'], leer: [] } : { gesetzt: [], leer: ['zielId'] } };
}

/** Die Ops, die `zielId` an den genannten Aufgaben/Projekten setzen (zielId) bzw. leeren (null) — nur an vorhandenen. */
export function zielOps(stand: TasksState, aufgaben: readonly string[], projekte: readonly string[], zielId: string | null, nurWennLeer = false): AufgabenOps {
  const ops = keineOps();
  const ta = new Set(aufgaben), pa = new Set(projekte);
  for (const t of stand.tasks) {
    if (!ta.has(t.id) || (nurWennLeer && t.zielId)) continue;
    ops.tasks.push(zielTeil(t, zielId));
  }
  for (const p of stand.projects) {
    if (!pa.has(p.id) || (nurWennLeer && p.zielId)) continue;
    ops.projects.push(zielTeil(p, zielId));
  }
  return ops;
}

/** Gelöschte Ziele: `zielId` an Aufgaben und Projekten lösen. Liefert je Ziel, wen es betraf (Kennungen). */
export async function zielBezuegeInAufgabenLoesen(tot: ReadonlySet<string>, person: string): Promise<Map<string, { aufgaben: string[]; projekte: string[] }>> {
  const je = new Map<string, { aufgaben: string[]; projekte: string[] }>();
  if (!tot.size) return je;
  await aufgabenAendern(stand => {
    je.clear();
    const g = zielBezuegeLoesen(stand, tot);
    for (const id of g.aufgaben) { const z = stand.tasks.find(t => t.id === id)!.zielId!; je.set(z, { aufgaben: [...(je.get(z)?.aufgaben ?? []), id], projekte: je.get(z)?.projekte ?? [] }); }
    for (const id of g.projekte) { const z = stand.projects.find(p => p.id === id)!.zielId!; je.set(z, { aufgaben: je.get(z)?.aufgaben ?? [], projekte: [...(je.get(z)?.projekte ?? []), id] }); }
    return zielOps(stand, g.aufgaben, g.projekte, null);
  }, { person, system: true, massenAenderung: true, wer: { art: 'system', person } });
  return je;
}

/** „Rückgängig“: `zielId` an den genannten Aufgaben/Projekten wieder setzen, wo es noch leer ist. Liefert, wie viele. */
export async function zielBezuegeInAufgabenSetzen(zielId: string, aufgaben: readonly string[], projekte: readonly string[], person: string): Promise<{ aufgaben: number; projekte: number }> {
  let n = { aufgaben: 0, projekte: 0 };
  if (!aufgaben.length && !projekte.length) return n;
  const r = await aufgabenAendern(stand => {
    const ops = zielOps(stand, aufgaben, projekte, zielId, true);
    n = { aufgaben: ops.tasks.length, projekte: ops.projects.length };
    return ops;
  }, { person, system: true, massenAenderung: true, wer: { art: 'system', person } });
  return r.ok ? n : { aufgaben: 0, projekte: 0 };
}
