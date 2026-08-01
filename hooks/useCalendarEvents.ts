import { useMemo } from 'react';
import { useCalendar } from '@/context/CalendarContext';
import { useTasks } from '@/context/TasksContext';
import type { CalendarEvent } from '@/types/calendar';

export function useCalendarEvents(): CalendarEvent[] {
  const { state: calState } = useCalendar();
  const { state: taskState } = useTasks();

  return useMemo(() => {
    const taskDeadlines: CalendarEvent[] = taskState.tasks
      .filter(t => t.dueDate && t.status !== 'done')
      .map(t => ({
        id: `deadline-${t.id}`,
        title: `⏰ ${t.title}`,
        category: 'task-deadline' as const,
        owner: t.assignee,
        startDate: `${t.dueDate}T09:00:00.000Z`,
        endDate: `${t.dueDate}T09:30:00.000Z`,
        allDay: true,
        linkedTaskId: t.id,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

    return [...calState.events, ...taskDeadlines];
  }, [calState.events, taskState.tasks]);
}
