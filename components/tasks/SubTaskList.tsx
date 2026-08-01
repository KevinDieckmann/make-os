import { SubTaskRow } from './SubTaskRow';
import type { SubTask } from '@/types/tasks';

interface SubTaskListProps {
  taskId: string;
  subTasks: SubTask[];
}

export function SubTaskList({ taskId, subTasks }: SubTaskListProps) {
  if (subTasks.length === 0) return null;
  const sorted = [...subTasks].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mt-1 border-l border-border ml-4">
      {sorted.map(st => (
        <SubTaskRow key={st.id} subTask={st} taskId={taskId} />
      ))}
    </div>
  );
}
