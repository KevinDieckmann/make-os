'use client';

import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/context/TasksContext';

export function QuickAddWidget() {
  const { state, dispatch } = useTasks();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    const count = state.tasks.filter(t => t.projectId === projectId).length;
    dispatch({
      type: 'ADD_TASK',
      payload: { projectId, title: title.trim(), status: 'todo', priority: 'medium', assignee: 'both', tags: [], subTasks: [], dependencies: [], sortOrder: count },
    });
    setTitle('');
  };

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Quick Add Task
      </h3>
      <form onSubmit={handleAdd} className="space-y-2">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Aufgabe schnell erfassen..."
          className="h-8 text-xs"
        />
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Projekt..." />
            </SelectTrigger>
            <SelectContent>
              {state.projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" className="h-7 px-2" disabled={!title.trim() || !projectId}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
