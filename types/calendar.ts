import type { ID, Owner, Timestamps } from './common';

export type CalendarView = 'month' | 'week' | 'day';

export type EventCategory =
  | 'private-malin'
  | 'private-kevin'
  | 'joint'
  | 'holding'
  | 'task-deadline';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  until?: string;
  daysOfWeek?: number[];
}

export interface CalendarEvent extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  category: EventCategory;
  owner: Owner;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  recurrence?: RecurrenceRule;
  linkedTaskId?: ID;
}

export interface CalendarState {
  events: CalendarEvent[];
  selectedDate: string;
  view: CalendarView;
}

export type CalendarAction =
  | { type: 'ADD_EVENT'; payload: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_EVENT'; payload: Partial<CalendarEvent> & { id: ID } }
  | { type: 'DELETE_EVENT'; payload: { id: ID } }
  | { type: 'SET_DATE'; payload: { date: string } }
  | { type: 'SET_VIEW'; payload: { view: CalendarView } }
  | { type: 'GO_PREV' }
  | { type: 'GO_NEXT' }
  | { type: 'GO_TODAY' }
  | { type: 'SET_APPLE_EVENTS'; payload: CalendarEvent[] };
