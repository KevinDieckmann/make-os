import { cn } from '@/lib/utils';
import { OWNER_CONFIG } from '@/lib/constants';
import type { Owner } from '@/types/common';

interface OwnerAvatarProps {
  owner: Owner;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function OwnerAvatar({ owner, size = 'sm', className }: OwnerAvatarProps) {
  const config = OWNER_CONFIG[owner];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold shrink-0',
        {
          'h-5 w-5 text-[9px]': size === 'xs',
          'h-6 w-6 text-[10px]': size === 'sm',
          'h-8 w-8 text-xs': size === 'md',
        },
        className
      )}
      style={{ backgroundColor: config.bg, color: config.color }}
      title={config.label}
    >
      {config.initials}
    </span>
  );
}
