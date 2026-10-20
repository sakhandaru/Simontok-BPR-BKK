import { FileSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SimEmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center', className)}>
            <FileSearch className="mb-3 size-5 text-muted-foreground" />
            <div className="text-sm font-medium">{title}</div>
            {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
