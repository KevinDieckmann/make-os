import { useMemo } from 'react';
import { useTasks } from '@/context/TasksContext';

export function useProjectProgress(projectId: string) {
  const { state } = useTasks();
  return useMemo(() => {
    const tasks = state.tasks.filter(t => t.projectId === projectId);
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent };
  }, [state.tasks, projectId]);
}
