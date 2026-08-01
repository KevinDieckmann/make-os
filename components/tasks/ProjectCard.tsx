'use client';

import Link from 'next/link';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { OwnerAvatar } from '@/components/shared/OwnerAvatar';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { PROJECT_CATEGORY_CONFIG } from '@/lib/constants';
import type { Project } from '@/types/tasks';
import { format, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const progress = useProjectProgress(project.id);
  const catConfig = PROJECT_CATEGORY_CONFIG[project.category];

  return (
    <Link href={`/tasks/${project.id}`} className="block">
      <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-surface-3 transition-all hover:bg-surface-2 group cursor-pointer">
        {/* Color accent + title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-8 w-1 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: project.color }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {project.title}
            </h3>
            <span className="text-[10px] font-medium mt-0.5" style={{ color: catConfig.color }}>
              {catConfig.label}
            </span>
          </div>
          <OwnerAvatar owner={project.owner} size="sm" />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 ml-4">{project.description}</p>
        )}

        {/* Progress */}
        <div className="ml-4 space-y-1.5">
          <ProgressBar percent={progress.percent} color={project.color} height="xs" showLabel />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total} Tasks</span>
            {project.dueDate && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {format(parseISO(project.dueDate), 'dd.MM.yy')}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
