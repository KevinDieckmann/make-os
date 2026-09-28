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
import type { TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { aufgabenSicht } from './papierkorb';

export const AUFGABEN_BESTAND_NAME = 'tasks';
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { ...leer(), ...(roh ?? {}), tasks: [] });

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
