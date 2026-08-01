import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns';

export function getMonthGrid(date: Date): Date[][] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function formatWeekRange(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  if (isSameMonth(start, end)) {
    return `${format(start, 'd')}–${format(end, 'd')} ${format(start, 'MMMM yyyy')}`;
  }
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

export function formatDayFull(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy');
}

export function navigateDate(
  current: Date,
  direction: 'prev' | 'next' | 'today',
  view: 'month' | 'week' | 'day'
): Date {
  if (direction === 'today') return new Date();
  const delta = direction === 'next' ? 1 : -1;
  if (view === 'month') return delta > 0 ? addMonths(current, 1) : subMonths(current, 1);
  if (view === 'week') return delta > 0 ? addWeeks(current, 1) : subWeeks(current, 1);
  return delta > 0 ? addDays(current, 1) : subDays(current, 1);
}

export function isDateInRange(date: Date, start: string, end: string): boolean {
  const d = startOfDay(date);
  return d >= startOfDay(parseISO(start)) && d <= endOfDay(parseISO(end));
}

export { isSameMonth, isSameDay, isToday, parseISO, format, startOfWeek, endOfWeek };
