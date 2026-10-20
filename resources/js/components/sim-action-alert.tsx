import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AlertTone = 'info' | 'warning' | 'danger' | 'success';

const toneClasses: Record<AlertTone, string> = {
    info: 'border-blue-600/30 bg-blue-600/5 text-blue-700 dark:text-blue-300',
    warning: 'border-amber-600/30 bg-amber-600/5 text-amber-700 dark:text-amber-300',
    danger: 'border-red-600/30 bg-red-600/5 text-red-700 dark:text-red-300',
    success: 'border-emerald-600/30 bg-emerald-600/5 text-emerald-700 dark:text-emerald-300',
};

const icons = {
    info: Info,
    warning: TriangleAlert,
    danger: AlertCircle,
    success: CheckCircle2,
};

export function SimActionAlert({ tone = 'info', title, description, action }: { tone?: AlertTone; title: string; description?: ReactNode; action?: ReactNode }) {
    const Icon = icons[tone];

    return (
        <div className={cn('grid gap-3 rounded-md border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start', toneClasses[tone])} role="status">
            <Icon className="mt-0.5 size-4" />
            <div>
                <div className="text-sm font-medium">{title}</div>
                {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
            </div>
            {action && <div className="sm:justify-self-end">{action}</div>}
        </div>
    );
}
