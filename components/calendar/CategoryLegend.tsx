import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import type { EventCategory } from '@/types/calendar';

const CATEGORIES: EventCategory[] = ['private-malin', 'private-kevin', 'joint', 'holding', 'task-deadline'];

export function CategoryLegend() {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Kategorien</p>
      {CATEGORIES.map(cat => {
        const config = EVENT_CATEGORY_CONFIG[cat];
        return (
          <div key={cat} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
            <span className="text-xs text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}
