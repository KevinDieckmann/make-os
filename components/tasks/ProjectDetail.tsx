'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FilterBar } from './FilterBar';
import { TaskList } from './TaskList';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { OwnerBadge } from '@/components/shared/OwnerBadge';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { useTaskFilter } from '@/hooks/useTaskFilter';
import { useTasks } from '@/context/TasksContext';
import { PROJECT_CATEGORY_CONFIG } from '@/lib/constants';
import type { Owner } from '@/types/common';
import type { TaskStatus } from '@/types/tasks';
import { format, parseISO } from 'date-fns';

interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const { state } = useTasks();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<Owner | 'all'>('all');
  const project = state.projects.find(p => p.id === projectId);
  const progress = useProjectProgress(projectId);
  const tasks = useTaskFilter({ projectId, status: statusFilter, owner: ownerFilter });

  if (!project) return <div className="text-muted-foreground text-sm">Projekt nicht gefunden.</div>;

  const catConfig = PROJECT_CATEGORY_CONFIG[project.category];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Alle Projekte
        </Link>
        <div className="flex items-start gap-3">
          <div className="h-10 w-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: project.color }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-foreground">{project.title}</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${catConfig.color}20`, color: catConfig.color }}>
                {catConfig.label}
              </span>
            </div>
            {project.description && <p className="text-sm text-muted-foreground mb-2">{project.description}</p>}
            <div className="flex items-center gap-3">
              <OwnerBadge owner={project.owner} />
              {project.dueDate && (
                <span className="text-xs text-muted-foreground">Fällig: {format(parseISO(project.dueDate), 'dd.MM.yyyy')}</span>
              )}
              <span className="text-xs text-muted-foreground">{progress.completed}/{progress.total} Tasks</span>
            </div>
          </div>
        </div>
        <div className="mt-4 max-w-sm">
          <ProgressBar percent={progress.percent} showLabel color={project.color} height="md" />
        </div>
      </div>

      {/* Filter */}
      <div className="border-b border-border pb-4">
        <FilterBar
          statusFilter={statusFilter}
          ownerFilter={ownerFilter}
          onStatusChange={setStatusFilter}
          onOwnerChange={setOwnerFilter}
        />
      </div>

      {/* Tasks */}
      <div className="bg-surface-1 rounded-lg border border-border p-2">
        <TaskList tasks={tasks} projectId={projectId} />
      </div>
    </div>
  );
}
