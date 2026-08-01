'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { useTasks } from '@/context/TasksContext';
import type { SubTask } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface SubTaskRowProps {
  subTask: SubTask;
  taskId: string;
}

export function SubTaskRow({ subTask, taskId }: SubTaskRowProps) {
  const { dispatch } = useTasks();

  return (
    <div className="flex items-center gap-2 py-1 pl-4 group">
      <Checkbox
        checked={subTask.completed}
        onCheckedChange={() => dispatch({ type: 'TOGGLE_SUBTASK', payload: { taskId, subTaskId: subTask.id } })}
        className="h-3.5 w-3.5"
      />
      <span className={cn('text-xs transition-colors', subTask.completed ? 'line-through text-muted-foreground' : 'text-foreground/80')}>
        {subTask.title}
      </span>
    </div>
  );
}
