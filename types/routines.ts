import type { ID, Owner, Timestamps } from './common';

export type RoutineTime = 'morning' | 'evening' | 'weekly';

export interface ChecklistItem extends Timestamps {
  id: ID;
  routineId: ID;
  title: string;
  sortOrder: number;
  durationMinutes?: number;
}

export interface Routine extends Timestamps {
  id: ID;
  owner: Owner;
  name: string;
  time: RoutineTime;
  items: ChecklistItem[];
  active: boolean;
}

export interface RoutineEntry extends Timestamps {
  id: ID;
  routineId: ID;
  date: string;
  completedItemIds: ID[];
  completedAt?: string;
}

export interface HabitTracker extends Timestamps {
  id: ID;
  owner: Owner;
  name: string;
  targetDaysPerWeek: number;
  color: string;
  entries: string[];
  active: boolean;
}

export interface RoutinesState {
  routines: Routine[];
  entries: RoutineEntry[];
  habits: HabitTracker[];
}

// ── Planung (27.09., Malins Rückmeldung) — additiv ─────────────────────────
// Die gelebte Routine im Speicher `routinen` (Routine-Planer, Tagesplanung,
// Home-Widget) ist `Routine` aus lib/planung/typen.ts: Space Privat/Business,
// Owner (Person oder „beide“), Rhythmus mit Fälligkeit, Rang. Fehlendes `space`
// = privat, fehlender Rhythmus = täglich, fehlender Owner = beide — bestehende
// Einträge bleiben gültig, gesäubert wird im Schreibweg (lib/planung/routinen.ts).
export type { Routine as PlanungsRoutine, Block as WochenBlock, Rhythmus, Wochentag } from '@/lib/planung/typen';
