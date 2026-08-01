'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { TaskForm } from './TaskForm';
import { SubTaskList } from './SubTaskList';
import { DependencyBadge } from './DependencyBadge';
import { OwnerBadge } from '@/components/shared/OwnerBadge';
import { PriorityDot } from '@/components/shared/PriorityDot';
import { TagChip } from '@/components/shared/TagChip';
import { useTasks } from '@/context/TasksContext';
import type { Task } from '@/types/tasks';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';

interface TaskDetailProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetail({ task, open, onClose }: TaskDetailProps) {
  const { dispatch } = useTasks();
  const [editing, setEditing] = useState(false);

  if (!task) return null;

  const handleUpdate = (data: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, ...data } });
    setEditing(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_TASK', payload: { id: task.id } });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { setEditing(false); onClose(); } }}>
      <SheetContent side="right" className="flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-base font-semibold pr-8 leading-snug">{task.title}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <OwnerBadge owner={task.assignee} />
            <PriorityDot priority={task.priority} showLabel />
            {task.dueDate && (
              <span className="text-[10px] text-muted-foreground">
                Fällig: {format(parseISO(task.dueDate), 'dd.MM.yyyy')}
              </span>
            )}
            {task.tags.map(tag => <TagChip key={tag.id} tag={tag} />)}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {editing ? (
            <div className="p-5">
              <TaskForm
                task={task}
                projectId={task.projectId}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {task.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Beschreibung</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.description}</p>
                </div>
              )}

              {task.dependencies.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Abhängigkeiten</p>
                  <div className="space-y-1">
                    {task.dependencies.map((dep, i) => (
                      <DependencyBadge key={i} blockedByTaskId={dep.blockedByTaskId} />
                    ))}
                  </div>
                </div>
              )}

              {task.subTasks.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Unteraufgaben ({task.subTasks.filter(s => s.completed).length}/{task.subTasks.length})
                  </p>
                  <SubTaskList taskId={task.id} subTasks={task.subTasks} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Löschen
          </Button>
          <Button size="sm" onClick={() => setEditing(v => !v)}>
            {editing ? 'Abbrechen' : 'Bearbeiten'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
