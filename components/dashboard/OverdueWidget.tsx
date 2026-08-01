'use client';

import Link from 'next/link';
import { useTaskFilter } from '@/hooks/useTaskFilter';
import { AlertCircle } from 'lucide-react';
import { isPast, parseISO, format } from 'date-fns';
import { PriorityDot } from '@/components/shared/PriorityDot';
import { OwnerAvatar } from '@/components/shared/OwnerAvatar';

export function OverdueWidget() {
  const tasks = useTaskFilter({});
  const overdue = tasks.filter(t => t.dueDate && t.status !== 'done' && isPast(parseISO(t.dueDate)));

  if (overdue.length === 0) return null;

  return (
    <div className="bg-surface-1 border border-red-900/40 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        Überfällig ({overdue.length})
      </h3>
      <div className="space-y-1.5">
        {overdue.map(t => (
          <Link key={t.id} href={`/tasks/${t.projectId}`} className="flex items-center gap-2 hover:bg-surface-2 rounded px-1.5 -mx-1.5 py-1 transition-colors">
            <PriorityDot priority={t.priority} />
            <span className="flex-1 text-xs text-foreground truncate">{t.title}</span>
            <span className="text-[10px] text-red-400 shrink-0">{format(parseISO(t.dueDate!), 'dd.MM')}</span>
            <OwnerAvatar owner={t.assignee} size="xs" />
          </Link>
        ))}
      </div>
    </div>
  );
}
