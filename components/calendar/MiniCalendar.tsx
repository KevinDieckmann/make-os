'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import { getMonthGrid, isSameDay, isSameMonth, isToday, format } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function MiniCalendar() {
  const { currentDate, goPrev, goNext, setDate } = useCalendarNav();
  const weeks = getMonthGrid(currentDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">{format(currentDate, 'MMM yyyy')}</span>
        <div className="flex gap-0.5">
          <button onClick={goPrev} className="h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button onClick={goNext} className="h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map(d => (
          <span key={d} className="text-[9px] text-muted-foreground text-center py-1 font-medium">{d}</span>
        ))}
        {weeks.flat().map((day, i) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const selected = isSameDay(day, currentDate);
          return (
            <button
              key={i}
              onClick={() => setDate(day.toISOString().split('T')[0])}
              className={cn(
                'h-6 w-6 rounded text-[10px] font-medium flex items-center justify-center transition-colors mx-auto',
                !isCurrentMonth && 'text-muted-foreground/30',
                today && !selected && 'text-primary font-bold',
                selected && 'bg-primary text-primary-foreground',
                !selected && isCurrentMonth && 'hover:bg-surface-2'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
