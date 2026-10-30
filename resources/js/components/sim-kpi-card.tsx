import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SimKpiCard({
    label,
    icon: Icon,
    value,
    note,
    href,
    linkLabel = 'Buka daftar terkait',
    children,
    className,
    tone,
}: {
    label: string;
    icon: LucideIcon;
    value: ReactNode;
    note: string;
    href?: string;
    linkLabel?: string;
    children?: ReactNode;
    className?: string;
    tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
    const labelStyles = {
        info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    };
    const body = (
        <>
            <div className="flex items-center justify-between gap-3">
                {tone ? <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium ${labelStyles[tone]}`}>{label}</span> : <span className="text-[13px] font-medium text-muted-foreground">{label}</span>}
                <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-xl font-semibold sm:mt-3 sm:text-2xl">{value}</div>
            {children && <div className="mt-2 flex flex-wrap items-center gap-1.5">{children}</div>}
            <div className="mt-1 line-clamp-1 text-[11px] leading-4 text-muted-foreground sm:mt-2 sm:text-xs sm:leading-5">{note}</div>
            {href && <div className="mt-2 hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:mt-3 sm:flex">Buka daftar <ArrowRight className="size-3.5" /></div>}
        </>
    );
    const classes = cn('sim-metric min-w-0 p-3 text-left transition-colors hover:bg-muted/30 sm:p-4', className);

    return href ? <Link href={href} aria-label={linkLabel} className={classes}>{body}</Link> : <div className={classes}>{body}</div>;
}
