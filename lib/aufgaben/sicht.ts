// ─── MAKE OS — Aufgaben lesen (Server, 29.09., A7/A9) ───────────────────────
// Leichtgewichtig (nur Bestand + reine Regeln), damit jeder Leser es einbinden kann, ohne den ganzen Schreibweg
// (Meldungen, CRM, Konten) mitzuziehen. Zwei Wege:
//   · `ladeAufgaben`     — übernommen (Space, Unteraufgaben, Sonstige …) MIT Papierkorb: Schreibwege, Aufgaben-Seite.
//   · `ladeAufgabenSicht` — übernommen OHNE Papierkorb: ALLE Leser (Listen, Heute, Glocke, Kalender, Board, Indizes, ZOE).
// Nie `loadJson('tasks')` roh lesen — dort fehlt die Übernahme, und der Papierkorb stünde mitten in den Listen.
// Ausnahmen mit Grund: Art. 15/17 (lib/crm/person-bestaende.ts — auch der Papierkorb ist personenbezogen), die
// Verbindungsprüfung (lib/crm/verbindungen-laden.ts — Dateien an Papierkorb-Einträgen sind nicht „tot“) und Server-
// Schreiber, die in der Sperre anhängen.

import { loadJson } from '@/lib/store/local-db';
import type { Task, TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { aufgabenSicht } from './papierkorb';

export const AUFGABEN_BESTAND_NAME = 'tasks';
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { ...leer(), ...(roh ?? {}), tasks: [] });

// ── Sichtbarkeit „nur ich“ (29.09., Kevin) — der EINE Filter für alle Lesepfade ──────────────
// Eine Aufgabe mit `sichtbarkeit: 'nur-ich'` sieht nur ihre Anlegerin (`angelegtVon`); ihre Unteraufgaben erben das
// (sichtbar nur, wenn die Eltern es sind). Ohne Person (Systemlauf) sieht man KEINE „nur ich“-Aufgabe. Wer eine fremde
// „nur ich“-Aufgabe schreiben will, bekommt 404 (lib/aufgaben/speicher.ts) — als gäbe es sie nicht.

/** Ist die Aufgabe selbst als „nur ich“ markiert? */
export const istNurIch = (t: Pick<Task, 'sichtbarkeit'> | undefined | null): boolean => t?.sichtbarkeit === 'nur-ich';

/** Darf `person` die Aufgabe sehen? `nachId` = alle Aufgaben (für die Eltern einer Unteraufgabe). */
export function darfSehen(t: Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>, person: string | null | undefined, nachId?: ReadonlyMap<string, Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>): boolean {
  if (istNurIch(t) && (!person || t.angelegtVon !== person)) return false;
  const eltern = t.parentId ? nachId?.get(t.parentId) : undefined;
  if (eltern && istNurIch(eltern) && (!person || eltern.angelegtVon !== person)) return false;
  return true;
}

/** Der Bestand, wie `person` ihn sehen darf (null = Systemlauf: ohne alle „nur ich“-Aufgaben). Rein. */
export function sichtFuer<T extends TasksState>(state: T, person: string | null | undefined): T {
  if (!state.tasks.some(istNurIch)) return state;
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  return { ...state, tasks: state.tasks.filter(t => darfSehen(t, person, nachId)) };
}

/** Nur die Aufgaben-Liste filtern (für Leser, die schon eine Liste haben). */
export function aufgabenFuerPerson<T extends Pick<Task, 'id' | 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>(tasks: readonly T[], person: string | null | undefined): T[] {
  if (!tasks.some(istNurIch)) return [...tasks];
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(t => darfSehen(t, person, nachId));
}

/** Orte von Hand (Board › Ort) — entscheiden bei Altaufgaben mit, ob sie im Business liegen. */
export async function orgZuordnung(): Promise<Record<string, string>> {
  const f = await loadJson<{ orgs?: Record<string, string> }>('ordnung');
  return f?.orgs && typeof f.orgs === 'object' ? f.orgs : {};
}

/** Den Bestand lesen — übernommen (Space, Unteraufgaben …), noch nicht gespeichert. MIT Papierkorb (Schreibwege, Aufgaben-Seite). */
export async function ladeAufgaben(orgs?: Record<string, string>): Promise<TasksState> {
  const roh = await loadJson<TasksState>(AUFGABEN_BESTAND_NAME);
  return uebernehmen(alsStand(roh), orgs ?? await orgZuordnung()).state;
}

/** Die Sicht für alle LESER: übernommen und OHNE Papierkorb. */
export async function ladeAufgabenSicht(orgs?: Record<string, string>): Promise<TasksState> {
  return aufgabenSicht(await ladeAufgaben(orgs));
}
