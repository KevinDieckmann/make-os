import { cn } from '@/lib/utils';
import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import type { CalendarEvent } from '@/types/calendar';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

export function EventChip({ event, onClick, compact }: EventChipProps) {
  const config = EVENT_CATEGORY_CONFIG[event.category];
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80',
        compact ? 'py-px' : 'py-0.5'
      )}
      style={{ backgroundColor: config.bg, color: config.color, borderLeft: `2px solid ${config.color}` }}
    >
      {event.title}
    </button>
  );
}
