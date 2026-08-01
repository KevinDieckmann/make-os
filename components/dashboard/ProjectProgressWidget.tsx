'use client';

import Link from 'next/link';
import { useTasks } from '@/context/TasksContext';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { OwnerAvatar } from '@/components/shared/OwnerAvatar';
import { FolderKanban } from 'lucide-react';

function ProjectProgressRow({ projectId }: { projectId: string }) {
  const { state } = useTasks();
  const progress = useProjectProgress(projectId);
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;
  return (
    <Link href={`/tasks/${project.id}`} className="flex items-center gap-3 py-1.5 hover:bg-surface-2 rounded px-1.5 -mx-1.5 transition-colors group">
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{project.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{progress.completed}/{progress.total}</span>
        </div>
        <ProgressBar percent={progress.percent} color={project.color} height="xs" />
      </div>
      <OwnerAvatar owner={project.owner} size="xs" />
    </Link>
  );
}

export function ProjectProgressWidget() {
  const { state } = useTasks();
  const activeProjects = state.projects.filter(p => !p.archived);

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <FolderKanban className="h-3.5 w-3.5 text-primary" />
        Projekt-Fortschritt
      </h3>
      <div className="space-y-0.5">
        {activeProjects.map(p => <ProjectProgressRow key={p.id} projectId={p.id} />)}
      </div>
    </div>
  );
}
