'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, ListTodo } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { OwnerAvatar } from '@/components/shared/OwnerAvatar';
import { PriorityDot } from '@/components/shared/PriorityDot';
import { DependencyBadge } from './DependencyBadge';
import { SubTaskList } from './SubTaskList';
import { useTasks } from '@/context/TasksContext';
import type { Task } from '@/types/tasks';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast } from 'date-fns';

interface TaskRowProps {
  task: Task;
  onOpenDetail: (task: Task) => void;
}

export function TaskRow({ task, onOpenDetail }: TaskRowProps) {
  const { dispatch } = useTasks();
  const [expanded, setExpanded] = useState(false);
  const done = task.status === 'done';
  const overdue = task.dueDate && !done && isPast(parseISO(task.dueDate));
  const completedSubTasks = task.subTasks.filter(s => s.completed).length;
  const hasSubTasks = task.subTasks.length > 0;

  return (
    <div className="group">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-2 transition-colors cursor-pointer',
          done && 'opacity-50'
        )}
      >
        <Checkbox
          checked={done}
          onCheckedChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: task.id } })}
          className="shrink-0"
          onClick={e => e.stopPropagation()}
        />

        {/* Expand arrow */}
        {hasSubTasks ? (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Title + meta */}
        <div
          className="flex-1 flex items-center gap-2 min-w-0"
          onClick={() => onOpenDetail(task)}
        >
          <span className={cn('text-sm truncate', done && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
          {task.dependencies.length > 0 && (
            <DependencyBadge blockedByTaskId={task.dependencies[0].blockedByTaskId} />
          )}
        </div>

        {/* Right meta cluster */}
        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={() => onOpenDetail(task)}>
          {hasSubTasks && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <ListTodo className="h-2.5 w-2.5" />
              {completedSubTasks}/{task.subTasks.length}
            </span>
          )}
          {task.dueDate && (
            <span className={cn('text-[10px]', overdue ? 'text-red-400' : 'text-muted-foreground')}>
              {format(parseISO(task.dueDate), 'dd.MM')}
            </span>
          )}
          <PriorityDot priority={task.priority} />
          <OwnerAvatar owner={task.assignee} size="xs" />
        </div>
      </div>

      {hasSubTasks && expanded && (
        <SubTaskList taskId={task.id} subTasks={task.subTasks} />
      )}
    </div>
  );
}
