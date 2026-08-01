'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EventChip } from './EventChip';
import { EventModal } from './EventModal';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { getMonthGrid, isSameMonth, isSameDay, isToday, parseISO, format } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function MonthView() {
  const { currentDate, setDate } = useCalendarNav();
  const events = useCalendarEvents();
  const weeks = getMonthGrid(currentDate);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);

  const getEventsForDay = (day: Date) => {
    return events.filter(e => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      return isSameDay(day, start) || (day >= start && day <= end);
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, di) => {
              const dayEvents = getEventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const selected = isSameDay(day, currentDate);
              const MAX_VISIBLE = 3;
              const overflow = dayEvents.length - MAX_VISIBLE;

              return (
                <div
                  key={di}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1 min-h-[90px] group cursor-pointer hover:bg-surface-2/30 transition-colors',
                    !inMonth && 'opacity-40'
                  )}
                  onClick={() => setDate(day.toISOString().split('T')[0])}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-medium',
                        today && 'bg-primary text-primary-foreground',
                        !today && selected && 'bg-surface-3 text-foreground',
                        !today && !selected && 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setNewEventDate(day.toISOString().split('T')[0]); }}
                      className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_VISIBLE).map(e => (
                      <EventChip
                        key={e.id}
                        event={e}
                        compact
                        onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}
                      />
                    ))}
                    {overflow > 0 && (
                      <span className="text-[9px] text-muted-foreground pl-1">+{overflow} weitere</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <EventModal event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
      <EventModal event={null} open={!!newEventDate} onClose={() => setNewEventDate(null)} defaultDate={newEventDate ?? undefined} />
    </div>
  );
}
