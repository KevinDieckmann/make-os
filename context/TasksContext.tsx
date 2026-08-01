'use client';

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { TasksState, TasksAction, Project, Task, SubTask } from '@/types/tasks';
import { MOCK_PROJECTS } from '@/lib/mock-data/projects';
import { MOCK_TASKS } from '@/lib/mock-data/tasks';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const initialState: TasksState = {
  projects: MOCK_PROJECTS,
  tasks: MOCK_TASKS,
};

function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;
    case 'ADD_PROJECT': {
      const project: Project = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return { ...state, projects: [...state.projects, project] };
    }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload, updatedAt: now } : p),
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload.id),
        tasks: state.tasks.filter(t => t.projectId !== action.payload.id),
      };
    case 'ADD_TASK': {
      const task: Task = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload, updatedAt: now } : t),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload.id) };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => {
          if (t.id !== action.payload.id) return t;
          const done = t.status !== 'done';
          return { ...t, status: done ? 'done' : 'todo', completedAt: done ? now : undefined, updatedAt: now };
        }),
      };
    case 'ADD_SUBTASK': {
      const subTask: SubTask = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.payload.taskId ? { ...t, subTasks: [...t.subTasks, subTask], updatedAt: now } : t),
      };
    }
    case 'TOGGLE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(t => {
          if (t.id !== action.payload.taskId) return t;
          return {
            ...t,
            subTasks: t.subTasks.map(st =>
              st.id === action.payload.subTaskId ? { ...st, completed: !st.completed, updatedAt: now } : st
            ),
            updatedAt: now,
          };
        }),
      };
    case 'REORDER_TASKS':
      return {
        ...state,
        tasks: state.tasks.map(t => {
          const idx = action.payload.orderedIds.indexOf(t.id);
          if (idx === -1) return t;
          return { ...t, sortOrder: idx, updatedAt: now };
        }),
      };
    default:
      return state;
  }
}

interface TasksContextValue {
  state: TasksState;
  dispatch: Dispatch<TasksAction>;
  /** true, sobald der persistierte Zustand geladen wurde (oder Erststart bestätigt ist). */
  ready: boolean;
  /** Server-Stand neu laden — nötig, nachdem eine Route (z. B. /api/tasks/create)
   *  direkt in den Store geschrieben hat. Ohne das überschreibt der nächste
   *  debounced PUT dieses Providers die server-seitig angelegte Aufgabe. */
  rehydrate: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, initialState);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Beim Start: persistierten Zustand vom lokalen Store laden.
  useEffect(() => {
    let alive = true;
    fetch('/api/state/tasks')
      .then(r => r.json())
      .then((d: { state: TasksState | null }) => {
        if (alive && d.state && Array.isArray(d.state.tasks)) {
          dispatch({ type: 'HYDRATE', payload: d.state });
        }
      })
      .catch(() => { /* Erststart ohne Datei ist ok */ })
      .finally(() => { if (alive) { hydrated.current = true; setReady(true); } });
    return () => { alive = false; };
  }, []);

  async function rehydrate() {
    try {
      const d = await (await fetch('/api/state/tasks')).json() as { state: TasksState | null };
      if (d.state && Array.isArray(d.state.tasks)) dispatch({ type: 'HYDRATE', payload: d.state });
    } catch { /* offline — nächster Versuch beim nächsten Aufruf */ }
  }

  // Bei jeder Änderung (nach dem Laden): debounced in den lokalen Store schreiben.
  useEffect(() => {
    if (!hydrated.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }).catch(() => { /* offline/lokal aus → beim nächsten Mal erneut */ });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  return <TasksContext.Provider value={{ state, dispatch, ready, rehydrate }}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
