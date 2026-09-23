'use client';

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
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
      return {
        ...state,
        // Auch die Verweise AUF die gelöschte Aufgabe entfernen — sonst
        // bleiben andere Aufgaben für immer an einem Geist blockiert.
        tasks: state.tasks
          .filter(t => t.id !== action.payload.id)
          .map(t => t.dependencies?.some(d => d.blockedByTaskId === action.payload.id)
            ? { ...t, dependencies: t.dependencies.filter(d => d.blockedByTaskId !== action.payload.id), updatedAt: now }
            : t),
      };
    case 'TOGGLE_TASK': {
      const ziel = state.tasks.find(t => t.id === action.payload.id);
      const wirdFertig = !!ziel && ziel.status !== 'done';
      return {
        ...state,
        tasks: state.tasks.map(t => {
          if (t.id === action.payload.id) {
            return { ...t, status: wirdFertig ? 'done' : 'todo', completedAt: wirdFertig ? now : undefined, updatedAt: now };
          }
          // Abhängigkeits-Auflösung (wie bei awork/monday): wird die
          // blockierende Aufgabe fertig, sind die Wartenden frei — wird sie
          // wieder geöffnet, gilt die Blockade wieder.
          const dep = t.dependencies?.find(d => d.blockedByTaskId === action.payload.id);
          if (!dep) return t;
          return {
            ...t,
            dependencies: t.dependencies.map(d => d.blockedByTaskId === action.payload.id
              ? (wirdFertig ? { ...d, resolvedAt: now } : { blockedByTaskId: d.blockedByTaskId })
              : d),
            updatedAt: now,
          };
        }),
      };
    }
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

/**
 * Schreiben mit Rückfrage bei Massen-Erledigung.
 *
 * Der Server lehnt mit 409 ab, wenn ein einziger Schreibvorgang mehr als ein
 * Dutzend Aufgaben auf erledigt kippen würde (lib/store/massen-wache.ts) —
 * der Fall vom 06.09., bei dem 57 Aufgaben in drei Minuten zuklappten.
 *
 * Bewusst ein blockierender Dialog und keine leise Meldung: wer das wirklich
 * will, soll einmal Ja sagen; wer es nicht wollte, wird angehalten. Vorher
 * stand die Ablehnung nur in der Entwicklerkonsole — dort sieht sie niemand,
 * und die Änderung war dann einfach weg, ohne dass es jemand merkte.
 */
async function schreibeMitWache(methode: 'PUT' | 'PATCH', koerper: Record<string, unknown> | string): Promise<void> {
  const senden = (b: string) => fetch('/api/state/tasks', {
    method: methode, headers: { 'Content-Type': 'application/json' }, body: b,
  });
  try {
    const roh = typeof koerper === 'string' ? koerper : JSON.stringify(koerper);
    const r = await senden(roh);
    if (r.status !== 409) return;
    const d = await r.json().catch(() => ({} as { massenAenderung?: boolean; massenLoeschung?: boolean; anzahl?: number; error?: string }));
    if (!d.massenAenderung && !d.massenLoeschung) {
      window.alert(d.error ?? 'Speichern abgelehnt. Bitte die Seite neu laden.');
      return;
    }
    const ja = window.confirm(
      d.massenLoeschung
        ? 'Damit würde über die Hälfte aller Aufgaben gelöscht.\n\nIst das so gewollt?'
        : `${d.anzahl} Aufgaben würden auf einmal als erledigt markiert.\n\n`
          + 'Das ist ungewöhnlich viel. Ist das so gewollt?',
    );
    if (!ja) {
      // Nicht gewollt: den Stand vom Server zurückholen, damit die Ansicht
      // nicht weiter etwas zeigt, das nirgends gespeichert ist.
      window.location.reload();
      return;
    }
    const mitJa = JSON.stringify({
      ...JSON.parse(roh),
      ...(d.massenLoeschung ? { massenLoeschung: true } : { massenAenderung: true }),
    });
    await senden(mitJa);
  } catch { /* offline → beim nächsten Mal erneut */ }
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, initialState);
  const [ready, setReady] = useState(false);
  /** Laden fehlgeschlagen — dann wird nichts gespeichert, um echte Daten zu schützen. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Der Stand, wie er zuletzt gelesen bzw. geschrieben wurde. Ohne den würde
   * schon das Öffnen einer Seite den gerade geladenen Stand zurückschreiben —
   * bei zwei Leuten in einer Instanz ist das gefährlich: Malins Seitenaufruf
   * könnte eine Änderung überschreiben, die Kevin eine Sekunde vorher gemacht
   * hat. Geschrieben wird nur, was sich wirklich geändert hat.
   */
  const zuletzt = useRef<string | null>(null);
  /** Steht gerade ein Speichervorgang aus? Dann keinen Abgleich dazwischenschieben. */
  const speichernSteht = useRef(false);

  // Beim Start: persistierten Zustand vom lokalen Store laden.
  // WICHTIG: `hydrated` wird nur gesetzt, wenn das Laden WIRKLICH geklappt hat.
  // Sonst gilt der Beispiel-Zustand als „geladen" und der nächste Klick würde
  // die echten Aufgaben damit überschreiben — genau das ist einmal passiert.
  useEffect(() => {
    // Ohne Konto keine Daten: auf der Anmeldeseite laufen die Kontexte auch,
    // und ohne Sitzung bekämen sie 401 — laut und sinnlos. (23.09.)
    let alive = true;
    let warten: ReturnType<typeof setTimeout> | undefined;
    const laden = () => {
    if (!alive) return;
    // Noch keine Sitzung (z. B. Anmeldeseite): alle zwei Sekunden nachsehen —
    // nach der Anmeldung laden die Daten dann von selbst. (23.09.)
    if (!personLesen()) { warten = setTimeout(laden, 2000); return; }
    fetch('/api/state/tasks')
      .then(r => {
        if (!r.ok) throw new Error(`Aufgaben-Store antwortet ${r.status}`);
        return r.json();
      })
      .then((d: { state: TasksState | null }) => {
        if (!alive) return;
        if (d.state && Array.isArray(d.state.tasks)) {
          dispatch({ type: 'HYDRATE', payload: d.state });
          zuletzt.current = JSON.stringify(d.state);
          hydrated.current = true;
        } else {
          // Erststart ohne Datei: leerer Stand ist gültig, Speichern erlaubt.
          hydrated.current = true;
        }
        setReady(true);
      })
      .catch(err => {
        if (!alive) return;
        // Nicht speichern, solange wir den echten Stand nicht kennen.
        console.error('[MAKE OS] Aufgaben konnten nicht geladen werden — Speichern ist gesperrt, bis das Laden klappt.', err);
        setLadeFehler(true);
        setReady(true);
      });
    };
    laden();
    return () => { alive = false; if (warten) clearTimeout(warten); };
  }, []);

  // Regelmäßiger Abgleich: zwei offene Fenster gleichen sich von selbst an,
  // statt stundenlang auseinanderzulaufen. Nie mitten in einem ungespeicherten
  // Zug — dann wartet der Abgleich auf die nächste Runde.
  useEffect(() => {
    const iv = setInterval(() => {
      if (!hydrated.current || ladeFehler || speichernSteht.current) return;
      void rehydrate();
    }, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladeFehler]);

  async function rehydrate() {
    try {
      const d = await (await fetch('/api/state/tasks')).json() as { state: TasksState | null };
      if (d.state && Array.isArray(d.state.tasks)) {
        dispatch({ type: 'HYDRATE', payload: d.state });
        // Frisch gelesen heißt: gleich, bis jemand etwas ändert.
        zuletzt.current = JSON.stringify(d.state);
      }
    } catch { /* offline — nächster Versuch beim nächsten Aufruf */ }
  }

  // Bei jeder Änderung (nach dem Laden): debounced in den lokalen Store
  // schreiben — aber NUR die Aufgaben, die sich wirklich geändert haben.
  //
  // Das ist das Fundament für Kevin und Malin in zwei Fenstern: die alte
  // Fassung schickte immer die komplette Liste, und wer zuletzt klickte,
  // überschrieb still die Änderung des anderen. Mit Einzel-Änderungen
  // (PATCH) berühren sich zwei Fenster nur noch, wenn beide DIESELBE
  // Aufgabe anfassen.
  useEffect(() => {
    if (!hydrated.current || ladeFehler) return;
    const jetzt = JSON.stringify(state);
    // Nichts geändert — dann auch nicht schreiben.
    if (jetzt === zuletzt.current) return;
    clearTimeout(saveTimer.current);
    speichernSteht.current = true;
    saveTimer.current = setTimeout(() => {
      speichernSteht.current = false;
      const alt = zuletzt.current ? (JSON.parse(zuletzt.current) as TasksState) : null;
      zuletzt.current = jetzt;

      // Unterschied bestimmen: geänderte/neue Aufgaben + gelöschte Ids.
      const ops: ({ op: 'upsert'; task: Task } | { op: 'delete'; id: string })[] = [];
      if (alt) {
        const altNachId = new Map(alt.tasks.map(t => [t.id, JSON.stringify(t)]));
        for (const t of state.tasks) {
          if (altNachId.get(t.id) !== JSON.stringify(t)) ops.push({ op: 'upsert', task: t });
        }
        const neuIds = new Set(state.tasks.map(t => t.id));
        for (const t of alt.tasks) if (!neuIds.has(t.id)) ops.push({ op: 'delete', id: t.id });
      }

      const projekteGleich = alt && JSON.stringify(alt.projects) === JSON.stringify(state.projects);
      if (alt && projekteGleich && ops.length > 0 && ops.length <= 40) {
        void schreibeMitWache('PATCH', { ops });
        return;
      }
      if (alt && projekteGleich && ops.length === 0) return;

      // Rückfall (Erststand, Projektänderung, Massenänderung): ganze Liste.
      void schreibeMitWache('PUT', jetzt);
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state, ladeFehler]);

  return <TasksContext.Provider value={{ state, dispatch, ready, rehydrate }}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
