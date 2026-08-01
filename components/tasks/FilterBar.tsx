'use client';

import { cn } from '@/lib/utils';
import type { Owner } from '@/types/common';
import type { TaskStatus } from '@/types/tasks';

const STATUSES: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'backlog', label: 'Backlog' },
];

const OWNERS: { value: Owner | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'malin', label: 'Malin' },
  { value: 'kevin', label: 'Kevin' },
  { value: 'both', label: 'Both' },
];

interface FilterBarProps {
  statusFilter: TaskStatus | 'all';
  ownerFilter: Owner | 'all';
  onStatusChange: (v: TaskStatus | 'all') => void;
  onOwnerChange: (v: Owner | 'all') => void;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground hover:border-border'
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({ statusFilter, ownerFilter, onStatusChange, onOwnerChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        {STATUSES.map(s => (
          <FilterPill key={s.value} active={statusFilter === s.value} onClick={() => onStatusChange(s.value)}>
            {s.label}
          </FilterPill>
        ))}
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1">
        {OWNERS.map(o => (
          <FilterPill key={o.value} active={ownerFilter === o.value} onClick={() => onOwnerChange(o.value)}>
            {o.label}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
