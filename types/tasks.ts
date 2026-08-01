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
}

export interface TasksState {
  projects: Project[];
  tasks: Task[];
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
