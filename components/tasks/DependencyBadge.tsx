'use client';

import { AlertCircle } from 'lucide-react';
import { useTasks } from '@/context/TasksContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DependencyBadgeProps {
  blockedByTaskId: string;
}

export function DependencyBadge({ blockedByTaskId }: DependencyBadgeProps) {
  const { state } = useTasks();
  const blocking = state.tasks.find(t => t.id === blockedByTaskId);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-950/40 text-red-400 border border-red-900/40 cursor-default">
            <AlertCircle className="h-2.5 w-2.5" />
            Blocked
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Blocked by: <span className="font-medium">{blocking?.title ?? 'Unknown task'}</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
