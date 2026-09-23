'use client';

import {
  createContext, useContext, useReducer, useEffect, useState,
  type Dispatch, type ReactNode,
} from 'react';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import type { CalendarState, CalendarAction, CalendarEvent, CalendarView } from '@/types/calendar';
import { MOCK_CALENDAR_EVENTS } from '@/lib/mock-data/calendar-events';
import { navigateDate, parseISO } from '@/lib/date-utils';

export type SyncStatus = 'idle' | 'loading' | 'ok' | 'error';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const initialState: CalendarState = {
  events: MOCK_CALENDAR_EVENTS,
  selectedDate: new Date().toISOString().split('T')[0],
  view: 'month',
};

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'ADD_EVENT': {
      const event: CalendarEvent = {
        ...action.payload, id: generateId(), createdAt: now, updatedAt: now,
      };
      return { ...state, events: [...state.events, event] };
    }
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload, updatedAt: now } : e
        ),
      };
    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter(e => e.id !== action.payload.id) };
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload.date };
    case 'SET_VIEW':
      return { ...state, view: action.payload.view };
    case 'GO_PREV': {
      const next = navigateDate(parseISO(state.selectedDate), 'prev', state.view);
      return { ...state, selectedDate: next.toISOString().split('T')[0] };
    }
    case 'GO_NEXT': {
      const next = navigateDate(parseISO(state.selectedDate), 'next', state.view);
      return { ...state, selectedDate: next.toISOString().split('T')[0] };
    }
    case 'GO_TODAY':
      return { ...state, selectedDate: new Date().toISOString().split('T')[0] };
    case 'SET_APPLE_EVENTS':
      // Keep task-deadlines synthesized from tasks, replace everything else with live data
      return {
        ...state,
        events: [
          ...state.events.filter(e => e.category === 'task-deadline'),
          ...action.payload,
        ],
      };
    default:
      return state;
  }
}

interface CalendarContextValue {
  state: CalendarState;
  dispatch: Dispatch<CalendarAction>;
  syncStatus: SyncStatus;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    // Ohne Konto keine Daten: auf der Anmeldeseite laufen die Kontexte auch,
    // und ohne Sitzung bekämen sie 401 — laut und sinnlos. (23.09.)
    let alive = true;
    let warten: ReturnType<typeof setTimeout> | undefined;
    const laden = () => {
    if (!alive) return;
    // Noch keine Sitzung: alle zwei Sekunden nachsehen, nach der Anmeldung
    // kommt der Kalender dann von selbst. (23.09.)
    if (!personLesen()) { warten = setTimeout(laden, 2000); return; }
    setSyncStatus('loading');
    fetch('/api/apple-calendar')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((events: CalendarEvent[]) => {
        if (Array.isArray(events) && events.length > 0) {
          dispatch({ type: 'SET_APPLE_EVENTS', payload: events });
          setSyncStatus('ok');
        } else {
          setSyncStatus('error');
        }
      })
      .catch(err => {
        console.warn('[CalendarContext] Apple Calendar Sync fehlgeschlagen:', err);
        setSyncStatus('error');
      });
    };
    laden();
    return () => { alive = false; if (warten) clearTimeout(warten); };
  }, []); // einmal beim Start — wartet notfalls auf die Sitzung

  return (
    <CalendarContext.Provider value={{ state, dispatch, syncStatus }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
