import type { ID, Owner, Priority, Tag, Timestamps } from './common';

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'blocked' | 'done';

export type ProjectCategory = 'personal-malin' | 'personal-kevin' | 'joint' | 'business';

export interface SubTask extends Timestamps {
  id: ID;
  taskId: ID;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface Dependency {
  blockedByTaskId: ID;
  resolvedAt?: string;
}

export interface Task extends Timestamps {
  id: ID;
  projectId: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee: Owner;
  tags: Tag[];
  dueDate?: string;
  subTasks: SubTask[];
  dependencies: Dependency[];
  sortOrder: number;
  completedAt?: string;
  /** Abweichung vom Ort (26.09.): Privat oder Business — ohne Angabe gibt der Ort den Space vor. */
  space?: 'privat' | 'business';
  /** Business-Einheit (27.09.): Selbstständigkeit · KD Ventures · MAKE OS UG oder eine eigene Einheit des Haushalts — nur im Business; Privat verwirft der Schreibweg. */
  einheit?: string;
  // ── Aufgaben-Modell wie Monday/ClickUp (28.09. abends, lib/aufgaben/struktur.ts) ──
  /** Aufgaben-Space: `privat` · `kdc` · `kdv` · `ug` · `m-<firmaId>` (Mandant). `space`/`einheit` werden daraus abgeleitet. */
  spaceId?: AufgabenSpaceId;
  /** Liste im Projekt (z. B. „Januar“) — fehlt = „Sonstige“ des Projekts. */
  listeId?: ID;
  /** Übergeordnete Aufgabe (eine Ebene): die Unteraufgabe erbt Space, Projekt und Liste. */
  parentId?: ID;
  /** Eigener Status des Space — `status` trägt dann dessen Grundstatus (`basis`). */
  statusId?: ID;
  /** Verknüpfung mit dem CRM: Kontakt, Firma, Mandat, Deal (Kennungen). */
  bezug?: AufgabeBezug;
  /** Kommentare mit @-Erwähnung (Speichernamen der Personen). */
  kommentare?: AufgabeKommentar[];
  /** Startdatum (YYYY-MM-DD). */
  startDate?: string;
}

/** `privat` · `kdc` · `kdv` · `ug` · `m-<firmaId>`. */
export type AufgabenSpaceId = string;

export interface AufgabeBezug { kontaktId?: string; firmaId?: string; mandatId?: string; dealId?: string }

export interface AufgabeKommentar {
  id: ID;
  /** Speichername der Person (kevin, malin, …). */
  von: string;
  text: string;
  /** ISO-Zeitpunkt. */
  am: string;
  /** Erwähnte Personen (Speichernamen). */
  erwaehnt?: string[];
}

/** Eine Liste im Projekt (z. B. Januar, Februar, März). */
export interface AufgabenListe {
  id: ID;
  projektId: ID;
  titel: string;
  sortOrder: number;
  archiviert?: boolean;
}

/** Eigener Status je Space — `basis` sagt allen Lesern, was er bedeutet (erledigt = done). */
export interface AufgabenStatus {
  id: ID;
  spaceId: AufgabenSpaceId;
  label: string;
  /** #rrggbb */
  farbe: string;
  basis: TaskStatus;
  sortOrder: number;
}

export interface Project extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  category: ProjectCategory;
  owner: Owner;
  color: string;
  tags: Tag[];
  archived: boolean;
  dueDate?: string;
  /** Aufgaben-Space des Projekts (28.09. abends) — fehlt im Altbestand, die Übernahme leitet ihn ab. */
  spaceId?: AufgabenSpaceId;
}

export interface TasksState {
  projects: Project[];
  tasks: Task[];
  /** Listen je Projekt (28.09. abends). */
  listen?: AufgabenListe[];
  /** Eigene Status je Space (28.09. abends). */
  statusEigen?: AufgabenStatus[];
}

export type TasksAction =
  | { type: 'HYDRATE'; payload: TasksState }
  | { type: 'ADD_PROJECT'; payload: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> & { id: ID } }
  | { type: 'DELETE_PROJECT'; payload: { id: ID } }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: ID } }
  | { type: 'DELETE_TASK'; payload: { id: ID } }
  | { type: 'TOGGLE_TASK'; payload: { id: ID } }
  | { type: 'ADD_SUBTASK'; payload: Omit<SubTask, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'TOGGLE_SUBTASK'; payload: { taskId: ID; subTaskId: ID } }
  | { type: 'REORDER_TASKS'; payload: { projectId: ID; orderedIds: ID[] } };
