import { cn } from '@/lib/utils';
import type { Tag } from '@/types/common';

interface TagChipProps {
  tag: Tag;
  className?: string;
}

export function TagChip({ tag, className }: TagChipProps) {
  return (
    <span
      className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', className)}
      style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
    >
      {tag.label}
    </span>
  );
}
