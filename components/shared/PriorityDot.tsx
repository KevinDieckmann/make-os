import { PRIORITY_CONFIG } from '@/lib/constants';
import type { Priority } from '@/types/common';
import { cn } from '@/lib/utils';

interface PriorityDotProps {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityDot({ priority, showLabel, className }: PriorityDotProps) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
      {showLabel && <span className="text-[10px] text-muted-foreground">{config.label}</span>}
    </span>
  );
}
