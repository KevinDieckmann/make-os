'use client';

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import type { TasksState, TasksAction, Project, Task, SubTask, AufgabenListe, AufgabenStatus, AufgabenGruppe, AufgabenVorlage, VerlaufEintrag } from '@/types/tasks';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import { sonstigeProjektId } from '@/lib/aufgaben/struktur';
import { abhaengigAngleichen } from '@/lib/aufgaben/abhaengig';
import { MOCK_PROJECTS } from '@/lib/mock-data/projects';
import { MOCK_TASKS } from '@/lib/mock-data/tasks';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Aktionen des Aufgaben-Modells (28.09. abends) — Listen, eigene Status; Aufgaben/Projekte dürfen ihre Kennung mitbringen. */
export type AufgabenAktion =
  | TasksAction
  | { type: 'ADD_TASK_MIT_ID'; payload: Omit<Task, 'createdAt' | 'updatedAt'> }
  | { type: 'ADD_PROJECT_MIT_ID'; payload: Omit<Project, 'createdAt' | 'updatedAt'> }
  | { type: 'ADD_LISTE'; payload: AufgabenListe }
  | { type: 'UPDATE_LISTE'; payload: Partial<AufgabenListe> & { id: string } }
  | { type: 'DELETE_LISTE'; payload: { id: string } }
  | { type: 'ADD_STATUS'; payload: AufgabenStatus }
  | { type: 'UPDATE_STATUS'; payload: Partial<AufgabenStatus> & { id: string } }
  | { type: 'DELETE_STATUS'; payload: { id: string } }
  // Vertiefung (28.09. spät): Gruppen, Vorlagen, Verlauf aus der Server-Antwort
  | { type: 'ADD_GRUPPE'; payload: AufgabenGruppe }
  | { type: 'UPDATE_GRUPPE'; payload: Partial<AufgabenGruppe> & { id: string } }
  | { type: 'DELETE_GRUPPE'; payload: { id: string } }
  | { type: 'ADD_VORLAGE'; payload: AufgabenVorlage }
  | { type: 'UPDATE_VORLAGE'; payload: Partial<AufgabenVorlage> & { id: string } }
  | { type: 'DELETE_VORLAGE'; payload: { id: string } }
  | { type: 'VERLAUF_NACHTRAGEN'; payload: { id: string; verlauf: VerlaufEintrag[] }[] };

const initialState: TasksState = {
  projects: MOCK_PROJECTS,
  tasks: MOCK_TASKS,
  listen: [],
  statusEigen: [],
  gruppen: [],
  vorlagen: [],
};

/** Ein Teil auf einen Eintrag legen — `undefined` im Teil entfernt das Feld (JSON kennt kein undefined). */
function mitTeil<T extends object>(alt: T, teil: Partial<T>): T {
  const n = { ...alt, ...teil } as T;
  for (const k of Object.keys(teil) as (keyof T)[]) if (teil[k] === undefined) delete n[k];
  return n;
}

/** Verlauf aus der Server-Antwort an die Aufgaben legen (ohne updatedAt — es ist keine eigene Änderung). */
function verlaufNachtragen(tasks: Task[], neu: readonly { id: string; verlauf: VerlaufEintrag[] }[]): Task[] {
  const m = new Map(neu.map(x => [x.id, x.verlauf]));
  return tasks.map(t => (m.has(t.id) ? mitTeil(t, { verlauf: m.get(t.id) }) : t));
}

function tasksReducer(state: TasksState, action: AufgabenAktion): TasksState {
  const now = new Date().toISOString();
  const listen = state.listen ?? [];
  const statusEigen = state.statusEigen ?? [];
  const gruppen = state.gruppen ?? [];
  const vorlagen = state.vorlagen ?? [];
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, listen: action.payload.listen ?? [], statusEigen: action.payload.statusEigen ?? [], gruppen: action.payload.gruppen ?? [], vorlagen: action.payload.vorlagen ?? [] };
    case 'ADD_PROJECT': {
      const project: Project = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return { ...state, projects: [...state.projects, project] };
    }
    case 'ADD_PROJECT_MIT_ID':
      return { ...state, projects: [...state.projects.filter(p => p.id !== action.payload.id), { ...action.payload, createdAt: now, updatedAt: now }] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? mitTeil(p, { ...action.payload, updatedAt: now }) : p),
      };
    case 'DELETE_PROJECT': {
      // Seit 28.09. abends: Aufgaben gehen nie mit — sie wandern nach „Sonstige“ ihres Space, Listen des Projekts fallen weg.
      const weg = new Set(listen.filter(l => l.projektId === action.payload.id).map(l => l.id));
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload.id),
        listen: listen.filter(l => !weg.has(l.id)),
        gruppen: gruppen.filter(g => g.projektId !== action.payload.id),
        tasks: state.tasks.map(t => (t.projectId === action.payload.id
          ? mitTeil(t, { projectId: sonstigeProjektId(t.spaceId ?? 'privat'), listeId: undefined, updatedAt: now })
          : t)),
      };
    }
    case 'ADD_TASK': {
      const task: Task = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'ADD_TASK_MIT_ID':
      return { ...state, tasks: [...state.tasks.filter(t => t.id !== action.payload.id), { ...action.payload, createdAt: now, updatedAt: now }] };
    case 'UPDATE_TASK':
      return {
        ...state,
        // Wer eine Aufgabe nach Privat schiebt, nimmt ihr die Business-Einheit (27.09.) — der Schreibweg verwirft sie ohnehin.
        tasks: state.tasks.map(t => {
          if (t.id === action.payload.id) {
            const n = mitTeil(t, { ...action.payload, ...(action.payload.space === 'privat' ? { einheit: undefined } : {}), updatedAt: now });
            // „Wartet auf“: abhaengigVon und das alte dependencies gleich halten (wer sich geändert hat, gewinnt).
            return 'abhaengigVon' in action.payload || 'dependencies' in action.payload ? abhaengigAngleichen(n, t) : n;
          }
          // Unteraufgaben ziehen mit, wenn das Elternteil umzieht (Space/Projekt/Liste) — der Server erzwingt es ohnehin.
          if (t.parentId === action.payload.id && ('spaceId' in action.payload || 'projectId' in action.payload || 'listeId' in action.payload)) {
            const p = action.payload;
            return mitTeil(t, { ...('spaceId' in p ? { spaceId: p.spaceId } : {}), ...('projectId' in p ? { projectId: p.projectId } : {}), ...('listeId' in p ? { listeId: p.listeId } : {}), updatedAt: now });
          }
          return t;
        }),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        // Unteraufgaben gehen mit; Verweise AUF die gelöschte Aufgabe fallen weg — sonst bleiben andere für immer an einem Geist blockiert.
        tasks: state.tasks
          .filter(t => t.id !== action.payload.id && t.parentId !== action.payload.id)
          .map(t => t.dependencies?.some(d => d.blockedByTaskId === action.payload.id) || t.abhaengigVon?.includes(action.payload.id)
            ? mitTeil(t, { dependencies: (t.dependencies ?? []).filter(d => d.blockedByTaskId !== action.payload.id), abhaengigVon: t.abhaengigVon?.filter(x => x !== action.payload.id).length ? t.abhaengigVon.filter(x => x !== action.payload.id) : undefined, updatedAt: now })
            : t),
      };
    case 'TOGGLE_TASK': {
      const ziel = state.tasks.find(t => t.id === action.payload.id);
      const wirdFertig = !!ziel && ziel.status !== 'done';
      return {
        ...state,
        tasks: state.tasks.map(t => {
          if (t.id === action.payload.id) {
            // Abhaken setzt den Grundstatus — ein eigener Status passt dann nicht mehr und fällt weg.
            return mitTeil(t, { status: wirdFertig ? 'done' : 'todo', statusId: undefined, completedAt: wirdFertig ? now : undefined, updatedAt: now });
          }
          // Abhängigkeits-Auflösung (wie bei awork/monday): wird die blockierende Aufgabe fertig, sind die Wartenden frei.
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
    case 'ADD_LISTE':
      return { ...state, listen: [...listen.filter(l => l.id !== action.payload.id), action.payload] };
    case 'UPDATE_LISTE':
      return { ...state, listen: listen.map(l => (l.id === action.payload.id ? mitTeil(l, action.payload) : l)) };
    case 'DELETE_LISTE':
      // Aufgaben bleiben — sie stehen danach unter „Sonstige“ des Projekts.
      return { ...state, listen: listen.filter(l => l.id !== action.payload.id), tasks: state.tasks.map(t => (t.listeId === action.payload.id ? mitTeil(t, { listeId: undefined, updatedAt: now }) : t)) };
    case 'ADD_STATUS':
      return { ...state, statusEigen: [...statusEigen.filter(s => s.id !== action.payload.id), action.payload] };
    case 'UPDATE_STATUS': {
      const neu = statusEigen.map(s => (s.id === action.payload.id ? mitTeil(s, action.payload) : s));
      const s = neu.find(x => x.id === action.payload.id);
      // Neue Bedeutung (Grundstatus) → Aufgaben mit diesem Status tragen sie sofort (der Server tut es ohnehin).
      return { ...state, statusEigen: neu, tasks: s && action.payload.basis ? state.tasks.map(t => (t.statusId === s.id && t.status !== s.basis ? { ...t, status: s.basis, updatedAt: now } : t)) : state.tasks };
    }
    case 'DELETE_STATUS':
      return { ...state, statusEigen: statusEigen.filter(s => s.id !== action.payload.id), tasks: state.tasks.map(t => (t.statusId === action.payload.id ? mitTeil(t, { statusId: undefined, updatedAt: now }) : t)) };
    case 'ADD_GRUPPE':
      return { ...state, gruppen: [...gruppen.filter(g => g.id !== action.payload.id), action.payload] };
    case 'UPDATE_GRUPPE':
      return { ...state, gruppen: gruppen.map(g => (g.id === action.payload.id ? mitTeil(g, action.payload) : g)) };
    case 'DELETE_GRUPPE':
      // Listen bleiben — sie stehen danach direkt im Projekt.
      return { ...state, gruppen: gruppen.filter(g => g.id !== action.payload.id), listen: listen.map(l => (l.gruppeId === action.payload.id ? mitTeil(l, { gruppeId: undefined }) : l)) };
    case 'ADD_VORLAGE':
      return { ...state, vorlagen: [...vorlagen.filter(v => v.id !== action.payload.id), action.payload] };
    case 'UPDATE_VORLAGE':
      return { ...state, vorlagen: vorlagen.map(v => (v.id === action.payload.id ? mitTeil(v, action.payload) : v)) };
    case 'DELETE_VORLAGE':
      return { ...state, vorlagen: vorlagen.filter(v => v.id !== action.payload.id) };
    case 'VERLAUF_NACHTRAGEN':
      return { ...state, tasks: verlaufNachtragen(state.tasks, action.payload) };
    default:
      return state;
  }
}

interface TasksContextValue {
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  /** true, sobald der persistierte Zustand geladen wurde (oder Erststart bestätigt ist). */
  ready: boolean;
  /** Server-Stand neu laden — nötig, nachdem eine Route (z. B. /api/tasks/create) direkt in den Store geschrieben hat. */
  rehydrate: () => Promise<void>;
  /** Spaces vom Server: fest + Mandanten aus dem CRM (aktiv, Archiv). */
  spaces: AufgabenSpace[];
}

const TasksContext = createContext<TasksContextValue | null>(null);

/** Ereignis, wenn der Server eine Änderung mit 409 ablehnte (Stand veraltet) — die Seite zeigt einen Hinweis. */
export const AUFGABEN_KONFLIKT = 'make-aufgaben-konflikt';

type Zeile = { id: string; stand?: string };
type ListenArt = 'tasks' | 'projects' | 'listen' | 'statusEigen' | 'gruppen' | 'vorlagen';
const LISTEN: ListenArt[] = ['tasks', 'projects', 'listen', 'statusEigen', 'gruppen', 'vorlagen'];
const STRUKTUR: Exclude<ListenArt, 'tasks'>[] = ['projects', 'listen', 'statusEigen', 'gruppen', 'vorlagen'];
type Staende = Map<string, string>;
const schluessel = (art: ListenArt, id: string) => `${art}:${id}`;

/** Server-Antwort in Sicht + Stände teilen: `stand` gehört nie in den Zustand (sonst schickte man einen alten zurück). */
function ohneStand(roh: TasksState, staende: Staende): TasksState {
  const raus = { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] } as unknown as Record<ListenArt, Zeile[]>;
  for (const art of LISTEN) {
    for (const z of ((roh[art] ?? []) as unknown as Zeile[])) {
      const { stand, ...rest } = z;
      if (stand) staende.set(schluessel(art, z.id), stand);
      raus[art].push(rest as Zeile);
    }
  }
  return raus as unknown as TasksState;
}

type Op = { op: 'upsert'; eintrag: unknown; stand?: string } | { op: 'delete'; id: string; stand?: string };

/** Unterschied zweier Stände je Liste: geänderte/neue Einträge + gelöschte Kennungen, jeweils mit dem letzten Serverstand. */
function unterschied(alt: TasksState, neu: TasksState, staende: Staende): Record<ListenArt, Op[]> {
  const raus: Record<ListenArt, Op[]> = { tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] };
  for (const art of LISTEN) {
    const a = new Map(((alt[art] ?? []) as unknown as Zeile[]).map(x => [x.id, JSON.stringify(x)]));
    const n = (neu[art] ?? []) as unknown as Zeile[];
    for (const x of n) if (a.get(x.id) !== JSON.stringify(x)) { const s = staende.get(schluessel(art, x.id)); raus[art].push({ op: 'upsert', eintrag: x, ...(s && a.has(x.id) ? { stand: s } : {}) }); }
    const ids = new Set(n.map(x => x.id));
    for (const id of a.keys()) if (!ids.has(id)) { const s = staende.get(schluessel(art, id)); raus[art].push({ op: 'delete', id, ...(s ? { stand: s } : {}) }); }
  }
  return raus;
}

interface SchreibAntwort { ok?: boolean; error?: string; massenAenderung?: boolean; massenLoeschung?: boolean; anzahl?: number; konflikte?: unknown[]; kreis?: string[]; zeilen?: { liste: ListenArt; id: string; stand: string; verlauf?: VerlaufEintrag[] }[]; state?: TasksState; /** Paket C3: neue Instanzen wiederkehrender Aufgaben. */ serien?: string[] }

/**
 * Schreiben mit Rückfrage bei Massen-Erledigung/-Löschung (lib/store/massen-wache.ts): ein blockierender Dialog statt
 * einer leisen Meldung. 409 mit `konflikte` (Stand veraltet): Rückgabe mit dem aktuellen Stand — der Aufrufer zeigt ihn.
 */
async function schreibeMitWache(methode: 'PUT' | 'PATCH', koerper: Record<string, unknown>): Promise<SchreibAntwort | null> {
  const senden = (b: Record<string, unknown>) => fetch('/api/state/tasks', { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  try {
    const r = await senden(koerper);
    const d = (await r.json().catch(() => ({}))) as SchreibAntwort;
    if (r.ok || r.status !== 409) return { ...d, ok: r.ok };
    if (d.konflikte?.length) return d;
    if (!d.massenAenderung && !d.massenLoeschung) { window.alert(d.error ?? 'Speichern abgelehnt. Bitte die Seite neu laden.'); return d; }
    const ja = window.confirm(
      d.massenLoeschung
        ? 'Damit würde über die Hälfte aller Aufgaben gelöscht.\n\nIst das so gewollt?'
        : `${d.anzahl} Aufgaben würden auf einmal als erledigt markiert.\n\nDas ist ungewöhnlich viel. Ist das so gewollt?`,
    );
    if (!ja) { window.location.reload(); return null; }
    const r2 = await senden({ ...koerper, ...(d.massenLoeschung ? { massenLoeschung: true } : { massenAenderung: true }) });
    return { ...((await r2.json().catch(() => ({}))) as SchreibAntwort), ok: r2.ok };
  } catch { return null; /* offline → beim nächsten Mal erneut */ }
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, initialState);
  const [ready, setReady] = useState(false);
  const [spaces, setSpaces] = useState<AufgabenSpace[]>([]);
  /** Laden fehlgeschlagen (oder kein Zugang) — dann wird nichts gespeichert, um echte Daten zu schützen. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Der Stand, wie er zuletzt gelesen bzw. geschrieben wurde — geschrieben wird nur, was sich wirklich geändert hat. */
  const zuletzt = useRef<string | null>(null);
  /** Stand je Zeile aus der letzten Server-Antwort (Fingerabdruck) — geht mit jeder Änderung mit (409 bei veraltet). */
  const staende = useRef<Staende>(new Map());
  /** Steht gerade ein Speichervorgang aus? Dann keinen Abgleich dazwischenschieben. */
  const speichernSteht = useRef(false);
  /** Schreibvorgänge laufen nacheinander — jeder liest die Stände, die die Antwort des vorigen brachte. */
  const kette = useRef<Promise<unknown>>(Promise.resolve());

  const uebernehmenVomServer = (d: { state: TasksState | null; spaces?: AufgabenSpace[] }) => {
    if (Array.isArray(d.spaces)) setSpaces(d.spaces);
    if (d.state && Array.isArray(d.state.tasks)) {
      staende.current = new Map();
      const sicht = ohneStand(d.state, staende.current);
      dispatch({ type: 'HYDRATE', payload: sicht });
      zuletzt.current = JSON.stringify(tasksReducer(initialState, { type: 'HYDRATE', payload: sicht }));
      return true;
    }
    return false;
  };

  // Beim Start: persistierten Zustand laden. `hydrated` nur, wenn das Laden WIRKLICH geklappt hat — sonst gälte der
  // Beispiel-Zustand als „geladen“, und der nächste Klick überschriebe die echten Aufgaben damit.
  useEffect(() => {
    let alive = true;
    let warten: ReturnType<typeof setTimeout> | undefined;
    const laden = () => {
      if (!alive) return;
      // Noch keine Sitzung (z. B. Anmeldeseite): alle zwei Sekunden nachsehen (23.09.).
      if (!personLesen()) { warten = setTimeout(laden, 2000); return; }
      fetch('/api/state/tasks')
        .then(async r => {
          // Kein Zugang (anderer Haushalt, 28.09.): leise leer — nichts speichern.
          if (r.status === 403) return { gesperrt: true } as const;
          if (!r.ok) throw new Error(`Aufgaben-Store antwortet ${r.status}`);
          return (await r.json()) as { state: TasksState | null; spaces?: AufgabenSpace[] };
        })
        .then(d => {
          if (!alive) return;
          if ('gesperrt' in d) { dispatch({ type: 'HYDRATE', payload: { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] } }); setLadeFehler(true); setReady(true); return; }
          if (!uebernehmenVomServer(d)) { if (Array.isArray(d.spaces)) setSpaces(d.spaces); }
          // Erststart ohne Datei: leerer Stand ist gültig, Speichern erlaubt.
          hydrated.current = true;
          setReady(true);
        })
        .catch(err => {
          if (!alive) return;
          console.error('[MAKE OS] Aufgaben konnten nicht geladen werden — Speichern ist gesperrt, bis das Laden klappt.', err);
          setLadeFehler(true);
          setReady(true);
        });
    };
    laden();
    return () => { alive = false; if (warten) clearTimeout(warten); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regelmäßiger Abgleich (zu zweit): alle 45 s, bei Fokus und beim Zurückkehren in den Tab — nie mitten in einem Zug.
  useEffect(() => {
    const zug = () => {
      if (!hydrated.current || ladeFehler || speichernSteht.current || document.visibilityState !== 'visible') return;
      void rehydrate();
    };
    const iv = setInterval(zug, 45_000);
    const sicht = () => { if (document.visibilityState === 'visible') zug(); };
    window.addEventListener('focus', zug);
    document.addEventListener('visibilitychange', sicht);
    return () => { clearInterval(iv); window.removeEventListener('focus', zug); document.removeEventListener('visibilitychange', sicht); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladeFehler]);

  async function rehydrate() {
    try {
      const r = await fetch('/api/state/tasks');
      if (!r.ok) return;
      uebernehmenVomServer((await r.json()) as { state: TasksState | null; spaces?: AufgabenSpace[] });
    } catch { /* offline — nächster Versuch beim nächsten Aufruf */ }
  }

  // Bei jeder Änderung (nach dem Laden): gebündelt schreiben — nur, was sich geändert hat, je Zeile mit Stand.
  useEffect(() => {
    if (!hydrated.current || ladeFehler) return;
    const jetzt = JSON.stringify(state);
    if (jetzt === zuletzt.current) return;
    clearTimeout(saveTimer.current);
    speichernSteht.current = true;
    saveTimer.current = setTimeout(() => {
      speichernSteht.current = false;
      const alt = zuletzt.current ? (JSON.parse(zuletzt.current) as TasksState) : null;
      zuletzt.current = jetzt;
      const neu = JSON.parse(jetzt) as TasksState;
      kette.current = kette.current.then(async () => {
        if (!alt) { await schreibeMitWache('PUT', neu as unknown as Record<string, unknown>); await rehydrate(); return; }
        const ops = unterschied(alt, neu, staende.current);
        const n = LISTEN.reduce((s, a) => s + ops[a].length, 0);
        if (!n) return;
        // In Paketen zu 150 (Server-Grenze 200 je Liste); Struktur reist im ersten mit.
        const pakete = Math.max(1, Math.ceil(ops.tasks.length / 150));
        let serienNeu = false; // Paket C3: der Server legte beim Erledigen die nächste Instanz an → danach nachladen
        for (let i = 0; i < pakete; i++) {
          const koerper: Record<string, unknown> = { ops: ops.tasks.slice(i * 150, i * 150 + 150) };
          if (i === 0 && STRUKTUR.some(a => ops[a].length)) koerper.struktur = { projekte: ops.projects, listen: ops.listen, status: ops.statusEigen, gruppen: ops.gruppen, vorlagen: ops.vorlagen };
          const d = await schreibeMitWache('PATCH', koerper);
          if (d?.ok && Array.isArray(d.zeilen)) {
            for (const z of d.zeilen) staende.current.set(schluessel(z.liste, z.id), z.stand);
            // Verlauf schreibt der Server — in Sicht UND in den zuletzt gesendeten Stand, damit er nicht als Änderung zurückgeht.
            const verlauf = d.zeilen.filter(z => z.liste === 'tasks' && Array.isArray(z.verlauf)).map(z => ({ id: z.id, verlauf: z.verlauf! }));
            if (verlauf.length) {
              if (zuletzt.current) { const z = JSON.parse(zuletzt.current) as TasksState; zuletzt.current = JSON.stringify({ ...z, tasks: verlaufNachtragen(z.tasks, verlauf) }); }
              dispatch({ type: 'VERLAUF_NACHTRAGEN', payload: verlauf });
            }
          }
          if (d?.ok && d.serien?.length) serienNeu = true;
          if (d && !d.ok && d.kreis?.length) { await rehydrate(); return; }
          if (d && !d.ok && d.konflikte?.length) {
            // Jemand anders war schneller: aktuellen Stand zeigen, Hinweis auslösen — nichts überschrieben.
            if (d.state) uebernehmenVomServer({ state: d.state }); else await rehydrate();
            window.dispatchEvent(new CustomEvent(AUFGABEN_KONFLIKT));
            return;
          }
        }
        if (serienNeu && !speichernSteht.current) await rehydrate();
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ladeFehler]);

  return <TasksContext.Provider value={{ state, dispatch, ready, rehydrate, spaces }}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
