'use client';

import { useState } from 'react';
import { EventChip } from './EventChip';
import { EventModal } from './EventModal';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { isSameDay, parseISO } from '@/lib/date-utils';
import type { CalendarEvent } from '@/types/calendar';

const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function DayView() {
  const { currentDate } = useCalendarNav();
  const events = useCalendarEvents();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const dayEvents = events.filter(e => isSameDay(currentDate, parseISO(e.startDate)));
  const allDay = dayEvents.filter(e => e.allDay);
  const timed = dayEvents.filter(e => !e.allDay);

  const totalMins = (END_HOUR - START_HOUR) * 60;
  const getPos = (e: CalendarEvent) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    const sm = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const em = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
    return { top: `${(sm / totalMins) * 100}%`, height: `${Math.max(((em - sm) / totalMins) * 100, 2)}%` };
  };

  return (
    <div className="flex-1 overflow-auto">
      {allDay.length > 0 && (
        <div className="border-b border-border p-2 space-y-1">
          <p className="text-[10px] text-muted-foreground">Ganztägig</p>
          {allDay.map(e => <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)}
        </div>
      )}
      <div className="relative" style={{ minHeight: `${HOURS.length * 56}px` }}>
        <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gridTemplateRows: `repeat(${HOURS.length}, 56px)` }}>
          {HOURS.map(hour => (
            <>
              <div key={`h-${hour}`} className="border-b border-border/40 pr-2 text-right text-[9px] text-muted-foreground -translate-y-2">
                {hour}:00
              </div>
              <div key={`c-${hour}`} className="border-b border-border/40 border-l border-border/40" />
            </>
          ))}
        </div>
        <div className="absolute" style={{ left: '48px', right: 0, top: 0, bottom: 0 }}>
          {timed.map(e => {
            const pos = getPos(e);
            return (
              <div key={e.id} className="absolute left-1 right-1" style={{ top: pos.top, height: pos.height }}>
                <EventChip event={e} onClick={() => setSelectedEvent(e)} />
              </div>
            );
          })}
        </div>
      </div>
      <EventModal event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
