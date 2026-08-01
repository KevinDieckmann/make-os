'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarNav } from '@/hooks/useCalendarNav';

export function CalendarHeader() {
  const { periodLabel, goNext, goPrev, goToday } = useCalendarNav();
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-base font-semibold text-foreground min-w-[220px]">{periodLabel}</h2>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={goPrev} className="h-7 w-7">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext} className="h-7 w-7">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-xs px-2.5">Heute</Button>
      </div>
    </div>
  );
}
