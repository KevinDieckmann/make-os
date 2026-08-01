import { Clock } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';

interface TaskDeadlineChipProps {
  event: CalendarEvent;
  onClick?: () => void;
}

export function TaskDeadlineChip({ event, onClick }: TaskDeadlineChipProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80 flex items-center gap-1"
      style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', borderLeft: '2px solid #f87171' }}
    >
      <Clock className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{event.title}</span>
    </button>
  );
}
