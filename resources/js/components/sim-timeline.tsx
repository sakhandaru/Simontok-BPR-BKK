import { Check, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SimTimelineItem = {
    id: string | number;
    title: string;
    description?: ReactNode;
    timestamp?: ReactNode;
    meta?: ReactNode;
    state?: 'complete' | 'current' | 'waiting' | 'danger';
    icon?: LucideIcon;
};

export function SimTimeline({ items, empty }: { items: SimTimelineItem[]; empty?: ReactNode }) {
    if (items.length === 0) return <>{empty ?? null}</>;

    return (
        <div className="relative grid gap-0">
            {items.map((item, index) => {
                const state = item.state ?? 'complete';
                const Icon = item.icon ?? (state === 'waiting' ? Circle : Check);

                return (
                    <div key={item.id} className="relative grid gap-2 py-4 pl-10 md:grid-cols-[1fr_180px]">
                        {index < items.length - 1 && <span className={cn('absolute bottom-0 left-3.5 top-10 w-px', state === 'complete' ? 'sim-track-line' : 'bg-border')} />}
                        <span className={cn(
                            'absolute left-0 top-4 z-10 flex size-7 items-center justify-center rounded-full border bg-background',
                            state === 'complete' && 'sim-track-complete',
                            state === 'current' && 'sim-track-current',
                            state === 'danger' && 'border-red-600 bg-red-600 text-white',
                            state === 'waiting' && 'text-muted-foreground',
                        )}>
                            <Icon className="size-3.5" />
                        </span>
                        <div>
                            <div className="text-sm font-medium">{item.title}</div>
                            {item.description && <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>}
                            {item.meta && <div className="mt-2 text-xs text-muted-foreground">{item.meta}</div>}
                        </div>
                        {item.timestamp && <div className="text-sm text-muted-foreground md:text-right">{item.timestamp}</div>}
                    </div>
                );
            })}
        </div>
    );
}
