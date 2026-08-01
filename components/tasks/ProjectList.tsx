'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { ProjectForm } from './ProjectForm';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTasks } from '@/context/TasksContext';
import { useApp } from '@/context/AppContext';
import { FolderKanban } from 'lucide-react';

export function ProjectList() {
  const { state } = useTasks();
  const { activeOwnerFilter } = useApp();
  const [showForm, setShowForm] = useState(false);

  const projects = state.projects.filter(p => {
    if (p.archived) return false;
    if (activeOwnerFilter === 'all') return true;
    return p.owner === activeOwnerFilter || p.owner === 'both';
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{projects.length} aktive Projekte</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Neues Projekt
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Keine Projekte"
          description="Erstelle dein erstes Projekt, um Tasks zu organisieren."
          action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1" />Projekt erstellen</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
