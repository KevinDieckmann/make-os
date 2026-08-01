'use client';

import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useTaskFilter } from '@/hooks/useTaskFilter';
import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import { isSameDay, parseISO, format } from '@/lib/date-utils';
import { CheckCircle2, Clock } from 'lucide-react';

export function TodayWidget() {
  const events = useCalendarEvents();
  const tasks = useTaskFilter({ status: 'todo' });

  const today = new Date();
  const todayEvents = events
    .filter(e => !e.allDay && isSameDay(today, parseISO(e.startDate)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const dueTasks = tasks.filter(t => t.dueDate && isSameDay(today, parseISO(t.dueDate)));

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-primary" />
        Heute — {format(today, 'EEEE, d. MMMM')}
      </h3>

      {todayEvents.length === 0 && dueTasks.length === 0 && (
        <p className="text-xs text-muted-foreground">Kein Ereignisse heute.</p>
      )}

      <div className="space-y-1.5">
        {todayEvents.map(e => {
          const config = EVENT_CATEGORY_CONFIG[e.category];
          return (
            <div key={e.id} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10 shrink-0 text-right">
                {format(parseISO(e.startDate), 'HH:mm')}
              </span>
              <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ backgroundColor: config.bg, color: config.color }}>
                {e.title}
              </div>
            </div>
          );
        })}

        {dueTasks.map(t => (
          <div key={t.id} className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0 ml-auto mr-1" />
            <div className="flex-1 px-2 py-1 rounded text-xs bg-surface-2 text-foreground/80 border border-border">
              {t.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
