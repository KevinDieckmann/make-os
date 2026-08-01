import { useMemo } from 'react';
import { useCalendar } from '@/context/CalendarContext';
import { parseISO, formatMonthYear, formatWeekRange, formatDayFull } from '@/lib/date-utils';

export function useCalendarNav() {
  const { state, dispatch } = useCalendar();
  const currentDate = useMemo(() => parseISO(state.selectedDate), [state.selectedDate]);

  const periodLabel = useMemo(() => {
    if (state.view === 'month') return formatMonthYear(currentDate);
    if (state.view === 'week') return formatWeekRange(currentDate);
    return formatDayFull(currentDate);
  }, [currentDate, state.view]);

  return {
    currentDate,
    view: state.view,
    periodLabel,
    goNext: () => dispatch({ type: 'GO_NEXT' }),
    goPrev: () => dispatch({ type: 'GO_PREV' }),
    goToday: () => dispatch({ type: 'GO_TODAY' }),
    setView: (view: 'month' | 'week' | 'day') => dispatch({ type: 'SET_VIEW', payload: { view } }),
    setDate: (date: string) => dispatch({ type: 'SET_DATE', payload: { date } }),
  };
}
