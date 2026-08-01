import { cn } from '@/lib/utils';
import { OWNER_CONFIG } from '@/lib/constants';
import type { Owner } from '@/types/common';

interface OwnerBadgeProps {
  owner: Owner;
  className?: string;
}

export function OwnerBadge({ owner, className }: OwnerBadgeProps) {
  const config = OWNER_CONFIG[owner];
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', className)}
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}
