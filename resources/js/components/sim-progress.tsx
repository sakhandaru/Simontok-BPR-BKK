import { cn } from '@/lib/utils';

export function SimProgress({ value, label, className }: { value: number; label?: string; className?: string }) {
    const safeValue = Math.max(0, Math.min(100, value));

    return (
        <div className={cn('grid gap-2', className)}>
            {(label || value !== undefined) && (
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    {label ? <span>{label}</span> : <span />}
                    <span className="font-medium tabular-nums">{safeValue}%</span>
                </div>
            )}
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
                <div className="h-full rounded-full bg-[var(--status-info)] transition-[width]" style={{ width: `${safeValue}%` }} />
            </div>
        </div>
    );
}
