import type { ID, Owner, Timestamps } from './common';

export type SportType = 'running' | 'cycling' | 'yoga' | 'strength' | 'hiking' | 'swimming' | 'other';
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface SportLog extends Timestamps {
  id: ID;
  owner: Owner;
  type: SportType;
  date: string;
  durationMinutes: number;
  distanceKm?: number;
  notes?: string;
}

export interface JournalEntry extends Timestamps {
  id: ID;
  owner: Owner;
  date: string;
  mood: MoodScore;
  content: string;
  gratitude?: string[];
}

export interface DateNight extends Timestamps {
  id: ID;
  date: string;
  title: string;
  location?: string;
  notes?: string;
  completed: boolean;
}

export interface BucketItem extends Timestamps {
  id: ID;
  owner: Owner;
  title: string;
  category: string;
  completed: boolean;
  completedDate?: string;
}

export interface WellnessState {
  sportLogs: SportLog[];
  journalEntries: JournalEntry[];
  dateNights: DateNight[];
  bucketList: BucketItem[];
}
