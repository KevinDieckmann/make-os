'use client';

import { useState } from 'react';
import { EventChip } from './EventChip';
import { EventModal } from './EventModal';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { getWeekDays, isSameDay, isToday, parseISO, format } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function WeekView() {
  const { currentDate } = useCalendarNav();
  const events = useCalendarEvents();
  const days = getWeekDays(currentDate);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const allDayEvents = events.filter(e => e.allDay);
  const timedEvents = events.filter(e => !e.allDay);

  const getTimedEventsForDay = (day: Date) =>
    timedEvents.filter(e => isSameDay(day, parseISO(e.startDate)));

  const getAllDayEventsForDay = (day: Date) =>
    allDayEvents.filter(e => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      return isSameDay(day, start) || (day >= start && day <= end);
    });

  const getEventPosition = (event: CalendarEvent) => {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const endMins = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
    const totalMins = (END_HOUR - START_HOUR) * 60;
    return {
      top: `${(startMins / totalMins) * 100}%`,
      height: `${Math.max(((endMins - startMins) / totalMins) * 100, 2)}%`,
    };
  };

  const nowPercent = () => {
    const now = new Date();
    const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
    const total = (END_HOUR - START_HOUR) * 60;
    return `${(mins / total) * 100}%`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      {/* Day headers */}
      <div className="grid sticky top-0 bg-surface-1 z-10 border-b border-border" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div key={i} className={cn('py-2 text-center border-l border-border', today && 'bg-primary/5')}>
              <div className="text-[10px] text-muted-foreground">{format(day, 'EEE').toUpperCase()}</div>
              <div className={cn('text-sm font-semibold', today ? 'text-primary' : 'text-foreground')}>{format(day, 'd')}</div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="py-1 pr-2 text-right text-[9px] text-muted-foreground self-center">All day</div>
        {days.map((day, i) => {
          const dayAllDayEvents = getAllDayEventsForDay(day);
          return (
            <div key={i} className="border-l border-border p-0.5 min-h-[24px]">
              {dayAllDayEvents.map(e => (
                <EventChip key={e.id} event={e} compact onClick={() => setSelectedEvent(e)} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 relative" style={{ minHeight: `${HOURS.length * 48}px` }}>
        <div className="grid absolute inset-0" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', gridTemplateRows: `repeat(${HOURS.length}, 48px)` }}>
          {HOURS.map(hour => (
            <>
              <div key={`h-${hour}`} className="border-b border-border/40 pr-2 text-right text-[9px] text-muted-foreground -translate-y-2">
                {hour}:00
              </div>
              {days.map((_, di) => (
                <div key={`c-${hour}-${di}`} className="border-b border-border/40 border-l border-border/40" />
              ))}
            </>
          ))}
        </div>

        {/* Events overlay */}
        <div className="absolute inset-0" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', display: 'grid' }}>
          <div />
          {days.map((day, di) => {
            const todayEvts = getTimedEventsForDay(day);
            return (
              <div key={di} className="relative border-l border-border/0">
                {todayEvts.map(e => {
                  const pos = getEventPosition(e);
                  return (
                    <div
                      key={e.id}
                      className="absolute left-0.5 right-0.5 overflow-hidden"
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <EventChip event={e} onClick={() => setSelectedEvent(e)} />
                    </div>
                  );
                })}
                {isToday(day) && (
                  <div className="absolute left-0 right-0 border-t-2 border-primary/60 pointer-events-none z-10" style={{ top: nowPercent() }}>
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <EventModal event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
