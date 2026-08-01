'use client';

import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import { parseISO, format, isSameDay, addDays, isAfter, isBefore } from 'date-fns';
import { CalendarDays } from 'lucide-react';

export function UpcomingWidget() {
  const events = useCalendarEvents();
  const now = new Date();
  const sevenDays = addDays(now, 7);

  const upcoming = events
    .filter(e => {
      const start = parseISO(e.startDate);
      return isAfter(start, now) && isBefore(start, sevenDays);
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 8);

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-primary" />
        Nächste 7 Tage
      </h3>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nichts geplant.</p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map(e => {
            const config = EVENT_CATEGORY_CONFIG[e.category];
            const start = parseISO(e.startDate);
            return (
              <div key={e.id} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                  {isSameDay(start, now) ? 'Heute' : format(start, 'EEE d.')}
                </span>
                <div className="flex-1 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: config.bg, color: config.color }}>
                  {e.title}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
