'use client';

import { MiniCalendar } from './MiniCalendar';
import { CategoryLegend } from './CategoryLegend';
import { CalendarHeader } from './CalendarHeader';
import { ViewSwitcher } from './ViewSwitcher';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { EventModal } from './EventModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useCalendarNav } from '@/hooks/useCalendarNav';
import type { CalendarView } from '@/types/calendar';

interface CalendarShellProps {
  view: CalendarView;
}

export function CalendarShell({ view }: CalendarShellProps) {
  const { currentDate } = useCalendarNav();
  const [newEventOpen, setNewEventOpen] = useState(false);

  return (
    <div className="flex h-full gap-5 min-h-0">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 space-y-5">
        <Button size="sm" className="w-full" onClick={() => setNewEventOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Termin erstellen
        </Button>
        <MiniCalendar />
        <div className="border-t border-border pt-4">
          <CategoryLegend />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <CalendarHeader />
          <ViewSwitcher />
        </div>
        <div className="flex-1 bg-surface-1 rounded-lg border border-border overflow-hidden flex flex-col min-h-0">
          {view === 'month' && <MonthView />}
          {view === 'week' && <WeekView />}
          {view === 'day' && <DayView />}
        </div>
      </div>

      <EventModal
        event={null}
        open={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        defaultDate={currentDate.toISOString().split('T')[0]}
      />
    </div>
  );
}
