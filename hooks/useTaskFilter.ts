import { useMemo } from 'react';
import { useTasks } from '@/context/TasksContext';
import type { Owner, Priority } from '@/types/common';
import type { TaskStatus } from '@/types/tasks';

export interface TaskFilterOptions {
  projectId?: string;
  owner?: Owner | 'all';
  status?: TaskStatus | 'all';
  priority?: Priority | 'all';
  search?: string;
}

export function useTaskFilter(options: TaskFilterOptions = {}) {
  const { state } = useTasks();
  return useMemo(() => {
    let tasks = state.tasks;
    if (options.projectId) tasks = tasks.filter(t => t.projectId === options.projectId);
    if (options.owner && options.owner !== 'all') tasks = tasks.filter(t => t.assignee === options.owner || t.assignee === 'both');
    if (options.status && options.status !== 'all') tasks = tasks.filter(t => t.status === options.status);
    if (options.priority && options.priority !== 'all') tasks = tasks.filter(t => t.priority === options.priority);
    if (options.search) {
      const q = options.search.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [state.tasks, options.projectId, options.owner, options.status, options.priority, options.search]);
}
