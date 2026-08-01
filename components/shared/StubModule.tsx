import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

interface StubModuleProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function StubModule({ title, description, icon: Icon }: StubModuleProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="h-16 w-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-5">
        {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : <Construction className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-1">
        {description ?? 'Dieses Modul wird in der nächsten Phase implementiert.'}
      </p>
      <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-surface-2 text-muted-foreground border border-border">
        Kommt bald
      </span>
    </div>
  );
}
