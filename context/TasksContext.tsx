'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { personLesen, aufAnmeldeseite } from '@/lib/make-one/arbeitsplatz-browser';
import type { TasksState, TasksAction, Project, Task, SubTask, AufgabenListe, AufgabenStatus, AufgabenGruppe, AufgabenVorlage, VerlaufEintrag } from '@/types/tasks';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import { abhaengigAngleichen } from '@/lib/aufgaben/abhaengig';
import { aufgabenSicht, aufgabeInPapierkorb, projektInPapierkorb, wiederherstellen, endgueltigEntfernen, papierkorbEintraege, type PapierkorbEintrag } from '@/lib/aufgaben/papierkorb';
import {
  LISTEN, anzahl, aufOps, ausSchluessel, einzeln, filtern, gemerktAlsOps, gleichOhneZeit, koerper, leereOps, leererStand, merkenAus, ohneStand,
  opId, pakete, schluessel, schluesselVon, unterschied, voruebergehend, wartezeit, zeilenTitel, fassungText,
  type ListenArt, type OpsJe, type Staende, type Zeile,
} from '@/lib/aufgaben/abgleich';
import { istNeuLaden, NEU_LADEN_EREIGNIS } from '@/lib/bau/kennung';
import { SpeicherHinweis } from '@/components/os/aufgaben/SpeicherHinweis';
import { nachfahrenIn } from '@/lib/aufgaben/ebenen';

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
  | { type: 'VERLAUF_NACHTRAGEN'; payload: { id: string; verlauf: VerlaufEintrag[] }[] }
  // Papierkorb (29.09.): „Löschen“ legt hinein (DELETE_PROJECT/DELETE_TASK), zurückholen samt Kette, endgültig getrennt.
  | { type: 'WIEDERHERSTELLEN'; payload: { art: 'projekt' | 'aufgabe'; id: string } }
  | { type: 'ENDGUELTIG_LOESCHEN'; payload: { art: 'projekt' | 'aufgabe'; id: string } }
  // Abgleich (29.09., A1/A4): neuer Serverstand + ausstehende Änderungen wieder darauf; einzelne Zeilen setzen.
  | { type: 'ABGLEICH'; payload: { basis: TasksState; altServer: TasksState; serverGewinnt?: readonly string[] } }
  | { type: 'ZEILEN_SETZEN'; payload: { liste: ListenArt; id: string; eintrag: Zeile | null }[] };

// Leer bis zum Laden — nie Beispiel-Daten, die ein erster Klick als echten Stand speichern könnte.
const initialState: TasksState = leererStand();

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

const vollstaendig = (s: TasksState): TasksState => ({ ...s, listen: s.listen ?? [], statusEigen: s.statusEigen ?? [], gruppen: s.gruppen ?? [], vorlagen: s.vorlagen ?? [] });

/** Der Reducer (exportiert für die Tests der Verlust-Szenarien, tests/aufgaben-abgleich.test.ts). */
export function tasksReducer(state: TasksState, action: AufgabenAktion): TasksState {
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
    case 'DELETE_PROJECT':
      // Seit 29.09. (A7): in den Papierkorb — samt Aufgaben, Notiz, Feldern, Listen und Dateien; 30 Tage wiederherstellbar.
      return projektInPapierkorb(state, action.payload.id, now);
    case 'ADD_TASK': {
      const task: Task = { ...action.payload, id: generateId(), createdAt: now, updatedAt: now };
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'ADD_TASK_MIT_ID':
      return { ...state, tasks: [...state.tasks.filter(t => t.id !== action.payload.id), { ...action.payload, createdAt: now, updatedAt: now }] };
    case 'UPDATE_TASK': {
      // Mehrstufig (01.10.): der ganze Teilbaum zieht mit, wenn die Aufgabe umzieht (Space/Projekt/Liste).
      const umzug = 'spaceId' in action.payload || 'projectId' in action.payload || 'listeId' in action.payload;
      const teilbaum = umzug ? new Set(nachfahrenIn(action.payload.id, state.tasks).map(t => t.id)) : new Set<string>();
      return {
        ...state,
        // Wer eine Aufgabe nach Privat schiebt, nimmt ihr die Business-Einheit (27.09.) — der Schreibweg verwirft sie ohnehin.
        tasks: state.tasks.map(t => {
          if (t.id === action.payload.id) {
            const n = mitTeil(t, { ...action.payload, ...(action.payload.space === 'privat' ? { einheit: undefined } : {}), updatedAt: now });
            // „Wartet auf“: abhaengigVon und das alte dependencies gleich halten (wer sich geändert hat, gewinnt).
            return 'abhaengigVon' in action.payload || 'dependencies' in action.payload ? abhaengigAngleichen(n, t) : n;
          }
          // Unteraufgaben (alle Ebenen) ziehen mit, wenn das Elternteil umzieht (Space/Projekt/Liste) — der Server erzwingt es ohnehin.
          if (teilbaum.has(t.id)) {
            const p = action.payload;
            return mitTeil(t, { ...('spaceId' in p ? { spaceId: p.spaceId } : {}), ...('projectId' in p ? { projectId: p.projectId } : {}), ...('listeId' in p ? { listeId: p.listeId } : {}), updatedAt: now });
          }
          return t;
        }),
      };
    }
    case 'DELETE_TASK':
      // Seit 29.09. (A7): in den Papierkorb — Unteraufgaben gehen mit; wer auf sie wartete, wartet nicht mehr auf einen Geist.
      return aufgabeInPapierkorb(state, action.payload.id, now);
    case 'WIEDERHERSTELLEN':
      return wiederherstellen(state, action.payload.art, action.payload.id, now);
    case 'ENDGUELTIG_LOESCHEN':
      return endgueltigEntfernen(state, action.payload.art, action.payload.id).state;
    case 'ABGLEICH': {
      // Ausstehend = was die Sicht vom alten Serverstand unterscheidet; es kommt wieder auf den neuen (außer Zeilen, bei denen der Server gewinnt).
      const gewinnt = new Set(action.payload.serverGewinnt ?? []);
      const offen = filtern(unterschied(action.payload.altServer, state, new Map()), k => !gewinnt.has(k));
      return vollstaendig(aufOps(action.payload.basis, offen));
    }
    case 'ZEILEN_SETZEN': {
      const ops = leereOps();
      for (const z of action.payload) ops[z.liste].push(z.eintrag ? { op: 'upsert', eintrag: z.eintrag } : { op: 'delete', id: z.id });
      return vollstaendig(aufOps(state, ops));
    }
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

/** Eine abgelehnte eigene Änderung (400/413/Kreis …) — bleibt in der Sicht, bis sie geändert oder verworfen wird. */
export interface Abgelehnt { schluessel: string; titel: string; grund: string }
/** Konflikt: der Server hatte inzwischen eine andere Fassung — sie wird gezeigt, die eigene bleibt als „Deine Fassung“. */
export interface Konflikt { schluessel: string; liste: ListenArt; id: string; titel: string; grund: string; meine: Zeile | null; server: Zeile | null }
/** Wie es um das Speichern steht — global sichtbar (SpeicherHinweis). */
export interface SpeicherLage {
  /** Ausstehende Änderungen (Zeilen), die der Server noch nicht bestätigt hat. */
  offen: number;
  phase: 'ruhig' | 'sendet' | 'wiederholen' | 'neuLaden' | 'gesperrt';
  grund?: string;
  naechsterVersuch?: number;
  abgelehnt: Abgelehnt[];
  konflikte: Konflikt[];
}

interface TasksContextValue {
  /** Die Sicht: OHNE Papierkorb (so sehen alle Seiten, Flächen, CRM-Kacheln die Aufgaben). */
  state: TasksState;
  /** Der volle Stand mit Papierkorb — nur für den Papierkorb selbst. */
  voll: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  /** true, sobald der persistierte Zustand geladen wurde (oder Erststart bestätigt ist). */
  ready: boolean;
  /** Server-Stand neu laden — ausstehende Änderungen bleiben (sie kommen wieder darauf). */
  rehydrate: () => Promise<void>;
  /** Spaces vom Server: fest + Mandanten aus dem CRM (aktiv, Archiv). */
  spaces: AufgabenSpace[];
  /** Speicher-Lage (ausstehend, erneuter Versuch, abgelehnt, Konflikte). */
  speicher: SpeicherLage;
  /** Hat diese Zeile noch ungespeicherte Änderungen? (z. B. Notiz-Entwurf erst nach Bestätigung löschen) */
  istOffen: (liste: ListenArt, id: string) => boolean;
  /** Papierkorb-Einträge (Wurzeln), neueste zuerst. */
  papierkorb: PapierkorbEintrag[];
  /** Sofort speichern (statt nach der kurzen Wartezeit). */
  jetztSpeichern: () => void;
  /** Konflikt lösen: eigene Fassung übernehmen (schreibt sie mit dem neuen Stand) oder nur den Hinweis schließen. */
  konfliktLoesen: (schluessel: string, wie: 'meine' | 'schliessen') => void;
  /** Abgelehnte Änderung verwerfen (die Zeile nimmt wieder den Serverstand) oder erneut versuchen. */
  ablehnungLoesen: (schluessel: string, wie: 'verwerfen' | 'erneut') => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

/** Ereignis, wenn der Server eine Änderung mit 409 ablehnte (Stand veraltet) — für Seiten, die zusätzlich reagieren wollen. */
export const AUFGABEN_KONFLIKT = 'make-aufgaben-konflikt';
/** Sitzungsspeicher der ausstehenden Änderungen (überlebt Neuladen/„bitte neu laden“ im selben Tab). */
const MERKER = 'make-aufgaben-ausstehend';
const WEG = '/api/state/tasks';

interface SchreibAntwort { ok?: boolean; error?: string; neuLaden?: boolean; massenAenderung?: boolean; massenLoeschung?: boolean; anzahl?: number; konflikte?: { liste: ListenArt; id: string; grund: string }[]; kreis?: string[]; zeilen?: { liste: ListenArt; id: string; stand: string; verlauf?: VerlaufEintrag[] }[]; state?: TasksState; /** Paket C3: neue Instanzen wiederkehrender Aufgaben. */ serien?: string[] }

/** Ein PATCH — Status 0 = keine Verbindung. Kleine Körper mit keepalive (überleben das Schließen des Tabs). */
async function schreiben(k: Record<string, unknown>): Promise<{ status: number; d: SchreibAntwort }> {
  const text = JSON.stringify(k);
  try {
    const r = await fetch(WEG, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text, keepalive: text.length < 60_000 });
    return { status: r.status, d: (await r.json().catch(() => ({}))) as SchreibAntwort };
  } catch { return { status: 0, d: {} }; }
}

const zeileIn = (s: TasksState, liste: ListenArt, id: string): Zeile | null => (((s[liste] ?? []) as unknown as Zeile[]).find(x => x.id === id) ?? null);
const lies = (k: string): string | null => { try { return window.sessionStorage.getItem(k); } catch { return null; } };
const schreibe = (k: string, v: string | null) => { try { if (v === null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, v); } catch { /* voll/privat — der Server bleibt die Wahrheit */ } };

export function TasksProvider({ children }: { children: ReactNode }) {
  const [voll, dispatch] = useReducer(tasksReducer, initialState);
  const [ready, setReady] = useState(false);
  const [spaces, setSpaces] = useState<AufgabenSpace[]>([]);
  /** Laden fehlgeschlagen (oder kein Zugang) — dann wird nichts gespeichert, um echte Daten zu schützen. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const [lage, setLage] = useState<SpeicherLage>({ offen: 0, phase: 'ruhig', abgelehnt: [], konflikte: [] });
  const vollRef = useRef(voll);
  vollRef.current = voll;
  const hydrated = useRef(false);
  const ladeFehlerRef = useRef(false);
  /** Der zuletzt vom Server BESTÄTIGTE Stand (Sicht ohne `stand`) — alles, was die Sicht davon unterscheidet, steht aus. */
  const server = useRef<TasksState | null>(null);
  /** Stand je Zeile aus der letzten Server-Antwort (Fingerabdruck) — geht mit jeder Änderung mit (409 bei veraltet). */
  const staende = useRef<Staende>(new Map());
  /** Schreiben und Abgleichen laufen nacheinander — jeder Schritt liest die Stände, die der vorige brachte. */
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wiederTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const versuch = useRef(0);
  /** Der letzte Versuch scheiterte vorübergehend — ein neuer ist geplant. */
  const wiederholen = useRef(false);
  const unterwegs = useRef(false);
  /** Gesperrt: „bitte neu laden“ (anderer Bau) oder kein Zugang — dann wird nicht mehr gesendet (die Änderungen bleiben gemerkt). */
  const blockiert = useRef<null | 'neuLaden' | 'gesperrt'>(null);
  const abgelehnt = useRef<Map<string, { json: string; titel: string; grund: string }>>(new Map());
  const konflikte = useRef<Konflikt[]>([]);
  const person = useRef<string>('');

  const offeneOps = useCallback((): OpsJe => (server.current ? unterschied(server.current, vollRef.current, staende.current) : leereOps()), []);
  /**
   * Eine Aktion, die Serverstand und Sicht GEMEINSAM ändert (Abgleich, Verlauf): die Sicht-Referenz sofort mitziehen —
   * sonst sähe ein Schritt bis zum nächsten Zeichnen neuen Serverstand gegen alte Sicht und hielte fremde Änderungen
   * für eigene (und schickte sie mit neuem Stand zurück).
   */
  const gemeinsam = useCallback((a: AufgabenAktion) => {
    vollRef.current = tasksReducer(vollRef.current, a);
    dispatch(a);
  }, []);
  const lageSetzen = useCallback((teil: Partial<SpeicherLage> = {}) => {
    const offen = anzahl(offeneOps());
    setLage(alt => ({
      ...alt, offen, ...teil,
      abgelehnt: Array.from(abgelehnt.current.entries()).map(([k, a]) => ({ schluessel: k, titel: a.titel, grund: a.grund })),
      konflikte: [...konflikte.current],
      ...(teil.phase === undefined ? { phase: blockiert.current ?? (unterwegs.current ? 'sendet' : wiederholen.current && offen ? 'wiederholen' : 'ruhig') } : {}),
    }));
  }, [offeneOps]);

  /** Ausstehendes im Sitzungsspeicher merken (oder löschen, wenn nichts aussteht). */
  const merken = useCallback(() => {
    if (!hydrated.current || !person.current) return;
    const ops = offeneOps();
    schreibe(MERKER, anzahl(ops) ? JSON.stringify(merkenAus(ops, person.current, new Date().toISOString())) : null);
  }, [offeneOps]);

  // ── Abgleich: neuer Serverstand, ausstehende Änderungen wieder darauf ────────────────────────────────
  const uebernehmen = useCallback((roh: TasksState, serverGewinnt: readonly string[] = []) => {
    const neu: Staende = new Map();
    const basis = ohneStand(roh, neu);
    const alt = server.current ?? leererStand();
    const gewinnt = new Set(serverGewinnt);
    // Ausstehende Zeilen behalten ihren ALTEN Stand — so fällt eine fremde Änderung daran als Konflikt auf.
    for (const k of schluesselVon(unterschied(alt, vollRef.current, new Map()))) {
      if (gewinnt.has(k)) continue;
      const s = staende.current.get(k);
      if (s) neu.set(k, s);
    }
    server.current = basis;
    staende.current = neu;
    gemeinsam({ type: 'ABGLEICH', payload: { basis, altServer: alt, serverGewinnt } });
  }, [gemeinsam]);

  const abgleichenJetzt = useCallback(async (serverGewinnt: readonly string[] = []) => {
    try {
      // `no-cache` = immer beim Server nachfragen, aber mit ETag (29.09., #86): unverändert → 304, der Browser nimmt seinen Stand.
      const r = await fetch(`${WEG}?papierkorb=1`, { cache: 'no-cache' });
      if (!r.ok) return;
      const d = (await r.json()) as { state: TasksState | null; spaces?: AufgabenSpace[] };
      if (Array.isArray(d.spaces)) setSpaces(d.spaces);
      if (d.state && Array.isArray(d.state.tasks)) uebernehmen(d.state, serverGewinnt);
    } catch { /* offline — nächster Versuch beim nächsten Abgleich */ }
  }, [uebernehmen]);

  const rehydrate = useCallback(async () => {
    const p = kette.current.then(() => abgleichenJetzt());
    kette.current = p.catch(() => {});
    await p.catch(() => {});
  }, [abgleichenJetzt]);

  // ── Senden ─────────────────────────────────────────────────────────────────────────────────────────
  const sendenJetzt = useCallback(async (): Promise<void> => {
    if (!hydrated.current || ladeFehlerRef.current || blockiert.current || !server.current) return;
    clearTimeout(wiederTimer.current);
    // Abgelehnte Zeilen gehen erst wieder, wenn sich an ihnen etwas geändert hat.
    const alle = offeneOps();
    const ops = filtern(alle, (k, o) => {
      const a = abgelehnt.current.get(k);
      if (!a) return true;
      if ((o.op === 'upsert' ? JSON.stringify(o.eintrag) : 'geloescht') !== a.json) { abgelehnt.current.delete(k); return true; }
      return false;
    });
    if (!anzahl(ops)) { lageSetzen({ phase: blockiert.current ?? 'ruhig' }); merken(); return; }
    unterwegs.current = true;
    lageSetzen({ phase: 'sendet' });
    const schlange = pakete(ops);
    let nachladen = false;
    let bestaetigt: Record<string, true> = {};
    try {
      while (schlange.length) {
        const p = schlange[0];
        const r = await schreiben({ ...koerper(p), ...bestaetigt });
        const d = r.d;
        if (r.status >= 200 && r.status < 300 && d.ok !== false) {
          schlange.shift(); bestaetigt = {};
          // Bestätigt: jetzt (und erst jetzt) gilt es als gespeichert.
          server.current = aufOps(server.current!, p);
          for (const a of LISTEN) for (const o of p[a]) { const k = schluessel(a, opId(o)); abgelehnt.current.delete(k); if (o.op === 'delete') staende.current.delete(k); }
          const gesendet = schluesselVon(p);
          for (const z of d.zeilen ?? []) {
            staende.current.set(schluessel(z.liste, z.id), z.stand);
            // Der Server hat Zeilen geändert, die wir nicht geschickt haben (Serie, Umbenennen, Papierkorb-Kette) → nachladen.
            if (!gesendet.has(schluessel(z.liste, z.id))) nachladen = true;
          }
          // Verlauf schreibt der Server — in Sicht UND bestätigten Stand, damit er nicht als Änderung zurückgeht.
          const verlauf = (d.zeilen ?? []).filter(z => z.liste === 'tasks' && Array.isArray(z.verlauf)).map(z => ({ id: z.id, verlauf: z.verlauf! }));
          if (verlauf.length) {
            server.current = { ...server.current!, tasks: verlaufNachtragen(server.current!.tasks, verlauf) };
            gemeinsam({ type: 'VERLAUF_NACHTRAGEN', payload: verlauf });
          }
          if (d.serien?.length) nachladen = true;
          versuch.current = 0;
          wiederholen.current = false;
          continue;
        }
        if (istNeuLaden(r.status, d)) { blockiert.current = 'neuLaden'; window.dispatchEvent(new CustomEvent(NEU_LADEN_EREIGNIS)); return; }
        if (voruebergehend(r.status)) {
          // Netz weg, Neustart beim Hochladen (502), Sitzung abgelaufen: nichts verwerfen — später erneut.
          const ms = wartezeit(versuch.current++);
          wiederholen.current = true;
          clearTimeout(wiederTimer.current);
          wiederTimer.current = setTimeout(() => { void senden(); }, ms);
          lageSetzen({ phase: 'wiederholen', grund: r.status === 0 ? 'keine Verbindung' : r.status === 401 ? 'Sitzung abgelaufen — bitte neu anmelden' : `Server antwortet ${r.status}`, naechsterVersuch: Date.now() + ms });
          return;
        }
        if (r.status === 403) { blockiert.current = 'gesperrt'; lageSetzen({ phase: 'gesperrt', grund: d.error ?? 'Kein Zugang.' }); return; }
        if (r.status === 409 && d.konflikte?.length && d.state) {
          // Nur die betroffenen Zeilen nehmen die Fassung des Servers an; die eigene bleibt als „Deine Fassung“.
          const basis = ohneStand(d.state, new Map());
          const gewinnt: string[] = [];
          for (const k of d.konflikte) {
            const key = schluessel(k.liste, k.id);
            const meine = zeileIn(vollRef.current, k.liste, k.id);
            const srv = zeileIn(basis, k.liste, k.id);
            gewinnt.push(key);
            if (gleichOhneZeit(meine, srv)) continue; // derselbe Inhalt (z. B. schon gespeichert) — kein echter Konflikt
            konflikte.current = [...konflikte.current.filter(x => x.schluessel !== key), { schluessel: key, liste: k.liste, id: k.id, titel: zeilenTitel(meine ?? srv), grund: k.grund, meine, server: srv }];
          }
          uebernehmen(d.state, gewinnt);
          window.dispatchEvent(new CustomEvent(AUFGABEN_KONFLIKT));
          nachladen = false;
          // Der Rest geht mit den neuen Ständen gleich erneut raus.
          clearTimeout(timer.current);
          timer.current = setTimeout(() => { void senden(); }, 50);
          return;
        }
        if (r.status === 409 && (d.massenAenderung || d.massenLoeschung) && !Object.keys(bestaetigt).length) {
          const ja = window.confirm(d.massenLoeschung
            ? 'Damit würde über die Hälfte aller Aufgaben gelöscht.\n\nIst das so gewollt?'
            : `${d.anzahl} Aufgaben würden auf einmal als erledigt markiert.\n\nDas ist ungewöhnlich viel. Ist das so gewollt?`);
          if (ja) { bestaetigt = d.massenLoeschung ? { massenLoeschung: true } : { massenAenderung: true }; continue; }
          // Nicht gewollt: diese Änderungen verwerfen — die Zeilen nehmen wieder den Serverstand.
          schlange.shift(); bestaetigt = {};
          await abgleichenJetzt(Array.from(schluesselVon(p)));
          continue;
        }
        // Inhaltlich abgelehnt (400, 413, Kreis, …): zerlegen, bis die schuldige Zeile allein steht — sie bleibt sichtbar mit Grund.
        schlange.shift(); bestaetigt = {};
        if (anzahl(p) > 1 && !d.kreis?.length) { schlange.unshift(...einzeln(p)); continue; }
        const grund = d.error ?? `abgelehnt (${r.status})`;
        for (const a of LISTEN) for (const o of p[a]) {
          if (d.kreis?.length && a === 'tasks' && !d.kreis.includes(opId(o)) && anzahl(p) > 1) continue;
          const k = schluessel(a, opId(o));
          abgelehnt.current.set(k, { json: o.op === 'upsert' ? JSON.stringify(o.eintrag) : 'geloescht', titel: zeilenTitel(o.op === 'upsert' ? o.eintrag : zeileIn(server.current!, a, opId(o))), grund });
        }
        // Übrige Zeilen des Pakets (bei einem Kreis) gehen einzeln erneut.
        if (d.kreis?.length && anzahl(p) > 1) schlange.unshift(...einzeln(filtern(p, k => !abgelehnt.current.has(k))));
      }
      if (nachladen) await abgleichenJetzt();
    } finally {
      unterwegs.current = false;
      lageSetzen();
      merken();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeneOps, lageSetzen, merken, uebernehmen, abgleichenJetzt, gemeinsam]);

  const senden = useCallback((): Promise<void> => {
    const p = kette.current.then(() => sendenJetzt());
    kette.current = p.catch(() => {});
    return p.catch(() => {});
  }, [sendenJetzt]);

  const jetztSpeichern = useCallback(() => { clearTimeout(timer.current); merken(); void senden(); }, [merken, senden]);

  // Beim Start: persistierten Zustand laden. `hydrated` nur, wenn das Laden WIRKLICH geklappt hat.
  useEffect(() => {
    let alive = true;
    let warten: ReturnType<typeof setTimeout> | undefined;
    const laden = () => {
      if (!alive) return;
      // Noch keine Sitzung (z. B. Anmeldeseite): alle zwei Sekunden nachsehen (23.09.).
      // Auf /anmelden nie (29.09.): ein alter Namens-Zettel hätte sonst 401 von /api/state/tasks geholt.
      const ich = aufAnmeldeseite() ? '' : personLesen();
      if (!ich) { warten = setTimeout(laden, 2000); return; }
      person.current = ich;
      fetch(`${WEG}?papierkorb=1`)
        .then(async r => {
          // Kein Zugang (anderer Haushalt, 28.09.): leise leer — nichts speichern.
          if (r.status === 403) return { gesperrt: true } as const;
          if (!r.ok) throw new Error(`Aufgaben-Store antwortet ${r.status}`);
          return (await r.json()) as { state: TasksState | null; spaces?: AufgabenSpace[] };
        })
        .then(d => {
          if (!alive) return;
          if ('gesperrt' in d) { dispatch({ type: 'HYDRATE', payload: leererStand() }); ladeFehlerRef.current = true; setLadeFehler(true); setReady(true); return; }
          if (Array.isArray(d.spaces)) setSpaces(d.spaces);
          const st: Staende = new Map();
          // Erststart ohne Datei: leerer Stand ist gültig, Speichern erlaubt (PATCH legt den Bestand an).
          const basis = d.state && Array.isArray(d.state.tasks) ? ohneStand(d.state, st) : leererStand();
          server.current = basis;
          staende.current = st;
          // Aus diesem Tab gemerkte, noch nicht bestätigte Änderungen (Neuladen, „bitte neu laden“, Absturz) — mit ihrem
          // ALTEN Stand erneut: hat sie inzwischen jemand geändert, wird es ein Konflikt statt eines stillen Überschreibens.
          const gemerkt = (() => { try { return gemerktAlsOps(JSON.parse(lies(MERKER) ?? 'null'), ich, Date.now()); } catch { return null; } })();
          if (gemerkt) for (const [k, s] of gemerkt.staende) staende.current.set(k, s);
          gemeinsam({ type: 'HYDRATE', payload: gemerkt ? aufOps(basis, gemerkt.ops) : basis });
          hydrated.current = true;
          setReady(true);
        })
        .catch(err => {
          if (!alive) return;
          console.error('[MAKE OS] Aufgaben konnten nicht geladen werden — Speichern ist gesperrt, bis das Laden klappt.', err);
          ladeFehlerRef.current = true;
          setLadeFehler(true);
          setReady(true);
        });
    };
    laden();
    return () => { alive = false; if (warten) clearTimeout(warten); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regelmäßiger Abgleich (zu zweit): alle 45 s, bei Fokus und beim Zurückkehren in den Tab. Ausstehendes bleibt (Rebase).
  useEffect(() => {
    const zug = () => {
      if (!hydrated.current || ladeFehler || document.visibilityState !== 'visible' || unterwegs.current) return;
      void rehydrate();
    };
    const iv = setInterval(zug, 45_000);
    const sicht = () => { if (document.visibilityState === 'visible') zug(); };
    const online = () => { versuch.current = 0; void senden(); };
    window.addEventListener('focus', zug);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', sicht);
    return () => { clearInterval(iv); window.removeEventListener('focus', zug); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', sicht); };
  }, [ladeFehler, rehydrate, senden]);

  // Bei jeder Änderung: kurz sammeln, dann schreiben — nur was sich gegenüber dem bestätigten Serverstand geändert hat.
  useEffect(() => {
    if (!hydrated.current || ladeFehler) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { merken(); lageSetzen(); void senden(); }, 400);
    return () => clearTimeout(timer.current);
  }, [voll, ladeFehler, merken, lageSetzen, senden]);

  // Verlassen: sofort schreiben (keepalive) statt nach 400 ms; Warnung, solange etwas aussteht (A5).
  useEffect(() => {
    const raus = () => { if (!hydrated.current) return; clearTimeout(timer.current); merken(); if (!unterwegs.current) void senden(); };
    const verdeckt = () => { if (document.visibilityState === 'hidden') raus(); };
    const warnen = (e: BeforeUnloadEvent) => {
      if (!hydrated.current || ladeFehlerRef.current) return;
      if (!unterwegs.current && !anzahl(offeneOps())) return;
      merken();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', raus);
    window.addEventListener('beforeunload', warnen);
    document.addEventListener('visibilitychange', verdeckt);
    return () => { window.removeEventListener('pagehide', raus); window.removeEventListener('beforeunload', warnen); document.removeEventListener('visibilitychange', verdeckt); };
  }, [merken, senden, offeneOps]);

  const istOffen = useCallback((liste: ListenArt, id: string) => {
    if (!server.current) return false;
    const a = zeileIn(server.current, liste, id), b = zeileIn(vollRef.current, liste, id);
    return JSON.stringify(a) !== JSON.stringify(b);
  }, []);

  const konfliktLoesen = useCallback((k: string, wie: 'meine' | 'schliessen') => {
    const c = konflikte.current.find(x => x.schluessel === k);
    konflikte.current = konflikte.current.filter(x => x.schluessel !== k);
    if (c && wie === 'meine') dispatch({ type: 'ZEILEN_SETZEN', payload: [{ liste: c.liste, id: c.id, eintrag: c.meine }] });
    lageSetzen();
  }, [lageSetzen]);

  const ablehnungLoesen = useCallback((k: string, wie: 'verwerfen' | 'erneut') => {
    abgelehnt.current.delete(k);
    if (wie === 'verwerfen' && server.current) {
      const { liste, id } = ausSchluessel(k);
      dispatch({ type: 'ZEILEN_SETZEN', payload: [{ liste, id, eintrag: zeileIn(server.current, liste, id) }] });
    } else void senden();
    lageSetzen();
  }, [lageSetzen, senden]);

  const sicht = useMemo(() => aufgabenSicht(voll), [voll]);
  const papierkorb = useMemo(() => papierkorbEintraege(voll), [voll]);
  const wert = useMemo<TasksContextValue>(() => ({
    state: sicht, voll, dispatch, ready, rehydrate, spaces, speicher: lage, istOffen, papierkorb, jetztSpeichern, konfliktLoesen, ablehnungLoesen,
  }), [sicht, voll, ready, rehydrate, spaces, lage, istOffen, papierkorb, jetztSpeichern, konfliktLoesen, ablehnungLoesen]);

  return (
    <TasksContext.Provider value={wert}>
      {children}
      <SpeicherHinweis lage={lage} onJetzt={jetztSpeichern} onKonflikt={konfliktLoesen} onAbgelehnt={ablehnungLoesen} fassungText={fassungText} />
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
