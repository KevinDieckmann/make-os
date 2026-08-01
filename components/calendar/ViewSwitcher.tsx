'use client';

import { useRouter } from 'next/navigation';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import { cn } from '@/lib/utils';

const VIEWS = [
  { value: 'month', label: 'Monat' },
  { value: 'week', label: 'Woche' },
  { value: 'day', label: 'Tag' },
] as const;

export function ViewSwitcher() {
  const router = useRouter();
  const { view, setView } = useCalendarNav();
  return (
    <div className="flex items-center bg-surface-2 rounded-md p-0.5">
      {VIEWS.map(v => (
        <button
          key={v.value}
          onClick={() => { setView(v.value); router.push(`/calendar/${v.value}`); }}
          className={cn(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            view === v.value ? 'bg-surface-1 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
