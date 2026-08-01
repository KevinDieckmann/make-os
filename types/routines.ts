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
