import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  color?: string;
  height?: 'xs' | 'sm' | 'md';
}

export function ProgressBar({ percent, className, showLabel, color = '#c87941', height = 'sm' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex-1 rounded-full bg-surface-3 overflow-hidden', {
          'h-1': height === 'xs',
          'h-1.5': height === 'sm',
          'h-2': height === 'md',
        })}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && <span className="text-[10px] text-muted-foreground shrink-0 w-7 text-right">{clamped}%</span>}
    </div>
  );
}
