'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskRow } from './TaskRow';
import { TaskDetail } from './TaskDetail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTasks } from '@/context/TasksContext';
import type { Task } from '@/types/tasks';

interface TaskListProps {
  tasks: Task[];
  projectId: string;
}

export function TaskList({ tasks, projectId }: TaskListProps) {
  const { dispatch } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    dispatch({
      type: 'ADD_TASK',
      payload: {
        projectId,
        title: newTaskTitle.trim(),
        status: 'todo',
        priority: 'medium',
        assignee: 'both',
        tags: [],
        subTasks: [],
        dependencies: [],
        sortOrder: tasks.length,
      },
    });
    setNewTaskTitle('');
    setAddingTask(false);
  };

  return (
    <div>
      <div className="space-y-0.5">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onOpenDetail={setSelectedTask} />
        ))}
      </div>

      {addingTask ? (
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 mt-2 px-3">
          <Input
            autoFocus
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="Aufgabe eingeben..."
            className="h-8 text-sm"
            onKeyDown={e => e.key === 'Escape' && setAddingTask(false)}
          />
          <Button type="submit" size="sm" disabled={!newTaskTitle.trim()}>Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAddingTask(false)}>✕</Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground hover:text-foreground w-full justify-start px-3"
          onClick={() => setAddingTask(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Aufgabe hinzufügen
        </Button>
      )}

      <TaskDetail task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
